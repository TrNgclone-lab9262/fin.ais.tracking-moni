import test from "node:test";
import assert from "node:assert/strict";
import { parseAppRoute, buildAppPath, getAppDocumentTitle } from "./appRouting";

test("parseAppRoute defaults root and /launcher to LAUNCHER", () => {
  const root = parseAppRoute("/");
  assert.equal(root.app, "LAUNCHER");
  assert.equal(root.isLoginRoute, false);

  const launcher = parseAppRoute("/launcher");
  assert.equal(launcher.app, "LAUNCHER");
  assert.equal(launcher.isLoginRoute, false);

  const login = parseAppRoute("/login");
  assert.equal(login.app, "LAUNCHER");
  assert.equal(login.isLoginRoute, true);
});

test("parseAppRoute resolves /finance, /skyone, /gold, and /interior sub-app deep routes", () => {
  const fin = parseAppRoute("/finance/transactions");
  assert.equal(fin.app, "FINANCE");
  assert.equal(fin.financeTab, "transactions");

  const sky = parseAppRoute("/skyone/schedule", "?period=16");
  assert.equal(sky.app, "SKYONE");
  assert.equal(sky.skyoneTab, "SCHEDULE");
  assert.equal(sky.highlightPeriod, 16);

  const legacyCashflow = parseAppRoute("/skyone/cashflow");
  assert.equal(legacyCashflow.app, "SKYONE");
  assert.equal(legacyCashflow.skyoneTab, "SCHEDULE");

  const gold = parseAppRoute("/gold/simulator");
  assert.equal(gold.app, "GOLD");
  assert.equal(gold.goldTab, "SIMULATOR");

  const interior = parseAppRoute("/interior/boq");
  assert.equal(interior.app, "INTERIOR");
  assert.equal(interior.interiorTab, "BOQ");
});

test("buildAppPath and getAppDocumentTitle handle all 4 sub-apps", () => {
  assert.equal(buildAppPath("LAUNCHER", "overview", "OVERVIEW"), "/launcher");
  assert.equal(buildAppPath("FINANCE", "planning", "OVERVIEW"), "/finance/planning");
  assert.equal(buildAppPath("SKYONE", "overview", "SCHEDULE", 16), "/skyone/schedule?period=16");
  assert.equal(buildAppPath("GOLD", "overview", "OVERVIEW", null, "LOTS"), "/gold/lots");
  assert.equal(buildAppPath("INTERIOR", "overview", "OVERVIEW", null, "OVERVIEW", "READINESS"), "/interior/readiness");

  assert.equal(getAppDocumentTitle("LAUNCHER", "overview", "OVERVIEW"), "App Launcher · HOME MONI");
  assert.match(getAppDocumentTitle("GOLD", "overview", "OVERVIEW", "OVERVIEW"), /Vàng/i);
  assert.match(getAppDocumentTitle("INTERIOR", "overview", "OVERVIEW", "OVERVIEW", "STUDIO"), /SKYONE|3D|Nội thất/i);
});
