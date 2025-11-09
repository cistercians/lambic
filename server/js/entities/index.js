/**
 * Entity Registry
 * Central place to require and export all entity types
 * Note: Entities use Player.list as a global, so Player doesn't need to be passed
 */

module.exports = function(Character, globals) {
  // Extract entities (loaded from separate files)
  const Sheep = require('./Sheep')(Character);
  const Deer = require('./Deer')(Character, globals);
  const Boar = require('./Boar')(Character);
  const Wolf = require('./Wolf')(Character, globals);
  const Falcon = require('./Falcon')(Character, globals);
  
  return {
    Sheep,
    Deer,
    Boar,
    Wolf,
    Falcon
  };
};

