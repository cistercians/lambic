/**
 * AudioManager - Centralized audio control for BGM and ambience
 * Handles all audio transitions based on player context (location, weather, ship, ghost mode)
 */

class AudioManager {
  constructor() {
    this.lastContext = null;
    this.updateInterval = null;
    this.transitionDuration = 500; // 500ms for audio transitions
    this.manualOverrideUntil = 0; // Timestamp - don't auto-update before this time
    this.lastBGM = null; // Track last BGM to avoid restarting same audio
    this.lastAmb = null; // Track last ambience to avoid restarting same audio
  }
  
  /**
   * Start the audio manager - begins monitoring player state
   */
  start() {
    // Update audio more frequently (every second for better responsiveness)
    this.updateInterval = setInterval(() => {
      this.update();
    }, 1000);
    
    console.log('AudioManager started');
  }
  
  /**
   * Stop the audio manager
   */
  stop() {
    if(this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Main update loop - checks all audio conditions and updates as needed
   */
  update() {
    if(!selfId || !Player.list[selfId]) return;
    
    // Skip if manual override is active
    if(Date.now() < this.manualOverrideUntil){
      return;
    }
    
    const context = this.getAudioContext();
    if(!context) return;
    
    // Check if context changed
    if(this.hasContextChanged(context)){
      this.selectAndPlayAudio(context);
      this.lastContext = context;
    }
  }
  
  /**
   * Get current audio context (all factors that influence audio)
   */
  getAudioContext() {
    const player = Player.list[selfId];
    if(!player) return null;
    
    const building = Building.list[getBuilding(player.x, player.y)];
    const weatherEffects = getWeatherEffects(player.x, player.y, player.z);
    
    return {
      x: player.x,
      y: player.y,
      z: player.z,
      ghost: player.ghost || false,
      shipType: player.shipType || null,
      buildingType: building ? building.type : null,
      buildingOcc: building ? building.occ : 0,
      hasFire: (player.z === 1 || player.z === 2) ? hasFire(player.z, player.x, player.y) : false,
      nightfall: nightfall,
      tempus: tempus,
      inStorm: weatherEffects && weatherEffects.storm.active && weatherEffects.storm.intensity > 0.3,
      stormIntensity: weatherEffects && weatherEffects.storm.active ? weatherEffects.storm.intensity : 0
    };
  }
  
  /**
   * Check if audio context has changed significantly
   */
  hasContextChanged(newContext) {
    if(!this.lastContext) return true;
    
    // Check critical changes (priority order)
    if(newContext.ghost !== this.lastContext.ghost) return true;
    if(newContext.shipType !== this.lastContext.shipType) return true;
    if(newContext.z !== this.lastContext.z) return true;
    if(newContext.inStorm !== this.lastContext.inStorm) return true;
    
    // Don't change audio for tempus/nightfall changes if in storm (storm audio takes priority)
    if(newContext.inStorm && this.lastContext.inStorm) {
      // Both in storm - ignore tempus/nightfall changes
      if(newContext.buildingType !== this.lastContext.buildingType) return true;
      return false;
    }
    
    if(newContext.nightfall !== this.lastContext.nightfall) return true;
    if(newContext.tempus !== this.lastContext.tempus) return true;
    if(newContext.buildingType !== this.lastContext.buildingType) return true;
    
    return false;
  }
  
  /**
   * Select and play appropriate BGM and ambience based on context
   */
  selectAndPlayAudio(context) {
    const bgm = this.selectBGM(context);
    const amb = this.selectAmbience(context);
    
    // Only update BGM if it actually changed
    if(bgm !== this.lastBGM) {
      console.log('[AudioManager] BGM changed:', this.lastBGM, '->', bgm);
      if(bgm && typeof bgmPlayer !== 'undefined'){
        bgmPlayer(bgm);
      }
      this.lastBGM = bgm;
    }
    
    // Only update ambience if it actually changed
    if(amb !== this.lastAmb) {
      console.log('[AudioManager] Ambience changed:', this.lastAmb ? this.lastAmb.src : 'null', '->', amb ? amb.src : 'null');
      if(typeof ambPlayer !== 'undefined'){
        ambPlayer(amb);
      }
      this.lastAmb = amb;
    }
  }
  
  /**
   * Select BGM based on priority system
   */
  selectBGM(context) {
    // Priority 1: Ghost mode
    if(context.ghost){
      return defeat_bgm; // Defeat.mp3 (once, no loop)
    }
    
    // Priority 2: Ship
    if(context.shipType){
      return ship_bgm;
    }
    
    // Priority 3: Location-based
    if(context.z === -1){
      return cave_bgm;
    } else if(context.z === 1){
      return context.buildingType === 'monastery' ? null : indoors_bgm;
    } else if(context.z === 2){
      return indoors_bgm;
    } else if(context.z === -2){
      return context.buildingType === 'tavern' ? null : dungeons_bgm;
    } else if(context.z === 0){
      // Overworld - time-based
      if(context.nightfall && context.tempus !== 'IV.a'){
        return overworld_night_bgm;
      } else if(['IV.a', 'V.a', 'VI.a', 'VII.a', 'VIII.a', 'IX.a'].includes(context.tempus)){
        return overworld_morning_bgm;
      } else {
        return overworld_day_bgm;
      }
    }
    
    return null;
  }
  
  /**
   * Select ambience based on priority system
   */
  selectAmbience(context) {
    // Priority 1: Storm (highest)
    if(context.inStorm){
      return context.shipType ? Amb.seastorm : Amb.rain;
    }
    
    // Priority 2: Ship (no storm)
    if(context.shipType){
      return Amb.sea;
    }
    
    // Priority 3: Ghost mode
    if(context.ghost){
      return Amb.spirits;
    }
    
    // Priority 4: Location-based
    if(context.z === 0){
      return context.nightfall ? Amb.forest : Amb.nature;
    } else if(context.z === -1){
      return Amb.cave;
    } else if(context.z === 1 || context.z === 2){
      if(context.buildingType === 'monastery'){
        return Amb.empty;
      } else if(context.hasFire){
        if(context.buildingOcc < 4){
          return Amb.fire;
        } else if(context.buildingOcc < 6){
          return Amb.hush;
        } else {
          return Amb.chatter;
        }
      } else {
        return null; // No ambience
      }
    } else if(context.z === -2){
      return context.buildingType === 'tavern' ? Amb.empty : Amb.evil;
    } else if(context.z === -3){
      return Amb.underwater;
    }
    
    return null;
  }
  
  /**
   * Force immediate audio update (for special events like disembarking)
   */
  forceUpdate() {
    this.manualOverrideUntil = 0; // Clear any override
    this.lastContext = null; // Clear cache
    this.update(); // Immediate update
  }
  
  /**
   * Pause automatic updates for a period (for manual audio control)
   * @param {number} durationMs - How long to pause auto-updates
   */
  pauseAutoUpdates(durationMs) {
    this.manualOverrideUntil = Date.now() + durationMs;
  }
}

// Create global instance
const audioManager = new AudioManager();

// Export for use in other modules
if(typeof module !== 'undefined' && module.exports){
  module.exports = audioManager;
}

