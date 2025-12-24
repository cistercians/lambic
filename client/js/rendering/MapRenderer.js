/**
 * MapRenderer - Manages map tile rendering for all z-layers
 * 
 * Extracted from client.js for better organization.
 * This is a large module (3,500+ lines) that handles all terrain and building tile rendering.
 */

class MapRenderer {
  constructor() {
    // Cache cloud pattern to avoid recreating every frame
    this._cloudPattern = null;
    this._cloudPatternIndex = null;
  }

  /**
   * Get base terrain value for a tile by finding the building that contains it
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {function} getBuilding - Function to get building at coordinates
   * @param {function} getCoords - Function to convert tile to coordinates
   * @param {Array} plot - Building plot array
   * @param {Array} baseTerrain - Building baseTerrain array
   * @returns {number} Terrain value (defaults to 7 = EMPTY/grass)
   */
  getBaseTerrainForTile(c, r, getBuilding, getCoords, plot, baseTerrain) {
    if (!plot || !baseTerrain || baseTerrain.length === 0) {
      return 7; // Default to EMPTY (grass)
    }

    // Find index of this tile in the plot
    for (let i = 0; i < plot.length; i++) {
      if (plot[i] && plot[i][0] === c && plot[i][1] === r) {
        return baseTerrain[i] !== undefined ? baseTerrain[i] : 7;
      }
    }

    return 7; // Default to EMPTY (grass) if tile not found in plot
  }

  /**
   * Get base image for a terrain value
   * @param {number} terrain - Terrain value (may be float like 4.0-4.9 for rocks)
   * @param {object} Img - Image assets
   * @returns {object|null} Image object or null
   */
  getBaseImageForTerrain(terrain, Img) {
    // TERRAIN constants: ROCKS = 4 (stored as 4.0-4.9), MOUNTAIN = 5 (stored as 5.0-5.9)
    // Use Math.floor to handle float values correctly
    const terrainInt = Math.floor(terrain);
    
    // Use rocks base for ROCKS (4.0-4.9) and MOUNTAIN (5.0-5.9)
    if (terrainInt === 4 || terrainInt === 5) {
      return Img.rocky || null;
    }
    
    // Default to grass for all other terrain types (EMPTY=7, BRUSH=3, LIGHT_FOREST=2, HEAVY_FOREST=1)
    return Img.grass || null;
  }

  /**
   * Render the map for the current z-layer
   * @param {object} config - Configuration object with all dependencies
   */
  render(config) {
    // Extract dependencies from config
    const {
      ctx,
      WIDTH,
      HEIGHT,
      currentZoom,
      tileSize,
      viewport,
      clouds,
      cld,
      waterTiles,
      wtr,
      Img,
      getCurrentZ,
      getTile,
      getBuilding,
      Building,
      shipWakes,
      selfId,
      Player,
      godModeCamera,
      BuildingPreviewRenderer
    } = config;

    // Get current z-layer (supports login camera, god mode, and normal play)
    const z = getCurrentZ();

  // overworld
  if(z == 0){
    // Cache cloud pattern to avoid recreating every frame
    if(!this._cloudPattern || this._cloudPatternIndex != cld){
      this._cloudPattern = ctx.createPattern(clouds[cld], "repeat");
      this._cloudPatternIndex = cld;
    }
    
    // Cloud pattern - simple: fill entire canvas, pattern scales with zoom automatically
    // Canvas zoom transform is already active, so everything scales together
    // Pattern should be 4x bigger than tiles - scale pattern by 4
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(4, 4);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
    ctx.fillStyle = this._cloudPattern;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
    
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        
        if(tile == 0){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          
          // Ship wake effect - lighten water tiles where ships are/were
          if (shipWakes && typeof shipWakes.getBrightness === 'function') {
            const brightness = shipWakes.getBrightness(c, r);
            if(brightness > 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, ' + brightness + ')';
              ctx.fillRect(xOffset, yOffset, tileSize, tileSize);
            }
          }
        } else if(tile >= 1 && tile < 2){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          // In god mode or login mode, always show forest overlay (not innaWoods)
          // Normal play: check player's innaWoods status
          var innaWoods = false;
          if(selfId && Player.list[selfId] && !godModeCamera.isActive) {
            innaWoods = Player.list[selfId].innaWoods;
          }
          
          if(!innaWoods){
            if(tile >= 1 && tile < 1.3){
              ctx.drawImage(
                Img.hforest, // image
                xOffset - (tileSize/4), // target x
                yOffset - (tileSize/1.75), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(tile >= 1 && tile < 1.6){
              ctx.drawImage(
                Img.hforest, // image
                xOffset, // target x
                yOffset - (tileSize/1.25), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else {
              ctx.drawImage(
                Img.hforest, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            }
          }
        } else if(tile >= 2 && tile < 2.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 2 && tile < 2.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 2 && tile < 3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset, // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 3 && tile < 3.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 4){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile === 4){
          // Regular rocks: just rocky.png base
          ctx.drawImage(
            Img.rocky, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile > 4 && tile < 5){
          // Large rocks: rocky.png base + rocks.png overlay with offset
          ctx.drawImage(
            Img.rocky, // base image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          // Calculate offset from decimal portion (tile - 4, range 0.01-0.99)
          const decimalOffset = tile - 4;
          // Map decimal to offset range: use it to vary offset similar to mountain pattern
          // Use decimal to create offset variation (0.01-0.99 maps to -tileSize/4 to +tileSize/4)
          const offsetX = (decimalOffset - 0.5) * (tileSize / 2); // Range from -tileSize/4 to +tileSize/4
          const offsetY = (decimalOffset - 0.5) * (tileSize / 3); // Range from -tileSize/6 to +tileSize/6
          ctx.drawImage(
            Img.rocks, // overlay image
            xOffset + offsetX, // target x with offset
            yOffset + offsetY, // target y with offset
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 5 && tile < 5.3){
          ctx.drawImage(
            Img.rocky, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile >= 5 && tile < 5.6){
          ctx.drawImage(
            Img.rocky, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile >= 5 && tile < 6){
          ctx.drawImage(
            Img.rocky, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile == 6){
          ctx.drawImage(
            Img.rocky, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.cavein, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 7){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 8){
          ctx.drawImage(
            Img.farm1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 9){
          ctx.drawImage(
            Img.farm2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 10){
          ctx.drawImage(
            Img.farm3, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 11){
          // Get building at this tile to check baseTerrain
          const getCoords = config.getCoords || ((c, r) => [c * (config.tileSize || 64), r * (config.tileSize || 64)]);
          const bCoords = getCoords(c, r);
          const building = getBuilding(bCoords[0], bCoords[1], true);
          
          // Get base terrain for this tile
          let baseTerrainValue = 7; // Default to EMPTY (grass)
          if (building && Building && Building.list && Building.list[building]) {
            const b = Building.list[building];
            
            // Only use baseTerrain if it has data (length > 0)
            // Empty arrays are truthy but don't contain terrain data
            if (b.plot && b.baseTerrain && b.baseTerrain.length > 0) {
              baseTerrainValue = this.getBaseTerrainForTile(c, r, getBuilding, getCoords, b.plot, b.baseTerrain);
            }
          }
          
          // Draw appropriate base image
          const baseImage = this.getBaseImageForTerrain(baseTerrainValue, Img);
          if (baseImage) {
            ctx.drawImage(
              baseImage, // image (grass or rocks)
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
          
          ctx.drawImage(
            Img.build1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 11.5){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build1w, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 12){
          // Get building at this tile to check baseTerrain
          const getCoords = config.getCoords || ((c, r) => [c * (config.tileSize || 64), r * (config.tileSize || 64)]);
          const bCoords = getCoords(c, r);
          const building = getBuilding(bCoords[0], bCoords[1], true);
          
          // Get base terrain for this tile
          let baseTerrainValue = 7; // Default to EMPTY (grass)
          if (building && Building && Building.list && Building.list[building]) {
            const b = Building.list[building];
            
            // Only use baseTerrain if it has data (length > 0)
            if (b.plot && b.baseTerrain && b.baseTerrain.length > 0) {
              baseTerrainValue = this.getBaseTerrainForTile(c, r, getBuilding, getCoords, b.plot, b.baseTerrain);
            }
          }
          
          // Draw appropriate base image
          const baseImage = this.getBaseImageForTerrain(baseTerrainValue, Img);
          if (baseImage) {
            ctx.drawImage(
              baseImage, // image (grass or rocks)
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
          
          ctx.drawImage(
            Img.build2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 12.5){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if (tile == 18){
          ctx.drawImage(
            Img.road, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 13 || tile == 14 || tile == 15 || tile == 16 || tile == 17 || tile == 19 || tile == 20 || tile == 20.5){
          var bTile = getTile(3,c,r);
          
          // Get building at this tile to check baseTerrain
          const getCoords = config.getCoords || ((c, r) => [c * (config.tileSize || 64), r * (config.tileSize || 64)]);
          const bCoords = getCoords(c, r);
          const building = getBuilding(bCoords[0], bCoords[1], true);
          
          // Get base terrain for this tile
          let baseTerrainValue = 7; // Default to EMPTY (grass)
          if (building && Building && Building.list && Building.list[building]) {
            const b = Building.list[building];
            
            // Only use baseTerrain if it has data (length > 0)
            if (b.plot && b.baseTerrain && b.baseTerrain.length > 0) {
              baseTerrainValue = this.getBaseTerrainForTile(c, r, getBuilding, getCoords, b.plot, b.baseTerrain);
            }
          }
          
          // Draw appropriate base image
          const baseImage = this.getBaseImageForTerrain(baseTerrainValue, Img);
          if (baseImage) {
            ctx.drawImage(
              baseImage, // image (grass or rocks)
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
          if(bTile == 'hut0'){
            ctx.drawImage(
              Img.hut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'hut1'){
            ctx.drawImage(
              Img.hut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'hut2'){
            ctx.drawImage(
              Img.hut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'hut3'){
            ctx.drawImage(
              Img.hut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut0'){
            ctx.drawImage(
              Img.gothhut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut1'){
            ctx.drawImage(
              Img.gothhut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut2'){
            ctx.drawImage(
              Img.gothhut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut3'){
            ctx.drawImage(
              Img.gothhut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut0'){
            ctx.drawImage(
              Img.frankhut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut1'){
            ctx.drawImage(
              Img.frankhut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut2'){
            ctx.drawImage(
              Img.frankhut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut3'){
            ctx.drawImage(
              Img.frankhut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut0'){
            ctx.drawImage(
              Img.celthut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut1'){
            ctx.drawImage(
              Img.celthut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut2'){
            ctx.drawImage(
              Img.celthut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut3'){
            ctx.drawImage(
              Img.celthut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut0'){
            ctx.drawImage(
              Img.teuthut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut1'){
            ctx.drawImage(
              Img.teuthut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut2'){
            ctx.drawImage(
              Img.teuthut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut3'){
            ctx.drawImage(
              Img.teuthut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut0'){
            ctx.drawImage(
              Img.outhut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut1'){
            ctx.drawImage(
              Img.outhut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut2'){
            ctx.drawImage(
              Img.outhut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut3'){
            ctx.drawImage(
              Img.outhut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill0'){
            ctx.drawImage(
              Img.mill0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill1'){
            ctx.drawImage(
              Img.mill1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill2'){
            ctx.drawImage(
              Img.mill2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill3'){
            ctx.drawImage(
              Img.mill3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'lumbermill0'){
            ctx.drawImage(
              Img.lumbermill0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'lumbermill1'){
            ctx.drawImage(
              Img.lumbermill1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine0'){
            ctx.drawImage(
              Img.mine0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine1'){
            ctx.drawImage(
              Img.mine1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine2'){
            ctx.drawImage(
              Img.mine2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine3'){
            ctx.drawImage(
              Img.mine3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage0'){
            ctx.drawImage(
              Img.cottage0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage1'){
            ctx.drawImage(
              Img.cottage1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage2'){
            ctx.drawImage(
              Img.cottage2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }  else if(bTile == 'cottage3'){
            ctx.drawImage(
              Img.cottage3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage4'){
            ctx.drawImage(
              Img.cottage4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage5'){
            ctx.drawImage(
              Img.cottage5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage6'){
            ctx.drawImage(
              Img.cottage6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage7'){
            ctx.drawImage(
              Img.cottage7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage8'){
            ctx.drawImage(
              Img.cottage8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'fort'){
            var l = getTile(3,c-1,r);
            var rr = getTile(3,c+1,r);
            var u = getTile(3,c,r-1);
            var d = getTile(3,c,r+1);
            ctx.drawImage(
              Img.grass, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            if((l != 'fort' && rr != 'fort' && u != 'fort' && d != 'fort') ||
            (l == 'fort' && rr == 'fort' && u == 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u != 'fort' && d != 'fort') ||
            (l != 'fort' && rr == 'fort' && u != 'fort' && d != 'fort') ||
            (l != 'fort' && rr != 'fort' && u == 'fort' && d != 'fort') ||
            (l != 'fort' && rr != 'fort' && u != 'fort' && d == 'fort') ||
            (l != 'fort' && rr == 'fort' && u != 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u != 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u == 'fort' && d != 'fort') ||
            (l != 'fort' && rr == 'fort' && u == 'fort' && d != 'fort') ||
            (l != 'fort' && rr == 'fort' && u == 'fort' && d == 'fort') ||
            (l == 'fort' && rr == 'fort' && u != 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u == 'fort' && d == 'fort') ||
            (l == 'fort' && rr == 'fort' && u == 'fort' && d != 'fort')){
              ctx.drawImage(
                Img.fortc, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(l == 'fort' && rr == 'fort' && u != 'fort' && d != 'fort'){
              ctx.drawImage(
                Img.fortlr, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else if(l != 'fort' && rr != 'fort' && u == 'fort' && d == 'fort'){
              ctx.drawImage(
                Img.fortud, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 2 // target height
              );
            }
          } else if(bTile == 'wall'){
            var l = getTile(3,c-1,r);
            var rr = getTile(3,c+1,r);
            var u = getTile(3,c,r-1);
            var d = getTile(3,c,r+1);
            ctx.drawImage(
              Img.grass, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            if((l != 'wall' && rr != 'wall' && u != 'wall' && d != 'wall') ||
            (l == 'wall' && rr == 'wall' && u == 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u != 'wall' && d != 'wall') ||
            (l != 'wall' && rr == 'wall' && u != 'wall' && d != 'wall') ||
            (l != 'wall' && rr != 'wall' && u == 'wall' && d != 'wall') ||
            (l != 'wall' && rr != 'wall' && u != 'wall' && d == 'wall') ||
            (l != 'wall' && rr == 'wall' && u != 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u != 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u == 'wall' && d != 'wall') ||
            (l != 'wall' && rr == 'wall' && u == 'wall' && d != 'wall') ||
            (l != 'wall' && rr == 'wall' && u == 'wall' && d == 'wall') ||
            (l == 'wall' && rr == 'wall' && u != 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u == 'wall' && d == 'wall') ||
            (l == 'wall' && rr == 'wall' && u == 'wall' && d != 'wall')){
              ctx.drawImage(
                Img.wallc, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(l == 'wall' && rr == 'wall' && u != 'wall' && d != 'wall'){
              ctx.drawImage(
                Img.walllr, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else if(l != 'wall' && rr != 'wall' && u == 'wall' && d == 'wall'){
              ctx.drawImage(
                Img.wallud, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 2 // target height
              );
            }
          } else if(bTile == 'outpost0'){
            ctx.drawImage(
              Img.outpost0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower0'){
            ctx.drawImage(
              Img.gtower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower1'){
            ctx.drawImage(
              Img.gtower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower2'){
            ctx.drawImage(
              Img.gtower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower3'){
            ctx.drawImage(
              Img.gtower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower0'){
            ctx.drawImage(
              Img.gothtower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower1'){
            ctx.drawImage(
              Img.gothtower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower2'){
            ctx.drawImage(
              Img.gothtower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower3'){
            ctx.drawImage(
              Img.gothtower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower0'){
            ctx.drawImage(
              Img.franktower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower1'){
            ctx.drawImage(
              Img.franktower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower2'){
            ctx.drawImage(
              Img.franktower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower3'){
            ctx.drawImage(
              Img.franktower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower0'){
            ctx.drawImage(
              Img.tower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower1'){
            ctx.drawImage(
              Img.tower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower2'){
            ctx.drawImage(
              Img.tower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower3'){
            ctx.drawImage(
              Img.tower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower4'){
            ctx.drawImage(
              Img.tower4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower5'){
            ctx.drawImage(
              Img.tower5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower6'){
            ctx.drawImage(
              Img.tower6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower7'){
            ctx.drawImage(
              Img.tower7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower8'){
            ctx.drawImage(
              Img.tower8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern0'){
            ctx.drawImage(
              Img.tavern0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern1'){
            ctx.drawImage(
              Img.tavern1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern2'){
            ctx.drawImage(
              Img.tavern2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern3'){
            ctx.drawImage(
              Img.tavern3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern4'){
            ctx.drawImage(
              Img.tavern4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern5'){
            ctx.drawImage(
              Img.tavern5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern6'){
            ctx.drawImage(
              Img.tavern6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern7'){
            ctx.drawImage(
              Img.tavern7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern8'){
            ctx.drawImage(
              Img.tavern8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern9'){
            ctx.drawImage(
              Img.tavern9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern10'){
            ctx.drawImage(
              Img.tavern10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern11'){
            ctx.drawImage(
              Img.tavern11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern12'){
            ctx.drawImage(
              Img.tavern12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern13'){
            ctx.drawImage(
              Img.tavern13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern14'){
            ctx.drawImage(
              Img.tavern14, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern15'){
            ctx.drawImage(
              Img.tavern15, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern16'){
            ctx.drawImage(
              Img.tavern16, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery0'){
            ctx.drawImage(
              Img.monastery0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery1'){
            ctx.drawImage(
              Img.monastery1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery2'){
            ctx.drawImage(
              Img.monastery2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery3'){
            ctx.drawImage(
              Img.monastery3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery4'){
            ctx.drawImage(
              Img.monastery4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery5'){
            ctx.drawImage(
              Img.monastery5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery6'){
            ctx.drawImage(
              Img.monastery6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery7'){
            ctx.drawImage(
              Img.monastery7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery8'){
            ctx.drawImage(
              Img.monastery8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery9'){
            ctx.drawImage(
              Img.monastery9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery10'){
            ctx.drawImage(
              Img.monastery10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery11'){
            ctx.drawImage(
              Img.monastery11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery12'){
            ctx.drawImage(
              Img.monastery12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery13'){
            ctx.drawImage(
              Img.monastery13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market0'){
            ctx.drawImage(
              Img.market0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market1'){
            ctx.drawImage(
              Img.market1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market2'){
            ctx.drawImage(
              Img.market2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market3'){
            ctx.drawImage(
              Img.market3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market4'){
            ctx.drawImage(
              Img.market4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market5'){
            ctx.drawImage(
              Img.market5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market6'){
            ctx.drawImage(
              Img.market6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market7'){
            ctx.drawImage(
              Img.market7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market8'){
            ctx.drawImage(
              Img.market8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market9'){
            ctx.drawImage(
              Img.market9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market10'){
            ctx.drawImage(
              Img.market10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market11'){
            ctx.drawImage(
              Img.market11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket0'){
            ctx.drawImage(
              Img.gothmarket0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket1'){
            ctx.drawImage(
              Img.gothmarket1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket2'){
            ctx.drawImage(
              Img.gothmarket2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket3'){
            ctx.drawImage(
              Img.gothmarket3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket4'){
            ctx.drawImage(
              Img.gothmarket4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket5'){
            ctx.drawImage(
              Img.gothmarket5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket6'){
            ctx.drawImage(
              Img.gothmarket6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket7'){
            ctx.drawImage(
              Img.gothmarket7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket0'){
            ctx.drawImage(
              Img.frankmarket0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket1'){
            ctx.drawImage(
              Img.frankmarket1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket2'){
            ctx.drawImage(
              Img.frankmarket2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket3'){
            ctx.drawImage(
              Img.frankmarket3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket4'){
            ctx.drawImage(
              Img.frankmarket4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket5'){
            ctx.drawImage(
              Img.frankmarket5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket6'){
            ctx.drawImage(
              Img.frankmarket6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket7'){
            ctx.drawImage(
              Img.frankmarket7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket8'){
            ctx.drawImage(
              Img.frankmarket8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket9'){
            ctx.drawImage(
              Img.frankmarket9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket10'){
            ctx.drawImage(
              Img.frankmarket10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket11'){
            ctx.drawImage(
              Img.frankmarket11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable0'){
            ctx.drawImage(
              Img.stable0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable1'){
            ctx.drawImage(
              Img.stable1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable2'){
            ctx.drawImage(
              Img.stable2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable3'){
            ctx.drawImage(
              Img.stable3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable4'){
            ctx.drawImage(
              Img.stable4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable5'){
            ctx.drawImage(
              Img.stable5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable6'){
            ctx.drawImage(
              Img.stable6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable7'){
            ctx.drawImage(
              Img.stable7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable8'){
            ctx.drawImage(
              Img.stable8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable9'){
            ctx.drawImage(
              Img.stable9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable10'){
            ctx.drawImage(
              Img.stable10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable11'){
            ctx.drawImage(
              Img.stable11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock0'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock1'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock2'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock3'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock4'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock5'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison0'){
            ctx.drawImage(
              Img.garrison0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison1'){
            ctx.drawImage(
              Img.garrison1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison2'){
            ctx.drawImage(
              Img.garrison2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison3'){
            ctx.drawImage(
              Img.garrison3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison4'){
            ctx.drawImage(
              Img.garrison4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison5'){
            ctx.drawImage(
              Img.garrison5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison6'){
            ctx.drawImage(
              Img.garrison6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison7'){
            ctx.drawImage(
              Img.garrison7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison8'){
            ctx.drawImage(
              Img.garrison8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison9'){
            ctx.drawImage(
              Img.garrison9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison10'){
            ctx.drawImage(
              Img.garrison10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison11'){
            ctx.drawImage(
              Img.garrison11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge0'){
            ctx.drawImage(
              Img.forge0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge1'){
            ctx.drawImage(
              Img.forge1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge2'){
            ctx.drawImage(
              Img.forge2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge3'){
            ctx.drawImage(
              Img.forge3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge4'){
            ctx.drawImage(
              Img.forge4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge5'){
            ctx.drawImage(
              Img.forge5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold0'){
            ctx.drawImage(
              Img.stronghold0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold1'){
            ctx.drawImage(
              Img.stronghold1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold2'){
            ctx.drawImage(
              Img.stronghold2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold3'){
            ctx.drawImage(
              Img.stronghold3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold4'){
            ctx.drawImage(
              Img.stronghold4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold5'){
            ctx.drawImage(
              Img.stronghold5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold6'){
            ctx.drawImage(
              Img.stronghold6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold7'){
            ctx.drawImage(
              Img.stronghold7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold8'){
            ctx.drawImage(
              Img.stronghold8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold9'){
            ctx.drawImage(
              Img.stronghold9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold10'){
            ctx.drawImage(
              Img.stronghold10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold11'){
            ctx.drawImage(
              Img.stronghold11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold12'){
            ctx.drawImage(
              Img.stronghold12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold13'){
            ctx.drawImage(
              Img.stronghold13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold14'){
            ctx.drawImage(
              Img.stronghold14, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold15'){
            ctx.drawImage(
              Img.stronghold15, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold16'){
            ctx.drawImage(
              Img.stronghold16, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold17'){
            ctx.drawImage(
              Img.stronghold17, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold18'){
            ctx.drawImage(
              Img.stronghold18, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold19'){
            ctx.drawImage(
              Img.stronghold19, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold20'){
            ctx.drawImage(
              Img.stronghold20, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold21'){
            ctx.drawImage(
              Img.stronghold21, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold22'){
            ctx.drawImage(
              Img.stronghold22, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold23'){
            ctx.drawImage(
              Img.stronghold23, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold24'){
            ctx.drawImage(
              Img.stronghold24, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold25'){
            ctx.drawImage(
              Img.stronghold25, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold26'){
            ctx.drawImage(
              Img.stronghold26, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold27'){
            ctx.drawImage(
              Img.stronghold27, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold28'){
            ctx.drawImage(
              Img.stronghold28, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold29'){
            ctx.drawImage(
              Img.stronghold29, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold30'){
            ctx.drawImage(
              Img.stronghold30, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold31'){
            ctx.drawImage(
              Img.stronghold31, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold32'){
            ctx.drawImage(
              Img.stronghold32, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold33'){
            ctx.drawImage(
              Img.stronghold33, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold34'){
            ctx.drawImage(
              Img.stronghold34, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold35'){
            ctx.drawImage(
              Img.stronghold35, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold36'){
            ctx.drawImage(
              Img.stronghold36, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold37'){
            ctx.drawImage(
              Img.stronghold37, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold38'){
            ctx.drawImage(
              Img.stronghold38, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold39'){
            ctx.drawImage(
              Img.stronghold39, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold40'){
            ctx.drawImage(
              Img.stronghold40, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold41'){
            ctx.drawImage(
              Img.stronghold41, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold42'){
            ctx.drawImage(
              Img.stronghold42, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold43'){
            ctx.drawImage(
              Img.stronghold43, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold44'){
            ctx.drawImage(
              Img.stronghold44, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold45'){
            ctx.drawImage(
              Img.stronghold45, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold46'){
            ctx.drawImage(
              Img.stronghold46, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold47'){
            ctx.drawImage(
              Img.stronghold47, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold48'){
            ctx.drawImage(
              Img.stronghold48, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold49'){
            ctx.drawImage(
              Img.stronghold49, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold50'){
            ctx.drawImage(
              Img.stronghold50, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold51'){
            ctx.drawImage(
              Img.stronghold51, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold52'){
            ctx.drawImage(
              Img.stronghold52, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold53'){
            ctx.drawImage(
              Img.stronghold53, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold54'){
            ctx.drawImage(
              Img.stronghold54, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold55'){
            ctx.drawImage(
              Img.stronghold55, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold56'){
            ctx.drawImage(
              Img.stronghold56, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold57'){
            ctx.drawImage(
              Img.stronghold57, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } else if(z == -1){
    var morecave = ctx.createPattern(Img.cavefloor, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = morecave;
    ctx.fill();
    var evenmorecave = ctx.createPattern(Img.cavewall, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = evenmorecave;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var tile = getTile(1, c, r);
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        if(tile == 0){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 1){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 2){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.caveout, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.3){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.6){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 4){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z == -2){
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(8, c, r);
        var below = getTile(8,c,r+1);
        if(tile == 1){
          ctx.drawImage(
            Img.stonefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 0 && below == 1){
          ctx.drawImage(
            Img.stonewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 5){
          ctx.drawImage(
            Img.sstairsu, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else {
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z == -3){
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        if(tile == 11.5 || tile == 12.5 || tile == 20 || tile == 20.5){
          ctx.drawImage(
            Img.woodfloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 0){
          ctx.drawImage(
            Img.sand, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else {
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z == 1){
    // In spectate mode, use camera position instead of selfId
    var cameraX, cameraY;
    if(spectateCameraSystem && spectateCameraSystem.isActive) {
      cameraX = spectateCameraSystem.cameraX;
      cameraY = spectateCameraSystem.cameraY;
    } else if(!selfId || !Player.list[selfId]){
      return; // Exit early if no valid player and not in spectate mode
    } else {
      cameraX = Player.list[selfId].x;
      cameraY = Player.list[selfId].y;
    }
    var pBuilding = getBuilding(cameraX, cameraY, true);
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        var wtile = getTile(4, c, r);
        var bCoords = getCoords(c,r);
        var bbCoords = getCoords(c,r+1);
        var building = getBuilding(bCoords[0],bCoords[1], true);
        var bbuilding = getBuilding(bbCoords[0],bbCoords[1], true);
        if(pBuilding == building || pBuilding == bbuilding){
          if(wtile == 1){
            ctx.drawImage(
              Img.woodwall, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 2){
            ctx.drawImage(
              Img.stonewall, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 3){
            ctx.drawImage(
              Img.wstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 4){
            ctx.drawImage(
              Img.sstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 5){
            ctx.drawImage(
              Img.wstairsd, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 6){
            ctx.drawImage(
              Img.sstairsd, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 7){
            ctx.drawImage(
              Img.lstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 13){
            ctx.drawImage(
              Img.woodfloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 14){
            ctx.drawImage(
              Img.woodexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 15){
            ctx.drawImage(
              Img.stonefloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 16){
            ctx.drawImage(
              Img.stoneexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 17){
            ctx.drawImage(
              Img.carpet, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 19){
            ctx.drawImage(
              Img.stoneexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } else if(z == 2){
    // In spectate mode, use camera position instead of selfId
    var cameraX, cameraY;
    if(spectateCameraSystem && spectateCameraSystem.isActive) {
      cameraX = spectateCameraSystem.cameraX;
      cameraY = spectateCameraSystem.cameraY;
    } else if(!selfId || !Player.list[selfId]){
      return; // Exit early if no valid player and not in spectate mode
    } else {
      cameraX = Player.list[selfId].x;
      cameraY = Player.list[selfId].y;
    }
    var pBuilding = getBuilding(cameraX, cameraY, true);
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(5, c, r);
        var wtile = getTile(4, c, r);
        var below = getTile(5, c, r+1);
        var bCoords = getCoords(c,r);
        var bbCoords = getCoords(c,r+1);
        var building = getBuilding(bCoords[0],bCoords[1], true);
        var bbuilding = getBuilding(bbCoords[0],bbCoords[1], true);
        if(pBuilding == building || pBuilding == bbuilding){
          if(wtile == 1){
            if(below != 0){
              ctx.drawImage(
                Img.woodwall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 2){
            if(below != 0){
              ctx.drawImage(
                Img.stonewall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 3){
            if(below != 0){
              ctx.drawImage(
                Img.wstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 4){
            if(below != 0){
              ctx.drawImage(
                Img.sstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 5){
            if(below != 0){
              ctx.drawImage(
                Img.woodwall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 6){
            if(below != 0){
              ctx.drawImage(
                Img.stonewall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 7){
            if(below != 0){
              ctx.drawImage(
                Img.sstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(tile == 13){
            ctx.drawImage(
              Img.woodfloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 17){
            ctx.drawImage(
              Img.carpet, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 15){
            ctx.drawImage(
              Img.stonefloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } // Close if(z == 2) block
  } // Close render method
}

// Draw borders around hovered/selected entities
var drawEntityBorders = function(renderCtx){
  // Use provided context or fall back to global ctx
  // If renderCtx is provided, use it; otherwise try to access global ctx
  var ctxToUse = renderCtx;
  if(!ctxToUse) {
    // Try window.ctx first (set by CanvasInitializer)
    if(typeof window !== 'undefined' && window.ctx) {
      ctxToUse = window.ctx;
    } else {
      // Fallback: use global ctx variable if it exists (original behavior)
      // Access global ctx by not shadowing it - check if it exists in outer scope
      try {
        // eslint-disable-next-line no-undef
        ctxToUse = ctx; // Reference global ctx
      } catch(e) {
        ctxToUse = null;
      }
    }
  }
  if(!ctxToUse) return;
  
  // Use ctxToUse as ctx for the rest of the function
  var ctx = ctxToUse;
  
  // Get selfId from window (updated by SocketMessageHandler) or global scope
  var currentSelfId = null;
  if(typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null) {
    currentSelfId = window.selfId;
  } else if(typeof selfId !== 'undefined') {
    currentSelfId = selfId;
  }
  
  // Only draw if we have a player and valid targets
  if(!currentSelfId || !Player.list[currentSelfId]) return;
  
  var player = Player.list[currentSelfId];
  var currentZ = getCurrentZ();
  var cameraPos = getCameraPosition();
  
  // Get allyCheck function from window or global scope
  var allyCheckFn = null;
  if(typeof window !== 'undefined' && typeof window.allyCheck === 'function') {
    allyCheckFn = window.allyCheck;
  } else if(typeof allyCheck === 'function') {
    allyCheckFn = allyCheck;
  }
  
  // Get hoveredTarget and selectedTarget from InputHandler config if available, otherwise use globals
  var currentHoveredTarget = null;
  var currentSelectedTarget = null;
  
  // Try to get from InputHandler first (where they're actually updated)
  if(typeof window !== 'undefined' && window.inputHandler && window.inputHandler.config) {
    currentHoveredTarget = window.inputHandler.config.hoveredTarget;
    currentSelectedTarget = window.inputHandler.config.selectedTarget;
  }
  // Fallback to global variables
  if(currentHoveredTarget === null || currentHoveredTarget === undefined) {
    currentHoveredTarget = (typeof hoveredTarget !== 'undefined') ? hoveredTarget : null;
  }
  if(currentSelectedTarget === null || currentSelectedTarget === undefined) {
    currentSelectedTarget = (typeof selectedTarget !== 'undefined') ? selectedTarget : null;
  }
  
  // Check if we have any hovered or selected targets
  if(!currentHoveredTarget && !currentSelectedTarget) return;
  
  // Get current z-layer
  var z = getCurrentZ();
  
  // Draw borders for hovered and selected entities
  // Priority: selected units always show thick border, even when hovered
  var targetsToDraw = [];
  // First, add selected targets (they get priority with thick borders)
  if(currentSelectedTarget && Player.list[currentSelectedTarget]) {
    targetsToDraw.push({id: currentSelectedTarget, isSelected: true});
  }
  // Then add hovered targets only if they're not already selected
  if(currentHoveredTarget && Player.list[currentHoveredTarget] && currentHoveredTarget !== currentSelectedTarget) {
    targetsToDraw.push({id: currentHoveredTarget, isSelected: false});
  }
  
  for(var i = 0; i < targetsToDraw.length; i++){
    var targetData = targetsToDraw[i];
    var entity = Player.list[targetData.id];
    if(!entity || entity.z !== z) continue;
    
    // Skip Falcons - their sprites are massive (include shadows) and shouldn't have borders
    if(entity.class === 'Falcon') continue;
    
    // Check innaWoods compatibility (only applies to overworld z=0)
    // Only block if player is NOT in woods and entity IS in woods
    // Players with innaWoods=true can see all units
    if(z === 0) {
      var playerInnaWoods = player.innaWoods || false;
      var entityInnaWoods = entity.innaWoods || false;
      if(!playerInnaWoods && entityInnaWoods) {
        continue; // Skip entities in woods when player is not in woods
      }
    }
    
    // Calculate sprite size (accounting for scaling)
    var shouldScale = (entity.class === 'Wolf' || entity.class === 'Boar') && entity.spriteScale;
    var scaledSpriteSize = shouldScale ? (entity.spriteSize * entity.spriteScale) : (entity.spriteSize || 64);
    
    // Calculate screen position (same as in entity draw function)
    var x = (entity.x - (scaledSpriteSize/2)) - cameraPos.x + WIDTH/2;
    var y = (entity.y - (scaledSpriteSize/2)) - cameraPos.y + HEIGHT/2;
    
    // Determine border color based on ally status
    var allied = 0;
    if(allyCheckFn && currentSelfId) {
      try {
        allied = allyCheckFn(entity.id);
      } catch(e) {
        console.warn('Error calling allyCheck:', e);
        allied = 0;
      }
    } else if(currentSelfId && entity) {
      // Fallback: basic enemy detection when allyCheck is not available
      // Wild animals are always enemies
      const wildAnimals = ['Wolf', 'Boar'];
      if(wildAnimals.includes(entity.class)) {
        allied = -1;
      } else if(currentSelfId === entity.id) {
        allied = 2; // Self
      } else {
        allied = 0; // Neutral (default to green if we can't determine)
      }
    }
    
    // Debug logging (only log occasionally to avoid spam)
    if(Math.random() < 0.01) {
      console.log('Border color check:', {
        entityId: entity.id,
        entityClass: entity.class,
        selfId: currentSelfId,
        allied: allied,
        allyCheckFn: !!allyCheckFn
      });
    }
    
    var borderColor = (allied === -1) ? '#ff0000' : '#00ff00'; // Red for enemies, green for allies
    
    // Draw border
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    var borderWidth = targetData.isSelected ? 3 : 2; // 3px for selected, 2px for hover
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    
    var halfBorder = borderWidth / 2;
    ctx.beginPath();
    ctx.rect(
      x - halfBorder, 
      y - halfBorder, 
      scaledSpriteSize + borderWidth, 
      scaledSpriteSize + borderWidth
    );
    ctx.stroke();
    ctx.restore();
  }
};

var renderTops = function(){
  // Get current z-layer (works for login camera, god mode, and normal play)
  var z = getCurrentZ();
  
  if(z == 0){
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(5, c, r);
        if(tile == 'mill4'){
          ctx.drawImage(
            Img.mill4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'mill5'){
          ctx.drawImage(
            Img.mill5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'lumbermill2'){
          ctx.drawImage(
            Img.lumbermill2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'lumbermill3'){
          ctx.drawImage(
            Img.lumbermill3, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'outpost1'){
          ctx.drawImage(
            Img.outpost1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gtower4'){
          ctx.drawImage(
            Img.gtower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gtower5'){
          ctx.drawImage(
            Img.gtower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothtower4'){
          ctx.drawImage(
            Img.gothtower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothtower5'){
          ctx.drawImage(
            Img.gothtower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'franktower4'){
          ctx.drawImage(
            Img.franktower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'franktower5'){
          ctx.drawImage(
            Img.franktower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower9'){
          ctx.drawImage(
            Img.tower9, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower10'){
          ctx.drawImage(
            Img.tower10, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower11'){
          ctx.drawImage(
            Img.tower11, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower12'){
          ctx.drawImage(
            Img.tower12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower13'){
          ctx.drawImage(
            Img.tower13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower14'){
          ctx.drawImage(
            Img.tower14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tavern17'){
          ctx.drawImage(
            Img.tavern17, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tavern18'){
          ctx.drawImage(
            Img.tavern18, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tavern19'){
          ctx.drawImage(
            Img.tavern19, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'monastery14'){
          ctx.drawImage(
            Img.monastery14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'monastery15'){
          ctx.drawImage(
            Img.monastery15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'monastery16'){
          ctx.drawImage(
            Img.monastery16, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market12'){
          ctx.drawImage(
            Img.market12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market13'){
          ctx.drawImage(
            Img.market13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market14'){
          ctx.drawImage(
            Img.market14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market15'){
          ctx.drawImage(
            Img.market15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market16'){
          ctx.drawImage(
            Img.market16, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothmarket8'){
          ctx.drawImage(
            Img.gothmarket8, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothmarket9'){
          ctx.drawImage(
            Img.gothmarket9, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket12'){
          ctx.drawImage(
            Img.frankmarket12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket13'){
          ctx.drawImage(
            Img.frankmarket13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket14'){
          ctx.drawImage(
            Img.frankmarket14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket15'){
          ctx.drawImage(
            Img.frankmarket15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }  else if(tile == 'stable12'){
          ctx.drawImage(
            Img.stable12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stable13'){
          ctx.drawImage(
            Img.stable13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stable14'){
          ctx.drawImage(
            Img.stable14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'dock6'){
          ctx.drawImage(
            Img.dock6, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'dock7'){
          ctx.drawImage(
            Img.dock7, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'dock8'){
          ctx.drawImage(
            Img.dock8, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'garrison12'){
          ctx.drawImage(
            Img.garrison12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'garrison13'){
          ctx.drawImage(
            Img.garrison13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'garrison14'){
          ctx.drawImage(
            Img.garrison14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'forge6'){
          ctx.drawImage(
            Img.forge6, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'forge7'){
          ctx.drawImage(
            Img.forge7, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gateo'){
          if(getTile(3,c-1,r) == 'wall'){
            ctx.drawImage(
              Img.gateo0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else {
            ctx.drawImage(
              Img.gateo1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        } else if(tile == 'gatec'){
          if(getTile(3,c-1,r) == 'wall'){
            ctx.drawImage(
              Img.gatec0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else {
            ctx.drawImage(
              Img.gatec1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        } else if(tile == 'stronghold58'){
          ctx.drawImage(
            Img.stronghold58, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold59'){
          ctx.drawImage(
            Img.stronghold59, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold60'){
          ctx.drawImage(
            Img.stronghold60, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold61'){
          ctx.drawImage(
            Img.stronghold61, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold62'){
          ctx.drawImage(
            Img.stronghold62, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold63'){
          ctx.drawImage(
            Img.stronghold63, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold64'){
          ctx.drawImage(
            Img.stronghold64, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold65'){
          ctx.drawImage(
            Img.stronghold65, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold66'){
          ctx.drawImage(
            Img.stronghold66, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  }
};

// Helper function to convert distance to alpha value for forest transparency
var getForestAlpha = function(dist) {
  if (dist === 40) return 0.4;
  if (dist === 60) return 0.6;
  if (dist === 80) return 0.8;
  return 1.0; // Default: fully opaque for null (beyond ring 3) or any other value
};

var renderForest = function(){
  // Get camera position (works for both logged in and login mode)
  var cameraPos = getCameraPosition();
  var pLoc = getLoc(cameraPos.x, cameraPos.y);
  var pc = pLoc[0];
  var pr = pLoc[1];

  // Get current z-layer (supports god mode, login mode, and normal play)
  var z = getCurrentZ();
  if(z != 0){
    return; // Only render forest on overworld
  }

  // Render forest for overworld (z=0)
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        
        // Optimized distance calculation: compute once using Chebyshev distance (max of dx, dy)
        // Ring 1 (distance 40): immediate 3x3 grid (distance <= 1)
        // Ring 2 (distance 60): next ring out (distance == 2)
        // Ring 3 (distance 80): outer ring (distance == 3)
        var dc = Math.abs(c - pc);
        var dr = Math.abs(r - pr);
        var maxDist = Math.max(dc, dr);
        var dist = null; // null means no overlay (beyond ring 3)
        if(maxDist <= 1){
          dist = 40;
        } else if(maxDist == 2){
          dist = 60;
        } else if(maxDist == 3){
          dist = 80;
        }
        
        // Calculate alpha based on distance
        var alpha = getForestAlpha(dist);
        
        var tile = getTile(0, c, r);
        if(tile >= 1 && tile < 1.3){
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            Img.hforest, // Always use base image with runtime alpha
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/1.75), // target y
            tileSize, // target width
            tileSize * 1.5 // target height
          );
          ctx.globalAlpha = 1.0; // Reset alpha
        } else if(tile >= 1 && tile < 1.6){
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            Img.hforest, // Always use base image with runtime alpha
            xOffset, // target x
            yOffset - (tileSize/1.25), // target y
            tileSize, // target width
            tileSize * 1.5 // target height
          );
          ctx.globalAlpha = 1.0; // Reset alpha
        } else if(tile >= 1 && tile < 2){
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            Img.hforest, // Always use base image with runtime alpha
            xOffset, // target x
            yOffset - (tileSize/2), // target y
            tileSize, // target width
            tileSize * 1.5 // target height
          );
          ctx.globalAlpha = 1.0; // Reset alpha
        }
      }
    }
}


// Export for browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapRenderer;
} else {
  window.MapRenderer = MapRenderer;
  window.renderForest = renderForest; // Expose renderForest for use in GameRenderer
}
