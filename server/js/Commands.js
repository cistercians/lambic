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
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'farm',
              plot:plot,
              walls:null,
              topPlot:null,
              mats:null,
              req:null,
              hp:null
            });
          }
        },10000/self.strength);
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'hut' && z === 0){
      var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
      var walls = [[c,r-2],[c+1,r-2]];
      var perim = [[c,r-2],[c+1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r-1],[c+2,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7){
          count++;
        }
      }
      if(count === 4){
        count = 0;
        for(i in perim){
          var n = perim[i];
          if(getTile(0,n[0],n[1]) !== 11 &&
          getTile(0,n[0],n[1]) !== 12 &&
          getTile(0,n[0],n[1]) !== 13 &&
          getTile(0,n[0],n[1]) !== 14 &&
          getTile(0,n[0],n[1]) !== 15 &&
          getTile(0,n[0],n[1]) !== 16 &&
          getTile(0,n[0],n[1]) !== 17 &&
          getTile(0,n[0],n[1]) !== 19 &&
          getTile(5,n[0],n[1]) === 0){
            count++;
          }
        }
        if(count === 8){
          for(i in plot){
            var n = plot[i];
            world[0][n[1]][n[0]] = 11;
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
            topPlot:null,
            mats:{
              wood:30,
              stone:0
            },
            req:5,
            hp:150
          });
        } else {
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'house' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
      var perim = [[c,r-3],[c+1,r-3],[c+2,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]]
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4){
          count++;
        }
      }
      if(count === 9){
        count = 0;
        for(i in perim){
          var n = perim[i];
          if(getTile(0,n[0],n[1]) !== 11 &&
          getTile(0,n[0],n[1]) !== 12 &&
          getTile(0,n[0],n[1]) !== 13 &&
          getTile(0,n[0],n[1]) !== 14 &&
          getTile(0,n[0],n[1]) !== 15 &&
          getTile(0,n[0],n[1]) !== 16 &&
          getTile(0,n[0],n[1]) !== 17 &&
          getTile(0,n[0],n[1]) !== 19 &&
          getTile(5,n[0],n[1]) === 0){
            count++;
          }
        }
        if(count === 12){
          for(i in plot){
            var n = plot[i];
            world[0][n[1]][n[0]] = 11;
            world[6][n[1]][n[0]] = 0;
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
            topPlot:null,
            mats:{
              wood:25,
              stone:25
            },
            req:5,
            hp:300
          });
        } else {
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'fort' && z === 0){
      var plot = [[c,r]];
      if(getTile(0,c,r) === 7){
        if(getTile(0,c,r-1) === 14 || getTile(c,r-1) === 16){
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
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
            type:'fort',
            plot:plot,
            walls:null,
            topPlot:null,
            mats:{
              wood:10,
              stone:0
            },
            req:5,
            hp:200
          });
        }
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'wall' && z === 0){
      var plot = [[c,r]];
      if(getTile(0,c,r) === 7 || getTile(0,c,r) === 4){
        if(getTile(0,c,r-1) === 14 || getTile(c,r-1) === 16 || getTile(c,r-1) === 19){
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        } else {
          world[0][r][c] = 11;
          world[6][r][c] = 0;
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'wall',
            plot:plot,
            walls:null,
            topPlot:null,
            mats:{
              wood:0,
              stone:10
            },
            req:5,
            hp:400
          });
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'outpost' && z === 0){
      var plot = [[c,r]];
      var topPlot = [[c,r-1]];
      if(getTile(0,c,r) === 7){
        if(getTile(0,c,r-1) === 14 || getTile(0,c,r-1) === 16 || getTile(0,c,r-1) === 19 || getTile(5,c,r-1) !== 0){
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
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
            type:'outpost',
            plot:plot,
            walls:null,
            topPlot:topPlot,
            mats:{
              wood:40,
              stone:0
            },
            req:5,
            hp:150
          });
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'gtower' && z === 0){
      var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
      var topPlot = [[c,r-2],[c+1,r-2]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,c,r) === 7 || getTile(0,c,r) === 4){
          count++;
        }
      }
      if(count === 4){
        if(getTile(0,c,r-2) === 14 || getTile(0,c,r-2) === 16 || getTile(0,c,r-2) === 19 || getTile(5,c,r-2) !== 0 || getTile(0,c+1,r-2) === 14 || getTile(0,c+1,r-2) === 16 || getTile(0,c+1,r-2) === 19 || getTile(5,c+1,r-2) !== 0){
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        } else {
          for(i in plot){
            var n = plot[i];
            world[0][n[1]][n[0]] = 11;
            world[6][n[1]][n[0]] = 0;
          }
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'gtower',
            plot:plot,
            walls:null,
            topPlot:topPlot,
            mats:{
              wood:0,
              stone:50
            },
            req:5,
            hp:500
          });
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'tower' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
      var topPlot = [[c,r-3],[c+1,r-3],[c+2,r-3],[c,r-4],[c+1,r-4],[c+2,r-4]];
      var perim = [[c,r-3],[c+1,r-3],[c+2,r-3],[c,r-4],[c+1,r-4],[c+2,r-4],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]]
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 5){
          count++;
        }
      }
      if(count === 9){
        count = 0;
        for(i in perim){
          var n = perim[i];
          if(getTile(0,n[0],n[1]) !== 11 &&
          getTile(0,n[0],n[1]) !== 12 &&
          getTile(0,n[0],n[1]) !== 13 &&
          getTile(0,n[0],n[1]) !== 14 &&
          getTile(0,n[0],n[1]) !== 15 &&
          getTile(0,n[0],n[1]) !== 16 &&
          getTile(0,n[0],n[1]) !== 17 &&
          getTile(0,n[0],n[1]) !== 19 &&
          getTile(5,n[0],n[1]) === 0){
            count++;
          }
        }
        if(count === 15){
          for(i in plot){
            var n = plot[i];
            world[0][n[1]][n[0]] = 11;
            world[6][n[1]][n[0]] = 0;
          }
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'tower',
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:25,
              stone:125
            },
            req:10,
            hp:1000
          });
        } else {
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    }
  } else {
    socket.emit('addToChat','<b>DM: Invalid command.</b>');
  }
}
