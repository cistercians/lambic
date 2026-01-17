const PerformanceMonitor = require('../core/PerformanceMonitor');

function setupGameLoop({ OptimizedGameLoop, systemRegistry, gameState }) {
  // Create optimized game loop
  const optimizedGameLoop = new OptimizedGameLoop();
  global.optimizedGameLoop = optimizedGameLoop;
  global.runContextIsolationCheck = function(matchId = null) {
    if (!global.optimizedGameLoop || typeof global.optimizedGameLoop.getContextIsolationReport !== 'function') {
      return { valid: true, issues: [], hasPack: false };
    }
    return global.optimizedGameLoop.getContextIsolationReport(matchId);
  };
  systemRegistry.register('gameLoop', optimizedGameLoop, {
    dependsOn: ['gameState'],
    priority: 15
  });

  // Initialize performance monitor
  const performanceMonitor = new PerformanceMonitor();
  global.performanceMonitor = performanceMonitor;
  systemRegistry.register('performance', performanceMonitor, { priority: 16 });

  return { optimizedGameLoop, performanceMonitor };
}

module.exports = { setupGameLoop };
