// Follow Behavior System
// Makes backup units follow and mirror the leader's actions
const movementSystem = require('../core/MovementSystem');

function getCombatTargetId(entity) {
  if (!entity) return null;
  if (global.simpleCombat && typeof global.simpleCombat.getCombatTargetId === 'function') {
    return global.simpleCombat.getCombatTargetId(entity);
  }
  return (entity.combatState && entity.combatState.target) ||
    (entity.combat && entity.combat.target) ||
    null;
}

function setCombatTargetId(entity, targetId) {
  if (!entity) return;
  if (global.simpleCombat && typeof global.simpleCombat.setCombatTargetId === 'function') {
    global.simpleCombat.setCombatTargetId(entity, targetId);
    return;
  }
  if (!entity.combat) entity.combat = {};
  entity.combat.target = targetId || null;
  if (entity.combatState) {
    entity.combatState.target = targetId || null;
  }
}

function clearCombatTarget(entity) {
  if (!entity) return;
  if (global.simpleCombat && typeof global.simpleCombat.clearCombatTarget === 'function') {
    global.simpleCombat.clearCombatTarget(entity);
    return;
  }
  if (entity.combatState) {
    entity.combatState.target = null;
  }
  if (entity.combat) {
    entity.combat.target = null;
  }
}

class FollowBehavior {
  constructor(follower, leader) {
    this.follower = follower;
    this.leader = leader;
    this.maxDistance = 5; // Maximum distance to maintain from leader
    this.followDistance = 3; // Preferred follow distance
    this.lastLeaderAction = null;
    this.lastLeaderTarget = null;
  }

  // Update follower behavior
  update() {
    if (!this.follower || this.follower.toRemove || !this.leader || this.leader.toRemove) {
      return;
    }

    const distance = this.getDistance(
      [this.follower.x, this.follower.y],
      [this.leader.x, this.leader.y]
    );

    // If too far from leader, move closer
    if (distance > this.maxDistance) {
      this.moveTowardLeader();
    }

    // Mirror leader's actions
    this.mirrorLeaderAction();

    // Update tracking variables
    this.lastLeaderAction = this.leader.action;
    this.lastLeaderTarget = getCombatTargetId(this.leader);
  }

  // Move follower toward leader
  moveTowardLeader() {
    const leaderPos = [this.leader.x, this.leader.y];
    const followerPos = [this.follower.x, this.follower.y];

    // Calculate direction to leader
    const dx = leaderPos[0] - followerPos[0];
    const dy = leaderPos[1] - followerPos[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalize direction
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Move to follow distance from leader
      const targetX = leaderPos[0] - (dirX * this.followDistance);
      const targetY = leaderPos[1] - (dirY * this.followDistance);

      const tileSize = global.tileSize || 64;
      const targetCol = Math.floor(targetX / tileSize);
      const targetRow = Math.floor(targetY / tileSize);
      const targetZ = this.leader.z || this.follower.z || 0;

      movementSystem.applyMoveIntent(this.follower, {
        z: targetZ,
        target: [targetCol, targetRow],
        reason: 'follow',
        sourceAction: this.follower.action || 'follow'
      });
    }
  }

  // Mirror the leader's action
  mirrorLeaderAction() {
    const currentLeaderAction = this.leader.action;
    const currentLeaderTarget = getCombatTargetId(this.leader);

    // If leader's action changed, update follower
    if (currentLeaderAction !== this.lastLeaderAction) {
      this.follower.action = currentLeaderAction;
    }

    // Handle specific actions
    switch (currentLeaderAction) {
      case 'combat':
        this.handleCombatMirror(currentLeaderTarget);
        break;
      case 'retreat':
        this.handleRetreatMirror();
        break;
      case 'idle':
        this.handleIdleMirror();
        break;
      default:
        // For other actions, just follow
        break;
    }
  }

  // Handle combat mirroring
  handleCombatMirror(leaderTarget) {
    if (!leaderTarget) return;

    // If leader has a new target, attack the same target
    if (leaderTarget !== this.lastLeaderTarget) {
      setCombatTargetId(this.follower, leaderTarget);
      this.follower.action = 'combat';
    }

    // If follower doesn't have a target but leader does, attack leader's target
    if (!getCombatTargetId(this.follower)) {
      setCombatTargetId(this.follower, leaderTarget);
      this.follower.action = 'combat';
    }
  }

  // Handle retreat mirroring
  handleRetreatMirror() {
    // Set retreat target to same as leader
    this.follower.retreatTarget = this.leader.retreatTarget;
    this.follower.action = 'retreat';

    // Clear combat targets
    clearCombatTarget(this.follower);
  }

  // Handle idle mirroring
  handleIdleMirror() {
    // If leader is idle and we're close enough, also go idle
    const distance = this.getDistance(
      [this.follower.x, this.follower.y],
      [this.leader.x, this.leader.y]
    );

    if (distance <= this.followDistance) {
      this.follower.action = 'idle';
    }
  }

  // Check if follower should retreat (if leader is retreating)
  shouldRetreat() {
    return this.leader && this.leader.action === 'retreat';
  }

  // Get distance between two points
  getDistance(point1, point2) {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Clean up the follow behavior
  cleanup() {
    this.follower = null;
    this.leader = null;
  }

  // Get status for debugging
  getStatus() {
    if (!this.follower || !this.leader) return null;

    const distance = this.getDistance(
      [this.follower.x, this.follower.y],
      [this.leader.x, this.leader.y]
    );

    return {
      follower: this.follower.name,
      leader: this.leader.name,
      distance: distance.toFixed(2),
      followerAction: this.follower.action,
      leaderAction: this.leader.action,
      maxDistance: this.maxDistance,
      followDistance: this.followDistance
    };
  }
}

module.exports = FollowBehavior;
