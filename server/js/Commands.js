EvalCmd = function(data){
  if(Player.list[data.id]){
    var socket = SOCKET_LIST[data.id];
    var player = Player.list[data.id];
    var world = data.world;
    var loc = getLoc(player.x,player.y);
    var z = player.z;
    var c = loc[0];
    var r = loc[1];

    // BUILDING
    if(data.cmd == 'build'){
      var farm = 0;
      var tavern = 0;
      var forge = 0;
      var monastery = 0;
      var garrison = 0;
      var stronghold = 0;

      var all = '<b><u>TIER I</u><br>[Farm]</b>: /build farm<br><b>Lumbermill</b>: /build lumbermill<br><b>Mine</b>: /build mine<br><b>Hut</b>: /build hut<br><b>Cottage</b>: /build cottage<br><b>Villa</b>: /build villa<br><b>[Tavern]</b>: /build tavern<br><b>Tower</b>: /build tower<br><b>[Forge]</b>: /build forge<br><b>Fort</b>: /build fort<br><b>Outpost</b>: /build outpost<br><b>[Monastery]</b>: /build monastery<br><b>Road</b>: /build road<br>';

      for(var i in Building.list){
        var b = Building.list[i];
        if(b.owner == player.id && b.built){
          if(b.type == 'farm'){
            farm++;
          } else if(b.type == 'tavern'){
            tavern++;
          } else if(b.type == 'forge'){
            forge++;
          } else if(b.type == 'monastery'){
            monastery++;
          } else if(b.type == 'garrison'){
            garrison++;
          } else if(b.type == 'stronghold'){
            stronghold++;
          }
        }
      }
      if(farm > 0 || tavern > 0 || forge > 0){
        all += '<br><b><u>TIER II</u></b><br>';
        if(farm > 0){
          all += '<b>Mill</b>: /build mill<br>';
        }
        if(tavern > 0){
          all += '<b>Dock</b>: /build dock<br><b>Stable</b>: /build stable<br><b>Market</b>: /build market<br>';
        }
        if(forge > 0){
          all += '<b>[Garrison]</b>: /build garrison<br>';
        }
      }
      if(garrison){
        all += '<b><u>TIER III</u><br>[Stronghold]</b>: /build stronghold<br><b>Wall</b>: /build wall<br><b>Gate</b>: /build gate<br><b>Guardtower</b> /build guardtower<br>'
      }
      if(monastery > 0 && stronghold > 0){
        all += '<b><u>TIER IV</u><br>Cathedral</b>: /build cathedral<br>';
      }
      socket.write(JSON.stringify({msg:'addToChat',message:'<p>' + all + '</p>'}));
    } else if(data.cmd.slice(0,5) == 'build' && data.cmd[5] == ' '){
      // farm
      if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'farm' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7){
            count++;
          }
        }
        if(count == 9){
          player.working = true;
          setTimeout(function(){
            if(player.working){
              for(var i in plot){
                var n = plot[i];
                tileChange(0,n[0],n[1],8);
                tileChange(6,n[0],n[1],0);
              }
              player.working = false;
              mapEdit();
              var center = getCenter(plot[4][0],plot[4][1]);
              Farm({
                owner:player.id,
                house:player.house,
                kingdom:player.kingdom,
                x:center[0],
                y:center[1],
                z:0,
                type:'farm',
                built:true,
                plot:plot
              });
            }
          },10000/player.strength);
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'mill' && z == 0){
        var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
        var topPlot = [[c,r-2],[c+1,r-2]];
        var perim = [[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r-2],[c+2,r-1],[c+2,r],[c,r-3],[c+1,r-3]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7){
            count++;
          }
        }
        if(count == 4){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 10){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            var center = getCoords(plot[1][0],plot[1][1]);
            Mill({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:center[0],
              y:center[1],
              z:0,
              type:'mill',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'lumbermill' && z == 0){
        var plot = [[c,r],[c+1,r]];
        var topPlot = [[c,r-1],[c+1,r-1]];
        var perim = [[c,r-1],[c+1,r-1],[c-1,r],[c+2,r],[c,r+1],[c+1,r+1]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7){
            count++;
          }
        }
        if(count == 2){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 6){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Lumbermill({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'lumbermill',
              built:false,
              plot:plot,
              walls:null,
              topPlot:topPlot,
              mats:{
                wood:25,
                stone:0
              },
              req:5,
              hp:100
            });
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'mine' && z == 0){
        var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
        var perim = [[c,r-2],[c+1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r-1],[c+2,r]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          var gt = getTile(0,n[0],n[1])
          if((gt >= 4 && gt < 6) || gt == 7){
            count++;
          }
        }
        if(count == 4){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 8){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Mine({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'mine',
              built:false,
              plot:plot,
              walls:null,
              topPlot:null,
              mats:{
                wood:40,
                stone:0
              },
              req:5,
              hp:150
            });
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'hut' && z == 0){
        var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
        var walls = [[c,r-2],[c+1,r-2]];
        var perim = [[c,r-2],[c+1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r-1],[c+2,r]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7){
            count++;
          }
        }
        if(count == 4){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 8){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Building({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'hut',
              built:false,
              plot:plot,
              walls:null,
              topPlot:topPlot,
              mats:{
                wood:30,
                stone:0
              },
              req:5,
              hp:150
            });
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'cottage' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
        var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
        var perim = [[c,r-3],[c+1,r-3],[c+2,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]]
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 5) || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 9){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 12){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Building({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'cottage',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'fort' && z == 0){
        var plot = [[c,r]];
        if(getTile(0,c,r) == 7 || getTile(0,c,r) == 18){
          if(getTile(0,c,r-1) == 14 || getTile(c,r-1) == 16){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          } else {
            tileChange(0,c,r,11);
            tileChange(6,c,r,0);
            mapEdit();
            Building({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'fort',
              built:false,
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
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'wall' && z == 0){
        var plot = [[c,r]];
        if(getTile(0,c,r) == 7 || (getTile(0,c,r) >= 4 && getTile(0,c,r) < 6) || getTile(0,c,r) == 18){
          if(getTile(0,c,r-1) == 14 || getTile(c,r-1) == 16 || getTile(c,r-1) == 19){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          } else {
            tileChange(0,c,r,11);
            tileChange(6,c,r,0);
            mapEdit();
            Building({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'wall',
              built:false,
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
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'outpost' && z == 0){
        var plot = [[c,r]];
        var topPlot = [[c,r-1]];
        if(getTile(0,c,r) == 7){
          if(getTile(0,c,r-1) == 14 || getTile(0,c,r-1) == 16 || getTile(0,c,r-1) == 19 || getTile(5,c,r-1) != 0){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          } else {
            tileChange(0,c,r,11);
            tileChange(6,c,r,0);
            mapEdit();
            Outpost({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'outpost',
              built:false,
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
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'guardtower' && z == 0){
        var plot = [[c,r],[c+1,r],[c,r-1],[c+1,r-1]];
        var topPlot = [[c,r-2],[c+1,r-2]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,c,r) == 7 || (getTile(0,c,r) >= 4 && getTile(0,c,r) < 6)){
            count++;
          }
        }
        if(count == 4){
          if(getTile(0,c,r-2) == 14 || getTile(0,c,r-2) == 16 || getTile(0,c,r-2) == 19 || getTile(5,c,r-2) != 0 || getTile(0,c+1,r-2) == 14 || getTile(0,c+1,r-2) == 16 || getTile(0,c+1,r-2) == 19 || getTile(5,c+1,r-2) != 0){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          } else {
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Guardtower({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'guardtower',
              built:false,
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
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'tower' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
        var walls = [[c,r-3],[c+1,r-3],[c+2,r-3]];
        var topPlot = [[c,r-3],[c+1,r-3],[c+2,r-3],[c,r-4],[c+1,r-4],[c+2,r-4]];
        var perim = [[c,r-3],[c+1,r-3],[c+2,r-3],[c,r-4],[c+1,r-4],[c+2,r-4],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r-2],[c+3,r-1],[c+3,r]]
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 9){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 15){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Building({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'tower',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'tavern' && z == 0){
        var plot = [[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+4,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],[c+4,r-2],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
        var walls = [[c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-3]];
        var topPlot = [[c+1,r-4],[c+2,r-4],[c+3,r-4]];
        var perim = [[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c,r],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r],[c+4,r-3],[c+5,r-3],[c+5,r-2],[c+5,r-1]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 17){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 16){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Tavern({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'tavern',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'monastery' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2],[c,r-3],[c+1,r-3]];
        var walls = [[c+2,r-3],[c+3,r-3],[c,r-4],[c+1,r-4]];
        var topPlot = [[c+2,r-3],[c,r-4],[c+1,r-4]];
        var perim = [[c,r-4],[c+1,r-4],[c+2,r-3],[c+2,r-4],[c+3,r-3],[c-1,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 14){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 18){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Monastery({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'monastery',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'market' && z == 0){
        var plot = [[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+4,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
        var walls = [[c+4,r-2],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
        var topPlot = [[c+4,r-2],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
        var perim = [[c,r-4],[c+1,r-4],[c+2,r-3],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r],[c+4,r-3],[c+5,r-2],[c+5,r-1]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 12){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 18){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Market({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'market',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'stable' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
        var topPlot = [[c+1,r-3],[c+2,r-3],[c+3,r-3]];
        var perim = [[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r],[c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 12){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 16){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Stable({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'stable',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'dock' && z == 0){
        var plot = [];
        var topPlot = [];
        var perim = [];
        if(player.facing == 'up' && getTile(0,c,r-1) == 0 && getTile(0,c,r-3) == 0){
          plot = [[c-1,r],[c,r],[c+1,r],[c-1,r-1],[c,r-1],[c+1,r-1]];
          topPlot = [[c-1,r-2],[c,r-2],[c+1,r-2]];
          perim = [[c-1,r+1],[c,r+1],[c+1,r+1],[c+2,r],[c+2,r-1],[c-1,r-2],[c,r-2],[c+1,r-2],[c-2,r],[c-2,r-1]];
        } else if(player.facing == 'left' && getTile(0,c-1,r) == 0 && getTile(0,c-3,r) == 0){
          plot = [[c-2,r],[c-1,r],[c,r],[c-2,r-1],[c-1,r-1],[c,r-1]];
          topPlot = [[c-2,r-2],[c-1,r-2],[c,r-2]];
          perim = [[c-3,r],[c-3,r-1],[c-2,r+1],[c-1,r+1],[c,r+1],[c+1,r],[c+1,r-1],[c-2,r-2],[c-1,r-2],[c,r-2]];
        } else if(player.facing == 'right' && getTile(0,c+1,r) == 0 && getTile(0,c+3,r) == 0){
          plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1]];
          topPlot = [[c,r-2],[c+1,r-2],[c+2,r-2]];
          perim = [[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c-1,r],[c-1,r-1]];
        } else if(player.facing == 'down' && getTile(0,c,r+1) == 0 && getTile(0,c,r+2) == 0){
          plot = [[c-1,r+1],[c,r+1],[c+1,r+1],[c-1,r],[c,r],[c+1,r]];
          topPlot = [[c-1,r-1],[c,r-1],[c+1,r-1]];
          perim = [[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r],[c+2,r+1],[c-1,r-2],[c,r-2],[c+1,r-2],[c-2,r],[c-2,r+1]];
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || getTile(0,n[0],n[1]) == 0 || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 6){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 10){
            for(var i in plot){
              var n = plot[i];
              if(getTile(0,n[0],n[1]) != 0){
                tileChange(0,n[0],n[1],11);
              } else {
                tileChange(0,n[0],n[1],11.5);
              }
              tileChange(6,n[0],n[1],0);
              matrixChange(0,n[0],n[1],0);
            }
            mapEdit();
            Dock({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'dock',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'garrison' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c+3,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c,r-2],[c+1,r-2],[c+2,r-2],[c+3,r-2]];
        var walls = [[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3]];
        var topPlot = [[c+1,r-3],[c+2,r-3],[c+3,r-3]];
        var perim = [[c-1,r-4],[c,r-4],[c+1,r-4],[c+2,r-4],[c+3,r-4],[c+4,r-4],[c-1,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r+1],[c,r+1],[c+1,r+1],[c+2,r+1],[c+3,r+1],[c+4,r+1],[c+4,r-3],[c+4,r-2],[c+4,r-1],[c+4,r]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 12){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 20){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Garrison({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'garrison',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'forge' && z == 0){
        var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1]];
        var walls = [[c,r-2],[c+1,r-2],[c+2,r-2]];
        var perim = [[c-1,r-3],[c,r-3],[c+1,r-3],[c+2,r-3],[c+3,r-3],[c-1,r-2],[c-1,r-1],[c-1,r],[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c+3,r-1],[c+3,r-2],[c+3,r-1],[c+3,r]];
        var count = 0;
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 6){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 16){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              tileChange(6,n[0],n[1],0);
            }
            mapEdit();
            Forge({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'forge',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'gate' && z == 0){
        var plot = [[c,r],[c+1,r]];
        var sides = [[c-1,r],[c+2,r]];
        if(getTile(3,sides[0][0],sides[0][1]) == 'wall' && getTile(3,sides[1][0],sides[1][1]) == 'wall'){
          var count = 0;
          for(var i in plot){
            var n = plot[i];
            if((getTile(0,n[0],n[1]) == 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) == 18) && getTile(5,n[0],n[1]-1) == 0){
              count++;
            }
          }
          if(count == 2){
            for(var i in plot){
              tileChange(5,plot[i][0],plot[i][1],String('gateo'));
            }
            mapEdit();
            Gate({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'gate',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'road' && z == 0){
        if(getTile(0,c,r) == 7 || (getTile(0,c,r) >= 4 && getTile(0,c,r) < 6)){
          player.working = true;
          player.actionCooldown = 10;
          setTimeout(function(){
            if(player.working){
              tileChange(0,c,r,18);
              tileChange(6,c,r,0);
              player.working = false;
              mapEdit();
            } else {
              return;
            }
          },10000/player.strength);
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1) == 'stronghold' && z == 0){
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
        for(var i in plot){
          var n = plot[i];
          if(getTile(0,n[0],n[1]) == 7 || (getTile(0,n[0],n[1]) >= 4 && getTile(0,n[0],n[1]) < 6) || getTile(0,n[0],n[1]) == 18){
            count++;
          }
        }
        if(count == 58){
          count = 0;
          for(var i in perim){
            var n = perim[i];
            var tile = getTile(0,n[0],n[1]);
            var ttile = getTile(5,n[0],n[1]);
            if(tile != 11 &&
            tile != 11.5 &&
            tile != 12 &&
            tile != 12.5 &&
            tile != 13 &&
            tile != 14 &&
            tile != 15 &&
            tile != 16 &&
            tile != 17 &&
            tile != 19 &&
            tile != 20 &&
            tile != 20.5 &&
            (ttile == 0 || ttile == 'dock6' || ttile == 'dock7' || ttile == 'dock8')){
              count++;
            }
          }
          if(count == 40){
            for(var i in plot){
              var n = plot[i];
              tileChange(0,n[0],n[1],11);
              //tileChange(6,n[0],n[1],0); // ALPHA
            }
            mapEdit();
            Stronghold({
              owner:player.id,
              house:player.house,
              kingdom:player.kingdom,
              x:player.x,
              y:player.y,
              z:0,
              type:'stronghold',
              built:false,
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
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot build that there.</i>'}));
        }
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Invalid command.</i>'}));
      }
    } else if(data.cmd == 'fire'){
      if(z != -3){
        var f = null;
        if(player.facing == 'left'){
          f = [c-1,r];
        } else if(player.facing == 'right'){
          f = [c+1,r];
        } else if(player.facing == 'up'){
          f = [c,r-1];
        } else if(player.facing == 'down'){
          f = [c,r+1];
        }
        if((z == 1 || z == 2) && getTile(4,f[0],f[1]) != 0){
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot place that there.</i>'}));
        } else {
          var p = getCoords(f[0],f[1]);
          Campfire({
            parent:player.id,
            x:p[0],
            y:p[1],
            z:z,
            qty:1
          });
        }
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot start a fire here.</i>'}));
      }
      // EQUIPPING
    } else if(data.cmd == 'equip'){
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>List all equippable items here.</i>'}));
    } else if(data.cmd.slice(0,5) == 'equip' && data.cmd[5] == ' '){
      if(player.mode != 'combat'){
        if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'huntingknife'){
          if(player.inventory.huntingknife > 0){
            if(!player.mounted && (!player.gear.armor || player.gear.armor.type == 'leather' || (player.gear.armor.type == 'cloth' && player.gear.armor.name != 'ClericRobe'))){
              if(!player.gear.weapon){
                player.gear.weapon = equip.huntingknife;
                player.inventory.huntingknife--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>HuntingKnife</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.huntingknife;
                player.inventory.huntingknife--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>HuntingKnife </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be wearing leather armor and not be mounted.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>HuntingKnife</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'dague'){
          if(player.inventory.dague > 0){
            if(!player.mounted && (!player.gear.armor || player.gear.armor.type == 'leather' || (player.gear.armor.type == 'cloth' && player.gear.armor.name != 'ClericRobe'))){
              if(!player.gear.weapon){
                player.gear.weapon = equip.dague;
                player.inventory.dague--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Dague</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.dague;
                player.inventory.dague--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Dague </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be wearing leather armor and not be mounted.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>Dague</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'rondel'){
          if(player.inventory.rondel > 0){
            if(!player.mounted && (!player.gear.armor || player.gear.armor.type == 'leather' || (player.gear.armor.type == 'cloth' && player.gear.armor.name != 'ClericRobe'))){
              if(!player.gear.weapon){
                player.gear.weapon = equip.rondel;
                player.inventory.rondel--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Rondel</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.rondel;
                player.inventory.rondel--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Rondel </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be wearing leather armor and not be mounted.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>Rondel</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'misericorde'){
          if(player.inventory.misericorde > 0){
            if(!player.mounted && (!player.gear.armor || player.gear.armor.type == 'leather' || (player.gear.armor.type == 'cloth' && player.gear.armor.name != 'ClericRobe'))){
              if(!player.gear.weapon){
                player.gear.weapon = equip.misericorde;
                player.inventory.misericorde--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Misericorde</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.misericorde;
                player.inventory.misericorde--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Misericorde </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be wearing leather armor and not be mounted.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Misericorde</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'bastardsword'){
          if(player.inventory.bastardsword > 0){
            if(!player.gear.armor || player.gear.armor.type != 'cloth'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.bastardsword;
                player.inventory.bastardsword--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>BastardSword</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.bastardsword;
                player.inventory.bastardsword--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>BastardSword </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be wearing cloth.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>BastardSword</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'longsword'){
          if(player.inventory.longsword > 0){
            if(!player.gear.armor || player.gear.armor.type != 'cloth'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.longsword;
                player.inventory.longsword--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Longsword</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.longsword;
                player.inventory.longsword--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Longsword </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be wearing cloth.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>Longsword</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'zweihander'){
          if(player.inventory.zweihander > 0){
            if(!player.gear.armor || player.gear.armor.type != 'cloth'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.zweihander;
                player.inventory.zweihander--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Zweihander</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.zweihander;
                player.inventory.zweihander--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Zweihander </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be wearing cloth.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>Zweihander</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'morallta'){
          if(player.inventory.morallta > 0){
            if(!player.gear.armor || player.gear.armor.type != 'cloth'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.morallta;
                player.inventory.morallta--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Morallta</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.morallta;
                player.inventory.morallta--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Morallta </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be wearing cloth.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Morallta</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'bow'){
          if(player.inventory.bow > 0){
            if(!player.gear.armor || (player.gear.armor.type != 'cloth' && player.gear.armor.type != 'plate')){
              if(!player.gear.weapon){
                player.gear.weapon = equip.bow;
                player.inventory.bow--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Bow</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.bow;
                player.inventory.bow--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>Bow </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be wearing cloth or plate armor.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>Bow</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'welshlongbow'){
          if(player.inventory.welshlongbow > 0){
            if(!player.gear.armor || (player.gear.armor.type != 'cloth' && player.gear.armor.type != 'plate')){
              if(!player.gear.weapon){
                player.gear.weapon = equip.welshlongbow;
                player.inventory.welshlongbow--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>WelshLongbow</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.welshlongbow;
                player.inventory.welshlongbow--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>WelshLongbow </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be wearing cloth or plate armor.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>WelshLongbow</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'knightlance'){
          if(player.inventory.knightlance > 0){
            if(player.mounted && player.gear.armor.type == 'plate'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.knightlance;
                player.inventory.knightlance--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>KnightLance</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.knightlance;
                player.inventory.knightlance--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>KnightLance </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be mounted and wearing plate armor.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>KnightLance</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'rusticlance'){
          if(player.inventory.rusticlance > 0){
            if(player.mounted && player.gear.armor.type == 'plate'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.rusticlance;
                player.inventory.rusticlance--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>RusticLance</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.rusticlance;
                player.inventory.rusticlance--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>RusticLance </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be mounted and wearing plate armor.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>RusticLance</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'paladinlance'){
          if(player.inventory.paladinlance > 0){
            if(player.mounted && player.gear.armor.type == 'plate'){
              if(!player.gear.weapon){
                player.gear.weapon = equip.paladinlance;
                player.inventory.paladinlance--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>PaladinLance</b>.'}));
              } else {
                if(player.gear.weapon2){
                  player.gear.weapon2.unequip(player.id);
                }
                player.gear.weapon2 = equip.paladinlance;
                player.inventory.paladinlance--;
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped a </i><b>PaladinLance </b><i>as your secondary weapon. Press X to switch.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be mounted and wearing plate armor.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying a </i><b>PaladinLance</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'brigandine'){
          if(player.inventory.brigandine > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'lance' || player.gear.weapon2.type != 'lance')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.brigandine;
              player.inventory.brigandine--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Brigandine</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a lance equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Brigandine</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'lamellar'){
          if(player.inventory.lamellar > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'lance' || player.gear.weapon2.type != 'lance')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.lamellar;
              player.inventory.lamellar--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Lamellar</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a lance equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Lamellar</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'maille'){
          if(player.inventory.maille > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'lance' || player.gear.weapon2.type != 'lance' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.maille;
              player.inventory.maille--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Maille</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or lance equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Maille</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'hauberk'){
          if(player.inventory.hauberk > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'lance' || player.gear.weapon2.type != 'lance' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.hauberk;
              player.inventory.hauberk--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Hauberk</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or lance equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Hauberk</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'brynja'){
          if(player.inventory.brynja > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'lance' || player.gear.weapon2.type != 'lance' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.brynja;
              player.inventory.brynja--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Brynja</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or lance equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Brynja</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'cuirass'){
          if(player.inventory.cuirass > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'bow' || player.gear.weapon2.type != 'bow' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.cuirass;
              player.inventory.cuirass--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Cuirass</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or bow equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Cuirass</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'steelplate'){
          if(player.inventory.steelplate > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'bow' || player.gear.weapon2.type != 'bow' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.steelplate;
              player.inventory.steelplate--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>SteelPlate</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or bow equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>SteelPlate</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'greenwichplate'){
          if(player.inventory.greenwichplate > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'bow' || player.gear.weapon2.type != 'bow' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.greenwichplate;
              player.inventory.greenwichplate--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>GreenwichPlate</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or bow equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>GreenwichPlate</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'gothicplate'){
          if(player.inventory.gothicplate > 0){
            if(!player.gear.weapon || (player.gear.weapon.type != 'bow' || player.gear.weapon2.type != 'bow' ||
            player.gear.weapon.type != 'dagger' || player.gear.weapon2.type != 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.gothicplate;
              player.inventory.gothicplate--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>GothicPlate</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not have a dagger or bow equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>GothicPlate</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'clericrobe'){
          if(player.inventory.clericrobe > 0){
            if(!player.mounted && !player.gear.weapon){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.clericrobe;
              player.inventory.clericrobe--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>ClericRobe</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be mounted or have a weapon equipped.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>ClericRobe</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'monkcowl'){
          if(player.inventory.monkcowl > 0){
            if(!player.mounted && (!player.gear.weapon || player.gear.weapon.type == 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.monkcowl;
              player.inventory.monkcowl--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>MonkCowl</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be mounted and may only carry a dagger.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>MonkCowl</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'blackcloak'){
          if(player.inventory.blackcloak > 0){
            if(!player.mounted && (!player.gear.weapon || player.gear.weapon.type == 'dagger')){
              if(player.gear.armor){
                player.gear.armor.unequip(player.id);
              }
              player.gear.armor = equip.blackcloak;
              player.inventory.blackcloak--;
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>BlackCloak</b>.'}));
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must not be mounted and may only carry a dagger.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>BlackCloak</b>.'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'crown'){
          if(player.inventory.crown > 0){
            if(player.gear.head){
              player.gear.head.unequip(player.id);
            }
            player.gear.head = equip.crown;
            player.inventory.crown--;
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You equipped </i><b>Crown</b>.'}));
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not carrying </i><b>Crown</b>.'}));
          }
        }
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot equip gear while in combat.</i>'}));
      }
    } else if(data.cmd == 'unequip'){
      var all = '';

      if(player.gear.head){
        var head = '<b>'+player.gear.head.name+'</b>: /unequip head<br>';
        all += head;
      }
      if(player.gear.armor){
        var armor = '<b>'+player.gear.armor.name+'</b>: /unequip armor<br>';
        all += armor;
      }
      if(player.gear.weapon){
        var weapon = '<b>'+player.gear.weapon.name+'</b>: /unequip weapon<br>';
        all += weapon;
      }
      if(player.gear.weapon2){
        var weapon2 = '<b>'+player.gear.weapon2.name+'</b>: /unequip weapon2<br>';
        all += weapon2;
      }
      if(player.gear.accessory){
        var accessory = '<b>'+player.gear.accessory.name+'</b>: /unequip accessory';
        all += accessory;
      }
      if(all == ''){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have nothing equipped.</i>'}));
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<p>'+all+'</p>'}));
      }
    } else if(data.cmd.slice(0,7) == 'unequip' && data.cmd[7] == ' '){
      if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'head'){
        if(player.gear.head){
          player.gear.head.unequip(player.id);
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You unequip </i><b>' + player.gear.head.name + '</b>.'}));
          player.gear.head = null;
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not wearing any headgear.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'armor'){
        if(player.gear.armor){
          if(player.mounted){
            player.mounted = false;
            player.baseSpd -= 3;
            player.mountCooldown = 200;
          }
          player.gear.armor.unequip(player.id);
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You unequip </i><b>' + player.gear.armor.name + '</b>.'}));
          player.gear.armor = null;
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are not wearing any armor.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'weapon'){
        if(player.gear.weapon){
          player.gear.weapon.unequip(player.id);
          if(player.gear.weapon2){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You unequip </i><b>' + player.gear.weapon.name +
            '</b><i> and switch weapons to </i><b>' + player.gear.weapon2.name + '</b>.'}));
            player.gear.weapon = player.gear.weapon2;
            player.gear.weapon2 = null;
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You unequip </i><b>' + player.gear.weapon.name + '</b>.'}));
            player.gear.weapon = null;
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have any weapons equipped.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'weapon2'){
        if(player.gear.weapon2){
          player.gear.weapon2.unequip(player.id);
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You unequip </i><b>' + player.gear.weapon2.name + '</b>.'}));
          player.gear.weapon2 = null;
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have a secondary weapon equipped.</i>'}));
        }
      } else if(data.cmd.slice(data.cmd.indexOf(' ') + 1).toLowerCase() == 'accessory'){
        if(player.gear.accessory){
          player.gear.accessory.unequip(player.id);
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You unequip </i><b>' + player.gear.accessory.name + '</b>.'}));
          player.gear.accessory = null;
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have an accessory equipped.</i>'}));
        }
      }
    } else if(data.cmd == 'drop'){
      socket.write(JSON.stringify({msg:'addToChat',message:'<p>/drop Quantity ItemName</p>'}));
    } else if(data.cmd == 'drop key'){
      socket.write(JSON.stringify({msg:'addToChat',message:'<p>/drop key Number</p>'}));
      for(var i = 0; i < player.inventory.keyRing.length; i++){
        socket.write(JSON.stringify({msg:'addToChat',message:'<p>' + i+1 + ': ' + player.inventory.keyRing[i].name}));
      }
    } else if(data.cmd.slice(0,9) == 'drop key '){
      var num = Number(data.cmd.slice(data.cmd[9])).toFixed(0) - 1;
      if(num){
        if(player.inventory.keyRing[num]){
          var key = player.inventory.keyRing[num];
          if(player.facing == 'up'){
            if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
              var chCoords = getCoords(c,r-1);
              var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
              if(ch){
                if(player.inventory.keyRing[num].id == ch){
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot lock the chest without the key.</i>'}));
                } else {
                  Player.list[player.id].inventory.key--;
                  Player.list[player.id].inventory.keyRing.splice(num,num);
                  Item.list[ch].inventory.key++;
                  Item.list[ch].inventory.keyRing.push(key);
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
              }
            } else if(isWalkable(z,c,r-1)){
              var coords = getCoords(c,r-1);
              Key({
                z:z,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
              var coords = getCoords(c,r-1);
              Key({
                z:-3,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            }
          } else if(player.facing == 'down'){
            if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
              var chCoords = getCoords(c,r+1);
              var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
              if(ch){
                if(player.inventory.keyRing[num].id == ch){
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot lock the chest without the key.</i>'}));
                } else {
                  Player.list[player.id].inventory.key--;
                  Player.list[player.id].inventory.keyRing.splice(num,num);
                  Item.list[ch].inventory.key++;
                  Item.list[ch].inventory.keyRing.push(key);
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
              }
            } else if(isWalkable(z,c,r+1)){
              var coords = getCoords(c,r+1);
              Key({
                z:z,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
              var coords = getCoords(c,r+1);
              Key({
                z:-3,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            }
          } else if(player.facing == 'left'){
            if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
              var chCoords = getCoords(c-1,r);
              var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
              if(ch){
                if(player.inventory.keyRing[num].id == ch){
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot lock the chest without the key.</i>'}));
                } else {
                  Player.list[player.id].inventory.key--;
                  Player.list[player.id].inventory.keyRing.splice(num,num);
                  Item.list[ch].inventory.key++;
                  Item.list[ch].inventory.keyRing.push(key);
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
              }
            } else if(isWalkable(z,c-1,r)){
              var coords = getCoords(c-1,r);
              Key({
                z:z,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
              var coords = getCoords(c-1,r);
              Key({
                z:-3,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            }
          } else if(player.facing == 'right'){
            if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
              var chCoords = getCoords(c+1,r);
              var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
              if(ch){
                if(player.inventory.keyRing[num].id == ch){
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot lock the chest without the key.</i>'}));
                } else {
                  Player.list[player.id].inventory.key--;
                  Player.list[player.id].inventory.keyRing.splice(num,num);
                  Item.list[ch].inventory.key++;
                  Item.list[ch].inventory.keyRing.push(key);
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
              }
            } else if(isWalkable(z,c+1,r)){
              var coords = getCoords(c+1,r);
              Key({
                z:z,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
              var coords = getCoords(c+1,r);
              Key({
                z:-3,
                x:coords[0],
                y:coords[1],
                id:key.id,
                name:key.name,
                qty:1,
                parent:player.id
              });
              Player.list[player.id].inventory.key--;
              Player.list[player.id].inventory.keyRing.splice(num,num);
            }
          }
        }
      }

    } else if(data.cmd.slice(0,4) == 'drop' && data.cmd[4] == ' '){
      var target = String(data.cmd.slice(data.cmd.indexOf(' ') + 1)).toLowerCase();
      var q = Number(target.slice(0,target.indexOf(' '))).toFixed(0);
      var item = String(target.slice(target.indexOf(' ') + 1)).toLowerCase();
      if(q < 1){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Quantity must be greater than 0.</i>'}));
      } else if(Number.isNaN(q/1)){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Quantity must be a number.</i>'}));
      } else {
        if(item == 'wood'){
          if(q > player.inventory.wood){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.wood -= q;
                  Item.list[ch].inventory.wood += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Wood({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Wood({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.wood -= q;
                  Item.list[ch].inventory.wood += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Wood({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Wood({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.wood -= q;
                  Item.list[ch].inventory.wood += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Wood({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Wood({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.wood -= q;
                  Item.list[ch].inventory.wood += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Wood({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Wood({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              }
            }
          }
        } else if(item == 'stone'){
          if(q > player.inventory.stone){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stone -= q;
                  Item.list[ch].inventory.stone += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Stone({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Stone({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stone -= q;
                  Item.list[ch].inventory.stone += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Stone({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Stone({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stone -= q;
                  Item.list[ch].inventory.stone += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Stone({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Stone({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stone -= q;
                  Item.list[ch].inventory.stone += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Stone({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Stone({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stone -= q;
              }
            }
          }
        } else if(item == 'grain'){
          if(q > player.inventory.grain){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.grain -= q;
                  Item.list[ch].inventory.grain += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Grain({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Grain({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.grain -= q;
                  Item.list[ch].inventory.grain += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Grain({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Grain({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.grain -= q;
                  Item.list[ch].inventory.grain += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Grain({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Grain({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.grain -= q;
                  Item.list[ch].inventory.grain += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Grain({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Grain({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.grain -= q;
              }
            }
          }
        } else if(item == 'ironore'){
          if(q > player.inventory.ironore){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironore -= q;
                  Item.list[ch].inventory.ironore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                IronOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                IronOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironore -= q;
                  Item.list[ch].inventory.ironore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                IronOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                IronOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironore -= q;
                  Item.list[ch].inventory.ironore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                IronOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                IronOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironore -= q;
                  Item.list[ch].inventory.ironore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                IronOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                IronOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironore -= q;
              }
            }
          }
        } else if(item == 'iron'){
          if(q > player.inventory.iron){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.iron -= q;
                  Item.list[ch].inventory.iron += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Iron({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Iron({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.iron -= q;
                  Item.list[ch].inventory.iron += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Iron({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Iron({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.iron -= q;
                  Item.list[ch].inventory.iron += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Iron({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Iron({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.iron -= q;
                  Item.list[ch].inventory.iron += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Iron({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Iron({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.iron -= q;
              }
            }
          }
        } else if(item == 'steel'){
          if(q > player.inventory.steel){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steel -= q;
                  Item.list[ch].inventory.steel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Steel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Steel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steel -= q;
                  Item.list[ch].inventory.steel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Steel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Steel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steel -= q;
                  Item.list[ch].inventory.steel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Steel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Steel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steel -= q;
                  Item.list[ch].inventory.steel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Steel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Steel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steel -= q;
              }
            }
          }
        } else if(item == 'boarhide'){
          if(q > player.inventory.boarhide){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarhide -= q;
                  Item.list[ch].inventory.boarhide += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                BoarHide({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                BoarHide({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarhide -= q;
                  Item.list[ch].inventory.boarhide += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                BoarHide({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                BoarHide({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarhide -= q;
                  Item.list[ch].inventory.boarhide += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                BoarHide({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                BoarHide({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarhide -= q;
                  Item.list[ch].inventory.boarhide += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                BoarHide({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                BoarHide({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarhide -= q;
              }
            }
          }
        } else if(item == 'leather'){
          if(q > player.inventory.leather){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.leather -= q;
                  Item.list[ch].inventory.leather += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Leather({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Leather({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.leather -= q;
                  Item.list[ch].inventory.leather += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Leather({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              } else if(isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Leather({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.leather -= q;
                  Item.list[ch].inventory.leather += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Leather({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Leather({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.leather -= q;
                  Item.list[ch].inventory.leather += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Leather({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Leather({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.leather -= q;
              }
            }
          }
        } else if(item == 'silverore'){
          if(q > player.inventory.silverore){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silverore -= q;
                  Item.list[ch].inventory.silverore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                SilverOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                SilverOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silverore -= q;
                  Item.list[ch].inventory.silverore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                SilverOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                SilverOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silverore -= q;
                  Item.list[ch].inventory.silverore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                SilverOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                SilverOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silverore -= q;
                  Item.list[ch].inventory.silverore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                SilverOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                SilverOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silverore -= q;
              }
            }
          }
        } else if(item == 'silver'){
          if(q > player.inventory.silver){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silver -= q;
                  Item.list[ch].inventory.silver += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Silver({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Silver({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silver -= q;
                  Item.list[ch].inventory.silver += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Silver({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Silver({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silver -= q;
                  Item.list[ch].inventory.silver += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Silver({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Silver({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.silver -= q;
                  Item.list[ch].inventory.silver += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(!isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Silver({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              } else if(isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Silver({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.silver -= q;
              }
            }
          }
        } else if(item == 'goldore'){
          if(q > player.inventory.goldore){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.goldore -= q;
                  Item.list[ch].inventory.goldore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                GoldOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                GoldOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.goldore -= q;
                  Item.list[ch].inventory.goldore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                GoldOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                GoldOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.goldore -= q;
                  Item.list[ch].inventory.goldore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                GoldOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                GoldOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.goldore -= q;
                  Item.list[ch].inventory.goldore += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                GoldOre({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                GoldOre({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.goldore -= q;
              }
            }
          }
        } else if(item == 'gold'){
          if(q > player.inventory.gold){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gold -= q;
                  Item.list[ch].inventory.gold += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Gold({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Gold({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gold -= q;
                  Item.list[ch].inventory.gold += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Gold({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Gold({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gold -= q;
                  Item.list[ch].inventory.gold += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Gold({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Gold({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gold -= q;
                  Item.list[ch].inventory.gold += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Gold({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Gold({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gold -= q;
              }
            }
          }
        } else if(item == 'diamond'){
          if(q > player.inventory.diamond){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.diamond -= q;
                  Item.list[ch].inventory.diamond += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Diamond({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Diamond({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.diamond -= q;
                  Item.list[ch].inventory.diamond += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Diamond({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              } else if(isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Diamond({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.diamond -= q;
                  Item.list[ch].inventory.diamond += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Diamond({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Diamond({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.diamond -= q;
                  Item.list[ch].inventory.diamond += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Diamond({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Diamond({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.diamond -= q;
              }
            }
          }
        } else if(item == 'huntingknife'){
          if(q > player.inventory.huntingknife){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.huntingknife -= q;
                  Item.list[ch].inventory.huntingknife += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                HuntingKnife({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                HuntingKnife({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.huntingknife -= q;
                  Item.list[ch].inventory.huntingknife += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                HuntingKnife({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                HuntingKnife({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.huntingknife -= q;
                  Item.list[ch].inventory.huntingknife += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                HuntingKnife({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                HuntingKnife({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.huntingknife -= q;
                  Item.list[ch].inventory.huntingknife += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                HuntingKnife({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                HuntingKnife({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.huntingknife -= q;
              }
            }
          }
        } else if(item == 'dague'){
          if(q > player.inventory.dague){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.dague -= q;
                  Item.list[ch].inventory.dague += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Dague({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Dague({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.dague -= q;
                  Item.list[ch].inventory.dague += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Dague({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Dague({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.dague -= q;
                  Item.list[ch].inventory.dague += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Dague({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Dague({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.dague -= q;
                  Item.list[ch].inventory.dague += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Dague({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Dague({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.dague -= q;
              }
            }
          }
        } else if(item == 'rondel'){
          if(q > player.inventory.rondel){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rondel -= q;
                  Item.list[ch].inventory.rondel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Rondel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Rondel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rondel -= q;
                  Item.list[ch].inventory.rondel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Rondel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Rondel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rondel -= q;
                  Item.list[ch].inventory.rondel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Rondel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Rondel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rondel -= q;
                  Item.list[ch].inventory.rondel += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Rondel({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Rondel({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rondel -= q;
              }
            }
          }
        } else if(item == 'misericorde'){
          if(q > player.inventory.misericorde){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.misericorde -= q;
                  Item.list[ch].inventory.misericorde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Misericorde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Misericorde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.misericorde -= q;
                  Item.list[ch].inventory.misericorde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Misericorde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Misericorde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.misericorde -= q;
                  Item.list[ch].inventory.misericorde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Misericorde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Misericorde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.misericorde -= q;
                  Item.list[ch].inventory.misericorde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Misericorde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Misericorde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.misericorde -= q;
              }
            }
          }
        } else if(item == 'bastardsword'){
          if(q > player.inventory.bastardsword){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bastardsword -= q;
                  Item.list[ch].inventory.bastardsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                BastardSword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                BastardSword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bastardsword -= q;
                  Item.list[ch].inventory.bastardsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                BastardSword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                BastardSword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bastardsword -= q;
                  Item.list[ch].inventory.bastardsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                BastardSword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                BastardSword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bastardsword -= q;
                  Item.list[ch].inventory.bastardsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                BastardSword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                BastardSword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bastardsword -= q;
              }
            }
          }
        } else if(item == 'longsword'){
          if(q > player.inventory.longsword){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.longsword -= q;
                  Item.list[ch].inventory.longsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Longsword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Longsword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.longsword -= q;
                  Item.list[ch].inventory.longsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Longsword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Longsword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.longsword -= q;
                  Item.list[ch].inventory.longsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Longsword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Longsword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.longsword -= q;
                  Item.list[ch].inventory.longsword += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Longsword({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Longsword({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.longsword -= q;
              }
            }
          }
        } else if(item == 'zweihander'){
          if(q > player.inventory.zweihander){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.zweihander -= q;
                  Item.list[ch].inventory.zweihander += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Zweihander({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Zweihander({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.zweihander -= q;
                  Item.list[ch].inventory.zweihander += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Zweihander({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Zweihander({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.zweihander -= q;
                  Item.list[ch].inventory.zweihander += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Zweihander({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Zweihander({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.zweihander -= q;
                  Item.list[ch].inventory.zweihander += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Zweihander({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Zweihander({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.zweihander -= q;
              }
            }
          }
        } else if(item == 'morallta'){
          if(q > player.inventory.morallta){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.morallta -= q;
                  Item.list[ch].inventory.morallta += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Morallta({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Morallta({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.morallta -= q;
                  Item.list[ch].inventory.morallta += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Morallta({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Morallta({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.morallta -= q;
                  Item.list[ch].inventory.morallta += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Morallta({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Morallta({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.morallta -= q;
                  Item.list[ch].inventory.morallta += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Morallta({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Morallta({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.morallta -= q;
              }
            }
          }
        } else if(item == 'bow'){
          if(q > player.inventory.bow){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bow -= q;
                  Item.list[ch].inventory.bow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Bow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Bow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bow -= q;
                  Item.list[ch].inventory.bow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Bow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Bow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bow -= q;
                  Item.list[ch].inventory.bow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Bow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Bow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bow -= q;
                  Item.list[ch].inventory.bow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Bow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Bow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bow -= q;
              }
            }
          }
        } else if(item == 'welshlongbow'){
          if(q > player.inventory.welshlongbow){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.welshlongbow -= q;
                  Item.list[ch].inventory.welshlongbow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                WelshLongbow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                WelshLongbow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.welshlongbow -= q;
                  Item.list[ch].inventory.welshlongbow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                WelshLongbow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              } else if(isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                WelshLongbow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.welshlongbow -= q;
                  Item.list[ch].inventory.welshlongbow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                WelshLongbow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                WelshLongbow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.welshlongbow -= q;
                  Item.list[ch].inventory.welshlongbow += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                WelshLongbow({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                WelshLongbow({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.welshlongbow -= q;
              }
            }
          }
        } else if(item == 'knightlance'){
          if(q > player.inventory.knightlance){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.knightlance -= q;
                  Item.list[ch].inventory.knightlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                KnightLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                KnightLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.knightlance -= q;
                  Item.list[ch].inventory.knightlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                KnightLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                KnightLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.knightlance -= q;
                  Item.list[ch].inventory.knightlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                KnightLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              } else if(isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                KnightLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.knightlance -= q;
                  Item.list[ch].inventory.knightlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                KnightLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              } else if(isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                KnightLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.knightlance -= q;
              }
            }
          }
        } else if(item == 'rusticlance'){
          if(q > player.inventory.rusticlance){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rusticlance -= q;
                  Item.list[ch].inventory.rusticlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                RusticLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                RusticLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rusticlance -= q;
                  Item.list[ch].inventory.rusticlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                RusticLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                RusticLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rusticlance -= q;
                  Item.list[ch].inventory.rusticlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                RusticLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              } else if(isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                RusticLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.wood -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.rusticlance -= q;
                  Item.list[ch].inventory.rusticlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                RusticLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                RusticLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.rusticlance -= q;
              }
            }
          }
        } else if(item == 'paladinlance'){
          if(q > player.inventory.paladinlance){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.paladinlance -= q;
                  Item.list[ch].inventory.paladinlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                PaladinLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                PaladinLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.paladinlance -= q;
                  Item.list[ch].inventory.paladinlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                PaladinLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                PaladinLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.paladinlance -= q;
                  Item.list[ch].inventory.paladinlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                PaladinLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                PaladinLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.paladinlance -= q;
                  Item.list[ch].inventory.paladinlance += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                PaladinLance({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                PaladinLance({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.paladinlance -= q;
              }
            }
          }
        } else if(item == 'brigandine'){
          if(q > player.inventory.brigandine){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brigandine -= q;
                  Item.list[ch].inventory.brigandine += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Brigandine({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Brigandine({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brigandine -= q;
                  Item.list[ch].inventory.brigandine += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Brigandine({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Brigandine({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brigandine -= q;
                  Item.list[ch].inventory.brigandine += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Brigandine({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Brigandine({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brigandine -= q;
                  Item.list[ch].inventory.brigandine += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Brigandine({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Brigandine({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brigandine -= q;
              }
            }
          }
        } else if(item == 'lamellar'){
          if(q > player.inventory.lamellar){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamellar -= q;
                  Item.list[ch].inventory.lamellar += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Lamellar({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Lamellar({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamellar -= q;
                  Item.list[ch].inventory.lamellar += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Lamellar({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Lamellar({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamellar -= q;
                  Item.list[ch].inventory.lamellar += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Lamellar({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Lamellar({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamellar -= q;
                  Item.list[ch].inventory.lamellar += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Lamellar({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Lamellar({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamellar -= q;
              }
            }
          }
        } else if(item == 'maille'){
          if(q > player.inventory.maille){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.maille -= q;
                  Item.list[ch].inventory.maille += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Maille({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Maille({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.maille -= q;
                  Item.list[ch].inventory.maille += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Maille({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Maille({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.maille -= q;
                  Item.list[ch].inventory.maille += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Maille({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              } else if(isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Maille({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.maille -= q;
                  Item.list[ch].inventory.maille += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Maille({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              } else if(isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Maille({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.maille -= q;
              }
            }
          }
        } else if(item == 'hauberk'){
          if(q > player.inventory.hauberk){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.hauberk -= q;
                  Item.list[ch].inventory.hauberk += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Hauberk({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r) == 0){
                var coords = getCoords(c,r-1);
                Hauberk({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.hauberk -= q;
                  Item.list[ch].inventory.hauberk += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Hauberk({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Hauberk({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.hauberk -= q;
                  Item.list[ch].inventory.hauberk += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Hauberk({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Hauberk({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.hauberk -= q;
                  Item.list[ch].inventory.hauberk += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Hauberk({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Hauberk({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.hauberk -= q;
              }
            }
          }
        } else if(item == 'brynja'){
          if(q > player.inventory.brynja){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brynja -= q;
                  Item.list[ch].inventory.brynja += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Brynja({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r) == 0){
                var coords = getCoords(c,r-1);
                Brynja({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brynja -= q;
                  Item.list[ch].inventory.brynja += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Brynja({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Brynja({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brynja -= q;
                  Item.list[ch].inventory.brynja += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Brynja({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Brynja({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.brynja -= q;
                  Item.list[ch].inventory.brynja += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Brynja({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              } else if(isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Brynja({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.brynja -= q;
              }
            }
          }
        } else if(item == 'cuirass'){
          if(q > player.inventory.cuirass){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.cuirass -= q;
                  Item.list[ch].inventory.cuirass += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Cuirass({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Cuirass({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.cuirass -= q;
                  Item.list[ch].inventory.cuirass += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Cuirass({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Cuirass({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.cuirass -= q;
                  Item.list[ch].inventory.cuirass += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Cuirass({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Cuirass({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.cuirass -= q;
                  Item.list[ch].inventory.cuirass += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Cuirass({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Cuirass({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.cuirass -= q;
              }
            }
          }
        } else if(item == 'steelplate'){
          if(q > player.inventory.steelplate){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steelplate -= q;
                  Item.list[ch].inventory.steelplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                SteelPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                SteelPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steelplate -= q;
                  Item.list[ch].inventory.steelplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                SteelPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              } else if(isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                SteelPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steelplate -= q;
                  Item.list[ch].inventory.steelplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                SteelPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                SteelPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.steelplate -= q;
                  Item.list[ch].inventory.steelplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                SteelPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                SteelPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.steelplate -= q;
              }
            }
          }
        } else if(item == 'greenwichplate'){
          if(q > player.inventory.greenwichplate){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.greenwichplate -= q;
                  Item.list[ch].inventory.greenwichplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                GreenwichPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                GreenwichPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.greenwichplate -= q;
                  Item.list[ch].inventory.greenwichplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                GreenwichPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                GreenwichPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.greenwichplate -= q;
                  Item.list[ch].inventory.greenwichplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                GreenwichPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                GreenwichPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.greenwichplate -= q;
                  Item.list[ch].inventory.greenwichplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                GreenwichPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                GreenwichPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.greenwichplate -= q;
              }
            }
          }
        } else if(item == 'gothicplate'){
          if(q > player.inventory.gothicplate){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gothicplate -= q;
                  Item.list[ch].inventory.gothicplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                GothicPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                GothicPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gothicplate -= q;
                  Item.list[ch].inventory.gothicplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                GothicPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                GothicPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gothicplate -= q;
                  Item.list[ch].inventory.gothicplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                GothicPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                GothicPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.gothicplate -= q;
                  Item.list[ch].inventory.gothicplate += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                GothicPlate({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                GothicPlate({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.gothicplate -= q;
              }
            }
          }
        } else if(item == 'clericrobe'){
          if(q > player.inventory.clericrobe){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.clericrobe -= q;
                  Item.list[ch].inventory.clericrobe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                ClericRobe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                ClericRobe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.clericrobe -= q;
                  Item.list[ch].inventory.clericrobe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                ClericRobe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                ClericRobe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.clericrobe -= q;
                  Item.list[ch].inventory.clericrobe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                ClericRobe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                ClericRobe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.clericrobe -= q;
                  Item.list[ch].inventory.clericrobe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                ClericRobe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                ClericRobe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.clericrobe -= q;
              }
            }
          }
        } else if(item == 'monkcowl'){
          if(q > player.inventory.monkcowl){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.monkcowl -= q;
                  Item.list[ch].inventory.monkcowl += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                MonkCowl({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                MonkCowl({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.monkcowl -= q;
                  Item.list[ch].inventory.monkcowl += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                MonkCowl({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                MonkCowl({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.monkcowl -= q;
                  Item.list[ch].inventory.monkcowl += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                MonkCowl({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                MonkCowl({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.monkcowl -= q;
                  Item.list[ch].inventory.monkcowl += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                MonkCowl({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                MonkCowl({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.monkcowl -= q;
              }
            }
          }
        } else if(item == 'blackcloak'){
          if(q > player.inventory.blackcloak){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.blackcloak -= q;
                  Item.list[ch].inventory.blackcloak += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                BlackCloak({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                BlackCloak({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.blackcloak -= q;
                  Item.list[ch].inventory.blackcloak += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                BlackCloak({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                BlackCloak({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.blackcloak -= q;
                  Item.list[ch].inventory.blackcloak += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                BlackCloak({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                BlackCloak({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.blackcloak -= q;
                  Item.list[ch].inventory.blackcloak += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                BlackCloak({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                BlackCloak({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.blackcloak -= q;
              }
            }
          }
        } else if(item == 'tome'){
          if(q > player.inventory.tome){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.tome -= q;
                  Item.list[ch].inventory.tome += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Tome({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Tome({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.tome -= q;
                  Item.list[ch].inventory.tome += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Tome({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Tome({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.tome -= q;
                  Item.list[ch].inventory.tome += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Tome({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Tome({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.tome -= q;
                  Item.list[ch].inventory.tome += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Tome({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Tome({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.tome -= q;
              }
            }
          }
        } else if(item == 'runicscroll'){
          if(q > player.inventory.runicscroll){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.runicscroll -= q;
                  Item.list[ch].inventory.runicscroll += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                RunicScroll({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                RunicScroll({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.runicscroll -= q;
                  Item.list[ch].inventory.runicscroll += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                RunicScroll({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                RunicScroll({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.runicscroll -= q;
                  Item.list[ch].inventory.runicscroll += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                RunicScroll({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                RunicScroll({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.runicscroll -= q;
                  Item.list[ch].inventory.runicscroll += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                RunicScroll({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                RunicScroll({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.runicscroll -= q;
              }
            }
          }
        } else if(item == 'sacredtext'){
          if(q > player.inventory.sacredtext){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.sacredtext -= q;
                  Item.list[ch].inventory.sacredtext += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                SacredText({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                SacredText({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.sacredtext -= q;
                  Item.list[ch].inventory.sacredtext += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                SacredText({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                SacredText({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.sacredtext -= q;
                  Item.list[ch].inventory.sacredtext += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                SacredText({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                SacredText({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.sacredtext -= q;
                  Item.list[ch].inventory.sacredtext += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                SacredText({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                SacredText({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.sacredtext -= q;
              }
            }
          }
        } else if(item == 'stoneaxe'){
          if(q > player.inventory.stoneaxe){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stoneaxe -= q;
                  Item.list[ch].inventory.stoneaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                StoneAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                StoneAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stoneaxe -= q;
                  Item.list[ch].inventory.stoneaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                StoneAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                StoneAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stoneaxe -= q;
                  Item.list[ch].inventory.stoneaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                StoneAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                StoneAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.stoneaxe -= q;
                  Item.list[ch].inventory.stoneaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                StoneAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                StoneAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.stoneaxe -= q;
              }
            }
          }
        } else if(item == 'ironaxe'){
          if(q > player.inventory.ironaxe){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironaxe -= q;
                  Item.list[ch].inventory.ironaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                IronAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                IronAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironaxe -= q;
                  Item.list[ch].inventory.ironaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                IronAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                IronAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironaxe -= q;
                  Item.list[ch].inventory.ironaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                IronAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                IronAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.ironaxe -= q;
                  Item.list[ch].inventory.ironaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                IronAxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                IronAxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.ironaxe -= q;
              }
            }
          }
        } else if(item == 'pickaxe'){
          if(q > player.inventory.pickaxe){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.pickaxe -= q;
                  Item.list[ch].inventory.pickaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Pickaxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Pickaxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.pickaxe -= q;
                  Item.list[ch].inventory.pickaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Pickaxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Pickaxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.pickaxe -= q;
                  Item.list[ch].inventory.pickaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Pickaxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Pickaxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.pickaxe -= q;
                  Item.list[ch].inventory.pickaxe += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Pickaxe({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Pickaxe({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.pickaxe -= q;
              }
            }
          }
        } else if(item == 'torch'){
          if(q > player.inventory.rondel){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.torch -= q;
                  Item.list[ch].inventory.torch += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Torch({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Torch({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.torch -= q;
                  Item.list[ch].inventory.torch += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Torch({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Torch({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.torch -= q;
                  Item.list[ch].inventory.torch += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Torch({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Torch({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.torch -= q;
                  Item.list[ch].inventory.torch += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Torch({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Torch({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.torch -= q;
              }
            }
          }
        } else if(item == 'bread'){
          if(q > player.inventory.bread){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bread -= q;
                  Item.list[ch].inventory.bread += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Bread({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Bread({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bread -= q;
                  Item.list[ch].inventory.bread += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Bread({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Bread({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bread -= q;
                  Item.list[ch].inventory.bread += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Bread({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Bread({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bread -= q;
                  Item.list[ch].inventory.bread += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Bread({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Bread({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bread -= q;
              }
            }
          }
        } else if(item == 'fish'){
          if(q > player.inventory.fish){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.fish -= q;
                  Item.list[ch].inventory.fish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Fish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Fish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.fish -= q;
                  Item.list[ch].inventory.fish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Fish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Fish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.fish -= q;
                  Item.list[ch].inventory.fish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Fish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Fish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.fish -= q;
                  Item.list[ch].inventory.fish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Fish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Fish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.fish -= q;
              }
            }
          }
        } else if(item == 'lamb'){
          if(q > player.inventory.lamb){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamb -= q;
                  Item.list[ch].inventory.lamb += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Lamb({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Lamb({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamb -= q;
                  Item.list[ch].inventory.lamb += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Lamb({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Lamb({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamb -= q;
                  Item.list[ch].inventory.lamb += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Lamb({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Lamb({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lamb -= q;
                  Item.list[ch].inventory.lamb += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Lamb({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Lamb({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lamb -= q;
              }
            }
          }
        } else if(item == 'boarmeat'){
          if(q > player.inventory.boarmeat){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarmeat -= q;
                  Item.list[ch].inventory.boarmeat += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                BoarMeat({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                BoarMeat({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarmeat -= q;
                  Item.list[ch].inventory.boarmeat += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                BoarMeat({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                BoarMeat({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarmeat -= q;
                  Item.list[ch].inventory.boarmeat += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                BoarMeat({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                BoarMeat({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarmeat -= q;
                  Item.list[ch].inventory.boarmeat += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                BoarMeat({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                BoarMeat({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarmeat -= q;
              }
            }
          }
        } else if(item == 'venison'){
          if(q > player.inventory.venison){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venison -= q;
                  Item.list[ch].inventory.venison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Venison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Venison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venison -= q;
                  Item.list[ch].inventory.venison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Venison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Venison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venison -= q;
                  Item.list[ch].inventory.venison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Venison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Venison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venison -= q;
                  Item.list[ch].inventory.venison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Venison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              } else if(isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Venison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venison -= q;
              }
            }
          }
        } else if(item == 'poachedfish'){
          if(q > player.inventory.poachfish){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.poachedfish -= q;
                  Item.list[ch].inventory.poachedfish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                PoachedFish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                PoachedFish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.poachedfish -= q;
                  Item.list[ch].inventory.poachedfish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                PoachedFish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                PoachedFish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.poachedfish -= q;
                  Item.list[ch].inventory.poachedfish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                PoachedFish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                PoachedFish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.poachedfish -= q;
                  Item.list[ch].inventory.poachedfish += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                PoachedFish({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                PoachedFish({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.poachedfish -= q;
              }
            }
          }
        } else if(item == 'lambchop'){
          if(q > player.inventory.lambchop){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lambchop -= q;
                  Item.list[ch].inventory.lambchop += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                LambChop({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                LambChop({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lambchop -= q;
                  Item.list[ch].inventory.lambchop += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                LambChop({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                LambChop({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lambchop -= q;
                  Item.list[ch].inventory.lambchop += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                LambChop({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                LambChop({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.lambchop -= q;
                  Item.list[ch].inventory.lambchop += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                LambChop({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                LambChop({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.lambchop -= q;
              }
            }
          }
        } else if(item == 'boarshank'){
          if(q > player.inventory.boarshank){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarshank -= q;
                  Item.list[ch].inventory.boarshank += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                BoarShank({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                BoarShank({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarshank -= q;
                  Item.list[ch].inventory.boarshank += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                BoarShank({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                BoarShank({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarshank -= q;
                  Item.list[ch].inventory.boarshank += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                BoarShank({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                BoarShank({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.boarshank -= q;
                  Item.list[ch].inventory.boarshank += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                BoarShank({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                BoarShank({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.boarshank -= q;
              }
            }
          }
        } else if(item == 'venisonloin'){
          if(q > player.inventory.venisonloin){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venisonloin -= q;
                  Item.list[ch].inventory.venisonloin += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                VenisonLoin({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                VenisonLoin({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venisonloin -= q;
                  Item.list[ch].inventory.venisonloin += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                VenisonLoin({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                VenisonLoin({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venisonloin -= q;
                  Item.list[ch].inventory.venisonloin += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                VenisonLoin({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                VenisonLoin({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.venisonloin -= q;
                  Item.list[ch].inventory.venisonloin += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                VenisonLoin({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                VenisonLoin({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.venisonloin -= q;
              }
            }
          }
        } else if(item == 'mead'){
          if(q > player.inventory.mead){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.mead -= q;
                  Item.list[ch].inventory.mead += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Mead({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Mead({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.mead -= q;
                  Item.list[ch].inventory.mead += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Mead({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Mead({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.mead -= q;
                  Item.list[ch].inventory.mead += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Mead({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              }  else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Mead({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.mead -= q;
                  Item.list[ch].inventory.mead += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Mead({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Mead({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.mead -= q;
              }
            }
          }
        } else if(item == 'saison'){
          if(q > player.inventory.saison){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.saison -= q;
                  Item.list[ch].inventory.saison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Saison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Saison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.saison -= q;
                  Item.list[ch].inventory.saison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Saison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Saison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.saison -= q;
                  Item.list[ch].inventory.saison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Saison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Saison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.saison -= q;
                  Item.list[ch].inventory.saison += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Saison({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Saison({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.saison -= q;
              }
            }
          }
        } else if(item == 'flanders'){
          if(q > player.inventory.flanders){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.flanders -= q;
                  Item.list[ch].inventory.flanders += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Flanders({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Flanders({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.flanders -= q;
                  Item.list[ch].inventory.flanders += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Flanders({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Flanders({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.flanders -= q;
                  Item.list[ch].inventory.flanders += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Flanders({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Flanders({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.flanders -= q;
                  Item.list[ch].inventory.flanders += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Flanders({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Flanders({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.flanders -= q;
              }
            }
          }
        } else if(item == 'bieredegarde'){
          if(q > player.inventory.bieredegarde){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bieredegarde -= q;
                  Item.list[ch].inventory.bieredegarde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                BiereDeGarde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                BiereDeGarde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bieredegarde -= q;
                  Item.list[ch].inventory.bieredegarde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                BiereDeGarde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                BiereDeGarde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bieredegarde -= q;
                  Item.list[ch].inventory.bieredegarde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                BiereDeGarde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                BiereDeGarde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bieredegarde -= q;
                  Item.list[ch].inventory.bieredegarde += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                BiereDeGarde({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                BiereDeGarde({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bieredegarde -= q;
              }
            }
          }
        } else if(item == 'bordeaux'){
          if(q > player.inventory.bordeaux){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bordeaux -= q;
                  Item.list[ch].inventory.bordeaux += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Bordeaux({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Bordeaux({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bordeaux -= q;
                  Item.list[ch].inventory.bordeaux += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Bordeaux({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Bordeaux({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bordeaux -= q;
                  Item.list[ch].inventory.bordeaux += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Bordeaux({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Bordeaux({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bordeaux -= q;
                  Item.list[ch].inventory.bordeaux += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Bordeaux({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Bordeaux({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bordeaux -= q;
              }
            }
          }
        } else if(item == 'bourgogne'){
          if(q > player.inventory.bourgogne){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bourgogne -= q;
                  Item.list[ch].inventory.bourgogne += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Bourgogne({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Bourgogne({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bourgogne -= q;
                  Item.list[ch].inventory.bourgogne += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Bourgogne({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Bourgogne({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bourgogne -= q;
                  Item.list[ch].inventory.bourgogne += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Bourgogne({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Bourgogne({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.bourgogne -= q;
                  Item.list[ch].inventory.bourgogne += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Bourgogne({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Bourgogne({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.bourgogne -= q;
              }
            }
          }
        } else if(item == 'chianti'){
          if(q > player.inventory.chianti){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.chianti -= q;
                  Item.list[ch].inventory.chianti += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Chianti({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Chianti({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.chianti -= q;
                  Item.list[ch].inventory.chianti += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Chianti({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Chianti({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.chianti -= q;
                  Item.list[ch].inventory.chianti += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Chianti({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Chianti({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.chianti -= q;
                  Item.list[ch].inventory.chianti += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Chianti({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Chianti({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.chianti -= q;
              }
            }
          }
        } else if(item == 'crown'){
          if(q > player.inventory.crown){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.crown -= q;
                  Item.list[ch].inventory.crown += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Crown({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Crown({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.crown -= q;
                  Item.list[ch].inventory.crown += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Crown({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Crown({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.crown -= q;
                  Item.list[ch].inventory.crown += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Crown({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Crown({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.crown -= q;
                  Item.list[ch].inventory.crown += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Crown({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Crown({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.crown -= q;
              }
            }
          }
        } else if(item == 'arrows'){
          if(q > player.inventory.arrows){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.arrows -= q;
                  Item.list[ch].inventory.arrows += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Arrows({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Arrows({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.arrows -= q;
                  Item.list[ch].inventory.arrows += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Arrows({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Arrows({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.arrows -= q;
                  Item.list[ch].inventory.arrows += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Arrows({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Arrows({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.arrows -= q;
                  Item.list[ch].inventory.arrows += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Arrows({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Arrows({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.arrows -= q;
              }
            }
          }
        } else if(item == 'worldmap'){
          if(q > player.inventory.worldmap){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.worldmap -= q;
                  Item.list[ch].inventory.worldmap += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                WorldMap({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                WorldMap({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.worldmap -= q;
                  Item.list[ch].inventory.worldmap += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                WorldMap({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                WorldMap({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.worldmap -= q;
                  Item.list[ch].inventory.worldmap += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                WorldMap({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                WorldMap({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.worldmap -= q;
                  Item.list[ch].inventory.worldmap += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                WorldMap({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                WorldMap({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.worldmap -= q;
              }
            }
          }
        } else if(item == 'relic'){
          if(q > player.inventory.relic){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have that many.</i>'}));
          } else {
            if(player.facing == 'up'){
              if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
                var chCoords = getCoords(c,r-1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.relic -= q;
                  Item.list[ch].inventory.relic += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r-1)){
                var coords = getCoords(c,r-1);
                Relic({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              } else if(!isWalkable(z,c,r-1) && z == 0 && getTile(0,c,r-1) == 0){
                var coords = getCoords(c,r-1);
                Relic({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              }
            } else if(player.facing == 'down'){
              if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
                var chCoords = getCoords(c,r+1);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.relic -= q;
                  Item.list[ch].inventory.relic += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c,r+1)){
                var coords = getCoords(c,r+1);
                Relic({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              } else if(!isWalkable(z,c,r+1) && z == 0 && getTile(0,c,r+1) == 0){
                var coords = getCoords(c,r+1);
                Relic({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              }
            } else if(player.facing == 'left'){
              if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
                var chCoords = getCoords(c-1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.relic -= q;
                  Item.list[ch].inventory.relic += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c-1,r)){
                var coords = getCoords(c-1,r);
                Relic({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              } else if(!isWalkable(z,c-1,r) && z == 0 && getTile(0,c-1,r) == 0){
                var coords = getCoords(c-1,r);
                Relic({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              }
            } else if(player.facing == 'right'){
              if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
                var chCoords = getCoords(c+1,r);
                var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
                if(ch){
                  Player.list[player.id].inventory.relic -= q;
                  Item.list[ch].inventory.relic += q;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
                }
              } else if(isWalkable(z,c+1,r)){
                var coords = getCoords(c+1,r);
                Relic({
                  z:z,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              } else if(!isWalkable(z,c+1,r) && z == 0 && getTile(0,c+1,r) == 0){
                var coords = getCoords(c+1,r);
                Relic({
                  z:-3,
                  x:coords[0],
                  y:coords[1],
                  qty:Number(q),
                  parent:player.id
                });
                Player.list[player.id].inventory.relic -= q;
              }
            }
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not a valid</i> <b>ItemName</b>'}));
        }
      }
    } else if(data.cmd == 'take'){
      socket.write(JSON.stringify({msg:'addToChat',message:'<p>/take Quantity ItemName</p>'}));
    } else if(data.cmd.slice(0,4) == 'take' && data.cmd[4] == ' '){
      var target = String(data.cmd.slice(data.cmd.indexOf(' ') + 1)).toLowerCase();
      var q = Number(target.slice(0,target.indexOf(' '))).toFixed(0);
      var item = String(target.slice(target.indexOf(' ') + 1)).toLowerCase();
      if(q < 1){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Quantity must be greater than 0.</i>'}));
      } else if(Number.isNaN(q/1)){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Quantity must be a number.</i>'}));
      } else {
        if(player.facing == 'up'){
          if(getItem(z,c,r-1) == 'LockedChest' || getItem(z,c,r-1) == 'Chest'){
            var chCoords = getCoords(c,r-1);
            var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
            if(ch){
              if(item == 'wood'){
                if(q <= Item.list[ch].inventory.wood){
                  if(player.inventory.wood + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Wood</b>.'}));
                  } else {
                    Item.list[ch].inventory.wood -= q;
                    Player.list[id].inventory.wood += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Wood</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Wood</b>.'}));
                }
              } else if(item == 'stone'){
                if(q <= Item.list[ch].inventory.stone){
                  if(player.inventory.stone + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Stone</b>.'}));
                  } else {
                    Item.list[ch].inventory.stone -= q;
                    Player.list[id].inventory.stone += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Stone</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Stone</b>.'}));
                }
              } else if(item == 'grain'){
                if(q <= Item.list[ch].inventory.grain){
                  if(player.inventory.grain + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Grain</b>.'}));
                  } else {
                    Item.list[ch].inventory.grain -= q;
                    Player.list[id].inventory.grain += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Grain</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Grain</b>.'}));
                }
              } else if(item == 'flour'){
                if(q <= Item.list[ch].inventory.flour){
                  if(player.inventory.flour + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Flour</b>.'}));
                  } else {
                    Item.list[ch].inventory.flour -= q;
                    Player.list[id].inventory.flour += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flour</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Flour</b>.'}));
                }
              } else if(item == 'dough'){
                if(q <= Item.list[ch].inventory.dough){
                  if(player.inventory.dough + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Dough</b>.'}));
                  } else {
                    Item.list[ch].inventory.dough -= q;
                    Player.list[id].inventory.dough += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dough</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Dough</b>.'}));
                }
              } else if(item == 'ironore'){
                if(q <= Item.list[ch].inventory.ironore){
                  if(player.inventory.ironore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>IronOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironore -= q;
                    Player.list[id].inventory.ironore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>IronOre</b>.'}));
                }
              } else if(item == 'iron'){
                if(q <= Item.list[ch].inventory.iron){
                  if(player.inventory.iron + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Iron</b>.'}));
                  } else {
                    Item.list[ch].inventory.iron -= q;
                    Player.list[id].inventory.iron += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Iron</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Iron</b>.'}));
                }
              } else if(item == 'steel'){
                if(q <= Item.list[ch].inventory.steel){
                  if(player.inventory.steel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Steel</b>.'}));
                  } else {
                    Item.list[ch].inventory.steel -= q;
                    Player.list[id].inventory.steel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Steel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Steel</b>.'}));
                }
              } else if(item == 'boarhide'){
                if(q <= Item.list[ch].inventory.boarhide){
                  if(player.inventory.boarhide + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarHide</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarhide -= q;
                    Player.list[id].inventory.boarhide += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarHide</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarHide</b>.'}));
                }
              } else if(item == 'leather'){
                if(q <= Item.list[ch].inventory.leather){
                  if(player.inventory.leather + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Leather</b>.'}));
                  } else {
                    Item.list[ch].inventory.leather -= q;
                    Player.list[id].inventory.leather += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Leather</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Leather</b>.'}));
                }
              } else if(item == 'silverore'){
                if(q <= Item.list[ch].inventory.silverore){
                  if(player.inventory.silverore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>SilverOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.silverore -= q;
                    Player.list[id].inventory.silverore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SilverOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>SilverOre</b>.'}));
                }
              } else if(item == 'silver'){
                if(q <= Item.list[ch].inventory.silver){
                  Item.list[ch].inventory.silver -= q;
                  Player.list[id].inventory.silver += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Silver</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Silver</b>.'}));
                }
              } else if(item == 'goldore'){
                if(q <= Item.list[ch].inventory.goldore){
                  if(player.inventory.goldore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>GoldOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.goldore -= q;
                    Player.list[id].inventory.goldore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GoldOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>GoldOre</b>.'}));
                }
              } else if(item == 'gold'){
                if(q <= Item.list[ch].inventory.gold){
                  Item.list[ch].inventory.gold -= q;
                  Player.list[id].inventory.gold += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Gold</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Gold</b>.'}));
                }
              } else if(item == 'diamond'){
                if(q <= Item.list[ch].inventory.diamond){
                  Item.list[ch].inventory.diamond -= q;
                  Player.list[id].inventory.diamond += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Diamond</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Diamond</b>.'}));
                }
              } else if(item == 'huntingknife'){
                if(q <= Item.list[ch].inventory.huntingknife){
                  if(player.inventory.huntingknife + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>HuntingKnife</b>.'}));
                  } else {
                    Item.list[ch].inventory.huntingknife -= q;
                    Player.list[id].inventory.huntingknife += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>HuntingKnife</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>HuntingKnife</b>.'}));
                }
              } else if(item == 'dague'){
                if(q <= Item.list[ch].inventory.dague){
                  if(player.inventory.dague + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Dague</b>.'}));
                  } else {
                    Item.list[ch].inventory.dague -= q;
                    Player.list[id].inventory.dague += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dague</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Dague</b>.'}));
                }
              } else if(item == 'rondel'){
                if(q <= Item.list[ch].inventory.rondel){
                  if(player.inventory.rondel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Rondel</b>.'}));
                  } else {
                    Item.list[ch].inventory.rondel -= q;
                    Player.list[id].inventory.rondel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Rondel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Rondel</b>.'}));
                }
              } else if(item == 'misericorde'){
                if(q <= Item.list[ch].inventory.misericorde){
                  if(player.inventory.misericorde + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Misericorde</b>.'}));
                  } else {
                    Item.list[ch].inventory.misericorde -= q;
                    Player.list[id].inventory.misericorde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Misericorde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Misericorde</b>.'}));
                }
              } else if(item == 'bastardsword'){
                if(q <= Item.list[ch].inventory.bastardsword){
                  if(player.inventory.bastardsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BastardSword</b>.'}));
                  } else {
                    Item.list[ch].inventory.bastardsword -= q;
                    Player.list[id].inventory.bastardsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BastardSword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BastardSword</b>.'}));
                }
              } else if(item == 'longsword'){
                if(q <= Item.list[ch].inventory.longsword){
                  if(player.inventory.longsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Longsword</b>.'}));
                  } else {
                    Item.list[ch].inventory.longsword -= q;
                    Player.list[id].inventory.longsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Longsword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Longsword</b>.'}));
                }
              } else if(item == 'zweihander'){
                if(q <= Item.list[ch].inventory.zweihander){
                  if(player.inventory.zweihander + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Zweihander</b>.'}));
                  } else {
                    Item.list[ch].inventory.zweihander -= q;
                    Player.list[id].inventory.zweihander += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Zweihander</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Zweihander</b>.'}));
                }
              } else if(item == 'morallta'){
                if(q <= Item.list[ch].inventory.morallta){
                  if(player.inventory.morallta + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Morallta</b>.'}));
                  } else {
                    Item.list[ch].inventory.morallta -= q;
                    Player.list[id].inventory.morallta += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Morallta</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Morallta</b>.'}));
                }
              } else if(item == 'bow'){
                if(q <= Item.list[ch].inventory.bow){
                  if(player.inventory.bow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bow</b>.'}));
                  } else {
                    Item.list[ch].inventory.bow -= q;
                    Player.list[id].inventory.bow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bow</b>.'}));
                }
              } else if(item == 'welshlongbow'){
                if(q <= Item.list[ch].inventory.welshlongbow){
                  if(player.inventory.welshlongbow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WelshLongbow</b>.'}));
                  } else {
                    Item.list[ch].inventory.welshlongbow -= q;
                    Player.list[id].inventory.welshlongbow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WelshLongbow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WelshLongbow</b>.'}));
                }
              } else if(item == 'knightlance'){
                if(q <= Item.list[ch].inventory.knightlance){
                  if(player.inventory.knightlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>KnightLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.knightlance -= q;
                    Player.list[id].inventory.knightlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>KnightLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>KnightLance</b>.'}));
                }
              } else if(item == 'rusticlance'){
                if(q <= Item.list[ch].inventory.rusticlance){
                  if(player.inventory.rusticlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RusticLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.rusticlance -= q;
                    Player.list[id].inventory.rusticlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RusticLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RusticLance</b>.'}));
                }
              } else if(item == 'paladinlance'){
                if(q <= Item.list[ch].inventory.paladinlance){
                  if(player.inventory.paladinlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PaladinLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.paladinlance -= q;
                    Player.list[id].inventory.paladinlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PaladinLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PaladinLance</b>.'}));
                }
              } else if(item == 'brigandine'){
                if(q <= Item.list[ch].inventory.brigandine){
                  if(player.inventory.brigandine + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brigandine</b>.'}));
                  } else {
                    Item.list[ch].inventory.brigandine -= q;
                    Player.list[id].inventory.brigandine += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brigandine</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brigandine</b>.'}));
                }
              } else if(item == 'lamellar'){
                if(q <= Item.list[ch].inventory.lamellar){
                  if(player.inventory.lamellar + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Lamellar</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamellar -= q;
                    Player.list[id].inventory.lamellar += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamellar</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamellar</b>.'}));
                }
              } else if(item == 'maille'){
                if(q <= Item.list[ch].inventory.maille){
                  if(player.inventory.maille + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Maille</b>.'}));
                  } else {
                    Item.list[ch].inventory.maille -= q;
                    Player.list[id].inventory.maille += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Maille</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Maille</b>.'}));
                }
              } else if(item == 'hauberk'){
                if(q <= Item.list[ch].inventory.hauberk){
                  if(player.inventory.hauberk + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Hauberk</b>.'}));
                  } else {
                    Item.list[ch].inventory.hauberk -= q;
                    Player.list[id].inventory.hauberk += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Hauberk</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Hauberk</b>.'}));
                }
              } else if(item == 'brynja'){
                if(q <= Item.list[ch].inventory.brynja){
                  if(player.inventory.brynja + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brynja</b>.'}));
                  } else {
                    Item.list[ch].inventory.brynja -= q;
                    Player.list[id].inventory.brynja += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brynja</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brynja</b>.'}));
                }
              } else if(item == 'cuirass'){
                if(q <= Item.list[ch].inventory.cuirass){
                  if(player.inventory.cuirass + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Cuirass</b>.'}));
                  } else {
                    Item.list[ch].inventory.cuirass -= q;
                    Player.list[id].inventory.cuirass += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Cuirass</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Cuirass</b>.'}));
                }
              } else if(item == 'steelplate'){
                if(q <= Item.list[ch].inventory.steelplate){
                  if(player.inventory.steelplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SteelPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.steelplate -= q;
                    Player.list[id].inventory.steelplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SteelPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SteelPlate</b>.'}));
                }
              } else if(item == 'greenwichplate'){
                if(q <= Item.list[ch].inventory.greenwichplate){
                  if(player.inventory.greenwichplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GreenwichPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.greenwichplate -= q;
                    Player.list[id].inventory.greenwichplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GreenwichPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GreenwichPlate</b>.'}));
                }
              } else if(item == 'gothicplate'){
                if(q <= Item.list[ch].inventory.gothicplate){
                  if(player.inventory.gothicplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GothicPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.gothicplate -= q;
                    Player.list[id].inventory.gothicplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GothicPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GothicPlate</b>.'}));
                }
              } else if(item == 'clericrobe'){
                if(q <= Item.list[ch].inventory.clericrobe){
                  if(player.inventory.clericrobe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>ClericRobe</b>.'}));
                  } else {
                    Item.list[ch].inventory.clericrobe -= q;
                    Player.list[id].inventory.clericrobe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>ClericRobe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>ClericRobe</b>.'}));
                }
              } else if(item == 'monkcowl'){
                if(q <= Item.list[ch].inventory.monkcowl){
                  if(player.inventory.monkcowl + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>MonkCowl</b>.'}));
                  } else {
                    Item.list[ch].inventory.monkcowl -= q;
                    Player.list[id].inventory.monkcowl += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>MonkCowl</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>MonkCowl</b>.'}));
                }
              } else if(item == 'blackcloak'){
                if(q <= Item.list[ch].inventory.blackcloak){
                  if(player.inventory.blackcloak + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BlackCloak</b>.'}));
                  } else {
                    Item.list[ch].inventory.blackcloak -= q;
                    Player.list[id].inventory.blackcloak += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BlackCloak</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BlackCloak</b>.'}));
                }
              } else if(item == 'tome'){
                if(q <= Item.list[ch].inventory.tome){
                  if(player.inventory.tome + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Tome</b>.'}));
                  } else {
                    Item.list[ch].inventory.tome -= q;
                    Player.list[id].inventory.tome += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Tome</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Tome</b>.'}));
                }
              } else if(item == 'runicscroll'){
                if(q <= Item.list[ch].inventory.runicscroll){
                  if(player.inventory.runicscroll + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RunicScroll</b>.'}));
                  } else {
                    Item.list[ch].inventory.runicscroll -= q;
                    Player.list[id].inventory.runicscroll += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RunicScroll</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RunicScroll</b>.'}));
                }
              } else if(item == 'sacredtext'){
                if(q <= Item.list[ch].inventory.sacredtext){
                  if(player.inventory.sacredtext + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SacredText</b>.'}));
                  } else {
                    Item.list[ch].inventory.sacredtext -= q;
                    Player.list[id].inventory.sacredtext += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SacredText</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SacredText</b>.'}));
                }
              } else if(item == 'stoneaxe'){
                if(q <= Item.list[ch].inventory.stoneaxe){
                  if(player.inventory.stoneaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>StoneAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.stoneaxe -= q;
                    Player.list[id].inventory.stoneaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>StoneAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>StoneAxe</b>.'}));
                }
              } else if(item == 'ironaxe'){
                if(q <= Item.list[ch].inventory.ironaxe){
                  if(player.inventory.ironaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>IronAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironaxe -= q;
                    Player.list[id].inventory.ironaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>IronAxe</b>.'}));
                }
              } else if(item == 'pickaxe'){
                if(q <= Item.list[ch].inventory.pickaxe){
                  if(player.inventory.pickaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PickAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.pickaxe -= q;
                    Player.list[id].inventory.pickaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PickAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PickAxe</b>.'}));
                }
              } else if(item == 'torch'){
                if(q <= Item.list[ch].inventory.torch){
                  if(player.inventory.torch + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Torch</b>.'}));
                  } else {
                    Item.list[ch].inventory.torch -= q;
                    Player.list[id].inventory.torch += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Torch</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Torch</b>.'}));
                }
              } else if(item == 'bread'){
                if(q <= Item.list[ch].inventory.bread){
                  if(player.inventory.bread + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Bread</b>.'}));
                  } else {
                    Item.list[ch].inventory.bread -= q;
                    Player.list[id].inventory.bread += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bread</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Bread</b>.'}));
                }
              } else if(item == 'fish'){
                if(q <= Item.list[ch].inventory.fish){
                  if(player.inventory.fish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Fish</b>.'}));
                  } else {
                    Item.list[ch].inventory.fish -= q;
                    Player.list[id].inventory.fish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Fish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Fish</b>.'}));
                }
              } else if(item == 'lamb'){
                if(q <= Item.list[ch].inventory.lamb){
                  if(player.inventory.lamb + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Lamb</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamb -= q;
                    Player.list[id].inventory.lamb += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamb</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamb</b>.'}));
                }
              } else if(item == 'boarmeat'){
                if(q <= Item.list[ch].inventory.boarmeat){
                  if(player.inventory.boarmeat + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarMeat</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarmeat -= q;
                    Player.list[id].inventory.boarmeat += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarMeat</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarMeat</b>.'}));
                }
              } else if(item == 'venison'){
                if(q <= Item.list[ch].inventory.venison){
                  if(player.inventory.venison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Venison</b>.'}));
                  } else {
                    Item.list[ch].inventory.venison -= q;
                    Player.list[id].inventory.venison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Venison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Venison</b>.'}));
                }
              } else if(item == 'poachedfish'){
                if(q <= Item.list[ch].inventory.poachedfish){
                  if(player.inventory.poachedfish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PoachedFish</b>.'}));
                  } else {
                    Item.list[ch].inventory.poachedfish -= q;
                    Player.list[id].inventory.poachedfish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PoachedFish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PoachedFish</b>.'}));
                }
              } else if(item == 'lambchop'){
                if(q <= Item.list[ch].inventory.lambchop){
                  if(player.inventory.lambchop + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>LambChop</b>.'}));
                  } else {
                    Item.list[ch].inventory.lambchop -= q;
                    Player.list[id].inventory.lambchop += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>LambChop</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>LambChop</b>.'}));
                }
              } else if(item == 'boarshank'){
                if(q <= Item.list[ch].inventory.boarshank){
                  if(player.inventory.boarshank + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarShank</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarshank -= q;
                    Player.list[id].inventory.boarshank += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarShank</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarShank</b>.'}));
                }
              } else if(item == 'venisonloin'){
                if(q <= Item.list[ch].inventory.venisonloin){
                  if(player.inventory.venisonloin + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>VenisonLoin</b>.'}));
                  } else {
                    Item.list[ch].inventory.venisonloin -= q;
                    Player.list[id].inventory.venisonloin += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>VenisonLoin</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>VenisonLoin</b>.'}));
                }
              } else if(item == 'mead'){
                if(q <= Item.list[ch].inventory.mead){
                  if(player.inventory.mead + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Mead</b>.'}));
                  } else {
                    Item.list[ch].inventory.mead -= q;
                    Player.list[id].inventory.mead += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Mead</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Mead</b>.'}));
                }
              } else if(item == 'saison'){
                if(q <= Item.list[ch].inventory.saison){
                  if(player.inventory.saison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Saison</b>.'}));
                  } else {
                    Item.list[ch].inventory.saison -= q;
                    Player.list[id].inventory.saison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Saison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Saison</b>.'}));
                }
              } else if(item == 'flanders'){
                if(q <= Item.list[ch].inventory.flanders){
                  if(player.inventory.flanders + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Flanders</b>.'}));
                  } else {
                    Item.list[ch].inventory.flanders -= q;
                    Player.list[id].inventory.flanders += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flanders</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Flanders</b>.'}));
                }
              } else if(item == 'bieredegarde'){
                if(q <= Item.list[ch].inventory.bieredegarde){
                  if(player.inventory.bieredegarde + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BiereDeGarde</b>.'}));
                  } else {
                    Item.list[ch].inventory.bieredegarde -= q;
                    Player.list[id].inventory.bieredegarde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BiereDeGarde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BiereDeGarde</b>.'}));
                }
              } else if(item == 'bordeaux'){
                if(q <= Item.list[ch].inventory.bordeaux){
                  if(player.inventory.bordeaux + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bordeaux</b>.'}));
                  } else {
                    Item.list[ch].inventory.bordeaux -= q;
                    Player.list[id].inventory.bordeaux += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bordeaux</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bordeaux</b>.'}));
                }
              } else if(item == 'bourgogne'){
                if(q <= Item.list[ch].inventory.bourgogne){
                  if(player.inventory.bourgogne + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bourgogne</b>.'}));
                  } else {
                    Item.list[ch].inventory.bourgogne -= q;
                    Player.list[id].inventory.bourgogne += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bourgogne</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bourgogne</b>.'}));
                }
              } else if(item == 'chianti'){
                if(q <= Item.list[ch].inventory.chianti){
                  if(player.inventory.chianti + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Chianti</b>.'}));
                  } else {
                    Item.list[ch].inventory.chianti -= q;
                    Player.list[id].inventory.chianti += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Chianti</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Chianti</b>.'}));
                }
              } else if(item == 'crown'){
                if(q <= Item.list[ch].inventory.crown){
                  if(player.inventory.crown + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Crown</b>.'}));
                  } else {
                    Item.list[ch].inventory.crown -= q;
                    Player.list[id].inventory.crown += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Crown</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Crown</b>.'}));
                }
              } else if(item == 'arrows'){
                if(q <= Item.list[ch].inventory.arrows){
                  if(player.inventory.arrows + q > 50){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Arrows</b>.'}));
                  } else {
                    Item.list[ch].inventory.arrows -= q;
                    Player.list[id].inventory.arrows += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Arrows</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Arrows</b>.'}));
                }
              } else if(item == 'worldmap'){
                if(q <= Item.list[ch].inventory.worldmap){
                  if(player.inventory.worldmap + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WorldMap</b>.'}));
                  } else {
                    Item.list[ch].inventory.worldmap -= q;
                    Player.list[id].inventory.worldmap += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WorldMap</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WorldMap</b>.'}));
                }
              } else if(item == 'relic'){
                if(q <= Item.list[ch].inventory.relic){
                  if(player.inventory.relic + q > 1){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying a</i> <b>Relic</b>.'}));
                  } else {
                    Item.list[ch].inventory.relic -= q;
                    Player.list[id].inventory.relic += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Relic</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Relic</b>.'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not a valid</i> <b>ItemName</b>.'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
            }
          }
        } else if(player.facing == 'down'){
          if(getItem(z,c,r+1) == 'LockedChest' || getItem(z,c,r+1) == 'Chest'){
            var chCoords = getCoords(c,r+1);
            var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
            if(ch){
              if(item == 'wood'){
                if(q <= Item.list[ch].inventory.wood){
                  if(player.inventory.wood + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Wood</b>.'}));
                  } else {
                    Item.list[ch].inventory.wood -= q;
                    Player.list[id].inventory.wood += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Wood</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Wood</b>.'}));
                }
              } else if(item == 'stone'){
                if(q <= Item.list[ch].inventory.stone){
                  if(player.inventory.stone + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Stone</b>.'}));
                  } else {
                    Item.list[ch].inventory.stone -= q;
                    Player.list[id].inventory.stone += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Stone</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Stone</b>.'}));
                }
              } else if(item == 'grain'){
                if(q <= Item.list[ch].inventory.grain){
                  if(player.inventory.grain + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Grain</b>.'}));
                  } else {
                    Item.list[ch].inventory.grain -= q;
                    Player.list[id].inventory.grain += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Grain</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Grain</b>.'}));
                }
              } else if(item == 'flour'){
                if(q <= Item.list[ch].inventory.flour){
                  if(player.inventory.flour + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Flour</b>.'}));
                  } else {
                    Item.list[ch].inventory.flour -= q;
                    Player.list[id].inventory.flour += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flour</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Flour</b>.'}));
                }
              } else if(item == 'dough'){
                if(q <= Item.list[ch].inventory.dough){
                  if(player.inventory.dough + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Dough</b>.'}));
                  } else {
                    Item.list[ch].inventory.dough -= q;
                    Player.list[id].inventory.dough += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dough</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Dough</b>.'}));
                }
              } else if(item == 'ironore'){
                if(q <= Item.list[ch].inventory.ironore){
                  if(player.inventory.ironore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>IronOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironore -= q;
                    Player.list[id].inventory.ironore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>IronOre</b>.'}));
                }
              } else if(item == 'iron'){
                if(q <= Item.list[ch].inventory.iron){
                  if(player.inventory.iron + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Iron</b>.'}));
                  } else {
                    Item.list[ch].inventory.iron -= q;
                    Player.list[id].inventory.iron += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Iron</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Iron</b>.'}));
                }
              } else if(item == 'steel'){
                if(q <= Item.list[ch].inventory.steel){
                  if(player.inventory.steel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Steel</b>.'}));
                  } else {
                    Item.list[ch].inventory.steel -= q;
                    Player.list[id].inventory.steel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Steel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Steel</b>.'}));
                }
              } else if(item == 'boarhide'){
                if(q <= Item.list[ch].inventory.boarhide){
                  if(player.inventory.boarhide + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarHide</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarhide -= q;
                    Player.list[id].inventory.boarhide += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarHide</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarHide</b>.'}));
                }
              } else if(item == 'leather'){
                if(q <= Item.list[ch].inventory.leather){
                  if(player.inventory.leather + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Leather</b>.'}));
                  } else {
                    Item.list[ch].inventory.leather -= q;
                    Player.list[id].inventory.leather += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Leather</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Leather</b>.'}));
                }
              } else if(item == 'silverore'){
                if(q <= Item.list[ch].inventory.silverore){
                  if(player.inventory.silverore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>SilverOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.silverore -= q;
                    Player.list[id].inventory.silverore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SilverOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>SilverOre</b>.'}));
                }
              } else if(item == 'silver'){
                if(q <= Item.list[ch].inventory.silver){
                  Item.list[ch].inventory.silver -= q;
                  Player.list[id].inventory.silver += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Silver</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Silver</b>.'}));
                }
              } else if(item == 'goldore'){
                if(q <= Item.list[ch].inventory.goldore){
                  if(player.inventory.goldore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>GoldOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.goldore -= q;
                    Player.list[id].inventory.goldore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GoldOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>GoldOre</b>.'}));
                }
              } else if(item == 'gold'){
                if(q <= Item.list[ch].inventory.gold){
                  Item.list[ch].inventory.gold -= q;
                  Player.list[id].inventory.gold += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Gold</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Gold</b>.'}));
                }
              } else if(item == 'diamond'){
                if(q <= Item.list[ch].inventory.diamond){
                  Item.list[ch].inventory.diamond -= q;
                  Player.list[id].inventory.diamond += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Diamond</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Diamond</b>.'}));
                }
              } else if(item == 'huntingknife'){
                if(q <= Item.list[ch].inventory.huntingknife){
                  if(player.inventory.huntingknife + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>HuntingKnife</b>.'}));
                  } else {
                    Item.list[ch].inventory.huntingknife -= q;
                    Player.list[id].inventory.huntingknife += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>HuntingKnife</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>HuntingKnife</b>.'}));
                }
              } else if(item == 'dague'){
                if(q <= Item.list[ch].inventory.dague){
                  if(player.inventory.dague + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Dague</b>.'}));
                  } else {
                    Item.list[ch].inventory.dague -= q;
                    Player.list[id].inventory.dague += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dague</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Dague</b>.'}));
                }
              } else if(item == 'rondel'){
                if(q <= Item.list[ch].inventory.rondel){
                  if(player.inventory.rondel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Rondel</b>.'}));
                  } else {
                    Item.list[ch].inventory.rondel -= q;
                    Player.list[id].inventory.rondel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Rondel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Rondel</b>.'}));
                }
              } else if(item == 'misericorde'){
                if(q <= Item.list[ch].inventory.misericorde){
                  if(player.inventory.misericorde + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Misericorde</b>.'}));
                  } else {
                    Item.list[ch].inventory.misericorde -= q;
                    Player.list[id].inventory.misericorde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Misericorde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Misericorde</b>.'}));
                }
              } else if(item == 'bastardsword'){
                if(q <= Item.list[ch].inventory.bastardsword){
                  if(player.inventory.bastardsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BastardSword</b>.'}));
                  } else {
                    Item.list[ch].inventory.bastardsword -= q;
                    Player.list[id].inventory.bastardsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BastardSword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BastardSword</b>.'}));
                }
              } else if(item == 'longsword'){
                if(q <= Item.list[ch].inventory.longsword){
                  if(player.inventory.longsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Longsword</b>.'}));
                  } else {
                    Item.list[ch].inventory.longsword -= q;
                    Player.list[id].inventory.longsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Longsword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Longsword</b>.'}));
                }
              } else if(item == 'zweihander'){
                if(q <= Item.list[ch].inventory.zweihander){
                  if(player.inventory.zweihander + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Zweihander</b>.'}));
                  } else {
                    Item.list[ch].inventory.zweihander -= q;
                    Player.list[id].inventory.zweihander += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Zweihander</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Zweihander</b>.'}));
                }
              } else if(item == 'morallta'){
                if(q <= Item.list[ch].inventory.morallta){
                  if(player.inventory.morallta + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Morallta</b>.'}));
                  } else {
                    Item.list[ch].inventory.morallta -= q;
                    Player.list[id].inventory.morallta += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Morallta</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Morallta</b>.'}));
                }
              } else if(item == 'bow'){
                if(q <= Item.list[ch].inventory.bow){
                  if(player.inventory.bow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bow</b>.'}));
                  } else {
                    Item.list[ch].inventory.bow -= q;
                    Player.list[id].inventory.bow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bow</b>.'}));
                }
              } else if(item == 'welshlongbow'){
                if(q <= Item.list[ch].inventory.welshlongbow){
                  if(player.inventory.welshlongbow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WelshLongbow</b>.'}));
                  } else {
                    Item.list[ch].inventory.welshlongbow -= q;
                    Player.list[id].inventory.welshlongbow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WelshLongbow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WelshLongbow</b>.'}));
                }
              } else if(item == 'knightlance'){
                if(q <= Item.list[ch].inventory.knightlance){
                  if(player.inventory.knightlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>KnightLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.knightlance -= q;
                    Player.list[id].inventory.knightlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>KnightLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>KnightLance</b>.'}));
                }
              } else if(item == 'rusticlance'){
                if(q <= Item.list[ch].inventory.rusticlance){
                  if(player.inventory.rusticlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RusticLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.rusticlance -= q;
                    Player.list[id].inventory.rusticlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RusticLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RusticLance</b>.'}));
                }
              } else if(item == 'paladinlance'){
                if(q <= Item.list[ch].inventory.paladinlance){
                  if(player.inventory.paladinlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PaladinLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.paladinlance -= q;
                    Player.list[id].inventory.paladinlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PaladinLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PaladinLance</b>.'}));
                }
              } else if(item == 'brigandine'){
                if(q <= Item.list[ch].inventory.brigandine){
                  if(player.inventory.brigandine + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brigandine</b>.'}));
                  } else {
                    Item.list[ch].inventory.brigandine -= q;
                    Player.list[id].inventory.brigandine += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brigandine</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brigandine</b>.'}));
                }
              } else if(item == 'lamellar'){
                if(q <= Item.list[ch].inventory.lamellar){
                  if(player.inventory.lamellar + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Lamellar</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamellar -= q;
                    Player.list[id].inventory.lamellar += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamellar</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamellar</b>.'}));
                }
              } else if(item == 'maille'){
                if(q <= Item.list[ch].inventory.maille){
                  if(player.inventory.maille + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Maille</b>.'}));
                  } else {
                    Item.list[ch].inventory.maille -= q;
                    Player.list[id].inventory.maille += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Maille</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Maille</b>.'}));
                }
              } else if(item == 'hauberk'){
                if(q <= Item.list[ch].inventory.hauberk){
                  if(player.inventory.hauberk + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Hauberk</b>.'}));
                  } else {
                    Item.list[ch].inventory.hauberk -= q;
                    Player.list[id].inventory.hauberk += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Hauberk</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Hauberk</b>.'}));
                }
              } else if(item == 'brynja'){
                if(q <= Item.list[ch].inventory.brynja){
                  if(player.inventory.brynja + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brynja</b>.'}));
                  } else {
                    Item.list[ch].inventory.brynja -= q;
                    Player.list[id].inventory.brynja += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brynja</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brynja</b>.'}));
                }
              } else if(item == 'cuirass'){
                if(q <= Item.list[ch].inventory.cuirass){
                  if(player.inventory.cuirass + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Cuirass</b>.'}));
                  } else {
                    Item.list[ch].inventory.cuirass -= q;
                    Player.list[id].inventory.cuirass += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Cuirass</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Cuirass</b>.'}));
                }
              } else if(item == 'steelplate'){
                if(q <= Item.list[ch].inventory.steelplate){
                  if(player.inventory.steelplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SteelPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.steelplate -= q;
                    Player.list[id].inventory.steelplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SteelPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SteelPlate</b>.'}));
                }
              } else if(item == 'greenwichplate'){
                if(q <= Item.list[ch].inventory.greenwichplate){
                  if(player.inventory.greenwichplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GreenwichPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.greenwichplate -= q;
                    Player.list[id].inventory.greenwichplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GreenwichPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GreenwichPlate</b>.'}));
                }
              } else if(item == 'gothicplate'){
                if(q <= Item.list[ch].inventory.gothicplate){
                  if(player.inventory.gothicplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GothicPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.gothicplate -= q;
                    Player.list[id].inventory.gothicplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GothicPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GothicPlate</b>.'}));
                }
              } else if(item == 'clericrobe'){
                if(q <= Item.list[ch].inventory.clericrobe){
                  if(player.inventory.clericrobe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>ClericRobe</b>.'}));
                  } else {
                    Item.list[ch].inventory.clericrobe -= q;
                    Player.list[id].inventory.clericrobe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>ClericRobe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>ClericRobe</b>.'}));
                }
              } else if(item == 'monkcowl'){
                if(q <= Item.list[ch].inventory.monkcowl){
                  if(player.inventory.monkcowl + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>MonkCowl</b>.'}));
                  } else {
                    Item.list[ch].inventory.monkcowl -= q;
                    Player.list[id].inventory.monkcowl += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>MonkCowl</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>MonkCowl</b>.'}));
                }
              } else if(item == 'blackcloak'){
                if(q <= Item.list[ch].inventory.blackcloak){
                  if(player.inventory.blackcloak + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BlackCloak</b>.'}));
                  } else {
                    Item.list[ch].inventory.blackcloak -= q;
                    Player.list[id].inventory.blackcloak += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BlackCloak</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BlackCloak</b>.'}));
                }
              } else if(item == 'tome'){
                if(q <= Item.list[ch].inventory.tome){
                  if(player.inventory.tome + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Tome</b>.'}));
                  } else {
                    Item.list[ch].inventory.tome -= q;
                    Player.list[id].inventory.tome += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Tome</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Tome</b>.'}));
                }
              } else if(item == 'runicscroll'){
                if(q <= Item.list[ch].inventory.runicscroll){
                  if(player.inventory.runicscroll + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RunicScroll</b>.'}));
                  } else {
                    Item.list[ch].inventory.runicscroll -= q;
                    Player.list[id].inventory.runicscroll += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RunicScroll</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RunicScroll</b>.'}));
                }
              } else if(item == 'sacredtext'){
                if(q <= Item.list[ch].inventory.sacredtext){
                  if(player.inventory.sacredtext + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SacredText</b>.'}));
                  } else {
                    Item.list[ch].inventory.sacredtext -= q;
                    Player.list[id].inventory.sacredtext += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SacredText</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SacredText</b>.'}));
                }
              } else if(item == 'stoneaxe'){
                if(q <= Item.list[ch].inventory.stoneaxe){
                  if(player.inventory.stoneaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>StoneAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.stoneaxe -= q;
                    Player.list[id].inventory.stoneaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>StoneAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>StoneAxe</b>.'}));
                }
              } else if(item == 'ironaxe'){
                if(q <= Item.list[ch].inventory.ironaxe){
                  if(player.inventory.ironaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>IronAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironaxe -= q;
                    Player.list[id].inventory.ironaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>IronAxe</b>.'}));
                }
              } else if(item == 'pickaxe'){
                if(q <= Item.list[ch].inventory.pickaxe){
                  if(player.inventory.pickaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PickAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.pickaxe -= q;
                    Player.list[id].inventory.pickaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PickAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PickAxe</b>.'}));
                }
              } else if(item == 'torch'){
                if(q <= Item.list[ch].inventory.torch){
                  if(player.inventory.torch + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Torch</b>.'}));
                  } else {
                    Item.list[ch].inventory.torch -= q;
                    Player.list[id].inventory.torch += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Torch</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Torch</b>.'}));
                }
              } else if(item == 'bread'){
                if(q <= Item.list[ch].inventory.bread){
                  if(player.inventory.bread + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Bread</b>.'}));
                  } else {
                    Item.list[ch].inventory.bread -= q;
                    Player.list[id].inventory.bread += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bread</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Bread</b>.'}));
                }
              } else if(item == 'fish'){
                if(q <= Item.list[ch].inventory.fish){
                  if(player.inventory.fish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Fish</b>.'}));
                  } else {
                    Item.list[ch].inventory.fish -= q;
                    Player.list[id].inventory.fish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Fish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Fish</b>.'}));
                }
              } else if(item == 'lamb'){
                if(q <= Item.list[ch].inventory.lamb){
                  if(player.inventory.lamb + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Lamb</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamb -= q;
                    Player.list[id].inventory.lamb += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamb</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamb</b>.'}));
                }
              } else if(item == 'boarmeat'){
                if(q <= Item.list[ch].inventory.boarmeat){
                  if(player.inventory.boarmeat + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarMeat</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarmeat -= q;
                    Player.list[id].inventory.boarmeat += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarMeat</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarMeat</b>.'}));
                }
              } else if(item == 'venison'){
                if(q <= Item.list[ch].inventory.venison){
                  if(player.inventory.venison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Venison</b>.'}));
                  } else {
                    Item.list[ch].inventory.venison -= q;
                    Player.list[id].inventory.venison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Venison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Venison</b>.'}));
                }
              } else if(item == 'poachedfish'){
                if(q <= Item.list[ch].inventory.poachedfish){
                  if(player.inventory.poachedfish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PoachedFish</b>.'}));
                  } else {
                    Item.list[ch].inventory.poachedfish -= q;
                    Player.list[id].inventory.poachedfish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PoachedFish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PoachedFish</b>.'}));
                }
              } else if(item == 'lambchop'){
                if(q <= Item.list[ch].inventory.lambchop){
                  if(player.inventory.lambchop + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>LambChop</b>.'}));
                  } else {
                    Item.list[ch].inventory.lambchop -= q;
                    Player.list[id].inventory.lambchop += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>LambChop</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>LambChop</b>.'}));
                }
              } else if(item == 'boarshank'){
                if(q <= Item.list[ch].inventory.boarshank){
                  if(player.inventory.boarshank + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarShank</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarshank -= q;
                    Player.list[id].inventory.boarshank += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarShank</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarShank</b>.'}));
                }
              } else if(item == 'venisonloin'){
                if(q <= Item.list[ch].inventory.venisonloin){
                  if(player.inventory.venisonloin + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>VenisonLoin</b>.'}));
                  } else {
                    Item.list[ch].inventory.venisonloin -= q;
                    Player.list[id].inventory.venisonloin += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>VenisonLoin</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>VenisonLoin</b>.'}));
                }
              } else if(item == 'mead'){
                if(q <= Item.list[ch].inventory.mead){
                  if(player.inventory.mead + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Mead</b>.'}));
                  } else {
                    Item.list[ch].inventory.mead -= q;
                    Player.list[id].inventory.mead += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Mead</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Mead</b>.'}));
                }
              } else if(item == 'saison'){
                if(q <= Item.list[ch].inventory.saison){
                  if(player.inventory.saison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Saison</b>.'}));
                  } else {
                    Item.list[ch].inventory.saison -= q;
                    Player.list[id].inventory.saison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Saison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Saison</b>.'}));
                }
              } else if(item == 'flanders'){
                if(q <= Item.list[ch].inventory.flanders){
                  if(player.inventory.flanders + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Flanders</b>.'}));
                  } else {
                    Item.list[ch].inventory.flanders -= q;
                    Player.list[id].inventory.flanders += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flanders</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Flanders</b>.'}));
                }
              } else if(item == 'bieredegarde'){
                if(q <= Item.list[ch].inventory.bieredegarde){
                  if(player.inventory.bieredegarde + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BiereDeGarde</b>.'}));
                  } else {
                    Item.list[ch].inventory.bieredegarde -= q;
                    Player.list[id].inventory.bieredegarde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BiereDeGarde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BiereDeGarde</b>.'}));
                }
              } else if(item == 'bordeaux'){
                if(q <= Item.list[ch].inventory.bordeaux){
                  if(player.inventory.bordeaux + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bordeaux</b>.'}));
                  } else {
                    Item.list[ch].inventory.bordeaux -= q;
                    Player.list[id].inventory.bordeaux += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bordeaux</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bordeaux</b>.'}));
                }
              } else if(item == 'bourgogne'){
                if(q <= Item.list[ch].inventory.bourgogne){
                  if(player.inventory.bourgogne + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bourgogne</b>.'}));
                  } else {
                    Item.list[ch].inventory.bourgogne -= q;
                    Player.list[id].inventory.bourgogne += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bourgogne</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bourgogne</b>.'}));
                }
              } else if(item == 'chianti'){
                if(q <= Item.list[ch].inventory.chianti){
                  if(player.inventory.chianti + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Chianti</b>.'}));
                  } else {
                    Item.list[ch].inventory.chianti -= q;
                    Player.list[id].inventory.chianti += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Chianti</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Chianti</b>.'}));
                }
              } else if(item == 'crown'){
                if(q <= Item.list[ch].inventory.crown){
                  if(player.inventory.crown + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Crown</b>.'}));
                  } else {
                    Item.list[ch].inventory.crown -= q;
                    Player.list[id].inventory.crown += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Crown</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Crown</b>.'}));
                }
              } else if(item == 'arrows'){
                if(q <= Item.list[ch].inventory.arrows){
                  if(player.inventory.arrows + q > 50){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Arrows</b>.'}));
                  } else {
                    Item.list[ch].inventory.arrows -= q;
                    Player.list[id].inventory.arrows += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Arrows</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Arrows</b>.'}));
                }
              } else if(item == 'worldmap'){
                if(q <= Item.list[ch].inventory.worldmap){
                  if(player.inventory.worldmap + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WorldMap</b>.'}));
                  } else {
                    Item.list[ch].inventory.worldmap -= q;
                    Player.list[id].inventory.worldmap += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WorldMap</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WorldMap</b>.'}));
                }
              } else if(item == 'relic'){
                if(q <= Item.list[ch].inventory.relic){
                  if(player.inventory.relic + q > 1){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying a</i> <b>Relic</b>.'}));
                  } else {
                    Item.list[ch].inventory.relic -= q;
                    Player.list[id].inventory.relic += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Relic</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Relic</b>.'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not a valid</i> <b>ItemName</b>.'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
            }
          }
        } else if(player.facing == 'left'){
          if(getItem(z,c-1,r) == 'LockedChest' || getItem(z,c-1,r) == 'Chest'){
            var chCoords = getCoords(c-1,r1);
            var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
            if(ch){
              if(item == 'wood'){
                if(q <= Item.list[ch].inventory.wood){
                  if(player.inventory.wood + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Wood</b>.'}));
                  } else {
                    Item.list[ch].inventory.wood -= q;
                    Player.list[id].inventory.wood += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Wood</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Wood</b>.'}));
                }
              } else if(item == 'stone'){
                if(q <= Item.list[ch].inventory.stone){
                  if(player.inventory.stone + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Stone</b>.'}));
                  } else {
                    Item.list[ch].inventory.stone -= q;
                    Player.list[id].inventory.stone += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Stone</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Stone</b>.'}));
                }
              } else if(item == 'grain'){
                if(q <= Item.list[ch].inventory.grain){
                  if(player.inventory.grain + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Grain</b>.'}));
                  } else {
                    Item.list[ch].inventory.grain -= q;
                    Player.list[id].inventory.grain += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Grain</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Grain</b>.'}));
                }
              } else if(item == 'flour'){
                if(q <= Item.list[ch].inventory.flour){
                  if(player.inventory.flour + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Flour</b>.'}));
                  } else {
                    Item.list[ch].inventory.flour -= q;
                    Player.list[id].inventory.flour += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flour</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Flour</b>.'}));
                }
              } else if(item == 'dough'){
                if(q <= Item.list[ch].inventory.dough){
                  if(player.inventory.dough + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Dough</b>.'}));
                  } else {
                    Item.list[ch].inventory.dough -= q;
                    Player.list[id].inventory.dough += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dough</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Dough</b>.'}));
                }
              } else if(item == 'ironore'){
                if(q <= Item.list[ch].inventory.ironore){
                  if(player.inventory.ironore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>IronOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironore -= q;
                    Player.list[id].inventory.ironore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>IronOre</b>.'}));
                }
              } else if(item == 'iron'){
                if(q <= Item.list[ch].inventory.iron){
                  if(player.inventory.iron + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Iron</b>.'}));
                  } else {
                    Item.list[ch].inventory.iron -= q;
                    Player.list[id].inventory.iron += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Iron</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Iron</b>.'}));
                }
              } else if(item == 'steel'){
                if(q <= Item.list[ch].inventory.steel){
                  if(player.inventory.steel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Steel</b>.'}));
                  } else {
                    Item.list[ch].inventory.steel -= q;
                    Player.list[id].inventory.steel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Steel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Steel</b>.'}));
                }
              } else if(item == 'boarhide'){
                if(q <= Item.list[ch].inventory.boarhide){
                  if(player.inventory.boarhide + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarHide</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarhide -= q;
                    Player.list[id].inventory.boarhide += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarHide</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarHide</b>.'}));
                }
              } else if(item == 'leather'){
                if(q <= Item.list[ch].inventory.leather){
                  if(player.inventory.leather + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Leather</b>.'}));
                  } else {
                    Item.list[ch].inventory.leather -= q;
                    Player.list[id].inventory.leather += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Leather</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Leather</b>.'}));
                }
              } else if(item == 'silverore'){
                if(q <= Item.list[ch].inventory.silverore){
                  if(player.inventory.silverore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>SilverOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.silverore -= q;
                    Player.list[id].inventory.silverore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SilverOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>SilverOre</b>.'}));
                }
              } else if(item == 'silver'){
                if(q <= Item.list[ch].inventory.silver){
                  Item.list[ch].inventory.silver -= q;
                  Player.list[id].inventory.silver += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Silver</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Silver</b>.'}));
                }
              } else if(item == 'goldore'){
                if(q <= Item.list[ch].inventory.goldore){
                  if(player.inventory.goldore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>GoldOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.goldore -= q;
                    Player.list[id].inventory.goldore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GoldOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>GoldOre</b>.'}));
                }
              } else if(item == 'gold'){
                if(q <= Item.list[ch].inventory.gold){
                  Item.list[ch].inventory.gold -= q;
                  Player.list[id].inventory.gold += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Gold</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Gold</b>.'}));
                }
              } else if(item == 'diamond'){
                if(q <= Item.list[ch].inventory.diamond){
                  Item.list[ch].inventory.diamond -= q;
                  Player.list[id].inventory.diamond += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Diamond</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Diamond</b>.'}));
                }
              } else if(item == 'huntingknife'){
                if(q <= Item.list[ch].inventory.huntingknife){
                  if(player.inventory.huntingknife + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>HuntingKnife</b>.'}));
                  } else {
                    Item.list[ch].inventory.huntingknife -= q;
                    Player.list[id].inventory.huntingknife += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>HuntingKnife</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>HuntingKnife</b>.'}));
                }
              } else if(item == 'dague'){
                if(q <= Item.list[ch].inventory.dague){
                  if(player.inventory.dague + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Dague</b>.'}));
                  } else {
                    Item.list[ch].inventory.dague -= q;
                    Player.list[id].inventory.dague += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dague</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Dague</b>.'}));
                }
              } else if(item == 'rondel'){
                if(q <= Item.list[ch].inventory.rondel){
                  if(player.inventory.rondel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Rondel</b>.'}));
                  } else {
                    Item.list[ch].inventory.rondel -= q;
                    Player.list[id].inventory.rondel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Rondel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Rondel</b>.'}));
                }
              } else if(item == 'misericorde'){
                if(q <= Item.list[ch].inventory.misericorde){
                  if(player.inventory.misericorde + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Misericorde</b>.'}));
                  } else {
                    Item.list[ch].inventory.misericorde -= q;
                    Player.list[id].inventory.misericorde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Misericorde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Misericorde</b>.'}));
                }
              } else if(item == 'bastardsword'){
                if(q <= Item.list[ch].inventory.bastardsword){
                  if(player.inventory.bastardsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BastardSword</b>.'}));
                  } else {
                    Item.list[ch].inventory.bastardsword -= q;
                    Player.list[id].inventory.bastardsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BastardSword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BastardSword</b>.'}));
                }
              } else if(item == 'longsword'){
                if(q <= Item.list[ch].inventory.longsword){
                  if(player.inventory.longsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Longsword</b>.'}));
                  } else {
                    Item.list[ch].inventory.longsword -= q;
                    Player.list[id].inventory.longsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Longsword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Longsword</b>.'}));
                }
              } else if(item == 'zweihander'){
                if(q <= Item.list[ch].inventory.zweihander){
                  if(player.inventory.zweihander + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Zweihander</b>.'}));
                  } else {
                    Item.list[ch].inventory.zweihander -= q;
                    Player.list[id].inventory.zweihander += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Zweihander</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Zweihander</b>.'}));
                }
              } else if(item == 'morallta'){
                if(q <= Item.list[ch].inventory.morallta){
                  if(player.inventory.morallta + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Morallta</b>.'}));
                  } else {
                    Item.list[ch].inventory.morallta -= q;
                    Player.list[id].inventory.morallta += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Morallta</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Morallta</b>.'}));
                }
              } else if(item == 'bow'){
                if(q <= Item.list[ch].inventory.bow){
                  if(player.inventory.bow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bow</b>.'}));
                  } else {
                    Item.list[ch].inventory.bow -= q;
                    Player.list[id].inventory.bow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bow</b>.'}));
                }
              } else if(item == 'welshlongbow'){
                if(q <= Item.list[ch].inventory.welshlongbow){
                  if(player.inventory.welshlongbow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WelshLongbow</b>.'}));
                  } else {
                    Item.list[ch].inventory.welshlongbow -= q;
                    Player.list[id].inventory.welshlongbow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WelshLongbow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WelshLongbow</b>.'}));
                }
              } else if(item == 'knightlance'){
                if(q <= Item.list[ch].inventory.knightlance){
                  if(player.inventory.knightlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>KnightLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.knightlance -= q;
                    Player.list[id].inventory.knightlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>KnightLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>KnightLance</b>.'}));
                }
              } else if(item == 'rusticlance'){
                if(q <= Item.list[ch].inventory.rusticlance){
                  if(player.inventory.rusticlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RusticLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.rusticlance -= q;
                    Player.list[id].inventory.rusticlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RusticLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RusticLance</b>.'}));
                }
              } else if(item == 'paladinlance'){
                if(q <= Item.list[ch].inventory.paladinlance){
                  if(player.inventory.paladinlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PaladinLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.paladinlance -= q;
                    Player.list[id].inventory.paladinlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PaladinLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PaladinLance</b>.'}));
                }
              } else if(item == 'brigandine'){
                if(q <= Item.list[ch].inventory.brigandine){
                  if(player.inventory.brigandine + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brigandine</b>.'}));
                  } else {
                    Item.list[ch].inventory.brigandine -= q;
                    Player.list[id].inventory.brigandine += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brigandine</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brigandine</b>.'}));
                }
              } else if(item == 'lamellar'){
                if(q <= Item.list[ch].inventory.lamellar){
                  if(player.inventory.lamellar + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Lamellar</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamellar -= q;
                    Player.list[id].inventory.lamellar += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamellar</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamellar</b>.'}));
                }
              } else if(item == 'maille'){
                if(q <= Item.list[ch].inventory.maille){
                  if(player.inventory.maille + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Maille</b>.'}));
                  } else {
                    Item.list[ch].inventory.maille -= q;
                    Player.list[id].inventory.maille += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Maille</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Maille</b>.'}));
                }
              } else if(item == 'hauberk'){
                if(q <= Item.list[ch].inventory.hauberk){
                  if(player.inventory.hauberk + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Hauberk</b>.'}));
                  } else {
                    Item.list[ch].inventory.hauberk -= q;
                    Player.list[id].inventory.hauberk += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Hauberk</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Hauberk</b>.'}));
                }
              } else if(item == 'brynja'){
                if(q <= Item.list[ch].inventory.brynja){
                  if(player.inventory.brynja + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brynja</b>.'}));
                  } else {
                    Item.list[ch].inventory.brynja -= q;
                    Player.list[id].inventory.brynja += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brynja</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brynja</b>.'}));
                }
              } else if(item == 'cuirass'){
                if(q <= Item.list[ch].inventory.cuirass){
                  if(player.inventory.cuirass + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Cuirass</b>.'}));
                  } else {
                    Item.list[ch].inventory.cuirass -= q;
                    Player.list[id].inventory.cuirass += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Cuirass</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Cuirass</b>.'}));
                }
              } else if(item == 'steelplate'){
                if(q <= Item.list[ch].inventory.steelplate){
                  if(player.inventory.steelplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SteelPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.steelplate -= q;
                    Player.list[id].inventory.steelplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SteelPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SteelPlate</b>.'}));
                }
              } else if(item == 'greenwichplate'){
                if(q <= Item.list[ch].inventory.greenwichplate){
                  if(player.inventory.greenwichplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GreenwichPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.greenwichplate -= q;
                    Player.list[id].inventory.greenwichplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GreenwichPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GreenwichPlate</b>.'}));
                }
              } else if(item == 'gothicplate'){
                if(q <= Item.list[ch].inventory.gothicplate){
                  if(player.inventory.gothicplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GothicPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.gothicplate -= q;
                    Player.list[id].inventory.gothicplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GothicPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GothicPlate</b>.'}));
                }
              } else if(item == 'clericrobe'){
                if(q <= Item.list[ch].inventory.clericrobe){
                  if(player.inventory.clericrobe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>ClericRobe</b>.'}));
                  } else {
                    Item.list[ch].inventory.clericrobe -= q;
                    Player.list[id].inventory.clericrobe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>ClericRobe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>ClericRobe</b>.'}));
                }
              } else if(item == 'monkcowl'){
                if(q <= Item.list[ch].inventory.monkcowl){
                  if(player.inventory.monkcowl + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>MonkCowl</b>.'}));
                  } else {
                    Item.list[ch].inventory.monkcowl -= q;
                    Player.list[id].inventory.monkcowl += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>MonkCowl</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>MonkCowl</b>.'}));
                }
              } else if(item == 'blackcloak'){
                if(q <= Item.list[ch].inventory.blackcloak){
                  if(player.inventory.blackcloak + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BlackCloak</b>.'}));
                  } else {
                    Item.list[ch].inventory.blackcloak -= q;
                    Player.list[id].inventory.blackcloak += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BlackCloak</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BlackCloak</b>.'}));
                }
              } else if(item == 'tome'){
                if(q <= Item.list[ch].inventory.tome){
                  if(player.inventory.tome + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Tome</b>.'}));
                  } else {
                    Item.list[ch].inventory.tome -= q;
                    Player.list[id].inventory.tome += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Tome</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Tome</b>.'}));
                }
              } else if(item == 'runicscroll'){
                if(q <= Item.list[ch].inventory.runicscroll){
                  if(player.inventory.runicscroll + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RunicScroll</b>.'}));
                  } else {
                    Item.list[ch].inventory.runicscroll -= q;
                    Player.list[id].inventory.runicscroll += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RunicScroll</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RunicScroll</b>.'}));
                }
              } else if(item == 'sacredtext'){
                if(q <= Item.list[ch].inventory.sacredtext){
                  if(player.inventory.sacredtext + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SacredText</b>.'}));
                  } else {
                    Item.list[ch].inventory.sacredtext -= q;
                    Player.list[id].inventory.sacredtext += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SacredText</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SacredText</b>.'}));
                }
              } else if(item == 'stoneaxe'){
                if(q <= Item.list[ch].inventory.stoneaxe){
                  if(player.inventory.stoneaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>StoneAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.stoneaxe -= q;
                    Player.list[id].inventory.stoneaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>StoneAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>StoneAxe</b>.'}));
                }
              } else if(item == 'ironaxe'){
                if(q <= Item.list[ch].inventory.ironaxe){
                  if(player.inventory.ironaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>IronAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironaxe -= q;
                    Player.list[id].inventory.ironaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>IronAxe</b>.'}));
                }
              } else if(item == 'pickaxe'){
                if(q <= Item.list[ch].inventory.pickaxe){
                  if(player.inventory.pickaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PickAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.pickaxe -= q;
                    Player.list[id].inventory.pickaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PickAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PickAxe</b>.'}));
                }
              } else if(item == 'torch'){
                if(q <= Item.list[ch].inventory.torch){
                  if(player.inventory.torch + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Torch</b>.'}));
                  } else {
                    Item.list[ch].inventory.torch -= q;
                    Player.list[id].inventory.torch += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Torch</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Torch</b>.'}));
                }
              } else if(item == 'bread'){
                if(q <= Item.list[ch].inventory.bread){
                  if(player.inventory.bread + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Bread</b>.'}));
                  } else {
                    Item.list[ch].inventory.bread -= q;
                    Player.list[id].inventory.bread += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bread</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Bread</b>.'}));
                }
              } else if(item == 'fish'){
                if(q <= Item.list[ch].inventory.fish){
                  if(player.inventory.fish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Fish</b>.'}));
                  } else {
                    Item.list[ch].inventory.fish -= q;
                    Player.list[id].inventory.fish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Fish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Fish</b>.'}));
                }
              } else if(item == 'lamb'){
                if(q <= Item.list[ch].inventory.lamb){
                  if(player.inventory.lamb + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Lamb</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamb -= q;
                    Player.list[id].inventory.lamb += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamb</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamb</b>.'}));
                }
              } else if(item == 'boarmeat'){
                if(q <= Item.list[ch].inventory.boarmeat){
                  if(player.inventory.boarmeat + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarMeat</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarmeat -= q;
                    Player.list[id].inventory.boarmeat += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarMeat</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarMeat</b>.'}));
                }
              } else if(item == 'venison'){
                if(q <= Item.list[ch].inventory.venison){
                  if(player.inventory.venison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Venison</b>.'}));
                  } else {
                    Item.list[ch].inventory.venison -= q;
                    Player.list[id].inventory.venison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Venison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Venison</b>.'}));
                }
              } else if(item == 'poachedfish'){
                if(q <= Item.list[ch].inventory.poachedfish){
                  if(player.inventory.poachedfish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PoachedFish</b>.'}));
                  } else {
                    Item.list[ch].inventory.poachedfish -= q;
                    Player.list[id].inventory.poachedfish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PoachedFish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PoachedFish</b>.'}));
                }
              } else if(item == 'lambchop'){
                if(q <= Item.list[ch].inventory.lambchop){
                  if(player.inventory.lambchop + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>LambChop</b>.'}));
                  } else {
                    Item.list[ch].inventory.lambchop -= q;
                    Player.list[id].inventory.lambchop += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>LambChop</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>LambChop</b>.'}));
                }
              } else if(item == 'boarshank'){
                if(q <= Item.list[ch].inventory.boarshank){
                  if(player.inventory.boarshank + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarShank</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarshank -= q;
                    Player.list[id].inventory.boarshank += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarShank</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarShank</b>.'}));
                }
              } else if(item == 'venisonloin'){
                if(q <= Item.list[ch].inventory.venisonloin){
                  if(player.inventory.venisonloin + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>VenisonLoin</b>.'}));
                  } else {
                    Item.list[ch].inventory.venisonloin -= q;
                    Player.list[id].inventory.venisonloin += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>VenisonLoin</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>VenisonLoin</b>.'}));
                }
              } else if(item == 'mead'){
                if(q <= Item.list[ch].inventory.mead){
                  if(player.inventory.mead + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Mead</b>.'}));
                  } else {
                    Item.list[ch].inventory.mead -= q;
                    Player.list[id].inventory.mead += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Mead</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Mead</b>.'}));
                }
              } else if(item == 'saison'){
                if(q <= Item.list[ch].inventory.saison){
                  if(player.inventory.saison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Saison</b>.'}));
                  } else {
                    Item.list[ch].inventory.saison -= q;
                    Player.list[id].inventory.saison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Saison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Saison</b>.'}));
                }
              } else if(item == 'flanders'){
                if(q <= Item.list[ch].inventory.flanders){
                  if(player.inventory.flanders + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Flanders</b>.'}));
                  } else {
                    Item.list[ch].inventory.flanders -= q;
                    Player.list[id].inventory.flanders += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flanders</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Flanders</b>.'}));
                }
              } else if(item == 'bieredegarde'){
                if(q <= Item.list[ch].inventory.bieredegarde){
                  if(player.inventory.bieredegarde + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BiereDeGarde</b>.'}));
                  } else {
                    Item.list[ch].inventory.bieredegarde -= q;
                    Player.list[id].inventory.bieredegarde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BiereDeGarde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BiereDeGarde</b>.'}));
                }
              } else if(item == 'bordeaux'){
                if(q <= Item.list[ch].inventory.bordeaux){
                  if(player.inventory.bordeaux + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bordeaux</b>.'}));
                  } else {
                    Item.list[ch].inventory.bordeaux -= q;
                    Player.list[id].inventory.bordeaux += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bordeaux</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bordeaux</b>.'}));
                }
              } else if(item == 'bourgogne'){
                if(q <= Item.list[ch].inventory.bourgogne){
                  if(player.inventory.bourgogne + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bourgogne</b>.'}));
                  } else {
                    Item.list[ch].inventory.bourgogne -= q;
                    Player.list[id].inventory.bourgogne += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bourgogne</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bourgogne</b>.'}));
                }
              } else if(item == 'chianti'){
                if(q <= Item.list[ch].inventory.chianti){
                  if(player.inventory.chianti + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Chianti</b>.'}));
                  } else {
                    Item.list[ch].inventory.chianti -= q;
                    Player.list[id].inventory.chianti += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Chianti</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Chianti</b>.'}));
                }
              } else if(item == 'crown'){
                if(q <= Item.list[ch].inventory.crown){
                  if(player.inventory.crown + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Crown</b>.'}));
                  } else {
                    Item.list[ch].inventory.crown -= q;
                    Player.list[id].inventory.crown += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Crown</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Crown</b>.'}));
                }
              } else if(item == 'arrows'){
                if(q <= Item.list[ch].inventory.arrows){
                  if(player.inventory.arrows + q > 50){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Arrows</b>.'}));
                  } else {
                    Item.list[ch].inventory.arrows -= q;
                    Player.list[id].inventory.arrows += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Arrows</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Arrows</b>.'}));
                }
              } else if(item == 'worldmap'){
                if(q <= Item.list[ch].inventory.worldmap){
                  if(player.inventory.worldmap + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WorldMap</b>.'}));
                  } else {
                    Item.list[ch].inventory.worldmap -= q;
                    Player.list[id].inventory.worldmap += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WorldMap</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WorldMap</b>.'}));
                }
              } else if(item == 'relic'){
                if(q <= Item.list[ch].inventory.relic){
                  if(player.inventory.relic + q > 1){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying a</i> <b>Relic</b>.'}));
                  } else {
                    Item.list[ch].inventory.relic -= q;
                    Player.list[id].inventory.relic += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Relic</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Relic</b>.'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not a valid</i> <b>ItemName</b>.'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
            }
          }
        } else if(player.facing == 'right'){
          if(getItem(z,c+1,r) == 'LockedChest' || getItem(z,c+1,r) == 'Chest'){
            var chCoords = getCoords(c+1,r);
            var ch = chestCheck(z,chCoords[0],chCoords[1],player.id);
            if(ch){
              if(item == 'wood'){
                if(q <= Item.list[ch].inventory.wood){
                  if(player.inventory.wood + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Wood</b>.'}));
                  } else {
                    Item.list[ch].inventory.wood -= q;
                    Player.list[id].inventory.wood += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Wood</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Wood</b>.'}));
                }
              } else if(item == 'stone'){
                if(q <= Item.list[ch].inventory.stone){
                  if(player.inventory.stone + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Stone</b>.'}));
                  } else {
                    Item.list[ch].inventory.stone -= q;
                    Player.list[id].inventory.stone += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Stone</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Stone</b>.'}));
                }
              } else if(item == 'grain'){
                if(q <= Item.list[ch].inventory.grain){
                  if(player.inventory.grain + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Grain</b>.'}));
                  } else {
                    Item.list[ch].inventory.grain -= q;
                    Player.list[id].inventory.grain += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Grain</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Grain</b>.'}));
                }
              } else if(item == 'flour'){
                if(q <= Item.list[ch].inventory.flour){
                  if(player.inventory.flour + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Flour</b>.'}));
                  } else {
                    Item.list[ch].inventory.flour -= q;
                    Player.list[id].inventory.flour += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flour</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Flour</b>.'}));
                }
              } else if(item == 'dough'){
                if(q <= Item.list[ch].inventory.dough){
                  if(player.inventory.dough + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Dough</b>.'}));
                  } else {
                    Item.list[ch].inventory.dough -= q;
                    Player.list[id].inventory.dough += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dough</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Dough</b>.'}));
                }
              } else if(item == 'ironore'){
                if(q <= Item.list[ch].inventory.ironore){
                  if(player.inventory.ironore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>IronOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironore -= q;
                    Player.list[id].inventory.ironore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>IronOre</b>.'}));
                }
              } else if(item == 'iron'){
                if(q <= Item.list[ch].inventory.iron){
                  if(player.inventory.iron + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Iron</b>.'}));
                  } else {
                    Item.list[ch].inventory.iron -= q;
                    Player.list[id].inventory.iron += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Iron</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Iron</b>.'}));
                }
              } else if(item == 'steel'){
                if(q <= Item.list[ch].inventory.steel){
                  if(player.inventory.steel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Steel</b>.'}));
                  } else {
                    Item.list[ch].inventory.steel -= q;
                    Player.list[id].inventory.steel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Steel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Steel</b>.'}));
                }
              } else if(item == 'boarhide'){
                if(q <= Item.list[ch].inventory.boarhide){
                  if(player.inventory.boarhide + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarHide</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarhide -= q;
                    Player.list[id].inventory.boarhide += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarHide</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarHide</b>.'}));
                }
              } else if(item == 'leather'){
                if(q <= Item.list[ch].inventory.leather){
                  if(player.inventory.leather + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Leather</b>.'}));
                  } else {
                    Item.list[ch].inventory.leather -= q;
                    Player.list[id].inventory.leather += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Leather</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Leather</b>.'}));
                }
              } else if(item == 'silverore'){
                if(q <= Item.list[ch].inventory.silverore){
                  if(player.inventory.silverore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>SilverOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.silverore -= q;
                    Player.list[id].inventory.silverore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SilverOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>SilverOre</b>.'}));
                }
              } else if(item == 'silver'){
                if(q <= Item.list[ch].inventory.silver){
                  Item.list[ch].inventory.silver -= q;
                  Player.list[id].inventory.silver += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Silver</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Silver</b>.'}));
                }
              } else if(item == 'goldore'){
                if(q <= Item.list[ch].inventory.goldore){
                  if(player.inventory.goldore + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>GoldOre</b>.'}));
                  } else {
                    Item.list[ch].inventory.goldore -= q;
                    Player.list[id].inventory.goldore += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GoldOre</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>GoldOre</b>.'}));
                }
              } else if(item == 'gold'){
                if(q <= Item.list[ch].inventory.gold){
                  Item.list[ch].inventory.gold -= q;
                  Player.list[id].inventory.gold += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Gold</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Gold</b>.'}));
                }
              } else if(item == 'diamond'){
                if(q <= Item.list[ch].inventory.diamond){
                  Item.list[ch].inventory.diamond -= q;
                  Player.list[id].inventory.diamond += q;
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Diamond</b> <i>from the chest.</i>'}));
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Diamond</b>.'}));
                }
              } else if(item == 'huntingknife'){
                if(q <= Item.list[ch].inventory.huntingknife){
                  if(player.inventory.huntingknife + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>HuntingKnife</b>.'}));
                  } else {
                    Item.list[ch].inventory.huntingknife -= q;
                    Player.list[id].inventory.huntingknife += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>HuntingKnife</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>HuntingKnife</b>.'}));
                }
              } else if(item == 'dague'){
                if(q <= Item.list[ch].inventory.dague){
                  if(player.inventory.dague + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Dague</b>.'}));
                  } else {
                    Item.list[ch].inventory.dague -= q;
                    Player.list[id].inventory.dague += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Dague</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Dague</b>.'}));
                }
              } else if(item == 'rondel'){
                if(q <= Item.list[ch].inventory.rondel){
                  if(player.inventory.rondel + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Rondel</b>.'}));
                  } else {
                    Item.list[ch].inventory.rondel -= q;
                    Player.list[id].inventory.rondel += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Rondel</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Rondel</b>.'}));
                }
              } else if(item == 'misericorde'){
                if(q <= Item.list[ch].inventory.misericorde){
                  if(player.inventory.misericorde + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Misericorde</b>.'}));
                  } else {
                    Item.list[ch].inventory.misericorde -= q;
                    Player.list[id].inventory.misericorde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Misericorde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Misericorde</b>.'}));
                }
              } else if(item == 'bastardsword'){
                if(q <= Item.list[ch].inventory.bastardsword){
                  if(player.inventory.bastardsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BastardSword</b>.'}));
                  } else {
                    Item.list[ch].inventory.bastardsword -= q;
                    Player.list[id].inventory.bastardsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BastardSword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BastardSword</b>.'}));
                }
              } else if(item == 'longsword'){
                if(q <= Item.list[ch].inventory.longsword){
                  if(player.inventory.longsword + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Longsword</b>.'}));
                  } else {
                    Item.list[ch].inventory.longsword -= q;
                    Player.list[id].inventory.longsword += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Longsword</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Longsword</b>.'}));
                }
              } else if(item == 'zweihander'){
                if(q <= Item.list[ch].inventory.zweihander){
                  if(player.inventory.zweihander + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Zweihander</b>.'}));
                  } else {
                    Item.list[ch].inventory.zweihander -= q;
                    Player.list[id].inventory.zweihander += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Zweihander</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Zweihander</b>.'}));
                }
              } else if(item == 'morallta'){
                if(q <= Item.list[ch].inventory.morallta){
                  if(player.inventory.morallta + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Morallta</b>.'}));
                  } else {
                    Item.list[ch].inventory.morallta -= q;
                    Player.list[id].inventory.morallta += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Morallta</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Morallta</b>.'}));
                }
              } else if(item == 'bow'){
                if(q <= Item.list[ch].inventory.bow){
                  if(player.inventory.bow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bow</b>.'}));
                  } else {
                    Item.list[ch].inventory.bow -= q;
                    Player.list[id].inventory.bow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bow</b>.'}));
                }
              } else if(item == 'welshlongbow'){
                if(q <= Item.list[ch].inventory.welshlongbow){
                  if(player.inventory.welshlongbow + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WelshLongbow</b>.'}));
                  } else {
                    Item.list[ch].inventory.welshlongbow -= q;
                    Player.list[id].inventory.welshlongbow += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WelshLongbow</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WelshLongbow</b>.'}));
                }
              } else if(item == 'knightlance'){
                if(q <= Item.list[ch].inventory.knightlance){
                  if(player.inventory.knightlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>KnightLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.knightlance -= q;
                    Player.list[id].inventory.knightlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>KnightLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>KnightLance</b>.'}));
                }
              } else if(item == 'rusticlance'){
                if(q <= Item.list[ch].inventory.rusticlance){
                  if(player.inventory.rusticlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RusticLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.rusticlance -= q;
                    Player.list[id].inventory.rusticlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RusticLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RusticLance</b>.'}));
                }
              } else if(item == 'paladinlance'){
                if(q <= Item.list[ch].inventory.paladinlance){
                  if(player.inventory.paladinlance + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PaladinLance</b>.'}));
                  } else {
                    Item.list[ch].inventory.paladinlance -= q;
                    Player.list[id].inventory.paladinlance += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PaladinLance</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PaladinLance</b>.'}));
                }
              } else if(item == 'brigandine'){
                if(q <= Item.list[ch].inventory.brigandine){
                  if(player.inventory.brigandine + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brigandine</b>.'}));
                  } else {
                    Item.list[ch].inventory.brigandine -= q;
                    Player.list[id].inventory.brigandine += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brigandine</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brigandine</b>.'}));
                }
              } else if(item == 'lamellar'){
                if(q <= Item.list[ch].inventory.lamellar){
                  if(player.inventory.lamellar + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Lamellar</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamellar -= q;
                    Player.list[id].inventory.lamellar += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamellar</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamellar</b>.'}));
                }
              } else if(item == 'maille'){
                if(q <= Item.list[ch].inventory.maille){
                  if(player.inventory.maille + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Maille</b>.'}));
                  } else {
                    Item.list[ch].inventory.maille -= q;
                    Player.list[id].inventory.maille += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Maille</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Maille</b>.'}));
                }
              } else if(item == 'hauberk'){
                if(q <= Item.list[ch].inventory.hauberk){
                  if(player.inventory.hauberk + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Hauberk</b>.'}));
                  } else {
                    Item.list[ch].inventory.hauberk -= q;
                    Player.list[id].inventory.hauberk += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Hauberk</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Hauberk</b>.'}));
                }
              } else if(item == 'brynja'){
                if(q <= Item.list[ch].inventory.brynja){
                  if(player.inventory.brynja + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Brynja</b>.'}));
                  } else {
                    Item.list[ch].inventory.brynja -= q;
                    Player.list[id].inventory.brynja += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Brynja</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Brynja</b>.'}));
                }
              } else if(item == 'cuirass'){
                if(q <= Item.list[ch].inventory.cuirass){
                  if(player.inventory.cuirass + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Cuirass</b>.'}));
                  } else {
                    Item.list[ch].inventory.cuirass -= q;
                    Player.list[id].inventory.cuirass += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Cuirass</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Cuirass</b>.'}));
                }
              } else if(item == 'steelplate'){
                if(q <= Item.list[ch].inventory.steelplate){
                  if(player.inventory.steelplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SteelPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.steelplate -= q;
                    Player.list[id].inventory.steelplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SteelPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SteelPlate</b>.'}));
                }
              } else if(item == 'greenwichplate'){
                if(q <= Item.list[ch].inventory.greenwichplate){
                  if(player.inventory.greenwichplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GreenwichPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.greenwichplate -= q;
                    Player.list[id].inventory.greenwichplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GreenwichPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GreenwichPlate</b>.'}));
                }
              } else if(item == 'gothicplate'){
                if(q <= Item.list[ch].inventory.gothicplate){
                  if(player.inventory.gothicplate + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>GothicPlate</b>.'}));
                  } else {
                    Item.list[ch].inventory.gothicplate -= q;
                    Player.list[id].inventory.gothicplate += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>GothicPlate</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>GothicPlate</b>.'}));
                }
              } else if(item == 'clericrobe'){
                if(q <= Item.list[ch].inventory.clericrobe){
                  if(player.inventory.clericrobe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>ClericRobe</b>.'}));
                  } else {
                    Item.list[ch].inventory.clericrobe -= q;
                    Player.list[id].inventory.clericrobe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>ClericRobe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>ClericRobe</b>.'}));
                }
              } else if(item == 'monkcowl'){
                if(q <= Item.list[ch].inventory.monkcowl){
                  if(player.inventory.monkcowl + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>MonkCowl</b>.'}));
                  } else {
                    Item.list[ch].inventory.monkcowl -= q;
                    Player.list[id].inventory.monkcowl += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>MonkCowl</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>MonkCowl</b>.'}));
                }
              } else if(item == 'blackcloak'){
                if(q <= Item.list[ch].inventory.blackcloak){
                  if(player.inventory.blackcloak + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BlackCloak</b>.'}));
                  } else {
                    Item.list[ch].inventory.blackcloak -= q;
                    Player.list[id].inventory.blackcloak += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BlackCloak</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BlackCloak</b>.'}));
                }
              } else if(item == 'tome'){
                if(q <= Item.list[ch].inventory.tome){
                  if(player.inventory.tome + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Tome</b>.'}));
                  } else {
                    Item.list[ch].inventory.tome -= q;
                    Player.list[id].inventory.tome += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Tome</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Tome</b>.'}));
                }
              } else if(item == 'runicscroll'){
                if(q <= Item.list[ch].inventory.runicscroll){
                  if(player.inventory.runicscroll + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>RunicScroll</b>.'}));
                  } else {
                    Item.list[ch].inventory.runicscroll -= q;
                    Player.list[id].inventory.runicscroll += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>RunicScroll</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>RunicScroll</b>.'}));
                }
              } else if(item == 'sacredtext'){
                if(q <= Item.list[ch].inventory.sacredtext){
                  if(player.inventory.sacredtext + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>SacredText</b>.'}));
                  } else {
                    Item.list[ch].inventory.sacredtext -= q;
                    Player.list[id].inventory.sacredtext += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>SacredText</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>SacredText</b>.'}));
                }
              } else if(item == 'stoneaxe'){
                if(q <= Item.list[ch].inventory.stoneaxe){
                  if(player.inventory.stoneaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>StoneAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.stoneaxe -= q;
                    Player.list[id].inventory.stoneaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>StoneAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>StoneAxe</b>.'}));
                }
              } else if(item == 'ironaxe'){
                if(q <= Item.list[ch].inventory.ironaxe){
                  if(player.inventory.ironaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>IronAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.ironaxe -= q;
                    Player.list[id].inventory.ironaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>IronAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>IronAxe</b>.'}));
                }
              } else if(item == 'pickaxe'){
                if(q <= Item.list[ch].inventory.pickaxe){
                  if(player.inventory.pickaxe + q > 10){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PickAxe</b>.'}));
                  } else {
                    Item.list[ch].inventory.pickaxe -= q;
                    Player.list[id].inventory.pickaxe += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PickAxe</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PickAxe</b>.'}));
                }
              } else if(item == 'torch'){
                if(q <= Item.list[ch].inventory.torch){
                  if(player.inventory.torch + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Torch</b>.'}));
                  } else {
                    Item.list[ch].inventory.torch -= q;
                    Player.list[id].inventory.torch += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Torch</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Torch</b>.'}));
                }
              } else if(item == 'bread'){
                if(q <= Item.list[ch].inventory.bread){
                  if(player.inventory.bread + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Bread</b>.'}));
                  } else {
                    Item.list[ch].inventory.bread -= q;
                    Player.list[id].inventory.bread += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bread</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that much</i> <b>Bread</b>.'}));
                }
              } else if(item == 'fish'){
                if(q <= Item.list[ch].inventory.fish){
                  if(player.inventory.fish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Fish</b>.'}));
                  } else {
                    Item.list[ch].inventory.fish -= q;
                    Player.list[id].inventory.fish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Fish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Fish</b>.'}));
                }
              } else if(item == 'lamb'){
                if(q <= Item.list[ch].inventory.lamb){
                  if(player.inventory.lamb + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too much</i> <b>Lamb</b>.'}));
                  } else {
                    Item.list[ch].inventory.lamb -= q;
                    Player.list[id].inventory.lamb += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Lamb</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Lamb</b>.'}));
                }
              } else if(item == 'boarmeat'){
                if(q <= Item.list[ch].inventory.boarmeat){
                  if(player.inventory.boarmeat + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarMeat</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarmeat -= q;
                    Player.list[id].inventory.boarmeat += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarMeat</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarMeat</b>.'}));
                }
              } else if(item == 'venison'){
                if(q <= Item.list[ch].inventory.venison){
                  if(player.inventory.venison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Venison</b>.'}));
                  } else {
                    Item.list[ch].inventory.venison -= q;
                    Player.list[id].inventory.venison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Venison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Venison</b>.'}));
                }
              } else if(item == 'poachedfish'){
                if(q <= Item.list[ch].inventory.poachedfish){
                  if(player.inventory.poachedfish + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>PoachedFish</b>.'}));
                  } else {
                    Item.list[ch].inventory.poachedfish -= q;
                    Player.list[id].inventory.poachedfish += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>PoachedFish</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>PoachedFish</b>.'}));
                }
              } else if(item == 'lambchop'){
                if(q <= Item.list[ch].inventory.lambchop){
                  if(player.inventory.lambchop + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>LambChop</b>.'}));
                  } else {
                    Item.list[ch].inventory.lambchop -= q;
                    Player.list[id].inventory.lambchop += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>LambChop</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>LambChop</b>.'}));
                }
              } else if(item == 'boarshank'){
                if(q <= Item.list[ch].inventory.boarshank){
                  if(player.inventory.boarshank + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BoarShank</b>.'}));
                  } else {
                    Item.list[ch].inventory.boarshank -= q;
                    Player.list[id].inventory.boarshank += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BoarShank</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BoarShank</b>.'}));
                }
              } else if(item == 'venisonloin'){
                if(q <= Item.list[ch].inventory.venisonloin){
                  if(player.inventory.venisonloin + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>VenisonLoin</b>.'}));
                  } else {
                    Item.list[ch].inventory.venisonloin -= q;
                    Player.list[id].inventory.venisonloin += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>VenisonLoin</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>VenisonLoin</b>.'}));
                }
              } else if(item == 'mead'){
                if(q <= Item.list[ch].inventory.mead){
                  if(player.inventory.mead + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Mead</b>.'}));
                  } else {
                    Item.list[ch].inventory.mead -= q;
                    Player.list[id].inventory.mead += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Mead</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Mead</b>.'}));
                }
              } else if(item == 'saison'){
                if(q <= Item.list[ch].inventory.saison){
                  if(player.inventory.saison + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Saison</b>.'}));
                  } else {
                    Item.list[ch].inventory.saison -= q;
                    Player.list[id].inventory.saison += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Saison</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Saison</b>.'}));
                }
              } else if(item == 'flanders'){
                if(q <= Item.list[ch].inventory.flanders){
                  if(player.inventory.flanders + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Flanders</b>.'}));
                  } else {
                    Item.list[ch].inventory.flanders -= q;
                    Player.list[id].inventory.flanders += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Flanders</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Flanders</b>.'}));
                }
              } else if(item == 'bieredegarde'){
                if(q <= Item.list[ch].inventory.bieredegarde){
                  if(player.inventory.bieredegarde + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>BiereDeGarde</b>.'}));
                  } else {
                    Item.list[ch].inventory.bieredegarde -= q;
                    Player.list[id].inventory.bieredegarde += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>BiereDeGarde</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>BiereDeGarde</b>.'}));
                }
              } else if(item == 'bordeaux'){
                if(q <= Item.list[ch].inventory.bordeaux){
                  if(player.inventory.bordeaux + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bordeaux</b>.'}));
                  } else {
                    Item.list[ch].inventory.bordeaux -= q;
                    Player.list[id].inventory.bordeaux += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bordeaux</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bordeaux</b>.'}));
                }
              } else if(item == 'bourgogne'){
                if(q <= Item.list[ch].inventory.bourgogne){
                  if(player.inventory.bourgogne + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Bourgogne</b>.'}));
                  } else {
                    Item.list[ch].inventory.bourgogne -= q;
                    Player.list[id].inventory.bourgogne += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Bourgogne</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Bourgogne</b>.'}));
                }
              } else if(item == 'chianti'){
                if(q <= Item.list[ch].inventory.chianti){
                  if(player.inventory.chianti + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Chianti</b>.'}));
                  } else {
                    Item.list[ch].inventory.chianti -= q;
                    Player.list[id].inventory.chianti += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Chianti</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Chianti</b>.'}));
                }
              } else if(item == 'crown'){
                if(q <= Item.list[ch].inventory.crown){
                  if(player.inventory.crown + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Crown</b>.'}));
                  } else {
                    Item.list[ch].inventory.crown -= q;
                    Player.list[id].inventory.crown += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Crown</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Crown</b>.'}));
                }
              } else if(item == 'arrows'){
                if(q <= Item.list[ch].inventory.arrows){
                  if(player.inventory.arrows + q > 50){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>Arrows</b>.'}));
                  } else {
                    Item.list[ch].inventory.arrows -= q;
                    Player.list[id].inventory.arrows += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Arrows</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Arrows</b>.'}));
                }
              } else if(item == 'worldmap'){
                if(q <= Item.list[ch].inventory.worldmap){
                  if(player.inventory.worldmap + q > 25){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying too many</i> <b>WorldMap</b>.'}));
                  } else {
                    Item.list[ch].inventory.worldmap -= q;
                    Player.list[id].inventory.worldmap += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>WorldMap</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>WorldMap</b>.'}));
                }
              } else if(item == 'relic'){
                if(q <= Item.list[ch].inventory.relic){
                  if(player.inventory.relic + q > 1){
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You are already carrying a</i> <b>Relic</b>.'}));
                  } else {
                    Item.list[ch].inventory.relic -= q;
                    Player.list[id].inventory.relic += q;
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>You took</i> ' + q + ' <b>Relic</b> <i>from the chest.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>The chest does not contain that many</i> <b>Relic</b>.'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not a valid</i> <b>ItemName</b>.'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not have the key to this chest.</i>'}));
            }
          }
        }
      }
    } else if(data.cmd == 'train'){
      var permit = false;
      if(player.house){
        var gar = 0;
        var stb = 0;
        var str = 0;
        for(var i in Building.list){
          if(b.house == player.house){
            if(b.type == 'garrison'){
              gar++;
            } else if(b.type == 'stronghold'){
              str++;
            } else if(b.type == 'stable'){
              stb++;
            }
          }
        }
        if(gar > 0){
          if(player.rank == '♞ ' || player.rank == '♜ ' || player.rank == '♚ '){
            if(player.house.general){
              permit = true;
            } else {
              if(player.z == 1 || player.z == 2){
                var g = getBuilding(player.x,player.y);
                var garr = Building.list[g];
                if(garr.type == 'garrison' && garr.house == player.house){
                  permit = true;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You must be in a garrison.</i>'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You must be in a garrison.</i>'}));
              }
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot give this order.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no garrison.</i>'}));
        }
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You must establish a House.</i>'}));
      }
      if(permit){
        var all = '<b>Footsoldier</b>: /train <i>Quantity</i> footsoldier<br><b>3 iron, 2 grain</b>';
        if(str > 0){
          all += '<br><b>Cavalier</b>: /train <i>Quantity</i> skirmisher<br><b>5 iron, 3 grain</b>';
        }
        if(str > 0 && stb > 0){
          all += '<br><b>Cavalier</b>: /train <i>Quantity</i> cavalier<br><b>5 iron, 7 grain</b>';
        }
        socket.write(JSON.stringify({msg:'addToChat',message:'<p>'+all+'</p>'}));
      }
    } else if(data.cmd.slice(0,5) == 'train' && data.cmd[5] == ' '){
      var permit = false;
      if(player.house){
        var gar = [];
        var str = 0;
        var stb = 0;
        for(var i in Building.list){
          var b = Building.list[i];
          if(b.house == player.house){
            if(b.type == 'garrison'){
              gar.push(b.id);
            } else if(b.type == 'stronghold'){
              str++;
            } else if(b.type == 'stable'){
              stb++;
            }
          }
        }
        if(gar.length > 0){
          if(player.rank == '♞ ' || player.rank == '♜ ' || player.rank == '♚ '){
            if(player.house.general){
              permit = true;
            } else {
              if(player.z == 1 || player.z == 2){
                var g = getBuilding(player.x,player.y);
                var garr = Building.list[g];
                if(garr.type == 'garrison' && garr.house == player.house){
                  permit = true;
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You must be in a garrison.</i>'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You must be in a garrison.</i>'}));
              }
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot give this order.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no garrison.</i>'}));
        }
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You cannot give this order.</i>'}));
      }
      if(permit){
        if(data.cmd.slice(data.cmd.indexOf(' ')+1).toLowerCase() == 'footsoldier'){
          House.list[player.house].stores.iron -= 3 ;
          House.list[player.house].stores.grain -= 2;
          Building.list[gar[0]].queue.push('footsoldier');
          console.log('Footsoldier in training');
        } else if(data.cmd.slice(data.cmd.indexOf(' ')+1).toLowerCase() == 'skirmisher'){
          if(str > 0){
            House.list[player.house].stores.iron -= 5 ;
            House.list[player.house].stores.grain -= 3;
            Building.list[gar[0]].queue.push('skirmisher');
            console.log('Skirmisher in training');
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no stronghold.</i>'}));
          }
        } else if(data.cmd.slice(data.cmd.indexOf(' ')+1).toLowerCase() == 'cavalier'){
          if(stb > 0){
            if(str > 0){
              House.list[player.house].stores.iron -= 5 ;
              House.list[player.house].stores.grain -= 7;
              Building.list[gar[0]].queue.push('cavalier');
              console.log('Cavalier in training');
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no stronghold.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no stable.</i>'}));
          }
        } else {
          var order = data.cmd.slice(data.cmd.indexOf(' ')+1);
          var q = Number(order.slice(0,order.indexOf(' '))).toFixed(0);
          var unit = order.slice(order.indexOf(' ')+1).toLowerCase();
          if(q < 1){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>Quantity must be greater than 0.</i>'}));
          } else if(Number.isNaN(q/1)){
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>Quantity must be a number.</i>'}));
          } else {
            var counter = 0;
            if(unit == 'footsoldier'){
              var iCost = 3 * q;
              if(player.house.stores.iron > iCost){
                var gCost = 2 * q;
                if(player.house.stores.iron > gCost){
                  House.list[player.house].stores.iron -= 3 * q;
                  House.list[player.house].stores.grain -= 2 * q;
                  for(var i = 0; i < q; i++){
                    var id = gar[counter];
                    Building.list[id].queue.push('footsoldier');
                    console.log('Footsoldier in training');
                    counter++;
                    if(counter == gar.length){
                      counter = 0;
                    }
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not enough grain.</i>'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not enough iron.</i>'}));
              }
            } else if(unit == 'skirmisher'){
              if(str > 0){
                var iCost = 5 * q;
                if(player.house.stores.iron > iCost){
                  var gCost = 3 * q;
                  if(player.house.stores.iron > gCost){
                    House.list[player.house].stores.iron -= 5 * q;
                    House.list[player.house].stores.grain -= 3 * q;
                    for(var i = 0; i < q; i++){
                      var id = gar[counter];
                      Building.list[id].queue.push('skirmisher');
                      console.log('Skirmisher in training');
                      counter++;
                      if(counter == gar.length){
                        counter = 0;
                      }
                    }
                  } else {
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not enough grain.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not enough iron.</i>'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no stronghold.</i>'}));
              }
            } else if(unit == 'cavalier'){
              if(stb > 0){
                if(str > 0){
                  var iCost = 5 * q;
                  if(player.house.stores.iron > iCost){
                    var gCost = 7 * q;
                    if(player.house.stores.iron > gCost){
                      House.list[player.house].stores.iron -= 5 * q;
                      House.list[player.house].stores.grain -= 7 * q;
                      for(var i = 0; i < q; i++){
                        var id = gar[counter];
                        Building.list[id].queue.push('cavalier');
                        console.log('Cavalier in training');
                        counter++;
                        if(counter == gar.length){
                          counter = 0;
                        }
                      }
                    } else {
                      socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not enough grain.</i>'}));
                    }
                  } else {
                    socket.write(JSON.stringify({msg:'addToChat',message:'<i>Not enough iron.</i>'}));
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no stronghold.</i>'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>You have no stable.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Invalid unit.</i>'}));
            }
          }
        }
      }
    } else if(data.cmd == 'house'){
      if(player.house){
        // house report
      } else {
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>You do not belong to a House.</i>'}));
      }
    } else if(data.cmd.slice(0,5) == 'house' && data.cmd[5] == ' '){
      var b = getBuilding(player.x,player.y);
      if(b){
        var build = Building.list[b];
        if(build.type == 'garrison'){
          if(build.owner == data.id){
            if(player.z == 2){
              if(player.facing == 'up' && getItem(player.z,loc[0],loc[1]-1) == 'Desk'){
                var flagcheck = 0;
                for(var i in flags){
                  if(flags[i][1] == 0){
                    flagcheck++;
                  }
                }
                if(flagcheck > 0){
                  var house = data.cmd.slice(data.cmd.indexOf(' ')+1);
                  if(house.indexOf(' ') >= 0){
                    var name = house.slice(0,house.indexOf(' '));
                    var f = Number(house.slice(house.indexOf(' ')+1)).toFixed(0);
                    if(Number.isNaN(f/1) || f < 0 || f > 69){
                      socket.write(JSON.stringify({msg:'addToChat',message:'<i>Flag must be a number from 0 to 69.</i>'}));
                    } else {
                      var flag = flags[f];
                      if(flag[1] == 0){
                        for(var i in House.list){
                          var h = House.list[i];
                          if(h.name == name){
                            socket.write(JSON.stringify({msg:'addToChat',message:'<i>Name is taken.</i>'}));
                            return;
                          }
                          flags[f][1] = 1;
                          var hid = Math.random();
                          House({
                            id:hid,
                            type:'player',
                            name:name,
                            flag:flag[0],
                            hq:loc,
                            hostile:false
                          });
                          Player.list[data.id].house = hid;
                          convertHouse(data.id);
                          console.log(player.name + ' has established House ' + name + ', flag: ' + flag[0]);
                        }
                      } else {
                        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Flag is taken.</i>'}));
                      }
                    }
                  } else {
                    for(var i in House.list){
                      var h = House.list[i];
                      if(h.name == house){
                        socket.write(JSON.stringify({msg:'addToChat',message:'<i>Name is taken.</i>'}));
                        return;
                      }
                    }
                    var select = [];
                    var flag = null;
                    for(var f in flags){
                      var fl = flags[f];
                      if(fl[1] == 0){
                        select.push(fl[0]);
                      }
                    }
                    flag = select[Math.floor(Math.random() * select.length)];
                    for(var i in flags){
                      if(flags[i][0] == flag){
                        flags[i][1] = 1;
                      }
                    }
                    var hid = Math.random();
                    House({
                      id:hid,
                      type:'player',
                      name:house,
                      flag:flag,
                      hq:loc,
                      hostile:false
                    });
                    Player.list[data.id].house = hid;
                    convertHouse(data.id);
                    socket.write(JSON.stringify({
                      msg:'newFaction',
                      houseList:House.list,
                    }));
                    console.log(player.name + ' has established House ' + house);
                  }
                } else {
                  socket.write(JSON.stringify({msg:'addToChat',message:'<i>There are too many Houses.</i>'}));
                }
              } else {
                socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be at the desk.</i>'}));
              }
            } else {
              socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be at the desk upstairs.</i>'}));
            }
          } else {
            socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be at your own Garrison.</i>'}));
          }
        } else {
          socket.write(JSON.stringify({msg:'addToChat',message:'<i>Must be at a Garrison.</i>'}));
        }
      }
      // ALPHA HAX !!
    } else if(data.cmd.slice(0,data.cmd.indexOf(' ')) == 'tport'){
      var getZXY = data.cmd.slice(data.cmd.indexOf(' ')+1);
      var getZ = getZXY.slice(0,getZXY.indexOf(','));
      var getXY = getZXY.slice(getZXY.indexOf(',')+1);
      var getX = getXY.slice(0,getXY.indexOf(','));
      var getY = getXY.slice(getXY.indexOf(',')+1);
      var coords = getCenter(Number(getX),Number(getY))
      var z = Number(getZ);
      var x = coords[0];
      var y = coords[1];

      Player.list[data.id].z = z;
      Player.list[data.id].x = x;
      Player.list[data.id].y = y;
      // ALPHA HAX !!
    } else {
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>Invalid command.</i>'}));
    }
  }
}
