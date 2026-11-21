import test from "node:test";
import assert from "node:assert/strict";
import { createScenarioBDualGrowthStudio } from "./interiorFloorplan";
import {
  computeClearanceZones,
  computeSmartGuides,
  detectItemWallOverlap,
  resolveWalkthroughCollision,
  snapPositionToWalls,
} from "./interiorCadEngine";
import { evaluateErgonomicClearances } from "./interiorBoqEngine";

test("snapPositionToWalls snaps furniture flush to nearby wall within 12cm and falls back to 5cm grid when far", () => {
  const scB = createScenarioBDualGrowthStudio();
  const sofa = scB.items.find((i) => i.catalogKey === "sofa_3seat");
  assert.ok(sofa);

  // East outer wall w_east_main is at x = 3.65 (thickness 0.2 => inner face at 3.55).
  // Sofa rotated 90 deg has effW = depth = 0.85 => halfW = 0.425 => flush center = 3.55 - 0.015 - 0.425 = 3.11
  const nearWall = snapPositionToWalls(sofa, 3.04, -1.25);
  assert.equal(nearWall.snappedX, true);
  assert.equal(nearWall.snappedWallIdX, "w_east_main");
  assert.ok(Math.abs(nearWall.x - 3.11) <= 0.02);

  // Far from all walls -> falls back to 5cm grid
  const midRoom = snapPositionToWalls(sofa, 2.13, -0.37);
  assert.equal(midRoom.snappedX, false);
  assert.equal(midRoom.snappedZ, false);
  assert.equal(midRoom.x, 2.15);
  assert.equal(midRoom.z, -0.35);
});

test("computeSmartGuides returns orthogonal wall distance guides in cm", () => {
  const scB = createScenarioBDualGrowthStudio();
  const sofa = scB.items.find((i) => i.catalogKey === "sofa_3seat");
  assert.ok(sofa);

  const guides = computeSmartGuides(sofa);
  assert.equal(guides.length, 2);
  const xGuide = guides.find((g) => g.axis === "X");
  const zGuide = guides.find((g) => g.axis === "Z");
  assert.ok(xGuide && xGuide.distanceCm >= 0 && xGuide.distanceCm < 300);
  assert.ok(zGuide && zGuide.distanceCm >= 0 && zGuide.distanceCm < 300);
});

test("detectItemWallOverlap catches furniture dragged onto interior partition and flags DANGER warning", () => {
  const scB = createScenarioBDualGrowthStudio();
  const coffee = scB.items.find((i) => i.catalogKey === "coffee_table");
  assert.ok(coffee);

  // Initially clear
  assert.equal(detectItemWallOverlap(coffee), null);

  // Drag directly onto w_master_living wall (x = 0.6, z from -3.6 to -0.6)
  coffee.position = { x: 0.6, z: -1.8 };
  const hit = detectItemWallOverlap(coffee);
  assert.ok(hit);
  assert.equal(hit.wallId, "w_master_living");
  assert.ok(hit.overlapCm >= 8);

  const warnings = evaluateErgonomicClearances(scB);
  const wallDanger = warnings.find(
    (w) => w.itemId === coffee.id && w.severity === "DANGER" && w.id.startsWith("wall_overlap_")
  );
  assert.ok(wallDanger);
});

test("evaluateErgonomicClearances catches 90-degree door swing collision and Sofa-TV viewing distance warning", () => {
  const scB = createScenarioBDualGrowthStudio();

  // Move shoe cabinet right into the Main Door Lecmax 90° swing arc (hinge at x: 1.05, z: 3.52, radius 0.82)
  const shoe = scB.items.find((i) => i.catalogKey === "shoe_cabinet_tall");
  assert.ok(shoe);
  shoe.position = { x: 0.65, z: 3.05 };

  // Move sofa too close to TV console (< 175cm eye-to-screen)
  const sofa = scB.items.find((i) => i.catalogKey === "sofa_3seat");
  assert.ok(sofa);
  sofa.position = { x: 1.85, z: -1.25 };

  const warnings = evaluateErgonomicClearances(scB);
  assert.ok(
    warnings.some((w) => w.id.startsWith("door_swing_op_main_door_") && w.severity === "DANGER"),
    "Expected DANGER warning for Main Door 90° swing collision"
  );
  assert.ok(
    warnings.some((w) => w.id === "ergo_tv_too_close" && w.severity === "WARNING"),
    "Expected WARNING for Sofa-to-TV viewing distance"
  );
});

test("computeClearanceZones generates wardrobe swing and desk chair pullback overlays", () => {
  const scB = createScenarioBDualGrowthStudio();
  const zones = computeClearanceZones(scB);
  assert.ok(zones.some((z) => z.kind === "WARDROBE_SWING"));
  assert.ok(zones.some((z) => z.kind === "CHAIR_PULLBACK"));
});

test("resolveWalkthroughCollision blocks passage through solid interior wall but permits passing through doorway", () => {
  // Solid wall w_master_living at x = 0.6, thickness 0.16 (right face 0.68), z from -3.6 to -0.6
  const blocked = resolveWalkthroughCollision(1.1, -1.8, 0.55, -1.8, 0.24);
  assert.equal(blocked.collided, true);
  assert.ok(blocked.x >= 0.9, `Expected camera to stay on living side of wall, got x=${blocked.x}`);

  // Open Master doorway gap is at z = -0.6 between w_wc_corridor_top (x=-0.2) and w_master_living (x=0.6) -> center x = 0.2
  const passMasterDoor = resolveWalkthroughCollision(0.2, -0.2, 0.2, -0.6, 0.24);
  assert.equal(passMasterDoor.collided, false);
  assert.ok(Math.abs(passMasterDoor.z - -0.6) < 0.01);

  // Open Room 05 doorway gap is at x = -0.15 between w_wc_corridor_bot (z=1.4) and w_room05_corridor (z=2.35) -> center z = 1.88
  const passRoom05Door = resolveWalkthroughCollision(0.25, 1.88, -0.15, 1.88, 0.24);
  assert.equal(passRoom05Door.collided, false);
  assert.ok(Math.abs(passRoom05Door.x - -0.15) < 0.01);
});
