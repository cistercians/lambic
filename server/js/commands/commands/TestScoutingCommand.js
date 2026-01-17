/**
 * TestScoutingCommand - Handles testscouting command
 * 
 * Test command for scouting system debugging.
 */

const entityRegistry = require('../../core/EntityRegistry');

class TestScoutingCommand {
  constructor() {
    this.name = 'testscouting';
  }

  /**
   * Execute the testscouting command
   * @param {object} data - Command data { cmd, id }
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

    const ai = player.house.ai;
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const currentTile = getLoc(player.x, player.y, player);
    const currentZone = global.zoneManager ? global.zoneManager.getZoneAt(currentTile) : null;

    let message = `<span style="color:#66ff66;">🚩 Scouting System Test:<br/>`;
    message += `Faction: ${player.house.name}<br/>`;
    message += `Active Scouting Parties: ${ai.activeScoutingParties ? ai.activeScoutingParties.length : 0}<br/>`;
    message += `Active Attack Forces: ${ai.activeAttackForces ? ai.activeAttackForces.length : 0}<br/>`;

    if (ai.activeScoutingParties && ai.activeScoutingParties.length > 0) {
      message += `<br/>📋 Active Scouting Parties:<br/>`;
      ai.activeScoutingParties.forEach((party, index) => {
        const status = party.getStatus ? party.getStatus() : { leader: 'Unknown', targetZone: 'Unknown', status: 'Unknown', idleTimer: 0 };
        message += `${index + 1}. ${status.leader} → ${status.targetZone}<br/>`;
        message += `   Status: ${status.status}, Timer: ${status.idleTimer}<br/>`;
      });
    }

    if (currentZone && global.zoneManager) {
      const adjacentZones = global.zoneManager.getAdjacentZones(currentZone.id);
      message += `<br/>🗺️ Adjacent Zones: ${adjacentZones.length}<br/>`;

      // Test resource gap detection
      const resourceGaps = [];
      if (ai.knowledge && ai.knowledge.identifyResourceGap) {
        ['stone', 'wood', 'grain', 'iron'].forEach(resource => {
          if (ai.knowledge.identifyResourceGap(resource)) {
            resourceGaps.push(resource);
          }
        });
      }

      if (resourceGaps.length > 0) {
        message += `⚠️ Resource Gaps: ${resourceGaps.join(', ')}<br/>`;

        // Test scouting party deployment for first gap
        const testResource = resourceGaps[0];
        if (ai.knowledge && ai.knowledge.findZonesWithResource) {
          const suitableZones = ai.knowledge.findZonesWithResource(testResource, adjacentZones);

          if (suitableZones.length > 0) {
            message += `🎯 Suitable zones for ${testResource}: ${suitableZones.length}<br/>`;
            message += `Best: ${suitableZones[0].zone.name} (density: ${suitableZones[0].density})<br/>`;
            message += `<br/>💡 Use <b>/deployscout ${testResource}</b> to deploy test party</span>`;
          } else {
            message += `❌ No suitable zones found for ${testResource}</span>`;
          }
        }
      } else {
        message += `✅ No resource gaps detected</span>`;
      }
    } else {
      message += `<br/>❌ No current zone or zone manager</span>`;
    }

    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: message
    }));

    return true;
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: `<span style="color:#ff6666;">❌ ${message}</span>`
    }));
  }
}

module.exports = TestScoutingCommand;
