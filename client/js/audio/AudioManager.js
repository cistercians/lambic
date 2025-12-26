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
    
    // Improved building lookup - use robust logic matching AudioSystem
    const isIndoor = (player.z === 1 || player.z === 2 || player.z === -2);
    let buildingId = null;
    let building = null;
    
    if (isIndoor && typeof getBuilding !== 'undefined') {
      // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
      buildingId = getBuilding(player.x, player.y, true);
      if (buildingId) {
        building = Building.list[buildingId];
      }
      
      // If building not found, try with position offsets to handle edge cases
      if (!building) {
        const offsets = [
          [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0],
          [-1, -1], [1, -1], [-1, 1], [1, 1]
        ];
        for (let i = 0; i < offsets.length && !building; i++) {
          const offsetX = player.x + (offsets[i][0] * (typeof tileSize !== 'undefined' ? tileSize : 64));
          const offsetY = player.y + (offsets[i][1] * (typeof tileSize !== 'undefined' ? tileSize : 64));
          const retryId = getBuilding(offsetX, offsetY, true);
          if (retryId && Building.list[retryId]) {
            buildingId = retryId;
            building = Building.list[retryId];
            break;
          }
        }
      }
    } else if (!isIndoor && typeof getBuilding !== 'undefined') {
      buildingId = getBuilding(player.x, player.y);
      if (buildingId) {
        building = Building.list[buildingId];
      }
    }
    
    const weatherEffects = getWeatherEffects(player.x, player.y, player.z);
    
    // Determine shipType: use player.shipType if set, otherwise check boardedShip entity
    let shipType = player.shipType || null;
    if (!shipType && player.boardedShip) {
      const boardedShipEntity = Player.list[player.boardedShip];
      if (boardedShipEntity && boardedShipEntity.shipType) {
        shipType = boardedShipEntity.shipType;
      }
    }
    
    const context = {
      x: player.x,
      y: player.y,
      z: player.z,
      ghost: player.ghost || false,
      shipType: shipType,
      buildingType: building ? building.type : null,
      buildingOcc: building ? building.occ : 0,
      hasFire: (player.z === 1 || player.z === 2) ? hasFire(player.z, player.x, player.y) : false,
      nightfall: nightfall,
      tempus: tempus,
      inStorm: weatherEffects && weatherEffects.storm.active && weatherEffects.storm.intensity > 0.3,
      stormIntensity: weatherEffects && weatherEffects.storm.active ? weatherEffects.storm.intensity : 0
    };
    return context;
  }
  
  /**
   * Check if audio context has changed significantly
   */
  hasContextChanged(newContext) {
    if(!this.lastContext) return true;
    
    // Check critical changes (priority order)
    if(newContext.ghost !== this.lastContext.ghost) {
      return true;
    }
    if(newContext.shipType !== this.lastContext.shipType) {
      return true;
    }
    if(newContext.z !== this.lastContext.z) return true;
    if(newContext.inStorm !== this.lastContext.inStorm) return true;
    
    // Don't change audio for tempus/nightfall changes if in storm (storm audio takes priority)
    if(newContext.inStorm && this.lastContext.inStorm) {
      // Both in storm - ignore tempus/nightfall changes
      if(newContext.buildingType !== this.lastContext.buildingType) return true;
      return false;
    }
    
    // Don't change audio for tempus/nightfall changes if on a ship (ship audio takes priority)
    // Check if NEW context has shipType (even if old context didn't) - prevents day/night from overriding ship audio
    if(newContext.shipType) {
      // On ship - ignore tempus/nightfall changes
      if(newContext.buildingType !== this.lastContext.buildingType) return true;
      return false;
    }
    
    if(newContext.nightfall !== this.lastContext.nightfall) {
      return true;
    }
    if(newContext.tempus !== this.lastContext.tempus) {
      return true;
    }
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
    } else if(context.z === 1 || context.z === 2){
      // Check building type - ensure building exists and has type property
      if(context.buildingType){
        // Use case-insensitive comparison and trim whitespace
        const buildingType = String(context.buildingType).toLowerCase().trim();
        
        if(buildingType === 'stronghold'){
          if(context.nightfall){
            return stronghold_night_bgm;
          } else {
            return stronghold_day_bgm;
          }
        } else if(buildingType === 'garrison'){
          if(typeof garrison_bgm !== 'undefined') {
            return garrison_bgm;
          } else {
            // Fallback if garrison_bgm not loaded
            return indoors_bgm;
          }
        } else if(buildingType === 'tavern'){
          if(typeof tavern_bgm !== 'undefined') {
            return tavern_bgm;
          } else {
            return indoors_bgm;
          }
        } else if(buildingType === 'monastery'){
          // No music in monasteries (returns null)
          return null;
        } else {
          // Building found but type doesn't match any special cases
          return indoors_bgm;
        }
      } else {
        // No building found or building has no type - play default indoor music
      return indoors_bgm;
      }
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

