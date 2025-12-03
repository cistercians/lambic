/**
 * GodModeCommand - Handles /godmode command
 * 
 * Enables/disables spectator camera mode.
 */

const BaseCommand = require('../BaseCommand');
const entityRegistry = require('../../core/EntityRegistry');

class GodModeCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'godmode';
    this.description = 'Toggle spectator camera mode';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    if (player.godMode) {
      return this.exitGodMode(player, socket);
    } else {
      return this.enterGodMode(player, socket);
    }
  }

  /**
   * Exit god mode
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  exitGodMode(player, socket) {
    player.godMode = false;
    player.x = player.godModeReturnPos.x;
    player.y = player.godModeReturnPos.y;
    player.z = player.godModeReturnPos.z;
    player.godModeReturnPos = null;

    // Restore normal HP if it was set to 0
    if (player.hp <= 0) {
      player.hp = player.hpMax;
    }

    this.send(socket, { msg: 'godMode', active: false });
    this.sendMessage(socket, 'God mode disabled');

    return true;
  }

  /**
   * Enter god mode
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  enterGodMode(player, socket) {
    player.godMode = true;
    player.godModeReturnPos = {
      x: player.x,
      y: player.y,
      z: player.z,
      hp: player.hp
    };

    // End all combat involving this player
    if (global.simpleCombat && typeof global.simpleCombat.endCombat === 'function') {
      global.simpleCombat.endCombat(player);
    }

    // Clear combat target
    if (player.combat) {
      player.combat.target = null;
    }

    // Clear all NPCs targeting this player
    const players = entityRegistry.getEntities('players') || [];
    for (const npc of players) {
      if (npc && npc.combat && npc.combat.target === player.id) {
        npc.combat.target = null;
        npc.action = null;
      }
    }

    // Move player to unreachable coordinates
    player.x = -10000;
    player.y = -10000;
    player.z = 100; // Unreachable z-layer

    this.send(socket, {
      msg: 'godMode',
      active: true,
      cameraX: player.godModeReturnPos.x,
      cameraY: player.godModeReturnPos.y,
      cameraZ: player.godModeReturnPos.z,
      factionHQs: global.factionHQs || []
    });
    this.sendMessage(socket, 'God mode enabled - WASD to move camera, arrows for z-layer/factions');

    return true;
  }
}

module.exports = GodModeCommand;
