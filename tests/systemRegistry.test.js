const assert = require('assert');
const systemRegistry = require('../server/js/core/SystemRegistry');

function run() {
  systemRegistry.clear();

  systemRegistry.register('gameState', { name: 'gameState' }, { priority: 1 });
  systemRegistry.register('tilemap', { name: 'tilemap' }, { dependsOn: ['gameState'], priority: 2 });
  systemRegistry.register('ai', { name: 'ai' }, { dependsOn: ['tilemap', 'missingSystem'], priority: 3 });

  const initOrder = systemRegistry.getInitializationOrder();
  assert.deepStrictEqual(initOrder, ['gameState', 'tilemap', 'ai'], 'initialization order should respect priority');

  const dependencyCheck = systemRegistry.verifyAllDependencies();
  assert.strictEqual(dependencyCheck.allValid, false, 'missing dependency should be flagged');
  assert.ok(
    dependencyCheck.issues.some(issue => issue.system === 'ai' && issue.missing.includes('missingSystem')),
    'missing dependency should be reported'
  );

  systemRegistry.clear();
  console.log('systemRegistry.test.js passed');
}

run();
