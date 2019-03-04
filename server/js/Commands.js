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
        },10000/player.strength);
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
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 18){
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
      if(getTile(0,c,r) === 7 || getTile(0,n[0],n[1]) === 18){
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
      if(getTile(0,c,r) === 7 || getTile(0,c,r) === 4 || getTile(0,n[0],n[1]) === 18){
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
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 5 || getTile(0,n[0],n[1]) === 18){
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'monastery' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],[c,r-3],[c+1,r-3]];
      var walls = [[c+2,r-3],[c+3,r-3],[c,r-4],[c+1,r-4]];
      var topPlot = [[c+2,r-3],[c,r-4],[c+1,r-4]];
      var perim = [[c,r-4],[c+1,r-4],[c+2,r-3],[c+2,r-4],[c+3,r-3],[c-1,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 5 || getTile(0,n[0],n[1]) === 18){
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
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
        plot = [[c-2,r],[c-1,r],[c,r],[c-2,r-1],[c-1,r-1][c,r-1]];
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
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'garrison' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
      var walls = [[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var topPlot = [[c+1,r-3],[c+2,r-3],[c+3,r-3]];
      var perim = [[c-1,r-4],[c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r+1],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 18){
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'bsmith' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1]];
      var walls = [[c,r-2],[c+1,r-2],[c+2,r-2]];
      var perim = [[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+3,r-2],[c+3,r-1],[c+3,r]];
      var count = 0;
      for(i in plot){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 18){
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
            type:'bsmith',
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'gate' && z === 0){
      var plot = [[c,r],[c+1,r]];
      var sides = [[c-1,r],[c+2,r]];
      if(getTile(3,sides[0][0],sides[0][1]) === 'wall' && getTile(3,sides[1][0],sides[1][1]) === 'wall'){
        var count = 0;
        for(i in plot){
          var n = plot[i];
          if((getTile(0,n[0],n[1]) === 7 || getTile(0,n[0],n[1]) === 4 || getTile(0,n[0],n[1]) === 18) && getTile(5,n[0],n[1]-1) === 0){
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
          socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
        }
      } else {
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'road' && z === 0){
      if(getTile(0,c,r) === 7 || getTile(0,c,r) === 4 || getTile(0,c,r) === 5){
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
        socket.emit('addToChat','<b>DM: You cannot build that there.</b>');
      }
    }
  } else {
    socket.emit('addToChat','<b>DM: Invalid command.</b>');
  }
}
