/**
 * WeatherRenderer - Manages weather rendering (rain, lightning)
 * 
 * Extracted from client.js for better organization.
 */

class WeatherRenderer {
  constructor() {
    this.rainParticles = [];
    this.maxRainParticles = 500;
    this.lightningTimer = 0;
    this.lightningFlash = false;
  }

  /**
   * Update rain particle system
   * @param {object} weatherEffects - Weather effects data
   * @param {number} WIDTH - Canvas width
   */
  updateRain(weatherEffects, WIDTH) {
    if (!weatherEffects || !weatherEffects.storm || !weatherEffects.storm.active) {
      this.rainParticles = [];
      return;
    }

    const targetParticleCount = Math.floor(weatherEffects.storm.intensity * this.maxRainParticles);

    // Spawn particles across entire screen
    while (this.rainParticles.length < targetParticleCount) {
      this.rainParticles.push({
        x: Math.random() * WIDTH,
        y: -10,
        speed: 15 + Math.random() * 10,
        length: 20 + Math.random() * 10
      });
    }

    // Remove excess particles
    if (this.rainParticles.length > targetParticleCount) {
      this.rainParticles.length = targetParticleCount;
    }

    // Update particle positions
    for (let i = this.rainParticles.length - 1; i >= 0; i--) {
      const particle = this.rainParticles[i];
      particle.y += particle.speed;

      // Remove if off screen
      if (particle.y > (typeof HEIGHT !== 'undefined' ? HEIGHT : 600)) {
        this.rainParticles.splice(i, 1);
      }
    }

    // Lightning logic (only when close to storm center)
    if (weatherEffects.storm.intensity > 0.7) {
      this.lightningTimer++;
      if (this.lightningTimer > 180 + Math.random() * 120) { // Random 3-5 seconds
        this.lightningFlash = true;
        this.lightningTimer = 0;
        setTimeout(() => {
          this.lightningFlash = false;
        }, 100); // 100ms flash
      }
    }
  }

  /**
   * Render rain particles
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  renderRain(ctx) {
    if (this.rainParticles.length === 0) return;

    // Rain is rendered on the main canvas which is already zoomed,
    // but particles are in screen-space coordinates, so they render correctly
    ctx.strokeStyle = 'rgba(180, 180, 220, 0.8)'; // More opaque, slightly darker
    ctx.lineWidth = 2; // Thicker rain lines

    for (const particle of this.rainParticles) {
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x, particle.y + particle.length);
      ctx.stroke();
    }
  }

  /**
   * Check if lightning should flash
   * @returns {boolean} Should flash
   */
  shouldFlash() {
    return this.lightningFlash;
  }

  /**
   * Reset weather effects
   */
  reset() {
    this.rainParticles = [];
    this.lightningTimer = 0;
    this.lightningFlash = false;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.WeatherRenderer = WeatherRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeatherRenderer;
}
