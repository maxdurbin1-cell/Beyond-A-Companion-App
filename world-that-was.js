// world-that-was.js
(function () {
  const WTW_SCHEMA_VERSION = 4;
  const WTW_HEX = 34;
  const MAP_COLS = 13;
  const MAP_ROWS = 13;

  const ZONE_NAMES = [
    "Cyber Hub",
    "Green House",
    "Industrial Sector",
    "Neon City",
    "Outskirts",
    "Residential Blocks",
    "The Undercity",
    "The Wastes",
    "The Ports"
  ];

  const ZONE_COLORS = {
    "Cyber Hub": "#8fadb8",
    "Green House": "#72c987",
    "Industrial Sector": "#4f4f54",
    "Neon City": "#db72b2",
    "Outskirts": "#f1f1f1",
    "Residential Blocks": "#b0a9a1",
    "The Undercity": "#aa2f3b",
    "The Wastes": "#e2b55d",
    "The Ports": "#4f58a6"
  };

  const WTW_ZONE_TEXTURE_VARIANTS = {
    "Cyber Hub": ["cyber_hub_core", "cyber_hub_market", "cyber_hub_datastack"],
    "Green House": ["green_house_canopy", "green_house_plaza", "green_house_wetbeds"],
    "Industrial Sector": ["industrial_foundry", "industrial_rail", "industrial_scrapyard"],
    "Neon City": ["neon_city_arcade", "neon_city_tower", "neon_city_alley"],
    "Outskirts": ["outskirts_badlands", "outskirts_relay", "outskirts_quarry"],
    "Residential Blocks": ["residential_blocks_habstack", "residential_blocks_courtyard", "residential_blocks_ruin"],
    "The Undercity": ["the_undercity_tunnels", "the_undercity_floodline", "the_undercity_sump"],
    "The Wastes": ["the_wastes_ashfields", "the_wastes_craters", "the_wastes_stormplain"],
    "The Ports": ["the_ports_drydock", "the_ports_container_yard", "the_ports_ferry_spine"]
  };

  function pickWorldDistrictType(zoneName) {
    const pool = WTW_ZONE_TEXTURE_VARIANTS[zoneName] || [];
    if (!pool.length) return "district";
    return safePick(pool, pool[0]);
  }

  const MAJOR_POWERS = ["Axiom Cartel", "Helix Union", "Titan Crown"];
  const FACTIONS = ["Veil Runners", "Dust Saints"];
  const HOLDERS = MAJOR_POWERS.concat(FACTIONS);
  const POWER_TO_FACTION_RENOWN = {
    "Axiom Cartel": "corporations",
    "Helix Union": "political",
    "Titan Crown": "military",
    "Veil Runners": "underworld",
    "Dust Saints": "religious"
  };
  const ACTION_STATS = ["body", "mind", "spirit", "control", "lead", "strike", "shoot", "defend"];
  const ALLOWED_DREAD_DICE = [4, 6, 8, 10, 12, 20];
  // Returns a concrete item name drawn from SHOP_DATA rather than a generic label.
  function getWtwFallbackLoot() {
    if (typeof SHOP_DATA !== "undefined" && SHOP_DATA) {
      var categoryMap = [
        { key: "tradegoods", fallback: "Salvage Cache" },
        { key: "toolkits",   fallback: "Scavenger's Pouch" },
        { key: "remedies",   fallback: "Medical Patch" },
        { key: "scrolls",    fallback: "Reveal Traps" },
        { key: "weapon_mods",fallback: "Weapon Brace" },
        { key: "armor",      fallback: "Balanced Armor" },
        { key: "items",      fallback: "Intel Packet" },
        { key: "strange",    fallback: "Strange Item #01" }
      ];
      var entry = categoryMap[Math.floor(Math.random() * categoryMap.length)];
      var pool = Array.isArray(SHOP_DATA[entry.key]) ? SHOP_DATA[entry.key] : [];
      if (pool.length) {
        var item = pool[Math.floor(Math.random() * pool.length)];
        return String((item && item.name) || item || entry.fallback);
      }
      return entry.fallback;
    }
    return "Salvage Cache";
  }
  const ZONE_DANGER = {
    "Cyber Hub": { eventCombatChance: 30, eventDreadBias: 0, encounterChance: 26, skirmishChance: 14, cycleShiftBonus: 0 },
    "Green House": { eventCombatChance: 20, eventDreadBias: -1, encounterChance: 18, skirmishChance: 10, cycleShiftBonus: -1 },
    "Industrial Sector": { eventCombatChance: 42, eventDreadBias: 1, encounterChance: 35, skirmishChance: 22, cycleShiftBonus: 1 },
    "Neon City": { eventCombatChance: 36, eventDreadBias: 0, encounterChance: 30, skirmishChance: 18, cycleShiftBonus: 0 },
    "Outskirts": { eventCombatChance: 44, eventDreadBias: 1, encounterChance: 37, skirmishChance: 24, cycleShiftBonus: 1 },
    "Residential Blocks": { eventCombatChance: 24, eventDreadBias: -1, encounterChance: 20, skirmishChance: 12, cycleShiftBonus: -1 },
    "The Undercity": { eventCombatChance: 52, eventDreadBias: 2, encounterChance: 42, skirmishChance: 30, cycleShiftBonus: 2 },
    "The Wastes": { eventCombatChance: 58, eventDreadBias: 2, encounterChance: 48, skirmishChance: 34, cycleShiftBonus: 2 },
    "The Ports": { eventCombatChance: 38, eventDreadBias: 0, encounterChance: 32, skirmishChance: 20, cycleShiftBonus: 0 }
  };
  const WORLD_ITEMS = ["water", "meds", "dataDrives", "scrap", "fuelCells"];
  const WTW_CONDITION_KEYS = ["weakened", "distracted", "shaken", "vulnerable"];

  const WTW_MARKER_STYLE = {
    solar_cycle: { icon: "🌑", color: "#f5d76e", priority: 98, title: "New Sun Stage" },
    solar_cycle_side: { icon: "🌍", color: "#9ad37b", priority: 93, title: "New Sun Side Quest" },
    solar_cycle_investigation: { icon: "⏳", color: "#c9d6f0", priority: 94, title: "New Sun Investigation" },
    solar_cycle_omen: { icon: "☄", color: "#f0a050", priority: 96, title: "Solar Omen" },
    solar_cycle_stage: { icon: "🌑", color: "#f5d76e", priority: 97, title: "New Sun Stage" },
    mission: { icon: "🎯", color: "#e8c050", priority: 100, title: "Mission Marker" },
    mission_informer: { icon: "👁", color: "#e8c050", priority: 101, title: "Mission Informer" },
    mission_site: { icon: "✖", color: "#ff8450", priority: 101, title: "Mission Site" },
    mission_raid_informer: { icon: "🐉", color: "#ff8450", priority: 103, title: "Raid Informer" },
    mission_raid_site: { icon: "🐉", color: "#ff6a3d", priority: 104, title: "Raid Confrontation" },
    task: { icon: "🧾", color: "#46c4b6", priority: 90, title: "Holding Task" },
    story: { icon: "➤", color: "#f0d070", priority: 88, title: "Story Objective" },
    landing: { icon: "🚀", color: "#7ed7ff", priority: 80, title: "Landing Pad" },
    station: { icon: "🚆", color: "#7ed7ff", priority: 75, title: "Rail Station" },
    service: { icon: "🛠", color: "#7ee0b2", priority: 70, title: "District Service" },
    structure: { icon: "🏛", color: "#c9a227", priority: 68, title: "Explorable Structure" },
    wayfarer: { icon: "✧", color: "#d4b8ff", priority: 64, title: "Wayfarer" },
    faction_base: { icon: "🏰", color: "#46c4b6", priority: 66, title: "Faction Base" },
    faction_task: { icon: "✦", color: "#e8c050", priority: 67, title: "Wayfarer Task" },
    hazard: { icon: "☣", color: "#ff8a72", priority: 60, title: "Hazard" },
    peril: { icon: "⚠", color: "#ff8070", priority: 59, title: "Peril" },
    barrier: { icon: "⛔", color: "#ff9066", priority: 58, title: "Barrier" }
  };

  const WTW_STRUCTURE_TYPES = [
    {
      kind: "Watch Tower",
      names: ["Signal Watch", "Glass Relay Tower", "Crow's Lantern Tower", "Spinewatch Bastion"],
      rooms: [
        "Observation Deck - rangefinders sweep every route.",
        "Signal Room - blinking transmitters map district movement.",
        "Gear Loft - spare lenses, coils, and tower tools.",
        "Locked Command Nook - encoded logs and old duty rosters.",
        "Storm Anchor Ring - cables hum in crosswinds."
      ]
    },
    {
      kind: "Archive Building",
      names: ["Broken Civic Archive", "Ledger Vault", "Dustline Registry", "Old Union Hall"],
      rooms: [
        "Records Hall - cabinets toppled into maze-like rows.",
        "Map Room - route plans marked with obsolete borders.",
        "Clerk Station - stamped permits and sealed envelopes.",
        "Microfilm Niche - projector still warm.",
        "Basement Repository - flood marks and intact lockboxes."
      ]
    },
    {
      kind: "Industrial Building",
      names: ["Rivetworks Annex", "Refinery Annex", "Cargo Press House", "Blackline Foundry Wing"],
      rooms: [
        "Assembly Floor - unfinished machinery frozen mid-cycle.",
        "Boiler Gallery - pressure gauges jump without warning.",
        "Crane Control Bay - overhead rails cut through haze.",
        "Maintenance Shaft - narrow ladder into hot darkness.",
        "Dispatch Desk - manifests tagged with priority seals."
      ]
    }
  ];

  const WTW_HAZARDS = [
    { type: "hazard", name: "Toxic Vent Burst", stat: "body", dread: 8, condition: "weakened", desc: "A pressure vent floods the district with chemical steam." },
    { type: "hazard", name: "Signal Overload", stat: "mind", dread: 8, condition: "distracted", desc: "Interference storms fragment concentration and guidance systems." },
    { type: "peril", name: "Riot Swell", stat: "spirit", dread: 8, condition: "shaken", desc: "Panic cascades through alleys and escalates into violence." },
    { type: "barrier", name: "Collapsed Transit Wall", stat: "body", dread: 6, condition: "vulnerable", desc: "Route collapse blocks movement and exposes travelers." },
    { type: "barrier", name: "Checkpoint Blackout", stat: "body", dread: 6, condition: "distracted", desc: "Locked systems seal exits and scramble route data." },
    { type: "peril", name: "Drone Hunt Zone", stat: "defend", dread: 10, condition: "vulnerable", desc: "Hunter drones sweep for movement across open lines." }
  ];

  function normalizeDreadDie(value, fallback) {
    const raw = Number(value || 0);
    if (ALLOWED_DREAD_DICE.indexOf(raw) >= 0) return raw;
    const base = Number(raw || fallback || 8);
    let best = ALLOWED_DREAD_DICE[0];
    let bestDiff = Math.abs(best - base);
    for (let i = 1; i < ALLOWED_DREAD_DICE.length; i += 1) {
      const die = ALLOWED_DREAD_DICE[i];
      const diff = Math.abs(die - base);
      if (diff < bestDiff || (diff === bestDiff && die > best)) {
        best = die;
        bestDiff = diff;
      }
    }
    return best;
  }

  function stepDreadDie(current, dir) {
    const die = normalizeDreadDie(current, 8);
    let idx = ALLOWED_DREAD_DICE.indexOf(die);
    if (idx < 0) idx = 2;
    let next = idx + (dir > 0 ? 1 : -1);
    if (next < 0) next = 0;
    if (next >= ALLOWED_DREAD_DICE.length) next = ALLOWED_DREAD_DICE.length - 1;
    return ALLOWED_DREAD_DICE[next];
  }

  const WTW_WAYFARER_NAMES = [
    "Rhea Coil", "Jax Meridian", "Old Sable", "Mira Vale", "Korr Dune", "Len Blackwire", "Toma Relic", "Ena Drift"
  ];

  const WTW_WAYFARER_RUMORS = [
    "A hidden service cache opens for one hour after dusk alarms.",
    "Titan Crown patrol routes shifted toward the southern rail.",
    "A relic broker is paying double for pre-fall station maps.",
    "One landing pad is being watched by Veil Runner lookouts.",
    "An old tower keeps broadcasting district control changes.",
    "A sealed archive wing opens when the cycle siren fails."
  ];

  const WTW_WAYFARER_HISTORIES = [
    "Before the fracture, this zone fed the entire coastal ring.",
    "The first rail line here was built by refugee engineers.",
    "The district towers once mirrored a single civic command grid.",
    "The old ports funded half the city's reconstruction era.",
    "This quarter hid resistance cells during the blackout years.",
    "The undercity archives still track forgotten family claims."
  ];

  const ZONE_FLAVOR = {
    "Cyber Hub": {
      locations: ["beneath data towers", "inside a quantum exchange", "in the neon relay quarter"],
      sights: ["The Nexus Point", "The Pixel Promenade", "The Simulation Sphere"],
      descriptions: ["code rain drips across every wall", "AI murals rewrite themselves every minute", "the district hums like a live processor"],
      features: ["hackers and brokers", "aug-tech pilgrims", "corporate runners"],
      flora: ["neon ivy", "circuit moss", "synthetic orchid"],
      fauna: ["holographic pigeons", "drone swarms", "memory eels"],
      land: ["glass catwalks", "server vault alleys", "fiber trenches"],
      weather: ["signal haze", "coolant mist", "acid drizzle"],
      events: [
        { title: "Corporate Data Heist", text: "A rival vault is exposed for six minutes.", action: "Breach the vault", reward: "+1 Axiom Cartel, random data loot" },
        { title: "Rogue AI Lockdown", text: "Security grids close without warning.", action: "Stabilize the AI core", reward: "+1 Helix Union, random augment" }
      ]
    },
    "Green House": {
      locations: ["beneath engineered canopies", "inside mist gardens", "along bio-lum streams"],
      sights: ["The Orchid Pavilion", "The Glow Trail", "The Cascade Overlook"],
      descriptions: ["the dome breathes with humid green light", "gene labs pulse behind glass", "pollinator drones patrol in quiet loops"],
      features: ["botanists and medics", "eco-tour pilgrims", "gene-smith apprentices"],
      flora: ["DNA-helix trees", "heritage fern", "spice-bloom vine"],
      fauna: ["engineered avians", "eco-drones", "holo deer"],
      land: ["glass terraces", "root-bridge lanes", "waterfall decks"],
      weather: ["soft mist", "warm dew", "controlled rain"],
      events: [
        { title: "Invasive Bloom", text: "A predatory vine overruns a lab perimeter.", action: "Contain the spread", reward: "+1 Dust Saints, random med loot" },
        { title: "Genome Theft", text: "A rare gene-seed shipment vanishes.", action: "Track the smugglers", reward: "+1 Helix Union, random biotech" }
      ]
    },
    "Industrial Sector": {
      locations: ["inside foundry lines", "along the rail yards", "under steam stacks"],
      sights: ["The Iron Citadel", "The Vent Core", "The Junk Throne"],
      descriptions: ["smelters paint the sky amber", "cargo cranes scrape through smog", "factory sirens echo in shifts"],
      features: ["forge crews", "scrap barons", "militia contractors"],
      flora: ["slag moss", "rust-vine", "filter fern"],
      fauna: ["gear hounds", "iron rats", "soot bats"],
      land: ["slag fields", "catwalk grids", "sealed tunnels"],
      weather: ["smog", "ashfall", "heat haze"],
      events: [
        { title: "Foundry Strike", text: "Workers block a central melt line.", action: "Broker or break the strike", reward: "+1 Titan Crown, 200 credits" },
        { title: "Blueprint Leak", text: "Weapon blueprints hit black channels.", action: "Recover the files", reward: "+1 Veil Runners, random weapon mod" }
      ]
    },
    "Neon City": {
      locations: ["under neon arches", "through VR corridors", "above the skyline clubs"],
      sights: ["The Circuit Cafe", "The Mirage Market", "The Skyline Club"],
      descriptions: ["holo ads flood every street", "music leaks from underground venues", "street racers own midnight"],
      features: ["performers and fixers", "club syndicates", "brand agents"],
      flora: ["pixel-bloom", "chrome leaf", "led-fiber vine"],
      fauna: ["tag cats", "neon ferrets", "holo sparrows"],
      land: ["vertical skyways", "metro relics", "club rooftops"],
      weather: ["neon drizzle", "static wind", "light haze"],
      events: [
        { title: "Arena Broadcast Hijack", text: "A live event feed is seized mid-show.", action: "Retake the broadcast", reward: "+1 Axiom Cartel, random luxury loot" },
        { title: "Race Route Ambush", text: "A gang rigs a race corridor with traps.", action: "Clear the route", reward: "+1 Veil Runners, 250 credits" }
      ]
    },
    "Outskirts": {
      locations: ["on broken overpasses", "across dry lake beds", "inside scrap mazes"],
      sights: ["The Echo Tower", "The Iron Garden", "The Last Depot"],
      descriptions: ["wind whips through rust skeletons", "nomad caravans trade under tarps", "old rail maps still guide survivors"],
      features: ["scavenger camps", "water traders", "route scouts"],
      flora: ["dust scrub", "irradiated bloom", "solar moss"],
      fauna: ["outlaw raptors", "sand crawlers", "scrap dogs"],
      land: ["dry flats", "junk hills", "open roads"],
      weather: ["dust storms", "hard heat", "cold nights"],
      events: [
        { title: "Caravan Distress", text: "A convoy goes dark beyond checkpoint seven.", action: "Escort recovery", reward: "+1 Dust Saints, random trade loot" },
        { title: "Silo Raiders", text: "Raiders breach a refugee silo node.", action: "Hold the line", reward: "+1 Titan Crown, 180 credits" }
      ]
    },
    "Residential Blocks": {
      locations: ["inside tower stacks", "over hanging markets", "through waterworks halls"],
      sights: ["The Skyline Garden", "The Community Hall", "The Cascade"],
      descriptions: ["families crowd skybridges", "market lights glow through rain", "maintenance drones hum all night"],
      features: ["tenant councils", "local traders", "block wardens"],
      flora: ["rooftop herbs", "hydro lettuce", "skybridge fern"],
      fauna: ["community cats", "tower sparrows", "balcony lizards"],
      land: ["stacked blocks", "courtyard plazas", "service shafts"],
      weather: ["urban warmth", "tower winds", "short rain"],
      events: [
        { title: "Grid Blackout", text: "Three blocks lose power and panic rises.", action: "Restore the node", reward: "+1 Axiom Cartel, random utility loot" },
        { title: "Festival Flashpoint", text: "Two crews clash during a district celebration.", action: "Defuse or dominate", reward: "+1 Helix Union, 150 credits" }
      ]
    },
    "The Undercity": {
      locations: ["inside metro ruins", "through flood tunnels", "beneath iron bunkers"],
      sights: ["The Phantom Platform", "The Gearworks", "The Iron Sanctuary"],
      descriptions: ["wet concrete reflects red light", "old tracks split into forbidden sectors", "voices carry too far in the dark"],
      features: ["black market cells", "cult enclaves", "tunnel guides"],
      flora: ["glow algae", "shadow bloom", "rust roots"],
      fauna: ["ghost rats", "tunnel eels", "iron spiders"],
      land: ["drain channels", "vault chambers", "collapsed rails"],
      weather: ["cold damp", "condensation fog", "stale air"],
      events: [
        { title: "Market Riot", text: "A weapons deal goes violent.", action: "Seize control", reward: "+1 Veil Runners, random contraband" },
        { title: "Cache Rumor", text: "An old war cache is pinged on outlaw channels.", action: "Recover first", reward: "+1 Titan Crown, random armor" }
      ]
    },
    "The Wastes": {
      locations: ["around ruined towers", "inside petrified groves", "near radioactive craters"],
      sights: ["The Sunken Ship", "The Crystal Grove", "The Shield Dome"],
      descriptions: ["sand swallows old roads", "wind reveals and buries ruins hourly", "nomad beacons pulse on distant ridges"],
      features: ["desert clans", "relic hunters", "radiation medics"],
      flora: ["dune grass", "radio bloom", "fossil vine"],
      fauna: ["dust devils", "waste wolves", "irradiated lizards"],
      land: ["salt flats", "dune corridors", "impact basins"],
      weather: ["sandstorm", "dry heat", "ash dust"],
      events: [
        { title: "Storm Wall", text: "A storm front cuts off three routes.", action: "Chart a safe path", reward: "+1 Dust Saints, random survival gear" },
        { title: "Relic Surge", text: "Scanners detect a pre-fall cache opening.", action: "Secure the site", reward: "+1 Helix Union, random relic" }
      ]
    },
    "The Ports": {
      locations: ["under cargo cranes", "inside drydock lanes", "along contraband piers"],
      sights: ["The Spire", "The Silver Galleon", "The Neon Bazaar"],
      descriptions: ["ship horns blend with coded broadcasts", "dock crews move goods at all hours", "smuggler lights pulse beneath boardwalks"],
      features: ["harbor syndicates", "shipwright crews", "broker cells"],
      flora: ["dock algae", "salt vine", "anchor bloom"],
      fauna: ["mechanical crabs", "sea hawks", "manta-drakes"],
      land: ["dock walls", "floating decks", "warehouse lots"],
      weather: ["salt fog", "coastal gale", "humid rain"],
      events: [
        { title: "Auction Breach", text: "A black market auction is compromised.", action: "Raid or protect", reward: "+1 Veil Runners, random rare good" },
        { title: "Harbor Lockdown", text: "Port authority seals all exits.", action: "Smuggle a route open", reward: "+1 Axiom Cartel, 220 credits" }
      ]
    }
  };

  const ZONE_SERVICES = {
    "Cyber Hub": [
      { name: "Data Forge", cost: 40, desc: "Purchase tactical intel packets." },
      { name: "Augment Tune-Up", cost: 60, desc: "Calibrate cyberware for your next scene." }
    ],
    "Green House": [
      { name: "Botanical Therapy", cost: 30, desc: "Recover from stress in a bio-dome clinic." },
      { name: "Gene Med Pack", cost: 45, desc: "Acquire high-grade healing compounds." }
    ],
    "Industrial Sector": [
      { name: "Forge Rental", cost: 50, desc: "Craft or repair heavy equipment." },
      { name: "Convoy Routing", cost: 35, desc: "Secure safer freight pathways." }
    ],
    "Neon City": [
      { name: "VR Drill Suite", cost: 35, desc: "Sim-run combat and infiltration practice." },
      { name: "Holo Venue Access", cost: 25, desc: "Gain social leverage and rumors." }
    ],
    "Outskirts": [
      { name: "Water Purification", cost: 10, desc: "Refill and detox travel supplies." },
      { name: "Salvage Repair", cost: 20, desc: "Patch armor and field devices." }
    ],
    "Residential Blocks": [
      { name: "Community Med Bay", cost: 25, desc: "Stabilize conditions and recover." },
      { name: "Utility Override", cost: 30, desc: "Grant temporary district advantages." }
    ],
    "The Undercity": [
      { name: "Safehouse Access", cost: 20, desc: "Acquire hidden shelter and contacts." },
      { name: "Blackline Cybernetics", cost: 70, desc: "Install illicit combat mods." }
    ],
    "The Wastes": [
      { name: "Expedition Guide", cost: 35, desc: "Reduce travel risk in dead zones." },
      { name: "Rad Clinic", cost: 20, desc: "Treat burns and radiation sickness." }
    ],
    "The Ports": [
      { name: "Dock Maintenance", cost: 25, desc: "Service vessels and cargo rigs." },
      { name: "Night Market Access", cost: 15, desc: "Enter smuggler-only trade channels." }
    ]
  };

  const POWER_SERVICES = {
    "Axiom Cartel": [
      { name: "Corporate Blackline", cost: 90, desc: "Temporary clearance and legal cover." },
      { name: "Axiom Arms Dealer", cost: 0, desc: "Axiom Cartel operatives sell weapons and weapon modifications only. No armor. No charity.", shopCat: "weapons", vendorName: "Axiom Arms Dealer", vendorFlavor: "Corp-stamped and lethal. They only deal in firepower." },
      { name: "Axiom Mod Exchange", cost: 0, desc: "Exclusive access to Cartel-certified weapon mods and upgrades.", shopCat: "weapon_mods", vendorName: "Axiom Mod Exchange", vendorFlavor: "Upgrade your edge. Axiom marks every piece." }
    ],
    "Helix Union": [
      { name: "Bio-Loop Recovery", cost: 80, desc: "Remove one harmful condition." },
      { name: "Helix Armory", cost: 0, desc: "The Helix Union supplies only body armor and defensive plating. Form, function, survive.", shopCat: "armor", vendorName: "Helix Armory", vendorFlavor: "Union-tested protection. They only sell what keeps you alive." }
    ],
    "Titan Crown": [
      { name: "Militia Contract", cost: 75, desc: "Call district security reinforcement." },
      { name: "Crown Combat Depot", cost: 0, desc: "Heavy combat kits and military-grade gear only. The Crown supplies soldiers, not civilians.", shopCat: "combat_kits", vendorName: "Crown Combat Depot", vendorFlavor: "Military surplus. They only outfit those ready to fight." }
    ],
    "Veil Runners": [
      { name: "Ghost Courier", cost: 45, desc: "Fast covert delivery and route intel." },
      { name: "Veil Hack Stall", cost: 0, desc: "Off-the-books OS hacks, intrusion tools, and electronic gadgets. Veil Runners don't touch weapons.", shopCat: "hacks", vendorName: "Veil Hack Stall", vendorFlavor: "No hardware. Only code and cunning." }
    ],
    "Dust Saints": [
      { name: "Ash Ward", cost: 35, desc: "Protect against one hazard this day." },
      { name: "Pilgrim Supply Post", cost: 0, desc: "Essential supplies, rations, and curios blessed by the Saints. They refuse to touch weapons or armor.", shopCat: "supplies", vendorName: "Pilgrim Supply Post", vendorFlavor: "Survival goods only. The Saints provide what the land does not." }
    ]
  };

  const HOLDING_NAMES = {
    "Axiom Cartel": ["Axiom Data Spire", "Cipher Court"],
    "Helix Union": ["Helix Gene Vault", "Verdant Coil Lab"],
    "Titan Crown": ["Titan Bastion", "Iron Marshal Keep"],
    "Veil Runners": ["Veil Relay", "Silent Circuit Den"],
    "Dust Saints": ["Ash Reliquary", "Dustward Shrine"]
  };

  const POWER_TASKS = {
    "Axiom Cartel": ["Extract encrypted executive ledger", "Deploy a spoof beacon in rival district", "Escort a data courier through hostile blocks"],
    "Helix Union": ["Recover stolen biotech vials", "Stabilize a failing genome reactor", "Audit a corrupted med node"],
    "Titan Crown": ["Hold perimeter during civic unrest", "Retake a seized logistics hub", "Lead militia convoy to safe quarter"],
    "Veil Runners": ["Deliver contraband through scanners", "Intercept rival whisper channel", "Plant a false route packet"],
    "Dust Saints": ["Recover relic from storm trench", "Protect pilgrims crossing dead zone", "Sanctify an irradiated water source"]
  };

  function safePick(list, fallback) {
    if (!Array.isArray(list) || !list.length) return fallback;
    if (typeof pick === "function") return pick(list);
    return list[Math.floor(Math.random() * list.length)];
  }

  function safeRoll(max) {
    if (typeof roll === "function") return roll(max);
    return Math.floor(Math.random() * max) + 1;
  }

  function dangerForZone(zoneName) {
    return ZONE_DANGER[zoneName] || { eventCombatChance: 35, eventDreadBias: 0, encounterChance: 25, skirmishChance: 16, cycleShiftBonus: 0 };
  }

  function getDeityPactPressure() {
    const pact = (S && S.deityPact && typeof S.deityPact === "object") ? S.deityPact : null;
    return {
      favor: Math.max(0, Number((pact && pact.favor) || 0)),
      debt: Math.max(0, Number((pact && pact.debt) || 0)),
      ending: String((pact && pact.endingKey) || "").toLowerCase()
    };
  }

  function getPactSkirmishDelta() {
    const p = getDeityPactPressure();
    let delta = 0;
    if (p.debt >= 4) delta += 1;
    if (p.debt >= 7) delta += 1;
    if (p.favor >= 4) delta -= 1;
    if (p.favor >= 7) delta -= 1;
    return delta;
  }

  function getPactAdjustedSkirmishChance(zoneName) {
    const base = dangerForZone(zoneName).skirmishChance;
    const delta = getPactSkirmishDelta();
    const adjusted = Number(base || 0) + (delta * 6);
    return Math.max(3, Math.min(90, adjusted));
  }

  function applyPactSkirmishDensityPressure(worldState, forceFull) {
    const w = worldState || ensureWorldState();
    if (!w || !Array.isArray(w.hexes) || !w.hexes.length) return 0;

    let expected = 0;
    const hasWorldSelection = !!w.selectedHexId;
    w.hexes.forEach(function (hex) {
      expected += getPactAdjustedSkirmishChance(hex.zone) / 100;
    });

    let target = Math.max(0, Math.min(w.hexes.length, Math.round(expected)));
    const st = (S && S.storyline && S.storyline.flags) ? S.storyline.flags : null;
    if (st && st.warfrontActive) {
      const warfrontFloor = Math.max(0, Number(st.warfrontScale || 0));
      target = Math.max(target, warfrontFloor);
    }

    const current = w.hexes.filter(function (hex) { return !!hex && !!hex.skirmish; }).length;
    const diff = target - current;
    if (!diff) return 0;

    const maxStep = forceFull ? Math.abs(diff) : Math.max(2, Math.min(8, Math.ceil(w.hexes.length * 0.04)));
    let changed = 0;

    if (diff > 0) {
      const pool = w.hexes.filter(function (hex) {
        return hex && !hex.skirmish && !hex.station && !hex.landingPad;
      });
      for (let i = 0; i < pool.length && changed < Math.min(diff, maxStep); i += 1) {
        const pickIx = safeRoll(pool.length) - 1;
        const chosen = pool.splice(pickIx, 1)[0];
        if (!chosen) continue;
        chosen.skirmish = true;
        changed += 1;
      }
      return changed;
    }

    const calmPool = w.hexes.filter(function (hex) {
      if (!hex || !hex.skirmish) return false;
      if (hex.id === w.storyObjectiveHexId) return false;
      return !hex.station && !hex.landingPad;
    });
    for (let i = 0; i < calmPool.length && changed < Math.min(Math.abs(diff), maxStep); i += 1) {
      const pickIx = safeRoll(calmPool.length) - 1;
      const chosen = calmPool.splice(pickIx, 1)[0];
      if (!chosen) continue;
      chosen.skirmish = false;
      changed += 1;
    }
    return changed;
  }

  function ensureWorldInventory() {
    if (typeof S === "undefined") return;
    S.worldInventory = S.worldInventory || {};
    WORLD_ITEMS.forEach(function (k) {
      if (typeof S.worldInventory[k] !== "number") S.worldInventory[k] = 0;
    });
  }

  function ensureWorldServiceBonuses() {
    if (typeof S === "undefined") return;
    S.worldServiceBonuses = S.worldServiceBonuses || {};
    if (typeof S.worldServiceBonuses.nextValorBonus !== "number") S.worldServiceBonuses.nextValorBonus = 0;
    if (typeof S.worldServiceBonuses.nextTradeBonus !== "number") S.worldServiceBonuses.nextTradeBonus = 0;
  }

  function grantWorldServiceBonus(kind, amount, cap) {
    ensureWorldServiceBonuses();
    if (!S || !S.worldServiceBonuses) return;
    const key = String(kind || "nextValorBonus");
    const add = Math.max(0, Number(amount || 0));
    const max = Math.max(0, Number(cap || 6));
    S.worldServiceBonuses[key] = Math.min(max, Number(S.worldServiceBonuses[key] || 0) + add);
  }

  function consumeWorldServiceBonus(kind) {
    ensureWorldServiceBonuses();
    if (!S || !S.worldServiceBonuses) return 0;
    const key = String(kind || "nextValorBonus");
    const val = Math.max(0, Number(S.worldServiceBonuses[key] || 0));
    if (val > 0) S.worldServiceBonuses[key] = 0;
    return val;
  }

  function addWorldItem(itemKey, amount) {
    ensureWorldInventory();
    if (!S || !S.worldInventory) return;
    const key = String(itemKey || "");
    const add = Math.max(0, amount || 0);
    S.worldInventory[key] = (S.worldInventory[key] || 0) + add;
  }

  function spendWorldItem(itemKey, amount) {
    ensureWorldInventory();
    if (!S || !S.worldInventory) return false;
    const key = String(itemKey || "");
    const need = Math.max(1, amount || 1);
    const have = S.worldInventory[key] || 0;
    if (have < need) return false;
    S.worldInventory[key] = have - need;
    return true;
  }

  function inventoryLabel(key) {
    if (key === "dataDrives") return "Data Drives";
    if (key === "fuelCells") return "Fuel Cells";
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function zoneRepTier(v) {
    if (v >= 10) return "Champion";
    if (v >= 7) return "Trusted";
    if (v >= 4) return "Known";
    if (v >= 1) return "Noted";
    return "Unknown";
  }

  function addZoneReputation(zoneName, amount) {
    const w = ensureWorldState();
    if (!w) return;
    const z = String(zoneName || "Unknown");
    w.zoneReputation = w.zoneReputation || {};
    w.zoneReputation[z] = (w.zoneReputation[z] || 0) + (amount || 1);
  }

  function getActionDie(statKey) {
    if (!S || !S.stats) return 4;
    const die = S.stats[String(statKey || "body").toLowerCase()];
    return typeof die === "number" ? die : 4;
  }

  function statLabel(statKey) {
    const k = String(statKey || "body");
    return k.charAt(0).toUpperCase() + k.slice(1);
  }

  function rollAgainstDread(statKey, dreadDie) {
    // Valor Die (V.D.) additive bonus logic.
    const vd = getActionDie(statKey);
    const dd = normalizeDreadDie(dreadDie || 8, 8);
    const a = (typeof explodingRoll === "function") ? explodingRoll(vd) : { total: safeRoll(vd) };
    const d = (typeof explodingRoll === "function") ? explodingRoll(dd) : { total: safeRoll(dd) };
    const invBonus = (typeof collectInventoryBonusesForStat === "function") ? collectInventoryBonusesForStat(statKey) : { addValor: 0, flat: 0 };
    const serviceBonus = String(statKey || "") === "valor" ? consumeWorldServiceBonus("nextValorBonus") : 0;
    let homeSecurityBonus = 0;
    if ((statKey === "valor" || statKey === "defend") && typeof getWayfarerHomeBonuses === "function") {
      const hb = getWayfarerHomeBonuses() || {};
      homeSecurityBonus = Math.min(2, Math.max(0, Number(hb.security || 0)));
    }
    let actionTotal = a.total + serviceBonus + homeSecurityBonus + Number(invBonus.flat || 0);
    const valorDie = (typeof getEffectiveDie === "function") ? getEffectiveDie("valor") : ((S.stats && S.stats.valor) || 4);
    for (let i = 0; i < Number(invBonus.addValor || 0); i++) {
      const bonusRoll = (typeof explodingRoll === "function") ? explodingRoll(valorDie) : { total: safeRoll(valorDie) };
      actionTotal += bonusRoll.total;
    }
    return {
      vd: vd,
      dd: dd,
      actionTotal: actionTotal,
      dreadTotal: d.total,
      success: actionTotal >= d.total
    };
  }

  function normalizeWtwConditionByStat(statKey, positive) {
    var key = String(statKey || 'body').toLowerCase();
    if (positive) {
      if (key === 'body' || key === 'strike' || key === 'shoot') return 'empowered';
      if (key === 'defend' || key === 'control') return 'protected';
      if (key === 'lead' || key === 'spirit') return 'bolstered';
      return 'focused';
    }
    if (key === 'body' || key === 'strike' || key === 'shoot') return 'weakened';
    if (key === 'defend') return 'vulnerable';
    if (key === 'lead' || key === 'spirit') return 'shaken';
    return 'distracted';
  }

  function applyWtwCondition(condKey) {
    if (!condKey) return;
    if (typeof toggleCond === 'function' && S && S.conditions && !S.conditions[condKey]) {
      try { toggleCond(condKey); return; } catch (_err) { console.error(_err); }
    }
    if (WTW_CONDITION_KEYS.indexOf(condKey) >= 0) {
      applyNegativeCondition(condKey);
      return;
    }
    applyPositiveCondition(condKey);
  }

  function addWtwRadiation(amount) {
    var ticks = Math.max(1, Number(amount || 1));
    if (S && S.radiationState && typeof S.radiationState === 'object') {
      S.radiationState.gainTicks = Math.max(0, Number(S.radiationState.gainTicks || 0) + ticks);
      return;
    }
    S.radiationExposure = Math.max(0, Number(S.radiationExposure || 0) + ticks);
  }

  function getWtwEncounterPressureSummary(hex) {
    var weather = String(hex && hex.narrative && hex.narrative.weather ? hex.narrative.weather : '').toLowerCase();
    var weatherHazard = /(ash|acid|storm|squall|toxic|static|sandstorm|blizzard|radiation|heat)/.test(weather);
    var summary = {
      weatherLabel: weather || 'clear lanes',
      weatherHazard: weatherHazard,
      rivalLabel: 'No rival pressure spike.',
      rivalHostile: false,
      rivalThreat: 0
    };
    if (typeof window.ensureRivalState === 'function') {
      try {
        var rival = window.ensureRivalState();
        if (rival && rival.alive) {
          summary.rivalThreat = Number(rival.threatTier || 0);
          summary.rivalHostile = Number(rival.rapport || 0) <= -2 || Number(rival.threatTier || 0) >= 6 || /hostile|nemesis/i.test(String(rival.status || ''));
          summary.rivalLabel = rival.name + ' · Threat ' + Number(rival.threatTier || 0) + ' · Rapport ' + Number(rival.rapport || 0) + (summary.rivalHostile ? ' (hostile)' : '');
        }
      } catch (_err) { console.error(_err); }
    }
    return summary;
  }

  function applyWtwEncounterFailureConsequences(hex, encounter, check, options) {
    var cfg = options || {};
    var statKey = String((cfg.stat || (encounter && encounter.stat) || 'valor')).toLowerCase();
    var actionTotal = Number(check && check.actionTotal || 0);
    var dreadTotal = Number(check && check.dreadTotal || 0);
    var margin = Math.max(1, dreadTotal - actionTotal);
    var pressure = getWtwEncounterPressureSummary(hex);
    var notes = [];
    var applyChanges = !cfg.preview;

    if (/body|defend|control|strike|shoot/.test(statKey)) {
      if (applyChanges) {
        if (typeof changeHealth === 'function') changeHealth(margin);
        else if (typeof changeStress === 'function') changeStress(margin);
      }
      notes.push((typeof changeHealth === 'function' ? 'Health +' : 'Stress +') + margin);
    } else {
      var ms = margin;
      if (applyChanges) {
        if (typeof changeMentalStress === 'function') changeMentalStress(ms);
        else if (typeof changeStress === 'function') changeStress(ms);
      }
      notes.push('Mental Stress +' + ms);
    }

    var negCond = normalizeWtwConditionByStat(statKey, false);
    if (applyChanges) applyWtwCondition(negCond);
    notes.push('Condition ' + negCond);

    if (pressure.weatherHazard) {
      if (applyChanges) addWtwRadiation(margin);
      notes.push('Radiation +' + margin + ' (weather)');
    }

    if (pressure.rivalHostile) {
      if (applyChanges && typeof changeMentalStress === 'function') changeMentalStress(margin);
      notes.push('Mental Stress +' + margin + ' (rival pressure)');
    }

    if (hex && applyChanges) hex.skirmish = true;
    if (applyChanges) {
      if (typeof changeCounter === 'function') changeCounter('tmw', 1);
      else if (typeof S !== 'undefined') S.tmw = Math.max(0, Number(S.tmw || 0) + 1);
    }
    notes.push('+1 Teamwork · Skirmish triggered');

    return {
      stat: statKey,
      margin: margin,
      notes: notes,
      pressure: pressure,
      summary: notes.join(', ')
    };
  }

  function openWtwEncounterFailureModal(hex, encounter, check, contextLabel) {
    if (typeof openModal !== 'function') return false;
    var pressure = getWtwEncounterPressureSummary(hex);
    var consequence = applyWtwEncounterFailureConsequences(hex, encounter, check, { preview: true, stat: encounter && encounter.stat });
    var pushDread = stepDreadDie(Number((encounter && encounter.dread) || (check && check.dd) || 8), 1);
    var tmw = Number((S && S.tmw) || 0);
    window._pendingWtwEncounterRoll = {
      hexId: hex ? hex.id : '',
      encounter: encounter || null,
      check: check || null,
      baseDread: Number((encounter && encounter.dread) || (check && check.dd) || 8),
      pushDread: pushDread,
      contextLabel: String(contextLabel || 'Failure')
    };
    var html = ''
      + "<div style='font-size:.82rem;color:var(--text2);line-height:1.6;'>"
      + "<div style='font-family:Cinzel,serif;font-size:.92rem;color:#ff8a72;margin-bottom:.2rem;'>" + String(contextLabel || 'Encounter Failure') + "</div>"
      + "<div style='margin-bottom:.28rem;'><strong>Roll:</strong> " + statLabel((encounter && encounter.stat) || 'valor') + " d" + Number(check && check.vd || getActionDie((encounter && encounter.stat) || 'valor')) + " " + Number(check && check.actionTotal || 0) + " vs Dread " + dreadLabel(Number(check && check.dd || (encounter && encounter.dread) || 8)) + " " + Number(check && check.dreadTotal || 0) + "</div>"
      + "<div style='margin-bottom:.28rem;'><strong>Weather Pressure:</strong> " + pressure.weatherLabel + (pressure.weatherHazard ? " (hazardous)" : "") + "</div>"
      + "<div style='margin-bottom:.35rem;'><strong>Rival Pressure:</strong> " + pressure.rivalLabel + "</div>"
      + "<div style='background:rgba(255,96,96,.07);border:1px solid rgba(255,96,96,.3);padding:.42rem .55rem;border-radius:4px;margin-bottom:.45rem;'>"
      + "<div style='font-size:.76rem;color:#ff8a72;margin-bottom:.16rem;'>If you take Failure now</div>"
      + "<div style='font-size:.77rem;color:var(--text2);'>" + consequence.summary + "</div>"
      + "</div>"
      + "<div style='font-size:.77rem;color:var(--text2);margin-bottom:.4rem;'><strong>Push Luck:</strong> spend <strong>2 Teamwork</strong>, reroll at higher dread <strong>" + dreadLabel(pushDread) + "</strong>. Success grants a stat-based positive condition. Failure applies the consequence line above.</div>"
      + "<div style='display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end;'>"
      + "<button class='btn btn-sm' onclick='wtwOpenEncounterFailureRecovery()'>Teamwork Recovery Options</button>"
      + "<button class='btn btn-sm btn-warn' onclick='wtwAcceptEncounterFailure()'>Accept Failure</button>"
      + "<button class='btn btn-sm btn-teal' " + (tmw >= 2 ? '' : "disabled title='Need 2 Teamwork'") + " onclick='wtwPushEncounterLuck()'>Push Luck (2 Teamwork)</button>"
      + "</div>"
      + "</div>";
    openModal('Encounter Failure', html);
    return true;
  }

  function openWtwEncounterFailureRecovery() {
    const pending = window._pendingWtwEncounterRoll;
    if (!pending || !pending.encounter || !pending.check) {
      if (typeof showNotif === 'function') showNotif('No pending failure to recover.', 'warn');
      return;
    }
    const statKey = String((pending.encounter && pending.encounter.stat) || 'valor');
    const actionDie = Math.max(4, Number((pending.check && pending.check.vd) || getActionDie(statKey) || 4));
    const dreadDie = Math.max(4, Number((pending.check && pending.check.dd) || (pending.encounter && pending.encounter.dread) || 8));
    const failedBy = Math.max(1, Number((pending.check && pending.check.dreadTotal) || 0) - Number((pending.check && pending.check.actionTotal) || 0) || 1);
    if (typeof addTMWOnFail !== 'function') return;
    addTMWOnFail('wtw-encounter-failure', {
      failedBy: failedBy,
      actionDie: actionDie,
      dreadDie: dreadDie,
      actionLabel: statLabel(statKey) + ' Die',
      onConvert: function () {
        resolveDistrictEncounter('success', {
          skipPrompt: true,
          manual: true,
          teamworkConverted: true,
          checkOverride: Object.assign({}, pending.check, { success: true, teamworkConverted: true })
        });
        if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
          window.BTLRules.recordTeamworkConvertedSuccess('wtw-encounter-teamwork-convert');
        }
        if (typeof showNotif === 'function') showNotif('Teamwork conversion applied: encounter recovered to success. No Successful Roll gained.', 'good');
        return true;
      }
    });
  }

  function putLootInBackpack(lootName) {
    const item = String(lootName || "Salvage Cache");
    if (typeof addItemToBackpack === "function") {
      try {
        if (addItemToBackpack(item)) return true;
      } catch (err) { console.error(err); }
    }
    if (typeof addToBackpack === "function") {
      try {
        if (addToBackpack(item)) return true;
      } catch (err) { console.error(err); }
    }
    if (!Array.isArray(S.backpack)) S.backpack = ["", "", "", "", "", ""];
    const slot = S.backpack.indexOf("");
    if (slot >= 0) {
      S.backpack[slot] = item;
      const el = document.getElementById("bp" + slot);
      if (el) el.value = item;
      return true;
    }
    return false;
  }

  function isWtwNightModeActive() {
    if (typeof window.isEncounterNightModeActive === 'function') return !!window.isEncounterNightModeActive();
    return !!(typeof S !== 'undefined' && S && S.nightMode);
  }

  function getWtwNightModeBonusChance() {
    if (window.settingsSystem && typeof window.settingsSystem.getNightModeRate === 'function') {
      return Number(window.settingsSystem.getNightModeRate('wtw') || 38);
    }
    return 38;
  }

  function buildWtwNightModeBonus() {
    const mode = safePick(['intel', 'cache', 'renown'], 'intel');
    if (mode === 'cache') {
      const item = drawServiceMerchantItem(['items', 'toolkits', 'tradegoods', 'remedies']);
      return {
        title: 'Night Cache',
        text: 'A hidden rooftop cache activates under blackout sirens.',
        rewards: { item: item, credits: 20 }
      };
    }
    if (mode === 'renown') {
      return {
        title: 'Shadow Contact',
        text: 'A district contact leaks patrol routes in exchange for future favor.',
        rewards: { renown: 1, tmw: 1 }
      };
    }
    return {
      title: 'Midnight Signal',
      text: 'Encrypted tower lights reveal a short-lived infiltration lane.',
      rewards: { tmw: 1, credits: 30 }
    };
  }

  function applyWtwNightModeBonusRewards(encounter, contextLabel) {
    const bonus = encounter && encounter.nightModeBonus ? encounter.nightModeBonus : null;
    if (!bonus || !bonus.rewards) return '';
    const rewards = bonus.rewards;
    const notes = [];
    if (rewards.credits) {
      setCredits(getCredits() + Number(rewards.credits || 0));
      notes.push('+' + Number(rewards.credits || 0) + ' Credits');
    }
    if (rewards.renown) {
      addZoneReputation((encounter && encounter.zoneName) || (getSelectedHex() && getSelectedHex().zone) || 'Cyber Hub', Number(rewards.renown || 0));
      notes.push('+' + Number(rewards.renown || 0) + ' Zone Reputation');
    }
    if (rewards.tmw && typeof changeCounter === 'function') {
      changeCounter('tmw', Number(rewards.tmw || 0));
      notes.push('+' + Number(rewards.tmw || 0) + ' Teamwork');
    }
    if (rewards.item) {
      const ok = putLootInBackpack(rewards.item);
      notes.push(rewards.item + (ok ? ' (Backpack)' : ' (Backpack Full)'));
      if (ok && typeof window.tryAwardLoreBookDrop === 'function') window.tryAwardLoreBookDrop('world that was cache', 14);
    }
    if (notes.length && typeof showNotif === 'function') {
      showNotif('Night Mode bonus resolved (' + (contextLabel || 'district') + '): ' + notes.join(', ') + '.', 'good');
    }
    return notes.length ? (' Night Mode Bonus: ' + notes.join(', ') + '.') : '';
  }

  function applyPositiveCondition(condKey) {
    ensureConditionsState();
    if (!S || !S.conditions) return;
    const key = WTW_CONDITION_KEYS.indexOf(condKey) >= 0 ? condKey : "focused";
    S.conditions[key] = true;
    if (typeof updateConditionButtons === "function") updateConditionButtons();
    if (typeof updateAllStatDisplays === "function") updateAllStatDisplays();
  }

  function clearOneNegativeCondition() {
    ensureConditionsState();
    if (!S || !S.conditions) return "";
    const negatives = ["weakened", "vulnerable", "distracted", "shaken"];
    const active = negatives.find(function (key) { return !!S.conditions[key]; });
    if (!active) return "";
    S.conditions[active] = false;
    if (typeof updateConditionButtons === "function") updateConditionButtons();
    if (typeof updateAllStatDisplays === "function") updateAllStatDisplays();
    return active;
  }

  function drawServiceMerchantItem(preferredCategories) {
    const pool = Array.isArray(preferredCategories) && preferredCategories.length
      ? preferredCategories
      : ["items", "remedies", "services", "toolkits", "tradegoods"];
    let list = [];
    if (typeof SHOP_DATA === "object" && SHOP_DATA) {
      for (let i = 0; i < pool.length; i += 1) {
        const key = pool[i];
        if (Array.isArray(SHOP_DATA[key]) && SHOP_DATA[key].length) {
          list = SHOP_DATA[key];
          break;
        }
      }
    }
    const picked = list.length ? safePick(list, list[0]) : { name: "District Supply Cache" };
    return String((picked && picked.name) || "District Supply Cache");
  }

  function buildWorldEvent(zoneName, template) {
    const base = Object.assign({}, template || {});
    const danger = dangerForZone(zoneName);
    if (safeRoll(100) <= danger.eventCombatChance) {
      const dread = normalizeDreadDie(safePick([6, 8, 8, 10], 8) + danger.eventDreadBias, 8);
      const enemies = safePick([1, 2, 2, 3, 4], 2);
      return {
        title: base.title || "District Conflict",
        text: base.text || "Violence erupts across the district.",
        action: base.action || "Engage hostiles",
        reward: base.reward || "Loot and influence",
        mode: "combat",
        enemies: enemies,
        dread: dread,
        enemyHealth: 2 * dread
      };
    }
    return {
      title: base.title || "District Operation",
      text: base.text || "A high-risk operation needs action.",
      action: base.action || "Resolve the operation",
      reward: base.reward || "Loot and influence",
      mode: "skill",
      stat: "valor",
      dread: normalizeDreadDie(safePick([6, 8, 8, 10], 8) + danger.eventDreadBias, 8)
    };
  }

  function buildDistrictEncounter(zoneName) {
    const zf = ZONE_FLAVOR[zoneName] || ZONE_FLAVOR["Cyber Hub"];
    const evt = safePick(zf.events, zf.events[0]);
    const danger = dangerForZone(zoneName);
    if (safeRoll(100) > danger.encounterChance) return null;
    if (safeRoll(100) <= 35) {
      return {
        title: "Encounter: Traveling Wayfarer",
        text: "A roaming Wayfarer calls out with rumors, trade offers, and route warnings.",
        action: "Parley with the Wayfarer",
        reward: "Intel and backpack loot",
        mode: "wayfarer",
        stat: "lead",
        dread: 6
      };
    }
    return buildWorldEvent(zoneName, {
      title: "Encounter: " + (evt && evt.title ? evt.title : "District Surge"),
      text: evt && evt.text ? evt.text : "Unexpected district contact.",
      action: evt && evt.action ? evt.action : "Respond immediately",
      reward: "Immediate loot / control impact"
    });
  }

  function registerWorldAction(reason) {
    const w = ensureWorldState();
    if (!w) return false;
    w.activityClicks = (typeof w.activityClicks === "number" ? w.activityClicks : 0) + 1;
    if (w.activityClicks >= 10) {
      w.activityClicks = 0;
      advanceWorldThatWas(true);
      if (typeof showNotif === "function") {
        showNotif("World pressure built up. Control cycle advanced.", "good");
      }
      return true;
    }
    if (reason && typeof showNotif === "function") {
      showNotif("World activity: " + w.activityClicks + "/10", "good");
    }
    return false;
  }

  function getCredits() {
    if (typeof S === "undefined") return 0;
    return typeof S.credits === "number" ? S.credits : Number(S.credits || 0) || 0;
  }

  function syncCreditsUI() {
    if (typeof updateCreditsUI === "function") {
      updateCreditsUI();
      return;
    }
    if (typeof renderUI === "function") renderUI();
  }

  function setCredits(v) {
    if (typeof S === "undefined") return;
    const next = Math.max(0, Math.floor(Number(v) || 0));
    S.credits = next;
    syncCreditsUI();
  }

  function canAfford(cost) {
    return getCredits() >= cost;
  }

  function spendCredits(cost, reason) {
    if (!canAfford(cost)) {
      if (typeof showNotif === "function") showNotif("Not enough Credits for " + reason + ".", "warn");
      return false;
    }
    setCredits(getCredits() - cost);
    return true;
  }

  function ensurePowerRenown() {
    if (typeof S === "undefined") return;
    S.powerRenown = S.powerRenown || {};
    HOLDERS.forEach(function (name) {
      if (typeof S.powerRenown[name] !== "number") S.powerRenown[name] = 0;
    });
  }

  function addPowerRenown(power, amount) {
    ensurePowerRenown();
    if (typeof S === "undefined") return;
    const delta = Number(amount || 1);
    S.powerRenown[power] = (S.powerRenown[power] || 0) + delta;
    const factionKey = POWER_TO_FACTION_RENOWN[power];
    if (factionKey && typeof changeFactionRenown === "function") {
      changeFactionRenown(factionKey, delta);
    } else if (factionKey) {
      S.factionRenown = S.factionRenown || {};
      S.factionRenown[factionKey] = Math.max(-10, Math.min(12, Number(S.factionRenown[factionKey] || 0) + delta));
      if (typeof updateFactionRenownUI === "function") {
        try { updateFactionRenownUI(); } catch (err) { console.error(err); }
      }
    }
    if (typeof showNotif === "function") {
      const prefix = delta >= 0 ? "+" : "";
      showNotif(prefix + delta + " renown with " + power + ".", delta >= 0 ? "good" : "warn");
    }
  }

  function grantRandomLoot(tier) {
    let granted = [];
    if (typeof rollForLoot === "function") {
      try {
        const loot = rollForLoot(tier || "medium");
        if (Array.isArray(loot) && loot.length) granted = loot.slice(0, 1);
      } catch (err) { console.error(err); }
    }
    if (!granted.length) {
      granted = [getWtwFallbackLoot()];
    }
    const stored = granted.map(function (name) {
      const ok = putLootInBackpack(name);
      return ok ? name + " (Backpack)" : name + " (Backpack Full)";
    });
    if (typeof showNotif === "function") showNotif("Loot: " + stored.join(", "), "good");
    if (typeof window.tryAwardLoreBookDrop === 'function') window.tryAwardLoreBookDrop('world that was loot', 10);
    if (typeof renderUI === "function") renderUI();
    return granted;
  }

  function advanceWorldTime(reason) {
    if (typeof S === "undefined") return;
    S.day = (typeof S.day === "number" ? S.day : 1) + 1;
    if (typeof S.phase === "number") {
      S.phase = (S.phase + 1) % 4;
    }
    if (typeof showNotif === "function") showNotif("Time advanced: " + reason + ".", "good");
    if (typeof renderUI === "function") renderUI();
  }

  function getWorldDateTimeText() {
    if (typeof getGameDatePhaseText === "function") return getGameDatePhaseText();
    return "Month 1, Day 1, Year 1 — Morning";
  }

  function ensureWorldState() {
    if (typeof S === "undefined") return null;
    ensurePowerRenown();
    ensureWorldInventory();

    S.worldThatWas = S.worldThatWas || {};
    const w = S.worldThatWas;

    w.controllers = w.controllers || HOLDERS.slice();
    w.majorPowers = w.majorPowers || MAJOR_POWERS.slice();
    w.factions = w.factions || FACTIONS.slice();
    w.playerAlignedPower = w.playerAlignedPower || MAJOR_POWERS[0];

    w.hexes = Array.isArray(w.hexes) ? w.hexes : [];
    w.zones = Array.isArray(w.zones) ? w.zones : [];
    w.markers = w.markers || {};
    w.selectedHexId = w.selectedHexId || null;
    w.tick = typeof w.tick === "number" ? w.tick : 0;
    w.generated = !!w.generated;
    w.schemaVersion = typeof w.schemaVersion === "number" ? w.schemaVersion : 1;

    w.trainZones = Array.isArray(w.trainZones) ? w.trainZones : [];
    w.currentZone = w.currentZone || "Cyber Hub";
    if (typeof w.minimalMapMode === "string") {
      const modeText = w.minimalMapMode.trim().toLowerCase();
      w.minimalMapMode = modeText === "true" || modeText === "1" || modeText === "yes" || modeText === "on";
    } else {
      w.minimalMapMode = !!w.minimalMapMode;
    }
    w.clickMode = String(w.clickMode || "travel").toLowerCase();
    if (["travel", "inspect", "fog"].indexOf(w.clickMode) < 0) w.clickMode = "travel";
    w.storyObjectiveHexId = w.storyObjectiveHexId || null;
    w.ui = w.ui || {};
    w.ui.openAccordions = w.ui.openAccordions || {
      encounter: true,
      worldsystems: false,
      services: false,
      powertasks: false
    };

    w.holdings = Array.isArray(w.holdings) ? w.holdings : [];
    w.activeTasks = Array.isArray(w.activeTasks) ? w.activeTasks : [];
    w.activityClicks = typeof w.activityClicks === "number" ? w.activityClicks : 0;
    w.zoneReputation = w.zoneReputation || {};
    ZONE_NAMES.forEach(function (z) {
      if (typeof w.zoneReputation[z] !== "number") w.zoneReputation[z] = 0;
    });

    w.skirmishState = w.skirmishState || {
      activeHexId: null,
      round: 1,
      armyAStress: null,
      armyBStress: null,
      armyAActions: 2,
      armyBActions: 2,
      armyADread: null,
      armyBDread: null
    };

    // Migrate legacy world data (old 45-hex map) to the new 12x12 schema.
    if (w.schemaVersion < WTW_SCHEMA_VERSION || (Array.isArray(w.hexes) && w.hexes.length && w.hexes.length !== MAP_COLS * MAP_ROWS)) {
      w.hexes = [];
      w.zones = [];
      w.markers = {};
      w.generated = false;
      w.selectedHexId = null;
      w.trainZones = [];
      w.currentZone = "Cyber Hub";
      w.holdings = [];
      w.activeTasks = [];
      w.activityClicks = 0;
      w.zoneReputation = {};
      ZONE_NAMES.forEach(function (z) {
        w.zoneReputation[z] = 0;
      });
      w.skirmishState = {
        activeHexId: null,
        round: 1,
        armyAStress: null,
        armyBStress: null,
        armyAActions: 2,
        armyBActions: 2,
        armyADread: null,
        armyBDread: null
      };
    }
    w.schemaVersion = WTW_SCHEMA_VERSION;

    return w;
  }

  function buildDistrictNarrative(zoneName) {
    const zf = ZONE_FLAVOR[zoneName] || ZONE_FLAVOR["Cyber Hub"];
    const baseEvent = Object.assign({}, safePick(zf.events, zf.events[0]));
    return {
      location: safePick(zf.locations, "a contested district"),
      sight: safePick(zf.sights, "flickering lights"),
      description: safePick(zf.descriptions, "the district is unstable"),
      feature: safePick(zf.features, "survivors"),
      flora: safePick(zf.flora, "steel moss"),
      fauna: safePick(zf.fauna, "scrap hounds"),
      land: safePick(zf.land, "broken roads"),
      weather: safePick(zf.weather, "cold rain"),
      event: buildWorldEvent(zoneName, baseEvent)
    };
  }

  function mapZoneFromCoord(col, row) {
    const c = Math.floor(col / 4);
    const r = Math.floor(row / 4);
    const zoneIndex = r * 3 + c;
    return ZONE_NAMES[Math.max(0, Math.min(zoneIndex, ZONE_NAMES.length - 1))];
  }

  function districtName(zoneName, idx) {
    return zoneName + " District " + (idx + 1);
  }

  function setMarker(w, hex, type, title, subtitle) {
    if (!w || !hex || !type) return;
    const style = WTW_MARKER_STYLE[type] || WTW_MARKER_STYLE.task;
    const current = w.markers[hex.id];
    if (current && (current.priority || 0) > style.priority) return;
    w.markers[hex.id] = {
      type: type,
      title: title || style.title,
      subtitle: subtitle || "",
      priority: style.priority
    };
    hex.markerType = type;
  }

  function pickHexes(zoneHexes, count, blockedIds) {
    const blocked = blockedIds || {};
    const pool = (zoneHexes || []).filter(function (h) { return !blocked[h.id]; });
    const out = [];
    const max = Math.max(0, count || 0);
    while (pool.length && out.length < max) {
      const ix = safeRoll(pool.length) - 1;
      const chosen = pool.splice(ix, 1)[0];
      blocked[chosen.id] = true;
      out.push(chosen);
    }
    return out;
  }

  function createStructureForHex() {
    const kind = safePick(WTW_STRUCTURE_TYPES, WTW_STRUCTURE_TYPES[0]);
    return {
      kind: kind.kind,
      name: safePick(kind.names, kind.kind),
      roomPool: kind.rooms.slice(),
      generatedRooms: []
    };
  }

  function assignDistrictFeatures(w) {
    if (!w) return;
    w.hexes.forEach(function (hex) {
      hex.serviceNode = false;
      hex.landingPad = false;
      hex.hazard = null;
      hex.wayfarer = null;
      hex.structure = null;
    });

    w.zones.forEach(function (zone) {
      const zoneHexes = w.hexes.filter(function (h) { return h.zone === zone.name; });
      const blocked = {};

      const stationHex = zone.stationHexId ? w.hexes.find(function (h) { return h.id === zone.stationHexId; }) : null;
      if (stationHex) blocked[stationHex.id] = true;

      const pads = pickHexes(zoneHexes, 1, blocked);
      if (pads[0]) pads[0].landingPad = true;

      pickHexes(zoneHexes, 2, blocked).forEach(function (hex) { hex.serviceNode = true; });
      pickHexes(zoneHexes, 2, blocked).forEach(function (hex) {
        hex.wayfarer = {
          name: safePick(WTW_WAYFARER_NAMES, "Unknown Wayfarer"),
          rumor: safePick(WTW_WAYFARER_RUMORS, "Routes are shifting tonight."),
          history: safePick(WTW_WAYFARER_HISTORIES, "This district remembers old wars.")
        };
      });
      pickHexes(zoneHexes, 2, blocked).forEach(function (hex) {
        hex.hazard = Object.assign({}, safePick(WTW_HAZARDS, WTW_HAZARDS[0]));
      });
      pickHexes(zoneHexes, 2, blocked).forEach(function (hex) {
        hex.structure = createStructureForHex();
      });
    });
  }

  function generateStructureRooms(hex) {
    if (!hex || !hex.structure) return [];
    const site = hex.structure;
    const roomPool = Array.isArray(site.roomPool) && site.roomPool.length ? site.roomPool : ["Abandoned chamber with mixed salvage and notes."];
    const roomCount = 2 + safeRoll(3);
    const rooms = [];
    for (let i = 0; i < roomCount; i += 1) {
      rooms.push(safePick(roomPool, roomPool[0]));
    }
    site.generatedRooms = rooms;
    return rooms;
  }

  function ensureConditionsState() {
    if (!S) return;
    S.conditions = S.conditions || {};
    WTW_CONDITION_KEYS.forEach(function (key) {
      if (typeof S.conditions[key] !== "boolean") S.conditions[key] = false;
    });
  }

  function applyNegativeCondition(condKey) {
    ensureConditionsState();
    if (!S || !S.conditions) return;
    const key = WTW_CONDITION_KEYS.indexOf(condKey) >= 0 ? condKey : "weakened";
    S.conditions[key] = true;
    if (typeof updateConditionButtons === "function") updateConditionButtons();
    if (typeof updateAllStatDisplays === "function") updateAllStatDisplays();
  }

  function generateHoldings(w) {
    w.holdings = [];
    HOLDERS.forEach(function (power) {
      const names = HOLDING_NAMES[power] || [power + " Holding"];
      const zoneName = safePick(ZONE_NAMES, ZONE_NAMES[0]);
      const zoneHexes = w.hexes.filter(function (h) { return h.zone === zoneName; });
      const homeHex = safePick(zoneHexes, zoneHexes[0]);
      if (!homeHex) return;
      w.holdings.push({
        id: "holding-" + power.replace(/\s+/g, "-").toLowerCase(),
        power: power,
        name: safePick(names, names[0]),
        zone: zoneName,
        hexId: homeHex.id,
        mood: safePick(["Under pressure", "Prosperous", "Mobilizing", "Covert", "Defensive"], "Stable"),
        crisis: safePick(["Supply line interference", "Insider sabotage", "Skirmish spillover", "Power deficit", "Intel blackout"], "No crisis")
      });
    });
  }

  function generateWorldThatWasMap() {
    const w = ensureWorldState();
    if (!w) return;

    w.hexes = [];
    w.zones = [];

    const zoneBucket = {};
    ZONE_NAMES.forEach(function (z) {
      zoneBucket[z] = [];
      w.zones.push({
        name: z,
        color: ZONE_COLORS[z] || "#888",
        hexIds: [],
        controlBreakdown: {},
        leader: HOLDERS[0],
        stationHexId: null
      });
    });

    let idxByZone = {};
    ZONE_NAMES.forEach(function (z) { idxByZone[z] = 0; });

    for (let row = 0; row < MAP_ROWS; row += 1) {
      for (let col = 0; col < MAP_COLS; col += 1) {
        const zoneName = mapZoneFromCoord(col, row);
        const danger = dangerForZone(zoneName);
        const n = buildDistrictNarrative(zoneName);
        const hexId = "wtw-" + col + "-" + row;
        const hex = {
          id: hexId,
          zone: zoneName,
          type: "district",
          districtType: pickWorldDistrictType(zoneName),
          district: districtName(zoneName, idxByZone[zoneName]),
          districtIndex: idxByZone[zoneName],
          col: col,
          row: row,
          controller: safePick(HOLDERS, HOLDERS[0]),
          skirmish: safeRoll(100) <= getPactAdjustedSkirmishChance(zoneName),
          narrative: n,
          station: false,
          landingPad: false,
          serviceNode: false,
          hazard: null,
          wayfarer: null,
          structure: null,
          markerType: null,
          serviceRefresh: safeRoll(100) <= 55,
          encounter: null
        };
        idxByZone[zoneName] += 1;
        w.hexes.push(hex);
        zoneBucket[zoneName].push(hexId);
      }
    }

    w.zones.forEach(function (z) {
      z.hexIds = zoneBucket[z.name] || [];
    });

    assignTrainStations();
  assignDistrictFeatures(w);
    applyPactSkirmishDensityPressure(w, true);
    generateHoldings(w);
    syncWorldMarkers();
    updateZoneControl();

    if (S && S.worldInventory) {
      if ((S.worldInventory.water || 0) === 0) S.worldInventory.water = 2;
      if ((S.worldInventory.meds || 0) === 0) S.worldInventory.meds = 1;
      if ((S.worldInventory.dataDrives || 0) === 0) S.worldInventory.dataDrives = 1;
      if ((S.worldInventory.scrap || 0) === 0) S.worldInventory.scrap = 2;
      if ((S.worldInventory.fuelCells || 0) === 0) S.worldInventory.fuelCells = 1;
    }

    w.tick = 1;
    w.generated = true;
    w.currentZone = "Cyber Hub";
    const startHex = w.hexes.find(function (h) { return h.zone === w.currentZone; });
    w.selectedHexId = startHex ? startHex.id : (w.hexes[0] && w.hexes[0].id);

    renderWorldThatWas();
  }

  function assignTrainStations() {
    const w = ensureWorldState();
    if (!w) return;
    w.trainZones = [];

    w.hexes.forEach(function (h) { h.station = false; });

    w.zones.forEach(function (zone) {
      const zoneHexes = w.hexes.filter(function (h) { return h.zone === zone.name; });
      const stationHex = safePick(zoneHexes, zoneHexes[0]);
      if (stationHex) {
        stationHex.station = true;
        zone.stationHexId = stationHex.id;
        w.trainZones.push(zone.name);
      }
    });
  }

  function updateZoneControl() {
    const w = ensureWorldState();
    if (!w) return;

    w.zones.forEach(function (zone) {
      const counts = {};
      zone.hexIds.forEach(function (hexId) {
        const hex = w.hexes.find(function (h) { return h.id === hexId; });
        if (!hex) return;
        counts[hex.controller] = (counts[hex.controller] || 0) + 1;
      });
      zone.controlBreakdown = counts;

      let leader = HOLDERS[0];
      let top = -1;
      Object.keys(counts).forEach(function (name) {
        if (counts[name] > top) {
          top = counts[name];
          leader = name;
        }
      });
      zone.leader = leader;
    });
  }

  function syncWorldMarkers() {
    const w = ensureWorldState();
    if (!w || !w.hexes.length) return;

    w.markers = {};
    w.hexes.forEach(function (hex) {
      hex.markerType = null;
      if (hex.station) setMarker(w, hex, "station", "Rail Station", "Travel quickly between zones.");
      if (hex.landingPad) setMarker(w, hex, "landing", "Landing Pad", "Launch back to space from this district.");
      if (hex.serviceNode) setMarker(w, hex, "service", "Service Hub", "District services available here.");
      if (hex.structure) setMarker(w, hex, "structure", hex.structure.name || "Explorable Structure", "Enter and generate interior rooms.");
      if (hex.hazard) {
        setMarker(
          w,
          hex,
          hex.hazard.type || "hazard",
          hex.hazard.name || "District Hazard",
          hex.hazard.desc || "Dangerous district condition"
        );
      }
    });

    const missionPool = w.hexes.slice();
    function takeHex() {
      if (!missionPool.length) return null;
      const ix = safeRoll(missionPool.length) - 1;
      return missionPool.splice(ix, 1)[0];
    }

    (S.activeMissions || []).slice(0, 8).forEach(function (m) {
      if (!m || m.region !== "wtw") return;

      var steps = Array.isArray(m.steps) ? m.steps : [];
      var informerDone = !!(steps[1] && steps[1].completed);

      var siteHex = m.wtwSiteHexId ? (hexById(m.wtwSiteHexId) || null) : null;
      if (!siteHex && m.wtwHexId) siteHex = hexById(m.wtwHexId) || null;
      if (!siteHex) {
        siteHex = takeHex();
        if (siteHex) {
          m.wtwSiteHexId = siteHex.id;
          m.wtwHexId = siteHex.id;
        }
      }

      var informerHex = m.wtwInformerHexId ? (hexById(m.wtwInformerHexId) || null) : null;
      if (!informerHex && !informerDone) {
        informerHex = takeHex() || siteHex;
        if (informerHex) m.wtwInformerHexId = informerHex.id;
      }

      if (siteHex) {
        setMarker(
          w,
          siteHex,
          m.missionType === "legacy_raid" ? "mission_raid_site" : "mission_site",
          m.title || "Mission",
          m.missionType === "legacy_raid" ? "Raid confrontation marker active" : "Mission site objective active"
        );
      }
      if (!informerDone && informerHex) {
        setMarker(
          w,
          informerHex,
          m.missionType === "legacy_raid" ? "mission_raid_informer" : "mission_informer",
          m.title || "Mission",
          m.missionType === "legacy_raid" ? "Raid lore wing marker active" : "Find informer and gather intel"
        );
      }
    });

    w.activeTasks.slice(0, 8).forEach(function (t) {
      const hex = t.hexId ? hexById(t.hexId) : takeHex();
      if (!hex) return;
      setMarker(w, hex, "task", t.title, "Holding task");
    });

    if (w.storyObjectiveHexId) {
      const storyHex = hexById(w.storyObjectiveHexId);
      if (storyHex) {
        setMarker(w, storyHex, "story", "Story Objective", "Travel here to continue the storyline.");
      }
    }
    if (S && S.solarCycle && S.solarCycle.arcProgress && S.solarCycle.arcProgress.activeMarker && S.solarCycle.arcProgress.activeMarker.region === "wtw") {
      const solarHex = hexById(S.solarCycle.arcProgress.activeMarker.hexId || S.solarCycle.arcProgress.activeMarker.key);
      if (solarHex) {
      setMarker(w, solarHex, "solar_cycle_stage", "New Sun Stage", "Enter this district to trigger the next New Sun branch.");
      }
    }

    const scheduler = S && S.solarCycle && S.solarCycle.questScheduler;
    const schedulerMap = scheduler && scheduler.wtwQuestByHex && typeof scheduler.wtwQuestByHex === "object"
      ? scheduler.wtwQuestByHex
      : null;
    if (schedulerMap) {
      Object.keys(schedulerMap).forEach(function (hexId) {
        const qid = schedulerMap[hexId];
        const quest = scheduler.questById && qid ? scheduler.questById[qid] : null;
        if (!quest || quest.resolved || quest.expired) return;
        const target = hexById(Number(hexId));
        if (!target) return;
        setMarker(w, target, "solar_cycle_investigation", "New Sun Portal Quest", "Lost City portal handoff: investigate to reveal a New Sun route.");
      });
    }

    if (window.factionSystem && typeof window.factionSystem.syncBaseMarkers === "function") {
      window.factionSystem.syncBaseMarkers();
    }
    if (window.factionSystem && typeof window.factionSystem.getWTWMarker === "function") {
      w.hexes.forEach(function (hex) {
        const fb = window.factionSystem.getWTWMarker(hex.id);
        if (fb) {
          setMarker(w, hex, "faction_base", fb.baseName || "Faction Base", "Active faction base marker");
        }
      });
    }
    if (window.factionSystem && typeof window.factionSystem.getWTWTask === "function") {
      w.hexes.forEach(function (hex) {
        const ft = window.factionSystem.getWTWTask(hex.id);
        if (ft) {
          const subtitle = ft.monsterTask
            ? (ft.status === "combat_pending" ? "Monster encounter pending" : (ft.monsterSummary || "Monster encounter"))
            : "Valor check task";
          setMarker(w, hex, "faction_task", ft.title || "Wayfarer Task", subtitle);
        }
      });
    }

    w.hexes.forEach(function (hex) {
      if (!w.markers[hex.id] && hex.markerType === "job") {
        hex.markerType = null;
      }
    });
  }

  function controllerColor(name) {
    const majorIdx = MAJOR_POWERS.indexOf(name);
    if (majorIdx === 0) return "#6dc7ff";
    if (majorIdx === 1) return "#70d96f";
    if (majorIdx === 2) return "#f8bb57";
    const factionIdx = FACTIONS.indexOf(name);
    if (factionIdx === 0) return "#d870c5";
    if (factionIdx === 1) return "#d85a5a";
    return "#999";
  }

  function hexToPixel(col, row) {
    const width = Math.sqrt(3) * WTW_HEX;
    const height = WTW_HEX * 2;
    return {
      x: col * width + (row % 2) * (width / 2) + WTW_HEX + 20,
      y: row * height * 0.75 + WTW_HEX + 16
    };
  }

  function hexPoints(cx, cy) {
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = Math.PI / 180 * (60 * i - 30);
      pts.push((cx + WTW_HEX * Math.cos(a)) + "," + (cy + WTW_HEX * Math.sin(a)));
    }
    return pts.join(" ");
  }

  function normalizeTerrainAssetKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function getWorldTextureForHex(hex) {
    if (typeof window.getTerrainTileAsset !== 'function' || !hex) return '';
    const keys = [
      normalizeTerrainAssetKey(hex.districtType || ''),
      normalizeTerrainAssetKey(hex.zone || ''),
      normalizeTerrainAssetKey(hex.type || ''),
      'district'
    ];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!key) continue;
      const hit = String(window.getTerrainTileAsset('wtw', key) || '');
      if (hit.indexOf('data:image/') === 0) return hit;
    }
    return '';
  }

  function ensureWorldTexturePattern(svg, defs, id, dataUrl, tileSize) {
    if (!svg || !defs || !id || !dataUrl) return '';
    if (svg.querySelector('pattern[id="' + String(id).replace(/"/g, '') + '"]')) return 'url(#' + id + ')';
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', id);
    pattern.setAttribute('patternUnits', 'objectBoundingBox');
    pattern.setAttribute('patternContentUnits', 'objectBoundingBox');
    pattern.setAttribute('width', '1');
    pattern.setAttribute('height', '1');
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '1');
    image.setAttribute('height', '1');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    image.setAttribute('href', dataUrl);
    pattern.appendChild(image);
    defs.appendChild(pattern);
    return 'url(#' + id + ')';
  }

  function renderWorldThatWasMap() {
    const w = ensureWorldState();
    const svg = document.getElementById("wtwMapSvg");
    if (!svg || !w) return;
    const minimal = !!w.minimalMapMode;
    const hasWorldSelection = !!w.selectedHexId;
    const clickMode = getWorldMapClickMode();
    const selectedFogKey = w.selectedHexId ? String(w.selectedHexId) : "";
    const mapFx = (typeof window.getMapVisualSettings === "function")
      ? window.getMapVisualSettings()
      : { hex3d: false, overlay: "none" };

    if (!w.generated || !w.hexes.length) {
      svg.setAttribute("width", "900");
      svg.setAttribute("height", "740");
      if (typeof window.applyMapOverlayStyle === "function") window.applyMapOverlayStyle(svg, "wtw");
      svg.innerHTML = "<text x='400' y='240' text-anchor='middle' font-family='Cinzel,serif' font-size='14' fill='#2f4457'>Generate The World That Was to begin</text>";
      return;
    }

    const svgW = 980;
    const svgH = 980;
    svg.setAttribute("width", String(svgW));
    svg.setAttribute("height", String(svgH));
    svg.innerHTML = "";
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    const textureFillCache = {};
    const trackedScheduler = (S && S.solarCycle && S.solarCycle.questScheduler) ? S.solarCycle.questScheduler : null;
    const trackedWtwHexId = (trackedScheduler && String(trackedScheduler.trackedRegion || "") === "wtw")
      ? String(trackedScheduler.trackedLocationKey || "")
      : "";
    if (typeof window.applyMapOverlayStyle === "function") window.applyMapOverlayStyle(svg, "wtw");
    if (typeof window.ensureBackstoryScopeMarkers === "function") {
      window.ensureBackstoryScopeMarkers("wtw", w.hexes.map(function (h) {
        return { key: String(h.id), type: String(h.zone || "district"), label: String(h.zone || "District") };
      }), {});
    }

    const stationHexes = w.hexes.filter(function (h) { return h.station; });
    for (let i = 0; i < stationHexes.length; i += 1) {
      const a = stationHexes[i];
      const ga = { c: Math.floor(a.col / 4), r: Math.floor(a.row / 4) };
      const pa = hexToPixel(a.col, a.row);
      for (let j = i + 1; j < stationHexes.length; j += 1) {
        const b = stationHexes[j];
        const gb = { c: Math.floor(b.col / 4), r: Math.floor(b.row / 4) };
        const adjacent = (ga.c === gb.c && Math.abs(ga.r - gb.r) === 1) || (ga.r === gb.r && Math.abs(ga.c - gb.c) === 1);
        if (!adjacent) continue;
        const pb = hexToPixel(b.col, b.row);
        const rail = document.createElementNS("http://www.w3.org/2000/svg", "line");
        rail.setAttribute("x1", String(pa.x));
        rail.setAttribute("y1", String(pa.y));
        rail.setAttribute("x2", String(pb.x));
        rail.setAttribute("y2", String(pb.y));
        rail.setAttribute("stroke", "#7ed7ff");
        rail.setAttribute("stroke-opacity", minimal ? "0.42" : "0.62");
        rail.setAttribute("stroke-width", minimal ? "1.8" : "2.2");
        rail.setAttribute("stroke-dasharray", "4 3");
        rail.setAttribute("pointer-events", "none");
        svg.appendChild(rail);
      }
    }

    w.hexes.forEach(function (hex) {
      const p = hexToPixel(hex.col, hex.row);
      const zone = w.zones.find(function (z) { return z.name === hex.zone; });
      const marker = w.markers[hex.id];
      const isTrackedThreadHex = trackedWtwHexId && String(hex.id) === trackedWtwHexId;
      const r = WTW_HEX - 1;
      const fogHidden = (typeof window.isMapFogHexVisible === "function")
        ? !window.isMapFogHexVisible("wtw", String(hex.id), selectedFogKey)
        : false;

      const isSelected = w.selectedHexId === hex.id;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "svg-hex" + (isSelected ? " sel" : ""));

      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const textureKey = normalizeTerrainAssetKey(hex.districtType || '') + '|' + normalizeTerrainAssetKey(hex.zone || '') + '|' + normalizeTerrainAssetKey(hex.type || 'district');
      if (typeof textureFillCache[textureKey] === 'undefined') {
        const dataUrl = getWorldTextureForHex(hex);
        textureFillCache[textureKey] = dataUrl
          ? ensureWorldTexturePattern(svg, defs, 'wtwTexture' + textureKey.replace(/[^a-z0-9_]+/g, ''), dataUrl, Math.max(24, Math.floor(WTW_HEX * 1.15)))
          : '';
      }
      poly.setAttribute("points", hexPoints(p.x, p.y));
      poly.setAttribute("fill", textureFillCache[textureKey] || (minimal ? "rgba(16,22,30,.92)" : "rgba(20,28,34,.85)"));
      poly.setAttribute("stroke", zone ? zone.color : "#8e8e8e");
      poly.setAttribute("stroke-opacity", minimal ? (isSelected ? "1" : ".58") : "1");
      poly.setAttribute("stroke-width", isSelected ? "2.6" : (minimal ? "1" : (mapFx.hex3d ? "1.7" : "1.2")));
      g.appendChild(poly);

      // Province-style barrier presentation: draw the barrier on the edge of the hex instead of center icon.
      if (marker && marker.type === "barrier") {
        const side = Math.abs(Number(hex.col || 0) * 13 + Number(hex.row || 0) * 7) % 6;
        const a1 = ((60 * side) - 30) * Math.PI / 180;
        const a2 = ((60 * (side + 1)) - 30) * Math.PI / 180;
        const bx1 = p.x + r * Math.cos(a1);
        const by1 = p.y + r * Math.sin(a1);
        const bx2 = p.x + r * Math.cos(a2);
        const by2 = p.y + r * Math.sin(a2);

        const barrierEdge = document.createElementNS("http://www.w3.org/2000/svg", "line");
        barrierEdge.setAttribute("x1", String(bx1));
        barrierEdge.setAttribute("y1", String(by1));
        barrierEdge.setAttribute("x2", String(bx2));
        barrierEdge.setAttribute("y2", String(by2));
        barrierEdge.setAttribute("stroke", "#ff9066");
        barrierEdge.setAttribute("stroke-width", w.selectedHexId === hex.id ? "4.5" : "3.4");
        barrierEdge.setAttribute("stroke-linecap", "round");
        barrierEdge.setAttribute("pointer-events", "none");
        g.appendChild(barrierEdge);
      }

      if (mapFx.hex3d) {
        const topA = Math.PI / 180 * -30;
        const topB = Math.PI / 180 * 30;
        const rightA = Math.PI / 180 * 30;
        const rightB = Math.PI / 180 * 90;
        const hi = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hi.setAttribute("x1", String(p.x + r * Math.cos(topA)));
        hi.setAttribute("y1", String(p.y + r * Math.sin(topA)));
        hi.setAttribute("x2", String(p.x + r * Math.cos(topB)));
        hi.setAttribute("y2", String(p.y + r * Math.sin(topB)));
        hi.setAttribute("stroke", "rgba(255,255,255,.2)");
        hi.setAttribute("stroke-width", "1.1");
        hi.setAttribute("pointer-events", "none");
        g.appendChild(hi);

        const sh = document.createElementNS("http://www.w3.org/2000/svg", "line");
        sh.setAttribute("x1", String(p.x + r * Math.cos(rightA)));
        sh.setAttribute("y1", String(p.y + r * Math.sin(rightA)));
        sh.setAttribute("x2", String(p.x + r * Math.cos(rightB)));
        sh.setAttribute("y2", String(p.y + r * Math.sin(rightB)));
        sh.setAttribute("stroke", "rgba(0,0,0,.28)");
        sh.setAttribute("stroke-width", "1.1");
        sh.setAttribute("pointer-events", "none");
        g.appendChild(sh);
      }

      const owner = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      owner.setAttribute("cx", String(p.x));
      owner.setAttribute("cy", String(p.y));
      owner.setAttribute("r", minimal ? "4.6" : "5.5");
      owner.setAttribute("fill", controllerColor(hex.controller));
      owner.setAttribute("stroke", "#111");
      owner.setAttribute("stroke-width", "1");
      owner.setAttribute("pointer-events", "none");
      g.appendChild(owner);

      if (hex.skirmish && (!minimal || w.selectedHexId === hex.id)) {
        const sk = document.createElementNS("http://www.w3.org/2000/svg", "text");
        sk.setAttribute("x", String(p.x - 12));
        sk.setAttribute("y", String(p.y - 7));
        sk.setAttribute("font-size", "11");
        sk.setAttribute("fill", "#e05050");
        sk.setAttribute("pointer-events", "none");
        sk.textContent = "X";
        g.appendChild(sk);
      }

      if (hex.station && (!minimal || w.selectedHexId === hex.id)) {
        const st = document.createElementNS("http://www.w3.org/2000/svg", "text");
        st.setAttribute("x", String(p.x - 10));
        st.setAttribute("y", String(p.y + 15));
        st.setAttribute("font-size", "8.5");
        st.setAttribute("fill", "#7ed7ff");
        st.setAttribute("pointer-events", "none");
        st.textContent = "Rail";
        g.appendChild(st);
      }

      if (w.selectedHexId === hex.id) {
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", String(p.x));
        ring.setAttribute("cy", String(p.y));
        ring.setAttribute("r", minimal ? "15" : "18");
        ring.setAttribute("fill", "rgba(232,192,80,.1)");
        ring.setAttribute("stroke", "#f0d070");
        ring.setAttribute("stroke-width", "1.7");
        ring.setAttribute("pointer-events", "none");
        g.appendChild(ring);

        const you = document.createElementNS("http://www.w3.org/2000/svg", "text");
        you.setAttribute("x", String(p.x));
        you.setAttribute("y", String(p.y - 18));
        you.setAttribute("text-anchor", "middle");
        you.setAttribute("font-size", "7");
        you.setAttribute("fill", "#f0d070");
        you.setAttribute("pointer-events", "none");
        you.textContent = "YOU";
        g.appendChild(you);
      }

      const showMarker = marker && marker.type !== "barrier" && (!minimal || w.selectedHexId === hex.id || marker.type === "mission" || marker.type === "mission_informer" || marker.type === "mission_site" || marker.type === "mission_raid_informer" || marker.type === "mission_raid_site" || marker.type === "task" || marker.type === "story" || marker.type === "solar_cycle" || marker.type === "solar_cycle_stage" || marker.type === "solar_cycle_investigation" || marker.type === "solar_cycle_omen" || marker.type === "solar_cycle_side" || marker.type === "faction_base" || marker.type === "faction_task");
      if (showMarker) {
        const markerStyle = WTW_MARKER_STYLE[marker.type] || WTW_MARKER_STYLE.task;
        if (isTrackedThreadHex) {
          const haloOuter = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          haloOuter.setAttribute("cx", String(p.x));
          haloOuter.setAttribute("cy", String(p.y));
          haloOuter.setAttribute("r", "14");
          haloOuter.setAttribute("fill", "rgba(240,208,112,.06)");
          haloOuter.setAttribute("stroke", "rgba(240,208,112,.9)");
          haloOuter.setAttribute("stroke-width", "1.4");
          haloOuter.setAttribute("pointer-events", "none");
          const pulse = document.createElementNS("http://www.w3.org/2000/svg", "animate");
          pulse.setAttribute("attributeName", "r");
          pulse.setAttribute("values", "12;18;12");
          pulse.setAttribute("dur", "1.8s");
          pulse.setAttribute("repeatCount", "indefinite");
          haloOuter.appendChild(pulse);
          const pulseOpacity = document.createElementNS("http://www.w3.org/2000/svg", "animate");
          pulseOpacity.setAttribute("attributeName", "stroke-opacity");
          pulseOpacity.setAttribute("values", "0.9;0.2;0.9");
          pulseOpacity.setAttribute("dur", "1.8s");
          pulseOpacity.setAttribute("repeatCount", "indefinite");
          haloOuter.appendChild(pulseOpacity);
          g.appendChild(haloOuter);
        }

        const mk = document.createElementNS("http://www.w3.org/2000/svg", "text");
        mk.setAttribute("x", String(p.x + 8));
        mk.setAttribute("y", String(p.y - 8));
        mk.setAttribute("font-size", (marker.type === "solar_cycle" || marker.type === "solar_cycle_side" || marker.type === "solar_cycle_stage" || marker.type === "solar_cycle_investigation" || marker.type === "solar_cycle_omen") ? "13" : "10");
        mk.setAttribute("fill", markerStyle.color || "#bbbbbb");
        if (marker.type === "solar_cycle" || marker.type === "solar_cycle_side" || marker.type === "solar_cycle_stage" || marker.type === "solar_cycle_investigation" || marker.type === "solar_cycle_omen") {
          mk.setAttribute("stroke", "rgba(10,14,20,.9)");
          mk.setAttribute("stroke-width", "0.9");
        }
        mk.setAttribute("pointer-events", "none");
        mk.textContent = markerStyle.icon || "$";
        g.appendChild(mk);

        if (isTrackedThreadHex) {
          const tag = document.createElementNS("http://www.w3.org/2000/svg", "text");
          tag.setAttribute("x", String(p.x));
          tag.setAttribute("y", String(p.y - 22));
          tag.setAttribute("text-anchor", "middle");
          tag.setAttribute("font-size", "6.5");
          tag.setAttribute("fill", "#f0d070");
          tag.setAttribute("pointer-events", "none");
          tag.textContent = "TRACKED";
          g.appendChild(tag);
        }
      }

      const bsMarker = (typeof window.getBackstoryMapMarker === "function")
        ? window.getBackstoryMapMarker("wtw", String(hex.id))
        : null;
      if (bsMarker) {
        const bsGlow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bsGlow.setAttribute("cx", String(p.x + 12));
        bsGlow.setAttribute("cy", String(p.y + 12));
        bsGlow.setAttribute("r", "7");
        bsGlow.setAttribute("fill", "rgba(123,154,255,.16)");
        bsGlow.setAttribute("stroke", "#7b9aff");
        bsGlow.setAttribute("stroke-width", "1.1");
        bsGlow.setAttribute("pointer-events", "none");
        g.appendChild(bsGlow);

        const bsIcon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        bsIcon.setAttribute("x", String(p.x + 12));
        bsIcon.setAttribute("y", String(p.y + 16));
        bsIcon.setAttribute("text-anchor", "middle");
        bsIcon.setAttribute("font-size", "9");
        bsIcon.setAttribute("fill", "#9db3ff");
        bsIcon.setAttribute("pointer-events", "none");
        bsIcon.textContent = bsMarker.icon || "✶";
        g.appendChild(bsIcon);
      }

      if (fogHidden) {
        const fog = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        fog.setAttribute("points", hexPoints(p.x, p.y));
        fog.setAttribute("fill", "rgba(6,10,16,.84)");
        fog.setAttribute("stroke", "rgba(108,124,148,.35)");
        fog.setAttribute("stroke-width", "1");
        fog.setAttribute("pointer-events", "none");
        g.appendChild(fog);

        const q = document.createElementNS("http://www.w3.org/2000/svg", "text");
        q.setAttribute("x", String(p.x));
        q.setAttribute("y", String(p.y + 4));
        q.setAttribute("text-anchor", "middle");
        q.setAttribute("font-family", "Rajdhani,sans-serif");
        q.setAttribute("font-size", "12");
        q.setAttribute("fill", "rgba(201,214,240,.65)");
        q.setAttribute("pointer-events", "none");
        q.textContent = "?";
        g.appendChild(q);
      }

      g.addEventListener("click", function () {
        if (clickMode === "fog") {
          w.selectedHexId = hex.id;
          if (typeof window.revealMapFogHex === "function") window.revealMapFogHex("wtw", String(hex.id));
          renderWorldThatWas();
          if (typeof showNotif === "function") showNotif("World fog revealed at " + String(hex.zone || hex.id) + ".", "good");
          return;
        }
        if (clickMode === "inspect") {
          w.selectedHexId = hex.id;
          renderWorldThatWas();
          return;
        }
        const currentHex = w.selectedHexId ? hexById(w.selectedHexId) : null;
        const crossingIntoBarrier = !!(hex && hex.hazard && hex.hazard.type === "barrier" && (!currentHex || currentHex.id !== hex.id));
        if (crossingIntoBarrier) {
          if (typeof openModal === "function") {
            openModal(
              "Barrier Check Required",
              "<div style='font-size:.82rem;color:var(--text2);line-height:1.6;'><strong>⛔ " + String(hex.hazard.name || "Barrier") + "</strong><br>Crossing this boundary requires <strong>Body vs DD6</strong>.<br><br><button class='btn btn-xs btn-warn' onclick='resolveWtwBarrierCrossing(\"" + String(hex.id) + "\");if(typeof closeModal===\"function\")closeModal();'>⚄ Attempt Crossing (Body vs DD6)</button></div>"
            );
          } else if (typeof showNotif === "function") {
            showNotif("Barrier check required before crossing.", "warn");
          }
          return;
        }
        w.selectedHexId = hex.id;
        if (typeof window.rollRivalEncounterForMap === "function") {
          window.rollRivalEncounterForMap("wtw", {
            key: String(hex.id),
            label: String(hex.zone || "District"),
            terrain: String(hex.zone || "district")
          });
        }
        renderWorldThatWas();
        if (typeof window.maybeAutoOpenSolarCycleWTW === "function") {
          window.maybeAutoOpenSolarCycleWTW();
        }
      });

      svg.appendChild(g);
    });
  }

  function toggleWorldMapMode() {
    const w = ensureWorldState();
    if (!w) return;
    w.minimalMapMode = !w.minimalMapMode;
    renderWorldThatWas();
    if (typeof showNotif === "function") {
      showNotif("World map mode: " + (w.minimalMapMode ? "Minimal" : "Detailed") + ".", "good");
    }
  }

  function getWorldMapClickMode() {
    const w = ensureWorldState();
    if (!w) return "travel";
    const mode = String(w.clickMode || "travel").toLowerCase();
    w.clickMode = ["travel", "inspect", "fog"].indexOf(mode) >= 0 ? mode : "travel";
    return w.clickMode;
  }

  function updateWorldMapClickModeUI() {
    const btn = document.getElementById("wtwMapClickModeBtn");
    const mode = getWorldMapClickMode();
    if (!btn) return;
    const label = mode === "travel" ? "Travel" : (mode === "inspect" ? "Inspect" : "Fog");
    btn.textContent = "Map Mode: " + label;
    if (mode === "travel" || mode === "fog") btn.classList.add("btn-teal");
    else btn.classList.remove("btn-teal");
  }

  function toggleWorldMapClickMode() {
    const w = ensureWorldState();
    if (!w) return;
    const order = ["travel", "inspect", "fog"];
    const current = getWorldMapClickMode();
    const idx = order.indexOf(current);
    w.clickMode = order[(idx + 1) % order.length];
    if (typeof window.getMapFogConfig === "function") {
      window.getMapFogConfig("wtw").enabled = w.clickMode === "fog";
    }
    renderWorldThatWas();
    if (typeof showNotif === "function") {
      showNotif(
        w.clickMode === "travel"
          ? "World map clicks now travel and trigger encounters."
          : (w.clickMode === "inspect" ? "World map clicks now inspect only." : "World map clicks now reveal fog."),
        "good"
      );
    }
  }

  function getSelectedHex() {
    const w = ensureWorldState();
    if (!w) return null;
    return w.hexes.find(function (hex) { return hex.id === w.selectedHexId; }) || null;
  }

  function zoneForHex(hex) {
    const w = ensureWorldState();
    return w.zones.find(function (z) { return z.name === hex.zone; });
  }

  function zoneServicesForHex(hex) {
    if (!hex || !hex.serviceNode) return [];
    const z = zoneForHex(hex);
    if (!z) return [];
    const total = z.hexIds.length || 1;
    const owned = z.controlBreakdown[z.leader] || 0;
    const dominance = owned / total;

    const base = (ZONE_SERVICES[z.name] || []).slice();
    base.push({ name: "Merchant Colony Exchange", cost: 55, desc: "Planetary merchant-colony brokers trade route intel and specialty stock." });
    const power = (POWER_SERVICES[z.leader] || []).slice();

    return dominance >= 0.5 ? base.concat(power) : base.concat(power.slice(0, 1));
  }

  function hexById(hexId) {
    const w = ensureWorldState();
    if (!w) return null;
    return w.hexes.find(function (h) { return h.id === hexId; }) || null;
  }

  function applyWorldServiceEffect(hex, svc) {
    const w = ensureWorldState();
    if (!w || !hex || !svc) return false;
    const name = String(svc.name || "").toLowerCase();

    if (name.indexOf("data forge") >= 0) {
      addWorldItem("dataDrives", 2);
      addZoneReputation(hex.zone, 2);
      grantWorldServiceBonus("nextValorBonus", 2, 6);
      applyPositiveCondition("focused");
      putLootInBackpack(drawServiceMerchantItem(["items", "toolkits", "tradegoods"]));
      if (typeof showNotif === "function") showNotif("Data Forge: Focused, +2 Data Drives, next Valor +2, and intel gear added to backpack.", "good");
      return true;
    }

    if (name.indexOf("augment tune-up") >= 0 || name.indexOf("cyber") >= 0) {
      setCredits(getCredits() + 35);
      grantWorldServiceBonus("nextValorBonus", 1, 6);
      applyPositiveCondition("empowered");
      putLootInBackpack("Cyber Calibration Kit");
      if (typeof showNotif === "function") showNotif("Augment service: Empowered, +35 Credits, next Valor +1, and Cyber Calibration Kit added.", "good");
      return true;
    }

    if (name.indexOf("botanical therapy") >= 0) {
      if (typeof changeStress === "function") changeStress(-Math.max(3, safeRoll(6)));
      const removed = clearOneNegativeCondition();
      applyPositiveCondition("bolstered");
      addZoneReputation(hex.zone, 1);
      putLootInBackpack("Verdant Tonic");
      if (typeof showNotif === "function") showNotif("Botanical Therapy: recovered stress, Bolstered applied" + (removed ? (", removed " + removed + ".") : "."), "good");
      return true;
    }

    if (name.indexOf("gene med") >= 0 || name.indexOf("rad clinic") >= 0) {
      if (typeof changeStress === "function") changeStress(-Math.max(2, safeRoll(4)));
      if (typeof S !== "undefined" && typeof S.trauma === "number" && S.trauma > 0) {
        S.trauma = Math.max(0, S.trauma - 1);
        if (typeof updateTrauma === "function") updateTrauma();
      }
      addWorldItem("meds", 2);
      putLootInBackpack(drawServiceMerchantItem(["remedies", "items"]));
      if (typeof showNotif === "function") showNotif("Clinic treatment: stress restored, -1 Trauma, and medical supplies added.", "good");
      return true;
    }

    if (name.indexOf("med") >= 0 || name.indexOf("therapy") >= 0 || name.indexOf("recovery") >= 0) {
      const hadWater = spendWorldItem("water", 1);
      if (typeof changeStress === "function") changeStress(-Math.max(2, safeRoll(4)));
      addWorldItem("meds", 1);
      addZoneReputation(hex.zone, 1);
      putLootInBackpack("Medical Patch");
      grantWorldServiceBonus("nextValorBonus", 1, 6);
      if (typeof showNotif === "function") showNotif("Service effect: recovered stress, added Medical Patch, next Valor +1.", "good");
      if (!hadWater && typeof showNotif === "function") showNotif("No Water consumed. Clinic supplied emergency reserves.", "good");
      return true;
    }

    if (name.indexOf("intel") >= 0 || name.indexOf("data") >= 0 || name.indexOf("courier") >= 0 || name.indexOf("signal") >= 0) {
      spendWorldItem("dataDrives", 1);
      const target = safePick(w.hexes.filter(function (h) { return h.id !== hex.id; }), null);
      if (target) {
        setMarker(w, target, "task", "Intel Lead", "Service generated this lead");
      }
      addWorldItem("scrap", 1);
      addZoneReputation(hex.zone, 1);
      putLootInBackpack("Intel Packet");
      grantWorldServiceBonus("nextValorBonus", 2, 6);
      if (typeof showNotif === "function") showNotif("Service effect: spawned intel lead, added Intel Packet, next Valor +2.", "good");
      return true;
    }

    if (name.indexOf("security") >= 0 || name.indexOf("militia") >= 0 || name.indexOf("ward") >= 0) {
      spendWorldItem("fuelCells", 1);
      hex.skirmish = false;
      const zone = zoneForHex(hex);
      if (zone && zone.leader) hex.controller = zone.leader;
      addZoneReputation(hex.zone, 2);
      putLootInBackpack("Ward Sigil");
      grantWorldServiceBonus("nextValorBonus", 1, 6);
      if (typeof showNotif === "function") showNotif("Service effect: district stabilized, added Ward Sigil, next Valor +1.", "good");
      return true;
    }

    if (name.indexOf("convoy routing") >= 0) {
      grantWorldServiceBonus("nextTradeBonus", 2, 6);
      addZoneReputation(hex.zone, 1);
      const target = safePick(w.hexes.filter(function (h) { return h.id !== hex.id; }), null);
      if (target) setMarker(w, target, "task", "Convoy Lane", "Service-generated route lead");
      putLootInBackpack("Route Warrant");
      if (typeof showNotif === "function") showNotif("Convoy Routing: next Trade +2, route lead marker spawned, Route Warrant added.", "good");
      return true;
    }

    if (name.indexOf("vr drill") >= 0) {
      applyPositiveCondition("empowered");
      grantWorldServiceBonus("nextValorBonus", 1, 6);
      setCredits(getCredits() + 20);
      if (typeof showNotif === "function") showNotif("VR Drill: Empowered, next Valor +1, and +20 Credits.", "good");
      return true;
    }

    if (name.indexOf("holo venue") >= 0 || name.indexOf("night market") >= 0) {
      addZoneReputation(hex.zone, 1);
      putLootInBackpack(drawServiceMerchantItem(["tradegoods", "services", "items"]));
      setCredits(getCredits() + 25);
      if (typeof showNotif === "function") showNotif("Market access: gained social leverage, +25 Credits, and a market item.", "good");
      return true;
    }

    if (name.indexOf("water purification") >= 0) {
      addWorldItem("water", 2);
      const removed = clearOneNegativeCondition();
      if (typeof showNotif === "function") showNotif("Water Purification: +2 Water" + (removed ? (" and removed " + removed + ".") : "."), "good");
      return true;
    }

    if (name.indexOf("safehouse") >= 0) {
      hex.skirmish = false;
      addZoneReputation(hex.zone, 1);
      putLootInBackpack("Safehouse Access Key");
      if (typeof showNotif === "function") showNotif("Safehouse Access: district calmed and Safehouse Key added.", "good");
      return true;
    }

    if (name.indexOf("repair") >= 0 || name.indexOf("maintenance") >= 0 || name.indexOf("forge") >= 0 || name.indexOf("dock") >= 0) {
      spendWorldItem("scrap", 1);
      setCredits(getCredits() + 40);
      addWorldItem("fuelCells", 1);
      addZoneReputation(hex.zone, 1);
      putLootInBackpack("Refit Kit");
      if (typeof showNotif === "function") showNotif("Service effect: +40 Credits, +1 Fuel Cell, and Refit Kit added.", "good");
      return true;
    }

    addWorldItem("water", 1);
    addWorldItem("scrap", 1);
    addZoneReputation(hex.zone, 1);
    grantRandomLoot("easy");
    putLootInBackpack("District Salvage");
    if (typeof showNotif === "function") showNotif("Service effect: recovered district salvage and backpack loot.", "good");
    return true;
  }

  function spendService(hexId, serviceIdx) {
    const w = ensureWorldState();
    if (!w) return;
    const hex = w.hexes.find(function (h) { return h.id === hexId; });
    if (!hex) return;
    const services = zoneServicesForHex(hex);
    const svc = services[serviceIdx];
    if (!svc) return;
    if (!spendCredits(svc.cost, svc.name)) return;

    const ok = applyWorldServiceEffect(hex, svc);
    if (!ok) {
      setCredits(getCredits() + svc.cost);
      return;
    }
    if (window.TrophySystem) window.TrophySystem.check('first_service');

    if (hex.serviceRefresh && safeRoll(100) <= 25) {
      hex.narrative.event = buildWorldEvent(hex.zone, safePick((ZONE_FLAVOR[hex.zone] || ZONE_FLAVOR["Cyber Hub"]).events, hex.narrative.event));
      if (typeof showNotif === "function") showNotif("District activity changed after service interaction.", "good");
    }

    advanceWorldTime("service action");
    updateZoneControl();
    if (registerWorldAction("service")) return;
    renderWorldThatWas();
  }

  function worldCelebrationEvents() {
    return [
      { name: 'District Parade', dd: 6, success: '+1 Teamwork and stronger local ties.', failure: 'Mental Stress equals failed difference from unrest.' },
      { name: 'Street Tournament', dd: 8, success: '+50 Credits from wagers.', failure: 'Health damage equals failed difference in the ring.' },
      { name: 'Archive Salon', dd: 6, success: 'Gain Focused for your next challenge.', failure: 'Mental Stress equals failed difference from data overload.' },
    ];
  }

  function rollWorldCelebrationEvent(hexId) {
    if (window.campaignSystem && typeof window.campaignSystem.guardSharedWorldMutation === 'function' && !window.campaignSystem.guardSharedWorldMutation('Only the GM can roll shared district downtime in Campaign mode.')) return;
    var hex = hexById(hexId);
    if (!hex) return;
    hex.pendingServiceCelebration = safePick(worldCelebrationEvents(), worldCelebrationEvents()[0]);
    if (typeof showNotif === 'function') showNotif('Celebration event rolled: ' + hex.pendingServiceCelebration.name, 'good');
    renderWorldThatWas();
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
      setTimeout(function () {
        try {
          var out = window.campaignSystem.syncSharedSilent('wtw-celebration-roll');
          if (out && typeof out.catch === 'function') out.catch(function () {});
        } catch (_err) { console.error(_err); }
      }, 0);
    }
  }

  function resolveWorldCelebrationEvent(hexId, statKey) {
    if (window.campaignSystem && typeof window.campaignSystem.guardSharedWorldMutation === 'function' && !window.campaignSystem.guardSharedWorldMutation('Only the GM can resolve shared district downtime in Campaign mode.')) return;
    var hex = hexById(hexId);
    if (!hex || !hex.pendingServiceCelebration) return;
    var evt = hex.pendingServiceCelebration;
    var key = String(statKey || 'lead').toLowerCase();
    var check = rollAgainstDread(key, evt.dd || 6);
    if (check.success) {
      if (evt.name === 'District Parade' && typeof changeCounter === 'function') changeCounter('tmw', 1);
      if (evt.name === 'Street Tournament') setCredits(getCredits() + 50);
      if (evt.name === 'Archive Salon' && typeof toggleCond === 'function' && S.conditions && !S.conditions.focused) toggleCond('focused');
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      if (typeof showNotif === 'function') showNotif(evt.name + ' success: ' + evt.success, 'good');
    } else {
      var failedBy = Math.max(1, Number(check.dreadTotal || 0) - Number(check.actionTotal || 0));
      if (evt.name === 'Street Tournament' && typeof changeHealth === 'function') changeHealth(failedBy);
      else if (typeof changeMentalStress === 'function') changeMentalStress(failedBy);
      if (typeof addTMWOnFail === 'function') addTMWOnFail('world-celebration-failure', { failedBy: failedBy, actionDie: Number(check.vd || 4), dreadDie: Number(check.dd || evt.dd || 6) });
      if (typeof showNotif === 'function') showNotif(evt.name + ' failed: ' + evt.failure, 'warn');
    }
    hex.pendingServiceCelebration = null;
    renderWorldThatWas();
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
      setTimeout(function () {
        try {
          var out = window.campaignSystem.syncSharedSilent('wtw-celebration-resolve');
          if (out && typeof out.catch === 'function') out.catch(function () {});
        } catch (_err) { console.error(_err); }
      }, 0);
    }
  }

  function isWtwManualRollModeEnabled() {
    return !!(window.settingsSystem && typeof window.settingsSystem.isManualRollMode === 'function' && window.settingsSystem.isManualRollMode());
  }

  function stepWtwManualDreadDie(current) {
    const chain = [4, 6, 8, 10, 12, 20];
    const die = Math.max(4, Number(current || 6));
    let idx = chain.indexOf(die);
    if (idx < 0) idx = 1;
    return chain[Math.min(chain.length - 1, idx + 1)];
  }

  function openWtwManualActionDreadPrompt(config) {
    if (typeof openModal !== 'function') return false;
    const cfg = config || {};
    const title = String(cfg.title || 'Manual Roll');
    const context = String(cfg.context || title);
    const statKey = String(cfg.statKey || 'valor').toLowerCase();
    const statLabel = String(cfg.statLabel || statLabel(statKey));
    const actionDie = Math.max(4, Number(cfg.actionDie || ((typeof getEffectiveDie === 'function') ? getEffectiveDie(statKey) : 6) || 6));
    const dreadDie = Math.max(4, Number(cfg.dreadDie || 6));
    const advantageLabel = String(cfg.advantageLabel || 'Advantage total (optional)');
    const bonus1Label = String(cfg.bonus1Label || 'Bonus total 1 (optional)');
    const bonus2Label = String(cfg.bonus2Label || 'Bonus total 2 (optional)');
    const compareHint = String(cfg.compareHint || 'Compare uses max(Base, Advantage) + Bonus 1 + Bonus 2 vs Dread. Leave optional fields empty to use Base vs Dread.');
    const tmw = Math.max(0, Number((S && S.tmw) || 0));
    const pushDread = stepWtwManualDreadDie(dreadDie);
    const callerLines = Array.isArray(cfg.modifierLines) ? cfg.modifierLines.filter(Boolean) : [];
    const modifierLines = (typeof window !== 'undefined' && typeof window.buildManualRollModifierLines === 'function')
      ? (window.buildManualRollModifierLines(statKey, actionDie, { extraLines: ['Enter final totals after applying all listed modifiers.'].concat(callerLines) }) || [])
      : callerLines;
    const modifiersHtml = modifierLines.length
      ? '<div style="font-size:.72rem;color:var(--muted2);margin-top:.15rem;line-height:1.5;">' + modifierLines.map(function(p){ return '<div>• ' + p + '</div>'; }).join('') + '</div>'
      : '';

    window._pendingWtwManualActionCheck = {
      statKey: statKey,
      statLabel: statLabel,
      actionDie: actionDie,
      dreadDie: dreadDie,
      resolver: (typeof cfg.onResolve === 'function') ? cfg.onResolve : null
    };

    const html = ""
      + "<div style='font-size:.84rem;color:var(--text2);line-height:1.6;'>"
      + "<div style='font-family:Cinzel,serif;font-size:.78rem;letter-spacing:.08em;color:var(--gold2);margin-bottom:.28rem;'>" + context + "</div>"
      + "<div><strong>" + statLabel + " d" + actionDie + "</strong> vs <strong style='color:var(--red2);'>Dread d" + dreadDie + "</strong></div>"
      + "<div style='font-size:.72rem;color:var(--muted2);margin-top:.12rem;'>Reminder: Base, Advantage, and Dread dice all explode on max. Example d6 = 6, roll again and add. Enter exploded totals as needed.</div>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:.32rem;margin-top:.4rem;'>"
      + "<div><div style='font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;'>" + statLabel + " d" + actionDie + " (base total)</div><input type='text' inputmode='text' id='wtwManualActionValue' placeholder='e.g. 8+7' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;'></div>"
      + "<div><div style='font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;'>Dread d" + dreadDie + " (total)</div><input type='text' inputmode='text' id='wtwManualDreadValue' placeholder='e.g. 7+3+1' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;'></div>"
      + "</div>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:.32rem;margin-top:.3rem;'>"
      + "<div><div style='font-size:.68rem;color:var(--muted2);margin-bottom:.14rem;'>" + advantageLabel + "</div><input type='text' inputmode='text' id='wtwManualAdvValue' placeholder='optional' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.8rem;border-radius:3px;'></div>"
      + "<div><div style='font-size:.68rem;color:var(--muted2);margin-bottom:.14rem;'>" + bonus1Label + "</div><input type='text' inputmode='text' id='wtwManualBonus1Value' placeholder='optional' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.8rem;border-radius:3px;'></div>"
      + "<div><div style='font-size:.68rem;color:var(--muted2);margin-bottom:.14rem;'>" + bonus2Label + "</div><input type='text' inputmode='text' id='wtwManualBonus2Value' placeholder='optional' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.8rem;border-radius:3px;'></div>"
      + "</div>"
      + "<div id='wtwManualCompareMath' style='margin-top:.24rem;font-size:.72rem;color:var(--muted2);'>" + compareHint + "</div>"
      + "<div style='font-size:.7rem;color:var(--muted2);margin-top:.08rem;'>Compare immediately resolves success/failure and auto-applies outcomes (damage, stress, trauma, or conditions) through the active action.</div>"
      + modifiersHtml
      + "<div style='margin-top:.34rem;padding:.28rem .36rem;border:1px solid rgba(232,192,80,.35);background:rgba(232,192,80,.08);'>"
      + "<div style='font-size:.74rem;color:var(--gold2);'><strong>Teamwork:</strong> " + tmw + " TMW</div>"
      + "<div style='font-size:.7rem;color:var(--muted2);margin-top:.1rem;'>Push Luck costs 2 TMW and raises Dread to d" + pushDread + ".</div>"
      + "</div>"
      + "<div style='display:flex;gap:.26rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.45rem;'>"
      + "<button class='btn btn-sm' onclick='closeModal()'>Cancel</button>"
      + "<button class='btn btn-sm' onclick='wtwResolveManualActionPrompt(\"compare\",false)'>Compare</button>"
      + "<button class='btn btn-sm btn-primary' onclick='wtwResolveManualActionPrompt(\"success\",false)'>Success</button>"
      + "<button class='btn btn-sm btn-red' onclick='wtwResolveManualActionPrompt(\"failure\",false)'>Failure</button>"
      + "<button class='btn btn-sm btn-teal' " + (tmw >= 2 ? '' : "disabled title='Need 2 Teamwork'") + " onclick='wtwResolveManualActionPrompt(\"success\",true)'>Push Luck + Success</button>"
      + "<button class='btn btn-sm btn-warn' " + (tmw >= 2 ? '' : "disabled title='Need 2 Teamwork'") + " onclick='wtwResolveManualActionPrompt(\"failure\",true)'>Push Luck + Failure</button>"
      + "</div>"
      + "</div>";
    openModal(title, html);
    return true;
  }

  function resolveWtwManualActionPrompt(mode, pushLuck) {
    const pending = window._pendingWtwManualActionCheck || null;
    if (!pending) return;
    const actionInput = document.getElementById('wtwManualActionValue');
    const dreadInput = document.getElementById('wtwManualDreadValue');
    const advInput = document.getElementById('wtwManualAdvValue');
    const bonus1Input = document.getElementById('wtwManualBonus1Value');
    const bonus2Input = document.getElementById('wtwManualBonus2Value');
    const actionValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(actionInput, 1) : parseInt(actionInput && actionInput.value, 10);
    const dreadValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(dreadInput, 1) : parseInt(dreadInput && dreadInput.value, 10);
    const advValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(advInput, 0) : parseInt(advInput && advInput.value, 10);
    const bonus1Value = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(bonus1Input, 0) : parseInt(bonus1Input && bonus1Input.value, 10);
    const bonus2Value = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(bonus2Input, 0) : parseInt(bonus2Input && bonus2Input.value, 10);
    const actionDie = Math.max(4, Number(pending.actionDie || 4));
    const baseDreadDie = Math.max(4, Number(pending.dreadDie || 6));
    if (!Number.isFinite(actionValue) || !Number.isFinite(dreadValue)) {
      if (typeof showNotif === 'function') showNotif('Enter both manual dice values first.', 'warn');
      return;
    }
    if (actionValue < 1 || dreadValue < 1) {
      if (typeof showNotif === 'function') showNotif('Manual totals must be 1 or higher.', 'warn');
      return;
    }

    const hasBreakdown = Number.isFinite(advValue) || Number.isFinite(bonus1Value) || Number.isFinite(bonus2Value);
    const advTotal = Number.isFinite(advValue) ? Math.max(0, advValue) : actionValue;
    const bonus1Total = Number.isFinite(bonus1Value) ? Math.max(0, bonus1Value) : 0;
    const bonus2Total = Number.isFinite(bonus2Value) ? Math.max(0, bonus2Value) : 0;
    const computedAction = hasBreakdown
      ? (Math.max(actionValue, advTotal) + bonus1Total + bonus2Total)
      : actionValue;
    let usedPush = false;
    let finalDreadDie = baseDreadDie;
    if (pushLuck) {
      const tmw = Math.max(0, Number((S && S.tmw) || 0));
      if (tmw < 2) {
        if (typeof showNotif === 'function') showNotif('Need 2 Teamwork to Push Luck.', 'warn');
        return;
      }
      if (typeof changeCounter === 'function') changeCounter('tmw', -2);
      else if (typeof S !== 'undefined') S.tmw = Math.max(0, tmw - 2);
      usedPush = true;
      finalDreadDie = stepWtwManualDreadDie(baseDreadDie);
    }
    const modeKey = String(mode || 'compare').toLowerCase();
    const success = modeKey === 'success' ? true : (modeKey === 'failure' ? false : (computedAction >= dreadValue));
    window._pendingWtwManualActionCheck = null;
    if (typeof closeModal === 'function') closeModal();
    if (hasBreakdown && typeof showNotif === 'function') {
      showNotif('Manual compare: max(' + actionValue + ', ' + advTotal + ') + ' + bonus1Total + ' + ' + bonus2Total + ' = ' + computedAction + ' vs Dread ' + dreadValue + '.', success ? 'good' : 'warn');
    }
    if (typeof pending.resolver === 'function') {
      pending.resolver({
        success: success,
        manual: true,
        pushLuck: usedPush,
        statKey: pending.statKey,
        statLabel: pending.statLabel,
        actionDie: actionDie,
        dreadDie: finalDreadDie,
        actionTotal: computedAction,
        baseActionTotal: actionValue,
        advantageTotal: hasBreakdown ? advTotal : 0,
        bonusTotal: hasBreakdown ? (bonus1Total + bonus2Total) : 0,
        dreadTotal: dreadValue,
        mode: modeKey
      });
    }
  }
  window.wtwResolveManualActionPrompt = resolveWtwManualActionPrompt;

  function resolveWtwBarrierCrossing(hexId) {
    const w = ensureWorldState();
    const hex = hexById(hexId);
    if (!hex || !hex.hazard || hex.hazard.type !== 'barrier') return;
    const finalizeBarrier = function (check) {
      const success = !!(check && check.success);
      const manual = !!(check && check.manual);
      const actionTotal = Number(check && check.actionTotal || 0);
      const dreadTotal = Number(check && check.dreadTotal || 0);
      if (success) {
        hex.hazard = null;
        if (w) w.selectedHexId = hex.id;
        if (typeof showNotif === "function") {
          showNotif(manual
            ? "Barrier crossed: route cleared (manual Body vs DD" + dreadTotal + ")."
            : "Barrier crossed: route cleared (Body " + actionTotal + " vs DD6 " + dreadTotal + ").", "good");
        }
      } else {
        applyNegativeCondition("weakened");
        if (typeof showNotif === "function") {
          showNotif(manual
            ? "Crossing failed (manual Body vs DD" + dreadTotal + ") — Weakened. Barrier holds."
            : "Crossing failed (Body " + actionTotal + " vs DD6 " + dreadTotal + ") — Weakened. Barrier holds.", "warn");
        }
      }
      syncWorldMarkers();
      advanceWorldTime("barrier crossing");
      if (registerWorldAction("barrier")) return;
      renderWorldThatWas();
    };

    if (isWtwManualRollModeEnabled()) {
      const bodyDie = (typeof getEffectiveDie === "function") ? getEffectiveDie("body") : ((S.stats && S.stats.body) || 4);
      openWtwManualActionDreadPrompt({
        title: "Manual Roll - Barrier Crossing",
        context: "World That Was barrier",
        statKey: "body",
        statLabel: "Body",
        actionDie: bodyDie,
        dreadDie: 6,
        onResolve: function (outcome) {
          finalizeBarrier({
            success: !!(outcome && outcome.success),
            manual: true,
            actionTotal: Number((outcome && outcome.actionTotal) || 0),
            dreadTotal: Number((outcome && outcome.dreadTotal) || 0)
          });
        }
      });
      return;
    }

    finalizeBarrier(rollAgainstDread("body", 6));
  }
  window.resolveWtwBarrierCrossing = resolveWtwBarrierCrossing;

  function resolveDistrictHazard(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.hazard) return;

    const hz = hex.hazard;
    const check = rollAgainstDread(hz.stat || "body", hz.dread || 8);
    if (check.success) {
      addZoneReputation(hex.zone, 1);
      addWorldItem("scrap", 1);
      hex.hazard = null;
      if (typeof showNotif === "function") showNotif("Hazard cleared: " + (hz.name || "District hazard") + ".", "good");
    } else {
      applyNegativeCondition(hz.condition || "weakened");
      if (typeof changeStress === "function") {
        changeStress(Math.max(1, (check.dreadTotal || 1) - (check.actionTotal || 0)));
      }
      if (typeof showNotif === "function") showNotif("Hazard struck: gained " + (hz.condition || "weakened") + ".", "warn");
    }
    syncWorldMarkers();
    advanceWorldTime("hazard response");
    if (registerWorldAction("hazard")) return;
    renderWorldThatWas();
  }

  function talkToWayfarer(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.wayfarer) return;
    const info = hex.wayfarer;
    const title = "Wayfarer: " + (info.name || "Unknown");
    const body = "<div style='font-size:.84rem;color:var(--text2);line-height:1.65;'>"
      + "<strong style='color:var(--gold2);'>Rumor:</strong> " + (info.rumor || "Routes are quiet tonight.")
      + "<br><strong style='color:var(--teal);'>History:</strong> " + (info.history || "Old routes still shape this district.")
      + "<br><br><span style='color:var(--muted2);'>You gain +1 Data Drive from shared route notes.</span>"
      + "</div>";
    if (typeof openModal === "function") openModal(title, body);
    addWorldItem("dataDrives", 1);
    addZoneReputation(hex.zone, 1);
    if (registerWorldAction("wayfarer talk")) return;
    renderWorldThatWas();
  }

  function exploreStructure(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.structure) return;
    const cs = (window.campaignSystem && typeof window.campaignSystem.getState === "function")
      ? window.campaignSystem.getState()
      : null;
    const roomsExist = !!(hex.structure && Array.isArray(hex.structure.generatedRooms) && hex.structure.generatedRooms.length);
    if (cs && cs.code && cs.role === "player") {
      if (!roomsExist) {
        if (typeof showNotif === "function") showNotif("Structure interior is waiting for GM sync. Ask GM to join this area first or request resync.", "info");
        return;
      }
      if (typeof showNotif === "function") showNotif("Joined structure interior.", "good");
      renderWorldThatWas();
      return;
    }
    if (!roomsExist) {
      generateStructureRooms(hex);
      grantRandomLoot("easy");
      addZoneReputation(hex.zone, 1);
      syncWorldMarkers();
      if (registerWorldAction("structure explore")) return;
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
        setTimeout(function () {
          try { window.campaignSystem.syncSharedSilent("wtw-structure-generated"); } catch (_err) { console.error(_err); }
        }, 0);
      }
      if (typeof showNotif === "function") {
        showNotif("Explored " + (hex.structure.name || hex.structure.kind) + ". Rooms generated.", "good");
      }
    } else if (typeof showNotif === "function") {
      showNotif("Joined " + (hex.structure.name || hex.structure.kind) + " interior.", "good");
    }
    renderWorldThatWas();
  }

  function joinStructureArea(hexId) {
    const run = function () { exploreStructure(hexId); };
    if (typeof window.openCampaignAreaJoinPrompt === "function") {
      window.openCampaignAreaJoinPrompt("World Structure Interior", run);
      return;
    }
    run();
  }

  function launchToSpace(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.landingPad) {
      if (typeof showNotif === "function") showNotif("Launch requires a landing pad district.", "warn");
      return;
    }
    if (!spendCredits(40, "orbital launch")) return;
    advanceWorldTime("orbital launch");
    if (typeof showNotif === "function") showNotif("Launch cleared. Returning to space lane.", "good");
    returnToGalaxy();
  }

  function withCampaignJoin(kind, label, run) {
    if (typeof run !== "function") return;
    if (typeof window.openCampaignJoinPrompt === "function") {
      window.openCampaignJoinPrompt(kind || "area", label || "Shared Activity", run);
      return;
    }
    if (typeof window.openCampaignAreaJoinPrompt === "function") {
      window.openCampaignAreaJoinPrompt(label || "Shared Activity", run);
      return;
    }
    run();
  }

  function resolveZoneEventWithJoin(hexId) {
    withCampaignJoin("encounter", "World Random Event", function () {
      resolveZoneEvent(hexId);
    });
  }

  function resolveDistrictEncounterWithJoin(forcedOutcome) {
    withCampaignJoin("encounter", "District Encounter", function () {
      resolveDistrictEncounter(forcedOutcome);
    });
  }

  function chooseLandingPad(zoneName) {
    const w = ensureWorldState();
    if (!w) return;
    const target = w.hexes.find(function (h) { return h.zone === zoneName && h.landingPad; });
    if (!target) {
      if (typeof showNotif === "function") showNotif("No landing pad available in " + zoneName + ".", "warn");
      return;
    }
    w.currentZone = zoneName;
    w.selectedHexId = target.id;
    renderWorldThatWas();
  }

  function resolveZoneEvent(hexId) {
    const w = ensureWorldState();
    if (!w) return;
    const hex = w.hexes.find(function (h) { return h.id === hexId; });
    if (!hex) return;

    if (!hex.narrative) hex.narrative = randomNarrativeForHex(hex.zone);
    if (!hex.narrative.event) {
      hex.narrative.event = buildWorldEvent(hex.zone, safePick((ZONE_FLAVOR[hex.zone] || ZONE_FLAVOR["Cyber Hub"]).events, null));
    }
    const evt = hex.narrative.event;

    if (evt.mode === "combat") {
      if (w.pendingCombatOutcome) {
        if (typeof showNotif === 'function') showNotif('Resolve the active World That Was combat outcome before starting another combat.', 'warn');
        openWtwCombatOutcomeModal();
        return;
      }
      const profile = getWorldNamedEnemyProfile({
        name: evt.enemyName,
        desc: evt.enemyDesc,
        dread: evt.dread,
        enemyHealth: evt.enemyHealth
      });
      const encounterDread = normalizeDreadDie(evt.dread || profile.dread || 8, 8);
      const enemyHealth = Math.max(4, Number(evt.enemyHealth || profile.health || (encounterDread * 2)));
      const enemyName = String(evt.enemyName || profile.name || 'Ash Revenant');
      const deathNumber = Math.max(1, Math.ceil(enemyHealth / 2));
      evt.enemyName = enemyName;
      evt.enemyDesc = evt.enemyDesc || profile.desc || '';
      evt.enemyHealth = enemyHealth;
      evt.deathNumber = deathNumber;
      if (typeof showNotif === "function") {
        showNotif("Combat event: " + (evt.enemies || 2) + " " + enemyName + (Number(evt.enemies || 2) > 1 ? "s" : "") + " (DD" + encounterDread + " | " + enemyHealth + " HP each | Death Number " + deathNumber + ").", "warn");
      }
      openWorldSkirmishCombat({
        enemies: evt.enemies || 2,
        dread: encounterDread,
        enemyHealth: enemyHealth,
        enemyName: enemyName,
        enemyDesc: evt.enemyDesc,
        sourceType: 'event',
        sourceHexId: hex.id,
      });
      return;
    }

    const stat = "valor";
    const completeEvent = function (check) {
      if (check.success) {
        const zone = zoneForHex(hex);
        addPowerRenown(zone ? zone.leader : MAJOR_POWERS[0], 1);
        addZoneReputation(hex.zone, 1);
        addWorldItem("dataDrives", 1);
        setCredits(getCredits() + 50);
        grantRandomLoot("medium");
        putLootInBackpack(drawServiceMerchantItem(["items", "toolkits", "tradegoods"]));
        if (typeof showNotif === "function") {
          showNotif("Event success: " + statLabel(stat) + " d" + check.vd + " " + check.actionTotal + " vs DD" + check.dd + " " + check.dreadTotal + (check.manual ? " [manual]" : "") + ". Rewards: +50 Credits, loot, and backpack supplies.", "good");
        }
      } else if (typeof showNotif === "function") {
        showNotif("Event failed: " + statLabel(stat) + " d" + check.vd + " " + check.actionTotal + " vs DD" + check.dd + " " + check.dreadTotal + (check.manual ? " [manual]" : "") + ".", "warn");
        hex.skirmish = true;
      }

      hex.narrative.event = buildWorldEvent(hex.zone, safePick((ZONE_FLAVOR[hex.zone] || ZONE_FLAVOR["Cyber Hub"]).events, hex.narrative.event));

      advanceWorldTime("event resolution");
      updateZoneControl();
      syncWorldMarkers();
      if (registerWorldAction("event")) return;
      renderWorldThatWas();
    };

    const eventDreadDie = normalizeDreadDie(evt.dread || 8, 8);
    if (isWtwManualRollModeEnabled()) {
      const valorDie = getActionDie("valor");
      openWtwManualActionDreadPrompt({
        title: "Manual Roll - World Event",
        context: "World That Was random event",
        statKey: stat,
        statLabel: statLabel(stat),
        actionDie: valorDie,
        dreadDie: eventDreadDie,
        onResolve: function (outcome) {
          completeEvent({
            success: !!(outcome && outcome.success),
            vd: valorDie,
            dd: Number((outcome && outcome.dreadDie) || eventDreadDie),
            actionTotal: Number((outcome && outcome.actionTotal) || 0),
            dreadTotal: Number((outcome && outcome.dreadTotal) || 0),
            manual: true,
            pushLuck: !!(outcome && outcome.pushLuck)
          });
        }
      });
      return;
    }

    completeEvent(rollAgainstDread(stat, eventDreadDie));
  }

  function completeCombatEventVictory(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.narrative || !hex.narrative.event || hex.narrative.event.mode !== "combat") return;
    const w = ensureWorldState();
    if (w && w.pendingCombatOutcome && String(w.pendingCombatOutcome.sourceHexId || '') === String(hexId || '') && String(w.pendingCombatOutcome.sourceType || '') === 'event') {
      w.pendingCombatOutcome = null;
    }
    const zone = zoneForHex(hex);
    addPowerRenown(zone ? zone.leader : MAJOR_POWERS[0], 1);
    addZoneReputation(hex.zone, 2);
    addWorldItem("scrap", 2);
    grantRandomLoot("medium");
    setCredits(getCredits() + 90);
    hex.skirmish = false;
    if (typeof showNotif === "function") showNotif("Combat event victory: +90 Credits, +2 Scrap, and loot awarded.", "good");
    hex.narrative.event = buildWorldEvent(hex.zone, safePick((ZONE_FLAVOR[hex.zone] || ZONE_FLAVOR["Cyber Hub"]).events, hex.narrative.event));
    advanceWorldTime("combat event victory");
    updateZoneControl();
    syncWorldMarkers();
    if (registerWorldAction("combat event")) return;
    renderWorldThatWas();
  }

  function completeCombatEventFailure(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.narrative || !hex.narrative.event || hex.narrative.event.mode !== "combat") return;
    const w = ensureWorldState();
    if (w && w.pendingCombatOutcome && String(w.pendingCombatOutcome.sourceHexId || '') === String(hexId || '') && String(w.pendingCombatOutcome.sourceType || '') === 'event') {
      w.pendingCombatOutcome = null;
    }
    hex.skirmish = true;
    if (typeof changeCounter === 'function') changeCounter('tmw', 1);
    if (typeof showNotif === 'function') showNotif('Combat event failed: district skirmish escalates and +1 Teamwork.', 'warn');
    hex.narrative.event = buildWorldEvent(hex.zone, safePick((ZONE_FLAVOR[hex.zone] || ZONE_FLAVOR["Cyber Hub"]).events, hex.narrative.event));
    advanceWorldTime('combat event failure');
    updateZoneControl();
    syncWorldMarkers();
    if (registerWorldAction('combat event failure')) return;
    renderWorldThatWas();
  }

  function completeCombatEncounterFailure(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.encounter || hex.encounter.mode !== 'combat') return;
    const w = ensureWorldState();
    if (w && w.pendingCombatOutcome && String(w.pendingCombatOutcome.sourceHexId || '') === String(hexId || '') && String(w.pendingCombatOutcome.sourceType || '') !== 'event') {
      w.pendingCombatOutcome = null;
    }
    hex.skirmish = true;
    hex.encounter = null;
    if (typeof changeCounter === 'function') changeCounter('tmw', 1);
    if (typeof showNotif === 'function') showNotif('Encounter combat failed: skirmish triggered and +1 Teamwork.', 'warn');
    advanceWorldTime('combat encounter failure');
    updateZoneControl();
    syncWorldMarkers();
    if (registerWorldAction('encounter failure')) return;
    renderWorldThatWas();
  }

  function completeCombatEncounterVictory(hexId) {
    const hex = hexById(hexId);
    if (!hex || !hex.encounter || hex.encounter.mode !== "combat") return;
    const w = ensureWorldState();
    if (w && w.pendingCombatOutcome && String(w.pendingCombatOutcome.sourceHexId || '') === String(hexId || '') && String(w.pendingCombatOutcome.sourceType || '') !== 'event') {
      w.pendingCombatOutcome = null;
    }
    addZoneReputation(hex.zone, 2);
    addWorldItem("scrap", 2);
    setCredits(getCredits() + 80);
    grantRandomLoot("medium");
    putLootInBackpack("Skirmish Trophy");
    applyWtwNightModeBonusRewards(hex.encounter, 'combat victory');
    hex.skirmish = false;
    hex.encounter = null;
    if (typeof showNotif === "function") showNotif("Encounter combat victory: +80 Credits, +2 Scrap, loot, and Skirmish Trophy.", "good");
    if (window.TrophySystem) window.TrophySystem.check('first_combat');
    advanceWorldTime("combat encounter victory");
    updateZoneControl();
    syncWorldMarkers();
    if (registerWorldAction("encounter victory")) return;
    renderWorldThatWas();
  }

  function rollDistrictEncounter() {
    if (window.campaignSystem && typeof window.campaignSystem.guardSharedWorldMutation === 'function' && !window.campaignSystem.guardSharedWorldMutation('Only the GM can roll shared district encounters in Campaign mode.')) return;
    const hex = getSelectedHex();
    if (!hex) return;
    hex.encounter = buildDistrictEncounter(hex.zone);
    if (hex.encounter) hex.encounter.zoneName = hex.zone;
    if (isWtwNightModeActive() && safeRoll(100) <= getWtwNightModeBonusChance()) {
      const bonus = buildWtwNightModeBonus();
      if (hex.encounter) {
        hex.encounter.nightModeBonus = bonus;
        hex.encounter.text = String(hex.encounter.text || '') + ' Night Mode Bonus: ' + bonus.title + ' - ' + bonus.text;
      } else {
        hex.encounter = {
          title: 'Night Mode Bonus: ' + bonus.title,
          text: bonus.text,
          action: 'Exploit the shadow window',
          reward: 'Immediate tactical reward',
          mode: 'skill',
          stat: 'valor',
          dread: 8,
          zoneName: hex.zone,
          nightModeBonus: bonus
        };
      }
    }
    if (!hex.encounter) {
      if (typeof showNotif === "function") showNotif("No active encounter in this district right now.", "good");
      renderWorldThatWas();
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
        setTimeout(function () {
          try {
            var out = window.campaignSystem.syncSharedSilent('wtw-encounter-roll-none');
            if (out && typeof out.catch === 'function') out.catch(function () {});
          } catch (_err) { console.error(_err); }
        }, 0);
      }
      return;
    }
    if (typeof showNotif === "function") showNotif("Encounter rolled in " + hex.zone + ".", "good");
    if (registerWorldAction("encounter roll")) return;
    renderWorldThatWas();
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
      setTimeout(function () {
        try {
          var out = window.campaignSystem.syncSharedSilent('wtw-encounter-roll');
          if (out && typeof out.catch === 'function') out.catch(function () {});
        } catch (_err) { console.error(_err); }
      }, 0);
    }
  }

  function resolveDistrictEncounter(forcedOutcome, options) {
    var opts = options || {};
    if (window.campaignSystem && typeof window.campaignSystem.guardSharedWorldMutation === 'function' && !window.campaignSystem.guardSharedWorldMutation('Only the GM can resolve shared district encounters in Campaign mode.')) return;
    const hex = getSelectedHex();
    if (!hex || !hex.encounter) return;
    if (hex.encounter.mode === "wayfarer") {
      addZoneReputation(hex.zone, 1);
      addWorldItem("dataDrives", 1);
      addWorldItem("water", 1);
      putLootInBackpack(drawServiceMerchantItem(["services", "items", "tradegoods"]));
      applyWtwNightModeBonusRewards(hex.encounter, 'wayfarer');
      if (typeof showNotif === "function") showNotif("Wayfarer encounter resolved: gained resources and clue cache.", "good");
      hex.encounter = null;
      advanceWorldTime("wayfarer encounter");
      if (registerWorldAction("encounter resolve")) return;
      renderWorldThatWas();
      if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
        setTimeout(function () {
          try {
            var out = window.campaignSystem.syncSharedSilent('wtw-encounter-resolve');
            if (out && typeof out.catch === 'function') out.catch(function () {});
          } catch (_err) { console.error(_err); }
        }, 0);
      }
      return;
    }
    if (hex.encounter.mode === "combat") {
      if (w.pendingCombatOutcome) {
        if (typeof showNotif === 'function') showNotif('Resolve the active World That Was combat outcome before starting another combat.', 'warn');
        openWtwCombatOutcomeModal();
        return;
      }
      const profile = getWorldNamedEnemyProfile({
        name: hex.encounter.enemyName,
        desc: hex.encounter.enemyDesc,
        dread: hex.encounter.dread,
        enemyHealth: hex.encounter.enemyHealth
      });
      const encounterDread = normalizeDreadDie(hex.encounter.dread || profile.dread || 8, 8);
      const enemyHealth = Math.max(4, Number(hex.encounter.enemyHealth || profile.health || (encounterDread * 2)));
      const enemyName = String(hex.encounter.enemyName || profile.name || 'Ash Revenant');
      const deathNumber = Math.max(1, Math.ceil(enemyHealth / 2));
      hex.encounter.enemyName = enemyName;
      hex.encounter.enemyDesc = hex.encounter.enemyDesc || profile.desc || '';
      hex.encounter.enemyHealth = enemyHealth;
      hex.encounter.deathNumber = deathNumber;
      if (typeof showNotif === "function") {
        showNotif("Encounter combat: " + (hex.encounter.enemies || 2) + " " + enemyName + (Number(hex.encounter.enemies || 2) > 1 ? "s" : "") + " (DD" + encounterDread + " | " + enemyHealth + " HP each | Death Number " + deathNumber + ").", "warn");
      }
      openWorldSkirmishCombat({
        enemies: hex.encounter.enemies || 2,
        dread: encounterDread,
        enemyHealth: enemyHealth,
        enemyName: enemyName,
        enemyDesc: hex.encounter.enemyDesc,
        sourceType: 'encounter',
        sourceHexId: hex.id,
      });
      return;
    }
    const forced = forcedOutcome === "success" || forcedOutcome === "failure" ? forcedOutcome : null;
    var check = opts.checkOverride || null;
    if (!check) {
      check = forced
        ? { success: forced === "success", ad: getActionDie(hex.encounter.stat || "body"), dd: normalizeDreadDie(hex.encounter.dread || 8, 8), actionTotal: 0, dreadTotal: 0 }
        : rollAgainstDread(hex.encounter.stat || "body", hex.encounter.dread || 8);
    }
    if (check.success) {
      addZoneReputation(hex.zone, 1);
      addWorldItem("water", 1);
      grantRandomLoot("easy");
      setCredits(getCredits() + 30);
      if (opts.pushLuck) {
        applyWtwCondition(normalizeWtwConditionByStat(hex.encounter.stat || 'valor', true));
      }
      applyWtwNightModeBonusRewards(hex.encounter, 'skill success');
      if (!opts.teamworkConverted && !(check && check.teamworkConverted)) {
        recordWtwSuccessRoll();
      } else if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
        window.BTLRules.recordTeamworkConvertedSuccess('wtw-encounter-teamwork-convert');
      }
      if (typeof showNotif === "function") {
        if (opts.pushLuck) {
          showNotif('Push Luck succeeded. Condition gained: ' + normalizeWtwConditionByStat(hex.encounter.stat || 'valor', true) + '. Encounter resolved successfully.', 'good');
        } else {
          showNotif(forced ? "GM override: encounter marked success." : "Encounter resolved successfully.", "good");
        }
      }
    } else {
      if (!opts.skipPrompt) {
        openWtwEncounterFailureModal(hex, hex.encounter, check, forced ? 'Manual Failure' : 'Encounter Failed');
        return;
      }
      var consequence = applyWtwEncounterFailureConsequences(hex, hex.encounter, check, { stat: hex.encounter.stat || 'valor' });
      if (typeof showNotif === "function") {
        if (opts.pushLuck) {
          showNotif('Push Luck failed. ' + consequence.summary + '.', 'warn');
        } else {
          showNotif((forced ? 'Manual Failure: ' : 'Encounter failed: ') + consequence.summary + '.', 'warn');
        }
      }
    }
    hex.encounter = null;
    advanceWorldTime("district encounter");
    if (registerWorldAction("encounter resolve")) return;
    renderWorldThatWas();
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
      setTimeout(function () {
        try {
          var out = window.campaignSystem.syncSharedSilent('wtw-encounter-resolve');
          if (out && typeof out.catch === 'function') out.catch(function () {});
        } catch (_err) { console.error(_err); }
      }, 0);
    }
  }

  function resolveDistrictEncounterAs(outcome) {
    if (outcome !== "success" && outcome !== "failure") return;
    resolveDistrictEncounter(outcome, { skipPrompt: outcome === 'success' });
  }

  function collectMarkerJob(hexId) {
    const w = ensureWorldState();
    if (!w) return;
    const marker = w.markers[hexId];
    if (!marker) return;

    const hex = w.hexes.find(function (h) { return h.id === hexId; });
    if (!hex) return;

    if (marker.type === "mission") {
      if (typeof showNotif === "function") showNotif("Mission marker reviewed. See Missions tab for full objective.", "good");
    } else if (marker.type === "mission_informer" || marker.type === "mission_site" || marker.type === "mission_raid_informer" || marker.type === "mission_raid_site") {
      var missions = Array.isArray(S && S.activeMissions) ? S.activeMissions : [];
      var mission = missions.find(function (m) {
        if (!m || m.region !== "wtw") return false;
        if (marker.type === "mission_informer" || marker.type === "mission_raid_informer") return String(m.wtwInformerHexId || "") === String(hexId || "");
        return String(m.wtwSiteHexId || m.wtwHexId || "") === String(hexId || "");
      }) || null;

      if (!mission) {
        if (typeof showNotif === "function") showNotif("Mission marker found, but no linked active mission was found.", "warn");
      } else {
        if (mission.missionType === "legacy_raid" && typeof window.handleLegacyRaidMarkerInteraction === "function") {
          if (window.handleLegacyRaidMarkerInteraction(
            mission.id,
            (marker.type === "mission_informer" || marker.type === "mission_raid_informer") ? "informer" : "site",
            "wtw"
          )) {
            return;
          }
        }
        var steps = Array.isArray(mission.steps) ? mission.steps : [];
        var infoDone = !!(steps[1] && steps[1].completed);
        var siteDone = !!(steps[2] && steps[2].completed);
        var finalDone = !!(steps[3] && steps[3].completed);

        if (marker.type === "mission_informer" || marker.type === "mission_raid_informer") {
          if (!infoDone && typeof window.startMissionStep1 === "function") {
            window.startMissionStep1(mission.id);
          } else if (typeof showNotif === "function") {
            showNotif("Informer intel already resolved for this mission.", "info");
          }
        } else if (!siteDone && typeof window.startMissionStep2 === "function") {
          window.startMissionStep2(mission.id);
        } else if (!finalDone && typeof window.startMissionStep3 === "function") {
          window.startMissionStep3(mission.id);
        } else if (typeof showNotif === "function") {
          showNotif("Mission site already resolved for this mission.", "info");
        }
      }
    } else if (marker.type === "task") {
      const task = w.activeTasks.find(function (t) { return t.hexId === hexId; }) || w.activeTasks[0];
      if (task) {
        completeHoldingTask(task.id);
        return;
      }
    } else if (marker.type === "faction_base") {
      withCampaignJoin("faction", "Faction Base", function () {
        if (window.factionSystem && typeof window.factionSystem.openBaseFromMarker === "function") {
          window.factionSystem.openBaseFromMarker("wtw", hexId);
        }
      });
    } else if (marker.type === "faction_task") {
      if (!window.factionSystem || typeof window.factionSystem.getWTWTask !== "function") return;
      const ft = window.factionSystem.getWTWTask(hexId);
      if (!ft) return;
      if (!ft.monsterTask && ft.status === "open" && typeof window.factionSystem.resolveMapTask === "function") {
        withCampaignJoin("task", ft.title || "Wayfarer Task", function () {
          window.factionSystem.resolveMapTask("wtw", hexId);
        });
      } else if (ft.monsterTask && ft.status === "open" && typeof window.factionSystem.startMonsterTask === "function") {
        withCampaignJoin("task", ft.title || "Monster Wayfarer Task", function () {
          window.factionSystem.startMonsterTask("wtw", hexId);
        });
      } else if (ft.monsterTask && ft.status === "combat_pending" && typeof openModal === "function") {
        openModal("Monster Encounter Pending", "<div style='font-size:.82rem;color:var(--text2);line-height:1.6;'><strong>" + (ft.title || "Wayfarer Task") + "</strong><br>" + (ft.monsterSummary || "Monster encounter") + "<br><br>After combat, choose outcome:<div style='margin-top:.35rem;display:flex;gap:.3rem;flex-wrap:wrap;'><button class='btn btn-xs btn-primary' onclick=\"if(window.factionSystem)window.factionSystem.finalizeMonsterTask('wtw','" + hexId + "',null,true);if(typeof closeModal==='function')closeModal();if(typeof renderWorldThatWas==='function')renderWorldThatWas();\">Slayed Monsters</button><button class='btn btn-xs btn-red' onclick=\"if(window.factionSystem)window.factionSystem.finalizeMonsterTask('wtw','" + hexId + "',null,false);if(typeof closeModal==='function')closeModal();if(typeof renderWorldThatWas==='function')renderWorldThatWas();\">Failed Encounter</button></div></div>");
      }
    } else if (marker.type === "service") {
      w.selectedHexId = hexId;
      setWorldAccordionOpen("services", true);
      if (typeof showNotif === "function") showNotif("District Service reviewed. Opened service card for this district.", "good");
      if (registerWorldAction("service marker review")) return;
      renderWorldThatWas();
      return;
    } else if (marker.type === "wayfarer") {
      talkToWayfarer(hexId);
      delete w.markers[hexId];
    } else if (marker.type === "structure") {
      exploreStructure(hexId);
      delete w.markers[hexId];
    } else if (marker.type === "hazard" || marker.type === "peril" || marker.type === "barrier") {
      resolveDistrictHazard(hexId);
      delete w.markers[hexId];
    } else if (marker.type === "landing") {
      chooseLandingPad(hex.zone);
      if (typeof showNotif === "function") showNotif("Landing marker reviewed: selected landing pad for " + hex.zone + ".", "good");
      delete w.markers[hexId];
    } else if (marker.type === "station") {
      travelByTrainTo(hex.zone);
      if (typeof showNotif === "function") showNotif("Station marker reviewed: railway route set to " + hex.zone + ".", "good");
      delete w.markers[hexId];
    } else if (marker.type === "story") {
      withCampaignJoin("story", "Storyline", function () {
        if (typeof openStorylineTab === "function") openStorylineTab();
      });
      if (typeof showNotif === "function") showNotif("Story marker reviewed: opening Storyline.", "good");
      delete w.markers[hexId];
    } else if (marker.type === "solar_cycle" || marker.type === "solar_cycle_stage" || marker.type === "solar_cycle_investigation" || marker.type === "solar_cycle_omen" || marker.type === "solar_cycle_side") {
      if (typeof window.resolveSolarCycleWTWMarker === "function") {
        window.resolveSolarCycleWTWMarker(hexId);
      }
    }

    advanceWorldTime("district marker");
    if (registerWorldAction("marker")) return;
    renderWorldThatWas();
  }

  function setupSkirmishForHex(hexId) {
    const w = ensureWorldState();
    if (!w) return;
    const hex = w.hexes.find(function (h) { return h.id === hexId; });
    if (!hex || !hex.skirmish) return;

    const st = w.skirmishState;
    st.activeHexId = hexId;
    st.round = 1;
    st.armyAActions = 2;
    st.armyBActions = 2;
    st.armyAStress = safeRoll(12) + safeRoll(12);
    st.armyBStress = safeRoll(12) + safeRoll(12);
    st.armyADread = st.armyAStress >= 13 ? 6 : 4;
    st.armyBDread = st.armyBStress >= 13 ? 6 : 4;

    renderWorldThatWas();
  }

  function skirmishActionInInfo(side, action) {
    const w = ensureWorldState();
    if (!w) return;
    const st = w.skirmishState;
    if (!st.activeHexId) return;

    const isA = side === "A";
    const myActions = isA ? "armyAActions" : "armyBActions";
    const oppStress = isA ? "armyBStress" : "armyAStress";
    const myDread = isA ? "armyADread" : "armyBDread";

    if (st[myActions] <= 0) {
      if (typeof showNotif === "function") showNotif("No actions left for that side.", "warn");
      return;
    }

    st[myActions] -= 1;
    const rollVal = safeRoll(12);
    const dread = st[myDread] || 6;

    if (action === "strike" && rollVal >= dread) {
      st[oppStress] = Math.max(0, st[oppStress] - Math.max(1, rollVal - dread));
    } else if (action === "frighten" && safeRoll(12) >= dread) {
      st[oppStress] = Math.max(0, st[oppStress] - 1);
    }

    if (st.armyAActions === 0 && st.armyBActions === 0) {
      st.round += 1;
      st.armyAActions = 2;
      st.armyBActions = 2;
    }

    if (st.armyAStress <= 0 || st.armyBStress <= 0) {
      finishSkirmishOutcome(st.armyBStress <= 0);
      return;
    }

    if (registerWorldAction("skirmish action")) return;
    renderWorldThatWas();
  }

  function finishSkirmishOutcome(playerWin) {
    const w = ensureWorldState();
    if (!w) return;
    const st = w.skirmishState;
    const hex = w.hexes.find(function (h) { return h.id === st.activeHexId; });
    if (!hex) return;

    if (playerWin) {
      hex.controller = w.playerAlignedPower;
      hex.skirmish = false;
      if (typeof changeCounter === "function") changeCounter("renown", 1);
      addPowerRenown(w.playerAlignedPower, 1);
      grantRandomLoot("medium");
      if (typeof showNotif === "function") showNotif("Skirmish won in " + hex.zone + ".", "good");
    } else if (typeof showNotif === "function") {
      showNotif("Skirmish unresolved. Enemy holds.", "warn");
    }

    st.activeHexId = null;
    updateZoneControl();
    advanceWorldTime("skirmish");
    renderWorldThatWas();
  }

  function quickResolveWorldSkirmish() {
    const w = ensureWorldState();
    const hex = getSelectedHex();
    if (!w || !hex || !hex.skirmish) return;

    w.skirmishState.activeHexId = hex.id;
    const vd = (S.stats && S.stats.valor) ? S.stats.valor : 6;
    const a = safeRoll(vd);
    const d = safeRoll(8);
    finishSkirmishOutcome(a >= d);
  }

  function getWorldNamedEnemyProfile(fallback) {
    const base = fallback || {};
    const health = Math.max(4, Number(base.health || base.enemyHealth || 10));
    const seeded = {
      name: base.name || base.enemyName || 'Ash Revenant',
      desc: base.desc || base.enemyDesc || 'A dusk-forged hunter draped in static and old oath-runes.',
      dread: normalizeDreadDie(base.dread || 8, 8),
      health: health,
      deathNumber: Math.max(1, Math.ceil(health / 2))
    };
    if (typeof window !== 'undefined' && typeof window.pickNamedEnemyProfile === 'function') {
      const picked = window.pickNamedEnemyProfile('world') || {};
      const pickedHealth = Math.max(4, Number(base.health || base.enemyHealth || picked.health || seeded.health));
      return {
        name: base.name || base.enemyName || picked.name || seeded.name,
        desc: base.desc || base.enemyDesc || picked.desc || seeded.desc,
        dread: normalizeDreadDie(base.dread || picked.dread || seeded.dread, 8),
        health: pickedHealth,
        deathNumber: Math.max(1, Math.ceil(pickedHealth / 2))
      };
    }
    return seeded;
  }

  function buildWorldCombatEnemies(config) {
    const cfg = config || {};
    const count = Math.max(1, Number(cfg.enemies || 2));
    const profile = getWorldNamedEnemyProfile({
      name: cfg.enemyName,
      desc: cfg.enemyDesc,
      dread: cfg.dread,
      enemyHealth: cfg.enemyHealth
    });
    const dd = normalizeDreadDie(cfg.dread || profile.dread || 8, 8);
    const hp = Math.max(4, Number(cfg.enemyHealth || profile.health || (dd * 2)));
    const enemyName = String(cfg.enemyName || profile.name || 'Ash Revenant');
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push(enemyName + (count > 1 ? (' ' + (i + 1)) : ''));
    }
    return {
      count: count,
      dd: dd,
      hp: hp,
      names: list,
      enemyName: enemyName,
      enemyDesc: String(cfg.enemyDesc || profile.desc || ''),
      deathNumber: Math.max(1, Math.ceil(hp / 2))
    };
  }

  function seedCombatFromWorldEncounter(config, sourceHexId) {
    if (typeof S === 'undefined' || !S) return null;
    const seeded = buildWorldCombatEnemies(config || {});
    const now = Date.now();
    S.combat = S.combat || {};
    S.combat.enemyDread = seeded.dd;
    S.enemies = seeded.names.map(function (name, idx) {
      return {
        id: now + idx,
        name: name,
        dread: seeded.dd,
        stress: 0,
        maxStress: seeded.hp,
        health: seeded.hp,
        deathNumber: seeded.deathNumber,
        conditions: []
      };
    });
    const w = ensureWorldState();
    if (w) {
      const sourceType = String((config && config.sourceType) || '').toLowerCase() === 'event' ? 'event' : 'encounter';
      w.pendingCombatOutcome = {
        sourceHexId: String(sourceHexId || (getSelectedHex() && getSelectedHex().id) || ''),
        sourceType: sourceType,
        enemies: seeded.count,
        dread: seeded.dd,
        enemyHealth: seeded.hp,
        enemyName: seeded.enemyName,
        enemyDesc: seeded.enemyDesc,
        deathNumber: seeded.deathNumber,
      };
    }
    return seeded;
  }

  function openWtwCombatOutcomeModal() {
    const w = ensureWorldState();
    const pending = w && w.pendingCombatOutcome ? w.pendingCombatOutcome : null;
    if (!pending || typeof openModal !== 'function') return;
    const targetHex = pending.sourceHexId ? hexById(String(pending.sourceHexId)) : null;
    const label = pending.sourceType === 'event' ? 'Event Combat Outcome' : 'Encounter Combat Outcome';
    const locationLabel = targetHex ? (String(targetHex.zone || 'Unknown Zone') + ' / ' + String(targetHex.district || targetHex.id || 'District')) : 'Current District';
    const enemyCount = Math.max(1, Number(pending.enemies || 2));
    const enemyName = String(pending.enemyName || 'Ash Revenant');
    const dread = normalizeDreadDie(pending.dread || 8, 8);
    const enemyHealth = Math.max(4, Number(pending.enemyHealth || (dread * 2)));
    const deathNumber = Math.max(1, Math.ceil(enemyHealth / 2));
    const html = "<div style='font-size:.84rem;color:var(--text2);line-height:1.58;'>"
      + "<strong style='color:var(--gold2);'>" + label + "</strong><br>"
      + locationLabel + "<br>"
      + enemyCount + " " + enemyName + (enemyCount > 1 ? "s" : "") + " (DD" + dread + " | " + enemyHealth + " HP each | Death Number " + deathNumber + ")<br><br>"
      + "After resolving the fight in Combat + Quick Access, choose outcome to resolve encounter.\n"
      + "<div style='display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem;'>"
      + "<button class='btn btn-xs btn-teal' onclick='wtwResolvePendingCombatOutcome(\"success\")'>Victory</button>"
      + "<button class='btn btn-xs btn-red' onclick='wtwResolvePendingCombatOutcome(\"failure\")'>Defeat</button>"
      + "</div></div>";
    openModal('WTW Combat Outcome', html);
  }

  function resolveWtwPendingCombatOutcome(outcome) {
    const w = ensureWorldState();
    const pending = w && w.pendingCombatOutcome ? w.pendingCombatOutcome : null;
    if (!pending) {
      if (typeof showNotif === 'function') showNotif('No pending World That Was combat outcome to resolve.', 'warn');
      return;
    }
    const sourceHexId = String(pending.sourceHexId || (getSelectedHex() && getSelectedHex().id) || '');
    const sourceType = String(pending.sourceType || '').toLowerCase() === 'event' ? 'event' : 'encounter';
    if (String(outcome || '') === 'success') {
      if (sourceType === 'event') completeCombatEventVictory(sourceHexId);
      else completeCombatEncounterVictory(sourceHexId);
    } else {
      if (sourceType === 'event') completeCombatEventFailure(sourceHexId);
      else completeCombatEncounterFailure(sourceHexId);
    }
    if (typeof closeModal === 'function') closeModal();
  }

  function openWorldSkirmishCombat(config) {
    const hex = getSelectedHex();
    const selectedHex = hex || (config && config.sourceHexId ? hexById(config.sourceHexId) : null);
    if (!selectedHex && !config) return;
    const seeded = config ? seedCombatFromWorldEncounter(config, (selectedHex && selectedHex.id) || config.sourceHexId) : null;
    const fallbackDread = selectedHex && selectedHex.skirmish ? 8 : 6;
    const combatDread = seeded ? seeded.dd : fallbackDread;
    if (typeof setEnemyDread === "function") setEnemyDread(combatDread);
    if (typeof startCombat === "function") startCombat();
    if (typeof renderEnemies === "function") renderEnemies();
    const dreadDisplay = document.getElementById("enemyDreadDisplay");
    if (dreadDisplay) dreadDisplay.textContent = "d" + combatDread;
    const btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('combat'\"]");
    if (typeof switchTab === "function") switchTab("combat", btn || null);
    if (typeof openQuickPanelTab === 'function') openQuickPanelTab('combat');
    if (config && typeof showNotif === 'function') {
      showNotif('World combat seeded: ' + (seeded ? seeded.count : Math.max(1, Number(config.enemies || 2))) + ' enemies in Combat + Quick Access. Choose outcome to resolve encounter.', 'warn');
      openWtwCombatOutcomeModal();
    }
  }

  function createHoldingTask(holdingId) {
    const w = ensureWorldState();
    if (!w) return;
    const h = w.holdings.find(function (x) { return x.id === holdingId; });
    if (!h) return;

    const taskId = "task-" + Date.now() + "-" + safeRoll(9999);
    const title = safePick(POWER_TASKS[h.power], "Run district operation");
    const selected = getSelectedHex();
    const zoneHexes = w.hexes.filter(function (hex) { return hex.zone === h.zone && (!selected || hex.id !== selected.id); });
    const taskHex = safePick(zoneHexes, zoneHexes[0]) || selected;
    const rewardCredits = 120 + safeRoll(8) * 20;
    const rollStat = "valor";
    const taskDread = taskDreadForZone(h.zone);

    const t = {
      id: taskId,
      holdingId: holdingId,
      power: h.power,
      title: title,
      hexId: taskHex ? taskHex.id : null,
      status: "active",
      rollStat: rollStat,
      dread: taskDread,
      rewardCredits: rewardCredits,
      rewardTier: taskDread >= 10 ? "challenging" : (taskDread >= 8 ? "medium" : "easy")
    };

    w.activeTasks.unshift(t);
    syncWorldMarkers();
    if (typeof showNotif === "function") showNotif("Task accepted: " + title + ". Travel to district and resolve.", "good");
    if (registerWorldAction("task accept")) return;
    renderWorldThatWas();
  }

  function recordWtwSuccessRoll() {
    if (typeof S === "undefined") return;
    if (window.BTLRules && typeof window.BTLRules.awardSuccessfulRoll === "function") {
      window.BTLRules.awardSuccessfulRoll("world-that-was-success");
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

  function completeHoldingTask(taskId) {
    const w = ensureWorldState();
    if (!w) return;
    const t = w.activeTasks.find(function (x) { return x.id === taskId; });
    if (!t) return;

    const selected = getSelectedHex();
    // Allow completion from any hex if hexId is null; otherwise require matching hex
    if (t.hexId && (!selected || selected.id !== t.hexId)) {
      if (typeof showNotif === "function") showNotif("Travel to the task district to complete. Track the marker for guidance.", "warn");
      return;
    }
    if (!selected) {
      if (typeof showNotif === "function") showNotif("Select a district hex before completing a task.", "warn");
      return;
    }

    const dreadDie = t.dread || taskDreadForZone(selected.zone);
    const valorDie = getActionDie("valor");

    const processTaskCheck = function (check) {
      const rollSummary = "Valor d" + valorDie + " [" + check.actionTotal + "] vs Dread " + dreadLabel(dreadDie) + " [" + check.dreadTotal + "]";

      if (!check.success) {
        // Deferred: store state, show modal with player options — task stays active until resolved
        window._pendingWtwTaskRoll = {
          taskId: taskId,
          task: t,
          check: check,
          adventureDie: valorDie,
          dreadDie: dreadDie,
          rollSummary: rollSummary,
          hexId: selected.id,
          zone: selected.zone
        };
        openTaskResultModal(t, check, rollSummary, false, valorDie, dreadDie);
        return;
      }

      // SUCCESS
      t.status = "done";
      addPowerRenown(t.power, 1);
      addZoneReputation(selected.zone, 2);
      addWorldItem("dataDrives", 1);
      addWorldItem("fuelCells", 1);
      grantRandomLoot(t.rewardTier || "medium");
      const credits = t.rewardCredits || 150;
      setCredits(getCredits() + credits);

      // Success streak → Path Token at milestone
      recordWtwSuccessRoll();

      // Renown bump on challenging tasks
      if (dreadDie >= 10) {
        if (typeof changeCounter === "function") changeCounter("renown", 1);
      }

      if (typeof showNotif === "function") {
        showNotif("Task complete: " + rollSummary + (check.manual ? " [manual]" : "") + ". +" + credits + "₵ · Streak +1 · +1 " + t.power + " renown.", "good");
      }

      openTaskResultModal(t, check, rollSummary, true, valorDie, dreadDie);

      w.activeTasks = w.activeTasks.filter(function (x) { return x.id !== taskId; });
      if (t.hexId) delete w.markers[t.hexId];
      syncWorldMarkers();
      advanceWorldTime("holding task");
      if (registerWorldAction("task complete")) return;
      renderWorldThatWas();
    };

    if (isWtwManualRollModeEnabled()) {
      openWtwManualActionDreadPrompt({
        title: "Manual Roll - Complete Task",
        context: "World That Was holding task",
        statKey: "valor",
        statLabel: "Valor",
        actionDie: valorDie,
        dreadDie: dreadDie,
        onResolve: function (outcome) {
          processTaskCheck({
            success: !!(outcome && outcome.success),
            vd: valorDie,
            dd: dreadDie,
            actionTotal: Number((outcome && outcome.actionTotal) || 0),
            dreadTotal: Number((outcome && outcome.dreadTotal) || 0),
            manual: true,
            pushLuck: !!(outcome && outcome.pushLuck)
          });
        }
      });
      return;
    }

    processTaskCheck(rollAgainstDread("valor", dreadDie));
  }

  function openTaskResultModal(task, check, rollSummary, success, adventureDie, dreadDie) {
    if (typeof openModal !== "function") return;
    const color = success ? "var(--teal)" : "#ff6060";
    const icon = success ? "✓ SUCCESS" : "✗ FAILURE";
    const html = ""
      + "<div style='text-align:center;font-family:Cinzel,serif;font-size:1.1rem;color:" + color + ";margin-bottom:.6rem;letter-spacing:.08em;'>" + icon + "</div>"
      + "<div style='display:flex;justify-content:center;gap:1.5rem;margin-bottom:.7rem;'>"
      + "<div style='text-align:center;'><div style='font-size:.72rem;color:var(--muted2);margin-bottom:.2rem;'>Valor d" + adventureDie + "</div>"
      + "<div style='font-size:2rem;font-weight:700;color:" + (success ? "var(--teal)" : "var(--text2)") + ";'>" + check.actionTotal + "</div></div>"
      + "<div style='text-align:center;padding-top:.6rem;font-size:1.4rem;color:var(--muted2);'>vs</div>"
      + "<div style='text-align:center;'><div style='font-size:.72rem;color:var(--muted2);margin-bottom:.2rem;'>Dread " + dreadLabel(dreadDie) + "</div>"
      + "<div style='font-size:2rem;font-weight:700;color:#e05050;'>" + check.dreadTotal + "</div></div>"
      + "</div>"
      + "<div style='font-size:.8rem;color:var(--text2);margin-bottom:.5rem;text-align:center;'>" + task.title + " · " + task.power + "</div>"
      + (success
        ? ("<div style='font-size:.82rem;color:var(--text2);line-height:1.6;'>"
          + "<strong style='color:var(--teal);'>Rewards:</strong><br>"
          + "+" + (task.rewardCredits || 150) + " Credits &nbsp;·&nbsp; +1 Success Streak · Loot granted<br>"
          + "+1 " + task.power + " Renown &nbsp;·&nbsp; +2 Zone Reputation"
          + (dreadDie >= 10 ? " &nbsp;·&nbsp; +1 Renown (High Danger)" : "")
          + "</div>"
          + "<div style='text-align:right;margin-top:.7rem;'>"
          + "<button class='btn btn-sm btn-primary' onclick='closeModal()'>Continue</button>"
          + "</div>")
        : ("<div style='background:rgba(255,96,96,.07);border:1px solid rgba(255,96,96,.25);padding:.4rem .55rem;border-radius:4px;margin-bottom:.55rem;'>"
          + "<div style='font-size:.76rem;font-family:Cinzel,serif;color:#ff6060;margin-bottom:.2rem;'>Task Failed — Choose Your Response</div>"
          + "<div style='font-size:.77rem;color:var(--text2);line-height:1.6;'>"
          + "<strong style='color:var(--teal);'>Accept Failure:</strong> Task removed, skirmish triggered, earn <strong style='color:var(--teal);'>+1 Teamwork Point</strong>.<br>"
          + "<strong style='color:#c9a227;'>Spend 3 Teamwork:</strong> Convert to success, keep task rewards. You have <strong style='color:var(--teal);'>" + ((typeof S !== "undefined" && S.tmw) || 0) + " Teamwork</strong>.<br>"
          + "<strong style='color:#f0a050;'>Push Your Luck:</strong> Spend 2 Teamwork and re-roll vs <strong style='color:#f0a050;'>Dread " + dreadLabel(stepDreadDie(dreadDie, 1)) + "</strong>. Win = full success + stat condition. Lose = fail +1 Teamwork + negative condition."
          + "</div>"
          + "</div>"
          + "<div style='display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;'>"
          + "<button class='btn btn-sm' onclick='wtwAcceptTaskFail()'>Accept (+1 Teamwork)</button>"
          + "<button class='btn btn-sm btn-teal' " + (((typeof S !== "undefined" && S.tmw) || 0) >= 3 ? "" : "disabled title='Need 3 Teamwork'") + " onclick='wtwSpendTeamworkOnTask()'>Spend 3 Teamwork → Succeed</button>"
          + "<button class='btn btn-sm' style='background:rgba(240,160,80,.18);border-color:rgba(240,160,80,.5);color:#f0a050;' " + (((typeof S !== "undefined" && S.tmw) || 0) >= 2 ? "" : "disabled title='Need 2 Teamwork'") + " onclick='wtwPushTaskLuck()'>Push Luck 2 TMW (" + dreadLabel(stepDreadDie(dreadDie, 1)) + ")</button>"
          + "</div>"))
    openModal("Task: " + task.title, html);
  }

  function jumpToTaskHex(taskId) {
    const w = ensureWorldState();
    if (!w) return;
    const t = w.activeTasks.find(function (x) { return x.id === taskId; });
    if (!t || !t.hexId) return;
    w.selectedHexId = t.hexId;
    const hex = hexById(t.hexId);
    if (hex) w.currentZone = hex.zone;
    renderWorldThatWas();
  }

  function travelByTrainTo(zoneName) {
    const w = ensureWorldState();
    if (!w) return;
    const selected = getSelectedHex();
    if (!selected || !selected.station) {
      if (typeof showNotif === "function") showNotif("Rail travel requires standing on a rail station hex.", "warn");
      return;
    }
    if (w.currentZone === zoneName) {
      if (typeof showNotif === "function") showNotif("Already in " + zoneName + ".", "warn");
      return;
    }

    const zone = w.zones.find(function (z) { return z.name === zoneName; });
    if (!zone || !zone.stationHexId) {
      if (typeof showNotif === "function") showNotif("No rail station available in " + zoneName + ".", "warn");
      return;
    }

    if (!spendCredits(30, "train travel")) return;

    w.currentZone = zoneName;
    if (zone && zone.stationHexId) {
      w.selectedHexId = zone.stationHexId;
    }

    advanceWorldTime("train travel");
    if (registerWorldAction("train")) return;
    if (typeof showNotif === "function") showNotif("Traveled by rail to " + zoneName + " for 30 Credits.", "good");
    renderWorldThatWas();
  }

  function advanceWorldThatWas(fromActivity) {
    const w = ensureWorldState();
    if (!w || !w.hexes.length) return;

    w.tick += 1;

    const shifts = Math.max(2, safeRoll(5));
    for (let i = 0; i < shifts; i += 1) {
      const weighted = [];
      w.hexes.forEach(function (hex) {
        const weight = Math.max(1, 1 + dangerForZone(hex.zone).cycleShiftBonus);
        for (let wi = 0; wi < weight; wi += 1) weighted.push(hex);
      });
      const target = safePick(weighted, null);
      if (!target) break;
      target.controller = safePick(HOLDERS, target.controller);
      if (safeRoll(100) <= Math.min(70, 24 + getPactAdjustedSkirmishChance(target.zone))) target.skirmish = true;
    }

    w.hexes.forEach(function (hex) {
      const danger = dangerForZone(hex.zone);
      const pactDelta = getPactSkirmishDelta();
      const spawnChance = Math.max(4, Math.floor(getPactAdjustedSkirmishChance(hex.zone) / 2));
      const calmChance = Math.max(6, 24 - danger.cycleShiftBonus * 3 - pactDelta * 4);
      if (!hex.skirmish && safeRoll(100) <= spawnChance) hex.skirmish = true;
      if (hex.skirmish && safeRoll(100) <= calmChance) hex.skirmish = false;
      if (safeRoll(100) <= Math.max(8, Math.floor(danger.encounterChance / 3))) {
        hex.narrative.event = buildWorldEvent(hex.zone, safePick((ZONE_FLAVOR[hex.zone] || ZONE_FLAVOR["Cyber Hub"]).events, hex.narrative.event));
      }
    });

    applyPactSkirmishDensityPressure(w, false);

    updateZoneControl();
    syncWorldMarkers();
    advanceWorldTime("control cycle");
    if (typeof showNotif === "function" && !fromActivity) showNotif("Control cycle advanced manually.", "good");
    renderWorldThatWas();
  }

  function renderPowerReadout() {
    const w = ensureWorldState();
    const wrap = document.getElementById("wtwPowerReadout");
    if (!wrap || !w) return;

    const chips = HOLDERS.map(function (name) {
      let count = 0;
      w.hexes.forEach(function (hex) { if (hex.controller === name) count += 1; });
      return "<span class='sea-chip' style='border-color:" + controllerColor(name) + ";color:" + controllerColor(name) + ";'>" + name + ": " + count + "</span>";
    }).join(" ");

    wrap.innerHTML = chips;
  }

  function renderHoldingsPanel(hex) {
    const w = ensureWorldState();
    if (!w || !hex) return "";

    const holdings = w.holdings.filter(function (h) { return h.zone === hex.zone; });
    if (!holdings.length) return "<div class='wtw-muted'>No power holdings registered in this zone.</div>";

    return holdings.map(function (h) {
      return ""
        + "<div class='wtw-list-card'>"
        + "<div class='title'>" + h.name + " · " + h.power + "</div>"
        + "<div class='meta'>"
        + "Mood: " + h.mood + "<br>Crisis: " + h.crisis + ""
        + "</div>"
        + "<div class='actions'>"
        + "<button class='btn btn-xs btn-primary' onclick='wtwTakeHoldingTask(\"" + h.id + "\")'>Take Task</button>"
        + "</div>"
        + "</div>";
    }).join("");
  }

  const DREAD_DIE_LABELS = { 4: "D4", 6: "D6", 8: "D8", 10: "D10", 12: "D12", 20: "D20" };

  function dreadLabel(die) {
    return DREAD_DIE_LABELS[die] || ("D" + die);
  }

  function taskDreadForZone(zoneName) {
    const danger = dangerForZone(zoneName || "Cyber Hub");
    if (danger.eventDreadBias >= 2) return 10;
    if (danger.eventDreadBias >= 1) return 8;
    if (danger.eventDreadBias <= -1) return 4;
    return 6;
  }

  function renderActiveTasksPanel() {
    const w = ensureWorldState();
    if (!w) return "";

    if (!w.activeTasks.length) {
      return "<div class='wtw-muted'>No active holding tasks.</div>";
    }

    return w.activeTasks.slice(0, 5).map(function (t) {
      const taskHex = hexById(t.hexId);
      const selected = getSelectedHex();
      const atLocation = t.hexId
        ? (!!selected && selected.id === t.hexId)
        : !!selected;
      const dieLabel = dreadLabel(t.dread || 6);
      const zoneDanger = taskHex ? dangerForZone(taskHex.zone) : null;
      const dangerTag = zoneDanger
        ? (zoneDanger.eventDreadBias >= 2 ? "<span style='color:#ff6060;font-size:.7rem;'> ⚠ High Danger</span>"
          : zoneDanger.eventDreadBias >= 1 ? "<span style='color:#f0a050;font-size:.7rem;'> ⚠ Moderate Danger</span>"
          : "")
        : "";
      return ""
        + "<div class='wtw-list-card'>"
        + "<div class='title'>" + t.title + dangerTag + "</div>"
        + "<div class='meta'>Power: " + t.power + " · Target: " + (taskHex ? (taskHex.zone + " / " + taskHex.district) : "Any district") + "</div>"
        + "<div class='meta' style='color:var(--gold2);'>"
        + "⚄ Roll: Valor vs " + dieLabel
        + " · Reward: " + (t.rewardCredits || 150) + "₵ + Loot + 1 Data Drive + 1 Fuel Cell"
        + "</div>"
        + "<div class='meta' style='color:var(--muted2);font-size:.72rem;'>"
        + "Success: +1 Successful Roll + 1 " + t.power + " renown + 2 Zone Reputation"
        + "<br>Failure: accept for +1 Teamwork and a skirmish, spend 3 Teamwork to convert, or Push Luck vs " + dreadLabel(stepDreadDie(t.dread || 6, 1))
        + "</div>"
        + "<div class='actions'>"
        + "<button class='btn btn-xs' onclick='wtwTrackTask(\"" + t.id + "\")'>Track</button>"
        + "<button class='btn btn-xs btn-teal' onclick='wtwCompleteTask(\"" + t.id + "\")'" + (atLocation ? "" : " title='Travel to task district first' disabled") + ">Roll Valor vs " + dieLabel + "</button>"
        + "</div>"
        + "</div>";
    }).join("");
  }

  function renderSkirmishWidget(hex) {
    const w = ensureWorldState();
    if (!w || !hex || !hex.skirmish) {
      return "<div class='wtw-muted'>No active skirmish in this district.</div>";
    }

    const st = w.skirmishState || {};
    const ready = st.activeHexId === hex.id;

    if (!ready) {
      return ""
        + "<div class='wtw-card'>"
        + "<div class='wtw-card-title' style='color:#e05050;'>Active Skirmish</div>"
        + "<div class='wtw-card-text'>Initialize skirmish controls in this panel, or open full Combat tab.</div>"
        + "<div class='wtw-card-actions'>"
        + "<button class='btn btn-xs btn-red' onclick='wtwInitSkirmish()'>Init Skirmish Controls</button>"
        + "<button class='btn btn-xs btn-teal' onclick='openWorldSkirmishCombat()'>Open Combat + Quick Access</button>"
        + "<button class='btn btn-xs' onclick='resolveWorldSkirmish()'>Quick Resolve</button>"
        + "</div>"
        + "</div>";
    }

    return ""
      + "<div class='wtw-card'>"
      + "<div class='wtw-card-title' style='color:#e05050;'>Skirmish Controls</div>"
      + "<div class='wtw-card-text'>Round " + st.round + " · Actions reset together at 0/0.</div>"
      + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:.4rem;'>"
      + "<div>"
      + "<div style='font-size:.74rem;color:var(--text2);'>Your Army Stress: <strong style='color:var(--teal);'>" + st.armyAStress + "</strong></div>"
      + "<div style='font-size:.72rem;color:var(--muted2);margin-bottom:.2rem;'>Actions: " + st.armyAActions + " · Dread: d" + st.armyADread + "</div>"
      + "<div style='display:flex;gap:.2rem;flex-wrap:wrap;'>"
      + "<button class='btn btn-xs btn-primary' onclick='wtwSkAction(\"A\",\"strike\")'>Strike</button>"
      + "<button class='btn btn-xs btn-teal' onclick='wtwSkAction(\"A\",\"parry\")'>Parry</button>"
      + "<button class='btn btn-xs' onclick='wtwSkAction(\"A\",\"frighten\")'>Frighten</button>"
      + "</div>"
      + "</div>"
      + "<div>"
      + "<div style='font-size:.74rem;color:var(--text2);'>Enemy Army Stress: <strong style='color:var(--red);'>" + st.armyBStress + "</strong></div>"
      + "<div style='font-size:.72rem;color:var(--muted2);margin-bottom:.2rem;'>Actions: " + st.armyBActions + " · Dread: d" + st.armyBDread + "</div>"
      + "<div style='display:flex;gap:.2rem;flex-wrap:wrap;'>"
      + "<button class='btn btn-xs btn-red' onclick='wtwSkAction(\"B\",\"strike\")'>Strike</button>"
      + "<button class='btn btn-xs' onclick='wtwSkAction(\"B\",\"parry\")'>Parry</button>"
      + "<button class='btn btn-xs' onclick='wtwSkAction(\"B\",\"frighten\")'>Frighten</button>"
      + "</div>"
      + "</div>"
      + "</div>"
      + "<div class='wtw-card-actions'>"
      + "<button class='btn btn-xs btn-red' onclick='openWorldSkirmishCombat()'>Open Combat + Quick Access</button>"
      + "<button class='btn btn-xs' onclick='resolveWorldSkirmish()'>Quick Resolve</button>"
      + "</div>"
      + "</div>";
  }

  function buildWtwAccordion(title, body, opened) {
    return ""
      + "<details class='wtw-accordion'" + (opened ? " open" : "") + ">"
      + "<summary>" + title + "</summary>"
      + "<div class='wtw-accordion-body'>" + body + "</div>"
      + "</details>";
  }

  function isWorldAccordionOpen(key, fallback) {
    const w = ensureWorldState();
    if (!w || !w.ui || !w.ui.openAccordions) return !!fallback;
    if (typeof w.ui.openAccordions[key] !== "boolean") return !!fallback;
    return !!w.ui.openAccordions[key];
  }

  function setWorldAccordionOpen(key, open) {
    const w = ensureWorldState();
    if (!w) return;
    w.ui = w.ui || {};
    w.ui.openAccordions = w.ui.openAccordions || {};
    w.ui.openAccordions[key] = !!open;
  }

  function buildWtwAccordionStateful(title, body, fallbackOpen, key) {
    const opened = isWorldAccordionOpen(key, fallbackOpen);
    return ""
      + "<details class='wtw-accordion'" + (opened ? " open" : "") + " ontoggle='wtwSetAccordion(\"" + key + "\", this.open)'>"
      + "<summary>" + title + "</summary>"
      + "<div class='wtw-accordion-body'>" + body + "</div>"
      + "</details>";
  }

  function buildWtwTravelSceneCombatSeed(hex) {
    if (!hex) return null;
    const portrait = (S && S.identityForge && S.identityForge.media && S.identityForge.media.portrait)
      ? String(S.identityForge.media.portrait)
      : "";
    const wayfarerName = String((S && S.name) || "Wayfarer");
    const dread = Math.max(6, Number((hex.encounter && hex.encounter.dread) || 8));
    const enemyCount = Math.max(1, Number((hex.encounter && hex.encounter.enemies) || 1));
    const enemyName = String((hex.encounter && hex.encounter.enemyName) || "District Hostile");
    const tokens = [{
      id: "wtw-wayfarer-" + Date.now().toString(36),
      name: wayfarerName,
      faction: "player",
      hp: 12,
      maxHp: 12,
      status: [],
      q: 0,
      r: 0,
      image: portrait,
      size: 1,
      isPlayer: true
    }];
    for (let i = 0; i < enemyCount; i += 1) {
      tokens.push({
        id: "wtw-enemy-" + i + "-" + Date.now().toString(36),
        name: enemyName + (enemyCount > 1 ? (" " + String(i + 1)) : ""),
        faction: "monster",
        hp: dread * 2,
        maxHp: dread * 2,
        status: [],
        q: 3 + i,
        r: i % 2,
        image: "",
        size: 1,
        dread: dread,
        deathNumber: Math.max(1, Math.ceil((dread * 2) / 2))
      });
    }
    return {
      id: "wtw-scene-" + String(hex.id || Date.now()),
      name: "World That Was Scene · " + String(hex.district || hex.id || "District"),
      tokens: tokens,
      history: ["World That Was scene loaded: " + String(hex.district || hex.id || "District") + ".", "Hostiles seeded: " + String(enemyCount) + "."]
    };
  }

  function launchWtwHexToCombat(hexId) {
    const w = ensureWorldState();
    if (!w || !Array.isArray(w.hexes)) return;
    const hex = w.hexes.find(function (entry) { return entry && String(entry.id) === String(hexId || ""); }) || getSelectedHex();
    if (!hex) return;
    if (typeof window.getActiveScopedTravelScene === 'function' && !window.getActiveScopedTravelScene('worldthatwas', String(hex.id || ''))) {
      if (typeof showNotif === 'function') showNotif('Create and load a Travel Scene first.', 'warn');
      return;
    }
    const seed = buildWtwTravelSceneCombatSeed(hex);
    const finalSeed = (typeof window.applyScopedTravelSceneToCombatSeed === 'function')
      ? window.applyScopedTravelSceneToCombatSeed('worldthatwas', String(hex.id || ''), seed)
      : seed;
    if (finalSeed && typeof window.openCombatSceneEditor === "function") {
      window.openCombatSceneEditor(finalSeed);
      if (typeof showNotif === "function") showNotif("Launching Combat Mode from World That Was district " + String(hex.id) + ".", "good");
    } else if (typeof showNotif === "function") {
      showNotif("Combat Mode is unavailable.", "warn");
    }
  }

  function buildWtwTravelSceneCard(hex) {
    if (!hex) return "";
    if (typeof window.buildScopedTravelSceneCard !== 'function') return '';
    return window.buildScopedTravelSceneCard({
      scope: 'worldthatwas',
      key: String(hex.id || ''),
      scopeLabel: 'World That Was',
      intro: 'Create or load a district encounter scene, then launch it into Combat Mode.',
      selectedLabel: 'Selected District: ' + String(hex.id || '?') + ' · ' + String(hex.district || hex.zone || 'Unknown'),
      launchCall: 'launchWtwHexToCombat("' + String(hex.id || '').replace(/\"/g, '&quot;') + '")'
    });
  }

  function openWorldThatWasCampaignSceneCheck(hexId) {
    const hex = hexId ? hexById(hexId) : getSelectedHex();
    if (!hex || !window.campaignSystem || typeof window.campaignSystem.requestSceneCheck !== "function") {
      if (typeof showNotif === "function") showNotif("Campaign scene checks are unavailable here.", "warn");
      return false;
    }
    const label = String(hex.zone || "World That Was") + " - " + String(hex.district || ("District " + String(hex.id || "")));
    return window.campaignSystem.requestSceneCheck({
      title: "World That Was Scene Check",
      label: "World That Was Scene Check",
      context: "World That Was · " + label,
      type: "scene-check",
      stat: "lead",
      dread: 8,
      successRewardType: "none",
      successRewardAmount: 0,
      failurePenaltyType: "mentalStress",
      failurePenaltyAmount: 1,
      failTmw: 1,
      stake: "The GM chooses who acts, who takes the consequence, and whether the table rolls digitally or physically.",
      playerRequestMessage: "🌆 Requesting a World That Was scene check at " + label + " so the GM can assign the acting wayfarer."
    });
  }

  function renderWorldThatWasInfo() {
    const w = ensureWorldState();
    const panel = document.getElementById("wtwInfo");
    if (!panel || !w) return;

    const hex = getSelectedHex();
    if (!hex) {
      panel.innerHTML = "<div class='hex-info-inner'><div class='wtw-muted'>Generate the map and select a district hex.</div></div>";
      return;
    }

    const marker = w.markers[hex.id];
    const zone = zoneForHex(hex);
    const zoneRep = w.zoneReputation && typeof w.zoneReputation[hex.zone] === "number" ? w.zoneReputation[hex.zone] : 0;
    const services = zoneServicesForHex(hex);
    const n = hex.narrative;
    const evt = n.event || {};
    const markerTypeLabel = marker && WTW_MARKER_STYLE[marker.type] ? WTW_MARKER_STYLE[marker.type].title : "District Marker";
    const eventDread = normalizeDreadDie(evt.dread || 8, 8);
    const eventEnemyName = String(evt.enemyName || 'Ash Revenant');
    const eventEnemyHealth = Math.max(4, Number(evt.enemyHealth || (eventDread * 2)));
    const eventDeathNumber = Math.max(1, Math.ceil(eventEnemyHealth / 2));
    const eventCheck = evt.mode === "combat"
      ? ("<strong>Combat Encounter:</strong> " + (evt.enemies || 2) + " " + eventEnemyName + ((evt.enemies || 2) > 1 ? "s" : "") + " (DD" + eventDread + " | " + eventEnemyHealth + " HP each | Death Number " + eventDeathNumber + ")")
      : ("<strong>Check:</strong> Valor d" + getActionDie("valor") + " vs DD" + eventDread);

    const gmMode = !!(window.settingsSystem && typeof window.settingsSystem.isGMMode === "function" && window.settingsSystem.isGMMode());
    const campaignSceneAvailable = !!(window.campaignSystem && typeof window.campaignSystem.getState === "function" && (window.campaignSystem.getState() || {}).code && (window.campaignSystem.getState() || {}).connected);
    const gmEncounterControls = (gmMode && hex.encounter && hex.encounter.mode !== "combat" && hex.encounter.mode !== "wayfarer")
      ? "<button class='btn btn-xs' style='border-color:var(--purple);color:var(--purple);' onclick='wtwResolveEncounterAs(\"success\")'>GM: Force Success</button><button class='btn btn-xs' style='border-color:var(--purple);color:var(--purple);' onclick='wtwResolveEncounterAs(\"failure\")'>GM: Force Failure</button>"
      : "";
    const encounterSummary = hex.encounter
      ? (hex.encounter.mode === "combat"
        ? ((hex.encounter.enemies || 2) + " " + String(hex.encounter.enemyName || 'Ash Revenant') + ((hex.encounter.enemies || 2) > 1 ? "s" : "") + " (DD" + normalizeDreadDie(hex.encounter.dread || 8, 8) + " | " + (hex.encounter.enemyHealth || 16) + " HP each | Death Number " + Math.max(1, Math.ceil(Number(hex.encounter.enemyHealth || 16) / 2)) + ")" + (hex.encounter.enemyDesc ? "<br><em>" + hex.encounter.enemyDesc + "</em>" : ""))
        : (hex.encounter.mode === "wayfarer"
          ? "Social encounter (no action check required)."
          : (statLabel(hex.encounter.stat || "valor") + " vs DD" + normalizeDreadDie(hex.encounter.dread || 8, 8))))
      : "";
    const encounterPressure = getWtwEncounterPressureSummary(hex);
    const encounterActions = hex.encounter
      ? (hex.encounter.mode === "combat"
        ? ("<button class='btn btn-xs btn-red' onclick='wtwResolveEncounter()'>Open Combat + Quick Access</button><button class='btn btn-xs btn-teal' onclick='wtwWinCombatEncounter(\"" + hex.id + "\")'>Victory</button><button class='btn btn-xs btn-warn' onclick='wtwFailCombatEncounter(\"" + hex.id + "\")'>Defeat</button>")
        : ("<button class='btn btn-xs btn-teal' onclick='wtwResolveEncounter()'>Roll " + statLabel(hex.encounter.stat || "valor") + " vs DD" + normalizeDreadDie(hex.encounter.dread || 8, 8) + "</button><button class='btn btn-xs btn-primary' onclick='wtwResolveEncounterAs(\"success\")'>Manual Success</button><button class='btn btn-xs btn-warn' onclick='wtwResolveEncounterAs(\"failure\")'>Manual Failure</button>" + gmEncounterControls))
      : "";
    const encounterHtml = hex.encounter
      ? ("<div class='wtw-card'><div class='wtw-card-title'>Rolled Encounter" + (gmMode ? " <span style='font-size:.62rem;color:var(--purple);'>(GM)</span>" : "") + "</div><div class='wtw-card-text'><strong>" + hex.encounter.title + "</strong><br>" + hex.encounter.text + "<br>" + encounterSummary + "<br><strong>Weather Pressure:</strong> " + encounterPressure.weatherLabel + (encounterPressure.weatherHazard ? " (hazardous)" : "") + "<br><strong>Rival Pressure:</strong> " + encounterPressure.rivalLabel + "</div><div class='wtw-card-actions'>" + encounterActions + "</div></div>")
      : "<div class='wtw-muted'>No rolled encounter in this district.</div>";
    const activityHtml = "<div class='wtw-card'><div class='wtw-card-title'>Living World Activity</div><div class='wtw-card-text'>Activity clock: <strong>" + String(w.activityClicks || 0) + "/10</strong>. Random encounters and services push this toward the next control-cycle shift.</div></div>";

    const cyberpunkHoldingCatalog = {
      "Cyber Hub": [
        { name: "Ghostline Exchange", desc: "Broker hub for stolen route keys and cracked authority tokens." },
        { name: "Null Signal Atrium", desc: "A high-band relay vault where syndicates trade live surveillance access." },
        { name: "Prism Coil Annex", desc: "Augment technicians run covert tune-ups behind mirrored terminals." },
        { name: "Cinderstack Node", desc: "Encrypted market node dealing in blackline logistics and courier contracts." }
      ],
      "Green House": [
        { name: "Verdant Cipher Nursery", desc: "Biohackers cultivate engineered flora masking contraband circuits." },
        { name: "Chlorowire Conservatory", desc: "A fogged greenhouse ring where med-tech guilds hide prototypes." },
        { name: "Pollen Gate Foundry", desc: "Hybrid botany-forge retrofitting tools for expedition crews." },
        { name: "Mycel Vault Arcade", desc: "Underground data fungi archives coded in living tissue." }
      ],
      "Industrial Sector": [
        { name: "Iron Pulse Junction", desc: "Shift foremen and smugglers cut deals beside live heat pipes." },
        { name: "Blastline Kiln Yard", desc: "Weapon parts and salvage contracts move through rolling furnace tracks." },
        { name: "Rivet Court Terminal", desc: "A fortified dispatch tower routing militia and freight claims." },
        { name: "Smogglass Forgebank", desc: "Credit lenders and blacksmith crews operate under armored skylights." }
      ],
      "Neon City": [
        { name: "Afterglow Parlour", desc: "Influence brokers host encrypted parties for district elites." },
        { name: "Mirage Spine Loft", desc: "VR tacticians stage rehearsed heists inside mirrored sims." },
        { name: "Pulse District Arcade", desc: "Street crews settle turf pacts through rigged holo games." },
        { name: "Nightwire Embassy", desc: "Neutral venue where rival crews negotiate ceasefires and raids." }
      ],
      "Outskirts": [
        { name: "Scrap Crown Depot", desc: "Nomad scouts swap hazard maps and reinforced convoy plates." },
        { name: "Dust Circuit Yard", desc: "Broken transit shells repurposed into mobile operations bays." },
        { name: "Dryline Signal Barn", desc: "A low-profile relay clearing storms and route blackout alerts." },
        { name: "Hardpan Refuel Ring", desc: "Fuel brokers and scouts stabilize long-haul corridor runs." }
      ],
      "Residential Blocks": [
        { name: "Skybridge Commons", desc: "Tenant councils broker security contracts and utility rights." },
        { name: "Waterline Forum", desc: "Civic fixers run mutual aid ledgers with hidden intelligence trails." },
        { name: "Lantern Block Hub", desc: "Neighborhood captains coordinate rapid-response district patrols." },
        { name: "Towerside Circuit Hall", desc: "Community engineers maintain defense grids and emergency comms." }
      ],
      "The Undercity": [
        { name: "Black Echo Bastion", desc: "Subsurface sentries control hidden choke points and supply locks." },
        { name: "Phantom Rail Sanctum", desc: "Tunnel guides and couriers route covert movement below scanner nets." },
        { name: "Coalglass Reliquary", desc: "Relic wardens protect high-value artifacts from raider crews." },
        { name: "Depthline Market Cell", desc: "Silent auction chamber for contraband biotech and rail intel." }
      ],
      "The Wastes": [
        { name: "Sunscar Haven", desc: "Expedition crews stage long-range salvage runs beyond safe lanes." },
        { name: "Ashline Relay Camp", desc: "Signal experts maintain weather pings across dead radio fields." },
        { name: "Shatter Basin Lodge", desc: "Hardened refuge where hunters and medics trade survival kits." },
        { name: "Obsidian Drift Post", desc: "A roving command point for tracking relic storms and raider packs." }
      ],
      "The Ports": [
        { name: "Harbor Nocturne Yard", desc: "Dock syndicates process night cargo and covert passenger routes." },
        { name: "Tidelock Customs Den", desc: "Border fixers falsify manifests and reroute surveillance sweeps." },
        { name: "Anchorline Switchhouse", desc: "Signal operators control berth priority and blackout windows." },
        { name: "Brine Circuit Exchange", desc: "Smugglers and brokers settle maritime debts under coded beacons." }
      ],
      default: [
        { name: "Greyline Commons", desc: "A contested district holding balancing trade, intel, and security." },
        { name: "Static Vault", desc: "Encrypted operations center for local crews." },
        { name: "Dawnshift Annex", desc: "Staging hall for teams running city-edge contracts." },
        { name: "Hexwire Court", desc: "Neutral hall where claim disputes and pacts are brokered." }
      ]
    };

    const districtHoldings = cyberpunkHoldingCatalog[hex.zone] || cyberpunkHoldingCatalog.default;
    const zoneHoldings = Array.isArray(w.holdings) ? w.holdings.filter(function (h) { return h && h.zone === hex.zone; }) : [];
    const startIndex = districtHoldings.length ? ((Number(hex.col || 0) * 3 + Number(hex.row || 0)) % districtHoldings.length) : 0;
    const selectedDistrictHoldings = [];
    for (let i = 0; i < Math.min(3, districtHoldings.length); i += 1) {
      selectedDistrictHoldings.push(districtHoldings[(startIndex + i) % districtHoldings.length]);
    }

    const holdingsHtml = selectedDistrictHoldings.map(function (entry, idx) {
      const holdingName = String((entry && entry.name) || ("District Holding " + (idx + 1)));
      const holdingDesc = String((entry && entry.desc) || "A fortified district node with active contracts.");
      const linkedHolding = zoneHoldings[idx] || null;
      const taskButton = linkedHolding
        ? ("<button class='btn btn-xs' onclick='wtwTakeHoldingTask(\"" + String(linkedHolding.id || "") + "\")'>Take Task</button>")
        : "";
      return ""
        + "<div class='wtw-list-card' style='border-color:rgba(120,220,200,.3);'>"
        + "<div class='title'>" + holdingName + " <span style='font-size:.62rem;color:var(--teal);text-transform:uppercase;letter-spacing:.06em;'>Holding</span></div>"
        + "<div class='meta'>" + holdingDesc + "<br>Controller: " + hex.controller + "</div>"
        + "<div class='actions'>"
        + taskButton
        + "</div>"
        + "</div>";
    }).join("");
    const holdingEntryName = String((selectedDistrictHoldings[0] && selectedDistrictHoldings[0].name) || (hex.zone + " Holding")).replace(/'/g, "\\'");
    const singleHoldingEntryHtml = "<div style='display:flex;justify-content:flex-end;margin-bottom:.35rem;'><button class='btn btn-xs btn-primary' onclick='if(typeof openRegionalSettlementHexcrawl===\"function\")openRegionalSettlementHexcrawl(\"ruins\",\"" + holdingEntryName + "\");else if(typeof openHoldingSettlementHexcrawl===\"function\")openHoldingSettlementHexcrawl(\"" + holdingEntryName + "\")'>◫ Enter Holding</button></div>";

    const hazardHtml = hex.hazard
      ? (hex.hazard.type === 'barrier'
        ? ("<div class='wtw-card' style='border-color:#ff9066;'><div class='wtw-card-title' style='color:#ff8a72;'>⛔ BARRIER: " + hex.hazard.name + "</div><div class='wtw-card-text'><strong>Description:</strong> " + hex.hazard.desc + "<br><strong>To Cross:</strong> Body vs DD6<br><strong>On fail:</strong> gain Weakened and cannot cross this phase</div><div class='wtw-card-actions'><button class='btn btn-xs btn-warn' onclick='resolveWtwBarrierCrossing(\"" + hex.id + "\")'>⚄ Attempt Crossing (Body vs DD6)</button></div></div>")
        : ("<div class='wtw-card'><div class='wtw-card-title' style='color:#ff8a72;'>" + (hex.hazard.type || "hazard").toUpperCase() + ": " + hex.hazard.name + "</div><div class='wtw-card-text'><strong>Risk:</strong> " + hex.hazard.desc + "<br><strong>Check:</strong> " + statLabel(hex.hazard.stat || "body") + " vs DD" + (hex.hazard.dread || 8) + "<br><strong>On fail:</strong> gain " + (hex.hazard.condition || "weakened") + "</div><div class='wtw-card-actions'><button class='btn btn-xs btn-red' onclick='wtwResolveHazard(\"" + hex.id + "\")'>Roll " + statLabel(hex.hazard.stat || "body") + " vs DD" + (hex.hazard.dread || 8) + "</button></div></div>"))
      : "<div class='wtw-muted'>No active district hazard in this hex.</div>";

    const wayfarerHtml = hex.wayfarer
      ? ("<div class='wtw-card'><div class='wtw-card-title' style='color:#d4b8ff;'>Wayfarer: " + hex.wayfarer.name + "</div><div class='wtw-card-text'><strong>Rumor:</strong> " + hex.wayfarer.rumor + "<br><strong>History:</strong> " + hex.wayfarer.history + "</div><div class='wtw-card-actions'><button class='btn btn-xs btn-teal' onclick='wtwTalkWayfarer(\"" + hex.id + "\")'>Talk</button><button class='btn btn-xs' onclick='if(typeof requestMapKnowledgeReveal===\"function\")requestMapKnowledgeReveal(\"wtw\",\"wayfarer\",{originKey:\""+ String(hex.id) +"\",title:\"World That Was Route Intel\"});'>Ask Route Intel</button></div></div>")
      : "<div class='wtw-muted'>No wayfarer currently visible.</div>";
    const districtIntelHtml = (hex.serviceNode || hex.station || hex.landingPad)
      ? ("<div class='wtw-card'><div class='wtw-card-title'>District Intel</div><div class='wtw-card-text'>Locals in this district can point the table toward nearby jobs, structures, transit routes, and trouble zones.</div><div class='wtw-card-actions'><button class='btn btn-xs btn-teal' onclick='if(typeof requestMapKnowledgeReveal===\"function\")requestMapKnowledgeReveal(\"wtw\",\"locals\",{originKey:\""+ String(hex.id) +"\",title:\"World That Was Local Knowledge\"});'>Ask Locals</button></div></div>")
      : "";

    const structureRooms = (hex.structure && Array.isArray(hex.structure.generatedRooms)) ? hex.structure.generatedRooms : [];
    const structureRoomHtml = structureRooms.length
      ? ("<div style='margin-top:.25rem;'>" + structureRooms.map(function (room, idx) {
          return "<div class='room-block'><div class='rb-title'>Room " + (idx + 1) + "</div><div class='rb-text'>" + room + "</div></div>";
        }).join("") + "</div>")
      : "<div class='wtw-muted' style='margin-top:.2rem;'>No rooms generated yet.</div>";

    const structureHtml = hex.structure
      ? ("<div class='wtw-card'><div class='wtw-card-title'>" + (hex.structure.kind || "Structure") + ": " + (hex.structure.name || "Unknown Site") + "</div><div class='wtw-card-text'>Enter and generate interior rooms for exploration.</div><div class='wtw-card-actions'><button class='btn btn-xs btn-primary' onclick='wtwJoinStructureArea(\"" + hex.id + "\")'>Join Area: Structure Interior</button></div>" + structureRoomHtml + "</div>")
      : "<div class='wtw-muted'>No explorable structure in this district.</div>";

    const nextRailZone = (function () {
      const idx = ZONE_NAMES.indexOf(hex.zone);
      if (idx < 0) return ZONE_NAMES[0];
      return ZONE_NAMES[(idx + 1) % ZONE_NAMES.length];
    })();
    const travelHtml = "<div class='wtw-card'>"
      + "<div class='wtw-card-title' style='color:#7ed7ff;'>Travel Infrastructure</div>"
      + "<div class='wtw-card-text'>"
      + (hex.station ? "This district contains a rail station. Rail travel costs 30 Credits to another station.<br>" : "No rail station in this district. Move to a station to use rail travel.<br>")
      + (hex.landingPad ? "Landing pad available: launch to space for 40 Credits." : "No landing pad in this district.")
      + "</div>"
      + (hex.station
        ? "<div class='wtw-card-actions'><button class='btn btn-xs btn-primary' onclick='wtwTravelRail(\"" + nextRailZone + "\")'>Rail To " + nextRailZone + "</button>" + (hex.landingPad ? "<button class='btn btn-xs btn-teal' onclick='wtwLaunchToSpace(\"" + hex.id + "\")'>Launch To Space</button>" : "") + "</div>"
        : (hex.landingPad ? "<div class='wtw-card-actions'><button class='btn btn-xs btn-teal' onclick='wtwLaunchToSpace(\"" + hex.id + "\")'>Launch To Space</button></div>" : ""))
      + "</div>";

    const controlRows = Object.keys((zone && zone.controlBreakdown) || {}).map(function (name) {
      return "<span style='display:inline-block;margin-right:.4rem;color:" + controllerColor(name) + ";'>" + name + ": " + zone.controlBreakdown[name] + "</span>";
    }).join(" ");

    const summaryGrid = ""
      + "<div class='wtw-mini-grid'>"
      + "<div class='wtw-mini-cell'><span class='lbl'>Controller</span>" + hex.controller + "</div>"
      + "<div class='wtw-mini-cell'><span class='lbl'>Zone Leader</span>" + ((zone && zone.leader) || "Unknown") + "</div>"
      + "<div class='wtw-mini-cell'><span class='lbl'>Zone Reputation</span>" + zoneRep + " (" + zoneRepTier(zoneRep) + ")</div>"
      + "<div class='wtw-mini-cell'><span class='lbl'>Danger Profile</span>" + dangerForZone(hex.zone).encounterChance + "% encounter / " + dangerForZone(hex.zone).skirmishChance + "% skirmish</div>"
      + "<div class='wtw-mini-cell'><span class='lbl'>Fauna / Flora</span>" + n.fauna + " / " + n.flora + "</div>"
      + "<div class='wtw-mini-cell'><span class='lbl'>Land / Weather</span>" + n.land + " / " + n.weather + "</div>"
      + "</div>";

    const eventCard = ""
      + "<div class='wtw-card'>"
      + "<div class='wtw-card-title'>Random Event</div>"
      + "<div class='wtw-card-text'><strong>" + evt.title + "</strong><br>" + evt.text + "<br><br><strong>Action:</strong> " + evt.action + "<br>" + eventCheck + "<br><strong>Reward:</strong> " + evt.reward + "</div>"
      + "<div class='wtw-card-actions'>"
      + (evt.mode === "combat"
        ? ("<button class='btn btn-xs btn-red' onclick='wtwResolveEvent(\"" + hex.id + "\")'>Open Combat + Quick Access</button><button class='btn btn-xs btn-teal' onclick='wtwWinCombatEvent(\"" + hex.id + "\")'>Victory</button><button class='btn btn-xs btn-warn' onclick='wtwFailCombatEvent(\"" + hex.id + "\")'>Defeat</button>")
        : ("<button class='btn btn-xs btn-primary' onclick='wtwResolveEvent(\"" + hex.id + "\")'>Roll Valor vs DD" + eventDread + "</button>"))
      + "<button class='btn btn-xs' onclick='wtwRollEncounter()'>Roll Encounter</button></div>"
      + "</div>";

    const markerHtml = marker
      ? ("<div class='wtw-card'><div class='wtw-card-title'>" + markerTypeLabel + "</div><div class='wtw-card-text'><strong>" + marker.title + "</strong><br>" + marker.subtitle + "</div><div class='wtw-card-actions'><button class='btn btn-xs btn-primary' onclick='wtwCollectMarker(\"" + hex.id + "\")'>Review Marker</button>" + (marker.type === "story" ? "<button class='btn btn-xs btn-teal' onclick='if(typeof openStorylineTab===\"function\")openStorylineTab()'>Continue Storyline</button>" : "") + "</div></div>")
      : "<div class='wtw-muted'>No marker in this district.</div>";
    const wtwOverlay = (typeof window.getWorldStateHexOverlayForRegion === "function")
      ? window.getWorldStateHexOverlayForRegion("wtw", String(hex.id))
      : null;
    const wtwGov = (typeof window.getRegionGovernancePolicyState === "function")
      ? window.getRegionGovernancePolicyState("wtw")
      : null;
    const wtwSignals = !!(wtwOverlay && (
      Number(wtwOverlay.tension || 0) !== 0
      || Number(wtwOverlay.safety || 0) !== 0
      || !!wtwOverlay.activeCrisis
      || !!wtwOverlay.closedBorder
      || !!wtwOverlay.closedPort
      || !!wtwOverlay.dangerousRoad
      || (Array.isArray(wtwOverlay.tags) && wtwOverlay.tags.length)
    ));
    const wtwActions = [];
    if (wtwOverlay && wtwOverlay.activeCrisis) {
      wtwActions.push("<button class='btn btn-xs btn-warn' onclick=\"if(typeof resolveWorldStateActionAtKeyForRegion==='function')resolveWorldStateActionAtKeyForRegion('wtw','" + String(hex.id) + "','stabilize');if(typeof renderWorldThatWas==='function')renderWorldThatWas();\">🧯 Stabilize Crisis</button>");
    }
    if (wtwOverlay && (wtwOverlay.closedBorder || wtwOverlay.closedPort || wtwOverlay.dangerousRoad)) {
      wtwActions.push("<button class='btn btn-xs btn-teal' onclick=\"if(typeof resolveWorldStateActionAtKeyForRegion==='function')resolveWorldStateActionAtKeyForRegion('wtw','" + String(hex.id) + "','reopen');if(typeof renderWorldThatWas==='function')renderWorldThatWas();\">🛣 Reopen Routes</button>");
    }
    const wtwWorldStateHtml = wtwSignals
      ? ("<div class='wtw-card'><div class='wtw-card-title'>World State</div><div class='wtw-card-text'>"
          + (wtwOverlay && wtwOverlay.control ? ("<strong>Control:</strong> " + wtwOverlay.control + "<br>") : "")
          + (wtwOverlay ? ("<strong>Tension:</strong> " + Number(wtwOverlay.tension || 0) + " · <strong>Safety:</strong> " + Number(wtwOverlay.safety || 0) + "<br>") : "")
          + (wtwOverlay && wtwOverlay.activeCrisis ? "<strong style='color:var(--red2);'>Active Crisis</strong><br>" : "")
          + (wtwOverlay && wtwOverlay.closedBorder ? "<strong>Borders:</strong> Restricted<br>" : "")
          + (wtwOverlay && wtwOverlay.closedPort ? "<strong>Ports:</strong> Restricted<br>" : "")
          + (wtwOverlay && wtwOverlay.dangerousRoad ? "<strong>Lanes:</strong> Dangerous<br>" : "")
          + (wtwGov ? ("<span style='font-size:.74rem;color:var(--muted2);'>Policy: Patrol <strong>" + String(wtwGov.patrolStance || "balanced") + "</strong> · Tariff <strong>" + String(wtwGov.tariffStance || "balanced") + "</strong> · Route <strong>" + String(wtwGov.routePriority || "trade") + "</strong></span>") : "")
          + "</div>"
          + (wtwActions.length ? ("<div class='wtw-card-actions'>" + wtwActions.join("") + "</div>") : "")
        + "</div>")
      : "";
    const backstoryAnchorHtml = (typeof window.buildBackstoryAnchorActionPanelHtml === "function")
      ? window.buildBackstoryAnchorActionPanelHtml("wtw", String(hex.id))
      : "";
    const celebrationStats = ["lead", "mind", "body", "spirit", "control", "strike", "shoot", "defend"];
    const celebrationHtml = hex.pendingServiceCelebration
      ? ("<div class='wtw-card'>"
          + "<div class='wtw-card-title'>District Celebration</div>"
          + "<div class='wtw-card-text'><strong>" + hex.pendingServiceCelebration.name + "</strong><br>"
          + "<strong>Success:</strong> " + hex.pendingServiceCelebration.success + "<br>"
          + "<strong>Failure:</strong> " + hex.pendingServiceCelebration.failure + "</div>"
          + "<div class='wtw-card-actions'>"
          + celebrationStats.map(function (key) {
              return "<button class='btn btn-xs btn-teal' onclick='wtwResolveCelebration(\"" + hex.id + "\",\"" + key + "\")'>" + statLabel(key) + " vs DD" + Number(hex.pendingServiceCelebration.dd || 6) + "</button>";
            }).join("")
          + "</div>"
        + "</div>")
      : (hex.serviceNode
        ? ("<div class='wtw-card'>"
            + "<div class='wtw-card-title'>District Celebration</div>"
            + "<div class='wtw-card-text'>Roll a downtime celebration for this district when the table wants an extra social beat, wager, or local complication.</div>"
            + "<div class='wtw-card-actions'><button class='btn btn-xs btn-primary' onclick='wtwRollCelebration(\"" + hex.id + "\")'>Roll Celebration Event</button></div>"
          + "</div>")
        : "");
    const serviceCards = hex.serviceNode
      ? (services.length
          ? services.map(function (svc, idx) {
              return ""
                + "<div class='wtw-list-card' style='border-color:rgba(126,224,178,.35);'>"
                + "<div class='title'>" + svc.name + " <span style='font-size:.62rem;color:#7ee0b2;text-transform:uppercase;letter-spacing:.06em;'>Service</span></div>"
                + "<div class='meta'>" + svc.desc + "</div>"
                + "<div class='meta' style='color:var(--gold2);'>Cost: " + Number(svc.cost || 0) + "₵</div>"
                + "<div class='actions'><button class='btn btn-xs btn-primary' onclick='wtwBuyService(\"" + hex.id + "\"," + idx + ")'>Buy Service</button></div>"
                + "</div>";
            }).join("")
          : "<div class='wtw-muted'>This district has a service hub, but no services are available right now.</div>")
      : "<div class='wtw-muted'>No district service hub in this hex.</div>";
    const servicesSection = ""
      + "<div class='wtw-card-text' style='margin-bottom:.3rem;'>"
      + (hex.serviceNode
        ? "Service hub active here. Service bonuses and district celebrations are resolved from this panel."
        : "Travel to a district marked with the Service icon to access service purchases and celebrations.")
      + "</div>"
      + serviceCards
      + celebrationHtml;

    const worldSystems = hazardHtml + wayfarerHtml + districtIntelHtml + structureHtml + travelHtml + renderSkirmishWidget(hex);
    const powerSection = ""
      + "<div class='wtw-card-text' style='margin-bottom:.3rem;'><strong>Control Breakdown:</strong><br>" + controlRows + "</div>"
      + "<div class='wtw-card-title' style='margin-top:.3rem;'>Zone Holdings</div>"
      + renderHoldingsPanel(hex)
      + "<div class='wtw-card-title' style='margin-top:.3rem;'>Active Tasks</div>"
      + renderActiveTasksPanel();

    panel.innerHTML = ""
      + "<div class='hex-info-inner'>"
      + "<div class='wtw-header'>"
      + "<div class='hex-type-tag wilderness'>District Hex</div>"
      + "<div class='wtw-headline'>" + hex.zone + " - " + hex.district + "</div>"
      + "<div class='wtw-summary'>" + n.location + " • " + n.sight + " • " + n.weather + " • " + n.feature + "</div>"
      + "</div>"
      + (campaignSceneAvailable ? "<div class='wtw-chip-wrap' style='margin-bottom:.32rem;'><button class='btn btn-xs btn-primary' onclick='openWorldThatWasCampaignSceneCheck(\"" + String(hex.id) + "\")'>GM Scene Check (Lead vs DD8)</button></div>" : "")
      + summaryGrid
      + buildWtwTravelSceneCard(hex)
      + eventCard
        + buildWtwAccordionStateful("Encounter & Markers", activityHtml + encounterHtml + markerHtml + wtwWorldStateHtml + backstoryAnchorHtml, true, "encounter")
        + buildWtwAccordionStateful("Hazards, Wayfarers, Exploration & Travel", worldSystems, false, "worldsystems")
        + buildWtwAccordionStateful("District Services", servicesSection, false, "services")
        + buildWtwAccordionStateful("Cyberpunk Holdings", singleHoldingEntryHtml + (holdingsHtml || "<div class='wtw-muted'>No holdings discovered in this district.</div>"), false, "holdings")
        + buildWtwAccordionStateful("Zone Power & Tasks", powerSection, false, "powertasks")
      + "</div>";
  }

  function chooseZone(zoneName) {
    const w = ensureWorldState();
    if (!w) return;
    w.currentZone = zoneName;
    const zone = w.zones.find(function (z) { return z.name === zoneName; });
    if (zone && zone.stationHexId) w.selectedHexId = zone.stationHexId;
    renderWorldThatWas();
  }

  function renderZoneRailControls() {
    const w = ensureWorldState();
    if (!w) return "";

    return ZONE_NAMES.map(function (z) {
      const on = w.currentZone === z;
      return "<button class='btn btn-xs " + (on ? "btn-primary" : "") + "' onclick='wtwTravelRail(\"" + z + "\")'>" + z + (on ? " (Here)" : "") + "</button>";
    }).join(" ");
  }

  function renderLandingPadControls() {
    const w = ensureWorldState();
    if (!w) return "";
    const selected = getSelectedHex();
    const zoneName = (selected && selected.zone) || w.currentZone;
    if (!zoneName) return "<span style='font-size:.74rem;color:var(--muted2);'>Select a zone to view landing controls.</span>";
    const padHex = w.hexes.find(function (h) { return h.zone === zoneName && h.landingPad; });
    if (!padHex) return "<span style='font-size:.74rem;color:var(--muted2);'>No landing pad in " + zoneName + ".</span>";
    const on = w.selectedHexId === padHex.id;
    return "<span style='font-size:.72rem;color:var(--muted2);margin-right:.35rem;'>Landing Hub:</span>"
      + "<button class='btn btn-xs " + (on ? "btn-teal" : "") + "' onclick='chooseWorldLandingPad(\"" + zoneName + "\")'>" + zoneName + " (Show Here)</button>"
      + "<button class='btn btn-xs btn-teal' onclick='wtwLaunchToSpace(\"" + padHex.id + "\")'>Launch</button>";
  }

  function renderWtwMarkerLegend() {
    const entries = [
      { key: "mission_raid_informer", label: "Raid Informer" },
      { key: "mission_raid_site", label: "Raid Confrontation" },
      { key: "mission_informer", label: "Mission Informer" },
      { key: "mission_site", label: "Mission Site" },
      { key: "task", label: "Task" },
      { key: "story", label: "Story" },
      { key: "station", label: "Rail" },
      { key: "landing", label: "Landing" },
      { key: "service", label: "Service" },
      { key: "wayfarer", label: "Wayfarer" },
      { key: "hazard", label: "Hazard" }
    ];
    return entries.map(function (entry) {
      const style = WTW_MARKER_STYLE[entry.key] || { icon: "?", color: "#bbb" };
      return "<span class='sea-chip' style='border-color:" + style.color + ";color:" + style.color + ";'>" + style.icon + " " + entry.label + "</span>";
    }).join(" ");
  }

  function renderWorldThatWas() {
    const w = ensureWorldState();
    if (!w) return;

    const tickEl = document.getElementById("wtwTick");
    const zoneEl = document.getElementById("wtwCurrentZone");
    const railEl = document.getElementById("wtwRailControls");
    const padsEl = document.getElementById("wtwLandingControls");
    const activityEl = document.getElementById("wtwActivity");
    const mapModeBtn = document.getElementById("wtwMapModeBtn");
    const mapClickModeBtn = document.getElementById("wtwMapClickModeBtn");
    const timeEl = document.getElementById("wtwTimeDisplay");
    if (tickEl) tickEl.textContent = "Cycle " + (w.tick || 0);
    if (zoneEl) zoneEl.textContent = w.currentZone || "Unknown";
    if (railEl) railEl.innerHTML = renderZoneRailControls();
    if (padsEl) padsEl.innerHTML = renderLandingPadControls();
    if (activityEl) activityEl.textContent = String(w.activityClicks || 0) + "/10";
    if (mapModeBtn) mapModeBtn.textContent = w.minimalMapMode ? "Map: Minimal" : "Map: Detailed";
    if (mapClickModeBtn) updateWorldMapClickModeUI();
    if (timeEl) timeEl.textContent = getWorldDateTimeText();
    if (typeof window.getMapFogConfig === "function") {
      window.getMapFogConfig("wtw").enabled = getWorldMapClickMode() === "fog";
    }
    if (typeof window.revealMapFogHex === "function" && w.selectedHexId) {
      window.revealMapFogHex("wtw", String(w.selectedHexId));
    }
    renderWorldThatWasMap();
    renderWorldThatWasInfo();
    renderPowerReadout();
    if (typeof window.maybeAutoOpenSolarCycleWTW === "function") {
      window.maybeAutoOpenSolarCycleWTW();
    }
  }

  function mountWorldThatWasPanel() {
    const panel = document.getElementById("tab-worldthatwas");
    if (!panel) return;

    panel.dataset.mounted = "1";
    panel.innerHTML = ""
      + "<div class='wtw-shell'>"
      + "<div class='wtw-toolbar'>"
      + "<div class='wtw-toolbar-actions'>"
      + "<button class='btn btn-primary' onclick='generateWorldThatWasMap()'>Generate</button>"
      + "<button class='btn btn-sm' onclick='advanceWorldThatWas()'>Advance Cycle</button>"
      + "<button class='btn btn-sm btn-teal' onclick='wtwSyncMarkers()'>Refresh Markers</button>"
      + "<button class='btn btn-sm' id='wtwMapModeBtn' onclick='toggleWorldMapMode()'>Map: Detailed</button>"
      + "<button class='btn btn-sm btn-teal' id='wtwMapClickModeBtn' onclick='toggleWorldMapClickMode()'>Map Mode: Travel</button>"
      + "<button class='btn btn-sm' onclick='returnWorldToProvince()'>Return to Province</button>"
      + "<button class='btn btn-sm' onclick='returnWorldToLastSea()'>Return to Last Sea</button>"
      + "<button class='btn btn-sm' onclick='returnWorldToGalaxy()'>Return to Galaxy</button>"
      + "</div>"
      + "<div class='wtw-toolbar-meta'>"
      + "<span class='wtw-stat-pill'>Zone: <strong id='wtwCurrentZone' style='color:var(--gold2);'>-</strong></span>"
      + "<span class='wtw-stat-pill' id='wtwTick'>Cycle 0</span>"
      + "<span class='wtw-stat-pill' id='wtwTimeDisplay'>Month 1, Day 1, Year 1 — Morning</span>"
      + "</div>"
      + "</div>"
      + "<details class='wtw-quickstats'><summary style='cursor:pointer;font-family:Cinzel,serif;font-size:.72rem;color:var(--gold2);'>World Rules (expand)</summary>"
      + "<div class='wtw-kv'><span class='k'>Map Rules</span><div class='v'>12x12 districts, 9 mega-zones, dynamic control shifts.</div></div>"
      + "<div class='wtw-kv'><span class='k'>Travel</span><div class='v'>Rail to any zone station for 30 Credits and +1 time step.</div></div>"
      + "<div class='wtw-kv'><span class='k'>Landing Pads</span><div class='v'>Each zone has a launch pad. Launch from selected pad for 40 Credits.</div></div>"
      + "<div class='wtw-kv'><span class='k'>Progress</span><div class='v'>Events, services, skirmishes, tasks, wayfarers, hazards, and structures.</div></div>"
      + "</details>"
      + "<div id='wtwRailControls' class='wtw-chip-wrap'></div>"
      + "<div id='wtwLandingControls' class='wtw-chip-wrap'></div>"
      + "<div class='wtw-strip'>"
      + "<div class='wtw-strip-card'><div class='wtw-strip-title'>World Marker Legend</div><div id='wtwLegendReadout' class='wtw-chip-wrap'>" + renderWtwMarkerLegend() + "</div></div>"
      + "<div class='wtw-strip-card'><div class='wtw-strip-title'>Power Balance</div><div id='wtwPowerReadout' class='wtw-chip-wrap'></div></div>"
      + "</div>"
      + "<div class='map-layout'>"
      + "<div class='map-scroll'><svg id='wtwMapSvg' width='900' height='740' xmlns='http://www.w3.org/2000/svg'></svg></div>"
      + "<div class='hex-info' id='wtwInfo'></div>"
      + "</div>"
      + "</div>";
  }

  function ensureWorldThatWasTabVisible() {
    if (typeof document === "undefined") return;
    var tabBtn = document.getElementById("tabnav-worldthatwas");
    if (!tabBtn) return;
    if (tabBtn.style && tabBtn.style.display === "none") {
      tabBtn.style.display = "";
    }
  }

  function returnToGalaxy() {
    const btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('galaxy'\"]");
    if (typeof switchTab === "function") switchTab("galaxy", btn || null);
  }

  function returnToProvince() {
    const btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('map'\"]");
    if (typeof switchTab === "function") switchTab("map", btn || null);
  }

  function returnToLastSea() {
    const btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('lastsea'\"]");
    if (typeof switchTab === "function") switchTab("lastsea", btn || null);
  }

  function openWorldThatWasFromGalaxy() {
    const w = ensureWorldState();
    if (!w) return;
    ensureWorldThatWasTabVisible();
    mountWorldThatWasPanel();
    if (!w.generated || !w.hexes.length) {
      generateWorldThatWasMap();
    } else {
      renderWorldThatWas();
    }
    const btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('worldthatwas'\"]");
    if (typeof switchTab === "function") switchTab("worldthatwas", btn || null);
  }

  function patchTabSwitch() {
    if (typeof window.switchTab !== "function" || window._wtwSwitchPatched) return;
    window._wtwSwitchPatched = true;
    const base = window.switchTab;
    window.switchTab = function (tabId, btn) {
      const out = base.apply(this, arguments);
      if (tabId === "worldthatwas") {
        mountWorldThatWasPanel();
        const w = ensureWorldState();
        if (w && !w.generated) {
          generateWorldThatWasMap();
        } else {
          renderWorldThatWas();
        }
      }
      return out;
    };
  }

  function patchStarSelection() {
    if (typeof window.selectStarSystemHex !== "function" || window._wtwStarPatched) return;
    window._wtwStarPatched = true;
    const base = window.selectStarSystemHex;
    window.selectStarSystemHex = function (hexId) {
      const out = base.apply(this, arguments);
      if (S && S.starSystem && Array.isArray(S.starSystem.hexes)) {
        const hex = S.starSystem.hexes.find(function (h) { return h.id === hexId; });
        if (hex && hex.type === "world_that_was") {
          openWorldThatWasFromGalaxy();
        }
      }
      return out;
    };
  }

  function initWorldThatWas() {
    ensureWorldState();
    patchTabSwitch();
    patchStarSelection();
  }

  window.initWorldThatWas = initWorldThatWas;
  window.mountWorldThatWasPanel = mountWorldThatWasPanel;
  window.renderWorldThatWas = renderWorldThatWas;
  window.launchWtwHexToCombat = launchWtwHexToCombat;
  window.generateWorldThatWasMap = generateWorldThatWasMap;
  window.advanceWorldThatWas = advanceWorldThatWas;
  window.resolveWorldSkirmish = quickResolveWorldSkirmish;
  window.openWorldSkirmishCombat = openWorldSkirmishCombat;
  window.chooseWorldLandingPad = chooseLandingPad;
  window.returnWorldToGalaxy = returnToGalaxy;
  window.returnWorldToProvince = returnToProvince;
  window.returnWorldToLastSea = returnToLastSea;
  window.toggleWorldMapMode = toggleWorldMapMode;
  window.toggleWorldMapClickMode = toggleWorldMapClickMode;
  window.openWorldThatWasFromGalaxy = openWorldThatWasFromGalaxy;

  window.wtwBuyService = spendService;
  window.wtwResolveEvent = resolveZoneEventWithJoin;
  window.wtwCollectMarker = collectMarkerJob;
  window.wtwInitSkirmish = function () {
    const hex = getSelectedHex();
    if (hex) setupSkirmishForHex(hex.id);
  };
  window.wtwSkAction = skirmishActionInInfo;
  window.wtwTakeHoldingTask = createHoldingTask;
  window.wtwCompleteTask = completeHoldingTask;
  window.wtwTrackTask = jumpToTaskHex;
  window.wtwTravelRail = travelByTrainTo;
  window.wtwRollEncounter = rollDistrictEncounter;
  window.wtwRollCelebration = rollWorldCelebrationEvent;
  window.wtwResolveCelebration = resolveWorldCelebrationEvent;
  window.wtwResolveEncounter = resolveDistrictEncounterWithJoin;
  window.wtwResolveEncounterAs = resolveDistrictEncounterAs;
    window.wtwOpenEncounterFailureRecovery = openWtwEncounterFailureRecovery;
  window.wtwResolvePendingCombatOutcome = resolveWtwPendingCombatOutcome;
  window.wtwWinCombatEvent = completeCombatEventVictory;
  window.wtwFailCombatEvent = completeCombatEventFailure;
  window.wtwWinCombatEncounter = completeCombatEncounterVictory;
  window.wtwFailCombatEncounter = completeCombatEncounterFailure;
  window.wtwResolveHazard = resolveDistrictHazard;
  window.wtwTalkWayfarer = talkToWayfarer;
  window.wtwExploreStructure = exploreStructure;
  window.wtwJoinStructureArea = joinStructureArea;
  window.wtwLaunchToSpace = launchToSpace;
  window.wtwSyncMarkers = function () {
    syncWorldMarkers();
    renderWorldThatWas();
  };
  window.wtwRefreshPactSkirmishDensity = function () {
    const w = ensureWorldState();
    if (!w || !Array.isArray(w.hexes) || !w.hexes.length) return;
    applyPactSkirmishDensityPressure(w, true);
    syncWorldMarkers();
    renderWorldThatWas();
  };
  window.wtwSetAccordion = setWorldAccordionOpen;

  window.wtwAcceptTaskFail = function () {
    const p = window._pendingWtwTaskRoll;
    if (!p) { if (typeof closeModal === "function") closeModal(); return; }
    const w = ensureWorldState();
    const hex = w && hexById(p.hexId);
    if (hex) hex.skirmish = true;
    if (typeof changeCounter === "function") changeCounter("tmw", 1);
    else if (typeof S !== "undefined") S.tmw = Math.max(0, (S.tmw || 0) + 1);
    if (typeof showNotif === "function") showNotif("Task failed. +1 Teamwork Point. Skirmish triggered in this district.", "warn");
    if (w) {
      w.activeTasks = w.activeTasks.filter(function (x) { return x.id !== p.taskId; });
      if (p.task.hexId) delete w.markers[p.task.hexId];
    }
    window._pendingWtwTaskRoll = null;
    if (typeof closeModal === "function") closeModal();
    syncWorldMarkers();
    advanceWorldTime("task failure");
    renderWorldThatWas();
  };

  window.wtwPushTaskLuck = function () {
    const p = window._pendingWtwTaskRoll;
    if (!p) { if (typeof closeModal === "function") closeModal(); return; }
    var tmw = Number((S && S.tmw) || 0);
    if (tmw < 2) {
      if (typeof showNotif === 'function') showNotif('Need 2 Teamwork Points to Push Luck.', 'warn');
      return;
    }
    if (typeof changeCounter === 'function') changeCounter('tmw', -2);
    else if (typeof S !== 'undefined') S.tmw = Math.max(0, tmw - 2);
    const pushDread = stepDreadDie(p.dreadDie, 1);
    const valorDie = getActionDie("valor");
    const newCheck = rollAgainstDread("valor", pushDread);
    const newSummary = "Valor d" + valorDie + " [" + newCheck.actionTotal + "] vs Dread " + dreadLabel(pushDread) + " [" + newCheck.dreadTotal + "]";
    const w = ensureWorldState();
    const hex = w && hexById(p.hexId);
    window._pendingWtwTaskRoll = null;
    if (typeof closeModal === "function") closeModal();
    if (newCheck.success) {
      const t = p.task;
      if (hex) { addPowerRenown(t.power, 1); addZoneReputation(p.zone, 2); }
      addWorldItem("dataDrives", 1);
      addWorldItem("fuelCells", 1);
      grantRandomLoot(t.rewardTier || "medium");
      setCredits(getCredits() + (t.rewardCredits || 150));
      recordWtwSuccessRoll();
      applyWtwCondition(normalizeWtwConditionByStat('valor', true));
      if (p.dreadDie >= 10 && typeof changeCounter === "function") changeCounter("renown", 1);
      if (typeof showNotif === "function") showNotif("Push Luck succeeded! " + newSummary + ". +" + (t.rewardCredits || 150) + "₵ + Loot. Condition: " + normalizeWtwConditionByStat('valor', true) + ".", "good");
      if (w) {
        w.activeTasks = w.activeTasks.filter(function (x) { return x.id !== p.taskId; });
        if (t.hexId) delete w.markers[t.hexId];
      }
      openTaskResultModal(t, newCheck, newSummary, true, valorDie, pushDread);
    } else {
      if (hex) hex.skirmish = true;
      if (typeof changeCounter === "function") changeCounter("tmw", 1);
      else if (typeof S !== "undefined") S.tmw = Math.max(0, (S.tmw || 0) + 1);
      applyWtwCondition(normalizeWtwConditionByStat('valor', false));
      if (typeof showNotif === "function") showNotif("Push Luck failed. " + newSummary + ". Condition: " + normalizeWtwConditionByStat('valor', false) + ". +1 Teamwork. Skirmish triggered.", "warn");
      if (w) {
        w.activeTasks = w.activeTasks.filter(function (x) { return x.id !== p.taskId; });
        if (p.task.hexId) delete w.markers[p.task.hexId];
      }
    }
    syncWorldMarkers();
    advanceWorldTime("task push luck");
    renderWorldThatWas();
  };

  window.wtwSpendTeamworkOnTask = function () {
    const p = window._pendingWtwTaskRoll;
    if (!p) { if (typeof closeModal === "function") closeModal(); return; }
    const tmw = (typeof S !== "undefined" && typeof S.tmw === "number") ? S.tmw : 0;
    if (tmw < 3) {
      if (typeof showNotif === "function") showNotif("Need 3 Teamwork Points to spend.", "warn");
      return;
    }
    if (typeof changeCounter === "function") changeCounter("tmw", -3);
    else if (typeof S !== "undefined") S.tmw = Math.max(0, tmw - 3);
    const t = p.task;
    const w = ensureWorldState();
    const hex = w && hexById(p.hexId);
    if (hex) { addPowerRenown(t.power, 1); addZoneReputation(p.zone, 2); }
    addWorldItem("dataDrives", 1);
    addWorldItem("fuelCells", 1);
    grantRandomLoot(t.rewardTier || "medium");
    setCredits(getCredits() + (t.rewardCredits || 150));
    if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === "function") {
      window.BTLRules.recordTeamworkConvertedSuccess("wtw-task-teamwork-convert");
    }
    if (w) {
      w.activeTasks = w.activeTasks.filter(function (x) { return x.id !== p.taskId; });
      if (t.hexId) delete w.markers[t.hexId];
    }
    window._pendingWtwTaskRoll = null;
    if (typeof closeModal === "function") closeModal();
    if (typeof showNotif === "function") showNotif("Spent 3 Teamwork to succeed the task. +" + (t.rewardCredits || 150) + "₵ + Loot. No Successful Roll gained.", "good");
    openTaskResultModal(t, p.check, "Teamwork spent — success!", true, p.adventureDie, p.dreadDie);
    syncWorldMarkers();
    advanceWorldTime("task teamwork spend");
    renderWorldThatWas();
  };

  window.wtwAcceptEncounterFailure = function () {
    var p = window._pendingWtwEncounterRoll;
    if (!p) { if (typeof closeModal === 'function') closeModal(); return; }
    window._pendingWtwEncounterRoll = null;
    if (typeof closeModal === 'function') closeModal();
    resolveDistrictEncounter('failure', { skipPrompt: true, checkOverride: p.check, manual: true });
  };

  window.wtwPushEncounterLuck = function () {
    var p = window._pendingWtwEncounterRoll;
    if (!p) { if (typeof closeModal === 'function') closeModal(); return; }
    var tmw = Number((S && S.tmw) || 0);
    if (tmw < 2) {
      if (typeof showNotif === 'function') showNotif('Need 2 Teamwork Points to Push Luck.', 'warn');
      return;
    }
    if (typeof changeCounter === 'function') changeCounter('tmw', -2);
    else if (typeof S !== 'undefined') S.tmw = Math.max(0, tmw - 2);
    var hex = hexById(p.hexId);
    if (!hex || !hex.encounter) {
      window._pendingWtwEncounterRoll = null;
      if (typeof closeModal === 'function') closeModal();
      return;
    }
    var check = rollAgainstDread(hex.encounter.stat || 'valor', p.pushDread || stepDreadDie(p.baseDread || 8, 1));
    window._pendingWtwEncounterRoll = null;
    if (typeof closeModal === 'function') closeModal();
    resolveDistrictEncounter(check.success ? 'success' : 'failure', {
      skipPrompt: !check.success,
      pushLuck: true,
      checkOverride: check
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWorldThatWas);
  } else {
    initWorldThatWas();
  }
  window.openWorldThatWasCampaignSceneCheck = openWorldThatWasCampaignSceneCheck;
})();
