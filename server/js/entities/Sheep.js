/**
 * Sheep Entity
 * Passive animal
 */

module.exports = function(Character) {
  const Sheep = function(param){
    var self = Character(param);
    self.class = 'Sheep';
    return self;
  }
  
  return Sheep;
};

