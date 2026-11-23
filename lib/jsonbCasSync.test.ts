import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CasErrorLike,
  JsonbCasConflictError,
  executeJsonbCasWrite,
} from './jsonbCasSync';

interface FakeDoc {
  items: string[];
}

const mergeFakeDocs = (remote: FakeDoc, local: FakeDoc): FakeDoc => ({
  items: Array.from(new Set([...remote.items, ...local.items])).sort(),
});

const isMissingRel = (err: CasErrorLike | null | undefined) => err?.code === '42P01';
const isMissingCol = (err: CasErrorLike | null | undefined) => err?.code === '42703';

test('executeJsonbCasWrite succeeds atomically on first CAS update when revision matches', async () => {
  let dbDoc: FakeDoc = { items: ['a'] };
  let dbRev = 3;

  const outcome = await executeJsonbCasWrite<FakeDoc>({
    table: 'gold_portfolios',
    localDoc: { items: ['a', 'b'] },
    knownRevision: 3,
    isMissingRelationError: isMissingRel,
    isMissingColumnError: isMissingCol,
    readRemote: async () => ({ row: { doc: dbDoc, revision: dbRev }, error: null }),
    insertRow: async () => ({ revision: 1, error: null }),
    updateRowWithRevision: async (doc, expectedRev) => {
      if (expectedRev !== dbRev) return { updated: false, revision: null, error: null };
      dbDoc = doc;
      dbRev += 1;
      return { updated: true, revision: dbRev, error: null };
    },
    upsertLegacy: async () => ({ revision: null, error: null }),
    mergeDocs: mergeFakeDocs,
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.conflictResolved, false);
  assert.equal(outcome.newRevision, 4);
  assert.deepEqual(dbDoc.items, ['a', 'b']);
});

test('executeJsonbCasWrite resolves 1-round concurrent write via Smart Merge + atomic CAS retry', async () => {
  // Thiết bị B vừa ghi 'c' làm revision tăng từ 3 -> 4 trước khi thiết bị A ghi 'b'
  let dbDoc: FakeDoc = { items: ['a', 'c'] };
  let dbRev = 4;

  const outcome = await executeJsonbCasWrite<FakeDoc>({
    table: 'gold_portfolios',
    localDoc: { items: ['a', 'b'] },
    knownRevision: 3,
    maxConflictRounds: 2,
    isMissingRelationError: isMissingRel,
    isMissingColumnError: isMissingCol,
    readRemote: async () => ({ row: { doc: dbDoc, revision: dbRev }, error: null }),
    insertRow: async () => ({ revision: 1, error: null }),
    updateRowWithRevision: async (doc, expectedRev) => {
      if (expectedRev !== dbRev) return { updated: false, revision: null, error: null };
      dbDoc = doc;
      dbRev += 1;
      return { updated: true, revision: dbRev, error: null };
    },
    upsertLegacy: async () => ({ revision: null, error: null }),
    mergeDocs: mergeFakeDocs,
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.conflictResolved, true);
  assert.equal(outcome.newRevision, 5);
  assert.deepEqual(outcome.finalDoc.items, ['a', 'b', 'c']);
  assert.deepEqual(dbDoc.items, ['a', 'b', 'c']);
});

test('executeJsonbCasWrite throws JsonbCasConflictError with merged payload after 2 consecutive conflict rounds', async () => {
  let dbRev = 10;
  let updateAttempts = 0;

  await assert.rejects(
    async () => {
      await executeJsonbCasWrite<FakeDoc>({
        table: 'interior_studios',
        localDoc: { items: ['local_sofa'] },
        knownRevision: 9,
        maxConflictRounds: 2,
        isMissingRelationError: isMissingRel,
        isMissingColumnError: isMissingCol,
        readRemote: async () => ({
          row: { doc: { items: [`remote_${dbRev}`] }, revision: dbRev },
          error: null,
        }),
        insertRow: async () => ({ revision: 1, error: null }),
        updateRowWithRevision: async () => {
          updateAttempts += 1;
          // Giả lập thiết bị kia liên tục ghi xen ngang ngay trước mỗi lần CAS update
          dbRev += 1;
          return { updated: false, revision: null, error: null };
        },
        upsertLegacy: async () => ({ revision: null, error: null }),
        mergeDocs: mergeFakeDocs,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof JsonbCasConflictError);
      assert.equal(err.code, 'CAS_CONFLICT_RETRY_OUTBOX');
      assert.equal(err.roundsAttempted, 2);
      assert.equal(updateAttempts, 3); // 1 lần đầu + 2 vòng merge retry
      const merged = err.mergedPayload as FakeDoc;
      assert.ok(merged.items.includes('local_sofa'));
      assert.ok(merged.items.includes('remote_11'));
      assert.ok(merged.items.includes('remote_12'));
      return true;
    }
  );
});

test('executeJsonbCasWrite falls back cleanly when legacy DB lacks revision column or table', async () => {
  let legacyUpserted = false;
  const legacyOutcome = await executeJsonbCasWrite<FakeDoc>({
    table: 'skyone_loans',
    localDoc: { items: ['k1'] },
    knownRevision: 1,
    isMissingRelationError: isMissingRel,
    isMissingColumnError: isMissingCol,
    readRemote: async () => ({ row: { doc: { items: ['k0'] }, revision: null }, error: null }),
    insertRow: async () => ({ revision: null, error: { code: '42703', message: 'missing revision' } }),
    updateRowWithRevision: async () => ({
      updated: false,
      revision: null,
      error: { code: '42703', message: 'column revision does not exist' },
    }),
    upsertLegacy: async () => {
      legacyUpserted = true;
      return { revision: null, error: null };
    },
    mergeDocs: mergeFakeDocs,
  });

  assert.equal(legacyOutcome.ok, true);
  assert.equal(legacyUpserted, true);

  const missingTableOutcome = await executeJsonbCasWrite<FakeDoc>({
    table: 'gold_portfolios',
    localDoc: { items: ['g1'] },
    knownRevision: undefined,
    isMissingRelationError: isMissingRel,
    isMissingColumnError: isMissingCol,
    readRemote: async () => ({ row: null, error: { code: '42P01', message: 'no table' } }),
    insertRow: async () => ({ revision: null, error: null }),
    updateRowWithRevision: async () => ({ updated: false, revision: null, error: null }),
    upsertLegacy: async () => ({ revision: null, error: null }),
    mergeDocs: mergeFakeDocs,
  });

  assert.equal(missingTableOutcome.ok, true);
  assert.equal(missingTableOutcome.skippedMissingTable, true);
});
