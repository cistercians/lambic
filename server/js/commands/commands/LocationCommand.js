/**
 * LocationCommand - Handles /loc and /coords commands
 * 
 * Shows player's current location and tile information.
 */

const BaseCommand = require('../BaseCommand');

class LocationCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'loc';
    this.aliases = ['coords', 'location'];
    this.description = 'Shows your current location';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    const loc = this.getLoc(player.x, player.y, player);
    const tile = this.getTile(player.z, loc[0], loc[1], player);

    const message = `Location: [${loc[0]}, ${loc[1]}] Z=${player.z}, Tile=${tile !== null ? tile : 'unknown'}, Coords: (${Math.floor(player.x)}, ${Math.floor(player.y)})`;
    
    this.sendMessage(socket, message);
    return true;
  }
}

module.exports = LocationCommand;
