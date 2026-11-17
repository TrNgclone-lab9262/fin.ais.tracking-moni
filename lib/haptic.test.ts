import test from "node:test";
import assert from "node:assert/strict";
import { HAPTIC_PATTERNS, isHapticSupported, triggerHaptic } from "./haptic";

test("isHapticSupported nhận diện đúng thiết bị hỗ trợ và không hỗ trợ navigator.vibrate", () => {
  assert.equal(isHapticSupported(undefined), false);
  assert.equal(isHapticSupported({}), false);
  assert.equal(
    isHapticSupported({
      vibrate: () => true,
    }),
    true
  );
});

test("triggerHaptic gọi navigator.vibrate đúng nhịp preset và an toàn khi vắng mặt hoặc lỗi", () => {
  const calls: Array<number | number[]> = [];
  const mockNav = {
    vibrate: (pattern: number | number[]) => {
      calls.push(pattern);
      return true;
    },
  };

  assert.equal(triggerHaptic("light", mockNav), true);
  assert.equal(triggerHaptic("success", mockNav), true);
  assert.equal(triggerHaptic("warning", mockNav), true);
  assert.deepEqual(calls, [
    HAPTIC_PATTERNS.light,
    HAPTIC_PATTERNS.success,
    HAPTIC_PATTERNS.warning,
  ]);

  assert.equal(triggerHaptic("success", {}), false);
  assert.equal(
    triggerHaptic("error", {
      vibrate: () => {
        throw new Error("Blocked by browser");
      },
    }),
    false
  );
});
