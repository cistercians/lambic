/**
 * BetCommand - Handles /bet command for poker
 */

const entityRegistry = require('../../core/EntityRegistry');
const pokerGameManager = require('../../games/PokerGameManager.js');

class BetCommand {
  constructor() {
    this.name = 'bet';
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
    
    const cmd = data.cmd.trim();
    const parts = cmd.split(' ');
    
    if (parts.length < 2) {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: '<i>Usage: /bet <amount></i>'
      }));
      return false;
    }
    
    const amount = parseInt(parts[1], 10);
    if (isNaN(amount) || amount < 1) {
      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: '<i>Bet amount must be a positive number.</i>'
      }));
      return false;
    }
    
    return game.handleBet(player.id, amount);
  }
}

module.exports = BetCommand;

