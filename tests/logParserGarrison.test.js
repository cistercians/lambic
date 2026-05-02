const assert = require('assert');

const GarrisonExtractor = require('../tools/logParser/extractors/GarrisonExtractor');

function feedLines(extractor, lines) {
  const context = {
    lineNumber: 0,
    currentDay: 5,
    currentHour: 'VIII.a'
  };

  for (const line of lines) {
    context.lineNumber += 1;
    extractor.extract(line, context);
  }

  return extractor.getResults().stats;
}

function testPassiveGarrisonFailuresAreCountedByReasonAndFaction() {
  const extractor = new GarrisonExtractor();
  const stats = feedLines(extractor, [
    '[Garrison] Production timer triggered { garrisonId: 0.123, built: true, house: 6, owner: 6 }',
    '[Garrison] Production failed: Insufficient surplus food {',
    "  house: 'Teutons',",
    '  militaryCount: 4,',
    '  totalFood: 0,',
    '}'
  ]);

  assert.strictEqual(stats.passive.attempts, 1, 'expected passive attempt count');
  assert.strictEqual(stats.passive.failures, 1, 'expected passive failure count');
  assert.strictEqual(stats.passive.failuresByReason['Insufficient surplus food'], 1, 'expected failure reason count');
  assert.strictEqual(stats.passive.byFaction.Teutons, 1, 'expected failure to be attributed to Teutons');
}

function testPassiveSuccessAndTrainingFailuresAreCounted() {
  const extractor = new GarrisonExtractor();
  const stats = feedLines(extractor, [
    '[Garrison] Unit produced successfully {',
    "  house: 'Teutons',",
    "  unitClass: 'TeutonPike',",
    '}',
    '[GoalExecutor] [2026-04-29T01:38:07.924Z] [Teutons] [TRAIN_MILITARY] [step 0] Error executing goal: Insufficient food: need 20 (grain + fish), have 0',
    'FACTION AI REPORT - Teutons - Day 6',
    '  1. TRAIN_MILITARY completed'
  ]);

  assert.strictEqual(stats.passive.successes, 1, 'expected passive success count');
  assert.strictEqual(stats.passive.byFaction.Teutons, 1, 'expected success to be attributed to Teutons');
  assert.strictEqual(stats.trainMilitary.failures, 1, 'expected training failure count');
  assert.strictEqual(stats.trainMilitary.failuresByFaction.Teutons, 1, 'expected training failure faction count');
  assert.strictEqual(stats.trainMilitary.successes, 1, 'expected training success count');
  assert.strictEqual(stats.trainMilitary.successesByFaction.Teutons, 1, 'expected training success faction count');
}

function run() {
  testPassiveGarrisonFailuresAreCountedByReasonAndFaction();
  testPassiveSuccessAndTrainingFailuresAreCounted();
  console.log('logParserGarrison.test.js passed');
}

run();
