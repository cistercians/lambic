/**
 * InventoryHandler.js
 * Handles inventory display updates and item interactions
 * Extracted from client.js to reduce complexity
 */

var InventoryHandler = {
  /**
   * Update the inventory display grid
   */
  updateDisplay: function() {
    var playerId = getPlayerIdForUI();
    if(!Player.list[playerId]) return;
    
    var player = Player.list[playerId];
    inventoryGrid.innerHTML = '';
    
    // Display all inventory items - comprehensive list
    var inventoryItems = [
      // Special items
      {type: 'worldmap', name: 'WorldMap'},
      {type: 'crown', name: 'Crown'},
      {type: 'relic', name: 'Relic'},
      {type: 'key', name: 'Key'},
      // Weapons
      {type: 'huntingknife', name: 'HuntingKnife'},
      {type: 'dague', name: 'Dague'},
      {type: 'rondel', name: 'Rondel'},
      {type: 'misericorde', name: 'Misericorde'},
      {type: 'bastardsword', name: 'BastardSword'},
      {type: 'longsword', name: 'Longsword'},
      {type: 'zweihander', name: 'Zweihander'},
      {type: 'morallta', name: 'Morallta'},
      {type: 'bow', name: 'Bow'},
      {type: 'welshlongbow', name: 'WelshLongbow'},
      {type: 'rusticlance', name: 'RusticLance'},
      {type: 'knightlance', name: 'KnightLance'},
      {type: 'paladinlance', name: 'PaladinLance'},
      {type: 'arrows', name: 'Arrows'},
      // Armor
      {type: 'brigandine', name: 'Brigandine'},
      {type: 'lamellar', name: 'Lamellar'},
      {type: 'maille', name: 'Maille'},
      {type: 'hauberk', name: 'Hauberk'},
      {type: 'brynja', name: 'Brynja'},
      {type: 'cuirass', name: 'Cuirass'},
      {type: 'steelplate', name: 'SteelPlate'},
      {type: 'greenwichplate', name: 'GreenwichPlate'},
      {type: 'gothicplate', name: 'GothicPlate'},
      {type: 'clericrobe', name: 'ClericRobe'},
      {type: 'monkcowl', name: 'MonkCowl'},
      {type: 'blackcloak', name: 'BlackCloak'},
      // Tools
      {type: 'pickaxe', name: 'Pickaxe'},
      {type: 'stoneaxe', name: 'StoneAxe'},
      {type: 'ironaxe', name: 'IronAxe'},
      {type: 'torch', name: 'Torch'},
      // Resources
      {type: 'wood', name: 'Wood'},
      {type: 'stone', name: 'Stone'},
      {type: 'grain', name: 'Grain'},
      {type: 'ironore', name: 'IronOre'},
      {type: 'iron', name: 'Iron'},
      {type: 'steel', name: 'Steel'},
      {type: 'silverore', name: 'SilverOre'},
      {type: 'silver', name: 'Silver'},
      {type: 'goldore', name: 'GoldOre'},
      {type: 'gold', name: 'Gold'},
      {type: 'diamond', name: 'Diamond'},
      {type: 'boarhide', name: 'BoarHide'},
      {type: 'leather', name: 'Leather'},
      // Food
      {type: 'bread', name: 'Bread'},
      {type: 'meat', name: 'Meat'},
      {type: 'fish', name: 'Fish'},
      {type: 'lamb', name: 'Lamb'},
      {type: 'boarmeat', name: 'BoarMeat'},
      {type: 'venison', name: 'Venison'},
      {type: 'poachedfish', name: 'PoachedFish'},
      {type: 'lambchop', name: 'LambChop'},
      {type: 'boarshank', name: 'BoarShank'},
      {type: 'venisonloin', name: 'VenisonLoin'},
      // Drinks
      {type: 'mead', name: 'Mead'},
      {type: 'saison', name: 'Saison'},
      {type: 'flanders', name: 'Flanders'},
      {type: 'bieredegarde', name: 'BiereDeGarde'},
      {type: 'bordeaux', name: 'Bordeaux'},
      {type: 'bourgogne', name: 'Bourgogne'},
      {type: 'chianti', name: 'Chianti'},
      // Magic items
      {type: 'tome', name: 'Tome'},
      {type: 'runicscroll', name: 'RunicScroll'},
      {type: 'sacredtext', name: 'SacredText'},
      // Containers
      {type: 'chest', name: 'Chest'},
      {type: 'lockedchest', name: 'LockedChest'}
    ];
    
    inventoryItems.forEach(function(item){
      var count = player.inventory[item.type];
      if(count && count > 0){
        var itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        
        // Get item rank and set border color
        var rank = getItemRank(item.type);
        var borderColor = getRarityBorderColor(rank);
        var rarityColor = getRarityColor(rank);
        itemDiv.style.borderColor = borderColor;
        itemDiv.style.borderWidth = '2px';
        
        // Store item data for click handlers
        itemDiv.dataset.itemType = item.type;
        itemDiv.dataset.itemName = item.name;
        itemDiv.dataset.itemCount = count;
        itemDiv.dataset.itemRank = rank;
        
        // Create tooltip with rarity color
        var tooltip = document.createElement('div');
        tooltip.className = 'inventory-item-tooltip';
        tooltip.innerHTML = '<span style="color:' + rarityColor + '">[' + item.name + ']</span> x' + count;
        itemDiv.appendChild(tooltip);
        
        // Get the appropriate image based on item type and quantity
        var itemImg = getInventoryItemImage(item.type, count);
        if(itemImg){
          var img = document.createElement('img');
          img.src = itemImg.src;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';
          img.style.pointerEvents = 'none'; // Allow clicks to pass through to parent
          itemDiv.appendChild(img);
        } else {
          // Fallback: show item name as text if no image exists
          var placeholder = document.createElement('div');
          placeholder.style.fontSize = '12px';
          placeholder.style.color = rarityColor;
          placeholder.style.textAlign = 'center';
          placeholder.style.padding = '10px';
          placeholder.style.pointerEvents = 'none'; // Allow clicks to pass through to parent
          placeholder.textContent = item.name;
          itemDiv.appendChild(placeholder);
        }
        
        // Left click handler - use/equip item
        (function(itemType, itemName){
          itemDiv.onclick = function(e){
            e.stopPropagation();
            InventoryHandler.handleLeftClick(itemType, itemName);
          };
        })(item.type, item.name);
        
        // Right click handler - context menu
        (function(itemType, itemName, itemCount){
          itemDiv.oncontextmenu = function(e){
            e.preventDefault();
            e.stopPropagation();
            InventoryHandler.showContextMenu(e, itemType, itemName, itemCount);
          };
        })(item.type, item.name, count);
        
        inventoryGrid.appendChild(itemDiv);
      }
    });
    
    if(inventoryGrid.innerHTML === ''){
      inventoryGrid.innerHTML = '<p style="color:#888;padding:20px;">Your inventory is empty</p>';
    }
  },

  /**
   * Handle left click on inventory item
   * @param {string} itemType - Type of item
   * @param {string} itemName - Name of item
   */
  handleLeftClick: function(itemType, itemName) {
    // Determine action based on item type
    var rank = getItemRank(itemType);
    
    // Check if it's equippable (weapons, armor)
    var weaponTypes = ['dague', 'rondel', 'misericorde', 'bastardsword', 'longsword', 'zweihander', 'morallta', 'bow', 'welshlongbow', 'knightlance', 'rusticlance', 'paladinlance', 'huntingknife'];
    var armorTypes = ['brigandine', 'lamellar', 'maille', 'hauberk', 'brynja', 'cuirass', 'steelplate', 'greenwichplate', 'gothicplate', 'clericrobe', 'monkcowl', 'blackcloak'];
    var headTypes = ['crown'];
    
    if(weaponTypes.indexOf(itemType) !== -1 || armorTypes.indexOf(itemType) !== -1 || headTypes.indexOf(itemType) !== -1){
      // Equip the item (server will send gearUpdate which triggers inventory refresh)
      socket.send(JSON.stringify({msg: 'equipItem', itemType: itemType}));
    } else {
      // For other items (consumables), use them
      socket.send(JSON.stringify({msg: 'useItem', itemType: itemType}));
      // Refresh inventory after consuming (no gearUpdate for consumables)
      setTimeout(function(){
        InventoryHandler.updateDisplay();
        if(characterPopup && characterPopup.style.display === 'block'){
          updateCharacterDisplay();
        }
      }, 100);
    }
  },

  /**
   * Show context menu for inventory item
   * @param {Event} e - Mouse event
   * @param {string} itemType - Type of item
   * @param {string} itemName - Name of item
   * @param {number} count - Item count
   */
  showContextMenu: function(e, itemType, itemName, count) {
    currentContextItem = {type: itemType, name: itemName, count: count};
    
    // Position and show context menu
    itemContextMenu.style.left = e.pageX + 'px';
    itemContextMenu.style.top = e.pageY + 'px';
    itemContextMenu.style.display = 'block';
    
    // Clear and rebuild context menu
    itemContextMenu.innerHTML = '';
    
    var rank = getItemRank(itemType);
    var weaponTypes = ['dague', 'rondel', 'misericorde', 'bastardsword', 'longsword', 'zweihander', 'morallta', 'bow', 'welshlongbow', 'knightlance', 'rusticlance', 'paladinlance', 'huntingknife'];
    var armorTypes = ['brigandine', 'lamellar', 'maille', 'hauberk', 'brynja', 'cuirass', 'steelplate', 'greenwichplate', 'gothicplate', 'clericrobe', 'monkcowl', 'blackcloak'];
    var headTypes = ['crown'];
    var consumableTypes = ['bread', 'meat', 'fish', 'lamb', 'boarmeat', 'venison', 'poachedfish', 'lambchop', 'boarshank', 'venisonloin', 'mead', 'saison', 'flanders', 'bieredegarde', 'bordeaux', 'bourgogne', 'chianti'];
    
    // Add appropriate action option
    if(weaponTypes.indexOf(itemType) !== -1 || armorTypes.indexOf(itemType) !== -1 || headTypes.indexOf(itemType) !== -1){
      var equipOption = document.createElement('div');
      equipOption.className = 'context-menu-item';
      equipOption.textContent = 'Equip';
      equipOption.onclick = function(){
        socket.send(JSON.stringify({msg: 'equipItem', itemType: itemType}));
        itemContextMenu.style.display = 'none';
        // Server will send gearUpdate which triggers refresh
      };
      itemContextMenu.appendChild(equipOption);
    } else if(consumableTypes.indexOf(itemType) !== -1){
      var useOption = document.createElement('div');
      useOption.className = 'context-menu-item';
      useOption.textContent = 'Use';
      useOption.onclick = function(){
        socket.send(JSON.stringify({msg: 'useItem', itemType: itemType}));
        itemContextMenu.style.display = 'none';
        // Refresh inventory after using consumable
        setTimeout(function(){
          InventoryHandler.updateDisplay();
        }, 100);
      };
      itemContextMenu.appendChild(useOption);
    }
    
    // Add drop option
    var dropOption = document.createElement('div');
    dropOption.className = 'context-menu-item';
    dropOption.textContent = 'Drop';
    dropOption.onclick = function(){
      itemContextMenu.style.display = 'none';
      if(count > 1){
        // Show quantity modal
        dropQuantityInput.value = 1;
        dropQuantityInput.max = count;
        dropQuantityModal.style.display = 'block';
      } else {
        // Drop single item immediately
        socket.send(JSON.stringify({msg: 'dropItem', itemType: itemType, quantity: 1}));
        // Refresh inventory
        setTimeout(function(){
          InventoryHandler.updateDisplay();
        }, 100);
      }
    };
    itemContextMenu.appendChild(dropOption);
    
    // Add cancel option
    var cancelOption = document.createElement('div');
    cancelOption.className = 'context-menu-item';
    cancelOption.textContent = 'Cancel';
    cancelOption.onclick = function(){
      itemContextMenu.style.display = 'none';
    };
    itemContextMenu.appendChild(cancelOption);
  }
};

