/**
 * PortraitUI - Manages player and target portrait displays
 * 
 * Extracted from client.js for better organization.
 */

class PortraitUI {
  constructor() {
    this.portraitMap = null;
  }

  /**
   * Update player portrait HUD
   * @param {object} player - Player entity
   */
  updatePlayerPortraitHUD(player) {
    const hud = document.getElementById('player-portrait-hud');
    if (!hud) return;

    hud.classList.add('active');

    // Draw portrait on canvas
    const canvas = document.getElementById('player-portrait-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      const portrait = this.getPortraitImage(player.class, player.sex);
      
      if (portrait && portrait.complete && portrait.width > 0 && portrait.height > 0) {
        try {
          ctx.drawImage(portrait, 0, 0, 64, 64);
        } catch (e) {
          console.warn('Failed to draw player portrait for class:', player.class, e);
        }
      }
    }

    // Update HP bar
    const hpPercent = (player.hp / player.hpMax) * 100;
    const hpFill = document.getElementById('player-hp-bar-fill');
    const hpText = document.getElementById('player-hp-bar-text');
    if (hpFill) {
      hpFill.style.width = hpPercent + '%';
    }
    if (hpText) {
      hpText.textContent = Math.floor(player.hp) + ' / ' + player.hpMax;
    }

    // Update Spirit bar
    const spiritBar = document.getElementById('player-spirit-bar-hud');
    if (spiritBar) {
      spiritBar.style.display = 'block';
    }

    if (player.spirit !== undefined && player.spirit !== null && player.spiritMax > 0) {
      const spiritPercent = (player.spirit / player.spiritMax) * 100;
      const spiritFill = document.getElementById('player-spirit-bar-fill');
      const spiritText = document.getElementById('player-spirit-bar-text');
      if (spiritFill) {
        spiritFill.style.width = spiritPercent + '%';
      }
      if (spiritText) {
        spiritText.textContent = Math.floor(player.spirit) + ' / ' + player.spiritMax;
      }
    } else {
      const spiritFill = document.getElementById('player-spirit-bar-fill');
      const spiritText = document.getElementById('player-spirit-bar-text');
      if (spiritFill) {
        spiritFill.style.width = '0%';
      }
      if (spiritText) {
        spiritText.textContent = '0 / 0';
      }
    }
  }

  /**
   * Update target portrait HUD
   * @param {object} target - Target entity
   * @param {string} selectedTarget - Selected target ID
   */
  updateTargetPortraitHUD(target, selectedTarget) {
    const hud = document.getElementById('target-portrait-hud');
    if (!hud) return;

    if (!selectedTarget || !target) {
      hud.classList.remove('active');
      return;
    }

    hud.classList.add('active');

    // Draw portrait on canvas
    const canvas = document.getElementById('target-portrait-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      const portrait = this.getPortraitImage(target.class, target.sex);
      
      if (portrait && portrait.complete && portrait.width > 0 && portrait.height > 0) {
        try {
          ctx.drawImage(portrait, 0, 0, 64, 64);
        } catch (e) {
          console.warn('Failed to draw target portrait for class:', target.class, e);
        }
      }
    }

    // Update HP bar
    if (target.hp !== null && target.hp !== undefined) {
      const hpPercent = (target.hp / target.hpMax) * 100;
      const hpFill = document.getElementById('target-hp-bar-fill');
      const hpText = document.getElementById('target-hp-bar-text');
      if (hpFill) {
        hpFill.style.width = hpPercent + '%';
      }
      if (hpText) {
        hpText.textContent = Math.floor(target.hp) + ' / ' + target.hpMax;
      }
    }

    // Update Spirit bar (for spirit-using classes)
    const spiritClasses = ['Mage', 'Acolyte', 'Warlock', 'Brother', 'Druid', 'Priest', 'Monk', 'Prior', 'Friar', 'Bishop', 'Archbishop', 'Oathkeeper', 'HighPriestess', 'seidr'];
    const hasSpirit = spiritClasses.indexOf(target.class) !== -1 && target.spirit !== undefined && target.spirit !== null;
    const spiritBar = document.getElementById('target-spirit-bar-hud');
    if (spiritBar) {
      spiritBar.style.display = hasSpirit ? 'block' : 'none';
    }
    if (hasSpirit) {
      const spiritPercent = (target.spirit / target.spiritMax) * 100;
      const spiritFill = document.getElementById('target-spirit-bar-fill');
      const spiritText = document.getElementById('target-spirit-bar-text');
      if (spiritFill) {
        spiritFill.style.width = spiritPercent + '%';
      }
      if (spiritText) {
        spiritText.textContent = Math.floor(target.spirit) + ' / ' + target.spiritMax;
      }
    }
  }

  /**
   * Get portrait image for entity class
   * @param {string} entityClass - Entity class name
   * @param {string} entitySex - Entity sex ('M' or 'F')
   * @returns {Image} Portrait image
   */
  getPortraitImage(entityClass, entitySex) {
    // Use PortraitHelper if available
    if (typeof PortraitHelper !== 'undefined' && window.portraitHelperInstance) {
      return window.portraitHelperInstance.getPortraitImage(entityClass, entitySex);
    }
    
    // Fallback to direct Img access
    if (typeof Img === 'undefined') return null;
    
    // Lazy initialize portrait map
    if (!this.portraitMap) {
      this.buildPortraitMap();
    }

    if (!entityClass) return Img.portraitSerfM || null;

    const classLower = entityClass.toLowerCase();
    
    // Check pre-loaded portraits first
    if (Img.portraitMap && Img.portraitMap[classLower]) {
      return Img.portraitMap[classLower];
    }

    // Check fallback map
    if (this.portraitMap[entityClass]) {
      const fallbackPortrait = this.portraitMap[entityClass];
      if (fallbackPortrait && typeof fallbackPortrait !== 'undefined') {
        return fallbackPortrait;
      }
    }

    // Last resort: default
    return Img.portraitSerfM || null;
  }

  /**
   * Build portrait fallback map
   */
  buildPortraitMap() {
    if (typeof Img === 'undefined') {
      this.portraitMap = {};
      return;
    }

    this.portraitMap = {
      'Alaric': Img.portraitKing,
      'Innkeeper': Img.portraitSerfM,
      'Shipwright': Img.portraitSerfM,
      'Gwenllian': Img.portraitDruid,
      'Apparition': Img.portraitSerfM
    };
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.PortraitUI = PortraitUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PortraitUI;
}
