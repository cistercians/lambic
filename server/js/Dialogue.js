// DIALOGUE TREES
dialogues = {
  // TIER 0: AMBIENT
  // Phrases said in passing or at random.
  ambient:{

  },

  // TIER I: GENERIC
  // Generic greetings or smalltalk based on circumstances.
  generic:{

  },

  // TIER II: CLASS-BASED
  // Smalltalk or information based on the perspective of the player's or NPC's role.
  class:{

  },

  // TIER III: CONTEXTUAL
  // Information relating to the current context.
  context:{

  },

  // TIER IV: SPECIFIC
  // Specific dialogue trees.
  specific:{

  }
}

talk = function(selfId,id,code){
  var npc = Player.list[selfId];
  var player = Player.list[id];

}
