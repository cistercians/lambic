/**
 * InventoryItemImageHelper - Helper for getting inventory item images
 * 
 * Extracted from client.js for better organization.
 */

class InventoryItemImageHelper {
  constructor() {
    // Img reference would be injected
    this.Img = null;
  }

  /**
   * Set image assets reference
   * @param {object} Img - Image assets object
   */
  setImageAssets(Img) {
    this.Img = Img;
  }

  /**
   * Get image for inventory item based on type and quantity
   * @param {string} itemType - Item type name
   * @param {number} qty - Item quantity
   * @returns {Image|null} Image element or null
   */
  getInventoryItemImage(itemType, qty) {
    if (!this.Img) return null;
    
    // Convert to lowercase for consistent comparison
    const type = itemType.toLowerCase();

    // Map item types to images
    if (type === 'worldmap') {
      return this.Img.map;
    } else if (type === 'dague' || type === 'huntingknife') {
      return qty > 2 ? this.Img.dagger3 : qty > 1 ? this.Img.dagger2 : this.Img.dagger1;
    } else if (type === 'rondel') {
      return this.Img.dagger2;
    } else if (type === 'misericorde') {
      return this.Img.dagger3;
    } else if (type === 'bastardsword') {
      return this.Img.sword1;
    } else if (type === 'longsword' || type === 'zweihander') {
      return this.Img.sword2;
    } else if (type === 'morallta') {
      return this.Img.sword3;
    } else if (type === 'bow') {
      return this.Img.bow;
    } else if (type === 'welshlongbow') {
      return this.Img.longbow;
    } else if (type === 'knightlance' || type === 'rusticlance') {
      return this.Img.lance1;
    } else if (type === 'paladinlance') {
      return this.Img.lance2;
    } else if (type === 'brigandine' || type === 'lamellar') {
      return this.Img.leathergarb;
    } else if (type === 'maille' || type === 'hauberk' || type === 'brynja') {
      return this.Img.chainmail;
    } else if (type === 'cuirass' || type === 'steelplate') {
      return this.Img.plate1;
    } else if (type === 'greenwichplate') {
      return this.Img.plate2;
    } else if (type === 'gothicplate') {
      return this.Img.plate3;
    } else if (type === 'clericrobe') {
      return this.Img.robe1;
    } else if (type === 'monkcowl') {
      return this.Img.robe2;
    } else if (type === 'blackcloak') {
      return this.Img.robe3;
    } else if (type === 'tome') {
      return this.Img.tome;
    } else if (type === 'runicscroll') {
      return this.Img.scroll;
    } else if (type === 'sacredtext') {
      return this.Img.sacredtext;
    } else if (type === 'stoneaxe' || type === 'ironaxe') {
      return this.Img.axe;
    } else if (type === 'pickaxe') {
      return this.Img.pickaxe;
    } else if (type === 'key') {
      return this.Img.key;
    } else if (this.isBeverage(type)) {
      return qty > 2 ? this.Img.beers : this.Img.beer;
    } else if (type === 'wood') {
      return qty > 9 ? this.Img.wood3 : qty > 4 ? this.Img.wood2 : this.Img.wood1;
    } else if (type === 'stone') {
      return qty > 9 ? this.Img.stone2 : this.Img.stone1;
    } else if (type === 'grain') {
      return qty > 9 ? this.Img.grain3 : qty > 4 ? this.Img.grain2 : this.Img.grain1;
    } else if (type === 'ironore') {
      return qty > 4 ? this.Img.ore2 : this.Img.ore1;
    } else if (type === 'iron') {
      return qty > 4 ? this.Img.ironbars : this.Img.ironbar;
    } else if (type === 'steel') {
      return qty > 4 ? this.Img.steelbars : this.Img.steelbar;
    } else if (type === 'boarhide') {
      return qty > 4 ? this.Img.boarhides : this.Img.boarhide;
    } else if (type === 'leather') {
      return qty > 4 ? this.Img.leathers : this.Img.leather;
    } else if (type === 'silverore') {
      return this.Img.ore1;
    } else if (type === 'silver') {
      return this.getSilverImage(qty);
    } else if (type === 'goldore') {
      return this.Img.ore2;
    } else if (type === 'gold') {
      return this.getGoldImage(qty);
    } else if (type === 'diamond') {
      return qty > 2 ? this.Img.diamonds : this.Img.diamond;
    } else if (type === 'arrows') {
      return this.Img.arrows;
    } else if (type === 'bread') {
      return qty > 9 ? this.Img.breads : this.Img.bread;
    } else if (type === 'fish') {
      return qty > 4 ? this.Img.fishes : this.Img.fish;
    } else if (type === 'poachedfish') {
      return qty > 4 ? this.Img.poachedfishes : this.Img.poachedfish;
    } else if (type === 'lamb' || type === 'boarmeat' || type === 'venison') {
      // Raw meat items
      return qty > 4 ? this.Img.rawmeats : this.Img.rawmeat;
    } else if (type === 'meat' || type === 'lambchop' || type === 'boarshank' || type === 'venisonloin') {
      // Cooked meat items
      return qty > 4 ? this.Img.cookedmeats : this.Img.cookedmeat;
    } else if (type === 'torch') {
      return this.Img.torch;
    } else if (type === 'crown') {
      return this.Img.crown;
    } else if (type === 'relic') {
      return this.Img.relic;
    } else if (type === 'chest' || type === 'lockedchest') {
      return this.Img.chest;
    }

    return null;
  }

  /**
   * Check if item type is a beverage
   * @param {string} type - Item type
   * @returns {boolean} Is beverage
   */
  isBeverage(type) {
    const beverages = ['saison', 'mead', 'beer', 'flanders', 'bieredegarde', 'bordeaux', 'bourgogne', 'chianti'];
    return beverages.includes(type);
  }

  /**
   * Get silver image based on quantity
   * @param {number} qty - Quantity
   * @returns {Image} Silver image
   */
  getSilverImage(qty) {
    if (!this.Img) return null;
    
    if (qty > 999) return this.Img.silver9;
    else if (qty > 499) return this.Img.silver8;
    else if (qty > 249) return this.Img.silver7;
    else if (qty > 99) return this.Img.silver6;
    else if (qty > 49) return this.Img.silver5;
    else if (qty > 24) return this.Img.silver4;
    else if (qty > 9) return this.Img.silver3;
    else if (qty > 4) return this.Img.silver2;
    else return this.Img.silver1;
  }

  /**
   * Get gold image based on quantity
   * @param {number} qty - Quantity
   * @returns {Image} Gold image
   */
  getGoldImage(qty) {
    if (!this.Img) return null;
    
    if (qty > 999) return this.Img.gold9;
    else if (qty > 499) return this.Img.gold8;
    else if (qty > 249) return this.Img.gold7;
    else if (qty > 99) return this.Img.gold6;
    else if (qty > 49) return this.Img.gold5;
    else if (qty > 24) return this.Img.gold4;
    else if (qty > 9) return this.Img.gold3;
    else if (qty > 4) return this.Img.gold2;
    else return this.Img.gold1;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.InventoryItemImageHelper = InventoryItemImageHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InventoryItemImageHelper;
}
