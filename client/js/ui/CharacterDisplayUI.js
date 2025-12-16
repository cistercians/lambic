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

    // Only do full update when needed
    if (fullUpdate !== false) {
      this.updateCharacterName(player);
      this.updateCharacterHouse(player);
      this.updateCharacterSprite(player);
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

    if (player.sprite && player.sprite.facedown) {
      ctx.drawImage(player.sprite.facedown, 0, 0, 128, 128);
    } else if (player.sprite) {
      const spriteImg = player.sprite.facedown || player.sprite.faceup || 
                       player.sprite.faceleft || player.sprite.faceright;
      if (spriteImg) {
        ctx.drawImage(spriteImg, 0, 0, 128, 128);
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
   * Update equipment slot display
   * @param {string} slotId - Slot element ID
   * @param {object} item - Item object
   * @param {string} slotLabel - Label for empty slot
   */
  updateEquipmentSlot(slotId, item, slotLabel) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    // Clear slot and add label
    slot.innerHTML = '<div class="equipment-slot-label">' + slotLabel + '</div>';

    if (item && item.name) {
      // Get item type from item (item.type should be the internal type like "bastardsword")
      // If not available, try to derive from name by lowercasing and removing spaces
      let itemType = item.type;
      if (!itemType && item.name) {
        // Convert formatted name back to item type format
        itemType = item.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      }
      
      // Get item image if available
      let itemImg = null;
      if (typeof window !== 'undefined' && typeof getInventoryItemImage === 'function') {
        itemImg = getInventoryItemImage(itemType, 1);
      }
      
      // Create item display container
      const itemContainer = document.createElement('div');
      itemContainer.className = 'equipment-slot-item';
      
      if (itemImg && itemImg.src) {
        // Add item image
        const img = document.createElement('img');
        img.src = itemImg.src;
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.objectFit = 'contain';
        itemContainer.appendChild(img);
      }
      
      // Add item name
      const itemName = document.createElement('div');
      itemName.className = 'equipment-slot-name';
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
