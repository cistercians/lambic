/**
 * CursorRenderer - Manages custom cursor rendering
 * 
 * Extracted from client.js for better organization.
 */

class CursorRenderer {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Render custom cursor
   * @param {object} config - Cursor configuration
   * @param {object} config.Img - Image assets
   * @param {boolean} config.workCommandMode - Is work mode active?
   * @param {boolean} config.attackCommandMode - Is attack mode active?
   * @param {string} config.hoveredTarget - Hovered entity ID
   * @param {string} config.hoveredInteractable - Hovered building ID
   * @param {function} config.allyCheck - Function to check if entity is ally
   * @param {number} config.currentMouseX - Current mouse X position
   * @param {number} config.currentMouseY - Current mouse Y position
   * @param {number} config.WIDTH - Canvas width
   * @param {number} config.HEIGHT - Canvas height
   * @param {string} config.selfId - Current player ID
   * @param {object} config.PlayerList - Player list object
   */
  render(config) {
    const {
      Img,
      workCommandMode,
      attackCommandMode,
      hoveredTarget,
      hoveredInteractable,
      allyCheck,
      currentMouseX,
      currentMouseY,
      WIDTH,
      HEIGHT,
      selfId,
      PlayerList
    } = config;

    const canvas = document.getElementById('ctx');
    if (!canvas) return;

    // Check if cursor overlay is available, try to initialize if not
    let cursorOverlayCtx = window.cursorOverlayCtx;
    let cursorOverlayCanvas = window.cursorOverlayCanvas;
    
    if (!cursorOverlayCtx || !cursorOverlayCanvas) {
      cursorOverlayCanvas = document.getElementById('cursor-overlay');
      if (cursorOverlayCanvas) {
        cursorOverlayCtx = cursorOverlayCanvas.getContext('2d');
        // Set initial size
        if (cursorOverlayCanvas.width === 0 || cursorOverlayCanvas.height === 0) {
          cursorOverlayCanvas.width = WIDTH || window.innerWidth;
          cursorOverlayCanvas.height = HEIGHT || window.innerHeight;
        }
        window.cursorOverlayCtx = cursorOverlayCtx;
        window.cursorOverlayCanvas = cursorOverlayCanvas;
      }
      if (!cursorOverlayCtx || !cursorOverlayCanvas) {
        return;
      }
    }

    // Clear the cursor overlay canvas each frame
    cursorOverlayCtx.clearRect(0, 0, cursorOverlayCanvas.width, cursorOverlayCanvas.height);

    // Hide default browser cursor
    canvas.style.cursor = 'none';
    canvas.style.setProperty('cursor', 'none', 'important');

    // Also hide cursor on body and gameDiv when over canvas
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
      gameDiv.style.cursor = 'none';
    }
    if (document.body) {
      const rect = canvas.getBoundingClientRect();
      if (currentMouseX >= 0 && currentMouseX <= rect.width && currentMouseY >= 0 && currentMouseY <= rect.height) {
        document.body.style.cursor = 'none';
      }
    }

    // Determine which cursor to show based on mode and hover state
    let cursorType = 'default';
    let cursorImg = null;

    if (workCommandMode) {
      cursorType = 'work';
      cursorImg = Img.cursorWork;
    } else if (attackCommandMode) {
      cursorType = 'attack';
      cursorImg = Img.cursorAttack;
    } else if (hoveredTarget && typeof allyCheck === 'function') {
      // Check if hovered entity is an enemy
      const allyStatus = allyCheck(hoveredTarget);
      if (allyStatus === -1) {
        // Check innaWoods compatibility before showing attack cursor
        let canShowAttackCursor = true;
        if (selfId && PlayerList && PlayerList[selfId] && PlayerList[hoveredTarget]) {
          const player = PlayerList[selfId];
          const entity = PlayerList[hoveredTarget];
          // Only check innaWoods on overworld (z=0)
          if (entity.z === 0) {
            const playerInnaWoods = player.innaWoods || false;
            const entityInnaWoods = entity.innaWoods || false;
            if (playerInnaWoods !== entityInnaWoods) {
              canShowAttackCursor = false; // Don't show attack cursor for incompatible innaWoods values
            }
          }
        }
        
        if (canShowAttackCursor) {
          cursorType = 'attack';
          cursorImg = Img.cursorAttack;
        } else if (hoveredInteractable) {
          cursorType = 'interact';
          cursorImg = Img.cursorInteract;
        } else {
          cursorType = 'default';
          cursorImg = Img.cursor;
        }
      } else if (hoveredInteractable) {
        cursorType = 'interact';
        cursorImg = Img.cursorInteract;
      } else {
        cursorType = 'default';
        cursorImg = Img.cursor;
      }
    } else if (hoveredInteractable) {
      cursorType = 'interact';
      cursorImg = Img.cursorInteract;
    } else {
      cursorType = 'default';
      cursorImg = Img.cursor;
    }

    // Only render if cursor image exists
    if (!cursorImg) {
      return;
    }

    // Render cursor at mouse position
    const cursorX = currentMouseX || 0;
    const cursorY = currentMouseY || 0;

    cursorOverlayCtx.drawImage(
      cursorImg,
      cursorX,
      cursorY,
      cursorImg.width || 32,
      cursorImg.height || 32
    );
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.CursorRenderer = CursorRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CursorRenderer;
}
