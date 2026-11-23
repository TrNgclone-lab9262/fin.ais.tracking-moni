/**
 * @file jsonbCasSync.ts
 * @description Bộ máy ghi đồng bộ CAS nguyên tử (Compare-And-Swap theo `revision`)
 * kết hợp Smart Merge tự động tối đa 2 vòng cho 3 bảng JSONB (SKYONE, GOLD, INTERIOR).
 * Nếu vẫn xung đột sau tối đa 2 vòng, ném `JsonbCasConflictError` kèm bản đã gộp mới nhất
 * để lớp điều phối đẩy an toàn vào hàng đợi Outbox, tuyệt đối không ghi đè hay mất dữ liệu.
 */

export interface CasErrorLike {
  code?: string;
  message?: string;
}

export interface CasRemoteRow<TDoc> {
  doc: TDoc | null;
  revision: number | null;
}

export interface CasWriteOutcome<TDoc> {
  ok: true;
  skippedMissingTable?: boolean;
  conflictResolved: boolean;
  newRevision?: number;
  finalDoc: TDoc;
}

export class JsonbCasConflictError<TDoc = unknown> extends Error {
  public readonly code = 'CAS_CONFLICT_RETRY_OUTBOX' as const;
  public readonly table: string;
  public readonly roundsAttempted: number;
  public readonly mergedPayload: TDoc;

  constructor(table: string, roundsAttempted: number, mergedPayload: TDoc) {
    super(
      `Xung đột đồng bộ liên tiếp trên ${table} sau ${roundsAttempted} vòng hợp nhất — đã chuyển vào hàng đợi Outbox để bảo toàn dữ liệu.`
    );
    this.name = 'JsonbCasConflictError';
    this.table = table;
    this.roundsAttempted = roundsAttempted;
    this.mergedPayload = mergedPayload;
  }
}

export interface ExecuteJsonbCasWriteOptions<TDoc> {
  table: string;
  localDoc: TDoc;
  knownRevision?: number;
  maxConflictRounds?: number;
  isMissingRelationError: (err: CasErrorLike | null | undefined) => boolean;
  isMissingColumnError: (err: CasErrorLike | null | undefined) => boolean;
  readRemote: () => Promise<{ row: CasRemoteRow<TDoc> | null; error: CasErrorLike | null }>;
  insertRow: (doc: TDoc) => Promise<{ revision: number | null; error: CasErrorLike | null }>;
  updateRowWithRevision: (
    doc: TDoc,
    expectedRevision: number
  ) => Promise<{ updated: boolean; revision: number | null; error: CasErrorLike | null }>;
  upsertLegacy: (doc: TDoc) => Promise<{ revision: number | null; error: CasErrorLike | null }>;
  mergeDocs: (remoteDoc: TDoc, localDoc: TDoc) => TDoc;
}

function isUniqueViolationError(err: CasErrorLike | null | undefined): boolean {
  if (!err) return false;
  return err.code === '23505' || Boolean(err.message && /duplicate key|unique constraint/i.test(err.message));
}

export async function executeJsonbCasWrite<TDoc>(
  options: ExecuteJsonbCasWriteOptions<TDoc>
): Promise<CasWriteOutcome<TDoc>> {
  const maxConflictRounds = Math.max(1, options.maxConflictRounds ?? 2);
  let candidateDoc = options.localDoc;
  let conflictResolved = false;

  // Bước 1: Xác định trạng thái ban đầu trên Cloud (nếu chưa có revision cục bộ hoặc cần kiểm tra)
  let baseRevision: number | null =
    typeof options.knownRevision === 'number' ? options.knownRevision : null;

  if (baseRevision === null) {
    const initialRead = await options.readRemote();
    if (initialRead.error) {
      if (options.isMissingRelationError(initialRead.error)) {
        return { ok: true, skippedMissingTable: true, conflictResolved: false, finalDoc: candidateDoc };
      }
      throw new Error(initialRead.error.message || `Không thể đọc bản ghi ${options.table}.`);
    }

    if (!initialRead.row) {
      // Bản ghi chưa tồn tại trên Cloud -> thử chèn mới nguyên tử
      const inserted = await options.insertRow(candidateDoc);
      if (!inserted.error) {
        return {
          ok: true,
          conflictResolved: false,
          newRevision: inserted.revision ?? undefined,
          finalDoc: candidateDoc,
        };
      }
      if (options.isMissingRelationError(inserted.error)) {
        return { ok: true, skippedMissingTable: true, conflictResolved: false, finalDoc: candidateDoc };
      }
      if (options.isMissingColumnError(inserted.error)) {
        const legacy = await options.upsertLegacy(candidateDoc);
        if (legacy.error) {
          if (options.isMissingRelationError(legacy.error)) {
            return { ok: true, skippedMissingTable: true, conflictResolved: false, finalDoc: candidateDoc };
          }
          throw new Error(legacy.error.message || `Lỗi ghi ${options.table}.`);
        }
        return {
          ok: true,
          conflictResolved: false,
          newRevision: legacy.revision ?? undefined,
          finalDoc: candidateDoc,
        };
      }
      if (!isUniqueViolationError(inserted.error)) {
        throw new Error(inserted.error.message || `Lỗi chèn mới ${options.table}.`);
      }
      // 23505: Thiết bị khác vừa chèn trước trong tích tắc -> chuyển sang vòng CAS merge bên dưới
    } else if (initialRead.row.revision === null) {
      // DB cũ chưa có cột `revision` -> hợp nhất an toàn nếu có bản ghi rồi ghi tương thích
      if (initialRead.row.doc) {
        candidateDoc = options.mergeDocs(initialRead.row.doc, candidateDoc);
        conflictResolved = true;
      }
      const legacy = await options.upsertLegacy(candidateDoc);
      if (legacy.error) {
        if (options.isMissingRelationError(legacy.error)) {
          return { ok: true, skippedMissingTable: true, conflictResolved, finalDoc: candidateDoc };
        }
        throw new Error(legacy.error.message || `Lỗi ghi ${options.table}.`);
      }
      return {
        ok: true,
        conflictResolved,
        newRevision: legacy.revision ?? undefined,
        finalDoc: candidateDoc,
      };
    } else {
      if (initialRead.row.doc) {
        candidateDoc = options.mergeDocs(initialRead.row.doc, candidateDoc);
        conflictResolved = true;
      }
      baseRevision = initialRead.row.revision;
    }
  }

  // Bước 2: Thử cập nhật CAS nguyên tử lần đầu bằng baseRevision đã biết (nếu có)
  if (baseRevision !== null) {
    const firstTry = await options.updateRowWithRevision(candidateDoc, baseRevision);
    if (firstTry.error) {
      if (options.isMissingRelationError(firstTry.error)) {
        return { ok: true, skippedMissingTable: true, conflictResolved, finalDoc: candidateDoc };
      }
      if (options.isMissingColumnError(firstTry.error)) {
        const legacy = await options.upsertLegacy(candidateDoc);
        if (legacy.error) {
          throw new Error(legacy.error.message || `Lỗi ghi ${options.table}.`);
        }
        return {
          ok: true,
          conflictResolved,
          newRevision: legacy.revision ?? undefined,
          finalDoc: candidateDoc,
        };
      }
      throw new Error(firstTry.error.message || `Lỗi cập nhật ${options.table}.`);
    }
    if (firstTry.updated) {
      return {
        ok: true,
        conflictResolved,
        newRevision: firstTry.revision ?? baseRevision + 1,
        finalDoc: candidateDoc,
      };
    }
  }

  // Bước 3: Phát hiện xung đột -> chạy Smart Merge + CAS nguyên tử tối đa `maxConflictRounds` (2 vòng)
  for (let round = 1; round <= maxConflictRounds; round++) {
    const fresh = await options.readRemote();
    if (fresh.error) {
      if (options.isMissingRelationError(fresh.error)) {
        return { ok: true, skippedMissingTable: true, conflictResolved, finalDoc: candidateDoc };
      }
      throw new Error(fresh.error.message || `Không thể tải lại bản ghi ${options.table}.`);
    }

    if (!fresh.row) {
      const reinserted = await options.insertRow(candidateDoc);
      if (!reinserted.error) {
        return {
          ok: true,
          conflictResolved,
          newRevision: reinserted.revision ?? undefined,
          finalDoc: candidateDoc,
        };
      }
      if (!isUniqueViolationError(reinserted.error)) {
        throw new Error(reinserted.error.message || `Lỗi chèn lại ${options.table}.`);
      }
      continue;
    }

    if (fresh.row.doc) {
      candidateDoc = options.mergeDocs(fresh.row.doc, candidateDoc);
      conflictResolved = true;
    }

    if (fresh.row.revision === null) {
      const legacy = await options.upsertLegacy(candidateDoc);
      if (legacy.error) {
        throw new Error(legacy.error.message || `Lỗi ghi ${options.table}.`);
      }
      return {
        ok: true,
        conflictResolved,
        newRevision: legacy.revision ?? undefined,
        finalDoc: candidateDoc,
      };
    }

    const attempt = await options.updateRowWithRevision(candidateDoc, fresh.row.revision);
    if (attempt.error) {
      if (options.isMissingColumnError(attempt.error)) {
        const legacy = await options.upsertLegacy(candidateDoc);
        if (legacy.error) {
          throw new Error(legacy.error.message || `Lỗi ghi ${options.table}.`);
        }
        return {
          ok: true,
          conflictResolved,
          newRevision: legacy.revision ?? undefined,
          finalDoc: candidateDoc,
        };
      }
      throw new Error(attempt.error.message || `Lỗi cập nhật CAS ${options.table}.`);
    }

    if (attempt.updated) {
      return {
        ok: true,
        conflictResolved,
        newRevision: attempt.revision ?? fresh.row.revision + 1,
        finalDoc: candidateDoc,
      };
    }
  }

  // Hết 2 vòng vẫn xung đột liên tiếp -> ném lỗi chuẩn để FinanceContext đẩy bản đã gộp vào Outbox
  throw new JsonbCasConflictError<TDoc>(options.table, maxConflictRounds, candidateDoc);
}
