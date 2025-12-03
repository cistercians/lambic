/**
 * BuildingEntity - Client-side Building entity constructor
 * 
 * Extracted from client.js for better organization.
 */

function BuildingEntity(initPack) {
  // Ensure Building.list exists (preserve from early initialization)
  if (!Building.list) Building.list = {};
  var self = {};
  self.id = initPack.id;
  self.type = initPack.type;
  self.hp = initPack.hp;
  self.occ = initPack.occ;
  self.plot = initPack.plot;
  self.walls = initPack.walls;
  self.topPlot = initPack.topPlot;

  Building.list[self.id] = self;
  return self;
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.BuildingEntity = BuildingEntity;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BuildingEntity;
}

