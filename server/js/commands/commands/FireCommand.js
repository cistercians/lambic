/**
 * FireCommand - Handles /fire command
 * 
 * Places a campfire in front of the player.
 */

const BaseCommand = require('../BaseCommand');

class FireCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'fire';
    this.description = 'Place a campfire';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    if (player.z === -3) {
      this.sendError(socket, 'You cannot start a fire here.');
      return false;
    }

    const loc = this.getLoc(player.x, player.y);
    const [c, r] = loc;
    let f = null;

    switch (player.facing) {
      case 'left': f = [c - 1, r]; break;
      case 'right': f = [c + 1, r]; break;
      case 'up': f = [c, r - 1]; break;
      case 'down': f = [c, r + 1]; break;
    }

    if (!f) return false;

    // Check if position is valid (for buildings, check layer 4)
    if ((player.z === 1 || player.z === 2) && this.getTile(4, f[0], f[1]) !== 0) {
      this.sendError(socket, 'You cannot place that there.');
      return false;
    }

    const getCoords = this.getGlobal('getCoords', (c, r) => [c * 64, r * 64]);
    const p = getCoords(f[0], f[1]);
    
    const Campfire = this.getGlobal('Campfire');
    if (Campfire) {
      Campfire({ parent: player.id, x: p[0], y: p[1], z: player.z, qty: 1 });
      return true;
    }

    return false;
  }
}

module.exports = FireCommand;
