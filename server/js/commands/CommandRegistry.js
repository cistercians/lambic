/**
 * CommandRegistry - Central registry for all game commands
 * 
 * Provides centralized command registration and routing.
 * Commands can be registered from individual files or the legacy Commands.js.
 * 
 * Benefits:
 * - Clear command organization
 * - Easy to find and modify specific commands
 * - Commands can be in separate files for better organization
 * - Supports both new class-based and legacy function-based commands
 */

const systemRegistry = require('../core/SystemRegistry');

class CommandRegistry {
  constructor() {
    this.commands = new Map(); // command name -> handler
    this.aliases = new Map(); // alias -> command name
    this.commandMetadata = new Map(); // command name -> metadata
  }

  /**
   * Register a command
   * @param {string} name - Command name (e.g., 'build', 'move', 'attack')
   * @param {Function|object} handler - Command handler function or command class instance
   * @param {object} options - Optional configuration
   * @param {string[]} options.aliases - Command aliases
   * @param {string} options.description - Command description
   * @param {string} options.category - Command category (e.g., 'building', 'combat')
   */
  register(name, handler, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('[CommandRegistry] Command name must be a non-empty string');
    }

    if (typeof handler !== 'function' && typeof handler.execute !== 'function') {
      throw new Error('[CommandRegistry] Command handler must be a function or object with execute method');
    }

    // Normalize command name (lowercase, no leading slash)
    const normalizedName = name.toLowerCase().replace(/^\//, '');

    // Check if command already exists
    if (this.commands.has(normalizedName)) {
      console.warn(`[CommandRegistry] Command '${normalizedName}' is already registered. Overwriting...`);
    }

    // Store command handler
    this.commands.set(normalizedName, handler);

    // Store metadata
    this.commandMetadata.set(normalizedName, {
      name: normalizedName,
      description: options.description || '',
      category: options.category || 'general',
      aliases: options.aliases || []
    });

    // Register aliases
    if (options.aliases && Array.isArray(options.aliases)) {
      options.aliases.forEach(alias => {
        const normalizedAlias = alias.toLowerCase().replace(/^\//, '');
        this.aliases.set(normalizedAlias, normalizedName);
      });
    }

    if (process.env.DEBUG) {
      console.log(`[CommandRegistry] Registered command: ${normalizedName}`, 
        options.aliases ? `(aliases: ${options.aliases.join(', ')})` : '');
    }

    return true;
  }

  /**
   * Execute a command
   * @param {string} commandString - Full command string (e.g., 'build farm' or '/build farm')
   * @param {object} context - Command execution context (player, socket, world, id, overrideC, overrideR, cmd)
   * @returns {boolean} Success - true if command was found and executed
   */
  execute(commandString, context) {
    if (!commandString || typeof commandString !== 'string') {
      return false;
    }

    // Normalize command string (remove leading slash, trim)
    const normalized = commandString.trim().replace(/^\//, '');
    const parts = normalized.split(' ');
    const commandName = parts[0].toLowerCase();

    // Resolve alias if exists
    const actualCommandName = this.aliases.get(commandName) || commandName;

    // Get command handler
    const handler = this.commands.get(actualCommandName);
    if (!handler) {
      // Command not found in registry - return false to fall back to legacy
      return false;
    }

    try {
      // Execute command (supports class-based handlers with execute method)
      if (typeof handler.execute === 'function') {
        // Class-based handler: handler.execute(data) where data matches EvalCmd format
        // Pass full context as data object to match EvalCmd signature
        const data = {
          cmd: context.cmd || commandString,
          id: context.id || (context.player ? context.player.id : null),
          socket: context.socket,
          world: context.world,
          overrideC: context.overrideC,
          overrideR: context.overrideR
        };
        
        const result = handler.execute(data);
        return result !== false; // Return true unless explicitly false
      } else if (typeof handler === 'function') {
        // Legacy function handler: handler(data) where data contains cmd, id, etc.
        const data = {
          cmd: context.cmd || commandString,
          id: context.id || (context.player ? context.player.id : null),
          socket: context.socket,
          world: context.world,
          overrideC: context.overrideC,
          overrideR: context.overrideR
        };
        handler(data);
        return true;
      } else {
        console.error(`[CommandRegistry] Invalid command handler for '${actualCommandName}'`);
        return false;
      }
    } catch (error) {
      console.error(`[CommandRegistry] Error executing command '${actualCommandName}':`, error);
      if (context.socket) {
        this._sendError(context.socket, 'Command execution failed');
      }
      // Return true to indicate command was found and attempted, even if it failed
      // This prevents falling through to legacy system which would show "Invalid command"
      return true;
    }
  }

  /**
   * Check if a command is registered
   * @param {string} name - Command name
   * @returns {boolean} True if command is registered
   */
  has(name) {
    const normalizedName = name.toLowerCase().replace(/^\//, '');
    return this.commands.has(normalizedName) || this.aliases.has(normalizedName);
  }

  /**
   * Get command metadata
   * @param {string} name - Command name
   * @returns {object|null} Command metadata
   */
  getMetadata(name) {
    const normalizedName = name.toLowerCase().replace(/^\//, '');
    const actualCommandName = this.aliases.get(normalizedName) || normalizedName;
    return this.commandMetadata.get(actualCommandName) || null;
  }

  /**
   * Get all registered commands
   * @param {string} category - Optional category filter
   * @returns {Array} Array of command names or metadata objects
   */
  getAllCommands(category = null) {
    const commands = Array.from(this.commandMetadata.entries());
    
    if (category) {
      return commands
        .filter(([name, metadata]) => metadata.category === category)
        .map(([name, metadata]) => metadata);
    }
    
    return commands.map(([name, metadata]) => metadata);
  }

  /**
   * Get commands by category
   * @returns {object} Object with category -> commands mapping
   */
  getCommandsByCategory() {
    const byCategory = {};
    
    for (const [name, metadata] of this.commandMetadata.entries()) {
      const category = metadata.category || 'general';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(metadata);
    }
    
    return byCategory;
  }

  /**
   * Unregister a command
   * @param {string} name - Command name
   * @returns {boolean} True if command was unregistered
   */
  unregister(name) {
    const normalizedName = name.toLowerCase().replace(/^\//, '');
    const removed = this.commands.delete(normalizedName);
    
    if (removed) {
      this.commandMetadata.delete(normalizedName);
      
      // Remove aliases
      for (const [alias, commandName] of this.aliases.entries()) {
        if (commandName === normalizedName) {
          this.aliases.delete(alias);
        }
      }
    }
    
    return removed;
  }

  /**
   * Clear all commands (useful for testing)
   */
  clear() {
    this.commands.clear();
    this.aliases.clear();
    this.commandMetadata.clear();
  }

  /**
   * Get statistics about registered commands
   * @returns {object} Statistics
   */
  getStats() {
    const byCategory = this.getCommandsByCategory();
    return {
      totalCommands: this.commands.size,
      totalAliases: this.aliases.size,
      commandsByCategory: Object.keys(byCategory).reduce((acc, cat) => {
        acc[cat] = byCategory[cat].length;
        return acc;
      }, {})
    };
  }

  // Private helper methods

  /**
   * Fallback to legacy command system (EvalCmd from Commands.js)
   * @param {string} commandString - Command string
   * @param {object} context - Execution context
   * @returns {boolean} Success
   */
  _executeLegacyCommand(commandString, context) {
    // Try to use legacy EvalCmd if available
    if (typeof global.EvalCmd === 'function') {
      try {
        global.EvalCmd({
          cmd: commandString,
          id: context.player ? context.player.id : null,
          ...context
        });
        return true;
      } catch (error) {
        console.error('[CommandRegistry] Error in legacy command:', error);
        return false;
      }
    }
    
    // Command not found
    if (context.socket) {
      const parts = commandString.trim().replace(/^\//, '').split(' ');
      const commandName = parts[0];
      this._sendError(context.socket, `Unknown command: ${commandName}`);
    }
    
    return false;
  }

  /**
   * Send error message to socket
   * @param {object} socket - Socket object
   * @param {string} message - Error message
   */
  _sendError(socket, message) {
    if (socket && typeof socket.write === 'function') {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: `<i>Error: ${message}</i>` 
      }));
    }
  }
}

// Export singleton instance
const commandRegistry = new CommandRegistry();
module.exports = commandRegistry;
