/**
 * SetHomeCommand - Handles /sethome command
 * 
 * Sets player's home to current building.
 */

const BaseCommand = require('../BaseCommand');

class SetHomeCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'sethome';
    this.description = 'Set your home location';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    if (player.z !== 1 && player.z !== 2) {
      this.sendError(socket, 'You must be inside a building to set home');
      return false;
    }

    const getBuilding = this.getGlobal('getBuilding', () => null);
    const buildingId = getBuilding(player.x, player.y);
    
    if (!buildingId || !global.Building?.list?.[buildingId]) {
      this.sendError(socket, 'Not inside a building');
      return false;
    }

    const building = global.Building.list[buildingId];
    
    if (building.owner !== player.id) {
      this.sendError(socket, 'You do not own this building');
      return false;
    }

    const homeBuildings = ['hut', 'cottage', 'tavern', 'tower', 'stronghold'];
    if (!homeBuildings.includes(building.type)) {
      this.sendError(socket, 'This building type cannot be set as home');
      return false;
    }

    const walls = building.walls || [];
    const fireplaceWall = building.type === 'tower' ? walls[2] : walls[1];
    const homeTile = [fireplaceWall[0], fireplaceWall[1] + 1];
    const homeZ = building.type === 'tavern' ? 2 : 1;
    
    player.home = { z: homeZ, loc: homeTile };

    this.sendSuccess(socket, `Home set to ${building.type}`);
    return true;
  }
}

module.exports = SetHomeCommand;
