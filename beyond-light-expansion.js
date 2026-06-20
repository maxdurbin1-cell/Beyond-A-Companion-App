(function () {
  const LAST_SEA_COLS = 13;
  const LAST_SEA_ROWS = 13;
  const LAST_SEA_HEX = 34;
  const NAVAL_ZONES = ["Engaged", "Close", "Nearby", "Far"];

  const LAST_SEA_TERRAINS = [
    {
      name: "Grassland",
      color: "#486734",
      coast: [
        "Low grass sweeps down to a bright salt shore.",
        "The coast opens into rolling green ground cut by old stone walls.",
        "Gentle land rises above the tide line in broad sunlit bands.",
        "Reclaimed farmland runs to the shore; rusted irrigation pipes protrude from the bluff.",
        "Coastal meadow, the grass unusually tall, hiding old survey stakes and boundary markers.",
        "The shoreline is a tangle of sea-grass and wind-turbine foundations, half-buried by drift sand.",
        "Agriculture domes, some cracked, some intact, hug the tideline. A crop of something green glows through the translucent panels at night."
      ]
    },
    {
      name: "Jungle",
      color: "#1f5c38",
      coast: [
        "Dense jungle presses almost into the surf.",
        "Vines hang over black sand and the air is wet with heat.",
        "Palm trunks and tangled roots crowd the shallows.",
        "The jungle has swallowed a port district; loading cranes stand in the surf like rusted herons.",
        "Bioluminescent canopy edges the shore. The light pulsing below the waterline suggests the phenomenon continues underwater.",
        "A processing facility, long-abandoned, disappears into the treeline. Its waste pipes still drain into the bay.",
        "Irradiated jungle — the leaves are enormous, the colors wrong, the animals unrecognizable. The shore itself steams slightly."
      ]
    },
    {
      name: "Forest",
      color: "#294a31",
      coast: [
        "Dark forest edges the shore in a wall of cedar and fern.",
        "Pine-shadowed bluffs rise above cold water.",
        "Tall trees lean over a pebbled strand full of driftwood.",
        "A logging road leads from the shore into the dark. The machinery is still here. No one is.",
        "The forest grows to the cliff edge and over it. Root systems hold the bluff, for now.",
        "Fog clings to the forest line. The trees are enormous, old-growth, their trunks wrapped in what appears to be communications cable.",
        "A research outpost in the tree canopy, its observation platform overlooking the sea. No one answers the radio."
      ]
    },
    {
      name: "Desert",
      color: "#7d6a2c",
      coast: [
        "Golden dunes tumble straight into the sea.",
        "Dry salt flats glitter behind the beach.",
        "Wind-carved stone and hard sand stretch inland from the shore.",
        "A solar array, partially buried, lines the coastal ridge. Some panels still track the sun.",
        "The desert comes to a sudden hard edge at the waterline — as if cut by something. The contrast is disorienting.",
        "Old pipeline infrastructure runs parallel to the shore. It carried water, once. Now it carries sand.",
        "Ruins of a desalination plant, its intake pipes destroyed, its processing chambers intact. Someone could restart it."
      ]
    },
    {
      name: "Mountainous",
      color: "#5a5661",
      coast: [
        "Cliffs rise almost vertically from the breakers.",
        "Jagged stone shelves force the sea into white spray.",
        "A steep volcanic spine dominates the island.",
        "Mining terrace scars the cliffside from waterline to summit. The ore lifts are frozen in position.",
        "Basalt columns, natural but impossibly regular, line the shore like a circuit board writ large.",
        "Geothermal vents in the shallows boil the surf. The rock above them is warm. The structures built on them are rust-eaten but standing.",
        "A missile silo, decommissioned, its blast doors open to the sea air. Something is nesting inside."
      ]
    }
  ];

  const LAST_SEA_ECOLOGY = [
    "Overgrown",
    "Decaying",
    "Floating Spores",
    "Scorched",
    "Sweet Fruits",
    "Unnaturally large fungi",
    "Surprisingly large animals wander",
    "Crops overrun by pests",
    "Hallucinogenic herbs",
    "Floating rocks"
  ];

  const LAST_SEA_WATER_TERRAINS = [
    { key: "open_sea", label: "Open Sea", color: "#103247", glyph: "≈", weight: 10 },
    { key: "shoal", label: "Shoals", color: "#1f5a6b", glyph: "⋰", weight: 3 },
    { key: "trench", label: "Deep Trench", color: "#0b1f36", glyph: "∇", weight: 2 },
    { key: "reef", label: "Reef Shelf", color: "#1f6a5d", glyph: "◌", weight: 2 },
    { key: "storm", label: "Stormwater", color: "#2c3f58", glyph: "⚡", weight: 1 },
    { key: "harbor", label: "Harbor Approaches", color: "#2d4f64", glyph: "⚓", weight: 1 }
  ];

  const LAST_SEA_WEATHER = {
    spring: [
      { label: "Salt Mist", rough: false, desc: "A cool marine haze softens the horizon but leaves the water workable." },
      { label: "Silver Rain", rough: false, desc: "Fine rain moves in sheets across open water. Visibility dips, but the sea stays even." },
      { label: "Crosswind Squall", rough: true, desc: "Short violent gusts kick the waves sideways and fight the helm.", check: { dd: 8, stats: ["lead", "control"], failure: "Mental Stress equals failed difference" } },
      { label: "Clear Current", rough: false, desc: "Cold bright light and a steady current make for excellent sailing." },
      { label: "Bloom Tide", rough: false, desc: "Pollen and sea-glow drift over the surface in strange pastel bands." },
      { label: "Stormfront", rough: true, desc: "Dark clouds stack low over the sea and every sail strains under the pressure." },
      { label: "Acid Fog", rough: true, desc: "A chemical haze drifts from the industrial coasts. Metal corrodes faster in this. Filter your breathing.", check: { dd: 8, stats: ["lead", "control"], failure: "Mental Stress equals failed difference" } },
      { label: "Neon Haze", rough: false, desc: "Refraction from surface pollutants creates low-lying light columns. Navigation is possible. Strange, but possible." },
      { label: "EMP Weather", rough: true, desc: "Ionized air interferes with electronic navigation. Run manual. Get where you are going before sundown." }
    ],
    harvest: [
      { label: "Golden Wind", rough: false, desc: "Warm dry winds fill every sail and push ships forward cleanly." },
      { label: "Fog Bank", rough: true, desc: "A wall of fog rolls over the water and swallows every landmark." },
      { label: "Boiling Heat", rough: false, desc: "The day is punishingly bright and the decks burn underfoot." },
      { label: "Ash Shower", rough: false, desc: "Soft black flakes drift from somewhere beyond the horizon." },
      { label: "Typhoon Edge", rough: true, desc: "You catch only the outer rim of a greater storm, but it is enough to batter the hull." },
      { label: "Trade Breeze", rough: false, desc: "Ideal winds and long gentle swells carry the ship with almost no resistance." },
      { label: "Bioluminescent Tide", rough: false, desc: "The wake glows blue-green. Navigation by compass is unreliable but the water is calm and the sight is extraordinary." },
      { label: "Thermal Inversion", rough: true, desc: "Heat layers trap exhaust near the surface. Visibility is poor, the air acrid, and the sea deceptively calm." },
      { label: "Static Surge", rough: false, desc: "Ball lightning rolls across the surface. Engines glow faintly blue. Nobody can explain it. Everything still works." }
    ],
    winter: [
      { label: "Ice Rain", rough: true, desc: "Freezing spray hardens on rope, rail, and skin." },
      { label: "Still Black Water", rough: false, desc: "The sea goes unnaturally calm and sound carries far." },
      { label: "Needle Wind", rough: true, desc: "Sharp bitter winds slice across the deck and shove the ship off line." },
      { label: "Grey Overcast", rough: false, desc: "A dim winter ceiling hangs low but leaves the route passable." },
      { label: "Moonlit Cold", rough: false, desc: "The night is frigid and clear. Every wave flashes silver." },
      { label: "Breaker Storm", rough: true, desc: "Hard waves hammer the hull in heavy repeating walls." },
      { label: "Drift Protocol", rough: false, desc: "Old automated distress signals activate in the cold, their source unknown. They are years old. Something adrift is still broadcasting." },
      { label: "Ice Channel", rough: false, desc: "Floating ice forms a navigable lane between drifts. The silence here is absolute. Move quietly." },
      { label: "Blood Sleet", rough: true, desc: "Red-tinged precipitation from an unknown source. It stains sails and exposed skin. Navigation is unaffected. Morale is not." }
    ]
  };

  const OPEN_SEA_PERILS = ["Whirlpool", "Fogged Tsunami", "Maelstrom", "Typhoon", "Cyclone"];
  const ISLAND_PERILS = ["Fog", "Earthquake", "Quicksand", "Flood", "Rockslide", "Storm", "Forest Fire", "Chasm"];
  const ARMADA_ACTIONS = ["Investigate", "Capture", "Hunt", "Transport", "Destroy", "Aid", "Guard"];
  const ARMADA_TARGETS = ["Pirate", "Beast", "Ruler", "Island", "Treasure", "Landmark", "Settlement"];

  const NAVAL_SHIPS = [
    { name: "Skiff", cost: 2500, defend: 4, strike: null, shoot: null, feature: "Swift Escape - +1 to Control rolls." },
    { name: "Transport", cost: 5500, defend: 6, strike: null, shoot: null, feature: "Cargo Hold - additional storage and crew space." },
    { name: "Frigate", cost: 10000, defend: 8, strike: 6, shoot: 6, feature: "Nimble - +1 action during naval combat." },
    { name: "Cruiser", cost: 15000, defend: 10, strike: 8, shoot: 8, feature: "Warship - built for sustained fighting." },
    { name: "Battleship", cost: 30000, defend: 12, strike: 10, shoot: 10, feature: "Armored Fortress - +1 to defensive checks." },
    { name: "Carrier", cost: 50000, defend: 20, strike: 12, shoot: 12, feature: "Command Authority - +1 to Lead checks." }
  ];

  const NAVAL_UPGRADES = [
    {
      id: "installed-weapons",
      name: "Installed Weapons",
      classes: ["Skiff", "Transport"],
      cost: 500,
      pathCost: 5,
      effect: "Ship gains Strike d4 and Shoot d4."
    },
    {
      id: "improved-navigation",
      name: "Improved Navigation",
      classes: ["Transport", "Frigate"],
      cost: 1000,
      pathCost: 10,
      effect: "Navigator gets +2 on range and maneuver checks."
    },
    {
      id: "improved-combat",
      name: "Improved Combat",
      classes: ["Frigate"],
      cost: 1500,
      pathCost: 15,
      effect: "Raise both Strike and Shoot to at least d8."
    },
    {
      id: "improved-defenses",
      name: "Improved Defenses",
      classes: ["Cruiser"],
      cost: 2000,
      pathCost: 20,
      effect: "Step the ship Hull / Defend die up once."
    },
    {
      id: "captains-hq",
      name: "Captain's HQ",
      classes: ["Carrier"],
      cost: 5000,
      pathCost: 25,
      effect: "Ship grants +1 Lead and +1 extra action."
    }
  ];

  const NAVAL_RANKS = [
    { name: "Rookie", train: 0, baseCost: 1000 },
    { name: "Experienced", train: 5, baseCost: 2000 },
    { name: "Veteran", train: 10, baseCost: 4000 },
    { name: "Elite", train: 15, baseCost: 8000 }
  ];

  const NAVAL_ROLE_META = {
    Gunner: {
      pair: "Strike / Shoot",
      summary: "Runs short-barrel cannons at Close range and crossbows at Nearby range."
    },
    Navigator: {
      pair: "Control / Mind",
      summary: "Moves between zones, threads hazards, and reads the sea."
    },
    Engineer: {
      pair: "Body / Defend",
      summary: "Repairs the ship, braces the hull, and handles incoming punishment."
    },
    Captain: {
      pair: "Lead / Spirit",
      summary: "Drives morale, tactics, diplomacy, and command under pressure."
    }
  };

  const NAVAL_ROLE_COSTS = {
    Rookie: { Gunner: 0, Navigator: 0, Engineer: 0, Captain: 0 },
    Experienced: { Gunner: 1000, Navigator: 1200, Engineer: 1400, Captain: 1600 },
    Veteran: { Gunner: 1800, Navigator: 2000, Engineer: 2200, Captain: 2400 },
    Elite: { Gunner: 2600, Navigator: 2800, Engineer: 3000, Captain: 3200 }
  };

  const NAVAL_ABILITIES = {
    Gunner: {
      Experienced: ["Trick Shot - reroll 1s on a Strike or Shoot roll once per combat."],
      Veteran: [
        "Ace Gunner - reroll one failed Strike or Shoot roll once per combat.",
        "Barrage Fire - grant Bolstered once per combat."
      ],
      Elite: ["Precision Shot - inflict one negative condition on an enemy ship once per combat."]
    },
    Navigator: {
      Experienced: ["Stellar Cartographer - reroll 1s on a Control or Mind check once per combat."],
      Veteran: [
        "Master Navigator - reroll one failed Control or Mind check once per combat.",
        "Warp Specialist - your ship can travel farther in a day phase."
      ],
      Elite: ["Evasive Manoeuvres - negate one enemy attack roll once per combat."]
    },
    Engineer: {
      Experienced: ["Rapid Repair - reroll 1s on a Body check once per combat."],
      Veteran: [
        "Master Engineer - reroll one failed Body check once per combat.",
        "Overclock - grant Protected once per combat."
      ],
      Elite: ["Crisis Management - grant Empowered once per combat."]
    },
    Captain: {
      Experienced: ["Inspiring Speech - reroll 1s on a Lead or Spirit check once per combat."],
      Veteran: [
        "Master Tactician - reroll one failed Lead or Spirit check once per combat.",
        "Charismatic Leader - grant Focused once per combat."
      ],
      Elite: ["Master Strategist - grant +2 actions during naval combat."]
    }
  };

  const SHIP_NAME_FIRST = [
    "Crimson", "Rust", "Raider", "Seer", "Leviathan", "Rebel", "Silver", "Cinder", "Phantom", "Whisper",
    "Solar", "Tempest", "Horizon", "Storm", "Marrow", "Black", "Night", "Star", "Ghost", "Sable"
  ];
  const SHIP_NAME_LAST = [
    "Rest", "Nomad", "Solar", "Wanderer", "Gale", "Drifter", "Surveyor", "Marauder", "Ghost", "Storm",
    "Harbinger", "Sentinel", "Crown", "Serpent", "Whale", "Runner", "Dawn", "Siren", "Star", "Revenant"
  ];
  const SHIP_LOOKS = [
    "Solar sails, patched hull, a relic reborn for the open sea.",
    "Rusted metal and jury-rigged propulsion, a survivor's refuge afloat.",
    "Hydrofoil lines and algae-fuel engines make it sleek and quiet.",
    "A low predatory profile with periscope eyes and a hunting prow.",
    "Twin catamaran hulls and wind turbines built for speed.",
    "An icebreaker nose and reinforced stem for brutal crossings.",
    "Salvaged tech and mismatched plates, ugly but reliable.",
    "Matte-black plating and ghostlike trim that vanish at dusk.",
    "Bioluminescent growth clings to the keel and glows at night.",
    "Kinetic mirrored sails flash with every shift in the wind.",
    "A floating greenhouse deck makes the whole vessel feel alive.",
    "Amphibious landing legs let it crawl onto shore when needed.",
    "Drone racks hang along the spine like metallic gulls.",
    "A magnet-skimming hull barely seems to touch the water.",
    "Self-healing seams knit small damage closed over time.",
    "No captain's wheel - the ship feels eerily sentient.",
    "Forged from battlefield salvage and obviously built for war.",
    "Inflatable camouflage bladders make it resemble a small island.",
    "Harpoon rigs and solar fins mark it as a hunter of monsters.",
    "An antique long hull rides high and somehow never seems to sink."
  ];

  const GAMBLING_LEVELS = [
    { level: 1, label: "Easy", die: 20, buyIn: 10 },
    { level: 2, label: "Steady", die: 12, buyIn: 20 },
    { level: 3, label: "Risky", die: 10, buyIn: 30 },
    { level: 4, label: "Sharp", die: 8, buyIn: 40 },
    { level: 5, label: "Dangerous", die: 6, buyIn: 50 },
    { level: 6, label: "Hard", die: 4, buyIn: 60 }
  ];

  function ensureExpansionState() {
    if (typeof S === "undefined") {
      return;
    }

    S.lastSea = {
      layout: "random",
      map: [],
      islands: [],
      notes: {},
      clickMode: "travel",
      selectedKey: null,
      activeEncounterKey: null,
      weather: null,
      ...(S.lastSea || {})
    };
    S.lastSea.map = Array.isArray(S.lastSea.map) ? S.lastSea.map : [];
    S.lastSea.islands = Array.isArray(S.lastSea.islands) ? S.lastSea.islands : [];
    S.lastSea.notes = { ...(S.lastSea.notes || {}) };

    S.naval = {
      ship: null,
      crew: [],
      selectedClass: "Skiff",
      pendingName: "",
      pendingLook: "",
      enemyClass: "Frigate",
      enemyShip: null,
      enemyFleet: [],
      targetEnemyId: "",
      focusFireLock: false,
      allyFleet: [],
      activeAllyId: "",
      zone: "Close",
      round: 1,
      log: [],
      tacticsBonus: 0,
      powerShift: null,
      combatActive: false,
      crewTrauma: 0,
      actionsRemaining: 0,
      enemyActionsRemaining: 2,
      perception: "indifferent",
      roleAssignments: {
        captain: "",
        navigator: "",
        engineer: "",
        gunner: ""
      },
      popupManualRoll: null,
      boardingReadyRound: 0,
      boardingSession: null,
      ...(S.naval || {})
    };
    S.naval.crew = Array.isArray(S.naval.crew) ? S.naval.crew : [];
    S.naval.log = Array.isArray(S.naval.log) ? S.naval.log : [];
    S.naval.enemyFleet = Array.isArray(S.naval.enemyFleet) ? S.naval.enemyFleet : [];
    S.naval.allyFleet = Array.isArray(S.naval.allyFleet) ? S.naval.allyFleet : [];
    S.naval.roleAssignments = Object.assign({
      captain: "",
      navigator: "",
      engineer: "",
      gunner: ""
    }, S.naval.roleAssignments || {});

    S.gambling = {
      difficulty: 1,
      guess: "under",
      history: [],
      lastResult: null,
      ...(S.gambling || {})
    };
    S.gambling.history = Array.isArray(S.gambling.history) ? S.gambling.history : [];
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function mountExpansionPanels() {
    const lastSeaPanel = document.getElementById("tab-lastsea");
    if (lastSeaPanel && !lastSeaPanel.dataset.mounted) {
      lastSeaPanel.dataset.mounted = "1";
      lastSeaPanel.innerHTML = `
        <div class="sea-control-bar">
          <div class="season-btn ${S.currentSeason === "spring" ? "on" : ""}" onclick="setLastSeaSeason('spring',this)">Spring</div>
          <div class="season-btn ${S.currentSeason === "harvest" ? "on" : ""}" onclick="setLastSeaSeason('harvest',this)">Harvest</div>
          <div class="season-btn ${S.currentSeason === "winter" ? "on" : ""}" onclick="setLastSeaSeason('winter',this)">Winter</div>
          <span style="color:var(--muted);font-size:.6rem;margin:0 .3rem;">|</span>
          <select id="lastSeaLayoutSelect" onchange="S.lastSea.layout=this.value">
            <option value="random">Random Generator</option>
            <option value="tiny">3 Hexes - 1 Day</option>
            <option value="broad">9 Hexes - 3 Days</option>
            <option value="archipelago">3x 6 Hexes - 2 Days Each</option>
          </select>
          <button class="btn btn-primary" onclick="generateLastSea()">Chart Last Sea</button>
          <button class="btn" onclick="clearLastSea()">Clear</button>
          <button class="btn btn-sm btn-teal" id="lastSeaClickModeBtn" onclick="toggleLastSeaClickMode()">Map Mode: Travel</button>
          <span id="lastSeaTimeDisplay" style="font-family:'Rajdhani',sans-serif;font-size:.78rem;color:var(--gold2);margin-left:.4rem;">Month 1, Day 1, Year 1 — Morning</span>
          <span id="lastSeaCoords" style="font-family:'Rajdhani',sans-serif;font-size:.78rem;color:var(--muted2);margin-left:.4rem;"></span>
        </div>
        <div class="sea-summary">
          <div class="info-cell"><span class="ic-label">Open Sea</span>Shift in Weather, Open Sea Encounter, Peril, or Uneventful Sailing.</div>
          <div class="info-cell"><span class="ic-label">Island Travel</span>Land Encounter, Peril, Exhaustion, Shift in Weather, or Uneventful travel.</div>
          <div class="info-cell"><span class="ic-label">Sea Peril</span>Control vs DD6 or take the difference in Mental Stress.</div>
          <div class="info-cell"><span class="ic-label">Island Peril</span>Lead vs DD6 or take the difference in Mental Stress.</div>
        </div>
        <div class="sea-legend">
          <div class="sea-item"><div class="sea-dot" style="background:#103247;border-color:#2ec4b6;"></div>Open Sea</div>
          <div class="sea-item"><div class="sea-dot" style="background:#486734;"></div>Island</div>
          <div class="sea-item"><div class="sea-dot" style="background:#6a5800;border-color:#e8c050;"></div>Landmark</div>
          <div class="sea-item"><div class="sea-dot" style="background:#7a4020;border-color:#f0a840;"></div>Settlement</div>
          <div class="sea-item"><div class="sea-dot" style="background:#403830;border-color:#a09870;"></div>Dungeon</div>
        </div>
        <div class="sea-group-list" id="lastSeaIslandGroups"></div>
        <div class="sea-layout">
          <div class="sea-scroll">
            <svg id="lastSeaSvg" width="760" height="660" xmlns="http://www.w3.org/2000/svg">
              <text x="380" y="318" text-anchor="middle" font-family="Cinzel,serif" font-size="13" fill="#254454">Generate the Last Sea to begin</text>
              <text x="380" y="343" text-anchor="middle" font-family="Cinzel,serif" font-size="10" fill="#1a2c38">Every hex carries a description and an exploration roll.</text>
            </svg>
          </div>
          <div class="sea-info" id="lastSeaInfo"></div>
        </div>
      `;
    }

    const navalPanel = document.getElementById("tab-naval");
    if (navalPanel && !navalPanel.dataset.mounted) {
      navalPanel.dataset.mounted = "1";
      navalPanel.innerHTML = `
        <div class="command-table-shell command-table-ship">
          <div class="ship-banner command-table-hero">
            <div class="command-kicker">Command Table · Sea / Star System</div>
            <h3>Naval System</h3>
            <p>Buy a ship, hire and train crew, then run ship combat from one table: target, zone, power, station action, and log. Hull Stress is always twice the ship's current Defend die.</p>
          </div>
          <div class="sea-summary command-stat-strip">
            <div class="info-cell"><span class="ic-label">Credits</span><span id="navalCredits">0 ₵</span></div>
            <div class="info-cell"><span class="ic-label">Path Tokens</span><span id="navalPathTokens">0</span></div>
            <div class="info-cell"><span class="ic-label">Crew Trauma</span><span id="navalCrewTrauma">0</span></div>
            <div class="info-cell"><span class="ic-label">Zone</span><span id="navalZoneReadout">Close</span></div>
          </div>
          <div class="naval-grid command-table-grid">
            <div class="card command-panel command-left">
              <div class="section-title" data-naval-title="shipyard">Shipyard</div>
              <div class="command-toolbar">
                <button class="btn btn-primary" onclick="generateShipIdentity()">Roll Ship Identity</button>
                <button class="btn" onclick="repairPlayerShipToFull()">Full Drydock Repair</button>
              </div>
              <div id="navalShipSummary" class="combat-card" style="margin-bottom:.65rem;"></div>
              <div class="command-panel-title">Available Hulls</div>
              <div class="ship-class-grid" id="navalShipGrid"></div>
              <div class="command-panel-title">Upgrades</div>
              <div class="ship-upgrades" id="navalUpgradeList"></div>
            </div>
            <div class="card command-panel command-right">
              <div class="section-title" data-naval-title="crew">Hire Crew</div>
              <div class="command-form-grid">
                <div><span class="sub-label">Role</span><select id="navalCrewRole"><option>Captain</option><option>Gunner</option><option>Navigator</option><option>Engineer</option></select></div>
                <div><span class="sub-label">Rank</span><select id="navalCrewRank"><option>Rookie</option><option>Experienced</option><option>Veteran</option><option>Elite</option></select></div>
              </div>
              <div class="form-row"><span class="sub-label">Name</span><input type="text" id="navalCrewName" placeholder="Crew member name"></div>
              <div class="command-toolbar">
                <button class="btn btn-primary" onclick="hireNavalCrew()">Hire Crew</button>
                <button class="btn" onclick="rollCrewName()">Roll Name</button>
              </div>
              <div class="sea-summary" style="margin-bottom:.65rem;">
                ${Object.entries(NAVAL_ROLE_META).map(([role, meta]) => `
                  <div class="info-cell">
                    <span class="ic-label">${role}</span>
                    <strong style="color:var(--gold2);">${meta.pair}</strong><br>${meta.summary}
                  </div>
                `).join("")}
              </div>
              <div class="crew-roster" id="navalCrewRoster"></div>
              <div class="section-title" data-naval-title="name" style="margin-top:.85rem;">Ship Name</div>
              <div style="display:flex;gap:.3rem;align-items:center;margin-bottom:.5rem;">
                <input type="text" id="shipNameInput" placeholder="Ship name…" style="flex:1;" onchange="if(S.naval.ship){S.naval.ship.name=this.value;}else{S.naval.pendingName=this.value;} renderNaval();">
                <button class="btn btn-xs btn-teal" onclick="generateShipIdentity()" title="Roll random name">⚄ Roll</button>
                <button class="btn btn-xs" onclick="if(S.naval.ship){S.naval.ship.name='';}else{S.naval.pendingName='';} document.getElementById('shipNameInput').value=''; renderNaval();">✕</button>
              </div>
              <div id="shipNameDisplay" style="font-size:.78rem;color:var(--muted2);"></div>
              <div class="section-title" data-naval-title="cargo" style="margin-top:.85rem;">Ship Cargo</div>
              <div class="command-subcopy">Stow items in the ship's hold. Click an item to move it to your Backpack.</div>
              <div id="navalCargoList" style="min-height:2rem;"></div>
              <div class="command-toolbar" style="margin-top:.4rem;">
                <button class="btn btn-xs btn-primary" onclick="stowItemInShip()">Stow from Backpack</button>
              </div>
            </div>
            <div class="card command-panel command-board-panel">
              <div class="section-title" data-naval-title="combat">Ship Combat</div>
              <div class="command-schematic command-schematic-ship" aria-hidden="true">
                <div class="command-schematic-title">Station Board</div>
                <div class="command-vessel"></div>
                <div class="command-mast"></div>
                <span class="command-station gold" style="--x:50%;--y:20%;">Captain</span>
                <span class="command-station" style="--x:32%;--y:44%;">Gunner</span>
                <span class="command-station" style="--x:68%;--y:44%;">Navigator</span>
                <span class="command-station gold" style="--x:50%;--y:74%;">Engineer</span>
              </div>
              <div class="command-form-grid" style="grid-template-columns:1fr auto;align-items:end;">
                <div>
                  <span class="sub-label">Enemy Ship</span>
                  <select id="navalEnemyClass" onchange="S.naval.enemyClass=this.value">${NAVAL_SHIPS.map(ship => `<option${ship.name === S.naval.enemyClass ? " selected" : ""}>${ship.name}</option>`).join("")}</select>
                </div>
                <button class="btn btn-primary" onclick="spawnEnemyShip()">Spawn Enemy</button>
              </div>
              <div class="command-toolbar">
                <button class="btn btn-sm btn-teal" onclick="startNavalCombat()">Start / Reset Combat</button>
                <button class="btn btn-sm" onclick="nextNavalRound()">Next Round</button>
                <button class="btn btn-sm btn-red" onclick="clearNavalLog()">Clear Log</button>
                <button class="btn btn-sm btn-primary" onclick="openNavalCombatPopup()">Open Combat Popup</button>
              </div>
              <div class="zone-track" id="navalZoneTrack" style="margin-bottom:.55rem;"></div>
              <div class="command-toolbar">
                <button class="btn btn-sm" onclick="adjustNavalZone(-1)">Move Closer</button>
                <button class="btn btn-sm" onclick="adjustNavalZone(1)">Move Wider</button>
              </div>
              <div class="command-form-grid">
                <div>
                  <span class="sub-label">Divert From</span>
                  <select id="navalPowerFrom"><option value="shoot">Shoot</option><option value="strike">Strike</option><option value="hull">Defend</option></select>
                </div>
                <div>
                  <span class="sub-label">Divert To</span>
                  <select id="navalPowerTo"><option value="hull">Defend</option><option value="strike">Strike</option><option value="shoot">Shoot</option></select>
                </div>
              </div>
              <div class="command-toolbar">
                <button class="btn btn-sm btn-primary" onclick="applyPowerShift()">Divert Power</button>
                <button class="btn btn-sm" onclick="clearPowerShift()">Clear Shift</button>
              </div>
              <div id="navalCombatSummary"></div>
              <div class="combat-actions command-actions">
                <button class="btn btn-primary" onclick="navalAttack('strike')">Fire Cannons</button>
                <button class="btn btn-primary" onclick="navalAttack('shoot')">Loose Crossbows</button>
                <button class="btn btn-teal" onclick="navalRepair()">Engineer Repair</button>
                <button class="btn" onclick="navalTactics()">Captain Tactics</button>
                <button class="btn" onclick="navalMorale()">Captain Morale</button>
                <button class="btn" onclick="navalSurvey()">Navigator Survey</button>
                <button class="btn" onclick="rollShipPerception()">Ship Perception (d6)</button>
                <button class="btn" onclick="navalDiplomacy()">Captain Diplomacy</button>
                <button class="btn btn-teal" onclick="startNavalBoardingAction()">Board Enemy Ship</button>
                <button class="btn" onclick="enemyNavalAttack()">Enemy Attack</button>
                <button class="btn btn-red" onclick="wreckEnemyShip()">Wreck Enemy</button>
              </div>
              <div class="combat-log" id="navalCombatLog"></div>
            </div>
          </div>
        </div>
      `;
    }

    const gamblingPanel = document.getElementById("tab-gambling");
    if (gamblingPanel && !gamblingPanel.dataset.mounted) {
      gamblingPanel.dataset.mounted = "1";
      gamblingPanel.innerHTML = `
        <div class="gambling-grid">
          <div class="card">
            <div class="section-title">Gambling Den</div>
            <div style="font-size:.85rem;color:var(--muted3);line-height:1.65;">
              Choose a difficulty, pay the buy-in, roll two Dread dice from low to high, then guess whether your Valor Die lands <strong style="color:var(--gold2);">under</strong>, <strong style="color:var(--gold2);">middle</strong>, or <strong style="color:var(--gold2);">over</strong>.<br><br>
              If the Valor Die matches the lower or upper Dread die exactly, that still counts as <strong style="color:var(--gold2);">middle</strong>.
            </div>
            <div class="sea-summary" style="margin-top:.65rem;">
              <div class="info-cell"><span class="ic-label">Credits</span><span id="gamblingCredits">0 ₵</span></div>
              <div class="info-cell"><span class="ic-label">Buy In</span><span id="gamblingBuyIn">10 ₵</span></div>
              <div class="info-cell"><span class="ic-label">Difficulty</span><span id="gamblingDifficultyReadout">Level 1 - Easy</span></div>
              <div class="info-cell"><span class="ic-label">Die</span><span id="gamblingDieReadout">d20</span></div>
            </div>
            <div class="difficulty-grid" id="gamblingDifficultyGrid"></div>
            <div class="sub-label" style="margin-top:.8rem;">Guess The Valor Die</div>
            <div class="guess-grid">
              <button class="guess-btn" id="guess-under" onclick="setGamblingGuess('under')">Under</button>
              <button class="guess-btn" id="guess-middle" onclick="setGamblingGuess('middle')">Middle</button>
              <button class="guess-btn" id="guess-over" onclick="setGamblingGuess('over')">Over</button>
            </div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="playGamblingRound()">Play Hand</button>
              <button class="btn" onclick="clearGamblingHistory()">Clear Ledger</button>
            </div>
            <div class="gamble-rolls">
              <div class="gamble-die"><div class="gd-label">Dread One</div><div class="gd-value" id="gambleDieOne">-</div></div>
              <div class="gamble-die"><div class="gd-label">Valor</div><div class="gd-value" id="gambleValor">-</div></div>
              <div class="gamble-die"><div class="gd-label">Dread Two</div><div class="gd-value" id="gambleDieTwo">-</div></div>
            </div>
            <div id="gamblingOutcome" class="gamble-outcome" style="margin-top:.75rem;">
              Pick a difficulty and a guess, then let the house roll.
            </div>
          </div>
          <div class="card">
            <div class="section-title">House Ledger</div>
            <div style="font-size:.84rem;color:var(--muted3);line-height:1.6;margin-bottom:.55rem;">
              Payout equals the difficulty level times 10 Credits. Failure loses the buy-in.
            </div>
            <div class="gamble-history" id="gamblingHistory"></div>
          </div>
        </div>
      `;
    }
  }

  function appendRuleCards() {
    const rulesGrid = document.querySelector("#tab-rules > div");
    if (!rulesGrid || document.getElementById("lastSeaRulesCard")) {
      return;
    }

    rulesGrid.insertAdjacentHTML(
      "beforeend",
      `
        <div class="card" id="lastSeaRulesCard">
          <div class="section-title">Last Sea</div>
          <div style="font-size:.85rem;color:var(--muted3);line-height:1.7;">
            <strong style="color:var(--text);">Open Sea:</strong> Shift in Weather, Open Sea Encounter, Peril, or Uneventful Sailing.<br>
            <strong style="color:var(--text);">Sea Peril:</strong> Control vs DD6 or take the difference in Mental Stress.<br>
            <strong style="color:var(--text);">Island Travel:</strong> Land Encounter, Peril, Exhaustion, Shift in Weather, or Uneventful travel.<br>
            <strong style="color:var(--text);">Island Peril:</strong> Lead vs DD6 or take the difference in Mental Stress.
          </div>
        </div>
        <div class="card">
          <div class="section-title">Naval Combat</div>
          <div style="font-size:.85rem;color:var(--muted3);line-height:1.7;">
            <strong style="color:var(--text);">Hull Stress:</strong> equal to 2x current Defend die.<br>
            <strong style="color:var(--text);">Cannons:</strong> Strike at Close. <strong style="color:var(--text);">Crossbows:</strong> Shoot at Nearby.<br>
            <strong style="color:var(--text);">Hull Break:</strong> when Stress breaks the threshold, step Defend down and the crew take +1 Trauma.<br>
            <strong style="color:var(--text);">Wrecked:</strong> if a d4 hull breaks again, the ship is out of action.
          </div>
        </div>
        <div class="card">
          <div class="section-title">Gambling Den</div>
          <div style="font-size:.85rem;color:var(--muted3);line-height:1.7;">
            Buy in from <strong style="color:var(--text);">10 to 60 Credits</strong> based on difficulty.<br>
            Roll <strong style="color:var(--text);">2 Dread dice</strong>, order them low to high, then guess whether the Valor Die lands under, middle, or over.<br>
            Matching either Dread die counts as <strong style="color:var(--gold2);">middle</strong>.<br>
            A win pays <strong style="color:var(--green2);">difficulty level x 10 Credits</strong>.
          </div>
        </div>
      `
    );
  }

  function getLastSeaLayout() {
    const mode = S.lastSea.layout || "random";
    if (mode === "tiny") {
      return [{ hexes: 3, days: 1, river: false }];
    }
    if (mode === "broad") {
      return [{ hexes: 9, days: 3, river: false }];
    }
    if (mode === "archipelago") {
      return [
        { hexes: 6, days: 2, river: true },
        { hexes: 6, days: 2, river: true },
        { hexes: 6, days: 2, river: true }
      ];
    }
    return pick([
      [{ hexes: 3, days: 1, river: false }],
      [{ hexes: 9, days: 3, river: false }],
      [
        { hexes: 6, days: 2, river: true },
        { hexes: 6, days: 2, river: true },
        { hexes: 6, days: 2, river: true }
      ]
    ]);
  }

  function seaNeighborCoords(col, row) {
    const even = col % 2 === 0;
    const deltas = even
      ? [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]]
      : [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    return deltas
      .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
      .filter((item) => item.col >= 0 && item.col < LAST_SEA_COLS && item.row >= 0 && item.row < LAST_SEA_ROWS);
  }

  function seaKey(col, row) {
    return `${col},${row}`;
  }

  function getSeaCell(col, row) {
    return S.lastSea.map.find((hex) => hex.col === col && hex.row === row);
  }

  function describeSeaHex(waterTerrain) {
    const wt = waterTerrain && typeof waterTerrain === "object"
      ? waterTerrain
      : LAST_SEA_WATER_TERRAINS[0];
    return `${pick([
      "Deep blue water folds in long glassy swells.",
      "Dark open water shivers with crosscurrents.",
      "Foam-crowned waves roll under a wind-cut sky.",
      "The sea here is iron-grey and strangely cold."
    ])} ${pick([
      "Wreckage drifts somewhere beyond sight.",
      "A lone bird wheels overhead and then vanishes inland.",
      "The horizon looks too wide, as if the world has thinned.",
      "Salt hangs in the air like old memory."
    ])} Waters: ${wt.label}.`;
  }

  function pickSeaWaterTerrain() {
    const weighted = [];
    LAST_SEA_WATER_TERRAINS.forEach(function (entry) {
      const count = Math.max(1, Number(entry && entry.weight) || 1);
      for (let i = 0; i < count; i += 1) weighted.push(entry);
    });
    return pick(weighted);
  }

  function describeIslandHex(terrain, ecology, siteType) {
    const siteNote =
      siteType === "landmark"
        ? "Something ceremonial stands inland."
        : siteType === "settlement"
          ? "Smoke, sound, or tool-work suggests habitation."
          : siteType === "colosseum"
            ? "A war-ring rises from the surf, roaring with crowd-noise and wagers."
          : siteType === "dungeon"
            ? "Broken stone and shadow hint at buried chambers."
            : "The shoreline looks mostly untouched.";
    return `${pick(terrain.coast)} Ecology: ${ecology}. ${siteNote}`;
  }

  function ensureSeaWeatherCheck(weather) {
    if (!weather || typeof weather !== "object") return weather;
    if (!weather.rough) return weather;
    if (weather.check && typeof weather.check === "object") {
      weather.check.dd = Number(weather.check.dd) || 8;
      weather.check.stats = Array.isArray(weather.check.stats) && weather.check.stats.length
        ? weather.check.stats
        : ["lead", "control"];
      if (!weather.check.failure) weather.check.failure = "Mental Stress equals failed difference";
      return weather;
    }
    weather.check = {
      dd: 8,
      stats: ["lead", "control"],
      failure: "Mental Stress equals failed difference"
    };
    return weather;
  }

  function rollLastSeaWeather() {
    const season = S.currentSeason || "spring";
    return ensureSeaWeatherCheck({ ...pick(LAST_SEA_WEATHER[season]) });
  }

  function maybeAdvanceSeaWeatherOnTravel(distance, travelType) {
    if (!S.lastSea) return false;
    const weather = ensureSeaWeatherCheck(S.lastSea.weather || rollLastSeaWeather());
    S.lastSea.weather = weather;
    if (!weather || (weather.check && !weather.checkResolved)) return false;

    const steps = Math.max(1, Number(distance) || 1);
    const baseChance = travelType === 'sea-island' ? 0.35 : 0.5;
    const shiftChance = Math.min(0.85, baseChance + ((steps - 1) * 0.08));
    if (Math.random() > shiftChance) return false;

    const currentLabel = String(weather.label || '');
    let next = weather;
    for (let i = 0; i < 4; i += 1) {
      const candidate = rollLastSeaWeather();
      if (!candidate || String(candidate.label || '') !== currentLabel) {
        next = candidate;
        break;
      }
    }
    S.lastSea.weather = ensureSeaWeatherCheck(next);
    showNotif('Sea weather shifts: ' + (S.lastSea.weather && S.lastSea.weather.label ? S.lastSea.weather.label : 'Changing skies') + '.', 'warn');
    if (typeof renderLastSeaInfo === 'function' && S.lastSea.selected) {
      renderLastSeaInfo(S.lastSea.selected);
    }
    return true;
  }

  function makeSettlementData() {
    return {
      name: `${pick(SETTLEMENT_STYLES)} ${pick(SETTLEMENT_FEATURES)}`,
      lord: pick(HOLDING_LORDS),
      mood: pick(LOCAL_MOODS),
      style: pick(SETTLEMENT_STYLES),
      feature: pick(SETTLEMENT_FEATURES),
      cultural: pick(SETTLEMENT_CULTURAL),
      food: pick(SETTLEMENT_FOOD),
      goods: pick(SETTLEMENT_GOODS),
      news: pick(SETTLEMENT_NEWS)
    };
  }

  function makeLandmarkData() {
    return {
      name: pick(MONUMENT_FORMS),
      effect: pick(MONUMENT_EFFECTS),
      detail: pick([
        "Sea birds nest in its highest cracks.",
        "The stone hums softly whenever the tide rises.",
        "Old offerings still lie untouched around the base.",
        "Its shadow falls in the wrong direction at dusk."
      ])
    };
  }

  function makeDungeonData() {
    return {
      name: pick(["Flooded Vault", "Salt Ruin", "Coral Shrine", "Sunken Watchpost", "Storm Crypt", "Sea Cistern"]),
      builder: pick(RUIN_BUILDERS),
      builtFor: pick(RUIN_BUILT_FOR),
      novelty: pick(RUIN_NOVELTIES),
      construction: pick(RUIN_CONSTRUCTIONS),
      entrance: pick(RUIN_ENTRANCES),
      rooms: roll(4) + 2
    };
  }

  function makeColosseumData() {
    return {
      name: pick(["Leviathan Ring", "Salt Crown Arena", "Brasswake Colosseum", "Abyss Court Pit"]),
      host: pick(["Arena Herald", "Tide Magistrate", "Iron Bookmaker", "Harbor Priest"]),
      style: pick(["bloodsport bracket", "ritual duel ladder", "crew-versus-crew melee", "champion gauntlet"]),
      crowd: pick(["raider captains", "mercenary crews", "pilgrim gamblers", "city exiles"])
    };
  }

  function createSeaSite(type) {
    if (type === "settlement") {
      return makeSettlementData();
    }
    if (type === "landmark") {
      return makeLandmarkData();
    }
    if (type === "colosseum") {
      return makeColosseumData();
    }
    return makeDungeonData();
  }

  function createSeaCluster(hexCount, islandIndex) {
    for (let attempt = 0; attempt < 140; attempt += 1) {
      const startCol = roll(LAST_SEA_COLS - 2);
      const startRow = roll(LAST_SEA_ROWS - 2);
      const cluster = [seaKey(startCol, startRow)];
      const frontier = [seaKey(startCol, startRow)];

      while (cluster.length < hexCount && frontier.length) {
        const current = pick(frontier);
        const [col, row] = current.split(",").map(Number);
        const neighbors = seaNeighborCoords(col, row)
          .map((item) => seaKey(item.col, item.row))
          .filter((key) => !cluster.includes(key) && !S.lastSea.map.some((hex) => hex.key === key && hex.type === "island"));

        if (!neighbors.length) {
          frontier.splice(frontier.indexOf(current), 1);
          continue;
        }

        const next = pick(neighbors);
        cluster.push(next);
        frontier.push(next);
      }

      if (cluster.length === hexCount) {
        return cluster.map((key) => {
          const [col, row] = key.split(",").map(Number);
          return { col, row, islandIndex };
        });
      }
    }
    return [];
  }

  function updateLastSeaGroupList() {
    const container = document.getElementById("lastSeaIslandGroups");
    if (!container) {
      return;
    }

    if (!S.lastSea.islands.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = S.lastSea.islands
      .map((island) => `<span class="sea-chip">${island.name} - ${island.hexes} hexes - ${island.days} day${island.days > 1 ? "s" : ""}${island.river ? " - river-broken" : ""}</span>`)
      .join("");
  }

  function generateLastSea() {
    ensureExpansionState();
    if (typeof window.getMapFogConfig === 'function') {
      const seaFog = window.getMapFogConfig('sea');
      seaFog.revealed = {};
    }
    const layoutSelect = document.getElementById("lastSeaLayoutSelect");
    if (layoutSelect) {
      S.lastSea.layout = layoutSelect.value;
    }

    S.lastSea.map = [];
    S.lastSea.selectedKey = null;
    S.lastSea.activeEncounterKey = null;
    S.lastSea.islands = [];
    S.lastSea.weather = rollLastSeaWeather();

    for (let col = 0; col < LAST_SEA_COLS; col += 1) {
      for (let row = 0; row < LAST_SEA_ROWS; row += 1) {
        const seaTerrain = pickSeaWaterTerrain();
        S.lastSea.map.push({
          key: seaKey(col, row),
          col,
          row,
          type: "sea",
          terrain: seaTerrain.key,
          seaLabel: seaTerrain.label,
          terrainColor: seaTerrain.color,
          icon: seaTerrain.glyph,
          desc: describeSeaHex(seaTerrain),
          resultHtml: "",
          encounter: null
        });
      }
    }

    // Bias terrain/ecology picks toward the active Theos province's climateBand.
    const _theosDNA = (typeof window.getActiveTheosProvinceDNA === 'function') ? window.getActiveTheosProvinceDNA() : null;
    const _theosClimate = _theosDNA ? (_theosDNA.climateBand || '') : '';
    const THEOS_CLIMATE_TERRAIN_BIAS = {
      cold:      ['Snow','Tundra','Mountain'],
      temperate: ['Grassland','Forest'],
      highland:  ['Mountain','Grassland'],
      arid:      ['Desert','Badlands'],
      coastal:   ['Jungle','Grassland'],
      storm:     ['Jungle','Forest'],
      forest:    ['Forest','Jungle'],
      marsh:     ['Swamp','Forest'],
      tropical:  ['Jungle']
    };
    const THEOS_CLIMATE_ECOLOGY_BIAS = {
      cold:    ['tundra','arctic'],
      arid:    ['desert','scrub'],
      coastal: ['coral','mangrove'],
      marsh:   ['wetland','bog'],
      forest:  ['old-growth','canopy'],
      tropical:['jungle','reef']
    };
    const ISLAND_MICRO_TERRAINS = {
      Grassland: ['island_meadow', 'island_bluffs', 'island_heath'],
      Forest: ['island_canopy', 'island_grove', 'island_mosswood'],
      Jungle: ['island_jungle', 'island_mangrove', 'island_rainridge'],
      Desert: ['island_dunes', 'island_saltflat', 'island_sunrock'],
      Mountain: ['island_crags', 'island_highland', 'island_peakline'],
      Swamp: ['island_marsh', 'island_bog', 'island_reedbank'],
      Tundra: ['island_tundra', 'island_frostmoor', 'island_icefield'],
      Snow: ['island_snowpack', 'island_glacier', 'island_frostcliff'],
      Badlands: ['island_badlands', 'island_shatterplain', 'island_drygorge']
    };
    function pickIslandMicroTerrain(baseTerrain) {
      const options = ISLAND_MICRO_TERRAINS[baseTerrain] || ['island_shore', 'island_inland', 'island_highland'];
      return pick(options);
    }
    function _pickBiasedTerrain() {
      const preferred = THEOS_CLIMATE_TERRAIN_BIAS[_theosClimate] || [];
      const candidates = preferred.length ? LAST_SEA_TERRAINS.filter(t => preferred.some(p => t.name.toLowerCase().includes(p.toLowerCase()))) : [];
      return (candidates.length && Math.random() < 0.6) ? candidates[Math.floor(Math.random() * candidates.length)] : pick(LAST_SEA_TERRAINS);
    }
    function _pickBiasedEcology() {
      const preferred = THEOS_CLIMATE_ECOLOGY_BIAS[_theosClimate] || [];
      const candidates = preferred.length ? LAST_SEA_ECOLOGY.filter(e => preferred.some(p => (typeof e === 'string' ? e : e.name || '').toLowerCase().includes(p.toLowerCase()))) : [];
      return (candidates.length && Math.random() < 0.6) ? candidates[Math.floor(Math.random() * candidates.length)] : pick(LAST_SEA_ECOLOGY);
    }

    const layouts = getLastSeaLayout();
    let colosseumPlaced = false;
    layouts.forEach((layout, index) => {
      const terrain = _pickBiasedTerrain();
      const ecology = _pickBiasedEcology();
      const cluster = createSeaCluster(layout.hexes, index);
      const name = layouts.length === 1 ? "Island Prime" : `Island ${index + 1}`;

      const islandMeta = {
        id: `island-${index + 1}`,
        name,
        hexes: layout.hexes,
        days: layout.days,
        river: layout.river,
        terrain: terrain.name,
        ecology
      };
      S.lastSea.islands.push(islandMeta);

      const siteTypes = layout.hexes >= 9 ? ["settlement", "landmark", "dungeon"] : layout.hexes >= 6 ? pickN(["settlement", "landmark", "dungeon"], 2) : [pick(["settlement", "landmark", "dungeon"])];
      if (!colosseumPlaced && (layout.hexes >= 6 || index === layouts.length - 1)) {
        siteTypes.push("colosseum");
        colosseumPlaced = true;
      }
      const siteCells = pickN(cluster, siteTypes.length);

      cluster.forEach((cell, position) => {
        const hex = getSeaCell(cell.col, cell.row);
        if (!hex) {
          return;
        }
        const siteIndex = siteCells.findIndex((item) => item.col === cell.col && item.row === cell.row);
        const siteType = siteIndex >= 0 ? siteTypes[siteIndex] : null;
        hex.type = "island";
        hex.islandId = islandMeta.id;
        hex.islandName = islandMeta.name;
        hex.terrain = terrain.name;
        hex.terrainSubtype = pickIslandMicroTerrain(terrain.name);
        hex.terrainColor = terrain.color;
        hex.ecology = ecology;
        hex.siteType = siteType;
        hex.siteData = siteType ? createSeaSite(siteType) : null;
        hex.icon = siteType === "settlement" ? "⌂" : siteType === "landmark" ? "◈" : siteType === "dungeon" ? "◫" : siteType === "colosseum" ? "⚔" : "•";
        const subtypeLabel = String(hex.terrainSubtype || '').replace(/^island_/, '').replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); });
        hex.desc = describeIslandHex(terrain, ecology, siteType) + (subtypeLabel ? ` Terrain type: ${subtypeLabel}.` : '');
        hex.title = siteType && hex.siteData && hex.siteData.name ? hex.siteData.name : `${terrain.name} ${subtypeLabel || 'Shore'} ${position + 1}`;
      });
    });

    renderLastSeaMap();
    renderLastSeaInfo();
    updateLastSeaGroupList();
    showNotif("Last Sea charted.", "good");
  }

  function clearLastSea() {
    ensureExpansionState();
    if (typeof window.getMapFogConfig === 'function') {
      const seaFog = window.getMapFogConfig('sea');
      seaFog.revealed = {};
    }
    S.lastSea.map = [];
    S.lastSea.islands = [];
    S.lastSea.selectedKey = null;
    S.lastSea.activeEncounterKey = null;
    S.lastSea.weather = null;
    updateLastSeaGroupList();
    renderLastSeaMap();
    renderLastSeaInfo();
  }

  function seaHexToPixel(col, row) {
    const width = Math.sqrt(3) * LAST_SEA_HEX;
    const height = LAST_SEA_HEX * 2;
    return {
      x: col * width + (row % 2) * (width / 2) + LAST_SEA_HEX + 12,
      y: row * height * 0.75 + LAST_SEA_HEX + 12
    };
  }

  function seaHexPoints(cx, cy) {
    return Array.from({ length: 6 }, (_, index) => {
      const angle = Math.PI / 180 * (60 * index - 30);
      return `${cx + LAST_SEA_HEX * Math.cos(angle)},${cy + LAST_SEA_HEX * Math.sin(angle)}`;
    }).join(" ");
  }

  function normalizeTerrainAssetKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function getTerrainTextureForSeaHex(hex) {
    if (typeof window.getTerrainTileAsset !== 'function' || !hex) return '';
    const candidates = [];
    const terrainName = normalizeTerrainAssetKey(hex.terrain || '');
    const terrainSubtype = normalizeTerrainAssetKey(hex.terrainSubtype || '');
    const typeName = normalizeTerrainAssetKey(hex.type || 'sea');
    if (typeName === 'sea') {
      if (terrainName) candidates.push(terrainName);
      if (typeName && candidates.indexOf(typeName) < 0) candidates.push(typeName);
    } else if (typeName === 'island') {
      if (terrainSubtype) candidates.push(terrainSubtype);
      if (terrainName) candidates.push(terrainName);
      candidates.push('island');
    } else {
      if (typeName) candidates.push(typeName);
      if (terrainName && candidates.indexOf(terrainName) < 0) candidates.push(terrainName);
    }
    if (typeName === 'sea' && candidates.indexOf('open_sea') < 0) candidates.push('open_sea');
    for (let i = 0; i < candidates.length; i += 1) {
      const hit = String(window.getTerrainTileAsset('sea', candidates[i]) || '');
      if (hit.indexOf('data:image/') === 0) return hit;
    }
    return '';
  }

  function ensureSeaTexturePattern(svg, defs, id, dataUrl, tileSize) {
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

  function getSeaSecretPadKey() {
    if (!S || !S.lastSea || !Array.isArray(S.lastSea.map) || !S.lastSea.map.length) return "";
    if (typeof window.isSecretPadUnlocked === 'function' && !window.isSecretPadUnlocked('sea')) return "";
    S.mapLinks = S.mapLinks || {};
    const exists = S.lastSea.map.some((h) => h && h.key === S.mapLinks.seaSecretPadKey);
    if (!exists) {
      const candidates = S.lastSea.map.filter((h) => h && (h.type === "sea" || h.type === "island"));
      const source = candidates.length ? candidates : S.lastSea.map;
      const picked = source[Math.floor(Math.random() * source.length)];
      S.mapLinks.seaSecretPadKey = picked ? picked.key : "";
    }
    return S.mapLinks.seaSecretPadKey || "";
  }

  function getAdjacentSeaKeysForHex(hex) {
    if (!hex || !Array.isArray(S.lastSea.map)) return [];
    return S.lastSea.map
      .filter(function (entry) {
        if (!entry || entry.key === hex.key) return false;
        return Math.abs(Number(entry.col) - Number(hex.col)) <= 1
          && Math.abs(Number(entry.row) - Number(hex.row)) <= 1;
      })
      .map(function (entry) { return String(entry.key || ""); })
      .filter(Boolean);
  }

  function isSeaHexVisibleByFog(hexKey) {
    if (typeof window.isMapFogHexVisible !== "function") return true;
    return window.isMapFogHexVisible("sea", String(hexKey || ""), String(S.lastSea.selectedKey || ""));
  }

  function getAdjacentSeaDirections(hex) {
    const dirs = [{key:'north',label:'North',dc:0,dr:-1},{key:'northeast',label:'Northeast',dc:1,dr:-1},{key:'east',label:'East',dc:1,dr:0},{key:'southeast',label:'Southeast',dc:1,dr:1},{key:'south',label:'South',dc:0,dr:1},{key:'southwest',label:'Southwest',dc:-1,dr:1},{key:'west',label:'West',dc:-1,dr:0},{key:'northwest',label:'Northwest',dc:-1,dr:-1}];
    return dirs.filter(d => (Array.isArray(S.lastSea.map) ? S.lastSea.map : []).some(e => e && Number(e.col) === Number(hex.col) + d.dc && Number(e.row) === Number(hex.row) + d.dr));
  }
  function getSeaHexByDirection(hex, directionKey) {
    const dirs = getAdjacentSeaDirections(hex);
    const d = dirs.find(x => x.key === directionKey);
    if (!d) return null;
    const found = (Array.isArray(S.lastSea.map) ? S.lastSea.map : []).find(e => e && Number(e.col) === Number(hex.col) + d.dc && Number(e.row) === Number(hex.row) + d.dr);
    if (!found) return null;
    return {hex: found, label: d.label};
  }
  function performSeaObservation(directionKey) {
    const hex = (Array.isArray(S.lastSea.map) ? S.lastSea.map : []).find(e => e && e.key === S.lastSea.selectedKey);
    if (!hex) { showNotif('Select a sea hex first.', 'warn'); return; }
    const leadDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('lead') : ((S.stats && S.stats.lead) || 4);
    const target = getSeaHexByDirection(hex, directionKey);
    const finalizeObservation = function(outcome) {
      const actionTotal = Number((outcome && outcome.actionTotal) || 0);
      const dreadTotal = Number((outcome && outcome.dreadTotal) || 0);
      const success = !!(outcome && outcome.success);
      let result = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.4rem;"><div style="text-align:center;"><div style="font-size:.7rem;color:var(--muted2);">Lead d' + leadDie + '</div><div style="font-size:1.6rem;color:var(--teal);font-family:Rajdhani,sans-serif;font-weight:700;">' + actionTotal + '</div></div><div style="text-align:center;"><div style="font-size:.7rem;color:var(--muted2);">DD6</div><div style="font-size:1.6rem;color:var(--red2);font-family:Rajdhani,sans-serif;font-weight:700;">' + dreadTotal + '</div></div></div>';
      if (success) {
        if (target) {
          if (typeof window.revealMapFogHex === 'function') window.revealMapFogHex('sea', String(target.hex.key || ''));
          if (typeof addSuccessRoll === 'function') addSuccessRoll();
          result += '<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Observation success (' + target.label + ')</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);"><div style="font-size:.78rem;color:var(--teal);font-weight:700;margin-bottom:.15rem;">[' + (target.hex.col + 1) + ',' + (target.hex.row + 1) + '] ' + (target.hex.title || target.hex.islandName || target.hex.seaLabel || 'Open Sea') + '</div><div style="font-size:.7rem;color:var(--muted2);">New lane intel acquired.</div></div></div>';
        } else {
          result += '<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">No hex in that direction</div></div>';
        }
      } else {
        if (typeof addTMWOnFail === 'function') addTMWOnFail('general-failure', {
          failedBy: Math.max(1, dreadTotal - actionTotal),
          actionDie: Math.max(4, Number(leadDie) || 4),
          dreadDie: 6,
          actionLabel: 'Lead Die',
          onConvert: function () {
            if (target) {
              if (typeof window.revealMapFogHex === 'function') window.revealMapFogHex('sea', String(target.hex.key || ''));
              if (typeof renderLastSeaMap === 'function') renderLastSeaMap();
              if (typeof renderLastSeaInfo === 'function') renderLastSeaInfo();
              if (typeof openModal === 'function') {
                setTimeout(function () {
                  openModal('Observation — Teamwork Success', '<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Observation converted (' + target.label + ')</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);"><div style="font-size:.78rem;color:var(--teal);font-weight:700;margin-bottom:.15rem;">[' + (target.hex.col + 1) + ',' + (target.hex.row + 1) + '] ' + (target.hex.title || target.hex.islandName || target.hex.seaLabel || 'Open Sea') + '</div><div style="font-size:.7rem;color:var(--muted2);">New lane intel acquired through Teamwork. No Successful Roll gained.</div></div></div>');
                }, 80);
              }
              return true;
            }
            return false;
          }
        });
        result += '<div style="font-size:.82rem;color:var(--red2);">✗ Observation fails. Fog and spray obscure the route.</div>';
      }
      if (typeof openModal === 'function') openModal('Observe Adjacent Sea Hex', result);
      renderLastSeaMap();
      renderLastSeaInfo();
    };

    if (isSeaManualRollMode()) {
      if (typeof closeModal === 'function') closeModal();
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Observe Adjacent Sea Hex',
        context: 'Observe Adjacent (' + (target ? target.label : 'Unknown Direction') + ')',
        statKey: 'lead',
        statLabel: 'Lead',
        actionDie: leadDie,
        dreadDie: 6,
        onResolve: finalizeObservation
      });
      return;
    }

    const action = explodingRoll(leadDie);
    const dread = explodingRoll(6);
    finalizeObservation({
      success: action.total >= dread.total,
      actionTotal: action.total,
      dreadTotal: dread.total,
      manual: false
    });
  }
  function observeAdjacentSeaFromSelected() {
    ensureExpansionState();
    const hex = (Array.isArray(S.lastSea.map) ? S.lastSea.map : []).find(e => e && e.key === S.lastSea.selectedKey);
    if (!hex) { showNotif('Select a sea hex first.', 'warn'); return; }
    const options = getAdjacentSeaDirections(hex);
    if (!options.length) { showNotif('No adjacent sea hexes to observe.', 'warn'); return; }
    let html = '<div style="font-size:.82rem;color:var(--text2);margin-bottom:.35rem;">Choose one adjacent direction to observe (Lead vs DD6).</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;">'; options.forEach(opt => { html += '<button class="btn btn-sm btn-teal" onclick="performSeaObservation(\'' + opt.key + '\')">' + opt.label + '</button>'; }); html += '</div>'; if (typeof openModal === 'function') openModal('Observe Adjacent Sea Hex', html);
  }
  window.performSeaObservation = performSeaObservation;
  window.observeAdjacentSeaFromSelected = observeAdjacentSeaFromSelected;

  function renderLastSeaMap() {
    if (window.factionSystem && typeof window.factionSystem.syncBaseMarkers === "function") window.factionSystem.syncBaseMarkers();
    const svg = document.getElementById("lastSeaSvg");
    if (!svg) {
      return;
    }
    const mapFx = (typeof window.getMapVisualSettings === "function")
      ? window.getMapVisualSettings()
      : { hex3d: false, overlay: "none" };

    if (!S.lastSea.map.length) {
      svg.setAttribute("width", "760");
      svg.setAttribute("height", "660");
      svg.setAttribute("viewBox", "0 0 760 660");
      if (typeof window.applyMapOverlayStyle === "function") window.applyMapOverlayStyle(svg, "lastsea");
      svg.innerHTML = `
        <text x="380" y="318" text-anchor="middle" font-family="Cinzel,serif" font-size="13" fill="#254454">Generate the Last Sea to begin</text>
        <text x="380" y="343" text-anchor="middle" font-family="Cinzel,serif" font-size="10" fill="#1a2c38">Every hex carries a description and an exploration roll.</text>
      `;
      return;
    }

    const width = Math.max(760, LAST_SEA_COLS * Math.sqrt(3) * LAST_SEA_HEX + Math.sqrt(3) * LAST_SEA_HEX + 24);
    const height = Math.max(660, LAST_SEA_ROWS * LAST_SEA_HEX * 1.5 + LAST_SEA_HEX * 1.5 + 24);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.innerHTML = "";
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    const textureFillCache = {};
    if (typeof window.applyMapOverlayStyle === "function") window.applyMapOverlayStyle(svg, "lastsea");

    const secretPadKey = getSeaSecretPadKey();
    if (typeof window.ensureBackstoryScopeMarkers === "function") {
      window.ensureBackstoryScopeMarkers("sea", S.lastSea.map.map(function (h) {
        return {
          key: String(h && h.key || ""),
          type: String(h && h.type || "sea"),
          label: String((h && (h.title || h.islandName)) || "Open Sea")
        };
      }), { homeTypes: ["island", "harbor"], rivalTypes: ["sea", "storm", "peril"], connectionTypes: ["island", "market", "harbor"] });
    }
    const hasSeaSelection = !!(S.lastSea && S.lastSea.selectedKey);
    if (hasSeaSelection && typeof window.revealMapFogHex === 'function') {
      window.revealMapFogHex('sea', String(S.lastSea.selectedKey || ''));
    }
    S.lastSea.map.forEach((hex) => {
      const { x, y } = seaHexToPixel(hex.col, hex.row);
      const r = LAST_SEA_HEX - 1;
      const fill = hex.terrainColor || (hex.type === "sea" ? "#103247" : "#486734");
      const textureKey = normalizeTerrainAssetKey(hex.type || 'sea') + '|' + normalizeTerrainAssetKey(hex.terrainSubtype || '') + '|' + normalizeTerrainAssetKey(hex.terrain || '');
      if (typeof textureFillCache[textureKey] === 'undefined') {
        const dataUrl = getTerrainTextureForSeaHex(hex);
        textureFillCache[textureKey] = dataUrl
          ? ensureSeaTexturePattern(svg, defs, 'seaTexture' + textureKey.replace(/[^a-z0-9_]+/g, ''), dataUrl, Math.max(24, Math.floor(LAST_SEA_HEX * 1.15)))
          : '';
      }
      const isSelected = S.lastSea.selectedKey === hex.key;
      const fogHidden = !isSeaHexVisibleByFog(hex.key);
      const stroke = isSelected ? "#e8c050" : hex.type === "sea" ? "#2ec4b6" : "#c9a227";

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "svg-hex" + (isSelected ? " sel" : ""));

      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", seaHexPoints(x, y));
      polygon.setAttribute("fill", textureFillCache[textureKey] || fill);
      polygon.setAttribute("stroke", stroke);
      polygon.setAttribute("stroke-width", isSelected ? "2.6" : (mapFx.hex3d ? "1.7" : "1.3"));
      group.appendChild(polygon);

      if (mapFx.hex3d) {
        const topA = Math.PI / 180 * -30;
        const topB = Math.PI / 180 * 30;
        const rightA = Math.PI / 180 * 30;
        const rightB = Math.PI / 180 * 90;
        const hi = document.createElementNS("http://www.w3.org/2000/svg", "line");
        hi.setAttribute("x1", String(x + r * Math.cos(topA)));
        hi.setAttribute("y1", String(y + r * Math.sin(topA)));
        hi.setAttribute("x2", String(x + r * Math.cos(topB)));
        hi.setAttribute("y2", String(y + r * Math.sin(topB)));
        hi.setAttribute("stroke", "rgba(255,255,255,.24)");
        hi.setAttribute("stroke-width", "1.2");
        hi.setAttribute("pointer-events", "none");
        group.appendChild(hi);

        const sh = document.createElementNS("http://www.w3.org/2000/svg", "line");
        sh.setAttribute("x1", String(x + r * Math.cos(rightA)));
        sh.setAttribute("y1", String(y + r * Math.sin(rightA)));
        sh.setAttribute("x2", String(x + r * Math.cos(rightB)));
        sh.setAttribute("y2", String(y + r * Math.sin(rightB)));
        sh.setAttribute("stroke", "rgba(0,0,0,.28)");
        sh.setAttribute("stroke-width", "1.2");
        sh.setAttribute("pointer-events", "none");
        group.appendChild(sh);

        const terrainGlyph = hex.type === "sea" ? (hex.icon || "≈") : "♣";
        const gt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        gt.setAttribute("x", String(x - r * 0.38));
        gt.setAttribute("y", String(y - r * 0.26));
        gt.setAttribute("text-anchor", "middle");
        gt.setAttribute("font-size", "8.5");
        gt.setAttribute("fill", "rgba(255,255,255,.24)");
        gt.setAttribute("pointer-events", "none");
        gt.textContent = terrainGlyph;
        group.appendChild(gt);
      }

      // Keep map icons/markers readable by painting fog before overlays.
      if (fogHidden) {
        const fogCover = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        fogCover.setAttribute("points", seaHexPoints(x, y));
        fogCover.setAttribute("fill", "rgba(6,10,16,.84)");
        fogCover.setAttribute("stroke", "rgba(110,124,148,.35)");
        fogCover.setAttribute("stroke-width", "1");
        fogCover.setAttribute("pointer-events", "none");
        group.appendChild(fogCover);
        const fogMark = document.createElementNS("http://www.w3.org/2000/svg", "text");
        fogMark.setAttribute("x", x);
        fogMark.setAttribute("y", y + 4);
        fogMark.setAttribute("text-anchor", "middle");
        fogMark.setAttribute("font-size", "11");
        fogMark.setAttribute("fill", "rgba(201,214,240,.65)");
        fogMark.setAttribute("pointer-events", "none");
        fogMark.textContent = "?";
        group.appendChild(fogMark);
      }

      // Render mission tokens for sea missions
      const missionToken = S.lastSea.missionTokens && S.lastSea.missionTokens[hex.key];
      if (missionToken) {
        const missionRef = (S && Array.isArray(S.activeMissions))
          ? S.activeMissions.find(function (m) { return m && String(m.id || '') === String(missionToken.missionId || ''); })
          : null;
        const isLegacyRaid = missionToken.missionType === 'legacy_raid' || !!(missionRef && missionRef.missionType === 'legacy_raid');
        const isSoulMission = missionToken.missionType === 'soul_mission' || !!(missionRef && missionRef.missionType === 'soul_mission');
        const tokenIcon = isSoulMission ? (missionToken.icon || '⚒') : missionToken.type === 'site' ? '🧭' : missionToken.type === 'informer' ? '👁' : missionToken.type === 'story' ? '➤'
          : missionToken.type === 'solar_cycle_marker' ? '☄'
          : missionToken.type === 'solar_cycle_side' ? '🌍'
          : (missionToken.type === 'solar_cycle_story' && missionToken.storyType === 'stage') ? '🌑'
          : (missionToken.type === 'solar_cycle_story' && (missionToken.storyType === 'quest' || missionToken.storyType === 'investigation' || missionToken.nsSubtype === 'investigation')) ? '⏳'
          : '📍';
        const raidIcon = isLegacyRaid ? '🐉' : tokenIcon;
        const tokenColor = isSoulMission ? '#ff6f91' : missionToken.type === 'site' ? '#ff8450' : missionToken.type === 'informer' ? '#e8c050' : missionToken.type === 'story' ? '#f0d070'
          : missionToken.type === 'solar_cycle_marker' ? '#f0a050'
          : missionToken.type === 'solar_cycle_side' ? '#9ad37b'
          : (missionToken.type === 'solar_cycle_story' && missionToken.storyType === 'stage') ? '#f5d76e'
          : (missionToken.type === 'solar_cycle_story' && (missionToken.storyType === 'quest' || missionToken.storyType === 'investigation' || missionToken.nsSubtype === 'investigation')) ? '#c9d6f0'
          : '#e05050';
        const raidColor = isLegacyRaid ? '#ff8450' : tokenColor;
        
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', x);
        glow.setAttribute('cy', y - LAST_SEA_HEX * 0.35);
        glow.setAttribute('r', '8');
        glow.setAttribute('fill', 'rgba(' + (raidColor === '#ff8450' ? '255,132,80' : raidColor === '#e8c050' ? '232,192,80' : raidColor === '#f0d070' ? '240,208,112' : raidColor === '#f0a050' ? '240,160,80' : raidColor === '#9ad37b' ? '154,211,123' : raidColor === '#f5d76e' ? '245,215,110' : raidColor === '#c9d6f0' ? '200,214,240' : '224,80,80') + ',.15)');
        glow.setAttribute('stroke', raidColor);
        glow.setAttribute('stroke-width', '1');
        glow.setAttribute('pointer-events', 'none');
        group.appendChild(glow);
        
        const micon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        micon.setAttribute('x', x);
        micon.setAttribute('y', y - LAST_SEA_HEX * 0.25);
        micon.setAttribute('text-anchor', 'middle');
        micon.setAttribute('font-size', '10');
        micon.setAttribute('fill', raidColor);
        micon.setAttribute('pointer-events', 'none');
        micon.textContent = raidIcon;
        group.appendChild(micon);
      }

      const factionBaseMarker = window.factionSystem && typeof window.factionSystem.getSeaMarker === "function"
        ? window.factionSystem.getSeaMarker(hex.key)
        : null;
      if (factionBaseMarker) {
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        glow.setAttribute('cx', x + LAST_SEA_HEX * 0.45);
        glow.setAttribute('cy', y - LAST_SEA_HEX * 0.38);
        glow.setAttribute('r', '8');
        glow.setAttribute('fill', 'rgba(70,196,182,.18)');
        glow.setAttribute('stroke', '#46c4b6');
        glow.setAttribute('stroke-width', '1.1');
        glow.setAttribute('pointer-events', 'none');
        group.appendChild(glow);

        const bIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        bIcon.setAttribute('x', x + LAST_SEA_HEX * 0.45);
        bIcon.setAttribute('y', y - LAST_SEA_HEX * 0.30);
        bIcon.setAttribute('text-anchor', 'middle');
        bIcon.setAttribute('font-size', '10');
        bIcon.setAttribute('fill', '#46c4b6');
        bIcon.setAttribute('pointer-events', 'none');
        bIcon.textContent = '🏰';
        group.appendChild(bIcon);
      }

      const factionTask = window.factionSystem && typeof window.factionSystem.getSeaTask === "function"
        ? window.factionSystem.getSeaTask(hex.key)
        : null;
      if (factionTask) {
        const tGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        tGlow.setAttribute('cx', x - LAST_SEA_HEX * 0.46);
        tGlow.setAttribute('cy', y + LAST_SEA_HEX * 0.44);
        tGlow.setAttribute('r', '8');
        tGlow.setAttribute('fill', factionTask.status === 'combat_pending' ? 'rgba(224,80,80,.2)' : 'rgba(232,192,80,.18)');
        tGlow.setAttribute('stroke', factionTask.status === 'combat_pending' ? '#e05050' : '#e8c050');
        tGlow.setAttribute('stroke-width', '1.1');
        tGlow.setAttribute('pointer-events', 'none');
        group.appendChild(tGlow);

        const tIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tIcon.setAttribute('x', x - LAST_SEA_HEX * 0.46);
        tIcon.setAttribute('y', y + LAST_SEA_HEX * 0.52);
        tIcon.setAttribute('text-anchor', 'middle');
        tIcon.setAttribute('font-size', '10');
        tIcon.setAttribute('fill', factionTask.status === 'combat_pending' ? '#e05050' : '#e8c050');
        tIcon.setAttribute('pointer-events', 'none');
        tIcon.textContent = factionTask.monsterTask ? '⚔' : '✦';
        group.appendChild(tIcon);
      }

      if (secretPadKey && secretPadKey === hex.key) {
        const sGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sGlow.setAttribute('cx', x - LAST_SEA_HEX * 0.45);
        sGlow.setAttribute('cy', y - LAST_SEA_HEX * 0.36);
        sGlow.setAttribute('r', '8');
        sGlow.setAttribute('fill', 'rgba(126,215,255,.18)');
        sGlow.setAttribute('stroke', '#7ed7ff');
        sGlow.setAttribute('stroke-width', '1.1');
        sGlow.setAttribute('pointer-events', 'none');
        group.appendChild(sGlow);

        const sIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sIcon.setAttribute('x', x - LAST_SEA_HEX * 0.45);
        sIcon.setAttribute('y', y - LAST_SEA_HEX * 0.28);
        sIcon.setAttribute('text-anchor', 'middle');
        sIcon.setAttribute('font-size', '10');
        sIcon.setAttribute('fill', '#7ed7ff');
        sIcon.setAttribute('pointer-events', 'none');
        sIcon.textContent = '🚀';
        group.appendChild(sIcon);
      }

      if (hex.icon) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y + 4);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "11");
        text.setAttribute("fill", hex.type === "sea" ? "#8fe7df" : "#f6df95");
        text.setAttribute("pointer-events", "none");
        text.textContent = hex.icon;
        group.appendChild(text);
      }

      const note = S.lastSea.notes[hex.key];
      if (note) {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x + LAST_SEA_HEX * 0.55);
        dot.setAttribute("cy", y - LAST_SEA_HEX * 0.55);
        dot.setAttribute("r", "4");
        dot.setAttribute("fill", "#e8c050");
        dot.setAttribute("pointer-events", "none");
        group.appendChild(dot);
      }

      const bsMarker = (typeof window.getBackstoryMapMarker === "function")
        ? window.getBackstoryMapMarker("sea", String(hex.key || ""))
        : null;
      if (bsMarker) {
        const bsGlow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bsGlow.setAttribute("cx", x + LAST_SEA_HEX * 0.08);
        bsGlow.setAttribute("cy", y - LAST_SEA_HEX * 0.58);
        bsGlow.setAttribute("r", "8.4");
        bsGlow.setAttribute("fill", "rgba(123,154,255,.16)");
        bsGlow.setAttribute("stroke", "#7b9aff");
        bsGlow.setAttribute("stroke-width", "1.2");
        bsGlow.setAttribute("pointer-events", "none");
        group.appendChild(bsGlow);

        const bsIcon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        bsIcon.setAttribute("x", x + LAST_SEA_HEX * 0.08);
        bsIcon.setAttribute("y", y - LAST_SEA_HEX * 0.5);
        bsIcon.setAttribute("text-anchor", "middle");
        bsIcon.setAttribute("font-size", "9.6");
        bsIcon.setAttribute("fill", "#9db3ff");
        bsIcon.setAttribute("pointer-events", "none");
        bsIcon.textContent = bsMarker.icon || "✶";
        group.appendChild(bsIcon);
      }

      group.addEventListener("click", () => {
        var moved = false;
        if (S.lastSea.clickMode === "travel") {
          if (hex.type === "island" && typeof registerLastSeaIslandTravel === "function") {
            registerLastSeaIslandTravel(1);
            moved = true;
          } else if (typeof registerLastSeaHexTravel === "function") {
            registerLastSeaHexTravel(1);
            moved = true;
          }
        }
        S.lastSea.selectedKey = hex.key;
        if (S.lastSea.clickMode === "fog" && typeof window.revealMapFogHex === "function") {
          window.revealMapFogHex("sea", String(hex.key || ""));
          showNotif('Sea fog lifted. Hex [' + (hex.col + 1) + ',' + (hex.row + 1) + '] revealed.', 'good');
        } else if (moved && typeof window.revealMapFogHex === "function") {
          window.revealMapFogHex("sea", String(hex.key || ""));
        }
        renderLastSeaMap();
        renderLastSeaInfo(hex);
        if (moved && typeof window.rollRivalEncounterForMap === "function") {
          window.rollRivalEncounterForMap("sea", {
            key: String(hex.key || ""),
            label: String(hex.title || hex.islandName || "Open Sea"),
            terrain: String(hex.type || "sea")
          });
        }
        if (moved && typeof window.theosHandleLastSeaTravelProgress === "function") {
          window.theosHandleLastSeaTravelProgress({
            key: String(hex.key || ""),
            type: String(hex.type || "sea")
          });
        }
        const shouldAutoAdvanceMission = moved || S.lastSea.clickMode === "fog";
        if (shouldAutoAdvanceMission && typeof window.autoAdvanceMissionFromSeaHex === "function") {
          window.autoAdvanceMissionFromSeaHex(hex.key);
        }
      });
      group.addEventListener("mousemove", () => {
        const coords = document.getElementById("lastSeaCoords");
        if (coords) {
          coords.textContent = `[${hex.col + 1},${hex.row + 1}] ${hex.type === "sea" ? (hex.seaLabel || "Open Sea") : hex.title || hex.islandName}`;
        }
      });
      svg.appendChild(group);
    });
    // ── Render compass at bottom-right ──
    const compassGroup=document.createElementNS('http://www.w3.org/2000/svg','g');
    compassGroup.setAttribute('transform','translate('+(Math.round(width)-28)+','+(Math.round(height)-28)+')');
    const compassCircle=document.createElementNS('http://www.w3.org/2000/svg','circle');
    compassCircle.setAttribute('cx','0');compassCircle.setAttribute('cy','0');
    compassCircle.setAttribute('r','12');compassCircle.setAttribute('fill','rgba(70,196,182,.15)');
    compassCircle.setAttribute('stroke','#46c4b6');compassCircle.setAttribute('stroke-width','0.8');
    compassCircle.setAttribute('pointer-events','none');
    compassGroup.appendChild(compassCircle);
    const compassArrow=document.createElementNS('http://www.w3.org/2000/svg','text');
    compassArrow.setAttribute('x','0');compassArrow.setAttribute('y','-2');
    compassArrow.setAttribute('text-anchor','middle');compassArrow.setAttribute('font-size','10');
    compassArrow.setAttribute('fill','#46c4b6');compassArrow.setAttribute('pointer-events','none');
    compassArrow.textContent='↑';compassGroup.appendChild(compassArrow);
    const compassNorth=document.createElementNS('http://www.w3.org/2000/svg','text');
    compassNorth.setAttribute('x','0');compassNorth.setAttribute('y','9');
    compassNorth.setAttribute('text-anchor','middle');compassNorth.setAttribute('font-size','6.5');
    compassNorth.setAttribute('font-family','Cinzel,serif');compassNorth.setAttribute('fill','#46c4b6');compassNorth.setAttribute('pointer-events','none');
    compassNorth.textContent='N';compassGroup.appendChild(compassNorth);
    svg.appendChild(compassGroup);
  }

  function renderCurrentSeaWeather() {
    if (!S.lastSea.weather) {
      S.lastSea.weather = rollLastSeaWeather();
    }
    const weather = ensureSeaWeatherCheck(S.lastSea.weather);
    S.lastSea.weather = weather;
    const weatherCheckPending = !!(weather.check && !weather.checkResolved);
    const weatherCheckNote = weather.check
      ? `<div style="font-size:.78rem;color:var(--red2);margin-top:.2rem;">Rough sea. ${weather.check.stats.map(capitalize).join(" or ")} vs Dread D${weather.check.dd} required before pressing on.</div>`
      : (weather.rough ? '<div style="font-size:.78rem;color:var(--red2);margin-top:.2rem;">Rough sea. Pilots will likely test Lead or Control before pressing on.</div>' : "");
    const weatherCheckButtons = weatherCheckPending
      ? `<div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;">
          <button class="btn btn-xs btn-warn" onclick="resolveLastSeaWeatherCheck('lead')">⚄ Lead vs Dread D${weather.check.dd}</button>
          <button class="btn btn-xs btn-teal" onclick="resolveLastSeaWeatherCheck('control')">⚄ Control vs Dread D${weather.check.dd}</button>
        </div>`
      : "";
    const weatherCheckResult = weather.checkResolved && weather.checkLast
      ? `<div style="font-size:.76rem;color:${weather.checkLast.success ? "var(--green2)" : "var(--red2)"};margin-top:.2rem;">Weather check complete: ${capitalize(weather.checkLast.stat)} d${weather.checkLast.statDie}=${weather.checkLast.statRoll} vs Dread d${weather.checkLast.dd}=${weather.checkLast.dreadRoll} (${weather.checkLast.success ? "success" : "failure"}).</div>`
      : "";
    return `
      <div class="weather-block ${weather.rough ? "rough" : "clear"}">
        <div class="weather-label" style="color:${weather.rough ? "var(--red2)" : "var(--teal)"};">${capitalize(S.currentSeason || "spring")} Weather: ${weather.label}</div>
        <div style="font-size:.81rem;color:var(--text2);">${weather.desc}</div>
        ${weatherCheckNote}
        ${weatherCheckButtons}
        ${weatherCheckResult}
      </div>
    `;
  }

  function isSeaManualRollMode() {
    if (!window.settingsSystem || typeof window.settingsSystem.isManualRollMode !== 'function') return false;
    return !!window.settingsSystem.isManualRollMode();
  }

  function stepSeaManualDreadDie(current) {
    var chain = [4, 6, 8, 10, 12, 20];
    var die = Math.max(4, Number(current || 6));
    var idx = chain.indexOf(die);
    if (idx < 0) idx = 1;
    return chain[Math.min(chain.length - 1, idx + 1)];
  }

  function buildSeaManualModifierSummary(statKey) {
    if (typeof window !== 'undefined' && typeof window.buildManualRollModifierLines === 'function') {
      var lines = window.buildManualRollModifierLines(statKey, (typeof getEffectiveDie === 'function') ? getEffectiveDie(statKey) : 6, {
        extraLines: ['Enter final totals after applying all listed modifiers.']
      }) || [];
      if (!lines.length) return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.15rem;">No active modifiers detected.</div>';
      return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.15rem;line-height:1.5;">'
        + lines.map(function(p){ return '<div>• ' + p + '</div>'; }).join('')
        + '</div>';
    }
    var key = String(statKey || 'lead').toLowerCase();
    var parts = [];
    if (typeof collectInventoryBonusesForStat === 'function') {
      var inv = collectInventoryBonusesForStat(key) || { advDice: [], flat: 0, addValor: 0 };
      if (Array.isArray(inv.advDice) && inv.advDice.length) parts.push('Advantage dice: ' + inv.advDice.map(function(d) { return 'd' + Number(d); }).join(', '));
      if (Number(inv.flat || 0) !== 0) parts.push('Flat modifier: ' + (Number(inv.flat) > 0 ? '+' : '') + Number(inv.flat));
      if (Number((inv.addValor) || 0) > 0) parts.push('Bonus Valor rolls: +' + Number(inv.addValor));
    }
    if (S && S.conditions && typeof S.conditions === 'object') {
      var active = Object.keys(S.conditions).filter(function(c) { return !!S.conditions[c]; });
      if (active.length) parts.push('Conditions: ' + active.map(function(c) { return c.charAt(0).toUpperCase() + c.slice(1); }).join(', '));
    }
    if (!parts.length) return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.15rem;">No active modifiers detected.</div>';
    return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.15rem;line-height:1.5;">'
      + parts.map(function(p) { return '<div>• ' + p + '</div>'; }).join('')
      + '</div>';
  }

  function openSeaManualActionDreadPrompt(config) {
    if (typeof openModal !== 'function') return false;
    var cfg = config || {};
    var statKey = String(cfg.statKey || 'lead').toLowerCase();
    var statLabel = String(cfg.statLabel || (statKey.charAt(0).toUpperCase() + statKey.slice(1)));
    var title = String(cfg.title || 'Manual Roll');
    var actionDie = Math.max(4, Number(cfg.actionDie || ((typeof getEffectiveDie === 'function') ? getEffectiveDie(statKey) : 6) || 6));
    var dreadDie = Math.max(4, Number(cfg.dreadDie || 6));
    var context = String(cfg.context || title);
    var currentTMW = Math.max(0, Number((S && S.tmw) || 0));
    var pushDread = stepSeaManualDreadDie(dreadDie);
    var modifiersHtml = buildSeaManualModifierSummary(statKey);

    window._pendingSeaManualActionCheck = {
      statKey: statKey,
      statLabel: statLabel,
      actionDie: actionDie,
      dreadDie: dreadDie,
      resolver: (typeof cfg.onResolve === 'function') ? cfg.onResolve : null
    };

    var html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.78rem;letter-spacing:.08em;color:var(--gold2);margin-bottom:.28rem;">' + context + '</div>'
      + '<div><strong>' + statLabel + ' d' + actionDie + '</strong> vs <strong style="color:var(--red2);">Dread d' + dreadDie + '</strong></div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-top:.12rem;">Roll physically, apply modifiers listed below, then enter final totals.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.32rem;margin-top:.4rem;">'
      + '<div><div style="font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;">' + statLabel + ' d' + actionDie + ' (total)</div><input type="text" inputmode="text" id="seaManualActionValue" placeholder="e.g. 8+7" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;"></div>'
      + '<div><div style="font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;">Dread d' + dreadDie + ' (total)</div><input type="text" inputmode="text" id="seaManualDreadValue" placeholder="e.g. 7+3+1" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;"></div>'
      + '</div>'
      + modifiersHtml
      + '<div style="margin-top:.34rem;padding:.28rem .36rem;border:1px solid rgba(232,192,80,.35);background:rgba(232,192,80,.08);">'
      + '<div style="font-size:.74rem;color:var(--gold2);"><strong>Teamwork:</strong> ' + currentTMW + ' TMW</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-top:.1rem;">Push Luck costs 2 TMW and raises Dread to d' + pushDread + '.</div>'
      + '</div>'
      + '<div style="display:flex;gap:.28rem;flex-wrap:wrap;margin-top:.45rem;">'
      + '<button class="btn btn-sm" onclick="closeModal()">Cancel</button>'
      + '<button class="btn btn-sm" onclick="resolveSeaManualActionCheck(\"compare\",false)">Compare</button>'
      + '<button class="btn btn-sm btn-primary" onclick="resolveSeaManualActionCheck(\"success\",false)">Success</button>'
      + '<button class="btn btn-sm btn-red" onclick="resolveSeaManualActionCheck(\"failure\",false)">Failure</button>'
      + '<button class="btn btn-sm btn-teal" ' + (currentTMW >= 2 ? '' : 'disabled') + ' onclick="resolveSeaManualActionCheck(\"success\",true)">Push Luck + Success</button>'
      + '<button class="btn btn-sm btn-warn" ' + (currentTMW >= 2 ? '' : 'disabled') + ' onclick="resolveSeaManualActionCheck(\"failure\",true)">Push Luck + Failure</button>'
      + '</div>'
      + '</div>';
    openModal(title, html);
    return true;
  }

  function resolveSeaManualActionCheck(mode, pushLuck) {
    var pending = window._pendingSeaManualActionCheck || null;
    if (!pending) return;
    var actionInput = document.getElementById('seaManualActionValue');
    var dreadInput = document.getElementById('seaManualDreadValue');
    var actionValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(actionInput, 1) : parseInt(actionInput && actionInput.value, 10);
    var dreadValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(dreadInput, 1) : parseInt(dreadInput && dreadInput.value, 10);
    if (!Number.isFinite(actionValue) || actionValue < 1 || !Number.isFinite(dreadValue) || dreadValue < 1) {
      if (typeof showNotif === 'function') showNotif('Enter valid manual Action and Dread totals first.', 'warn');
      return;
    }
    var wantsPush = !!pushLuck;
    var usedPush = false;
    var finalDread = Number(pending.dreadDie || 6);
    if (wantsPush) {
      var tmw = Math.max(0, Number((S && S.tmw) || 0));
      if (tmw < 2) {
        if (typeof showNotif === 'function') showNotif('Need 2 Teamwork to Push Luck.', 'warn');
        return;
      }
      if (typeof changeCounter === 'function') changeCounter('tmw', -2);
      else S.tmw = Math.max(0, tmw - 2);
      usedPush = true;
      finalDread = stepSeaManualDreadDie(finalDread);
    }
    var modeKey = String(mode || 'compare').toLowerCase();
    var resolvedSuccess = modeKey === 'success' ? true : (modeKey === 'failure' ? false : (actionValue >= dreadValue));
    window._pendingSeaManualActionCheck = null;
    if (typeof closeModal === 'function') closeModal();
    if (typeof pending.resolver === 'function') {
      pending.resolver({
        success: !!resolvedSuccess,
        pushLuck: usedPush,
        actionDie: Number(pending.actionDie || 4),
        dreadDie: Number(finalDread || pending.dreadDie || 6),
        statKey: pending.statKey,
        actionTotal: Number(actionValue || 0),
        dreadTotal: Number(dreadValue || 0),
        mode: modeKey,
        manual: true
      });
    }
  }
  window.resolveSeaManualActionCheck = resolveSeaManualActionCheck;

  function startCampaignGmCheckRecord(spec) {
    if (window.campaignSystem && typeof window.campaignSystem.startGmPendingCheck === 'function') {
      return window.campaignSystem.startGmPendingCheck(spec || {});
    }
    return { ok: true, id: '' };
  }

  function resolveCampaignGmCheckRecord(checkId, outcome) {
    if (!checkId) return false;
    if (window.campaignSystem && typeof window.campaignSystem.resolveGmPendingCheck === 'function') {
      return window.campaignSystem.resolveGmPendingCheck(String(checkId), outcome || {});
    }
    return false;
  }

  function ensureSeaCampaignSceneHandlers() {
    if (window._seaCampaignSceneHandlersInstalled) return true;
    if (!window.campaignSystem || typeof window.campaignSystem.registerSceneCheckHandler !== 'function') return false;
    window._seaCampaignSceneHandlersInstalled = true;
    window.campaignSystem.registerSceneCheckHandler('last-sea-weather', function (evt) {
      if (!S.lastSea || !S.lastSea.weather) return;
      const check = evt && evt.check && typeof evt.check === 'object' ? evt.check : {};
      const payload = check.payload && typeof check.payload === 'object' ? check.payload : {};
      const outcome = evt && evt.outcome && typeof evt.outcome === 'object' ? evt.outcome : {};
      const weather = ensureSeaWeatherCheck(S.lastSea.weather);
      S.lastSea.weather = weather;
      weather.checkResolved = true;
      weather.checkLast = {
        stat: String(payload.statKey || check.stat || 'lead'),
        statDie: Math.max(4, Number(payload.actionDie || 4) || 4),
        statRoll: Number(outcome.actionTotal || 0),
        dd: Number(outcome.dreadTotal || check.dread || payload.dd || 8),
        dreadRoll: Number(outcome.dreadTotal || 0),
        success: !!outcome.success
      };
      showNotif(
        `${capitalize(String(payload.statKey || check.stat || 'lead'))} ${Number(outcome.actionTotal || 0)} vs Dread ${Number(outcome.dreadTotal || check.dread || payload.dd || 8)}. ${outcome.success ? 'Sea lane stabilized.' : 'You push through under strain.'}`,
        outcome.success ? 'good' : 'warn'
      );
      renderLastSeaMap();
      renderLastSeaInfo();
    });
    return true;
  }

  function requestSeaCampaignSceneCheck(spec) {
    ensureSeaCampaignSceneHandlers();
    if (!window.campaignSystem || typeof window.campaignSystem.requestSceneCheck !== 'function') return false;
    var out = window.campaignSystem.requestSceneCheck(spec || {});
    return !!(out && out.handled);
  }

  function resolveLastSeaWeatherCheck(stat) {
    if (!S.lastSea || !S.lastSea.weather) {
      showNotif('No weather check required right now.', 'warn');
      return;
    }
    const weather = ensureSeaWeatherCheck(S.lastSea.weather);
    S.lastSea.weather = weather;
    if (!weather.check) {
      showNotif('No weather check required right now.', 'warn');
      return;
    }
    if (weather.checkResolved) {
      showNotif('Weather check already resolved for current conditions.', 'good');
      return;
    }
    const chosen = String(stat || '').toLowerCase();
    const allowed = Array.isArray(weather.check.stats) ? weather.check.stats : ['lead'];
    const checkStat = allowed.indexOf(chosen) >= 0 ? chosen : allowed[0];
    const statDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie(checkStat) : ((S.stats && S.stats[checkStat]) || 4);
    const dd = Number(weather.check.dd) || 8;
    if (requestSeaCampaignSceneCheck({
      title: 'Last Sea Scene Check',
      label: 'Last Sea Weather Check',
      context: String(weather.label || 'Sea Weather') + ' weather pressure',
      type: 'last-sea-weather',
      stat: checkStat,
      dread: dd,
      successRewardType: 'successRolls',
      successRewardAmount: 1,
      failurePenaltyType: 'mentalStress',
      failurePenaltyAmount: 1,
      failurePenaltyScale: 'margin',
      failTmw: 1,
      stake: 'The GM chooses who navigates the weather and who takes the strain from failure.',
      payload: {
        statKey: checkStat,
        actionDie: statDie,
        dd: dd,
        weatherLabel: String(weather.label || 'Sea Weather')
      },
      playerRequestMessage: '🌊 Requesting a Last Sea weather roll so the GM can assign the acting wayfarer.'
    })) return;
    const pendingCheck = startCampaignGmCheckRecord({
      type: 'weather',
      scope: 'sea',
      label: 'Last Sea Weather Check',
      stat: checkStat,
      dread: dd,
      context: String(weather.label || 'Sea Weather') + ' weather pressure'
    });
    if (pendingCheck && pendingCheck.blocked) return;
    const pendingCheckId = pendingCheck && pendingCheck.id ? String(pendingCheck.id) : '';
    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Sea Weather Check',
        context: String(weather.label || 'Sea Weather') + ' weather pressure',
        statKey: checkStat,
        statLabel: capitalize(checkStat),
        actionDie: statDie,
        dreadDie: dd,
        onResolve: function(outcome) {
          const success = !!(outcome && outcome.success);
          const actionTotal = Number((outcome && outcome.actionTotal) || 0);
          const dreadTotal = Number((outcome && outcome.dreadTotal) || 0);
          var diff = Math.max(1, dreadTotal - actionTotal);
          resolveCampaignGmCheckRecord(pendingCheckId, {
            success,
            stat: checkStat,
            actionTotal,
            dreadTotal,
            margin: success ? Math.max(0, actionTotal - dreadTotal) : diff,
            failedBy: success ? 0 : diff,
            manual: true
          });
          weather.checkResolved = true;
          weather.checkLast = {
            stat: checkStat,
            statDie,
            statRoll: actionTotal,
            dd: Number((outcome && outcome.dreadDie) || dd),
            dreadRoll: dreadTotal,
            success
          };
          if (!success) {
            if (typeof changeMentalStress === 'function') changeMentalStress(diff);
            else {
              S.mentalStress = (S.mentalStress || 0) + diff;
              if (typeof updateMentalStressUI === 'function') updateMentalStressUI();
            }
            if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-weather-failure', { failedBy: diff, actionDie: statDie, dreadDie: dd });
          } else if (typeof addSuccessRoll === 'function') {
            addSuccessRoll();
          }
          showNotif(
            `${capitalize(checkStat)} ${actionTotal} vs Dread ${dreadTotal} (manual). ${success ? 'Sea lane stabilized.' : 'You push through under strain.'}`,
            success ? 'good' : 'warn'
          );
          renderLastSeaMap();
          renderLastSeaInfo();
        }
      });
      return;
    }
    const statRoll = explodingRoll(statDie).total;
    const dreadRoll = explodingRoll(dd).total;
    const success = statRoll >= dreadRoll;
    const failedBy = Math.max(1, dreadRoll - statRoll);
    resolveCampaignGmCheckRecord(pendingCheckId, {
      success,
      stat: checkStat,
      actionTotal: statRoll,
      dreadTotal: dreadRoll,
      margin: success ? Math.max(0, statRoll - dreadRoll) : failedBy,
      failedBy: success ? 0 : failedBy,
      manual: false
    });

    weather.checkResolved = true;
    weather.checkLast = {
      stat: checkStat,
      statDie,
      statRoll,
      dd,
      dreadRoll,
      success
    };

    if (!success) {
      const diff = failedBy;
      if (typeof changeMentalStress === 'function') {
        changeMentalStress(diff);
      } else {
        S.mentalStress = (S.mentalStress || 0) + diff;
        if (typeof updateMentalStressUI === 'function') updateMentalStressUI();
      }
      if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-weather-failure', { failedBy: diff, actionDie: statDie, dreadDie: dd });
    } else if (typeof addSuccessRoll === 'function') {
      addSuccessRoll();
    }

    showNotif(
      `${capitalize(checkStat)} d${statDie}=${statRoll} vs Dread d${dd}=${dreadRoll}. ${success ? 'Sea lane stabilized.' : 'You push through under strain (+' + Math.max(1, dreadRoll - statRoll) + ' Mental Stress).'}`,
      success ? 'good' : 'warn'
    );
    renderLastSeaMap();
    renderLastSeaInfo();
  }
  window.resolveLastSeaWeatherCheck = resolveLastSeaWeatherCheck;

  function getSeaHexTravelNarrative(hex) {
    if (!hex) return '';
    if (hex.siteType === 'dungeon') {
      return 'Jagged silhouettes of drowned fortifications cut the horizon, and brine fog moves like breath through shattered entry halls. Inside, each chamber smells of salt, rust, and old fires, with collapsed galleries that can hide both relics and ambushes.';
    }
    if (hex.siteType === 'colosseum') {
      return 'You spot banner-masts and braziers long before landfall, and the roar of wagers carries over the surf. In the arena corridors, chalk marks, blood-dark sand, and iron gates frame every approach like the opening of a duel.';
    }
    return '';
  }

  function getSeaRaidNarrative(mt) {
    var markerType = String((mt && mt.type) || '').toLowerCase();
    if (markerType === 'informer') {
      return 'You arrive under lantern-dim rafters where lookouts trade whispers and false names. Charts are pinned to warped tables, each route marked with fresh ink and crossed blades.';
    }
    return 'The confrontation wing is already awake: barricades, signal flares, and watchfires line the approach while shadows move between kill-zones. The field is cramped, loud, and seconds from violence.';
  }

  function ensureScopedTravelSceneState() {
    if (!S.scopedTravelScenes || typeof S.scopedTravelScenes !== 'object') {
      S.scopedTravelScenes = { scopes: {} };
    }
    if (!S.scopedTravelScenes.scopes || typeof S.scopedTravelScenes.scopes !== 'object') {
      S.scopedTravelScenes.scopes = {};
    }
    return S.scopedTravelScenes;
  }

  function ensureScopedTravelSceneBucket(scopeName) {
    var root = ensureScopedTravelSceneState();
    var scope = String(scopeName || 'generic').toLowerCase();
    if (!root.scopes[scope] || typeof root.scopes[scope] !== 'object') {
      root.scopes[scope] = { byKey: {}, activeByKey: {}, hiddenByKey: {} };
    }
    return root.scopes[scope];
  }

  function getScopedTravelSceneList(scopeName, sceneKey, createIfMissing) {
    var bucket = ensureScopedTravelSceneBucket(scopeName);
    var key = String(sceneKey || 'unknown');
    if (!Array.isArray(bucket.byKey[key])) {
      if (!createIfMissing) return [];
      bucket.byKey[key] = [];
    }
    return bucket.byKey[key];
  }

  function getActiveScopedTravelScene(scopeName, sceneKey) {
    var bucket = ensureScopedTravelSceneBucket(scopeName);
    var key = String(sceneKey || 'unknown');
    var list = getScopedTravelSceneList(scopeName, key, false);
    if (!list.length) return null;
    var activeId = String(bucket.activeByKey[key] || '');
    var active = list.find(function (entry) { return entry && String(entry.id || '') === activeId; }) || list[0] || null;
    if (active) bucket.activeByKey[key] = String(active.id || '');
    return active;
  }

  function rerenderScopedTravelScenePanel(scopeName) {
    var scope = String(scopeName || '').toLowerCase();
    if (scope === 'lastsea' && typeof renderLastSeaInfo === 'function') renderLastSeaInfo();
    else if (scope === 'worldthatwas' && typeof renderWorldThatWasInfo === 'function') renderWorldThatWasInfo();
    else if (scope === 'galaxy' && typeof updateStarSystemReadouts === 'function') updateStarSystemReadouts();
    else if (scope === 'planet' && typeof renderPlanetExplorationPanel === 'function') renderPlanetExplorationPanel();
  }

  window.getActiveScopedTravelScene = function (scopeName, sceneKey) {
    return getActiveScopedTravelScene(scopeName, sceneKey);
  };

  window.applyScopedTravelSceneToCombatSeed = function (scopeName, sceneKey, seed) {
    if (!seed || typeof seed !== 'object') return seed;
    var active = getActiveScopedTravelScene(scopeName, sceneKey);
    if (!active) return seed;
    if (active.id) seed.id = String(active.id);
    if (active.name) seed.name = String(active.name);
    if (active.image) {
      if (!seed.board || typeof seed.board !== 'object') seed.board = {};
      seed.board.background = String(active.image);
    }
    seed.travelSceneScope = String(scopeName || 'generic').toLowerCase();
    seed.travelSceneKey = String(sceneKey || 'unknown');
    if (Array.isArray(seed.history)) {
      seed.history.push('Travel Scene loaded: ' + String(active.name || 'Scene') + '.');
    }
    return seed;
  };

  window.setScopedTravelScenePanelHidden = function (scopeName, sceneKey, hidden) {
    var bucket = ensureScopedTravelSceneBucket(scopeName);
    var key = String(sceneKey || 'unknown');
    bucket.hiddenByKey[key] = !!hidden;
    rerenderScopedTravelScenePanel(scopeName);
  };

  window.createScopedTravelSceneAtKey = function (scopeName, sceneKey) {
    var scope = String(scopeName || 'generic').toLowerCase();
    var key = String(sceneKey || 'unknown');
    var list = getScopedTravelSceneList(scope, key, true);
    var bucket = ensureScopedTravelSceneBucket(scope);
    var nameInput = document.getElementById('scopedTravelSceneName-' + scope + '-' + key);
    var tagInput = document.getElementById('scopedTravelSceneTag-' + scope + '-' + key);
    var name = nameInput ? String(nameInput.value || '').trim() : '';
    var tag = tagInput ? String(tagInput.value || 'unknown').trim() : 'unknown';
    if (!name) {
      if (typeof showNotif === 'function') showNotif('Enter a scene name first.', 'warn');
      return;
    }
    var id = 'scoped-scene-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999).toString(36);
    list.push({ id: id, name: name, tag: tag, image: '', createdAt: Date.now(), updatedAt: Date.now() });
    bucket.activeByKey[key] = id;
    if (nameInput) nameInput.value = '';
    rerenderScopedTravelScenePanel(scope);
    if (typeof showNotif === 'function') showNotif('Travel scene created.', 'good');
  };

  window.loadScopedTravelSceneAtKey = function (scopeName, sceneKey) {
    var scope = String(scopeName || 'generic').toLowerCase();
    var key = String(sceneKey || 'unknown');
    var bucket = ensureScopedTravelSceneBucket(scope);
    var list = getScopedTravelSceneList(scope, key, false);
    if (!list.length) {
      if (typeof showNotif === 'function') showNotif('No scenes to load yet.', 'warn');
      return;
    }
    var select = document.getElementById('scopedTravelSceneSelect-' + scope + '-' + key);
    var id = select ? String(select.value || '') : '';
    var active = list.find(function (entry) { return entry && String(entry.id || '') === id; }) || list[0] || null;
    if (!active) return;
    bucket.activeByKey[key] = String(active.id || '');
    rerenderScopedTravelScenePanel(scope);
    if (typeof showNotif === 'function') showNotif('Travel scene loaded.', 'good');
  };

  window.handleScopedTravelSceneImageUpload = function (input, scopeName, sceneKey) {
    if (!input || !input.files || !input.files[0]) return;
    var active = getActiveScopedTravelScene(scopeName, sceneKey);
    if (!active) {
      if (typeof showNotif === 'function') showNotif('Create and load a scene first.', 'warn');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (evt) {
      active.image = String((evt && evt.target && evt.target.result) || '');
      active.updatedAt = Date.now();
      rerenderScopedTravelScenePanel(scopeName);
      if (typeof showNotif === 'function') showNotif('Scene image attached.', 'good');
    };
    reader.readAsDataURL(input.files[0]);
  };

  window.buildScopedTravelSceneCard = function (cfg) {
    var scope = String((cfg && cfg.scope) || 'generic').toLowerCase();
    var key = String((cfg && cfg.key) || 'unknown');
    var scopeLabel = String((cfg && cfg.scopeLabel) || scope);
    var intro = String((cfg && cfg.intro) || 'Create or load a scene here, then launch it into Combat Mode.');
    var selectedLabel = String((cfg && cfg.selectedLabel) || '');
    var launchCall = String((cfg && cfg.launchCall) || '');
    var hidden = !!ensureScopedTravelSceneBucket(scope).hiddenByKey[key];
    if (hidden) {
      return '<div class="npc-block" style="margin-bottom:.45rem;border-color:rgba(46,196,182,.4);background:rgba(46,196,182,.05);">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.35rem;">'
        + '<div class="nb-label" style="color:var(--teal);">🎬 Travel Scene [' + escapeHtmlLite(scopeLabel) + ']</div>'
        + '<button class="btn btn-xs" onclick="setScopedTravelScenePanelHidden(\'' + scope.replace(/'/g, "\\'") + '\',\'' + key.replace(/'/g, "\\'") + '\',false)">Open Travel Scene</button>'
        + '</div>'
      + '</div>';
    }
    var list = getScopedTravelSceneList(scope, key, false);
    var active = getActiveScopedTravelScene(scope, key);
    var options = list.length
      ? list.map(function (scene) {
        if (!scene) return '';
        var sid = String(scene.id || '');
        var selected = (active && String(active.id || '') === sid) ? ' selected' : '';
        var tag = scene.tag ? (' [' + String(scene.tag) + ']') : '';
        return '<option value="' + sid + '"' + selected + '>' + escapeHtmlLite(String(scene.name || 'Scene')) + escapeHtmlLite(tag) + '</option>';
      }).join('')
      : '<option value="">No scenes yet</option>';
    var imagePreview = active && active.image
      ? '<div style="margin-top:.3rem;"><img src="' + String(active.image) + '" alt="Scene image" style="width:100%;max-height:120px;object-fit:cover;border:1px solid var(--border2);border-radius:4px;"></div>'
      : '<div style="margin-top:.3rem;font-size:.72rem;color:var(--muted2);">No scene image attached yet.</div>';
    return '<details class="npc-block" style="margin-bottom:.45rem;border-color:rgba(46,196,182,.45);background:rgba(46,196,182,.06);">'
      + '<summary class="nb-label" style="color:var(--teal);cursor:pointer;list-style:none;">🎬 Travel Scene [' + escapeHtmlLite(scopeLabel) + ']</summary>'
      + '<div style="margin-top:.28rem;">'
      + '<div style="font-size:.76rem;color:var(--text2);line-height:1.55;margin-bottom:.35rem;">' + escapeHtmlLite(intro) + '</div>'
      + (selectedLabel ? '<div style="font-size:.74rem;color:var(--muted2);margin-bottom:.25rem;">' + escapeHtmlLite(selectedLabel) + '</div>' : '')
      + '<div style="display:grid;grid-template-columns:1fr auto auto;gap:.25rem;">'
      + '<input id="scopedTravelSceneName-' + scope + '-' + key + '" type="text" maxlength="60" placeholder="Scene name (ambush, breach, raid...)" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.26rem .36rem;font-size:.74rem;border-radius:3px;">'
      + '<select id="scopedTravelSceneTag-' + scope + '-' + key + '" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.26rem .32rem;font-size:.74rem;border-radius:3px;"><option value="unknown">Tag</option><option value="dungeon">Dungeon</option><option value="ruins">Ruins</option><option value="raid">Raid</option><option value="random encounter">Random Encounter</option></select>'
      + '<button class="btn btn-xs btn-primary" onclick="createScopedTravelSceneAtKey(\'' + scope.replace(/'/g, "\\'") + '\',\'' + key.replace(/'/g, "\\'") + '\')">Create</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr auto;gap:.25rem;margin-top:.3rem;">'
      + '<select id="scopedTravelSceneSelect-' + scope + '-' + key + '" style="background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.26rem .32rem;font-size:.74rem;border-radius:3px;">' + options + '</select>'
      + '<button class="btn btn-xs" onclick="loadScopedTravelSceneAtKey(\'' + scope.replace(/'/g, "\\'") + '\',\'' + key.replace(/'/g, "\\'") + '\')">Load</button>'
      + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.3rem;">'
      + (launchCall ? '<button class="btn btn-xs btn-primary" onclick="' + launchCall + '">Launch Into Combat Mode</button>' : '')
      + '<button class="btn btn-xs" onclick="document.getElementById(\'scopedTravelSceneImageInput-' + scope + '-' + key + '\').click()">Attach Image</button>'
      + '<button class="btn btn-xs" onclick="setScopedTravelScenePanelHidden(\'' + scope.replace(/'/g, "\\'") + '\',\'' + key.replace(/'/g, "\\'") + '\',true)">Hide Travel Scene</button>'
      + '</div>'
      + '<input id="scopedTravelSceneImageInput-' + scope + '-' + key + '" type="file" accept="image/*" style="display:none;" onchange="handleScopedTravelSceneImageUpload(this,\'' + scope.replace(/'/g, "\\'") + '\',\'' + key.replace(/'/g, "\\'") + '\')">'
      + imagePreview
      + '</div>'
    + '</details>';
  };

  function buildSeaTravelSceneCombatSeed(hex) {
    if (!hex) return null;
    var portrait = (S && S.identityForge && S.identityForge.media && S.identityForge.media.portrait) ? String(S.identityForge.media.portrait) : '';
    var wayfarerName = String((S && S.name) || 'Wayfarer');
    var title = String(hex.title || hex.islandName || hex.seaLabel || ('Sea Hex ' + String(hex.key || '?')));
    var tokens = [{
      id: 'sea-wayfarer-' + Date.now().toString(36),
      name: wayfarerName,
      faction: 'player',
      hp: 12,
      maxHp: 12,
      status: [],
      q: 0,
      r: 0,
      image: portrait,
      size: 1,
      isPlayer: true
    }];

    var count = 0;
    var dread = 6;
    if (hex.siteType === 'dungeon') { count = 2; dread = 8; }
    else if (hex.siteType === 'colosseum') { count = 2; dread = 10; }
    else if (hex.type === 'sea') { count = 1; dread = 6; }
    else { count = 1; dread = 6; }

    for (var i = 0; i < count; i++) {
      tokens.push({
        id: 'sea-enemy-' + i + '-' + Date.now().toString(36),
        name: (hex.siteType === 'colosseum' ? 'Arena Raider' : 'Sea Hostile') + ' ' + String(i + 1),
        faction: 'monster',
        hp: Math.max(1, dread * 2),
        maxHp: Math.max(1, dread * 2),
        status: [],
        q: 3 + i,
        r: i % 2,
        image: '',
        size: 1,
        dread: dread,
        deathNumber: Math.max(1, Math.ceil(Math.max(1, dread * 2) / 2))
      });
    }

    return {
      id: 'sea-scene-' + String(hex.key || Date.now()),
      name: 'Sea Scene · ' + title,
      tokens: tokens,
      history: ['Sea scene loaded: ' + title + '.', 'Hostiles seeded: ' + String(count) + '.']
    };
  }

  function launchSeaSceneToCombat(hexKey) {
    if (!S || !S.lastSea || !Array.isArray(S.lastSea.map)) return;
    var hex = S.lastSea.map.find(function (item) { return item && String(item.key) === String(hexKey || ''); }) || null;
    if (!hex) return;
    if (typeof window.getActiveScopedTravelScene === 'function' && !window.getActiveScopedTravelScene('lastsea', String(hex.key || ''))) {
      if (typeof showNotif === 'function') showNotif('Create and load a Travel Scene first.', 'warn');
      return;
    }
    var seed = buildSeaTravelSceneCombatSeed(hex);
    if (typeof window.applyScopedTravelSceneToCombatSeed === 'function') {
      seed = window.applyScopedTravelSceneToCombatSeed('lastsea', String(hex.key || ''), seed);
    }
    if (seed && typeof window.openCombatSceneEditor === 'function') {
      window.openCombatSceneEditor(seed);
      if (typeof showNotif === 'function') showNotif('Launching Combat Mode from Last Sea: ' + String(seed.name || 'Sea Scene') + '.', 'good');
    } else if (typeof showNotif === 'function') {
      showNotif('Combat Mode is unavailable.', 'warn');
    }
  }

  function buildSeaTravelSceneCard(hex) {
    if (!hex) return '';
    var title = String(hex.title || hex.islandName || hex.seaLabel || ('Sea Hex ' + String(hex.key || '?')));
    if (typeof window.buildScopedTravelSceneCard !== 'function') return '';
    return window.buildScopedTravelSceneCard({
      scope: 'lastsea',
      key: String(hex.key || ''),
      scopeLabel: 'Last Sea',
      intro: 'Create or load a sea encounter scene, then launch it into Combat Mode.',
      selectedLabel: 'Selected: ' + title,
      launchCall: 'launchSeaSceneToCombat(\'' + String(hex.key || '').replace(/'/g, "\\'") + '\')'
    });
  }

  function renderLastSeaInfo(cell) {
    const panel = document.getElementById("lastSeaInfo");
    if (!panel) {
      return;
    }

    const hex = cell || S.lastSea.map.find((item) => item.key === S.lastSea.selectedKey);
    const secretPadKey = getSeaSecretPadKey();
    const seaProgress = (typeof window.getSecretPadClueProgress === 'function')
      ? window.getSecretPadClueProgress('sea')
      : { talk: false, event: false, intel: false };
    const seaUnlocked = (typeof window.isSecretPadUnlocked === 'function')
      ? window.isSecretPadUnlocked('sea')
      : !!secretPadKey;
    if (!hex) {
      panel.innerHTML = `
        <div class="sea-info-inner">
          <div style="font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;">Last Sea</div>
          <div style="font-size:.83rem;color:var(--muted2);line-height:1.65;margin-top:.4rem;">
            Chart the Last Sea, then click a hex to inspect it.<br><br>
            <strong style="color:var(--text);">Generator sizes:</strong><br>
            3 Hexes (1 Day), 9 Hexes (3 Days), or 3x 6 Hexes broken by river (2 Days each).<br><br>
            <strong style="color:var(--gold2);">Open Sea:</strong> Shift in Weather, Open Sea Encounter, Peril, Uneventful Sailing.<br>
            <strong style="color:var(--gold2);">Island Travel:</strong> Land Encounter, Peril, Exhaustion, Shift in Weather, Uneventful.
          </div>
        </div>
      `;
      return;
    }
    if (!isSeaHexVisibleByFog(hex.key)) {
      panel.innerHTML = `
        <div class="sea-info-inner">
          <div class="hex-type-tag wilderness">UNEXPLORED</div>
          <div class="hex-name">Fogged Sea Hex [${hex.col + 1},${hex.row + 1}]</div>
          <div class="hex-desc">Sails and spray hide details. Travel here, use Fog mode, or Observe Adjacent to reveal it.</div>
        </div>
      `;
      return;
    }

    const island = S.lastSea.islands.find((item) => item.id === hex.islandId);
    const normalizedResultHtml = ensureSeaPerilResultHtml(hex);
    const note = S.lastSea.notes[hex.key] || "";
    const seaOverlay = (typeof window.getWorldStateHexOverlayForRegion === 'function')
      ? window.getWorldStateHexOverlayForRegion('sea', String(hex.key || ''))
      : null;
    const seaGov = (typeof window.getRegionGovernancePolicyState === 'function')
      ? window.getRegionGovernancePolicyState('sea')
      : null;
    const seaSignals = seaOverlay
      ? (Number(seaOverlay.tension || 0) !== 0
        || Number(seaOverlay.safety || 0) !== 0
        || !!seaOverlay.activeCrisis
        || !!seaOverlay.dangerousRoad
        || !!seaOverlay.closedBorder
        || !!seaOverlay.closedPort
        || (Array.isArray(seaOverlay.tags) && seaOverlay.tags.length > 0))
      : false;
    const seaWorldActions = [];
    if (seaOverlay && seaOverlay.activeCrisis) {
      seaWorldActions.push(`<button class="btn btn-xs btn-warn" onclick="if(typeof resolveWorldStateActionAtKeyForRegion==='function')resolveWorldStateActionAtKeyForRegion('sea','${hex.key}','stabilize');if(typeof renderLastSeaInfo==='function')renderLastSeaInfo();if(typeof renderLastSeaMap==='function')renderLastSeaMap();">🧯 Stabilize Crisis</button>`);
    }
    if (seaOverlay && (seaOverlay.closedBorder || seaOverlay.closedPort || seaOverlay.dangerousRoad)) {
      seaWorldActions.push(`<button class="btn btn-xs btn-teal" onclick="if(typeof resolveWorldStateActionAtKeyForRegion==='function')resolveWorldStateActionAtKeyForRegion('sea','${hex.key}','reopen');if(typeof renderLastSeaInfo==='function')renderLastSeaInfo();if(typeof renderLastSeaMap==='function')renderLastSeaMap();">🛣 Reopen Routes</button>`);
    }
    const seaWorldStateHtml = seaSignals
      ? `<div class="npc-block" style="margin-bottom:.35rem;border-color:rgba(180,180,255,.35);background:rgba(180,180,255,.05);">
          <div class="nb-label" style="color:var(--purple);">🌐 Sea World State</div>
          <div style="font-size:.78rem;color:var(--text2);line-height:1.6;">
            ${seaOverlay && seaOverlay.control ? `<div>Control: <strong>${seaOverlay.control}</strong></div>` : ''}
            ${seaOverlay ? `<div>Tension: <strong>${Number(seaOverlay.tension || 0)}</strong> · Safety: <strong>${Number(seaOverlay.safety || 0)}</strong></div>` : ''}
            ${seaOverlay && seaOverlay.activeCrisis ? `<div>Crisis: <strong style="color:var(--red2);">Active</strong></div>` : ''}
            ${seaOverlay && seaOverlay.closedPort ? `<div>Ports: <strong style="color:var(--purple);">Restricted</strong></div>` : ''}
            ${seaOverlay && seaOverlay.closedBorder ? `<div>Borders: <strong style="color:var(--gold2);">Restricted</strong></div>` : ''}
            ${seaOverlay && seaOverlay.dangerousRoad ? `<div>Sea Lanes: <strong style="color:var(--red2);">Dangerous</strong></div>` : ''}
            ${seaGov ? `<div style="font-size:.73rem;color:var(--muted2);margin-top:.2rem;">Policy: Patrol <strong>${String(seaGov.patrolStance || 'balanced')}</strong> · Tariff <strong>${String(seaGov.tariffStance || 'balanced')}</strong> · Route <strong>${String(seaGov.routePriority || 'trade')}</strong></div>` : ''}
            ${seaWorldActions.length ? `<div style="margin-top:.32rem;display:flex;gap:.24rem;flex-wrap:wrap;">${seaWorldActions.join('')}</div>` : ''}
          </div>
        </div>`
      : '';
    const seaTravelNarrative = getSeaHexTravelNarrative(hex);
    panel.innerHTML = `
      <div class="sea-info-inner">
        <div class="hex-type-tag ${
          hex.type === "sea"
            ? "wilderness"
            : hex.siteType === "settlement"
              ? "holding"
              : hex.siteType === "landmark"
                ? "monument"
                : hex.siteType === "dungeon"
                  ? "ruins"
                  : "holding"
        }">${hex.type === "sea" ? (hex.seaLabel || "Open Sea") : "Island Hex"}</div>
        <div class="hex-name">${hex.type === "sea" ? (hex.seaLabel || "Open Water") : hex.title || hex.islandName}</div>
        <div class="hex-desc" style="margin-bottom:.45rem;">${hex.desc}</div>
        ${seaTravelNarrative ? `<div class="npc-block" style="margin-bottom:.35rem;border-color:rgba(126,215,255,.32);background:rgba(126,215,255,.06);"><div class="nb-label" style="color:#7ed7ff;">🎭 Scene Read</div><div style="font-size:.79rem;color:var(--text2);line-height:1.58;">${seaTravelNarrative}</div></div>` : ''}
        ${buildSeaTravelSceneCard(hex)}
        ${renderCurrentSeaWeather()}
        ${
          island
            ? `<div class="info-row">
                 <div class="info-cell"><span class="ic-label">Island</span>${island.name}</div>
                 <div class="info-cell"><span class="ic-label">Explore Time</span>${island.days} day${island.days > 1 ? "s" : ""}</div>
               </div>
               <div class="info-row">
                 <div class="info-cell"><span class="ic-label">Terrain</span>${island.terrain}</div>
                 <div class="info-cell"><span class="ic-label">Ecology</span>${island.ecology}</div>
               </div>`
            : ""
        }
        ${
          hex.siteType && hex.siteData
            ? `<div class="sea-site">
                 <div class="ss-title">${capitalize(hex.siteType)}</div>
                 <div class="ss-text">${describeSeaSite(hex.siteType, hex.siteData)}</div>
                 ${hex.siteType === 'settlement' ? `<div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="generateTaskForSeaHex(${hex.col},${hex.row})">⚄ Generate Task</button><button class="btn btn-xs btn-teal" onclick="if(typeof openSeaSettlementHexcrawl==='function')openSeaSettlementHexcrawl('${String(hex.title||hex.islandName||'Sea Settlement').replace(/'/g,"\\'")}');else if(typeof openHoldingSettlementHexcrawl==='function')openHoldingSettlementHexcrawl();">◫ Enter Settlement</button></div>` : ''}
                 ${hex.siteType === 'dungeon' ? `<div class="rest-boon" style="margin-top:.28rem;background:rgba(160,152,112,.06);border-color:rgba(160,152,112,.4);"><div class="rb-label" style="color:#a09870;">◫ Rest Boon</div><div style="font-size:.82rem;color:var(--text2);">Resting here grants <strong style="color:var(--green2);">Empowered</strong> (Body/Strike/Shoot ↑).</div><div style="margin-top:.3rem;"><button class="btn btn-xs btn-teal" onclick="if(typeof advanceDay==='function')advanceDay(1);if(typeof toggleCond==='function'&&S.conditions&&!S.conditions.empowered)toggleCond('empowered');showNotif('Sea ruin camp complete. +1 day, Empowered applied.','good');">Accept Boon Rest (Long Rest +1 Day)</button></div></div><div class="ruin-room" style="margin-top:.32rem;"><div class="ruin-room-title">Ruin Details</div><div style="font-size:.8rem;color:var(--muted3);line-height:1.55;"><strong>Built by:</strong> ${hex.siteData.builder || 'Unknown'}<br><strong>Purpose:</strong> ${hex.siteData.builtFor || 'Unknown'}<br><strong>Construction:</strong> ${hex.siteData.construction || 'Stone'}<br><strong>Entrance:</strong> ${hex.siteData.entrance || 'Collapsed arch'}<br><strong>Rooms:</strong> ${hex.siteData.rooms || 4} total<br><strong>Novelty:</strong> ${hex.siteData.novelty || 'None'}</div></div><div style="margin-top:.32rem;display:flex;gap:.24rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="openSeaDungeon(${hex.col},${hex.row})">Enter Sea Ruins Hexcrawl</button></div>` : ''}
                 ${hex.siteType === 'colosseum' ? `<div class="rest-boon" style="margin-top:.28rem;background:rgba(224,128,70,.07);border-color:rgba(224,128,70,.45);"><div class="rb-label" style="color:#f0a870;">⚔ Sea Colosseum</div><div style="font-size:.82rem;color:var(--text2);line-height:1.55;">Host: <strong>${hex.siteData.host || 'Arena Herald'}</strong> · Bracket: <strong>${hex.siteData.style || 'champion gauntlet'}</strong><br>Crowd: ${hex.siteData.crowd || 'wagering crews'} · Win bouts for credits and renown.</div><div style="margin-top:.3rem;display:flex;gap:.24rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="if(typeof window.openSeaColosseumArena==='function')window.openSeaColosseumArena('challenge','${hex.key}');">Challenge Mode</button><button class="btn btn-xs btn-warn" onclick="if(typeof window.openSeaColosseumArena==='function')window.openSeaColosseumArena('endless','${hex.key}');">Endless Mode</button></div></div>` : ''}
               </div>`
            : ""
        }
        ${
          S.lastSea.missionTokens && S.lastSea.missionTokens[hex.key]
            ? (() => { const mt = S.lastSea.missionTokens[hex.key]; const missionRef = (S && Array.isArray(S.activeMissions)) ? S.activeMissions.find(function (m) { return m && String(m.id || '') === String(mt.missionId || ''); }) : null; const isRaid = mt.missionType === 'legacy_raid' || !!(missionRef && missionRef.missionType === 'legacy_raid'); const isSoul = mt.missionType === 'soul_mission' || !!(missionRef && missionRef.missionType === 'soul_mission'); const raidLabel = isRaid ? (mt.type === 'informer' ? 'Raid Lore Wing' : 'Raid Confrontation Wing') : ''; const tokenLabel = isSoul ? (mt.type === 'informer' ? 'Soul Forge Lead' : 'Soul Forge Boss') : (raidLabel || (mt.type === 'site' ? 'Sea Mission Site' : mt.type === 'story' ? 'Story Objective' : 'Sea Informer')); const tokenIcon = isRaid ? '🐉' : isSoul ? (mt.icon || '⚒') : '📍'; const raidNarrative = isRaid ? getSeaRaidNarrative(mt) : ''; return `<div class="npc-block" style="margin-bottom:.35rem;border-color:${isSoul ? 'rgba(255,111,145,.45)' : 'rgba(201,162,39,.45)'};background:${isSoul ? 'rgba(255,111,145,.08)' : 'rgba(201,162,39,.06)'};">
                <div class="nb-label" style="color:${isSoul ? '#ff6f91' : 'var(--gold2)'};">${tokenIcon} ${tokenLabel}</div>
                <div style="font-size:.8rem;color:var(--text2);line-height:1.5;">${mt.title || 'Quest objective here.'}${raidNarrative ? '<br>'+raidNarrative : ''}${isSoul ? '<br><span style="color:var(--muted2);">Endgame boss encounter. Defeat it to capture an affix, choose weapon or armor enhancement, then continue in the Merchant tab at the Soul Forge vendor.</span>' : ''}</div>
                ${mt.missionId === 'sea_task' ? `<div style="margin-top:.3rem;"><button class="btn btn-xs btn-success" onclick="completeSeaTask('${hex.key}')">✓ Resolve Task (Valor vs DD8)</button></div>` : ''}
                ${mt.type === 'story' ? `<div style="margin-top:.3rem;"><button class="btn btn-xs btn-primary" onclick="if(typeof openStorylineTab==='function')openStorylineTab();">Continue Storyline</button></div>` : ''}
              </div>`; })()
            : ""
        }
        ${(typeof window.buildBackstoryAnchorActionPanelHtml === 'function') ? window.buildBackstoryAnchorActionPanelHtml('sea', String(hex.key || '')) : ''}
        ${(() => {
          const fb = window.factionSystem && typeof window.factionSystem.getSeaMarker === 'function'
            ? window.factionSystem.getSeaMarker(hex.key)
            : null;
          if (!fb) return '';
          return `<div class="npc-block" style="margin-bottom:.35rem;border-color:rgba(70,196,182,.55);background:rgba(70,196,182,.08);">
            <div class="nb-label" style="color:var(--teal);">🏰 Faction Base</div>
            <div style="font-size:.8rem;color:var(--text2);line-height:1.5;">${fb.baseName || 'Faction base'} is established in this sea hex.</div>
            <div style="margin-top:.3rem;"><button class="btn btn-xs btn-primary" onclick="if(window.factionSystem&&typeof window.factionSystem.openBaseFromMarker==='function')window.factionSystem.openBaseFromMarker('sea','${hex.key}');">Enter Base</button></div>
          </div>`;
        })()}
        ${!seaUnlocked ? `<div class="npc-block" style="margin-bottom:.35rem;border-color:rgba(126,215,255,.35);background:rgba(126,215,255,.05);"><div class="nb-label" style="color:#7ed7ff;">🧩 Sea Secret Pad Clue Chain</div><div style="font-size:.78rem;color:var(--text2);line-height:1.55;">Unlock by completing all clue stages in order:<br>${seaProgress.talk?'✅':'⬜'} Stage 1: Talk Check (Lead vs d6 at sea base)<br>${seaProgress.event?'✅':'⬜'} Stage 2: Event Lead (hazard/encounter intel)<br>${seaProgress.intel?'✅':'⬜'} Stage 3: Map Intel (sea hex exploration)<br><em style="color:var(--muted2);">Next required stage: ${(typeof window.getSecretPadNextStage==='function') ? (window.getSecretPadNextStage('sea')==='complete'?'Decoded':window.getSecretPadNextStage('sea').toUpperCase()) : 'TALK'}</em></div></div>` : ''}
        ${(() => {
          const ft = window.factionSystem && typeof window.factionSystem.getSeaTask === 'function'
            ? window.factionSystem.getSeaTask(hex.key)
            : null;
          if (!ft) return '';
          return `<div class="npc-block" style="margin-bottom:.35rem;border-color:${ft.status==='combat_pending'?'rgba(224,80,80,.55)':'rgba(232,192,80,.5)'};background:${ft.status==='combat_pending'?'rgba(224,80,80,.08)':'rgba(232,192,80,.08)'};">
            <div class="nb-label" style="color:${ft.status==='combat_pending'?'var(--red2)':'var(--gold2)'};">${ft.monsterTask?'⚔ Monster Wayfarer Task':'✦ Wayfarer Task'}</div>
            <div style="font-size:.8rem;color:var(--text2);line-height:1.5;">${ft.title}${ft.monsterSummary?`<br><em>${ft.monsterSummary}</em>`:''}</div>
            <div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;">
              ${!ft.monsterTask&&ft.status==='open'?`<button class="btn btn-xs btn-primary" onclick="if(window.factionSystem)window.factionSystem.resolveMapTask('sea','${hex.key}');if(typeof renderLastSeaInfo==='function')renderLastSeaInfo();if(typeof renderLastSeaMap==='function')renderLastSeaMap();">Roll Valor vs DD6</button>`:''}
              ${ft.monsterTask&&ft.status==='open'?`<button class="btn btn-xs btn-warn" onclick="if(window.factionSystem)window.factionSystem.startMonsterTask('sea','${hex.key}');if(typeof renderLastSeaInfo==='function')renderLastSeaInfo();if(typeof renderLastSeaMap==='function')renderLastSeaMap();">Generate Monsters / Combat</button>`:''}
              ${ft.monsterTask&&ft.status==='combat_pending'?`<button class="btn btn-xs btn-primary" onclick="if(window.factionSystem)window.factionSystem.finalizeMonsterTask('sea','${hex.key}',null,true);if(typeof renderLastSeaInfo==='function')renderLastSeaInfo();if(typeof renderLastSeaMap==='function')renderLastSeaMap();">Slayed Monsters</button><button class="btn btn-xs btn-red" onclick="if(window.factionSystem)window.factionSystem.finalizeMonsterTask('sea','${hex.key}',null,false);if(typeof renderLastSeaInfo==='function')renderLastSeaInfo();if(typeof renderLastSeaMap==='function')renderLastSeaMap();">Failed Encounter</button>`:''}
            </div>
          </div>`;
        })()}
        ${seaWorldStateHtml}
        ${secretPadKey && secretPadKey === hex.key ? `<div class="npc-block" style="margin-bottom:.35rem;border-color:rgba(126,215,255,.5);background:rgba(126,215,255,.08);">
          <div class="nb-label" style="color:#7ed7ff;">🚀 Hidden Landing Pad</div>
          <div style="font-size:.8rem;color:var(--text2);line-height:1.5;">A submerged launch platform can sling your ship straight to the Galaxy routes.</div>
          <div style="margin-top:.3rem;"><button class="btn btn-xs btn-primary" onclick="if(typeof travelToGalaxyFromMap==='function')travelToGalaxyFromMap();">Launch To Galaxy</button></div>
        </div>` : ''}
        <div style="margin-top:.55rem;display:flex;gap:.3rem;flex-wrap:wrap;">
          <button class="btn btn-teal" onclick="observeAdjacentSeaFromSelected()">🔍 Observe Adjacent (Lead vs DD6)</button>
          <button class="btn btn-primary" onclick="exploreLastSeaHex(${hex.col},${hex.row})">${hex.type === "sea" ? "Explore Waters" : "Explore Island"}</button>
        </div>
        ${normalizedResultHtml ? `<div class="sea-result">${normalizedResultHtml}</div>` : ""}
        <div style="margin-top:.55rem;border-top:1px solid var(--border);padding-top:.55rem;">
          <div class="sub-label">Hex Notes</div>
          <textarea class="notes-area" placeholder="Add notes for this sea hex..." onchange="setLastSeaNote(${hex.col},${hex.row},this.value)">${note}</textarea>
        </div>
      </div>
    `;
  }

  function ensureSeaPerilResultHtml(hex) {
    if (!hex || !hex.resultHtml) return "";
    var html = String(hex.resultHtml);
    if (html.indexOf("Peril") === -1) return html;
    if (html.indexOf("resolveOpenSeaPerilCheck(") !== -1 || html.indexOf("resolveSeaIslandPerilCheck(") !== -1) return html;

    // Don't add Control button to Island Perils - they use Lead
    if (html.indexOf("Island Peril") !== -1) return html;

    var match = html.match(/Peril\s*-\s*([^<]+)/i);
    var perilName = match && match[1] ? String(match[1]).trim() : "Open Sea Hazard";
    var perilNameJs = perilName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    return html
      + '<div style="margin-top:.32rem;"><button class="btn btn-xs btn-warn" onclick="resolveOpenSeaPerilCheck(' + Number(hex.col) + ',' + Number(hex.row) + ',\'' + perilNameJs + '\',6)">⚄ Control vs DD6</button></div>';
  }

  function describeSeaSite(type, data) {
    if (type === "settlement") {
      return `${data.style} settlement with a ${data.feature.toLowerCase()}. ${data.news}`;
    }
    if (type === "landmark") {
      return `${data.name}. Effect: ${data.effect}. ${data.detail}`;
    }
    if (type === "colosseum") {
      return `${data.name}. ${data.style} hosted by ${data.host}. The stands are packed with ${data.crowd}.`;
    }
    return `${data.name}. Built by ${data.builder}. Entrance: ${data.entrance}. ${data.novelty}.`;
  }

  function sanitizeInlineText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildRoyalArmadaText() {
    return `${pick(ARMADA_ACTIONS)} ${pick(ARMADA_TARGETS)}`;
  }

  function getSeaNamedEnemyProfile(kind) {
    if (typeof window !== 'undefined' && typeof window.pickNamedEnemyProfile === 'function') {
      var picked = window.pickNamedEnemyProfile('sea');
      if (kind === 'pirate') {
        return {
          name: 'Iron Marauder',
          desc: 'A tide-raider in riveted armor and stolen naval sigils.',
          dread: Math.max(4, Number(picked && picked.dread || 4)),
          health: Math.max(8, Number(picked && picked.health || 8)),
          deathNumber: Math.max(1, Math.ceil(Math.max(8, Number(picked && picked.health || 8)) / 2))
        };
      }
      return picked;
    }
    var base = kind === 'pirate'
      ? { name: 'Iron Marauder', desc: 'A tide-raider in riveted armor and stolen naval sigils.', dread: 4, health: 8 }
      : { name: 'Drowned Hunter', desc: 'A salt-black predator that rises between swells with hooked hands.', dread: 4, health: 8 };
    base.deathNumber = Math.max(1, Math.ceil(base.health / 2));
    return base;
  }

  function seedSeaEncounterCombat(targetName, enemyCount, dreadDie, hpEach) {
    if (typeof S === 'undefined' || !S) return null;
    var count = Math.max(1, Number(enemyCount || 1));
    var dd = Math.max(4, Number(dreadDie || 6));
    var hp = Math.max(4, Number(hpEach || (dd * 2)));
    var baseName = String(targetName || 'Sea Threat');
    var stamp = Date.now();
    S.combat = S.combat || {};
    S.combat.enemyDread = dd;
    S.enemies = [];
    for (var i = 0; i < count; i++) {
      var label = (count === 1) ? baseName : (baseName + ' ' + (i + 1));
      S.enemies.push({
        id: stamp + i,
        name: label,
        dread: dd,
        stress: 0,
        maxStress: hp,
        health: hp,
        deathNumber: Math.max(1, Math.ceil(hp / 2)),
        conditions: []
      });
    }
    if (typeof setEnemyDread === 'function') setEnemyDread(dd);
    if (typeof renderEnemies === 'function') renderEnemies();
    if (typeof renderQP === 'function') renderQP('combat');
    if (typeof openQuickPanelTab === 'function') openQuickPanelTab('combat');
    return { count: count, dread: dd, hp: hp, name: baseName };
  }

  function startSeaLandBeastCombat(col, row, count) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var foe = getSeaNamedEnemyProfile('beast');
    var seeded = seedSeaEncounterCombat(foe.name, count, foe.dread || 4, foe.health || 8);
    var n = seeded ? seeded.count : Math.max(1, Number(count || 1));
    var death = Math.max(1, Math.ceil(Number((foe && foe.health) || 8) / 2));
    hex.resultHtml = '<div class="sea-result-title">Land Encounter - ' + foe.name + '</div>'
      + '<div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">' + n + ' ' + foe.name + (n > 1 ? 's' : '') + ' now populate Combat. '
      + String(foe.desc || '') + ' DD' + Number((foe && foe.dread) || 4) + ' | ' + Number((foe && foe.health) || 8) + ' HP each · Death Number ' + death + '.</div>'
      + '<div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-warn" onclick="if(typeof switchTab===\'function\'){const b=document.querySelector(\"#mainNav .tab-btn[onclick*=\\\"switchTab(\\\'combat\\\'\\\"]\");switchTab(\'combat\',b||null);}if(typeof openQuickPanelTab===\'function\'){openQuickPanelTab(\'combat\');}">Open Combat + Quick Access</button>'
      + '<button class="btn btn-xs btn-success" onclick="resolveSeaLandBeastOutcome(' + col + ',' + row + ',true)">✓ Victory</button>'
      + '<button class="btn btn-xs btn-red" onclick="resolveSeaLandBeastOutcome(' + col + ',' + row + ',false)">✗ Defeat</button>'
      + '</div>';
    renderLastSeaInfo(hex);
    showNotif('Beast combat seeded: ' + n + ' enemies in Combat + Quick Access. Choose outcome after the fight.', 'warn');
  }

  function resolveSeaLandBeastOutcome(col, row, success) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var bonusNotes = [];
    if (success) {
      if (typeof changeCounter === 'function') changeCounter('renown', 1);
      S.credits = (S.credits || 0) + 25;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      hex.resultHtml = '<div class="sea-result-title">Beasts Defeated</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You clear the path. +1 Renown and +25 credits.</div>';
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      showNotif('Hostile beasts defeated.', 'good');
    } else {
      ensureMentalStress(1);
      hex.resultHtml = '<div class="sea-result-title">Beast Encounter Failed</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You retreat with injuries. +1 Mental Stress.</div>';
      if (typeof addTMWOnFail === 'function') addTMWOnFail();
      showNotif('Beast encounter failed.', 'warn');
    }
    renderLastSeaInfo(hex);
  }

  function acceptSeaLandmarkProtected(col, row) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    // Apply Long Rest effects
    if (typeof qpLongRest === 'function') {
      qpLongRest();
    } else {
      // Fallback if qpLongRest not available
      S.stress = 0;
      S.mentalStress = 0;
      if (typeof changeCondition === 'function') {
        document.querySelectorAll('[class*="condition-pill"]').forEach(el => {
          if (el.textContent) changeCondition(el.textContent.trim(), false);
        });
      }
      if (typeof updateStressUI === 'function') updateStressUI();
      if (typeof updateMentalStressUI === 'function') updateMentalStressUI();
    }
    if (typeof toggleCond === 'function' && S && S.conditions && !S.conditions.protected) {
      toggleCond('protected');
    }
    if (typeof advanceDay === 'function') {
      advanceDay(1);
    }
    hex.resultHtml = '<div class="sea-result-title">Landmark - Protected Resting Place</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You find respite at this sacred place. Long Rest complete, day advanced by 1, and Protected gained.</div>';
    renderLastSeaInfo(hex);
    showNotif('Protected Landmark: Long Rest complete, +1 day, Protected gained.', 'good');
  }

  function seaHexByCoord(col, row) {
    if (!S.lastSea || !Array.isArray(S.lastSea.map)) return null;
    return S.lastSea.map.find((h) => h && h.col === col && h.row === row) || null;
  }

  function ensureMentalStress(amount) {
    var val = Math.max(0, Number(amount) || 0);
    if (!val) return;
    if (typeof changeMentalStress === 'function') {
      changeMentalStress(val);
      return;
    }
    S.mentalStress = (S.mentalStress || 0) + val;
    if (typeof updateMentalStressUI === 'function') updateMentalStressUI();
  }

  function ensureTrauma(amount) {
    var val = Number(amount) || 0;
    if (!val) return;
    if (typeof changeTrauma === 'function') {
      changeTrauma(val);
      return;
    }
    S.trauma = Math.max(0, (S.trauma || 0) + val);
    if (typeof updateTrauma === 'function') updateTrauma();
  }

  function getSeaNarrativeItemFlags() {
    var carried = [];
    if (Array.isArray(S.backpack)) {
      carried = carried.concat(S.backpack.filter(Boolean));
    }
    if (S.equipped && typeof S.equipped === 'object') {
      carried = carried.concat(Object.keys(S.equipped).map(function (k) { return S.equipped[k]; }).filter(Boolean));
    }
    if (S.naval && S.naval.ship && Array.isArray(S.naval.ship.cargo)) {
      carried = carried.concat(S.naval.ship.cargo.filter(Boolean));
    }
    var text = carried.join(' | ').toLowerCase();
    var factionRegex = /(faction|corporation|underworld|religious|political|military|royal|rebel|guild|charter|insignia|sigil|seal|token|badge|writ|contract|banner)/;
    return {
      torch: /torch|lantern/.test(text),
      compass: /compass|spyglass|sextant/.test(text),
      factionItem: factionRegex.test(text)
    };
  }

  function seaNarrativeBonusLine(parts) {
    if (!parts || !parts.length) return '';
    return '<div style="font-size:.75rem;color:var(--teal);margin-top:.12rem;">Narrative item bonus: ' + parts.join(' · ') + '</div>';
  }

  function ensureSeaSettlementLife(hex) {
    if (!hex || hex.siteType !== 'settlement') return null;
    hex.siteData = hex.siteData || {};
    var life = hex.siteData.life;
    if (!life || typeof life !== 'object') {
      var economies = ['fishing lanes', 'salvage docks', 'reef farming', 'charter smugglers', 'storm trawlers'];
      var scarcity = ['surplus', 'balanced', 'strained', 'scarce'];
      life = {
        economy: economies[Math.floor(Math.random() * economies.length)] || 'fishing lanes',
        scarcity: scarcity[Math.floor(Math.random() * scarcity.length)] || 'balanced',
        npcs: [
          { name: pick(['Dockmaster Iven', 'Harbormaster Sela', 'Quartermaster Brin']), role: 'Port Control', relation: 0, memory: 'No deal made yet.' },
          { name: pick(['Netwright Tal', 'Hullwright Mora', 'Signaler Vesk']), role: 'Trade Crew', relation: 0, memory: 'Watching your choices.' },
          { name: pick(['Tide Priest Orun', 'Fog Speaker Lin', 'Chart Keeper Nara']), role: 'Local Voice', relation: 0, memory: 'Waiting for proof.' }
        ],
        storylets: [
          { id: 'sea-chain-1', title: 'Harbor Ledger Theft', stage: 1, ignoredDays: 0, resolved: false },
          { id: 'sea-chain-2', title: 'Ghost Buoy Signals', stage: 1, ignoredDays: 0, resolved: false }
        ]
      };
      hex.siteData.life = life;
    }
    return life;
  }

  function updateSeaNpcMemory(hex, tone, note) {
    var life = ensureSeaSettlementLife(hex);
    if (!life || !Array.isArray(life.npcs) || !life.npcs.length) return;
    var npc = life.npcs[Math.floor(Math.random() * life.npcs.length)] || null;
    if (!npc) return;
    npc.relation = Number(npc.relation || 0) + (tone === 'positive' ? 1 : (tone === 'negative' ? -1 : 0));
    npc.memory = String(note || 'Interaction logged.');
  }

  function openSeaSettlementMerchant(col, row) {
    var hex = seaHexByCoord(col, row);
    var life = ensureSeaSettlementLife(hex);
    if (!hex || !life) return;
    var cat = life.scarcity === 'scarce' ? 'weapon_mods' : 'items';
    if (typeof switchTab === 'function') {
      var btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('shop'\"]");
      switchTab('shop', btn || null);
    }
    if (typeof showShopCat === 'function') {
      try { showShopCat(cat, null); } catch (_err) { console.error(_err); }
    }
    updateSeaNpcMemory(hex, 'positive', 'Opened trade lanes for ' + cat + '.');
    showNotif('Sea merchant opened (' + cat + ').', 'good');
  }

  function runSeaSettlementSideTask(col, row) {
    var hex = seaHexByCoord(col, row);
    if (!hex || hex.siteType !== 'settlement') return;
    var die = (typeof getEffectiveDie === 'function') ? getEffectiveDie('lead') : ((S.stats && S.stats.lead) || 4);
    var a = explodingRoll(die);
    var d = explodingRoll(6);
    var success = Number(a.total || 0) >= Number(d.total || 0);
    if (success) {
      S.credits = Number(S.credits || 0) + 40;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      if (typeof changeCounter === 'function') changeCounter('tmw', 1);
    } else {
      ensureMentalStress(1);
    }
    updateSeaNpcMemory(hex, success ? 'positive' : 'negative', success ? 'Solved a dockside side task.' : 'A dockside side task failed.');
    hex.resultHtml = '<div class="sea-result-title">Sea Side Task</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Lead d' + die + '=' + a.total + ' vs DD6=' + d.total + '. '
      + (success ? '+40 credits, +1 Teamwork.' : '+1 Mental Stress.') + '</div>';
    renderLastSeaInfo(hex);
  }

  function tickSeaSettlementDaily(days) {
    if (!S || !S.lastSea || !Array.isArray(S.lastSea.map)) return;
    var d = Math.max(1, Number(days || 1));
    S.lastSea.map.forEach(function (hex) {
      if (!hex || hex.siteType !== 'settlement') return;
      var life = ensureSeaSettlementLife(hex);
      if (!life || !Array.isArray(life.storylets)) return;
      life.storylets.forEach(function (s) {
        if (!s || s.resolved) return;
        s.ignoredDays = Number(s.ignoredDays || 0) + d;
        if (s.ignoredDays >= 2 && Number(s.stage || 1) < 3) {
          s.stage = Number(s.stage || 1) + 1;
          s.ignoredDays = 0;
        }
      });
    });
  }

  function buildSeaSettlementDowntimePanel(hex) {
    if (!hex || hex.siteType !== 'settlement') return '';
    var life = ensureSeaSettlementLife(hex);
    var pending = hex.pendingDowntimeEvent;
    var result = hex.downtimeLastResult;
    var npcHtml = life && Array.isArray(life.npcs)
      ? life.npcs.map(function (npc) {
          return '<div style="font-size:.72rem;color:var(--muted2);">• ' + String(npc.name || 'Local') + ' (' + String(npc.role || 'Crew') + ') · Rel ' + (Number(npc.relation || 0) >= 0 ? '+' : '') + Number(npc.relation || 0) + '</div>';
        }).join('')
      : '';
    var storyletHtml = life && Array.isArray(life.storylets)
      ? life.storylets.filter(function (s) { return s && !s.resolved; }).map(function (s) {
          return '<div style="font-size:.72rem;color:var(--muted2);">• ' + String(s.title || 'Sea storylet') + ' — Stage ' + Number(s.stage || 1) + '/3</div>';
        }).join('')
      : '';
    var stats = ['lead', 'mind', 'body', 'spirit', 'control', 'strike', 'shoot', 'defend'];
    return `<div class="npc-block" style="margin-top:.4rem;border-color:rgba(46,196,182,.35);background:rgba(46,196,182,.06);">
      <div class="nb-label" style="color:var(--teal);">🏘 Sea Holding Downtime</div>
      <div style="font-size:.78rem;color:var(--text2);line-height:1.5;">Pick an activity lane: talk to people, run a local task, or explore nearby routes.</div>
      <div style="font-size:.74rem;color:var(--muted2);margin-top:.2rem;">Economy: <strong>${life ? life.economy : 'mixed'}</strong> · Scarcity: <strong>${life ? life.scarcity : 'balanced'}</strong></div>
      <div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-teal" onclick="rollSeaSettlementDowntime(${hex.col},${hex.row},'talk')">💬 Talk To Locals</button>
        <button class="btn btn-xs btn-primary" onclick="rollSeaSettlementDowntime(${hex.col},${hex.row},'task')">🧾 Run A Task</button>
        <button class="btn btn-xs btn-warn" onclick="rollSeaSettlementDowntime(${hex.col},${hex.row},'explore')">🧭 Explore Nearby</button>
        <button class="btn btn-xs" onclick="openSeaSettlementMerchant(${hex.col},${hex.row})">🛒 Browse Market</button>
        <button class="btn btn-xs" onclick="runSeaSettlementSideTask(${hex.col},${hex.row})">📌 Side Task</button>
      </div>
      ${npcHtml ? `<div style="margin-top:.28rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.22rem;"><div style="font-size:.7rem;color:var(--teal);">District NPC Roster</div>${npcHtml}</div>` : ''}
      ${storyletHtml ? `<div style="margin-top:.22rem;"><div style="font-size:.7rem;color:var(--teal);">Escalating Storylets</div>${storyletHtml}</div>` : ''}
      ${pending ? `<div style="margin-top:.35rem;padding:.35rem .45rem;border:1px solid var(--border2);background:var(--surface);">
        <div style="font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);">${pending.name}</div>
        <div style="font-size:.76rem;color:var(--muted2);margin-top:.15rem;">Choose Action Die vs DD${pending.dd}</div>
        <div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.28rem;">${stats.map(function (key) { return '<button class="btn btn-xs btn-teal" onclick="resolveSeaSettlementDowntime(' + hex.col + ',' + hex.row + ',\'' + key + '\')">' + key.charAt(0).toUpperCase() + key.slice(1) + '</button>'; }).join('')}</div>
      </div>` : ''}
      ${result ? `<div style="margin-top:.35rem;padding:.35rem .45rem;border:1px solid ${result.success ? 'rgba(76,175,116,.35)' : 'rgba(201,64,64,.35)'};background:${result.success ? 'rgba(76,175,116,.08)' : 'rgba(201,64,64,.08)'};">
        <div style="font-size:.76rem;color:var(--text2);">${result.check}</div>
        <div style="font-size:.76rem;color:var(--gold2);margin-top:.14rem;">${result.text}</div>
      </div>` : ''}
    </div>`;
  }

  function seaSettlementDowntimeEvents(activity) {
    var pools = {
      talk: [
        { name: 'Harbor Gossip Exchange', dd: 6, success: 'You map a rumor web. +1 Teamwork.', failure: 'Rumors turn paranoid. Mental Stress equals failed difference.', successEffect: { tmw: 1 }, failEffect: { mentalStress: 1 } },
        { name: 'Council Fireside Mediation', dd: 8, success: 'Two crews settle a feud. +1 Renown.', failure: 'Talks collapse into threats. Mental Stress equals failed difference.', successEffect: { renown: 1 }, failEffect: { mentalStress: 1 } }
      ],
      task: [
        { name: 'Dockside Contract Run', dd: 8, success: 'Cargo reaches safe harbor. +60 credits.', failure: 'Cargo breaks loose. Health damage equals failed difference.', successEffect: { credits: 60 }, failEffect: { health: 1 } },
        { name: 'Tideway Escort Duty', dd: 6, success: 'You escort fishers through raider waters. +1 Renown.', failure: 'The route turns chaotic. Mental Stress equals failed difference.', successEffect: { renown: 1 }, failEffect: { mentalStress: 1 } }
      ],
      explore: [
        { name: 'Reef Survey Expedition', dd: 8, success: 'You chart hidden channels and caches. +40 credits.', failure: 'Jagged reefs punish the team. Health damage equals failed difference.', successEffect: { credits: 40 }, failEffect: { health: 1 } },
        { name: 'Fogline Recon Sweep', dd: 6, success: 'You return with actionable route intel. +1 Teamwork.', failure: 'The fog disorients everyone. Mental Stress equals failed difference.', successEffect: { tmw: 1 }, failEffect: { mentalStress: 1 } }
      ]
    };
    return pools[String(activity || 'talk').toLowerCase()] || pools.talk;
  }

  function applySeaDowntimeEffect(effect, margin) {
    if (!effect) return;
    var failedBy = (window.BTLRules && typeof window.BTLRules.getFailureMargin === 'function') ? window.BTLRules.getFailureMargin({ failedBy: margin }, 1) : Math.max(1, Number(margin || 1));
    if (effect.tmw && typeof changeCounter === 'function') changeCounter('tmw', effect.tmw);
    if (effect.renown && typeof changeCounter === 'function') changeCounter('renown', effect.renown);
    if (effect.credits) {
      S.credits = (S.credits || 0) + effect.credits;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
    }
    if (effect.health && typeof changeHealth === 'function') changeHealth(effect.health === 1 ? failedBy : effect.health);
    if (effect.mentalStress) ensureMentalStress(effect.mentalStress === 1 ? failedBy : effect.mentalStress);
  }

  function rollSeaSettlementDowntime(col, row, activity) {
    var hex = seaHexByCoord(col, row);
    if (!hex || hex.siteType !== 'settlement') return;
    var pool = seaSettlementDowntimeEvents(activity);
    var evt = pool[Math.max(0, roll(pool.length) - 1)];
    evt.activity = String(activity || 'talk').toLowerCase();
    hex.pendingDowntimeEvent = evt;
    hex.downtimeLastResult = null;
    renderLastSeaInfo(hex);
    showNotif('Sea downtime: ' + evt.name, 'good');
  }

  function resolveSeaSettlementDowntime(col, row, statKey) {
    var hex = seaHexByCoord(col, row);
    var evt = hex && hex.pendingDowntimeEvent;
    if (!hex || !evt) return;
    var allowedStats = ['lead', 'control', 'mind', 'body', 'spirit', 'defend', 'strike', 'shoot'];
    var requestedKey = String(statKey || '').toLowerCase();
    var key = allowedStats.indexOf(requestedKey) >= 0 ? requestedKey : 'lead';
    var die = (typeof getEffectiveDie === 'function') ? getEffectiveDie(key) : ((S.stats && S.stats[key]) || 4);
    var itemFlags = getSeaNarrativeItemFlags();
    var checkBonus = 0;
    var checkBonusNotes = [];
    if (itemFlags.compass && (key === 'lead' || key === 'control')) {
      checkBonus += 2;
      checkBonusNotes.push('Compass +2 to navigation checks');
    }
    if (itemFlags.torch && evt.activity === 'explore') {
      checkBonus += 1;
      checkBonusNotes.push('Torchlight +1 while exploring');
    }
    var finishDowntime = function(success, checkText, failedBy) {
      var outcomeBonusNotes = [];
      if (success) {
        applySeaDowntimeEffect(evt.successEffect);
        updateSeaNpcMemory(hex, 'positive', 'Downtime success in ' + String(evt.activity || 'activity') + '.');
        if (itemFlags.compass && evt.activity === 'explore') {
          S.credits = (S.credits || 0) + 20;
          if (typeof updateCreditsUI === 'function') updateCreditsUI();
          outcomeBonusNotes.push('Compass route intel +20 credits');
        }
        if (itemFlags.factionItem && evt.activity === 'talk') {
          if (typeof changeCounter === 'function') changeCounter('renown', 1);
          outcomeBonusNotes.push('Faction token leverage +1 Renown');
        }
        if (typeof addSuccessRoll === 'function') addSuccessRoll();
      } else {
        var failureMargin = (window.BTLRules && typeof window.BTLRules.getFailureMargin === 'function') ? window.BTLRules.getFailureMargin({ failedBy: failedBy }, 1) : Math.max(1, Number(failedBy || 1));
        applySeaDowntimeEffect(evt.failEffect, failureMargin);
        updateSeaNpcMemory(hex, 'negative', 'Downtime failure in ' + String(evt.activity || 'activity') + '.');
        if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-downtime-failure', { failedBy: failureMargin, actionDie: die, dreadDie: Math.max(4, Number(evt.dd || 6)) });
      }
      hex.downtimeLastResult = {
        success: success,
        check: checkText,
        text: (success ? evt.success : evt.failure) + seaNarrativeBonusLine(checkBonusNotes.concat(outcomeBonusNotes))
      };
      hex.pendingDowntimeEvent = null;
      renderLastSeaInfo(hex);
      showNotif(hex.downtimeLastResult.text, success ? 'good' : 'warn');
    };

    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Sea Downtime',
        context: String(evt.name || 'Sea Downtime Activity'),
        statKey: key,
        statLabel: key.charAt(0).toUpperCase() + key.slice(1),
        actionDie: die,
        dreadDie: evt.dd || 6,
        onResolve: function(outcome) {
          var usedDd = Number((outcome && outcome.dreadDie) || (evt.dd || 6));
          var failureMargin = Math.max(1, Number((outcome && outcome.dreadTotal) || usedDd) - Number((outcome && outcome.actionTotal) || 0));
          finishDowntime(!!(outcome && outcome.success), key.toUpperCase() + ' d' + die + ' vs DD' + usedDd + ' (manual' + (outcome && outcome.pushLuck ? ', Push Luck' : '') + ')', failureMargin);
        }
      });
      return;
    }

    var a = explodingRoll(die);
    var d = explodingRoll(evt.dd || 6);
    if (checkBonus) a.total += checkBonus;
    var success = a.total >= d.total;
    finishDowntime(success, key.toUpperCase() + ' d' + die + '=' + a.total + ' vs DD' + (evt.dd || 6) + '=' + d.total, Math.max(1, d.total - a.total));
  }

  function resolveSeaIslandPerilCheck(col, row) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var itemFlags = getSeaNarrativeItemFlags();
    var bonusNotes = [];
    var leadDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('lead') : ((S.stats && S.stats.lead) || 4);
    var leadRoll = explodingRoll(leadDie).total;
    if (itemFlags.compass) {
      leadRoll += 2;
      bonusNotes.push('Compass +2 Lead');
    }
    var finalizeFog = function(success, checkLine, failedBy) {
      var stress = success ? 0 : Math.max(1, Number(failedBy || 1));
      if (!success && itemFlags.torch) {
        stress = Math.max(0, stress - 1);
        bonusNotes.push('Torch reduces fog stress by 1');
      }
      if (stress) ensureMentalStress(stress);
      hex.resultHtml = `<div class="sea-result-title">Island Peril - Fog</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">${checkLine} ${success ? 'You guide everyone through the fog.' : '+' + stress + ' Mental Stress from disorientation and panic.'}</div>${seaNarrativeBonusLine(bonusNotes)}`;
      renderLastSeaInfo(hex);
      showNotif(success ? 'Fog route secured.' : 'Fog peril hit the crew.', success ? 'good' : 'warn');
    };

    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Island Peril',
        context: 'Island Peril - Fog',
        statKey: 'lead',
        statLabel: 'Lead',
        actionDie: leadDie,
        dreadDie: 6,
        onResolve: function(outcome) {
          var dd = Number((outcome && outcome.dreadDie) || 6);
          finalizeFog(!!(outcome && outcome.success), 'Lead d' + leadDie + ' vs DD' + dd + ' (manual' + (outcome && outcome.pushLuck ? ', Push Luck' : '') + ').', Math.max(1, Number((outcome && outcome.dreadTotal) || dd) - Number((outcome && outcome.actionTotal) || 0)));
        }
      });
      return;
    }

    var dreadRoll = explodingRoll(6).total;
    var success = leadRoll >= dreadRoll;
    var stress = success ? 0 : Math.max(1, dreadRoll - leadRoll);
    if (!success && itemFlags.torch) {
      stress = Math.max(0, stress - 1);
      bonusNotes.push('Torch reduces fog stress by 1');
    }
    if (stress) ensureMentalStress(stress);
    hex.resultHtml = `<div class="sea-result-title">Island Peril - Fog</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Lead d${leadDie}=${leadRoll} vs DD6=${dreadRoll}. ${success ? 'You guide everyone through the fog.' : '+' + stress + ' Mental Stress from disorientation and panic.'}</div>${seaNarrativeBonusLine(bonusNotes)}`;
    renderLastSeaInfo(hex);
    showNotif(success ? 'Fog route secured.' : 'Fog peril hit the crew.', success ? 'good' : 'warn');
  }

  function resolveSeaExhaustionCheck(col, row) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var itemFlags = getSeaNarrativeItemFlags();
    var bonusNotes = [];
    var spiritDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('spirit') : ((S.stats && S.stats.spirit) || 4);
    var spiritRoll = explodingRoll(spiritDie).total;
    if (itemFlags.torch) {
      spiritRoll += 1;
      bonusNotes.push('Torch steadies the march (+1)');
    }
    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Exhaustion Check',
        context: 'Island Exhaustion',
        statKey: 'spirit',
        statLabel: 'Spirit',
        actionDie: spiritDie,
        dreadDie: 6,
        onResolve: function(outcome) {
          var success = !!(outcome && outcome.success);
          var usedDd = Number((outcome && outcome.dreadDie) || 6);
          if (!success) ensureTrauma(1);
          hex.resultHtml = `<div class="sea-result-title">Exhaustion</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Trauma Check: Spirit d${spiritDie} vs DD${usedDd} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}). ${success ? 'You keep pressing inland without long-term harm.' : '+1 Trauma before pressing farther inland.'}</div>${seaNarrativeBonusLine(bonusNotes)}`;
          renderLastSeaInfo(hex);
          showNotif(success ? 'Exhaustion check passed.' : 'Exhaustion causes trauma.', success ? 'good' : 'warn');
        }
      });
      return;
    }

    var dreadRoll = explodingRoll(6).total;
    var success = spiritRoll >= dreadRoll;
    if (!success) ensureTrauma(1);
    hex.resultHtml = `<div class="sea-result-title">Exhaustion</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Trauma Check: Spirit d${spiritDie}=${spiritRoll} vs DD6=${dreadRoll}. ${success ? 'You keep pressing inland without long-term harm.' : '+1 Trauma before pressing farther inland.'}</div>${seaNarrativeBonusLine(bonusNotes)}`;
    renderLastSeaInfo(hex);
    showNotif(success ? 'Exhaustion check passed.' : 'Exhaustion causes trauma.', success ? 'good' : 'warn');
  }

  function startSeaPirateLandEncounter(col, row) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var foe = getSeaNamedEnemyProfile('pirate');
    seedSeaEncounterCombat(foe.name, 2, foe.dread || 4, foe.health || 8);
    var death = Math.max(1, Math.ceil(Number((foe && foe.health) || 8) / 2));
    hex.resultHtml = `<div class="sea-result-title">Land Encounter - ${foe.name}</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">2 ${foe.name}s haunt the path inland. ${foe.desc || ''} DD${Number((foe && foe.dread) || 4)} | ${Number((foe && foe.health) || 8)} HP each · Death Number ${death}. Combat roster seeded. Choose outcome to resolve encounter.</div><div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-warn" onclick="if(typeof switchTab==='function'){const b=document.querySelector(\"#mainNav .tab-btn[onclick*=\\\"switchTab('combat'\\\"]\");switchTab('combat',b||null);}if(typeof openQuickPanelTab==='function'){openQuickPanelTab('combat');}">Open Combat + Quick Access</button><button class="btn btn-xs btn-primary" onclick="resolveSeaPirateLandOutcome(${col},${row},true)">✓ Victory</button><button class="btn btn-xs btn-red" onclick="resolveSeaPirateLandOutcome(${col},${row},false)">✗ Defeat</button></div>`;
    renderLastSeaInfo(hex);
    showNotif('Pirate encounter staged: 2 foes seeded in Combat + Quick Access. Choose outcome after the fight.', 'warn');
  }

  function resolveSeaPirateLandOutcome(col, row, success) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var itemFlags = getSeaNarrativeItemFlags();
    var bonusNotes = [];
    if (success) {
      if (typeof changeCounter === 'function') changeCounter('renown', 1);
      if (itemFlags.factionItem && typeof changeCounter === 'function') {
        changeCounter('renown', 1);
        bonusNotes.push('Faction item intimidation +1 Renown');
      }
      S.credits = (S.credits || 0) + 30;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      hex.resultHtml = '<div class="sea-result-title">Pirates Defeated</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You clear the inland path. +1 Renown and +30 credits.</div>' + seaNarrativeBonusLine(bonusNotes);
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      showNotif('Inland pirates defeated.', 'good');
    } else {
      ensureMentalStress(2);
      hex.resultHtml = '<div class="sea-result-title">Pirate Ambush Failed</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Your push inland collapses under pressure. +2 Mental Stress.</div>';
      if (typeof addTMWOnFail === 'function') addTMWOnFail();
      showNotif('Inland pirate encounter failed.', 'warn');
    }
    renderLastSeaInfo(hex);
  }

  function startSeaShipCombatEncounter() {
    var hex = S.lastSea && S.lastSea.selectedKey && S.lastSea.map
      ? S.lastSea.map.find(function (h) { return h.key === S.lastSea.selectedKey; })
      : null;
    if (!hex) return;
    if (typeof spawnEnemyShip === 'function') spawnEnemyShip();
    if (typeof startNavalCombat === 'function') startNavalCombat();
    if (typeof switchTab === 'function') {
      var combatBtn = document.querySelector('#mainNav .tab-btn[onclick*="switchTab(\'combat\'"]');
      switchTab('combat', combatBtn || null);
    }
    if (typeof openQuickPanelTab === 'function') openQuickPanelTab('combat');
    hex.resultHtml = '<div class="sea-result-title">Open Sea Ship Combat</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Ship battle seeded from Sea lanes. Resolve with naval controls and Combat + Quick Access, then choose outcome to resolve encounter.</div><div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-warn" onclick="if(typeof switchTab===\'function\'){var b=document.querySelector(\'#mainNav .tab-btn[onclick*=\\\"switchTab(\\\'combat\\\'\\\"]\');switchTab(\'combat\',b||null);}if(typeof openQuickPanelTab===\'function\'){openQuickPanelTab(\'combat\');}">Open Combat + Quick Access</button><button class="btn btn-xs btn-success" onclick="resolveSeaShipCombatOutcome(true)">✓ Victory</button><button class="btn btn-xs btn-red" onclick="resolveSeaShipCombatOutcome(false)">✗ Defeat</button></div>';
    renderLastSeaInfo(hex);
    showNotif('Ship combat started. Use Combat + Quick Access and naval controls, then choose outcome to resolve encounter.', 'warn');
  }

  function resolveSeaShipCombatOutcome(success) {
    var hex = S.lastSea && S.lastSea.selectedKey && S.lastSea.map
      ? S.lastSea.map.find(function (h) { return h.key === S.lastSea.selectedKey; })
      : null;
    if (!hex) return;
    var itemFlags = getSeaNarrativeItemFlags();
    var bonusNotes = [];
    if (success) {
      if (typeof changeCounter === 'function') changeCounter('renown', 1);
      if (itemFlags.compass) {
        S.credits = (S.credits || 0) + 30;
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        bonusNotes.push('Compass salvage route +30 credits');
      }
      if (itemFlags.factionItem && typeof changeCounter === 'function') {
        changeCounter('renown', 1);
        bonusNotes.push('Faction colors rally allies +1 Renown');
      }
      hex.resultHtml = '<div class="sea-result-title">Ship Combat Won</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You control the lane. +1 Renown.</div>' + seaNarrativeBonusLine(bonusNotes);
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      showNotif('Sea lane secured.', 'good');
    } else {
      ensureMentalStress(2);
      hex.resultHtml = '<div class="sea-result-title">Ship Combat Lost</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Your ship retreats under pressure. +2 Mental Stress.</div>';
      if (typeof addTMWOnFail === 'function') addTMWOnFail();
      showNotif('Ship combat lost in open sea.', 'warn');
    }
    renderLastSeaInfo(hex);
  }

  function buildSeaSkirmishEncounter(hex) {
    if (!hex) return '';
    var itemFlags = getSeaNarrativeItemFlags();
    var skirmishHint = itemFlags.factionItem ? ' (+Faction +1 Renown)' : '';
    var skirmishTitle = itemFlags.factionItem ? 'Faction token grants +1 Renown when you join a side.' : '';
    var sides = [
      ['Royal Armada Marines', 'Pirate Brotherhood'],
      ['Reef Wardens', 'Salt Reavers'],
      ['Merchant Convoy Guard', 'Open Sea Raiders']
    ];
    var pickSides = sides[Math.max(0, roll(sides.length) - 1)];
    hex.pendingSeaSkirmish = {
      sideA: pickSides[0],
      sideB: pickSides[1],
      joined: null,
      commanderToken: '',
      commanderName: '',
      rewarded: false,
      round: 1,
      armyA: { stress: roll(12) + roll(12), dread: 6, actions: 2 },
      armyB: { stress: roll(12) + roll(12), dread: 6, actions: 2 }
    };
    return `<div class="sea-result-title">Sea Skirmish</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">${pickSides[0]} clash with ${pickSides[1]} in the shipping lane. Choose a side and run skirmish controls.</div><div style="margin-top:.32rem;display:grid;grid-template-columns:1fr 1fr;gap:.25rem;"><button class="btn btn-xs btn-primary" title="${skirmishTitle}" onclick="joinSeaSkirmishSide(${hex.col},${hex.row},'A')">${pickSides[0]}${skirmishHint}</button><button class="btn btn-xs btn-red" title="${skirmishTitle}" onclick="joinSeaSkirmishSide(${hex.col},${hex.row},'B')">${pickSides[1]}${skirmishHint}</button></div>`;
  }

  function getSoloWayfarerHealth() {
    var hp = (typeof S.health === 'number') ? S.health : 0;
    return Math.max(0, Number(hp || 0));
  }

  function getCampaignWayfarerHealthTotal() {
    var total = 0;
    var cs = window.campaignSystem && typeof window.campaignSystem.getState === 'function'
      ? window.campaignSystem.getState()
      : null;
    var roster = cs && cs.campaign && Array.isArray(cs.campaign.roster) ? cs.campaign.roster : [];
    if (roster.length) {
      roster.forEach(function (p) {
        var c = p && p.character ? p.character : null;
        var hp = c && typeof c.health === 'number' ? c.health : 0;
        total += Math.max(0, Number(hp || 0));
      });
    }
    if (!total) total = getSoloWayfarerHealth();
    return total;
  }

  function getCampaignActorContext() {
    var cs = window.campaignSystem && typeof window.campaignSystem.getState === 'function'
      ? window.campaignSystem.getState()
      : null;
    var campaign = cs && cs.campaign ? cs.campaign : null;
    return {
      token: cs && cs.token ? String(cs.token) : '',
      role: cs && cs.role ? String(cs.role) : '',
      roster: campaign && Array.isArray(campaign.roster) ? campaign.roster : []
    };
  }

  function isCampaignTokenOnline(ctx, token) {
    if (!ctx || !Array.isArray(ctx.roster) || !token) return false;
    var member = ctx.roster.find(function (p) { return String(p && p.token || '') === String(token || ''); });
    return !!(member && member.online);
  }

  function getCampaignMemberLabelByToken(ctx, token) {
    if (!ctx || !Array.isArray(ctx.roster) || !token) return 'Player';
    var member = ctx.roster.find(function (p) { return String(p && p.token || '') === String(token || ''); });
    if (!member) return 'Player';
    var rolePrefix = member.role === 'gm' ? 'GM' : 'Player';
    var name = String(member.name || '').trim();
    return name ? (rolePrefix + ' ' + name) : rolePrefix;
  }

  function getSeaSkirmishLockState(st, ctx) {
    var actor = ctx || getCampaignActorContext();
    if (!st || !st.joined) {
      return { text: 'No active skirmish command lock.', tone: 'var(--muted2)', mine: false };
    }
    if (!actor.token) {
      return { text: 'Solo control active.', tone: 'var(--teal)', mine: true };
    }
    if (!st.commanderToken) {
      return { text: 'No commander assigned. First action claims command.', tone: 'var(--gold2)', mine: true };
    }

    var isMine = st.commanderToken === actor.token;
    var online = isCampaignTokenOnline(actor, st.commanderToken);
    var label = st.commanderName || getCampaignMemberLabelByToken(actor, st.commanderToken);
    if (!online && !isMine) {
      return {
        text: 'Command lock is stale (' + sanitizeInlineText(label) + ' offline). Next action can take over.',
        tone: 'var(--gold2)',
        mine: false
      };
    }
    return {
      text: isMine ? 'Command lock: You control skirmish actions.' : ('Command lock: ' + sanitizeInlineText(label) + ' controls actions.'),
      tone: isMine ? 'var(--teal)' : 'var(--muted2)',
      mine: isMine
    };
  }

  function canControlSeaSkirmish(st) {
    if (!st || !st.joined) return false;
    var ctx = getCampaignActorContext();
    if (!ctx.token) return true;
    if (ctx.role === 'gm') return true;
    if (!st.commanderToken) {
      st.commanderToken = ctx.token;
      st.commanderName = getCampaignMemberLabelByToken(ctx, ctx.token);
      return true;
    }
    if (st.commanderToken === ctx.token) return true;
    if (!isCampaignTokenOnline(ctx, st.commanderToken)) {
      st.commanderToken = ctx.token;
      st.commanderName = getCampaignMemberLabelByToken(ctx, ctx.token);
      showNotif('Previous skirmish commander is offline. Command transferred to you.', 'warn');
      return true;
    }
    return false;
  }

  function stepSeaSkirmishDreadDie(current, delta) {
    var chain = [4, 6, 8, 10, 12, 20];
    var die = Math.max(4, Number(current || 6));
    var idx = chain.indexOf(die);
    if (idx < 0) idx = 1;
    var next = Math.max(0, Math.min(chain.length - 1, idx + Number(delta || 0)));
    return chain[next];
  }

  function getSeaSkirmishEffectiveDread(army) {
    if (!army || typeof army !== 'object') return 6;
    var shift = Number(army.tempDreadShift || 0);
    return stepSeaSkirmishDreadDie(Number(army.dread || 6), shift);
  }

  function getSeaSkirmishDreadShiftLabel(army) {
    if (!army || !army.tempDreadShift) return '';
    return Number(army.tempDreadShift) > 0
      ? ' (next roll +1 step from Parry)'
      : ' (next roll -1 step from Frighten)';
  }

  function renderSeaSkirmishControls(col, row) {
    var hex = seaHexByCoord(col, row);
    if (!hex || !hex.pendingSeaSkirmish || !hex.pendingSeaSkirmish.joined) return '';
    var st = hex.pendingSeaSkirmish;
    var mineSide = st.joined === 'B' ? 'B' : 'A';
    var oppSide = mineSide === 'A' ? 'B' : 'A';
    var mine = mineSide === 'A' ? st.armyA : st.armyB;
    var opp = mineSide === 'A' ? st.armyB : st.armyA;
    var mineName = mineSide === 'A' ? st.sideA : st.sideB;
    var oppName = oppSide === 'A' ? st.sideA : st.sideB;
    var lockInfo = getSeaSkirmishLockState(st);
    return ''
      + '<div class="wtw-card" style="padding:.35rem;margin-top:.32rem;">'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.2rem;">Round ' + (st.round || 1) + ' · Actions reset together at 0/0.</div>'
      + '<div style="font-size:.72rem;color:' + lockInfo.tone + ';margin-bottom:.28rem;font-weight:600;">' + lockInfo.text + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;">'
      + '<div>'
      + '<div style="font-size:.74rem;color:var(--text2);">Your Side: <strong style="color:var(--teal);">' + sanitizeInlineText(mineName) + '</strong></div>'
      + '<div style="font-size:.74rem;color:var(--text2);">Stress: <strong style="color:var(--teal);">' + Number(mine.stress || 0) + '</strong></div>'
      + '<div style="font-size:.72rem;color:var(--muted2);">Actions: ' + Number(mine.actions || 0) + ' · Dread: d' + Number(getSeaSkirmishEffectiveDread(mine) || 6) + getSeaSkirmishDreadShiftLabel(mine) + '</div>'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-top:.2rem;">'
      + '<button class="btn btn-xs btn-primary" onclick="seaSkirmishAction(' + col + ',' + row + ',\'' + mineSide + '\',\'strike\')">Strike</button>'
      + '<button class="btn btn-xs btn-teal" onclick="seaSkirmishAction(' + col + ',' + row + ',\'' + mineSide + '\',\'parry\')">Parry</button>'
      + '<button class="btn btn-xs" onclick="seaSkirmishAction(' + col + ',' + row + ',\'' + mineSide + '\',\'frighten\')">Frighten</button>'
      + '</div>'
      + '</div>'
      + '<div>'
      + '<div style="font-size:.74rem;color:var(--text2);">Enemy: <strong style="color:var(--red2);">' + sanitizeInlineText(oppName) + '</strong></div>'
      + '<div style="font-size:.74rem;color:var(--text2);">Stress: <strong style="color:var(--red2);">' + Number(opp.stress || 0) + '</strong></div>'
      + '<div style="font-size:.72rem;color:var(--muted2);">Actions: ' + Number(opp.actions || 0) + ' · Dread: d' + Number(getSeaSkirmishEffectiveDread(opp) || 6) + getSeaSkirmishDreadShiftLabel(opp) + '</div>'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-top:.2rem;">'
      + '<button class="btn btn-xs btn-red" onclick="seaSkirmishAction(' + col + ',' + row + ',\'' + oppSide + '\',\'strike\')">Strike</button>'
      + '<button class="btn btn-xs" onclick="seaSkirmishAction(' + col + ',' + row + ',\'' + oppSide + '\',\'parry\')">Parry</button>'
      + '<button class="btn btn-xs" onclick="seaSkirmishAction(' + col + ',' + row + ',\'' + oppSide + '\',\'frighten\')">Frighten</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-success" onclick="resolveSeaSkirmishOutcome(' + col + ',' + row + ',true)">✓ Lock Win</button>'
      + '<button class="btn btn-xs btn-red" onclick="resolveSeaSkirmishOutcome(' + col + ',' + row + ',false)">✗ Lock Loss</button>'
      + '</div>'
      + '</div>';
  }

  function joinSeaSkirmishSide(col, row, side) {
    var hex = seaHexByCoord(col, row);
    if (!hex || !hex.pendingSeaSkirmish) return;
    var state = hex.pendingSeaSkirmish;
    var ctx = getCampaignActorContext();
    if (ctx.token && state.commanderToken && state.commanderToken !== ctx.token && ctx.role !== 'gm' && isCampaignTokenOnline(ctx, state.commanderToken)) {
      showNotif('Only the current commander (or GM) can change skirmish side.', 'warn');
      return;
    }
    state.joined = side === 'B' ? 'B' : 'A';
    if (ctx.token) {
      state.commanderToken = ctx.token;
      state.commanderName = getCampaignMemberLabelByToken(ctx, ctx.token);
    }
    var itemFlags = getSeaNarrativeItemFlags();
    var bonusNotes = [];
    if (!state.rewarded && typeof changeCounter === 'function') {
      changeCounter('renown', 1);
      if (itemFlags.factionItem) {
        changeCounter('renown', 1);
        bonusNotes.push('Faction token influence +1 Renown');
      }
      state.rewarded = true;
    }
    var ally = state.joined === 'A' ? state.sideA : state.sideB;
    var totalHp = getCampaignWayfarerHealthTotal();
    var joinedArmy = state.joined === 'A' ? state.armyA : state.armyB;
    joinedArmy.stress = Math.max(0, Number(joinedArmy.stress || 0) + totalHp);
    hex.resultHtml = `<div class="sea-result-title">Sea Skirmish - Joined ${ally}</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You gain +1 Renown for choosing a side. Added total Wayfarer Health (${totalHp}) to ${ally} Stress. Run the skirmish controls here and lock the result below.</div>${seaNarrativeBonusLine(bonusNotes)}${renderSeaSkirmishControls(col,row)}`;
    renderLastSeaInfo(hex);
    showNotif('Skirmish side chosen: ' + ally + '.', 'good');
  }

  function seaSkirmishAction(col, row, side, action) {
    var hex = seaHexByCoord(col, row);
    if (!hex || !hex.pendingSeaSkirmish || !hex.pendingSeaSkirmish.joined) return;
    var st = hex.pendingSeaSkirmish;
    if (!canControlSeaSkirmish(st)) {
      showNotif('Skirmish controls are locked to the active commander (or GM).', 'warn');
      return;
    }
    var mine = side === 'A' ? st.armyA : st.armyB;
    var opp = side === 'A' ? st.armyB : st.armyA;
    if (!mine || !opp) return;
    if (typeof mine.actions !== 'number') mine.actions = 2;
    if (typeof opp.actions !== 'number') opp.actions = 2;
    if (typeof mine.tempDreadShift !== 'number') mine.tempDreadShift = 0;
    if (typeof opp.tempDreadShift !== 'number') opp.tempDreadShift = 0;
    if (mine.actions <= 0) {
      showNotif('No actions left for that side.', 'warn');
      return;
    }

    mine.actions -= 1;
    var rollVal = roll(12);
    var consumedShift = Number(mine.tempDreadShift || 0);
    var dread = Number(getSeaSkirmishEffectiveDread(mine) || 6);
    var note = '';
    if (action === 'strike' && rollVal >= dread) {
      opp.stress = Math.max(0, Number(opp.stress || 0) - Math.max(1, rollVal - dread));
      note = 'Strike landed.';
    } else if (action === 'parry' && rollVal >= dread) {
      mine.tempDreadShift = 1;
      note = 'Parry held: next ' + (side === 'A' ? st.sideA : st.sideB) + ' roll uses +1 Dread step.';
    } else if (action === 'frighten' && roll(12) >= dread) {
      opp.stress = Math.max(0, Number(opp.stress || 0) - 1);
      opp.tempDreadShift = -1;
      note = 'Frighten landed: next ' + (side === 'A' ? st.sideB : st.sideA) + ' roll uses -1 Dread step.';
    } else {
      note = capitalize(String(action || 'action')) + ' missed.';
    }

    if (consumedShift !== 0) mine.tempDreadShift = 0;
    if (note && typeof showNotif === 'function') showNotif(note, note.indexOf('missed') >= 0 ? 'warn' : 'good');

    if ((st.armyA.actions || 0) <= 0 && (st.armyB.actions || 0) <= 0) {
      st.round = Number(st.round || 1) + 1;
      st.armyA.actions = 2;
      st.armyB.actions = 2;
      st.armyA.tempDreadShift = 0;
      st.armyB.tempDreadShift = 0;
    }

    if ((st.armyA.stress || 0) <= 0 || (st.armyB.stress || 0) <= 0) {
      var mineSide = st.joined === 'B' ? 'B' : 'A';
      var myArmy = mineSide === 'A' ? st.armyA : st.armyB;
      var oppArmy = mineSide === 'A' ? st.armyB : st.armyA;
      resolveSeaSkirmishOutcome(col, row, Number(myArmy.stress || 0) > Number(oppArmy.stress || 0));
      return;
    }

    var ally = st.joined === 'A' ? st.sideA : st.sideB;
    hex.resultHtml = `<div class="sea-result-title">Sea Skirmish - Joined ${ally}</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Run the skirmish controls here and lock result when ready.</div>${renderSeaSkirmishControls(col,row)}`;
    renderLastSeaInfo(hex);
  }

  function resolveSeaSkirmishOutcome(col, row, success) {
    var hex = seaHexByCoord(col, row);
    if (!hex || !hex.pendingSeaSkirmish) return;
    if (!canControlSeaSkirmish(hex.pendingSeaSkirmish)) {
      showNotif('Only the active commander (or GM) can lock skirmish outcome.', 'warn');
      return;
    }
    if (success) {
      S.credits = (S.credits || 0) + 60;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      hex.resultHtml = '<div class="sea-result-title">Sea Skirmish Won</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Your side secures the lane. +60 credits.</div>';
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      showNotif('Sea skirmish victory.', 'good');
    } else {
      ensureMentalStress(1);
      hex.resultHtml = '<div class="sea-result-title">Sea Skirmish Lost</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Your side breaks formation. +1 Mental Stress.</div>';
      if (typeof addTMWOnFail === 'function') addTMWOnFail();
      showNotif('Sea skirmish defeat.', 'warn');
    }
    hex.pendingSeaSkirmish = null;
    renderLastSeaInfo(hex);
  }

  function resolveOpenSeaPerilCheck(col, row, perilName, dd) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    var die = (typeof getEffectiveDie === 'function') ? getEffectiveDie('control') : ((S.stats && S.stats.control) || 4);
    var dreadDie = Math.max(1, Number(dd || 6));
    var finalizePeril = function(success, checkLine) {
      var diff = success ? 0 : 1;
      if (diff) ensureMentalStress(diff);
      hex.resultHtml = `<div class="sea-result-title">Peril - ${sanitizeInlineText(perilName || 'Open Sea Hazard')}</div><div style="font-size:.82rem;color:${success?'var(--green2)':'var(--red2)'};line-height:1.55;font-weight:700;">${success?'PASS':'FAIL'}</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">${checkLine} ${success ? 'You hold course through the hazard.' : '+' + diff + ' Mental Stress from the stormfront impact.'}</div>`;
      renderLastSeaInfo(hex);
      showNotif(success ? 'Peril check passed.' : 'Peril hit the crew.', success ? 'good' : 'warn');
    };

    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Open Sea Peril',
        context: String(perilName || 'Open Sea Hazard'),
        statKey: 'control',
        statLabel: 'Control',
        actionDie: die,
        dreadDie: dreadDie,
        onResolve: function(outcome) {
          var usedDd = Number((outcome && outcome.dreadDie) || dreadDie);
          finalizePeril(!!(outcome && outcome.success), 'Control d' + die + ' vs DD' + usedDd + ' (manual' + (outcome && outcome.pushLuck ? ', Push Luck' : '') + ').');
        }
      });
      return;
    }

    var controlRoll = explodingRoll(die).total;
    var dreadRoll = explodingRoll(dreadDie).total;
    var success = controlRoll >= dreadRoll;
    var diff = success ? 0 : Math.max(1, dreadRoll - controlRoll);
    if (diff) ensureMentalStress(diff);
    hex.resultHtml = `<div class="sea-result-title">Peril - ${sanitizeInlineText(perilName || 'Open Sea Hazard')}</div><div style="font-size:.82rem;color:${success?'var(--green2)':'var(--red2)'};line-height:1.55;font-weight:700;">${success?'PASS':'FAIL'}</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Control d${die}=${controlRoll} vs DD${dreadDie}=${dreadRoll}. ${success ? 'You hold course through the hazard.' : '+' + diff + ' Mental Stress from the stormfront impact.'}</div>`;
    renderLastSeaInfo(hex);
    showNotif(success ? 'Peril check passed.' : 'Peril hit the crew.', success ? 'good' : 'warn');
  }

  function concludeSeaEncounter(message, tone) {
    const msg = message || 'Action resolved.';
    if (msg) showNotif(msg, tone || 'good');
    const hexKey = S.lastSea && (S.lastSea.activeEncounterKey || S.lastSea.selectedKey);
    if (hexKey && S.lastSea && S.lastSea.map) {
      const hex = S.lastSea.map.find(h => h.key === hexKey);
      if (hex) {
        hex.resultHtml = `<div class="sea-result-title">Encounter Resolved</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">${msg}</div>`;
      }
    }
    if (S.lastSea) S.lastSea.activeEncounterKey = null;
    renderLastSeaInfo();
  }

  function ensureSeaDerelictHexcrawl(hex, options) {
    if (!hex) return null;
    if (!hex.derelictHexcrawl || !Array.isArray(hex.derelictHexcrawl.nodes) || !hex.derelictHexcrawl.nodes.length) {
      const vampCount = Math.max(1, Number(options && options.vampires || 1));
      const credits = Math.max(20, Number(options && options.salvageCredits || 60));
      const item = String(options && options.salvageItem || 'Strange Relic');
      hex.derelictHexcrawl = {
        vampires: vampCount,
        salvageCredits: credits,
        salvageItem: item,
        nodes: [
          { id: 'airlock', label: 'Airlock', kind: 'hazard', explored: false, dd: 6 },
          { id: 'cargo', label: 'Cargo Spine', kind: 'salvage', explored: false, dd: 8 },
          { id: 'quarters', label: 'Crew Quarters', kind: 'lore', explored: false, dd: 6 },
          { id: 'medbay', label: 'Medbay Pods', kind: 'cache', explored: false, dd: 6 },
          { id: 'reactor', label: 'Reactor Crawlspace', kind: 'hazard', explored: false, dd: 8 },
          { id: 'armory', label: 'Sealed Armory', kind: 'salvage', explored: false, dd: 10 },
          { id: 'bridge', label: 'Bridge Console', kind: 'task', explored: false, dd: 8 },
          { id: 'chapel', label: 'Silent Chapel', kind: 'lore', explored: false, dd: 8 },
          { id: 'nest', label: 'Dark Nest', kind: 'vampire', explored: false, dd: 10 }
        ]
      };
    }
    return hex.derelictHexcrawl;
  }

  function buildSeaDerelictHexcrawlModal(col, row) {
    const hex = seaHexByCoord(col, row);
    const crawl = ensureSeaDerelictHexcrawl(hex, null);
    if (!hex || !crawl) return '<div style="font-size:.82rem;color:var(--muted2);">Derelict drifted out of range.</div>';
    const grid = crawl.nodes.map(function (node) {
      const state = node.explored ? 'Cleared' : 'Unexplored';
      const color = node.explored ? 'var(--green2)' : 'var(--muted2)';
      const btn = node.explored
        ? '<span style="font-size:.68rem;color:var(--muted2);">Resolved</span>'
        : '<button class="btn btn-xs btn-primary" onclick="resolveSeaDerelictHexNode(' + Number(col) + ',' + Number(row) + ',\'' + String(node.id) + '\')">Explore</button>';
      return '<div style="border:1px solid var(--border2);background:var(--surface);padding:.3rem .35rem;">'
        + '<div style="font-size:.68rem;color:var(--gold2);">' + sanitizeInlineText(node.label) + '</div>'
        + '<div style="font-size:.68rem;color:' + color + ';margin-top:.12rem;">' + state + '</div>'
        + '<div style="margin-top:.2rem;">' + btn + '</div>'
        + '</div>';
    }).join('');
    return '<div style="font-size:.82rem;color:var(--text2);line-height:1.55;">Boarding map: search each hex section for salvage, clues, and threats.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.28rem;margin-top:.4rem;">' + grid + '</div>';
  }

  function openSeaDerelictHexcrawl(vampires, salvageCredits, salvageItem) {
    if (!S || !S.lastSea || !S.lastSea.activeEncounterKey) {
      if (typeof showNotif === 'function') showNotif('Select a sea hex encounter first.', 'warn');
      return;
    }
    const hex = S.lastSea.map.find(function (entry) { return entry && entry.key === S.lastSea.activeEncounterKey; });
    if (!hex) return;
    ensureSeaDerelictHexcrawl(hex, {
      vampires: vampires,
      salvageCredits: salvageCredits,
      salvageItem: salvageItem
    });
    openModal('Derelict Ship Hexcrawl', buildSeaDerelictHexcrawlModal(hex.col, hex.row));
  }
  window.openSeaDerelictHexcrawl = openSeaDerelictHexcrawl;

  function resolveSeaDerelictHexNode(col, row, nodeId) {
    const hex = seaHexByCoord(col, row);
    const crawl = ensureSeaDerelictHexcrawl(hex, null);
    if (!hex || !crawl) return;
    const node = crawl.nodes.find(function (entry) { return String(entry.id) === String(nodeId); });
    if (!node || node.explored) return;
    node.explored = true;
    const ad = (typeof getEffectiveDie === 'function') ? getEffectiveDie('control') : ((S && S.stats && S.stats.control) || 4);
    var resolveNode = function(success, checkLine, failedBy) {
      var line = checkLine + ' ';
      if (success) {
        if (node.kind === 'salvage') {
          const gain = Math.max(10, Number(crawl.salvageCredits || 40));
          if (typeof resolveSeaEncounter === 'function') resolveSeaEncounter('salvage', String(crawl.salvageItem || 'Derelict Salvage'), { credits: gain, item: String(crawl.salvageItem || 'Derelict Salvage') });
          line += 'Salvage secured.';
        } else if (node.kind === 'cache') {
          if (typeof changeCounter === 'function') changeCounter('rations', 1);
          if (typeof changeCounter === 'function') changeCounter('tmw', 1);
          line += 'Emergency stores recovered. +1 Rations, +1 Teamwork.';
        } else if (node.kind === 'task') {
          if (typeof changeCounter === 'function') changeCounter('tmw', 1);
          line += 'Ship logs decrypted. +1 Teamwork.';
        } else if (node.kind === 'lore') {
          if (typeof window.tryAwardLoreBookDrop === 'function') window.tryAwardLoreBookDrop('derelict ship', 22);
          line += 'Recovered lore fragments.';
        } else if (node.kind === 'vampire') {
          seedSeaEncounterCombat('Derelict Vampire', Math.max(1, Number(crawl.vampires || 1)), 10, 14);
          line += 'Vampire nest stirred. Combat seeded.';
        } else {
          line += 'Hazard bypassed cleanly.';
        }
      } else {
        var failureMargin = Math.max(1, Number(failedBy || 1));
        if (typeof changeMentalStress === 'function') changeMentalStress(failureMargin);
        line += 'You take +' + failureMargin + ' Mental Stress.';
      }
      if (typeof showNotif === 'function') showNotif(line, success ? 'good' : 'warn');
      openModal('Derelict Ship Hexcrawl', buildSeaDerelictHexcrawlModal(col, row));
      renderLastSeaInfo(hex);
    };

    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Derelict Node',
        context: String(node.label || 'Derelict Node'),
        statKey: 'control',
        statLabel: 'Control',
        actionDie: ad,
        dreadDie: Number(node.dd || 8),
        onResolve: function(outcome) {
          var usedDd = Number((outcome && outcome.dreadDie) || Number(node.dd || 8));
          resolveNode(!!(outcome && outcome.success), 'Control d' + ad + ' vs DD' + usedDd + ' (manual' + (outcome && outcome.pushLuck ? ', Push Luck' : '') + ').', Math.max(1, Number((outcome && outcome.dreadTotal) || usedDd) - Number((outcome && outcome.actionTotal) || 0)));
        }
      });
      return;
    }

    const action = explodingRoll(ad, { type: 'action', label: 'Derelict Crawl' });
    const dread = explodingRoll(Number(node.dd || 8), { type: 'dread', label: 'Derelict Threat' });
    resolveNode(action.total >= dread.total, 'Control d' + ad + ' ' + action.total + ' vs DD' + Number(node.dd || 8) + ' ' + dread.total + '.', Math.max(1, dread.total - action.total));
  }
  window.resolveSeaDerelictHexNode = resolveSeaDerelictHexNode;

  function buildSeaEncounter() {
    var itemFlags = getSeaNarrativeItemFlags();
    var compassHint = itemFlags.compass ? ' (+Compass)' : '';
    var factionHint = itemFlags.factionItem ? ' (+Faction bonus)' : '';
    var fleeTitle = itemFlags.compass ? 'Compass grants +2 to Control flee checks.' : '';
    var negotiateTitle = itemFlags.factionItem ? 'Faction credentials can reduce negotiation cost.' : '';
    var salvageTitle = itemFlags.compass ? 'Compass can reveal extra salvage value.' : '';
    var rescueTitle = itemFlags.factionItem ? 'Faction token can grant bonus renown on rescue.' : '';
    var shipCombatTitle = (itemFlags.compass || itemFlags.factionItem) ? 'Victory can gain extra credits/renown from carried narrative items.' : '';
    const rolled = roll(8);
    let desc = '', actions = '';
    if (rolled === 1) {
      const ships = roll(4);
      desc = `${ships} pirate ship${ships > 1 ? "s" : ""} hunt the lane. DD8 | 16 HP each.`;
      const fleeStress = roll(6);
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('fight','${ships} pirates',{mentalStress:${ships*2},requireOutcome:true,dread:8})">⚔ Fight (+${ships*2} Mental Stress)</button>
        <button class="btn btn-xs btn-warn" title="${shipCombatTitle}" onclick="startSeaShipCombatEncounter()">🚢 Start Ship Combat${compassHint}${factionHint}</button>
        <button class="btn btn-xs btn-teal" title="${fleeTitle}" onclick="resolveSeaEncounter('flee','Pirates',{mentalStress:${fleeStress},controlRoll:true,dread:8,requireFightOnFail:true})">🏃 Flee (Control vs DD8${compassHint})</button>
        <button class="btn btn-xs btn-gold" onclick="resolveSeaEncounter('tribute','Pirates',{cost:50})">🪙 Pay Tribute (−50₵)</button>
        <button class="btn btn-xs btn-gold" title="${negotiateTitle}" onclick="resolveSeaEncounter('negotiate','Pirates',{cost:50})">💬 Negotiate (−50₵${factionHint})</button>
      </div>`;
      return `<div class="sea-result-title">Open Sea Encounter - Pirate Ships</div>${desc}${actions}`;
    }
    if (rolled === 2) {
      desc = `A trading ship drifts nearby — goods and rumors available.`;
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-secondary" onclick="resolveSeaEncounter('trade','Trading Ship',{})">📦 Open Merchants</button>
        <button class="btn btn-xs btn-teal" onclick="resolveSeaEncounter('ignore','Trading Ship',{})">⛵ Sail On</button>
      </div>`;
      return `<div class="sea-result-title">Open Sea Encounter - Trading Ship</div>${desc}${actions}`;
    }
    if (rolled === 3) {
      desc = `The Great Serpent rises with ruined ships lashed across its spiny back. DD12 | 24 HP.`;
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('fight','Great Serpent',{mentalStress:12,requireOutcome:true,dread:12})">⚔ Engage (+12 Mental Stress)</button>
        <button class="btn btn-xs btn-red" title="${fleeTitle}" onclick="resolveSeaEncounter('flee','Great Serpent',{mentalStress:6,controlRoll:true,dread:12,requireFightOnFail:true})">🏃 Flee (Control vs DD12${compassHint})</button>
        <button class="btn btn-xs btn-gold" title="${negotiateTitle}" onclick="resolveSeaEncounter('negotiate','Great Serpent',{})">💬 Negotiate Retreat${factionHint}</button>
      </div>`;
      return `<div class="sea-result-title">Open Sea Encounter - The Great Serpent</div>${desc}${actions}`;
    }
    if (rolled === 4) {
      const crew = roll(6);
      desc = `${crew} crew cling to a sinking skiff and beg for passage to the next Province.`;
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-teal" title="${rescueTitle}" onclick="resolveSeaEncounter('rescue','${crew} Castaways',{renown:1})">🆘 Rescue (+1 Renown${factionHint})</button>
        <button class="btn btn-xs btn-red" onclick="resolveSeaEncounter('ignore','Sinking Skiff',{})">⛵ Leave Them</button>
      </div>`;
      return `<div class="sea-result-title">Open Sea Encounter - Sinking Skiff</div>${desc}${actions}`;
    }
    if (rolled === 5) {
      const salvagePools = ['items', 'essentials', 'toolkits', 'scrolls', 'remedies'];
      const salvagePool = pick(salvagePools);
      const salvageList = (SHOP_DATA && SHOP_DATA[salvagePool]) || [];
      const salvageItem = salvageList.length
        ? String((pick(salvageList) || {}).name || 'Strange Relic')
        : 'Strange Relic';
      const salvageItemJs = salvageItem.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const loot = roll(6);
      const vampires = roll(3);
      const lootText = loot === 6 ? `1 Strange Item (${salvageItem})` : `${loot} random item${loot > 1 ? "s" : ""}`;
      const salvageCredits = loot * 25;
      const vampStress = vampires * 4;
      desc = `An empty transport floats half-derelict. Salvage: ${lootText}. Hidden aboard: ${vampires} vampire${vampires > 1 ? "s" : ""}.`;
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-secondary" title="${salvageTitle}" onclick="resolveSeaEncounter('salvage','${lootText}',{credits:${salvageCredits},item:'${salvageItemJs}'})">🪙 Salvage (+${salvageCredits}₵${compassHint})</button>
        <button class="btn btn-xs btn-teal" onclick="openSeaDerelictHexcrawl(${vampires},${salvageCredits},'${salvageItemJs}')">🧭 Board Derelict Hexcrawl</button>
        <button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('fight','${vampires} Vampires',{stress:${vampStress},requireOutcome:true,dread:10,enemyCount:${vampires},enemyHealth:14,vampireEncounter:true,vampireCount:${vampires},vampireDread:10})">⚔ Fight Vampires (+${vampStress} Stress)</button>
        <button class="btn btn-xs btn-red" onclick="resolveSeaEncounter('avoid','Empty Transport',{})">⛵ Avoid</button>
      </div>`;
      return `<div class="sea-result-title">Open Sea Encounter - Empty Transport</div>${desc}${actions}`;
    }
    if (rolled === 6) {
      const armadaTask = buildRoyalArmadaText();
      desc = `A Royal Armada patrol demands answers. Mission: <strong style="color:var(--gold2);">${armadaTask}</strong>.`;
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-gold" onclick="resolveSeaEncounter('accept','Royal Armada',{task:'${armadaTask.replace(/'/g, "&#39;")}',reward:{renown:1}})">📜 Accept Mission</button>
        <button class="btn btn-xs btn-teal" title="${negotiateTitle}" onclick="resolveSeaEncounter('negotiate','Royal Patrol',{cost:30})">💬 Negotiate (−30₵${factionHint})</button>
        <button class="btn btn-xs btn-warn" onclick="resolveSeaEncounter('resist','Royal Armada',{stress:8})">⚔ Resist (+8 Stress)</button>
      </div>`;
      return `<div class="sea-result-title">Open Sea Encounter - Royal Armada</div>${desc}${actions}`;
    }

    if (rolled === 7) {
      desc = `A shipboard crisis erupts: a crew feud over a sealed locker turns violent in the lower deck.`;
      actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
        <button class="btn btn-xs btn-teal" onclick="resolveSeaEncounter('crewCalm','Crew Feud',{stat:'lead',dd:8})">🗣 Calm Crew (Lead vs DD8)</button>
        <button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('crewInvestigate','Sealed Locker',{stat:'mind',dd:8})">🔍 Investigate Locker (Mind vs DD8)</button>
        <button class="btn btn-xs btn-warn" onclick="resolveSeaEncounter('crewQuarantine','Lower Deck',{mentalStress:1})">🔒 Quarantine Deck (+1 Mental Stress)</button>
      </div>`;
      return `<div class="sea-result-title">Shipboard Event - Crew Crisis</div>${desc}${actions}`;
    }

    desc = `At midnight, the cargo hold log writes itself. A crew voice is heard from a room that has been empty for weeks.`;
    actions = `<div style="margin-top:.3rem;display:flex;gap:.2rem;flex-wrap:wrap;">
      <button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('crewInvestigate','Ghost Hold',{stat:'spirit',dd:10})">🕯 Investigate Presence (Spirit vs DD10)</button>
      <button class="btn btn-xs btn-teal" onclick="resolveSeaEncounter('crewCalm','Anxious Crew',{stat:'lead',dd:8})">🧭 Brief The Crew (Lead vs DD8)</button>
      <button class="btn btn-xs btn-red" onclick="resolveSeaEncounter('avoid','Whispering Hold',{mentalStress:2})">🚪 Seal Hold (+2 Mental Stress)</button>
    </div>`;
    return `<div class="sea-result-title">Shipboard Event - Whispering Hold</div>${desc}${actions}`;
  }

  function resolveSeaEncounter(action, target, effects) {
    effects = effects || {};
    let msg = '';
    const itemFlags = getSeaNarrativeItemFlags();
    const bonusNotes = [];
    const addMentalStress = function(amount) {
      const val = Math.max(0, Number(amount) || 0);
      if (!val) return;
      if (typeof changeMentalStress === 'function') {
        changeMentalStress(val);
        return;
      }
      S.mentalStress = (S.mentalStress || 0) + val;
      if (typeof updateMentalStressUI === 'function') updateMentalStressUI();
    };

    if (action === 'fightOutcome') {
      const won = !!effects.won;
      if (won) {
        const targetText = String(target || '').toLowerCase();
        const isVampireFight = !!effects.vampireEncounter || targetText.indexOf('vampire') >= 0;
        if (isVampireFight && typeof S !== 'undefined' && S) {
          const spiritDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('spirit') : ((S.stats && S.stats.spirit) || 4);
          const dreadDie = Math.max(6, Number(effects.vampireDread || effects.dread || 10));
          const spiritRoll = (typeof explodingRoll === 'function') ? explodingRoll(spiritDie) : { total: Math.floor(Math.random() * spiritDie) + 1 };
          const dreadRoll = (typeof explodingRoll === 'function') ? explodingRoll(dreadDie) : { total: Math.floor(Math.random() * dreadDie) + 1 };
          if (Number(spiritRoll.total || 0) < Number(dreadRoll.total || 0)) {
            if (typeof ensureDarkAfflictionState === 'function') {
              try { ensureDarkAfflictionState(); } catch (_err) { console.error(_err); }
            }
            S.darkAfflictions = S.darkAfflictions || {};
            S.darkAfflictions.vampirism = S.darkAfflictions.vampirism || { active: false, corruption: 0, lastFedStamp: '' };
            S.darkAfflictions.vampirism.active = true;
            S.darkAfflictions.vampirism.corruption = Math.min(10, Math.max(1, Number(S.darkAfflictions.vampirism.corruption || 0) + 1));
            if (typeof renderDarkAfflictionSheetPanel === 'function') {
              try { renderDarkAfflictionSheetPanel(); } catch (_err) { console.error(_err); }
            }
            if (typeof showNotif === 'function') {
              showNotif('Vampire bite took hold (Spirit d' + spiritDie + ' ' + spiritRoll.total + ' vs Dread d' + dreadDie + ' ' + dreadRoll.total + '). Vampirism awakened.', 'warn');
            }
          } else if (typeof showNotif === 'function') {
            showNotif('You resisted the vampire bite (Spirit d' + spiritDie + ' ' + spiritRoll.total + ' vs Dread d' + dreadDie + ' ' + dreadRoll.total + ').', 'good');
          }
        }
        concludeSeaEncounter(`You defeated ${target}. Encounter resolved.`, 'good');
      } else {
        concludeSeaEncounter(`Combat with ${target} ended in failure. Encounter resolved as failed.`, 'warn');
      }
      return;
    }

    if (action === 'trade') {
      const shopBtn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('shop'\"]");
      if (shopBtn) switchTab('shop', shopBtn);
      msg = 'Trading with ' + target + ' — browse the Merchants tab.';
    }

    if (action === 'fight') {
      const stressApplied = effects.mentalStress != null ? effects.mentalStress : (effects.stress || 0);
      if (stressApplied) { addMentalStress(stressApplied); }
      if (effects.requireOutcome) {
        var encounterDread = Number(effects.dread || 8);
        var encounterCount = Number(effects.enemyCount || ((String(target).toLowerCase().indexOf('serpent') >= 0) ? 1 : 2));
        var encounterHp = Number(effects.enemyHealth || ((String(target).toLowerCase().indexOf('serpent') >= 0) ? 24 : (encounterDread * 2)));
        seedSeaEncounterCombat(String(target), encounterCount, encounterDread, encounterHp);
        const hexKey = S.lastSea && S.lastSea.selectedKey;
        if (hexKey && S.lastSea && S.lastSea.map) {
          const hex = S.lastSea.map.find(h => h.key === hexKey);
          if (hex) {
            hex.resultHtml = `<div class="sea-result-title">Combat Outcome</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You engage ${target}. +${stressApplied || 0} Mental Stress applied. Enemies were added to Combat and Quick Access. Choose outcome to resolve encounter.</div><div style="margin-top:.35rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-warn" onclick="if(typeof switchTab==='function'){const b=document.querySelector(\"#mainNav .tab-btn[onclick*=\\\"switchTab('combat'\\\"]\");switchTab('combat',b||null);}if(typeof openQuickPanelTab==='function'){openQuickPanelTab('combat');}">Open Combat + Quick Access</button><button class="btn btn-xs btn-success" onclick="resolveSeaEncounter('fightOutcome','${String(target).replace(/'/g, "&#39;")}',{won:true})">✓ Victory</button><button class="btn btn-xs btn-red" onclick="resolveSeaEncounter('fightOutcome','${String(target).replace(/'/g, "&#39;")}',{won:false})">✗ Defeat</button></div>`;
          }
        }
        renderLastSeaInfo();
        showNotif(`Engaged ${target}. Choose combat outcome to resolve.`, 'warn');
        return;
      }
      msg = `Engaged ${target} in combat! +${stressApplied||0} Mental Stress applied.`;
    } else if (action === 'flee') {
      if (effects.controlRoll) {
        const controlDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('control') : ((S.stats && S.stats.control) || 4);
        const dreadDie = effects.dread || 8;
        if (isSeaManualRollMode()) {
          openSeaManualActionDreadPrompt({
            title: 'Manual Roll - Flee Encounter',
            context: 'Flee from ' + String(target || 'threat'),
            statKey: 'control',
            statLabel: 'Control',
            actionDie: controlDie,
            dreadDie: dreadDie,
            onResolve: function(outcome) {
              var success = !!(outcome && outcome.success);
              if (!success && effects.requireFightOnFail) {
                const failStress = Math.max(1, effects.mentalStress || 1);
                addMentalStress(failStress);
                const escapedTarget = String(target).replace(/'/g, "&#39;");
                const hexKey = S.lastSea && S.lastSea.selectedKey;
                if (hexKey && S.lastSea && S.lastSea.map) {
                  const hex = S.lastSea.map.find(h => h.key === hexKey);
                  if (hex) {
                    hex.resultHtml = `<div class="sea-result-title">Flee Failed</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Control d${controlDie} vs Dread d${Number((outcome && outcome.dreadDie) || dreadDie)} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}). You fail to escape and take +${failStress} Mental Stress. You must fight ${target}.</div><div style="margin-top:.35rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('fight','${escapedTarget}',{mentalStress:${failStress},requireOutcome:true,dread:${Number((outcome && outcome.dreadDie) || dreadDie)}})">⚔ Fight ${target}</button><button class="btn btn-xs btn-gold" onclick="resolveSeaEncounter('negotiate','${escapedTarget}',{})">💬 Negotiate</button></div>`;
                  }
                }
                renderLastSeaInfo();
                showNotif(`Flee failed against ${target}. You must fight.`, 'warn');
                return;
              }
              msg = `Escaped ${target}. Control d${controlDie} vs Dread d${Number((outcome && outcome.dreadDie) || dreadDie)} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}).`;
              if (bonusNotes.length) msg += ' [' + bonusNotes.join(' | ') + ']';
              concludeSeaEncounter(msg || 'Action resolved.', 'good');
            }
          });
          return;
        }
        const actionRoll = explodingRoll(controlDie);
        if (itemFlags.compass) {
          actionRoll.total += 2;
          bonusNotes.push('Compass +2 Control');
        }
        const dreadRoll = explodingRoll(dreadDie);
        const success = actionRoll.total >= dreadRoll.total;
        if (!success && effects.requireFightOnFail) {
          const failStress = Math.max(1, effects.mentalStress || (dreadRoll.total - actionRoll.total));
          addMentalStress(failStress);
          const escapedTarget = String(target).replace(/'/g, "&#39;");
          const hexKey = S.lastSea && S.lastSea.selectedKey;
          if (hexKey && S.lastSea && S.lastSea.map) {
            const hex = S.lastSea.map.find(h => h.key === hexKey);
            if (hex) {
              hex.resultHtml = `<div class="sea-result-title">Flee Failed</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Control d${controlDie}=${actionRoll.total} vs Dread d${dreadDie}=${dreadRoll.total}. You fail to escape and take +${failStress} Mental Stress. You must fight ${target}.</div><div style="margin-top:.35rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('fight','${escapedTarget}',{mentalStress:${failStress},requireOutcome:true,dread:${dreadDie}})">⚔ Fight ${target}</button><button class="btn btn-xs btn-gold" onclick="resolveSeaEncounter('negotiate','${escapedTarget}',{})">💬 Negotiate</button></div>`;
            }
          }
          renderLastSeaInfo();
          showNotif(`Flee failed against ${target}. You must fight.`, 'warn');
          return;
        }
        msg = `Escaped ${target}. Control d${controlDie}=${actionRoll.total} vs Dread d${dreadDie}=${dreadRoll.total}.`;
      } else {
        const stressApplied = effects.mentalStress != null ? effects.mentalStress : (effects.stress || 0);
        if (stressApplied) { addMentalStress(stressApplied); }
        msg = `Fled from ${target}! +${stressApplied||0} Mental Stress from the retreat.`;
      }
    } else if (action === 'tribute') {
      if (effects.cost && (S.credits||0) >= effects.cost) {
        S.credits = (S.credits||0) - effects.cost;
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        msg = `Paid tribute to ${target} (−${effects.cost}₵).`;
      } else if (effects.cost) {
        showNotif(`Not enough credits (need ${effects.cost}₵)`, 'warn'); return;
      } else {
        msg = `Paid tribute to ${target}.`;
      }
    } else if (action === 'negotiate') {
      var negotiationCost = effects.cost || 0;
      if (itemFlags.factionItem && negotiationCost > 0) {
        negotiationCost = Math.max(0, negotiationCost - 20);
        bonusNotes.push('Faction credentials reduce fee by 20₵');
      }
      if (negotiationCost && (S.credits||0) >= negotiationCost) {
        S.credits = (S.credits||0) - negotiationCost;
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        msg = `Negotiated with ${target} (−${negotiationCost}₵). You walk away without Mental Stress.`;
      } else if (negotiationCost) {
        showNotif(`Not enough credits (need ${negotiationCost}₵)`, 'warn'); return;
      } else { msg = `Negotiated with ${target}. You walk away without Mental Stress.`; }
    } else if (action === 'crewCalm') {
      var leadDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('lead') : ((S.stats && S.stats.lead) || 4);
      var calmDD = Math.max(4, Number(effects.dd || 8));
      if (isSeaManualRollMode()) {
        openSeaManualActionDreadPrompt({
          title: 'Manual Roll - Crew Calm',
          context: 'Crew Calm',
          statKey: 'lead',
          statLabel: 'Lead',
          actionDie: leadDie,
          dreadDie: calmDD,
          onResolve: function(outcome) {
            var calmSuccess = !!(outcome && outcome.success);
            if (calmSuccess) {
              if (typeof changeCounter === 'function') changeCounter('tmw', 1);
              msg = `Crew stabilized. Lead d${leadDie} vs DD${Number((outcome && outcome.dreadDie) || calmDD)} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}). +1 Teamwork.`;
            } else {
              var failedBy = Math.max(1, Number((outcome && outcome.dreadTotal) || calmDD) - Number((outcome && outcome.actionTotal) || 0));
              addMentalStress(failedBy);
              if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-crew-calm-fail', { failedBy: failedBy, actionDie: leadDie, dreadDie: calmDD });
              msg = `Crew panic escalated. Lead d${leadDie} vs DD${Number((outcome && outcome.dreadDie) || calmDD)} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}). +${failedBy} Mental Stress.`;
            }
            if (bonusNotes.length) msg += ' [' + bonusNotes.join(' | ') + ']';
            concludeSeaEncounter(msg || 'Action resolved.', 'good');
          }
        });
        return;
      }
      var calmRoll = explodingRoll(leadDie);
      var calmDread = explodingRoll(calmDD);
      var calmSuccess = calmRoll.total >= calmDread.total;
      if (calmSuccess) {
        if (typeof changeCounter === 'function') changeCounter('tmw', 1);
        msg = `Crew stabilized. Lead d${leadDie}=${calmRoll.total} vs DD${calmDD}=${calmDread.total}. +1 Teamwork.`;
      } else {
        var failedBy = Math.max(1, calmDread.total - calmRoll.total);
        addMentalStress(failedBy);
        if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-crew-calm-fail', { failedBy: failedBy, actionDie: leadDie, dreadDie: calmDD });
        msg = `Crew panic escalated. Lead d${leadDie}=${calmRoll.total} vs DD${calmDD}=${calmDread.total}. +${failedBy} Mental Stress.`;
      }
    } else if (action === 'crewInvestigate') {
      var statKey = String(effects.stat || 'mind').toLowerCase();
      var dieSize = (typeof getEffectiveDie === 'function') ? getEffectiveDie(statKey) : ((S.stats && S.stats[statKey]) || 4);
      var invDD = Math.max(4, Number(effects.dd || 8));
      if (isSeaManualRollMode()) {
        openSeaManualActionDreadPrompt({
          title: 'Manual Roll - Crew Investigate',
          context: 'Crew Investigate',
          statKey: statKey,
          statLabel: statKey.charAt(0).toUpperCase() + statKey.slice(1),
          actionDie: dieSize,
          dreadDie: invDD,
          onResolve: function(outcome) {
            var invSuccess = !!(outcome && outcome.success);
            if (invSuccess) {
              if (typeof addToBackpack === 'function') addToBackpack('Crew Log Cache');
              else if (Array.isArray(S.backpack)) {
                var idx = S.backpack.indexOf('');
                if (idx >= 0) S.backpack[idx] = 'Crew Log Cache';
              }
              if (typeof renderBackpackUI === 'function') renderBackpackUI();
              if (typeof addSuccessRoll === 'function') addSuccessRoll();
              msg = `Investigation succeeded: ${statKey} d${dieSize} vs DD${Number((outcome && outcome.dreadDie) || invDD)} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}). Found Crew Log Cache.`;
            } else {
              var failedBy = Math.max(1, Number((outcome && outcome.dreadTotal) || invDD) - Number((outcome && outcome.actionTotal) || 0));
              addMentalStress(failedBy);
              if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-crew-investigate-fail', { failedBy: failedBy, actionDie: dieSize, dreadDie: invDD });
              msg = `Investigation failed: ${statKey} d${dieSize} vs DD${Number((outcome && outcome.dreadDie) || invDD)} (manual${outcome && outcome.pushLuck ? ', Push Luck' : ''}). +${failedBy} Mental Stress.`;
            }
            if (bonusNotes.length) msg += ' [' + bonusNotes.join(' | ') + ']';
            concludeSeaEncounter(msg || 'Action resolved.', 'good');
          }
        });
        return;
      }
      var invRoll = explodingRoll(dieSize);
      var invDread = explodingRoll(invDD);
      var invSuccess = invRoll.total >= invDread.total;
      if (invSuccess) {
        if (typeof addToBackpack === 'function') addToBackpack('Crew Log Cache');
        else if (Array.isArray(S.backpack)) {
          var idx = S.backpack.indexOf('');
          if (idx >= 0) S.backpack[idx] = 'Crew Log Cache';
        }
        if (typeof renderBackpackUI === 'function') renderBackpackUI();
        if (typeof addSuccessRoll === 'function') addSuccessRoll();
        msg = `Investigation succeeded: ${statKey} d${dieSize}=${invRoll.total} vs DD${invDD}=${invDread.total}. Found Crew Log Cache.`;
      } else {
        var failedBy = Math.max(1, invDread.total - invRoll.total);
        addMentalStress(failedBy);
        if (typeof addTMWOnFail === 'function') addTMWOnFail('sea-crew-investigate-fail', { failedBy: failedBy, actionDie: dieSize, dreadDie: invDD });
        msg = `Investigation failed: ${statKey} d${dieSize}=${invRoll.total} vs DD${invDD}=${invDread.total}. +${failedBy} Mental Stress.`;
      }
    } else if (action === 'crewQuarantine') {
      var qStress = Math.max(0, Number(effects.mentalStress || 1));
      if (qStress) addMentalStress(qStress);
      if (typeof changeCounter === 'function') changeCounter('tmw', 1);
      msg = `Deck quarantined. +${qStress} Mental Stress, +1 Teamwork from disciplined response.`;
    } else if (action === 'rescue') {
      if (effects.renown) { S.renown = (S.renown||0) + effects.renown; if (typeof updateRenownUI === 'function') updateRenownUI(); }
      if (itemFlags.factionItem) {
        S.renown = (S.renown || 0) + 1;
        if (typeof updateRenownUI === 'function') updateRenownUI();
        bonusNotes.push('Faction aid symbol inspires trust (+1 Renown)');
      }
      msg = `Rescued ${target}! +${effects.renown||0} Renown.`;
    } else if (action === 'salvage') {
      if (effects.credits) { S.credits = (S.credits||0) + effects.credits; if (typeof updateCreditsUI === 'function') updateCreditsUI(); }
      var salvageItemText = '';
      if (effects.item && typeof addToBackpack === 'function') {
        var salvageItemName = String(effects.item || '').trim();
        if (salvageItemName) {
          var stored = addToBackpack(salvageItemName);
          salvageItemText = stored
            ? ` + ${salvageItemName} (backpack).`
            : ` + ${salvageItemName} (no backpack slot).`;
        }
      }
      if (itemFlags.compass) {
        S.credits = (S.credits || 0) + 20;
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        bonusNotes.push('Compass marks extra salvage (+20₵)');
      }
      msg = `Salvaged ${target}! +${effects.credits||0}₵.${salvageItemText}`;
    } else if (action === 'avoid' || action === 'ignore') {
      msg = `Sailed past ${target}.`;
    } else if (action === 'accept') {
      if (effects.task && typeof acceptSeaTask === 'function') {
        const hexKey = S.lastSea && S.lastSea.selectedKey;
        const hex = hexKey && S.lastSea && S.lastSea.map ? S.lastSea.map.find(h => h.key === hexKey) : null;
        if (hex) {
          acceptSeaTask(hex.col, hex.row, 'Royal Armada', effects.task, null, effects.reward || { renown: 1 });
          msg = `Accepted mission from ${target}. Task marker placed on the sea map.`;
        }
      } else {
        msg = `Accepted mission from ${target}.`;
      }
    } else if (action === 'resist') {
      const stressApplied = effects.mentalStress != null ? effects.mentalStress : (effects.stress || 0);
      if (stressApplied) { addMentalStress(stressApplied); }
      msg = `Resisted ${target}! +${stressApplied||0} Mental Stress.`;
    }

    if (bonusNotes.length) {
      msg += ' [' + bonusNotes.join(' | ') + ']';
    }
    concludeSeaEncounter(msg || 'Action resolved.', 'good');
  }

  function getShipName() {
    return (S.naval && S.naval.ship && S.naval.ship.name) || 'Our Ship';
  }

  // Generate a task for a sea hex — matches province map generateTaskForHex pattern
  function generateTaskForSeaHex(col, row) {
    if (!S.lastSea || !S.lastSea.map) return;
    const hex = S.lastSea.map.find(h => h.col === col && h.row === row);
    if (!hex) return;
    const verbs = ['Hunt', 'Guard', 'Rescue', 'Deliver', 'Investigate', 'Scout', 'Retrieve', 'Escort'];
    const targets = ['Pirates', 'Sea Creatures', 'Refugees', 'Cargo', 'Dangers', 'Wrecks', 'Relics', 'Survivors'];
    const candidates = S.lastSea.map.filter(h => h.key !== hex.key);
    if (!candidates.length) { showNotif('No destination hex available.', 'warn'); return; }
    const destHex = pick(candidates);
    const verb = pick(verbs);
    const target = pick(targets);
    const destName = destHex.title || destHex.islandName || `[${destHex.col+1},${destHex.row+1}]`;
    let html = `<div style="font-size:.84rem;color:var(--text2);line-height:1.6;"><strong style="color:var(--gold2);">Sea Task Offer</strong><br>${verb} ${target} near <strong>${destName}</strong>.<br><br><strong style="color:var(--gold);">Success = +1 Renown</strong></div>
    <div style="margin-top:.4rem;display:flex;justify-content:flex-end;gap:.3rem;">
      <button class="btn btn-sm btn-warn" onclick="closeModal();">Decline</button>
      <button class="btn btn-sm btn-success" onclick="acceptSeaTask(${col},${row},'${verb}','${target}','${destHex.key}');">Accept Task</button>
    </div>`;
    openModal('Sea Task Assignment', html);
  }
  window.generateTaskForSeaHex = generateTaskForSeaHex;

  function acceptSeaTask(col, row, verb, target, destKey, reward) {
    if (!S.lastSea) return;
    S.lastSea.missionTokens = S.lastSea.missionTokens || {};
    let resolvedDestKey = destKey;
    if (!resolvedDestKey && Array.isArray(S.lastSea.map) && S.lastSea.map.length) {
      const originHex = S.lastSea.map.find(h => h.col === col && h.row === row);
      const pool = S.lastSea.map.filter(h => !originHex || h.key !== originHex.key);
      const destHex = pool.length ? pick(pool) : originHex;
      resolvedDestKey = destHex && destHex.key;
    }
    if (!resolvedDestKey) {
      showNotif('No destination hex available.', 'warn');
      return;
    }
    S.lastSea.missionTokens[resolvedDestKey] = {
      missionId: 'sea_task',
      title: verb + ' ' + target,
      type: 'site',
      reward: Object.assign({ renown: 1 }, reward || {}),
      dread: 8,
    };
    if (typeof renderLastSeaMap === 'function') renderLastSeaMap();
    closeModal();
    showNotif(`Task accepted: ${verb} ${target} — marker placed on map`, 'good');
  }
  window.acceptSeaTask = acceptSeaTask;

  function completeSeaTask(hexKey) {
    if (!S.lastSea || !S.lastSea.missionTokens || !S.lastSea.missionTokens[hexKey]) return;
    const task = S.lastSea.missionTokens[hexKey];
    const vdDie = (S.stats && S.stats.valor) ? S.stats.valor : 4;
    var finishSeaTask = function(success, checkText) {
      delete S.lastSea.missionTokens[hexKey];
      let msg = `Task failed: ${task.title}. ${checkText}.`;
      if (success) {
        const reward = task.reward || { renown: 1 };
        if (reward.renown) {
          S.renown = (S.renown || 0) + reward.renown;
          if (typeof updateRenownUI === 'function') updateRenownUI();
        }
        if (reward.credits) {
          S.credits = (S.credits || 0) + reward.credits;
          if (typeof updateCreditsUI === 'function') updateCreditsUI();
        }
        msg = `Task completed: ${task.title}. ${checkText} — success.${reward.renown ? ` +${reward.renown} Renown.` : ''}${reward.credits ? ` +${reward.credits}₵.` : ''}`;
      } else if (typeof addTMWOnFail === 'function') {
        addTMWOnFail();
      }
      if (typeof renderLastSeaMap === 'function') renderLastSeaMap();
      showNotif(msg, success ? 'good' : 'warn');
      renderLastSeaInfo();
    };

    if (isSeaManualRollMode()) {
      openSeaManualActionDreadPrompt({
        title: 'Manual Roll - Sea Task',
        context: String(task.title || 'Sea Task'),
        statKey: 'valor',
        statLabel: 'Valor',
        actionDie: vdDie,
        dreadDie: task.dread || 8,
        onResolve: function(outcome) {
          var usedDd = Number((outcome && outcome.dreadDie) || (task.dread || 8));
          finishSeaTask(!!(outcome && outcome.success), 'VD' + vdDie + ' vs DD' + usedDd + ' (manual' + (outcome && outcome.pushLuck ? ', Push Luck' : '') + ')');
        }
      });
      return;
    }

    const actionRoll = explodingRoll(vdDie);
    const dreadRoll = explodingRoll(task.dread || 8);
    const success = actionRoll.total >= dreadRoll.total;
    finishSeaTask(success, 'VD' + vdDie + ' ' + actionRoll.total + ' vs DD' + (task.dread || 8) + ' ' + dreadRoll.total);
  }
  window.completeSeaTask = completeSeaTask;

  function buildSeaExploration(hex) {
    const option = pick(["weather", "encounter", "peril", "skirmish", "uneventful"]);
    if (option === "weather") {
      S.lastSea.weather = rollLastSeaWeather();
      var w = S.lastSea.weather;
      var buttons = (w && w.check)
        ? `<div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-warn" onclick="resolveLastSeaWeatherCheck('lead')">⚄ Lead vs Dread D${w.check.dd}</button><button class="btn btn-xs btn-teal" onclick="resolveLastSeaWeatherCheck('control')">⚄ Control vs Dread D${w.check.dd}</button></div>`
        : "";
      return appendSeaNightModeBonus(`<div class="sea-result-title">Shift in Weather</div>The sea turns under you. New weather: <strong style="color:var(--gold2);">${w.label}</strong> - ${w.desc}${buttons}`, hex, 'sea');
    }
    if (option === "encounter") {
      return appendSeaNightModeBonus(buildSeaEncounter(), hex, 'sea');
    }
    if (option === "peril") {
      const peril = pick(OPEN_SEA_PERILS);
      return appendSeaNightModeBonus(`<div class="sea-result-title">Peril - ${peril}</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Control vs DD6 or take the difference in Mental Stress.</div><div style="margin-top:.32rem;"><button class="btn btn-xs btn-warn" onclick="resolveOpenSeaPerilCheck(${hex.col},${hex.row},'${peril}',6)">⚄ Control vs DD6</button></div>`, hex, 'sea');
    }
    if (option === 'skirmish') {
      return appendSeaNightModeBonus(buildSeaSkirmishEncounter(hex), hex, 'sea');
    }
    return appendSeaNightModeBonus(`<div class="sea-result-title">Uneventful Sailing</div>The ship cuts across open water without trouble.`, hex, 'sea');
  }

  function isSeaNightModeActive() {
    if (typeof window.isEncounterNightModeActive === 'function') return !!window.isEncounterNightModeActive();
    return !!(S && S.nightMode);
  }

  function getSeaNightModeBonusChance(contextType) {
    if (window.settingsSystem && typeof window.settingsSystem.getNightModeRate === 'function') {
      if (contextType === 'island') return Number(window.settingsSystem.getNightModeRate('seaIsland') || 32);
      return Number(window.settingsSystem.getNightModeRate('seaOpen') || 42);
    }
    if (contextType === 'island') return 32;
    return 42;
  }

  function buildSeaNightModeBonusHtml(hex, contextType) {
    if (!isSeaNightModeActive() || roll(100) > getSeaNightModeBonusChance(contextType)) return '';
    if (contextType === 'island') {
      return `<div class="sea-result" style="margin-top:.35rem;border-color:rgba(126,215,255,.45);background:rgba(126,215,255,.08);"><div class="sea-result-title" style="color:#7ed7ff;">Night Mode Bonus - Moonlit Trail</div><div style="font-size:.82rem;color:var(--text2);line-height:1.55;">A silent guide marks safe stone crossings and hidden crates.</div><div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="resolveSeaEncounter('rescue','Moonlit Survivors',{renown:1})">Escort Survivors</button><button class="btn btn-xs btn-teal" onclick="if(typeof claimSeaBuriedTreasure==='function')claimSeaBuriedTreasure(${hex.col},${hex.row},'Book: Tidecaller Log')">Recover Lore Book</button></div></div>`;
    }
    return `<div class="sea-result" style="margin-top:.35rem;border-color:rgba(126,215,255,.45);background:rgba(126,215,255,.08);"><div class="sea-result-title" style="color:#7ed7ff;">Night Mode Bonus - Shadow Convoy</div><div style="font-size:.82rem;color:var(--text2);line-height:1.55;">A covert convoy appears in dead water lanes.</div><div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-warn" onclick="startSeaShipCombatEncounter()">Intercept Convoy</button><button class="btn btn-xs btn-gold" onclick="resolveSeaEncounter('salvage','Shadow Convoy',{credits:80,item:'Book: Neon Testament'})">Shadow Salvage</button></div></div>`;
  }

  function appendSeaNightModeBonus(baseHtml, hex, contextType) {
    return String(baseHtml || '') + buildSeaNightModeBonusHtml(hex, contextType);
  }

  function createLandEncounterResult(hex, type, data) {
    hex.encounter = { type, data };
    if (type === "landmark") {
      return `
        <div class="sea-result-title">Land Encounter - Landmark</div>
        <div class="sea-site">
          <div class="ss-title">${data.name}</div>
          <div class="ss-text">Effect: ${data.effect}. ${data.detail}</div>
          <div style="margin-top:.35rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-gold" onclick="acceptSeaLandmarkProtected(${hex.col},${hex.row})">Protected (Long Rest)</button></div>
        </div>
      `;
    }
    if (type === "settlement") {
      return `
        <div class="sea-result-title">Land Encounter - Settlement</div>
        <div class="sea-site">
          <div class="ss-title">${data.name}</div>
          <div class="ss-text">${data.style} settlement with ${data.cultural.toLowerCase()} roots. ${data.news}</div>
          <div style="margin-top:.35rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="if(typeof generateTaskForSeaHex==='function')generateTaskForSeaHex(${hex.col},${hex.row});else generateTask()">⚄ Generate Task</button><button class="btn btn-xs btn-teal" onclick="if(typeof openSeaSettlementHexcrawl==='function')openSeaSettlementHexcrawl('${String(data.name||'Sea Settlement').replace(/'/g,"\\'")}');else if(typeof openHoldingSettlementHexcrawl==='function')openHoldingSettlementHexcrawl();">◫ Enter Settlement</button></div>
        </div>
      `;
    }
    return `
      <div class="sea-result-title">Land Encounter - Dungeon</div>
      <div class="sea-site">
        <div class="ss-title">${data.name}</div>
        <div class="ruin-room" style="margin-top:.28rem;">
          <div class="ruin-room-title">Dungeon Overview</div>
          <div class="rb-text">Built by ${data.builder}. Purpose: ${data.builtFor}. Entrance: ${data.entrance}. Rooms: ${data.rooms}. Novelty: ${data.novelty}.</div>
        </div>
        <div style="margin-top:.35rem;"><button class="btn btn-xs btn-primary" onclick="requestJoinSeaArea('dungeon',${hex.col},${hex.row})">Open Ruin-Style Dungeon</button></div>
      </div>
    `;
  }

  function claimSeaBuriedTreasure(col, row, itemName) {
    var hex = seaHexByCoord(col, row);
    if (!hex) return;
    hex.encounter = hex.encounter || { type: 'treasure', data: {} };
    hex.encounter.data = hex.encounter.data || {};
    if (hex.encounter.data.claimed) {
      showNotif('Treasure already claimed.', 'info');
      return;
    }
    var item = String(itemName || 'Armor').trim() || 'Armor';
    var stored = false;
    if (typeof addToBackpack === 'function') {
      try { stored = !!addToBackpack(item); } catch (_err) { stored = false; }
    }
    if (!stored) {
      if (!Array.isArray(S.backpack)) S.backpack = Array(6).fill('');
      var idx = S.backpack.indexOf('');
      if (idx >= 0) {
        S.backpack[idx] = item;
        var bpEl = document.getElementById('bp' + idx);
        if (bpEl) bpEl.value = item;
        stored = true;
      }
    }
    if (stored && typeof renderBackpackUI === 'function') renderBackpackUI();
    if (stored && typeof window.tryAwardLoreBookDrop === 'function') window.tryAwardLoreBookDrop('last sea treasure', 18);
    hex.encounter.data.claimed = true;
    hex.resultHtml = '<div class="sea-result-title">Land Encounter - Buried Treasure</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You uncover 1 ' + sanitizeInlineText(item) + '. ' + (stored ? 'Added to Backpack.' : 'Backpack full - store it manually.') + '</div><div style="margin-top:.32rem;"><button class="btn btn-xs btn-teal" onclick="if(typeof switchTab===\'function\'){const b=document.querySelector(\"#mainNav .tab-btn[onclick*=\\\"switchTab(\\\'shop\\\'\\\"]\");switchTab(\'shop\',b||null);}">Open Merchants Tab</button></div>';
    renderLastSeaInfo(hex);
    showNotif('Buried treasure recovered: 1 ' + item + '.', stored ? 'good' : 'warn');
  }

  function buildLandEncounter(hex) {
    var itemFlags = getSeaNarrativeItemFlags();
    var pirateHint = itemFlags.factionItem ? ' (+Faction Renown)' : '';
    var pirateTitle = itemFlags.factionItem ? 'Faction item can grant bonus Renown on pirate success.' : '';
    if (hex.siteType && hex.siteData && Math.random() < 0.65) {
      return createLandEncounterResult(hex, hex.siteType, hex.siteData);
    }

    const rolled = roll(6);
    if (rolled === 1) {
      return createLandEncounterResult(hex, "dungeon", makeDungeonData());
    }
    if (rolled === 2) {
      return createLandEncounterResult(hex, "landmark", makeLandmarkData());
    }
    if (rolled === 3) {
      return createLandEncounterResult(hex, "settlement", makeSettlementData());
    }
    if (rolled === 4) {
      const beasts = roll(4);
      return `<div class="sea-result-title">Land Encounter - Hostile Beasts</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">${beasts} hostile beast${beasts > 1 ? "s" : ""} stalk the interior. DD4 | 8 HP each.</div><div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="startSeaLandBeastCombat(${hex.col},${hex.row},${beasts})">⚔ Start Beast Combat</button><button class="btn btn-xs btn-success" onclick="resolveSeaLandBeastOutcome(${hex.col},${hex.row},true)">✓ Victory</button><button class="btn btn-xs btn-red" onclick="resolveSeaLandBeastOutcome(${hex.col},${hex.row},false)">✗ Defeat</button></div>`;
    }
    if (rolled === 5) {
      const treasurePool = (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && Array.isArray(SHOP_DATA.armor) && SHOP_DATA.armor.length)
        ? SHOP_DATA.armor
        : [{ name: 'Armor' }];
      const treasureItem = String((pick(treasurePool) || {}).name || 'Armor');
      const safeItem = treasureItem.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<div class="sea-result-title">Land Encounter - Buried Treasure</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">You uncover 1 ${treasureItem}.</div><div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="claimSeaBuriedTreasure(${hex.col},${hex.row},'${safeItem}')">Add To Backpack</button><button class="btn btn-xs btn-teal" onclick="if(typeof switchTab==='function'){const b=document.querySelector(\"#mainNav .tab-btn[onclick*=\\\"switchTab('shop'\\\"]\");switchTab('shop',b||null);}">Open Merchants Tab</button></div>`;
    }
    return `<div class="sea-result-title">Land Encounter - Pirates</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">2 pirates haunt the path inland. DD4 | 8 HP each.</div><div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-primary" onclick="startSeaPirateLandEncounter(${hex.col},${hex.row})">⚔ Start Pirate Combat</button><button class="btn btn-xs btn-success" title="${pirateTitle}" onclick="resolveSeaPirateLandOutcome(${hex.col},${hex.row},true)">✓ Victory${pirateHint}</button><button class="btn btn-xs btn-red" onclick="resolveSeaPirateLandOutcome(${hex.col},${hex.row},false)">✗ Defeat</button></div>`;
  }

  function buildIslandExploration(hex) {
    var itemFlags = getSeaNarrativeItemFlags();
    var perilHint = itemFlags.compass ? ' (+Compass +2)' : (itemFlags.torch ? ' (+Torch stress shield)' : '');
    var perilTitle = itemFlags.compass ? 'Compass grants +2 Lead on fog peril checks.' : (itemFlags.torch ? 'Torch can reduce fog failure stress by 1.' : '');
    var traumaHint = itemFlags.torch ? ' (+Torch +1)' : '';
    var traumaTitle = itemFlags.torch ? 'Torch grants +1 Spirit on exhaustion trauma checks.' : '';
    const option = pick(["land", "peril", "exhaustion", "weather", "uneventful"]);
    if (option === "land") {
      return appendSeaNightModeBonus(buildLandEncounter(hex), hex, 'island');
    }
    if (option === "peril") {
      return appendSeaNightModeBonus(`<div class="sea-result-title">Island Peril - Fog</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Lead vs DD6 or take the difference in Mental Stress.</div><div style="margin-top:.32rem;"><button class="btn btn-xs btn-warn" title="${perilTitle}" onclick="resolveSeaIslandPerilCheck(${hex.col},${hex.row})">⚄ Lead vs DD6${perilHint}</button></div>`, hex, 'island');
    }
    if (option === "exhaustion") {
      return appendSeaNightModeBonus(`<div class="sea-result-title">Exhaustion</div><div style="font-size:.82rem;color:var(--muted3);line-height:1.55;">Make a Spirit vs DD6 Trauma Check before pressing farther inland.</div><div style="margin-top:.32rem;"><button class="btn btn-xs btn-warn" title="${traumaTitle}" onclick="resolveSeaExhaustionCheck(${hex.col},${hex.row})">⚄ Spirit vs DD6${traumaHint}</button></div>`, hex, 'island');
    }
    if (option === "weather") {
      S.lastSea.weather = rollLastSeaWeather();
      var iw = S.lastSea.weather;
      var ib = (iw && iw.check)
        ? `<div style="margin-top:.32rem;display:flex;gap:.25rem;flex-wrap:wrap;"><button class="btn btn-xs btn-warn" onclick="resolveLastSeaWeatherCheck('lead')">⚄ Lead vs Dread D${iw.check.dd}</button><button class="btn btn-xs btn-teal" onclick="resolveLastSeaWeatherCheck('control')">⚄ Control vs Dread D${iw.check.dd}</button></div>`
        : "";
      return appendSeaNightModeBonus(`<div class="sea-result-title">Shift in Weather</div>The air changes fast. New weather: <strong style="color:var(--gold2);">${iw.label}</strong> - ${iw.desc}${ib}`, hex, 'island');
    }
    return appendSeaNightModeBonus(`<div class="sea-result-title">Uneventful Travel</div>You cross the island without incident.`, hex, 'island');
  }

  function exploreLastSeaHex(col, row) {
    ensureExpansionState();
    const hex = getSeaCell(col, row);
    if (!hex) {
      return;
    }
    S.lastSea.selectedKey = hex.key;
    hex.resultHtml = hex.type === "sea" ? buildSeaExploration(hex) : buildIslandExploration(hex);
    if (typeof window.registerSecretPadClue === 'function') {
      window.registerSecretPadClue('sea', 'intel');
      if (String(hex.resultHtml || '').match(/Encounter|Peril|Hostile|Raiders|Pirates/i)) {
        window.registerSecretPadClue('sea', 'event');
      }
    }
    if (hex.type === "sea") {
      S.lastSea.activeEncounterKey = hex.key;
    } else {
      S.lastSea.activeEncounterKey = null;
    }
    renderLastSeaInfo(hex);
  }

  function setLastSeaNote(col, row, value) {
    ensureExpansionState();
    S.lastSea.notes[seaKey(col, row)] = value;
    renderLastSeaMap();
  }

  function focusLastSeaHexByKey(key) {
    ensureExpansionState();
    var targetKey = String(key || "");
    if (!targetKey || !Array.isArray(S.lastSea.map) || !S.lastSea.map.length) return false;
    var hex = S.lastSea.map.find(function (item) { return item && String(item.key || "") === targetKey; });
    if (!hex) return false;
    S.lastSea.selectedKey = hex.key;
    renderLastSeaMap();
    renderLastSeaInfo(hex);
    return true;
  }

  // Sea-specific puzzle pool (self-contained in beyond-light-expansion.js)
  var SEA_RUIN_PUZZLES = SEA_RUIN_PUZZLES || [
    { mode: 'code', title: 'Tidal Cipher', prompt: 'The basin inscription reads: WAVE → ? The sea builders reversed words to seal their vaults. Enter the reversed word.', answer: 'evaw' },
    { mode: 'rearrange', title: 'Anchor Phrase', prompt: 'Arrange the worn stones into the correct docking mantra.', bank: ['THE', 'SEA', 'HOLDS', 'NO', 'MERCY'], answer: 'the sea holds no mercy' },
    { mode: 'memory', title: 'Depth Marker Sequence', prompt: 'The floor markers flash once, then go dark. Rebuild the order before the lock hardens.', sequence: ['REEF', 'FOAM', 'KELP', 'REEF'], bank: ['REEF', 'FOAM', 'KELP', 'TIDE'] },
    { mode: 'crossword_grid', title: 'Navigator\'s Lattice', prompt: 'Complete the 7×7 sub-sea lattice. Black tiles blocked, white tiles must all resolve.', gridTemplate: ['##REEF#', '#A#E#O#', 'ANCHOR#', '#H#F#C#', '##TIDE#', '#R#A#T#', '##SALT#'], clues: [{ clue: 'Across 1: Coral formation', answer: 'reef' }, { clue: 'Across 2: Ship tie', answer: 'anchor' }, { clue: 'Across 3: Tidal flow', answer: 'tide' }, { clue: 'Across 4: Ocean mineral', answer: 'salt' }] },
    { mode: 'mosaic', title: 'Current Map', prompt: 'Restore the current chart to unlock the depth hatch.', bank: ['TIDE', 'REEF', 'PORT'], answer: 'tide reef port' }
  ];

  function createSeaRuinPuzzleSpec() {
    if (!Array.isArray(SEA_RUIN_PUZZLES) || !SEA_RUIN_PUZZLES.length) return null;
    return JSON.parse(JSON.stringify(SEA_RUIN_PUZZLES[Math.floor(Math.random() * SEA_RUIN_PUZZLES.length)]));
  }

  function buildDungeonModal(data) {
    data.hexcrawl = data.hexcrawl || null;
    if (!data.hexcrawl || !Array.isArray(data.hexcrawl.nodes) || !data.hexcrawl.nodes.length) {
      const total = Math.max(3, Number(data.rooms || 3));
      const tags = ['Entrance', 'Collapsed Hall', 'Watch Post', 'Puzzle Door', 'Loot Niche', 'Shrine Alcove', 'Flooded Crossing', 'Boss Threshold'];
      data.hexcrawl = {
        nodes: Array.from({ length: total }).map(function (_n, idx) {
          return {
            id: idx,
            label: tags[idx] || ('Node ' + (idx + 1)),
            roomIndex: idx,
            explored: false
          };
        })
      };
    }
    data.exploration = data.exploration || { clearedRooms: 0, discoveredLoot: [] };

    // Progressive unlock: default to showing only Room 1 (Entrance is always shown)
    if (typeof data.unlockedRooms !== 'number') data.unlockedRooms = 1;
    if (!data.hiddenSearched) data.hiddenSearched = false;
    if (!data.hiddenRoomResult) data.hiddenRoomResult = '';
    if (typeof data.hexcrawl.activeNodeId !== 'number') data.hexcrawl.activeNodeId = 0;

    let html = `
      <div class="room-block" style="border-color:rgba(46,196,182,.6);background:rgba(46,196,182,.07);">
        <div class="rb-title" style="color:var(--teal);">⚓ Entrance</div>
        <div class="rb-text">${data.entrance}</div>
      </div>
    `;

    var seaSize = 22;
    var seaSpacing = 40;
    var seaCenterX = 210;
    var seaCenterY = 130;
    var toSpiral = function (idx) {
      idx = Math.max(1, Number(idx || 1));
      if (idx === 1) return { q: 0, r: 0 };
      var dirs = [
        { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
        { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }
      ];
      var remain = idx - 1;
      var ring = 1;
      while (remain > 6 * ring) {
        remain -= 6 * ring;
        ring += 1;
      }
      var q = -ring;
      var r = ring;
      for (var side = 0; side < 6; side++) {
        var d = dirs[side];
        for (var step = 0; step < ring; step++) {
          if (remain === 1) return { q: q, r: r };
          q += d.q;
          r += d.r;
          remain -= 1;
        }
      }
      return { q: q, r: r };
    };
    var toXY = function (q, r) {
      return {
        x: Math.round((Math.sqrt(3) * seaSize * (q + r / 2)) + seaCenterX),
        y: Math.round(((3 / 2) * seaSize * r) + seaCenterY)
      };
    };
    var seaHexPoints = function (cx, cy) {
      var pts = [];
      for (var i = 0; i < 6; i++) {
        var a = (Math.PI / 180) * (60 * i - 30);
        pts.push((cx + seaSize * Math.cos(a)).toFixed(1) + ',' + (cy + seaSize * Math.sin(a)).toFixed(1));
      }
      return pts.join(' ');
    };
    var seaPlaced = (data.hexcrawl.nodes || []).map(function (node, idx) {
      var c = toSpiral(idx + 1);
      var p = toXY(c.q, c.r);
      return { node: node, idx: idx, x: p.x, y: p.y };
    });
    var seaLinks = [];
    for (var si = 1; si < seaPlaced.length; si++) {
      seaLinks.push('<line x1="' + seaPlaced[si - 1].x + '" y1="' + seaPlaced[si - 1].y + '" x2="' + seaPlaced[si].x + '" y2="' + seaPlaced[si].y + '" stroke="rgba(126,215,255,.28)" stroke-width="1.7" />');
    }
    var seaGlyphs = [];
    for (var gi = 0; gi < 12; gi++) {
      var gx = 22 + ((gi * 59) % 396);
      var gy = 18 + ((gi * 37) % 232);
      var mark = (gi % 3 === 0) ? '◌' : ((gi % 3 === 1) ? '✶' : '⟡');
      seaGlyphs.push('<text x="' + gx + '" y="' + gy + '" text-anchor="middle" font-size="8" fill="rgba(126,215,255,.2)">' + mark + '</text>');
    }
    var seaNodes = seaPlaced.map(function (entry) {
      var node = entry.node || {};
      // Only show nodes that are unlocked (Province/LC parity)
      if (Number(node.id || 0) >= Number(data.unlockedRooms || 1)) return '';
      var explored = !!node.explored;
      var selected = Number(data.hexcrawl.activeNodeId || 0) === Number(node.id || 0);
      var stroke = selected ? 'rgba(240,208,112,.95)' : (explored ? 'rgba(76,175,116,.85)' : 'rgba(126,215,255,.62)');
      var fill = selected ? 'rgba(240,208,112,.14)' : (explored ? 'rgba(76,175,116,.22)' : 'rgba(22,30,44,.9)');
      var icon = explored ? '✓' : '?';
      return '<g style="cursor:pointer;" onclick="selectSeaDungeonHexNode(' + Number(node.id || 0) + ')">'
        + '<polygon points="' + seaHexPoints(entry.x, entry.y) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"></polygon>'
        + '<text x="' + entry.x + '" y="' + (entry.y - 2) + '" text-anchor="middle" font-size="10" fill="var(--gold2)">#' + (Number(node.id || 0) + 1) + '</text>'
        + '<text x="' + entry.x + '" y="' + (entry.y + 10) + '" text-anchor="middle" font-size="9" fill="var(--text2)">' + icon + '</text>'
        + '<title>' + sanitizeInlineText(String(node.label || ('Node ' + (Number(node.id || 0) + 1)))) + '</title>'
        + '</g>';
    }).join('');

    html += '<div class="room-block" style="border-color:rgba(46,196,182,.35);background:rgba(46,196,182,.05);">'
      + '<div class="rb-title">Hexcrawl Ruin Map</div>'
      + '<div class="rb-text">Province-style node crawl. Select a hex and resolve its room.</div>'
      + '<svg viewBox="0 0 420 260" style="width:100%;height:auto;display:block;margin-top:.28rem;">'
      + '<defs><linearGradient id="seaRuinBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(10,26,36,.86)"/><stop offset="100%" stop-color="rgba(6,14,22,.95)"/></linearGradient></defs>'
      + '<rect x="0" y="0" width="420" height="260" fill="url(#seaRuinBg)"></rect>'
      + seaGlyphs.join('')
      + seaLinks.join('')
      + seaNodes
      + '</svg>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.24rem;margin-top:.28rem;">'
      + data.hexcrawl.nodes.filter(function (node) { return Number(node.id) < Number(data.unlockedRooms || 1); }).map(function (node) {
        return '<div style="font-size:.74rem;color:var(--text2);">Hex ' + (Number(node.id) + 1) + ' · ' + sanitizeInlineText(String(node.label || 'Node'))
          + ' · <span style="color:' + (node.explored ? 'var(--green2)' : 'var(--teal)') + ';">' + (node.explored ? 'Cleared' : 'Unexplored') + '</span></div>';
      }).join('')
      + '</div>'
      + '<div style="margin-top:.24rem;padding:.22rem .26rem;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.2);">'
      + (function () {
          var active = (data.hexcrawl.nodes || []).find(function (n) { return Number(n.id) === Number(data.hexcrawl.activeNodeId || 0); }) || data.hexcrawl.nodes[0];
          if (!active) return '<div style="font-size:.72rem;color:var(--muted2);">No active hex.</div>';
          return '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.08rem;"><strong>Selected Hex ' + (Number(active.id || 0) + 1) + '</strong> · ' + sanitizeInlineText(String(active.label || 'Node')) + '</div>'
            + '<div style="font-size:.7rem;color:var(--muted2);margin-bottom:.12rem;">Status: ' + (active.explored ? 'Cleared' : 'Unexplored') + '</div>'
            + (active.explored
              ? '<span style="font-size:.72rem;color:var(--green2);">Already cleared.</span>'
              : '<button class="btn btn-xs btn-teal" onclick="exploreSeaDungeonHexNode(' + Number(active.id || 0) + ')">⚄ Explore Selected Hex (VD vs DD6)</button>');
        })()
      + '</div>'
      + '</div>';

    for (let index = 1; index <= data.rooms; index += 1) {
      // Only reveal rooms that are unlocked
      const unlocked = index <= data.unlockedRooms;
      if (!unlocked) {
        html += `<div class="room-block" style="opacity:.35;border-style:dashed;"><div class="rb-title">Room ${index} — ?</div><div class="rb-text" style="font-size:.74rem;color:var(--muted2);">Locked. Resolve a previous room to reveal this passage.</div></div>`;
        continue;
      }
      if (!data.generatedRooms) data.generatedRooms = [];
      if (!data.generatedRooms[index - 1]) data.generatedRooms[index - 1] = { type: pick(RUIN_ROOM_TYPES), cleared: false, result: '' };
      const room = data.generatedRooms[index - 1];
      const type = room.type;
      if (!room.text) {
        room.text = type === "Lair" ? pick(RUIN_LAIR_DESC)
          : type === "Obstacle" ? pick(RUIN_OBSTACLE_DESC)
          : type === "Trap" ? pick(RUIN_TRAP_DESC)
          : type === "Puzzle" ? pick(RUIN_PUZZLE_DESC)
          : "A quiet chamber full of salt-stained debris.";
      }
      const text = room.text;
      // Puzzle rooms use the same standalone puzzle flow as Province Ruins.
      const isPuzzleRoom = type === "Puzzle";
      if (isPuzzleRoom && !room.cleared) {
        if (!room.puzzleSpec) {
          room.puzzleSpec = createSeaRuinPuzzleSpec();
        }
        const blockingPuzzleIdx = getSeaDungeonBlockingPuzzleIndex(data.generatedRooms);
        const puzzleLocked = blockingPuzzleIdx >= 0 && (index - 1) > blockingPuzzleIdx;
        const puzzleAction = puzzleLocked
          ? '<div style="margin-top:.28rem;font-size:.72rem;color:var(--red2);">🔒 Progress blocked by an unsolved puzzle in an earlier room.</div>'
          : `<div style="margin-top:.32rem;"><button class="btn btn-xs btn-teal" onclick="startSeaDungeonPuzzle(${index - 1})">🧩 Solve Puzzle</button></div>`;
        html += `<div class="room-block">
          <div class="rb-title">Room ${index} — Puzzle</div>
          <div class="rb-text">${text}</div>
          ${room.result ? `<div class="rb-text" style="margin-top:.3rem;color:var(--gold2);">${room.result}</div>` : puzzleAction}
        </div>`;
      } else {
        const dreadForRoom = getSeaDungeonRoomDread(type);
        const bossAction = type === 'Boss Chamber'
          ? `<div style="margin-top:.35rem;"><button class="btn btn-xs btn-warn" onclick="exploreSeaDungeonRoom(${index - 1})">💀 Resolve Boss Chamber</button></div>`
          : `<div style="margin-top:.35rem;"><button class="btn btn-xs btn-teal" onclick="exploreSeaDungeonRoom(${index - 1})">⚄ Resolve Room (VD vs DD${dreadForRoom})</button></div>`;
        html += `
          <div class="room-block">
            <div class="rb-title">Room ${index} — ${type}</div>
            <div class="rb-text">${text}</div>
            ${room.result ? `<div class="rb-text" style="margin-top:.3rem;color:var(--gold2);">${room.result}</div>` : ''}
            ${room.cleared ? '<div style="font-size:.74rem;color:var(--green2);margin-top:.2rem;">✓ Cleared</div>' : bossAction}
          </div>
        `;
      }
    }
    if (data.exploration.discoveredLoot.length) {
      html += `
        <div class="room-block">
          <div class="rb-title">Recovered Loot</div>
          <div class="rb-text">${data.exploration.discoveredLoot.join(', ')}</div>
        </div>
      `;
    }
    // Hidden room search
    const hiddenAreaUnlocked = data.unlockedRooms >= 1;
    if (hiddenAreaUnlocked) {
      const searchDone = !!data.hiddenSearched;
      html += `<div class="room-block" style="border-color:rgba(176,96,208,.5);background:rgba(176,96,208,.06);">
        <div class="rb-title" style="color:var(--purple);">🔎 Hidden Room Search</div>
        <div class="rb-text">Roll your Valor Die vs DD6. Success reveals a secret compartment with rare loot.</div>
        ${searchDone
          ? (data.hiddenRoomResult ? `<div style="font-size:.78rem;color:var(--gold2);margin-top:.2rem;">${data.hiddenRoomResult}</div>` : '<div style="font-size:.74rem;color:var(--muted2);">Search complete — nothing more found.</div>')
          : `<div style="margin-top:.3rem;"><button class="btn btn-xs btn-primary" onclick="seaDungeonSearchHidden(${S.lastSea&&S.lastSea.activeDungeon?S.lastSea.activeDungeon.col:0},${S.lastSea&&S.lastSea.activeDungeon?S.lastSea.activeDungeon.row:0})">⚄ Search (VD vs DD6)</button></div>`}
      </div>`;
    }
    return html;
  }

  function openSeaAreaJoinPrompt(areaLabel, onJoin) {
    if (typeof onJoin !== 'function') return;
    if (typeof window.openCampaignAreaJoinPrompt === 'function') {
      window.openCampaignAreaJoinPrompt(areaLabel, onJoin);
      return;
    }
    onJoin();
  }

  function requestJoinSeaArea(areaType, col, row) {
    var label = (String(areaType || '').toLowerCase() === 'dungeon') ? 'Sea Dungeon' : 'Sea Area';
    openSeaAreaJoinPrompt(label, function () {
      if (String(areaType || '').toLowerCase() === 'dungeon') openSeaDungeon(col, row);
    });
  }
  window.requestJoinSeaArea = requestJoinSeaArea;

  function openSeaDungeon(col, row) {
    const hex = getSeaCell(col, row);
    const data = hex && hex.encounter && hex.encounter.type === "dungeon" ? hex.encounter.data : hex && hex.siteType === "dungeon" ? hex.siteData : null;
    if (!data) {
      return;
    }
    const cs = (window.campaignSystem && typeof window.campaignSystem.getState === 'function') ? window.campaignSystem.getState() : null;
    if (cs && cs.code && cs.role === 'player' && !Array.isArray(data.generatedRooms)) {
      showNotif('Dungeon layout is waiting for GM sync. Ask GM to join this area first or request resync.', 'info');
      return;
    }
    let generatedRooms = false;
    if (!Array.isArray(data.generatedRooms)) {
      data.generatedRooms = [];
      generatedRooms = true;
    }
    S.lastSea.activeDungeon = { col, row };
    // Sync Sea Region dungeon opening to campaign if available
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
      setTimeout(function() {
        try { 
          window.campaignSystem.syncSharedSilent(generatedRooms ? 'sea-dungeon-generated' : 'sea-dungeon-opened'); 
        } catch (_err) { console.error(_err); }
      }, 0);
    }
    openModal(data.name, buildDungeonModal(data));
  }

  function rollSeaDungeonLoot() {
    if (typeof rollForLoot === 'function') {
      try {
        const rolled = rollForLoot('easy');
        if (Array.isArray(rolled) && rolled.length) {
          return pick(rolled);
        }
      } catch (err) { console.error(err); }
    }
    const fallbackPick = function(category, fallbackName) {
      const pool = (typeof SHOP_DATA === 'object' && SHOP_DATA && Array.isArray(SHOP_DATA[category])) ? SHOP_DATA[category] : [];
      return pool.length ? String((pick(pool) || {}).name || fallbackName) : fallbackName;
    };
    const table = [
      function(){ return String(roll(6) * 10) + ' Credits'; },
      function(){ return fallbackPick('scrolls', 'Reveal Traps'); },
      function(){ return fallbackPick('armor', 'Balanced Armor'); },
      function(){ return fallbackPick('weapons', 'Sword'); },
      function(){ return fallbackPick('toolkits', 'Scavenger\'s Pouch'); },
      function(){ return fallbackPick('strange', 'Strange Item #01'); }
    ];
    return pick(table)();
  }

  function getSeaDungeonBlockingPuzzleIndex(rooms) {
    if (!Array.isArray(rooms)) return -1;
    for (var i = 0; i < rooms.length; i++) {
      var room = rooms[i];
      if (room && room.type === 'Puzzle' && !room.cleared) return i;
    }
    return -1;
  }

  function getSeaDungeonRoomDread(type) {
    if (type === 'Boss Chamber') return 12;
    if (type === 'Trap' || type === 'Obstacle') return 6;
    return 8;
  }

  function syncSeaDungeonState(reason) {
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === 'function') {
      setTimeout(function () {
        try {
          window.campaignSystem.syncSharedSilent(reason || 'sea-dungeon-update');
        } catch (_err) { console.error(_err); }
      }, 0);
    }
  }

  function exploreSeaDungeonRoom(roomIndex) {
    if (!S.lastSea || !S.lastSea.activeDungeon) return;
    const hex = getSeaCell(S.lastSea.activeDungeon.col, S.lastSea.activeDungeon.row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !data.generatedRooms || !data.generatedRooms[roomIndex]) return;
    const blockingPuzzleIdx = getSeaDungeonBlockingPuzzleIndex(data.generatedRooms);
    if (blockingPuzzleIdx >= 0 && Number(roomIndex || 0) > blockingPuzzleIdx) {
      if (typeof showNotif === 'function') showNotif('Progress blocked: solve the earlier puzzle room first.', 'warn');
      return openModal(data.name, buildDungeonModal(data));
    }
    const room = data.generatedRooms[roomIndex];
    if (room.cleared) return;
    if (room.type === 'Boss Chamber') {
      room.result = 'The sea ruin warden rises to challenge you. Win the battle, then mark the outcome below. '
        + '<div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;">'
        + '<button class="btn btn-xs btn-warn" onclick="startSeaDungeonBossCombat(' + Number(roomIndex || 0) + ')">⚔ Start Boss Combat</button>'
        + '<button class="btn btn-xs btn-primary" onclick="resolveSeaDungeonBossOutcome(' + Number(roomIndex || 0) + ',true)">Success</button>'
        + '<button class="btn btn-xs btn-red" onclick="resolveSeaDungeonBossOutcome(' + Number(roomIndex || 0) + ',false)">Failure</button>'
        + '</div>';
      return openModal(data.name, buildDungeonModal(data));
    }
    if (room.type === 'Puzzle') return startSeaDungeonPuzzle(roomIndex);
    const actionDie = (S.stats && S.stats.valor) ? S.stats.valor : 4;
    const dreadDie = getSeaDungeonRoomDread(room.type);
    const actionRoll = explodingRoll(actionDie);
    const dreadRoll = explodingRoll(dreadDie);
    const success = actionRoll.total >= dreadRoll.total;
    let result = `VD${actionDie} ${actionRoll.total} vs DD${dreadDie} ${dreadRoll.total}. `;
    if (success) {
      const loot = rollSeaDungeonLoot();
      data.exploration = data.exploration || { clearedRooms: 0, discoveredLoot: [] };
      data.exploration.clearedRooms += 1;
      data.exploration.discoveredLoot.push(loot);
      // Province-style progression: resolving one room reveals up to 2 more.
      data.unlockedRooms = Math.min(Number(data.rooms || data.generatedRooms.length || 1), Number(data.unlockedRooms || 1) + 2);
      let stored = false;
      if (typeof addToBackpack === 'function') {
        try {
          stored = !!addToBackpack(loot);
        } catch (err) {
          stored = false;
        }
      }
      if (!stored) {
        if (!Array.isArray(S.backpack)) {
          S.backpack = Array(6).fill('');
        }
        const slotIdx = S.backpack.indexOf('');
        if (slotIdx >= 0) {
          S.backpack[slotIdx] = loot;
          const bpEl = document.getElementById('bp' + slotIdx);
          if (bpEl) bpEl.value = loot;
          stored = true;
        }
      }
      if (stored && typeof renderBackpackUI === 'function') {
        renderBackpackUI();
      }
      room.result = stored
        ? `${result}Success. Loot: ${loot} added to Backpack.`
        : `${result}Success. Loot: ${loot}. Backpack full, loot held in Recovered Loot.`;
    } else {
      const diff = Math.max(1, dreadRoll.total - actionRoll.total);
      if (typeof changeStress === 'function') changeStress(diff);
      if (typeof addTMWOnFail === 'function') addTMWOnFail('general-failure', {
        failedBy: diff,
        actionDie: Math.max(4, Number(actionDie) || 4),
        dreadDie: Math.max(4, Number(dreadDie) || 6),
        actionLabel: 'Valor Die'
      });
      if (room.type === 'Trap' && S && S.conditions) S.conditions.distracted = true;
      room.result = `${result}Failure. Suffer ${diff} Damage.`;
      data.unlockedRooms = Math.min(Number(data.rooms || data.generatedRooms.length || 1), Number(data.unlockedRooms || 1) + 1);
    }
    room.cleared = true;
    syncSeaDungeonState('sea-dungeon-room-explored');
    openModal(data.name, buildDungeonModal(data));
  }

  function startSeaDungeonBossCombat(roomIndex) {
    if (!S.lastSea || !S.lastSea.activeDungeon) return false;
    const hex = getSeaCell(S.lastSea.activeDungeon.col, S.lastSea.activeDungeon.row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !Array.isArray(data.generatedRooms) || !data.generatedRooms[roomIndex]) return false;
    var room = data.generatedRooms[roomIndex];
    if (!room || room.cleared || room.type !== 'Boss Chamber') return false;
    seedSeaEncounterCombat('Sea Ruin Warden', 1, 8, 8);
    room.result = 'Boss combat seeded in Combat + Quick Access (DD8 | 8 HP). Choose outcome to resolve encounter.'
      + '<div style="margin-top:.3rem;display:flex;gap:.25rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-warn" onclick="if(typeof switchTab===\'function\'){const b=document.querySelector(\"#mainNav .tab-btn[onclick*=\\\"switchTab(\\\'combat\\\'\\\"]\");switchTab(\'combat\',b||null);}if(typeof openQuickPanelTab===\'function\'){openQuickPanelTab(\'combat\');}">Open Combat + Quick Access</button>'
      + '<button class="btn btn-xs btn-primary" onclick="resolveSeaDungeonBossOutcome(' + Number(roomIndex || 0) + ',true)">Victory</button>'
      + '<button class="btn btn-xs btn-red" onclick="resolveSeaDungeonBossOutcome(' + Number(roomIndex || 0) + ',false)">Defeat</button>'
      + '</div>';
    showNotif('Sea Ruin boss combat seeded.', 'warn');
    return openModal(data.name, buildDungeonModal(data));
  }

  function resolveSeaDungeonBossOutcome(roomIndex, success) {
    if (!S.lastSea || !S.lastSea.activeDungeon) return false;
    const hex = getSeaCell(S.lastSea.activeDungeon.col, S.lastSea.activeDungeon.row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !Array.isArray(data.generatedRooms) || !data.generatedRooms[roomIndex]) return false;
    var room = data.generatedRooms[roomIndex];
    if (!room || room.cleared || room.type !== 'Boss Chamber') return false;
    const pendingCheck = startCampaignGmCheckRecord({
      type: 'boss-outcome',
      scope: 'sea',
      label: 'Sea Dungeon Boss Outcome',
      stat: 'valor',
      dread: 8,
      context: 'Sea Ruin Warden outcome',
      payload: { roomIndex: Number(roomIndex || 0), dungeon: String(data.name || 'Sea Ruin') }
    });
    if (pendingCheck && pendingCheck.blocked) return false;
    const pendingCheckId = pendingCheck && pendingCheck.id ? String(pendingCheck.id) : '';
    resolveCampaignGmCheckRecord(pendingCheckId, {
      success: !!success,
      stat: 'valor',
      actionTotal: success ? 8 : 0,
      dreadTotal: 8,
      margin: success ? 1 : 2,
      failedBy: success ? 0 : 2,
      manual: true,
      outcomeType: 'boss-outcome'
    });
    if (success) {
      var reward;
      if (typeof rollProvinceRuinLoot === 'function') reward = rollProvinceRuinLoot('boss');
      else reward = rollSeaDungeonLoot();
      var rewardText = '';
      if (typeof applyProvinceRuinReward === 'function') rewardText = applyProvinceRuinReward(reward);
      else {
        rewardText = String(reward || 'Boss Cache');
        if (typeof addToBackpack === 'function' && reward) {
          try { addToBackpack(reward); } catch (_err) { console.error(_err); }
        }
      }
      room.result = '✓ Boss defeated — ' + rewardText;
      room.cleared = true;
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      S.renown = (S.renown || 0) + 1;
      if (typeof updateRenown === 'function') updateRenown();
      showNotif('Boss defeated: named weapon drop secured.', 'good');
    } else {
      if (typeof changeStress === 'function') changeStress(2);
      if (typeof addTMWOnFail === 'function') addTMWOnFail('general-failure', {
        failedBy: 2,
        actionDie: Math.max(4, Number((typeof getEffectiveDie === 'function') ? getEffectiveDie('valor') : ((S.stats && S.stats.valor) || 4)) || 4),
        dreadDie: 8,
        actionLabel: 'Valor Die'
      });
      room.result = '✕ Boss encounter failed — take 2 Damage and regroup.';
      room.cleared = true;
      showNotif('Boss outcome marked as failure.', 'warn');
    }
    syncSeaDungeonState('sea-dungeon-boss-outcome');
    return openModal(data.name, buildDungeonModal(data));
  }

  function startSeaDungeonPuzzle(roomIndex) {
    if (!S.lastSea || !S.lastSea.activeDungeon) return false;
    const hex = getSeaCell(S.lastSea.activeDungeon.col, S.lastSea.activeDungeon.row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !Array.isArray(data.generatedRooms) || !data.generatedRooms[roomIndex]) return false;
    const room = data.generatedRooms[roomIndex];
    if (!room || room.cleared || room.type !== 'Puzzle') return false;
    if (typeof openStandaloneStoryPuzzle !== 'function') {
      if (typeof showNotif === 'function') showNotif('Puzzle system unavailable. Falling back to room resolve.', 'warn');
      return false;
    }
    if (!room.puzzleSpec) {
      room.puzzleSpec = createSeaRuinPuzzleSpec();
    }
    const spec = room.puzzleSpec || createSeaRuinPuzzleSpec();
    if (!spec) return false;
    const pendingCheck = startCampaignGmCheckRecord({
      type: 'puzzle-outcome',
      scope: 'sea',
      label: 'Sea Dungeon Puzzle',
      stat: 'mind',
      dread: 6,
      context: String(spec.title || 'Sea Ruin Puzzle'),
      payload: { roomIndex: Number(roomIndex || 0), dungeon: String(data.name || 'Sea Ruin') }
    });
    if (pendingCheck && pendingCheck.blocked) return false;
    const pendingCheckId = pendingCheck && pendingCheck.id ? String(pendingCheck.id) : '';
    openStandaloneStoryPuzzle({
      mode: spec.mode,
      title: spec.title || 'Sea Ruin Puzzle',
      prompt: spec.prompt || 'Solve the lock.',
      answer: spec.answer,
      sequence: spec.sequence,
      bank: spec.bank,
      clues: spec.clues,
      gridTemplate: spec.gridTemplate,
      sudokuPuzzle: spec.sudokuPuzzle,
      sudokuSolution: spec.sudokuSolution,
      mazeLayout: spec.mazeLayout,
      thresholdLabel: 'Sea Ruin Puzzle',
      successThreshold: 0.7,
      partialThreshold: 0.45,
      onResolve: function (result) {
        const puzzleSuccess = result === 'success' || result === 'partial';
        resolveCampaignGmCheckRecord(pendingCheckId, {
          success: puzzleSuccess,
          stat: 'mind',
          actionTotal: result === 'success' ? 6 : (result === 'partial' ? 4 : 0),
          dreadTotal: 6,
          margin: result === 'success' ? 1 : (result === 'partial' ? 1 : 2),
          failedBy: puzzleSuccess ? 0 : 2,
          manual: true,
          outcomeType: 'puzzle-outcome',
          result: String(result || '')
        });
        if (result === 'success' || result === 'partial') {
          const loot = rollSeaDungeonLoot();
          data.exploration = data.exploration || { clearedRooms: 0, discoveredLoot: [] };
          data.exploration.clearedRooms += 1;
          data.exploration.discoveredLoot.push(loot);
          room.cleared = true;
          room.result = (result === 'success' ? '🧩 Solved' : '🧩 Partial success') + ' — Loot recovered: ' + loot + (result === 'partial' ? ' · Take 1 Damage.' : '');
          data.unlockedRooms = Math.min(Number(data.rooms || data.generatedRooms.length || 1), Number(data.unlockedRooms || 1) + 2);
          if (typeof addToBackpack === 'function') {
            try { addToBackpack(loot); } catch (_err) { console.error(_err); }
          }
          if (result === 'partial' && typeof changeStress === 'function') changeStress(1);
        } else {
          if (typeof changeStress === 'function') changeStress(2);
          if (typeof addTMWOnFail === 'function') addTMWOnFail('general-failure', {
            failedBy: 2,
            actionDie: 6,
            dreadDie: 6,
            actionLabel: 'Puzzle Check'
          });
          room.cleared = false;
          room.result = '🧩 Failed — lock backlash inflicts 2 Damage. This room blocks progress until solved.';
        }
        syncSeaDungeonState('sea-dungeon-puzzle');
        openModal(data.name, buildDungeonModal(data));
      }
    });
    return true;
  }

  function checkSeaDungeonPuzzle(col, row, roomIndex, inputId) {
    const hex = getSeaCell(col, row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !Array.isArray(data.generatedRooms) || !data.generatedRooms[roomIndex]) return;
    const room = data.generatedRooms[roomIndex];
    if (!room || room.cleared || !room.puzzleSpec) return;
    const input = document.getElementById(String(inputId || ''));
    const val = input ? String(input.value || '').trim().toLowerCase() : '';
    const spec = room.puzzleSpec;
    let solved = false;
    if (spec.mode === 'memory') {
      solved = val === String((spec.sequence || []).join(' ')).toLowerCase();
    } else {
      solved = val === String(spec.answer || '').trim().toLowerCase();
    }
    if (solved) {
      const loot = rollSeaDungeonLoot();
      data.exploration = data.exploration || { clearedRooms: 0, discoveredLoot: [] };
      data.exploration.clearedRooms += 1;
      data.exploration.discoveredLoot.push(loot);
      room.cleared = true;
      room.result = 'Puzzle solved. Loot recovered: ' + loot + '.';
      data.unlockedRooms = Math.min(Number(data.rooms || data.generatedRooms.length || 1), Number(data.unlockedRooms || 1) + 2);
      if (typeof addToBackpack === 'function') {
        try { addToBackpack(loot); } catch (_err) { console.error(_err); }
      }
      if (typeof showNotif === 'function') showNotif('Puzzle solved. ' + loot + ' recovered.', 'good');
    } else {
      room.result = 'Incorrect sequence. The lock grinds shut; force it or retry later.';
      if (typeof changeMentalStress === 'function') changeMentalStress(1);
      if (typeof showNotif === 'function') showNotif('Puzzle failed: +1 Mental Stress.', 'warn');
    }
    openModal(data.name, buildDungeonModal(data));
  }

  function seaDungeonSearchHidden(col, row) {
    const hex = getSeaCell(col, row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || data.hiddenSearched) return;
    const vd = (S.stats && S.stats.valor) ? S.stats.valor : ((S.stats && S.stats.action) ? S.stats.action : 4);
    const a = explodingRoll(vd);
    const d = explodingRoll(6);
    const success = a.total >= d.total;
    data.hiddenSearched = true;
    if (success) {
      const loot = rollSeaDungeonLoot();
      data.hiddenRoomResult = 'VD' + vd + ' ' + a.total + ' vs DD6 ' + d.total + ' — Hidden room revealed. Loot: ' + loot + '.';
      data.exploration = data.exploration || { clearedRooms: 0, discoveredLoot: [] };
      data.exploration.discoveredLoot.push(loot);
      if (typeof addToBackpack === 'function') {
        try { addToBackpack(loot); } catch (_err) { console.error(_err); }
      }
      if (typeof showNotif === 'function') showNotif('Hidden room found: ' + loot + '.', 'good');
    } else {
      data.hiddenRoomResult = 'VD' + vd + ' ' + a.total + ' vs DD6 ' + d.total + ' — No hidden rooms revealed.';
    }
    openModal(data.name, buildDungeonModal(data));
  }

  function selectSeaDungeonHexNode(nodeId) {
    if (!S.lastSea || !S.lastSea.activeDungeon) return;
    const hex = getSeaCell(S.lastSea.activeDungeon.col, S.lastSea.activeDungeon.row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !data.hexcrawl || !Array.isArray(data.hexcrawl.nodes)) return;
    const node = data.hexcrawl.nodes.find(function (entry) { return Number(entry.id) === Number(nodeId); });
    if (!node) return;
    data.hexcrawl.activeNodeId = Number(node.id || 0);
    openModal(data.name, buildDungeonModal(data));
  }

  function exploreSeaDungeonHexNode(nodeId) {
    if (!S.lastSea || !S.lastSea.activeDungeon) return;
    const hex = getSeaCell(S.lastSea.activeDungeon.col, S.lastSea.activeDungeon.row);
    const data = hex && hex.encounter && hex.encounter.type === 'dungeon' ? hex.encounter.data : hex && hex.siteType === 'dungeon' ? hex.siteData : null;
    if (!data || !data.hexcrawl || !Array.isArray(data.hexcrawl.nodes)) return;
    const node = data.hexcrawl.nodes.find(function (entry) { return Number(entry.id) === Number(nodeId); });
    if (!node || node.explored) return;
    const roomIndex = Math.max(0, Number(node.roomIndex || 0));
    node.explored = true;
    exploreSeaDungeonRoom(roomIndex);
  }
  window.selectSeaDungeonHexNode = selectSeaDungeonHexNode;
  window.exploreSeaDungeonHexNode = exploreSeaDungeonHexNode;
  window.exploreSeaDungeonRoom = exploreSeaDungeonRoom;
  window.startSeaDungeonPuzzle = startSeaDungeonPuzzle;
  window.startSeaDungeonBossCombat = startSeaDungeonBossCombat;
  window.resolveSeaDungeonBossOutcome = resolveSeaDungeonBossOutcome;
  window.checkSeaDungeonPuzzle = checkSeaDungeonPuzzle;
  window.seaDungeonSearchHidden = seaDungeonSearchHidden;

  function getRankData(rank) {
    return NAVAL_RANKS.find((item) => item.name === rank) || NAVAL_RANKS[0];
  }

  function getShipClass(name) {
    return NAVAL_SHIPS.find((ship) => ship.name === name) || NAVAL_SHIPS[0];
  }

  function rollCrewName() {
    const input = document.getElementById("navalCrewName");
    if (input) {
      input.value = `${pick(Math.random() < 0.5 ? NAMES.f : NAMES.m)} ${pick(NAMES.l)}`;
    }
  }

  function generateShipIdentity() {
    ensureExpansionState();
    const name = `${pick(SHIP_NAME_FIRST)} ${pick(SHIP_NAME_LAST)}`;
    const look = pick(SHIP_LOOKS);
    if (S.naval.ship) {
      S.naval.ship.name = name;
      S.naval.ship.look = look;
    } else {
      S.naval.pendingName = name;
      S.naval.pendingLook = look;
    }
    renderNaval();
    if (window.campaignSystem && typeof window.campaignSystem.syncSharedSilent === "function") {
      setTimeout(function () {
        try { window.campaignSystem.syncSharedSilent("naval-ship-identity"); } catch (_err) { console.error(_err); }
      }, 0);
    }
  }

  function createShipFromClass(className) {
    const shipClass = getShipClass(className);
    return {
      className: shipClass.name,
      name: S.naval.pendingName || `${shipClass.name} ${pick(SHIP_NAME_LAST)}`,
      look: S.naval.pendingLook || pick(SHIP_LOOKS),
      hullDie: shipClass.defend,
      strikeDie: shipClass.strike,
      shootDie: shipClass.shoot,
      feature: shipClass.feature,
      upgrades: [],
      stress: 0,
      wrecked: false,
      cargo: [],
      navBonus: 0,
      extraActions: shipClass.name === "Frigate" ? 1 : 0,
      leadBonus: shipClass.name === "Carrier" ? 1 : 0
    };
  }

  function buyShip(className) {
    ensureExpansionState();
    const shipClass = getShipClass(className);
    if (S.credits < shipClass.cost) {
      showNotif("Not enough Credits for that ship.", "warn");
      return;
    }

    S.naval.selectedClass = className;
    S.credits -= shipClass.cost;
    S.naval.ship = createShipFromClass(className);
    if (!S.naval.ship.id) S.naval.ship.id = makeNavalAllyId();
    S.naval.enemyShip = null;
    S.naval.enemyFleet = [];
    S.naval.targetEnemyId = "";
    S.naval.allyFleet = [S.naval.ship];
    S.naval.activeAllyId = S.naval.ship.id;
    S.naval.combatActive = false;
    S.naval.log.unshift({ text: `Purchased ${className} for ${shipClass.cost} Credits.`, type: "good" });
    updateCreditsUI();
    renderNaval();
    showNotif(`${className} added to the fleet.`, "good");
  }

  function getNavalUpgrade(id) {
    return NAVAL_UPGRADES.find((upgrade) => upgrade.id === id);
  }

  function buyNavalUpgrade(id) {
    ensureExpansionState();
    const ship = S.naval.ship;
    const upgrade = getNavalUpgrade(id);
    if (!ship || !upgrade) {
      showNotif("Buy a ship before installing upgrades.", "warn");
      return;
    }
    if (!upgrade.classes.includes(ship.className)) {
      showNotif("That upgrade does not fit this class.", "warn");
      return;
    }
    if (ship.upgrades.includes(id)) {
      showNotif("Upgrade already installed.", "warn");
      return;
    }
    if (S.credits < upgrade.cost || S.pathTokens < upgrade.pathCost) {
      showNotif("Not enough Credits or Path Tokens.", "warn");
      return;
    }

    S.credits -= upgrade.cost;
    S.pathTokens -= upgrade.pathCost;
    ship.upgrades.push(id);

    if (id === "installed-weapons") {
      ship.strikeDie = ship.strikeDie || 4;
      ship.shootDie = ship.shootDie || 4;
    } else if (id === "improved-navigation") {
      ship.navBonus += 2;
    } else if (id === "improved-combat") {
      ship.strikeDie = Math.max(ship.strikeDie || 4, 8);
      ship.shootDie = Math.max(ship.shootDie || 4, 8);
    } else if (id === "improved-defenses") {
      ship.hullDie = stepUp(ship.hullDie);
    } else if (id === "captains-hq") {
      ship.leadBonus += 1;
      ship.extraActions += 1;
    }

    updateCreditsUI();
    renderNaval();
    showNotif(`${upgrade.name} installed.`, "good");
  }

  function getCrewCost(role, rank) {
    return getRankData(rank).baseCost + (NAVAL_ROLE_COSTS[rank][role] || 0);
  }

  function getCrewAbilities(role, rank) {
    const abilities = [];
    if (rank === "Experienced" || rank === "Veteran" || rank === "Elite") {
      abilities.push(...NAVAL_ABILITIES[role].Experienced);
    }
    if (rank === "Veteran" || rank === "Elite") {
      abilities.push(...NAVAL_ABILITIES[role].Veteran);
    }
    if (rank === "Elite") {
      abilities.push(...NAVAL_ABILITIES[role].Elite);
    }
    return abilities;
  }

  function hireNavalCrew() {
    ensureExpansionState();
    const role = document.getElementById("navalCrewRole")?.value || "Captain";
    const rank = document.getElementById("navalCrewRank")?.value || "Rookie";
    const input = document.getElementById("navalCrewName");
    const name = input && input.value.trim() ? input.value.trim() : `${pick(Math.random() < 0.5 ? NAMES.f : NAMES.m)} ${pick(NAMES.l)}`;
    const cost = getCrewCost(role, rank);
    if (S.credits < cost) {
      showNotif("Not enough Credits to hire that crew member.", "warn");
      return;
    }

    S.credits -= cost;
    S.naval.crew.push({
      id: Date.now() + Math.random(),
      name,
      role,
      rank
    });
    if (input) {
      input.value = "";
    }
    updateCreditsUI();
    renderNaval();
    showNotif(`${name} hired as ${rank} ${role}.`, "good");
  }

  function removeNavalCrew(id) {
    ensureExpansionState();
    S.naval.crew = S.naval.crew.filter((member) => member.id !== id);
    renderNaval();
  }

  function trainNavalCrew(id) {
    ensureExpansionState();
    const crew = S.naval.crew.find((member) => member.id === id);
    if (!crew) {
      return;
    }
    const currentIndex = NAVAL_RANKS.findIndex((rank) => rank.name === crew.rank);
    const nextRank = NAVAL_RANKS[currentIndex + 1];
    if (!nextRank) {
      showNotif("That crew member is already Elite.", "warn");
      return;
    }
    if (S.pathTokens < nextRank.train) {
      showNotif("Not enough Path Tokens to train that crew member.", "warn");
      return;
    }
    S.pathTokens -= nextRank.train;
    crew.rank = nextRank.name;
    renderNaval();
    showNotif(`${crew.name} trained to ${nextRank.name}.`, "good");
  }

  function getEffectiveShipDie(ship, stat, isPlayer) {
    if (!ship) {
      return null;
    }

    let value = stat === "hull" ? ship.hullDie : stat === "strike" ? ship.strikeDie : ship.shootDie;
    if (isPlayer && S.naval.powerShift) {
      if (S.naval.powerShift.from === stat && value) {
        value = stepDown(value);
      }
      if (S.naval.powerShift.to === stat) {
        value = value ? stepUp(value) : 4;
      }
    }
    return value;
  }

  function getShipThreshold(ship, isPlayer) {
    const hull = getEffectiveShipDie(ship, "hull", isPlayer) || 4;
    return hull * 2;
  }

  function countCrewRole(role, rank) {
    return S.naval.crew.filter((member) => member.role === role && (!rank || member.rank === rank)).length;
  }

  function getPlayerActionCount() {
    const ship = S.naval.ship;
    const crewCount = Math.max(1, S.naval.crew.length || 0);
    const eliteCaptainBonus = countCrewRole("Captain", "Elite") ? 2 : 0;
    return crewCount + (ship ? ship.extraActions || 0 : 0) + eliteCaptainBonus;
  }

  function makeNavalEnemyId() {
    return "naval-enemy-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }

  function makeNavalAllyId() {
    return "naval-ally-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }

  function buildCompactStressBarChip(label, current, max, tone) {
    const safeMax = Math.max(1, Number(max || 1));
    const safeCurrent = Math.max(0, Math.min(safeMax, Number(current || 0)));
    const pct = Math.max(0, Math.min(100, Math.round((safeCurrent / safeMax) * 100)));
    const barTone = tone || "#46c4b6";
    return '<div style="display:inline-flex;align-items:center;gap:.18rem;border:1px solid var(--border2);padding:.1rem .18rem;background:rgba(255,255,255,.02);">'
      + '<span style="font-size:.62rem;color:var(--muted2);">' + label + '</span>'
      + '<span style="font-size:.62rem;color:var(--text2);">' + safeCurrent + '/' + safeMax + '</span>'
      + '<span style="display:inline-block;width:52px;height:6px;border:1px solid var(--border2);background:rgba(0,0,0,.35);position:relative;overflow:hidden;">'
      + '<span style="position:absolute;left:0;top:0;height:100%;width:' + pct + '%;background:' + barTone + ';"></span>'
      + '</span>'
      + '</div>';
  }

  function getNavalManualPresetDice(actionId) {
    const ally = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    const presets = {
      "fire-batteries": { actionDie: Number(getEffectiveShipDie(ally, "strike", true) || 6), oppDie: Number(getEffectiveShipDie(enemy, "hull", false) || 6), actionLabel: "Ship Strike", oppLabel: "Enemy Hull" },
      "launch-volley": { actionDie: Number(getEffectiveShipDie(ally, "shoot", true) || 6), oppDie: Number(getEffectiveShipDie(enemy, "hull", false) || 6), actionLabel: "Ship Shoot", oppLabel: "Enemy Hull" },
      "patch-shields": { actionDie: Number(getNavalRoleDie("engineer", "body") || 6), oppDie: Number(getNavalEnemyDreadDie() || 6), actionLabel: "Engineer Body", oppLabel: "Enemy Dread" },
      "captain-tactics": { actionDie: Number(getNavalRoleDie("captain", "lead") || 6), oppDie: Number(getNavalEnemyDreadDie() || 6), actionLabel: "Captain Lead", oppLabel: "Enemy Dread" },
      "captain-morale": { actionDie: Number(getNavalRoleDie("captain", "spirit") || 6), oppDie: Number(getNavalEnemyDreadDie() || 6), actionLabel: "Captain Spirit", oppLabel: "Enemy Dread" },
      "navigator-survey": { actionDie: Number(getNavalRoleDie("navigator", "mind") || 6), oppDie: Number(getNavalEnemyDreadDie() || 6), actionLabel: "Navigator Mind", oppLabel: "Enemy Dread" },
      "captain-diplomacy": { actionDie: Number(getNavalRoleDie("captain", "lead") || 6), oppDie: Number(getNavalEnemyDreadDie() || 6), actionLabel: "Captain Lead", oppLabel: "Enemy Dread" },
      "hostile-attack": { actionDie: Number(getEffectiveShipDie(enemy, (S.naval.zone === "Nearby" ? "shoot" : "strike"), false) || 6), oppDie: Number(getEffectiveShipDie(ally, "hull", true) || 6), actionLabel: "Enemy Weapon", oppLabel: "Ally Hull" }
    };
    return presets[actionId] || { actionDie: 6, oppDie: 6, actionLabel: "Action", oppLabel: "Opposition" };
  }

  function ensureNavalAllyFleetState() {
    const allies = Array.isArray(S.naval.allyFleet) ? S.naval.allyFleet : [];
    if (S.naval.ship && !allies.includes(S.naval.ship)) {
      allies.unshift(S.naval.ship);
    }
    allies.forEach(function(ally) {
      if (!ally) return;
      if (!ally.id) ally.id = makeNavalAllyId();
      ally.stress = Number(ally.stress || 0);
      ally.wrecked = !!ally.wrecked;
    });
    S.naval.allyFleet = allies.filter(Boolean);
    if (S.naval.activeAllyId && !S.naval.allyFleet.some(function(ally) { return ally && ally.id === S.naval.activeAllyId; })) {
      S.naval.activeAllyId = "";
    }
    if (!S.naval.activeAllyId && S.naval.allyFleet.length) {
      const preferred = S.naval.allyFleet.find(function(ally) { return ally && !ally.wrecked; }) || S.naval.allyFleet[0];
      S.naval.activeAllyId = preferred && preferred.id ? preferred.id : "";
    }
    let active = null;
    if (S.naval.activeAllyId) {
      active = S.naval.allyFleet.find(function(ally) { return ally && ally.id === S.naval.activeAllyId; }) || null;
    }
    if (!active && S.naval.allyFleet.length) {
      active = S.naval.allyFleet[0];
      S.naval.activeAllyId = active && active.id ? active.id : "";
    }
    S.naval.ship = active || null;
    return S.naval.allyFleet;
  }

  function getActiveNavalAlly() {
    ensureNavalAllyFleetState();
    return S.naval.ship || null;
  }

  function setActiveNavalAlly(allyId) {
    ensureNavalAllyFleetState();
    const id = String(allyId || "");
    if (!id) return false;
    const next = S.naval.allyFleet.find(function(ally) { return ally && String(ally.id || "") === id; }) || null;
    if (!next) return false;
    S.naval.activeAllyId = id;
    S.naval.ship = next;
    renderNaval();
    renderNavalCombatPopup();
    return true;
  }

  function spawnAllyShip() {
    ensureExpansionState();
    const className = document.getElementById("navalShipClass")?.value || S.naval.selectedClass || (S.naval.ship && S.naval.ship.className) || "Skiff";
    const ally = createShipFromClass(className);
    ally.name = `${pick(SHIP_NAME_FIRST)} ${pick(SHIP_NAME_LAST)}`;
    ally.id = makeNavalAllyId();
    ensureNavalAllyFleetState();
    S.naval.allyFleet.push(ally);
    S.naval.activeAllyId = ally.id;
    S.naval.ship = ally;
    renderNaval();
    showNotif(`Ally ${className} joined (${S.naval.allyFleet.length} ally ship${S.naval.allyFleet.length === 1 ? '' : 's'}).`, "good");
  }

  function openNavalCardManualPrompt(actionId) {
    const configs = {
      "fire-batteries": { title: "Manual - Fire Batteries", effect: "damage", label: "Batteries" },
      "launch-volley": { title: "Manual - Launch Volley", effect: "damage", label: "Volley" },
      "patch-shields": { title: "Manual - Patch Shields", effect: "repair", label: "Patch Shields" },
      "captain-tactics": { title: "Manual - Captain Tactics", effect: "tactics", label: "Captain Tactics" },
      "captain-morale": { title: "Manual - Captain Morale", effect: "morale", label: "Captain Morale" },
      "navigator-survey": { title: "Manual - Navigator Survey", effect: "survey", label: "Navigator Survey" },
      "captain-diplomacy": { title: "Manual - Captain Diplomacy", effect: "diplomacy", label: "Captain Diplomacy" },
      "hostile-attack": { title: "Manual - Hostile Attack", effect: "hostile", label: "Hostile Attack" }
    };
    const cfg = configs[actionId];
    if (!cfg) {
      showNotif("Manual entry not needed for this card.", "info");
      return false;
    }
    const preset = getNavalManualPresetDice(actionId);
    const html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.55;">'
      + '<div style="margin-bottom:.2rem;color:var(--gold2);font-family:\'Cinzel\',serif;">' + cfg.title + '</div>'
      + '<div style="font-size:.7rem;color:var(--teal2);margin-bottom:.14rem;">Preset: ' + preset.actionLabel + ' d' + preset.actionDie + ' vs ' + preset.oppLabel + ' d' + preset.oppDie + '</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.24rem;">Enter final totals from physical dice and table modifiers.</div>'
      + '<label style="display:block;font-size:.72rem;color:var(--muted2);margin-bottom:.08rem;">Action Total</label>'
      + '<input id="navalManualActionTotal" type="text" inputmode="text" placeholder="e.g. 8+7" value="' + Number(preset.actionDie || 0) + '" style="width:100%;margin-bottom:.18rem;">'
      + '<label style="display:block;font-size:.72rem;color:var(--muted2);margin-bottom:.08rem;">Opposition Total</label>'
      + '<input id="navalManualOppTotal" type="text" inputmode="text" placeholder="e.g. 7+3" value="' + Number(preset.oppDie || 0) + '" style="width:100%;margin-bottom:.24rem;">'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-teal" onclick="resolveNavalCardManualPrompt(\'' + actionId + '\')">Apply</button>'
      + '<button class="btn btn-xs" onclick="closeModal();openNavalCombatPopup();">Cancel</button>'
      + '</div>'
      + '</div>';
    openModal("Naval Manual Roll", html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function resolveNavalCardManualPrompt(actionId) {
    const actionEl = document.getElementById("navalManualActionTotal");
    const oppEl = document.getElementById("navalManualOppTotal");
    const actionVal = (window.BTLRules && typeof window.BTLRules.readManualTotal === "function") ? window.BTLRules.readManualTotal(actionEl, 1) : Number(actionEl?.value || 0);
    const oppVal = (window.BTLRules && typeof window.BTLRules.readManualTotal === "function") ? window.BTLRules.readManualTotal(oppEl, 1) : Number(oppEl?.value || 0);
    if (!Number.isFinite(actionVal) || !Number.isFinite(oppVal) || actionVal < 1 || oppVal < 1) {
      showNotif("Enter valid manual totals first (examples: 8+7, 11).", "warn");
      return false;
    }
    closeModal();
    const ally = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    if (!ally) return false;
    const diff = actionVal - oppVal;
    if (actionId === "fire-batteries" || actionId === "launch-volley") {
      if (!enemy) return false;
      if (!spendNavalAction("player")) return false;
      if (diff >= 0) {
        const stress = Math.max(1, diff);
        damageShip(enemy, stress, "enemy");
        navalLog((actionId === "fire-batteries" ? "Manual batteries" : "Manual volley") + " hit for " + stress + " Stress (" + actionVal + " vs " + oppVal + ").", "good");
        if (typeof addSuccessRoll === "function") addSuccessRoll();
      } else {
        navalLog("Manual attack missed (" + actionVal + " vs " + oppVal + ").", "warn");
        if (typeof addTMWOnFail === "function") addTMWOnFail("naval-manual-attack", { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
      }
    } else if (actionId === "patch-shields") {
      if (!spendNavalAction("player")) return false;
      if (diff >= 0) {
        const repair = Math.max(1, diff);
        ally.stress = Math.max(0, Number(ally.stress || 0) - repair);
        navalLog("Manual repair removed " + repair + " Stress (" + actionVal + " vs " + oppVal + ").", "good");
        if (typeof addSuccessRoll === "function") addSuccessRoll();
      } else {
        navalLog("Manual repair failed (" + actionVal + " vs " + oppVal + ").", "warn");
        if (typeof addTMWOnFail === "function") addTMWOnFail("naval-manual-repair", { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
      }
    } else if (actionId === "captain-tactics") {
      if (!spendNavalAction("player")) return false;
      S.naval.tacticsBonus = diff;
      navalLog("Manual tactics set modifier " + (diff >= 0 ? "+" : "") + diff + " (" + actionVal + " vs " + oppVal + ").", diff >= 0 ? "good" : "warn");
      if (diff >= 0 && typeof addSuccessRoll === "function") addSuccessRoll();
      else if (diff < 0 && typeof addTMWOnFail === "function") addTMWOnFail("naval-manual-tactics", { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
    } else if (actionId === "captain-morale") {
      if (!spendNavalAction("player")) return false;
      navalLog("Manual morale " + (diff >= 0 ? "succeeded" : "failed") + " (" + actionVal + " vs " + oppVal + ").", diff >= 0 ? "good" : "warn");
      if (diff >= 0 && typeof addSuccessRoll === "function") addSuccessRoll();
      else if (diff < 0 && typeof addTMWOnFail === "function") addTMWOnFail("naval-manual-morale", { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
    } else if (actionId === "navigator-survey") {
      if (!spendNavalAction("player")) return false;
      navalLog("Manual survey " + (diff >= 0 ? "succeeded" : "failed") + " (" + actionVal + " vs " + oppVal + ").", diff >= 0 ? "good" : "warn");
      if (diff >= 0 && typeof addSuccessRoll === "function") addSuccessRoll();
      else if (diff < 0 && typeof addTMWOnFail === "function") addTMWOnFail("naval-manual-survey", { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
    } else if (actionId === "captain-diplomacy") {
      if (!spendNavalAction("player")) return false;
      const perception = shiftPerception(diff >= 0 ? -1 : 1);
      navalLog("Manual diplomacy " + (diff >= 0 ? "succeeded" : "failed") + " (" + actionVal + " vs " + oppVal + "). Perception now " + perception + ".", diff >= 0 ? "good" : "warn");
      if (diff >= 0 && typeof addSuccessRoll === "function") addSuccessRoll();
      else if (diff < 0 && typeof addTMWOnFail === "function") addTMWOnFail("naval-manual-diplomacy", { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
    } else if (actionId === "hostile-attack") {
      if (!enemy || !spendNavalAction("enemy")) return false;
      if (diff >= 0) {
        const stress = Math.max(1, diff);
        damageShip(ally, stress, "player");
        navalLog("Manual hostile attack hit for " + stress + " Stress (" + actionVal + " vs " + oppVal + ").", "warn");
      } else {
        navalLog("Manual hostile attack failed (" + actionVal + " vs " + oppVal + ").", "good");
      }
    }
    renderNaval();
    openNavalCombatPopup();
    return true;
  }

  function ensureNavalEnemyFleetState() {
    const fleet = Array.isArray(S.naval.enemyFleet) ? S.naval.enemyFleet : [];
    if (S.naval.enemyShip && !fleet.includes(S.naval.enemyShip)) {
      fleet.push(S.naval.enemyShip);
    }
    fleet.forEach(function(enemy) {
      if (!enemy) return;
      if (!enemy.id) enemy.id = makeNavalEnemyId();
      enemy.stress = Number(enemy.stress || 0);
      enemy.wrecked = !!enemy.wrecked;
    });
    S.naval.enemyFleet = fleet.filter(Boolean);
    if (S.naval.targetEnemyId && !S.naval.enemyFleet.some(function(enemy) { return enemy && enemy.id === S.naval.targetEnemyId; })) {
      S.naval.targetEnemyId = "";
    }
    if (!S.naval.targetEnemyId && S.naval.enemyFleet.length && !S.naval.focusFireLock) {
      const preferred = S.naval.enemyFleet.find(function(enemy) { return enemy && !enemy.wrecked; }) || S.naval.enemyFleet[0];
      S.naval.targetEnemyId = preferred && preferred.id ? preferred.id : "";
    }
    let activeEnemy = null;
    if (S.naval.targetEnemyId) {
      activeEnemy = S.naval.enemyFleet.find(function(enemy) { return enemy && enemy.id === S.naval.targetEnemyId; }) || null;
    }
    if (!activeEnemy && S.naval.enemyFleet.length && !S.naval.focusFireLock) {
      activeEnemy = S.naval.enemyFleet[0];
      S.naval.targetEnemyId = activeEnemy && activeEnemy.id ? activeEnemy.id : "";
    }
    S.naval.enemyShip = activeEnemy || null;
    return S.naval.enemyFleet;
  }

  function getActiveNavalEnemy() {
    ensureNavalEnemyFleetState();
    return S.naval.enemyShip || null;
  }

  function setActiveNavalEnemy(enemyId) {
    ensureNavalEnemyFleetState();
    const id = String(enemyId || "");
    if (!id) return false;
    const next = S.naval.enemyFleet.find(function(enemy) { return enemy && String(enemy.id || "") === id; }) || null;
    if (!next) return false;
    S.naval.targetEnemyId = id;
    S.naval.enemyShip = next;
    renderNaval();
    renderNavalCombatPopup();
    return true;
  }

  function getNavalRoleRoster() {
    let roster = [];
    if (typeof window !== "undefined" && window.campaignSystem && typeof window.campaignSystem.buildPartyRoster === "function") {
      try {
        roster = window.campaignSystem.buildPartyRoster() || [];
      } catch (_err) {
        roster = [];
      }
    }
    if (!Array.isArray(roster) || !roster.length) {
      roster = [{
        token: "local-wayfarer",
        name: String((S && S.name) || "Wayfarer"),
        character: {
          name: String((S && S.name) || "Wayfarer"),
          stats: Object.assign({}, (S && S.stats) || {})
        }
      }];
    }
    return roster;
  }

  function getNavalRoleAssignments() {
    if (!S.naval.roleAssignments || typeof S.naval.roleAssignments !== "object") {
      S.naval.roleAssignments = { captain: "", navigator: "", engineer: "", gunner: "" };
    }
    return S.naval.roleAssignments;
  }

  function getAssignedNavalRoleMember(roleKey) {
    const roster = getNavalRoleRoster();
    const assignments = getNavalRoleAssignments();
    const token = String(assignments[roleKey] || "");
    const assigned = roster.find(function(entry) { return String(entry && entry.token || "") === token; }) || null;
    return assigned || roster[0] || null;
  }

  function getNavalRoleDie(roleKey, statKey) {
    const member = getAssignedNavalRoleMember(roleKey);
    const stats = member && member.character && member.character.stats ? member.character.stats : null;
    const raw = Number((stats && stats[statKey]) || (S.stats && S.stats[statKey]) || 4);
    return Math.max(4, raw || 4);
  }

  function assignNavalRole(roleKey, token) {
    const allowed = ["captain", "navigator", "engineer", "gunner"];
    const role = String(roleKey || "").toLowerCase();
    if (allowed.indexOf(role) < 0) return false;
    const roster = getNavalRoleRoster();
    const tokenValue = String(token || "");
    const exists = roster.some(function(entry) { return String(entry && entry.token || "") === tokenValue; });
    if (!exists) return false;
    const assignments = getNavalRoleAssignments();
    assignments[role] = tokenValue;
    renderNavalCombatPopup();
    return true;
  }

  function buildNavalRoleAssignmentHtml() {
    const roster = getNavalRoleRoster();
    const assignments = getNavalRoleAssignments();
    const rows = [
      { key: "captain", label: "Captain", hint: "Lead/Morale/Diplomacy" },
      { key: "navigator", label: "Navigator", hint: "Control/Mind Survey" },
      { key: "engineer", label: "Engineer", hint: "Body Repair" },
      { key: "gunner", label: "Gunner", hint: "Strike/Shoot Calls" }
    ];
    return '<div style="border:1px solid var(--border2);padding:.28rem .32rem;background:rgba(255,255,255,.02);margin-bottom:.34rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;margin-bottom:.14rem;">Campaign Role Dice</div>'
      + '<div style="font-size:.69rem;color:var(--muted2);margin-bottom:.2rem;">Assign a Wayfarer to each station. Their sheet dice drive that role\'s rolls in this popup.</div>'
      + rows.map(function(row) {
          const selected = String(assignments[row.key] || "");
          const member = getAssignedNavalRoleMember(row.key);
          const leadDie = getNavalRoleDie(row.key, "lead");
          const spiritDie = getNavalRoleDie(row.key, "spirit");
          const mindDie = getNavalRoleDie(row.key, "mind");
          const controlDie = getNavalRoleDie(row.key, "control");
          const bodyDie = getNavalRoleDie(row.key, "body");
          return '<div style="display:grid;grid-template-columns:8.5rem 1fr auto;gap:.24rem;align-items:center;margin-bottom:.18rem;">'
            + '<div style="font-size:.7rem;color:var(--teal2);">' + row.label + '<div style="font-size:.62rem;color:var(--muted2);">' + row.hint + '</div></div>'
            + '<select onchange="runNavalPopupAction(\'assign-role\',\'' + row.key + ':\' + this.value)" style="width:100%;">'
            + roster.map(function(entry) {
                const token = String(entry && entry.token || "");
                const name = String(entry && entry.character && entry.character.name || entry && entry.name || "Wayfarer");
                return '<option value="' + token + '"' + (token === selected ? ' selected' : '') + '>' + name + '</option>';
              }).join("")
            + '</select>'
            + '<div style="font-size:.62rem;color:var(--muted2);white-space:nowrap;">'
            + String(member && member.character && member.character.name || member && member.name || "Wayfarer")
            + ' · dLead ' + leadDie
            + ' · dSpirit ' + spiritDie
            + ' · dMind ' + mindDie
            + ' · dControl ' + controlDie
            + ' · dBody ' + bodyDie
            + '</div>'
            + '</div>';
        }).join("")
      + '</div>';
  }

  function getNavalEnemyDreadDie() {
    const enemy = getActiveNavalEnemy();
    return getEffectiveShipDie(enemy, "hull", false) || 6;
  }

  function ensureNavalActionPools() {
    if (!Number.isFinite(Number(S.naval.actionsRemaining))) {
      S.naval.actionsRemaining = getPlayerActionCount();
    }
    if (!Number.isFinite(Number(S.naval.enemyActionsRemaining))) {
      S.naval.enemyActionsRemaining = 2;
    }
  }

  function spendNavalAction(side) {
    ensureNavalActionPools();
    if (side === "enemy") {
      if (S.naval.enemyActionsRemaining <= 0) {
        showNotif("Enemy has no Actions left this round.", "warn");
        return false;
      }
      S.naval.enemyActionsRemaining -= 1;
      return true;
    }
    if (S.naval.actionsRemaining <= 0) {
      showNotif("No Actions left this round. Start next round.", "warn");
      return false;
    }
    S.naval.actionsRemaining -= 1;
    return true;
  }

  function setNavalConditionState(key, active) {
    if (!S || !S.conditions || !(key in S.conditions)) return;
    S.conditions[key] = !!active;
    if (typeof updateConditionButtons === "function") updateConditionButtons();
    if (typeof updateAllStatDisplays === "function") updateAllStatDisplays();
  }

  function shiftPerception(step) {
    const order = ["friendly", "indifferent", "hostile"];
    const current = String(S.naval.perception || "indifferent").toLowerCase();
    const idx = Math.max(0, order.indexOf(current));
    const next = Math.max(0, Math.min(order.length - 1, idx + Number(step || 0)));
    S.naval.perception = order[next];
    return S.naval.perception;
  }

  function syncNavalStateToVttCombat() {
    if (!S || !S.combat || !S.combat.active) return;
    if (!S.naval || !S.naval.combatActive) return;
    if (S.naval.boardingSession && S.naval.boardingSession.active) return;
    S.combat.spacing = S.naval.zone || S.combat.spacing || "Close";
    S.combat.enemyDread = getNavalEnemyDreadDie();
    if (typeof updateCombatUI === "function") updateCombatUI();
    if (typeof renderCombatMap === "function") renderCombatMap();
    if (typeof queueCampaignCombatSceneSync === "function") {
      queueCampaignCombatSceneSync("naval-state-sync");
    }
  }

  function renderShipSummary(ship, isPlayer) {
    const inSpaceNavalContext = (typeof window !== "undefined" && (window._activeContext || S._navalContext) === "space");
    if (!ship) {
      return `<div class="ship-copy">${inSpaceNavalContext ? "No starship acquired yet." : "No ship purchased yet."}</div>`;
    }
    const iconApi = (typeof window !== "undefined") ? window.SharedIconSystem : null;
    const shipIcon = iconApi && typeof iconApi.iconVehicle === "function"
      ? iconApi.iconVehicle(inSpaceNavalContext ? "starship" : "naval", { size: 30, title: ship.name || ship.className || (inSpaceNavalContext ? "Starship" : "Ship") })
      : (inSpaceNavalContext ? "🚀" : "⛵");
    const hull = getEffectiveShipDie(ship, "hull", isPlayer);
    const strike = getEffectiveShipDie(ship, "strike", isPlayer);
    const shoot = getEffectiveShipDie(ship, "shoot", isPlayer);
    const threshold = getShipThreshold(ship, isPlayer);
    return `
      <div class="ship-name" style="display:flex;align-items:center;gap:.45rem;">${shipIcon}<span>${ship.name}</span></div>
      <div class="ship-class">${ship.className}</div>
      <div class="ship-copy">${ship.look}</div>
      <div class="ship-stats">
        <div class="ship-stat"><span class="label">Hull</span><span class="value">d${hull}</span></div>
        <div class="ship-stat"><span class="label">Strike</span><span class="value">${strike ? `d${strike}` : "-"}</span></div>
        <div class="ship-stat"><span class="label">Shoot</span><span class="value">${shoot ? `d${shoot}` : "-"}</span></div>
      </div>
      <div class="ship-copy" style="margin-top:.35rem;">
        Stress: <strong style="color:var(--red2);">${ship.stress}</strong> / ${threshold}<br>
        ${ship.feature}<br>
        ${ship.upgrades.length ? `Upgrades: ${ship.upgrades.map((item) => getNavalUpgrade(item)?.name).filter(Boolean).join(", ")}` : "No installed upgrades."}
      </div>
    `;
  }

  function renderNavalZoneTrack() {
    const track = document.getElementById("navalZoneTrack");
    const readout = document.getElementById("navalZoneReadout");
    if (readout) {
      readout.textContent = S.naval.zone;
    }
    if (!track) {
      return;
    }
    track.innerHTML = NAVAL_ZONES.map((zone) => `<span class="zone-pill ${zone === S.naval.zone ? "on" : ""}">${zone}</span>`).join("");
  }

  function renderNaval() {
    ensureExpansionState();
    const shipSummary = document.getElementById("navalShipSummary");
    const shipGrid = document.getElementById("navalShipGrid");
    const upgradeList = document.getElementById("navalUpgradeList");
    const crewRoster = document.getElementById("navalCrewRoster");
    const combatSummary = document.getElementById("navalCombatSummary");
    const combatLog = document.getElementById("navalCombatLog");
    const credits = document.getElementById("navalCredits");
    const path = document.getElementById("navalPathTokens");
    const trauma = document.getElementById("navalCrewTrauma");

    if (credits) {
      credits.textContent = `${S.credits} ₵`;
    }
    if (path) {
      path.textContent = String(S.pathTokens || 0);
    }
    if (trauma) {
      trauma.textContent = String(S.naval.crewTrauma || 0);
    }

    if (shipSummary) {
      const identityLine = !S.naval.ship && (S.naval.pendingName || S.naval.pendingLook)
        ? `<div class="ship-copy" style="margin-bottom:.45rem;"><strong style="color:var(--gold2);">${S.naval.pendingName || "Unnamed hull"}</strong><br>${S.naval.pendingLook || ""}</div>`
        : "";
      shipSummary.innerHTML = `${identityLine}${renderShipSummary(S.naval.ship, true)}`;
    }

    if (shipGrid) {
      shipGrid.innerHTML = NAVAL_SHIPS.map((ship) => {
        const owned = S.naval.ship && S.naval.ship.className === ship.name;
        return `
          <div class="ship-card ${S.naval.selectedClass === ship.name ? "sel" : ""} ${owned ? "owned" : ""}">
            <div class="ship-name">${ship.name}</div>
            <div class="ship-class">${ship.cost.toLocaleString()} Credits</div>
            <div class="ship-stats">
              <div class="ship-stat"><span class="label">Hull</span><span class="value">d${ship.defend}</span></div>
              <div class="ship-stat"><span class="label">Strike</span><span class="value">${ship.strike ? `d${ship.strike}` : "-"}</span></div>
              <div class="ship-stat"><span class="label">Shoot</span><span class="value">${ship.shoot ? `d${ship.shoot}` : "-"}</span></div>
            </div>
            <div class="ship-copy">${ship.feature}</div>
            <div style="display:flex;gap:.35rem;flex-wrap:wrap;">
              <button class="btn btn-xs" onclick="selectNavalClass('${ship.name}')">Select</button>
              <button class="btn btn-xs btn-primary" onclick="buyShip('${ship.name}')">${owned ? "Owned" : "Buy"}</button>
            </div>
          </div>
        `;
      }).join("");
    }

    if (upgradeList) {
      if (!S.naval.ship) {
        upgradeList.innerHTML = '<div class="upgrade-card"><div class="upgrade-copy">Buy a ship first to see compatible upgrades.</div></div>';
      } else {
        const relevant = NAVAL_UPGRADES.filter((upgrade) => upgrade.classes.includes(S.naval.ship.className));
        upgradeList.innerHTML = relevant.map((upgrade) => `
          <div class="upgrade-card">
            <div class="upgrade-copy">
              <strong style="color:var(--gold2);">${upgrade.name}</strong><br>
              ${upgrade.effect}<br>
              Cost: ${upgrade.cost} Credits + ${upgrade.pathCost} Path Tokens
            </div>
            <button class="btn btn-xs ${S.naval.ship.upgrades.includes(upgrade.id) ? "" : "btn-primary"}" onclick="buyNavalUpgrade('${upgrade.id}')">${S.naval.ship.upgrades.includes(upgrade.id) ? "Installed" : "Install"}</button>
          </div>
        `).join("");
      }
    }

    if (crewRoster) {
      if (!S.naval.crew.length) {
        crewRoster.innerHTML = '<div class="crew-card"><div class="ship-copy">No crew hired yet.</div></div>';
      } else {
        crewRoster.innerHTML = S.naval.crew.map((member) => `
          <div class="crew-card">
            <div class="crew-top">
              <div>
                <div class="crew-name">${member.name}</div>
                <div class="crew-role">${member.rank} ${member.role}</div>
                <div class="ship-copy">${NAVAL_ROLE_META[member.role].pair}</div>
              </div>
              <div class="ship-copy">Hire value: ${getCrewCost(member.role, member.rank)} C</div>
            </div>
            <div style="margin-top:.35rem;">
              ${getCrewAbilities(member.role, member.rank).length
                ? getCrewAbilities(member.role, member.rank).map((ability) => `<div class="crew-ability">${ability}</div>`).join("")
                : '<div class="crew-ability">No special abilities yet.</div>'}
            </div>
            <div class="crew-actions">
              <button class="btn btn-xs" onclick="trainNavalCrew(${member.id})">Train</button>
              <button class="btn btn-xs btn-red" onclick="removeNavalCrew(${member.id})">Dismiss</button>
            </div>
          </div>
        `).join("");
      }
    }

    if (combatSummary) {
      combatSummary.innerHTML = `
        <div class="combat-card" style="margin-bottom:.45rem;">${renderShipSummary(S.naval.ship, true)}</div>
        <div class="combat-card" style="margin-bottom:.45rem;">${renderShipSummary(getActiveNavalEnemy(), false)}</div>
        <div class="combat-card">
          <div class="ship-copy">
            Round: <strong style="color:var(--gold2);">${S.naval.round}</strong><br>
            Actions remaining: <strong style="color:var(--gold2);">${S.naval.actionsRemaining || 0}</strong> / ${getPlayerActionCount()}<br>
            Enemy actions remaining: <strong style="color:var(--red2);">${S.naval.enemyActionsRemaining || 0}</strong> / 2<br>
            Tactics modifier: <strong style="color:var(--teal);">${S.naval.tacticsBonus >= 0 ? '+' : ''}${S.naval.tacticsBonus || 0}</strong><br>
            Perception: <strong style="color:var(--gold2);text-transform:capitalize;">${String(S.naval.perception || 'indifferent')}</strong><br>
            Boarding: <strong style="color:var(--teal);">${(S.naval.boardingReadyRound > 0 && S.naval.round >= S.naval.boardingReadyRound && S.naval.zone === 'Engaged') ? 'Ready this round' : 'Not ready'}</strong><br>
            ${S.naval.powerShift ? `Diverting power from ${S.naval.powerShift.from} to ${S.naval.powerShift.to}.` : "No current power shift."}
          </div>
        </div>
      `;
    }

    if (combatLog) {
      combatLog.innerHTML = S.naval.log.length
        ? S.naval.log.map((entry) => `<div class="log-entry ${entry.type || ""}">${entry.text}</div>`).join("")
        : '<div class="log-entry">Combat log is empty.</div>';
    }

    renderNavalZoneTrack();

    // Ship Name input
    const shipNameInput = document.getElementById("shipNameInput");
    if (shipNameInput) {
      const currentName = S.naval.ship ? S.naval.ship.name : (S.naval.pendingName || "");
      shipNameInput.value = currentName;
    }
    const shipNameDisplay = document.getElementById("shipNameDisplay");
    if (shipNameDisplay) {
      const currentName = S.naval.ship ? S.naval.ship.name : (S.naval.pendingName || "");
      shipNameDisplay.textContent = currentName ? ('Current name: ' + currentName) : 'No ship name set.';
    }

    // Ship Cargo
    const navCargoList = document.getElementById("navalCargoList");
    if (navCargoList) {
      const cargo = S.naval.ship ? (S.naval.ship.cargo || []) : [];
      if (!cargo.length) {
        navCargoList.innerHTML = '<div style="font-size:.76rem;color:var(--muted2);">Hold is empty.</div>';
      } else {
        navCargoList.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:.3rem;">'
          + cargo.map(function(item, i) {
              return '<div style="background:var(--surface);border:1px solid var(--border2);padding:.3rem;text-align:center;border-radius:3px;font-size:.74rem;color:var(--text2);cursor:pointer;" onclick="unloadShipCargo(' + i + ');">'
                + '<div style="word-wrap:break-word;overflow:hidden;text-overflow:ellipsis;">' + item + '</div>'
                + '<div style="font-size:.63rem;color:var(--muted);margin-top:.12rem;">Click → Backpack</div>'
                + '</div>';
            }).join('') + '</div>';
      }
    }

    syncNavalStateToVttCombat();
    renderNavalCombatPopup();
  }

  function getNavalPopupTurnState() {
    if (!S.naval.combatActive) return "setup";
    if (Number(S.naval.actionsRemaining || 0) > 0) return "wayfarer";
    if (Number(S.naval.enemyActionsRemaining || 0) > 0) return "hostile";
    return "round-end";
  }

  function isNavalPopupActionEnabled(id) {
    const ship = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    const zone = String(S.naval.zone || "Close");
    const turn = getNavalPopupTurnState();
    const hasCombat = !!S.naval.combatActive;
    const playerActions = Number(S.naval.actionsRemaining || 0) > 0;
    const enemyActions = Number(S.naval.enemyActionsRemaining || 0) > 0;

    if (id === "start-reset") return !!ship;
    if (id === "next-round") return hasCombat;
    if (id === "spawn-hostile") return true;
    if (id === "spawn-ally") return !!ship;
    if (id === "select-hostile") return true;
    if (id === "select-ally") return true;
    if (id === "assign-role") return true;
    if (id === "manual-action") return true;
    if (id === "toggle-focus-fire") return true;
    if (id === "disable-hostile") return !!enemy;
    if (id === "hostile-attack") return hasCombat && enemyActions && !!ship && !!enemy;
    if (id === "ship-perception") return true;

    if (!hasCombat || !ship || !enemy) return false;
    if (id === "board-ship") return turn === "wayfarer" && playerActions && canStartNavalBoarding();
    if (id === "fire-batteries") return turn === "wayfarer" && playerActions && zone === "Close" && !ship.wrecked && !enemy.wrecked;
    if (id === "launch-volley") return turn === "wayfarer" && playerActions && zone === "Nearby" && !ship.wrecked && !enemy.wrecked;
    if (id === "patch-shields") return turn === "wayfarer" && playerActions;
    if (id === "captain-tactics") return turn === "wayfarer" && playerActions;
    if (id === "captain-morale") return turn === "wayfarer" && playerActions;
    if (id === "navigator-survey") return turn === "wayfarer" && playerActions;
    if (id === "captain-diplomacy") return turn === "wayfarer" && playerActions;
    if (id === "move-closer" || id === "move-wider") return turn === "wayfarer" && playerActions;
    return false;
  }

  function getNavalPopupActionReason(id) {
    const enemy = getActiveNavalEnemy();
    const ally = getActiveNavalAlly();
    const zone = String(S.naval.zone || "Close");
    const turn = getNavalPopupTurnState();
    if (isNavalPopupActionEnabled(id)) return "Ready";
    if (!ally) return "Buy your ship first";
    if (!enemy && id !== "ship-perception" && id !== "start-reset" && id !== "spawn-hostile" && id !== "select-hostile") return "Spawn hostile ship";
    if (!S.naval.combatActive && id !== "start-reset" && id !== "ship-perception") return "Start combat first";
    if (id === "fire-batteries" && zone !== "Close") return "Cannons require Close zone";
    if (id === "launch-volley" && zone !== "Nearby") return "Crossbows require Nearby zone";
    if (id === "board-ship" && zone !== "Engaged") return "Boarding requires Engaged zone";
    if (turn === "hostile" && id !== "hostile-attack" && id !== "next-round" && id !== "disable-hostile" && id !== "ship-perception") return "Hostile turn";
    if (turn === "round-end" && id !== "next-round" && id !== "disable-hostile" && id !== "ship-perception") return "Advance to next round";
    return "Unavailable";
  }

  function runNavalPopupAction(actionId, payload) {
    if (!actionId) return false;
    if (actionId !== "ship-perception" && actionId !== "assign-role" && actionId !== "select-hostile" && actionId !== "spawn-hostile" && !isNavalPopupActionEnabled(actionId)) {
      showNotif(getNavalPopupActionReason(actionId), "warn");
      renderNavalCombatPopup();
      return false;
    }
    if (actionId === "start-reset") startNavalCombat();
    else if (actionId === "next-round") nextNavalRound();
    else if (actionId === "spawn-hostile") spawnEnemyShip();
    else if (actionId === "spawn-ally") spawnAllyShip();
    else if (actionId === "select-hostile") setActiveNavalEnemy(payload);
    else if (actionId === "select-ally") setActiveNavalAlly(payload);
    else if (actionId === "assign-role") {
      const bits = String(payload || "").split(":");
      assignNavalRole(bits[0], bits.slice(1).join(":"));
    }
    else if (actionId === "manual-action") openNavalCardManualPrompt(payload);
    else if (actionId === "toggle-focus-fire") S.naval.focusFireLock = !S.naval.focusFireLock;
    else if (actionId === "move-closer") adjustNavalZone(-1);
    else if (actionId === "move-wider") adjustNavalZone(1);
    else if (actionId === "fire-batteries") navalAttack("strike");
    else if (actionId === "launch-volley") navalAttack("shoot");
    else if (actionId === "patch-shields") navalRepair();
    else if (actionId === "captain-tactics") navalTactics();
    else if (actionId === "captain-morale") navalMorale();
    else if (actionId === "navigator-survey") navalSurvey();
    else if (actionId === "ship-perception") rollShipPerception();
    else if (actionId === "captain-diplomacy") navalDiplomacy();
    else if (actionId === "board-ship") startNavalBoardingAction();
    else if (actionId === "hostile-attack") enemyNavalAttack();
    else if (actionId === "disable-hostile") wreckEnemyShip();
    renderNavalCombatPopup();
    return true;
  }

  function buildNavalCombatVisualHtml() {
    ensureNavalEnemyFleetState();
    const zone = String(S.naval.zone || "Close");
    const zoneIndex = Math.max(0, NAVAL_ZONES.indexOf(zone));
    const turn = getNavalPopupTurnState();
    const turnLabel = turn === "wayfarer" ? "Wayfarer Turn" : (turn === "hostile" ? "Hostile Turn" : (turn === "round-end" ? "Round End" : "Setup"));
    const turnTone = turn === "wayfarer" ? "var(--teal)" : (turn === "hostile" ? "var(--red2)" : "var(--gold2)");
    const centers = [
      { x: 70, y: 86, name: "Engaged" },
      { x: 170, y: 52, name: "Close" },
      { x: 270, y: 52, name: "Nearby" },
      { x: 370, y: 86, name: "Far" }
    ];
    const enemyPos = centers[Math.max(0, Math.min(centers.length - 1, zoneIndex))];
    const fleet = S.naval.enemyFleet || [];
    const aliveFleet = fleet.filter(function(enemy) { return enemy && !enemy.wrecked; });
    function hexPoints(cx, cy, r) {
      const pts = [];
      for (let i = 0; i < 6; i += 1) {
        const a = Math.PI / 180 * (60 * i - 30);
        pts.push((cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2));
      }
      return pts.join(" ");
    }
    let svg = '<svg width="440" height="168" viewBox="0 0 440 168" style="width:100%;border:1px solid var(--border2);background:radial-gradient(circle at 35% 30%, rgba(70,196,182,.08), rgba(8,10,16,.95));border-radius:8px;">';
    svg += '<text x="14" y="18" font-size="11" fill="' + turnTone + '" style="font-family:Rajdhani,sans-serif;letter-spacing:.08em;text-transform:uppercase;">' + turnLabel + '</text>';
    centers.forEach(function(c, index) {
      const active = index === zoneIndex;
      svg += '<polygon points="' + hexPoints(c.x, c.y, 34) + '" fill="' + (active ? 'rgba(201,162,39,.22)' : 'rgba(255,255,255,.03)') + '" stroke="' + (active ? '#e8c050' : '#2a2f45') + '" stroke-width="2"></polygon>';
      svg += '<text x="' + c.x + '" y="' + (c.y + 4) + '" text-anchor="middle" font-size="10" fill="' + (active ? '#f0d070' : '#9ba3c0') + '">' + c.name + '</text>';
    });
    svg += '<circle cx="38" cy="86" r="16" fill="#2ec4b6" stroke="#c8fff6" stroke-width="2"></circle>';
    svg += '<text x="38" y="90" text-anchor="middle" font-size="13" fill="#0b1a22">⛵</text>';
    svg += '<text x="38" y="114" text-anchor="middle" font-size="10" fill="#9bd9d3">Your Ship</text>';
    if (!aliveFleet.length) {
      svg += '<text x="' + enemyPos.x + '" y="' + (enemyPos.y + 5) + '" text-anchor="middle" font-size="10" fill="#9ba3c0">No Hostiles</text>';
    }
    aliveFleet.forEach(function(enemy, idx) {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const dx = (col - 1) * 18;
      const dy = row * 18;
      const x = enemyPos.x + dx;
      const y = enemyPos.y + dy;
      const active = String(enemy.id || "") === String(S.naval.targetEnemyId || "");
      svg += '<circle cx="' + x + '" cy="' + y + '" r="' + (active ? 13 : 10) + '" fill="' + (active ? '#df4d4d' : '#a63b3b') + '" stroke="' + (active ? '#ffe0b8' : '#f0a0a0') + '" stroke-width="2"></circle>';
      svg += '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" font-size="10" fill="#2a0f0f">☠</text>';
    });
    svg += '<text x="' + enemyPos.x + '" y="' + (enemyPos.y + 34) + '" text-anchor="middle" font-size="10" fill="#f0a0a0">Hostiles: ' + aliveFleet.length + '</text>';
    if (aliveFleet.length) {
      svg += '<path d="M56 86 C 98 70, 130 62, ' + (enemyPos.x - 18) + ' ' + enemyPos.y + '" stroke="rgba(240,208,112,.55)" stroke-width="2" fill="none" stroke-dasharray="4 4"></path>';
    }
    svg += '</svg>';
    return svg;
  }

  function buildNavalActionCardsHtml() {
    const ship = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    const enemyDread = getNavalEnemyDreadDie();
    const strikeDie = ship ? (getEffectiveShipDie(ship, "strike", true) || 0) : 0;
    const shootDie = ship ? (getEffectiveShipDie(ship, "shoot", true) || 0) : 0;
    const hullDie = enemy ? (getEffectiveShipDie(enemy, "hull", false) || 4) : 4;
    const leadDie = getNavalRoleDie("captain", "lead");
    const spiritDie = getNavalRoleDie("captain", "spirit");
    const mindDie = getNavalRoleDie("navigator", "mind");
    const bodyDie = getNavalRoleDie("engineer", "body");
    const tactical = Number(S.naval.tacticsBonus || 0);
    const navBonus = ship ? Number(ship.navBonus || 0) : 0;
    const leadBonus = ship ? Number(ship.leadBonus || 0) : 0;
    const cards = [
      { id: "fire-batteries", title: "Fire Batteries", effect: "Gunner Strike action", formula: "Roll Ship Strike d" + (strikeDie || "-") + " + tactics " + (tactical >= 0 ? "+" : "") + tactical + " vs hostile Hull d" + hullDie + ". Stress = difference.", action: "1 Wayfarer Action" },
      { id: "launch-volley", title: "Launch Volley", effect: "Gunner Shoot action", formula: "Roll Ship Shoot d" + (shootDie || "-") + " + tactics " + (tactical >= 0 ? "+" : "") + tactical + " vs hostile Hull d" + hullDie + ". Stress = difference.", action: "1 Wayfarer Action" },
      { id: "patch-shields", title: "Patch Shields", effect: "Engineer repair", formula: "Roll Body d" + bodyDie + " + tactics " + (tactical >= 0 ? "+" : "") + tactical + " vs Dread d" + enemyDread + ". Remove Stress by difference.", action: "1 Wayfarer Action" },
      { id: "captain-tactics", title: "Captain Tactics", effect: "Crew modifier", formula: "Roll Lead d" + leadDie + " + captain bonus " + (leadBonus >= 0 ? "+" : "") + leadBonus + " vs Dread d" + enemyDread + ". Difference becomes team roll modifier.", action: "1 Wayfarer Action" },
      { id: "captain-morale", title: "Captain Morale", effect: "Focus check", formula: "Roll Spirit d" + spiritDie + " + tactics " + (tactical >= 0 ? "+" : "") + tactical + " vs Dread d" + enemyDread + ".", action: "1 Wayfarer Action" },
      { id: "navigator-survey", title: "Navigator Survey", effect: "Read battlefield", formula: "Roll Mind d" + mindDie + " + nav bonus " + (navBonus >= 0 ? "+" : "") + navBonus + " + tactics " + (tactical >= 0 ? "+" : "") + tactical + " vs Dread d" + enemyDread + ".", action: "1 Wayfarer Action" },
      { id: "ship-perception", title: "Ship Perception (d6)", effect: "Friendly / Indifferent / Hostile", formula: "Roll d6. 1-2 Friendly, 3-4 Indifferent, 5-6 Hostile.", action: "Free / table call" },
      { id: "captain-diplomacy", title: "Captain Diplomacy", effect: "Shift perception", formula: "Roll Lead d" + leadDie + " + captain bonus " + (leadBonus >= 0 ? "+" : "") + leadBonus + " + tactics " + (tactical >= 0 ? "+" : "") + tactical + " vs Dread d" + enemyDread + ".", action: "1 Wayfarer Action" },
      { id: "board-ship", title: "Board Enemy Ship", effect: "Enter personal combat", formula: "Requires Engaged and boarding-ready round. Uses boarding flow into personal combat scene.", action: "1 Wayfarer Action" },
      { id: "hostile-attack", title: "Hostile Attack", effect: "Resolve enemy action", formula: "Enemy strikes from Close or shoots from Nearby vs your Hull die.", action: "1 Hostile Action" },
      { id: "disable-hostile", title: "Disable Hostile", effect: "Force wreck for debug/GM", formula: "Immediate hostile wreck state.", action: "GM utility" }
    ];
    return '<div class="command-card-grid">' + cards.map(function(card) {
      const enabled = isNavalPopupActionEnabled(card.id);
      const reason = getNavalPopupActionReason(card.id);
      return '<div class="command-action-card ' + (enabled ? 'ready' : '') + '">'
        + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:flex-start;margin-bottom:.12rem;">'
        + '<div class="command-action-title">' + card.title + '</div>'
        + '<span class="command-action-cost">' + card.action + '</span>'
        + '</div>'
        + '<div class="command-action-effect">' + card.effect + '</div>'
        + '<div class="command-action-formula">' + card.formula + '</div>'
        + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;">'
        + '<div style="display:flex;gap:.14rem;">'
        + '<button class="btn btn-xs ' + (enabled ? 'btn-primary' : '') + '" onclick="runNavalPopupAction(\'' + card.id + '\')" ' + (enabled ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Run</button>'
        + '<button class="btn btn-xs" onclick="runNavalPopupAction(\'manual-action\',\'' + card.id + '\')">Manual</button>'
        + '</div>'
        + '<span style="font-size:.62rem;color:' + (enabled ? 'var(--teal)' : 'var(--muted2)') + ';">' + reason + '</span>'
        + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function buildNavalCombatPopupHtml() {
    ensureNavalEnemyFleetState();
    const ship = S.naval.ship;
    const allies = Array.isArray(S.naval.allyFleet) ? S.naval.allyFleet : [];
    const enemy = getActiveNavalEnemy();
    const fleet = Array.isArray(S.naval.enemyFleet) ? S.naval.enemyFleet : [];
    const aliveFleet = fleet.filter(function(entry) { return entry && !entry.wrecked; });
    const log = Array.isArray(S.naval.log) ? S.naval.log.slice(0, 18) : [];
    const playerActions = Number(S.naval.actionsRemaining || 0);
    const playerMaxActions = Number(getPlayerActionCount() || 1);
    const enemyActions = Number(S.naval.enemyActionsRemaining || 0);
    const turn = getNavalPopupTurnState();
    const turnLabel = turn === "wayfarer" ? "Wayfarers Act" : (turn === "hostile" ? "Hostile Acts" : (turn === "round-end" ? "Advance Round" : "Setup"));
    const starshipNote = 'Starship variant: use the same flow, but read Stress as Damage.';
    const powerShift = S.naval.powerShift
      ? ('Power shifted from ' + String(S.naval.powerShift.from) + ' to ' + String(S.naval.powerShift.to) + '.')
      : 'No active power diversion.';
    return '<div id="navalCombatPopupRoot" class="command-popup-root command-table-ship">'
      + '<div class="command-popup-header">'
      + '<div class="command-kicker">Command Table</div>'
      + '<div class="command-popup-title">Naval Combat Console</div>'
      + '<div class="command-popup-subtitle">' + turnLabel + ' • Actions: ' + playerActions + '/' + playerMaxActions + ' (Wayfarer) • ' + enemyActions + '/2 (Hostile)</div>'
      + '<div class="command-popup-subtitle" style="color:var(--teal2);">' + starshipNote + '</div>'
      + '</div>'
      + '<div class="command-chip-row">'
      + '<span class="command-chip">Round ' + Number(S.naval.round || 1) + '</span>'
      + '<span class="command-chip teal">Zone ' + String(S.naval.zone || 'Close') + '</span>'
      + '<span class="command-chip">Perception ' + capitalize(String(S.naval.perception || 'indifferent')) + '</span>'
      + '<span class="command-chip">Hostiles ' + aliveFleet.length + '</span>'
      + '<span class="command-chip">Combat ' + (S.naval.combatActive ? 'Active' : 'Idle') + '</span>'
      + '<span class="command-chip teal">' + powerShift + '</span>'
      + '</div>'
      + '<div class="command-visual-frame">' + buildNavalCombatVisualHtml() + '</div>'
      + buildNavalRoleAssignmentHtml()
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.35rem;">'
      + '<div class="combat-card">' + (ship ? renderShipSummary(ship, true) : '<div class="ship-copy">No allied ship selected.</div>') + '</div>'
      + '<div class="combat-card">' + (enemy ? renderShipSummary(enemy, false) : '<div class="ship-copy">No enemy ship active. Spawn one.</div>') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.25rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="runNavalPopupAction(\'start-reset\')">Start / Reset Combat</button>'
      + '<button class="btn btn-xs" onclick="runNavalPopupAction(\'spawn-ally\')">Spawn Ally</button>'
      + '<button class="btn btn-xs" onclick="runNavalPopupAction(\'spawn-hostile\')">Spawn Hostile</button>'
      + '<button class="btn btn-xs" onclick="runNavalPopupAction(\'next-round\')">Next Round</button>'
      + '<button class="btn btn-xs" onclick="runNavalPopupAction(\'move-closer\')" ' + (isNavalPopupActionEnabled("move-closer") ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Move Closer</button>'
      + '<button class="btn btn-xs" onclick="runNavalPopupAction(\'move-wider\')" ' + (isNavalPopupActionEnabled("move-wider") ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Move Wider</button>'
      + '<button class="btn btn-xs" onclick="openNavalCombatRulesPage();">Rules Page</button>'
      + '</div>'
      + '<div class="command-target-box">'
      + '<div class="command-target-title">Ally Targeting</div>'
      + '<div style="display:grid;grid-template-columns:1fr;gap:.24rem;align-items:center;margin-bottom:.22rem;">'
      + '<select onchange="runNavalPopupAction(\'select-ally\', this.value)">'
      + (allies.length ? allies.map(function(entry, idx) {
          const name = String(entry && entry.name || ('Ally ' + (idx + 1)));
          const status = entry && entry.wrecked ? ' (Wrecked)' : '';
          const stressVal = Number(entry && entry.stress || 0);
          const hullVal = Number(getEffectiveShipDie(entry, 'hull', true) || 4);
          return '<option value="' + String(entry && entry.id || '') + '"' + (String(entry && entry.id || '') === String(S.naval.activeAllyId || '') ? ' selected' : '') + '>' + name + status + ' · d' + hullVal + ' · Stress ' + stressVal + '</option>';
        }).join('') : '<option value="">No allies yet</option>')
      + '</select>'
      + '<div style="display:flex;gap:.12rem;flex-wrap:wrap;">'
      + (allies.length ? allies.map(function(entry, idx) {
          return buildCompactStressBarChip(String(entry && entry.name || ('Ally ' + (idx + 1))), Number(entry && entry.stress || 0), Number(getShipThreshold(entry, true) || 1), '#46c4b6');
        }).join('') : '')
      + '</div>'
      + '</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.14rem;margin-bottom:.2rem;">Pick which allied ship is acting and receives damage this turn.</div>'
      + '</div>'
      + '<div class="command-target-box">'
      + '<div class="command-target-title">Hostile Targeting</div>'
      + '<div style="display:grid;grid-template-columns:1fr auto;gap:.24rem;align-items:center;">'
      + '<select onchange="runNavalPopupAction(\'select-hostile\', this.value)">'
      + (fleet.length ? fleet.map(function(entry, idx) {
          const name = String(entry && entry.name || ('Hostile ' + (idx + 1)));
          const status = entry && entry.wrecked ? ' (Wrecked)' : '';
          const stressVal = Number(entry && entry.stress || 0);
          const hullVal = Number(getEffectiveShipDie(entry, 'hull', false) || 4);
          return '<option value="' + String(entry && entry.id || '') + '"' + (String(entry && entry.id || '') === String(S.naval.targetEnemyId || '') ? ' selected' : '') + '>' + name + status + ' · d' + hullVal + ' · Stress ' + stressVal + '</option>';
        }).join('') : '<option value="">No hostiles yet</option>')
      + '</select>'
      + '<button class="btn btn-xs btn-red" onclick="runNavalPopupAction(\'disable-hostile\')" ' + (isNavalPopupActionEnabled("disable-hostile") ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Disable Target</button>'
      + '</div>'
      + '<div style="display:flex;gap:.12rem;flex-wrap:wrap;margin-top:.14rem;">'
      + (fleet.length ? fleet.map(function(entry, idx) {
          return buildCompactStressBarChip(String(entry && entry.name || ('Hostile ' + (idx + 1))), Number(entry && entry.stress || 0), Number(getShipThreshold(entry, false) || 1), '#df4d4d');
        }).join('') : '')
      + '</div>'
      + '<div style="display:flex;gap:.2rem;align-items:center;margin-top:.14rem;">'
      + '<button class="btn btn-xs ' + (S.naval.focusFireLock ? 'btn-primary' : '') + '" onclick="runNavalPopupAction(\'toggle-focus-fire\')">Focus Fire ' + (S.naval.focusFireLock ? 'On' : 'Off') + '</button>'
      + '<span style="font-size:.64rem;color:var(--muted2);">When On, target will not auto-switch.</span>'
      + '</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.14rem;">Target first, then run attack cards. This keeps multi-ship naval encounters readable like VTT target selection.</div>'
      + '</div>'
      + '<div style="margin-bottom:.34rem;">' + buildNavalActionCardsHtml() + '</div>'
      + '<div class="command-popup-log">'
      + (log.length
          ? log.map(function(entry) { return '<div style="font-size:.74rem;color:var(--text2);border-bottom:1px solid var(--border2);padding:.12rem 0;">' + String(entry && entry.text || '') + '</div>'; }).join('')
          : '<div style="font-size:.74rem;color:var(--muted2);">No naval combat events yet.</div>')
      + '</div>'
      + '</div>';
  }

  function renderNavalCombatPopup() {
    const content = document.getElementById("modalContent");
    const root = document.getElementById("navalCombatPopupRoot");
    if (!content || !root) return false;
    content.innerHTML = buildNavalCombatPopupHtml();
    return true;
  }

  function openNavalCombatRulesPage() {
    const html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.9rem;color:var(--gold2);margin-bottom:.2rem;">Naval and Starship Combat Rules</div>'
      + '<div style="font-size:.69rem;color:var(--teal);margin-bottom:.3rem;">For starship combat, use the same rules but replace Stress with Damage.</div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);margin-bottom:.3rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;margin-bottom:.14rem;">Combat Flow</div>'
      + '<div style="font-size:.74rem;color:var(--text2);">Wayfarers act first. Each Wayfarer grants 1 action to your ship. Opponents get 2 actions total. Actions are Move or Attack, plus role actions. Resolve your side, then hostile side, then end-of-round stress and break tests.</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.26rem;margin-bottom:.3rem;">'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.6rem;color:var(--teal2);text-transform:uppercase;margin-bottom:.1rem;">Core Rule</div>'
      + '<div style="font-size:.72rem;">Every action roll is tested against opposing Dread or Hull/Defend as shown on each action card. On success, apply difference as Stress (or Damage for starships).</div>'
      + '</div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.6rem;color:var(--teal2);text-transform:uppercase;margin-bottom:.1rem;">Turn Economy</div>'
      + '<div style="font-size:.72rem;">Movement costs 1 action. Attack costs 1 action. Engineer, Captain, and Navigator actions each cost 1 action unless your table overrides.</div>'
      + '</div>'
      + '</div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);margin-bottom:.3rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.6rem;color:var(--teal2);text-transform:uppercase;margin-bottom:.1rem;">Companion App Targeting</div>'
      + '<div style="font-size:.72rem;">Use Hostile Targeting to pick which enemy ship receives attacks. Multi-ship encounters keep all hostiles listed with live Hull and Stress so everyone tracks the same target clearly.</div>'
      + '</div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);margin-bottom:.3rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.6rem;color:var(--teal2);text-transform:uppercase;margin-bottom:.1rem;">Campaign Role Dice</div>'
      + '<div style="font-size:.72rem;">Assign party members to Captain/Navigator/Engineer/Gunner in the popup. Their sheet stats become the action dice for that station, so campaign groups can run turns collaboratively and transparently.</div>'
      + '</div>'
      + '<details open style="margin-bottom:.28rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Action Definitions</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">'
      + '<div><strong>Fire Batteries:</strong> Gunner Strike from Close. Roll ship Strike vs hostile Hull/Defend.</div>'
      + '<div><strong>Launch Volley:</strong> Gunner Shoot from Nearby. Roll ship Shoot vs hostile Hull/Defend.</div>'
      + '<div><strong>Patch Shields:</strong> Engineer Body vs hostile Dread. Remove Stress by difference. Success leaves ship Protected, failure leaves Vulnerable.</div>'
      + '<div><strong>Captain Tactics:</strong> Lead vs hostile Dread. Difference is team-wide roll modifier for the round/scene.</div>'
      + '<div><strong>Captain Morale:</strong> Spirit vs hostile Dread. Success Focused, failure Distracted.</div>'
      + '<div><strong>Navigator Survey:</strong> Mind vs hostile Dread. Success Bolstered, failure Shaken.</div>'
      + '<div><strong>Ship Perception (d6):</strong> 1-2 Friendly, 3-4 Indifferent, 5-6 Hostile.</div>'
      + '<div><strong>Captain Diplomacy:</strong> Lead/Diplomacy vs hostile Dread. Success moves perception one step friendlier, failure one step more hostile.</div>'
      + '<div><strong>Board Enemy Ship:</strong> Requires Engaged and boarding readiness. Launches personal combat scene. Failed checks can produce stress risk by table ruling.</div>'
      + '<div><strong>Hostile Attack:</strong> Resolve one enemy action from their current valid range.</div>'
      + '<div><strong>Disable Hostile:</strong> Utility override for GM/debug to force hostile wrecked state.</div>'
      + '</div></details>'
      + '<details open style="margin-bottom:.28rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Zones and Movement</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">'
      + '<div><strong>Engaged:</strong> Grappling/boarding range. No Strike/Shoot ship fire.</div>'
      + '<div><strong>Close:</strong> Strike (cannons) zone.</div>'
      + '<div><strong>Nearby:</strong> Shoot (long-range projectiles) zone.</div>'
      + '<div><strong>Far:</strong> Visible but out of weapon range.</div>'
      + '<div>Movement between zones costs 1 action. In hazardous terrain, Navigator Control/Sail checks may be required.</div>'
      + '</div></details>'
      + '<details open style="margin-bottom:.28rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Stress, Threshold, and Wrecked</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">'
      + '<div>Stress threshold equals double the current Hull/Defend die value.</div>'
      + '<div>When threshold is reached, Hull/Defend steps down one die and crew takes +1 Trauma.</div>'
      + '<div>If Hull/Defend would step below d4, the ship is wrecked and out of action.</div>'
      + '<div>Example: Defend d8 gives threshold 16. At 16 Stress, step to d6 and threshold becomes 12 for future checks.</div>'
      + '</div></details>'
      + '<details style="margin-bottom:.32rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Non-Combat Role Use</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">Roles can be used outside direct fire: Gunner clears obstacles, Navigator secures escape routes, Captain handles social pressure, Engineer stabilizes systems during hazards.</div>'
      + '</details>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-teal" onclick="openNavalCombatPopup();">Back To Combat Popup</button>'
      + '<button class="btn btn-xs" onclick="closeModal();">Close</button>'
      + '</div>'
      + '</div>';
    openModal('Naval Combat Rules', html, null, { preventScroll: true, focusTrap: true });
  }

  function openNavalCombatPopup() {
    ensureExpansionState();
    openModal('Naval Combat Console', buildNavalCombatPopupHtml(), null, { preventScroll: true, focusTrap: true });
  }

  function selectNavalClass(className) {
    ensureExpansionState();
    S.naval.selectedClass = className;
    renderNaval();
  }

  function stowItemInShip() {
    ensureExpansionState();
    if (!S.naval.ship) { showNotif("No ship to stow items in!", "warn"); return; }
    if (!Array.isArray(S.naval.ship.cargo)) { S.naval.ship.cargo = []; }
    var bp = S.backpack || [];
    var filled = bp.filter(function(s){ return s && s.trim(); });
    if (!filled.length) { showNotif("Backpack is empty!", "warn"); return; }
    // Stow the last non-empty item
    var lastIdx = -1;
    for (var i = bp.length - 1; i >= 0; i--) {
      if (bp[i] && bp[i].trim()) { lastIdx = i; break; }
    }
    if (lastIdx < 0) { showNotif("Nothing to stow.", "warn"); return; }
    var item = bp[lastIdx];
    S.naval.ship.cargo.push(item);
    S.backpack[lastIdx] = "";
    renderNaval();
    if (typeof renderBackpackUI === "function") { renderBackpackUI(); }
    showNotif("Stowed: " + item, "good");
  }

  function unloadShipCargo(i) {
    ensureExpansionState();
    if (!S.naval.ship || !S.naval.ship.cargo) { return; }
    var item = S.naval.ship.cargo[i];
    if (!item) { return; }
    S.naval.ship.cargo.splice(i, 1);
    if (!Array.isArray(S.backpack)) { S.backpack = Array(10).fill(""); }
    var slotIdx = S.backpack.indexOf("");
    if (slotIdx >= 0) {
      S.backpack[slotIdx] = item;
    } else {
      S.backpack.push(item);
    }
    renderNaval();
    if (typeof renderBackpackUI === "function") { renderBackpackUI(); }
    showNotif("Moved to Backpack: " + item, "good");
  }

  function spawnEnemyShip() {
    ensureExpansionState();
    const className = document.getElementById("navalEnemyClass")?.value || S.naval.enemyClass || "Frigate";
    S.naval.enemyClass = className;
    const hostile = createShipFromClass(className);
    hostile.name = `${pick(SHIP_NAME_FIRST)} ${pick(SHIP_NAME_LAST)}`;
    hostile.id = makeNavalEnemyId();
    ensureNavalEnemyFleetState();
    S.naval.enemyFleet.push(hostile);
    if (!S.naval.focusFireLock || !S.naval.targetEnemyId) {
      S.naval.targetEnemyId = hostile.id;
    }
    S.naval.enemyShip = hostile;
    renderNaval();
    showNotif(`Enemy ${className} sighted (${S.naval.enemyFleet.length} hostile${S.naval.enemyFleet.length === 1 ? '' : 's'}).`, "warn");
  }

  function startNavalCombat() {
    ensureExpansionState();
    ensureNavalAllyFleetState();
    if (!getActiveNavalAlly()) {
      showNotif("Buy a ship before starting naval combat.", "warn");
      return;
    }
    ensureNavalEnemyFleetState();
    if (!S.naval.enemyFleet.length) {
      spawnEnemyShip();
    }
    ensureNavalEnemyFleetState();
    S.naval.combatActive = true;
    S.naval.round = 1;
    S.naval.tacticsBonus = 0;
    S.naval.powerShift = null;
    S.naval.crewTrauma = 0;
    S.naval.actionsRemaining = getPlayerActionCount();
    S.naval.enemyActionsRemaining = 2;
    S.naval.perception = S.naval.perception || "indifferent";
    S.naval.boardingReadyRound = 0;
    (S.naval.allyFleet || []).forEach(function(ally) {
      if (!ally) return;
      ally.stress = 0;
      ally.wrecked = false;
    });
    (S.naval.enemyFleet || []).forEach(function(enemy) {
      if (!enemy) return;
      enemy.stress = 0;
      enemy.wrecked = false;
    });
    S.naval.ship = getActiveNavalAlly();
    S.naval.enemyShip = getActiveNavalEnemy();
    S.naval.log = [{ text: "Naval combat begins. Wayfarers act first.", type: "good" }];
    renderNaval();
  }

  function clearNavalLog() {
    ensureExpansionState();
    S.naval.log = [];
    renderNaval();
  }

  function navalLog(text, type) {
    S.naval.log.unshift({ text, type });
    S.naval.log = S.naval.log.slice(0, 30);
  }

  function shipBreakTest(ship, side) {
    while (!ship.wrecked) {
      const threshold = getShipThreshold(ship, side === "player");
      if (ship.stress < threshold) {
        break;
      }
      if (ship.hullDie === 4) {
        ship.wrecked = true;
        ship.stress = threshold;
        navalLog(`${side === "player" ? "Your" : "Enemy"} ship is wrecked and out of action.`, "warn");
        if (side === "player" && typeof window.handleScarEncounter === "function") {
          window.handleScarEncounter({ source: 'starship-wrecked', shipWrecked: true });
        }
        return;
      }
      ship.stress -= threshold;
      ship.hullDie = stepDown(ship.hullDie);
      if (side === "player") {
        S.naval.crewTrauma += 1;
      }
      navalLog(`${side === "player" ? "Your" : "Enemy"} hull breaks. Defend drops to d${ship.hullDie}.`, "warn");
    }
  }

  function damageShip(ship, amount, side) {
    ship.stress += amount;
    shipBreakTest(ship, side);
  }

  function repairPlayerShipToFull() {
    ensureExpansionState();
    const ally = getActiveNavalAlly();
    if (!ally) {
      return;
    }
    ally.stress = 0;
    ally.wrecked = false;
    renderNaval();
  }

  function currentZoneIndex() {
    const index = NAVAL_ZONES.indexOf(S.naval.zone);
    return index >= 0 ? index : 1;
  }

  function adjustNavalZone(direction) {
    ensureExpansionState();
    const ally = getActiveNavalAlly();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    if (!ally) {
      showNotif("Buy a ship first.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;
    const rollResult = explodingRoll(getNavalRoleDie("navigator", "control"));
    const controlTotal = rollResult.total + (ally.navBonus || 0) + (S.naval.tacticsBonus || 0);
    const target = explodingRoll(getNavalEnemyDreadDie());
    const success = controlTotal >= target.total;
    if (success) {
      const nextIndex = Math.max(0, Math.min(NAVAL_ZONES.length - 1, currentZoneIndex() + direction));
      S.naval.zone = NAVAL_ZONES[nextIndex];
      if (S.naval.zone === "Engaged") {
        S.naval.boardingReadyRound = S.naval.round + 1;
        navalLog(`Navigator shifts to Engaged (${controlTotal} vs ${target.total}). Boarding enabled next round.`, "good");
      } else {
        navalLog(`Navigator shifts the range to ${S.naval.zone} (${controlTotal} vs ${target.total}).`, "good");
      }
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
    } else {
      const stress = Math.max(1, target.total - controlTotal);
      damageShip(ally, stress, "player");
      navalLog(`Navigator loses the line (${controlTotal} vs ${target.total}) and the ship takes ${stress} Stress.`, "warn");
      if (typeof addTMWOnFail === 'function') { addTMWOnFail(); }
    }
    renderNaval();
  }

  function applyPowerShift() {
    ensureExpansionState();
    const from = document.getElementById("navalPowerFrom")?.value || "shoot";
    const to = document.getElementById("navalPowerTo")?.value || "hull";
    if (from === to) {
      showNotif("Choose two different stats for power diversion.", "warn");
      return;
    }
    S.naval.powerShift = { from, to };
    navalLog(`Power diverted from ${from} to ${to} for this round.`, "good");
    renderNaval();
  }

  function clearPowerShift() {
    ensureExpansionState();
    S.naval.powerShift = null;
    renderNaval();
  }

  function nextNavalRound() {
    ensureExpansionState();
    S.naval.round += 1;
    S.naval.tacticsBonus = 0;
    S.naval.powerShift = null;
    S.naval.actionsRemaining = getPlayerActionCount();
    S.naval.enemyActionsRemaining = 2;
    navalLog(`Round ${S.naval.round} begins.`, "");
    renderNaval();
  }

  function navalAttack(mode) {
    ensureExpansionState();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    const ship = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    if (!ship || !enemy) {
      showNotif("You need both ships on the field.", "warn");
      return;
    }
    if (ship.wrecked || enemy.wrecked) {
      showNotif("One of the ships is already wrecked.", "warn");
      return;
    }

    if (mode === "strike" && S.naval.zone !== "Close") {
      showNotif("Cannons need Close range.", "warn");
      return;
    }
    if (mode === "shoot" && S.naval.zone !== "Nearby") {
      showNotif("Crossbows need Nearby range.", "warn");
      return;
    }
    if (S.naval.zone === "Engaged") {
      showNotif("Ships are engaged and boarding. No ship weapons.", "warn");
      return;
    }
    if (S.naval.zone === "Far") {
      showNotif("Target is too far for ship weapons.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;

    const die = getEffectiveShipDie(ship, mode, true);
    if (!die) {
      showNotif("This ship has no weapon die for that action.", "warn");
      return;
    }

    const attack = explodingRoll(die);
    attack.total += S.naval.tacticsBonus || 0;
    const defend = explodingRoll(getEffectiveShipDie(enemy, "hull", false) || 4);
    const success = attack.total >= defend.total;
    if (success) {
      const stress = Math.max(1, attack.total - defend.total);
      damageShip(enemy, stress, "enemy");
      navalLog(`${mode === "strike" ? "Cannons" : "Crossbows"} hit for ${stress} Stress (${attack.total} vs ${defend.total}).`, "good");
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
    } else {
      navalLog(`${mode === "strike" ? "Cannons" : "Crossbows"} miss (${attack.total} vs ${defend.total}).`, "warn");
      if (typeof addTMWOnFail === 'function') { addTMWOnFail(); }
    }
    S.naval.tacticsBonus = 0;
    renderNaval();
  }

  function enemyNavalAttack() {
    ensureExpansionState();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    const ship = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    if (!ship || !enemy || ship.wrecked || enemy.wrecked) {
      return;
    }

    let mode = null;
    if (S.naval.zone === "Close") {
      mode = "strike";
    } else if (S.naval.zone === "Nearby") {
      mode = "shoot";
    } else {
      navalLog("Enemy ship cannot line up a clear shot from this zone.", "");
      renderNaval();
      return;
    }
    if (!spendNavalAction("enemy")) return;

    const die = getEffectiveShipDie(enemy, mode, false);
    if (!die) {
      navalLog("Enemy ship lacks the weapon profile for that shot.", "");
      renderNaval();
      return;
    }

    const attack = explodingRoll(die);
    const defend = explodingRoll(getEffectiveShipDie(ship, "hull", true) || 4);
    const success = attack.total >= defend.total;
    if (success) {
      const stress = Math.max(1, attack.total - defend.total);
      damageShip(ship, stress, "player");
      navalLog(`Enemy ${mode === "strike" ? "cannons" : "crossbows"} hit for ${stress} Stress (${attack.total} vs ${defend.total}).`, "warn");
    } else {
      navalLog(`Enemy fire glances off the hull (${attack.total} vs ${defend.total}).`, "good");
    }
    renderNaval();
  }

  function navalRepair() {
    ensureExpansionState();
    const ally = getActiveNavalAlly();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;
    if (!ally) {
      return;
    }
    const body = explodingRoll(getNavalRoleDie("engineer", "body"));
    const bodyTotal = body.total + (S.naval.tacticsBonus || 0);
    const target = explodingRoll(getNavalEnemyDreadDie());
    if (bodyTotal >= target.total) {
      const repair = Math.max(1, bodyTotal - target.total);
      ally.stress = Math.max(0, ally.stress - repair);
      setNavalConditionState("protected", true);
      setNavalConditionState("vulnerable", false);
      navalLog(`Engineer removes ${repair} Stress (${bodyTotal} vs ${target.total}). Ship is Protected.`, "good");
    } else {
      setNavalConditionState("vulnerable", true);
      setNavalConditionState("protected", false);
      navalLog(`Repair fails (${bodyTotal} vs ${target.total}). Ship is Vulnerable.`, "warn");
    }
    renderNaval();
  }

  function navalTactics() {
    ensureExpansionState();
    const ally = getActiveNavalAlly();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;
    const lead = explodingRoll(getNavalRoleDie("captain", "lead"));
    const leadTotal = lead.total + (ally ? ally.leadBonus || 0 : 0);
    const target = explodingRoll(getNavalEnemyDreadDie());
    const diff = leadTotal - target.total;
    S.naval.tacticsBonus = diff;
    if (diff >= 0) {
      navalLog(`Captain sets the line. Crew rolls gain +${diff} this round.`, "good");
    } else {
      navalLog(`Captain's tactics falter (${leadTotal} vs ${target.total}). Crew rolls take ${diff} this round.`, "warn");
    }
    renderNaval();
  }

  function navalMorale() {
    ensureExpansionState();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;
    const spirit = explodingRoll(getNavalRoleDie("captain", "spirit"));
    const spiritTotal = spirit.total + (S.naval.tacticsBonus || 0);
    const target = explodingRoll(getNavalEnemyDreadDie());
    if (spiritTotal >= target.total) {
      if (S.naval.crewTrauma > 0) {
        S.naval.crewTrauma -= 1;
      }
      setNavalConditionState("focused", true);
      setNavalConditionState("distracted", false);
      navalLog(`Captain steadies the crew (${spiritTotal} vs ${target.total}). Crew is Focused.`, "good");
    } else {
      setNavalConditionState("distracted", true);
      setNavalConditionState("focused", false);
      navalLog(`Morale speech fails (${spiritTotal} vs ${target.total}). Crew is Distracted.`, "warn");
    }
    renderNaval();
  }

  function navalSurvey() {
    ensureExpansionState();
    const ally = getActiveNavalAlly();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;
    const mind = explodingRoll(getNavalRoleDie("navigator", "mind"));
    const mindTotal = mind.total + (ally ? ally.navBonus || 0 : 0) + (S.naval.tacticsBonus || 0);
    const target = explodingRoll(getNavalEnemyDreadDie());
    if (mindTotal >= target.total) {
      setNavalConditionState("bolstered", true);
      setNavalConditionState("shaken", false);
      navalLog(`Navigator reads the sea (${mindTotal} vs ${target.total}). Ship is Bolstered.`, "good");
    } else {
      setNavalConditionState("shaken", true);
      setNavalConditionState("bolstered", false);
      navalLog(`Navigator misreads the water (${mindTotal} vs ${target.total}). Ship is Shaken.`, "warn");
    }
    renderNaval();
  }

  function rollShipPerception() {
    ensureExpansionState();
    const r = roll(6);
    S.naval.perception = r <= 2 ? "friendly" : (r <= 4 ? "indifferent" : "hostile");
    navalLog(`Perception roll d6=${r}: target ship is ${S.naval.perception}.`, r >= 5 ? "warn" : "good");
    renderNaval();
  }

  function navalDiplomacy() {
    ensureExpansionState();
    const ally = getActiveNavalAlly();
    if (!S.naval.combatActive) {
      showNotif("Start naval combat first.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;
    const lead = explodingRoll(getNavalRoleDie("captain", "lead"));
    const leadTotal = lead.total + (ally ? ally.leadBonus || 0 : 0) + (S.naval.tacticsBonus || 0);
    const dread = explodingRoll(getNavalEnemyDreadDie());
    const success = leadTotal >= dread.total;
    const perception = shiftPerception(success ? -1 : 1);
    navalLog(`Captain diplomacy ${success ? 'succeeds' : 'fails'} (${leadTotal} vs ${dread.total}). Perception now ${perception}.`, success ? "good" : "warn");
    renderNaval();
  }

  function canStartNavalBoarding() {
    const ally = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    ensureExpansionState();
    return !!(
      S.naval
      && S.naval.combatActive
      && ally
      && enemy
      && !ally.wrecked
      && !enemy.wrecked
      && S.naval.zone === "Engaged"
      && Number(S.naval.boardingReadyRound || 0) > 0
      && Number(S.naval.round || 1) >= Number(S.naval.boardingReadyRound || 0)
    );
  }

  function buildNavalBoardingSeed() {
    const ally = getActiveNavalAlly();
    const enemy = getActiveNavalEnemy();
    const playerName = String((S && S.name) || "Wayfarer").trim() || "Wayfarer";
    const playerHealth = Math.max(8, Number((S && S.health) || 12));
    const enemyDread = getNavalEnemyDreadDie();
    const allyCount = Math.max(1, Math.min(4, Number((S.naval.crew && S.naval.crew.length) || 1)));
    const enemyCount = Math.max(1, Math.min(4, Math.ceil(enemyDread / 4)));
    const tokens = [];

    tokens.push({
      id: `board-player-${Date.now()}`,
      name: playerName,
      faction: "player",
      hp: playerHealth,
      maxHp: playerHealth,
      status: [],
      q: 4,
      r: 7,
      image: '',
      size: 1,
      isPlayer: true
    });

    for (let i = 0; i < allyCount; i += 1) {
      tokens.push({
        id: `board-ally-${i}-${Date.now()}`,
        name: `Boarding Ally ${i + 1}`,
        faction: "player",
        hp: 8,
        maxHp: 8,
        status: [],
        q: 3,
        r: 6 + i,
        image: '',
        size: 1,
        isPlayer: false
      });
    }

    for (let j = 0; j < enemyCount; j += 1) {
      tokens.push({
        id: `board-enemy-${j}-${Date.now()}`,
        name: `Enemy Boarder ${j + 1}`,
        faction: "monster",
        hp: Math.max(6, enemyDread),
        maxHp: Math.max(6, enemyDread),
        status: [],
        q: 10,
        r: 6 + j,
        image: '',
        size: 1,
        dread: enemyDread,
        deathNumber: Math.max(1, Math.ceil(Math.max(6, enemyDread) / 2))
      });
    }

    return {
      name: `Boarding Action - ${String((enemy && enemy.className) || S.naval.enemyClass || "Enemy Ship")}`,
      navalBoardingContext: {
        kind: 'naval-boarding',
        round: Number(S.naval.round || 1)
      },
      tokens,
      history: [
        `Boarding launched in naval round ${Number(S.naval.round || 1)} from Engaged range.`,
        `Player ship: ${String((ally && ally.name) || S.naval.selectedClass || "Unknown")}.`,
        `Enemy ship: ${String((enemy && enemy.name) || S.naval.enemyClass || "Unknown")}.`
      ]
    };
  }

  function startNavalBoardingAction() {
    ensureExpansionState();
    const enemy = getActiveNavalEnemy();
    if (!canStartNavalBoarding()) {
      showNotif("Boarding requires Engaged range and next-round readiness.", "warn");
      return;
    }
    if (!spendNavalAction("player")) return;

    S.naval.boardingReadyRound = Number(S.naval.round || 1) + 1;
    S.naval.boardingSession = {
      active: true,
      startedAt: Date.now(),
      startedRound: Number(S.naval.round || 1),
      enemyClass: String((enemy && enemy.className) || S.naval.enemyClass || 'Enemy Ship')
    };
    navalLog("Boarding party launched. Personal combat scene opened in VTT Combat Mode.", "good");

    if (S && S.combat && typeof S.combat === "object") {
      S.combat.active = true;
      S.combat.spacing = "Engaged";
      S.combat.enemyDread = getNavalEnemyDreadDie();
    }

    const seed = buildNavalBoardingSeed();
    if (typeof window.openCombatSceneEditor === "function") {
      window.openCombatSceneEditor(seed);
    } else {
      showNotif("Combat Scene Editor is unavailable. Boarding log recorded.", "warn");
    }

    renderNaval();
  }

  function cloneBoardingShipState(ship) {
    return {
      stress: Math.max(0, Number(ship && ship.stress || 0)),
      hullDie: Math.max(4, Number(ship && ship.hullDie || 4)),
      wrecked: !!(ship && ship.wrecked)
    };
  }

  function applyBoardingDamageWithBreaks(shipState, side, amount, context) {
    const applied = Math.max(0, Number(amount || 0));
    let hullStepDowns = 0;
    shipState.stress = Math.max(0, Number(shipState.stress || 0)) + applied;

    while (!shipState.wrecked) {
      const threshold = getShipThreshold(shipState, side === "player");
      if (shipState.stress < threshold) {
        break;
      }
      if (shipState.hullDie === 4) {
        shipState.wrecked = true;
        shipState.stress = threshold;
        break;
      }
      shipState.stress -= threshold;
      shipState.hullDie = stepDown(shipState.hullDie);
      hullStepDowns += 1;
      if (side === "player") {
        context.crewTrauma += 1;
      }
    }

    return {
      stressApplied: applied,
      hullStepDowns
    };
  }

  function buildBoardingOutcomeDelta(before, after, impact) {
    return {
      stressApplied: Number(impact && impact.stressApplied || 0),
      stressDelta: Number(after.stress || 0) - Number(before.stress || 0),
      hullFrom: Number(before.hullDie || 4),
      hullTo: Number(after.hullDie || 4),
      hullStepDowns: Number(impact && impact.hullStepDowns || 0),
      wreckedFrom: !!before.wrecked,
      wreckedTo: !!after.wrecked,
      finalStress: Number(after.stress || 0)
    };
  }

  function computeNavalBoardingOutcomePlan(payload, options) {
    ensureExpansionState();
    const allyShip = getActiveNavalAlly();
    const enemyShip = getActiveNavalEnemy();
    const session = S.naval && S.naval.boardingSession;
    if (!session || !session.active) {
      return { ok: false, reason: "no-active-session" };
    }
    if (!allyShip || !enemyShip) {
      return { ok: false, reason: "missing-ships" };
    }

    const apply = !!(options && options.apply);
    const result = String(payload && payload.result || "stalemate").toLowerCase();
    const normalizedResult = result === "victory" || result === "defeat" ? result : "stalemate";
    const enemyDread = getNavalEnemyDreadDie();

    const playerRef = apply ? allyShip : cloneBoardingShipState(allyShip);
    const enemyRef = apply ? enemyShip : cloneBoardingShipState(enemyShip);
    const playerBefore = cloneBoardingShipState(playerRef);
    const enemyBefore = cloneBoardingShipState(enemyRef);

    const context = {
      crewTrauma: Math.max(0, Number(S.naval.crewTrauma || 0))
    };
    const crewBefore = context.crewTrauma;

    let playerImpact = { stressApplied: 0, hullStepDowns: 0 };
    let enemyImpact = { stressApplied: 0, hullStepDowns: 0 };
    const logMessages = [];

    if (normalizedResult === "victory") {
      const enemyThreshold = Math.max(1, Number((enemyRef.hullDie || 4) * 2));
      const toWreck = Math.max(0, enemyThreshold - Number(enemyRef.stress || 0));
      if (toWreck > 0) {
        enemyImpact = applyBoardingDamageWithBreaks(enemyRef, "enemy", toWreck, context);
      }
      enemyRef.wrecked = true;
      if (context.crewTrauma > 0) {
        context.crewTrauma = Math.max(0, context.crewTrauma - 1);
      }
      logMessages.push("Boarding resolved: Victory. Enemy ship wrecked and crew momentum recovered.");
    } else if (normalizedResult === "defeat") {
      const boardingPenalty = Math.max(2, Math.ceil(enemyDread / 2));
      playerImpact = applyBoardingDamageWithBreaks(playerRef, "player", boardingPenalty, context);
      context.crewTrauma = Math.max(0, context.crewTrauma + 1);
      logMessages.push(`Boarding resolved: Defeat. Your ship takes ${boardingPenalty} Stress and +1 Crew Trauma.`);
    } else {
      const mutual = Math.max(1, Math.floor(enemyDread / 3));
      playerImpact = applyBoardingDamageWithBreaks(playerRef, "player", mutual, context);
      enemyImpact = applyBoardingDamageWithBreaks(enemyRef, "enemy", mutual, context);
      logMessages.push(`Boarding resolved: Stalemate. Both ships take ${mutual} Stress.`);
    }

    const playerAfter = cloneBoardingShipState(playerRef);
    const enemyAfter = cloneBoardingShipState(enemyRef);
    const crewAfter = Math.max(0, Number(context.crewTrauma || 0));
    const combatEnds = !!(enemyAfter.wrecked || playerAfter.wrecked);

    const plan = {
      ok: true,
      result: normalizedResult,
      alivePlayers: Math.max(0, Number(payload && payload.alivePlayers || 0)),
      aliveEnemies: Math.max(0, Number(payload && payload.aliveEnemies || 0)),
      enemyDread,
      combatEnds,
      player: buildBoardingOutcomeDelta(playerBefore, playerAfter, playerImpact),
      enemy: buildBoardingOutcomeDelta(enemyBefore, enemyAfter, enemyImpact),
      crewTraumaFrom: crewBefore,
      crewTraumaTo: crewAfter,
      crewTraumaDelta: crewAfter - crewBefore,
      logMessages
    };

    if (apply) {
      S.naval.crewTrauma = crewAfter;
      if (combatEnds) {
        S.naval.combatActive = false;
      }
      if (plan.result === "victory") {
        navalLog(logMessages[0], "good");
      } else if (plan.result === "defeat") {
        navalLog(logMessages[0], "warn");
      } else {
        navalLog(logMessages[0], "");
      }
      if (combatEnds) {
        navalLog("Naval combat ended due to boarding outcome.", enemyAfter.wrecked ? "good" : "warn");
      }
    }

    return plan;
  }

  function previewNavalBoardingOutcomeFromCombatScene(payload) {
    return computeNavalBoardingOutcomePlan(payload, { apply: false });
  }

  function resolveNavalBoardingOutcomeFromCombatScene(payload) {
    ensureExpansionState();
    const allyShip = getActiveNavalAlly();
    const enemyShip = getActiveNavalEnemy();
    const session = S.naval && S.naval.boardingSession;
    if (!session || !session.active) return false;
    if (!allyShip || !enemyShip) {
      S.naval.boardingSession = null;
      return false;
    }

    const plan = computeNavalBoardingOutcomePlan(payload, { apply: true });
    if (!plan || !plan.ok) {
      S.naval.boardingSession = null;
      return false;
    }

    S.naval.boardingSession = null;
    S.naval.boardingReadyRound = 0;
    renderNaval();
    return true;
  }

  function wreckEnemyShip() {
    ensureExpansionState();
    const enemy = getActiveNavalEnemy();
    if (!enemy) {
      return;
    }
    enemy.wrecked = true;
    ensureNavalEnemyFleetState();
    const nextAlive = (S.naval.enemyFleet || []).find(function(entry) { return entry && !entry.wrecked; }) || null;
    if (nextAlive && !S.naval.focusFireLock) {
      S.naval.targetEnemyId = nextAlive.id;
      S.naval.enemyShip = nextAlive;
    }
    navalLog("Enemy ship is marked wrecked.", "good");
    renderNaval();
  }

  function renderGambling() {
    ensureExpansionState();
    const level = GAMBLING_LEVELS.find((item) => item.level === S.gambling.difficulty) || GAMBLING_LEVELS[0];
    const credits = document.getElementById("gamblingCredits");
    const buyIn = document.getElementById("gamblingBuyIn");
    const difficulty = document.getElementById("gamblingDifficultyReadout");
    const die = document.getElementById("gamblingDieReadout");
    const grid = document.getElementById("gamblingDifficultyGrid");
    const history = document.getElementById("gamblingHistory");

    if (credits) {
      credits.textContent = `${S.credits} ₵`;
    }
    if (buyIn) {
      buyIn.textContent = `${level.buyIn} ₵`;
    }
    if (difficulty) {
      difficulty.textContent = `Level ${level.level} - ${level.label}`;
    }
    if (die) {
      die.textContent = `d${level.die}`;
    }
    if (grid) {
      grid.innerHTML = GAMBLING_LEVELS.map((item) => `
        <div class="difficulty-card ${item.level === S.gambling.difficulty ? "sel" : ""}" onclick="setGamblingDifficulty(${item.level})">
          <div class="dc-rank">Level ${item.level}</div>
          <div class="dc-name">${item.label}</div>
          <div class="dc-meta">d${item.die} / ${item.buyIn} C</div>
        </div>
      `).join("");
    }
    ["under", "middle", "over"].forEach((guess) => {
      const button = document.getElementById(`guess-${guess}`);
      if (button) {
        button.classList.toggle("sel", S.gambling.guess === guess);
      }
    });
    if (history) {
      history.innerHTML = S.gambling.history.length
        ? S.gambling.history.map((entry) => `<div class="history-card">${entry}</div>`).join("")
        : '<div class="history-card">No games played yet.</div>';
    }
  }

  function setGamblingDifficulty(level) {
    ensureExpansionState();
    S.gambling.difficulty = level;
    renderGambling();
  }

  function setGamblingGuess(guess) {
    ensureExpansionState();
    S.gambling.guess = guess;
    renderGambling();
  }

  function getValorPosition(valor, low, high) {
    if (valor < low) {
      return "under";
    }
    if (valor > high) {
      return "over";
    }
    return "middle";
  }

  function playGamblingRound() {
    ensureExpansionState();
    const level = GAMBLING_LEVELS.find((item) => item.level === S.gambling.difficulty) || GAMBLING_LEVELS[0];
    if (S.credits < level.buyIn) {
      showNotif("Not enough Credits for that buy-in.", "warn");
      return;
    }

    const dreadOne = roll(level.die);
    const dreadTwo = roll(level.die);
    const low = Math.min(dreadOne, dreadTwo);
    const high = Math.max(dreadOne, dreadTwo);
    const valor = roll(level.die);
    const actual = getValorPosition(valor, low, high);
    const success = actual === S.gambling.guess;

    if (success) {
      S.credits += level.buyIn;
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
    } else {
      S.credits -= level.buyIn;
      if (typeof addTMWOnFail === 'function') { addTMWOnFail(); }
    }

    document.getElementById("gambleDieOne").textContent = String(low);
    document.getElementById("gambleDieTwo").textContent = String(high);
    document.getElementById("gambleValor").textContent = String(valor);

    const outcome = document.getElementById("gamblingOutcome");
    if (outcome) {
      outcome.className = `gamble-outcome ${success ? "good" : "warn"}`;
      outcome.innerHTML = `
        <strong style="color:${success ? "var(--green2)" : "var(--red2)"};">${success ? "Success" : "Failure"}</strong><br>
        Guess: ${capitalize(S.gambling.guess)}<br>
        Valor Die landed in the <strong style="color:var(--gold2);">${capitalize(actual)}</strong> position.<br>
        ${success ? `You gain ${level.buyIn} Credits.` : `You lose ${level.buyIn} Credits.`}
      `;
    }

    S.gambling.history.unshift(
      `Level ${level.level} (${level.label}) - Dread ${low}/${high}, Valor ${valor}, guessed ${S.gambling.guess}, result ${actual}, ${success ? `won ${level.buyIn} C` : `lost ${level.buyIn} C`}.`
    );
    S.gambling.history = S.gambling.history.slice(0, 20);
    updateCreditsUI();
    renderGambling();
  }

  function clearGamblingHistory() {
    ensureExpansionState();
    S.gambling.history = [];
    const outcome = document.getElementById("gamblingOutcome");
    if (outcome) {
      outcome.className = "gamble-outcome";
      outcome.textContent = "Pick a difficulty and a guess, then let the house roll.";
    }
    ["gambleDieOne", "gambleDieTwo", "gambleValor", "gambleAdventure"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = "-";
      }
    });
    renderGambling();
  }

  function syncExpansionUIs() {
    ensureExpansionState();
    mountExpansionPanels();
    updateLastSeaGroupList();
    renderLastSeaMap();
    renderLastSeaInfo();
    renderNaval();
    renderGambling();
    const layoutSelect = document.getElementById("lastSeaLayoutSelect");
    if (layoutSelect) {
      layoutSelect.value = S.lastSea.layout || "random";
    }
    updateLastSeaClickModeUI();
  }

  function runWhenIdle(fn, timeoutMs) {
    if (typeof fn !== "function") return;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn, { timeout: timeoutMs || 900 });
      return;
    }
    setTimeout(fn, Math.min(250, Math.max(0, timeoutMs || 120)));
  }

  function patchExpansionTabSwitch() {
    if (typeof window.switchTab !== "function" || window._expansionSwitchPatched) return;
    window._expansionSwitchPatched = true;
    const baseSwitch = window.switchTab;
    window.switchTab = function (tabId, btn) {
      const out = baseSwitch.apply(this, arguments);
      if (tabId === "lastsea" || tabId === "naval" || tabId === "gambling") {
        mountExpansionPanels();
        if (tabId === "lastsea") {
          renderLastSeaInfo();
          updateLastSeaClickModeUI();
        } else if (tabId === "naval") {
          renderNaval();
        } else if (tabId === "gambling") {
          renderGambling();
        }
      }
      return out;
    };
  }

  function ensureLastSeaClickMode() {
    ensureExpansionState();
    if (S.lastSea.clickMode !== "inspect" && S.lastSea.clickMode !== "travel" && S.lastSea.clickMode !== "fog") {
      S.lastSea.clickMode = "travel";
    }
    return S.lastSea.clickMode;
  }

  function updateLastSeaClickModeUI() {
    const button = document.getElementById("lastSeaClickModeBtn");
    if (!button) {
      return;
    }
    const mode = ensureLastSeaClickMode();
    const label = mode === "travel" ? "Travel" : (mode === "inspect" ? "Inspect" : "Fog");
    button.textContent = `Map Mode: ${label}`;
    if (mode === "travel" || mode === "fog") {
      button.classList.add("btn-teal");
    } else {
      button.classList.remove("btn-teal");
    }
  }

  function toggleLastSeaClickMode() {
    const mode = ensureLastSeaClickMode();
    const order = ["travel", "inspect", "fog"];
    const idx = order.indexOf(String(mode));
    S.lastSea.clickMode = order[(idx + 1) % order.length];
    if (S.lastSea.clickMode === 'fog' && typeof window.getMapFogConfig === 'function') {
      window.getMapFogConfig('sea').enabled = true;
    }
    if (S.lastSea.clickMode !== 'fog' && typeof window.getMapFogConfig === 'function') {
      window.getMapFogConfig('sea').enabled = false;
    }
    updateLastSeaClickModeUI();
    showNotif(
      S.lastSea.clickMode === "travel"
        ? "Last Sea clicks now advance travel time."
        : (S.lastSea.clickMode === "inspect" ? "Last Sea clicks now inspect only." : "Last Sea clicks now reveal fog."),
      "good"
    );
    renderLastSeaMap();
    renderLastSeaInfo();
  }

  function setLastSeaSeason(season, button) {
    setSeason(season, button);
    ensureExpansionState();
    S.lastSea.weather = rollLastSeaWeather();
    renderLastSeaInfo();
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureExpansionState();
    patchExpansionTabSwitch();
    runWhenIdle(() => {
      appendRuleCards();
      mountExpansionPanels();
    }, 1600);
  });

  const baseUpdateCreditsUI = updateCreditsUI;
  updateCreditsUI = function () {
    baseUpdateCreditsUI();
    renderNaval();
    renderGambling();
  };

  const baseLoadCharacter = loadCharacter;
  loadCharacter = function () {
    baseLoadCharacter();
    syncExpansionUIs();
  };

  const baseClearCharacter = clearCharacter;
  clearCharacter = function () {
    baseClearCharacter.apply(this, arguments);
    ensureExpansionState();
    syncExpansionUIs();
  };

  const baseGenerateCharacter = generateCharacter;
  generateCharacter = function () {
    baseGenerateCharacter();
    ensureExpansionState();
    syncExpansionUIs();
  };

  window.setLastSeaSeason = setLastSeaSeason;
  window.toggleLastSeaClickMode = toggleLastSeaClickMode;
  window.generateLastSea = generateLastSea;
  window.renderLastSeaMap = renderLastSeaMap;
  window.clearLastSea = clearLastSea;
  window.exploreLastSeaHex = exploreLastSeaHex;
  window.resolveSeaEncounter = resolveSeaEncounter;
  window.resolveSeaIslandPerilCheck = resolveSeaIslandPerilCheck;
  window.resolveSeaExhaustionCheck = resolveSeaExhaustionCheck;
  window.startSeaPirateLandEncounter = startSeaPirateLandEncounter;
  window.resolveSeaPirateLandOutcome = resolveSeaPirateLandOutcome;
  window.startSeaLandBeastCombat = startSeaLandBeastCombat;
  window.resolveSeaLandBeastOutcome = resolveSeaLandBeastOutcome;
  window.acceptSeaLandmarkProtected = acceptSeaLandmarkProtected;
  window.claimSeaBuriedTreasure = claimSeaBuriedTreasure;
  window.startSeaShipCombatEncounter = startSeaShipCombatEncounter;
  window.resolveSeaShipCombatOutcome = resolveSeaShipCombatOutcome;
  window.joinSeaSkirmishSide = joinSeaSkirmishSide;
  window.resolveSeaSkirmishOutcome = resolveSeaSkirmishOutcome;
  window.seaSkirmishAction = seaSkirmishAction;
  window.resolveOpenSeaPerilCheck = resolveOpenSeaPerilCheck;
  window.maybeAdvanceSeaWeatherOnTravel = maybeAdvanceSeaWeatherOnTravel;
  window.rollSeaSettlementDowntime = rollSeaSettlementDowntime;
  window.resolveSeaSettlementDowntime = resolveSeaSettlementDowntime;
  window.openSeaSettlementMerchant = openSeaSettlementMerchant;
  window.runSeaSettlementSideTask = runSeaSettlementSideTask;
  window.tickSeaSettlementDaily = tickSeaSettlementDaily;
  window.generateTaskForSeaHex = generateTaskForSeaHex;
  window.acceptSeaTask = acceptSeaTask;
  window.completeSeaTask = completeSeaTask;
  window.focusLastSeaHexByKey = focusLastSeaHexByKey;
  window.setLastSeaNote = setLastSeaNote;
  window.openSeaDungeon = openSeaDungeon;
  window.generateShipIdentity = generateShipIdentity;
  window.buyShip = buyShip;
  window.buyNavalUpgrade = buyNavalUpgrade;
  window.rollCrewName = rollCrewName;
  window.hireNavalCrew = hireNavalCrew;
  window.removeNavalCrew = removeNavalCrew;
  window.trainNavalCrew = trainNavalCrew;
  window.selectNavalClass = selectNavalClass;
  window.stowItemInShip = stowItemInShip;
  window.unloadShipCargo = unloadShipCargo;
  window.spawnEnemyShip = spawnEnemyShip;
  window.startNavalCombat = startNavalCombat;
  window.nextNavalRound = nextNavalRound;
  window.clearNavalLog = clearNavalLog;
  window.adjustNavalZone = adjustNavalZone;
  window.applyPowerShift = applyPowerShift;
  window.clearPowerShift = clearPowerShift;
  window.navalAttack = navalAttack;
  window.enemyNavalAttack = enemyNavalAttack;
  window.navalRepair = navalRepair;
  window.navalTactics = navalTactics;
  window.navalMorale = navalMorale;
  window.navalSurvey = navalSurvey;
  window.rollShipPerception = rollShipPerception;
  window.navalDiplomacy = navalDiplomacy;
  window.assignNavalRole = assignNavalRole;
  window.setActiveNavalEnemy = setActiveNavalEnemy;
  window.setActiveNavalAlly = setActiveNavalAlly;
  window.resolveNavalCardManualPrompt = resolveNavalCardManualPrompt;
  window.runNavalPopupAction = runNavalPopupAction;
  window.openNavalCombatPopup = openNavalCombatPopup;
  window.openNavalCombatRulesPage = openNavalCombatRulesPage;
  window.renderNavalCombatPopup = renderNavalCombatPopup;
  window.startNavalBoardingAction = startNavalBoardingAction;
  window.previewNavalBoardingOutcomeFromCombatScene = previewNavalBoardingOutcomeFromCombatScene;
  window.resolveNavalBoardingOutcomeFromCombatScene = resolveNavalBoardingOutcomeFromCombatScene;
  window.wreckEnemyShip = wreckEnemyShip;
  window.repairPlayerShipToFull = repairPlayerShipToFull;
  window.setGamblingDifficulty = setGamblingDifficulty;
  window.setGamblingGuess = setGamblingGuess;
  window.playGamblingRound = playGamblingRound;
  window.clearGamblingHistory = clearGamblingHistory;
  window.launchSeaSceneToCombat = launchSeaSceneToCombat;
})();
