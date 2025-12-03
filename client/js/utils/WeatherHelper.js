/**
 * WeatherHelper - Helper functions for weather effects
 * 
 * Extracted from client.js for better organization.
 */

class WeatherHelper {
  constructor() {
    // Dependencies would be injected
  }

  /**
   * Get weather effects at a specific position
   * @param {number} playerX - Player X coordinate
   * @param {number} playerY - Player Y coordinate
   * @param {number} playerZ - Player Z coordinate
   * @param {object} config - Configuration { WeatherList, mapSize, tileSize }
   * @returns {object|null} Weather effects or null
   */
  getWeatherEffects(playerX, playerY, playerZ, config) {
    const { WeatherList, mapSize, tileSize } = config;

    if (playerZ !== 0) {
      return null; // Weather only affects z=0
    }

    const effects = {
      fog: { active: false, intensity: 0 },
      storm: { active: false, intensity: 0, distance: Infinity }
    };

    // Calculate radii based on map size (scales automatically)
    const mapDiagonal = mapSize * tileSize;

    // Check all weather systems
    for (const id in WeatherList) {
      const weather = WeatherList[id];
      const dx = weather.x - playerX;
      const dy = weather.y - playerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (weather.weatherType === 'fog') {
        // Fog radius: ~4% of map diagonal for outer, ~1.5% for inner
        const fogOuterRadius = mapDiagonal * 0.04;
        const fogInnerRadius = mapDiagonal * 0.015;

        if (distance < fogOuterRadius) {
          let fogIntensity = 1.0 - (distance - fogInnerRadius) / (fogOuterRadius - fogInnerRadius);
          fogIntensity = Math.max(0, Math.min(1, fogIntensity));
          fogIntensity *= weather.intensity; // Apply weather's base intensity
          effects.fog.intensity = Math.max(effects.fog.intensity, fogIntensity);
          effects.fog.active = true;
        }
      } else if (weather.weatherType === 'storm') {
        // Storm radius: ~20% of map area (27% of diagonal for outer radius)
        const stormOuterRadius = mapDiagonal * 0.27; // ~20% map coverage
        const stormInnerRadius = mapDiagonal * 0.08; // Center with full intensity

        if (distance < stormOuterRadius) {
          let stormIntensity = 1.0 - (distance - stormInnerRadius) / (stormOuterRadius - stormInnerRadius);
          stormIntensity = Math.max(0, Math.min(1, stormIntensity));
          stormIntensity *= weather.intensity;

          if (stormIntensity > effects.storm.intensity) {
            effects.storm.intensity = stormIntensity;
            effects.storm.distance = distance;
            effects.storm.active = true;
          }
        }
      }
    }

    return effects;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.WeatherHelper = WeatherHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeatherHelper;
}
