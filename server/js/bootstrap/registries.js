function exposeRegistries({ systemRegistry, entityRegistry, dependencyInjector }) {
  // Expose registries globally for backward compatibility during transition
  // New code should use dependency injection, but existing code can still access via globals
  global.systemRegistry = systemRegistry;
  global.entityRegistry = entityRegistry;
  global.dependencyInjector = dependencyInjector;
}

function performSystemAudit({ systemRegistry, entityRegistry }) {
  // Perform comprehensive system audit - logs only in DEBUG mode
  const DEBUG = process.env.DEBUG;
  const stats = systemRegistry.getStats();
  const dependencyCheck = systemRegistry.verifyAllDependencies();

  // Check for systems that might not be initialized
  const systemsNeedingInit = [];
  const systemNames = systemRegistry.getSystemNames();

  for (const name of systemNames) {
    const system = systemRegistry.get(name);
    if (system && typeof system.initialize === 'function') {
      systemsNeedingInit.push(name);
    }
  }

  // Log only in DEBUG mode
  if (DEBUG) {
    console.log('\n========================================');
    console.log('System Registry Audit');
    console.log('========================================');
    console.log('Registered systems:', stats.totalSystems);
    console.log('Systems:', stats.systems.join(', '));
    console.log('Initialization order:', stats.initializationOrder.join(' -> '));

    if (!dependencyCheck.allValid) {
      console.error('Dependency issues found:');
      dependencyCheck.issues.forEach(issue => {
        console.error(`  - ${issue.system} is missing dependencies: ${issue.missing.join(', ')}`);
      });
    } else {
      console.log('All system dependencies satisfied');
    }

    if (systemsNeedingInit.length > 0) {
      console.log('Systems with initialize() methods:', systemsNeedingInit.join(', '));
    }

    if (entityRegistry) {
      console.log('EntityRegistry Stats:', JSON.stringify(entityRegistry.getStats(), null, 2));
    }
    console.log('========================================\n');
  }

  // Always log critical errors regardless of DEBUG
  if (!dependencyCheck.allValid) {
    console.error('[SystemAudit] Dependency issues:', dependencyCheck.issues.map(i => i.system).join(', '));
  }

  // Return audit results for programmatic checks
  return {
    allValid: dependencyCheck.allValid,
    dependencyIssues: dependencyCheck.issues,
    systemsNeedingInit,
    totalSystems: stats.totalSystems
  };
}

function validateCriticalSystems({ systemRegistry, entityRegistry }) {
  const criticalSystems = [
    'gameState',
    'tilemap',
    'entities',
    'gameLoop'
  ];

  const missingSystems = [];

  for (const systemName of criticalSystems) {
    const system = systemRegistry.get(systemName);
    if (!system) {
      missingSystems.push(systemName);
    } else if (typeof system.initialize === 'function') {
      // Check if system needs initialization
      // Note: Some systems initialize lazily, which is fine
    }
  }

  if (missingSystems.length > 0) {
    console.error(`❌ CRITICAL: Missing required systems: ${missingSystems.join(', ')}`);
    return false;
  }

  // Verify entity collections are registered
  if (entityRegistry) {
    const entityStats = entityRegistry.getStats();
    const requiredCollections = ['players', 'buildings', 'items'];
    const missingCollections = requiredCollections.filter(
      col => !entityStats.collections || !entityStats.collections.includes(col)
    );

    if (missingCollections.length > 0) {
      console.warn(`⚠️  Warning: Missing entity collections: ${missingCollections.join(', ')}`);
    }
  }

  return true;
}

module.exports = { exposeRegistries, performSystemAudit, validateCriticalSystems };
