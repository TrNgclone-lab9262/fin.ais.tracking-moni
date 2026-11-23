/**
 * Kho lưu trữ ảnh nghiệm thu hiện trường (Snag List Q3/2027) theo mô hình Hybrid Local-First + Cloud Sync.
 * - Tầng 1 (0ms): IndexedDB cục bộ + Memory Cache (tách hoàn toàn khỏi `HOME_MONI_DATA_V4`).
 * - Tầng 2 (Đa thiết bị): Tự động đồng bộ nền lên Supabase Storage bucket `household-media`
 *   theo đường dẫn `{householdId}/snag/{key}.jpg` khi hộ gia đình đã đăng nhập Cloud.
 */

import { isSupabaseConfigured, supabase } from "./supabaseClient";

const DB_NAME = "skyone_snag_photo_vault_v1";
const STORE_NAME = "snag_photos";
const FALLBACK_LS_PREFIX = "HOME_MONI_SNAG_PHOTO_V1_";
const MEDIA_BUCKET = "household-media";
const MAX_TARGET_BYTES = 150 * 1024; // 150 KB
const MAX_DIMENSION_PX = 1280;
const SAFE_KEY_REGEX = /^[a-zA-Z0-9_-]{4,120}$/;

export interface StoredSnagPhoto {
  key: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: string;
}

const memoryPhotoCache = new Map<string, string>();
let activeCloudHouseholdId: string | null = null;

export function configureSnagPhotoCloudHousehold(householdId: string | null): void {
  activeCloudHouseholdId = householdId && /^[0-9a-fA-F-]{36}$/.test(householdId) ? householdId : null;
}

function buildCloudSnagPath(householdId: string, key: string): string | null {
  if (!SAFE_KEY_REGEX.test(key)) return null;
  return `${householdId}/snag/${key}.jpg`;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(",");
    if (!header || !base64) return null;
    const mimeMatch = header.match(/data:([^;]+);base64/i);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
}

function openSnagPhotoDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return dataUrl.length;
  const base64Len = dataUrl.length - commaIdx - 1;
  return Math.floor((base64Len * 3) / 4);
}

async function persistPhotoLocally(record: StoredSnagPhoto): Promise<void> {
  memoryPhotoCache.set(record.key, record.dataUrl);
  const db = await openSnagPhotoDb();
  if (db) {
    const storedInIdb = await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
    if (storedInIdb) return;
  }

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${FALLBACK_LS_PREFIX}${record.key}`, record.dataUrl);
    }
  } catch {
    // Bộ nhớ trình duyệt đầy, ảnh vẫn tồn tại trong memoryCache phiên hiện tại
  }
}

async function syncPhotoToCloudBackground(key: string, dataUrl: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !activeCloudHouseholdId) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const path = buildCloudSnagPath(activeCloudHouseholdId, key);
  if (!path) return false;

  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return false;

  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

async function fetchPhotoFromCloud(key: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase || !activeCloudHouseholdId) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const path = buildCloudSnagPath(activeCloudHouseholdId, key);
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(path);
    if (error || !data) return null;
    const dataUrl = await blobToDataUrl(data);
    if (!dataUrl) return null;

    await persistPhotoLocally({
      key,
      dataUrl,
      sizeBytes: data.size || estimateDataUrlBytes(dataUrl),
      createdAt: new Date().toISOString(),
    });
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Nén ảnh hiện trường về JPEG <= 150KB (cạnh tối đa 1280px) bằng HTMLCanvasElement.
 */
export async function compressSnagPhotoFile(file: File): Promise<{
  ok: boolean;
  dataUrl?: string;
  sizeBytes?: number;
  error?: string;
}> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP, HEIC)." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Tệp hình ảnh rỗng." };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ ok: false, error: "Không thể đọc tệp ảnh." });
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) {
        resolve({ ok: false, error: "Dữ liệu ảnh không hợp lệ." });
        return;
      }
      const img = new Image();
      img.onerror = () =>
        resolve({ ok: false, error: "Trình duyệt không giải mã được định dạng ảnh này." });
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width <= 0 || height <= 0) {
            resolve({ ok: false, error: "Kích thước ảnh không hợp lệ." });
            return;
          }

          const ratio = Math.min(1, MAX_DIMENSION_PX / Math.max(width, height));
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ ok: false, error: "Không khởi tạo được bộ nén ảnh Canvas." });
            return;
          }

          let currentW = width;
          let currentH = height;
          let quality = 0.82;
          let output = "";
          let bytes = Infinity;

          for (let attempt = 0; attempt < 6; attempt++) {
            canvas.width = currentW;
            canvas.height = currentH;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, currentW, currentH);
            ctx.drawImage(img, 0, 0, currentW, currentH);
            output = canvas.toDataURL("image/jpeg", quality);
            bytes = estimateDataUrlBytes(output);
            if (bytes <= MAX_TARGET_BYTES) {
              break;
            }
            if (quality > 0.45) {
              quality = Number((quality - 0.14).toFixed(2));
            } else {
              currentW = Math.max(320, Math.round(currentW * 0.78));
              currentH = Math.max(240, Math.round(currentH * 0.78));
            }
          }

          resolve({ ok: true, dataUrl: output, sizeBytes: bytes });
        } catch {
          resolve({ ok: false, error: "Lỗi khi nén ảnh hiện trường." });
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export async function saveSnagPhoto(file: File): Promise<{
  ok: boolean;
  key?: string;
  dataUrl?: string;
  sizeBytes?: number;
  cloudSynced?: boolean;
  error?: string;
}> {
  const compressed = await compressSnagPhotoFile(file);
  if (!compressed.ok || !compressed.dataUrl) {
    return compressed;
  }

  const key = `snag_photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record: StoredSnagPhoto = {
    key,
    dataUrl: compressed.dataUrl,
    sizeBytes: compressed.sizeBytes ?? estimateDataUrlBytes(compressed.dataUrl),
    createdAt: new Date().toISOString(),
  };

  await persistPhotoLocally(record);
  const cloudSynced = await syncPhotoToCloudBackground(key, record.dataUrl);

  return {
    ok: true,
    key,
    dataUrl: record.dataUrl,
    sizeBytes: record.sizeBytes,
    cloudSynced,
  };
}

export async function loadSnagPhoto(key: string): Promise<string | null> {
  if (!key) return null;
  const cached = memoryPhotoCache.get(key);
  if (cached) return cached;

  const db = await openSnagPhotoDb();
  if (db) {
    const found = await new Promise<string | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => {
          const rec = req.result as StoredSnagPhoto | undefined;
          if (rec?.dataUrl) {
            memoryPhotoCache.set(key, rec.dataUrl);
            resolve(rec.dataUrl);
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

  try {
    if (typeof window !== "undefined") {
      const lsVal = window.localStorage.getItem(`${FALLBACK_LS_PREFIX}${key}`);
      if (lsVal) {
        memoryPhotoCache.set(key, lsVal);
        return lsVal;
      }
    }
  } catch {
    // ignore
  }

  // Không có cục bộ -> tự động kéo từ Supabase Storage (ảnh chụp từ máy còn lại)
  return fetchPhotoFromCloud(key);
}

export async function deleteSnagPhoto(key: string): Promise<void> {
  if (!key) return;
  memoryPhotoCache.delete(key);

  const db = await openSnagPhotoDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${FALLBACK_LS_PREFIX}${key}`);
    }
  } catch {
    // ignore
  }

  if (isSupabaseConfigured && supabase && activeCloudHouseholdId) {
    const path = buildCloudSnagPath(activeCloudHouseholdId, key);
    if (path) {
      void supabase.storage.from(MEDIA_BUCKET).remove([path]).catch(() => undefined);
    }
  }
}
