const assert = require('assert');

const FactionKnowledge = require('../server/js/ai/FactionKnowledge');

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

function testScoutedZonesSurviveKnownZoneRescan() {
  const forestZone = { id: 'forest-zone', center: [20, 20] };

  withGlobals({
    day: 4,
    getArea: () => [],
    zoneManager: {
      getZoneResourceTypes(zone) {
        return zone.id === 'forest-zone'
          ? { forest: 30, rocks: 0, farmland: 0, caves: 0 }
          : { forest: 0, rocks: 0, farmland: 0, caves: 0 };
      }
    }
  }, () => {
    const knowledge = new FactionKnowledge({
      id: 'goths',
      name: 'Goths',
      hq: [5, 5],
      stores: {}
    });

    knowledge.markZoneAsKnown(forestZone);
    knowledge.updateKnownZones();

    assert.strictEqual(knowledge.isZoneKnown('forest-zone'), true, 'expected scouted zone to remain known after rescan');
    assert.deepStrictEqual(knowledge.getZoneResources('forest-zone'), { forest: 30, rocks: 0, farmland: 0, caves: 0 });
    assert.strictEqual(knowledge.getKnownZoneResources('wood')[0], forestZone, 'expected durable scouted zone to be returned as known wood');
  });
}

function run() {
  testScoutedZonesSurviveKnownZoneRescan();
  console.log('factionKnowledgeScoutedZones.test.js passed');
}

run();
