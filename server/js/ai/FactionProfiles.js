// Faction Profiles
// Defines strategic preferences and behavior parameters for each faction

const FactionProfiles = {
  Goths: {
    // Economic priorities
    economicPriorities: ['farmland', 'stone', 'forest'],
    buildingPreferences: {
      mill: { utility: 50, maxCount: 3 },
      farm: { utility: 45, farmsPerMill: 4 },
      mine: { utility: 40, preferStone: true },
      lumbermill: { utility: 35, minForest: 10 },
      garrison: { utility: 30 }
    },
    
    // Military strategy
    militaryStrategy: 'defensive',
    desiredMilitarySize: 8,
    trainingSplit: { infantry: 0.7, ranged: 0.3 },
    
    // Expansion strategy
    expansionStyle: 'moderate',
    minDistanceFromHQ: 15,
    maxOutposts: 2,
    
    // Goal utility modifiers
    utilityModifiers: {
      BUILD_FARM: 1.2, // Goths love farming
      BUILD_MINE: 1.1,
      TRAIN_MILITARY: 0.9,
      EXPAND_TERRITORY: 0.8
    }
  },
  
  Celts: {
    economicPriorities: ['cave_entrance', 'heavy_forest', 'ore'],
    buildingPreferences: {
      mine: { utility: 60, preferOre: true, nearCave: true },
      mill: { utility: 40, maxCount: 2 },
      farm: { utility: 35, farmsPerMill: 3 },
      lumbermill: { utility: 0 }, // Celts NEVER build lumbermills!
      garrison: { utility: 45 }
    },
    
    militaryStrategy: 'guerrilla',
    desiredMilitarySize: 12,
    trainingSplit: { infantry: 0.5, ranged: 0.5 },
    
    expansionStyle: 'isolationist',
    minDistanceFromHQ: 25,
    maxOutposts: 1,
    
    utilityModifiers: {
      BUILD_MINE: 1.5, // Celts prioritize mining heavily
      BUILD_LUMBERMILL: 0, // Never build these
      TRAIN_MILITARY: 1.2,
      SCOUT_TERRITORY: 1.3, // More cautious/aware
      DEPLOY_SCOUT: 1.3
    }
  },
  
  Teutons: {
    economicPriorities: ['ore', 'stone', 'forest'],
    buildingPreferences: {
      mine: { utility: 55, preferOre: true },
      lumbermill: { utility: 50, minForest: 12 },
      garrison: { utility: 60 }, // Military-focused
      mill: { utility: 35, maxCount: 2 },
      farm: { utility: 30, farmsPerMill: 3 }
    },
    
    militaryStrategy: 'aggressive',
    desiredMilitarySize: 15,
    trainingSplit: { infantry: 0.8, ranged: 0.2 },
    
    expansionStyle: 'aggressive',
    minDistanceFromHQ: 10,
    maxOutposts: 3,
    
    utilityModifiers: {
      BUILD_GARRISON: 1.3,
      TRAIN_MILITARY: 1.4,
      ATTACK_ENEMY: 1.5, // More likely to attack
      BUILD_MINE: 1.2,
      BUILD_LUMBERMILL: 1.2
    }
  },
  
  Franks: {
    economicPriorities: ['farmland', 'forest', 'stone'],
    buildingPreferences: {
      mill: { utility: 55, maxCount: 4 },
      farm: { utility: 50, farmsPerMill: 5 }, // Best farmers
      lumbermill: { utility: 40, minForest: 10 },
      garrison: { utility: 35 },
      mine: { utility: 30 }
    },
    
    militaryStrategy: 'balanced',
    desiredMilitarySize: 10,
    trainingSplit: { infantry: 0.6, ranged: 0.4 },
    
    expansionStyle: 'balanced',
    minDistanceFromHQ: 12,
    maxOutposts: 2,
    
    utilityModifiers: {
      BUILD_FARM: 1.5, // Franks are farming experts
      BUILD_MILL: 1.3,
      EXPAND_TERRITORY: 1.1
    }
  },
  
  Norsemen: {
    economicPriorities: ['forest', 'stone', 'farmland'],
    buildingPreferences: {
      lumbermill: { utility: 55, minForest: 8 },
      mine: { utility: 45, preferStone: true },
      garrison: { utility: 50 },
      mill: { utility: 35, maxCount: 2 },
      farm: { utility: 30, farmsPerMill: 3 }
    },
    
    militaryStrategy: 'raiding',
    desiredMilitarySize: 12,
    trainingSplit: { infantry: 0.7, ranged: 0.3 },
    
    expansionStyle: 'aggressive',
    minDistanceFromHQ: 12,
    maxOutposts: 3,
    
    utilityModifiers: {
      BUILD_LUMBERMILL: 1.4,
      TRAIN_MILITARY: 1.3,
      ATTACK_ENEMY: 1.2
    }
  },
  
  Brotherhood: {
    economicPriorities: ['farmland', 'stone', 'forest'],
    buildingPreferences: {
      mill: { utility: 45, maxCount: 2 },
      farm: { utility: 40, farmsPerMill: 3 },
      mine: { utility: 40 },
      garrison: { utility: 50 },
      lumbermill: { utility: 35, minForest: 10 }
    },
    
    militaryStrategy: 'defensive',
    desiredMilitarySize: 10,
    trainingSplit: { infantry: 0.5, ranged: 0.5 },
    
    expansionStyle: 'defensive',
    minDistanceFromHQ: 20,
    maxOutposts: 1,
    
    utilityModifiers: {
      BUILD_GARRISON: 1.2,
      DEFEND_TERRITORY: 1.5,
      TRAIN_MILITARY: 1.1
    }
  },
  
  Outlaws: {
    economicPriorities: ['forest', 'cave_entrance', 'stone'],
    buildingPreferences: {
      lumbermill: { utility: 50, minForest: 8 },
      mine: { utility: 45 },
      garrison: { utility: 40 },
      mill: { utility: 30, maxCount: 1 },
      farm: { utility: 25, farmsPerMill: 2 }
    },
    
    militaryStrategy: 'opportunistic',
    desiredMilitarySize: 8,
    trainingSplit: { infantry: 0.6, ranged: 0.4 },
    
    expansionStyle: 'opportunistic',
    minDistanceFromHQ: 15,
    maxOutposts: 2,
    
    utilityModifiers: {
      ATTACK_ENEMY: 1.3,
      SCOUT_TERRITORY: 1.2,
      BUILD_LUMBERMILL: 1.2
    }
  },
  
  Mercenaries: {
    economicPriorities: ['stone', 'ore', 'forest'],
    buildingPreferences: {
      mine: { utility: 55, preferOre: true },
      garrison: { utility: 60 },
      lumbermill: { utility: 40, minForest: 10 },
      mill: { utility: 25, maxCount: 1 },
      farm: { utility: 20, farmsPerMill: 2 }
    },
    
    militaryStrategy: 'mercenary',
    desiredMilitarySize: 15,
    trainingSplit: { infantry: 0.7, ranged: 0.3 },
    
    expansionStyle: 'opportunistic',
    minDistanceFromHQ: 10,
    maxOutposts: 2,
    
    utilityModifiers: {
      BUILD_GARRISON: 1.4,
      TRAIN_MILITARY: 1.5,
      BUILD_MINE: 1.3,
      ATTACK_ENEMY: 1.4
    }
  }
};

module.exports = FactionProfiles;

