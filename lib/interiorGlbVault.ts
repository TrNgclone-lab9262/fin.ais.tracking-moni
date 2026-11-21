/**
 * Kho lưu trữ cục bộ IndexedDB cho các mô hình 3D tùy chỉnh (.glb / .gltf)
 * do người dùng tải lên SKYONE 3D Studio.
 * Tách hoàn toàn dữ liệu nhị phân khỏi localStorage để tránh tràn hạn mức ~5MB.
 */

const DB_NAME = "skyone_studio_glb_vault_v1";
const STORE_NAME = "glb_models";
const MAX_GLB_BYTES = 15 * 1024 * 1024; // 15 MB

export interface StoredGlbRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: ArrayBuffer;
  createdAt: string;
}

const memoryCache = new Map<string, ArrayBuffer>();

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCustomGlbFile(file: File): Promise<{
  ok: boolean;
  id?: string;
  fileName?: string;
  error?: string;
}> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".glb") && !lower.endsWith(".gltf")) {
    return {
      ok: false,
      error: "Chỉ hỗ trợ định dạng mô hình 3D chuẩn .glb hoặc .gltf.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "File mô hình 3D rỗng." };
  }
  if (file.size > MAX_GLB_BYTES) {
    return {
      ok: false,
      error: "Dung lượng file vượt quá giới hạn 15 MB. Hãy nén Draco/Meshopt trước khi nạp.",
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const id = `glb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    memoryCache.set(id, buffer.slice(0));

    const db = await openVaultDb();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const record: StoredGlbRecord = {
            id,
            fileName: file.name,
            mimeType: file.type || "model/gltf-binary",
            sizeBytes: file.size,
            buffer,
            createdAt: new Date().toISOString(),
          };
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    return { ok: true, id, fileName: file.name };
  } catch {
    return {
      ok: false,
      error: "Không thể đọc dữ liệu file 3D. Vui lòng thử lại với file .glb hợp lệ.",
    };
  }
}

export async function loadCustomGlbBuffer(id: string): Promise<ArrayBuffer | null> {
  const cached = memoryCache.get(id);
  if (cached) return cached.slice(0);

  const db = await openVaultDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const rec = req.result as StoredGlbRecord | undefined;
        if (rec?.buffer) {
          memoryCache.set(id, rec.buffer.slice(0));
          resolve(rec.buffer.slice(0));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteCustomGlbBuffer(id: string): Promise<void> {
  memoryCache.delete(id);
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
