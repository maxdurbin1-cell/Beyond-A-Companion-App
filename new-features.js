/* ============================================================
   new-features.js — Caravan, Holding, Combat Map, Path Token
   Upgrades for BEYOND: The Light
   ============================================================ */
(function () {
  // ── DATA ─────────────────────────────────────────────────────────────────────
  var CARAVAN_SIZES = {
    Small:  { crew: 2, cargo: 12, dread: 6,  stress: 12, modSlots: 1, cost: 1000 },
    Medium: { crew: 4, cargo: 16, dread: 8,  stress: 16, modSlots: 2, cost: 2000 },
    Large:  { crew: 6, cargo: 20, dread: 10, stress: 20, modSlots: 3, cost: 3000 }
  };

  var CARAVAN_NAME_FIRST = ["Iron","Ash","Dust","Red","Grey","Black","Sand","Salt","Broken","Rusty","Wild","Old","Long","Hard","Pale"];
  var CARAVAN_NAME_LAST  = ["Runner","Hauler","Wheel","Drifter","Walker","Mover","Pilgrim","Cart","Rig","Crawler","Nomad","Road","Serpent","Fort","Wagon"];
  var CARAVAN_POWER_SOURCES = [
    "Steam-driven boiler engine — fed by salvaged coal, scorching and unreliable.",
    "Six armored draft horses in heavy harness.",
    "Arcane drive crystals pulled from a Lost City, humming faintly.",
    "Biodiesel engine cobbled from salvaged pre-collapse parts.",
    "Clockwork spring mechanism, wound manually each morning before departure.",
    "Repurposed diesel engine, leaks oil and leaves a black trail.",
    "Plasma coil array, looted from a transport depot — fragile but fast.",
    "Solar collector panels on the roof, sluggish at night or under cloud.",
    "Ethanol furnace burning fermented waste grain.",
    "Wind sail rigged above the flatbed — works only on open terrain.",
    "Hybrid: beast-drawn by day, small salvaged generator by night.",
    "Magnetic levitation array — silent but delicate."
  ];

  var HOLDING_NAME_FIRST = ["Iron","Stone","Ash","Grey","Black","Red","Old","High","Far","Last","Dark","Cold","Storm","Salt","Ember"];
  var HOLDING_NAME_LAST  = ["Keep","Hold","Gate","Reach","Watch","Bastion","Spire","Haven","Seat","Citadel","Tower","Wall","Fort","Mire","End"];

  var CHASE_ZONES = ["Engaged", "Close", "Nearby", "Far"];

  var CARAVAN_MODS = [
    { id: "defense",     name: "Defense Module",    base: "Adds +d4 to Defend Rolls made against the Transporter." },
    { id: "wheelspikes", name: "Wheel Spikes",       base: "When Engaged with another Transporter, roll Strike +d4." },
    { id: "medroom",     name: "Med Room",           base: "Heals +1 Trauma when used during a rest." },
    { id: "expandable",  name: "Expandable Room",    base: "Increases item carrying capacity by +5 Items." },
    { id: "crossbolts",  name: "Mounted Crossbolts", base: "Add +1d4 to Shoot Rolls made from the Transporter." },
    { id: "chains",      name: "Chains",             base: "Draw an enemy Transporter from Close to Engaged during combat." },
    { id: "techroom",    name: "Tech Room",          base: "With a Control, Tinker check, craft items worth 100₵ of resources." },
    { id: "browse",      name: "Browse",             base: "Compares local stock, prices, and settlement supplies." },
    { id: "stealth",     name: "Stealth Coating",    base: "Grants +d4 to Control rolls to avoid detection." },
    { id: "jammer",      name: "Signal Jammer",      base: "Interferes with enemy communications within a Zone." }
  ];

  var CARAVAN_DAMAGE_TABLE = [
    "Lose d6 Items from your Transporter's Storage.",
    "Decrease Dread Die (DD) by one Step.",
    "Control Save or be overturned — the Transporter is disabled."
  ];

  var CRISIS_TYPES = [
    { name: "Anarchy",     desc: "Rising disorder and lawlessness.",     resolution: "Restore order and uphold justice." },
    { name: "Insolvency",  desc: "A dire shortage of resources.",         resolution: "Replenish the Realm's wealth." },
    { name: "Drought",     desc: "Scarcity of food and water.",           resolution: "Secure food for the populace." },
    { name: "Despondency", desc: "Widespread disillusionment.",           resolution: "Uplift morale and instill hope." },
    { name: "Fear",        desc: "A pervasive sense of insecurity.",       resolution: "Strengthen defenses and reassure the populace." },
    { name: "Treachery",   desc: "Growing distrust and disloyalty.",      resolution: "Reinforce loyalty and unity within the council." }
  ];

  var COUNCIL_ROLES = [
    { key: "regent",    name: "Regent",    desc: "Acts as your voice, executing your will and overseeing day-to-day affairs." },
    { key: "commander", name: "Commander", desc: "Trains and equips Wardens, readying forces against threats." },
    { key: "diplomat",  name: "Diplomat",  desc: "Manages alliances and negotiations amongst other Holdings." },
    { key: "elder",     name: "The Elder", desc: "A Sage who takes residence in your Holding, offering wisdom and judgment." }
  ];

  var COURT_COMMONER_TASKS = [
    "A commoner seeks justice for stolen livestock — someone in the Realm is responsible.",
    "A family petitions for land rights to an unclaimed parcel in the east.",
    "A merchant disputes taxes levied on their caravan at the north road.",
    "A group of farmers claims the river has been diverted, drying their fields.",
    "A widow asks that her son, imprisoned last season, be granted clemency.",
    "Three neighbors cannot agree on a property boundary. All three are partially wrong.",
    "A blacksmith wants the Realm's exclusive contract for ironwork.",
    "An entire village reports strange illness and asks for a healer and answers."
  ];

  var COURT_ACOLYTE_TASKS = [
    "An acolyte bears a decree from the Temple of Ash — tithes are overdue.",
    "A Sage requests a waystone be erected on the road to the eastern shrine.",
    "The Circle of Elders demands the Realm cease mining near sacred ground.",
    "An acolyte warns that a traveling curse was last seen heading for your Holding.",
    "A Sage offers blessing in exchange for use of your Commander's forces.",
    "The Elder's council requests access to the Realm's archives — their own were destroyed.",
    "A young acolyte delivers a sealed letter marked with the Sovereign's seal.",
    "The Sages have sent a representative to evaluate your Realm's spiritual standing."
  ];

  // ── STATE ─────────────────────────────────────────────────────────────────────
  function ensureNewFeatureState() {
    if (typeof S === "undefined") { return; }

    var prevCaravan = S.caravan || {};
    S.caravan = Object.assign({
      owned: false,
      name: "",
      powerSource: "",
      size: "Small",
      crew: 0,
      cargo: Array(12).fill(""),
      stress: 0,
      wheelsLost: 0,
      dreadReduced: 0,
      mods: [],
      chase: {
        active: false,
        zone: "Close",
        round: 1,
        enemyDread: 6,
        driverStat: "control",
        overturned: false,
        turn: "setup",
        actionsRemaining: 0,
        enemyActionsRemaining: 2,
        enemyConvoys: [],
        targetEnemyId: "",
        focusFireLock: false,
        allyConvoys: [],
        activeAllyId: "",
        roleAssignments: {
          driver: "",
          scout: "",
          captain: "",
          engineer: ""
        },
        log: []
      }
    }, prevCaravan);

    if (!Array.isArray(S.caravan.cargo)) { S.caravan.cargo = Array(12).fill(""); }
    if (!Array.isArray(S.caravan.mods)) { S.caravan.mods = []; }
    S.caravan.chase = Object.assign(
      {
        active: false,
        zone: "Close",
        round: 1,
        enemyDread: 6,
        driverStat: "control",
        overturned: false,
        turn: "setup",
        actionsRemaining: 0,
        enemyActionsRemaining: 2,
        enemyConvoys: [],
        targetEnemyId: "",
        focusFireLock: false,
        allyConvoys: [],
        activeAllyId: "",
        roleAssignments: { driver: "", scout: "", captain: "", engineer: "" },
        log: []
      },
      S.caravan.chase || {}
    );
    if (!Array.isArray(S.caravan.chase.log)) { S.caravan.chase.log = []; }
    if (!Array.isArray(S.caravan.chase.enemyConvoys)) { S.caravan.chase.enemyConvoys = []; }
    if (!Array.isArray(S.caravan.chase.allyConvoys)) { S.caravan.chase.allyConvoys = []; }
    S.caravan.chase.roleAssignments = Object.assign({ driver: "", scout: "", captain: "", engineer: "" }, S.caravan.chase.roleAssignments || {});

    var prevHolding = S.holding || {};
    S.holding = Object.assign({
      name: "",
      established: false,
      type: "Citadel",
      landmarks: [
        { type: "Dwelling", name: "Riverside Shelter", notes: "" },
        { type: "Dwelling", name: "Nomad Camp",        notes: "" },
        { type: "Temple",   name: "Temple of the Forgotten", notes: "" }
      ],
       extraLandmarks: [], 
       vault: [],
      council: {
        regent:    { name: "", retainers: 3, task: "", status: "Idle" },
        commander: { name: "", retainers: 3, task: "", status: "Idle" },
        diplomat:  { name: "", retainers: 3, task: "", status: "Idle" },
        elder:     { name: "", retainers: 3, task: "", status: "Idle" }
      },
      councilTasks: [],
      pendingCourtType: "commoner",
      retainerContracts: 0,
      regentFailures: 0,
      crises: [],
      taxLog: [],
      bank: {
        invested: 0,
        accrued: 0,
        risk: 'low',
        lastTickAt: 0,
        history: []
      },
      crucible: {
        wins: 0,
        losses: 0,
        roundsPlayed: 0,
        lastResult: '',
        bestWinStreak: 0,
        currentWinStreak: 0,
        lastAt: 0,
        preferredMode: 'control',
        controlLoadout: {
          armor: 'balanced',
          weapon: 'sword'
        },
        match: null,
        expedition: {
          runs: 0,
          clears: 0,
          bestDay: 0,
          lastRunResult: ''
        }
      }
    }, prevHolding);
    S.holding.wayfarerHome = Object.assign({
      decorLevel: 0,
      securityLevel: 0,
      workshopLevel: 0,
      marketLevel: 0,
      decorTheme: "Frontier",
      log: []
    }, S.holding.wayfarerHome || {});
    if (!Array.isArray(S.holding.wayfarerHome.log)) { S.holding.wayfarerHome.log = []; }
    if (!Array.isArray(S.holding.landmarks))      { S.holding.landmarks = []; }
    if (!Array.isArray(S.holding.extraLandmarks)) { S.holding.extraLandmarks = []; }
    if (!Array.isArray(S.holding.crises))         { S.holding.crises = []; }
      if (!Array.isArray(S.holding.vault))          { S.holding.vault = []; }
    if (!Array.isArray(S.holding.councilTasks))    { S.holding.councilTasks = []; }
    if (!Array.isArray(S.holding.taxLog))         { S.holding.taxLog = []; }
    if (!S.holding.bank || typeof S.holding.bank !== 'object') {
      S.holding.bank = {
        invested: 0,
        accrued: 0,
        risk: 'low',
        lastTickAt: 0,
        history: []
      };
    }
    S.holding.bank.invested = Math.max(0, Number(S.holding.bank.invested || 0));
    S.holding.bank.accrued = Math.max(0, Number(S.holding.bank.accrued || 0));
    S.holding.bank.risk = String(S.holding.bank.risk || 'low');
    if (!Array.isArray(S.holding.bank.history)) { S.holding.bank.history = []; }
    if (!S.holding.crucible || typeof S.holding.crucible !== 'object') {
      S.holding.crucible = {
        wins: 0,
        losses: 0,
        roundsPlayed: 0,
        lastResult: '',
        bestWinStreak: 0,
        currentWinStreak: 0,
        lastAt: 0,
        preferredMode: 'control',
        controlLoadout: {
          armor: 'balanced',
          weapon: 'sword'
        },
        match: null,
        expedition: {
          runs: 0,
          clears: 0,
          bestDay: 0,
          lastRunResult: ''
        }
      };
    }
    if (!S.holding.crucible.preferredMode) S.holding.crucible.preferredMode = 'control';
    if (!S.holding.crucible.controlLoadout || typeof S.holding.crucible.controlLoadout !== 'object') {
      S.holding.crucible.controlLoadout = { armor: 'balanced', weapon: 'sword' };
    }
    if (!S.holding.crucible.expedition || typeof S.holding.crucible.expedition !== 'object') {
      S.holding.crucible.expedition = {
        runs: 0,
        clears: 0,
        bestDay: 0,
        lastRunResult: ''
      };
    }
    if (!S.holding.governance || typeof S.holding.governance !== 'object') {
      S.holding.governance = {
        patrolStance: 'balanced',
        tariffStance: 'balanced',
        routePriority: 'trade',
        updatedAt: 0
      };
    }
    // Ownership is established by successful quest completion, not by entering a name.

    if (!S.holding.council || typeof S.holding.council !== "object") {
      S.holding.council = {
        regent:    { name: "", retainers: 3, task: "" },
        commander: { name: "", retainers: 3, task: "" },
        diplomat:  { name: "", retainers: 3, task: "" },
        elder:     { name: "", retainers: 3, task: "" }
      };
    }
    if (!S.holding.customHexTiles || typeof S.holding.customHexTiles !== 'object') {
      S.holding.customHexTiles = {};
    }

    S.extraTraits = Array.isArray(S.extraTraits) ? S.extraTraits : [];

    S.augmentations = Array.isArray(S.augmentations) ? S.augmentations : [];
    S.ownedHacks    = Array.isArray(S.ownedHacks)    ? S.ownedHacks    : [];
    S.weaponMods    = Array.isArray(S.weaponMods)    ? S.weaponMods    : [];
    S.hackRoller    = Object.assign(
      { dreadDie: 6, guess: null, selectedHack: null },
      S.hackRoller || {}
    );
    S.holdingQuest  = Object.assign(
      {
        active: false,
        step: 0,
        hexId: null,
        infoHex: null,
        siteHex: null,
        holdingHex: null,
        failed: false,
        attempts: 0,
        step1Completed: false,
        step1Skipped: false,
        step2Completed: false,
        step3Completed: false,
        bonus: 0,
        infoFeature: null,
        additionalDanger: null,
        siteRooms: null,
        securityCount: 0,
        rewardCredits: 250,
        rewardLoot: []
      },
      S.holdingQuest || {}
    );
    // Backfill ownership for saves where quest was completed before established flag existed.
    if (S.holdingQuest.step3Completed && !S.holdingQuest.failed) { S.holding.established = true; }

    var prevMap = S.combatMap || {};
    S.combatMap = Object.assign({ units: [], aoeTemplates: [], aoeSeq: 0, activeAoeTemplateId: '' }, prevMap);
    if (!Array.isArray(S.combatMap.units)) { S.combatMap.units = []; }
    if (!Array.isArray(S.combatMap.aoeTemplates)) { S.combatMap.aoeTemplates = []; }
    if (!S.combatMap.aoeSeq || !Number.isFinite(Number(S.combatMap.aoeSeq))) S.combatMap.aoeSeq = 0;
    if (typeof S.combatMap.activeAoeTemplateId !== 'string') S.combatMap.activeAoeTemplateId = '';
  }

  // ── MOUNT ─────────────────────────────────────────────────────────────────────
  function mountNewFeaturePanels() {
    mountCaravanPanel();
    mountHoldingPanel();
  }

  function mountCaravanPanel() {
    var panel = document.getElementById("tab-caravan");
    if (!panel || panel.dataset.mounted) { return; }
    panel.dataset.mounted = "1";
    panel.innerHTML = buildCaravanHTML();
    renderCaravanUI();
  }

  function mountHoldingPanel() {
    var panel = document.getElementById("tab-holding");
    if (!panel) { return; }
    if (panel.dataset.mounted && panel.querySelector("#holdingGate") && panel.querySelector("#holdingBody")) { return; }
    panel.dataset.mounted = "1";
    panel.innerHTML = buildHoldingHTML();
    renderHoldingUI();
  }

  function updateHoldingTabVisibility() {
    // Holdings tab is always visible; gate is handled inside the panel.
  }

  function getHoldingGovernanceState() {
    ensureNewFeatureState();
    var local = S.holding && S.holding.governance ? S.holding.governance : {};
    var world = (typeof window !== 'undefined' && typeof window.getProvinceGovernancePolicyState === 'function')
      ? (window.getProvinceGovernancePolicyState() || {})
      : {};
    return {
      patrolStance: String(world.patrolStance || local.patrolStance || 'balanced'),
      tariffStance: String(world.tariffStance || local.tariffStance || 'balanced'),
      routePriority: String(world.routePriority || local.routePriority || 'trade'),
      updatedAt: Number(world.updatedAt || local.updatedAt || 0)
    };
  }

  function syncHoldingGovernanceToWorldState() {
    ensureNewFeatureState();
    var state = getHoldingGovernanceState();
    S.holding.governance = Object.assign({}, state);
    if (typeof window !== 'undefined' && typeof window.setProvinceGovernancePolicyState === 'function') {
      try { window.setProvinceGovernancePolicyState(state); } catch (_err) { console.error(_err); }
    }
  }

  function closeOnlyModal() {
    if (typeof closeModal === 'function') {
      closeModal();
      return true;
    }
    return false;
  }

  function goBackModalOnly() {
    if (typeof goBackModal === 'function') {
      goBackModal();
      return true;
    }
    return closeOnlyModal();
  }

  function goBackOrCloseModal() {
    return goBackModalOnly();
  }

  function buildNestedModalActionRow(actionsHtml, opts) {
    var options = opts || {};
    var gap = options.gap || '.35rem';
    var justify = options.justify || 'flex-end';
    var wrap = options.wrap || 'wrap';
    var includeCancel = options.includeCancel !== false;
    var goBackLabel = options.goBackLabel || 'Go Back';
    var cancelLabel = options.cancelLabel || 'Cancel';
    var cancelMode = options.cancelMode || (options.cancelUsesClose ? 'close' : 'close');
    var cancelHandler = cancelMode === 'back' ? 'goBackModalOnly()' : 'closeOnlyModal()';
    var goBackBtn = '<button class="btn btn-sm" onclick="goBackModalOnly()">' + goBackLabel + '</button>';
    var cancelBtn = includeCancel ? ('<button class="btn btn-sm" onclick="' + cancelHandler + '">' + cancelLabel + '</button>') : '';
    return '<div style="display:flex;gap:' + gap + ';flex-wrap:' + wrap + ';justify-content:' + justify + ';">'
      + goBackBtn + cancelBtn + String(actionsHtml || '')
      + '</div>';
  }

  window.goBackOrCloseModal = goBackOrCloseModal;
  window.closeOnlyModal = closeOnlyModal;
  window.goBackModalOnly = goBackModalOnly;

  function setHoldingGovernancePolicy(field, value) {
    ensureNewFeatureState();
    var policy = getHoldingGovernanceState();
    var key = String(field || '').toLowerCase();
    var val = String(value || '').toLowerCase();
    if (key === 'patrol') {
      policy.patrolStance = (val === 'strict' || val === 'open') ? val : 'balanced';
    } else if (key === 'tariff') {
      policy.tariffStance = (val === 'extractive' || val === 'relief') ? val : 'balanced';
    } else if (key === 'route') {
      policy.routePriority = (val === 'military' || val === 'civic') ? val : 'trade';
    } else {
      return;
    }
    policy.updatedAt = Date.now();
    S.holding.governance = Object.assign({}, policy);
    if (typeof window !== 'undefined' && typeof window.setProvinceGovernancePolicyState === 'function') {
      try { window.setProvinceGovernancePolicyState(policy); } catch (_err) { console.error(_err); }
    }
    if (typeof showNotif === 'function') {
      showNotif('Governance policy updated: ' + key + ' → ' + val + '.', 'good');
    }
    renderHoldingUI();
    if (typeof renderHexMap === 'function') { try { renderHexMap(); } catch (_e0) { console.error(_e0); } }
    if (typeof selectedHex !== 'undefined' && selectedHex && typeof renderHexInfo === 'function') {
      try { renderHexInfo(selectedHex); } catch (_e1) { console.error(_e1); }
    }
  }

  // ── CARAVAN HTML ──────────────────────────────────────────────────────────────
  function buildCaravanHTML() {
    var caravanTitle = (window.SharedIconSystem && typeof window.SharedIconSystem.iconVehicle === 'function')
      ? (window.SharedIconSystem.iconVehicle('caravan', { size: 24, title: 'Caravan' }) + '<span style="margin-left:.42rem;vertical-align:middle;">Caravan Management</span>')
      : 'Caravan Management';
    return [
      '<div class="command-table-shell command-table-caravan">',
        '<div class="ship-banner command-table-hero">',
          '<div class="command-kicker">Command Table · Caravan / Holding Routes</div>',
          '<h3>' + caravanTitle + '</h3>',
          '<p>Your Transporter — vehicle, crew, cargo, and chase combat from one table. The Driver rolls Control vs Enemy Dread to shift zones; the board keeps stress, wheels, roles, and hostile pressure readable.</p>',
        '</div>',
        '<div id="caravanGate"></div>',
        '<div id="caravanBody">',
          '<div class="sea-summary command-stat-strip">',
            '<div class="info-cell"><span class="ic-label">Credits</span><span id="caravanCredits">0 ₵</span></div>',
            '<div class="info-cell"><span class="ic-label">Chase Zone</span><span id="caravanZoneReadout">Close</span></div>',
            '<div class="info-cell"><span class="ic-label">Stress</span><span id="caravanStressReadout">0 / 12</span></div>',
            '<div class="info-cell"><span class="ic-label">Mods Installed</span><span id="caravanModSlotsReadout">0 / 1</span></div>',
          '</div>',
          '<div class="command-table-grid" style="margin-top:.72rem;">',
            '<div class="card command-panel command-left">',
              '<div class="section-title">Transporter Identity</div>',
              '<div class="form-row"><span class="sub-label">Name</span>',
                '<div style="display:flex;gap:.3rem;align-items:center;">',
                  '<input type="text" id="caravanName" placeholder="Your Transporter\'s name…" style="flex:1;" onchange="S.caravan.name=this.value">',
                  '<button class="btn btn-xs btn-teal" onclick="rollCaravanName()" title="Roll random name">⚄</button>',
                  '<button class="btn btn-xs" onclick="clearCaravanName()" title="Clear name">✕</button>',
                '</div>',
              '</div>',
              '<div class="form-row"><span class="sub-label">Power Source / Description</span>',
                '<textarea id="caravanPowerSource" rows="2" placeholder="Steam engine, beast-drawn, arcane drive…" style="resize:none;width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text);padding:.35rem .45rem;font-family:\'Crimson Pro\',serif;font-size:.9rem;" onchange="S.caravan.powerSource=this.value"></textarea>',
                '<div class="command-toolbar" style="margin-top:.25rem;">',
                  '<button class="btn btn-xs btn-teal" onclick="rollCaravanPowerSource()">⚄ Roll Power Source</button>',
                  '<button class="btn btn-xs" onclick="clearCaravanPowerSource()">✕ Clear</button>',
                '</div>',
              '</div>',
              '<div class="command-panel-title">Size</div>',
              '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.35rem;margin-bottom:.6rem;" id="caravanSizeGrid"></div>',
              '<div class="command-panel-title">Transport Stats</div>',
              '<div id="caravanStatBlock"></div>',
              '<div class="command-panel-title">Stress Track</div>',
              '<div class="stress-track" id="caravanStressPips"></div>',
              '<div class="command-toolbar" style="margin-top:.4rem;">',
                '<button class="btn btn-sm btn-red" onclick="changeCaravanStress(1)">+ Stress</button>',
                '<button class="btn btn-sm btn-green" onclick="changeCaravanStress(-1)">− Stress</button>',
                '<button class="btn btn-sm btn-red" onclick="rollHeavyDamage()">⚄ Heavy Hit (d6)</button>',
                '<button class="btn btn-sm btn-teal" onclick="repairCaravan()">Full Repair</button>',
              '</div>',
              '<div id="heavyDamageResult" style="margin-top:.4rem;font-size:.83rem;"></div>',
            '</div>',
            '<div class="card command-panel command-right">',
              '<div class="section-title">Crew & Hold</div>',
              '<div class="command-form-grid">',
                '<div><span class="sub-label">Crew Aboard</span>',
                  '<div class="counter-row">',
                    '<button class="step-btn" onclick="changeCaravanCrew(-1)">−</button>',
                    '<span class="counter-val teal-val" id="caravanCrewVal">0</span>',
                    '<button class="step-btn" onclick="changeCaravanCrew(1)">+</button>',
                    '<span style="font-family:\'Rajdhani\',sans-serif;font-size:.78rem;color:var(--muted2);margin-left:.3rem;">/ <span id="caravanMaxCrew">2</span></span>',
                  '</div>',
                '</div>',
                '<div><span class="sub-label">Wheels Lost</span>',
                  '<div class="counter-row">',
                    '<button class="step-btn" onclick="changeCaravanWheels(-1)">−</button>',
                    '<span class="counter-val red-val" id="caravanWheelsVal">0</span>',
                    '<button class="step-btn" onclick="changeCaravanWheels(1)">+</button>',
                  '</div>',
                  '<div id="wheelsWarning" style="font-size:.72rem;color:var(--red);margin-top:.1rem;display:none;">⚠ Disadvantage to all Checks</div>',
                '</div>',
              '</div>',
              '<div class="command-panel-title">Storage</div>',
              '<div id="caravanCargoGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem;"></div>',
              '<div class="command-panel-title">Mods Installed</div>',
              '<div id="caravanInstalledMods" style="margin-bottom:.4rem;"></div>',
              '<div class="command-panel-title">Available Mods</div>',
              '<div class="command-subcopy">Cost: 5 Path Tokens + 2d20×10 Credits per installation. Purchased at a Holding.</div>',
              '<div id="caravanModsList"></div>',
            '</div>',
            '<div class="card command-panel command-board-panel">',
              '<div class="section-title">Chase Combat</div>',
              '<div class="command-subcopy">Driver maneuvers shift the chase zone. Engaged = Strike · Close = spells/items · Nearby = Shoot · Far = out of range. Other Wayfarers act on their own turns.</div>',
              '<div class="command-schematic command-schematic-caravan" aria-hidden="true">',
                '<div class="command-schematic-title">Route Board</div>',
                '<div class="command-vessel"></div>',
                '<span class="command-station gold" style="--x:50%;--y:32%;">Driver</span>',
                '<span class="command-station" style="--x:30%;--y:58%;">Scout</span>',
                '<span class="command-station" style="--x:70%;--y:58%;">Captain</span>',
                '<span class="command-station gold" style="--x:50%;--y:82%;">Engineer</span>',
              '</div>',
              '<div class="command-panel-title">Zone Track</div>',
              '<div class="zone-track" id="caravanZoneTrack" style="margin-bottom:.55rem;flex-wrap:wrap;"></div>',
              '<div class="command-toolbar">',
                '<button class="btn btn-sm btn-teal" onclick="startChase()">Start / Reset</button>',
                '<button class="btn btn-sm" onclick="nextChaseRound()">Next Round</button>',
                '<button class="btn btn-sm btn-red" onclick="endChase()">End Chase</button>',
                '<button class="btn btn-sm btn-teal" onclick="openCaravanCombatPopup()">Open Combat Popup</button>',
              '</div>',
              '<div class="command-form-grid">',
                '<div><span class="sub-label">Driver Stat</span>',
                  '<select id="chaseDriverStat" onchange="S.caravan.chase.driverStat=this.value">',
                    '<option value="control">Control</option>',
                    '<option value="body">Body</option>',
                    '<option value="mind">Mind</option>',
                    '<option value="spirit">Spirit</option>',
                  '</select>',
                '</div>',
                '<div><span class="sub-label">Enemy Dread</span>',
                  '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-top:.25rem;">',
                    [4,6,8,10,12].map(function(d){ return '<button class="btn btn-xs" onclick="setChaseEnemyDread('+d+')">d'+d+'</button>'; }).join(""),
                  '</div>',
                  '<div style="font-family:\'Rajdhani\',sans-serif;font-size:.82rem;color:var(--red);margin-top:.2rem;">Current: <span id="chaseEnemyDreadDisplay">d6</span></div>',
                '</div>',
              '</div>',
              '<div class="combat-actions command-actions">',
                '<button class="btn btn-primary" onclick="rollChaseControl()">⚄ Roll Control (Drive)</button>',
                '<button class="btn btn-sm" onclick="adjustChaseZone(-1)">← Closer</button>',
                '<button class="btn btn-sm" onclick="adjustChaseZone(1)">Farther →</button>',
                '<button class="btn btn-sm btn-red" onclick="rollChaseEnemyAttack()">Enemy Attack</button>',
              '</div>',
              '<div id="chaseCombatStatus" style="font-family:\'Rajdhani\',sans-serif;font-size:.82rem;color:var(--muted2);margin-top:.4rem;"></div>',
              '<div class="command-panel-title">Chase Log</div>',
              '<div class="combat-log" id="chaseLog" style="max-height:220px;overflow:auto;"></div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join("");
  }
  function buildHoldingHTML() {
    return [
      '<div class="command-table-shell command-table-holding">',
        '<div class="ship-banner command-table-hero">',
          '<div class="command-kicker">Domain Table · Holding / Lordship</div>',
          '<h3>Holding Management — Lordship</h3>',
          '<p>Requires Renown 9 (Lord). Govern your Realm from one table: landmarks, council orders, court petitions, treasury care, seasonal crises, vault, and Wayfarer home.</p>',
        '</div>',
        '<div id="holdingGate"></div>',
        '<div id="holdingBody">',
          '<div class="sea-summary command-stat-strip">',
            '<div class="info-cell"><span class="ic-label">Renown</span><span id="holdingRenownReadout">0</span></div>',
            '<div class="info-cell"><span class="ic-label">Credits</span><span id="holdingCreditsReadout">0 ₵</span></div>',
            '<div class="info-cell"><span class="ic-label">Total Landmarks</span><span id="holdingLandmarkCount">3</span></div>',
            '<div class="info-cell"><span class="ic-label">Active Crises</span><span id="holdingCrisisCount">0</span></div>',
          '</div>',
          '<div class="command-table-grid" style="margin-top:.72rem;">',
            '<div class="card command-panel command-left">',
              '<div class="section-title">Realm Identity</div>',
              '<div class="form-row"><span class="sub-label">Holding Name</span>',
                '<div style="display:flex;gap:.3rem;align-items:center;">',
                  '<input type="text" id="holdingName" placeholder="Name your domain…" style="flex:1;" onchange="S.holding.name=this.value">',
                  '<button class="btn btn-xs btn-teal" onclick="rollHoldingName()" title="Roll random name">⚄</button>',
                  '<button class="btn btn-xs" onclick="clearHoldingName()" title="Clear name">✕</button>',
                '</div>',
              '</div>',
              '<div class="form-row"><span class="sub-label">Holding Type</span>',
                '<select id="holdingType" onchange="S.holding.type=this.value">',
                  '<option>Citadel</option><option>Fortress</option><option>Tower</option><option>Settlement</option>',
                '</select>',
              '</div>',
              '<div class="command-panel-title">Landmark Stewardship</div>',
              '<div class="command-subcopy">You begin responsible for 3 Landmarks: 2 Dwellings + 1 Temple. Each Season, earn 1d4×10₵ per Landmark.</div>',
              '<div id="holdingLandmarks"></div>',
              '<div class="command-toolbar" style="margin-top:.5rem;">',
                '<button class="btn btn-sm btn-primary" onclick="collectTax()">⚄ Collect Tax</button>',
                '<button class="btn btn-sm" onclick="buyLandmark()">Buy Landmark (5,000₵)</button>',
              '</div>',
              '<div id="holdingTaxResult" style="margin-top:.35rem;font-size:.83rem;"></div>',
              '<div class="command-panel-title">Holding Vault</div>',
              '<div class="command-subcopy">Secure Storage — move items here from your Backpack.</div>',
              '<div id="holdingVault" style="min-height:2rem;"></div>',
              '<div class="command-toolbar" style="margin-top:.4rem;">',
                '<button class="btn btn-xs btn-primary" onclick="moveBackpackToVault()">Stow from Backpack</button>',
              '</div>',
              '<div class="command-panel-title">Holding Acquisition</div>',
              '<div id="holdingQuestStatus"></div>',
            '</div>',
            '<div class="card command-panel command-board-panel">',
              '<div class="section-title">Realm Command</div>',
              '<div class="holding-realm-board" aria-hidden="true">',
                '<div class="holding-board-label">Domain Ledger</div>',
                '<div class="holding-keep"></div>',
                '<span class="holding-node" style="--x:50%;--y:18%;">Council</span>',
                '<span class="holding-node teal" style="--x:22%;--y:46%;">Court</span>',
                '<span class="holding-node teal" style="--x:78%;--y:46%;">Treasury</span>',
                '<span class="holding-node" style="--x:50%;--y:82%;">Crises</span>',
              '</div>',
              '<div class="command-panel-title">The Council</div>',
              '<div class="command-subcopy">Assign retainers and tasks. Roll Valor Die vs Dread d8 for outcomes across phases or seasons.</div>',
              '<div id="holdingCouncil"></div>',
              '<div class="command-panel-title">Regional Governance</div>',
              '<div class="command-subcopy">Late-game policy loop (Renown 12+). Set patrol, tariff, and route priorities to shape consequence spread, mission bias, and market pressure.</div>',
              '<div id="holdingGovernancePanel"></div>',
              '<div class="command-panel-title">Holding Treasury</div>',
              '<div class="command-subcopy">Prompt an amount, pick a care tier, and let the bank handle the credits.</div>',
              '<div id="holdingBankPanel"></div>',
              '<div class="command-toolbar" style="margin-top:.4rem;">',
                '<button class="btn btn-sm btn-teal" onclick="openHoldingBankingModal();">Open Treasury</button>',
              '</div>',
            '</div>',
            '<div class="card command-panel command-right">',
              '<div class="section-title">Court & Season</div>',
              '<div class="command-panel-title">The Court</div>',
              '<div class="command-subcopy">Those who seek your service and counsel. Hear their case and issue a Task.</div>',
              '<div class="command-actions" style="margin:.25rem 0 .55rem!important;">',
                '<button class="btn btn-primary" onclick="generateCourtEvent(\'commoner\')">👥 Hear a Commoner</button>',
                '<button class="btn btn-teal" onclick="generateCourtEvent(\'acolyte\')">📿 Hear an Acolyte</button>',
                '<button class="btn" onclick="generateCourtEvent(\'military\')">⚔ Commander Request</button>',
              '</div>',
              '<div id="holdingCourtResult"></div>',
              '<div class="command-panel-title">Holding Downtime</div>',
              '<div class="command-subcopy">Roll celebration events or pick focused activities to talk, accomplish local tasks, and explore your realm.</div>',
              '<div class="command-actions" style="margin:.25rem 0 .55rem!important;">',
                '<button class="btn btn-primary" onclick="rollHoldingDowntimeEvent()">⚄ Celebration Event</button>',
                '<button class="btn btn-teal" onclick="rollHoldingDowntimeActivity(\'talk\')">💬 Talk To People</button>',
                '<button class="btn" onclick="rollHoldingDowntimeActivity(\'task\')">🧾 Accomplish Task</button>',
                '<button class="btn btn-warn" onclick="rollHoldingDowntimeActivity(\'explore\')">🧭 Explore Holdings</button>',
              '</div>',
              '<div id="holdingDowntimeResult" style="margin-top:.45rem;font-size:.82rem;"></div>',
              '<div class="command-panel-title">Perils of Leadership</div>',
              '<div class="command-subcopy">At each Season onset or return from extended travel, roll d6 for your Realm\'s fate.</div>',
              '<div class="command-card-grid" style="margin-bottom:.6rem;">',
                '<div class="command-action-card" style="border-color:rgba(201,64,64,.28);"><div class="command-action-title" style="color:var(--red2);">1–2 Catastrophe</div><div class="command-action-effect">The Realm faces 2 immediate Crises.</div></div>',
                '<div class="command-action-card" style="border-color:rgba(232,192,80,.28);"><div class="command-action-title" style="color:var(--gold2);">3–4 Conundrum</div><div class="command-action-effect">A choice between 2 Crises presents itself.</div></div>',
                '<div class="command-action-card" style="border-color:rgba(76,175,116,.28);"><div class="command-action-title" style="color:var(--green2);">5–6 Tranquility</div><div class="command-action-effect">A period of relative peace and prosperity.</div></div>',
              '</div>',
              '<button class="btn btn-primary" onclick="rollLeadershipPeril()">⚄ Roll Seasonal Peril (d6)</button>',
              '<div id="holdingPerilResult" style="margin-top:.45rem;font-size:.83rem;"></div>',
              '<div class="command-panel-title">Active Crises</div>',
              '<div id="holdingActiveCrises"></div>',
              '<div class="command-toolbar" style="margin-top:.4rem;">',
                '<button class="btn btn-sm" onclick="addManualCrisis()">+ Add Crisis</button>',
                '<button class="btn btn-sm btn-red" onclick="clearAllCrises()">Clear All</button>',
              '</div>',
              '<div class="command-panel-title">Wayfarer Home</div>',
              '<div class="command-subcopy">Upgrade decor, security, workshop, and market amenities. Bonuses feed mission and district economy outcomes.</div>',
              '<div id="wayfarerHomePanel"></div>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join("");
  }

  // ── CARAVAN RENDER ─────────────────────────────────────────────────────────────
  function renderCaravanUI() {
    var panel = document.getElementById("tab-caravan");
    if (!panel || !panel.dataset.mounted) { return; }
    ensureNewFeatureState();
    var c = S.caravan;
    var sz = CARAVAN_SIZES[c.size] || CARAVAN_SIZES.Small;

    // Purchase gate
    var gate = document.getElementById("caravanGate");
    var body = document.getElementById("caravanBody");
    if (gate) {
      if (!c.owned) {
        gate.innerHTML = '<div class="card" style="max-width:540px;margin-top:.6rem;">'
          + '<div class="section-title">Acquire a Transporter</div>'
          + '<div style="font-size:.8rem;color:var(--muted2);margin-bottom:.6rem;">You do not own a Transporter yet. Purchase one to begin managing your caravan.</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;">'
          + Object.keys(CARAVAN_SIZES).map(function(size) {
              var s = CARAVAN_SIZES[size];
              return '<div style="border:1px solid var(--border2);padding:.6rem;text-align:center;">'
                + '<div style="font-family:\'Cinzel\',serif;font-size:.65rem;color:var(--gold2);text-transform:uppercase;">' + size + '</div>'
                + '<div style="font-size:.75rem;color:var(--muted2);margin:.2rem 0;">DD' + s.dread + ' | ' + s.stress + ' Stress</div>'
                + '<div style="font-size:.74rem;color:var(--muted2);">' + s.crew + ' Crew · ' + s.cargo + ' Cargo</div>'
                + '<div style="font-family:\'Rajdhani\',sans-serif;font-weight:700;color:var(--gold);margin:.3rem 0;">' + s.cost.toLocaleString() + '\u20B5</div>'
                + '<button class="btn btn-sm btn-primary" onclick="buyCaravan(\'' + size + '\')">Purchase</button>'
                + '</div>';
            }).join('')
          + '</div></div>';
        if (body) { body.style.display = "none"; }
        return;
      } else {
        gate.innerHTML = '';
        if (body) { body.style.display = ""; }
      }
    }

    // Header readouts
    var el;
    el = document.getElementById("caravanCredits");      if (el) { el.textContent = (S.credits || 0) + " \u20B5"; }
    el = document.getElementById("caravanZoneReadout");   if (el) { el.textContent = c.chase.zone; }
    el = document.getElementById("caravanStressReadout"); if (el) { el.textContent = c.stress + " / " + sz.stress; }
    el = document.getElementById("caravanModSlotsReadout"); if (el) { el.textContent = c.mods.length + " / " + sz.modSlots; }

    // Name / power source (set once, allow re-render when changed)
    var nameEl = document.getElementById("caravanName");
    if (nameEl) { nameEl.value = c.name || ""; }
    var psEl = document.getElementById("caravanPowerSource");
    if (psEl) { psEl.value = c.powerSource || ""; }

    // Size grid
    var sg = document.getElementById("caravanSizeGrid");
    if (sg) {
      sg.innerHTML = Object.keys(CARAVAN_SIZES).map(function(size) {
        var s = CARAVAN_SIZES[size];
        var active = c.size === size;
        return '<div onclick="selectCaravanSize(\'' + size + '\')" style="cursor:pointer;border:1px solid ' + (active ? 'var(--gold)' : 'var(--border)') + ';background:' + (active ? 'rgba(201,162,39,.08)' : 'var(--surface)') + ';padding:.5rem .4rem;text-align:center;">'
          + '<div style="font-family:\'Cinzel\',serif;font-size:.6rem;letter-spacing:.1em;color:' + (active ? 'var(--gold)' : 'var(--muted2)') + ';text-transform:uppercase;">' + size + '</div>'
          + '<div style="font-family:\'Rajdhani\',sans-serif;font-weight:700;font-size:.82rem;color:' + (active ? 'var(--gold2)' : 'var(--text2)') + ';">DD' + s.dread + ' | ' + s.stress + ' Stress</div>'
          + '<div style="font-size:.7rem;color:var(--muted2);">' + s.crew + ' Crew · ' + s.cargo + ' Cargo · ' + s.modSlots + ' Mod' + (s.modSlots > 1 ? 's' : '') + '</div>'
          + '<div style="font-size:.66rem;color:var(--muted);">' + s.cost.toLocaleString() + '\u20B5</div>'
          + '</div>';
      }).join("");
    }

    // Stat block
    var effectiveDread = getCaravanDread();
    var sb = document.getElementById("caravanStatBlock");
    if (sb) {
      sb.innerHTML = '<div class="stat-row"><div><div class="stat-label">Dread Die</div>'
        + (c.dreadReduced ? '<div class="stat-sub" style="color:var(--red2);">Reduced ' + c.dreadReduced + ' step' + (c.dreadReduced > 1 ? 's' : '') + '</div>' : '')
        + '</div><div class="stat-die d' + effectiveDread + '" style="font-size:1rem;font-weight:700;">d' + effectiveDread + '</div></div>'
        + '<div class="stat-row"><div><div class="stat-label">Max Crew</div></div><div style="font-family:\'Rajdhani\',sans-serif;font-size:1rem;font-weight:700;color:var(--teal);">' + sz.crew + '</div></div>'
        + '<div class="stat-row"><div><div class="stat-label">Cargo Slots</div></div><div style="font-family:\'Rajdhani\',sans-serif;font-size:1rem;font-weight:700;color:var(--teal);">' + getCaravanCargoMax() + '</div></div>'
        + '<div class="stat-row"><div><div class="stat-label">Mod Slots</div></div><div style="font-family:\'Rajdhani\',sans-serif;font-size:1rem;font-weight:700;color:var(--gold);">' + sz.modSlots + '</div></div>'
        + (c.wheelsLost > 0 ? '<div style="background:rgba(201,64,64,.07);border:1px solid rgba(201,64,64,.25);padding:.3rem .5rem;margin-top:.3rem;font-size:.76rem;color:var(--red2);">⚠ ' + c.wheelsLost + ' Wheel' + (c.wheelsLost > 1 ? 's' : '') + ' Lost — Disadvantage to all Checks</div>' : '');
    }

    // Stress pips
    var sp = document.getElementById("caravanStressPips");
    if (sp) {
      sp.innerHTML = Array.from({ length: sz.stress }, function(_, i) {
        return '<div class="s-pip' + (i < c.stress ? ' filled' : '') + '" onclick="toggleCaravanStress(' + i + ')"></div>';
      }).join("");
    }

    // Crew counter
    el = document.getElementById("caravanCrewVal"); if (el) { el.textContent = c.crew; }
    el = document.getElementById("caravanMaxCrew"); if (el) { el.textContent = sz.crew; }
    el = document.getElementById("caravanWheelsVal"); if (el) { el.textContent = c.wheelsLost; }
    el = document.getElementById("wheelsWarning"); if (el) { el.style.display = c.wheelsLost > 0 ? "block" : "none"; }

    // Cargo grid
    var cg = document.getElementById("caravanCargoGrid");
    if (cg) {
      var maxCargo = getCaravanCargoMax();
      var cargo = c.cargo.slice(0, maxCargo);
      while (cargo.length < maxCargo) { cargo.push(""); }
      cg.innerHTML = cargo.map(function(item, i) {
        if (!item) {
          return '<input class="bp-input" placeholder="Slot ' + (i + 1) + '" value="" onchange="updateCaravanCargo(' + i + ',this.value)">';
        }
        var itemLabel = (typeof weaponLabelHtml === 'function')
          ? weaponLabelHtml(item, 18)
          : String(item).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<div style="background:var(--surface);border:1px solid var(--border2);padding:.28rem .35rem;border-radius:4px;cursor:pointer;" onclick="openCaravanCargoItem(' + i + ')">'
          + '<div style="font-size:.72rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + itemLabel + '</div>'
          + '<div style="font-size:.62rem;color:var(--muted2);margin-top:.12rem;">Click: use / equip / move</div>'
          + '</div>';
      }).join("");
    }

    // Installed mods
    var im = document.getElementById("caravanInstalledMods");
    if (im) {
      if (!c.mods.length) {
        im.innerHTML = '<div style="font-size:.78rem;color:var(--muted2);">No mods installed. (' + sz.modSlots + ' slot' + (sz.modSlots > 1 ? 's' : '') + ' available)</div>';
      } else {
        im.innerHTML = c.mods.map(function(modId, i) {
          var mod = CARAVAN_MODS.filter(function(m){ return m.id === modId; })[0];
          if (!mod) { return ""; }
          return '<div style="background:var(--surface);border:1px solid var(--border2);padding:.35rem .5rem;margin-bottom:.25rem;display:flex;justify-content:space-between;align-items:flex-start;gap:.4rem;">'
            + '<div><div style="font-family:\'Cinzel\',serif;font-size:.63rem;color:var(--gold2);">' + mod.name + '</div><div style="font-size:.72rem;color:var(--muted3);">' + mod.base + '</div></div>'
            + '<button class="btn btn-xs btn-red" onclick="removeMod(' + i + ')">✕</button>'
            + '</div>';
        }).join("");
      }
    }

    // Available mods
    var ml = document.getElementById("caravanModsList");
    if (ml) {
      var full = c.mods.length >= sz.modSlots;
      ml.innerHTML = CARAVAN_MODS.map(function(mod) {
        var installed = c.mods.indexOf(mod.id) >= 0;
        return '<div style="background:var(--surface);border:1px solid var(--border);padding:.3rem .45rem;margin-bottom:.18rem;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;color:' + (installed ? 'var(--muted2)' : 'var(--gold2)') + ';">' + mod.name + (installed ? ' ✓' : '') + '</div>'
          + (!installed ? '<button class="btn btn-xs btn-primary" onclick="installMod(\'' + mod.id + '\')" ' + (full ? 'disabled style="opacity:.4;"' : '') + '>+5 PT + 2d20×10₵</button>' : '')
          + '</div>'
          + '<div style="font-size:.7rem;color:var(--muted3);">' + mod.base + '</div>'
          + '</div>';
      }).join("");
    }

    // Zone track
    renderChaseZoneTrack();

    // Chase status
    el = document.getElementById("chaseCombatStatus");
    if (el) { el.textContent = c.chase.active ? "Round " + c.chase.round + " — Chase Active" : "No chase in progress."; }

    // Chase log
    var cl = document.getElementById("chaseLog");
    if (cl) {
      var log = c.chase.log.slice(-12).reverse();
      cl.innerHTML = log.map(function(entry) {
        return '<div style="font-size:.76rem;color:var(--text2);padding:.18rem 0;border-bottom:1px solid var(--border);">' + entry + '</div>';
      }).join("");
    }

    // Enemy dread display
    el = document.getElementById("chaseEnemyDreadDisplay");
    if (el) { el.textContent = "d" + c.chase.enemyDread; }

    renderCaravanCombatPopup();
  }

  function renderChaseZoneTrack() {
    var el = document.getElementById("caravanZoneTrack");
    if (!el) { return; }
    var current = S.caravan.chase.zone;
    el.innerHTML = CHASE_ZONES.map(function(z) {
      var on = z === current;
      return '<div onclick="S.caravan.chase.zone=\'' + z + '\';renderCaravanUI();" class="zone-pill' + (on ? ' on' : '') + '" style="cursor:pointer;flex:1;text-align:center;">'
        + z + '<div style="font-size:.55rem;color:' + (on ? 'var(--gold2)' : 'var(--muted)') + ';margin-top:.1rem;">'
        + (z === "Engaged" ? "Strike" : z === "Close" ? "Spells" : z === "Nearby" ? "Shoot" : "Out of Range")
        + '</div></div>';
    }).join("");
  }

  // ── CARAVAN FUNCTIONS ─────────────────────────────────────────────────────────
  function selectCaravanSize(size) {
    S.caravan.size = size;
    var sz = CARAVAN_SIZES[size];
    var newCargo = Array(sz.cargo).fill("");
    var old = S.caravan.cargo || [];
    for (var i = 0; i < Math.min(old.length, sz.cargo); i++) { newCargo[i] = old[i]; }
    S.caravan.cargo = newCargo;
    if (S.caravan.stress > sz.stress) { S.caravan.stress = sz.stress; }
    while (S.caravan.mods.length > sz.modSlots) { S.caravan.mods.pop(); }
    S.caravan.dreadReduced = 0;
    renderCaravanUI();
    showNotif("Transporter size set to " + size, "good");
  }

  function getCaravanDread() {
    var base = (CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small).dread;
    var reduced = S.caravan.dreadReduced || 0;
    var current = base;
    for (var i = 0; i < reduced; i++) { current = stepDown(current); }
    return current;
  }

  function getCaravanCargoMax() {
    var base = (CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small).cargo;
    return base + (S.caravan.mods.indexOf("expandable") >= 0 ? 5 : 0);
  }

  function changeCaravanStress(delta) {
    var max = (CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small).stress;
    S.caravan.stress = Math.max(0, Math.min(max, S.caravan.stress + delta));
    renderCaravanUI();
  }

  function toggleCaravanStress(i) {
    S.caravan.stress = i < S.caravan.stress ? i : i + 1;
    renderCaravanUI();
  }

  function rollHeavyDamage() {
    var r = roll(6);
    var result = (r <= 2)
      ? CARAVAN_DAMAGE_TABLE[0]
      : (r <= 4 ? CARAVAN_DAMAGE_TABLE[1] : CARAVAN_DAMAGE_TABLE[2]);
    var el = document.getElementById("heavyDamageResult");
    if (el) {
      el.innerHTML = '<div style="background:rgba(201,64,64,.08);border:1px solid rgba(201,64,64,.3);padding:.4rem .5rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.56rem;letter-spacing:.1em;color:var(--red2);text-transform:uppercase;margin-bottom:.15rem;">Heavy Damage — d6 = ' + r + '</div>'
        + '<div style="font-size:.83rem;color:var(--text2);">' + result + '</div>'
        + '</div>';
    }
    if (r <= 2) {
      var removed = 0;
      var toLose = roll(6);
      var maxCargo = getCaravanCargoMax();
      for (var i = 0; i < maxCargo && removed < toLose; i++) {
        if (S.caravan.cargo[i]) {
          S.caravan.cargo[i] = "";
          removed += 1;
        }
      }
      if (removed > 0) showNotif("Heavy hit: lost " + removed + " stored item(s).", "warn");
    } else if (r <= 4) {
      S.caravan.dreadReduced = (S.caravan.dreadReduced || 0) + 1;
      showNotif("Dread Die stepped down!", "warn");
    } else {
      var controlDie = (typeof getEffectiveDie === "function") ? getEffectiveDie("control") : (S.stats.control || 4);
      var action = explodingRoll(controlDie, { type: 'action', major: true, label: 'Overturn Control Save' });
      var dread = explodingRoll(6, { type: 'dread', major: true, label: 'Overturn DD6' });
      if (action.total < dread.total) {
        S.caravan.chase.active = false;
        S.caravan.chase.overturned = true;
        S.caravan.chase.log.push("Transporter overturned and disabled (" + action.total + " vs " + dread.total + ").");
        showNotif("Transporter overturned and disabled!", "warn");
      } else {
        showNotif("Control save passed. Transporter remains upright.", "good");
      }
    }
    renderCaravanUI();
  }

  function repairCaravan() {
    S.caravan.stress = 0;
    S.caravan.wheelsLost = 0;
    S.caravan.dreadReduced = 0;
    var el = document.getElementById("heavyDamageResult");
    if (el) { el.innerHTML = ""; }
    renderCaravanUI();
    showNotif("Transporter fully repaired!", "good");
  }

  function buyCaravan(size) {
    var s = CARAVAN_SIZES[size];
    if (!s) { return; }
    if ((S.credits || 0) < s.cost) {
      showNotif("Need " + s.cost.toLocaleString() + "\u20B5 to purchase a " + size + " Transporter!", "warn"); return;
    }
    S.credits -= s.cost;
    S.caravan.owned = true;
    S.caravan.size = size;
    S.caravan.cargo = Array(s.cargo).fill("");
    updateCreditsUI();
    // Reset mounted so HTML rebuilds fresh
    var panel = document.getElementById("tab-caravan");
    if (panel) { delete panel.dataset.mounted; }
    mountCaravanPanel();
    showNotif(size + " Transporter purchased!", "good");
  }

  function rollCaravanName() {
    var name = pick(CARAVAN_NAME_FIRST) + " " + pick(CARAVAN_NAME_LAST);
    S.caravan.name = name;
    var el = document.getElementById("caravanName");
    if (el) { el.value = name; }
    showNotif("Transporter named: " + name, "good");
  }

  function clearCaravanName() {
    S.caravan.name = "";
    var el = document.getElementById("caravanName");
    if (el) { el.value = ""; }
  }

  function rollCaravanPowerSource() {
    var src = pick(CARAVAN_POWER_SOURCES);
    S.caravan.powerSource = src;
    var el = document.getElementById("caravanPowerSource");
    if (el) { el.value = src; }
  }

  function clearCaravanPowerSource() {
    S.caravan.powerSource = "";
    var el = document.getElementById("caravanPowerSource");
    if (el) { el.value = ""; }
  }

  function rollHoldingName() {
    var name = pick(HOLDING_NAME_FIRST) + " " + pick(HOLDING_NAME_LAST);
    S.holding.name = name;
    var el = document.getElementById("holdingName");
    if (el) { el.value = name; }
    renderHoldingUI();
    showNotif("Holding named: " + name, "good");
  }

  function clearHoldingName() {
    S.holding.name = "";
    var el = document.getElementById("holdingName");
    if (el) { el.value = ""; }
    renderHoldingUI();
  }

  function changeCaravanCrew(delta) {
    var max = (CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small).crew;
    S.caravan.crew = Math.max(0, Math.min(max, S.caravan.crew + delta));
    renderCaravanUI();
  }

  function changeCaravanWheels(delta) {
    S.caravan.wheelsLost = Math.max(0, (S.caravan.wheelsLost || 0) + delta);
    renderCaravanUI();
  }

  function updateCaravanCargo(i, value) {
    S.caravan.cargo[i] = value;
  }

  function moveCaravanCargoToBackpack(i) {
    ensureNewFeatureState();
    var item = (S.caravan.cargo || [])[i] || "";
    if (!item) { showNotif("No cargo item in that slot.", "warn"); return; }
    if (!Array.isArray(S.backpack)) { S.backpack = Array(10).fill(""); }
    var slotIdx = S.backpack.indexOf("");
    if (slotIdx < 0) {
      showNotif("Backpack full.", "warn"); return;
    }
    S.backpack[slotIdx] = item;
    S.caravan.cargo[i] = "";
    if (typeof renderBackpackUI === 'function') { renderBackpackUI(); }
    renderCaravanUI();
    showNotif("Moved to Backpack: " + item, "good");
  }

  function equipCaravanCargoItem(i, slot) {
    ensureNewFeatureState();
    var item = (S.caravan.cargo || [])[i] || "";
    if (!item) { return; }
    var found = (typeof findShopItem === 'function') ? findShopItem(item) : null;
    var cat = found ? found.cat : null;
    var itemLc = String(item).toLowerCase();
    var isWeapon = (cat === 'weapons' || cat === 'melee_exp' || cat === 'ranged_exp');
    var isArmor = (cat === 'armor' || cat === 'armor_exp' || cat === 'space_armor');
    // Fallback when shop lookup is unavailable: still allow recognizable armor names.
    if (!isArmor) {
      isArmor = /armor|armour|suit|radsuit|vaccsuit|hydrosuit|coolant layer/.test(itemLc);
    }
    if ((slot === 'weapon1' || slot === 'weapon2') && !isWeapon) {
      showNotif('Only weapons can be equipped in weapon slots!', 'warn'); return;
    }
    if (slot === 'armor' && !isArmor) {
      showNotif('Only armor can be equipped in the armor slot!', 'warn'); return;
    }

    var equipStr = item;
    if (found && found.item && found.item.stat && (isWeapon || isArmor) && String(item).indexOf(found.item.stat) === -1) {
      equipStr = item + ' (' + found.item.stat + ')';
    }

    var displaced = S.equipment[slot] || '';
    if (displaced) {
      if (!Array.isArray(S.backpack)) { S.backpack = Array(10).fill(''); }
      var bpSlot = S.backpack.indexOf('');
      if (bpSlot < 0) {
        showNotif('Backpack full. Unequip or free one slot first.', 'warn'); return;
      }
      S.backpack[bpSlot] = displaced;
      if (typeof renderBackpackUI === 'function') { renderBackpackUI(); }
    }

    S.equipment[slot] = equipStr;
    S.caravan.cargo[i] = '';
    var inputId = slot === 'weapon1' ? 'eqWeapon1' : slot === 'weapon2' ? 'eqWeapon2' : slot === 'armor' ? 'eqArmor' : 'eqReadied';
    var el = document.getElementById(inputId);
    if (el) { el.value = equipStr; }
    if (typeof updateAllStatDisplays === 'function') { updateAllStatDisplays(); }
    if (typeof renderWeaponModsPanel === 'function') { renderWeaponModsPanel(); }
    renderCaravanUI();
    showNotif('Equipped from Caravan: ' + equipStr, 'good');
  }

  function useCaravanCargoItem(i) {
    ensureNewFeatureState();
    var item = (S.caravan.cargo || [])[i] || '';
    if (!item) { return; }
    var itemLabel = (typeof weaponLabelHtml === 'function')
      ? weaponLabelHtml(item, 22)
      : String(item).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!Array.isArray(S.backpack)) { S.backpack = Array(10).fill(''); }
      + '<div style="margin-bottom:.45rem;">' + itemLabel + '</div>'
    if (slotIdx < 0) {
      showNotif('Backpack full! Free one slot to use cargo item.', 'warn'); return;
    }

    S.backpack[slotIdx] = item;
    S.caravan.cargo[i] = '';
    var found = (typeof findShopItem === 'function') ? findShopItem(item) : null;

    if (found) {
      useBackpackItem(slotIdx);
    } else if (/^Scroll:/i.test(String(item).trim())) {
      castScrollFromBackpack(slotIdx);
    } else if (/A\.D\.|Ad\d|d\d/i.test(String(item))) {
      useCustomItem(item, slotIdx);
    } else {
      // No direct use path, put it back.
      S.caravan.cargo[i] = S.backpack[slotIdx];
      S.backpack[slotIdx] = '';
      if (typeof renderBackpackUI === 'function') { renderBackpackUI(); }
      renderCaravanUI();
      showNotif('This cargo item has no direct use action.', 'warn');
      return;
    }

    if (S.backpack[slotIdx]) {
      // Item was not consumed; return to original cargo slot.
      S.caravan.cargo[i] = S.backpack[slotIdx];
      S.backpack[slotIdx] = '';
    }
    if (typeof renderBackpackUI === 'function') { renderBackpackUI(); }
    renderCaravanUI();
  }

  function openCaravanCargoItem(i) {
    ensureNewFeatureState();
    var item = (S.caravan.cargo || [])[i] || '';
    if (!item) { return; }
    var itemLabel = (typeof weaponLabelHtml === 'function')
      ? weaponLabelHtml(item, 22)
      : String(item).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var html = '<div style="font-size:.9rem;color:var(--text2);line-height:1.6;">'
      + '<div style="margin-bottom:.45rem;">' + itemLabel + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-teal" onclick="useCaravanCargoItem(' + i + ');closeModal();">⚑ Use</button>'
      + '<button class="btn btn-xs" onclick="moveCaravanCargoToBackpack(' + i + ');closeModal();">↙ Backpack</button>'
      + '<button class="btn btn-xs btn-primary" onclick="equipCaravanCargoItem(' + i + ',\'weapon1\');closeModal();">⚔ W1</button>'
      + '<button class="btn btn-xs btn-primary" onclick="equipCaravanCargoItem(' + i + ',\'weapon2\');closeModal();">⚔ W2</button>'
      + '<button class="btn btn-xs btn-primary" onclick="equipCaravanCargoItem(' + i + ',\'armor\');closeModal();">⚔ Armor</button>'
      + '<button class="btn btn-xs btn-primary" onclick="equipCaravanCargoItem(' + i + ',\'readied\');closeModal();">⚔ Readied</button>'
      + '</div></div>';
    openModal('Caravan Cargo Item', html, null, { preventScroll: true, focusTrap: true });
  }

  function installMod(modId) {
    var sz = CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small;
    if (S.caravan.mods.length >= sz.modSlots) {
      showNotif("No mod slots available!", "warn"); return;
    }
    if (S.caravan.mods.indexOf(modId) >= 0) {
      showNotif("Mod already installed!", "warn"); return;
    }
    var pathCost = 5;
    var creditCost = rollMulti(20, 2) * 10;
    if ((S.pathTokens || 0) < pathCost) {
      showNotif("Need " + pathCost + " Path Tokens!", "warn"); return;
    }
    if ((S.credits || 0) < creditCost) {
      showNotif("Need " + creditCost + "\u20B5 for this installation!", "warn"); return;
    }
    S.pathTokens -= pathCost;
    S.credits -= creditCost;
    S.caravan.mods.push(modId);
    updateCreditsUI();
    var ptEl = document.getElementById("pathTokensVal");
    if (ptEl) { ptEl.textContent = S.pathTokens; }
    var mod = CARAVAN_MODS.filter(function(m){ return m.id === modId; })[0];
    showNotif("Installed: " + mod.name + " (\u22125 PT, \u2212" + creditCost + "\u20B5)", "good");
    renderCaravanUI();
  }

  function removeMod(index) {
    S.caravan.mods.splice(index, 1);
    renderCaravanUI();
  }

  function setChaseEnemyDread(n) {
    ensureCaravanConvoyState();
    S.caravan.chase.enemyDread = n;
    var enemy = getActiveCaravanEnemy();
    if (enemy) { enemy.dread = n; }
    var el = document.getElementById("chaseEnemyDreadDisplay");
    if (el) { el.textContent = "d" + n; }
  }

  function startChase() {
    ensureNewFeatureState();
    ensureCaravanConvoyState();
    S.caravan.chase.active = true;
    S.caravan.chase.overturned = false;
    S.caravan.chase.round = 1;
    S.caravan.chase.turn = "wayfarer";
    S.caravan.chase.actionsRemaining = getCaravanWayfarerActionCount();
    S.caravan.chase.enemyActionsRemaining = 2;
    (S.caravan.chase.allyConvoys || []).forEach(function(ally) {
      if (!ally) return;
      ally.stress = 0;
      ally.wrecked = false;
    });
    (S.caravan.chase.enemyConvoys || []).forEach(function(enemy) {
      if (!enemy) return;
      enemy.stress = 0;
      enemy.wrecked = false;
      enemy.dread = Number(S.caravan.chase.enemyDread || enemy.dread || 6);
    });
    S.caravan.chase.log = [];
    renderCaravanUI();
    showNotif("Chase begun!", "good");
  }

  function nextChaseRound() {
    ensureNewFeatureState();
    ensureCaravanConvoyState();
    S.caravan.chase.round++;
    S.caravan.chase.turn = "wayfarer";
    S.caravan.chase.actionsRemaining = getCaravanWayfarerActionCount();
    S.caravan.chase.enemyActionsRemaining = 2;
    S.caravan.chase.log.push("R" + S.caravan.chase.round + ": New round. Wayfarers act first.");
    renderCaravanUI();
  }

  function endChase() {
    ensureNewFeatureState();
    S.caravan.chase.active = false;
    S.caravan.chase.turn = "setup";
    S.caravan.chase.actionsRemaining = 0;
    S.caravan.chase.enemyActionsRemaining = 0;
    renderCaravanUI();
    showNotif("Chase ended.", "");
  }

  function getHoldingGateRenown() {
    var base = S.renown || 0;
    var fr = S.factionRenown || null;
    if (!fr || typeof fr !== 'object') { return base; }
    var maxFaction = base;
    Object.keys(fr).forEach(function(key) {
      var val = Number(fr[key] || 0);
      if (val > maxFaction) { maxFaction = val; }
    });
    return maxFaction;
  }

  function adjustChaseZone(dir) {
    ensureNewFeatureState();
    if (!S.caravan.chase.active) {
      showNotif("Start chase first.", "warn");
      return false;
    }
    if (!spendCaravanChaseAction("wayfarer", "Move to another zone")) { return false; }
    var idx = CHASE_ZONES.indexOf(S.caravan.chase.zone);
    var newIdx = Math.max(0, Math.min(CHASE_ZONES.length - 1, idx + dir));
    S.caravan.chase.zone = CHASE_ZONES[newIdx];
    S.caravan.chase.log.push("R" + S.caravan.chase.round + ": Zone adjusted to " + S.caravan.chase.zone);
    renderCaravanUI();
    return true;
  }

  function rollChaseControl() {
    ensureNewFeatureState();
    ensureCaravanConvoyState();
    var ally = getActiveCaravanAlly();
    if (!S.caravan.chase.active) {
      showNotif("Start chase first.", "warn");
      return;
    }
    if (!spendCaravanChaseAction("wayfarer", "Driver maneuver")) { return; }
    var driverStat = S.caravan.chase.driverStat || "control";
    var actionDie = getCaravanRoleDie('driver', driverStat);
    var enemy = getActiveCaravanEnemy();
    var dread = Number(enemy && enemy.dread || S.caravan.chase.enemyDread || 6);
    var a = explodingRoll(actionDie, { type: 'action', major: true, label: 'Caravan Chase ' + driverStat.toUpperCase() + ' d' + actionDie });
    var d = explodingRoll(dread, { type: 'dread', major: true, label: 'Caravan Chase DD' + dread });
    var success = a.total >= d.total;
    var diff = a.total - d.total;
    var zoneShift = 0;
    if (success && diff >= 3)       { zoneShift = -2; }
    else if (success)                { zoneShift = -1; }
    else if (diff <= -3)             { zoneShift =  2; }
    else                             { zoneShift =  1; }
    var oldZone = S.caravan.chase.zone;
    var idx = CHASE_ZONES.indexOf(oldZone);
    var newIdx = Math.max(0, Math.min(CHASE_ZONES.length - 1, idx + zoneShift));
    S.caravan.chase.zone = CHASE_ZONES[newIdx];
    var zoneMsg = zoneShift < 0 ? "Advanced to " + S.caravan.chase.zone : (zoneShift > 0 ? "Fell back to " + S.caravan.chase.zone : "Held at " + S.caravan.chase.zone);
    var entry = "R" + S.caravan.chase.round + ": " + driverStat.charAt(0).toUpperCase() + driverStat.slice(1) + " d" + actionDie + "=" + a.total + " vs DD" + dread + "=" + d.total + " \u2014 " + (success ? "\u2713" : "\u2717") + " " + zoneMsg;
    if (a.exploded) { entry += " \u2726 Crit!"; }
    S.caravan.chase.log.push(entry);
    renderCaravanUI();
    showNotif(success ? "Drive success! " + zoneMsg : "Drive failed — " + zoneMsg, success ? "good" : "warn");
    if (success) {
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome(driverStat, Math.max(1, a.total - d.total), {
          actionTotal: a.total,
          dreadTotal: d.total,
          context: 'Caravan chase control'
        });
      }
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
    } else {
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome(driverStat, Math.max(1, d.total - a.total), {
          actionTotal: a.total,
          dreadTotal: d.total,
          context: 'Caravan chase control'
        });
      }
      if (typeof addTMWOnFail === 'function') { addTMWOnFail(); }
    }
  }

  function rollChaseEnemyAttack() {
    ensureNewFeatureState();
    ensureCaravanConvoyState();
    var ally = getActiveCaravanAlly();
    var enemy = getActiveCaravanEnemy();
    if (!S.caravan.chase.active) {
      showNotif("Start chase first.", "warn");
      return;
    }
    if (!spendCaravanChaseAction("hostile", "Hostile attack")) { return; }
    var dread = Number(enemy && enemy.dread || S.caravan.chase.enemyDread || 6);
    var caravanDread = getCaravanDreadForAlly(ally);
    var a = explodingRoll(dread, { type: 'action', major: true, label: 'Enemy Attack d' + dread });
    var d = explodingRoll(caravanDread, { type: 'dread', major: true, label: 'Caravan Defense DD' + caravanDread });
    var hit = a.total > d.total;
    var damage = Math.max(1, a.total - d.total);
    var max = Number(ally && ally.maxStress || (CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small).stress || 12);
    var entry = "R" + S.caravan.chase.round + ": Enemy d" + dread + "=" + a.total + " vs Caravan DD" + caravanDread + "=" + d.total + " \u2014 " + (hit ? "Hit! " + damage + " Stress" : "Defended!");
    S.caravan.chase.log.push(entry);
    if (hit) {
      ally.stress = Math.min(max, Number(ally.stress || 0) + damage);
      if (damage > Math.floor(max / 2)) {
        S.caravan.chase.log.push("\u26A0 Heavy hit threshold exceeded! Rolling d6 damage complication.");
        rollHeavyDamage();
      }
    }
    renderCaravanUI();
    if (!hit) { showNotif("Transporter held firm!", "good"); }
  }

  function getCaravanWayfarerActionCount() {
    ensureNewFeatureState();
    var roster = [];
    if (typeof window !== 'undefined' && window.campaignSystem && typeof window.campaignSystem.buildPartyRoster === 'function') {
      try { roster = window.campaignSystem.buildPartyRoster() || []; } catch (_e) { roster = []; }
    }
    var partyCount = Array.isArray(roster) ? roster.length : 0;
    if (partyCount <= 0) {
      partyCount = Math.max(1, Number(S.caravan.crew || 1));
    }
    return Math.max(1, partyCount);
  }

  function makeCaravanConvoyId(prefix) {
    return String(prefix || "caravan") + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36);
  }

  function buildCompactCaravanStressChip(label, current, max, tone) {
    var safeMax = Math.max(1, Number(max || 1));
    var safeCurrent = Math.max(0, Math.min(safeMax, Number(current || 0)));
    var pct = Math.max(0, Math.min(100, Math.round((safeCurrent / safeMax) * 100)));
    var barTone = tone || '#46c4b6';
    return '<div style="display:inline-flex;align-items:center;gap:.18rem;border:1px solid var(--border2);padding:.1rem .18rem;background:rgba(255,255,255,.02);">'
      + '<span style="font-size:.62rem;color:var(--muted2);">' + label + '</span>'
      + '<span style="font-size:.62rem;color:var(--text2);">' + safeCurrent + '/' + safeMax + '</span>'
      + '<span style="display:inline-block;width:52px;height:6px;border:1px solid var(--border2);background:rgba(0,0,0,.35);position:relative;overflow:hidden;">'
      + '<span style="position:absolute;left:0;top:0;height:100%;width:' + pct + '%;background:' + barTone + ';"></span>'
      + '</span>'
      + '</div>';
  }

  function getCaravanMaxStressBySize(size) {
    return Number((CARAVAN_SIZES[size || S.caravan.size] || CARAVAN_SIZES.Small).stress || 12);
  }

  function getCaravanDreadForAlly(ally) {
    if (!ally || ally.isPrimary) return Number(getCaravanDread() || 4);
    return Math.max(4, Number(ally.dread || getCaravanDread() || 4));
  }

  function ensureCaravanConvoyState() {
    ensureNewFeatureState();
    var chase = S.caravan.chase;
    var allies = Array.isArray(chase.allyConvoys) ? chase.allyConvoys : [];
    var mainAlly = S.caravan;
    if (!mainAlly.id) { mainAlly.id = makeCaravanConvoyId("ally-main"); }
    mainAlly.isPrimary = true;
    mainAlly.name = String(mainAlly.name || "Primary Caravan");
    mainAlly.maxStress = getCaravanMaxStressBySize(S.caravan.size);
    if (!allies.includes(mainAlly)) { allies.unshift(mainAlly); }
    allies.forEach(function(ally) {
      if (!ally) return;
      if (!ally.id) ally.id = makeCaravanConvoyId("ally");
      ally.maxStress = Number(ally.maxStress || getCaravanMaxStressBySize(S.caravan.size));
      ally.stress = Math.max(0, Math.min(ally.maxStress, Number(ally.stress || 0)));
      ally.wrecked = !!ally.wrecked;
    });
    chase.allyConvoys = allies.filter(Boolean);
    if (chase.activeAllyId && !chase.allyConvoys.some(function(ally) { return ally && ally.id === chase.activeAllyId; })) {
      chase.activeAllyId = "";
    }
    if (!chase.activeAllyId && chase.allyConvoys.length) {
      var preferredAlly = chase.allyConvoys.find(function(ally) { return ally && !ally.wrecked; }) || chase.allyConvoys[0];
      chase.activeAllyId = preferredAlly && preferredAlly.id ? preferredAlly.id : "";
    }

    var enemies = Array.isArray(chase.enemyConvoys) ? chase.enemyConvoys : [];
    enemies.forEach(function(enemy) {
      if (!enemy) return;
      if (!enemy.id) enemy.id = makeCaravanConvoyId("enemy");
      enemy.maxStress = Number(enemy.maxStress || getCaravanMaxStressBySize(S.caravan.size));
      enemy.stress = Math.max(0, Math.min(enemy.maxStress, Number(enemy.stress || 0)));
      enemy.dread = Math.max(4, Number(enemy.dread || chase.enemyDread || 6));
      enemy.wrecked = !!enemy.wrecked;
    });
    chase.enemyConvoys = enemies.filter(Boolean);
    if (chase.targetEnemyId && !chase.enemyConvoys.some(function(enemy) { return enemy && enemy.id === chase.targetEnemyId; })) {
      chase.targetEnemyId = "";
    }
    if (chase.targetEnemyId && !chase.focusFireLock) {
      var currentEnemy = chase.enemyConvoys.find(function(enemy) { return enemy && enemy.id === chase.targetEnemyId; }) || null;
      if (currentEnemy && currentEnemy.wrecked) {
        var nextEnemy = chase.enemyConvoys.find(function(enemy) { return enemy && !enemy.wrecked; }) || null;
        chase.targetEnemyId = nextEnemy && nextEnemy.id ? nextEnemy.id : "";
      }
    }
    if (!chase.targetEnemyId && chase.enemyConvoys.length && !chase.focusFireLock) {
      var preferredEnemy = chase.enemyConvoys.find(function(enemy) { return enemy && !enemy.wrecked; }) || chase.enemyConvoys[0];
      chase.targetEnemyId = preferredEnemy && preferredEnemy.id ? preferredEnemy.id : "";
    }
    if (!chase.enemyConvoys.length) {
      spawnCaravanEnemyConvoy(false);
    }
  }

  function getActiveCaravanEnemy() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    return (chase.enemyConvoys || []).find(function(enemy) { return enemy && String(enemy.id || "") === String(chase.targetEnemyId || ""); }) || null;
  }

  function getActiveCaravanAlly() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    return (chase.allyConvoys || []).find(function(ally) { return ally && String(ally.id || "") === String(chase.activeAllyId || ""); }) || S.caravan;
  }

  function setActiveCaravanEnemy(id) {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    var next = (chase.enemyConvoys || []).find(function(enemy) { return enemy && String(enemy.id || "") === String(id || ""); }) || null;
    if (!next) return false;
    chase.targetEnemyId = next.id;
    renderCaravanUI();
    renderCaravanCombatPopup();
    return true;
  }

  function setActiveCaravanAlly(id) {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    var next = (chase.allyConvoys || []).find(function(ally) { return ally && String(ally.id || "") === String(id || ""); }) || null;
    if (!next) return false;
    chase.activeAllyId = next.id;
    renderCaravanUI();
    renderCaravanCombatPopup();
    return true;
  }

  function spawnCaravanEnemyConvoy(shouldRender) {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    var enemy = {
      id: makeCaravanConvoyId("enemy"),
      name: "Hostile Caravan " + String((chase.enemyConvoys || []).length + 1),
      dread: Number(chase.enemyDread || 6),
      stress: 0,
      maxStress: getCaravanMaxStressBySize(S.caravan.size),
      wrecked: false
    };
    chase.enemyConvoys.push(enemy);
    if (!chase.focusFireLock || !chase.targetEnemyId) {
      chase.targetEnemyId = enemy.id;
    }
    if (shouldRender !== false) {
      showNotif("Hostile caravan added.", "warn");
      renderCaravanUI();
      renderCaravanCombatPopup();
    }
    return enemy;
  }

  function wreckCaravanEnemyConvoy() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    var enemy = getActiveCaravanEnemy();
    if (!enemy) { return false; }
    enemy.wrecked = true;
    if (!chase.focusFireLock) {
      var nextAlive = (chase.enemyConvoys || []).find(function(entry) { return entry && !entry.wrecked; }) || null;
      chase.targetEnemyId = nextAlive && nextAlive.id ? nextAlive.id : "";
    }
    chase.log.push("R" + Number(chase.round || 1) + ": Hostile convoy disabled.");
    renderCaravanUI();
    return true;
  }

  function spawnCaravanAllyConvoy() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase;
    var ally = {
      id: makeCaravanConvoyId("ally"),
      name: "Ally Caravan " + String((chase.allyConvoys || []).length),
      size: S.caravan.size,
      stress: 0,
      maxStress: getCaravanMaxStressBySize(S.caravan.size),
      dread: Number(getCaravanDread() || 6),
      wrecked: false,
      isPrimary: false
    };
    chase.allyConvoys.push(ally);
    chase.activeAllyId = ally.id;
    showNotif("Ally caravan added.", "good");
    renderCaravanUI();
    renderCaravanCombatPopup();
    return ally;
  }

  function getCaravanRoleRoster() {
    var roster = [];
    if (typeof window !== 'undefined' && window.campaignSystem && typeof window.campaignSystem.buildPartyRoster === 'function') {
      try { roster = window.campaignSystem.buildPartyRoster() || []; } catch (_e) { roster = []; }
    }
    if (!Array.isArray(roster) || !roster.length) {
      roster = [{
        token: 'local-wayfarer',
        name: String((S && S.name) || 'Wayfarer'),
        character: { name: String((S && S.name) || 'Wayfarer'), stats: Object.assign({}, (S && S.stats) || {}) }
      }];
    }
    return roster;
  }

  function getCaravanRoleAssignments() {
    ensureCaravanConvoyState();
    return S.caravan.chase.roleAssignments;
  }

  function getCaravanRoleDie(roleKey, statKey) {
    var roster = getCaravanRoleRoster();
    var assignedToken = String(getCaravanRoleAssignments()[roleKey] || '');
    var member = roster.find(function(entry) { return String(entry && entry.token || '') === assignedToken; }) || roster[0] || null;
    var stats = member && member.character && member.character.stats ? member.character.stats : null;
    return Math.max(4, Number((stats && stats[statKey]) || (S.stats && S.stats[statKey]) || 4));
  }

  function assignCaravanRole(roleKey, token) {
    var allowed = ['driver', 'scout', 'captain', 'engineer'];
    var role = String(roleKey || '').toLowerCase();
    if (allowed.indexOf(role) < 0) return false;
    var roster = getCaravanRoleRoster();
    var tokenValue = String(token || '');
    if (!roster.some(function(entry) { return String(entry && entry.token || '') === tokenValue; })) return false;
    S.caravan.chase.roleAssignments[role] = tokenValue;
    renderCaravanCombatPopup();
    return true;
  }

  function buildCaravanRoleAssignmentHtml() {
    var roster = getCaravanRoleRoster();
    var assignments = getCaravanRoleAssignments();
    var rows = [
      { key: 'driver', label: 'Driver', hint: 'Control maneuvers' },
      { key: 'scout', label: 'Scout', hint: 'Mind survey/pathing' },
      { key: 'captain', label: 'Captain', hint: 'Lead command calls' },
      { key: 'engineer', label: 'Engineer', hint: 'Body patches/repairs' }
    ];
    return '<div style="border:1px solid var(--border2);padding:.28rem .32rem;background:rgba(255,255,255,.02);margin-bottom:.34rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;margin-bottom:.14rem;">Campaign Role Dice</div>'
      + rows.map(function(row) {
          return '<div style="display:grid;grid-template-columns:8.5rem 1fr auto;gap:.24rem;align-items:center;margin-bottom:.18rem;">'
            + '<div style="font-size:.7rem;color:var(--teal2);">' + row.label + '<div style="font-size:.62rem;color:var(--muted2);">' + row.hint + '</div></div>'
            + '<select onchange="runCaravanPopupAction(\'assign-role\',\'' + row.key + ':\' + this.value)" style="width:100%;">'
            + roster.map(function(entry) {
                var token = String(entry && entry.token || '');
                var name = String(entry && entry.character && entry.character.name || entry && entry.name || 'Wayfarer');
                return '<option value="' + token + '"' + (token === String(assignments[row.key] || '') ? ' selected' : '') + '>' + name + '</option>';
              }).join('')
            + '</select>'
            + '<div style="font-size:.62rem;color:var(--muted2);white-space:nowrap;">'
            + 'dControl ' + getCaravanRoleDie(row.key, 'control')
            + ' · dMind ' + getCaravanRoleDie(row.key, 'mind')
            + ' · dLead ' + getCaravanRoleDie(row.key, 'lead')
            + ' · dBody ' + getCaravanRoleDie(row.key, 'body')
            + '</div>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  function openCaravanCardManualPrompt(actionId) {
    var presetMap = {
      'driver-maneuver': {
        actionDie: Number(getCaravanRoleDie('driver', String(S.caravan.chase.driverStat || 'control')) || 6),
        oppDie: Number(getActiveCaravanEnemy() && getActiveCaravanEnemy().dread || S.caravan.chase.enemyDread || 6),
        actionLabel: 'Driver check',
        oppLabel: 'Enemy Dread'
      },
      'enemy-attack': {
        actionDie: Number(getActiveCaravanEnemy() && getActiveCaravanEnemy().dread || S.caravan.chase.enemyDread || 6),
        oppDie: Number(getCaravanDreadForAlly(getActiveCaravanAlly()) || 6),
        actionLabel: 'Enemy strike',
        oppLabel: 'Ally Dread'
      },
      'move-closer': { actionDie: 1, oppDie: 1, actionLabel: 'Move cost', oppLabel: 'None' },
      'move-wider': { actionDie: 1, oppDie: 1, actionLabel: 'Move cost', oppLabel: 'None' }
    };
    var preset = presetMap[actionId] || { actionDie: 6, oppDie: 6, actionLabel: 'Action', oppLabel: 'Opposition' };
    var supported = {
      'driver-maneuver': true,
      'enemy-attack': true,
      'move-closer': true,
      'move-wider': true
    };
    if (!supported[actionId]) {
      showNotif('Manual entry not needed for this card.', 'info');
      return false;
    }
    var html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.55;">'
      + '<div style="margin-bottom:.2rem;color:var(--gold2);font-family:\'Cinzel\',serif;">Caravan Manual Roll</div>'
      + '<div style="font-size:.7rem;color:var(--teal2);margin-bottom:.14rem;">Preset: ' + preset.actionLabel + ' d' + preset.actionDie + ' vs ' + preset.oppLabel + ' d' + preset.oppDie + '</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.24rem;">Enter final totals from physical dice and table modifiers.</div>'
      + '<label style="display:block;font-size:.72rem;color:var(--muted2);margin-bottom:.08rem;">Action Total</label>'
      + '<input id="caravanManualActionTotal" type="text" inputmode="text" placeholder="e.g. 8+7" value="' + Number(preset.actionDie || 0) + '" style="width:100%;margin-bottom:.18rem;">'
      + '<label style="display:block;font-size:.72rem;color:var(--muted2);margin-bottom:.08rem;">Opposition Total</label>'
      + '<input id="caravanManualOppTotal" type="text" inputmode="text" placeholder="e.g. 7+3" value="' + Number(preset.oppDie || 0) + '" style="width:100%;margin-bottom:.24rem;">'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-teal" onclick="resolveCaravanCardManualPrompt(\'' + actionId + '\')">Apply</button>'
      + '<button class="btn btn-xs" onclick="closeModal();openCaravanCombatPopup();">Cancel</button>'
      + '</div>'
      + '</div>';
    openModal('Caravan Manual Roll', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function resolveCaravanCardManualPrompt(actionId) {
    var chase = S.caravan.chase;
    var actionEl = document.getElementById('caravanManualActionTotal');
    var oppEl = document.getElementById('caravanManualOppTotal');
    var actionVal = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(actionEl, 1) : Number(actionEl?.value || 0);
    var oppVal = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(oppEl, 1) : Number(oppEl?.value || 0);
    if (!Number.isFinite(actionVal) || !Number.isFinite(oppVal) || actionVal < 1 || oppVal < 1) {
      showNotif('Enter valid manual totals first (examples: 8+7, 11).', 'warn');
      return false;
    }
    var diff = actionVal - oppVal;
    closeModal();
    var ally = getActiveCaravanAlly();
    var enemy = getActiveCaravanEnemy();
    if (actionId === 'driver-maneuver') {
      if (!spendCaravanChaseAction('wayfarer', 'Driver maneuver (manual)')) return false;
      var idx = CHASE_ZONES.indexOf(chase.zone);
      var shift = diff >= 3 ? -2 : (diff >= 0 ? -1 : (diff <= -3 ? 2 : 1));
      var newIdx = Math.max(0, Math.min(CHASE_ZONES.length - 1, idx + shift));
      chase.zone = CHASE_ZONES[newIdx];
      chase.log.push('R' + chase.round + ': Manual driver result ' + actionVal + ' vs ' + oppVal + ' -> ' + chase.zone + '.');
      if (diff >= 0 && typeof addSuccessRoll === 'function') addSuccessRoll();
      else if (diff < 0 && typeof addTMWOnFail === 'function') addTMWOnFail('caravan-manual-driver', { skipPrompt: true, failedBy: Math.max(1, oppVal - actionVal) });
    } else if (actionId === 'enemy-attack') {
      if (!enemy || !spendCaravanChaseAction('hostile', 'Hostile attack (manual)')) return false;
      if (diff >= 0) {
        var stress = Math.max(1, diff);
        ally.stress = Math.min(Number(ally.maxStress || getCaravanMaxStressBySize(S.caravan.size)), Number(ally.stress || 0) + stress);
        chase.log.push('R' + chase.round + ': Manual hostile hit for ' + stress + ' stress (' + actionVal + ' vs ' + oppVal + ').');
      } else {
        chase.log.push('R' + chase.round + ': Manual hostile miss (' + actionVal + ' vs ' + oppVal + ').');
      }
    } else if (actionId === 'move-closer') {
      adjustChaseZone(-1);
    } else if (actionId === 'move-wider') {
      adjustChaseZone(1);
    }
    renderCaravanUI();
    openCaravanCombatPopup();
    return true;
  }

  function getCaravanPopupTurnState() {
    var chase = S.caravan.chase || {};
    if (!chase.active) return "setup";
    if (Number(chase.actionsRemaining || 0) > 0) return "wayfarer";
    if (Number(chase.enemyActionsRemaining || 0) > 0) return "hostile";
    return "round-end";
  }

  function spendCaravanChaseAction(side, label) {
    ensureNewFeatureState();
    var chase = S.caravan.chase;
    if (!chase.active) {
      showNotif("Start chase first.", "warn");
      return false;
    }
    if (String(side) === "hostile") {
      if (Number(chase.enemyActionsRemaining || 0) <= 0) {
        showNotif("Hostile has no actions left this round.", "warn");
        return false;
      }
      chase.enemyActionsRemaining = Math.max(0, Number(chase.enemyActionsRemaining || 0) - 1);
      if (Number(chase.enemyActionsRemaining || 0) <= 0 && Number(chase.actionsRemaining || 0) > 0) {
        chase.turn = "wayfarer";
      }
      return true;
    }
    if (Number(chase.actionsRemaining || 0) <= 0) {
      showNotif("Wayfarers have no actions left. Advance to next round.", "warn");
      return false;
    }
    chase.actionsRemaining = Math.max(0, Number(chase.actionsRemaining || 0) - 1);
    if (Number(chase.actionsRemaining || 0) <= 0 && Number(chase.enemyActionsRemaining || 0) > 0) {
      chase.turn = "hostile";
      if (label) { chase.log.push("R" + chase.round + ": " + label + " spent last Wayfarer action. Hostile turn."); }
    }
    return true;
  }

  function isCaravanPopupActionEnabled(id) {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase || {};
    var zone = String(chase.zone || "Close");
    var turn = getCaravanPopupTurnState();
    if (id === "start-reset") return true;
    if (id === "next-round") return !!chase.active;
    if (id === "end-chase") return !!chase.active;
    if (id === "set-enemy-dread") return true;
    if (id === "spawn-hostile" || id === "spawn-ally" || id === "select-hostile" || id === "select-ally" || id === "assign-role" || id === "manual-action" || id === "toggle-focus-fire") return true;
    if (id === "disable-hostile") return !!getActiveCaravanEnemy();
    if (!chase.active) return false;
    if (id === "driver-maneuver") return turn === "wayfarer" && Number(chase.actionsRemaining || 0) > 0;
    if (id === "move-closer" || id === "move-wider") return turn === "wayfarer" && Number(chase.actionsRemaining || 0) > 0;
    if (id === "enemy-attack") return turn === "hostile" && Number(chase.enemyActionsRemaining || 0) > 0;
    if (id === "strike-window") return zone === "Engaged";
    if (id === "shoot-window") return zone === "Nearby";
    return false;
  }

  function getCaravanPopupActionReason(id) {
    var chase = S.caravan.chase || {};
    var zone = String(chase.zone || "Close");
    var turn = getCaravanPopupTurnState();
    if (isCaravanPopupActionEnabled(id)) return "Ready";
    if (!chase.active && id !== "start-reset" && id !== "set-enemy-dread" && id !== "spawn-hostile" && id !== "spawn-ally" && id !== "select-hostile" && id !== "select-ally" && id !== "assign-role") return "Start chase first";
    if (id === "driver-maneuver" || id === "move-closer" || id === "move-wider") {
      if (turn === "hostile") return "Hostile turn";
      if (turn === "round-end") return "Advance to next round";
      return "No Wayfarer actions left";
    }
    if (id === "enemy-attack") {
      if (turn === "wayfarer") return "Wayfarer turn";
      if (turn === "round-end") return "Advance to next round";
      return "No hostile actions left";
    }
    if (id === "strike-window" && zone !== "Engaged") return "Strike only at Engaged";
    if (id === "shoot-window" && zone !== "Nearby") return "Shoot only at Nearby";
    return "Unavailable";
  }

  function runCaravanPopupAction(actionId, payload) {
    ensureNewFeatureState();
    ensureCaravanConvoyState();
    if (actionId !== "set-enemy-dread" && !isCaravanPopupActionEnabled(actionId)) {
      showNotif(getCaravanPopupActionReason(actionId), "warn");
      renderCaravanCombatPopup();
      return false;
    }
    if (actionId === "start-reset") startChase();
    else if (actionId === "next-round") nextChaseRound();
    else if (actionId === "end-chase") endChase();
    else if (actionId === "spawn-hostile") spawnCaravanEnemyConvoy(true);
    else if (actionId === "spawn-ally") spawnCaravanAllyConvoy();
    else if (actionId === "select-hostile") setActiveCaravanEnemy(payload);
    else if (actionId === "select-ally") setActiveCaravanAlly(payload);
    else if (actionId === "disable-hostile") wreckCaravanEnemyConvoy();
    else if (actionId === "assign-role") {
      var roleBits = String(payload || '').split(':');
      assignCaravanRole(roleBits[0], roleBits.slice(1).join(':'));
    }
    else if (actionId === "manual-action") openCaravanCardManualPrompt(payload);
    else if (actionId === "toggle-focus-fire") S.caravan.chase.focusFireLock = !S.caravan.chase.focusFireLock;
    else if (actionId === "driver-maneuver") rollChaseControl();
    else if (actionId === "move-closer") adjustChaseZone(-1);
    else if (actionId === "move-wider") adjustChaseZone(1);
    else if (actionId === "enemy-attack") rollChaseEnemyAttack();
    else if (actionId === "set-enemy-dread") setChaseEnemyDread(Number(payload || 6));
    renderCaravanCombatPopup();
    return true;
  }

  function buildCaravanCombatVisualHtml() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase || {};
    var zone = String(chase.zone || "Close");
    var zoneIndex = Math.max(0, CHASE_ZONES.indexOf(zone));
    var turn = getCaravanPopupTurnState();
    var turnLabel = turn === "wayfarer" ? "Wayfarer Turn" : (turn === "hostile" ? "Hostile Turn" : (turn === "round-end" ? "Round End" : "Setup"));
    var turnTone = turn === "wayfarer" ? "var(--teal)" : (turn === "hostile" ? "var(--red2)" : "var(--gold2)");
    var centers = [
      { x: 70, y: 86, name: "Engaged" },
      { x: 170, y: 52, name: "Close" },
      { x: 270, y: 52, name: "Nearby" },
      { x: 370, y: 86, name: "Far" }
    ];
    var enemyPos = centers[Math.max(0, Math.min(centers.length - 1, zoneIndex))];
    var enemies = (chase.enemyConvoys || []).filter(function(entry) { return entry && !entry.wrecked; });
    function hexPoints(cx, cy, r) {
      var pts = [];
      for (var i = 0; i < 6; i += 1) {
        var a = Math.PI / 180 * (60 * i - 30);
        pts.push((cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2));
      }
      return pts.join(" ");
    }
    var svg = '<svg width="440" height="168" viewBox="0 0 440 168" style="width:100%;border:1px solid var(--border2);background:radial-gradient(circle at 35% 30%, rgba(70,196,182,.08), rgba(8,10,16,.95));border-radius:8px;">';
    svg += '<text x="14" y="18" font-size="11" fill="' + turnTone + '" style="font-family:Rajdhani,sans-serif;letter-spacing:.08em;text-transform:uppercase;">' + turnLabel + '</text>';
    centers.forEach(function(c, index) {
      var active = index === zoneIndex;
      svg += '<polygon points="' + hexPoints(c.x, c.y, 34) + '" fill="' + (active ? 'rgba(201,162,39,.22)' : 'rgba(255,255,255,.03)') + '" stroke="' + (active ? '#e8c050' : '#2a2f45') + '" stroke-width="2"></polygon>';
      svg += '<text x="' + c.x + '" y="' + (c.y + 4) + '" text-anchor="middle" font-size="10" fill="' + (active ? '#f0d070' : '#9ba3c0') + '">' + c.name + '</text>';
    });
    svg += '<circle cx="38" cy="86" r="16" fill="#2ec4b6" stroke="#c8fff6" stroke-width="2"></circle>';
    svg += '<text x="38" y="90" text-anchor="middle" font-size="13" fill="#0b1a22">⛟</text>';
    svg += '<text x="38" y="114" text-anchor="middle" font-size="10" fill="#9bd9d3">Your Caravan</text>';
    enemies.forEach(function(enemy, idx) {
      var row = Math.floor(idx / 3);
      var col = idx % 3;
      var x = enemyPos.x + ((col - 1) * 18);
      var y = enemyPos.y + (row * 18);
      var active = String(enemy.id || '') === String(chase.targetEnemyId || '');
      svg += '<circle cx="' + x + '" cy="' + y + '" r="' + (active ? 13 : 10) + '" fill="' + (active ? '#df4d4d' : '#a63b3b') + '" stroke="' + (active ? '#ffe0b8' : '#f0a0a0') + '" stroke-width="2"></circle>';
      svg += '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" font-size="10" fill="#2a0f0f">☠</text>';
    });
    svg += '<text x="' + enemyPos.x + '" y="' + (enemyPos.y + 28) + '" text-anchor="middle" font-size="10" fill="#f0a0a0">Hostiles: ' + enemies.length + '</text>';
    if (enemies.length) {
      svg += '<path d="M56 86 C 98 70, 130 62, ' + (enemyPos.x - 18) + ' ' + enemyPos.y + '" stroke="rgba(240,208,112,.55)" stroke-width="2" fill="none" stroke-dasharray="4 4"></path>';
    }
    svg += '</svg>';
    return svg;
  }

  function buildCaravanActionCardsHtml() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase || {};
    var ally = getActiveCaravanAlly();
    var enemy = getActiveCaravanEnemy();
    var driverStat = String(chase.driverStat || "control");
    var driverDie = Number(getCaravanRoleDie('driver', driverStat) || 4);
    var enemyDread = Number(enemy && enemy.dread || chase.enemyDread || 6);
    var caravanDread = Number(getCaravanDreadForAlly(ally) || 4);
    var cards = [
      { id: "driver-maneuver", title: "Driver Maneuver", effect: "Shift chase zone", formula: "Roll " + driverStat + " d" + driverDie + " vs Enemy Dread d" + enemyDread + ". Success pushes toward Engaged; failure falls back.", action: "1 Wayfarer Action" },
      { id: "move-closer", title: "Force Approach", effect: "Manual zone step", formula: "Spend 1 action to shift one zone closer.", action: "1 Wayfarer Action" },
      { id: "move-wider", title: "Pull Away", effect: "Manual zone step", formula: "Spend 1 action to shift one zone wider.", action: "1 Wayfarer Action" },
      { id: "enemy-attack", title: "Hostile Attack", effect: "Resolve enemy pressure", formula: "Hostile rolls d" + enemyDread + " vs Caravan Dread d" + caravanDread + ". On hit, add Stress by difference.", action: "1 Hostile Action" },
      { id: "strike-window", title: "Strike Window", effect: "Zone requirement", formula: "Strike options are valid at Engaged.", action: "Zone Rule" },
      { id: "shoot-window", title: "Shoot Window", effect: "Zone requirement", formula: "Shoot options are valid at Nearby.", action: "Zone Rule" }
    ];
    return '<div class="command-card-grid">' + cards.map(function(card) {
      var enabled = isCaravanPopupActionEnabled(card.id);
      var reason = getCaravanPopupActionReason(card.id);
      var runBtn = (card.id === "strike-window" || card.id === "shoot-window")
        ? ''
        : ('<div style="display:flex;gap:.14rem;">'
          + '<button class="btn btn-xs ' + (enabled ? 'btn-primary' : '') + '" onclick="runCaravanPopupAction(\'' + card.id + '\')" ' + (enabled ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Run</button>'
          + '<button class="btn btn-xs" onclick="runCaravanPopupAction(\'manual-action\',\'' + card.id + '\')">Manual</button>'
          + '</div>');
      return '<div class="command-action-card ' + (enabled ? 'ready' : '') + '">'
        + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:flex-start;margin-bottom:.12rem;">'
        + '<div class="command-action-title">' + card.title + '</div>'
        + '<span class="command-action-cost">' + card.action + '</span>'
        + '</div>'
        + '<div class="command-action-effect">' + card.effect + '</div>'
        + '<div class="command-action-formula">' + card.formula + '</div>'
        + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;">'
        + runBtn
        + '<span style="font-size:.62rem;color:' + (enabled ? 'var(--teal)' : 'var(--muted2)') + ';">' + reason + '</span>'
        + '</div>'
        + '</div>';
    }).join('') + '</div>';
  }

  function buildCaravanCombatPopupHtml() {
    ensureCaravanConvoyState();
    var chase = S.caravan.chase || {};
    var ally = getActiveCaravanAlly();
    var enemy = getActiveCaravanEnemy();
    var allies = Array.isArray(chase.allyConvoys) ? chase.allyConvoys : [];
    var enemies = Array.isArray(chase.enemyConvoys) ? chase.enemyConvoys : [];
    var log = Array.isArray(chase.log) ? chase.log.slice(-14).reverse() : [];
    var turn = getCaravanPopupTurnState();
    var turnLabel = turn === "wayfarer" ? "Wayfarers Act" : (turn === "hostile" ? "Hostiles Act" : (turn === "round-end" ? "Advance Round" : "Setup"));
    var wayfarerActions = Number(chase.actionsRemaining || 0);
    var wayfarerMax = Number(getCaravanWayfarerActionCount() || 1);
    var hostileActions = Number(chase.enemyActionsRemaining || 0);
    return '<div id="caravanCombatPopupRoot" class="command-popup-root command-table-caravan">'
      + '<div class="command-popup-header">'
      + '<div class="command-kicker">Command Table</div>'
      + '<div class="command-popup-title">Caravan Combat Console</div>'
      + '<div class="command-popup-subtitle">' + turnLabel + ' • Actions: ' + wayfarerActions + '/' + wayfarerMax + ' (Wayfarer) • ' + hostileActions + '/2 (Hostile)</div>'
      + '</div>'
      + '<div class="command-chip-row">'
      + '<span class="command-chip">Round ' + Number(chase.round || 1) + '</span>'
      + '<span class="command-chip teal">Zone ' + String(chase.zone || 'Close') + '</span>'
      + '<span class="command-chip">Enemy Dread d' + Number(enemy && enemy.dread || chase.enemyDread || 6) + '</span>'
      + '<span class="command-chip teal">Ally Stress ' + Number(ally && ally.stress || 0) + '/' + Number(ally && ally.maxStress || (CARAVAN_SIZES[S.caravan.size] || CARAVAN_SIZES.Small).stress || 12) + '</span>'
      + '<span class="command-chip">Hostiles ' + enemies.filter(function(entry){ return entry && !entry.wrecked; }).length + '</span>'
      + '<span class="command-chip">State ' + (chase.active ? 'Active' : 'Idle') + '</span>'
      + '</div>'
      + '<div class="command-visual-frame">' + buildCaravanCombatVisualHtml() + '</div>'
      + buildCaravanRoleAssignmentHtml()
      + '<div style="display:flex;gap:.26rem;flex-wrap:wrap;margin-bottom:.3rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="runCaravanPopupAction(\'start-reset\')">Start / Reset</button>'
      + '<button class="btn btn-xs" onclick="runCaravanPopupAction(\'spawn-ally\')">Spawn Ally</button>'
      + '<button class="btn btn-xs" onclick="runCaravanPopupAction(\'spawn-hostile\')">Spawn Hostile</button>'
      + '<button class="btn btn-xs" onclick="runCaravanPopupAction(\'next-round\')" ' + (isCaravanPopupActionEnabled("next-round") ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Next Round</button>'
      + '<button class="btn btn-xs btn-red" onclick="runCaravanPopupAction(\'end-chase\')" ' + (isCaravanPopupActionEnabled("end-chase") ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>End Chase</button>'
      + '<button class="btn btn-xs" onclick="openCaravanCombatRulesPage();">Rules Page</button>'
      + '</div>'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-bottom:.32rem;">'
      + [4,6,8,10,12].map(function(d) {
          return '<button class="btn btn-xs" onclick="runCaravanPopupAction(\'set-enemy-dread\',' + d + ');">Enemy d' + d + '</button>';
        }).join('')
      + '</div>'
      + '<div class="command-target-box">'
      + '<div class="command-target-title">Ally Targeting</div>'
      + '<select onchange="runCaravanPopupAction(\'select-ally\', this.value)" style="width:100%;margin-bottom:.16rem;">'
      + (allies.length ? allies.map(function(entry, idx) {
          var name = String(entry && entry.name || ('Ally Caravan ' + (idx + 1)));
          var status = entry && entry.wrecked ? ' (Wrecked)' : '';
          return '<option value="' + String(entry && entry.id || '') + '"' + (String(entry && entry.id || '') === String(chase.activeAllyId || '') ? ' selected' : '') + '>' + name + status + ' · Stress ' + Number(entry && entry.stress || 0) + '/' + Number(entry && entry.maxStress || 12) + '</option>';
        }).join('') : '<option value="">No allies yet</option>')
      + '</select>'
      + '<div style="display:flex;gap:.12rem;flex-wrap:wrap;margin-bottom:.12rem;">'
      + (allies.length ? allies.map(function(entry, idx) {
          return buildCompactCaravanStressChip(String(entry && entry.name || ('Ally Caravan ' + (idx + 1))), Number(entry && entry.stress || 0), Number(entry && entry.maxStress || 12), '#46c4b6');
        }).join('') : '')
      + '</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Selected ally performs actions and receives hostile hits.</div>'
      + '</div>'
      + '<div class="command-target-box">'
      + '<div class="command-target-title">Hostile Targeting</div>'
      + '<div style="display:grid;grid-template-columns:1fr auto;gap:.24rem;align-items:center;margin-bottom:.16rem;">'
      + '<select onchange="runCaravanPopupAction(\'select-hostile\', this.value)" style="width:100%;">'
      + (enemies.length ? enemies.map(function(entry, idx) {
          var name = String(entry && entry.name || ('Hostile Caravan ' + (idx + 1)));
          var status = entry && entry.wrecked ? ' (Wrecked)' : '';
          return '<option value="' + String(entry && entry.id || '') + '"' + (String(entry && entry.id || '') === String(chase.targetEnemyId || '') ? ' selected' : '') + '>' + name + status + ' · d' + Number(entry && entry.dread || 6) + ' · Stress ' + Number(entry && entry.stress || 0) + '/' + Number(entry && entry.maxStress || 12) + '</option>';
        }).join('') : '<option value="">No hostiles yet</option>')
      + '</select>'
      + '<button class="btn btn-xs btn-red" onclick="runCaravanPopupAction(\'disable-hostile\')" ' + (isCaravanPopupActionEnabled("disable-hostile") ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Disable Target</button>'
      + '</div>'
      + '<div style="display:flex;gap:.12rem;flex-wrap:wrap;margin-bottom:.12rem;">'
      + (enemies.length ? enemies.map(function(entry, idx) {
          return buildCompactCaravanStressChip(String(entry && entry.name || ('Hostile Caravan ' + (idx + 1))), Number(entry && entry.stress || 0), Number(entry && entry.maxStress || 12), '#df4d4d');
        }).join('') : '')
      + '</div>'
      + '<div style="display:flex;gap:.2rem;align-items:center;margin-bottom:.12rem;">'
      + '<button class="btn btn-xs ' + (chase.focusFireLock ? 'btn-primary' : '') + '" onclick="runCaravanPopupAction(\'toggle-focus-fire\')">Focus Fire ' + (chase.focusFireLock ? 'On' : 'Off') + '</button>'
      + '<span style="font-size:.64rem;color:var(--muted2);">When On, target will not auto-switch.</span>'
      + '</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Target enemy determines dread and damage application for this action.</div>'
      + '</div>'
      + '<div style="margin-bottom:.34rem;">' + buildCaravanActionCardsHtml() + '</div>'
      + '<div class="command-popup-log">'
      + (log.length
          ? log.map(function(entry) { return '<div style="font-size:.74rem;color:var(--text2);border-bottom:1px solid var(--border2);padding:.12rem 0;">' + entry + '</div>'; }).join('')
          : '<div style="font-size:.74rem;color:var(--muted2);">No chase events yet.</div>')
      + '</div>'
      + '</div>';
  }

  function renderCaravanCombatPopup() {
    var content = document.getElementById('modalContent');
    var root = document.getElementById('caravanCombatPopupRoot');
    if (!content || !root) { return false; }
    content.innerHTML = buildCaravanCombatPopupHtml();
    return true;
  }

  function openCaravanCombatRulesPage() {
    var html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.9rem;color:var(--gold2);margin-bottom:.2rem;">Caravan Chase Rules</div>'
      + '<div style="font-size:.69rem;color:var(--teal);margin-bottom:.3rem;">Teaching mode mirrors naval console: action cards, formulas, and turn gating.</div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);margin-bottom:.3rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;margin-bottom:.14rem;">Combat Flow</div>'
      + '<div style="font-size:.74rem;color:var(--text2);">Wayfarers act first, then hostiles. Each Wayfarer grants 1 action; hostiles get 2 actions. Resolve movement and control checks, then hostile pressure, then round reset.</div>'
      + '</div>'
      + '<details open style="margin-bottom:.28rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Action Definitions</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">'
      + '<div><strong>Driver Maneuver:</strong> Roll selected driver stat vs Enemy Dread. Success shifts closer, failure falls back.</div>'
      + '<div><strong>Force Approach / Pull Away:</strong> Spend 1 action for manual zone adjustment.</div>'
      + '<div><strong>Hostile Attack:</strong> Enemy Dread vs Caravan Dread. On hit, add Stress by difference.</div>'
      + '<div><strong>Enemy Dread Selector:</strong> Set d4-d12 to scale threat.</div>'
      + '</div></details>'
      + '<details open style="margin-bottom:.28rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Zones</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">'
      + '<div><strong>Engaged:</strong> Strike zone and boarding pressure.</div>'
      + '<div><strong>Close:</strong> Spells/items and tactical setup.</div>'
      + '<div><strong>Nearby:</strong> Shoot zone.</div>'
      + '<div><strong>Far:</strong> Out of range for direct ship-to-ship attacks.</div>'
      + '</div></details>'
      + '<details open style="margin-bottom:.28rem;"><summary style="cursor:pointer;font-size:.76rem;color:var(--gold2);">Stress and Breakpoints</summary>'
      + '<div style="margin-top:.18rem;font-size:.73rem;color:var(--text2);">'
      + '<div>Caravan stress cap is based on transporter size. Enemy hits add stress by roll difference.</div>'
      + '<div>Heavy hits can trigger damage complications and long-term degradation (wheels, dread step-down, cargo loss).</div>'
      + '</div></details>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs btn-teal" onclick="openCaravanCombatPopup();">Back To Combat Popup</button>'
      + '<button class="btn btn-xs" onclick="closeModal();">Close</button>'
      + '</div>'
      + '</div>';
    openModal('Caravan Combat Rules', html, null, { preventScroll: true, focusTrap: true });
  }

  function openCaravanCombatPopup() {
    ensureNewFeatureState();
    openModal('Caravan Combat Console', buildCaravanCombatPopupHtml(), null, { preventScroll: true, focusTrap: true });
  }

  // ── HOLDING RENDER ─────────────────────────────────────────────────────────────
  function renderHoldingUI() {
    var panel = document.getElementById("tab-holding");
    if (!panel || !panel.dataset.mounted) { return; }
    if (!panel.querySelector("#holdingGate") || !panel.querySelector("#holdingBody")) {
      panel.innerHTML = buildHoldingHTML();
    }
    ensureNewFeatureState();
    var h = S.holding;
    var el;

    // Holding gate — locked if Renown < 9 and no quest active and no holding yet
    var gateEl = document.getElementById("holdingGate");
    var bodyEl = document.getElementById("holdingBody");
    var renown = getHoldingGateRenown();
    var q = S.holdingQuest || {};
    var questActive = q.active;
    var questDone = !!(q.step3Completed && !q.failed);
    var holdingEstablished = !!(h.established || questDone);
    if (gateEl) {
      if (!holdingEstablished) {
        var gateProgress = '';
        if (questActive) {
          var gateSteps = ['Gather Information', 'Go To Site', 'Establish Holding'];
          var gateLoc = '';
            var itemLabel = (typeof weaponLabelHtml === 'function')
              ? weaponLabelHtml(item, 18)
              : String(item).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          if (q.infoHex && q.step <= 0) {
              + '<div style="word-wrap:break-word;overflow:hidden;text-overflow:ellipsis;">' + itemLabel + '</div>'
          }
          if (q.siteHex && q.step <= 1) {
            gateLoc += '<div style="font-size:.72rem;color:var(--red2);margin-top:.12rem;">⚔ Go To Site: Hex [' + (q.siteHex.col + 1) + ',' + (q.siteHex.row + 1) + ']</div>';
          }
          if (q.holdingHex && q.step >= 2) {
            gateLoc += '<div style="font-size:.72rem;color:var(--teal);margin-top:.12rem;">🏛 Proposed Holding: Hex [' + (q.holdingHex.col + 1) + ',' + (q.holdingHex.row + 1) + ']</div>';
          }
          gateProgress = '<div style="margin-top:.55rem;padding-top:.45rem;border-top:1px solid var(--border2);">'
            + '<div style="font-size:.72rem;color:var(--gold2);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.18rem;">Quest In Progress</div>'
            + '<div style="font-size:.78rem;color:var(--text2);">Current Step: <strong style="color:var(--teal);">' + (gateSteps[q.step] || 'Establish Holding') + '</strong></div>'
            + gateLoc
            + '</div>';
        }
        var gateMsg = '<div class="card" style="max-width:580px;margin-top:.6rem;border:1px solid rgba(201,162,39,.35);">'
          + '<div class="section-title" style="color:var(--gold2);">⚔ Holding Not Yet Established</div>'
          + '<div style="font-size:.85rem;color:var(--text2);line-height:1.6;margin-bottom:.6rem;">'
          + 'You must complete the <strong style="color:var(--gold);">Establishment Quest</strong> — including a successful <strong>Confrontation Stage</strong> — to unlock your Holding.'
          + '</div>'
          + '<div style="font-size:.78rem;color:var(--muted2);margin-bottom:.5rem;">'
          + (questActive
              ? '📋 Quest is <strong style="color:var(--teal);">in progress</strong>. Return to the <strong>Missions</strong> tab to continue.'
                : (renown >= 9
                  ? '✅ You have sufficient Renown. Start the quest from the <strong>Missions</strong> tab.'
                  : '🔒 Requires <strong style="color:var(--gold2);">Renown 9</strong> in any Guild Renown track. Current highest: <strong style="color:var(--teal);">' + renown + '</strong>.'))
          + '</div>'
          + gateProgress
          + '</div>';
        gateEl.innerHTML = gateMsg;
        if (bodyEl) { bodyEl.style.display = "none"; }
        return;
      } else {
        gateEl.innerHTML = '';
        if (bodyEl) { bodyEl.style.display = ""; }
      }
    }

    el = document.getElementById("holdingRenownReadout");    if (el) { el.textContent = getHoldingGateRenown(); }
    el = document.getElementById("holdingCreditsReadout");   if (el) { el.textContent = (S.credits || 0) + " \u20B5"; }
    el = document.getElementById("holdingLandmarkCount");    if (el) { el.textContent = h.landmarks.length + h.extraLandmarks.length; }
    el = document.getElementById("holdingCrisisCount");      if (el) { el.textContent = h.crises.length; }

    var hn = document.getElementById("holdingName");
    if (hn) { hn.value = h.name || ""; }
    var ht = document.getElementById("holdingType");
    if (ht) { ht.value = h.type || "Citadel"; }

    // Landmarks
    var ll = document.getElementById("holdingLandmarks");
    if (ll) {
      var allLandmarks = h.landmarks.concat(h.extraLandmarks);
      var baseLen = h.landmarks.length;
      ll.innerHTML = allLandmarks.map(function(lm, i) {
        var isExtra = i >= baseLen;
        var typeColor = lm.type === "Temple" ? "var(--purple)" : lm.type === "Dwelling" ? "var(--green2)" : "var(--gold2)";
        return '<div style="background:var(--surface);border:1px solid var(--border2);padding:.35rem .5rem;margin-bottom:.22rem;display:flex;justify-content:space-between;align-items:center;gap:.4rem;">'
          + '<div style="flex:1;">'
          + '<div style="font-family:\'Cinzel\',serif;font-size:.58rem;letter-spacing:.08em;color:' + typeColor + ';text-transform:uppercase;">' + lm.type + (isExtra ? ' (Purchased)' : '') + '</div>'
          + '<input type="text" style="background:transparent;border:none;outline:none;color:var(--text);font-family:\'Crimson Pro\',serif;font-size:.85rem;width:100%;" value="' + (lm.name || "").replace(/"/g, "&quot;") + '" placeholder="Landmark name\u2026" onchange="updateLandmarkName(' + i + ',this.value)">'
          + '</div>'
          + '<div style="font-size:.7rem;color:var(--gold);white-space:nowrap;">+1d4\xD710\u20B5</div>'
          + (isExtra ? '<button class="btn btn-xs btn-red" onclick="removeExtraLandmark(' + (i - baseLen) + ')">✕</button>' : '')
          + '</div>';
      }).join("");
    }

    // Council
    var councilEl = document.getElementById("holdingCouncil");
    if (councilEl) {
      councilEl.innerHTML = COUNCIL_ROLES.map(function(role) {
        var mem = (h.council && h.council[role.key]) || {};
        var retainers = mem.retainers !== undefined ? mem.retainers : 3;
        var activeTasks = (h.councilTasks || []).filter(function(t) { return t.role === role.key && t.status === 'assigned'; }).length;
        var taskValue = mem.task || "";
        if (role.key === 'regent' && (h.crises || []).length) {
          taskValue = 'Resolve Active Crises (' + h.crises.length + ')';
        }
        return '<div style="background:var(--surface);border:1px solid var(--border2);padding:.45rem .5rem;margin-bottom:.3rem;">'
          + '<div style="font-family:\'Cinzel\',serif;font-size:.68rem;color:var(--gold2);margin-bottom:.15rem;">' + role.name + '</div>'
          + '<div style="font-size:.7rem;color:var(--muted3);margin-bottom:.28rem;">' + role.desc + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;margin-bottom:.28rem;">'
          + '<div><span class="sub-label">Name</span><input type="text" style="width:100%;" value="' + (mem.name || "").replace(/"/g, "&quot;") + '" placeholder="Council member\u2026" onchange="updateCouncilMember(\'' + role.key + '\',\'name\',this.value)"></div>'
          + '<div><span class="sub-label">Retainers</span><div class="counter-row" style="padding:0;">'
          + '<button class="step-btn" onclick="adjustRetainers(\'' + role.key + '\',-1)">−</button>'
          + '<span style="font-family:\'Rajdhani\',sans-serif;font-size:.95rem;font-weight:700;min-width:1.5rem;text-align:center;color:var(--teal);" id="retainersVal-' + role.key + '">' + retainers + '</span>'
          + '<button class="step-btn" onclick="adjustRetainers(\'' + role.key + '\',1)">+</button>'
          + '</div></div>'
          + '</div>'
          + '<div style="font-size:.68rem;color:var(--muted2);margin-bottom:.2rem;">Task Capacity: <span style="color:var(--gold2);">' + activeTasks + '/' + retainers + '</span></div>'
          + '<div style="margin-bottom:.28rem;"><span class="sub-label">Current Task</span><input type="text" style="width:100%;" value="' + taskValue.replace(/"/g, "&quot;") + '" placeholder="Assigned task\u2026" onchange="updateCouncilMember(\'' + role.key + '\',\'task\',this.value)"></div>'
          + '<div style="display:flex;align-items:center;gap:.4rem;">'
          + '<button class="btn btn-xs btn-teal" onclick="rollCouncilTask(\'' + role.key + '\')">⚄ Roll Task (VD vs d6)</button>'
          + '<button class="btn btn-xs" onclick="hireRetainer(\'' + role.key + '\')">+ Retainer (200₵)</button>'
          + '<span id="councilResult-' + role.key + '" style="font-size:.76rem;color:var(--muted3);"></span>'
          + '</div>'
          + '</div>';
      }).join("");
    }

    var governanceEl = document.getElementById('holdingGovernancePanel');
    if (governanceEl) {
      var maxRenown = getHoldingGateRenown();
      var govUnlocked = maxRenown >= 12;
      var gov = getHoldingGovernanceState();
      syncHoldingGovernanceToWorldState();
      var lockHtml = govUnlocked
        ? ''
        : '<div style="font-size:.74rem;color:var(--muted2);margin-bottom:.45rem;">🔒 Unlocks at Renown 12. Current highest standing: <strong style="color:var(--gold2);">' + maxRenown + '</strong>.</div>';
      function btn(field, value, label, tone) {
        var active = (field === 'patrol' && gov.patrolStance === value)
          || (field === 'tariff' && gov.tariffStance === value)
          || (field === 'route' && gov.routePriority === value);
        var cls = active ? (tone || 'btn-primary') : 'btn';
        var disabled = govUnlocked ? '' : ' disabled style="opacity:.45;cursor:default;"';
        return '<button class="btn btn-xs ' + cls + '" onclick="setHoldingGovernancePolicy(\'' + field + '\',\'' + value + '\')"' + disabled + '>' + label + '</button>';
      }
      governanceEl.innerHTML = lockHtml
        + '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.2rem;">Patrol Doctrine</div>'
        + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.35rem;">'
          + btn('patrol','strict','Strict Patrols','btn-warn')
          + btn('patrol','balanced','Balanced Patrols','btn-teal')
          + btn('patrol','open','Open Streets','btn-primary')
        + '</div>'
        + '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.2rem;">Tariff Stance</div>'
        + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.35rem;">'
          + btn('tariff','extractive','Extractive Tariffs','btn-red')
          + btn('tariff','balanced','Balanced Tariffs','btn-teal')
          + btn('tariff','relief','Relief Tariffs','btn-primary')
        + '</div>'
        + '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.2rem;">Route Priority</div>'
        + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.35rem;">'
          + btn('route','military','Military Routes','btn-red')
          + btn('route','trade','Trade Routes','btn-gold')
          + btn('route','civic','Civic Corridors','btn-teal')
        + '</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);line-height:1.5;">Current Policy: Patrol <strong>' + gov.patrolStance + '</strong> · Tariff <strong>' + gov.tariffStance + '</strong> · Route <strong>' + gov.routePriority + '</strong></div>';
    }

    var bankEl = document.getElementById('holdingBankPanel');
    if (bankEl) {
      bankEl.innerHTML = buildHoldingBankPanelHtml();
    }

    renderHoldingCrises();

    // Holding Vault
    var vaultEl = document.getElementById("holdingVault");
    if (vaultEl) {
      if (!h.vault || h.vault.length === 0) {
        vaultEl.innerHTML = '<div style="font-size:.76rem;color:var(--muted2);">Vault is empty.</div>';
      } else {
        vaultEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr));gap:.4rem;">'
          + h.vault.map(function(item, i) {
            var itemLabel = (typeof weaponLabelHtml === 'function')
              ? weaponLabelHtml(item, 18)
              : String(item).replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return '<div style="background:var(--surface);border:1px solid var(--border2);padding:.3rem;text-align:center;border-radius:3px;font-size:.75rem;color:var(--text2);cursor:pointer;" onclick="moveVaultItemToBackpack(' + i + ');">'
              + '<div style="word-wrap:break-word;overflow:hidden;text-overflow:ellipsis;">' + itemLabel + '</div>'
              + '<div style="font-size:.65rem;color:var(--muted);margin-top:.15rem;">Click → Backpack</div>'
              + '</div>';
          }).join('') + '</div>';
      }
    }

    // Holding Acquisition Quest
    var questEl = document.getElementById("holdingQuestStatus");
    if (questEl) {
      var qh = S.holdingQuest || {};
      if (qh.active) {
        var steps = ['Gather Information', 'Go To Site', 'Establish Holding'];
        var progressHtml = '';
        for (var si = 0; si < 3; si++) {
          var isDone = qh.step > si;
          var isCurrent = qh.step === si;
          progressHtml += '<div style="flex:1;text-align:center;padding:.3rem;background:' + (isDone ? 'var(--green2)' : isCurrent ? 'var(--teal)' : 'var(--surface)') + ';border:1px solid ' + (isDone ? 'rgba(46,196,182,.5)' : isCurrent ? 'var(--teal)' : 'var(--border2)') + ';border-radius:3px;">'
            + '<div style="font-size:.65rem;color:' + (isDone || isCurrent ? 'var(--text)' : 'var(--muted2)') + ';">' + steps[si] + '</div>'
            + '<div style="font-family:\'Rajdhani\',sans-serif;font-size:.9rem;font-weight:700;color:' + (isDone || isCurrent ? 'var(--text)' : 'var(--muted)') + ';">Step ' + (si + 1) + '</div>'
            + '</div>';
        }

        var locHtml = '';
        if (qh.infoHex && qh.step <= 0) {
          locHtml += '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.12rem;">👁 Gather Information: Hex [' + (qh.infoHex.col + 1) + ',' + (qh.infoHex.row + 1) + ']</div>';
        }
        if (qh.siteHex && qh.step <= 1) {
          locHtml += '<div style="font-size:.72rem;color:var(--red2);margin-bottom:.12rem;">⚔ Go To Site: Hex [' + (qh.siteHex.col + 1) + ',' + (qh.siteHex.row + 1) + ']</div>';
        }
        if (qh.holdingHex && qh.step >= 2) {
          locHtml += '<div style="font-size:.72rem;color:var(--teal);margin-bottom:.12rem;">🏛 Proposed Holding: Hex [' + (qh.holdingHex.col + 1) + ',' + (qh.holdingHex.row + 1) + ']</div>';
        }

        questEl.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.3rem;margin-bottom:.4rem;">' + progressHtml + '</div>'
          + (locHtml ? '<div style="margin-bottom:.3rem;">' + locHtml + '</div>' : '')
          + '<button class="btn btn-sm btn-primary" onclick="advanceHoldingQuest();" style="width:100%;">⚄ Roll Current Step</button>';
      } else if (!(h.established || questDone)) {
        if (renown < 9) {
          questEl.innerHTML = '<div style="font-size:.75rem;color:var(--muted2);">You need <strong style="color:var(--gold2);">Renown 9</strong> in any Guild Renown track to establish a Holding. Current highest: ' + renown + '</div>';
        } else {
          questEl.innerHTML = '<div style="display:flex;gap:.3rem;align-items:center;">'
            + '<div style="flex:1;font-size:.75rem;color:var(--text2);">You are ready to establish your own Holding!' + (qh.failed ? ' Previous attempt failed — you can retry.' : '') + '</div>'
            + '<button class="btn btn-sm btn-teal" onclick="startHoldingQuest();">Begin Quest →</button>'
            + '</div>';
        }
      } else {
        questEl.innerHTML = '<div style="font-size:.75rem;color:var(--muted2);">Holding established: <strong style="color:var(--gold)">' + h.name + '</strong></div>';
      }
    }

    var homeEl = document.getElementById("wayfarerHomePanel");
    if (homeEl) {
      var home = h.wayfarerHome || {};
      var levels = [
        { key: "decorLevel", name: "Decor", desc: "Adds social prestige and narrative flair." },
        { key: "securityLevel", name: "Security", desc: "Improves defensive readiness and crisis resilience." },
        { key: "workshopLevel", name: "Workshop", desc: "Improves technical salvage and mission support." },
        { key: "marketLevel", name: "Market", desc: "Improves mission and district economy payouts." }
      ];
      homeEl.innerHTML = levels.map(function (entry) {
        var lvl = Number(home[entry.key] || 0);
        var nextCost = getWayfarerHomeUpgradeCost(entry.key, lvl);
        var cap = lvl >= 3;
        return '<div style="border:1px solid var(--border2);background:var(--surface);padding:.38rem .45rem;margin-bottom:.3rem;">'
          + '<div style="font-family:\'Cinzel\',serif;font-size:.6rem;letter-spacing:.08em;color:var(--gold2);text-transform:uppercase;">' + entry.name + ' Lv.' + lvl + '</div>'
          + '<div style="font-size:.74rem;color:var(--muted3);margin:.15rem 0 .25rem 0;line-height:1.45;">' + entry.desc + '</div>'
          + '<button class="btn btn-xs ' + (cap ? '' : 'btn-teal') + '" ' + (cap ? 'disabled' : ('onclick="buyWayfarerHomeUpgrade(\'' + entry.key + '\')"')) + '>' + (cap ? 'Max Level' : ('Upgrade (' + nextCost + '₵)')) + '</button>'
          + '</div>';
      }).join('')
      + '<div style="margin-top:.35rem;padding-top:.35rem;border-top:1px solid var(--border);">'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-bottom:.22rem;">Decor Theme</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;">'
      + '<button class="btn btn-xs" onclick="setWayfarerHomeDecorTheme(\'Frontier\')">Frontier</button>'
      + '<button class="btn btn-xs" onclick="setWayfarerHomeDecorTheme(\'Noir\')">Noir</button>'
      + '<button class="btn btn-xs" onclick="setWayfarerHomeDecorTheme(\'Neon\')">Neon</button>'
      + '<button class="btn btn-xs" onclick="setWayfarerHomeDecorTheme(\'Industrial\')">Industrial</button>'
      + '</div>'
      + '<div style="font-size:.72rem;color:var(--gold2);margin-top:.25rem;">Current Theme: ' + (home.decorTheme || 'Frontier') + '</div>'
      + '</div>';
    }
  }

  function getWayfarerHomeUpgradeCost(key, level) {
    var base = {
      decorLevel: 350,
      securityLevel: 500,
      workshopLevel: 450,
      marketLevel: 600
    };
    var start = base[key] || 400;
    return start + (Number(level || 0) * 250);
  }

  function getCrucibleStatDie(key, fallback) {
    if (typeof getEffectiveDie === 'function') {
      try {
        return Math.max(4, Number(getEffectiveDie(String(key || '')) || fallback || 6));
      } catch (_err) { console.error(_err); }
    }
    return Math.max(4, Number((S && S.stats && S.stats[key]) || fallback || 6));
  }

  var CRUCIBLE_MODE_SPECS = {
    control: {
      id: 'control',
      label: 'Control',
      objective: '3v3 Control. Hold each zone for 3 rounds to capture it. Hold at least 2 of 3 zones to score each round. Highest score after 10 rounds wins.',
      scoreToWin: 10,
      killPoints: 1,
      zonePoints: 0,
      controlRoundPoint: 1,
      maxRounds: 10,
      teamSize: 3,
      mapSize: 12
    },
    expedition: {
      id: 'expedition',
      label: 'Expedition',
      objective: 'Navigate the collapsing province, clear encounters, and survive raid threats with your loadout and flavor kit.',
      scoreToWin: 0,
      killPoints: 0,
      zonePoints: 0,
      controlRoundPoint: 0,
      maxRounds: 0,
      teamSize: 1,
      mapSize: 13
    }

  };

  function getCrucibleModeSpec(mode) {
    var key = String(mode || '').toLowerCase();
    return CRUCIBLE_MODE_SPECS[key] || CRUCIBLE_MODE_SPECS.control;
  }

  function getCrucibleModeTeamSize(modeId) {
    var spec = getCrucibleModeSpec(modeId);
    return Math.max(2, Number(spec.teamSize || 3));
  }

  function getCrucibleShopLootPool() {
    var data = (typeof SHOP_DATA !== 'undefined' && SHOP_DATA) ? SHOP_DATA : {};
    var pool = [];
    ['weapons', 'weapon_mods', 'armor', 'items', 'essentials'].forEach(function (key) {
      var list = Array.isArray(data[key]) ? data[key] : [];
      for (var i = 0; i < list.length; i++) {
        var entry = list[i];
        if (!entry || !entry.name) continue;
        pool.push({
          name: String(entry.name),
          stat: entry.stat ? String(entry.stat) : '',
          cat: String(key)
        });
      }
    });
    return pool;
  }

  function getCrucibleArmorActionCountFromStat(statText) {
    var text = String(statText || '').toLowerCase();
    var m = text.match(/(\d+)\s*actions?/i);
    if (m && m[1]) return Math.max(1, Math.min(4, Number(m[1] || 2)));
    if (text.indexOf('light') >= 0) return 3;
    if (text.indexOf('heavy') >= 0) return 1;
    return 2;
  }

  function getCrucibleWeaponRangeFromStat(statText) {
    var text = String(statText || '').toLowerCase();
    if (!text) return 2;
    if (text.indexOf('engaged') >= 0) return 1;
    if (text.indexOf('close') >= 0) return 2;
    if (text.indexOf('nearby') >= 0) return 3;
    if (text.indexOf('far') >= 0) return 4;
    return 2;
  }

  function getCrucibleUnitAttackMaxRange(unit) {
    if (!unit) return 2;
    var statText = unit.equipment && unit.equipment.weapon
      ? String(unit.equipment.weapon.statText || unit.equipment.weapon.roll || '')
      : '';
    return getCrucibleWeaponRangeFromStat(statText);
  }

  function getCrucibleRangeActionHint(distance, maxRange) {
    var dist = Math.max(0, Number(distance || 0));
    var cap = Math.max(1, Number(maxRange || 2));
    if (dist === 1) return 'Engaged · Strike';
    if (dist <= cap) return (dist === 2 ? 'Close' : (dist === 3 ? 'Nearby' : 'Far')) + ' · Shoot';
    return 'Out of Range';
  }

  function buildCrucibleLoadoutFromShop(name) {
    var pool = getCrucibleShopLootPool();
    var wanted = String(name || '').toLowerCase();
    var found = pool.find(function (entry) {
      return String(entry && entry.name || '').toLowerCase() === wanted;
    }) || null;
    return found ? {
      name: String(found.name || name || 'Weapon'),
      statText: String(found.stat || ''),
      affinity: Math.max(0, Number((String(found.stat || '').match(/\+(\d+)/) || [0, 1])[1] || 1)),
      range: getCrucibleWeaponRangeFromStat(found.stat),
      cat: String(found.cat || '')
    } : {
      name: String(name || 'Weapon'),
      statText: '+1 Shoot | Nearby',
      affinity: 1,
      range: 3,
      cat: 'weapons'
    };
  }

  function applyCrucibleControlLoadout(unit, armorLabel, weaponName) {
    if (!unit) return;
    var armorName = String(armorLabel || 'Balanced Armor');
    var armorStat = armorName.toLowerCase().indexOf('light') >= 0
      ? 'Ad4 | 3 Actions'
      : (armorName.toLowerCase().indexOf('heavy') >= 0 ? 'Ad10 | 1 Action' : 'Ad6 | 2 Actions');
    var maxAp = getCrucibleArmorActionCountFromStat(armorStat);
    var weaponRaw = String(weaponName || 'Sword').toLowerCase();
    var weaponPreset = {
      name: 'Sword',
      statText: '+2 Strike | Engaged',
      affinity: 2,
      range: 1,
      cat: 'weapons'
    };
    if (weaponRaw.indexOf('shotgun') >= 0) {
      weaponPreset = {
        name: 'Shotgun',
        statText: '+2 Shoot | Nearby',
        affinity: 2,
        range: 3,
        cat: 'weapons'
      };
    } else if (weaponRaw.indexOf('spell') >= 0 || weaponRaw.indexOf('focus') >= 0) {
      weaponPreset = {
        name: 'Spell Focus',
        statText: '+2 Control | Close',
        affinity: 2,
        range: 2,
        cat: 'weapons'
      };
    }
    unit.hp = 8;
    unit.maxHp = 8;
    unit.attackDie = 4;
    unit.defendDie = 4;
    unit.maxAp = maxAp;
    unit.ap = maxAp;
    unit.equipment = unit.equipment || { weapon: null, armor: null };
    unit.equipment.armor = {
      name: armorName,
      statText: armorStat,
      actions: maxAp
    };
    unit.equipment.weapon = weaponPreset;
  }

  function seedCrucibleControlMapFeatures(map) {
    if (!map || !map.hexes) return false;
    var pool = getCrucibleShopLootPool();
    var keys = Object.keys(map.hexes);
    var open = keys.filter(function (key) {
      var cell = map.hexes[key];
      return !!cell && !cell.obstacle && !cell.door && !cell.zone;
    });
    if (!open.length) return false;

    // Control mode removes traps and all non-control objective gimmicks.
    keys.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.trap = null;
      if (cell.terrain === 'trap' || cell.terrain === 'ruin' || cell.terrain === 'temple' || cell.terrain === 'gate') {
        cell.terrain = 'open';
      }
    });

    // Upgrade generic loot nodes to Merchant-pool drops and add limited affix uses.
    open.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell || !cell.loot) return;
      var pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (!pick) return;
      cell.loot = {
        type: String(pick.cat || 'items'),
        bonus: 1,
        item: {
          name: String(pick.name || 'Loot'),
          stat: String(pick.stat || ''),
          cat: String(pick.cat || ''),
          uses: 3
        }
      };
      cell.terrain = 'loot';
    });

    // Add guaranteed full-heal supply drops.
    var healCount = Math.max(1, Math.floor(open.length / 28));
    for (var h = 0; h < healCount; h++) {
      if (!open.length) break;
      var healIdx = Math.floor(Math.random() * open.length);
      var healKey = open.splice(healIdx, 1)[0];
      var healCell = map.hexes[healKey];
      if (!healCell || healCell.zone || healCell.obstacle || healCell.door) continue;
      healCell.loot = {
        type: 'hp_vial',
        bonus: 99,
        item: { name: 'Full Restore', stat: 'Restore to full HP', cat: 'essentials', uses: 1 }
      };
      healCell.terrain = 'loot';
    }

    // Place a few random teleport hexes.
    var teleCount = Math.max(1, Math.min(3, Math.floor(open.length / 35)));
    for (var i = 0; i < teleCount; i++) {
      if (!open.length) break;
      var idx = Math.floor(Math.random() * open.length);
      var key = open.splice(idx, 1)[0];
      var cell = map.hexes[key];
      if (!cell || cell.loot || cell.zone || cell.obstacle || cell.door) continue;
      cell.teleport = { active: true };
      cell.terrain = 'portal';
    }
    return true;
  }

  function rollCrucibleExpeditionAffix() {
    var affixes = ['Ashbound', 'Moonchained', 'Thornwake', 'Hollowglass', 'Dreadforged', 'Graven', 'Saltfire', 'Umbral'];
    return affixes[Math.floor(Math.random() * affixes.length)] || 'Ashbound';
  }

  function addCrucibleItemToBackpack(itemName) {
    if (!itemName) return false;
    if (!Array.isArray(S.backpack)) S.backpack = Array(10).fill('');
    var slot = S.backpack.indexOf('');
    if (slot < 0) return false;
    S.backpack[slot] = String(itemName);
    if (typeof renderBackpackUI === 'function') renderBackpackUI();
    return true;
  }

  function getCrucibleExpeditionRaidBossName() {
    var pool = ['Azrael', 'Mephisto', 'The Hollow Saint', 'The Bone Regent', 'The Blackened Throne', 'The Rift Shepherd'];
    return pool[Math.floor(Math.random() * pool.length)] || 'Azrael';
  }

  function pickCrucibleExpeditionEnemyProfile(kind) {
    var key = String(kind || '').toLowerCase();
    var table = {
      field: [
        { name: 'Mire Hound', look: 'A six-legged scavenger wrapped in rusted ritual bells.', desc: 'It hunts by sound and lunges when armor scrapes.' },
        { name: 'Lantern Wretch', look: 'A thin pilgrim shape carrying a lantern with no flame.', desc: 'The light is gone, but shadows still obey it.' },
        { name: 'Ash Drifter', look: 'A drifting humanoid shape stitched with soot-black cloth.', desc: 'Its footprints appear before it moves.' },
        { name: 'Bone Orchard Stalker', look: 'A hunter in antlered bone plates and cracked blue paint.', desc: 'Every joint clicks like prayer beads.' }
      ],
      mini: [
        { name: 'The Gallow-Archivist', look: 'A masked giant hauling chained codices.', desc: 'It catalogs survivors as if they were relics.' },
        { name: 'Salt Widow', look: 'A knight-figure in salt-crusted mourning veils.', desc: 'Its blade leaves dry riverbeds in stone.' },
        { name: 'Basilica Warden', look: 'A cathedral sentinel fused with cracked altar iron.', desc: 'It punishes greed, then loots the dead.' },
        { name: 'Hollow Harbormaster', look: 'A drowned captain wrapped in harbor chains.', desc: 'Its whistle calls storms inside your lungs.' }
      ],
      fieldboss: [
        { name: 'Ruin Butcher', look: 'A giant carrion-knight draped in broken banners.', desc: 'It marks each kill with a church bell chord.' },
        { name: 'Gate Devourer', look: 'A hulking maw-creature wrapped in snapped portcullis chains.', desc: 'It gnaws iron and spits sparks over the province road.' }
      ],
      portal: [
        { name: 'Portal Thrall', look: 'A warped soldier leaking black light from split armor seams.', desc: 'It crawls out of the breach before remembering gravity.' },
        { name: 'Rift Whelp', look: 'A thin predator with too many knees and no shadow.', desc: 'It shakes when the portal screams.' }
      ],
      day1: [
        { name: 'The Iron Chancel', look: 'A kneeling war-idol with a furnace where its face should be.', desc: 'A cathedral engine that never accepted peace.' },
        { name: 'Crown of Thorns', look: 'A crowned executioner in living briar mail.', desc: 'It remembers every oath broken in this province.' }
      ],
      day2: [
        { name: 'The Drowned Regent', look: 'A monarch-shaped silhouette burning underwater.', desc: 'Its throne sank, but its court still kneels.' },
        { name: 'Moonchain Colossus', look: 'A giant knight dragged by chains hooked into the sky.', desc: 'Each step tightens a chain no one can see.' }
      ],
      raid: [
        { name: 'Azrael', look: 'A wingless judge wrapped in fractured sun-metal.', desc: 'It pronounces verdicts with a sword of daylight.' },
        { name: 'Mephisto', look: 'A horned sovereign wreathed in ember-black scripture.', desc: 'It bargains with your future while it attacks.' },
        { name: 'The Blackened Throne', look: 'A king seated on a moving throne of charred roots.', desc: 'The throne chooses who burns first.' }
      ]
    };
    var pool = table[key] || table.field;
    return pool[Math.floor(Math.random() * pool.length)] || pool[0];
  }

  function getHexRadiusFromMap(map) {
    if (!map || !map.hexes) return 0;
    var maxDist = 0;
    Object.keys(map.hexes).forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      var dist = Math.max(Math.abs(Number(cell.q || 0)), Math.abs(Number(cell.r || 0)), Math.abs(Number(cell.q || 0) + Number(cell.r || 0)));
      if (dist > maxDist) maxDist = dist;
    });
    return maxDist;
  }

  function stampCrucibleTemplesOnMap(map, count) {
    if (!map || !map.hexes) return;
    var keys = Object.keys(map.hexes).filter(function (key) {
      var cell = map.hexes[key];
      return cell && !cell.obstacle && !cell.door && !cell.zone && !cell.trap && !cell.loot;
    });
    for (var i = 0; i < Math.min(Number(count || 0), keys.length); i++) {
      var pickIdx = Math.floor(Math.random() * keys.length);
      var key = keys.splice(pickIdx, 1)[0];
      var cell = map.hexes[key];
      if (!cell) continue;
      cell.terrain = 'temple';
      cell.temple = { used: false };
    }
  }

  function getCrucibleExpeditionProvinceBarrierHexes() {
    var state = null;
    if (typeof getProvinceMapState === 'function') {
      try { state = getProvinceMapState(); } catch (_err) { state = null; }
    }
    if (!state && typeof mapData !== 'undefined' && Array.isArray(mapData)) {
      state = { mapData: mapData };
    }
    var list = state && Array.isArray(state.mapData) ? state.mapData : [];
    return list.filter(function (hex) {
      return hex && String(hex.type || '').toLowerCase() === 'barrier';
    }).map(function (hex) {
      return { q: Number(hex.col || 0), r: Number(hex.row || 0) };
    });
  }

  function stampCrucibleExpeditionProvinceBarriers(map) {
    if (!map || !map.hexes) return [];
    var stamped = [];
    getCrucibleExpeditionProvinceBarrierHexes().forEach(function (hex) {
      var key = String(Number(hex.q || 0)) + ',' + String(Number(hex.r || 0));
      var cell = map.hexes[key];
      if (!cell || cell.obstacle || cell.door || cell.zone || cell.temple || cell.portal || cell.gate) return;
      cell.terrain = 'barrier';
      cell.obstacle = true;
      cell.barrier = { source: 'province', blocked: true, passToken: '' };
      stamped.push(key);
    });
    return stamped;
  }

  function getCrucibleExpeditionRandomDropHex(map) {
    if (!map || !map.hexes) return null;
    var keys = Object.keys(map.hexes).filter(function (key) {
      var cell = map.hexes[key];
      if (!cell) return false;
      if (cell.obstacle || cell.door || cell.zone || cell.temple || cell.portal || cell.gate) return false;
      return true;
    });
    if (!keys.length) return null;
    var pick = keys[Math.floor(Math.random() * keys.length)];
    var parts = String(pick).split(',');
    return { q: Number(parts[0] || 0), r: Number(parts[1] || 0), key: pick };
  }

  function seedCrucibleExpeditionMiniBossHexes(map, count) {
    if (!map || !map.hexes) return [];
    var ruinKeys = [];
    var otherKeys = [];
    Object.keys(map.hexes).forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell || cell.obstacle || cell.door || cell.zone || cell.temple) return;
      var ring = Math.max(Math.abs(Number(cell.q || 0)), Math.abs(Number(cell.r || 0)), Math.abs(Number(cell.q || 0) + Number(cell.r || 0)));
      if (ring < 2) return;
      if (String(cell.terrain || '') === 'ruin') ruinKeys.push(key);
      else otherKeys.push(key);
    });
    var out = [];
    for (var i = 0; i < Math.min(Number(count || 0), ruinKeys.length || otherKeys.length); i++) {
      var pool = ruinKeys.length ? ruinKeys : otherKeys;
      var idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }

  function pickCrucibleExpeditionFeatureHexes(map, count, blocker) {
    if (!map || !map.hexes) return [];
    var keys = Object.keys(map.hexes).filter(function (key) {
      var cell = map.hexes[key];
      if (!cell || cell.obstacle || cell.door || cell.zone) return false;
      if (cell.terrain === 'spawn' || cell.terrain === 'temple') return false;
      return typeof blocker === 'function' ? blocker(cell, key) : true;
    });
    var out = [];
    var cap = Math.max(0, Number(count || 0));
    for (var i = 0; i < cap && keys.length; i++) {
      var idx = Math.floor(Math.random() * keys.length);
      out.push(keys.splice(idx, 1)[0]);
    }
    return out;
  }

  function stampCrucibleExpeditionProvinceFeatures(map, day) {
    if (!map || !map.hexes) return { ruins: [], portals: [], gates: [], dwellings: [], holdings: [], tradeRoutes: [], lostCities: [], libraries: [], depths: [] };
    var useDay = Math.max(1, Number(day || 1));
    var ruins = pickCrucibleExpeditionFeatureHexes(map, 4, function (cell) {
      return !cell.trap && !cell.loot && !cell.portal && !cell.gate;
    });
    if (!ruins.length) {
      var fallbackRuins = pickCrucibleExpeditionFeatureHexes(map, 1, function (cell) {
        return String(cell.terrain || '') !== 'spawn' && String(cell.terrain || '') !== 'temple';
      });
      if (!fallbackRuins.length) {
        fallbackRuins = Object.keys(map.hexes).filter(function (key) {
          var cell = map.hexes[key];
          return cell && !cell.door && !cell.zone;
        }).slice(0, 1);
      }
      ruins = fallbackRuins;
    }
    ruins.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'ruin';
      cell.ruin = { searched: false };
    });

    var perils = pickCrucibleExpeditionFeatureHexes(map, 5, function (cell) {
      return !cell.trap && !cell.portal && !cell.gate;
    });
    perils.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'trap';
      cell.trap = cell.trap || { type: 'peril_hex', damageOnTrigger: 2 };
    });

    var gates = pickCrucibleExpeditionFeatureHexes(map, 5, function (cell) {
      return !cell.trap && !cell.loot && !cell.portal;
    });
    gates.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'gate';
      cell.gate = { closed: false, used: false };
    });

    var portalCount = useDay <= 2 ? 3 : 1;
    var portals = pickCrucibleExpeditionFeatureHexes(map, portalCount, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal;
    });
    portals.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'portal';
      cell.portal = { active: true, closed: false, day: useDay, puzzleSolved: false };
    });

    var dwellings = pickCrucibleExpeditionFeatureHexes(map, 3, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal && !cell.ruin;
    });
    dwellings.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'dwelling';
      cell.dwelling = { rested: false };
    });

    var holdings = pickCrucibleExpeditionFeatureHexes(map, 3, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal && !cell.ruin && !cell.dwelling;
    });
    holdings.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'holding';
      cell.holding = { used: false, cost: 100 };
    });

    var tradeRoutes = pickCrucibleExpeditionFeatureHexes(map, 2, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal && !cell.ruin && !cell.dwelling && !cell.holding;
    });
    tradeRoutes.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'trade_route';
      cell.tradeRoute = { used: false };
    });

    var lostCities = pickCrucibleExpeditionFeatureHexes(map, 1, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal && !cell.ruin && !cell.dwelling && !cell.holding && !cell.tradeRoute;
    });
    lostCities.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'lost_city';
      cell.lostCity = { explored: false };
    });

    var libraries = pickCrucibleExpeditionFeatureHexes(map, 1, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal && !cell.ruin && !cell.dwelling && !cell.holding && !cell.tradeRoute && !cell.lostCity;
    });
    libraries.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'library';
      cell.library = { consulted: false };
    });

    var depthsCount = useDay >= 2 ? 1 : 0;
    var depths = depthsCount > 0 ? pickCrucibleExpeditionFeatureHexes(map, depthsCount, function (cell) {
      return !cell.trap && !cell.loot && !cell.gate && !cell.portal && !cell.ruin && !cell.dwelling && !cell.holding && !cell.tradeRoute && !cell.lostCity && !cell.library;
    }) : [];
    depths.forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      cell.terrain = 'depths';
      cell.depths = { entered: false, floor: 1 };
    });

    stampCrucibleExpeditionVarietyTerrains(map);
    return { ruins: ruins, portals: portals, gates: gates, dwellings: dwellings, holdings: holdings, tradeRoutes: tradeRoutes, lostCities: lostCities, libraries: libraries, depths: depths };
  }

  // Province/season-based terrain pools
  var PROVINCE_TERRAIN_POOLS = {
    "Northland": {
      spring: ['SnowyFields', 'SnowyForest', 'SnowySwamp', 'SnowyTown', 'Rift', 'Stones', 'Lake', 'Town'],
      harvest: ['SnowyFields', 'SnowyForest', 'SnowySwamp', 'SnowyTown', 'Rift', 'Stones', 'Lake', 'Town'],
      winter: ['SnowyFields', 'SnowyForest', 'SnowySwamp', 'SnowyTown', 'Rift', 'Stones', 'Lake', 'Town']
    },
    "Desertia": {
      spring: ['DesertMountain', 'DesertCave', 'AshWastes', 'Farm', 'DesertFarm', 'Ravine', 'City', 'Town'],
      harvest: ['DesertMountain', 'DesertCave', 'AshWastes', 'Farm', 'DesertFarm', 'Ravine', 'City', 'Town'],
      winter: ['DesertMountain', 'DesertCave', 'AshWastes', 'Farm', 'DesertFarm', 'Ravine', 'City', 'Town']
    },
    "Midlands": {
      spring: ['Field', 'Forest', 'Swamp', 'Lake', 'Farm', 'Rift', 'Stones', 'Town', 'City'],
      harvest: ['Field', 'Forest', 'Swamp', 'Lake', 'Farm', 'Rift', 'Stones', 'Town', 'City'],
      winter: ['Snowfield', 'DeadForest', 'FrostMarsh', 'Field', 'Forest', 'Lake', 'Town']
    }
    // Add more provinces as needed
  };

  var DEFAULT_TERRAIN_POOL = ['Field', 'Forest', 'Swamp', 'Lake', 'Farm', 'Rift', 'Stones', 'DesertMountain', 'DesertCave', 'Ravine', 'City', 'Town', 'SnowyTown', 'SnowyFields', 'SnowyForest', 'SnowySwamp'];

  var TERRAIN_DESCRIPTOR_KEY_ALIASES = {
    marsh: 'Marsh',
    forest: 'Forest',
    valley: 'Valley',
    lake: 'Lake',
    mountain: 'Mountain',
    desert: 'Desert',
    hills: 'Hills',
    meadow: 'Meadow',
    heath: 'Heath',
    crags: 'Crags',
    bog: 'Bog',
    glades: 'Glades',
    snowfield: 'Snowfield',
    deadforest: 'DeadForest',
    ashwastes: 'AshWastes',
    frostmarsh: 'FrostMarsh',
    rift: 'Rift',
    stones: 'Stones',
    desertmountain: 'DesertMountain',
    farm: 'Farm',
    desertfarm: 'DesertFarm',
    desertcave: 'DesertCave',
    ravine: 'Ravine',
    city: 'City',
    town: 'Town',
    snowytown: 'SnowyTown',
    snowyfields: 'SnowyFields',
    snowyforest: 'SnowyForest',
    snowyswamp: 'SnowySwamp',
    dwelling: 'Dwelling',
    temple: 'Temple',
    library: 'Library',
    depths: 'Depths',
    ruins: 'Ruins',
    holding: 'Holding',
    traderoute: 'TradeRoute',
    gate: 'Gate',
    peril: 'Peril',
    seat: 'Seat',
    trade: 'Trade',
    monument: 'Monument',
    lostcity: 'LostCity'
  };

  function normalizeTerrainNameToken(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function resolveTerrainDescriptorKey(value) {
    var src = String(value || '').trim();
    if (!src) return 'Hills';
    if (typeof TERRAIN_DESC !== 'undefined' && TERRAIN_DESC && TERRAIN_DESC[src]) return src;
    var aliased = TERRAIN_DESCRIPTOR_KEY_ALIASES[normalizeTerrainNameToken(src)] || '';
    if (aliased && typeof TERRAIN_DESC !== 'undefined' && TERRAIN_DESC && TERRAIN_DESC[aliased]) return aliased;
    return src;
  }

  function descriptorKeyToMapTerrainKey(name) {
    var canonical = resolveTerrainDescriptorKey(name);
    return String(canonical || 'hills').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  }

  // Returns the allowed terrain pool for a province and season
  function getProvinceTerrainPool(provinceName, season) {
    var p = PROVINCE_TERRAIN_POOLS[String(provinceName)];
    if (p && p[season]) return p[season];
    if (p && p.spring) return p.spring;
    return DEFAULT_TERRAIN_POOL;
  }

  function stampCrucibleExpeditionVarietyTerrains(map, provinceName, season) {
    if (!map || !map.hexes) return;
    var SPECIAL = ['ruin','trap','temple','barrier','gate','portal','dwelling','holding','trade_route','lost_city','library','depths'];
    var seed = Math.max(1, Number(map.seed || 1));
    var activeProvince = String(provinceName || map.provinceName || (S && S.holding && S.holding.provinceName) || 'Midlands');
    var activeSeason = String(season || (S && S.currentSeason) || 'spring').toLowerCase();
    if (activeSeason !== 'spring' && activeSeason !== 'harvest' && activeSeason !== 'winter') activeSeason = 'spring';
    var pool = getProvinceTerrainPool(activeProvince, activeSeason);
    var n = pool.length;
    Object.keys(map.hexes).forEach(function (k) {
      var cell = map.hexes[k];
      if (!cell) return;
      if (SPECIAL.indexOf(cell.terrain) !== -1) return;
      if (cell.trap || cell.barrier) return;
      var q = Number(cell.q || 0);
      var r = Number(cell.r || 0);
      // Use a coarse cluster grid so nearby hexes share terrain (natural biome patches)
      var cq = Math.round(q / 2);
      var cr = Math.round(r / 2);
      var h = Math.abs(Math.sin(cq * 439.7 + cr * 317.3 + seed * 71.11));
      var idx = Math.floor((h - Math.floor(h)) * n) % n;
      var descriptorKey = resolveTerrainDescriptorKey(pool[idx]);
      cell.provinceTerrainName = descriptorKey;
      cell.terrain = descriptorKeyToMapTerrainKey(descriptorKey);
    });
  }

  function ensureCrucibleExpeditionProvinceMetadata(map, day) {
    if (!map || !map.hexes) return;
    var useDay = Math.max(1, Number(day || 1));
    var terrainPool = (typeof TERRAIN_TYPES !== 'undefined' && Array.isArray(TERRAIN_TYPES) && TERRAIN_TYPES.length)
      ? TERRAIN_TYPES
      : [{ name: 'Hills', color: '#354027' }];
    var seed = Math.max(1, Number(map.seed || 1)) + (useDay * 97);
    Object.keys(map.hexes).forEach(function (key) {
      var cell = map.hexes[key];
      if (!cell) return;
      var q = Number(cell.q || 0);
      var r = Number(cell.r || 0);
      var h1 = Math.abs(Math.sin((q + 31) * 917 + (r + 17) * 613 + seed * 19));
      var h2 = Math.abs(Math.sin((q + 7) * 431 + (r + 41) * 263 + seed * 29));
      var tIdx = Math.floor((h1 - Math.floor(h1)) * terrainPool.length) % terrainPool.length;
      var picked = terrainPool[Math.max(0, tIdx)] || terrainPool[0];
      if (!cell.provinceTerrainName) cell.provinceTerrainName = resolveTerrainDescriptorKey(String((picked && picked.name) || 'Hills'));
      else cell.provinceTerrainName = resolveTerrainDescriptorKey(cell.provinceTerrainName);
      if (!cell.provinceTerrainColor) cell.provinceTerrainColor = String((picked && picked.color) || '#354027');
      if (!cell.weatherRoll) cell.weatherRoll = 1 + (Math.floor((h2 - Math.floor(h2)) * 6) % 6);
    });
  }

  function getCrucibleExpeditionCellFromPlayer(match) {
    if (!match || !match.hexMap || !match.hexMap.hexes) return null;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) return null;
    var key = String(player.position.q) + ',' + String(player.position.r);
    return match.hexMap.hexes[key] || null;
  }

  function getCrucibleExpeditionCellKey(cell) {
    if (!cell) return '';
    return String(Number(cell.q || 0)) + ',' + String(Number(cell.r || 0));
  }

  function isCrucibleExpeditionCellCleared(match, cell) {
    if (!match || !match.expedition || !cell) return false;
    var key = getCrucibleExpeditionCellKey(cell);
    var cleared = match.expedition.clearedHexes || {};
    if (cleared[key]) return true;
    if (cell.ruin && cell.ruin.searched) return true;
    if (cell.portal && cell.portal.closed) return true;
    if (cell.gate && cell.gate.closed) return true;
    return false;
  }

  function getCrucibleExpeditionCellStatus(match, cell) {
    if (!cell) return { label: 'Unknown', tone: 'var(--muted2)', detail: 'No active hex.' };
    if (isCrucibleExpeditionCellCleared(match, cell)) {
      return { label: 'Cleared', tone: 'var(--green2)', detail: 'This hex has been resolved for this day.' };
    }
    if (cell.portal && !cell.portal.closed) {
      return { label: 'Active Threat', tone: 'var(--red2)', detail: 'Portal breach is still open.' };
    }
    if (cell.gate && !cell.gate.closed) {
      return { label: 'Unsealed Gate', tone: 'var(--gold2)', detail: 'Gate interaction available.' };
    }
    if (cell.ruin && !cell.ruin.searched) {
      return { label: 'Uncleared Ruin', tone: 'var(--orange)', detail: 'Ruin crawl is available.' };
    }
    return { label: 'Unscouted', tone: 'var(--teal)', detail: 'Roll encounter to scout this hex.' };
  }

  function getCrucibleExpeditionBiomeLine(flora, fauna) {
    var f1 = String(flora || '').replace(/\.$/, '').trim();
    var f2 = String(fauna || '').replace(/\.$/, '').trim();
    if (!f1 && !f2) return 'No notable signs.';
    if (!f1) return f2 + '.';
    if (!f2) return f1 + '.';
    return f1 + '; ' + f2 + '.';
  }

  function pickCrucibleExpeditionStableText(list, cell, channel) {
    if (!Array.isArray(list) || !list.length) return '';
    var c = cell || {};
    var q = Number(c.q || 0);
    var r = Number(c.r || 0);
    var h = Math.abs(Math.sin((q + 53) * 877 + (r + 11) * 487 + String(channel || 'base').length * 211));
    var idx = Math.floor((h - Math.floor(h)) * list.length) % list.length;
    return String(list[Math.max(0, idx)] || list[0] || '');
  }

  function escapeCrucibleExpeditionHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildCrucibleExpeditionProvinceDescriptorHtml(match) {
    if (!match || !match.hexMap || !match.hexMap.hexes || String(match.mode || '') !== 'expedition') return '';
    var cell = getCrucibleExpeditionCellFromPlayer(match);
    if (!cell) return '';
    var terrainName = resolveTerrainDescriptorKey(cell.provinceTerrainName || cell.terrain || 'Hills');
    var td = (typeof TERRAIN_DESC !== 'undefined' && TERRAIN_DESC && TERRAIN_DESC[terrainName])
      ? TERRAIN_DESC[terrainName]
      : { land: ['Open land.'], sky: ['Grey and still.'], water: ['No visible water.'], flora: ['Sparse growth.'], fauna: ['No readings.'], wonder: ['A half-buried monument.'] };
    var season = String((typeof S !== 'undefined' && S && S.currentSeason) ? S.currentSeason : 'spring');
    var weatherTable = (typeof WEATHER !== 'undefined' && WEATHER && Array.isArray(WEATHER[season])) ? WEATHER[season] : [];
    var wr = Math.max(1, Math.min(6, Number(cell.weatherRoll || 1)));
    var weather = weatherTable[wr - 1] || { result: 'Still Air', desc: 'No immediate weather pressure.', rough: false };
    var land = pickCrucibleExpeditionStableText(Array.isArray(td.land) ? td.land : [String(td.land || 'Open land.')], cell, 'land');
    var flora = pickCrucibleExpeditionStableText(Array.isArray(td.flora) ? td.flora : [String(td.flora || 'Sparse growth.')], cell, 'flora');
    var fauna = pickCrucibleExpeditionStableText(Array.isArray(td.fauna) ? td.fauna : [String(td.fauna || 'No known fauna.')], cell, 'fauna');
    var wonder = pickCrucibleExpeditionStableText(Array.isArray(td.wonder) ? td.wonder : [String(td.wonder || 'A weathered structure.')], cell, 'wonder');
    var status = getCrucibleExpeditionCellStatus(match, cell);
    var biomeLine = getCrucibleExpeditionBiomeLine(flora, fauna);
    var rollLabel = String(status.label || '') === 'Cleared' ? 'Recheck Encounter' : 'Roll Encounter';
    var contextual = '';
    if (cell.portal && !cell.portal.closed) {
      contextual = (match.expedition && String(match.expedition.phase || '') === 'portalPuzzle')
        ? '<button class="btn btn-sm btn-red" onclick="holdingCrucibleSolvePortalPuzzle();">Close Portal (Pipe Puzzle)</button>'
        : '<button class="btn btn-sm btn-red" onclick="holdingCrucibleBreachExpeditionPortal();">Breach Portal</button>';
    }
    return ''
      + '<div class="card" style="margin-top:.35rem;">'
      + '<div class="section-title">Province Detail</div>'
      + '<div class="theos-region-kicker">' + escapeCrucibleExpeditionHtml(terrainName) + ' · Day ' + escapeCrucibleExpeditionHtml(String(match.expedition && match.expedition.day || 1)) + '</div>'
      + '<p class="theos-region-copy">Nightreign-style scout brief for the active hex.</p>'
      + '<div class="theos-chip-row">'
      + '<span class="theos-chip">Status: <strong style="color:' + escapeCrucibleExpeditionHtml(status.tone) + ';font-weight:700;">' + escapeCrucibleExpeditionHtml(status.label) + '</strong></span>'
      + '<span class="theos-chip">Climate: ' + escapeCrucibleExpeditionHtml(season.charAt(0).toUpperCase() + season.slice(1)) + '</span>'
      + '<span class="theos-chip">Weather: ' + escapeCrucibleExpeditionHtml(String(weather.result || 'Unknown')) + '</span>'
      + '</div>'
      + '<div class="theos-kv-grid">'
      + '<div><strong>Land</strong><span>' + escapeCrucibleExpeditionHtml(land) + '</span></div>'
      + '<div><strong>Fauna &amp; Flora</strong><span>' + escapeCrucibleExpeditionHtml(biomeLine) + '</span></div>'
      + '<div><strong>Wonder</strong><span>' + escapeCrucibleExpeditionHtml(wonder) + '</span></div>'
      + '<div><strong>Route Note</strong><span>' + escapeCrucibleExpeditionHtml(String(status.detail || 'Scout the route.')) + '</span></div>'
      + '</div>'
      + '<div class="theos-region-actions">'
        + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExpeditionSearchHex();">' + escapeCrucibleExpeditionHtml(rollLabel) + '</button>'
        + contextual
      + '</div>'
      + '</div>';
  }

  function buildCrucibleExpeditionProvinceParityMapHtml(match, selectedUnit, reachableKeys) {
    if (!match || !match.hexMap || !match.hexMap.hexes) return '<div style="font-size:.74rem;color:var(--muted2);">No province map available.</div>';
    var map = match.hexMap;
    var collapsed = (match.expedition && match.expedition.collapsed) ? match.expedition.collapsed : {};
    var cells = Object.keys(map.hexes).map(function (k) { return map.hexes[k]; }).filter(Boolean);
    if (!cells.length) return '<div style="font-size:.74rem;color:var(--muted2);">No province map cells.</div>';
    var minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
    cells.forEach(function (c) {
      var q = Number(c.q || 0), r = Number(c.r || 0);
      if (q < minQ) minQ = q;
      if (q > maxQ) maxQ = q;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    });
    var size = 23;
    var w = 760;
    var h = 620;
    var qSpan = Math.max(1, maxQ - minQ + 1);
    var rSpan = Math.max(1, maxR - minR + 1);
    var xStep = size * 1.5;
    var yStep = Math.sqrt(3) * size;
    var mapW = qSpan * xStep + size * 2;
    var mapH = rSpan * yStep + size * 2 + yStep;
    var offX = (w - mapW) / 2 + size;
    var offY = (h - mapH) / 2 + size;
    var reach = {};
    (Array.isArray(reachableKeys) ? reachableKeys : []).forEach(function (k) { reach[String(k)] = true; });

    function points(cx, cy, r) {
      var pts = [];
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 30);
        pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
      }
      return pts.join(' ');
    }

    function toPx(cell) {
      var qOrig = Number(cell.q || 0);
      var rOrig = Number(cell.r || 0);
      return {
        x: offX + (qOrig - minQ) * xStep,
        y: offY + (rOrig - minR + (qOrig - minQ) * 0.5) * yStep
      };
    }

    var units = (match.allies || []).concat(match.enemies || []).filter(function (u) { return u && u.position && Number(u.hp || 0) > 0; });
    var highContrast = !!(match && match.expedition && match.expedition.highContrastOutline);
    var unitsByKey = {};
    units.forEach(function (u) {
      var key = String(Number(u.position.q || 0)) + ',' + String(Number(u.position.r || 0));
      if (!unitsByKey[key]) unitsByKey[key] = [];
      unitsByKey[key].push(u);
    });

    var svg = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-height:64vh;border:1px solid rgba(240,208,112,.45);background:radial-gradient(circle at 50% 42%, rgba(182,232,167,.55), rgba(113,188,214,.42) 42%, rgba(52,88,126,.35) 100%);border-radius:8px;margin-bottom:.2rem;"><defs>';
    var defs = '';
    var globalTiles = (typeof S !== 'undefined' && S && S.holding && S.holding.customHexTiles) ? S.holding.customHexTiles : {};
    var usedTypes = {};
    cells.forEach(function (cell) {
      var t = cell.terrain;
      if (t && globalTiles[t] && !usedTypes[t]) {
        usedTypes[t] = true;
        defs += '<pattern id="hexTile_' + t + '" x="0" y="0" width="' + (size * 2) + '" height="' + (size * 2) + '" patternUnits="userSpaceOnUse"><image href="' + globalTiles[t] + '" x="0" y="0" width="' + (size * 2) + '" height="' + (size * 2) + '" preserveAspectRatio="xMidYMid slice" /></pattern>';
      }
    });
    svg += defs + '</defs>';
    cells.forEach(function (cell, idx) {
      var k = String(Number(cell.q || 0)) + ',' + String(Number(cell.r || 0));
      var px = toPx(cell);
      var isCollapsed = !!collapsed[k];
      var customAsset = cell.terrain && globalTiles[cell.terrain] ? true : null;
      var fill = 'rgba(122,164,92,.84)';
      var stroke = 'rgba(30,62,94,.75)';
      var icon = '';
      if (isCollapsed) { fill = 'rgba(28,28,34,.95)'; stroke = 'rgba(160,70,70,.75)'; icon = '✖'; }
      else if (cell.terrain === 'ruin') { fill = customAsset ? 'url(#hexTile_ruin)' : 'rgba(64,56,48,.88)'; stroke = '#a09870'; icon = customAsset ? '' : '◫'; }
      else if (cell.trap && cell.trap.type === 'peril_hex') { fill = 'rgba(120,56,32,.88)'; stroke = '#e05050'; icon = '⚠'; }
      else if (cell.terrain === 'temple') { fill = customAsset ? 'url(#hexTile_temple)' : 'rgba(80,40,120,.88)'; stroke = '#b060d0'; icon = customAsset ? '' : '✦'; }
      else if (cell.terrain === 'barrier') { fill = 'rgba(236,198,74,.92)'; stroke = '#f0d070'; icon = '⛨'; }
      else if (cell.terrain === 'gate') { fill = customAsset ? 'url(#hexTile_gate)' : 'rgba(26,80,72,.9)'; stroke = '#2ec4b6'; icon = customAsset ? '' : '◆'; }
      else if (cell.terrain === 'portal') { fill = customAsset ? 'url(#hexTile_portal)' : 'rgba(90,16,64,.9)'; stroke = '#e080c0'; icon = customAsset ? '' : '⬡'; }
      else if (cell.terrain === 'dwelling') { fill = customAsset ? 'url(#hexTile_dwelling)' : 'rgba(46,120,74,.9)'; stroke = '#6ed090'; icon = customAsset ? '' : '⌂'; }
      else if (cell.terrain === 'holding') { fill = customAsset ? 'url(#hexTile_holding)' : 'rgba(120,84,34,.92)'; stroke = '#f0a840'; icon = customAsset ? '' : '⬢'; }
      else if (cell.terrain === 'trade_route') { fill = customAsset ? 'url(#hexTile_trade_route)' : 'rgba(180,148,60,.88)'; stroke = '#ffd060'; icon = customAsset ? '' : '↔'; }
      else if (cell.terrain === 'lost_city') { fill = customAsset ? 'url(#hexTile_lost_city)' : 'rgba(54,40,80,.92)'; stroke = '#c090ff'; icon = customAsset ? '' : '◬'; }
      else if (cell.terrain === 'library') { fill = customAsset ? 'url(#hexTile_library)' : 'rgba(32,60,80,.92)'; stroke = '#70b8e8'; icon = customAsset ? '' : '◩'; }
      else if (cell.terrain === 'depths') { fill = customAsset ? 'url(#hexTile_depths)' : 'rgba(10,10,20,.96)'; stroke = '#6040c0'; icon = customAsset ? '' : '⬟'; }
      // Variety / aesthetic terrain types
      else if (cell.terrain === 'field')           { fill = customAsset ? 'url(#hexTile_field)'           : 'rgba(88,164,60,.82)';  stroke = '#7ac848'; icon = customAsset ? '' : '≋'; }
      else if (cell.terrain === 'forest')          { fill = customAsset ? 'url(#hexTile_forest)'          : 'rgba(22,68,28,.88)';   stroke = '#3a8040'; icon = customAsset ? '' : '♣'; }
      else if (cell.terrain === 'swamp')           { fill = customAsset ? 'url(#hexTile_swamp)'           : 'rgba(44,68,38,.88)';   stroke = '#607050'; icon = customAsset ? '' : '≈'; }
      else if (cell.terrain === 'lake')            { fill = customAsset ? 'url(#hexTile_lake)'            : 'rgba(26,76,140,.88)';  stroke = '#4090d0'; icon = customAsset ? '' : '〜'; }
      else if (cell.terrain === 'farm')            { fill = customAsset ? 'url(#hexTile_farm)'            : 'rgba(160,180,56,.82)'; stroke = '#c8c040'; icon = customAsset ? '' : '⊞'; }
      else if (cell.terrain === 'rift')            { fill = customAsset ? 'url(#hexTile_rift)'            : 'rgba(72,16,20,.92)';   stroke = '#a02828'; icon = customAsset ? '' : '⌇'; }
      else if (cell.terrain === 'stones')          { fill = customAsset ? 'url(#hexTile_stones)'          : 'rgba(72,72,72,.88)';   stroke = '#a0a0a0'; icon = customAsset ? '' : '∷'; }
      else if (cell.terrain === 'desert_mountain') { fill = customAsset ? 'url(#hexTile_desert_mountain)' : 'rgba(152,114,52,.88)'; stroke = '#d09848'; icon = customAsset ? '' : '△'; }
      else if (cell.terrain === 'desert_cave')     { fill = customAsset ? 'url(#hexTile_desert_cave)'     : 'rgba(96,68,24,.88)';   stroke = '#b07838'; icon = customAsset ? '' : '⎔'; }
      else if (cell.terrain === 'ravine')          { fill = customAsset ? 'url(#hexTile_ravine)'          : 'rgba(52,32,16,.9)';    stroke = '#7a5030'; icon = customAsset ? '' : '⊸'; }
      else if (cell.terrain === 'city')            { fill = customAsset ? 'url(#hexTile_city)'            : 'rgba(56,68,78,.88)';   stroke = '#90a0b0'; icon = customAsset ? '' : '⬜'; }
      else if (cell.terrain === 'town')            { fill = customAsset ? 'url(#hexTile_town)'            : 'rgba(116,74,36,.86)';  stroke = '#d09850'; icon = customAsset ? '' : '⌸'; }
      else if (cell.terrain === 'snowy_town')      { fill = customAsset ? 'url(#hexTile_snowy_town)'      : 'rgba(180,200,224,.82)'; stroke = '#90b8d8'; icon = customAsset ? '' : '❄'; }
      else if (cell.terrain === 'snowy_fields')    { fill = customAsset ? 'url(#hexTile_snowy_fields)'    : 'rgba(200,218,240,.78)'; stroke = '#88b0d0'; icon = customAsset ? '' : '·'; }
      else if (cell.terrain === 'snowy_forest')    { fill = customAsset ? 'url(#hexTile_snowy_forest)'    : 'rgba(38,76,48,.86)';   stroke = '#88b098'; icon = customAsset ? '' : '❄'; }
      else if (cell.terrain === 'snowy_swamp')     { fill = customAsset ? 'url(#hexTile_snowy_swamp)'     : 'rgba(68,90,96,.86)';   stroke = '#80a0a8'; icon = customAsset ? '' : '≈'; }
      else {
        fill = String(cell.provinceTerrainColor || '#1a2010');
      }
      var canClick = !!reach[k] && !isCollapsed;
      var clearedHex = !isCollapsed && isCrucibleExpeditionCellCleared(match, cell);
      var strokeWidth = highContrast ? (canClick ? '2.8' : '2') : (canClick ? '2' : '1.1');
      var strokeColor = highContrast ? (canClick ? '#ffffff' : '#f4f4f4') : (canClick ? '#f0d070' : stroke);
      var clickAttr = canClick ? (' onclick="return window.holdingCrucibleExpeditionMoveTo(' + Number(cell.q || 0) + ',' + Number(cell.r || 0) + ')" style="cursor:pointer;"') : '';
      svg += '<g><polygon points="' + points(px.x, px.y, size) + '" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="' + strokeWidth + '"' + clickAttr + '/>';
      if (icon) svg += '<text x="' + px.x + '" y="' + (px.y + 4) + '" text-anchor="middle" font-size="' + (highContrast ? '13' : '12') + '" fill="' + (isCollapsed ? '#f2a3a3' : '#f5f0dd') + '" stroke="' + (highContrast ? '#000000' : 'rgba(0,0,0,.55)') + '" stroke-width="' + (highContrast ? '1.2' : '.65') + '" paint-order="stroke fill" pointer-events="none">' + icon + '</text>';
      if (clearedHex) svg += '<text x="' + (px.x + 10) + '" y="' + (px.y - 9) + '" text-anchor="middle" font-size="8" fill="#7ee38b" pointer-events="none">✓</text>';
      svg += '</g>';
    });

    units.forEach(function (u) {
      var px = toPx(u.position || { q: 0, r: 0 });
      var isPlayer = !!u.isPlayer;
      var unitColor = isPlayer ? '#f0d070' : (String(u.side || '') === 'ally' ? '#46de96' : '#eb626e');
      var unitClick = isPlayer
        ? ' onclick="selectHoldingCrucibleUnit(\'' + String(u.id || '').replace(/'/g, '&#39;') + '\')" style="cursor:pointer;"'
        : (String(u.side || '') === 'enemy' ? ' onclick="selectHoldingCrucibleEnemy(\'' + String(u.id || '').replace(/'/g, '&#39;') + '\')" style="cursor:pointer;"' : '');
      svg += '<g' + unitClick + '><circle cx="' + px.x + '" cy="' + px.y + '" r="8.8" fill="rgba(10,12,22,.95)" stroke="' + unitColor + '" stroke-width="' + (highContrast ? '2.1' : '1.7') + '"/>'
        + '<text x="' + px.x + '" y="' + (px.y + 3.1) + '" text-anchor="middle" font-size="8.2" fill="' + unitColor + '" stroke="' + (highContrast ? '#000000' : 'rgba(0,0,0,.6)') + '" stroke-width="' + (highContrast ? '.9' : '.5') + '" paint-order="stroke fill">' + String(u.name || 'U').charAt(0).toUpperCase() + '</text>'
        + (isPlayer ? ('<text x="' + px.x + '" y="' + (px.y - 11) + '" text-anchor="middle" font-size="6.2" fill="#f0d070">YOU</text>') : '')
        + '</g>';
    });

    svg += '</svg>';
    svg += '<div style="display:flex;gap:.16rem;flex-wrap:wrap;font-size:.66rem;color:var(--muted2);line-height:1.35;margin-top:.04rem;">'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">YOU = active Wayfarer</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">Gold border = reachable move</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">◫ Ruins</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">⚠ Peril</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">⛨ Barrier</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">◆ Gate</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">⬡ Portal</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">⌂ Dwelling / ⬢ Holding</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">✓ Cleared hex</span>'
      + '<span style="border:1px solid var(--border2);padding:.08rem .18rem;">✖ Collapsed edge</span>'
      + '</div>';
    return svg;
  }

  // Global per-terrain-type hex tile image configurator
  window.openProvinceHexTileConfigurator = function() {
    var TERRAIN_TYPES = [
      { key: 'ruin',            label: 'Ruins',         icon: '◫' },
      { key: 'temple',          label: 'Temple',        icon: '✦' },
      { key: 'gate',            label: 'Gate',          icon: '◆' },
      { key: 'portal',          label: 'Portal',        icon: '⬡' },
      { key: 'dwelling',        label: 'Dwelling',      icon: '⌂' },
      { key: 'holding',         label: 'Holding',       icon: '⬢' },
      { key: 'trade_route',     label: 'Trade Route',   icon: '↔' },
      { key: 'lost_city',       label: 'Lost City',     icon: '◬' },
      { key: 'library',         label: 'Library',       icon: '◩' },
      { key: 'depths',          label: 'Depths',        icon: '⬟' },
      { key: 'field',           label: 'Field',         icon: '≋' },
      { key: 'forest',          label: 'Forest',        icon: '♣' },
      { key: 'swamp',           label: 'Swamp',         icon: '≈' },
      { key: 'lake',            label: 'Lake',          icon: '〜' },
      { key: 'farm',            label: 'Farm',          icon: '⊞' },
      { key: 'rift',            label: 'Rift',          icon: '⌇' },
      { key: 'stones',          label: 'Stones',        icon: '∷' },
      { key: 'desert_mountain', label: 'Desert Mtn',   icon: '△' },
      { key: 'desert_farm',     label: 'Desert Farm',   icon: '⊞' },
      { key: 'desert_cave',     label: 'Desert Cave',   icon: '⎔' },
      { key: 'ravine',          label: 'Ravine',        icon: '⊸' },
      { key: 'city',            label: 'City',          icon: '⬜' },
      { key: 'town',            label: 'Town',          icon: '⌸' },
      { key: 'snowy_town',      label: 'Snowy Town',    icon: '❄' },
      { key: 'snowy_fields',    label: 'Snowy Fields',  icon: '·' },
      { key: 'snowy_forest',    label: 'Snowy Forest',  icon: '❄' },
      { key: 'snowy_swamp',     label: 'Snowy Swamp',   icon: '≈' }
    ];
    if (typeof S === 'undefined' || !S) { if (typeof showNotif === 'function') showNotif('State not ready.', 'warn'); return; }
    if (!S.holding) S.holding = {};
    if (!S.holding.customHexTiles) S.holding.customHexTiles = {};

    var existing = document.getElementById('hexTileConfiguratorModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'hexTileConfiguratorModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;';

    function buildModalInner() {
      var tiles = S.holding.customHexTiles;
      var rows = TERRAIN_TYPES.map(function(t) {
        var hasImg = !!tiles[t.key];
        var previewHtml = hasImg
          ? '<img src="' + tiles[t.key] + '" style="width:44px;height:44px;object-fit:cover;border-radius:4px;border:1px solid var(--border2,#444);" />'
          : '<div style="width:44px;height:44px;background:#1a1e28;border-radius:4px;border:1px dashed #444;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">' + t.icon + '</div>';
        return '<div style="display:flex;align-items:center;gap:.6rem;padding:.28rem 0;border-bottom:1px solid rgba(255,255,255,.06);">'
          + previewHtml
          + '<span style="min-width:5.5rem;font-size:.82rem;color:var(--text2,#ccc);">' + t.label + '</span>'
          + '<button class="btn btn-xs btn-teal" onclick="window._hexTileUpload(\'' + t.key + '\')">📸 ' + (hasImg ? 'Replace' : 'Upload') + '</button>'
          + (hasImg ? '<button class="btn btn-xs btn-red" onclick="window._hexTileClear(\'' + t.key + '\')">✕ Clear</button>' : '')
          + '</div>';
      }).join('');
      return '<div style="background:var(--surface,#12161f);border:1px solid var(--gold,#c8a840);border-radius:10px;padding:1.1rem 1.2rem;min-width:340px;max-width:420px;max-height:80vh;overflow-y:auto;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem;">'
        + '<span style="font-size:1rem;font-weight:700;color:var(--gold,#c8a840);">🎨 Configure Hex Tile Images</span>'
        + '<button class="btn btn-xs" onclick="document.getElementById(\'hexTileConfiguratorModal\').remove()">✕</button>'
        + '</div>'
        + '<p style="font-size:.74rem;color:var(--muted,#888);margin-bottom:.6rem;">Upload one image per terrain type — applied globally to all matching hexes on the Province map.</p>'
        + rows + '</div>';
    }

    modal.innerHTML = buildModalInner();
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    window._hexTileUpload = function(terrainKey) {
      var fi = document.createElement('input');
      fi.type = 'file'; fi.accept = 'image/*';
      fi.onchange = function(e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(evt) {
          if (!S.holding) S.holding = {};
          if (!S.holding.customHexTiles) S.holding.customHexTiles = {};
          S.holding.customHexTiles[terrainKey] = evt.target.result;
          if (typeof showNotif === 'function') showNotif('Hex tile image set for ' + terrainKey + '.', 'good');
          var m = document.getElementById('hexTileConfiguratorModal');
          if (m) m.innerHTML = buildModalInner();
          if (typeof renderHoldingCruciblePopup === 'function') renderHoldingCruciblePopup();
          if (typeof renderHoldingUI === 'function') renderHoldingUI();
        };
        reader.readAsDataURL(file);
      };
      fi.click();
    };

    window._hexTileClear = function(terrainKey) {
      if (S.holding && S.holding.customHexTiles) {
        delete S.holding.customHexTiles[terrainKey];
        if (typeof showNotif === 'function') showNotif('Hex tile image cleared for ' + terrainKey + '.', 'good');
        var m = document.getElementById('hexTileConfiguratorModal');
        if (m) m.innerHTML = buildModalInner();
        if (typeof renderHoldingCruciblePopup === 'function') renderHoldingCruciblePopup();
        if (typeof renderHoldingUI === 'function') renderHoldingUI();
      }
    };
  };

  function createCrucibleExpeditionState(hexMap) {
    var raidBoss = getCrucibleExpeditionRaidBossName();
    stampCrucibleExpeditionProvinceBarriers(hexMap);
    var stamped = stampCrucibleExpeditionProvinceFeatures(hexMap, 1);
    return {
      active: true,
      uiTab: 'province',
      day: 1,
      phase: 'explore',
      clickedHexes: 0,
      collapseEveryClicks: 6,
      currentPartyIndex: 0,
      roundActionsTaken: 0,
      roundClosesEdges: true,
      partyRound: 1,
      visitedHexes: {},
      collapseRing: 0,
      maxRing: getHexRadiusFromMap(hexMap),
      collapsed: {},
      flasks: 3,
      maxFlasks: 7,
      portalsClosed: 0,
      gatesClosed: 0,
      portalQuestTarget: 5,
      raidBossNerfed: false,
      portalEvent: null,
      pendingPortalPuzzle: false,
      mapZoom: 1,
      highContrastOutline: false,
      provinceFeatures: stamped,
      clearedHexes: {},
      currentBossIndex: 0,
      currentCombatType: '',
      currentCombatProfile: null,
      pendingCombatActions: [],
      pendingCombatActionSeq: 0,
      miniBossHexKeys: seedCrucibleExpeditionMiniBossHexes(hexMap, 3),
      miniBossDefeated: {},
      reviveUsedByDay: {},
      runLoot: [],
      usedEnemyNames: {},
      equipped: { weapon: '', armor: '' },
      bosses: [
        { tier: 'day1', die: 8, hp: 16, type: 'boss1' },
        { tier: 'day2', die: 10, hp: 20, type: 'boss2' },
        { tier: 'raid', die: 20, hp: 40, type: 'raidboss', fixedName: raidBoss }
      ],
      loreSnippets: [
        'A castle hangs from broken chains above an empty floodplain.',
        'Skeletons kneel in formation around a throne that still burns underwater.',
        'A giant stone hand surfaces beneath the village chapel.'
      ],
      runLog: ['Expedition opened. The province remembers older maps than yours.']
    };
  }

  function buildCrucibleExpeditionWayfarerFromSheet(rosterEntry, idx, spawnHex, options) {
    var entry = rosterEntry || {};
    var character = entry.character || {};
    var stats = character.stats || {};
    var fallbackHealth = Math.max(8, Number((S && S.health) || 12));
    var wayfarer = {
      id: 'ally-player-' + String(idx + 1) + '-' + String(Date.now()),
      name: String(character.name || entry.name || ('Wayfarer ' + String(idx + 1))),
      side: 'ally',
      role: 'player',
      position: { q: Number(spawnHex && spawnHex.q || -1), r: Number(spawnHex && spawnHex.r || -1) },
      hp: Math.max(1, Number(character.health || fallbackHealth)),
      maxHp: Math.max(8, Number(character.maxHealth || character.health || fallbackHealth)),
      attackDie: Math.max(
        4,
        Number(stats.strike || 0),
        Number(stats.shoot || 0),
        getCrucibleStatDie('strike', 8),
        getCrucibleStatDie('shoot', 8)
      ),
      defendDie: Math.max(4, Number(stats.defend || getCrucibleStatDie('defend', 8))),
      ap: 2,
      isPlayer: true,
      isPrimaryPlayer: !!(options && options.isPrimaryPlayer),
      campaignToken: String(entry.token || ''),
      personalFlavor: null,
      conditions: {},
      equipment: { weapon: null, armor: null }
    };
    var flavorSource = '';
    if (Array.isArray(character.personalFlavors) && character.personalFlavors.length) {
      flavorSource = String(character.personalFlavors[0] || '');
    } else if (character.flavor) {
      flavorSource = String(character.flavor || '');
    } else if (wayfarer.isPrimaryPlayer && S && S.flavor) {
      flavorSource = String(S.flavor || '');
    }
    if (flavorSource) {
      var flavorBits = flavorSource.split(':');
      wayfarer.personalFlavor = {
        name: String(flavorBits[0] || flavorSource).trim(),
        detail: String(flavorBits.slice(1).join(':') || '').trim(),
        full: flavorSource
      };
    }
    return wayfarer;
  }

  function isCrucibleExpeditionCampaignPartyMode() {
    if (typeof window !== 'undefined' && window.settingsSystem && typeof window.settingsSystem.isCampaignMode === 'function') {
      try {
        if (window.settingsSystem.isCampaignMode()) return true;
      } catch (_err) { console.error(_err); }
    }
    if (typeof window !== 'undefined' && window.campaignSystem && typeof window.campaignSystem.getState === 'function') {
      try {
        var campaignState = window.campaignSystem.getState();
        if (campaignState && campaignState.code) return true;
      } catch (_err) { console.error(_err); }
    }
    return false;
  }

  function getCrucibleExpeditionPartyRoster() {
    var roster = [];
    if (typeof window !== 'undefined' && window.campaignSystem && typeof window.campaignSystem.buildPartyRoster === 'function') {
      try {
        roster = window.campaignSystem.buildPartyRoster() || [];
      } catch (_err) {
        roster = [];
      }
    }
    if (!Array.isArray(roster) || !roster.length) {
      roster = [{
        token: 'local-wayfarer',
        name: String((S && S.name) || 'Wayfarer'),
        character: {
          name: String((S && S.name) || 'Wayfarer'),
          health: Number((S && S.health) || 12),
          maxHealth: Number((S && S.health) || 12),
          stats: (S && S.stats) ? Object.assign({}, S.stats) : {},
          flavor: String((S && S.flavor) || '')
        }
      }];
    }
    var localName = String((S && S.name) || '').trim().toLowerCase();
    roster.sort(function (a, b) {
      var aName = String(a && a.character && a.character.name || a && a.name || '').trim().toLowerCase();
      var bName = String(b && b.character && b.character.name || b && b.name || '').trim().toLowerCase();
      if (localName && aName === localName && bName !== localName) return -1;
      if (localName && bName === localName && aName !== localName) return 1;
      return 0;
    });

    if (isCrucibleExpeditionCampaignPartyMode()) {
      var fillerNames = ['Ash Vey', 'Talon Reeve', 'Mira Coil', 'Rune Vale'];
      var fillerFlavors = ['Teleportation', 'Ruin Scholar', 'Quick Draw', 'Holy Shield'];
      while (roster.length < 4) {
        var idx = roster.length;
        roster.push({
          token: 'expedition-filler-' + String(idx + 1),
          name: fillerNames[idx] || ('Wayfarer ' + String(idx + 1)),
          character: {
            name: fillerNames[idx] || ('Wayfarer ' + String(idx + 1)),
            health: 12,
            maxHealth: 12,
            stats: { strike: 8, shoot: 6, defend: 6, lead: 6, control: 6, body: 6, spirit: 6, mind: 6 },
            flavor: fillerFlavors[idx] || 'Lucky'
          }
        });
      }
    }
    return roster.slice(0, isCrucibleExpeditionCampaignPartyMode() ? 4 : 1);
  }

  function getCrucibleExpeditionParty(match) {
    return getLivingTeamUnits(match && match.allies).filter(function (unit) {
      return !!(unit && unit.isPlayer);
    });
  }

  function getCrucibleExpeditionPartySize(match) {
    return Math.max(1, getCrucibleExpeditionParty(match).length);
  }

  function getCrucibleExpeditionCurrentActor(match) {
    var expedition = match && match.expedition;
    var party = getCrucibleExpeditionParty(match);
    if (!party.length) return null;
    var idx = Math.max(0, Number(expedition && expedition.currentPartyIndex || 0));
    if (idx >= party.length) idx = 0;
    return party[idx] || party[0] || null;
  }

  function advanceCrucibleExpeditionPartyTurn(match, opts) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var expedition = match.expedition;
    var party = getCrucibleExpeditionParty(match);
    if (!party.length) return false;
    var options = opts || {};
    var currentIdx = Math.max(0, Number(expedition.currentPartyIndex || 0));
    var nextIdx = currentIdx + 1;
    var wrapped = false;
    if (nextIdx >= party.length) {
      nextIdx = 0;
      wrapped = true;
    }
    expedition.currentPartyIndex = nextIdx;
    expedition.roundActionsTaken = Math.max(0, Number(expedition.roundActionsTaken || 0) + 1);
    expedition.partyRound = Math.max(1, Number(expedition.partyRound || 1) + (wrapped ? 1 : 0));
    var nextActor = party[nextIdx] || party[0];
    if (nextActor) {
      match.selectedAllyId = String(nextActor.id || '');
      match.selectedAllyTargetId = String(nextActor.id || '');
    }
    if (wrapped && !options.skipCollapse) {
      var collapsedNow = collapseCrucibleExpeditionEdge(match);
      if (collapsedNow > 0) {
        match.log = (match.log || []).concat(['Night closes after the full party acts: ' + collapsedNow + ' edge hexes collapsed.']).slice(-120);
      }
    }
    return true;
  }

  function getUniqueCrucibleExpeditionEnemyName(expedition, baseName) {
    var name = String(baseName || 'Unknown Foe');
    if (!expedition) return name;
    expedition.usedEnemyNames = expedition.usedEnemyNames || {};
    if (!expedition.usedEnemyNames[name]) {
      expedition.usedEnemyNames[name] = 1;
      return name;
    }
    expedition.usedEnemyNames[name] += 1;
    return name + ' #' + String(expedition.usedEnemyNames[name]);
  }

  function getCrucibleExpeditionPlayer(match) {
    if (!match) return null;
    return getCrucibleExpeditionCurrentActor(match)
      || (match.allies || []).find(function (u) { return u && u.isPrimaryPlayer && Number(u.hp || 0) > 0; })
      || (match.allies || []).find(function (u) { return u && u.isPlayer && Number(u.hp || 0) > 0; })
      || null;
  }

  function getCrucibleExpeditionQueuedActions(match) {
    var expedition = match && match.expedition ? match.expedition : null;
    if (!expedition) return [];
    if (!Array.isArray(expedition.pendingCombatActions)) expedition.pendingCombatActions = [];
    return expedition.pendingCombatActions;
  }

  function clearCrucibleExpeditionQueuedActions(match) {
    if (!match || !match.expedition) return [];
    match.expedition.pendingCombatActions = [];
    match.expedition.pendingCombatActionSeq = 0;
    return match.expedition.pendingCombatActions;
  }

  function getCrucibleExpeditionQueuedActionCountForUnit(match, unitId) {
    return getCrucibleExpeditionQueuedActions(match).filter(function (entry) {
      return !!entry && String(entry.actorId || '') === String(unitId || '');
    }).length;
  }

  function chooseNextCrucibleExpeditionPlanner(match) {
    if (!match) return null;
    var next = getLivingTeamUnits(match.allies).find(function (unit) {
      return !!unit && Number(unit.ap || 0) > 0;
    }) || getSelectedCrucibleAlly(match) || getCrucibleExpeditionPlayer(match) || null;
    if (next) {
      match.selectedAllyId = String(next.id || '');
      match.selectedAllyTargetId = String(next.id || '');
    }
    return next;
  }

  function buildAutoCrucibleQueuedSpellMeta(actionKey, actor, target, seq) {
    if (!hasUnifiedSpellEngine || typeof hasUnifiedSpellEngine !== 'function' || !hasUnifiedSpellEngine()) return null;
    var kind = String(actionKey || 'spell').toLowerCase();
    var spellName = (kind === 'hack' ? 'Crucible Hack' : 'Crucible Spell')
      + ': ' + String(actor && actor.name || 'Caster')
      + ' -> ' + String(target && target.name || 'Target');
    var profile = getSpellCircumstanceProfile(spellName, 'Queued/AI Crucible action');
    var seedSource = spellName + '|' + String(actor && actor.id || '') + '|' + String(target && target.id || '') + '|' + String(seq || 0);
    var seed = (typeof hashSpellSeed === 'function')
      ? hashSpellSeed(seedSource)
      : Math.abs((function () {
          var acc = 0;
          for (var i = 0; i < seedSource.length; i++) acc = ((acc << 5) - acc) + seedSource.charCodeAt(i);
          return acc | 0;
        })());
    var answers = [];
    for (var idx = 0; idx < 4; idx++) {
      answers.push(((seed >> idx) & 1) ? 'yes' : 'no');
    }
    var circData = evaluateSpellCircumstances(profile, answers);
    circData.modifierLines = (circData.modifierLines || []).concat(['Pre-selected circumstance packet locked at queue time.']);
    var aoeModes = ['focused', 'standard', 'expanded'];
    var aoeMode = aoeModes[Math.abs(Number(seed || 0)) % aoeModes.length];
    return {
      profile: profile,
      circData: circData,
      answers: answers,
      source: 'queued-auto',
      aoeMode: aoeMode,
      aoeModeLocked: true
    };
  }

  function normalizeCrucibleQueuedAoeMode(value, fallback) {
    var raw = String(value || fallback || 'standard').trim().toLowerCase();
    if (raw === 'focus' || raw === 'f') raw = 'focused';
    if (raw === 'std' || raw === 's') raw = 'standard';
    if (raw === 'expand' || raw === 'e') raw = 'expanded';
    if (raw !== 'focused' && raw !== 'standard' && raw !== 'expanded') raw = String(fallback || 'standard');
    return raw;
  }

  function chooseCrucibleQueuedAoeModeInteractive(defaultMode) {
    var seed = normalizeCrucibleQueuedAoeMode(defaultMode, 'standard');
    if (typeof prompt !== 'function') return seed;
    var input = prompt('Queue AOE mode for delayed spell/hack resolution: focused, standard, or expanded.', seed);
    if (input === null) return null;
    return normalizeCrucibleQueuedAoeMode(input, seed);
  }

  function getCrucibleSpellAoePlan(mode, margin) {
    var m = Math.max(1, Number(margin || 1));
    var picked = normalizeCrucibleQueuedAoeMode(mode, 'standard');
    if (picked === 'focused') {
      return { mode: 'focused', targetCap: 1, statusCap: 1, valid: true };
    }
    if (picked === 'expanded') {
      return {
        mode: 'expanded',
        targetCap: 3,
        statusCap: 3,
        valid: m >= 4,
        fallback: 'standard',
        reason: 'Expanded mode requires margin 4+.'
      };
    }
    return { mode: 'standard', targetCap: 2, statusCap: 2, valid: true };
  }

  function applyCrucibleQueuedAoePacket(match, actor, primaryTarget, actionKind, margin, aoeMode, logs) {
    if (!match || !primaryTarget || Number(primaryTarget.hp || 0) <= 0) return null;
    var pool = getLivingTeamUnits(match.enemies || []);
    if (!pool.length) return null;
    var ordered = [primaryTarget];
    pool.forEach(function (entry) {
      if (entry && entry !== primaryTarget) ordered.push(entry);
    });

    var plan = getCrucibleSpellAoePlan(aoeMode, margin);
    if (!plan.valid && plan.fallback) {
      plan = getCrucibleSpellAoePlan(plan.fallback, margin);
      if (logs) logs.push((actor && actor.name ? actor.name : 'Caster') + ' AOE fallback: ' + (aoeMode || 'expanded') + ' -> ' + plan.mode + ' (' + (getCrucibleSpellAoePlan(aoeMode, margin).reason || 'unlock gate') + ').');
    }

    var baseDamage = Math.max(1, Number(margin || 1));
    var cap = Math.max(1, Number(plan.targetCap || 1));
    var statusCap = Math.max(1, Number(plan.statusCap || 1));
    var hits = [];

    for (var i = 0; i < ordered.length && hits.length < cap; i++) {
      var enemy = ordered[i];
      if (!enemy || Number(enemy.hp || 0) <= 0) continue;
      var dmg = baseDamage;
      enemy.hp = Math.max(0, Number(enemy.hp || 0) - dmg);
      enemy.conditions = enemy.conditions || {};
      if (hits.length < statusCap) {
        enemy.ap = Math.max(0, Number(enemy.ap || 0) - 1);
        enemy.conditions[String(actionKind || 'spell') === 'hack' ? 'distracted' : 'vulnerable'] = Math.max(1, Number(enemy.conditions[String(actionKind || 'spell') === 'hack' ? 'distracted' : 'vulnerable'] || 0) + 1);
      }
      hits.push({ unit: enemy, damage: dmg, downed: Number(enemy.hp || 0) <= 0 });
    }

    return {
      mode: plan.mode,
      hits: hits,
      primaryDamage: hits.length ? Number(hits[0].damage || 0) : 0
    };
  }

  function queueCrucibleExpeditionSpellHackWithPrompt(match, actor, action, targetRef) {
    var logs = [];
    var parsed = resolveCrucibleTargetUnit(match, String(targetRef || ''));
    var target = parsed && parsed.target ? parsed.target : null;
    if (!target || Number(target.hp || 0) <= 0) {
      target = getSelectedCrucibleTarget(match);
      if (target) {
        targetRef = 'enemy:' + String(target.id || '');
      }
    }
    if (!target) {
      if (typeof showNotif === 'function') showNotif('Select a valid spell/hack target first.', 'warn');
      return false;
    }

    var queueWithMeta = function (spellMeta) {
      var queuedLogs = [];
      if (!queueCrucibleExpeditionCombatAction(match, actor, action, targetRef, queuedLogs, spellMeta || null)) return false;
      match.log = (match.log || []).concat(queuedLogs).slice(-120);
      maybeSyncCrucibleSelection(match);
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    };

    if (!hasUnifiedSpellEngine || typeof hasUnifiedSpellEngine !== 'function' || !hasUnifiedSpellEngine()) {
      return queueWithMeta(null);
    }

    var actionKey = String(action || 'spell').toLowerCase();
    var spellName = (actionKey === 'hack' ? 'Queued Crucible Hack' : 'Queued Crucible Spell')
      + ': ' + String(actor && actor.name || 'Caster')
      + ' -> ' + String(target && target.name || 'Target');
    evaluateUnifiedSpellCircumstances(spellName, 'Queued Crucible action (locked at queue time).', function (resolved) {
      var chosenAoeMode = chooseCrucibleQueuedAoeModeInteractive('standard');
      if (chosenAoeMode === null) {
        if (typeof showNotif === 'function') showNotif('Queued spell/hack cancelled.', 'warn');
        return;
      }
      var spellMeta = {
        profile: resolved && resolved.profile,
        circData: resolved && resolved.circData ? resolved.circData : null,
        source: 'queued-manual',
        aoeMode: normalizeCrucibleQueuedAoeMode(chosenAoeMode, 'standard'),
        aoeModeLocked: true
      };
      queueWithMeta(spellMeta);
    }, function () {
      if (typeof showNotif === 'function') showNotif('Queued spell/hack cancelled.', 'warn');
    });
    return true;
  }

  function queueCrucibleExpeditionCombatAction(match, actor, action, targetRef, logs, spellMetaOverride) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || String(match.expedition.phase || '') !== 'combat') return false;
    if (!actor || Number(actor.hp || 0) <= 0) return false;
    if (Number(actor.ap || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif(actor.name + ' has no AP left.', 'warn');
      return false;
    }
    var actionKey = String(action || 'attack').toLowerCase();
    var packet = {
      seq: Math.max(1, Number(match.expedition.pendingCombatActionSeq || 0) + 1),
      actorId: String(actor.id || ''),
      action: actionKey,
      targetSide: '',
      targetId: '',
      summary: '',
      spellMeta: null
    };
    var target = null;
    var resolvedTargetRef = String(targetRef || '');
    var parsedTarget = resolveCrucibleTargetUnit(match, resolvedTargetRef);
    if (parsedTarget.target) {
      packet.targetSide = parsedTarget.side;
      packet.targetId = parsedTarget.id;
      target = parsedTarget.target;
    }

    if (actionKey === 'move') {
      if (typeof showNotif === 'function') showNotif('Movement still happens on the board. Drag a unit before resolving the party round.', 'info');
      return false;
    }

    if (actionKey === 'attack') {
      if (!target || String(packet.targetSide || '') !== 'enemy' || !canCrucibleActionTarget(actor, target, 'attack')) {
        if (typeof showNotif === 'function') showNotif('Pick an engaged or close enemy target.', 'warn');
        return false;
      }
      packet.summary = actor.name + ' queued Attack on ' + target.name + '.';
    } else if (actionKey === 'defend') {
      if (!target) target = actor;
      packet.targetSide = 'ally';
      packet.targetId = String(target.id || actor.id || '');
      packet.summary = actor.name + ' queued Defend for ' + target.name + '.';
    } else if (actionKey === 'support') {
      if (!target || String(packet.targetSide || '') !== 'ally') {
        if (typeof showNotif === 'function') showNotif('Pick an ally to support.', 'warn');
        return false;
      }
      packet.summary = actor.name + ' queued Support for ' + target.name + '.';
    } else if (actionKey === 'personal-flavor') {
      if (!target || String(packet.targetSide || '') !== 'enemy' || !canCrucibleActionTarget(actor, target, 'personal-flavor')) {
        if (typeof showNotif === 'function') showNotif('Personal Flavor requires an engaged or close enemy target.', 'warn');
        return false;
      }
      packet.summary = actor.name + ' queued Personal Flavor against ' + target.name + '.';
    } else if (actionKey === 'spell' || actionKey === 'hack') {
      if (!target || String(packet.targetSide || '') !== 'enemy' || !canCrucibleActionTarget(actor, target, actionKey)) {
        if (typeof showNotif === 'function') showNotif('Pick a valid spell or hack target first.', 'warn');
        return false;
      }
      packet.spellMeta = spellMetaOverride || buildAutoCrucibleQueuedSpellMeta(actionKey, actor, target, packet.seq);
      if (packet.spellMeta && !packet.spellMeta.aoeMode) packet.spellMeta.aoeMode = 'standard';
      packet.summary = actor.name + ' queued ' + (actionKey === 'hack' ? 'Hack' : 'Spell') + ' on ' + target.name + '.';
      if (packet.spellMeta && packet.spellMeta.aoeMode) {
        packet.summary += ' [AOE: ' + String(packet.spellMeta.aoeMode) + ']';
      }
    } else {
      packet.summary = actor.name + ' queued ' + actionKey + '.';
    }

    if (!spendCrucibleUnitAp(actor, 1)) return false;
    match.expedition.pendingCombatActionSeq = packet.seq;
    getCrucibleExpeditionQueuedActions(match).push(packet);
    if (logs) logs.push(packet.summary);
    if (packet.targetSide === 'enemy') match.selectedTargetId = String(packet.targetId || '');
    if (packet.targetSide === 'ally') match.selectedAllyTargetId = String(packet.targetId || '');
    chooseNextCrucibleExpeditionPlanner(match);
    return true;
  }

  function resolveCrucibleExpeditionQueuedAction(match, packet, logs) {
    if (!match || !packet) return false;
    var actor = findCrucibleUnit(match, 'ally', packet.actorId);
    if (!actor || Number(actor.hp || 0) <= 0) {
      if (logs) logs.push('A queued action fizzled because its wayfarer is down.');
      return false;
    }
    var target = null;
    if (String(packet.targetSide || '') === 'enemy') target = findCrucibleUnit(match, 'enemy', packet.targetId);
    else if (String(packet.targetSide || '') === 'ally') target = findCrucibleUnit(match, 'ally', packet.targetId);
    var actionKey = String(packet.action || 'attack').toLowerCase();

    if (actionKey === 'attack') {
      if (!target || Number(target.hp || 0) <= 0 || !canCrucibleUnitAttack(actor, target)) {
        if (logs) logs.push(actor.name + ' lost the attack lane before resolution.');
        return false;
      }
      var dist = (typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, target) || 0) : 0;
      if (logs) logs.push(actor.name + ' resolved ' + (dist <= 1 ? 'Strike' : 'Shoot') + ' on ' + target.name + '.');
      runCrucibleAttack(actor, target, logs, match);
      return true;
    }
    if (actionKey === 'defend') {
      if (!target || Number(target.hp || 0) <= 0) target = actor;
      target.defendBuff = Math.max(0, Number(target.defendBuff || 0) + applyCrucibleExpeditionFlavorRollBonus(match, actor, 'defend', 'support'));
      executeDefendAction(actor, target, logs);
      return true;
    }
    if (actionKey === 'support') {
      if (!target || Number(target.hp || 0) <= 0) {
        if (logs) logs.push(actor.name + ' lost the support target before resolution.');
        return false;
      }
      target.strikeBonus = Math.max(0, Number(target.strikeBonus || 0) + applyCrucibleExpeditionFlavorRollBonus(match, actor, 'lead', 'support'));
      executeSupportAction(actor, target, logs);
      return true;
    }
    if (actionKey === 'personal-flavor') {
      if (!target || Number(target.hp || 0) <= 0) {
        if (logs) logs.push(actor.name + ' had no valid target left for Personal Flavor.');
        return false;
      }
      if (typeof executePersonalFlavor === 'function') {
        executePersonalFlavor(actor, 'crucible-' + Number(match.round || 1), match.hexMap, logs, { target: target, match: match });
      } else if (logs) {
        logs.push(actor.name + ' used Personal Flavor on ' + target.name + '.');
      }
      return true;
    }
    if (actionKey === 'spell' || actionKey === 'hack') {
      if (!target || Number(target.hp || 0) <= 0 || !canCrucibleUnitCastActionOnTarget(actor, target, actionKey)) {
        if (logs) logs.push(actor.name + ' lost the ' + actionKey + ' target before resolution.');
        return false;
      }
      resolveCrucibleSpellHackAction(actor, target, actionKey, match, logs, null, packet.spellMeta || null);
      return true;
    }

    if (logs) logs.push(actor.name + ' held position.');
    return true;
  }

  function resolveCrucibleExpeditionCombatRound(match) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || String(match.expedition.phase || '') !== 'combat') return false;
    var expedition = match.expedition;
    var queued = getCrucibleExpeditionQueuedActions(match).slice();
    var logs = [];
    clearCrucibleExpeditionQueuedActions(match);
    match.turnSide = 'ally';

    if (queued.length) logs.push('Party round ' + Number(expedition.partyRound || 1) + ' resolves with ' + queued.length + ' queued action' + (queued.length === 1 ? '' : 's') + '.');
    else logs.push('Party round ' + Number(expedition.partyRound || 1) + ' resolves with no committed actions.');

    queued.forEach(function (packet) {
      resolveCrucibleExpeditionQueuedAction(match, packet, logs);
    });

    if (logs.length) match.log = (match.log || []).concat(logs).slice(-120);
    finalizeHoldingCrucibleMatch(match);
    if (!match.active || String(expedition.phase || '') !== 'combat') return true;

    runCrucibleEnemyTurn(match);
    expedition.partyRound = Math.max(1, Number(expedition.partyRound || 1) + 1);
    if (expedition.roundClosesEdges && getCrucibleExpeditionPartySize(match) > 1) {
      var collapsedNow = collapseCrucibleExpeditionEdge(match);
      if (collapsedNow > 0) {
        match.log = (match.log || []).concat(['Night closes after the combat round: ' + collapsedNow + ' edge hexes collapsed.']).slice(-120);
      }
    }
    clearCrucibleExpeditionQueuedActions(match);
    chooseNextCrucibleExpeditionPlanner(match);
    finalizeHoldingCrucibleMatch(match);
    return true;
  }

  function autoQueueCrucibleExpeditionRound(match) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || String(match.expedition.phase || '') !== 'combat') return false;
    var enemies = getLivingTeamUnits(match.enemies);
    var party = getLivingTeamUnits(match.allies);
    var queuedAny = false;
    party.forEach(function (actor) {
      if (!actor) return;
      match.selectedAllyId = String(actor.id || '');
      while (Number(actor.ap || 0) > 0) {
        var target = enemies.find(function (enemy) {
          return !!enemy && Number(enemy.hp || 0) > 0 && canCrucibleUnitAttack(actor, enemy);
        }) || enemies.find(function (enemy) {
          return !!enemy && Number(enemy.hp || 0) > 0;
        }) || null;
        if (target && canCrucibleUnitAttack(actor, target)) {
          queuedAny = queueCrucibleExpeditionCombatAction(match, actor, 'attack', 'enemy:' + String(target.id || ''), null) || queuedAny;
        } else {
          queuedAny = queueCrucibleExpeditionCombatAction(match, actor, 'defend', 'ally:' + String(actor.id || ''), null) || queuedAny;
        }
        enemies = getLivingTeamUnits(match.enemies);
      }
    });
    return queuedAny;
  }

  function getCrucibleExpeditionFlavorText(actor) {
    if (!actor || !actor.personalFlavor) return '';
    return String(actor.personalFlavor.full || actor.personalFlavor.name || '').trim();
  }

  function getCrucibleExpeditionFlavorBase(actor) {
    var full = getCrucibleExpeditionFlavorText(actor);
    if (!full) return '';
    if (typeof normalizeFlavorBase === 'function') return String(normalizeFlavorBase(full) || '');
    var cut = full.indexOf(':');
    return (cut >= 0 ? full.slice(0, cut) : full).trim().toLowerCase();
  }

  function hashCrucibleExpeditionFlavor(text) {
    if (typeof flavorHashCode === 'function') return Number(flavorHashCode(text) || 0);
    var raw = String(text || '');
    var acc = 0;
    for (var i = 0; i < raw.length; i++) acc = ((acc << 5) - acc) + raw.charCodeAt(i);
    return Math.abs(acc | 0);
  }

  function getCrucibleExpeditionFlavorSpec(actor) {
    var base = getCrucibleExpeditionFlavorBase(actor);
    var full = getCrucibleExpeditionFlavorText(actor);
    var profile = (typeof getPersonalFlavorMechanicProfile === 'function') ? (getPersonalFlavorMechanicProfile(full) || {}) : {};
    var entry = (typeof getBespokeFlavorEntry === 'function') ? getBespokeFlavorEntry(full) : null;
    var hash = hashCrucibleExpeditionFlavor(base || full || String(actor && actor.id || 'flavor'));
    return {
      base: base,
      full: full,
      profile: profile,
      archetype: String(entry && entry.archetype || 'mystic'),
      combatBonus: 1 + (hash % 3),
      defendBonus: 1 + (Math.floor(hash / 3) % 3),
      exploreBonus: 1 + (Math.floor(hash / 9) % 2),
      supportBonus: 1 + (Math.floor(hash / 19) % 3)
    };
  }

  function getCrucibleExpeditionVisitedHexCount(match, hexKey) {
    var visited = match && match.expedition && match.expedition.visitedHexes ? match.expedition.visitedHexes : {};
    return Math.max(0, Number(visited[String(hexKey || '')] || 0));
  }

  function applyCrucibleExpeditionFlavorRollBonus(match, actor, rollType, contextKey) {
    if (!match || String(match.mode || '') !== 'expedition' || !actor) return 0;
    var spec = getCrucibleExpeditionFlavorSpec(actor);
    if (!spec.base && !spec.full) return 0;
    var type = String(rollType || '').toLowerCase();
    var context = String(contextKey || '').toLowerCase();
    var bonus = 0;
    if (spec.base.indexOf('pathfinder') >= 0 && context === 'barrier') bonus += Math.max(1, spec.exploreBonus);
    if (spec.base.indexOf('clockmind') >= 0 && (type === 'control' || context === 'trap')) bonus += 2;
    if (spec.base.indexOf('circuit saint') >= 0 && (type === 'mind' || type === 'control' || context === 'puzzle')) bonus += 2;
    if (spec.base.indexOf('ruin scholar') >= 0 && (context === 'ruin' || context === 'puzzle')) bonus += 2;
    if (spec.base.indexOf('lantern scholar') >= 0 && context === 'ruin') bonus += 1;
    if (spec.base.indexOf('grim resolve') >= 0 && type === 'defend' && Number(actor.hp || 0) <= Math.ceil(Number(actor.maxHp || 0) / 2)) bonus += 2;
    if (spec.base.indexOf('vault memory') >= 0 && context === 'revisit') bonus += 2;
    if (spec.base.indexOf('hex cartographer') >= 0 && context === 'search') bonus += 1;
    if (spec.base.indexOf('moon listener') >= 0 && Number(match.expedition && match.expedition.day || 1) >= 2) bonus += 1;
    if (spec.base.indexOf('dawnbreaker') >= 0 && Number(match.expedition && match.expedition.day || 1) === 1) bonus += 2;
    if (spec.base.indexOf('duskcaller') >= 0 && Number(match.expedition && match.expedition.day || 1) === 2) bonus += 2;
    if (!bonus) {
      if (spec.archetype === 'combat' && (type === 'strike' || type === 'shoot' || type === 'mind' || type === 'spirit')) bonus += spec.combatBonus;
      else if (spec.archetype === 'guard' && (type === 'defend' || context === 'barrier' || context === 'weather')) bonus += spec.defendBonus;
      else if (spec.archetype === 'scout' && (context === 'search' || context === 'barrier' || context === 'peril' || context === 'revisit')) bonus += spec.exploreBonus;
      else if (spec.archetype === 'scholar' && (type === 'mind' || type === 'control' || context === 'puzzle' || context === 'ruin')) bonus += spec.supportBonus;
      else if (spec.archetype === 'leader' && context === 'support') bonus += spec.supportBonus;
      else if (spec.archetype === 'night' && Number(match.expedition && match.expedition.day || 1) >= 2) bonus += 1;
    }
    return bonus;
  }

  function getCrucibleExpeditionStatDie(statName, fallbackDie) {
    var key = String(statName || '').toLowerCase();
    var fallback = Math.max(4, Number(fallbackDie || 6));
    if (typeof getEffectiveDie === 'function') {
      try {
        var eff = Number(getEffectiveDie(key));
        if (eff >= 4) return eff;
      } catch (_err) { console.error(_err); }
    }
    if (S && S.stats && Object.prototype.hasOwnProperty.call(S.stats, key)) {
      var statDie = Number(S.stats[key]);
      if (statDie >= 4) return statDie;
    }
    return fallback;
  }

  function getCrucibleExpeditionBarrierCell(match, hex) {
    if (!match || !match.hexMap || !match.hexMap.hexes || !hex) return null;
    var key = String(Number(hex.q || 0)) + ',' + String(Number(hex.r || 0));
    var cell = match.hexMap.hexes[key] || null;
    return cell && (cell.terrain === 'barrier' || cell.barrier) ? cell : null;
  }

  function isCrucibleExpeditionBarrierOpen(match, cell) {
    if (!cell || !cell.barrier) return false;
    var token = String(match && match.expedition ? (match.expedition.day + ':' + match.expedition.phase) : '');
    return String(cell.barrier.passToken || '') === token;
  }

  function getCrucibleExpeditionLootDescription(itemName) {
    var raw = String(itemName || 'Unknown Relic');
    var base = raw.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    var found = (typeof findShopItem === 'function') ? findShopItem(base) : null;
    var desc = found && found.item && found.item.description ? String(found.item.description) : '';
    return desc || 'Recovered from the collapsing province frontier.';
  }

  function formatCrucibleExpeditionSaveLine(label, actionDie, actionTotal, dreadDie, dreadTotal, success, extra) {
    return String(label || 'Save') + ': roll d' + Number(actionDie || 0) + ' = ' + Number(actionTotal || 0)
      + ' vs DD' + Number(dreadDie || 0) + ' = ' + Number(dreadTotal || 0)
      + ' (' + (success ? 'success' : 'failure') + ')'
      + (extra ? ' ' + String(extra) : '');
  }

  function resolveCrucibleExpeditionPerilHex(match, actor, hex) {
    if (!match || !match.hexMap || !match.hexMap.hexes || !hex) return true;
    var key = String(Number(hex.q || 0)) + ',' + String(Number(hex.r || 0));
    var cell = match.hexMap.hexes[key];
    if (!cell || !cell.trap || String(cell.trap.type || '') !== 'peril_hex') return true;
    var controlDie = getCrucibleExpeditionStatDie('control', 6);
    var action = (typeof explodingRoll === 'function')
      ? explodingRoll(controlDie, { type: 'action', major: true, label: 'Peril Save (Control)' })
      : { total: Math.floor(Math.random() * controlDie) + 1 };
    var dread = (typeof explodingRoll === 'function')
      ? explodingRoll(4, { type: 'dread', major: true, label: 'Peril DD4' })
      : { total: Math.floor(Math.random() * 4) + 1 };
    var perilBonus = applyCrucibleExpeditionFlavorRollBonus(match, actor, 'control', 'peril');
    if (perilBonus) action.total = Number(action.total || 0) + perilBonus;
    var success = Number(action.total || 0) >= Number(dread.total || 0);
    if (!success) {
      var diff = Math.max(1, Number(dread.total || 0) - Number(action.total || 0));
      if (typeof changeMentalStress === 'function') changeMentalStress(diff);
      if (typeof recordCrucibleExpeditionHexClick === 'function') recordCrucibleExpeditionHexClick(match, { skipEncounter: true });
      if (typeof showNotif === 'function') showNotif(formatCrucibleExpeditionSaveLine('Peril Save', controlDie, action.total, 4, dread.total, false, '+1 Tick, +' + diff + ' Mental Stress.'), 'warn');
      match.log = (match.log || []).concat([String(actor && actor.name || 'Wayfarer') + ' ' + formatCrucibleExpeditionSaveLine('Peril Save', controlDie, action.total, 4, dread.total, false, '+1 Tick, +' + diff + ' Mental Stress.')]).slice(-120);
      return false;
    }
    if (typeof showNotif === 'function') showNotif(formatCrucibleExpeditionSaveLine('Peril Save', controlDie, action.total, 4, dread.total, true), 'good');
    match.log = (match.log || []).concat([String(actor && actor.name || 'Wayfarer') + ' ' + formatCrucibleExpeditionSaveLine('Peril Save', controlDie, action.total, 4, dread.total, true)]).slice(-120);
    return true;
  }

  // ── Shared manual-save modal for Crucible Expedition (mirrors WTW openWtwManualActionDreadPrompt) ──
  function openCrucibleExpeditionManualSavePrompt(config) {
    if (typeof openModal !== 'function') return false;
    var cfg = config || {};
    var title = String(cfg.title || 'Manual Save');
    var context = String(cfg.context || title);
    var statLabel = String(cfg.statLabel || 'Action');
    var actionDie = Math.max(4, Number(cfg.actionDie || 6));
    var dreadDie = Math.max(4, Number(cfg.dreadDie || 6));
    var bonus = Number(cfg.bonus || 0);
    var bonusLabel = String(cfg.bonusLabel || '');
    var tmw = Math.max(0, Number((S && S.tmw) || 0));
    var diceChain = [4, 6, 8, 10, 12, 20];
    var dreadIdx = diceChain.indexOf(dreadDie);
    var pushDread = diceChain[Math.min(diceChain.length - 1, (dreadIdx < 0 ? 1 : dreadIdx) + 1)];

    window._pendingExpedSaveManual = {
      statLabel: statLabel,
      actionDie: actionDie,
      dreadDie: dreadDie,
      bonus: bonus,
      resolver: (typeof cfg.onResolve === 'function') ? cfg.onResolve : null
    };

    var bonusHtml = bonus > 0
      ? "<div style='margin-top:.28rem;padding:.22rem .36rem;border:1px solid rgba(46,196,182,.35);background:rgba(46,196,182,.07);border-radius:3px;font-size:.74rem;color:var(--teal);'>"
        + "<strong>+" + bonus + " bonus</strong>" + (bonusLabel ? " — " + bonusLabel : "")
        + " (add to your " + statLabel + " result before entering below)"
        + "</div>"
      : "";

    var html = ""
      + "<div style='font-size:.84rem;color:var(--text2);line-height:1.6;'>"
      + "<div style='font-family:Cinzel,serif;font-size:.78rem;letter-spacing:.08em;color:var(--gold2);margin-bottom:.28rem;'>" + context + "</div>"
      + "<div><strong>" + statLabel + " d" + actionDie + "</strong> vs <strong style='color:var(--red2);'>Dread d" + dreadDie + "</strong></div>"
      + "<div style='font-size:.72rem;color:var(--muted2);margin-top:.1rem;margin-bottom:.28rem;'>Roll your physical dice, apply any bonuses shown, then enter your totals and choose outcome.</div>"
      + bonusHtml
      + "<div style='display:grid;grid-template-columns:1fr 1fr;gap:.32rem;margin-top:.4rem;'>"
      + "<div><div style='font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;'>" + statLabel + " d" + actionDie + (bonus > 0 ? " +" + bonus + " (total)" : " (total)") + "</div>"
      + "<input type='text' inputmode='text' id='expedSaveManualActionValue' placeholder='e.g. 8+7' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;'></div>"
      + "<div><div style='font-size:.7rem;color:var(--muted2);margin-bottom:.16rem;'>Dread d" + dreadDie + "</div>"
      + "<input type='text' inputmode='text' id='expedSaveManualDreadValue' placeholder='e.g. 7+3+1' style='width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.32rem .42rem;font-size:.86rem;border-radius:3px;'></div>"
      + "</div>"
      + "<div style='margin-top:.34rem;padding:.28rem .36rem;border:1px solid rgba(232,192,80,.35);background:rgba(232,192,80,.08);border-radius:3px;'>"
      + "<div style='font-size:.74rem;color:var(--gold2);'><strong>Teamwork:</strong> " + tmw + " TMW</div>"
      + "<div style='font-size:.7rem;color:var(--muted2);margin-top:.08rem;'>Push Luck costs 2 TMW and raises Dread to d" + pushDread + ".</div>"
      + "</div>"
      + "<div style='display:flex;gap:.26rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.45rem;'>"
      + "<button class='btn btn-sm' onclick='closeModal()'>Cancel</button>"
      + "<button class='btn btn-sm' onclick='resolveExpedSaveManualPrompt(\"compare\",false)'>Compare</button>"
      + "<button class='btn btn-sm btn-primary' onclick='resolveExpedSaveManualPrompt(\"success\",false)'>Success</button>"
      + "<button class='btn btn-sm btn-red' onclick='resolveExpedSaveManualPrompt(\"failure\",false)'>Failure</button>"
      + "<button class='btn btn-sm btn-teal' " + (tmw >= 2 ? '' : "disabled title='Need 2 Teamwork'") + " onclick='resolveExpedSaveManualPrompt(\"success\",true)'>Push Luck + Success</button>"
      + "<button class='btn btn-sm btn-warn' " + (tmw >= 2 ? '' : "disabled title='Need 2 Teamwork'") + " onclick='resolveExpedSaveManualPrompt(\"failure\",true)'>Push Luck + Failure</button>"
      + "</div>"
      + "</div>";
    openModal(title, html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  window.resolveExpedSaveManualPrompt = function resolveExpedSaveManualPrompt(mode, pushLuck) {
    var pending = window._pendingExpedSaveManual || null;
    if (!pending) return;
    var actionInput = document.getElementById('expedSaveManualActionValue');
    var dreadInput = document.getElementById('expedSaveManualDreadValue');
    var actionValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(actionInput, 1) : parseInt(actionInput && actionInput.value, 10);
    var dreadValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(dreadInput, 1) : parseInt(dreadInput && dreadInput.value, 10);
    var actionDie = Math.max(4, Number(pending.actionDie || 4));
    var baseDreadDie = Math.max(4, Number(pending.dreadDie || 6));
    if (!Number.isFinite(actionValue) || actionValue < 1) {
      if (typeof showNotif === 'function') showNotif('Enter a valid ' + pending.statLabel + ' result first.', 'warn');
      if (actionInput) actionInput.focus();
      return;
    }
    if (!Number.isFinite(dreadValue) || dreadValue < 1) {
      if (typeof showNotif === 'function') showNotif('Enter a valid Dread result first.', 'warn');
      if (dreadInput) dreadInput.focus();
      return;
    }
    var usedPush = false;
    var finalDreadDie = baseDreadDie;
    if (pushLuck) {
      var tmw = Math.max(0, Number((S && S.tmw) || 0));
      if (tmw < 2) {
        if (typeof showNotif === 'function') showNotif('Need 2 Teamwork to Push Luck.', 'warn');
        return;
      }
      if (typeof changeCounter === 'function') changeCounter('tmw', -2);
      else if (typeof S !== 'undefined') S.tmw = Math.max(0, tmw - 2);
      usedPush = true;
      var chain = [4, 6, 8, 10, 12, 20];
      var idx = chain.indexOf(baseDreadDie);
      finalDreadDie = chain[Math.min(chain.length - 1, (idx < 0 ? 1 : idx) + 1)];
    }
    var modeKey = String(mode || 'compare').toLowerCase();
    var success = modeKey === 'success' ? true : (modeKey === 'failure' ? false : (actionValue >= dreadValue));
    window._pendingExpedSaveManual = null;
    if (typeof closeModal === 'function') closeModal();
    if (typeof pending.resolver === 'function') {
      pending.resolver({
        success: success,
        manual: true,
        pushLuck: usedPush,
        statLabel: pending.statLabel,
        actionDie: actionDie,
        dreadDie: finalDreadDie,
        actionTotal: actionValue,
        dreadTotal: dreadValue,
        mode: modeKey
      });
    }
  };

  function isCrucibleManualRollModeEnabled() {
    try {
      return !!(window.settingsSystem
        && typeof window.settingsSystem.isManualRollMode === 'function'
        && window.settingsSystem.isManualRollMode());
    } catch (_err) {
      return false;
    }
  }

  function resolveCrucibleExpeditionDangerousWeather(match, sourceTag) {
    if (!match || String(match.mode || '') !== 'expedition') return true;
    var cell = getCrucibleExpeditionCellFromPlayer(match);
    if (!cell) return true;
    var season = String((S && S.currentSeason) || 'spring');
    var weatherTable = (typeof WEATHER !== 'undefined' && WEATHER && Array.isArray(WEATHER[season])) ? WEATHER[season] : [];
    var wr = Math.max(1, Math.min(6, Number(cell.weatherRoll || 1)));
    var weather = weatherTable[wr - 1] || { result: 'Still Air', rough: false };
    if (!weather.rough) return true;
    var leadDie = getCrucibleExpeditionStatDie('lead', 6);
    var weatherBonus = applyCrucibleExpeditionFlavorRollBonus(match, getCrucibleExpeditionPlayer(match), 'lead', 'weather');
    var weatherName = String(weather.result || 'Rough Weather');
    var applyWeatherResult = function (r) {
      var actionTotal = Number(r && r.actionTotal || 0);
      var dreadTotal = Number(r && r.dreadTotal || 0);
      var success = !!(r && r.success);
      if (success) {
        if (typeof showNotif === 'function') showNotif(formatCrucibleExpeditionSaveLine('Weather Save', leadDie, actionTotal, 6, dreadTotal, true), 'good');
        match.log = (match.log || []).concat(['Dangerous weather (' + String(sourceTag || 'Expedition') + '): ' + formatCrucibleExpeditionSaveLine('Weather Save', leadDie, actionTotal, 6, dreadTotal, true)]).slice(-120);
      } else {
        var diff = Math.max(1, dreadTotal - actionTotal);
        if (typeof changeMentalStress === 'function') changeMentalStress(diff);
        match.log = (match.log || []).concat(['Dangerous weather (' + String(sourceTag || 'Expedition') + '): failed Lead save (' + actionTotal + ' vs ' + dreadTotal + '). +' + diff + ' Mental Stress.']).slice(-120);
        if (typeof showNotif === 'function') showNotif(formatCrucibleExpeditionSaveLine('Weather Save', leadDie, actionTotal, 6, dreadTotal, false, '+' + diff + ' Mental Stress.'), 'warn');
      }
    };
    // Manual roll mode: show the proper Save prompt (Compare / Success / Failure buttons)
    if (isCrucibleManualRollModeEnabled()) {
      openCrucibleExpeditionManualSavePrompt({
        title: 'Manual Roll — Weather Check',
        context: 'Weather Check — Lead vs DD6' + (weatherBonus > 0 ? ' (+' + weatherBonus + ' bonus)' : '') + ' · ' + weatherName,
        statLabel: 'Lead',
        actionDie: leadDie,
        dreadDie: 6,
        bonus: weatherBonus,
        bonusLabel: weatherBonus > 0 ? 'Archetype / Flavor bonus' : '',
        onResolve: applyWeatherResult
      });
      return true;
    }
    // Auto-roll
    var action = (typeof explodingRoll === 'function')
      ? explodingRoll(leadDie, { type: 'action', major: true, label: 'Danger Weather Save (Lead)' })
      : { total: Math.floor(Math.random() * leadDie) + 1 };
    var dread = (typeof explodingRoll === 'function')
      ? explodingRoll(6, { type: 'dread', major: true, label: 'Danger Weather DD6' })
      : { total: Math.floor(Math.random() * 6) + 1 };
    if (weatherBonus) action.total = Number(action.total || 0) + weatherBonus;
    var autoSuccess = Number(action.total || 0) >= Number(dread.total || 0);
    applyWeatherResult({ success: autoSuccess, actionTotal: action.total, dreadTotal: dread.total });
    return autoSuccess;
  }

  function resolveCrucibleExpeditionBarrierCrossing(match, actor, fromHex, toHex) {
    var cell = getCrucibleExpeditionBarrierCell(match, toHex);
    if (!cell) return true;
    if (isCrucibleExpeditionBarrierOpen(match, cell)) return true;
    var bodyDie = getCrucibleExpeditionStatDie('body', 6);
    var revisitKey = String(Number(toHex && toHex.q || 0)) + ',' + String(Number(toHex && toHex.r || 0));
    var barrierContext = getCrucibleExpeditionVisitedHexCount(match, revisitKey) > 0 ? 'revisit' : 'barrier';
    var barrierBonus = applyCrucibleExpeditionFlavorRollBonus(match, actor, 'body', barrierContext);
    var actorName = String(actor && actor.name || 'Wayfarer');
    var applyBarrierResult = function (r) {
      var actionTotal = Number(r && r.actionTotal || 0);
      var dreadTotal = Number(r && r.dreadTotal || 0);
      var success = !!(r && r.success);
      if (success) {
        cell.barrier.passToken = String(match.expedition.day) + ':' + String(match.expedition.phase || 'explore');
        if (typeof showNotif === 'function') showNotif(formatCrucibleExpeditionSaveLine('Barrier Save', bodyDie, actionTotal, 6, dreadTotal, true) + ' Move again to cross.', 'good');
        if (match && match.log) match.log = (match.log || []).concat([actorName + ' ' + formatCrucibleExpeditionSaveLine('Barrier Save', bodyDie, actionTotal, 6, dreadTotal, true)]).slice(-120);
      } else {
        if (typeof recordCrucibleExpeditionHexClick === 'function') recordCrucibleExpeditionHexClick(match, { skipEncounter: true });
        if (typeof showNotif === 'function') showNotif(formatCrucibleExpeditionSaveLine('Barrier Save', bodyDie, actionTotal, 6, dreadTotal, false, '+1 Tick.'), 'warn');
        if (match && match.log) match.log = (match.log || []).concat([actorName + ' ' + formatCrucibleExpeditionSaveLine('Barrier Save', bodyDie, actionTotal, 6, dreadTotal, false, '+1 Tick.')]).slice(-120);
      }
      if (typeof renderHoldingCruciblePopup === 'function') renderHoldingCruciblePopup();
      if (typeof renderHoldingUI === 'function') renderHoldingUI();
    };
    // Manual roll mode: show the proper Save prompt (Compare / Success / Failure buttons)
    if (isCrucibleManualRollModeEnabled()) {
      openCrucibleExpeditionManualSavePrompt({
        title: 'Manual Roll — Barrier Crossing',
        context: 'Barrier Crossing — Body vs DD6' + (barrierBonus > 0 ? ' (+' + barrierBonus + ' bonus)' : ''),
        statLabel: 'Body',
        actionDie: bodyDie,
        dreadDie: 6,
        bonus: barrierBonus,
        bonusLabel: barrierBonus > 0 ? (barrierContext === 'revisit' ? 'Revisit bonus' : 'Archetype / Flavor bonus') : '',
        onResolve: applyBarrierResult
      });
      // Block movement now; passToken will be set on Success so the next move auto-crosses
      return false;
    }
    // Auto-roll
    var playerRoll = (typeof explodingRoll === 'function')
      ? explodingRoll(bodyDie, { type: 'action', major: true, label: 'Barrier Crossing (Body)' })
      : { total: Math.floor(Math.random() * bodyDie) + 1 };
    var dreadRoll = (typeof explodingRoll === 'function')
      ? explodingRoll(6, { type: 'dread', major: true, label: 'Barrier DD6' })
      : { total: Math.floor(Math.random() * 6) + 1 };
    if (barrierBonus) playerRoll.total = Number(playerRoll.total || 0) + barrierBonus;
    var autoSuccess = Number(playerRoll.total || 0) >= Number(dreadRoll.total || 0);
    applyBarrierResult({ success: autoSuccess, actionTotal: playerRoll.total, dreadTotal: dreadRoll.total });
    return autoSuccess;
  }

  function openCrucibleExpeditionCombatPopup(match) {
    if (!match) return false;
    if (match.expedition) match.expedition.uiTab = 'combat';
    if (typeof openModal === 'function') {
      openModal('Expedition Combat', buildCrucibleExpeditionPopupHtml(match), null, { preventScroll: true, focusTrap: true });
      return true;
    }
    if (typeof renderHoldingCruciblePopup === 'function') {
      renderHoldingCruciblePopup();
      return true;
    }
    return false;
  }

  function getCrucibleExpeditionOpenHexCount(match) {
    if (!match || !match.hexMap || !match.hexMap.hexes) return 0;
    var collapsed = (match.expedition && match.expedition.collapsed) ? match.expedition.collapsed : {};
    var count = 0;
    Object.keys(match.hexMap.hexes).forEach(function (key) {
      var cell = match.hexMap.hexes[key];
      if (!cell || collapsed[key]) return;
      count += 1;
    });
    return count;
  }

  function getCrucibleExpeditionNearestSafeHex(match, fromHex) {
    if (!match || !match.hexMap || !match.hexMap.hexes || !match.expedition || !fromHex) return null;
    var collapsed = match.expedition.collapsed || {};
    var best = null;
    var bestDist = Infinity;
    Object.keys(match.hexMap.hexes).forEach(function (key) {
      var cell = match.hexMap.hexes[key];
      if (!cell || collapsed[key] || cell.obstacle || cell.door || cell.zone) return;
      var d = (Math.abs(Number(fromHex.q || 0) - Number(cell.q || 0))
        + Math.abs((Number(fromHex.q || 0) + Number(fromHex.r || 0)) - (Number(cell.q || 0) + Number(cell.r || 0)))
        + Math.abs(Number(fromHex.r || 0) - Number(cell.r || 0))) / 2;
      if (d < bestDist) {
        best = { q: Number(cell.q || 0), r: Number(cell.r || 0) };
        bestDist = d;
      }
    });
    return best;
  }

  function applyCrucibleExpeditionCollapseConsequences(match, collapsedNow) {
    if (!match || !match.expedition || !match.hexMap || !match.hexMap.hexes || !Array.isArray(collapsedNow) || !collapsedNow.length) return false;
    var collapsed = match.expedition.collapsed || {};
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) return false;
    var key = String(Number(player.position.q || 0)) + ',' + String(Number(player.position.r || 0));
    if (!collapsed[key]) return false;
    player.hp = Math.max(0, Number(player.hp || 1) - 3);
    var safeHex = getCrucibleExpeditionNearestSafeHex(match, player.position);
    if (safeHex) {
      player.position = { q: Number(safeHex.q || 0), r: Number(safeHex.r || 0) };
      match.log = (match.log || []).concat(['Collapsed edge struck the Wayfarer: -3 HP, displaced to [' + Number(player.position.q || 0) + ',' + Number(player.position.r || 0) + '].']).slice(-120);
    } else {
      match.log = (match.log || []).concat(['Collapsed edge struck the Wayfarer: -3 HP and no safe hex to displace into.']).slice(-120);
    }
    if (typeof showNotif === 'function') showNotif('Collapsed edge hit: -3 HP and forced displacement.', 'warn');
    return true;
  }

  function collapseCrucibleExpeditionEdge(match) {
    if (!match || !match.expedition || !match.hexMap || !match.hexMap.hexes) return 0;
    var expedition = match.expedition;
    expedition.collapseRing = Math.max(0, Number(expedition.collapseRing || 0) + 1);
    var threshold = Math.max(0, Number(expedition.maxRing || 0) - Number(expedition.collapseRing || 0) + 1);
    var collapsed = expedition.collapsed || {};
    var changed = 0;
    var changedKeys = [];
    Object.keys(match.hexMap.hexes).forEach(function (key) {
      var cell = match.hexMap.hexes[key];
      if (!cell || collapsed[key]) return;
      var dist = Math.max(Math.abs(Number(cell.q || 0)), Math.abs(Number(cell.r || 0)), Math.abs(Number(cell.q || 0) + Number(cell.r || 0)));
      if (dist < threshold) return;
      collapsed[key] = true;
      changedKeys.push(key);
      changed += 1;
    });
    expedition.collapsed = collapsed;
    applyCrucibleExpeditionCollapseConsequences(match, changedKeys);
    return changed;
  }

  function resetCrucibleExpeditionMapForDay(match, day) {
    if (!match || !match.expedition) return false;
    var nextDay = Math.max(1, Number(day || 1));
    var newMap = (typeof generateCrucibleHexMap === 'function')
      ? generateCrucibleHexMap(Date.now() + nextDay, 13)
      : { seed: 1, size: 13, hexes: {}, objectives: [], spawns: { ally: { q: -1, r: -1 }, enemy: { q: 1, r: 1 } } };
    stampCrucibleExpeditionProvinceBarriers(newMap);
    stampCrucibleTemplesOnMap(newMap, 4);
    var stamped = stampCrucibleExpeditionProvinceFeatures(newMap, nextDay);
    match.hexMap = newMap;
    var expedition = match.expedition;
    var preservedZoom = Math.max(0.7, Math.min(2.6, Number(expedition.mapZoom || 1)));
    var preservedContrast = !!expedition.highContrastOutline;
    expedition.day = nextDay;
    expedition.phase = 'explore';
    expedition.clickedHexes = 0;
    expedition.collapseEveryClicks = nextDay === 1 ? 6 : (nextDay === 2 ? 3 : 2);
    expedition.collapseRing = 0;
    expedition.maxRing = getHexRadiusFromMap(newMap);
    expedition.collapsed = {};
    expedition.currentCombatType = '';
    expedition.currentCombatProfile = null;
    expedition.portalEvent = null;
    expedition.pendingPortalPuzzle = false;
    expedition.mapZoom = preservedZoom;
    expedition.highContrastOutline = preservedContrast;
    expedition.provinceFeatures = stamped;
    expedition.clearedHexes = {};
    expedition.raidBossNerfed = Number(expedition.portalsClosed || 0) >= Number(expedition.portalQuestTarget || 5);
    expedition.miniBossHexKeys = seedCrucibleExpeditionMiniBossHexes(newMap, 3);
    expedition.miniBossDefeated = {};
    (match.enemies || []).forEach(function (enemy) { if (enemy) enemy.hp = 0; });
    match.enemies = [];
    var player = getCrucibleExpeditionPlayer(match);
    if (player) {
      var dropHex = getCrucibleExpeditionRandomDropHex(newMap) || (newMap.spawns && newMap.spawns.ally) || { q: 0, r: 0 };
      player.position = { q: Number(dropHex.q || 0), r: Number(dropHex.r || 0) };
      player.ap = 2;
    }
    resetCrucibleTeamForTurn(match.allies || []);
    match.turnSide = 'ally';
    return true;
  }

  function spawnCrucibleExpeditionEnemy(match, profile) {
    if (!match || !profile || !match.hexMap) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player) return false;
    var enemySpawn = (match.hexMap.spawns && match.hexMap.spawns.enemy) ? match.hexMap.spawns.enemy : { q: 2, r: 2 };
    var uniqueName = getUniqueCrucibleExpeditionEnemyName(match.expedition, profile.name || 'Field Horror');
    var enemy = buildCrucibleUnit(uniqueName, 'enemy', profile.role || 'assault', 0, { q: Number(enemySpawn.q || 2), r: Number(enemySpawn.r || 2) });
    enemy.hp = Math.max(1, Number(profile.hp || 4));
    enemy.maxHp = enemy.hp;
    enemy.attackDie = Math.max(4, Number(profile.die || 6));
    enemy.defendDie = Math.max(4, Math.floor(enemy.attackDie / 2) + 2);
    enemy.ap = 2;
    enemy.isRaidBoss = !!profile.isRaidBoss;
    enemy.profile = {
      name: String(profile.name || enemy.name || 'Unknown Foe'),
      look: String(profile.look || 'A silhouette without a history.'),
      desc: String(profile.desc || 'It has no entry in any surviving codex.'),
      tier: String(profile.combatType || 'fieldEnemy')
    };
    match.enemies = [enemy];
    match.selectedEnemyId = String(enemy.id || '');
    match.selectedTargetId = String(enemy.id || '');
    match.selectedAllyTargetId = String(player.id || '');
    match.turnSide = 'ally';
    match.expedition.phase = 'combat';
    match.expedition.uiTab = 'combat';
    match.expedition.currentCombatType = String(profile.combatType || 'fieldMonster');
    match.expedition.currentCombatProfile = enemy.profile;
    clearCrucibleExpeditionQueuedActions(match);
    chooseNextCrucibleExpeditionPlanner(match);
    return true;
  }

  function spawnCrucibleExpeditionEnemyWave(match, profile, count) {
    if (!match || !profile || !match.hexMap) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player) return false;
    var enemySpawn = (match.hexMap.spawns && match.hexMap.spawns.enemy) ? match.hexMap.spawns.enemy : { q: 2, r: 2 };
    var useCount = Math.max(1, Math.min(4, Number(count || 1)));
    var enemies = [];
    var used = {};
    for (var i = 0; i < useCount; i++) {
      var uniqueName = getUniqueCrucibleExpeditionEnemyName(match.expedition, profile.name || 'Field Horror');
      var spawn = { q: Number(enemySpawn.q || 2), r: Number(enemySpawn.r || 2) };
      if (typeof getCrucibleRandomOpenHex === 'function') {
        var pick = getCrucibleRandomOpenHex(player, match, 999);
        if (pick) spawn = { q: Number(pick.q || 2), r: Number(pick.r || 2) };
      }
      var sk = String(spawn.q) + ',' + String(spawn.r);
      if (used[sk]) spawn = { q: Number(enemySpawn.q || 2) + i, r: Number(enemySpawn.r || 2) };
      used[String(spawn.q) + ',' + String(spawn.r)] = true;
      var enemy = buildCrucibleUnit(uniqueName, 'enemy', profile.role || 'assault', i, spawn);
      enemy.hp = Math.max(1, Number(profile.hp || 4));
      enemy.maxHp = enemy.hp;
      enemy.attackDie = Math.max(4, Number(profile.die || 6));
      enemy.defendDie = Math.max(4, Math.floor(enemy.attackDie / 2) + 2);
      enemy.ap = 2;
      enemy.profile = {
        name: String(profile.name || enemy.name || 'Unknown Foe'),
        look: String(profile.look || 'A silhouette without a history.'),
        desc: String(profile.desc || 'It has no entry in any surviving codex.'),
        tier: String(profile.combatType || 'fieldEnemy')
      };
      enemies.push(enemy);
    }
    match.enemies = enemies;
    match.selectedEnemyId = String(enemies[0] && enemies[0].id || '');
    match.selectedTargetId = String(enemies[0] && enemies[0].id || '');
    match.selectedAllyTargetId = String(player.id || '');
    match.turnSide = 'ally';
    match.expedition.phase = 'combat';
    match.expedition.uiTab = 'combat';
    match.expedition.currentCombatType = String(profile.combatType || 'fieldEnemy');
    match.expedition.currentCombatProfile = enemies[0] ? enemies[0].profile : null;
    clearCrucibleExpeditionQueuedActions(match);
    chooseNextCrucibleExpeditionPlanner(match);
    if (String(profile.combatType || '') === 'fieldEnemy') {
      match.expedition.pendingEnemyCredits = useCount * 60;
    }
    return true;
  }

  function getCrucibleExpeditionCinematicPrompt(match, profile) {
    var expedition = match && match.expedition ? match.expedition : null;
    var day = expedition ? Number(expedition.day || 1) : 1;
    var name = profile && profile.name ? profile.name : 'Unknown Foe';
    var lines = [
      'The last hex falls silent. Wind drags ash across impossible architecture.',
      'A chained ruin shifts against the sky as if the moon is pulling it closer.',
      'The battlefield kneels before one survivor and one predator.'
    ];
    return 'Cinematic Prompt - Day ' + day + ': ' + lines[Math.floor(Math.random() * lines.length)] + ' Opponent: ' + name + '.';
  }

  function maybeTriggerCrucibleExpeditionEncounter(match, forceBoss) {
    if (!match || !match.expedition || !match.active) return false;
    var expedition = match.expedition;
    if (String(expedition.phase || '') !== 'explore') return false;
    if (expedition.portalEvent && Number(expedition.portalEvent.remaining || 0) > 0) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (player && player.position) {
      var playerKey = String(player.position.q) + ',' + String(player.position.r);
      if (Array.isArray(expedition.miniBossHexKeys) && expedition.miniBossHexKeys.indexOf(playerKey) >= 0 && !expedition.miniBossDefeated[playerKey]) {
        var mini = pickCrucibleExpeditionEnemyProfile('mini');
        expedition.miniBossDefeated[playerKey] = true;
        var miniOk = spawnCrucibleExpeditionEnemy(match, {
          name: mini.name,
          look: mini.look,
          desc: mini.desc,
          die: 6,
          hp: 12,
          combatType: 'miniBoss',
          role: 'tank'
        });
        if (miniOk) match.log = (match.log || []).concat(['Mini Boss found in this hex: ' + mini.name + ' — ' + String(mini.desc || 'A ruin tyrant steps out of the dust.')]).slice(-120);
        if (miniOk) resolveCrucibleExpeditionDangerousWeather(match, 'Combat Start');
        if (miniOk) openCrucibleExpeditionCombatPopup(match);
        return miniOk;
      }
    }
    var openHexes = getCrucibleExpeditionOpenHexCount(match);
    var shouldForceBoss = !!forceBoss || openHexes <= 1;
    if (shouldForceBoss) {
      var boss = expedition.bosses[Math.max(0, Number(expedition.currentBossIndex || 0))] || expedition.bosses[0];
      if (!boss) return false;
      var tier = String(boss.tier || 'day1');
      var profile = pickCrucibleExpeditionEnemyProfile(tier === 'raid' ? 'raid' : tier);
      if (boss.fixedName) profile.name = String(boss.fixedName);
      var isRaidBoss = tier === 'raid';
      var nerfRaid = isRaidBoss && Number(expedition.portalsClosed || 0) >= Number(expedition.portalQuestTarget || 5);
      if (nerfRaid) {
        boss.die = 12;
        boss.hp = 24;
        expedition.raidBossNerfed = true;
      }
      var okBoss = spawnCrucibleExpeditionEnemy(match, {
        name: profile.name,
        look: profile.look,
        desc: profile.desc,
        die: Number(boss.die || (isRaidBoss ? 20 : 8)),
        hp: Number(boss.hp || (isRaidBoss ? 40 : 16)),
        combatType: isRaidBoss ? 'raidBoss' : (tier === 'day2' ? 'boss2' : 'boss1'),
        role: isRaidBoss ? 'tank' : 'assault',
        isRaidBoss: isRaidBoss
      });
      if (okBoss) {
        match.log = (match.log || []).concat([
          getCrucibleExpeditionCinematicPrompt(match, profile),
          'A major enemy emerges from the closing dark: ' + profile.name + ' — ' + String(profile.desc || 'No lore survives.') + (nerfRaid ? ' (portal mission succeeded: Lord reduced to d12 | 24 HP).' : '.')
        ]).slice(-120);
        resolveCrucibleExpeditionDangerousWeather(match, 'Boss Combat');
        openCrucibleExpeditionCombatPopup(match);
      }
      return okBoss;
    }
    var roll = Math.random();
    if (roll < 0.12) {
      var field = pickCrucibleExpeditionEnemyProfile('field');
      var monster = spawnCrucibleExpeditionEnemy(match, {
        name: field.name,
        look: field.look,
        desc: field.desc,
        die: 4,
        hp: 4,
        combatType: 'fieldEnemy',
        role: 'assault'
      });
      if (monster) match.log = (match.log || []).concat(['Field Enemy ambush: d4 Dread, 4 HP — ' + String(field.desc || 'It hunts the open lanes.').trim()]).slice(-120);
      if (monster) resolveCrucibleExpeditionDangerousWeather(match, 'Combat Start');
      if (monster) openCrucibleExpeditionCombatPopup(match);
      return monster;
    }
    if (roll < 0.18) {
      var fb = pickCrucibleExpeditionEnemyProfile('fieldboss');
      var fieldBoss = spawnCrucibleExpeditionEnemy(match, {
        name: fb.name,
        look: fb.look,
        desc: fb.desc,
        die: 6,
        hp: 12,
        combatType: 'fieldBoss',
        role: 'tank'
      });
      if (fieldBoss) match.log = (match.log || []).concat(['Field Boss appears: DD6 | 12 HP — ' + String(fb.desc || 'A provincial apex predator descends.').trim()]).slice(-120);
      if (fieldBoss) resolveCrucibleExpeditionDangerousWeather(match, 'Combat Start');
      if (fieldBoss) openCrucibleExpeditionCombatPopup(match);
      return fieldBoss;
    }
    if (roll < 0.25) {
      var collapsed = collapseCrucibleExpeditionEdge(match);
      match.log = (match.log || []).concat(['Weather shift: thunder-black winds cross the province. ' + (collapsed > 0 ? (collapsed + ' hexes collapsed early.') : 'No additional collapse this time.')]).slice(-120);
      return false;
    }
    return false;
  }

  function grantCrucibleExpeditionLoot(match, rewardType) {
    if (!match || !match.expedition) return '';
    var type = String(rewardType || '').toLowerCase();
    var pool = getCrucibleShopLootPool();
    if (!pool.length) return '';
    var preferredCats = type === 'fieldboss' || type === 'miniboss' || type === 'boss1' || type === 'boss2' || type === 'raidboss'
      ? ['weapons', 'armor']
      : ['items', 'essentials', 'weapon_mods'];
    var picks = pool.filter(function (entry) { return preferredCats.indexOf(entry.cat) >= 0; });
    if (!picks.length) picks = pool.slice();
    var chosen = picks[Math.floor(Math.random() * picks.length)] || picks[0];
    if (!chosen) return '';
    var label = String(chosen.name || 'Unknown Relic');
    if (type === 'fieldboss' || type === 'miniboss' || type === 'boss1' || type === 'boss2' || type === 'raidboss') {
      label = label + ' [' + rollCrucibleExpeditionAffix() + ']';
    }
    if ((chosen.cat === 'scrolls' || chosen.cat === 'weapon_mods' || chosen.cat === 'items' || chosen.cat === 'essentials') && Math.random() < 0.35) {
      label = label + ' [AD+1]';
    }
    match.expedition.runLoot = Array.isArray(match.expedition.runLoot) ? match.expedition.runLoot : [];
    match.expedition.runLoot.push(label);
    return label;
  }

  function grantCrucibleExpeditionBossBoon(match, tag) {
    if (!match || !match.expedition) return '';
    var expedition = match.expedition;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player) return '';
    var boons = [
      { id: 'flask', label: 'Extra HP Flask (+1 max, +1 current)' },
      { id: 'strike', label: '+d8 Strike power' },
      { id: 'shoot', label: '+d8 Shoot power' },
      { id: 'defend', label: '+d8 Defend power' },
      { id: 'flavor', label: 'Random Personal Flavor blessing' }
    ];
    var pickBoon = boons[Math.floor(Math.random() * boons.length)] || boons[0];
    if (pickBoon.id === 'flask') {
      expedition.maxFlasks = Math.max(1, Number(expedition.maxFlasks || 7) + 1);
      expedition.flasks = Math.min(Number(expedition.maxFlasks || 7), Number(expedition.flasks || 0) + 1);
    } else if (pickBoon.id === 'defend') {
      player.defendDie = Math.max(4, Number(player.defendDie || 8) + 8);
    } else if (pickBoon.id === 'flavor') {
      var flavorPool = ['Echo Step', 'Solar Needle', 'Runesmith', 'Duelist Footwork', 'Moon Listener'];
      player.personalFlavor = { name: flavorPool[Math.floor(Math.random() * flavorPool.length)] || 'Echo Step' };
    } else {
      player.attackDie = Math.max(4, Number(player.attackDie || 8) + 8);
    }
    expedition.boonLog = Array.isArray(expedition.boonLog) ? expedition.boonLog : [];
    expedition.boonLog.push('Day ' + Number(expedition.day || 1) + ' boon: ' + pickBoon.label + '.');
    return pickBoon.label;
  }

  function getHoldingPreferredCrucibleMode() {
    ensureNewFeatureState();
    var preferred = S && S.holding && S.holding.crucible ? S.holding.crucible.preferredMode : 'control';
    return getCrucibleModeSpec(preferred).id;
  }

  function buildCrucibleTacticalLayout(mode, seedRound) {
    var spec = getCrucibleModeSpec(mode);
    var rollSeed = Math.max(1, Number(seedRound || 1));
    var centerLane = (rollSeed % 2 === 0) ? 'Close' : 'Nearby';
    var highGroundLane = (rollSeed % 3 === 0) ? 'Far' : 'Nearby';
    var flankA = (rollSeed % 2 === 0) ? 'Engaged' : 'Far';
    var flankB = flankA === 'Engaged' ? 'Far' : 'Engaged';
    var lootLane = (rollSeed % 4 === 0) ? 'Engaged' : 'Close';
    var ammoLane = (rollSeed % 5 === 0) ? 'Far' : 'Nearby';
    var puzzleLane = (rollSeed % 3 === 0) ? 'Close' : 'Far';
    return {
      footprint: '60x60 ft',
      lanes: {
        short: 'Engaged',
        mid: 'Close',
        long: 'Nearby',
        deep: 'Far'
      },
      controlZones: {
        A: 'Engaged',
        B: centerLane,
        C: 'Far'
      },
      centerZone: centerLane,
      highGround: highGroundLane,
      flanks: [flankA, flankB],
      coverByRange: {
        Engaged: 1,
        Close: 2,
        Nearby: 2,
        Far: 1
      },
      pickups: {
        loot: { lane: lootLane, available: true, type: 'loot' },
        ammo: { lane: ammoLane, available: true, type: 'power-ammo' },
        puzzle: { lane: puzzleLane, available: true, type: 'puzzle' }
      },
      brief: spec.label + ': lanes short/mid/long + vertical platforms, cover objects, and power-ammo spawns.'
    };
  }

  function getCrucibleSpecialForUnit(unit) {
    if (!unit) return { name: 'Pressure Strike', saveStat: 'defend', effects: {} };
    var role = String(unit.role || '').toLowerCase();
    if (role === 'sniper') return { name: 'Suppressive Beam', saveStat: 'control', effects: { actionDrain: 1, condition: 'distracted' } };
    if (role === 'support') return { name: 'Null Hymn', saveStat: 'spirit', effects: { suppressFlavorRounds: 1, mentalStress: 1 } };
    if (role === 'tank') return { name: 'Shock Ram', saveStat: 'body', effects: { condition: 'shaken' } };
    if (role === 'assault') return { name: 'Hemorrhage Dash', saveStat: 'defend', effects: { condition: 'vulnerable' } };
    if (role === 'player') return { name: 'Wayfarer Gambit', saveStat: 'lead', effects: { actionDrain: 1 } };
    return { name: 'Pressure Strike', saveStat: 'defend', effects: {} };
  }

  function applyCrucibleSpecialEffectsToPlayer(special, log) {
    if (!special || !special.effects || !S) return [];
    var effects = special.effects;
    var applied = [];
    if (effects.condition && S.conditions && Object.prototype.hasOwnProperty.call(S.conditions, String(effects.condition))) {
      S.conditions[String(effects.condition)] = true;
      if (typeof updateConditionButtons === 'function') updateConditionButtons();
      if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
      applied.push('Condition ' + String(effects.condition));
    }
    if (Number(effects.mentalStress || 0) > 0) {
      var ms = Math.max(1, Number(effects.mentalStress || 0));
      if (typeof changeMentalStress === 'function') changeMentalStress(ms);
      else S.mentalStress = Math.max(0, Number(S.mentalStress || 0) + ms);
      applied.push('Mental Stress +' + ms);
    }
    if (Number(effects.radiation || 0) > 0) {
      var rad = Math.max(1, Number(effects.radiation || 0));
      if (typeof changeRads === 'function') changeRads(rad);
      else S.rads = Math.max(0, Number(S.rads || 0) + rad);
      applied.push('Radiation +' + rad);
    }
    if (Number(effects.actionDrain || 0) > 0) {
      var drain = Math.max(1, Number(effects.actionDrain || 0));
      if (!S.combat || typeof S.combat !== 'object') S.combat = {};
      S.combat.actionsLeft = Math.max(0, Number(S.combat.actionsLeft || 0) - drain);
      if (typeof updateCombatUI === 'function') updateCombatUI();
      applied.push('Actions -' + drain);
    }
    if (Number(effects.suppressFlavorRounds || 0) > 0) {
      var rounds = Math.max(1, Number(effects.suppressFlavorRounds || 0));
      if (!S.combat || typeof S.combat !== 'object') S.combat = {};
      S.combat.personalFlavorSuppressedRounds = Math.max(Number(S.combat.personalFlavorSuppressedRounds || 0), rounds);
      applied.push('Personal Flavor suppressed');
    }
    if (applied.length && log) log.push('Special effects on Wayfarer: ' + applied.join(', ') + '.');
    return applied;
  }

  function resolveCrucibleMapPickup(match, unit, log) {
    if (!match || !unit || !match.tacticalLayout || !match.tacticalLayout.pickups) return false;
    var pickups = match.tacticalLayout.pickups;
    var lane = String(unit.range || 'Close');
    var hit = false;
    Object.keys(pickups).forEach(function (key) {
      var node = pickups[key];
      if (!node || !node.available || String(node.lane || '') !== lane) return;
      node.available = false;
      hit = true;
      if (node.type === 'loot') {
        unit.attackDie = Math.max(4, Number(unit.attackDie || 6) + 2);
        log.push(unit.name + ' looted a weapon cache (+2 attack die).');
      } else if (node.type === 'power-ammo') {
        unit.powerAmmoBonus = Math.max(0, Number(unit.powerAmmoBonus || 0) + 2);
        log.push(unit.name + ' grabbed power ammo (+2 damage on next hit).');
      } else if (node.type === 'puzzle') {
        unit.defendBuff = Math.max(0, Number(unit.defendBuff || 0) + 2);
        if (unit.isPlayer && S.conditions && !S.conditions.focused) {
          S.conditions.focused = true;
          if (typeof updateConditionButtons === 'function') updateConditionButtons();
        }
        log.push(unit.name + ' solved a tactical puzzle (+2 defend, Focused if player).');
      }
    });
    return hit;
  }

  function buildCrucibleUnit(name, side, role, idx, hexPosition) {
    var safeRole = String(role || 'assault').toLowerCase();
    var baseAttack = safeRole === 'sniper' ? 10 : (safeRole === 'support' ? 8 : 8);
    var baseDefend = safeRole === 'tank' ? 10 : 8;
    var hp = safeRole === 'tank' ? 8 : 6;
    return {
      id: String(side) + '-' + String(idx + 1) + '-' + String(Date.now()),
      name: String(name || 'Unit'),
      side: String(side || 'ally'),
      role: safeRole,
      position: hexPosition || { q: 0, r: 0 },
      hp: hp,
      maxHp: hp,
      attackDie: baseAttack,
      defendDie: baseDefend,
      ap: 2,
      isPlayer: false,
      personalFlavor: null,
      conditions: {},
      equipment: { weapon: null, armor: null }
    };
  }

  function createCrucibleFallbackHexMap(size) {
    var mapSize = Math.max(7, Math.min(12, Number(size || 9)));
    var half = Math.floor(mapSize / 2);
    var allySpawn = { q: -half + 1, r: -half + 1 };
    var enemySpawn = { q: half - 1, r: half - 1 };
    var map = {
      seed: Date.now(),
      size: mapSize,
      hexes: {},
      objectives: [],
      spawns: { ally: allySpawn, enemy: enemySpawn }
    };
    for (var q = -half; q <= half; q++) {
      for (var r = -half; r <= half; r++) {
        if (Math.abs(q + r) > half) continue;
        var key = String(q) + ',' + String(r);
        map.hexes[key] = {
          q: q,
          r: r,
          terrain: 'open',
          obstacle: false,
          trap: null,
          loot: null,
          zone: null,
          hideSpot: false,
          door: false
        };
      }
    }
    [allySpawn, enemySpawn].forEach(function (spawn) {
      var key = String(Number(spawn.q || 0)) + ',' + String(Number(spawn.r || 0));
      if (map.hexes[key]) map.hexes[key].terrain = 'spawn';
    });
    return map;
  }

  function createHoldingCrucibleMatch() {
    ensureNewFeatureState();
    var crucible = S.holding.crucible;
    var modeSpec = getCrucibleModeSpec(crucible.preferredMode || 'control');
    if (modeSpec.id === 'expedition') {
      var expeditionMap = (typeof generateCrucibleHexMap === 'function')
        ? generateCrucibleHexMap(Date.now(), 13)
        : createCrucibleFallbackHexMap(13);
      stampCrucibleExpeditionProvinceBarriers(expeditionMap);
      stampCrucibleTemplesOnMap(expeditionMap, 4);
      var partyRoster = getCrucibleExpeditionPartyRoster();
      var allies = partyRoster.map(function (member, idx) {
        var spawn = getCrucibleExpeditionRandomDropHex(expeditionMap) || ((expeditionMap.spawns && expeditionMap.spawns.ally) ? expeditionMap.spawns.ally : { q: -1, r: -1 });
        return buildCrucibleExpeditionWayfarerFromSheet(member, idx, spawn, { isPrimaryPlayer: idx === 0 });
      });
      resetCrucibleTeamForTurn(allies);
      var expeditionState = createCrucibleExpeditionState(expeditionMap);
      allies.forEach(function (ally, idx) {
        var finalDrop = getCrucibleExpeditionRandomDropHex(expeditionMap) || ((expeditionMap.spawns && expeditionMap.spawns.ally) ? expeditionMap.spawns.ally : { q: -1, r: -1 });
        ally.position = { q: Number(finalDrop.q || -1), r: Number(finalDrop.r || -1) };
        if (idx === 0 && S) S.health = Number(ally.hp || S.health || 0);
      });
      crucible.match = {
        active: true,
        mode: modeSpec.id,
        round: 1,
        turnSide: 'ally',
        allies: allies,
        enemies: [],
        selectedAllyId: allies[0] ? allies[0].id : '',
        selectedEnemyId: '',
        selectedTargetId: '',
        selectedAllyTargetId: allies[0] ? allies[0].id : '',
        score: { ally: 0, enemy: 0 },
        hexMap: expeditionMap,
        interactables: [],
        roundWins: { ally: 0, enemy: 0 },
        expedition: expeditionState,
        log: [
          'Expedition launched: Day 1 in a collapsing province. Party size ' + allies.length + '.',
          'Lore: ' + expeditionState.loreSnippets[Math.floor(Math.random() * expeditionState.loreSnippets.length)]
        ],
        startedAt: Date.now(),
        finishedAt: 0,
        winner: ''
      };
      crucible.expedition.runs = Math.max(0, Number(crucible.expedition.runs || 0) + 1);
      return crucible.match;
    }
    var squadSize = Math.max(2, Number(modeSpec.teamSize || 3));
    var mapSize = Math.max(9, Number(modeSpec.mapSize || 9));
    var playerName = String((S && S.name) || 'Wayfarer');
    var controlLoadout = (crucible && crucible.controlLoadout && typeof crucible.controlLoadout === 'object')
      ? crucible.controlLoadout
      : { armor: 'balanced', weapon: 'sword' };

    // Generate hex map
    var hexMap = (typeof generateCrucibleHexMap === 'function')
      ? generateCrucibleHexMap(Date.now(), mapSize)
      : createCrucibleFallbackHexMap(mapSize);
    if (modeSpec.id === 'control') seedCrucibleControlMapFeatures(hexMap);

    // Generate environmental interactables and stamp them onto the map
    var _interactablesSeed = Date.now() + 1;
    var _interactables = (typeof generateCombatInteractables === 'function')
      ? generateCombatInteractables(_interactablesSeed, 9, 2 + (Math.random() < 0.5 ? 1 : 0))
      : [];
    if (typeof installInteractablesOnMap === 'function') installInteractablesOnMap(hexMap, _interactables);

    // Place units in spawn zones with staggered positions
    var allySpawn = hexMap.spawns && hexMap.spawns.ally || { q: -1, r: -1 };
    var enemySpawn = hexMap.spawns && hexMap.spawns.enemy || { q: 1, r: 1 };

    var allyOffsets = [
      { q: 0, r: 0 }, { q: -1, r: 0 }, { q: 1, r: -1 },
      { q: -1, r: 1 }, { q: 0, r: 1 }, { q: -1, r: -1 }
    ];
    var enemyOffsets = [
      { q: 0, r: 0 }, { q: 1, r: 0 }, { q: -1, r: 1 },
      { q: 1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: 1 }
    ];

    var allies = [];
    allies.push({
      id: 'ally-player-' + String(Date.now()),
      name: playerName,
      side: 'ally',
      role: 'player',
      position: { q: allySpawn.q + allyOffsets[0].q, r: allySpawn.r + allyOffsets[0].r },
      hp: Math.max(8, Number((S && S.health) || 12)),
      maxHp: Math.max(8, Number((S && S.health) || 12)),
      attackDie: Math.max(getCrucibleStatDie('strike', 8), getCrucibleStatDie('shoot', 8)),
      defendDie: getCrucibleStatDie('defend', 8),
      ap: 2,
      isPlayer: true,
      personalFlavor: null,
      conditions: {},
      equipment: { weapon: null, armor: null }
    });

    if (modeSpec.id === 'control') {
      var playerArmorLabel = String(controlLoadout.armor || 'balanced').toLowerCase();
      var playerWeaponLabel = String(controlLoadout.weapon || 'sword').toLowerCase();
      applyCrucibleControlLoadout(
        allies[0],
        playerArmorLabel === 'light' ? 'Light Armor' : (playerArmorLabel === 'heavy' ? 'Heavy Armor' : 'Balanced Armor'),
        playerWeaponLabel === 'shotgun' ? 'Shotgun' : (playerWeaponLabel === 'spell' ? 'Spell Focus' : 'Sword')
      );
    }

    var enemyNames = ['Vanguard Sel', 'Scout Arix', 'Binder Kori', 'Ravager Nyx', 'Sentry Vale'];
    var allRoles = ['tank', 'sniper', 'support', 'assault', 'tank'];
    var allyArmor = ['Light Armor', 'Balanced Armor', 'Heavy Armor'];
    var allyWeapons = ['Sword', 'Shotgun', 'Spell Focus'];

    for (var i = 1; i < squadSize; i++) {
      var allyHex = { q: allySpawn.q + allyOffsets[i].q, r: allySpawn.r + allyOffsets[i].r };
      var unit = buildCrucibleUnit(enemyNames[i - 1], 'ally', allRoles[i - 1], i, allyHex);
      if (typeof assignRandomPersonalFlavor === 'function') assignRandomPersonalFlavor(unit);
      if (modeSpec.id === 'control') {
        var allyArmorPick = allyArmor[Math.floor(Math.random() * allyArmor.length)];
        var allyWeaponPick = allyWeapons[Math.floor(Math.random() * allyWeapons.length)];
        applyCrucibleControlLoadout(unit, allyArmorPick, allyWeaponPick);
      }
      allies.push(unit);
    }

    var enemies = [];
    var redNames = ['Red Team Captain', 'Red Team Lancer', 'Red Team Marksman', 'Red Team Warden', 'Red Team Hexer', 'Red Team Stalker'];
    var redRoles = ['tank', 'assault', 'sniper', 'tank', 'support', 'assault'];
    var enemyArmor = ['Heavy Armor', 'Balanced Armor', 'Light Armor'];
    var enemyWeapons = ['Sword', 'Shotgun', 'Spell Focus'];

    for (var j = 0; j < squadSize; j++) {
      var enemyHex = { q: enemySpawn.q + enemyOffsets[j].q, r: enemySpawn.r + enemyOffsets[j].r };
      var enemy = buildCrucibleUnit(redNames[j], 'enemy', redRoles[j], j, enemyHex);
      if (typeof assignRandomPersonalFlavor === 'function') assignRandomPersonalFlavor(enemy);
      if (modeSpec.id === 'control') {
        var enemyArmorPick = enemyArmor[Math.floor(Math.random() * enemyArmor.length)];
        var enemyWeaponPick = enemyWeapons[Math.floor(Math.random() * enemyWeapons.length)];
        applyCrucibleControlLoadout(enemy, enemyArmorPick, enemyWeaponPick);
      }
      enemies.push(enemy);
    }

    resetCrucibleTeamForTurn(allies);
    enemies.forEach(function (u) {
      if (!u) return;
      u.ap = 0;
    });

    crucible.match = {
      active: true,
      mode: modeSpec.id,
      round: 1,
      turnSide: 'ally',
      allies: allies,
      enemies: enemies,
      selectedAllyId: allies[0] ? allies[0].id : '',
      selectedEnemyId: enemies[0] ? enemies[0].id : '',
      selectedTargetId: enemies[0] ? enemies[0].id : '',
      selectedAllyTargetId: allies[0] ? allies[0].id : '',
      score: { ally: 0, enemy: 0 },
      hexMap: hexMap,
      interactables: _interactables,
      roundWins: { ally: 0, enemy: 0 },
      controlLoaded: false,
      log: ['Crucible match opened: ' + squadSize + 'v' + squadSize + ' hex tactical simulation (' + modeSpec.label + '). Allies spawned at [' + allySpawn.q + ',' + allySpawn.r + '].'],
      startedAt: Date.now(),
      finishedAt: 0,
      winner: ''
    };
    return crucible.match;
  }

  function getHoldingCrucibleMatch() {
    ensureNewFeatureState();
    var c = S.holding.crucible;
    if (!(c && c.match && c.match.active)) return null;
    return c.match;
  }

  function getLivingTeamUnits(units) {
    return (Array.isArray(units) ? units : []).filter(function (u) { return u && Number(u.hp || 0) > 0; });
  }

  function getCrucibleRangeOrder() {
    return ['Engaged', 'Close', 'Nearby', 'Far'];
  }

  function normalizeCrucibleRange(value) {
    var wanted = String(value || '').toLowerCase();
    var order = getCrucibleRangeOrder();
    for (var i = 0; i < order.length; i++) {
      if (String(order[i]).toLowerCase() === wanted) return order[i];
    }
    return 'Close';
  }

  function getCrucibleRangeIndex(value) {
    var normalized = normalizeCrucibleRange(value);
    var order = getCrucibleRangeOrder();
    var idx = order.indexOf(normalized);
    return idx >= 0 ? idx : 1;
  }

  function getCrucibleUnitDistanceValue(attacker, defender) {
    if (!attacker || !defender || !attacker.position || !defender.position) return NaN;
    if (typeof getUnitDistance === 'function') {
      return Number(getUnitDistance(attacker, defender) || 0);
    }
    var aq = Number(attacker.position.q || 0);
    var ar = Number(attacker.position.r || 0);
    var dq = Number(defender.position.q || 0);
    var dr = Number(defender.position.r || 0);
    return (Math.abs(aq - dq) + Math.abs((aq + ar) - (dq + dr)) + Math.abs(ar - dr)) / 2;
  }

  function canCrucibleUnitAttack(attacker, defender) {
    if (!attacker || !defender || !attacker.position || !defender.position) return false;
    var dist = getCrucibleUnitDistanceValue(attacker, defender);
    return Number.isFinite(dist) && dist > 0 && dist <= getCrucibleUnitAttackMaxRange(attacker);
  }

  function canCrucibleUnitUseAttackType(attacker, defender, attackType) {
    if (!attacker || !defender || !attacker.position || !defender.position) return false;
    var dist = getCrucibleUnitDistanceValue(attacker, defender);
    if (!Number.isFinite(dist) || dist <= 0) return false;
    var kind = String(attackType || 'attack').toLowerCase();
    if (kind === 'strike') return dist === 1;
    if (kind === 'shoot') {
      var maxRange = getCrucibleUnitAttackMaxRange(attacker);
      return dist >= 2 && dist <= maxRange;
    }
    return canCrucibleUnitAttack(attacker, defender);
  }

  function canCrucibleUnitCastActionOnTarget(attacker, defender, kind) {
    if (!attacker || !defender || !attacker.position || !defender.position) return false;
    var actionKind = String(kind || 'spell').toLowerCase();
    var dist = getCrucibleUnitDistanceValue(attacker, defender);
    if (!Number.isFinite(dist) || dist <= 0) return false;
    if (actionKind === 'hack') return dist <= 2;
    return dist <= 3;
  }

  function parseCrucibleTargetRef(targetRef) {
    var raw = String(targetRef || '').trim();
    if (!raw || raw.indexOf(':') < 0) return { side: '', id: '' };
    var bits = raw.split(':');
    return {
      side: String(bits[0] || '').toLowerCase(),
      id: String(bits.slice(1).join(':') || '')
    };
  }

  function resolveCrucibleTargetUnit(match, targetRef) {
    var parsed = parseCrucibleTargetRef(targetRef);
    if (!match || !parsed.side || !parsed.id) return { target: null, side: '', id: '' };
    if (parsed.side !== 'ally' && parsed.side !== 'enemy') return { target: null, side: '', id: '' };
    return {
      target: findCrucibleUnit(match, parsed.side, parsed.id),
      side: parsed.side,
      id: parsed.id
    };
  }

  function canCrucibleActionTarget(actor, target, actionKey) {
    if (!actor || !target) return false;
    var key = String(actionKey || '').toLowerCase();
    if (key === 'attack' || key === 'strike' || key === 'shoot') {
      return canCrucibleUnitUseAttackType(actor, target, key);
    }
    if (key === 'spell' || key === 'hack') {
      return canCrucibleUnitCastActionOnTarget(actor, target, key);
    }
    if (key === 'personal-flavor') {
      var dist = getCrucibleUnitDistanceValue(actor, target);
      if (!Number.isFinite(dist) || dist <= 0) return false;
      if (typeof canUseCruciblePersonalFlavorRange === 'function') return canUseCruciblePersonalFlavorRange(dist);
      return dist <= 2;
    }
    return false;
  }

  function hasUnifiedSpellEngine() {
    return typeof getSpellCircumstanceProfile === 'function'
      && typeof openSpellCircumstancePrompt === 'function'
      && typeof evaluateSpellCircumstances === 'function';
  }

  function summarizeSpellCircumstanceAnswers(circData) {
    if (!circData || !Array.isArray(circData.resolved) || !circData.resolved.length) return 'No circumstance answers recorded.';
    return circData.resolved.map(function (row) {
      return (row.answer === 'yes' ? 'Yes' : 'No') + ': ' + row.question;
    }).join('<br>');
  }

  function buildUnifiedSpellManifestHtml(profile, success, margin) {
    var m = Math.max(1, Number(margin || 1));
    var p = profile || {};
    var successTiers = Array.isArray(p.successTiers) ? p.successTiers : [];
    var failureTiers = Array.isArray(p.failureTiers) ? p.failureTiers : [];
    var tierIdx = (typeof getSpellMarginTierIndex === 'function') ? getSpellMarginTierIndex(m) : Math.min(7, Math.floor((m - 1) / 1));
    var tier = success
      ? (successTiers[tierIdx] || successTiers[0] || { effect: 'Spell resolves.', castLook: 'Arcane signs bloom.', fieldLook: 'The air ripples.' })
      : (failureTiers[tierIdx] || failureTiers[0] || { effect: 'Spell fails.', castLook: 'The weave buckles.', fieldLook: 'Residual static fades.' });
    return {
      effect: String(tier.effect || ''),
      castLook: String(tier.castLook || ''),
      fieldLook: String(tier.fieldLook || '')
    };
  }

  function showUnifiedSpellResultModal(title, profile, payload) {
    if (typeof openModal !== 'function') return;
    var data = payload || {};
    var success = !!data.success;
    var margin = Math.max(1, Number(data.margin || 1));
    var manifest = buildUnifiedSpellManifestHtml(profile, success, margin);
    var failureBand = (!success && typeof getSpellFailureBandLabel === 'function') ? getSpellFailureBandLabel(margin) : '';
    var circumstances = summarizeSpellCircumstanceAnswers(data.circData);
    var backlashNotes = (!success && !data.manual && typeof applySpellFailureBacklash === 'function')
      ? (applySpellFailureBacklash(margin) || [])
      : [];
    var backlashHtml = backlashNotes.length
      ? ('<div style="margin-top:.35rem;font-size:.74rem;color:var(--red2);"><strong>Applied Backlash:</strong><br>' + backlashNotes.join('<br>') + '</div>')
      : '';
    var html = '<div style="font-size:.86rem;color:var(--text2);line-height:1.6;">'
      + '<div style="margin-bottom:.3rem;color:var(--muted2);">'
      + String(data.context || 'Spell action') + ' - '
      + '<strong style="color:' + (success ? 'var(--green2)' : 'var(--red2)') + ';">'
      + Number(data.actionTotal || 0) + ' vs ' + Number(data.dreadTotal || 0) + '</strong> '
      + '(margin ' + margin + ')' + (data.manual ? ' [manual]' : '')
      + '</div>'
      + '<div style="padding:.32rem .42rem;border:1px solid var(--border2);background:var(--surface);margin-bottom:.32rem;">'
      + '<div style="font-size:.68rem;color:var(--gold2);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.1rem;">Spell Manifestation</div>'
      + '<div style="font-size:.79rem;"><strong>Effect:</strong> ' + manifest.effect + '</div>'
      + '<div style="font-size:.75rem;color:var(--muted2);margin-top:.1rem;"><strong>Cast Look:</strong> ' + manifest.castLook + '</div>'
      + '<div style="font-size:.75rem;color:var(--muted2);margin-top:.08rem;"><strong>Around the Caster:</strong> ' + manifest.fieldLook + '</div>'
      + (!success && failureBand ? ('<div style="font-size:.75rem;color:var(--red2);margin-top:.12rem;"><strong>Failure Band:</strong> ' + failureBand + '</div>') : '')
      + '</div>'
      + '<div style="padding:.28rem .36rem;border:1px dashed var(--border2);background:rgba(255,255,255,.01);">'
      + '<div style="font-size:.66rem;color:var(--teal);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.08rem;">Circumstance Answers</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);line-height:1.45;">' + circumstances + '</div>'
      + '</div>'
      + backlashHtml
      + '</div>';
    openModal(title, html, null, { preventScroll: true, focusTrap: true });
  }

  function evaluateUnifiedSpellCircumstances(spellName, spellDesc, onResolved, onCancel) {
    if (!hasUnifiedSpellEngine()) {
      if (typeof onResolved === 'function') onResolved({ profile: null, circData: { resolved: [], modifierLines: [] } });
      return true;
    }
    var profile = getSpellCircumstanceProfile(spellName, spellDesc || '');
    openSpellCircumstancePrompt({
      scrollName: spellName,
      scrollDesc: spellDesc || '',
      profile: profile,
      onCancel: function () {
        if (typeof onCancel === 'function') onCancel();
      },
      onResolve: function (resolved) {
        var circData = evaluateSpellCircumstances(profile, resolved && resolved.answers ? resolved.answers : []);
        if (typeof onResolved === 'function') onResolved({ profile: profile, circData: circData });
      }
    });
    return true;
  }

  function resolveCrucibleSpellHackAction(actor, target, kind, match, logs, manualTotals, spellMeta) {
    if (!actor || !target || !match) return false;
    var actionKind = String(kind || 'spell').toLowerCase();
    var actionDie = actionKind === 'hack' ? getCrucibleStatDie('control', 8) : getCrucibleStatDie('spirit', 8);
    var dreadDie = Math.max(4, Number(target.attackDie || target.defendDie || 8));
    var actionTotal = 0;
    var dreadTotal = 0;

    if (manualTotals && Number.isFinite(manualTotals.action) && Number.isFinite(manualTotals.dread)) {
      actionTotal = Math.max(1, Number(manualTotals.action));
      dreadTotal = Math.max(1, Number(manualTotals.dread));
    } else {
      var actionRoll = (typeof explodingRoll === 'function') ? explodingRoll(actionDie, { type: 'action', major: true, label: 'Crucible ' + actionKind.toUpperCase() + ' d' + actionDie }) : { total: (Math.floor(Math.random() * actionDie) + 1) };
      var dreadRoll = (typeof explodingRoll === 'function') ? explodingRoll(dreadDie, { type: 'dread', major: true, label: 'Crucible Defense DD' + dreadDie }) : { total: (Math.floor(Math.random() * dreadDie) + 1) };
      actionTotal = Math.max(1, Number(actionRoll.total || 1));
      dreadTotal = Math.max(1, Number(dreadRoll.total || 1));
    }

    var circData = spellMeta && spellMeta.circData ? spellMeta.circData : null;
    if (!manualTotals && circData) {
      var spiritDie = getCrucibleStatDie('spirit', 8);
      actionTotal += Number(circData.mindFlat || 0);
      var spiritCounts = (typeof getSpellSpiritRollCounts === 'function')
        ? getSpellSpiritRollCounts(circData)
        : { add: circData.addSpiritBonus ? 1 : 0, sub: circData.addSpiritPenalty ? 1 : 0 };
      for (var spiritAddIdx = 0; spiritAddIdx < Number(spiritCounts.add || 0); spiritAddIdx++) {
        var spiritAddRoll = (typeof explodingRoll === 'function') ? explodingRoll(spiritDie, { type: 'action', major: true, label: 'Circumstance Spirit Bonus d' + spiritDie + ' #' + (spiritAddIdx + 1) }) : { total: (Math.floor(Math.random() * spiritDie) + 1) };
        actionTotal += Number(spiritAddRoll.total || 0);
      }
      for (var spiritSubIdx = 0; spiritSubIdx < Number(spiritCounts.sub || 0); spiritSubIdx++) {
        var spiritSubRoll = (typeof explodingRoll === 'function') ? explodingRoll(spiritDie, { type: 'action', major: true, label: 'Circumstance Spirit Penalty d' + spiritDie + ' #' + (spiritSubIdx + 1) }) : { total: (Math.floor(Math.random() * spiritDie) + 1) };
        actionTotal -= Number(spiritSubRoll.total || 0);
      }
      if (circData.stepUpAdvantage || circData.stepDownDisadvantage) {
        var auxDie = circData.stepUpAdvantage
          ? Math.min(20, actionDie >= 12 ? 20 : actionDie + 2)
          : Math.max(4, actionDie <= 4 ? 4 : actionDie - 2);
        var auxRoll = (typeof explodingRoll === 'function') ? explodingRoll(auxDie, { type: 'action', major: true, label: 'Circumstance ' + (circData.stepUpAdvantage ? 'StepUp' : 'StepDown') + ' d' + auxDie }) : { total: (Math.floor(Math.random() * auxDie) + 1) };
        actionTotal = circData.stepUpAdvantage
          ? Math.max(actionTotal, Number(auxRoll.total || 0))
          : Math.min(actionTotal, Number(auxRoll.total || 0));
      }
      if (Number(circData.valorStep || 0) !== 0) {
        var steppedDreadRoll = (typeof rollSpellSteppedDie === 'function')
          ? rollSpellSteppedDie(dreadDie, Number(circData.valorStep || 0), function (attemptIdx, info) {
              var lbl = 'Crucible Circumstance DD' + info.die;
              if (info.floorStepDowns > 0) lbl += ' Step-Down ' + (attemptIdx + 1) + '/' + (info.floorStepDowns + 1);
              return { type: 'dread', major: true, label: lbl };
            })
          : { total: (typeof explodingRoll === 'function') ? explodingRoll(Math.max(4, Number(dreadDie || 4))).total : (Math.floor(Math.random() * Math.max(4, Number(dreadDie || 4))) + 1) };
        dreadTotal = Math.max(1, Number(steppedDreadRoll.total || 1));
      }
      actionTotal = Math.max(1, Number(actionTotal || 1));
    }

    var success = actionTotal >= dreadTotal;
    var margin = Math.max(1, Math.abs(actionTotal - dreadTotal));
    var lockedAoeMode = normalizeCrucibleQueuedAoeMode(spellMeta && spellMeta.aoeMode, 'standard');
    if (success) {
      var aoeResult = applyCrucibleQueuedAoePacket(match, actor, target, actionKind, margin, lockedAoeMode, logs);
      if (aoeResult && Array.isArray(aoeResult.hits) && aoeResult.hits.length) {
        logs.push(actor.name + ' ' + (actionKind === 'hack' ? 'hacked' : 'cast a spell on') + ' ' + target.name + ': ' + actionTotal + ' vs ' + dreadTotal + ' [' + aoeResult.mode + ' AOE].');
        aoeResult.hits.forEach(function (hit) {
          if (!hit || !hit.unit) return;
          logs.push(' - ' + hit.unit.name + ' took ' + Number(hit.damage || 0) + ' dmg.' + (hit.downed ? ' ☠ down.' : ''));
          if (hit.downed) {
            var modeAoe = getCrucibleModeSpec(match.mode);
            awardCruciblePoints(match, String(actor.side || 'ally'), Number(modeAoe.killPoints || 1), 'Takedown');
            maybeRespawnCrucibleControlUnit(match, hit.unit, logs);
          }
        });
      } else {
        var dmg = Math.max(1, margin);
        target.hp = Math.max(0, Number(target.hp || 0) - dmg);
        logs.push(actor.name + ' ' + (actionKind === 'hack' ? 'hacked' : 'cast a spell on') + ' ' + target.name + ': ' + actionTotal + ' vs ' + dreadTotal + ' for ' + dmg + ' dmg.');
        if (target.hp <= 0) {
          logs.push('☠ ' + target.name + ' is down.');
          var mode = getCrucibleModeSpec(match.mode);
          awardCruciblePoints(match, String(actor.side || 'ally'), Number(mode.killPoints || 1), 'Takedown');
          maybeRespawnCrucibleControlUnit(match, target, logs);
        }
      }
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome('spell', margin, {
          actionTotal: actionTotal,
          dreadTotal: dreadTotal,
          context: (actionKind === 'hack' ? 'Hack' : 'Spell') + ' vs ' + target.name + ' (Crucible)'
        });
      }
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
    } else {
      logs.push(actor.name + ' ' + (actionKind === 'hack' ? 'hack attempt' : 'spell') + ' failed against ' + target.name + ': ' + actionTotal + ' vs ' + dreadTotal + '.');
      if (typeof addTMWOnFail === 'function') addTMWOnFail('crucible-' + actionKind + '-fail', { skipPrompt: true });
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome('spell', margin, {
          actionTotal: actionTotal,
          dreadTotal: dreadTotal,
          context: (actionKind === 'hack' ? 'Hack' : 'Spell') + ' vs ' + target.name + ' (Crucible)'
        });
      }
    }
    if (spellMeta && spellMeta.profile) {
      showUnifiedSpellResultModal(
        (actionKind === 'hack' ? 'Hack Manifestation' : 'Spell Manifestation') + ' - ' + target.name,
        spellMeta.profile,
        {
          success: success,
          margin: margin,
          actionTotal: actionTotal,
          dreadTotal: dreadTotal,
          context: (actionKind === 'hack' ? 'Hack' : 'Spell') + ' vs ' + target.name + ' (Crucible)',
          manual: !!manualTotals,
          circData: spellMeta.circData,
          aoeMode: lockedAoeMode
        }
      );
    }
    return true;
  }

  function openCrucibleManualSpellHackPrompt(actor, target, kind, spellMeta) {
    if (typeof openModal !== 'function') return false;
    ensureNewFeatureState();
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    S.holding.crucible.manualActionPending = {
      actorId: String(actor && actor.id || ''),
      targetId: String(target && target.id || ''),
      kind: String(kind || 'spell').toLowerCase(),
      spellMeta: spellMeta || null
    };
    var pendingKind = String(kind || 'spell').toLowerCase();
    var statKey = pendingKind === 'hack' ? 'control' : 'spirit';
    var actionDie = pendingKind === 'hack' ? getCrucibleStatDie('control', 8) : getCrucibleStatDie('spirit', 8);
    var dreadDie = Math.max(4, Number(target && (target.attackDie || target.defendDie || 8)));
    var extraLines = ['Enter final totals after applying all listed modifiers.'];
    if (spellMeta && spellMeta.circData && Array.isArray(spellMeta.circData.modifierLines)) {
      extraLines = extraLines.concat(spellMeta.circData.modifierLines);
    }
    var modifierLines = (typeof window !== 'undefined' && typeof window.buildManualRollModifierLines === 'function')
      ? (window.buildManualRollModifierLines(statKey, actionDie, { extraLines: extraLines }) || [])
      : [];
    var modifierHtml = modifierLines.length
      ? '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;line-height:1.5;">' + modifierLines.map(function(p){ return '<div>• ' + p + '</div>'; }).join('') + '</div>'
      : '';
    var html = '<div style="font-size:.82rem;color:var(--text2);line-height:1.5;">'
      + '<div style="margin-bottom:.2rem;">Manual ' + (pendingKind === 'hack' ? 'Hack' : 'Spell') + ': roll physically, apply modifiers, then enter Action and Dread totals.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:.3rem;">'
      + '<label style="font-size:.7rem;color:var(--muted2);">Action d' + actionDie + '<input id="crucibleManualAction" type="number" min="1" max="99" style="width:100%;margin-top:.08rem;"></label>'
      + '<label style="font-size:.7rem;color:var(--muted2);">Dread d' + dreadDie + '<input id="crucibleManualDread" type="number" min="1" max="99" style="width:100%;margin-top:.08rem;"></label>'
      + '</div>'
      + modifierHtml
      + '<div style="display:flex;justify-content:flex-end;gap:.3rem;margin-top:.26rem;">'
      + '<button class="btn btn-sm" onclick="goBackCrucibleManualActionRoll()">Go Back</button>'
      + '<button class="btn btn-sm" onclick="cancelCrucibleManualActionRoll()">Cancel</button>'
      + '<button class="btn btn-sm btn-primary" onclick="resolveCrucibleManualActionRoll()">Resolve</button>'
      + '</div>'
      + '</div>';
    openModal('Manual ' + (pendingKind === 'hack' ? 'Hack' : 'Spell') + ' Roll', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  window.goBackCrucibleManualActionRoll = function () {
    if (typeof goBackModal === 'function') {
      goBackModal();
    } else if (typeof closeModal === 'function') {
      closeModal();
    }
    return true;
  };

  window.cancelCrucibleManualActionRoll = function () {
    ensureNewFeatureState();
    if (S && S.holding && S.holding.crucible) S.holding.crucible.manualActionPending = null;
    if (typeof goBackModal === 'function') goBackModal();
    else if (typeof closeModal === 'function') closeModal();
    return true;
  };

  window.resolveCrucibleManualActionRoll = function () {
    ensureNewFeatureState();
    var match = getHoldingCrucibleMatch();
    var pending = S && S.holding && S.holding.crucible ? S.holding.crucible.manualActionPending : null;
    if (!match || !pending) {
      if (typeof showNotif === 'function') showNotif('No pending manual action.', 'warn');
      return false;
    }
    var actionInput = document.getElementById('crucibleManualAction');
    var dreadInput = document.getElementById('crucibleManualDread');
    var actionValue = Number(actionInput && actionInput.value);
    var dreadValue = Number(dreadInput && dreadInput.value);
    if (!Number.isFinite(actionValue) || !Number.isFinite(dreadValue)) {
      if (typeof showNotif === 'function') showNotif('Enter valid action and dread totals first.', 'warn');
      return false;
    }
    var actor = findCrucibleUnit(match, 'ally', pending.actorId);
    var target = findCrucibleUnit(match, 'enemy', pending.targetId);
    if (!actor || !target || Number(actor.hp || 0) <= 0 || Number(target.hp || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif('Actor or target is no longer valid.', 'warn');
      return false;
    }
    if (!spendCrucibleUnitAp(actor, 1)) {
      if (typeof showNotif === 'function') showNotif(actor.name + ' has no AP left.', 'warn');
      return false;
    }
    var logs = [];
    resolveCrucibleSpellHackAction(actor, target, pending.kind, match, logs, {
      action: actionValue,
      dread: dreadValue
    }, pending.spellMeta || null);
    match.log = (match.log || []).concat(logs).slice(-120);
    S.holding.crucible.manualActionPending = null;
    if (typeof goBackModal === 'function') goBackModal();
    else if (typeof closeModal === 'function') closeModal();
    maybeSyncCrucibleSelection(match);
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  };

  function findCrucibleUnit(match, side, id) {
    if (!match || !id) return null;
    var pool = String(side || '') === 'enemy' ? match.enemies : match.allies;
    for (var i = 0; i < (pool || []).length; i++) {
      if (String(pool[i] && pool[i].id || '') === String(id)) return pool[i];
    }
    return null;
  }

  function getSelectedCrucibleAlly(match) {
    var ally = match ? findCrucibleUnit(match, 'ally', match.selectedAllyId) : null;
    if (ally && Number(ally.hp || 0) > 0) return ally;
    var livingAllies = getLivingTeamUnits(match && match.allies);
    return livingAllies.length ? livingAllies[0] : null;
  }

  function getSelectedCrucibleTarget(match) {
    var target = match ? findCrucibleUnit(match, 'enemy', match.selectedTargetId) : null;
    if (target && Number(target.hp || 0) > 0) return target;
    var livingEnemies = getLivingTeamUnits(match && match.enemies);
    return livingEnemies.length ? livingEnemies[0] : null;
  }

  function executeCrucibleSpellHackWithCircumstances(actor, target, action, match, logs, useManualMode) {
    if (!actor || !target || !match) return false;
    var kind = String(action || 'spell').toLowerCase();
    var spellName = (kind === 'hack' ? 'Crucible Hack: ' : 'Crucible Spell: ') + String(actor.name || 'Caster') + ' -> ' + String(target.name || 'Target');
    var desc = kind === 'hack' ? 'Tactical intrusion cast during Crucible combat.' : 'Tactical spell cast during Crucible combat.';
    evaluateUnifiedSpellCircumstances(spellName, desc, function (resolved) {
      var spellMeta = { profile: resolved && resolved.profile, circData: resolved && resolved.circData ? resolved.circData : null };
      if (useManualMode) {
        openCrucibleManualSpellHackPrompt(actor, target, kind, spellMeta);
        return;
      }
      if (!spendCrucibleUnitAp(actor, 1)) {
        if (typeof showNotif === 'function') showNotif(actor.name + ' has no AP left.', 'warn');
        return;
      }
      resolveCrucibleSpellHackAction(actor, target, kind, match, logs, null, spellMeta);
      match.log = (match.log || []).concat(logs).slice(-120);
      maybeSyncCrucibleSelection(match);
      finalizeHoldingCrucibleMatch(match);
      renderHoldingCruciblePopup();
      renderHoldingUI();
    }, function () {
      if (typeof showNotif === 'function') showNotif('Spell/Hack cast cancelled.', 'warn');
    });
    return true;
  }

  function getSelectedCrucibleEnemy(match) {
    var enemy = match ? findCrucibleUnit(match, 'enemy', match.selectedEnemyId) : null;
    if (enemy && Number(enemy.hp || 0) > 0) return enemy;
    var livingEnemies = getLivingTeamUnits(match && match.enemies);
    return livingEnemies.length ? livingEnemies[0] : null;
  }

  function getSelectedCrucibleAllyTarget(match) {
    var ally = match ? findCrucibleUnit(match, 'ally', match.selectedAllyTargetId) : null;
    if (ally && Number(ally.hp || 0) > 0) return ally;
    var livingAllies = getLivingTeamUnits(match && match.allies);
    return livingAllies.length ? livingAllies[0] : null;
  }

  function getSelectedCrucibleActiveUnit(match) {
    return String(match && match.turnSide || 'ally') === 'enemy'
      ? getSelectedCrucibleEnemy(match)
      : getSelectedCrucibleAlly(match);
  }

  function resetCrucibleTeamForTurn(units) {
    (units || []).forEach(function (u) {
      if (!u) return;
      u.ap = Number(u.hp || 0) > 0 ? Math.max(1, Number(u.maxAp || 2)) : 0;
      u.defendBuff = 0;
    });
  }

  function maybeSyncCrucibleSelection(match) {
    if (!match) return;
    var ally = getSelectedCrucibleAlly(match);
    var enemy = getSelectedCrucibleEnemy(match);
    var target = getSelectedCrucibleTarget(match);
    var allyTarget = getSelectedCrucibleAllyTarget(match);
    match.selectedAllyId = ally ? ally.id : '';
    match.selectedEnemyId = enemy ? enemy.id : '';
    match.selectedTargetId = target ? target.id : '';
    match.selectedAllyTargetId = allyTarget ? allyTarget.id : '';
  }

  function spendCrucibleUnitAp(unit, amount) {
    if (!unit) return false;
    var cost = Math.max(0, Number(amount || 0));
    if (Number(unit.ap || 0) < cost) return false;
    unit.ap = Math.max(0, Number(unit.ap || 0) - cost);
    return true;
  }

  function awardCruciblePoints(match, side, points, reason) {
    if (!match || !match.score || (side !== 'ally' && side !== 'enemy')) return;
    var gain = Math.max(0, Number(points || 0));
    if (!gain) return;
    match.score[side] = Math.max(0, Number(match.score[side] || 0) + gain);
    if (reason) {
      var label = side === 'ally' ? 'Blue Team' : 'Red Team';
      match.log = (match.log || []).concat([label + ' +' + gain + ' score (' + reason + ').']).slice(-120);
    }
  }

  function updateCrucibleControlZoneProgress(match) {
    if (!match || !match.hexMap || !match.hexMap.hexes) return;
    var allyLookup = {};
    var enemyLookup = {};
    getLivingTeamUnits(match.allies || []).forEach(function (unit) {
      if (!unit || !unit.position) return;
      allyLookup[String(unit.position.q) + ',' + String(unit.position.r)] = true;
    });
    getLivingTeamUnits(match.enemies || []).forEach(function (unit) {
      if (!unit || !unit.position) return;
      enemyLookup[String(unit.position.q) + ',' + String(unit.position.r)] = true;
    });

    Object.keys(match.hexMap.hexes).forEach(function (key) {
      var cell = match.hexMap.hexes[key];
      if (!cell || !cell.zone) return;
      var zone = cell.zone;
      if (!zone.controlProgress || typeof zone.controlProgress !== 'object') {
        zone.controlProgress = { ally: 0, enemy: 0 };
      }
      var holdRequired = Math.max(1, Number(zone.holdRoundsRequired || 3));
      var allyHere = !!allyLookup[key];
      var enemyHere = !!enemyLookup[key];

      if (allyHere && !enemyHere) {
        zone.controlProgress.ally = Math.min(holdRequired, Math.max(0, Number(zone.controlProgress.ally || 0)) + 1);
        zone.controlProgress.enemy = 0;
        if (zone.controlProgress.ally >= holdRequired) zone.controlled = 'ally';
      } else if (enemyHere && !allyHere) {
        zone.controlProgress.enemy = Math.min(holdRequired, Math.max(0, Number(zone.controlProgress.enemy || 0)) + 1);
        zone.controlProgress.ally = 0;
        if (zone.controlProgress.enemy >= holdRequired) zone.controlled = 'enemy';
      } else {
        zone.controlProgress.ally = 0;
        zone.controlProgress.enemy = 0;
      }
    });
  }

  function evaluateCrucibleControlLane(match) {
    if (!match || !match.active) return;
    var mode = getCrucibleModeSpec(match.mode);
    if (mode.id !== 'control') return;
    updateCrucibleControlZoneProgress(match);
    var allyZones = (typeof getControlledZones === 'function') ? getControlledZones(getLivingTeamUnits(match.allies), match.hexMap) : [];
    var enemyZones = (typeof getControlledZones === 'function') ? getControlledZones(getLivingTeamUnits(match.enemies), match.hexMap) : [];
    if (allyZones.length >= 2 && enemyZones.length < 2) {
      awardCruciblePoints(match, 'ally', Number(mode.controlRoundPoint || 1), 'Controlled 2/3 zones this round');
      match.log = (match.log || []).concat(['Blue Team controls ' + allyZones.length + '/3 zones.']).slice(-120);
    } else if (enemyZones.length >= 2 && allyZones.length < 2) {
      awardCruciblePoints(match, 'enemy', Number(mode.controlRoundPoint || 1), 'Controlled 2/3 zones this round');
      match.log = (match.log || []).concat(['Red Team controls ' + enemyZones.length + '/3 zones.']).slice(-120);
    } else {
      match.log = (match.log || []).concat(['Round contested: no side held 2/3 zones.']).slice(-120);
    }
  }

  function maybeRespawnCrucibleControlUnit(match, unit, log) {
    if (!match || !unit || String(match.mode || '') !== 'control' || Number(unit.hp || 0) > 0) return false;
    var spawn = String(unit.side || '') === 'enemy'
      ? (match.hexMap && match.hexMap.spawns && match.hexMap.spawns.enemy)
      : (match.hexMap && match.hexMap.spawns && match.hexMap.spawns.ally);
    var safeSpawn = spawn || { q: 0, r: 0 };
    unit.hp = Number(unit.maxHp || 8);
    unit.ap = 0;
    unit.position = { q: Number(safeSpawn.q || 0), r: Number(safeSpawn.r || 0) };
    if (log) log.push('↺ ' + unit.name + ' respawned at [' + unit.position.q + ',' + unit.position.r + '].');
    return true;
  }

  function determineCrucibleWinner(match) {
    if (!match || !match.active) return '';
    var mode = getCrucibleModeSpec(match.mode);
    var alliesAlive = getLivingTeamUnits(match.allies).length;
    var enemiesAlive = getLivingTeamUnits(match.enemies).length;
    if (alliesAlive <= 0 && enemiesAlive <= 0) return 'enemies';
    if (mode.id === 'elimination') {
      if (enemiesAlive <= 0) {
        match.roundWins = match.roundWins || { ally: 0, enemy: 0 };
        match.roundWins.ally = Math.max(0, Number(match.roundWins.ally || 0) + 1);
        if (match.roundWins.ally >= Number(mode.scoreToWin || 5)) return 'allies';
        return '';
      }
      if (alliesAlive <= 0) {
        match.roundWins = match.roundWins || { ally: 0, enemy: 0 };
        match.roundWins.enemy = Math.max(0, Number(match.roundWins.enemy || 0) + 1);
        if (match.roundWins.enemy >= Number(mode.scoreToWin || 5)) return 'enemies';
        return '';
      }
    } else {
      if (enemiesAlive <= 0) return 'allies';
      if (alliesAlive <= 0) return 'enemies';
    }
    var allyScore = Math.max(0, Number(match.score && match.score.ally || 0));
    var enemyScore = Math.max(0, Number(match.score && match.score.enemy || 0));
    if (mode.id === 'control') {
      var maxRounds = Math.max(1, Number(mode.maxRounds || 10));
      if (Number(match.round || 1) <= maxRounds) return '';
      if (allyScore > enemyScore) return 'allies';
      if (enemyScore > allyScore) return 'enemies';
      return '';
    }
    if (allyScore >= Number(mode.scoreToWin || 0)) return 'allies';
    if (enemyScore >= Number(mode.scoreToWin || 0)) return 'enemies';
    return '';
  }

  function getRandomTeamTarget(units) {
    var living = getLivingTeamUnits(units);
    if (!living.length) return null;
    return living[Math.floor(Math.random() * living.length)] || null;
  }

  function runCrucibleAttack(attacker, defender, log, match) {
    if (!attacker || !defender || Number(attacker.hp || 0) <= 0 || Number(defender.hp || 0) <= 0) return false;
    var originalAttack = Number(attacker.attackDie || 0);
    var originalDefendBuff = Number(attacker.defendBuff || 0);
    if (match && String(match.mode || '') === 'expedition') {
      var attackFlavorBonus = applyCrucibleExpeditionFlavorRollBonus(match, attacker, attacker.role === 'sniper' ? 'shoot' : 'strike', 'attack');
      if (attackFlavorBonus) attacker.attackDie = Math.max(4, originalAttack + attackFlavorBonus);
      var defendFlavorBonus = applyCrucibleExpeditionFlavorRollBonus(match, attacker, 'defend', 'support');
      if (defendFlavorBonus) attacker.defendBuff = Math.max(0, originalDefendBuff + defendFlavorBonus);
    }
    var defenderHpBefore = Math.max(0, Number(defender.hp || 0));
    var hit = (typeof executeAttackAction === 'function')
      ? executeAttackAction(attacker, defender, match && match.hexMap, log)
      : false;
    var damage = Math.max(0, defenderHpBefore - Math.max(0, Number(defender.hp || 0)));
    attacker.attackDie = originalAttack;
    attacker.defendBuff = originalDefendBuff;
    if (!hit && typeof executeAttackAction !== 'function') return false;
    if (damage > 0) {
      var lastIndex = Array.isArray(log) ? (log.length - 1) : -1;
      if (lastIndex >= 0) {
        log[lastIndex] = String(log[lastIndex] || '').replace(' attacked ', ' hit ').replace(' damage.', ' dmg.');
      }
      if (defender.hp <= 0) {
        if (log) log.push('☠ ' + defender.name + ' is down.');
        var mode = getCrucibleModeSpec(match && match.mode);
        var bonus = (mode.id === 'rumble' && attacker.isPlayer) ? Number(mode.playerKillBonus || 0) : 0;
        awardCruciblePoints(match, String(attacker.side || 'ally'), Number(mode.killPoints || 1) + bonus, 'Takedown');
        maybeRespawnCrucibleControlUnit(match, defender, log);
      }
      var flavorBase = getCrucibleExpeditionFlavorBase(attacker);
      if (match && String(match.mode || '') === 'expedition' && flavorBase.indexOf('siphon energy') >= 0) {
        attacker.hp = Math.min(Number(attacker.maxHp || attacker.hp || 0), Number(attacker.hp || 0) + damage);
        if (log) log.push(attacker.name + ' siphoned ' + damage + ' HP from the hit.');
      }
    } else if (log && log.length) {
      var noDamageIndex = log.length - 1;
      log[noDamageIndex] = String(log[noDamageIndex] || '').replace(' attacked but ', ' attacked ').replace(' defended.', ' but dealt no damage.');
    }
    return damage > 0;
  }

  function beginCrucibleEnemyTurn(match) {
    if (!match || !match.active || String(match.turnSide || 'ally') === 'enemy') return false;
    resetCrucibleTeamForTurn(match.enemies);
    match.turnSide = 'enemy';
    maybeSyncCrucibleSelection(match);
    match.log = (match.log || []).concat(['Enemy phase begins. Command Red Team or hand it to Enemy AI.']).slice(-120);
    return true;
  }

  function finishCrucibleEnemyTurn(match, logs, fallbackLine) {
    if (!match || !match.active) return false;
    var entries = Array.isArray(logs) ? logs.filter(Boolean) : [];
    evaluateCrucibleControlLane(match);
    if (!entries.length && fallbackLine) entries.push(fallbackLine);
    if (entries.length) match.log = (match.log || []).concat(entries).slice(-120);
    (match.enemies || []).forEach(function (unit) {
      if (!unit) return;
      unit.ap = 0;
    });
    match.round = Math.max(1, Number(match.round || 1) + 1);
    var mode = getCrucibleModeSpec(match.mode);
    if (mode.id === 'control' && Number(mode.maxRounds || 10) > 0 && Number(match.round || 1) > Number(mode.maxRounds || 10)) {
      var allyScore = Math.max(0, Number(match.score && match.score.ally || 0));
      var enemyScore = Math.max(0, Number(match.score && match.score.enemy || 0));
      if (allyScore === enemyScore) {
        match.log = (match.log || []).concat(['Control regulation ended tied. Sudden death applies: next zone-control point wins.']).slice(-120);
      } else {
        match.active = false;
        match.finishedAt = Date.now();
        match.winner = allyScore > enemyScore ? 'allies' : 'enemies';
      }
    }
    if (typeof processInteractableRoundStart === 'function' && Array.isArray(match.interactables)) {
      processInteractableRoundStart(match.interactables, match.allies.concat(match.enemies), match.hexMap, match.log);
    }
    resetCrucibleTeamForTurn(match.allies);
    match.turnSide = 'ally';
    maybeSyncCrucibleSelection(match);
    return true;
  }

  function runCrucibleEnemyTurn(match) {
    if (!match || !match.active) return false;
    if (String(match.turnSide || 'ally') !== 'enemy') beginCrucibleEnemyTurn(match);
    var logs = [];
    var enemies = getLivingTeamUnits(match.enemies);
    for (var i = 0; i < enemies.length; i++) {
      var enemy = enemies[i];
      while (Number(enemy.ap || 0) > 0) {
        var allyTarget = getRandomTeamTarget(match.allies);
        if (!allyTarget) break;
        var special = getCrucibleSpecialForUnit(enemy);
        var useSpecial = Number(enemy.ap || 0) > 0 && Math.random() < 0.35;
        if (useSpecial && canCrucibleUnitAttack(enemy, allyTarget)) {
          spendCrucibleUnitAp(enemy, 1);
          var saveDie = Math.max(4, Number((typeof getEffectiveDie === 'function' && allyTarget.isPlayer)
            ? getEffectiveDie(String(special.saveStat || 'defend'))
            : (special.saveStat === 'body' ? 8 : 6)));
          var enemyRoll = (typeof explodingRoll === 'function') ? explodingRoll(Math.max(4, Number(enemy.attackDie || enemy.dread || 6))) : { total: (Math.floor(Math.random() * Math.max(4, Number(enemy.attackDie || enemy.dread || 6))) + 1) };
          var saveRoll = (typeof explodingRoll === 'function') ? explodingRoll(saveDie) : { total: (Math.floor(Math.random() * saveDie) + 1) };
          var dmgSpecial = Math.max(0, Number(enemyRoll.total || 0) - Number(saveRoll.total || 0));
          if (dmgSpecial > 0) {
            allyTarget.hp = Math.max(0, Number(allyTarget.hp || 0) - dmgSpecial);
            if (allyTarget.isPlayer) {
              S.health = Math.max(0, Number(S.health || 0) - dmgSpecial);
              applyCrucibleSpecialEffectsToPlayer(special, logs);
            }
          }
          logs.push(enemy.name + ' used ' + special.name + ' (' + String(special.saveStat || 'defend') + ' save): ' + Number(enemyRoll.total || 0) + ' vs ' + Number(saveRoll.total || 0) + (dmgSpecial > 0 ? (' for ' + dmgSpecial + ' dmg.') : ' blocked.'));
          continue;
        }
        if (canCrucibleUnitAttack(enemy, allyTarget)) {
          if (!spendCrucibleUnitAp(enemy, 1)) break;
          runCrucibleAttack(enemy, allyTarget, logs, match);
        } else {
          var eIdx = getCrucibleRangeIndex(enemy.range);
          var tIdx = getCrucibleRangeIndex(allyTarget.range);
          var nextIdx = eIdx > tIdx ? (eIdx - 1) : (eIdx + 1);
          nextIdx = Math.max(0, Math.min(getCrucibleRangeOrder().length - 1, nextIdx));
          if (!spendCrucibleUnitAp(enemy, 1)) break;
          enemy.range = getCrucibleRangeOrder()[nextIdx];
          logs.push(enemy.name + ' repositioned to ' + enemy.range + '.');
          resolveCrucibleMapPickup(match, enemy, logs);
        }
      }
    }
    finishCrucibleEnemyTurn(match, logs, 'Enemy turn ended with no effective actions.');
    return true;
  }

  function autoPlayCrucibleAllyTurn(match) {
    if (!match || !match.active) return false;
    var logs = [];
    var allies = getLivingTeamUnits(match.allies);
    for (var i = 0; i < allies.length; i++) {
      var ally = allies[i];
      while (Number(ally.ap || 0) > 0) {
        var target = getRandomTeamTarget(match.enemies);
        if (!target) break;
        if (canCrucibleUnitAttack(ally, target)) {
          spendCrucibleUnitAp(ally, 1);
          runCrucibleAttack(ally, target, logs, match);
        } else {
          var aIdx = getCrucibleRangeIndex(ally.range);
          var tIdx = getCrucibleRangeIndex(target.range);
          var step = aIdx > tIdx ? -1 : 1;
          var next = Math.max(0, Math.min(getCrucibleRangeOrder().length - 1, aIdx + step));
          spendCrucibleUnitAp(ally, 1);
          ally.range = getCrucibleRangeOrder()[next];
          logs.push(ally.name + ' moved to ' + ally.range + '.');
        }
      }
    }
    if (logs.length) match.log = (match.log || []).concat(logs).slice(-120);
    return true;
  }

  function finalizeHoldingCrucibleMatch(match) {
    if (!match || !match.active) return false;
    if (String(match.mode || '') === 'expedition' && match.expedition) {
      var expedition = match.expedition;
      var player = getCrucibleExpeditionPlayer(match);
      var enemiesAliveExp = getLivingTeamUnits(match.enemies).length;
      var playerDown = !player || Number(player.hp || 0) <= 0;
      var dayKey = String(Math.max(1, Number(expedition.day || 1)));
      var expMeta = (S && S.holding && S.holding.crucible && S.holding.crucible.expedition) ? S.holding.crucible.expedition : null;
      if (playerDown) {
        expedition.reviveUsedByDay = expedition.reviveUsedByDay || {};
        if (!expedition.reviveUsedByDay[dayKey]) {
          expedition.reviveUsedByDay[dayKey] = true;
          var revived = (match.allies || []).find(function (u) { return u && u.isPlayer; }) || player;
          if (revived) {
            revived.hp = Math.max(1, Math.floor(Number(revived.maxHp || 10) / 2));
            revived.ap = Math.max(1, Number(revived.ap || 1));
            expedition.phase = 'explore';
            match.enemies = [];
            match.turnSide = 'ally';
            match.log = (match.log || []).concat(['Wayfarer revival triggered (1/day). Returned at half HP for Day ' + dayKey + '.']).slice(-120);
            if (typeof showNotif === 'function') showNotif('Revive used for Day ' + dayKey + '. You return with half HP.', 'warn');
            return true;
          }
        }
        if (expMeta) {
          expMeta.bestDay = Math.max(Number(expMeta.bestDay || 0), Number(expedition.day || 1));
          expMeta.lastRunResult = 'Run ended on Day ' + Number(expedition.day || 1);
        }
        if (S && S.holding && S.holding.crucible) {
          S.holding.crucible.losses = Math.max(0, Number(S.holding.crucible.losses || 0) + 1);
          S.holding.crucible.currentWinStreak = 0;
          S.holding.crucible.lastResult = 'Expedition failed on Day ' + Number(expedition.day || 1);
        }
        match.active = false;
        match.finishedAt = Date.now();
        match.winner = 'enemies';
        match.log = (match.log || []).concat(['Run over. Return to the safe hub before attempting another expedition.']).slice(-120);
        if (typeof showNotif === 'function') showNotif('Expedition failed. Run over.', 'warn');
        return true;
      }
      if (enemiesAliveExp > 0) return false;
      if (String(expedition.phase || '') !== 'combat') return false;
      var rewardTag = String(expedition.currentCombatType || 'fieldMonster');
      if (rewardTag === 'portalWave') {
        expedition.phase = 'portalPuzzle';
        expedition.pendingPortalPuzzle = true;
        expedition.portalEvent = expedition.portalEvent || { hexKey: '' };
        expedition.portalEvent.needsClose = true;
        match.enemies = [];
        clearCrucibleExpeditionQueuedActions(match);
        match.log = (match.log || []).concat(['Portal guards eliminated. Use Close Portal to start the pipe puzzle and seal this breach.']).slice(-120);
        if (typeof showNotif === 'function') showNotif('Portal exposed. Close Portal is now available.', 'good');
        return true;
      }
      var reward = grantCrucibleExpeditionLoot(match, rewardTag);
      if (reward) {
        match.log = (match.log || []).concat(['Loot acquired: ' + reward + ' — ' + getCrucibleExpeditionLootDescription(reward) + '.']).slice(-120);
      }
      if (rewardTag === 'fieldEnemy') {
        var credits = Math.max(0, Number(expedition.pendingEnemyCredits || 0));
        if (credits > 0) {
          S.credits = Math.max(0, Number(S.credits || 0) + credits);
          if (typeof updateCreditsUI === 'function') updateCreditsUI();
          match.log = (match.log || []).concat(['Enemy bounty: +' + credits + ' Credits.']).slice(-120);
        }
        expedition.pendingEnemyCredits = 0;
      }
      if (rewardTag === 'fieldBoss') {
        match.log = (match.log || []).concat(['Field Boss trophy secured: affixed weapon/armor added to run loot.']).slice(-120);
      }
      if (rewardTag === 'miniboss') {
        if (expedition.activeRuin && match.hexMap && match.hexMap.hexes) {
          var ruinCell = match.hexMap.hexes[String(expedition.activeRuin.hexKey || '')];
          if (ruinCell && ruinCell.ruin) ruinCell.ruin.searched = true;
          expedition.clearedHexes = expedition.clearedHexes || {};
          expedition.clearedHexes[String(expedition.activeRuin.hexKey || '')] = true;
          expedition.activeRuin.cleared = true;
          expedition.phase = 'ruin';
        }
        match.log = (match.log || []).concat(['Mini Boss trophy secured: affixed weapon/armor added to run loot.']).slice(-120);
      }
      if (rewardTag === 'boss1' || rewardTag === 'boss2') {
        var boon = grantCrucibleExpeditionBossBoon(match, rewardTag);
        if (boon) match.log = (match.log || []).concat(['Boss boon gained: ' + boon + '.']).slice(-120);
        expedition.currentBossIndex = Math.max(0, Number(expedition.currentBossIndex || 0) + 1);
        if (rewardTag === 'boss1' || Number(expedition.day || 1) === 1) {
          resetCrucibleExpeditionMapForDay(match, 2);
          match.log = (match.log || []).concat(['Day 1 boss slain. The province resets for Day 2; collapse cadence accelerates.']).slice(-120);
          return true;
        }
        expedition.day = 3;
        expedition.phase = 'explore';
        expedition.collapseEveryClicks = 2;
        expedition.currentBossIndex = 2;
        maybeTriggerCrucibleExpeditionEncounter(match, true);
        match.log = (match.log || []).concat(['Teleport rupture: the Raid Boss arrives.']).slice(-120);
        return true;
      }
      if (rewardTag === 'raidboss') {
        if (expMeta) {
          expMeta.clears = Math.max(0, Number(expMeta.clears || 0) + 1);
          expMeta.bestDay = Math.max(Number(expMeta.bestDay || 0), 3);
          expMeta.lastRunResult = 'Raid Boss defeated';
        }
        if (S && S.holding && S.holding.crucible) {
          S.holding.crucible.wins = Math.max(0, Number(S.holding.crucible.wins || 0) + 1);
          S.holding.crucible.currentWinStreak = Math.max(0, Number(S.holding.crucible.currentWinStreak || 0) + 1);
          S.holding.crucible.bestWinStreak = Math.max(Number(S.holding.crucible.bestWinStreak || 0), Number(S.holding.crucible.currentWinStreak || 0));
          S.holding.crucible.lastResult = 'Expedition clear: Raid Boss defeated';
        }
        if (!S.solarCycleLegacy || typeof S.solarCycleLegacy !== 'object') S.solarCycleLegacy = {};
        S.solarCycleLegacy.raidPoints = Math.max(0, Number(S.solarCycleLegacy.raidPoints || 0) + 3);
        match.log = (match.log || []).concat(['Reward: +3 Raid Points.']).slice(-120);
        match.active = false;
        match.finishedAt = Date.now();
        match.winner = 'allies';
        if (typeof showNotif === 'function') showNotif('Raid Boss defeated. Expedition clear (+3 Raid Points).', 'good');
        return true;
      }
      expedition.phase = 'explore';
      expedition.currentCombatType = '';
      match.enemies = [];
      clearCrucibleExpeditionQueuedActions(match);
      resetCrucibleTeamForTurn(match.allies || []);
      match.turnSide = 'ally';
      maybeTriggerCrucibleExpeditionEncounter(match, false);
      return true;
    }
    var mode = getCrucibleModeSpec(match.mode);
    var winner = determineCrucibleWinner(match);
    if (!winner && mode.id === 'elimination') {
      var alliesAlive = getLivingTeamUnits(match.allies).length;
      var enemiesAlive = getLivingTeamUnits(match.enemies).length;
      if (alliesAlive <= 0 || enemiesAlive <= 0) {
        match.round = Math.max(1, Number(match.round || 1) + 1);
        match.log = (match.log || []).concat([
          'Elimination round reset. Score ' + Number(match.roundWins && match.roundWins.ally || 0) + ' - ' + Number(match.roundWins && match.roundWins.enemy || 0) + '.'
        ]).slice(-120);
        match.allies = (match.allies || []).map(function (unit) {
          if (!unit) return unit;
          unit.hp = Number(unit.maxHp || unit.hp || 10);
          unit.ap = 2;
          unit.defendBuff = 0;
          return unit;
        });
        match.enemies = (match.enemies || []).map(function (unit) {
          if (!unit) return unit;
          unit.hp = Number(unit.maxHp || unit.hp || 10);
          unit.ap = 2;
          unit.defendBuff = 0;
          return unit;
        });
        match.turnSide = 'ally';
        maybeSyncCrucibleSelection(match);
      }
      return false;
    }
    if (!winner) return false;
    var crucible = S.holding.crucible;
    match.active = false;
    match.finishedAt = Date.now();
    match.winner = winner;
    crucible.roundsPlayed = Math.max(0, Number(crucible.roundsPlayed || 0) + Number(match.round || 1));
    crucible.lastAt = Date.now();
    if (winner === 'allies') {
      crucible.wins = Math.max(0, Number(crucible.wins || 0) + 1);
      crucible.currentWinStreak = Math.max(0, Number(crucible.currentWinStreak || 0) + 1);
      crucible.bestWinStreak = Math.max(Number(crucible.bestWinStreak || 0), Number(crucible.currentWinStreak || 0));
      crucible.lastResult = 'Victory in ' + Number(match.round || 1) + ' rounds';
      if (typeof showNotif === 'function') showNotif('Crucible victory. Your squad held the tactical map.', 'good');
    } else {
      crucible.losses = Math.max(0, Number(crucible.losses || 0) + 1);
      crucible.currentWinStreak = 0;
      crucible.lastResult = 'Defeat in ' + Number(match.round || 1) + ' rounds';
      if (typeof showNotif === 'function') showNotif('Crucible defeat. Tune build and run it back.', 'warn');
    }
    return true;
  }

  function buildHoldingCrucibleBoardHtml(match, options) {
    if (!match || !match.hexMap) return '<div style="font-size:.74rem;color:var(--muted2);">No tactical map.</div>';
    var opts = options || {};
    var isExpedition = String(match.mode || '') === 'expedition';
    var expedition = isExpedition ? (match.expedition || {}) : null;
    var selectedUnit = getSelectedCrucibleActiveUnit(match);
    if (isExpedition && String(expedition.phase || 'explore') === 'explore') {
      var expeditionPlayer = getCrucibleExpeditionPlayer(match);
      if (expeditionPlayer) selectedUnit = expeditionPlayer;
    }
    var selectedTarget = String(match.turnSide || 'ally') === 'enemy'
      ? getSelectedCrucibleAllyTarget(match)
      : getSelectedCrucibleTarget(match);
    var allUnits = (match.allies || []).concat(match.enemies || []);
    var reachableHexes = [];
    var reachableKeys = [];
    if (selectedUnit && typeof getCrucibleOpenHexes === 'function') {
      var moveBudget = (isExpedition && String(expedition.phase || 'explore') === 'explore') ? 1 : Number(selectedUnit.ap || 0);
      if (moveBudget > 0) reachableHexes = getCrucibleOpenHexes(selectedUnit, match, moveBudget).filter(function (hex) {
        return !selectedUnit.position || hex.q !== selectedUnit.position.q || hex.r !== selectedUnit.position.r;
      });
    }
    reachableKeys = reachableHexes.map(function (hex) { return String(hex.q) + ',' + String(hex.r); });
    if (isExpedition && String(expedition.phase || 'explore') === 'explore' && match.hexMap && match.hexMap.hexes && selectedUnit && selectedUnit.position) {
      Object.keys(match.hexMap.hexes).forEach(function (key) {
        var cell = match.hexMap.hexes[key];
        if (!cell || (cell.terrain !== 'barrier' && !cell.barrier)) return;
        var q = Number(cell.q || 0);
        var r = Number(cell.r || 0);
        var distance = (Math.abs(Number(selectedUnit.position.q || 0) - q)
          + Math.abs((Number(selectedUnit.position.q || 0) + Number(selectedUnit.position.r || 0)) - (q + r))
          + Math.abs(Number(selectedUnit.position.r || 0) - r)) / 2;
        if (distance === 1 && !reachableKeys.includes(key)) {
          reachableHexes.push({ q: q, r: r });
          reachableKeys.push(key);
        }
      });
    }
    var details = (selectedUnit && typeof getHexUnitDetailsHtml === 'function')
      ? ('<div style="margin-top:.22rem;padding:.22rem .3rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);">' + getHexUnitDetailsHtml(selectedUnit) + '</div>')
      : '';
    var guidance = '';
    if (selectedUnit && String(match.turnSide || 'ally') === selectedUnit.side) {
      var ap = Number(selectedUnit.ap || 0);
      guidance = '<div style="font-size:.68rem;color:var(--muted2);margin:.18rem 0 .08rem;">'
        + 'Selected: <strong style="color:var(--ink);">' + String(selectedUnit.name || 'Unit') + '</strong>'
        + ' · AP ' + ap + ' · Use Move/Attack actions from the controls below.'
        + '</div>';
    }
    
    if (isExpedition && !opts.forceTacticalBoard && typeof buildCrucibleExpeditionProvinceParityMapHtml === 'function') {
      var provinceSvg = buildCrucibleExpeditionProvinceParityMapHtml(match, selectedUnit, reachableKeys);
      var mapZoom = Math.max(0.7, Math.min(2.6, Number(expedition.mapZoom || 1)));
      var highContrastOutline = !!expedition.highContrastOutline;
      var moveChooserHtml = (String(expedition.phase || 'explore') === 'explore' && selectedUnit && typeof buildCrucibleExpeditionMoveOptionsHtml === 'function')
        ? buildCrucibleExpeditionMoveOptionsHtml(match, selectedUnit, reachableHexes)
        : '';
      var descriptorHtml = (typeof buildCrucibleExpeditionProvinceDescriptorHtml === 'function')
        ? buildCrucibleExpeditionProvinceDescriptorHtml(match)
        : '';
      var interactables = Array.isArray(match.interactables) ? match.interactables : [];
      var interactablesPanel = (interactables.length && typeof buildInteractablePanelHtml === 'function')
        ? buildInteractablePanelHtml(interactables, selectedUnit)
        : '';
      var player = getCrucibleExpeditionPlayer(match);
      var playerCell = getCrucibleExpeditionCellFromPlayer(match);
      var contextualExpeditionButtons = '';
      if (playerCell && playerCell.gate && !playerCell.gate.closed) {
        contextualExpeditionButtons += '<button class="btn btn-sm" onclick="holdingCrucibleCloseExpeditionGate();">Close Gate</button>';
      }
      if (playerCell && playerCell.portal && !playerCell.portal.closed) {
        contextualExpeditionButtons += (String(expedition.phase || '') === 'portalPuzzle')
          ? '<button class="btn btn-sm btn-red" onclick="holdingCrucibleSolvePortalPuzzle();">Close Portal (Pipe Puzzle)</button>'
          : '<button class="btn btn-sm btn-red" onclick="holdingCrucibleBreachExpeditionPortal();">Breach Portal</button>';
      }
      if (playerCell && String(playerCell.terrain || '') === 'dwelling') {
        contextualExpeditionButtons += '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleRestAtDwelling();">Rest At Dwelling</button>';
      }
      if (playerCell && String(playerCell.terrain || '') === 'holding') {
        contextualExpeditionButtons += '<button class="btn btn-sm" onclick="holdingCrucibleUseHoldingUpgrade();">Holding Upgrade (100₵)</button>';
      }
      if (playerCell && playerCell.ruin && !playerCell.ruin.searched && !expedition.activeRuin) {
        contextualExpeditionButtons += '<button class="btn btn-sm btn-red" onclick="startCrucibleExpeditionRuinCrawl(getHoldingCrucibleMatch(), \'' + String((playerCell.q || 0) + ',' + (playerCell.r || 0)).replace(/'/g, '&#39;') + '\');renderHoldingCruciblePopup();renderHoldingUI();">Enter Ruin</button>';
      }
      var combatHint = (String(expedition.phase || 'explore') === 'combat' && getCrucibleExpeditionCurrentEnemy(match))
        ? '<div style="font-size:.68rem;color:var(--muted2);margin:.18rem 0 .08rem;">Combat is live on ' + (player && player.position ? ('Hex [' + (Number(player.position.q || 0) + 1) + ',' + (Number(player.position.r || 0) + 1) + ']') : 'this hex') + '.</div>'
        : '';
      var coreActions = '<div class="theos-region-actions">'
        + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExpeditionSearchHex();">Roll Encounter</button>'
        + (String(expedition.phase || '') === 'combat' ? '<button class="btn btn-sm btn-red" onclick="holdingCrucibleExpeditionSwitchTab(\'combat\');">Open Combat Page</button>' : '')
        + contextualExpeditionButtons
        + '</div>';
      var utilityActions = '<details class="card" style="margin-top:.28rem;">'
        + '<summary style="cursor:pointer;font-size:.72rem;color:var(--gold2);letter-spacing:.04em;text-transform:uppercase;">More Expedition Actions</summary>'
        + '<div class="theos-region-actions" style="margin-top:.22rem;">'
        + '<button class="btn btn-sm" onclick="holdingCrucibleExpeditionSwitchTab(\'wayfarer\');">Open Wayfarer</button>'
        + '<button class="btn btn-sm" onclick="window.openProvinceHexTileConfigurator();">🎨 Configure Hex Tiles</button>'
        + '<button class="btn btn-sm" onclick="holdingCrucibleResetMatch();">Abandon Run</button>'
        + '</div>'
        + '</details>';
      var provinceMeta = '<div class="card" style="margin-bottom:.25rem;">'
        + '<div class="section-title">Province Map</div>'
        + '<div class="theos-region-kicker">Expedition Province Map · Day ' + Number(expedition.day || 1) + '</div>'
        + '<p class="theos-region-copy">The Expedition board now uses the same Province-style layout and wilderness readout as the main Province tab.</p>'
        + '<div class="theos-chip-row">'
        + '<span class="theos-chip">Land</span>'
        + '<span class="theos-chip">Weather</span>'
        + '<span class="theos-chip">Flora Fauna</span>'
        + '<span class="theos-chip">Wonder</span>'
        + '<span class="theos-chip">Gates</span>'
        + '<span class="theos-chip">Portals</span>'
        + '</div>'
        + '<div style="display:flex;gap:.2rem;align-items:center;flex-wrap:wrap;margin:.2rem 0 .28rem 0;">'
        + '<span style="font-size:.68rem;color:var(--muted2);">Map Zoom</span>'
        + '<button class="btn btn-xs" onclick="holdingCrucibleExpeditionAdjustMapZoom(-0.2);">-</button>'
        + '<button class="btn btn-xs" onclick="holdingCrucibleExpeditionSetMapZoom(1);">Reset</button>'
        + '<button class="btn btn-xs" onclick="holdingCrucibleExpeditionAdjustMapZoom(0.2);">+</button>'
        + '<span style="font-size:.68rem;color:var(--gold2);">' + Math.round(mapZoom * 100) + '%</span>'
        + '<button class="btn btn-xs" onclick="holdingCrucibleExpeditionToggleHighContrastOutline();" style="margin-left:.18rem;">Outline: ' + (highContrastOutline ? 'High' : 'Normal') + '</button>'
        + '</div>'
        + combatHint
        + moveChooserHtml
        + '<div id="expeditionProvinceMapViewport" onwheel="return holdingCrucibleExpeditionHandleMapWheel(event);" onmousedown="return holdingCrucibleExpeditionViewportMouseDown(event);" onmousemove="return holdingCrucibleExpeditionViewportMouseMove(event);" onmouseup="return holdingCrucibleExpeditionViewportMouseUp();" onmouseleave="return holdingCrucibleExpeditionViewportMouseUp();" style="overflow:auto;max-height:72vh;border:1px solid rgba(255,255,255,.08);padding:.18rem;background:rgba(0,0,0,.14);cursor:grab;">'
        + '<div style="width:' + Math.round(760 * mapZoom) + 'px;margin:0 auto;">' + provinceSvg + '</div>'
        + '</div>'
        + coreActions
        + utilityActions
        + '</div>';
      return '<div style="margin-bottom:.25rem;">'
        + provinceMeta
        + descriptorHtml
        + interactablesPanel
        + details
        + '</div>';
    }

    if (typeof renderCrucibleHexMap === 'function') {
      var svgBoard = renderCrucibleHexMap(match.hexMap, allUnits, selectedUnit ? selectedUnit.id : '', {
        selectedTargetId: selectedTarget ? selectedTarget.id : '',
        reachableHexKeys: reachableKeys,
        turnSide: String(match.turnSide || 'ally'),
        collapsedHexKeys: isExpedition ? Object.keys(expedition.collapsed || {}) : []
      });
      var interactables = Array.isArray(match.interactables) ? match.interactables : [];
      if (interactables.length && typeof injectInteractablesIntoSvg === 'function') {
        svgBoard = injectInteractablesIntoSvg(svgBoard, interactables, null, 28);
      }
      var interactablesPanel = (interactables.length && typeof buildInteractablePanelHtml === 'function')
        ? buildInteractablePanelHtml(interactables, selectedUnit)
        : '';
      return '<div style="margin-bottom:.25rem;">'
        + guidance
        + svgBoard
        + interactablesPanel
        + details
        + '</div>';
    }
    
    // Fallback board placeholder
    var mode = getCrucibleModeSpec(match.mode);
    var layout = match.tacticalLayout || buildCrucibleTacticalLayout(mode.id, match.round);
    match.tacticalLayout = layout;
    var units = [];
    getLivingTeamUnits(match.allies).forEach(function (u) {
      units.push({ name: u.name, side: 'ally', isPlayer: !!u.isPlayer, hp: Number(u.hp || 0), range: String(u.range || 'Engaged') });
    });
    getLivingTeamUnits(match.enemies).forEach(function (u) {
      units.push({ name: u.name, side: 'enemy', isPlayer: false, hp: Number(u.hp || 0), range: String(u.range || 'Engaged') });
    });
    var boardRenderer = (typeof window !== 'undefined' && typeof window.buildLegacyRaidHexCombatBoard === 'function')
      ? window.buildLegacyRaidHexCombatBoard
      : null;
    if (boardRenderer) {
      try {
        var board = boardRenderer(units, {
          title: 'CRUCIBLE ' + getCrucibleModeTeamSize(mode.id) + 'V' + getCrucibleModeTeamSize(mode.id) + ' - TACTICAL MAP (' + mode.label.toUpperCase() + ')',
          subtitle: String(match.mapBrief || layout.brief || '3 lanes, platforms, cover, power ammo, and center high ground.'),
          seed: 'holding-crucible-' + String(match.round || 1),
          mode: String(mode.id || 'control'),
          missionId: 0,
          wingNum: 0
        });
        var mapMeta = '<div style="margin-bottom:.25rem;padding:.24rem .3rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);font-size:.7rem;color:var(--muted2);line-height:1.45;">'
          + '<strong style="color:var(--gold2);">Map:</strong> ' + String(layout.footprint || '60x60 ft') + ' · '
          + '<strong style="color:var(--teal);">Lanes:</strong> short/mid/long + deep flank · '
          + '<strong style="color:var(--teal);">High Ground:</strong> ' + String(layout.highGround || 'Nearby') + ' · '
          + '<strong style="color:var(--teal);">Center:</strong> ' + String(layout.centerZone || 'Close') + '<br>'
          + '<strong style="color:var(--gold2);">Cover:</strong> objects in every lane · '
          + '<strong style="color:var(--gold2);">Power Ammo:</strong> ' + String(layout.pickups && layout.pickups.ammo ? layout.pickups.ammo.lane : 'Nearby') + ' · '
          + '<strong style="color:var(--gold2);">Loot:</strong> ' + String(layout.pickups && layout.pickups.loot ? layout.pickups.loot.lane : 'Close') + ' · '
          + '<strong style="color:var(--gold2);">Puzzle:</strong> ' + String(layout.pickups && layout.pickups.puzzle ? layout.pickups.puzzle.lane : 'Far')
          + '</div>';
        return mapMeta + board;
      } catch (_err) {}
    }
    return '<div style="font-size:.74rem;color:var(--muted2);">Tactical map helper unavailable in this runtime.</div>';
  }

  function getCrucibleExpeditionCurrentEnemy(match) {
    if (!match) return null;
    var enemies = getLivingTeamUnits(match.enemies || []);
    return enemies.length ? enemies[0] : null;
  }

  function openCrucibleEnemyLore(unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var enemy = null;
    if (unitId) enemy = findCrucibleUnit(match, 'enemy', unitId);
    if (!enemy) enemy = getCrucibleExpeditionCurrentEnemy(match) || getSelectedCrucibleTarget(match);
    if (!enemy) {
      if (typeof showNotif === 'function') showNotif('No enemy selected.', 'warn');
      return false;
    }
    var profile = enemy.profile || {};
    var html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.55;">'
      + '<div style="font-family:Cinzel,serif;font-size:.92rem;color:var(--gold2);margin-bottom:.2rem;">' + String(profile.name || enemy.name || 'Unknown Enemy') + '</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.28rem;">Dread d' + Number(enemy.attackDie || 4) + ' · HP ' + Number(enemy.hp || 0) + '/' + Number(enemy.maxHp || enemy.hp || 0) + '</div>'
      + '<div style="margin-bottom:.32rem;padding:.28rem .34rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);">'
      + '<div style="font-size:.68rem;color:var(--gold2);margin-bottom:.08rem;">Appearance</div>'
      + '<div style="font-size:.76rem;color:var(--text2);">' + String(profile.look || 'No witness survived long enough to describe it.') + '</div>'
      + '</div>'
      + '<div style="padding:.28rem .34rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);">'
      + '<div style="font-size:.68rem;color:var(--gold2);margin-bottom:.08rem;">Field Notes</div>'
      + '<div style="font-size:.76rem;color:var(--text2);">' + String(profile.desc || 'It moves like memory, not muscle.') + '</div>'
      + '</div>'
      + '</div>';
    if (typeof openModal === 'function') openModal('Enemy Archive', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function buildCrucibleExpeditionCombatSectionHtml(match) {
    var expedition = match && match.expedition ? match.expedition : null;
    var enemy = getCrucibleExpeditionCurrentEnemy(match);
    if (!expedition || !enemy || String(expedition.phase || '') !== 'combat') return '';
    var selectedAlly = getSelectedCrucibleAlly(match);
    if (!selectedAlly) selectedAlly = chooseNextCrucibleExpeditionPlanner(match) || getCrucibleExpeditionPlayer(match);
    var player = getCrucibleExpeditionPlayer(match);
    var selectedTarget = getSelectedCrucibleTarget(match);
    var queued = getCrucibleExpeditionQueuedActions(match);
    var readyActors = getLivingTeamUnits(match.allies).filter(function (u) { return !!u && Number(u.ap || 0) > 0; }).length;
    var campaignPartyMode = isCrucibleExpeditionCampaignPartyMode();
    var wayfarerBudget = campaignPartyMode
      ? getCrucibleTeamActionBudget(match.allies || [])
      : getCrucibleUnitActionBudget(selectedAlly || player);
    var enemyBudget = getCrucibleTeamActionBudget(match.enemies || []);
    var wayfarerOptions = getCrucibleWayfarerActionOptionsHtml();
    var wayfarerTargetOptions = buildCrucibleEnemyTargetOptions(match, 'attack', selectedAlly);
    var teamTargetOptions = buildCrucibleTeamTargetOptions(match, 'attack', selectedAlly);
    var allyRows = getLivingTeamUnits(match.allies).map(function (u) {
      var on = selectedAlly && String(selectedAlly.id) === String(u.id);
      var flavor = (u.personalFlavor && u.personalFlavor.name) ? (' · PF:' + String(u.personalFlavor.name)) : '';
      var queuedCount = getCrucibleExpeditionQueuedActionCountForUnit(match, u.id);
      var status = queuedCount > 0 ? (' · Q' + queuedCount) : (Number(u.ap || 0) > 0 ? ' · Ready' : ' · Locked');
      return '<button class="btn btn-xs ' + (on ? 'btn-teal' : '') + '" onclick="selectHoldingCrucibleUnit(\'' + String(u.id).replace(/'/g, '&#39;') + '\')">'
        + u.name + ' [' + (u.position ? (u.position.q + ',' + u.position.r) : 'PA') + '] AP' + Number(u.ap || 0) + ' HP' + Number(u.hp || 0) + status + flavor
      + '</button>';
    }).join('');
    var targetRows = getLivingTeamUnits(match.enemies).map(function (u) {
      var on = selectedTarget && String(selectedTarget.id) === String(u.id);
      var dist = selectedAlly ? (typeof getUnitDistance === 'function' ? getUnitDistance(selectedAlly, u) : 0) : 0;
      return '<div style="display:flex;gap:.14rem;align-items:center;">'
        + '<button class="btn btn-xs ' + (on ? 'btn-red' : '') + '" onclick="selectHoldingCrucibleTarget(\'' + String(u.id).replace(/'/g, '&#39;') + '\')">'
        + u.name + ' [' + (u.position ? (u.position.q + ',' + u.position.r) : 'PA') + '] d:' + dist + ' HP' + Number(u.hp || 0)
        + '</button>'
        + '<button class="btn btn-xs" onclick="openCrucibleEnemyLore(\'' + String(u.id).replace(/'/g, '&#39;') + '\')">?</button>'
      + '</div>';
    }).join('');
    var actionDieBonus = Number(expedition.actionDieBonus || 0);
    var turnRail = '<div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:.16rem;align-items:center;margin-bottom:.28rem;">'
      + '<div style="text-align:center;padding:.16rem .2rem;border:1px solid rgba(70,196,182,.45);background:rgba(70,196,182,.12);font-size:.68rem;color:var(--teal);">' + (campaignPartyMode ? 'Plan Team Round' : 'Wayfarer Turn') + '</div>'
      + '<div style="font-size:.78rem;color:var(--muted2);text-align:center;">→</div>'
      + '<div style="text-align:center;padding:.16rem .2rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);font-size:.68rem;color:var(--gold2);">' + (campaignPartyMode ? 'Resolve' : 'Execute') + '</div>'
      + '<div style="font-size:.78rem;color:var(--muted2);text-align:center;">→</div>'
      + '<div style="text-align:center;padding:.16rem .2rem;border:1px solid rgba(200,80,80,.45);background:rgba(200,80,80,.12);font-size:.68rem;color:var(--red2);">Enemy Response</div>'
    + '</div>';
    var combatSection = '<details class="card" open style="margin-top:.25rem;">'
      + '<summary class="section-title" style="cursor:pointer;">Expedition Combat Round</summary>'
      + '<div style="font-size:.69rem;color:var(--muted2);margin:.18rem 0;">'
      + (campaignPartyMode
        ? ('Queued actions ' + queued.length + ' · Allies with AP remaining ' + readyActors + ' · Selected ' + String(selectedAlly && selectedAlly.name || 'Wayfarer'))
        : ('Wayfarer AP ' + Number(selectedAlly && selectedAlly.ap || 0) + ' · Enemy actions per turn 2 · Selected ' + String(selectedAlly && selectedAlly.name || 'Wayfarer')))
      + '</div>'
      + '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin:.04rem 0 .18rem 0;font-size:.67rem;color:var(--muted2);">'
      + '<span style="border:1px solid rgba(70,196,182,.35);padding:.12rem .24rem;background:rgba(70,196,182,.08);">Wayfarer Actions ' + Number(wayfarerBudget.used || 0) + '/' + Number(wayfarerBudget.total || 0) + '</span>'
      + '<span style="border:1px solid rgba(200,80,80,.35);padding:.12rem .24rem;background:rgba(200,80,80,.08);">Enemy Actions ' + Number(enemyBudget.used || 0) + '/' + Number(enemyBudget.total || 0) + '</span>'
      + '</div>'
      + turnRail
      + '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.2rem;align-items:end;margin-bottom:.22rem;">'
      + '<label style="font-size:.66rem;color:var(--muted2);">Selected Wayfarer'
      + '<select id="crucibleWayfarerActionSelect" onchange="refreshCrucibleWayfarerActionOptions();" style="width:100%;margin-top:.08rem;">' + wayfarerOptions + '</select></label>'
      + '<label style="font-size:.66rem;color:var(--muted2);">Target'
      + '<select id="crucibleWayfarerTargetSelect" style="width:100%;margin-top:.08rem;">' + wayfarerTargetOptions + '</select></label>'
      + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExecuteWayfarerAction();">' + (campaignPartyMode ? 'Queue' : 'Execute') + '</button>'
      + '</div>'
      + (campaignPartyMode ? ('<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:.2rem;align-items:end;margin-bottom:.22rem;">'
      + '<label style="font-size:.66rem;color:var(--muted2);">Team Action'
      + '<select id="crucibleTeamActionSelect" onchange="refreshCrucibleTeamActionOptions();" style="width:100%;margin-top:.08rem;">'
      + '<option value="personal-flavor">Personal Flavor</option>'
      + '<option value="defend">Defend (+3 next defend)</option>'
      + '<option value="attack" selected>Attack (Engaged/Close)</option>'
      + '<option value="support">Support (+3 next attack)</option>'
      + '<option value="move">Move (1 hex)</option>'
      + '</select></label>'
      + '<label style="font-size:.66rem;color:var(--muted2);">Target'
      + '<select id="crucibleTeamTargetSelect" style="width:100%;margin-top:.08rem;">' + teamTargetOptions + '</select></label>'
      + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExecuteTeamAction();">Queue</button>'
      + '</div>') : '')
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.32rem;">'
      + '<button class="btn btn-sm" onclick="holdingCrucibleEndSelectedUnit();">' + (campaignPartyMode ? 'Lock Selected Unit' : 'End Unit') + '</button>'
      + '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleAdvanceRound();">' + (campaignPartyMode ? 'Resolve Party Round' : (String(match.turnSide || 'ally') === 'enemy' ? 'End Enemy Turn' : 'Begin Enemy Turn')) + '</button>'
      + (!campaignPartyMode && String(match.turnSide || 'ally') === 'enemy' ? '<button class="btn btn-sm btn-red" onclick="holdingCrucibleRunEnemyAI();">Enemy AI Turn</button>' : '')
      + '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleAutoResolve();">Auto Resolve</button>'
      + '<button class="btn btn-sm" onclick="holdingCrucibleResetMatch();">Reset Match</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">'
      + '<div style="border:1px solid rgba(70,196,182,.35);padding:.28rem .34rem;background:linear-gradient(180deg,rgba(70,196,182,.08),rgba(255,255,255,.02));">'
      + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;margin-bottom:.2rem;">'
      + '<div style="font-size:.7rem;color:var(--teal);">Blue Side</div>'
      + '<div style="font-size:.64rem;color:var(--muted2);">AP / HP / PF</div>'
      + '</div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;max-height:6.5rem;overflow:auto;">' + (allyRows || '<div style="font-size:.72rem;color:var(--muted2);">No allies standing.</div>') + '</div>'
      + '</div>'
      + '<div style="border:1px solid rgba(200,80,80,.35);padding:.28rem .34rem;background:linear-gradient(180deg,rgba(200,80,80,.08),rgba(255,255,255,.02));">'
      + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;margin-bottom:.2rem;">'
      + '<div style="font-size:.7rem;color:var(--red2);">Red Side</div>'
      + '<div style="font-size:.64rem;color:var(--muted2);">Distance / HP / ?</div>'
      + '</div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;max-height:6.5rem;overflow:auto;">' + (targetRows || '<div style="font-size:.72rem;color:var(--muted2);">No enemies standing.</div>') + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="font-size:.69rem;color:var(--muted2);margin-bottom:.22rem;">'
      + 'Wayfarer action dice: ' + (player && Array.isArray(player.actionDice) ? player.actionDice.map(function (d) { return 'd' + d; }).join(', ') : 'd8, d6')
      + (actionDieBonus > 0 ? ' · Loot bonus: +' + actionDieBonus + ' Action Die step' + (actionDieBonus > 1 ? 's' : '') : '')
      + '</div>'
      + '<div style="font-size:.68rem;color:var(--muted2);margin-top:.18rem;">'
      + (campaignPartyMode
        ? 'Queue ally actions across the whole party, then resolve the round in one enemy response step.'
        : 'Control only your active Wayfarer. Execute actions immediately, then begin enemy turn when ready.')
      + '</div>'
      + '</details>';
    return combatSection;
  }

  function buildCrucibleExpeditionPopupHtml(match) {
    var expedition = match.expedition || {};
    var uiTab = String(expedition.uiTab || 'province');
    var player = getCrucibleExpeditionPlayer(match);
    var party = getCrucibleExpeditionParty(match);
    var enemy = getCrucibleExpeditionCurrentEnemy(match);
    var currentHexLabel = player && player.position
      ? ('Hex [' + (Number(player.position.q || 0) + 1) + ',' + (Number(player.position.r || 0) + 1) + ']')
      : 'Hex [--]';
    var portalGoal = Number(expedition.portalQuestTarget || 5);
    var portalsClosed = Number(expedition.portalsClosed || 0);
    var portalStatus = portalsClosed >= portalGoal ? 'Raid Boss weakened (d12 | 24 HP)' : ('Need ' + Math.max(0, portalGoal - portalsClosed) + ' more before Day 3');
    var openHexes = getCrucibleExpeditionOpenHexCount(match);
    var isCombatActive = String(expedition.phase || '') === 'combat' && !!enemy;
    var cadence = Math.max(1, Number(expedition.collapseEveryClicks || 1));
    var clicked = Math.max(0, Number(expedition.clickedHexes || 0));
    var nextCollapseIn = cadence - (clicked % cadence);
    if (nextCollapseIn <= 0) nextCollapseIn = cadence;
    var gatesClosed = Math.max(0, Number(expedition.gatesClosed || 0));
    var phaseLabel = String(expedition.phase || 'explore');
    var tabRow = '<div style="display:flex;gap:.22rem;margin-bottom:.3rem;">'
      + '<button class="btn btn-sm ' + (uiTab === 'province' ? 'btn-primary' : '') + '" onclick="holdingCrucibleExpeditionSwitchTab(\'province\')">Province</button>'
      + (isCombatActive || uiTab === 'combat' ? '<button class="btn btn-sm ' + (uiTab === 'combat' ? 'btn-primary' : '') + '" onclick="holdingCrucibleExpeditionSwitchTab(\'combat\')">Combat</button>' : '')
      + '<button class="btn btn-sm ' + (uiTab === 'wayfarer' ? 'btn-primary' : '') + '" onclick="holdingCrucibleExpeditionSwitchTab(\'wayfarer\')">Wayfarer</button>'
      + '</div>';
    var campaignPartyMode = isCrucibleExpeditionCampaignPartyMode();
    var top = '<div style="font-size:.82rem;color:var(--text2);line-height:1.55;">'
      + '<div style="font-family:Cinzel,serif;font-size:.92rem;color:var(--gold2);margin-bottom:.15rem;">Expedition Province Map</div>'
      + '<div style="font-size:.73rem;color:var(--muted2);margin-bottom:.12rem;">Day ' + Number(expedition.day || 1) + ' · '
      + (campaignPartyMode ? ('Party Round ' + Number(expedition.partyRound || 1)) : ('Combat Round ' + Number(match.round || 1)))
      + ' · Active ' + String(player && player.name || 'Wayfarer') + ' · ' + currentHexLabel + ' · Flasks ' + Number(expedition.flasks || 0) + '/' + Number(expedition.maxFlasks || 7) + ' · Open Hexes ' + Number(openHexes || 0) + '</div>'
      + '<div style="font-size:.69rem;color:var(--teal);margin-bottom:.08rem;">Day 1 closes edges every 6 hex clicks. Day 2 closes every 3 clicks. Day 3 pressure intensifies.</div>'
      + '<div style="font-size:.69rem;color:var(--gold2);margin-bottom:.28rem;">Portal Mission: ' + portalsClosed + '/' + portalGoal + ' closed in Nights 1-2 · ' + portalStatus + '</div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;margin:-.1rem 0 .24rem 0;font-size:.68rem;color:var(--muted2);">'
      + '<span style="border:1px solid var(--border2);padding:.1rem .24rem;">Phase: ' + phaseLabel + '</span>'
      + '<span style="border:1px solid var(--border2);padding:.1rem .24rem;">Portals: ' + portalsClosed + '/' + portalGoal + '</span>'
      + '<span style="border:1px solid var(--border2);padding:.1rem .24rem;">Gates: ' + gatesClosed + '</span>'
      + '<span style="border:1px solid var(--border2);padding:.1rem .24rem;">Open Hexes: ' + openHexes + '</span>'
      + '<span style="border:1px solid var(--border2);padding:.1rem .24rem;">Next Collapse: ' + nextCollapseIn + ' action(s)</span>'
      + '</div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;margin:-.08rem 0 .24rem 0;">' + party.map(function (ally, idx) {
        var active = ally && player && String(ally.id || '') === String(player.id || '');
        return '<button class="btn btn-xs ' + (active ? 'btn-teal' : '') + '" onclick="selectHoldingCrucibleUnit(\'' + String(ally && ally.id || '').replace(/'/g, '&#39;') + '\')">'
          + String(ally && ally.name || ('Wayfarer ' + (idx + 1))) + ' HP' + Number(ally && ally.hp || 0) + '</button>';
      }).join('') + '</div>'
      + tabRow;
    if (expedition.activeRuin && uiTab === 'province') {
      top += buildCrucibleExpeditionRuinCrawlHtml(match);
    }

    if (uiTab === 'wayfarer') {
      var loot = Array.isArray(expedition.runLoot) ? expedition.runLoot : [];
      var lootHtml = loot.length
        ? loot.map(function (it, idx) {
          var found = (typeof findShopItem === 'function') ? findShopItem(it) : null;
          var cat = String(found && found.cat || '').toLowerCase();
          var canUse = cat === 'scrolls' || cat === 'items' || cat === 'essentials' || cat === 'remedies';
          return '<div style="display:flex;justify-content:space-between;gap:.2rem;border-bottom:1px solid var(--border2);padding:.12rem 0;">'
            + '<span style="font-size:.72rem;color:var(--text2);"><strong>' + String(it) + '</strong><br><span style="font-size:.65rem;color:var(--muted2);">' + getCrucibleExpeditionLootDescription(it) + '</span></span>'
            + '<span style="display:flex;gap:.18rem;">'
            + '<button class="btn btn-xs" onclick="holdingCrucibleEquipExpeditionLoot(' + Number(idx) + ')">' + ((cat === 'armor' || cat === 'weapons') ? 'Equip' : 'Store') + '</button>'
            + (canUse ? '<button class="btn btn-xs btn-teal" onclick="holdingCrucibleUseExpeditionLoot(' + Number(idx) + ')">Use</button>' : '')
            + '</span>'
            + '</div>';
        }).join('')
        : '<div style="font-size:.72rem;color:var(--muted2);">No run loot yet.</div>';
      return top
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">'
        + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);">'
        + '<div style="font-size:.7rem;color:var(--gold2);margin-bottom:.16rem;">Wayfarer Sheet (Run-Local)</div>'
        + '<div style="font-size:.75rem;color:var(--text2);">HP: ' + Number(player && player.hp || 0) + '/' + Number(player && player.maxHp || 0) + '</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);">Attack Dread: d' + Number(player && player.attackDie || 0) + ' · Defend Dread: d' + Number(player && player.defendDie || 0) + '</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);margin-top:.15rem;">Run Weapon: ' + String(expedition.equipped && expedition.equipped.weapon || 'None') + '</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);">Run Armor: ' + String(expedition.equipped && expedition.equipped.armor || 'None') + '</div>'
        + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-top:.2rem;">'
        + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleUseExpeditionFlask();">Use Heal Flask</button>'
        + '<button class="btn btn-sm btn-teal" onclick="holdingCruciblePrayAtTemple();">Pray (if on Temple)</button>'
        + '</div>'
        + '<div style="font-size:.68rem;color:var(--muted2);margin-top:.15rem;">Run loot/equipment here does not modify your main character sheet.</div>'
        + '</div>'
        + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);max-height:220px;overflow:auto;">'
        + '<div style="font-size:.7rem;color:var(--gold2);margin-bottom:.16rem;">Run Loot Cache</div>' + lootHtml + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin-top:.35rem;">'
        + '<button class="btn btn-sm" onclick="holdingCrucibleExpeditionSwitchTab(\'province\')">Back To Province</button>'
        + '<button class="btn btn-sm" onclick="holdingCrucibleResetMatch();">Abandon Run</button>'
        + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleReturnToHolding();">Return To Holding</button>'
        + '</div></div>';
    }

    var useCombatPage = uiTab === 'combat';
    var board = buildHoldingCrucibleBoardHtml(match, {
      forceTacticalBoard: useCombatPage
    });
    var combatSection = buildCrucibleExpeditionCombatSectionHtml(match);
    var logLines = (match.log || []).slice(-10).reverse().map(function (line) {
      return '<div style="font-size:.72rem;color:var(--text2);line-height:1.45;border-bottom:1px solid var(--border2);padding:.12rem 0;">' + String(line || '') + '</div>';
    }).join('');

    if (useCombatPage) {
      var combatFooter = isCombatActive
        ? '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin-top:.32rem;">'
          + '<button class="btn btn-sm" onclick="holdingCrucibleExpeditionSwitchTab(\'province\')">View Province</button>'
          + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleReturnToHolding();">Return To Holding</button>'
          + '</div>'
        : '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin-top:.32rem;">'
          + '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleExpeditionSwitchTab(\'province\')">Return To Expedition</button>'
          + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleReturnToHolding();">Return To Holding</button>'
          + '</div>';
      return top
        + '<div class="card" style="margin-top:.1rem;">'
        + '<div class="section-title">Expedition Combat Page</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);margin:.1rem 0 .25rem;">Colosseum-style tactical board for encounter resolution. Finish combat, then return to Expedition.</div>'
        + combatSection
        + '<div style="margin-top:.3rem;">' + board + '</div>'
        + '<div style="margin-top:.35rem;border:1px solid var(--border2);padding:.28rem .34rem;max-height:180px;overflow:auto;background:rgba(255,255,255,.02);">' + (logLines || '<div style="font-size:.72rem;color:var(--muted2);">No events yet.</div>') + '</div>'
        + combatFooter
        + '</div></div>';
    }

    return top
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-bottom:.3rem;">'
      + '<button class="btn btn-sm" onclick="holdingCrucibleResetMatch();">Abandon Run</button>'
      + '</div>'
      + combatSection
      + '<div style="margin-top:.3rem;">' + board + '</div>'
      + '<div style="margin-top:.35rem;border:1px solid var(--border2);padding:.28rem .34rem;max-height:180px;overflow:auto;background:rgba(255,255,255,.02);">' + (logLines || '<div style="font-size:.72rem;color:var(--muted2);">No events yet.</div>') + '</div>'
      + '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin-top:.32rem;">'
      + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleReturnToHolding();">Return To Holding</button>'
      + '</div></div>';
  }

  function holdingCrucibleExpeditionSetMapZoom(value) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var zoom = Number(value);
    if (!Number.isFinite(zoom)) return false;
    match.expedition.mapZoom = Math.max(0.7, Math.min(2.6, zoom));
    renderHoldingCruciblePopup();
    return true;
  }

  function holdingCrucibleExpeditionAdjustMapZoom(delta) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var current = Number(match.expedition.mapZoom || 1);
    var next = current + Number(delta || 0);
    return holdingCrucibleExpeditionSetMapZoom(next);
  }

  function holdingCrucibleExpeditionToggleHighContrastOutline() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    match.expedition.highContrastOutline = !match.expedition.highContrastOutline;
    renderHoldingCruciblePopup();
    return true;
  }

  function holdingCrucibleExpeditionHandleMapWheel(evt) {
    var event = evt || (typeof window !== 'undefined' ? window.event : null);
    if (!event) return false;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    var delta = Number(event.deltaY || 0);
    if (!Number.isFinite(delta) || delta === 0) return false;
    return holdingCrucibleExpeditionAdjustMapZoom(delta > 0 ? -0.1 : 0.1);
  }

  function holdingCrucibleExpeditionViewportMouseDown(evt) {
    var event = evt || (typeof window !== 'undefined' ? window.event : null);
    if (!event || !S || !S.holding) return false;
    var viewport = document.getElementById('expeditionProvinceMapViewport');
    if (!viewport) return false;
    S.holding.crucibleDrag = {
      active: true,
      x: Number(event.clientX || 0),
      y: Number(event.clientY || 0),
      left: Number(viewport.scrollLeft || 0),
      top: Number(viewport.scrollTop || 0)
    };
    viewport.style.cursor = 'grabbing';
    return true;
  }

  function holdingCrucibleExpeditionViewportMouseMove(evt) {
    var event = evt || (typeof window !== 'undefined' ? window.event : null);
    var drag = S && S.holding ? S.holding.crucibleDrag : null;
    if (!event || !drag || !drag.active) return false;
    var viewport = document.getElementById('expeditionProvinceMapViewport');
    if (!viewport) return false;
    var dx = Number(event.clientX || 0) - Number(drag.x || 0);
    var dy = Number(event.clientY || 0) - Number(drag.y || 0);
    viewport.scrollLeft = Math.max(0, Number(drag.left || 0) - dx);
    viewport.scrollTop = Math.max(0, Number(drag.top || 0) - dy);
    if (typeof event.preventDefault === 'function') event.preventDefault();
    return true;
  }

  function holdingCrucibleExpeditionViewportMouseUp() {
    if (!S || !S.holding || !S.holding.crucibleDrag) return false;
    S.holding.crucibleDrag.active = false;
    var viewport = document.getElementById('expeditionProvinceMapViewport');
    if (viewport) viewport.style.cursor = 'grab';
    return true;
  }

  function buildHoldingCruciblePopupHtml() {
    var match = getHoldingCrucibleMatch();
    if (!match) {
      return '<div style="font-size:.82rem;color:var(--text2);line-height:1.55;">'
        + '<div style="font-family:Cinzel,serif;font-size:.88rem;color:var(--gold2);margin-bottom:.2rem;">Crucible Simulator</div>'
        + '<div style="font-size:.75rem;color:var(--muted2);margin-bottom:.35rem;">No active match. Start one from Holdings.</div>'
      + '</div>';
    }
    var alliesAlive = getLivingTeamUnits(match.allies).length;
    var enemiesAlive = getLivingTeamUnits(match.enemies).length;
    var mode = getCrucibleModeSpec(match.mode);
    var isExpedition = mode.id === 'expedition';
    if (isExpedition) return buildCrucibleExpeditionPopupHtml(match);
    var expedition = isExpedition ? (match.expedition || {}) : null;
    maybeSyncCrucibleSelection(match);
    var isEnemyTurn = String(match.turnSide || 'ally') === 'enemy';
    var selectedAlly = getSelectedCrucibleAlly(match);
    var selectedEnemy = getSelectedCrucibleEnemy(match);
    var selectedTarget = getSelectedCrucibleTarget(match);
    var selectedAllyTarget = getSelectedCrucibleAllyTarget(match);
    var selectedActiveUnit = isEnemyTurn ? selectedEnemy : selectedAlly;
    var allyRows = getLivingTeamUnits(match.allies).map(function (u) {
      var on = isEnemyTurn
        ? (selectedAllyTarget && String(selectedAllyTarget.id) === String(u.id))
        : (selectedAlly && String(selectedAlly.id) === String(u.id));
      var flavor = (u.personalFlavor && u.personalFlavor.name) ? (' · PF:' + String(u.personalFlavor.name)) : '';
      var armorAp = Number(u.maxAp || 2);
      var rangeCap = getCrucibleUnitAttackMaxRange(u);
      var handler = isEnemyTurn ? 'selectHoldingCrucibleAllyTarget' : 'selectHoldingCrucibleUnit';
      return '<button class="btn btn-xs ' + (on ? 'btn-teal' : '') + '" onclick="' + handler + '(\'' + String(u.id).replace(/'/g, '&#39;') + '\')">'
        + u.name + ' [' + (u.position ? (u.position.q + ',' + u.position.r) : 'PA') + '] AP' + Number(u.ap || 0) + '/' + armorAp + ' HP' + Number(u.hp || 0) + ' R' + rangeCap + flavor
      + '</button>';
    }).join('');
    var targetRows = getLivingTeamUnits(match.enemies).map(function (u) {
      var on = isEnemyTurn
        ? (selectedEnemy && String(selectedEnemy.id) === String(u.id))
        : (selectedTarget && String(selectedTarget.id) === String(u.id));
      var dist = selectedActiveUnit ? (typeof getUnitDistance === 'function' ? getUnitDistance(selectedActiveUnit, u) : 0) : 0;
      var handler = isEnemyTurn ? 'selectHoldingCrucibleEnemy' : 'selectHoldingCrucibleTarget';
      return '<div style="display:flex;gap:.14rem;align-items:center;">'
        + '<button class="btn btn-xs ' + (on ? 'btn-red' : '') + '" onclick="' + handler + '(\'' + String(u.id).replace(/'/g, '&#39;') + '\')">'
        + u.name + ' [' + (u.position ? (u.position.q + ',' + u.position.r) : 'PA') + '] d:' + dist + ' HP' + Number(u.hp || 0)
        + '</button>'
        + '<button class="btn btn-xs" onclick="openCrucibleEnemyLore(\'' + String(u.id).replace(/'/g, '&#39;') + '\')">?</button>'
      + '</div>';
    }).join('');
    var canAct = !!(!isEnemyTurn && selectedAlly && Number(selectedAlly.hp || 0) > 0 && Number(selectedAlly.ap || 0) > 0);
    var canEnemyAct = !!(isEnemyTurn && selectedEnemy && Number(selectedEnemy.hp || 0) > 0 && Number(selectedEnemy.ap || 0) > 0);
    var canMoveActive = !!(selectedActiveUnit && Number(selectedActiveUnit.hp || 0) > 0 && Number(selectedActiveUnit.ap || 0) > 0);
    var allyBudget = getCrucibleTeamActionBudget(match.allies || []);
    var enemyBudget = getCrucibleTeamActionBudget(match.enemies || []);
    var currentTurn = !isEnemyTurn ? 'Your Team Turn' : 'Enemy Turn';
    var scoreLine = mode.id === 'elimination'
      ? ('Round Wins ' + Number(match.roundWins && match.roundWins.ally || 0) + ' - ' + Number(match.roundWins && match.roundWins.enemy || 0) + ' (target ' + Number(mode.scoreToWin || 5) + ')')
      : ('Score ' + Number(match.score && match.score.ally || 0) + ' - ' + Number(match.score && match.score.enemy || 0) + ' (target ' + Number(mode.scoreToWin || 0) + ')');
    if (mode.id === 'control') {
      scoreLine = 'Zone Score ' + Number(match.score && match.score.ally || 0) + ' - ' + Number(match.score && match.score.enemy || 0)
        + ' · Round ' + Number(match.round || 1) + '/' + Number(mode.maxRounds || 10);
    }
    if (isExpedition) {
      scoreLine = 'Day ' + Number(expedition.day || 1)
        + ' · Flasks ' + Number(expedition.flasks || 0) + '/' + Number(expedition.maxFlasks || 7)
        + ' · Open Hexes ' + Number(getCrucibleExpeditionOpenHexCount(match) || 0);
    }
    var wayfarerOptions = getCrucibleWayfarerActionOptionsHtml();
    var wayfarerTargetOptions = buildCrucibleEnemyTargetOptions(match, 'attack', selectedAlly);
    var teamTargetOptions = buildCrucibleTeamTargetOptions(match, 'attack', selectedAlly);
    var enemyTargetOptions = buildCrucibleEnemyTargetOptions(match, 'attack', selectedEnemy);
    var railMine = !isEnemyTurn;
    var turnRail = '<div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:.16rem;align-items:center;margin-bottom:.3rem;">'
      + '<div style="text-align:center;padding:.16rem .2rem;border:1px solid ' + (railMine ? 'rgba(70,196,182,.45)' : 'var(--border2)') + ';background:' + (railMine ? 'rgba(70,196,182,.12)' : 'rgba(255,255,255,.02)') + ';font-size:.68rem;color:' + (railMine ? 'var(--teal)' : 'var(--muted2)') + ';">Your Team</div>'
      + '<div style="font-size:.78rem;color:var(--muted2);text-align:center;">→</div>'
      + '<div style="text-align:center;padding:.16rem .2rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);font-size:.68rem;color:var(--gold2);">Execute</div>'
      + '<div style="font-size:.78rem;color:var(--muted2);text-align:center;">→</div>'
      + '<div style="text-align:center;padding:.16rem .2rem;border:1px solid ' + (!railMine ? 'rgba(200,80,80,.45)' : 'var(--border2)') + ';background:' + (!railMine ? 'rgba(200,80,80,.12)' : 'rgba(255,255,255,.02)') + ';font-size:.68rem;color:' + (!railMine ? 'var(--red2)' : 'var(--muted2)') + ';">Enemy Team</div>'
    + '</div>';
    var turnControlsHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.2rem;align-items:end;margin-bottom:.22rem;">'
      + '<label style="font-size:.66rem;color:var(--muted2);">Wayfarer Actions'
      + '<select id="crucibleWayfarerActionSelect" onchange="refreshCrucibleWayfarerActionOptions();" style="width:100%;margin-top:.08rem;" ' + (isEnemyTurn ? 'disabled' : '') + '>' + wayfarerOptions + '</select></label>'
      + '<label style="font-size:.66rem;color:var(--muted2);">Target'
      + '<select id="crucibleWayfarerTargetSelect" style="width:100%;margin-top:.08rem;" ' + (isEnemyTurn ? 'disabled' : '') + '>' + wayfarerTargetOptions + '</select></label>'
      + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExecuteWayfarerAction();" ' + (canAct ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Execute</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.2rem;align-items:end;margin-bottom:.22rem;">'
      + '<label style="font-size:.66rem;color:var(--muted2);">Team Action'
      + '<select id="crucibleTeamActionSelect" onchange="refreshCrucibleTeamActionOptions();" style="width:100%;margin-top:.08rem;" ' + (isEnemyTurn ? 'disabled' : '') + '>'
      + '<option value="personal-flavor">Personal Flavor</option>'
      + '<option value="defend">Defend (+3 next defend)</option>'
      + '<option value="attack" selected>Attack (Engaged/Close)</option>'
      + '<option value="support">Support (+3 next attack)</option>'
      + '</select></label>'
      + '<label style="font-size:.66rem;color:var(--muted2);">Target'
      + '<select id="crucibleTeamTargetSelect" style="width:100%;margin-top:.08rem;" ' + (isEnemyTurn ? 'disabled' : '') + '>' + teamTargetOptions + '</select></label>'
      + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExecuteTeamAction();" ' + (canAct ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Execute</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.2rem;align-items:end;margin-bottom:.3rem;">'
      + '<label style="font-size:.66rem;color:var(--muted2);">Enemy Action'
      + '<select id="crucibleEnemyActionSelect" onchange="refreshCrucibleEnemyActionOptions();" style="width:100%;margin-top:.08rem;" ' + (!isEnemyTurn ? 'disabled' : '') + '>'
      + '<option value="personal-flavor">Personal Flavor</option>'
      + '<option value="defend">Defend (+3 next defend)</option>'
      + '<option value="attack" selected>Attack (Engaged/Close)</option>'
      + '<option value="support">Support (+3 next attack)</option>'
      + (isExpedition ? '<option value="move">Move Action (random)</option>' : '')
      + '</select></label>'
      + '<label style="font-size:.66rem;color:var(--muted2);">Target'
      + '<select id="crucibleEnemyTargetSelect" style="width:100%;margin-top:.08rem;" ' + (!isEnemyTurn ? 'disabled' : '') + '>' + enemyTargetOptions + '</select></label>'
      + '<button class="btn btn-sm btn-red" onclick="holdingCrucibleExecuteEnemyAction();" ' + (canEnemyAct ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>Execute</button>'
      + '</div>'
      + (!isEnemyTurn
        ? '<div style="font-size:.68rem;color:var(--muted2);margin-top:-.1rem;margin-bottom:.2rem;">Enemy Action controls unlock on Enemy Turn. Use <strong>Begin Enemy Turn</strong> when ready.</div>'
        : '');
    var phaseButtonsHtml = '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-bottom:.35rem;">'
      + '<button class="btn btn-sm" onclick="holdingCrucibleEndSelectedUnit();" ' + ((isEnemyTurn ? canEnemyAct : canAct) ? '' : 'disabled style="opacity:.45;cursor:default;"') + '>End Unit</button>'
      + '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleAdvanceRound();">' + (isEnemyTurn ? 'End Enemy Turn' : 'Begin Enemy Turn') + '</button>'
      + (isEnemyTurn ? '<button class="btn btn-sm btn-red" onclick="holdingCrucibleRunEnemyAI();">Enemy AI Turn</button>' : '')
      + '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleAutoResolve();">Auto Resolve</button>'
      + '<button class="btn btn-sm" onclick="holdingCrucibleResetMatch();">Reset Match</button>'
      + '<button class="btn btn-sm" onclick="closeModal();">Close</button>'
      + '</div>';
    if (isExpedition) {
      phaseButtonsHtml += '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin:-.15rem 0 .32rem 0;">'
        + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleUseExpeditionFlask();">Use Flask</button>'
        + '<button class="btn btn-sm btn-teal" onclick="holdingCruciblePrayAtTemple();">Pray At Temple</button>'
        + '</div>';
    }
    var movementHtml = '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-bottom:.35rem;">'
      + (canMoveActive && typeof getHexMovementButtonsHtml === 'function'
        ? ('<div style="width:100%;margin-bottom:.15rem;font-size:.7rem;"><strong style="color:var(--gold);">Movement:</strong></div><div style="display:flex;gap:.2rem;flex-wrap:wrap;max-width:100%;">' + getHexMovementButtonsHtml(selectedActiveUnit, match) + '</div><button class="btn btn-sm btn-teal" style="margin-top:.2rem;" onclick="holdingCrucibleTeleportSelected();">Teleport Random Hex</button>')
        : '<div style="font-size:.7rem;color:var(--muted2);">No movement available.</div>')
      + '</div>';
    var logLines = (match.log || []).slice(-8).reverse().map(function (line) {
      return '<div style="font-size:.72rem;color:var(--text2);line-height:1.45;border-bottom:1px solid var(--border2);padding:.12rem 0;">' + String(line || '') + '</div>';
    }).join('');
    return '<div style="font-size:.82rem;color:var(--text2);line-height:1.55;">'
      + '<div style="font-family:Cinzel,serif;font-size:.88rem;color:var(--gold2);margin-bottom:.2rem;">' + (isExpedition ? 'Crucible Expedition' : ('Crucible ' + getCrucibleModeTeamSize(mode.id) + 'v' + getCrucibleModeTeamSize(mode.id) + ' Tactical Simulator')) + '</div>'
      + '<div style="font-size:.75rem;color:var(--muted2);margin-bottom:.15rem;">Round ' + Number(match.round || 1) + ' · ' + currentTurn + ' · Allies ' + alliesAlive + '/' + Number((match.allies||[]).length || 0) + ' · Enemies ' + enemiesAlive + '/' + Number((match.enemies||[]).length || 0) + '</div>'
      + '<div style="font-size:.74rem;color:var(--teal);margin-bottom:.28rem;">Mode: ' + mode.label + ' · Objective: ' + mode.objective + ' · ' + scoreLine + '</div>'
      + (isExpedition ? '<div style="font-size:.69rem;color:var(--gold2);margin-top:-.12rem;margin-bottom:.24rem;">'
        + 'Boss Path: 1st Boss d8|16 HP -> 2nd Boss d10|20 HP -> Raid Boss d20|40 HP. Field Enemy d4|4 HP. Mini Boss d6|12 HP with affix loot.'
        + '</div>' : '')
      + turnRail
      + '<div style="display:flex;gap:.22rem;flex-wrap:wrap;margin:-.08rem 0 .2rem 0;font-size:.67rem;color:var(--muted2);">'
      + '<span style="border:1px solid rgba(70,196,182,.35);padding:.12rem .24rem;background:rgba(70,196,182,.08);">Wayfarer Actions ' + Number(allyBudget.used || 0) + '/' + Number(allyBudget.total || 0) + '</span>'
      + '<span style="border:1px solid rgba(200,80,80,.35);padding:.12rem .24rem;background:rgba(200,80,80,.08);">Enemy Actions ' + Number(enemyBudget.used || 0) + '/' + Number(enemyBudget.total || 0) + '</span>'
      + '</div>'
      + turnControlsHtml
      + phaseButtonsHtml
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.35rem;margin-bottom:.35rem;">'
      + '<div style="border:1px solid rgba(70,196,182,.35);padding:.28rem .34rem;background:linear-gradient(180deg,rgba(70,196,182,.08),rgba(255,255,255,.02));">'
      + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;margin-bottom:.2rem;">'
      + '<div style="font-size:.7rem;color:var(--teal);">Blue Side</div>'
      + '<div style="font-size:.64rem;color:var(--muted2);">' + (isEnemyTurn ? 'Target / HP / PF' : 'AP / HP / PF') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;max-height:7.5rem;overflow:auto;">' + (allyRows || '<div style="font-size:.72rem;color:var(--muted2);">No allies standing.</div>') + '</div>'
      + '</div>'
      + '<div style="border:1px solid rgba(200,80,80,.35);padding:.28rem .34rem;background:linear-gradient(180deg,rgba(200,80,80,.08),rgba(255,255,255,.02));">'
      + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;margin-bottom:.2rem;">'
      + '<div style="font-size:.7rem;color:var(--red2);">Red Side</div>'
      + '<div style="font-size:.64rem;color:var(--muted2);">' + (isEnemyTurn ? 'AP / HP' : 'Distance / HP') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.18rem;flex-wrap:wrap;max-height:7.5rem;overflow:auto;">' + (targetRows || '<div style="font-size:.72rem;color:var(--muted2);">No enemies standing.</div>') + '</div>'
      + '</div>'
      + '</div>'
      + movementHtml
      + buildHoldingCrucibleBoardHtml(match)
      + '<div style="margin-top:.35rem;border:1px solid var(--border2);padding:.28rem .34rem;max-height:180px;overflow:auto;background:rgba(255,255,255,.02);">' + (logLines || '<div style="font-size:.72rem;color:var(--muted2);">No events yet.</div>') + '</div>'
    + '</div>';
  }

  function renderHoldingCruciblePopup() {
    var content = document.getElementById('modalContent');
    if (!content) return false;
    content.innerHTML = buildHoldingCruciblePopupHtml();
    return true;
  }

  function openHoldingCrucibleModePrompt() {
    ensureNewFeatureState();
    var specs = ['control', 'expedition'].map(function (key) { return getCrucibleModeSpec(key); });
    var html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.55;">'
      + '<div style="font-family:Cinzel,serif;font-size:.86rem;color:var(--gold2);margin-bottom:.2rem;">Select Crucible Playlist</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.35rem;">Choose Control skirmish mode or Expedition province-crawl mode.</div>'
      + specs.map(function (spec) {
        var extra = spec.id === 'expedition'
          ? 'Briefing: choose armor, weapon, and Personal Flavor, then scout a living province with raid threats.'
          : 'Briefing: 10 rounds. Capture zones A/B/C by holding each zone for 3 rounds. Score by controlling 2/3 zones.';
        return '<div style="border:1px solid var(--border2);padding:.32rem .38rem;margin-bottom:.22rem;background:rgba(255,255,255,.02);">'
          + '<div style="font-size:.76rem;color:var(--gold2);"><strong>' + spec.label + '</strong></div>'
          + '<div style="font-size:.7rem;color:var(--muted2);margin:.1rem 0 .2rem;">' + spec.objective + '</div>'
          + '<div style="font-size:.68rem;color:var(--teal);margin:.05rem 0 .28rem;">' + extra + '</div>'
          + '<button class="btn btn-xs btn-primary" onclick="holdingCrucibleSetMode(\'' + spec.id + '\');openHoldingCrucibleMatch(\'' + spec.id + '\');">Enter ' + spec.label + '</button>'
          + '</div>';
      }).join('')
      + '</div>';
    if (typeof openModal === 'function') openModal('Crucible Mode Select', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function openHoldingCrucibleMatch(modeOverride) {
    ensureNewFeatureState();
    if (!modeOverride && !getHoldingCrucibleMatch()) {
      return openHoldingCrucibleModePrompt();
    }
    if (modeOverride) {
      var modeSpec = getCrucibleModeSpec(modeOverride);
      S.holding.crucible.preferredMode = modeSpec.id;
      S.holding.crucible.match = null;
    }
    var match = getHoldingCrucibleMatch() || createHoldingCrucibleMatch();
    var isControlNewMatch = String(match.mode || '') === 'control' && Number(match.round || 1) === 1 && !match.controlLoaded;
    var isExpeditionNewMatch = String(match.mode || '') === 'expedition'
      && match.expedition
      && Number(match.round || 1) === 1
      && !match.expedition.loadout;
    if (isControlNewMatch && typeof openModal === 'function') {
      openModal('Control Briefing & Loadout', buildCrucibleControlLoadoutSelectionHtml(), null, { preventScroll: true, focusTrap: true });
    } else if (isExpeditionNewMatch && typeof openModal === 'function') {
      openModal('Expedition Briefing & Loadout', buildCrucibleExpeditionLoadoutSelectionHtml(), null, { preventScroll: true, focusTrap: true });
    } else {
      if (typeof openModal === 'function') {
        var openMode = getCrucibleModeSpec(match && match.mode);
        var teamSize = getCrucibleModeTeamSize(openMode.id);
        openModal('Crucible ' + teamSize + 'v' + teamSize + ' Tactical Simulator', buildHoldingCruciblePopupHtml(), null, { preventScroll: true, focusTrap: true });
      }
      if (typeof showNotif === 'function' && match && Number(match.round || 1) === 1) {
        var openedSpec = getCrucibleModeSpec(match.mode);
        var teamSize = getCrucibleModeTeamSize(openedSpec.id);
        showNotif('Crucible opened: ' + teamSize + 'v' + teamSize + ' tactical training scenario ready.', 'good');
      }
    }
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleSetMode(mode) {
    ensureNewFeatureState();
    var spec = getCrucibleModeSpec(mode);
    S.holding.crucible.preferredMode = spec.id;
    S.holding.crucible.match = null;
    createHoldingCrucibleMatch();
    renderHoldingCruciblePopup();
    renderHoldingUI();
    if (typeof showNotif === 'function') {
      showNotif('Crucible mode set: ' + spec.label + '. New map seeded.', 'good');
    }
    return true;
  }

  function selectHoldingCrucibleUnit(unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var unit = findCrucibleUnit(match, 'ally', unitId);
    if (!unit || Number(unit.hp || 0) <= 0) return false;
    match.selectedAllyId = String(unit.id);
    renderHoldingCruciblePopup();
    return true;
  }

  function selectHoldingCrucibleEnemy(unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var unit = findCrucibleUnit(match, 'enemy', unitId);
    if (!unit || Number(unit.hp || 0) <= 0) return false;
    match.selectedEnemyId = String(unit.id);
    renderHoldingCruciblePopup();
    return true;
  }

  function selectHoldingCrucibleTarget(unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var unit = findCrucibleUnit(match, 'enemy', unitId);
    if (!unit || Number(unit.hp || 0) <= 0) return false;
    match.selectedTargetId = String(unit.id);
    renderHoldingCruciblePopup();
    return true;
  }

  function selectHoldingCrucibleAllyTarget(unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var unit = findCrucibleUnit(match, 'ally', unitId);
    if (!unit || Number(unit.hp || 0) <= 0) return false;
    match.selectedAllyTargetId = String(unit.id);
    renderHoldingCruciblePopup();
    return true;
  }

  function getCrucibleWayfarerActionOptionsHtml() {
    if (typeof document !== 'undefined') {
      var select = document.getElementById('wayfarerActionSel');
      if (select && select.options && select.options.length) {
        var options = Array.prototype.map.call(select.options, function (opt) {
          if (!opt || !opt.value) return '';
          return '<option value="' + String(opt.value).replace(/"/g, '&quot;') + '">' + String(opt.textContent || opt.value) + '</option>';
        }).filter(Boolean);
        var lowerJoined = options.join(' ').toLowerCase();
        if (lowerJoined.indexOf('value="spell"') < 0) options.push('<option value="spell">Spell</option>');
        if (lowerJoined.indexOf('value="hack"') < 0) options.push('<option value="hack">Hack</option>');
        if (lowerJoined.indexOf('value="move"') < 0) options.push('<option value="move">Move</option>');
        return options.join('');
      }
    }
    return '<option value="strike">Strike</option>'
      + '<option value="shoot">Shoot</option>'
      + '<option value="spell">Spell</option>'
      + '<option value="hack">Hack</option>'
        + '<option value="move">Move</option>'
      + '<option value="defend">Defend</option>'
      + '<option value="support">Support</option>'
      + '<option value="personal-flavor">Personal Flavor</option>';
  }

  function buildCrucibleTeamTargetOptions(match, action, actor) {
    return buildCrucibleActionTargetOptions(match, action, actor, 'ally');
  }

  function buildCrucibleEnemyTargetOptions(match, action, actor) {
    return buildCrucibleActionTargetOptions(match, action, actor, 'enemy');
  }

  function buildCrucibleActionTargetOptions(match, action, actor, actorSide) {
    if (!match) return '';
    var act = String(action || 'attack').toLowerCase();
    var friendlySide = String(actorSide || 'ally') === 'enemy' ? 'enemy' : 'ally';
    var opposingSide = friendlySide === 'enemy' ? 'ally' : 'enemy';
    var livingAllies = getLivingTeamUnits(match.allies || []);
    var livingEnemies = getLivingTeamUnits(match.enemies || []);
    var friendlyUnits = friendlySide === 'enemy' ? livingEnemies : livingAllies;
    var opposingUnits = opposingSide === 'enemy' ? livingEnemies : livingAllies;
    if (act === 'defend' || act === 'support') {
      return friendlyUnits.map(function (unit) {
        return '<option value="' + friendlySide + ':' + String(unit.id).replace(/"/g, '&quot;') + '">' + String(unit.name || 'Unit') + '</option>';
      }).join('');
    }
    if (act.indexOf('move') === 0) {
      var moveTargets = opposingUnits.map(function (unit) {
        return '<option value="' + opposingSide + ':' + String(unit.id).replace(/"/g, '&quot;') + '">' + String(unit.name || 'Enemy') + ' · Move toward</option>';
      });
      moveTargets.push('<option value="self">No target</option>');
      return moveTargets.join('');
    }
    if (act === 'attack' || act === 'strike' || act === 'shoot') {
      var targets = opposingUnits.filter(function (enemy) {
        return !!(actor && enemy && canCrucibleActionTarget(actor, enemy, act));
      });
      return targets.map(function (unit) {
        var dist = actor ? Number(getCrucibleUnitDistanceValue(actor, unit) || 0) : 0;
        var hint = getCrucibleRangeActionHint(dist, actor ? getCrucibleUnitAttackMaxRange(actor) : 2);
        return '<option value="' + opposingSide + ':' + String(unit.id).replace(/"/g, '&quot;') + '">' + String(unit.name || 'Enemy') + ' · ' + hint + '</option>';
      }).join('') || '<option value="">No targets in current weapon range</option>';
    }
    if (act === 'spell' || act === 'hack') {
      var castTargets = opposingUnits.filter(function (enemy) {
        return !!(actor && enemy && canCrucibleActionTarget(actor, enemy, act));
      });
      return castTargets.map(function (unit) {
        var distTxt = actor ? (' d:' + Number(getCrucibleUnitDistanceValue(actor, unit) || 0)) : '';
        return '<option value="' + opposingSide + ':' + String(unit.id).replace(/"/g, '&quot;') + '">' + String(unit.name || 'Enemy') + distTxt + '</option>';
      }).join('') || '<option value="">No valid targets for ' + (act === 'hack' ? 'Hack' : 'Spell') + '</option>';
    }
    if (act === 'personal-flavor') {
      var closeEnemies = opposingUnits.filter(function (enemy) {
        return !!(actor && enemy && canCrucibleActionTarget(actor, enemy, 'personal-flavor'));
      });
      return closeEnemies.map(function (unit) {
        var distTxt = actor ? (' d:' + Number(getCrucibleUnitDistanceValue(actor, unit) || 0)) : '';
        return '<option value="' + opposingSide + ':' + String(unit.id).replace(/"/g, '&quot;') + '">' + String(unit.name || 'Enemy') + distTxt + '</option>';
      }).join('') || '<option value="">No close target for Personal Flavor</option>';
    }
    return '<option value="">Select action first</option>';
  }

  function refreshCrucibleTeamActionOptions() {
    var match = getHoldingCrucibleMatch();
    if (!match || typeof document === 'undefined') return false;
    var actionEl = document.getElementById('crucibleTeamActionSelect');
    var targetEl = document.getElementById('crucibleTeamTargetSelect');
    if (!actionEl || !targetEl) return false;
    var actor = getSelectedCrucibleAlly(match);
    targetEl.innerHTML = buildCrucibleTeamTargetOptions(match, String(actionEl.value || 'attack'), actor);
    return true;
  }

  function refreshCrucibleWayfarerActionOptions() {
    var match = getHoldingCrucibleMatch();
    if (!match || typeof document === 'undefined') return false;
    var actionEl = document.getElementById('crucibleWayfarerActionSelect');
    var targetEl = document.getElementById('crucibleWayfarerTargetSelect');
    if (!actionEl || !targetEl) return false;
    var actor = getSelectedCrucibleAlly(match);
    targetEl.innerHTML = buildCrucibleEnemyTargetOptions(match, String(actionEl.value || 'attack'), actor);
    return true;
  }

  function refreshCrucibleEnemyActionOptions() {
    var match = getHoldingCrucibleMatch();
    if (!match || typeof document === 'undefined') return false;
    var actionEl = document.getElementById('crucibleEnemyActionSelect');
    var targetEl = document.getElementById('crucibleEnemyTargetSelect');
    if (!actionEl || !targetEl) return false;
    var actor = getSelectedCrucibleEnemy(match);
    targetEl.innerHTML = buildCrucibleEnemyTargetOptions(match, String(actionEl.value || 'attack'), actor);
    return true;
  }

  function holdingCrucibleHandleBoardUnitClick(side, unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    if (String(match.turnSide || 'ally') === 'enemy') {
      return String(side || '') === 'enemy'
        ? selectHoldingCrucibleEnemy(unitId)
        : selectHoldingCrucibleAllyTarget(unitId);
    }
    return String(side || '') === 'enemy'
      ? selectHoldingCrucibleTarget(unitId)
      : selectHoldingCrucibleUnit(unitId);
  }

  function recordCrucibleExpeditionHexClick(match, opts) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var options = opts || {};
    var expedition = match.expedition;
    var player = getCrucibleExpeditionPlayer(match);
    if (player && player.position) {
      var visitKey = String(Number(player.position.q || 0)) + ',' + String(Number(player.position.r || 0));
      expedition.visitedHexes = expedition.visitedHexes || {};
      expedition.visitedHexes[visitKey] = Math.max(0, Number(expedition.visitedHexes[visitKey] || 0) + 1);
    }
    expedition.clickedHexes = Math.max(0, Number(expedition.clickedHexes || 0) + 1);
    var cadence = Math.max(1, Number(expedition.collapseEveryClicks || 1));
    var useRoundClosures = !!expedition.roundClosesEdges && getCrucibleExpeditionPartySize(match) > 1;
    if (!useRoundClosures && expedition.clickedHexes % cadence === 0) {
      var collapsedNow = collapseCrucibleExpeditionEdge(match);
      if (collapsedNow > 0) {
        match.log = (match.log || []).concat(['Night pressure: ' + collapsedNow + ' edge hexes collapsed.']).slice(-120);
      }
    }
    if (!options.skipEncounter) maybeTriggerCrucibleExpeditionEncounter(match, getCrucibleExpeditionOpenHexCount(match) <= 1);
    if (!options.skipTurnAdvance) advanceCrucibleExpeditionPartyTurn(match, { skipCollapse: !useRoundClosures });
    return true;
  }

  function holdingCrucibleExpeditionSwitchTab(tab) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var nextTab = String(tab || 'province');
    match.expedition.uiTab = nextTab === 'wayfarer' || nextTab === 'combat' ? nextTab : 'province';
    renderHoldingCruciblePopup();
    return true;
  }

  function holdingCrucibleReturnToHolding() {
    if (typeof closeModal === 'function') closeModal();
    if (typeof renderHoldingUI === 'function') renderHoldingUI();
    return true;
  }

  function createCrucibleExpeditionRuinRooms() {
    var count = 4 + Math.floor(Math.random() * 3);
    var labels = ['Collapsed Hall', 'Root Choked Nave', 'Broken Reliquary', 'Flooded Archive', 'Cracked Watch Post', 'Silent Forge', 'Dust Chapel'];
    var rooms = [];
    for (var i = 0; i < count; i++) {
      rooms.push({
        label: 'Room ' + (i + 1) + ': ' + labels[Math.floor(Math.random() * labels.length)],
        explored: false,
        result: null
      });
    }
    return rooms;
  }

  function startCrucibleExpeditionRuinCrawl(match, hexKey) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    var cell = match.hexMap.hexes[String(hexKey || '')];
    if (!cell || !cell.ruin) return false;
    match.expedition.phase = 'ruin';
    match.expedition.uiTab = 'province';
    match.expedition.activeRuin = {
      hexKey: String(hexKey || ''),
      rooms: createCrucibleExpeditionRuinRooms(),
      cleared: false
    };
    return true;
  }

  function buildCrucibleExpeditionRuinCrawlHtml(match) {
    var ruin = match && match.expedition ? match.expedition.activeRuin : null;
    if (!ruin || !Array.isArray(ruin.rooms)) return '';
    var exploredCount = ruin.rooms.filter(function (room) { return !!room.explored; }).length;
    var allExplored = exploredCount >= ruin.rooms.length;
    var rows = ruin.rooms.map(function (room, idx) {
      var state = !room.explored
        ? '<span style="color:var(--muted2);">Unexplored</span>'
        : '<span style="color:' + (room.result && room.result.tone || 'var(--teal)') + ';">' + String(room.result && room.result.text || 'Explored') + '</span>';
      var action = room.explored
        ? ''
        : '<button class="btn btn-xs btn-teal" onclick="holdingCrucibleExploreExpeditionRuinRoom(' + idx + ')">Explore</button>';
      return '<div style="padding:.3rem .4rem;margin-bottom:.22rem;border:1px solid var(--border2);background:rgba(255,255,255,.02);">'
        + '<div style="font-size:.74rem;color:var(--text2);">' + room.label + '</div>'
        + '<div style="font-size:.68rem;margin-top:.12rem;display:flex;justify-content:space-between;gap:.2rem;align-items:center;">' + state + action + '</div>'
        + '</div>';
    }).join('');
    var footer = ruin.cleared
      ? '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleExitExpeditionRuin()">Leave Ruin</button>'
      : (allExplored
        ? '<button class="btn btn-sm btn-red" onclick="holdingCrucibleResolveExpeditionRuinBoss()">Enter Final Chamber</button>'
        : '<span style="font-size:.68rem;color:var(--muted2);">Explore every room before the final chamber opens.</span>');
    return '<div class="card" style="margin-bottom:.25rem;">'
      + '<div class="section-title">Ruin Internal Crawl</div>'
      + '<div class="theos-region-kicker">4-6 room crawl · explored ' + exploredCount + '/' + ruin.rooms.length + '</div>'
      + '<p class="theos-region-copy">The ruin opens into a smaller crawl before its guardian shows itself.</p>'
      + rows
      + '<div style="display:flex;gap:.22rem;flex-wrap:wrap;align-items:center;margin-top:.28rem;">' + footer + '</div>'
      + '</div>';
  }

  function holdingCrucibleExploreExpeditionRuinRoom(roomIdx) {
    var match = getHoldingCrucibleMatch();
    var ruin = match && match.expedition ? match.expedition.activeRuin : null;
    if (!match || !ruin || !ruin.rooms || !ruin.rooms[roomIdx]) return false;
    var room = ruin.rooms[roomIdx];
    if (room.explored) return false;
    room.explored = true;
    var rollRoom = 1 + Math.floor(Math.random() * 6);
    if (rollRoom === 1) {
      var player = getCrucibleExpeditionPlayer(match);
      if (player) player.hp = Math.max(1, Number(player.hp || 1) - 1);
      room.result = { tone: 'var(--red2)', text: 'Trap burst: active wayfarer takes 1 damage.' };
    } else if (rollRoom === 2) {
      var cacheLoot = grantCrucibleExpeditionLoot(match, 'fieldEnemy');
      room.result = { tone: 'var(--green2)', text: cacheLoot ? ('Cache found: ' + cacheLoot + '.') : 'Cache found, but it was empty.' };
    } else if (rollRoom === 3) {
      match.expedition.flasks = Math.min(Number(match.expedition.maxFlasks || 7), Number(match.expedition.flasks || 0) + 1);
      room.result = { tone: 'var(--teal)', text: 'Sanctified basin: +1 Flask.' };
    } else if (rollRoom === 4) {
      match.expedition.portalsClosed = Math.min(Number(match.expedition.portalQuestTarget || 5), Number(match.expedition.portalsClosed || 0) + 1);
      room.result = { tone: 'var(--gold2)', text: 'Ruin sigil: counts as 1 sealed portal toward weakening the Night Lord.' };
    } else if (rollRoom === 5) {
      room.result = { tone: 'var(--muted2)', text: 'Lore shard: the final chamber guardian is awake.' };
    } else {
      room.result = { tone: 'var(--red2)', text: 'Skirmish signs: the miniboss waits deeper inside.' };
    }
    match.log = (match.log || []).concat(['Ruin room explored: ' + room.label + ' — ' + String(room.result && room.result.text || 'Nothing found.')]).slice(-120);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleResolveExpeditionRuinBoss() {
    var match = getHoldingCrucibleMatch();
    var ruin = match && match.expedition ? match.expedition.activeRuin : null;
    if (!match || !ruin || !Array.isArray(ruin.rooms)) return false;
    if (!ruin.rooms.every(function (room) { return !!room.explored; })) {
      if (typeof showNotif === 'function') showNotif('Explore the ruin rooms first.', 'warn');
      return false;
    }
    var mini = pickCrucibleExpeditionEnemyProfile('mini');
    var ok = spawnCrucibleExpeditionEnemy(match, {
      name: mini.name,
      look: mini.look,
      desc: mini.desc,
      die: 6,
      hp: 12,
      combatType: 'miniboss',
      role: 'tank'
    });
    if (!ok) return false;
    match.expedition.phase = 'combat';
    match.expedition.currentCombatType = 'miniboss';
    match.log = (match.log || []).concat(['Final chamber opened: ruin miniboss engaged (DD6 | 12 HP).']).slice(-120);
    openCrucibleExpeditionCombatPopup(match);
    return true;
  }

  function holdingCrucibleExitExpeditionRuin() {
    var match = getHoldingCrucibleMatch();
    if (!match || !match.expedition || !match.expedition.activeRuin || !match.expedition.activeRuin.cleared) return false;
    match.expedition.phase = 'explore';
    match.expedition.activeRuin = null;
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleExpeditionSearchHex() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var expedition = match.expedition;
    if (String(expedition.phase || '') === 'combat') {
      if (typeof showNotif === 'function') showNotif('Finish this fight before searching.', 'warn');
      return false;
    }
    if (String(expedition.phase || '') === 'portalPuzzle') {
      if (typeof showNotif === 'function') showNotif('Solve the active portal puzzle first.', 'warn');
      return false;
    }
    var playerKey = getCrucibleExpeditionPlayerHexKey(match);
    var player = getCrucibleExpeditionPlayer(match);
    var cell = (match.hexMap && match.hexMap.hexes) ? match.hexMap.hexes[playerKey] : null;
    expedition.clearedHexes = expedition.clearedHexes || {};
    resolveCrucibleExpeditionDangerousWeather(match, 'Search Hex');

    var wildTable = [
      'Sky: a castle hangs in chains from the moonlit cloudline.',
      'Flora & Fauna: pale reeds and kneeling skeletons line the route.',
      'Wonder: a submerged throne room still burns in silence.',
      'Aftermath: impossible architecture intersects with ruined roads.',
      'Archaeology: statues watch from angles no mason could set.'
    ];
    var wildLine = wildTable[Math.floor(Math.random() * wildTable.length)] || wildTable[0];
    var logLine = 'Wilderness read: ' + wildLine;
    var encounterRoll = 1 + Math.floor(Math.random() * 9);

    if (cell && cell.ruin && !cell.ruin.searched) {
      startCrucibleExpeditionRuinCrawl(match, playerKey);
      match.log = (match.log || []).concat([logLine, 'Ruins discovered: internal 4-6 room crawl opened.']).slice(-120);
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    } else {
      if (encounterRoll === 1) {
        resolveCrucibleExpeditionDangerousWeather(match, 'Random Encounter');
        logLine += ' Encounter 1/9: Shifting Weather (Lead vs DD6).';
      } else if (encounterRoll === 2) {
        var ctrlDie = getCrucibleExpeditionStatDie('control', 6);
        var ctrl = (typeof explodingRoll === 'function') ? explodingRoll(ctrlDie, { type: 'action', major: true, label: 'Peril Check (Control)' }) : { total: Math.floor(Math.random() * ctrlDie) + 1 };
        var perDd = (typeof explodingRoll === 'function') ? explodingRoll(6, { type: 'dread', major: true, label: 'Peril DD6' }) : { total: Math.floor(Math.random() * 6) + 1 };
        if (Number(ctrl.total || 0) < Number(perDd.total || 0) && player) {
          var dmg = Math.max(1, Number(perDd.total || 0) - Number(ctrl.total || 0));
          player.hp = Math.max(0, Number(player.hp || 1) - dmg);
          if (S) S.health = Number(player.hp || 0);
          logLine += ' Encounter 2/9: Peril failed, took ' + dmg + ' damage.';
        } else {
          logLine += ' Encounter 2/9: Peril cleared.';
        }
      } else if (encounterRoll === 3) {
        var bodyDie = getCrucibleExpeditionStatDie('body', 6);
        var body = (typeof explodingRoll === 'function') ? explodingRoll(bodyDie, { type: 'action', major: true, label: 'Barrier Check (Body)' }) : { total: Math.floor(Math.random() * bodyDie) + 1 };
        var barrDd = (typeof explodingRoll === 'function') ? explodingRoll(6, { type: 'dread', major: true, label: 'Barrier DD6' }) : { total: Math.floor(Math.random() * 6) + 1 };
        logLine += Number(body.total || 0) >= Number(barrDd.total || 0)
          ? ' Encounter 3/9: Barrier crossed.'
          : ' Encounter 3/9: Barrier held. Route blocked.';
      } else if (encounterRoll === 4) {
        var cnt = 1 + Math.floor(Math.random() * 4);
        var prof = pickCrucibleExpeditionEnemyProfile('field');
        var wave = spawnCrucibleExpeditionEnemyWave(match, {
          name: prof.name,
          look: prof.look,
          desc: prof.desc,
          die: 4,
          hp: 4,
          combatType: 'fieldEnemy',
          role: 'assault'
        }, cnt);
        if (wave) {
          match.log = (match.log || []).concat([logLine, 'Encounter 4/9: Roaming enemies x' + cnt + ' (DD4 | 4 HP each). Bounty: ' + (cnt * 60) + ' Credits.']).slice(-120);
          openCrucibleExpeditionCombatPopup(match);
          renderHoldingCruciblePopup();
          renderHoldingUI();
          return true;
        }
      } else if (encounterRoll === 5) {
        var item = grantCrucibleExpeditionLoot(match, 'fieldEnemy');
        logLine += item ? (' Encounter 5/9: Loot cache found: ' + item + '.') : ' Encounter 5/9: Loot cache empty.';
      } else if (encounterRoll === 6) {
        var mini = pickCrucibleExpeditionEnemyProfile('mini');
        var miniOk = spawnCrucibleExpeditionEnemy(match, {
          name: mini.name,
          look: mini.look,
          desc: mini.desc,
          die: 6,
          hp: 12,
          combatType: 'miniboss',
          role: 'tank'
        });
        if (miniOk) {
          match.log = (match.log || []).concat([logLine, 'Encounter 6/9: Roaming miniboss engaged (DD6 | 12 HP).']).slice(-120);
          openCrucibleExpeditionCombatPopup(match);
          renderHoldingCruciblePopup();
          renderHoldingUI();
          return true;
        }
      } else if (encounterRoll === 7) {
        var pool = getCrucibleShopLootPool();
        var stock = [];
        var pickCount = 6 + Math.floor(Math.random() * 5);
        for (var si = 0; si < pickCount && pool.length; si++) {
          var pi = Math.floor(Math.random() * pool.length);
          var rolled = pool.splice(pi, 1)[0] || {};
          stock.push({
            name: String(rolled.name || 'Unknown'),
            cost: Math.max(10, Number(rolled.cost || 45)),
            cat: String(rolled.cat || rolled.category || 'items')
          });
        }
        logLine += ' Encounter 7/9: Roaming merchant stock [' + stock.map(function (entry) { return entry.name + ' (' + entry.cost + 'c)'; }).join(', ') + '].';
        if (typeof openModal === 'function' && stock.length) {
          var merchantHtml = '<div style="font-size:.78rem;color:var(--text2);line-height:1.55;margin-bottom:.35rem;">A caravan breaks through the dust with temporary stock. Buy directly here or continue to the Merchant tab.</div>'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.3rem;">'
            + stock.map(function (entry) {
              var safeName = String(entry.name || 'Unknown').replace(/'/g, "\\'");
              var safeCat = String(entry.cat || 'items').replace(/'/g, "\\'");
              return '<div style="border:1px solid var(--border2);padding:.32rem;background:rgba(255,255,255,.02);">'
                + '<div style="font-size:.74rem;color:var(--gold2);margin-bottom:.08rem;"><strong>' + String(entry.name || 'Unknown') + '</strong></div>'
                + '<div style="font-size:.68rem;color:var(--muted2);margin-bottom:.2rem;">Cost: ' + Number(entry.cost || 0) + ' Credits</div>'
                + '<button class="btn btn-xs btn-teal" onclick="buyItem(' + Number(entry.cost || 0) + ',\'' + safeName + '\',\'' + safeCat + '\')">Buy</button>'
                + '</div>';
            }).join('')
            + '</div>';
          openModal('Roaming Merchant', merchantHtml, null, { preventScroll: true, focusTrap: true });
        }
        if (typeof showNotif === 'function') showNotif('Roaming merchant found. You can buy from the encounter pop-up.', 'good');
      } else if (encounterRoll === 8) {
        var advDie = getCrucibleExpeditionStatDie('spirit', 6);
        var adv = (typeof explodingRoll === 'function') ? explodingRoll(advDie, { type: 'action', major: true, label: 'Valor Check (Spirit)' }) : { total: Math.floor(Math.random() * advDie) + 1 };
        var advDd = (typeof explodingRoll === 'function') ? explodingRoll(6, { type: 'dread', major: true, label: 'Valor DD6' }) : { total: Math.floor(Math.random() * 6) + 1 };
        if (Number(adv.total || 0) < Number(advDd.total || 0)) {
          var radDiff = Math.max(1, Number(advDd.total || 0) - Number(adv.total || 0));
          if (typeof changeRads === 'function') changeRads(radDiff);
          logLine += ' Encounter 8/9: Valor check failed. +' + radDiff + ' Radiation.';
        } else {
          logLine += ' Encounter 8/9: Valor check cleared.';
        }
      } else {
        var currentKey = (player && player.position) ? (String(player.position.q) + ',' + String(player.position.r)) : '';
        var jumpHex = null;
        for (var jr = 0; jr < 8; jr++) {
          var candidate = getCrucibleExpeditionRandomDropHex(match.hexMap);
          if (!candidate) continue;
          var candidateKey = String(candidate.q) + ',' + String(candidate.r);
          if (candidateKey !== currentKey) {
            jumpHex = candidate;
            break;
          }
        }
        if (jumpHex && player) {
          player.position = { q: Number(jumpHex.q || 0), r: Number(jumpHex.r || 0) };
          logLine += ' Encounter 9/9: Portal surge teleported you to [' + Number(jumpHex.q || 0) + ',' + Number(jumpHex.r || 0) + '].';
        } else {
          logLine += ' Encounter 9/9: Portal failed to anchor.';
        }
      }
    }
    expedition.clearedHexes[playerKey] = true;
    match.log = (match.log || []).concat([logLine]).slice(-120);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function getCrucibleExpeditionObserveDirections(match, cell) {
    if (!match || !match.hexMap || !match.hexMap.hexes || !cell) return [];
    var dirs = [
      { key: 'north', label: 'North', dq: 0, dr: -1 },
      { key: 'northeast', label: 'Northeast', dq: 1, dr: -1 },
      { key: 'southeast', label: 'Southeast', dq: 1, dr: 0 },
      { key: 'south', label: 'South', dq: 0, dr: 1 },
      { key: 'southwest', label: 'Southwest', dq: -1, dr: 1 },
      { key: 'northwest', label: 'Northwest', dq: -1, dr: 0 }
    ];
    return dirs.filter(function (dir) {
      var key = String(Number(cell.q || 0) + dir.dq) + ',' + String(Number(cell.r || 0) + dir.dr);
      return !!match.hexMap.hexes[key];
    });
  }

  function getCrucibleExpeditionObserveTarget(match, cell, directionKey) {
    var dirs = getCrucibleExpeditionObserveDirections(match, cell);
    var dir = dirs.find(function (entry) { return entry.key === String(directionKey || ''); }) || null;
    if (!dir) return null;
    var q = Number(cell.q || 0) + dir.dq;
    var r = Number(cell.r || 0) + dir.dr;
    var key = String(q) + ',' + String(r);
    var targetCell = (match && match.hexMap && match.hexMap.hexes) ? match.hexMap.hexes[key] : null;
    if (!targetCell) return null;
    return { dir: dir, cell: targetCell, key: key };
  }

  function buildCrucibleExpeditionObserveSummary(match, targetCell) {
    if (!targetCell) return 'No hex in that direction.';
    var status = getCrucibleExpeditionCellStatus(match, targetCell);
    var terrain = String(targetCell.provinceTerrainName || targetCell.terrain || 'Unknown');
    return '<div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);">'
      + '<div style="font-size:.78rem;color:var(--teal);font-weight:700;margin-bottom:.15rem;">[' + (Number(targetCell.q || 0) + 1) + ',' + (Number(targetCell.r || 0) + 1) + '] ' + terrain + '</div>'
      + '<div style="font-size:.72rem;color:' + String(status.tone || 'var(--muted2)') + ';margin-bottom:.12rem;"><strong>' + String(status.label || 'Unknown') + '</strong></div>'
      + '<div style="font-size:.7rem;color:var(--muted2);">' + String(status.detail || 'No intel available.') + '</div>'
      + '</div>';
  }

  function holdingCrucibleExpeditionObserveDirection(directionKey) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) {
      if (typeof showNotif === 'function') showNotif('Select an expedition hex first.', 'warn');
      return false;
    }
    var playerKey = String(Number(player.position.q || 0)) + ',' + String(Number(player.position.r || 0));
    var origin = match.hexMap.hexes[playerKey];
    if (!origin) {
      if (typeof showNotif === 'function') showNotif('Current expedition hex is unavailable.', 'warn');
      return false;
    }
    var target = getCrucibleExpeditionObserveTarget(match, origin, directionKey);
    if (!target) {
      if (typeof showNotif === 'function') showNotif('No hex in that direction.', 'warn');
      return false;
    }
    var leadDie = getCrucibleExpeditionStatDie('lead', 6);
    var action = (typeof explodingRoll === 'function')
      ? explodingRoll(leadDie, { type: 'action', major: true, label: 'Observe Adjacent (Lead)' })
      : { total: Math.floor(Math.random() * Math.max(1, leadDie)) + 1 };
    var dread = (typeof explodingRoll === 'function')
      ? explodingRoll(6, { type: 'dread', major: true, label: 'Observe Adjacent DD6' })
      : { total: Math.floor(Math.random() * 6) + 1 };
    var success = Number(action.total || 0) >= Number(dread.total || 0);
    var isPhoneLayout = !!(typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('phone-layout-mode'));
    var rollGridCols = isPhoneLayout ? '1fr' : '1fr 1fr';

    var html = '<div style="display:grid;grid-template-columns:' + rollGridCols + ';gap:.5rem;margin-bottom:.4rem;">'
      + '<div style="text-align:center;"><div style="font-size:.7rem;color:var(--muted2);">Lead d' + Number(leadDie || 6) + '</div><div style="font-size:1.6rem;color:var(--teal);font-family:Rajdhani,sans-serif;font-weight:700;">' + Number(action.total || 0) + '</div></div>'
      + '<div style="text-align:center;"><div style="font-size:.7rem;color:var(--muted2);">DD6</div><div style="font-size:1.6rem;color:var(--red2);font-family:Rajdhani,sans-serif;font-weight:700;">' + Number(dread.total || 0) + '</div></div>'
      + '</div>';

    if (success) {
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
      html += '<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;">'
        + '<div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Observation success (' + String(target.dir.label || 'Direction') + ')</div>'
        + buildCrucibleExpeditionObserveSummary(match, target.cell)
        + '</div>';
    } else {
      if (typeof addTMWOnFail === 'function') addTMWOnFail('holding-observe-adjacent-failure', {
        failedBy: Math.max(1, Number(dread.total || 0) - Number(action.total || 0)),
        actionDie: Math.max(4, Number(leadDie || 6)),
        dreadDie: 6,
        actionLabel: 'Lead Die',
        onConvert: function () {
          if (typeof openModal === 'function') {
            setTimeout(function () {
              openModal('Observe Adjacent — Teamwork Success', '<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;">'
                + '<div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Observation converted (' + String(target.dir.label || 'Direction') + ')</div>'
                + buildCrucibleExpeditionObserveSummary(match, target.cell)
                + '<div style="font-size:.72rem;color:var(--muted2);margin-top:.3rem;">No Successful Roll gained.</div>'
                + '</div>', null, { preventScroll: true, focusTrap: true });
            }, 80);
          }
          return true;
        }
      });
      html += '<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;">'
        + '<div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">✗ Observation failed</div>'
        + '<div style="font-size:.8rem;color:var(--text2);">The province haze obscures that lane.</div>'
        + '</div>';
    }
    if (typeof openModal === 'function') openModal('Observe Adjacent Province Hex', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function holdingCrucibleExpeditionObserveAdjacent() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) {
      if (typeof showNotif === 'function') showNotif('Select an expedition hex first.', 'warn');
      return false;
    }
    var playerKey = String(Number(player.position.q || 0)) + ',' + String(Number(player.position.r || 0));
    var origin = match.hexMap.hexes[playerKey];
    if (!origin) {
      if (typeof showNotif === 'function') showNotif('Current expedition hex is unavailable.', 'warn');
      return false;
    }
    var options = getCrucibleExpeditionObserveDirections(match, origin);
    if (!options.length) {
      if (typeof showNotif === 'function') showNotif('No adjacent expedition hexes to observe.', 'warn');
      return false;
    }
    var html = '<div style="font-size:.82rem;color:var(--text2);margin-bottom:.35rem;">Choose one adjacent direction to observe (Lead vs DD6).</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;">';
    options.forEach(function (opt) {
      html += '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleExpeditionObserveDirection(\'' + String(opt.key || '') + '\')">' + String(opt.label || 'Direction') + '</button>';
    });
    html += '</div>';
    if (typeof openModal === 'function') openModal('Observe Adjacent Province Hex', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function holdingCrucibleExpeditionRandomEncounter() {
    return holdingCrucibleExpeditionSearchHex();
  }

  function getCrucibleExpeditionPlayerHexKey(match) {
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) return '';
    return String(player.position.q) + ',' + String(player.position.r);
  }

  function holdingCrucibleExpeditionWildernessRoll() {
    return holdingCrucibleExpeditionSearchHex();
  }

  function holdingCrucibleCloseExpeditionGate() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    var key = getCrucibleExpeditionPlayerHexKey(match);
    var cell = match.hexMap.hexes[key];
    if (!cell || !cell.gate) {
      if (typeof showNotif === 'function') showNotif('Stand on a gate hex to close it.', 'warn');
      return false;
    }
    if (cell.gate.closed) {
      if (typeof showNotif === 'function') showNotif('This gate is already sealed.', 'info');
      return false;
    }
    cell.gate.closed = true;
    cell.gate.used = true;
    match.expedition.clearedHexes = match.expedition.clearedHexes || {};
    match.expedition.clearedHexes[key] = true;
    match.expedition.gatesClosed = Math.max(0, Number(match.expedition.gatesClosed || 0) + 1);
    var player = getCrucibleExpeditionPlayer(match);
    var jump = getCrucibleRandomOpenHex(player, match, 999);
    if (jump && player) {
      player.position = { q: Number(jump.q), r: Number(jump.r) };
      match.log = (match.log || []).concat(['Gate sealed. Transit jump to [' + jump.q + ',' + jump.r + '].']).slice(-120);
    } else {
      match.log = (match.log || []).concat(['Gate sealed.']).slice(-120);
    }
    recordCrucibleExpeditionHexClick(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleBreachExpeditionPortal() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    if (String(match.expedition.phase || '') === 'combat') {
      if (typeof showNotif === 'function') showNotif('Finish current combat first.', 'warn');
      return false;
    }
    var key = getCrucibleExpeditionPlayerHexKey(match);
    var cell = match.hexMap.hexes[key];
    if (!cell || !cell.portal || cell.portal.closed) {
      if (typeof showNotif === 'function') showNotif('Stand on an active portal hex to breach it.', 'warn');
      return false;
    }
    var count = Math.max(1, Math.min(4, Math.floor(Math.random() * 4) + 1));
    var player = getCrucibleExpeditionPlayer(match);
    var spawnAnchor = (match.hexMap.spawns && match.hexMap.spawns.enemy) ? match.hexMap.spawns.enemy : { q: 2, r: 2 };
    var used = {};
    var enemies = [];
    for (var i = 0; i < count; i++) {
      var foe = pickCrucibleExpeditionEnemyProfile('portal');
      var uq = getUniqueCrucibleExpeditionEnemyName(match.expedition, foe.name || 'Portal Warden');
      var spawn = { q: Number(spawnAnchor.q || 2), r: Number(spawnAnchor.r || 2) };
      if (typeof getCrucibleRandomOpenHex === 'function') {
        var pick = getCrucibleRandomOpenHex(player, match, 999);
        if (pick) spawn = { q: Number(pick.q || 2), r: Number(pick.r || 2) };
      }
      var sk = String(spawn.q) + ',' + String(spawn.r);
      if (used[sk]) {
        spawn = { q: Number(spawnAnchor.q || 2) + i, r: Number(spawnAnchor.r || 2) };
        sk = String(spawn.q) + ',' + String(spawn.r);
      }
      used[sk] = true;
      var enemy = buildCrucibleUnit(uq, 'enemy', 'assault', i, spawn);
      enemy.hp = 4;
      enemy.maxHp = 4;
      enemy.attackDie = 4;
      enemy.defendDie = 4;
      enemy.ap = 2;
      enemy.profile = {
        name: String(foe.name || uq),
        look: String(foe.look || 'A portal warden steps out of static.'),
        desc: String(foe.desc || 'It exists only to keep the breach open.'),
        tier: 'portalWave'
      };
      enemies.push(enemy);
    }
    match.enemies = enemies;
    match.selectedEnemyId = String(enemies[0] && enemies[0].id || '');
    match.selectedTargetId = String(enemies[0] && enemies[0].id || '');
    match.selectedAllyTargetId = String(player && player.id || '');
    match.turnSide = 'ally';
    match.expedition.phase = 'combat';
    match.expedition.uiTab = 'combat';
    match.expedition.currentCombatType = 'portalWave';
    match.expedition.currentCombatProfile = enemies[0] ? enemies[0].profile : null;
    clearCrucibleExpeditionQueuedActions(match);
    chooseNextCrucibleExpeditionPlanner(match);
    match.expedition.portalEvent = { hexKey: key, startedDay: Number(match.expedition.day || 1), needsClose: false };
    resolveCrucibleExpeditionDangerousWeather(match, 'Portal Breach');
    match.log = (match.log || []).concat(['Portal breach initiated: ' + count + ' enemy guard(s) manifest. Win this combat to unlock Close Portal.']).slice(-120);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleSolvePortalPuzzle() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    if (String(match.expedition.phase || '') !== 'portalPuzzle') {
      if (typeof showNotif === 'function') showNotif('No active portal puzzle to solve.', 'warn');
      return false;
    }
    var ev = match.expedition.portalEvent || {};
    var hexKey = String(ev.hexKey || getCrucibleExpeditionPlayerHexKey(match));
    var cell = match.hexMap.hexes[hexKey];
    if (!cell || !cell.portal || cell.portal.closed) return false;

    function finishPortalPuzzleSuccess(detail) {
      cell.portal.closed = true;
      cell.portal.active = false;
      cell.portal.puzzleSolved = true;
      match.expedition.clearedHexes = match.expedition.clearedHexes || {};
      match.expedition.clearedHexes[hexKey] = true;
      match.expedition.portalsClosed = Math.max(0, Number(match.expedition.portalsClosed || 0) + 1);
      match.expedition.raidBossNerfed = Number(match.expedition.portalsClosed || 0) >= Number(match.expedition.portalQuestTarget || 5);
      match.expedition.phase = 'explore';
      match.expedition.pendingPortalPuzzle = false;
      match.expedition.portalEvent = null;
      match.log = (match.log || []).concat(['Portal sealed via pipe puzzle' + (detail ? (' (' + detail + ')') : '') + '. Total portals closed: ' + Number(match.expedition.portalsClosed || 0) + '.']).slice(-120);
      if (typeof showNotif === 'function') showNotif('Portal sealed.', 'good');
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    }

    function finishPortalPuzzleFailure(detail) {
      match.expedition.phase = 'explore';
      match.expedition.pendingPortalPuzzle = false;
      match.log = (match.log || []).concat(['Portal puzzle failed' + (detail ? (' (' + detail + ')') : '') + '. The breach lashes back.']).slice(-120);
      var collapse = collapseCrucibleExpeditionEdge(match);
      if (collapse > 0) match.log = (match.log || []).concat([collapse + ' edge hexes collapsed from backlash.']).slice(-120);
      if (typeof showNotif === 'function') showNotif('Portal puzzle failed.', 'warn');
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return false;
    }

    if (typeof window !== 'undefined' && typeof window.openSharedPuzzleChallenge === 'function') {
      window.openSharedPuzzleChallenge({
        mode: 'pipe_flow',
        title: 'Expedition Portal Seal · Pipe Flow',
        prompt: 'Route the conduit and close the portal breach before it stabilizes again.',
        onSuccess: function () { finishPortalPuzzleSuccess('pipe flow solved'); },
        onFail: function () { finishPortalPuzzleFailure('pipe flow failed'); }
      });
      return true;
    }

    var actionDie = getCrucibleStatDie('mind', 8);
    var action = (typeof explodingRoll === 'function') ? explodingRoll(actionDie, { type: 'action', major: true, label: 'Portal Puzzle' }) : { total: Math.floor(Math.random() * actionDie) + 1 };
    var dread = (typeof explodingRoll === 'function') ? explodingRoll(8, { type: 'dread', major: true, label: 'Portal Lock DD8' }) : { total: Math.floor(Math.random() * 8) + 1 };
    var success = Number(action.total || 0) >= Number(dread.total || 0);
    return success
      ? finishPortalPuzzleSuccess(String(action.total || 0) + ' vs ' + String(dread.total || 0))
      : finishPortalPuzzleFailure(String(action.total || 0) + ' vs ' + String(dread.total || 0));
  }

  function holdingCrucibleRestAtDwelling() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) return false;
    var key = String(player.position.q) + ',' + String(player.position.r);
    var cell = match.hexMap.hexes[key];
    if (!cell || String(cell.terrain || '') !== 'dwelling') {
      if (typeof showNotif === 'function') showNotif('Stand on a Dwelling hex to rest.', 'warn');
      return false;
    }
    player.hp = Number(player.maxHp || player.hp || 0);
    match.expedition.flasks = Number(match.expedition.maxFlasks || 7);
    match.log = (match.log || []).concat(['Dwelling rest: HP fully restored and flasks reset.']).slice(-120);
    if (typeof showNotif === 'function') showNotif('Dwelling rest complete.', 'good');
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleUseHoldingUpgrade() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition || !match.hexMap || !match.hexMap.hexes) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position) return false;
    var key = String(player.position.q) + ',' + String(player.position.r);
    var cell = match.hexMap.hexes[key];
    if (!cell || String(cell.terrain || '') !== 'holding' || !cell.holding) {
      if (typeof showNotif === 'function') showNotif('Stand on a Holding hex to upgrade.', 'warn');
      return false;
    }
    if (cell.holding.used) {
      if (typeof showNotif === 'function') showNotif('This holding is exhausted for this day.', 'info');
      return false;
    }
    var cost = Math.max(1, Number(cell.holding.cost || 100));
    if (Number(S.credits || 0) < cost) {
      if (typeof showNotif === 'function') showNotif('Need ' + cost + ' Credits for a holding upgrade.', 'warn');
      return false;
    }
    S.credits = Math.max(0, Number(S.credits || 0) - cost);
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    cell.holding.used = true;
    if (Math.random() < 0.5) {
      player.attackDie = Math.max(4, Number(player.attackDie || 8) + 1);
      match.log = (match.log || []).concat(['Holding smithy: +1 attack die (cost ' + cost + ' Credits).']).slice(-120);
      if (typeof showNotif === 'function') showNotif('Weapon upgraded (+1).', 'good');
    } else {
      player.defendDie = Math.max(4, Number(player.defendDie || 8) + 1);
      match.log = (match.log || []).concat(['Holding drill: +1 defend die (cost ' + cost + ' Credits).']).slice(-120);
      if (typeof showNotif === 'function') showNotif('Defense upgraded (+1).', 'good');
    }
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleEquipExpeditionLoot(idx) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var expedition = match.expedition;
    var list = Array.isArray(expedition.runLoot) ? expedition.runLoot : [];
    var pick = list[Number(idx)];
    if (!pick) return false;
    expedition.equipped = expedition.equipped || { weapon: '', armor: '' };
    var lower = String(pick).toLowerCase();
    var player = getCrucibleExpeditionPlayer(match);
    if (!player) return false;
    if (/armor|armour|mail|plate|suit|vest|ward/i.test(lower)) {
      expedition.equipped.armor = String(pick);
      player.defendDie = Math.max(4, Number(player.defendDie || 8) + 1);
      match.log = (match.log || []).concat(['Run armor equipped: ' + String(pick) + ' (+1 defend die).']).slice(-120);
    } else {
      expedition.equipped.weapon = String(pick);
      player.attackDie = Math.max(4, Number(player.attackDie || 8) + 1);
      match.log = (match.log || []).concat(['Run weapon equipped: ' + String(pick) + ' (+1 attack die).']).slice(-120);
    }
    if (/\[AD\+1\]/i.test(String(pick))) {
      expedition.actionDieBonus = Math.max(0, Number(expedition.actionDieBonus || 0) + 1);
      match.log = (match.log || []).concat(['Run relic surge: ' + String(pick) + ' grants +1 Action Die bonus.']).slice(-120);
    }
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleUseExpeditionLoot(idx) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var expedition = match.expedition;
    var list = Array.isArray(expedition.runLoot) ? expedition.runLoot : [];
    var pick = list[Number(idx)];
    if (!pick) return false;
    var found = (typeof findShopItem === 'function') ? findShopItem(pick) : null;
    if (!found || !found.item) {
      if (typeof showNotif === 'function') showNotif('That loot cannot be used directly.', 'warn');
      return false;
    }
    var cat = String(found.cat || '').toLowerCase();
    if (cat === 'scrolls' || cat === 'items' || cat === 'essentials' || cat === 'remedies') {
      var slot = -1;
      if (!Array.isArray(S.backpack)) S.backpack = Array(10).fill('');
      for (var i = 0; i < S.backpack.length; i++) {
        if (!S.backpack[i]) { slot = i; break; }
      }
      if (slot < 0) {
        if (typeof showNotif === 'function') showNotif('Backpack full. Free a slot before using this loot.', 'warn');
        return false;
      }
      S.backpack[slot] = String(pick);
      if (cat === 'scrolls') castScrollFromBackpack(slot);
      else if (cat === 'items' || cat === 'essentials' || cat === 'remedies') useBackpackItem(slot);
      if (Array.isArray(S.backpack) && S.backpack[slot]) {
        S.backpack[slot] = '';
      } else {
        expedition.runLoot.splice(Number(idx), 1);
      }
      if (/\[AD\+1\]/i.test(String(pick))) {
        expedition.actionDieBonus = Math.max(0, Number(expedition.actionDieBonus || 0) + 1);
        match.log = (match.log || []).concat(['Run relic surge: ' + String(pick) + ' grants +1 Action Die bonus.']).slice(-120);
      }
      match.log = (match.log || []).concat(['Run loot used: ' + String(pick) + '.']).slice(-120);
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    }
    if (typeof showNotif === 'function') showNotif('That loot is not a usable item.', 'warn');
    return false;
  }

  function buildCrucibleExpeditionMoveOptionsHtml(match, selectedUnit, reachableHexes) {
    if (!match || !selectedUnit || !Array.isArray(reachableHexes) || !reachableHexes.length) {
      return '<div style="font-size:.72rem;color:var(--muted2);">No movement available.</div>';
    }
    return '<div style="margin:.22rem 0 .3rem;padding:.28rem .32rem;border:1px solid rgba(70,196,182,.22);background:rgba(70,196,182,.06);border-radius:4px;">'
      + '<div style="font-size:.68rem;color:var(--teal);margin-bottom:.14rem;">Move to a highlighted hex</div>'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;">' + reachableHexes.map(function (hex) {
        var label = '[' + (Number(hex.q || 0) + 1) + ',' + (Number(hex.r || 0) + 1) + ']';
        return '<button type="button" class="btn btn-xs btn-teal" onclick="return window.holdingCrucibleExpeditionMoveTo(' + Number(hex.q || 0) + ',' + Number(hex.r || 0) + ');">Move ' + label + '</button>';
      }).join('') + '</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.12rem;">You can also click the highlighted hexes on the board.</div>'
      + '</div>';
  }

  function getCrucibleExpeditionStartingArmorOptions() {
    return [
      { id: 'light', label: 'Light Armor', defendDie: 'd4', actions: 3, desc: 'Minimal protection. +2 movement. Preferred by scouts and assassins.' },
      { id: 'medium', label: 'Medium Armor', defendDie: 'd6', actions: 2, desc: 'Balanced defense and mobility. Standard knight loadout.' },
      { id: 'heavy', label: 'Heavy Armor', defendDie: 'd10', actions: 1, desc: 'Maximum protection. -1 mobility. For tanks and bulwarks.' }
    ];
  }

  function getCrucibleExpeditionStartingWeaponOptions() {
    return [
      { id: 'sword', label: 'Sword +2 Strike', bonus: 2, stat: 'strike', range: 'Engaged', desc: 'Melee mastery. Works at close range.' },
      { id: 'bow', label: 'Bow +2 Shoot', bonus: 2, stat: 'shoot', range: 'Nearby', desc: 'Ranged precision. Works at medium range.' },
      { id: 'fireball', label: 'Fireball +2 Mind', bonus: 2, stat: 'mind', range: 'Close', desc: 'Arcane fireball spell. Cast at close range using Mind vs Dread.' }
    ];
  }

  function buildCrucibleControlLoadoutSelectionHtml() {
    ensureNewFeatureState();
    var selected = (S && S.holding && S.holding.crucible && S.holding.crucible.controlLoadout)
      ? S.holding.crucible.controlLoadout
      : { armor: 'balanced', weapon: 'sword' };
    var armor = String(selected.armor || 'balanced').toLowerCase();
    var weapon = String(selected.weapon || 'sword').toLowerCase();
    var html = '<div style="font-size:.84rem;color:var(--text2);line-height:1.55;max-height:70vh;overflow:auto;">'
      + '<div style="font-family:Cinzel,serif;font-size:1rem;color:var(--gold2);margin-bottom:.25rem;">3v3 Control Briefing</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.28rem;">Wayfarer vs Wayfarer. 10 rounds. Capture zones by standing on each zone for 3 rounds. Hold 2/3 zones to score. Allies and enemies start at Dread d4 and 8 HP.</div>'
      + '<div style="font-size:.72rem;color:var(--teal);margin-bottom:.28rem;">Range rules: Strike = Engaged (1 hex), Spell = Close (2 hex), Shoot = up to weapon range. Some merchant weapons roll Far only (4 hex).</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.38rem;">'
      + '<div style="border:1px solid var(--border2);padding:.34rem .4rem;">'
      + '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.2rem;">Starting Weapon</div>'
      + '<label style="display:block;margin-bottom:.2rem;"><input type="radio" name="controlStartWeapon" value="sword" ' + (weapon === 'sword' ? 'checked' : '') + '> Sword (+2 Strike)</label>'
      + '<label style="display:block;margin-bottom:.2rem;"><input type="radio" name="controlStartWeapon" value="shotgun" ' + (weapon === 'shotgun' ? 'checked' : '') + '> Shotgun (+2 Shoot)</label>'
      + '<label style="display:block;margin-bottom:.2rem;"><input type="radio" name="controlStartWeapon" value="spell" ' + (weapon === 'spell' ? 'checked' : '') + '> Spell Focus (+2 Control)</label>'
      + '</div>'
      + '<div style="border:1px solid var(--border2);padding:.34rem .4rem;">'
      + '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.2rem;">Armor (sets movement/actions)</div>'
      + '<label style="display:block;margin-bottom:.2rem;"><input type="radio" name="controlStartArmor" value="light" ' + (armor === 'light' ? 'checked' : '') + '> Light (3 actions)</label>'
      + '<label style="display:block;margin-bottom:.2rem;"><input type="radio" name="controlStartArmor" value="balanced" ' + (armor === 'balanced' ? 'checked' : '') + '> Balanced (2 actions)</label>'
      + '<label style="display:block;margin-bottom:.2rem;"><input type="radio" name="controlStartArmor" value="heavy" ' + (armor === 'heavy' ? 'checked' : '') + '> Heavy (1 action)</label>'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:.28rem;margin-top:.45rem;">'
      + '<button class="btn btn-sm" onclick="closeModal();">Back</button>'
      + '<button class="btn btn-sm btn-primary" onclick="holdingCrucibleConfirmControlLoadout();">Start 3v3 Control</button>'
      + '</div>'
      + '</div>';
    return html;
  }

  function holdingCrucibleConfirmControlLoadout() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'control') return false;
    if (typeof document === 'undefined') return false;
    var weaponEl = document.querySelector('input[name="controlStartWeapon"]:checked');
    var armorEl = document.querySelector('input[name="controlStartArmor"]:checked');
    var weapon = String(weaponEl && weaponEl.value || 'sword').toLowerCase();
    var armor = String(armorEl && armorEl.value || 'balanced').toLowerCase();
    if (S && S.holding && S.holding.crucible) {
      S.holding.crucible.controlLoadout = { weapon: weapon, armor: armor };
    }
    var player = (match.allies || []).find(function (unit) { return unit && unit.isPlayer; }) || null;
    if (player) {
      applyCrucibleControlLoadout(
        player,
        armor === 'light' ? 'Light Armor' : (armor === 'heavy' ? 'Heavy Armor' : 'Balanced Armor'),
        weapon === 'shotgun' ? 'Shotgun' : (weapon === 'spell' ? 'Spell Focus' : 'Sword')
      );
    }
    match.controlLoaded = true;
    match.log = (match.log || []).concat([
      'Control briefing complete: weapon=' + weapon + ', armor=' + armor + '. Capture each zone by holding it for 3 rounds.'
    ]).slice(-120);
    if (typeof openModal === 'function') {
      openModal('Crucible 3v3 Tactical Simulator', buildHoldingCruciblePopupHtml(), null, { preventScroll: true, focusTrap: true });
    }
    if (typeof showNotif === 'function') {
      showNotif('Control started: ' + weapon + ' loadout with ' + armor + ' armor.', 'good');
    }
    renderHoldingUI();
    return true;
  }

  function getCrucibleExpeditionPersonalFlavorOptions() {
    var allFlavors = [
      'Animal Companion: DD6 | 12 Stress',
      'Holy Shield: Add Spirit Die to Defend Rolls',
      'Emit blinding light — all Engaged Targets are Distracted',
      'Infernal Eyes: Lead rolls step up in fear scenes',
      'Leader: Faction becomes Empowered for the Scene',
      'Beast Form: Use Dread for actions. Small DD4 / Medium DD6 / Large DD8',
      'Telepath: Communicate with anyone you have met',
      'Weaken an object or enemy armor by a Step for a Round',
      'Plastic Bones: Ad6 to Body Checks when using this flavor',
      'Illusionist: When activated, enemies are drawn towards the image, inspecting it for their turn',
      'Regenerator: Recover Valor Die Health each phase and combat round',
      'Electric Burst: Ad8 to Shoot in Close range',
      'Stone Skin: Passive — Ad4 to Defend rolls',
      'Mimic: Copy an action you just witnessed and use it to your advantage',
      'In water: breathe, gain +1 Action, all Action Dice step up',
      'Void Gazer: See invisibility and hidden things',
      'Tactician: After a successful Defend, gain a Free Strike',
      'Trickshot: Ad10 to Shoot rolls',
      'Psychic Dome: Up to 4 people cannot be attacked within',
      'New Senses: vibration, echolocation, or magnetic',
      'Tinkerer: Repair broken things — 1 hour',
      'Scaled Skin: +3 to Defend rolls',
      'Source Attuned: Sense nearby Arcana, Mutants, and unstable mutations',
      'Momentum: Failed rolls grant +2 Teamwork Points instead of +1',
      'Moves like the Wind: +1 Action during Combat Scenes',
      'Feats of Strength: Ad10 to Body and Strike checks',
      'Phase Walker: Pass through walls',
      'Teleportation: Teleport to any location you can see',
      'Mindshield: Immune to Trauma',
      'Healer: Heal Valor Die roll to anyone with a Touch',
      'Mule: Backpack capacity doubles again',
      'Deity Pact: Request a patron favor or minor miracle once per day',
      'Vampire: Blood hunger grants nocturnal power and daylight vulnerability',
      'Werewolf: Bestial strength surges at night with lunar instincts',
      'Echo Step: After a successful Defend, reposition 1 range band for free',
      'Battle Cantor: Ally gains +Valor Die bonus on their next Action roll',
      'Glasswalker: Your first Peril each phase is treated as safe passage',
      'Iron Lungs: Passive — immune to smoke and ash hazard penalties and Coolant Layer requirements',
      'Runesmith: Inscribe a rune to a weapon — roll your Valor Die and add it as a bonus to the next Strike or Shoot with that weapon',
      'Scavenger Memory: First loot roll each day may be rerolled — keep the better result',
      "Mind Touch: Place a single word or feeling in another person's mind",
      'Solar Needle: One ranged attack per scene gains +Valor Die bonus to Shoot',
      'Grave Whisper: Commune with the recent dead for a clue, lore shard, or grave omen',
      'Storm Veins: Reverse Time — take Trauma equal to the number of Rounds reversed',
      'Ruin Scholar: +Valor Die bonus on all checks inside Ruins or the Lost City this phase',
      'Blessed Appetite: Food use heals +1 extra Stress',
      'Duelist Footwork: On hit, step to Nearby without cost',
      'Pathfinder: Add Valor Die as a bonus when encountering Barriers during traversal',
      'Dust Prophet: Reveal the next weather shift — reroll and choose which result applies',
      'Mirror Nerves: Immune to the Distracted Condition',
      'Moon Listener: During Evening or Night phase, gain Valor Die bonus to any roll',
      'Chain Breaker: You cannot be restrained',
      'Warding Palm: Adjacent ally gains Protected for one roll',
      'Quick Draw: First Strike or Shoot each combat gains +Valor Die bonus',
      'Bone Oracle: Read omen from remains once per day',
      'Black Salt Ward: Immune to the Weakened Condition',
      'Winged: Passive — harness the wind to glide short distances',
      'Signal Caller: +Valor Die bonus to Lead checks on caravan and trade routes',
      'Scrap Alchemist: Choose an Item from your backpack and transform it into a remedy',
      'Silent Knife: +Valor Die bonus to Strike when no ally is Engaged',
      'Ash Runner: In Planetary Exploration, ignore the first difficult terrain movement cost',
      'Wildhart: Speak with nature — trees, rivers, and animals understand you',
      "Aura Reader: See a target's emotions and intentions at a glance",
      'Wild Empathy: Beast enemies do not attack you on their first turn',
      'Grim Resolve: At half Health or below, gain +Valor Die bonus to Defend checks',
      'Bloodthirsty: Double all successful Strike roll results',
      'Reflective Eyes: A nearby reflective surface shows what your target sees',
      'Time Traveler: Glimpse 1 hour into the past or future',
      'Friend of Beasts: Animals treat you as a trusted friend',
      'Levitate: Float a few inches above the ground — you leave no footprints and ignore ground-level traps',
      'Trophy Keeper: First enemy defeat each scene gives +Valor Die queued and +1 Teamwork',
      'Quick Stitch: Remove one Injury or negative condition from self or nearby ally per scene',
      'Third Eye: Leave an eye to spy — you see through it and cannot be Surprised',
      'Faultline Sense: Immune to the Shaken Condition',
      'Mime: You can mimic sounds you have heard, including voices',
      'Mercy Hand: Spare a defeated enemy — +1 Renown for the act of mercy',
      'Kaleidoscopic Face: Mimic any face you have seen',
      'Beast Eyes: Bond with a crow — you can see through its eyes',
      'Summoner: Call any weapon or tool for the task. One item at a time',
      'Walks on Walls: You can climb any walls',
      'Polyglot: You speak and read multiple languages',
      'Hunt Rhythm: After a successful Defend, next Strike gains +Valor Die bonus',
      'Vowkeeper: When making a pact, you feel it if they break it. Keep your Vow to gain +1 Renown',
      'Steel Prayer: Immune to Radiation',
      'Ghoststride: Movement does not trigger simple traps',
      'Iridescent Blood: Roll Spirit vs Enemy Dread — on success, control their actions for a Scene',
      'Field Quartermaster: You cannot be surprised',
      'Cave Ears: +Valor Die bonus to Mind and Lead checks in enclosed spaces',
      'Ghoul: On a killing blow, disappear and gain Hidden. Gain Advantage d10 to next Attack. Reappear on next attack or after one Round',
      'Bone Sculptor: Shape and animate small bones for various purposes',
      'Ashen Halo: You inspire allies, allowing them to Move without AP cost until your next Turn',
      'Dawnbreaker: First Morning action gains +Valor Die bonus',
      'Duskcaller: When approaching an unaware enemy (Close to Engaged), attack from behind for +2 bonus on Strike roll',
      'Telekinesis: Manipulate objects you can see using your mind',
      'Compel: Utter a divine truth — enemy believes it for Rounds equal to Control vs Dread difference',
      'Fracture Sight: While Engaged with a Target, allies gain Advantage d6 to Defend against it. If it moves away, make a +2 Strike against it',
      'Torchbearer: You emit light in darkness',
      'Academic: Photographic memory — you never forget what you have read or seen',
      'Truthteller: Force someone to tell the truth — they speak truth or fall silent if about to lie',
      'Spectral Chains: Project three ethereal chains that attack using your Spirit die, each with Stress equal to half your Spirit die',
      'Frosted: Chill any object with a touch',
      'Pact Witness: +Valor Die bonus to Spirit on deity pact outcomes',
      'Reverse Time: Rewind up to 2 rounds; take Mental Stress equal to rounds reversed',
      'Enhance Abilities: Step up the next allied action with an elevated bonus die',
      'Shed Skin: Roll a new appearance and count as disguised for the current scene',
      'Undying: If struck down, regenerate into a newly generated Wayfarer shell',
      'Beast Call: Summon 4 beasts, each DD4 with 8 Stress',
      'Monk: Bonus Valor Die to Strike when unarmed',
      'Siphon Energy: Heal equal to the damage you deal',
      'Stop Time: Freeze the field for a round; gain Valor Die as Mental Stress each round time is stopped',
      'Lucky: Reroll 1s on your Action Die',
      'Tremor Pulse: All in your Zone must Save vs your Valor Die or lose 1 Action',
      'Cloning: Create clones equal to your current remaining Health, each DD4 with 1 Stress',
      "Increase Gravity: A target’s actions cost +1 Action this round",
      'Slow Time: One target only gets 1 Action on their turn this round',
      'Relive Last Moments: Touch a corpse to replay its recent memories for clues, routes, or warnings'
    ];
    return allFlavors.slice(0, 150);
  }

  function getCrucibleExpeditionWayfarerActionDice() {
    if (typeof S === 'undefined' || !S || !Array.isArray(S.soulArray)) return [8, 6];
    var dice = S.soulArray.slice();
    var bonus = Number(S && S.holding && S.holding.crucible && S.holding.crucible.expedition ? S.holding.crucible.expedition.actionDieBonus : 0);
    for (var i = 0; i < bonus; i++) dice.push(8);
    return dice;
  }

  function getCrucibleExpeditionStartingPassiveFeatures(selectedFlavor) {
    var flavor = String(selectedFlavor || '').toLowerCase();
    var features = [
      { id: 'pathfinder', label: 'Pathfinder', desc: 'First traversal check each phase gains +1.' },
      { id: 'fieldcraft', label: 'Fieldcraft', desc: 'Ignore the first minor terrain penalty each phase.' }
    ];

    if (flavor.indexOf('lucky') >= 0) {
      features.push({ id: 'lucky_1', label: 'Lucky Spark', desc: 'Reroll one Action Die result of 1 per scene.' });
    } else if (flavor.indexOf('mindshield') >= 0 || flavor.indexOf('trauma') >= 0) {
      features.push({ id: 'mindshield_1', label: 'Mindshield', desc: 'Reduce first mental stress source by 1 each scene.' });
    } else if (flavor.indexOf('healer') >= 0 || flavor.indexOf('medic') >= 0) {
      features.push({ id: 'medic_1', label: 'Field Medic', desc: 'First heal each scene restores +1 additional HP.' });
    } else {
      features.push({ id: 'adaptable_1', label: 'Adaptable', desc: 'Gain +1 on the first non-combat check each phase.' });
    }

    return features;
  }

  function getCrucibleExpeditionAvailableRaidNodes() {
    if (typeof hasTitanRaidNode !== 'function' || typeof getTitanRaidNode !== 'function') return [];
    var allNodes = [
      'titan_root_lead_d20',
      'titan_root_defend_plus3',
      'tact_root',
      'fury_root',
      'seek_root',
      'exile_root_control_d20',
      'godbound_root_defend_d20',
      'weaver_root'
    ];
    return allNodes.filter(function (nodeId) {
      try {
        return hasTitanRaidNode(nodeId);
      } catch (_e) {
        return false;
      }
    }).map(function (nodeId) {
      try {
        var node = getTitanRaidNode(nodeId);
        return node ? { id: nodeId, label: node.label || nodeId } : null;
      } catch (_e) {
        return null;
      }
    }).filter(function (n) { return n; });
  }

  function buildCrucibleExpeditionLoadoutSelectionHtml() {
    var armorOptions = getCrucibleExpeditionStartingArmorOptions();
    var weaponOptions = getCrucibleExpeditionStartingWeaponOptions();
    var flavorOptions = getCrucibleExpeditionPersonalFlavorOptions();
    var actionDice = getCrucibleExpeditionWayfarerActionDice();
    var raidNodes = getCrucibleExpeditionAvailableRaidNodes();
    var selectedArmor = 'medium';
    var selectedWeapon = 'sword';
    var currentFlavor = (window._expeditionLoadout && window._expeditionLoadout.flavor) ? String(window._expeditionLoadout.flavor) : '';
    var selectedFlavor = flavorOptions.find(function (flavor) { return String(flavor || '') === currentFlavor; }) || flavorOptions[0] || 'Lucky';
    var diceDisplay = Array.isArray(actionDice) ? actionDice.map(function (d) { return 'd' + d; }).join(', ') : 'd8, d6';
    var html = '<div style="font-family:\'Cinzel\',serif;color:var(--text2);line-height:1.6;max-height:70vh;overflow-y:auto;">'
      + '<div style="margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid var(--border);">'
        + '<h3 style="color:var(--gold2);font-size:1.2rem;margin-bottom:.5rem;">Expedition Loadout Selection</h3>'
        + '<p style="font-size:.9rem;color:var(--muted2);">Choose your starting equipment before entering the province. Your Soul Array action dice will be assigned automatically.</p>'
      + '</div>'
      + '<div style="margin-bottom:1.2rem;">'
        + '<div style="font-weight:600;color:var(--teal2);margin-bottom:.4rem;font-size:.95rem;">Starting Armor</div>'
        + armorOptions.map(function (opt) {
          return '<label style="display:block;margin-bottom:.4rem;padding:.4rem;border:1px solid ' + (selectedArmor === opt.id ? 'var(--teal)' : 'var(--border)') + ';border-radius:4px;cursor:pointer;background:' + (selectedArmor === opt.id ? 'rgba(46,196,182,.1)' : 'transparent') + ';">'
            + '<input type="radio" name="expeditionArmor" value="' + opt.id + '" ' + (selectedArmor === opt.id ? 'checked' : '') + ' onchange="window._expeditionLoadout.armor=this.value;" style="margin-right:.4rem;" />'
            + '<strong>' + opt.label + '</strong> (' + opt.defendDie + ' Defend | ' + opt.actions + ' Actions)'
            + '<div style="font-size:.8rem;color:var(--muted2);margin-top:.2rem;">' + opt.desc + '</div>'
            + '</label>';
        }).join('')
      + '</div>'
      + '<div style="margin-bottom:1.2rem;">'
        + '<div style="font-weight:600;color:var(--teal2);margin-bottom:.4rem;font-size:.95rem;">Starting Weapon</div>'
        + weaponOptions.map(function (opt) {
          return '<label style="display:block;margin-bottom:.4rem;padding:.4rem;border:1px solid ' + (selectedWeapon === opt.id ? 'var(--teal)' : 'var(--border)') + ';border-radius:4px;cursor:pointer;background:' + (selectedWeapon === opt.id ? 'rgba(46,196,182,.1)' : 'transparent') + ';">'
            + '<input type="radio" name="expeditionWeapon" value="' + opt.id + '" ' + (selectedWeapon === opt.id ? 'checked' : '') + ' onchange="window._expeditionLoadout.weapon=this.value;" style="margin-right:.4rem;" />'
            + '<strong>' + opt.label + '</strong> (Range: ' + opt.range + ')'
            + '<div style="font-size:.8rem;color:var(--muted2);margin-top:.2rem;">' + opt.desc + '</div>'
            + '</label>';
        }).join('')
      + '</div>'
      + '<div style="margin-bottom:1.2rem;">'
        + '<div style="font-weight:600;color:var(--teal2);margin-bottom:.4rem;font-size:.95rem;">Personal Flavor <span style="cursor:help;font-size:.85rem;color:var(--muted2);" title="Your personal flavor grants a special ability unique to your character. Select the one that resonates most with your playstyle.">(?)</span></div>'
        + '<input type="text" id="flavorSearch" placeholder="Search flavors..." onkeyup="window._expeditionLoadout.filterFlavors(this.value);" style="width:100%;margin-bottom:.4rem;padding:.4rem;font-size:.9rem;" />'
        + '<div style="display:grid;grid-template-columns:1fr;gap:.3rem;max-height:18rem;overflow-y:auto;border:1px solid var(--border);padding:.4rem;border-radius:4px;" id="flavorList">' 
        + flavorOptions.map(function (flavor, idx) {
          var flavorName = String(flavor || '').split(':')[0].trim();
          var flavorDesc = String(flavor || '').split(':').slice(1).join(':').trim();
          return '<label style="padding:.3rem;border:1px solid var(--border);border-radius:3px;cursor:pointer;background:' + (selectedFlavor === flavor ? 'rgba(46,196,182,.1)' : 'transparent') + ';display:flex;align-items:flex-start;gap:.3rem;">'
            + '<input type="radio" name="expeditionFlavor" value="' + String(flavor).replace(/"/g, '&quot;') + '" ' + (selectedFlavor === flavor ? 'checked' : '') + ' onchange="window._expeditionLoadout.flavor=this.value;" style="margin-top:.1rem;flex-shrink:0;" />'
            + '<div style="flex:1;font-size:.8rem;">'
              + '<strong style="color:var(--teal2);">' + flavorName + '</strong>'
              + '<div style="color:var(--muted2);margin-top:.1rem;" title="' + flavorDesc + '">' + flavorDesc.substr(0, 60) + (flavorDesc.length > 60 ? '...' : '') + '</div>'
            + '</div>'
            + '</label>';
        }).join('')
        + '</div>'
        + '<div style="font-size:.82rem;color:var(--muted2);margin-top:.45rem;">Selected Personal Flavor: <strong style="color:var(--gold2);">' + String(selectedFlavor || 'Lucky').split(':')[0].trim() + '</strong>' + (String(selectedFlavor || '').indexOf(':') >= 0 ? ' - ' + String(selectedFlavor).split(':').slice(1).join(':').trim() : '') + '</div>'
      + '</div>'
      + '<div style="margin-bottom:1.2rem;padding:.6rem;background:rgba(46,196,182,.05);border:1px solid rgba(46,196,182,.2);border-radius:4px;">'
        + '<div style="font-weight:600;color:var(--teal2);margin-bottom:.4rem;">Character Resources</div>'
        + '<div style="font-size:.9rem;margin-bottom:.3rem;"><strong>Soul Array Action Dice:</strong> ' + diceDisplay + '</div>'
        + (raidNodes.length > 0 ? '<div style="font-size:.9rem;"><strong>Available Raid Nodes:</strong> ' + raidNodes.map(function (n) { return n.label; }).join(', ') + '</div>' : '<div style="font-size:.9rem;color:var(--muted2);">No Raid Nodes purchased yet.</div>')
      + '</div>'
      + '<div style="display:flex;gap:.4rem;justify-content:flex-end;margin-top:1rem;">'
        + '<button class="btn btn-sm" onclick="window.cancelCrucibleExpeditionLoadoutSelection();">Cancel Run Setup</button>'
        + '<button class="btn btn-sm btn-primary" onclick="window.confirmCrucibleExpeditionLoadout();">Start Expedition</button>'
      + '</div>'
      + '</div>';
    window._expeditionLoadout = {
      armor: selectedArmor,
      weapon: selectedWeapon,
      flavor: selectedFlavor,
      filterFlavors: function (query) {
        var lower = String(query || '').toLowerCase();
        var labels = document.querySelectorAll('#flavorList label');
        labels.forEach(function (label) {
          var text = label.textContent.toLowerCase();
          label.style.display = text.indexOf(lower) >= 0 ? 'flex' : 'none';
        });
      }
    };
    return html;
  }

  function validateCrucibleExpeditionLoadoutSelection(loadout) {
    var selected = loadout || {};
    var armor = String(selected.armor || '').toLowerCase();
    var weapon = String(selected.weapon || '').toLowerCase();
    var flavor = String(selected.flavor || '').trim();
    var armorOptions = getCrucibleExpeditionStartingArmorOptions();
    var weaponOptions = getCrucibleExpeditionStartingWeaponOptions();
    var flavorOptions = getCrucibleExpeditionPersonalFlavorOptions();

    var armorOpt = armorOptions.find(function (entry) { return String(entry.id || '').toLowerCase() === armor; }) || null;
    if (!armorOpt) {
      return { ok: false, reason: 'Choose Light, Medium, or Heavy armor before starting.' };
    }
    var weaponOpt = weaponOptions.find(function (entry) { return String(entry.id || '').toLowerCase() === weapon; }) || null;
    if (!weaponOpt) {
      return { ok: false, reason: 'Choose a starting weapon before starting.' };
    }
    var flavorExact = flavorOptions.find(function (entry) { return String(entry || '') === flavor; }) || null;
    if (!flavorExact) {
      return { ok: false, reason: 'Choose one Personal Flavor from the list.' };
    }
    var flavorMechanic = (typeof getPersonalFlavorMechanicProfile === 'function')
      ? (getPersonalFlavorMechanicProfile(flavorExact) || null)
      : null;
    var passivePreview = getCrucibleExpeditionStartingPassiveFeatures(flavorExact);
    if (!flavorMechanic && (!Array.isArray(passivePreview) || !passivePreview.length)) {
      return { ok: false, reason: 'Selected Personal Flavor has no mechanics profile. Pick another flavor.' };
    }
    return {
      ok: true,
      armorOpt: armorOpt,
      weaponOpt: weaponOpt,
      flavor: flavorExact
    };
  }

  function cancelCrucibleExpeditionLoadoutSelection() {
    ensureNewFeatureState();
    if (S && S.holding && S.holding.crucible) S.holding.crucible.match = null;
    if (typeof closeModal === 'function') closeModal();
    renderHoldingUI();
    return true;
  }

  function confirmCrucibleExpeditionLoadout() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var loadout = window._expeditionLoadout || {};
    var armor = String(loadout.armor || 'medium');
    var weapon = String(loadout.weapon || 'sword');
    var flavor = String(loadout.flavor || 'Lucky');
    var validated = validateCrucibleExpeditionLoadoutSelection({ armor: armor, weapon: weapon, flavor: flavor });
    if (!validated.ok) {
      if (typeof showNotif === 'function') showNotif(validated.reason || 'Expedition loadout is incomplete.', 'warn');
      return false;
    }
    armor = String(validated.armorOpt.id || armor);
    weapon = String(validated.weaponOpt.id || weapon);
    flavor = String(validated.flavor || flavor);
    var expedition = match.expedition;
    var party = getCrucibleExpeditionParty(match);
    if (!party.length) return false;
    var armorOptions = getCrucibleExpeditionStartingArmorOptions();
    var weaponOptions = getCrucibleExpeditionStartingWeaponOptions();
    var actionDice = getCrucibleExpeditionWayfarerActionDice();
    var armorOpt = armorOptions.find(function (a) { return a.id === armor; });
    var weaponOpt = weaponOptions.find(function (w) { return w.id === weapon; });
    party.forEach(function (player, idx) {
      if (!player) return;
      if (armorOpt) {
        if (armorOpt.defendDie === 'd4') player.defendDie = 4;
        else if (armorOpt.defendDie === 'd6') player.defendDie = 6;
        else if (armorOpt.defendDie === 'd10') player.defendDie = 10;
        player.ap = Number(armorOpt.actions || 2);
      }
      if (weaponOpt) {
        player.attackDie = Math.max(4, Number(player.attackDie || 8) + Number(weaponOpt.bonus || 0));
      }
      if (Array.isArray(actionDice) && actionDice.length > 0) {
        player.actionDice = actionDice.slice();
      }
      var appliedFlavor = idx === 0
        ? flavor
        : String((player.personalFlavor && (player.personalFlavor.full || player.personalFlavor.name)) || 'Lucky');
      var flavorParts = appliedFlavor.split(':');
      player.personalFlavor = {
        name: String(flavorParts[0] || appliedFlavor).trim(),
        detail: String(flavorParts.slice(1).join(':') || '').trim(),
        full: appliedFlavor
      };
      player.passiveFeatures = getCrucibleExpeditionStartingPassiveFeatures(appliedFlavor);
    });
    expedition.loadout = {
      armor: armor,
      weapon: weapon,
      flavor: flavor,
      actionDice: Array.isArray(actionDice) ? actionDice.slice() : []
    };
    expedition.actionDieBonus = Math.max(0, Number(expedition.actionDieBonus || 0));
    expedition.loaded = true;
    match.log = (match.log || []).concat(['Loadout applied: ' + armor + ' armor (' + (armorOpt ? armorOpt.defendDie + ' Defend, ' + armorOpt.actions + ' Actions' : '?') + '), ' + weapon + ' weapon, personal flavor: ' + flavor + '.']).slice(-120);
    if (typeof openModal === 'function') {
      openModal('Expedition Province', buildCrucibleExpeditionPopupHtml(match), null, { preventScroll: true, focusTrap: true });
    } else if (typeof renderHoldingCruciblePopup === 'function') {
      renderHoldingCruciblePopup();
    }
    renderHoldingUI();
    return true;
  }

  function getCrucibleUnitActionBudget(unit) {
    if (!unit || Number(unit.hp || 0) <= 0) return { total: 0, remaining: 0, used: 0 };
    var total = Math.max(0, Number(unit.maxAp || 2));
    var remaining = Math.max(0, Math.min(total, Number(unit.ap || 0)));
    return { total: total, remaining: remaining, used: Math.max(0, total - remaining) };
  }

  function getCrucibleTeamActionBudget(units) {
    var living = getLivingTeamUnits(units || []);
    var total = 0;
    var remaining = 0;
    living.forEach(function (unit) {
      var budget = getCrucibleUnitActionBudget(unit);
      total += Number(budget.total || 0);
      remaining += Number(budget.remaining || 0);
    });
    return {
      total: total,
      remaining: remaining,
      used: Math.max(0, total - remaining)
    };
  }

  function applyCrucibleExpeditionFleePenalty(match) {
    if (!match || !match.expedition || String(match.expedition.currentCombatType || '') !== 'fieldEnemy' && String(match.expedition.currentCombatType || '') !== 'fieldBoss') return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player) return false;
    player.hp = Math.max(0, Number(player.hp || 6) - 3);
    match.expedition.fleePenalty = true;
    match.log = (match.log || []).concat(['Penalty for fleeing: -3 damage taken.']).slice(-120);
    if (typeof showNotif === 'function') showNotif('Fled from combat with penalty: -3 HP.', 'warn');
    return true;
  }

  function tryCrucibleExpeditionDirectMove(match, q, r) {
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    if (String(match.expedition.phase || 'explore') !== 'explore') return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position || Number(player.hp || 0) <= 0) return false;
    if (!match.hexMap || !match.hexMap.hexes) return false;

    var nextQ = Number(q);
    var nextR = Number(r);
    var targetHex = { q: nextQ, r: nextR };
    var key = String(nextQ) + ',' + String(nextR);
    var cell = match.hexMap.hexes[key];
    if (!cell) return false;

    if (match.expedition.collapsed && match.expedition.collapsed[key]) {
      if (typeof showNotif === 'function') showNotif('That hex is gone. The night already took it.', 'warn');
      return true;
    }

    var distance = (Math.abs(Number(player.position.q || 0) - nextQ)
      + Math.abs((Number(player.position.q || 0) + Number(player.position.r || 0)) - (nextQ + nextR))
      + Math.abs(Number(player.position.r || 0) - nextR)) / 2;
    if (distance !== 1) {
      if (typeof showNotif === 'function') showNotif('Pick an adjacent hex.', 'warn');
      return true;
    }

    var targetBarrier = getCrucibleExpeditionBarrierCell(match, targetHex);
    if (!targetBarrier && (cell.obstacle || cell.door)) {
      if (typeof showNotif === 'function') showNotif('That adjacent hex is blocked.', 'warn');
      return true;
    }

    var occupied = getUnitsInHex((match.allies || []).concat(match.enemies || []), targetHex, match.hexMap);
    if (occupied && occupied.length) {
      if (typeof showNotif === 'function') showNotif('That hex is occupied.', 'warn');
      return true;
    }

    match.turnSide = 'ally';
    match.selectedAllyId = String(player.id || '');
    if (!resolveCrucibleExpeditionBarrierCrossing(match, player, player.position, targetHex)) return true;

    player.position = { q: nextQ, r: nextR };
    resolveCrucibleExpeditionPerilHex(match, player, targetHex);
    match.log = (match.log || []).concat([player.name + ' moved to [' + nextQ + ',' + nextR + '] (adjacent click move).']).slice(-120);
    recordCrucibleExpeditionHexClick(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleHandleBoardHexClick(q, r) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || 'explore') === 'explore') {
      return holdingCrucibleExpeditionMoveTo(q, r);
    }
    if (tryCrucibleExpeditionDirectMove(match, q, r)) return true;
    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || 'explore') === 'explore') {
      var player = getCrucibleExpeditionPlayer(match);
      if (player) {
        match.turnSide = 'ally';
        match.selectedAllyId = String(player.id || '');
      }
    }
    var moved = holdingCrucibleMoveSelected(q, r);
    if (!moved && String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || 'explore') === 'explore') {
      if (typeof showNotif === 'function') showNotif('That hex is not currently reachable.', 'warn');
    }
    if (moved && String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || 'explore') === 'explore') {
      recordCrucibleExpeditionHexClick(match);
      renderHoldingCruciblePopup();
      renderHoldingUI();
    }
    return moved;
  }

  function holdingCrucibleExpeditionMoveTo(q, r) {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    if (String(match.expedition.phase || 'explore') !== 'explore') {
      if (typeof showNotif === 'function') showNotif('Movement is only available in Exploration phase.', 'warn');
      return false;
    }
    var nextQ = Number(q);
    var nextR = Number(r);
    if (!Number.isFinite(nextQ) || !Number.isFinite(nextR)) {
      if (typeof showNotif === 'function') showNotif('Invalid destination hex.', 'warn');
      return false;
    }
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position || Number(player.hp || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif('No active Wayfarer can move right now.', 'warn');
      return false;
    }
    match.turnSide = 'ally';
    match.selectedAllyId = String(player.id || '');

    var before = String(Number(player.position.q || 0)) + ',' + String(Number(player.position.r || 0));
    var moved = holdingCrucibleMoveSelected(nextQ, nextR);
    if (!moved) {
      var directResult = tryCrucibleExpeditionDirectMove(match, nextQ, nextR);
      if (directResult) {
        var fallbackPlayer = getCrucibleExpeditionPlayer(match);
        var fallbackAfter = fallbackPlayer && fallbackPlayer.position
          ? (String(Number(fallbackPlayer.position.q || 0)) + ',' + String(Number(fallbackPlayer.position.r || 0)))
          : before;
        if (fallbackAfter !== before) {
          return true;
        }
      }
    }
    if (moved) {
      player = getCrucibleExpeditionPlayer(match);
      var after = player && player.position
        ? (String(Number(player.position.q || 0)) + ',' + String(Number(player.position.r || 0)))
        : before;
      if (after === before) {
        if (typeof showNotif === 'function') showNotif('Move attempted but position did not change.', 'warn');
        return false;
      }
      recordCrucibleExpeditionHexClick(match);
      renderHoldingUI();
      return true;
    }
    if (typeof showNotif === 'function') showNotif('That hex is not currently reachable.', 'warn');
    return false;
  }

  function holdingCrucibleStartDrag(side, unitId) {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var activeSide = String(match.turnSide || 'ally');
    var tokenSide = String(side || 'ally');
    if (tokenSide !== activeSide) {
      if (typeof showNotif === 'function') showNotif('Only the active side can be moved this turn.', 'warn');
      return false;
    }
    var picker = tokenSide === 'enemy' ? selectHoldingCrucibleEnemy : selectHoldingCrucibleUnit;
    if (typeof picker === 'function') picker(unitId);
    var unit = findCrucibleUnit(match, tokenSide, unitId);
    if (!unit || Number(unit.hp || 0) <= 0 || Number(unit.ap || 0) <= 0) return false;
    window._holdingCrucibleDrag = { side: tokenSide, id: String(unitId || '') };
    return true;
  }

  function holdingCrucibleEndDrag() {
    window._holdingCrucibleDrag = null;
    return true;
  }

  function holdingCrucibleHandleHexDragOver(evt, q, r) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    return false;
  }

  function holdingCrucibleDropOnHex(q, r) {
    var drag = window._holdingCrucibleDrag || null;
    if (!drag) return false;
    var match = getHoldingCrucibleMatch();
    if (!match) {
      window._holdingCrucibleDrag = null;
      return false;
    }
    var activeSide = String(match.turnSide || 'ally');
    if (String(drag.side || 'ally') !== activeSide) {
      window._holdingCrucibleDrag = null;
      return false;
    }
    var picker = activeSide === 'enemy' ? selectHoldingCrucibleEnemy : selectHoldingCrucibleUnit;
    if (typeof picker === 'function') picker(String(drag.id || ''));
    var moved = holdingCrucibleMoveSelected(q, r);
    window._holdingCrucibleDrag = null;
    return moved;
  }

  function executeCrucibleMoveAction(actor, target, match, logs) {
    if (!actor || !match) return false;
    var destination = null;
    var options = (typeof getCrucibleOpenHexes === 'function')
      ? getCrucibleOpenHexes(actor, match, 1).filter(function (hex) {
        return !actor.position || hex.q !== actor.position.q || hex.r !== actor.position.r;
      })
      : [];
    if (!options.length) {
      if (typeof showNotif === 'function') showNotif('No adjacent open hex to move into.', 'warn');
      return false;
    }
    if (target && target.position && typeof getUnitDistance === 'function') {
      options.sort(function (a, b) {
        var da = getUnitDistance({ position: { q: Number(a.q || 0), r: Number(a.r || 0) } }, target);
        var db = getUnitDistance({ position: { q: Number(b.q || 0), r: Number(b.r || 0) } }, target);
        return Number(da || 99) - Number(db || 99);
      });
    }
    destination = options[0] || null;
    if (!destination) return false;
    actor.position = { q: Number(destination.q || 0), r: Number(destination.r || 0) };
    if (logs) logs.push(actor.name + ' moved to [' + actor.position.q + ',' + actor.position.r + '].');
    if (typeof triggerHexTerrainEffects === 'function') triggerHexTerrainEffects(actor, actor.position, match.hexMap, logs);
    if (match.hexMap && match.hexMap.hexes) {
      var movedCell = match.hexMap.hexes[String(actor.position.q) + ',' + String(actor.position.r)];
      if (movedCell && movedCell.teleport && movedCell.teleport.active && typeof getCrucibleRandomOpenHex === 'function') {
        var blink = getCrucibleRandomOpenHex(actor, match, 999);
        if (blink) {
          actor.position = { q: Number(blink.q || 0), r: Number(blink.r || 0) };
          if (logs) logs.push('◉ Teleport hex redirected ' + actor.name + ' to [' + actor.position.q + ',' + actor.position.r + '].');
        }
      }
    }
    return true;
  }

  function holdingCrucibleExecuteWayfarerAction() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.turnSide || 'ally') !== 'ally') return false;
    if (typeof document === 'undefined') return false;
    var actionEl = document.getElementById('crucibleWayfarerActionSelect');
    var targetEl = document.getElementById('crucibleWayfarerTargetSelect');
    if (!actionEl) return false;
    var action = String(actionEl.value || '').toLowerCase();
    var actor = String(match.mode || '') === 'expedition'
      ? (getSelectedCrucibleAlly(match) || chooseNextCrucibleExpeditionPlanner(match) || getCrucibleExpeditionPlayer(match))
      : ((match.allies || []).find(function (u) { return u && u.isPlayer && Number(u.hp || 0) > 0; }) || null);
    if (!actor) {
      if (typeof showNotif === 'function') showNotif('Wayfarer is down and cannot act.', 'warn');
      return false;
    }
    match.selectedAllyId = String(actor.id || '');
    if (Number(actor.ap || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif(actor.name + ' has no AP left.', 'warn');
      return false;
    }

    var targetRef = targetEl ? String(targetEl.value || '') : '';
    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || '') === 'combat' && isCrucibleExpeditionCampaignPartyMode()) {
      if (action === 'spell' || action === 'hack') {
        return queueCrucibleExpeditionSpellHackWithPrompt(match, actor, action, targetRef);
      }
      var queuedLogs = [];
      if (!queueCrucibleExpeditionCombatAction(match, actor, action, targetRef, queuedLogs)) return false;
      match.log = (match.log || []).concat(queuedLogs).slice(-120);
      maybeSyncCrucibleSelection(match);
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    }
    var target = null;
    if (targetRef.indexOf('enemy:') === 0) {
      target = findCrucibleUnit(match, 'enemy', targetRef.split(':')[1]);
    }
    if (!target || Number(target.hp || 0) <= 0) {
      target = getSelectedCrucibleTarget(match);
    }
    var logs = [];
    var moveAction = action.indexOf('move') === 0;
    if (action.indexOf('defend') >= 0) {
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      actor.defendBuff = Math.max(0, Number(actor.defendBuff || 0) + 3 + applyCrucibleExpeditionFlavorRollBonus(match, actor, 'defend', 'support'));
      logs.push(actor.name + ' defended (+3 to next Defend roll).');
    } else if (action.indexOf('support') >= 0) {
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      actor.strikeBonus = Math.max(0, Number(actor.strikeBonus || 0) + 3 + applyCrucibleExpeditionFlavorRollBonus(match, actor, 'lead', 'support'));
      logs.push(actor.name + ' prepared a support setup (+3 to next attack).');
    } else if (action.indexOf('flavor') >= 0) {
      var flavorDist = (target && typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, target) || 99) : 99;
      var flavorInRange = (typeof canUseCruciblePersonalFlavorRange === 'function')
        ? canUseCruciblePersonalFlavorRange(flavorDist)
        : (flavorDist > 0 && flavorDist <= 2);
      if (!target || !flavorInRange) {
        if (typeof showNotif === 'function') showNotif('Personal Flavor needs a close target (Engaged or Close).', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      if (typeof executePersonalFlavor === 'function') {
        executePersonalFlavor(actor, 'crucible-' + Number(match.round || 1), match.hexMap, logs);
      } else {
        logs.push(actor.name + ' used Personal Flavor.');
      }
    } else if (action === 'spell' || action === 'hack') {
      if (!target || !canCrucibleUnitCastActionOnTarget(actor, target, action)) {
        if (typeof showNotif === 'function') showNotif('Select a valid target in spell/hack range first.', 'warn');
        return false;
      }
      return executeCrucibleSpellHackWithCircumstances(actor, target, action, match, logs, isNewFeaturesManualRollMode());
    } else if (moveAction) {
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      if (!executeCrucibleMoveAction(actor, target, match, logs)) {
        actor.ap = Math.max(0, Number(actor.ap || 0) + 1);
        return false;
      }
    } else {
      var attackType = action === 'strike' || action === 'shoot' ? action : 'attack';
      if (!target || !canCrucibleUnitUseAttackType(actor, target, attackType)) {
        if (typeof showNotif === 'function') showNotif('Selected enemy is out of range for ' + attackType + '.', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      var dist = (typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, target) || 0) : 0;
      logs.push(actor.name + ' used ' + (attackType === 'attack' ? (dist <= 1 ? 'Strike' : 'Shoot') : (attackType === 'strike' ? 'Strike' : 'Shoot')) + '.');
      runCrucibleAttack(actor, target, logs, match);
    }

    match.log = (match.log || []).concat(logs).slice(-120);
    maybeSyncCrucibleSelection(match);
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleExecuteTeamAction() {
    var match = getHoldingCrucibleMatch();
    var expeditionPlanning = !!(match
      && String(match.mode || '') === 'expedition'
      && match.expedition
      && String(match.expedition.phase || '') === 'combat'
      && getCrucibleExpeditionPartySize(match) > 1);
    if (!match || (!expeditionPlanning && String(match.turnSide || 'ally') !== 'ally')) return false;
    if (expeditionPlanning && String(match.turnSide || 'ally') !== 'ally') {
      match.turnSide = 'ally';
    }
    if (typeof document === 'undefined') return false;
    var actionEl = document.getElementById('crucibleTeamActionSelect');
    var targetEl = document.getElementById('crucibleTeamTargetSelect');
    if (!actionEl || !targetEl) return false;

    var actor = getSelectedCrucibleAlly(match);
    if (!actor || Number(actor.hp || 0) <= 0) return false;
    if (String(match.mode || '') === 'expedition' && getCrucibleExpeditionPartySize(match) <= 1) {
      if (typeof showNotif === 'function') showNotif('Team Action is only enabled for Campaign Expedition parties.', 'info');
      return false;
    }
    if (actor.isPlayer && String(match.mode || '') !== 'expedition') {
      if (typeof showNotif === 'function') showNotif('Select a teammate for Team Action, or use Wayfarer Action for yourself.', 'warn');
      return false;
    }
    if (Number(actor.ap || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif(actor.name + ' has no AP left.', 'warn');
      return false;
    }

    var action = String(actionEl.value || 'attack').toLowerCase();
    var targetRef = String(targetEl.value || '');
    var logs = [];

    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || '') === 'combat') {
      if (!targetRef || targetRef.indexOf(':') < 0) {
        var fallbackEnemy = findCrucibleUnit(match, 'enemy', String(match.selectedTargetId || ''))
          || getLivingTeamUnits(match.enemies || [])[0]
          || null;
        if (fallbackEnemy) targetRef = 'enemy:' + String(fallbackEnemy.id || '');
      }
      if (!queueCrucibleExpeditionCombatAction(match, actor, action, targetRef, logs)) return false;
      match.log = (match.log || []).concat(logs).slice(-120);
      maybeSyncCrucibleSelection(match);
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    }

    if (action === 'attack') {
      if (!targetRef || targetRef.indexOf('enemy:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Pick an engaged/close enemy target.', 'warn');
        return false;
      }
      var targetEnemy = findCrucibleUnit(match, 'enemy', targetRef.split(':')[1]);
      if (!targetEnemy || !canCrucibleUnitAttack(actor, targetEnemy)) {
        if (typeof showNotif === 'function') showNotif('Target out of range for Attack.', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      var dist = (typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, targetEnemy) || 0) : 0;
      logs.push(actor.name + ' used ' + (dist <= 1 ? 'Strike' : 'Shoot') + '.');
      runCrucibleAttack(actor, targetEnemy, logs, match);
    } else if (action === 'move') {
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      var moveTarget = null;
      if (targetRef && targetRef.indexOf('enemy:') === 0) moveTarget = findCrucibleUnit(match, 'enemy', targetRef.split(':')[1]);
      if (!executeCrucibleMoveAction(actor, moveTarget, match, logs)) {
        actor.ap = Math.max(0, Number(actor.ap || 0) + 1);
        return false;
      }
    } else if (action === 'defend') {
      if (!targetRef || targetRef.indexOf('ally:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Pick an ally to defend.', 'warn');
        return false;
      }
      var defendTarget = findCrucibleUnit(match, 'ally', targetRef.split(':')[1]);
      if (!defendTarget) return false;
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      defendTarget.defendBuff = Math.max(0, Number(defendTarget.defendBuff || 0) + applyCrucibleExpeditionFlavorRollBonus(match, actor, 'defend', 'support'));
      executeDefendAction(actor, defendTarget, logs);
    } else if (action === 'support') {
      if (!targetRef || targetRef.indexOf('ally:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Pick an ally to support.', 'warn');
        return false;
      }
      var supportTarget = findCrucibleUnit(match, 'ally', targetRef.split(':')[1]);
      if (!supportTarget) return false;
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      supportTarget.strikeBonus = Math.max(0, Number(supportTarget.strikeBonus || 0) + applyCrucibleExpeditionFlavorRollBonus(match, actor, 'lead', 'support'));
      executeSupportAction(actor, supportTarget, logs);
    } else if (action === 'personal-flavor') {
      if (!targetRef || targetRef.indexOf('enemy:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Personal Flavor requires a close enemy target.', 'warn');
        return false;
      }
      var flavorTarget = findCrucibleUnit(match, 'enemy', targetRef.split(':')[1]);
      var teamFlavorDist = (flavorTarget && typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, flavorTarget) || 99) : 99;
      var teamFlavorInRange = (typeof canUseCruciblePersonalFlavorRange === 'function')
        ? canUseCruciblePersonalFlavorRange(teamFlavorDist)
        : (teamFlavorDist > 0 && teamFlavorDist <= 2);
      if (!flavorTarget || !teamFlavorInRange) {
        if (typeof showNotif === 'function') showNotif('Personal Flavor only works at Close range or Engaged.', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      if (typeof executePersonalFlavor === 'function') executePersonalFlavor(actor, 'crucible-' + Number(match.round || 1), match.hexMap, logs);
      else logs.push(actor.name + ' used Personal Flavor.');
    }

    match.log = (match.log || []).concat(logs).slice(-120);
    maybeSyncCrucibleSelection(match);
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleExecuteEnemyAction() {
    var match = getHoldingCrucibleMatch();
    if (match && String(match.mode || '') === 'expedition') {
      if (typeof showNotif === 'function') showNotif('Expedition enemies resolve as a response step after the party round.', 'info');
      return false;
    }
    if (!match || String(match.turnSide || 'ally') !== 'enemy') return false;
    if (typeof document === 'undefined') return false;
    var actionEl = document.getElementById('crucibleEnemyActionSelect');
    var targetEl = document.getElementById('crucibleEnemyTargetSelect');
    if (!actionEl || !targetEl) return false;

    var actor = getSelectedCrucibleEnemy(match);
    if (!actor || Number(actor.hp || 0) <= 0) return false;
    if (Number(actor.ap || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif(actor.name + ' has no AP left.', 'warn');
      return false;
    }

    var action = String(actionEl.value || 'attack').toLowerCase();
    var targetRef = String(targetEl.value || '');
    var logs = [];

    if (action === 'attack') {
      if (!targetRef || targetRef.indexOf('ally:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Pick an engaged/close ally target.', 'warn');
        return false;
      }
      var attackTarget = findCrucibleUnit(match, 'ally', targetRef.split(':')[1]);
      if (!attackTarget || !canCrucibleUnitAttack(actor, attackTarget)) {
        if (typeof showNotif === 'function') showNotif('Target out of range for Attack.', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      var dist = (typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, attackTarget) || 0) : 0;
      logs.push(actor.name + ' used ' + (dist <= 1 ? 'Strike' : 'Shoot') + '.');
      runCrucibleAttack(actor, attackTarget, logs, match);
      match.selectedAllyTargetId = String(attackTarget.id || '');
    } else if (action === 'defend') {
      if (!targetRef || targetRef.indexOf('enemy:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Pick an enemy ally to defend.', 'warn');
        return false;
      }
      var defendTarget = findCrucibleUnit(match, 'enemy', targetRef.split(':')[1]);
      if (!defendTarget) return false;
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      executeDefendAction(actor, defendTarget, logs);
    } else if (action === 'support') {
      if (!targetRef || targetRef.indexOf('enemy:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Pick an enemy ally to support.', 'warn');
        return false;
      }
      var supportTarget = findCrucibleUnit(match, 'enemy', targetRef.split(':')[1]);
      if (!supportTarget) return false;
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      executeSupportAction(actor, supportTarget, logs);
    } else if (action === 'personal-flavor') {
      if (!targetRef || targetRef.indexOf('ally:') !== 0) {
        if (typeof showNotif === 'function') showNotif('Personal Flavor requires a close ally target.', 'warn');
        return false;
      }
      var flavorTarget = findCrucibleUnit(match, 'ally', targetRef.split(':')[1]);
      var teamFlavorDist = (flavorTarget && typeof getUnitDistance === 'function') ? Number(getUnitDistance(actor, flavorTarget) || 99) : 99;
      var teamFlavorInRange = (typeof canUseCruciblePersonalFlavorRange === 'function')
        ? canUseCruciblePersonalFlavorRange(teamFlavorDist)
        : (teamFlavorDist > 0 && teamFlavorDist <= 2);
      if (!flavorTarget || !teamFlavorInRange) {
        if (typeof showNotif === 'function') showNotif('Personal Flavor only works at Close range or Engaged.', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      if (typeof executePersonalFlavor === 'function') executePersonalFlavor(actor, 'crucible-' + Number(match.round || 1), match.hexMap, logs);
      else logs.push(actor.name + ' used Personal Flavor.');
      match.selectedAllyTargetId = String(flavorTarget.id || '');
    } else if (action === 'move') {
      var destination = (typeof getCrucibleRandomOpenHex === 'function') ? getCrucibleRandomOpenHex(actor, match, 3) : null;
      if (!destination) {
        if (typeof showNotif === 'function') showNotif('No valid hex to move into.', 'warn');
        return false;
      }
      if (!spendCrucibleUnitAp(actor, 1)) return false;
      actor.position = { q: Number(destination.q), r: Number(destination.r) };
      var raidBossMove = !!(String(match.mode || '') === 'expedition' && actor.isRaidBoss);
      logs.push(actor.name + (raidBossMove ? ' warped through the battlefield' : ' moved') + ' to [' + Number(destination.q) + ',' + Number(destination.r) + '].');
    }

    match.log = (match.log || []).concat(logs).slice(-120);
    maybeSyncCrucibleSelection(match);
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleMoveSelected(nextQ, nextR) {
    var match = getHoldingCrucibleMatch();
    if (!match || !match.hexMap) return false;
    var ally = getSelectedCrucibleActiveUnit(match);
    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || '') === 'explore') {
      ally = getCrucibleExpeditionPlayer(match) || ally;
      if (ally) {
        match.turnSide = 'ally';
        match.selectedAllyId = String(ally.id || '');
      }
    }
    if (!ally || Number(ally.hp || 0) <= 0) return false;
    
    var targetHex = { q: Number(nextQ), r: Number(nextR) };
    if (String(match.mode || '') === 'expedition' && match.expedition && match.expedition.collapsed) {
      var key = String(targetHex.q) + ',' + String(targetHex.r);
      match.hexMap.expeditionCollapsed = match.expedition.collapsed;
      if (match.expedition.collapsed[key]) {
        if (typeof showNotif === 'function') showNotif('That hex is gone. The night already took it.', 'warn');
        return false;
      }
    }
    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || '') === 'explore') {
      if (!ally.position) return false;
      var targetKey = String(Number(nextQ || 0)) + ',' + String(Number(nextR || 0));
      var reachable = (typeof getCrucibleOpenHexes === 'function')
        ? getCrucibleOpenHexes(ally, match, 1).filter(function (hex) {
          return !ally.position || hex.q !== ally.position.q || hex.r !== ally.position.r;
        })
        : [];
      var reachableKeys = reachable.map(function (hex) { return String(Number(hex.q || 0)) + ',' + String(Number(hex.r || 0)); });
      if (match.hexMap && match.hexMap.hexes) {
        Object.keys(match.hexMap.hexes).forEach(function (key) {
          var cell = match.hexMap.hexes[key];
          if (!cell || (cell.terrain !== 'barrier' && !cell.barrier)) return;
          var q = Number(cell.q || 0);
          var r = Number(cell.r || 0);
          var distance = (Math.abs(Number(ally.position.q || 0) - q)
            + Math.abs((Number(ally.position.q || 0) + Number(ally.position.r || 0)) - (q + r))
            + Math.abs(Number(ally.position.r || 0) - r)) / 2;
          if (distance === 1 && reachableKeys.indexOf(key) < 0) reachableKeys.push(key);
        });
      }
      if (reachableKeys.indexOf(targetKey) < 0) return false;
      var targetBarrier = getCrucibleExpeditionBarrierCell(match, targetHex);
      if (!targetBarrier && typeof canMoveToHex === 'function' && !canMoveToHex(ally, targetHex, match.hexMap)) return false;
      var occupied = getUnitsInHex((match.allies || []).concat(match.enemies || []), targetHex, match.hexMap);
      if (occupied && occupied.length) return false;
      if (!resolveCrucibleExpeditionBarrierCrossing(match, ally, ally.position, targetHex)) return false;
      ally.position = { q: Number(nextQ), r: Number(nextR) };
      resolveCrucibleExpeditionPerilHex(match, ally, targetHex);
      match.log = (match.log || []).concat([ally.name + ' moved to [' + nextQ + ',' + nextR + '] (exploration move).']).slice(-120);
      renderHoldingCruciblePopup();
      return true;
    }
    if (Number(ally.ap || 0) <= 0) return false;
    if (typeof moveUnitToHex === 'function') {
      if (moveUnitToHex(ally, targetHex, match.hexMap, match.log)) {
        renderHoldingCruciblePopup();
        return true;
      }
    } else {
      // Fallback: simple 1-hex movement
      if (ally.position) {
        var dx = Math.abs(ally.position.q - nextQ);
        var dr = Math.abs(ally.position.r - nextR);
        if ((dx + dr + Math.abs(ally.position.q + ally.position.r - nextQ - nextR)) / 2 === 1) {
          if (getUnitsInHex(match.allies.concat(match.enemies), targetHex).length === 0) {
            ally.ap = Math.max(0, Number(ally.ap) - 1);
            ally.position = { q: Number(nextQ), r: Number(nextR) };
            match.log = (match.log || []).concat([ally.name + ' moved to [' + nextQ + ',' + nextR + '].']).slice(-120);
            renderHoldingCruciblePopup();
            return true;
          }
        }
      }
    }
    return false;
  }

  function holdingCrucibleTeleportSelected() {
    var match = getHoldingCrucibleMatch();
    if (!match || !match.hexMap) return false;
    var ally = getSelectedCrucibleActiveUnit(match);
    if (!ally || Number(ally.hp || 0) <= 0 || Number(ally.ap || 0) <= 0) return false;
    var target = null;
    if (typeof getCrucibleRandomOpenHex === 'function') {
      target = getCrucibleRandomOpenHex(ally, match, 999);
    }
    if (!target) {
      if (typeof showNotif === 'function') showNotif('No open hexes are available to teleport to.', 'warn');
      return false;
    }
    ally.ap = Math.max(0, Number(ally.ap || 0) - 1);
    ally.position = { q: Number(target.q), r: Number(target.r) };
    if (typeof triggerHexTerrainEffects === 'function') {
      triggerHexTerrainEffects(ally, target, match.hexMap, match.log || []);
    }
    match.log = (match.log || []).concat([ally.name + ' teleported to [' + target.q + ',' + target.r + '].']).slice(-120);
    maybeSyncCrucibleSelection(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    if (typeof showNotif === 'function') showNotif(ally.name + ' teleported to [' + target.q + ',' + target.r + '].', 'good');
    return true;
  }

  function holdingCrucibleUseExpeditionFlask() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player) return false;
    if (Number(match.expedition.flasks || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif('No flasks left. Find a temple.', 'warn');
      return false;
    }
    if (Number(player.hp || 0) >= Number(player.maxHp || 0)) {
      if (typeof showNotif === 'function') showNotif('Health already full.', 'info');
      return false;
    }
    match.expedition.flasks = Math.max(0, Number(match.expedition.flasks || 0) - 1);
    player.hp = Number(player.maxHp || player.hp || 0);
    if (S) S.health = Number(player.hp || 0);
    match.log = (match.log || []).concat(['Wayfarer drank a flask and restored all HP.']).slice(-120);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCruciblePrayAtTemple() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.mode || '') !== 'expedition' || !match.expedition) return false;
    var player = getCrucibleExpeditionPlayer(match);
    if (!player || !player.position || !match.hexMap || !match.hexMap.hexes) return false;
    var key = String(player.position.q) + ',' + String(player.position.r);
    var cell = match.hexMap.hexes[key];
    if (!cell || cell.terrain !== 'temple' || !cell.temple) {
      if (typeof showNotif === 'function') showNotif('Stand on a temple hex to refill flasks.', 'warn');
      return false;
    }
    if (cell.temple.used) {
      if (typeof showNotif === 'function') showNotif('This temple has gone silent.', 'warn');
      return false;
    }
    if (Number(match.expedition.flasks || 0) >= Number(match.expedition.maxFlasks || 7)) {
      if (typeof showNotif === 'function') showNotif('Flasks already at maximum.', 'info');
      return false;
    }
    cell.temple.used = true;
    match.expedition.flasks = Math.min(Number(match.expedition.maxFlasks || 7), Number(match.expedition.flasks || 0) + 1);
    match.log = (match.log || []).concat(['Temple blessing: +1 flask.']).slice(-120);
    if (typeof showNotif === 'function') showNotif('Temple restored one flask.', 'good');
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleAttackSelected() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.turnSide || 'ally') !== 'ally') return false;
    var ally = getSelectedCrucibleAlly(match);
    var target = getSelectedCrucibleTarget(match);
    if (!ally || !target || Number(ally.hp || 0) <= 0 || Number(target.hp || 0) <= 0) return false;
    if (Number(ally.ap || 0) <= 0) {
      if (typeof showNotif === 'function') showNotif(ally.name + ' has no AP left.', 'warn');
      return false;
    }
    if (!canCrucibleUnitAttack(ally, target)) {
      if (typeof showNotif === 'function') showNotif('Target out of range. Reposition first.', 'warn');
      return false;
    }
    spendCrucibleUnitAp(ally, 1);
    var logs = [];
    runCrucibleAttack(ally, target, logs, match);
    match.log = (match.log || []).concat(logs).slice(-120);
    maybeSyncCrucibleSelection(match);
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleGuardSelected() {
    var match = getHoldingCrucibleMatch();
    if (!match || String(match.turnSide || 'ally') !== 'ally') return false;
    var ally = getSelectedCrucibleAlly(match);
    if (!ally || Number(ally.hp || 0) <= 0 || Number(ally.ap || 0) <= 0) return false;
    spendCrucibleUnitAp(ally, 1);
    ally.defendBuff = Math.max(0, Number(ally.defendBuff || 0) + 2);
    match.log = (match.log || []).concat([ally.name + ' took a guarded stance (+2 defend).']).slice(-120);
    renderHoldingCruciblePopup();
    return true;
  }

  function holdingCrucibleEndSelectedUnit() {
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    var ally = getSelectedCrucibleActiveUnit(match);
    if (!ally) return false;
    ally.ap = 0;
    match.log = (match.log || []).concat([ally.name + ' ended their turn.']).slice(-120);
    renderHoldingCruciblePopup();
    return true;
  }

  function holdingCrucibleAdvanceRound() {
    ensureNewFeatureState();
    var match = getHoldingCrucibleMatch();
    if (!match) return false;
    if (String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || '') === 'combat') {
      if (isCrucibleExpeditionCampaignPartyMode()) {
        resolveCrucibleExpeditionCombatRound(match);
        finalizeHoldingCrucibleMatch(match);
        renderHoldingCruciblePopup();
        renderHoldingUI();
        return true;
      }
    }
    if (String(match.turnSide || 'ally') === 'ally') {
      beginCrucibleEnemyTurn(match);
    } else {
      finishCrucibleEnemyTurn(match, [], 'Enemy phase ended under manual control.');
    }
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleRunEnemyAI() {
    var match = getHoldingCrucibleMatch();
    if (match && String(match.mode || '') === 'expedition' && isCrucibleExpeditionCampaignPartyMode()) {
      if (typeof showNotif === 'function') showNotif('Expedition enemy AI runs inside Resolve Party Round.', 'info');
      return false;
    }
    if (!match || String(match.turnSide || 'ally') !== 'enemy') return false;
    runCrucibleEnemyTurn(match);
    finalizeHoldingCrucibleMatch(match);
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleAutoResolve() {
    var current = getHoldingCrucibleMatch();
    if (current && String(current.mode || '') === 'expedition' && current.expedition && String(current.expedition.phase || '') === 'combat' && isCrucibleExpeditionCampaignPartyMode()) {
      var expeditionSafety = 0;
      while (getHoldingCrucibleMatch() && expeditionSafety < 24) {
        var expeditionMatch = getHoldingCrucibleMatch();
        if (!expeditionMatch || !expeditionMatch.active || !expeditionMatch.expedition || String(expeditionMatch.expedition.phase || '') !== 'combat') break;
        autoQueueCrucibleExpeditionRound(expeditionMatch);
        resolveCrucibleExpeditionCombatRound(expeditionMatch);
        finalizeHoldingCrucibleMatch(expeditionMatch);
        expeditionSafety += 1;
      }
      renderHoldingCruciblePopup();
      renderHoldingUI();
      return true;
    }
    var safety = 0;
    while (getHoldingCrucibleMatch() && safety < 24) {
      var match = getHoldingCrucibleMatch();
      if (!match || !match.active) break;
      if (String(match.turnSide || 'ally') === 'ally') {
        autoPlayCrucibleAllyTurn(match);
        beginCrucibleEnemyTurn(match);
      }
      if (String(match.turnSide || 'ally') === 'enemy') runCrucibleEnemyTurn(match);
      safety += 1;
      match = getHoldingCrucibleMatch();
      if (!match || !match.active) break;
    }
    renderHoldingCruciblePopup();
    renderHoldingUI();
    return true;
  }

  function holdingCrucibleResetMatch() {
    ensureNewFeatureState();
    var match = getHoldingCrucibleMatch();
    if (match && String(match.mode || '') === 'expedition' && match.expedition && String(match.expedition.phase || '') === 'combat') {
      var combatType = String(match.expedition.currentCombatType || '');
      if (combatType === 'fieldEnemy' || combatType === 'fieldBoss') {
        if (typeof applyCrucibleExpeditionFleePenalty === 'function') {
          applyCrucibleExpeditionFleePenalty(match);
        }
      }
    }
    S.holding.crucible.match = null;
    createHoldingCrucibleMatch();
    renderHoldingCruciblePopup();
    renderHoldingUI();
    if (typeof showNotif === 'function') {
      var mode = getCrucibleModeSpec(S.holding.crucible.preferredMode || 'control');
      showNotif('Crucible match reset. New 3v3 Control scenario generated.', 'info');
    }
    return true;
  }

  function buildHoldingCruciblePanelHtml() {
    ensureNewFeatureState();
    var c = S.holding.crucible || {};
    var mode = getCrucibleModeSpec(c.preferredMode || 'control');
    var match = getHoldingCrucibleMatch();
    var total = Math.max(1, Number(c.wins || 0) + Number(c.losses || 0));
    var winRate = Math.round((Math.max(0, Number(c.wins || 0)) / total) * 100);
    var status = match
      ? ('Active match · Round ' + Number(match.round || 1) + ' · ' + (String(match.turnSide || 'ally') === 'ally' ? 'Your Turn' : 'Enemy Turn'))
      : (c.lastResult ? ('Last: ' + String(c.lastResult)) : 'No simulation run yet.');
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.35rem;margin-bottom:.4rem;">'
      + '<div style="border:1px solid var(--border2);padding:.3rem .38rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">Wins</div><div style="font-size:.92rem;color:var(--green2);">' + Number(c.wins || 0) + '</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .38rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">Losses</div><div style="font-size:.92rem;color:var(--red2);">' + Number(c.losses || 0) + '</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .38rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">Win Rate</div><div style="font-size:.92rem;color:var(--gold2);">' + winRate + '%</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .38rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">Best Streak</div><div style="font-size:.92rem;color:var(--teal);">' + Number(c.bestWinStreak || 0) + '</div></div>'
      + '</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.35rem;">' + status + '</div>'
      + '<div style="font-size:.7rem;color:var(--teal);margin-bottom:.3rem;">Preferred Mode: ' + mode.label + ' · ' + mode.objective + '</div>'
      + '<div style="display:flex;gap:.28rem;flex-wrap:wrap;">'
      + (match ? '<button class="btn btn-sm btn-teal" onclick="holdingCrucibleAttackSelected();">Attack (Selected)</button>' : '')
        + (match ? '<button class="btn btn-sm" onclick="holdingCrucibleAdvanceRound();">End Team Turn</button>' : '')
      + (match ? '<button class="btn btn-sm" onclick="holdingCrucibleAutoResolve();">Auto Resolve</button>' : '')
      + '</div>';
  }

  function startHoldingMiniGamesExpedition(sourceKey) {
    ensureNewFeatureState();
    S.holding.crucible.preferredMode = 'expedition';
    S.holding.crucible.match = null;
    if (typeof showNotif === 'function') showNotif('Expedition launched from Mini Games.', 'good');
    return openHoldingCrucibleMatch('expedition');
  }

  function openMiniGamesMode(modeId) {
    ensureNewFeatureState();
    var normalizedMode = String(modeId || '').toLowerCase();
    var wantsExpedition = normalizedMode.indexOf('expedition') >= 0;
    S.holding.crucible.preferredMode = wantsExpedition ? 'expedition' : 'control';
    S.holding.crucible.match = null;
    if (typeof showNotif === 'function') {
      showNotif(wantsExpedition ? 'Opening Expedition.' : 'Opening Crucible Control.', 'info');
    }
    return openHoldingCrucibleMatch(wantsExpedition ? 'expedition' : 'control');
  }

  function buildMiniGamesPageHtml() {
    return ''
      + '<div style="padding:.95rem;display:grid;gap:.7rem;">'
      + '<div class="card">'
      + '<div class="section-title">Mini Games</div>'
      + '<div style="font-size:.78rem;color:var(--muted2);line-height:1.55;">Choose a training format: tactical Control or province-crawl Expedition.</div>'
      + '<div style="display:flex;gap:.28rem;flex-wrap:wrap;margin-top:.45rem;">'
      + '<button class="btn btn-sm btn-primary" onclick="openHoldingCrucibleMatch(\'control\');">Open Crucible Control</button>'
      + '<button class="btn btn-sm btn-teal" onclick="startHoldingMiniGamesExpedition(\'minigames-panel\');">Start Expedition</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderMiniGamesPage() {
    var panel = document.getElementById('tab-minigames');
    if (!panel) return false;
    panel.innerHTML = buildMiniGamesPageHtml();
    return true;
  }

  function buyWayfarerHomeUpgrade(key) {
    ensureNewFeatureState();
    var home = S.holding.wayfarerHome || {};
    var lvl = Number(home[key] || 0);
    if (lvl >= 3) {
      showNotif('This home upgrade is already maxed.', 'warn');
      return;
    }
    var cost = getWayfarerHomeUpgradeCost(key, lvl);
    if ((S.credits || 0) < cost) {
      showNotif('Not enough Credits for this home upgrade.', 'warn');
      return;
    }
    S.credits = Math.max(0, (S.credits || 0) - cost);
    updateCreditsUI();
    home[key] = lvl + 1;
    home.log.unshift(capFirst(key.replace('Level', '')) + ' upgraded to Lv.' + home[key] + ' (-' + cost + '₵)');
    home.log = home.log.slice(0, 10);
    S.holding.wayfarerHome = home;
    renderHoldingUI();
    showNotif('Wayfarer Home upgraded: ' + key.replace('Level', '') + ' Lv.' + home[key], 'good');
  }

  function setWayfarerHomeDecorTheme(theme) {
    ensureNewFeatureState();
    S.holding.wayfarerHome.decorTheme = String(theme || 'Frontier');
    renderHoldingUI();
    showNotif('Wayfarer Home theme set: ' + S.holding.wayfarerHome.decorTheme, 'good');
  }

  function getWayfarerHomeBonuses() {
    ensureNewFeatureState();
    var home = S.holding.wayfarerHome || {};
    return {
      decor: Number(home.decorLevel || 0),
      security: Number(home.securityLevel || 0),
      workshop: Number(home.workshopLevel || 0),
      market: Number(home.marketLevel || 0)
    };
  }

  function renderHoldingCrises() {
    var el = document.getElementById("holdingActiveCrises");
    if (!el) { return; }
    if (!S.holding.crises.length) {
      el.innerHTML = '<div style="font-size:.8rem;color:var(--green2);padding:.3rem 0;">No active crises — the Realm is stable.</div>';
      return;
    }
    el.innerHTML = S.holding.crises.map(function(crisis, i) {
      return '<div style="background:rgba(201,64,64,.06);border:1px solid rgba(201,64,64,.25);padding:.4rem .55rem;margin-bottom:.28rem;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.12rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.1em;color:var(--red2);text-transform:uppercase;">' + crisis.name + '</div>'
        + '<button class="btn btn-xs" onclick="resolveCrisis(' + i + ')">✓ Resolved</button>'
        + '</div>'
        + '<div style="font-size:.78rem;color:var(--text2);">' + crisis.desc + '</div>'
        + '<div style="font-size:.72rem;color:var(--gold2);margin-top:.12rem;">Resolution: ' + crisis.resolution + '</div>'
        + '</div>';
    }).join("");
    var cc = document.getElementById("holdingCrisisCount");
    if (cc) { cc.textContent = S.holding.crises.length; }
  }

  function holdingDowntimeEvents() {
    return [
      { name: 'Wayfarer Rumor Circle', dd: 6, success: 'You secure a fresh rumor marker. +1 Teamwork.', failure: 'Rumors conflict and morale dips. Mental Stress equals failed difference.', successEffect: { tmw: 1 }, failEffect: { mentalStress: 1 } },
      { name: 'Hex Festival Games', dd: 8, success: 'You win local games. +40 credits.', failure: 'You are outmatched in the pits. Health damage equals failed difference.', successEffect: { credits: 40 }, failEffect: { health: 1 } },
      { name: 'Lorehall Research Night', dd: 6, success: 'Research succeeds. Gain Focused.', failure: 'Records are incoherent. Mental Stress equals failed difference.', successEffect: { focused: 1 }, failEffect: { mentalStress: 1 } },
      { name: 'Masked Court Joust', dd: 10, success: 'The court applauds your prowess. +1 Renown.', failure: 'A heavy fall leaves bruises. Health damage equals failed difference.', successEffect: { renown: 1 }, failEffect: { health: 1 } }
    ];
  }

  function holdingDowntimeActivityPool(activity) {
    var pools = {
      talk: [
        { name: 'Village Listening Walk', dd: 6, success: 'You resolve three disputes before sunset. +1 Teamwork.', failure: 'Conflicting accounts wear you down. Mental Stress equals failed difference.', successEffect: { tmw: 1 }, failEffect: { mentalStress: 1 } },
        { name: 'Guildhall Negotiation', dd: 8, success: 'You broker a fair charter. +1 Renown.', failure: 'Talks stall into accusations. Mental Stress equals failed difference.', successEffect: { renown: 1 }, failEffect: { mentalStress: 1 } }
      ],
      task: [
        { name: 'Supply Caravan Oversight', dd: 8, success: 'The route clears and taxes flow. +60 credits.', failure: 'Bandits cut into deliveries. Health damage equals failed difference.', successEffect: { credits: 60 }, failEffect: { health: 1 } },
        { name: 'Militia Drill Cycle', dd: 6, success: 'Defenses tighten around the holding. +1 Renown.', failure: 'Training accidents spread tension. Mental Stress equals failed difference.', successEffect: { renown: 1 }, failEffect: { mentalStress: 1 } }
      ],
      explore: [
        { name: 'Border Survey Expedition', dd: 8, success: 'You map hidden paths and caches. +40 credits.', failure: 'Hostile terrain takes its toll. Health damage equals failed difference.', successEffect: { credits: 40 }, failEffect: { health: 1 } },
        { name: 'Ancient Waystone Recon', dd: 6, success: 'You recover useful wayfinding lore. Gain Focused.', failure: 'The site is disorienting. Mental Stress equals failed difference.', successEffect: { focused: 1 }, failEffect: { mentalStress: 1 } }
      ]
    };
    return pools[String(activity || 'talk').toLowerCase()] || pools.talk;
  }

  function ensureHoldingSettlementHexcrawl() {
    ensureNewFeatureState();
    if (!S.holding || typeof S.holding !== 'object') { S.holding = {}; }
    var archetypes = {
      Fortress: {
        vibe: 'Militarized quarry-fort under constant watch rotations.',
        districts: ['Gate Ward', 'Market Square', 'Quarry Row', 'Old Shrine', 'Barracks', 'Lord\'s Hall', 'River Docks', 'Lower Tunnels'],
        moods: ['Wary', 'Defiant', 'Exhausted', 'Proud'],
        crowds: ['Guards', 'Laborers', 'Masons', 'Militia'],
        activities: ['Stone hauling', 'Militia drills', 'Watch rotations', 'Armor repairs'],
        rumors: ['Tunnel wall was breached then sealed overnight.', 'A watch captain is selling patrol routes.', 'A missing caravan sent no distress flare.'],
        interactables: ['Aid defenders', 'Hire laborers', 'Inspect gate watch', 'Buy ironworks'],
        hiddenThings: ['Bribed watch post', 'Smuggled relic shards', 'Unauthorized tunnel breach map'],
        microPool: ['Barracks Mess', 'Armory', 'Guard Chapel', 'Siege Shed', 'Tunnel Hatch', 'Lift Yard'],
        scenes: ['Militia formations block a full lane.', 'A funeral march for tunnel casualties passes.', 'A gate alarm rings and then abruptly stops.'],
        opportunities: ['Join a paid patrol sweep.', 'Win ration vouchers in a lifting contest.', 'Secure discount armor plates.'],
        mysteries: ['Helmet visors are found lined in chalk symbols.', 'No one speaks about the sealed third tunnel.', 'A bell rings from stone with no clapper.'],
        statsBase: { security: 8, food: 5, wealth: 5, faith: 4, fear: 4, mystery: 4, health: 6 },
        npcPool: [
          { name: 'Captain Helvek', role: 'Gate Watch Commander', need: 'More defenders', secret: 'Taking bribes', faction: 'Wardens' },
          { name: 'Foreman Tarek', role: 'Quarry Foreman', need: 'Safe blasting crews', secret: 'Hides relic fragments', faction: 'Labor Guild' },
          { name: 'Sister Vael', role: 'Shrine Keeper', need: 'Night escorts', secret: 'Tracks tunnel omens', faction: 'Temple' }
        ]
      },
      Citadel: {
        vibe: 'Bureaucratic power-core of scribes, tribunals, and command halls.',
        districts: ['High Gate', 'Scholars Court', 'Outer Market', 'Stone Ward', 'Temple Steps', 'Foundry Yard', 'Steward Hall'],
        moods: ['Disciplined', 'Suspicious', 'Measured', 'Ambitious'],
        crowds: ['Clerks', 'Magistrates', 'Merchants', 'Honor Guard'],
        activities: ['Ledger audits', 'Court hearings', 'Policy decrees', 'Artifact cataloging'],
        rumors: ['A decree was issued under a forged seal.', 'Steward Hall erased three names from records.', 'The northern archive moved cursed texts at dusk.'],
        interactables: ['Review records', 'Petition magistrate', 'Hire a legal fixer', 'Purchase rare maps'],
        hiddenThings: ['Altered tax ledger', 'Hidden tribunal chamber', 'Encrypted courier route'],
        microPool: ['Archive Annex', 'Tribunal Hall', 'Record Vault', 'Codex Shop', 'Scribe Bath', 'Magistrate Office'],
        scenes: ['A public sentencing halts all market noise.', 'Scribes race sealed tubes between towers.', 'A decree board is stripped clean at noon.'],
        opportunities: ['Purchase privileged route permits.', 'Bribe for fast-tracked cargo papers.', 'Acquire archived star-survey copies.'],
        mysteries: ['A courtroom door opens to different rooms nightly.', 'Every fourth decree vanishes by dawn.', 'A witness appears in records but never in person.'],
        statsBase: { security: 7, food: 5, wealth: 7, faith: 5, fear: 4, mystery: 5, health: 6 },
        npcPool: [
          { name: 'Archivist Noll', role: 'Senior Archivist', need: 'Recovered codices', secret: 'Hides redacted pages', faction: 'Scholars' },
          { name: 'Magistrate Ruen', role: 'Tribunal Judge', need: 'Reliable testimony', secret: 'Blackmails officials', faction: 'Steward Office' },
          { name: 'Broker Ines', role: 'Permit Broker', need: 'Stable trade flow', secret: 'Sells forged seals', faction: 'Merchants' }
        ]
      },
      Haven: {
        vibe: 'Trade-port shelter driven by tides, cargo, and transient strangers.',
        districts: ['Harbor Front', 'Salt Market', 'Pilgrim Row', 'Lantern Docks', 'Old Chapel', 'Warehouse Ring'],
        moods: ['Restless', 'Hopeful', 'Greedy', 'Tired'],
        crowds: ['Dockers', 'Pilgrims', 'Sailors', 'Porters'],
        activities: ['Cargo loading', 'Boat repair', 'Open-air barter', 'Pilgrim processions'],
        rumors: ['A silent ship arrived with no crew.', 'Warehouse Nine floods only at moonrise.', 'Dock fees doubled after an unmarked convoy.'],
        interactables: ['Book passage', 'Hire dock hands', 'Buy salvaged gear', 'Track cargo manifests'],
        hiddenThings: ['Smuggler tide code', 'Counterfeit cargo stamps', 'Sealed chapel crypt hatch'],
        microPool: ['Dock Tavern', 'Net Menders', 'Harbor Shrine', 'Whale-oil Bath', 'Manifest Office', 'Flood Cellar'],
        scenes: ['A dock crane snaps and spills crates.', 'A preacher denounces an incoming vessel.', 'Fog swallows the entire outer pier.'],
        opportunities: ['Win contraband maps in dockside dice.', 'Buy spoiled cargo cheap for salvage.', 'Secure fast transport through reef channels.'],
        mysteries: ['Lanterns relight themselves after midnight.', 'No footprints remain on one pier lane.', 'Harbor dogs refuse the chapel stairs.'],
        statsBase: { security: 5, food: 7, wealth: 8, faith: 4, fear: 5, mystery: 5, health: 5 },
        npcPool: [
          { name: 'Dockmaster Breth', role: 'Dock Overseer', need: 'Reliable crews', secret: 'Skims cargo fees', faction: 'Harbor Guild' },
          { name: 'Pilgrim-Marshal Oth', role: 'Pilgrim Escort Lead', need: 'Safe route markers', secret: 'Protects a fugitive', faction: 'Pilgrim Ward' },
          { name: 'Quartermistress Venn', role: 'Warehouse Clerk', need: 'Dry storage', secret: 'Keeps ghost manifests', faction: 'Merchants' }
        ]
      },
      Keep: {
        vibe: 'Compact frontier redoubt where every hand is overworked.',
        districts: ['South Gate', 'Craft Lane', 'Well Square', 'Watch Barracks', 'Hall Quarter'],
        moods: ['Strained', 'Stubborn', 'Protective', 'Tense'],
        crowds: ['Farmhands', 'Guards', 'Crafters', 'Messengers'],
        activities: ['Well maintenance', 'Fence repairs', 'Watch drills', 'Ration sorting'],
        rumors: ['The outer farm burned with no ash trail.', 'Night patrol hears knocking beneath the well.', 'A courier route now skips three hamlets.'],
        interactables: ['Repair barricades', 'Train watch', 'Gather locals', 'Buy basic tools'],
        hiddenThings: ['Hidden ration cache', 'Buried signal post', 'Unmarked grave ledger'],
        microPool: ['Ration Hall', 'Well House', 'Fence Workshop', 'Scout Loft', 'Field Shrine', 'Watch Cupboard'],
        scenes: ['A ration dispute erupts in Well Square.', 'A field alarm sends everyone to the gate.', 'Children repaint warning signs at dusk.'],
        opportunities: ['Earn credits fixing defenses.', 'Recruit local scouts.', 'Trade spare tools for grain vouchers.'],
        mysteries: ['A well bucket returns with black water only at noon.', 'The gate shadow points wrong at sunset.', 'A horn sounds from an abandoned tower.'],
        statsBase: { security: 6, food: 6, wealth: 4, faith: 4, fear: 5, mystery: 4, health: 6 },
        npcPool: [
          { name: 'Warden Sera', role: 'Watch Captain', need: 'Fresh patrols', secret: 'Fakes casualty numbers', faction: 'Wardens' },
          { name: 'Reeve Maln', role: 'Quartermaster', need: 'Stable stores', secret: 'Hides missing grain', faction: 'Provisioners' },
          { name: 'Scout Eris', role: 'Pathfinder', need: 'Road support', secret: 'Guides smugglers by night', faction: 'Free Scouts' }
        ]
      },
      Spire: {
        vibe: 'Vertical mystic-city where research and omen cults overlap.',
        districts: ['Spire Base', 'Archive Ring', 'Skybridge Market', 'Watcher Terrace', 'Bell District'],
        moods: ['Obsessive', 'Detached', 'Inspired', 'Uneasy'],
        crowds: ['Acolytes', 'Researchers', 'Sky traders', 'Bell wardens'],
        activities: ['Astral readings', 'Archive indexing', 'Bridge tolling', 'Bell calibration'],
        rumors: ['Watcher Terrace predicts storms before cloud rise.', 'A sealed codex writes in new ink at night.', 'Bell District counts an extra chime.'],
        interactables: ['Read omen charts', 'Purchase relic diagrams', 'Hire ascenders', 'Decode inscriptions'],
        hiddenThings: ['Forbidden codex leaf', 'Mirror chamber key', 'Cult route cipher'],
        microPool: ['Observatory Cell', 'Bell Loft', 'Codex Vault', 'Skybridge Tea Hall', 'Rune Bath', 'Hidden Reliquary'],
        scenes: ['A crowd pauses as all bells ring at once.', 'An acolyte collapses after a vision.', 'Skybridge traffic halts for an omen reading.'],
        opportunities: ['Buy predictive route charts.', 'Win relic fragments in logic games.', 'Sell survey data to archivists.'],
        mysteries: ['No shadows are cast in one archive aisle.', 'A bell toll is heard with no vibration.', 'Names spoken in the reliquary vanish from memory.'],
        statsBase: { security: 5, food: 4, wealth: 6, faith: 7, fear: 5, mystery: 8, health: 5 },
        npcPool: [
          { name: 'Acolyte Maer', role: 'Omen Reader', need: 'Quiet observatory hours', secret: 'Edits prophecies', faction: 'Temple' },
          { name: 'Curator Seln', role: 'Codex Curator', need: 'Recovered tablets', secret: 'Smuggles forbidden pages', faction: 'Archivists' },
          { name: 'Bellwarden Korr', role: 'Bell District Keeper', need: 'Stable ring schedule', secret: 'Signals a hidden cell', faction: 'Bell Ward' }
        ]
      }
    };

    function pickLocal(list) {
      if (!Array.isArray(list) || !list.length) return '';
      return list[Math.floor(Math.random() * list.length)] || list[0];
    }

    function shuffleLocal(list) {
      var out = Array.isArray(list) ? list.slice() : [];
      for (var i = out.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    }

    function buildDistrict(archetype, id, label, idx) {
      function inferKind(text) {
        var t = String(text || '').toLowerCase();
        if (t.indexOf('inn') >= 0 || t.indexOf('tavern') >= 0 || t.indexOf('pilgrim') >= 0) return 'inn';
        if (t.indexOf('hall') >= 0 || t.indexOf('steward') >= 0 || t.indexOf('lord') >= 0) return 'lord';
        if (t.indexOf('market') >= 0 || t.indexOf('harbor') >= 0 || t.indexOf('dock') >= 0) return 'merchant_items';
        if (t.indexOf('foundry') >= 0 || t.indexOf('barracks') >= 0 || t.indexOf('watch') >= 0 || t.indexOf('armory') >= 0) return 'merchant_weapons';
        if (t.indexOf('archive') >= 0 || t.indexOf('court') >= 0 || t.indexOf('shrine') >= 0 || t.indexOf('bell') >= 0) return 'mission';
        if (t.indexOf('gate') >= 0 || t.indexOf('ward') >= 0 || t.indexOf('square') >= 0 || t.indexOf('lane') >= 0) return 'downtime';
        return 'district';
      }
      var labelText = String(label || '').toLowerCase();
      var kind = inferKind(label);
      var services = {
        merchant: kind === 'merchant_items' || kind === 'merchant_weapons' || /market|harbor|dock|ring|trade|bazaar/.test(labelText),
        merchantCategory: kind === 'merchant_weapons' ? 'weapons' : 'items',
        missionBoard: kind === 'mission' || /archive|court|hall|chapel|shrine|watch|gate|ward/.test(labelText) || (idx % 3 === 1),
        gamblingDen: /market|harbor|dock|square|lane|ring|front|yard/.test(labelText) || (idx % 4 === 0),
        inn: /inn|tavern|pilgrim|hostel|chapel/.test(labelText) || (idx % 5 === 0),
        bar: /dock|market|square|lane|yard|front/.test(labelText) || (idx % 4 === 1),
        banking: /market|court|hall|steward|ledger|custom/.test(labelText) || (idx % 4 === 2),
        legal: /court|hall|steward|gate|ward|tribunal/.test(labelText) || (idx % 4 === 3),
        hospital: /shrine|chapel|barracks|ward|archive|well/.test(labelText) || (idx % 3 === 0),
        localWork: true
      };
      var microCount = 2 + Math.floor(Math.random() * 4);
      var micro = [];
      for (var mi = 0; mi < microCount; mi++) micro.push(pickLocal(archetype.microPool));
      var economicProfiles = ['salvage-heavy', 'agrarian', 'artisan', 'black-market', 'ritual', 'industrial'];
      var scarcityTiers = ['surplus', 'balanced', 'strained', 'scarce'];
      var districtEconomy = economicProfiles[(idx + Math.floor(Math.random() * economicProfiles.length)) % economicProfiles.length];
      var scarcity = scarcityTiers[Math.floor(Math.random() * scarcityTiers.length)] || 'balanced';
      return {
        id: id,
        label: label,
        kind: kind,
        services: services,
        dd: 6 + (idx % 3 === 0 ? 2 : 0) + (String(archetype.key || '') === 'Spire' ? 1 : 0),
        explored: false,
        revealed: idx === 0,
        result: '',
        atmosphere: pickLocal([
          'Dust hangs in the air like incense.',
          'Lantern light catches damp stone and iron rivets.',
          'Voices echo between narrow walls and shuttered stalls.',
          'The district hums with tired but stubborn life.'
        ]),
        npcDensity: pickLocal(archetype.crowds),
        dangerLevel: pickLocal(['Low', 'Moderate', 'High']),
        districtLandmark: pickLocal(archetype.scenes),
        factionHeadline: pickLocal(archetype.rumors),
        interactable: pickLocal(archetype.interactables),
        hiddenThing: pickLocal(archetype.hiddenThings),
        microLocations: micro,
        npcRoster: []
      };
    }

    function buildDistrictNpcRoster(archetype, label, idx) {
      var base = shuffleLocal(archetype.npcPool || []).slice(0, 2 + (idx % 2));
      return base.map(function (npc, ii) {
        return {
          id: 'npc-' + String(idx) + '-' + String(ii),
          name: String(npc.name || ('District Figure ' + (ii + 1))),
          role: String(npc.role || 'Local Notable'),
          faction: String(npc.faction || 'Locals'),
          relation: 0,
          memory: 'First impression pending in ' + String(label || 'district') + '.'
        };
      });
    }

    function buildNpcWeb(archetype) {
      var schedule = ['Morning: walls', 'Midday: market', 'Dusk: council lane', 'Night: tavern cellar'];
      var seed = shuffleLocal(archetype.npcPool || []);
      return seed.map(function (npc, idx) {
        return {
          name: String(npc.name || ('District Figure ' + (idx + 1))),
          role: String(npc.role || 'Local Notable'),
          need: String(npc.need || 'Stability'),
          secret: String(npc.secret || 'Keeps personal leverage'),
          faction: String(npc.faction || 'Locals'),
          schedule: [schedule[idx % schedule.length], schedule[(idx + 1) % schedule.length]],
          relationship: 'Knows: missing caravan, silent stranger'
        };
      });
    }

    function buildStats(archetype) {
      var base = archetype.statsBase || { security: 5, food: 5, wealth: 5, faith: 5, fear: 5, mystery: 5, health: 5 };
      var jitter = function (v) { return Math.max(0, Math.min(10, Number(v || 0) + Math.floor(Math.random() * 3) - 1)); };
      return {
        security: jitter(base.security),
        food: jitter(base.food),
        wealth: jitter(base.wealth),
        faith: jitter(base.faith),
        fear: jitter(base.fear),
        mystery: jitter(base.mystery),
        health: jitter(base.health)
      };
    }

    if (!S.holding.settlementHexcrawl || !Array.isArray(S.holding.settlementHexcrawl.nodes) || !S.holding.settlementHexcrawl.nodes.length || Number(S.holding.settlementHexcrawl.version || 0) < 2) {
      var type = String(S.holding.type || 'Fortress');
      var archetype = archetypes[type] || archetypes.Fortress;
      archetype.key = type;
      var districts = (archetype.districts || archetypes.Fortress.districts).slice();
      var count = Math.max(3, Math.min(8, districts.length - Math.floor(Math.random() * 2)));
      districts = districts.slice(0, count);
      var topoByType = {
        Fortress: {
          coords: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: 0 }],
          edges: [['d0', 'd1'], ['d0', 'd2'], ['d0', 'd3'], ['d0', 'd4'], ['d0', 'd5'], ['d0', 'd6'], ['d1', 'd7']]
        },
        Haven: {
          coords: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 1, r: 1 }],
          edges: [['d0', 'd1'], ['d1', 'd2'], ['d0', 'd3'], ['d0', 'd4'], ['d0', 'd5'], ['d0', 'd6'], ['d3', 'd7']]
        },
        Spire: {
          coords: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }, { q: 0, r: 3 }, { q: 0, r: 4 }, { q: 1, r: 1 }, { q: 1, r: 2 }, { q: -1, r: 2 }],
          edges: [['d0', 'd1'], ['d1', 'd2'], ['d2', 'd3'], ['d3', 'd4'], ['d1', 'd5'], ['d2', 'd6'], ['d2', 'd7']]
        },
        Citadel: {
          coords: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: 0 }],
          edges: [['d0', 'd1'], ['d0', 'd2'], ['d0', 'd3'], ['d0', 'd4'], ['d0', 'd5'], ['d0', 'd6'], ['d1', 'd7']]
        },
        Keep: {
          coords: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }, { q: 4, r: 0 }, { q: 1, r: 1 }, { q: 3, r: -1 }, { q: 2, r: 1 }],
          edges: [['d0', 'd1'], ['d1', 'd2'], ['d2', 'd3'], ['d3', 'd4'], ['d1', 'd5'], ['d3', 'd6'], ['d2', 'd7']]
        }
      };
      var topo = topoByType[type] || topoByType.Fortress;
      var coords = topo.coords;
      var nodes = districts.map(function (label, idx) {
        var node = buildDistrict(archetype, 'd' + String(idx), label, idx);
        node.q = (coords[idx] || { q: idx, r: 0 }).q;
        node.r = (coords[idx] || { q: idx, r: 0 }).r;
        node.revealed = true;
        node.npcRoster = buildDistrictNpcRoster(archetype, label, idx);
        return node;
      });
      var edges = (topo.edges || []).filter(function (e) {
        var a = Number(String(e[0] || '').replace('d', ''));
        var b = Number(String(e[1] || '').replace('d', ''));
        return a < nodes.length && b < nodes.length;
      });
      S.holding.settlementHexcrawl = {
        version: 2,
        holdingType: type,
        archetype: type,
        vibe: String(archetype.vibe || ''),
        timeOfDay: 'morning',
        visitCount: 0,
        activeNodeId: nodes.length ? nodes[0].id : null,
        nodes: nodes,
        edges: edges,
        ambient: {},
        ambientTables: {
          scenes: (archetype.scenes || []).slice(),
          opportunities: (archetype.opportunities || []).slice(),
          mysteries: (archetype.mysteries || []).slice()
        },
        npcWeb: buildNpcWeb(archetype),
        relationshipMemory: {},
        storylets: [],
        lastDailyTick: '',
        stats: buildStats(archetype),
        history: []
      };
    }

    var crawl = S.holding.settlementHexcrawl;
    crawl.nodes.forEach(function (n) { n.revealed = true; });
    return crawl;
  }

  function rollHoldingAmbientState(crawl) {
    var regionMode = String(crawl.regionMode || 'province').toLowerCase();
    var regionalFlavor = {
      province: {
        landmarks: ['Bell Bastion overlook', 'Salt aqueduct gatehouse', 'Old tribunal arch', 'Red quarry crane'],
        scenic: ['Rain catches on banner cords across the district roofs.', 'A candle parade winds through lane shrines at dusk.', 'Scouts return through fog with cracked lanterns.'],
        headlines: ['Faction pressure: Wardens accuse Merchants of route theft.', 'Council bulletin: emergency grain levies approved.', 'Street gossip: watch rotations quietly reduced tonight.']
      },
      sea: {
        landmarks: ['Broken lighthouse platform', 'Moon-tide drydock', 'Chain buoy gate', 'Flood chapel stairs'],
        scenic: ['Harbor bells ring under rolling fog.', 'Salt spray coats every lantern and sign.', 'A black-hulled ship cuts in without flags.'],
        headlines: ['Faction pressure: Dock guilds threaten strike at dawn.', 'Harbor bulletin: convoy lanes now permit-only.', 'Pier gossip: customs ledgers were altered overnight.']
      },
      space: {
        landmarks: ['Docking ring A-12', 'Pressure garden spindle', 'Relay mast cathedral', 'Zero-g customs node'],
        scenic: ['Cargo drones arc past the viewport in silent lines.', 'Mag boots spark along grated catwalks.', 'A shuttle burns retro-thrusters across the observation dome.'],
        headlines: ['Faction pressure: station syndicates contest fuel taxes.', 'Hub bulletin: quarantine lanes expanded to outer berths.', 'Crew gossip: one docking bay has no camera feed.']
      },
      planet: {
        landmarks: ['Dustwall transit gate', 'Orbital elevator spur', 'Survey beacon field', 'Coolant cistern ring'],
        scenic: ['Ion haze turns the skyline metallic blue.', 'Rover caravans queue beneath floodlights.', 'Ash squalls drag long shadows across the colony lanes.'],
        headlines: ['Faction pressure: colony guards and brokers split command.', 'Settlement bulletin: med supplies restricted by ration tier.', 'Worker gossip: tunnel maps no longer match reality.']
      },
      ruins: {
        landmarks: ['Collapsed observatory nave', 'Amber-sealed stairwell', 'Rune kiln court', 'Bonewire archive gate'],
        scenic: ['Dust motes drift through broken stained glass.', 'Echoes carry farther than they should.', 'Ancient mechanisms click behind sealed walls.'],
        headlines: ['Faction pressure: relic hunters clash with shrine wardens.', 'Expedition bulletin: lower vault access revoked.', 'Camp gossip: someone entered the sealed floor and returned mute.']
      }
    };
    var regionPack = regionalFlavor[regionMode] || regionalFlavor.province;
    var ambientTables = crawl.ambientTables || {};
    var scenes = Array.isArray(ambientTables.scenes) && ambientTables.scenes.length
      ? ambientTables.scenes
      : [
          'Funeral procession passes through a narrow lane.',
          'A child steals bread and vanishes into the crowd.',
          'Militia drills spill into the market square.',
          'A drunk miner collapses near a shrine.'
        ];
    var opportunities = Array.isArray(ambientTables.opportunities) && ambientTables.opportunities.length
      ? ambientTables.opportunities
      : [
          'Win a district map in a dice game.',
          'Buy discounted tools from a nervous smith.',
          'Hire a temporary scout for the next expedition.'
        ];
    var mysteries = Array.isArray(ambientTables.mysteries) && ambientTables.mysteries.length
      ? ambientTables.mysteries
      : [
          'No one enters one alley after dusk.',
          'Dogs refuse to cross a shrine threshold.',
          'A child keeps drawing the same symbol.'
        ];
    var rumorPool = crawl.nodes.map(function (n) { return n.rumor; }).filter(Boolean);
    var npc = (crawl.npcWeb || [])[Math.floor(Math.random() * Math.max(1, (crawl.npcWeb || []).length))] || { name: 'Patrol Captain' };
    var activeDistrict = crawl.nodes[Math.floor(Math.random() * Math.max(1, crawl.nodes.length))] || null;
    crawl.ambient = {
      scene: scenes[Math.floor(Math.random() * scenes.length)],
      scenicEncounter: regionPack.scenic[Math.floor(Math.random() * regionPack.scenic.length)],
      districtLandmark: regionPack.landmarks[Math.floor(Math.random() * regionPack.landmarks.length)],
      factionHeadline: regionPack.headlines[Math.floor(Math.random() * regionPack.headlines.length)],
      rumor: rumorPool[Math.floor(Math.random() * Math.max(1, rumorPool.length))] || 'People whisper about sealed tunnels.',
      activeDistrict: activeDistrict ? activeDistrict.label : 'Unknown District',
      npcMovement: 'NPC movement: ' + String(npc.name) + ' changed route this watch.',
      threatEscalation: Math.random() < 0.35 ? 'Threat escalates: crisis pressure worsened.' : 'Threat steady: no escalation this watch.',
      opportunity: opportunities[Math.floor(Math.random() * opportunities.length)],
      mysterySignal: mysteries[Math.floor(Math.random() * mysteries.length)]
    };
    crawl.history = Array.isArray(crawl.history) ? crawl.history : [];
    crawl.history.unshift(String(crawl.ambient.activeDistrict || 'District') + ': ' + String(crawl.ambient.scene || ''));
    crawl.history = crawl.history.slice(0, 10);
  }

  function buildHoldingHexMapHtml(crawl) {
    var nodeById = {};
    crawl.nodes.forEach(function (n) { if (n && n.id) nodeById[n.id] = n; });
    var size = 38;
    var ox = 380;
    var oy = 250;
    var toXY = function (q, r) {
      return {
        x: ox + (Math.sqrt(3) * size * (q + r / 2)),
        y: oy + ((3 / 2) * size * r)
      };
    };
    var hexPoints = function (cx, cy) {
      var pts = [];
      for (var i = 0; i < 6; i++) {
        var ang = (Math.PI / 180) * (60 * i - 30);
        pts.push((cx + size * Math.cos(ang)).toFixed(1) + ',' + (cy + size * Math.sin(ang)).toFixed(1));
      }
      return pts.join(' ');
    };
    var edgeSvg = (crawl.edges || []).map(function (e) {
      var a = nodeById[e[0]], b = nodeById[e[1]];
      if (!a || !b) return '';
      var pa = toXY(Number(a.q || 0), Number(a.r || 0));
      var pb = toXY(Number(b.q || 0), Number(b.r || 0));
      return '<line x1="' + pa.x.toFixed(1) + '" y1="' + pa.y.toFixed(1) + '" x2="' + pb.x.toFixed(1) + '" y2="' + pb.y.toFixed(1) + '" stroke="rgba(126,215,255,.35)" stroke-width="2" />';
    }).join('');
    var nodeSvg = crawl.nodes.map(function (n) {
      var p = toXY(Number(n.q || 0), Number(n.r || 0));
      var selected = String(crawl.activeNodeId || '') === String(n.id);
      var stroke = selected ? 'rgba(240,208,112,.95)' : (n.explored ? 'rgba(76,175,116,.9)' : 'rgba(126,215,255,.75)');
      var fill = n.explored ? 'rgba(76,175,116,.2)' : 'rgba(20,30,44,.88)';
      return '<g>'
        + '<polygon points="' + hexPoints(p.x, p.y) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" style="cursor:pointer;" onclick="selectHoldingSettlementDistrict(\'' + String(n.id) + '\')" />'
        + '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 3).toFixed(1) + '" text-anchor="middle" font-size="12" fill="var(--gold2)">' + String(n.label || 'District').slice(0, 12) + '</text>'
        + '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 15).toFixed(1) + '" text-anchor="middle" font-size="10" fill="var(--muted2)">' + (n.explored ? 'Visited' : 'New') + '</text>'
        + '</g>';
    }).join('');
    var glyphs = [];
    for (var i = 0; i < 14; i++) {
      var gx = 28 + ((i * 53) % 700);
      var gy = 24 + ((i * 67) % 440);
      var glyph = (i % 4 === 0) ? '✶' : (i % 4 === 1 ? '◌' : (i % 4 === 2 ? '⟡' : 'ᚠ'));
      glyphs.push('<text x="' + gx + '" y="' + gy + '" text-anchor="middle" font-size="7" fill="rgba(126,215,255,.35)">' + glyph + '</text>');
    }
    var shelfFar = [];
    var shelfNear = [];
    for (var sy = 0; sy < 8; sy++) shelfFar.push('<line x1="-20" y1="' + (40 + sy * 58) + '" x2="820" y2="' + (24 + sy * 58) + '" stroke="rgba(126,215,255,.12)" stroke-width="1" />');
    for (var sz = 0; sz < 6; sz++) shelfNear.push('<line x1="-30" y1="' + (56 + sz * 74) + '" x2="830" y2="' + (76 + sz * 74) + '" stroke="rgba(201,162,39,.12)" stroke-width="1.1" />');
    return '<div style="border:1px solid rgba(126,215,255,.24);background:linear-gradient(180deg,rgba(14,22,34,.92) 0%, rgba(8,13,22,.98) 100%);padding:.32rem;border-radius:4px;box-shadow:inset 0 0 26px rgba(126,215,255,.08);">'
      + '<svg viewBox="0 0 760 500" style="width:100%;max-width:1080px;height:auto;display:block;margin:0 auto;">'
      + '<g>' + shelfFar.join('') + '</g>'
      + '<g>' + shelfNear.join('') + '</g>'
      + '<g>' + glyphs.join('') + '</g>'
      + edgeSvg + nodeSvg + '</svg>'
      + '</div>';
  }

  function rerenderHoldingSettlementHexcrawl(opts) {
    var prevScrollTop = 0;
    var prevPageScrollTop = 0;
    if (typeof document !== 'undefined') {
      var contentEl = document.getElementById('modalContent');
      if (contentEl) prevScrollTop = Number(contentEl.scrollTop || 0);
      var rootEl = document.scrollingElement || document.documentElement || document.body;
      if (rootEl) prevPageScrollTop = Number(rootEl.scrollTop || 0);
    }
    openModal('Holding Settlement Hexcrawl', buildHoldingSettlementHexcrawlModal(opts || { advanceVisit: false }), null, { preventScroll: true, focusTrap: true });
    if (typeof setTimeout === 'function') {
      setTimeout(function () {
        if (typeof document === 'undefined') return;
        var contentEl = document.getElementById('modalContent');
        if (contentEl) contentEl.scrollTop = prevScrollTop;
        var rootEl = document.scrollingElement || document.documentElement || document.body;
        if (rootEl && Number(rootEl.scrollTop || 0) < prevPageScrollTop) rootEl.scrollTop = prevPageScrollTop;
      }, 0);
    }
  }

  function buildHoldingPendingEventHtml() {
    var evt = S.holding && S.holding.pendingDowntimeEvent;
    if (!evt) {
      return '<div style="font-size:.68rem;color:var(--muted2);line-height:1.55;">Use district actions to surface work, rumors, local games, and mission leads. Results will appear here.</div>';
    }
    var stats = ['lead', 'mind', 'body', 'spirit', 'control', 'strike', 'shoot', 'defend'];
    return '<div style="padding:.34rem .4rem;border:1px solid rgba(126,215,255,.22);background:rgba(126,215,255,.05);">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--teal);">' + evt.name + '</div>'
      + '<div style="font-size:.74rem;color:var(--muted2);margin-top:.12rem;line-height:1.52;">Choose an Action Die vs DD' + evt.dd + '.</div>'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;margin-top:.24rem;">'
      + stats.map(function (key) { return '<button class="btn btn-xs btn-teal" onclick="resolveHoldingDowntimeEvent(\'' + key + '\')">' + key.charAt(0).toUpperCase() + key.slice(1) + '</button>'; }).join('')
      + '</div>'
      + '</div>';
  }

  function openHoldingGamblingDen(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); }) || crawl.nodes[0];
    if (node) {
      node.result = 'The local gambling den is open tonight. Dice crews are loud, the table is hot, and wagers are moving fast.';
      crawl.activeNodeId = node.id;
      crawl.gamblingActiveNodeId = node.id;
    }
    if (typeof showNotif === 'function') showNotif('Gambling den is now open in this district.', 'info');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function getHoldingBankState() {
    ensureNewFeatureState();
    if (!S.holding.bank || typeof S.holding.bank !== 'object') {
      S.holding.bank = {
        invested: 0,
        accrued: 0,
        risk: 'low',
        lastTickAt: 0,
        history: []
      };
    }
    if (!Array.isArray(S.holding.bank.history)) { S.holding.bank.history = []; }
    return S.holding.bank;
  }

  function getHoldingBankRiskText(risk) {
    if (risk === 'medium') return 'Medium Risk';
    if (risk === 'high') return 'High Risk';
    return 'Low Risk';
  }

  function getHoldingBankRiskDetails(risk) {
    if (risk === 'medium') {
      return 'Medium variance (about -15% to +16% per in-game day). Good upside, real downside.';
    }
    if (risk === 'high') {
      return 'High variance (about -35% to +40% per in-game day). High reward, high loss.';
    }
    return 'Low variance (about -3% to +3% per in-game day). Slow, steady treasury drift.';
  }

  function sampleHoldingBankPct(risk) {
    var rollPct = function (minPct, maxPct) {
      return minPct + (Math.random() * (maxPct - minPct));
    };
    if (risk === 'medium') {
      return Math.random() < 0.35 ? rollPct(-0.15, -0.08) : rollPct(0.06, 0.16);
    }
    if (risk === 'high') {
      return Math.random() < 0.5 ? rollPct(-0.35, -0.2) : rollPct(0.18, 0.4);
    }
    return Math.random() < 0.08 ? rollPct(-0.03, -0.01) : rollPct(0.01, 0.03);
  }

  function tickHoldingBankInvestments(days) {
    var bank = getHoldingBankState();
    var stepCount = Math.max(1, Number(days || 1));
    if (Number(bank.accrued || 0) > 0) {
      bank.invested = Number(bank.invested || 0) + Number(bank.accrued || 0);
      bank.history.unshift('Treasury sync: moved ' + Number(bank.accrued || 0) + ' accrued credits into active investment.');
      bank.accrued = 0;
    }
    if (Number(bank.invested || 0) <= 0) { return false; }
    for (var i = 0; i < stepCount; i++) {
      var risk = String(bank.risk || 'low');
      var base = Math.max(0, Number(bank.invested || 0));
      if (base <= 0) break;
      var pct = sampleHoldingBankPct(risk);
      var delta = Math.round(base * pct);
      if (!delta) delta = pct >= 0 ? 1 : -1;
      var next = Math.max(0, base + delta);
      bank.invested = next;
      var pctText = (pct >= 0 ? '+' : '') + (pct * 100).toFixed(1) + '%';
      var note = getHoldingBankRiskText(risk) + ' daily settlement: ' + (delta >= 0 ? '+' : '') + delta + ' Credits (' + pctText + ') · ' + base + '→' + next + '₵.';
      bank.history.unshift(note);
    }
    bank.history = bank.history.slice(0, 8);
    bank.lastTickAt = Date.now();
    return true;
  }

  function buildHoldingBankPanelHtml() {
    var bank = getHoldingBankState();
    var total = Math.max(0, Number(bank.invested || 0) + Number(bank.accrued || 0));
    var note = bank.history && bank.history.length ? String(bank.history[0]) : 'No active treasury position.';
    return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;margin-bottom:.35rem;">'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);">Invested</div><div style="font-size:.9rem;color:var(--gold2);">' + Number(bank.invested || 0) + '₵</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);">Accrued</div><div style="font-size:.9rem;color:var(--teal);">' + Number(bank.accrued || 0) + '₵</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.3rem .35rem;background:rgba(255,255,255,.02);"><div style="font-size:.62rem;color:var(--muted2);">Total</div><div style="font-size:.9rem;color:var(--green2);">' + total + '₵</div></div>'
      + '</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.2rem;">Risk: <strong style="color:var(--gold2);">' + getHoldingBankRiskText(bank.risk) + '</strong></div>'
      + '<div style="font-size:.68rem;color:var(--muted2);line-height:1.45;">' + getHoldingBankRiskDetails(bank.risk) + '</div>'
        + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.18rem;line-height:1.45;">Passive ticks occur when in-game time advances (for example: Inn Loop day advance, normal day progression).</div>'
      + '<div style="font-size:.68rem;color:var(--text2);margin-top:.25rem;">Latest: ' + String(note || 'No active treasury position.') + '</div>';
  }

  function openHoldingBankingModal() {
    ensureNewFeatureState();
    var bank = getHoldingBankState();
    var html = '<div style="font-size:.82rem;color:var(--text2);line-height:1.55;">'
      + '<div style="margin-bottom:.3rem;">Deposit any amount of credits into the Holdings Treasury, then choose a risk tier. The treasury passively rolls daily swings on your deposited amount.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.35rem;margin-bottom:.35rem;">'
      + '<div style="border:1px solid var(--border2);padding:.35rem .4rem;background:rgba(255,255,255,.02);"><div style="font-size:.66rem;color:var(--muted2);">Invested</div><div style="font-size:.92rem;color:var(--gold2);">' + Number(bank.invested || 0) + '₵</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.35rem .4rem;background:rgba(255,255,255,.02);"><div style="font-size:.66rem;color:var(--muted2);">Accrued</div><div style="font-size:.92rem;color:var(--teal);">' + Number(bank.accrued || 0) + '₵</div></div>'
      + '<div style="border:1px solid var(--border2);padding:.35rem .4rem;background:rgba(255,255,255,.02);"><div style="font-size:.66rem;color:var(--muted2);">Total</div><div style="font-size:.92rem;color:var(--green2);">' + (Number(bank.invested || 0) + Number(bank.accrued || 0)) + '₵</div></div>'
      + '</div>'
      + '<div style="margin-bottom:.25rem;font-size:.72rem;color:var(--muted2);">Current care tier: <strong style="color:var(--gold2);">' + getHoldingBankRiskText(bank.risk) + '</strong></div>'
      + '<div style="margin-bottom:.25rem;font-size:.7rem;color:var(--muted2);">' + getHoldingBankRiskDetails(bank.risk) + '</div>'
      + '<div style="margin-bottom:.25rem;font-size:.7rem;color:var(--muted2);">Each in-game day applies one treasury roll to your invested credits. Bigger deposits produce bigger swings (positive or negative).</div>'
      + '<div style="margin-bottom:.35rem;display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;">'
      + '<input id="holdingBankAmount" class="bp-input" type="number" min="1" step="1" value="100" placeholder="Amount to deposit" style="max-width:180px;">'
      + '<span style="font-size:.7rem;color:var(--muted2);">Choose risk to commit this deposit.</span>'
      + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.35rem;">'
      + '<button class="btn btn-sm btn-teal" onclick="commitHoldingBankInvestmentFromModal(\'low\');">Low Risk</button>'
      + '<button class="btn btn-sm btn-primary" onclick="commitHoldingBankInvestmentFromModal(\'medium\');">Medium Risk</button>'
      + '<button class="btn btn-sm btn-red" onclick="commitHoldingBankInvestmentFromModal(\'high\');">High Risk</button>'
      + '</div>'
      + buildNestedModalActionRow(
        '<button class="btn btn-sm" onclick="withdrawHoldingBankInvestment();">Withdraw All</button>',
        { cancelLabel: 'Close' }
      )
      + '<div style="margin-top:.35rem;font-size:.68rem;color:var(--muted2);">Recent ledger</div>'
      + ((Array.isArray(bank.history) && bank.history.length) ? bank.history.slice(0, 5).map(function (entry) {
          return '<div style="font-size:.7rem;color:var(--text2);margin-top:.12rem;">• ' + String(entry) + '</div>';
        }).join('') : '<div style="font-size:.7rem;color:var(--muted2);margin-top:.12rem;">No deposits yet.</div>')
      + '</div>';
    if (typeof openModal === 'function') openModal('Holdings Treasury', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function commitHoldingBankInvestmentFromModal(risk) {
    var amountInput = document.getElementById('holdingBankAmount');
    var amount = Math.max(1, Math.floor(Number(amountInput ? amountInput.value : 0) || 0));
    return commitHoldingBankInvestment(amount, risk);
  }

  function commitHoldingBankInvestment(amount, risk) {
    ensureNewFeatureState();
    var bank = getHoldingBankState();
    var value = Math.max(1, Math.floor(Number(amount || 0)));
    if ((S.credits || 0) < value) {
      if (typeof showNotif === 'function') showNotif('Not enough Credits to deposit that amount.', 'warn');
      return false;
    }
    S.credits = Math.max(0, Number(S.credits || 0) - value);
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    bank.invested = Number(bank.invested || 0) + value;
    bank.risk = String(risk || bank.risk || 'low');
    bank.history.unshift('Deposited ' + value + ' Credits into ' + getHoldingBankRiskText(bank.risk) + '.');
    bank.history = bank.history.slice(0, 8);
    renderHoldingUI();
    if (typeof showNotif === 'function') showNotif('Deposited ' + value + ' Credits into the Holdings Treasury.', 'good');
    return true;
  }

  function withdrawHoldingBankInvestment() {
    var bank = getHoldingBankState();
    var total = Math.max(0, Number(bank.invested || 0) + Number(bank.accrued || 0));
    if (total <= 0) {
      if (typeof showNotif === 'function') showNotif('Nothing is currently in the treasury.', 'warn');
      return false;
    }
    S.credits = Number(S.credits || 0) + total;
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    bank.invested = 0;
    bank.accrued = 0;
    bank.risk = 'low';
    bank.history.unshift('Withdrew ' + total + ' Credits from the treasury.');
    bank.history = bank.history.slice(0, 8);
    renderHoldingUI();
    if (typeof showNotif === 'function') showNotif('Withdrawn ' + total + ' Credits from the Holdings Treasury.', 'good');
    return true;
  }

  function advanceHoldingOneDay() {
    if (typeof tickHoldingBankInvestments === 'function') {
      try { tickHoldingBankInvestments(1); } catch (_bankErr) { console.error(_bankErr); }
    }
    if (typeof advanceDay === 'function') {
      advanceDay(1);
      return;
    }
    if (typeof advanceProvincePhasePenalty === 'function') {
      advanceProvincePhasePenalty(3);
    }
  }

  function clearHoldingMedicalState() {
    if (typeof clearStress === 'function') clearStress();
    else if (typeof changeStress === 'function') changeStress(-999);
    if (typeof clearMentalStress === 'function') clearMentalStress();
    else if (typeof changeMentalStress === 'function') changeMentalStress(-999);
    if (typeof clearAllConditions === 'function') clearAllConditions();
    if (typeof S !== 'undefined' && S) {
      S.trauma = 0;
      if (S.radiationState && typeof S.radiationState === 'object') {
        S.radiationState.gainTicks = 0;
        S.radiationState.mutations = [];
        if (S.radiationState.statPenalty && typeof S.radiationState.statPenalty === 'object') {
          Object.keys(S.radiationState.statPenalty).forEach(function (key) {
            S.radiationState.statPenalty[key] = 0;
          });
        }
      }
      if (Array.isArray(S.injuries)) S.injuries = [];
      S.scarState = {
        avoidedDeaths: 0,
        results: [],
        tmwCostPenalty: 0,
        rollPenalty: 0,
        cannotEscapeCombat: false,
        loseHealthOnFailedRoll: false,
        baseTeamwork: Number(S.tmw || 0),
        inProgress: false
      };
    }
    if (typeof updateTrauma === 'function') updateTrauma();
    if (typeof updateInjuryUI === 'function') updateInjuryUI();
    if (typeof updateScarUI === 'function') updateScarUI();
    if (typeof renderBackpackUI === 'function') renderBackpackUI();
    if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
  }

  function runHoldingLocalWork(node) {
    if (!node) { return; }
    var bodyDie = (typeof getEffectiveDie === 'function') ? getEffectiveDie('body') : ((S.stats && S.stats.body) || 4);
    var actionRoll = explodingRoll(bodyDie, { type: 'action', major: true, label: 'Holding Local Work BODY d' + bodyDie });
    var dreadRoll = explodingRoll(6, { type: 'dread', major: true, label: 'Holding Local Work DD6' });
    var success = Number(actionRoll.total || 0) >= Number(dreadRoll.total || 0);
    var msg = 'Local shift (Body vs Dread d6): Body d' + bodyDie + ' ' + actionRoll.total + ' vs DD6 ' + dreadRoll.total + '. ';
    advanceHoldingOneDay();
    if (success) {
      S.credits = Number(S.credits || 0) + 100;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      msg += 'Shift complete. +100 Credits and +1 day advanced.';
    } else {
      var failedBy = Math.max(1, Number(dreadRoll.total || 0) - Number(actionRoll.total || 0));
      if (typeof changeMentalStress === 'function') changeMentalStress(failedBy);
      if (typeof addTMWOnFail === 'function') addTMWOnFail('holding-local-work-failure', { failedBy: failedBy, actionDie: bodyDie, dreadDie: 6 });
      msg += 'Rough shift. +1 day advanced and +' + failedBy + ' Mental Stress from overwork.';
    }
    node.result = msg;
    var crawl = ensureHoldingSettlementHexcrawl();
    crawl.history = Array.isArray(crawl.history) ? crawl.history : [];
    crawl.history.unshift(String(node.label || 'District') + ': ' + msg);
    crawl.history = crawl.history.slice(0, 12);
    if (typeof showNotif === 'function') showNotif(msg, success ? 'good' : 'warn');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function openHoldingMerchantDistrict(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var services = node.services || {};
    if (!services.merchant) {
      if (typeof showNotif === 'function') showNotif('No active merchant stalls in this district right now.', 'warn');
      return;
    }
    var cat = String(services.merchantCategory || 'items');
    if (cat === 'weapons') cat = 'weapon_mods';
    node.result = 'Merchant stalls are active. Redirecting to Merchants (' + cat + ').';
    if (typeof switchTab === 'function') {
      var btn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('shop'\"]");
      switchTab('shop', btn || null);
    }
    if (typeof showShopCat === 'function') {
      try { showShopCat(cat, null); } catch (_err) { console.error(_err); }
    }
    if (typeof showNotif === 'function') showNotif('Merchants access opened in ' + node.label + ' (' + cat + ').', 'info');
  }

  var HOLDING_TRADE_GOODS = [
    { name: 'Trade Goods: Grain Bales', baseValue: 40 },
    { name: 'Trade Goods: Medicine Crates', baseValue: 60 },
    { name: 'Trade Goods: Machine Parts', baseValue: 75 },
    { name: 'Trade Goods: Textiles', baseValue: 45 },
    { name: 'Trade Goods: Preserved Food', baseValue: 50 },
    { name: 'Trade Goods: Fuel Cells', baseValue: 80 }
  ];

  var HOLDING_MARKET_STATE_TABLE = {
    oversupplied: { label: 'Oversupplied', multiplier: 0.5 },
    normal: { label: 'Normal', multiplier: 1 },
    desired: { label: 'Desired', multiplier: 2 },
    desperate: { label: 'Desperate', multiplier: 3 }
  };

  function normalizeTradeGoodName(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function isHoldingTradeGood(name) {
    var norm = normalizeTradeGoodName(name);
    return HOLDING_TRADE_GOODS.some(function (entry) {
      return normalizeTradeGoodName(entry.name) === norm;
    });
  }

  function getHoldingTradeGoodBaseValue(name) {
    var norm = normalizeTradeGoodName(name);
    for (var i = 0; i < HOLDING_TRADE_GOODS.length; i++) {
      if (normalizeTradeGoodName(HOLDING_TRADE_GOODS[i].name) === norm) {
        return Math.max(10, Number(HOLDING_TRADE_GOODS[i].baseValue || 40));
      }
    }
    return 40;
  }

  function rollHoldingMarketState() {
    var r = Math.max(1, Math.min(100, Number(roll(100) || 1)));
    if (r <= 20) return 'oversupplied';
    if (r <= 70) return 'normal';
    if (r <= 90) return 'desired';
    return 'desperate';
  }

  function ensureHoldingDistrictMarket(node) {
    if (!node || typeof node !== 'object') {
      return { state: 'normal', desiredItem: HOLDING_TRADE_GOODS[0].name };
    }
    var today = getCurrentGameDayStampLocal() || String(Date.now());
    var trade = node.tradeMarket && typeof node.tradeMarket === 'object' ? node.tradeMarket : null;
    if (!trade || String(trade.dayStamp || '') !== String(today)) {
      var state = rollHoldingMarketState();
      var desired = pick(HOLDING_TRADE_GOODS).name;
      node.tradeMarket = {
        dayStamp: String(today),
        state: state,
        desiredItem: desired,
        salesToday: 0
      };
      trade = node.tradeMarket;
    }
    if (!trade.state || !HOLDING_MARKET_STATE_TABLE[trade.state]) trade.state = 'normal';
    if (!trade.desiredItem) trade.desiredItem = pick(HOLDING_TRADE_GOODS).name;
    return trade;
  }

  function buildHoldingMerchantBrowsePreview(market) {
    var offers = [
      'Ration Kit', 'Tool Kit', 'Medicine Satchel', 'Scrap Rifle',
      'Stimulant', 'Wound Salve', 'Signal Flare', 'Scope Lens',
      'Portable Shield Emitter', 'Adrenal Injector', 'Spoolwire', 'Field Battery'
    ];
    var categories = ['weapon_mods', 'supplies', 'curios', 'combat_kits'];
    var picked = [];
    var pool = offers.slice();
    while (pool.length && picked.length < 3) {
      var idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    var tradeGoodA = pick(HOLDING_TRADE_GOODS).name;
    var tradeGoodB = market && market.desiredItem ? String(market.desiredItem) : pick(HOLDING_TRADE_GOODS).name;
    if (picked.indexOf(tradeGoodA) < 0) picked.push(tradeGoodA);
    if (picked.indexOf(tradeGoodB) < 0) picked.push(tradeGoodB);
    return {
      category: categories[Math.floor(Math.random() * categories.length)],
      offers: picked,
      marketState: market && market.state ? String(market.state) : 'normal',
      desiredItem: market && market.desiredItem ? String(market.desiredItem) : tradeGoodB
    };
  }

  function getHoldingBrowseOfferCost(offerName) {
    var name = String(offerName || '').trim();
    if (!name) return 50;
    if (isHoldingTradeGood(name)) {
      return getHoldingTradeGoodBaseValue(name);
    }
    var catalog = [
      (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && SHOP_DATA.items) ? SHOP_DATA.items : [],
      (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && SHOP_DATA.essentials) ? SHOP_DATA.essentials : [],
      (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && SHOP_DATA.weapons) ? SHOP_DATA.weapons : [],
      (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && SHOP_DATA.weapon_mods) ? SHOP_DATA.weapon_mods : [],
      (typeof SHOP_DATA !== 'undefined' && SHOP_DATA && SHOP_DATA.armor) ? SHOP_DATA.armor : []
    ];
    for (var c = 0; c < catalog.length; c++) {
      var list = catalog[c] || [];
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (!it || !it.name) continue;
        if (String(it.name).toLowerCase() === name.toLowerCase()) return Math.max(10, Number(it.cost || 50));
      }
    }
    return 50;
  }

  function buyHoldingBrowseOffer(nodeId, offerName) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node || !node.browsePreview || !Array.isArray(node.browsePreview.offers)) return;
    var offer = String(offerName || '').trim();
    if (!offer || node.browsePreview.offers.indexOf(offer) < 0) return;
    var cost = getHoldingBrowseOfferCost(offer);
    if (Number(S.credits || 0) < cost) {
      node.result = 'Not enough credits to buy ' + offer + ' (' + cost + '₵).';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    S.credits = Math.max(0, Number(S.credits || 0) - cost);
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    if (typeof addToBackpack === 'function' && !addToBackpack(offer)) {
      node.result = 'Backpack full. Could not buy ' + offer + '.';
      S.credits = Number(S.credits || 0) + cost;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    node.result = 'Purchased ' + offer + ' for ' + cost + '₵.';
    if (window.TrophySystem) window.TrophySystem.check('first_shop_purchase');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function sellHoldingBrowseBackpackItem(nodeId, slotIdx) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    if (!Array.isArray(S.backpack)) {
      node.result = 'Backpack unavailable.';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    var idx = Number(slotIdx || 0);
    var entry = String(S.backpack[idx] || '').trim();
    if (!entry) {
      node.result = 'That backpack slot is empty.';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    var unit = parseBackpackStack(entry);
    var itemName = String(unit.name || entry);
    var sale = Math.max(10, Math.floor(getHoldingBrowseOfferCost(itemName) * 0.5));
    var market = ensureHoldingDistrictMarket(node);
    var marketMeta = HOLDING_MARKET_STATE_TABLE[String(market.state || 'normal')] || HOLDING_MARKET_STATE_TABLE.normal;
    var desiredMatch = normalizeTradeGoodName(itemName) === normalizeTradeGoodName(market.desiredItem);
    var renownAwarded = false;
    if (isHoldingTradeGood(itemName)) {
      var multiplier = Number(marketMeta.multiplier || 1);
      if (!S.caravan || !S.caravan.owned) multiplier *= 0.75;
      sale = Math.max(10, Math.floor(getHoldingTradeGoodBaseValue(itemName) * multiplier));
      if (desiredMatch && (market.state === 'desired' || market.state === 'desperate')) {
        renownAwarded = true;
      }
      market.salesToday = Number(market.salesToday || 0) + 1;
    }
    if (typeof removeBackpackItem === 'function') removeBackpackItem(idx);
    else S.backpack[idx] = '';
    S.credits = Number(S.credits || 0) + sale;
    if (renownAwarded) {
      if (typeof changeCounter === 'function') changeCounter('renown', 1);
      else S.renown = Math.max(0, Number(S.renown || 0) + 1);
      market.desiredItem = pick(HOLDING_TRADE_GOODS).name;
    }
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    if (typeof renderBackpackUI === 'function') renderBackpackUI();
    node.result = 'Sold ' + itemName + ' for ' + sale + '₵. Market: ' + marketMeta.label + ' x' + marketMeta.multiplier + '.'
      + (renownAwarded ? ' Delivery stabilized demand: +1 Renown.' : '');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function getCurrentGameDayStampLocal() {
    if (typeof getCurrentGameDayStamp === 'function') return String(getCurrentGameDayStamp() || '');
    if (S && S.gameDate && typeof S.gameDate === 'object') {
      return [Number(S.gameDate.year || 1), Number(S.gameDate.month || 1), Number(S.gameDate.day || 1)].join('-');
    }
    return '';
  }

  function ensureHoldingStorylets(crawl) {
    crawl.storylets = Array.isArray(crawl.storylets) ? crawl.storylets : [];
    if (crawl.storylets.length) return;
    var nodes = Array.isArray(crawl.nodes) ? crawl.nodes : [];
    var picks = nodes.slice(0, 3);
    picks.forEach(function (node, idx) {
      crawl.storylets.push({
        id: 'storylet-' + String(idx + 1),
        districtId: node && node.id ? node.id : '',
        title: pick(['Missing Courier Chain', 'Market Sabotage Ring', 'Quiet Shrine Omen', 'Barracks Debt Spiral']),
        stage: 1,
        ignoredDays: 0,
        resolved: false
      });
    });
  }

  function tickHoldingSettlementDaily(days) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var d = Math.max(1, Number(days || 1));
    ensureHoldingStorylets(crawl);
    crawl.storylets.forEach(function (s) {
      if (!s || s.resolved) return;
      s.ignoredDays = Number(s.ignoredDays || 0) + d;
      if (s.ignoredDays >= 2 && Number(s.stage || 1) < 3) {
        s.stage = Number(s.stage || 1) + 1;
        s.ignoredDays = 0;
      }
    });
  }

  function updateHoldingDailyProgress() {
    var crawl = ensureHoldingSettlementHexcrawl();
    var stamp = getCurrentGameDayStampLocal();
    if (!stamp) return;
    if (!crawl.lastDailyTick) {
      crawl.lastDailyTick = stamp;
      return;
    }
    if (crawl.lastDailyTick !== stamp) {
      tickHoldingSettlementDaily(1);
      crawl.lastDailyTick = stamp;
    }
  }

  function recordHoldingNpcInteraction(node, mood, note) {
    var crawl = ensureHoldingSettlementHexcrawl();
    if (!node || !Array.isArray(node.npcRoster) || !node.npcRoster.length) return;
    crawl.relationshipMemory = crawl.relationshipMemory || {};
    var target = node.npcRoster[Math.floor(Math.random() * node.npcRoster.length)] || null;
    if (!target) return;
    var k = String(target.id || target.name || 'npc');
    var rel = crawl.relationshipMemory[k] || { score: 0, notes: [] };
    rel.score += (mood === 'positive' ? 1 : (mood === 'negative' ? -1 : 0));
    rel.notes.unshift(String(note || 'Conversation logged.') + ' (' + String(node.label || 'District') + ')');
    rel.notes = rel.notes.slice(0, 4);
    crawl.relationshipMemory[k] = rel;
    target.relation = rel.score;
    target.memory = rel.notes[0];
  }

  function openHoldingDistrictSideTask(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var die = (typeof getEffectiveDie === 'function') ? getEffectiveDie('lead') : ((S.stats && S.stats.lead) || 4);
    var a = explodingRoll(die, { type: 'action', major: true, label: 'District Side Task LEAD d' + die });
    var d = explodingRoll(6, { type: 'dread', major: true, label: 'District Side Task DD6' });
    var success = Number(a.total || 0) >= Number(d.total || 0);
    if (success) {
      S.credits = Number(S.credits || 0) + 45;
      if (typeof updateCreditsUI === 'function') updateCreditsUI();
      if (typeof changeCounter === 'function') changeCounter('tmw', 1);
    } else {
      var failedBy = Math.max(1, Number(d.total || 0) - Number(a.total || 0));
      if (typeof changeMentalStress === 'function') changeMentalStress(failedBy);
      if (typeof addTMWOnFail === 'function') addTMWOnFail('holding-side-task-failure', { failedBy: failedBy, actionDie: die, dreadDie: 6 });
    }
    node.result = 'Side task (' + String(node.label || 'District') + '): Lead d' + die + '=' + a.total + ' vs DD6=' + d.total + '. '
      + (success ? 'Task closed locally. +45 Credits, +1 Teamwork.' : 'Complication triggered. +' + Math.max(1, Number(d.total || 0) - Number(a.total || 0)) + ' Mental Stress.');
    recordHoldingNpcInteraction(node, success ? 'positive' : 'negative', success ? 'Closed a side task quickly.' : 'A side task spiraled.');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function openHoldingDistrictMissionPickup(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var services = node.services || {};
    if (!services.missionBoard) {
      node.result = 'No active mission board in this district. Ask for rumors or try another district.';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    var missionTitle = pick([
      'Settlement Contract: ' + String(node.label || 'District') + ' Stabilization',
      'Settlement Contract: Secure ' + String(node.label || 'District') + ' Route',
      'Settlement Contract: Civic Relief Sweep'
    ]);
    var posted = false;
    if (typeof createMission === 'function') {
      var created = createMission(
        'Settlement Board',
        missionTitle,
        pick(['easy', 'medium', 'hard']),
        String(node.label || 'Holding District'),
        'province',
        { gain: 'Grey Kingdom', lose: 'Nomad Clans' },
        { missionType: 'settlement_management', source: 'holding_settlement_board' }
      );
      posted = !!created;
    }
    if (!posted && typeof generateTask === 'function') generateTask();
    node.result = posted
      ? 'Mission board posted a live contract in Missions.'
      : 'Mission board refreshed. New contracts are ready to review.';
    crawl.history = Array.isArray(crawl.history) ? crawl.history : [];
    crawl.history.unshift(String(node.label || 'District') + ': Mission board refreshed.');
    crawl.history = crawl.history.slice(0, 12);
    if (typeof switchTab === 'function') {
      var missionBtn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('missions'\"]");
      switchTab('missions', missionBtn || null);
    }
    if (typeof showNotif === 'function') showNotif((posted ? 'Contract posted to Missions: ' : 'New mission posted in ') + node.label + '.', 'good');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function openHoldingSettlementSewerRoute(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    var depthHex = (typeof mapData !== 'undefined' && Array.isArray(mapData))
      ? mapData.find(function (hex) { return hex && String(hex.type || '') === 'depths'; })
      : null;
    if (!depthHex || typeof openProvinceDepthsPopup !== 'function') {
      if (node) node.result = 'Sewer grates are mapped, but no megadungeon entrance is active in this province yet.';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    if (node) node.result = 'You route through the sewer culverts toward ' + String(depthHex.name || 'the Lantern Below') + '.';
    if (typeof showNotif === 'function') showNotif('Sewer route opened to the megadungeon entrance.', 'info');
    openProvinceDepthsPopup(depthHex.col, depthHex.row);
  }

  function runHoldingDistrictFlavorAction(nodeId, action) {
    updateHoldingDailyProgress();
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) {
      if (typeof showNotif === 'function') showNotif('Select a district first.', 'warn');
      return;
    }
    crawl.activeNodeId = node.id;
    var ambient = crawl.ambient || {};
    var msg = '';
    if (action === 'rumor') {
      msg = 'Rumor sweep: ' + String(node.rumor || ambient.rumor || 'The district is quiet for now.') + ' Opportunity: ' + String(ambient.opportunity || 'Nothing immediate.');
      recordHoldingNpcInteraction(node, 'neutral', 'Collected district rumors.');
    } else if (action === 'browse') {
      var market = ensureHoldingDistrictMarket(node);
      node.browsePreview = buildHoldingMerchantBrowsePreview(market);
      var marketMeta = HOLDING_MARKET_STATE_TABLE[String(market.state || 'normal')] || HOLDING_MARKET_STATE_TABLE.normal;
      msg = 'Merchants loaded local stock (' + String(node.browsePreview.category || 'mixed') + '). Market: '
        + marketMeta.label + ' x' + marketMeta.multiplier + '. Desired: ' + String(market.desiredItem || 'Trade Goods');
    } else if (action === 'event') {
      msg = 'Random encounter: ' + String(ambient.scene || 'People surge through the lanes.') + ' ' + String(ambient.npcMovement || '');
      recordHoldingNpcInteraction(node, 'neutral', 'Handled a district random encounter.');
    } else if (action === 'downtime_talk') {
      rollHoldingDowntimeActivity('talk');
      recordHoldingNpcInteraction(node, 'positive', 'Spent time talking with locals.');
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    } else if (action === 'downtime_task') {
      runHoldingLocalWork(node);
      return;
    } else if (action === 'downtime_explore') {
      rollHoldingDowntimeActivity('explore');
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    } else if (action === 'gamble') {
      if (!node.services || !node.services.gamblingDen) {
        node.result = 'No gambling den is running in this district tonight.';
        rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
        return;
      }
      openHoldingGamblingDen(node.id);
      return;
    }
    node.result = msg || node.result;
    crawl.history = Array.isArray(crawl.history) ? crawl.history : [];
    if (msg) {
      crawl.history.unshift(String(node.label || 'District') + ': ' + msg);
      crawl.history = crawl.history.slice(0, 12);
      if (typeof showNotif === 'function') showNotif(msg, 'info');
    }
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function ensureHoldingGamblingState(crawl, node) {
    crawl.gambling = crawl.gambling || {};
    var key = String((node && node.id) || crawl.activeNodeId || 'district');
    if (!crawl.gambling[key] || typeof crawl.gambling[key] !== 'object') {
      crawl.gambling[key] = {
        level: 1,
        guess: '',
        dieOne: '-',
        dieTwo: '-',
        valor: '-',
        outcome: 'Pick a difficulty and guess, then play a hand.',
        history: []
      };
    }
    return crawl.gambling[key];
  }

  function toggleHoldingGamblingNode(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var key = String(nodeId || '');
    if (!key) {
      crawl.gamblingActiveNodeId = '';
    } else {
      crawl.gamblingActiveNodeId = String(crawl.gamblingActiveNodeId || '') === key ? '' : key;
      crawl.activeNodeId = key;
    }
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function holdingGambleValorDie(level) {
    var map = { 1: 20, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4 };
    var key = Math.max(1, Math.min(6, Number(level || 1)));
    return map[key] || 20;
  }

  function buildHoldingGamblingEmbedHtml(node, crawl) {
    if (!node || !crawl) return '';
    var state = ensureHoldingGamblingState(crawl, node);
    var level = Math.max(1, Math.min(6, Number(state.level || 1)));
    var buyIn = level * 10;
    var advDie = holdingGambleValorDie(level);
    var historyHtml = (state.history || []).slice(0, 6).map(function (line) {
      return '<div style="font-size:.68rem;color:var(--muted2);line-height:1.45;">• ' + String(line || '') + '</div>';
    }).join('');
    var levelButtons = [1, 2, 3, 4, 5, 6].map(function (lv) {
      var on = lv === level;
      return '<button type="button" class="btn btn-xs' + (on ? ' btn-teal' : '') + '" onclick="setHoldingGamblingDifficulty(\'' + String(node.id) + '\',' + lv + ')">L' + lv + ' (' + (lv * 10) + '₵)</button>';
    }).join('');
    var guessBtn = function (key, label) {
      var on = String(state.guess || '') === key;
      return '<button type="button" class="btn btn-xs' + (on ? ' btn-teal' : '') + '" onclick="setHoldingGamblingGuess(\'' + String(node.id) + '\',\'' + key + '\')">' + label + '</button>';
    };
    return '<div style="margin-top:.14rem;padding:.34rem .38rem;border:1px solid rgba(201,162,39,.35);background:rgba(201,162,39,.06);">'
      + '<div style="font-size:.68rem;color:var(--gold2);text-transform:uppercase;letter-spacing:.08em;">Embedded Gambling Den</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-top:.12rem;line-height:1.5;">House rules: pay buy-in, roll two Dread d6 and one Valor die, then call Under / Middle / Over. Matching either Dread die counts as Middle.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(4,minmax(72px,1fr));gap:.18rem;margin-top:.22rem;">'
      + '<div style="font-size:.66rem;color:var(--muted2);">Credits<br><strong style="color:var(--gold2);font-size:.8rem;">' + Number(S.credits || 0) + '₵</strong></div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Buy In<br><strong style="color:var(--text2);font-size:.8rem;">' + buyIn + '₵</strong></div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Difficulty<br><strong style="color:var(--text2);font-size:.8rem;">Level ' + level + '</strong></div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Valor Die<br><strong style="color:var(--text2);font-size:.8rem;">d' + advDie + '</strong></div>'
      + '</div>'
      + '<div style="display:flex;gap:.16rem;flex-wrap:wrap;margin-top:.22rem;">' + levelButtons + '</div>'
      + '<div style="display:flex;gap:.16rem;flex-wrap:wrap;margin-top:.16rem;">'
      + guessBtn('under', 'Under') + guessBtn('middle', 'Middle') + guessBtn('over', 'Over')
      + '</div>'
      + '<div style="font-size:.7rem;color:var(--gold2);margin-top:.12rem;">Current Call: <strong>' + (state.guess ? String(state.guess).toUpperCase() : 'NONE') + '</strong></div>'
      + '<div style="display:flex;gap:.16rem;flex-wrap:wrap;margin-top:.2rem;">'
      + '<button type="button" class="btn btn-xs btn-primary" onclick="playHoldingGamblingRound(\'' + String(node.id) + '\')">Play Round</button>'
      + '<button type="button" class="btn btn-xs" onclick="clearHoldingGamblingHistory(\'' + String(node.id) + '\')">Clear Ledger</button>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,minmax(64px,1fr));gap:.16rem;margin-top:.2rem;">'
      + '<div style="font-size:.66rem;color:var(--muted2);">Dread 1<br><strong style="color:var(--red2);font-size:.84rem;">' + state.dieOne + '</strong></div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Valor<br><strong style="color:var(--teal);font-size:.84rem;">' + state.valor + '</strong></div>'
      + '<div style="font-size:.66rem;color:var(--muted2);">Dread 2<br><strong style="color:var(--red2);font-size:.84rem;">' + state.dieTwo + '</strong></div>'
      + '</div>'
      + '<div style="font-size:.72rem;color:var(--text2);margin-top:.2rem;">' + String(state.outcome || '') + '</div>'
      + (historyHtml ? ('<div style="margin-top:.2rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.14rem;">' + historyHtml + '</div>') : '')
      + '</div>';
  }

  function setHoldingGamblingDifficulty(nodeId, level) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var state = ensureHoldingGamblingState(crawl, node);
    state.level = Math.max(1, Math.min(6, Number(level || 1)));
    crawl.activeNodeId = node.id;
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function setHoldingGamblingGuess(nodeId, guess) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var state = ensureHoldingGamblingState(crawl, node);
    state.guess = String(guess || '');
    crawl.activeNodeId = node.id;
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function clearHoldingGamblingHistory(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var state = ensureHoldingGamblingState(crawl, node);
    state.history = [];
    state.outcome = 'Ledger cleared. Pick a guess and play a round.';
    crawl.activeNodeId = node.id;
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function playHoldingGamblingRound(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) return;
    var state = ensureHoldingGamblingState(crawl, node);
    var level = Math.max(1, Math.min(6, Number(state.level || 1)));
    var buyIn = level * 10;
    var payout = level * 10;
    if (!state.guess) {
      state.outcome = 'Select Under / Middle / Over before you play.';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    if (Number(S.credits || 0) < buyIn) {
      state.outcome = 'Not enough credits for buy-in (' + buyIn + '₵ needed).';
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    S.credits = Math.max(0, Number(S.credits || 0) - buyIn);
    var dreadA = roll(6);
    var dreadB = roll(6);
    var low = Math.min(dreadA, dreadB);
    var high = Math.max(dreadA, dreadB);
    var valor = roll(holdingGambleValorDie(level));
    var actual = valor < low ? 'under' : (valor > high ? 'over' : 'middle');
    var win = String(actual) === String(state.guess);
    if (win) {
      S.credits = Number(S.credits || 0) + buyIn + payout;
      state.outcome = 'Win. Call ' + String(state.guess).toUpperCase() + ' landed. Profit +' + payout + '₵.';
    } else {
      state.outcome = 'Loss. Valor landed ' + String(actual).toUpperCase() + '. Buy-in lost.';
    }
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    state.dieOne = low;
    state.dieTwo = high;
    state.valor = valor;
    state.history = Array.isArray(state.history) ? state.history : [];
    state.history.unshift('L' + level + ' · ' + low + '/' + high + ' vs Vd' + holdingGambleValorDie(level) + '=' + valor + ' · called ' + String(state.guess).toUpperCase() + ' · ' + (win ? 'WIN' : 'LOSS'));
    state.history = state.history.slice(0, 10);
    node.result = 'Gambling round: ' + state.outcome;
    crawl.history = Array.isArray(crawl.history) ? crawl.history : [];
    crawl.history.unshift(String(node.label || 'District') + ': ' + state.outcome);
    crawl.history = crawl.history.slice(0, 12);
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function buildHoldingSettlementHexcrawlModal(opts) {
    opts = opts || {};
    var crawl = ensureHoldingSettlementHexcrawl();
    if (opts.advanceVisit !== false) {
      crawl.visitCount = Number(crawl.visitCount || 0) + 1;
      rollHoldingAmbientState(crawl);
    } else if (!crawl.ambient || !crawl.ambient.scene) {
      rollHoldingAmbientState(crawl);
    }
    var active = crawl.nodes.find(function (n) { return String(n.id || '') === String(crawl.activeNodeId || ''); }) || crawl.nodes[0];
    var stats = crawl.stats || {};
    var statsHtml = ['security', 'food', 'wealth', 'faith', 'fear', 'mystery', 'health'].map(function (k) {
      var v = Math.max(0, Math.min(10, Number(stats[k] || 0)));
      return '<div style="font-size:.68rem;color:var(--muted2);padding:.1rem .25rem;border:1px solid rgba(255,255,255,.06);">' + k.toUpperCase() + ': <strong style="color:var(--text2);">' + v + '/10</strong></div>';
    }).join('');
    var ambient = crawl.ambient || {};
    var historyHtml = (Array.isArray(crawl.history) ? crawl.history : []).slice(0, 4).map(function (line) {
      return '<div style="font-size:.68rem;color:var(--muted2);">• ' + String(line || '') + '</div>';
    }).join('');
    var micro = active && Array.isArray(active.microLocations) ? active.microLocations : [];
    var microHtml = micro.map(function (m) { return '<div style="font-size:.7rem;color:var(--text2);">- ' + m + '</div>'; }).join('');
    ensureHoldingStorylets(crawl);
    var storyletHtml = (crawl.storylets || []).filter(function (s) { return s && !s.resolved; }).slice(0, 3).map(function (s) {
      return '<div style="font-size:.66rem;color:var(--muted2);">• ' + String(s.title || 'Local chain') + ' — Stage ' + Number(s.stage || 1) + '/3</div>';
    }).join('');
    var actionButton = active && !active.explored
      ? '<button type="button" class="btn btn-xs btn-primary" onclick="resolveHoldingSettlementHexNode(\'' + String(active.id) + '\')">Scout District (Lead vs DD' + Number(active.dd || 6) + ')</button>'
      : '<span style="font-size:.68rem;color:var(--green2);">Scouted this visit.</span>';
    var districtButtons = '';
    var districtRollBreakdown = [];
    var isPhoneLayout = !!(typeof document !== 'undefined' && document.body && document.body.classList && document.body.classList.contains('phone-layout-mode'));
    function addRollBreakdown(fullText, compactText) {
      districtRollBreakdown.push(isPhoneLayout ? String(compactText || fullText) : String(fullText || compactText || ''));
    }
    if (active) {
      var services = active.services || {};
      if (services.missionBoard) districtButtons += '<button type="button" class="btn btn-xs" onclick="openHoldingDistrictMissionPickup(\'' + String(active.id) + '\')">Mission Board</button>';
      if (services.missionBoard) addRollBreakdown('Mission Board: mixed mission check (varies by mission card)', 'Mission Board: mixed check (varies)');
      if (services.localWork) districtButtons += '<button type="button" class="btn btn-xs btn-teal" onclick="runHoldingDistrictFlavorAction(\'' + String(active.id) + '\',\'downtime_task\')">Local Shift</button>';
      if (services.localWork) addRollBreakdown('Local Shift: (Body vs Dread d6) Roll to earn 100 Credits and advance 1 day.', 'Local Shift: Body vs DD6, +100₵, +1 day');
      if (services.merchant) districtButtons += '<button type="button" class="btn btn-xs" onclick="openHoldingMerchantDistrict(\'' + String(active.id) + '\')">Merchants</button>';
      if (services.merchant) addRollBreakdown('Merchants: no roll (open trade inventory and buy/sell)', 'Merchants: no roll, buy/sell');
      if (active.kind === 'inn') districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'rest\')">Rest</button>';
      if (active.kind === 'inn') addRollBreakdown('Rest: no roll (Protected + ease Mental Stress)', 'Rest: no roll, Protected + stress ease');
      if (active.kind === 'lord') districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'audience\')">Audience</button>';
      if (active.kind === 'lord') addRollBreakdown('Audience: no roll (+1 Renown and mission posting)', 'Audience: no roll, +1 Renown + mission');
      if (services.inn) districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'inn_service\')">Inn Loop (10₵ · no roll)</button>';
      if (services.inn) addRollBreakdown('Inn Loop: no roll (10₵, full recovery + clear conditions, advance 1 day)', 'Inn Loop: no roll, 10₵, full recover, +1 day');
      if (services.bar) districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'bar\')">Bar Loop (+1 TMW · no roll)</button>';
      if (services.bar) addRollBreakdown('Bar Loop: no roll (+1 Teamwork, rumor pull, opens gambling table)', 'Bar Loop: no roll, +1 TMW, rumor + gambling');
      if (services.banking) districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'banking\')">Banking (Deposit + passive risk)</button>';
      if (services.banking) addRollBreakdown('Banking: no action roll (deposit credits, passive risk roll each in-game day)', 'Banking: no roll, deposit + daily passive risk');
      if (services.legal) districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'legal\')">Legal Desk</button>';
      if (services.legal) addRollBreakdown('Legal Desk: no roll (20₵, floor renown tracks at 0 and harden security)', 'Legal: no roll, 20₵, reset renown floor + security');
      if (services.hospital) districtButtons += '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictAction(\'' + String(active.id) + '\',\'hospital\')">Hospital</button>';
      if (services.hospital) addRollBreakdown('Hospital: no roll (50₵, clear trauma/radiation/injuries/scars/stress)', 'Hospital: no roll, 50₵, clear major conditions');
      districtButtons += '<button type="button" class="btn btn-xs" onclick="openHoldingSettlementSewerRoute(\'' + String(active.id) + '\')">Sewer Route</button>';
      addRollBreakdown('Sewer Route: route event check (varies by route/event)', 'Sewer Route: route check (varies)');
    }

    var html = '<div style="font-size:.77rem;color:var(--text2);line-height:1.46;display:grid;gap:.24rem;">'
      + '<div style="border:1px solid var(--border2);background:rgba(255,255,255,.04);padding:.3rem .34rem;">'
      + '<div style="font-size:.74rem;color:var(--gold2);letter-spacing:.05em;text-transform:uppercase;"><strong>Holding Overview</strong></div>'
      + '<div style="margin-top:.08rem;font-size:.73rem;color:var(--text2);"><strong style="color:var(--gold2);">District Hexcrawl</strong> · Visit #' + Number(crawl.visitCount || 1) + ' · ' + String(crawl.timeOfDay || 'morning').toUpperCase() + '</div>'
      + '<div style="margin-top:.12rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:.12rem;">'
      + '<div style="padding:.22rem .28rem;border:1px solid rgba(126,215,255,.24);background:rgba(126,215,255,.06);"><div style="font-size:.58rem;color:var(--teal);letter-spacing:.08em;text-transform:uppercase;">Next Roll</div><div style="font-size:.7rem;color:var(--text2);margin-top:.04rem;"><strong style="color:var(--gold2);">Lead vs DD' + Number(active && active.dd || 6) + '</strong> to scout.</div></div>'
      + '<div style="padding:.22rem .28rem;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);"><div style="font-size:.58rem;color:var(--muted2);letter-spacing:.08em;text-transform:uppercase;">Selected</div><div style="font-size:.7rem;color:var(--text2);margin-top:.04rem;"><strong>' + String(active && active.label || 'District') + '</strong> · ' + String(active && active.dangerLevel || 'Moderate') + ' risk</div></div>'
      + '<div style="padding:.22rem .28rem;border:1px solid rgba(142,214,159,.22);background:rgba(142,214,159,.06);"><div style="font-size:.58rem;color:var(--green2);letter-spacing:.08em;text-transform:uppercase;">Services</div><div style="font-size:.7rem;color:var(--text2);margin-top:.04rem;">If a button says <strong>no roll</strong>, apply it directly.</div></div>'
      + '</div>'
      + '<details style="margin-top:.1rem;">'
      + '<summary style="cursor:pointer;font-size:.66rem;color:var(--muted2);">Need the full procedure?</summary>'
      + '<div style="font-size:.68rem;color:var(--muted2);line-height:1.5;margin-top:.08rem;">Pick a district, scout with <strong style="color:var(--gold2);">Lead vs District DD</strong>, then use the district service buttons. Banking is a passive treasury loop, service loops do not request action dice, and results are saved in the district log.</div>'
      + '</details>'
      + '<details style="margin-top:.1rem;">'
      + '<summary style="cursor:pointer;font-size:.66rem;color:var(--muted2);">Settlement Metadata</summary>'
      + '<div style="margin-top:.08rem;font-size:.68rem;color:var(--muted2);">Type: ' + String(crawl.holdingType || 'Settlement') + ' · Terrain: ' + String((S.holding && S.holding.terrain) || 'Glades') + ' · Weather: ' + String((S.currentSeason || 'spring').toUpperCase()) + '</div>'
      + '<div style="margin-top:.08rem;font-size:.68rem;color:var(--teal);">Style: ' + String(crawl.vibe || 'Living settlement pressure ecosystem') + '</div>'
      + '<div style="margin-top:.1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:.14rem;">' + statsHtml + '</div>'
      + '</details>'
      + '</div>'

      + '<div style="border:1px solid var(--border2);background:rgba(255,255,255,.03);padding:.3rem .34rem;">'
      + '<div style="font-size:.71rem;color:var(--gold2);margin-bottom:.14rem;"><strong>District Hex Map</strong></div>'
      + buildHoldingHexMapHtml(crawl)
      + '<div style="display:flex;gap:.14rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.14rem;">'
      + '<button type="button" class="btn btn-xs" onclick="advanceHoldingSettlementTime(1)">+1 Hour</button>'
      + '<button type="button" class="btn btn-xs" onclick="advanceHoldingSettlementTime(6)">+6 Hours</button>'
      + '<button type="button" class="btn btn-xs btn-teal" onclick="openHoldingSettlementHexcrawl()">Refresh Scene</button>'
      + '</div>'
      + '</div>'

      + (active ? ('<div style="border:1px solid var(--border2);background:rgba(0,0,0,.14);padding:.3rem .34rem;">'
        + '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.08rem;"><strong>District Details</strong></div>'
        + '<div style="font-size:.79rem;color:var(--text);"><strong>' + active.label + '</strong> <span style="font-size:.66rem;color:var(--muted2);">(' + (active.explored ? 'Visited' : 'Unexplored') + ')</span></div>'
        + '<div style="font-size:.68rem;color:var(--text2);margin-top:.08rem;line-height:1.46;">' + active.atmosphere + '</div>'
        + '<details style="margin-top:.1rem;">'
        + '<summary style="cursor:pointer;font-size:.65rem;color:var(--muted2);">District Metadata</summary>'
        + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.08rem;">Activity: ' + active.activity + ' · Crowd: ' + active.npcDensity + ' · Mood: ' + active.mood + '</div>'
        + '<div style="font-size:.66rem;color:var(--muted2);">Economy: ' + String(active.economy || 'mixed') + ' · Scarcity: ' + String(active.scarcity || 'balanced') + '</div>'
        + '<div style="font-size:.66rem;color:var(--muted2);">Interactable: ' + active.interactable + ' · Hidden: ' + active.hiddenThing + '</div>'
        + '<div style="font-size:.66rem;color:var(--text2);margin-top:.06rem;">District Landmark: <strong style="color:var(--gold2);">' + String(active.districtLandmark || 'Ward landmark pending') + '</strong></div>'
        + '<div style="font-size:.66rem;color:var(--muted2);">Guild Headline: ' + String(active.factionHeadline || 'No headline filed') + '</div>'
        + (Array.isArray(active.npcRoster) && active.npcRoster.length ? ('<div style="font-size:.66rem;color:var(--teal);margin-top:.08rem;">District NPC Roster</div>' + active.npcRoster.map(function (npc) {
          return '<div style="font-size:.66rem;color:var(--muted2);">• ' + String(npc.name || 'Local') + ' (' + String(npc.role || 'Resident') + ') · Relation ' + (Number(npc.relation || 0) >= 0 ? '+' : '') + Number(npc.relation || 0) + '</div>';
        }).join('')) : '')
        + (microHtml ? ('<div style="font-size:.66rem;color:var(--teal);margin-top:.08rem;">Micro-Locations</div>' + microHtml) : '')
        + '</details>'
        + '<div style="margin-top:.12rem;font-size:.64rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">Core Action</div>'
        + '<div style="margin-top:.06rem;display:flex;gap:.14rem;flex-wrap:wrap;">' + actionButton + '</div>'
        + (districtButtons ? '<div style="margin-top:.08rem;font-size:.64rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">District Services</div>' : '')
        + (districtRollBreakdown.length ? '<details style="margin-top:.06rem;"><summary style="cursor:pointer;font-size:.65rem;color:var(--gold2);">What do I roll here?</summary><div style="margin-top:.06rem;font-size:.66rem;color:var(--muted2);line-height:1.45;">' + districtRollBreakdown.join('<br>') + '</div></details>' : '')
        + '<div style="margin-top:.06rem;display:flex;gap:.14rem;flex-wrap:wrap;">' + districtButtons + '</div>'
        + '<div style="margin-top:.08rem;font-size:.64rem;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em;">Local Flavor</div>'
        + '<div style="margin-top:.06rem;display:flex;gap:.14rem;flex-wrap:wrap;">'
        + '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictFlavorAction(\'' + String(active.id) + '\',\'downtime_talk\')">Talk to Locals</button>'
        + '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictFlavorAction(\'' + String(active.id) + '\',\'rumor\')">Hear Rumors</button>'
        + '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictFlavorAction(\'' + String(active.id) + '\',\'browse\')">Merchants</button>'
        + '<button type="button" class="btn btn-xs" onclick="runHoldingDistrictFlavorAction(\'' + String(active.id) + '\',\'event\')">Random Encounter</button>'
        + '</div>'
        + '<div id="holdingDowntimeResult" style="margin-top:.12rem;">' + buildHoldingPendingEventHtml() + '</div>'
        + (active && active.services && active.services.gamblingDen
          ? ('<div style="margin-top:.1rem;padding:.2rem .28rem;border:1px solid rgba(201,162,39,.28);background:rgba(201,162,39,.05);">'
            + '<div style="font-size:.67rem;color:var(--gold2);margin-bottom:.08rem;"><strong>Gambling Den</strong></div>'
            + (String(crawl.gamblingActiveNodeId || '') === String(active.id || '')
              ? ('<div style="display:flex;gap:.16rem;flex-wrap:wrap;margin-bottom:.18rem;">'
                + '<button type="button" class="btn btn-xs btn-gold" onclick="toggleHoldingGamblingNode(\'' + String(active.id) + '\')">Hide Gambling Table</button>'
                + '</div>'
                + buildHoldingGamblingEmbedHtml(active, crawl))
              : '<button type="button" class="btn btn-xs btn-gold" onclick="toggleHoldingGamblingNode(\'' + String(active.id) + '\')">Open Gambling Table</button>')
            + '</div>')
          : '')
        + (active && active.browsePreview && Array.isArray(active.browsePreview.offers)
          ? ('<div style="margin-top:.1rem;padding:.2rem .28rem;border:1px solid rgba(126,215,255,.28);background:rgba(126,215,255,.06);">'
            + '<div style="font-size:.67rem;color:var(--teal);margin-bottom:.08rem;"><strong>Merchants Offers</strong> · ' + String(active.browsePreview.category || 'mixed') + '</div>'
            + (function () {
                var market = ensureHoldingDistrictMarket(active);
                var marketMeta = HOLDING_MARKET_STATE_TABLE[String(market.state || 'normal')] || HOLDING_MARKET_STATE_TABLE.normal;
                return '<div style="font-size:.66rem;color:var(--gold2);line-height:1.45;margin-bottom:.12rem;">'
                  + 'Market State: <strong>' + marketMeta.label + '</strong> (x' + marketMeta.multiplier + ')'
                  + '<br>Desired Trade Item: <strong>' + String(market.desiredItem || 'Trade Goods') + '</strong>'
                  + '</div>';
              })()
            + '<div style="font-size:.64rem;color:var(--muted2);line-height:1.4;margin-bottom:.12rem;">'
            + 'Sell Modifier Table: Oversupplied x0.5 · Normal x1 · Desired x2 · Desperate x3'
            + '</div>'
            + active.browsePreview.offers.map(function (offer) {
                var itemName = String(offer || 'Item');
                var itemCost = getHoldingBrowseOfferCost(itemName);
                return '<div style="font-size:.68rem;color:var(--text2);line-height:1.4;display:flex;gap:.14rem;align-items:center;justify-content:space-between;">'
                  + '<span>• ' + itemName + ' <span style="color:var(--gold2);">(' + itemCost + '₵)</span></span>'
                  + '<button type="button" class="btn btn-xs btn-teal" onclick="buyHoldingBrowseOffer(\'' + String(active.id) + '\',\'' + itemName.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\')">Buy</button>'
                  + '</div>';
              }).join('')
            + '<div style="margin-top:.16rem;padding-top:.12rem;border-top:1px solid rgba(255,255,255,.1);font-size:.66rem;color:var(--muted2);">'
            + '<strong style="color:var(--gold2);">Sell From Backpack</strong>'
            + ((Array.isArray(S.backpack) ? S.backpack : []).map(function (bp, bIdx) {
                if (!bp) return '';
                return '<div style="margin-top:.08rem;display:flex;gap:.12rem;justify-content:space-between;align-items:center;">'
                  + '<span>BP' + (bIdx + 1) + ': ' + String(bp) + '</span>'
                  + '<button type="button" class="btn btn-xs" onclick="sellHoldingBrowseBackpackItem(\'' + String(active.id) + '\',' + bIdx + ')">Sell</button>'
                  + '</div>';
              }).join('') || '<div style="margin-top:.08rem;">Backpack empty.</div>')
            + '</div>'
            + '</div>')
          : '')
        + (active.result ? '<div style="font-size:.67rem;color:var(--gold2);margin-top:.1rem;line-height:1.46;">' + active.result + '</div>' : '')
        + '</div>') : '')

      + '<details style="border:1px solid var(--border2);background:rgba(46,196,182,.06);padding:.26rem .32rem;">'
      + '<summary style="cursor:pointer;font-size:.69rem;color:var(--gold2);"><strong>World Pulse</strong> <span style="color:var(--muted2);font-size:.65rem;">— ' + String(ambient.scene || 'The holding stirs.') + '</span></summary>'
      + '<div style="font-size:.66rem;color:var(--muted2);line-height:1.44;margin-top:.1rem;">'
      + 'Headline: <strong style="color:var(--gold2);">' + String(ambient.factionHeadline || 'No guild headline.') + '</strong><br>'
      + 'District Landmark: ' + String(ambient.districtLandmark || 'No landmark surfaced.') + '<br>'
      + 'Scenic Encounter: ' + String(ambient.scenicEncounter || 'No scenic encounter.') + '<br>'
      + 'Rumor: ' + String(ambient.rumor || 'No rumor yet.') + '<br>'
      + 'Opportunity: ' + String(ambient.opportunity || 'No opportunity yet.') + '<br>'
      + 'Mystery: ' + String(ambient.mysterySignal || 'No anomaly yet.')
      + '</div>'
      + (storyletHtml ? ('<div style="margin-top:.1rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.1rem;"><div style="font-size:.66rem;color:var(--teal);">Escalating Storylets</div>' + storyletHtml + '</div>') : '')
      + (historyHtml ? ('<div style="margin-top:.14rem;border-top:1px solid rgba(255,255,255,.08);padding-top:.12rem;">'
        + '<div style="font-size:.68rem;color:var(--teal);margin-bottom:.06rem;">Recent District Activity</div>'
        + historyHtml
        + '</div>') : '')
      + '</details>'
      + '</div>';
    return html;
  }

  function runHoldingDistrictAction(nodeId, action) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) {
      if (typeof showNotif === 'function') showNotif('District action unavailable here. Enter the holding map and choose a district first.', 'warn');
      return;
    }
    var msg = '';
    if (action === 'rest') {
      if (typeof toggleCond === 'function' && S.conditions && !S.conditions.protected) toggleCond('protected');
      if (typeof changeMentalStress === 'function') changeMentalStress(-1);
      crawl.stats.health = Math.min(10, Number((crawl.stats && crawl.stats.health) || 0) + 1);
      msg = 'You rest at the inn. Protected applied and stress eased.';
    } else if (action === 'audience') {
      if (typeof changeCounter === 'function') changeCounter('renown', 1);
      S.holding.councilTasks = Array.isArray(S.holding.councilTasks) ? S.holding.councilTasks : [];
      var rulerName = '';
      if (Array.isArray(node.npcRoster) && node.npcRoster.length) {
        var lordNpc = node.npcRoster.find(function (npc) {
          return npc && /lord|regent|steward|magistrate|commander/i.test(String(npc.role || ''));
        });
        rulerName = lordNpc ? String(lordNpc.name || '') : '';
      }
      if (!rulerName) rulerName = String((S.holding && S.holding.name) ? ('Ruler of ' + S.holding.name) : 'Settlement Ruler');
      S.holding.councilTasks.push('Ruler mission: secure outlying district route and keep civic pressure stable.');
      var postedMission = null;
      if (typeof createMission === 'function') {
        postedMission = createMission(
          rulerName,
          'Audience Directive: ' + String(node.label || 'Settlement') + ' Stability Charter',
          pick(['medium', 'hard']),
          String(node.label || 'Holding District'),
          'province',
          { gain: 'Grey Kingdom', lose: 'Nomad Clans', gainName: 'Grey Kingdom', loseName: 'Nomad Clans' },
          {
            missionType: 'settlement_management',
            source: 'holding_audience',
            locationKey: String(node.id || ''),
            lore: rulerName + ' asks you to restore order between district factions, secure supply lanes, and settle escalating civil disputes.'
          }
        );
      }
      if (!postedMission && typeof generateTask === 'function') {
        try { generateTask(); } catch (_err) { console.error(_err); }
      }
      crawl.stats.security = Math.min(10, Number((crawl.stats && crawl.stats.security) || 0) + 1);
      if (typeof switchTab === 'function') {
        var missionBtn = document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('missions'\"]");
        switchTab('missions', missionBtn || null);
      }
      msg = 'Audience complete. +1 Renown and a ruler-issued mission is now active in Missions.';
    } else if (action === 'inn_service') {
      var innCost = 10;
      if (Number(S.credits || 0) < innCost) {
        msg = 'Inn Loop costs 10₵. Not enough credits.';
      } else {
        S.credits = Math.max(0, Number(S.credits || 0) - innCost);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        clearHoldingMedicalState();
        advanceHoldingOneDay();
        crawl.stats.health = Math.min(10, Number((crawl.stats && crawl.stats.health) || 0) + 1);
        crawl.stats.fear = Math.max(0, Number((crawl.stats && crawl.stats.fear) || 0) - 1);
        msg = 'Inn Loop complete (no roll): Long Rest applied for 10₵ and +1 day advanced.';
      }
    } else if (action === 'bar') {
      if (typeof changeCounter === 'function') changeCounter('tmw', 1);
      crawl.stats.wealth = Math.min(10, Number((crawl.stats && crawl.stats.wealth) || 0) + 1);
      crawl.gamblingActiveNodeId = String(node.id || '');
      crawl.activeNodeId = String(node.id || crawl.activeNodeId || '');
      var rumorLine = String(node.rumor || (crawl.ambient && crawl.ambient.rumor) || 'No clear rumor tonight.');
      msg = 'Bar Loop complete (no roll): +1 Teamwork. Rumor: ' + rumorLine + ' Gambling table opened.';
    } else if (action === 'banking') {
      crawl.stats.wealth = Math.min(10, Number((crawl.stats && crawl.stats.wealth) || 0) + 1);
      if (typeof openHoldingBankingModal === 'function') {
        openHoldingBankingModal();
      }
      msg = 'Banking loop opened (no roll): deposit credits to passive risk management.';
    } else if (action === 'legal') {
      var legalCost = 20;
      if (Number(S.credits || 0) < legalCost) {
        msg = 'Legal Desk costs 20₵. Not enough credits.';
      } else {
        S.credits = Math.max(0, Number(S.credits || 0) - legalCost);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        S.renown = Math.max(0, Number(S.renown || 0));
        if (!S.factionRenown || typeof S.factionRenown !== 'object') {
          S.factionRenown = { corporations: 0, religious: 0, political: 0, military: 0, underworld: 0 };
        }
        Object.keys(S.factionRenown).forEach(function (key) {
          S.factionRenown[key] = Math.max(0, Number(S.factionRenown[key] || 0));
        });
        if (S.powerRenown && typeof S.powerRenown === 'object') {
          Object.keys(S.powerRenown).forEach(function (key) {
            S.powerRenown[key] = Math.max(0, Number(S.powerRenown[key] || 0));
          });
        }
        if (typeof updateRenown === 'function') updateRenown();
        if (typeof updateFactionRenownUI === 'function') updateFactionRenownUI();
        crawl.stats.security = Math.min(10, Number((crawl.stats && crawl.stats.security) || 0) + 1);
        msg = 'Legal Desk complete: all renown tracks floored to 0 for 20₵ and district security improved.';
      }
    } else if (action === 'hospital') {
      var hospitalCost = 50;
      if (Number(S.credits || 0) < hospitalCost) {
        msg = 'Hospital costs 50₵. Not enough credits.';
      } else {
        S.credits = Math.max(0, Number(S.credits || 0) - hospitalCost);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        clearHoldingMedicalState();
        crawl.stats.health = Math.min(10, Number((crawl.stats && crawl.stats.health) || 0) + 2);
        msg = 'Hospital complete: Stress, Radiation, Trauma, Injuries, and Scars cleared for 50₵.';
      }
    } else if (action === 'buy_item') {
      if (Number(S.credits || 0) < 50) msg = 'Not enough credits.';
      else {
        S.credits = Math.max(0, Number(S.credits || 0) - 50);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        if (typeof addToBackpack === 'function') addToBackpack('Ration Kit');
        crawl.stats.food = Math.min(10, Number((crawl.stats && crawl.stats.food) || 0) + 1);
        msg = 'Purchased item: Ration Kit (-50 Credits).';
      }
    } else if (action === 'buy_tools') {
      if (Number(S.credits || 0) < 65) msg = 'Not enough credits.';
      else {
        S.credits = Math.max(0, Number(S.credits || 0) - 65);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        if (typeof addToBackpack === 'function') addToBackpack('Tool Kit');
        crawl.stats.wealth = Math.min(10, Number((crawl.stats && crawl.stats.wealth) || 0) + 1);
        msg = 'Purchased item: Tool Kit (-65 Credits).';
      }
    } else if (action === 'buy_medicine') {
      if (Number(S.credits || 0) < 85) msg = 'Not enough credits.';
      else {
        S.credits = Math.max(0, Number(S.credits || 0) - 85);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        if (typeof addToBackpack === 'function') addToBackpack('Medicine Satchel');
        crawl.stats.health = Math.min(10, Number((crawl.stats && crawl.stats.health) || 0) + 1);
        msg = 'Purchased item: Medicine Satchel (-85 Credits).';
      }
    } else if (action === 'buy_weapon') {
      if (Number(S.credits || 0) < 120) msg = 'Not enough credits.';
      else {
        S.credits = Math.max(0, Number(S.credits || 0) - 120);
        if (typeof updateCreditsUI === 'function') updateCreditsUI();
        if (typeof addToBackpack === 'function') addToBackpack('Weapon+ Voucher');
        crawl.stats.security = Math.min(10, Number((crawl.stats && crawl.stats.security) || 0) + 1);
        msg = 'Purchased Weapon+ voucher (-120 Credits).';
      }
    } else if (action === 'mission') {
      openHoldingDistrictMissionPickup(node.id);
      return;
    }
    node.result = msg || node.result;
    crawl.history = Array.isArray(crawl.history) ? crawl.history : [];
    if (msg) {
      crawl.history.unshift(String(node.label || 'District') + ': ' + msg);
      crawl.history = crawl.history.slice(0, 12);
    }
    if (typeof showNotif === 'function' && msg) showNotif(msg, msg.toLowerCase().indexOf('not enough') >= 0 ? 'warn' : 'good');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function runHoldingDistrictActionByKind(kind, action) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var target = crawl.nodes.find(function (entry) { return String(entry.kind || '') === String(kind || ''); })
      || crawl.nodes.find(function (entry) { return !!entry; });
    if (!target) {
      if (typeof showNotif === 'function') showNotif('No active district is available in this holding.', 'warn');
      return;
    }
    crawl.activeNodeId = target.id;
    runHoldingDistrictAction(target.id, action);
  }

  function openHoldingSettlementHexcrawl(holdingType) {
    if (holdingType) {
      var crawl = ensureHoldingSettlementHexcrawl();
      var t = String(holdingType).trim();
      if (t && crawl.holdingType !== t) {
        // New holding type — reset crawl so districts regenerate for this type
        crawl.holdingType = t;
        S.holding.type = t;
        delete S.holding.settlementHexcrawl;
      }
    }
    rerenderHoldingSettlementHexcrawl({ advanceVisit: true });
  }

  function openRegionalSettlementHexcrawl(mode, label) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var regionMode = String(mode || 'holding').toLowerCase();
    var settlementLabel = String(label || '').trim();
    if (regionMode === 'sea') {
      crawl.holdingType = settlementLabel || 'Sea Settlement';
      crawl.vibe = 'A tide-cut settlement of docks, taverns, brokers, and rumor routes under contested harbor control.';
    } else if (regionMode === 'space' || regionMode === 'planet') {
      crawl.holdingType = settlementLabel || 'Space Hub';
      crawl.vibe = 'A pressure-sealed orbital hub where factions bargain, pilots refuel, and covert contracts trade hands.';
      if (regionMode === 'planet') {
        crawl.holdingType = settlementLabel || 'Planet Settlement';
        crawl.vibe = 'A frontier planet settlement balancing colony logistics, survey pressure, and faction contracts.';
      }
    } else if (regionMode === 'ruins') {
      crawl.holdingType = settlementLabel || 'Ruin Encampment';
      crawl.vibe = 'An expedition camp threaded through unstable ruins, salvage claims, and contested shrine law.';
    } else {
      crawl.holdingType = settlementLabel || String(crawl.holdingType || 'Settlement');
    }
    crawl.regionMode = regionMode;
    if (!crawl.timeOfDay) crawl.timeOfDay = 'morning';
    rollHoldingAmbientState(crawl);
    var title = regionMode === 'sea'
      ? 'Sea Settlement Hexcrawl'
      : (regionMode === 'space' ? 'Space Hub Hexcrawl' : (regionMode === 'ruins' ? 'Ruin Encampment Hexcrawl' : 'Holding Settlement Hexcrawl'));
    openModal(title, buildHoldingSettlementHexcrawlModal({ advanceVisit: true }), null, { preventScroll: true, focusTrap: true });
  }

  function openRuinEncampmentHexcrawl(label) {
    openRegionalSettlementHexcrawl('ruins', label);
  }

  function openRuinEncampmentFromProvince(col, row) {
    var ruinLabel = 'Ruin Encampment';
    if (typeof mapData !== 'undefined' && Array.isArray(mapData)) {
      var ruinHex = mapData.find(function (hex) {
        return hex && Number(hex.col) === Number(col) && Number(hex.row) === Number(row) && String(hex.type || '') === 'ruins';
      });
      if (ruinHex && ruinHex.name) ruinLabel = String(ruinHex.name) + ' Encampment';
    }
    openRuinEncampmentHexcrawl(ruinLabel);
  }

  function openSeaSettlementHexcrawl(label) {
    openRegionalSettlementHexcrawl('sea', label);
  }

  function openSpaceHubHexcrawl(label) {
    openRegionalSettlementHexcrawl('space', label);
  }

  function selectHoldingSettlementDistrict(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id || '') === String(nodeId || ''); });
    if (!node) { return; }
    (crawl.nodes || []).forEach(function (entry) {
      if (entry && String(entry.id || '') !== String(node.id || '')) entry.browsePreview = null;
    });
    crawl.activeNodeId = node.id;
    var eventPool = crawl.ambientTables && Array.isArray(crawl.ambientTables.scenes) ? crawl.ambientTables.scenes : [];
    var ev = eventPool.length ? eventPool[Math.floor(Math.random() * eventPool.length)] : 'The district rotates through ordinary traffic and watch shifts.';
    node.result = 'Selected district: ' + String(node.label || 'District') + '. Current scene: ' + ev
      + ' Activity focus: ' + String(node.activity || 'Local movement')
      + '. Rumor focus: ' + String(node.rumor || 'No rumor currently surfaced') + '.';
    if (typeof showNotif === 'function') showNotif(node.label + ': ' + ev, 'info');
    crawl.gamblingActiveNodeId = '';
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function advanceHoldingSettlementTime(hours) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var h = Math.max(1, Number(hours || 1));
    var order = ['morning', 'dusk', 'night'];
    var idx = order.indexOf(String(crawl.timeOfDay || 'morning'));
    if (idx < 0) idx = 0;
    idx = (idx + (h >= 6 ? 2 : 1)) % order.length;
    crawl.timeOfDay = order[idx];
    crawl.stats = crawl.stats || {};
    crawl.stats.fear = Math.max(0, Math.min(10, Number(crawl.stats.fear || 0) + (crawl.timeOfDay === 'night' ? 1 : 0)));
    crawl.stats.security = Math.max(0, Math.min(10, Number(crawl.stats.security || 0) + (crawl.timeOfDay === 'night' ? -1 : 0)));
    rollHoldingAmbientState(crawl);
    if (typeof showNotif === 'function') showNotif('Time advanced to ' + String(crawl.timeOfDay).toUpperCase() + '.', 'info');
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function resolveHoldingSettlementHexNode(nodeId) {
    var crawl = ensureHoldingSettlementHexcrawl();
    var node = crawl.nodes.find(function (entry) { return String(entry.id) === String(nodeId); });
    if (!node || node.explored || !node.revealed) { return; }
    node.explored = true;
    var die = (typeof getEffectiveDie === 'function') ? getEffectiveDie('lead') : ((S.stats && S.stats.lead) || 4);
    var action = explodingRoll(die, { type: 'action', major: true, label: 'Settlement Node LEAD d' + die });
    var dread = explodingRoll(Number(node.dd || 6), { type: 'dread', major: true, label: 'Settlement Node DD' + Number(node.dd || 6) });
    var success = action.total >= dread.total;
    var line = 'Lead d' + die + ' ' + action.total + ' vs DD' + Number(node.dd || 6) + ' ' + dread.total + '. ';
    crawl.stats = crawl.stats || {};
    var holdingType = String(crawl.holdingType || S.holding.type || 'Fortress');
    if (success) {
      var cGain = 20 + Math.floor(Math.random() * 41);
      S.credits = (S.credits || 0) + cGain;
      if (typeof updateCreditsUI === 'function') { updateCreditsUI(); }
      if (typeof changeCounter === 'function') { changeCounter('tmw', 1); }
      if (holdingType === 'Fortress' || holdingType === 'Keep') {
        crawl.stats.security = Math.min(10, Number(crawl.stats.security || 0) + 2);
        crawl.stats.fear = Math.max(0, Number(crawl.stats.fear || 0) - 1);
        crawl.stats.wealth = Math.min(10, Number(crawl.stats.wealth || 0) + 1);
      } else if (holdingType === 'Haven') {
        crawl.stats.wealth = Math.min(10, Number(crawl.stats.wealth || 0) + 2);
        crawl.stats.food = Math.min(10, Number(crawl.stats.food || 0) + 1);
        crawl.stats.security = Math.min(10, Number(crawl.stats.security || 0) + 1);
      } else if (holdingType === 'Citadel') {
        crawl.stats.wealth = Math.min(10, Number(crawl.stats.wealth || 0) + 1);
        crawl.stats.faith = Math.min(10, Number(crawl.stats.faith || 0) + 1);
        crawl.stats.mystery = Math.min(10, Number(crawl.stats.mystery || 0) + 1);
      } else if (holdingType === 'Spire') {
        crawl.stats.mystery = Math.min(10, Number(crawl.stats.mystery || 0) + 2);
        crawl.stats.faith = Math.min(10, Number(crawl.stats.faith || 0) + 1);
        crawl.stats.fear = Math.max(0, Number(crawl.stats.fear || 0) - 1);
      } else {
        crawl.stats.wealth = Math.min(10, Number(crawl.stats.wealth || 0) + 1);
        crawl.stats.security = Math.min(10, Number(crawl.stats.security || 0) + 1);
      }
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome('lead', Math.max(1, action.total - dread.total), {
          actionTotal: action.total,
          dreadTotal: dread.total,
          context: 'Holding district stabilization'
        });
      }
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
      line += 'District stabilized. +' + cGain + ' Credits, +1 Teamwork, Fear reduced.';
    } else {
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome('lead', Math.max(1, dread.total - action.total), {
          actionTotal: action.total,
          dreadTotal: dread.total,
          context: 'Holding district stabilization'
        });
      }
      var failedBy = Math.max(1, Number(dread.total || 0) - Number(action.total || 0));
      if (typeof changeMentalStress === 'function') { changeMentalStress(failedBy); }
      if (typeof addTMWOnFail === 'function') { addTMWOnFail('holding-stabilization-failure', { failedBy: failedBy, actionDie: die, dreadDie: Number(node.dd || 6) }); }
      crawl.stats.fear = Math.min(10, Number(crawl.stats.fear || 0) + 1 + (holdingType === 'Spire' ? 1 : 0));
      if (holdingType === 'Haven') {
        crawl.stats.wealth = Math.max(0, Number(crawl.stats.wealth || 0) - 1);
        crawl.stats.food = Math.max(0, Number(crawl.stats.food || 0) - 1);
      } else if (holdingType === 'Citadel') {
        crawl.stats.faith = Math.max(0, Number(crawl.stats.faith || 0) - 1);
        crawl.stats.security = Math.max(0, Number(crawl.stats.security || 0) - 1);
      } else {
        crawl.stats.security = Math.max(0, Number(crawl.stats.security || 0) - 1);
      }
      line += 'District setback. +' + failedBy + ' Mental Stress, Fear rises, Security drops.';
      S.holding.crises = Array.isArray(S.holding.crises) ? S.holding.crises : [];
      if (Math.random() < 0.4) {
        S.holding.crises.push({
          name: 'District Escalation',
          desc: 'Local pressure rises after a failed district action.',
          resolution: 'Resolve talk/task actions and revisit districts to stabilize the holding.'
        });
      }
    }
    (crawl.edges || []).forEach(function (e) {
      if (e[0] === node.id) {
        var n1 = crawl.nodes.find(function (x) { return x.id === e[1]; });
        if (n1) n1.revealed = true;
      }
      if (e[1] === node.id) {
        var n2 = crawl.nodes.find(function (x) { return x.id === e[0]; });
        if (n2) n2.revealed = true;
      }
    });
    node.result = line;
    if (typeof showNotif === 'function') { showNotif(line, success ? 'good' : 'warn'); }
    rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
  }

  function applyHoldingDowntimeEffect(effect, margin) {
    if (!effect) { return; }
    var failedBy = (window.BTLRules && typeof window.BTLRules.getFailureMargin === 'function') ? window.BTLRules.getFailureMargin({ failedBy: margin }, 1) : Math.max(1, Number(margin || 1));
    if (effect.tmw && typeof changeCounter === 'function') { changeCounter('tmw', effect.tmw); }
    if (effect.renown && typeof changeCounter === 'function') { changeCounter('renown', effect.renown); }
    if (effect.credits) {
      S.credits = (S.credits || 0) + effect.credits;
      if (typeof updateCreditsUI === 'function') { updateCreditsUI(); }
    }
    if (effect.health && typeof changeHealth === 'function') { changeHealth(effect.health === 1 ? failedBy : effect.health); }
    if (effect.mentalStress && typeof changeMentalStress === 'function') { changeMentalStress(effect.mentalStress === 1 ? failedBy : effect.mentalStress); }
    if (effect.focused && typeof toggleCond === 'function' && S.conditions && !S.conditions.focused) { toggleCond('focused'); }
  }

  function resolveHoldingDowntimeEvent(statKey) {
    var evt = S.holding && S.holding.pendingDowntimeEvent;
    if (!evt) { return; }
    var allowedStats = ['lead', 'control', 'mind', 'body', 'spirit', 'defend', 'strike', 'shoot'];
    var requestedKey = String(statKey || '').toLowerCase();
    var key = allowedStats.indexOf(requestedKey) >= 0 ? requestedKey : 'lead';
    var die = (typeof getEffectiveDie === 'function') ? getEffectiveDie(key) : ((S.stats && S.stats[key]) || 4);
    var resolver = (typeof window !== 'undefined' && typeof window.resolveStatVsDreadCheck === 'function') ? window.resolveStatVsDreadCheck : null;
    var fallbackAction = null;
    var fallbackDread = null;
    var result = resolver ? resolver({
      statKey: key,
      statLabel: key.toUpperCase(),
      actionDie: die,
      dreadDie: Math.max(4, Number(evt.dd || 6)),
      allowManual: false,
      context: 'Holding downtime: ' + evt.name,
      actionAdjusters: [function (payload) {
        if (typeof applyUtilityRollDarkPenalty !== 'function') return null;
        var adj = applyUtilityRollDarkPenalty(key, payload.actionTotal);
        return { delta: Number(adj.total || 0) - Number(payload.actionTotal || 0), note: Number(adj.penalty || 0) < 0 ? ('Day penalty ' + Number(adj.penalty || 0)) : '' };
      }]
    }) : null;
    if (!result || result.pending) {
      fallbackAction = explodingRoll(die, { type: 'action', major: true, label: 'Downtime ' + key.toUpperCase() + ' d' + die });
      fallbackDread = explodingRoll(evt.dd || 6, { type: 'dread', major: true, label: 'Downtime DD' + Number(evt.dd || 6) });
      result = {
        rawActionTotal: Number(fallbackAction.total || 0),
        actionTotal: Number(fallbackAction.total || 0),
        dreadTotal: Number(fallbackDread.total || 0),
        success: Number(fallbackAction.total || 0) >= Number(fallbackDread.total || 0),
        modifierNotes: []
      };
    }
    var success = !!result.success;
    var failedBy = Math.max(1, Number(result.dreadTotal || 0) - Number(result.actionTotal || 0));
    var penaltyNote = Array.isArray(result.modifierNotes)
      ? (result.modifierNotes.find(function (note) { return /^Day penalty/.test(String(note || '')); }) || '')
      : '';
    if (success) {
      applyHoldingDowntimeEffect(evt.successEffect);
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome(key, Math.max(1, result.actionTotal - result.dreadTotal), {
          actionTotal: result.actionTotal,
          dreadTotal: result.dreadTotal,
          context: 'Holding downtime: ' + evt.name + (penaltyNote ? (' [' + penaltyNote + ']') : '')
        });
      }
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
    } else {
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome(key, failedBy, {
          actionTotal: result.actionTotal,
          dreadTotal: result.dreadTotal,
          context: 'Holding downtime: ' + evt.name + (penaltyNote ? (' [' + penaltyNote + ']') : '')
        });
      }
      applyHoldingDowntimeEffect(evt.failEffect, failedBy);
      if (typeof addTMWOnFail === 'function') { addTMWOnFail('holding-downtime-failure', { failedBy: failedBy, actionDie: die, dreadDie: Math.max(4, Number(evt.dd || 6)) }); }
    }
    var out = document.getElementById('holdingDowntimeResult');
    if (out) {
      out.innerHTML = '<div style="padding:.35rem .45rem;border:1px solid '+(success?'rgba(76,175,116,.35)':'rgba(201,64,64,.35)')+';background:'+(success?'rgba(76,175,116,.08)':'rgba(201,64,64,.08)')+';">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:'+(success?'var(--green2)':'var(--red2)')+';">'+evt.name+'</div>'
        + '<div style="font-size:.76rem;color:var(--text2);margin-top:.15rem;">'+key.toUpperCase()+' d'+die+'='+Number(result.rawActionTotal||0)+(Number(result.rawActionTotal||0)!==Number(result.actionTotal||0)?('→'+Number(result.actionTotal||0)):'')+' vs DD'+evt.dd+'='+Number(result.dreadTotal||0)+(penaltyNote?(' ('+penaltyNote+')'):'')+'</div>'
        + '<div style="font-size:.76rem;color:var(--gold2);margin-top:.15rem;">'+(success?evt.success:evt.failure)+'</div>'
        + '</div>';
    }
    S.holding.pendingDowntimeEvent = null;
  }

  function rollHoldingDowntimeActivity(activity) {
    ensureNewFeatureState();
    var pool = holdingDowntimeActivityPool(activity);
    var evt = pool[roll(pool.length) - 1];
    S.holding.pendingDowntimeEvent = evt;
    var out = document.getElementById('holdingDowntimeResult');
    if (!out) {
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    var stats = ['lead', 'mind', 'body', 'spirit', 'control', 'strike', 'shoot', 'defend'];
    var mode = String(activity || '').toLowerCase();
    out.innerHTML = '<div style="padding:.35rem .45rem;border:1px solid var(--border2);background:var(--surface);">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--teal);">' + evt.name + '</div>'
      + '<div style="font-size:.76rem;color:var(--muted2);margin-top:.15rem;">Activity roll: choose Action Die vs DD' + evt.dd + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.3rem;">'
      + stats.map(function(key){ return '<button class="btn btn-xs btn-teal" onclick="resolveHoldingDowntimeEvent(\'' + key + '\')">' + key.charAt(0).toUpperCase() + key.slice(1) + '</button>'; }).join('')
      + '</div>'
      + (mode === 'explore' ? '<div style="margin-top:.32rem;"><button class="btn btn-xs btn-primary" onclick="openHoldingSettlementHexcrawl()">Open Settlement Hexcrawl</button></div>' : '')
      + '</div>';
  }

  function rollHoldingDowntimeEvent() {
    ensureNewFeatureState();
    var pool = holdingDowntimeEvents();
    var evt = pool[roll(pool.length)-1];
    S.holding.pendingDowntimeEvent = evt;
    var out = document.getElementById('holdingDowntimeResult');
    if (!out) {
      rerenderHoldingSettlementHexcrawl({ advanceVisit: false });
      return;
    }
    var stats = ['lead','mind','body','spirit','control','strike','shoot','defend'];
    out.innerHTML = '<div style="padding:.35rem .45rem;border:1px solid var(--border2);background:var(--surface);">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.08em;color:var(--gold2);">'+evt.name+'</div>'
      + '<div style="font-size:.76rem;color:var(--muted2);margin-top:.15rem;">Choose Action Die vs DD'+evt.dd+'</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.3rem;">'
      + stats.map(function(key){ return '<button class="btn btn-xs btn-teal" onclick="resolveHoldingDowntimeEvent(\''+key+'\')">'+key.charAt(0).toUpperCase()+key.slice(1)+'</button>'; }).join('')
      + '</div>'
      + '</div>';
  }

  // ── HOLDING FUNCTIONS ─────────────────────────────────────────────────────────
  function getRandomWildernessHexes(count) {
    if (typeof mapData === 'undefined' || !Array.isArray(mapData) || !mapData.length) {
      return [];
    }
    var wild = mapData.filter(function(h) { return h.type === 'wilderness'; });
    if (!wild.length) { return []; }
    var shuffled = wild.slice().sort(function() { return Math.random() - 0.5; });
    return shuffled.slice(0, Math.min(count, shuffled.length)).map(function(h) {
      return { col: h.col, row: h.row };
    });
  }

  function clearHoldingQuestTokens() {
    if (!S.missionTokens) { return; }
    Object.keys(S.missionTokens).forEach(function(k) {
      var t = S.missionTokens[k];
      if (t && (t.missionId === 'holding_quest' || (t.type && t.type.indexOf('holding_') === 0))) {
        delete S.missionTokens[k];
      }
    });
  }

  function placeHoldingQuestTokens() {
    S.missionTokens = S.missionTokens || {};
    clearHoldingQuestTokens();
    var q = S.holdingQuest || {};
    if (!q.active) {
      if (q.holdingHex) {
        S.missionTokens[q.holdingHex.col + ',' + q.holdingHex.row] = { missionId: 'holding_quest', title: 'Establish Your Holding', type: 'holding_home' };
      }
      if (typeof renderHexMap === 'function') { renderHexMap(); }
      return;
    }
    if (q.step <= 0 && q.infoHex) {
      S.missionTokens[q.infoHex.col + ',' + q.infoHex.row] = { missionId: 'holding_quest', title: 'Gather Information', type: 'informer' };
    }
    if (q.step <= 1 && q.siteHex) {
      S.missionTokens[q.siteHex.col + ',' + q.siteHex.row] = { missionId: 'holding_quest', title: 'Go To Site', type: 'site' };
    }
    if (q.step >= 2 && q.holdingHex) {
      S.missionTokens[q.holdingHex.col + ',' + q.holdingHex.row] = { missionId: 'holding_quest', title: 'Your Holding', type: 'holding_home' };
    }
    if (typeof renderHexMap === 'function') { renderHexMap(); }
  }

  function startHoldingQuest() {
    ensureNewFeatureState();
    if (getHoldingGateRenown() < 9) {
      showNotif("Need Renown 9 in any Guild Renown track to begin the Holding quest.", "warn");
      return;
    }
    var spots = getRandomWildernessHexes(2);
    var infoHex = spots[0] || null;
    var siteHex = spots[1] || spots[0] || null;
    S.holdingQuest = {
      active: true,
      step: 0,
      hexId: null,
      infoHex: infoHex,
      siteHex: siteHex,
      holdingHex: null,
      failed: false,
      attempts: ((S.holdingQuest && S.holdingQuest.attempts) || 0) + 1,
      step1Completed: false,
      step1Skipped: false,
      step2Completed: false,
      step3Completed: false,
      bonus: 0,
      infoFeature: null,
      additionalDanger: null,
      siteRooms: null,
      securityCount: 0,
      rewardCredits: 250,
      rewardLoot: []
    };
    placeHoldingQuestTokens();
    updateHoldingTabVisibility();
    renderHoldingUI();
    if (typeof renderMissionBoard === 'function') { renderMissionBoard(); }
    if (typeof renderMissionTracker === 'function') { renderMissionTracker(); }
    if (typeof renderQP === 'function') { renderQP('missions'); }
    showNotif("Holding Establishment Quest begun!", "good");
  }

  function holdingQuestRollFeature() {
    var table = [
      { icon: '\ud83d\udce6', name: 'Hidden Cache', effectDesc: 'Gain bonus loot when the Holding is secured.' },
      { icon: '\ud83d\udeaa', name: 'Back Entrance', effectDesc: 'Security is easier to bypass during setup.' },
      { icon: '\u2728', name: 'Local Support', effectDesc: 'Your retainers gain confidence in your claim.' },
      { icon: '\u2697', name: 'Recovered Records', effectDesc: 'Old deeds validate your Holding claim.' },
      { icon: '\ud83d\udcbb', name: 'Survey Data', effectDesc: 'You identify the safest foundation points.' },
      { icon: '\ud83d\udee1', name: 'Defensible Terrain', effectDesc: 'Your claim starts with stronger perimeter control.' }
    ];
    return table[roll(6) - 1];
  }

  function holdingQuestRollDanger() {
    var table = [
      { name: 'Mercenary Patrol', desc: 'A roaming patrol contests your claim.' },
      { name: 'Rival Claimant', desc: 'Another faction challenges your right to settle.' },
      { name: 'Hostile Terrain', desc: 'Collapse zones and hidden hazards slow setup.' },
      { name: 'Supply Shortage', desc: 'Establishment costs and pressure increase.' },
      { name: 'Raider Scouts', desc: 'Scouts map your camp before confrontation.' },
      { name: 'Warden Scrutiny', desc: 'Authorities demand proof and military readiness.' }
    ];
    return table[roll(6) - 1];
  }

  function holdingQuestStartStep1() {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }
    if (q.step1Completed) { showNotif('Step 1 already completed.', 'warn'); return; }

    var advDie = 8;
    var dreadDie = 8;
    var a = explodingRoll(advDie, { type: 'action', major: true, label: 'Holding Step 1 AD' + advDie });
    var d = explodingRoll(dreadDie, { type: 'dread', major: true, label: 'Holding Step 1 DD' + dreadDie });
    var success = a.total >= d.total;
    var rolled = success ? holdingQuestRollFeature() : holdingQuestRollDanger();
    var encoded = encodeURIComponent(JSON.stringify(rolled));

    var resultHtml = success
      ? '<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.45rem .55rem;margin-bottom:.45rem;">'
        + '<div style="font-size:.74rem;color:var(--teal);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;">Hidden Feature Revealed</div>'
        + '<div style="font-size:.82rem;color:var(--text2);margin-top:.15rem;">' + rolled.icon + ' ' + rolled.name + ' — ' + rolled.effectDesc + '</div>'
        + '</div>'
      : '<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.45rem .55rem;margin-bottom:.45rem;">'
        + '<div style="font-size:.74rem;color:var(--red2);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;">Additional Danger</div>'
        + '<div style="font-size:.82rem;color:var(--text2);margin-top:.15rem;">' + rolled.name + ' — ' + rolled.desc + '</div>'
        + '</div>';

    var html = '<div style="font-size:.84rem;color:var(--muted3);margin-bottom:.5rem;line-height:1.5;">'
      + '<strong style="color:var(--gold2);">Step 1: Gather Information</strong> — optional. Success grants +5 bonus and reveals a hidden feature. Failure introduces Additional Danger. You may also skip.'
      + '</div>'
      + '<div style="background:var(--surface);border:1px solid var(--border2);padding:.5rem .6rem;margin-bottom:.45rem;">'
      + '<div style="font-size:.76rem;color:var(--muted2);margin-bottom:.3rem;">Valor d' + advDie + ' vs Dread d' + dreadDie + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.3rem;">'
      + '<div style="text-align:center;"><div style="font-size:.7rem;color:var(--teal);text-transform:uppercase;">Your Roll</div><div style="font-family:\'Rajdhani\',sans-serif;font-size:1.8rem;font-weight:700;color:var(--teal);">' + a.total + '</div></div>'
      + '<div style="text-align:center;"><div style="font-size:.7rem;color:var(--red2);text-transform:uppercase;">Dread Roll</div><div style="font-family:\'Rajdhani\',sans-serif;font-size:1.8rem;font-weight:700;color:var(--red);">' + d.total + '</div></div>'
      + '</div>'
      + '<div style="text-align:center;font-family:\'Cinzel\',serif;font-size:.76rem;color:' + (success ? 'var(--green2)' : 'var(--red2)') + ';">'
      + (success ? '\u2713 Information gathered — +5 bonus secured' : '\u2717 Contacts run dry — Additional Danger incoming')
      + '</div></div>'
      + resultHtml
      + buildNestedModalActionRow(
        '<button class="btn btn-sm" onclick="skipHoldingQuestStep1();closeModal();">Skip This Step</button>'
        + '<button class="btn btn-sm btn-teal" onclick="completeHoldingQuestStep1(' + success + ',decodeURIComponent(\'' + encoded + '\'));closeModal();">Confirm</button>',
        { cancelLabel: 'Close' }
      );
    openModal('Step 1 — Gather Information', html, null, { preventScroll: true, focusTrap: true });
  }

  function completeHoldingQuestStep1(success, encodedResult) {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }

    q.step1Completed = true;
    q.step1Skipped = false;
    q.step = 1;
    if (success) {
      q.bonus = 5;
      q.infoFeature = typeof encodedResult === 'string' ? JSON.parse(encodedResult) : encodedResult;
      showNotif('Step 1 complete: +5 Holding quest bonus.', 'good');
    } else {
      q.additionalDanger = typeof encodedResult === 'string' ? JSON.parse(encodedResult) : encodedResult;
      q.bonus = 0;
      showNotif('Step 1 complete: Additional Danger added.', 'warn');
    }
    placeHoldingQuestTokens();
    renderHoldingUI();
    if (typeof renderMissionBoard === 'function') { renderMissionBoard(); }
    if (typeof renderMissionTracker === 'function') { renderMissionTracker(); }
  }

  function skipHoldingQuestStep1() {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }
    q.step1Completed = true;
    q.step1Skipped = true;
    q.bonus = 0;
    q.step = 1;
    placeHoldingQuestTokens();
    renderHoldingUI();
    if (typeof renderMissionBoard === 'function') { renderMissionBoard(); }
    if (typeof renderMissionTracker === 'function') { renderMissionTracker(); }
  }

  function holdingQuestStartStep2() {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }
    if (!q.step1Completed) { showNotif('Complete or skip Step 1 first.', 'warn'); return; }
    if (q.step2Completed) { showNotif('Step 2 already completed.', 'warn'); return; }

    if (!Array.isArray(q.siteRooms) || !q.siteRooms.length) {
      var roomCount = roll(5) + 1;
      q.siteRooms = [];
      for (var i = 0; i < roomCount; i++) {
        q.siteRooms.push({
          label: 'Room ' + (i + 1) + ': ' + pick(['Collapsed Hall', 'Guard Post', 'Storage Vault', 'Barracks', 'Watch Deck', 'Foundation Chamber', 'Ruined Entrance', 'Supply Hall']),
          explored: false,
          find: null,
          confrontTriggered: false,
          confrontResolved: false
        });
      }
    } else if (typeof q.siteRooms[0] === 'string') {
      q.siteRooms = q.siteRooms.map(function(label) {
        return {
          label: label,
          explored: false,
          find: null,
          confrontTriggered: false,
          confrontResolved: false
        };
      });
    }

    holdingQuestRenderSiteModal();
  }

  function holdingQuestRenderSiteModal() {
    var q = S.holdingQuest;
    if (!q || !q.active || !Array.isArray(q.siteRooms)) { return; }

    var dangerHtml = q.additionalDanger
      ? '<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.35rem .5rem;margin-bottom:.4rem;font-size:.76rem;color:var(--muted3);"><strong style="color:var(--red2);">\u26A0 Additional Danger:</strong> ' + q.additionalDanger.name + ' — ' + q.additionalDanger.desc + '</div>'
      : '';

    var roomsHtml = '<div style="font-family:\'Cinzel\',serif;font-size:.58rem;letter-spacing:.1em;color:var(--gold2);text-transform:uppercase;margin-bottom:.3rem;">Site Layout — ' + q.siteRooms.length + ' Rooms</div>';
    q.siteRooms.forEach(function(room, idx) {
      var explored = !!room.explored;
      var confrontActive = !!(room.confrontTriggered && !room.confrontResolved);
      var findHtml = '';
      if (explored && room.find) {
        var findColor = room.find.type === 'trap' ? 'var(--red2)' : room.find.type === 'cache' ? 'var(--green2)' : 'var(--muted3)';
        findHtml = '<div style="font-size:.7rem;color:' + findColor + ';margin-top:.2rem;padding-top:.2rem;border-top:1px dashed var(--border);">' + room.find.text + '</div>';
      }
      var actionBtn = '';
      if (!explored) {
        actionBtn = '<button class="btn btn-xs btn-teal" onclick="holdingQuestExploreRoom(' + idx + ')" style="margin-top:.2rem;">Investigate</button>';
      } else if (confrontActive) {
        actionBtn = '<div style="margin-top:.2rem;display:flex;gap:.25rem;flex-wrap:wrap;align-items:center;"><div style="font-size:.7rem;color:var(--red2);font-weight:700;">\u26A1 Confrontation triggered!</div><button class="btn btn-xs btn-red" onclick="holdingQuestResolveRoomConfrontation(' + idx + ',false)">Fail</button><button class="btn btn-xs btn-primary" onclick="holdingQuestResolveRoomConfrontation(' + idx + ',true)">Succeed</button></div>';
      }
      roomsHtml += '<div style="padding:.3rem .4rem;margin-bottom:.25rem;border:1px solid ' + (confrontActive ? 'var(--red2)' : explored ? 'var(--border)' : 'var(--border2)') + ';background:' + (confrontActive ? 'rgba(200,50,50,.05)' : 'var(--surface)') + ';">'
        + '<div style="font-size:.75rem;color:' + (explored ? 'var(--muted2)' : 'var(--text)') + ';">' + (explored ? '\u2713 ' : '') + room.label + '</div>'
        + findHtml + actionBtn
        + '</div>';
    });

    var allExplored = q.siteRooms.every(function(r){ return !!r.explored; });
    var hasActive = q.siteRooms.some(function(r){ return !!(r.confrontTriggered && !r.confrontResolved); });
    var actionButtons = '';
    if (!hasActive) {
      actionButtons = buildNestedModalActionRow(
        '<button class="btn btn-sm ' + (allExplored ? 'btn-teal' : '') + '" onclick="completeHoldingQuestStep2();closeModal();">' + (allExplored ? 'Proceed to Confrontation' : 'Skip Remaining Rooms → Confrontation') + '</button>',
        { cancelLabel: 'Close' }
      );
    } else {
      actionButtons = buildNestedModalActionRow('', { includeCancel: false, goBackLabel: 'Go Back' });
    }

    var html = dangerHtml
      + '<div style="font-size:.84rem;color:var(--muted3);margin-bottom:.45rem;">Step 2 — Site Layout — 2-6 Rooms</div>'
      + roomsHtml
      + '<div style="margin-top:.45rem;">' + actionButtons + '</div>';
    openModal('Step 2 — Go to Site', html, null, { preventScroll: true, focusTrap: true });
  }

  function holdingQuestExploreRoom(roomIdx) {
    var q = S.holdingQuest;
    if (!q || !q.active || !q.siteRooms || !q.siteRooms[roomIdx]) { return; }
    var room = q.siteRooms[roomIdx];
    if (room.explored) { return; }
    room.explored = true;
    var r = roll(6);
    if (r === 1) {
      room.confrontTriggered = true;
      room.find = { type: 'confront', text: '\u26A1 Security squad spotted you in this room! Resolve below.' };
    } else if (r <= 3) {
      room.find = { type: 'trap', text: pick(['TRAP — Unstable flooring: take +1 Stress if you linger.', 'TRAP — Alarm tripline: security gets ready for final stand.', 'TRAP — Toxic burst: Body test later or start wounded.']) };
    } else if (r === 4) {
      room.find = { type: 'puzzle', text: pick(['PUZZLE — Broken lock mechanism conceals a route.', 'PUZZLE — Ciphered route notes hint at a weak flank.', 'PUZZLE — Foundation diagram reveals hidden support paths.']) };
    } else if (r === 5) {
      room.find = { type: 'cache', text: 'CACHE — ' + pick(['Emergency rations and maps.', 'Old claim records proving ownership.', 'Unused construction supplies and coin pouches.']) };
    } else {
      room.find = { type: 'flavor', text: pick(['Quiet corridor with old banners.', 'A ruined chamber once used as barracks.', 'A half-collapsed hall overlooking the valley.']) };
    }
    holdingQuestRenderSiteModal();
  }

  function holdingQuestResolveRoomConfrontation(roomIdx, success) {
    var q = S.holdingQuest;
    if (!q || !q.active || !q.siteRooms || !q.siteRooms[roomIdx]) { return; }
    var room = q.siteRooms[roomIdx];
    room.confrontResolved = true;
    if (!success) {
      S.renown = Math.max(0, (S.renown || 0) - 1);
      if (typeof updateRenown === 'function') { updateRenown(); }
      showNotif('Room confrontation failed. −1 Renown.', 'warn');
    } else {
      showNotif('Room confrontation succeeded!', 'good');
    }
    holdingQuestRenderSiteModal();
  }

  function completeHoldingQuestStep2() {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }
    q.step2Completed = true;
    q.step = 2;
    q.holdingHex = q.siteHex || q.holdingHex || q.infoHex || null;
    placeHoldingQuestTokens();
    renderHoldingUI();
    if (typeof renderMissionBoard === 'function') { renderMissionBoard(); }
    if (typeof renderMissionTracker === 'function') { renderMissionTracker(); }
  }

  function holdingQuestStartStep3() {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }
    if (!q.step2Completed) { showNotif('Complete Step 2 first.', 'warn'); return; }

    if (!q.securityCount) {
      q.securityCount = 2;
    }

    var dangerBanner = q.additionalDanger
      ? '<div style="background:rgba(200,50,50,.07);border:1px solid rgba(200,50,50,.35);padding:.3rem .5rem;margin-bottom:.45rem;font-size:.74rem;"><strong style="color:var(--red2);">\u26A0 ' + q.additionalDanger.name + '</strong> <span style="color:var(--muted3);">— ' + q.additionalDanger.desc + '</span></div>'
      : '';
    var featureBadge = q.infoFeature
      ? '<div style="font-size:.7rem;color:var(--teal);margin-bottom:.35rem;padding:.2rem .4rem;border:1px solid rgba(46,196,182,.3);">' + q.infoFeature.icon + ' ' + q.infoFeature.name + ' — ' + q.infoFeature.effectDesc + '</div>'
      : '';
    var securityRows = '';
    for (var si = 0; si < q.securityCount; si++) {
      securityRows += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:.74rem;color:var(--muted3);padding:.15rem 0;border-bottom:1px solid var(--border);"><span>Security Unit ' + (si + 1) + '</span><span style="color:var(--red2);font-family:\'Rajdhani\',sans-serif;font-weight:700;">DD8 | 16 HP</span></div>';
    }
    var securitySection = '<div style="margin-bottom:.4rem;"><div style="font-family:\'Cinzel\',serif;font-size:.56rem;letter-spacing:.1em;color:var(--red2);text-transform:uppercase;margin-bottom:.15rem;">Security (' + q.securityCount + ' Units)</div>' + securityRows + '</div>';
    var rollInstr = '<div style="background:var(--surface);border:1px solid var(--border2);padding:.4rem .55rem;margin-bottom:.45rem;"><div style="font-size:.8rem;color:var(--text2);margin-bottom:.2rem;">Confrontation: 2 Security + Roll Valor d8 + 5 vs Dread d8 — then click your outcome Success or Failure.</div><div style="font-size:.7rem;color:var(--muted);">Use the Dice tab or physical dice, then choose Success/Failure below.</div></div>';

    var html = dangerBanner + featureBadge + securitySection + rollInstr
      + buildNestedModalActionRow(
        '<button class="btn btn-sm btn-red" onclick="openHoldingQuestFailureOutcomeModal()">\u2717 Failure — Roll Failed</button>'
        + '<button class="btn btn-sm btn-primary" onclick="resolveHoldingQuestOutcome(true)">\u2713 Success — Roll Succeeded</button>',
        { cancelLabel: 'Close', cancelUsesClose: true }
      );
    openModal('Step 3 — Confrontation', html, null, { preventScroll: true, focusTrap: true });
  }

  function stepHoldingQuestDreadDie(current, dir) {
    var dice = [4, 6, 8, 10, 12, 20];
    var die = Number(current || 8);
    var idx = dice.indexOf(die);
    if (idx < 0) idx = 2;
    var next = idx + (dir > 0 ? 1 : -1);
    if (next < 0) next = 0;
    if (next >= dice.length) next = dice.length - 1;
    return dice[next];
  }

  function normalizeHoldingQuestConditionByStat(statKey, positive) {
    var key = String(statKey || 'valor').toLowerCase();
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

  function applyHoldingQuestCondition(condKey) {
    if (!condKey || typeof S === 'undefined') return;
    if (typeof toggleCond === 'function' && S.conditions && !S.conditions[condKey]) {
      try { toggleCond(condKey); return; } catch (_err) { console.error(_err); }
    }
    if (typeof applyNegativeCondition === 'function' && (condKey === 'weakened' || condKey === 'vulnerable' || condKey === 'shaken' || condKey === 'distracted')) {
      try { applyNegativeCondition(condKey); return; } catch (_err2) { console.error(_err2); }
    }
    if (typeof applyPositiveCondition === 'function') {
      try { applyPositiveCondition(condKey); return; } catch (_err3) { console.error(_err3); }
    }
    S.conditions = S.conditions || {};
    S.conditions[condKey] = true;
  }

  function addHoldingQuestRadiation(amount) {
    var ticks = Math.max(1, Number(amount || 1));
    if (typeof S === 'undefined') return;
    if (S.radiationState && typeof S.radiationState === 'object') {
      S.radiationState.gainTicks = Math.max(0, Number(S.radiationState.gainTicks || 0) + ticks);
      return;
    }
    S.radiationExposure = Math.max(0, Number(S.radiationExposure || 0) + ticks);
  }

  function getHoldingQuestManualRollPair(defaultDread) {
    var actionEl = document.getElementById('manualActionValue');
    var dreadEl = document.getElementById('manualDreadValue');
    var action = Number(actionEl && actionEl.value);
    var dread = Number(dreadEl && dreadEl.value);
    if (!Number.isFinite(action) || !Number.isFinite(dread)) {
      return { action: 0, dread: Math.max(4, Number(defaultDread || 8)), inferred: true };
    }
    return { action: action, dread: Math.max(4, dread), inferred: false };
  }

  function applyHoldingQuestFailureConsequences(check, options) {
    var cfg = options || {};
    var actionTotal = Number(check && check.actionTotal || 0);
    var dreadTotal = Number(check && check.dreadTotal || 8);
    var margin = Math.max(1, dreadTotal - actionTotal);
    var applyChanges = !cfg.preview;
    var notes = [];
    if (applyChanges) {
      if (typeof changeHealth === 'function') changeHealth(margin);
      else if (typeof changeStress === 'function') changeStress(margin);
    }
    notes.push((typeof changeHealth === 'function' ? 'Damage +' : 'Stress +') + margin + ' (difference)');

    if (applyChanges) {
      if (typeof changeMentalStress === 'function') changeMentalStress(margin);
      else if (typeof changeStress === 'function') changeStress(margin);
    }
    notes.push('Mental Stress +' + margin);

    if (applyChanges) addHoldingQuestRadiation(margin);
    notes.push('Radiation +' + margin);

    var negCond = normalizeHoldingQuestConditionByStat('valor', false);
    if (applyChanges) applyHoldingQuestCondition(negCond);
    notes.push('Condition ' + negCond);

    if (applyChanges) {
      if (typeof changeCounter === 'function') changeCounter('tmw', 1);
      else S.tmw = Math.max(0, Number(S.tmw || 0) + 1);
    }
    notes.push('+1 Teamwork');

    return {
      margin: margin,
      notes: notes,
      summary: notes.join(', ')
    };
  }

  function openHoldingQuestFailureOutcomeModal() {
    if (typeof openModal !== 'function') return false;
    var check = getHoldingQuestManualRollPair(8);
    var consequence = applyHoldingQuestFailureConsequences({ actionTotal: check.action, dreadTotal: check.dread }, { preview: true });
    var pushDread = stepHoldingQuestDreadDie(check.dread || 8, 1);
    var tmw = Number((S && S.tmw) || 0);
    window._pendingHoldingQuestFailure = {
      actionTotal: Number(check.action || 0),
      dreadTotal: Number(check.dread || 8),
      pushDread: pushDread
    };
    var html = ''
      + '<div style="font-size:.82rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:Cinzel,serif;font-size:.9rem;color:#ff8a72;margin-bottom:.2rem;">Confrontation Failure</div>'
      + '<div style="margin-bottom:.3rem;"><strong>Consequence Preview:</strong> ' + consequence.summary + '</div>'
      + '<div style="font-size:.75rem;color:var(--muted2);margin-bottom:.35rem;">'
      + (check.inferred ? 'No manual dice values detected; difference defaults to at least 1.' : ('Manual roll seen: Valor ' + check.action + ' vs Dread ' + check.dread + '.'))
      + '</div>'
      + '<div style="font-size:.77rem;color:var(--text2);margin-bottom:.4rem;"><strong>Push Luck:</strong> spend <strong>2 Teamwork</strong>, reroll at higher dread <strong>d' + pushDread + '</strong>. Success grants a positive condition; failure applies the consequence line above.</div>'
      + buildNestedModalActionRow(
        '<button class="btn btn-sm btn-warn" onclick="acceptHoldingQuestFailureOutcome()">Accept Failure</button>'
        + '<button class="btn btn-sm btn-teal" ' + (tmw >= 2 ? '' : "disabled title='Need 2 Teamwork'") + ' onclick="pushHoldingQuestLuckOutcome()">Push Luck (2 Teamwork)</button>',
        { cancelLabel: 'Close', cancelUsesClose: true }
      )
      + '</div>';
    openModal('Holding Confrontation Failure', html, null, { preventScroll: true, focusTrap: true });
    return true;
  }

  function acceptHoldingQuestFailureOutcome() {
    var pending = window._pendingHoldingQuestFailure || {};
    applyHoldingQuestFailureConsequences({
      actionTotal: Number(pending.actionTotal || 0),
      dreadTotal: Number(pending.dreadTotal || 8)
    }, { preview: false });
    window._pendingHoldingQuestFailure = null;
    resolveHoldingQuestOutcome(false);
  }

  function pushHoldingQuestLuckOutcome() {
    if (typeof S === 'undefined') return;
    var tmw = Number(S.tmw || 0);
    if (tmw < 2) {
      if (typeof showNotif === 'function') showNotif('Need 2 Teamwork to Push Luck.', 'warn');
      return;
    }
    if (typeof changeCounter === 'function') changeCounter('tmw', -2);
    else S.tmw = Math.max(0, tmw - 2);

    var pending = window._pendingHoldingQuestFailure || {};
    var pushDread = Number(pending.pushDread || stepHoldingQuestDreadDie(pending.dreadTotal || 8, 1));
    if (typeof openModal === 'function') {
      openModal('Push Luck — Holding Confrontation',
        '<div style="font-size:.82rem;color:var(--text2);line-height:1.58;">'
          + '<div style="margin-bottom:.28rem;"><strong>Reroll now:</strong> Valor vs <strong>Dread d' + pushDread + '</strong>.</div>'
          + '<div style="font-size:.73rem;color:var(--muted2);margin-bottom:.4rem;">Use your reroll result, then choose the matching outcome below.</div>'
          + buildNestedModalActionRow(
              '<button class="btn btn-sm btn-red" onclick="resolveHoldingQuestPushLuck(false)">Push Luck Failed</button>'
              + '<button class="btn btn-sm btn-primary" onclick="resolveHoldingQuestPushLuck(true)">Push Luck Succeeded</button>',
              { cancelLabel: 'Close', cancelUsesClose: true }
            )
        + '</div>',
        null,
        { preventScroll: true, focusTrap: true }
      );
    }
  }

  function resolveHoldingQuestPushLuck(success) {
    var pending = window._pendingHoldingQuestFailure || {};
    var reroll = getHoldingQuestManualRollPair(Number(pending.pushDread || 10));
    window._pendingHoldingQuestFailure = null;
    if (success) {
      var posCond = normalizeHoldingQuestConditionByStat('valor', true);
      applyHoldingQuestCondition(posCond);
      if (typeof showNotif === 'function') showNotif('Push Luck succeeded. Condition gained: ' + posCond + '.', 'good');
      resolveHoldingQuestOutcome(true);
      return;
    }
    applyHoldingQuestFailureConsequences({ actionTotal: reroll.action, dreadTotal: reroll.dread }, { preview: false });
    if (typeof showNotif === 'function') showNotif('Push Luck failed at higher dread. Failure consequences applied.', 'warn');
    resolveHoldingQuestOutcome(false);
  }

  function resolveHoldingQuestOutcome(success) {
    try { if (typeof closeModal === 'function') closeModal(); } catch (err) { console.error(err); }
    resolveHoldingQuestStep3(success);
  }

  function resolveHoldingQuestStep3(success) {
    ensureNewFeatureState();
    var q = S.holdingQuest;
    if (!q || !q.active) { return; }

    if (!success) {
      q.active = false;
      q.failed = true;
      q.step3Completed = false;
      q.step2Completed = false;
      q.step = 0;
      clearHoldingQuestTokens();
      if (typeof renderHexMap === 'function') { renderHexMap(); }
      showNotif('Holding quest failed. Retry from Available Quests.', 'warn');
      renderHoldingUI();
      if (typeof renderMissionBoard === 'function') { renderMissionBoard(); }
      if (typeof renderMissionTracker === 'function') { renderMissionTracker(); }
      if (typeof renderQP === 'function') { renderQP('missions'); }
      return;
    }

    q.step3Completed = true;
    q.step = 3;
    q.active = false;
    q.failed = false;

    S.renown = (S.renown || 0) + 1;
    try { if (typeof updateRenown === 'function') { updateRenown(); } } catch (err) { console.error(err); }
    S.credits = (S.credits || 0) + (q.rewardCredits || 250);
    try { if (typeof updateCreditsUI === 'function') { updateCreditsUI(); } } catch (err) { console.error(err); }

    var loot = [];
    try {
      if (typeof rollForLoot === 'function') {
        loot = rollForLoot('challenging') || [];
      }
    } catch (err) {
      loot = [];
    }
    q.rewardLoot = loot.slice();
    if (typeof addToBackpack === 'function') {
      for (var li = 0; li < loot.length; li++) {
        try { addToBackpack(loot[li]); } catch (err) { console.error(err); }
      }
    }

    if (!Array.isArray(S.completedMissions)) { S.completedMissions = []; }
    if (S.completedMissions.length >= 10) { S.completedMissions.shift(); }
    S.completedMissions.push({
      id: 'holding-quest-' + Date.now(),
      title: 'Establish Your Holding',
      difficulty: 'special',
      location: 'Province',
      success: true,
      reward: (q.rewardCredits || 250),
      loot: loot.slice(),
      infoFeature: q.infoFeature || null,
      additionalDanger: q.additionalDanger || null,
      completedAt: new Date().toISOString(),
      isHoldingQuest: true
    });
    
    // AUDIO: Mission complete
    if (typeof window.AudioManager !== 'undefined') {
      window.AudioManager.missionComplete();
    }
    if (window.TrophySystem) window.TrophySystem.check('first_mission');

    if (!S.holding.name) {
      rollHoldingName();
    }
    if (!S.holding.name) {
      S.holding.name = 'New Holding';
    }
    S.holding.established = true;
    q.holdingHex = q.holdingHex || q.siteHex || q.infoHex || null;
    try { placeHoldingQuestTokens(); } catch (err) { console.error(err); }
    try { updateHoldingTabVisibility(); } catch (err) { console.error(err); }
    try { renderHoldingUI(); } catch (err) { console.error(err); }
    try { if (typeof renderMissionBoard === 'function') { renderMissionBoard(); } } catch (err) { console.error(err); }
    try { if (typeof renderMissionTracker === 'function') { renderMissionTracker(); } } catch (err) { console.error(err); }
    try { if (typeof renderCompletedMissions === 'function') { renderCompletedMissions(); } } catch (err) { console.error(err); }
    try { if (typeof renderQP === 'function') { renderQP('missions'); } } catch (err) { console.error(err); }

    try { showNotif('Holding established! +1 Renown · +' + (q.rewardCredits || 250) + '₵' + (loot.length ? ' · Loot: ' + loot.join(', ') : ''), 'good'); } catch (err) { console.error(err); }

    try {
      if (typeof setContext === 'function') {
        var holdingCtxBtn = document.querySelector('.ctx-btn[onclick*="setContext(\'holding\'"]');
        setContext('holding', holdingCtxBtn || null);
      }
    } catch (err) { console.error(err); }
    try {
      if (typeof switchTab === 'function') {
        var holdingTabBtn = document.querySelector("button.tab-btn[onclick*=\"switchTab('holding'\"]");
        switchTab('holding', holdingTabBtn || null);
      }
    } catch (err) { console.error(err); }
  }

  function advanceHoldingQuest() {
    var q = S.holdingQuest || {};
    if (!q.active) { return; }
    if (!q.step1Completed) { holdingQuestStartStep1(); return; }
    if (!q.step2Completed) { holdingQuestStartStep2(); return; }
    holdingQuestStartStep3();
  }

  function getHoldingQuestBoardCardHtml() {
    ensureNewFeatureState();
    var q = S.holdingQuest || {};
    var renown = getHoldingGateRenown();
    var questDone = !!(q.step3Completed && !q.failed);
    var holdingEstablished = S.holding && (S.holding.established || questDone);
    if (renown < 9 || holdingEstablished) { return ''; }

    if (!q.active) {
      return '<div class="shop-card" style="display:flex;flex-direction:column;border-color:var(--gold);background:rgba(201,162,39,.05);">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.5rem;letter-spacing:.12em;color:var(--gold2);text-transform:uppercase;margin-bottom:.18rem;">LORD\'S CALLING</div>'
        + '<div class="s-name" style="color:var(--gold);">Establish Your Holding</div>'
        + '<div style="font-size:.78rem;color:var(--muted3);flex:1;margin:.2rem 0;line-height:1.45;">Complete a mission-style 3-step quest to claim your domain in the Province.</div>'
        + (q.failed ? '<div style="font-size:.74rem;color:var(--red2);margin:.15rem 0;">Previous attempt failed. You can retry now.</div>' : '')
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem;padding-top:.3rem;border-top:1px solid var(--border);">'
        + '<span style="font-family:\'Rajdhani\',sans-serif;font-weight:700;font-size:.78rem;color:var(--gold2);">Special Quest</span>'
        + '<button class="btn btn-xs btn-teal" onclick="startHoldingQuest()">Begin \u2192</button>'
        + '</div>'
        + '</div>';
    }

    var s1Done = !!q.step1Completed;
    var s2Done = !!q.step2Completed;
    var s3Done = !!q.step3Completed;
    var btn1 = s1Done
      ? '<button class="btn btn-xs" style="opacity:.45;cursor:default;" disabled>\u2713 Info</button>'
      : '<button class="btn btn-xs btn-teal" onclick="holdingQuestStartStep1()">\u25B6 Info</button><button class="btn btn-xs" onclick="skipHoldingQuestStep1()" style="font-size:.62rem;">Skip</button>';
    var btn2 = s2Done
      ? '<button class="btn btn-xs" style="opacity:.45;cursor:default;" disabled>\u2713 Site</button>'
      : '<button class="btn btn-xs btn-teal" onclick="holdingQuestStartStep2()"' + (!s1Done ? ' disabled style="opacity:.45;"' : '') + '>\u25B6 Site</button>';
    var btn3 = s3Done
      ? '<button class="btn btn-xs" style="opacity:.45;cursor:default;" disabled>\u2713 Confront</button>'
      : '<button class="btn btn-xs btn-primary" onclick="holdingQuestStartStep3()"' + (!s2Done ? ' disabled style="opacity:.45;"' : '') + '>\u25B6 Confront</button>';

    return '<div class="shop-card" style="display:flex;flex-direction:column;border-color:var(--teal);background:rgba(46,196,182,.05);">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.5rem;letter-spacing:.12em;color:var(--teal);text-transform:uppercase;margin-bottom:.18rem;">IN PROGRESS</div>'
      + '<div class="s-name" style="color:var(--teal);">Establish Your Holding</div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin:.15rem 0;">Step 1-3 flow matches Missions tab progression.</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;">' + btn1 + btn2 + btn3 + '</div>'
      + '</div>';
  }

  function getHoldingQuestTrackerCardHtml() {
    ensureNewFeatureState();
    var q = S.holdingQuest || {};
    var questDone = !!(q.step3Completed && !q.failed);
    var holdingEstablished = S.holding && (S.holding.established || questDone);
    if (!q.active || holdingEstablished) { return ''; }

    var s1 = { completed: !!q.step1Completed, skipped: !!q.step1Skipped };
    var s2 = { completed: !!q.step2Completed };
    var s3 = { completed: !!q.step3Completed };
    var steps = [s1, s2, s3];
    var labels = {1:'Gather Info',2:'Go to Site',3:'Confrontation'};
    var stepsHtml = [1,2,3].map(function(n) {
      var step = steps[n - 1];
      var isActive = (n === 1 && !s1.completed) || (n === 2 && s1.completed && !s2.completed) || (n === 3 && s2.completed && !s3.completed);
      var color = step.completed ? 'var(--green2)' : isActive ? 'var(--teal)' : 'var(--border2)';
      var textCol = step.completed ? 'var(--muted2)' : isActive ? 'var(--text)' : 'var(--muted)';
      var marker = step.completed ? (step.skipped ? '\u2014' : '\u2713') : String(n);
      return '<div style="display:flex;align-items:center;gap:.3rem;padding:.15rem .2rem;">'
        + '<div style="width:1.3rem;height:1.3rem;border-radius:50%;border:1.5px solid ' + color + ';display:flex;align-items:center;justify-content:center;font-size:.65rem;color:' + color + ';flex-shrink:0;">' + marker + '</div>'
        + '<div style="font-size:.75rem;color:' + textCol + ';">' + labels[n] + (n === 1 ? ' <span style="color:var(--muted);font-size:.62rem;">[optional]</span>' : '') + '</div>'
        + '</div>';
    }).join('');

    var btn1 = s1.completed
      ? '<button class="btn btn-xs" style="opacity:.45;cursor:default;" disabled>\u2713 Info</button>'
      : '<button class="btn btn-xs btn-teal" onclick="holdingQuestStartStep1()">\u25B6 Info</button><button class="btn btn-xs" onclick="skipHoldingQuestStep1()" style="font-size:.62rem;">Skip</button>';
    var btn2 = s2.completed
      ? '<button class="btn btn-xs" style="opacity:.45;cursor:default;" disabled>\u2713 Site</button>'
      : '<button class="btn btn-xs btn-teal" onclick="holdingQuestStartStep2()"' + (!s1.completed ? ' disabled style="opacity:.45;"' : '') + '>\u25B6 Site</button>';
    var btn3 = s3.completed
      ? '<button class="btn btn-xs" style="opacity:.45;cursor:default;" disabled>\u2713 Confront</button>'
      : '<button class="btn btn-xs btn-primary" onclick="holdingQuestStartStep3()"' + (!s2.completed ? ' disabled style="opacity:.45;"' : '') + '>\u25B6 Confront</button>';

    return '<div style="background:var(--surface);border:1px solid rgba(46,196,182,.5);padding:.6rem;margin-bottom:.5rem;">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.3rem;">'
      + '<div><div style="font-family:\'Cinzel\',serif;font-size:.8rem;color:var(--teal);margin-bottom:.1rem;">Establish Your Holding</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);">Special Quest · DD d8 · Province</div></div>'
      + '</div>'
      + '<div style="border:1px solid var(--border);padding:.2rem .3rem;margin-bottom:.3rem;">' + stepsHtml + '</div>'
      + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;">' + btn1 + btn2 + btn3 + '</div>'
      + '</div>';
  }

  function moveVaultItemToBackpack(i) {
    ensureNewFeatureState();
    var h = S.holding;
    if (!h.vault || !h.vault[i]) { return; }
    var item = h.vault[i];
    h.vault.splice(i, 1);
    if (!Array.isArray(S.backpack)) { S.backpack = Array(10).fill(""); }
    var slotIdx = S.backpack.indexOf("");
    if (slotIdx >= 0) {
      S.backpack[slotIdx] = item;
    } else {
      S.backpack.push(item);
    }
    renderHoldingUI();
    if (typeof renderBackpackUI === "function") { renderBackpackUI(); }
    showNotif("Moved to Backpack: " + item, "good");
  }

  function moveBackpackToVault() {
    ensureNewFeatureState();
    var bp = S.backpack || [];
    var lastIdx = -1;
    for (var i = bp.length - 1; i >= 0; i--) {
      if (bp[i] && bp[i].trim()) { lastIdx = i; break; }
    }
    if (lastIdx < 0) { showNotif("Backpack is empty!", "warn"); return; }
    if (!Array.isArray(S.holding.vault)) { S.holding.vault = []; }
    var item = bp[lastIdx];
    S.holding.vault.push(item);
    S.backpack[lastIdx] = "";
    renderHoldingUI();
    if (typeof renderBackpackUI === "function") { renderBackpackUI(); }
    showNotif("Moved to Vault: " + item, "good");
  }

  function collectTax() {
    var allLandmarks = S.holding.landmarks.concat(S.holding.extraLandmarks);
    var total = 0;
    var breakdown = [];
    allLandmarks.forEach(function(lm) {
      var earned = roll(4) * 10;
      total += earned;
      breakdown.push((lm.type || "Landmark") + " (" + (lm.name || "Unnamed") + "): +" + earned + "\u20B5");
    });
    S.credits = (S.credits || 0) + total;
    S.holding.taxLog.push("Season tax: +" + total + "\u20B5");
    updateCreditsUI();
    var el = document.getElementById("holdingTaxResult");
    if (el) {
      el.innerHTML = '<div style="background:rgba(201,162,39,.08);border:1px solid rgba(201,162,39,.3);padding:.4rem .55rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.56rem;letter-spacing:.1em;color:var(--gold2);text-transform:uppercase;margin-bottom:.2rem;">Tax Collected — End of Season</div>'
        + breakdown.map(function(b){ return '<div style="font-size:.78rem;color:var(--text2);">' + b + '</div>'; }).join("")
        + '<div style="font-family:\'Rajdhani\',sans-serif;font-weight:700;font-size:1rem;color:var(--gold);margin-top:.25rem;">Total: +' + total + '\u20B5</div>'
        + '</div>';
    }
    renderHoldingUI();
    showNotif("Tax collected: +" + total + "\u20B5", "good");
  }

  function buyLandmark() {
    var cost = 5000;
    if ((S.credits || 0) < cost) {
      showNotif("Need " + cost + "\u20B5 to purchase a Landmark!", "warn"); return;
    }
    S.credits -= cost;
    var types = ["Dwelling", "Dwelling", "Temple", "Monument"];
    var names = ["Eastern Outpost", "River Crossing", "Hilltop Shrine", "Roadside Waystation", "Southern Farm", "Trade Post"];
    var newLandmark = { type: pick(types), name: pick(names), notes: "" };
    S.holding.extraLandmarks.push(newLandmark);
    updateCreditsUI();
    renderHoldingUI();
    showNotif("New Landmark purchased: " + newLandmark.type, "good");
  }

  function updateLandmarkName(i, value) {
    var baseLen = S.holding.landmarks.length;
    if (i < baseLen) { S.holding.landmarks[i].name = value; }
    else { S.holding.extraLandmarks[i - baseLen].name = value; }
  }

  function removeExtraLandmark(i) {
    S.holding.extraLandmarks.splice(i, 1);
    renderHoldingUI();
  }

  function updateCouncilMember(role, field, value) {
    if (!S.holding.council[role]) { S.holding.council[role] = {}; }
    S.holding.council[role][field] = value;
  }

  function adjustRetainers(role, delta) {
    if (!S.holding.council[role]) { S.holding.council[role] = { retainers: 3 }; }
    var mem = S.holding.council[role];
    mem.retainers = Math.max(0, ((mem.retainers !== undefined ? mem.retainers : 3) + delta));
    var el = document.getElementById("retainersVal-" + role);
    if (el) { el.textContent = mem.retainers; }
  }

  function activeCouncilTaskCount(role) {
    return (S.holding.councilTasks || []).filter(function(t) { return t.role === role && t.status === "assigned"; }).length;
  }

  function hireRetainer(role) {
    ensureNewFeatureState();
    if (!S.holding.council[role]) { return; }
    if ((S.holding.retainerContracts || 0) > 0) {
      S.holding.retainerContracts--;
      S.holding.council[role].retainers = (S.holding.council[role].retainers || 0) + 1;
      renderHoldingUI();
      showNotif("Retainer assigned to " + capFirst(role) + " (contract used)", "good");
      return;
    }
    if ((S.credits || 0) < 200) { showNotif("Need 200₵ to hire a Retainer.", "warn"); return; }
    S.credits -= 200;
    updateCreditsUI();
    S.holding.council[role].retainers = (S.holding.council[role].retainers || 0) + 1;
    renderHoldingUI();
    showNotif("Retainer hired for " + capFirst(role) + " (−200₵)", "good");
  }

  function removeCouncilTaskSite(taskId) {
    if (typeof mapData === "undefined" || !Array.isArray(mapData)) { return; }
    mapData.forEach(function(hex) {
      var d = hex.data || {};
      if (d.taskSite && d.taskSite.councilTaskId === taskId) {
        delete d.taskSite;
      }
    });
    if (typeof renderHexMap === "function") { renderHexMap(); }
  }

  function assignCourtTaskToMapAndCouncil(taskObj) {
    if (typeof mapData === "undefined" || !Array.isArray(mapData) || !mapData.length) {
      return false;
    }
    var candidates = mapData.filter(function(h) { return h.type === "wilderness"; });
    if (!candidates.length) { return false; }
    var dest = candidates[Math.floor(Math.random() * candidates.length)];
    dest.data = dest.data || {};
    dest.data.taskSite = {
      verb: taskObj.verb,
      target: taskObj.target,
      originCol: taskObj.originCol,
      originRow: taskObj.originRow,
      councilTaskId: taskObj.id
    };
    taskObj.destCol = dest.col;
    taskObj.destRow = dest.row;
    S.holding.councilTasks.push(taskObj);
    var roleTasks = S.holding.councilTasks.filter(function(t) { return t.role === taskObj.role && t.status === "assigned"; });
    if (S.holding.council[taskObj.role]) {
      S.holding.council[taskObj.role].task = roleTasks.length + " active task" + (roleTasks.length === 1 ? "" : "s");
      S.holding.council[taskObj.role].status = "Assigned";
    }
    if (typeof renderHexMap === "function") { renderHexMap(); }
    return true;
  }

  function rollCouncilTask(role) {
    var vdDie = (typeof getEffectiveDie === 'function')
      ? getEffectiveDie('valor')
      : (((S.stats && S.stats.valor) || (S.stats && S.stats.valor)) || 4);
    var dreadTarget = (role === "regent" && (S.holding.crises || []).length > 0) ? 8 : 6;
    var a = explodingRoll(vdDie, { type: 'action', major: true, label: 'Council Task VD' + vdDie });
    var d = explodingRoll(dreadTarget, { type: 'dread', major: true, label: 'Council Task DD' + dreadTarget });
    var success = a.total >= d.total;
    var el = document.getElementById("councilResult-" + role);
    if (el) {
      el.innerHTML = '<span style="color:' + (success ? 'var(--green2)' : 'var(--red2)') + ';">'
        + a.total + ' vs ' + d.total + ' \u2014 ' + (success ? '\u2713 Success' : '\u2717 Failed') + '</span>';
    }

    if (role === "regent") {
      if (!(S.holding.crises || []).length) {
        showNotif("No active crises for the Regent to handle.", "neutral");
      } else if (success) {
        S.holding.regentFailures = 0;
        resolveCrisis(0);
        showNotif("Regent resolved one active Crisis.", "good");
      } else {
        S.holding.regentFailures = (S.holding.regentFailures || 0) + 1;
        if (S.holding.regentFailures >= 3 && roll(6) <= 3) {
          if (S.holdingQuest) { S.holdingQuest.holdingHex = null; }
          clearHoldingQuestTokens();
          if (typeof renderHexMap === "function") { renderHexMap(); }
          showNotif("Regent failures caused your Holding marker to disappear from the Planetary Expedition Map!", "warn");
        } else {
          showNotif("Regent failed to resolve the Crisis.", "warn");
        }
      }
      renderHoldingUI();
    } else {
      var tasks = (S.holding.councilTasks || []).filter(function(t) { return t.role === role && t.status === "assigned"; });
      if (!tasks.length) {
        showNotif(capFirst(role) + " has no assigned tasks.", "neutral");
      } else if (success) {
        onHoldingCouncilTaskResolved(tasks[0].id, true);
      } else {
        onHoldingCouncilTaskResolved(tasks[0].id, false);
      }
    }

    if (success) {
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome('spell', Math.max(1, a.total - d.total), {
          actionTotal: a.total,
          dreadTotal: d.total,
          context: 'Council task: ' + role
        });
      }
      if (typeof addSuccessRoll === 'function') { addSuccessRoll(); }
    } else {
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome('spell', Math.max(1, d.total - a.total), {
          actionTotal: a.total,
          dreadTotal: d.total,
          context: 'Council task: ' + role
        });
      }
      if (typeof addTMWOnFail === 'function') { addTMWOnFail(); }
    }
  }

  function generateCourtEvent(type) {
    var el = document.getElementById("holdingCourtResult");
    if (!el) { return; }
    S.holding.pendingCourtType = type;
    var events = type === "commoner" ? COURT_COMMONER_TASKS : (type === "military" ? [
      "Scouts report hostile movement near the border roads.",
      "A fortified raider camp threatens nearby villages.",
      "Supply lines are being cut by organized ambushers.",
      "A garrison requests reinforcements before nightfall.",
      "An old watchtower has gone silent and must be reclaimed."
    ] : COURT_ACOLYTE_TASKS);
    var event = pick(events);
    var borderColor = type === "commoner" ? "var(--teal)" : (type === "military" ? "var(--red2)" : "var(--purple)");
    var labelColor  = borderColor;
    var label = type === "commoner" ? "\uD83D\uDC65 Commoner Petition" : (type === "military" ? "⚔ Commander Request" : "\uD83D\uDCFF Acolyte Decree");
    el.innerHTML = '<div style="background:var(--surface);border-left:2px solid ' + borderColor + ';padding:.5rem .65rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.56rem;letter-spacing:.12em;color:' + labelColor + ';text-transform:uppercase;margin-bottom:.18rem;">' + label + '</div>'
      + '<div style="font-size:.83rem;color:var(--text2);line-height:1.6;">' + event + '</div>'
      + '<div style="margin-top:.4rem;"><button class="btn btn-xs btn-primary" onclick="generateCourtTask()">⚄ Generate Task</button></div>'
      + '<div id="courtTaskResult" style="margin-top:.3rem;font-size:.8rem;color:var(--gold2);"></div>'
      + '</div>';
  }

  function generateCourtTask() {
    ensureNewFeatureState();
    var pType = S.holding.pendingCourtType || "commoner";
    var role = pType === "commoner" ? "diplomat" : (pType === "acolyte" ? "elder" : "commander");
    var retainers = ((S.holding.council[role] || {}).retainers) || 0;
    if (activeCouncilTaskCount(role) >= retainers) {
      showNotif(capFirst(role) + " is at capacity. Hire more Retainers.", "warn");
      return;
    }

    var verb = pick(TASK_VERBS);
    var target = pick(TASK_TARGETS);
    var task = verb + " " + target + ", " + (roll(4) + 1) + " hexes " + pick(TASK_DIRS) + ".";
    var taskObj = {
      id: Date.now() + Math.random(),
      type: pType,
      role: role,
      verb: verb,
      target: target,
      summary: verb + " " + target,
      status: "assigned",
      createdAt: new Date().toISOString(),
      originCol: null,
      originRow: null
    };
    if (!assignCourtTaskToMapAndCouncil(taskObj)) {
      showNotif("No valid wilderness hex available for this task.", "warn");
      return;
    }

    var el = document.getElementById("courtTaskResult");
    if (el) { el.innerHTML = "Task: " + task + " Assigned to <strong>" + capFirst(role) + "</strong> at Hex [" + (taskObj.destCol + 1) + "," + (taskObj.destRow + 1) + "]"; }
    showNotif("Court task assigned to " + capFirst(role) + ".", "good");
    renderHoldingUI();
  }

  function onHoldingCouncilTaskResolved(taskId, success) {
    ensureNewFeatureState();
    var tasks = S.holding.councilTasks || [];
    var t = tasks.filter(function(x) { return x.id === taskId; })[0];
    if (!t) { return; }
    t.status = success ? "resolved" : "failed";
    removeCouncilTaskSite(taskId);
    S.holding.councilTasks = tasks.filter(function(x) { return x.id !== taskId; });
    var roleTasks = S.holding.councilTasks.filter(function(x) { return x.role === t.role && x.status === "assigned"; });
    if (S.holding.council[t.role]) {
      S.holding.council[t.role].task = roleTasks.length ? (roleTasks.length + " active task" + (roleTasks.length === 1 ? "" : "s")) : "";
      S.holding.council[t.role].status = roleTasks.length ? "Assigned" : "Idle";
    }
    if (success) {
      showNotif("Council task resolved: " + t.summary, "good");
    } else {
      showNotif("Council task failed: " + t.summary, "warn");
    }
    renderHoldingUI();
  }

  function rollLeadershipPeril() {
    var r = roll(6);
    var html = "";
    if (r <= 2) {
      var c1 = CRISIS_TYPES[roll(6) - 1];
      var c2 = CRISIS_TYPES[roll(6) - 1];
      addCrisis(c1);
      addCrisis(c2);
      html = '<div style="background:rgba(201,64,64,.08);border:1px solid rgba(201,64,64,.3);padding:.5rem .6rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.58rem;letter-spacing:.1em;color:var(--red2);text-transform:uppercase;margin-bottom:.2rem;">d6=' + r + ' \u2014 Catastrophe</div>'
        + '<div style="font-size:.82rem;color:var(--text2);">Two crises erupt: <strong>' + c1.name + '</strong> and <strong>' + c2.name + '</strong>.</div>'
        + '</div>';
    } else if (r <= 4) {
      var idx1 = roll(6) - 1;
      var idx2 = roll(6) - 1;
      var cr1 = CRISIS_TYPES[idx1];
      var cr2 = CRISIS_TYPES[idx2];
      html = '<div style="background:rgba(201,162,39,.07);border:1px solid rgba(201,162,39,.3);padding:.5rem .6rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.58rem;letter-spacing:.1em;color:var(--gold2);text-transform:uppercase;margin-bottom:.2rem;">d6=' + r + ' \u2014 Conundrum</div>'
        + '<div style="font-size:.82rem;color:var(--text2);margin-bottom:.35rem;">Choose one crisis to face:</div>'
        + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;">'
        + '<button class="btn btn-sm btn-red" onclick="addCrisisByIndex(' + idx1 + ')">Face ' + cr1.name + '</button>'
        + '<button class="btn btn-sm btn-red" onclick="addCrisisByIndex(' + idx2 + ')">Face ' + cr2.name + '</button>'
        + '</div>'
        + '</div>';
    } else {
      html = '<div style="background:rgba(76,175,116,.07);border:1px solid rgba(76,175,116,.3);padding:.5rem .6rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.58rem;letter-spacing:.1em;color:var(--green2);text-transform:uppercase;margin-bottom:.2rem;">d6=' + r + ' \u2014 Tranquility</div>'
        + '<div style="font-size:.82rem;color:var(--text2);">A period of relative peace. No crises arise this Season.</div>'
        + '</div>';
    }
    var el = document.getElementById("holdingPerilResult");
    if (el) { el.innerHTML = html; }
    renderHoldingUI();
  }

  function addCrisisByIndex(idx) {
    addCrisis(CRISIS_TYPES[idx]);
    renderHoldingUI();
  }

  function addCrisis(crisis) {
    var already = S.holding.crises.filter(function(c){ return c.name === crisis.name; }).length > 0;
    if (already) { return; }
    S.holding.crises.push({ name: crisis.name, desc: crisis.desc, resolution: crisis.resolution });
    renderHoldingCrises();
  }

  function addManualCrisis() {
    var crisis = CRISIS_TYPES[roll(6) - 1];
    addCrisis(crisis);
    renderHoldingUI();
    showNotif("Crisis added: " + crisis.name, "warn");
  }

  function resolveCrisis(i) {
    S.holding.crises.splice(i, 1);
    renderHoldingCrises();
    showNotif("Crisis resolved!", "good");
  }

  function clearAllCrises() {
    S.holding.crises = [];
    renderHoldingCrises();
  }

  // ── PATH TOKEN UPGRADES ────────────────────────────────────────────────────────
  function spendPathTokensUpgrade15() {
    ensureNewFeatureState();
    if ((S.pathTokens || 0) < 15) {
      showNotif("Need 15 Path Tokens to step up an Action Die!", "warn"); return;
    }
    var statKeys = ["body", "strike", "shoot", "mind", "spirit", "defend", "control", "lead", "valor"];
    var opts = statKeys.map(function(s) {
      var val = (S.stats && S.stats[s]) || 4;
      var canUp = val < 20;
      return '<button class="btn btn-sm btn-teal" style="margin:.2rem;" onclick="doPathUpgrade15(\'' + s + '\')" '
        + (!canUp ? 'disabled style="opacity:.4;"' : '') + '>'
        + s.charAt(0).toUpperCase() + s.slice(1) + ' (d' + val + (canUp ? '' : ' \u2014 max') + ')</button>';
    }).join("");
    openModal("Step Up Action Die — 15 Path Tokens",
      '<div style="font-size:.85rem;color:var(--muted3);margin-bottom:.6rem;">Choose which Action Die to step up. Current tokens: <strong style="color:var(--teal);">' + S.pathTokens + '</strong></div>'
      + '<div style="display:flex;flex-wrap:wrap;">' + opts + '</div>'
    , null, { preventScroll: true, focusTrap: true });
  }

  function doPathUpgrade15(stat) {
    if ((S.pathTokens || 0) < 15) { closeModal(); showNotif("Not enough Path Tokens!", "warn"); return; }
    var current = (S.stats && S.stats[stat]) || 4;
    var next = stepUp(current);
    if (next === current) { showNotif(stat + " is already at maximum (d20)!", "warn"); closeModal(); return; }
    S.stats[stat] = next;
    if (stat === 'valor') {
      S.stats.valor = next;
    }
    S.pathTokens -= 15;
    var ptEl = document.getElementById("pathTokensVal");
    if (ptEl) { ptEl.textContent = S.pathTokens; }
    if (typeof updateDieDisplay === "function") { updateDieDisplay(stat); }
    if (typeof updateMaxStressDisplay === "function") { updateMaxStressDisplay(); }
    showNotif(stat.charAt(0).toUpperCase() + stat.slice(1) + " stepped up to d" + next + "! (\u221215 Path Tokens)", "good");
    closeModal();
  }

  function spendPathTokensUpgrade20() {
    ensureNewFeatureState();
    if ((S.pathTokens || 0) < 20) {
      showNotif("Need 20 Path Tokens to gain a new Personal Trait!", "warn"); return;
    }
    var newTrait = pick(PERSONAL_FLAVORS);
    S.pathTokens -= 20;
    S.extraTraits.push(newTrait);
    var ptEl = document.getElementById("pathTokensVal");
    if (ptEl) { ptEl.textContent = S.pathTokens; }
    renderExtraTraits();
    showNotif("New Personal Trait unlocked!", "good");
    openModal("New Personal Trait — 20 Path Tokens",
      '<div style="font-size:.85rem;color:var(--muted3);margin-bottom:.4rem;">You have gained a new Personal Trait:</div>'
      + '<div style="background:var(--surface);border:1px solid var(--gold);padding:.6rem .8rem;font-family:\'Cinzel\',serif;font-size:.85rem;color:var(--gold2);">' + newTrait + '</div>'
      + '<div style="font-size:.76rem;color:var(--muted2);margin-top:.4rem;">Remaining Path Tokens: ' + S.pathTokens + '</div>'
    , null, { preventScroll: true, focusTrap: true });
  }

  function renderExtraTraits() {
    var el = document.getElementById("extraTraitsDisplay");
    if (!el) { return; }
    ensureNewFeatureState();
    if (!S.extraTraits.length) {
      el.innerHTML = '<div style="font-size:.76rem;color:var(--muted2);">No extra traits yet. Spend 20 Path Tokens to unlock one.</div>';
      return;
    }
    el.innerHTML = S.extraTraits.map(function(t, i) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.22rem .4rem;background:var(--surface);border:1px solid var(--border2);margin-bottom:.2rem;">'
        + '<span style="font-size:.8rem;color:var(--gold2);">' + t + '</span>'
        + '<button class="btn btn-xs btn-red" onclick="removeExtraTrait(' + i + ')">✕</button>'
        + '</div>';
    }).join("");
  }

  function removeExtraTrait(i) {
    ensureNewFeatureState();
    S.extraTraits.splice(i, 1);
    renderExtraTraits();
  }

  // ── COMBAT MAP ────────────────────────────────────────────────────────────────
  var combatMapUnitId = 100;

  function syncMapFromTrackers() {
    ensureNewFeatureState();
    if (typeof S === 'undefined' || !S || !S.combat || !S.combat.active) { return; }
    function spacingToZone(spacingVal) {
      var txt = String(spacingVal || '');
      if (txt.indexOf('Engaged') >= 0) { return 'Engaged'; }
      if (txt.indexOf('Close') >= 0) { return 'Close'; }
      if (txt.indexOf('Far') >= 0) { return 'Far'; }
      return 'Nearby';
    }
    // Auto-add player as ally if not on the map yet
    var playerName = (typeof S !== 'undefined' && S.name && S.name.trim()) ? S.name : 'You';
    var hasPlayer = S.combatMap.units.some(function(u){ return u.side === 'ally' && u.name === playerName; });
    var spacingEl = document.getElementById('spacingSelect');
    var relativeEnemyZone = spacingToZone(spacingEl ? spacingEl.value : 'Nearby (Shoot)');
    var spacingChanged = S.combatMap.lastRelativeZone !== relativeEnemyZone;
    S.combatMap.lastRelativeZone = relativeEnemyZone;
    if (!hasPlayer) {
      S.combatMap.units.push({ id: combatMapUnitId++, name: playerName, side: 'ally', zone: 'Engaged', isPlayer: true });
    } else if (hasPlayer) {
      S.combatMap.units.forEach(function(u) {
        if (u.side === 'ally' && (u.name === playerName || u.isPlayer)) { u.zone = 'Engaged'; u.isPlayer = true; }
      });
    }

    // Auto-sync enemies/companions from the combat tracker into map markers.
    if (!Array.isArray(S.enemies)) { return; }
    var desired = {};
    S.enemies.forEach(function(enemy, idx) {
      if (!enemy) { return; }
      var baseName = String(enemy.name || ((enemy.ally ? 'Ally' : 'Enemy') + ' ' + (idx + 1)));
      var faction = enemy.faction ? (' [' + String(enemy.faction) + ']') : '';
      var side = enemy.ally ? 'ally' : 'enemy';
      var key = side + ':' + String(enemy.id != null ? enemy.id : baseName);
      desired[key] = { key: key, name: baseName + faction, side: side };
    });
    // Auto-add campaign allies from shared state (multiplayer)
    try {
      if (typeof window.campaignSystem !== 'undefined' && typeof window.campaignSystem.getSharedState === 'function') {
        var shared = window.campaignSystem.getSharedState();
        if (shared && Array.isArray(shared.participants)) {
          var myToken = null;
          if (typeof window.campaignSystem.getState === 'function') {
            var myState = window.campaignSystem.getState();
            if (myState) myToken = myState.token;
          }
          shared.participants.forEach(function(p) {
            if (!p || !p.token || !p.name || p.isEnemy || p.token === myToken) return;
            var allyKey = 'ally:' + String(p.token);
            if (!desired[allyKey]) {
              desired[allyKey] = { key: allyKey, name: String(p.name || 'Ally'), side: 'ally' };
            }
          });
        }
      }
    } catch(_err) {}

    S.combatMap.units.forEach(function(unit) {
      if (!unit || !unit.fromTracker || !unit.trackerKey) { return; }
      var data = desired[unit.trackerKey];
      if (!data) { return; }
      unit.name = data.name;
      unit.side = data.side;
      if (unit.side === 'enemy' && spacingChanged) { unit.zone = relativeEnemyZone; }
    });

    Object.keys(desired).forEach(function(key) {
      var found = S.combatMap.units.some(function(u){ return !!u && u.fromTracker && u.trackerKey === key; });
      if (found) { return; }
      var existingMatch = S.combatMap.units.find(function(u) {
        if (!u) { return false; }
        if (u.isPlayer) { return false; }
        return u.side === desired[key].side && String(u.name || '') === String(desired[key].name || '');
      });
      if (existingMatch) {
        existingMatch.fromTracker = true;
        existingMatch.trackerKey = key;
        existingMatch.side = desired[key].side;
        existingMatch.name = desired[key].name;
        if (existingMatch.side === 'enemy' && spacingChanged) { existingMatch.zone = relativeEnemyZone; }
        return;
      }
      S.combatMap.units.push({
        id: combatMapUnitId++,
        name: desired[key].name,
        side: desired[key].side,
        zone: desired[key].side === 'enemy' ? relativeEnemyZone : 'Engaged',
        fromTracker: true,
        trackerKey: key
      });
    });

    S.combatMap.units = S.combatMap.units.filter(function(unit) {
      if (!unit || !unit.fromTracker || !unit.trackerKey) { return true; }
      return !!desired[unit.trackerKey];
    });

    var seenTracker = {};
    S.combatMap.units = S.combatMap.units.filter(function(unit) {
      if (!unit || !unit.fromTracker || !unit.trackerKey) { return true; }
      if (seenTracker[unit.trackerKey]) { return false; }
      seenTracker[unit.trackerKey] = true;
      return true;
    });
  }

  function getSceneCoverOverlays(zones) {
    var overlays = {};
    if (typeof S === 'undefined' || !S || !S.combat || !S.combat.sceneOpener) { return overlays; }
    var opener = S.combat.sceneOpener;
    var tier = String(opener.coverTier || '');
    if (!tier || tier === 'none') { return overlays; }
    var terrain = String(opener.zoneTerrain || '');
    var targets = [];
    if (/far zone/i.test(terrain)) { targets = ['Far']; }
    else if (/close\/nearby/i.test(terrain)) { targets = ['Close', 'Nearby']; }
    else if (/engaged only/i.test(terrain)) { targets = ['Engaged']; }
    else if (/no far zone/i.test(terrain)) { targets = ['Engaged', 'Close', 'Nearby']; }
    else { targets = zones.slice(); }

    var terrainLabel = 'Mixed Terrain';
    var terrainIcon = '🧱';
    if (/dense jungle|forest/i.test(terrain)) { terrainLabel = 'Dense Jungle / Forest'; terrainIcon = '🌿'; }
    else if (/ruined structure|urban alley|shipwreck|debris/i.test(terrain)) { terrainLabel = 'Urban Ruins'; terrainIcon = '🏚'; }
    else if (/cavern|tunnel/i.test(terrain)) { terrainLabel = 'Cavern / Tunnel'; terrainIcon = '🕳'; }
    else if (/crater/i.test(terrain)) { terrainLabel = 'Crater Field'; terrainIcon = '🪨'; }
    else if (/storm/i.test(terrain)) { terrainLabel = 'Storm Zone'; terrainIcon = '⛈'; }
    else if (/open field/i.test(terrain)) { terrainLabel = 'Open Field'; terrainIcon = '🌾'; }

    var coverLabel = tier === 'partial' ? 'Partial Cover (+1 Defend)'
      : tier === 'heavy' ? 'Heavy Cover (+2 Defend)'
      : 'Full Cover (immune to ranged)';
    var coverIcon = tier === 'partial' ? '🛡' : tier === 'heavy' ? '🛡🛡' : '🏰';
    var badgeBg = tier === 'partial' ? 'rgba(201,162,39,.14)'
      : tier === 'heavy' ? 'rgba(201,100,39,.16)'
      : 'rgba(201,64,64,.14)';
    var badgeBorder = tier === 'partial' ? 'rgba(201,162,39,.55)'
      : tier === 'heavy' ? 'rgba(201,100,39,.55)'
      : 'rgba(201,64,64,.55)';
    var stripe = tier === 'partial'
      ? 'repeating-linear-gradient(135deg,rgba(201,162,39,.12),rgba(201,162,39,.12) 6px,rgba(255,255,255,0) 6px,rgba(255,255,255,0) 12px)'
      : tier === 'heavy'
      ? 'repeating-linear-gradient(135deg,rgba(201,100,39,.13),rgba(201,100,39,.13) 6px,rgba(255,255,255,0) 6px,rgba(255,255,255,0) 12px)'
      : 'repeating-linear-gradient(135deg,rgba(201,64,64,.14),rgba(201,64,64,.14) 6px,rgba(255,255,255,0) 6px,rgba(255,255,255,0) 12px)';

    targets.forEach(function(zone) {
      overlays[zone] = (overlays[zone] || '')
        + '<div style="margin-top:.22rem;padding:.2rem .34rem;background:'+badgeBg+';background-image:'+stripe+';border:1px solid '+badgeBorder+';border-radius:4px;font-size:.62rem;color:var(--text2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 0 6px rgba(0,0,0,.15);">'
        + '<div style="display:flex;justify-content:space-between;gap:.3rem;align-items:center;">'
        + '<span style="font-weight:700;letter-spacing:.02em;">'+coverIcon+' ' + coverLabel + '</span>'
        + '<span style="font-size:.56rem;color:var(--muted2);">COVER</span>'
        + '</div>'
        + '<div style="margin-top:.1rem;font-size:.58rem;color:var(--muted2);">'+terrainIcon+' ' + terrainLabel + '</div>'
        + '</div>';
    });
    return overlays;
  }

  function getFlavorOverlays() {
    // Returns an object keyed by zone with overlay HTML for any active Personal Flavor effects
    var overlays = {};
    if (typeof S === 'undefined' || !S.flavor) { return overlays; }
    var flavor = String(S.flavor).toLowerCase();
    var domeActive = typeof isFlavorRoundEffectActive === 'function' && isFlavorRoundEffectActive('psychicDome');
    if (domeActive && (flavor.indexOf('psychic dome') >= 0 || flavor.indexOf('dome') >= 0)) {
      // Find zone where the player is
      var playerName = S.name && S.name.trim() ? S.name : 'You';
      var playerUnit = S.combatMap.units.filter(function(u){ return u.side === 'ally' && u.name === playerName; })[0];
      var domeZone = playerUnit ? playerUnit.zone : 'Nearby';
      overlays[domeZone] = (overlays[domeZone] || '')
        + '<div style="margin-top:.2rem;padding:.18rem .35rem;background:rgba(147,112,219,.18);border:1px solid rgba(147,112,219,.6);border-radius:4px;font-size:.63rem;color:#b39ddb;display:flex;align-items:center;gap:.25rem;">'
        + '<span style="font-size:.8rem;">🔮</span><span><strong>Psychic Dome</strong> — up to 4 people, cannot be attacked within. Full Cover active in this zone.</span></div>';
    }
    // Torchbearer / Cinder Skin — light hazard in zone
    if (flavor.indexOf('torchbearer') >= 0 || flavor.indexOf('cinder') >= 0) {
      overlays['Engaged'] = (overlays['Engaged'] || '')
        + '<div style="margin-top:.2rem;padding:.15rem .3rem;background:rgba(201,100,39,.15);border:1px solid rgba(201,100,39,.5);border-radius:4px;font-size:.63rem;color:var(--orange);">🔥 Heat Aura — enemies in Engaged zone take −1 to all rolls.</div>';
    }
    // Frost / Cold Ward
    if (flavor.indexOf('frost') >= 0 || flavor.indexOf('cold ward') >= 0) {
      overlays['Engaged'] = (overlays['Engaged'] || '')
        + '<div style="margin-top:.2rem;padding:.15rem .3rem;background:rgba(100,180,220,.12);border:1px solid rgba(100,180,220,.45);border-radius:4px;font-size:.63rem;color:#90caf9;">❄ Frost Ward — Cold immunity active · Nearby zone count as Close.</div>';
    }
    return overlays;
  }

  var COMBAT_MAP_ZONES = ['Engaged', 'Close', 'Nearby', 'Far'];
  var AOE_DISTANCE_RULES = {
    engaged: { key: 'engaged', label: 'Engaged', hexes: 1, lineLength: 2, ringMin: 0, ringMax: 1, rounds: 1, stress: 2, actionLoss: true },
    close: { key: 'close', label: 'Close', hexes: 2, lineLength: 3, ringMin: 1, ringMax: 2, rounds: 2, stress: 2, actionLoss: true },
    nearby: { key: 'nearby', label: 'Nearby', hexes: 3, lineLength: 4, ringMin: 2, ringMax: 3, rounds: 2, stress: 1, actionLoss: false },
    far: { key: 'far', label: 'Far', hexes: 4, lineLength: 6, ringMin: 3, ringMax: 5, rounds: 3, stress: 1, actionLoss: false }
  };
  var AOE_SPELL_PRESETS = [
    { key: 'thunder_lattice', name: 'Thunder Lattice', shape: 'line', band: 'nearby', note: 'Lightning lane, margin damage on each hit.' },
    { key: 'ashfall_ring', name: 'Ashfall Ring', shape: 'ring', band: 'close', note: 'Ring around caster, margin damage on each hit.' },
    { key: 'gravitic_fold', name: 'Gravitic Fold', shape: 'ring', band: 'nearby', note: 'Gravity ring control field.' },
    { key: 'glass_rain', name: 'Glass Rain', shape: 'line', band: 'far', note: 'Long lane barrage from distance.' },
    { key: 'null_choir', name: 'Null Choir', shape: 'ring', band: 'nearby', note: 'Suppression dome, action pressure.' },
    { key: 'hexfire_fan', name: 'Hexfire Fan', shape: 'line', band: 'nearby', note: 'Flame fan lane.' },
    { key: 'tide_of_needles', name: 'Tide of Needles', shape: 'line', band: 'nearby', note: 'Needle lane sweep.' },
    { key: 'starwell_collapse', name: 'Starwell Collapse', shape: 'ring', band: 'far', note: 'Long-range implosion ring.' },
    { key: 'custom_line', name: 'Custom Line', shape: 'line', band: 'close', note: 'Generic line template.' },
    { key: 'custom_ring', name: 'Custom Ring', shape: 'ring', band: 'close', note: 'Generic ring template.' }
  ];

  function escapeCombatAoeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeCombatAoeBand(value) {
    var raw = String(value || '').toLowerCase().trim();
    if (raw === 'engaged' || raw === 'e1') return 'engaged';
    if (raw === 'close' || raw === 'c2') return 'close';
    if (raw === 'nearby' || raw === 'n3') return 'nearby';
    if (raw === 'far' || raw === 'f4') return 'far';
    return 'close';
  }

  function normalizeCombatAoeShape(value) {
    var raw = String(value || '').toLowerCase().trim();
    if (raw === 'line' || raw === 'lane' || raw === 'fan') return 'line';
    if (raw === 'ring' || raw === 'circle' || raw === 'dome') return 'ring';
    return 'line';
  }

  function getCombatAoeBandSpec(band) {
    var key = normalizeCombatAoeBand(band);
    return AOE_DISTANCE_RULES[key] || AOE_DISTANCE_RULES.close;
  }

  function getCombatAoePresetByKey(key) {
    var target = String(key || '').toLowerCase();
    for (var i = 0; i < AOE_SPELL_PRESETS.length; i++) {
      if (String(AOE_SPELL_PRESETS[i].key || '').toLowerCase() === target) return AOE_SPELL_PRESETS[i];
    }
    return null;
  }

  function getCombatMapPrimaryPlayerZone() {
    ensureNewFeatureState();
    var playerName = (typeof S !== 'undefined' && S.name && S.name.trim()) ? S.name : 'You';
    var player = (S.combatMap.units || []).filter(function (u) {
      return u && u.side === 'ally' && (u.isPlayer || String(u.name || '') === String(playerName));
    })[0];
    return player && COMBAT_MAP_ZONES.indexOf(String(player.zone || '')) >= 0 ? player.zone : 'Engaged';
  }

  function getCombatAoeTemplateTargets(template) {
    var t = template || {};
    var origin = String(t.originZone || getCombatMapPrimaryPlayerZone());
    var originIdx = Math.max(0, COMBAT_MAP_ZONES.indexOf(origin));
    var band = getCombatAoeBandSpec(t.band);
    var shape = normalizeCombatAoeShape(t.shape);
    var zones = [];
    var overspill = false;
    if (shape === 'line') {
      for (var i = 0; i < Number(band.lineLength || 1); i++) {
        var idx = originIdx + i;
        if (idx <= COMBAT_MAP_ZONES.length - 1) zones.push(COMBAT_MAP_ZONES[idx]);
      }
      overspill = (originIdx + Number(band.lineLength || 1) - 1) > (COMBAT_MAP_ZONES.length - 1);
    } else {
      for (var z = 0; z < COMBAT_MAP_ZONES.length; z++) {
        var dist = Math.abs(z - originIdx);
        if (dist >= Number(band.ringMin || 0) && dist <= Number(band.ringMax || 0)) zones.push(COMBAT_MAP_ZONES[z]);
      }
      overspill = (originIdx + Number(band.ringMax || 0)) > (COMBAT_MAP_ZONES.length - 1);
    }
    return { zones: zones, overspill: overspill, band: band, shape: shape, origin: origin };
  }

  function getCombatAoeZoneOverlays(zones) {
    var overlays = {};
    ensureNewFeatureState();
    var templates = Array.isArray(S.combatMap.aoeTemplates) ? S.combatMap.aoeTemplates : [];
    templates.forEach(function (tpl) {
      if (!tpl) return;
      var targets = getCombatAoeTemplateTargets(tpl);
      var active = String(S.combatMap.activeAoeTemplateId || '') === String(tpl.id || '');
      var shapeLabel = targets.shape === 'ring' ? 'Ring' : 'Line';
      var badgeColor = active ? 'rgba(201,64,64,.2)' : 'rgba(201,64,64,.12)';
      var borderColor = active ? 'rgba(201,64,64,.72)' : 'rgba(201,64,64,.45)';
      targets.zones.forEach(function (zone) {
        if (zones.indexOf(zone) < 0) return;
        overlays[zone] = (overlays[zone] || '')
          + '<div style="margin-top:.22rem;padding:.2rem .34rem;background:' + badgeColor + ';border:1px solid ' + borderColor + ';border-radius:4px;font-size:.62rem;color:var(--text2);">'
          + '<div style="display:flex;justify-content:space-between;gap:.3rem;align-items:center;">'
          + '<span style="font-weight:700;letter-spacing:.02em;">' + escapeCombatAoeHtml(String(tpl.name || 'AOE')) + '</span>'
          + '<span style="font-size:.56rem;color:var(--muted2);">' + shapeLabel + ' · ' + escapeCombatAoeHtml(targets.band.label) + '</span>'
          + '</div>'
          + '<div style="margin-top:.1rem;font-size:.58rem;color:var(--muted2);">Duration: ' + Number(tpl.roundsLeft || targets.band.rounds || 1) + ' round(s) left · Per-round damage: ' + Number(targets.band.stress || 0)
          + (targets.band.actionLoss ? ' · Action Loss -1' : '') + '</div>'
          + '</div>';
      });
    });
    return overlays;
  }

  function applyActiveCombatAoeTick() {
    ensureNewFeatureState();
    var activeId = String(S.combatMap.activeAoeTemplateId || '');
    var templates = Array.isArray(S.combatMap.aoeTemplates) ? S.combatMap.aoeTemplates : [];
    var tpl = templates.filter(function (row) { return String(row && row.id || '') === activeId; })[0] || null;
    if (!tpl) {
      if (typeof showNotif === 'function') showNotif('No active AOE template selected.', 'warn');
      return false;
    }
    if (!Array.isArray(S.combatMap.units) || !Array.isArray(S.enemies)) {
      if (typeof showNotif === 'function') showNotif('Combat tracker not ready for AOE application.', 'warn');
      return false;
    }
    var targets = getCombatAoeTemplateTargets(tpl);
    var band = targets.band;
    var affected = 0;
    S.combatMap.units.forEach(function (unit) {
      if (!unit || unit.side !== 'enemy') return;
      if (targets.zones.indexOf(String(unit.zone || '')) < 0) return;
      var stripped = String(unit.name || '').replace(/\s*\[[^\]]+\]\s*$/, '').trim().toLowerCase();
      var enemy = (S.enemies || []).filter(function (e) {
        if (!e || e.ally) return false;
        var nm = String(e.name || '').trim().toLowerCase();
        return nm === stripped || nm.indexOf(stripped) === 0 || stripped.indexOf(nm) === 0;
      })[0];
      if (!enemy) return;
      affected++;
      if (typeof applyStressToEnemy === 'function') {
        applyStressToEnemy(enemy, Math.max(1, Number(band.stress || 1)), String(tpl.name || 'AOE') + ' tick');
      }
      if (band.actionLoss && typeof ensureEnemyEffectState === 'function') {
        var st = ensureEnemyEffectState(enemy);
        st.actionDrainRounds = Math.max(Number(st.actionDrainRounds || 0), 1);
        st.actionDrainAmount = Math.max(Number(st.actionDrainAmount || 0), 1);
      }
      if (typeof syncEnemyConditionList === 'function') syncEnemyConditionList(enemy);
    });
    tpl.roundsLeft = Math.max(0, Number(tpl.roundsLeft || 0) - 1);
    if (tpl.roundsLeft <= 0) {
      S.combatMap.aoeTemplates = templates.filter(function (row) { return String(row && row.id || '') !== String(tpl.id || ''); });
      if (String(S.combatMap.activeAoeTemplateId || '') === String(tpl.id || '')) {
        S.combatMap.activeAoeTemplateId = S.combatMap.aoeTemplates.length ? String(S.combatMap.aoeTemplates[0].id || '') : '';
      }
    }
    if (typeof renderEnemies === 'function') renderEnemies();
    if (typeof renderQP === 'function') renderQP('combat');
    if (typeof updateCombatUI === 'function') updateCombatUI();
    renderCombatMap();
    renderCombatOptions();
    if (typeof showNotif === 'function') showNotif('AOE tick applied to ' + affected + ' enemy token(s).', affected ? 'good' : 'warn');
    return true;
  }

  function onCombatAoeSpellPresetChange() {
    var presetEl = document.getElementById('aoeSpellPresetSelect');
    var shapeEl = document.getElementById('aoeShapeSelect');
    var bandEl = document.getElementById('aoeBandSelect');
    var labelEl = document.getElementById('aoeTemplateLabel');
    if (!presetEl || !shapeEl || !bandEl) return;
    var preset = getCombatAoePresetByKey(presetEl.value);
    if (!preset) return;
    shapeEl.value = normalizeCombatAoeShape(preset.shape);
    bandEl.value = normalizeCombatAoeBand(preset.band);
    if (labelEl && !String(labelEl.value || '').trim()) labelEl.value = String(preset.name || 'AOE Template');
  }

  function removeCombatAoeTemplate(templateId) {
    ensureNewFeatureState();
    var id = String(templateId || '');
    S.combatMap.aoeTemplates = (S.combatMap.aoeTemplates || []).filter(function (row) {
      return String(row && row.id || '') !== id;
    });
    if (String(S.combatMap.activeAoeTemplateId || '') === id) {
      S.combatMap.activeAoeTemplateId = S.combatMap.aoeTemplates.length ? String(S.combatMap.aoeTemplates[0].id || '') : '';
    }
    renderCombatMap();
    renderCombatOptions();
    openCombatAoeEffectTools();
  }

  function clearCombatAoeTemplates() {
    ensureNewFeatureState();
    S.combatMap.aoeTemplates = [];
    S.combatMap.activeAoeTemplateId = '';
    renderCombatMap();
    renderCombatOptions();
    openCombatAoeEffectTools();
  }

  function applyCombatAoeTemplateFromModal() {
    ensureNewFeatureState();
    var presetEl = document.getElementById('aoeSpellPresetSelect');
    var shapeEl = document.getElementById('aoeShapeSelect');
    var bandEl = document.getElementById('aoeBandSelect');
    var originEl = document.getElementById('aoeOriginSelect');
    var labelEl = document.getElementById('aoeTemplateLabel');
    if (!shapeEl || !bandEl || !originEl) return false;
    var preset = getCombatAoePresetByKey(presetEl ? presetEl.value : '');
    var shape = normalizeCombatAoeShape(shapeEl.value);
    var bandKey = normalizeCombatAoeBand(bandEl.value);
    var band = getCombatAoeBandSpec(bandKey);
    var label = String(labelEl && labelEl.value || '').trim();
    if (!label) label = preset ? String(preset.name || 'AOE Template') : 'AOE Template';
    S.combatMap.aoeSeq = Math.max(0, Number(S.combatMap.aoeSeq || 0)) + 1;
    var row = {
      id: 'aoe-' + String(S.combatMap.aoeSeq),
      name: label,
      presetKey: preset ? String(preset.key || '') : '',
      shape: shape,
      band: bandKey,
      originZone: String(originEl.value || getCombatMapPrimaryPlayerZone()),
      roundsLeft: Math.max(1, Number(band.rounds || 1)),
      placedAtRound: Number(S && S.combat && S.combat.round || 0)
    };
    S.combatMap.aoeTemplates.push(row);
    S.combatMap.activeAoeTemplateId = String(row.id || '');
    renderCombatMap();
    renderCombatOptions();
    if (typeof showNotif === 'function') {
      showNotif('AOE placed: ' + row.name + ' (' + shape + ', ' + band.label + ').', 'good');
    }
    openCombatAoeEffectTools();
    return true;
  }

  function openCombatAoeEffectTools() {
    ensureNewFeatureState();
    var playerZone = getCombatMapPrimaryPlayerZone();
    var presetOptions = AOE_SPELL_PRESETS.map(function (preset) {
      return '<option value="' + escapeCombatAoeHtml(String(preset.key || '')) + '">' + escapeCombatAoeHtml(String(preset.name || 'Preset')) + '</option>';
    }).join('');
    var zoneOptions = COMBAT_MAP_ZONES.map(function (zone) {
      var sel = zone === playerZone ? ' selected' : '';
      return '<option value="' + zone + '"' + sel + '>' + zone + '</option>';
    }).join('');
    var rulesRows = ['engaged', 'close', 'nearby', 'far'].map(function (k) {
      var row = AOE_DISTANCE_RULES[k];
      return '<tr>'
        + '<td style="padding:.16rem .22rem;color:var(--gold2);">' + row.label + ' (' + row.hexes + ' hex)</td>'
        + '<td style="padding:.16rem .22rem;color:var(--text2);">Line ' + row.lineLength + '</td>'
        + '<td style="padding:.16rem .22rem;color:var(--text2);">Ring ' + row.ringMin + '-' + row.ringMax + '</td>'
        + '<td style="padding:.16rem .22rem;color:var(--text2);">' + row.rounds + '</td>'
        + '<td style="padding:.16rem .22rem;color:var(--text2);">' + row.stress + '</td>'
        + '<td style="padding:.16rem .22rem;color:var(--text2);">' + (row.actionLoss ? 'Yes (-1)' : 'No') + '</td>'
        + '</tr>';
    }).join('');
    var activeRows = (S.combatMap.aoeTemplates || []).map(function (tpl) {
      if (!tpl) return '';
      var targets = getCombatAoeTemplateTargets(tpl);
      var active = String(S.combatMap.activeAoeTemplateId || '') === String(tpl.id || '');
      return '<div style="border:1px solid var(--border2);padding:.24rem .3rem;background:rgba(255,255,255,.02);margin-top:.18rem;">'
        + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;">'
        + '<div style="font-size:.72rem;color:var(--text2);"><strong>' + escapeCombatAoeHtml(String(tpl.name || 'AOE')) + '</strong> · '
        + escapeCombatAoeHtml(targets.shape === 'ring' ? 'Ring' : 'Line') + ' · '
        + escapeCombatAoeHtml(targets.band.label) + (targets.overspill ? ' (+beyond Far)' : '') + '</div>'
        + '<div style="display:flex;gap:.2rem;">'
        + '<button class="btn btn-xs" onclick="S.combatMap.activeAoeTemplateId=\'' + escapeCombatAoeHtml(String(tpl.id || '')) + '\';renderCombatMap();renderCombatOptions();openCombatAoeEffectTools();">' + (active ? 'Active' : 'Set Active') + '</button>'
        + '<button class="btn btn-xs btn-red" onclick="removeCombatAoeTemplate(\'' + escapeCombatAoeHtml(String(tpl.id || '')) + '\')">Remove</button>'
        + '</div>'
        + '</div>'
        + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.1rem;">Origin: ' + escapeCombatAoeHtml(targets.origin) + ' · Affects: '
        + escapeCombatAoeHtml(targets.zones.join(', ') || 'none') + ' · Duration left: ' + Number(tpl.roundsLeft || 0) + ' round(s)</div>'
        + '<div style="font-size:.64rem;color:var(--muted2);margin-top:.08rem;">Per-round damage: ' + Number(targets.band.stress || 0) + (targets.band.actionLoss ? ' · Action Loss: -1 action while affected' : '') + '</div>'
        + '</div>';
    }).join('') || '<div style="font-size:.7rem;color:var(--muted2);margin-top:.18rem;">No active AOE templates placed on the map yet.</div>';
    var html = ''
      + '<div style="font-size:.74rem;color:var(--muted2);line-height:1.48;margin-bottom:.34rem;">Place Line or Ring templates directly on the Zone Map. Spell and token AOE now use one spacing language: Engaged=1, Close=2, Nearby=3, Far=4.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.34rem;">'
      + '<div><label style="font-size:.68rem;color:var(--muted2);display:block;margin-bottom:.08rem;">Quick Spell</label><select id="aoeSpellPresetSelect" style="width:100%;" onchange="onCombatAoeSpellPresetChange()">' + presetOptions + '</select></div>'
      + '<div><label style="font-size:.68rem;color:var(--muted2);display:block;margin-bottom:.08rem;">Template Name</label><input id="aoeTemplateLabel" type="text" value="" placeholder="Auto from spell" style="width:100%;"></div>'
      + '<div><label style="font-size:.68rem;color:var(--muted2);display:block;margin-bottom:.08rem;">Shape</label><select id="aoeShapeSelect" style="width:100%;"><option value="line">Line</option><option value="ring">Ring</option></select></div>'
      + '<div><label style="font-size:.68rem;color:var(--muted2);display:block;margin-bottom:.08rem;">Effect Band</label><select id="aoeBandSelect" style="width:100%;"><option value="engaged">Engaged</option><option value="close" selected>Close</option><option value="nearby">Nearby</option><option value="far">Far</option></select></div>'
      + '<div><label style="font-size:.68rem;color:var(--muted2);display:block;margin-bottom:.08rem;">Origin Zone</label><select id="aoeOriginSelect" style="width:100%;">' + zoneOptions + '</select></div>'
      + '<div style="display:flex;align-items:flex-end;gap:.2rem;">'
      + '<button class="btn btn-sm btn-primary" onclick="applyCombatAoeTemplateFromModal()">Place Template</button>'
      + '<button class="btn btn-sm" onclick="applyActiveCombatAoeTick()">Apply Active Tick</button>'
      + '</div>'
      + '</div>'
      + '<div style="margin-top:.42rem;border-top:1px solid var(--border2);padding-top:.3rem;">'
      + '<div style="font-size:.68rem;color:var(--gold2);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.12rem;">AOE Rules (Token Actions)</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:.66rem;"><thead><tr style="border-bottom:1px solid var(--border2);">'
      + '<th style="text-align:left;padding:.16rem .22rem;color:var(--muted2);">Band</th>'
      + '<th style="text-align:left;padding:.16rem .22rem;color:var(--muted2);">Line</th>'
      + '<th style="text-align:left;padding:.16rem .22rem;color:var(--muted2);">Ring</th>'
      + '<th style="text-align:left;padding:.16rem .22rem;color:var(--muted2);">Rounds</th>'
      + '<th style="text-align:left;padding:.16rem .22rem;color:var(--muted2);">Stress</th>'
      + '<th style="text-align:left;padding:.16rem .22rem;color:var(--muted2);">Action Loss</th>'
      + '</tr></thead><tbody>' + rulesRows + '</tbody></table>'
      + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.18rem;">How to read this box: Line and Ring show shape size at each distance band. Rounds is duration. Stress is per-round damage while inside the effect. Action Loss means enemies lose 1 action while affected.</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.08rem;">Spell damage rule: success margin equals damage per enemy hit. Example: margin 4 = 4 damage to each affected enemy.</div>'
      + '</div>'
      + '<div style="margin-top:.42rem;border-top:1px solid var(--border2);padding-top:.3rem;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:.3rem;">'
      + '<div style="font-size:.68rem;color:var(--gold2);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;">Placed Templates</div>'
      + '<button class="btn btn-xs" onclick="clearCombatAoeTemplates()">Clear All</button>'
      + '</div>'
      + activeRows
      + '</div>';
    openModal('AOE Effect Tools', html);
    onCombatAoeSpellPresetChange();
  }

  function renderCombatMap() {
    var el = document.getElementById("combatMapZones");
    if (!el) { return; }
    ensureNewFeatureState();
    syncMapFromTrackers();
    var zones = ["Engaged", "Close", "Nearby", "Far"];
    var zoneInfo = {
      Engaged: { color: "rgba(201,64,64,.07)",    border: "rgba(201,64,64,.35)",    range: "Melee / Strike" },
      Close:   { color: "rgba(201,162,39,.06)",   border: "rgba(201,162,39,.3)",    range: "Spells / Items" },
      Nearby:  { color: "rgba(46,196,182,.06)",   border: "rgba(46,196,182,.3)",    range: "Ranged / Shoot" },
      Far:     { color: "rgba(122,120,152,.06)",  border: "rgba(122,120,152,.25)",  range: "Out of Range" }
    };
    var flavOverlays = getFlavorOverlays();
    var coverOverlays = getSceneCoverOverlays(zones);
    var aoeOverlays = getCombatAoeZoneOverlays(zones);
    // Determine player zone for distance indicator
    var playerName2 = (typeof S !== 'undefined' && S.name && S.name.trim()) ? S.name : 'You';
    var playerUnit2 = S.combatMap.units.filter(function(u){ return u.side === 'ally' && u.name === playerName2; })[0];
    var playerZoneIdx = playerUnit2 ? zones.indexOf(playerUnit2.zone) : -1;
    var ZONE_DIST_NAMES = ['Adjacent Hex','Two Hexes away','Three Hexes away','Four Hexes away'];
    el.innerHTML = zones.map(function(zone) {
      var info = zoneInfo[zone];
      var units = S.combatMap.units.filter(function(u){ return u.zone === zone; });
      var allies  = units.filter(function(u){ return u.side === "ally"; });
      var enemies = units.filter(function(u){ return u.side === "enemy"; });
      var zoneOptions = zones.map(function(z){ return '<option value="' + z + '"' + (z === zone ? ' selected' : '') + '>' + z + '</option>'; }).join("");
      var zoneIdx = zones.indexOf(zone);
      var distBadge = '';
      if (playerZoneIdx >= 0 && playerUnit2) {
        var dist = Math.abs(zoneIdx - playerZoneIdx);
        var distLabel = '';
        if (dist === 0) distLabel = '📍 You';
        else distLabel = ZONE_DIST_NAMES[dist - 1] || '';
        distBadge = '<span style="font-size:.58rem;color:var(--muted);margin-left:.35rem;">'+distLabel+'</span>';
      }
      var allyTags = allies.map(function(u) {
        var isPlayer = !!u.isPlayer || u.name === playerName2;
        return '<div style="background:rgba(46,196,182,.13);border:1px solid var(--teal);padding:.14rem .32rem;font-size:.7rem;color:var(--teal);display:inline-flex;align-items:center;gap:.2rem;margin:.1rem;">'
          + '<span>\uD83D\uDFE6 ' + u.name + '</span>'
          + (isPlayer
            ? '<span style="font-size:.62rem;color:var(--gold2);">(You)</span>'
            : '<div style="display:inline-flex;align-items:center;gap:.12rem;">'
              + '<button class="btn btn-xs" style="padding:.08rem .22rem;min-width:1.45rem;" onclick="shiftCombatUnitZone(' + u.id + ',-1)">◀</button>'
              + '<select style="background:transparent;border:none;color:var(--teal);font-size:.62rem;cursor:pointer;min-width:4.35rem;" onchange="moveCombatUnit(' + u.id + ',this.value)">' + zoneOptions + '</select>'
              + '<button class="btn btn-xs" style="padding:.08rem .22rem;min-width:1.45rem;" onclick="shiftCombatUnitZone(' + u.id + ',1)">▶</button>'
              + '</div>'
          )
          + (isPlayer
            ? ''
            : '<button style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:0;font-size:.68rem;line-height:1;" onclick="removeCombatUnit(' + u.id + ')">✕</button>'
          )
          + '</div>';
      }).join("");
      var enemyTags = enemies.map(function(u) {
        return '<div style="background:rgba(201,64,64,.13);border:1px solid var(--red);padding:.14rem .32rem;font-size:.7rem;color:var(--red2);display:inline-flex;align-items:center;gap:.2rem;margin:.1rem;">'
          + '<span>\uD83D\uDD34 ' + u.name + '</span>'
          + '<div style="display:inline-flex;align-items:center;gap:.12rem;">'
          + '<button class="btn btn-xs" style="padding:.08rem .22rem;min-width:1.45rem;" onclick="shiftCombatUnitZone(' + u.id + ',-1)">◀</button>'
          + '<select style="background:transparent;border:none;color:var(--red2);font-size:.62rem;cursor:pointer;min-width:4.35rem;" onchange="moveCombatUnit(' + u.id + ',this.value)">' + zoneOptions + '</select>'
          + '<button class="btn btn-xs" style="padding:.08rem .22rem;min-width:1.45rem;" onclick="shiftCombatUnitZone(' + u.id + ',1)">▶</button>'
          + '</div>'
          + '<button style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:0;font-size:.68rem;line-height:1;" onclick="removeCombatUnit(' + u.id + ')">✕</button>'
          + '</div>';
      }).join("");
      var overlay = (coverOverlays[zone] || '') + (flavOverlays[zone] || '') + (aoeOverlays[zone] || '');
      return '<div style="border:2px solid ' + info.border + ';background:' + info.color + ';padding:.45rem .55rem;margin-bottom:.3rem;' + (overlay ? 'box-shadow:0 0 6px '+info.border+';' : '') + '">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem;">'
        + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:' + info.border + ';">' + zone + distBadge + '</div>'
        + '<div style="font-size:.62rem;color:var(--muted2);">' + info.range + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-wrap:wrap;min-height:1.4rem;">'
        + allyTags + enemyTags
        + (!units.length ? '<div style="font-size:.66rem;color:var(--muted);font-style:italic;">empty</div>' : '')
        + '</div>'
        + '</div>';
    }).join("");
  }

  function addCombatUnit(side) {
    ensureNewFeatureState();
    var enemyCount = 0;
    for (var i = 0; i < S.combatMap.units.length; i++) {
      if (S.combatMap.units[i].side === "enemy") { enemyCount++; }
    }
    var defaultName = side === "ally"
      ? (S.name && S.name.trim() ? S.name : "Self")
      : "Enemy " + (enemyCount + 1);
    var name = prompt((side === "ally" ? "Add ally name:" : "Add enemy name:"), defaultName);
    if (!name) { return; }
    if (typeof addTrackedCombatantFromMap === 'function') {
      addTrackedCombatantFromMap(side, name.trim(), 'Nearby');
      return;
    }
    S.combatMap.units.push({ id: combatMapUnitId++, name: name.trim(), side: side, zone: 'Nearby' });
    renderCombatMap();
    renderCombatOptions();
    if (typeof syncStarsUnitsFromCombatMap === 'function') { syncStarsUnitsFromCombatMap(); }
  }

  function shiftCombatUnitZone(id, direction) {
    ensureNewFeatureState();
    var zones = ['Engaged', 'Close', 'Nearby', 'Far'];
    var unit = S.combatMap.units.filter(function (u) { return u && u.id === id; })[0];
    if (!unit) return;
    var idx = zones.indexOf(String(unit.zone || 'Engaged'));
    if (idx < 0) idx = 0;
    var next = idx + Number(direction || 0);
    if (next < 0) next = 0;
    if (next > zones.length - 1) next = zones.length - 1;
    moveCombatUnit(id, zones[next]);
  }

  function moveCombatUnit(id, zone) {
    var unit = S.combatMap.units.filter(function(u){ return u.id === id; })[0];
    if (unit) {
      var prevZone = unit.zone;
      unit.zone = zone;
      if (unit.side === 'enemy' && prevZone !== zone && typeof maybeResetActionsAfterDefend === 'function') {
        maybeResetActionsAfterDefend();
        if (typeof showNotif === 'function') {
          showNotif('Enemy repositioned (counts as 1 enemy action).', 'warn');
        }
      }
      renderCombatMap();
      renderCombatOptions();
      if (typeof updateCombatUI === 'function') { updateCombatUI(); }
      if (typeof syncCombatSpacingToPrimaryEnemy === 'function') { syncCombatSpacingToPrimaryEnemy(); }
      if (typeof syncStarsUnitsFromCombatMap === 'function') { syncStarsUnitsFromCombatMap(); }
    }
  }

  function removeCombatUnit(id) {
    var unit = S.combatMap.units.filter(function(u){ return u.id === id; })[0];
    if (unit && typeof removeTrackedCombatantByMapUnit === 'function' && removeTrackedCombatantByMapUnit(unit)) {
      return;
    }
    S.combatMap.units = S.combatMap.units.filter(function(u){ return u.id !== id; });
    renderCombatMap();
    renderCombatOptions();
    if (typeof syncStarsUnitsFromCombatMap === 'function') { syncStarsUnitsFromCombatMap(); }
  }

  function clearCombatMap() {
    ensureNewFeatureState();
    S.combatMap.units = [];
    S.combatMap.aoeTemplates = [];
    S.combatMap.activeAoeTemplateId = '';
    renderCombatMap();
    renderCombatOptions();
    if (typeof syncStarsUnitsFromCombatMap === 'function') { syncStarsUnitsFromCombatMap(); }
  }

  // ── COMBAT OPTIONS (distance-aware) ──────────────────────────────────────────
  var ZONE_ORDER = ["Engaged", "Close", "Nearby", "Far"];
  var ZONE_DIST = { Engaged: 0, Close: 1, Nearby: 2, Far: 3 };

  var ALL_COMBAT_OPTIONS = [
    { id: "standard",  label: "Standard Attack",  cost: "1 Action",  zones: ["Engaged","Close","Nearby"],  desc: "Roll Strike or Shoot vs Dread. Hit = difference in Health (min 1).", tags: ["Engaged","Close","Nearby"] },
    { id: "heavy",     label: "Heavy Attack",      cost: "2 Actions", zones: ["Engaged","Close","Nearby"],  desc: "Deal +2 Health on hit.", tags: ["Engaged","Close","Nearby"] },
    { id: "fast",      label: "Fast Attack",       cost: "1 Action",  zones: ["Engaged","Close","Nearby"],  desc: "Die steps down by one. Quick but weaker.", tags: ["Engaged","Close","Nearby"] },
    { id: "stance",    label: "Stance",            cost: "1 Action",  zones: ["Engaged","Close","Nearby","Far"], desc: "Aggressive (+1 Strike, −1 Defend) or Defensive (vice versa).", tags: [] },
    { id: "switch",    label: "Switch",            cost: "1 Action",  zones: ["Engaged","Close","Nearby","Far"], desc: "Change weapons or adjust spacing.", tags: [] },
    { id: "item",      label: "Use Item",          cost: "1 Action",  zones: ["Engaged","Close","Nearby","Far"], desc: "Use a readied item from your gear.", tags: [] },
    { id: "help",      label: "Help / Stand",      cost: "1 Action",  zones: ["Engaged","Close","Nearby"],  desc: "Spend 1 Action to help an ally — they gain an Advantage Die.", tags: ["Close","Nearby"] },
    { id: "move",      label: "Move Zone",         cost: "1 Action",  zones: ["Engaged","Close","Nearby","Far"], desc: "Change zone for 1 Action. Zero-G or Underwater costs +1.", tags: [] },
    { id: "cover",     label: "Take Cover",        cost: "1 Action",  zones: ["Nearby","Far"],              desc: "Partial: +1 Defend. Full: cannot be targeted by ranged attacks.", tags: ["Nearby","Far"] },
    { id: "surprise",  label: "Surprise Round",    cost: "Setup",     zones: ["Engaged","Close","Nearby","Far"], desc: "+2 to first round attacks for the acting party.", tags: [] }
  ];

  function openCombatCampaignSceneCheck() {
    if (!window.campaignSystem || typeof window.campaignSystem.requestSceneCheck !== "function") {
      if (typeof showNotif === "function") showNotif("Campaign scene checks are unavailable.", "warn");
      return false;
    }
    var allies = S.combatMap.units.filter(function (u) { return u.side === "ally"; });
    var enemies = S.combatMap.units.filter(function (u) { return u.side === "enemy"; });
    var playerZone = allies.length ? allies[0].zone : "Unknown";
    var enemyZoneInfo = enemies.length
      ? enemies.map(function (u) { return String(u.name || "Enemy") + " @ " + String(u.zone || "Unknown"); }).join(", ")
      : "no visible enemies";
    return window.campaignSystem.requestSceneCheck({
      title: "Combat Scene Check",
      label: "Combat Scene Check",
      context: "Combat tab · " + playerZone + " vs " + enemyZoneInfo,
      type: "scene-check",
      stat: "strike",
      dread: 8,
      successRewardType: "none",
      successRewardAmount: 0,
      failurePenaltyType: "health",
      failurePenaltyAmount: 1,
      failTmw: 1,
      stake: "The GM chooses who acts, who absorbs the consequence, and whether the table rolls digitally or physically.",
      playerRequestMessage: "⚔️ Requesting a combat scene check so the GM can assign the acting wayfarer."
    });
  }

  function renderCombatOptions() {
    var el = document.getElementById("combatOptionsPanel");
    if (!el) { return; }
    ensureNewFeatureState();
    // Determine player (first ally unit) zone
    var allies  = S.combatMap.units.filter(function(u){ return u.side === "ally"; });
    var enemies = S.combatMap.units.filter(function(u){ return u.side === "enemy"; });
    if (!allies.length && !enemies.length) { el.innerHTML = ""; return; }

    var playerZone = allies.length ? allies[0].zone : null;

    // Closest enemy zone
    var closestEnemyDist = 99;
    enemies.forEach(function(u) {
      var d = ZONE_DIST[u.zone];
      if (d !== undefined && d < closestEnemyDist) { closestEnemyDist = d; }
    });
    var playerDist = playerZone !== null ? ZONE_DIST[playerZone] : 99;

    var rows = ALL_COMBAT_OPTIONS.map(function(opt) {
      var available = playerZone === null || opt.zones.indexOf(playerZone) >= 0;
      // Ranged/melee logic: if no enemies within range, grey out attack options
      var inRange = true;
      if (["standard","heavy","fast","help"].indexOf(opt.id) >= 0) {
        inRange = playerZone === null || (enemies.length === 0) || (closestEnemyDist <= playerDist + 1);
        if (opt.id === "help") { inRange = true; } // help is always possible near ally
      }
      var avail = available && inRange;
      return '<tr style="opacity:' + (avail ? "1" : ".38") + ';' + (avail ? "background:rgba(46,196,182,.04);" : "") + '">'
        + '<td style="padding:.22rem .4rem;font-size:.72rem;font-weight:600;color:' + (avail ? "var(--text)" : "var(--muted2)") + ';white-space:nowrap;">' + opt.label + '</td>'
        + '<td style="padding:.22rem .4rem;font-size:.7rem;color:var(--gold2);white-space:nowrap;">' + opt.cost + '</td>'
        + '<td style="padding:.22rem .4rem;font-size:.68rem;color:var(--muted2);">' + opt.desc + '</td>'
        + '<td style="padding:.22rem .4rem;font-size:.64rem;color:var(--muted);white-space:nowrap;">' + opt.zones.join(", ") + '</td>'
        + '</tr>';
    }).join("");

    var zoneInfo = playerZone
      ? '<span style="color:var(--teal);">' + playerZone + '</span>'
      : '<span style="color:var(--muted2);">unknown (add yourself to map)</span>';
    var enemyZoneInfo = enemies.length
      ? enemies.map(function(u){ return '<span style="color:var(--red2);">' + u.name + '</span> @ ' + u.zone; }).join(", ")
      : '<span style="color:var(--muted2);">none</span>';

    var aoeTemplates = Array.isArray(S.combatMap.aoeTemplates) ? S.combatMap.aoeTemplates : [];
    var activeAoe = aoeTemplates.filter(function (row) {
      return row && String(row.id || '') === String(S.combatMap.activeAoeTemplateId || '');
    })[0] || null;
    var campaignSnap = window.campaignSystem && typeof window.campaignSystem.getState === "function"
      ? (window.campaignSystem.getState() || {})
      : {};
    var showCampaignSceneButton = !!(campaignSnap && campaignSnap.code && campaignSnap.connected);
    var aoeSummary = activeAoe
      ? ('Active: <strong style="color:var(--red2);">' + escapeCombatAoeHtml(String(activeAoe.name || 'AOE')) + '</strong> (' + escapeCombatAoeHtml(String(activeAoe.shape || 'line')) + ' / ' + escapeCombatAoeHtml(getCombatAoeBandSpec(activeAoe.band).label) + ')')
      : 'No active AOE template.';

    el.innerHTML = '<div style="margin-top:.5rem;border-top:1px solid var(--border2);padding-top:.5rem;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--teal);margin-bottom:.3rem;">⚔ Combat Options Available</div>'
      + '<div style="font-size:.68rem;color:var(--muted2);margin-bottom:.3rem;">Your zone: ' + zoneInfo + ' · Enemies: ' + enemyZoneInfo + '</div>'
      + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.72rem;">'
      + '<thead><tr style="border-bottom:1px solid var(--border2);">'
      + '<th style="padding:.18rem .4rem;text-align:left;font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Action</th>'
      + '<th style="padding:.18rem .4rem;text-align:left;font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Cost</th>'
      + '<th style="padding:.18rem .4rem;text-align:left;font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Effect</th>'
      + '<th style="padding:.18rem .4rem;text-align:left;font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Valid Zones</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>'
      + '<div style="font-size:.62rem;color:var(--muted);margin-top:.3rem;font-style:italic;">Greyed options are unavailable from your current zone. Move to unlock them.</div>'
        + '<div style="margin-top:.38rem;padding:.28rem .34rem;border:1px solid rgba(201,64,64,.35);background:rgba(201,64,64,.08);">'
        + '<div style="display:flex;justify-content:space-between;gap:.2rem;align-items:center;">'
        + '<div style="font-size:.62rem;color:var(--red2);font-family:\'Cinzel\',serif;letter-spacing:.08em;text-transform:uppercase;">Effect Tools - AOE</div>'
        + '<button class="btn btn-xs btn-primary" onclick="openCombatAoeEffectTools()">Open AOE Tools</button>'
        + '</div>'
        + '<div style="font-size:.66rem;color:var(--text2);margin-top:.12rem;">' + aoeSummary + '</div>'
        + '<div style="font-size:.64rem;color:var(--muted2);margin-top:.1rem;">Damage rule: success margin equals damage per enemy hit. Spacing: Engaged 1, Close 2, Nearby 3, Far 4 hexes.</div>'
        + (showCampaignSceneButton ? '<div style="margin-top:.2rem;"><button class="btn btn-xs btn-teal" onclick="openCombatCampaignSceneCheck()">GM Scene Check</button></div>' : '')
        + '</div>'
      + '</div>';
  }

  // ── SYNC HOOKS ────────────────────────────────────────────────────────────────
  function runWhenIdle(fn, timeoutMs) {
    if (typeof fn !== "function") { return; }
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(fn, { timeout: timeoutMs || 900 });
      return;
    }
    setTimeout(fn, Math.min(250, Math.max(0, timeoutMs || 120)));
  }

  function patchTabSwitchForNewFeatures() {
    if (typeof window.switchTab !== "function" || window._newFeaturesSwitchPatched) { return; }
    window._newFeaturesSwitchPatched = true;
    var baseSwitch = window.switchTab;
    window.switchTab = function(tabId, btn) {
      var out = baseSwitch.apply(this, arguments);
      if (tabId === "caravan") {
        mountCaravanPanel();
        renderCaravanUI();
      } else if (tabId === "holding") {
        mountHoldingPanel();
        renderHoldingUI();
      } else if (tabId === "trophies") {
        if (window.TrophySystem && typeof window.TrophySystem.renderTab === 'function') {
          window.TrophySystem.renderTab();
        }
      } else if (tabId === "scenes") {
        if (typeof window.renderScenesTabOnOpen === 'function') {
          window.renderScenesTabOnOpen();
        }
      }
      return out;
    };
  }

  function syncNewFeatureUIs() {
    ensureNewFeatureState();
    mountNewFeaturePanels();
    renderCaravanUI();
    renderHoldingUI();
    if (window.TrophySystem && typeof window.TrophySystem.renderTab === 'function') {
      window.TrophySystem.renderTab();
    }
    renderExtraTraits();
    renderCombatMap();
    renderCombatOptions();
  }

  document.addEventListener("DOMContentLoaded", function() {
    ensureNewFeatureState();
    patchTabSwitchForNewFeatures();
    runWhenIdle(function() {
      renderExtraTraits();
      renderCombatMap();
    }, 1200);
  });

  // Chain onto updateCreditsUI so caravan/holding credits readouts stay current
  var _baseUpdateCreditsUI = typeof updateCreditsUI === "function" ? updateCreditsUI : null;
  if (_baseUpdateCreditsUI) {
    updateCreditsUI = function() {
      _baseUpdateCreditsUI();
      renderCaravanUI();
      renderHoldingUI();
    };
  }

  // Chain onto loadCharacter / clearCharacter
  var _baseLoad = typeof loadCharacter === "function" ? loadCharacter : null;
  if (_baseLoad) {
    loadCharacter = function() {
      _baseLoad();
      syncNewFeatureUIs();
    };
  }

  var _baseClear = typeof clearCharacter === "function" ? clearCharacter : null;
  if (_baseClear) {
    clearCharacter = function() {
      _baseClear.apply(this, arguments);
      ensureNewFeatureState();
      syncNewFeatureUIs();
    };
  }

  // Expose globals
  window.selectCaravanSize    = selectCaravanSize;
  window.changeCaravanStress  = changeCaravanStress;
  window.toggleCaravanStress  = toggleCaravanStress;
  window.rollHeavyDamage      = rollHeavyDamage;
  window.repairCaravan        = repairCaravan;
  window.changeCaravanCrew    = changeCaravanCrew;
  window.changeCaravanWheels  = changeCaravanWheels;
  window.updateCaravanCargo   = updateCaravanCargo;
  window.getCaravanCargoMax   = getCaravanCargoMax;
  window.moveCaravanCargoToBackpack = moveCaravanCargoToBackpack;
  window.equipCaravanCargoItem = equipCaravanCargoItem;
  window.useCaravanCargoItem = useCaravanCargoItem;
  window.openCaravanCargoItem = openCaravanCargoItem;
  window.openCombatCampaignSceneCheck = openCombatCampaignSceneCheck;
  window.installMod           = installMod;
  window.removeMod            = removeMod;
  window.setChaseEnemyDread   = setChaseEnemyDread;
  window.startChase           = startChase;
  window.nextChaseRound       = nextChaseRound;
  window.endChase             = endChase;
  window.adjustChaseZone      = adjustChaseZone;
  window.rollChaseControl     = rollChaseControl;
  window.rollChaseEnemyAttack = rollChaseEnemyAttack;
  window.resolveCaravanCardManualPrompt = resolveCaravanCardManualPrompt;
  window.setActiveCaravanEnemy = setActiveCaravanEnemy;
  window.setActiveCaravanAlly = setActiveCaravanAlly;
  window.runCaravanPopupAction = runCaravanPopupAction;
  window.openCaravanCombatPopup = openCaravanCombatPopup;
  window.openCaravanCombatRulesPage = openCaravanCombatRulesPage;
  window.renderCaravanCombatPopup = renderCaravanCombatPopup;
  window.renderCaravanUI      = renderCaravanUI;
  window.mountCaravanPanel    = mountCaravanPanel;
  window.mountHoldingPanel    = mountHoldingPanel;
  window.mountNewFeaturePanels = mountNewFeaturePanels;
  window.renderHoldingUI      = renderHoldingUI;
  window.collectTax           = collectTax;
  window.buyLandmark          = buyLandmark;
  window.updateLandmarkName   = updateLandmarkName;
  window.removeExtraLandmark  = removeExtraLandmark;
  window.updateCouncilMember  = updateCouncilMember;
  window.adjustRetainers      = adjustRetainers;
  window.hireRetainer         = hireRetainer;
  window.rollCouncilTask      = rollCouncilTask;
  window.generateCourtEvent   = generateCourtEvent;
  window.generateCourtTask    = generateCourtTask;
  window.rollLeadershipPeril  = rollLeadershipPeril;
  window.addCrisisByIndex     = addCrisisByIndex;
  window.addManualCrisis      = addManualCrisis;
  window.resolveCrisis        = resolveCrisis;
  window.clearAllCrises       = clearAllCrises;
  window.setHoldingGovernancePolicy = setHoldingGovernancePolicy;
  window.startHoldingQuest    = startHoldingQuest;
  window.advanceHoldingQuest  = advanceHoldingQuest;
  window.holdingQuestStartStep1 = holdingQuestStartStep1;
  window.completeHoldingQuestStep1 = completeHoldingQuestStep1;
  window.skipHoldingQuestStep1 = skipHoldingQuestStep1;
  window.holdingQuestStartStep2 = holdingQuestStartStep2;
  window.holdingQuestExploreRoom = holdingQuestExploreRoom;
  window.holdingQuestResolveRoomConfrontation = holdingQuestResolveRoomConfrontation;
  window.completeHoldingQuestStep2 = completeHoldingQuestStep2;
  window.holdingQuestStartStep3 = holdingQuestStartStep3;
  window.openHoldingQuestFailureOutcomeModal = openHoldingQuestFailureOutcomeModal;
  window.acceptHoldingQuestFailureOutcome = acceptHoldingQuestFailureOutcome;
  window.pushHoldingQuestLuckOutcome = pushHoldingQuestLuckOutcome;
  window.resolveHoldingQuestPushLuck = resolveHoldingQuestPushLuck;
  window.resolveHoldingQuestOutcome = resolveHoldingQuestOutcome;
  window.resolveHoldingQuestStep3 = resolveHoldingQuestStep3;
  window.getHoldingQuestBoardCardHtml = getHoldingQuestBoardCardHtml;
  window.getHoldingQuestTrackerCardHtml = getHoldingQuestTrackerCardHtml;
  window.onHoldingCouncilTaskResolved = onHoldingCouncilTaskResolved;
  window.buyWayfarerHomeUpgrade = buyWayfarerHomeUpgrade;
  window.setWayfarerHomeDecorTheme = setWayfarerHomeDecorTheme;
  window.getWayfarerHomeBonuses = getWayfarerHomeBonuses;
  window.moveVaultItemToBackpack = moveVaultItemToBackpack;
  window.moveBackpackToVault  = moveBackpackToVault;
  window.rollHoldingDowntimeEvent = rollHoldingDowntimeEvent;
  window.rollHoldingDowntimeActivity = rollHoldingDowntimeActivity;
  window.resolveHoldingDowntimeEvent = resolveHoldingDowntimeEvent;
  window.openHoldingSettlementHexcrawl = openHoldingSettlementHexcrawl;
  window.openRegionalSettlementHexcrawl = openRegionalSettlementHexcrawl;
  window.openSeaSettlementHexcrawl = openSeaSettlementHexcrawl;
  window.openSpaceHubHexcrawl = openSpaceHubHexcrawl;
  window.openRuinEncampmentHexcrawl = openRuinEncampmentHexcrawl;
  window.openRuinEncampmentFromProvince = openRuinEncampmentFromProvince;
  window.runHoldingDistrictAction = runHoldingDistrictAction;
  window.runHoldingDistrictActionByKind = runHoldingDistrictActionByKind;
  window.runHoldingDistrictFlavorAction = runHoldingDistrictFlavorAction;
  window.openHoldingGamblingDen = openHoldingGamblingDen;
  window.openHoldingMerchantDistrict = openHoldingMerchantDistrict;
  window.openHoldingDistrictMissionPickup = openHoldingDistrictMissionPickup;
  window.tickHoldingSettlementDaily = tickHoldingSettlementDaily;
  window.toggleHoldingGamblingNode = toggleHoldingGamblingNode;
  window.setHoldingGamblingDifficulty = setHoldingGamblingDifficulty;
  window.setHoldingGamblingGuess = setHoldingGamblingGuess;
  window.playHoldingGamblingRound = playHoldingGamblingRound;
  window.clearHoldingGamblingHistory = clearHoldingGamblingHistory;
  window.selectHoldingSettlementDistrict = selectHoldingSettlementDistrict;
  window.advanceHoldingSettlementTime = advanceHoldingSettlementTime;
  window.resolveHoldingSettlementHexNode = resolveHoldingSettlementHexNode;
  window.openHoldingSettlementSewerRoute = openHoldingSettlementSewerRoute;
  window.openHoldingCrucibleMatch = openHoldingCrucibleMatch;
  window.getHoldingCrucibleMatch = getHoldingCrucibleMatch;
  window.holdingCrucibleSetMode = holdingCrucibleSetMode;
  window.startHoldingMiniGamesExpedition = startHoldingMiniGamesExpedition;
  window.openMiniGamesMode = openMiniGamesMode;
  window.renderMiniGamesPage = renderMiniGamesPage;
  window.holdingCrucibleRestAtDwelling = holdingCrucibleRestAtDwelling;
  window.holdingCrucibleUseHoldingUpgrade = holdingCrucibleUseHoldingUpgrade;
  window.selectHoldingCrucibleUnit = selectHoldingCrucibleUnit;
  window.selectHoldingCrucibleEnemy = selectHoldingCrucibleEnemy;
  window.selectHoldingCrucibleTarget = selectHoldingCrucibleTarget;
  window.selectHoldingCrucibleAllyTarget = selectHoldingCrucibleAllyTarget;
  window.openCrucibleEnemyLore = openCrucibleEnemyLore;
  window.holdingCrucibleExpeditionSwitchTab = holdingCrucibleExpeditionSwitchTab;
  window.holdingCrucibleExpeditionSetMapZoom = holdingCrucibleExpeditionSetMapZoom;
  window.holdingCrucibleExpeditionAdjustMapZoom = holdingCrucibleExpeditionAdjustMapZoom;
  window.holdingCrucibleExpeditionToggleHighContrastOutline = holdingCrucibleExpeditionToggleHighContrastOutline;
  window.holdingCrucibleExpeditionHandleMapWheel = holdingCrucibleExpeditionHandleMapWheel;
  window.holdingCrucibleExpeditionViewportMouseDown = holdingCrucibleExpeditionViewportMouseDown;
  window.holdingCrucibleExpeditionViewportMouseMove = holdingCrucibleExpeditionViewportMouseMove;
  window.holdingCrucibleExpeditionViewportMouseUp = holdingCrucibleExpeditionViewportMouseUp;
  window.holdingCrucibleReturnToHolding = holdingCrucibleReturnToHolding;
  window.holdingCrucibleExpeditionSearchHex = holdingCrucibleExpeditionSearchHex;
  window.holdingCrucibleExpeditionObserveDirection = holdingCrucibleExpeditionObserveDirection;
  window.holdingCrucibleExpeditionObserveAdjacent = holdingCrucibleExpeditionObserveAdjacent;
  window.holdingCrucibleExpeditionRandomEncounter = holdingCrucibleExpeditionRandomEncounter;
  window.holdingCrucibleExpeditionWildernessRoll = holdingCrucibleExpeditionWildernessRoll;
  window.holdingCrucibleExploreExpeditionRuinRoom = holdingCrucibleExploreExpeditionRuinRoom;
  window.holdingCrucibleResolveExpeditionRuinBoss = holdingCrucibleResolveExpeditionRuinBoss;
  window.holdingCrucibleExitExpeditionRuin = holdingCrucibleExitExpeditionRuin;
  window.holdingCrucibleCloseExpeditionGate = holdingCrucibleCloseExpeditionGate;
  window.holdingCrucibleBreachExpeditionPortal = holdingCrucibleBreachExpeditionPortal;
  window.holdingCrucibleSolvePortalPuzzle = holdingCrucibleSolvePortalPuzzle;
  window.holdingCrucibleEquipExpeditionLoot = holdingCrucibleEquipExpeditionLoot;
  window.holdingCrucibleUseExpeditionLoot = holdingCrucibleUseExpeditionLoot;
  window.buildCrucibleExpeditionLoadoutSelectionHtml = buildCrucibleExpeditionLoadoutSelectionHtml;
  window.holdingCrucibleConfirmControlLoadout = holdingCrucibleConfirmControlLoadout;
  window.confirmCrucibleExpeditionLoadout = confirmCrucibleExpeditionLoadout;
  window.cancelCrucibleExpeditionLoadoutSelection = cancelCrucibleExpeditionLoadoutSelection;
  window.applyCrucibleExpeditionFleePenalty = applyCrucibleExpeditionFleePenalty;
  window.getCrucibleExpeditionStartingArmorOptions = getCrucibleExpeditionStartingArmorOptions;
  window.getCrucibleExpeditionStartingWeaponOptions = getCrucibleExpeditionStartingWeaponOptions;
  window.getCrucibleExpeditionStartingPassiveFeatures = getCrucibleExpeditionStartingPassiveFeatures;
  window.getCrucibleExpeditionWayfarerActionDice = getCrucibleExpeditionWayfarerActionDice;
  window.getCrucibleExpeditionAvailableRaidNodes = getCrucibleExpeditionAvailableRaidNodes;
  window.holdingCrucibleExpeditionMoveTo = holdingCrucibleExpeditionMoveTo;
  window.holdingCrucibleMoveSelected = holdingCrucibleMoveSelected;
  window.holdingCrucibleTeleportSelected = holdingCrucibleTeleportSelected;
  window.holdingCrucibleUseExpeditionFlask = holdingCrucibleUseExpeditionFlask;
  window.holdingCruciblePrayAtTemple = holdingCruciblePrayAtTemple;
  window.refreshCrucibleWayfarerActionOptions = refreshCrucibleWayfarerActionOptions;
  window.refreshCrucibleTeamActionOptions = refreshCrucibleTeamActionOptions;
  window.refreshCrucibleEnemyActionOptions = refreshCrucibleEnemyActionOptions;
  window.holdingCrucibleExecuteWayfarerAction = holdingCrucibleExecuteWayfarerAction;
  window.holdingCrucibleExecuteTeamAction = holdingCrucibleExecuteTeamAction;
  window.holdingCrucibleExecuteEnemyAction = holdingCrucibleExecuteEnemyAction;
  window.holdingCrucibleAttackSelected = holdingCrucibleAttackSelected;
  window.holdingCrucibleGuardSelected = holdingCrucibleGuardSelected;
  window.holdingCrucibleEndSelectedUnit = holdingCrucibleEndSelectedUnit;
  window.holdingCrucibleAdvanceRound = holdingCrucibleAdvanceRound;
  window.resolveCrucibleExpeditionCombatRound = resolveCrucibleExpeditionCombatRound;
  window.queueCrucibleExpeditionCombatAction = queueCrucibleExpeditionCombatAction;
  window.holdingCrucibleAutoResolve = holdingCrucibleAutoResolve;
  window.holdingCrucibleRunEnemyAI = holdingCrucibleRunEnemyAI;
  window.holdingCrucibleHandleBoardUnitClick = holdingCrucibleHandleBoardUnitClick;
  window.holdingCrucibleHandleBoardHexClick = holdingCrucibleHandleBoardHexClick;
  window.holdingCrucibleStartDrag = holdingCrucibleStartDrag;
  window.holdingCrucibleEndDrag = holdingCrucibleEndDrag;
  window.holdingCrucibleHandleHexDragOver = holdingCrucibleHandleHexDragOver;
  window.holdingCrucibleDropOnHex = holdingCrucibleDropOnHex;
  window.holdingCrucibleResetMatch = holdingCrucibleResetMatch;
  window.openHoldingBankingModal = openHoldingBankingModal;
  window.commitHoldingBankInvestment = commitHoldingBankInvestment;
  window.commitHoldingBankInvestmentFromModal = commitHoldingBankInvestmentFromModal;
  window.withdrawHoldingBankInvestment = withdrawHoldingBankInvestment;
  window.tickHoldingBankInvestments = tickHoldingBankInvestments;
  window.buildHoldingBankPanelHtml = buildHoldingBankPanelHtml;
  window.buyCaravan           = buyCaravan;
  window.rollCaravanName      = rollCaravanName;
  window.clearCaravanName     = clearCaravanName;
  window.rollCaravanPowerSource = rollCaravanPowerSource;
  window.clearCaravanPowerSource = clearCaravanPowerSource;
  window.rollHoldingName      = rollHoldingName;
  window.clearHoldingName     = clearHoldingName;
  window.spendPathTokensUpgrade15 = spendPathTokensUpgrade15;
  window.doPathUpgrade15          = doPathUpgrade15;
  window.spendPathTokensUpgrade20 = spendPathTokensUpgrade20;
  window.renderExtraTraits        = renderExtraTraits;
  window.removeExtraTrait         = removeExtraTrait;
  window.addCombatUnit            = addCombatUnit;
  window.shiftCombatUnitZone      = shiftCombatUnitZone;
  window.moveCombatUnit           = moveCombatUnit;
  window.removeCombatUnit         = removeCombatUnit;
  window.clearCombatMap           = clearCombatMap;
  window.renderCombatMap          = renderCombatMap;
  window.renderCombatOptions      = renderCombatOptions;
  window.openCombatAoeEffectTools = openCombatAoeEffectTools;
  window.onCombatAoeSpellPresetChange = onCombatAoeSpellPresetChange;
  window.applyCombatAoeTemplateFromModal = applyCombatAoeTemplateFromModal;
  window.removeCombatAoeTemplate = removeCombatAoeTemplate;
  window.clearCombatAoeTemplates = clearCombatAoeTemplates;
  window.applyActiveCombatAoeTick = applyActiveCombatAoeTick;
  window.AOE_SPELL_PRESETS = Array.isArray(AOE_SPELL_PRESETS) ? AOE_SPELL_PRESETS.slice() : [];

  // ── SHOP: SMART BUY ───────────────────────────────────────────────────────────
  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  function getAvailableWeaponModSlots() {
    ensureNewFeatureState();
    var total = 0;
    [S.equipment.weapon1, S.equipment.weapon2].forEach(function(w) {
      if (!w) { return; }
      var m = w.match(/\+(\d)/);
      if (m) {
        var b = parseInt(m[1], 10);
        if (b >= 1 && b <= 4) { total += b; }
      }
    });
    return total;
  }

  var _baseBuyItem = typeof window.buyItem === 'function' ? window.buyItem : null;

  window.buyItem = function(cost, name, cat) {
    ensureNewFeatureState();
    cat = cat || 'other';

    if (cat === 'augmentations') {
      if ((S.renown || 0) < 3) {
        showNotif('Renown +3 required to install Augmentations!', 'warn'); return;
      }
      if ((S.pathTokens || 0) < 5) {
        showNotif('Need 5 Path Tokens to install an Augmentation!', 'warn'); return;
      }
      if ((S.credits || 0) < cost) {
        showNotif('Not enough credits!', 'warn'); return;
      }
      var maxAugs = Math.floor((S.stats.body || 4) / 2);
      if (S.augmentations.length >= maxAugs) {
        showNotif('No Augmentation slots available (Body ÷ 2 = ' + maxAugs + ')!', 'warn'); return;
      }
      if (S.augmentations.indexOf(name) >= 0) {
        showNotif(name + ' is already installed!', 'warn'); return;
      }
      S.credits = Math.max(0, (S.credits || 0) - cost);
      S.pathTokens = Math.max(0, (S.pathTokens || 0) - 5);
      updateCreditsUI();
      var ptEl = document.getElementById('pathTokensVal');
      if (ptEl) { ptEl.textContent = S.pathTokens; }
      S.augmentations.push(name);
      var augData = (SHOP_DATA.augmentations || []).find(function(a) { return a.name === name; });
      var traitLabel = '🦶 ' + name + (augData ? ' — ' + augData.stat : ' — Augmentation');
      if (S.extraTraits.indexOf(traitLabel) < 0) S.extraTraits.push(traitLabel);
      if (typeof renderExtraTraits === 'function') { renderExtraTraits(); }
      if (typeof renderOSHacksPanel === 'function') renderOSHacksPanel();
      if (typeof renderAugmentationsPanel === 'function') { renderAugmentationsPanel(); }
      var shopCatBtn = document.querySelector('.shop-cats .scat.on');
      if (typeof showShopCat === 'function') { showShopCat('augmentations', shopCatBtn); }
      showNotif('Augmentation installed: ' + name + ' (−5 Path Tokens, −' + cost + '₵)', 'good');
      if (window.TrophySystem) window.TrophySystem.check('first_shop_purchase');
      return;
    }

    if (cat === 'os_hacks' && S.augmentations.indexOf('OPERATING SYSTEM') < 0) {
      showNotif('OPERATING SYSTEM augmentation required to buy Hacks!', 'warn');
      return;
    }

    if (_baseBuyItem) {
      var beforeCredits = Number(S.credits || 0);
      _baseBuyItem(cost, name, cat);
      if (Number(S.credits || 0) < beforeCredits && window.TrophySystem) {
        window.TrophySystem.check('first_shop_purchase');
      }
      return;
    }

    showNotif('Buy flow unavailable.', 'warn');
  };

  // ── WEAPON MODS PANEL ─────────────────────────────────────────────────────────
  function renderWeaponModsPanel() {
    var el = document.getElementById('weaponModsDisplay');
    if (!el) { return; }
    ensureNewFeatureState();
    var mods = Array.isArray(S.weaponMods) ? S.weaponMods : [];

    var weaponEntries = [
      { label: 'Slot 1', name: S.equipment.weapon1 || '' },
      { label: 'Slot 2', name: S.equipment.weapon2 || '' }
    ].filter(function(w) { return w.name.trim(); });

    if (!weaponEntries.length) {
      if (!mods.length) {
        el.innerHTML = '<div style="font-size:.76rem;color:var(--muted2);">No weapons equipped.</div>';
        return;
      }
      el.innerHTML = '<div style="font-size:.76rem;color:var(--muted2);margin-bottom:.3rem;">No weapons equipped. Purchased mods are held until a weapon with slots is equipped.</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);">'
        + '<strong style="color:var(--text2);">Unassigned:</strong> '
        + mods.map(function(mod, i) {
            return mod
              + ' <button class="bp-info-btn" title="Mod info" onclick="showWeaponModInfo(\'' + mod.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')">?</button>'
              + ' <button class="btn btn-xs btn-red" style="padding:.02rem .22rem;font-size:.56rem;" onclick="removeWeaponMod(' + i + ')">✕</button>';
          }).join(' · ')
        + '</div>';
      return;
    }

    var html = '';
    var modIdx = 0;

    weaponEntries.forEach(function(w) {
      var m = w.name.match(/\+(\d)/);
      var bonus = m ? parseInt(m[1], 10) : 0;
      if (bonus < 1 || bonus > 4) {
        html += '<div style="font-size:.76rem;color:var(--muted2);padding:.2rem 0;">'
          + '<strong style="color:var(--text2);">' + w.label + ':</strong> ' + w.name
          + ' — No mod slots (Ad# or no bonus)</div>';
        return;
      }
      var isRanged = /shoot/i.test(w.name);
      var typeLabel = isRanged ? 'Ranged' : 'Melee';
      html += '<div style="background:var(--surface);border:1px solid var(--border2);padding:.4rem .6rem;margin-bottom:.3rem;">'
        + '<div style="font-size:.75rem;font-family:\'Cinzel\',serif;color:var(--gold2);margin-bottom:.2rem;">'
        + w.label + ': ' + w.name
        + ' <span style="color:var(--muted2);font-size:.62rem;">(' + bonus + ' ' + typeLabel + ' Mod Slot' + (bonus > 1 ? 's' : '') + ')</span></div>';
      for (var i = 0; i < bonus; i++) {
        var mod = S.weaponMods[modIdx] || null;
        var slotIdx = modIdx;
        html += '<div style="display:flex;align-items:center;gap:.4rem;font-size:.74rem;padding:.08rem 0;">'
          + '<span style="color:var(--muted2);font-size:.58rem;font-family:\'Cinzel\',serif;white-space:nowrap;">Slot ' + (i + 1) + ':</span>'
          + '<span style="color:' + (mod ? 'var(--teal)' : 'var(--muted)') + ';flex:1;">' + (mod || '\u2014 Empty \u2014') + '</span>'
          + (mod ? '<button class="bp-info-btn" title="Mod info" onclick="showWeaponModInfo(\'' + mod.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')">?</button>' : '')
          + (mod ? '<button class="btn btn-xs btn-red" style="padding:.04rem .28rem;font-size:.58rem;" onclick="removeWeaponMod(' + slotIdx + ')">✕</button>' : '')
          + '</div>';
        if (mod) { modIdx++; }
      }
      html += '</div>';
    });

    // Unassigned mods overflow
    var unassigned = S.weaponMods.slice(modIdx);
    if (unassigned.length) {
      html += '<div style="font-size:.72rem;color:var(--muted2);margin-top:.3rem;padding-top:.3rem;border-top:1px solid var(--border);">'
        + '<strong style="color:var(--text2);">Unassigned:</strong> '
        + unassigned.map(function(mod, i) {
            return mod
              + ' <button class="bp-info-btn" title="Mod info" onclick="showWeaponModInfo(\'' + mod.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')">?</button>'
              + ' <button class="btn btn-xs btn-red" style="padding:.02rem .22rem;font-size:.56rem;" onclick="removeWeaponMod(' + (modIdx + i) + ')">✕</button>';
          }).join(' · ')
        + '</div>';
    }

    el.innerHTML = html;
  }

  function removeWeaponMod(idx) {
    ensureNewFeatureState();
    S.weaponMods.splice(idx, 1);
    renderWeaponModsPanel();
    showNotif('Weapon Mod removed.', '');
  }

  function showWeaponModInfo(modName) {
    var mods = (typeof SHOP_DATA !== 'undefined' && SHOP_DATA.weapon_mods) ? SHOP_DATA.weapon_mods : [];
    var item = null;
    for (var i = 0; i < mods.length; i++) { if (mods[i].name === modName) { item = mods[i]; break; } }
    if (!item) { openModal('Weapon Mod', '<div style="font-size:.9rem;color:var(--text2);">' + modName + '</div>', null, { preventScroll: true, focusTrap: true }); return; }
    var html = '<div style="font-size:.9rem;color:var(--text2);line-height:1.7;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.75rem;letter-spacing:.1em;color:var(--gold);margin-bottom:.3rem;">🔩 ' + item.name + '</div>'
      + '<div style="font-size:.78rem;color:var(--teal);margin-bottom:.4rem;">' + item.stat + '</div>'
      + '<div>' + item.desc + '</div>'
      + '</div>';
    openModal(item.name, html, null, { preventScroll: true, focusTrap: true });
  }

  // ── AUGMENTATIONS PANEL ───────────────────────────────────────────────────────
  function renderAugmentationsPanel() {
    var el = document.getElementById('augmentationsDisplay');
    if (!el) { return; }
    ensureNewFeatureState();
    var augs = Array.isArray(S.augmentations) ? S.augmentations : [];
    if (!augs.length) {
      el.innerHTML = '<div style="font-size:.76rem;color:var(--muted2);">No augmentations installed.</div>';
      return;
    }
    var html = augs.map(function(name, i) {
      var aug = null;
      var list = (typeof SHOP_DATA !== 'undefined' && SHOP_DATA.augmentations) ? SHOP_DATA.augmentations : [];
      for (var j = 0; j < list.length; j++) { if (list[j].name === name) { aug = list[j]; break; } }
      return '<div style="display:flex;align-items:center;gap:.35rem;background:var(--surface);border:1px solid var(--border2);padding:.25rem .45rem;margin-bottom:.2rem;border-radius:3px;">'
        + '<span style="font-size:.75rem;color:var(--gold2);flex:1;font-family:\'Cinzel\',serif;">' + name + '</span>'
        + (aug ? '<span style="font-size:.64rem;color:var(--muted2);">' + aug.stat.replace('Augmentation | ','') + '</span>' : '')
        + '<button class="bp-info-btn" title="Augmentation info" onclick="showAugmentationInfo(\'' + name.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')">?</button>'
        + '<button class="btn btn-xs btn-red" style="padding:.03rem .28rem;font-size:.58rem;" onclick="removeAugmentation(' + i + ')">✕</button>'
        + '</div>';
    }).join('');
    el.innerHTML = html;
  }

  function showAugmentationInfo(augName) {
    var list = (typeof SHOP_DATA !== 'undefined' && SHOP_DATA.augmentations) ? SHOP_DATA.augmentations : [];
    var item = null;
    for (var i = 0; i < list.length; i++) { if (list[i].name === augName) { item = list[i]; break; } }
    if (!item) { openModal('Augmentation', '<div style="font-size:.9rem;color:var(--text2);">' + augName + '</div>', null, { preventScroll: true, focusTrap: true }); return; }
    var html = '<div style="font-size:.9rem;color:var(--text2);line-height:1.7;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.75rem;letter-spacing:.1em;color:var(--gold);margin-bottom:.3rem;">🦾 ' + item.name + '</div>'
      + '<div style="font-size:.78rem;color:var(--teal);margin-bottom:.4rem;">' + item.stat + '</div>'
      + '<div>' + item.desc + '</div>'
      + '</div>';
    openModal(item.name, html, null, { preventScroll: true, focusTrap: true });
  }

  function removeAugmentation(idx) {
    ensureNewFeatureState();
    if (!Array.isArray(S.augmentations)) { return; }
    S.augmentations.splice(idx, 1);
    renderAugmentationsPanel();
    if (typeof renderOSHacksPanel === 'function') { renderOSHacksPanel(); }
    if (typeof updateAllStatDisplays === 'function') { updateAllStatDisplays(); }
    showNotif('Augmentation removed.', '');
  }

  // ── CHAR TAB DREAD DIE ROLLER ─────────────────────────────────────────────────
  var charDreadDieSize = 8;

  function initCharDreadDiceOpts() {
    var el = document.getElementById('charDreadDiceOpts');
    if (!el) { return; }
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
    el.innerHTML = '<label class="sub-label" for="charDreadDieSelect" style="margin-bottom:.15rem;">Choose Dread Die</label>'
      + '<select id="charDreadDieSelect" onchange="selectCharDreadDie(this.value)" style="max-width:10rem;">'
      + [4, 6, 8, 10, 12, 20].map(function(d) {
        return '<option value="' + d + '"' + (d === charDreadDieSize ? ' selected' : '') + '>d' + d + '</option>';
      }).join('')
      + '</select>';
  }

  function selectCharDreadDie(d) {
    charDreadDieSize = Math.max(1, parseInt(d, 10) || 8);
    var sel = document.getElementById('charDreadDieSelect');
    if (sel) sel.value = String(charDreadDieSize);
  }

  function rollCharDreadDie() {
    var result = explodingRoll(charDreadDieSize);
    var el = document.getElementById('charDreadResult');
    if (!el) { return; }
    el.innerHTML = '<span style="color:var(--red);font-size:1.1rem;font-weight:700;">' + result.total + '</span>'
      + ' <span style="font-size:.75rem;color:var(--muted2);">Dread d' + charDreadDieSize + (result.exploded ? ' ✦ Exploded!' : '') + '</span>'
      + '<div style="font-size:.73rem;color:var(--muted2);margin-top:.15rem;">Beat this with your stat die to succeed. (GM decides if failure costs Stress)</div>';
  }

  // ── HACK EFFECTS TABLE ────────────────────────────────────────────────────────
  var HACK_EFFECTS = {
    'Javelin':              { tmw: 1,  effect: function() { var d=roll(10); return 'On success, deal <strong>'+d+' damage</strong> to your target. (1d10)'; } },
    'Ember':                { tmw: 2,  effect: function() { return 'On success, the enemy becomes <strong>Vulnerable</strong> (their Dread Die is reduced by one step).'; } },
    'Short Circuit':        { tmw: 4,  effect: function() { return 'The target <strong>cannot make an action for 2 rounds</strong>.'; } },
    'Reboot Optics':        { tmw: 3,  effect: function() { return 'Enemy rolls with <strong>Step Up Disadvantage</strong> for 3 Rounds (rolls higher die, takes lowest).'; } },
    'Weapon Glitch':        { tmw: 2,  effect: function() { return "Target's <strong>weapons don't work</strong> for 2 Rounds."; } },
    'Ping':                 { tmw: 1,  effect: function() { return 'You reveal all available targets in the zone and gain <strong>Advantage d6 (Ad6)</strong> against them.'; } },
    'Sonic Shock':          { tmw: 2,  effect: function() { var d=roll(4); return 'Gain <strong>+'+d+'</strong> to Attack rolls against that enemy. (d4 rolled)'; } },
    'Take Control':         { tmw: 1,  effect: function() { return 'You <strong>remotely operate</strong> a small electronic device.'; } },
    'Counterspell':         { tmw: 2,  effect: function() { return '<strong>Enemy Hack countered!</strong>'; } },
    'Brake':                { tmw: 5,  effect: function() { return 'Vehicle is <strong>forced to stop</strong>.'; } },
    'LASHOUT (Master)':     { tmw: 10, effect: function() { return 'Enemy <strong>forced to attack</strong> nearest ally/hostile (or commits suicide if alone).'; } },
    'SUICIDE (Master)':     { tmw: 15, effect: function() { return 'Enemy <strong>forced to kill themselves</strong>.'; } },
    'COLLAPSE (Master)':    { tmw: 12, effect: function() { return 'Enemy <strong>crippled for the day</strong> — cannot act.'; } },
    'DETONATE GRENADE (Master)': { tmw: 10, effect: function() { var d=roll(10)+roll(10); return 'Explosion deals <strong>'+d+' damage</strong>. (2d10)'; } },
    'AEGIES (Master)':      { tmw: 10, effect: function() { return 'You gain <strong>+10 to Defend Rolls</strong> for this Combat Scene.'; } },
    'PARASYTE (Master)':    { tmw: 12, effect: function() { var vd=S.stats&&S.stats.valor?S.stats.valor:4; var d=roll(vd); return 'Enemy takes <strong>'+d+' Stress per Round</strong> for 12 Rounds. (Valor d'+vd+' rolled)'; } }
  };

  // ── OS HACKS PANEL ────────────────────────────────────────────────────────────
  function renderOSHacksPanel() {
    var panel = document.getElementById('osHacksPanel');
    if (!panel) { return; }
    ensureNewFeatureState();

    var hasOS = S.augmentations.indexOf('OPERATING SYSTEM') >= 0;
    panel.style.display = hasOS ? '' : 'none';
    if (!hasOS) { return; }

    // Owned Hacks list
    var listEl = document.getElementById('ownedHacksList');
    if (listEl) {
      if (!S.ownedHacks.length) {
        listEl.innerHTML = ''
          + '<div style="font-size:.76rem;color:var(--muted2);margin-bottom:.35rem;">No Hacks acquired yet. Buy OS Hacks in Merchants or unlock Master Hacks through Black Market encounters.</div>'
          + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.2rem;">'
          + '<button class="btn btn-xs btn-primary" onclick="switchTab(\'shop\',document.getElementById(\'tabnav-shop\'))">Open Merchant</button>'
          + '<button class="btn btn-xs" onclick="switchTab(\'traveling\',document.getElementById(\'tabnav-traveling\'))">Travel For Black Market</button>'
          + '</div>';
      } else {
        listEl.innerHTML = S.ownedHacks.map(function(hackName, i) {
          var hackData = (SHOP_DATA.os_hacks || []).find(function(h) { return h.name === hackName; });
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.22rem .4rem;background:var(--surface);border:1px solid var(--border2);margin-bottom:.18rem;">'
            + '<div>'
            + '<span style="font-size:.78rem;color:var(--teal);">' + hackName + '</span>'
            + (hackData ? '<span style="font-size:.66rem;color:var(--muted2);margin-left:.4rem;">' + hackData.stat + '</span>' : '')
            + '</div>'
            + '<button class="btn btn-xs btn-red" onclick="removeOwnedHack(' + i + ')">✕</button>'
            + '</div>';
        }).join('');
      }
    }

    // Hack selector
    var sel = document.getElementById('hackSelect');
    if (sel) {
      var prev = S.hackRoller.selectedHack;
      sel.innerHTML = '<option value="">— Select Hack —</option>'
        + S.ownedHacks.map(function(h) {
          return '<option value="' + h + '"' + (h === prev ? ' selected' : '') + '>' + h + '</option>';
        }).join('');
    }

    // Dread die options
    var dreadOpts = document.getElementById('hackDreadOpts');
    if (dreadOpts) {
      dreadOpts.removeAttribute('role');
      dreadOpts.removeAttribute('aria-label');
      dreadOpts.innerHTML = '<select id="hackDreadDieSelect" onchange="setHackDreadDie(this.value)" style="max-width:10rem;">'
        + [4, 6, 8, 10, 12, 20].map(function(d) {
          return '<option value="' + d + '"' + (S.hackRoller.dreadDie === d ? ' selected' : '') + '>d' + d + '</option>';
        }).join('')
        + '</select>';
    }

    // Guess buttons
    ['below', 'between', 'above'].forEach(function(g) {
      var btn = document.getElementById('hack-guess-' + g);
      if (btn) { btn.classList.toggle('sel', S.hackRoller.guess === g); }
    });
  }

  function removeOwnedHack(idx) {
    ensureNewFeatureState();
    S.ownedHacks.splice(idx, 1);
    if (S.hackRoller.selectedHack && S.ownedHacks.indexOf(S.hackRoller.selectedHack) < 0) {
      S.hackRoller.selectedHack = null;
    }
    renderOSHacksPanel();
  }

  function setHackGuess(guess) {
    ensureNewFeatureState();
    S.hackRoller.guess = guess;
    ['below', 'between', 'above'].forEach(function(g) {
      var btn = document.getElementById('hack-guess-' + g);
      if (btn) { btn.classList.toggle('sel', g === guess); }
    });
  }

  function setHackDreadDie(die) {
    ensureNewFeatureState();
    S.hackRoller.dreadDie = Math.max(1, parseInt(die, 10) || 6);
    var sel = document.getElementById('hackDreadDieSelect');
    if (sel) sel.value = String(S.hackRoller.dreadDie);
  }

  function isNewFeaturesManualRollMode() {
    return !!(window.settingsSystem && typeof window.settingsSystem.isManualRollMode === 'function' && window.settingsSystem.isManualRollMode());
  }

  function getHackGuessLabel(value) {
    var key = String(value || 'between').toLowerCase();
    if (key === 'between') return 'Middle';
    return capFirst(key);
  }

  function applyHackCastOutcome(payload) {
    var data = payload || {};
    var hackName = String(data.hackName || 'Unknown Hack');
    var hackData = data.hackData || HACK_EFFECTS[hackName] || null;
    var dreadDie = Math.max(4, Number(data.dreadDie || 6));
    var low = Math.max(1, Number(data.low || 1));
    var high = Math.max(low, Number(data.high || low));
    var valorDie = Math.max(4, Number(data.valorDie || data.ctrlDie || 4));
    var valorVal = Math.max(1, Number(data.valorVal || data.ctrlVal || 1));
    var guess = String(data.guess || S.hackRoller.guess || 'between');
    var tmwCost = Math.max(0, Number(data.tmwCost || 0));
    var manual = !!data.manual;
    var combatEnemy = data.combatEnemy || ((typeof getPrimaryCombatEnemy === 'function') ? getPrimaryCombatEnemy() : null);
    var spellMeta = data.spellMeta || null;

    var actual;
    if (valorVal < low) actual = 'below';
    else if (valorVal > high) actual = 'above';
    else actual = 'between';

    var success = actual === guess;
    var effectHtml = '';
    if (success && hackData && hackData.effect) {
      var effectText = (S.combat && S.combat.active && combatEnemy && typeof applyCombatHackEffect === 'function')
        ? (applyCombatHackEffect(hackName) || hackData.effect())
        : hackData.effect();
      effectHtml = '<br><span style="color:var(--teal);">' + effectText + '</span>';
    }

    var malwareHtml = '';
    var malwareBy = Math.max(1, (high - low) || 1);
    var malwareDmg = 0;
    var hadDistractedBefore = !!(S && S.conditions && S.conditions.distracted);
    if (!success) {
      malwareDmg = roll(6);
      malwareBy = Math.max(1, malwareBy + malwareDmg);
      S.tmw = Math.max(0, (S.tmw || 0) - 1);
      if (typeof updateTMWPool === 'function') updateTMWPool();
      if (typeof changeHealth === 'function') changeHealth(malwareDmg);
      malwareHtml = '<br><span style="color:var(--red2);">Malware! Lost 1 TMW and took <strong>' + malwareDmg + ' Stress</strong> (1d6). Distracted applied.</span>';
      S.conditions = S.conditions || {};
      S.conditions.distracted = true;
      if (typeof updateConditionButtons === 'function') updateConditionButtons();
      if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
    }

    var resultEl = document.getElementById('hackRollResult');
    if (resultEl) {
      resultEl.innerHTML = '<div class="gamble-rolls">'
        + '<div class="gamble-die"><div class="gd-label">Dread Low</div><div class="gd-value" style="color:var(--red);">' + low + '</div></div>'
        + '<div class="gamble-die"><div class="gd-label">Valor d' + valorDie + '</div><div class="gd-value" style="color:var(--teal);">' + valorVal + '</div></div>'
        + '<div class="gamble-die"><div class="gd-label">Dread High</div><div class="gd-value" style="color:var(--red);">' + high + '</div></div>'
        + '</div>'
        + (tmwCost > 0 ? '<div style="font-size:.72rem;color:var(--muted2);margin:.25rem 0;">-' + tmwCost + ' TMW spent · ' + (S.tmw || 0) + ' remaining</div>' : '')
        + '<div class="gamble-outcome ' + (success ? 'good' : 'warn') + '" style="margin-top:.4rem;">'
        + '<strong style="color:' + (success ? 'var(--green2)' : 'var(--red2)') + ';">' + (success ? 'Hack Succeeded!' : 'Hack Failed - Malware!') + '</strong><br>'
        + 'Dread d' + dreadDie + ': ' + low + '-' + high
        + ' | Guess: <strong>' + getHackGuessLabel(guess) + '</strong>'
        + ' | Valor: ' + valorVal + ' (<em>' + getHackGuessLabel(actual) + (manual ? ', manual' : '') + '</em>)'
        + effectHtml
        + malwareHtml
        + '</div>';
    }

    if (success) {
      var hackMargin = 1;
      if (actual === 'below') hackMargin = Math.max(1, low - valorVal);
      else if (actual === 'above') hackMargin = Math.max(1, valorVal - high);
      else hackMargin = Math.max(1, Math.min(valorVal - low, high - valorVal) + 1);
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome('spell', hackMargin, {
          actionTotal: valorVal,
          dreadTotal: actual === 'below' ? low : (actual === 'above' ? high : Math.round((low + high) / 2)),
          context: 'Hack cast: ' + hackName
        });
      }
      if (typeof addSuccessRoll === 'function') addSuccessRoll();
    } else {
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome('spell', Math.max(1, malwareBy), {
          actionTotal: valorVal,
          dreadTotal: actual === 'below' ? low : (actual === 'above' ? high : Math.round((low + high) / 2)),
          context: 'Hack cast: ' + hackName
        });
      }
      if (typeof addTMWOnFail === 'function') {
        addTMWOnFail('hack-cast-failure', {
          failedBy: Math.max(1, malwareBy),
          actionDie: valorDie,
          dreadDie: dreadDie,
          actionLabel: 'Valor Die',
          onConvert: function () {
            if (typeof changeCounter === 'function') {
              changeCounter('tmw', 1);
            } else {
              S.tmw = Math.max(0, Number(S.tmw || 0) + 1);
              if (typeof updateTMWPool === 'function') updateTMWPool();
            }
            if (malwareDmg > 0 && typeof changeHealth === 'function') {
              changeHealth(-malwareDmg);
            }
            if (!hadDistractedBefore && S && S.conditions) {
              S.conditions.distracted = false;
              if (typeof updateConditionButtons === 'function') updateConditionButtons();
              if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
            }
            if (hackData && hackData.effect) {
              var convertedEffect = (S.combat && S.combat.active && combatEnemy && typeof applyCombatHackEffect === 'function')
                ? (applyCombatHackEffect(hackName) || hackData.effect())
                : hackData.effect();
              effectHtml = '<br><span style="color:var(--teal);">' + convertedEffect + '</span>';
            }
            var convertEl = document.getElementById('hackRollResult');
            if (convertEl) {
              convertEl.innerHTML = '<div class="gamble-outcome good" style="margin-top:.4rem;">'
                + '<strong style="color:var(--green2);">Hack Converted To Success!</strong><br>'
                + 'Original roll was recovered with Teamwork.'
                + effectHtml
                + '</div>';
            }
            if (typeof showDccSuccessOutcome === 'function') {
              showDccSuccessOutcome('spell', Math.max(1, malwareBy), {
                actionTotal: valorVal,
                dreadTotal: actual === 'below' ? low : (actual === 'above' ? high : Math.round((low + high) / 2)),
                context: 'Hack cast (teamwork convert): ' + hackName
              });
            }
            if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
              window.BTLRules.recordTeamworkConvertedSuccess('hack-teamwork-convert');
            }
            if (typeof showNotif === 'function') showNotif('Hack failure converted to success via Teamwork. No Successful Roll gained.', 'good');
            return true;
          }
        });
      }
    }

    if (spellMeta && spellMeta.profile) {
      var displayDread = actual === 'below' ? low : (actual === 'above' ? high : Math.round((low + high) / 2));
      var displayMargin = success
        ? (actual === 'below'
            ? Math.max(1, low - valorVal)
            : (actual === 'above' ? Math.max(1, valorVal - high) : Math.max(1, Math.min(valorVal - low, high - valorVal) + 1)))
        : Math.max(1, malwareBy);
      showUnifiedSpellResultModal('Hack Manifestation - ' + hackName, spellMeta.profile, {
        success: success,
        margin: displayMargin,
        actionTotal: valorVal,
        dreadTotal: displayDread,
        context: 'Hack cast: ' + hackName,
        manual: manual,
        circData: spellMeta.circData
      });
    }

    if (typeof renderQP === 'function' && S.quickPanel) {
      S.quickPanel.lastCombatRoll = (resultEl && resultEl.innerHTML) ? resultEl.innerHTML : S.quickPanel.lastCombatRoll;
      renderQP('combat');
    }
    return success;
  }

  function openManualHackCastModal(payload) {
    var data = payload || {};
    S.hackRoller.pendingManual = {
      hackName: String(data.hackName || ''),
      tmwCost: Math.max(0, Number(data.tmwCost || 0)),
      dreadDie: Math.max(4, Number(data.dreadDie || 6)),
      combatEnemyId: String(data.combatEnemy && data.combatEnemy.id || ''),
      spellMeta: data.spellMeta || null
    };
    var extraLines = [];
    if (data.spellMeta && data.spellMeta.circData && Array.isArray(data.spellMeta.circData.modifierLines)) {
      extraLines = data.spellMeta.circData.modifierLines;
    }
    var modHtml = extraLines.length
      ? ('<div style="font-size:.7rem;color:var(--muted2);margin-top:.24rem;line-height:1.45;">' + extraLines.map(function (line) { return '<div>• ' + line + '</div>'; }).join('') + '</div>')
      : '';
    var html = '<div style="font-size:.82rem;color:var(--text2);line-height:1.54;">'
      + '<div style="margin-bottom:.22rem;">Manual Hack Roll: enter your rolled values and resolve against your guess <strong>' + getHackGuessLabel(S.hackRoller.guess || 'between') + '</strong>.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,minmax(100px,1fr));gap:.3rem;">'
      + '<label style="font-size:.7rem;color:var(--muted2);">Dread Low<input id="manualHackLow" type="number" min="1" placeholder="1+ (explode ok)" style="width:100%;margin-top:.08rem;"></label>'
      + '<label style="font-size:.7rem;color:var(--muted2);">Dread High<input id="manualHackHigh" type="number" min="1" placeholder="1+ (explode ok)" style="width:100%;margin-top:.08rem;"></label>'
      + '<label style="font-size:.7rem;color:var(--muted2);">Valor Total<input id="manualHackControl" type="number" min="1" max="999" style="width:100%;margin-top:.08rem;"></label>'
      + '</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-top:.2rem;">Cost on resolve: ' + Number(data.tmwCost || 0) + ' TMW.</div>'
      + modHtml
      + '<div style="margin-top:.28rem;">'
      + buildNestedModalActionRow(
          '<button class="btn btn-sm btn-primary" onclick="resolveManualHackCast()">Resolve Manual Hack</button>',
          { cancelLabel: 'Go Back' }
        )
      + '</div>'
      + '</div>';
    if (typeof openModal === 'function') openModal('Manual Hack Cast', html, null, { preventScroll: true, focusTrap: true });
  }

  function resolveManualHackCast() {
    ensureNewFeatureState();
    var pending = (S.hackRoller && S.hackRoller.pendingManual) ? S.hackRoller.pendingManual : null;
    if (!pending) {
      if (typeof showNotif === 'function') showNotif('No pending manual hack cast.', 'warn');
      return false;
    }
    var lowEl = document.getElementById('manualHackLow');
    var highEl = document.getElementById('manualHackHigh');
    var controlEl = document.getElementById('manualHackControl');
    var low = Number(lowEl && lowEl.value);
    var high = Number(highEl && highEl.value);
    var ctrl = Number(controlEl && controlEl.value);
    if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(ctrl)) {
      if (typeof showNotif === 'function') showNotif('Enter valid manual dice values first.', 'warn');
      return false;
    }
    var tmwCost = Math.max(0, Number(pending.tmwCost || 0));
    if (tmwCost > 0 && Number(S.tmw || 0) < tmwCost) {
      if (typeof showNotif === 'function') showNotif('Need ' + tmwCost + ' TMW to resolve this hack.', 'warn');
      return false;
    }
    if (tmwCost > 0) {
      S.tmw = Math.max(0, Number(S.tmw || 0) - tmwCost);
      if (typeof updateTMWPool === 'function') updateTMWPool();
    }
    var combatEnemy = (typeof getPrimaryCombatEnemy === 'function') ? getPrimaryCombatEnemy() : null;
    applyHackCastOutcome({
      hackName: pending.hackName,
      tmwCost: tmwCost,
      dreadDie: pending.dreadDie,
      low: Math.min(low, high),
      high: Math.max(low, high),
      valorDie: Number((S.stats && (S.stats.valor || S.stats.control)) || 4),
      valorVal: ctrl,
      guess: String(S.hackRoller.guess || 'between'),
      combatEnemy: combatEnemy,
      manual: true,
      spellMeta: pending.spellMeta || null
    });
    S.hackRoller.pendingManual = null;
    if (typeof closeModal === 'function') closeModal();
    return true;
  }

  function castHack() {
    ensureNewFeatureState();

    var sel = document.getElementById('hackSelect');
    if (sel && sel.value) S.hackRoller.selectedHack = sel.value;

    var hackName = S.hackRoller.selectedHack;
    if (!hackName && S.ownedHacks.length) {
      hackName = S.ownedHacks[0];
      S.hackRoller.selectedHack = hackName;
    }

    if (!hackName) {
      showNotif('Select a Hack to cast first!', 'warn');
      return;
    }
    if (!S.hackRoller.guess) {
      showNotif('Select a guess first: Below, Between, or Above!', 'warn');
      return;
    }

    var hackData = HACK_EFFECTS[hackName];
    var tmwCost = hackData ? Number(hackData.tmw || 0) : 0;
    if (tmwCost > 0 && typeof getScarTmwCostPenalty === 'function') {
      tmwCost += Math.max(0, Number(getScarTmwCostPenalty() || 0));
    }
    if (tmwCost > 0 && Number(S.tmw || 0) < tmwCost) {
      showNotif('Need ' + tmwCost + ' TMW to cast ' + hackName + '! (have ' + (S.tmw || 0) + ')', 'warn');
      return;
    }

    var combatEnemy = (typeof getPrimaryCombatEnemy === 'function') ? getPrimaryCombatEnemy() : null;
    var dreadDie = (S.combat && S.combat.active && combatEnemy && typeof getEnemyEffectiveDread === 'function')
      ? getEnemyEffectiveDread(combatEnemy)
      : (S.hackRoller.dreadDie || 6);
    S.hackRoller.dreadDie = dreadDie;

    evaluateUnifiedSpellCircumstances('Hack: ' + hackName, (hackData && hackData.desc) ? hackData.desc : 'OS hack cast', function (resolved) {
      var spellMeta = { profile: resolved && resolved.profile, circData: resolved && resolved.circData ? resolved.circData : null };
      if (isNewFeaturesManualRollMode()) {
        openManualHackCastModal({
          hackName: hackName,
          tmwCost: tmwCost,
          dreadDie: dreadDie,
          combatEnemy: combatEnemy,
          spellMeta: spellMeta
        });
        return;
      }

      if (tmwCost > 0) {
        S.tmw = Math.max(0, Number(S.tmw || 0) - tmwCost);
        if (typeof updateTMWPool === 'function') updateTMWPool();
      }

      var circ = spellMeta.circData || {};
      var dreadInfo = (typeof getSpellSteppedDieInfo === 'function')
        ? getSpellSteppedDieInfo(Math.max(4, Number(dreadDie || 6)), Number(circ.valorStep || 0))
        : { die: Math.max(4, Number(dreadDie || 6)), floorStepDowns: 0 };
      var dreadDieEff = Math.max(4, Number(dreadInfo.die || dreadDie || 6));

      function rollHackDreadPairTotal(pairIdx) {
        var rollsNeeded = Math.max(1, 1 + Number(dreadInfo.floorStepDowns || 0));
        var lowPick = null;
        for (var ridx = 0; ridx < rollsNeeded; ridx++) {
          var r = (typeof explodingRoll === 'function')
            ? explodingRoll(dreadDieEff, { type: 'dread', major: true, label: 'Hack DD' + dreadDieEff + ' Pair ' + pairIdx + ' Roll ' + (ridx + 1) })
            : { total: roll(dreadDieEff) };
          var total = Math.max(1, Number(r.total || 1));
          if (lowPick === null || total < lowPick) lowPick = total;
        }
        return Math.max(1, Number(lowPick || 1));
      }

      var d1 = rollHackDreadPairTotal(1);
      var d2 = rollHackDreadPairTotal(2);
      var low = Math.min(d1, d2);
      var high = Math.max(d1, d2);
      var valorDie = Math.max(4, Number((S.stats && (S.stats.valor || S.stats.control)) || 4));
      var valorRoll = explodingRoll(valorDie);
      var augBonusDie = (typeof getAugBonus === 'function') ? getAugBonus('control') : 0;
      var augRoll = augBonusDie > 0 ? explodingRoll(augBonusDie) : null;
      var valorVal = Number(valorRoll.total || 0) + Number(augRoll ? augRoll.total : 0);
      valorVal += Number(circ.mindFlat || 0);
      var circSpiritCounts = (typeof getSpellSpiritRollCounts === 'function')
        ? getSpellSpiritRollCounts(circ)
        : { add: circ.addSpiritBonus ? 1 : 0, sub: circ.addSpiritPenalty ? 1 : 0 };
      var spiritDie = Math.max(4, Number((S.stats && S.stats.spirit) || 4));
      for (var hsAdd = 0; hsAdd < Number(circSpiritCounts.add || 0); hsAdd++) {
        var hsSpiritAdd = explodingRoll(spiritDie);
        valorVal += Number(hsSpiritAdd.total || 0);
      }
      for (var hsSub = 0; hsSub < Number(circSpiritCounts.sub || 0); hsSub++) {
        var hsSpiritSub = explodingRoll(spiritDie);
        valorVal -= Number(hsSpiritSub.total || 0);
      }
      if (circ.stepUpAdvantage || circ.stepDownDisadvantage) {
        var auxDie = circ.stepUpAdvantage
          ? Math.min(20, valorDie >= 12 ? 20 : valorDie + 2)
          : Math.max(4, valorDie <= 4 ? 4 : valorDie - 2);
        var auxVal = Number((explodingRoll(auxDie) || {}).total || 0);
        valorVal = circ.stepUpAdvantage ? Math.max(valorVal, auxVal) : Math.min(valorVal, auxVal);
      }
      valorVal = Math.max(1, Number(valorVal || 1));

      applyHackCastOutcome({
        hackName: hackName,
        hackData: hackData,
        tmwCost: tmwCost,
        dreadDie: dreadDieEff,
        low: low,
        high: high,
        valorDie: valorDie,
        valorVal: valorVal,
        guess: String(S.hackRoller.guess || 'between'),
        combatEnemy: combatEnemy,
        manual: false,
        spellMeta: spellMeta
      });
    }, function () {
      if (typeof showNotif === 'function') showNotif('Hack cast cancelled.', 'warn');
    });
  }

  window.renderWeaponModsPanel  = renderWeaponModsPanel;
  window.removeWeaponMod        = removeWeaponMod;
  window.showWeaponModInfo      = showWeaponModInfo;
  window.renderAugmentationsPanel = renderAugmentationsPanel;
  window.showAugmentationInfo   = showAugmentationInfo;
  window.removeAugmentation     = removeAugmentation;
  window.initCharDreadDiceOpts  = initCharDreadDiceOpts;
  window.selectCharDreadDie     = selectCharDreadDie;
  window.rollCharDreadDie       = rollCharDreadDie;
  window.renderOSHacksPanel     = renderOSHacksPanel;
  window.removeOwnedHack        = removeOwnedHack;
  window.setHackGuess           = setHackGuess;
  window.setHackDreadDie        = setHackDreadDie;
  window.castHack               = castHack;
  window.resolveManualHackCast  = resolveManualHackCast;
  window.getAvailableWeaponModSlots = getAvailableWeaponModSlots;
  window.buyHoldingBrowseOffer = buyHoldingBrowseOffer;
  window.sellHoldingBrowseBackpackItem = sellHoldingBrowseBackpackItem;

  // ── ENHANCED MANUAL ROLL SYSTEM ──────────────────────────────────────────────
  // Comprehensive manual roll with prompt showing modifiers, conditions, skills, bonuses/advantages
  // Success = +1 Path Token | Failure = +1 Teamwork Point (with option to spend TMW to increase roll)

  function buildManualRollModifiersHtml() {
    if (typeof S === 'undefined') { return ''; }
    var modifiers = [];
    var penalty = [];

    // Check active conditions
    if (S.conditions) {
      if (S.conditions.focused) modifiers.push('🎯 Focused (+advantage)');
      if (S.conditions.protected) modifiers.push('🛡️ Protected (+defense)');
      if (S.conditions.inspired) modifiers.push('✨ Inspired (+rolls)');
      if (S.conditions.distracted) penalty.push('⚠️ Distracted (−rolls)');
      if (S.conditions.wounded) penalty.push('🩸 Wounded (−actions)');
      if (S.conditions.afraid) penalty.push('😨 Afraid (−rolls)');
    }

    // Check equipped items/weapons for bonuses
    if (S.equipment && S.equipment.weapon1) {
      var w1 = String(S.equipment.weapon1).trim();
      if (w1) modifiers.push('⚔️ ' + w1);
    }
    if (S.equipment && S.equipment.weapon2) {
      var w2 = String(S.equipment.weapon2).trim();
      if (w2 && w2 !== S.equipment.weapon1) modifiers.push('⚔️ ' + w2);
    }

    // Check for advantage die or flat bonus from roll modifiers
    if (S.rollMod && typeof S.rollMod === 'object') {
      if (Array.isArray(S.rollMod.advDice) && S.rollMod.advDice.length > 0) {
        var advDice = S.rollMod.advDice.map(function(d) { return '+d' + d; }).join(', ');
        modifiers.push('📈 Advantage: ' + advDice);
      }
      if (typeof S.rollMod.flat === 'number' && S.rollMod.flat > 0) {
        modifiers.push('➕ Bonus: +' + S.rollMod.flat);
      } else if (typeof S.rollMod.flat === 'number' && S.rollMod.flat < 0) {
        penalty.push('➖ Penalty: ' + S.rollMod.flat);
      }
    }

    // Check for skill/trait bonuses
    if (S.personalFlavors && Array.isArray(S.personalFlavors) && S.personalFlavors.length > 0) {
      var flavorStr = S.personalFlavors.slice(0, 2).join(' · ');
      if (flavorStr) modifiers.push('✦ Flavor: ' + flavorStr.substring(0, 45));
    }

    var html = '<div style="margin-top:.4rem;font-size:.74rem;color:var(--text2);line-height:1.6;">';
    if (modifiers.length > 0) {
      html += '<div style="color:var(--teal);margin-bottom:.25rem;"><strong>Bonuses & Advantages:</strong></div>';
      html += modifiers.map(function(m) { return '<div style="margin-left:.4rem;">• ' + m + '</div>'; }).join('');
    }
    if (penalty.length > 0) {
      html += '<div style="color:var(--red2);margin-top:.25rem;"><strong>Penalties & Conditions:</strong></div>';
      html += penalty.map(function(p) { return '<div style="margin-left:.4rem;">• ' + p + '</div>'; }).join('');
    }
    if (modifiers.length === 0 && penalty.length === 0) {
      html += '<div style="color:var(--muted2);font-style:italic;">No active modifiers or conditions.</div>';
    }
    html += '</div>';
    return html;
  }

  function showEnhancedManualRollPrompt(skillName, actionDie, dreadDie) {
    if (typeof openModal !== 'function' || typeof S === 'undefined') { return; }

    var skillLabel = String(skillName || 'Unknown').trim();
    var actionDieNum = Math.max(4, Number(actionDie || 6));
    var dreadDieNum = Math.max(4, Number(dreadDie || 6));
    var currentTMW = Math.max(0, Number(S.tmw || 0));
    var actionInput = document.getElementById('manualActionValue');
    var dreadInput = document.getElementById('manualDreadValue');
    var currentAction = Number(actionInput && actionInput.value);
    var currentDread = Number(dreadInput && dreadInput.value);

    var modifiersHtml = buildManualRollModifiersHtml();
    var pushDread = stepEnhancedManualDreadDie(dreadDieNum);

    var html = '<div style="font-size:.85rem;color:var(--text2);line-height:1.7;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold2);margin-bottom:.4rem;">'
      + skillLabel + ' vs Dread d' + dreadDieNum
      + '</div>'
      + '<div style="background:rgba(46,196,182,.05);border:1px solid rgba(46,196,182,.25);padding:.35rem .45rem;margin-bottom:.4rem;border-radius:3px;">'
      + '<div style="font-size:.75rem;color:var(--teal);margin-bottom:.15rem;"><strong>Roll Against:</strong></div>'
      + '<div><strong style="color:var(--text2);">' + skillLabel + ' d' + actionDieNum + '</strong> <span style="color:var(--muted2);">vs</span> <strong style="color:var(--red);">Dread d' + dreadDieNum + '</strong></div>'
      + '<div style="font-size:.68rem;color:var(--muted2);margin-top:.1rem;">Beat the Dread die result to succeed.</div>'
      + '</div>'
      + modifiersHtml
      + '<div style="background:rgba(232,192,80,.04);border:1px solid rgba(232,192,80,.3);padding:.35rem .45rem;margin-top:.4rem;border-radius:3px;">'
      + '<div style="font-size:.75rem;color:var(--gold2);margin-bottom:.2rem;"><strong>Teamwork Points:</strong> <span style="color:var(--teal);font-size:.82rem;">' + currentTMW + ' TMW</span></div>'
      + '<div style="font-size:.68rem;color:var(--muted2);">Push Luck costs 2 TMW and raises Dread to d' + pushDread + '.</div>'
      + '</div>'
      + '<div style="background:rgba(126,215,255,.06);border:1px solid rgba(126,215,255,.28);padding:.35rem .45rem;margin-top:.4rem;border-radius:3px;">'
      + '<div style="font-size:.75rem;color:var(--teal);margin-bottom:.15rem;"><strong>Current Manual Dice Entry</strong></div>'
      + '<div style="font-size:.7rem;color:var(--muted2);">Action: <strong style="color:var(--text2);">' + (Number.isFinite(currentAction) ? currentAction : '-') + '</strong> | Dread: <strong style="color:var(--text2);">' + (Number.isFinite(currentDread) ? currentDread : '-') + '</strong></div>'
      + '<div style="font-size:.66rem;color:var(--muted2);margin-top:.12rem;">Use the Manual Check panel values, then choose the narrative outcome below.</div>'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.6rem;">'
      + '<button class="btn btn-sm" onclick="goBackModal()">Go Back</button>'
      + '<button class="btn btn-sm" onclick="closeModal()">Cancel</button>'
      + '<button class="btn btn-sm btn-primary" onclick="manualRollOutcomeFailure(' + actionDieNum + ',' + dreadDieNum + ',\'' + skillLabel.replace(/'/g, "\\'") + '\',true,false)">Success</button>'
      + '<button class="btn btn-sm btn-red" onclick="manualRollOutcomeFailure(' + actionDieNum + ',' + dreadDieNum + ',\'' + skillLabel.replace(/'/g, "\\'") + '\',false,false)">Failure</button>'
      + '<button class="btn btn-sm btn-teal" ' + (currentTMW >= 2 ? '' : 'disabled') + ' onclick="manualRollOutcomeFailure(' + actionDieNum + ',' + dreadDieNum + ',\'' + skillLabel.replace(/'/g, "\\'") + '\',true,true)">Push Luck + Success</button>'
      + '<button class="btn btn-sm btn-warn" ' + (currentTMW >= 2 ? '' : 'disabled') + ' onclick="manualRollOutcomeFailure(' + actionDieNum + ',' + dreadDieNum + ',\'' + skillLabel.replace(/'/g, "\\'") + '\',false,true)">Push Luck + Failure</button>'
      + '</div>';

    openModal('Manual Roll: ' + skillLabel + ' Check', html, null, { preventScroll: true, focusTrap: true });
  }

  function stepEnhancedManualDreadDie(current) {
    var dice = [4, 6, 8, 10, 12, 20];
    var die = Number(current || 6);
    var idx = dice.indexOf(die);
    if (idx < 0) idx = 1;
    return dice[Math.min(dice.length - 1, idx + 1)];
  }

  function normalizeEnhancedManualStat(skillLabel) {
    var key = String(skillLabel || '').toLowerCase();
    if (key.indexOf('body') >= 0 || key.indexOf('strike') >= 0 || key.indexOf('shoot') >= 0) return 'body';
    if (key.indexOf('defend') >= 0) return 'defend';
    if (key.indexOf('lead') >= 0 || key.indexOf('spirit') >= 0) return 'spirit';
    if (key.indexOf('mind') >= 0 || key.indexOf('control') >= 0) return 'mind';
    return 'valor';
  }

  function applyEnhancedManualCondition(statKey, positive) {
    var cond = normalizeHoldingQuestConditionByStat(statKey, !!positive);
    if (typeof applyHoldingQuestCondition === 'function') {
      applyHoldingQuestCondition(cond);
      return cond;
    }
    S.conditions = S.conditions || {};
    S.conditions[cond] = true;
    if (typeof updateConditionButtons === 'function') updateConditionButtons();
    if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
    return cond;
  }

  function applyEnhancedManualFailureConsequence(statKey, margin, skillLabel) {
    var m = Math.max(1, Number(margin || 1));
    if (statKey === 'mind') {
      if (typeof changeMentalStress === 'function') changeMentalStress(m);
      else if (typeof changeStress === 'function') changeStress(m);
    } else if (statKey === 'defend') {
      if (typeof changeStress === 'function') changeStress(m);
      else if (typeof changeHealth === 'function') changeHealth(m);
    } else {
      if (typeof changeHealth === 'function') changeHealth(m);
      else if (typeof changeStress === 'function') changeStress(m);
    }
    if (typeof addTMWOnFail === 'function') addTMWOnFail('manual-roll-failure', { skipPrompt: true });
    else S.tmw = Math.max(0, Number(S.tmw || 0) + 1);
    if (typeof showDccFailureOutcome === 'function') {
      showDccFailureOutcome('spell', m, {
        actionTotal: 0,
        dreadTotal: m,
        context: String(skillLabel || 'Manual check') + ' (declared failure)'
      });
    }
  }

  function awardPathToken(reason) {
    if (typeof S === 'undefined') { return; }
    if (window.BTLRules && typeof window.BTLRules.isTeamworkConversionReason === 'function' && window.BTLRules.isTeamworkConversionReason(reason)) {
      if (typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
        window.BTLRules.recordTeamworkConvertedSuccess(reason || 'teamwork-converted-success');
      }
      return 0;
    }
    var pathBefore = Math.max(0, Number(S.pathTokens || 0));
    if (window.BTLRules && typeof window.BTLRules.awardSuccessfulRoll === 'function') {
      window.BTLRules.awardSuccessfulRoll(reason || 'manual-roll-success');
    } else if (typeof addSuccessRoll === 'function') {
      addSuccessRoll();
    } else {
      S.successRolls = Math.max(0, Number(S.successRolls || 0)) + 1;
      if (S.successRolls >= 3) {
        S.successRolls = 0;
        S.pathTokens = Math.max(0, Number(S.pathTokens || 0)) + 1;
      }
      var srEl = document.getElementById('successRollsVal');
      if (srEl) { srEl.textContent = S.successRolls; }
      var ptEl = document.getElementById('pathTokensVal');
      if (ptEl) { ptEl.textContent = S.pathTokens || 0; }
    }
    var pathAfter = Math.max(0, Number(S.pathTokens || 0));
    if (typeof showNotif === 'function' && pathAfter <= pathBefore) {
      showNotif('Success! +1 Successful Roll (' + Math.max(0, Number(S.successRolls || 0)) + '/3 toward +1 Path Token)', 'good');
    }
    return 1;
  }

  function manualRollOutcomeFailure(actionDie, dreadDie, skillLabel, declaredSuccess, pushLuck) {
    if (typeof S === 'undefined') { return; }
    var actionInput = document.getElementById('manualActionValue');
    var dreadInput = document.getElementById('manualDreadValue');

    if (!actionInput || !dreadInput) {
      if (typeof showNotif === 'function') showNotif('Enter Action and Dread dice values first!', 'warn');
      return;
    }

    var actionRoll = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(actionInput, 1) : parseInt(actionInput.value, 10);
    var dreadRoll = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(dreadInput, 1) : parseInt(dreadInput.value, 10);

    if (!Number.isFinite(actionRoll) || !Number.isFinite(dreadRoll)) {
      if (typeof showNotif === 'function') showNotif('Invalid dice entry. Enter a total or expression like 8+7.', 'warn');
      return;
    }

    var usePushLuck = !!pushLuck;
    var effectiveDreadDie = Math.max(4, Number(dreadDie || 6));
    if (usePushLuck) {
      var tmw = Math.max(0, Number(S.tmw || 0));
      if (tmw < 2) {
        if (typeof showNotif === 'function') showNotif('Need 2 Teamwork to Push Luck.', 'warn');
        return;
      }
      if (typeof changeCounter === 'function') changeCounter('tmw', -2);
      else S.tmw = Math.max(0, tmw - 2);
      effectiveDreadDie = stepEnhancedManualDreadDie(dreadDie);
    }

    var statKey = normalizeEnhancedManualStat(skillLabel);
    var effectiveDreadRoll = usePushLuck ? Math.max(dreadRoll, Number(roll(effectiveDreadDie) || dreadRoll)) : dreadRoll;
    var margin = Math.max(1, Math.abs(actionRoll - effectiveDreadRoll));
    var success = !!declaredSuccess;

    if (success) {
      awardPathToken('manual-roll-success');
      if (usePushLuck) {
        var pos = applyEnhancedManualCondition(statKey, true);
        if (typeof showNotif === 'function') showNotif('Push Luck success: gained ' + pos + '.', 'good');
      }
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome('spell', margin, {
          actionTotal: actionRoll,
          dreadTotal: effectiveDreadRoll,
          context: skillLabel + ' check (manual roll)'
        });
      }
    } else {
      if (usePushLuck) {
        var neg = applyEnhancedManualCondition(statKey, false);
        if (typeof showNotif === 'function') showNotif('Push Luck failure: gained ' + neg + '.', 'warn');
      }
      applyEnhancedManualFailureConsequence(statKey, margin, skillLabel);
      if (typeof showNotif === 'function') {
        showNotif('Failure consequences applied to character sheet.', 'warn');
      }
    }

    actionInput.value = '';
    dreadInput.value = '';
    if (typeof closeModal === 'function') closeModal();
  }

  function handleManualRollFailure(actionDie, dreadDie, skillLabel, actionRoll, dreadRoll) {
    if (typeof openModal !== 'function' || typeof S === 'undefined') { return; }

    var currentTMW = Math.max(0, Number(S.tmw || 0));
    var failedBy = Math.max(1, dreadRoll - actionRoll);
    var needForSuccess = failedBy; // Need this much TMW to convert to success

    var html = '<div style="font-size:.85rem;color:var(--text2);line-height:1.7;">'
      + '<div style="background:rgba(201,64,64,.1);border:1px solid rgba(201,64,64,.35);padding:.4rem .55rem;margin-bottom:.4rem;border-radius:3px;">'
      + '<div style="font-size:.82rem;color:var(--red2);margin-bottom:.15rem;"><strong>❌ Failed Roll</strong></div>'
      + '<div style="font-size:.75rem;color:var(--red2);">'
      + skillLabel + ' <strong style="color:var(--text2);">' + actionRoll + '</strong> vs Dread <strong style="color:var(--text2);">' + dreadRoll + '</strong>'
      + '</div>'
      + '<div style="font-size:.74rem;color:var(--muted2);margin-top:.1rem;font-weight:700;">Failed by: <span style="color:var(--red);">' + failedBy + '</span></div>'
      + '</div>'
      + '<div style="background:rgba(46,196,182,.05);border:1px solid rgba(46,196,182,.25);padding:.4rem .55rem;margin-bottom:.4rem;border-radius:3px;">'
      + '<div style="font-size:.82rem;color:var(--teal);margin-bottom:.2rem;"><strong>+1 Teamwork Point Awarded</strong></div>'
      + '<div style="font-size:.75rem;color:var(--muted2);">Failure grants experience in the form of Teamwork Points.</div>'
      + '</div>'
      + '<div style="background:rgba(232,192,80,.04);border:1px solid rgba(232,192,80,.3);padding:.4rem .55rem;margin-bottom:.4rem;border-radius:3px;">'
      + '<div style="font-size:.82rem;color:var(--gold2);margin-bottom:.2rem;"><strong>Spend Teamwork Points?</strong></div>'
      + '<div style="font-size:.75rem;color:var(--muted2);margin-bottom:.3rem;">You have <strong style="color:var(--teal);">' + currentTMW + ' TMW</strong> available.</div>'
      + '<div style="font-size:.75rem;color:var(--muted2);">Spend <strong style="color:var(--text2);">' + needForSuccess + ' TMW</strong> to convert this failure to a success.</div>';

    // Input field to specify how much TMW to spend
    html += '<label style="display:block;margin-top:.3rem;">'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.15rem;">TMW to Spend:</div>'
      + '<input type="number" id="manualRollTMWSpend" min="0" max="' + currentTMW + '" value="0" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.85rem;border-radius:3px;">'
      + '</label>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.6rem;">'
      + '<button class="btn btn-sm" onclick="closeModal(); awardFailureTeamwork()">Keep Failure (+1 TMW)</button>'
      + '<button class="btn btn-sm btn-teal" onclick="applyManualRollTMWSpend(' + actionRoll + ',' + dreadRoll + ',' + needForSuccess + ',\'' + skillLabel.replace(/'/g, "\\'") + '\')">Spend TMW to Succeed</button>'
      + '</div>';

    html += '</div>';
    openModal('Failed Roll: ' + skillLabel + ' Check', html, null, { preventScroll: true, focusTrap: true });
  }

  function awardFailureTeamwork() {
    if (typeof S === 'undefined') { return; }
    if (typeof addTMWOnFail === 'function') {
      addTMWOnFail('manual-roll-failure', { skipPrompt: true });
    } else {
      if (!S.tmw) S.tmw = 0;
      S.tmw = (S.tmw || 0) + 1;
      if (typeof updateTMWPool === 'function') { updateTMWPool(); }
    }
    if (typeof showNotif === 'function') showNotif('Failure noted. +1 Teamwork Point awarded.', 'info');
  }

  function applyManualRollTMWSpend(originalRoll, dreadRoll, needed, skillLabel) {
    if (typeof S === 'undefined' || typeof getCounter !== 'function') { return; }

    var spendInput = document.getElementById('manualRollTMWSpend');
    if (!spendInput) { return; }

    var spent = Math.max(0, parseInt(spendInput.value, 10) || 0);
    var currentTMW = Math.max(0, Number(S.tmw || 0));

    if (spent > currentTMW) {
      if (typeof showNotif === 'function') showNotif('Not enough Teamwork Points!', 'warn');
      return;
    }

    var newRoll = originalRoll + spent;
    var success = newRoll >= dreadRoll;

    // Deduct TMW
    if (spent > 0) {
      if (typeof changeCounter === 'function') {
        changeCounter('tmw', -spent);
      } else {
        S.tmw = Math.max(0, (S.tmw || 0) - spent);
      }
    }

    if (spent > 0 && typeof showNotif === 'function') {
      showNotif('Spent ' + spent + ' Teamwork: roll increased from ' + originalRoll + ' to ' + newRoll, 'info');
    }

    if (typeof closeModal === 'function') closeModal();

    // Award failure teamwork if still failed; Teamwork-converted success does not count toward Successful Rolls.
    if (success) {
      if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
        window.BTLRules.recordTeamworkConvertedSuccess('manual-roll-tmw-convert');
      }
      if (typeof showNotif === 'function') showNotif('After spending TMW, you now succeed. No Successful Roll gained.', 'good');
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome('spell', Math.max(1, newRoll - dreadRoll), {
          actionTotal: newRoll,
          dreadTotal: dreadRoll,
          context: skillLabel + ' check (TMW converted)'
        });
      }
    } else {
      // Still failed even with TMW
      awardFailureTeamwork();
      if (typeof showNotif === 'function') {
        showNotif('After spending ' + spent + ' TMW, you still fail (need ' + (needed - spent) + ' more). But you earned +1 Teamwork!', 'warn');
      }
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome('spell', Math.max(1, dreadRoll - newRoll), {
          actionTotal: newRoll,
          dreadTotal: dreadRoll,
          context: skillLabel + ' check (TMW partial)'
        });
      }
    }

    // Clear the manual inputs
    var actionInput = document.getElementById('manualActionValue');
    var dreadInput = document.getElementById('manualDreadValue');
    if (actionInput) actionInput.value = '';
    if (dreadInput) dreadInput.value = '';
  }

  window.showEnhancedManualRollPrompt = showEnhancedManualRollPrompt;
  window.awardPathToken = awardPathToken;
  
  // ── COMBAT MANUAL ROLL HANDLER ──────────────────────────────────────────────
  function returnToPreviousManualRollModal() {
    if (typeof goBackModal === 'function') {
      goBackModal();
      return true;
    }
    if (typeof closeModal === 'function') {
      closeModal();
      return true;
    }
    return false;
  }

  window.performCombatActionManualRoll = function(type) {
    if (!type || ['strike', 'shoot', 'spell', 'hack', 'defend', 'control', 'body', 'spirit', 'mind'].indexOf(type) < 0) return;

    var selected = (window.selectedDice && typeof window.selectedDice === 'object') ? window.selectedDice : { action: 4, dread: 6 };
    var actionDie = Number(selected.action || 4);
    var dreadDie = Number(selected.dread || 6);
    var skillLabel = type === 'strike' ? 'Strike'
      : (type === 'shoot' ? 'Shoot'
      : (type === 'hack' ? 'Hack'
      : (type === 'defend' ? 'Defend'
      : (type === 'control' ? 'Control'
      : (type === 'body' ? 'Body'
      : (type === 'spirit' ? 'Spirit'
      : (type === 'mind' ? 'Mind' : 'Spell')))))));
    var mode = 'standard';
    if (window.heavyAttackData && window.heavyAttackData.type === type) mode = 'heavy';
    else if (window.fastAttackData && window.fastAttackData.type === type) mode = 'fast';
    else if (window.dualAttackData && window.dualAttackData.type === type) mode = 'dual';
    else if (window.enemyManualReactionData && window.enemyManualReactionData.mode === 'arena-enemy-reaction') mode = 'enemy_reaction';
    else if (window.manualRollData && window.manualRollData.mode === 'surprise-check') mode = 'surprise_check';
    var displayLabel = skillLabel;
    if (mode === 'heavy') displayLabel = 'Heavy ' + skillLabel;
    else if (mode === 'fast') displayLabel = 'Fast ' + skillLabel;
    else if (mode === 'dual') displayLabel = 'Dual Wield (' + skillLabel + ')';
    var statForModifiers = type === 'hack' ? 'control' : (type === 'spell' ? 'mind' : type);
    var manualMeta = window.manualRollData && typeof window.manualRollData === 'object' ? window.manualRollData : {};
    var weaponBonusOptions = manualMeta.weaponBonusOptions || null;
    if (mode === 'heavy' && window.heavyAttackData && window.heavyAttackData.weaponBonusOptions) weaponBonusOptions = window.heavyAttackData.weaponBonusOptions;
    else if (mode === 'fast' && window.fastAttackData && window.fastAttackData.weaponBonusOptions) weaponBonusOptions = window.fastAttackData.weaponBonusOptions;
    else if (mode === 'dual' && window.dualAttackData && window.dualAttackData.weaponBonusOptions) weaponBonusOptions = window.dualAttackData.weaponBonusOptions;
    else if (!weaponBonusOptions && typeof window.getPreferredWeaponBonusOptionsForStat === 'function') weaponBonusOptions = window.getPreferredWeaponBonusOptionsForStat(statForModifiers);
    var extraLines = [];
    if (mode === 'heavy') extraLines.push('Heavy attack mode: add +2 damage on hit.');
    if (mode === 'fast') extraLines.push('Fast attack mode: on success, target becomes Vulnerable for 1 round.');
    if (mode === 'dual') extraLines.push('Dual Wield mode: apply matching Weapon 1 and Weapon 2 bonuses, then become Vulnerable after the attack resolves.');
    if (mode === 'enemy_reaction') extraLines.push('This is a reaction defense check against an enemy action.');
    if (mode === 'surprise_check') extraLines.push('Surprise check success grants +2 to attacks this round.');
    extraLines.push('Enter final totals after applying your active bonuses, penalties, and condition step changes.');
    var modifierLines = [];
    if (typeof window.buildManualRollModifierLines === 'function') {
      modifierLines = window.buildManualRollModifierLines(statForModifiers, actionDie, { extraLines: extraLines, weaponBonusOptions: weaponBonusOptions }) || [];
    } else {
      modifierLines = extraLines;
    }
    var sharedSceneMod = (typeof window.getLegacyCombatSceneModifier === 'function')
      ? window.getLegacyCombatSceneModifier(type, null)
      : { total: 0, elevation: 0, weather: 0, terrain: 0 };
    if (Number(sharedSceneMod.total || 0) !== 0 || Number(sharedSceneMod.elevation || 0) !== 0 || Number(sharedSceneMod.weather || 0) !== 0 || Number(sharedSceneMod.terrain || 0) !== 0) {
      modifierLines.push('Combat Scene Modifiers auto-apply: Elevation ' + (sharedSceneMod.elevation >= 0 ? '+' : '') + sharedSceneMod.elevation + ', Weather ' + (sharedSceneMod.weather >= 0 ? '+' : '') + sharedSceneMod.weather + ', Terrain ' + (sharedSceneMod.terrain >= 0 ? '+' : '') + sharedSceneMod.terrain + ' = ' + (sharedSceneMod.total >= 0 ? '+' : '') + sharedSceneMod.total + '.');
    }
    var modifierHtml = modifierLines.length
      ? ('<div style="margin-top:.34rem;padding:.34rem .42rem;border:1px solid var(--border2);background:rgba(46,196,182,.05);border-radius:3px;"><div style="font-size:.69rem;color:var(--teal);margin-bottom:.12rem;"><strong>Apply These Modifiers</strong></div>'
        + modifierLines.map(function(line){ return '<div style="font-size:.69rem;color:var(--text2);line-height:1.45;">- ' + String(line) + '</div>'; }).join('')
        + '</div>')
      : '<div style="font-size:.69rem;color:var(--muted2);margin-top:.28rem;">No active modifiers detected.</div>';

    var html = '<div style="font-size:.85rem;color:var(--text2);line-height:1.7;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold2);margin-bottom:.4rem;">'
      + displayLabel + ' vs Dread d' + dreadDie
      + '</div>'
      + '<div style="background:rgba(46,196,182,.05);border:1px solid rgba(46,196,182,.25);padding:.35rem .45rem;margin-bottom:.4rem;border-radius:3px;">'
      + '<div style="font-size:.75rem;color:var(--teal);margin-bottom:.15rem;"><strong>Roll Against:</strong></div>'
      + '<div><strong style="color:var(--text2);">' + displayLabel + ' d' + actionDie + '</strong> <span style="color:var(--muted2);">vs</span> <strong style="color:var(--red);">Dread d' + dreadDie + '</strong></div>'
      + '</div>'
      + modifierHtml
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.4rem;">'
      + '<div><label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">' + displayLabel + ' d' + actionDie + '</label><input type="text" inputmode="text" id="combatManualActionValue" placeholder="e.g. 8+7" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.85rem;border-radius:3px;"></div>'
      + '<div><label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Dread d' + dreadDie + '</label><input type="text" inputmode="text" id="combatManualDreadValue" placeholder="e.g. 7+3+1" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.85rem;border-radius:3px;"></div>'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;justify-content:flex-end;">'
      + '<button class="btn btn-sm" onclick="returnToPreviousManualRollModal()">Go Back</button>'
      + '<button class="btn btn-sm" onclick="returnToPreviousManualRollModal()">Cancel</button>'
      + '<button class="btn btn-sm btn-teal" onclick="finalizeCombatManualRoll(\'' + type + '\')">⚄ Resolve</button>'
      + '</div>';

    openModal('Manual ' + displayLabel + ' Roll', html, null, { preventScroll: true, focusTrap: true });
  };

  window.finalizeCombatManualRoll = function(type) {
    var actionInput = document.getElementById('combatManualActionValue');
    var dreadInput = document.getElementById('combatManualDreadValue');

    if (!actionInput || !dreadInput) {
      if (typeof showNotif === 'function') showNotif('Inputs not found', 'warn');
      return;
    }

    var actionValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(actionInput, 1) : parseInt(actionInput.value, 10);
    var dreadValue = (window.BTLRules && typeof window.BTLRules.readManualTotal === 'function') ? window.BTLRules.readManualTotal(dreadInput, 1) : parseInt(dreadInput.value, 10);

    if (!Number.isFinite(actionValue) || !Number.isFinite(dreadValue)) {
      if (typeof showNotif === 'function') showNotif('Invalid dice entry. Enter a total or expression like 8+7.', 'warn');
      return;
    }
    if (actionValue < 1 || dreadValue < 1) {
      if (typeof showNotif === 'function') showNotif('Dice values must be 1 or higher', 'warn');
      return;
    }

    returnToPreviousManualRollModal();

    var mode = 'standard';
    if (window.heavyAttackData && window.heavyAttackData.type === type) mode = 'heavy';
    else if (window.fastAttackData && window.fastAttackData.type === type) mode = 'fast';
    else if (window.dualAttackData && window.dualAttackData.type === type) mode = 'dual';
    else if (window.enemyManualReactionData && window.enemyManualReactionData.mode === 'arena-enemy-reaction') mode = 'enemy_reaction';
    else if (window.manualRollData && window.manualRollData.mode === 'surprise-check') mode = 'surprise_check';
    var selectedDice = (window.selectedDice && typeof window.selectedDice === 'object') ? window.selectedDice : { action: 4, dread: 6 };
    var manualActionDie = Math.max(4, Number(selectedDice.action || 4));
    var manualDreadDie = Math.max(4, Number(selectedDice.dread || 6));

    var sceneMod = (typeof window.getLegacyCombatSceneModifier === 'function')
      ? window.getLegacyCombatSceneModifier(type, null)
      : { total: 0, elevation: 0, weather: 0, terrain: 0 };
    var scopedManualAttackMods = (typeof window.consumeScopedAttackAdvantages === 'function')
      ? window.consumeScopedAttackAdvantages(type)
      : { advDice: [], notes: [] };
    var adjustedActionValue = Math.max(0, Number(actionValue || 0) + Number(sceneMod.total || 0));
    var success = adjustedActionValue >= dreadValue;
    var diff = Math.max(1, success ? adjustedActionValue - dreadValue : dreadValue - adjustedActionValue);
    var targetEnemy = (typeof getPrimaryCombatEnemy === 'function') ? getPrimaryCombatEnemy() : null;
    var resultEls = [];
    if (typeof document !== 'undefined') {
      if (type === 'defend') {
        resultEls.push(document.getElementById('defendResult'));
      } else if (type === 'strike' || type === 'shoot') {
        resultEls.push(document.getElementById('attackResult'));
        resultEls.push(document.getElementById('wayfarerActionResult'));
      } else {
        resultEls.push(document.getElementById('wayfarerActionResult'));
      }
    }
    function writeResult(html) {
      resultEls.filter(Boolean).forEach(function (el) {
        el.innerHTML = html;
      });
    }
    var label = 'Spell';
    if (mode === 'heavy') label = 'Heavy Attack (' + (type === 'shoot' ? 'Shoot' : 'Strike') + ')';
    else if (mode === 'fast') label = 'Fast Attack (' + (type === 'shoot' ? 'Shoot' : 'Strike') + ')';
    else if (mode === 'dual') label = 'Dual Wield (' + (type === 'shoot' ? 'Shoot' : 'Strike') + ')';
    else if (type === 'strike') label = 'Strike';
    else if (type === 'shoot') label = 'Shoot';
    else if (type === 'hack') label = 'Hack';
    else if (type === 'defend') label = 'Defend';
    else if (type === 'control') label = 'Control';
    else if (type === 'body') label = 'Body';
    else if (type === 'spirit') label = 'Spirit';
    else if (type === 'mind') label = 'Mind';
    var dccType = (type === 'hack' || type === 'spell') ? 'spell' : type;

    if (mode === 'enemy_reaction') {
      var reactionData = window.enemyManualReactionData && typeof window.enemyManualReactionData === 'object' ? window.enemyManualReactionData : {};
      var actionName = String(reactionData.actionName || 'Enemy Action');
      var enemyEntity = null;
      if (typeof S !== 'undefined' && S && Array.isArray(S.enemies)) {
        var enemyId = String(reactionData.enemyId || '');
        if (enemyId) {
          enemyEntity = S.enemies.find(function(e){
            if (!e || e.ally) return false;
            return typeof combatIdsMatch === 'function' ? combatIdsMatch(e.id, enemyId) : String(e.id) === enemyId;
          }) || null;
        }
      }
      if (success) {
        if (typeof showNotif === 'function') showNotif(actionName + ' blocked: ' + adjustedActionValue + ' vs Dread ' + dreadValue + '.', 'good');
        writeResult('<span style="color:var(--teal);">' + actionName + ': ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - Blocked.</span>');
      } else {
        var incoming = Math.max(1, dreadValue - adjustedActionValue);
        if (typeof changeStress === 'function') changeStress(incoming);
        if (typeof applyEnemySpecialEffectsToWayfarer === 'function') applyEnemySpecialEffectsToWayfarer({ effects: reactionData.effects || {} }, actionName);
        if (typeof showNotif === 'function') showNotif(actionName + ' lands: ' + dreadValue + ' vs ' + adjustedActionValue + ' for ' + incoming + ' Stress.', 'warn');
        writeResult('<span style="color:var(--red2);">' + actionName + ': ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - Hit for ' + incoming + ' Stress.</span>');
        if (typeof addTMWOnFail === 'function') {
          addTMWOnFail('arena-enemy-manual-reaction-failure', {
            failedBy: incoming,
            actionDie: manualActionDie,
            dreadDie: manualDreadDie,
            actionLabel: label,
            onConvert: function (payload) {
              if (typeof applyTeamworkConvertedDefendSuccess === 'function') {
                return applyTeamworkConvertedDefendSuccess(actionName, Math.max(1, Number(payload && payload.failedBy || incoming)), {
                  actionTotal: adjustedActionValue,
                  dreadTotal: dreadValue
                });
              }
              return true;
            }
          });
        }
      }
      if (enemyEntity && typeof finalizeEnemyTurn === 'function') finalizeEnemyTurn(enemyEntity);
      if (typeof updateCombatUI === 'function') updateCombatUI();
      if (typeof renderArenaCombatPopup === 'function') renderArenaCombatPopup();
      window.enemyManualReactionData = null;
      window.manualRollData = null;
      window.heavyAttackData = null;
      window.fastAttackData = null;
      window.dualAttackData = null;
      return;
    }

    if (mode === 'surprise_check') {
      if (success) {
        if (typeof S !== 'undefined' && S && S.combat) S.combat.surpriseBonus = Number(S.combat.surpriseBonus || 0) + 2;
        if (typeof showNotif === 'function') showNotif('Surprise Check succeeded: +2 to attacks this round.', 'good');
        writeResult('<span style="color:var(--teal);">Surprise Check: ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - SUCCESS! +2 attacks this round.</span>');
      } else {
        if (typeof addTMWOnFail === 'function') {
          addTMWOnFail('manual-combat-failure', {
            failedBy: diff,
            actionDie: manualActionDie,
            dreadDie: manualDreadDie,
            actionLabel: 'Surprise Check',
            onConvert: function () {
              if (typeof S !== 'undefined' && S && S.combat) S.combat.surpriseBonus = Number(S.combat.surpriseBonus || 0) + 2;
              if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
                window.BTLRules.recordTeamworkConvertedSuccess('manual-surprise-teamwork-convert');
              }
              writeResult('<span style="color:var(--green2);font-weight:700;">Teamwork Success</span> Surprise Check: +2 attacks this round. <span style="font-size:.72rem;color:var(--muted2);">No Successful Roll gained.</span>');
              if (typeof renderArenaCombatPopup === 'function' && window._arenaCombatPopupOpen) renderArenaCombatPopup();
              return true;
            }
          });
        }
        if (typeof showNotif === 'function') showNotif('Surprise Check failed: enemy not surprised.', 'warn');
        writeResult('<span style="color:var(--red2);">Surprise Check: ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - FAILED.</span>');
      }
      window.enemyManualReactionData = null;
      window.manualRollData = null;
      window.heavyAttackData = null;
      window.fastAttackData = null;
      window.dualAttackData = null;
      return;
    }

    var rulesRollRequest = (window.BTLRules && typeof window.BTLRules.createRollRequest === 'function')
      ? window.BTLRules.createRollRequest({
          source: 'combat-manual',
          actionType: type,
          label: label,
          manual: true,
          tags: [mode, dccType]
        })
      : null;
    if (rulesRollRequest && window.BTLRules && typeof window.BTLRules.applyRollModifiers === 'function') {
      var ruleModifiers = [];
      if (Number(sceneMod.total || 0)) ruleModifiers.push({ type: 'scene', label: 'Combat scene', total: Number(sceneMod.total || 0) });
      (scopedManualAttackMods.notes || []).forEach(function (note, idx) {
        ruleModifiers.push({ type: 'effect', label: String(note || 'Scoped effect'), die: Number((scopedManualAttackMods.advDice || [])[idx] || 0) });
      });
      rulesRollRequest = window.BTLRules.applyRollModifiers(rulesRollRequest, ruleModifiers);
    }

    var manualFailureOptions = {
      failedBy: diff,
      actionDie: manualActionDie,
      dreadDie: manualDreadDie,
      actionLabel: label,
      onConvert: function (payload) {
        var convertedMargin = Math.max(1, Number(payload && payload.failedBy || diff));
        if ((type === 'strike' || type === 'shoot' || type === 'spell' || type === 'hack') && typeof applyTeamworkConvertedCombatAttack === 'function') {
          return applyTeamworkConvertedCombatAttack(type === 'shoot' ? 'shoot' : 'strike', targetEnemy, convertedMargin + (mode === 'heavy' ? 2 : 0) + (type === 'spell' ? 1 : 0), {
            actionTotal: adjustedActionValue,
            dreadTotal: dreadValue
          });
        }
        if (type === 'defend' && typeof applyTeamworkConvertedDefendSuccess === 'function') {
          return applyTeamworkConvertedDefendSuccess(label, convertedMargin, {
            actionTotal: adjustedActionValue,
            dreadTotal: dreadValue
          });
        }
        if (window.BTLRules && typeof window.BTLRules.recordTeamworkConvertedSuccess === 'function') {
          window.BTLRules.recordTeamworkConvertedSuccess('manual-combat-teamwork-convert');
        }
        if (typeof showDccSuccessOutcome === 'function') {
          showDccSuccessOutcome(dccType, convertedMargin, {
            actionTotal: adjustedActionValue,
            dreadTotal: dreadValue,
            context: label + ' vs Enemy Dread (Teamwork converted manual roll)'
          });
        }
        writeResult('<span style="color:var(--green2);font-weight:700;">Teamwork Success</span> ' + label + ': converted failure to success. <span style="font-size:.72rem;color:var(--muted2);">No Successful Roll gained.</span>');
        if (typeof renderArenaCombatPopup === 'function' && window._arenaCombatPopupOpen) renderArenaCombatPopup();
        return true;
      }
    };

    if (success) {
      var dmg = Math.max(1, diff) + (mode === 'heavy' ? 2 : 0) + ((type === 'spell') ? 1 : 0);
      if (targetEnemy && typeof applyStressToEnemy === 'function' && (type === 'strike' || type === 'shoot' || type === 'spell' || type === 'hack')) {
        applyStressToEnemy(targetEnemy, dmg, label + ' (Manual)');
      }
      if (window.BTLRules && typeof window.BTLRules.resolveRollOutcome === 'function') {
        window.BTLRules.resolveRollOutcome(rulesRollRequest, {
          success: true,
          actionTotal: adjustedActionValue,
          dreadTotal: dreadValue,
          margin: diff
        }, { reason: 'manual-combat-success' });
      } else if (typeof addSuccessRoll === 'function') addSuccessRoll();
      if (typeof showDccSuccessOutcome === 'function') {
        showDccSuccessOutcome(dccType, diff, {
          actionTotal: adjustedActionValue,
          actionTotalRaw: actionValue,
          sceneModifierTotal: Number(sceneMod.total || 0),
          actionTotalAdjusted: adjustedActionValue,
          dreadTotal: dreadValue,
          context: label + ' vs Enemy Dread (manual roll)'
        });
      }
      var scopedNote = scopedManualAttackMods.notes && scopedManualAttackMods.notes.length ? ' <span style="font-size:.72rem;color:var(--gold);">(' + scopedManualAttackMods.notes.join(' · ') + ' consumed)</span>' : '';
      if (type === 'strike' || type === 'shoot' || type === 'spell' || type === 'hack') writeResult('<span style="color:var(--teal);">' + label + ': ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - HIT! ' + dmg + ' Health damage.</span>' + scopedNote);
      else writeResult('<span style="color:var(--teal);">' + label + ': ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - SUCCESS.</span>');
    } else {
      if (window.BTLRules && typeof window.BTLRules.resolveRollOutcome === 'function') {
        window.BTLRules.resolveRollOutcome(rulesRollRequest, {
          success: false,
          actionTotal: adjustedActionValue,
          dreadTotal: dreadValue,
          margin: diff
        }, { reason: 'manual-combat-failure', failureOptions: manualFailureOptions });
      } else if (typeof addTMWOnFail === 'function') addTMWOnFail('manual-combat-failure', manualFailureOptions);
      if (typeof showDccFailureOutcome === 'function') {
        showDccFailureOutcome(dccType, diff, {
          actionTotal: adjustedActionValue,
          actionTotalRaw: actionValue,
          sceneModifierTotal: Number(sceneMod.total || 0),
          actionTotalAdjusted: adjustedActionValue,
          dreadTotal: dreadValue,
          context: label + ' vs Enemy Dread (manual roll)'
        });
      }
      var scopedFailNote = scopedManualAttackMods.notes && scopedManualAttackMods.notes.length ? ' <span style="font-size:.72rem;color:var(--gold);">(' + scopedManualAttackMods.notes.join(' · ') + ' consumed)</span>' : '';
      writeResult('<span style="color:var(--red2);">' + label + ': ' + adjustedActionValue + ' vs Dread ' + dreadValue + ' - FAIL.</span>' + scopedFailNote);
    }

    if (mode === 'fast' && S && S.combat) {
      S.combat.fastAttackVulnerable = 1;
      S.combat.fastAttackUsedEncounter = true;
    }
    if (mode === 'dual' && typeof applyDualWieldSelfVulnerable === 'function') {
      applyDualWieldSelfVulnerable();
    }

    if (typeof clearConditionOnUse === 'function') clearConditionOnUse(type);
  if (typeof updateCombatUI === 'function') updateCombatUI();
    if (typeof updateWayfarerActionBtn === 'function') updateWayfarerActionBtn();
    if (typeof renderCombatOptions === 'function') renderCombatOptions();

    window.enemyManualReactionData = null;
    window.manualRollData = null;
    window.heavyAttackData = null;
    window.fastAttackData = null;
    window.dualAttackData = null;
  };
  window.returnToPreviousManualRollModal = returnToPreviousManualRollModal;
  window.manualRollOutcomeFailure = manualRollOutcomeFailure;
  window.handleManualRollFailure = handleManualRollFailure;
  window.awardFailureTeamwork = awardFailureTeamwork;
  window.applyManualRollTMWSpend = applyManualRollTMWSpend;
}());

// ── TROPHY SYSTEM ─────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var TROPHY_DEFS = [
    { id: 'first_combat',        icon: '⚔',  title: 'Bloodied Hands',      desc: 'Win your first combat.' },
    { id: 'first_mission',       icon: '✦',  title: 'Sworn In',            desc: 'Complete your first mission.' },
    { id: 'first_galaxy_hex',    icon: '🌌', title: 'Star Walker',         desc: 'Explore your first Galaxy hex.' },
    { id: 'first_planet',        icon: '🪐', title: 'Planetfall',          desc: 'Land on and scan your first planet.' },
    { id: 'first_faction_renown',icon: '🤝', title: 'Faction Favor',       desc: 'Earn your first point of faction renown.' },
    { id: 'first_shop_purchase', icon: '🛒', title: 'Market Runner',       desc: 'Make your first purchase from the shop.' },
    { id: 'first_service',       icon: '🔧', title: 'District Regular',    desc: 'Use a district service for the first time.' },
    { id: 'first_wayfarer',      icon: '🧭', title: 'Fellow Traveler',     desc: 'Encounter your first Wayfarer.' },
    { id: 'first_raid',          icon: '💀', title: 'Raid Ready',          desc: 'Complete a raid.' },
    { id: 'first_derelict',      icon: '🛸', title: 'Ghost Diver',         desc: 'Board and explore a derelict ship.' },
    { id: 'first_planet_task',   icon: '📍', title: 'Boots On Ground',     desc: 'Complete a task on a planet surface.' },
    { id: 'reach_1000_credits',  icon: '💰', title: 'Flush',               desc: 'Accumulate 1,000 Credits at once.' },
    { id: 'survive_max_stress',  icon: '🧠', title: 'Edge of Breaking',    desc: 'Reach maximum Stress and survive the scene.' },
    { id: 'first_space_encounter',icon:'🚀', title: 'Open Skies',          desc: 'Resolve your first Space Encounter.' },
    { id: 'first_hack',          icon: '💻', title: 'The Code Speaks',     desc: 'Successfully cast an OS Hack.' },
    { id: 'explore_all_zones',   icon: '🗺', title: 'Cartographer',        desc: 'Reveal all district zones in the World map.' },
    { id: 'first_starship_upgrade',icon:'⚙', title: 'Shipwright',          desc: 'Install your first starship upgrade.' },
    { id: 'first_dead_moon',     icon: '🌑', title: 'Void Walker',         desc: 'Explore a Dead Moon.' },
    { id: 'first_mystery_contact',icon:'❓', title: 'Hail Stranger',       desc: 'Make first contact with a Mystery vessel.' },
    { id: 'complete_storyline',  icon: '📖', title: 'The Path Walked',     desc: 'Complete your first storyline arc.' },
  ];

  function ensureTrophyState() {
    if (typeof S === 'undefined') return;
    if (!S.trophies || typeof S.trophies !== 'object') S.trophies = {};
  }

  function awardTrophy(id) {
    if (typeof S === 'undefined') return;
    ensureTrophyState();
    if (S.trophies[id]) return;
    var def = TROPHY_DEFS.find(function (t) { return t.id === id; });
    if (!def) return;
    S.trophies[id] = { earned: true, timestamp: Date.now() };
    var msg = def.icon + ' Trophy Unlocked: \u201c' + def.title + '\u201d \u2014 ' + def.desc;
    if (typeof showNotif === 'function') showNotif(msg, 'good');
    // Render a persistent banner for 4 seconds
    var banner = document.getElementById('trophyBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'trophyBanner';
      banner.style.cssText = 'position:fixed;bottom:4.5rem;left:50%;transform:translateX(-50%);background:rgba(30,26,18,.96);border:1px solid rgba(232,192,80,.65);border-radius:.5rem;padding:.55rem 1.1rem;font-family:Rajdhani,sans-serif;font-size:.96rem;color:#f0d070;z-index:9999;pointer-events:none;transition:opacity .4s;max-width:90vw;text-align:center;';
      document.body.appendChild(banner);
    }
    banner.innerHTML = def.icon + ' <strong>Trophy Unlocked</strong> &mdash; &ldquo;' + def.title + '&rdquo;';
    banner.style.opacity = '1';
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(function () { banner.style.opacity = '0'; }, 3800);
    renderTrophyTab();
  }

  function checkTrophy(id) {
    if (typeof S === 'undefined') return;
    ensureTrophyState();
    if (S.trophies[id]) return;
    // Dynamic check conditions for trophies that depend on current state
    if (id === 'reach_1000_credits') {
      if (typeof getCredits === 'function' && getCredits() < 1000) return;
    }
    if (id === 'explore_all_zones') {
      var w = S && S.worldThatWas;
      if (!w || !Array.isArray(w.zones)) return;
      var allExplored = w.zones.every(function (z) { return z.explored || z.hexIds && z.hexIds.some(function (hid) { return (w.hexes || []).find(function (h) { return h.id === hid && h.explored; }); }); });
      if (!allExplored) return;
    }
    awardTrophy(id);
  }

  function buildTrophyPanelHtml() {
    ensureTrophyState();
    var trophies = (typeof S !== 'undefined' && S.trophies) ? S.trophies : {};
    var iconApi = (typeof window !== 'undefined') ? window.SharedIconSystem : null;
    var earned = TROPHY_DEFS.filter(function (t) { return trophies[t.id]; });
    var locked = TROPHY_DEFS.filter(function (t) { return !trophies[t.id]; });
    var html = '<div class="card"><div class="section-title">Trophies &mdash; ' + earned.length + ' / ' + TROPHY_DEFS.length + '</div>';
    html += '<div style="font-size:.82rem;color:var(--muted2);margin-bottom:.65rem;">Unlock trophies by completing milestones. Aim for 100%.</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.4rem;">';
    TROPHY_DEFS.forEach(function (def) {
      var isEarned = !!trophies[def.id];
      var trophyIcon = iconApi && typeof iconApi.iconTrophy === 'function'
        ? iconApi.iconTrophy({ size: 24, accent: isEarned ? iconApi.resolveAccent(def.id) : '#6f7d8f', title: def.title })
        : def.icon;
      html += '<div style="padding:.45rem .55rem;border:1px solid ' + (isEarned ? 'rgba(232,192,80,.55)' : 'var(--border2)') + ';background:' + (isEarned ? 'rgba(232,192,80,.07)' : 'rgba(255,255,255,.02)') + ';border-radius:.35rem;">';
      html += '<div style="font-size:1.35rem;line-height:1;">' + trophyIcon + '</div>';
      html += '<div style="font-size:.88rem;font-weight:700;color:' + (isEarned ? 'var(--gold2)' : 'var(--muted2)') + ';margin-top:.18rem;">' + def.title + '</div>';
      html += '<div style="font-size:.76rem;color:var(--muted2);margin-top:.1rem;">' + (isEarned ? def.desc : '???') + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function renderTrophyTab() {
    var host = document.getElementById('trophyTabPanel');
    if (!host) return;
    host.innerHTML = buildTrophyPanelHtml();
  }

  // Public interface
  window.TrophySystem = {
    award: awardTrophy,
    check: checkTrophy,
    buildPanelHtml: buildTrophyPanelHtml,
    renderTab: renderTrophyTab,
    defs: TROPHY_DEFS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderTrophyTab);
  } else {
    renderTrophyTab();
  }
}());
