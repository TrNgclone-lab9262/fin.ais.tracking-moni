/**
 * @file serverSecurity.ts
 * @description Các hàm bảo mật thuần túy (Node-testable) cho tầng Express Backend:
 * - Trích xuất IP khách đáng tin cậy qua req.ip (chống giả mạo X-Forwarded-For).
 * - Xác thực Supabase JWT server-side (không cần SERVICE_ROLE_KEY) kèm cache băm SHA-256 ngắn hạn.
 * - Khóa Same-Origin + Header tùy chỉnh khi vận hành ở chế độ Offline / chưa cấu hình Supabase.
 */

import crypto from 'node:crypto';
import type { ApiErrorCode } from './apiSchemas';

export interface SupabaseServerAuthConfig {
  configured: boolean;
  url: string;
  anonKey: string;
}

export interface RequestIpLike {
  ip?: string;
  socket?: { remoteAddress?: string };
}

export interface RequestHeadersLike {
  authorization?: string | string[];
  origin?: string | string[];
  referer?: string | string[];
  host?: string | string[];
  'x-forwarded-host'?: string | string[];
  'x-requested-with'?: string | string[];
}

export interface AiAccessDecision {
  allowed: boolean;
  mode: 'SUPABASE_JWT' | 'OFFLINE_SAME_ORIGIN';
  userId?: string;
  status?: 401 | 403;
  code?: Extract<ApiErrorCode, 'UNAUTHORIZED' | 'FORBIDDEN'>;
  message?: string;
}

const ALLOWED_CUSTOM_HEADERS = new Set(['homemoni-client', 'xmlhttprequest']);

function readSingleHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return (value[0] || '').trim();
  }
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Trích xuất IP khách hàng đáng tin cậy dựa trên `req.ip` (sau khi Express bật `trust proxy: 1`).
 * Tuyệt đối không tin cậy chuỗi `x-forwarded-for` đầu tiên do client tự chèn.
 */
export function extractTrustedClientIp(req: RequestIpLike): string {
  const raw = (req.ip || req.socket?.remoteAddress || 'unknown').trim();
  if (!raw) return 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

/**
 * Đọc cấu hình Supabase ở server từ biến môi trường (hỗ trợ cả SUPABASE_* và VITE_SUPABASE_*).
 */
export function resolveSupabaseServerConfig(
  env: Record<string, string | undefined> = process.env
): SupabaseServerAuthConfig {
  const rawUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const rawAnonKey = (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();

  const hasValidUrl =
    rawUrl.startsWith('https://') &&
    !rawUrl.includes('your-project-id') &&
    rawUrl.length > 15;
  const hasValidKey =
    rawAnonKey.length > 20 && !rawAnonKey.includes('your-supabase-anon-key');

  return {
    configured: hasValidUrl && hasValidKey,
    url: hasValidUrl ? rawUrl : '',
    anonKey: hasValidKey ? rawAnonKey : '',
  };
}

/**
 * Tách token từ header `Authorization: Bearer <jwt>`.
 */
export function extractBearerToken(authHeader: string | string[] | undefined): string | null {
  const raw = readSingleHeader(authHeader);
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/i);
  return match ? match[1] : null;
}

function extractHostFromUrl(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Kiểm tra yêu cầu cùng nguồn (Same-Origin) + header tùy chỉnh chống gọi lén cross-site
 * khi ứng dụng chạy ở chế độ Offline / chưa cấu hình Supabase.
 */
export function isSameOriginRequest(headers: RequestHeadersLike): boolean {
  const xRequestedWith = readSingleHeader(headers['x-requested-with']).toLowerCase();
  if (!ALLOWED_CUSTOM_HEADERS.has(xRequestedWith)) {
    return false;
  }

  const forwardedHost = readSingleHeader(headers['x-forwarded-host'])
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  const hostHeader = readSingleHeader(headers.host).toLowerCase();
  const expectedHosts = new Set<string>();
  if (forwardedHost) expectedHosts.add(forwardedHost);
  if (hostHeader) expectedHosts.add(hostHeader);

  if (expectedHosts.size === 0) {
    return false;
  }

  const origin = readSingleHeader(headers.origin);
  if (origin) {
    const originHost = extractHostFromUrl(origin);
    return Boolean(originHost && expectedHosts.has(originHost));
  }

  const referer = readSingleHeader(headers.referer);
  if (referer) {
    const refererHost = extractHostFromUrl(referer);
    return Boolean(refererHost && expectedHosts.has(refererHost));
  }

  return false;
}

export interface JwtVerificationResult {
  valid: boolean;
  userId?: string;
}

export type SupabaseJwtVerifier = (token: string) => Promise<JwtVerificationResult>;

/**
 * Tạo bộ xác thực Supabase JWT gọi trực tiếp endpoint `/auth/v1/user` của Supabase Auth.
 * Dùng cache ngắn hạn (60 giây, tối đa 500 phiên) lưu bằng khóa SHA-256 (không lưu JWT gốc).
 */
export function createSupabaseJwtVerifier(
  config: SupabaseServerAuthConfig,
  options?: {
    fetchImpl?: typeof fetch;
    ttlMs?: number;
    maxEntries?: number;
    timeoutMs?: number;
  }
): SupabaseJwtVerifier {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const ttlMs = options?.ttlMs ?? 60_000;
  const maxEntries = options?.maxEntries ?? 500;
  const timeoutMs = options?.timeoutMs ?? 5_000;

  const cache = new Map<string, { userId: string; expiresAt: number }>();

  return async (token: string): Promise<JwtVerificationResult> => {
    if (!config.configured || !token) {
      return { valid: false };
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    const cached = cache.get(tokenHash);
    if (cached && cached.expiresAt > now) {
      return { valid: true, userId: cached.userId };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${config.url}/auth/v1/user`, {
        method: 'GET',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        cache.delete(tokenHash);
        return { valid: false };
      }

      const data = (await res.json().catch(() => null)) as { id?: unknown } | null;
      if (!data || typeof data.id !== 'string' || data.id.length < 8) {
        return { valid: false };
      }

      if (cache.size >= maxEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey) cache.delete(oldestKey);
      }
      cache.set(tokenHash, { userId: data.id, expiresAt: now + ttlMs });
      return { valid: true, userId: data.id };
    } catch {
      return { valid: false };
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Đánh giá quyền truy cập tuyến `/api/ai/*`:
 * - Nếu server đã cấu hình Cloud Supabase: BẮT BUỘC có Supabase JWT hợp lệ (`Authorization: Bearer`).
 * - Nếu chạy Offline / chưa cấu hình Supabase: BẮT BUỘC khớp Same-Origin + header `X-Requested-With`.
 */
export async function evaluateAiRouteAccess(
  headers: RequestHeadersLike,
  supabaseConfig: SupabaseServerAuthConfig,
  verifyJwt: SupabaseJwtVerifier
): Promise<AiAccessDecision> {
  if (supabaseConfig.configured) {
    const token = extractBearerToken(headers.authorization);
    if (!token) {
      return {
        allowed: false,
        mode: 'SUPABASE_JWT',
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Vui lòng đăng nhập tài khoản Cloud để sử dụng tính năng AI.',
      };
    }

    const verified = await verifyJwt(token);
    if (!verified.valid || !verified.userId) {
      return {
        allowed: false,
        mode: 'SUPABASE_JWT',
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Phiên đăng nhập Cloud đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
      };
    }

    return {
      allowed: true,
      mode: 'SUPABASE_JWT',
      userId: verified.userId,
    };
  }

  if (!isSameOriginRequest(headers)) {
    return {
      allowed: false,
      mode: 'OFFLINE_SAME_ORIGIN',
      status: 403,
      code: 'FORBIDDEN',
      message: 'Yêu cầu truy cập API AI không hợp lệ (chỉ chấp nhận từ ứng dụng HOME MONI).',
    };
  }

  return {
    allowed: true,
    mode: 'OFFLINE_SAME_ORIGIN',
  };
}
