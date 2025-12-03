/**
 * ItemRenderer - Handles rendering of Item entities on the map
 * 
 * Extracted from client.js - consolidates 1,300+ lines of repetitive item rendering code
 * into a clean, maintainable lookup-based system.
 */

class ItemRenderer {
  constructor() {
    // Item image lookup map - maps item type to image name(s)
    // Quantity-based items use arrays: [single, plural, ...]
    this.itemImageMap = {
      'Wood': { images: ['wood1', 'wood2', 'wood3'], thresholds: [0, 5, 10] },
      'Stone': { images: ['stone1', 'stone2'], thresholds: [0, 10] },
      'Grain': { images: ['grain1', 'grain2', 'grain3'], thresholds: [0, 5, 10] },
      'IronOre': { image: 'ore1' },
      'Iron': { images: ['ironbar', 'ironbars'], thresholds: [0, 5] },
      'Steel': { images: ['steelbar', 'steelbars'], thresholds: [0, 5] },
      'BoarHide': { images: ['boarhide', 'boarhides'], thresholds: [0, 5] },
      'Leather': { images: ['leather', 'leathers'], thresholds: [0, 5] },
      'SilverOre': { image: 'ore1' },
      'Silver': { 
        images: ['silver1', 'silver2', 'silver3', 'silver4', 'silver5', 'silver6', 'silver7', 'silver8', 'silver9'], 
        thresholds: [0, 5, 10, 25, 50, 100, 250, 500, 1000] 
      },
      'GoldOre': { image: 'ore2' },
      'Gold': { 
        images: ['gold1', 'gold2', 'gold3', 'gold4', 'gold5', 'gold6', 'gold7', 'gold8', 'gold9'], 
        thresholds: [0, 5, 10, 25, 50, 100, 250, 500, 1000] 
      },
      'Diamond': { images: ['diamond', 'diamonds'], thresholds: [0, 3] },
      
      // Weapons
      'HuntingKnife': { image: 'dagger1' },
      'Dague': { image: 'dagger2' },
      'Rondel': { image: 'dagger2' },
      'Misericorde': { image: 'dagger3' },
      'BastardSword': { image: 'sword1' },
      'Longsword': { image: 'sword2' },
      'Zweihander': { image: 'sword2' },
      'Morallta': { image: 'sword3' },
      'Bow': { image: 'bow' },
      'WelshLongbow': { image: 'longbow' },
      'KnightLance': { image: 'lance1' },
      'RusticLance': { image: 'lance1' },
      'PaladinLance': { image: 'lance2' },
      
      // Armor
      'Brigandine': { image: 'leathergarb' },
      'Lamellar': { image: 'leathergarb' },
      'Maille': { image: 'chainmail' },
      'Hauberk': { image: 'chainmail' },
      'Brynja': { image: 'chainmail' },
      'Cuirass': { image: 'plate1' },
      'SteelPlate': { image: 'plate1' },
      'GreenwichPlate': { image: 'plate2' },
      'GothicPlate': { image: 'plate3' },
      'ClericRobe': { image: 'robe1' },
      'MonkCowl': { image: 'robe2' },
      'BlackCloak': { image: 'robe3' },
      
      // Magic items
      'Tome': { image: 'tome' },
      'RunicScroll': { image: 'scroll' },
      'SacredText': { image: 'sacredtext' },
      
      // Tools
      'Stoneaxe': { image: 'axe' },
      'IronAxe': { image: 'axe' },
      'Pickaxe': { image: 'pickaxe' },
      'Key': { image: 'key' },
      
      // Light sources
      'Torch': { image: 'torch', static: true },
      'LitTorch': { animated: 'torchFlame' },
      'WallTorch': { animated: 'wtorchFlame' },
      'Campfire': { animated: 'fireFlame' },
      'Firepit': { animated: 'firepitFlame' },
      'Fireplace': { animated: 'fireplaceFlame' },
      'Furnace': { animated: 'forgeFlame', scale: 1.5 },
      
      // Furniture & Decor
      'Barrel': { image: 'barrel' },
      'Crates': { image: 'crates' },
      'Bookshelf': { image: 'bookshelf', scale: 1.5 },
      'SuitArmor': { image: 'suitarmor', scale: 1.5 },
      'Anvil': { image: 'anvil' },
      'Runestone': { image: 'runestone' },
      'Dummy': { image: 'dummy' },
      'Cross': { image: 'cross', scale: { w: 2, h: 1.5 } },
      'Skeleton1': { image: 'skeleton1' },
      'Skeleton2': { image: 'skeleton2' },
      'StagHead': { image: 'staghead' },
      'Blood': { image: 'blood' },
      
      // Containers
      'Chest': { image: 'chest' },
      'LockedChest': { image: 'chest' },
      
      // Food
      'Bread': { images: ['bread', 'breads'], thresholds: [0, 5] },
      'Fish': { images: ['fish', 'fishes'], thresholds: [0, 5] },
      'Lamb': { images: ['rawmeat', 'rawmeats'], thresholds: [0, 5] },
      'BoarMeat': { images: ['rawmeat', 'rawmeats'], thresholds: [0, 5] },
      'Venison': { images: ['rawmeat', 'rawmeats'], thresholds: [0, 5] },
      'PoachedFish': { images: ['poachedfish', 'poachedfishes'], thresholds: [0, 5] },
      'LambChop': { images: ['cookedmeat', 'cookedmeats'], thresholds: [0, 5] },
      'BoarShank': { images: ['cookedmeat', 'cookedmeats'], thresholds: [0, 5] },
      'VenisonLoin': { images: ['cookedmeat', 'cookedmeats'], thresholds: [0, 5] },
      
      // Drinks
      'Mead': { images: ['beer', 'beers'], thresholds: [0, 3] },
      'Saison': { images: ['beer', 'beers'], thresholds: [0, 3] },
      'Flanders': { images: ['bottle1', 'bottles1'], thresholds: [0, 3] },
      'BiereDeGarde': { images: ['bottle1', 'bottles1'], thresholds: [0, 3] },
      'Bordeaux': { images: ['bottle2', 'bottles2'], thresholds: [0, 3] },
      'Bourgogne': { images: ['bottle2', 'bottles2'], thresholds: [0, 3] },
      'Chianti': { images: ['bottle2', 'bottles2'], thresholds: [0, 3] },
      
      // Special items
      'Crown': { image: 'crown' },
      'Arrows': { image: 'arrows' },
      'WorldMap': { image: 'map' },
      'Relic': { image: 'relic' },
      
      // Ship wreckage
      'shipwreckage': { 
        images: ['shipwreckage', 'shipwreckagesunk'], 
        conditional: 'sunk' // Use sunk property to determine which image
      },
      
      // Cargo/Goods
      'Goods1': { image: 'goods1', scale: 1.5 },
      'Goods2': { image: 'goods2', scale: 1.5 },
      'Goods3': { image: 'goods3', scale: 1.5 },
      'Goods4': { image: 'goods4', scale: 1.5 },
      'Stash1': { image: 'stash1', scale: 1.5 },
      'Stash2': { image: 'stash2', scale: 1.5 },
      
      // Furniture
      'Desk': { image: 'desk' },
      'Swordrack': { image: 'swordrack', scale: 1.5 },
      'Bed': { image: 'bed', scale: { w: 2, h: 2 } },
      'Jail': { image: 'jail' },
      'JailDoor': { image: 'jaildoor' },
      'Chains': { image: 'chains' },
      'Throne': { image: 'throne', offset: { x: 0.5 }, scale: 1.5 },
      'Banner': { image: 'banner' }
    };
  }

  /**
   * Get image for item based on type and quantity
   * @param {string} itemType - Item type
   * @param {number} qty - Item quantity
   * @param {object} item - Item object (for conditional properties)
   * @param {object} Img - Image assets
   * @returns {Image|null} Image or null
   */
  getItemImage(itemType, qty, item, Img) {
    const config = this.itemImageMap[itemType];
    if (!config) return null;

    // Handle animated items (flames, etc.)
    if (config.animated) {
      return null; // Handled separately
    }

    // Handle conditional images (e.g., sunk shipwreckage)
    if (config.conditional && item) {
      const conditionValue = item[config.conditional];
      if (config.images && config.images.length === 2) {
        return Img[config.images[conditionValue ? 1 : 0]];
      }
    }

    // Handle quantity-based images
    if (config.images && config.thresholds) {
      let imageIndex = 0;
      for (let i = config.thresholds.length - 1; i >= 0; i--) {
        if (qty > config.thresholds[i]) {
          imageIndex = i;
          break;
        }
      }
      return Img[config.images[imageIndex]];
    }

    // Handle single image
    if (config.image) {
      return Img[config.image];
    }

    return null;
  }

  /**
   * Render an item entity
   * @param {object} item - Item entity
   * @param {object} ctx - Canvas context
   * @param {object} config - Configuration { cameraPos, WIDTH, HEIGHT, tileSize, Img, animatedFrames }
   */
  render(item, ctx, config) {
    const { cameraPos, WIDTH, HEIGHT, tileSize, Img, animatedFrames } = config;
    
    // Calculate screen position
    const x = item.x - cameraPos.x + WIDTH / 2;
    const y = item.y - cameraPos.y + HEIGHT / 2;

    const configMap = this.itemImageMap[item.type];
    if (!configMap) return;

    // Handle animated items (flames, etc.)
    if (configMap.animated && animatedFrames) {
      const frameArray = animatedFrames[configMap.animated];
      if (frameArray && frameArray.length > 0) {
        const frameIndex = animatedFrames.frameIndex || 0;
        const frame = frameArray[frameIndex % frameArray.length];
        if (frame) {
          const scale = configMap.scale || 1.0;
          const width = typeof scale === 'object' ? tileSize * scale.w : tileSize * scale;
          const height = typeof scale === 'object' ? tileSize * scale.h : tileSize * scale;
          ctx.drawImage(frame, x, y, width, height);
        }
      }
      return;
    }

    // Get static image
    const image = this.getItemImage(item.type, item.qty || 1, item, Img);
    if (!image) return;

    // Handle scale
    let scaleX = tileSize;
    let scaleY = tileSize;
    
    if (configMap.scale) {
      if (typeof configMap.scale === 'object') {
        scaleX = tileSize * configMap.scale.w;
        scaleY = tileSize * configMap.scale.h;
      } else {
        scaleX = tileSize * configMap.scale;
        scaleY = tileSize * configMap.scale;
      }
    }

    // Handle offset (e.g., Throne)
    let offsetX = 0;
    let offsetY = 0;
    if (configMap.offset) {
      offsetX = configMap.offset.x ? tileSize * configMap.offset.x : 0;
      offsetY = configMap.offset.y ? tileSize * configMap.offset.y : 0;
    }

    ctx.drawImage(image, x + offsetX, y + offsetY, scaleX, scaleY);
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ItemRenderer = ItemRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ItemRenderer;
}
