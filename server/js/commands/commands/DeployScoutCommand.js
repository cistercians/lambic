/**
 * DeployScoutCommand - Handles deployscout command
 * 
 * Deploys a test scouting party for debugging.
 */

const entityRegistry = require('../../core/EntityRegistry');

class DeployScoutCommand {
  constructor() {
    this.name = 'deployscout';
  }

  /**
   * Execute the deployscout command
   * @param {object} data - Command data { cmd, id, args }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    if (!player.house || !player.house.ai) {
      this.sendError(socket, 'No faction AI available!');
      return false;
    }

    const resourceType = (data.args && data.args[0]) || 'stone';
    const ai = player.house.ai;
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const currentTile = getLoc(player.x, player.y);
    const currentZone = global.zoneManager ? global.zoneManager.getZoneAt(currentTile) : null;

    if (!currentZone) {
      this.sendError(socket, 'Not in a zone!');
      return false;
    }

    if (!global.zoneManager) {
      this.sendError(socket, 'Zone manager not available!');
      return false;
    }

    const adjacentZones = global.zoneManager.getAdjacentZones(currentZone.id);
    
    if (!ai.knowledge || !ai.knowledge.findZonesWithResource) {
      this.sendError(socket, 'AI knowledge system not available!');
      return false;
    }

    const suitableZones = ai.knowledge.findZonesWithResource(resourceType, adjacentZones);

    if (suitableZones.length === 0) {
      this.sendError(socket, `No suitable zones found for ${resourceType}!`);
      return false;
    }

    const targetZone = suitableZones[0].zone;
    
    if (!ai.deployScoutingParty || typeof ai.deployScoutingParty !== 'function') {
      this.sendError(socket, 'Scouting party deployment not available!');
      return false;
    }

    const party = ai.deployScoutingParty(targetZone, resourceType);

    if (party) {
      this.sendMessage(socket, `🚩 Deployed scouting party to ${targetZone.name} for ${resourceType}!`);
      return true;
    } else {
      this.sendError(socket, 'Failed to deploy scouting party!');
      return false;
    }
  }

  sendMessage(socket, message) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: `<span style="color:#66ff66;">${message}</span>`
    }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: `<span style="color:#ff6666;">❌ ${message}</span>`
    }));
  }
}

module.exports = DeployScoutCommand;
