/**
 * AudioSystem.js
 * Handles background music (BGM) and ambient sound (soundscape) based on player location and state
 * Extracted from client.js to reduce complexity
 */

var AudioSystem = {
  // Track current building state to prevent music changes when moving between floors
  _currentBuildingId: null,  // Track current building ID
  _currentIndoorZ: null,     // Track z-level when inside building
  
  /**
   * Determines and plays appropriate ambient sound based on location
   * @param {number} x - Player X coordinate
   * @param {number} y - Player Y coordinate
   * @param {number} z - Player Z coordinate (layer)
   * @param {Object} b - Building object at location
   */
  soundscape: function(x, y, z, b) {
    // Check for weather effects first (storms take priority)
    if(Player.list[selfId]){
      var weatherEffects = getWeatherEffects(x, y, z);
      if(weatherEffects && weatherEffects.storm.active && weatherEffects.storm.intensity > 0.3){
        // If on a ship during storm, play seastorm ambience (navigator or passenger)
        var player = Player.list[selfId];
        if(player && (player.shipType || player.isBoarded || player.boardedShip)){
          ambPlayer(Amb.seastorm);
        } else {
          ambPlayer(Amb.rain);
        }
        return; // Skip other ambience checks
      }
    }
    
    // Check if player is on a ship (navigator or passenger) - overrides all other ambience
    var player = Player.list[selfId];
    if(player && (player.shipType || player.isBoarded || player.boardedShip)){
      ambPlayer(Amb.sea); // Keep sea ambience while on any ship
      return; // Skip other checks
    }
    
    // Check ghost mode - overrides all other ambience
    if(Player.list[selfId] && Player.list[selfId].ghost){
      ambPlayer(Amb.spirits); // Play spirits.mp3
      return; // Skip other checks
    }
    
    // outdoors
    if(z == 0){
      if(nightfall){
        ambPlayer(Amb.forest);
      } else {
        ambPlayer(Amb.nature);
      }
    } else if(z == -1){
      ambPlayer(Amb.cave);
    } else if(z == 1 || z == 2){
      if(b.type == 'monastery'){
        ambPlayer(Amb.empty);
      } else if(hasFire(z,x,y)){
        if(b.occ < 4){
          ambPlayer(Amb.fire);
        } else if(b.occ < 6){
          ambPlayer(Amb.hush);
        } else {
          ambPlayer(Amb.chatter);
        }
      } else {
        ambPlayer();
      }
    } else if(z == -2){
      if(b.type == 'tavern'){
        ambPlayer(Amb.empty);
      } else {
        ambPlayer(Amb.evil);
      }
    } else if(z == -3){
      ambPlayer(Amb.underwater);
    }
  },

  /**
   * Determines and plays appropriate background music based on location
   * @param {number} x - Player X coordinate
   * @param {number} y - Player Y coordinate
   * @param {number} z - Player Z coordinate (layer)
   * @param {Object} b - Building object at location
   */
  getBgm: function(x, y, z, b) {
    // Check if player is controlling a ship OR is a passenger - overrides all other music
    // Check both isBoarded and boardedShip to ensure we catch all cases
    var player = Player.list[selfId];
    if(player && (player.shipType || player.isBoarded || player.boardedShip)){
      bgmPlayer(ship_bgm); // Keep ship music while on ship
      this.soundscape(x,y,z,{}); // Handle ship ambience (sea.mp3)
      return; // Skip other checks
    }
    
    // Check ghost mode first - overrides all other music
    if(Player.list[selfId] && Player.list[selfId].ghost){
      // Play Defeat.mp3 once, don't loop
      // Use the global defeat_bgm playlist defined in audioloader.js
      if(AudioCtrl.playlist !== defeat_bgm){
        // Force change to ghost music
        AudioCtrl.playlist = null; // Clear playlist to force change
        bgmPlayer(defeat_bgm, false, false); // Third param = don't loop
      }
      this.soundscape(x,y,z,{}); // Still handle ghost ambience
      return; // Skip other checks
    }
    
    // If we were in ghost mode, force music change
    if(AudioCtrl.playlist === defeat_bgm){
      AudioCtrl.playlist = null; // Clear playlist to force change on respawn
    }
    
    // Check if we're inside a building
    var isIndoor = (z == 1 || z == 2 || z == -2);
    
    // Building lookup logic - b might be a building ID or null
    var buildingId = b;
    var building = null;
    
    // If indoors, always try to find the building
    if (isIndoor && typeof getBuilding !== 'undefined') {
      // First, try to get building from the provided ID (if any)
      if (buildingId) {
        building = Building.list[buildingId];
      }
      
      // If building not found, or no ID provided, look it up by position
      // Use includeWallsAndTopPlot=true since player might be on stairs (wall tiles)
      if (!building) {
        var lookupId = getBuilding(x, y, true);
        if (lookupId) {
          buildingId = lookupId;
          building = Building.list[lookupId];
        }
      }
      
      // If still not found, try one more time with a slight position offset
      // This handles edge cases where player is exactly on a boundary
      if (!building) {
        var offsets = [
          [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0],
          [-1, -1], [1, -1], [-1, 1], [1, 1]
        ];
        for (var i = 0; i < offsets.length && !building; i++) {
          var offsetX = x + (offsets[i][0] * (typeof tileSize !== 'undefined' ? tileSize : 64));
          var offsetY = y + (offsets[i][1] * (typeof tileSize !== 'undefined' ? tileSize : 64));
          var retryId = getBuilding(offsetX, offsetY, true);
          if (retryId && Building.list[retryId]) {
            buildingId = retryId;
            building = Building.list[retryId];
            break;
          }
        }
      }
      
      // Debug: Log building lookup results for garrison troubleshooting
      if (typeof console !== 'undefined' && console.log && !building) {
        console.log('AudioSystem: Building lookup failed. buildingId=' + buildingId + ', Building.list keys:', Object.keys(Building.list || {}));
      } else if (typeof console !== 'undefined' && console.log && building) {
        console.log('AudioSystem: Building found. id=' + building.id + ', type=' + building.type + ', hasType=' + (building.type !== undefined));
      }
    }
    
    // If inside a building, check if we're in the same building
    if (isIndoor && buildingId && this._currentBuildingId === buildingId) {
      // Same building, different floor - don't change music
      this.soundscape(x, y, z, building || {});
      return; // Skip music change
    }
    
    // Update tracking
    if (isIndoor && buildingId) {
      this._currentBuildingId = buildingId;
      this._currentIndoorZ = z;
    } else {
      // Exited building - clear tracking
      this._currentBuildingId = null;
      this._currentIndoorZ = null;
    }
    this.soundscape(x,y,z,building || {});
    // outdoors
    if(z == 0){
      if(nightfall && tempus != 'IV.a'){
        bgmPlayer(overworld_night_bgm);
      } else if(tempus == 'IV.a' || tempus == 'V.a' || tempus == 'VI.a' ||
      tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a'){
        // morning
        bgmPlayer(overworld_morning_bgm);
      } else {
        // night
        bgmPlayer(overworld_day_bgm);
      }
    } else if(z == -1){
      // cave
      bgmPlayer(cave_bgm);
      // indoor
    } else if(z == 1 || z == 2){
      // Check building type - ensure building exists and has type property
      if(building && building.type){
        // Use case-insensitive comparison and trim whitespace
        var buildingType = String(building.type).toLowerCase().trim();
        
        if(buildingType == 'stronghold'){
        if(nightfall){
          bgmPlayer(stronghold_night_bgm);
        } else {
          bgmPlayer(stronghold_day_bgm);
        }
        } else if(buildingType == 'garrison'){
          if(typeof garrison_bgm !== 'undefined') {
        bgmPlayer(garrison_bgm);
          } else {
            // Fallback if garrison_bgm not loaded
            bgmPlayer(indoors_bgm);
          }
        } else if(buildingType == 'tavern'){
        bgmPlayer(tavern_bgm);
        } else if(buildingType == 'monastery'){
        bgmPlayer(monastery_bgm);
        } else {
          // Building found but type doesn't match any special cases
          // Debug: log building type for troubleshooting (remove in production)
          if(typeof console !== 'undefined' && console.log) {
            console.log('AudioSystem: Building type "' + building.type + '" does not match special cases, playing indoor music');
          }
          bgmPlayer(indoors_bgm);
        }
      } else {
        // No building found or building has no type - play default indoor music
        // Debug: log for troubleshooting (remove in production)
        if(typeof console !== 'undefined' && console.log) {
          console.log('AudioSystem: No building found at z=' + z + ', x=' + x + ', y=' + y + ', buildingId=' + buildingId);
        }
        bgmPlayer(indoors_bgm);
      }
    } else if(z == -2){
      if(building && building.type == 'tavern'){
        return;
      } else {
        bgmPlayer(dungeons_bgm);
      }
    }
  }
};

