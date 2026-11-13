/**
 * @file authSecurity.ts
 * @description Tầng bảo mật & cá nhân hóa cho trang /login và màn hình khóa HOME MONI:
 * - Băm mã Code 4-6 chữ số bằng SHA-256 + muối ngẫu nhiên (Web Crypto API).
 * - Tích hợp WebAuthn (Face ID / Touch ID / Sinh trắc học Android & iOS PWA) kèm fallback an toàn.
 * - Quản lý & nén ảnh nền cá nhân tải trực tiếp từ thư viện thiết bị cho Anh Chuột & Bé Mèo.
 */

import { AppSettings, AuthMemberId, MemberAuthConfig } from '@/types/finance';

export const WALLPAPER_STORAGE_KEY = 'HOME_MONI_WALLPAPERS_V1';

export interface MemberWallpaperMap {
  HUSBAND?: string;
  WIFE?: string;
}

export interface BiometricAvailability {
  supported: boolean;
  platformAuthenticatorAvailable: boolean;
  reason?: string;
}

export interface BiometricResult {
  success: boolean;
  credentialId?: string;
  deviceLabel?: string;
  error?: string;
}

export function isValidPasscodeFormat(code: string): boolean {
  return /^\d{4,6}$/.test(code.trim());
}

export function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(input);
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback FNV-1a mở rộng nếu môi trường thử nghiệm không hỗ trợ subtle
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Băm mã Code đăng nhập với salt ngẫu nhiên.
 */
export async function hashPasscode(
  code: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const cleaned = code.trim();
  const salt = existingSalt || generateSaltHex(16);
  const hash = await sha256Hex(`HOMEMONI::${salt}::${cleaned}`);
  return { hash, salt };
}

/**
 * Kiểm tra mã Code người dùng nhập so với bản băm đã lưu.
 */
export async function verifyPasscode(
  inputCode: string,
  storedHash?: string,
  storedSalt?: string
): Promise<boolean> {
  if (!storedHash || !storedSalt) return false;
  const cleaned = inputCode.trim();
  if (!cleaned) return false;
  const { hash } = await hashPasscode(cleaned, storedSalt);
  if (hash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

export function getMemberAuthConfig(
  settings: AppSettings,
  member: AuthMemberId
): MemberAuthConfig {
  return (member === 'HUSBAND' ? settings.husbandAuth : settings.wifeAuth) || {};
}

export function hasMemberPasscode(settings: AppSettings, member: AuthMemberId): boolean {
  const cfg = getMemberAuthConfig(settings, member);
  if (cfg.passcodeHash && cfg.passcodeSalt) return true;
  return Boolean(settings.pinCode && /^\d{4,6}$/.test(settings.pinCode));
}

export function hasAnyAppPasscode(settings: AppSettings): boolean {
  return (
    hasMemberPasscode(settings, 'HUSBAND') ||
    hasMemberPasscode(settings, 'WIFE') ||
    Boolean(settings.pinCode && /^\d{4,6}$/.test(settings.pinCode))
  );
}

// --- WebAuthn Face ID / Touch ID / Sinh trắc học thiết bị ---

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (typeof window === 'undefined') {
    return { supported: false, platformAuthenticatorAvailable: false, reason: 'SSR' };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      platformAuthenticatorAvailable: false,
      reason: 'Yêu cầu kết nối HTTPS bảo mật để dùng Face ID / Sinh trắc học.',
    };
  }
  if (!('PublicKeyCredential' in window) || !navigator.credentials) {
    return {
      supported: false,
      platformAuthenticatorAvailable: false,
      reason: 'Trình duyệt hiện tại chưa hỗ trợ WebAuthn Face ID.',
    };
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return {
      supported: true,
      platformAuthenticatorAvailable: available,
      reason: available
        ? undefined
        : 'Thiết bị chưa bật Face ID / Vân tay hệ thống. Bạn vẫn dùng mã Code dự phòng bình thường.',
    };
  } catch {
    return {
      supported: true,
      platformAuthenticatorAvailable: false,
      reason: 'Không kiểm tra được cảm biến sinh trắc học trên thiết bị này.',
    };
  }
}

function getDeviceBiometricLabel(): string {
  if (typeof navigator === 'undefined') return 'Sinh trắc học thiết bị';
  const ua = navigator.userAgent || '';
  if (/iphone|ipad/i.test(ua)) return 'Face ID / Touch ID (iOS)';
  if (/android/i.test(ua)) return 'Khuôn mặt / Vân tay (Android)';
  if (/macintosh/i.test(ua)) return 'Touch ID (macOS)';
  if (/windows/i.test(ua)) return 'Windows Hello';
  return 'Sinh trắc học WebAuthn';
}

export async function registerMemberBiometric(
  member: AuthMemberId,
  memberDisplayName: string
): Promise<BiometricResult> {
  const availability = await checkBiometricAvailability();
  if (!availability.supported) {
    return { success: false, error: availability.reason };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new TextEncoder().encode(`homemoni-${member.toLowerCase()}-v1`);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'HOME MONI - Tài Chính Gia Đình',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: `${member.toLowerCase()}@homemoni.local`,
          displayName: memberDisplayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, error: 'Chưa hoàn tất đăng ký sinh trắc học.' };
    }

    return {
      success: true,
      credentialId: bufferToBase64Url(credential.rawId),
      deviceLabel: getDeviceBiometricLabel(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.toLowerCase().includes('notallowed') || message.toLowerCase().includes('cancel')) {
      return {
        success: false,
        error: 'Bạn đã hủy xác nhận Face ID hoặc trình duyệt nhúng chưa cho phép WebAuthn.',
      };
    }
    return {
      success: false,
      error: 'Không thể đăng ký Face ID trên trình duyệt này. Vui lòng mở trực tiếp hoặc dùng mã Code.',
    };
  }
}

export async function verifyMemberBiometric(credentialId: string): Promise<BiometricResult> {
  const availability = await checkBiometricAvailability();
  if (!availability.supported) {
    return { success: false, error: availability.reason };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const rawIdBytes = base64UrlToUint8Array(credentialId);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: rawIdBytes.buffer as ArrayBuffer,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (!assertion) {
      return { success: false, error: 'Xác thực khuôn mặt chưa thành công.' };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Face ID không khớp hoặc đã hủy. Vui lòng nhập mã Code dự phòng.',
    };
  }
}

// --- Tùy chỉnh Hình Nền Màn Hình Khóa từ Thư Viện Thiết Bị ---

export function loadMemberWallpapers(): MemberWallpaperMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MemberWallpaperMap;
    return {
      HUSBAND: typeof parsed.HUSBAND === 'string' ? parsed.HUSBAND : undefined,
      WIFE: typeof parsed.WIFE === 'string' ? parsed.WIFE : undefined,
    };
  } catch {
    return {};
  }
}

export function saveMemberWallpaper(member: AuthMemberId, dataUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = loadMemberWallpapers();
    const next: MemberWallpaperMap = {
      ...current,
      [member]: dataUrl,
    };
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function removeMemberWallpaper(member: AuthMemberId): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadMemberWallpapers();
    delete current[member];
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

/**
 * Nén ảnh cá nhân từ thư viện thiết bị bằng Canvas (cạnh dài tối đa 1280px)
 * để đảm bảo hiển thị sắc nét và lưu trữ an toàn 0ms trong LocalStorage.
 */
export async function compressDeviceWallpaper(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh hợp lệ từ thư viện.');
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh này.'));
      el.src = imageUrl;
    });

    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    }

    ctx.drawImage(img, 0, 0, width, height);

    // Ưu tiên WebP nhẹ hơn JPEG, fallback JPEG
    const webp = canvas.toDataURL('image/webp', 0.8);
    if (webp.startsWith('data:image/webp') && webp.length < 750_000) {
      return webp;
    }
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
