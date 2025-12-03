/**
 * StealthSystem.js
 * Handles stealth visibility calculations for players
 * Extracted from client.js to reduce complexity
 */

var StealthSystem = {
  /**
   * Calculates stealth visibility level for a player
   * @param {string|number} id - Player ID
   * @returns {number} 0: not stealthed, 1: somewhat visible, 1.5: revealed, 2: totally stealthed
   */
  stealthCheck: function(id) {
    // During login mode, show all entities normally
    if(!selfId) {
      return 0;
    }
    
    var p = Player.list[id];
    if(p.stealthed){
      if(id == selfId){
        return 1;
      } else {
        if(allyCheck(id) <= 0){ // neutral or enemy
          if(p.revealed){
            return 1.5;
          } else {
            return 2;
          }
        } else { // ally
          return 1;
        }
      }
    }
    return 0;
  }
};

