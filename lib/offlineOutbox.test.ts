import test from "node:test";
import assert from "node:assert/strict";
import {
  CloudMutation,
  MAX_OUTBOX_RETRIES,
  coalesceOutboxEntries,
  describeOutboxMutation,
  flushOutboxEntriesPure,
  removeOutboxEntryByKey,
  resetAllFailedOutboxEntries,
  resetOutboxEntryForRetry,
} from "./offlineOutbox";
import { Transaction } from "@/types/finance";

function makeTx(id: string, amount: number): Transaction {
  return {
    id,
    amount,
    date: "2026-11-22",
    type: "EXPENSE",
    categoryId: "cat_expense_food",
    accountId: "acc_husband_bidv",
    memberId: "HUSBAND",
    scope: "FAMILY",
    note: `Giao dịch ${id}`,
    createdAt: "2026-11-22T00:00:00Z",
    updatedAt: "2026-11-22T00:00:00Z",
  };
}

test("coalesceOutboxEntries deduplicates updates for the same entity and resets retry status", () => {
  const m1: CloudMutation = { type: "UPSERT_TRANSACTION", payload: makeTx("tx-1", 100_000) };
  const m2: CloudMutation = { type: "UPSERT_TRANSACTION", payload: makeTx("tx-2", 200_000) };
  const m1Updated: CloudMutation = {
    type: "UPSERT_TRANSACTION",
    payload: makeTx("tx-1", 150_000),
  };

  let queue = coalesceOutboxEntries([], m1, "2026-11-22T01:00:00Z");
  queue = coalesceOutboxEntries(queue, m2, "2026-11-22T01:01:00Z");
  queue = coalesceOutboxEntries(queue, m1Updated, "2026-11-22T01:02:00Z");

  assert.equal(queue.length, 2);
  const tx1 = queue.find((e) => e.key === "tx:tx-1");
  assert.ok(tx1);
  assert.equal(tx1.status, "PENDING");
  assert.equal(tx1.retryCount, 0);
  assert.equal(tx1.mutation.type, "UPSERT_TRANSACTION");
  if (tx1.mutation.type === "UPSERT_TRANSACTION") {
    assert.equal(tx1.mutation.payload.amount, 150_000);
  }
  assert.ok(describeOutboxMutation(tx1.mutation).includes("150"));
});

test("flushOutboxEntriesPure never blocks valid entries behind a failing mutation and dead-letters after MAX_OUTBOX_RETRIES", async () => {
  const badMutation: CloudMutation = {
    type: "UPSERT_TRANSACTION",
    payload: makeTx("tx-bad", 50_000),
  };
  const goodMutation: CloudMutation = {
    type: "UPSERT_TRANSACTION",
    payload: makeTx("tx-good", 90_000),
  };

  let entries = coalesceOutboxEntries([], badMutation, "2026-11-22T01:00:00Z");
  entries = coalesceOutboxEntries(entries, goodMutation, "2026-11-22T01:01:00Z");

  const executedIds: string[] = [];
  const executor = async (mutation: CloudMutation) => {
    if (mutation.type === "UPSERT_TRANSACTION") {
      executedIds.push(mutation.payload.id);
      if (mutation.payload.id === "tx-bad") {
        throw new Error("RLS policy violation");
      }
    }
  };

  // Attempt 1: tx-bad fails (retry 1, still PENDING), tx-good SUCCEEDS without being blocked!
  const r1 = await flushOutboxEntriesPure(entries, executor, {
    maxRetries: MAX_OUTBOX_RETRIES,
    nowIso: "2026-11-22T01:05:00Z",
  });
  assert.equal(r1.succeeded, 1);
  assert.equal(r1.retried, 1);
  assert.equal(r1.deadLettered, 0);
  assert.equal(r1.remainingEntries.length, 1);
  assert.equal(r1.remainingEntries[0].status, "PENDING");
  assert.equal(r1.remainingEntries[0].retryCount, 1);
  assert.deepEqual(executedIds, ["tx-bad", "tx-good"]);

  // Attempt 2: retryCount -> 2 (PENDING)
  const r2 = await flushOutboxEntriesPure(r1.remainingEntries, executor, {
    maxRetries: MAX_OUTBOX_RETRIES,
  });
  assert.equal(r2.remainingEntries[0].retryCount, 2);
  assert.equal(r2.remainingEntries[0].status, "PENDING");

  // Attempt 3: retryCount -> 3 -> transitions to FAILED (Dead-Letter)
  const r3 = await flushOutboxEntriesPure(r2.remainingEntries, executor, {
    maxRetries: MAX_OUTBOX_RETRIES,
  });
  assert.equal(r3.deadLettered, 1);
  assert.equal(r3.remainingEntries[0].status, "FAILED");
  assert.equal(r3.remainingEntries[0].retryCount, MAX_OUTBOX_RETRIES);
  assert.equal(r3.remainingEntries[0].lastError, "RLS policy violation");

  // Attempt 4: FAILED entry is skipped automatically so it doesn't spam server
  const callsBefore = executedIds.length;
  const r4 = await flushOutboxEntriesPure(r3.remainingEntries, executor);
  assert.equal(executedIds.length, callsBefore);
  assert.equal(r4.remainingEntries.length, 1);
  assert.equal(r4.remainingEntries[0].status, "FAILED");
});

test("Manual recovery helpers reset single/all FAILED entries and discard by key", () => {
  const m1: CloudMutation = { type: "DELETE_TRANSACTION", id: "tx-a" };
  const m2: CloudMutation = { type: "DELETE_TRANSACTION", id: "tx-b" };
  let entries = coalesceOutboxEntries([], m1);
  entries = coalesceOutboxEntries(entries, m2);
  const failedEntries = entries.map((e) => ({
    ...e,
    status: "FAILED" as const,
    retryCount: 3,
    lastError: "Timeout",
  }));

  const resetOne = resetOutboxEntryForRetry(failedEntries, "tx:tx-a");
  assert.equal(resetOne.find((e) => e.key === "tx:tx-a")?.status, "PENDING");
  assert.equal(resetOne.find((e) => e.key === "tx:tx-a")?.retryCount, 0);
  assert.equal(resetOne.find((e) => e.key === "tx:tx-b")?.status, "FAILED");

  const resetAll = resetAllFailedOutboxEntries(failedEntries);
  assert.equal(resetAll.every((e) => e.status === "PENDING" && e.retryCount === 0), true);

  const afterRemove = removeOutboxEntryByKey(failedEntries, "tx:tx-a");
  assert.equal(afterRemove.length, 1);
  assert.equal(afterRemove[0].key, "tx:tx-b");
});
