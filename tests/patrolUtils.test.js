const assert = require('assert');
const {
  clearPatrolAssignment,
  getActivePatrolBuilding,
  updatePatrolProgress
} = require('../server/js/ai/PatrolUtils');

function run() {
  const buildings = [{ id: 'forge' }, { id: 'garrison' }];
  const patrolWithAssignment = {
    currentBuildingId: 'garrison'
  };

  const stickyBuilding = getActivePatrolBuilding(patrolWithAssignment, buildings, () => 0);
  assert.strictEqual(stickyBuilding.id, 'garrison', 'expected patrol assignment to stay on the current building while it remains valid');

  const movingPatrol = { progress: null };
  let progressResult = updatePatrolProgress(movingPatrol, {
    buildingId: 'garrison',
    tile: [10, 10],
    distance: 320,
    position: { x: 0, y: 0 },
    hasPath: true
  });
  assert.strictEqual(progressResult.targetChanged, true, 'expected first patrol update to initialize progress tracking');

  for (let i = 1; i <= 120; i++) {
    progressResult = updatePatrolProgress(movingPatrol, {
      buildingId: 'garrison',
      tile: [10, 10],
      distance: 320 - (i * 4),
      position: { x: i * 4, y: 0 },
      hasPath: true
    });
  }
  assert.strictEqual(progressResult.stalled, false, 'expected moving patrol to avoid false stuck detection');
  assert.strictEqual(movingPatrol.progress.framesWithoutProgress, 0, 'expected progress counter to reset while the patrol unit is advancing');

  const stalledPatrol = { progress: null };
  updatePatrolProgress(stalledPatrol, {
    buildingId: 'forge',
    tile: [5, 5],
    distance: 256,
    position: { x: 0, y: 0 },
    hasPath: false
  });

  let stalledResult = null;
  for (let i = 0; i <= 95; i++) {
    stalledResult = updatePatrolProgress(stalledPatrol, {
      buildingId: 'forge',
      tile: [5, 5],
      distance: 256,
      position: { x: 0, y: 0 },
      hasPath: false
    });
  }
  assert.strictEqual(stalledResult.stalled, true, 'expected patrol target to be considered stalled after prolonged lack of movement');

  const patrolToClear = {
    targetTiles: {
      garrison: [4, 7]
    },
    currentBuildingId: 'garrison',
    currentTargetTile: [4, 7],
    progress: { targetKey: 'garrison:4,7' }
  };

  clearPatrolAssignment(patrolToClear);
  assert.strictEqual(patrolToClear.currentBuildingId, null, 'expected cleared patrol assignment to forget the active building');
  assert.strictEqual(patrolToClear.currentTargetTile, null, 'expected cleared patrol assignment to forget the active tile');
  assert.strictEqual(patrolToClear.progress, null, 'expected cleared patrol assignment to reset progress state');
  assert.ok(!Object.prototype.hasOwnProperty.call(patrolToClear.targetTiles, 'garrison'), 'expected cleared patrol assignment to drop the cached tile');

  console.log('patrolUtils.test.js passed');
}

run();
