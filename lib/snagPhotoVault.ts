/**
 * Kho lưu trữ ảnh nghiệm thu hiện trường (Snag List Q3/2027) cục bộ trên thiết bị.
 * Tách hoàn toàn khỏi `HOME_MONI_DATA_V4` để giữ gói đồng bộ JSON / Supabase siêu nhẹ.
 * Dùng IndexedDB làm lớp lưu trữ chính và fallback an toàn sang localStorage namespace riêng.
 */

const DB_NAME = "skyone_snag_photo_vault_v1";
const STORE_NAME = "snag_photos";
const FALLBACK_LS_PREFIX = "HOME_MONI_SNAG_PHOTO_V1_";
const MAX_TARGET_BYTES = 150 * 1024; // 150 KB
const MAX_DIMENSION_PX = 1280;

export interface StoredSnagPhoto {
  key: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: string;
}

const memoryPhotoCache = new Map<string, string>();

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
      img.onerror = () => resolve({ ok: false, error: "Trình duyệt không giải mã được định dạng ảnh này." });
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

  memoryPhotoCache.set(key, record.dataUrl);

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
    if (storedInIdb) {
      return { ok: true, key, dataUrl: record.dataUrl, sizeBytes: record.sizeBytes };
    }
  }

  // Fallback sang localStorage namespace tách biệt hoàn toàn với HOME_MONI_DATA_V4
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${FALLBACK_LS_PREFIX}${key}`, record.dataUrl);
    }
  } catch {
    // Nếu bộ nhớ trình duyệt đầy, ảnh vẫn tồn tại trong memoryCache phiên hiện tại
  }

  return { ok: true, key, dataUrl: record.dataUrl, sizeBytes: record.sizeBytes };
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

  return null;
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
}
