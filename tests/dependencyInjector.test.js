const assert = require('assert');
const systemRegistry = require('../server/js/core/SystemRegistry');
const dependencyInjector = require('../server/js/core/DependencyInjector');

function run() {
  systemRegistry.clear();
  dependencyInjector.clear();

  const mockSystem = { name: 'mockSystem' };
  systemRegistry.register('mockSystem', mockSystem);

  dependencyInjector.provide('configValue', () => 42);
  global.legacyValue = 'legacy';

  const resolvedSystem = dependencyInjector.resolve('mockSystem');
  assert.strictEqual(resolvedSystem, mockSystem, 'should resolve systemRegistry dependencies');

  const resolvedConfig = dependencyInjector.resolve('configValue');
  assert.strictEqual(resolvedConfig, 42, 'should resolve provided dependencies');

  const resolvedLegacy = dependencyInjector.resolve('legacyValue');
  assert.strictEqual(resolvedLegacy, 'legacy', 'should resolve legacy globals as fallback');

  delete global.legacyValue;
  dependencyInjector.clear();
  systemRegistry.clear();

  console.log('dependencyInjector.test.js passed');
}

run();
