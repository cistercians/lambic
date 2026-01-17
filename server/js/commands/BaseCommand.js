/**
 * BaseCommand - Base class for all game commands
 * 
 * Provides common functionality shared across all commands:
 * - Player lookup via EntityRegistry
 * - Socket retrieval
 * - Message sending helpers
 * - Common validation
 * 
 * Usage:
 *   class MyCommand extends BaseCommand {
 *     constructor() {
 *       super();
 *       this.name = 'mycommand';
 *     }
 *     
 *     execute(data) {
 *       const { player, socket } = this.getContext(data);
 *       if (!player || !socket) return false;
 *       
 *       this.sendMessage(socket, 'Hello!');
 *       return true;
 *     }
 *   }
 */

const entityRegistry = require('../core/EntityRegistry');

class BaseCommand {
  constructor() {
    this.name = 'base';
    this.aliases = [];
    this.description = '';
    this.usage = '';
  }

  /**
   * Get command context (player and socket)
   * @param {object} data - Command data { id, socket, cmd }
   * @returns {object} { player, socket } or { player: null, socket: null }
   */
  getContext(data) {
    const player = this.getPlayer(data);
    const socket = this.getSocket(data);
    return { player, socket };
  }

  /**
   * Get player entity from command data
   * @param {object} data - Command data
   * @returns {object|null} Player entity or null
   */
  getPlayer(data) {
    if (!data || !data.id) return null;
    return entityRegistry.getEntity('players', data.id);
  }

  /**
   * Get socket from command data
   * @param {object} data - Command data
   * @returns {object|null} Socket or null
   */
  getSocket(data) {
    if (!data) return null;
    // First try data.socket (passed directly)
    if (data.socket) return data.socket;
    // Fall back to global socket list
    if (global.SOCKET_LIST && data.id) {
      return global.SOCKET_LIST[data.id] || null;
    }
    return null;
  }

  /**
   * Validate that player and socket exist
   * @param {object} data - Command data
   * @returns {boolean} True if valid
   */
  validateContext(data) {
    const { player, socket } = this.getContext(data);
    return !!(player && socket);
  }

  /**
   * Send a message to the player's chat
   * @param {object} socket - Socket connection
   * @param {string} message - Message to send (can include HTML)
   */
  sendMessage(socket, message) {
    if (!socket || typeof socket.write !== 'function') return;
    socket.write(JSON.stringify({ 
      msg: 'addToChat', 
      message: `<i>${message}</i>` 
    }));
  }

  /**
   * Send an error message to the player's chat
   * @param {object} socket - Socket connection
   * @param {string} message - Error message
   */
  sendError(socket, message) {
    if (!socket || typeof socket.write !== 'function') return;
    socket.write(JSON.stringify({ 
      msg: 'addToChat', 
      message: `<i style="color:#ff6666;">Error: ${message}</i>` 
    }));
  }

  /**
   * Send a success message to the player's chat
   * @param {object} socket - Socket connection
   * @param {string} message - Success message
   */
  sendSuccess(socket, message) {
    if (!socket || typeof socket.write !== 'function') return;
    socket.write(JSON.stringify({ 
      msg: 'addToChat', 
      message: `<i style="color:#66ff66;">${message}</i>` 
    }));
  }

  /**
   * Send a warning message to the player's chat
   * @param {object} socket - Socket connection
   * @param {string} message - Warning message
   */
  sendWarning(socket, message) {
    if (!socket || typeof socket.write !== 'function') return;
    socket.write(JSON.stringify({ 
      msg: 'addToChat', 
      message: `<i style="color:#ffaa66;">${message}</i>` 
    }));
  }

  /**
   * Send raw data to socket
   * @param {object} socket - Socket connection
   * @param {object} data - Data object to send
   */
  send(socket, data) {
    if (!socket || typeof socket.write !== 'function') return;
    socket.write(JSON.stringify(data));
  }

  /**
   * Parse command arguments
   * @param {string} cmd - Full command string
   * @returns {string[]} Array of arguments (excluding command name)
   */
  parseArgs(cmd) {
    if (!cmd) return [];
    const parts = cmd.trim().split(/\s+/);
    return parts.slice(1); // Remove command name
  }

  /**
   * Get a global function with fallback
   * @param {string} name - Function name
   * @param {Function} fallback - Fallback function
   * @returns {Function} Global function or fallback
   */
  getGlobal(name, fallback = () => null) {
    return global[name] || fallback;
  }

  /**
   * Get tile location from pixel coordinates
   * @param {number} x - Pixel X
   * @param {number} y - Pixel Y
   * @returns {number[]} [col, row]
   */
  getLoc(x, y, entity) {
    const getLoc = this.getGlobal('getLoc', (x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    return getLoc(x, y, entity);
  }

  /**
   * Get center of tile in pixels
   * @param {number} col - Tile column
   * @param {number} row - Tile row
   * @returns {number[]} [x, y] center coordinates
   */
  getCenter(col, row) {
    const getCenter = this.getGlobal('getCenter', (c, r) => [c * 64 + 32, r * 64 + 32]);
    return getCenter(col, row);
  }

  /**
   * Get tile value at position
   * @param {number} z - Z-level
   * @param {number} col - Column
   * @param {number} row - Row
   * @returns {number} Tile value
   */
  getTile(z, col, row, entity) {
    const getTile = this.getGlobal('getTile', () => 0);
    return getTile(z, col, row, entity);
  }

  /**
   * Check if player is in combat
   * @param {object} player - Player entity
   * @returns {boolean} True if in combat
   */
  isInCombat(player) {
    return player && player.mode === 'combat';
  }

  /**
   * Check if player is a ghost
   * @param {object} player - Player entity
   * @returns {boolean} True if ghost
   */
  isGhost(player) {
    return player && player.ghost === true;
  }

  /**
   * Format item name for display (capitalize, add spaces)
   * @param {string} name - Item name (e.g., 'huntingknife')
   * @returns {string} Formatted name (e.g., 'Hunting Knife')
   */
  formatItemName(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1');
  }

  /**
   * Execute the command (override in subclass)
   * @param {object} data - Command data
   * @returns {boolean} Success
   */
  execute(data) {
    throw new Error('BaseCommand.execute() must be overridden');
  }
}

module.exports = BaseCommand;

