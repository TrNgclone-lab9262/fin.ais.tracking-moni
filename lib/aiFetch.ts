/**
 * @file aiFetch.ts
 * @description Cầu nối gọi API AI thống nhất phía Client:
 * - Tự động đính kèm header `X-Requested-With: HomeMoni-Client` (bảo vệ Same-Origin khi Offline).
 * - Tự động đính kèm `Authorization: Bearer <access_token>` khi Supabase Cloud đang đăng nhập.
 * - Tự động làm mới phiên (`refreshSession`) và thử lại 1 lần nếu nhận HTTP 401 do JWT vừa hết hạn.
 */

import { isSupabaseConfigured, supabase } from './supabaseClient';

async function readAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) return null;
    return data.session.access_token;
  } catch {
    return null;
  }
}

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'HomeMoni-Client',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function postAiJson(endpoint: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);
  const token = await readAccessToken();

  let res = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(token),
    body,
  });

  if (res.status === 401 && isSupabaseConfigured && supabase) {
    const refreshed = await refreshAccessToken();
    if (refreshed && refreshed !== token) {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: buildHeaders(refreshed),
        body,
      });
    }
  }

  return res;
}
