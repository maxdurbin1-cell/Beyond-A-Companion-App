// storyline-choices-system.js — Advanced Choice & Consequence Mechanics
// Every choice ripples through the world with dynamic consequences
(function () {
  const CHOICE_SYSTEM_ID = "storyline-choices";

  // Track player choices and their ripple effects
  let choiceHistory = [];
  let factionRelations = {
    corporations: 0,
    religious: 0,
    military: 0,
    underworld: 0,
    rebels: 0,
    scholars: 0
  };
  
  let factionTrust = {
    corporations: 0,
    religious: 0,
    military: 0,
    underworld: 0,
    rebels: 0,
    scholars: 0
  };

  let moralAlignment = {
    heroic: 0,
    evil: 0,
    sacrificial: 0
  };

  let playerDebt = {}; // Track promises and obligations
  let storylineEvents = []; // Major story events

  // ============================================================================
  // MAJOR CHOICE SCENARIOS — Gateway moments that shape the story
  // ============================================================================

  const MAJOR_CHOICES = [
    {
      id: "initial_recruitment",
      title: "Your First Real Test",
      desc: "Three faction representatives arrive simultaneously. You can only meet one.",
      choices: [
        {
          id: "meet_corporations",
          text: "Meet the Syndicate representative in the high tower",
          consequence: {
            immediate: { corporations: 2 },
            attitude: "pragmatic",
            loyalty: "profitable",
            enemies: ["rebels"],
            effect: "Corporate weapons dealer opens up. Military becomes suspicious."
          }
        },
        {
          id: "meet_rebels",
          text: "Meet the Uprising in the underground",
          consequence: {
            immediate: { rebels: 2 },
            attitude: "revolutionary",
            loyalty: "idealistic",
            enemies: ["corporations", "military"],
            effect: "Access to rebel bases. Corporate property becomes off-limits."
          }
        },
        {
          id: "meet_religious",
          text: "Meet the Sacred Choir at their temple",
          consequence: {
            immediate: { religious: 2, scholars: 1 },
            attitude: "spiritual",
            loyalty: "transcendent",
            enemies: ["underworld"],
            effect: "Healing access. Underworld views you as corrupted."
          }
        },
        {
          id: "meet_none",
          text: "Refuse all three. Walk away alone.",
          consequence: {
            immediate: { },
            attitude: "independent",
            loyalty: "none",
            enemies: ["all factions slightly"],
            effect: "Harder path. But later factions may recruit you exactly for this independence."
          }
        }
      ]
    },

    {
      id: "first_betrayal_test",
      title: "The Test of Loyalty",
      desc: "Your trusted faction asks you to assassinate a leader from a neutral faction. You know if you refuse, you'll be hunted.",
      turnsUntilActive: 8,
      choices: [
        {
          id: "assassinate_target",
          text: "Accept. Kill the target quickly and quietly.",
          consequence: {
            immediate: { reputation_with_faction: 3, guilt: 1 },
            delayed: { reputation_with_others: -2, targets_on_back: 2 },
            alignment: "evil",
            effect: "You're now a killer. The target faction seeks revenge. But your loyalty is proven—for now."
          }
        },
        {
          id: "warn_target",
          text: "Warn the target secretly. Fake the kill.",
          consequence: {
            immediate: { heroic_points: 2 },
            delayed: { faction_distrust: 1, double_agent_status: 1 },
            alignment: "heroic",
            effect: "Target escapes and owes you. Your faction suspects treachery. Dangerous game."
          }
        },
        {
          id: "rebel_against_order",
          text: "Refuse outright. Tell your faction NO.",
          consequence: {
            immediate: { faction_hostility: 5, freedom: 1 },
            delayed: { bounty_on_head: 1 },
            alignment: "sacrificial",
            effect: "You're marked for death by your faction. But you're free. Other factions hear of your defiance."
          }
        }
      ]
    },

    {
      id: "warring_factions",
      title: "The War Begins",
      desc: "Two major factions declare war. You're asked to take sides or die.",
      turnsUntilActive: 15,
      choices: [
        {
          id: "side_with_corporations_military",
          text: "Join the Corporations/Military alliance",
          consequence: {
            immediate: { corporations: 2, military: 2 },
            enemies: { rebels: 5, underworld: 3 },
            ending_path: "tyranny or golden victory"
          }
        },
        {
          id: "side_with_rebels_scholars",
          text: "Join the Uprising/Archive Keepers",
          consequence: {
            immediate: { rebels: 3, scholars: 2 },
            enemies: { corporations: 5, military: 4 },
            ending_path: "revolution or liberation"
          }
        },
        {
          id: "broker_peace",
          text: "Work to negotiate a ceasefire",
          consequence: {
            difficult: true,
            requires: "relationships across both sides",
            immediate: { scholars: 2, religious: 1 },
            ending_path: "fortunate peace or broken compromise"
          }
        },
        {
          id: "flee_and_hide",
          text: "Abandon the conflict. Disappear.",
          consequence: {
            immediate: { isolation: 1 },
            ending_path: "exile or unexpected second chance"
          }
        }
      ]
    },

    {
      id: "impossible_choice",
      title: "The Moment You Can't Win",
      desc: "Three people you love are about to die. You can only save one.",
      turnsUntilActive: 20,
      choices: [
        {
          id: "save_innocent",
          text: "Save the innocent civilian",
          consequence: {
            alignment: "heroic",
            guilt: 1,
            effect: "Noble. Two allies die. The world will forget them, but you won't."
          }
        },
        {
          id: "save_ally",
          text: "Save your faction ally—they're more important",
          consequence: {
            alignment: "pragmatic",
            guilt: 2,
            effect: "Practical. But you're haunted by the choice."
          }
        },
        {
          id: "save_self",
          text: "You save yourself. Let them all die.",
          consequence: {
            alignment: "evil",
            guilt: 0,
            effect: "Survivors are hunted down by grieving families. You're marked."
          }
        },
        {
          id: "sacrifice_self",
          text: "Die so all three can live.",
          consequence: {
            alignment: "sacrificial",
            effect: "You die here. But your death saves three lives. The ending begins.",
            ending_type: "martyr"
          }
        }
      ]
    }
  ];

  // ============================================================================
  // CONSEQUENCE RIPPLES —Dynamic world reactions to your choices
  // ============================================================================

  const CONSEQUENCE_RIPPLES = {
    killed_innocent: {
      immediate: { underworld_bounty: 500, criminal_status: 1 },
      week_2: { religious_hostility: 2, scholars_blacklist: 1 },
      week_5: { assassination_attempts: 1 },
      resolution: "Only redeemable through extreme sacrifice"
    },

    betrayed_faction: {
      immediate: { faction_bounty: 1000, exile: 1 },
      week_3: { allied_factions: -1 },
      week_6: { enemies_organize: 1 },
      resolution: "Can redemption arc to a new faction, or martyr's end"
    },

    sided_with_tyrants: {
      immediate: { power: 2, moral_stain: 1 },
      week_4: { rebellion_grows: 1, scholars_resist: 1 },
      week_8: { world_turns_darker: 1 },
      ending_lock: "Tyranny or hollow victory only"
    },

    kept_promises: {
      immediate: { trust: 1, blessing: 1 },
      week_2: { reputation_grows: 1 },
      week_5: { allies_arrive_when_needed: 1 },
      resolution: "Opens paths to good endings"
    },

    sacrificed_self: {
      immediate: { death: 1 },
      effect: "Story ends. You're a martyr. Movements rise in your name."
    }
  };

  // ============================================================================
  // DYNAMIC CHOICE GENERATION
  // ============================================================================

  function generateContextualChoices(currentMission) {
    // Every choice is shaped by: faction relations, past choices, moral alignment
    const choices = [];

    // Base choice aligned with mission
    const baseChoice = {
      text: currentMission.primary_goal,
      alignment: currentMission.alignment,
      consequence: { reputation: 1 }
    };

    // Heroic alternative always available
    const heroicChoice = {
      text: generateHeroicOption(currentMission),
      alignment: "heroic",
      consequence: { heroic_points: 2 }
    };

    // Evil alternative always available
    const evilChoice = {
      text: generateEvilOption(currentMission),
      alignment: "evil",
      consequence: { evil_points: 2 }
    };

    // Sacrificial alternative always available
    const sacrificialChoice = {
      text: generateSacrificialOption(currentMission),
      alignment: "sacrificial",
      consequence: { sacrificial_points: 2 }
    };

    choices.push(baseChoice, heroicChoice, evilChoice, sacrificialChoice);

    // Context-specific choice based on faction relations
    if (moralAlignment.heroic > moralAlignment.evil) {
      choices.push({
        text: "Find a third way that helps everyone involved",
        alignment: "heroic",
        difficulty: "very hard",
        consequence: { miraculous_outcome: 1 }
      });
    }

    return choices;
  }

  function generateHeroicOption(mission) {
    const heroicOptions = [
      "Protect the innocent, even if it costs you",
      "Speak truth, even when it destroys you",
      "Find redemption for your enemies",
      "Give mercy when you could give punishment",
      "Sacrifice yourself so others live"
    ];
    return heroicOptions[Math.floor(Math.random() * heroicOptions.length)];
  }

  function generateEvilOption(mission) {
    const evilOptions = [
      "Take everything for yourself",
      "Betray your allies for profit",
      "Rule through fear and cruelty",
      "Destroy anyone in your way",
      "Accumulate power at any cost"
    ];
    return evilOptions[Math.floor(Math.random() * evilOptions.length)];
  }

  function generateSacrificialOption(mission) {
    const sacrificialOptions = [
      "Shoulder their burden. Carry it alone.",
      "Pay with your blood so they're free",
      "Become the martyr they need",
      "Die so the cause lives on",
      "Leave everything behind for the mission"
    ];
    return sacrificialOptions[Math.floor(Math.random() * sacrificialOptions.length)];
  }

  // ============================================================================
  // TRACK CHOICES & APPLY CONSEQUENCES
  // ============================================================================

  function recordChoice(choiceId, choiceAlignment, consequence) {
    choiceHistory.push({
      id: choiceId,
      alignment: choiceAlignment,
      turn: getCurrentTurn(),
      consequence: consequence
    });

    // Apply reputation changes
    if (consequence.immediate) {
      Object.entries(consequence.immediate).forEach(([faction, change]) => {
        if (factionRelations[faction] !== undefined) {
          factionRelations[faction] += change;
        }
      });
    }

    // Track moral alignment
    if (choiceAlignment === "heroic") {
      moralAlignment.heroic += consequence.heroic_points || 1;
    } else if (choiceAlignment === "evil") {
      moralAlignment.evil += consequence.evil_points || 1;
    } else if (choiceAlignment === "sacrificial") {
      moralAlignment.sacrificial += consequence.sacrificial_points || 1;
    }

    // Schedule delayed consequences
    if (consequence.delayed) {
      scheduleDelayedConsequence(consequence.delayed, consequence.delayTurns || 3);
    }
  }

  function scheduleDelayedConsequence(consequence, turns) {
    setTimeout(() => {
      displayConsequenceNotification(consequence);
    }, turns * 1000); // Each "turn" is roughly 1 second for demo purposes
  }

  function displayConsequenceNotification(consequence) {
    // This would integrate with the existing notification system
    console.log("Consequence ripples through the world:", consequence);
  }

  // ============================================================================
  // ENDING DETERMINATION
  // ============================================================================

  function determineEnding() {
    const heroicScore = moralAlignment.heroic;
    const evilScore = moralAlignment.evil;
    const sacrificialScore = moralAlignment.sacrificial;

    let ending = {
      pathway: null,
      factionWinner: null,
      description: "",
      epilogue: ""
    };

    // Determine primary pathway
    if (heroicScore > evilScore && heroicScore > sacrificialScore) {
      ending.pathway = "heroic";
      ending.description = "The Heroic Path — Legend";
    } else if (evilScore > heroicScore && evilScore > sacrificialScore) {
      ending.pathway = "evil";
      ending.description = "The Tyrant's Path — Empty Throne";
    } else if (sacrificialScore > heroicScore && sacrificialScore > evilScore) {
      ending.pathway = "sacrificial";
      ending.description = "The Martyr's Path — Eternal Memory";
    } else if (
      Object.values(moralAlignment).some((val) => val > 3) &&
      Object.values(moralAlignment).filter((val) => val > 3).length === 2
    ) {
      ending.pathway = "mixed";
      ending.description = "A Broken Path — Compromised Triumph";
    } else {
      ending.pathway = "happy";
      ending.description = "The Fortunate Path — Unexpected Peace";
    }

    // Determine faction winner based on relations
    const topFaction = Object.entries(factionRelations).sort((a, b) => b[1] - a[1])[0];
    ending.factionWinner = topFaction[0];

    return ending;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  function getCurrentTurn() {
    // This would be tied to actual game turn tracking
    return 0;
  }

  window.storyChoiceSystem = {
    MAJOR_CHOICES,
    CONSEQUENCE_RIPPLES,
    choiceHistory,
    factionRelations,
    factionTrust,
    moralAlignment,
    recordChoice,
    generateContextualChoices,
    determineEnding,
    displayConsequenceNotification
  };
})();
