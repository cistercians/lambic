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

    // Verify player owns the ship ONLY if ship is at a dock
    // If ship is not at dock (left on shore), anyone can board it
    // Cargo ships are always public transport (no ownership check)
    if (ship.shipType !== 'cargoship') {
      const isAtDock = ship.mode === 'docked';
      if (isAtDock && (!ship.owner || ship.owner !== player.id)) {
        this.sendError(socket, 'This is not your ship.');
        return false;
      }
      // If not at dock, allow boarding (ship is abandoned/available)
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
   * @param {string} shipId - Ship ID to find (original ship ID before being stored)
   * @param {string} playerId - Player ID (to verify ownership)
   * @returns {object|null} Ship entity or null
   */
  findStoredShip(shipId, playerId) {
    const Building = this.getGlobal('Building');
    const Player = this.getGlobal('Player');
    if (!Building || !Building.list || !Player || !Player.list) return null;

    // Search all docks for the stored ship
    for (const dockId in Building.list) {
      const dock = Building.list[dockId];
      if (dock.type !== 'dock' || !dock.storedShips) continue;

      // Find ship in storedShips array
      for (let i = 0; i < dock.storedShips.length; i++) {
        const storedShip = dock.storedShips[i];
        // Cargo ships are public transport (no ownership check), but they shouldn't be stored
        // For other ships, verify ownership (use == for type coercion)
        const isOwned = storedShip.shipType === 'cargoship' || storedShip.owner == playerId;
        // Use == for shipId comparison in case of type mismatch (string vs number)
        if (String(storedShip.shipId) === String(shipId) && isOwned) {
          // Retrieve the ship from storage (spawns it adjacent to dock)
          if (typeof dock.retrieveShip === 'function') {
            const retrievedShipId = dock.retrieveShip(playerId, i);
            if (retrievedShipId) {
              // Wait a frame for ship to be created, then find it
              // Ship should now be in Player.list with the new ID
              if (Player.list && Player.list[retrievedShipId]) {
                const ship = Player.list[retrievedShipId];
                // Verify it's actually a ship
                if (ship.shipType || ship.type === 'ship') {
                  return ship;
                }
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

