/**
 * CanvasInitializer - Initializes all canvas contexts and renderers
 * 
 * Extracted from client.js for better organization.
 */

class CanvasInitializer {
  constructor() {
    this.ctx = null;
    this.lighting = null;
    this.cursorOverlayCanvas = null;
    this.cursorOverlayCtx = null;
    this.lightingRenderer = null;
    this.lightSourceRenderer = null;
    this.mapRenderer = null;
    this.initialized = false;
  }

  /**
   * Initialize all canvas contexts and renderers
   * @param {object} config - Configuration object
   */
  init(config) {
    if (this.initialized) {
      console.warn('[CanvasInitializer] Already initialized');
      return;
    }

    // Get canvas elements
    const ctxCanvas = document.getElementById('ctx');
    const lightingCanvas = document.getElementById('lighting');
    const cursorOverlayCanvas = document.getElementById('cursor-overlay');

    if (!ctxCanvas || !lightingCanvas) {
      console.error('[CanvasInitializer] Required canvas elements not found');
      return;
    }

    // Set canvas size to match window size - CRITICAL: Must be set before getting context
    // Use setTimeout to ensure window dimensions are available
    const setCanvasSize = () => {
      const WIDTH = window.innerWidth || 800;
      const HEIGHT = window.innerHeight || 600;
      
      // Force set canvas size - explicitly set to override any defaults
      if (ctxCanvas) {
        ctxCanvas.width = WIDTH;
        ctxCanvas.height = HEIGHT;
        // Also set style to ensure proper display
        ctxCanvas.style.width = WIDTH + 'px';
        ctxCanvas.style.height = HEIGHT + 'px';
      }
      
      if (lightingCanvas) {
        lightingCanvas.width = WIDTH;
        lightingCanvas.height = HEIGHT;
        lightingCanvas.style.width = WIDTH + 'px';
        lightingCanvas.style.height = HEIGHT + 'px';
      }
      
      if (cursorOverlayCanvas) {
        cursorOverlayCanvas.width = WIDTH;
        cursorOverlayCanvas.height = HEIGHT;
        cursorOverlayCanvas.style.width = WIDTH + 'px';
        cursorOverlayCanvas.style.height = HEIGHT + 'px';
      }
    };
    
    // Set immediately if possible
    setCanvasSize();
    
    // Also set on next frame to ensure it sticks
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(setCanvasSize);
    }

    // Initialize contexts
    this.ctx = ctxCanvas.getContext('2d');
    this.lighting = lightingCanvas.getContext('2d');
    this.cursorOverlayCanvas = cursorOverlayCanvas;
    this.cursorOverlayCtx = cursorOverlayCanvas ? cursorOverlayCanvas.getContext('2d') : null;

    // Set font
    if (this.ctx) {
      this.ctx.font = '30px Arial';
    }

    // Hide default cursor on canvas
    if (ctxCanvas) {
      ctxCanvas.style.cursor = 'none';
      ctxCanvas.style.setProperty('cursor', 'none', 'important');
    }

    // Initialize renderers (order matters: LightingRenderer must be created before LightSourceRenderer)
    if (typeof LightingRenderer !== 'undefined') {
      this.lightingRenderer = new LightingRenderer();
    }

    if (typeof LightSourceRenderer !== 'undefined') {
      // Pass lightingRenderer reference so LightSourceRenderer can access shared dark layer canvas
      this.lightSourceRenderer = new LightSourceRenderer(this.lightingRenderer);
    }

    if (typeof MapRenderer !== 'undefined') {
      this.mapRenderer = new MapRenderer();
      // Expose to global scope
      if (typeof window !== 'undefined') {
        window.mapRenderer = this.mapRenderer;
      }
    }

    // Expose contexts to global scope for backward compatibility
    if (typeof window !== 'undefined') {
      window.ctx = this.ctx;
      window.lighting = this.lighting;
      window.cursorOverlayCanvas = this.cursorOverlayCanvas;
      window.cursorOverlayCtx = this.cursorOverlayCtx;
    }

    this.initialized = true;
  }

  /**
   * Get canvas context
   * @returns {CanvasRenderingContext2D|null} Context or null
   */
  getCtx() {
    return this.ctx;
  }

  /**
   * Get lighting context
   * @returns {CanvasRenderingContext2D|null} Context or null
   */
  getLighting() {
    return this.lighting;
  }

  /**
   * Get cursor overlay canvas
   * @returns {HTMLCanvasElement|null} Canvas or null
   */
  getCursorOverlayCanvas() {
    return this.cursorOverlayCanvas;
  }

  /**
   * Get cursor overlay context
   * @returns {CanvasRenderingContext2D|null} Context or null
   */
  getCursorOverlayCtx() {
    return this.cursorOverlayCtx;
  }

  /**
   * Get lighting renderer
   * @returns {LightingRenderer|null} Renderer or null
   */
  getLightingRenderer() {
    return this.lightingRenderer;
  }

  /**
   * Get light source renderer
   * @returns {LightSourceRenderer|null} Renderer or null
   */
  getLightSourceRenderer() {
    return this.lightSourceRenderer;
  }

  /**
   * Get map renderer
   * @returns {MapRenderer|null} Renderer or null
   */
  getMapRenderer() {
    return this.mapRenderer;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.CanvasInitializer = CanvasInitializer;
  window.canvasInitializer = new CanvasInitializer();
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasInitializer;
}

