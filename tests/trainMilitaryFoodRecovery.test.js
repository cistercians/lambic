const assert = require('assert');

const GoalChain = require('../server/js/ai/GoalChain');
const { TrainMilitaryGoal } = require('../server/js/ai/Goals');

function withGlobals(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = global[key];
    global[key] = overrides[key];
  }

  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete global[key];
      } else {
        global[key] = previous[key];
      }
    }
  }
}

function createHouse(stores) {
  const buildings = {
    garrison: [{ type: 'garrison', built: true }],
    farm: [{ type: 'farm', built: true }]
  };

  return {
    id: 6,
    name: 'Teutons',
    stores,
    ai: {
      buildingService: {
        hasBuildingType(type) {
          return (buildings[type] || []).some(building => building.built);
        },
        getBuildingCount(type) {
          return (buildings[type] || []).filter(building => building.built).length;
        },
        getBuildingsByType(type) {
          return buildings[type] || [];
        },
        getStoneMineCount() {
          return 0;
        },
        getCaveMineCount() {
          return 0;
        }
      },
      knowledge: {
        identifyResourceGap() {
          return false;
        }
      },
      getMilitaryUnits() {
        return [];
      }
    }
  };
}

function withFactionProgression(fn) {
  withGlobals({
    FACTION_UNIT_PROGRESSION: {
      Teutons: {
        basic: ['TeutonPike', 'TeutonBow'],
        elite: null,
        mounted: 'TeutonicKnight'
      }
    },
    FACTION_BASIC_UNITS: {}
  }, fn);
}

function testTrainingBlocksOnCombinedFoodBeforeExecution() {
  withFactionProgression(() => {
    const house = createHouse({ grain: 0, fish: 0, iron: 0 });
    const goal = new TrainMilitaryGoal();

    assert.strictEqual(goal.canExecute(house), false, 'expected starving faction not to execute training immediately');
    assert.deepStrictEqual(
      goal.blockedBy,
      [{ type: 'RESOURCE', resource: 'grain', have: 0, need: 20 }],
      'expected training to expose a grain recovery block using total food availability'
    );
  });
}

function testFishCanSatisfyTrainingFoodRequirement() {
  withFactionProgression(() => {
    const house = createHouse({ grain: 0, fish: 20, iron: 0 });
    const goal = new TrainMilitaryGoal();

    assert.strictEqual(goal.canExecute(house), true, 'expected fish to count toward military training food');
  });
}

function testGoalChainGathersFoodBeforeTraining() {
  withFactionProgression(() => {
    const house = createHouse({ grain: 0, fish: 0, iron: 0 });
    const chain = GoalChain.create(house, new TrainMilitaryGoal());
    const stepTypes = chain.steps.map(step => step.type);

    assert.deepStrictEqual(
      stepTypes,
      ['GATHER_RESOURCE', 'TRAIN_MILITARY'],
      'expected training chain to gather food before retrying military training'
    );
    assert.strictEqual(chain.steps[0].resource, 'grain', 'expected food recovery to use grain/farm production');
  });
}

function run() {
  testTrainingBlocksOnCombinedFoodBeforeExecution();
  testFishCanSatisfyTrainingFoodRequirement();
  testGoalChainGathersFoodBeforeTraining();
  console.log('trainMilitaryFoodRecovery.test.js passed');
}

run();
