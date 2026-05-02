const assert = require('assert');

const { selectResidentialHomeTiles } = require('../server/js/Build');

function testExcludesHutDoorAndInteriorExitTile() {
  const building = {
    plot: [
      [10, 10],
      [11, 10],
      [10, 11],
      [11, 11]
    ],
    entrance: [11, 10]
  };

  const homeTiles = selectResidentialHomeTiles(building, 2);

  assert.deepStrictEqual(
    homeTiles,
    [[10, 10], [10, 11]],
    'expected hut residents to use non-exit interior tiles first'
  );
}

function testFallsBackWithoutUsingDoorTile() {
  const building = {
    plot: [
      [20, 20],
      [21, 20],
      [21, 21]
    ],
    entrance: [21, 20]
  };

  const homeTiles = selectResidentialHomeTiles(building, 2);

  assert.deepStrictEqual(
    homeTiles,
    [[20, 20], [21, 21]],
    'expected selector to preserve alternate interior tiles before ever considering the door tile'
  );
}

function run() {
  testExcludesHutDoorAndInteriorExitTile();
  testFallsBackWithoutUsingDoorTile();
  console.log('buildHomeTiles.test.js passed');
}

run();
