Inventory = function(param){
  var self = null;
  if(param){
    self = param;
  } else {
    self = {
      key:0,
      wood:0,
      stone:0,
      grain:0,
      ironore:0,
      iron:0,
      steel:0,
      boarhide:0,
      leather:0,
      silverore:0,
      silver:0,
      goldore:0,
      gold:0,
      diamond:0,
      huntingknife:0,
      dague:0,
      rondel:0,
      misericorde:0,
      bastardsword:0,
      longsword:0,
      zweihander:0,
      morallta:0,
      bow:0,
      welshlongbow:0,
      knightlance:0,
      rusticlance:0,
      paladinlance:0,
      brigandine:0,
      lamellar:0,
      maille:0,
      hauberk:0,
      brynja:0,
      cuirass:0,
      steelplate:0,
      greenwichplate:0,
      gothicplate:0,
      clericrobe:0,
      monkcowl:0,
      blackcloak:0,
      tome:0,
      runicscroll:0,
      sacredtext:0,
      stoneaxe:0,
      ironaxe:0,
      pickaxe:0,
      torch:10,
      bread:0,
      fish:0,
      lamb:0,
      boarmeat:0,
      venison:0,
      poachedfish:0,
      lambchop:0,
      boarshank:0,
      venisonloin:0,
      mead:0,
      saison:0,
      flanders:0,
      bieredegarde:0,
      bordeaux:0,
      bourgogne:0,
      chianti:0,
      crown:0,
      arrows:0,
      worldmap:0,
      cavemap:0,
      relic:0,
      keyRing:[], // key = {id:building_id,name:building_name}
      mapData:null
    }
  }
  self.total = function(){
    var total = 0;
    var keys = Object.keys(self);
    for(i in keys){
      if(!Number.isNaN(self[keys[i]])){
        total += self[keys[i]];
      }
    }
    return total;
  }
  return self;
}
