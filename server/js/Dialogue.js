// DIALOGUE TREES
dialogues = {
  // REPUTATION RANKS:

  // TIER 0: AMBIENT
  // Phrases said in passing or at random.
  ambient:{
    general: [
      'Another day doth pass...',
      '*sighs deeply*',
      'Hmm.',
      '*looketh about*',
      'The weather doth change...'
    ],
    serf: [
      'Mine back doth ache...',
      'So much toil to be done.',
      '*wipeth brow*',
      'Nay rest for the weary.',
      'These hands ne\'er cease.'
    ],
    military: [
      'Ever vigilant.',
      '*scanneth the horizon*',
      'All seemeth quiet.',
      'Stay thou alert.',
      'Ready for aught.'
    ],
    cleric: [
      '*prayeth quietly*',
      'Blessed be...',
      'The Lord watcheth over us.',
      'Faith guideth me.',
      '*meditateth*'
    ]
  },

  // TIER I: GENERIC
  // Generic greetings or smalltalk based on circumstances.
  generic:{
    greetings: {
      day: ['Good morrow!', 'Greetings to thee!', 'Hail!', 'Well met!'],
      night: ['Good eventide.', 'Dark be the night...', 'Greetings, traveler.'],
      stranger: ['Hail, stranger.', 'Greetings, traveler.', 'Well met, though I know thee not.'],
      acquaintance: ['Hail!', 'Greetings to thee!', 'Well met!', '\'Tis good to see thee!'],
      friend: ['Ah, mine friend!', 'Good to see thee!', 'Well met, friend!', 'How farest thou?']
    },
    farewells: [
      'Fare thee well!',
      'Safe travels to thee!',
      'Until we meet anon.',
      'Godspeed!',
      'May fortune favour thee.',
      'Be thou safe.'
    ],
    weather: {
      day: ['A fair day, is\'t not?', 'Fine weather we be having.', 'The sun doth shine today.'],
      night: ['Dark be the night...', 'The stars shine bright this eve.', 'A quiet eventide.'],
      general: ['The weather hath been strange of late.', 'I hope it raineth not.']
    }
  },

  // TIER II: CLASS
  // Smalltalk or information based on the perspective of the player's or NPC's role.
  class:{
    serf: {
      work: [
        'I worketh the land, haul resources. Honest toil, though \'tis tiring.',
        'I have been hauling wood all the day. Mine back doth ache.',
        'The mill keepeth me busy from dawn till dusk.',
        'So much to do, so little time hath I.',
        'Work never endeth here.'
      ],
      complaints: [
        'Mine hands be blistered from all this labour.',
        'I dream of a day with nay work...',
        'The nobles know not how hard we toil.',
        'If only I could rest for but one day.',
        'This life doth exhaust me.'
      ],
      status: [
        'Weary from all this toil.',
        'Well enough, though mine back acheth.',
        'Busy as ever.',
        'Surviving, barely.',
        'Could be worse, I suppose.'
      ]
    },
    innkeeper: {
      work: [
        'I runneth this tavern. Keep travelers fed and housed.',
        'The tavern keepeth me busy, but I do enjoy it.',
        'Always something to do here - cooking, cleaning, hosting.',
        'Travelers come and go. I heareth many tales.'
      ],
      status: [
        'Doing well! The tavern keepeth me busy.',
        'Well, I thank thee for asking!',
        'Weary, but satisfied with mine work.',
        'Business be good!'
      ]
    },
    knight: {
      work: [
        'I protect these lands and serve mine liege.',
        'My duty is to defend the realm.',
        'A knight\'s work be never done.',
        'I stand ready to face any threat.'
      ],
      combat: [
        'I have seen mine share of battles.',
        'The sword is mine companion.',
        'Honour guideth mine blade.',
        'I fear nay enemy.'
      ],
      status: [
        'Ready for battle, as always.',
        'Well. Mine sword arm be strong.',
        'In fine form.',
        'Vigilant and prepared.'
      ]
    },
    archer: {
      work: [
        'I keep watch and defend against threats.',
        'Mine bow be mine livelihood.',
        'I can hit a target from a hundred paces hence.',
        'Keen eyes and steady hands - that be mine trade.'
      ],
      status: [
        'Sharp-eyed and ready.',
        'Well enough. The bow be steady.',
        'Good, keeping watch.',
        'Alert as ever.'
      ]
    },
    monk: {
      work: [
        'I serveth the Lord and tend to spiritual matters.',
        'Prayer and contemplation filleth mine days.',
        'I minister to those in need.',
        'The Lord\'s work be mine calling.'
      ],
      spiritual: [
        'Hast thou considered thy soul of late?',
        'The Lord watcheth over all of us.',
        'Prayer bringeth peace to troubled hearts.',
        'Faith be a powerful shield.',
        'Blessed be those who believe.'
      ],
      status: [
        'Blessed, I thank thee.',
        'In good spirits, by God\'s grace.',
        'Well, and thou?',
        'At peace, praise be.'
      ]
    },
    bishop: {
      work: [
        'I leadeth the faithful and guide our flock.',
        'As bishop, I shepherd souls toward salvation.',
        'The spiritual health of our people be mine charge.'
      ],
      status: [
        'Blessed and busy with the Lord\'s work.',
        'Well, serving as always.',
        'In His grace, I am content.'
      ]
    },
    hunter: {
      work: [
        'I hunt game in the forest. Deer, boar, whatsoever I can find.',
        'Tracking and hunting - \'tis what I do.',
        'The forest provideth, if thou knowest where to look.',
        'I supply meat for the settlements.'
      ],
      status: [
        'Been tracking deer all the morn.',
        'The hunt goeth well.',
        'Weary but successful.',
        'Ready for the next hunt.'
      ]
    }
  },

  // TIER III: CONTEXTUAL
  // Information relating to the current context.
  context:{
    danger: {
      wolves: [
        'Watch thee for wolves in the forest!',
        'I saweth a wolf pack nearby. Be thou careful!',
        'Wolves have been most aggressive of late.',
        'The forests be not safe - wolves prowl there.'
      ],
      enemies: [
        'Be on thy guard. Enemies have been spotted.',
        'I would watch mine back, were I thee.',
        'Dangerous folk about these days.',
        'There hath been trouble with raiders of late.'
      ],
      recent_attack: [
        'I was just attacked! Be thou careful!',
        'Someone tried to slay me! Watch thyself!',
        'There be danger nearby - I barely escaped!'
      ]
    },
    death: {
      witnessed: [
        'I just witnessed a death... terrible thing.',
        'Someone was slain nearby. Most horrifying...',
        'Death came swiftly. I saweth it happen.',
        'Poor soul... cut down right before mine eyes.'
      ]
    },
    location: {
      forest: 'We be near the forest. Good for hunting, but watch thee for wolves.',
      mountains: 'The mountains be treacherous. Tread thou carefully.',
      coast: 'The sea air be refreshing here.',
      cave: 'There be caves nearby. I heareth they be rich with ore.',
      settlement: 'This be our settlement. We toil hard to survive here.'
    }
  },

  // TIER IV: PERSONAL
  // Intimate or secretive information.
  personal:{
    secrets: [
      'I shouldst not tell thee this, but...',
      'Keep this betwixt us...',
      'I have seen things I cannot explain...',
      'There be rumours...'
    ],
    fears: [
      'Sometimes I feareth for mine life out here.',
      'I worry about what the future holdeth.',
      'These be dangerous times.'
    ],
    hopes: [
      'I hope for peace someday.',
      'Mayhaps things will get better.',
      'I dream of a quieter life.'
    ]
  },

  // TIER V: QUEST
  // Dialogue trees with specific goals or storylines.
  quest:{
    // Quest dialogues can be added here for future quest system
  }
}

talk = function(selfId,id,code){
  var npc = Player.list[selfId];
  var player = Player.list[id];

}
