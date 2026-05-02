const assert = require('assert');

const BuildingConstructor = require('../server/js/ai/BuildingConstructor');
const { TilemapSystem } = require('../server/js/core/TilemapSystem');

function withGlobals(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = global[key];
    global[key] = overrides[key];
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete global[key];
      } else {
        global[key] = previous[key];
      }
    }
  }
}

function fillLayer(tilemap, layer, size, value) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tilemap.setTile(layer, x, y, value);
    }
  }
}

function testCeltGarrisonCanUseHeavyForestTerrain() {
  const tilemap = new TilemapSystem(12);
  fillLayer(tilemap, 0, 12, 1);
  fillLayer(tilemap, 3, 12, 0);
  fillLayer(tilemap, 5, 12, 0);

  const searchArea = [];
  for (let y = 1; y < 8; y++) {
    for (let x = 1; x < 8; x++) {
      searchArea.push([x, y]);
    }
  }

  withGlobals({
    tileSize: 64,
    TERRAIN: { HEAVY_FOREST: 1, LIGHT_FOREST: 2, BRUSH: 3, GRASS: 7 },
    Item: { list: {} },
    Building: { list: {} },
    tilemapSystem: tilemap,
    getArea: () => searchArea,
    getCenter: (col, row) => [col * 64 + 32, row * 64 + 32],
    isWalkable: () => true
  }, () => {
    const constructor = new BuildingConstructor({
      id: 'celts',
      name: 'Celts',
      hq: [3, 3]
    });

    assert.strictEqual(constructor.canPlaceGarrison([3, 3]), true, 'expected Celt garrison placement to accept heavy forest');
  });
}

function run() {
  testCeltGarrisonCanUseHeavyForestTerrain();
  console.log('celtDefensivePlacement.test.js passed');
}

run();
