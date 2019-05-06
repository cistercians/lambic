fauna = function(){
  var deerRatio = Math.floor(biomes.hForest/100);
  var boarRatio = Math.floor(biomes.hForest/400);
  var wolfRatio = Math.floor(biomes.hForest/200);

  var deerPop = 0;
  var boarPop = 0;
  var wolfPop = 0;

  for(i in Player.list){
    var cl = Player.list[i].class;
    if(cl === 'deer'){
      deerPop++;
    } else if(cl === 'wild boar'){
      boarPop++;
    } else if(cl === 'wolf'){
      wolfPop++;
    }
  }
  if(deerPop < deerRatio){
    var num = 0;
    if(day === 0){
      num = Math.floor(deerRatio * 0.75);
    } else {
      num = Math.floor((deerRatio - deerPop)/4);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      Deer({
        x:sp[0],
        y:sp[1],
        z:0
      });
    }
  }
  if(boarPop < boarRatio){
    var num = 0;
    if(day === 0){
      num = Math.floor(boarRatio * 0.75);
    } else {
      num = Math.floor((boarRatio - boarPop)/4);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      WildBoar({
        x:sp[0],
        y:sp[1],
        z:0
      });
    }
  }
  if(wolfPop < wolfRatio){
    var num = 0;
    if(day === 0){
      num = Math.floor(wolfRatio * 0.75);
    } else {
      num = Math.floor((wolfRatio - wolfPop)/4);
    }
    for(var i = 0; i < num; i++){
      var sp = randomSpawnHF();
      Wolf({
        x:sp[0],
        y:sp[1],
        z:0
      });
    }
  }
}
