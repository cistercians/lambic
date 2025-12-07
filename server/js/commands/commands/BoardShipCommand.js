/**
 * BoardShipCommand - Handles boardship <shipId> command
 * 
 * Boards a ship by ID. Can handle both active ships and stored ships.
 * Used by the dock UI to board ships.
 */

const BaseCommand = require('../BaseCommand');
const entityRegistry = require('../../core/EntityRegistry');

class BoardShipCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'boardship';
    this.description = 'Board a ship by ID';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    const args = this.parseArgs(data.cmd);
    if (args.length === 0) {
      this.sendError(socket, 'Usage: boardship <shipId>');
      return false;
    }

    const shipId = args[0];
    let ship = null;

    // First, try to find ship in active Player.list
    const Player = this.getGlobal('Player');
    if (Player && Player.list && Player.list[shipId]) {
      ship = Player.list[shipId];
      
      // Verify it's actually a ship
      if (!ship.shipType && ship.type !== 'ship') {
        this.sendError(socket, 'Invalid ship ID.');
        return false;
      }
    } else {
      // Ship not active - check if it's stored at a dock
      ship = this.findStoredShip(shipId, player.id);
      
      if (!ship) {
        this.sendError(socket, 'Ship not found. It may be at a different dock or no longer exists.');
        return false;
      }
    }

    // Verify player owns the ship (cargo ships are public transport, no ownership check)
    if (ship.shipType !== 'cargoship') {
      if (!ship.owner || ship.owner !== player.id) {
        this.sendError(socket, 'This is not your ship.');
        return false;
      }
    }

    // Board the ship
    if (typeof ship.boardPassenger === 'function') {
      const boarded = ship.boardPassenger(player.id);
      
      if (boarded) {
        // Update ship state if needed
        if (ship.mode === 'docked' || ship.mode === 'anchored') {
          ship.mode = 'anchored';
          if (ship.shipType === 'fishingship') {
            ship.name = 'Fishing Ship ⚓';
          }
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

  /**
   * Find a stored ship by ID across all docks
   * @param {string} shipId - Ship ID to find
   * @param {string} playerId - Player ID (to verify ownership)
   * @returns {object|null} Ship entity or null
   */
  findStoredShip(shipId, playerId) {
    const Building = this.getGlobal('Building');
    if (!Building || !Building.list) return null;

    // Search all docks for the stored ship
    for (const dockId in Building.list) {
      const dock = Building.list[dockId];
      if (dock.type !== 'dock' || !dock.storedShips) continue;

      // Find ship in storedShips array
      for (let i = 0; i < dock.storedShips.length; i++) {
        const storedShip = dock.storedShips[i];
        // Cargo ships are public transport (no ownership check), but they shouldn't be stored
        // For other ships, verify ownership
        const isOwned = storedShip.shipType === 'cargoship' || storedShip.owner === playerId;
        if (storedShip.shipId === shipId && isOwned) {
          // Retrieve the ship from storage
          if (typeof dock.retrieveShip === 'function') {
            const retrievedShipId = dock.retrieveShip(playerId, i);
            if (retrievedShipId) {
              const Player = this.getGlobal('Player');
              if (Player && Player.list && Player.list[retrievedShipId]) {
                return Player.list[retrievedShipId];
              }
            }
          }
          return null;
        }
      }
    }

    return null;
  }
}

module.exports = BoardShipCommand;

