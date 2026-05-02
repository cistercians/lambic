function samePatrolBuildingId(left, right) {
  return String(left) === String(right);
}

function buildPatrolTargetKey(buildingId, tile) {
  if (buildingId === undefined || buildingId === null || !Array.isArray(tile) || tile.length !== 2) {
    return null;
  }
  return `${buildingId}:${tile[0]},${tile[1]}`;
}

function getActivePatrolBuilding(patrol, buildingsInTerritory, randomFn = Math.random) {
  if (!patrol || !Array.isArray(buildingsInTerritory) || buildingsInTerritory.length === 0) {
    return null;
  }

  if (patrol.currentBuildingId !== undefined && patrol.currentBuildingId !== null) {
    for (let i = 0; i < buildingsInTerritory.length; i++) {
      if (samePatrolBuildingId(buildingsInTerritory[i].id, patrol.currentBuildingId)) {
        return buildingsInTerritory[i];
      }
    }
  }

  const randomIndex = Math.floor(randomFn() * buildingsInTerritory.length);
  return buildingsInTerritory[randomIndex] || buildingsInTerritory[0] || null;
}

function clearPatrolAssignment(patrol, options = {}) {
  if (!patrol) return;

  const keepCachedTile = options.keepCachedTile === true;
  if (!keepCachedTile && patrol.targetTiles && patrol.currentBuildingId !== undefined && patrol.currentBuildingId !== null) {
    delete patrol.targetTiles[patrol.currentBuildingId];
  }

  patrol.currentBuildingId = null;
  patrol.currentTargetTile = null;
  patrol.progress = null;
}

function updatePatrolProgress(patrol, info, options = {}) {
  if (!patrol || !info || !Array.isArray(info.tile) || info.tile.length !== 2) {
    return { stalled: false, targetChanged: false, framesWithoutProgress: 0 };
  }

  const threshold = options.stuckThreshold || 90;
  const minimumMovement = options.minimumMovement || 4;
  const minimumDistanceImprovement = options.minimumDistanceImprovement || 4;
  const position = info.position || { x: 0, y: 0 };
  const targetKey = buildPatrolTargetKey(info.buildingId, info.tile);

  if (!patrol.progress || patrol.progress.targetKey !== targetKey) {
    patrol.progress = {
      targetKey,
      lastDistance: typeof info.distance === 'number' ? info.distance : Infinity,
      lastX: position.x,
      lastY: position.y,
      framesWithoutProgress: 0
    };
    return { stalled: false, targetChanged: true, framesWithoutProgress: 0 };
  }

  const movedDistance = Math.hypot(position.x - patrol.progress.lastX, position.y - patrol.progress.lastY);
  const previousDistance = patrol.progress.lastDistance;
  const currentDistance = typeof info.distance === 'number' ? info.distance : previousDistance;
  const distanceImprovement = previousDistance - currentDistance;
  const hasPath = info.hasPath !== false;
  const madeProgress = distanceImprovement >= minimumDistanceImprovement || (hasPath && movedDistance >= minimumMovement);

  patrol.progress.framesWithoutProgress = madeProgress
    ? 0
    : patrol.progress.framesWithoutProgress + 1;
  patrol.progress.lastDistance = currentDistance;
  patrol.progress.lastX = position.x;
  patrol.progress.lastY = position.y;

  return {
    stalled: patrol.progress.framesWithoutProgress > threshold,
    targetChanged: false,
    framesWithoutProgress: patrol.progress.framesWithoutProgress
  };
}

module.exports = {
  clearPatrolAssignment,
  getActivePatrolBuilding,
  updatePatrolProgress
};
