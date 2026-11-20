import test from "node:test";
import assert from "node:assert/strict";
import { APP_ECOSYSTEM_REGISTRY, getUrgentSkyOneAlert } from "./appRegistry";
import { createDefaultSkyOneLoan } from "./mortgageEngine";

test("APP_ECOSYSTEM_REGISTRY exposes FINANCE, SKYONE, GOLD, and INTERIOR definitions", () => {
  assert.equal(APP_ECOSYSTEM_REGISTRY.length, 4);
  assert.deepEqual(
    APP_ECOSYSTEM_REGISTRY.map((item) => item.id),
    ["FINANCE", "SKYONE", "GOLD", "INTERIOR"]
  );
  for (const app of APP_ECOSYSTEM_REGISTRY) {
    assert.ok(app.title.length > 0);
    assert.ok(app.launcherDescription.length > 0);
    assert.ok(app.ctaLabel.length > 0);
  }
});

test("getUrgentSkyOneAlert activates only when overdue or <= 10 days before due date", () => {
  const loan = createDefaultSkyOneLoan();
  // Next unpaid period #16 is due 2026-12-10
  assert.equal(getUrgentSkyOneAlert(loan, "2026-11-29"), null); // 11 days left

  const warningAt10 = getUrgentSkyOneAlert(loan, "2026-11-30"); // 10 days left (DUE_SOON)
  assert.ok(warningAt10);
  assert.equal(warningAt10.kind, "warning");
  assert.match(warningAt10.detailLabel, /Còn 10 ngày/);

  const warningAlert = getUrgentSkyOneAlert(loan, "2026-12-03"); // 7 days left
  assert.ok(warningAlert);
  assert.equal(warningAlert.kind, "warning");
  assert.match(warningAlert.detailLabel, /Còn 7 ngày/);

  const overdueAlert = getUrgentSkyOneAlert(loan, "2026-12-12"); // past due
  assert.ok(overdueAlert);
  assert.equal(overdueAlert.kind, "danger");
  assert.match(overdueAlert.detailLabel, /quá hạn/);
});
