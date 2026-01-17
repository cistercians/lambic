async function initializeWorld({ MapGenerationCLI, gameState }) {
  try {
    // Run CLI to get user selections and generate map
    const result = await MapGenerationCLI.run();

    const world = result.worldMaps;
    const caveEntrances = result.entrances || [];

    global.caveEntrances = caveEntrances;
    gameState.initializeWorld(world);

    return { world, caveEntrances };
  } catch (error) {
    console.error('Error initializing world:', error);
    throw error;
  }
}

module.exports = { initializeWorld };
