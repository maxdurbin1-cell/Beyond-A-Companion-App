// faction-system.js — Advanced Faction System with Multiple Story Pathways
// Features: Faction Lore, Relations, Missions, Trust/Betrayal, Multiple Endings
(function () {
  const FACTION_TAB_ID = "factions";
  const ENDINGS_TAB_ID = "endings";
  const FINAL_ENDING_THRESHOLD = 5;

  // ============================================================================
  // FACTION DEFINITIONS — Each faction has lore, beliefs, missions, and dynamics
  // ============================================================================

  const FACTIONS = {
    corporations: {
      id: "corporations",
      name: "The Syndicate Corporations",
      emoji: "💼",
      color: "#c9a227",
      essence: "Profit, Order, Control",
      motto: "Everything has a price. Everything has a buyer.",
      lore: `The Syndicate Corporations rule the golden cities through wealth and infrastructure. They own the ports, the power grids, the communication networks. Their executives are shadowy; their reach is absolute. They believe the world needs hierarchy—a ladder of value where the strong climb and the weak serve. To them, power is economic power, and loyalty is for sale.`,
      philosophy: "The greatest sin is inefficiency. The greatest virtue is profit.",
      idealEnding: "golden",
      betrayalCost: { credits: -500, reputation: -3, trust: -2 },
      trustReward: { credits: 1000, power: 2 },
      factionMissions: [
        {
          id: "corp_m1",
          title: "Audit the Rebels",
          desc: "Infiltrate rebel holdings and report asset inventories.",
          reward: 200,
          difficulty: "hard",
          alignment: "corporate",
          pathways: {
            heroic: "You could warn the rebels instead.",
            tyrant: "Burn everything so there's nothing left to steal.",
            martyr: "Stay behind to cover their escape.",
          }
        },
        {
          id: "corp_m2",
          title: "Broker a Peace Deal",
          desc: "Negotiate between warring subsidiaries for 15% commission.",
          reward: 300,
          difficulty: "medium",
          alignment: "political",
          pathways: {
            tyrant: "Deliberately extend the conflict for interest payments.",
            heroic: "Broker genuine peace at no cost.",
            martyr: "Take a fatal wound to seal the agreement.",
          }
        },
        {
          id: "corp_m3",
          title: "Secure a Monopoly",
          desc: "Purchase exclusive rights to a rare resource.",
          reward: 150,
          difficulty: "medium",
          alignment: "corporate",
          pathways: {
            heroic: "Leave enough for locals to survive.",
            tyrant: "Buy it all. Let them starve.",
            martyr: "Give your share to the poor.",
          }
        }
      ]
    },

    religious: {
      id: "religious",
      name: "The Sacred Choir",
      emoji: "⛪",
      color: "#b060d0",
      essence: "Faith, Transcendence, Purpose",
      motto: "Beyond flesh lies truth. Beyond truth lies the Light.",
      lore: `The Sacred Choir believes the universe is woven with divine purpose. They maintain temples in every city, healing shrines in every hamlet. Their priesthood claims direct communion with something beyond—whether god, cosmic consciousness, or ancient AI awakened is a matter of doctrine. They seek to elevate humanity beyond its broken state, though the methods are... debated.`,
      philosophy: "Suffering purifies. Truth liberates. The flesh is temporary; the spirit is eternal.",
      idealEnding: "transcendent",
      betrayalCost: { curse: 1, reputation: -2, stress: 2 },
      trustReward: { blessing: 1, clarity: 1 },
      factionMissions: [
        {
          id: "rel_m1",
          title: "Purge the Heretics",
          desc: "Eliminate scholars spreading 'false doctrine' about the Light.",
          reward: 250,
          difficulty: "very_hard",
          alignment: "zealous",
          pathways: {
            tyrant: "Kill them all. No mercy.",
            heroic: "Warn them and let them flee.",
            martyr: "Take their curses upon yourself to save them.",
          }
        },
        {
          id: "rel_m2",
          title: "Pilgrimage of the Broken",
          desc: "Guide suffering pilgrims to a shrine. Heal what you can.",
          reward: 100,
          difficulty: "easy",
          alignment: "blessed",
          pathways: {
            heroic: "Truly heal them. Use your own resources.",
            tyrant: "Rob them and leave them at the shrine's steps.",
            martyr: "Absorb their illnesses into yourself.",
          }
        },
        {
          id: "rel_m3",
          title: "Recover the Relic",
          desc: "Retrieve a sacred artifact from pagan hands.",
          reward: 350,
          difficulty: "challenging",
          alignment: "religious",
          pathways: {
            heroic: "Learn why they hold it. Negotiate its return.",
            tyrant: "Massacre the village. Take the relic.",
            martyr: "Destroy it to prevent its misuse.",
          }
        }
      ]
    },

    military: {
      id: "military",
      name: "The Iron Cohort",
      emoji: "⚔️",
      color: "#e05050",
      essence: "Strength, Discipline, Victory",
      motto: "The strongest survive. The disciplined thrive. The weak are lessons.",
      lore: `The Iron Cohort is the military machine that holds the fragmented world together—or so they claim. They coordinate fortifications, maintain supply lines, and execute campaigns against "threats to stability." They are merit-based, organized, and absolutely committed to their vision of order through martial force. Betrayal within the ranks is punished swiftly.`,
      philosophy: "Discipline creates strength. Weakness is contagion. Victory justifies all methods.",
      idealEnding: "triumphant",
      betrayalCost: { court_martial: 1, reputation: -3, honor: -2 },
      trustReward: { rank: 1, honor: 2 },
      factionMissions: [
        {
          id: "mil_m1",
          title: "Execute the Deserters",
          desc: "Hunt down soldiers who fled the latest campaign.",
          reward: 200,
          difficulty: "hard",
          alignment: "martial",
          pathways: {
            tyrant: "Make an example. Display the bodies.",
            heroic: "Let them escape. Report them dead.",
            martyr: "Take their place. Flee yourself.",
          }
        },
        {
          id: "mil_m2",
          title: "Secure the Supply Line",
          desc: "Clear bandits and saboteurs from the Pass.",
          reward: 150,
          difficulty: "medium",
          alignment: "martial",
          pathways: {
            heroic: "Use minimal violence. Negotiate where possible.",
            tyrant: "Kill everything that moves.",
            martyr: "Fall in battle so allies can escape.",
          }
        },
        {
          id: "mil_m3",
          title: "Assault the Rebel Stronghold",
          desc: "Lead a raid against the Uprising's primary base.",
          reward: 500,
          difficulty: "impossible",
          alignment: "martial",
          pathways: {
            tyrant: "Burn it all. Kill the wounded.",
            heroic: "Minimize casualties on both sides.",
            martyr: "Die taking the objective.",
          }
        }
      ]
    },

    underworld: {
      id: "underworld",
      name: "The Underground Crown",
      emoji: "👑",
      color: "#1a3a2c",
      essence: "Shadow, Survival, Freedom",
      motto: "The law is for the safe. We are the survivors.",
      lore: `The Underground Crown exists in the spaces between official laws. They are thieves, smugglers, fences, and assassins—but also the network that helps refugees, hides the hunted, and remembers when the powerful try to rewrite history. They operate on trust and blood-oaths. Their code is simple: loyalty to the Crown, silence to outsiders, death to informants.`,
      philosophy: "Loyalty is everything. Silence is sacred. The strong take; the smart survive.",
      idealEnding: "shadowed",
      betrayalCost: { bounty: 1, reputation: -4, safety: -3 },
      trustReward: { protection: 2, secrets: 1 },
      factionMissions: [
        {
          id: "under_m1",
          title: "Steal from the Temples",
          desc: "Liberate 'donation funds' from the Sacred Choir.",
          reward: 180,
          difficulty: "challenging",
          alignment: "criminal",
          pathways: {
            tyrant: "Burn the temple. Kill the monks.",
            heroic: "Return the money to the poor.",
            martyr: "Get caught. Let your crew escape.",
          }
        },
        {
          id: "under_m2",
          title: "Eliminate an Informant",
          desc: "Erase a corporate spy who's been bleeding secrets.",
          reward: 250,
          difficulty: "hard",
          alignment: "shadowed",
          pathways: {
            tyrant: "Make it slow. Make it terrible.",
            heroic: "Just make it quick.",
            martyr: "Sacrifice yourself in their place.",
          }
        },
        {
          id: "under_m3",
          title: "Run Contraband Through the Blockade",
          desc: "Smuggle medicine, weapons, or refugees past military lines.",
          reward: 200,
          difficulty: "hard",
          alignment: "survival",
          pathways: {
            heroic: "Protect the cargo at all costs.",
            tyrant: "Sell half to the highest bidder.",
            martyr: "Go down with the ship so others escape.",
          }
        }
      ]
    },

    rebels: {
      id: "rebels",
      name: "The Uprising",
      emoji: "✊",
      color: "#e8c050",
      essence: "Justice, Freedom, Revolution",
      motto: "The world can be remade. We are the hammer.",
      lore: `The Uprising believes the current order is corrupt beyond repair. They fight for the dispossessed, the forgotten, the ones left behind by corporate and military hierarchies. They are fractious, idealistic, and willing to sacrifice everything for a better world—but cannot agree on what that world should look like. Factions within factions. Hope and doubt, equally matched.`,
      philosophy: "The system cannot be reformed; it must be broken. Freedom requires sacrifice.",
      idealEnding: "liberated",
      betrayalCost: { reputation: -3, allies: -2 },
      trustReward: { allies: 2, hope: 1 },
      factionMissions: [
        {
          id: "reb_m1",
          title: "Sabotage the Power Grid",
          desc: "Disable power distribution to weaken corporate control.",
          reward: 200,
          difficulty: "challenging",
          alignment: "revolutionary",
          pathways: {
            tyrant: "Leave it destroyed. Let the hospitals go dark.",
            heroic: "Restore power after making your point.",
            martyr: "Detonate yourself in the central hub.",
          }
        },
        {
          id: "reb_m2",
          title: "Recruit from the Desperate",
          desc: "Find and train new fighters among the starving.",
          reward: 100,
          difficulty: "easy",
          alignment: "revolutionary",
          pathways: {
            heroic: "Give them real choice. Real hope.",
            tyrant: "Lie. Promise what you can't deliver.",
            martyr: "Take their place if too many will die.",
          }
        },
        {
          id: "reb_m3",
          title: "Assassinate the Council Speaker",
          desc: "Remove the face of corporate tyranny.",
          reward: 400,
          difficulty: "very_hard",
          alignment: "revolutionary",
          pathways: {
            tyrant: "Kill their entire family too.",
            heroic: "Kill only the Speaker. Let the family live.",
            martyr: "Take the blame. Go to your execution.",
          }
        }
      ]
    },

    scholars: {
      id: "scholars",
      name: "The Archive Keepers",
      emoji: "📚",
      color: "#6ed090",
      essence: "Knowledge, Truth, Understanding",
      motto: "Truth is the only power that cannot be seized.",
      lore: `The Archive Keepers are scattered across the ruins of the old world, preserving knowledge in hidden libraries and clandestine universities. They believe that understanding the past is the only way to forge a better future. They're neutral in most conflicts—but neutrality, they insist, is a choice, and some truths are too dangerous to suppress.`,
      philosophy: "Knowledge should be free. Some truths are worth dying for. Understanding is the path to wisdom.",
      idealEnding: "enlightened",
      betrayalCost: { knowledge: -2, reputation: -2 },
      trustReward: { knowledge: 2, clarity: 1 },
      factionMissions: [
        {
          id: "sch_m1",
          title: "Recover the Forbidden Texts",
          desc: "Find pre-collapse technical archives before they're destroyed.",
          reward: 150,
          difficulty: "hard",
          alignment: "scholarly",
          pathways: {
            heroic: "Preserve and share the knowledge.",
            tyrant: "Sell to the highest bidder.",
            martyr: "Die protecting the archives from fire.",
          }
        },
        {
          id: "sch_m2",
          title: "Teach the Illiterate",
          desc: "Establish a school in a remote village despite opposition.",
          reward: 80,
          difficulty: "medium",
          alignment: "noble",
          pathways: {
            heroic: "Build it strong. Mentor them truly.",
            tyrant: "Teach false doctrine. Control their minds.",
            martyr: "Stay behind when the military comes.",
          }
        },
        {
          id: "sch_m3",
          title: "Expose the Conspiracy",
          desc: "Publish evidence that government agencies created the Plague.",
          reward: 300,
          difficulty: "impossible",
          alignment: "truth",
          pathways: {
            heroic: "Release it. Accept the consequences.",
            tyrant: "Use it to extort the government.",
            martyr: "Die taking the evidence to press.",
          }
        }
      ]
    }
  };

  const FACTION_ACTION_DIE_MAP = {
    corporations: "control",
    religious: "spirit",
    military: "strike",
    underworld: "control",
    rebels: "lead",
    scholars: "mind",
    political: "lead",
  };

  const FACTION_LORE_ROLE_MAP = {
    corporations: "Brokers",
    religious: "Mages",
    military: "Warriors",
    underworld: "Rogues",
    rebels: "Vanguards",
    scholars: "Sages",
    political: "Envoys",
  };

  const BASE_REGION_TYPES = [
    "Sea Region Hex Map",
    "Province Map",
    "Galaxy Map",
    "Random Planet",
    "World That Was",
  ];

  const BASE_FLAVOR = {
    corporations: {
      names: ["Ledger Bastion", "Golden Audit Spire", "Dividend Vault", "Mercantile Spine"],
      details: ["armed accountants", "sealed transaction courts", "private drone docks", "writ-enforced checkpoints"],
      taskVerbs: ["audit", "secure", "broker", "extract"],
      taskTargets: ["shadow contracts", "shipping ledgers", "proxy directors", "fuel futures"],
      missionHooks: ["buy out a rival route", "silence an embezzlement ring", "recover a vanished escrow AI", "enforce a debt embargo"],
    },
    religious: {
      names: ["Choir Reliquary", "Sanctum of the Last Hymn", "Ashen Cathedral", "Pilgrim Spiral"],
      details: ["candlelit surgical bays", "trial chapels", "choirs under vow", "penitent processions"],
      taskVerbs: ["sanctify", "escort", "investigate", "recover"],
      taskTargets: ["a broken relic", "a missing cantor", "a blasphemous codex", "a cursed hospice wing"],
      missionHooks: ["judge a miracle as fraud or truth", "cleanse a shrine seized by raiders", "guard a midnight pilgrimage", "trace false prophecy broadcasts"],
    },
    military: {
      names: ["Iron Redoubt", "Cohort Citadel", "Siege Registry", "Bastion Nine"],
      details: ["drill yards", "munitions depots", "war councils", "strict curfews"],
      taskVerbs: ["fortify", "recon", "intercept", "drill"],
      taskTargets: ["a breached wall", "hostile scouts", "stolen munitions", "a mutinous platoon"],
      missionHooks: ["hold a chokepoint until dawn", "rescue a trapped convoy", "retake a silent watchtower", "break a siege beacon network"],
    },
    underworld: {
      names: ["Crown Hollow", "Black Lantern Den", "Ratline Court", "Whisper Forge"],
      details: ["hidden tunnels", "coded taverns", "smuggler shrines", "lookouts on every rooftop"],
      taskVerbs: ["smuggle", "tail", "blackmail", "stash"],
      taskTargets: ["a marked witness", "a sealed cargo canister", "a double agent", "a vanished fence"],
      missionHooks: ["run medicine through a military cordon", "steal a priest's confession archive", "extract a turncoat alive", "replace bounty posters with forgeries"],
    },
    rebels: {
      names: ["People's Switchyard", "The Red Assembly", "Freewire Camp", "Hammerfall Commune"],
      details: ["crowded planning tents", "jury-rigged comm towers", "public debate pits", "shared kitchens"],
      taskVerbs: ["recruit", "sabotage", "evacuate", "broadcast"],
      taskTargets: ["a captured cell", "a power relay", "a ration convoy", "a hidden press node"],
      missionHooks: ["spark a synchronized strike", "escort families out of a kill-zone", "hijack propaganda feeds", "trade hostages for ceasefire hours"],
    },
    scholars: {
      names: ["Archive Vault 7", "The Lantern Athenaeum", "Dustglass Institute", "Quiet Stack Citadel"],
      details: ["sealed stacks", "field laboratories", "cipher circles", "forbidden reading rooms"],
      taskVerbs: ["catalog", "decode", "preserve", "cross-examine"],
      taskTargets: ["a fractured star-chart", "court transcripts", "contaminated samples", "a pre-collapse core"],
      missionHooks: ["recover a lost thesis from raider hands", "verify plague-origin evidence", "escort novice archivists", "negotiate for restricted manuscripts"],
    },
  };

  const GUILD_PRESENTATION = {
    corporations: {
      displayName: "The Gilded Ledger",
      boardLabel: "Ledger Board",
      shopLabel: "Market Quartermaster",
      contractLabel: "Guild Contracts",
      campaignTag: "Campaign live"
    },
    religious: {
      displayName: "The Sacred Choir",
      boardLabel: "Choir Board",
      shopLabel: "Reliquary Quartermaster",
      contractLabel: "Guild Contracts",
      campaignTag: "Pilot campaign live"
    },
    military: {
      displayName: "The Iron Cohort",
      boardLabel: "War Table",
      shopLabel: "Armory Quartermaster",
      contractLabel: "Bounty Board",
      campaignTag: "Pilot campaign live"
    },
    underworld: {
      displayName: "The Underground Crown",
      boardLabel: "Whisper Board",
      shopLabel: "Crown Quartermaster",
      contractLabel: "Guild Contracts",
      campaignTag: "Campaign live"
    },
    rebels: {
      displayName: "The Ember Union",
      boardLabel: "Union Board",
      shopLabel: "Union Quartermaster",
      contractLabel: "Guild Contracts",
      campaignTag: "Campaign live"
    },
    scholars: {
      displayName: "The Archive Keepers",
      boardLabel: "Archive Board",
      shopLabel: "Archive Quartermaster",
      contractLabel: "Guild Contracts",
      campaignTag: "Campaign live"
    }
  };

  const GUILD_DREAD_DICE = [4, 6, 8, 10, 12, 20];

  const MILITARY_GUILD_CAMPAIGN = {
    factionId: "military",
    questLabel: "Iron Cohort Campaign",
    contractFlavor: "Bounties, deserter dragnets, raids, and security orders.",
    shopFlavor: "Weapon mods, armor kits, and tactical tools.",
    quests: [
      {
        id: "cohort_1",
        title: "Take the Cohort Oath",
        difficulty: "medium",
        region: "province",
        location: "Bastion Nine Tribunal",
        templateLabel: "Guild Campaign I",
        stepNames: { 1: "Review the Warrant", 2: "Track the First Lead", 3: "Make the Arrest" },
        checkpoints: [
          "Hear the case against the first marked target.",
          "Follow provincial testimony to a safehouse.",
          "Decide whether the Cohort's version of justice holds."
        ],
        lore: "The Cohort tests whether you can carry a warrant without mistaking cruelty for discipline.",
        prepUnlockId: "suspect_dossier"
      },
      {
        id: "cohort_2",
        title: "Board of the Wanted",
        difficulty: "hard",
        region: "province",
        location: "Three-Lead Provincial Circuit",
        templateLabel: "Guild Campaign II",
        stepNames: { 1: "Collect Bounty Leads", 2: "Pressure the Route", 3: "Take the Mark" },
        checkpoints: [
          "Question three bounty-board witnesses.",
          "Cut off the target's route through the province.",
          "Secure proof that the board is not lying to you."
        ],
        lore: "Every bounty poster hides a politics problem. The Cohort wants obedience; the field wants truth.",
        prepUnlockId: "shock_manacles"
      },
      {
        id: "cohort_3",
        title: "Dead or Breathing",
        difficulty: "hard",
        region: "sea",
        location: "Storm Pier Extradition Route",
        templateLabel: "Guild Campaign III",
        stepNames: { 1: "Read the Harbor Brief", 2: "Board the Storm Route", 3: "Capture or Kill" },
        checkpoints: [
          "Determine why the alive payout suddenly doubled.",
          "Run the pier pursuit through storm traffic.",
          "Stop the deserter before they reach open water."
        ],
        lore: "A pirate deserter knows too much about who profits from the Cohort's bounty office.",
        prepUnlockId: "breach_load"
      },
      {
        id: "cohort_4",
        title: "The Planetary Redlist",
        difficulty: "challenging",
        region: "galaxy",
        location: "Planetfall: Redlist Frontier Colony",
        templateLabel: "Guild Campaign IV",
        stepNames: { 1: "Review War Records", 2: "Hunt the Colony Grid", 3: "Break the Armor Line" },
        checkpoints: [
          "Search a battle-scarred colony for the listed war criminal.",
          "Harvest old munitions from wrecked armor.",
          "Push through fortified resistance before the target slips orbit."
        ],
        lore: "The Redlist proves the Cohort's enemies learned to survive by stealing its own doctrine.",
        prepUnlockId: "signal_jammer"
      },
      {
        id: "cohort_5",
        title: "Orbit of the Hunted",
        difficulty: "challenging",
        region: "galaxy",
        location: "Outer Relay Warrant Spine",
        templateLabel: "Guild Campaign V",
        stepNames: { 1: "Map the Leak", 2: "Crack the Relay", 3: "Seize the Data" },
        checkpoints: [
          "Find who is selling bounty data to mercenaries.",
          "Infiltrate the orbital relay under live command pressure.",
          "Pull the leak list before the relay wipes itself."
        ],
        lore: "Someone inside the Cohort has weaponized warrants into a private war economy.",
        prepUnlockId: "killbox_blueprint"
      },
      {
        id: "cohort_6",
        title: "Bring Down the Iron Hound",
        difficulty: "very_hard",
        region: "province",
        location: "World That Was Siege District",
        templateLabel: "Guild Campaign VI",
        stepNames: { 1: "Read the Kill Corridors", 2: "Cross the Siege Grid", 3: "Defeat Captain Veyr" },
        checkpoints: [
          "Study mine maps and false surrender sites.",
          "Advance through a district built to punish hesitation.",
          "Drop the lieutenant before the war table collapses."
        ],
        lore: "Captain Veyr, the Iron Hound, turned pursuit doctrine into an art of public terror.",
        prepUnlockId: "wakeleaf_stimulant"
      },
      {
        id: "cohort_7",
        title: "The Gallows Engine",
        difficulty: "impossible",
        region: "province",
        location: "World That Was Blacksite Gallows",
        templateLabel: "Guild Boss Hunt",
        stepNames: { 1: "Break the Blacksite Route", 2: "Storm the Gallows Core", 3: "Defeat the Warrant Tyrant" },
        checkpoints: [
          "Use your gathered prep to cut into the execution engine.",
          "Disable the command spine before the tyrant takes the field.",
          "End the doctrine that turned warrants into mechanized slaughter."
        ],
        lore: "The rogue warlord behind the Cohort leak has fused the bounty office into a living execution machine.",
        prepUnlockId: "",
        isBoss: true
      }
    ],
    prepOptions: [
      {
        id: "suspect_dossier",
        name: "Suspect Dossier",
        source: "Quest I reward",
        summary: "+5 bonus on your next guild campaign mission.",
        effectType: "bonus",
        bonus: 5
      },
      {
        id: "shock_manacles",
        name: "Shock Manacles",
        source: "Quest II reward",
        summary: "Step down one mission dread die once.",
        effectType: "dread_down",
        dreadSteps: 1
      },
      {
        id: "breach_load",
        name: "Breach Load",
        source: "Quest III reward",
        summary: "+5 bonus from armor-breaking munitions.",
        effectType: "bonus",
        bonus: 5
      },
      {
        id: "signal_jammer",
        name: "Signal Jammer",
        source: "Quest IV reward",
        summary: "Step down one command-linked dread die once.",
        effectType: "dread_down",
        dreadSteps: 1
      },
      {
        id: "killbox_blueprint",
        name: "Killbox Blueprint",
        source: "Quest V reward",
        summary: "+5 bonus from mapped ambush lanes.",
        effectType: "bonus",
        bonus: 5
      },
      {
        id: "wakeleaf_stimulant",
        name: "Wakeleaf Stimulant",
        source: "Quest VI reward",
        summary: "+5 bonus from a sharpened opening push.",
        effectType: "bonus",
        bonus: 5
      }
    ]
  };

  const SACRED_CHOIR_GUILD_CAMPAIGN = {
    factionId: "religious",
    questLabel: "Sacred Choir Campaign",
    contractFlavor: "Monster hunts, shrine cleansings, relic recoveries, and portal seal orders.",
    shopFlavor: "Spell scrolls, sanctified reagents, and ritual wards.",
    quests: [
      {
        id: "choir_1",
        title: "Oath at the Ashen Nave",
        difficulty: "medium",
        region: "province",
        location: "Ashen Nave Trial Chapel",
        templateLabel: "Guild Campaign I",
        stepNames: { 1: "Receive the Oath", 2: "Endure the Haunting", 3: "Sanctify the Nave" },
        checkpoints: [
          "Swear the choir oath before a divided clergy panel.",
          "Survive a controlled haunting in the trial nave.",
          "Choose doctrine or compassion to complete initiation."
        ],
        lore: "The Choir tests whether your faith can hold under fear and whether mercy still survives in ritual law.",
        prepUnlockId: "blessed_ash"
      },
      {
        id: "choir_2",
        title: "Flowers for the Hollowing",
        difficulty: "hard",
        region: "province",
        location: "Moon-Bloom Marsh Ruin",
        templateLabel: "Guild Campaign II",
        stepNames: { 1: "Map Bloom Sites", 2: "Harvest Under Threat", 3: "Distill the Poultice" },
        checkpoints: [
          "Trace where the moon-bloom still grows in plague marshes.",
          "Hold the harvest route against rift fauna.",
          "Distill anti-curse reagents before they spoil."
        ],
        lore: "The flowers that neutralize monster venom only bloom where the old wards failed.",
        prepUnlockId: "moon_bloom_poultice"
      },
      {
        id: "choir_3",
        title: "Bells Beneath the Tides",
        difficulty: "hard",
        region: "sea",
        location: "Drowned Bell Anchorage",
        templateLabel: "Guild Campaign III",
        stepNames: { 1: "Read Pilgrim Logs", 2: "Dive the Bell Chamber", 3: "Silence the Call" },
        checkpoints: [
          "Gather survivor testimony from drowned-pier pilgrims.",
          "Enter a flooded bell vault beneath storm docks.",
          "Stop the signal drawing monsters ashore."
        ],
        lore: "A buried bell array has become a hunting horn for things that should not answer prayer.",
        prepUnlockId: "grave_salt_circle"
      },
      {
        id: "choir_4",
        title: "Choir of Red Stars",
        difficulty: "challenging",
        region: "galaxy",
        location: "Orbital Shrine Relay",
        templateLabel: "Guild Campaign IV",
        stepNames: { 1: "Decode the Broadcast", 2: "Breach the Shrine Ring", 3: "Burn the False Miracle" },
        checkpoints: [
          "Identify who seeded the miracle transmission.",
          "Cross a shrine station overrun by echo entities.",
          "Sever the source before the signal cascades planetside."
        ],
        lore: "A counterfeit miracle broadcast is opening doors the Choir spent generations keeping shut.",
        prepUnlockId: "null_hymnal"
      },
      {
        id: "choir_5",
        title: "The Child and the Gate",
        difficulty: "challenging",
        region: "galaxy",
        location: "Planetfall: Scarred Gate Basin",
        templateLabel: "Guild Campaign V",
        stepNames: { 1: "Escort the Marked Child", 2: "Stabilize the Basin", 3: "Seal the Gate" },
        checkpoints: [
          "Protect Ivo across hostile approach lines.",
          "Contain a widening portal basin before collapse.",
          "Use the marked resonance to lock the gate."
        ],
        lore: "A child marked by portal light may be the only living key to close the basin without mass loss.",
        prepUnlockId: "gate_salt"
      },
      {
        id: "choir_6",
        title: "Hunt of the Reliquary Beast",
        difficulty: "very_hard",
        region: "province",
        location: "World That Was Chapel-City",
        templateLabel: "Guild Campaign VI",
        stepNames: { 1: "Track the Feeding Rite", 2: "Cross Bone-Glass Streets", 3: "Defeat the Reliquary Beast" },
        checkpoints: [
          "Follow ritual traces through the dead chapel district.",
          "Secure enough relic ash to survive the beast's aura.",
          "Drop the lieutenant before it reaches the flesh vault."
        ],
        lore: "The Reliquary Beast guards the path to a deeper sanctum where faith has turned predatory.",
        prepUnlockId: "saintsbane_oil"
      },
      {
        id: "choir_7",
        title: "The Choir Below Flesh",
        difficulty: "impossible",
        region: "province",
        location: "World That Was Flesh Reliquary",
        templateLabel: "Guild Boss Hunt",
        stepNames: { 1: "Break the Reliquary Seal", 2: "Survive the Halo Chamber", 3: "Defeat the Halo Devourer" },
        checkpoints: [
          "Spend gathered prep to breach the flesh reliquary.",
          "Disrupt the active portal halo before full incarnation.",
          "End the saint-beast choir before the city falls silent."
        ],
        lore: "Something below the old basilica has been feeding on hymn, blood, and portal light long enough to become divine in all the wrong ways.",
        prepUnlockId: "",
        isBoss: true
      }
    ],
    prepOptions: [
      {
        id: "blessed_ash",
        name: "Blessed Ash",
        source: "Quest I reward",
        summary: "+5 bonus from sanctified ward markings.",
        effectType: "bonus",
        bonus: 5
      },
      {
        id: "moon_bloom_poultice",
        name: "Moon-Bloom Poultice",
        source: "Quest II reward",
        summary: "Step down one toxic or curse-linked dread die once.",
        effectType: "dread_down",
        dreadSteps: 1
      },
      {
        id: "grave_salt_circle",
        name: "Grave Salt Circle",
        source: "Quest III reward",
        summary: "+5 bonus from sealed summon lanes.",
        effectType: "bonus",
        bonus: 5
      },
      {
        id: "null_hymnal",
        name: "Null Hymnal",
        source: "Quest IV reward",
        summary: "Step down one portal-echo dread die once.",
        effectType: "dread_down",
        dreadSteps: 1
      },
      {
        id: "gate_salt",
        name: "Gate Salt",
        source: "Quest V reward",
        summary: "+5 bonus from anti-summon seal prep.",
        effectType: "bonus",
        bonus: 5
      },
      {
        id: "saintsbane_oil",
        name: "Saintsbane Oil",
        source: "Quest VI reward",
        summary: "+5 bonus from anti-relic strike oil.",
        effectType: "bonus",
        bonus: 5
      }
    ]
  };

  const GILDED_LEDGER_GUILD_CAMPAIGN = {
    factionId: "corporations",
    questLabel: "Gilded Ledger Campaign",
    contractFlavor: "Asset seizures, debt enforcement, and warrant recoveries.",
    shopFlavor: "Contract tools, market tech, and executive defenses.",
    quests: [
      { id: "ledger_1", title: "Sign the Golden Writ", difficulty: "medium", region: "province", location: "Red Ink Exchange", templateLabel: "Guild Campaign I", stepNames: { 1: "Audit the Petition", 2: "Inspect the Claim", 3: "Issue the Writ" }, checkpoints: ["Review debt claims and forged counterclaims.", "Follow the writ trail to a contested district.", "Choose who receives legal force and who loses protection."], lore: "The Ledger initiates you by proving value can be weaponized faster than guns.", prepUnlockId: "debt_dossier" },
      { id: "ledger_2", title: "Harbor of Red Ink", difficulty: "hard", region: "sea", location: "Storm Ledger Anchorage", templateLabel: "Guild Campaign II", stepNames: { 1: "Trace Cargo Bonds", 2: "Board the Debt Ship", 3: "Secure the Registry" }, checkpoints: ["Decode bonded cargo manifests.", "Cross storm security and private guards.", "Capture the live registry before it is scuttled."], lore: "A smuggled debt ship carries proof that famine routes were auctioned in secret.", prepUnlockId: "counterfeit_warrant" },
      { id: "ledger_3", title: "Witness Against the Balance", difficulty: "hard", region: "province", location: "Quarry Tribunal Fringe", templateLabel: "Guild Campaign III", stepNames: { 1: "Find the Witness", 2: "Break the Cover-Up", 3: "Extract Testimony" }, checkpoints: ["Locate Tamsin before rival brokers do.", "Defeat hired silence teams.", "Get testimony to a neutral court node."], lore: "A single witness can collapse an executive board if she survives one night.", prepUnlockId: "dock_bribe_network" },
      { id: "ledger_4", title: "Dead Planet, Live Assets", difficulty: "challenging", region: "planet", location: "Trade Moon Vaultfall", templateLabel: "Guild Campaign IV", stepNames: { 1: "Survey the Derelict", 2: "Break Salvager Claims", 3: "Extract the Core" }, checkpoints: ["Map surviving vault corridors.", "Defeat mercenary salvage teams.", "Recover the asset core without meltdown."], lore: "The moon's old vault still prices people as collateral.", prepUnlockId: "asset_tracker_pin" },
      { id: "ledger_5", title: "The Quiet Auction", difficulty: "challenging", region: "galaxy", location: "Orbital Exchange Nine", templateLabel: "Guild Campaign V", stepNames: { 1: "Enter the Auction", 2: "Spoof the Bids", 3: "Crash the Sale" }, checkpoints: ["Infiltrate a permit-only exchange.", "Hijack bid telemetry without exposure.", "Stop sale of famine route rights."], lore: "The market has begun selling shortages as a premium commodity.", prepUnlockId: "market_sabotage" },
      { id: "ledger_6", title: "Bite of the Reclamation Hound", difficulty: "very_hard", region: "wtw", location: "World That Was Credit Ruin", templateLabel: "Guild Campaign VI", stepNames: { 1: "Track Repossession Strikes", 2: "Cut the Kill Corridor", 3: "Defeat the Hound" }, checkpoints: ["Map forced-eviction kill routes.", "Disable seizure drones and trackers.", "Drop the lieutenant before it broadcasts your debt mark."], lore: "The Reclamation Hound enforces contracts by turning neighborhoods into examples.", prepUnlockId: "bondbreaker_charge" },
      { id: "ledger_7", title: "The Counting House Below", difficulty: "impossible", region: "wtw", location: "Subterranean Counting Engine", templateLabel: "Guild Boss Hunt", stepNames: { 1: "Breach the Debt Core", 2: "Shatter the Margin Rings", 3: "Defeat the Golden Comptroller" }, checkpoints: ["Use gathered prep to break into the engine floor.", "Disable margin rings that feed defense swarms.", "Destroy the comptroller before liquidation protocol completes."], lore: "An ancient profit engine fused with flesh has become the city\'s true sovereign.", prepUnlockId: "", isBoss: true }
    ],
    prepOptions: [
      { id: "debt_dossier", name: "Debt Dossier", source: "Quest I reward", summary: "+5 bonus on your next guild operation.", effectType: "bonus", bonus: 5 },
      { id: "counterfeit_warrant", name: "Counterfeit Warrant", source: "Quest II reward", summary: "Step down one security-linked dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "dock_bribe_network", name: "Dock Bribe Network", source: "Quest III reward", summary: "+5 bonus from insider route access.", effectType: "bonus", bonus: 5 },
      { id: "asset_tracker_pin", name: "Asset Tracker Pin", source: "Quest IV reward", summary: "Step down one pursuit-linked dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "market_sabotage", name: "Market Sabotage", source: "Quest V reward", summary: "+5 bonus from auction disruption timing.", effectType: "bonus", bonus: 5 },
      { id: "bondbreaker_charge", name: "Bondbreaker Charge", source: "Quest VI reward", summary: "+5 bonus from anti-armor breach load.", effectType: "bonus", bonus: 5 }
    ]
  };

  const UNDERGROUND_CROWN_GUILD_CAMPAIGN = {
    factionId: "underworld",
    questLabel: "Underground Crown Campaign",
    contractFlavor: "Smuggling runs, extraction jobs, forgeries, and blackmail operations.",
    shopFlavor: "Toxins, stealth kits, lock tools, and silent route tags.",
    quests: [
      { id: "crown_1", title: "Whisper Oath", difficulty: "medium", region: "province", location: "Night Market Undergate", templateLabel: "Guild Campaign I", stepNames: { 1: "Meet the Broker", 2: "Pass the Test", 3: "Take the Mark" }, checkpoints: ["Find the correct broker among decoys.", "Run a live forgery test.", "Accept the Crown\'s code or walk away marked."], lore: "The Crown recruits by testing whether you can keep secrets under pressure.", prepUnlockId: "ghost_manifest" },
      { id: "crown_2", title: "Black Ferry Route", difficulty: "hard", region: "sea", location: "Fog Ferry Lattice", templateLabel: "Guild Campaign II", stepNames: { 1: "Decode Cargo Ciphers", 2: "Escort the Ferry", 3: "Silence the Patrol" }, checkpoints: ["Read hidden marks in false manifests.", "Move contraband through blockade waters.", "Stop patrol logs from reaching command."], lore: "A ferry lane that should not exist has become the Crown\'s lifeline.", prepUnlockId: "smoke_pass" },
      { id: "crown_3", title: "The Broker Who Sold a Name", difficulty: "hard", region: "province", location: "Ash Alley Dockets", templateLabel: "Guild Campaign III", stepNames: { 1: "Track the Leak", 2: "Break Safehouses", 3: "Recover the Ledger" }, checkpoints: ["Identify who sold witness identities.", "Hit rotating safehouse cells.", "Recover the red ledger before copies spread."], lore: "Someone sold the Crown\'s protected names to bounty offices.", prepUnlockId: "forged_sigil" },
      { id: "crown_4", title: "Cold Planet Dead Drop", difficulty: "challenging", region: "planet", location: "Ice Silo Relay-3", templateLabel: "Guild Campaign IV", stepNames: { 1: "Find the Drop", 2: "Lift the Vault", 3: "Escape Orbit" }, checkpoints: ["Locate a dead drop beneath frozen turbines.", "Lift encrypted vault canisters.", "Escape orbital customs with zero signatures."], lore: "The Crown\'s oldest blackmail archive is frozen on a forgotten world.", prepUnlockId: "viper_filament" },
      { id: "crown_5", title: "The Quiet Tribunal", difficulty: "challenging", region: "galaxy", location: "Hidden Ring Court", templateLabel: "Guild Campaign V", stepNames: { 1: "Infiltrate Court", 2: "Turn Witnesses", 3: "Seal the Verdict" }, checkpoints: ["Enter a court that exists off-ledger.", "Flip two protected witnesses.", "Force a verdict without open war."], lore: "The Crown settles wars where law cannot reach.", prepUnlockId: "deadman_switch" },
      { id: "crown_6", title: "Break the Silence Broker", difficulty: "very_hard", region: "wtw", location: "World That Was Echo Vault", templateLabel: "Guild Campaign VI", stepNames: { 1: "Read Kill Contracts", 2: "Cross the Echo Vault", 3: "Defeat Khar Voss" }, checkpoints: ["Decode active assassination chains.", "Survive vault acoustics that reveal movement.", "Drop the lieutenant before the purge call fires."], lore: "Khar Voss sells silence as a weapon and memory as currency.", prepUnlockId: "traitor_index" },
      { id: "crown_7", title: "Throne of Mute Teeth", difficulty: "impossible", region: "wtw", location: "Sub-Choir Black Chamber", templateLabel: "Guild Boss Hunt", stepNames: { 1: "Breach the Black Chamber", 2: "Cut the Whisper Grid", 3: "Defeat the Whisper-King" }, checkpoints: ["Use prep to enter the sealed chamber.", "Disable the whisper grid before it strips your options.", "Kill the parasite throne before it migrates hosts."], lore: "The Whisper-King is an information parasite that feeds on fear and oaths.", prepUnlockId: "", isBoss: true }
    ],
    prepOptions: [
      { id: "ghost_manifest", name: "Ghost Manifest", source: "Quest I reward", summary: "+5 bonus from hidden cargo routes.", effectType: "bonus", bonus: 5 },
      { id: "smoke_pass", name: "Smoke Pass", source: "Quest II reward", summary: "Step down one pursuit dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "forged_sigil", name: "Forged Sigil", source: "Quest III reward", summary: "+5 bonus from forged authority access.", effectType: "bonus", bonus: 5 },
      { id: "viper_filament", name: "Viper Filament", source: "Quest IV reward", summary: "Step down one detection dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "deadman_switch", name: "Deadman Switch", source: "Quest V reward", summary: "+5 bonus from fallback route failsafe.", effectType: "bonus", bonus: 5 },
      { id: "traitor_index", name: "Traitor Index", source: "Quest VI reward", summary: "+5 bonus from blackmail leverage.", effectType: "bonus", bonus: 5 }
    ]
  };

  const EMBER_UNION_GUILD_CAMPAIGN = {
    factionId: "rebels",
    questLabel: "Ember Union Campaign",
    contractFlavor: "Sabotage runs, liberation strikes, convoy hits, and jailbreak operations.",
    shopFlavor: "Explosives, field aid, insurgent tech, and signal disruptors.",
    quests: [
      { id: "ember_1", title: "Spark Oath", difficulty: "medium", region: "province", location: "Switchyard Assembly", templateLabel: "Guild Campaign I", stepNames: { 1: "Hear Grievances", 2: "Mark the First Target", 3: "Light the Spark" }, checkpoints: ["Listen to three district delegates.", "Choose first strike infrastructure.", "Execute a controlled opening action."], lore: "The Union starts by asking who pays the cost when empires call it order.", prepUnlockId: "union_intel_packet" },
      { id: "ember_2", title: "Convoy of Ash", difficulty: "hard", region: "province", location: "Ration Highway Delta", templateLabel: "Guild Campaign II", stepNames: { 1: "Track Convoys", 2: "Set the Ambush", 3: "Break the Escort" }, checkpoints: ["Map convoy schedules and decoys.", "Position strike teams undetected.", "Capture supply crates intact."], lore: "Every ration convoy feeds one district and starves another.", prepUnlockId: "shock_web" },
      { id: "ember_3", title: "Jailbreak Broadcast", difficulty: "hard", region: "sea", location: "Prison Barge Chain", templateLabel: "Guild Campaign III", stepNames: { 1: "Inject the Signal", 2: "Board the Barge", 3: "Extract Prisoners" }, checkpoints: ["Seed a fake transfer order.", "Board during storm blackouts.", "Extract key prisoners before lock reset."], lore: "A failed jailbreak would kill the Union\'s public momentum.", prepUnlockId: "medic_cache" },
      { id: "ember_4", title: "Planet of Quiet Sirens", difficulty: "challenging", region: "planet", location: "Factory Moon Belt", templateLabel: "Guild Campaign IV", stepNames: { 1: "Map Siren Grid", 2: "Disable Relays", 3: "Evacuate Civilians" }, checkpoints: ["Map automated suppression sirens.", "Destroy relay towers in sequence.", "Evacuate workers through tunnel exits."], lore: "The regime silences protests by turning alarms into shock weapons.", prepUnlockId: "pulse_scrambler" },
      { id: "ember_5", title: "Orbitwide Strike Vote", difficulty: "challenging", region: "galaxy", location: "Railhub Parliament", templateLabel: "Guild Campaign V", stepNames: { 1: "Win Delegates", 2: "Secure Communications", 3: "Trigger the Strike" }, checkpoints: ["Convince neutral unions to join.", "Protect comm relays from sabotage.", "Trigger synchronized strike windows."], lore: "A strike across systems could break supply tyranny in one night.", prepUnlockId: "panic_tunnel_map" },
      { id: "ember_6", title: "Break the Iron Bailiff", difficulty: "very_hard", region: "wtw", location: "World That Was Foundry Ward", templateLabel: "Guild Campaign VI", stepNames: { 1: "Read Occupation Orders", 2: "Cross the Foundry", 3: "Defeat Marshal Cend" }, checkpoints: ["Steal occupation deployment orders.", "Cross foundry kill-zones and drones.", "Drop the lieutenant controlling city curfew kills."], lore: "Marshal Cend turned public safety law into industrial terror.", prepUnlockId: "liberation_charge" },
      { id: "ember_7", title: "The Regime Breaker", difficulty: "impossible", region: "wtw", location: "Cathedral Reactor Spine", templateLabel: "Guild Boss Hunt", stepNames: { 1: "Breach the Reactor Spine", 2: "Shut the Command Choir", 3: "Defeat the Regime Breaker" }, checkpoints: ["Use prep to enter reactor command.", "Sever authoritarian command channels.", "Destroy the mech-tyrant before it reboots district lockdown."], lore: "The Regime Breaker is a command mech built to end dissent in one activation.", prepUnlockId: "", isBoss: true }
    ],
    prepOptions: [
      { id: "union_intel_packet", name: "Union Intel Packet", source: "Quest I reward", summary: "+5 bonus from worker route intel.", effectType: "bonus", bonus: 5 },
      { id: "shock_web", name: "Shock Web", source: "Quest II reward", summary: "Step down one suppression dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "medic_cache", name: "Medic Cache", source: "Quest III reward", summary: "+5 bonus from field triage prep.", effectType: "bonus", bonus: 5 },
      { id: "pulse_scrambler", name: "Pulse Scrambler", source: "Quest IV reward", summary: "Step down one signal-linked dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "panic_tunnel_map", name: "Panic Tunnel Map", source: "Quest V reward", summary: "+5 bonus from emergency ingress routes.", effectType: "bonus", bonus: 5 },
      { id: "liberation_charge", name: "Liberation Charge", source: "Quest VI reward", summary: "+5 bonus from anti-armor breaching gel.", effectType: "bonus", bonus: 5 }
    ]
  };

  const ARCHIVE_KEEPERS_GUILD_CAMPAIGN = {
    factionId: "scholars",
    questLabel: "Archive Keepers Campaign",
    contractFlavor: "Investigations, relic recovery, and truth-raids against sealed records.",
    shopFlavor: "Codices, analyzers, mnemonic tools, and lens arrays.",
    quests: [
      { id: "archive_1", title: "Seal of Entry", difficulty: "medium", region: "province", location: "Lantern Athenaeum", templateLabel: "Guild Campaign I", stepNames: { 1: "Review the Codex", 2: "Verify the Lead", 3: "Issue Retrieval Writ" }, checkpoints: ["Audit a disputed codex entry.", "Verify whether the source is bait.", "Authorize a truth-recovery operation."], lore: "The Keepers test whether you protect truth or weaponize it.", prepUnlockId: "truth_lens" },
      { id: "archive_2", title: "Ruin Transcript", difficulty: "hard", region: "province", location: "Collapsed Court Archive", templateLabel: "Guild Campaign II", stepNames: { 1: "Decode Fragments", 2: "Traverse the Ruin", 3: "Recover the Record" }, checkpoints: ["Reassemble scorched transcript shards.", "Cross trap-lined archive halls.", "Recover the surviving tribunal record."], lore: "A burned transcript could rewrite who started the war.", prepUnlockId: "cipher_spool" },
      { id: "archive_3", title: "Drowned Codex Hunt", difficulty: "hard", region: "sea", location: "Sunken Library Spire", templateLabel: "Guild Campaign III", stepNames: { 1: "Chart the Sink", 2: "Dive the Stack", 3: "Extract the Codex" }, checkpoints: ["Map safe dive windows.", "Reach submerged stacks before collapse.", "Extract codex pages without salt loss."], lore: "The sea swallowed a volume everyone pretended never existed.", prepUnlockId: "saltproof_case" },
      { id: "archive_4", title: "Planetary Null Archive", difficulty: "challenging", region: "planet", location: "Dustglass Research Moon", templateLabel: "Guild Campaign IV", stepNames: { 1: "Bypass Quarantine", 2: "Stabilize the Core", 3: "Copy the Black Vault" }, checkpoints: ["Bypass bio-lock quarantine.", "Stabilize archival memory cores.", "Copy black-vault records under pursuit."], lore: "A sealed moon archive contains evidence that can topple entire orders.", prepUnlockId: "mnemonic_patch" },
      { id: "archive_5", title: "The Redaction Market", difficulty: "challenging", region: "galaxy", location: "Silent Data Exchange", templateLabel: "Guild Campaign V", stepNames: { 1: "Infiltrate the Exchange", 2: "Outbid the Erasers", 3: "Escape with Proof" }, checkpoints: ["Enter a market trading altered history.", "Outmaneuver redaction brokers.", "Escape with unedited records."], lore: "Someone is buying history and selling myth at scale.", prepUnlockId: "forensic_torque" },
      { id: "archive_6", title: "Break the Vault Curator", difficulty: "very_hard", region: "wtw", location: "World That Was Quiet Stack", templateLabel: "Guild Campaign VI", stepNames: { 1: "Map Stack Defenses", 2: "Cross the Null Galleries", 3: "Defeat Curator Nhal" }, checkpoints: ["Map rotating null fields.", "Navigate galleries that erase memory trails.", "Drop the lieutenant before the lock cascade."], lore: "Curator Nhal keeps truth buried by making memory itself unreliable.", prepUnlockId: "deletion_checksum" },
      { id: "archive_7", title: "The Devouring Index", difficulty: "impossible", region: "wtw", location: "Core Index Catacomb", templateLabel: "Guild Boss Hunt", stepNames: { 1: "Breach the Index", 2: "Stabilize Memory Spine", 3: "Defeat the Null Index" }, checkpoints: ["Use prep to enter the core archive.", "Stabilize memory spine before collapse.", "Destroy the archive horror before it rewrites witnesses."], lore: "The Null Index consumes memory, then republishes compliant truth.", prepUnlockId: "", isBoss: true }
    ],
    prepOptions: [
      { id: "truth_lens", name: "Truth Lens", source: "Quest I reward", summary: "+5 bonus from forensic sighting.", effectType: "bonus", bonus: 5 },
      { id: "cipher_spool", name: "Cipher Spool", source: "Quest II reward", summary: "Step down one code-linked dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "saltproof_case", name: "Saltproof Case", source: "Quest III reward", summary: "+5 bonus from secure codex extraction.", effectType: "bonus", bonus: 5 },
      { id: "mnemonic_patch", name: "Mnemonic Patch", source: "Quest IV reward", summary: "Step down one memory-shock dread die once.", effectType: "dread_down", dreadSteps: 1 },
      { id: "forensic_torque", name: "Forensic Torque", source: "Quest V reward", summary: "+5 bonus from redaction-counter toolkit.", effectType: "bonus", bonus: 5 },
      { id: "deletion_checksum", name: "Deletion Checksum", source: "Quest VI reward", summary: "+5 bonus from anti-erasure failsafe.", effectType: "bonus", bonus: 5 }
    ]
  };

  const GUILD_CAMPAIGN_CONFIGS = {
    corporations: GILDED_LEDGER_GUILD_CAMPAIGN,
    religious: SACRED_CHOIR_GUILD_CAMPAIGN,
    military: MILITARY_GUILD_CAMPAIGN,
    underworld: UNDERGROUND_CROWN_GUILD_CAMPAIGN,
    rebels: EMBER_UNION_GUILD_CAMPAIGN,
    scholars: ARCHIVE_KEEPERS_GUILD_CAMPAIGN
  };

  const GUILD_CAMPAIGN_DEFAULT_STATE = {
    joined: false,
    guildName: "",
    currentArcStage: 0,
    activeCampaignMissionId: null,
    completedQuestIds: [],
    knownWeaknesses: [],
    earnedPrepOptions: [],
    purchasedPrepOptions: [],
    activePrepIds: [],
    bossUnlocked: false,
    bossDefeated: false,
    contractBoardSeed: "",
    guildContracts: [],
    activeContractMissionId: null,
    contractRuns: 0,
    contractRefreshAt: 0,
    shopTier: 0,
    notableChoices: [],
    relationshipMap: { patron: 0, rival: 0, handler: 0 },
    lastOutcome: ""
  };

  const GUILD_BOSS_LAYERS = {
    military: {
      bossId: "warrant_tyrant",
      bossName: "The Warrant Tyrant",
      abilities: [
        { id: "sentence_of_iron", name: "Sentence of Iron", desc: "Command burst that spikes confrontation pressure." },
        { id: "hook_and_drag", name: "Hook and Drag", desc: "Pulls targets into lethal close range." },
        { id: "exemplary_violence", name: "Exemplary Violence", desc: "Bloodied state adds bonus damage pressure." }
      ],
      prepLocks: {
        signal_jammer: ["sentence_of_iron"],
        shock_manacles: ["hook_and_drag"]
      }
    },
    religious: {
      bossId: "halo_devourer",
      bossName: "The Halo Devourer",
      abilities: [
        { id: "choir_of_teeth", name: "Choir of Teeth", desc: "Summons rift mouths around the arena." },
        { id: "radiant_molting", name: "Radiant Molting", desc: "Sheds pressure effects and resets tempo." },
        { id: "beatific_rupture", name: "Beatific Rupture", desc: "Area rupture that inflicts curse pressure." }
      ],
      prepLocks: {
        grave_salt_circle: ["choir_of_teeth"],
        moon_bloom_poultice: ["radiant_molting"],
        null_hymnal: ["beatific_rupture"]
      }
    },
    corporations: {
      bossId: "golden_comptroller",
      bossName: "The Golden Comptroller",
      abilities: [
        { id: "margin_call", name: "Margin Call", desc: "Forces control checks or suppresses item use." },
        { id: "asset_seizure", name: "Asset Seizure", desc: "Steals an active positive condition." },
        { id: "liquidation_swarm", name: "Liquidation Swarm", desc: "Summons debt drones into the scene." }
      ],
      prepLocks: {
        counterfeit_warrant: ["asset_seizure"],
        asset_tracker_pin: ["margin_call"],
        market_sabotage: ["liquidation_swarm"]
      }
    },
    underworld: {
      bossId: "whisper_king",
      bossName: "The Whisper-King",
      abilities: [
        { id: "oath_leech", name: "Oath Leech", desc: "Consumes active buffs into self-heal pressure." },
        { id: "silence_tax", name: "Silence Tax", desc: "Increases cost of tactical choices." },
        { id: "parasite_transfer", name: "Parasite Transfer", desc: "Attempts to jump host and reset tempo." }
      ],
      prepLocks: {
        forged_sigil: ["silence_tax"],
        viper_filament: ["parasite_transfer"],
        traitor_index: ["oath_leech"]
      }
    },
    rebels: {
      bossId: "regime_breaker",
      bossName: "The Regime Breaker",
      abilities: [
        { id: "martial_lockdown", name: "Martial Lockdown", desc: "Cuts escape and reposition options." },
        { id: "punitive_barrage", name: "Punitive Barrage", desc: "Adds escalating pressure damage." },
        { id: "curfew_overclock", name: "Curfew Overclock", desc: "Reboots control loops and clears debuffs." }
      ],
      prepLocks: {
        shock_web: ["martial_lockdown"],
        pulse_scrambler: ["curfew_overclock"],
        liberation_charge: ["punitive_barrage"]
      }
    },
    scholars: {
      bossId: "null_index",
      bossName: "The Null Index",
      abilities: [
        { id: "memory_shear", name: "Memory Shear", desc: "Applies confusion pressure to outcomes." },
        { id: "redaction_wave", name: "Redaction Wave", desc: "Suppresses one positive resolution line." },
        { id: "archive_hunger", name: "Archive Hunger", desc: "Consumes clues to heal and spike dread." }
      ],
      prepLocks: {
        cipher_spool: ["memory_shear"],
        mnemonic_patch: ["redaction_wave"],
        deletion_checksum: ["archive_hunger"]
      }
    }
  };

  function pick(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)] || "";
  }

  function toTitle(text) {
    return String(text || "").charAt(0).toUpperCase() + String(text || "").slice(1);
  }

  function getGuildPresentation(factionId) {
    return GUILD_PRESENTATION[factionId] || {
      displayName: (FACTIONS[factionId] && FACTIONS[factionId].name) || "Guild",
      boardLabel: "Guild Board",
      shopLabel: "Guild Quartermaster",
      contractLabel: "Guild Contracts",
      campaignTag: "Campaign planning underway"
    };
  }

  function getGuildName(factionId) {
    return getGuildPresentation(factionId).displayName;
  }

  function getGuildCampaignConfig(factionId) {
    return GUILD_CAMPAIGN_CONFIGS[String(factionId || "")] || null;
  }

  function createGuildCampaignState(factionId) {
    const out = Object.assign({}, GUILD_CAMPAIGN_DEFAULT_STATE);
    out.guildName = getGuildName(factionId);
    out.relationshipMap = { patron: 0, rival: 0, handler: 0 };
    out.completedQuestIds = [];
    out.knownWeaknesses = [];
    out.earnedPrepOptions = [];
    out.purchasedPrepOptions = [];
    out.activePrepIds = [];
    out.notableChoices = [];
    return out;
  }

  function stepGuildDreadDieDown(value, steps) {
    let die = Number(value || 8);
    let count = Math.max(0, Number(steps || 0));
    while (count > 0) {
      let idx = GUILD_DREAD_DICE.indexOf(die);
      if (idx < 0) idx = 2;
      die = GUILD_DREAD_DICE[Math.max(0, idx - 1)];
      count -= 1;
    }
    return die;
  }

  function getGuildCampaignState(factionId) {
    if (typeof S === "undefined" || !S) return createGuildCampaignState(factionId);
    if (!S.factionNarrative || typeof S.factionNarrative !== "object") S.factionNarrative = {};
    if (!S.factionNarrative.guildCampaigns || typeof S.factionNarrative.guildCampaigns !== "object") {
      S.factionNarrative.guildCampaigns = {};
    }
    if (!S.factionNarrative.guildCampaigns[factionId] || typeof S.factionNarrative.guildCampaigns[factionId] !== "object") {
      S.factionNarrative.guildCampaigns[factionId] = createGuildCampaignState(factionId);
    }
    const state = S.factionNarrative.guildCampaigns[factionId];
    if (typeof state.joined !== "boolean") state.joined = false;
    if (typeof state.guildName !== "string" || !state.guildName) state.guildName = getGuildName(factionId);
    if (typeof state.currentArcStage !== "number") state.currentArcStage = 0;
    if (typeof state.activeCampaignMissionId !== "number" && typeof state.activeCampaignMissionId !== "string") state.activeCampaignMissionId = null;
    if (!Array.isArray(state.completedQuestIds)) state.completedQuestIds = [];
    if (!Array.isArray(state.knownWeaknesses)) state.knownWeaknesses = [];
    if (!Array.isArray(state.earnedPrepOptions)) state.earnedPrepOptions = [];
    if (!Array.isArray(state.purchasedPrepOptions)) state.purchasedPrepOptions = [];
    if (!Array.isArray(state.activePrepIds)) state.activePrepIds = [];
    if (typeof state.bossUnlocked !== "boolean") state.bossUnlocked = false;
    if (typeof state.bossDefeated !== "boolean") state.bossDefeated = false;
    if (typeof state.contractBoardSeed !== "string") state.contractBoardSeed = "";
    if (!Array.isArray(state.guildContracts)) state.guildContracts = [];
    if (typeof state.activeContractMissionId !== "number" && typeof state.activeContractMissionId !== "string") state.activeContractMissionId = null;
    if (typeof state.contractRuns !== "number") state.contractRuns = 0;
    if (typeof state.contractRefreshAt !== "number") state.contractRefreshAt = 0;
    if (typeof state.shopTier !== "number") state.shopTier = 0;
    if (!Array.isArray(state.notableChoices)) state.notableChoices = [];
    if (!state.relationshipMap || typeof state.relationshipMap !== "object") state.relationshipMap = { patron: 0, rival: 0, handler: 0 };
    if (typeof state.lastOutcome !== "string") state.lastOutcome = "";
    return state;
  }

  function buildGuildBossLayer(factionId, prepIds) {
    const layer = GUILD_BOSS_LAYERS[String(factionId || "")];
    if (!layer) return null;
    const selectedPrep = Array.isArray(prepIds) ? prepIds.map((id) => String(id || "")).filter(Boolean) : [];
    const lockedMap = {};
    selectedPrep.forEach((prepId) => {
      const locks = layer.prepLocks && layer.prepLocks[prepId];
      if (!Array.isArray(locks)) return;
      locks.forEach((abilityId) => {
        const key = String(abilityId || "");
        if (!key) return;
        if (!lockedMap[key]) lockedMap[key] = [];
        if (lockedMap[key].indexOf(prepId) < 0) lockedMap[key].push(prepId);
      });
    });
    return {
      bossId: layer.bossId,
      bossName: layer.bossName,
      abilities: (layer.abilities || []).map((ability) => ({
        id: ability.id,
        name: ability.name,
        desc: ability.desc,
        lockedByPrepIds: lockedMap[String(ability.id || "")] || []
      }))
    };
  }

  function getFactionRenown(factionId) {
    if (typeof S === "undefined" || !S || !S.factionRenown || typeof S.factionRenown !== "object") return 0;
    return Number(S.factionRenown[factionId] || 0);
  }

  function ensureFactionState() {
    if (typeof S === "undefined" || !S) return;
    if (!S.factionRenown || typeof S.factionRenown !== "object") S.factionRenown = {};
    if (S.factionStanding && typeof S.factionStanding === "object") {
      const legacyMap = {
        corporations: "corporations",
        religious: "religious",
        military: "military",
        underworld: "underworld",
        rebels: "rebels",
        scholars: "scholars",
        political: "rebels"
      };
      Object.keys(legacyMap).forEach((legacyKey) => {
        const nextKey = legacyMap[legacyKey];
        if (typeof S.factionRenown[nextKey] === "number") return;
        const legacyVal = Number(S.factionStanding[legacyKey] || 0);
        S.factionRenown[nextKey] = Math.max(0, legacyVal);
      });
    }
    if (!S.factionBases || typeof S.factionBases !== "object") S.factionBases = {};
    if (!Array.isArray(S.factionWayfarerTasks)) S.factionWayfarerTasks = [];
    if (!S.factionNarrative || typeof S.factionNarrative !== "object") {
      S.factionNarrative = {};
    }
    if (!S.factionNarrative.pathPoints || typeof S.factionNarrative.pathPoints !== "object") {
      S.factionNarrative.pathPoints = { heroic: 0, tyrant: 0, martyr: 0 };
    }
    if (!S.factionNarrative.contracts || typeof S.factionNarrative.contracts !== "object") {
      S.factionNarrative.contracts = {};
    }
    if (!S.factionNarrative.completedContracts || !Array.isArray(S.factionNarrative.completedContracts)) {
      S.factionNarrative.completedContracts = [];
    }
    if (!S.factionNarrative.choiceHistory || !Array.isArray(S.factionNarrative.choiceHistory)) {
      S.factionNarrative.choiceHistory = [];
    }
    if (!S.factionNarrative.currentAdaptiveChoices || !Array.isArray(S.factionNarrative.currentAdaptiveChoices)) {
      S.factionNarrative.currentAdaptiveChoices = [];
    }
    if (typeof S.factionNarrative.adaptiveRefreshToken !== "string") {
      S.factionNarrative.adaptiveRefreshToken = "";
    }
    if (!S.factionNarrative.endingResult || typeof S.factionNarrative.endingResult !== "object") {
      S.factionNarrative.endingResult = { key: "", title: "", vibe: "" };
    }
    if (!S.factionNarrative.finale || typeof S.factionNarrative.finale !== "object") {
      S.factionNarrative.finale = { unlocked: false, key: "", revealed: false, unlockedAt: 0 };
    }
    if (!S.factionNarrative.guildCampaigns || typeof S.factionNarrative.guildCampaigns !== "object") {
      S.factionNarrative.guildCampaigns = {};
    }

    Object.keys(FACTIONS).forEach((id) => {
      if (typeof S.factionRenown[id] !== "number") S.factionRenown[id] = 0;
      getGuildCampaignState(id);
      if (!S.factionBases[id]) {
        const theme = BASE_FLAVOR[id] || BASE_FLAVOR.scholars;
        const regionType = pick(BASE_REGION_TYPES);
        S.factionBases[id] = {
          regionType,
          baseName: pick(theme.names),
          ambientDetail: pick(theme.details),
          rumorClock: 0,
          marker: {},
          activeMission: null,
          activeEvents: [],
          npcs: [],
          merchantStock: [],
          generatedRooms: [],
          discoveredSecrets: [],
        };
      }
    });
  }

  function getGuildCampaignQuestByStage(factionId, stageIndex) {
    const cfg = getGuildCampaignConfig(factionId);
    if (!cfg || !Array.isArray(cfg.quests)) return null;
    const idx = Math.max(0, Number(stageIndex || 0));
    return cfg.quests[idx] || null;
  }

  function getGuildPrepById(factionId, prepId) {
    const cfg = getGuildCampaignConfig(factionId);
    if (!cfg || !Array.isArray(cfg.prepOptions)) return null;
    const id = String(prepId || "");
    for (let i = 0; i < cfg.prepOptions.length; i++) {
      const row = cfg.prepOptions[i];
      if (row && String(row.id || "") === id) return row;
    }
    return null;
  }

  function listGuildPrepOptionsForState(factionId, state) {
    const ids = [];
    const add = function (value) {
      const id = String(value || "");
      if (!id || ids.indexOf(id) >= 0) return;
      ids.push(id);
    };
    (state && state.earnedPrepOptions || []).forEach(add);
    (state && state.purchasedPrepOptions || []).forEach(add);
    return ids.map((id) => getGuildPrepById(factionId, id)).filter(Boolean);
  }

  function getGuildCampaignMissionById(state, missionId) {
    if (!S || !Array.isArray(S.activeMissions)) return null;
    const id = String(missionId || "");
    if (!id) return null;
    return S.activeMissions.find((m) => m && String(m.id) === id) || null;
  }

  function addGuildPrepOption(factionId, prepId) {
    const state = getGuildCampaignState(factionId);
    const id = String(prepId || "");
    if (!id) return;
    if (state.earnedPrepOptions.indexOf(id) < 0) state.earnedPrepOptions.push(id);
  }

  function applyGuildPrepToMission(factionId, mission, prepIds) {
    if (!mission || !Array.isArray(prepIds) || !prepIds.length) return;
    let bonus = Number(mission.bonus || 0);
    let dread = Number(mission.gmDreadOverride || mission.dread || 8);
    prepIds.forEach((prepId) => {
      const prep = getGuildPrepById(factionId, prepId);
      if (!prep) return;
      if (prep.effectType === "bonus") {
        bonus += Number(prep.bonus || 0);
      } else if (prep.effectType === "dread_down") {
        dread = stepGuildDreadDieDown(dread, Number(prep.dreadSteps || 1));
      }
    });
    mission.bonus = Math.max(0, Math.min(20, bonus));
    mission.gmDreadOverride = Math.max(4, dread);
  }

  function ensureGuildContractBoard(factionId, forceRefresh) {
    const state = getGuildCampaignState(factionId);
    const refresh = !!forceRefresh;
    const now = Date.now();
    if (!refresh && Array.isArray(state.guildContracts) && state.guildContracts.length >= 3) {
      return state.guildContracts;
    }
    const flavor = BASE_FLAVOR[factionId] || BASE_FLAVOR.scholars;
    const regions = ["province", "sea", "galaxy", "wtw", "planet"];
    const difficulties = ["medium", "hard", "challenging", "very_hard"];
    const templates = [];
    for (let i = 0; i < 3; i++) {
      const verb = pick(flavor.taskVerbs) || "secure";
      const target = pick(flavor.taskTargets) || "a critical lane";
      const hook = pick(flavor.missionHooks) || "stabilize the route";
      const region = regions[(i + Math.floor(Math.random() * regions.length)) % regions.length];
      templates.push({
        id: "contract_" + (i + 1) + "_" + Math.floor(Math.random() * 9999),
        title: toTitle(verb) + " " + target,
        lore: toTitle(hook) + ".",
        difficulty: difficulties[Math.min(i, difficulties.length - 1)],
        region: region,
        location: (region === "planet" ? "Planetfall Guild Theater" : (region === "wtw" ? "World That Was" : toTitle(region))) + " " + toTitle(target),
        prepHintId: ((state.earnedPrepOptions || [])[i] || "")
      });
    }
    state.guildContracts = templates;
    state.contractBoardSeed = String(now);
    state.contractRefreshAt = now;
    return state.guildContracts;
  }

  function getGuildContractMissionById(state, missionId) {
    if (!S || !Array.isArray(S.activeMissions)) return null;
    const id = String(missionId || "");
    if (!id) return null;
    return S.activeMissions.find((m) => m && String(m.id) === id) || null;
  }

  function postGuildContract(factionId, contractId) {
    const state = getGuildCampaignState(factionId);
    const list = ensureGuildContractBoard(factionId, false);
    if (!Array.isArray(list) || !list.length) return;
    const active = getGuildContractMissionById(state, state.activeContractMissionId);
    if (active) {
      if (typeof showNotif === "function") showNotif("Guild contract already active in Missions tab.", "warn");
      return;
    }
    const contract = list.find((row) => String(row.id || "") === String(contractId || ""));
    if (!contract) {
      if (typeof showNotif === "function") showNotif("Guild contract not found. Refresh the board.", "warn");
      return;
    }
    const faction = FACTIONS[factionId] || { name: getGuildName(factionId) };
    const rival = getRivalFaction(factionId);
    const prepRows = (state.activePrepIds || []).map((id) => getGuildPrepById(factionId, id)).filter(Boolean);
    const created = createMission(
      "Guild Board",
      "[Contract] " + String(contract.title || "Guild Operation"),
      contract.difficulty || "medium",
      contract.location || "Guild Frontier",
      contract.region || "province",
      {
        gain: factionId,
        lose: rival,
        gainName: faction.name,
        loseName: (FACTIONS[rival] && FACTIONS[rival].name) ? FACTIONS[rival].name : toTitle(rival)
      },
      {
        missionType: "guild_contract",
        templateLabel: "Guild Contract",
        lore: contract.lore || "Repeatable guild contract.",
        guildContract: {
          factionId: factionId,
          guildName: getGuildName(factionId),
          contractId: String(contract.id || ""),
          prepIds: (state.activePrepIds || []).slice(0, 3),
          prepSummary: prepRows.map((prep) => ({ id: prep.id, name: prep.name, summary: prep.summary }))
        }
      }
    );
    if (!created || !created.id) return;
    applyGuildPrepToMission(factionId, created, state.activePrepIds || []);
    state.activeContractMissionId = created.id;
    state.lastOutcome = "contract-posted:" + String(contract.id || "");
    if (typeof showNotif === "function") showNotif("Guild contract posted: " + String(contract.title || "Contract"), "good");
    if (typeof renderMissionBoard === "function") renderMissionBoard();
    if (typeof renderMissionTracker === "function") renderMissionTracker();
    setupFactionTab();
  }

  function refreshGuildContracts(factionId) {
    ensureGuildContractBoard(factionId, true);
    setupFactionTab();
  }

  function startGuildCampaignQuest(factionId) {
    const cfg = getGuildCampaignConfig(factionId);
    if (!cfg || !Array.isArray(cfg.quests) || !cfg.quests.length) {
      if (typeof showNotif === "function") showNotif("This guild campaign is not configured yet.", "warn");
      return;
    }
    const state = getGuildCampaignState(factionId);
    if (!state.joined) {
      if (typeof showNotif === "function") showNotif("Join the guild first.", "warn");
      return;
    }

    const existing = getGuildCampaignMissionById(state, state.activeCampaignMissionId);
    if (existing) {
      if (typeof showNotif === "function") showNotif("Guild campaign mission already active in Missions tab.", "warn");
      return;
    }

    const quest = getGuildCampaignQuestByStage(factionId, state.currentArcStage);
    if (!quest) {
      if (typeof showNotif === "function") showNotif("Guild campaign complete.", "good");
      return;
    }

    const faction = FACTIONS[factionId] || { name: getGuildName(factionId) };
    const rival = getRivalFaction(factionId);
    if (typeof createMission !== "function") {
      if (typeof showNotif === "function") showNotif("Mission system unavailable for guild campaign posting.", "warn");
      return;
    }

    const created = createMission(
      "Guild Command",
      "[Campaign] " + quest.title,
      quest.difficulty || "medium",
      quest.location || "Guild Frontier",
      quest.region || "province",
      {
        gain: factionId,
        lose: rival,
        gainName: faction.name,
        loseName: (FACTIONS[rival] && FACTIONS[rival].name) ? FACTIONS[rival].name : toTitle(rival)
      },
      {
        missionType: quest.isBoss ? "guild_boss_hunt" : "guild_campaign",
        templateLabel: quest.templateLabel || (cfg.questLabel || "Guild Campaign"),
        stepNames: quest.stepNames || null,
        checkpoints: quest.checkpoints || null,
        lore: quest.lore || "Guild campaign mission.",
        guildCampaign: {
          factionId,
          guildName: getGuildName(factionId),
          questId: quest.id,
          questIndex: Number(state.currentArcStage || 0),
          isBoss: !!quest.isBoss,
          prepIds: (state.activePrepIds || []).slice(0, 3)
        },
        guildBossLayer: quest.isBoss ? buildGuildBossLayer(factionId, state.activePrepIds || []) : null
      }
    );

    if (!created || !created.id) return;

    applyGuildPrepToMission(factionId, created, state.activePrepIds || []);

    state.activeCampaignMissionId = created.id;
    state.lastOutcome = "posted:" + String(quest.id || "quest");
    if (typeof showNotif === "function") showNotif("Guild campaign mission posted: " + quest.title, "good");
    if (typeof renderMissionBoard === "function") renderMissionBoard();
    if (typeof renderMissionTracker === "function") renderMissionTracker();
    setupFactionTab();
  }

  function joinGuildCampaign(factionId) {
    const state = getGuildCampaignState(factionId);
    if (state.joined) {
      if (typeof showNotif === "function") showNotif(getGuildName(factionId) + " already joined.", "warn");
      return;
    }
    state.joined = true;
    state.guildName = getGuildName(factionId);
    state.currentArcStage = 0;
    state.activeCampaignMissionId = null;
    state.completedQuestIds = [];
    state.earnedPrepOptions = [];
    state.activePrepIds = [];
    state.bossUnlocked = false;
    state.bossDefeated = false;
    state.lastOutcome = "joined";
    if (typeof showNotif === "function") showNotif("Joined guild campaign: " + state.guildName + ".", "good");
    setupFactionTab();
  }

  function toggleGuildPrep(factionId, prepId) {
    const state = getGuildCampaignState(factionId);
    const id = String(prepId || "");
    if (!id) return;
    const owned = listGuildPrepOptionsForState(factionId, state).some((row) => String(row.id || "") === id);
    if (!owned) {
      if (typeof showNotif === "function") showNotif("Prep option not unlocked yet.", "warn");
      return;
    }
    const idx = state.activePrepIds.indexOf(id);
    if (idx >= 0) {
      state.activePrepIds.splice(idx, 1);
      setupFactionTab();
      return;
    }
    if (state.activePrepIds.length >= 3) {
      if (typeof showNotif === "function") showNotif("Maximum 3 active prep options.", "warn");
      return;
    }
    state.activePrepIds.push(id);
    setupFactionTab();
  }

  function resolveGuildCampaignProgress(mission, success) {
    const info = mission && mission.guildCampaign;
    if (!info || !info.factionId) return;
    const factionId = String(info.factionId || "");
    if (!factionId) return;
    const state = getGuildCampaignState(factionId);
    if (String(state.activeCampaignMissionId || "") !== String(mission.id || "")) return;

    const quest = getGuildCampaignQuestByStage(factionId, Number(info.questIndex || state.currentArcStage || 0));

    if (!success) {
      state.activeCampaignMissionId = null;
      state.lastOutcome = "failed:" + String((quest && quest.id) || "quest");
      if (typeof showNotif === "function") showNotif("Guild campaign setback. Repost the mission when ready.", "warn");
      setupFactionTab();
      return;
    }

    const questId = String((quest && quest.id) || (info && info.questId) || "");
    if (questId && state.completedQuestIds.indexOf(questId) < 0) state.completedQuestIds.push(questId);
    state.activeCampaignMissionId = null;
    state.currentArcStage = Math.max(state.currentArcStage, Number(info.questIndex || state.currentArcStage) + 1);
    state.lastOutcome = "completed:" + questId;

    if (quest && quest.prepUnlockId) addGuildPrepOption(factionId, quest.prepUnlockId);
    if (quest && quest.isBoss) state.bossDefeated = true;

    const cfg = getGuildCampaignConfig(factionId);
    const total = cfg && Array.isArray(cfg.quests) ? cfg.quests.length : 0;
    if (state.currentArcStage >= Math.max(0, total - 1)) {
      state.bossUnlocked = true;
    }

    if (typeof showNotif === "function") {
      if (quest && quest.isBoss) showNotif(getGuildName(factionId) + " campaign complete. Boss defeated.", "good");
      else showNotif(getGuildName(factionId) + " campaign advanced to stage " + (state.currentArcStage + 1) + ".", "good");
    }
    setupFactionTab();
  }

  const WAYFARER_SECRET_POOL = [
    "A hidden relay beneath this region can bypass customs scans.",
    "A rival faction broker has been buying route maps under a false name.",
    "An old hatch near the base connects to a forgotten smuggler lane.",
    "A false mission marker is being used to lure crews into ambushes.",
    "Someone in command is leaking deployment windows to raiders.",
    "An archive room here contains sealed records on pre-collapse vaults.",
  ];

  const WAYFARER_TASK_TITLES = [
    "Courier Trail",
    "Broken Beacon",
    "Silent Outpost",
    "Missing Cache",
    "Signal Intercept",
    "Hazard Sweep",
  ];

  const MONSTER_NAMES = ["Irradiated Ones", "Rift Hounds", "Ash Stalkers", "Void Leeches", "Crypt Drifters"];

  function getActiveTheosFlavor() {
    if (typeof window === "undefined" || typeof window.getTheosFactionFlavor !== "function") return null;
    try {
      return window.getTheosFactionFlavor() || null;
    } catch (_err) {
      return null;
    }
  }

  function generateFactionBaseMission(factionId) {
    const theme = BASE_FLAVOR[factionId] || BASE_FLAVOR.scholars;
    const renown = getFactionRenown(factionId);
    const theos = getActiveTheosFlavor();
    const tier = renown >= 6 ? "High Stakes" : renown >= 3 ? "Trusted Operative" : "Initiate";
    const flavorTag = theos && theos.tension ? " - " + String(theos.tension) : "";
    return {
      title: toTitle(tier) + ": " + toTitle(pick(theme.missionHooks)) + flavorTag,
      difficulty: renown >= 6 ? "very_hard" : renown >= 3 ? "hard" : "medium",
      payout: (120 + Math.max(0, renown) * 45 + (theos ? 30 : 0)) + " Credits",
    };
  }

  function generateFactionBaseEvents(factionId) {
    const factionName = FACTIONS[factionId] ? FACTIONS[factionId].name : "the faction";
    const theos = getActiveTheosFlavor();
    const pool = [
      "A Wayfarer arrives with rumors about a forgotten route tied to " + factionName + ".",
      "A hazard alarm blares: toxic seepage floods one corridor and everyone scrambles.",
      "A peril unfolds as a trusted quartermaster is accused of selling access codes.",
      "Monsters probe the perimeter and the base is forced into emergency defense drills.",
      "A hidden cache is discovered behind old masonry, packed with pre-collapse records.",
      "Two operatives argue over doctrine, and the dispute spills into the command floor.",
      "A courier returns from the frontier carrying contradictory reports of an incoming raid.",
      "A secret chamber is found under the base, containing names no one wants spoken aloud.",
    ];
    if (theos && theos.scar) {
      pool.push("Scouts report regional fallout from the province scar: " + String(theos.scar) + ".");
    }
    if (theos && theos.dungeonTheme) {
      pool.push("Faction handlers request a strike team for a nearby site tied to " + String(theos.dungeonTheme) + ".");
    }
    const events = [];
    while (events.length < 3 && pool.length) {
      const idx = Math.floor(Math.random() * pool.length);
      events.push(pool.splice(idx, 1)[0]);
    }
    return events;
  }

  function isProvinceKeyValid(key) {
    if (!key || typeof mapData === "undefined" || !Array.isArray(mapData)) return false;
    const parts = String(key).split(",");
    if (parts.length !== 2) return false;
    const c = Number(parts[0]);
    const r = Number(parts[1]);
    return mapData.some((h) => h && h.col === c && h.row === r);
  }

  function assignProvinceMarker(base) {
    if (typeof mapData === "undefined" || !Array.isArray(mapData) || !mapData.length) return false;
    const hex = mapData[Math.floor(Math.random() * mapData.length)];
    base.marker = { system: "province", provinceKey: hex.col + "," + hex.row };
    return true;
  }

  function assignSeaMarker(base) {
    if (!S || !S.lastSea || !Array.isArray(S.lastSea.map) || !S.lastSea.map.length) return false;
    const hex = S.lastSea.map[Math.floor(Math.random() * S.lastSea.map.length)];
    base.marker = { system: "sea", seaKey: hex.key };
    return true;
  }

  function assignGalaxyMarker(base) {
    if (!S || !S.starSystem || !Array.isArray(S.starSystem.hexes) || !S.starSystem.hexes.length) return false;
    const candidates = S.starSystem.hexes.filter((h) => h && h.ring !== "core");
    if (!candidates.length) return false;
    const hex = candidates[Math.floor(Math.random() * candidates.length)];
    base.marker = { system: "galaxy", galaxyHexId: Number(hex.id) };
    return true;
  }

  function assignWTWMarker(base) {
    if (!S || !S.worldThatWas || !Array.isArray(S.worldThatWas.hexes) || !S.worldThatWas.hexes.length) return false;
    const hex = S.worldThatWas.hexes[Math.floor(Math.random() * S.worldThatWas.hexes.length)];
    base.marker = { system: "wtw", wtwHexId: String(hex.id) };
    return true;
  }

  function assignPlanetMarker(base) {
    if (!S || !S.starSystem || !S.starSystem.planetExplorationByHex) return false;
    const hexKeys = Object.keys(S.starSystem.planetExplorationByHex);
    if (!hexKeys.length) return false;
    const pickedHex = hexKeys[Math.floor(Math.random() * hexKeys.length)];
    const state = S.starSystem.planetExplorationByHex[pickedHex];
    if (!state || !Array.isArray(state.cells) || !state.cells.length) return false;
    const cell = state.cells[Math.floor(Math.random() * state.cells.length)];
    base.marker = { system: "planet", planetHexId: Number(pickedHex), planetCellId: Number(cell.id) };
    return true;
  }

  function ensureFactionBaseMarker(factionId) {
    ensureFactionState();
    const base = S && S.factionBases ? S.factionBases[factionId] : null;
    if (!base) return null;
    const m = base.marker || {};

    if (base.regionType === "Province Map") {
      if (!m.provinceKey || !isProvinceKeyValid(m.provinceKey)) assignProvinceMarker(base);
    } else if (base.regionType === "Sea Region Hex Map") {
      const ok = !!(m.seaKey && S && S.lastSea && Array.isArray(S.lastSea.map) && S.lastSea.map.some((h) => h && h.key === m.seaKey));
      if (!ok) assignSeaMarker(base);
    } else if (base.regionType === "Galaxy Map") {
      const ok = !!(typeof m.galaxyHexId === "number" && S && S.starSystem && Array.isArray(S.starSystem.hexes) && S.starSystem.hexes.some((h) => h && Number(h.id) === Number(m.galaxyHexId)));
      if (!ok) assignGalaxyMarker(base);
    } else if (base.regionType === "World That Was") {
      const ok = !!(m.wtwHexId && S && S.worldThatWas && Array.isArray(S.worldThatWas.hexes) && S.worldThatWas.hexes.some((h) => h && String(h.id) === String(m.wtwHexId)));
      if (!ok) assignWTWMarker(base);
    } else if (base.regionType === "Random Planet") {
      const state = S && S.starSystem && S.starSystem.planetExplorationByHex
        ? S.starSystem.planetExplorationByHex[String(m.planetHexId)]
        : null;
      const ok = !!(state && Array.isArray(state.cells) && state.cells.some((cell) => Number(cell.id) === Number(m.planetCellId)));
      if (!ok) assignPlanetMarker(base);
    }

    return base;
  }

  function syncFactionBaseMarkers() {
    ensureFactionState();
    Object.keys(FACTIONS).forEach((id) => ensureFactionBaseMarker(id));
  }

  function findBaseByMarker(region, key, secondary) {
    ensureFactionState();
    const ids = Object.keys(FACTIONS);
    for (let i = 0; i < ids.length; i++) {
      const factionId = ids[i];
      const base = ensureFactionBaseMarker(factionId);
      if (!base || !base.marker) continue;
      const m = base.marker;
      if (region === "province" && String(m.provinceKey || "") === String(key || "")) return { factionId, base };
      if (region === "sea" && String(m.seaKey || "") === String(key || "")) return { factionId, base };
      if (region === "galaxy" && Number(m.galaxyHexId) === Number(key)) return { factionId, base };
      if (region === "wtw" && String(m.wtwHexId || "") === String(key || "")) return { factionId, base };
      if (region === "planet" && Number(m.planetHexId) === Number(key) && Number(m.planetCellId) === Number(secondary)) return { factionId, base };
    }
    return null;
  }

  function getFactionBaseMarkerAtProvince(key) {
    const found = findBaseByMarker("province", key);
    return found ? { factionId: found.factionId, baseName: found.base.baseName } : null;
  }

  function getFactionBaseMarkerAtSea(key) {
    const found = findBaseByMarker("sea", key);
    return found ? { factionId: found.factionId, baseName: found.base.baseName } : null;
  }

  function getFactionBaseMarkerAtGalaxy(hexId) {
    const found = findBaseByMarker("galaxy", hexId);
    return found ? { factionId: found.factionId, baseName: found.base.baseName } : null;
  }

  function getFactionBaseMarkerAtWTW(hexId) {
    const found = findBaseByMarker("wtw", hexId);
    return found ? { factionId: found.factionId, baseName: found.base.baseName } : null;
  }

  function getFactionBaseMarkerAtPlanet(hexId, cellId) {
    const found = findBaseByMarker("planet", hexId, cellId);
    return found ? { factionId: found.factionId, baseName: found.base.baseName } : null;
  }

  function getBaseRegionCode(base) {
    if (!base || !base.regionType) return "province";
    if (base.regionType === "Province Map") return "province";
    if (base.regionType === "Sea Region Hex Map") return "sea";
    if (base.regionType === "Galaxy Map") return "galaxy";
    if (base.regionType === "World That Was") return "wtw";
    if (base.regionType === "Random Planet") return "planet";
    return "province";
  }

  function getMissionRegionFromBase(base) {
    const r = getBaseRegionCode(base);
    if (r === "sea") return "sea";
    if (r === "galaxy" || r === "planet" || r === "wtw") return "galaxy";
    return "province";
  }

  function getRivalFaction(factionId) {
    const enemies = (FACTION_DYNAMICS && Array.isArray(FACTION_DYNAMICS.enemies)) ? FACTION_DYNAMICS.enemies : [];
    const direct = enemies.find((pair) => pair.f1 === factionId);
    if (direct && direct.f2 && FACTIONS[direct.f2]) return direct.f2;
    const ids = Object.keys(FACTIONS).filter((id) => id !== factionId);
    return ids.length ? ids[Math.floor(Math.random() * ids.length)] : factionId;
  }

  function allocTaskMarker(regionCode) {
    if (regionCode === "province") {
      if (typeof mapData === "undefined" || !Array.isArray(mapData) || !mapData.length) return null;
      const hex = mapData[Math.floor(Math.random() * mapData.length)];
      return { system: "province", provinceKey: hex.col + "," + hex.row };
    }
    if (regionCode === "sea") {
      if (!S || !S.lastSea || !Array.isArray(S.lastSea.map) || !S.lastSea.map.length) return null;
      const hex = S.lastSea.map[Math.floor(Math.random() * S.lastSea.map.length)];
      return { system: "sea", seaKey: hex.key };
    }
    if (regionCode === "galaxy") {
      if (!S || !S.starSystem || !Array.isArray(S.starSystem.hexes) || !S.starSystem.hexes.length) return null;
      const candidates = S.starSystem.hexes.filter((h) => h && h.ring !== "core");
      if (!candidates.length) return null;
      const hex = candidates[Math.floor(Math.random() * candidates.length)];
      return { system: "galaxy", galaxyHexId: Number(hex.id) };
    }
    if (regionCode === "wtw") {
      if (!S || !S.worldThatWas || !Array.isArray(S.worldThatWas.hexes) || !S.worldThatWas.hexes.length) return null;
      const hex = S.worldThatWas.hexes[Math.floor(Math.random() * S.worldThatWas.hexes.length)];
      return { system: "wtw", wtwHexId: String(hex.id) };
    }
    if (regionCode === "planet") {
      if (!S || !S.starSystem || !S.starSystem.planetExplorationByHex) return null;
      const keys = Object.keys(S.starSystem.planetExplorationByHex);
      if (!keys.length) return null;
      const hk = keys[Math.floor(Math.random() * keys.length)];
      const state = S.starSystem.planetExplorationByHex[hk];
      if (!state || !Array.isArray(state.cells) || !state.cells.length) return null;
      const cell = state.cells[Math.floor(Math.random() * state.cells.length)];
      return { system: "planet", planetHexId: Number(hk), planetCellId: Number(cell.id) };
    }
    return null;
  }

  function createMonsterPack() {
    const count = 1 + Math.floor(Math.random() * 4);
    const dread = 4 + (Math.floor(Math.random() * 3) * 2);
    return {
      name: pick(MONSTER_NAMES),
      count,
      dread,
      health: dread * 2,
    };
  }

  function createWayfarerTask(factionId, npcName) {
    ensureFactionState();
    const base = ensureBaseActivity(factionId);
    if (!base) return null;
    const regionCode = getBaseRegionCode(base);
    const marker = allocTaskMarker(regionCode);
    if (!marker) return null;
    const monsterTask = Math.random() < 0.35;
    const task = {
      id: "fwt-" + Date.now() + "-" + Math.floor(Math.random() * 9999),
      factionId,
      npcName: npcName || "Wayfarer",
      title: pick(WAYFARER_TASK_TITLES),
      text: "Wayfarer contact request for " + (FACTIONS[factionId] ? FACTIONS[factionId].name : "Faction") + ".",
      status: "open",
      monsterTask,
      monsterPack: monsterTask ? createMonsterPack() : null,
      marker,
      createdAt: Date.now(),
    };
    S.factionWayfarerTasks.push(task);
    return task;
  }

  function getOpenTasks() {
    ensureFactionState();
    return (S.factionWayfarerTasks || []).filter((t) => t && (t.status === "open" || t.status === "combat_pending"));
  }

  function findTaskAt(region, key, secondary) {
    const tasks = getOpenTasks();
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const m = t.marker || {};
      if (region === "province" && String(m.provinceKey || "") === String(key || "")) return t;
      if (region === "sea" && String(m.seaKey || "") === String(key || "")) return t;
      if (region === "galaxy" && Number(m.galaxyHexId) === Number(key)) return t;
      if (region === "wtw" && String(m.wtwHexId || "") === String(key || "")) return t;
      if (region === "planet" && Number(m.planetHexId) === Number(key) && Number(m.planetCellId) === Number(secondary)) return t;
    }
    return null;
  }

  function removeTask(taskId) {
    ensureFactionState();
    S.factionWayfarerTasks = (S.factionWayfarerTasks || []).filter((t) => String(t.id) !== String(taskId));
  }

  function grantTaskReward(task, success) {
    if (!task) return;
    if (success) {
      safeFactionRenownDelta(task.factionId, 1);
      let lootName = "Trade Good";
      if (typeof rollForLoot === "function") {
        try {
          const loot = rollForLoot("medium");
          if (Array.isArray(loot) && loot.length) lootName = String(loot[0]);
          else if (typeof loot === "string") lootName = loot;
        } catch (err) { console.error(err); }
      }
      if (String(lootName).toLowerCase() === 'trade good' && typeof SHOP_DATA === 'object' && SHOP_DATA && Array.isArray(SHOP_DATA.tradegoods) && SHOP_DATA.tradegoods.length) {
        lootName = String((pick(SHOP_DATA.tradegoods) || {}).name || lootName);
      } else if (typeof normalizeLegacyLootAlias === 'function') {
        lootName = normalizeLegacyLootAlias(lootName);
      }
      let stored = false;
      if (typeof addToBackpack === "function") {
        try { stored = !!addToBackpack(lootName); } catch (err) { console.error(err); }
      }
      if (typeof showNotif === "function") showNotif("Wayfarer task complete: +1 faction Renown · Loot: " + lootName + (stored ? " (backpack)" : ""), "good");
    } else {
      if (typeof changeCounter === "function") changeCounter("tmw", 1);
      safeFactionRenownDelta(task.factionId, -1);
      if (typeof showNotif === "function") showNotif("Wayfarer task failed: +1 Teamwork · -1 faction Renown.", "warn");
    }
  }

  function openCombatTabForTask(task) {
    if (!task || !task.monsterPack) return;
    const pack = task.monsterPack;
    if (typeof showNotif === "function") {
      showNotif("Encounter: " + pack.count + " " + pack.name + " (Dread d" + pack.dread + " | " + pack.health + " HP each). Resolve in Combat, then return to this hex.", "warn");
    }
    const btn = (typeof document !== "undefined") ? document.querySelector(".tab-btn[onclick*=\"combat\"]") : null;
    if (typeof switchTab === "function") switchTab("combat", btn || null);
  }

  function resolveWayfarerTaskRoll(region, key, secondary) {
    const task = findTaskAt(region, key, secondary);
    if (!task || task.status !== "open") return;
    if (task.monsterTask) {
      task.status = "combat_pending";
      openCombatTabForTask(task);
      return;
    }
    const check = rollBaseCheck("valor", 6);
    grantTaskReward(task, check.success);
    removeTask(task.id);
  }

  function startMonsterTaskEncounter(region, key, secondary) {
    const task = findTaskAt(region, key, secondary);
    if (!task || !task.monsterTask) return;
    task.status = "combat_pending";
    openCombatTabForTask(task);
  }

  function finalizeMonsterTaskEncounter(region, key, secondary, success) {
    const task = findTaskAt(region, key, secondary);
    if (!task || !task.monsterTask || task.status !== "combat_pending") return;
    grantTaskReward(task, !!success);
    removeTask(task.id);
  }

  function taskUiPayload(task) {
    if (!task) return null;
    const pack = task.monsterPack;
    return {
      id: task.id,
      title: task.title,
      factionId: task.factionId,
      status: task.status,
      monsterTask: !!task.monsterTask,
      monsterSummary: pack ? (pack.count + " " + pack.name + " · d" + pack.dread + " · " + pack.health + " HP") : "",
    };
  }

  function getTaskAtProvince(key) { return taskUiPayload(findTaskAt("province", key)); }
  function getTaskAtSea(key) { return taskUiPayload(findTaskAt("sea", key)); }
  function getTaskAtGalaxy(hexId) { return taskUiPayload(findTaskAt("galaxy", hexId)); }
  function getTaskAtWTW(hexId) { return taskUiPayload(findTaskAt("wtw", hexId)); }
  function getTaskAtPlanet(hexId, cellId) { return taskUiPayload(findTaskAt("planet", hexId, cellId)); }

  function resolveNpcConversation(factionId, idx) {
    const base = ensureBaseActivity(factionId);
    const npc = base && Array.isArray(base.npcs) ? base.npcs[Number(idx)] : null;
    const regionCode = getBaseRegionCode(base);
    if (!npc) return;
    const check = rollBaseCheck("lead", 6);
    if (check.success) {
      const secret = pick(WAYFARER_SECRET_POOL);
      base.discoveredSecrets = Array.isArray(base.discoveredSecrets) ? base.discoveredSecrets : [];
      base.discoveredSecrets.unshift(secret);
      base.discoveredSecrets = base.discoveredSecrets.slice(0, 6);
      if (typeof window !== "undefined" && typeof window.registerSecretPadClue === "function") {
        if (regionCode === "province") window.registerSecretPadClue("province", "talk");
        if (regionCode === "sea") window.registerSecretPadClue("sea", "talk");
      }
      if (typeof showNotif === "function") showNotif(npc.name + " reveals a secret: " + secret, "good");
    } else {
      if (typeof showNotif === "function") showNotif(npc.name + " withholds details. Lead check failed.", "warn");
    }
    openFactionBaseHub(factionId);
  }

  function generateNpcTask(factionId, idx) {
    const base = ensureBaseActivity(factionId);
    const npc = base && Array.isArray(base.npcs) ? base.npcs[Number(idx)] : null;
    if (!npc) return;
    const existing = getOpenTasks().find((t) => t && t.factionId === factionId && t.npcName === npc.name);
    if (existing) {
      if (typeof showNotif === "function") showNotif("This wayfarer already has an active task marker.", "warn");
      openFactionBaseHub(factionId);
      return;
    }
    const task = createWayfarerTask(factionId, npc.name);
    if (!task) {
      if (typeof showNotif === "function") showNotif("Unable to place task marker yet. Explore this region first.", "warn");
      openFactionBaseHub(factionId);
      return;
    }
    if (typeof showNotif === "function") showNotif("Task posted to the map from " + npc.name + ".", "good");
    openFactionBaseHub(factionId);
  }

  // ============================================================================
  // STORY PATHWAYS — The Five Philosophical Ends
  // ============================================================================

  const ENDING_CINEMATICS = {
    heroic: {
      opener: "Stormlight breaks through smoke over shattered watchtowers.",
      scene: "You are remembered by names you never learned. Survivors tell stories of the day you chose others over certainty, and your choices become a doctrine of mercy under pressure.",
      epilogue: "A generation later, your sigil is painted on relief caravans and peace convoys."
    },
    tyrant: {
      opener: "Gold banners flap above a silent city that does not cheer.",
      scene: "You secure absolute control. Every rival kneels or vanishes. Your commands are obeyed instantly, but every room goes quiet when you enter it.",
      epilogue: "Your empire endures, but nobody can tell whether it is order or grief wearing armor."
    },
    martyr: {
      opener: "Dawn arrives at a memorial carved into scorched stone.",
      scene: "You give away what no one else would surrender. Your final act turns defeat into a rallying cry strong enough to outlive your body.",
      epilogue: "People speak of you in the present tense, as if sacrifice made you impossible to bury."
    },
    broken: {
      opener: "Fog rolls across fields where nothing grows.",
      scene: "You made the hard choices. The world stabilizes, but not better—just different. You survived when better people didn't. You live long enough to see what you fought for become twisted in new ways.",
      epilogue: "In the end, you pour yourself into whiskey and regret, knowing some choices can never be unmade."
    },
    fortune: {
      opener: "At sunrise, faction emissaries stand together for the first time without guards between them.",
      scene: "No single ideology wins. Instead, your contracts forced shared dependency and hard compromise until peace became practical, then desirable.",
      epilogue: "Children grow up treating old frontlines as roads, not borders."
    }
  };

  const STORY_PATHWAYS = {
    heroic: {
      id: "heroic",
      name: "The Heroic Path",
      emoji: "⚡",
      description: "Always sacrifice for others. Choose redemption over power.",
      keyChoices: [
        "Protect the innocent at cost to yourself",
        "Oppose tyranny even when outmatched",
        "Speak truth even when it destroys you",
        "Give mercy to enemies"
      ],
      idealFactions: ["rebels", "scholars", "religious"],
      ending: {
        title: "The Light Behind You",
        text: "Your name becomes legend—not for what you conquered, but for what you saved. The world doesn't change overnight, but because you chose sacrifice, others find the courage to do the same. You don't see the peace you fought for, but you know it was planted in better soil.",
        vibe: "Bittersweet triumph. Legacy matters more than life."
      }
    },

    tyrant: {
      id: "tyrant",
      name: "The Tyrant's Path",
      emoji: "👿",
      description: "Accumulate power. Dominate those weaker than you.",
      keyChoices: [
        "Betray allies for personal gain",
        "Rule through fear and cruelty",
        "Take everything that isn't nailed down",
        "Treat mercy as weakness"
      ],
      idealFactions: ["corporations", "military"],
      ending: {
        title: "The Empty Throne",
        text: "You won. You control cities, command armies, own fortunes. You sit upon a throne built from the bones of those you crushed. Every shadow might be an assassin. Every ally smiles with a hidden knife. You have everything except the one thing you can never buy back: the capacity to trust anyone. You died at the top of the hill, alone.",
        vibe: "Hollow victory. Power without meaning."
      }
    },

    martyr: {
      id: "martyr",
      name: "The Martyr's Path",
      emoji: "❤️",
      description: "Give everything, including your life, to a cause greater than yourself.",
      keyChoices: [
        "Shoulder others' burdens repeatedly",
        "Seek redemption through suffering",
        "Die for what you believe",
        "Leave nothing behind but memory"
      ],
      idealFactions: ["religious", "rebels", "underworld"],
      ending: {
        title: "The Last Prayer",
        text: "In your final moments, you understand: you were never meant to survive. Your death becomes the fulcrum upon which the world turns. Movements rise in your name. The oppressed take courage from your sacrifice. You become myth—and myths, you discover from beyond the veil, are more powerful than any living hero.",
        vibe: "Tragic grace. Your death births change."
      }
    },

    broken: {
      id: "broken",
      name: "The Broken Path",
      emoji: "💔",
      description: "Make the hard choices. Accept that you can't save everyone.",
      keyChoices: [
        "Choose between irreconcilable options",
        "Let people die to save others",
        "Sacrifice your hopes for others' survival",
        "Live with unbearable guilt"
      ],
      idealFactions: ["military", "underworld", "corporations"],
      ending: {
        title: "The Long Forgetting",
        text: "The world stabilizes. It's not better—it's just... different. You survived when better people didn't. You made the calls that saved thousands but condemned hundreds. You're remembered, but with an undertone of sadness. You live long enough to see what you fought for become twisted in new ways. In the end, you pour yourself into whiskey and regret, knowing some choices can never be unmade.",
        vibe: "Quiet despair. You paid the price and still owe a debt."
      }
    },

    fortune: {
      id: "fortune",
      name: "The Fortune's Path",
      emoji: "🌟",
      description: "Build connections. Create win-wins. Find the overlapping interests.",
      keyChoices: [
        "Find common ground between enemies",
        "Build alliances through understanding",
        "Protect both yourself and others",
        "Leave the world better without breaking yourself"
      ],
      idealFactions: ["scholars", "corporations", "religious"],
      ending: {
        title: "The Sunrise",
        text: "Against impossible odds, you actually did it. The factions found common cause. The war ended not in annihilation but in treaty, understanding, and mutual benefit. You built a network of trust so strong that each faction realized they needed each other more than they needed dominance. You take a lover. You build a home. You plant orchards and watch them grow. This ending is so rare, so seemingly impossible, that historians will spend centuries debating whether you were brilliant or just impossibly lucky.",
        vibe: "Rare joy. The ending nobody believes is possible."
      }
    }
  };

  // ============================================================================
  // FACTION DYNAMICS — Trust, Betrayal, Rival Factions
  // ============================================================================

  const FACTION_DYNAMICS = {
    allies: [
      { f1: "rebels", f2: "underworld" },
      { f1: "rebels", f2: "scholars" },
      { f1: "religious", f2: "scholars" },
      { f1: "corporations", f2: "military" },
      { f1: "scholars", f2: "religious" }
    ],
    enemies: [
      { f1: "rebels", f2: "corporations" },
      { f1: "rebels", f2: "military" },
      { f1: "underworld", f2: "military" },
      { f1: "religious", f2: "underworld" },
      { f1: "corporations", f2: "rebels" }
    ],
    neutral: [
      { f1: "scholars", f2: "corporations" },
      { f1: "scholars", f2: "military" },
      { f1: "underworld", f2: "corporations" }
    ]
  };

  // ============================================================================
  // CONSEQUENCES SYSTEM — Choices Have Cascading Effects
  // ============================================================================

  const CHOICE_CONSEQUENCES = {
    // When you make a choice, it affects multiple factions
    // Example structure:
    "rescue_rebel_leader": {
      immediate: { reputation: { rebels: 3 } },
      delayed_turn_5: { reputation: { military: -2 }, alert: "Military is hunting you" },
      delayed_turn_10: { reputation: { underworld: 1 }, text: "The Underground Crown notices your loyalty" }
    },

    "cooperate_with_military": {
      immediate: { reputation: { military: 2 } },
      delayed_turn_3: { reputation: { rebels: -2, underworld: -1 }, alert: "Rebels consider you a traitor" }
    },

    "steal_corporate_secrets": {
      immediate: { reputation: { underworld: 2, scholars: 1 } },
      delayed_turn_4: { reputation: { corporations: -3, military: -1 }, bounty: 500 }
    },

    "help_religious_pilgrims": {
      immediate: { reputation: { religious: 2, scholars: 1 } },
      delayed_turn_6: { reputation: { underworld: -1 }, text: "Underworld views you as weak" }
    }
  };

  // ============================================================================
  // TRUST SYSTEM — Build Deep Relationships
  // ============================================================================

  const TRUST_LEVELS = [
    { level: 0, name: "Unknown", effect: "Limited missions available" },
    { level: 1, name: "Acquainted", effect: "Minor missions open. Basic discounts." },
    { level: 2, name: "Trusted", effect: "Medium missions open. Better discounts. Allies will help in crisis." },
    { level: 3, name: "Bonded", effect: "Major missions open. Faction leader meets you personally. Access to secret locations." },
    { level: 4, name: "Blood-Sworn", effect: "Exclusive missions. Faction will go to war for you. Access to legendary items." },
  ];

  // ============================================================================
  // BETRAYAL MECHANICS
  // ============================================================================

  const BETRAYAL_SCENARIOS = [
    {
      id: "double_agent",
      title: "The Double Agent",
      desc: "A faction learns you've been accepting missions from their enemies",
      severity: "high",
      consequence: "Reputation loss, possible contract on your head",
      recoveryOptions: [
        { text: "Confession and penance — take a dangerous redemption mission", cost: "time + risk" },
        { text: "Deny everything — they're not sure, but trust is fractured", cost: "reputation -2 per faction" },
        { text: "Prove your loyalty by eliminating a greater threat", cost: "potentially killing innocents" }
      ]
    },

    {
      id: "divided_loyalty",
      title: "Divided Loyalty",
      desc: "Two allied factions ask you to do conflicting missions",
      severity: "medium",
      consequence: "Betraying one faction no matter what you do",
      recoveryOptions: [
        { text: "Come clean to both factions about the contradiction", cost: "temporary distrust" },
        { text: "Play them against each other (dangerous)", cost: "both might turn on you" },
        { text: "Somehow complete both missions (nearly impossible)", cost: "extreme risk" }
      ]
    },

    {
      id: "faction_betrays_you",
      title: "The Faction Betrays You",
      desc: "Your trusted faction sells you out or sets a deadly trap",
      severity: "critical",
      consequence: "Lose that faction entirely, risk death",
      recoveryOptions: [
        { text: "Disappear and join a rival faction", cost: "all progress with old faction lost" },
        { text: "War — take revenge", cost: "enemies unite against you" },
        { text: "Redemption arc — prove that faction wrong", cost: "longest most dangerous path" }
      ]
    }
  ];

  const ADAPTIVE_CHOICE_LIBRARY = {
    heroic: [
      {
        templateId: "heroic_refugee_corridor",
        title: function (ctx) { return "Open a safe corridor for " + ctx.pressuredName + " civilians"; },
        prompt: function (ctx) { return "A frightened convoy is trapped between " + ctx.favoredName + " patrol doctrine and " + ctx.pressuredName + " desperation. You can force a humane exit, but someone powerful will call it treason."; },
        preview: function (ctx) { return "Save lives, gain trust with " + ctx.pressuredName + ", and strain ties with " + ctx.favoredName + "."; },
        detail: function (ctx) { return "You create a humanitarian corridor in defiance of a harder line. Survivors will remember who chose mercy over discipline."; },
        renown: function (ctx) { const out = {}; out[ctx.pressured] = 1; out[ctx.favored] = -1; return out; },
        pathPoints: { heroic: 1 },
        resources: { tmw: 1 },
        deltas: { stability: 1, witness: 1, factionHeat: -1 },
        tags: ["faction-pressure", "relief-route", "npc-relationship"]
      },
      {
        templateId: "heroic_truth_ledger",
        title: function (ctx) { return "Expose the ledger that is bleeding " + ctx.secondaryName; },
        prompt: function (ctx) { return "Someone inside " + ctx.favoredName + " is engineering shortages and blaming " + ctx.secondaryName + ". Publishing the truth will ruin a useful alliance but stop a quiet atrocity."; },
        preview: function (ctx) { return "Protect the vulnerable, trade comfort for honesty, and shift the blame map."; },
        detail: function (ctx) { return "You release proof that the crisis was manufactured. The lie collapses, but the faction profiting from it marks you as a liability."; },
        renown: function (ctx) { const out = {}; out[ctx.secondary] = 1; out[ctx.favored] = -1; return out; },
        pathPoints: { heroic: 1 },
        resources: { renown: 1 },
        deltas: { stability: 1, rumor: 1, witness: 1 },
        tags: ["faction-pressure", "truth-revealed", "discovered-route"]
      },
      {
        templateId: "heroic_broker_truce",
        title: function (ctx) { return "Broker a truce between " + ctx.favoredName + " and " + ctx.pressuredName; },
        prompt: function (ctx) { return "Both factions are exhausted enough to listen for one hour. If you spend that hour well, the war cools. If you fail, both sides will blame you for the next dead."; },
        preview: function () { return "Reduce heat, earn fragile goodwill, and tilt your ending toward reconciliation."; },
        detail: function (ctx) { return "You force open negotiation where both sides wanted another skirmish. The ceasefire is imperfect, but it buys the region a future."; },
        renown: function (ctx) { const out = {}; out[ctx.favored] = 1; out[ctx.pressured] = 1; return out; },
        pathPoints: { heroic: 1 },
        resources: { tmw: 1 },
        deltas: { stability: 1, factionHeat: -1, witness: 1 },
        tags: ["faction-pressure", "opened-negotiations", "npc-relationship"]
      }
    ],
    tyrant: [
      {
        templateId: "tyrant_route_seizure",
        title: function (ctx) { return "Seize the route before " + ctx.pressuredName + " can flee"; },
        prompt: function (ctx) { return "The road belongs to whoever is cruel enough to close it first. Lock it down, tax every crossing, and make " + ctx.pressuredName + " crawl back to your chosen patron."; },
        preview: function (ctx) { return "Gain leverage and coin fast, but raise heat and harden the region against you."; },
        detail: function (ctx) { return "You turn survival into a toll road. Order arrives quickly, but it reeks of fear and forced obedience."; },
        renown: function (ctx) { const out = {}; out[ctx.favored] = 1; out[ctx.pressured] = -1; return out; },
        pathPoints: { tyrant: 1 },
        resources: { credits: 75 },
        deltas: { stability: -1, factionHeat: 1, scarcity: 1 },
        tags: ["faction-pressure", "closed-border", "dangerous-road", "patrol-deployed"]
      },
      {
        templateId: "tyrant_public_purge",
        title: function (ctx) { return "Stage a public purge to break " + ctx.secondaryName + " resistance"; },
        prompt: function (ctx) { return "A visible punishment will end sabotage for a season. It will also prove that you believe fear is more reliable than trust."; },
        preview: function (ctx) { return "Boost the hardliners, fracture civic trust, and move the world toward a harsher ending."; },
        detail: function (ctx) { return "You make an example of dissent. The sabotage slows, but the story of what you did spreads faster than the victory."; },
        renown: function (ctx) { const out = {}; out[ctx.favored] = 1; out[ctx.secondary] = -1; return out; },
        pathPoints: { tyrant: 1 },
        resources: { renown: 1 },
        deltas: { stability: -1, rumor: 1, factionHeat: 1 },
        tags: ["faction-pressure", "active-crisis", "fear-doctrine", "border-closed"]
      },
      {
        templateId: "tyrant_monopoly_strike",
        title: function (ctx) { return "Crush the market and hand " + ctx.favoredName + " the monopoly"; },
        prompt: function (ctx) { return "One decisive strike against caravans, brokers, and smugglers would end the current bidding war. It would also make one faction rich enough to dictate the next season of history."; },
        preview: function (ctx) { return "Take immediate profit, strengthen your favorite power bloc, and deepen scarcity."; },
        detail: function (ctx) { return "You collapse the competition and crown a winner. Prices rise, options die, and the streets learn who controls the flow."; },
        renown: function (ctx) { const out = {}; out[ctx.favored] = 2; out[ctx.pressured] = -1; return out; },
        pathPoints: { tyrant: 1 },
        resources: { credits: 100 },
        deltas: { stability: -1, scarcity: 1, witness: -1 },
        tags: ["faction-pressure", "monopoly", "closed-port", "dangerous-road"]
      }
    ],
    martyr: [
      {
        templateId: "martyr_take_blame",
        title: function (ctx) { return "Take the blame so " + ctx.pressuredName + " can disappear"; },
        prompt: function (ctx) { return "You can redirect the purge toward yourself. The hunted will escape, but you will wear the debt, the warrant, and the story."; },
        preview: function (ctx) { return "Protect the desperate, accept personal cost, and deepen the martyr path."; },
        detail: function (ctx) { return "You step into the line of fire so others can leave it. The region changes because someone decided the price would be personal."; },
        renown: function (ctx) { const out = {}; out[ctx.pressured] = 1; return out; },
        pathPoints: { martyr: 1 },
        resources: { stress: 1, tmw: 1 },
        deltas: { stability: 1, witness: 1, factionHeat: -1 },
        tags: ["faction-pressure", "sacrifice", "npc-relationship", "threat-cleared"]
      },
      {
        templateId: "martyr_hold_line",
        title: function (ctx) { return "Hold the line while " + ctx.secondaryName + " evacuates"; },
        prompt: function (ctx) { return "There is only enough time for one thing: escape or resistance. Stay behind, buy the minutes, and let the survivors decide what your name means later."; },
        preview: function (ctx) { return "Take stress now, buy future goodwill, and hand the next scene to those you saved."; },
        detail: function (ctx) { return "You become the delaying action. The position is lost, but the people are not."; },
        renown: function (ctx) { const out = {}; out[ctx.secondary] = 1; out[ctx.favored] = -1; return out; },
        pathPoints: { martyr: 1 },
        resources: { stress: 2 },
        deltas: { stability: 1, witness: 1, rumor: 1 },
        tags: ["faction-pressure", "sacrifice", "discovered-route", "active-crisis"]
      },
      {
        templateId: "martyr_carry_relic",
        title: function (ctx) { return "Carry the cursed proof out of " + ctx.favoredName + " territory"; },
        prompt: function (ctx) { return "The evidence that could unmake a faction is too dangerous for anyone else to bear. Take it yourself and live with what it does to you on the road."; },
        preview: function (ctx) { return "Advance the truth, lose comfort, and make your body the cost of revelation."; },
        detail: function (ctx) { return "You leave with the truth and the wound it causes. The revelation survives because you chose to carry it personally."; },
        renown: function (ctx) { const out = {}; out[ctx.pressured] = 1; out[ctx.favored] = -1; return out; },
        pathPoints: { martyr: 1 },
        resources: { stress: 1, renown: 1 },
        deltas: { witness: 1, rumor: 1, factionHeat: -1 },
        tags: ["faction-pressure", "sacrifice", "truth-revealed", "npc-relationship"]
      }
    ]
  };

  // ============================================================================
  // DYNAMIC CHOICE GENERATION — Every Decision Feels Unique
  // ============================================================================

  function getAdaptiveChoiceVariant(pathKey, historyLength) {
    const pool = ADAPTIVE_CHOICE_LIBRARY[pathKey] || [];
    if (!pool.length) return null;
    return pool[Math.abs(Number(historyLength || 0)) % pool.length] || pool[0];
  }

  function getPathwayAlignmentKey(pathPoints) {
    const points = pathPoints || {};
    const ordered = [
      { key: "heroic", value: Number(points.heroic || 0) },
      { key: "tyrant", value: Number(points.tyrant || 0) },
      { key: "martyr", value: Number(points.martyr || 0) }
    ].sort((a, b) => b.value - a.value);
    return (ordered[0] && ordered[0].value > 0) ? ordered[0].key : "contested";
  }

  function buildAdaptiveChoiceContext() {
    ensureFactionState();
    const factionReputation = Object.assign({}, S.factionRenown || {});
    const pathPoints = Object.assign({}, (S.factionNarrative && S.factionNarrative.pathPoints) || {});
    const choiceHistory = Array.isArray(S.factionNarrative.choiceHistory) ? S.factionNarrative.choiceHistory.slice(-12) : [];
    const ordered = Object.keys(FACTIONS).sort((a, b) => Number(factionReputation[b] || 0) - Number(factionReputation[a] || 0));
    const favored = ordered[0] || "corporations";
    const pressured = ordered[ordered.length - 1] || favored;
    let secondary = getRivalFaction(favored) || pressured;
    if (!secondary || secondary === favored) secondary = pressured;
    if (!secondary || secondary === favored) secondary = ordered[1] || favored;
    return {
      factionReputation,
      pathwayAlignment: pathPoints,
      dominantPath: getPathwayAlignmentKey(pathPoints),
      choiceHistory,
      favored,
      favoredName: (FACTIONS[favored] && FACTIONS[favored].name) || toTitle(favored),
      pressured,
      pressuredName: (FACTIONS[pressured] && FACTIONS[pressured].name) || toTitle(pressured),
      secondary,
      secondaryName: (FACTIONS[secondary] && FACTIONS[secondary].name) || toTitle(secondary)
    };
  }

  function buildAdaptiveRefreshToken(currentContext) {
    const ctx = currentContext || {};
    const points = ctx.pathwayAlignment || {};
    const rep = ctx.factionReputation || {};
    return [
      ctx.dominantPath || "contested",
      ctx.favored || "",
      ctx.pressured || "",
      ctx.secondary || "",
      Number(points.heroic || 0),
      Number(points.tyrant || 0),
      Number(points.martyr || 0),
      Number(rep[ctx.favored] || 0),
      Number(rep[ctx.pressured] || 0),
      Array.isArray(ctx.choiceHistory) ? ctx.choiceHistory.length : 0
    ].join("|");
  }

  function generateAdaptiveChoices(currentContext) {
    // Player's choices ALWAYS matter and lead to new situations
    // This system ensures no two playthroughs are identical
    const ctx = currentContext || buildAdaptiveChoiceContext();
    const factionStates = ctx.factionReputation || {};
    const moralAlignment = ctx.pathwayAlignment || {};
    const pastChoices = Array.isArray(ctx.choiceHistory) ? ctx.choiceHistory : [];

    const choices = [];

    // Every choice has 3+ options aligned to different philosophies
    // Every choice has unseen consequences that ripple through the world

    ["heroic", "tyrant", "martyr"].forEach((pathKey, idx) => {
      const variant = getAdaptiveChoiceVariant(pathKey, pastChoices.length + idx);
      if (!variant) return;
      const targetContext = Object.assign({}, ctx, {
        favored: idx === 1 ? ctx.favored : (idx === 2 ? ctx.secondary : ctx.pressured),
        favoredName: idx === 1 ? ctx.favoredName : (idx === 2 ? ctx.secondaryName : ctx.pressuredName),
        pressured: idx === 0 ? ctx.pressured : (idx === 2 ? ctx.favored : ctx.pressured),
        pressuredName: idx === 0 ? ctx.pressuredName : (idx === 2 ? ctx.favoredName : ctx.pressuredName),
        secondary: idx === 2 ? ctx.pressured : ctx.secondary,
        secondaryName: idx === 2 ? ctx.pressuredName : ctx.secondaryName
      });
      const renown = typeof variant.renown === "function" ? variant.renown(targetContext) : Object.assign({}, variant.renown || {});
      const detail = typeof variant.detail === "function" ? variant.detail(targetContext) : String(variant.detail || "");
      choices.push({
        id: variant.templateId + ":" + targetContext.favored + ":" + targetContext.pressured + ":" + pastChoices.length,
        templateId: variant.templateId,
        pathway: pathKey,
        title: typeof variant.title === "function" ? variant.title(targetContext) : String(variant.title || "Faction choice"),
        prompt: typeof variant.prompt === "function" ? variant.prompt(targetContext) : String(variant.prompt || ""),
        preview: typeof variant.preview === "function" ? variant.preview(targetContext) : String(variant.preview || ""),
        detail,
        primaryFaction: targetContext.favored,
        secondaryFaction: targetContext.pressured,
        renown,
        pathPoints: Object.assign({}, variant.pathPoints || {}),
        resources: Object.assign({}, variant.resources || {}),
        world: {
          severity: pathKey === "tyrant" ? "high" : "medium",
          deltas: Object.assign({}, variant.deltas || {}),
          tags: [pathKey].concat(Array.isArray(variant.tags) ? variant.tags : [])
        },
        context: {
          favoredScore: Number(factionStates[targetContext.favored] || 0),
          pressuredScore: Number(factionStates[targetContext.pressured] || 0),
          dominantPath: getPathwayAlignmentKey(moralAlignment)
        }
      });
    });

    return choices;
  }

  function ensureAdaptiveChoices(force) {
    ensureFactionState();
    const ctx = buildAdaptiveChoiceContext();
    const token = buildAdaptiveRefreshToken(ctx);
    if (force || !Array.isArray(S.factionNarrative.currentAdaptiveChoices) || !S.factionNarrative.currentAdaptiveChoices.length || S.factionNarrative.adaptiveRefreshToken !== token) {
      S.factionNarrative.currentAdaptiveChoices = generateAdaptiveChoices(ctx);
      S.factionNarrative.adaptiveRefreshToken = token;
    }
    return S.factionNarrative.currentAdaptiveChoices || [];
  }

  function renderAdaptiveChoicesHtml() {
    const choices = ensureAdaptiveChoices(false);
    const dominant = getPathwayAlignmentKey((S.factionNarrative && S.factionNarrative.pathPoints) || {});
    const dominantText = dominant === "contested" ? "No doctrine dominates yet." : (toTitle(dominant) + " pressure currently leads your trajectory.");
    const cards = choices.map((choice) => {
      const color = choice.pathway === "heroic" ? "var(--teal)" : choice.pathway === "tyrant" ? "var(--red2)" : "var(--gold2)";
      return "<div class='card' style='padding:.6rem;border-left:3px solid " + color + ";'>"
        + "<div style='display:flex;justify-content:space-between;gap:.4rem;align-items:flex-start;margin-bottom:.22rem;'>"
        + "<strong style='color:var(--text);'>" + choice.title + "</strong>"
        + "<span style='font-size:.68rem;color:" + color + ";text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;'>" + toTitle(choice.pathway) + "</span>"
        + "</div>"
        + "<div style='font-size:.78rem;color:var(--text2);line-height:1.6;margin-bottom:.2rem;'>" + choice.prompt + "</div>"
        + "<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.28rem;'><strong>Likely Fallout:</strong> " + choice.preview + "</div>"
        + "<div style='display:flex;gap:.25rem;flex-wrap:wrap;'>"
        + "<button class='btn btn-xs btn-primary' onclick=\"factionSystem.resolveAdaptiveChoice('" + choice.id + "')\">Take This Side</button>"
        + "</div>"
        + "</div>";
    }).join("");

    return "<div class='faction-dynamics'>"
      + "<h2>ADAPTIVE PRESSURE CHOICES</h2>"
      + "<p>These crossroads respond to your Renown, pathway drift, and recent faction decisions. Resolve one to let the world answer back.</p>"
      + "<div style='font-size:.78rem;color:var(--muted2);margin-bottom:.45rem;'>" + dominantText + "</div>"
      + "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.45rem;'>" + cards + "</div>"
      + "<div style='margin-top:.45rem;display:flex;gap:.35rem;flex-wrap:wrap;'><button class='btn btn-xs' onclick='factionSystem.refreshAdaptiveChoices()'>Draw New Crossroads</button></div>"
      + "</div>";
  }

  function resolveAdaptiveChoice(choiceId) {
    ensureFactionState();
    const choices = ensureAdaptiveChoices(false);
    const choice = choices.find((entry) => String(entry.id) === String(choiceId));
    if (!choice) {
      if (typeof showNotif === "function") showNotif("That pressure choice expired. Draw a fresh set.", "warn");
      return;
    }

    Object.keys(choice.renown || {}).forEach((factionId) => {
      safeFactionRenownDelta(factionId, Number(choice.renown[factionId] || 0));
    });

    const points = S.factionNarrative.pathPoints || { heroic: 0, tyrant: 0, martyr: 0 };
    Object.keys(choice.pathPoints || {}).forEach((key) => {
      points[key] = Number(points[key] || 0) + Number(choice.pathPoints[key] || 0);
    });

    const resources = choice.resources || {};
    if (Number(resources.credits || 0)) {
      if (typeof changeCredits === "function") changeCredits(Number(resources.credits || 0));
      else S.credits = Math.max(0, Number(S.credits || 0) + Number(resources.credits || 0));
    }
    if (Number(resources.renown || 0)) {
      if (typeof changeCounter === "function") {
        try { changeCounter("renown", Number(resources.renown || 0)); } catch (_err) {}
      } else {
        S.renown = Math.max(0, Number(S.renown || 0) + Number(resources.renown || 0));
      }
    }
    if (Number(resources.tmw || 0)) {
      if (typeof changeCounter === "function") {
        try { changeCounter("tmw", Number(resources.tmw || 0)); } catch (_err) {}
      }
    }
    if (Number(resources.stress || 0)) {
      if (typeof changeStress === "function") changeStress(Number(resources.stress || 0));
      else S.stress = Math.max(0, Number(S.stress || 0) + Number(resources.stress || 0));
    }

    S.factionNarrative.choiceHistory.push({
      id: choice.id,
      templateId: choice.templateId,
      title: choice.title,
      pathway: choice.pathway,
      primaryFaction: choice.primaryFaction,
      secondaryFaction: choice.secondaryFaction,
      at: Date.now()
    });
    if (S.factionNarrative.choiceHistory.length > 24) {
      S.factionNarrative.choiceHistory = S.factionNarrative.choiceHistory.slice(-24);
    }

    const ending = computeFactionEndingFromPoints();
    const finaleBefore = Object.assign({}, S.factionNarrative.finale || {});
    const finaleAfter = syncFinaleProgress();
    S.factionNarrative.endingResult = ending;

    const base = S.factionBases && S.factionBases[choice.primaryFaction] ? S.factionBases[choice.primaryFaction] : null;
    recordFactionConsequence({
      system: "faction",
      factionId: choice.primaryFaction,
      title: choice.title,
      detail: choice.detail,
      region: String((base && base.regionType) || "province").toLowerCase(),
      locationKey: factionLocationKeyFromBase(base, null),
      severity: String((choice.world && choice.world.severity) || "medium"),
      deltas: Object.assign({}, (choice.world && choice.world.deltas) || {}),
      tags: Array.isArray(choice.world && choice.world.tags) ? choice.world.tags.slice() : ["faction-pressure"]
    });

    S.factionNarrative.currentAdaptiveChoices = [];
    S.factionNarrative.adaptiveRefreshToken = "";

    if (typeof showNotif === "function") {
      showNotif("Faction pressure resolved: " + choice.title, "good");
      if (ending && ending.key && ending.key !== "contested") showNotif("Ending trajectory: " + ending.title, "good");
      if (!finaleBefore.unlocked && finaleAfter.unlocked) showNotif("Final outcome unlocked in Endings.", "good");
    }

    setupFactionTab();
    renderEndingsPanel();
  }

  function refreshAdaptiveChoices() {
    ensureAdaptiveChoices(true);
    setupFactionTab();
  }

  // ============================================================================
  // SETUP — Initialize Faction System
  // ============================================================================

  function setupFactionTab() {
    patchFactionTabSwitchRefresh();
    patchRenownRefresh();
    ensureFactionState();
    syncFactionBaseMarkers();
    const factionPanel = document.getElementById(FACTION_TAB_ID);
    if (!factionPanel) return;

    let html = `
      <div class="faction-container">
        <div class="faction-intro">
          <h2>GUILD SYSTEM</h2>
          <p>The world is divided into six major guild powers. Join one, take contracts, and push long-form campaigns while your Renown still drives the same signature Action Die bonuses.</p>
          <p style="margin-top:.45rem;color:var(--muted2);font-size:.82rem;line-height:1.6;">
            Lore Focus Mapping:
            <strong style="color:var(--gold2);">Mages = Mind</strong>,
            <strong style="color:var(--gold2);">Warriors = Strike</strong>,
            <strong style="color:var(--gold2);">Rogues/Brokers = Control</strong>,
            <strong style="color:var(--gold2);">Vanguards/Envoys = Lead</strong>,
            <strong style="color:var(--gold2);">Sages = Mind</strong>.
          </p>
        </div>

        <div class="faction-grid">
    `;

    Object.values(FACTIONS).forEach((faction) => {
      const renown = getFactionRenown(faction.id);
      const actionDie = FACTION_ACTION_DIE_MAP[faction.id] || "mind";
      const loreRole = FACTION_LORE_ROLE_MAP[faction.id] || "Specialists";
      const base = (S && S.factionBases && S.factionBases[faction.id]) ? S.factionBases[faction.id] : null;
      const guildView = getGuildPresentation(faction.id);
      const guildState = getGuildCampaignState(faction.id);
      const cfg = getGuildCampaignConfig(faction.id);
      const stageDisplay = cfg && Array.isArray(cfg.quests) ? (Math.min(Number(guildState.currentArcStage || 0), cfg.quests.length) + " / " + cfg.quests.length) : "Not configured";
      html += `
        <div class="faction-card" data-faction="${faction.id}">
          <div class="faction-header">
            <span class="faction-emoji">${faction.emoji}</span>
            <h3>${guildView.displayName}</h3>
          </div>
          <div class="faction-essence">${faction.essence} · ${guildView.campaignTag}</div>
          <p class="faction-lore">${faction.lore}</p>
          <p class="faction-motto"><em>"${faction.motto}"</em></p>
          <div class="faction-stats">
            <div class="stat">
              <label>Philosophy:</label>
              <span>${faction.philosophy}</span>
            </div>
            <div class="stat">
              <label>Ideal Ending:</label>
              <span>${faction.idealEnding}</span>
            </div>
            <div class="stat">
              <label>Renown:</label>
              <span>${renown}</span>
            </div>
            <div class="stat">
              <label>Lore Focus:</label>
              <span>${loreRole} = ${toTitle(actionDie)}</span>
            </div>
            <div class="stat">
              <label>Action Die Bonus:</label>
              <span>+${Math.max(0, renown)} ${toTitle(actionDie)} (${loreRole} story)</span>
            </div>
            <div class="stat">
              <label>Guild Base:</label>
              <span>${base ? base.regionType : "Uncharted"}</span>
            </div>
            <div class="stat">
              <label>Campaign Stage:</label>
              <span>${stageDisplay}</span>
            </div>
            <div class="stat">
              <label>Membership:</label>
              <span>${guildState.joined ? "Joined" : "Not joined"}</span>
            </div>
          </div>
          <button class="btn btn-sm" onclick="factionSystem.visitBase('${faction.id}')" style="margin-bottom:.4rem;">
            Visit Guild Base
          </button>
          <button class="btn btn-primary faction-expand" onclick="factionSystem.expandFaction('${faction.id}')">
            View Contracts & Campaign
          </button>
        </div>
      `;
    });

    html += `
        </div>

        <div class="faction-pathways">
          <h2>YOUR STORY PATHWAY</h2>
          <p>The choices you make determine not just which faction wins, but what kind of ending you receive.</p>
          <div style="border:1px solid var(--border2);padding:.5rem .6rem;margin:.45rem 0 .65rem 0;font-size:.8rem;color:var(--text2);line-height:1.6;">
            <div><strong style="color:var(--gold2);">Path Points:</strong> Heroic ${Number((S.factionNarrative && S.factionNarrative.pathPoints && S.factionNarrative.pathPoints.heroic) || 0)} · Tyrant ${Number((S.factionNarrative && S.factionNarrative.pathPoints && S.factionNarrative.pathPoints.tyrant) || 0)} · Martyr ${Number((S.factionNarrative && S.factionNarrative.pathPoints && S.factionNarrative.pathPoints.martyr) || 0)}</div>
            <div style="margin-top:.22rem;"><strong style="color:var(--teal);">Ending Trajectory:</strong> ${(computeFactionEndingFromPoints().title || 'Unwritten Fate')}</div>
            <div style="margin-top:.12rem;color:var(--muted2);">${computeFactionEndingFromPoints().vibe || 'Complete guild contracts to shape your ending.'}</div>
          </div>
          <div class="pathway-grid">
    `;

    Object.values(STORY_PATHWAYS).forEach((pathway) => {
      html += `
        <div class="pathway-card">
          <span class="pathway-emoji">${pathway.emoji}</span>
          <h3>${pathway.name}</h3>
          <p class="pathway-desc">${pathway.description}</p>
          <div class="key-choices">
            <strong>Key Choices:</strong>
            <ul>
              ${pathway.keyChoices.map(choice => `<li>${choice}</li>`).join('')}
            </ul>
          </div>
          <div class="pathway-ending">
            <strong>${pathway.ending.title}</strong>
            <p>${pathway.ending.text}</p>
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>

        ${renderAdaptiveChoicesHtml()}

        <div class="faction-dynamics">
          <h2>GUILD DYNAMICS</h2>
          <div class="dynamics-section">
            <h3>Natural Allies</h3>
            <p>These guild powers often align:</p>
            ${FACTION_DYNAMICS.allies.map(pair => `
              <div class="dynamic-pair">
                <span>${FACTIONS[pair.f1].emoji} ${FACTIONS[pair.f1].name}</span>
                <span>↔</span>
                <span>${FACTIONS[pair.f2].emoji} ${FACTIONS[pair.f2].name}</span>
              </div>
            `).join('')}
          </div>
          <div class="dynamics-section">
            <h3>Natural Enemies</h3>
            <p>These guild powers usually clash:</p>
            ${FACTION_DYNAMICS.enemies.map(pair => `
              <div class="dynamic-pair enemy">
                <span>${FACTIONS[pair.f1].emoji} ${FACTIONS[pair.f1].name}</span>
                <span>⚔️</span>
                <span>${FACTIONS[pair.f2].emoji} ${FACTIONS[pair.f2].name}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="faction-trust">
          <h2>TRUST & BETRAYAL</h2>
          <p>Building trust with a guild opens exclusive contracts, campaign access, and deeper relationships. But trust can still shatter fast.</p>
          <div class="trust-levels">
    `;

    TRUST_LEVELS.forEach((level) => {
      html += `
        <div class="trust-level">
          <strong>${level.name}</strong> (Level ${level.level})
          <p>${level.effect}</p>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </div>
      <div id="endingsPanel" style="margin-top:.65rem;"></div>
    `;

    factionPanel.innerHTML = html;
    renderEndingsPanel();
  }

  function getFactionStoryRollBonus(factionId, statKey) {
    const mapped = FACTION_ACTION_DIE_MAP[factionId] || "";
    if (!mapped || mapped !== statKey) return 0;
    return Math.max(0, getFactionRenown(factionId));
  }

  function resolveFactionBaseAnchor(base) {
    if (!base || !base.regionType) return "Unknown location";
    const m = base.marker || {};
    if (base.regionType === "Province Map") {
      const parts = String(m.provinceKey || "").split(",");
      if (parts.length === 2) return "Province Hex [" + (Number(parts[0]) + 1) + "," + (Number(parts[1]) + 1) + "]";
      return "Province frontier outpost";
    }
    if (base.regionType === "Sea Region Hex Map") return m.seaKey ? ("Sea Hex " + m.seaKey) : "A storm-lashed sea fort";
    if (base.regionType === "Galaxy Map") return (typeof m.galaxyHexId === "number") ? ("Galaxy Hex #" + m.galaxyHexId) : "A drifting orbital station";
    if (base.regionType === "Random Planet") {
      if (typeof m.planetHexId === "number" && typeof m.planetCellId === "number") return "Planet Hex #" + m.planetHexId + " / Cell #" + m.planetCellId;
      return "An unlisted colony world";
    }
    if (base.regionType === "World That Was") return m.wtwHexId ? ("World District " + m.wtwHexId) : "A ruined district in the World That Was";
    return base.regionType;
  }

  function safeFactionRenownDelta(factionId, amount) {
    if (typeof changeFactionRenown === "function") {
      changeFactionRenown(factionId, amount);
      return;
    }
    if (!S || !S.factionRenown) return;
    S.factionRenown[factionId] = Math.max(-10, Math.min(20, Number(S.factionRenown[factionId] || 0) + Number(amount || 0)));
  }

  function rollBaseCheck(statKey, dread) {
    const die = (typeof getEffectiveDie === "function") ? getEffectiveDie(statKey) : ((S && S.stats && S.stats[statKey]) || 4);
    const a = (typeof explodingRoll === "function") ? explodingRoll(die) : { total: Math.floor(Math.random() * die) + 1 };
    const d = (typeof explodingRoll === "function") ? explodingRoll(dread) : { total: Math.floor(Math.random() * dread) + 1 };
    return { success: a.total >= d.total, action: a.total, dread: d.total, die };
  }

  function missionDreadByDifficulty(diff) {
    if (diff === "very_hard") return 12;
    if (diff === "hard") return 10;
    return 8;
  }

  function buildMerchantStock(factionId) {
    const out = [];
    const pilotCategoryMap = {
      military: ["weapon_mods", "weapons", "armor", "toolkits", "items"],
      religious: ["scrolls", "remedies", "items", "essentials", "toolkits"]
    };
    const hasShopData = (typeof SHOP_DATA === "object" && SHOP_DATA);
    const selectedCats = hasShopData
      ? (pilotCategoryMap[String(factionId || "")] || ["items", "toolkits", "tradegoods", "weapons", "armor"])
      : [];

    selectedCats.forEach((cat) => {
      const list = (hasShopData && Array.isArray(SHOP_DATA[cat])) ? SHOP_DATA[cat] : [];
      if (list.length) out.push(list[Math.floor(Math.random() * list.length)]);
    });

    if (out.length < 6 && typeof buildGalaxyMerchantOffers === "function") {
      const offers = buildGalaxyMerchantOffers("Guild Base Merchant");
      if (Array.isArray(offers) && offers.length) {
        for (let i = 0; i < offers.length && out.length < 6; i++) {
          out.push(offers[i]);
        }
      }
    }

    return out.slice(0, 6);
  }

  function generateBaseNPCs(factionId) {
    const names = ["Quartermaster Nera", "Scout Voss", "Archivist Pell", "Captain Ilya", "Broker Tamsin", "Wayfarer Dren"]; 
    const rumors = generateFactionBaseEvents(factionId);
    const npcs = [];
    while (npcs.length < 3 && names.length) {
      const idx = Math.floor(Math.random() * names.length);
      const name = names.splice(idx, 1)[0];
      npcs.push({ name, rumor: pick(rumors), mood: pick(["guarded", "friendly", "hurried", "suspicious"]) });
    }
    return npcs;
  }

  function generateBaseRooms(factionId) {
    const theme = BASE_FLAVOR[factionId] || BASE_FLAVOR.scholars;
    const rooms = [
      "Command Wing - " + pick(theme.details),
      "Mess Hall - operatives trade rumors over stale ration tea.",
      "Armory Vault - quartermasters log every missing crate.",
      "Service Corridor - old conduits hide side chambers.",
      "Archive Chamber - sealed ledgers and half-burned maps.",
      "Sublevel Access - a locked hatch leads to forgotten rooms.",
    ];
    const out = [];
    while (out.length < 4 && rooms.length) {
      const idx = Math.floor(Math.random() * rooms.length);
      out.push(rooms.splice(idx, 1)[0]);
    }
    return out;
  }

  function ensureBaseActivity(factionId) {
    const base = ensureFactionBaseMarker(factionId);
    if (!base) return null;
    if (!base.activeMission) {
      const m = generateFactionBaseMission(factionId);
      base.activeMission = { title: m.title, difficulty: m.difficulty, payout: m.payout, accepted: false, resolved: false };
    }
    if (!Array.isArray(base.activeEvents) || !base.activeEvents.length) {
      base.activeEvents = generateFactionBaseEvents(factionId).map((text) => ({ text, resolved: false }));
    }
    if (!Array.isArray(base.npcs) || !base.npcs.length) {
      base.npcs = generateBaseNPCs(factionId);
    }
    if (!Array.isArray(base.merchantStock) || !base.merchantStock.length) {
      base.merchantStock = buildMerchantStock(factionId);
    }
    if (!Array.isArray(base.generatedRooms) || !base.generatedRooms.length) {
      base.generatedRooms = generateBaseRooms(factionId);
    }
    if (base.activeMission && base.activeMission.linkedMissionId) {
      const linkedActive = S && Array.isArray(S.activeMissions)
        ? S.activeMissions.some((m) => String(m.id) === String(base.activeMission.linkedMissionId))
        : false;
      if (!linkedActive) {
        base.activeMission = null;
      }
    }
    return base;
  }

  function openFactionBaseHub(factionId) {
    const faction = FACTIONS[factionId];
    const base = ensureBaseActivity(factionId);
    if (!faction || !base) return;
    const guildView = getGuildPresentation(factionId);
    const guildName = getGuildName(factionId);
    const guildState = getGuildCampaignState(factionId);
    const guildCfg = getGuildCampaignConfig(factionId);
    const activeGuildMission = getGuildCampaignMissionById(guildState, guildState.activeCampaignMissionId);
    const activeGuildContract = getGuildContractMissionById(guildState, guildState.activeContractMissionId);
    const nextGuildQuest = getGuildCampaignQuestByStage(factionId, guildState.currentArcStage);
    const availablePrep = listGuildPrepOptionsForState(factionId, guildState);
    const guildContractBoard = ensureGuildContractBoard(factionId, false);

    const anchor = resolveFactionBaseAnchor(base);
    const mission = base.activeMission;
    const renown = getFactionRenown(factionId);
    const contracts = (faction.factionMissions || []).map((m, idx) => {
      const requiredRenown = getFactionMissionUnlockRenown(idx);
      const unlocked = renown >= requiredRenown;
      const state = getContractState(factionId, m.id);
      const status = state && state.status ? state.status : 'available';
      const statusLabel = status === 'completed'
        ? 'Completed'
        : (status === 'active' ? 'Active in Missions tab' : (unlocked ? 'Ready' : ('Locked (Renown ' + requiredRenown + ')')));
      const statusColor = status === 'completed' ? 'var(--green2)' : (status === 'active' ? 'var(--gold2)' : (unlocked ? 'var(--teal)' : 'var(--red2)'));
      const actions = unlocked && status === 'available'
        ? "<div style='display:flex;gap:.22rem;flex-wrap:wrap;margin-top:.22rem;'><button class='btn btn-xs btn-teal' onclick=\"factionSystem.acceptFactionMission('" + factionId + "','" + m.id + "','heroic')\">Heroic</button><button class='btn btn-xs' onclick=\"factionSystem.acceptFactionMission('" + factionId + "','" + m.id + "','tyrant')\">Tyrant</button><button class='btn btn-xs btn-primary' onclick=\"factionSystem.acceptFactionMission('" + factionId + "','" + m.id + "','martyr')\">Martyr</button></div>"
        : '';
      return "<div style='padding:.28rem .34rem;border:1px solid var(--border2);margin-top:.24rem;background:var(--surface);'><div style='display:flex;justify-content:space-between;gap:.35rem;align-items:flex-start;'><div><strong>" + m.title + "</strong><div style='font-size:.74rem;color:var(--muted2);'>" + m.desc + "</div></div><div style='font-size:.72rem;color:" + statusColor + ";white-space:nowrap;'>" + statusLabel + "</div></div><div style='font-size:.72rem;color:var(--muted2);margin-top:.14rem;'>Difficulty: " + m.difficulty + " · Reward: " + m.reward + "⚜</div>" + actions + "</div>";
    }).join('');
    const linkedMissionText = mission && mission.linkedMissionId
      ? `<div style="color:var(--teal);font-size:.78rem;">Linked Mission Contract #${mission.linkedMissionId} is active in the Missions tab.</div>`
      : "";

    const guildCampaignSummary = guildCfg
      ? `<div style="border-left:3px solid var(--gold2);background:rgba(201,162,39,.05);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--gold2);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">🏹 Guild Campaign</div>
          <div style="font-size:.74rem;color:var(--muted2);margin-bottom:.18rem;">${guildCfg.questLabel} · Stage ${Math.min(Number(guildState.currentArcStage || 0) + 1, guildCfg.quests.length)} / ${guildCfg.quests.length}</div>
          <div style="font-size:.74rem;color:var(--muted2);margin-bottom:.22rem;">${guildCfg.contractFlavor}</div>
          ${guildState.joined
            ? `<div style="font-size:.76rem;color:var(--text2);margin-bottom:.22rem;">${activeGuildMission
                ? ('Active in Missions tab: <strong style="color:var(--teal);">#' + activeGuildMission.id + '</strong>')
                : (nextGuildQuest ? ('Next campaign quest: <strong style="color:var(--gold2);">' + nextGuildQuest.title + '</strong>') : '<span style="color:var(--green2);">Campaign completed</span>')}</div>
               <div style="display:flex;gap:.25rem;flex-wrap:wrap;">
                 ${activeGuildMission ? `<button class="btn btn-xs" disabled>Campaign Active</button>` : (nextGuildQuest ? `<button class="btn btn-xs btn-primary" onclick="factionSystem.startGuildCampaign('${factionId}')">Post Campaign Quest</button>` : `<button class="btn btn-xs" disabled>Campaign Complete</button>`)}
               </div>`
            : `<div style="display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="factionSystem.joinGuild('${factionId}')">Join ${guildName}</button></div>`}
        </div>`
      : `<div style="border-left:3px solid var(--border2);background:rgba(255,255,255,.03);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--muted2);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">🏹 Guild Campaign</div>
          <div style="font-size:.74rem;color:var(--muted2);">Campaign content for this guild is not configured yet.</div>
        </div>`;

    const guildPrepBlock = guildCfg
      ? `<div style="border-left:3px solid var(--teal);background:rgba(46,196,182,.06);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--teal);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">🧪 Preparation Board</div>
          <div style="font-size:.74rem;color:var(--muted2);margin-bottom:.2rem;">Active prep slots: ${Number((guildState.activePrepIds || []).length)} / 3</div>
          ${availablePrep.length
            ? availablePrep.map((prep) => {
                const active = (guildState.activePrepIds || []).indexOf(String(prep.id || '')) >= 0;
                return `<div style='padding:.24rem .32rem;border:1px solid var(--border2);margin-top:.22rem;background:${active ? 'rgba(46,196,182,.09)' : 'var(--surface)'};'>
                  <div style='display:flex;justify-content:space-between;gap:.3rem;align-items:flex-start;'>
                    <div><strong>${prep.name}</strong><div style='font-size:.72rem;color:var(--muted2);'>${prep.summary}</div></div>
                    <button class='btn btn-xs ${active ? '' : 'btn-primary'}' onclick="factionSystem.toggleGuildPrep('${factionId}','${prep.id}')">${active ? 'Unset' : 'Set Prep'}</button>
                  </div>
                </div>`;
              }).join('')
            : `<div style="font-size:.74rem;color:var(--muted2);">No prep unlocked yet. Advance the guild campaign to unlock counters and tactical edges.</div>`}
        </div>`
      : "";

    const guildContractSummary = `<div style="border-left:3px solid var(--purple);background:rgba(176,96,208,.06);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--purple);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">🧾 Guild Contract Board</div>
          <div style="font-size:.74rem;color:var(--muted2);margin-bottom:.18rem;">Repeatable contracts separate from campaign progression.</div>
          ${activeGuildContract ? `<div style="font-size:.76rem;color:var(--gold2);margin-bottom:.2rem;">Active contract in Missions tab: #${activeGuildContract.id}</div>` : ""}
          ${(guildContractBoard || []).map((row) => {
            const isActive = activeGuildContract && String(activeGuildContract.guildContract && activeGuildContract.guildContract.contractId || "") === String(row.id || "");
            return `<div style='padding:.24rem .32rem;border:1px solid var(--border2);margin-top:.22rem;background:var(--surface);'>
              <div style='display:flex;justify-content:space-between;gap:.3rem;align-items:flex-start;'>
                <div><strong>${row.title}</strong><div style='font-size:.72rem;color:var(--muted2);'>${row.difficulty} · ${row.region} · ${row.lore}</div></div>
                <button class='btn btn-xs btn-primary' ${activeGuildContract ? "disabled" : ""} onclick="factionSystem.postGuildContract('${factionId}','${row.id}')">${isActive ? "Active" : "Post"}</button>
              </div>
            </div>`;
          }).join("")}
          <div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.28rem;">
            <button class="btn btn-xs" onclick="factionSystem.refreshGuildContracts('${factionId}')">Refresh Board</button>
          </div>
        </div>`;

    const html = `
      <div style="font-size:.83rem;color:var(--text2);line-height:1.6;">

        <!-- HEADER BANNER -->
        <div style="background:linear-gradient(135deg,rgba(0,0,0,.5),rgba(30,20,8,.9));border:1px solid rgba(201,162,39,.45);border-radius:4px;padding:.55rem .65rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.5rem;">
          <div style="font-size:1.6rem;line-height:1;">${faction.emoji}</div>
          <div>
            <div style="font-family:'Cinzel',serif;color:var(--gold2);font-size:.96rem;letter-spacing:.1em;">${base.baseName}</div>
            <div style="font-size:.74rem;color:var(--muted2);">${guildName} · ${base.regionType} · ${anchor}</div>
          </div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:.7rem;color:var(--teal);">Rumor Clock</div>
            <div style="font-size:.82rem;font-weight:700;color:var(--gold2);">${base.rumorClock}</div>
          </div>
        </div>
        <div style="font-size:.76rem;color:var(--muted2);margin-bottom:.45rem;font-style:italic;">${base.ambientDetail}</div>

        <!-- GUILD MISSION -->
        <div style="border-left:3px solid var(--teal);background:rgba(46,196,182,.06);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--teal);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.25rem;">⚔ ${guildView.contractLabel}</div>
          <div style="font-weight:700;color:var(--text2);">${mission.title}</div>
          <div style="font-size:.74rem;color:var(--muted2);">Difficulty: ${mission.difficulty} · Payout: ${mission.payout}</div>
          ${linkedMissionText}
          <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem;">
            ${mission.accepted ? `<button class="btn btn-xs" disabled>Accepted</button>` : `<button class="btn btn-xs btn-teal" onclick="factionSystem.acceptMission('${factionId}')">Accept Mission</button>`}
            ${mission.accepted && !mission.resolved && !mission.linkedMissionId ? `<button class="btn btn-xs btn-primary" onclick="factionSystem.resolveMission('${factionId}')">Resolve Mission</button>` : ""}
            ${mission.resolved ? `<span style="color:var(--green2);font-size:.78rem;">✓ Resolved</span>` : ""}
          </div>
        </div>

        ${guildCampaignSummary}

        ${guildContractSummary}

        <!-- PATH CONTRACTS -->
        <div style="border-left:3px solid var(--gold2);background:rgba(201,162,39,.05);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--gold2);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">📋 Story Path Contracts</div>
          <div style="font-size:.74rem;color:var(--muted2);margin-bottom:.22rem;">Heroic, Tyrant, and Martyr paths available here. Your choices shape faction alignment.</div>
          ${contracts}
        </div>

        ${guildPrepBlock}

        <!-- PEOPLE TO TALK TO -->
        <div style="border-left:3px solid var(--purple);background:rgba(176,96,208,.05);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:var(--purple);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">👤 Base Contacts</div>
          <div style="font-size:.74rem;color:var(--muted2);margin-bottom:.22rem;">Lead vs Dread d6 to Talk. Success reveals a faction secret.</div>
          ${base.npcs.map((npc, idx) => `
            <div style="background:rgba(255,255,255,.03);border:1px solid var(--border2);border-radius:3px;padding:.32rem .4rem;margin-top:.25rem;">
              <div style="font-weight:700;color:var(--text2);">${npc.name} <span style="font-size:.72rem;color:var(--muted2);">(${npc.mood})</span></div>
              <div style="font-size:.76rem;color:var(--muted2);margin:.1rem 0 .2rem;">${npc.rumor}</div>
              <div style="display:flex;gap:.25rem;flex-wrap:wrap;">
                <button class="btn btn-xs btn-teal" onclick="factionSystem.talkNpc('${factionId}',${idx})">Talk (Lead vs d6)</button>
                <button class="btn btn-xs btn-primary" onclick="factionSystem.generateNpcTask('${factionId}',${idx})">Generate Task Marker</button>
              </div>
            </div>`).join("")}
          ${Array.isArray(base.discoveredSecrets) && base.discoveredSecrets.length ? `<div style='margin-top:.4rem;border-top:1px solid var(--border2);padding-top:.3rem;'><div style='font-family:Cinzel,serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;margin-bottom:.18rem;'>Discovered Secrets</div>${base.discoveredSecrets.slice(0,3).map((s)=>`<div style='font-size:.78rem;color:var(--muted2);margin-top:.14rem;'>• ${s}</div>`).join('')}</div>` : ''}
        </div>

        <!-- BASE INTERIOR ROOMS -->
        <div style="border-left:3px solid rgba(126,215,255,.6);background:rgba(126,215,255,.04);border-radius:0 3px 3px 0;padding:.48rem .55rem;margin-bottom:.45rem;">
          <div style="font-family:'Cinzel',serif;color:#7ed7ff;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.18rem;">🏛 Base Interior</div>
          ${base.generatedRooms.length
            ? base.generatedRooms.map((room, idx) => `<div style="font-size:.78rem;color:var(--text2);padding:.18rem 0;border-bottom:1px solid var(--border2);">${idx + 1}. ${room}</div>`).join("")
            : `<div style="font-size:.76rem;color:var(--muted2);">No rooms generated yet.</div>`}
        </div>

        <!-- ACTIONS -->
        <div style="display:flex;gap:.3rem;flex-wrap:wrap;padding-top:.2rem;">
          <button class="btn btn-xs btn-primary" onclick="factionSystem.openMerchant('${factionId}')">🛒 ${guildView.shopLabel}</button>
          <button class="btn btn-xs" onclick="factionSystem.generateRooms('${factionId}')">🗘 Generate Rooms</button>
        </div>

      </div>
    `;

    openFactionModal("Guild Base: " + guildName, html);
  }

  function recordFactionConsequence(entry) {
    if (typeof window === 'undefined' || typeof window.recordWorldConsequence !== 'function') return;
    try { window.recordWorldConsequence(entry || {}); } catch (_err) { console.error(_err); }
  }

  function factionLocationKeyFromBase(base, mission) {
    if (mission && mission.siteHex && typeof mission.siteHex.col === 'number' && typeof mission.siteHex.row === 'number') {
      return mission.siteHex.col + ',' + mission.siteHex.row;
    }
    if (mission && mission.mapHex && typeof mission.mapHex.col === 'number' && typeof mission.mapHex.row === 'number') {
      return mission.mapHex.col + ',' + mission.mapHex.row;
    }
    if (base && base.marker && base.marker.system === 'province' && base.marker.key) {
      return String(base.marker.key);
    }
    return '';
  }

  function resolveFactionMission(factionId) {
    const base = ensureBaseActivity(factionId);
    if (!base || !base.activeMission || !base.activeMission.accepted || base.activeMission.resolved) return;
    if (base.activeMission.linkedMissionId) {
      const active = S && Array.isArray(S.activeMissions)
        ? S.activeMissions.find((m) => String(m.id) === String(base.activeMission.linkedMissionId))
        : null;
      if (active) {
        if (typeof showNotif === "function") showNotif("Resolve this guild mission through the Missions tab contract.", "warn");
        return;
      }
    }
    const stat = FACTION_ACTION_DIE_MAP[factionId] || "mind";
    const dd = missionDreadByDifficulty(base.activeMission.difficulty);
    const check = rollBaseCheck(stat, dd);
    if (check.success) {
      base.activeMission.resolved = true;
      safeFactionRenownDelta(factionId, 1);
      const pay = Number(String(base.activeMission.payout).replace(/[^0-9]/g, "") || 120);
      if (typeof changeCredits === "function") changeCredits(pay);
      else if (S) S.credits = Math.max(0, Number(S.credits || 0) + pay);
      if (typeof showNotif === "function") showNotif("Mission success: +1 faction Renown, +" + pay + " credits.", "good");
      recordFactionConsequence({
        system: 'faction',
        title: 'Faction base mission succeeded',
        detail: String((base.activeMission && base.activeMission.title) || factionId || 'Faction mission'),
        region: String((base && base.regionType) || 'province').toLowerCase(),
        locationKey: factionLocationKeyFromBase(base, base && base.activeMission),
        severity: 'medium',
        deltas: { stability: 1, witness: 1, factionHeat: -1 },
        tags: ['faction-mission', 'threat-cleared', 'discovered-route', 'npc-relationship']
      });
      base.activeMission = null;
    } else {
      const failedBy = Math.max(1, Number(check.dread || 0) - Number(check.action || 0));
      if (typeof changeMentalStress === "function") changeMentalStress(failedBy);
      else if (typeof changeStress === "function") changeStress(failedBy);
      if (typeof addTMWOnFail === "function") addTMWOnFail("faction-mission-failure", { failedBy, actionDie: check.die, dreadDie: dd });
      if (typeof showNotif === "function") showNotif("Mission failed: " + stat.toUpperCase() + " d" + check.die + "=" + check.action + " vs DD" + dd + "=" + check.dread + ". +" + failedBy + " Mental Stress.", "warn");
      recordFactionConsequence({
        system: 'faction',
        title: 'Faction base mission failed',
        detail: String((base.activeMission && base.activeMission.title) || factionId || 'Faction mission'),
        region: String((base && base.regionType) || 'province').toLowerCase(),
        locationKey: factionLocationKeyFromBase(base, base && base.activeMission),
        severity: 'high',
        deltas: { stability: -1, rumor: 1, factionHeat: 1 },
        tags: ['faction-mission', 'failed-expedition', 'active-crisis', 'dangerous-road']
      });
    }
    openFactionBaseHub(factionId);
  }

  function acceptFactionMission(factionId) {
    const base = ensureBaseActivity(factionId);
    if (!base || !base.activeMission || base.activeMission.accepted) return;
    base.activeMission.accepted = true;
    const missionRegion = getMissionRegionFromBase(base);
    const rival = getRivalFaction(factionId);
    if (typeof createMission === "function") {
      const created = createMission(
        "Faction Base",
        base.activeMission.title,
        base.activeMission.difficulty || "medium",
        resolveFactionBaseAnchor(base),
        missionRegion,
        {
          gain: factionId,
          lose: rival,
          gainName: (FACTIONS[factionId] && FACTIONS[factionId].name) || toTitle(factionId),
          loseName: (FACTIONS[rival] && FACTIONS[rival].name) || toTitle(rival),
        },
        (base.marker && base.marker.system === "planet")
          ? { planetHexId: base.marker.planetHexId, planetName: "Faction Planet Contract" }
          : null
      );
      if (created && created.id) base.activeMission.linkedMissionId = created.id;
    }
    if (typeof showNotif === "function") showNotif("Guild mission accepted.", "good");
    openFactionBaseHub(factionId);
  }

  function resolveFactionEvent(factionId, idx) {
    const base = ensureBaseActivity(factionId);
    const ev = base && Array.isArray(base.activeEvents) ? base.activeEvents[Number(idx)] : null;
    if (!ev || ev.resolved) return;
    const check = rollBaseCheck("valor", 6);
    ev.resolved = true;
    if (check.success) {
      if (typeof changeCounter === "function") changeCounter("tmw", 1);
      if (typeof showNotif === "function") showNotif("Event interaction succeeded: +1 Teamwork.", "good");
      recordFactionConsequence({
        system: 'faction',
        title: 'Faction event stabilized',
        detail: String(ev.text || 'Base event'),
        region: String((base && base.regionType) || 'province').toLowerCase(),
        locationKey: factionLocationKeyFromBase(base, null),
        severity: 'info',
        deltas: { stability: 1, rumor: -1, witness: 1 },
        tags: ['faction-event', 'infrastructure', 'npc-relationship']
      });
    } else {
      const failedBy = Math.max(1, Number(check.dread || 0) - Number(check.action || 0));
      if (typeof changeStress === "function") changeStress(failedBy);
      if (typeof addTMWOnFail === "function") addTMWOnFail("faction-event-failure", { failedBy, actionDie: check.die, dreadDie: 6 });
      if (typeof showNotif === "function") showNotif("Event interaction failed: +" + failedBy + " Stress.", "warn");
      recordFactionConsequence({
        system: 'faction',
        title: 'Faction event escalated',
        detail: String(ev.text || 'Base event'),
        region: String((base && base.regionType) || 'province').toLowerCase(),
        locationKey: factionLocationKeyFromBase(base, null),
        severity: 'high',
        deltas: { stability: -1, rumor: 1, factionHeat: 1 },
        tags: ['faction-event', 'active-crisis', 'dangerous-road']
      });
    }
    openFactionBaseHub(factionId);
  }

  function talkFactionNpc(factionId, idx) {
    resolveNpcConversation(factionId, idx);
  }

  function openFactionMerchant(factionId) {
    const base = ensureBaseActivity(factionId);
    if (!base) return;
    const guildView = getGuildPresentation(factionId);
    const guildCfg = getGuildCampaignConfig(factionId);
    const guildTag = guildCfg ? ("<div style='font-size:.74rem;color:var(--muted2);margin-bottom:.35rem;'>" + guildCfg.shopFlavor + "</div>") : "";
    const html = `<div style='font-size:.83rem;color:var(--text2);line-height:1.6;'>${(base.merchantStock || []).map((offer, idx) => {
      const name = offer && offer.name ? offer.name : "Trade Item";
      const cost = Number(offer && offer.cost ? offer.cost : 120);
      const cat = offer && offer.cat ? offer.cat : "items";
      const desc = offer && offer.desc ? offer.desc : "Guild quartermaster stock.";
      return `<div style='padding:.25rem .35rem;border:1px solid var(--border2);margin-bottom:.24rem;'><strong style='color:var(--gold2);'>${name}</strong> (${cat})<br>${desc}<br><button class='btn btn-xs btn-teal' onclick="factionSystem.buyMerchantItem('${factionId}',${idx})">Buy ${cost}₵</button></div>`;
    }).join("")}</div>`;
    openFactionModal(guildView.shopLabel, "<div style='font-size:.83rem;color:var(--text2);line-height:1.6;'>" + guildTag + html + "</div>");
  }

  function buyFactionMerchantItem(factionId, idx) {
    const base = ensureBaseActivity(factionId);
    const offer = base && Array.isArray(base.merchantStock) ? base.merchantStock[Number(idx)] : null;
    if (!offer) return;
    const name = offer.name || "Trade Item";
    const cost = Number(offer.cost || 120);
    const cat = offer.cat || "items";
    if (typeof buyItem === "function") buyItem(cost, name, cat);
    else if (S && Number(S.credits || 0) >= cost) S.credits -= cost;
    if (typeof showNotif === "function") showNotif("Purchased " + name + " from faction merchant.", "good");
    openFactionMerchant(factionId);
  }

  function regenerateFactionBaseRooms(factionId) {
    const base = ensureBaseActivity(factionId);
    if (!base) return;
    base.generatedRooms = generateBaseRooms(factionId);
    openFactionBaseHub(factionId);
  }

  function rerollFactionBaseEvents(factionId) {
    const base = ensureBaseActivity(factionId);
    if (!base) return;
    base.activeEvents = generateFactionBaseEvents(factionId).map((text) => ({ text, resolved: false }));
    base.rumorClock = Number(base.rumorClock || 0) + 1;
    openFactionBaseHub(factionId);
  }

  function openFactionBaseFromMarker(region, key, secondary) {
    const found = findBaseByMarker(region, key, secondary);
    if (!found) {
      if (typeof showNotif === "function") showNotif("No guild base marker in this location.", "warn");
      return;
    }
    openFactionBaseHub(found.factionId);
  }

  function openFactionModal(title, html) {
    if (typeof openModal === "function") {
      openModal(title, html);
      return;
    }
    alert(title + "\n\n" + String(html || "").replace(/<[^>]+>/g, " "));
  }

  function getFactionMissionUnlockRenown(index) {
    if (index <= 0) return 0;
    if (index === 1) return 3;
    return 6;
  }

  function contractStateKey(factionId, missionId) {
    return String(factionId) + ":" + String(missionId);
  }

  function getContractState(factionId, missionId) {
    ensureFactionState();
    const key = contractStateKey(factionId, missionId);
    return (S.factionNarrative && S.factionNarrative.contracts && S.factionNarrative.contracts[key]) || null;
  }

  function setContractState(factionId, missionId, nextState) {
    ensureFactionState();
    const key = contractStateKey(factionId, missionId);
    S.factionNarrative.contracts[key] = Object.assign({}, nextState || {});
    return S.factionNarrative.contracts[key];
  }

  function computeFactionEndingFromPoints() {
    ensureFactionState();
    const points = S.factionNarrative.pathPoints || { heroic: 0, tyrant: 0, martyr: 0 };
    const heroic = Number(points.heroic || 0);
    const tyrant = Number(points.tyrant || 0);
    const martyr = Number(points.martyr || 0);
    const total = heroic + tyrant + martyr;
    if (total <= 0) {
      return { key: "", title: "Unwritten Fate", vibe: "No contract pathway dominates yet." };
    }

    if (heroic >= 3 && heroic >= tyrant && heroic >= martyr) {
      return {
        key: "heroic",
        title: STORY_PATHWAYS.heroic.ending.title,
        vibe: STORY_PATHWAYS.heroic.ending.vibe,
      };
    }
    if (tyrant >= 3 && tyrant >= heroic && tyrant >= martyr) {
      return {
        key: "tyrant",
        title: STORY_PATHWAYS.tyrant.ending.title,
        vibe: STORY_PATHWAYS.tyrant.ending.vibe,
      };
    }
    if (martyr >= 3 && martyr >= heroic && martyr >= tyrant) {
      return {
        key: "martyr",
        title: STORY_PATHWAYS.martyr.ending.title,
        vibe: STORY_PATHWAYS.martyr.ending.vibe,
      };
    }

    return {
      key: "contested",
      title: STORY_PATHWAYS.fortune.ending.title,
      vibe: "Your pathway is contested; one more defining contract can tip the ending.",
    };
  }

  function evaluateFinaleUnlock(points) {
    const p = points || { heroic: 0, tyrant: 0, martyr: 0 };
    const ordered = [
      { key: "heroic", value: Number(p.heroic || 0) },
      { key: "tyrant", value: Number(p.tyrant || 0) },
      { key: "martyr", value: Number(p.martyr || 0) }
    ].sort((a, b) => b.value - a.value);

    const top = ordered[0];
    if (!top || top.value < FINAL_ENDING_THRESHOLD) {
      return { unlocked: false, key: "", score: top ? top.value : 0 };
    }

    const ties = ordered.filter((row) => row.value === top.value);
    if (ties.length > 1) {
      return { unlocked: true, key: "fortune", score: top.value };
    }
    return { unlocked: true, key: top.key, score: top.value };
  }

  function syncFinaleProgress() {
    ensureFactionState();
    const points = S.factionNarrative.pathPoints || { heroic: 0, tyrant: 0, martyr: 0 };
    const evalResult = evaluateFinaleUnlock(points);
    const finale = S.factionNarrative.finale;
    const wasUnlocked = !!finale.unlocked;
    const oldKey = finale.key || "";
    finale.unlocked = !!evalResult.unlocked;
    finale.key = evalResult.key || "";
    if (finale.unlocked && !wasUnlocked) {
      finale.unlockedAt = Date.now();
      finale.revealed = false;
    }
    if (finale.unlocked && oldKey && oldKey !== finale.key) {
      finale.revealed = false;
    }
    if (!finale.unlocked) {
      finale.revealed = false;
    }
    return finale;
  }

  function progressPct(points) {
    return Math.max(0, Math.min(100, Math.floor((Number(points || 0) / FINAL_ENDING_THRESHOLD) * 100)));
  }

  function revealFinalEnding() {
    ensureFactionState();
    const finale = syncFinaleProgress();
    if (!finale.unlocked || !finale.key) {
      if (typeof showNotif === "function") showNotif("Ending still locked. Complete more pathway contracts.", "warn");
      renderEndingsPanel();
      return;
    }
    finale.revealed = true;
    renderEndingsPanel();
  }

  function renderEndingsPanel() {
    ensureFactionState();
    const host = document.getElementById("endingsPanel") || document.getElementById("tab-" + ENDINGS_TAB_ID);
    if (!host) return;

    const points = S.factionNarrative.pathPoints || { heroic: 0, tyrant: 0, martyr: 0 };
    const finale = syncFinaleProgress();
    const key = finale.key || "";
    const pathway = key && STORY_PATHWAYS[key] ? STORY_PATHWAYS[key] : null;
    const cinematic = key && ENDING_CINEMATICS[key] ? ENDING_CINEMATICS[key] : null;
    const trajectory = computeFactionEndingFromPoints();

    const lockText = finale.unlocked
      ? "Final outcome unlocked. Reveal the scene when ready."
      : "Locked: reach " + FINAL_ENDING_THRESHOLD + " points in Heroic, Tyrant, or Martyr pathway.";

    host.innerHTML = ""
      + "<div class='faction-container'>"
      + "<div class='faction-intro'><h2>ENDING TRAJECTORY</h2><p>Your pathway points decide your final cinematic outcome.</p></div>"
      + "<div class='card' style='margin-bottom:.6rem;'>"
      + "<div style='font-family:Cinzel,serif;font-size:.72rem;color:var(--gold2);margin-bottom:.35rem;'>Current Trajectory</div>"
      + "<div style='font-size:.85rem;color:var(--text2);line-height:1.55;'><strong>" + (trajectory.title || "Unwritten Fate") + "</strong><br>" + (trajectory.vibe || "Keep making faction-defining choices.") + "</div>"
      + "</div>"
      + "<div class='card' style='margin-bottom:.6rem;'>"
      + "<div style='font-family:Cinzel,serif;font-size:.72rem;color:var(--teal);margin-bottom:.4rem;'>Pathway Progress (Threshold " + FINAL_ENDING_THRESHOLD + ")</div>"
      + [
        { label: "Heroic", key: "heroic", color: "var(--teal)" },
        { label: "Tyrant", key: "tyrant", color: "var(--red2)" },
        { label: "Martyr", key: "martyr", color: "var(--gold2)" }
      ].map(function (row) {
        const value = Number(points[row.key] || 0);
        const pct = progressPct(value);
        return "<div style='margin-bottom:.35rem;'>"
          + "<div style='display:flex;justify-content:space-between;font-size:.76rem;color:var(--muted2);'><span>" + row.label + "</span><span>" + value + " / " + FINAL_ENDING_THRESHOLD + "</span></div>"
          + "<div style='height:8px;border:1px solid var(--border2);background:var(--surface);margin-top:.14rem;'><div style='height:100%;width:" + pct + "%;background:" + row.color + ";'></div></div>"
          + "</div>";
      }).join("")
      + "<div style='font-size:.78rem;color:" + (finale.unlocked ? "var(--green2)" : "var(--muted2)") + ";margin-top:.25rem;'>" + lockText + "</div>"
      + "</div>"
      + "<div class='card'>"
      + "<div style='font-family:Cinzel,serif;font-size:.72rem;color:var(--gold2);margin-bottom:.35rem;'>Final Outcome Scene</div>"
      + (finale.unlocked
        ? (finale.revealed
            ? ("<div style='font-size:.9rem;color:var(--text2);line-height:1.65;'>"
                + "<div style='font-family:Cinzel,serif;font-size:.9rem;color:var(--gold2);margin-bottom:.2rem;'>" + ((pathway && pathway.ending && pathway.ending.title) || "Final Outcome") + "</div>"
                + "<div style='color:var(--muted2);font-style:italic;margin-bottom:.35rem;'>" + ((cinematic && cinematic.opener) || "") + "</div>"
                + "<div style='margin-bottom:.35rem;'>" + ((pathway && pathway.ending && pathway.ending.text) || "") + "</div>"
                + "<div style='margin-bottom:.35rem;'>" + ((cinematic && cinematic.scene) || "") + "</div>"
                + "<div style='color:var(--muted2);'>" + ((cinematic && cinematic.epilogue) || "") + "</div>"
              + "</div>")
            : ("<div style='font-size:.84rem;color:var(--muted2);margin-bottom:.4rem;'>Your finale is ready to reveal.</div>"
              + "<button class='btn btn-primary' onclick='factionSystem.revealFinalEnding()'>Reveal Final Outcome</button>"))
        : "<div style='font-size:.84rem;color:var(--muted2);'>No final scene yet. Complete pathway contracts to unlock it.</div>")
      + "</div>"
      + "</div>";
  }

  function openEndingsTab() {
    const btn = document.querySelector(".tab-btn[onclick*=\"switchTab('" + FACTION_TAB_ID + "'\"]");
    if (typeof switchTab === "function") switchTab(FACTION_TAB_ID, btn || null);
    renderEndingsPanel();
  }

  function chooseFactionContractRegion() {
    const regions = ["province"];
    if (S && S.lastSea && Array.isArray(S.lastSea.map) && S.lastSea.map.length) regions.push("sea");
    if (S && S.starSystem && Array.isArray(S.starSystem.hexes) && S.starSystem.hexes.length) regions.push("galaxy");
    return regions[Math.floor(Math.random() * regions.length)];
  }

  function randomOf(list) {
    if (!Array.isArray(list) || !list.length) return "";
    return list[Math.floor(Math.random() * list.length)] || "";
  }

  function buildFactionContractTemplate(factionId, mission, pathway, region) {
    const faction = FACTIONS[factionId] || { name: "Faction" };
    const pathLabel = pathway === "heroic" ? "Heroic" : pathway === "tyrant" ? "Tyrant" : "Martyr";
    const missionCore = mission && mission.title ? mission.title : "Faction Operation";
    const hooks = {
      delivery_chain: {
        title: pathLabel + " Delivery Chain - " + missionCore,
        stepNames: {
          1: "Secure Cargo Intel",
          2: "Run the Checkpoint Chain",
          3: "Deliver Under Pressure"
        },
        checkpoints: [
          "Meet a fixer contact in " + (region === "galaxy" ? "an orbital bazaar" : region === "sea" ? "a storm harbor" : "a frontier market"),
          "Cross two hostile checkpoints without losing the payload",
          "Deliver to the final handoff and decide who truly receives the goods"
        ],
        intro: "This delivery contract unfolds in chained handoffs. Every checkpoint can escalate into diplomacy, force, or betrayal."
      },
      social_contact: {
        title: pathLabel + " Social Contact Web - " + missionCore,
        stepNames: {
          1: "Read the Room",
          2: "Leverage the Network",
          3: "Close the Political Deal"
        },
        checkpoints: [
          "Find the right informant through coded social rituals",
          "Trade favors with rival contacts for access",
          "Choose who you elevate and who gets politically erased"
        ],
        intro: "This mission is contact-heavy and volatile. Your words can shift entire alliances before the final confrontation."
      },
      sabotage_branch: {
        title: pathLabel + " Sabotage Branch - " + missionCore,
        stepNames: {
          1: "Scout Vulnerabilities",
          2: "Plant the Breach",
          3: "Trigger and Escape"
        },
        checkpoints: [
          "Identify the weakest link in the target system",
          "Decide between silent sabotage or public spectacle",
          "Escape the retaliation wave after detonation"
        ],
        intro: "Sabotage contracts branch hard: clean strike, messy chaos, or martyr play. The world remembers which path you chose."
      },
      pursuit_arc: {
        title: pathLabel + " Pursuit Arc - " + missionCore,
        stepNames: {
          1: "Track the Quarry",
          2: "Corner Across Regions",
          3: "Final Intercept"
        },
        checkpoints: [
          "Extract a route signature from witnesses",
          "Pursue the target through shifting terrain",
          "Choose capture, execution, or self-sacrifice at intercept"
        ],
        intro: "This pursuit contract is a chase narrative. Momentum matters more than brute force, and your final choice defines reputation."
      },
      multi_map_checkpoint: {
        title: pathLabel + " Multi-Map Relay - " + missionCore,
        stepNames: {
          1: "Decode Cross-Map Intel",
          2: "Traverse Relay Checkpoints",
          3: "Resolve the Nexus Crisis"
        },
        checkpoints: [
          "Unpack a clue that points to at least two map systems",
          "Travel between relay points while under enemy pressure",
          "Resolve the nexus event that links faction futures"
        ],
        intro: "This is a true campaign-style relay contract: clues, transit pressure, and a nexus finale."
      }
    };

    const templateIds = Object.keys(hooks);
    const templateId = randomOf(templateIds);
    const selected = hooks[templateId];
    const locationBase = mission && mission.desc ? mission.desc : "High-priority faction operation";
    const location = region === "sea"
      ? ("Last Sea chain: " + locationBase)
      : region === "galaxy"
        ? ("Outer-system chain: " + locationBase)
        : ("Province chain: " + locationBase);

    return {
      templateId: templateId,
      title: selected.title,
      location: location,
      stepNames: selected.stepNames,
      checkpoints: selected.checkpoints,
      intro: selected.intro,
      factionName: faction.name
    };
  }

  function acceptFactionMissionFromTab(factionId, missionId, pathway) {
    ensureFactionState();
    const faction = FACTIONS[factionId];
    if (!faction) return;
    const mission = (faction.factionMissions || []).find((m) => String(m.id) === String(missionId));
    if (!mission) return;
    const state = getContractState(factionId, missionId);
    if (state && state.status === "active") {
      if (typeof showNotif === "function") showNotif("This contract is already active in your Missions tab.", "warn");
      return;
    }
    if (state && state.status === "completed") {
      if (typeof showNotif === "function") showNotif("This guild contract is already completed and has advanced the narrative.", "warn");
      return;
    }
    const idx = (faction.factionMissions || []).findIndex((m) => String(m.id) === String(missionId));
    const renown = getFactionRenown(factionId);
    if (renown < getFactionMissionUnlockRenown(idx)) {
      if (typeof showNotif === "function") showNotif("This mission is still locked by Renown.", "warn");
      return;
    }
    const route = chooseFactionContractRegion();
    const pathLabel = (pathway === "heroic" || pathway === "tyrant" || pathway === "martyr") ? pathway : "standard";
    const gm = buildFactionContractTemplate(factionId, mission, pathLabel, route);
    const contractTitle = "[" + toTitle(pathLabel) + "] " + gm.title;
    const contractLocation = gm.location;
    const rival = getRivalFaction(factionId);
    if (typeof createMission === "function") {
      const created = createMission(
        "Guild Command",
        contractTitle,
        mission.difficulty || "medium",
        contractLocation,
        route,
        {
          gain: factionId,
          lose: rival,
          gainName: faction.name,
          loseName: (FACTIONS[rival] && FACTIONS[rival].name) ? FACTIONS[rival].name : toTitle(rival),
        },
        {
          missionType: "faction_contract",
          contractPathway: pathLabel,
          templateId: gm.templateId,
          checkpoints: gm.checkpoints,
          stepNames: gm.stepNames,
          step1Intro: gm.intro,
          factionContract: {
            factionId: factionId,
            missionId: missionId,
            pathway: pathLabel,
            factionName: gm.factionName
          }
        }
      );
      if (created && created.id) {
        setContractState(factionId, missionId, {
          status: "active",
          pathway: pathLabel,
          activeMissionId: created.id,
          templateId: gm.templateId,
          acceptedAt: Date.now()
        });
        if (typeof showNotif === "function") {
          showNotif("Guild contract posted to Missions: " + contractTitle, "good");
        }
      }
      if (typeof renderMissionBoard === "function") renderMissionBoard();
      if (typeof renderMissionTracker === "function") renderMissionTracker();
      setupFactionTab();
    }
  }

  function expandFaction(factionId) {
    ensureFactionState();
    const faction = FACTIONS[factionId];
    if (!faction) return;

    const renown = getFactionRenown(factionId);
    const actionDie = FACTION_ACTION_DIE_MAP[factionId] || "mind";
    const loreRole = FACTION_LORE_ROLE_MAP[factionId] || "Specialists";
    const guildName = getGuildName(factionId);
    const guildView = getGuildPresentation(factionId);
    const guildState = getGuildCampaignState(factionId);
    const guildCfg = getGuildCampaignConfig(factionId);
    const nextQuest = getGuildCampaignQuestByStage(factionId, guildState.currentArcStage);
    let html = `
      <div class="faction-detail">
        <h3>${faction.emoji} ${guildName}</h3>
        <div style="font-size:.82rem;color:var(--text2);margin-bottom:.55rem;">
          Lore Focus: <strong style="color:var(--gold2);">${loreRole} = ${toTitle(actionDie)}</strong> · Storyline Bonus: <strong style="color:var(--teal);">+${Math.max(0, renown)}</strong>
        </div>
        <div style="border:1px solid var(--border2);padding:.45rem .5rem;margin-bottom:.55rem;background:var(--surface);font-size:.78rem;color:var(--text2);line-height:1.55;">
          <div style="font-family:'Cinzel',serif;color:var(--gold2);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.16rem;">Guild Campaign</div>
          ${guildCfg
            ? (guildState.joined
              ? (nextQuest
                ? ('Next mission: <strong style="color:var(--gold2);">' + nextQuest.title + '</strong><div style="margin-top:.2rem;"><button class="btn btn-xs btn-primary" onclick="factionSystem.startGuildCampaign(\'' + factionId + '\')">Post Campaign Quest</button></div>')
                : '<span style="color:var(--green2);">Campaign complete</span>')
              : ('Join to unlock the authored campaign arc.<div style="margin-top:.2rem;"><button class="btn btn-xs btn-primary" onclick="factionSystem.joinGuild(\'' + factionId + '\')">Join Guild Campaign</button></div>'))
            : 'Campaign content not configured for this guild yet.'}
        </div>
        <h4>${guildView.contractLabel}</h4>
    `;

    faction.factionMissions.forEach((mission, idx) => {
      const requiredRenown = getFactionMissionUnlockRenown(idx);
      const unlocked = renown >= requiredRenown;
      const state = getContractState(factionId, mission.id);
      const status = state && state.status ? state.status : "available";
      const statusText = status === "completed"
        ? "Completed — narrative advanced"
        : status === "active"
          ? "Active contract in Missions tab"
          : "Ready to accept";
      const statusColor = status === "completed" ? "var(--green2)" : status === "active" ? "var(--gold2)" : "var(--teal)";
      html += `
        <div class="mission-detail" style="border:1px solid ${unlocked ? 'var(--border2)' : 'rgba(224,80,80,.45)'};padding:.55rem;margin-bottom:.45rem;opacity:${unlocked ? '1' : '.82'};">
          <h5>${mission.title}</h5>
          <p>${mission.desc}</p>
          <div class="mission-stats">Difficulty: ${mission.difficulty} — Reward: ${mission.reward}⚜</div>
          <div class="mission-stats" style="color:${unlocked ? 'var(--teal)' : 'var(--red2)'};">${unlocked ? 'Unlocked' : ('Locked — Requires Renown ' + requiredRenown)}</div>
          ${unlocked ? `<div class="mission-stats" style="color:${statusColor};">${statusText}</div>` : ""}
          <div class="mission-pathways">
            <strong>Your decisions:</strong>
            <ul>
              <li><strong>Heroic:</strong> ${mission.pathways.heroic}</li>
              <li><strong>Tyrant:</strong> ${mission.pathways.tyrant}</li>
              <li><strong>Martyr:</strong> ${mission.pathways.martyr || mission.pathways.sacrificial || '—'}</li>
            </ul>
          </div>
          ${unlocked && status === 'available' ? `<div class="contract-choice-actions"><button class="btn btn-xs btn-teal" onclick="factionSystem.acceptFactionMission('${factionId}','${mission.id}','heroic')">Accept Heroic Contract</button><button class="btn btn-xs" onclick="factionSystem.acceptFactionMission('${factionId}','${mission.id}','tyrant')">Accept Tyrant Contract</button><button class="btn btn-xs btn-primary" onclick="factionSystem.acceptFactionMission('${factionId}','${mission.id}','martyr')">Accept Martyr Contract</button></div>` : ""}
        </div>
      `;
    });

    html += `<div style="margin-top:.6rem;"><button class="btn btn-sm btn-primary" onclick="factionSystem.visitBase('${factionId}')">Visit ${guildName} Base</button></div></div>`;
    openFactionModal(guildName, html);
  }

  function onMissionResolved(mission, success) {
    ensureFactionState();
    if (mission && mission.guildCampaign && mission.missionType && (mission.missionType === "guild_campaign" || mission.missionType === "guild_boss_hunt")) {
      resolveGuildCampaignProgress(mission, !!success);
    }
    if (mission && mission.missionType === "guild_contract" && mission.guildContract && mission.guildContract.factionId) {
      const gid = String(mission.guildContract.factionId || "");
      if (gid) {
        const state = getGuildCampaignState(gid);
        if (String(state.activeContractMissionId || "") === String(mission.id || "")) {
          state.activeContractMissionId = null;
          state.contractRuns = Math.max(0, Number(state.contractRuns || 0)) + (success ? 1 : 0);
          state.lastOutcome = (success ? "contract-completed:" : "contract-failed:") + String(mission.guildContract.contractId || "");
          if (success) ensureGuildContractBoard(gid, true);
          if (typeof showNotif === "function") {
            showNotif(success ? (getGuildName(gid) + " contract completed.") : (getGuildName(gid) + " contract failed. Repost when ready."), success ? "good" : "warn");
          }
          setupFactionTab();
        }
      }
    }
    if (!mission || (mission.missionType !== "faction_contract" && mission.missionType !== "guild_contract") || !mission.factionContract) return;
    const info = mission.factionContract;
    const factionId = info.factionId;
    const missionId = info.missionId;
    if (!factionId || !missionId) return;

    const current = getContractState(factionId, missionId) || {};
    const pathway = String(info.pathway || current.pathway || "heroic");

    if (!success) {
      setContractState(factionId, missionId, {
        status: "available",
        pathway: pathway,
        activeMissionId: null,
        templateId: current.templateId || mission.templateId || "",
        failedAt: Date.now()
      });
      if (typeof showNotif === "function") showNotif("Guild story contract failed. You can accept it again to recover the arc.", "warn");
      recordFactionConsequence({
        system: 'faction',
        title: 'Faction contract failed',
        detail: String(mission.title || missionId || 'Contract') + ' [' + String(pathway).toUpperCase() + ']',
        region: String(mission.region || 'province'),
        locationKey: factionLocationKeyFromBase(null, mission),
        severity: 'high',
        deltas: { stability: -1, rumor: 1, witness: -1, factionHeat: 1 },
        tags: ['faction-contract', 'failed-expedition', 'active-crisis', 'border-closed']
      });
      setupFactionTab();
      renderEndingsPanel();
      return;
    }

    const points = S.factionNarrative.pathPoints;
    if (pathway === "heroic" || pathway === "tyrant" || pathway === "martyr") {
      points[pathway] = Number(points[pathway] || 0) + 1;
    }

    setContractState(factionId, missionId, {
      status: "completed",
      pathway: pathway,
      activeMissionId: null,
      templateId: current.templateId || mission.templateId || "",
      completedAt: Date.now()
    });

    S.factionNarrative.completedContracts.push({
      factionId: factionId,
      missionId: missionId,
      pathway: pathway,
      title: mission.title || "Faction Contract",
      completedAt: Date.now()
    });
    if (S.factionNarrative.completedContracts.length > 40) {
      S.factionNarrative.completedContracts = S.factionNarrative.completedContracts.slice(-40);
    }

    const ending = computeFactionEndingFromPoints();
    const finaleBefore = Object.assign({}, S.factionNarrative.finale || {});
    const finaleAfter = syncFinaleProgress();
    S.factionNarrative.endingResult = ending;
    if (typeof showNotif === "function") {
      showNotif(
        "Guild narrative advanced: " + toTitle(pathway) + " +1 (Heroic "
        + Number(points.heroic || 0) + " / Tyrant " + Number(points.tyrant || 0)
        + " / Martyr " + Number(points.martyr || 0) + ")",
        "good"
      );
      if (ending && ending.key && ending.key !== "contested") {
        showNotif("Ending trajectory: " + ending.title, "good");
      }
      if (!finaleBefore.unlocked && finaleAfter.unlocked) {
        showNotif("Final outcome unlocked in Endings.", "good");
      }
    }
    recordFactionConsequence({
      system: 'faction',
      title: 'Faction contract advanced',
      detail: String(mission.title || missionId || 'Contract') + ' [' + String(pathway).toUpperCase() + ']',
      region: String(mission.region || 'province'),
      locationKey: factionLocationKeyFromBase(null, mission),
      severity: 'medium',
      deltas: { stability: 1, witness: 1, factionHeat: -1 },
      tags: ['faction-contract', 'threat-cleared', pathway === 'tyrant' ? 'patrol-deployed' : 'discovered-route', pathway === 'martyr' ? 'settled-holding' : 'npc-relationship']
    });
    setupFactionTab();
    renderEndingsPanel();
  }

  function visitFactionBase(factionId) {
    ensureFactionState();
    const faction = FACTIONS[factionId];
    const base = ensureBaseActivity(factionId);
    if (!faction || !base) return;
    base.rumorClock = Number(base.rumorClock || 0) + 1;
    openFactionBaseHub(factionId);
  }

  function patchFactionTabSwitchRefresh() {
    if (typeof window === "undefined" || typeof window.switchTab !== "function" || window._factionTabRefreshPatched) return;
    window._factionTabRefreshPatched = true;
    const baseSwitch = window.switchTab;
    window.switchTab = function (tabId, btn) {
      const out = baseSwitch.apply(this, arguments);
      if (tabId === FACTION_TAB_ID) setupFactionTab();
      if (tabId === ENDINGS_TAB_ID) renderEndingsPanel();
      return out;
    };
  }

  function patchRenownRefresh() {
    if (typeof window === "undefined" || typeof window.changeFactionRenown !== "function" || window._factionRenownRefreshPatched) return;
    window._factionRenownRefreshPatched = true;
    const base = window.changeFactionRenown;
    window.changeFactionRenown = function () {
      const out = base.apply(this, arguments);
      const panel = document.getElementById(FACTION_TAB_ID);
      if (panel) setupFactionTab();
      renderEndingsPanel();
      return out;
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  window.factionSystem = {
    FACTIONS,
    FACTION_ACTION_DIE_MAP,
    STORY_PATHWAYS,
    FACTION_DYNAMICS,
    TRUST_LEVELS,
    BETRAYAL_SCENARIOS,
    setupFactionTab,
    renderEndingsPanel,
    revealFinalEnding,
    openEndingsTab,
    refreshAdaptiveChoices,
    resolveAdaptiveChoice,
    expandFaction,
    acceptFactionMission: acceptFactionMissionFromTab,
    visitBase: visitFactionBase,
    syncBaseMarkers: syncFactionBaseMarkers,
    getProvinceMarker: getFactionBaseMarkerAtProvince,
    getSeaMarker: getFactionBaseMarkerAtSea,
    getGalaxyMarker: getFactionBaseMarkerAtGalaxy,
    getWTWMarker: getFactionBaseMarkerAtWTW,
    getPlanetMarker: getFactionBaseMarkerAtPlanet,
    openBaseFromMarker: openFactionBaseFromMarker,
    acceptMission: acceptFactionMission,
    resolveMission: resolveFactionMission,
    resolveEvent: resolveFactionEvent,
    talkNpc: talkFactionNpc,
    generateNpcTask,
    openMerchant: openFactionMerchant,
    buyMerchantItem: buyFactionMerchantItem,
    generateRooms: regenerateFactionBaseRooms,
    rollEvents: rerollFactionBaseEvents,
    getProvinceTask: getTaskAtProvince,
    getSeaTask: getTaskAtSea,
    getGalaxyTask: getTaskAtGalaxy,
    getWTWTask: getTaskAtWTW,
    getPlanetTask: getTaskAtPlanet,
    resolveMapTask: resolveWayfarerTaskRoll,
    startMonsterTask: startMonsterTaskEncounter,
    finalizeMonsterTask: finalizeMonsterTaskEncounter,
    joinGuild: joinGuildCampaign,
    startGuildCampaign: startGuildCampaignQuest,
    postGuildContract,
    refreshGuildContracts,
    toggleGuildPrep,
    getFactionStoryRollBonus,
    generateAdaptiveChoices,
    onMissionResolved
  };

  window.getFactionStoryRollBonus = getFactionStoryRollBonus;

  // Auto-setup when page loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      ensureFactionState();
      syncFactionBaseMarkers();
      patchFactionTabSwitchRefresh();
      patchRenownRefresh();
    });
  } else {
    ensureFactionState();
    syncFactionBaseMarkers();
    patchFactionTabSwitchRefresh();
    patchRenownRefresh();
  }
})();
