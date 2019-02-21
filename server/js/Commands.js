EvalCmd = function(data){
  var socket = SOCKET_LIST[data.id];
  var player = Player.list[data.id];

  // BUILDING
  if(data.cmd[0] === 'b' && data.cmd[1] === ' '){
    var loc = getLoc(player.x,player.y);
    var z = player.z;
    var c = loc[0];
    var r = loc[1];
    // farm
    if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'farm' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7){
          count++;
        }
      }
      if(count === 9){
        player.working = true;
        setTimeout(function(){
          if(player.working){
            for(i in plot){
              var n = plot[i];
              world[0][n[1]][n[0]] = 8;
            }
            player.working = false;
            io.emit('mapEdit',world);
            Building({
              owner:player.id,
              x:player.x,
              y:player.y,
              z:0,
              type:'farm',
              dimension:tileSize*3,
              plot:plot,
              mats:null,
              req:null,
              hp:null
            });
          }
        },6000);
      } else {
        socket.emit('addToChat','DM: You cannot build that there.');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'hut' && z === 0){
      var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7){
          count++;
        }
      }
      if(count === 4){
        for(i in plot){
          var n = plot[i];
          world[0][n[1]][n[0]] = 11;
        }
        io.emit('mapEdit',world);
        Building({
          owner:player.id,
          x:player.x,
          y:player.y,
          z:0,
          type:'hut',
          dimension:tileSize*2,
          plot:plot,
          mats:{
            wood:30
          },
          req:5,
          hp:150
        });
      } else {
        socket.emit('addToChat','DM: You cannot build that there.');
      }
    }
  }
}
