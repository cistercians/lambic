/**
 * EquipCommand - Handles /equip command
 * 
 * Handles equipping weapons, armor, and accessories.
 * Consolidates all equipment logic from Commands.js.
 */

const entityRegistry = require('../../core/EntityRegistry');
const systemRegistry = require('../../core/SystemRegistry');

class EquipCommand {
  constructor() {
    this.name = 'equip';
    
    // Equipment definitions
    this.weapons = {
      // Daggers (require leather/cloth, not mounted)
      'huntingknife': { type: 'dagger', requires: { armor: ['leather', 'cloth'], mounted: false } },
      'dague': { type: 'dagger', requires: { armor: ['leather', 'cloth'], mounted: false } },
      'rondel': { type: 'dagger', requires: { armor: ['leather', 'cloth'], mounted: false } },
      'misericorde': { type: 'dagger', requires: { armor: ['leather', 'cloth'], mounted: false } },
      
      // Swords (cannot wear cloth)
      'bastardsword': { type: 'sword', requires: { armor: '!cloth' } },
      'longsword': { type: 'sword', requires: { armor: '!cloth' } },
      'zweihander': { type: 'sword', requires: { armor: '!cloth' } },
      'morallta': { type: 'sword', requires: { armor: '!cloth' } },
      
      // Bows (cannot wear cloth or plate)
      'bow': { type: 'bow', requires: { armor: '!cloth,!plate' } },
      'welshlongbow': { type: 'bow', requires: { armor: '!cloth,!plate' } },
      
      // Lances (require mounted and plate)
      'knightlance': { type: 'lance', requires: { mounted: true, armor: 'plate' } },
      'rusticlance': { type: 'lance', requires: { mounted: true, armor: 'plate' } },
      'paladinlance': { type: 'lance', requires: { mounted: true, armor: 'plate' } }
    };
    
    this.armor = {
      // Light armor (cannot have lance)
      'brigandine': { type: 'leather', requires: { weapon: '!lance' } },
      'lamellar': { type: 'leather', requires: { weapon: '!lance' } },
      
      // Medium armor (cannot have lance or dagger)
      'maille': { type: 'mail', requires: { weapon: '!lance,!dagger' } },
      'hauberk': { type: 'mail', requires: { weapon: '!lance,!dagger' } },
      'brynja': { type: 'mail', requires: { weapon: '!lance,!dagger' } },
      
      // Heavy armor (cannot have bow or dagger)
      'cuirass': { type: 'plate', requires: { weapon: '!bow,!dagger' } },
      'steelplate': { type: 'plate', requires: { weapon: '!bow,!dagger' } },
      'greenwichplate': { type: 'plate', requires: { weapon: '!bow,!dagger' } },
      'gothicplate': { type: 'plate', requires: { weapon: '!bow,!dagger' } },
      
      // Special armor
      'clericrobe': { type: 'cloth', requires: { mounted: false, weapon: false } },
      'monkcowl': { type: 'cloth', requires: { mounted: false, weapon: 'dagger' } },
      'blackcloak': { type: 'cloth', requires: { mounted: false, weapon: 'dagger' } }
    };
    
    this.accessories = {
      'crown': { slot: 'head' }
    };
  }

  /**
   * Execute the equip command
   * @param {object} data - Command data { cmd, id, world }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Handle /equip (list equippable items)
    if (data.cmd === 'equip') {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<i>List all equippable items here.</i>' 
      }));
      return true;
    }

    // Handle /equip [item]
    const parts = data.cmd.split(' ');
    if (parts.length < 2) {
      this.sendError(socket, 'Usage: /equip <item>');
      return false;
    }

    const itemName = parts.slice(1).join(' ').toLowerCase();

    // Check if in combat
    if (player.mode === 'combat') {
      this.sendError(socket, 'You cannot equip gear while in combat.');
      return false;
    }

    // Try to equip as weapon
    if (this.weapons[itemName]) {
      return this.equipWeapon(player, itemName, socket);
    }

    // Try to equip as armor
    if (this.armor[itemName]) {
      return this.equipArmor(player, itemName, socket);
    }

    // Try to equip as accessory
    if (this.accessories[itemName]) {
      return this.equipAccessory(player, itemName, socket);
    }

    this.sendError(socket, `Unknown item: ${itemName}`);
    return false;
  }

  /**
   * Equip a weapon
   * @param {object} player - Player entity
   * @param {string} itemName - Item name
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  equipWeapon(player, itemName, socket) {
    const weaponDef = this.weapons[itemName];
    const equip = global.equip || {};

    // Check if player has the item
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
      this.sendError(socket, `You are not carrying a ${this.formatItemName(itemName)}.`);
      return false;
    }

    // Check requirements
    if (!this.checkWeaponRequirements(player, weaponDef)) {
      this.sendError(socket, this.getWeaponRequirementError(weaponDef));
      return false;
    }

    const weaponItem = equip[itemName];
    if (!weaponItem) {
      this.sendError(socket, `Equipment definition not found for ${itemName}.`);
      return false;
    }

    // Equip as primary or secondary weapon
    if (!player.gear.weapon) {
      player.gear.weapon = weaponItem;
      player.inventory[itemName]--;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EquipCommand.js:152',message:'Weapon equipped',data:{playerId:player.id,itemName:itemName,weaponType:weaponItem.type,weaponItem:JSON.stringify(weaponItem),gearWeaponType:typeof player.gear.weapon},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (typeof recalculatePlayerStats === 'function') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EquipCommand.js:155',message:'Calling recalculatePlayerStats',data:{playerId:player.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        recalculatePlayerStats(player.id);
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EquipCommand.js:155',message:'recalculatePlayerStats function not found',data:{playerId:player.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      this.sendMessage(socket, `You equipped a <b>${this.formatItemName(itemName)}</b>.`);
      return true;
    } else {
      // Equip as secondary
      if (player.gear.weapon2 && typeof player.gear.weapon2.unequip === 'function') {
        player.gear.weapon2.unequip(player.id);
      }
      player.gear.weapon2 = weaponItem;
      player.inventory[itemName]--;
      if (typeof recalculatePlayerStats === 'function') {
        recalculatePlayerStats(player.id);
      }
      this.sendMessage(socket, `You equipped a <b>${this.formatItemName(itemName)}</b> as your secondary weapon. Press X to switch.`);
      return true;
    }
  }

  /**
   * Equip armor
   * @param {object} player - Player entity
   * @param {string} itemName - Item name
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  equipArmor(player, itemName, socket) {
    const armorDef = this.armor[itemName];
    const equip = global.equip || {};

    // Check if player has the item
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
      this.sendError(socket, `You are not carrying ${this.formatItemName(itemName)}.`);
      return false;
    }

    // Check requirements
    if (!this.checkArmorRequirements(player, armorDef)) {
      this.sendError(socket, this.getArmorRequirementError(armorDef));
      return false;
    }

    const armorItem = equip[itemName];
    if (!armorItem) {
      this.sendError(socket, `Equipment definition not found for ${itemName}.`);
      return false;
    }

    // Unequip existing armor
    if (player.gear.armor && typeof player.gear.armor.unequip === 'function') {
      player.gear.armor.unequip(player.id);
    }

    player.gear.armor = armorItem;
    player.inventory[itemName]--;
    if (typeof recalculatePlayerStats === 'function') {
      recalculatePlayerStats(player.id);
    }
    this.sendMessage(socket, `You equipped <b>${this.formatItemName(itemName)}</b>.`);
    return true;
  }

  /**
   * Equip accessory
   * @param {object} player - Player entity
   * @param {string} itemName - Item name
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  equipAccessory(player, itemName, socket) {
    const accessoryDef = this.accessories[itemName];
    const equip = global.equip || {};

    // Check if player has the item
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
      this.sendError(socket, `You are not carrying ${this.formatItemName(itemName)}.`);
      return false;
    }

    const accessoryItem = equip[itemName];
    if (!accessoryItem) {
      this.sendError(socket, `Equipment definition not found for ${itemName}.`);
      return false;
    }

    const slot = accessoryDef.slot;
    if (player.gear[slot] && typeof player.gear[slot].unequip === 'function') {
      player.gear[slot].unequip(player.id);
    }

    player.gear[slot] = accessoryItem;
    player.inventory[itemName]--;
    this.sendMessage(socket, `You equipped <b>${this.formatItemName(itemName)}</b>.`);
    return true;
  }

  /**
   * Check weapon requirements
   * @param {object} player - Player entity
   * @param {object} weaponDef - Weapon definition
   * @returns {boolean} Requirements met
   */
  checkWeaponRequirements(player, weaponDef) {
    const req = weaponDef.requires || {};

    // Check mounted requirement
    if (req.mounted !== undefined && !!player.mounted !== req.mounted) {
      return false;
    }

    // Check armor requirement
    if (req.armor) {
      if (Array.isArray(req.armor)) {
        // Must be one of these types
        if (!player.gear.armor || !req.armor.includes(player.gear.armor.type)) {
          // Special case: cloth with ClericRobe exception
          if (req.armor.includes('cloth') && player.gear.armor && 
              player.gear.armor.name === 'ClericRobe') {
            return false; // ClericRobe exception for daggers
          }
          return false;
        }
      } else if (req.armor.startsWith('!')) {
        // Cannot be these types
        const forbidden = req.armor.substring(1).split(',');
        if (player.gear.armor && forbidden.includes(player.gear.armor.type)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check armor requirements
   * @param {object} player - Player entity
   * @param {object} armorDef - Armor definition
   * @returns {boolean} Requirements met
   */
  checkArmorRequirements(player, armorDef) {
    const req = armorDef.requires || {};

    // Check mounted requirement
    if (req.mounted !== undefined && !!player.mounted !== req.mounted) {
      return false;
    }

    // Check weapon requirement
    if (req.weapon) {
      if (req.weapon === false) {
        // Cannot have any weapon
        if (player.gear.weapon) return false;
      } else if (req.weapon.startsWith('!')) {
        // Cannot have these weapon types
        const forbidden = req.weapon.substring(1).split(',');
        const weapon = player.gear.weapon || player.gear.weapon2;
        if (weapon && forbidden.includes(weapon.type)) {
          return false;
        }
      } else {
        // Must have this weapon type
        const weapon = player.gear.weapon || player.gear.weapon2;
        if (!weapon || weapon.type !== req.weapon) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get weapon requirement error message
   * @param {object} weaponDef - Weapon definition
   * @returns {string} Error message
   */
  getWeaponRequirementError(weaponDef) {
    const req = weaponDef.requires || {};
    
    if (weaponDef.type === 'dagger') {
      return 'Must be wearing leather armor and not be mounted.';
    } else if (weaponDef.type === 'sword') {
      return 'Must not be wearing cloth.';
    } else if (weaponDef.type === 'bow') {
      return 'Must not be wearing cloth or plate armor.';
    } else if (weaponDef.type === 'lance') {
      return 'Must be mounted and wearing plate armor.';
    }
    
    return 'Requirements not met.';
  }

  /**
   * Get armor requirement error message
   * @param {object} armorDef - Armor definition
   * @returns {string} Error message
   */
  getArmorRequirementError(armorDef) {
    const req = armorDef.requires || {};
    
    if (req.weapon === '!lance') {
      return 'Must not have a lance equipped.';
    } else if (req.weapon === '!lance,!dagger') {
      return 'Must not have a dagger or lance equipped.';
    } else if (req.weapon === '!bow,!dagger') {
      return 'Must not have a dagger or bow equipped.';
    } else if (req.mounted === false && req.weapon === false) {
      return 'Must not be mounted or have a weapon equipped.';
    } else if (req.mounted === false && req.weapon === 'dagger') {
      return 'Must not be mounted and may only carry a dagger.';
    }
    
    return 'Requirements not met.';
  }

  /**
   * Format item name for display
   * @param {string} itemName - Item name
   * @returns {string} Formatted name
   */
  formatItemName(itemName) {
    return itemName.charAt(0).toUpperCase() + itemName.slice(1).replace(/([A-Z])/g, ' $1');
  }

  /**
   * Send message to socket
   * @param {object} socket - Socket
   * @param {string} message - Message
   */
  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }

  /**
   * Send error message to socket
   * @param {object} socket - Socket
   * @param {string} message - Error message
   */
  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>Error: ${message}</i>` }));
  }
}

module.exports = EquipCommand;
