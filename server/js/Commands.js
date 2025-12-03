EvalCmd = function(data){
  // Try CommandRegistry first (for extracted commands)
  if (global.commandRegistry) {
    try {
      const player = Player.list[data.id];
      if (player) {
        const context = {
          player: player,
          socket: SOCKET_LIST[data.id],
          world: data.world,
          id: data.id,
          overrideC: data.overrideC,
          overrideR: data.overrideR,
          cmd: data.cmd
        };
        
        // Try to execute via CommandRegistry
        const executed = global.commandRegistry.execute(data.cmd, context);
        if (executed) {
          return; // Command handled by registry
        }
        // If not found in registry, fall through to legacy system
      }
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
