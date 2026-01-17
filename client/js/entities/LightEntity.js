/**
 * LightEntity - Client-side Light entity constructor
 * 
 * Extracted from client.js for better organization.
 */

function LightEntity(initPack) {
  // Ensure Light.list exists (preserve from early initialization)
  if (!Light.list) Light.list = {};
  var self = {};
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.radius = initPack.radius;
  self.parent = initPack.parent; // Store parent ID to identify light source type
  self.inBattleground = initPack.inBattleground;
  self.battlegroundMatchId = initPack.battlegroundMatchId || null;

  Light.list[self.id] = self;
  return self;
}

// Light.list already initialized at top of file, but add antilag entry
// Ensure Light.list exists before accessing it
if (typeof window !== 'undefined' && window.Light) {
  if (!window.Light.list) window.Light.list = {};
  if (!window.Light.list.antilag) {
    window.Light.list.antilag = {
      id: null,
      x: -100,
      y: -100,
      z: 99,
      radius: 0
    };
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.LightEntity = LightEntity;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LightEntity;
}

