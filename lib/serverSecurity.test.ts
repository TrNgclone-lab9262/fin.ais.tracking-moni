import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupabaseJwtVerifier,
  evaluateAiRouteAccess,
  extractBearerToken,
  extractTrustedClientIp,
  isSameOriginRequest,
  resolveSupabaseServerConfig,
} from './serverSecurity';

test('extractTrustedClientIp trusts Express req.ip and normalizes IPv4-mapped IPv6', () => {
  assert.equal(extractTrustedClientIp({ ip: '::ffff:203.0.113.10' }), '203.0.113.10');
  assert.equal(extractTrustedClientIp({ ip: '198.51.100.7' }), '198.51.100.7');
  assert.equal(
    extractTrustedClientIp({ socket: { remoteAddress: '::ffff:127.0.0.1' } }),
    '127.0.0.1'
  );
  assert.equal(extractTrustedClientIp({}), 'unknown');
});

test('resolveSupabaseServerConfig reads SUPABASE_* and VITE_SUPABASE_* and rejects placeholders', () => {
  const unconfigured = resolveSupabaseServerConfig({
    VITE_SUPABASE_URL: 'https://your-project-id.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'your-supabase-anon-key',
  });
  assert.equal(unconfigured.configured, false);

  const configured = resolveSupabaseServerConfig({
    VITE_SUPABASE_URL: 'https://demoabc123456.supabase.co/',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_placeholder_key',
  });
  assert.equal(configured.configured, true);
  assert.equal(configured.url, 'https://demoabc123456.supabase.co');
});

test('extractBearerToken validates JWT format and rejects malformed headers', () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken('Bearer not-a-jwt'), null);
  assert.equal(extractBearerToken('Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
});

test('isSameOriginRequest requires matching origin/host and HomeMoni custom header', () => {
  assert.equal(
    isSameOriginRequest({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-requested-with': 'HomeMoni-Client',
    }),
    true
  );

  // Thiếu X-Requested-With -> chặn
  assert.equal(
    isSameOriginRequest({
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    }),
    false
  );

  // Khác Origin -> chặn
  assert.equal(
    isSameOriginRequest({
      host: 'home-moni.example.com',
      origin: 'https://evil-site.example.com',
      'x-requested-with': 'HomeMoni-Client',
    }),
    false
  );

  // Hỗ trợ proxy X-Forwarded-Host
  assert.equal(
    isSameOriginRequest({
      host: '127.0.0.1:3000',
      'x-forwarded-host': 'ais-dev-demo.asia-southeast1.run.app',
      origin: 'https://ais-dev-demo.asia-southeast1.run.app',
      'x-requested-with': 'HomeMoni-Client',
    }),
    true
  );
});

test('evaluateAiRouteAccess enforces Supabase JWT when Cloud is configured and caches verified tokens', async () => {
  let fetchCount = 0;
  const cfg = {
    configured: true,
    url: 'https://demoabc123456.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid_placeholder_key',
  };

  const verifier = createSupabaseJwtVerifier(cfg, {
    fetchImpl: (async (_url, init) => {
      fetchCount += 1;
      const auth = (init?.headers as Record<string, string>)?.Authorization || '';
      if (auth === 'Bearer aaa.bbb.valid') {
        return new Response(JSON.stringify({ id: '11111111-2222-3333-4444-555555555555' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ msg: 'Invalid token' }), { status: 401 });
    }) as typeof fetch,
  });

  // 1. Thiếu Authorization -> 401 UNAUTHORIZED
  const missing = await evaluateAiRouteAccess({}, cfg, verifier);
  assert.equal(missing.allowed, false);
  assert.equal(missing.status, 401);
  assert.equal(missing.code, 'UNAUTHORIZED');

  // 2. Token sai -> 401 UNAUTHORIZED
  const invalid = await evaluateAiRouteAccess(
    { authorization: 'Bearer aaa.bbb.invalid' },
    cfg,
    verifier
  );
  assert.equal(invalid.allowed, false);
  assert.equal(invalid.status, 401);

  // 3. Token đúng -> cho phép và cache kết quả ở lần gọi thứ 2
  const ok1 = await evaluateAiRouteAccess({ authorization: 'Bearer aaa.bbb.valid' }, cfg, verifier);
  assert.equal(ok1.allowed, true);
  assert.equal(ok1.userId, '11111111-2222-3333-4444-555555555555');

  const countBeforeCacheHit = fetchCount;
  const ok2 = await evaluateAiRouteAccess({ authorization: 'Bearer aaa.bbb.valid' }, cfg, verifier);
  assert.equal(ok2.allowed, true);
  assert.equal(fetchCount, countBeforeCacheHit);
});

test('evaluateAiRouteAccess falls back to Same-Origin + X-Requested-With when offline/unconfigured', async () => {
  const offlineCfg = { configured: false, url: '', anonKey: '' };
  const dummyVerifier = async () => ({ valid: false });

  const blocked = await evaluateAiRouteAccess(
    { host: 'localhost:3000', origin: 'https://attacker.test' },
    offlineCfg,
    dummyVerifier
  );
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.code, 'FORBIDDEN');

  const allowed = await evaluateAiRouteAccess(
    {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-requested-with': 'HomeMoni-Client',
    },
    offlineCfg,
    dummyVerifier
  );
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.mode, 'OFFLINE_SAME_ORIGIN');
});
