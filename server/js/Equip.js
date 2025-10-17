equip = {
  // weapons
  huntingknife:{
    name: 'HuntingKnife',
    type: 'dagger',
    dmg:15,
    attackrate:500,
    strengthBonus: 1,
    dexterityBonus: 2,
    unequip:function(id){
      Player.list[id].inventory.huntingknife++;
    }
  },
  dague:{
    name: 'Dague',
    type: 'dagger',
    dmg:20,
    attackrate:500,
    strengthBonus: 2,
    dexterityBonus: 3,
    unequip:function(id){
      Player.list[id].inventory.dague++;
    }
  },
  rondel:{
    name: 'Rondel',
    type: 'dagger',
    dmg:25,
    attackrate:500,
    strengthBonus: 3,
    dexterityBonus: 4,
    unequip:function(id){
      Player.list[id].inventory.rondel++;
    }
  },
  misericorde:{
    name: 'Misericorde',
    type: 'dagger',
    dmg:30,
    attackrate:500,
    strengthBonus: 4,
    dexterityBonus: 5,
    unequip:function(id){
      Player.list[id].inventory.misericorde++;
    }
  },
  bastardsword:{
    name: 'BastardSword',
    type: 'sword',
    dmg:45,
    attackrate:500,
    strengthBonus: 5,
    dexterityBonus: 1,
    unequip:function(id){
      Player.list[id].inventory.bastardsword++;
    }
  },
  longsword:{
    name: 'Longsword',
    type: 'sword',
    dmg:50,
    attackrate:500,
    strengthBonus: 6,
    dexterityBonus: 2,
    unequip:function(id){
      Player.list[id].inventory.longsword++;
    }
  },
  zweihander:{
    name: 'Zweihander',
    type: 'sword',
    dmg:55,
    attackrate:500,
    strengthBonus: 8,
    dexterityBonus: 1,
    unequip:function(id){
      Player.list[id].inventory.zweihander++;
    }
  },
  morallta:{
    name: 'Morallta',
    type: 'sword',
    dmg:70,
    attackrate:500,
    strengthBonus: 10,
    dexterityBonus: 3,
    unequip:function(id){
      Player.list[id].inventory.morallta++;
    }
  },
  bow:{
    name: 'Bow',
    type: 'bow',
    dmg: 15,
    attackrate:500,
    dexterityBonus: 5,
    unequip:function(id){
      Player.list[id].inventory.bow++;
    }
  },
  welshlongbow:{
    name: 'WelshLongbow',
    type: 'bow',
    dmg: 25,
    attackrate:500,
    dexterityBonus: 8,
    strengthBonus: 2,
    unequip:function(id){
      Player.list[id].inventory.welshlongbow++;
    }
  },
  knightlance:{
    name: 'KnightLance',
    type: 'lance',
    dmg:75,
    attackrate:500,
    strengthBonus: 8,
    hpBonus: 20,
    unequip:function(id){
      Player.list[id].inventory.knightlance++;
    }
  },
  rusticlance:{
    name: 'RusticLance',
    type: 'lance',
    dmg:75,
    attackrate:500,
    strengthBonus: 6,
    hpBonus: 15,
    unequip:function(id){
      Player.list[id].inventory.rusticlance++;
    }
  },
  paladinlance:{
    name: 'PaladinLance',
    type: 'lance',
    dmg:100,
    attackrate:500,
    strengthBonus: 12,
    hpBonus: 30,
    unequip:function(id){
      Player.list[id].inventory.paladinlance++;
    }
  },

  // armor
  brigandine:{
    name: 'Brigandine',
    type: 'leather',
    defense: 5,
    hpBonus: 10,
    unequip:function(id){
      Player.list[id].inventory.brigandine++;
    }
  },
  lamellar:{
    name: 'Lamellar',
    type: 'leather',
    defense: 8,
    hpBonus: 15,
    unequip:function(id){
      Player.list[id].inventory.lamellar++;
    }
  },
  maille:{
    name: 'Maille',
    type: 'chainmail',
    defense: 10,
    hpBonus: 20,
    unequip:function(id){
      Player.list[id].inventory.maille++;
    }
  },
  hauberk:{
    name: 'Hauberk',
    type: 'chainmail',
    defense: 15,
    hpBonus: 25,
    unequip:function(id){
      Player.list[id].inventory.hauberk++;
    }
  },
  brynja:{
    name: 'Brynja',
    type: 'chainmail',
    defense: 18,
    hpBonus: 30,
    unequip:function(id){
      Player.list[id].inventory.brynja++;
    }
  },
  cuirass:{
    name: 'Cuirass',
    type: 'plate',
    defense: 20,
    hpBonus: 35,
    unequip:function(id){
      Player.list[id].inventory.cuirass++;
    }
  },
  steelplate:{
    name: 'SteelPlate',
    type: 'plate',
    defense: 25,
    hpBonus: 40,
    unequip:function(id){
      Player.list[id].inventory.steelplate++;
    }
  },
  greenwichplate:{
    name: 'GreenwichPlate',
    type: 'plate',
    defense: 30,
    hpBonus: 50,
    unequip:function(id){
      Player.list[id].inventory.greenwichplate++;
    }
  },
  gothicplate:{
    name: 'GothicPlate',
    type: 'plate',
    defense: 35,
    hpBonus: 60,
    unequip:function(id){
      Player.list[id].inventory.gothicplate++;
    }
  },
  clericrobe:{
    name: 'ClericRobe',
    type: 'cloth',
    defense: 3,
    hpBonus: 20,
    spiritBonus: 50,
    unequip:function(id){
      Player.list[id].inventory.clericrobe++;
    }
  },
  monkcowl:{
    name: 'MonkCowl',
    type: 'cloth',
    defense: 5,
    hpBonus: 25,
    spiritBonus: 75,
    unequip:function(id){
      Player.list[id].inventory.monkcowl++;
    }
  },
  blackcloak:{
    name: 'BlackCloak',
    type: 'cloth',
    defense: 2,
    hpBonus: 15,
    spiritBonus: 100,
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
