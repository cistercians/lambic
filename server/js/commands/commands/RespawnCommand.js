/**
 * RespawnCommand - Handles /respawn command
 * 
 * Respawns a ghost player at home or random location.
 */

const BaseCommand = require('../BaseCommand');

class RespawnCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'respawn';
    this.description = 'Respawn from ghost state';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    if (!this.isGhost(player)) {
      this.sendError(socket, 'You are not a ghost');
      return false;
    }

    // Send ghost mode deactivate message to client
    this.send(socket, { msg: 'ghostMode', active: false });

    // Respawn at home if player has one
    if (player.home) {
      const homeCoords = this.getCenter(player.home.loc[0], player.home.loc[1]);
      
      if (typeof player.respawnFromGhost === 'function') {
        player.respawnFromGhost(
          { x: homeCoords[0], y: homeCoords[1], z: player.home.z },
          true
        );
        this.sendSuccess(socket, 'Respawned at home');
        return true;
      }
    } else {
      // No home set - respawn at random spawn
      const randomSpawnO = this.getGlobal('randomSpawnO', () => [0, 0]);
      const spawn = randomSpawnO();
      
      if (typeof player.respawnFromGhost === 'function') {
        player.respawnFromGhost({ x: spawn[0], y: spawn[1], z: 0 }, true);
        this.sendWarning(socket, 'Respawned at random location (no home set)');
        return true;
      }
    }

    this.sendError(socket, 'Respawn system not available.');
    return false;
  }
}

module.exports = RespawnCommand;
