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
    
    // If building ID not provided but we're indoors, try to get it
    // Use includeWallsAndTopPlot=true since player might be on stairs (wall tiles)
    var buildingId = b;
    if (isIndoor && !buildingId && typeof getBuilding !== 'undefined') {
      buildingId = getBuilding(x, y, true); // Include walls for stairs
    }
    
    // If inside a building, check if we're in the same building
    if (isIndoor && buildingId && this._currentBuildingId === buildingId) {
      // Same building, different floor - don't change music
      var building = Building.list[buildingId];
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
    
    var building = buildingId ? Building.list[buildingId] : null;
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
      if(building && building.type == 'stronghold'){
        if(nightfall){
          bgmPlayer(stronghold_night_bgm);
        } else {
          bgmPlayer(stronghold_day_bgm);
        }
      } else if(building && building.type == 'garrison'){
        bgmPlayer(garrison_bgm);
      } else if(building && building.type == 'tavern'){
        bgmPlayer(tavern_bgm);
      } else if(building && building.type == 'monastery'){
        bgmPlayer(monastery_bgm);
      } else {
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

