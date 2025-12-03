/**
 * TestEventsCommand - Handles testevents command
 * 
 * Test command for event system debugging.
 */

const entityRegistry = require('../../core/EntityRegistry');

class TestEventsCommand {
  constructor() {
    this.name = 'testevents';
  }

  /**
   * Execute the testevents command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    if (!global.eventManager) {
      this.sendError(socket, 'Event system not initialized!');
      return false;
    }

    // Test combat event
    global.eventManager.createEvent({
      category: global.eventManager.categories.COMBAT,
      subject: player.id,
      subjectName: player.name,
      action: 'tested combat event',
      communication: global.eventManager.commModes.PLAYER,
      message: '<span style="color:#ff6666;">⚔️ Test combat event!</span>',
      log: '[TEST] Combat event created',
      position: { x: player.x, y: player.y, z: player.z }
    });

    // Test economic event
    global.eventManager.createEvent({
      category: global.eventManager.categories.ECONOMIC,
      subject: player.id,
      subjectName: player.name,
      action: 'tested economic event',
      quantity: 100,
      communication: global.eventManager.commModes.NONE,
      log: '[TEST] Economic event created',
      position: { x: player.x, y: player.y, z: player.z }
    });

    // Get event stats
    const stats = global.eventManager.getEventStats(60000); // Last minute
    
    this.sendMessage(socket, `✅ Event system test complete! Stats: ${stats.total} events, ${stats.combatHotspots ? stats.combatHotspots.length : 0} combat hotspots`);
    
    return true;
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

module.exports = TestEventsCommand;
