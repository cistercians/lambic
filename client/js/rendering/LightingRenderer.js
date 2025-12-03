/**
 * LightingRenderer - Manages day/night lighting, weather transitions, and dark layers
 * 
 * Extracted from client.js for better organization.
 */

class LightingRenderer {
  constructor() {
    // Lighting transition state
    this.lightingTransition = {
      previousTempus: null,
      currentTempus: null,
      startTime: null,
      transitionDuration: 1500, // 1.5 second transition
      previousColor: null,
      currentColor: null,
      isInWeather: false,
      lastWeatherColor: null,
      weatherEndingTriggered: false,
      weatherJustEnded: false
    };

    // Dark layer canvas for caves/cellars
    this.darkLayerCanvas = null;
    this.darkLayerCtx = null;
  }

  /**
   * Initialize dark layer canvas for caves/cellars
   * @param {CanvasRenderingContext2D} lightingCtx - Lighting canvas context
   */
  initDarkLayerCanvas(lightingCtx) {
    if (!this.darkLayerCanvas) {
      this.darkLayerCanvas = document.createElement('canvas');
      this.darkLayerCanvas.width = lightingCtx.canvas.width;
      this.darkLayerCanvas.height = lightingCtx.canvas.height;
      this.darkLayerCtx = this.darkLayerCanvas.getContext('2d');
    }
    // Ensure canvas size matches lighting canvas (in case it was resized)
    if (this.darkLayerCanvas.width != lightingCtx.canvas.width || 
        this.darkLayerCanvas.height != lightingCtx.canvas.height) {
      this.darkLayerCanvas.width = lightingCtx.canvas.width;
      this.darkLayerCanvas.height = lightingCtx.canvas.height;
    }
  }

  /**
   * Parse RGBA color string to object
   * @param {string} rgbaString - RGBA color string
   * @returns {object|null} Parsed color object or null
   */
  parseRGBA(rgbaString) {
    const match = rgbaString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (!match) return null;
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: parseFloat(match[4])
    };
  }

  /**
   * Interpolate between two RGBA colors
   * @param {string} color1 - First color (RGBA string)
   * @param {string} color2 - Second color (RGBA string)
   * @param {number} t - Interpolation factor (0-1)
   * @returns {string} Interpolated color (RGBA string)
   */
  interpolateColors(color1, color2, t) {
    const rgba1 = this.parseRGBA(color1);
    const rgba2 = this.parseRGBA(color2);

    if (!rgba1 || !rgba2) return color1;

    const tClamped = Math.max(0, Math.min(1, t));
    const r = Math.round(rgba1.r + (rgba2.r - rgba1.r) * tClamped);
    const g = Math.round(rgba1.g + (rgba2.g - rgba1.g) * tClamped);
    const b = Math.round(rgba1.b + (rgba2.b - rgba1.b) * tClamped);
    const a = rgba1.a + (rgba2.a - rgba1.a) * tClamped;

    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * Get lighting color for a given tempus and z-layer
   * @param {string} tempus - Current time period
   * @param {number} z - Z-layer
   * @param {boolean} hasFirepit - Whether there's a firepit
   * @returns {string} Lighting color (RGBA string)
   */
  getLightingColorForTempus(tempus, z, hasFirepit) {
    // Inside buildings (z 1 or 2)
    if (z == 1 || z == 2) {
      if (hasFirepit) {
        return "rgba(224, 104, 0, 0.4)"; // fire
      }

      // Night hours
      if (tempus == 'IX.p' || tempus == 'X.p' || tempus == 'XI.p' || tempus == 'XII.a' ||
        tempus == 'I.a' || tempus == 'II.a' || tempus == 'III.a') {
        return "rgba(5, 5, 30, 0.9)"; // night
      } else if (tempus == 'IV.a') {
        return "rgba(5, 5, 30, 0.8)"; // early hours
      } else if (tempus == 'V.a') {
        return "rgba(5, 5, 30, 0.6)"; // early morning
      } else if (tempus == 'VI.a') {
        return "rgba(244, 214, 65, 0.1)"; // sunrise
      } else if (tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a' ||
        tempus == 'X.a' || tempus == 'XI.a' || tempus == 'XII.p' ||
        tempus == 'I.p' || tempus == 'II.p' || tempus == 'III.p') {
        return "rgba(0, 0, 0, 0)"; // morning + daytime
      } else if (tempus == 'IV.p') {
        return "rgba(255, 204, 22, 0.07)"; // afternoon
      } else if (tempus == 'V.p') {
        return "rgba(255, 204, 22, 0.1)"; // late afternoon
      } else if (tempus == 'VI.p') {
        return "rgba(232, 112, 0, 0.25)"; // sunset
      } else if (tempus == 'VII.p') {
        return "rgba(5, 5, 30, 0.4)"; // twilight
      } else if (tempus == 'VIII.p') {
        return "rgba(5, 5, 30, 0.7)"; // evening
      }
    }

    // Overworld (z == 0)
    if (z == 0) {
      if (tempus == 'IX.p' || tempus == 'X.p' || tempus == 'XI.p' || tempus == 'XII.a' ||
        tempus == 'I.a' || tempus == 'II.a' || tempus == 'III.a') {
        return "rgba(5, 5, 30, 0.9)"; // night
      } else if (tempus == 'IV.a') {
        return "rgba(5, 5, 30, 0.8)"; // early hours
      } else if (tempus == 'V.a') {
        return "rgba(5, 5, 30, 0.6)"; // early morning
      } else if (tempus == 'VI.a') {
        return "rgba(244, 214, 65, 0.1)"; // sunrise
      } else if (tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a' ||
        tempus == 'X.a' || tempus == 'XI.a' || tempus == 'XII.p' ||
        tempus == 'I.p' || tempus == 'II.p' || tempus == 'III.p') {
        return "rgba(0, 0, 0, 0)"; // morning + daytime
      } else if (tempus == 'IV.p') {
        return "rgba(255, 204, 22, 0.07)"; // afternoon
      } else if (tempus == 'V.p') {
        return "rgba(255, 204, 22, 0.1)"; // late afternoon
      } else if (tempus == 'VI.p') {
        return "rgba(232, 112, 0, 0.25)"; // sunset
      } else if (tempus == 'VII.p') {
        return "rgba(5, 5, 30, 0.4)"; // twilight
      } else if (tempus == 'VIII.p') {
        return "rgba(5, 5, 30, 0.7)"; // evening
      }
    }

    // Underworld (z == -1)
    if (z == -1) {
      return "rgba(0, 0, 0, 0.95)"; // darkness
    }

    // Cellar (z == -2)
    if (z == -2) {
      return "rgba(0, 0, 0, 0.85)"; // darkness
    }

    // Underwater (z == -3)
    if (z == -3) {
      return "rgba(0, 48, 99, 0.9)"; // underwater
    }

    return "rgba(0, 0, 0, 0)"; // default
  }

  /**
   * Render lighting effects (day/night, weather transitions, dark layers)
   * @param {object} config - Configuration object
   * @param {CanvasRenderingContext2D} config.lighting - Lighting canvas context
   * @param {function} config.getCurrentZ - Function to get current z-layer
   * @param {function} config.getCameraPosition - Function to get camera position
   * @param {function} config.getWeatherEffects - Function to get weather effects
   * @param {function} config.hasFire - Function to check for firepit
   * @param {string} config.tempus - Current time period
   * @param {boolean} config.nightfall - Whether it's nightfall
   * @param {boolean} config.lightningFlash - Whether lightning is flashing
   * @param {number} config.currentZoom - Current zoom level
   * @param {number} config.WIDTH - Canvas width
   * @param {number} config.HEIGHT - Canvas height
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   */
  render(config) {
    const {
      lighting,
      getCurrentZ,
      getCameraPosition,
      getWeatherEffects,
      hasFire,
      tempus,
      nightfall,
      lightningFlash,
      currentZoom,
      WIDTH,
      HEIGHT,
      selfId,
      PlayerList
    } = config;

    // Get current z-layer (works for login camera, god mode, and normal play)
    const z = getCurrentZ();

    // Apply zoom transform to lighting canvas (matching main canvas)
    lighting.save();
    lighting.translate(WIDTH / 2, HEIGHT / 2);
    lighting.scale(currentZoom, currentZoom);
    lighting.translate(-WIDTH / 2, -HEIGHT / 2);

    // Calculate effective dimensions for zoom
    let effectiveWidth = WIDTH / currentZoom;
    let effectiveHeight = HEIGHT / currentZoom;
    const offsetX = (WIDTH - effectiveWidth) / 2;
    const offsetY = (HEIGHT - effectiveHeight) / 2;

    // Ghost mode overrides all other lighting effects
    if (selfId && PlayerList[selfId] && PlayerList[selfId].ghost) {
      lighting.clearRect(offsetX, offsetY, effectiveWidth, effectiveHeight);
      lighting.fillStyle = "rgba(255, 255, 255, 0.65)"; // Very bright, washed out white
      lighting.fillRect(offsetX, offsetY, effectiveWidth, effectiveHeight);
      lighting.restore(); // Restore transform before returning
      return; // Skip all other lighting effects
    }

    // Weather effects override normal day/night lighting (only on z=0)
    if (z === 0) {
      const cameraPos = getCameraPosition();
      const weatherEffects = getWeatherEffects(cameraPos.x, cameraPos.y, z);

      if (weatherEffects && 
          ((weatherEffects.fog && weatherEffects.fog.active) || 
           (weatherEffects.storm && weatherEffects.storm.active))) {
        lighting.clearRect(offsetX, offsetY, effectiveWidth, effectiveHeight);

        // Determine weather lighting color
        let weatherColor = null;

        // Fog (only during day)
        if (weatherEffects.fog && weatherEffects.fog.active && !nightfall) {
          const fogAlpha = weatherEffects.fog.intensity * 0.7;
          weatherColor = `rgba(150, 150, 150, ${fogAlpha})`; // Darker grey fog
        }

        // Storm (only during day) - overrides fog if both present
        if (weatherEffects.storm && weatherEffects.storm.active && !nightfall) {
          const stormAlpha = weatherEffects.storm.intensity * 0.65;
          weatherColor = `rgba(80, 80, 100, ${stormAlpha})`; // Grey overcast color
        }

        // If weather should apply, transition smoothly to weather lighting
        if (weatherColor) {
          // Detect if we're transitioning to/from weather
          const wasInWeather = this.lightingTransition.isInWeather || false;

          // If this is a new weather event
          if (!wasInWeather) {
            // Start transition from current color to weather color
            this.lightingTransition.previousColor = this.lightingTransition.currentColor || 
              this.getLightingColorForTempus(tempus, z, false);
            this.lightingTransition.currentColor = weatherColor;
            this.lightingTransition.startTime = Date.now();
            this.lightingTransition.isInWeather = true;
            this.lightingTransition.lastWeatherColor = weatherColor;
            this.lightingTransition.weatherEndingTriggered = false; // Reset for next time
          } else if (this.lightingTransition.currentColor !== weatherColor) {
            // Weather intensity changed - update target
            this.lightingTransition.currentColor = weatherColor;
            this.lightingTransition.lastWeatherColor = weatherColor;
          }

          // Calculate transition progress
          const elapsed = Date.now() - this.lightingTransition.startTime;
          const t = Math.min(elapsed / this.lightingTransition.transitionDuration, 1);

          // Interpolate between previous and weather color
          const finalColor = this.interpolateColors(
            this.lightingTransition.previousColor,
            this.lightingTransition.currentColor,
            t
          );

          lighting.clearRect(offsetX, offsetY, effectiveWidth, effectiveHeight);
          lighting.fillStyle = finalColor;
          lighting.fillRect(offsetX, offsetY, effectiveWidth, effectiveHeight);
          lighting.restore(); // Restore transform before returning
          return; // Skip normal day/night lighting
        } else if (this.lightingTransition.isInWeather && !this.lightingTransition.weatherEndingTriggered) {
          // Weather just ended (or nightfall during storm) - transition back to normal
          this.lightingTransition.previousColor = this.lightingTransition.lastWeatherColor || 
            this.lightingTransition.currentColor;
          this.lightingTransition.currentColor = this.getLightingColorForTempus(tempus, z, false);
          this.lightingTransition.startTime = Date.now();
          this.lightingTransition.isInWeather = false;
          this.lightingTransition.lastWeatherColor = null;
          this.lightingTransition.weatherJustEnded = true; // Flag to prevent tempus code from resetting
          this.lightingTransition.weatherEndingTriggered = true; // Only trigger once
          // Don't return - continue to normal lighting with transition
        }
      }
    }

    // Get hasFire status for building interiors
    let hasFirepit = false;
    if ((z == 1 || z == 2) && selfId && PlayerList[selfId]) {
      const player = PlayerList[selfId];
      hasFirepit = hasFire(player.z, player.x, player.y);
    }

    // Detect if tempus changed and start transition (but not if weather just ended)
    if (!this.lightingTransition.weatherJustEnded && 
      (this.lightingTransition.currentTempus !== tempus || !this.lightingTransition.startTime)) {
      this.lightingTransition.previousTempus = this.lightingTransition.currentTempus;
      this.lightingTransition.currentTempus = tempus;
      this.lightingTransition.previousColor = this.lightingTransition.currentColor || 
        this.getLightingColorForTempus(tempus, z, hasFirepit);
      this.lightingTransition.startTime = Date.now();
    }

    // Get target color
    const targetColor = this.getLightingColorForTempus(tempus, z, hasFirepit);

    // Only update currentColor if we're not in the middle of a weather transition
    if (!this.lightingTransition.weatherJustEnded) {
      this.lightingTransition.currentColor = targetColor;
    }

    // Calculate transition progress (0 to 1)
    const elapsed = Date.now() - this.lightingTransition.startTime;
    const t = Math.min(elapsed / this.lightingTransition.transitionDuration, 1);

    // Use interpolated color if transitioning
    let finalColor;
    if (t < 1 && this.lightingTransition.previousColor && this.lightingTransition.currentColor &&
      this.lightingTransition.previousColor !== this.lightingTransition.currentColor) {
      finalColor = this.interpolateColors(
        this.lightingTransition.previousColor,
        this.lightingTransition.currentColor,
        t
      );
    } else {
      finalColor = targetColor;
      // Transition complete - clear weather ending flags
      if (this.lightingTransition.weatherJustEnded) {
        this.lightingTransition.weatherJustEnded = false;
        this.lightingTransition.weatherEndingTriggered = false;
      }
    }

    // Apply the color - adjust size based on zoom so it covers entire viewport
    effectiveWidth = WIDTH / currentZoom;
    effectiveHeight = HEIGHT / currentZoom;

    lighting.clearRect(offsetX, offsetY, effectiveWidth, effectiveHeight);

    // Handle special z-layer effects - draw orange base layer FIRST for caves/cellars
    if (z == -1 || z == -2) {
      // Initialize dark layer canvas for caves/cellars
      this.initDarkLayerCanvas(lighting);

      // Draw orange base layer on lighting canvas (this stays visible)
      lighting.fillStyle = "rgba(224, 104, 0, 0.3)"; // orange glow for caves/cellars (base layer)
      lighting.fillRect(offsetX, offsetY, effectiveWidth, effectiveHeight);

      // Draw dark layer on separate canvas (light sources will cut holes in this)
      // Draw WITHOUT zoom transform - it will be scaled when composited onto lighting canvas
      this.darkLayerCtx.clearRect(0, 0, this.darkLayerCanvas.width, this.darkLayerCanvas.height);
      this.darkLayerCtx.fillStyle = finalColor;
      this.darkLayerCtx.fillRect(0, 0, WIDTH, HEIGHT);

      // Don't draw dark layer directly on lighting canvas for caves/cellars
      // It will be drawn after light sources cut holes in it
    } else {
      // For other layers, draw dark layer directly on lighting canvas
      lighting.fillStyle = finalColor;
      lighting.fillRect(offsetX, offsetY, effectiveWidth, effectiveHeight);
    }

    // Lightning flash (render on top of day/night overlay)
    if (lightningFlash && z === 0) {
      lighting.fillStyle = 'rgba(255, 255, 255, 0.6)';
      lighting.fillRect(offsetX, offsetY, effectiveWidth, effectiveHeight);
    }

    // Restore lighting canvas transform
    lighting.restore();
  }

  /**
   * Get dark layer canvas (for compositing after light sources)
   * @returns {HTMLCanvasElement|null} Dark layer canvas or null
   */
  getDarkLayerCanvas() {
    return this.darkLayerCanvas;
  }

  /**
   * Get dark layer context (for compositing after light sources)
   * @returns {CanvasRenderingContext2D|null} Dark layer context or null
   */
  getDarkLayerCtx() {
    return this.darkLayerCtx;
  }
}

// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightingRenderer;
} else {
  window.LightingRenderer = LightingRenderer;
}
