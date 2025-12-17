/**
 * CharacterDisplayUI - Manages character sheet display
 * 
 * Extracted from client.js for better organization.
 */

class CharacterDisplayUI {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Update character display - full update
   * @param {object} player - Player entity
   * @param {boolean} fullUpdate - Whether to do full update
   */
  updateCharacterDisplay(player, fullUpdate = true) {
    if (!player) return;

    // Always update HP/Spirit bars (real-time)
    this.updateCharacterBars(player);

    // Always update sprite/portrait (like portrait HUD does every frame)
    this.updateCharacterSprite(player);

    // Only do full update when needed
    if (fullUpdate !== false) {
      this.updateCharacterName(player);
      this.updateCharacterHouse(player);
      this.updateCharacterStats(player);
    }
  }

  /**
   * Update character name
   * @param {object} player - Player entity
   */
  updateCharacterName(player) {
    const characterNameEl = document.getElementById('character-name');
    if (characterNameEl) {
      characterNameEl.textContent = player.name || 'Character';
    }
  }

  /**
   * Update character house affiliation
   * @param {object} player - Player entity
   */
  updateCharacterHouse(player) {
    const characterHouseEl = document.getElementById('character-house');
    if (!characterHouseEl) return;

    if (player.house && typeof houseList !== 'undefined' && houseList && houseList[player.house]) {
      characterHouseEl.textContent = houseList[player.house].name || 'Neutral';
    } else if (player.kingdom && typeof kingdomList !== 'undefined' && kingdomList && kingdomList[player.kingdom]) {
      characterHouseEl.textContent = kingdomList[player.kingdom].name || 'Neutral';
    } else {
      characterHouseEl.textContent = 'Neutral';
    }
  }

  /**
   * Update character sprite display
   * @param {object} player - Player entity
   */
  updateCharacterSprite(player) {
    const canvas = document.getElementById('character-sprite-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Use player.sprite directly (same as portrait HUD and game renderer)
    // The sprite is already updated when gear changes, just draw it
    if (player.sprite && player.sprite.facedown) {
      try {
        ctx.drawImage(player.sprite.facedown, 0, 0, 128, 128);
      } catch (e) {
        // Image might not be loaded yet, try other directions
        const spriteImg = player.sprite.faceup || player.sprite.faceleft || player.sprite.faceright;
        if (spriteImg) {
          try {
            ctx.drawImage(spriteImg, 0, 0, 128, 128);
          } catch (e2) {
            // Silently fail if image not ready
          }
        }
      }
    } else if (player.sprite) {
      const spriteImg = player.sprite.facedown || player.sprite.faceup || 
                       player.sprite.faceleft || player.sprite.faceright;
      if (spriteImg) {
        try {
          ctx.drawImage(spriteImg, 0, 0, 128, 128);
        } catch (e) {
          // Silently fail if image not ready
        }
      }
    }
  }

  /**
   * Update character HP/Spirit bars
   * @param {object} player - Player entity
   */
  updateCharacterBars(player) {
    // Update HP bar
    const hpPercent = Math.max(0, Math.min(100, (player.hp / player.hpMax) * 100));
    const hpBar = document.getElementById('character-hp-bar');
    const hpText = document.getElementById('character-hp-text');
    if (hpBar) {
      hpBar.style.width = hpPercent + '%';
    }
    if (hpText) {
      hpText.textContent = Math.floor(player.hp) + ' / ' + Math.floor(player.hpMax);
    }

    // Update Spirit bar
    const spiritContainer = document.getElementById('character-spirit-container');
    if (player.spirit !== null && player.spirit !== undefined) {
      if (spiritContainer) {
        spiritContainer.style.display = 'block';
        const spiritPercent = Math.max(0, Math.min(100, (player.spirit / player.spiritMax) * 100));
        const spiritBar = document.getElementById('character-spirit-bar');
        const spiritText = document.getElementById('character-spirit-text');
        if (spiritBar) {
          spiritBar.style.width = spiritPercent + '%';
        }
        if (spiritText) {
          spiritText.textContent = Math.floor(player.spirit) + ' / ' + Math.floor(player.spiritMax);
        }
      }
    } else {
      if (spiritContainer) {
        spiritContainer.style.display = 'none';
      }
    }
  }

  /**
   * Update character stats and equipment
   * @param {object} player - Player entity
   */
  updateCharacterStats(player) {
    // Calculate attack and defense from gear
    let attack = 0;
    let defense = 0;
    let strBonus = 0;
    let dexBonus = 0;
    let spiritBonus = 0;

    if (player.gear) {
      if (player.gear.weapon && player.gear.weapon.dmg) {
        attack += player.gear.weapon.dmg;
        strBonus += player.gear.weapon.strengthBonus || 0;
        dexBonus += player.gear.weapon.dexterityBonus || 0;
        spiritBonus += player.gear.weapon.spiritBonus || 0;
      }
      if (player.gear.weapon2 && player.gear.weapon2.dmg) {
        attack += player.gear.weapon2.dmg;
        strBonus += player.gear.weapon2.strengthBonus || 0;
        dexBonus += player.gear.weapon2.dexterityBonus || 0;
        spiritBonus += player.gear.weapon2.spiritBonus || 0;
      }
      if (player.gear.armor && player.gear.armor.defense) {
        defense += player.gear.armor.defense;
        strBonus += player.gear.armor.strengthBonus || 0;
        dexBonus += player.gear.armor.dexterityBonus || 0;
        spiritBonus += player.gear.armor.spiritBonus || 0;
      }
      if (player.gear.head) {
        strBonus += player.gear.head.strengthBonus || 0;
        dexBonus += player.gear.head.dexterityBonus || 0;
        spiritBonus += player.gear.head.spiritBonus || 0;
      }
      if (player.gear.accessory) {
        strBonus += player.gear.accessory.strengthBonus || 0;
        dexBonus += player.gear.accessory.dexterityBonus || 0;
        spiritBonus += player.gear.accessory.spiritBonus || 0;
      }
    }

    const statAttack = document.getElementById('stat-attack');
    const statDefense = document.getElementById('stat-defense');
    if (statAttack) statAttack.textContent = attack;
    if (statDefense) statDefense.textContent = defense;

    // Update stats
    const baseStr = player.strength || 1;
    const baseDex = player.dexterity || 0;
    const baseSpirit = player.spirit || 0;

    const statStrength = document.getElementById('stat-strength');
    const statDexterity = document.getElementById('stat-dexterity');
    const statSpirit = document.getElementById('stat-spirit');
    
    if (statStrength) {
      statStrength.innerHTML = baseStr + (strBonus > 0 ? ' <span class="stat-bonus">(+' + strBonus + ')</span>' : '');
    }
    if (statDexterity) {
      statDexterity.innerHTML = baseDex + (dexBonus > 0 ? ' <span class="stat-bonus">(+' + dexBonus + ')</span>' : '');
    }
    if (statSpirit) {
      statSpirit.innerHTML = baseSpirit + (spiritBonus > 0 ? ' <span class="stat-bonus">(+' + spiritBonus + ')</span>' : '');
    }

    // Update equipment slots
    this.updateEquipmentSlot('equipment-weapon', player.gear ? player.gear.weapon : null, 'Main Hand');
    this.updateEquipmentSlot('equipment-weapon2', player.gear ? player.gear.weapon2 : null, 'Off Hand');
    this.updateEquipmentSlot('equipment-head', player.gear ? player.gear.head : null, 'Head');
    this.updateEquipmentSlot('equipment-armor', player.gear ? player.gear.armor : null, 'Body');
    this.updateEquipmentSlot('equipment-accessory', player.gear ? player.gear.accessory : null, 'Accessory');
  }

  /**
   * Map slot ID to server slot name
   * @param {string} slotId - Slot element ID (e.g., 'equipment-weapon')
   * @returns {string} Server slot name (e.g., 'weapon')
   */
  getSlotName(slotId) {
    const slotMap = {
      'equipment-weapon': 'weapon',
      'equipment-weapon2': 'weapon2',
      'equipment-head': 'head',
      'equipment-armor': 'armor',
      'equipment-accessory': 'accessory'
    };
    return slotMap[slotId] || slotId.replace('equipment-', '');
  }

  /**
   * Convert item display name to item type key (same mapping as inventory)
   * @param {string} name - Display name (e.g., 'BastardSword')
   * @returns {string} Item type key (e.g., 'bastardsword')
   */
  getNameToType(name) {
    // Use the same mapping as InventoryHandler.js
    const nameToTypeMap = {
      'WorldMap': 'worldmap',
      'Crown': 'crown',
      'Relic': 'relic',
      'Key': 'key',
      'HuntingKnife': 'huntingknife',
      'Dague': 'dague',
      'Rondel': 'rondel',
      'Misericorde': 'misericorde',
      'BastardSword': 'bastardsword',
      'Longsword': 'longsword',
      'Zweihander': 'zweihander',
      'Morallta': 'morallta',
      'Bow': 'bow',
      'WelshLongbow': 'welshlongbow',
      'RusticLance': 'rusticlance',
      'KnightLance': 'knightlance',
      'PaladinLance': 'paladinlance',
      'Arrows': 'arrows',
      'Brigandine': 'brigandine',
      'Lamellar': 'lamellar',
      'Maille': 'maille',
      'Hauberk': 'hauberk',
      'Brynja': 'brynja',
      'Cuirass': 'cuirass',
      'SteelPlate': 'steelplate',
      'GreenwichPlate': 'greenwichplate',
      'GothicPlate': 'gothicplate',
      'ClericRobe': 'clericrobe',
      'MonkCowl': 'monkcowl',
      'BlackCloak': 'blackcloak',
      'Pickaxe': 'pickaxe',
      'StoneAxe': 'stoneaxe',
      'IronAxe': 'ironaxe',
      'Torch': 'torch',
      'Wood': 'wood',
      'Stone': 'stone',
      'Grain': 'grain',
      'IronOre': 'ironore',
      'Iron': 'iron',
      'Steel': 'steel',
      'SilverOre': 'silverore',
      'Silver': 'silver',
      'GoldOre': 'goldore',
      'Gold': 'gold',
      'Diamond': 'diamond',
      'BoarHide': 'boarhide',
      'Leather': 'leather',
      'Bread': 'bread',
      'Meat': 'meat',
      'Fish': 'fish',
      'Lamb': 'lamb',
      'BoarMeat': 'boarmeat',
      'Venison': 'venison',
      'PoachedFish': 'poachedfish',
      'LambChop': 'lambchop',
      'BoarShank': 'boarshank',
      'VenisonLoin': 'venisonloin',
      'Mead': 'mead',
      'Saison': 'saison',
      'Flanders': 'flanders',
      'BiereDeGarde': 'bieredegarde',
      'Bordeaux': 'bordeaux',
      'Bourgogne': 'bourgogne',
      'Chianti': 'chianti',
      'Tome': 'tome',
      'RunicScroll': 'runicscroll',
      'SacredText': 'sacredtext',
      'Chest': 'chest',
      'LockedChest': 'lockedchest'
    };
    return nameToTypeMap[name] || name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  }

  /**
   * Update equipment slot display
   * @param {string} slotId - Slot element ID
   * @param {object} item - Item object
   * @param {string} slotLabel - Label for empty slot
   */
  updateEquipmentSlot(slotId, item, slotLabel) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    // Reset slot border to default
    slot.style.border = '2px solid rgba(255, 255, 255, 0.3)';

    // Clear slot and add label
    slot.innerHTML = '<div class="equipment-slot-label">' + slotLabel + '</div>';

    if (item && item.name) {
      // Convert item name to item type key (same as inventory uses)
      const itemType = this.getNameToType(item.name);
      
      // Get item rank and rarity colors (same as inventory)
      let rank = 0;
      let borderColor = '#CCCCCC';
      let rarityColor = '#FFFFFF';
      if (typeof window !== 'undefined' && typeof getItemRank === 'function' && typeof getRarityBorderColor === 'function' && typeof getRarityColor === 'function') {
        rank = getItemRank(itemType);
        borderColor = getRarityBorderColor(rank);
        rarityColor = getRarityColor(rank);
      }
      
      // Apply rarity border color to slot (same as inventory) - use border property to override CSS
      slot.style.border = '2px solid ' + borderColor;
      
      // Get item image (same pattern as inventory)
      const itemImg = typeof window !== 'undefined' && typeof getInventoryItemImage === 'function' 
        ? getInventoryItemImage(itemType, 1) 
        : null;
      
      // Create item display container
      const itemContainer = document.createElement('div');
      itemContainer.className = 'equipment-slot-item';
      
      // Add click handler to unequip item
      const slotName = this.getSlotName(slotId);
      itemContainer.onclick = (e) => {
        e.stopPropagation();
        if (typeof socket !== 'undefined' && socket) {
          socket.send(JSON.stringify({msg: 'unequipItem', slot: slotName}));
        }
      };
      
      // Add cursor pointer style to indicate clickability
      itemContainer.style.cursor = 'pointer';
      
      // Add image (same pattern as inventory)
      if (itemImg) {
        const img = document.createElement('img');
        img.src = itemImg.src;
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none'; // Same as inventory - clicks go to parent
        itemContainer.appendChild(img);
      }
      
      // Add item name with rarity color (same as inventory tooltip)
      const itemName = document.createElement('div');
      itemName.className = 'equipment-slot-name';
      itemName.style.color = rarityColor;
      itemName.textContent = item.name;
      itemContainer.appendChild(itemName);
      
      slot.appendChild(itemContainer);
    } else {
      // Show empty slot
      const emptySlot = document.createElement('div');
      emptySlot.className = 'equipment-slot-empty';
      emptySlot.textContent = 'Empty';
      slot.appendChild(emptySlot);
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.CharacterDisplayUI = CharacterDisplayUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CharacterDisplayUI;
}
