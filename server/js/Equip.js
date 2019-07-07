equip = {
  // weapons
  huntingknife:{
    name: 'HuntingKnife',
    type: 'dagger',
    dmg:15,
    attackrate:500,
    unequip:function(id){
      Player.list[i].gear.
      Player.list[id].inventory.huntingknife++;
    }
  },
  dague:{
    name: 'Dague',
    type: 'dagger',
    dmg:20,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.dague++;
    }
  },
  rondel:{
    name: 'Rondel',
    type: 'dagger',
    dmg:25,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.rondel++;
    }
  },
  misericorde:{
    name: 'Misericorde',
    type: 'dagger',
    dmg:30,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.misericorde++;
    }
  },
  bastardsword:{
    name: 'BastardSword',
    type: 'sword',
    dmg:45,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.bastardsword++;
    }
  },
  longsword:{
    name: 'Longsword',
    type: 'sword',
    dmg:50,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.longsword++;
    }
  },
  zweihander:{
    name: 'Zweihander',
    type: 'sword',
    dmg:55,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.zweihander++;
    }
  },
  morallta:{
    name: 'Morallta',
    type: 'sword',
    dmg:70,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.morallta++;
    }
  },
  bow:{
    name: 'Bow',
    type: 'bow',
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.bow++;
    }
  },
  welshlongbow:{
    name: 'WelshLongbow',
    type: 'bow',
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.welshlongbow++;
    }
  },
  knightlance:{
    name: 'KnightLance',
    type: 'lance',
    dmg:75,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.knightlance++;
    }
  },
  rusticlance:{
    name: 'RusticLance',
    type: 'lance',
    dmg:75,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.rusticlance++;
    }
  },
  paladinlance:{
    name: 'PaladinLance',
    type: 'lance',
    dmg:100,
    attackrate:500,
    unequip:function(id){
      Player.list[id].inventory.paladinlance++;
    }
  },

  // armor
  brigandine:{
    name: 'Brigandine',
    type: 'leather',
    unequip:function(id){
      Player.list[id].inventory.brigandine++;
    }
  },
  lamellar:{
    name: 'Lamellar',
    type: 'leather',
    unequip:function(id){
      Player.list[id].inventory.lamellar++;
    }
  },
  maille:{
    name: 'Maille',
    type: 'chainmail',
    unequip:function(id){
      Player.list[id].inventory.maille++;
    }
  },
  hauberk:{
    name: 'Hauberk',
    type: 'chainmail',
    unequip:function(id){
      Player.list[id].inventory.hauberk++;
    }
  },
  brynja:{
    name: 'Brynja',
    type: 'chainmail',
    unequip:function(id){
      Player.list[id].inventory.brynja++;
    }
  },
  cuirass:{
    name: 'Cuirass',
    type: 'plate',
    unequip:function(id){
      Player.list[id].inventory.cuirass++;
    }
  },
  steelplate:{
    name: 'SteelPlate',
    type: 'plate',
    unequip:function(id){
      Player.list[id].inventory.steelplate++;
    }
  },
  greenwichplate:{
    name: 'GreenwichPlate',
    type: 'plate',
    unequip:function(id){
      Player.list[id].inventory.greenwichplate++;
    }
  },
  gothicplate:{
    name: 'GothicPlate',
    type: 'plate',
    unequip:function(id){
      Player.list[id].inventory.gothicplate++;
    }
  },
  clericrobe:{
    name: 'ClericRobe',
    type: 'cloth',
    unequip:function(id){
      Player.list[id].inventory.clericrobe++;
    }
  },
  monkcowl:{
    name: 'MonkCowl',
    type: 'cloth',
    unequip:function(id){
      Player.list[id].inventory.monkcowl++;
    }
  },
  blackcloak:{
    name: 'BlackCloak',
    type: 'cloth',
    unequip:function(id){
      Player.list[id].inventory.blackcloak++;
    }
  },

  // head
  crown:{
    name: 'Crown',
    type: 'head',
    unequip:function(id){
      Player.list[id].inventory.crown++;
    }
  }

  // accessories
}
