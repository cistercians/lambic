// Test script to verify telemetry rate limiting
const MapContextHelpers = require('./server/js/core/MapContextHelpers');
const OptimizedGameLoop = require('./server/js/core/OptimizedGameLoop');

console.log('Testing telemetry rate limiting...\n');

// Mock entities for testing
const mockEntity = { id: 'test', inBattleground: false, battlegroundMatchId: null };

// Test MapContext.FilterStats rate limiting
console.log('Testing MapContext.FilterStats rate limiting:');
console.log('Calling getEntitiesInSameContext 10 times rapidly...');

for (let i = 0; i < 10; i++) {
  const result = MapContextHelpers.getEntitiesInSameContext(mockEntity);
  console.log(`Call ${i + 1}: ${result.length} entities found`);
}

// Wait 6 seconds and call again to verify rate limiting works
console.log('\nWaiting 6 seconds...');
setTimeout(() => {
  console.log('Calling getEntitiesInSameContext again after rate limit period...');
  const result = MapContextHelpers.getEntitiesInSameContext(mockEntity);
  console.log(`Result: ${result.length} entities found`);
  console.log('\nRate limiting test complete!');
}, 6000);
