Interact = function(id,loc){
  var player = Player.list[id];
  var socket = SOCKET_LIST[id];
  if(player.z == 0){
    var c = getCenter(loc[0],loc[1]);
    var b = getBuilding(c[0],c[1]);
    if(b){ // building
      var building = Building.list[b];
      var inv = player.inventory;
      if(building.type == 'mill'){
        if(inv.grain >= 3){
          Player.list[id].inventory.grain -= 3;
          var grainDeposited = 2;
          if(Player.list[building.owner].house){
            var house = Player.list[building.owner].house;
            House.list[house].stores.grain += grainDeposited;
          } else {
            Player.list[building.owner].stores.grain += grainDeposited;
          }
          // Track daily deposits
          if(!building.dailyStores) building.dailyStores = {grain: 0};
          building.dailyStores.grain += grainDeposited;
          
          Player.list[id].inventory.flour++;
          
          // Show deposit feedback
          var message = '<i>Deposited <b>' + grainDeposited + ' Grain</b>';
          if(building.owner === id){
            // Only show building total to owner
            var totalGrain = Player.list[building.owner].house ? 
              House.list[Player.list[building.owner].house].stores.grain : 
              Player.list[building.owner].stores.grain;
            message += '. Building total: <b>' + totalGrain + ' Grain</b>';
          }
          message += '</i>';
          socket.write(JSON.stringify({msg:'addToChat',message: message}));
        }
      } else if(building.type == 'lumbermill'){
        if(inv.wood >= 3){
          var woodDeposited = (building.owner == id) ? 3 : 2;
          if(building.owner == id){
            Player.list[id].inventory.wood -= 3;
            if(player.house){
              House.list[player.house].stores.wood += 3;
            } else {
              Player.list[id].stores.wood += 3;
            }
          } else {
            Player.list[id].inventory.wood -= 2;
            if(Player.list[building.owner].house){
              var house = Player.list[building.owner].house;
              House.list[house].stores.wood += 2;
            } else {
              Player.list[building.owner].stores.wood += 2;
            }
          }
          // Track daily deposits
          if(!building.dailyStores) building.dailyStores = {wood: 0};
          building.dailyStores.wood += woodDeposited;
          
          // Show deposit feedback
          var message = '<i>Deposited <b>' + woodDeposited + ' Wood</b>';
          if(building.owner === id){
            // Only show building total to owner
            var totalWood = Player.list[building.owner].house ? 
              House.list[Player.list[building.owner].house].stores.wood : 
              Player.list[building.owner].stores.wood;
            message += '. Building total: <b>' + totalWood + ' Wood</b>';
          }
          message += '</i>';
          socket.write(JSON.stringify({msg:'addToChat',message: message}));
        }
      } else if(building.type == 'mine'){
        if(building.cave){
          // TODO: Handle iron ore deposits
        } else {
          if(inv.stone >= 3){
            var stoneDeposited = (building.owner == id) ? 3 : 2;
            if(building.owner == id){
              Player.list[id].inventory.stone -= 3;
              if(player.house){
                House.list[player.house].stores.stone += 3;
              } else {
                Player.list[id].stores.stone += 3;
              }
            } else {
              Player.list[id].inventory.stone -= 2;
              if(Player.list[building.owner].house){
                var house = Player.list[building.owner].house;
                House.list[house].stores.stone += 2;
              } else {
                Player.list[building.owner].stores.stone += 2;
              }
            }
            // Track daily deposits
            if(!building.dailyStores) building.dailyStores = {stone: 0, ironore: 0};
            building.dailyStores.stone += stoneDeposited;
            
            // Show deposit feedback
            var message = '<i>Deposited <b>' + stoneDeposited + ' Stone</b>';
            if(building.owner === id){
              // Only show building total to owner
              var totalStone = Player.list[building.owner].house ? 
                House.list[Player.list[building.owner].house].stores.stone : 
                Player.list[building.owner].stores.stone;
              message += '. Building total: <b>' + totalStone + ' Stone</b>';
            }
            message += '</i>';
            socket.write(JSON.stringify({msg:'addToChat',message: message}));
          }
        }
      } else if(building.type == 'stable'){
        if(building.horses > 0){

        }
      } else if(building.type == 'dock'){

      }
    } else { // item outside

    }
  } else { // item inside, in cave, in dungeon or underwater
    var item = getItem(player.z,loc[0],loc[1]);
    if(item == 'Anvil'){

    } else if(item == 'Goods1' || item == 'Goods2' || item == 'Goods3' || item == 'Goods4'){
      // Market goods on first floor (z=1) - display orderbook
      var c = getCenter(loc[0],loc[1]);
      var b = getBuilding(c[0],c[1]);
      var build = Building.list[b];
      if(build && build.type == 'market'){
        var message = '<b><u>📊 Market Orderbook</u></b><br>';
        message += '<i>Use /buy [amount] [item] [price] or /sell [amount] [item] [price]</i><br>';
        
        var hasOrders = false;
        
        // Display each resource's orderbook
        for(var resource in build.orderbook){
          var book = build.orderbook[resource];
          var emoji = build.resourceEmoji[resource] || '📦';
          
          if(book.bids.length > 0 || book.asks.length > 0){
            hasOrders = true;
            message += '<br><b>' + emoji + ' ' + resource.toUpperCase() + '</b>';
            
            // Show best 3 sell orders (asks) - sorted low to high
            if(book.asks.length > 0){
              message += '<br>&nbsp;&nbsp;<span style="color:#ff6666;">SELL:</span>';
              for(var i = 0; i < Math.min(3, book.asks.length); i++){
                var ask = book.asks[i];
                message += '<br>&nbsp;&nbsp;&nbsp;&nbsp;' + ask.amount + ' @ ' + ask.price + ' silver';
              }
            }
            
            // Show best 3 buy orders (bids) - sorted high to low
            if(book.bids.length > 0){
              message += '<br>&nbsp;&nbsp;<span style="color:#66ff66;">BUY:</span>';
              for(var i = 0; i < Math.min(3, book.bids.length); i++){
                var bid = book.bids[i];
                message += '<br>&nbsp;&nbsp;&nbsp;&nbsp;' + bid.amount + ' @ ' + bid.price + ' silver';
              }
            }
          }
        }
        
        if(!hasOrders){
          message += '<br><i>No active orders</i>';
        }
        
        message += '<br><br><i>Type /orders to see your orders</i>';
        socket.write(JSON.stringify({msg:'addToChat',message: message}));
      }
    } else if(item == 'Desk'){
      var c = getCenter(loc[0],loc[1]);
      var b = getBuilding(c[0],c[1]);
      var build = Building.list[b];
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

