Interact = function(id,loc){
  var player = Player.list[id];
  var socket = SOCKET_LIST[id];
  if(player.z == 0){
    var c = getCenter(loc[0],loc[1]);
    var b = getBuilding(c[0],c[1]);
    // If building not found via getBuilding, try interactability map
    if(!b && typeof global.getInteractableBuilding === 'function'){
      b = global.getInteractableBuilding(0, c[0], c[1]);
    }
    if(b){ // building
      var building = Building.list[b];
      var inv = player.inventory;
      
      // Check if building is built before allowing interaction
      if(!building.built){
        return; // Building is still under construction, no interaction allowed
      }
      
      if(building.type == 'mill'){
        // Open deposit UI for grain (always open UI, like docks)
        socket.write(JSON.stringify({
          msg: 'openDeposit',
          buildingType: 'mill',
          buildingId: b,
          buildingOwner: building.owner,
          resources: {
            grain: inv.grain || 0
          }
        }));
      } else if(building.type == 'lumbermill'){
        // Open deposit UI for wood (always open UI, like docks)
        socket.write(JSON.stringify({
          msg: 'openDeposit',
          buildingType: 'lumbermill',
          buildingId: b,
          buildingOwner: building.owner,
          resources: {
            wood: inv.wood || 0
          }
        }));
      } else if(building.type == 'mine'){
        // Open deposit UI for stone and ores (always open UI, like docks)
        socket.write(JSON.stringify({
          msg: 'openDeposit',
          buildingType: 'mine',
          buildingId: b,
          buildingOwner: building.owner,
          resources: {
            stone: inv.stone || 0,
            ironore: inv.ironore || 0,
            silverore: inv.silverore || 0,
            goldore: inv.goldore || 0,
            diamond: inv.diamond || 0
          }
        }));
      } else if(building.type == 'stable'){
        if(building.horses > 0){

        }
      } else if(building.type == 'dock'){
        // Dock interaction menu
        // Allow access to neutral players or friendly factions (not just owner)
        var canAccess = true;
        
        // Check if player is hostile to dock owner
        if(building.owner && building.owner !== id){
          var dockOwner = Player.list[building.owner];
          if(dockOwner){
            // Check if hostile (enemies list)
            if(player.enemies && player.enemies.indexOf(building.owner) !== -1){
              canAccess = false;
            }
            if(dockOwner.enemies && dockOwner.enemies.indexOf(id) !== -1){
              canAccess = false;
            }
          }
        }
        
        // Check faction hostility
        if(building.house && player.house && building.house !== player.house){
          // Different houses - check if hostile
          if(player.enemies && player.enemies.indexOf(building.house) !== -1){
            canAccess = false;
          }
        }
        
        if(canAccess){
          // Get player resources (check inventory first, then stores - matching building construction)
          var playerWood = (player.inventory.wood || 0) + (player.stores.wood || 0);
          if(player.house){
            playerWood += (House.list[player.house].stores.wood || 0);
          }
          
          // Available ships to build
          var availableShips = [
            {
              type: 'fishingship',
              name: '🐟 Fishing Ship',
              cost: {wood: 150},
              description: 'A small vessel for catching fish. Press F to fish while at sea.',
              canAfford: playerWood >= 150
            }
          ];
          
          // Find owned ships at THIS dock (FishingShip entities owned by this player)
          var ownedShips = [];
          
          // Check stored ships at this dock (de-spawned ships that are still visible in UI)
          if(building.storedShips){
            for(var i in building.storedShips){
              var storedShip = building.storedShips[i];
              if(storedShip.owner == id){
                ownedShips.push({
                  id: storedShip.shipId,
                  type: storedShip.shipType,
                  name: storedShip.shipType === 'fishingship' ? '🐟 Fishing Ship' : storedShip.shipType,
                  inventory: storedShip.inventory || storedShip.cargo || {},
                  storedPlayer: null,
                  isStored: true
                });
              }
            }
          }
          
          // Check active ships that are docked/anchored at this dock (not yet de-spawned)
          // Also check if ship is already stored to avoid duplicates
          for(var shipId in Player.list){
            var ship = Player.list[shipId];
            if(ship.shipType && ship.owner == id && !ship.toRemove && (ship.mode === 'docked' || ship.mode === 'anchored')){
              // Skip if this ship is already in storedShips (shouldn't happen, but safety check)
              var isAlreadyStored = false;
              if(building.storedShips){
                for(var j = 0; j < building.storedShips.length; j++){
                  if(building.storedShips[j].shipId == shipId){
                    isAlreadyStored = true;
                    break;
                  }
                }
              }
              if(isAlreadyStored) continue;
              
              // Check if ship's lastDock matches this dock OR if ship is near any dock plot tile
              var isAtThisDock = false;
              
              // First check: ship's lastDock matches this dock
              if(ship.lastDock === b || ship.dock === b){
                isAtThisDock = true;
              }
              
              // Second check: ship is within 3 tiles of any dock plot tile
              if(!isAtThisDock && building.plot){
                var shipLoc = getLoc(ship.x, ship.y);
                for(var p = 0; p < building.plot.length; p++){
                  var plotTile = building.plot[p];
                  var distX = Math.abs(shipLoc[0] - plotTile[0]);
                  var distY = Math.abs(shipLoc[1] - plotTile[1]);
                  if(distX <= 3 && distY <= 3){
                    isAtThisDock = true;
                    break;
                  }
                }
              }
              
              if(isAtThisDock){
                ownedShips.push({
                  id: shipId,
                  type: ship.shipType,
                  name: ship.shipType === 'fishingship' ? '🐟 Fishing Ship' : ship.name,
                  inventory: ship.inventory || {},
                  storedPlayer: ship.storedPlayer || null,
                  isStored: false
                });
              }
            }
          }
          
          // Find cargo ships at this dock (available for boarding)
          // Check ALL cargo ships to see if any are currently at THIS dock
          var cargoShips = [];
          for(var shipId in Player.list){
            var ship = Player.list[shipId];
            if(ship.shipType === 'cargoship' && ship.currentDock === b && (ship.mode === 'waiting' || ship.mode === 'docked')){
              // Get destination name
              var destinationName = 'Unknown';
              if(ship.targetDock && Building.list[ship.targetDock]){
                var targetDock = Building.list[ship.targetDock];
                destinationName = targetDock.zoneName || targetDock.name || 'Unknown';
              }
              
              var timeRemaining = Math.ceil(ship.waitTimer / 60);
              cargoShips.push({
                id: ship.id,
                destination: destinationName,
                passengerCount: ship.passengers.length,
                maxPassengers: ship.maxPassengers,
                departureTime: timeRemaining
              });
            }
          }
          
          // Send openDock message to client
          socket.write(JSON.stringify({
            msg: 'openDock',
            dockId: b,
            dockName: building.zoneName || building.name || 'Dock',
            availableShips: availableShips,
            ownedShips: ownedShips,
            cargoShips: cargoShips,
            playerResources: {wood: playerWood}
          }));
        } else {
          socket.write(JSON.stringify({msg:'addToChat', message: '<i>You cannot use this dock - the owner is hostile to you.</i>'}));
        }
      }
    } else { // item outside
      // Check for chests on overworld
      var chest = null;
      var c = getCenter(loc[0],loc[1]);
      var chestLoc = getLoc(c[0], c[1]);
      
      // Find chest at this location
      for(var itemId in Item.list){
        var item = Item.list[itemId];
        if(item && item.z === player.z && (item.type === 'Chest' || item.type === 'LockedChest')){
          var itemLoc = getLoc(item.x, item.y);
          if(itemLoc[0] === chestLoc[0] && itemLoc[1] === chestLoc[1]){
            chest = item;
            break;
          }
        }
      }
      
      if(chest){
        // Check if locked chest and player has key
        if(chest.type === 'LockedChest'){
          var hasKey = false;
          if(player.inventory && player.inventory.keyRing){
            for(var k in player.inventory.keyRing){
              var key = player.inventory.keyRing[k];
              if(key && (key.id === chest.id || key === chest.id)){
                hasKey = true;
                break;
              }
            }
          }
          
          if(!hasKey){
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: '<i>This chest is locked. You need a key to open it.</i>'
            }));
            return;
          }
        }
        
        // Open chest inventory window
        socket.write(JSON.stringify({
          msg: 'openChest',
          chestId: chest.id,
          chestType: chest.type,
          inventory: chest.inventory || {},
          playerInventory: player.inventory || {}
        }));
      }
    }
  } else { // item inside, in cave, in dungeon or underwater
    var item = getItem(player.z,loc[0],loc[1]);
    if(item == 'Anvil'){

    } else if(item == 'Goods1' || item == 'Goods2' || item == 'Goods3' || item == 'Goods4'){
      // Market goods on first floor (z=1) - open market UI
      var b = getBuilding(player.x, player.y);
      var build = Building.list[b];
      if(build && build.type == 'market' && build.built){
        // Send market data to client to open UI
        var playerOrders = [];
        for(var resource in build.orderbook){
          var book = build.orderbook[resource];
          
          // Collect player's buy orders
          for(var i in book.bids){
            if(book.bids[i].player === id){
              playerOrders.push({
                type: 'buy',
                resource: resource,
                amount: book.bids[i].amount,
                price: book.bids[i].price,
                orderId: book.bids[i].orderId
              });
            }
          }
          
          // Collect player's sell orders
          for(var i in book.asks){
            if(book.asks[i].player === id){
              playerOrders.push({
                type: 'sell',
                resource: resource,
                amount: book.asks[i].amount,
                price: book.asks[i].price,
                orderId: book.asks[i].orderId
              });
            }
          }
        }
        
        socket.write(JSON.stringify({
          msg: 'openMarket',
          marketId: b,
          orderbook: build.orderbook,
          playerOrders: playerOrders
        }));
        
        // Also send chat message for now (backward compatibility)
        var message = '<b><u>📊 MARKET ORDERBOOK</u></b><br>';
        message += '<i style="color:#aaaaaa;">Quick price check: type <b>$itemname</b> (e.g. $grain, $wood)</i><br>';
        message += '<i style="color:#aaaaaa;">Place orders: <b>/buy [amt] [item] [price]</b> or <b>/sell [amt] [item] [price]</b></i><br>';
        
        var hasOrders = false;
        var resources = [];
        
        // Collect all resources with orders
        for(var resource in build.orderbook){
          var book = build.orderbook[resource];
          if(book.bids.length > 0 || book.asks.length > 0){
            resources.push(resource);
          }
        }
        
        // Sort resources alphabetically for consistent display
        resources.sort();
        
        for(var r in resources){
          var resource = resources[r];
          var book = build.orderbook[resource];
          var emoji = build.getItemEmoji ? build.getItemEmoji(resource) : (build.resourceEmoji[resource] || '📦');
          
          hasOrders = true;
          message += '<br><b>' + emoji + ' ' + resource.toUpperCase() + '</b>';
          
          // Sort and show best 3 sell orders (asks) - LOW TO HIGH
          if(book.asks.length > 0){
            book.asks.sort(function(a, b){ return a.price - b.price; });
            message += '<br>&nbsp;&nbsp;<span style="color:#ff6666;">SELL (Ask):</span>';
            for(var i = 0; i < Math.min(3, book.asks.length); i++){
              var ask = book.asks[i];
              message += '<br>&nbsp;&nbsp;&nbsp;&nbsp;' + ask.amount + ' @ <b>' + ask.price + ' silver</b>';
            }
            if(book.asks.length > 3){
              message += '<br>&nbsp;&nbsp;&nbsp;&nbsp;<i>... +' + (book.asks.length - 3) + ' more</i>';
            }
          }
          
          // Sort and show best 3 buy orders (bids) - HIGH TO LOW
          if(book.bids.length > 0){
            book.bids.sort(function(a, b){ return b.price - a.price; });
            message += '<br>&nbsp;&nbsp;<span style="color:#66ff66;">BUY (Bid):</span>';
            for(var i = 0; i < Math.min(3, book.bids.length); i++){
              var bid = book.bids[i];
              message += '<br>&nbsp;&nbsp;&nbsp;&nbsp;' + bid.amount + ' @ <b>' + bid.price + ' silver</b>';
            }
            if(book.bids.length > 3){
              message += '<br>&nbsp;&nbsp;&nbsp;&nbsp;<i>... +' + (book.bids.length - 3) + ' more</i>';
            }
          }
        }
        
        if(!hasOrders){
          message += '<br><i>📭 No active orders in this market</i>';
          message += '<br><br><b>Be the first to trade!</b>';
          message += '<br>Example: <b>/sell 100 grain 5</b> (sell 100 grain at 5 silver each)';
          message += '<br>Example: <b>/buy 50 wood 8</b> (buy 50 wood at 8 silver each)';
        }
        
        message += '<br><br><i>📋 Commands:</i>';
        message += '<br><b>/orders</b> - View your active orders';
        message += '<br><b>/cancel [orderID]</b> - Cancel an order';
        message += '<br><b>$[item]</b> - Quick price check (e.g. $grain)';
        
        socket.write(JSON.stringify({msg:'addToChat',message: message}));
      }
    } else if(item == 'Desk'){
      var c = getCenter(loc[0],loc[1]);
      var b = getBuilding(c[0],c[1]);
      var build = Building.list[b];
      if(!build || !build.built){
        return; // Building is still under construction, no interaction allowed
      }
      if(build.type == 'market'){ // Desks upstairs (z=2) - different purpose (banking, etc)
        // TODO: Implement banking/account management
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Market account management - coming soon</i>'}));
      } else if(build.type == 'garrison'){
        if(build.house){
          if(player.house){
            if(player.house == build.house && player.rank){
              // access military report
            }
          } else {
            // request to join house
          }
        } else { // create house
          if(build.owner == id){
            // Send openHouseCreation message with available flags
            var availableFlags = typeof getAvailableFlagsForUI === 'function' ? getAvailableFlagsForUI() : [];
            socket.write(JSON.stringify({
              msg: 'openHouseCreation',
              availableFlags: availableFlags,
              buildingId: b
            }));
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>This is not your Garrison.</i>'}));
          }
        }
      }
    }
    
    // Check for chests on all z-levels (inside buildings, caves, etc.)
    var chest = null;
    var chestLoc = loc;
    
    // Find chest at this location
    for(var itemId in Item.list){
      var item = Item.list[itemId];
      if(item && item.z === player.z && (item.type === 'Chest' || item.type === 'LockedChest')){
        var itemLoc = getLoc(item.x, item.y);
        if(itemLoc[0] === chestLoc[0] && itemLoc[1] === chestLoc[1]){
          chest = item;
          break;
        }
      }
    }
    
    if(chest){
      // Check if locked chest and player has key
      if(chest.type === 'LockedChest'){
        var hasKey = false;
        if(player.inventory && player.inventory.keyRing){
          for(var k in player.inventory.keyRing){
            var key = player.inventory.keyRing[k];
            if(key && (key.id === chest.id || key === chest.id)){
              hasKey = true;
              break;
            }
          }
        }
        
        if(!hasKey){
          socket.write(JSON.stringify({
            msg: 'addToChat',
            message: '<i>This chest is locked. You need a key to open it.</i>'
          }));
          return;
        }
      }
      
      // Open chest inventory window
      socket.write(JSON.stringify({
        msg: 'openChest',
        chestId: chest.id,
        chestType: chest.type,
        inventory: chest.inventory || {},
        playerInventory: player.inventory || {}
      }));
    }
  }
}

