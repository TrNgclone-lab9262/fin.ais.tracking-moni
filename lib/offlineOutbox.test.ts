import test from "node:test";
import assert from "node:assert/strict";
import { coalesceOutboxEntries, getOutboxMutationKey, OutboxEntry } from "./offlineOutbox";
import { DEFAULT_SETTINGS } from "../constants/mockData";
import { mergeSharedSettingsWithLocal } from "./supabaseMappers";

test("coalesceOutboxEntries deduplicates updates and lets DELETE supersede UPSERT for same entity", () => {
  const tx1 = {
    id: "tx_1",
    amount: 100_000,
    date: "2026-11-14",
    type: "EXPENSE" as const,
    categoryId: "cat_expense_food",
    accountId: "acc_1",
    memberId: "HUSBAND" as const,
    scope: "FAMILY" as const,
    createdAt: "2026-11-14T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
  };

  let queue: OutboxEntry[] = [];
  queue = coalesceOutboxEntries(queue, { type: "UPSERT_TRANSACTION", payload: tx1 });
  assert.equal(queue.length, 1);

  queue = coalesceOutboxEntries(queue, {
    type: "UPSERT_TRANSACTION",
    payload: { ...tx1, amount: 250_000 },
  });
  assert.equal(queue.length, 1);
  assert.equal(
    queue[0].mutation.type === "UPSERT_TRANSACTION" ? queue[0].mutation.payload.amount : 0,
    250_000
  );

  queue = coalesceOutboxEntries(queue, { type: "DELETE_TRANSACTION", id: "tx_1" });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].mutation.type, "DELETE_TRANSACTION");
  assert.equal(getOutboxMutationKey(queue[0].mutation), "tx:tx_1");
});

test("mergeSharedSettingsWithLocal preserves device-local security & themeMode while syncing shared household names", () => {
  const local = {
    ...DEFAULT_SETTINGS,
    themeMode: "dark" as const,
    privacyMode: true,
    requireAuthOnOpen: true,
    husbandAuth: { passcodeHash: "hash_local", passcodeSalt: "salt_local" },
  };

  const merged = mergeSharedSettingsWithLocal(local, {
    themeColor: "green",
    currency: "VND",
    notificationsEnabled: false,
    husbandName: "Chồng Yêu",
    wifeName: "Vợ Yêu",
    sharedSplitRatioHusband: 60,
  });

  assert.equal(merged.husbandName, "Chồng Yêu");
  assert.equal(merged.wifeName, "Vợ Yêu");
  assert.equal(merged.sharedSplitRatioHusband, 60);
  // Bảo toàn bảo mật cục bộ của máy này
  assert.equal(merged.themeMode, "dark");
  assert.equal(merged.privacyMode, true);
  assert.equal(merged.requireAuthOnOpen, true);
  assert.equal(merged.husbandAuth?.passcodeHash, "hash_local");
});
