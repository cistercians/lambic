EvalCmd = function(data){
  // Try CommandRegistry first (for extracted commands)
  if (global.commandRegistry) {
    try {
      const player = (global.Player && global.Player.list && data && data.id)
        ? global.Player.list[data.id]
        : null;
      const socket = (global.SOCKET_LIST && data && data.id)
        ? global.SOCKET_LIST[data.id]
        : (data && data.socket ? data.socket : null);
      const context = {
        player: player,
        socket: socket,
        world: data && data.world,
        id: data && data.id,
        overrideC: data && data.overrideC,
        overrideR: data && data.overrideR,
        cmd: data && data.cmd
      };
      
      // Guard: registry should not be empty in normal operation
      if (global.commandRegistry && typeof global.commandRegistry.getStats === 'function') {
        const stats = global.commandRegistry.getStats();
        if (stats && stats.totalCommands === 0) {
          if (socket && typeof socket.write === 'function') {
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: '<i>Error: Command registry not initialized. Please restart the server.</i>'
            }));
          }
          return;
        }
      }

      // Try to execute via CommandRegistry (even if player wasn't found in Player.list)
      const executed = global.commandRegistry.execute(data.cmd, context);
      if (executed) {
        return; // Command handled by registry
      }
      // If not found in registry, fall through to legacy system
    } catch (error) {
      console.error('[EvalCmd] Error in CommandRegistry:', error);
      // Fall through to legacy system
    }
  }

  // Legacy command system (fallback for non-extracted commands)
  if(Player.list[data.id]){
    var socket = SOCKET_LIST[data.id];
    var player = Player.list[data.id];
    var world = data.world;
    var loc = getLoc(player.x,player.y);
    var z = player.z;
    // Allow overriding coordinates for GUI building placement
    var c = data.overrideC !== undefined ? data.overrideC : loc[0];
    var r = data.overrideR !== undefined ? data.overrideR : loc[1];

    // All commands have been extracted to individual command files
    // Legacy code removed - handled by CommandRegistry
    // If command not found in registry, show error
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>Invalid command.</i>'}));
  }
}
