/**
 * TeleportCommand - Handles /tport command
 * 
 * Admin/debug command for teleporting to coordinates.
 */

const BaseCommand = require('../BaseCommand');

class TeleportCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'tport';
    this.usage = '/tport z,col,row';
    this.description = 'Teleport to coordinates';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    const args = this.parseArgs(data.cmd);
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /tport z,col,row (e.g., /tport 0,100,200)');
      return false;
    }

    try {
      const coords = args[0].split(',');
      
      if (coords.length !== 3) {
        this.sendError(socket, 'Invalid format. Use: /tport z,col,row');
        return false;
      }

      const z = Number(coords[0]);
      const col = Number(coords[1]);
      const row = Number(coords[2]);

      if (isNaN(z) || isNaN(col) || isNaN(row)) {
        this.sendError(socket, 'Invalid coordinates');
        return false;
      }

      const coordsPx = this.getCenter(col, row);

      player.z = z;
      player.x = coordsPx[0];
      player.y = coordsPx[1];
      player.path = null;
      player.pathCount = 0;

      this.sendSuccess(socket, `Teleported to [${col}, ${row}] z=${z}`);
      return true;
    } catch (error) {
      this.sendError(socket, 'Invalid format. Use: /tport z,col,row');
      return false;
    }
  }
}

module.exports = TeleportCommand;
