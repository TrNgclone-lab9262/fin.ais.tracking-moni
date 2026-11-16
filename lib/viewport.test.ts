import test from "node:test";
import assert from "node:assert/strict";
import { classifyViewport, computeResponsiveXAxisInterval } from "./viewport";

test("classifyViewport phân loại chính xác Mobile (<640), Tablet (640-1023) và Desktop (>=1024)", () => {
  const mobile = classifyViewport(375, 812);
  assert.equal(mobile.isMobile, true);
  assert.equal(mobile.isTablet, false);
  assert.equal(mobile.isCompact, true);
  assert.equal(mobile.isDesktop, false);
  assert.equal(mobile.breakpoint, "mobile");

  const tablet = classifyViewport(768, 1024);
  assert.equal(tablet.isMobile, false);
  assert.equal(tablet.isTablet, true);
  assert.equal(tablet.isCompact, true);
  assert.equal(tablet.isDesktop, false);
  assert.equal(tablet.breakpoint, "tablet");

  const desktop = classifyViewport(1024, 768);
  assert.equal(desktop.isMobile, false);
  assert.equal(desktop.isTablet, false);
  assert.equal(desktop.isCompact, false);
  assert.equal(desktop.isDesktop, true);
  assert.equal(desktop.breakpoint, "desktop");

  const wide = classifyViewport(1440, 900);
  assert.equal(wide.isDesktop, true);
  assert.equal(wide.breakpoint, "wide");
});

test("computeResponsiveXAxisInterval ẩn bớt ticks khi isMobile=true và giữ preserveStartEnd trên desktop", () => {
  assert.equal(computeResponsiveXAxisInterval(30, false, 5), "preserveStartEnd");
  assert.equal(computeResponsiveXAxisInterval(4, true, 5), 0);
  assert.equal(computeResponsiveXAxisInterval(30, true, 5), 5);
  assert.equal(computeResponsiveXAxisInterval(12, true, 4), 2);
});
