// storyline-system.js
(function () {
  const STORY_TAB_ID = "storyline";

  const STAT_LABELS = {
    valor: "Valor",
    body: "Body",
    mind: "Mind",
    spirit: "Spirit",
    control: "Control",
    lead: "Lead",
    strike: "Strike",
    shoot: "Shoot",
    defend: "Defend",
  };

  const FACTION_LABELS = {
    corporations: "Corporations",
    religious: "Religious Entities",
    political: "Political Groups",
    military: "Military Orders",
    underworld: "The Underworld",
    rebels: "Rebels",
    scholars: "Archive Keepers",
  };

  const DECISION_ROLES = [
    "Lead Check",
    "Valor Check",
    "Body Check",
    "Mind Check",
    "Spirit Check",
    "Control Check",
    "Defend Check",
    "Strike Check",
    "Shoot Check",
  ];

  const STORY_SCENE_TYPES = {
    combat: "Combat",
    exploration: "Exploration",
    investigation: "Investigation",
    social: "Social",
  };

  const STORY_SYSTEMS = [
    { id: "province", name: "Province", context: "traveling", tab: "map" },
    { id: "lastsea", name: "Sea Region", context: "lastsea", tab: "lastsea" },
    { id: "space", name: "Space", context: "space", tab: "galaxy" },
    { id: "planets", name: "Planets", context: "space", tab: "planet" },
    { id: "wtw", name: "World That Was", context: "space", tab: "worldthatwas" },
    { id: "combat", name: "Combat", context: "traveling", tab: "combat" },
    { id: "missions", name: "Missions", context: "traveling", tab: "missions" },
    { id: "skirmish", name: "Skirmishes", context: "space", tab: "worldthatwas" },
    { id: "naval", name: "Starship/Naval", context: "space", tab: "naval" },
  ];

  const CHAPTERS = [
    {
      id: "c1",
      title: "Ashes Under Gold",
      subtitle: "Noir frontier in the Province",
      age: "green",
      season: "spring",
      region: "province",
      villainBeat: "A magistrate's seal appears at a massacre site.",
    },
    {
      id: "c2",
      title: "Storm-Ledgers",
      subtitle: "Sea debts and drowned saints",
      age: "green",
      season: "harvest",
      region: "lastsea",
      villainBeat: "Ships vanish along routes taxed by an unseen court.",
    },
    {
      id: "c3",
      title: "Neon Liturgies",
      subtitle: "Space corridors and corporate shrines",
      age: "golden",
      season: "winter",
      region: "space",
      villainBeat: "The villain brokers peace by manufacturing cosmic fear.",
    },
    {
      id: "c4",
      title: "The Rust Crown",
      subtitle: "World That Was reckoning",
      age: "grey",
      season: "winter",
      region: "wtw",
      villainBeat: "Final confrontation with Magistrate Voss Karr.",
    },
  ];

  const BRANCH_REWARD_TABLES = {
    false_flag: {
      id: "false_flag",
      label: "Doctrine: Manufactured Unity",
      once: true,
      rewards: {
        credits: 260,
        faction: { military: 1, political: 1, rebels: -1 },
      },
      modifiers: {
        storyRollBonus: 1,
        merchantCreditsMultiplier: 1.35,
        warfrontScaleBonus: 2,
      },
      note: "Propaganda networks boost logistics and campaign funding.",
    },
    civil_war: {
      id: "civil_war",
      label: "Doctrine: Fracture Command",
      once: true,
      rewards: {
        renown: 1,
        faction: { military: 1, rebels: 1 },
      },
      modifiers: {
        storyRollBonus: 1,
        dreadDifficultyDelta: -1,
        warfrontScaleMultiplier: 1.15,
      },
      note: "Battlefield adaptation lowers pressure in future checks.",
    },
    purge: {
      id: "purge",
      label: "Doctrine: Crown of Ash",
      once: true,
      rewards: {
        renown: 2,
        credits: 120,
        faction: { military: 2, political: -1 },
      },
      modifiers: {
        storyRollBonus: 2,
        warfrontScaleBonus: 1,
        merchantFactionRenownBonus: 1,
      },
      note: "Rule through fear hardens your campaigns and war economy.",
    },
  };

  const SCENES = {
    intro: {
      chapter: "c1",
      title: "The Gallows Orchard",
      location: "Province",
      mood: "Weird noir, frontier grit",
      text: "Dawn drags over dead orchards. Six bodies hang from ironwood limbs, each branded with a crimson judicial sigil. A letter is nailed into your shadow: 'Come collect your sentence, Wayfarer. -Voss Karr'. The sheriff, Lyra Keene, lights a cigarette with shaking hands. Beside her stands Brother Iosef, a priest with a revolver and a rosary made of shell casings.",
      variants: [
        { when: { factionAtLeast: { key: "military", min: 2 } }, text: "The hanging knots are regulation military style, too precise for random killers." },
        { when: { factionAtLeast: { key: "underworld", min: 2 } }, text: "Street whispers say the sigil was sold as a contract brand three nights ago." },
        { when: { backgroundIncludes: ["scholar", "historian"] }, text: "You have seen this exact emblem in a forbidden atlas of collapsed republics." },
      ],
      lessons: ["province", "missions"],
      options: [
        {
          id: "o1",
          text: "Read the sigil as occult geometry",
          stat: "mind",
          baseDread: 8,
          success: {
            next: "intro_sigil",
            text: "The symbol is a routing cipher: province murders point to sea smuggling lanes.",
            effects: { credits: 50, npc: { lyra: 1 } },
          },
          fail: {
            next: "intro_failtrail",
            text: "You misread the script. Lyra calls it superstition and storms off.",
            effects: { mentalStress: 1, npc: { lyra: -1 } },
          },
        },
        {
          id: "o2",
          text: "Question Lyra through hard-boiled charm",
          stat: "lead",
          baseDread: 6,
          req: { careerIncludes: ["investigator", "merchant", "noble"] },
          success: {
            next: "lyra_arc_start",
            text: "Lyra admits she once loved Voss Karr before he became the Pale Magistrate.",
            effects: { renown: 1, npc: { lyra: 2 } },
          },
          fail: {
            next: "intro_failtrail",
            text: "She shuts down and tells you to solve it alone.",
            effects: { npc: { lyra: -1 } },
          },
        },
        {
          id: "o3",
          text: "Track the killers into the marsh roads",
          stat: "valor",
          baseDread: 8,
          success: {
            next: "marshal_ambush",
            text: "Boot-prints and hoof marks converge on a mission token in the wetlands.",
            effects: { tmw: 1 },
          },
          fail: {
            next: "marshal_ambush",
            text: "You still find the route, but late. The ambush is prepared.",
            effects: { health: 1, tmw: 1 },
          },
        },
        {
          id: "o4",
          text: "Draw on your Courage — stride forward as though you have already won",
          stat: "spirit",
          baseDread: 6,
          req: { virtueAny: ["Courage", "Resolution", "Hope"] },
          success: {
            next: "intro_sigil",
            text: "Your bearing commands the scene. Lyra and Iosef both step forward; the killers' trail opens like a wound.",
            effects: { renown: 1, npc: { lyra: 1, iosef: 1 } },
          },
          fail: {
            next: "intro_failtrail",
            text: "Courage alone cannot fill gaps in knowledge. You overreach and the opening closes.",
            effects: { mentalStress: 1 },
          },
        },
        {
          id: "o5",
          text: "Use your dangerous reputation to intimidate a bystander into talking",
          stat: "lead",
          baseDread: 6,
          req: { reputationAny: ["Dangerous", "Leader"] },
          success: {
            next: "intro_sigil",
            text: "A cattle trader spills everything — the sigil, the route, the buyer. Fear is a fast translator.",
            effects: { credits: 40, faction: { underworld: 1 } },
          },
          fail: {
            next: "intro_failtrail",
            text: "The bystander knows you by name and that makes them more terrified — they run.",
            effects: { mentalStress: 1 },
          },
        },
        {
          id: "o6",
          text: "Your mutation makes you sense lingering violence in this place",
          stat: "mind",
          baseDread: 8,
          req: { mutationIncludes: ["superhuman", "sense", "reflex", "rippling", "bone", "thick", "ears"] },
          success: {
            next: "marshal_ambush",
            text: "Your altered senses catch the heat-traces of recent killers. You follow the residue directly to the Marshals.",
            effects: { tmw: 1, flags: { mutantSensed: true } },
          },
          fail: {
            next: "intro_failtrail",
            text: "Your mutation flares at the wrong signal. You chase noise instead of trail.",
            effects: { mentalStress: 1 },
          },
        },
        {
          id: "o7",
          text: "Trigger your Personal Flavor edge and take control of the scene",
          stat: "control",
          baseDread: 7,
          req: { flavorSet: true },
          success: {
            next: "intro_sigil",
            text: "Your signature talent shifts the room in seconds. Witnesses confess and the sigil pattern snaps into focus.",
            effects: { renown: 1, consequenceTags: ["flavor_opening_play"] },
          },
          fail: {
            next: "intro_failtrail",
            text: "You overplay the move. The crowd panics and your opening evaporates.",
            effects: { tmw: 1 },
          },
        },
        {
          id: "o8",
          text: "Use your personal history to identify who wanted these bodies displayed",
          stat: "mind",
          baseDread: 8,
          req: { backstorySet: true },
          success: {
            next: "intro_sigil",
            text: "The pattern matches your old world. This is staged messaging, not random slaughter, and you know exactly who speaks this dialect of fear.",
            effects: { renown: 1, flags: { backstoryLeadOpened: true }, consequenceTags: ["backstory_opening_play"] },
          },
          fail: {
            next: "intro_failtrail",
            text: "Your memory cuts two ways. The old pain blurs your read and costs valuable time.",
            effects: { mentalStress: 1 },
          },
        },
        {
          id: "o9",
          text: "Touch one of the hanged dead and relive its final moments",
          stat: "spirit",
          baseDread: 7,
          req: { flavorAny: ["grave whisper", "relive last moments"] },
          success: {
            next: "intro_sigil",
            text: "The corpse remembers the magistrate seal being nailed in place after death. You catch the buyer's voice and the route they took back to the marsh roads.",
            effects: { pathTokens: 1, npc: { iosef: 1 }, consequenceTags: ["corpse_memory_opening"] },
          },
          fail: {
            next: "intro_failtrail",
            text: "The memory arrives as panic, rope-burn, and mud. You still learn they came from the marsh, but you absorb the terror with it.",
            effects: { mentalStress: 1, tmw: 1 },
          },
        },
      ],
    },

    intro_sigil: {
      chapter: "c1",
      title: "Ink That Smells Like Salt",
      location: "Province to Sea",
      mood: "Occult procedural",
      text: "The sigil decodes into shipping tariffs and execution schedules. Someone is running a court-state across land and sea. Brother Iosef asks whether justice is a sword or a ledger.",
      lessons: ["lastsea"],
      options: [
        {
          id: "o1",
          text: "Take a mission board contract tied to the cipher",
          jump: { tab: "missions" },
          success: { next: "mission_bridge", text: "A contract appears with your encoded route as its target.", effects: { renown: 1 } },
        },
        {
          id: "o2",
          text: "Sail now and intercept the black-flag caravan",
          jump: { context: "lastsea", tab: "lastsea" },
          success: { next: "sea_court", text: "Your ship enters stormlight waters where judges wear diver helmets." },
        },
        {
          id: "o3",
          text: "Cross-reference the cipher against the Theos Atlas",
          jump: { tab: "theos" },
          success: {
            next: "theos_atlas_brief",
            text: "The atlas pins two hot zones in the same conspiracy chain: Rosegrove Reach and Raenor March.",
            effects: { flags: { atlasChainOpened: true } },
          },
        },
      ],
    },

    intro_failtrail: {
      chapter: "c1",
      title: "A Bad First Guess",
      location: "Province",
      mood: "Absurd dread",
      text: "You lose the clean lead, but a laughing scavenger child sells you a blood-wet map for a single bullet and a joke about God.",
      options: [
        {
          id: "o1",
          text: "Buy the map and press forward",
          success: { next: "mission_bridge", text: "Even bad leads point toward Voss Karr's machine.", effects: { credits: -25 } },
        },
        {
          id: "o2",
          text: "Offer a courtroom puppet show in exchange for better intel",
          stat: "spirit",
          baseDread: 10,
          success: { next: "mission_bridge", text: "The child laughs so hard they reveal an ambush route and a merchant pass-token.", effects: { merchantReward: { credits: 90, factionKey: "corporations", factionRenown: 1, item: "Trade Good" } } },
          fail: { next: "mission_bridge", text: "The joke bombs, but pity earns you a torn route anyway.", effects: { mentalStress: 1 } },
        },
        {
          id: "o3",
          text: "Play the scavenger's shell-whistle puzzle",
          puzzle: {
            mode: "tune",
            title: "Puzzle: Shell-Whistle Tune",
            prompt: "The child says: 'Play the road-song in this order: dawn, ash, tide, ash.' Translate it to notes and perform it.",
            sequence: ["DO", "MI", "SO", "MI"],
          },
          success: { next: "cipher_market", text: "You nail the tune. A hidden map margin reveals Voss Karr's coded buyer list.", effects: { flags: { tuneSolved: true }, renown: 1 } },
          fail: { next: "mission_bridge", text: "You miss the rhythm and the child vanishes into fog, but you keep the basic map.", effects: { tmw: 1 } },
        },
      ],
    },

    cipher_market: {
      chapter: "c1",
      title: "The Whisper Market",
      location: "Province",
      mood: "Noir puzzle bazaar",
      text: "Lantern merchants trade in encoded phrases and fake names. One broker offers a single sentence that can open sealed routes, but only if you reconstruct it correctly.",
      lessons: ["missions"],
      options: [
        {
          id: "o1",
          text: "Rearrange the broker phrase",
          puzzle: {
            mode: "rearrange",
            title: "Puzzle: Reassemble the Phrase",
            prompt: "Arrange the words into the passphrase that opens the Red Ledger route.",
            bank: ["LEDGER", "THE", "BURNS", "BEFORE", "DAWN"],
            answer: "the ledger burns before dawn",
          },
          success: { next: "mission_bridge", text: "The broker nods and hands you a stamped mission seal.", effects: { merchantReward: { credits: 120, item: "Retainer Contract", factionKey: "corporations", factionRenown: 1 } } },
          fail: { next: "mission_bridge", text: "Your phrase is wrong; prices spike and the broker blacklists your face.", effects: { credits: -40, faction: { corporations: -1 } } },
        },
        {
          id: "o2",
          text: "Talk your way in as a licensed merchant",
          stat: "lead",
          baseDread: 8,
          req: { careerIncludes: ["merchant", "noble", "investigator"] },
          success: { next: "mission_bridge", text: "Your credentials pass and you walk out with route discounts and introductions.", effects: { merchantReward: { credits: 140, factionKey: "corporations", factionRenown: 1, openShop: true } } },
          fail: { next: "mission_bridge", text: "Your cover slips under scrutiny, but a junior clerk still gives one useful waypoint.", effects: { mentalStress: 1 } },
        },
        {
          id: "o3",
          text: "Memorize the broker's rotating sigils",
          puzzle: {
            mode: "memory",
            title: "Puzzle: Broker Memory Test",
            prompt: "The broker flashes a five-sigil route key once, then demands it back from memory.",
            sequence: ["LANTERN", "RED", "KEY", "ASH", "KEY"],
            bank: ["LANTERN", "RED", "KEY", "ASH", "VEIL"],
          },
          success: { next: "mission_bridge", text: "You recite the sigils from memory. A second route opens behind the first ledger seal.", effects: { flags: { brokerMemorySolved: true }, renown: 1 } },
          partial: { next: "mission_bridge", text: "You recover most of the sigils. The broker sells you a weaker but usable path-marker.", effects: { credits: -20, tmw: 1 } },
          fail: { next: "mission_bridge", text: "The last sigil slips your mind. You still buy a rough route from a rival stall.", effects: { mentalStress: 1 } },
        },
        {
          id: "o4",
          text: "Use lockpicks to crack the broker's chained dispatch box",
          stat: "mind",
          baseDread: 8,
          req: { backpackAny: ["lockpick", "dungeoneer's kit", "scavenger's pouch"], consumeRequiredItem: true },
          success: { next: "mission_bridge", text: "Tumblers whisper open. Inside is a pre-stamped Red Ledger route permit.", effects: { credits: 60, renown: 1 } },
          fail: { next: "mission_bridge", text: "The picks snap and alarms hiss, but you still salvage a half-burned route stub.", effects: { mentalStress: 1, tmw: 1 } },
        },
        {
          id: "o5",
          text: "Route an OS Hack through the market shutters",
          stat: "control",
          baseDread: 10,
          req: { augmentationsAny: ["operating system"], ownedHacksAny: ["ping", "take control", "weapon glitch", "reboot optics", "javelin"] },
          success: { next: "mission_bridge", text: "Your intrusion tags every watcher in the square and opens a ghost corridor to the ledger convoy.", effects: { faction: { corporations: 1 }, tmw: 1 } },
          fail: { next: "mission_bridge", text: "Counter-hackers burn your line, but your spoofed identity still buys one safe lane.", effects: { credits: -25, tmw: 1 } },
        },
        {
          id: "o6",
          text: "Cast a scroll ward to force the broker's oath",
          stat: "spirit",
          baseDread: 9,
          req: { backpackAny: ["scroll", "warding sigil", "none can lie", "bind oath", "speak with the dead"], consumeRequiredItem: true },
          success: { next: "mission_bridge", text: "The ward seals the contract in light. The broker cannot deny your claim to the Red Ledger route.", effects: { renown: 1, faction: { religious: 1 } } },
          fail: { next: "mission_bridge", text: "The rite wavers, but fear of retaliation still gets you a legal copy of the route.", effects: { mentalStress: 1 } },
        },
      ],
    },

    lyra_arc_start: {
      chapter: "c1",
      title: "The Sheriff and the Ghost",
      location: "Province",
      mood: "Romance + betrayal",
      text: "Lyra confesses: she and Voss planned to rebuild the world together. He chose order through terror; she chose people. She asks you not to kill him unless there is no other path.",
      options: [
        {
          id: "o1",
          text: "Promise mercy if possible",
          stat: "spirit",
          baseDread: 8,
          success: { next: "mission_bridge", text: "Lyra softens. 'Then let me ride with you.'", effects: { npc: { lyra: 1 }, dialogueQuote: { speaker: "Lyra", line: "Mercy is not weakness. It is discipline." } } },
          fail: { next: "mission_bridge", text: "Your promise sounds hollow. She keeps emotional distance.", effects: { npc: { lyra: -1 }, dialogueQuote: { speaker: "Lyra", line: "A clean shot beats a clean speech." } } },
        },
        {
          id: "o2",
          text: "Promise judgment over mercy",
          stat: "defend",
          baseDread: 8,
          success: { next: "mission_bridge", text: "She nods grimly. 'Then be harder than him.'", effects: { renown: 1 } },
          fail: { next: "mission_bridge", text: "The vow fractures your trust with her.", effects: { npc: { lyra: -1 } } },
        },
      ],
    },

    mission_bridge: {
      chapter: "c1",
      title: "Contract of Bones",
      location: "Missions and Combat",
      mood: "Action tutorial",
      text: "A contract appears in your tracker: 'Seize the Red Ledger.' Completing it unlocks routes through every region. Voss Karr wants you mobile, tested, and shaped.",
      lessons: ["missions", "combat"],
      options: [
        {
          id: "o1",
          text: "Open missions and run Step 1/2/3 now",
          jump: { tab: "missions" },
          success: { next: "marshal_ambush", text: "The mission pushes you into an engineered firefight." },
        },
        {
          id: "o2",
          text: "Skip to direct confrontation",
          combat: {
            title: "Story Combat: Red Ledger Intercept",
            dread: 10,
            enemies: ["Marshal Captain", "Seal-Bearer", "Contract Gunner"],
            briefing: "Voss Karr's advance team catches your approach before you reach the camp. Break through them to reach the main ambush."
          },
          success: { next: "marshal_ambush", text: "Steel answers before strategy does. You cut through the intercept team and reach the real kill zone." },
          fail: { next: "marshal_ambush", text: "You break contact battered, but the route still drives you straight into the ambush.", effects: { health: 1, mentalStress: 1 } },
        },
        {
          id: "o3",
          text: "Consult dock scholar and decode a legal cipher",
          puzzle: {
            mode: "code",
            title: "Puzzle: Decode the Writ",
            prompt: "The scholar gives a substitution clue: 'KARR = CROWN'. Decode the final keyword from the writ: 'MERCATOR'. Enter the plain-language keyword.",
            answer: "merchant",
          },
          success: { next: "marshal_ambush", text: "Decoded correctly. The writ authorizes emergency market claims across two regions.", effects: { merchantReward: { credits: 160, factionKey: "political", factionRenown: 1, item: "Trade Good" } } },
          fail: { next: "marshal_ambush", text: "You misread the writ and trigger an audit notice on your routes.", effects: { credits: -60 } },
        },
      ],
    },

    marshal_ambush: {
      chapter: "c1",
      title: "Gun-Smoke Psalm",
      location: "Province / Combat",
      mood: "Cowboy samurai fever",
      text: "Black-coated marshals ambush your camp under lantern rain. Their captain chants legal code like prayer while drawing a katana with an integrated rifle chamber.",
      lessons: ["combat", "skirmish"],
      options: [
        {
          id: "o1",
          text: "Duel the captain blade-to-blade",
          combat: {
            title: "Story Combat: Marshal Captain",
            dread: 10,
            enemies: ["Marshal Captain", "Lantern Marshal"],
            briefing: "The captain steps forward under lantern rain while one marshal keeps pressure from the flank."
          },
          success: { next: "sea_court", text: "You cut the marshal's contract seal in half and take his sea transit key.", effects: { renown: 1 } },
          fail: { next: "sea_court", text: "You win late and bleeding; the key is cracked but usable.", effects: { health: 2 } },
        },
        {
          id: "o2",
          text: "Counter-snipe through reeds and static",
          combat: {
            title: "Story Combat: Reedline Ambush",
            dread: 10,
            enemies: ["Rifle Marshal", "Static Spotter", "Marshal Scout"],
            briefing: "The ambushers spread through the reeds and force you into a shifting firefight."
          },
          success: { next: "sea_court", text: "One precise shot breaks the ambush line.", effects: { tmw: 1 } },
          fail: { next: "sea_court", text: "You suppress them but take return fire.", effects: { health: 1, mentalStress: 1 } },
        },
      ],
    },

    sea_court: {
      chapter: "c2",
      title: "The Drowned Court",
      location: "Sea Region",
      mood: "Horror and absurd judiciary",
      text: "At sea, judges in brass diving masks convene trials on deck while eels coil around gavels. Every witness speaks in legal haiku. You must prove you're not the villain's willing agent.",
      lessons: ["lastsea", "naval"],
      options: [
        {
          id: "o1",
          text: "Argue jurisdiction by religious doctrine",
          stat: "spirit",
          baseDread: 8,
          req: { factionAtLeast: { key: "religious", min: 1 } },
          success: { next: "sea_chase", text: "The court grants temporary passage and a warrant chip.", effects: { faction: { religious: 1 } } },
          fail: { next: "sea_chase", text: "They call your faith counterfeit and mark your hull.", effects: { faction: { religious: -1 }, mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Bribe the bailiff with underworld script",
          stat: "control",
          baseDread: 10,
          req: { factionAtLeast: { key: "underworld", min: 1 } },
          success: { next: "sea_chase", text: "The bailiff reroutes patrols and whispers: 'Run now.'", effects: { faction: { underworld: 1 }, credits: -100 } },
          fail: { next: "sea_chase", text: "The bribe is fake; they fine you and open fire.", effects: { credits: -150, health: 1 } },
        },
        {
          id: "o3",
          text: "Accept trial by cannon and storm",
          stat: "defend",
          baseDread: 10,
          success: { next: "storm_archive", text: "You weather the barrage and earn fear-respect.", effects: { renown: 1, flags: { seaTrialWon: true } } },
          fail: { next: "sea_chase", text: "You survive but your ship limps toward open water.", effects: { health: 1, mentalStress: 1 } },
        },
        {
          id: "o4",
          text: "Invoke old convoy law and request military witness",
          stat: "lead",
          baseDread: 10,
          req: { factionAtLeast: { key: "military", min: 2 } },
          success: { next: "storm_archive", text: "A convoy captain signs your temporary immunity writ.", effects: { faction: { military: 1 }, flags: { gotConvoyWrit: true } } },
          fail: { next: "sea_chase", text: "The captain refuses to stake rank on you.", effects: { faction: { military: -1 }, mentalStress: 1 } },
        },
        {
          id: "o5",
          text: "Show mercy to the court bailiff and earn honest testimony",
          stat: "spirit",
          baseDread: 8,
          req: { virtueAny: ["Mercy", "Justice", "Wisdom"] },
          success: { next: "storm_archive", text: "The bailiff has never been shown mercy before. He breaks rank and personally escorts you to the archive.", effects: { npc: { lyra: 1 }, flags: { mercyBailiff: true } } },
          fail: { next: "sea_chase", text: "Mercy is mistaken for weakness. The court presses harder.", effects: { mentalStress: 1 } },
        },
        {
          id: "o6",
          text: "Your greedy reputation precedes you — the court assumes you can be bought, buy them first",
          stat: "control",
          baseDread: 8,
          req: { viceAny: ["Greedy", "Envious"] },
          success: { next: "storm_archive", text: "The court's greed mirrors yours. A quiet negotiation nets you archive access at extravagant mutual cost.", effects: { credits: -120, flags: { purchasedArchive: true }, faction: { corporations: 1 } } },
          fail: { next: "sea_chase", text: "They take the credits and offer nothing.", effects: { credits: -80, mentalStress: 1 } },
        },
      ],
    },

    storm_archive: {
      chapter: "c2",
      title: "Vault Beneath the Tide",
      location: "Sea Region",
      mood: "Paranoid heist",
      text: "You descend in a coffin-sub to a court archive buried in storm silt. Ledgers hum with names, verdicts, and hidden payment channels feeding Voss Karr's network.",
      lessons: ["naval", "missions"],
      variants: [
        { when: { flagEq: { key: "seaTrialWon", value: true } }, text: "Because you survived trial by cannon, archivists hesitate before raising alarms." },
        { when: { factionAtLeast: { key: "corporations", min: 2 } }, text: "Corporate account signatures flicker across multiple shell houses you recognize." },
      ],
      options: [
        {
          id: "o1",
          text: "Forge credentials and clone the payment tree",
          stat: "control",
          baseDread: 10,
          success: { next: "sea_mutiny", text: "You leave with a clean mirror of their revenue channels.", effects: { credits: 180, flags: { ledgerCloned: true } } },
          fail: { next: "sea_mutiny", text: "You copy partial data while alarms close in.", effects: { health: 1, tmw: 1 } },
        },
        {
          id: "o2",
          text: "Extract witness testimony from chained clerks",
          stat: "spirit",
          baseDread: 8,
          req: { backgroundIncludes: ["temple", "physician", "investigator"] },
          success: { next: "sea_mutiny", text: "A clerk gives sworn names linking sea judges to orbital financiers.", effects: { renown: 1, flags: { witnessChain: true } } },
          fail: { next: "sea_mutiny", text: "The clerks panic and burn part of the archive.", effects: { mentalStress: 1 } },
        },
        {
          id: "o3",
          text: "Steal a dripping glyph-slab and decode first symbols",
          puzzle: {
            mode: "code",
            title: "Puzzle: Drowned Glyph",
            prompt: "The slab reads SER next to a sunburst icon. Enter the plain meaning.",
            answer: "star",
          },
          success: { next: "sea_mutiny", text: "You decode SER and log it in your fieldbook as a core key for Voss's legal liturgy.", effects: { lexicon: { ser: "star" }, flags: { glyphTrailStarted: true }, merchantReward: { credits: 80, factionKey: "underworld", factionRenown: 1 } } },
          fail: { next: "sea_mutiny", text: "You cannot crack the slab under pressure, but the symbol sketch survives.", effects: { mentalStress: 1 } },
        },
        {
          id: "o4",
          text: "Ask the drowned dead which ledger was moved last",
          stat: "mind",
          baseDread: 8,
          req: { flavorAny: ["grave whisper", "relive last moments", "time traveler"] },
          success: { next: "sea_mutiny", text: "A drowned clerk's last memory shows a sealed drawer being emptied moments before the archive lock-cycle. You take the right ledger on the first try.", effects: { credits: 110, flags: { witnessChain: true, drownedLedgerRead: true }, lexicon: { tor: "verdict" } } },
          fail: { next: "sea_mutiny", text: "The dead remember flooding lungs more clearly than numbers. You still get a direction, but it costs you composure.", effects: { mentalStress: 1, tmw: 1 } },
        },
      ],
    },

    sea_mutiny: {
      chapter: "c2",
      title: "Mutiny in Lantern Fog",
      location: "Sea to Space",
      mood: "Operatic mutiny",
      text: "Crew morale fractures as rumors spread that Voss Karr already owns your route. Officers argue over whether to run, revolt, or sell you out for pardon.",
      options: [
        {
          id: "o1",
          text: "Hold command with steel discipline",
          stat: "defend",
          baseDread: 10,
          success: { next: "sea_chase", text: "Order returns. Your jump prep runs on razor precision.", effects: { faction: { military: 1 } } },
          fail: { next: "sea_chase", text: "You keep command but lose trust in the lower decks.", effects: { mentalStress: 1, npc: { lyra: -1 } } },
        },
        {
          id: "o2",
          text: "Negotiate split command with trusted officers",
          stat: "lead",
          baseDread: 8,
          success: { next: "sea_chase", text: "Shared command steadies the ship and creates loyalty.", effects: { npc: { lyra: 1, mara: 1 }, flags: { splitCommand: true } } },
          fail: { next: "sea_chase", text: "Compromise reads as weakness during a storm watch.", effects: { faction: { underworld: 1 }, health: 1 } },
        },
        {
          id: "o3",
          text: "Stage a fake haunting trial to flush mutineers",
          stat: "control",
          baseDread: 10,
          success: { next: "sea_chase", text: "Half the conspirators confess to ghosts that are actually your disguised crew.", effects: { renown: 1, npc: { iosef: 1 } } },
          fail: { next: "sea_chase", text: "The stunt partly works, but panic breaks two launch rails.", effects: { health: 1, credits: -40 } },
        },
      ],
    },

    sea_chase: {
      chapter: "c2",
      title: "Red Wake",
      location: "Sea to Space",
      mood: "High velocity dread",
      text: "A crimson frigate bearing Voss Karr's seal breaches fog and gives chase. Your only path is through a dead relay gate that opens onto space lanes.",
      options: [
        {
          id: "o1",
          text: "Use Naval tactics to outmaneuver and jump",
          jump: { context: "space", tab: "naval" },
          success: { next: "space_noir", text: "The jump tears reality and your conscience in equal measure." },
        },
        {
          id: "o2",
          text: "Hold and board for evidence",
          combat: {
            title: "Story Combat: Crimson Frigate Boarding",
            dread: 12,
            enemies: ["Frigate Warden", "Boarding Marine", "Boarding Marine"],
            briefing: "You hook into the crimson frigate and fight deck-to-deck for the ledger and jump coordinates."
          },
          success: { next: "space_noir", text: "You seize Voss's planet ledger and coordinates.", effects: { credits: 200 } },
          fail: { next: "space_noir", text: "You take the ledger but lose crew to the surf.", effects: { mentalStress: 2 } },
        },
      ],
    },

    space_noir: {
      chapter: "c3",
      title: "Neon Relic Corridor",
      location: "Space / Galaxy",
      mood: "Cyberpunk noir",
      text: "In orbit above a dead moon, corporate chapels beam ads as prayer. Voss Karr is negotiating with major powers, promising 'peace through curated dread'. Mara Quill, an ex-assassin turned smuggler poet, offers to help if you trust her.",
      variants: [
        { when: { factionAtLeast: { key: "corporations", min: 3 } }, text: "Invitations to a private board-synod arrive with your name pre-approved." },
        { when: { factionAtLeast: { key: "rebels", min: 2 } }, text: "Graffiti on cargo hulls marks a rebel channel willing to leak Voss's summit agenda." },
      ],
      lessons: ["space", "planets"],
      options: [
        {
          id: "o1",
          text: "Trust Mara and share command codes",
          stat: "lead",
          baseDread: 10,
          success: { next: "mara_arc", text: "Mara smiles like a loaded gun. 'Now we can hurt him properly.'", effects: { npc: { mara: 2 } } },
          fail: { next: "mara_arc", text: "She takes partial control and vanishes for a chapter.", effects: { npc: { mara: -1 }, tmw: 1 } },
        },
        {
          id: "o2",
          text: "Keep Mara at arm's length and scan planets",
          jump: { context: "space", tab: "planet" },
          success: { next: "planet_descent", text: "You find a colony where Voss tests social control algorithms." },
        },
        {
          id: "o3",
          text: "Infiltrate the corporate synod in orbit",
          stat: "control",
          baseDread: 10,
          req: { factionAtLeastAny: [{ key: "corporations", min: 2 }, { key: "political", min: 2 }] },
          success: { next: "corp_synod", text: "You pass biometric scrutiny and enter the synod chamber.", effects: { flags: { synodAccess: true } } },
          fail: { next: "corp_synod", text: "You get in disguised, but security flags your gait profile.", effects: { mentalStress: 1 } },
        },
        {
          id: "o4",
          text: "Interview the station oracle for out-of-box routes",
          stat: "mind",
          baseDread: 10,
          req: { backgroundIncludes: ["scholar", "temple", "outlaw", "drifter"] },
          success: { next: "oracle_parley", text: "The oracle speaks in contradictions that still map to real jump corridors.", effects: { flags: { oracleTrust: true }, npc: { iosef: 1 } } },
          fail: { next: "oracle_parley", text: "The oracle mocks your certainty but still leaves cryptic coordinates.", effects: { tmw: 1 } },
        },
        {
          id: "o5",
          text: "Debrief with Brother Iosef about legal scripture",
          stat: "spirit",
          baseDread: 8,
          req: { backgroundIncludes: ["temple", "scholar", "historian", "noble"] },
          success: { next: "iosef_colloquy", text: "Iosef opens a sealed notebook: half prayers, half battle orders.", effects: { npc: { iosef: 2 } } },
          fail: { next: "iosef_colloquy", text: "He still talks, but keeps the crucial pages hidden.", effects: { npc: { iosef: 1 } } },
        },
        {
          id: "o6",
          text: "Rebuild the shattered summit image from dock-cam fragments",
          puzzle: {
            mode: "mosaic",
            title: "Puzzle: Dock-Cam Mosaic",
            prompt: "Reassemble the surveillance fragments into the correct four-part image sequence.",
            bank: ["[CROWN]", "[WIRE]", "[MOON]", "[EYE]"],
            answer: "[moon] [eye] [wire] [crown]",
          },
          success: { next: "planet_descent", text: "The rebuilt image exposes the colony tag on Voss Karr's next laboratory world.", effects: { flags: { summitImageSolved: true }, merchantReward: { credits: 150, factionKey: "political", factionRenown: 1 } } },
          partial: { next: "planet_descent", text: "You rebuild enough of the image to isolate the target colony, but lose finer details in the static.", effects: { credits: 60 } },
          fail: { next: "planet_descent", text: "The fragments remain noisy, but Mara still forces a best-guess descent window.", effects: { tmw: 1, mentalStress: 1 } },
        },
      ],
    },

    iosef_colloquy: {
      chapter: "c3",
      title: "Brother Iosef's Field Catechism",
      location: "Space / Chapel Dock",
      mood: "Confession and strategy",
      text: "Iosef admits he once served in Voss Karr's legal battalions. He offers to teach one passphrase that can unmask false verdicts, but only if your life path can carry it.",
      options: [
        {
          id: "o1",
          text: "Scholar's reading: parse doctrine as history",
          stat: "mind",
          baseDread: 8,
          req: { backgroundIncludes: ["scholar", "historian"] },
          success: { next: "planet_descent", text: "You extract the phrase anchor: 'Star binds oath' in archaic court tongue.", effects: { flags: { phraseKeyUnlocked: true }, lexicon: { va: "bind" }, npc: { iosef: 1 }, dialogueQuote: { speaker: "Iosef", line: "No verdict outranks witness." } } },
          fail: { next: "planet_descent", text: "You grasp only fragments and must infer the rest later.", effects: { mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Merchant's reading: treat doctrine as contract law",
          stat: "control",
          baseDread: 8,
          req: { careerIncludes: ["merchant", "noble", "investigator"] },
          success: { next: "planet_descent", text: "You catch the enforceable clause and turn it into legal leverage.", effects: { flags: { phraseKeyUnlocked: true }, merchantReward: { credits: 110, factionKey: "political", factionRenown: 1 }, lexicon: { va: "bind" }, dialogueQuote: { speaker: "Iosef", line: "Ledger first, sword second." } } },
          fail: { next: "planet_descent", text: "The clause slips past you, but Iosef still circles one glyph in red.", effects: { lexicon: { va: "bind" } } },
        },
      ],
    },

    oracle_parley: {
      chapter: "c3",
      title: "Oracle of Broken Frequencies",
      location: "Space Station",
      mood: "Absurd cosmic mystery",
      text: "The station oracle refuses plain speech. She offers three impossible bargains and claims one of them already happened in your future.",
      options: [
        {
          id: "o1",
          text: "Accept the bargain that costs your name for one day",
          stat: "spirit",
          baseDread: 10,
          success: { next: "planet_descent", text: "For one day, systems cannot index you. You move unseen through checkpoint nets.", effects: { merchantReward: { credits: 130, factionKey: "underworld", factionRenown: 1 }, flags: { namelessDay: true } } },
          fail: { next: "planet_descent", text: "The ritual backfires and half your records scramble.", effects: { mentalStress: 1, credits: -50 } },
        },
        {
          id: "o2",
          text: "Challenge the oracle to a logic-riddle",
          puzzle: {
            mode: "code",
            title: "Puzzle: Oracle Riddle",
            prompt: "'I am taken from a mine, and shut in a wooden case, from which I am never released, and yet I am used by almost every person.' Enter one word.",
            answer: "graphite",
          },
          success: { next: "planet_descent", text: "She laughs and grants a star-market voucher with anti-tax signatures.", effects: { merchantReward: { credits: 180, factionKey: "corporations", factionRenown: 1, item: "Retainer Contract", openShop: true } } },
          fail: { next: "planet_descent", text: "Wrong answer. She still gives a warning: 'Do not trust clean ledgers.'", effects: { flags: { oracleWarning: true } } },
        },
        {
          id: "o3",
          text: "Complete the oracle's crossword of dead languages",
          puzzle: {
            mode: "crossword_grid",
            title: "Puzzle: Dead-Language Grid",
            prompt: "Fill the intersecting letter grid from the clues.",
            gridRows: 5,
            gridCols: 5,
            gridTemplate: [
              "STAR#",
              "#A#O#",
              "VOW#T",
              "#N#H#",
              "LAWS#"
            ],
            clues: [
              { clue: "Across 1: Celestial witness in common tongue" },
              { clue: "Across 2: Promise spoken under legal pressure" },
              { clue: "Across 3: Systems that govern people" }
            ]
          },
          success: {
            next: "planet_descent",
            text: "You complete the dead-language grid and recover a legal canticle. You can now read tribunal inscriptions.",
            effects: {
              lexicon: { ser: "star", va: "bind", tor: "oath" },
              flags: { oracleCanticleSolved: true, phraseKeyUnlocked: true },
              merchantReward: { credits: 150, factionKey: "religious", factionRenown: 1 }
            }
          },
          partial: {
            next: "planet_descent",
            text: "You solve enough of the grid to infer partial meaning, but one clause remains uncertain.",
            effects: {
              lexicon: { ser: "star", va: "bind" },
              flags: { oracleCanticleSolved: false, phraseKeyUnlocked: true },
              credits: 60
            }
          },
          fail: { next: "planet_descent", text: "You misplace too many glyphs and the oracle cuts the session short.", effects: { mentalStress: 1 } },
        },
      ],
    },

    corp_synod: {
      chapter: "c3",
      title: "The Gilded Synod",
      location: "Space / Corporate Chapel",
      mood: "Political knife fight",
      text: "Board lords, military envoys, and temple auditors debate whether Voss Karr should become a permanent trans-regional magistrate. Your evidence can sway the room or burn every bridge.",
      lessons: ["space", "missions"],
      options: [
        {
          id: "o1",
          text: "Leak the tide-ledger transaction tree",
          stat: "mind",
          baseDread: 10,
          req: { flagEq: { key: "ledgerCloned", value: true } },
          success: { next: "mara_arc", text: "The synod fractures as payment routes implicate half the chamber.", effects: { faction: { corporations: -1, political: 1 }, flags: { powerCoalitionCracked: true } } },
          fail: { next: "mara_arc", text: "Your leak lands, but counter-spin paints you as a forger.", effects: { faction: { corporations: 1 }, mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Cut a temporary pact to isolate Voss",
          stat: "lead",
          baseDread: 8,
          success: { next: "planet_descent", text: "Three blocs quietly agree to starve his private fleets.", effects: { faction: { political: 1, military: 1 }, flags: { provisionalPact: true } } },
          fail: { next: "planet_descent", text: "No pact, but your terms spread through backchannels.", effects: { renown: 1 } },
        },
      ],
    },

    mara_arc: {
      chapter: "c3",
      title: "Mara Quill's Lullaby",
      location: "Space",
      mood: "Love, danger, betrayal",
      text: "Mara sings in a language half made of static. She admits she once killed for Voss, then fell in love with the people he made her disappear. She asks if your story allows redemption.",
      options: [
        {
          id: "o1",
          text: "Offer redemption",
          stat: "spirit",
          baseDread: 8,
          req: { backgroundIncludes: ["temple", "scholar", "physician"] },
          success: { next: "planet_descent", text: "Mara gives you a true name key to Voss's private channel.", effects: { npc: { mara: 2 } } },
          fail: { next: "planet_descent", text: "She hears judgment in your voice and goes cold.", effects: { npc: { mara: -1 } } },
        },
        {
          id: "o2",
          text: "Demand proof, not poetry",
          stat: "control",
          baseDread: 8,
          success: { next: "planet_descent", text: "She delivers hard intel: prison colonies by reputation score.", effects: { faction: { corporations: -1, rebels: 1 } } },
          fail: { next: "planet_descent", text: "She withholds key details; you descend half-blind.", effects: { mentalStress: 1 } },
        },
      ],
    },

    planet_descent: {
      chapter: "c3",
      title: "The Orchard of Mirrors",
      location: "Planets",
      mood: "Blood-soaked fantasy sci-fi",
      text: "On the colony planet, black glass trees reflect futures where you become Voss Karr. Citizens wear mood collars keyed to faction rank. Dialogue itself is a weapon.",
      variants: [
        { when: { flagEq: { key: "provisionalPact", value: true } }, text: "Because of your synod pact, local garrisons hesitate to fire first." },
        { when: { flagEq: { key: "witnessChain", value: true } }, text: "Witnesses from the sea archive have already seeded resistance cells across the colony." },
      ],
      lessons: ["planets", "missions"],
      options: [
        {
          id: "o1",
          text: "Rally citizens with anti-crown rhetoric",
          stat: "lead",
          baseDread: 12,
          req: { factionAtLeast: { key: "rebels", min: 1 } },
          success: { next: "age_shift", text: "The colony revolts and sends you into temporal slipstream.", effects: { faction: { rebels: 1, military: -1 } } },
          fail: { next: "age_shift", text: "The revolt fails but exposes Voss's archives.", effects: { health: 1, renown: 1 } },
        },
        {
          id: "o2",
          text: "Duel the Warden in ritual combat",
          combat: {
            title: "Story Combat: Mirror Warden",
            dread: 12,
            enemies: ["Mirror Warden", "Glass Acolyte"],
            briefing: "The colony Warden answers your challenge with ritual steel and a witness-acolyte at their side."
          },
          success: { next: "age_shift", text: "You win and claim a temporal seal from the Warden's spine-plate.", effects: { renown: 1 } },
          fail: { next: "age_shift", text: "You survive on grit; the seal cracks but works once.", effects: { health: 2 } },
        },
        {
          id: "o3",
          text: "Outshoot the turret choir at dusk",
          combat: {
            title: "Story Combat: Turret Choir",
            dread: 12,
            enemies: ["Turret Choir Node", "Turret Choir Node", "Choir Spotter"],
            briefing: "Automated gun-nests harmonize their fire as dusk falls across the orchard."
          },
          success: { next: "age_shift", text: "Every shot rewrites a route through the siege.", effects: { credits: 150 } },
          fail: { next: "age_shift", text: "You break through but lose ammo and calm.", effects: { tmw: 1, mentalStress: 1 } },
        },
        {
          id: "o4",
          text: "Infiltrate the undercity ration market",
          stat: "valor",
          baseDread: 10,
          req: { backgroundIncludes: ["drifter", "merchant", "smuggler", "outlaw"] },
          success: { next: "undercity_market", text: "You slip under the city and find the loyalty-price algorithms.", effects: { flags: { undercityIntel: true }, credits: 120 } },
          fail: { next: "undercity_market", text: "You are spotted but still map two underground routes.", effects: { health: 1 } },
        },
        {
          id: "o5",
          text: "Read the black-glass inscription aloud",
          puzzle: {
            mode: "code",
            title: "Puzzle: Tribunal Canticle",
            prompt: "If SER=star, VA=bind, TOR=oath, translate and enter the phrase: SER VA TOR.",
            answer: "star bind oath",
          },
          req: { lexiconCountAtLeast: { count: 2 } },
          success: { next: "age_shift", text: "The trees answer in legal chorus, exposing hidden exits and sponsor caches.", effects: { renown: 1, merchantReward: { credits: 170, factionKey: "political", factionRenown: 1, item: "Trade Good" } } },
          partial: { next: "age_shift", text: "You recite most of the canticle correctly, opening only one of the hidden exits.", effects: { merchantReward: { credits: 90, factionKey: "political", factionRenown: 1 }, lexicon: { tor: "oath" } } },
          fail: { next: "age_shift", text: "Your pronunciation fractures the ritual, but the path still opens in panic.", effects: { mentalStress: 1, tmw: 1 } },
        },
        {
          id: "o6",
          text: "Your lazy reputation lets you blend in as a drone-collared citizen",
          stat: "control",
          baseDread: 8,
          req: { viceAny: ["Lazy", "Coward"] },
          success: { next: "age_shift", text: "You shuffle past every scanner checkpoint looking exactly like someone who gave up long ago. Invisibility through defeat.", effects: { flags: { blendedIn: true }, credits: 60 } },
          fail: { next: "age_shift", text: "Your performance wasn't quite hopeless enough to pass.", effects: { mentalStress: 1 } },
        },
        {
          id: "o7",
          text: "Draw on your wisest counsels and map the colony's hidden fault lines",
          stat: "mind",
          baseDread: 10,
          req: { virtueAny: ["Wisdom", "Justice", "Helpful"] },
          success: { next: "age_shift", text: "You identify the colony's three key breaking points and trigger a cascading structural failure in the loyalty algorithm.", effects: { renown: 1, faction: { rebels: 1 }, flags: { colonyFaultMapped: true } } },
          fail: { next: "age_shift", text: "The map is partial. You disrupt one subsystem, buying others time.", effects: { tmw: 1 } },
        },
      ],
    },

    undercity_market: {
      chapter: "c3",
      title: "Market of Borrowed Faces",
      location: "Planets / Undercity",
      mood: "Surreal criminal bazaar",
      text: "Brokers sell identities by the hour. A hidden broker offers Voss Karr's emergency exile route in exchange for one dangerous favor.",
      options: [
        {
          id: "o1",
          text: "Take the favor and run the smuggling strike",
          combat: {
            title: "Story Combat: Smuggling Strike",
            dread: 10,
            enemies: ["Checkpoint Enforcer", "Checkpoint Enforcer", "Route Broker"],
            briefing: "The broker's favor turns into a live raid through checkpoints and hired guns."
          },
          success: { next: "age_shift", text: "You complete the strike and gain an exile-route shard.", effects: { flags: { exileRouteKnown: true }, renown: 1 } },
          fail: { next: "age_shift", text: "The strike turns loud, but you still secure part of the route.", effects: { mentalStress: 1, tmw: 1 } },
        },
        {
          id: "o2",
          text: "Refuse and buy the route with leverage",
          stat: "control",
          baseDread: 8,
          success: { next: "age_shift", text: "You trade blackmail files for clean coordinates.", effects: { flags: { exileRouteKnown: true }, credits: -140 } },
          fail: { next: "age_shift", text: "The broker doubles the price and marks your profile.", effects: { credits: -180, faction: { underworld: -1 } } },
        },
      ],
    },

    age_shift: {
      chapter: "c4",
      title: "Thirty Years in One Blink",
      location: "Ages and Seasons",
      mood: "Cosmic absurd tragedy",
      text: "The temporal seal ruptures. You watch decades collapse into a breath. Spring burns into Harvest, Harvest freezes into Winter. The World That Was calls your true name.",
      options: [
        {
          id: "o1",
          text: "Enter the World That Was",
          jump: { context: "space", tab: "worldthatwas", setAge: "grey", setSeason: "winter", advanceDays: 30 },
          success: { next: "wtw_reckoning", text: "You arrive where every power keeps its dirtiest memory." },
        },
      ],
    },

    wtw_reckoning: {
      chapter: "c4",
      title: "City of Last Accounts",
      location: "World That Was",
      mood: "Urban mythic finale",
      text: "Districts pulse with active skirmishes. Voss Karr broadcasts verdicts through station speakers: every failure proves people need chains. You can break his machine by force, by testimony, or by making his allies abandon him.",
      variants: [
        { when: { flagEq: { key: "powerCoalitionCracked", value: true } }, text: "Half his allied banners are missing from the plaza; rumor says they withdrew overnight." },
        { when: { flagEq: { key: "exileRouteKnown", value: true } }, text: "A maintenance map reveals Voss's private escape corridor beneath District Twelve." },
      ],
      lessons: ["wtw", "skirmish", "combat"],
      options: [
        {
          id: "o1",
          text: "Win district skirmishes to collapse his logistics",
          jump: { tab: "worldthatwas" },
          combat: {
            title: "Story Combat: District Logistics Break",
            dread: 12,
            enemies: ["Supply Marshal", "Logistics Enforcer", "Ration Guard", "Drone Porter"],
            briefing: "You have reached the district chokepoint. Break the supply ring and Voss's logistics start to starve."
          },
          success: { next: "finale_gate", text: "Control shifts. His armies begin to starve." },
          fail: { next: "finale_gate", text: "The district bleeds, but you still rupture enough supply lines to expose the final gate.", effects: { health: 2, mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Face him in direct duel",
          combat: {
            title: "Story Combat: Voss Karr",
            dread: 20,
            enemies: ["Voss Karr", "Judgment Shade"],
            briefing: "Voss meets you behind the terror field with scripture, steel, and a generated bodyguard of doctrine."
          },
          success: { next: "finale_choice", text: "You endure his terror field and close to speaking distance." },
          fail: { next: "finale_choice", text: "You are battered, but his mask cracks and reveals fear.", effects: { health: 2 } },
        },
        {
          id: "o3",
          text: "Turn major powers against him",
          stat: "control",
          baseDread: 12,
          req: { factionAtLeastAny: [{ key: "corporations", min: 4 }, { key: "political", min: 4 }, { key: "military", min: 4 }] },
          success: { next: "finale_choice", text: "His coalition fractures on live feed.", effects: { renown: 2 } },
          fail: { next: "finale_choice", text: "They stall, but your leaks still wound him.", effects: { mentalStress: 1 } },
        },
        {
          id: "o4",
          text: "Call in your allies for a public reckoning",
          stat: "lead",
          baseDread: 10,
          req: { usedStatCountAtLeast: { count: 5 } },
          success: { next: "ally_reckoning", text: "Lyra, Mara, and city witnesses converge on the courthouse steps.", effects: { flags: { allySummit: true } } },
          fail: { next: "ally_reckoning", text: "Only some allies answer, but it is still enough to force a hearing.", effects: { mentalStress: 1 } },
        },
        {
          id: "o5",
          text: "Your addicted or exiled misfortune makes you an unexpected folk hero",
          stat: "spirit",
          baseDread: 8,
          req: { misfortuneIs: "Addicted" },
          success: { next: "ally_reckoning", text: "City survivors recognize your scars and fall in behind you — the broken leading the held-down.", effects: { renown: 2, faction: { rebels: 2 }, flags: { misfortuneRallied: true } } },
          fail: { next: "wtw_reckoning", text: "The crowd sees the cracks before they see the cause.", effects: { mentalStress: 1 } },
        },
        {
          id: "o6",
          text: "Your honest reputation makes districts believe you without credentials",
          stat: "lead",
          baseDread: 6,
          req: { reputationAny: ["Honest", "Wise", "Leader"] },
          success: { next: "finale_gate", text: "A reputation earned in travel crosses factions. Three district leaders publicly endorse your position.", effects: { renown: 2, faction: { political: 1 }, flags: { repEndorsed: true } } },
          fail: { next: "ally_reckoning", text: "Not every district has heard of you yet. Some doors stay shut.", effects: { mentalStress: 1 } },
        },
        {
          id: "o7",
          text: "Your mutation grants physical presence — lead the march through the district",
          stat: "body",
          baseDread: 10,
          req: { mutationIncludes: ["rippling", "superhuman", "thick", "crocodile", "tusks", "enormous"] },
          success: { next: "ally_reckoning", text: "You march through the district. Nothing stops you. The crowd follows because something fearless is walking ahead.", effects: { renown: 1, faction: { military: 1 } } },
          fail: { next: "ally_reckoning", text: "Size isn't everything. You draw attention but not yet allegiance.", effects: { health: 1 } },
        },
      ],
    },

    ally_reckoning: {
      chapter: "c4",
      title: "Witness Parliament",
      location: "World That Was",
      mood: "Defiant civic drama",
      text: "Survivors, defectors, and old rivals testify in a rolling tribunal. Voss Karr's certainty slips as every district narrates its own wounds.",
      options: [
        {
          id: "o1",
          text: "Let Lyra lead the testimony",
          stat: "spirit",
          baseDread: 8,
          req: { npcAffinity: { npc: "lyra", min: 1 } },
          success: { next: "finale_gate", text: "Lyra's testimony shifts neutral observers to your side.", effects: { faction: { political: 1 }, npc: { lyra: 1 }, consequenceTags: ["witness_tribunal_won", "lyra_testimony_held"] } },
          fail: {
            next: "lyra_martyr",
            text: "An assassin round strikes Lyra mid-testimony. The chamber erupts.",
            effects: { mentalStress: 2, faction: { military: -1 }, consequenceTags: ["lyra_martyred", "tribunal_broken"] },
            irreversible: { killNpc: ["lyra"], lockFlags: ["lyraArcLocked"], unlockFlags: ["martyrUprising"] }
          },
        },
        {
          id: "o2",
          text: "Let Mara broadcast the hidden ledgers",
          stat: "mind",
          baseDread: 8,
          req: { npcAffinity: { npc: "mara", min: 1 } },
          success: { next: "finale_gate", text: "Data storms break across every district screen.", effects: { faction: { corporations: -1, rebels: 1 }, npc: { mara: 1 }, consequenceTags: ["ledger_broadcast", "mara_network_live"] } },
          fail: {
            next: "mara_blackout",
            text: "Mara's uplink is traced and burned. Her network collapses in minutes.",
            effects: { tmw: 1, mentalStress: 1, consequenceTags: ["mara_blackout", "truth_channel_lost"] },
            irreversible: { killNpc: ["mara"], lockFlags: ["maraArcLocked"], unlockFlags: ["blackoutDoctrine"] }
          },
        },
      ],
    },

    lyra_martyr: {
      chapter: "c4",
      title: "Lyra's Last Oath",
      location: "World That Was",
      mood: "Irreversible grief",
      text: "Lyra dies with one command: finish this in daylight, not shadow. Her death hardens half the city and radicalizes the rest.",
      options: [
        {
          id: "o1",
          text: "Carry her oath to the final court",
          success: { next: "finale_gate", text: "Her name becomes a rallying cry in every district square." },
        },
      ],
    },

    mara_blackout: {
      chapter: "c4",
      title: "Signal Funeral",
      location: "World That Was",
      mood: "Collapsed networks",
      text: "With Mara gone, the city loses its fastest truth-channel. You must now win by witness and force, not broadcast.",
      options: [
        {
          id: "o1",
          text: "Advance to final court without her network",
          success: { next: "finale_gate", text: "You proceed with fewer allies and no clean comms cover." },
        },
      ],
    },

    finale_gate: {
      chapter: "c4",
      title: "Threshold of Verdict",
      location: "World That Was",
      mood: "Noir cathedral",
      text: "At the courthouse-cathedral, Lyra and Mara both arrive. One asks for justice. The other asks for mercy. Voss Karr kneels before neither.",
      options: [
        {
          id: "o1",
          text: "Proceed to final judgment",
          success: { next: "finale_choice", text: "The city holds its breath.", effects: { consequenceTags: ["final_judgment_opened"] } },
        },
        {
          id: "o2",
          text: "Invoke the decoded canticle before witnesses",
          req: { flagEq: { key: "phraseKeyUnlocked", value: true }, lexiconKnown: ["ser", "va", "tor"] },
          success: { next: "finale_canticle", text: "The courtroom wards unlock and Voss loses control of his legal machinery.", effects: { renown: 2, faction: { religious: 1, political: 1 }, consequenceTags: ["canticle_invoked"] } },
        },
      ],
    },

    finale_canticle: {
      chapter: "c4",
      title: "The Third Tongue",
      location: "World That Was",
      mood: "Ritual courtroom duel",
      text: "You speak the reconstructed phrase. Statues crack. Archived verdicts replay in public. Voss Karr tries to counter with forged scripture.",
      options: [
        {
          id: "o1",
          text: "Let Iosef and Lyra co-deliver the final testimony",
          stat: "lead",
          baseDread: 10,
          req: { npcAffinity: { npc: "iosef", min: 2 }, quoteKnownAny: ["No verdict outranks witness", "Mercy is not weakness"] },
          success: { next: "ending_openhand", text: "Their testimony lands like thunder. The city chooses distributed justice.", effects: { faction: { political: 1, rebels: 1 }, renown: 2, consequenceTags: ["canticle_allied_testimony"] } },
          fail: { next: "finale_choice", text: "The testimony splinters under counterclaims; you must choose direct judgment.", effects: { mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Recite remembered voices back at Voss",
          stat: "spirit",
          baseDread: 10,
          req: { quoteKnownAny: ["Mercy is not weakness", "Ledger first, sword second", "No verdict outranks witness"] },
          success: { next: "ending_openhand", text: "Your borrowed lines from allies turn the crowd. Voss is outnumbered by memory.", effects: { renown: 2, faction: { rebels: 1, political: 1 }, consequenceTags: ["canticle_memory_weaponized"] } },
          fail: { next: "finale_choice", text: "You falter on the final line and Voss regains the room for a moment.", effects: { mentalStress: 1 } },
        },
        {
          id: "o3",
          text: "Challenge Voss to a last legal paradox",
          puzzle: {
            mode: "code",
            title: "Puzzle: Final Paradox",
            prompt: "Complete the paradox phrase with one word: 'No law is lawful unless it can be ____ by the powerless.'",
            answer: "challenged",
          },
          success: { next: "ending_openhand", text: "He fails to answer before the city. Authority disperses in real time.", effects: { renown: 3, merchantReward: { credits: 220, factionKey: "corporations", factionRenown: 1, openShop: true }, consequenceTags: ["canticle_paradox_resolved"] } },
          partial: { next: "ending_openhand", text: "Your argument lands unevenly, but enough delegates break rank to pass the charter.", effects: { renown: 1, credits: 80, consequenceTags: ["canticle_charter_partial"] } },
          fail: { next: "finale_choice", text: "He twists the argument and the room demands a harsher verdict.", effects: { tmw: 1, consequenceTags: ["canticle_backfire"] } },
        },
        {
          id: "o4",
          text: "Use your augmentations to sync every courthouse relay",
          stat: "control",
          baseDread: 12,
          req: { augmentationsAny: ["operating system", "nightguard", "analyzer", "3h7-arcane"] },
          success: { next: "ending_openhand", text: "Your implants chain the witness relays into one undeniable feed. Voss loses narrative control in seconds.", effects: { renown: 2, faction: { political: 1, rebels: 1 }, consequenceTags: ["relay_sync_control"] } },
          fail: { next: "finale_choice", text: "The relay sync stutters, but enough footage leaks to force the final judgment phase.", effects: { mentalStress: 1, tmw: 1 } },
        },
        {
          id: "o5",
          text: "Deploy a master hack to seize the verdict engines",
          stat: "control",
          baseDread: 12,
          req: { augmentationsAny: ["operating system"], ownedHacksAny: ["lashout", "collapse", "aegies", "parasyte", "short circuit", "weapon glitch"] },
          success: { next: "ending_openhand", text: "Judgment drones freeze mid-sentence and project the unedited ledgers to the whole city.", effects: { renown: 2, faction: { corporations: -1, rebels: 1, political: 1 }, consequenceTags: ["verdict_engine_hacked"] } },
          fail: { next: "finale_choice", text: "Counter-intrusion burns your exploit. The room survives long enough to demand a direct ruling.", effects: { health: 1, tmw: 1 } },
        },
        {
          id: "o6",
          text: "Pick the reliquary lock and cast the binding scroll aloud",
          stat: "mind",
          baseDread: 11,
          req: { backpackAny: ["lockpick", "dungeoneer's kit", "scavenger's pouch", "scroll", "warding sigil", "bind oath", "none can lie"], consumeRequiredItem: true },
          success: { next: "ending_openhand", text: "Steel clicks, parchment ignites, and the court is forced under the same oath Voss imposed on others.", effects: { renown: 2, faction: { religious: 1, political: 1 }, consequenceTags: ["binding_rite_enforced"] } },
          fail: { next: "finale_choice", text: "The lock opens late and the rite fractures, but your evidence still reaches the floor before sentencing.", effects: { mentalStress: 1 } },
        },
      ],
    },

    finale_choice: {
      chapter: "c4",
      title: "The Pale Magistrate",
      location: "Finale",
      mood: "Operatic endgame",
      text: "Voss Karr: 'People do not want freedom. They want someone to blame.' The room waits for your answer.",
      options: [
        {
          id: "o1",
          text: "Execute Voss Karr and end his reign",
          stat: "strike",
          baseDread: 12,
          success: { next: "ending_iron", text: "You end him. Order shatters into contested freedom.", effects: { renown: 2, faction: { military: 1, religious: -1 }, consequenceTags: ["voss_executed"] } },
          fail: { next: "ending_iron", text: "You still kill him, but at ruinous cost.", effects: { health: 2, mentalStress: 2, consequenceTags: ["voss_executed_pyrrhic"] } },
        },
        {
          id: "o2",
          text: "Spare him and expose the system publicly",
          stat: "lead",
          baseDread: 12,
          success: { next: "ending_glass", text: "The city rejects him alive, which wounds him deeper than death.", effects: { renown: 2, faction: { political: 1, underworld: -1 }, consequenceTags: ["voss_spared_publicly"] } },
          fail: { next: "ending_glass", text: "The speech fractures, but enough truth leaks out to unseat him.", effects: { mentalStress: 1, consequenceTags: ["voss_spared_fragile"] } },
        },
        {
          id: "o3",
          text: "Bind him to the same laws he forged",
          stat: "mind",
          baseDread: 12,
          req: { careerIncludes: ["priest", "investigator", "noble", "historian"] },
          success: { next: "ending_blacksun", text: "He becomes prisoner of his own doctrine.", effects: { faction: { corporations: -1, rebels: 1 }, renown: 3, consequenceTags: ["voss_bound_by_law"] } },
          fail: { next: "ending_blacksun", text: "The ritual is imperfect, but his authority breaks anyway.", effects: { tmw: 1, consequenceTags: ["voss_binding_unstable"] } },
        },
        {
          id: "o4",
          text: "Draft a distributed civic charter on live feed",
          stat: "control",
          baseDread: 10,
          req: { flagEq: { key: "allySummit", value: true } },
          success: { next: "ending_openhand", text: "District delegates sign in real time as Voss loses narrative control.", effects: { renown: 3, faction: { political: 2, rebels: 1 }, consequenceTags: ["distributed_charter"] } },
          fail: { next: "ending_openhand", text: "The charter launches amid chaos, but it still decentralizes power.", effects: { mentalStress: 2, renown: 1, consequenceTags: ["distributed_charter_fragile"] } },
        },
        {
          id: "o5",
          text: "Issue the Martyr Verdict",
          stat: "lead",
          baseDread: 14,
          req: { flagEq: { key: "lyraDead", value: true } },
          success: { next: "ending_iron", text: "You invoke Lyra's name and the city backs a hard verdict with irreversible force.", effects: { renown: 3, faction: { military: 1, political: -1 }, consequenceTags: ["martyr_verdict"] } },
          fail: { next: "ending_iron", text: "The chamber fractures, but vengeance still carries the day.", effects: { health: 1, mentalStress: 2, consequenceTags: ["martyr_verdict_unstable"] } },
        },
        {
          id: "o6",
          text: "Call in your backstory network: settle the rival, elevate the trusted contact, and lock a new civic balance",
          stat: "lead",
          baseDread: 12,
          req: { backstoryRivalExists: true, backstoryConnectionExists: true },
          success: { next: "ending_openhand", text: "Your rival is neutralized by politics, not blood. Your contact builds the first stable coalition and the city chooses distributed rule.", effects: { renown: 3, faction: { political: 1, rebels: 1 }, consequenceTags: ["backstory_network_resolution"] } },
          fail: { next: "ending_glass", text: "The network partially holds. It averts the worst collapse, but governance remains fragile and contested.", effects: { mentalStress: 1, consequenceTags: ["backstory_network_fragile"] } },
        },
        {
          id: "o_dark",
          text: "⚠ Take the throne. Become what the world fears.",
          stat: "spirit",
          baseDread: 14,
          req: { consequenceTagAny: ["tag:lyra_martyred", "tag:mara_blackout", "tag:canticle_backfire", "tag:tribunal_broken"] },
          success: { next: "dark_coronation", text: "You speak Voss's doctrine back at him — and mean it. The room falls silent, then kneels.", effects: { renown: 4, faction: { military: 2, political: -2, rebels: -2 }, consequenceTags: ["dark_claim_throne"] } },
          fail: { next: "dark_ascension_collapse", text: "The room rejects you loudly. You retreat into something colder than ambition.", effects: { mentalStress: 3, renown: 1 } },
        },
        {
          id: "o_ally",
          text: "⚠ Offer Voss Karr an alliance — against a greater threat",
          stat: "lead",
          baseDread: 14,
          req: { consequenceTagAny: ["tag:ledger_broadcast", "tag:relay_sync_control", "tag:verdict_engine_hacked", "tag:canticle_paradox_resolved"] },
          success: { next: "dark_pact_sealed", text: "He listens. He always respected pragmatism more than virtue. You become the worst thing — an equal.", effects: { renown: 2, faction: { corporations: 2, rebels: -3 }, consequenceTags: ["voss_alliance_bid"] } },
          fail: { next: "finale_choice", text: "He laughs. You're not yet ruthless enough. But you could be.", effects: { mentalStress: 2 } },
        },
        {
          id: "o_time",
          text: "⚠ Open the Chrono Ledger and rewrite who the villain was",
          stat: "control",
          baseDread: 14,
          req: { lexiconKnownAny: ["ser", "va", "tor"], consequenceTagAny: ["tag:canticle_invoked", "tag:canticle_memory_weaponized", "tag:canticle_paradox_resolved"] },
          success: { next: "time_fracture", text: "The court buckles. Years invert. You wake before the first magistrate existed.", effects: { flags: { timeFractureOpened: true }, renown: 2, consequenceTags: ["timeline_rewrite_attempt"] } },
          fail: { next: "dark_coronation", text: "The time-lock resists you, but the throne does not.", effects: { mentalStress: 2 } },
        },
        {
          id: "o_time_edge",
          text: "⚠ Use your own temporal gift to split the verdict before it lands",
          stat: "control",
          baseDread: 12,
          req: { flavorAny: ["reverse time", "time traveler", "stop time", "slow time"], consequenceTagAny: ["tag:canticle_invoked", "tag:canticle_memory_weaponized", "tag:canticle_paradox_resolved"] },
          success: { next: "time_fracture", text: "You catch the instant before judgment hardens and pull it sideways. The room shudders into an earlier century.", effects: { flags: { timeFractureOpened: true, personalTimeRift: true }, renown: 3, consequenceTags: ["timeline_personal_rift"] } },
          fail: { next: "finale_choice", text: "You split the moment but cannot hold it. The chamber remembers what almost happened and turns colder.", effects: { mentalStress: 2, tmw: 1, consequenceTags: ["timeline_split_failed"] } },
        },
      ],
    },

    time_fracture: {
      chapter: "c4",
      title: "The First Verdict Never Happened",
      location: "Green Age / Temporal Court",
      mood: "Paradox noir",
      text: "You fall backward into the city's founding era. The court has no ruler yet, only hunger and frightened districts. A blank seal awaits a name. If you stamp it, history will remember you as the origin of all this terror.",
      options: [
        {
          id: "o1",
          text: "Take the name Voss Karr and found the Pale Legion",
          stat: "lead",
          baseDread: 10,
          success: {
            next: "warfront_genesis",
            text: "You sign as Voss Karr. Nine district captains kneel. The Pale Legion is born in your image.",
            effects: {
              storyAlias: "Voss Karr",
              startArmy: { name: "Pale Legion", strength: 9, doctrine: "Judgment Through Force" },
              activateWarfront: 9,
              faction: { military: 2, corporations: 1, rebels: -2 },
              flags: { timeVillainOrigin: true },
              consequenceTags: ["timeline_legion_founded", "timeline_self_coronation"]
            }
          },
          fail: {
            next: "warfront_genesis",
            text: "The title lands unevenly, but enough captains follow your first war order.",
            effects: {
              storyAlias: "Voss Karr",
              startArmy: { name: "Pale Legion", strength: 6, doctrine: "Fear and Logistics" },
              activateWarfront: 7,
              mentalStress: 1,
              consequenceTags: ["timeline_legion_fragile"]
            }
          },
        },
        {
          id: "o2",
          text: "Forge a different mask and build an army anyway",
          stat: "mind",
          baseDread: 10,
          success: {
            next: "warfront_genesis",
            text: "You erase your old name and choose a colder one. The districts call your host the Iron Choir.",
            effects: {
              storyAlias: "The Iron Regent",
              startArmy: { name: "Iron Choir", strength: 8, doctrine: "Order by Siege" },
              activateWarfront: 8,
              faction: { political: 1, military: 2, rebels: -2 },
              consequenceTags: ["timeline_iron_choir", "timeline_mask_forged"]
            }
          },
          fail: {
            next: "warfront_genesis",
            text: "Your alias leaks early, but the army still forms around your command aura.",
            effects: {
              storyAlias: "The Iron Regent",
              startArmy: { name: "Iron Choir", strength: 5, doctrine: "Emergency Rule" },
              activateWarfront: 6,
              tmw: 1,
              consequenceTags: ["timeline_alias_leaked"]
            }
          },
        },
        {
          id: "o3",
          text: "Reject the loop and return to your own era",
          stat: "spirit",
          baseDread: 12,
          success: { next: "finale_choice", text: "You leave the blank seal untouched and force history back onto uncertain rails.", effects: { renown: 1, flags: { timeFractureOpened: true }, consequenceTags: ["timeline_rejected_loop"] } },
          fail: { next: "dark_coronation", text: "The loop clings to you. You return with villain instincts sharpened.", effects: { mentalStress: 1, consequenceTags: ["timeline_corruption_seeded"] } },
        },
        {
          id: "o4",
          text: "Read the chamber's dead futures before choosing a founder",
          stat: "mind",
          baseDread: 10,
          req: { flavorAny: ["time traveler", "grave whisper", "relive last moments"] },
          success: { next: "warfront_genesis", text: "You see three dead futures stacked over the blank seal and pick the least catastrophic opening. Your first campaign begins with clearer supply lines and fewer lies.", effects: { activateWarfront: 10, renown: 2, faction: { political: 1 }, consequenceTags: ["timeline_dead_futures_read"] } },
          fail: { next: "warfront_genesis", text: "You read too many endings at once. One useful future remains, but it scars your judgment.", effects: { mentalStress: 2, tmw: 1, consequenceTags: ["timeline_future_overload"] } },
        },
      ],
    },

    warfront_genesis: {
      chapter: "c4",
      title: "War of Nine Districts",
      location: "World That Was / Great Warfront",
      mood: "Total war strategy",
      text: "Your banners ignite all nine districts at once. Rail lines become fronts. Landing pads become siege points. Every marker now means territory, supply, and blood. This is no duel. This is a war engine.",
      lessons: ["wtw", "skirmish", "combat"],
      options: [
        {
          id: "o1",
          text: "Launch synchronized district offensives (Skirmish Campaign)",
          jump: { tab: "worldthatwas" },
          combat: {
            title: "Story Combat: Warfront Breakthrough",
            dread: 12,
            enemies: ["Frontline Marshal", "Siege Captain", "Signal Warden", "Drone Cohort"],
            briefing: "Command the first breakthrough while district skirmishes erupt across the map."
          },
          success: { next: "warfront_campaign", text: "Your coordinated pushes take three districts in one cycle.", effects: { activateWarfront: 12, renown: 2, consequenceTags: ["warfront_breakthrough", "authoritarian_warfront"] } },
          fail: { next: "warfront_campaign", text: "You hold the line but pay dearly in the first assault.", effects: { activateWarfront: 10, health: 2, mentalStress: 1, consequenceTags: ["warfront_pyrrhic_assault"] } },
        },
        {
          id: "o2",
          text: "Win the war by decapitating enemy command",
          combat: {
            title: "Story Combat: Command Bunker Raid",
            dread: 14,
            enemies: ["Bunker General", "Honor Guard", "Honor Guard", "Counter-Hack Cleric"],
            briefing: "If command falls, every ongoing skirmish shifts in your favor."
          },
          success: { next: "warfront_campaign", text: "Enemy command collapses; your field armies surge.", effects: { activateWarfront: 11, faction: { military: 2 }, consequenceTags: ["warfront_command_decapitated"] } },
          fail: { next: "warfront_campaign", text: "The bunker holds long enough to bleed your offensive momentum.", effects: { activateWarfront: 9, tmw: 1, consequenceTags: ["warfront_momentum_lost"] } },
        },
        {
          id: "o3",
          text: "Flip the war into a public coalition before it consumes everyone",
          stat: "lead",
          baseDread: 12,
          success: { next: "ending_openhand", text: "You halt total war and replace it with a hard, imperfect coalition charter.", effects: { renown: 3, faction: { political: 2, rebels: 1 }, consequenceTags: ["warfront_coalition_turn"] } },
          fail: { next: "warfront_campaign", text: "The coalition speech fails. The only language left is force.", effects: { mentalStress: 2, consequenceTags: ["warfront_diplomacy_failed"] } },
        },
      ],
    },

    warfront_campaign: {
      chapter: "c4",
      title: "Hammer and Rail",
      location: "World That Was / Siege Cycle",
      mood: "strategic apocalypse",
      text: "The warfront now defines the era. District by district, you either become the tyrant history warns about or the commander who ended war by mastering it first.",
      options: [
        {
          id: "o1",
          text: "Claim absolute victory and rule the scarred world",
          stat: "control",
          baseDread: 12,
          success: { next: "ending_time_tyrant", text: "You win the war and write peace as a weapon.", effects: { renown: 4, faction: { military: 2, corporations: 1, rebels: -3 }, consequenceTags: ["warfront_absolute_victory"] } },
          fail: { next: "ending_dark_throne", text: "Victory comes, but less clean than planned. The throne still takes you.", effects: { mentalStress: 1, consequenceTags: ["warfront_throne_drift"] } },
        },
        {
          id: "o2",
          text: "Break your own army and let districts choose their rulers",
          stat: "spirit",
          baseDread: 12,
          success: { next: "ending_glass", text: "You dismantle your command structure in public. The war ends because your power does.", effects: { renown: 3, faction: { rebels: 2, political: 1 }, consequenceTags: ["warfront_self_disarm"] } },
          fail: { next: "ending_iron", text: "The army fractures violently. Peace arrives only after a final hard verdict.", effects: { health: 1, mentalStress: 2, consequenceTags: ["warfront_fragmented_peace"] } },
        },
      ],
    },

    // ── DARK PATH ──────────────────────────────────────────────────────────────
    dark_coronation: {
      chapter: "c4",
      title: "The New Magistrate",
      location: "The Pale Court",
      mood: "Cold ascension",
      text: "The seat is warm. You realize it has always been warm. The ledgers are already open and waiting for your handwriting. Across the city, something that was watching all this — something very old — approves.",
      options: [
        {
          id: "o1",
          text: "Rewrite the ledgers in your own name — erase Voss's legacy entirely",
          stat: "mind",
          baseDread: 10,
          puzzle: { mode: "code", title: "Cipher: The Name Beneath", prompt: "Each noble house's ledger is sealed by a phrase. Voss's seal reads: 'Power is __ without witness.' Complete it to break the seal.", answer: "nothing" },
          success: { next: "ending_dark_throne", text: "History is revised. The previous Magistrate is a footnote. You are the only name.", effects: { renown: 4, faction: { corporations: 2, military: 1, rebels: -3, political: -1 } } },
          fail: { next: "ending_dark_throne", text: "Some names resist erasure. But yours sits above them now.", effects: { renown: 2, mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Use the power to tear down the system — from the inside",
          stat: "lead",
          baseDread: 12,
          puzzle: { mode: "memory", title: "Sequence: The Seven Pillars", prompt: "The Pale Court rests on seven interdependent institutions. Recall the order they were corrupted, then name the first one to fall.", sequence: ["TRADE", "FAITH", "GUARD", "COIN", "LAW", "PRESS", "CROWN"], answer: "trade" },
          success: { next: "ending_glass", text: "You took the crown to melt it. The city is free — and you are very tired.", effects: { renown: 3, faction: { rebels: 2, political: 1 } } },
          fail: { next: "ending_dark_throne", text: "The system absorbs you before you can destroy it. This is how it has always worked.", effects: { mentalStress: 2, renown: 2 } },
        },
        {
          id: "o3",
          text: "Rule for sixty days, then disappear — let them wonder forever",
          stat: "spirit",
          baseDread: 8,
          success: { next: "ending_ghost_king", text: "Sixty days of hard justice. Then — nothing. A legend where a person used to be.", effects: { renown: 5, faction: { underworld: 2, rebels: 1 } } },
          fail: { next: "ending_dark_throne", text: "The sixty days became sixty years. No one left to tell you to stop.", effects: { renown: 3, mentalStress: 3 } },
        },
      ],
    },

    dark_pact_sealed: {
      chapter: "c4",
      title: "Voss and You",
      location: "The Pale Court — private chamber",
      mood: "Cold collaboration",
      text: "Voss Karr pours two glasses from a decanter that has waited on the shelf for a long time. He slides one across. 'I always knew someone like you would eventually arrive,' he says. 'The question was whether they'd sit across from me or beside me.'",
      options: [
        {
          id: "o1",
          text: "Accept the glass. Define the terms of the partnership.",
          stat: "lead",
          baseDread: 10,
          success: { next: "ending_pale_accord", text: "He accepts. The terms are written in water but sealed in iron. You invoke the lantern — witnesses, ceremony, a civic bond.", effects: { renown: 3, faction: { corporations: 2, military: 1, rebels: -2 }, flags: { deityPactEnding: "lantern_herald" } } },
          fail: { next: "dark_coronation", text: "The terms collapse. He offers the throne instead — alone.", effects: { mentalStress: 1 } },
        },
        {
          id: "o2",
          text: "Take the glass. Then tip it into his.",
          stat: "control",
          baseDread: 12,
          puzzle: { mode: "code", title: "Sleight of Hand", prompt: "Complete the phrase a poisoner lives by: 'Trust is the __ between every act of treachery.'", answer: "bridge" },
          success: { next: "ending_iron", text: "He realizes a half-second too late. A fitting end to someone who trusted no one.", effects: { renown: 4, faction: { military: 1, underworld: 1 } } },
          fail: { next: "dark_pact_sealed", text: "He notices. But instead of fury — admiration. The partnership begins anyway.", effects: { mentalStress: 1 } },
        },
        {
          id: "o3",
          text: "Leave the glass on the table. Walk out. Make him come to you.",
          stat: "spirit",
          baseDread: 10,
          success: { next: "ending_pale_accord", text: "He comes. Three days later, hat in hand. All debts now flow through you — chain bound to your will, not his.", effects: { renown: 4, faction: { corporations: 1, rebels: -1 }, flags: { deityPactEnding: "chain_bound" } } },
          fail: { next: "finale_choice", text: "He shrugs and empties both glasses alone. You lost this game by playing it.", effects: { mentalStress: 2 } },
        },
        {
          id: "o4",
          text: "Before sitting — invoke the sigil of dissolution. Break the ledger's hold publicly, before the pact can seal.",
          stat: "spirit",
          baseDread: 11,
          success: { next: "ending_pale_accord", text: "The sigil cracks. The pact shatters. The frontier breathes free of both your names. He watches, furious and fascinated. You are the first to ever walk away with the debt dissolved.", effects: { renown: 3, faction: { rebels: 2, underworld: 1, corporations: -2 }, consequenceTags: ["oathbreaker_dissolution"], flags: { deityPactEnding: "oathbreaker" } } },
          fail: { next: "dark_pact_sealed", text: "The sigil recoils. Voss simply refills your glass. 'Try that again and I'll be impressed,' he says. The room is sealed.", effects: { mentalStress: 1 } },
        },
      ],
    },

    dark_ascension_collapse: {
      chapter: "c4",
      title: "What You Almost Were",
      location: "Below the Pale Court",
      mood: "Bitter reckoning",
      text: "They rejected you. Not because you were too dark — because you hesitated. Voss Karr reads the room, reads you, and smiles slowly. 'Not yet,' he says. 'But soon.' Under the court, in the archive no one is supposed to reach, you find the sealed ledger with your name in it. You were always in the plan.",
      options: [
        {
          id: "o1",
          text: "Burn the ledger — deny him the satisfaction of knowing he predicted you",
          stat: "body",
          baseDread: 8,
          success: { next: "finale_choice", text: "The page burns. You return to the chamber free of that particular fate.", effects: { tmw: 2 } },
          fail: { next: "ending_dark_throne", text: "The ink survives the fire. Something that cannot be owned stares back.", effects: { mentalStress: 2 } },
        },
        {
          id: "o2",
          text: "Read it. Every word. Become what was written.",
          stat: "mind",
          baseDread: 6,
          puzzle: { mode: "code", title: "The Ledger's Final Line", prompt: "The last entry in the ledger is yours — encrypted. It reads: 'Subject is not running from fate. Subject is __ it.' What word completes your file?", answer: "writing" },
          success: { next: "dark_coronation", text: "Understanding is halfway to mastery. You ascend knowing every step was designed — and not caring.", effects: { renown: 2, mentalStress: 1 } },
          fail: { next: "dark_coronation", text: "The words are ordinary. That is the most frightening thing. You ascend anyway.", effects: { mentalStress: 3 } },
        },
      ],
    },

    pact_mid_lantern: {
      chapter: "c4",
      title: "Pact Interlude: Lantern Procession",
      location: "Epilogue Threshold",
      mood: "sacred public theater",
      text: "As judgment nears, temple courtyards flood with citizens carrying ash-lanterns in your name. The pact is no longer private debt. It has become a civic expectation. Every final ruling now passes through this procession first.",
      options: [
        {
          id: "o1",
          text: "Turn the procession into a public covenant charter",
          stat: "lead",
          baseDread: 10,
          success: { next: "ending_pact_lantern", text: "You bind law and mercy in one ceremony. The city follows the lantern route, not the throne route.", effects: { renown: 2, faction: { religious: 1, political: 1 }, consequenceTags: ["deity_lantern_charter"] } },
          fail: { next: "ending_openhand", text: "The procession fractures, but enough delegates still pass a distributed charter.", effects: { consequenceTags: ["deity_lantern_unstable"] } },
        },
      ],
    },

    pact_mid_chain: {
      chapter: "c4",
      title: "Pact Interlude: Chain Audit",
      location: "Debt Courts",
      mood: "predatory bureaucracy",
      text: "Before your final sentence can stand, debt-ledgers from shrines, guilds, and warfront contractors are hauled into one chamber. Your pact debt is now state debt. Every creditor wants blood, collateral, or both.",
      options: [
        {
          id: "o1",
          text: "Accept debt supremacy and enforce the chain as law",
          stat: "control",
          baseDread: 11,
          success: { next: "ending_pact_chain", text: "You declare debt the highest court. Order survives, humanity does not.", effects: { renown: 1, faction: { corporations: 1, underworld: 1, rebels: -2 }, consequenceTags: ["deity_chain_enforced"] } },
          fail: { next: "ending_dark_throne", text: "You keep power, but creditors now own your horizon.", effects: { mentalStress: 1, consequenceTags: ["deity_chain_fragile"] } },
        },
      ],
    },

    pact_mid_oathbreaker: {
      chapter: "c4",
      title: "Pact Interlude: Broken Sigil",
      location: "Ruined Reliquary",
      mood: "exile liturgy",
      text: "Temple sigils reject your name at the threshold. The pact calls you in breach. Witnesses whisper that your final ruling can still stand, but only if it is paid for in exile and forfeiture.",
      options: [
        {
          id: "o1",
          text: "Burn your claim and deliver final judgment as an exile",
          stat: "spirit",
          baseDread: 10,
          success: { next: "ending_pact_oathbreaker", text: "You refuse both throne and absolution. The city remembers the verdict and forgets the judge.", effects: { renown: 1, faction: { religious: -1, rebels: 1 }, consequenceTags: ["deity_oathbreaker_exile"] } },
          fail: { next: "ending_iron", text: "The chamber chooses steel over witness. Your exile begins in blood.", effects: { health: 1, mentalStress: 1, consequenceTags: ["deity_oathbreaker_bloodprice"] } },
        },
      ],
    },

    ending_pact_lantern: {
      chapter: "c4",
      title: "Ending: Lantern Concord",
      location: "Epilogue",
      mood: "ritual democracy",
      text: "You turn pact favor into civic process. Every district keeps a lantern tribunal open at dusk. Justice is slower, louder, and harder to monopolize. Priests become clerks. Clerks become witnesses.",
      options: [
        { id: "o1", text: "Restart from Chapter 1 with lantern memory", success: { restart: true, text: "A new Wayfarer arrives where courts now open at dusk." } },
      ],
    },

    ending_pact_chain: {
      chapter: "c4",
      title: "Ending: Chain Ledger Regime",
      location: "Epilogue",
      mood: "cold extraction",
      text: "Debt becomes doctrine. Every favor is quantified, every pardon collateralized, every prayer invoiced. The city stays functional, profitable, and spiritually gutted. You remain in command as long as payments clear.",
      options: [
        { id: "o1", text: "Restart under the chain", success: { restart: true, text: "Another Wayfarer wakes into a city where mercy has an interest rate." } },
      ],
    },

    ending_pact_oathbreaker: {
      chapter: "c4",
      title: "Ending: Oathbreaker Frontier",
      location: "Epilogue",
      mood: "hard-won anonymity",
      text: "You keep the verdict and lose the institution. No temple names you. No ledger shelters you. Yet roads once owned by creditors begin operating on trust circles and witness pacts, outside formal rule.",
      options: [
        { id: "o1", text: "Restart as a nameless witness", success: { restart: true, text: "The next cycle begins without seals, only stories." } },
      ],
    },

    // ── DARK ENDINGS ──────────────────────────────────────────────────────────
    ending_dark_throne: {
      chapter: "c4",
      title: "Ending: The Pale Throne",
      location: "Epilogue",
      mood: "Cold-blooded sovereignty",
      text: "You took the seat and kept it. The city is quieter now. Efficient. People have stopped disappearing for speaking out — now they simply stop speaking. Voss Karr's portrait was replaced with yours. The ledgers do not lie. Neither do they forgive. Somewhere, the rebels are planning a second chapter.",
      options: [
        { id: "o_restart", text: "Restart as the heir of your own legacy", success: { restart: true, text: "The next Wayfarer is born into your shadow." } },
        { id: "o_rebel", text: "Defect from your own throne — spark the rebellion you put down", success: { next: "ending_glass", text: "You wrote the manifesto in the language only a ruler would know. It lands like a second revolution." } },
      ],
    },

    ending_time_tyrant: {
      chapter: "c4",
      title: "Ending: Time Tyrant",
      location: "Epilogue",
      mood: "looped empire",
      text: "You conquered the present, then authored the past. In every official ledger, your chosen name was always the first villain and the final ruler. The war you started became the law you enforce. People whisper that history itself now serves your court.",
      options: [
        { id: "o_restart", text: "Restart in the timeline you corrupted", success: { restart: true, text: "A new Wayfarer awakens in a world where your name is carved into origin myths." } },
        { id: "o_rebel", text: "Become the rebel against your own timeline", success: { next: "ending_glass", text: "You leak the truth: the villain was always you. The first uprising begins in the archives." } },
        { id: "o_falseflag", text: "Stage false-flag attacks to unify every faction under your command", req: { consequenceTagAny: ["tag:warfront_absolute_victory", "tag:timeline_legion_founded", "tag:authoritarian_warfront"] }, success: { next: "false_flag_unification", text: "You write the enemy first, then lead everyone against it." } },
        { id: "o_civil", text: "Your army fractures into civil war — choose a side", req: { consequenceTagAny: ["tag:warfront_momentum_lost", "tag:warfront_pyrrhic_assault", "tag:timeline_alias_leaked"] }, success: { next: "civil_war_split", text: "Your own banners turn on each other in nine districts." } },
        { id: "o_paranoia", text: "Purge your inner circle before they betray you", req: { consequenceTagAny: ["tag:warfront_throne_drift", "tag:timeline_corruption_seeded", "tag:lyra_martyred", "tag:mara_blackout"] }, success: { next: "paranoia_purge", text: "Victory curdles into suspicion. Trusted names become targets." } },
      ],
    },

    false_flag_unification: {
      chapter: "c4",
      title: "The Manufactured Enemy",
      location: "World That Was / War Cabinet",
      mood: "statecraft thriller",
      text: "You orchestrate precise strikes against rail depots, temples, and trade halls, then leak forged evidence that a phantom coalition is responsible. Fear does what diplomacy could not: old enemies ask to stand beneath your banner.",
      lessons: ["wtw", "skirmish", "combat"],
      options: [
        {
          id: "o1",
          text: "Execute Operation Hollow Banner",
          stat: "control",
          baseDread: 12,
          success: {
            next: "warfront_campaign",
            text: "The lie holds. Faction commanders unify under your emergency doctrine.",
            effects: {
              branchRewardTable: "false_flag",
              faction: { corporations: 1, military: 2, political: 1, rebels: -2 },
              activateWarfront: 14,
              flags: { falseFlagDoctrine: true },
              renown: 2,
              consequenceTags: ["falseflag_doctrine_enforced"]
            }
          },
          fail: {
            next: "civil_war_split",
            text: "The operation leaks. Half your coalition calls it treason. Civil war ignites instantly.",
            effects: { mentalStress: 2, tmw: 1, flags: { falseFlagExposed: true }, consequenceTags: ["falseflag_exposed", "coalition_fractured"] }
          },
        },
        {
          id: "o2",
          text: "Turn the forged war into a real constitutional federation",
          stat: "lead",
          baseDread: 12,
          success: { next: "ending_openhand", text: "You confess the fabrication publicly and convert panic into a binding federation charter.", effects: { branchRewardTable: "false_flag", renown: 3, faction: { political: 2, rebels: 1 }, consequenceTags: ["falseflag_confessed_republic"] } },
          fail: { next: "paranoia_purge", text: "The confession fails. Nobody trusts anybody. Your rule survives only through fear.", effects: { mentalStress: 2, consequenceTags: ["falseflag_confession_failed", "paranoia_spiral_seeded"] } },
        },
      ],
    },

    civil_war_split: {
      chapter: "c4",
      title: "The Army Breaks In Two",
      location: "World That Was / Nine Fronts",
      mood: "fratricide epic",
      text: "Your founding army divides between Iron Purists and District Reformists. Every rail station becomes a frontline parliament with guns. You can back order, back reform, or try to kill both command chains before the world burns.",
      lessons: ["wtw", "skirmish", "combat"],
      options: [
        {
          id: "o1",
          text: "Back the Iron Purists and crush the reform wing",
          combat: {
            title: "Story Combat: Purist Spearhead",
            dread: 14,
            enemies: ["Reform Marshal", "District Captain", "Rail Sapper", "Citizen Militia"],
            briefing: "Lead the purist offensive through contested stations to end the split by force."
          },
          success: { next: "ending_time_tyrant", text: "Order wins. History remains yours to dictate.", effects: { branchRewardTable: "civil_war", renown: 3, faction: { military: 2, rebels: -3 }, consequenceTags: ["civilwar_purist_victory"] } },
          fail: { next: "paranoia_purge", text: "Victory is messy and uncertain. You now trust no surviving commander.", effects: { health: 1, mentalStress: 2, consequenceTags: ["civilwar_purist_pyrrhic"] } },
        },
        {
          id: "o2",
          text: "Back the Reformists and dismantle your own war machine",
          combat: {
            title: "Story Combat: Reform Counteroffensive",
            dread: 13,
            enemies: ["Purist Warden", "Doctrine Captain", "Heavy Gunner"],
            briefing: "Break the old command spine so districts can elect their own officers."
          },
          success: { next: "ending_glass", text: "You win against your own doctrine and decentralize force across districts.", effects: { branchRewardTable: "civil_war", renown: 3, faction: { rebels: 2, political: 1 }, consequenceTags: ["civilwar_reform_victory"] } },
          fail: { next: "ending_iron", text: "Reform stalls in blood and the war ends under hard emergency law.", effects: { health: 2, mentalStress: 1, consequenceTags: ["civilwar_reform_stalled"] } },
        },
        {
          id: "o3",
          text: "Cut off both high commands and force local ceasefires",
          stat: "control",
          baseDread: 13,
          success: { next: "ending_openhand", text: "With both command towers dark, district councils negotiate their own armistice lines.", effects: { branchRewardTable: "civil_war", renown: 2, faction: { political: 2 }, consequenceTags: ["civilwar_local_armistice"] } },
          fail: { next: "paranoia_purge", text: "Command survives your sabotage. Every side assumes betrayal.", effects: { mentalStress: 2, tmw: 1, consequenceTags: ["civilwar_command_survives"] } },
        },
      ],
    },

    paranoia_purge: {
      chapter: "c4",
      title: "Purge Arc: Trusted No More",
      location: "Pale Citadel",
      mood: "court horror",
      text: "You start seeing plots everywhere. Lyra's silence feels tactical. Mara's pauses sound like code. Iosef's prayers look like encrypted warrants. You schedule a final tribunal where your most trusted allies stand accused.",
      options: [
        {
          id: "o1",
          text: "Run the tribunal and strike first",
          combat: {
            title: "Story Combat: Purge Tribunal",
            dread: 15,
            enemies: ["Sheriff Lyra Keene", "Mara Quill", "Brother Iosef"],
            briefing: "Your former allies become final bosses in a single chamber war."
          },
          success: {
            next: "ending_purge_crown",
            text: "You survive the purge. The throne is yours, but no trusted voice remains.",
            effects: {
              branchRewardTable: "purge",
              renown: 4,
              faction: { military: 2, rebels: -3, political: -2 },
              consequenceTags: ["purge_completed"]
            },
            irreversible: { killNpc: ["lyra", "mara", "iosef"], lockFlags: ["allySummit", "lyraArcLocked", "maraArcLocked"] }
          },
          fail: {
            next: "ending_dark_throne",
            text: "You win at ruinous cost. The purge succeeds, but your court is a graveyard.",
            effects: {
              branchRewardTable: "purge",
              health: 2,
              mentalStress: 3,
              consequenceTags: ["purge_ruinous_victory"]
            },
            irreversible: { killNpc: ["lyra", "mara"], lockFlags: ["allySummit", "lyraArcLocked", "maraArcLocked"] }
          },
        },
        {
          id: "o2",
          text: "Abort the purge and confess your paranoia",
          stat: "spirit",
          baseDread: 13,
          success: { next: "ending_openhand", text: "Confession breaks the spiral. Your allies drag you back from becoming the monster you feared.", effects: { renown: 2, faction: { political: 1, rebels: 1 }, consequenceTags: ["purge_aborted_confession"] } },
          fail: { next: "ending_iron", text: "You hesitate too late. The chamber still explodes into violence.", effects: { mentalStress: 2, health: 1, consequenceTags: ["purge_hesitation_blood"] } },
        },
      ],
    },

    ending_purge_crown: {
      chapter: "c4",
      title: "Ending: Crown of Ash",
      location: "Epilogue",
      mood: "lonely tyranny",
      text: "You defeated every betrayal by eliminating the possibility of trust. No allies, no rivals, no witnesses. The city is obedient, efficient, and spiritually dead. In the mirrored halls, only your footsteps remain to confirm that victory happened.",
      options: [
        { id: "o_restart", text: "Restart in the empire of fear", success: { restart: true, text: "Another Wayfarer wakes in a city where trust is illegal." } },
        { id: "o_rebel", text: "Leave one door unlocked and dare a rebellion", success: { next: "ending_glass", text: "A single unlocked archive begins the first honest uprising in years." } },
      ],
    },

    ending_pale_accord: {
      chapter: "c4",
      title: "Ending: The Pale Accord",
      location: "Epilogue",
      mood: "Dangerous coalition",
      text: "Two names now govern what one once consumed. The city has clean streets and quiet prisons. The greater threat you cited was real — or perhaps you made it real together. Either way, it keeps everyone else in line. You are not the villain. You are the architect of a world in which villains thrive, because they are useful. The question is whether there is a difference.",
      options: [
        { id: "o_restart", text: "Restart — a new Wayfarer enters the Accord's territory", success: { restart: true, text: "The pact still holds. Someone new arrives to break it — or sign it." } },
        { id: "o_shatter", text: "Shatter the Accord from within — expose Voss and take the consequences", success: { next: "ending_glass", text: "The Accord breaks in public, on your terms. It costs everything. It was worth it." } },
      ],
    },

    ending_ghost_king: {
      chapter: "c4",
      title: "Ending: The Ghost King",
      location: "Epilogue",
      mood: "Mythic vanishing act",
      text: "Sixty days. You ruled fairly, harshly, and with complete honesty about what you were doing. Then you left: no trail, no successor, no manifesto. They searched for three years. A statue was commissioned. Twice. Both were vandalized — once by rebels, once by former loyalists who couldn't bear the idol's expression. Somewhere out there, in a Province nobody maps, a figure who looks like you is helping people with small problems and never giving a name.",
      options: [
        { id: "o_restart", text: "Restart as the legend you left behind", success: { restart: true, text: "The Ghost King walks again, different face, same nerve." } },
      ],
    },

    ending_iron: {
      chapter: "c4",
      title: "Ending: Iron Mercy",
      location: "Epilogue",
      mood: "Tragic western",
      text: "You chose final steel. The world survives without a magistrate but learns to fear heroes as much as villains. Lyra rides at dawn. Mara leaves a poem in your holster.",
      options: [{ id: "o1", text: "Restart from Chapter 1 with carried reputation", success: { restart: true, text: "A new Wayfarer steps into old blood." } }],
    },

    ending_glass: {
      chapter: "c4",
      title: "Ending: Glass Republic",
      location: "Epilogue",
      mood: "Noir hope",
      text: "You chose witness over execution. Courts become public, brutal, and honest. The city aches toward something like justice.",
      options: [{ id: "o1", text: "Restart from Chapter 1 with carried reputation", success: { restart: true, text: "The next life inherits your echoes." } }],
    },

    ending_blacksun: {
      chapter: "c4",
      title: "Ending: Black Sun Covenant",
      location: "Epilogue",
      mood: "Weird myth",
      text: "You made law itself your weapon. Voss Karr lives under the weight of every verdict he issued. The world is stranger, freer, and less certain.",
      options: [{ id: "o1", text: "Restart from Chapter 1 with carried reputation", success: { restart: true, text: "Cycle again, different this time." } }],
    },

    ending_openhand: {
      chapter: "c4",
      title: "Ending: Open Hand Assembly",
      location: "Epilogue",
      mood: "Messy democratic sunrise",
      text: "You reject singular rule and spread authority across districts. Governance becomes louder, slower, and harder to corrupt in one stroke.",
      options: [{ id: "o1", text: "Restart from Chapter 1 with carried reputation", success: { restart: true, text: "The next cycle starts with more voices." } }],
    },
  };

  function getTheosProvinceCatalog() {
    if (typeof window.getTheosProvinceList !== "function") return [];
    try {
      return (window.getTheosProvinceList() || []).filter(function (province) {
        return province && province.id;
      });
    } catch (_err) {
      return [];
    }
  }

  function buildTheosProvinceScene(province) {
    const id = String((province && province.id) || "");
    if (!id) return null;
    const summary = (typeof window.getTheosProvinceSummary === "function") ? window.getTheosProvinceSummary(id) : null;
    const name = String((summary && summary.province && summary.province.name) || province.name || id);
    const threat = Number((summary && summary.province && summary.province.threat) || province.threat || 0);
    const chronicle = String((summary && summary.lore && summary.lore.chronicle) || "This province carries its own local archive and pressure points.");
    const places = Array.isArray(summary && summary.lore && summary.lore.places) ? summary.lore.places.slice(0, 3) : [];
    const fractures = Array.isArray(summary && summary.lore && summary.lore.fractures) ? summary.lore.fractures.slice(0, 2) : [];
    const dreads = threat >= 6 ? 10 : threat >= 4 ? 8 : 6;
    const leadText = places.length ? places.join(", ") : name + " routes";
    const factionHint = (summary && summary.power) ? String(summary.power) : "local powers";
    const sceneId = "theos_province_" + id;

    return {
      id: sceneId,
      chapter: "c1",
      title: name + ": Regional Contact",
      location: name,
      mood: "Province intrigue and local leverage",
      text: name + " unfolds as a pressure point in the wider Theos archive. " + chronicle + " Local power currently bends toward " + factionHint + ", and the marked hexes around " + leadText + " can reveal who is hiding the larger route.",
      sceneTypes: ["social", "exploration"],
      options: [
        {
          id: "o1",
          text: "Talk to the local contact and press the provincial lead",
          req: { theosProvinceIs: id },
          stat: threat >= 5 ? "mind" : "lead",
          baseDread: dreads,
          success: {
            next: "mission_bridge",
            text: "The local contact opens the next layer of the archive. The lead can now be folded back into mission work.",
            effects: { renown: 1, flags: { ["theosProvince" + id + "Lead"]: true } },
          },
          fail: {
            next: "mission_bridge",
            text: "The contact shuts down, but the province is now mapped well enough to pursue later.",
            effects: { tmw: 1, flags: { ["theosProvince" + id + "Lead"]: true } },
          },
        },
        {
          id: "o2",
          text: "Search the province marker and recover hard evidence",
          req: { theosProvinceIs: id },
          stat: "valor",
          baseDread: Math.max(6, dreads - 1),
          success: {
            next: "mission_bridge",
            text: "You recover the province marker and enough evidence to justify the route.",
            effects: { flags: { ["theosProvince" + id + "Marker"]: true }, renown: 1 },
          },
          fail: {
            next: "mission_bridge",
            text: "The marker resists easy pickup, but the route is still flagged for later pursuit.",
            effects: { mentalStress: 1, flags: { ["theosProvince" + id + "Marker"]: true } },
          },
        },
        {
          id: "o3",
          text: "Return to the atlas and choose another province",
          jump: { tab: "theos" },
          success: { next: "theos_atlas_brief", text: "You reset the atlas overlays and choose the next province lead." },
        },
      ],
    };
  }

  function buildTheosAtlasBriefScene() {
    const catalog = getTheosProvinceCatalog();
    const options = catalog.map(function (province) {
      const summary = (typeof window.getTheosProvinceSummary === "function") ? window.getTheosProvinceSummary(province.id) : null;
      const name = String((summary && summary.province && summary.province.name) || province.name || province.id);
      const threat = Number((summary && summary.province && summary.province.threat) || province.threat || 0);
      const moveText = threat >= 6 ? "High-pressure lead" : threat >= 4 ? "Active lead" : "Open lead";
      return {
        id: "province-" + province.id,
        text: name + " - " + moveText,
        jump: {
          storySystem: "province",
          tab: "map",
          context: "traveling",
          theosProvinceId: province.id,
          hexFlavorKinds: ["notable", "fracture", "settlement", "scar", "quest", "dungeon"],
          markerTitle: name + " Marker",
        },
        success: {
          next: "theos_province_" + province.id,
          text: "The atlas pins " + name + " as the active lead. Travel there to resolve the province-specific contact.",
          effects: { flags: { ["theosProvince" + province.id + "Selected"]: true } },
        },
      };
    });

    return {
      id: "theos_atlas_brief",
      chapter: "c1",
      title: "Atlas Nodes of Conspiracy",
      location: "Theos Atlas",
      mood: "Investigative travel noir",
      text: "Lyra traces the sigil's stroke weight over a painted atlas while an atlas warden named Maelik leans in. 'The archive spans more than one province. Pick any lead on the board and we can route the evidence through the local power structure.'",
      sceneTypes: ["exploration", "social"],
      options: options.length ? options : [{ id: "o1", text: "Atlas unavailable", success: { next: "mission_bridge", text: "No Theos province list is available yet." } }],
    };
  }

  function ensureTheosProvinceScenes() {
    const atlasScene = buildTheosAtlasBriefScene();
    if (atlasScene) SCENES.theos_atlas_brief = atlasScene;
    const catalog = getTheosProvinceCatalog();
    catalog.forEach(function (province) {
      const scene = buildTheosProvinceScene(province);
      if (scene) SCENES[scene.id] = scene;
    });
  }

  function lc(value) {
    return String(value || "").trim().toLowerCase();
  }

  function ensureStoryState() {
    if (typeof S === "undefined") return null;
    if (typeof ensureTheosProvinceScenes === "function") ensureTheosProvinceScenes();
    S.storyline = S.storyline || {};
    const st = S.storyline;
    if (!st.sceneId || !SCENES[st.sceneId]) st.sceneId = "intro";
    if (!st.chapter) st.chapter = "c1";
    if (!st.flags || typeof st.flags !== "object") st.flags = {};
    if (!st.npc || typeof st.npc !== "object") st.npc = { lyra: 0, mara: 0, iosef: 0 };
    if (!st.optionDread || typeof st.optionDread !== "object") st.optionDread = {};
    if (!Array.isArray(st.log)) st.log = [];
    if (!Array.isArray(st.usedStats)) st.usedStats = [];
    if (!Array.isArray(st.completedSystems)) st.completedSystems = [];
    if (!st.seedTag) st.seedTag = "W-" + Math.floor(Math.random() * 9000 + 1000);
    if (!st.lastResult) st.lastResult = "";
    if (!st.history || typeof st.history !== "object") st.history = { sceneVisits: {}, optionsTaken: {} };
    if (!st.history.sceneVisits || typeof st.history.sceneVisits !== "object") st.history.sceneVisits = {};
    if (!st.history.optionsTaken || typeof st.history.optionsTaken !== "object") st.history.optionsTaken = {};
    if (!st.lexicon || typeof st.lexicon !== "object") st.lexicon = {};
    if (!Array.isArray(st.dialogueMemory)) st.dialogueMemory = [];
    if (!st.pendingTravel || typeof st.pendingTravel !== "object") st.pendingTravel = null;
    if (!st.pendingCombat || typeof st.pendingCombat !== "object") st.pendingCombat = null;
    if (!st.optionAssignments || typeof st.optionAssignments !== "object") st.optionAssignments = {};
    if (!Array.isArray(st.decisionAssignments)) st.decisionAssignments = [];
    if (!st.storyMemory || typeof st.storyMemory !== "object") {
      st.storyMemory = {
        recent: [],
        tags: {},
        sceneTypeCounts: {},
      };
    }
    if (!Array.isArray(st.storyMemory.recent)) st.storyMemory.recent = [];
    if (!st.storyMemory.tags || typeof st.storyMemory.tags !== "object") st.storyMemory.tags = {};
    if (!st.storyMemory.sceneTypeCounts || typeof st.storyMemory.sceneTypeCounts !== "object") st.storyMemory.sceneTypeCounts = {};
    if (!Array.isArray(st.unlockedCampaignModifiers)) st.unlockedCampaignModifiers = [];
    if (!st.permanentModifiers || typeof st.permanentModifiers !== "object") st.permanentModifiers = {};
    if (!st.travelMarkers || typeof st.travelMarkers !== "object") {
      st.travelMarkers = {
        provinceKey: "",
        lastSeaKey: "",
        galaxyHexId: null,
        worldHexId: "",
        planetHexId: null,
        planetCellId: null,
      };
    }
    return st;
  }

  function getStoryPermanentModifiers() {
    const st = ensureStoryState();
    if (!st) return {};
    if (st.permanentModifiers && Object.keys(st.permanentModifiers).length) return st.permanentModifiers;

    const totals = {};
    const unlocked = Array.isArray(st.unlockedCampaignModifiers) ? st.unlockedCampaignModifiers : [];
    unlocked.forEach(function (id) {
      const table = BRANCH_REWARD_TABLES[id];
      if (!table || !table.modifiers || typeof table.modifiers !== "object") return;
      Object.keys(table.modifiers).forEach(function (key) {
        const value = Number(table.modifiers[key] || 0);
        if (!Number.isFinite(value) || value === 0) return;
        totals[key] = Number(totals[key] || 0) + value;
      });
    });

    st.permanentModifiers = totals;
    return totals;
  }

  function getStoryModifierValue(key) {
    if (!key) return 0;
    const mods = getStoryPermanentModifiers();
    return Number((mods && mods[key]) || 0);
  }

  function grantBranchRewardTable(tableId) {
    const id = String(tableId || "").trim().toLowerCase();
    if (!id) return;

    const table = BRANCH_REWARD_TABLES[id];
    if (!table) return;

    const st = ensureStoryState();
    if (!st) return;
    if (!Array.isArray(st.unlockedCampaignModifiers)) st.unlockedCampaignModifiers = [];

    if (table.once !== false && st.unlockedCampaignModifiers.indexOf(id) >= 0) {
      return;
    }

    st.unlockedCampaignModifiers.push(id);
    st.permanentModifiers = {};

    const rewards = table.rewards || {};
    applyEffects(rewards);

    getStoryPermanentModifiers();

    if (typeof showNotif === "function") {
      showNotif("Campaign doctrine unlocked: " + (table.label || id) + ".", "good");
    }

    pushLog("Modifier unlocked: " + (table.label || id) + (table.note ? " - " + table.note : ""));
  }

  function escHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function assignmentKey(sceneId, optionId) {
    return String(sceneId || "") + ":" + String(optionId || "");
  }

  function getPartyAssignmentPool() {
    var pool = [];
    var localName = String((typeof S !== "undefined" && S && (S.name || S.characterName)) || "Wayfarer").trim() || "Wayfarer";
    pool.push({ id: "local:self", name: localName, role: "player", online: true });

    if (window.campaignSystem && typeof window.campaignSystem.getState === "function") {
      var cState = window.campaignSystem.getState();
      var roster = cState && cState.campaign && Array.isArray(cState.campaign.roster) ? cState.campaign.roster : [];
      roster.forEach(function (member) {
        if (!member) return;
        var token = String(member.token || "").trim();
        if (!token) return;
        pool.push({
          id: "campaign:" + token,
          name: String((member.character && member.character.name) || member.name || "Wayfarer"),
          role: member.role || "player",
          online: !!member.online,
        });
      });
    }

    var seen = {};
    return pool.filter(function (entry) {
      if (!entry || !entry.id) return false;
      if (seen[entry.id]) return false;
      seen[entry.id] = true;
      return true;
    });
  }

  function getDecisionAssignment(sceneId, optionId) {
    var st = ensureStoryState();
    if (!st) return { assigneeId: "local:self", assigneeName: "Wayfarer", role: "Lead Check" };
    var key = assignmentKey(sceneId, optionId);
    var existing = st.optionAssignments[key] && typeof st.optionAssignments[key] === "object"
      ? st.optionAssignments[key]
      : null;
    var pool = getPartyAssignmentPool();
    var fallback = pool[0] || { id: "local:self", name: "Wayfarer", role: "player", online: true };
    if (!existing) {
      return { assigneeId: fallback.id, assigneeName: fallback.name, role: "Lead Check" };
    }
    var picked = pool.find(function (entry) { return entry.id === existing.assigneeId; }) || fallback;
    return {
      assigneeId: picked.id,
      assigneeName: picked.name,
      role: DECISION_ROLES.indexOf(String(existing.role || "")) >= 0 ? String(existing.role) : "Lead Check",
    };
  }

  function setDecisionAssignment(sceneId, optionId, patch) {
    var st = ensureStoryState();
    if (!st) return;
    var key = assignmentKey(sceneId, optionId);
    var current = getDecisionAssignment(sceneId, optionId);
    st.optionAssignments[key] = {
      assigneeId: patch && patch.assigneeId ? String(patch.assigneeId) : current.assigneeId,
      assigneeName: patch && patch.assigneeName ? String(patch.assigneeName) : current.assigneeName,
      role: patch && patch.role ? String(patch.role) : current.role,
    };
  }

  function getAssignedWayfarerActionDie(statKey, decisionMeta) {
    var key = String(statKey || 'valor').toLowerCase();
    var localDie = (typeof getEffectiveDie === 'function')
      ? Number(getEffectiveDie(key) || 4)
      : Number((S && S.stats && S.stats[key]) || 4);
    if (!decisionMeta || !decisionMeta.assigneeId || String(decisionMeta.assigneeId).indexOf('campaign:') !== 0) {
      return Math.max(4, localDie || 4);
    }

    var token = String(decisionMeta.assigneeId).split(':')[1] || '';
    var roster = [];
    if (window.campaignSystem && typeof window.campaignSystem.getState === 'function') {
      var cState = window.campaignSystem.getState();
      roster = cState && cState.campaign && Array.isArray(cState.campaign.roster) ? cState.campaign.roster : [];
    }
    var member = roster.find(function (entry) {
      return String((entry && entry.token) || '') === token;
    });
    var remoteStats = member && member.character && member.character.stats ? member.character.stats : null;
    if (!remoteStats || typeof remoteStats !== 'object') return Math.max(4, localDie || 4);
    var remoteDie = Number(remoteStats[key]);
    if (!(remoteDie > 0)) return Math.max(4, localDie || 4);
    return Math.max(4, remoteDie);
  }

  function storySetAssignee(sceneId, optionId, assigneeId) {
    var pool = getPartyAssignmentPool();
    var picked = pool.find(function (entry) { return entry.id === String(assigneeId || ""); }) || pool[0];
    if (!picked) return;
    setDecisionAssignment(sceneId, optionId, {
      assigneeId: picked.id,
      assigneeName: picked.name,
    });
    renderStorylinePanel();
  }

  function storySetDecisionRole(sceneId, optionId, roleName) {
    var role = DECISION_ROLES.indexOf(String(roleName || "")) >= 0 ? String(roleName) : "Lead Check";
    setDecisionAssignment(sceneId, optionId, { role: role });
    renderStorylinePanel();
  }

  function randomPick(list) {
    if (!Array.isArray(list) || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)] || null;
  }

  function storySystemFromJump(jump) {
    const explicitSystem = jump && jump.storySystem ? lc(jump.storySystem) : "";
    const tab = jump && jump.tab ? lc(jump.tab) : "";
    const ctx = jump && jump.context ? lc(jump.context) : "";
    if (explicitSystem) return explicitSystem;
    if (tab === "map" || ctx === "traveling") return "province";
    if (tab === "missions") return "province";
    if (tab === "lastsea" || ctx === "lastsea") return "lastsea";
    if (tab === "naval") return "lastsea";
    if (tab === "galaxy") return "galaxy";
    if (tab === "worldthatwas") return "wtw";
    if (tab === "planet") return "planet";
    return "";
  }

  function clearStoryTravelMarkers() {
    const st = ensureStoryState();
    if (!st || !st.travelMarkers) return;

    if (st.travelMarkers.provinceKey && S && S.missionTokens) {
      const t = S.missionTokens[st.travelMarkers.provinceKey];
      if (t && t.missionId === "storyline") delete S.missionTokens[st.travelMarkers.provinceKey];
    }
    if (st.travelMarkers.lastSeaKey && S && S.lastSea && S.lastSea.missionTokens) {
      const t = S.lastSea.missionTokens[st.travelMarkers.lastSeaKey];
      if (t && t.missionId === "storyline") delete S.lastSea.missionTokens[st.travelMarkers.lastSeaKey];
    }
    if (S && S.worldThatWas && st.travelMarkers.worldHexId) {
      S.worldThatWas.storyObjectiveHexId = null;
      if (typeof window.wtwSyncMarkers === "function") window.wtwSyncMarkers();
    }
    if (S && S.starSystem && st.travelMarkers.planetHexId != null) {
      const pState = S.starSystem.planetExplorationByHex && S.starSystem.planetExplorationByHex[String(st.travelMarkers.planetHexId)];
      if (pState) pState.storyObjectiveCellId = null;
    }

    st.travelMarkers.provinceKey = "";
    st.travelMarkers.lastSeaKey = "";
    st.travelMarkers.galaxyHexId = null;
    st.travelMarkers.worldHexId = "";
    st.travelMarkers.planetHexId = null;
    st.travelMarkers.planetCellId = null;
  }

  function buildStoryCombat(option) {
    if (!option || !option.combat) return null;
    const spec = option.combat;
    const enemyNames = Array.isArray(spec.enemies) && spec.enemies.length
      ? spec.enemies.slice()
      : [String(spec.enemyName || option.text || "Story Enemy")];
    const dreadDelta = Math.floor(getStoryModifierValue("dreadDifficultyDelta"));
    return {
      title: String(spec.title || option.text || "Story Combat"),
      dread: Math.max(4, Number(spec.dread || 8) + dreadDelta),
      enemyNames: enemyNames,
      briefing: String(spec.briefing || "Fight through the encounter, then return to Storyline to resolve the branch."),
    };
  }

  function seedStoryCombatMap(encounter) {
    if (!S || !S.combatMap || !Array.isArray(S.combatMap.units)) return;
    S.combatMap.units = S.combatMap.units.filter(function (unit) {
      return unit && unit.side === "ally";
    });
    encounter.enemyNames.forEach(function (name, idx) {
      S.combatMap.units.push({
        id: Date.now() + idx,
        name: name,
        side: "enemy",
        zone: idx === 0 ? "Engaged" : (idx === 1 ? "Nearby" : "Close")
      });
    });
    if (typeof renderCombatMap === "function") renderCombatMap();
  }

  function clearStoryCombatState() {
    const st = ensureStoryState();
    if (typeof clearEnemies === "function") clearEnemies();
    else if (S) S.enemies = [];
    if (S && S.combatMap && Array.isArray(S.combatMap.units)) {
      S.combatMap.units = S.combatMap.units.filter(function (unit) {
        return unit && unit.side === "ally";
      });
      if (typeof renderCombatMap === "function") renderCombatMap();
    }
    if (st) st.pendingCombat = null;
  }

  function getStoryCombatResult(pending) {
    if (!pending) return "";
    if (Array.isArray(S.enemies) && !S.enemies.length) return "success";
    if (S && S.combat && S.combat.active === false && Array.isArray(S.enemies) && S.enemies.length) return "fail";
    return "";
  }

  function openStoryCombatModal(encounter) {
    if (typeof openModal !== "function") return;
    const html = ""
      + "<div style='font-size:.9rem;color:var(--gold2);font-family:Cinzel,serif;margin-bottom:.5rem;'>Combat Objective Started</div>"
      + "<div style='font-size:.83rem;color:var(--text2);line-height:1.65;margin-bottom:.55rem;'>"
      + encounter.briefing
      + "</div>"
      + "<div style='font-size:.8rem;color:var(--muted2);border:1px solid rgba(224,80,80,.25);background:rgba(224,80,80,.06);padding:.35rem .5rem;margin-bottom:.55rem;'>"
      + "Enemies: <strong style='color:#ff8a72;'>" + encounter.enemyNames.join(", ") + "</strong><br>"
      + "Threat: <strong style='color:var(--gold2);'>DD" + encounter.dread + "</strong><br>"
      + "Win by clearing the enemy list. If you end the combat scene while enemies remain, the branch resolves as a setback."
      + "</div>"
      + "<div style='text-align:right;margin-top:.6rem;'>"
      + "<button class='btn btn-sm btn-red' onclick='closeModal()'>Go To Combat</button>"
      + "</div>";
    openModal("Storyline: Combat Required", html);
  }

  function openStoryCombatReminderModal(pending) {
    if (typeof openModal !== "function") return;
    const html = ""
      + "<div style='font-size:.9rem;color:#ff8a72;font-family:Cinzel,serif;margin-bottom:.5rem;'>Combat Still Active</div>"
      + "<div style='font-size:.83rem;color:var(--text2);line-height:1.65;margin-bottom:.45rem;'>"
      + "Your storyline combat is still unresolved against <strong style='color:var(--gold2);'>" + (pending.enemyNames || []).join(", ") + "</strong>."
      + "</div>"
      + "<div style='font-size:.78rem;color:var(--muted2);'>Clear the enemy list for success, or end the combat scene with enemies remaining to take the fail branch. Then return here and choose the option again.</div>"
      + "<div style='text-align:right;margin-top:.6rem;'>"
      + "<button class='btn btn-sm' onclick='closeModal()'>Back</button>"
      + "</div>";
    openModal("Storyline: Combat Objective Active", html);
  }

  function startStoryCombat(sceneId, option) {
    const st = ensureStoryState();
    const encounter = buildStoryCombat(option);
    if (!st || !encounter) return false;

    clearStoryCombatState();
    st.pendingCombat = {
      sceneId: sceneId,
      optionId: option.id,
      title: encounter.title,
      dread: encounter.dread,
      enemyNames: encounter.enemyNames.slice(),
      briefing: encounter.briefing,
    };

    if (typeof setEnemyDread === "function") setEnemyDread(encounter.dread);
    else {
      S.combat = S.combat || {};
      S.combat.enemyDread = encounter.dread;
    }

    if (typeof clearEnemies === "function") clearEnemies();
    else S.enemies = [];

    encounter.enemyNames.forEach(function (name) {
      if (typeof addEnemy === "function") addEnemy(name, encounter.dread);
      else {
        S.enemies = Array.isArray(S.enemies) ? S.enemies : [];
        S.enemies.push({ id: Date.now() + S.enemies.length, name: name, dread: encounter.dread, stress: 0, maxStress: encounter.dread * 2, health: 0, conditions: [] });
      }
    });

    seedStoryCombatMap(encounter);

    if (typeof startCombat === "function") startCombat();
    const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('combat'\"]");
    if (typeof switchTab === "function") switchTab("combat", btn || null);
    openStoryCombatModal(encounter);
    return true;
  }

  function setStoryTravelObjective(sceneId, option) {
    const st = ensureStoryState();
    if (!st || !option || !option.jump) return null;
    clearStoryTravelMarkers();

    const system = storySystemFromJump(option.jump);
    if (!system) return null;

    if (system === "province") {
      if (typeof mapData === "undefined" || !Array.isArray(mapData) || !mapData.length) return null;
      const jumpSpec = option.jump || {};
      const provinceFilter = lc(jumpSpec.theosProvinceId || "");
      const markerKinds = Array.isArray(jumpSpec.hexFlavorKinds)
        ? jumpSpec.hexFlavorKinds.map(function (k) { return lc(k); }).filter(Boolean)
        : [];
      const markerTitle = String(jumpSpec.markerTitle || "Story Objective");
      let candidates = mapData.slice();
      if (provinceFilter) {
        const byProvince = mapData.filter(function (hex) {
          return lc(hex && hex.data && hex.data.provinceTag) === provinceFilter;
        });
        if (byProvince.length) candidates = byProvince;
      }
      if (markerKinds.length) {
        const byFlavor = candidates.filter(function (hex) {
          const kind = lc(hex && hex.data && hex.data.theosFlavor && hex.data.theosFlavor.kind);
          return markerKinds.indexOf(kind) >= 0;
        });
        if (byFlavor.length) candidates = byFlavor;
      }
      const target = randomPick(candidates);
      if (!target) return null;
      S.missionTokens = S.missionTokens || {};
      const key = target.col + "," + target.row;
      S.missionTokens[key] = {
        missionId: "storyline",
        title: markerTitle,
        type: "story_choice",
        sceneId: sceneId,
        optionId: option.id,
        provinceTag: String((target && target.data && target.data.provinceTag) || ""),
        flavorKind: String((target && target.data && target.data.theosFlavor && target.data.theosFlavor.kind) || ""),
      };
      st.travelMarkers.provinceKey = key;
      if (typeof renderHexMap === "function") renderHexMap();
      const provinceTag = lc(target && target.data && target.data.provinceTag);
      const flavorLabel = String((target && target.data && target.data.theosFlavor && target.data.theosFlavor.label) || "").trim();
      const labelBits = [markerTitle + " [" + (target.col + 1) + "," + (target.row + 1) + "]"];
      if (provinceTag) labelBits.push(provinceTag.charAt(0).toUpperCase() + provinceTag.slice(1));
      if (flavorLabel) labelBits.push(flavorLabel);
      return { system: system, targetValue: key, label: labelBits.join(" · ") };
    }

    if (system === "lastsea") {
      if (!S.lastSea || !Array.isArray(S.lastSea.map) || !S.lastSea.map.length) return null;
      const target = randomPick(S.lastSea.map);
      if (!target) return null;
      S.lastSea.missionTokens = S.lastSea.missionTokens || {};
      S.lastSea.missionTokens[target.key] = {
        missionId: "storyline",
        title: "Story Route",
        type: "story",
        sceneId: sceneId,
        optionId: option.id,
      };
      st.travelMarkers.lastSeaKey = target.key;
      if (typeof renderLastSeaMap === "function") renderLastSeaMap();
      return { system: system, targetValue: target.key, label: "Sea Hex " + target.key };
    }

    if (system === "galaxy") {
      if (!S.starSystem || !Array.isArray(S.starSystem.hexes) || !S.starSystem.hexes.length) return null;
      const candidates = S.starSystem.hexes.filter(function (h) { return h.type !== "star"; });
      const target = randomPick(candidates.length ? candidates : S.starSystem.hexes);
      if (!target) return null;
      st.travelMarkers.galaxyHexId = Number(target.id);
      if (typeof renderStarSystemMap === "function") renderStarSystemMap();
      return { system: system, targetValue: Number(target.id), label: "Galaxy Hex #" + target.id };
    }

    if (system === "wtw") {
      if (!S.worldThatWas || !Array.isArray(S.worldThatWas.hexes) || !S.worldThatWas.hexes.length) return null;
      const target = randomPick(S.worldThatWas.hexes);
      if (!target) return null;
      S.worldThatWas.storyObjectiveHexId = target.id;
      st.travelMarkers.worldHexId = target.id;
      if (typeof window.wtwSyncMarkers === "function") window.wtwSyncMarkers();
      return { system: system, targetValue: target.id, label: "World District " + target.id };
    }

    if (system === "planet") {
      if (!S.starSystem || !S.starSystem.planetExplorationByHex || typeof S.starSystem.planetExplorationByHex !== "object") return null;
      const keys = Object.keys(S.starSystem.planetExplorationByHex || {});
      if (!keys.length) return null;
      const pickedHexKey = S.starSystem.activePlanetHexId != null && S.starSystem.planetExplorationByHex[String(S.starSystem.activePlanetHexId)]
        ? String(S.starSystem.activePlanetHexId)
        : keys[0];
      const state = S.starSystem.planetExplorationByHex[pickedHexKey];
      if (!state || !Array.isArray(state.cells) || !state.cells.length) return null;
      const cell = randomPick(state.cells);
      if (!cell) return null;
      state.storyObjectiveCellId = cell.id;
      st.travelMarkers.planetHexId = Number(pickedHexKey);
      st.travelMarkers.planetCellId = Number(cell.id);
      if (typeof renderPlanetExplorationPanel === "function") renderPlanetExplorationPanel();
      return { system: system, targetValue: Number(cell.id), label: "Planet Hex #" + cell.id };
    }

    return null;
  }

  function isStoryObjectiveReached(pending) {
    if (!pending || !pending.system) return false;
    if (pending.system === "province") {
      if (typeof selectedHex === "undefined" || !selectedHex) return false;
      return (selectedHex.col + "," + selectedHex.row) === String(pending.targetValue || "");
    }
    if (pending.system === "lastsea") {
      return !!(S.lastSea && S.lastSea.selectedKey && String(S.lastSea.selectedKey) === String(pending.targetValue || ""));
    }
    if (pending.system === "galaxy") {
      return !!(S.starSystem && Number(S.starSystem.currentHexId) === Number(pending.targetValue));
    }
    if (pending.system === "wtw") {
      return !!(S.worldThatWas && String(S.worldThatWas.selectedHexId || "") === String(pending.targetValue || ""));
    }
    if (pending.system === "planet") {
      if (!S.starSystem || !S.starSystem.planetExplorationByHex) return false;
      const planetHexId = pending.planetHexId != null ? pending.planetHexId : (S.starSystem.activePlanetHexId != null ? S.starSystem.activePlanetHexId : null);
      if (planetHexId == null) return false;
      const state = S.starSystem.planetExplorationByHex[String(planetHexId)];
      return !!(state && Number(state.selectedCellId) === Number(pending.targetValue));
    }
    return false;
  }

  function addDialogueMemory(speaker, line) {
    const st = ensureStoryState();
    if (!st) return;
    const s = String(speaker || "Unknown").trim();
    const l = String(line || "").trim();
    if (!l) return;
    const key = (s + "|" + l).toLowerCase();
    const exists = st.dialogueMemory.some(function (entry) {
      return ((entry.speaker || "") + "|" + (entry.line || "")).toLowerCase() === key;
    });
    if (exists) return;
    st.dialogueMemory.unshift({ speaker: s, line: l });
    st.dialogueMemory = st.dialogueMemory.slice(0, 10);
  }

  function hasRememberedQuote(fragment) {
    const st = ensureStoryState();
    if (!st) return false;
    const needle = lc(fragment);
    return (st.dialogueMemory || []).some(function (entry) {
      return lc(entry.line).indexOf(needle) >= 0 || lc(entry.speaker).indexOf(needle) >= 0;
    });
  }

  function normalizedLoadoutText() {
    const bits = [];
    if (Array.isArray(S.backpack)) {
      S.backpack.forEach(function (item) {
        if (item) bits.push(lc(item));
      });
    }
    if (S && S.equipment && typeof S.equipment === "object") {
      ["weapon1", "weapon2", "armor", "readied"].forEach(function (k) {
        if (S.equipment[k]) bits.push(lc(S.equipment[k]));
      });
    }
    return bits.join(" | ");
  }

  function hasAnyInList(values, terms) {
    if (!Array.isArray(values) || !values.length || !Array.isArray(terms) || !terms.length) return false;
    const pool = values.map(function (v) { return lc(v); });
    return terms.some(function (term) {
      const t = lc(term);
      return pool.some(function (entry) { return entry.indexOf(t) >= 0; });
    });
  }

  function normalizeSceneType(typeName) {
    const t = lc(typeName);
    if (t === "combat" || t === "exploration" || t === "investigation" || t === "social") return t;
    return "";
  }

  function inferOptionSceneType(option) {
    if (!option || typeof option !== "object") return "social";
    const explicit = normalizeSceneType(option.sceneType);
    if (explicit) return explicit;
    if (option.combat) return "combat";
    if (option.puzzle) return "investigation";
    if (option.jump) return "exploration";
    const stat = lc(option.stat);
    if (stat === "lead" || stat === "spirit") return "social";
    if (stat === "mind" || stat === "control") return "investigation";
    if (stat === "valor" || stat === "defend" || stat === "strike" || stat === "shoot" || stat === "body") return "combat";
    return "social";
  }

  function inferSceneTypes(scene) {
    if (!scene || typeof scene !== "object") return ["social"];
    const explicit = Array.isArray(scene.sceneTypes)
      ? scene.sceneTypes.map(normalizeSceneType).filter(Boolean)
      : [];
    if (explicit.length) return Array.from(new Set(explicit));
    const options = Array.isArray(scene.options) ? scene.options : [];
    const inferred = options.map(inferOptionSceneType).filter(Boolean);
    return Array.from(new Set(inferred.length ? inferred : ["social"]));
  }

  function primarySceneType(scene) {
    const explicit = normalizeSceneType(scene && scene.primarySceneType);
    if (explicit) return explicit;
    const types = inferSceneTypes(scene);
    if (types.indexOf("combat") >= 0) return "combat";
    if (types.indexOf("investigation") >= 0) return "investigation";
    if (types.indexOf("exploration") >= 0) return "exploration";
    return types[0] || "social";
  }

  function incrementSceneTypeMemory(typeName) {
    const st = ensureStoryState();
    if (!st) return;
    const t = normalizeSceneType(typeName) || "social";
    st.storyMemory.sceneTypeCounts[t] = Number(st.storyMemory.sceneTypeCounts[t] || 0) + 1;
  }

  function collectOutcomeTags(option, safeOutcome) {
    const tags = [];
    const baseType = inferOptionSceneType(option);
    if (baseType) tags.push("scene:" + baseType);
    if (option && option.combat) tags.push("stakes:violent");
    if (option && option.puzzle) tags.push("stakes:mystery");

    const eff = safeOutcome && safeOutcome.effects && typeof safeOutcome.effects === "object"
      ? safeOutcome.effects
      : null;
    if (eff) {
      if (eff.renown > 0) tags.push("impact:renown_up");
      if (eff.mentalStress > 0) tags.push("impact:stress_up");
      if (eff.health > 0) tags.push("impact:injury");
      if (eff.faction && typeof eff.faction === "object") {
        Object.keys(eff.faction).forEach(function (k) {
          const delta = Number(eff.faction[k] || 0);
          if (delta > 0) tags.push("faction+" + String(k));
          if (delta < 0) tags.push("faction-" + String(k));
        });
      }
      if (eff.flags && typeof eff.flags === "object") {
        Object.keys(eff.flags).forEach(function (k) {
          if (eff.flags[k]) tags.push("flag:" + String(k));
        });
      }
      if (Array.isArray(eff.consequenceTags)) {
        eff.consequenceTags.forEach(function (tag) {
          const t = lc(tag);
          if (t) tags.push("tag:" + t);
        });
      }
    }

    if (safeOutcome && safeOutcome.irreversible && Array.isArray(safeOutcome.irreversible.killNpc) && safeOutcome.irreversible.killNpc.length) {
      tags.push("stakes:irreversible");
      safeOutcome.irreversible.killNpc.forEach(function (npc) {
        tags.push("npc-lost:" + lc(npc));
      });
    }

    return Array.from(new Set(tags.filter(Boolean)));
  }

  function rememberStoryConsequence(sceneId, scene, option, safeOutcome, checkResult) {
    const st = ensureStoryState();
    if (!st) return;

    const sceneType = inferOptionSceneType(option);
    incrementSceneTypeMemory(sceneType);

    const tags = collectOutcomeTags(option, safeOutcome);
    tags.forEach(function (tag) {
      st.storyMemory.tags[tag] = Number(st.storyMemory.tags[tag] || 0) + 1;
    });

    const note = {
      at: Date.now(),
      sceneId: String(sceneId || ""),
      sceneTitle: String((scene && scene.title) || sceneId || "Scene"),
      optionText: String((option && option.text) || "Decision"),
      sceneType: sceneType,
      outcomeText: String((safeOutcome && safeOutcome.text) || "Outcome recorded."),
      tags: tags.slice(0, 6),
      roll: checkResult
        ? {
            success: !!checkResult.success,
            effectiveTotal: Number(checkResult.effectiveTotal || checkResult.action && checkResult.action.total || 0),
            dreadTotal: Number(checkResult.dread && checkResult.dread.total || 0),
          }
        : null,
    };

    st.storyMemory.recent.unshift(note);
    st.storyMemory.recent = st.storyMemory.recent.slice(0, 20);
  }

  function consumeBackpackAny(terms) {
    if (!Array.isArray(terms) || !terms.length || !Array.isArray(S.backpack)) return "";
    var idx = -1;
    var picked = "";
    S.backpack.some(function (entry, i) {
      var text = lc(entry || "");
      var ok = terms.some(function (term) { return text.indexOf(lc(term)) >= 0; });
      if (!ok) return false;
      idx = i;
      picked = String(entry || "");
      return true;
    });
    if (idx < 0) return "";
    if (typeof removeBackpackItem === "function") removeBackpackItem(idx);
    else S.backpack.splice(idx, 1);
    return picked;
  }

  function chapterFallbackScene(sceneId) {
    const scene = SCENES[sceneId] || {};
    const fallbackByChapter = {
      c1: "mission_bridge",
      c2: "sea_court",
      c3: "planet_descent",
      c4: "finale_choice",
    };
    const fallback = fallbackByChapter[scene.chapter || "c1"] || "intro";
    return SCENES[fallback] ? fallback : "intro";
  }

  function normalizeOutcome(sceneId, option, outcome, label) {
    const fallbackOutcome = option.success || option.partial || option.fail || null;
    const normalized = (outcome && typeof outcome === "object")
      ? Object.assign({}, outcome)
      : (fallbackOutcome ? Object.assign({}, fallbackOutcome) : {});

    if (!normalized.next && !normalized.restart) {
      const fallbackNext =
        (option.success && option.success.next) ||
        (option.partial && option.partial.next) ||
        (option.fail && option.fail.next) ||
        chapterFallbackScene(sceneId);
      if (fallbackNext && SCENES[fallbackNext]) normalized.next = fallbackNext;
      if (!normalized.text) normalized.text = "The moment buckles, but the route stays open.";
      if (typeof showNotif === "function") {
        showNotif("Story fallback routed from missing " + label + " outcome.", "warn");
      }
    }
    return normalized;
  }

  function getFactionValue(key) {
    if (!S || !S.factionRenown || typeof S.factionRenown !== "object") return 0;
    return Number(S.factionRenown[key] || 0);
  }

  function inferOptionFactionKey(option) {
    if (!option || typeof option !== "object") return "";
    const candidates = [];

    if (option.req && option.req.factionAtLeast && option.req.factionAtLeast.key) {
      candidates.push(String(option.req.factionAtLeast.key));
    }
    if (option.req && Array.isArray(option.req.factionAtLeastAny)) {
      option.req.factionAtLeastAny.forEach(function (entry) {
        if (entry && entry.key) candidates.push(String(entry.key));
      });
    }

    const effectBuckets = [
      option.success && option.success.effects ? option.success.effects : null,
      option.partial && option.partial.effects ? option.partial.effects : null,
      option.fail && option.fail.effects ? option.fail.effects : null,
    ];

    effectBuckets.forEach(function (effects) {
      if (!effects) return;
      if (effects.faction && typeof effects.faction === "object") {
        Object.keys(effects.faction).forEach(function (key) { candidates.push(String(key)); });
      }
      if (effects.merchantReward && effects.merchantReward.factionKey) {
        candidates.push(String(effects.merchantReward.factionKey));
      }
    });

    const unique = candidates.filter(function (key, idx) {
      return key && candidates.indexOf(key) === idx;
    });

    if (!unique.length) return "";

    unique.sort(function (a, b) {
      return getFactionValue(b) - getFactionValue(a);
    });
    return unique[0] || "";
  }

  function hasReq(req) {
    if (!req) return true;
    const career = lc(S.career);
    const background = lc(S.background);

    if (Array.isArray(req.careerIncludes) && req.careerIncludes.length) {
      const ok = req.careerIncludes.some(function (c) { return career.indexOf(lc(c)) >= 0; });
      if (!ok) return false;
    }
    if (Array.isArray(req.backgroundIncludes) && req.backgroundIncludes.length) {
      const ok = req.backgroundIncludes.some(function (b) { return background.indexOf(lc(b)) >= 0; });
      if (!ok) return false;
    }
    if (req.factionAtLeast && req.factionAtLeast.key) {
      if (getFactionValue(req.factionAtLeast.key) < Number(req.factionAtLeast.min || 0)) return false;
    }
    if (Array.isArray(req.factionAtLeastAny) && req.factionAtLeastAny.length) {
      const anyOk = req.factionAtLeastAny.some(function (entry) {
        return getFactionValue(entry.key) >= Number(entry.min || 0);
      });
      if (!anyOk) return false;
    }
    if (req.age && lc(S.currentAge) !== lc(req.age)) return false;
    if (req.season && lc(S.currentSeason) !== lc(req.season)) return false;
    if (req.npcAffinity && req.npcAffinity.npc) {
      const st = ensureStoryState();
      if (!st) return false;
      if (st.flags[req.npcAffinity.npc + "Dead"]) return false;
      if ((st.npc[req.npcAffinity.npc] || 0) < Number(req.npcAffinity.min || 0)) return false;
    }
    if (req.flagEq && req.flagEq.key) {
      const st = ensureStoryState();
      if (!st) return false;
      if (st.flags[req.flagEq.key] !== req.flagEq.value) return false;
    }
    if (req.flagNot && req.flagNot.key) {
      const st = ensureStoryState();
      if (!st) return false;
      if (st.flags[req.flagNot.key] === req.flagNot.value) return false;
    }
    if (req.sceneSeenAtLeast && req.sceneSeenAtLeast.sceneId) {
      const st = ensureStoryState();
      if (!st) return false;
      const seen = Number((st.history && st.history.sceneVisits && st.history.sceneVisits[req.sceneSeenAtLeast.sceneId]) || 0);
      if (seen < Number(req.sceneSeenAtLeast.min || 1)) return false;
    }
    if (req.usedStatCountAtLeast && req.usedStatCountAtLeast.count) {
      const st = ensureStoryState();
      if (!st) return false;
      if ((st.usedStats || []).length < Number(req.usedStatCountAtLeast.count || 0)) return false;
    }
    if (req.sceneTypeSeenAtLeast && req.sceneTypeSeenAtLeast.type) {
      const st = ensureStoryState();
      if (!st) return false;
      const t = normalizeSceneType(req.sceneTypeSeenAtLeast.type);
      const seen = Number(st.storyMemory && st.storyMemory.sceneTypeCounts ? st.storyMemory.sceneTypeCounts[t] : 0);
      if (seen < Number(req.sceneTypeSeenAtLeast.min || 1)) return false;
    }
    if (Array.isArray(req.consequenceTagAny) && req.consequenceTagAny.length) {
      const st = ensureStoryState();
      if (!st) return false;
      const hasAny = req.consequenceTagAny.some(function (tag) {
        const key = String(tag || "").trim();
        return key && Number(st.storyMemory.tags[key] || 0) > 0;
      });
      if (!hasAny) return false;
    }
    if (Array.isArray(req.lexiconKnown) && req.lexiconKnown.length) {
      const st = ensureStoryState();
      if (!st) return false;
      const hasAll = req.lexiconKnown.every(function (token) {
        return !!st.lexicon[String(token || "").toLowerCase()];
      });
      if (!hasAll) return false;
    }
    if (req.lexiconCountAtLeast && req.lexiconCountAtLeast.count) {
      const st = ensureStoryState();
      if (!st) return false;
      if (Object.keys(st.lexicon || {}).length < Number(req.lexiconCountAtLeast.count || 0)) return false;
    }
    if (req.quoteKnown) {
      if (!hasRememberedQuote(req.quoteKnown)) return false;
    }
    if (Array.isArray(req.quoteKnownAny) && req.quoteKnownAny.length) {
      const okAny = req.quoteKnownAny.some(function (q) { return hasRememberedQuote(q); });
      if (!okAny) return false;
    }
    // Trait-based requirements (virtue, vice, reputation, misfortune, physique, mutation)
    if (req.virtueIs) {
      const v = lc((S && S.traits && S.traits.virtue) || "");
      if (v.indexOf(lc(req.virtueIs)) < 0) return false;
    }
    if (Array.isArray(req.virtueAny) && req.virtueAny.length) {
      const v = lc((S && S.traits && S.traits.virtue) || "");
      if (!req.virtueAny.some(function (x) { return v.indexOf(lc(x)) >= 0; })) return false;
    }
    if (req.viceIs) {
      const v = lc((S && S.traits && S.traits.vice) || "");
      if (v.indexOf(lc(req.viceIs)) < 0) return false;
    }
    if (Array.isArray(req.viceAny) && req.viceAny.length) {
      const v = lc((S && S.traits && S.traits.vice) || "");
      if (!req.viceAny.some(function (x) { return v.indexOf(lc(x)) >= 0; })) return false;
    }
    if (req.reputationIs) {
      const v = lc((S && S.traits && S.traits.reputation) || "");
      if (v.indexOf(lc(req.reputationIs)) < 0) return false;
    }
    if (Array.isArray(req.reputationAny) && req.reputationAny.length) {
      const v = lc((S && S.traits && S.traits.reputation) || "");
      if (!req.reputationAny.some(function (x) { return v.indexOf(lc(x)) >= 0; })) return false;
    }
    if (req.misfortuneIs) {
      const v = lc((S && S.traits && S.traits.misfortune) || "");
      if (v.indexOf(lc(req.misfortuneIs)) < 0) return false;
    }
    if (req.mutationIncludes) {
      const m = lc((S && S.mutation) || "");
      const terms = Array.isArray(req.mutationIncludes) ? req.mutationIncludes : [req.mutationIncludes];
      if (!terms.some(function (t) { return m.indexOf(lc(t)) >= 0; })) return false;
    }
    if (req.flavorSet) {
      const flavorText = lc((S && S.flavor) || "");
      if (!flavorText) return false;
    }
    if (Array.isArray(req.flavorAny) && req.flavorAny.length) {
      const flavorText = lc((S && S.flavor) || "");
      if (!req.flavorAny.some(function (term) { return flavorText.indexOf(lc(term)) >= 0; })) return false;
    }
    if (Array.isArray(req.flavorProfileAny) && req.flavorProfileAny.length) {
      if (typeof window.getPersonalFlavorMechanicProfile !== "function") return false;
      const profile = window.getPersonalFlavorMechanicProfile((S && S.flavor) || "");
      const okProfile = req.flavorProfileAny.some(function (key) { return !!(profile && profile[String(key || "")]); });
      if (!okProfile) return false;
    }
    if (req.backstorySet) {
      const bs = (S && S.backstory && typeof S.backstory === "object") ? S.backstory : null;
      const hasAny = !!(bs && (bs.origin || bs.upbringing || bs.hometown || bs.faction || bs.rival || bs.connection || bs.lifeEvent));
      if (!hasAny) return false;
    }
    if (Array.isArray(req.backstoryOriginAny) && req.backstoryOriginAny.length) {
      const origin = lc((S && S.backstory && S.backstory.origin) || "");
      if (!req.backstoryOriginAny.some(function (term) { return origin.indexOf(lc(term)) >= 0; })) return false;
    }
    if (Array.isArray(req.backstoryUpbringingAny) && req.backstoryUpbringingAny.length) {
      const up = lc((S && S.backstory && S.backstory.upbringing) || "");
      if (!req.backstoryUpbringingAny.some(function (term) { return up.indexOf(lc(term)) >= 0; })) return false;
    }
    if (Array.isArray(req.backstoryFactionAny) && req.backstoryFactionAny.length) {
      const faction = lc((S && S.backstory && S.backstory.faction) || "");
      if (!req.backstoryFactionAny.some(function (term) { return faction.indexOf(lc(term)) >= 0; })) return false;
    }
    if (req.backstoryRivalExists) {
      const rival = lc((S && S.backstory && S.backstory.rival) || "");
      if (!rival) return false;
    }
    if (req.backstoryConnectionExists) {
      const conn = lc((S && S.backstory && S.backstory.connection) || "");
      if (!conn) return false;
    }
    if (Array.isArray(req.augmentationsAny) && req.augmentationsAny.length) {
      const augs = Array.isArray(S.augmentations) ? S.augmentations : [];
      if (!hasAnyInList(augs, req.augmentationsAny)) return false;
    }
    if (Array.isArray(req.ownedHacksAny) && req.ownedHacksAny.length) {
      const hacks = Array.isArray(S.ownedHacks) ? S.ownedHacks : [];
      if (!hasAnyInList(hacks, req.ownedHacksAny)) return false;
    }
    if (Array.isArray(req.backpackAny) && req.backpackAny.length) {
      const loadout = normalizedLoadoutText();
      const ok = req.backpackAny.some(function (term) { return loadout.indexOf(lc(term)) >= 0; });
      if (!ok) return false;
    }
    if (req.actionDieAtLeast && req.actionDieAtLeast.stat) {
      const statKey = String(req.actionDieAtLeast.stat || '').toLowerCase();
      const minDie = Number(req.actionDieAtLeast.min || 4);
      const myDie = (typeof getEffectiveDie === 'function')
        ? Number(getEffectiveDie(statKey) || 4)
        : Number((S && S.stats && S.stats[statKey]) || 4);
      if (myDie < minDie) return false;
    }
    if (req.theosProvinceIs) {
      const currentProvince = lc(
        (typeof window.getActiveTheosProvinceId === "function" && window.getActiveTheosProvinceId())
          || (typeof window.getActiveTheosProvinceSummary === "function" && window.getActiveTheosProvinceSummary() && window.getActiveTheosProvinceSummary().id)
          || (S && S.theos && S.theos.activeProvinceId)
          || ""
      );
      if (currentProvince !== lc(req.theosProvinceIs)) return false;
    }
    if (Array.isArray(req.theosProvinceAny) && req.theosProvinceAny.length) {
      const currentProvince = lc(
        (typeof window.getActiveTheosProvinceId === "function" && window.getActiveTheosProvinceId())
          || (typeof window.getActiveTheosProvinceSummary === "function" && window.getActiveTheosProvinceSummary() && window.getActiveTheosProvinceSummary().id)
          || (S && S.theos && S.theos.activeProvinceId)
          || ""
      );
      const ok = req.theosProvinceAny.some(function (id) { return currentProvince === lc(id); });
      if (!ok) return false;
    }
    if (Array.isArray(req.theosDiscoveredAny) && req.theosDiscoveredAny.length) {
      const discovered = (S && S.theos && S.theos.discovered && typeof S.theos.discovered === "object") ? S.theos.discovered : {};
      const ok = req.theosDiscoveredAny.some(function (id) { return !!discovered[String(id || "").toLowerCase()]; });
      if (!ok) return false;
    }
    return true;
  }

  function applyNumericEffect(key, delta) {
    const d = Number(delta || 0);
    if (!d) return;
    if (key === "renown" || key === "tmw" || key === "pathTokens") {
      if (typeof changeCounter === "function") {
        changeCounter(key, d);
      } else {
        S[key] = Math.max(0, Number(S[key] || 0) + d);
      }
      return;
    }
    if (key === "health") {
      if (typeof changeHealth === "function") changeHealth(d);
      return;
    }
    if (key === "mentalStress") {
      if (typeof changeMentalStress === "function") changeMentalStress(d);
      return;
    }
    if (key === "credits") {
      S.credits = Math.max(0, Number(S.credits || 0) + d);
      if (typeof updateCreditsUI === "function") updateCreditsUI();
      return;
    }
  }

  function activateStoryWarfront(scale) {
    const st = ensureStoryState();
    const scaleBonus = Math.floor(getStoryModifierValue("warfrontScaleBonus"));
    const scaleMultiplier = Math.max(0.5, Number(getStoryModifierValue("warfrontScaleMultiplier") || 1));
    const target = Math.max(3, Math.round((Number(scale || 6) + scaleBonus) * scaleMultiplier));
    let marked = 0;

    if (S && S.worldThatWas && Array.isArray(S.worldThatWas.hexes) && S.worldThatWas.hexes.length) {
      const candidates = S.worldThatWas.hexes.filter(function (hex) {
        return !!hex && !hex.station && !hex.landingPad;
      });
      for (let i = 0; i < candidates.length && marked < target; i += 1) {
        const hex = candidates[i];
        if (!hex.skirmish) {
          hex.skirmish = true;
          marked += 1;
        }
      }
      if (typeof window.wtwSyncMarkers === "function") {
        try { window.wtwSyncMarkers(); } catch (_err) { console.error(_err); }
      }
    }

    if (st) {
      st.flags.warfrontActive = true;
      st.flags.warfrontScale = Math.max(marked, target);
    }

    if (typeof showNotif === "function") {
      showNotif("Warfront escalates: " + Math.max(marked, target) + " districts marked for active skirmish.", "warn");
    }
  }

  function applyEffects(effects) {
    if (!effects) return;
    ["renown", "tmw", "pathTokens", "health", "mentalStress", "credits"].forEach(function (k) {
      if (effects[k] || effects[k] === 0) applyNumericEffect(k, effects[k]);
    });

    if (effects.faction && typeof effects.faction === "object") {
      Object.keys(effects.faction).forEach(function (key) {
        const delta = Number(effects.faction[key] || 0);
        if (!delta) return;
        if (typeof changeFactionRenown === "function") changeFactionRenown(key, delta);
        else if (S.factionRenown) S.factionRenown[key] = Math.max(-10, Math.min(12, Number(S.factionRenown[key] || 0) + delta));
      });
      if (typeof updateFactionRenownUI === "function") updateFactionRenownUI();
    }

    if (effects.npc && typeof effects.npc === "object") {
      const st = ensureStoryState();
      Object.keys(effects.npc).forEach(function (npc) {
        st.npc[npc] = Number(st.npc[npc] || 0) + Number(effects.npc[npc] || 0);
      });
    }

    if (effects.flags && typeof effects.flags === "object") {
      const st = ensureStoryState();
      Object.keys(effects.flags).forEach(function (key) {
        st.flags[key] = effects.flags[key];
      });
    }

    if (Array.isArray(effects.consequenceTags) && effects.consequenceTags.length) {
      const st = ensureStoryState();
      effects.consequenceTags.forEach(function (tag) {
        const key = "tag:" + lc(tag);
        if (!key) return;
        st.storyMemory.tags[key] = Number(st.storyMemory.tags[key] || 0) + 1;
      });
    }

    if (effects.lexicon && typeof effects.lexicon === "object") {
      const st = ensureStoryState();
      Object.keys(effects.lexicon).forEach(function (glyph) {
        st.lexicon[String(glyph || "").toLowerCase()] = String(effects.lexicon[glyph] || "").toLowerCase();
      });
    }

    if (effects.dialogueQuote) {
      const entries = Array.isArray(effects.dialogueQuote) ? effects.dialogueQuote : [effects.dialogueQuote];
      entries.forEach(function (entry) {
        if (!entry) return;
        addDialogueMemory(entry.speaker || "Unknown", entry.line || "");
      });
    }

    if (effects.merchantReward && typeof effects.merchantReward === "object") {
      grantMerchantReward(effects.merchantReward);
    }

    if (Array.isArray(effects.consumeBackpackAny) && effects.consumeBackpackAny.length) {
      var consumed = consumeBackpackAny(effects.consumeBackpackAny);
      if (consumed && typeof showNotif === "function") showNotif("Story item used: " + consumed, "good");
    }

    if (effects.branchRewardTable) {
      grantBranchRewardTable(effects.branchRewardTable);
    }

    if (effects.storyAlias) {
      const alias = String(effects.storyAlias || "").trim();
      if (alias) {
        S.name = alias;
        const nameEl = document.getElementById("charName");
        if (nameEl) nameEl.value = alias;
        if (typeof showNotif === "function") showNotif("Timeline shift: your name is now " + alias + ".", "warn");
      }
    }

    if (effects.startArmy && typeof effects.startArmy === "object") {
      const cfg = effects.startArmy;
      S.storyArmy = S.storyArmy || {};
      S.storyArmy.name = String(cfg.name || "Pale Legion");
      S.storyArmy.strength = Math.max(1, Number(cfg.strength || 5));
      S.storyArmy.doctrine = String(cfg.doctrine || "Order by Force");
      S.storyArmy.eraTag = String((S.currentAge || "green") + "/" + (S.currentSeason || "spring"));
      const st = ensureStoryState();
      if (st) {
        st.flags.armyFounded = true;
        st.flags.armyName = S.storyArmy.name;
      }
      if (typeof showNotif === "function") {
        showNotif("Army founded: " + S.storyArmy.name + " (Strength " + S.storyArmy.strength + ").", "warn");
      }
    }

    if (effects.activateWarfront) {
      activateStoryWarfront(effects.activateWarfront);
    }
  }

  function grantMerchantReward(reward) {
    const creditMultiplier = Math.max(0, Number(getStoryModifierValue("merchantCreditsMultiplier") || 1));
    const renownBonus = Math.floor(getStoryModifierValue("merchantFactionRenownBonus"));
    const credits = Math.round(Number(reward.credits || 0) * creditMultiplier);
    const factionKey = reward.factionKey || "corporations";
    const renown = Number(reward.factionRenown || 0) + renownBonus;
    const rawItem = reward.item || "";
    let item = rawItem;

    if (rawItem && String(rawItem).toLowerCase() === 'trade good' && typeof SHOP_DATA === 'object' && SHOP_DATA && Array.isArray(SHOP_DATA.tradegoods) && SHOP_DATA.tradegoods.length) {
      item = String((pick(SHOP_DATA.tradegoods) || {}).name || rawItem);
    } else if (rawItem && typeof normalizeLegacyLootAlias === 'function') {
      item = normalizeLegacyLootAlias(rawItem);
    }

    if (credits) {
      S.credits = Math.max(0, Number(S.credits || 0) + credits);
      if (typeof updateCreditsUI === "function") updateCreditsUI();
    }

    if (renown) {
      if (typeof changeFactionRenown === "function") changeFactionRenown(factionKey, renown);
      else if (S.factionRenown && typeof S.factionRenown === "object") {
        S.factionRenown[factionKey] = Math.max(-10, Math.min(12, Number(S.factionRenown[factionKey] || 0) + renown));
      }
      if (typeof updateFactionRenownUI === "function") updateFactionRenownUI();
    }

    if (item && typeof addToBackpack === "function") {
      try { addToBackpack(item); } catch (err) { console.error(err); }
    }

    if (reward.openShop && typeof switchTab === "function") {
      const shopBtn = document.querySelector(".tab-btn[onclick*=\"switchTab('shop'\"]");
      switchTab("shop", shopBtn || null);
    }

    if (typeof showNotif === "function") {
      const bits = [];
      if (credits) bits.push((credits > 0 ? "+" : "") + credits + " Credits");
      if (renown) bits.push((renown > 0 ? "+" : "") + renown + " " + (FACTION_LABELS[factionKey] || factionKey));
      if (item) bits.push("Loot: " + item);
      if (bits.length) showNotif("Merchant reward: " + bits.join("  |  "), "good");
    }
  }

  function ensurePuzzleSession() {
    window._storyPuzzle = window._storyPuzzle || {
      sceneId: "",
      optionId: "",
      mode: "code",
      title: "",
      prompt: "",
      answer: "",
      sequence: [],
      selected: [],
      bank: [],
      clues: [],
      gridTemplate: [],
      gridRows: 0,
      gridCols: 0,
      mazeLayout: [],
      mazeRows: 0,
      mazeCols: 0,
      sudokuPuzzle: [],
      sudokuSolution: [],
      sudokuSize: 0,
      typed: "",
      lastClue: "",
      revealed: false,
      externalResolve: null,
      externalThresholds: null,
      crossword: null,
    };
    return window._storyPuzzle;
  }

  function resetPuzzleSession() {
    const p = ensurePuzzleSession();
    p.sceneId = "";
    p.optionId = "";
    p.mode = "code";
    p.title = "";
    p.prompt = "";
    p.answer = "";
    p.sequence = [];
    p.selected = [];
    p.bank = [];
    p.clues = [];
    p.gridTemplate = [];
    p.gridRows = 0;
    p.gridCols = 0;
    p.mazeLayout = [];
    p.mazeRows = 0;
    p.mazeCols = 0;
    p.sudokuPuzzle = [];
    p.sudokuSolution = [];
    p.sudokuSize = 0;
    p.typed = "";
    p.lastClue = "";
    p.revealed = false;
    p.externalResolve = null;
    p.externalThresholds = null;
    p.crossword = null;
  }

  function puzzleTierForScene(sceneId) {
    const scene = SCENES[sceneId] || {};
    const chapter = scene.chapter || "c1";
    if (chapter === "c1") return { label: "Easy", success: 0.7, partial: 0.45 };
    if (chapter === "c2") return { label: "Standard", success: 0.78, partial: 0.52 };
    if (chapter === "c3") return { label: "Hard", success: 0.86, partial: 0.6 };
    return { label: "Brutal", success: 0.93, partial: 0.68 };
  }

  function scoreTokens(typed, expected) {
    const a = lc(typed).split(/\s+/).filter(Boolean);
    const b = lc(expected).split(/\s+/).filter(Boolean);
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    const maxLen = Math.max(a.length, b.length);
    let correct = 0;
    for (let i = 0; i < maxLen; i++) {
      if ((a[i] || "") === (b[i] || "")) correct += 1;
    }
    return correct / maxLen;
  }

  function scoreCrosswordGrid(p) {
    let total = 0;
    let correct = 0;
    const rows = (p.mode === "crossword" && p.crossword) ? p.crossword.rows : p.gridRows;
    const cols = (p.mode === "crossword" && p.crossword) ? p.crossword.cols : p.gridCols;
    const templateRows = (p.mode === "crossword" && p.crossword && Array.isArray(p.crossword.gridTemplate))
      ? normalizeCrosswordGridTemplateRows(p.crossword.gridTemplate, rows, cols)
      : normalizeCrosswordGridTemplateRows(p.gridTemplate, rows, cols);
    for (let r = 0; r < rows; r++) {
      const row = templateRows[r] || "";
      for (let c = 0; c < cols; c++) {
        const expected = (row[c] || "#").toUpperCase();
        if (expected === "#") continue;
        total += 1;
        const idPrefix = (p.mode === "crossword") ? "storyCrossGrid_" : "storyGrid_";
        const el = document.getElementById(idPrefix + r + "_" + c);
        const typed = (el && typeof el.value === "string") ? el.value.trim().toUpperCase() : "";
        if (typed && typed === expected) correct += 1;
      }
    }
    return total ? (correct / total) : 0;
  }

  function crosswordNormalizeAnswer(text) {
    return String(text || "").toUpperCase().replace(/[^A-Z]/g, "");
  }

  function normalizeCrosswordGridTemplateRows(template, rowCount, colCount) {
    const rows = Math.max(0, Number(rowCount || (Array.isArray(template) ? template.length : 0)) || 0);
    const cols = Math.max(0, Number(colCount || 0) || 0);
    const out = [];
    for (let r = 0; r < rows; r++) {
      let row = String((Array.isArray(template) ? template[r] : "") || "").toUpperCase().replace(/\s+/g, "");
      if (cols > 0) row = row.padEnd(cols, "#").slice(0, cols);
      out.push(row);
    }
    return out;
  }

  function cleanCrosswordGridClueText(text) {
    return String(text || "").replace(/^(Across|Down)\s+\d+\s*:\s*/i, "").trim();
  }

  function buildCrosswordGridMetadata(p) {
    const rows = Math.max(0, Number(p && p.gridRows || 0) || 0);
    const cols = Math.max(0, Number(p && p.gridCols || 0) || 0);
    const templateRows = normalizeCrosswordGridTemplateRows(p && p.gridTemplate, rows, cols);
    const rawClues = Array.isArray(p && p.clues) ? p.clues : [];
    const directions = rawClues.map(function (clue) {
      return crosswordClueDirection(clue) || "across";
    });
    const acrossOnly = !!directions.length && directions.every(function (dir) { return dir !== "down"; });
    const downOnly = !!directions.length && directions.every(function (dir) { return dir === "down"; });
    const cellNums = {};
    const across = [];
    const down = [];
    let numCounter = 1;
    const isOpen = function (r, c) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
      return (templateRows[r][c] || "#") !== "#";
    };
    const readWord = function (r, c, dir) {
      let out = "";
      if (dir === "down") {
        let rr = r;
        while (rr < rows && isOpen(rr, c)) {
          out += templateRows[rr][c] || "";
          rr += 1;
        }
        return out;
      }
      let cc = c;
      while (cc < cols && isOpen(r, cc)) {
        out += templateRows[r][cc] || "";
        cc += 1;
      }
      return out;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isOpen(r, c)) continue;
        const startsAcross = (!isOpen(r, c - 1)) && isOpen(r, c + 1);
        const startsDown = (!isOpen(r - 1, c)) && isOpen(r + 1, c);
        const shouldNumber = acrossOnly ? startsAcross : (downOnly ? startsDown : (startsAcross || startsDown));
        if (shouldNumber) {
          cellNums[r + ":" + c] = numCounter;
          numCounter += 1;
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isOpen(r, c)) continue;
        const number = Number(cellNums[r + ":" + c] || 0);
        const startsAcross = (!isOpen(r, c - 1)) && isOpen(r, c + 1);
        const startsDown = (!isOpen(r - 1, c)) && isOpen(r + 1, c);
        if (startsAcross) across.push({ number: number || 0, answer: readWord(r, c, "across"), row: r, col: c });
        if (startsDown) down.push({ number: number || 0, answer: readWord(r, c, "down"), row: r, col: c });
      }
    }

    across.sort(function (a, b) { return a.number - b.number; });
    down.sort(function (a, b) { return a.number - b.number; });
    return { rows: rows, cols: cols, templateRows: templateRows, cellNums: cellNums, across: across, down: down, acrossOnly: acrossOnly, downOnly: downOnly };
  }

  function crosswordClueDirection(clue) {
    const explicit = String((clue && clue.direction) || "").trim().toLowerCase();
    if (explicit === "across" || explicit === "down") return explicit;
    const text = String((clue && clue.clue) || "");
    if (/\bdown\b/i.test(text)) return "down";
    if (/\bacross\b/i.test(text)) return "across";
    return "";
  }

  const STORY_CROSSWORD_STRICT_ROWS = 7;
  const STORY_CROSSWORD_STRICT_COLS = 7;
  const STORY_CROSSWORD_MIN_ENTRIES = 8;
  const STORY_CROSSWORD_MAX_ENTRIES = 12;

  function crosswordEvaluateStrictTemplate(template) {
    const rows = Array.isArray(template) ? template.length : 0;
    const cols = rows ? String(template[0] || "").length : 0;
    const sizeOk = rows === STORY_CROSSWORD_STRICT_ROWS
      && cols === STORY_CROSSWORD_STRICT_COLS
      && template.every(function (row) { return String(row || "").length === STORY_CROSSWORD_STRICT_COLS; });
    let unchecked = 0;
    let stubs = 0;
    let isolated = 0;
    let symmetryMismatch = 0;
    const isWhite = function (r, c) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
      return ((String(template[r] || "")[c] || "#") !== "#");
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWhite(r, c)) continue;
        const hasHoriz = isWhite(r, c - 1) || isWhite(r, c + 1);
        const hasVert = isWhite(r - 1, c) || isWhite(r + 1, c);
        if (!hasHoriz || !hasVert) unchecked += 1;
        if ((hasHoriz && !hasVert) || (!hasHoriz && hasVert)) stubs += 1;
        if (!hasHoriz && !hasVert) isolated += 1;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rr = rows - 1 - r;
        const cc = cols - 1 - c;
        const a = (String(template[r] || "")[c] || "#") === "#";
        const b = (String(template[rr] || "")[cc] || "#") === "#";
        if (a !== b) symmetryMismatch += 1;
      }
    }
    symmetryMismatch = Math.floor(symmetryMismatch / 2);
    const ok = sizeOk && unchecked === 0 && stubs === 0 && isolated === 0;
    return { ok: ok, unchecked: unchecked, stubs: stubs, isolated: isolated, symmetryMismatch: symmetryMismatch };
  }

  function crosswordBuildEntriesFromTemplate(template, clueLookup) {
    const rows = Array.isArray(template) ? template.length : 0;
    const cols = rows ? String(template[0] || "").length : 0;
    if (!rows || !cols) return null;
    const cellNums = {};
    const isWhite = function (r, c) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
      return ((String(template[r] || "")[c] || "#") !== "#");
    };
    const readWord = function (r, c, dir) {
      let out = "";
      if (dir === "across") {
        let cc = c;
        while (cc < cols && isWhite(r, cc)) {
          out += (String(template[r] || "")[cc] || "").toUpperCase();
          cc += 1;
        }
      } else {
        let rr = r;
        while (rr < rows && isWhite(rr, c)) {
          out += (String(template[rr] || "")[c] || "").toUpperCase();
          rr += 1;
        }
      }
      return out;
    };

    let num = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWhite(r, c)) continue;
        const startsAcross = (!isWhite(r, c - 1)) && isWhite(r, c + 1);
        const startsDown = (!isWhite(r - 1, c)) && isWhite(r + 1, c);
        if (startsAcross || startsDown) {
          cellNums[r + ":" + c] = num;
          num += 1;
        }
      }
    }

    const across = [];
    const down = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWhite(r, c)) continue;
        const number = Number(cellNums[r + ":" + c] || 0);
        if (!number) continue;
        const startsAcross = (!isWhite(r, c - 1)) && isWhite(r, c + 1);
        const startsDown = (!isWhite(r - 1, c)) && isWhite(r + 1, c);
        if (startsAcross) {
          const key = "across:" + r + ":" + c;
          across.push({ number: number, clue: (clueLookup && clueLookup[key]) || "Cross-check entry", answer: readWord(r, c, "across"), row: r, col: c });
        }
        if (startsDown) {
          const key = "down:" + r + ":" + c;
          down.push({ number: number, clue: (clueLookup && clueLookup[key]) || "Cross-check entry", answer: readWord(r, c, "down"), row: r, col: c });
        }
      }
    }
    across.sort(function (a, b) { return a.number - b.number; });
    down.sort(function (a, b) { return a.number - b.number; });
    return { rows: rows, cols: cols, gridTemplate: template, cellNums: cellNums, across: across, down: down };
  }

  function buildStoryCrosswordFromClues(rawClues) {
    const clues = Array.isArray(rawClues) ? rawClues.map(function (entry, idx) {
      return {
        id: idx,
        clue: String((entry && entry.clue) || ""),
        answer: crosswordNormalizeAnswer(entry && entry.answer),
        preferred: crosswordClueDirection(entry),
      };
    }).filter(function (entry) { return entry.answer.length >= 2; }) : [];
    if (clues.length < 2) return null;

    function tryBuild(order, firstDir, attempt) {
      const grid = {};
      const placements = [];
      const key = function (x, y) { return x + ":" + y; };
      const get = function (x, y) { return grid[key(x, y)] || ""; };
      const set = function (x, y, ch) { grid[key(x, y)] = ch; };
      const jitter = function (n) {
        const raw = Math.sin((n + 1) * (attempt + 3) * 12.9898) * 43758.5453;
        return raw - Math.floor(raw);
      };
      const canPlace = function (word, x, y, dir) {
        const dx = dir === "across" ? 1 : 0;
        const dy = dir === "down" ? 1 : 0;
        let crosses = 0;
        for (let i = 0; i < word.length; i++) {
          const cx = x + dx * i;
          const cy = y + dy * i;
          const existing = get(cx, cy);
          if (existing && existing !== word[i]) return { ok: false, crosses: 0 };
          if (!existing) {
            if (dir === "across") {
              if (get(cx, cy - 1) || get(cx, cy + 1)) return { ok: false, crosses: 0 };
            } else {
              if (get(cx - 1, cy) || get(cx + 1, cy)) return { ok: false, crosses: 0 };
            }
          } else {
            crosses += 1;
          }
        }
        if (get(x - dx, y - dy) || get(x + dx * word.length, y + dy * word.length)) return { ok: false, crosses: 0 };
        return { ok: true, crosses: crosses };
      };
      const doPlace = function (clue, x, y, dir) {
        const dx = dir === "across" ? 1 : 0;
        const dy = dir === "down" ? 1 : 0;
        for (let i = 0; i < clue.answer.length; i++) set(x + dx * i, y + dy * i, clue.answer[i]);
        placements.push({ id: clue.id, clue: clue.clue, answer: clue.answer, dir: dir, x: x, y: y });
      };

      doPlace(order[0], 0, 0, firstDir);
      for (let ci = 1; ci < order.length; ci++) {
        const clue = order[ci];
        const word = clue.answer;
        let best = null;
        const preferredOrder = clue.preferred
          ? [clue.preferred, clue.preferred === "across" ? "down" : "across"]
          : ["down", "across"];
        Object.keys(grid).forEach(function (kxy) {
          const parts = kxy.split(":");
          const gx = Number(parts[0]);
          const gy = Number(parts[1]);
          const gch = grid[kxy];
          for (let wi = 0; wi < word.length; wi++) {
            if (word[wi] !== gch) continue;
            for (let oi = 0; oi < preferredOrder.length; oi++) {
              const dir = preferredOrder[oi];
              const sx = dir === "across" ? gx - wi : gx;
              const sy = dir === "down" ? gy - wi : gy;
              const fit = canPlace(word, sx, sy, dir);
              if (!fit.ok || fit.crosses < 1) continue;
              const score = fit.crosses * 12 + (dir === clue.preferred ? 2 : 0) + jitter(ci * 37 + wi * 11 + oi * 3);
              if (!best || score > best.score) best = { x: sx, y: sy, dir: dir, score: score };
            }
          }
        });
        if (!best) return null;
        doPlace(clue, best.x, best.y, best.dir);
      }

      const coords = Object.keys(grid).map(function (kxy) {
        const p = kxy.split(":");
        return { x: Number(p[0]), y: Number(p[1]) };
      });
      if (!coords.length) return null;
      const minX = Math.min.apply(null, coords.map(function (c) { return c.x; }));
      const maxX = Math.max.apply(null, coords.map(function (c) { return c.x; }));
      const minY = Math.min.apply(null, coords.map(function (c) { return c.y; }));
      const maxY = Math.max.apply(null, coords.map(function (c) { return c.y; }));
      const template = [];
      for (let y = minY; y <= maxY; y++) {
        let row = "";
        for (let x = minX; x <= maxX; x++) row += get(x, y) || "#";
        template.push(row);
      }
      const placed = placements.map(function (pl) {
        return { dir: pl.dir, row: pl.y - minY, col: pl.x - minX, clue: pl.clue };
      });
      return { template: template, placements: placed };
    }

    let best = null;
    for (let attempt = 0; attempt < 80; attempt++) {
      const ordered = clues.slice().sort(function (a, b) {
        const lenDiff = b.answer.length - a.answer.length;
        if (lenDiff !== 0) return lenDiff;
        const aw = Math.floor(Math.abs(Math.sin((a.id + 1) * (attempt + 5))) * 1000);
        const bw = Math.floor(Math.abs(Math.sin((b.id + 1) * (attempt + 5))) * 1000);
        return aw - bw;
      });
      const naturalDir = ordered[0].preferred || "across";
      const firstDir = (attempt % 2 === 0) ? naturalDir : (naturalDir === "across" ? "down" : "across");
      const candidate = tryBuild(ordered, firstDir, attempt);
      if (!candidate) continue;
      const strict = crosswordEvaluateStrictTemplate(candidate.template);
      if (!strict.ok) continue;
      const clueLookup = {};
      candidate.placements.forEach(function (pl) {
        clueLookup[pl.dir + ":" + pl.row + ":" + pl.col] = pl.clue;
      });
      const built = crosswordBuildEntriesFromTemplate(candidate.template, clueLookup);
      if (!built || !Array.isArray(built.across) || !Array.isArray(built.down)) continue;
      if (built.rows !== STORY_CROSSWORD_STRICT_ROWS || built.cols !== STORY_CROSSWORD_STRICT_COLS) continue;
      const totalEntries = built.across.length + built.down.length;
      if (totalEntries < STORY_CROSSWORD_MIN_ENTRIES || totalEntries > STORY_CROSSWORD_MAX_ENTRIES) continue;
      const fillRatio = totalEntries;
      const quality = {
        symmetryMismatch: strict.symmetryMismatch,
        fillRatio: fillRatio,
        area: built.rows * built.cols
      };
      if (!best
        || quality.symmetryMismatch < best.quality.symmetryMismatch
        || (quality.symmetryMismatch === best.quality.symmetryMismatch && quality.fillRatio > best.quality.fillRatio)
        || (quality.symmetryMismatch === best.quality.symmetryMismatch && quality.fillRatio === best.quality.fillRatio && quality.area < best.quality.area)) {
        best = { crossword: built, quality: quality };
      }
    }
    return best ? best.crossword : null;
  }

  function buildFallbackStoryCrossword() {
    var fallbackCluesByAnswer = {
      lich: 'Undead wizard villain',
      relic: 'Ancient magical artifact',
      spell: 'Magic cast by a wizard',
      rogue: 'Sneaky dagger-user',
      goblin: 'Classic low-level monster',
      mana: 'Magical energy pool',
      paladin: 'Holy armored knight class',
      gate: 'Secure entry point',
      route: 'Team travel plan',
      maps: 'Dungeon layout charts',
      lore: 'Story archive',
      ttrpg: 'Fantasy tabletop abbreviation',
      orc: 'Green raider species',
      hp: 'Health shorthand',
      gm: 'Campaign runner initials',
      dm: 'Person running the campaign',
      cat: 'House pet',
      are: 'To exist',
      ten: 'Number after nine'
    };
    function fallbackCrosswordClueFor(entry, direction) {
      var answer = String(entry && entry.answer || '').trim().toLowerCase();
      var clue = fallbackCluesByAnswer[answer];
      if (clue) return clue + ' (' + String(answer || '').length + ')';
      var dirLabel = String(direction || 'across').toLowerCase() === 'down' ? 'Down' : 'Across';
      return dirLabel + ' clue for ' + String(answer || '?').toUpperCase() + ' (' + String(answer || '').length + ')';
    }

    const packs = [
      {
        template: ['ROGUE##', 'P#O#HP#', 'GOBLIN#', '#R#P#C#', 'MANA###', 'A#P#DM#', 'PALADIN'],
        across: ['Sneaky backstabber class', 'Classic low-level monster', 'Magical energy pool', 'Holy armored knight class'],
        down: ['Fantasy tabletop abbreviation', 'Orcish raider species', 'Health shorthand', 'Dungeon layout chart', 'Session runner initials']
      },
      {
        template: ['LICH###', 'O#N#DM#', 'RELIC##', 'E#I#AR#', 'SPELL##', '#C#P#C#', 'ROGUE##'],
        across: ['Undead wizard villain', 'Ancient magical artifact', 'Magic cast by a wizard', 'Sneaky dagger-user'],
        down: ['Person running the campaign', 'Adventure setting history', 'Character morality system', 'Arcane casting role']
      },
      {
        template: ['GATE###', 'O#R#DM#', 'ROUTE##', 'E#P#AR#', 'MAPS###', '#G#G#C#', 'LORE###'],
        across: ['Secure entry point', 'Team travel plan', 'Dungeon layout charts', 'Story archive'],
        down: ['Fantasy tabletop abbreviation', 'Green raider species', 'Health shorthand', 'Campaign runner initials']
      }
    ];
    const start = Math.floor(Math.random() * packs.length);
    for (let i = 0; i < packs.length; i++) {
      const pick = packs[(start + i) % packs.length] || packs[0];
      const built = crosswordBuildEntriesFromTemplate(pick.template, {});
      if (!built) continue;
      built.across.forEach(function (entry) {
        entry.clue = fallbackCrosswordClueFor(entry, 'across');
      });
      built.down.forEach(function (entry) {
        entry.clue = fallbackCrosswordClueFor(entry, 'down');
      });
      return built;
    }

    const emergency = crosswordBuildEntriesFromTemplate(['ROGUE##', 'P#O#HP#', 'GOBLIN#', '#R#P#C#', 'MANA###', 'A#P#DM#', 'PALADIN'], {});
    if (emergency) {
      emergency.across.forEach(function (entry) {
        entry.clue = fallbackCrosswordClueFor(entry, 'across');
      });
      emergency.down.forEach(function (entry) {
        entry.clue = fallbackCrosswordClueFor(entry, 'down');
      });
      return emergency;
    }
    var micro = crosswordBuildEntriesFromTemplate(['#######', '##CAT##', '##ARE##', '##TEN##', '#######', '#######', '#######'], {});
    if (micro) {
      micro.across.forEach(function (entry) {
        entry.clue = fallbackCrosswordClueFor(entry, 'across');
      });
      micro.down.forEach(function (entry) {
        entry.clue = fallbackCrosswordClueFor(entry, 'down');
      });
      return micro;
    }
    return null;
  }

  function puzzleAttemptScore() {
    const p = ensurePuzzleSession();
    if (p.mode === "tune") {
      const maxLen = Math.max(p.sequence.length, p.selected.length, 1);
      let correct = 0;
      for (let i = 0; i < maxLen; i++) {
        if (lc(p.sequence[i]) === lc(p.selected[i])) correct += 1;
      }
      return correct / maxLen;
    }
    if (p.mode === "memory") {
      const maxLen = Math.max(p.sequence.length, p.selected.length, 1);
      let correct = 0;
      for (let i = 0; i < maxLen; i++) {
        if (lc(p.sequence[i]) === lc(p.selected[i])) correct += 1;
      }
      return correct / maxLen;
    }
    if (p.mode === "rearrange") {
      return scoreTokens(p.selected.join(" "), p.answer);
    }
    if (p.mode === "mosaic") {
      return scoreTokens(p.selected.join(" "), p.answer);
    }
    if (p.mode === "crossword_grid") {
      return scoreCrosswordGrid(p);
    }
    if (p.mode === "crossword") {
      if (p.crossword && Array.isArray(p.crossword.gridTemplate)) {
        return scoreCrosswordGrid(p);
      }
      const maxLen = Math.max(p.clues.length, 1);
      let correct = 0;
      p.clues.forEach(function (c, i) {
        const el = document.getElementById("storyCross_" + i);
        const val = (el && typeof el.value === "string") ? el.value.trim().toLowerCase() : "";
        if (val === String(c.answer || "").trim().toLowerCase()) correct += 1;
      });
      return correct / maxLen;
    }
    if (p.mode === "maze") {
      const expected = String(p.answer || "").trim().toLowerCase();
      const route = p.selected.join("-").trim().toLowerCase();
      if (route && expected) return scoreTokens(route, expected);
      const trace = traceStoryMazePath(p);
      return trace.totalMoves ? (trace.validMoves / trace.totalMoves) : 0;
    }
    if (p.mode === "sudoku") {
      let total = 0;
      let correct = 0;
      for (let r = 0; r < p.sudokuSize; r++) {
        for (let c = 0; c < p.sudokuSize; c++) {
          const given = String(((p.sudokuPuzzle[r] || [])[c] || "")).trim();
          const expected = String(((p.sudokuSolution[r] || [])[c] || "")).trim();
          if (given || !expected) continue;
          total += 1;
          const el = document.getElementById("storySudoku_" + r + "_" + c);
          const typed = (el && typeof el.value === "string") ? el.value.trim() : "";
          if (typed && typed === expected) correct += 1;
        }
      }
      return total ? (correct / total) : 0;
    }

    const el = document.getElementById("storyPuzzleInput");
    const val = (el && typeof el.value === "string") ? el.value.trim().toLowerCase() : "";
    if (val === p.answer) return 1;
    return scoreTokens(val, p.answer);
  }

  function clueTextForPuzzle(p) {
    if (!p) return "";
    if (p.mode === "tune") {
      if (Array.isArray(p.sequence) && p.sequence.length) {
        return "Tune starts with " + p.sequence[0] + " and has " + p.sequence.length + " notes.";
      }
      return "Listen for repeated notes in the sequence.";
    }
    if (p.mode === "memory") {
      if (Array.isArray(p.sequence) && p.sequence.length) {
        return "Sequence starts with '" + p.sequence[0] + "' and contains " + p.sequence.length + " sigils.";
      }
      return "Look for repeated symbols in the hidden sequence.";
    }
    if (p.mode === "rearrange") {
      const words = String(p.answer || "").split(/\s+/).filter(Boolean);
      if (!words.length) return "Arrange words in a sentence-like order.";
      return "Phrase has " + words.length + " words and starts with '" + words[0].toUpperCase() + "'.";
    }
    if (p.mode === "mosaic") {
      const parts = String(p.answer || "").split(/\s+/).filter(Boolean);
      if (!parts.length) return "Place the fragments into a coherent image order.";
      return "The image uses " + parts.length + " tiles and begins with " + parts[0] + ".";
    }
    if (p.mode === "crossword") {
      if (p.crossword && Array.isArray(p.crossword.gridTemplate)) {
        for (let r = 0; r < p.crossword.rows; r++) {
          const row = String((p.crossword.gridTemplate[r] || "")).toUpperCase();
          for (let c = 0; c < p.crossword.cols; c++) {
            const ch = row[c] || "#";
            if (!ch || ch === "#") continue;
            const el = document.getElementById("storyCrossGrid_" + r + "_" + c);
            if (el && !String(el.value || "").trim()) {
              el.value = ch;
              return "A crossword cell was revealed for you.";
            }
          }
        }
        return "Crossword nearly complete. Verify Across and Down intersections.";
      }
      const clue = (p.clues || []).find(function (entry) { return entry && entry.answer; });
      if (!clue) return "Check clue wording for tense and noun form.";
      const ans = String(clue.answer || "").trim().toUpperCase();
      return "One crossword answer starts with '" + (ans.charAt(0) || "?") + "'.";
    }
    if (p.mode === "crossword_grid") {
      const rows = Array.isArray(p.gridTemplate) ? p.gridTemplate : [];
      for (let r = 0; r < rows.length; r++) {
        const row = String(rows[r] || "").toUpperCase();
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (!ch || ch === "#") continue;
          const el = document.getElementById("storyGrid_" + r + "_" + c);
          if (el && !String(el.value || "").trim()) {
            el.value = ch;
            return "A grid cell was revealed for you.";
          }
        }
      }
      return "Most grid cells are already filled; check intersections carefully.";
    }
    if (p.mode === "maze") {
      const route = String(p.answer || "").trim().toUpperCase().split(/\s*-\s*/).filter(Boolean);
      if (!route.length) return "Trace a valid route from S to E without crossing walls.";
      return "The route begins with '" + route[0] + "' and uses " + route.length + " moves.";
    }
    if (p.mode === "sudoku") {
      for (let r = 0; r < p.sudokuSize; r++) {
        for (let c = 0; c < p.sudokuSize; c++) {
          const given = String(((p.sudokuPuzzle[r] || [])[c] || "")).trim();
          const expected = String(((p.sudokuSolution[r] || [])[c] || "")).trim();
          if (given || !expected) continue;
          const el = document.getElementById("storySudoku_" + r + "_" + c);
          if (el && !String(el.value || "").trim()) {
            el.value = expected;
            return "A Sudoku cell was revealed for you.";
          }
        }
      }
      return "Most Sudoku cells are already filled; check row and column balance carefully.";
    }
    const answer = String(p.answer || "").trim();
    if (!answer) return "Focus on keywords in the prompt.";
    return "Answer length is " + answer.length + ". It starts with '" + answer.charAt(0).toUpperCase() + "'.";
  }

  function traceStoryMazePath(p) {
    const rows = Array.isArray(p && p.mazeLayout) ? p.mazeLayout : [];
    const trace = {
      row: 0,
      col: 0,
      exitRow: -1,
      exitCol: -1,
      invalid: false,
      validMoves: 0,
      totalMoves: Array.isArray(p && p.selected) ? p.selected.length : 0,
      visited: {},
    };
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || ".").toUpperCase();
        if (cell === "S") {
          trace.row = r;
          trace.col = c;
        }
        if (cell === "E") {
          trace.exitRow = r;
          trace.exitCol = c;
        }
      }
    }
    trace.visited[trace.row + ":" + trace.col] = true;
    (p.selected || []).forEach(function (step) {
      if (trace.invalid) return;
      const move = String(step || "").trim().toUpperCase();
      let nextRow = trace.row;
      let nextCol = trace.col;
      if (move === "U") nextRow -= 1;
      else if (move === "D") nextRow += 1;
      else if (move === "L") nextCol -= 1;
      else if (move === "R") nextCol += 1;
      else {
        trace.invalid = true;
        return;
      }
      const nextCell = String((((rows[nextRow] || [])[nextCol]) || "#")).toUpperCase();
      if (nextCell === "#") {
        trace.invalid = true;
        return;
      }
      trace.row = nextRow;
      trace.col = nextCol;
      trace.validMoves += 1;
      trace.visited[trace.row + ":" + trace.col] = true;
    });
    trace.reachedExit = !trace.invalid && trace.row === trace.exitRow && trace.col === trace.exitCol;
    return trace;
  }

  function rollStoryPuzzleClue() {
    const p = ensurePuzzleSession();
    if (!p || !p.sceneId || !p.optionId) return;
    const check = rollStoryCheck("mind", 6);
    if (!check.success) {
      if (typeof showNotif === "function") {
        showNotif("Clue roll failed: Mind d" + check.actionDie + "=" + check.action.total + " vs DD6=" + check.dread.total + ".", "warn");
      }
      return;
    }
    p.lastClue = clueTextForPuzzle(p) || "A useful clue emerges from the puzzle structure.";
    if (typeof showNotif === "function") {
      showNotif("Clue found: Mind d" + check.actionDie + "=" + check.action.total + " vs DD6=" + check.dread.total + ".", "good");
    }
    renderPuzzleModal();
  }

  function renderPuzzleModal() {
    const p = ensurePuzzleSession();
    let controls = "";

    if (p.mode === "tune") {
      const notes = ["DO", "RE", "MI", "FA", "SO", "LA", "TI"];
      controls = ""
        + "<div style='margin-bottom:.35rem;color:var(--muted2);font-size:.78rem;'>Current tune: <strong style='color:var(--teal);'>" + (p.selected.join("-") || "(empty)") + "</strong></div>"
        + "<div style='display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.45rem;'>"
        + notes.map(function (n) {
          return "<button class='btn btn-xs btn-teal' onclick='storyPuzzlePress(\"" + n + "\")'>" + n + "</button>";
        }).join("")
        + "</div>";
    } else if (p.mode === "memory") {
      controls = ""
        + "<div style='margin-bottom:.35rem;color:var(--muted2);font-size:.78rem;'>Memory track: <strong style='color:var(--teal);'>" + (p.selected.join(" → ") || "(empty)") + "</strong></div>"
        + "<div style='margin-bottom:.35rem;color:" + (p.revealed ? "var(--gold2)" : "var(--muted2)") + ";font-size:.76rem;'>"
        + (p.revealed ? ("Memorize: <strong>" + p.sequence.join(" • ") + "</strong>") : "Sequence hidden. Reveal it briefly, then rebuild it from memory.")
        + "</div>"
        + "<div style='display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.45rem;'>"
        + p.bank.map(function (token) {
          return "<button class='btn btn-xs btn-teal' onclick='storyPuzzlePress(\"" + String(token).replace(/"/g, "") + "\")'>" + token + "</button>";
        }).join("")
        + "</div>";
    } else if (p.mode === "rearrange") {
      controls = ""
        + "<div style='margin-bottom:.35rem;color:var(--muted2);font-size:.78rem;'>Arrange phrase: <strong style='color:var(--gold2);'>" + (p.selected.join(" ") || "(empty)") + "</strong></div>"
        + "<div style='display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.45rem;'>"
        + p.bank.map(function (word) {
          return "<button class='btn btn-xs' onclick='storyPuzzlePress(\"" + word.replace(/"/g, "") + "\")'>" + word + "</button>";
        }).join("")
        + "</div>";
    } else if (p.mode === "mosaic") {
      controls = ""
        + "<div style='margin-bottom:.35rem;color:var(--muted2);font-size:.78rem;'>Mosaic order: <strong style='color:var(--gold2);'>" + (p.selected.join(" ") || "(empty)") + "</strong></div>"
        + "<div style='display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.45rem;'>"
        + p.bank.map(function (tile) {
          return "<button class='btn btn-xs' style='min-width:76px;min-height:46px;font-family:Rajdhani,sans-serif;' onclick='storyPuzzlePress(\"" + String(tile).replace(/"/g, "") + "\")'>" + tile + "</button>";
        }).join("")
        + "</div>";
    } else if (p.mode === "crossword") {
      const crossword = p.crossword || buildStoryCrosswordFromClues(p.clues || []) || buildFallbackStoryCrossword();
      if (crossword) p.crossword = crossword;
      if (!crossword) {
        controls = ""
          + "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.35rem;'>Crossword grid currently unavailable. Regenerate puzzle context to continue.</div>";
      } else {
        const cells = [];
        for (let r = 0; r < crossword.rows; r++) {
          for (let c = 0; c < crossword.cols; c++) {
            const ch = ((crossword.gridTemplate[r] || "")[c] || "#").toUpperCase();
            if (ch === "#") {
              cells.push("<div style='width:32px;height:32px;background:#000;border:1px solid #111;'></div>");
            } else {
              const num = crossword.cellNums[r + ":" + c] || "";
              cells.push("<div style='position:relative;width:32px;height:32px;'>"
                + (num ? "<span style='position:absolute;top:1px;left:2px;font-size:7px;color:#111;line-height:1;pointer-events:none;z-index:1;'>" + num + "</span>" : "")
                + "<input id='storyCrossGrid_" + r + "_" + c + "' maxlength='1' class='input' style='width:32px;height:32px;text-align:center;padding:0;text-transform:uppercase;font-size:.82rem;background:#fff;color:#000;border:1px solid #111;' />"
                + "</div>");
            }
          }
        }
        const acrossHtml = crossword.across.map(function (entry) {
          return "<div style='display:grid;grid-template-columns:1.6rem 1fr;gap:.18rem;align-items:baseline;margin-bottom:.18rem;'>"
            + "<span style='font-size:.7rem;font-weight:700;color:#111;background:var(--text2);border-radius:2px;text-align:center;padding:0 .2rem;line-height:1.4;'>" + entry.number + "</span>"
            + "<span style='font-size:.74rem;color:var(--muted2);line-height:1.5;'>" + entry.clue + "</span>"
            + "</div>";
        }).join("") || "<div style='font-size:.74rem;color:var(--muted2);'>—</div>";
        const downHtml = crossword.down.map(function (entry) {
          return "<div style='display:grid;grid-template-columns:1.6rem 1fr;gap:.18rem;align-items:baseline;margin-bottom:.18rem;'>"
            + "<span style='font-size:.7rem;font-weight:700;color:#111;background:var(--text2);border-radius:2px;text-align:center;padding:0 .2rem;line-height:1.4;'>" + entry.number + "</span>"
            + "<span style='font-size:.74rem;color:var(--muted2);line-height:1.5;'>" + entry.clue + "</span>"
            + "</div>";
        }).join("") || "<div style='font-size:.74rem;color:var(--muted2);'>—</div>";
        controls = ""
          + "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.35rem;border-bottom:1px solid var(--border2);padding-bottom:.28rem;'>Fill every white square. Numbered cells mark word starts. Black squares are blocked.</div>"
          + "<div style='display:grid;grid-template-columns:repeat(" + crossword.cols + ",32px);gap:2px;justify-content:start;margin-bottom:.45rem;'>" + cells.join("") + "</div>"
          + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:.5rem;'>"
          + "<div><div style='font-family:\"Cinzel\",serif;font-size:.74rem;font-weight:700;color:var(--text2);letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid var(--text2);padding-bottom:.1rem;margin-bottom:.28rem;'>ACROSS</div>" + acrossHtml + "</div>"
          + "<div><div style='font-family:\"Cinzel\",serif;font-size:.74rem;font-weight:700;color:var(--text2);letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid var(--text2);padding-bottom:.1rem;margin-bottom:.28rem;'>DOWN</div>" + downHtml + "</div>"
          + "</div>";
      }
    } else if (p.mode === "crossword_grid") {
      const gridMeta = buildCrosswordGridMetadata(p);
      const templateRows = gridMeta.templateRows;
      const cells = [];
      for (let r = 0; r < gridMeta.rows; r++) {
        for (let c = 0; c < gridMeta.cols; c++) {
          const ch = (templateRows[r][c] || "#").toUpperCase();
          if (ch === "#") {
            cells.push("<div style='width:30px;height:30px;background:#000;border:1px solid #111;'></div>");
          } else {
            const num = gridMeta.cellNums[r + ":" + c];
            cells.push("<div style='position:relative;width:30px;height:30px;'>"
              + (num ? "<span style='position:absolute;top:1px;left:2px;font-size:7px;color:#111;line-height:1;pointer-events:none;z-index:1;'>" + num + "</span>" : "")
              + "<input id='storyGrid_" + r + "_" + c + "' maxlength='1' class='input' style='width:30px;height:30px;text-align:center;padding:0;text-transform:uppercase;font-size:.8rem;background:#fff;color:#000;border:1px solid #111;' />"
              + "</div>");
          }
        }
      }
      const rawClues = Array.isArray(p.clues) ? p.clues : [];
      const acrossClues = rawClues.filter(function (clue) {
        return crosswordClueDirection(clue) !== "down";
      });
      const downClues = rawClues.filter(function (clue) {
        return crosswordClueDirection(clue) === "down";
      });
      const renderClueList = function (entries, clues) {
        return entries.map(function (entry, idx) {
          const clue = clues[idx] || {};
          const clueText = cleanCrosswordGridClueText(clue.clue || clue.text || "");
          const answerLen = crosswordNormalizeAnswer(clue.answer || entry.answer || "").length || String(entry.answer || "").length || 0;
          const label = entry.number > 0 ? entry.number : (idx + 1);
          return "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.12rem;'>" + label + ". " + escapeHtml(clueText || "Cross-check entry") + (answerLen ? " (" + answerLen + ")" : "") + "</div>";
        }).join("");
      };
      const clueIntro = (gridMeta.acrossOnly && !downClues.length)
        ? "Grid crossword: fill all open cells. Across clues are numbered on the grid; intersections resolve the rest."
        : (gridMeta.downOnly && !acrossClues.length)
          ? "Grid crossword: fill all open cells. Down clues are numbered on the grid; intersections resolve the rest."
          : "Grid crossword: fill all open cells. Numbered cells start an Across or Down word.";
      let clueHtml = "";
      if (acrossClues.length) {
        clueHtml += "<div style='font-family:\"Cinzel\",serif;font-size:.7rem;font-weight:700;color:var(--text2);letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid var(--text2);padding-bottom:.1rem;margin:.18rem 0 .28rem;'>Across</div>"
          + renderClueList(gridMeta.across, acrossClues);
      }
      if (downClues.length) {
        clueHtml += "<div style='font-family:\"Cinzel\",serif;font-size:.7rem;font-weight:700;color:var(--text2);letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid var(--text2);padding-bottom:.1rem;margin:.28rem 0 .28rem;'>Down</div>"
          + renderClueList(gridMeta.down, downClues);
      }
      if (!clueHtml) {
        clueHtml = rawClues.map(function (clue, idx) {
          return "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.12rem;'>" + (idx + 1) + ". " + escapeHtml(cleanCrosswordGridClueText(clue && clue.clue || "")) + "</div>";
        }).join("");
      }
      controls = ""
        + "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.35rem;'>" + clueIntro + " # blocks are locked.</div>"
        + "<div style='display:grid;grid-template-columns:repeat(" + gridMeta.cols + ",28px);gap:2px;justify-content:start;margin-bottom:.45rem;'>" + cells.join("") + "</div>"
        + clueHtml;
    } else if (p.mode === "maze") {
      const trace = traceStoryMazePath(p);
      const cells = [];
      for (let r = 0; r < p.mazeRows; r++) {
        for (let c = 0; c < p.mazeCols; c++) {
          const raw = String((((p.mazeLayout[r] || [])[c]) || ".")).toUpperCase();
          const isWall = raw === "#";
          const key = r + ":" + c;
          const isTrail = !!trace.visited[key] && !isWall && raw !== "S" && raw !== "E";
          const bg = isWall ? "var(--surface2)" : (raw === "S" ? "rgba(70,196,182,.18)" : raw === "E" ? "rgba(240,208,112,.18)" : isTrail ? "rgba(126,215,255,.14)" : "rgba(255,255,255,.03)");
          const border = isWall ? "var(--border2)" : (key === trace.row + ":" + trace.col ? "#7ed7ff" : raw === "E" ? "#f0d070" : raw === "S" ? "#46c4b6" : "rgba(255,255,255,.08)");
          const glyph = isWall ? "" : (raw === "S" ? "S" : raw === "E" ? "E" : (key === trace.row + ":" + trace.col ? "●" : (isTrail ? "•" : "")));
          const color = raw === "E" ? "#f0d070" : raw === "S" ? "#46c4b6" : "#9de7ff";
          cells.push("<div style='width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:" + bg + ";border:1px solid " + border + ";font-family:Rajdhani,sans-serif;font-weight:700;color:" + color + ";'>" + glyph + "</div>");
        }
      }
      controls = ""
        + "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.35rem;'>Route: <strong style='color:var(--teal);'>" + (p.selected.join("-") || "(empty)") + "</strong>" + (trace.invalid ? " <span style='color:var(--red2);'>(hit wall)</span>" : "") + "</div>"
        + "<div style='display:grid;grid-template-columns:repeat(" + p.mazeCols + ",30px);gap:2px;justify-content:start;margin-bottom:.45rem;'>" + cells.join("") + "</div>"
        + "<div style='display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.45rem;'>"
        + ["U", "R", "D", "L"].map(function (dir) {
          const label = dir === "U" ? "Up" : dir === "R" ? "Right" : dir === "D" ? "Down" : "Left";
          return "<button class='btn btn-xs btn-teal' onclick='storyPuzzlePress(\"" + dir + "\")'>" + label + "</button>";
        }).join("")
        + "</div>";
    } else if (p.mode === "sudoku") {
      const cells = [];
      for (let r = 0; r < p.sudokuSize; r++) {
        for (let c = 0; c < p.sudokuSize; c++) {
          const given = String((((p.sudokuPuzzle[r] || [])[c]) || "")).trim();
          const borderStyle = "border:1px solid rgba(255,255,255,.12);" + (c % 2 === 0 ? "border-left:2px solid rgba(232,192,80,.35);" : "") + (r % 2 === 0 ? "border-top:2px solid rgba(232,192,80,.35);" : "") + (c === p.sudokuSize - 1 ? "border-right:2px solid rgba(232,192,80,.35);" : "") + (r === p.sudokuSize - 1 ? "border-bottom:2px solid rgba(232,192,80,.35);" : "");
          if (given) {
            cells.push("<div style='width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);" + borderStyle + "font-family:Rajdhani,sans-serif;font-weight:700;color:var(--gold2);'>" + given + "</div>");
          } else {
            cells.push("<input id='storySudoku_" + r + "_" + c + "' maxlength='1' inputmode='numeric' class='input' style='width:34px;height:34px;text-align:center;padding:0;font-family:Rajdhani,sans-serif;" + borderStyle + "'/>");
          }
        }
      }
      controls = ""
        + "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.35rem;'>Mini Sudoku: each row, column, and 2x2 box must contain 1-" + p.sudokuSize + ".</div>"
        + "<div style='display:grid;grid-template-columns:repeat(" + p.sudokuSize + ",34px);gap:0;justify-content:start;margin-bottom:.45rem;background:rgba(6,8,16,.5);padding:4px;width:max-content;'>" + cells.join("") + "</div>";
    } else {
      controls = ""
        + "<input id='storyPuzzleInput' class='input' placeholder='Type your decoded answer' style='width:100%;margin-bottom:.45rem;'/>";
    }

    const tier = p.externalThresholds || puzzleTierForScene(p.sceneId);

    const html = ""
      + "<div style='font-size:.84rem;color:var(--text2);line-height:1.6;margin-bottom:.4rem;'>" + p.prompt + "</div>"
      + "<div style='font-size:.72rem;color:var(--muted2);margin-bottom:.35rem;'>Difficulty: " + tier.label + "  |  Full success ≥ " + Math.round(tier.success * 100) + "%  |  Partial ≥ " + Math.round(tier.partial * 100) + "%</div>"
      + (p.lastClue ? ("<div style='font-size:.74rem;color:var(--gold2);margin-bottom:.35rem;border:1px solid rgba(201,162,39,.4);background:rgba(201,162,39,.08);padding:.3rem .42rem;'><strong>Clue:</strong> " + p.lastClue + "</div>") : "")
      + controls
      + "<div style='display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;'>"
      + (p.mode === "memory" ? "<button class='btn btn-sm btn-teal' onclick='storyPuzzleReveal()'>Reveal Sequence</button>" : "")
      + "<button class='btn btn-sm btn-teal' onclick='storyPuzzleRollForClue()'>Roll for Clue (Mind vs DD6)</button>"
      + "<button class='btn btn-sm' onclick='storyPuzzleClear()'>Reset</button>"
      + "<button class='btn btn-sm btn-red' onclick='storyPuzzleResolve(false)'>Force Through (Fail)</button>"
      + "<button class='btn btn-sm btn-primary' onclick='storyPuzzleResolve(true)'>Submit</button>"
      + "</div>";

    if (typeof openModal === "function") openModal(p.title || "Story Puzzle", html);
  }

  function startStoryPuzzle(sceneId, option) {
    const p = ensurePuzzleSession();
    const puzzle = option && option.puzzle ? option.puzzle : null;
    if (!puzzle) return;

    p.sceneId = sceneId;
    p.optionId = option.id;
    p.mode = puzzle.mode || "code";
    p.title = puzzle.title || "Story Puzzle";
    p.prompt = puzzle.prompt || "";
    p.answer = String(puzzle.answer || "").trim().toLowerCase();
    p.sequence = Array.isArray(puzzle.sequence) ? puzzle.sequence.slice() : [];
    p.selected = [];
    p.bank = Array.isArray(puzzle.bank) ? puzzle.bank.slice() : [];
    p.clues = Array.isArray(puzzle.clues) ? puzzle.clues.slice() : [];
    p.gridTemplate = Array.isArray(puzzle.gridTemplate) ? puzzle.gridTemplate.slice() : [];
    p.gridRows = Number(puzzle.gridRows || p.gridTemplate.length || 0);
    p.gridCols = Number(puzzle.gridCols || (p.gridTemplate[0] ? p.gridTemplate[0].length : 0));
    p.mazeLayout = Array.isArray(puzzle.mazeLayout) ? puzzle.mazeLayout.map(function (row) { return Array.isArray(row) ? row.slice() : String(row || "").split(""); }) : [];
    p.mazeRows = Number(puzzle.mazeRows || p.mazeLayout.length || 0);
    p.mazeCols = Number(puzzle.mazeCols || (p.mazeLayout[0] ? p.mazeLayout[0].length : 0));
    p.sudokuPuzzle = Array.isArray(puzzle.sudokuPuzzle) ? puzzle.sudokuPuzzle.map(function (row) { return Array.isArray(row) ? row.slice() : []; }) : [];
    p.sudokuSolution = Array.isArray(puzzle.sudokuSolution) ? puzzle.sudokuSolution.map(function (row) { return Array.isArray(row) ? row.slice() : []; }) : [];
    p.sudokuSize = Number(puzzle.sudokuSize || p.sudokuSolution.length || p.sudokuPuzzle.length || 0);
    p.typed = "";
    p.lastClue = "";
    p.revealed = false;
    p.crossword = (p.mode === "crossword") ? (buildStoryCrosswordFromClues(p.clues || []) || buildFallbackStoryCrossword()) : null;
    if (p.mode === "memory" && !p.bank.length) {
      p.bank = Array.from(new Set(p.sequence));
    }

    renderPuzzleModal();
  }

  function openStandaloneStoryPuzzle(config) {
    const p = ensurePuzzleSession();
    p.sceneId = "__external__";
    p.optionId = "__external__";
    p.mode = config.mode || "code";
    p.title = config.title || "Story Puzzle";
    p.prompt = config.prompt || "";
    p.answer = String(config.answer || "").trim().toLowerCase();
    p.sequence = Array.isArray(config.sequence) ? config.sequence.slice() : [];
    p.selected = [];
    p.bank = Array.isArray(config.bank) ? config.bank.slice() : [];
    p.clues = Array.isArray(config.clues) ? config.clues.slice() : [];
    p.gridTemplate = Array.isArray(config.gridTemplate) ? config.gridTemplate.slice() : [];
    p.gridRows = Number(config.gridRows || p.gridTemplate.length || 0);
    p.gridCols = Number(config.gridCols || (p.gridTemplate[0] ? p.gridTemplate[0].length : 0));
    p.mazeLayout = Array.isArray(config.mazeLayout) ? config.mazeLayout.map(function (row) { return Array.isArray(row) ? row.slice() : String(row || "").split(""); }) : [];
    p.mazeRows = Number(config.mazeRows || p.mazeLayout.length || 0);
    p.mazeCols = Number(config.mazeCols || (p.mazeLayout[0] ? p.mazeLayout[0].length : 0));
    p.sudokuPuzzle = Array.isArray(config.sudokuPuzzle) ? config.sudokuPuzzle.map(function (row) { return Array.isArray(row) ? row.slice() : []; }) : [];
    p.sudokuSolution = Array.isArray(config.sudokuSolution) ? config.sudokuSolution.map(function (row) { return Array.isArray(row) ? row.slice() : []; }) : [];
    p.sudokuSize = Number(config.sudokuSize || p.sudokuSolution.length || p.sudokuPuzzle.length || 0);
    p.typed = "";
    p.lastClue = "";
    p.revealed = false;
    p.externalResolve = typeof config.onResolve === "function" ? config.onResolve : null;
    p.externalThresholds = {
      label: config.thresholdLabel || "Standalone",
      success: Number(config.successThreshold || 0.7),
      partial: Number(config.partialThreshold || 0.45)
    };
    p.crossword = (p.mode === "crossword") ? (buildStoryCrosswordFromClues(p.clues || []) || buildFallbackStoryCrossword()) : null;
    if (p.mode === "memory" && !p.bank.length) {
      p.bank = Array.from(new Set(p.sequence));
    }
    renderPuzzleModal();
  }

  function puzzleSuccessByInput() {
    const p = ensurePuzzleSession();
    if (p.mode === "tune") {
      return p.selected.join("-").trim().toLowerCase() === p.sequence.join("-").trim().toLowerCase();
    }
    if (p.mode === "memory") {
      return p.selected.join("|").trim().toLowerCase() === p.sequence.join("|").trim().toLowerCase();
    }
    if (p.mode === "rearrange") {
      return p.selected.join(" ").trim().toLowerCase() === p.answer;
    }
    if (p.mode === "mosaic") {
      return p.selected.join(" ").trim().toLowerCase() === p.answer;
    }
    if (p.mode === "crossword") {
      if (p.crossword && Array.isArray(p.crossword.gridTemplate)) {
        return scoreCrosswordGrid(p) >= 0.999;
      }
      return p.clues.every(function (c, i) {
        const el = document.getElementById("storyCross_" + i);
        const val = (el && typeof el.value === "string") ? el.value.trim().toLowerCase() : "";
        return val === String(c.answer || "").trim().toLowerCase();
      });
    }
    if (p.mode === "maze") {
      const trace = traceStoryMazePath(p);
      if (trace.reachedExit) return true;
      return p.selected.join("-").trim().toLowerCase() === String(p.answer || "").trim().toLowerCase();
    }
    if (p.mode === "sudoku") {
      for (let r = 0; r < p.sudokuSize; r++) {
        for (let c = 0; c < p.sudokuSize; c++) {
          const given = String((((p.sudokuPuzzle[r] || [])[c]) || "")).trim();
          const expected = String((((p.sudokuSolution[r] || [])[c]) || "")).trim();
          if (given || !expected) continue;
          const el = document.getElementById("storySudoku_" + r + "_" + c);
          const typed = (el && typeof el.value === "string") ? el.value.trim() : "";
          if (typed !== expected) return false;
        }
      }
      return true;
    }
    const el = document.getElementById("storyPuzzleInput");
    const val = (el && typeof el.value === "string") ? el.value.trim().toLowerCase() : "";
    return val === p.answer;
  }

  function openStorylineManualRollPrompt(sceneId, option, actionDie, dreadDie, onResolve) {
    if (typeof openModal !== "function") return false;
    const statLabel = (STAT_LABELS && STAT_LABELS[option.stat]) ? STAT_LABELS[option.stat] : String(option.stat || "Stat").toUpperCase();
    const statKey = String(option && option.stat || '').toLowerCase();
    const modifierLines = (typeof window !== 'undefined' && typeof window.buildManualRollModifierLines === 'function')
      ? (window.buildManualRollModifierLines(statKey, actionDie, { extraLines: ['Enter final totals after applying all listed modifiers.'] }) || [])
      : [];
    const modifierHtml = modifierLines.length
      ? '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;line-height:1.5;">' + modifierLines.map(function(p){ return '<div>• ' + p + '</div>'; }).join('') + '</div>'
      : '';
    window._pendingStorylineManualRoll = { resolver: typeof onResolve === "function" ? onResolve : null, actionDie: actionDie, dreadDie: dreadDie };
    const html = ""
      + "<div style='font-size:.84rem;color:var(--text2);line-height:1.6;'>"
      + "<div style='font-family:Cinzel,serif;font-size:.76rem;letter-spacing:.08em;color:var(--gold2);margin-bottom:.24rem;'>Manual Story Roll</div>"
      + "<div style='font-size:.78rem;color:var(--text2);margin-bottom:.06rem;font-style:italic;'>\"" + String(option.text || "").slice(0, 80) + "\"</div>"
      + "<div style='margin-top:.2rem;'><strong>" + statLabel + " d" + actionDie + "</strong> vs <strong style='color:var(--red2);'>Dread d" + dreadDie + "</strong></div>"
      + "<div style='font-size:.85rem;color:var(--muted2);margin-top:.3rem;'>Enter your physical dice results below. Apply all modifiers shown.</div>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:.32rem;margin-top:.4rem;'>"
      + "<div><div style='font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;'>" + statLabel + " d" + actionDie + "</div>"
      + "<input type='text' inputmode='text' id='storyManualActionValue' placeholder='e.g. 8+7' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;'></div>"
      + "<div><div style='font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;'>Dread d" + dreadDie + "</div>"
      + "<input type='text' inputmode='text' id='storyManualDreadValue' placeholder='e.g. 7+3+1' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;'></div>"
      + "</div>"
      + modifierHtml
      + "<div style='display:flex;gap:.26rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.46rem;'>"
      + "<button class='btn btn-sm' onclick='closeModal()'>Cancel</button>"
      + "<button class='btn btn-sm' onclick='window.resolveStorylineManualRoll(\"compare\")'>Compare</button>"
      + "<button class='btn btn-sm btn-primary' onclick='window.resolveStorylineManualRoll(\"success\")'>Success</button>"
      + "<button class='btn btn-sm btn-red' onclick='window.resolveStorylineManualRoll(\"failure\")'>Failure</button>"
      + "</div>"
      + "</div>";
    openModal("Manual Roll — Story Check", html);
    return true;
  }

  window.resolveStorylineManualRoll = function (mode) {
    const pending = window._pendingStorylineManualRoll || null;
    if (!pending) return;
    const actionInput = document.getElementById("storyManualActionValue");
    const dreadInput = document.getElementById("storyManualDreadValue");
    const actionValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === "function") ? window.BTLRules.readManualTotal(actionInput, 1) : parseInt(actionInput && actionInput.value, 10);
    const dreadValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === "function") ? window.BTLRules.readManualTotal(dreadInput, 1) : parseInt(dreadInput && dreadInput.value, 10);
    const modeKey = String(mode || "compare").toLowerCase();
    if (modeKey === "compare") {
      if (!Number.isFinite(actionValue) || !Number.isFinite(dreadValue)) {
        if (typeof showNotif === "function") showNotif("Enter both dice totals first, e.g. 8+7.", "warn");
        return;
      }
      if (actionValue < 1 || dreadValue < 1) {
        if (typeof showNotif === "function") showNotif("Dice totals must be 1 or higher.", "warn");
        return;
      }
    }
    const resolvedActionValue = Number.isFinite(actionValue) ? actionValue : 1;
    const resolvedDreadValue = Number.isFinite(dreadValue) ? dreadValue : 1;
    const success = modeKey === "success" ? true : (modeKey === "failure" ? false : (resolvedActionValue >= resolvedDreadValue));
    window._pendingStorylineManualRoll = null;
    if (typeof closeModal === "function") closeModal();
    if (typeof pending.resolver === "function") {
      pending.resolver({ success: success, actionTotal: resolvedActionValue, dreadTotal: resolvedDreadValue, manual: true, mode: modeKey });
    }
  };

  function resolveStoryOption(sceneId, option, forcedResult, decisionMeta) {
    if (typeof ensureTheosProvinceScenes === "function") ensureTheosProvinceScenes();
    const st = ensureStoryState();
    if (!st || !option) return;

    if (!st.history.sceneVisits || typeof st.history.sceneVisits !== "object") st.history.sceneVisits = {};
    if (!st.history.optionsTaken || typeof st.history.optionsTaken !== "object") st.history.optionsTaken = {};
    st.history.sceneVisits[sceneId] = Number(st.history.sceneVisits[sceneId] || 0) + 1;
    st.history.optionsTaken[sceneId + ":" + option.id] = Number(st.history.optionsTaken[sceneId + ":" + option.id] || 0) + 1;

    if (!hasReq(option.req)) {
      if (typeof showNotif === "function") showNotif("This dialogue path is locked by your history, rank, or season.", "warn");
      return;
    }

    doJump(option.jump);

    let checkResult = null;
    let outcome = option.success;
    const factionContext = inferOptionFactionKey(option);
    st.activeFactionKey = factionContext || "";

    if (option.stat && forcedResult !== "success" && forcedResult !== "fail" && forcedResult !== "partial") {
      const dd = getOptionDread(sceneId, option);
      const resolvedDecisionMeta = decisionMeta || getDecisionAssignment(sceneId, option.id);
      const actionDie = getAssignedWayfarerActionDie(option.stat, resolvedDecisionMeta);

      if (typeof isManualRollModeEnabled === "function" && isManualRollModeEnabled()) {
        openStorylineManualRollPrompt(sceneId, option, actionDie, dd, function (manualOutcome) {
          const syntheticResult = rollStoryCheck(option.stat, dd, factionContext, resolvedDecisionMeta);
          syntheticResult.action = { total: Number(manualOutcome.actionTotal || 1), exploded: false };
          syntheticResult.dread = { total: Number(manualOutcome.dreadTotal || 1), exploded: false };
          syntheticResult.effectiveTotal = Number(manualOutcome.actionTotal || 1) + Math.max(0, syntheticResult.factionBonus || 0) + Math.max(0, syntheticResult.flavorBonus || 0) + Math.max(0, syntheticResult.campaignBonus || 0) + Math.max(0, syntheticResult.regionalBonus || 0);
          syntheticResult.success = manualOutcome.mode === "success" ? true : (manualOutcome.mode === "failure" ? false : (syntheticResult.effectiveTotal >= syntheticResult.dread.total));
          syntheticResult.manual = true;
          if (!syntheticResult.success) {
            window._pendingStoryRoll = { sceneId: sceneId, option: option, checkResult: syntheticResult, dreadDie: dd, factionContext: factionContext, decisionMeta: resolvedDecisionMeta };
            renderStoryRollModal(sceneId, option, syntheticResult, dd);
            return;
          }
          const successOutcome = normalizeOutcome(sceneId, option, option.success, "resolved");
          applyOutcome(sceneId, option, successOutcome, syntheticResult, resolvedDecisionMeta);
          renderStorylinePanel();
        });
        return;
      }

      checkResult = rollStoryCheck(option.stat, dd, factionContext, resolvedDecisionMeta);
      if (!checkResult.success) {
        window._pendingStoryRoll = { sceneId: sceneId, option: option, checkResult: checkResult, dreadDie: dd, factionContext: factionContext, decisionMeta: resolvedDecisionMeta };
        renderStoryRollModal(sceneId, option, checkResult, dd);
        return;
      }
      outcome = option.success;
    } else if (forcedResult === "fail") {
      outcome = option.fail || option.success;
    } else if (forcedResult === "partial") {
      outcome = option.partial || option.fail || option.success;
    } else if (forcedResult === "success") {
      outcome = option.success;
    }

    outcome = normalizeOutcome(sceneId, option, outcome, forcedResult || "normal");

    applyOutcome(sceneId, option, outcome, checkResult, decisionMeta || getDecisionAssignment(sceneId, option.id));
    renderStorylinePanel();
  }

  function renderStoryRollModal(sceneId, option, checkResult, dreadDie) {
    if (typeof openModal !== "function") return;
    const pushDread = typeof stepUp === "function" ? stepUp(dreadDie) : Math.min(20, dreadDie + 2);
    const currentTeamwork = (typeof S !== "undefined" && typeof S.tmw === "number") ? S.tmw : 0;
    const canSpend = currentTeamwork >= 3;
    const gmMode = !!(window.settingsSystem && typeof window.settingsSystem.isGMMode === "function" && window.settingsSystem.isGMMode());
    const revealDC = !window.settingsSystem || typeof window.settingsSystem.shouldRevealDC !== "function" ? true : !!window.settingsSystem.shouldRevealDC();
    const revealHidden = !window.settingsSystem || typeof window.settingsSystem.shouldRevealHiddenInfo !== "function" ? true : !!window.settingsSystem.shouldRevealHiddenInfo();
    const statName = STAT_LABELS[option.stat] || option.stat;
    const assignee = String(checkResult.assigneeName || 'Wayfarer');
    const bonus = Number(checkResult.factionBonus || 0);
    const flavorBonus = Number(checkResult.flavorBonus || 0);
    const aggregateBonus = Math.max(0, bonus) + Math.max(0, flavorBonus);
    const actionTotalLabel = aggregateBonus > 0
      ? (checkResult.action.total + " + " + aggregateBonus + " = " + checkResult.effectiveTotal)
      : String(checkResult.action.total);
    const html = ""
      + "<div style='text-align:center;font-family:Cinzel,serif;font-size:1.05rem;color:#ff6060;margin-bottom:.6rem;letter-spacing:.08em;'>✗ FAILED ROLL</div>"
      + "<div style='display:flex;justify-content:center;gap:1.5rem;margin-bottom:.65rem;'>"
      + "<div style='text-align:center;'>"
      + "<div style='font-size:.7rem;color:var(--muted2);margin-bottom:.2rem;'>" + assignee + "  |  " + statName + " d" + checkResult.actionDie + "</div>"
      + "<div style='font-size:2.1rem;font-weight:700;color:var(--text2);'>" + (revealHidden ? actionTotalLabel : "?") + "</div>"
      + "</div>"
      + "<div style='text-align:center;padding-top:.65rem;font-size:1.3rem;color:var(--muted2);'>vs</div>"
      + "<div style='text-align:center;'>"
      + "<div style='font-size:.7rem;color:var(--muted2);margin-bottom:.2rem;'>" + (revealDC ? ("Dread D" + dreadDie) : "Dread Hidden") + "</div>"
      + "<div style='font-size:2.1rem;font-weight:700;color:#e05050;'>" + (revealHidden ? checkResult.dread.total : "?") + "</div>"
      + "</div>"
      + "</div>"
      + "<div style='font-size:.79rem;color:var(--text2);margin-bottom:.55rem;text-align:center;font-style:italic;'>\"" + option.text + "\"</div>"
      + (bonus > 0 && revealHidden
        ? ("<div style='font-size:.74rem;color:var(--gold2);text-align:center;margin-bottom:.45rem;'>Faction bonus: +" + bonus + " from " + (FACTION_LABELS[checkResult.factionKey] || checkResult.factionKey) + " renown.</div>")
        : "")
      + (flavorBonus > 0 && revealHidden
        ? ("<div style='font-size:.74rem;color:var(--teal);text-align:center;margin-bottom:.45rem;'>Personal Flavor bonus: +" + flavorBonus + "</div>")
        : "")
      + "<div style='background:rgba(255,96,96,.06);border:1px solid rgba(255,96,96,.25);padding:.45rem .55rem;border-radius:4px;margin-bottom:.55rem;'>"
      + "<div style='font-size:.76rem;font-family:Cinzel,serif;color:var(--gold2);margin-bottom:.25rem;'>Choose Your Response</div>"
      + "<div style='font-size:.77rem;color:var(--text2);line-height:1.6;'>"
      + "<strong style='color:var(--teal);'>Accept:</strong> Take the setback, advance story, earn <strong style='color:var(--teal);'>+1 Teamwork Point</strong>.<br>"
      + "<strong style='color:#c9a227;'>Spend 3 Teamwork:</strong> Convert fail to success. You have <strong style='color:var(--teal);'>" + currentTeamwork + " Teamwork</strong>.<br>"
      + "<strong style='color:#f0a050;'>Push Your Luck:</strong> Re-roll vs <strong style='color:#f0a050;'>Dread D" + pushDread + "</strong>. Win = success streak. Lose = accept fail (+1 Teamwork)."
      + "</div>"
      + "</div>"
      + "<div style='display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;'>"
      + "<button class='btn btn-sm' onclick='storyAcceptFail()'>Accept (+1 Teamwork)</button>"
      + "<button class='btn btn-sm btn-teal' " + (canSpend ? "" : "disabled title='Need 3 Teamwork'") + " onclick='storySpendTeamwork()'>Spend 3 Teamwork → Succeed</button>"
      + "<button class='btn btn-sm' style='background:rgba(240,160,80,.18);border-color:rgba(240,160,80,.5);color:#f0a050;' onclick='storyPushLuck()'>Push Luck (D" + pushDread + ")</button>"
      + "</div>";
    if (gmMode) {
      html += "<div style='margin-top:.55rem;background:rgba(128,96,192,.08);border:1px solid rgba(128,96,192,.35);padding:.4rem .5rem;'>"
        + "<div style='font-family:Cinzel,serif;font-size:.56rem;letter-spacing:.1em;color:var(--purple);text-transform:uppercase;margin-bottom:.25rem;'>GM Controls</div>"
        + "<div style='display:flex;gap:.3rem;flex-wrap:wrap;'>"
        + "<button class='btn btn-xs' style='border-color:var(--purple);color:var(--purple);' onclick='window.storyAdjustOptionDread(\"" + sceneId + "\",\"" + option.id + "\",-1)'>Dread -</button>"
        + "<button class='btn btn-xs' style='border-color:var(--purple);color:var(--purple);' onclick='window.storyAdjustOptionDread(\"" + sceneId + "\",\"" + option.id + "\",1)'>Dread +</button>"
        + "<button class='btn btn-xs btn-primary' onclick='closeModal();runStoryOption(\"" + sceneId + "\",\"" + option.id + "\",\"success\")'>GM: Force Success</button>"
        + "<button class='btn btn-xs btn-red' onclick='closeModal();runStoryOption(\"" + sceneId + "\",\"" + option.id + "\",\"fail\")'>GM: Force Fail</button>"
        + "</div>"
        + "<div style='font-size:.66rem;color:var(--muted2);margin-top:.22rem;'>Scene Dread: " + (revealDC ? ("d" + dreadDie) : "hidden") + "</div>"
        + "</div>";
    }
    openModal("Story Roll: " + option.text.slice(0, 50), html);
  }

  function seedNumber(seedTag) {
    const nums = String(seedTag || "").replace(/\D/g, "");
    return Number(nums || 0);
  }

  function sceneVariantText(scene, st) {
    if (!scene || !Array.isArray(scene.variants) || !scene.variants.length) return "";

    const eligible = scene.variants.filter(function (variant) {
      return hasReq(variant && variant.when ? variant.when : null);
    });
    if (!eligible.length) return "";

    const seed = seedNumber(st.seedTag);
    const lyra = Number(st.npc.lyra || 0);
    const mara = Number(st.npc.mara || 0);
    const iosef = Number(st.npc.iosef || 0);
    const bias = Math.max(0, lyra + mara + iosef);
    const index = (seed + bias + Number(st.log.length || 0)) % eligible.length;
    return String((eligible[index] && eligible[index].text) || "");
  }

  function doJump(jump) {
    if (!jump) return;
    if (jump.setAge) {
      S.currentAge = jump.setAge;
      if (typeof setAge === "function") setAge(jump.setAge);
    }
    if (jump.setSeason) {
      S.currentSeason = jump.setSeason;
      if (typeof setSeason === "function") setSeason(jump.setSeason);
    }
    if (jump.advanceDays && typeof advanceDay === "function") {
      advanceDay(Number(jump.advanceDays || 0));
    }
    if (jump.context && typeof setContext === "function") {
      setContext(jump.context);
    }
    if (jump.tab && typeof switchTab === "function") {
      const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('" + jump.tab + "'\"]");
      switchTab(jump.tab, btn || null);
    }
  }

  function nearestStoryDread(raw) {
    var allowed = [4, 6, 8, 10, 12, 20];
    var value = Math.max(4, Number(raw || 8));
    var best = allowed[0];
    var delta = Math.abs(allowed[0] - value);
    allowed.forEach(function (die) {
      var d = Math.abs(die - value);
      if (d < delta) {
        best = die;
        delta = d;
      }
    });
    return best;
  }

  function getTheosStorylineModifierSafe() {
    if (typeof window === "undefined" || typeof window.getTheosStorylineModifier !== "function") {
      return { dreadShift: 0, rollBonus: 0, tone: "" };
    }
    try {
      return window.getTheosStorylineModifier() || { dreadShift: 0, rollBonus: 0, tone: "" };
    } catch (_err) {
      return { dreadShift: 0, rollBonus: 0, tone: "" };
    }
  }

  function getOptionDread(sceneId, option) {
    const st = ensureStoryState();
    const key = sceneId + ":" + option.id;
    const stored = Number(st.optionDread[key] || 0);
    const base = Number(option.baseDread || 0);
    var theos = getTheosStorylineModifierSafe();
    var raw = stored || base || 8;
    return nearestStoryDread(raw + Number(theos.dreadShift || 0));
  }

  function setOptionDread(sceneId, optionId, die) {
    const st = ensureStoryState();
    st.optionDread[sceneId + ":" + optionId] = die;
  }

  function adjustStoryOptionDread(sceneId, optionId, dir) {
    const gmMode = !!(window.settingsSystem && typeof window.settingsSystem.isGMMode === "function" && window.settingsSystem.isGMMode());
    if (!gmMode) {
      if (typeof showNotif === "function") showNotif("GM controls are only available in GM mode.", "warn");
      return;
    }
    const scene = SCENES[sceneId];
    if (!scene || !Array.isArray(scene.options)) return;
    const option = scene.options.find(function (opt) { return opt && opt.id === optionId; });
    if (!option) return;
    const current = Number(getOptionDread(sceneId, option) || 8);
    const next = dir > 0 ? stepUp(current) : stepDown(current);
    setOptionDread(sceneId, optionId, next);
    if (typeof showNotif === "function") showNotif("GM Dread set to d" + next + " for this story check.", "good");
    if (window._pendingStoryRoll && window._pendingStoryRoll.sceneId === sceneId && window._pendingStoryRoll.option && window._pendingStoryRoll.option.id === optionId) {
      window._pendingStoryRoll.dreadDie = next;
    }
    renderStorylinePanel();
  }

  function rollStoryCheck(statKey, dreadDie, factionKey, decisionMeta) {
    const actionDie = getAssignedWayfarerActionDie(statKey, decisionMeta);
    const a = (typeof explodingRoll === "function") ? explodingRoll(actionDie) : { total: Math.floor(Math.random() * actionDie) + 1, exploded: false };
    const d = (typeof explodingRoll === "function") ? explodingRoll(dreadDie) : { total: Math.floor(Math.random() * dreadDie) + 1, exploded: false };
    const relicRolls = (typeof window.getPermanentValorBonusRolls === "function")
      ? window.getPermanentValorBonusRolls(statKey, "Story Relic")
      : ((typeof window.getPermanentAdventureBonusRolls === "function") ? window.getPermanentAdventureBonusRolls(statKey, "Story Relic") : []);
    const relicTotal = (typeof window.sumValorBonusRolls === "function")
      ? window.sumValorBonusRolls(relicRolls)
      : ((typeof window.sumAdventureBonusRolls === "function") ? window.sumAdventureBonusRolls(relicRolls) : 0);
    const campaignBonus = Math.max(0, Math.floor(getStoryModifierValue("storyRollBonus")));
    const bonus = (typeof window.getFactionStoryRollBonus === "function" && factionKey)
      ? Number(window.getFactionStoryRollBonus(factionKey, statKey) || 0)
      : 0;
    let flavorBonus = 0;
    try {
      if (typeof window.getPersonalFlavorMechanicProfile === "function") {
        const profile = window.getPersonalFlavorMechanicProfile((S && S.flavor) || "");
        if (profile) {
          if (profile.infernalEyes && statKey === "lead") flavorBonus += 1;
          if (profile.telepathic && (statKey === "lead" || statKey === "mind" || statKey === "spirit")) flavorBonus += 1;
          if (profile.beastForm && (statKey === "control" || statKey === "body")) flavorBonus += 1;
          if (profile.holyShield && statKey === "defend") flavorBonus += 1;
          if (profile.antiRad && (statKey === "mind" || statKey === "spirit")) flavorBonus += 1;
            if (profile.timeSight && (statKey === "control" || statKey === "mind" || statKey === "spirit")) flavorBonus += 1;
            if (profile.corpseMemory && (statKey === "mind" || statKey === "spirit")) flavorBonus += 1;
            if (profile.disguiseShift && (statKey === "lead" || statKey === "control")) flavorBonus += 1;
            if (profile.luckyReroll && statKey === "valor") flavorBonus += 1;
        }
      }
    } catch (_err) { console.error(_err); }
    var theos = getTheosStorylineModifierSafe();
    var regionBonus = Math.max(0, Number(theos.rollBonus || 0));
    const effectiveTotal = Number(a.total || 0) + Math.max(0, bonus) + relicTotal + campaignBonus + Math.max(0, flavorBonus) + regionBonus;
    return {
      success: effectiveTotal >= d.total,
      actionDie: actionDie,
      dreadDie: dreadDie,
      action: a,
      dread: d,
      factionKey: factionKey || "",
      factionBonus: Math.max(0, bonus),
      campaignBonus: campaignBonus,
      flavorBonus: Math.max(0, flavorBonus),
      regionalBonus: regionBonus,
      regionalTone: String(theos.tone || ""),
      effectiveTotal: effectiveTotal,
      assigneeName: decisionMeta && decisionMeta.assigneeName ? String(decisionMeta.assigneeName) : 'Wayfarer',
      rollSource: decisionMeta && decisionMeta.assigneeId ? String(decisionMeta.assigneeId) : 'local:self',
    };
  }

  function markLessonProgress(scene) {
    const st = ensureStoryState();
    (scene.lessons || []).forEach(function (id) {
      if (st.completedSystems.indexOf(id) < 0) st.completedSystems.push(id);
    });
  }

  function pushLog(entry) {
    const st = ensureStoryState();
    st.log.unshift(entry);
    st.log = st.log.slice(0, 18);
  }

  function recordSuccessRoll() {
    if (typeof S === "undefined") return;
    if (window.BTLRules && typeof window.BTLRules.awardSuccessfulRoll === "function") {
      window.BTLRules.awardSuccessfulRoll("storyline-success");
    } else if (typeof addSuccessRoll === "function") {
      addSuccessRoll();
    } else {
      S.successRolls = Math.max(0, Number(S.successRolls || S.successRollCount || 0)) + 1;
      if (S.successRolls >= 3) {
        S.successRolls = 0;
        if (typeof changeCounter === "function") changeCounter("pathTokens", 1);
        else S.pathTokens = Math.max(0, (S.pathTokens || 0) + 1);
        if (typeof showNotif === "function") showNotif("3 successful rolls — +1 Path Token earned!", "good");
      } else if (typeof showNotif === "function") {
        showNotif("Success streak: " + S.successRolls + "/3 toward next Path Token.", "good");
      }
      S.successRollCount = S.successRolls;
    }
  }

  function applyOutcome(sceneId, option, outcome, checkResult, decisionMeta) {
    const st = ensureStoryState();
    const scene = SCENES[sceneId];
    const safeOutcome = normalizeOutcome(sceneId, option, outcome, "resolved");

    if (scene) markLessonProgress(scene);

    if (checkResult && option.stat) {
      if (st.usedStats.indexOf(option.stat) < 0) st.usedStats.push(option.stat);
      const currentDread = getOptionDread(sceneId, option);
      const nextDread = checkResult.success ? stepDown(currentDread) : stepUp(currentDread);
      setOptionDread(sceneId, option.id, nextDread);

      if (checkResult.success) {
        if (checkResult.teamworkConverted || (decisionMeta && decisionMeta.teamworkConverted)) {
          if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === "function") {
            window.BTLRules.recordTeamworkConvertedSuccess("story-teamwork-convert");
          } else if (typeof showNotif === "function") {
            showNotif("Teamwork converted the failure to success. No Successful Roll gained.", "good");
          }
        } else {
          // Success → advance streak toward Path Token
          recordSuccessRoll();
        }
        // Renown bonus for overcoming high dread
        if (checkResult.dreadDie >= 12 && safeOutcome && safeOutcome.effects && !safeOutcome.effects.renown) {
          if (typeof changeCounter === "function") changeCounter("renown", 1);
          if (typeof showNotif === "function") showNotif("+1 Renown for overcoming high dread.", "good");
        }
      } else {
        // Failure → +1 Teamwork (to spend on retry or push luck)
        if (typeof changeCounter === "function") changeCounter("tmw", 1);
        else if (typeof S !== "undefined") S.tmw = Math.max(0, (S.tmw || 0) + 1);
        if (typeof showNotif === "function") showNotif("+1 Teamwork Point (spend to succeed or push luck).", "good");
      }
    }

    if (option && option.req && Array.isArray(option.req.backpackAny) && (option.consumeRequiredItem || option.req.consumeRequiredItem)) {
      var spent = consumeBackpackAny(option.req.backpackAny);
      if (spent && typeof showNotif === "function") showNotif("Consumed for story choice: " + spent, "good");
    }

    if (safeOutcome && safeOutcome.effects) {
      try {
        applyEffects(safeOutcome.effects);
      } catch (_err) {
        if (typeof showNotif === "function") showNotif("Story effects partially failed; route still advanced.", "warn");
      }
    }
    if (safeOutcome && safeOutcome.irreversible) {
      try {
        applyIrreversibleOutcome(safeOutcome.irreversible);
      } catch (_err) {
        if (typeof showNotif === "function") showNotif("Story irreversible effects failed safely.", "warn");
      }
    }
    if (safeOutcome && safeOutcome.text) st.lastResult = safeOutcome.text;
    rememberStoryConsequence(sceneId, scene, option, safeOutcome, checkResult);

    function routeDeityPactEpilogue(nextSceneId) {
      var nextId = String(nextSceneId || "");
      if (!nextId || nextId.indexOf("ending_") !== 0) return nextId;
      var sourceScene = SCENES[sceneId] || {};
      if ((sourceScene.chapter || "") !== "c4") return nextId;
      var pactEnding = String((st.flags && st.flags.deityPactEnding) || "").toLowerCase();
      if (!pactEnding) return nextId;
      st.flags.deityPactRerouteSource = nextId;
      if (pactEnding === "lantern_herald") return "pact_mid_lantern";
      if (pactEnding === "chain_bound") return "pact_mid_chain";
      if (pactEnding === "oathbreaker") return "pact_mid_oathbreaker";
      return nextId;
    }

    if (safeOutcome && safeOutcome.next) {
      st.sceneId = routeDeityPactEpilogue(safeOutcome.next);
      const next = SCENES[st.sceneId];
      if (next) st.chapter = next.chapter;
    }
    if (safeOutcome && safeOutcome.restart) {
      clearStoryTravelMarkers();
      st.sceneId = "intro";
      st.chapter = "c1";
      st.flags = {};
      st.history = { sceneVisits: {}, optionsTaken: {} };
      st.lexicon = {};
      st.dialogueMemory = [];
      st.log = [];
      st.usedStats = [];
      st.completedSystems = [];
      st.storyMemory = { recent: [], tags: {}, sceneTypeCounts: {} };
      st.seedTag = "W-" + Math.floor(Math.random() * 9000 + 1000);
      st.pendingTravel = null;
      st.lastResult = "Cycle reset. A new Wayfarer enters the same legend from a different angle.";
    }

    if (decisionMeta && decisionMeta.assigneeName) {
      st.decisionAssignments.unshift({
        at: Date.now(),
        sceneId: sceneId,
        optionId: option.id,
        optionText: option.text,
        assigneeId: decisionMeta.assigneeId,
        assigneeName: decisionMeta.assigneeName,
        role: decisionMeta.role || "Lead Check",
      });
      st.decisionAssignments = st.decisionAssignments.slice(0, 24);
    }

    const msg = [
      option.text,
      (decisionMeta && decisionMeta.assigneeName)
        ? ("[Assigned: " + decisionMeta.assigneeName + " as " + (decisionMeta.role || "Lead Check") + "]")
        : "",
      safeOutcome && safeOutcome.text ? safeOutcome.text : "",
      checkResult
        ? ("[" + STAT_LABELS[option.stat] + " d" + checkResult.actionDie + "=" + checkResult.action.total
          + (checkResult.factionBonus ? (" +" + checkResult.factionBonus) : "")
          + " => " + (checkResult.effectiveTotal || checkResult.action.total)
          + " vs DD" + checkResult.dreadDie + "=" + checkResult.dread.total + "]")
        : "",
    ].filter(Boolean).join(" - ");

    pushLog(msg);

    if (typeof renderUI === "function") renderUI();
  }

  function applyIrreversibleOutcome(irrev) {
    const st = ensureStoryState();
    if (!st || !irrev) return;

    const deadList = Array.isArray(irrev.killNpc) ? irrev.killNpc : [];
    deadList.forEach(function (npc) {
      const key = String(npc || "").trim();
      if (!key) return;
      st.flags[key + "Dead"] = true;
      st.flags[key + "Alive"] = false;
      st.npc[key] = -99;
      if (typeof showNotif === "function") {
        showNotif("Story consequence: " + key.charAt(0).toUpperCase() + key.slice(1) + " is gone. Related branches are permanently altered.", "warn");
      }
    });

    const lockFlags = Array.isArray(irrev.lockFlags) ? irrev.lockFlags : [];
    lockFlags.forEach(function (flag) {
      st.flags[String(flag)] = true;
    });

    const unlockFlags = Array.isArray(irrev.unlockFlags) ? irrev.unlockFlags : [];
    unlockFlags.forEach(function (flag) {
      st.flags[String(flag)] = true;
    });
  }

  function runStoryOption(sceneId, optionId, approach) {
    if (typeof ensureTheosProvinceScenes === "function") ensureTheosProvinceScenes();
    const scene = SCENES[sceneId];
    if (!scene) return;

    const option = (scene.options || []).find(function (o) { return o.id === optionId; });
    if (!option) return;
    const decisionMeta = getDecisionAssignment(sceneId, optionId);

    const st = ensureStoryState();
    const pending = st && st.pendingTravel
      && st.pendingTravel.sceneId === sceneId
      && st.pendingTravel.optionId === optionId
      ? st.pendingTravel
      : null;
    const pendingCombat = st && st.pendingCombat
      && st.pendingCombat.sceneId === sceneId
      && st.pendingCombat.optionId === optionId
      ? st.pendingCombat
      : null;

    if (option.jump) {
      if (!pending) {
        const objective = setStoryTravelObjective(sceneId, option);
        if (objective) {
          st.pendingTravel = {
            sceneId: sceneId,
            optionId: optionId,
            system: objective.system,
            targetValue: objective.targetValue,
            targetLabel: objective.label,
            planetHexId: st.travelMarkers.planetHexId,
          };
          doJump(option.jump);
          openStoryTravelModal(option, objective);
          renderStorylinePanel();
          return;
        }
        // Map not ready — resolve immediately with a clear narrative note
        if (typeof showNotif === "function") {
          showNotif("Story path opened. No travel map available yet — outcome resolved directly.", "good");
        }
      } else if (!isStoryObjectiveReached(pending)) {
        doJump(option.jump);
        openStoryTravelReminderModal(pending);
        renderStorylinePanel();
        return;
      } else {
        clearStoryTravelMarkers();
        st.pendingTravel = null;
      }
    }

    if (option.combat) {
      if (String(approach || "") === "talk") {
        if (!pendingCombat) {
          const combatDD = Number((option.combat && option.combat.dread) || 8);
          const parleyDecisionMeta = decisionMeta || getDecisionAssignment(sceneId, option.id);
          const parleyActionDie = getAssignedWayfarerActionDie("lead", parleyDecisionMeta);

          const finishParley = function (parley) {
            if (parley && parley.success) {
              if (typeof showNotif === "function") showNotif("Parley success: combat avoided.", "good");
              resolveStoryOption(sceneId, option, "success", decisionMeta);
              return;
            }
            if (typeof showNotif === "function") showNotif("Parley failed. Combat begins.", "warn");
            startStoryCombat(sceneId, option);
            renderStorylinePanel();
          };

          if (typeof isManualRollModeEnabled === "function" && isManualRollModeEnabled()) {
            const parleyOption = { stat: "lead", text: String(option.text || "Parley attempt") };
            openStorylineManualRollPrompt(sceneId, parleyOption, parleyActionDie, combatDD, function (manualOutcome) {
              finishParley({ success: manualOutcome.success });
            });
            return;
          }

          finishParley(rollStoryCheck("lead", combatDD, inferOptionFactionKey(option), parleyDecisionMeta));
          return;
        }
      }

      if (!pendingCombat) {
        startStoryCombat(sceneId, option);
        renderStorylinePanel();
        return;
      }

      const combatResult = getStoryCombatResult(pendingCombat);
      if (!combatResult) {
        const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('combat'\"]");
        if (typeof switchTab === "function") switchTab("combat", btn || null);
        openStoryCombatReminderModal(pendingCombat);
        renderStorylinePanel();
        return;
      }

      clearStoryCombatState();
      if (combatResult === "success" && S && S.combat && S.combat.active && typeof endCombat === "function") {
        endCombat();
      }
      resolveStoryOption(sceneId, option, combatResult, decisionMeta);
      return;
    }

    if (option.puzzle) {
      startStoryPuzzle(sceneId, option);
      return;
    }

    resolveStoryOption(sceneId, option, null, decisionMeta);
  }

  function forceStoryFallbackRoute() {
    const st = ensureStoryState();
    if (!st) return;
    const currentSceneId = st.sceneId;
    const fallback = chapterFallbackScene(currentSceneId);
    const nextSceneId = (fallback && fallback !== currentSceneId && SCENES[fallback])
      ? fallback
      : (SCENES.intro ? "intro" : currentSceneId);

    st.sceneId = nextSceneId;
    if (SCENES[nextSceneId] && SCENES[nextSceneId].chapter) {
      st.chapter = SCENES[nextSceneId].chapter;
    }
    st.lastResult = "Every obvious route was blocked, so you carve a new lead and keep moving.";
    pushLog("Deadlock fallback route engaged: " + currentSceneId + " -> " + nextSceneId);

    if (typeof showNotif === "function") {
      showNotif("Storyline deadlock resolved. A fallback route opened.", "warn");
    }
    renderStorylinePanel();
  }

  function wheelOptionPosition(index, total) {
    var count = Math.max(1, Number(total || 1));
    var step = (Math.PI * 2) / count;
    var angle = (-Math.PI / 2) + (index * step);
    var radius = count <= 3 ? 30 : count <= 5 ? 34 : count <= 7 ? 37 : 39;
    var x = 50 + Math.cos(angle) * radius;
    var y = 50 + Math.sin(angle) * radius;
    return {
      left: Math.max(16, Math.min(84, x)),
      top: Math.max(16, Math.min(84, y))
    };
  }

  var _storyWheelState = {
    active: false,
    sceneId: "",
    optionIds: [],
    unlocked: [],
    positions: [],
    selected: 0,
  };

  function getFirstUnlockedWheelIndex() {
    if (!_storyWheelState.unlocked.length) return -1;
    for (var i = 0; i < _storyWheelState.unlocked.length; i++) {
      if (_storyWheelState.unlocked[i]) return i;
    }
    return -1;
  }

  function isStoryWheelModalOpen() {
    var modal = document.getElementById("rollModal");
    if (!modal || !modal.classList) return false;
    return modal.classList.contains("open");
  }

  function renderStoryWheelActiveSelection() {
    var nodes = document.querySelectorAll(".story-wheel-option[data-wheel-index]");
    nodes.forEach(function (node) {
      var idx = Number(node.getAttribute("data-wheel-index") || -1);
      node.classList.toggle("active", idx === _storyWheelState.selected);
    });
    var rows = document.querySelectorAll(".story-wheel-row[data-wheel-row-index]");
    rows.forEach(function (row) {
      var idx = Number(row.getAttribute("data-wheel-row-index") || -1);
      var isActive = idx === _storyWheelState.selected;
      row.classList.toggle("active", isActive);
      if (isActive && typeof row.scrollIntoView === "function") {
        row.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function getNextWheelIndex(delta) {
    var count = _storyWheelState.optionIds.length;
    if (!count) return -1;
    var start = Number(_storyWheelState.selected || 0);
    for (var step = 1; step <= count; step++) {
      var idx = (start + (delta * step) + count) % count;
      if (_storyWheelState.unlocked[idx]) return idx;
    }
    return start;
  }

  function storyWheelMove(delta) {
    if (!_storyWheelState.active) return;
    var next = getNextWheelIndex(delta >= 0 ? 1 : -1);
    if (next < 0) return;
    _storyWheelState.selected = next;
    renderStoryWheelActiveSelection();
  }

  function directionalWheelFrom(originX, originY, dirX, dirY, strict) {
    var bestIdx = -1;
    var bestScore = -1e9;
    for (var i = 0; i < _storyWheelState.positions.length; i++) {
      if (!_storyWheelState.unlocked[i] || i === _storyWheelState.selected) continue;
      var p = _storyWheelState.positions[i];
      if (!p) continue;
      var vx = Number(p.left) - originX;
      var vy = Number(p.top) - originY;
      var len = Math.sqrt((vx * vx) + (vy * vy));
      if (!len) continue;
      var dot = ((vx * dirX) + (vy * dirY)) / len;
      if (dot <= 0) continue;
      if (strict && dot < 0.28) continue;
      var side = Math.abs((vx * dirY) - (vy * dirX)) / len;
      var score = (dot * 120) - (side * 34) - (len * 0.3);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function storyWheelMoveDirectional(direction) {
    if (!_storyWheelState.active) return;
    var dirs = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    var d = dirs[String(direction || "").toLowerCase()];
    if (!d) return;

    var current = _storyWheelState.positions[_storyWheelState.selected] || { left: 50, top: 50 };
    var next = directionalWheelFrom(Number(current.left), Number(current.top), d.x, d.y, true);
    if (next < 0) next = directionalWheelFrom(Number(current.left), Number(current.top), d.x, d.y, false);
    if (next < 0) next = directionalWheelFrom(50, 50, d.x, d.y, true);
    if (next < 0) next = directionalWheelFrom(50, 50, d.x, d.y, false);
    if (next < 0) return;

    _storyWheelState.selected = next;
    renderStoryWheelActiveSelection();
  }

  function storyWheelSelectIndex(index) {
    var idx = Number(index);
    if (!_storyWheelState.active) return;
    if (!(idx >= 0 && idx < _storyWheelState.optionIds.length)) return;
    if (!_storyWheelState.unlocked[idx]) {
      if (typeof showNotif === "function") showNotif("That dialogue branch is locked.", "warn");
      return;
    }
    _storyWheelState.selected = idx;
    renderStoryWheelActiveSelection();
  }

  function storyWheelConfirm() {
    if (!_storyWheelState.active) return;
    var idx = Number(_storyWheelState.selected || 0);
    if (!(idx >= 0 && idx < _storyWheelState.optionIds.length)) return;
    if (!_storyWheelState.unlocked[idx]) {
      if (typeof showNotif === "function") showNotif("That dialogue branch is locked.", "warn");
      return;
    }
    var sceneId = _storyWheelState.sceneId;
    var optionId = _storyWheelState.optionIds[idx];
    _storyWheelState.active = false;
    if (typeof closeModal === "function") closeModal();
    runStoryOption(sceneId, optionId);
  }

  function storyWheelCancel() {
    _storyWheelState.active = false;
    if (typeof closeModal === "function") closeModal();
  }

  function activateStoryWheelState(sceneId, wheelOptions) {
    _storyWheelState.sceneId = String(sceneId || "");
    _storyWheelState.optionIds = wheelOptions.map(function (w) { return w && w.option ? String(w.option.id || "") : ""; });
    _storyWheelState.unlocked = wheelOptions.map(function (w) { return !!(w && w.unlocked); });
    _storyWheelState.positions = wheelOptions.map(function (w) { return w && w.pos ? { left: Number(w.pos.left || 50), top: Number(w.pos.top || 50) } : { left: 50, top: 50 }; });
    _storyWheelState.selected = Math.max(0, getFirstUnlockedWheelIndex());
    _storyWheelState.active = true;
    renderStoryWheelActiveSelection();
  }

  function patchStoryWheelHotkeys() {
    if (window._storyWheelHotkeysPatched) return;
    window._storyWheelHotkeysPatched = true;
    document.addEventListener("keydown", function (ev) {
      if (!_storyWheelState.active) return;
      if (!isStoryWheelModalOpen()) {
        _storyWheelState.active = false;
        return;
      }
      var tag = String((ev.target && ev.target.tagName) || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      var key = String(ev.key || "").toLowerCase();
      if (key === "arrowleft" || key === "a") {
        ev.preventDefault();
        storyWheelMoveDirectional("left");
        return;
      }
      if (key === "arrowup" || key === "w") {
        ev.preventDefault();
        storyWheelMoveDirectional("up");
        return;
      }
      if (key === "arrowright" || key === "d") {
        ev.preventDefault();
        storyWheelMoveDirectional("right");
        return;
      }
      if (key === "arrowdown" || key === "s") {
        ev.preventDefault();
        storyWheelMoveDirectional("down");
        return;
      }
      if (key === "q") {
        ev.preventDefault();
        storyWheelMove(-1);
        return;
      }
      if (key === "e") {
        ev.preventDefault();
        storyWheelMove(1);
        return;
      }
      if (key === "enter" || key === " ") {
        ev.preventDefault();
        storyWheelConfirm();
        return;
      }
      if (key === "escape") {
        ev.preventDefault();
        storyWheelCancel();
        return;
      }
      if (/^[1-9]$/.test(key)) {
        ev.preventDefault();
        storyWheelSelectIndex(Number(key) - 1);
        storyWheelConfirm();
      }
    });
  }

  function openStoryDialogueWheel() {
    if (typeof openModal !== "function") return;
    var st = ensureStoryState();
    if (!st) return;
    var scene = SCENES[st.sceneId] || SCENES.intro;
    var opts = Array.isArray(scene.options) ? scene.options : [];
    if (!opts.length) {
      if (typeof showNotif === "function") showNotif("No dialogue options available in this scene.", "warn");
      return;
    }

    var wheelOptions = opts.map(function (option, idx) {
      var unlocked = hasReq(option.req);
      var assign = getDecisionAssignment(st.sceneId, option.id);
      var dd = option.stat ? getOptionDread(st.sceneId, option) : 0;
      var pending = st.pendingTravel
        && st.pendingTravel.sceneId === st.sceneId
        && st.pendingTravel.optionId === option.id;
      var pendingCombat = st.pendingCombat
        && st.pendingCombat.sceneId === st.sceneId
        && st.pendingCombat.optionId === option.id;
      var pos = wheelOptionPosition(idx, opts.length);
      var intent = pending ? "TRAVEL" : (pendingCombat ? "COMBAT" : (option.stat ? "ROLL" : "TALK"));
      return {
        option: option,
        unlocked: unlocked,
        assign: assign,
        dd: dd,
        pending: !!pending,
        pendingCombat: !!pendingCombat,
        pos: pos,
        intent: intent,
      };
    });

    var summary = wheelOptions.map(function (w, idx) {
      var o = w.option;
      var reqText = renderRequirement(o.req);
      var status = w.unlocked ? "READY" : "LOCKED";
      var dieText = o.stat
        ? ((STAT_LABELS[o.stat] || o.stat) + " d" + getAssignedWayfarerActionDie(o.stat, w.assign) + " vs DD" + w.dd)
        : "No roll";
      var actionBtn = w.unlocked
        ? ("<button class='btn btn-xs btn-primary' onclick='closeModal();runStoryOption(\"" + st.sceneId + "\",\"" + o.id + "\")'>Choose</button>")
        : "<button class='btn btn-xs' disabled>Locked</button>";

      return ""
        + "<div class='story-wheel-row " + (w.unlocked ? "" : "locked") + "' data-wheel-row-index='" + idx + "'>"
        + "<div style='display:flex;justify-content:space-between;gap:.45rem;align-items:center;'>"
        + "<div style='font-size:.75rem;color:var(--gold2);letter-spacing:.08em;'>" + (idx + 1) + ". " + w.intent + " | " + status + "</div>"
        + actionBtn
        + "</div>"
        + "<div style='font-size:.8rem;color:var(--text2);margin-top:.15rem;'>" + escHtml(o.text) + "</div>"
        + "<div style='font-size:.72rem;color:var(--muted2);margin-top:.12rem;'>" + escHtml(w.assign.assigneeName) + " as " + escHtml(w.assign.role) + " | " + escHtml(dieText) + "</div>"
        + (reqText ? ("<div style='font-size:.69rem;color:var(--muted2);margin-top:.12rem;'>Req: " + escHtml(reqText) + "</div>") : "")
        + "</div>";
    }).join("");

    var nodes = wheelOptions.map(function (w, idx) {
      var o = w.option;
      var classes = "story-wheel-option" + (w.unlocked ? "" : " locked");
      var roleChip = escHtml(w.assign.role || "Lead Check");
      var line2 = o.stat
        ? escHtml((STAT_LABELS[o.stat] || o.stat) + " d" + getAssignedWayfarerActionDie(o.stat, w.assign) + " vs DD" + w.dd)
        : escHtml(w.intent);
      var onclick = "onclick='storyWheelSelectIndex(" + idx + ");storyWheelConfirm();'";

      return ""
        + "<button class='" + classes + "' data-wheel-index='" + idx + "' style='left:" + w.pos.left + "%;top:" + w.pos.top + "%;' " + onclick + " " + (w.unlocked ? "" : "disabled") + ">"
        + "<div class='story-wheel-role'>" + roleChip + "</div>"
        + "<div class='story-wheel-text'>" + escHtml(o.text) + "</div>"
        + "<div class='story-wheel-roll'>" + line2 + "</div>"
        + "</button>";
    }).join("");

    var html = ""
      + "<div class='story-wheel-wrap'>"
      + "<div class='story-wheel-stage'>"
      + "<div class='story-wheel-center'><div class='story-wheel-center-title'>Dialogue Wheel</div><div class='story-wheel-center-sub'>" + escHtml(scene.title) + "</div></div>"
      + nodes
      + "</div>"
      + "<div>"
      + "<div class='story-wheel-hints'>"
      + "<span class='story-wheel-hint'>D-Pad / WASD: snap by direction</span>"
      + "<span class='story-wheel-hint'>Q / E: cycle</span>"
      + "<span class='story-wheel-hint'>Enter / Space: choose</span>"
      + "<span class='story-wheel-hint'>Esc: cancel</span>"
      + "<span class='story-wheel-hint'>1-9: direct choose</span>"
      + "</div>"
      + "<div class='story-wheel-list'>" + summary + "</div>"
      + "</div>"
      + "</div>";

    openModal("Dialogue Wheel", html);
    activateStoryWheelState(st.sceneId, wheelOptions);
  }

  function openStoryTravelModal(option, objective) {
    if (typeof openModal !== "function") return;
    const SYSTEM_NAMES = {
      province: "Province Map",
      lastsea: "Last Sea Map",
      galaxy: "Galaxy Map",
      wtw: "World That Was Map",
      planet: "Planet Map"
    };
    const sysName = SYSTEM_NAMES[objective.system] || objective.system;
    const html = ""
      + "<div style='font-size:.9rem;color:var(--gold2);font-family:Cinzel,serif;margin-bottom:.5rem;'>Story Marker Placed</div>"
      + "<div style='font-size:.83rem;color:var(--text2);line-height:1.65;margin-bottom:.55rem;'>"
      + "A <strong style='color:var(--teal);'>➤ story marker</strong> has been placed on the <strong>" + sysName + "</strong>."
      + "<br>Target: <strong style='color:var(--gold2);'>" + objective.label + "</strong>"
      + "</div>"
      + "<div style='font-size:.8rem;color:var(--muted2);border:1px solid rgba(240,208,112,.25);background:rgba(240,208,112,.06);padding:.35rem .5rem;margin-bottom:.55rem;'>"
      + "Navigate to the map tab, travel to the marked hex, then return to <strong>Storyline</strong> and choose this option again to resolve it."
      + "</div>"
      + "<div style='font-size:.78rem;color:var(--text2);'>Story Option: <em>" + option.text + "</em></div>"
      + "<div style='text-align:right;margin-top:.6rem;'>"
      + "<button class='btn btn-sm btn-primary' onclick='closeModal()'>Understood — I'll travel there</button>"
      + "</div>";
    openModal("Storyline: Travel Required", html);
  }

  function openStoryTravelReminderModal(pending) {
    if (typeof openModal !== "function") return;
    const SYSTEM_NAMES = {
      province: "Province Map",
      lastsea: "Last Sea Map",
      galaxy: "Galaxy Map",
      wtw: "World That Was Map",
      planet: "Planet Map"
    };
    const sysName = SYSTEM_NAMES[pending.system] || pending.system;
    const html = ""
      + "<div style='font-size:.9rem;color:#ff8a72;font-family:Cinzel,serif;margin-bottom:.5rem;'>Not Yet Arrived</div>"
      + "<div style='font-size:.83rem;color:var(--text2);line-height:1.65;margin-bottom:.45rem;'>"
      + "Your story marker is waiting at <strong style='color:var(--gold2);'>" + (pending.targetLabel || "Travel target") + "</strong> on the <strong>" + sysName + "</strong>."
      + "</div>"
      + "<div style='font-size:.78rem;color:var(--muted2);'>Select that hex/location, then return here and choose this option again.</div>"
      + "<div style='text-align:right;margin-top:.6rem;'>"
      + "<button class='btn btn-sm' onclick='closeModal()'>Back</button>"
      + "</div>";
    openModal("Storyline: Travel Objective Active", html);
  }

  function openStorylineTab() {
    const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('" + STORY_TAB_ID + "'\"]");
    if (typeof switchTab === "function") switchTab(STORY_TAB_ID, btn || null);
    renderStorylinePanel();
  }

  function renderRequirement(req) {
    if (!req) return "";
    const bits = [];
    if (Array.isArray(req.careerIncludes) && req.careerIncludes.length) bits.push("Career: " + req.careerIncludes.join(" / "));
    if (Array.isArray(req.backgroundIncludes) && req.backgroundIncludes.length) bits.push("Background: " + req.backgroundIncludes.join(" / "));
    if (req.factionAtLeast) bits.push((FACTION_LABELS[req.factionAtLeast.key] || req.factionAtLeast.key) + " ≥ " + req.factionAtLeast.min);
    if (Array.isArray(req.factionAtLeastAny) && req.factionAtLeastAny.length) {
      bits.push("Any rank: " + req.factionAtLeastAny.map(function (r) { return (FACTION_LABELS[r.key] || r.key) + " ≥ " + r.min; }).join(" or "));
    }
    if (req.age) bits.push("Age: " + req.age);
    if (req.season) bits.push("Season: " + req.season);
    if (req.npcAffinity && req.npcAffinity.npc) bits.push("Affinity " + req.npcAffinity.npc + " ≥ " + req.npcAffinity.min);
    if (req.flagEq && req.flagEq.key) bits.push("Flag " + req.flagEq.key + " = " + req.flagEq.value);
    if (req.sceneSeenAtLeast && req.sceneSeenAtLeast.sceneId) bits.push("Seen " + req.sceneSeenAtLeast.sceneId + " x" + req.sceneSeenAtLeast.min);
    if (req.usedStatCountAtLeast && req.usedStatCountAtLeast.count) bits.push("Used stats ≥ " + req.usedStatCountAtLeast.count);
    if (req.sceneTypeSeenAtLeast && req.sceneTypeSeenAtLeast.type) bits.push("Scene type " + req.sceneTypeSeenAtLeast.type + " seen x" + req.sceneTypeSeenAtLeast.min);
    if (Array.isArray(req.consequenceTagAny) && req.consequenceTagAny.length) bits.push("Any consequence tag: " + req.consequenceTagAny.join(" / "));
    if (Array.isArray(req.lexiconKnown) && req.lexiconKnown.length) bits.push("Glyphs: " + req.lexiconKnown.join(", "));
    if (req.lexiconCountAtLeast && req.lexiconCountAtLeast.count) bits.push("Known glyphs ≥ " + req.lexiconCountAtLeast.count);
    if (req.quoteKnown) bits.push("Remembered quote: " + req.quoteKnown);
    if (Array.isArray(req.quoteKnownAny) && req.quoteKnownAny.length) bits.push("Any remembered: " + req.quoteKnownAny.join(" / "));
    if (req.virtueIs) bits.push("Virtue: " + req.virtueIs);
    if (Array.isArray(req.virtueAny)) bits.push("Virtue: " + req.virtueAny.join(" / "));
    if (req.viceIs) bits.push("Vice: " + req.viceIs);
    if (Array.isArray(req.viceAny)) bits.push("Vice: " + req.viceAny.join(" / "));
    if (req.reputationIs) bits.push("Reputation: " + req.reputationIs);
    if (Array.isArray(req.reputationAny)) bits.push("Reputation: " + req.reputationAny.join(" / "));
    if (req.misfortuneIs) bits.push("Misfortune: " + req.misfortuneIs);
    if (req.mutationIncludes) bits.push("Mutation: " + (Array.isArray(req.mutationIncludes) ? req.mutationIncludes.join(" / ") : req.mutationIncludes));
    if (req.flavorSet) bits.push("Personal Flavor set");
    if (Array.isArray(req.flavorAny) && req.flavorAny.length) bits.push("Personal Flavor: " + req.flavorAny.join(" / "));
    if (Array.isArray(req.flavorProfileAny) && req.flavorProfileAny.length) bits.push("Flavor profile: " + req.flavorProfileAny.join(" / "));
    if (req.backstorySet) bits.push("Backstory created");
    if (Array.isArray(req.backstoryOriginAny) && req.backstoryOriginAny.length) bits.push("Backstory Origin: " + req.backstoryOriginAny.join(" / "));
    if (Array.isArray(req.backstoryUpbringingAny) && req.backstoryUpbringingAny.length) bits.push("Backstory Upbringing: " + req.backstoryUpbringingAny.join(" / "));
    if (Array.isArray(req.backstoryFactionAny) && req.backstoryFactionAny.length) bits.push("Backstory Faction: " + req.backstoryFactionAny.join(" / "));
    if (req.backstoryRivalExists) bits.push("Backstory Rival required");
    if (req.backstoryConnectionExists) bits.push("Backstory Connection required");
    if (Array.isArray(req.augmentationsAny) && req.augmentationsAny.length) bits.push("Augmentations: " + req.augmentationsAny.join(" / "));
    if (Array.isArray(req.ownedHacksAny) && req.ownedHacksAny.length) bits.push("OS Hack: " + req.ownedHacksAny.join(" / "));
    if (Array.isArray(req.backpackAny) && req.backpackAny.length) bits.push("Loadout item: " + req.backpackAny.join(" / "));
    if (req.consumeRequiredItem) bits.push("Consumes one matching item");
    if (req.theosProvinceIs) bits.push("Theos province: " + req.theosProvinceIs);
    if (Array.isArray(req.theosProvinceAny) && req.theosProvinceAny.length) bits.push("Theos province: " + req.theosProvinceAny.join(" / "));
    if (Array.isArray(req.theosDiscoveredAny) && req.theosDiscoveredAny.length) bits.push("Discovered province: " + req.theosDiscoveredAny.join(" / "));
    return bits.join("  |  ");
  }

  function getChapterMeta(chapterId) {
    return CHAPTERS.find(function (c) { return c.id === chapterId; }) || CHAPTERS[0];
  }

  function lessonProgressHtml() {
    const st = ensureStoryState();
    return STORY_SYSTEMS.map(function (sys) {
      const done = st.completedSystems.indexOf(sys.id) >= 0;
      return "<div class='story-lesson " + (done ? "done" : "") + "'>"
        + "<span>" + sys.name + "</span>"
        + "<button class='btn btn-xs " + (done ? "btn-green" : "") + "' onclick='storyJumpSystem(\"" + sys.id + "\")'>" + (done ? "Visited" : "Go") + "</button>"
      + "</div>";
    }).join("");
  }

  function chapterRailHtml() {
    const st = ensureStoryState();
    return CHAPTERS.map(function (c) {
      const on = st.chapter === c.id;
      return "<div class='story-chapter " + (on ? "on" : "") + "'>"
        + "<div class='story-ch-title'>" + c.title + "</div>"
        + "<div class='story-ch-meta'>" + c.subtitle + "  |  " + c.age + " / " + c.season + "</div>"
      + "</div>";
    }).join("");
  }

  function renderStorylinePanel() {
    if (typeof ensureTheosProvinceScenes === "function") ensureTheosProvinceScenes();
    const st = ensureStoryState();
    const host = document.getElementById("tab-" + STORY_TAB_ID);
    if (!host || !st) return;

    const scene = SCENES[st.sceneId] || SCENES.intro;
    const chapter = getChapterMeta(scene.chapter);
    const variantText = sceneVariantText(scene, st);
    const sceneTypes = inferSceneTypes(scene);
    const sceneTypeLine = sceneTypes.map(function (typeId) {
      return STORY_SCENE_TYPES[typeId] || typeId;
    }).join("  |  ");
    const gmFrame = "Frame this as " + (STORY_SCENE_TYPES[primarySceneType(scene)] || "Social")
      + ": escalate stakes, let the party choose approach, then lock in a visible consequence.";
    const passiveFlavorBadges = (typeof window.getFlavorPassiveBadgesHtml === "function" && typeof S !== "undefined")
      ? window.getFlavorPassiveBadgesHtml(S.flavor, { compact: false, context: "story" })
      : "";

    const sceneOptions = scene.options || [];
    const unlockedCount = sceneOptions.filter(function (option) { return hasReq(option.req); }).length;
    const options = sceneOptions.map(function (option) {
      const unlocked = hasReq(option.req);
      const reqText = renderRequirement(option.req);
      const assign = getDecisionAssignment(st.sceneId, option.id);
      const assignees = getPartyAssignmentPool();
      const dd = option.stat ? getOptionDread(st.sceneId, option) : 0;
      const optionFaction = inferOptionFactionKey(option);
      const optionBonus = (option.stat && optionFaction && typeof window.getFactionStoryRollBonus === "function")
        ? Number(window.getFactionStoryRollBonus(optionFaction, option.stat) || 0)
        : 0;
      const assignedDie = option.stat ? getAssignedWayfarerActionDie(option.stat, assign) : 0;
      const pending = st.pendingTravel
        && st.pendingTravel.sceneId === st.sceneId
        && st.pendingTravel.optionId === option.id
        ? st.pendingTravel
        : null;
      const pendingCombat = st.pendingCombat
        && st.pendingCombat.sceneId === st.sceneId
        && st.pendingCombat.optionId === option.id
        ? st.pendingCombat
        : null;
      const pendingReached = pending ? isStoryObjectiveReached(pending) : false;
      const pendingCombatResult = pendingCombat ? getStoryCombatResult(pendingCombat) : "";
      const btnLabel = pending
        ? (pendingReached ? "✓ Choose (Arrived)" : "▶ Go To Marker")
        : pendingCombat
          ? (pendingCombatResult === "success" ? "✓ Resolve Victory" : pendingCombatResult === "fail" ? "Resolve Setback" : "▶ Enter Combat")
          : "Choose";
      const isDarkOption = option.id === "o_dark" || option.id === "o_ally" || option.id === "o_time" || option.id === "o_falseflag" || option.id === "o_civil" || option.id === "o_paranoia" || option.id === "o_shatter" || option.id === "o_rebel";
      const isGoodOption = option.id === "o2" || (option.success && option.success.next && option.success.next.startsWith("ending_glass"));
      const assigneeSelect = "<label class='story-opt-req' style='display:block;margin-top:.2rem;'>Assigned Wayfarer"
        + "<select style='width:100%;margin-top:.2rem;' onchange='storySetAssignee(\"" + st.sceneId + "\",\"" + option.id + "\",this.value)'>"
        + assignees.map(function (entry) {
            var selected = entry.id === assign.assigneeId ? " selected" : "";
            var suffix = entry.online ? " (online)" : "";
            return "<option value='" + escHtml(entry.id) + "'" + selected + ">" + escHtml(entry.name + suffix) + "</option>";
          }).join("")
        + "</select></label>";
      const roleSelect = "<label class='story-opt-req' style='display:block;margin-top:.2rem;'>Decision Role"
        + "<select style='width:100%;margin-top:.2rem;' onchange='storySetDecisionRole(\"" + st.sceneId + "\",\"" + option.id + "\",this.value)'>"
        + DECISION_ROLES.map(function (roleName) {
            var selected = roleName === assign.role ? " selected" : "";
            return "<option value='" + escHtml(roleName) + "'" + selected + ">" + escHtml(roleName) + "</option>";
          }).join("")
        + "</select></label>";
      return "<div class='story-opt " + (unlocked ? "" : "locked") + (isDarkOption ? " story-opt-dark" : "") + "'>"
        + "<div class='story-opt-text'>" + option.text + "</div>"
        + (option.stat ? ("<div class='story-opt-roll'>" + escHtml(assign.assigneeName) + " rolls " + (STAT_LABELS[option.stat] || option.stat) + " d" + assignedDie + " vs DD" + dd + "</div>") : "")
        + "<div class='story-opt-req' style='color:var(--teal);'>Assigned: <strong>" + escHtml(assign.assigneeName) + "</strong> as <strong>" + escHtml(assign.role) + "</strong></div>"
        + (optionBonus > 0 ? ("<div class='story-opt-req' style='color:var(--gold2);'>Faction bonus: +" + optionBonus + " from " + (FACTION_LABELS[optionFaction] || optionFaction) + "</div>") : "")
        + (pending ? ("<div class='story-opt-req' style='color:var(--gold2);'>➤ Marker: " + (pending.targetLabel || "Travel target") + (pendingReached ? " ✓ Arrived" : " — travel there") + "</div>") : "")
        + (option.combat ? ("<div class='story-opt-req' style='color:#ff8a72;'>⚔ Combat: " + ((option.combat.enemies || []).length || 1) + " foe" + ((((option.combat.enemies || []).length || 1) === 1) ? "" : "s") + "  |  DD" + Number(option.combat.dread || 8) + "</div>") : "")
        + (pendingCombat ? ("<div class='story-opt-req' style='color:#ff8a72;'>⚔ Combat target: " + (pendingCombat.enemyNames || []).join(", ") + (pendingCombatResult === "success" ? " ✓ Victory ready" : pendingCombatResult === "fail" ? " — setback ready" : " — fight unresolved") + "</div>") : "")
        + (reqText ? ("<div class='story-opt-req'>" + reqText + "</div>") : "")
        + assigneeSelect
        + roleSelect
        + "<div style='display:flex;gap:.3rem;flex-wrap:wrap;'>"
        + "<button class='btn btn-sm " + (unlocked ? (isDarkOption ? "btn-red" : "btn-primary") : "") + "' " + (unlocked ? ("onclick='runStoryOption(\"" + st.sceneId + "\",\"" + option.id + "\")'") : "disabled") + ">" + btnLabel + "</button>"
        + (option.combat ? ("<button class='btn btn-sm btn-teal' " + (unlocked ? ("onclick='runStoryOption(\"" + st.sceneId + "\",\"" + option.id + "\",\"talk\")'") : "disabled") + ">Talk It Out (Lead)</button>") : "")
        + "</div>"
      + "</div>";
      }).join("")
        + (unlockedCount ? "" : (
          "<div class='story-opt' style='border-color:rgba(240,160,80,.45);background:rgba(240,160,80,.07);'>"
            + "<div class='story-opt-text'>No available options in this scene.</div>"
            + "<div class='story-opt-req'>All listed choices are currently locked by requirements. Use fallback to avoid a story dead-end.</div>"
            + "<div style='display:flex;gap:.3rem;flex-wrap:wrap;'>"
              + "<button class='btn btn-sm btn-teal' onclick='storyForceFallbackRoute()'>Force Fallback Route</button>"
            + "</div>"
          + "</div>"
        ));

    const usedStats = Object.keys(STAT_LABELS).filter(function (k) {
      return st.usedStats.indexOf(k) >= 0;
    }).map(function (k) { return STAT_LABELS[k]; }).join("  |  ") || "None yet";

    const affinity = Object.keys(st.npc).map(function (k) {
      return k.charAt(0).toUpperCase() + k.slice(1) + ": " + st.npc[k];
    }).join("  |  ");

    const lexiconText = Object.keys(st.lexicon || {}).length
      ? Object.keys(st.lexicon).map(function (k) { return k + "=" + st.lexicon[k]; }).join("  |  ")
      : "None decoded yet";

    const memoryText = (st.dialogueMemory && st.dialogueMemory.length)
      ? st.dialogueMemory.slice(0, 4).map(function (m) { return m.speaker + ": \"" + m.line + "\""; }).join("<br>")
      : "No remembered lines yet";

    const logHtml = st.log.length
      ? st.log.map(function (line) { return "<div class='story-log-item'>" + line + "</div>"; }).join("")
      : "<div class='story-log-item'>Your story choices will appear here.</div>";

    const assignmentLogHtml = st.decisionAssignments.length
      ? st.decisionAssignments.slice(0, 6).map(function (entry) {
          return "<div class='story-log-item'>" + escHtml(entry.assigneeName || "Wayfarer") + " as " + escHtml(entry.role || "Lead Check") + " → " + escHtml(entry.optionText || "Decision") + "</div>";
        }).join("")
      : "<div class='story-log-item'>No assignments recorded yet.</div>";

    const consequenceMemoryHtml = st.storyMemory && Array.isArray(st.storyMemory.recent) && st.storyMemory.recent.length
      ? st.storyMemory.recent.slice(0, 5).map(function (entry) {
          const typeName = STORY_SCENE_TYPES[entry.sceneType] || entry.sceneType || "Scene";
          const tags = Array.isArray(entry.tags) && entry.tags.length ? (" [" + entry.tags.slice(0, 3).join(", ") + "]") : "";
          return "<div class='story-log-item'><strong>" + escHtml(typeName) + "</strong> - "
            + escHtml(entry.optionText || "Decision") + "<br><span style='color:var(--muted2);'>"
            + escHtml(entry.outcomeText || "Outcome") + escHtml(tags) + "</span></div>";
        }).join("")
      : "<div class='story-log-item'>No lasting consequences recorded yet.</div>";

    const sceneTypeStats = Object.keys(STORY_SCENE_TYPES).map(function (typeId) {
      const count = Number((st.storyMemory && st.storyMemory.sceneTypeCounts && st.storyMemory.sceneTypeCounts[typeId]) || 0);
      return (STORY_SCENE_TYPES[typeId] + ": " + count);
    }).join("  |  ");

    host.innerHTML = ""
      + "<div class='story-shell'>"
      + "<div class='story-column story-left'>"
      + "<div class='section-title'>Main Arc</div>"
      + chapterRailHtml()
      + "<div class='story-card'>"
      + "<div class='story-label'>Seed</div><div class='story-value'>" + st.seedTag + "</div>"
      + "<div class='story-label'>Current Age / Season</div><div class='story-value'>" + (S.currentAge || "green") + " / " + (S.currentSeason || "spring") + "</div>"
      + "<div class='story-label'>Systems Tutorial Progress</div>"
      + lessonProgressHtml()
      + "</div>"
      + "</div>"
      + "<div class='story-column story-main'>"
      + "<div class='story-header'>"
      + "<div class='story-title'>" + scene.title + "</div>"
      + "<div class='story-sub'>" + scene.location + "  |  " + scene.mood + "</div>"
      + "<div class='story-villain'>Scene Types: " + sceneTypeLine + "</div>"
      + "<div class='story-villain'>Villain Arc: " + chapter.villainBeat + "</div>"
      + "</div>"
      + "<div class='story-body'>" + scene.text + "</div>"
      + "<div class='story-result' style='border-color:rgba(94,197,187,.4);background:rgba(94,197,187,.08);'><strong>GM Frame:</strong> " + gmFrame + "</div>"
      + (passiveFlavorBadges ? ("<div class='story-result' style='border-color:rgba(46,196,182,.35);background:rgba(46,196,182,.08);'><strong>Passive Flavor Effects:</strong><div class='flavor-passive-strip' style='margin-top:.2rem;'>" + passiveFlavorBadges + "</div></div>") : "")
      + (variantText ? ("<div class='story-result'><strong>Variant:</strong> " + variantText + "</div>") : "")
      + (st.lastResult ? ("<div class='story-result'><strong>Last Outcome:</strong> " + st.lastResult + "</div>") : "")
      + (st.pendingTravel ? ("<div class='story-result' style='border:1px solid rgba(240,208,112,.4);background:rgba(240,208,112,.08);'>"
        + "<strong style='color:var(--gold2);'>➤ Travel Objective:</strong> Navigate to <strong>" + (st.pendingTravel.targetLabel || "story marker") + "</strong>"
        + "  |  " + (isStoryObjectiveReached(st.pendingTravel) ? "<span style='color:var(--teal);'>✓ Arrived — choose the option again</span>" : "<span style='color:#f0a050;'>En route — find the ➤ marker on the map</span>")
        + "</div>") : "")
      + (st.pendingCombat ? ("<div class='story-result' style='border:1px solid rgba(224,80,80,.4);background:rgba(224,80,80,.08);'>"
        + "<strong style='color:#ff8a72;'>⚔ Combat Objective:</strong> " + (st.pendingCombat.title || "Story combat")
        + "  |  " + (getStoryCombatResult(st.pendingCombat) === "success"
          ? "<span style='color:var(--teal);'>✓ Victory ready — choose the option again</span>"
          : getStoryCombatResult(st.pendingCombat) === "fail"
            ? "<span style='color:#f0a050;'>Setback ready — choose the option again</span>"
            : "<span style='color:#ff8a72;'>Fight is active — clear the enemy list or end the scene to resolve</span>")
        + "</div>") : "")
      + "<div style='display:flex;justify-content:flex-end;gap:.35rem;flex-wrap:wrap;margin-bottom:.35rem;'>"
      + "<button class='btn btn-sm btn-teal' onclick='storyOpenDialogueWheel()'>Dialogue Wheel</button>"
      + "</div>"
      + "<div class='story-options'>" + options + "</div>"
      + "</div>"
      + "<div class='story-column story-right'>"
      + "<div class='story-card'>"
      + "<div class='story-label'>All-Stat Usage</div><div class='story-value'>" + usedStats + "</div>"
      + "<div class='story-label'>NPC Arc Affinity</div><div class='story-value'>" + affinity + "</div>"
      + "<div class='story-label'>Career</div><div class='story-value'>" + (S.career || "Unset") + "</div>"
      + "<div class='story-label'>Background</div><div class='story-value'>" + (S.background || "Unset") + "</div>"
      + "<div class='story-label'>Personal Traits</div>"
      + "<div class='story-value' style='font-size:.74rem;'>"
      + (S.traits ? [
          S.traits.virtue ? "Virtue: <strong>" + S.traits.virtue + "</strong>" : "",
          S.traits.vice ? "Vice: <strong>" + S.traits.vice + "</strong>" : "",
          S.traits.reputation ? "Reputation: <strong>" + S.traits.reputation + "</strong>" : "",
          S.traits.misfortune ? "Misfortune: <strong>" + S.traits.misfortune + "</strong>" : "",
        ].filter(Boolean).join("  |  ") || "No traits set"
       : "No traits set")
      + (S.mutation ? "<br>Mutation: <em style='color:var(--teal);'>" + S.mutation + "</em>" : "")
      + "</div>"
      + "<div class='story-label'>Faction Ranks</div>"
      + "<div class='story-factions'>"
      + Object.keys(FACTION_LABELS).map(function (k) {
          return "<span class='sea-chip'>" + FACTION_LABELS[k] + ": " + getFactionValue(k) + "</span>";
        }).join("")
      + "</div>"
      + "<div class='story-label'>Decoded Lexicon</div><div class='story-value'>" + lexiconText + "</div>"
      + "<div class='story-label'>Remembered Voices</div><div class='story-value'>" + memoryText + "</div>"
      + "<div class='story-label'>Scene Type History</div><div class='story-value'>" + sceneTypeStats + "</div>"
      + "<div class='story-label' style='margin-top:.35rem;color:var(--teal);'>Success Streak</div>"
      + "<div class='story-value'><strong style='font-size:.95rem;'>" + (typeof S !== 'undefined' ? Math.max(0, Number(S.successRolls || S.successRollCount || 0)) : 0) + "/3</strong> <span style='font-size:.74rem;color:var(--muted2);'>→ next Path Token</span></div>"
      + "<div class='story-label' style='margin-top:.35rem;'>Teamwork Points</div>"
      + "<div class='story-value'><span style='font-size:.9rem;color:var(--teal);font-weight:700;'>" + (typeof S !== 'undefined' ? (S.tmw || 0) : 0) + "</span> <span style='font-size:.72rem;color:var(--muted2);'>available</span></div>"
      + "<div class='story-label' style='margin-top:.35rem;color:var(--gold2);'>Roll Economy</div>"
      + "<div class='story-value' style='font-size:.73rem;color:var(--muted2);line-height:1.55;'>"
      + "✗ Fail → +1 Teamwork. Then: spend 3 to succeed, or push luck at higher Dread.<br>"
      + "✓ Success → +1 streak. Every 3 successes = +1 Path Token.<br>"
      + "D12+ success = +1 bonus Renown."
      + "</div>"
      + "</div>"
      + "<div class='story-card'>"
      + "<div class='story-label'>Party Role Assignments</div>"
      + "<div class='story-log'>" + assignmentLogHtml + "</div>"
      + "</div>"
      + "<div class='story-card'>"
      + "<div class='story-label'>Consequence Memory</div>"
      + "<div class='story-log'>" + consequenceMemoryHtml + "</div>"
      + "</div>"
      + "<div class='story-card'>"
      + "<div class='story-label'>Choice Log</div>"
      + "<div class='story-log'>" + logHtml + "</div>"
      + "</div>"
      + "</div>"
      + "</div>";
  }

  function jumpSystemById(systemId) {
    const entry = STORY_SYSTEMS.find(function (s) { return s.id === systemId; });
    if (!entry) return;
    if (entry.context && typeof setContext === "function") setContext(entry.context);
    if (entry.tab && typeof switchTab === "function") {
      const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('" + entry.tab + "'\"]");
      switchTab(entry.tab, btn || null);
    }

    const st = ensureStoryState();
    if (st.completedSystems.indexOf(systemId) < 0) st.completedSystems.push(systemId);
  }

  function ensureStoryTab() {
    const nav = document.querySelector("nav");
    const panelHost = document.getElementById("tab-map") ? document.getElementById("tab-map").parentElement : null;
    if (!nav || !panelHost) return;

    const storylineButtons = Array.from(nav.querySelectorAll('.tab-btn')).filter(function (btn) {
      if (!btn) return false;
      if (btn.id === 'tabnav-storyline') return true;
      if (btn.getAttribute('data-tab') === STORY_TAB_ID) return true;
      const oc = String(btn.getAttribute('onclick') || '');
      return oc.indexOf("switchTab('" + STORY_TAB_ID + "'") >= 0;
    });
    if (storylineButtons.length > 1) {
      const keep = document.getElementById('tabnav-storyline') || storylineButtons[0];
      storylineButtons.forEach(function (btn) {
        if (btn !== keep && btn.parentElement) btn.parentElement.removeChild(btn);
      });
    }

    if (!document.getElementById('tabnav-storyline') && !document.querySelector(".tab-btn[onclick*=\"switchTab('" + STORY_TAB_ID + "'\"]")) {
      const btn = document.createElement("button");
      btn.className = "tab-btn ctx-traveling";
      btn.id = 'tabnav-storyline';
      btn.setAttribute('data-tab', STORY_TAB_ID);
      btn.setAttribute("onclick", "switchTab('" + STORY_TAB_ID + "',this)");
      btn.textContent = "Storyline";
      nav.appendChild(btn);
    }

    if (!document.getElementById("tab-" + STORY_TAB_ID)) {
      const panel = document.createElement("div");
      panel.className = "tab-panel";
      panel.id = "tab-" + STORY_TAB_ID;
      panelHost.appendChild(panel);
    }
  }

  function patchSwitchTabForStory() {
    if (typeof window.switchTab !== "function" || window._storylineSwitchPatched) return;
    window._storylineSwitchPatched = true;
    const base = window.switchTab;
    window.switchTab = function (tabId, btn) {
      const out = base.apply(this, arguments);
      if (tabId === STORY_TAB_ID) {
        renderStorylinePanel();
      }
      return out;
    };
  }

  function patchLoadForStory() {
    const baseLoad = typeof window.loadCharacter === "function" ? window.loadCharacter : null;
    if (!baseLoad || window._storylineLoadPatched) return;
    window._storylineLoadPatched = true;
    window.loadCharacter = function () {
      baseLoad.apply(this, arguments);
      ensureStoryState();
      renderStorylinePanel();
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureStoryState();
    ensureStoryTab();
    patchSwitchTabForStory();
    patchLoadForStory();
    patchStoryWheelHotkeys();
  });

  window.renderStorylinePanel = renderStorylinePanel;
  window.openStorylineTab = openStorylineTab;
  window.runStoryOption = runStoryOption;
  window.storyHasReq = hasReq;
  window.storyRenderRequirement = renderRequirement;
  window.storyConsumeBackpackAny = consumeBackpackAny;
  window.storyJumpSystem = jumpSystemById;
  window.storyAdjustOptionDread = adjustStoryOptionDread;
  window.storySetAssignee = storySetAssignee;
  window.storySetDecisionRole = storySetDecisionRole;
  window.storyOpenDialogueWheel = openStoryDialogueWheel;
  window.storyForceFallbackRoute = forceStoryFallbackRoute;
  window.storyWheelMove = storyWheelMove;
  window.storyWheelMoveDirectional = storyWheelMoveDirectional;
  window.storyWheelConfirm = storyWheelConfirm;
  window.storyWheelCancel = storyWheelCancel;
  window.storyWheelSelectIndex = storyWheelSelectIndex;

  window.storyAcceptFail = function () {
    const p = window._pendingStoryRoll;
    if (!p) { if (typeof closeModal === "function") closeModal(); return; }
    window._pendingStoryRoll = null;
    if (typeof closeModal === "function") closeModal();
    const outcome = p.option.fail || p.option.success;
    applyOutcome(p.sceneId, p.option, outcome, p.checkResult, p.decisionMeta);
    renderStorylinePanel();
  };

  window.storySpendTeamwork = function () {
    const p = window._pendingStoryRoll;
    if (!p) { if (typeof closeModal === "function") closeModal(); return; }
    const tmw = (typeof S !== "undefined" && typeof S.tmw === "number") ? S.tmw : 0;
    if (tmw < 3) {
      if (typeof showNotif === "function") showNotif("Need 3 Teamwork Points to spend.", "warn");
      return;
    }
    if (typeof changeCounter === "function") changeCounter("tmw", -3);
    else if (typeof S !== "undefined") S.tmw = Math.max(0, tmw - 3);
    const fakeCheck = Object.assign({}, p.checkResult, { success: true, teamworkConverted: true });
    const decisionMeta = Object.assign({}, p.decisionMeta || {}, { teamworkConverted: true });
    window._pendingStoryRoll = null;
    if (typeof closeModal === "function") closeModal();
    if (typeof showNotif === "function") showNotif("Spent 3 Teamwork to succeed. Story advances; no Successful Roll gained.", "good");
    applyOutcome(p.sceneId, p.option, normalizeOutcome(p.sceneId, p.option, p.option.success, "success"), fakeCheck, decisionMeta);
    renderStorylinePanel();
  };

  window.storyPushLuck = function () {
    const p = window._pendingStoryRoll;
    if (!p) { if (typeof closeModal === "function") closeModal(); return; }
    const pushDread = typeof stepUp === "function" ? stepUp(p.dreadDie) : Math.min(20, p.dreadDie + 2);
    const newCheck = rollStoryCheck(p.option.stat, pushDread, p.factionContext || inferOptionFactionKey(p.option));
    const statName = STAT_LABELS[p.option.stat] || p.option.stat;
    const actionLabel = newCheck.factionBonus
      ? (newCheck.action.total + " + " + newCheck.factionBonus + " = " + newCheck.effectiveTotal)
      : String(newCheck.action.total);
    window._pendingStoryRoll = null;
    if (typeof closeModal === "function") closeModal();
    if (newCheck.success) {
      if (typeof showNotif === "function") {
        showNotif("Push Luck succeeded! " + statName + " d" + newCheck.actionDie + " [" + actionLabel + "] vs D" + pushDread + " [" + newCheck.dread.total + "].", "good");
      }
      applyOutcome(p.sceneId, p.option, normalizeOutcome(p.sceneId, p.option, p.option.success, "success"), newCheck);
    } else {
      if (typeof showNotif === "function") {
        showNotif("Push Luck failed. " + statName + " d" + newCheck.actionDie + " [" + actionLabel + "] vs D" + pushDread + " [" + newCheck.dread.total + "]. +1 Teamwork.", "warn");
      }
      applyOutcome(p.sceneId, p.option, normalizeOutcome(p.sceneId, p.option, p.option.fail || p.option.success, "fail"), newCheck);
    }
    renderStorylinePanel();
  };
  window.storyPuzzlePress = function (value) {
    const p = ensurePuzzleSession();
    if (p.mode === "code" || p.mode === "crossword" || p.mode === "crossword_grid" || p.mode === "sudoku") return;
    if (p.mode === "memory") p.revealed = false;
    p.selected.push(String(value || ""));
    renderPuzzleModal();
  };
  window.storyPuzzleClear = function () {
    const p = ensurePuzzleSession();
    p.selected = [];
    p.revealed = false;
    const el = document.getElementById("storyPuzzleInput");
    if (el) el.value = "";
    renderPuzzleModal();
  };
  window.storyPuzzleReveal = function () {
    const p = ensurePuzzleSession();
    if (p.mode !== "memory") return;
    p.revealed = true;
    renderPuzzleModal();
  };
  window.storyPuzzleRollForClue = rollStoryPuzzleClue;
  window.storyPuzzleResolve = function (attemptSubmit) {
    const p = ensurePuzzleSession();
    if (p.externalResolve) {
      let result = "fail";
      const tier = p.externalThresholds || { success: 0.7, partial: 0.45 };
      if (attemptSubmit) {
        const score = puzzleAttemptScore();
        if (score >= tier.success || puzzleSuccessByInput()) result = "success";
        else if (score >= tier.partial) result = "partial";
        else {
          if (typeof showNotif === "function") {
            showNotif("Puzzle attempt: " + Math.round(score * 100) + "% accuracy. Need " + Math.round(tier.partial * 100) + "% for partial progress.", "warn");
          }
          return;
        }
      }

      const resolver = p.externalResolve;
      if (typeof closeModal === "function") closeModal();
      resetPuzzleSession();
      try { resolver(result); } catch (_err) { console.error(_err); }
      return;
    }
    const scene = SCENES[p.sceneId];
    if (!scene) return;
    const option = (scene.options || []).find(function (o) { return o.id === p.optionId; });
    if (!option) return;

    let result = "fail";
    if (attemptSubmit) {
      const score = puzzleAttemptScore();
      const tier = puzzleTierForScene(p.sceneId);
      if (score >= tier.success || puzzleSuccessByInput()) result = "success";
      else if (score >= tier.partial) result = "partial";
      else {
        if (typeof showNotif === "function") {
          showNotif("Puzzle attempt: " + Math.round(score * 100) + "% accuracy. Need " + Math.round(tier.partial * 100) + "% for partial progress.", "warn");
        }
        return;
      }
    }

    if (typeof closeModal === "function") closeModal();
    resolveStoryOption(p.sceneId, option, result);
    resetPuzzleSession();
  };
  window.openStandaloneStoryPuzzle = openStandaloneStoryPuzzle;
})();
