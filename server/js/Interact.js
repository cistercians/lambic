Interact = function(id,loc){
  var player = Player.list[id];
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

      } else if(building.type == 'dock'){

      }
    } else { // item

    }
  } else {

  }
}
