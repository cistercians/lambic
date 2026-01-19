/**
 * loadCommands - Auto-loads and registers commands from the commands directory
 * 
 * This allows commands to be extracted into individual files while maintaining
 * backward compatibility with the legacy Commands.js system.
 */

const commandRegistry = require('./CommandRegistry');
const fs = require('fs');
const path = require('path');

/**
 * Load and register all commands from the commands directory
 */
function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  
  // Check if commands directory exists
  if (!fs.existsSync(commandsDir)) {
    if (process.env.DEBUG) {
      console.log('[loadCommands] Commands directory does not exist, skipping auto-load');
    }
    return;
  }

  // Read all .js files in commands directory (both direct and subdirectories)
  let files = [];
  
  // Load from commands/commands/ subdirectory first (new extracted commands)
  const subCommandsDir = path.join(commandsDir, 'commands');
  if (fs.existsSync(subCommandsDir)) {
    const subFiles = fs.readdirSync(subCommandsDir).filter(file => 
      file.endsWith('.js') && file !== 'index.js'
    ).map(file => path.join('commands', file));
    files = files.concat(subFiles);
  }
  
  // Also check direct commands directory for any commands there
  const directFiles = fs.readdirSync(commandsDir).filter(file => 
    file.endsWith('.js') && file !== 'index.js' && file !== 'loadCommands.js'
  );
  files = files.concat(directFiles);

  let loadedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    try {
      const CommandClass = require(path.join(commandsDir, file));
      
      // Check if it's a valid command class
      if (typeof CommandClass === 'function' || (CommandClass && typeof CommandClass.prototype.execute === 'function')) {
        const command = new CommandClass();
        const commandName = command.name || file.replace('.js', '').toLowerCase();
        
        // Register command
        commandRegistry.register(commandName, command, {
          description: command.description || '',
          category: command.category || 'general',
          aliases: command.aliases || []
        });
        
        loadedCount++;
        
        if (process.env.DEBUG) {
          console.log(`[loadCommands] Loaded command: ${commandName} from ${file}`);
        }
      } else {
        console.warn(`[loadCommands] ${file} does not export a valid command class`);
      }
    } catch (error) {
      console.error(`[loadCommands] Error loading command from ${file}:`, error);
      errorCount++;
    }
  }

}

/**
 * Register a legacy command handler (for backward compatibility)
 * @param {Function} handler - Legacy command handler function
 */
function registerLegacyHandler(handler) {
  if (typeof handler !== 'function') {
    console.warn('[loadCommands] Legacy handler must be a function');
    return;
  }

  // Register as a catch-all handler for commands not found in registry
  global.EvalCmd = handler;
  
  if (process.env.DEBUG) {
    console.log('[loadCommands] Legacy command handler registered');
  }
}

module.exports = {
  loadCommands,
  registerLegacyHandler
};
