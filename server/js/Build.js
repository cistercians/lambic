Build = function(id){
  var p = Player.list[id];
  var loc = getLoc(p.x,p.y);
  Player.list[id].working = true;
  Player.list[id].building = true;
  Player.list[id].actionCooldown = 10;
  var b = getBuilding(p.x,p.y);
  setTimeout(function(){
    if(Player.list[id].working){
      tileChange(6,loc[0],loc[1],10,true); // ALPHA, default:1
      Player.list[id].working = false;
      Player.list[id].building = false;
      var count = 0;
      var plot = Building.list[b].plot;
      var walls = Building.list[b].walls;
      var top = Building.list[b].topPlot;
      if(getTile(6,loc[0],loc[1]) >= Building.list[b].req){
        if(getTile(0,loc[0],loc[1]) == 11){
          tileChange(0,loc[0],loc[1],12);
        } else if(getTile(0,loc[0],loc[1]) == 11.5){
          tileChange(0,loc[0],loc[1],12.5);
        }
        mapEdit();
      }
      for(var i in plot){
        if(getTile(6,plot[i][0],plot[i][1]) >= Building.list[b].req){
          count++;
        } else {
          continue;
        }
      }
      if(count == plot.length){
        Building.list[b].built = true;
        if(Building.list[b].type == 'hut'){
          for(var i in plot){
            matrixChange(0,plot[i][0],plot[i][1],1);
            matrixChange(1,plot[i][0],plot[i][1],0);
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('hut' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'hut1'){
              tileChange(0,plot[i][0],plot[i][1],14);
              matrixChange(0,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            }
          }
          for(var i in walls){
            var n = walls[i];
            tileChange(4,n[0],n[1],1);
          }
          var fp = getCoords(walls[1][0],walls[1][1]);
          Fireplace({
            x:fp[0],
            y:fp[1],
            z:1,
            qty:1,
            parent:b
          });
        } else if(Building.list[b].type == 'mill'){
          for(var i in plot){
            tileChange(0,plot[i][0],plot[i][1],13);
            tileChange(3,plot[i][0],plot[i][1],String('mill' + i));
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          tileChange(5,top[0][0],top[0][1],'mill4');
          tileChange(5,top[1][0],top[1][1],'mill5');
        } else if(Building.list[b].type == 'cottage'){
          for(var i in plot){
            matrixChange(0,plot[i][0],plot[i][1],1);
            matrixChange(1,plot[i][0],plot[i][1],0);
            tileChange(0,plot[i][0],plot[i][1],15);
            tileChange(3,plot[i][0],plot[i][1],String('cottage' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'cottage1'){
              matrixChange(0,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],19);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            }
          }
          for(var i in walls){
            var n = walls[i];
            tileChange(4,n[0],n[1],2);
          }
          var fp = getCoords(walls[1][0],walls[1][1]);
          Fireplace({
            x:fp[0],
            y:fp[1],
            z:1,
            qty:1,
            parent:b
          });
          Player.list[Building.list[b].owner].keys.push(b);
        } else if(Building.list[b].type == 'fort'){
          matrixChange(0,plot[0][0],plot[0][1],1);
          tileChange(0,plot[0][0],plot[0][1],13);
          tileChange(3,plot[0][0],plot[0][1],'fort');
        } else if(Building.list[b].type == 'wall'){
          matrixChange(0,plot[0][0],plot[0][1],1);
          tileChange(0,plot[0][0],plot[0][1],15);
          tileChange(3,plot[0][0],plot[0][1],'wall');
        } else if(Building.list[b].type == 'outpost'){
          matrixChange(0,plot[0][0],plot[0][1],1);
          tileChange(0,plot[0][0],plot[0][1],13);
          tileChange(3,plot[0][0],plot[0][1],'outpost0');
          tileChange(5,top[0][0],top[0][1],'outpost1');
        } else if(Building.list[b].type == 'guardtower'){
          for(var i in plot){
            matrixChange(0,plot[i][0],plot[i][1],1);
            tileChange(0,plot[i][0],plot[i][1],15);
            tileChange(3,plot[i][0],plot[i][1],String('gtower' + i));
          }
          tileChange(5,top[0][0],top[0][1],'gtower4');
          tileChange(5,top[1][0],top[1][1],'gtower5');
          var fp = getCoords(plot[1][0],plot[1][1]);
          Firepit({
            x:fp[0],
            y:fp[1],
            z:0,
            qty:1,
            parent:b
          })
        } else if(Building.list[b].type == 'tower'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('tower' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'tower0'){
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],19);
              tileChange(5,plot[i][0],plot[i][1],15);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
              tileChange(5,plot[i][0],plot[i][1],15);
            }
          }
          var ii = 9;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('tower' + ii));
            tileChange(4,n[0],n[1],2);
            if(getTile(5,n[0],n[1],'tower10') == 'tower10'){
              tileChange(4,n[0],n[1],4);
              matrixChange(1,n[0],n[1],0);
              matrixChange(2,n[0],n[1],0);
              Building.list[b].ustairs = [n[0],n[1]];
            } else if(getTile(5,n[0],n[1]) == 'tower12' ||
            getTile(5,n[0],n[1]) == 'tower13' ||
            getTile(5,n[0],n[1]) == 'tower14'){
              tileChange(4,n[0],n[1],0);
            }
            ii++;
          }
          var fp = getCoords(walls[2][0],walls[2][1]);
          Fireplace({
            x:fp[0],
            y:fp[1],
            z:1,
            qty:1,
            parent:b
          });
          Player.list[Building.list[b].owner].keys.push(b);
        } else if(Building.list[b].type == 'tavern'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('tavern' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'tavern1'){
              matrixChange(0,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],14);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            } else if(getTile(3,plot[i][0],plot[i][1]) == 'tavern0' ||
            getTile(3,plot[i][0],plot[i][1]) == 'tavern2'){
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],13);
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              matrixChange(-2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],13);
              tileChange(5,plot[i][0],plot[i][1],13);
              tileChange(8,plot[i][0],plot[i][1],1);
            }
          }
          var ii = 17;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('tavern' + ii));
            ii++;
          }
          for(var i in walls){
            var n = walls[i];
            tileChange(4,n[0],n[1],1);
          }
          tileChange(4,walls[0][0],walls[0][1],5);
          matrixChange(1,walls[0][0],walls[0][1],0);
          tileChange(8,walls[0][0],walls[0][1],5);
          matrixChange(-2,walls[0][0],walls[0][1],0);
          Building.list[b].dstairs = [walls[0][0],walls[0][1]];
          tileChange(4,walls[4][0],walls[4][1],3);
          matrixChange(1,walls[4][0],walls[4][1],0);
          matrixChange(2,walls[4][0],walls[4][1],0);
          Building.list[b].ustairs = [walls[4][0],walls[4][1]];
          var fp = getCoords(walls[2][0],walls[2][1]);
          var sh1 = getCoords(walls[1][0],walls[1][1]);
          var sh2 = getCoords(walls[3][0],walls[3][1]);
          var b1 = getCoords(plot[0][0],plot[0][1]);
          var b2 = getCoords(plot[2][0],plot[2][1]);
          var b3 = getCoords(plot[3][0],plot[3][1]);
          var b4 = getCoords(plot[7][0],plot[7][1]);
          var b5 = getCoords(plot[8][0],plot[8][1]);
          var bd = getCoords(walls[0][0],walls[0][1]);
          var ch = getCoords(plot[16][0],plot[16][1]);
          var wt = getCoords(walls[1][0],walls[1][1])
          var b6 = getCoords(plot[4][0],plot[4][1]);
          var cr = getCoords(plot[5][0],plot[5][1]);
          var b7 = getCoords(plot[6][0],plot[6][1]);
          var b8 = getCoords(plot[12][0],plot[12][1]);
          var sp1 = getCenter(plot[16][0],plot[16][1]);
          Fireplace({
            x:fp[0],
            y:fp[1],
            z:1,
            qty:1,
            parent:b
          });
          StagHead({
            x:sh1[0],
            y:sh1[1],
            z:1,
            qty:1,
            parent:b
          });
          StagHead({
            x:sh2[0],
            y:sh2[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:b1[0],
            y:b1[1],
            z:0,
            qty:1,
            parent:b
          });
          Barrel({
            x:b1[0],
            y:b1[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:b2[0],
            y:b2[1],
            z:0,
            qty:1,
            parent:b
          });
          Barrel({
            x:b2[0],
            y:b2[1],
            z:1,
            qty:1,
            parent:b
          });
          Barrel({
            x:b3[0],
            y:b3[1],
            z:1,
            qty:1,
            parent:b
          });
          Barrel({
            x:b4[0],
            y:b4[1],
            z:1,
            qty:1,
            parent:b
          });
          Barrel({
            x:b5[0],
            y:b5[1],
            z:1,
            qty:1,
            parent:b
          });
          Bed({
            x:bd[0],
            y:bd[1],
            z:2,
            qty:1,
            parent:b
          });
          Fireplace({
            x:fp[0],
            y:fp[1],
            z:2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b3[0],
            y:b3[1],
            z:2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b4[0],
            y:b4[1],
            z:2,
            qty:1,
            parent:b
          });
          Chest({
            x:ch[0],
            y:ch[1],
            z:2,
            qty:1,
            parent:b
          });
          WallTorch({
            x:wt[0],
            y:wt[1],
            z:-2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b3[0],
            y:b3[1],
            z:-2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b6[0],
            y:b6[1],
            z:-2,
            qty:1,
            parent:b
          });
          Crates({
            x:cr[0],
            y:cr[1],
            z:-2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b7[0],
            y:b7[1],
            z:-2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b4[0],
            y:b4[1],
            z:-2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b5[0],
            y:b5[1],
            z:-2,
            qty:1,
            parent:b
          });
          Barrel({
            x:b8[0],
            y:b8[1],
            z:-2,
            qty:1,
            parent:b
          });
          Innkeeper({
            x:sp1[0],
            y:sp1[1],
            z:1,
            name:'Innkeeper ' + randomName('m'),
            house:Building.list[b].house,
            kingdom:Building.list[b].kingdom,
            home:{
              z:1,
              loc:[plot[16][0],plot[16][1]]
            }
          });
        } else if(Building.list[b].type == 'monastery'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('monastery' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'monastery0'){
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],16);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            } else if(getTile(3,plot[i][0],plot[i][1]) == 'monastery1' ||
            getTile(3,plot[i][0],plot[i][1]) == 'monastery2' ||
            getTile(3,plot[i][0],plot[i][1]) == 'monastery3' ||
            getTile(3,plot[i][0],plot[i][1]) == 'monastery4' ||
            getTile(3,plot[i][0],plot[i][1]) == 'monastery5' ||
            getTile(3,plot[i][0],plot[i][1]) == 'monastery6' ||
            getTile(3,plot[i][0],plot[i][1]) == 'monastery7'){
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
              tileChange(5,plot[i][0],plot[i][1],15);
            }
          }
          var ii = 14;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('monastery' + ii));
            ii++;
          }
          for(var i in walls){
            var n = walls[i];
            tileChange(4,n[0],n[1],2);
          }
          tileChange(4,walls[1][0],walls[1][1],4);
          matrixChange(1,walls[1][0],walls[1][1],0);
          matrixChange(2,walls[1][0],walls[1][1],0);
          Building.list[b].ustairs = [walls[1][0],walls[1][1]];
          var wt = getCoords(walls[0][0],walls[0][1]);
          var cr = getCoords(walls[2][0],walls[2][1]);
          var bs = getCoords(walls[3][0],walls[3][1]);
          var sp1 = getCenter(plot[13][0],plot[13][1]);
          var sp2 = getCenter(plot[8][0],plot[8][1]);
          var sp3 = getCenter(plot[10][0],plot[10][1]);
          WallTorch({
            x:wt[0],
            y:wt[1],
            z:1,
            qty:1,
            parent:b
          });
          Cross({
            x:cr[0],
            y:cr[1],
            z:1,
            qty:1,
            parent:b
          });
          Bookshelf({
            x:cr[0],
            y:cr[1],
            z:2,
            qty:1,
            parent:b
          });
          Bookshelf({
            x:bs[0],
            y:bs[1],
            z:2,
            qty:1,
            parent:b
          });
          Bishop({
            x:sp1[0],
            y:sp1[1],
            z:1,
            name:'Father ' + randomName(),
            house:Building.list[b].house,
            kingdom:Building.list[b].kingdom,
            home:{
              z:1,
              loc:[plot[13][0],plot[13][1]]
            }
          });
          Monk({
            x:sp2[0],
            y:sp2[1],
            z:1,
            name:'Brother ' + randomName(),
            house:Building.list[b].house,
            kingdom:Building.list[b].kingdom,
            home:{
              z:1,
              loc:[plot[8][0],plot[8][1]]
            }
          });
          Monk({
            x:sp3[0],
            y:sp3[1],
            z:1,
            name:'Brother ' + randomName(),
            house:Building.list[b].house,
            kingdom:Building.list[b].kingdom,
            home:{
              z:1,
              loc:[plot[10][0],plot[10][1]]
            }
          });
        } else if(Building.list[b].type == 'market'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('market' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'market0' ||
            getTile(3,plot[i][0],plot[i][1]) == 'market1' ||
            getTile(3,plot[i][0],plot[i][1]) == 'market2'){
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],14);
              if(getTile(3,plot[i][0],plot[i][1]) == 'market1'){
                Building.list[b].entrance = [plot[i][0],plot[i][1]];
              }
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],13);
              tileChange(5,plot[i][0],plot[i][1],13);
            }
          }
          var ii = 12;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('market' + ii));
            ii++;
          }
          for(var i in walls){
            var n = walls[i];
            if(getTile(5,n[0],n[1]) == 'market12'){
              tileChange(4,n[0],n[1],3);
              matrixChange(1,n[0],n[1],0);
              matrixChange(2,n[0],n[1],0);
              Building.list[b].ustairs = [n[0],n[1]];
            } else {
              tileChange(4,n[0],n[1],1);
            }
          }
          var g1 = getCoords(walls[1][0],walls[1][1]);
          var g2 = getCoords(walls[2][0],walls[2][1]);
          var g3 = getCoords(walls[3][0],walls[3][1]);
          var g4 = getCoords(walls[4][0],walls[4][1]);
          var fp1 = getCoords(plot[3][0],plot[3][1]+1);
          var fp2 = getCoords(plot[7][0],plot[7][1]+1);
          var cr1 = getCoords(plot[8][0],plot[8][1]);
          var d1 = getCoords(plot[9][0],plot[9][1]);
          var d2 = getCoords(plot[10][0],plot[10][1]);
          var cr2 = getCoords(plot[11][0],plot[11][1]);
          WallTorch({
            x:g1[0],
            y:g1[1],
            z:1,
            qty:1,
            parent:b
          });
          Goods1({
            x:g1[0],
            y:g1[1],
            z:1,
            qty:1,
            parent:b
          });
          Goods2({
            x:g2[0],
            y:g2[1],
            z:1,
            qty:1,
            parent:b
          });
          Goods3({
            x:g3[0],
            y:g3[1],
            z:1,
            qty:1,
            parent:b
          });
          WallTorch({
            x:g4[0],
            y:g4[1],
            z:1,
            qty:1,
            parent:b
          });
          Goods4({
            x:g4[0],
            y:g4[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp1[0],
            y:fp1[1],
            z:0,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp2[0],
            y:fp2[1],
            z:0,
            qty:1,
            parent:b
          });
          WallTorch({
            x:g1[0],
            y:g1[1],
            z:2,
            qty:1,
            parent:b
          });
          Stash1({
            x:g2[0],
            y:g2[1],
            z:2,
            qty:1,
            parent:b
          });
          Stash2({
            x:g3[0],
            y:g3[1],
            z:2,
            qty:1,
            parent:b
          });
          WallTorch({
            x:g4[0],
            y:g4[1],
            z:2,
            qty:1,
            parent:b
          });
          Crates({
            x:cr1[0],
            y:cr1[1],
            z:2,
            qty:1,
            parent:b
          });
          Desk({
            x:d1[0],
            y:d1[1],
            z:2,
            qty:1,
            parent:b
          });
          Desk({
            x:d2[0],
            y:d2[1],
            z:2,
            qty:1,
            parent:b
          });
          Crates({
            x:cr2[0],
            y:cr2[1],
            z:2,
            qty:1,
            parent:b
          });
        } else if(Building.list[b].type == 'stable'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('stable' + i));
            tileChange(0,plot[i][0],plot[i][1],13);
            matrixChange(0,plot[i][0],plot[i][1],1);
          }
          var ii = 12;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('stable' + ii));
            ii++;
          }
          var wt = getCoords(plot[1][0],plot[1][1]);
          WallTorch({
            x:wt[0],
            y:wt[1],
            z:0,
            qty:1,
            parent:b
          });
        } else if(Building.list[b].type == 'dock'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('dock' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'dock4'){
              tileChange(0,plot[i][0],plot[i][1],13);
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(-3,plot[i][0],plot[i][1],1);
              matrixChange(3,plot[i][0],plot[i][1],1);
            } else {
              if(getTile(0,plot[i][0],plot[i][1]) == 12.5){
                tileChange(0,plot[i][0],plot[i][1],20.5);
              } else {
                tileChange(0,plot[i][0],plot[i][1],20);
              }
              matrixChange(0,plot[i][0],plot[i][1],0);
              matrixChange(3,plot[i][0],plot[i][1],1);
            }
          }
          var ii = 6;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('dock' + ii));
            ii++;
          }
          var wt = getCoords(plot[4][0],plot[4][1]);
          var sp = getCenter(plot[1][0],plot[1][1]);
          WallTorch({
            x:wt[0],
            y:wt[1],
            z:0,
            qty:1,
            parent:b
          });
          Shipwright({
            x:sp[0],
            y:sp[1],
            z:0,
            name:'Shipwright ' + randomName('m'),
            house:Building.list[b].house,
            kingdom:Building.list[b].kingdom,
            home:{
              z:0,
              loc:[plot[1][0],plot[1][1]]
            }
          });
        } else if(Building.list[b].type == 'garrison'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('garrison' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'garrison0'){
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],16);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            } else if(getTile(3,plot[i][0],plot[i][1]) == 'garrison1' ||
            getTile(3,plot[i][0],plot[i][1]) == 'garrison2' ||
            getTile(3,plot[i][0],plot[i][1]) == 'garrison3'){
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
              tileChange(5,plot[i][0],plot[i][1],15);
            }
          }
          var ii = 12;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('garrison' + ii));
            ii++;
          }
          for(var i in walls){
            var n = walls[i];
            if(getTile(5,n[0],n[1]) == 'garrison12'){
              tileChange(4,n[0],n[1],4);
              matrixChange(1,n[0],n[1],0);
              matrixChange(2,n[0],n[1],0);
              Building.list[b].ustairs = [n[0],n[1]];
            } else {
              tileChange(4,n[0],n[1],2);
            }
          }
          var sa = getCoords(walls[0][0],walls[0][1]);
          var sr1 = getCoords(walls[2][0],walls[2][1]);
          var sr2 = getCoords(walls[3][0],walls[3][1]);
          var fp = getCoords(plot[1][0],plot[1][1]);
          var d1 = getCoords(plot[2][0],plot[2][1]);
          var d2 = getCoords(plot[3][0],plot[3][1]);
          var d3 = getCoords(plot[6][0],plot[6][1]);
          var d4 = getCoords(plot[7][0],plot[7][1]);
          var dk = getCoords(plot[8][0],plot[8][1]);
          SuitArmor({
            x:sa[0],
            y:sa[1],
            z:1,
            qty:1,
            parent:b
          });
          Swordrack({
            x:sr1[0],
            y:sr1[1],
            z:1,
            qty:1,
            parent:b
          });
          Swordrack({
            x:sr2[0],
            y:sr2[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp[0],
            y:fp[1],
            z:0,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp[0],
            y:fp[1],
            z:1,
            qty:1,
            parent:b
          });
          Dummy({
            x:d1[0],
            y:d1[1],
            z:1,
            qty:1,
            parent:b
          });
          Dummy({
            x:d2[0],
            y:d2[1],
            z:1,
            qty:1,
            parent:b
          });
          WallTorch({
            x:sa[0],
            y:sa[1],
            z:2,
            qty:1,
            parent:b
          });
          Swordrack({
            x:sr1[0],
            y:sr1[1],
            z:2,
            qty:1,
            parent:b
          });
          Swordrack({
            x:sr2[0],
            y:sr2[1],
            z:2,
            qty:1,
            parent:b
          });
          Dummy({
            x:d3[0],
            y:d3[1],
            z:2,
            qty:1,
            parent:b
          });
          Dummy({
            x:d4[0],
            y:d4[1],
            z:2,
            qty:1,
            parent:b
          });
          Desk({
            x:dk[0],
            y:dk[1],
            z:2,
            qty:1,
            parent:b
          });
        } else if(Building.list[b].type == 'blacksmith'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('bsmith' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'bsmith1'){
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],14);
              Building.list[b].entrance = [plot[i][0],plot[i][1]];
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],13);
            }
          }
          var ii = 5;
          for(var i in walls){
            var n = walls[i];
            tileChange(5,n[0],n[1],String('bsmith' + ii));
            if(getTile(5,n[0],n[1]) == 'bsmith5'){
              tileChange(5,n[0],n[1],0);
              tileChange(4,n[0],n[1],1);
            } else {
              tileChange(4,n[0],n[1],1);
            }
            ii++;
          }
          var fg = getCoords(walls[1][0],walls[1][1]);
          var fp = getCoords(plot[0][0],plot[0][1]);
          var br = getCoords(plot[3][0],plot[3][1]);
          var anv = getCoords(plot[5][0],plot[5][1]);
          Forge({
            x:fg[0],
            y:fg[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp[0],
            y:fp[1],
            z:0,
            qty:1,
            parent:b
          });
          Barrel({
            x:br[0],
            y:br[1],
            z:1,
            qty:1,
            parent:b
          });
          Anvil({
            x:anv[0],
            y:anv[1],
            z:1,
            qty:1,
            parent:b
          });
        } else if(Building.list[b].type == 'stronghold'){
          for(var i in plot){
            tileChange(3,plot[i][0],plot[i][1],String('stronghold' + i));
            if(getTile(3,plot[i][0],plot[i][1]) == 'stronghold1' || getTile(3,plot[i][0],plot[i][1]) == 'stronghold2'){
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(1,plot[i][0],plot[i][1]+1,0);
              tileChange(0,plot[i][0],plot[i][1],16);
              if(getTile(3,plot[i][0],plot[i][1]) == 'stronghold1'){
                Building.list[b].entrance = [plot[i][0],plot[i][1]];
              }
            } else if(getTile(3,plot[i][0],plot[i][1]) == 'stronghold0' || getTile(3,plot[i][0],plot[i][1]) == 'stronghold3'){
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
            } else if(getTile(3,plot[i][0],plot[i][1]) == 'stronghold7' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold8' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold15' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold16' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold23' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold24' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold31' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold32' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold39' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold40' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold46' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold47' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold53' ||
            getTile(3,plot[i][0],plot[i][1]) == 'stronghold54'){
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              matrixChange(-2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],17);
              tileChange(5,plot[i][0],plot[i][1],15);
              tileChange(8,plot[i][0],plot[i][1],1);
            } else {
              matrixChange(0,plot[i][0],plot[i][1],1);
              matrixChange(1,plot[i][0],plot[i][1],0);
              matrixChange(2,plot[i][0],plot[i][1],0);
              matrixChange(-2,plot[i][0],plot[i][1],0);
              tileChange(0,plot[i][0],plot[i][1],15);
              tileChange(5,plot[i][0],plot[i][1],15);
              tileChange(8,plot[i][0],plot[i][1],1);
            }
          }
          var ii = 58;
          for(var i in top){
            var n = top[i];
            tileChange(5,n[0],n[1],String('stronghold' + ii));
            ii++;
          }
          for(var i in walls){
            var n = walls[i];
            if(getTile(5,n[0],n[1]) == 'stronghold58' ||
            getTile(5,n[0],n[1]) == 'stronghold62'){
              tileChange(4,n[0],n[1],7);
              matrixChange(1,n[0],n[1],0);
              matrixChange(2,n[0],n[1],0);
              if(getTile(5,n[0],n[1]) == 'stronghold58'){
                Building.list[b].ustairs = [n[0],n[1]];
              }
            } else {
              tileChange(4,n[0],n[1],2);
            }
          }
          matrixChange(1,walls[0][0],walls[0][1],0);
          matrixChange(-2,walls[0][0],walls[0][1],0);
          tileChange(4,walls[0][0],walls[0][1],6);
          tileChange(8,walls[0][0],walls[0][1],5);
          Building.list[b].dstairs = [walls[0][0],walls[0][1]];
          var sa1 = getCoords(walls[2][0],walls[2][1]);
          var thr = getCoords(walls[3][0],walls[3][1]);
          var b2 = getCoords(walls[4][0],walls[4][1]);
          var sa2 = getCoords(walls[5][0],walls[5][1]);
          var sr = getCoords(walls[7][0],walls[7][1]);
          var fp1 = getCoords(plot[0][0],plot[0][1]);
          var fp2 = getCoords(plot[3][0],plot[3][1]);
          var fp3 = getCoords(plot[22][0],plot[22][1]);
          var fp4 = getCoords(plot[25][0],plot[25][1]);
          var fp5 = getCoords(plot[45][0],plot[45][1]);
          var fp6 = getCoords(plot[48][0],plot[48][1]);
          var ch2 = getCoords(walls[4][0],walls[4][1]);
          var ch3 = getCoords(walls[6][0],walls[6][1]);
          var fp7 = getCoords(plot[24][0],plot[24][1]);
          var j1 = getCoords(plot[44][0],plot[44][1]);
          var j3 = getCoords(plot[46][0],plot[46][1]);
          var j4 = getCoords(plot[47][0],plot[47][1]);
          var j6 = getCoords(plot[49][0],plot[49][1]);
          var j7 = getCoords(plot[50][0],plot[50][1]);
          SuitArmor({
            x:sa1[0],
            y:sa1[1],
            z:1,
            qty:1,
            parent:b
          });
          Banner({
            x:thr[0],
            y:thr[1],
            z:1,
            qty:1,
            parent:b
          });
          Banner({
            x:b2[0],
            y:b2[1],
            z:1,
            qty:1,
            parent:b
          });
          Throne({
            x:thr[0],
            y:thr[1],
            z:1,
            qty:1,
            parent:b
          });
          SuitArmor({
            x:sa2[0],
            y:sa2[1],
            z:1,
            qty:1,
            parent:b
          });
          Swordrack({
            x:sr[0],
            y:sr[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp1[0],
            y:fp1[1],
            z:0,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp1[0],
            y:fp1[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp2[0],
            y:fp2[1],
            z:0,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp2[0],
            y:fp2[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp3[0],
            y:fp3[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp4[0],
            y:fp4[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp5[0],
            y:fp5[1],
            z:1,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp6[0],
            y:fp6[1],
            z:1,
            qty:1,
            parent:b
          });
          WallTorch({
            x:sa1[0],
            y:sa1[1],
            z:2,
            qty:1,
            parent:b
          });
          Bed({
            x:thr[0],
            y:thr[1],
            z:2,
            qty:1,
            parent:b
          });
          WallTorch({
            x:sa2[0],
            y:sa2[1],
            z:2,
            qty:1,
            parent:b
          });
          Chains({
            x:sa1[0],
            y:sa1[1],
            z:-2,
            qty:1,
            parent:b
          });
          Chains({
            x:ch2[0],
            y:ch2[1],
            z:-2,
            qty:1,
            parent:b
          });
          Chains({
            x:ch3[0],
            y:ch3[1],
            z:-2,
            qty:1,
            parent:b
          });
          Jail({
            x:j1[0],
            y:j1[1],
            z:-2,
            qty:1,
            parent:b
          });
          Jail({
            x:fp5[0],
            y:fp5[1],
            z:-2,
            qty:1,
            parent:b
          });
          Jail({
            x:j3[0],
            y:j3[1],
            z:-2,
            qty:1,
            parent:b
          });
          WallTorch({
            x:j3[0],
            y:j3[1],
            z:-2,
            qty:1,
            parent:b
          });
          JailDoor({
            x:j4[0],
            y:j4[1],
            z:-2,
            qty:1,
            parent:b
          });
          Jail({
            x:fp6[0],
            y:fp6[1],
            z:-2,
            qty:1,
            parent:b
          });
          WallTorch({
            x:fp6[0],
            y:fp6[1],
            z:-2,
            qty:1,
            parent:b
          });
          Jail({
            x:j6[0],
            y:j6[1],
            z:-2,
            qty:1,
            parent:b
          });
          Jail({
            x:j7[0],
            y:j7[1],
            z:-2,
            qty:1,
            parent:b
          });
          Firepit({
            x:fp7[0],
            y:fp7[1],
            z:-2,
            qty:1,
            parent:b
          });
        }
        mapEdit();
      }
    }
  },10000/p.strength);
}
