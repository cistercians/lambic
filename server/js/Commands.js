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
      var walls = [];
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
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'farm',
              plot:plot,
              walls:walls,
              mats:null,
              req:null,
              hp:null
            });
          }
        },10000/self.strength);
      } else {
        socket.emit('addToChat','DM: You cannot build that there.');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'hut' && z === 0){
      var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
      var walls = [[c,r-2],[c+1,r-2]];
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
        for(i in walls){
          var n = walls[i];
          world[4][n[1]][n[0]] = 1;
        }
        io.emit('mapEdit',world);
        Building({
          owner:player.id,
          house:player.house,
          kingdom:player.kingdom,
          x:player.x,
          y:player.y,
          z:0,
          type:'hut',
          plot:plot,
          walls:walls,
          mats:{
            wood:30,
            stone:0
          },
          req:5,
          hp:150
        });
      } else {
        socket.emit('addToChat','DM: You cannot build that there.');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'house' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4){
          count++;
        }
      }
      if(count === 9){
        for(i in plot){
          var n = plot[i];
          world[0][n[1]][n[0]] = 11;
        }
        for(i in walls){
          var n = walls[i];
          world[4][n[1]][n[0]] = 2;
        }
        io.emit('mapEdit',world);
        Building({
          owner:player.id,
          house:player.house,
          kingdom:player.kingdom,
          x:player.x,
          y:player.y,
          z:0,
          type:'house',
          plot:plot,
          walls:walls,
          mats:{
            wood:25,
            stone:25
          },
          req:5,
          hp:300
        });
      } else {
        socket.emit('addToChat','DM: You cannot build that there.');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'wall w' && z === 0){
      var plot = [[c,r]];
      var walls = [];
      if(getTile(0,c,r) === 7){
        if(getTile(0,c,r-1) === 14 || getTile(c,r-1) === 16){
          socket.emit('addToChat','DM: You cannot build that there.');
        } else {
          world[0][r][c] = 11;
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'wwall',
            plot:plot,
            walls:walls,
            mats:{
              wood:10,
              stone:0
            },
            req:5,
            hp:200
          });
        }
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'wall s' && z === 0){
      var plot = [[c,r]];
      var walls = [];
      if(getTile(0,c,r) === 7 || getTile(0,c,r) === 4){
        if(getTile(0,c,r-1) === 14 || getTile(c,r-1) === 16){
          socket.emit('addToChat','DM: You cannot build that there.');
        } else {
          world[0][r][c] = 11;
          world[5][r][c] = 0;
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'swall',
            plot:plot,
            walls:walls,
            mats:{
              wood:0,
              stone:10
            },
            req:5,
            hp:500
          });
        }
      }
    }
  } else {
    socket.emit('addToChat','DM: Invalid command.');
  }
}
