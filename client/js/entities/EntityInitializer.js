/**
 * EntityInitializer - Initializes entity constructors with fallback support
 * 
 * Extracted from client.js for better organization.
 */

class EntityInitializer {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize all entity constructors with fallback support
   * @param {object} config - Configuration object
   */
  init(config) {
    if (this.initialized) {
      console.warn('[EntityInitializer] Already initialized');
      return;
    }

    const { Building, Player, Arrow, Item, Light } = config;

    // Initialize Building constructor
    if (typeof window !== 'undefined') {
      if (typeof BuildingEntity !== 'undefined') {
        window.Building = BuildingEntity;
      } else {
        window.Building = this.createBuildingFallback(Building);
      }
    }

    // Initialize Player constructor
    if (typeof window !== 'undefined') {
      if (typeof PlayerEntity !== 'undefined') {
        window.Player = PlayerEntity;
      } else {
        window.Player = this.createPlayerFallback(Player);
      }
    }

    // Initialize Arrow constructor
    if (typeof window !== 'undefined') {
      if (typeof ArrowEntity !== 'undefined') {
        window.Arrow = ArrowEntity;
      } else {
        window.Arrow = this.createArrowFallback(Arrow);
      }
    }

    // Initialize Item constructor
    if (typeof window !== 'undefined') {
      if (typeof ItemEntity !== 'undefined') {
        window.Item = ItemEntity;
      } else {
        window.Item = this.createItemFallback(Item);
      }
    }

    // Initialize Light constructor
    if (typeof window !== 'undefined') {
      if (typeof LightEntity !== 'undefined') {
        window.Light = LightEntity;
      } else {
        window.Light = this.createLightFallback(Light);
      }
    }

    this.initialized = true;
  }

  /**
   * Initialize Player constructor with sprite helper
   * @param {function} PlayerEntity - PlayerEntity constructor
   * @param {function} getSpriteForClass - Function to get sprite for class
   */
  initPlayer(PlayerEntity, getSpriteForClass) {
    if (typeof window !== 'undefined') {
      if (typeof PlayerEntity !== 'undefined') {
        // Store the sprite helper for PlayerEntity to use
        if (typeof getSpriteForClass === 'function') {
          window.getSpriteForClass = getSpriteForClass;
        }
        window.Player = PlayerEntity;
      } else {
        window.Player = this.createPlayerFallback({ list: {} });
      }
    }
  }

  /**
   * Initialize Arrow constructor
   * @param {function} ArrowEntity - ArrowEntity constructor
   */
  initArrow(ArrowEntity) {
    if (typeof window !== 'undefined') {
      if (typeof ArrowEntity !== 'undefined') {
        window.Arrow = ArrowEntity;
      } else {
        window.Arrow = this.createArrowFallback({ list: {} });
      }
    }
  }

  /**
   * Initialize Item constructor
   * @param {function} ItemEntity - ItemEntity constructor
   */
  initItem(ItemEntity) {
    if (typeof window !== 'undefined') {
      if (typeof ItemEntity !== 'undefined') {
        window.Item = ItemEntity;
      } else {
        window.Item = this.createItemFallback({ list: {} });
      }
    }
  }

  /**
   * Initialize Light constructor
   * @param {function} LightEntity - LightEntity constructor
   */
  initLight(LightEntity) {
    if (typeof window !== 'undefined') {
      if (typeof LightEntity !== 'undefined') {
        window.Light = LightEntity;
      } else {
        window.Light = this.createLightFallback({ list: {} });
      }
    }
  }

  /**
   * Initialize Building constructor
   * @param {function} BuildingEntity - BuildingEntity constructor
   */
  initBuilding(BuildingEntity) {
    if (typeof window !== 'undefined') {
      if (typeof BuildingEntity !== 'undefined') {
        window.Building = BuildingEntity;
      } else {
        window.Building = this.createBuildingFallback({ list: {} });
      }
    }
  }

  /**
   * Create Building constructor fallback
   */
  createBuildingFallback(Building) {
    return function(initPack) {
      console.warn('BuildingEntity not available, using fallback');
      if(!Building.list) Building.list = {};
      var self = { 
        id: initPack.id, 
        type: initPack.type, 
        hp: initPack.hp, 
        occ: initPack.occ, 
        plot: initPack.plot, 
        walls: initPack.walls,
        topPlot: initPack.topPlot
      };
      Building.list[self.id] = self;
      return self;
    };
  }

  /**
   * Create Player constructor fallback
   */
  createPlayerFallback(Player) {
    return function(initPack) {
      console.warn('PlayerEntity not available, using minimal fallback');
      if(!Player.list) Player.list = {};
      var self = { 
        type: initPack.type, 
        name: initPack.name, 
        id: initPack.id, 
        x: initPack.x, 
        y: initPack.y, 
        z: initPack.z, 
        class: initPack.class,
        hp: initPack.hp,
        hpMax: initPack.hpMax,
        sprite: null,
        spriteSize: initPack.spriteSize // Server should always send spriteSize - if missing, will be set by SpriteRegistry
      };
      self.draw = function() { /* Fallback - PlayerRenderer should handle this */ };
      Player.list[self.id] = self;
      return self;
    };
  }

  /**
   * Create Arrow constructor fallback
   */
  createArrowFallback(Arrow) {
    return function(initPack) {
      console.warn('ArrowEntity not available, using fallback');
      if(!Arrow.list) Arrow.list = {};
      var self = { 
        id: initPack.id, 
        angle: initPack.angle, 
        number: initPack.number, 
        x: initPack.x, 
        y: initPack.y, 
        z: initPack.z, 
        innaWoods: initPack.innaWoods 
      };
      self.draw = function() { /* Fallback - ArrowRenderer should handle this */ };
      Arrow.list[self.id] = self;
      return self;
    };
  }

  /**
   * Create Item constructor fallback
   */
  createItemFallback(Item) {
    return function(initPack) {
      console.warn('ItemEntity not available, using minimal fallback');
      if(!Item.list) Item.list = {};
      var self = { 
        id: initPack.id, 
        type: initPack.type, 
        x: initPack.x, 
        y: initPack.y, 
        z: initPack.z, 
        qty: initPack.qty, 
        innaWoods: initPack.innaWoods, 
        sunk: initPack.sunk || false 
      };
      self.draw = function() { /* Fallback - ItemRenderer should handle this */ };
      Item.list[self.id] = self;
      return self;
    };
  }

  /**
   * Create Light constructor fallback
   */
  createLightFallback(Light) {
    return function(initPack) {
      console.warn('LightEntity not available, using fallback');
      if(!Light.list) Light.list = {};
      var self = { 
        id: initPack.id, 
        x: initPack.x, 
        y: initPack.y, 
        z: initPack.z, 
        radius: initPack.radius 
      };
      Light.list[self.id] = self;
      return self;
    };
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.EntityInitializer = EntityInitializer;
  window.entityInitializer = new EntityInitializer();
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EntityInitializer;
}

