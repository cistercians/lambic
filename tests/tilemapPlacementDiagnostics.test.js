const assert = require('assert');

const { TilemapSystem } = require('../server/js/core/TilemapSystem');

function fillLayer(tilemap, layer, size, value) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tilemap.setTile(layer, x, y, value);
    }
  }
}

function setupGlobals(tilemap, searchArea) {
  global.tileSize = 64;
  global.Item = { list: {} };
  global.getArea = () => searchArea;
  global.getCenter = (col, row) => [col * 64 + 32, row * 64 + 32];
  global.getDistance = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  };
  global.isWalkable = () => true;
  return tilemap;
}

function testDetectsOverlapSaturation() {
  const tilemap = setupGlobals(new TilemapSystem(4), [[1, 1]]);
  fillLayer(tilemap, 0, 4, 7);
  fillLayer(tilemap, 3, 4, 1);

  const diagnostics = tilemap.diagnoseBuildingPlacement('frankhut', [1, 1], 0);

  assert.strictEqual(diagnostics.validSpots, 0, 'expected no valid hut spots when all candidate tiles overlap buildings');
  assert.strictEqual(diagnostics.dominantFailure, 'building_overlap', 'expected overlap to be reported as dominant failure');
  assert.strictEqual(diagnostics.isSaturated, true, 'expected overlap-only failure to classify as saturation-like');
}

function testDetectsValidPlacement() {
  const tilemap = setupGlobals(new TilemapSystem(4), [[1, 1]]);
  fillLayer(tilemap, 0, 4, 7);
  fillLayer(tilemap, 3, 4, 0);
  fillLayer(tilemap, 5, 4, 0);

  const diagnostics = tilemap.diagnoseBuildingPlacement('frankhut', [1, 1], 0);

  assert.strictEqual(diagnostics.validSpots, 1, 'expected an open grass plot to be valid for hut placement');
  assert.strictEqual(diagnostics.dominantFailure, null, 'expected no dominant failure when placement succeeds');
  assert.ok(diagnostics.builderAccess, 'expected valid hut placement diagnostics to include builder access metadata');
  assert.ok(diagnostics.builderAccess.accessiblePlotTiles.length > 0, 'expected valid hut placement to expose walkable plot tiles');
  assert.ok(diagnostics.builderAccess.approachTiles.length > 0, 'expected valid hut placement to expose approach tiles');
}

function testDetectsMissingBuilderAccess() {
  const tilemap = setupGlobals(new TilemapSystem(5), [[1, 1]]);
  fillLayer(tilemap, 0, 5, 7);
  fillLayer(tilemap, 3, 5, 0);
  fillLayer(tilemap, 5, 5, 0);

  const plotKeys = new Set(['1,1', '2,1', '1,0', '2,0']);
  global.isWalkable = (z, x, y) => plotKeys.has(`${x},${y}`);

  const diagnostics = tilemap.diagnoseBuildingPlacement('frankhut', [1, 1], 0);

  assert.strictEqual(diagnostics.validSpots, 0, 'expected hut placement to fail when builders cannot approach the footprint');
  assert.strictEqual(diagnostics.dominantFailure, 'no_builder_access', 'expected missing builder access to be reported');
}

function run() {
  testDetectsOverlapSaturation();
  testDetectsValidPlacement();
  testDetectsMissingBuilderAccess();
  console.log('tilemapPlacementDiagnostics.test.js passed');
}

run();
