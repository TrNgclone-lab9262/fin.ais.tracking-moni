import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hashPasscode,
  hasAnyAppPasscode,
  hasAnyAppBiometric,
  hasAnyAuthCredential,
  hasMemberBiometric,
  hasMemberPasscode,
  isQuickAuthViewProtected,
  isValidPasscodeFormat,
  verifyPasscode,
} from './authSecurity.ts';
import { DEFAULT_SETTINGS } from '../constants/mockData.ts';

test('isValidPasscodeFormat chấp nhận mã Code 4-6 chữ số và từ chối chuỗi sai', () => {
  assert.equal(isValidPasscodeFormat('1234'), true);
  assert.equal(isValidPasscodeFormat('123456'), true);
  assert.equal(isValidPasscodeFormat('123'), false);
  assert.equal(isValidPasscodeFormat('12ab'), false);
  assert.equal(isValidPasscodeFormat('1234567'), false);
});

test('hashPasscode và verifyPasscode hoạt động đúng với salt ngẫu nhiên', async () => {
  const { hash, salt } = await hashPasscode('2468');
  assert.ok(hash.length >= 16);
  assert.ok(salt.length >= 16);

  assert.equal(await verifyPasscode('2468', hash, salt), true);
  assert.equal(await verifyPasscode('2469', hash, salt), false);
  assert.equal(await verifyPasscode('', hash, salt), false);
});

test('hasMemberPasscode và hasAnyAppPasscode nhận diện đúng trạng thái cấu hình bảo mật', async () => {
  assert.equal(hasAnyAppPasscode(DEFAULT_SETTINGS), false);

  const hashed = await hashPasscode('112233');
  const configured = {
    ...DEFAULT_SETTINGS,
    wifeAuth: {
      passcodeHash: hashed.hash,
      passcodeSalt: hashed.salt,
    },
  };

  assert.equal(hasMemberPasscode(configured, 'HUSBAND'), false);
  assert.equal(hasMemberPasscode(configured, 'WIFE'), true);
  assert.equal(hasAnyAppPasscode(configured), true);
});

test('Quick Auth và Biometric helpers nhận diện độc lập từng mục nhạy cảm', () => {
  assert.equal(hasAnyAppBiometric(DEFAULT_SETTINGS), false);
  assert.equal(hasAnyAuthCredential(DEFAULT_SETTINGS), false);
  assert.equal(isQuickAuthViewProtected(DEFAULT_SETTINGS, 'accounts'), false);
  assert.equal(isQuickAuthViewProtected(DEFAULT_SETTINGS, 'debts_invest'), false);

  const bioOnlySettings = {
    ...DEFAULT_SETTINGS,
    requireAuthOnOpen: false,
    husbandAuth: {
      webauthnCredentialId: 'cred-faceid-husband',
      webauthnDeviceLabel: 'Face ID / Touch ID (iOS)',
    },
    quickAuth: {
      enabled: true,
      protectedViews: ['accounts', 'debts_invest'] as ('accounts' | 'debts_invest' | 'data_admin')[],
    },
  };

  assert.equal(hasMemberBiometric(bioOnlySettings, 'HUSBAND'), true);
  assert.equal(hasMemberBiometric(bioOnlySettings, 'WIFE'), false);
  assert.equal(hasAnyAppBiometric(bioOnlySettings), true);
  assert.equal(hasAnyAuthCredential(bioOnlySettings), true);
  assert.equal(isQuickAuthViewProtected(bioOnlySettings, 'accounts'), true);
  assert.equal(isQuickAuthViewProtected(bioOnlySettings, 'debts_invest'), true);
  assert.equal(isQuickAuthViewProtected(bioOnlySettings, 'data_admin'), false);
});
