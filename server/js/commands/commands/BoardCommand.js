/**
 * BoardCommand - Handles /board command
 * 
 * Boards a nearby owned ship.
 */

const BaseCommand = require('../BaseCommand');
const entityRegistry = require('../../core/EntityRegistry');

class BoardCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'board';
    this.description = 'Board a nearby ship';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    const tileSize = 64;
    let nearbyShip = null;

    // Find nearest owned ship within 1.5 tiles
    const players = entityRegistry.getEntities('players') || [];
    for (const ship of players) {
      if (ship.shipType && ship.owner === player.id && 
          (ship.mode === 'anchored' || ship.mode === 'docked')) {
        const distToShip = Math.sqrt(
          Math.pow(player.x - ship.x, 2) + Math.pow(player.y - ship.y, 2)
        );
        if (distToShip <= tileSize * 1.5) {
          nearbyShip = ship;
          break;
        }
      }
    }

    if (!nearbyShip) {
      this.sendError(socket, 'No owned ship nearby. Stand within 1 tile of your ship.');
      return false;
    }

    if (typeof nearbyShip.boardPassenger === 'function') {
      const boarded = nearbyShip.boardPassenger(player.id);

      if (boarded) {
        nearbyShip.spawned = true;
        if (nearbyShip.mode === 'docked' || nearbyShip.mode === 'anchored') {
          nearbyShip.mode = 'anchored';
          nearbyShip.name = 'Fishing Ship ⚓';
        }
        return true;
      } else {
        this.sendError(socket, 'Failed to board ship.');
        return false;
      }
    }

    this.sendError(socket, 'Ship boarding system not available.');
    return false;
  }
}

module.exports = BoardCommand;
