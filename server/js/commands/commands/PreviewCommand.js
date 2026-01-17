/**
 * PreviewCommand - Handles /preview [building] command
 * 
 * Shows building placement preview with validation.
 */

const systemRegistry = require('../../core/SystemRegistry');
const entityRegistry = require('../../core/EntityRegistry');

class PreviewCommand {
  constructor() {
    this.name = 'preview';
  }

  /**
   * Execute the preview command
   * @param {object} data - Command data { cmd, id, world, overrideC, overrideR }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Extract building type from command
    const cmdParts = data.cmd.split(' ');
    if (cmdParts.length < 2) {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<i>Usage: /preview [building type]</i>' 
      }));
      return false;
    }

    const buildingType = cmdParts.slice(1).join(' ');
    const z = player.z;
    
    // Get location (with override support for GUI building placement)
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const loc = getLoc(player.x, player.y, player);
    const c = data.overrideC !== undefined ? data.overrideC : loc[0];
    const r = data.overrideR !== undefined ? data.overrideR : loc[1];

    // Check if building preview system is available
    const buildingPreview = systemRegistry.get('buildingPreview') || global.buildingPreview;
    if (!buildingPreview || typeof buildingPreview.getBuildingDefinition !== 'function') {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<i>Building preview system not available.</i>' 
      }));
      return false;
    }

    // Validate building type
    if (!buildingPreview.getBuildingDefinition(buildingType)) {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<i>Unknown building type. Use /build to see available buildings.</i>' 
      }));
      return false;
    }

    // Validate placement (players use strict terrain rules)
    const facing = player.facing || 'right';
    const validation = buildingPreview.validateBuildingPlacement(buildingType, c, r, z, facing, true); // isPlayer = true
    const materialCheck = buildingPreview.checkMaterials(player, buildingType);

    // Send preview data to client
    socket.write(JSON.stringify({
      msg: 'buildingPreview',
      buildingType: buildingType,
      canBuild: validation.canBuild && materialCheck.hasMaterials,
      tiles: validation.tiles,
      clearableTiles: validation.clearableTiles,
      blockedTiles: validation.blockedTiles,
      missingMaterials: materialCheck.missing
    }));

    return true;
  }
}

module.exports = PreviewCommand;
