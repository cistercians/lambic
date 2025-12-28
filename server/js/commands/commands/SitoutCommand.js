/**
 * SitoutCommand - Handles /sitout command for poker
 */

const entityRegistry = require('../../core/EntityRegistry');
const pokerGameManager = require('../../games/PokerGameManager.js');

class SitoutCommand {
  constructor() {
    this.name = 'sitout';
  }
  
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;
    
    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;
    
    const game = pokerGameManager.getPlayerGame(data.id);
    if (!game) {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: '<i>You are not in a poker game.</i>'
      }));
      return false;
    }
    
    return game.handleSitOut(player.id);
  }
}

module.exports = SitoutCommand;

