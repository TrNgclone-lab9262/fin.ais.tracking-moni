/**
 * Kho lưu trữ Hybrid Local-First + Supabase Storage Cloud Sync cho mô hình 3D tùy chỉnh (.glb / .gltf)
 * do người dùng tải lên SKYONE 3D Studio.
 * - Lưu cục bộ IndexedDB để nạp tức thì 0ms và không làm tràn localStorage (~5MB).
 * - Đồng bộ nền lên Supabase Storage bucket `household-media` tại `{householdId}/glb/{id}.glb`
 *   để 2 vợ chồng xem chung mô hình 3D trên mọi thiết bị.
 */

import { isSupabaseConfigured, supabase } from "./supabaseClient";

const DB_NAME = "skyone_studio_glb_vault_v1";
const STORE_NAME = "glb_models";
const MEDIA_BUCKET = "household-media";
const MAX_GLB_BYTES = 15 * 1024 * 1024; // 15 MB
const SAFE_GLB_ID_REGEX = /^[a-zA-Z0-9_-]{4,120}$/;

export interface StoredGlbRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: ArrayBuffer;
  createdAt: string;
}

const memoryCache = new Map<string, ArrayBuffer>();
let activeCloudHouseholdId: string | null = null;

export function configureGlbCloudHousehold(householdId: string | null): void {
  activeCloudHouseholdId = householdId && /^[0-9a-fA-F-]{36}$/.test(householdId) ? householdId : null;
}

function buildCloudGlbPath(householdId: string, id: string): string | null {
  if (!SAFE_GLB_ID_REGEX.test(id)) return null;
  return `${householdId}/glb/${id}.glb`;
}

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

async function persistGlbLocally(record: StoredGlbRecord): Promise<void> {
  memoryCache.set(record.id, record.buffer.slice(0));
  const db = await openVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function uploadGlbToCloud(id: string, buffer: ArrayBuffer, mimeType: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !activeCloudHouseholdId) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const path = buildCloudGlbPath(activeCloudHouseholdId, id);
  if (!path) return false;

  try {
    const blob = new Blob([buffer], { type: mimeType || "model/gltf-binary" });
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      contentType: mimeType || "model/gltf-binary",
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

async function downloadGlbFromCloud(id: string): Promise<ArrayBuffer | null> {
  if (!isSupabaseConfigured || !supabase || !activeCloudHouseholdId) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const path = buildCloudGlbPath(activeCloudHouseholdId, id);
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(path);
    if (error || !data) return null;
    const buffer = await data.arrayBuffer();
    if (buffer.byteLength <= 0 || buffer.byteLength > MAX_GLB_BYTES) return null;

    await persistGlbLocally({
      id,
      fileName: `${id}.glb`,
      mimeType: data.type || "model/gltf-binary",
      sizeBytes: buffer.byteLength,
      buffer: buffer.slice(0),
      createdAt: new Date().toISOString(),
    });
    return buffer;
  } catch {
    return null;
  }
}

export async function saveCustomGlbFile(file: File): Promise<{
  ok: boolean;
  id?: string;
  fileName?: string;
  cloudSynced?: boolean;
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
    const mimeType = file.type || "model/gltf-binary";

    await persistGlbLocally({
      id,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      buffer: buffer.slice(0),
      createdAt: new Date().toISOString(),
    });

    const cloudSynced = await uploadGlbToCloud(id, buffer, mimeType);
    return { ok: true, id, fileName: file.name, cloudSynced };
  } catch {
    return {
      ok: false,
      error: "Không thể đọc dữ liệu file 3D. Vui lòng thử lại với file .glb hợp lệ.",
    };
  }
}

export async function loadCustomGlbBuffer(id: string): Promise<ArrayBuffer | null> {
  if (!id) return null;
  const cached = memoryCache.get(id);
  if (cached) return cached.slice(0);

  const db = await openVaultDb();
  if (db) {
    const found = await new Promise<ArrayBuffer | null>((resolve) => {
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
    if (found) return found;
  }

  // Fallback kéo từ Supabase Storage nếu mô hình được tải từ máy còn lại
  return downloadGlbFromCloud(id);
}

export async function hasCustomGlbBuffer(id: string): Promise<boolean> {
  if (!id) return false;
  if (memoryCache.has(id)) return true;
  const buf = await loadCustomGlbBuffer(id);
  return buf !== null;
}

export async function deleteCustomGlbBuffer(id: string): Promise<void> {
  if (!id) return;
  memoryCache.delete(id);
  const db = await openVaultDb();
  if (db) {
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

  if (isSupabaseConfigured && supabase && activeCloudHouseholdId) {
    const path = buildCloudGlbPath(activeCloudHouseholdId, id);
    if (path) {
      void supabase.storage.from(MEDIA_BUCKET).remove([path]).catch(() => undefined);
    }
  }
}
