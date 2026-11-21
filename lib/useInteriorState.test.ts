import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INTERIOR_VIEW_STATE,
  InteriorPersistedViewState,
  parseInteriorViewState,
  serializeInteriorViewState,
} from "./useInteriorState";
import { checkFullscreenApiSupport, getDocumentFullscreenElement } from "./useFullScreen";
import { InteriorDesignScenarioSchema } from "./validations";
import { createDefaultInteriorStudio } from "./interiorFloorplan";

describe("useInteriorState persistence helpers", () => {
  it("serializes and parses full view & camera state round-trip", () => {
    const input: InteriorPersistedViewState = {
      version: 1,
      viewportMode: "SPLIT",
      showMepLayer: true,
      interactionMode: "ARCHITECTURE",
      camerasByScenario: {
        sc_pa_b: {
          position: [1.4567, 1.6004, 2.1234],
          target: [-1.2, 0.95, 3.1],
          preset: "ROOM_05_STUDIO",
          navMode: "WALKTHROUGH",
          timeOfDay: "EVENING_20",
          fov: 54,
          autoCutaway: false,
        },
      },
      updatedAt: "2026-11-21T07:00:00.000Z",
    };

    const raw = serializeInteriorViewState(input);
    const parsed = parseInteriorViewState(raw);

    assert.equal(parsed.viewportMode, "SPLIT");
    assert.equal(parsed.showMepLayer, true);
    assert.equal(parsed.interactionMode, "ARCHITECTURE");
    assert.equal(parsed.updatedAt, "2026-11-21T07:00:00.000Z");

    const cam = parsed.camerasByScenario.sc_pa_b;
    assert.ok(cam, "Expected sc_pa_b camera snapshot to be parsed");
    assert.deepEqual(cam.position, [1.457, 1.6, 2.123]);
    assert.deepEqual(cam.target, [-1.2, 0.95, 3.1]);
    assert.equal(cam.preset, "ROOM_05_STUDIO");
    assert.equal(cam.navMode, "WALKTHROUGH");
    assert.equal(cam.timeOfDay, "EVENING_20");
    assert.equal(cam.fov, 54);
    assert.equal(cam.autoCutaway, false);
  });

  it("falls back safely on null, malformed JSON, or invalid camera coordinates", () => {
    assert.deepEqual(parseInteriorViewState(null), DEFAULT_INTERIOR_VIEW_STATE);
    assert.deepEqual(parseInteriorViewState("{not valid json"), DEFAULT_INTERIOR_VIEW_STATE);

    const partialCorrupt = JSON.stringify({
      version: 1,
      viewportMode: "INVALID_MODE",
      showMepLayer: 1,
      interactionMode: "UNKNOWN",
      camerasByScenario: {
        bad_cam: { position: [1, "NaN", 3], target: [0, 0, 0] },
        good_cam: { position: [2, 3, 4], target: [0, 1, 0], fov: 999 },
      },
    });

    const parsed = parseInteriorViewState(partialCorrupt);
    assert.equal(parsed.viewportMode, "3D");
    assert.equal(parsed.showMepLayer, true);
    assert.equal(parsed.interactionMode, "FURNITURE");
    assert.equal(parsed.camerasByScenario.bad_cam, undefined);
    assert.ok(parsed.camerasByScenario.good_cam);
    assert.equal(parsed.camerasByScenario.good_cam.fov, 80);
  });
});

describe("InteriorDesignScenarioSchema with isHidden & lastCameraView", () => {
  it("validates scenarios with isHidden furniture and lastCameraView snapshot", () => {
    const studio = createDefaultInteriorStudio();
    const scenario = {
      ...studio.scenarios[0],
      items: studio.scenarios[0].items.map((item, idx) =>
        idx === 0 ? { ...item, isHidden: true } : item
      ),
      lastCameraView: {
        position: [2.1, 1.55, 1.45] as [number, number, number],
        target: [2.25, 1.12, -3.1] as [number, number, number],
        preset: "LIVING_BALCONY" as const,
        navMode: "ORBIT" as const,
        timeOfDay: "AFTERNOON_1630" as const,
        fov: 44,
        autoCutaway: true,
      },
    };

    const result = InteriorDesignScenarioSchema.safeParse(scenario);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.items[0].isHidden, true);
      assert.equal(result.data.lastCameraView?.preset, "LIVING_BALCONY");
    }
  });

  it("stays backwards-compatible with legacy scenarios omitting isHidden and lastCameraView", () => {
    const studio = createDefaultInteriorStudio();
    const result = InteriorDesignScenarioSchema.safeParse(studio.scenarios[0]);
    assert.equal(result.success, true);
  });
});

describe("useFullScreen SSR safety helpers", () => {
  it("handles server-side execution without document safely", () => {
    assert.equal(checkFullscreenApiSupport(), false);
    assert.equal(getDocumentFullscreenElement(), null);
  });
});
