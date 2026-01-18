/**
 * LightSourceRenderer - Handles rendering of dynamic light sources (torches, fires, etc.)
 * 
 * Extracted from client.js - consolidates light source rendering logic
 */

class LightSourceRenderer {
  constructor(lightingRenderer = null) {
    // Canvas management
    this.lightTempCanvas = null;
    this.lightTempCtx = null;
    // Reference to LightingRenderer for accessing shared dark layer canvas
    // (dark layer is owned by LightingRenderer, not created here)
    this.lightingRenderer = lightingRenderer;
  }

  /**
   * Initialize reusable temp canvas for light source gradient masks
   * @param {CanvasRenderingContext2D} lighting - Lighting canvas context
   */
  initLightTempCanvas(lighting) {
    if (!this.lightTempCanvas) {
      this.lightTempCanvas = document.createElement('canvas');
      this.lightTempCanvas.width = lighting.canvas.width;
      this.lightTempCanvas.height = lighting.canvas.height;
      this.lightTempCtx = this.lightTempCanvas.getContext('2d');
    }
    // Ensure canvas size matches lighting canvas (in case it was resized)
    if (this.lightTempCanvas.width !== lighting.canvas.width || 
        this.lightTempCanvas.height !== lighting.canvas.height) {
      this.lightTempCanvas.width = lighting.canvas.width;
      this.lightTempCanvas.height = lighting.canvas.height;
    }
  }

  /**
   * Get dark layer canvas/context from LightingRenderer
   * Dark layer is owned by LightingRenderer, not this renderer
   * @returns {Object} {canvas, ctx} or null if not available
   */
  getDarkLayerFromLightingRenderer() {
    if (this.lightingRenderer) {
      return {
        canvas: this.lightingRenderer.getDarkLayerCanvas(),
        ctx: this.lightingRenderer.getDarkLayerCtx()
      };
    }
    return null;
  }

  /**
   * Render light glow effect on main canvas AND cutout on target canvas
   * Uses the EXACT same coordinates and system for both - they will always align
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} radius - Light radius
   * @param {number} env - Environment factor
   * @param {CanvasRenderingContext2D} ctx - Main canvas context (has zoom transform)
   * @param {number} flicker - Flicker value
   * @param {CanvasRenderingContext2D} targetCtx - Target canvas for cutout (lighting or darkLayer)
   * @param {number} currentZoom - Current zoom level
   * @param {number} WIDTH - Canvas width
   * @param {number} HEIGHT - Canvas height
   * @param {boolean} isDarkLayer - True if target is dark layer (no zoom), false if lighting canvas (has zoom)
   */
  illuminate(x, y, radius, env, ctx, flicker, targetCtx, currentZoom, WIDTH, HEIGHT, isDarkLayer) {
    // Validate all inputs are finite numbers before proceeding
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || 
        !Number.isFinite(env) || !Number.isFinite(flicker) || !Number.isFinite(currentZoom)) {
      console.warn('LightSourceRenderer.illuminate: Invalid input values', {x, y, radius, env, flicker, currentZoom});
      return;
    }
    
    const rnd = (0.05 * Math.sin(1.1 * Date.now() / 200) * flicker);
    
    // Validate rnd is finite (should always be, but check just in case)
    if (!Number.isFinite(rnd)) {
      console.warn('LightSourceRenderer.illuminate: Invalid rnd value', rnd);
      return;
    }
    
    const adjustedRadius = radius * (1 + rnd);
    
    // Validate adjustedRadius is still finite after calculation
    if (!Number.isFinite(adjustedRadius) || adjustedRadius <= 0) {
      console.warn('LightSourceRenderer.illuminate: Invalid adjustedRadius', adjustedRadius);
      return;
    }
    // Scale cutout radius by environment factor (larger in caves/night, normal in day)
    const cutoutRadius = adjustedRadius * env;
    
    // Validate cutoutRadius is finite
    if (!Number.isFinite(cutoutRadius) || cutoutRadius <= 0) {
      console.warn('LightSourceRenderer.illuminate: Invalid cutoutRadius', cutoutRadius);
      return;
    }

    // Draw glow on main canvas (ctx already has zoom transform)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const radialGradient = ctx.createRadialGradient(x, y, 0, x, y, adjustedRadius);
    radialGradient.addColorStop(0.0, '#AA8');
    radialGradient.addColorStop(0.7 + rnd, '#330');
    radialGradient.addColorStop(0.90, '#110');
    radialGradient.addColorStop(1, '#000');
    ctx.fillStyle = radialGradient;
    ctx.beginPath();
    ctx.arc(x, y, adjustedRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Draw cutout on target canvas using EXACT same system
    if (targetCtx) {
      if (isDarkLayer) {
        // Dark layer: no zoom, calculate actual pixel position where glow appears
        const centerX = WIDTH / 2;
        const centerY = HEIGHT / 2;
        const actualX = (x - centerX) * currentZoom + centerX;
        const actualY = (y - centerY) * currentZoom + centerY;
        
        // Validate calculated coordinates and cutout radius
        const scaledCutoutRadius = cutoutRadius * currentZoom;
        if (!Number.isFinite(actualX) || !Number.isFinite(actualY) || !Number.isFinite(scaledCutoutRadius) || scaledCutoutRadius <= 0) {
          console.warn('LightSourceRenderer.illuminate: Invalid dark layer coordinates', {actualX, actualY, scaledCutoutRadius});
          return;
        }
        
        targetCtx.save();
        targetCtx.globalCompositeOperation = 'destination-out';
        const cutoutGradient = targetCtx.createRadialGradient(actualX, actualY, 0, actualX, actualY, scaledCutoutRadius);
        cutoutGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        cutoutGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
        cutoutGradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.2)');
        cutoutGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        targetCtx.fillStyle = cutoutGradient;
        targetCtx.beginPath();
        targetCtx.arc(actualX, actualY, scaledCutoutRadius, 0, 2 * Math.PI);
        targetCtx.fill();
        targetCtx.restore();
      } else {
        // Lighting canvas: The darkening layer was drawn WITH zoom transform active
        // It covers the screen in zoomed coordinate space
        // We MUST apply the same zoom transform and use the SAME (x,y) coordinates as glow
        // This ensures cutout is in the exact same coordinate space as the darkening layer
        targetCtx.save();
        // Apply the EXACT same zoom transform sequence as main canvas
        targetCtx.translate(WIDTH / 2, HEIGHT / 2);
        targetCtx.scale(currentZoom, currentZoom);
        targetCtx.translate(-WIDTH / 2, -HEIGHT / 2);
        targetCtx.globalCompositeOperation = 'destination-out';
        // Use EXACT same coordinates and radius as glow - no calculations, just use (x, y, cutoutRadius)
        const cutoutGradient = targetCtx.createRadialGradient(x, y, 0, x, y, cutoutRadius);
        cutoutGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        cutoutGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
        cutoutGradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.2)');
        cutoutGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        targetCtx.fillStyle = cutoutGradient;
        targetCtx.beginPath();
        targetCtx.arc(x, y, cutoutRadius, 0, 2 * Math.PI);
        targetCtx.fill();
        targetCtx.restore();
      }
    }
  }

  /**
   * Render all light sources
   * @param {number} env - Environment factor
   * @param {object} config - Configuration object
   * @param {HTMLCanvasElement} config.darkLayerCanvas - Dark layer canvas from LightingRenderer (for caves/cellars) - optional, will use lightingRenderer reference if not provided
   * @param {CanvasRenderingContext2D} config.darkLayerCtx - Dark layer context from LightingRenderer (for caves/cellars) - optional, will use lightingRenderer reference if not provided
   */
  render(env, config) {
    const {
      selfId,
      PlayerList,
      Light,
      lighting,
      flicker,
      getCameraPosition,
      getCurrentZ,
      hasFire,
      WIDTH,
      HEIGHT,
      currentZoom,
      ctx,
      darkLayerCanvas: configDarkLayerCanvas,
      darkLayerCtx: configDarkLayerCtx
    } = config;

    // Skip lighting effects for ghosts
    if (selfId && PlayerList[selfId] && PlayerList[selfId].ghost) {
      return;
    }

    // Initialize canvas
    this.initLightTempCanvas(lighting);

    // Get camera position
    const cameraPos = getCameraPosition();

    // Get current z-layer
    const playerZ = getCurrentZ();
    const isCaveOrCellar = (playerZ === -1 || playerZ === -2);
    const contextHelper = (typeof window !== 'undefined' && window.contextHelper) ? window.contextHelper : null;
    const currentContext = contextHelper
      ? contextHelper.getCurrentContext({ selfId, PlayerList })
      : null;

    // Get dark layer from config parameter OR from LightingRenderer reference
    // Priority: config parameter > lightingRenderer reference (for flexibility)
    let darkLayerCanvas = configDarkLayerCanvas;
    let darkLayerCtx = configDarkLayerCtx;
    
    if (!darkLayerCanvas || !darkLayerCtx) {
      const darkLayer = this.getDarkLayerFromLightingRenderer();
      if (darkLayer) {
        darkLayerCanvas = darkLayer.canvas;
        darkLayerCtx = darkLayer.ctx;
      }
    }

    // Target context (dark layer for caves/cellars, lighting canvas otherwise)
    const targetCtx = (isCaveOrCellar && darkLayerCtx) ? darkLayerCtx : lighting;

    // Cache light list as array for efficient iteration
    const lights = Light.list ? Object.values(Light.list) : [];
    
    // Render each light source using indexed loop (faster than for...in)
    for (let i = 0, len = lights.length; i < len; i++) {
      const light = lights[i];
      if (!light) continue; // Skip deleted lights
      if (contextHelper && !contextHelper.isEntityInContext(light, currentContext)) {
        continue;
      }

      // Validate light source data
      if (!Number.isFinite(light.x) || !Number.isFinite(light.y) || 
          !Number.isFinite(light.radius) || !Number.isFinite(light.z)) {
        console.warn('LightSourceRenderer.render: Invalid light source data', light);
        continue;
      }
      
      // Validate camera position
      if (!Number.isFinite(cameraPos.x) || !Number.isFinite(cameraPos.y)) {
        console.warn('LightSourceRenderer.render: Invalid camera position', cameraPos);
        continue;
      }

      const rnd = (0.05 * Math.sin(1.1 * Date.now() / 200) * flicker);
      
      // Calculate screen position once - this is where the glow appears on the zoomed main canvas
      const screenX = light.x - cameraPos.x + WIDTH / 2;
      const screenY = light.y - cameraPos.y + HEIGHT / 2;
      
      // Validate calculated screen position
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
        console.warn('LightSourceRenderer.render: Invalid screen position', {screenX, screenY, light, cameraPos});
        continue;
      }

      const isTorchLight = light.parent && Item && Item.list && Item.list[light.parent] && Item.list[light.parent].type === 'LitTorch';
      
      if (light.z === playerZ || light.z === 99) {
        // Determine if we need to draw cutout
        // For z=0, z=-1, z=-2, and z=99 lights, always draw cutout (torches, firepits, cave lights, etc.)
        // For z=1 or z=2 lights (building interiors), only draw cutout if there's no firepit
        let needsCutout = false;
        if (light.z === 0 || light.z === -1 || light.z === -2 || light.z === 99) {
          needsCutout = true;
        } else if (light.z === 1 || light.z === 2) {
          needsCutout = !hasFire(playerZ, cameraPos.x, cameraPos.y);
        }
        
        // Get target context for cutout (null if no cutout needed)
        const cutoutTarget = needsCutout ? targetCtx : null;
        
        // Draw glow AND cutout together using the same system - they will always align
        this.illuminate(screenX, screenY, 45 * light.radius, env, ctx, flicker, cutoutTarget, currentZoom, WIDTH, HEIGHT, isCaveOrCellar);
      }
    }
  }
}

// Export for use in client.js
if (typeof window !== 'undefined') {
  window.LightSourceRenderer = LightSourceRenderer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightSourceRenderer;
}
