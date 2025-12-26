/**
 * ArrowRenderer - Handles rendering of Arrow entities
 * 
 * Extracted from client.js for better organization.
 */

class ArrowRenderer {
  constructor() {
    // Arrow direction mapping: angle ranges to arrow image indices
    this.angleRanges = [
      { min: -120, max: -60, image: 'arrow1' },
      { min: -60, max: -30, image: 'arrow2' },
      { min: -30, max: 30, image: 'arrow3' },
      { min: 30, max: 60, image: 'arrow4' },
      { min: 60, max: 120, image: 'arrow5' },
      { min: 120, max: 150, image: 'arrow6' },
      { min: 150, max: -150, image: 'arrow7' }, // Wrap around
      { default: true, image: 'arrow8' } // Default for angles not in other ranges
    ];
  }

  /**
   * Get arrow image for angle
   * @param {number} angle - Arrow angle
   * @param {object} Img - Image assets
   * @returns {Image|null} Arrow image or null
   */
  getArrowImage(angle, Img) {
    // Handle wrap-around case (150 to -150)
    for (let i = 0; i < this.angleRanges.length; i++) {
      const range = this.angleRanges[i];
      
      if (range.default) {
        continue; // Skip default, check it last
      }
      
      // Handle wrap-around case
      if (range.min > range.max) {
        // Wrap-around: angle >= min OR angle <= max
        if (angle >= range.min || angle <= range.max) {
          return Img[range.image];
        }
      } else {
        // Normal range
        if (angle >= range.min && angle < range.max) {
          return Img[range.image];
        }
      }
    }
    
    // Default case
    const defaultRange = this.angleRanges.find(r => r.default);
    return defaultRange ? Img[defaultRange.image] : null;
  }

  /**
   * Render an arrow entity
   * @param {object} arrow - Arrow entity
   * @param {object} ctx - Canvas context
   * @param {object} config - Configuration { cameraPos, WIDTH, HEIGHT, tileSize, Img }
   */
  render(arrow, ctx, config) {
    const { cameraPos, WIDTH, HEIGHT, tileSize, Img } = config;
    
    // Calculate screen position
    const x = arrow.x - cameraPos.x + WIDTH / 2;
    const y = arrow.y - cameraPos.y + HEIGHT / 2;
    
    // Get arrow image based on angle
    const arrowImg = this.getArrowImage(arrow.angle, Img);
    if (arrowImg) {
      // Arrows should be half the size of a tile
      const arrowSize = tileSize / 2;
      ctx.drawImage(arrowImg, x, y, arrowSize, arrowSize);
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ArrowRenderer = ArrowRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArrowRenderer;
}
