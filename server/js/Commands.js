EvalCmd = function(data){
  var socket = SOCKET_LIST[data.id];
  var player = Player.list[data.id];
  var loc = getLoc(player.x,player.y);
  var z = player.z;
  var c = loc[0];
  var r = loc[1];

  // BUILDING
  if(data.cmd === 'build'){
    socket.emit('addToChat','<i>List all buildings here.</i>');
  } else if(data.cmd.slice(0,5) === 'build' && data.cmd[5] === ' '){
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
        },10000/player.strength);
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'mill' && z === 0){
      var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
      var topPlot = [[c,r-2],[c+1,r-2]];
      var perim = [[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r-2],[c+2,r-1],[c+2,r],[c,r-3],[c+1,r-3]];
      count = 0;
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
        if(count === 10){
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
            type:'mill',
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
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
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
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'house' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
      var perim = [[c,r-3],[c+1,r-3],[c+2,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]]
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 5) || getTile(0,n[0],n[1]) === 18){
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
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'fort' && z === 0){
      var plot = [[c,r]];
      if(getTile(0,c,r) === 7 || getTile(0,c,r) === 18){
        if(getTile(0,c,r-1) === 14 || getTile(c,r-1) === 16){
          socket.emit('addToChat','<i>You cannot build that there.</i>');
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
      if(getTile(0,c,r) === 7 || (getTile(0,c,r) >= 4 && getTile(0,c,r) < 6) || getTile(0,c,r) === 18){
        if(getTile(0,c,r-1) === 14 || getTile(c,r-1) === 16 || getTile(c,r-1) === 19){
          socket.emit('addToChat','<i>You cannot build that there.</i>');
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
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'outpost' && z === 0){
      var plot = [[c,r]];
      var topPlot = [[c,r-1]];
      if(getTile(0,c,r) === 7){
        if(getTile(0,c,r-1) === 14 || getTile(0,c,r-1) === 16 || getTile(0,c,r-1) === 19 || getTile(5,c,r-1) !== 0){
          socket.emit('addToChat','<i>You cannot build that there.</i>');
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
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'guardtower' && z === 0){
      var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
      var topPlot = [[c,r-2],[c+1,r-2]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,c,r) === 7 || (getTile(0,c,r) >= 4 && getTile(0,c,r) < 6)){
          count++;
        }
      }
      if(count === 4){
        if(getTile(0,c,r-2) === 14 || getTile(0,c,r-2) === 16 || getTile(0,c,r-2) === 19 || getTile(5,c,r-2) !== 0 || getTile(0,c+1,r-2) === 14 || getTile(0,c+1,r-2) === 16 || getTile(0,c+1,r-2) === 19 || getTile(5,c+1,r-2) !== 0){
          socket.emit('addToChat','<i>You cannot build that there.</i>');
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
            type:'guardtower',
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
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'tower' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
      var topPlot = [[c,r-3],[c+1,r-3],[c+2,r-3],[c,r-4],[c+1,r-4],[c+2,r-4]];
      var perim = [[c,r-3],[c+1,r-3],[c+2,r-3],[c,r-4],[c+1,r-4],[c+2,r-4],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]]
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) === 18){
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
            hp:2000
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'tavern' && z === 0){
      var plot = [[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+4,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],[c+4,r-2],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var walls = [[c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-3]];
      var topPlot = [[c+1,r-4],[c+2,r-4],[c+3,r-4]];
      var perim = [[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c,r],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r],[c+4,r-3],[c+5,r-3],[c+5,r-2],[c+5,r-1]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 17){
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
        if(count === 16){
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
            type:'tavern',
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:125,
              stone:0
            },
            req:10,
            hp:750
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'monastery' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],[c,r-3],[c+1,r-3]];
      var walls = [[c+2,r-3],[c+3,r-3],[c,r-4],[c+1,r-4]];
      var topPlot = [[c+2,r-3],[c,r-4],[c+1,r-4]];
      var perim = [[c,r-4],[c+1,r-4],[c+2,r-3],[c+2,r-4],[c+3,r-3],[c-1,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 14){
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
        if(count === 18){
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
            type:'monastery',
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:0,
              stone:125
            },
            req:10,
            hp:1000
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'market' && z === 0){
      var plot = [[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+4,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
      var walls = [[c+4,r-2],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var topPlot = [[c+4,r-2],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var perim = [[c,r-4],[c+1,r-4],[c+2,r-3],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r],[c+4,r-3],[c+5,r-2],[c+5,r-1]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 12){
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
        if(count === 18){
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
            type:'market',
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:125,
              stone:0
            },
            req:10,
            hp:750
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'stable' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1]];
      var topPlot = [[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
      var perim = [[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r-2],[c+4,r-1],[c+4,r],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 8){
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
        if(count === 14){
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
            type:'stable',
            plot:plot,
            walls:null,
            topPlot:topPlot,
            mats:{
              wood:100,
              stone:0
            },
            req:5,
            hp:500
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'dock' && z === 0){
      var plot = [];
      var topPlot = [];
      var perim = [];
      if(player.facing === 'up' && getTile(0,c,r-1) === 0 && getTile(0,c,r-3) === 0){
        plot = [[c-1,r],[c,r],[c+1,r],[c-1,r-1],[c,r-1],[c+1,r-1]];
        topPlot = [[c-1,r-2],[c,r-2],[c+1,r-2]];
        perim = [[c-2,r-3],[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],[c-2,r-2],[c-2,r-1],[c-2,r],[c-2,r+1],[c-1,r+1],[c,r+1],[c+1,r+1],[c+2,r+1],[c+2,r-2],[c+2,r-1],[c+2,r]];
      } else if(player.facing === 'left' && getTile(0,c-1,r) === 0 && getTile(0,c-3,r) === 0){
        plot = [[c-2,r],[c-1,r],[c,r],[c-2,r-1],[c-1,r-1],[c,r-1]];
        topPlot = [[c-2,r-2],[c-1,r-2],[c,r-2]];
        perim = [[c-3,r-3],[c-2,r-3],[c-1,r-3],[c,r-3],[c+1,r-3],[c-3,r-2],[c-3,r-1],[c-3,r],[c-3,r+1],[c-2,r+1],[c-1,r+1],[c,r+1],[c+1,r+1],[c+1,r-2],[c+1,r-1],[c+1,r]];
      } else if(player.facing === 'right' && getTile(0,c+1,r) === 0 && getTile(0,c+3,r) === 0){
        plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1]];
        topPlot = [[c,r-2],[c+1,r-2],[c+2,r-2]];
        perim = [[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r+1],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]];
      } else if(player.facing === 'down' && getTile(0,c,r+1) === 0 && getTile(0,c,r+2) === 0){
        plot = [[c-1,r+1],[c,r+1],[c+1,r+1],[c-1,r],[c,r],[c+1,r]];
        topPlot = [[c-1,r-1],[c,r-1],[c+1,r-1]];
        perim = [[c-2,r-2],[c-1,r-2],[c,r-2],[c+1,r-2],[c+2,r-2],[c-2,r-1],[c-2,r],[c-2,r+1],[c-2,r+2],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2],[c+2,r-1],[c+2,r],[c+2,r-1]];
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 0 || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 6){
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
        if(count === 16){
          for(i in plot){
            var n = plot[i];
            world[0][n[1]][n[0]] = 11.5;
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
            type:'dock',
            plot:plot,
            walls:null,
            topPlot:topPlot,
            mats:{
              wood:100,
              stone:0
            },
            req:5,
            hp:750
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'garrison' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var topPlot = [[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var perim = [[c-1,r-4],[c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r+1],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 12){
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
        if(count === 20){
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
            type:'garrison',
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:75,
              stone:75
            },
            req:10,
            hp:1000
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'blacksmith' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1]];
      var walls = [[c,r-2],[c+1,r-2],[c+2,r-2]];
      var perim = [[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+3,r-2],[c+3,r-1],[c+3,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 6){
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
        if(count === 16){
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
            type:'blacksmith',
            plot:plot,
            walls:walls,
            topPlot:null,
            mats:{
              wood:25,
              stone:25
            },
            req:5,
            hp:500
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'gate' && z === 0){
      var plot = [[c,r],[c+1,r]];
      var sides = [[c-1,r],[c+2,r]];
      if(getTile(3,sides[0][0],sides[0][1]) === 'wall' && getTile(3,sides[1][0],sides[1][1]) === 'wall'){
        var count = 0;
        for(i in plot){
          var n = plot[i];
          if((getTile(0,n[0],n[1]) === 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) === 18) && getTile(5,n[0],n[1]-1) === 0){
            count++;
          }
        }
        if(count === 2){
          for(i in plot){
            world[5][plot[i][1]][plot[i][0]] = String('gateo');
          }
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'gate',
            plot:plot,
            walls:null,
            topPlot:null,
            mats:{
              wood:0,
              stone:25
            },
            req:null,
            hp:null
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'road' && z === 0){
      if(getTile(0,c,r) === 7 || (getTile(0,c,r) >= 4 && getTile(0,c,r) < 6)){
        player.working = true;
        player.actionCooldown = 10;
        setTimeout(function(){
          if(player.working){
            world[0][r][c] = 18;
            world[6][r][c] = 0;
            player.working = false;
            io.emit('mapEdit',world);
          } else {
            return;
          }
        },10000/player.strength);
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'stronghold' && z === 0){
      var plot = [[c+2,r],[c+3,r],[c+4,r],[c+5,r],
      [c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+4,r-1],[c+5,r-1],[c+6,r-1],[c+7,r-1],
    [c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],[c+4,r-2],[c+5,r-2],[c+6,r-2],[c+7,r-2],
    [c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3],[c+4,r-3],[c+5,r-3],[c+6,r-3],[c+7,r-3],
    [c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c+5,r-4],[c+6,r-4],[c+7,r-4],
    [c,r-5],[c+1,r-5],[c+2,r-5],[c+3,r-5],[c+4,r-5],[c+5,r-5],[c+6,r-5],[c+7,r-5],
    [c+1,r-6],[c+2,r-6],[c+3,r-6],[c+4,r-6],[c+5,r-6],[c+6,r-6],[c+7,r-6],
    [c+1,r-7],[c+2,r-7],[c+3,r-7],[c+4,r-7],[c+5,r-7],[c+6,r-7],[c+7,r-7]];
      var walls = [[c,r-6],[c+1,r-8],[c+2,r-8],[c+3,r-8],[c+4,r-8],[c+5,r-8],[c+6,r-8],[c+7,r-8]];
      var topPlot = [[c+1,r-8],[c+2,r-8],[c+3,r-8],[c+4,r-8],[c+6,r-8],[c+7,r-8],[c+2,r-9],[c+3,r-9],[c+4,r-9]];
      var perim = [[c-1,r-10],[c,r-10],[c+1,r-10],[c+2,r-10],[c+3,r-10],[c+4,r-10],[c+5,r-10],[c+6,r-10],[c+7,r-10],[c+8,r-10],
      [c-1,r-9],[c-1,r-8],[c-1,r-7],[c-1,r-6],[c-1,r-5],[c-1,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],
      [c,r],[c+1,r],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],[c+5,r+1],[c+6,r+1],[c+6,r],[c+7,r],[c+8,r],
      [c+8,r-9],[c+8,r-8],[c+8,r-7],[c+8,r-6],[c+8,r-5],[c+8,r-4],[c+8,r-3],[c+8,r-2],[c+8,r-1]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) === 18){
          count++;
        }
      }
      if(count === 58){
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
        if(count === 40){
          for(i in plot){
            var n = plot[i];
            world[0][n[1]][n[0]] = 11;
            //world[6][n[1]][n[0]] = 0; // ALPHA
          }
          io.emit('mapEdit',world);
          Building({
            owner:player.id,
            house:player.house,
            kingdom:player.kingdom,
            x:player.x,
            y:player.y,
            z:0,
            type:'stronghold',
            plot:plot,
            walls:walls,
            topPlot:topPlot,
            mats:{
              wood:0,
              stone:500
            },
            req:10,
            hp:4000
          });
        } else {
          socket.emit('addToChat','<i>You cannot build that there.</i>');
        }
      } else {
        socket.emit('addToChat','<i>You cannot build that there.</i>');
      }
    } else {
      socket.emit('addToChat','<i>Invalid command.</i>');
    }
  } else if(data.cmd === 'fire'){
    if(player.z !== -3){
      if(player.facing === 'left'){
        if((player.z === 1 || player.z === 2) && getTile(4,loc[0]-1,loc[1]) !== 0){
          socket.emit('addToChat','<i>You cannot place that there.</i>');
        } else {
          var p = getCoords(loc[0]-1,loc[1]);
          Campfire({
            parent:player.id,
            x:p[0],
            y:p[1],
            z:player.z,
            qty:1
          });
        }
      } else if(player.facing === 'right'){
        if((player.z === 1 || player.z === 2) && getTile(4,loc[0]+1,loc[1]) !== 0){
          socket.emit('addToChat','<i>You cannot place that there.</i>');
        } else {
          var p = getCoords(loc[0]+1,loc[1]);
          Campfire({
            parent:player.id,
            x:p[0],
            y:p[1],
            z:player.z,
            qty:1
          });
        }
      } else if(player.facing === 'up'){
        if((player.z === 1 || player.z === 2) && getTile(4,loc[0],loc[1]-1) !== 0){
          socket.emit('addToChat','<i>You cannot place that there.</i>');
        } else {
          var p = getCoords(loc[0],loc[1]-1);
          Campfire({
            parent:player.id,
            x:p[0],
            y:p[1],
            z:player.z,
            qty:1
          });
        }
      } else if(player.facing === 'down'){
        if((player.z === 1 || player.z === 2) && getTile(4,loc[0],loc[1]+1) !== 0){
          socket.emit('addToChat','<i>You cannot place that there.</i>');
        } else {
          var p = getCoords(loc[0],loc[1]+1);
          Campfire({
            parent:player.id,
            x:p[0],
            y:p[1],
            z:player.z,
            qty:1
          });
        }
      }
    } else {
      socket.emit('addToChat','<i>You cannot place that there.</i>');
    }
    // EQUIPPING
  } else if(data.cmd === 'equip'){
    socket.emit('addToChat','<i>List all equippable items here.</i>');
  } else if(data.cmd.slice(0,5) === 'equip' && data.cmd[5] === ' '){
    if(player.mode !== 'combat'){
      if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'huntingknife'){
        if(player.inventory.huntingknife > 0){
          if(!player.mounted && (!player.gear.armor || player.gear.armor.type === 'leather')){
            if(!player.gear.weapon){
              player.gear.weapon = equip.huntingknife;
              player.inventory.huntingknife--;
              socket.emit('addToChat','<i>You equipped a </i><b>HuntingKnife</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.huntingknife;
              player.inventory.huntingknife--;
              socket.emit('addToChat','<i>You equipped a </i><b>HuntingKnife </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be wearing leather armor and not be mounted.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>HuntingKnife</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'dague'){
        if(player.inventory.dague > 0){
          if(!player.mounted && (!player.gear.armor || player.gear.armor.type === 'leather')){
            if(!player.gear.weapon){
              player.gear.weapon = equip.dague;
              player.inventory.dague--;
              socket.emit('addToChat','<i>You equipped a </i><b>Dague</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.dague;
              player.inventory.dague--;
              socket.emit('addToChat','<i>You equipped a </i><b>Dague </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be wearing leather armor and not be mounted.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>Dague</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'rondel'){
        if(player.inventory.rondel > 0){
          if(!player.mounted && (!player.gear.armor || player.gear.armor.type === 'leather')){
            if(!player.gear.weapon){
              player.gear.weapon = equip.rondel;
              player.inventory.rondel--;
              socket.emit('addToChat','<i>You equipped a </i><b>Rondel</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.rondel;
              player.inventory.rondel--;
              socket.emit('addToChat','<i>You equipped a </i><b>Rondel </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be wearing leather armor and not be mounted.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>Rondel</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'misericorde'){
        if(player.inventory.misericorde > 0){
          if(!player.mounted && (!player.gear.armor || player.gear.armor.type === 'leather')){
            if(!player.gear.weapon){
              player.gear.weapon = equip.misericorde;
              player.inventory.misericorde--;
              socket.emit('addToChat','<i>You equipped </i><b>Misericorde</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.misericorde;
              player.inventory.misericorde--;
              socket.emit('addToChat','<i>You equipped </i><b>Misericorde </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be wearing leather armor and not be mounted.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Misericorde</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'bastardsword'){
        if(player.inventory.bastardsword > 0){
          if(!player.gear.armor || player.gear.armor.type !== 'cloth'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.bastardsword;
              player.inventory.bastardsword--;
              socket.emit('addToChat','<i>You equipped a </i><b>BastardSword</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.bastardsword;
              player.inventory.bastardsword--;
              socket.emit('addToChat','<i>You equipped a </i><b>BastardSword </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must not be wearing cloth.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>BastardSword</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'longsword'){
        if(player.inventory.longsword > 0){
          if(!player.gear.armor || player.gear.armor.type !== 'cloth'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.longsword;
              player.inventory.longsword--;
              socket.emit('addToChat','<i>You equipped a </i><b>Longsword</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.longsword;
              player.inventory.longsword--;
              socket.emit('addToChat','<i>You equipped a </i><b>Longsword </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must not be wearing cloth.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>Longsword</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'zweihander'){
        if(player.inventory.zweihander > 0){
          if(!player.gear.armor || player.gear.armor.type !== 'cloth'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.zweihander;
              player.inventory.zweihander--;
              socket.emit('addToChat','<i>You equipped a </i><b>Zweihander</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.zweihander;
              player.inventory.zweihander--;
              socket.emit('addToChat','<i>You equipped a </i><b>Zweihander </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must not be wearing cloth.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>Zweihander</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'morallta'){
        if(player.inventory.morallta > 0){
          if(!player.gear.armor || player.gear.armor.type !== 'cloth'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.morallta;
              player.inventory.morallta--;
              socket.emit('addToChat','<i>You equipped </i><b>Morallta</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.morallta;
              player.inventory.morallta--;
              socket.emit('addToChat','<i>You equipped </i><b>Morallta </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must not be wearing cloth.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Morallta</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'bow'){
        if(player.inventory.bow > 0){
          if(!player.gear.armor || (player.gear.armor.type !== 'cloth' && player.gear.armor.type !== 'plate')){
            if(!player.gear.weapon){
              player.gear.weapon = equip.bow;
              player.inventory.bow--;
              socket.emit('addToChat','<i>You equipped a </i><b>Bow</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.bow;
              player.inventory.bow--;
              socket.emit('addToChat','<i>You equipped a </i><b>Bow </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must not be wearing cloth or plate armor.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>Bow</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'welshlongbow'){
        if(player.inventory.welshlongbow > 0){
          if(!player.gear.armor || (player.gear.armor.type !== 'cloth' && player.gear.armor.type !== 'plate')){
            if(!player.gear.weapon){
              player.gear.weapon = equip.welshlongbow;
              player.inventory.welshlongbow--;
              socket.emit('addToChat','<i>You equipped a </i><b>WelshLongbow</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.welshlongbow;
              player.inventory.welshlongbow--;
              socket.emit('addToChat','<i>You equipped a </i><b>WelshLongbow </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must not be wearing cloth or plate armor.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>WelshLongbow</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'knightlance'){
        if(player.inventory.knightlance > 0){
          if(player.mounted && player.gear.armor.type === 'plate'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.knightlance;
              player.inventory.knightlance--;
              socket.emit('addToChat','<i>You equipped a </i><b>KnightLance</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.knightlance;
              player.inventory.knightlance--;
              socket.emit('addToChat','<i>You equipped a </i><b>KnightLance </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be mounted and wearing plate armor.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>KnightLance</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'rusticlance'){
        if(player.inventory.rusticlance > 0){
          if(player.mounted && player.gear.armor.type === 'plate'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.rusticlance;
              player.inventory.rusticlance--;
              socket.emit('addToChat','<i>You equipped a </i><b>RusticLance</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.rusticlance;
              player.inventory.rusticlance--;
              socket.emit('addToChat','<i>You equipped a </i><b>RusticLance </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be mounted and wearing plate armor.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>RusticLance</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'paladinlance'){
        if(player.inventory.paladinlance > 0){
          if(player.mounted && player.gear.armor.type === 'plate'){
            if(!player.gear.weapon){
              player.gear.weapon = equip.paladinlance;
              player.inventory.paladinlance--;
              socket.emit('addToChat','<i>You equipped a </i><b>PaladinLance</b>.');
            } else {
              if(player.gear.weapon2){
                player.gear.weapon2.unequip(player.id);
              }
              player.gear.weapon2 = equip.paladinlance;
              player.inventory.paladinlance--;
              socket.emit('addToChat','<i>You equipped a </i><b>PaladinLance </b><i>as your secondary weapon. Press X to switch.</i>');
            }
          } else {
            socket.emit('addToChat','<i>Must be mounted and wearing plate armor.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying a </i><b>PaladinLance</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'brigandine'){
        if(player.inventory.brigandine > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'lance' || player.gear.weapon2.type !== 'lance')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.brigandine;
            player.inventory.brigandine--;
            socket.emit('addToChat','<i>You equipped </i><b>Brigandine</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a lance equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Brigandine</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'lamellar'){
        if(player.inventory.lamellar > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'lance' || player.gear.weapon2.type !== 'lance')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.lamellar;
            player.inventory.lamellar--;
            socket.emit('addToChat','<i>You equipped </i><b>Lamellar</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a lance equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Lamellar</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'maille'){
        if(player.inventory.maille > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'lance' || player.gear.weapon2.type !== 'lance' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.maille;
            player.inventory.maille--;
            socket.emit('addToChat','<i>You equipped </i><b>Maille</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or lance equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Maille</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'hauberk'){
        if(player.inventory.hauberk > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'lance' || player.gear.weapon2.type !== 'lance' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.hauberk;
            player.inventory.hauberk--;
            socket.emit('addToChat','<i>You equipped </i><b>Hauberk</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or lance equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Hauberk</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'brynja'){
        if(player.inventory.brynja > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'lance' || player.gear.weapon2.type !== 'lance' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.brynja;
            player.inventory.brynja--;
            socket.emit('addToChat','<i>You equipped </i><b>Brynja</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or lance equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Brynja</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'cuirass'){
        if(player.inventory.cuirass > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'bow' || player.gear.weapon2.type !== 'bow' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.cuirass;
            player.inventory.cuirass--;
            socket.emit('addToChat','<i>You equipped </i><b>Cuirass</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or bow equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Cuirass</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'steelplate'){
        if(player.inventory.steelplate > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'bow' || player.gear.weapon2.type !== 'bow' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.steelplate;
            player.inventory.steelplate--;
            socket.emit('addToChat','<i>You equipped </i><b>SteelPlate</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or bow equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>SteelPlate</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'greenwichplate'){
        if(player.inventory.greenwichplate > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'bow' || player.gear.weapon2.type !== 'bow' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.greenwichplate;
            player.inventory.greenwichplate--;
            socket.emit('addToChat','<i>You equipped </i><b>GreenwichPlate</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or bow equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>GreenwichPlate</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'gothicplate'){
        if(player.inventory.gothicplate > 0){
          if(!player.gear.weapon || (player.gear.weapon.type !== 'bow' || player.gear.weapon2.type !== 'bow' ||
          player.gear.weapon.type !== 'dagger' || player.gear.weapon2.type !== 'dagger')){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.gothicplate;
            player.inventory.gothicplate--;
            socket.emit('addToChat','<i>You equipped </i><b>GothicPlate</b>.');
          } else {
            socket.emit('addToChat','<i>Must not have a dagger or bow equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>GothicPlate</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'clericrobe'){
        if(player.inventory.clericrobe > 0){
          if(!player.mounted && !player.gear.weapon){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.clericrobe;
            player.inventory.clericrobe--;
            socket.emit('addToChat','<i>You equipped </i><b>ClericRobe</b>.');
          } else {
            socket.emit('addToChat','<i>Must not be mounted or have a weapon equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>ClericRobe</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'monkcowl'){
        if(player.inventory.monkcowl > 0){
          if(!player.mounted && !player.gear.weapon){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.monkcowl;
            player.inventory.monkcowl--;
            socket.emit('addToChat','<i>You equipped </i><b>MonkCowl</b>.');
          } else {
            socket.emit('addToChat','<i>Must not be mounted or have a weapon equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>MonkCowl</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'blackcloak'){
        if(player.inventory.blackcloak > 0){
          if(!player.mounted && !player.gear.weapon){
            if(player.gear.armor){
              player.gear.armor.unequip(player.id);
            }
            player.gear.armor = equip.blackcloak;
            player.inventory.blackcloak--;
            socket.emit('addToChat','<i>You equipped </i><b>BlackCloak</b>.');
          } else {
            socket.emit('addToChat','<i>Must not be mounted or have a weapon equipped.</i>');
          }
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>BlackCloak</b>.');
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'crown'){
        if(player.inventory.crown > 0){
          if(player.gear.head){
            player.gear.head.unequip(player.id);
          }
          player.gear.head = equip.crown;
          player.inventory.crown--;
          socket.emit('addToChat','<i>You equipped </i><b>Crown</b>.');
        } else {
          socket.emit('addToChat','<i>You are not carrying </i><b>Crown</b>.');
        }
      }
    } else {
      socket.emit('addToChat','<i>You cannot equip gear while in combat.</i>');
    }
  } else if(data.cmd === 'unequip'){
    var head = '';
    var armor = '';
    var weapon = '';
    var weapon2 = '';
    var accessory = '';

    var all = '';

    if(player.gear.head){
      head = '<b>'+player.gear.head.name+':</b> /unequip head<br>';
      all += head;
    }
    if(player.gear.armor){
      armor = '<b>'+player.gear.armor.name+':</b> /unequip armor<br>';
      all += armor;
    }
    if(player.gear.weapon){
      weapon = '<b>'+player.gear.weapon.name+':</b> /unequip weapon<br>';
      all += weapon;
    }
    if(player.gear.weapon2){
      weapon2 = '<b>'+player.gear.weapon2.name+':</b> /unequip weapon2<br>';
      all += weapon2;
    }
    if(player.gear.accessory){
      accessory = '<b>'+player.gear.accessory.name+':</b> /unequip accessory';
      all += accessory;
    }
    if(all === ''){
      socket.emit('addToChat','<i>You have nothing equipped.</i>');
    } else {
      socket.emit('addToChat','<p>'+all+'</p>');
    }
  } else if(data.cmd.slice(0,7) === 'unequip' && data.cmd[7] === ' '){
    if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'head'){
      if(player.gear.head){
        player.gear.head.unequip(player.id);
        socket.emit('addToChat','<i>You unequip </i><b>' + player.gear.head.name + '</b>.');
        player.gear.head = null;
      } else {
        socket.emit('addToChat','<i>You are not wearing any headgear.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'armor'){
      if(player.gear.armor){
        player.gear.armor.unequip(player.id);
        socket.emit('addToChat','<i>You unequip </i><b>' + player.gear.armor.name + '</b>.');
        player.gear.armor = null;
      } else {
        socket.emit('addToChat','<i>You are not wearing any armor.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'weapon'){
      if(player.gear.weapon){
        player.gear.weapon.unequip(player.id);
        if(player.gear.weapon2){
          socket.emit('addToChat','<i>You unequip </i><b>' + player.gear.weapon.name +
          '</b><i> and switch weapons to </i><b>' + self.gear.weapon2.name + '</b>.');
          player.gear.weapon = player.gear.weapon2;
          player.gear.weapon2 = null;
        } else {
          socket.emit('addToChat','<i>You unequip </i><b>' + player.gear.weapon.name + '</b>.');
          player.gear.weapon = null;
        }
      } else {
        socket.emit('addToChat','<i>You do not have any weapons equipped.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'weapon2'){
      if(player.gear.weapon2){
        player.gear.weapon2.unequip(player.id);
        socket.emit('addToChat','<i>You unequip </i><b>' + player.gear.weapon2.name + '</b>.');
        player.gear.weapon2 = null;
      } else {
        socket.emit('addToChat','<i>You do not have a secondary weapon equipped.</i>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() === 'accessory'){
      if(player.gear.accessory){
        player.gear.accessory.unequip(player.id);
        socket.emit('addToChat','<i>You unequip </i><b>' + player.gear.accessory.name + '</b>.');
        player.gear.accessory = null;
      } else {
        socket.emit('addToChat','<i>You do not have an accessory equipped.</i>');
      }
    }
  } else if(data.cmd === 'drop'){
    socket.emit('addToChat','<p>/drop Quantity ItemName</p>');
  } else if(data.cmd.slice(0,4) === 'drop' && data.cmd[4] === ' '){
    var loc = getLoc(player.x,player.y);
    var target = String(data.cmd.slice(data.cmd.indexOf(' ') + 1)).toLowerCase();
    var q = Number(target.slice(0,target.indexOf(' '))).toFixed(0);
    var item = String(target.slice(target.indexOf(' ') + 1)).toLowerCase();
    if(q < 1){
      socket.emit('addToChat','<i>Quantity must be greater than 0.</i>');
    } else if(Number.isNaN(q/1)){
      socket.emit('addToChat','<i>Quantity must be a number.</i>');
    } else {
      console.log(q);
      if(item === 'wood'){
        if(q > player.inventory.wood){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.wood -= q;
                Item.list[ch].inventory.wood += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Wood({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.wood -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.wood -= q;
                Item.list[ch].inventory.wood += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Wood({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.wood -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.wood -= q;
                Item.list[ch].inventory.wood += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Wood({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.wood -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.wood -= q;
                Item.list[ch].inventory.wood += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Wood({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.wood -= q;
            }
          }
        }
      } else if(item === 'stone'){
        if(q > player.inventory.stone){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stone -= q;
                Item.list[ch].inventory.stone += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Stone({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stone -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stone -= q;
                Item.list[ch].inventory.stone += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Stone({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stone -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stone -= q;
                Item.list[ch].inventory.stone += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Stone({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stone -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stone -= q;
                Item.list[ch].inventory.stone += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Stone({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stone -= q;
            }
          }
        }
      } else if(item === 'grain'){
        if(q > player.inventory.grain){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.grain -= q;
                Item.list[ch].inventory.grain += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Grain({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.grain -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.grain -= q;
                Item.list[ch].inventory.grain += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Grain({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.grain -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.grain -= q;
                Item.list[ch].inventory.grain += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Grain({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.grain -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.grain -= q;
                Item.list[ch].inventory.grain += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Grain({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.grain -= q;
            }
          }
        }
      } else if(item === 'flour'){
        if(q > player.inventory.flour){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flour -= q;
                Item.list[ch].inventory.flour += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Flour({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flour -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flour -= q;
                Item.list[ch].inventory.flour += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Flour({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flour -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flour -= q;
                Item.list[ch].inventory.flour += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Flour({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flour -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flour -= q;
                Item.list[ch].inventory.flour += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Flour({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flour -= q;
            }
          }
        }
      } else if(item === 'dough'){
        if(q > player.inventory.dough){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dough -= q;
                Item.list[ch].inventory.dough += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Dough({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dough -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dough -= q;
                Item.list[ch].inventory.dough += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Dough({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dough -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dough -= q;
                Item.list[ch].inventory.dough += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Dough({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dough -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dough -= q;
                Item.list[ch].inventory.dough += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Dough({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dough -= q;
            }
          }
        }
      } else if(item === 'ironore'){
        if(q > player.inventory.ironore){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironore -= q;
                Item.list[ch].inventory.ironore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              IronOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironore -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironore -= q;
                Item.list[ch].inventory.ironore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              IronOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironore -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironore -= q;
                Item.list[ch].inventory.ironore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              IronOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironore -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironore -= q;
                Item.list[ch].inventory.ironore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              IronOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironore -= q;
            }
          }
        }
      } else if(item === 'ironbar'){
        if(q > player.inventory.ironbar){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironbar -= q;
                Item.list[ch].inventory.ironbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              IronBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironbar -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironbar -= q;
                Item.list[ch].inventory.ironbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              IronBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironbar -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironbar -= q;
                Item.list[ch].inventory.ironbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              IronBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironbar -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironbar -= q;
                Item.list[ch].inventory.ironbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              IronBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironbar -= q;
            }
          }
        }
      } else if(item === 'steelbar'){
        if(q > player.inventory.steelbar){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelbar -= q;
                Item.list[ch].inventory.steelbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              SteelBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelbar -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelbar -= q;
                Item.list[ch].inventory.steelbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              SteelBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelbar -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelbar -= q;
                Item.list[ch].inventory.steelbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              SteelBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelbar -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelbar -= q;
                Item.list[ch].inventory.steelbar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              SteelBar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelbar -= q;
            }
          }
        }
      } else if(item === 'boarhide'){
        if(q > player.inventory.boarhide){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarhide -= q;
                Item.list[ch].inventory.boarhide += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              BoarHide({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarhide -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarhide -= q;
                Item.list[ch].inventory.boarhide += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              BoarHide({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarhide -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarhide -= q;
                Item.list[ch].inventory.boarhide += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              BoarHide({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarhide -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarhide -= q;
                Item.list[ch].inventory.boarhide += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              BoarHide({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarhide -= q;
            }
          }
        }
      } else if(item === 'leather'){
        if(q > player.inventory.leather){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.leather -= q;
                Item.list[ch].inventory.leather += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Leather({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.leather -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.leather -= q;
                Item.list[ch].inventory.leather += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Leather({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.leather -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.leather -= q;
                Item.list[ch].inventory.leather += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Leather({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.leather -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.leather -= q;
                Item.list[ch].inventory.leather += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Leather({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.leather -= q;
            }
          }
        }
      } else if(item === 'silverore'){
        if(q > player.inventory.silverore){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silverore -= q;
                Item.list[ch].inventory.silverore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              SilverOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silverore -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silverore -= q;
                Item.list[ch].inventory.silverore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              SilverOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silverore -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silverore -= q;
                Item.list[ch].inventory.silverore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              SilverOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silverore -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silverore -= q;
                Item.list[ch].inventory.silverore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              SilverOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silverore -= q;
            }
          }
        }
      } else if(item === 'silver'){
        if(q > player.inventory.silver){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silver -= q;
                Item.list[ch].inventory.silver += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Silver({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silver -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silver -= q;
                Item.list[ch].inventory.silver += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Silver({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silver -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silver -= q;
                Item.list[ch].inventory.silver += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Silver({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silver -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.silver -= q;
                Item.list[ch].inventory.silver += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Silver({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.silver -= q;
            }
          }
        }
      } else if(item === 'goldore'){
        if(q > player.inventory.goldore){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.goldore -= q;
                Item.list[ch].inventory.goldore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              GoldOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.goldore -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.goldore -= q;
                Item.list[ch].inventory.goldore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              GoldOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.goldore -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.goldore -= q;
                Item.list[ch].inventory.goldore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              GoldOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.goldore -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.goldore -= q;
                Item.list[ch].inventory.goldore += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              GoldOre({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.goldore -= q;
            }
          }
        }
      } else if(item === 'gold'){
        if(q > player.inventory.gold){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gold -= q;
                Item.list[ch].inventory.gold += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Gold({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gold -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gold -= q;
                Item.list[ch].inventory.gold += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Gold({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gold -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gold -= q;
                Item.list[ch].inventory.gold += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Gold({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gold -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gold -= q;
                Item.list[ch].inventory.gold += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Gold({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gold -= q;
            }
          }
        }
      } else if(item === 'diamond'){
        if(q > player.inventory.diamond){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.diamond -= q;
                Item.list[ch].inventory.diamond += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Diamond({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.diamond -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.diamond -= q;
                Item.list[ch].inventory.diamond += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Diamond({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.diamond -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.diamond -= q;
                Item.list[ch].inventory.diamond += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Diamond({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.diamond -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.diamond -= q;
                Item.list[ch].inventory.diamond += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Diamond({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.diamond -= q;
            }
          }
        }
      } else if(item === 'huntingknife'){
        if(q > player.inventory.huntingknife){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.huntingknife -= q;
                Item.list[ch].inventory.huntingknife += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              HuntingKnife({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.huntingknife -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.huntingknife -= q;
                Item.list[ch].inventory.huntingknife += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              HuntingKnife({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.huntingknife -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.huntingknife -= q;
                Item.list[ch].inventory.huntingknife += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              HuntingKnife({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.huntingknife -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.huntingknife -= q;
                Item.list[ch].inventory.huntingknife += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              HuntingKnife({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.huntingknife -= q;
            }
          }
        }
      } else if(item === 'dague'){
        if(q > player.inventory.dague){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dague -= q;
                Item.list[ch].inventory.dague += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Dague({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dague -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dague -= q;
                Item.list[ch].inventory.dague += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Dague({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dague -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dague -= q;
                Item.list[ch].inventory.dague += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Dague({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dague -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.dague -= q;
                Item.list[ch].inventory.dague += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Dague({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.dague -= q;
            }
          }
        }
      } else if(item === 'rondel'){
        if(q > player.inventory.rondel){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rondel -= q;
                Item.list[ch].inventory.rondel += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Rondel({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rondel -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rondel -= q;
                Item.list[ch].inventory.rondel += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Rondel({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rondel -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rondel -= q;
                Item.list[ch].inventory.rondel += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Rondel({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rondel -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rondel -= q;
                Item.list[ch].inventory.rondel += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Rondel({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rondel -= q;
            }
          }
        }
      } else if(item === 'misericorde'){
        if(q > player.inventory.misericorde){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.misericorde -= q;
                Item.list[ch].inventory.misericorde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Misericorde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.misericorde -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.misericorde -= q;
                Item.list[ch].inventory.misericorde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Misericorde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.misericorde -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.misericorde -= q;
                Item.list[ch].inventory.misericorde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Misericorde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.misericorde -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.misericorde -= q;
                Item.list[ch].inventory.misericorde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Misericorde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.misericorde -= q;
            }
          }
        }
      } else if(item === 'bastardsword'){
        if(q > player.inventory.bastardsword){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bastardsword -= q;
                Item.list[ch].inventory.bastardsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              BastardSword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bastardsword -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bastardsword -= q;
                Item.list[ch].inventory.bastardsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              BastardSword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bastardsword -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bastardsword -= q;
                Item.list[ch].inventory.bastardsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              BastardSword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bastardsword -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bastardsword -= q;
                Item.list[ch].inventory.bastardsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              BastardSword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bastardsword -= q;
            }
          }
        }
      } else if(item === 'longsword'){
        if(q > player.inventory.longsword){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.longsword -= q;
                Item.list[ch].inventory.longsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Longsword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.longsword -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.longsword -= q;
                Item.list[ch].inventory.longsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Longsword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.longsword -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.longsword -= q;
                Item.list[ch].inventory.longsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Longsword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.longsword -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.longsword -= q;
                Item.list[ch].inventory.longsword += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Longsword({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.longsword -= q;
            }
          }
        }
      } else if(item === 'zweihander'){
        if(q > player.inventory.zweihander){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.zweihander -= q;
                Item.list[ch].inventory.zweihander += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Zweihander({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.zweihander -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.zweihander -= q;
                Item.list[ch].inventory.zweihander += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Zweihander({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.zweihander -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.zweihander -= q;
                Item.list[ch].inventory.zweihander += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Zweihander({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.zweihander -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.zweihander -= q;
                Item.list[ch].inventory.zweihander += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Zweihander({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.zweihander -= q;
            }
          }
        }
      } else if(item === 'morallta'){
        if(q > player.inventory.morallta){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.morallta -= q;
                Item.list[ch].inventory.morallta += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Morallta({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.morallta -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.morallta -= q;
                Item.list[ch].inventory.morallta += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Morallta({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.morallta -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.morallta -= q;
                Item.list[ch].inventory.morallta += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Morallta({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.morallta -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.morallta -= q;
                Item.list[ch].inventory.morallta += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Morallta({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.morallta -= q;
            }
          }
        }
      } else if(item === 'bow'){
        if(q > player.inventory.bow){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bow -= q;
                Item.list[ch].inventory.bow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Bow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bow -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bow -= q;
                Item.list[ch].inventory.bow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Bow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bow -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bow -= q;
                Item.list[ch].inventory.bow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Bow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bow -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bow -= q;
                Item.list[ch].inventory.bow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Bow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bow -= q;
            }
          }
        }
      } else if(item === 'welshlongbow'){
        if(q > player.inventory.welshlongbow){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.welshlongbow -= q;
                Item.list[ch].inventory.welshlongbow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              WelshLongbow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.welshlongbow -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.welshlongbow -= q;
                Item.list[ch].inventory.welshlongbow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              WelshLongbow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.welshlongbow -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.welshlongbow -= q;
                Item.list[ch].inventory.welshlongbow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              WelshLongbow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.welshlongbow -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.welshlongbow -= q;
                Item.list[ch].inventory.welshlongbow += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              WelshLongbow({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.welshlongbow -= q;
            }
          }
        }
      } else if(item === 'knightlance'){
        if(q > player.inventory.knightlance){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.knightlance -= q;
                Item.list[ch].inventory.knightlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              KnightLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.knightlance -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.knightlance -= q;
                Item.list[ch].inventory.knightlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              KnightLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.knightlance -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.knightlance -= q;
                Item.list[ch].inventory.knightlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              KnightLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.knightlance -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.knightlance -= q;
                Item.list[ch].inventory.knightlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              KnightLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.knightlance -= q;
            }
          }
        }
      } else if(item === 'rusticlance'){
        if(q > player.inventory.rusticlance){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rusticlance -= q;
                Item.list[ch].inventory.rusticlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              RusticLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rusticlance -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rusticlance -= q;
                Item.list[ch].inventory.rusticlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              RusticLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rusticlance -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rusticlance -= q;
                Item.list[ch].inventory.rusticlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              RusticLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rusticlance -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.rusticlance -= q;
                Item.list[ch].inventory.rusticlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              RusticLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.rusticlance -= q;
            }
          }
        }
      } else if(item === 'paladinlance'){
        if(q > player.inventory.paladinlance){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.paladinlance -= q;
                Item.list[ch].inventory.paladinlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              PaladinLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.paladinlance -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.paladinlance -= q;
                Item.list[ch].inventory.paladinlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              PaladinLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.paladinlance -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.paladinlance -= q;
                Item.list[ch].inventory.paladinlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              PaladinLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.paladinlance -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.paladinlance -= q;
                Item.list[ch].inventory.paladinlance += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              PaladinLance({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.paladinlance -= q;
            }
          }
        }
      } else if(item === 'brigandine'){
        if(q > player.inventory.brigandine){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brigandine -= q;
                Item.list[ch].inventory.brigandine += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Brigandine({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brigandine -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brigandine -= q;
                Item.list[ch].inventory.brigandine += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Brigandine({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brigandine -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brigandine -= q;
                Item.list[ch].inventory.brigandine += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Brigandine({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brigandine -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brigandine -= q;
                Item.list[ch].inventory.brigandine += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Brigandine({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brigandine -= q;
            }
          }
        }
      } else if(item === 'lamellar'){
        if(q > player.inventory.lamellar){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamellar -= q;
                Item.list[ch].inventory.lamellar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Lamellar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamellar -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamellar -= q;
                Item.list[ch].inventory.lamellar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Lamellar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamellar -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamellar -= q;
                Item.list[ch].inventory.lamellar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Lamellar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamellar -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamellar -= q;
                Item.list[ch].inventory.lamellar += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Lamellar({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamellar -= q;
            }
          }
        }
      } else if(item === 'maille'){
        if(q > player.inventory.maille){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.maille -= q;
                Item.list[ch].inventory.maille += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Maille({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.maille -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.maille -= q;
                Item.list[ch].inventory.maille += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Maille({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.maille -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.maille -= q;
                Item.list[ch].inventory.maille += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Maille({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.maille -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.maille -= q;
                Item.list[ch].inventory.maille += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Maille({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.maille -= q;
            }
          }
        }
      } else if(item === 'hauberk'){
        if(q > player.inventory.hauberk){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.hauberk -= q;
                Item.list[ch].inventory.hauberk += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Hauberk({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.hauberk -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.hauberk -= q;
                Item.list[ch].inventory.hauberk += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Hauberk({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.hauberk -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.hauberk -= q;
                Item.list[ch].inventory.hauberk += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Hauberk({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.hauberk -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.hauberk -= q;
                Item.list[ch].inventory.hauberk += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Hauberk({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.hauberk -= q;
            }
          }
        }
      } else if(item === 'brynja'){
        if(q > player.inventory.brynja){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brynja -= q;
                Item.list[ch].inventory.brynja += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Brynja({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brynja -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brynja -= q;
                Item.list[ch].inventory.brynja += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Brynja({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brynja -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brynja -= q;
                Item.list[ch].inventory.brynja += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Brynja({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brynja -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.brynja -= q;
                Item.list[ch].inventory.brynja += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Brynja({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.brynja -= q;
            }
          }
        }
      } else if(item === 'cuirass'){
        if(q > player.inventory.cuirass){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.cuirass -= q;
                Item.list[ch].inventory.cuirass += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Cuirass({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.cuirass -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.cuirass -= q;
                Item.list[ch].inventory.cuirass += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Cuirass({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.cuirass -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.cuirass -= q;
                Item.list[ch].inventory.cuirass += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Cuirass({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.cuirass -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.cuirass -= q;
                Item.list[ch].inventory.cuirass += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Cuirass({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.cuirass -= q;
            }
          }
        }
      } else if(item === 'steelplate'){
        if(q > player.inventory.steelplate){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelplate -= q;
                Item.list[ch].inventory.steelplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              SteelPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelplate -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelplate -= q;
                Item.list[ch].inventory.steelplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              SteelPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelplate -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelplate -= q;
                Item.list[ch].inventory.steelplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              SteelPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelplate -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.steelplate -= q;
                Item.list[ch].inventory.steelplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              SteelPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.steelplate -= q;
            }
          }
        }
      } else if(item === 'greenwichplate'){
        if(q > player.inventory.greenwichplate){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.greenwichplate -= q;
                Item.list[ch].inventory.greenwichplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              GreenwichPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.greenwichplate -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.greenwichplate -= q;
                Item.list[ch].inventory.greenwichplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              GreenwichPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.greenwichplate -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.greenwichplate -= q;
                Item.list[ch].inventory.greenwichplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              GreenwichPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.greenwichplate -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.greenwichplate -= q;
                Item.list[ch].inventory.greenwichplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              GreenwichPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.greenwichplate -= q;
            }
          }
        }
      } else if(item === 'gothicplate'){
        if(q > player.inventory.gothicplate){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gothicplate -= q;
                Item.list[ch].inventory.gothicplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              GothicPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gothicplate -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gothicplate -= q;
                Item.list[ch].inventory.gothicplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              GothicPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gothicplate -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gothicplate -= q;
                Item.list[ch].inventory.gothicplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              GothicPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gothicplate -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.gothicplate -= q;
                Item.list[ch].inventory.gothicplate += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              GothicPlate({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.gothicplate -= q;
            }
          }
        }
      } else if(item === 'clericrobe'){
        if(q > player.inventory.clericrobe){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.clericrobe -= q;
                Item.list[ch].inventory.clericrobe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              ClericRobe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.clericrobe -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.clericrobe -= q;
                Item.list[ch].inventory.clericrobe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              ClericRobe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.clericrobe -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.clericrobe -= q;
                Item.list[ch].inventory.clericrobe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              ClericRobe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.clericrobe -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.clericrobe -= q;
                Item.list[ch].inventory.clericrobe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              ClericRobe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.clericrobe -= q;
            }
          }
        }
      } else if(item === 'monkcowl'){
        if(q > player.inventory.monkcowl){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.monkcowl -= q;
                Item.list[ch].inventory.monkcowl += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              MonkCowl({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.monkcowl -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.monkcowl -= q;
                Item.list[ch].inventory.monkcowl += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              MonkCowl({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.monkcowl -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.monkcowl -= q;
                Item.list[ch].inventory.monkcowl += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              MonkCowl({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.monkcowl -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.monkcowl -= q;
                Item.list[ch].inventory.monkcowl += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              MonkCowl({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.monkcowl -= q;
            }
          }
        }
      } else if(item === 'blackcloak'){
        if(q > player.inventory.blackcloak){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.blackcloak -= q;
                Item.list[ch].inventory.blackcloak += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              BlackCloak({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.blackcloak -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.blackcloak -= q;
                Item.list[ch].inventory.blackcloak += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              BlackCloak({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.blackcloak -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.blackcloak -= q;
                Item.list[ch].inventory.blackcloak += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              BlackCloak({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.blackcloak -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.blackcloak -= q;
                Item.list[ch].inventory.blackcloak += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              BlackCloak({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.blackcloak -= q;
            }
          }
        }
      } else if(item === 'tome'){
        if(q > player.inventory.tome){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.tome -= q;
                Item.list[ch].inventory.tome += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Tome({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.tome -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.tome -= q;
                Item.list[ch].inventory.tome += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Tome({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.tome -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.tome -= q;
                Item.list[ch].inventory.tome += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Tome({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.tome -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.tome -= q;
                Item.list[ch].inventory.tome += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Tome({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.tome -= q;
            }
          }
        }
      } else if(item === 'runicscroll'){
        if(q > player.inventory.runicscroll){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.runicscroll -= q;
                Item.list[ch].inventory.runicscroll += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              RunicScroll({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.runicscroll -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.runicscroll -= q;
                Item.list[ch].inventory.runicscroll += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              RunicScroll({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.runicscroll -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.runicscroll -= q;
                Item.list[ch].inventory.runicscroll += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              RunicScroll({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.runicscroll -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.runicscroll -= q;
                Item.list[ch].inventory.runicscroll += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              RunicScroll({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.runicscroll -= q;
            }
          }
        }
      } else if(item === 'sacredtext'){
        if(q > player.inventory.sacredtext){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.sacredtext -= q;
                Item.list[ch].inventory.sacredtext += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              SacredText({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.sacredtext -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.sacredtext -= q;
                Item.list[ch].inventory.sacredtext += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              SacredText({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.sacredtext -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.sacredtext -= q;
                Item.list[ch].inventory.sacredtext += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              SacredText({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.sacredtext -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.sacredtext -= q;
                Item.list[ch].inventory.sacredtext += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              SacredText({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.sacredtext -= q;
            }
          }
        }
      } else if(item === 'stoneaxe'){
        if(q > player.inventory.stoneaxe){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stoneaxe -= q;
                Item.list[ch].inventory.stoneaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              StoneAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stoneaxe -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stoneaxe -= q;
                Item.list[ch].inventory.stoneaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              StoneAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stoneaxe -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stoneaxe -= q;
                Item.list[ch].inventory.stoneaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              StoneAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stoneaxe -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.stoneaxe -= q;
                Item.list[ch].inventory.stoneaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              StoneAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.stoneaxe -= q;
            }
          }
        }
      } else if(item === 'ironaxe'){
        if(q > player.inventory.ironaxe){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironaxe -= q;
                Item.list[ch].inventory.ironaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              IronAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironaxe -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironaxe -= q;
                Item.list[ch].inventory.ironaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              IronAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironaxe -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironaxe -= q;
                Item.list[ch].inventory.ironaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              IronAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironaxe -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.ironaxe -= q;
                Item.list[ch].inventory.ironaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              IronAxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.ironaxe -= q;
            }
          }
        }
      } else if(item === 'pickaxe'){
        if(q > player.inventory.pickaxe){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.pickaxe -= q;
                Item.list[ch].inventory.pickaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Pickaxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.pickaxe -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.pickaxe -= q;
                Item.list[ch].inventory.pickaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Pickaxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.pickaxe -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.pickaxe -= q;
                Item.list[ch].inventory.pickaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Pickaxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.pickaxe -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.pickaxe -= q;
                Item.list[ch].inventory.pickaxe += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Pickaxe({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.pickaxe -= q;
            }
          }
        }
      } else if(item === 'torch'){
        if(q > player.inventory.rondel){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.torch -= q;
                Item.list[ch].inventory.torch += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Torch({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.torch -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.torch -= q;
                Item.list[ch].inventory.torch += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Torch({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.torch -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.torch -= q;
                Item.list[ch].inventory.torch += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Torch({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.torch -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.torch -= q;
                Item.list[ch].inventory.torch += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Torch({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.torch -= q;
            }
          }
        }
      } else if(item === 'bread'){
        if(q > player.inventory.bread){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bread -= q;
                Item.list[ch].inventory.bread += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Bread({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bread -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bread -= q;
                Item.list[ch].inventory.bread += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Bread({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bread -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bread -= q;
                Item.list[ch].inventory.bread += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Bread({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bread -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bread -= q;
                Item.list[ch].inventory.bread += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Bread({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bread -= q;
            }
          }
        }
      } else if(item === 'fish'){
        if(q > player.inventory.fish){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.fish -= q;
                Item.list[ch].inventory.fish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Fish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.fish -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.fish -= q;
                Item.list[ch].inventory.fish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Fish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.fish -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.fish -= q;
                Item.list[ch].inventory.fish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Fish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.fish -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.fish -= q;
                Item.list[ch].inventory.fish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Fish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.fish -= q;
            }
          }
        }
      } else if(item === 'lamb'){
        if(q > player.inventory.lamb){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamb -= q;
                Item.list[ch].inventory.lamb += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Lamb({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamb -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamb -= q;
                Item.list[ch].inventory.lamb += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Lamb({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamb -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamb -= q;
                Item.list[ch].inventory.lamb += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Lamb({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamb -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lamb -= q;
                Item.list[ch].inventory.lamb += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Lamb({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lamb -= q;
            }
          }
        }
      } else if(item === 'boarmeat'){
        if(q > player.inventory.boarmeat){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarmeat -= q;
                Item.list[ch].inventory.boarmeat += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              BoarMeat({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarmeat -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarmeat -= q;
                Item.list[ch].inventory.boarmeat += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              BoarMeat({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarmeat -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarmeat -= q;
                Item.list[ch].inventory.boarmeat += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              BoarMeat({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarmeat -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarmeat -= q;
                Item.list[ch].inventory.boarmeat += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              BoarMeat({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarmeat -= q;
            }
          }
        }
      } else if(item === 'venison'){
        if(q > player.inventory.venison){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venison -= q;
                Item.list[ch].inventory.venison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Venison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venison -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venison -= q;
                Item.list[ch].inventory.venison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Venison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venison -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venison -= q;
                Item.list[ch].inventory.venison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Venison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venison -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venison -= q;
                Item.list[ch].inventory.venison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Venison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venison -= q;
            }
          }
        }
      } else if(item === 'poachedfish'){
        if(q > player.inventory.poachfish){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.poachedfish -= q;
                Item.list[ch].inventory.poachedfish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              PoachedFish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.poachedfish -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.poachedfish -= q;
                Item.list[ch].inventory.poachedfish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              PoachedFish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.poachedfish -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.poachedfish -= q;
                Item.list[ch].inventory.poachedfish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              PoachedFish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.poachedfish -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.poachedfish -= q;
                Item.list[ch].inventory.poachedfish += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              PoachedFish({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.poachedfish -= q;
            }
          }
        }
      } else if(item === 'lambchop'){
        if(q > player.inventory.lambchop){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lambchop -= q;
                Item.list[ch].inventory.lambchop += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              LambChop({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lambchop -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lambchop -= q;
                Item.list[ch].inventory.lambchop += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              LambChop({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lambchop -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lambchop -= q;
                Item.list[ch].inventory.lambchop += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              LambChop({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lambchop -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.lambchop -= q;
                Item.list[ch].inventory.lambchop += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              LambChop({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.lambchop -= q;
            }
          }
        }
      } else if(item === 'boarshank'){
        if(q > player.inventory.boarshank){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarshank -= q;
                Item.list[ch].inventory.boarshank += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              BoarShank({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarshank -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarshank -= q;
                Item.list[ch].inventory.boarshank += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              BoarShank({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarshank -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarshank -= q;
                Item.list[ch].inventory.boarshank += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              BoarShank({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarshank -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.boarshank -= q;
                Item.list[ch].inventory.boarshank += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              BoarShank({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.boarshank -= q;
            }
          }
        }
      } else if(item === 'venisonloin'){
        if(q > player.inventory.venisonloin){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venisonloin -= q;
                Item.list[ch].inventory.venisonloin += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              VenisonLoin({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venisonloin -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venisonloin -= q;
                Item.list[ch].inventory.venisonloin += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              VenisonLoin({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venisonloin -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venisonloin -= q;
                Item.list[ch].inventory.venisonloin += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              VenisonLoin({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venisonloin -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.venisonloin -= q;
                Item.list[ch].inventory.venisonloin += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              VenisonLoin({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.venisonloin -= q;
            }
          }
        }
      } else if(item === 'mead'){
        if(q > player.inventory.mead){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.mead -= q;
                Item.list[ch].inventory.mead += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Mead({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.mead -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.mead -= q;
                Item.list[ch].inventory.mead += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Mead({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.mead -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.mead -= q;
                Item.list[ch].inventory.mead += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Mead({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.mead -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.mead -= q;
                Item.list[ch].inventory.mead += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Mead({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.mead -= q;
            }
          }
        }
      } else if(item === 'saison'){
        if(q > player.inventory.saison){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.saison -= q;
                Item.list[ch].inventory.saison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Saison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.saison -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.saison -= q;
                Item.list[ch].inventory.saison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Saison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.saison -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.saison -= q;
                Item.list[ch].inventory.saison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Saison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.saison -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.saison -= q;
                Item.list[ch].inventory.saison += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Saison({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.saison -= q;
            }
          }
        }
      } else if(item === 'flandersredale'){
        if(q > player.inventory.flandersredale){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flandersredale -= q;
                Item.list[ch].inventory.flandersredale += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              FlandersRedAle({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flandersredale -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flandersredale -= q;
                Item.list[ch].inventory.flandersredale += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              FlandersRedAle({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flandersredale -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flandersredale -= q;
                Item.list[ch].inventory.flandersredale += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              FlandersRedAle({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flandersredale -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.flandersredale -= q;
                Item.list[ch].inventory.flandersredale += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              FlandersRedAle({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.flandersredale -= q;
            }
          }
        }
      } else if(item === 'bieredegarde'){
        if(q > player.inventory.bieredegarde){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bieredegarde -= q;
                Item.list[ch].inventory.bieredegarde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              BiereDeGarde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bieredegarde -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bieredegarde -= q;
                Item.list[ch].inventory.bieredegarde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              BiereDeGarde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bieredegarde -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bieredegarde -= q;
                Item.list[ch].inventory.bieredegarde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              BiereDeGarde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bieredegarde -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bieredegarde -= q;
                Item.list[ch].inventory.bieredegarde += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              BiereDeGarde({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bieredegarde -= q;
            }
          }
        }
      } else if(item === 'bordeaux'){
        if(q > player.inventory.bordeaux){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bordeaux -= q;
                Item.list[ch].inventory.bordeaux += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Bordeaux({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bordeaux -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bordeaux -= q;
                Item.list[ch].inventory.bordeaux += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Bordeaux({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bordeaux -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bordeaux -= q;
                Item.list[ch].inventory.bordeaux += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Bordeaux({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bordeaux -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bordeaux -= q;
                Item.list[ch].inventory.bordeaux += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Bordeaux({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bordeaux -= q;
            }
          }
        }
      } else if(item === 'bourgogne'){
        if(q > player.inventory.bourgogne){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bourgogne -= q;
                Item.list[ch].inventory.bourgogne += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Bourgogne({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bourgogne -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bourgogne -= q;
                Item.list[ch].inventory.bourgogne += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Bourgogne({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bourgogne -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bourgogne -= q;
                Item.list[ch].inventory.bourgogne += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Bourgogne({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bourgogne -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.bourgogne -= q;
                Item.list[ch].inventory.bourgogne += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Bourgogne({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.bourgogne -= q;
            }
          }
        }
      } else if(item === 'chianti'){
        if(q > player.inventory.chianti){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.chianti -= q;
                Item.list[ch].inventory.chianti += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Chianti({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.chianti -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.chianti -= q;
                Item.list[ch].inventory.chianti += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Chianti({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.chianti -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.chianti -= q;
                Item.list[ch].inventory.chianti += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Chianti({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.chianti -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.chianti -= q;
                Item.list[ch].inventory.chianti += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Chianti({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.chianti -= q;
            }
          }
        }
      } else if(item === 'crown'){
        if(q > player.inventory.crown){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.crown -= q;
                Item.list[ch].inventory.crown += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Crown({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.crown -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.crown -= q;
                Item.list[ch].inventory.crown += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Crown({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.crown -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.crown -= q;
                Item.list[ch].inventory.crown += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Crown({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.crown -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.crown -= q;
                Item.list[ch].inventory.crown += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Crown({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.crown -= q;
            }
          }
        }
      } else if(item === 'arrows'){
        if(q > player.inventory.arrows){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.arrows -= q;
                Item.list[ch].inventory.arrows += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Arrows({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.arrows -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.arrows -= q;
                Item.list[ch].inventory.arrows += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Arrows({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.arrows -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.arrows -= q;
                Item.list[ch].inventory.arrows += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Arrows({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.arrows -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.arrows -= q;
                Item.list[ch].inventory.arrows += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Arrows({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.arrows -= q;
            }
          }
        }
      } else if(item === 'worldmap'){
        if(q > player.inventory.worldmap){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.worldmap -= q;
                Item.list[ch].inventory.worldmap += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              WorldMap({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.worldmap -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.worldmap -= q;
                Item.list[ch].inventory.worldmap += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              WorldMap({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.worldmap -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.worldmap -= q;
                Item.list[ch].inventory.worldmap += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              WorldMap({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.worldmap -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.worldmap -= q;
                Item.list[ch].inventory.worldmap += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              WorldMap({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.worldmap -= q;
            }
          }
        }
      } else if(item === 'relic'){
        if(q > player.inventory.relic){
          socket.emit('addToChat','<i>You do not have that many.</i>');
        } else {
          if(player.facing === 'up'){
            if(getItem(player.z,loc[0],loc[1]-1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]-1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]-1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.relic -= q;
                Item.list[ch].inventory.relic += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]-1)){
              var coords = getCoords(loc[0],loc[1]-1);
              Relic({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.relic -= q;
            }
          } else if(player.facing === 'down'){
            if(getItem(player.z,loc[0],loc[1]+1) === 'LockedChest' || getItem(player.z,loc[0],loc[1]+1) === 'Chest'){
              var chCoords = getCoords(loc[0],loc[1]+1);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.relic -= q;
                Item.list[ch].inventory.relic += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0],loc[1]+1)){
              var coords = getCoords(loc[0],loc[1]+1);
              Relic({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.relic -= q;
            }
          } else if(player.facing === 'left'){
            if(getItem(player.z,loc[0]-1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]-1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]-1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.relic -= q;
                Item.list[ch].inventory.relic += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]-1,loc[1])){
              var coords = getCoords(loc[0]-1,loc[1]);
              Relic({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.relic -= q;
            }
          } else if(player.facing === 'right'){
            if(getItem(player.z,loc[0]+1,loc[1]) === 'LockedChest' || getItem(player.z,loc[0]+1,loc[1]) === 'Chest'){
              var chCoords = getCoords(loc[0]+1,loc[1]);
              var ch = chestCheck(player.z,chCoords[0],chCoords[1],player.id);
              if(ch){
                Player.list[player.id].inventory.relic -= q;
                Item.list[ch].inventory.relic += q;
              } else {
                socket.emit('addToChat','<i>You do not have the key to this chest.</i>');
              }
            } else if(isWalkable(player.z,loc[0]+1,loc[1])){
              var coords = getCoords(loc[0]+1,loc[1]);
              Relic({
                z:player.z,
                x:coords[0],
                y:coords[1],
                qty:q,
                parent:player.id
              });
              Player.list[player.id].inventory.relic -= q;
            }
          }
        }
      }
    }
  } else {
    socket.emit('addToChat','<i>Invalid command.</i>');
  }
}
