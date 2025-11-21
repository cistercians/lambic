Interact = function(id,loc){
  var player = Player.list[id];
  var socket = SOCKET_LIST[id];
  if(player.z == 0){
    var c = getCenter(loc[0],loc[1]);
    var b = getBuilding(c[0],c[1]);
    if(b){ // building
      var building = Building.list[b];
      var inv = player.inventory;
      
      // Check if building is built before allowing interaction
      if(!building.built){
        return; // Building is still under construction, no interaction allowed
      }
      
      if(building.type == 'mill'){
        // Open deposit UI for grain
        if(inv.grain > 0){
          socket.write(JSON.stringify({
            msg: 'openDeposit',
            buildingType: 'mill',
            buildingId: b,
            buildingOwner: building.owner,
            resources: {
              grain: inv.grain
            }
          }));
        } else {
          socket.write(JSON.stringify({msg:'addToChat', message: '<i>You have no grain to deposit.</i>'}));
        }
      } else if(building.type == 'lumbermill'){
        // Open deposit UI for wood
        if(inv.wood > 0){
          socket.write(JSON.stringify({
            msg: 'openDeposit',
            buildingType: 'lumbermill',
            buildingId: b,
            buildingOwner: building.owner,
            resources: {
              wood: inv.wood
            }
          }));
        } else {
          socket.write(JSON.stringify({msg:'addToChat', message: '<i>You have no wood to deposit.</i>'}));
        }
      } else if(building.type == 'mine'){
        // Open deposit UI for stone and ores
        var hasResources = inv.stone > 0 || inv.ironore > 0 || inv.silverore > 0 || inv.goldore > 0 || inv.diamond > 0;
        if(hasResources){
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
        } else {
          socket.write(JSON.stringify({msg:'addToChat', message: '<i>You have no stone or ore to deposit.</i>'}));
        }
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
          // Get player resources
          var playerWood = 0;
          if(player.house){
            playerWood = House.list[player.house].stores.wood || 0;
          } else {
            playerWood = player.stores.wood || 0;
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
          
          // Check stored ships at this dock
          if(building.storedShips){
            for(var i in building.storedShips){
              var storedShip = building.storedShips[i];
              if(storedShip.owner == id){
                ownedShips.push({
                  id: storedShip.shipId,
                  type: storedShip.shipType,
                  name: storedShip.shipType === 'fishingship' ? '🐟 Fishing Ship' : storedShip.shipType,
                  inventory: storedShip.cargo || {},
                  storedPlayer: null,
                  isStored: true
                });
              }
            }
          }
          
          // Check active ships that are docked/anchored at this location
          var loc = getLoc(building.x, building.y);
          for(var shipId in Player.list){
            var ship = Player.list[shipId];
            if(ship.shipType && ship.owner == id && !ship.toRemove){
              var shipLoc = getLoc(ship.x, ship.y);
              // Check if ship is within 2 tiles of this dock and in docked/anchored mode
              var distX = Math.abs(shipLoc[0] - loc[0]);
              var distY = Math.abs(shipLoc[1] - loc[1]);
              if((distX <= 2 && distY <= 2) && (ship.mode === 'docked' || ship.mode === 'anchored')){
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<b><u>To establish a House</u></b>:<br>/house <i>HouseName</i>'}));
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>This is not your Garrison.</i>'}));
          }
        }
      }
    }
  }
}

