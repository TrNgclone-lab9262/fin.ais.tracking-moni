import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_CHANGELOG, APP_VERSION, compareSemver } from './appVersion.ts';

test('compareSemver so sánh chính xác các phiên bản chuẩn và có tiền tố v', () => {
  assert.equal(compareSemver('1.4.0', '1.3.0'), 1);
  assert.equal(compareSemver('v1.3.1', '1.3.0'), 1);
  assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  assert.equal(compareSemver('1.3.0', 'v1.3.0'), 0);
  assert.equal(compareSemver('1.2.9', '1.3.0'), -1);
  assert.equal(compareSemver('1.3.0-pwa', '1.3.0'), 0);
});

test('APP_CHANGELOG khớp với APP_VERSION hiện tại và có đầy đủ điểm nổi bật', () => {
  assert.ok(APP_CHANGELOG.length >= 1);
  assert.equal(APP_CHANGELOG[0].version, APP_VERSION);
  assert.ok(APP_CHANGELOG[0].highlights.length >= 2);
});
