/**
 * UnequipCommand - Handles /unequip command
 * 
 * Handles unequipping weapons, armor, and accessories.
 */

const BaseCommand = require('../BaseCommand');

class UnequipCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'unequip';
    this.description = 'Remove equipped items';
    this.usage = '/unequip <slot>';
  }

  execute(data) {
    const { player, socket } = this.getContext(data);
    if (!player || !socket) return false;

    // Handle /unequip (list equipped items)
    if (data.cmd === 'unequip') {
      return this.listEquipped(player, socket);
    }

    const args = this.parseArgs(data.cmd);
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /unequip <slot>');
      return false;
    }

    return this.unequipSlot(player, args[0].toLowerCase(), socket);
  }

  /**
   * List all equipped items
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  listEquipped(player, socket) {
    let all = '';

    if (player.gear.head) {
      all += `<b>${player.gear.head.name}</b>: /unequip head<br>`;
    }
    if (player.gear.armor) {
      all += `<b>${player.gear.armor.name}</b>: /unequip armor<br>`;
    }
    if (player.gear.weapon) {
      all += `<b>${player.gear.weapon.name}</b>: /unequip weapon<br>`;
    }
    if (player.gear.weapon2) {
      all += `<b>${player.gear.weapon2.name}</b>: /unequip weapon2<br>`;
    }
    if (player.gear.accessory) {
      all += `<b>${player.gear.accessory.name}</b>: /unequip accessory`;
    }

    if (all === '') {
      this.sendMessage(socket, 'You have nothing equipped.');
    } else {
      this.send(socket, { msg: 'addToChat', message: `<p>${all}</p>` });
    }

    return true;
  }

  /**
   * Unequip a specific slot
   * @param {object} player - Player entity
   * @param {string} slot - Slot name
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  unequipSlot(player, slot, socket) {
    switch (slot) {
      case 'head':
        return this.unequipHead(player, socket);
      case 'armor':
        return this.unequipArmor(player, socket);
      case 'weapon':
        return this.unequipWeapon(player, socket);
      case 'weapon2':
        return this.unequipWeapon2(player, socket);
      case 'accessory':
        return this.unequipAccessory(player, socket);
      default:
        this.sendError(socket, `Unknown slot: ${slot}`);
        return false;
    }
  }

  /**
   * Unequip head slot
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  unequipHead(player, socket) {
    if (!player.gear.head) {
      this.sendError(socket, 'You are not wearing any headgear.');
      return false;
    }

    const itemName = player.gear.head.name;
    if (typeof player.gear.head.unequip === 'function') {
      player.gear.head.unequip(player.id);
    }
    player.gear.head = null;
    this.sendMessage(socket, `You unequip <b>${itemName}</b>.`);
    return true;
  }

  /**
   * Unequip armor slot
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  unequipArmor(player, socket) {
    if (!player.gear.armor) {
      this.sendError(socket, 'You are not wearing any armor.');
      return false;
    }

    const itemName = player.gear.armor.name;
    
    // Handle mounted state (dismount if mounted)
    if (player.mounted) {
      player.mounted = false;
      if (typeof player.baseSpd !== 'undefined') {
        player.baseSpd -= 3;
      }
      player.mountCooldown = 200;
    }

    if (typeof player.gear.armor.unequip === 'function') {
      player.gear.armor.unequip(player.id);
    }
    player.gear.armor = null;
    this.sendMessage(socket, `You unequip <b>${itemName}</b>.`);
    return true;
  }

  /**
   * Unequip primary weapon
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  unequipWeapon(player, socket) {
    if (!player.gear.weapon) {
      this.sendError(socket, 'You do not have any weapons equipped.');
      return false;
    }

    const itemName = player.gear.weapon.name;
    
    if (typeof player.gear.weapon.unequip === 'function') {
      player.gear.weapon.unequip(player.id);
    }

    // If there's a secondary weapon, switch to it
    if (player.gear.weapon2) {
      const secondaryName = player.gear.weapon2.name;
      player.gear.weapon = player.gear.weapon2;
      player.gear.weapon2 = null;
      this.sendMessage(socket, `You unequip <b>${itemName}</b> and switch weapons to <b>${secondaryName}</b>.`);
    } else {
      player.gear.weapon = null;
      this.sendMessage(socket, `You unequip <b>${itemName}</b>.`);
    }

    return true;
  }

  /**
   * Unequip secondary weapon
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  unequipWeapon2(player, socket) {
    if (!player.gear.weapon2) {
      this.sendError(socket, 'You do not have a secondary weapon equipped.');
      return false;
    }

    const itemName = player.gear.weapon2.name;
    if (typeof player.gear.weapon2.unequip === 'function') {
      player.gear.weapon2.unequip(player.id);
    }
    player.gear.weapon2 = null;
    this.sendMessage(socket, `You unequip <b>${itemName}</b>.`);
    return true;
  }

  /**
   * Unequip accessory
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  unequipAccessory(player, socket) {
    if (!player.gear.accessory) {
      this.sendError(socket, 'You do not have an accessory equipped.');
      return false;
    }

    const itemName = player.gear.accessory.name;
    if (typeof player.gear.accessory.unequip === 'function') {
      player.gear.accessory.unequip(player.id);
    }
    player.gear.accessory = null;
    this.sendMessage(socket, `You unequip <b>${itemName}</b>.`);
    return true;
  }

}

module.exports = UnequipCommand;
