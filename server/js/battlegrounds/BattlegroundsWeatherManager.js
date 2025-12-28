/**
 * BattlegroundsWeatherManager - Manages randomized weather for battleground matches
 * Battlegrounds use the normal game world's tempus and day/night cycle but have their own randomized weather
 */

class BattlegroundsWeatherManager {
  constructor() {
    this.matchWeather = {}; // {matchId: {type: string, intensity: number, duration: number, endTime: number}}
    this.weatherTypes = ['clear', 'rain', 'storm', 'snow', 'fog']; // Available weather types
    this.weatherUpdateInterval = null;
    this.weatherUpdateIntervalMs = 60000; // Update weather every minute (check for changes)
    this.minWeatherDuration = 120000; // Minimum weather duration: 2 minutes
    this.maxWeatherDuration = 600000; // Maximum weather duration: 10 minutes
  }

  /**
   * Initialize weather for a match
   * @param {string} matchId - Match ID
   */
  initMatchWeather(matchId) {
    if (!matchId) return;

    // Start with clear weather, then randomize
    const initialWeather = this.getRandomWeather();
    this.matchWeather[matchId] = {
      type: initialWeather.type,
      intensity: initialWeather.intensity,
      duration: initialWeather.duration,
      endTime: Date.now() + initialWeather.duration
    };

    console.log(`Initialized weather for match ${matchId}: ${initialWeather.type} (intensity: ${initialWeather.intensity})`);
    
    // Broadcast initial weather to match participants
    this.broadcastWeatherUpdate(matchId);
  }

  /**
   * Get random weather
   * @returns {object} Weather object with type, intensity, and duration
   */
  getRandomWeather() {
    // Weighted random selection (clear weather is most common)
    const weights = {
      'clear': 40,   // 40% chance
      'rain': 25,    // 25% chance
      'storm': 15,   // 15% chance
      'snow': 10,    // 10% chance
      'fog': 10      // 10% chance
    };

    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedType = 'clear';
    for (const [type, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        selectedType = type;
        break;
      }
    }

    // Random intensity (0.0 to 1.0)
    const intensity = Math.random() * 0.5 + 0.5; // 0.5 to 1.0 (avoid too weak weather)

    // Random duration
    const duration = this.minWeatherDuration + Math.random() * (this.maxWeatherDuration - this.minWeatherDuration);

    return {
      type: selectedType,
      intensity: intensity,
      duration: duration
    };
  }

  /**
   * Start weather update monitoring
   */
  startWeatherUpdates() {
    if (this.weatherUpdateInterval) {
      clearInterval(this.weatherUpdateInterval);
    }

    this.weatherUpdateInterval = setInterval(() => {
      this.updateWeather();
    }, this.weatherUpdateIntervalMs);

    console.log('Started battlegrounds weather update monitoring');
  }

  /**
   * Stop weather update monitoring
   */
  stopWeatherUpdates() {
    if (this.weatherUpdateInterval) {
      clearInterval(this.weatherUpdateInterval);
      this.weatherUpdateInterval = null;
    }
    console.log('Stopped battlegrounds weather update monitoring');
  }

  /**
   * Update weather for all active matches
   */
  updateWeather() {
    const now = Date.now();

    for (const matchId in this.matchWeather) {
      const weather = this.matchWeather[matchId];
      
      // Check if current weather has expired
      if (now >= weather.endTime) {
        // Change to new random weather
        const newWeather = this.getRandomWeather();
        weather.type = newWeather.type;
        weather.intensity = newWeather.intensity;
        weather.duration = newWeather.duration;
        weather.endTime = now + newWeather.duration;

        console.log(`Weather changed for match ${matchId}: ${newWeather.type} (intensity: ${newWeather.intensity})`);
        
        // Broadcast weather change to match participants
        this.broadcastWeatherUpdate(matchId);
      }
    }
  }

  /**
   * Get current weather for a match
   * @param {string} matchId - Match ID
   * @returns {object|null} Current weather object or null
   */
  getMatchWeather(matchId) {
    return this.matchWeather[matchId] || null;
  }

  /**
   * Broadcast weather update to all participants in a match
   * @param {string} matchId - Match ID
   */
  broadcastWeatherUpdate(matchId) {
    if (!global.battlegroundsMatchManager) return;

    const match = global.battlegroundsMatchManager.getMatch(matchId);
    if (!match || !match.participants) return;

    const weather = this.matchWeather[matchId];
    if (!weather) return;

    const message = JSON.stringify({
      msg: 'battlegroundsWeatherUpdate',
      matchId: matchId,
      weather: {
        type: weather.type,
        intensity: weather.intensity,
        remainingTime: Math.max(0, weather.endTime - Date.now())
      }
    });

    match.participants.forEach(participant => {
      const socket = global.SOCKET_LIST[participant.id];
      if (socket) {
        try {
          socket.write(message);
        } catch (e) {
          console.error(`Error broadcasting weather update to participant ${participant.id}:`, e);
        }
      }
    });
  }

  /**
   * Clean up weather for a match
   * @param {string} matchId - Match ID
   */
  cleanupMatchWeather(matchId) {
    if (this.matchWeather[matchId]) {
      delete this.matchWeather[matchId];
      console.log(`Cleaned up weather for match ${matchId}`);
    }
  }

  /**
   * Get weather info for client (includes tempus from main world)
   * @param {string} matchId - Match ID
   * @returns {object|null} Weather info with tempus
   */
  getWeatherInfo(matchId) {
    const weather = this.matchWeather[matchId];
    if (!weather) return null;

    // Include tempus from main world (battlegrounds use main world's day/night cycle)
    const tempus = global.tempus || global.gameState?.tempus || 0;

    return {
      type: weather.type,
      intensity: weather.intensity,
      remainingTime: Math.max(0, weather.endTime - Date.now()),
      tempus: tempus // Day/night cycle from main world
    };
  }
}

module.exports = BattlegroundsWeatherManager;



