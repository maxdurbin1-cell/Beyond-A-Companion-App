// gm-dashboard.js — GM Dashboard (Reference · Character Controls · Mission Creator)
// Only functional when Settings.gameMode === 'gm'
(function () {

  /* ── CONSTANTS ── */
  var MISSION_VERBS   = ['Hunt','Guard','Rescue','Deliver','Investigate','Eliminate','Retrieve','Escort','Sabotage','Recover','Liberate','Neutralize','Secure','Extract','Deploy'];
  var MISSION_TARGETS = ['Bandits','Beasts','Refugees','Cargo','Mutineers','Threats','Artifacts','a VIP','Deserters','a Rival','Rogue AI','Corrupted Guard','Sleeper Agent','Lost Crew','Ancient Fragment'];
  var MISSION_LOCS    = ['Forest Outpost','Mountain Pass','Ancient Ruins','Riverside Town','Hidden Camp','Abandoned Temple','Deep Cave','Border Shrine','Trade Road','Iron Mine','Collapsed Watchtower','Forgotten Bunker','Borderland Relay','Sunken Garrison','Ash Hollow'];
  var SEA_LOCS        = ['Storm-lashed Isle','Coral Shrine','Salt Ruin','Smuggler Anchorage','Drowned Watchpost','Reef Crossing','Cannibal Cay','Fog Bank Platform'];
  var GALAXY_LOCS     = ['Inner Ring Relay','Trade Route Spur','Dead Moon Vault','Derelict Coordinates','Hub Corridor','Outer Signal Graveyard','Wreck Field Alpha','Transit Beacon 9'];
  var WTW_LOCS        = ['World That Was district: Ashline Ward','World That Was district: Glass Market','World That Was district: Drowned Courtyard','World That Was district: Split Basilica','World That Was district: Ember Quarter','World That Was district: The Pale Steps'];
  var PLANET_LOCS     = ['Lost City Concourse','Dustwind Basin','Fallen Transit Gate','Sunken Temple Vault','Blight Orchard Rim','Skyrail Ruins'];
  var YESSOD_LOCS     = ['Pilgrim Stair','Ashen Basilica','Choir of Cinders','Mercy Ossuary','Mirror Garden of the Upper Choir','Mephisto\'s Lower Threshold'];
  var DIFFICULTIES    = {
    easy:        { name:'Easy',        dread:4,  reward:50  },
    medium:      { name:'Medium',      dread:6,  reward:100 },
    hard:        { name:'Hard',        dread:8,  reward:150 },
    challenging: { name:'Challenging', dread:10, reward:250 },
    very_hard:   { name:'Very Hard',   dread:12, reward:400 },
    impossible:  { name:'Impossible',  dread:20, reward:700 }
  };
  var GUILD_PAIRS = [
    { gain:'corporations', lose:'underworld',  gainName:'The Gilded Ledger',   loseName:'The Underground Crown' },
    { gain:'religious',    lose:'military',    gainName:'The Sacred Choir',     loseName:'The Iron Cohort' },
    { gain:'military',     lose:'rebels',      gainName:'The Iron Cohort',      loseName:'The Ember Union' },
    { gain:'rebels',       lose:'corporations',gainName:'The Ember Union',      loseName:'The Gilded Ledger' },
    { gain:'underworld',   lose:'scholars',    gainName:'The Underground Crown',loseName:'The Archive Keepers' },
    { gain:'scholars',     lose:'religious',   gainName:'The Archive Keepers',  loseName:'The Sacred Choir' }
  ];
  var GUILD_IDS = ['corporations','underworld','religious','military','rebels','scholars'];
  var GUILD_LABELS = {
    corporations:'The Gilded Ledger',
    underworld:'The Underground Crown',
    religious:'The Sacred Choir',
    military:'The Iron Cohort',
    rebels:'The Ember Union',
    scholars:'The Archive Keepers'
  };
  var FORGE_STORAGE_KEY = 'btl-gm-forge-presets-v1';
  var FORGE_PACKS = [
    {
      id: 'province-pressure',
      label: 'Province Pressure Pack',
      summary: 'Political patrols, lost-city rumors, and faction crossfire around the Province.',
      presets: [
        {
          id: 'rift-patrol',
          label: 'Rift Patrol',
          templateId: 'gm.rift_patrol',
          missionType: 'investigation',
          region: 'province',
          loc: 'Skyfall Rift',
          diff: 'hard',
          title: 'Investigate the Rift Patrol',
          briefing: 'Autarch Star Wardens have been spotted near the settlement, patrolling a rift where locals swear a Lost City fell from the sky. Terrors have been heard screeching from within at night.',
          contact: 'Mira Ashwake, settlement outrider',
          threat: 'Autarch patrols lock down the rift while irradiated terrors stalk the lower breach.',
          keyMarker: 'Collapsed sky-marker pointing toward the buried city gate',
          enemy: 'Star Warden patrol captain with terror pack support',
          checkpoints: 'Reach the rift rim\nIdentify who controls the patrol route\nFind the fallen city marker\nDecide whether to sneak, bargain, or fight for entry',
          gmNotes: 'Open on faction pressure first, then reveal the terrors as the real clock.',
          hooks: 'Someone in the settlement wants the Lost City opened before the Wardens can seal it.\nThe terrors are reacting to something alive beneath the rift.'
        },
        {
          id: 'settlement-quiet-crisis',
          label: 'Settlement Quiet Crisis',
          templateId: 'gm.settlement_quiet_crisis',
          missionType: 'social',
          region: 'province',
          loc: 'Lantern Quay outskirts',
          diff: 'medium',
          title: 'Stabilize the Settlement',
          briefing: 'Rumors, shortages, and fear are turning a frontier settlement inward. The wrong spark could create a riot.',
          contact: 'Steward Rhea Voss',
          threat: 'A guild fixer is inflaming tempers while supplies disappear overnight.',
          keyMarker: 'Warehouse ledger with erased delivery marks',
          enemy: 'No boss yet — the real enemy is panic and sabotage',
          checkpoints: 'Hear the settlement factions out\nTrace the missing stock\nChoose who gains leverage before nightfall',
          gmNotes: 'Let every faction offer a useful truth, but never the full picture.',
          hooks: 'The stolen supplies are part of a larger smuggling lane.\nOne future ally is deciding whether to betray the settlement tonight.'
        }
      ]
    },
    {
      id: 'sea-expeditions',
      label: 'Last Sea Pack',
      summary: 'Reef hazards, drowned shrines, smugglers, and storms that can become whole sessions.',
      presets: [
        {
          id: 'drowned-shrine',
          label: 'Drowned Shrine',
          templateId: 'gm.drowned_shrine',
          missionType: 'delve',
          region: 'sea',
          loc: 'Coral Shrine',
          diff: 'challenging',
          title: 'Plunder the Drowned Shrine',
          briefing: 'A shrine only appears when the tide withdraws. Inside are relics, drowned dead, and a choir of pressure sounds that break weak nerves.',
          contact: 'Harbormaster Celyne',
          threat: 'A rival salvage crew intends to lock the shrine down before your crew leaves.',
          keyMarker: 'Bell-pillar etched with a route to a second ruin',
          enemy: 'Shrine warden revenant and rival divers',
          checkpoints: 'Reach the shrine before the tide returns\nSecure the bell-pillar route clue\nEscape before the reef current turns',
          gmNotes: 'Use the sea itself like a timer. Every delay should feel expensive.',
          hooks: 'The route clue points toward a ruin no chart acknowledges.\nA rival diver survives and swears revenge.'
        },
        {
          id: 'storm-corridor',
          label: 'Storm Corridor',
          templateId: 'gm.storm_corridor',
          missionType: 'escort',
          region: 'sea',
          loc: 'Reef Crossing',
          diff: 'hard',
          title: 'Escort Through the Storm Corridor',
          briefing: 'A merchant flotilla must cross a cursed weather lane before supplies run dry elsewhere.',
          contact: 'Quartermaster Pell',
          threat: 'Pirates are shadowing the route and the storm itself is wrong.',
          keyMarker: 'Flare tower that can open a safer lane for one phase',
          enemy: 'Storm pirate outrider crew',
          checkpoints: 'Chart the safe lane\nKeep the flotilla intact\nDecide whether to bait or outrun the pirates',
          gmNotes: 'Frame every choice as protection versus speed.',
          hooks: 'The storm is being summoned, not endured.\nOne escorted ship is carrying a passenger under false papers.'
        }
      ]
    },
    {
      id: 'galaxy-frontiers',
      label: 'Galaxy Frontiers Pack',
      summary: 'Survey relays, dead moons, and first-contact pressure in a No Man\'s Sky-style lane.',
      presets: [
        {
          id: 'dead-moon-vault',
          label: 'Dead Moon Vault',
          templateId: 'gm.dead_moon_vault',
          missionType: 'exploration',
          region: 'galaxy',
          loc: 'Dead Moon Vault',
          diff: 'hard',
          title: 'Survey the Dead Moon Vault',
          briefing: 'Scanners found a sealed vault under a moon nobody claimed. Multiple powers are racing toward it.',
          contact: 'Signal cartographer Ilen',
          threat: 'The vault wakes anything that lingers too long in its halls.',
          keyMarker: 'Starmap shard locked behind three sigils',
          enemy: 'Vault sentinel lattice and scavenger crew',
          checkpoints: 'Land before rivals arrive\nDecode the sigil path\nChoose what to take and what to seal back up',
          gmNotes: 'Wonder first, danger second, then greed.',
          hooks: 'The starmap shard points outside known routes.\nA scavenger survives and leaks the discovery.'
        },
        {
          id: 'relay-blackout',
          label: 'Relay Blackout',
          templateId: 'gm.relay_blackout',
          missionType: 'repair',
          region: 'galaxy',
          loc: 'Inner Ring Relay',
          diff: 'medium',
          title: 'Restore the Inner Ring Relay',
          briefing: 'A key relay went dark, stranding travelers and hiding something moving through the shipping lanes.',
          contact: 'Dockmaster Aven Rees',
          threat: 'The blackout is cover for thefts and something predatory in the dark route.',
          keyMarker: 'Relay control spindle with tampered logs',
          enemy: 'Saboteur cell with opportunist raiders',
          checkpoints: 'Reach the relay hub\nRestore a clean signal\nExpose or exploit the sabotage',
          gmNotes: 'Keep the line between rescue work and conspiracy thin.',
          hooks: 'The blackout logs mention a ship that should not exist.\nSomeone on the station has been paid to misdirect the crew.'
        }
      ]
    },
    {
      id: 'world-that-was',
      label: 'World That Was Pack',
      summary: 'Mob jobs, subway danger, black markets, and cyberpunk district pressure under the dome.',
      presets: [
        {
          id: 'glass-market-job',
          label: 'Glass Market Job',
          templateId: 'gm.glass_market_job',
          missionType: 'heist',
          region: 'wtw',
          loc: 'World That Was district: Glass Market',
          diff: 'hard',
          title: 'Take the Glass Market Job',
          briefing: 'A mob intermediary offers a fast job in the Glass Market. The pay is real. The setup probably is too.',
          contact: 'Broker Nine-Knives',
          threat: 'Three rival crews want the same package and one of them is police-backed.',
          keyMarker: 'Subway locker beneath Track 4',
          enemy: 'Chrome-backed Market Butchers crew',
          checkpoints: 'Meet the fixer\nReach the subway locker\nChoose whether to keep, sell, or hand off the package',
          gmNotes: 'Make the city feel lived in and predatory at the same time.',
          hooks: 'The package belongs to a faction boss you have not met yet.\nA subway route opens into a hidden district.'
        },
        {
          id: 'black-market-breach',
          label: 'Black Market Breach',
          templateId: 'gm.black_market_breach',
          missionType: 'infiltration',
          region: 'wtw',
          loc: 'World That Was district: Ember Quarter',
          diff: 'challenging',
          title: 'Breach the Black Market',
          briefing: 'A rumor says someone inside the dome\'s black market is selling hacked relics tied to the fall.',
          contact: 'Subway courier Vey',
          threat: 'Local enforcers are watching the entrances and the market changes layout nightly.',
          keyMarker: 'Ticket stub encoded with the real entry path',
          enemy: 'Security syndicate and panic response drones',
          checkpoints: 'Find the hidden entry\nBlend in or sneak deeper\nSecure the seller or their stock ledger',
          gmNotes: 'Offer three clear approaches: sneak, social, or fast violence.',
          hooks: 'A relic buyer leaves behind a faction sigil nobody recognizes.\nThe seller is terrified of a name the crew has heard before.'
        }
      ]
    },
    {
      id: 'afterlife-ascents',
      label: 'Yessod Pack',
      summary: 'Ascents and descents through surreal layers of Heaven and Hell.',
      presets: [
        {
          id: 'choir-of-cinders',
          label: 'Choir of Cinders',
          templateId: 'gm.choir_of_cinders',
          missionType: 'ritual',
          region: 'yessod',
          loc: 'Choir of Cinders',
          diff: 'very_hard',
          title: 'Silence the Choir of Cinders',
          briefing: 'A chorus from below is changing the stair between levels. Pilgrims disappear when it begins to sing.',
          contact: 'Ash pilgrim Serit',
          threat: 'The choir is binding a lower prince to the stairwell.',
          keyMarker: 'Burning hymn-scroll that rewrites itself',
          enemy: 'Ash choir vessels and a prince\'s herald',
          checkpoints: 'Reach the altered stair\nBreak the hymn pattern\nChoose whether to preserve or destroy the scroll',
          gmNotes: 'Lean surreal. The environment should feel spiritually unstable.',
          hooks: 'The hymn mentions Mephisto by a title the table has never heard.\nDestroying the scroll also erases one pilgrim memory.'
        },
        {
          id: 'upper-garden-parley',
          label: 'Upper Garden Parley',
          templateId: 'gm.upper_garden_parley',
          missionType: 'parley',
          region: 'yessod',
          loc: 'Mirror Garden of the Upper Choir',
          diff: 'challenging',
          title: 'Parley in the Mirror Garden',
          briefing: 'An angelic witness will talk, but only in a garden where every path reflects another life.',
          contact: 'Witness Nael',
          threat: 'Fallen envoys are already inside the garden altering what the mirrors show.',
          keyMarker: 'A cracked mirror that only reflects future choices',
          enemy: 'Fallen envoys and mirror-echo defenders',
          checkpoints: 'Find the true witness\nLearn what the mirrors are hiding\nLeave with a truth the party can survive',
          gmNotes: 'Let revelation feel useful and dangerous in equal measure.',
          hooks: 'Azrael\'s tower opens for those carrying a forbidden truth.\nOne party member sees a personal fate they can still avoid.'
        }
      ]
    }
  ];

  /* ── STATE ── */
  var _activeTab = 'reference';
  var _missionDraft = {};
  var _chronicleDraft = { title: '', body: '', hook: '' };
  var _isOpen = false;

  /* ── HELPERS ── */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function isGM() { return !!(window.settingsSystem && window.settingsSystem.isGMMode()); }
  function getS() { return (typeof S !== 'undefined') ? S : null; }
  function parseMissionCheckpointInput(text) {
    return String(text || '')
      .split(/\n|,/)
      .map(function(entry) { return String(entry || '').trim(); })
      .filter(Boolean)
      .slice(0, 8);
  }
  function uid(prefix) {
    return String(prefix || 'gm') + '-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
  }
  function buildDefaultMissionDraft() {
    var region = pick(['province','province','province','sea','galaxy','wtw','planet','yessod']);
    return {
      title: pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS),
      diff: 'medium',
      region: region,
      loc: _randomLoc(region),
      fp: 0,
      briefing: '',
      contact: '',
      threat: '',
      keyMarker: '',
      enemy: '',
      checkpoints: '',
      gmNotes: '',
      hooks: '',
      templateId: '',
      templateLabel: '',
      missionType: 'job',
      presetId: '',
      packId: ''
    };
  }
  function normalizeMissionDraft(input) {
    var draft = input && typeof input === 'object' ? input : {};
    var base = buildDefaultMissionDraft();
    return {
      title: String(draft.title || base.title),
      diff: String(draft.diff || base.diff),
      region: String(draft.region || base.region),
      loc: String(draft.loc || base.loc),
      fp: Math.max(0, Math.min(GUILD_PAIRS.length - 1, Number(draft.fp != null ? draft.fp : base.fp) || 0)),
      briefing: String(draft.briefing || ''),
      contact: String(draft.contact || ''),
      threat: String(draft.threat || ''),
      keyMarker: String(draft.keyMarker || ''),
      enemy: String(draft.enemy || ''),
      checkpoints: String(draft.checkpoints || ''),
      gmNotes: String(draft.gmNotes || ''),
      hooks: String(draft.hooks || ''),
      templateId: String(draft.templateId || ''),
      templateLabel: String(draft.templateLabel || ''),
      missionType: String(draft.missionType || 'job'),
      presetId: String(draft.presetId || ''),
      packId: String(draft.packId || '')
    };
  }
  function ensureDraft() {
    _missionDraft = normalizeMissionDraft(_missionDraft);
    return _missionDraft;
  }
  function summarizeHooks(text) {
    return parseMissionCheckpointInput(text).slice(0, 6);
  }
  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_err) { return value; }
  }
  function readForgeStorage() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(FORGE_STORAGE_KEY) : '';
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }
  function writeForgeStorage(list) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(FORGE_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 24) : []));
    } catch (_err) {}
  }
  function sanitizePreset(input) {
    var source = input && typeof input === 'object' ? input : {};
    var draft = normalizeMissionDraft(source.draft || source);
    return {
      id: String(source.id || uid('forge-preset')),
      name: String(source.name || source.label || draft.templateLabel || draft.title || 'Custom Preset').slice(0, 64),
      summary: String(source.summary || draft.briefing || '').slice(0, 180),
      updatedAt: Number(source.updatedAt || Date.now()) || Date.now(),
      draft: draft
    };
  }
  function listBuiltInPresets() {
    var out = [];
    FORGE_PACKS.forEach(function (pack) {
      (pack.presets || []).forEach(function (preset) {
        out.push({
          id: String(preset.id || uid('preset')),
          name: String(preset.label || preset.title || 'Preset'),
          summary: String(preset.briefing || preset.summary || ''),
          updatedAt: Date.now(),
          draft: normalizeMissionDraft(Object.assign({}, preset, {
            templateId: preset.templateId || ('gm.' + String(preset.id || uid('preset')).replace(/[^\w.-]+/g, '_')),
            templateLabel: preset.label || preset.title || 'Preset',
            presetId: preset.id || '',
            packId: pack.id || '',
            missionType: preset.missionType || 'job'
          }))
        });
      });
    });
    return out;
  }
  function getCampaignForgeApi() {
    if (!window.campaignSystem || typeof window.campaignSystem.getGmForgePresets !== 'function') return null;
    if (typeof window.campaignSystem.getState === 'function') {
      var state = window.campaignSystem.getState();
      if (!state || !state.code) return null;
    }
    return window.campaignSystem;
  }
  function getSavedPresets() {
    var local = readForgeStorage();
    var api = getCampaignForgeApi();
    var shared = api ? api.getGmForgePresets() : [];
    var byId = {};
    local.concat(Array.isArray(shared) ? shared : []).forEach(function (preset) {
      var row = sanitizePreset(preset);
      var prior = byId[row.id];
      if (!prior || Number(row.updatedAt || 0) >= Number(prior.updatedAt || 0)) {
        byId[row.id] = row;
      }
    });
    return Object.keys(byId).map(function (id) { return byId[id]; }).sort(function (a, b) {
      return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    });
  }
  function savePresetRecord(preset) {
    var next = sanitizePreset(preset);
    var list = getSavedPresets().filter(function (row) { return row.id !== next.id; });
    list.unshift(next);
    if (list.length > 24) list = list.slice(0, 24);
    writeForgeStorage(list);
    var api = getCampaignForgeApi();
    if (api && typeof api.saveGmForgePreset === 'function') {
      try { api.saveGmForgePreset(next); } catch (_err) {}
    }
    return next;
  }
  function deletePresetRecord(presetId) {
    var id = String(presetId || '').trim();
    if (!id) return false;
    var list = getSavedPresets().filter(function (row) { return row.id !== id; });
    writeForgeStorage(list);
    var api = getCampaignForgeApi();
    if (api && typeof api.deleteGmForgePreset === 'function') {
      try { api.deleteGmForgePreset(id); } catch (_err) {}
    }
    return true;
  }
  function getBuiltInPresetById(presetId) {
    var all = listBuiltInPresets();
    for (var i = 0; i < all.length; i += 1) {
      if (String(all[i].id || '') === String(presetId || '')) return all[i];
    }
    return null;
  }
  function getSavedPresetById(presetId) {
    var saved = getSavedPresets();
    for (var i = 0; i < saved.length; i += 1) {
      if (String(saved[i].id || '') === String(presetId || '')) return saved[i];
    }
    return null;
  }
  function getChronicleApi() {
    if (!window.campaignSystem || typeof window.campaignSystem.getCampaignChronicleEntries !== 'function') return null;
    if (typeof window.campaignSystem.getState === 'function') {
      var state = window.campaignSystem.getState();
      if (!state || !state.code) return null;
    }
    return window.campaignSystem;
  }
  function getLocalForgeMeta() {
    var s = getS();
    if (!s) return { chronicle: [], hooks: [] };
    if (!s.gmForgeMeta || typeof s.gmForgeMeta !== 'object') {
      s.gmForgeMeta = { chronicle: [], hooks: [] };
    }
    if (!Array.isArray(s.gmForgeMeta.chronicle)) s.gmForgeMeta.chronicle = [];
    if (!Array.isArray(s.gmForgeMeta.hooks)) s.gmForgeMeta.hooks = [];
    return s.gmForgeMeta;
  }
  function getChronicleEntries() {
    var api = getChronicleApi();
    if (api) return api.getCampaignChronicleEntries();
    return clone(getLocalForgeMeta().chronicle) || [];
  }
  function getHookEntries() {
    var api = getChronicleApi();
    if (api && typeof api.getCampaignHooks === 'function') return api.getCampaignHooks();
    return clone(getLocalForgeMeta().hooks) || [];
  }
  function addChronicleEntry(details) {
    var entry = details && typeof details === 'object' ? clone(details) || details : { title: '', text: String(details || '') };
    if (!String(entry.title || '').trim() && !String(entry.text || '').trim()) return false;
    var api = getChronicleApi();
    if (api && typeof api.addCampaignChronicleEntry === 'function') {
      try { api.addCampaignChronicleEntry(entry); return true; } catch (_err) {}
    }
    var meta = getLocalForgeMeta();
    meta.chronicle.unshift({
      id: uid('chronicle'),
      title: String(entry.title || 'Campaign Note').slice(0, 80),
      text: String(entry.text || '').slice(0, 400),
      kind: String(entry.kind || 'note'),
      at: Date.now(),
      by: 'GM'
    });
    if (meta.chronicle.length > 40) meta.chronicle = meta.chronicle.slice(0, 40);
    if (typeof saveState === 'function') saveState();
    return true;
  }
  function addHookEntry(details) {
    var hook = details && typeof details === 'object' ? clone(details) || details : { text: String(details || '') };
    var text = String(hook.text || hook.title || '').trim();
    if (!text) return false;
    var api = getChronicleApi();
    if (api && typeof api.addCampaignHook === 'function') {
      try { api.addCampaignHook(hook); return true; } catch (_err) {}
    }
    var meta = getLocalForgeMeta();
    meta.hooks.unshift({
      id: uid('hook'),
      text: text.slice(0, 220),
      source: String(hook.source || hook.title || 'GM Forge').slice(0, 80),
      status: 'open',
      at: Date.now(),
      by: 'GM'
    });
    if (meta.hooks.length > 60) meta.hooks = meta.hooks.slice(0, 60);
    if (typeof saveState === 'function') saveState();
    return true;
  }
  function resolveHookEntry(hookId) {
    var id = String(hookId || '').trim();
    if (!id) return false;
    var api = getChronicleApi();
    if (api && typeof api.resolveCampaignHook === 'function') {
      try { api.resolveCampaignHook(id); return true; } catch (_err) {}
    }
    var meta = getLocalForgeMeta();
    var changed = false;
    meta.hooks.forEach(function (hook) {
      if (String(hook.id || '') !== id) return;
      hook.status = 'resolved';
      hook.resolvedAt = Date.now();
      changed = true;
    });
    if (changed && typeof saveState === 'function') saveState();
    return changed;
  }

  /* ── REFERENCE CONTENT ── */
  var REFERENCE_SECTIONS = [
    {
      id: 'combat',
      title: '⚔️ Combat',
      body: `<p>Combat in <em>Beyond the Light</em> uses opposed dice rolls.</p>
<ul>
  <li><strong>Attack:</strong> Roll your Attack stat die vs the target's Defend die. If you beat it, you deal damage equal to the difference.</li>
  <li><strong>Dread (DD):</strong> The scene difficulty. Set this before a confrontation to control tension. Higher Dread = tougher enemies and larger dice swings.</li>
  <li><strong>Conditions:</strong> Bolstered (+1 to Spirit/Lead), Empowered (+1 to Body/Strike/Shoot), Protected (Defend +1 step), Distracted (−1 action). Conditions last until the scene ends unless otherwise stated.</li>
  <li><strong>Stress:</strong> Rising stress means the character is being pushed hard. At max stress, rolls are penalized.</li>
  <li><strong>Skirmishes:</strong> Multi-wave combats. Use the Combat Tab to track rounds. GM can narrate enemy reinforcements, environmental hazards, or ally actions each round.</li>
</ul>
<p><strong>GM Tip:</strong> Use the GM Dread controls (−/+ buttons in confrontation modals) to raise or lower tension without rerolling. Force Success/Failure to skip a roll when the narrative demands it.</p>`
    },
    {
      id: 'maps',
      title: '🗺️ Maps',
      body: `<p>The game features three map layers: Province, Sea, and Galaxy. Each map layer has tokens representing missions, encounters, and discovery sites.</p>
<ul>
  <li><strong>Province Map:</strong> The local area. Hexes reveal holding zones, encounters, and mission tokens. Clicking a mission token opens the mission flow.</li>
  <li><strong>World That Was:</strong> A special region with district-level encounters. Encounters resolve via rolls against the current Dread die.</li>
  <li><strong>Sea Map:</strong> Ship-based navigation. Storms, pirates, and island encounters.</li>
  <li><strong>Galaxy Map:</strong> Planet-to-planet travel. Each planet has unique encounter tables and mission opportunities.</li>
</ul>
<p><strong>GM Tip:</strong> Use the Mission Creator (see tab above) to attach a custom mission to any map region. Then generate a new mission board to surface it to players.</p>`
    },
    {
      id: 'character',
      title: '🧑 Character Sheet',
      body: `<p>Each character has the following tracked values:</p>
<ul>
  <li><strong>Stats:</strong> Body, Strike, Shoot, Mind, Spirit, Defend, Control, Lead, and Valor. Each core stat is represented by a die (d4→d6→d8→d10→d12→d20). The Valor Die (V.D.) is an additive bonus die, not an advantage mechanic.</li>
  <li><strong>Stress:</strong> Rises from failed rolls, combat damage, and hostile conditions. Max = derived from stats. At max, future rolls take penalties.</li>
  <li><strong>Credits (₵):</strong> The economy. Earned from mission rewards, trading, and loot.</li>
  <li><strong>Backpack / Inventory:</strong> Items carried during missions. Some items grant bonuses to specific rolls.</li>
  <li><strong>Origin / Reason:</strong> The character's narrative motivation. Drives the origin mission.</li>
</ul>
<p><strong>GM Tip:</strong> Use Character Controls (tab above) to add/remove items, adjust credits, set stress, or modify guild renown mid-session without asking the player to do it manually.</p>`
    },
    {
      id: 'missions',
      title: '📋 Missions',
      body: `<p>Missions are 3-step structures: Info Gather → Site Exploration → Confrontation.</p>
<ul>
  <li><strong>Step 1 — Info Gather:</strong> Optional. Roll to gain a feature (hidden cache, back entrance, shrine, etc.) that helps in later steps. Can be skipped.</li>
  <li><strong>Step 2 — Site Exploration:</strong> Navigate rooms. Each room may contain guards, traps, puzzles, or caches. Resolve via NPC/item cards drawn per room.</li>
  <li><strong>Step 3 — Confrontation:</strong> The mission climax. Roll Valor Die (V.D.) vs Dread die. GM can adjust Dread, force success/failure, or reveal/hide the DC from players. The Valor Die is always additive, not an advantage mechanic.</li>
  <li><strong>Difficulty levels:</strong> Easy (d4) → Medium (d6) → Hard (d8) → Challenging (d10) → Very Hard (d12) → Impossible (d20).</li>
</ul>
<p><strong>GM Tip:</strong> The Mission Creator (tab) lets you build a fully custom mission from scratch with randomized or hand-chosen components and push it directly to the mission board or active tracker.</p>`
    },
    {
      id: 'storylines',
      title: '📖 Storylines',
      body: `<p>Storyline scenes are narrative checkpoints with option-based rolls.</p>
<ul>
  <li>Each scene presents 2–4 options. Each option has its own Dread die and a stat to roll against it.</li>
  <li>Success and failure both advance the story — just in different directions.</li>
  <li>Guild outcomes: some options shift guild renown up or down for specific groups.</li>
</ul>
<p><strong>GM Tip:</strong> In the storyline roll modal, use the GM Controls section to adjust the Dread die per option, hide the total from the player, or force a specific outcome when the narrative needs it.</p>`
    },
    {
      id: 'factions',
      title: '⚖️ Guilds',
      body: `<p>Six guild powers compete for influence: The Gilded Ledger, The Underground Crown, The Sacred Choir, The Iron Cohort, The Ember Union, and The Archive Keepers.</p>
<ul>
  <li>Completing missions gains renown with one guild and can reduce it with another (see mission conflict pair).</li>
  <li>High/low guild renown unlocks narrative flavors in encounters and storyline choices.</li>
  <li>Guild renown is shown on the character sheet and tracked in the Guild tab.</li>
</ul>
<p><strong>GM Tip:</strong> Character Controls let you directly bump guild renown – useful for rewarding or penalizing out-of-session decisions.</p>`
    },
    {
      id: 'worldthatwas',
      title: '🌑 World That Was',
      body: `<p>A haunt of ruins from a fallen civilization. Encounters are drawn from district-specific tables.</p>
<ul>
  <li>Non-combat encounters resolve via a stat check vs current Dread.</li>
  <li>Wayfarer events are narrative beats (no roll).</li>
  <li>Combat encounters launch the full combat tab.</li>
</ul>
<p><strong>GM Tip:</strong> Clicking a district hex opens the encounter card. In GM mode, Force Success / Force Failure buttons appear on non-combat cards so you can steer the narrative.</p>`
    },
    {
      id: 'gmtools',
      title: '🛠️ GM Tools Summary',
      body: `<p>All GM tools available in this build:</p>
<ul>
  <li><strong>Reveal DC toggle:</strong> Settings → GM Visibility → hides/shows the Dread die value in mission and storyline modals.</li>
  <li><strong>Reveal Hidden Info toggle:</strong> Settings → GM Visibility → hides/shows loot badges, checkpoints, and roll totals.</li>
  <li><strong>Dread −/+:</strong> Appears in Mission Step 3 modal and Storyline roll modal when in GM mode. Steps through d4→d6→d8→d10→d12→d20.</li>
  <li><strong>Force Success / Force Failure:</strong> Bypasses the dice roll entirely for missions, storylines, and World That Was encounters.</li>
  <li><strong>Character Controls tab:</strong> Adjust credits, stress, inventory, and guild renown.</li>
  <li><strong>Mission Creator tab:</strong> Build and deploy custom missions with randomizer support.</li>
</ul>`
    }
  ];

  /* ── RENDER DASHBOARD ── */
  function renderDashboard() {
    var panel = document.getElementById('gmDashboard');
    if (!panel) return;

    if (!_isOpen) {
      panel.innerHTML = '';
      panel.classList.remove('open');
      return;
    }

    panel.classList.add('open');
    panel.innerHTML = `
      <div class="gmd-backdrop" onclick="window.gmDashboard.close()"></div>
      <div class="gmd-panel">
        <div class="gmd-header">
          <span class="gmd-title">👥 GM Dashboard</span>
          <button class="gmd-close" onclick="window.gmDashboard.close()">✕</button>
        </div>
        <div class="gmd-tabs">
          <button class="gmd-tab ${_activeTab==='reference'?'active':''}" onclick="window.gmDashboard.tab('reference')">📚 Reference</button>
          <button class="gmd-tab ${_activeTab==='controls'?'active':''}" onclick="window.gmDashboard.tab('controls')">🎮 Character Controls</button>
          <button class="gmd-tab ${_activeTab==='creator'?'active':''}" onclick="window.gmDashboard.tab('creator')">🛠️ GM Forge</button>
          <button class="gmd-tab ${_activeTab==='chronicle'?'active':''}" onclick="window.gmDashboard.tab('chronicle')">📜 Chronicle</button>
        </div>
        <div class="gmd-body" id="gmdBody">
          ${_activeTab === 'reference' ? renderReference() : ''}
          ${_activeTab === 'controls' ? renderControls() : ''}
          ${_activeTab === 'creator' ? renderCreator() : ''}
          ${_activeTab === 'chronicle' ? renderChronicle() : ''}
        </div>
      </div>`;
  }

  /* ── REFERENCE TAB ── */
  function renderReference() {
    var html = '<div class="gmd-reference">';
    REFERENCE_SECTIONS.forEach(function(sec) {
      html += `<details class="gmd-ref-section" id="ref-${sec.id}">
        <summary class="gmd-ref-title">${sec.title}</summary>
        <div class="gmd-ref-body">${sec.body}</div>
      </details>`;
    });
    html += '</div>';
    return html;
  }

  /* ── CHARACTER CONTROLS TAB ── */
  function renderControls() {
    var s = getS();
    if (!s) return '<div class="gmd-empty">No character loaded. Generate a character first.</div>';

    var backpack = Array.isArray(s.backpack) ? s.backpack.filter(Boolean) : [];
    var maxStress = (typeof getMaxStress === 'function') ? getMaxStress() : 10;
    var factionHTML = GUILD_IDS.map(function(f) {
      var val = (s.factionRenown && s.factionRenown[f]) || (s.factionStanding && s.factionStanding[f]) || 0;
      return `<div class="gmd-ctrl-row">
        <span class="gmd-ctrl-label">${GUILD_LABELS[f]}</span>
        <div class="gmd-ctrl-stepper">
          <button class="btn btn-xs" onclick="window.gmDashboard.adjustGuildRenown('${f}',-1)">−</button>
          <span class="gmd-ctrl-val">${val}</span>
          <button class="btn btn-xs" onclick="window.gmDashboard.adjustGuildRenown('${f}',1)">+</button>
        </div>
      </div>`;
    }).join('');

    var invHTML = backpack.length
      ? backpack.map(function(item, i) {
          return `<div class="gmd-inv-item">
            <span>${item}</span>
            <button class="btn btn-xs gmd-btn-danger" onclick="window.gmDashboard.removeItem(${i})">✕</button>
          </div>`;
        }).join('')
      : '<div class="gmd-muted">No items in backpack.</div>';

    return `<div class="gmd-controls">

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">⚡ Resources</div>
        <div class="gmd-ctrl-row">
          <span class="gmd-ctrl-label">Credits (₵)</span>
          <div class="gmd-ctrl-stepper">
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustCredits(-10)">−10</button>
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustCredits(-50)">−50</button>
            <span class="gmd-ctrl-val" id="gmdCredits">${s.credits || 0} ₵</span>
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustCredits(50)">+50</button>
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustCredits(100)">+100</button>
          </div>
        </div>
        <div class="gmd-ctrl-row">
          <span class="gmd-ctrl-label">Set Credits Exactly</span>
          <div style="display:flex;gap:.3rem;align-items:center;">
            <input type="number" id="gmdCreditsInput" class="gmd-input-sm" value="${s.credits || 0}" min="0">
            <button class="btn btn-xs btn-teal" onclick="window.gmDashboard.setCreditsExact()">Set</button>
          </div>
        </div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">🩸 Stress</div>
        <div class="gmd-ctrl-row">
          <span class="gmd-ctrl-label">Stress (max ${maxStress})</span>
          <div class="gmd-ctrl-stepper">
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustStress(-1)">−1</button>
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustStress(-3)">−3</button>
            <span class="gmd-ctrl-val" id="gmdStress">${s.stress || 0}</span>
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustStress(3)">+3</button>
            <button class="btn btn-xs" onclick="window.gmDashboard.adjustStress(1)">+1</button>
          </div>
        </div>
        <div class="gmd-ctrl-row">
          <button class="btn btn-xs" onclick="window.gmDashboard.setStressTo(0)">Clear All Stress</button>
          <button class="btn btn-xs" style="margin-left:.3rem" onclick="window.gmDashboard.setStressTo(${maxStress})">Max Stress</button>
        </div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">⚖️ Guild Renown</div>
        ${factionHTML}
        <div class="gmd-ctrl-row" style="margin-top:.4rem">
          <button class="btn btn-xs" onclick="window.gmDashboard.resetGuildRenown()">Reset All Guild Renown to 0</button>
        </div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">🎒 Inventory</div>
        <div class="gmd-inv-list">${invHTML}</div>
        <div style="display:flex;gap:.3rem;margin-top:.4rem;align-items:center;">
          <input type="text" id="gmdAddItemInput" placeholder="Item name..." class="gmd-input" maxlength="60">
          <button class="btn btn-xs btn-teal" onclick="window.gmDashboard.addItem()">Add</button>
        </div>
        <div style="margin-top:.35rem;display:flex;gap:.2rem;flex-wrap:wrap;">
          ${['Healing Salve','Rope','Torch','Iron Tools','Medkit','Smoke Grenade','Lockpick','Datapad','Rations','Security Card'].map(function(i){
            return `<button class="btn btn-xs gmd-quick-item" onclick="window.gmDashboard.addItemQuick('${i}')">${i}</button>`;
          }).join('')}
        </div>
      </div>

    </div>`;
  }

  /* ── MISSION CREATOR TAB ── */
  function renderCreator() {
    var draft = ensureDraft();
    var title  = draft.title;
    var diff   = draft.diff || 'medium';
    var region = draft.region || 'province';
    var loc    = draft.loc || pick(MISSION_LOCS);
    var fp     = draft.fp !== undefined ? draft.fp : 0;
    var briefing = draft.briefing || '';
    var contact = draft.contact || '';
    var threat = draft.threat || '';
    var keyMarker = draft.keyMarker || '';
    var enemy = draft.enemy || '';
    var checkpoints = draft.checkpoints || '';
    var gmNotes = draft.gmNotes || '';
    var hooks = draft.hooks || '';
    var templateLabel = draft.templateLabel || '';
    var missionType = draft.missionType || 'job';
    var fPair  = GUILD_PAIRS[Math.min(fp, GUILD_PAIRS.length - 1)];
    var builtInPacksHtml = FORGE_PACKS.map(function (pack) {
      var presetButtons = (pack.presets || []).map(function (preset) {
        return '<button class="btn btn-xs" style="margin:0 .25rem .25rem 0;" onclick="window.gmDashboard.applyPreset(\'' + escHtml(String(preset.id || '')) + '\')">' + escHtml(String(preset.label || preset.title || 'Preset')) + '</button>';
      }).join('');
      return '<div class="gmd-pack-card">'
        + '<div class="gmd-pack-title">' + escHtml(pack.label) + '</div>'
        + '<div class="gmd-pack-summary">' + escHtml(pack.summary || '') + '</div>'
        + '<div style="margin-top:.45rem;">' + presetButtons + '</div>'
        + '</div>';
    }).join('');
    var savedPresets = getSavedPresets();
    var savedPresetsHtml = savedPresets.length
      ? savedPresets.map(function (preset) {
          var rowDraft = normalizeMissionDraft(preset.draft || {});
          var rowLabel = preset.name || rowDraft.templateLabel || rowDraft.title || 'Preset';
          var rowMeta = [
            rowDraft.region ? rowDraft.region.toUpperCase() : '',
            rowDraft.diff ? String(rowDraft.diff).replace(/_/g, ' ') : '',
            rowDraft.loc || ''
          ].filter(Boolean).join(' · ');
          return '<div class="gmd-saved-row">'
            + '<div style="min-width:0;">'
            + '<div class="gmd-saved-title">' + escHtml(rowLabel) + '</div>'
            + '<div class="gmd-saved-meta">' + escHtml(rowMeta) + '</div>'
            + '</div>'
            + '<div class="gmd-saved-actions">'
            + '<button class="btn btn-xs btn-teal" onclick="window.gmDashboard.loadSavedPreset(\'' + escHtml(String(preset.id || '')) + '\')">Load</button>'
            + '<button class="btn btn-xs" onclick="window.gmDashboard.overwriteSavedPreset(\'' + escHtml(String(preset.id || '')) + '\')">Overwrite</button>'
            + '<button class="btn btn-xs btn-red" onclick="window.gmDashboard.deleteSavedPreset(\'' + escHtml(String(preset.id || '')) + '\')">Delete</button>'
            + '</div>'
            + '</div>';
        }).join('')
      : '<div class="gmd-muted">No custom presets yet. Save one once the draft feels right.</div>';

    var diffHTML = Object.keys(DIFFICULTIES).map(function(k) {
      var d = DIFFICULTIES[k];
      return `<button class="gmd-diff-btn ${diff===k?'active':''}" onclick="window.gmDashboard.setDiff('${k}')">${d.name}<br><small>d${d.dread} / ${d.reward}₵</small></button>`;
    }).join('');

    var regionHTML = ['province','sea','galaxy','wtw','planet','yessod'].map(function(r) {
      var labels = { province:'Province', sea:'Sea', galaxy:'Galaxy', wtw:'World That Was', planet:'Planet', yessod:'Yessod' };
      return `<button class="gmd-region-btn ${region===r?'active':''}" onclick="window.gmDashboard.setRegion('${r}')">${labels[r]}</button>`;
    }).join('');

    var fpHTML = GUILD_PAIRS.map(function(p, i) {
      return `<option value="${i}" ${i===fp?'selected':''}>${p.gainName} gain / ${p.loseName} lose</option>`;
    }).join('');

    return `<div class="gmd-creator">

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">📦 Forge Packs</div>
        <div class="gmd-pack-grid">${builtInPacksHtml}</div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">💾 Saved Presets</div>
        <div class="gmd-saved-list">${savedPresetsHtml}</div>
        <div class="campaign-actions" style="margin:.45rem 0 0;">
          <button class="btn btn-xs btn-teal" onclick="window.gmDashboard.saveCurrentPreset()">Save Current As Preset</button>
          <button class="btn btn-xs" onclick="window.gmDashboard.resetDraft()">Reset Draft</button>
        </div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">📝 Mission Title</div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;">
          <input type="text" id="gmdMissionTitle" class="gmd-input" value="${title}" maxlength="80"
            oninput="window.gmDashboard.setTitle(this.value)">
          <button class="btn btn-xs" onclick="window.gmDashboard.randomTitle()">🎲 Randomize</button>
        </div>
        <div class="gmd-muted" style="margin-top:.3rem;font-style:normal;">${templateLabel ? ('Loaded preset: <strong style="color:var(--gold2);">' + escHtml(templateLabel) + '</strong>') : 'Freeform mission draft. Save it as a preset once it feels reusable.'}</div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">⚔️ Difficulty (sets Dread die)</div>
        <div class="gmd-diff-grid">${diffHTML}</div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">🗺️ Region</div>
        <div style="display:flex;gap:.3rem;flex-wrap:wrap;">${regionHTML}</div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">📍 Location</div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;">
          <input type="text" id="gmdMissionLoc" class="gmd-input" value="${loc}" maxlength="80"
            oninput="window.gmDashboard.setLoc(this.value)">
          <button class="btn btn-xs" onclick="window.gmDashboard.randomLoc()">🎲 Randomize</button>
        </div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">📜 Briefing</div>
        <textarea id="gmdMissionBriefing" class="gmd-input" rows="3" maxlength="360"
          oninput="window.gmDashboard.setBriefing(this.value)"
          placeholder="What do the players know up front?">${briefing}</textarea>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">🧭 GM Prep</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;">
          <input type="text" id="gmdMissionContact" class="gmd-input" value="${contact}" maxlength="100"
            oninput="window.gmDashboard.setContact(this.value)" placeholder="Key contact / NPC">
          <input type="text" id="gmdMissionThreat" class="gmd-input" value="${threat}" maxlength="100"
            oninput="window.gmDashboard.setThreat(this.value)" placeholder="Pressure / faction threat">
          <input type="text" id="gmdMissionMarker" class="gmd-input" value="${keyMarker}" maxlength="100"
            oninput="window.gmDashboard.setKeyMarker(this.value)" placeholder="Key marker / clue / objective">
          <input type="text" id="gmdMissionEnemy" class="gmd-input" value="${enemy}" maxlength="100"
            oninput="window.gmDashboard.setEnemy(this.value)" placeholder="Enemy / boss / patrol">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;margin-top:.4rem;">
          <input type="text" id="gmdMissionType" class="gmd-input" value="${escHtml(missionType)}" maxlength="40"
            oninput="window.gmDashboard.setMissionType(this.value)" placeholder="Mission type / loop (heist, delve, escort...)">
          <input type="text" id="gmdTemplateLabel" class="gmd-input" value="${escHtml(templateLabel)}" maxlength="80"
            oninput="window.gmDashboard.setTemplateLabel(this.value)" placeholder="Template label shown in chronicle / board">
        </div>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">✅ Story Beats / Checkpoints</div>
        <textarea id="gmdMissionCheckpoints" class="gmd-input" rows="3" maxlength="320"
          oninput="window.gmDashboard.setCheckpoints(this.value)"
          placeholder="One per line or comma-separated. Example: Reach rift rim, Meet smuggler scout, Secure fallen sky marker">${checkpoints}</textarea>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">🕯️ GM Notes</div>
        <textarea id="gmdMissionNotes" class="gmd-input" rows="3" maxlength="420"
          oninput="window.gmDashboard.setGMNotes(this.value)"
          placeholder="Private prep notes, twists, escalation, mercy hooks, rival reveals...">${gmNotes}</textarea>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">🪝 Unresolved Hooks / Fallout</div>
        <textarea id="gmdMissionHooks" class="gmd-input" rows="3" maxlength="360"
          oninput="window.gmDashboard.setHooks(this.value)"
          placeholder="One per line or comma-separated. These get tracked as open hooks in campaign mode.">${hooks}</textarea>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">⚖️ Guild Conflict</div>
        <select id="gmdFactionPair" class="gmd-select" onchange="window.gmDashboard.setFP(this.value)">${fpHTML}</select>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading gmd-preview-heading">👁️ Preview</div>
        <div class="gmd-preview">
          <div><strong>${escHtml(title)}</strong></div>
          <div style="color:var(--muted2);font-size:.8rem;">${escHtml(loc)} · ${DIFFICULTIES[diff].name} · d${DIFFICULTIES[diff].dread} Dread · ${DIFFICULTIES[diff].reward}₵</div>
          ${(missionType || templateLabel) ? `<div style="color:var(--muted2);font-size:.74rem;margin-top:.15rem;">${templateLabel ? ('Template: ' + escHtml(templateLabel) + ' · ') : ''}${missionType ? ('Type: ' + escHtml(missionType)) : ''}</div>` : ''}
          <div style="color:var(--muted2);font-size:.75rem;margin-top:.15rem;">Gain: ${fPair.gainName} · Lose: ${fPair.loseName}</div>
          ${briefing ? `<div style="color:var(--text2);font-size:.75rem;line-height:1.5;margin-top:.2rem;border-left:2px solid var(--border2);padding-left:.45rem;">${escHtml(briefing)}</div>` : ''}
          ${(contact || threat || keyMarker || enemy)
            ? `<div style="display:grid;gap:.12rem;color:var(--muted2);font-size:.72rem;line-height:1.45;margin-top:.22rem;">
                ${contact ? `<div><strong style="color:var(--gold2);">Contact:</strong> ${escHtml(contact)}</div>` : ''}
                ${threat ? `<div><strong style="color:var(--red2);">Threat:</strong> ${escHtml(threat)}</div>` : ''}
                ${keyMarker ? `<div><strong style="color:var(--teal);">Marker:</strong> ${escHtml(keyMarker)}</div>` : ''}
                ${enemy ? `<div><strong style="color:var(--red2);">Enemy:</strong> ${escHtml(enemy)}</div>` : ''}
              </div>`
            : ''}
          ${parseMissionCheckpointInput(checkpoints).length ? `<div style="color:var(--muted2);font-size:.72rem;line-height:1.45;margin-top:.2rem;">Checkpoints: ${parseMissionCheckpointInput(checkpoints).map(escHtml).join(' · ')}</div>` : ''}
          ${summarizeHooks(hooks).length ? `<div style="color:var(--muted2);font-size:.72rem;line-height:1.45;margin-top:.2rem;">Hooks: ${summarizeHooks(hooks).map(escHtml).join(' · ')}</div>` : ''}
        </div>
      </div>

      <div class="gmd-ctrl-section" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.2rem;">
        <button class="btn btn-sm btn-teal" onclick="window.gmDashboard.deployToBoard()">📌 Post to Mission Board</button>
        <button class="btn btn-sm" onclick="window.gmDashboard.deployToActive()">▶ Activate Immediately</button>
        <button class="btn btn-xs" onclick="window.gmDashboard.seedRiftPatrol()">🌀 Rift Patrol Seed</button>
        <button class="btn btn-xs" onclick="window.gmDashboard.saveCurrentPreset()">💾 Save As Preset</button>
        <button class="btn btn-xs" style="margin-left:auto;" onclick="window.gmDashboard.randomAll()">🎲 Full Randomize</button>
      </div>

    </div>`;
  }

  function renderChronicle() {
    var chronicleEntries = getChronicleEntries();
    var hooks = getHookEntries();
    var openHooks = hooks.filter(function (hook) { return String(hook && hook.status || 'open') !== 'resolved'; });
    var resolvedHooks = hooks.filter(function (hook) { return String(hook && hook.status || '') === 'resolved'; }).slice(0, 8);
    var chronicleHtml = chronicleEntries.length
      ? chronicleEntries.slice(0, 12).map(function (entry) {
          var title = String(entry && entry.title || 'Campaign Note');
          var text = String(entry && (entry.text || entry.body) || '');
          var by = String(entry && entry.by || 'GM');
          var stamp = Number(entry && entry.at || 0);
          return '<div class="gmd-journal-entry">'
            + '<div class="gmd-journal-head"><strong>' + escHtml(title) + '</strong><span>' + escHtml(by) + ' · ' + escHtml(stamp ? new Date(stamp).toLocaleString() : 'Now') + '</span></div>'
            + '<div class="gmd-journal-body">' + escHtml(text || 'No details recorded.') + '</div>'
            + '</div>';
        }).join('')
      : '<div class="gmd-muted">No chronicle entries yet. Use this to preserve what actually happened at the table, not just what was planned.</div>';
    var openHooksHtml = openHooks.length
      ? openHooks.slice(0, 18).map(function (hook) {
          return '<div class="gmd-hook-row">'
            + '<div style="min-width:0;">'
            + '<div class="gmd-hook-text">' + escHtml(String(hook.text || hook.title || 'Open hook')) + '</div>'
            + '<div class="gmd-saved-meta">' + escHtml(String(hook.source || 'GM Forge')) + '</div>'
            + '</div>'
            + '<button class="btn btn-xs btn-teal" onclick="window.gmDashboard.resolveHook(\'' + escHtml(String(hook.id || '')) + '\')">Resolve</button>'
            + '</div>';
        }).join('')
      : '<div class="gmd-muted">No open hooks right now. This is a good sign for table clarity.</div>';
    var resolvedHooksHtml = resolvedHooks.length
      ? resolvedHooks.map(function (hook) {
          return '<div class="gmd-hook-row is-resolved">'
            + '<div style="min-width:0;">'
            + '<div class="gmd-hook-text">' + escHtml(String(hook.text || hook.title || 'Resolved hook')) + '</div>'
            + '<div class="gmd-saved-meta">' + escHtml(String(hook.source || 'GM Forge')) + '</div>'
            + '</div>'
            + '</div>';
        }).join('')
      : '<div class="gmd-muted">Nothing resolved yet this session.</div>';

    return '<div class="gmd-creator">'
      + '<div class="gmd-ctrl-section">'
      + '<div class="gmd-ctrl-heading">🖋️ Add Chronicle Entry</div>'
      + '<input type="text" id="gmdChronicleTitle" class="gmd-input" maxlength="80" value="' + escHtml(_chronicleDraft.title || '') + '" placeholder="Session title or beat" oninput="window.gmDashboard.setChronicleTitle(this.value)">'
      + '<textarea id="gmdChronicleBody" class="gmd-input" rows="4" maxlength="500" style="margin-top:.4rem;" placeholder="What actually happened at the table?" oninput="window.gmDashboard.setChronicleBody(this.value)">' + escHtml(_chronicleDraft.body || '') + '</textarea>'
      + '<div class="campaign-actions" style="margin:.45rem 0 0;">'
      + '<button class="btn btn-xs btn-teal" onclick="window.gmDashboard.addChronicleEntry()">Add To Chronicle</button>'
      + '</div>'
      + '</div>'
      + '<div class="gmd-ctrl-section">'
      + '<div class="gmd-ctrl-heading">🪝 Add Open Hook</div>'
      + '<textarea id="gmdChronicleHook" class="gmd-input" rows="3" maxlength="280" placeholder="What loose end should survive this scene?" oninput="window.gmDashboard.setChronicleHook(this.value)">' + escHtml(_chronicleDraft.hook || '') + '</textarea>'
      + '<div class="campaign-actions" style="margin:.45rem 0 0;">'
      + '<button class="btn btn-xs btn-teal" onclick="window.gmDashboard.addHook()">Track Hook</button>'
      + '</div>'
      + '</div>'
      + '<div class="gmd-ctrl-section">'
      + '<div class="gmd-ctrl-heading">📜 Campaign Chronicle</div>'
      + chronicleHtml
      + '</div>'
      + '<div class="gmd-ctrl-section">'
      + '<div class="gmd-ctrl-heading">🧵 Open Hooks</div>'
      + openHooksHtml
      + '</div>'
      + '<div class="gmd-ctrl-section">'
      + '<div class="gmd-ctrl-heading">✅ Recently Resolved</div>'
      + resolvedHooksHtml
      + '</div>'
      + '</div>';
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── ACTIONS ── */

  function open() {
    if (!isGM()) {
      if (typeof showNotif === 'function') showNotif('Switch to GM Mode first.', 'bad');
      return;
    }
    ensureDraft();
    _isOpen = true;
    renderDashboard();
  }

  function close() {
    _isOpen = false;
    renderDashboard();
  }

  function toggle() {
    if (_isOpen) { close(); } else { open(); }
  }

  function switchTab(t) {
    _activeTab = t;
    renderDashboard();
  }

  /* Character controls */

  function adjustCredits(delta) {
    var s = getS();
    if (!s) return;
    s.credits = Math.max(0, (s.credits || 0) + delta);
    if (typeof saveState === 'function') saveState();
    if (typeof updateHeaderCredits === 'function') updateHeaderCredits();
    var el = document.getElementById('gmdCredits');
    if (el) el.textContent = s.credits + ' ₵';
    var inp = document.getElementById('gmdCreditsInput');
    if (inp) inp.value = s.credits;
    if (typeof showNotif === 'function') showNotif('Credits: ' + s.credits + ' ₵', 'good');
  }

  function setCreditsExact() {
    var inp = document.getElementById('gmdCreditsInput');
    if (!inp) return;
    var val = parseInt(inp.value, 10);
    if (isNaN(val) || val < 0) return;
    var s = getS();
    if (!s) return;
    s.credits = val;
    if (typeof saveState === 'function') saveState();
    if (typeof updateHeaderCredits === 'function') updateHeaderCredits();
    var el = document.getElementById('gmdCredits');
    if (el) el.textContent = val + ' ₵';
    if (typeof showNotif === 'function') showNotif('Credits set to ' + val + ' ₵', 'good');
  }

  function adjustStress(delta) {
    if (typeof setStress === 'function') {
      var s = getS();
      if (!s) return;
      setStress((s.stress || 0) + delta);
    }
    var el = document.getElementById('gmdStress');
    var s2 = getS();
    if (el && s2) el.textContent = s2.stress || 0;
    if (typeof showNotif === 'function') showNotif('Stress adjusted.', 'info');
  }

  function setStressTo(val) {
    if (typeof setStress === 'function') { setStress(val); }
    var el = document.getElementById('gmdStress');
    var s = getS();
    if (el && s) el.textContent = s.stress || 0;
    if (typeof showNotif === 'function') showNotif('Stress set to ' + val, val === 0 ? 'good' : 'bad');
  }

  function adjustGuildRenown(f, delta) {
    var s = getS();
    if (!s) return;
    s.factionRenown = s.factionRenown || {};
    var current = Number(s.factionRenown[f] || 0) + Number(delta || 0);
    s.factionRenown[f] = Math.max(-10, Math.min(12, current));
    s.factionStanding = s.factionStanding || {};
    s.factionStanding[f] = s.factionRenown[f];
    if (typeof saveState === 'function') saveState();
    if (typeof renderFactionPanel === 'function') renderFactionPanel();
    switchTab('controls');
  }

  function resetGuildRenown() {
    var s = getS();
    if (!s) return;
    s.factionRenown = {};
    s.factionStanding = {};
    GUILD_IDS.forEach(function(f) {
      s.factionRenown[f] = 0;
      s.factionStanding[f] = 0;
    });
    if (typeof saveState === 'function') saveState();
    if (typeof renderFactionPanel === 'function') renderFactionPanel();
    switchTab('controls');
  }

  function addItem() {
    var inp = document.getElementById('gmdAddItemInput');
    if (!inp) return;
    var name = inp.value.trim();
    if (!name) return;
    _addItemToBackpack(name);
    inp.value = '';
  }

  function addItemQuick(name) { _addItemToBackpack(name); }

  function _addItemToBackpack(name) {
    var s = getS();
    if (!s) return;
    s.backpack = s.backpack || [];
    var slot = s.backpack.indexOf(null);
    if (slot >= 0) { s.backpack[slot] = name; }
    else if (s.backpack.length < 9) { s.backpack.push(name); }
    else { if (typeof showNotif === 'function') showNotif('Backpack full!', 'bad'); return; }
    if (typeof saveState === 'function') saveState();
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof showNotif === 'function') showNotif('Added: ' + name, 'good');
    switchTab('controls');
  }

  function removeItem(idx) {
    var s = getS();
    if (!s || !s.backpack) return;
    var name = s.backpack[idx] || 'item';
    s.backpack.splice(idx, 1);
    if (typeof saveState === 'function') saveState();
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof showNotif === 'function') showNotif('Removed: ' + name, 'info');
    switchTab('controls');
  }

  /* Mission creator actions */

  function setTitle(v) { ensureDraft(); _missionDraft.title = v; }
  function setLoc(v) { ensureDraft(); _missionDraft.loc = v; }
  function setDiff(k) { ensureDraft(); _missionDraft.diff = k; renderDashboard(); }
  function setRegion(r) { ensureDraft(); _missionDraft.region = r; _missionDraft.loc = _randomLoc(r); renderDashboard(); }
  function setFP(v) { ensureDraft(); _missionDraft.fp = parseInt(v, 10); }
  function setBriefing(v) { ensureDraft(); _missionDraft.briefing = v; }
  function setContact(v) { ensureDraft(); _missionDraft.contact = v; }
  function setThreat(v) { ensureDraft(); _missionDraft.threat = v; }
  function setKeyMarker(v) { ensureDraft(); _missionDraft.keyMarker = v; }
  function setEnemy(v) { ensureDraft(); _missionDraft.enemy = v; }
  function setCheckpoints(v) { ensureDraft(); _missionDraft.checkpoints = v; }
  function setGMNotes(v) { ensureDraft(); _missionDraft.gmNotes = v; }
  function setHooks(v) { ensureDraft(); _missionDraft.hooks = v; }
  function setMissionType(v) { ensureDraft(); _missionDraft.missionType = v; }
  function setTemplateLabel(v) { ensureDraft(); _missionDraft.templateLabel = v; }
  function setChronicleTitle(v) { _chronicleDraft.title = String(v || ''); }
  function setChronicleBody(v) { _chronicleDraft.body = String(v || ''); }
  function setChronicleHook(v) { _chronicleDraft.hook = String(v || ''); }

  function randomTitle() {
    ensureDraft();
    var t = pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS);
    _missionDraft.title = t;
    var inp = document.getElementById('gmdMissionTitle');
    if (inp) inp.value = t;
  }

  function randomLoc() {
    ensureDraft();
    var loc = _randomLoc(_missionDraft.region || 'province');
    _missionDraft.loc = loc;
    var inp = document.getElementById('gmdMissionLoc');
    if (inp) inp.value = loc;
  }

  function _randomLoc(region) {
    if (region === 'sea')     return pick(SEA_LOCS);
    if (region === 'galaxy')  return pick(GALAXY_LOCS);
    if (region === 'wtw')     return pick(WTW_LOCS);
    if (region === 'planet')  return pick(PLANET_LOCS);
    if (region === 'yessod')  return pick(YESSOD_LOCS);
    return pick(MISSION_LOCS);
  }

  function randomAll() {
    _missionDraft = buildDefaultMissionDraft();
    _missionDraft.diff = pick(Object.keys(DIFFICULTIES));
    _missionDraft.fp = Math.floor(Math.random() * GUILD_PAIRS.length);
    renderDashboard();
  }

  function seedRiftPatrol() {
    applyPreset('rift-patrol');
  }

  function applyPreset(presetId) {
    var builtIn = getBuiltInPresetById(presetId);
    var saved = getSavedPresetById(presetId);
    var preset = saved || builtIn;
    if (!preset) {
      if (typeof showNotif === 'function') showNotif('Preset not found.', 'bad');
      return false;
    }
    _missionDraft = normalizeMissionDraft(Object.assign({}, preset.draft || {}, {
      templateLabel: preset.name || (preset.draft && preset.draft.templateLabel) || '',
      presetId: String(preset.id || ''),
      templateId: (preset.draft && preset.draft.templateId) || ('gm.' + String(preset.id || uid('preset')).replace(/[^\w.-]+/g, '_'))
    }));
    var api = getCampaignForgeApi();
    if (api && typeof api.setGmForgeLastPreset === 'function') {
      try { api.setGmForgeLastPreset(String(preset.id || '')); } catch (_err) {}
    }
    renderDashboard();
    if (typeof showNotif === 'function') showNotif('Forge preset loaded: ' + (preset.name || 'Preset'), 'good');
    return true;
  }

  function loadSavedPreset(presetId) {
    return applyPreset(presetId);
  }

  function saveCurrentPreset() {
    var draft = _readDraftFromInputs();
    draft.templateId = draft.templateId || _missionDraft.templateId || ('gm.' + uid('preset').replace(/[^\w.-]+/g, '_'));
    draft.templateLabel = draft.templateLabel || _missionDraft.templateLabel || draft.title;
    var defaultName = draft.templateLabel || draft.title || 'GM Forge Preset';
    var name = window.prompt ? window.prompt('Save preset as:', defaultName) : defaultName;
    if (name === null) return false;
    name = String(name || '').trim();
    if (!name) {
      if (typeof showNotif === 'function') showNotif('Preset name required.', 'bad');
      return false;
    }
    var saved = savePresetRecord({
      id: _missionDraft.presetId || uid('forge-preset'),
      name: name,
      summary: draft.briefing || '',
      draft: Object.assign({}, draft, {
        templateLabel: name,
        presetId: _missionDraft.presetId || ''
      })
    });
    _missionDraft.presetId = saved.id;
    _missionDraft.templateLabel = name;
    renderDashboard();
    if (typeof showNotif === 'function') showNotif('Preset saved: ' + name, 'good');
    return true;
  }

  function overwriteSavedPreset(presetId) {
    var preset = getSavedPresetById(presetId);
    if (!preset) return saveCurrentPreset();
    var draft = _readDraftFromInputs();
    savePresetRecord({
      id: preset.id,
      name: preset.name,
      summary: draft.briefing || preset.summary || '',
      draft: Object.assign({}, draft, {
        templateId: draft.templateId || _missionDraft.templateId || preset.draft && preset.draft.templateId || '',
        templateLabel: preset.name,
        presetId: preset.id
      })
    });
    _missionDraft.presetId = preset.id;
    _missionDraft.templateLabel = preset.name;
    renderDashboard();
    if (typeof showNotif === 'function') showNotif('Preset updated: ' + preset.name, 'good');
    return true;
  }

  function deleteSavedPreset(presetId) {
    var preset = getSavedPresetById(presetId);
    if (!preset) return false;
    if (window.confirm && !window.confirm('Delete preset "' + preset.name + '"?')) return false;
    deletePresetRecord(presetId);
    if (String(_missionDraft.presetId || '') === String(presetId || '')) {
      _missionDraft.presetId = '';
      _missionDraft.templateLabel = '';
    }
    renderDashboard();
    if (typeof showNotif === 'function') showNotif('Preset deleted: ' + preset.name, 'info');
    return true;
  }

  function resetDraft() {
    _missionDraft = buildDefaultMissionDraft();
    renderDashboard();
  }

  function _buildJobFromDraft() {
    var draft = _readDraftFromInputs();
    var fPair  = GUILD_PAIRS[Math.min(draft.fp, GUILD_PAIRS.length - 1)];
    var d      = DIFFICULTIES[draft.diff] || DIFFICULTIES.medium;

    return {
      id: Date.now(),
      title: draft.title,
      difficulty: draft.diff,
      dread: d.dread,
      location: draft.loc,
      region: draft.region,
      reward: d.reward,
      factionGain: fPair.gain,
      factionLose: fPair.lose,
      factionGainName: fPair.gainName,
      factionLoseName: fPair.loseName,
      lore: draft.briefing,
      contact: draft.contact,
      threat: draft.threat,
      keyMarker: draft.keyMarker,
      enemy: draft.enemy,
      checkpoints: parseMissionCheckpointInput(draft.checkpoints),
      gmNotes: draft.gmNotes,
      gmCreated: true,
      missionType: draft.missionType || 'job',
      templateId: draft.templateId || ('gm.' + String(draft.presetId || draft.title || uid('mission')).replace(/[^\w.-]+/g, '_').toLowerCase()),
      templateLabel: draft.templateLabel || draft.title,
      sourcePackId: draft.packId || '',
      sourcePresetId: draft.presetId || '',
      unresolvedHooks: summarizeHooks(draft.hooks)
    };
  }

  function _readDraftFromInputs() {
    var inp = document.getElementById('gmdMissionTitle');
    var locInp = document.getElementById('gmdMissionLoc');
    var fpSel = document.getElementById('gmdFactionPair');
    var briefingInp = document.getElementById('gmdMissionBriefing');
    var contactInp = document.getElementById('gmdMissionContact');
    var threatInp = document.getElementById('gmdMissionThreat');
    var markerInp = document.getElementById('gmdMissionMarker');
    var enemyInp = document.getElementById('gmdMissionEnemy');
    var checkpointsInp = document.getElementById('gmdMissionCheckpoints');
    var notesInp = document.getElementById('gmdMissionNotes');
    var hooksInp = document.getElementById('gmdMissionHooks');
    var missionTypeInp = document.getElementById('gmdMissionType');
    var templateLabelInp = document.getElementById('gmdTemplateLabel');

    var draft = ensureDraft();
    draft.title = (inp  ? inp.value.trim()  : null) || draft.title || (pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS));
    draft.loc = (locInp ? locInp.value.trim() : null) || draft.loc || pick(MISSION_LOCS);
    draft.diff = draft.diff || 'medium';
    draft.region = draft.region || 'province';
    draft.fp = fpSel ? parseInt(fpSel.value, 10) : (draft.fp || 0);
    draft.briefing = (briefingInp ? briefingInp.value.trim() : null) || String(draft.briefing || '').trim();
    draft.contact = (contactInp ? contactInp.value.trim() : null) || String(draft.contact || '').trim();
    draft.threat = (threatInp ? threatInp.value.trim() : null) || String(draft.threat || '').trim();
    draft.keyMarker = (markerInp ? markerInp.value.trim() : null) || String(draft.keyMarker || '').trim();
    draft.enemy = (enemyInp ? enemyInp.value.trim() : null) || String(draft.enemy || '').trim();
    draft.checkpoints = checkpointsInp ? checkpointsInp.value : String(draft.checkpoints || '');
    draft.gmNotes = (notesInp ? notesInp.value.trim() : null) || String(draft.gmNotes || '').trim();
    draft.hooks = hooksInp ? hooksInp.value : String(draft.hooks || '');
    draft.missionType = (missionTypeInp ? missionTypeInp.value.trim() : null) || String(draft.missionType || 'job');
    draft.templateLabel = (templateLabelInp ? templateLabelInp.value.trim() : null) || String(draft.templateLabel || draft.title || '');
    if (!draft.templateId) {
      draft.templateId = 'gm.' + String(draft.presetId || draft.templateLabel || draft.title || uid('mission')).replace(/[^\w.-]+/g, '_').toLowerCase();
    }
    return normalizeMissionDraft(draft);
  }

  function recordMissionDeployment(job, mode) {
    if (!job || typeof job !== 'object') return;
    var verb = mode === 'active' ? 'activated' : 'posted';
    addChronicleEntry({
      kind: 'mission',
      title: job.title || 'GM Forge Mission',
      text: 'GM ' + verb + ' "' + String(job.title || 'Mission') + '" in ' + String(job.location || job.region || 'the field') + '.'
        + (job.contact ? ' Contact: ' + String(job.contact) + '.' : '')
        + (job.threat ? ' Threat: ' + String(job.threat) + '.' : ''),
      missionId: job.id,
      templateId: job.templateId,
      missionType: job.missionType || 'job'
    });
    var hooks = Array.isArray(job.unresolvedHooks) ? job.unresolvedHooks.slice(0, 6) : summarizeHooks(job.unresolvedHooks || '');
    hooks.forEach(function (hook) {
      addHookEntry({
        text: hook,
        source: job.title || 'GM Forge Mission',
        missionId: job.id,
        templateId: job.templateId
      });
    });
  }

  function deployToBoard() {
    var s = getS();
    if (!s) { if (typeof showNotif === 'function') showNotif('No character loaded.', 'bad'); return; }
    s.availableJobs = s.availableJobs || [];
    var job = _buildJobFromDraft();
    s.availableJobs.push(job);
    recordMissionDeployment(job, 'board');
    if (typeof saveState === 'function') saveState();
    if (typeof renderMissionBoard === 'function') renderMissionBoard();
    if (typeof showNotif === 'function') showNotif('Mission posted to board: ' + job.title, 'good');
    _missionDraft = buildDefaultMissionDraft();
    switchTab('creator');
  }

  function deployToActive() {
    var s = getS();
    if (!s) { if (typeof showNotif === 'function') showNotif('No character loaded.', 'bad'); return; }
    if (typeof window.missionsSystem !== 'undefined' && typeof window.missionsSystem.acceptJobById === 'function') {
      var job = _buildJobFromDraft();
      s.availableJobs = s.availableJobs || [];
      s.availableJobs.push(job);
      recordMissionDeployment(job, 'active');
      window.missionsSystem.acceptJobById(job.id);
    } else {
      // Fallback: push a minimal mission object directly
      var s2 = getS();
      s2.activeMissions = s2.activeMissions || [];
      var job2 = _buildJobFromDraft();
      var diff2 = DIFFICULTIES[job2.difficulty] || DIFFICULTIES.medium;
      var mission = {
        id: job2.id,
        title: job2.title,
        difficulty: job2.difficulty,
        dread: job2.dread,
        location: job2.location,
        region: job2.region,
        reward: job2.reward,
        factionGain: job2.factionGain,
        factionLose: job2.factionLose,
        factionGainName: job2.factionGainName,
        factionLoseName: job2.factionLoseName,
        lore: job2.lore || '',
        contact: job2.contact || '',
        threat: job2.threat || '',
        keyMarker: job2.keyMarker || '',
        enemy: job2.enemy || '',
        checkpoints: Array.isArray(job2.checkpoints) ? job2.checkpoints.slice() : [],
        gmNotes: job2.gmNotes || '',
        missionType: job2.missionType || 'job',
        templateId: job2.templateId || '',
        templateLabel: job2.templateLabel || '',
        unresolvedHooks: Array.isArray(job2.unresolvedHooks) ? job2.unresolvedHooks.slice() : [],
        loot: [],
        rooms: [],
        guards: [],
        bonus: 0,
        steps: {
          1: { name:'Gather Information', required:false, completed:false, skipped:false },
          2: { name:'Go to Site', required:true, completed:false },
          3: { name:'Confrontation', required:true, completed:false }
        },
        gmCreated: true
      };
      s2.activeMissions.push(mission);
      recordMissionDeployment(job2, 'active');
      if (typeof saveState === 'function') saveState();
      if (typeof renderMissionTracker === 'function') renderMissionTracker();
      if (typeof showNotif === 'function') showNotif('Mission activated: ' + mission.title, 'good');
    }
    _missionDraft = buildDefaultMissionDraft();
    switchTab('creator');
  }

  function addChronicleEntryFromDraft() {
    var title = String(_chronicleDraft.title || '').trim() || 'Campaign Note';
    var body = String(_chronicleDraft.body || '').trim();
    if (!body) {
      if (typeof showNotif === 'function') showNotif('Write the table outcome first.', 'bad');
      return false;
    }
    addChronicleEntry({ title: title, text: body, kind: 'note' });
    _chronicleDraft.title = '';
    _chronicleDraft.body = '';
    renderDashboard();
    if (typeof showNotif === 'function') showNotif('Chronicle updated.', 'good');
    return true;
  }

  function addHookFromDraft() {
    var hookText = String(_chronicleDraft.hook || '').trim();
    if (!hookText) {
      if (typeof showNotif === 'function') showNotif('Add a hook first.', 'bad');
      return false;
    }
    addHookEntry({ text: hookText, source: 'GM Dashboard' });
    _chronicleDraft.hook = '';
    renderDashboard();
    if (typeof showNotif === 'function') showNotif('Open hook tracked.', 'good');
    return true;
  }

  /* ── INIT ── */
  function init() {
    var panel = document.getElementById('gmDashboard');
    if (!panel) { return; }
    // Ensure closed state on load
    renderDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── PUBLIC API ── */
  window.gmDashboard = {
    open,
    close,
    toggle,
    tab: switchTab,
    // Character controls
    adjustCredits,
    setCreditsExact,
    adjustStress,
    setStressTo,
    adjustGuildRenown,
    resetGuildRenown,
    adjustFaction: adjustGuildRenown,
    resetFactions: resetGuildRenown,
    addItem,
    addItemQuick,
    removeItem,
    // Mission creator
    setTitle,
    setLoc,
    setDiff,
    setRegion,
    setFP,
    setBriefing,
    setContact,
    setThreat,
    setKeyMarker,
    setEnemy,
    setCheckpoints,
    setGMNotes,
    setHooks,
    setMissionType,
    setTemplateLabel,
    setChronicleTitle,
    setChronicleBody,
    setChronicleHook,
    randomTitle,
    randomLoc,
    randomAll,
    seedRiftPatrol,
    applyPreset,
    loadSavedPreset,
    saveCurrentPreset,
    overwriteSavedPreset,
    deleteSavedPreset,
    resetDraft,
    deployToBoard,
    deployToActive,
    addChronicleEntry: addChronicleEntryFromDraft,
    addHook: addHookFromDraft,
    resolveHook: resolveHookEntry
  };

})();
