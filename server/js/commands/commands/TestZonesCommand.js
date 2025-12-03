/**
 * TestZonesCommand - Handles testzones command
 * 
 * Test command for zone system debugging.
 */

const entityRegistry = require('../../core/EntityRegistry');

class TestZonesCommand {
  constructor() {
    this.name = 'testzones';
  }

  /**
   * Execute the testzones command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    if (!global.zoneManager) {
      this.sendError(socket, 'Zone system not initialized!');
      return false;
    }

    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const stats = global.zoneManager.getStats();
    const currentTile = getLoc(player.x, player.y);
    const currentZone = global.zoneManager.getZoneAt(currentTile);

    let message = `<span style="color:#66ff66;">🗺️ Zone System Stats:<br/>`;
    message += `Total Zones: ${stats.totalZones}<br/>`;
    message += `Geographic: ${stats.geographicZones}<br/>`;
    message += `Faction Territories: ${stats.factionZones}<br/>`;
    message += `Outposts: ${stats.outpostZones}<br/>`;
    message += `Players in Zones: ${stats.playersInZones}<br/>`;
    message += `Indexed Tiles: ${stats.indexedTiles}<br/>`;

    if (currentZone) {
      message += `<br/>📍 Current Zone: <b>${currentZone.name}</b><br/>`;
      message += `Type: ${currentZone.type}<br/>`;
      message += `Size: ${currentZone.size} tiles</span>`;
    } else {
      message += `<br/>📍 Current Zone: <i>None</i></span>`;
    }

    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: message
    }));

    // Test nearby zones
    const nearbyZones = global.zoneManager.getZonesNear(currentTile, 5);
    if (nearbyZones.length > 0) {
      let nearbyMessage = `<span style="color:#66ff66;">🔍 Nearby Zones (within 5 tiles):<br/>`;
      nearbyZones.forEach(zone => {
        nearbyMessage += `• ${zone.name} (${zone.type})<br/>`;
      });
      nearbyMessage += `</span>`;

      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: nearbyMessage
      }));
    }

    return true;
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: `<span style="color:#ff6666;">❌ ${message}</span>`
    }));
  }
}

module.exports = TestZonesCommand;
