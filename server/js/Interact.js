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
          if(Player.list[building.owner].house){
            var house = Player.list[building.owner].house;
            House.list[house].stores.grain += 2;
          } else {
            Player.list[building.owner].stores.grain += 2;
          }
          Player.list[id].inventory.flour++;
        }
      } else if(building.type == 'lumbermill'){
        if(inv.wood >= 3){
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
              House.list[house].stores.wood +=2;
            } else {
              Player.list[building.owner].stores.wood  += 2;
            }
          }
        }
      } else if(building.type == 'mine'){
        if(building.cave){

        } else {
          if(inv.stone >= 3){
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
                House.list[house].stores.stone +=2;
              } else {
                Player.list[building.owner].stores.stone  += 2;
              }
            }
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

    } else if(item == 'Desk'){
      var c = getCenter(loc[0],loc[1]);
      var b = getBuilding(c[0],c[1]);
      var build = Building.list[b];
      if(build.type == 'market'){ // access bank account

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
            socket.emit('addToChat','<b><u>To establish a House</u></b>:<br>/house <i>HouseName</i>');
          } else {
            socket.emit('addToChat','<i>This is not your Garrison.</i>');
          }
        }
      }
    }
  }
}
