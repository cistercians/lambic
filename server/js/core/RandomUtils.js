/**
 * RandomUtils - Consistent random number generation utilities
 * 
 * Provides clean wrappers around Math.random() for common use cases.
 * All functions use the same underlying random source for consistency.
 * 
 * Usage:
 *   const random = require('./RandomUtils');
 *   
 *   random.int(1, 10);        // Random integer 1-10 inclusive
 *   random.float(0, 1);       // Random float 0-1
 *   random.chance(0.5);       // 50% chance to return true
 *   random.element(array);    // Random element from array
 *   random.shuffle(array);    // Shuffle array in place
 */

/**
 * Generate random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
function int(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
function float(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Return true with given probability
 * @param {number} probability - Probability 0-1
 * @returns {boolean} True with given probability
 */
function chance(probability) {
  return Math.random() < probability;
}

/**
 * Return random element from array
 * @param {Array} array - Source array
 * @returns {any} Random element or undefined if empty
 */
function element(array) {
  if (!array || array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Return random key from object
 * @param {object} obj - Source object
 * @returns {string} Random key or undefined if empty
 */
function key(obj) {
  if (!obj) return undefined;
  const keys = Object.keys(obj);
  return element(keys);
}

/**
 * Return random value from object
 * @param {object} obj - Source object
 * @returns {any} Random value or undefined if empty
 */
function value(obj) {
  if (!obj) return undefined;
  const k = key(obj);
  return k !== undefined ? obj[k] : undefined;
}

/**
 * Shuffle array in place (Fisher-Yates)
 * @param {Array} array - Array to shuffle
 * @returns {Array} Same array, shuffled
 */
function shuffle(array) {
  if (!array) return array;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Get random sample of n elements from array (without replacement)
 * @param {Array} array - Source array
 * @param {number} n - Number of elements to sample
 * @returns {Array} New array with sampled elements
 */
function sample(array, n) {
  if (!array || n <= 0) return [];
  if (n >= array.length) return [...array];
  
  const result = [];
  const taken = new Set();
  
  while (result.length < n) {
    const idx = Math.floor(Math.random() * array.length);
    if (!taken.has(idx)) {
      taken.add(idx);
      result.push(array[idx]);
    }
  }
  
  return result;
}

/**
 * Generate random string of given length
 * @param {number} length - String length
 * @param {string} chars - Character set (default alphanumeric)
 * @returns {string} Random string
 */
function string(length, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Random ID
 */
function id(prefix = '') {
  return prefix + Math.random().toString(36).substr(2, 9);
}

/**
 * Weighted random selection
 * @param {Array} items - Array of items
 * @param {Array} weights - Array of weights (same length as items)
 * @returns {any} Selected item
 */
function weighted(items, weights) {
  if (!items || !weights || items.length !== weights.length) return undefined;
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  
  return items[items.length - 1];
}

/**
 * Generate random point within radius of center
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} radius - Maximum radius
 * @returns {object} {x, y} coordinates
 */
function pointInRadius(centerX, centerY, radius) {
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.random()) * radius; // sqrt for uniform distribution
  return {
    x: centerX + r * Math.cos(angle),
    y: centerY + r * Math.sin(angle)
  };
}

/**
 * Generate random point within rectangle
 * @param {number} x - Left edge
 * @param {number} y - Top edge
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {object} {x, y} coordinates
 */
function pointInRect(x, y, width, height) {
  return {
    x: x + Math.random() * width,
    y: y + Math.random() * height
  };
}

/**
 * Roll dice (e.g., "2d6" = roll 2 six-sided dice)
 * @param {number} count - Number of dice
 * @param {number} sides - Number of sides per die
 * @returns {number} Total of all dice
 */
function dice(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += int(1, sides);
  }
  return total;
}

module.exports = {
  int,
  float,
  chance,
  element,
  key,
  value,
  shuffle,
  sample,
  string,
  id,
  weighted,
  pointInRadius,
  pointInRect,
  dice
};

