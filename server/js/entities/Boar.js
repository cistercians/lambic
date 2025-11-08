/**
 * Boar Entity
 * Aggressive prey animal
 */

module.exports = function(Character) {
  const Boar = function(param){
    var self = Character(param);
    self.class = 'Boar';
    self.baseSpd = 5;
    self.runSpd = 7; // Boar run speed
    self.damage = 12;
    self.aggroRange = 128;
    self.wanderRange = 256; // Tight leash - territorial defense (2x aggro range)
    return self;
  }
  
  return Boar;
};

