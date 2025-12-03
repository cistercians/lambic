/**
 * CanvasManager - Manages canvas resizing and initialization
 * 
 * Extracted from client.js for better organization.
 */

class CanvasManager {
  constructor() {
    this.WIDTH = window.innerWidth;
    this.HEIGHT = window.innerHeight;
  }

  /**
   * Resize all canvases to match window size
   * @param {object} config - Configuration { viewport, tileSize }
   */
  resizeCanvas(config) {
    const { viewport, tileSize } = config || {};
    
    this.WIDTH = window.innerWidth;
    this.HEIGHT = window.innerHeight;
    
    const ctx_canvas = document.getElementById('ctx');
    const lighting_canvas = document.getElementById('lighting');
    const cursor_overlay_canvas = document.getElementById('cursor-overlay');
    
    if (ctx_canvas) {
      ctx_canvas.width = this.WIDTH;
      ctx_canvas.height = this.HEIGHT;
    }
    
    if (lighting_canvas) {
      lighting_canvas.width = this.WIDTH;
      lighting_canvas.height = this.HEIGHT;
    }
    
    if (cursor_overlay_canvas) {
      cursor_overlay_canvas.width = this.WIDTH;
      cursor_overlay_canvas.height = this.HEIGHT;
    }
    
    if (viewport) {
      viewport.screen = [this.WIDTH, this.HEIGHT];
    }

    // Update UI sizes based on tileSize
    if (tileSize > 0) {
      const skillsBar = document.getElementById('skills-bar');
      const chatMessagesContainer = document.getElementById('chat-messages-container');
      const chatInputWrapper = document.getElementById('chat-input-wrapper');

      const skillsBarHeight = tileSize * 1.1; // Reduced from 1.2
      const chatInputHeight = 50; // Fixed height for input

      if (skillsBar) {
        skillsBar.style.height = skillsBarHeight + 'px';
      }
      
      if (chatInputWrapper) {
        chatInputWrapper.style.height = chatInputHeight + 'px';
        chatInputWrapper.style.bottom = skillsBarHeight + 'px';
      }
      
      if (chatMessagesContainer) {
        chatMessagesContainer.style.height = (tileSize * 3) + 'px';
        chatMessagesContainer.style.bottom = (skillsBarHeight + chatInputHeight) + 'px';
      }
    }
  }

  /**
   * Get current canvas dimensions
   * @returns {object} { width, height }
   */
  getDimensions() {
    return {
      width: this.WIDTH,
      height: this.HEIGHT
    };
  }

  /**
   * Initialize resize listeners
   * @param {function} onResize - Callback function
   */
  initResizeListeners(onResize) {
    window.addEventListener('load', () => {
      if (onResize) onResize();
    });

    window.addEventListener('resize', () => {
      if (onResize) onResize();
    });
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.CanvasManager = CanvasManager;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasManager;
}
