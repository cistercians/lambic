House = function(param){
  var self = Entity(param);
  self.type = param.type;
  self.name = param.name;
  self.flag = param.flag;
  self.hq = param.hq;
  self.leader = param.leader;
  self.kingdom = param.kingdom;
  self.hostile = param.hostile; // true = attacks neutral players/units
  self.underAttack = false;
  self.allies = [];
  self.enemies = [];

  self.spawnRate = 3600000/period;
  self.respawn = function(cl,spawn){ // 0:pawn, 1:knight/bishop, 2:rook, 3:king/queen
    if(self.spawn){
      var rand = Math.floor(Math.random() * spawnRate);
      setTimeout(function(){
        self.spawn(cl,spawn);
      },rand)
    }
  }
  self.chapter = 0;

  self.stores = {
    grain:0,
    wood:0,
    stone:0,
    ironore:0,
    iron:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0
  }

  self.military = {
    territory:[],
    patrol:[],
    alarm:null,
    campaign:{
      rally:null
    }
  }

  self.update = function(){

  }

  House.list[self.id] = self;

  io.emit('newFaction',{
    houseList:House.list,
    kingdomList:Kingdom.list
  })
  return self;
}

House.list = {};

House.update = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.update){
      house.update();
    }
  }
}

// BROTHERHOOD
Brotherhood = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Brother'){
      Brother({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Oathkeeper'){
      Oathkeeper({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,4);
    for(var i in area){
      var t = area[i];
      if(isWalkable(-1,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:-1,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 3; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      Brother({
        x:c[0],
        y:c[1],
        z:-1,
        house:self.id,
        home:{
          z:-1,
          loc:select
        }
      })
    }
    console.log('Brotherhood: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
    // check for next chapter conditions
  }
  self.init();
}

// GOTHS
Goths = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    var area = getArea(loc,self.hq,5);
    var select = [];
    var wselect = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var perim = [[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c-1,r],[c+2,r],[c-1,r+1],[c+2,r+1],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2]];
      var walls = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if((p >= 3 && p < 4) || p == 7){
          count++;
        }
      }
      var ex = perim[2];
      if(count == 4 && getTile(0,ex[0],ex[1]) != 0){
        count = 0;
        for(var n in perim){
          var m = getTile(0,perim[n][0],perim[n][1]);
          var tm = getTile(5,perim[n][0],perim[n][1]);
          if(m != 11 &&
          m != 11.5 &&
          m != 12 &&
          m != 12.5 &&
          m != 13 &&
          m != 14 &&
          m != 15 &&
          m != 16 &&
          m != 17 &&
          m != 19 &&
          m != 20 &&
          m != 20.5 &&
          (tm == 0 || tm == 'dock6' || tm == 'dock7' || tm == 'dock8')){
            count++;
          }
        }
        if(count == 12){
          select.push(plot);
          wselect.push(walls);
        }
      }
    }
    if(select.length > 0){
      var rand = Math.floor(Math.random() * select.length);
      var plot = select[rand];
      var walls = wselect[rand];
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'gothhut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(self.hq,self.hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      if(s1 > 0.4){
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(s2 > 0.6){
        SerfM({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(building.type == 'mill'){
        Building.list[b].serfs[s1] = s1;
        Building.list[b].serfs[s2] = s2;
      } else {
        if(Player.list[s1].sex == 'm'){
          Building.list[b].serfs[s1] = s1;
        }
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
        }
      }
      console.log('Serfs have spawned for Goths: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Goth'){
      Goth({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Acolyte'){
      Acolyte({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Cataphract'){
      Cataphract({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.618){
        Goth({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else {
        Acolyte({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    area = getArea(grid[0],grid[grid.length-1],5);
    var plots = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if(p >= 3 && p < 4){
          count++;
        }
      }
      if(count == 4){
        plots.push(plot)
      }
    }
    var m1 = null;
    var m2 = null;
    if(plots.length > 0){
      var rand = Math.floor(Math.random() * plots.length);
      m1 = plots[rand];
      var m1top = [[m1[2][0],m1[2][1]-1],[m1[3][0],m1[3][1]-1]];
      var m1c = getCenter(m1[0][0],m1[0][1]);
      plots.splice(rand,1);
      for(var i in m1){
        var n = m1[i];
        tileChange(0,n[0],n[1],13);
        tileChange(3,n[0],n[1],String('mill' + i));
        matrixChange(0,n[0],n[1],1);
      }
      tileChange(5,m1top[0][0],m1top[0][1],'mill4');
      tileChange(5,m1top[1][0],m1top[1][1],'mill5');
      Mill({
        house:self.id,
        x:m1c[0],
        y:m1c[1],
        z:0,
        type:'mill',
        built:true,
        plot:m1,
        topPlot:m1top,
        mats:{
          wood:40,
          stone:0
        },
        req:5,
        hp:150
      });
      area = getArea(m1[0],m1[3],4);
      for(var i in area){
        var f = area[i];
        var fc = f[0];
        var fr = f[1];
        var fp = [f,[fc+1,fr],[fc+2,fr],[fc,fr+1],[fc+1,fr+1],[fc+2,fr+1],[fc,fr+2],[fc+1,fr+2],[fc+2,fr+2]];
        var count = 0;
        for(var p in fp){
          var t = getTile(0,fp[p][0],fp[p][1]);
          if(!isWalkable(0,fp[p][0],fp[p][1]) || t == 8){
            break;
          } else {
            if(t >= 3 && t < 4){
              count++;
            }
          }
        }
        if(count >= 7){
          for(var p in fp){
            var n = fp[p];
            tileChange(0,n[0],n[1],8);
            tileChange(6,n[0],n[1],0);
          }
          var center = getCenter(fp[4][0],fp[4][1]);
          Farm({
            house:self.id,
            x:center[0],
            y:center[1],
            z:0,
            type:'farm',
            built:true,
            plot:fp
          });
        }
      }
      if(plots.length > 0){
        var best = 0;
        for(var i in plots){
          var p = plots[i];
          var cen = getCenter(p[0][0],p[0][1]);
          var dist = getDistance({x:m1c[0],y:m1c[1]},{x:cen[0],y:cen[1]});
          if(dist > best){
            best = i;
          }
        }
        m2 = plots[best];
        var m2top = [[m2[2][0],m2[2][1]-1],[m2[3][0],m2[3][1]-1]];
        var m2c = getCenter(m2[0][0],m2[0][1]);
        for(var i in m2){
          var n = m2[i];
          tileChange(0,n[0],n[1],13);
          tileChange(3,n[0],n[1],String('mill' + i));
          matrixChange(0,n[0],n[1],1);
        }
        tileChange(5,m2top[0][0],m2top[0][1],'mill4');
        tileChange(5,m2top[1][0],m2top[1][1],'mill5');
        Mill({
          house:self.id,
          x:m2c[0],
          y:m2c[1],
          z:0,
          type:'mill',
          built:true,
          plot:m2,
          topPlot:m2top,
          mats:{
            wood:40,
            stone:0
          },
          req:5,
          hp:150
        });
        area = getArea(m2[0],m2[3],3);
        for(var i in area){
          var f = area[i];
          var fc = f[0];
          var fr = f[1];
          var fp = [f,[fc+1,fr],[fc+2,fr],[fc,fr+1],[fc+1,fr+1],[fc+2,fr+1],[fc,fr+2],[fc+1,fr+2],[fc+2,fr+2]];
          var count = 0;
          for(var p in fp){
            var t = getTile(0,fp[p][0],fp[p][1]);
            if(!isWalkable(0,fp[p][0],fp[p][1]) || t == 8){
              break;
            } else {
              if(t >= 3 && t < 4){
                count++;
              }
            }
          }
          if(count >= 7){
            for(var p in fp){
              var n = fp[p];
              tileChange(0,n[0],n[1],8);
              tileChange(6,n[0],n[1],0);
            }
            var center = getCenter(fp[4][0],fp[4][1]);
            Farm({
              house:self.id,
              x:center[0],
              y:center[1],
              z:0,
              type:'farm',
              built:true,
              plot:fp
            });
          }
        }
      }
      mapEdit();
    }
    console.log('Goths: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
    // check for next chapter conditions
  }
  self.init();
}

// NORSEMEN
Norsemen = function(param){
  var self = House(param);
  self.scene = {
    // objects
    runestone:null,
    fire:null
  }
  self.init = function(){

  }
}

// FRANKS
Franks = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    var area = getArea(loc,self.hq,5);
    var select = [];
    var wselect = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var perim = [[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c-1,r],[c+2,r],[c-1,r+1],[c+2,r+1],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2]];
      var walls = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if((p >= 3 && p < 4) || p == 7){
          count++;
        }
      }
      var ex = perim[2];
      if(count == 4 && getTile(0,ex[0],ex[1]) != 0){
        count = 0;
        for(var n in perim){
          var m = getTile(0,perim[n][0],perim[n][1]);
          var tm = getTile(5,perim[n][0],perim[n][1]);
          if(m != 11 &&
          m != 11.5 &&
          m != 12 &&
          m != 12.5 &&
          m != 13 &&
          m != 14 &&
          m != 15 &&
          m != 16 &&
          m != 17 &&
          m != 19 &&
          m != 20 &&
          m != 20.5 &&
          (tm == 0 || tm == 'dock6' || tm == 'dock7' || tm == 'dock8')){
            count++;
          }
        }
        if(count == 12){
          select.push(plot);
          wselect.push(walls);
        }
      }
    }
    if(select.length > 0){
      var rand = Math.floor(Math.random() * select.length);
      var plot = select[rand];
      var walls = wselect[rand];
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'frankhut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(self.hq,self.hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      if(s1 > 0.4){
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(s2 > 0.6){
        SerfM({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(building.type == 'mill'){
        Building.list[b].serfs[s1] = s1;
        Building.list[b].serfs[s2] = s2;
      } else {
        if(Player.list[s1].sex == 'm'){
          Building.list[b].serfs[s1] = s1;
        }
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
        }
      }
      console.log('Serfs have spawned for Franks: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'FrankSword'){
      FrankSword({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'FrankSpear'){
      FrankSpear({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'FrankBow'){
      FrankBow({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Carolingian'){
      Carolingian({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.25){
        FrankSword({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else if(flip < 0.5){
        FrankBow({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          },
        })
      } else {
        FrankSpear({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    area = getArea(grid[0],grid[grid.length-1],5);
    var plots = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if(p >= 3 && p < 4){
          count++;
        }
      }
      if(count == 4){
        plots.push(plot)
      }
    }
    var m1 = null;
    var m2 = null;
    if(plots.length > 0){
      var rand = Math.floor(Math.random() * plots.length);
      m1 = plots[rand];
      var m1top = [[m1[2][0],m1[2][1]-1],[m1[3][0],m1[3][1]-1]];
      var m1c = getCenter(m1[0][0],m1[0][1]);
      plots.splice(rand,1);
      for(var i in m1){
        var n = m1[i];
        tileChange(0,n[0],n[1],13);
        tileChange(3,n[0],n[1],String('mill' + i));
        matrixChange(0,n[0],n[1],1);
      }
      tileChange(5,m1top[0][0],m1top[0][1],'mill4');
      tileChange(5,m1top[1][0],m1top[1][1],'mill5');
      Mill({
        house:self.id,
        x:m1c[0],
        y:m1c[1],
        z:0,
        type:'mill',
        built:true,
        plot:m1,
        topPlot:m1top,
        mats:{
          wood:40,
          stone:0
        },
        req:5,
        hp:150
      });
      area = getArea(m1[0],m1[3],4);
      for(var i in area){
        var f = area[i];
        var fc = f[0];
        var fr = f[1];
        var fp = [f,[fc+1,fr],[fc+2,fr],[fc,fr+1],[fc+1,fr+1],[fc+2,fr+1],[fc,fr+2],[fc+1,fr+2],[fc+2,fr+2]];
        var count = 0;
        for(var p in fp){
          var t = getTile(0,fp[p][0],fp[p][1]);
          if(!isWalkable(0,fp[p][0],fp[p][1]) || t == 8){
            break;
          } else {
            if(t >= 3 && t < 4){
              count++;
            }
          }
        }
        if(count >= 7){
          for(var p in fp){
            var n = fp[p];
            tileChange(0,n[0],n[1],8);
            tileChange(6,n[0],n[1],0);
          }
          var center = getCenter(fp[4][0],fp[4][1]);
          Farm({
            house:self.id,
            x:center[0],
            y:center[1],
            z:0,
            type:'farm',
            built:true,
            plot:fp
          });
        }
      }
      if(plots.length > 0){
        var best = 0;
        for(var i in plots){
          var p = plots[i];
          var cen = getCenter(p[0][0],p[0][1]);
          var dist = getDistance({x:m1c[0],y:m1c[1]},{x:cen[0],y:cen[1]});
          if(dist > best){
            best = i;
          }
        }
        m2 = plots[best];
        var m2top = [[m2[2][0],m2[2][1]-1],[m2[3][0],m2[3][1]-1]];
        var m2c = getCenter(m2[0][0],m2[0][1]);
        for(var i in m2){
          var n = m2[i];
          tileChange(0,n[0],n[1],13);
          tileChange(3,n[0],n[1],String('mill' + i));
          matrixChange(0,n[0],n[1],1);
        }
        tileChange(5,m2top[0][0],m2top[0][1],'mill4');
        tileChange(5,m2top[1][0],m2top[1][1],'mill5');
        Mill({
          house:self.id,
          x:m2c[0],
          y:m2c[1],
          z:0,
          type:'mill',
          built:true,
          plot:m2,
          topPlot:m2top,
          mats:{
            wood:40,
            stone:0
          },
          req:5,
          hp:150
        });
        area = getArea(m2[0],m2[3],3);
        for(var i in area){
          var f = area[i];
          var fc = f[0];
          var fr = f[1];
          var fp = [f,[fc+1,fr],[fc+2,fr],[fc,fr+1],[fc+1,fr+1],[fc+2,fr+1],[fc,fr+2],[fc+1,fr+2],[fc+2,fr+2]];
          var count = 0;
          for(var p in fp){
            var t = getTile(0,fp[p][0],fp[p][1]);
            if(!isWalkable(0,fp[p][0],fp[p][1]) || t == 8){
              break;
            } else {
              if(t >= 3 && t < 4){
                count++;
              }
            }
          }
          if(count >= 7){
            for(var p in fp){
              var n = fp[p];
              tileChange(0,n[0],n[1],8);
              tileChange(6,n[0],n[1],0);
            }
            var center = getCenter(fp[4][0],fp[4][1]);
            Farm({
              house:self.id,
              x:center[0],
              y:center[1],
              z:0,
              type:'farm',
              built:true,
              plot:fp
            });
          }
        }
      }
      mapEdit();
    }
    console.log('Franks: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
}

// CELTS
Celts = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    var area = getArea(loc,self.hq,5);
    var select = [];
    var wselect = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var perim = [[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c-1,r],[c+2,r],[c-1,r+1],[c+2,r+1],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2]];
      var walls = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if((p >= 1 && p < 4) || p == 7){
          count++;
        }
      }
      var ex = perim[10];
      if(count == 4 && getTile(0,ex[0],ex[1]) != 0){
        count = 0;
        for(var n in perim){
          var m = getTile(0,perim[n][0],perim[n][1]);
          var tm = getTile(5,perim[n][0],perim[n][1]);
          if(m != 11 &&
          m != 11.5 &&
          m != 12 &&
          m != 12.5 &&
          m != 13 &&
          m != 14 &&
          m != 15 &&
          m != 16 &&
          m != 17 &&
          m != 19 &&
          m != 20 &&
          m != 20.5 &&
          (tm == 0 || tm == 'dock6' || tm == 'dock7' || tm == 'dock8')){
            count++;
          }
        }
        if(count == 12){
          select.push(plot);
          wselect.push(walls);
        }
      }
    }
    if(select.length > 0){
      var rand = Math.floor(Math.random() * select.length);
      var plot = select[rand];
      var walls = wselect[rand];
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'celthut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(self.hq,self.hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      if(s1 > 0.4){
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(s2 > 0.6){
        SerfM({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(building.type == 'mill'){
        Building.list[b].serfs[s1] = s1;
        Building.list[b].serfs[s2] = s2;
      } else {
        if(Player.list[s1].sex == 'm'){
          Building.list[b].serfs[s1] = s1;
        }
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
        }
      }
      console.log('Serfs have spawned for Celts: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'CeltAxe'){
      CeltAxe({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'CeltSpear'){
      CeltSpear({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Headhunter'){
      Headhunter({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Druid'){
      Druid({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'ScoutShip'){
      ScoutShip({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Longship'){
      Longship({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.618){
        CeltAxe({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else {
        CeltSpear({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    var chq = getCenter(self.hq[0],self.hq[1]);
    var best = null;
    var cave = null;
    for(var i in caveEntrances){
      var e = caveEntrances[i];
      var ce = getCenter(e[0],e[1]);
      var dist = getDistance({x:chq[0],y:chq[1]},{x:ce[0],y:ce[1]});
      if(!best){
        best = dist;
        cave = e;
      } else {
        if(dist < best){
          best = dist;
          cave = e;
        }
      }
    }
    area = getArea(cave,cave,4);
    var plots = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var blocker = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var b in blocker){
        var bl = blocker[b];
        if(getTile(0,bl[0],bl[1]) == 6){
          count++;
        }
      }
      if(count == 0){
        for(var n in plot){
          var p = getTile(0,plot[n][0],plot[n][1]);
          if(p >= 4 && p < 6){
            count++;
          }
        }
        if(count == 4){
          plots.push(plot)
        }
      }
    }
    var m1 = null;
    var m2 = null;
    if(plots.length > 0){
      var rand = Math.floor(Math.random() * plots.length);
      m1 = plots[rand];
      var m1c = getCenter(m1[0][0],m1[0][1]);
      plots.splice(rand,1);
      for(var i in m1){
        tileChange(0,m1[i][0],m1[i][1],13);
        tileChange(3,m1[i][0],m1[i][1],String('mine' + i));
        matrixChange(0,m1[i][0],m1[i][1],1);
      }
      Mine({
        house:self.id,
        x:m1c[0],
        y:m1c[1],
        z:0,
        type:'mine',
        built:true,
        plot:m1,
        mats:{
          wood:40,
          stone:0
        },
        req:5,
        hp:150
      });
      if(plots.length > 0){
        var high = 0;
        for(var i in plots){
          var p = plots[i];
          var cen = getCenter(p[0][0],p[0][1]);
          var dist = getDistance({x:m1c[0],y:m1c[1]},{x:cen[0],y:cen[1]});
          if(dist > high){
            high = i;
          }
        }
        m2 = plots[high];
        var m2c = getCenter(m1[0][0],m1[0][1]);
        for(var i in m2){
          tileChange(0,m2[i][0],m2[i][1],13);
          tileChange(3,m2[i][0],m2[i][1],String('mine' + i));
          matrixChange(0,m2[i][0],m2[i][1],1);
        }
        Mine({
          house:self.id,
          x:m2c[0],
          y:m2c[1],
          z:0,
          type:'mine',
          built:true,
          plot:m2,
          mats:{
            wood:40,
            stone:0
          },
          req:5,
          hp:150
        });
      }
      mapEdit();
    }
    console.log('Celts: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
}

// TEUTONS
Teutons = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.newSerfs = function(b){
    var building = Building.list[b];
    var loc = getLoc(building.x,building.y);
    var area = getArea(loc,self.hq,5);
    var select = [];
    var wselect = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var perim = [[c-1,r-1],[c,r-1],[c+1,r-1],[c+2,r-1],[c-1,r],[c+2,r],[c-1,r+1],[c+2,r+1],[c-1,r+2],[c,r+2],[c+1,r+2],[c+2,r+2]];
      var walls = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var n in plot){
        var p = getTile(0,plot[n][0],plot[n][1]);
        if((p >= 1 && p < 5) || p == 7){
          count++;
        }
      }
      var ex = perim[2];
      if(count == 4 && getTile(0,ex[0],ex[1]) != 0){
        count = 0;
        for(var n in perim){
          var m = getTile(0,perim[n][0],perim[n][1]);
          var tm = getTile(5,perim[n][0],perim[n][1]);
          if(m != 11 &&
          m != 11.5 &&
          m != 12 &&
          m != 12.5 &&
          m != 13 &&
          m != 14 &&
          m != 15 &&
          m != 16 &&
          m != 17 &&
          m != 19 &&
          m != 20 &&
          m != 20.5 &&
          (tm == 0 || tm == 'dock6' || tm == 'dock7' || tm == 'dock8')){
            count++;
          }
        }
        if(count == 12){
          select.push(plot);
          wselect.push(walls);
        }
      }
    }
    if(select.length > 0){
      var rand = Math.floor(Math.random() * select.length);
      var plot = select[rand];
      var walls = wselect[rand];
      for(var i in plot){
        var p = plot[i];
        tileChange(0,p[0],p[1],11);
        tileChange(6,p[0],p[1],0);
      }
      mapEdit();
      var center = getCoords(plot[3][0],plot[3][1]);
      var id = Math.random();
      Building({
        id:id,
        house:self.id,
        x:center[0],
        y:center[1],
        z:0,
        type:'teuthut',
        built:false,
        plot:plot,
        walls:walls,
        mats:{
          wood:30,
          stone:0
        },
        req:5,
        hp:150
      })
      area = getArea(self.hq,self.hq,2);
      var grid = [];
      for(var i in area){
        var s = area[i];
        if(isWalkable(0,s[0],s[1])){
          grid.push(s);
        }
      }
      var rand = Math.floor(Math.random() * grid.length);
      var s1 = Math.random();
      var sp1 = grid[rand];
      var c1 = getCenter(sp1[0],sp1[1]);
      grid.splice(rand,1);
      rand = Math.floor(Math.random() * grid.length);
      var s2 = Math.random();
      var sp2 = grid[rand];
      var c2 = getCenter(sp2[0],sp2[1]);
      var work = {hq:b,spot:null};
      if(s1 > 0.4){
        SerfM({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s1,
          name:'Serf',
          x:c1[0],
          y:c1[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp1},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(s2 > 0.6){
        SerfM({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      } else {
        SerfF({
          id:s2,
          name:'Serf',
          x:c2[0],
          y:c2[1],
          z:0,
          house:self.id,
          home:{z:0,loc:sp2},
          work:{hq:b,spot:null},
          hut:id
        });
      }
      if(building.type == 'mill'){
        Building.list[b].serfs[s1] = s1;
        Building.list[b].serfs[s2] = s2;
      } else {
        if(Player.list[s1].sex == 'm'){
          Building.list[b].serfs[s1] = s1;
        }
        if(Player.list[s2].sex == 'm'){
          Building.list[b].serfs[s2] = s2;
        }
      }
      console.log('Serfs have spawned for Teutons: ' + Building.list[b].type);
    }
  }
  self.spawn = function(cl,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'TeutonPike'){
      TeutonPike({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'TeutonBow'){
      TeutonBow({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Prior'){
      Prior({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'TeutonicKnight'){
      TeutonicKnight({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 4; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip < 0.618){
        TeutonPike({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else {
        TeutonBow({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    area = getArea(grid[0],grid[grid.length-1],10);
    var plots = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r+1],[c+1,r+1],t,[c+1,r]];
      var blocker = [[c,r-1],[c+1,r-1]];
      var count = 0;
      for(var b in blocker){
        var bl = blocker[b];
        if(getTile(0,bl[0],bl[1]) == 6){
          count++;
        }
      }
      if(count == 0){
        for(var n in plot){
          var p = getTile(0,plot[n][0],plot[n][1]);
          if(p >= 4 && p < 6){
            count++;
          }
        }
        if(count > 0 && count < 4){
          plots.push(plot)
        }
      }
    }
    var m1 = null;
    var m2 = null;
    if(plots.length > 0){
      var rand = Math.floor(Math.random() * plots.length);
      m1 = plots[rand];
      var m1c = getCenter(m1[0][0],m1[0][1]);
      plots.splice(rand,1);
      for(var i in m1){
        tileChange(0,m1[i][0],m1[i][1],13);
        tileChange(3,m1[i][0],m1[i][1],String('mine' + i));
        matrixChange(0,m1[i][0],m1[i][1],1);
      }
      Mine({
        house:self.id,
        x:m1c[0],
        y:m1c[1],
        z:0,
        type:'mine',
        built:true,
        plot:m1,
        mats:{
          wood:40,
          stone:0
        },
        req:5,
        hp:150
      });
      if(plots.length > 0){
        var best = 0;
        for(var i in plots){
          var p = plots[i];
          var cen = getCenter(p[0][0],p[0][1]);
          var dist = getDistance({x:m1c[0],y:m1c[1]},{x:cen[0],y:cen[1]});
          if(dist > best){
            best = i;
          }
        }
        m2 = plots[best];
        var m2c = getCenter(m1[0][0],m1[0][1]);
        for(var i in m2){
          tileChange(0,m2[i][0],m2[i][1],13);
          tileChange(3,m2[i][0],m2[i][1],String('mine' + i));
          matrixChange(0,m2[i][0],m2[i][1],1);
        }
        Mine({
          house:self.id,
          x:m2c[0],
          y:m2c[1],
          z:0,
          type:'mine',
          built:true,
          plot:m2,
          mats:{
            wood:40,
            stone:0
          },
          req:5,
          hp:150
        });
      }
    }
    plots = [];
    for(var i in area){
      var t = area[i];
      var c = t[0];
      var r = t[1];
      var plot = [[c,r],[c+1,r]];
      var topPlot = [[c,r-1],[c+1,r-1]];
      var perim = [[c,r-1],[c+1,r-1],[c-1,r],[c+2,r],[c,r+1],[c+1,r+1]];
      var count = 0;
      if(r > 0 && c < mapSize-1){
        for(var i in plot){
          var n = getTile(0,plot[i][0],plot[i][1]);
          if(n >= 1 && n < 3){
            count++;
          }
        }
        if(count == 1){
          count = 0;
          for(var i in perim){
            if(getTile(0,perim[i][0],perim[i][1]) != 13){
              count++;
            }
          }
          if(count == 6){
            plots.push(plot);
          }
        }
      }
    }
    var l1 = null;
    var l2 = null;
    if(plots.length > 0){
      var rand = Math.floor(Math.random() * plots.length);
      l1 = plots[rand];
      var l1top = [[l1[0][0],l1[0][1]-1],[l1[1][0],l1[1][1]-1]];
      var l1c = getCenter(l1[0][0],l1[0][1]);
      plots.splice(rand,1);
      for(var i in l1){
        tileChange(0,l1[i][0],l1[i][1],13);
        tileChange(3,l1[i][0],l1[i][1],String('lumbermill' + i));
        matrixChange(0,l1[i][0],l1[i][1],1);
      }
      tileChange(5,l1top[0][0],l1top[0][1],'lumbermill2');
      tileChange(5,l1top[1][0],l1top[1][1],'lumbermill3');
      Lumbermill({
        house:self.id,
        x:l1c[0],
        y:l1c[1],
        z:0,
        type:'lumbermill',
        built:true,
        plot:l1,
        topPlot:l1top,
        mats:{
          wood:25,
          stone:0
        },
        req:5,
        hp:100
      });
      if(plots.length > 0){
        var best = 0;
        for(var i in plots){
          var p = plots[i];
          var cen = getCenter(p[0][0],p[0][1]);
          var dist = getDistance({x:l1c[0],y:l1c[1]},{x:cen[0],y:cen[1]});
          if(dist > best){
            best = i;
          }
        }
        l2 = plots[best];
        var l2top = [[l2[0][0],l2[0][1]-1],[l2[1][0],l2[1][1]-1]];
        var l2c = getCenter(m1[0][0],m1[0][1]);
        for(var i in l2){
          tileChange(0,l2[i][0],l2[i][1],13);
          tileChange(3,l2[i][0],l2[i][1],String('lumbermill' + i));
          matrixChange(0,l2[i][0],l2[i][1],1);
        }
        tileChange(5,l2top[0][0],l2top[0][1],'lumbermill2');
        tileChange(5,l2top[1][0],l2top[1][1],'lumbermill3');
        Lumbermill({
          house:self.id,
          x:l2c[0],
          y:l2c[1],
          z:0,
          type:'lumbermill',
          built:true,
          plot:l2,
          topPlot:l2top,
          mats:{
            wood:25,
            stone:0
          },
          req:5,
          hp:100
        })
      }
    }
    mapEdit();
    console.log('Teutons: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
}

// OUTLAWS
Outlaws = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null
  }
  self.spawn = function(rank,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Trapper'){
      Trapper({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Outlaw'){
      Outlaw({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,5);
    for(var i in area){
      var t = area[i];
      if(isWalkable(0,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:0,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 3; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip > 0.33){
        Trapper({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      } else {
        Outlaw({
          x:c[0],
          y:c[1],
          z:0,
          house:self.id,
          home:{
            z:0,
            loc:select
          }
        })
      }
    }
    console.log('Outlaws: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
}

// MERCENARIES
Mercenaries = function(param){
  var self = House(param);
  self.scene = {
    // objects
    fire:null,
    barrel:null,
    chest:null,
    crates:null,
    swordrack:null,
  }
  self.spawn = function(rank,spawn){
    var c = getCenter(spawn.loc[0],spawn.loc[1]);
    if(cl == 'Cutthroat'){
      Cutthroat({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Strongman'){
      Strongman({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    } else if(cl == 'Marauder'){
      Marauder({
        x:c[0],
        y:c[1],
        z:spawn.z,
        house:self.id,
        home:{
          z:spawn.z,
          loc:[spawn.loc[0],spawn.loc[1]]
        }
      })
    }
  }
  self.init = function(){
    var grid = [];
    var area = getArea(self.hq,self.hq,4);
    for(var i in area){
      var t = area[i];
      if(isWalkable(-1,t[0],t[1]) && t.toString() != self.hq.toString()){
        grid.push(t);
      }
    }
    // fire
    var fireId = Math.random();
    var coords = getCoords(self.hq[0],self.hq[1]);
    InfiniteFire({
      id:fireId,
      parent:self.id,
      x:coords[0],
      y:coords[1],
      z:-1,
      qty:1
    });
    self.scene.fire = fireId;
    // pawns
    for(var i = 0; i < 3; i++){
      var rand = Math.floor(Math.random() * grid.length);
      var select = grid[rand];
      grid.splice(rand,1);
      var c = getCenter(select[0],select[1]);
      var flip = Math.random();
      if(flip > 0.33){
        Cutthroat({
          x:c[0],
          y:c[1],
          z:-1,
          house:self.id,
          home:{
            z:-1,
            loc:select
          }
        })
      } else {
        Strongman({
          x:c[0],
          y:c[1],
          z:-1,
          house:self.id,
          home:{
            z:-1,
            loc:select
          }
        })
      }
    }
    console.log('Mercenaries: ' + self.hq);
  }

  var super_update = self.update;
  self.update = function(){
    super_update();
  }
  self.init();
}

Kingdom = function(param){
  var self = Entity(param);
  self.name = param.name;
  self.flag = param.flag;
  self.hq = param.hq;
  self.king = param.king;
  self.houses = param.houses;
  self.hostile = param.hostile;
  self.allies = [];
  self.enemies = [];

  self.stores = {
    grain:0,
    wood:0,
    stone:0,
    ironore:0,
    iron:0,
    silverore:0,
    silver:0,
    goldore:0,
    gold:0,
    diamond:0
  }
  Kingdom.list[self.id] = self;

  io.emit('newFaction',{
    houseList:House.list,
    kingdomList:Kingdom.list
  })

  return self;
}

Kingdom.list = {};

flags = [
  ['🇦🇽',0], // 0
  ['🇦🇱',0], // 1
  ['🇦🇲',0], // 2
  ['🇦🇼',0], // 3
  ['🇦🇹',0], // 4
  ['🇧🇧',0], // 5
  ['🇧🇹',0], // 6
  ['🇧🇦',0], // 7
  ['🇧🇼',0], // 8
  ['🇧🇳',0], // 9
  ['🇧🇮',0], // 10
  ['🇰🇭',0], // 11
  ['🇨🇻',0], // 12
  ['🇧🇶',0], // 13
  ['🇨🇫',0], // 14
  ['🇨🇴',0], // 15
  ['🇨🇷',0], // 16
  ['🇭🇷',0], // 17
  ['🇩🇰',0], // 18
  ['🇩🇴',0], // 19
  ['🇪🇨',0], // 20
  ['🇪🇪',0], // 21
  ['🇫🇴',0], // 22
  ['🇫🇮',0], // 23
  ['🇵🇫',0], // 24
  ['🇬🇦',0], // 25
  ['🇬🇲',0], // 26
  ['🇬🇪',0], // 27
  ['🇩🇪',0], // 28
  ['🇬🇮',0], // 29
  ['🇬🇱',0], // 30
  ['🇬🇬',0], // 31
  ['🇭🇹',0], // 32
  ['🇭🇳',0], // 33
  ['🇮🇸',0], // 34
  ['🇮🇲',0], // 35
  ['🇯🇪',0], // 36
  ['🇰🇮',0], // 37
  ['🇱🇦',0], // 38
  ['🇱🇻',0], // 39
  ['🇱🇮',0], // 40
  ['🇲🇹',0], // 41
  ['🇲🇭',0], // 42
  ['🇲🇶',0], // 43
  ['🇲🇪',0], // 44
  ['🇴🇲',0], // 45
  ['🇵🇼',0], // 46
  ['🇵🇦',0], // 47
  ['🇵🇬',0], // 48
  ['🇵🇹',0], // 49
  ['🇶🇦',0], // 50
  ['🇷🇼',0], // 51
  ['🇸🇲',0], // 52
  ['🇷🇸',0], // 53
  ['🇸🇱',0], // 54
  ['🇸🇬',0], // 55
  ['🇸🇰',0], // 56
  ['🇪🇸',0], // 57
  ['🇱🇰',0], // 58
  ['🇧🇱',0], // 59
  ['🇵🇲',0], // 60
  ['🇻🇨',0], // 61
  ['🇸🇪',0], // 62
  ['🇨🇭',0], // 63
  ['🇹🇴',0], // 64
  ['🇹🇹',0], // 65
  ['🇻🇮',0], // 66
  ['🇺🇦',0], // 67
  ['🇳🇴',0], // 68
  ['🇼🇫',0], // 69
];

convertHouse = function(id){
  var player = Player.list[id];
  var house = player.house;
   var grain = player.stores.grain;
   House.list[house].stores.grain += grain;
   Player.list[id].stores.grain = 0;
   var wood = player.stores.wood;
   House.list[house].stores.wood += wood;
   Player.list[id].stores.wood = 0;
   var stone = player.stores.stone;
   House.list[house].stores.stone += stone;
   Player.list[id].stores.stone = 0;
   var ironore = player.stores.ironore;
   House.list[house].stores.ironore += ironore;
   Player.list[id].stores.ironore = 0;
   var iron = player.stores.iron;
   House.list[house].stores.iron += iron;
   Player.list[id].stores.ironore = 0;
   var silverore = player.stores.silverore;
   House.list[house].stores.silverore += silverore;
   Player.list[id].stores.silver = 0;
   var silver = player.stores.silver;
   House.list[house].stores.silver += silver;
   Player.list[id].stores.silver = 0;
   var goldore = player.stores.goldore;
   House.list[house].stores.goldore += goldore;
   Player.list[id].stores.goldore = 0;
   var gold = player.stores.gold;
   House.list[house].stores.gold += gold;
   Player.list[id].stores.gold = 0;
   var diamond = player.stores.diamond;
   House.list[house].stores.diamond += diamond;
   Player.list[id].stores.diamond = 0;
  for(var i in Building.list){
    var b = Building.list[i];
    if(b.owner == id){
      Building.list[i].house = house;
      if(b.patrol && b.built){
        House.list[house].military.patrol.push(b.id);
      }
      if(b.serfs){
        for(var s in b.serfs){
          var serf = b.serfs[s];
          Player.list[serf].house = house;
        }
      }
    }
  }
}

convertKingdom = function(hid){
  var house = House.list[hid];
  var kingdom = house.kingdom;
}
