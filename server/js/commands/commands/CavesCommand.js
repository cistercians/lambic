/**
 * CavesCommand - Handles /caves command
 * 
 * Lists all cave entrances in the world.
 */

const BaseCommand = require('../BaseCommand');

class CavesCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'caves';
    this.description = 'Lists all cave entrances';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    const caveEntrances = global.caveEntrances || [];
    
    if (caveEntrances.length === 0) {
      this.sendMessage(socket, 'No cave entrances found in the world.');
      return true;
    }

    let msg = '<b>Cave Entrances:</b><br>';
    for (let i = 0; i < caveEntrances.length; i++) {
      const entrance = caveEntrances[i];
      if (Array.isArray(entrance) && entrance.length >= 2) {
        msg += `${i + 1}. [${entrance[0]}, ${entrance[1]}]<br>`;
      }
    }

    this.send(socket, { msg: 'addToChat', message: `<p>${msg}</p>` });
    return true;
  }
}

module.exports = CavesCommand;
