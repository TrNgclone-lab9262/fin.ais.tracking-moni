import test from "node:test";
import assert from "node:assert/strict";
import { getActiveFullscreenElement, isFullscreenApiSupported } from "./useFullScreen";

test("isFullscreenApiSupported checks document compatibility and requestFullscreen availability", () => {
  assert.equal(isFullscreenApiSupported(null), false);

  const modernDoc = {
    fullscreenEnabled: true,
    documentElement: { requestFullscreen: () => Promise.resolve() },
  } as unknown as Document;
  assert.equal(isFullscreenApiSupported(modernDoc), true);

  const webkitDoc = {
    webkitFullscreenEnabled: true,
    documentElement: { webkitRequestFullscreen: () => undefined },
  } as unknown as Document;
  assert.equal(isFullscreenApiSupported(webkitDoc), true);

  const blockedDoc = {
    fullscreenEnabled: false,
    documentElement: { requestFullscreen: () => Promise.resolve() },
  } as unknown as Document;
  assert.equal(isFullscreenApiSupported(blockedDoc), false);
});

test("getActiveFullscreenElement resolves standard and vendor-prefixed fullscreenElement", () => {
  assert.equal(getActiveFullscreenElement(null), null);

  const mockEl = { tagName: "DIV" } as unknown as Element;
  const standardDoc = { fullscreenElement: mockEl } as unknown as Document;
  assert.equal(getActiveFullscreenElement(standardDoc), mockEl);

  const webkitDoc = {
    fullscreenElement: null,
    webkitFullscreenElement: mockEl,
  } as unknown as Document;
  assert.equal(getActiveFullscreenElement(webkitDoc), mockEl);

  const emptyDoc = { fullscreenElement: null } as unknown as Document;
  assert.equal(getActiveFullscreenElement(emptyDoc), null);
});
