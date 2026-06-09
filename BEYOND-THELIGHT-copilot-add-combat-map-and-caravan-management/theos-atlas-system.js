(function () {
  "use strict";

  var FACTION_COLORS = {
    MeridianSynod: "#d7a552",
    IronChoir: "#b5564d",
    TideCartel: "#4aa6a1",
    AshConclave: "#7b6ab8",
    GlassCourt: "#9da8b6",
    ThornCompact: "#6d9a57"
  };

  var DEFAULT_ATLAS_IMAGE = "https://i.redd.it/l61xqn4ojhc81.jpg";
  var FALLBACK_ATLAS_IMAGE = "./assets/maps/theos-known-realms-of-theos.jpg";
  var TRAIN_COST = 100;

  var PROVINCE_LORE = {
    dyn: {
      chronicle: "Dyn's Well was forged by succession wars, Ysari restorations, and Nominion incursions. Port Thunder and Rynefrost anchor a province where pilgrimage roads, mine corridors, and imperial nostalgia collide under Frostmourne's shadow.",
      places: ["Port Thunder", "Rocfeather Mine", "Rynefrost", "Frostmourne Mountain", "Crystal Tower"],
      fractures: ["Silverquill revelers vs civic law", "Ysari imperialists vs dynastic claimants", "Pilgrims vs mine monopolists"]
    },
    rosegrove: {
      chronicle: "Rose Grove is splendor built on compromise: Syndaario's jeweled authority, marshy bay trade, and frontier roads where imperial pageantry masks intelligence wars, class resentment, and uneasy western legions.",
      places: ["Syndaario", "Mount Thane", "Farharbor", "Port Kiraan", "Gleaning Wilds"],
      fractures: ["Triarchic court factions vs provincial houses", "Bay merchants vs inland guild tariffs", "Imperial patrols vs local smuggler routes"]
    },
    raenor: {
      chronicle: "Raenor March sits on border-memory and sacred extraction. Old Akarian tribute, canyon routes, and Planeshifter ore economics produce fragile peace where sanctity, commerce, and black-market ritual all claim legitimacy.",
      places: ["Raenor", "Planeshifter Mine", "Nymoth routes", "Dawnwood margins", "Dralen crossings"],
      fractures: ["Lorefiend councils vs extraction syndicates", "Tidestar tribute law vs imperial tax writs", "Sanctum custodians vs mercenary prospectors"]
    },
    sunsgrave: {
      chronicle: "Sunsgrave Expanse is a contested mirror between Eldaran memory and kith expansion. Glass towers, moving sanctums, and beastfolk hierarchies sustain a province where every treaty is temporary and every border mythologized.",
      places: ["Sungrave", "Veiled Sanctum", "Petrified Forest", "Ikri route", "Akarian frontier"],
      fractures: ["Achamerian courts vs imperial envoys", "Great Ape title houses vs kith enclaves", "Relic preservation vs strategic militarization"]
    },
    freyreign: {
      chronicle: "Freyreign survives by balancing maritime clans, shard-coast magistrates, and memory cults that claim the drowned towers still issue lawful decrees from beneath the tide.",
      places: ["Freyreign Harbor", "Whitecliff Bastion", "Shardwake Quays", "Mirror Inlet", "Old Tide Court"],
      fractures: ["Port guilds vs storm-levy collectors", "Tide oracles vs military chart houses", "Refugee enclaves vs hereditary dock lineages"]
    },
    lordteak: {
      chronicle: "Lord's Teak is an arboreal fortress-state where timber kings, oath militias, and ritual surveyors govern roads that double as tribute lines to older powers offshore.",
      places: ["Kord's Teak", "Banner Root Keep", "Pilgrim Switchbacks", "Needlewood Span", "Iron Resin Yards"],
      fractures: ["House timber monopolies vs commons claimants", "Road-wardens vs free caravans", "Dynastic oaths vs merit captains"]
    },
    watchcairn: {
      chronicle: "Watchcairn is a weather-forged warning province where fortress beacons, stormwatch monasteries, and signal-breaker engineers hold a frontier against both sea raids and sky anomalies.",
      places: ["Watchcairn Spire", "Black Beacon Line", "Tempest Chapel", "Salt Relay Trenches", "Lantern Causeway"],
      fractures: ["Monastic signal keepers vs paid private fleets", "Emergency rule councils vs civil charters", "Storm cult militias vs imperial auditors"]
    },
    dewt: {
      chronicle: "Dewt Crown presents itself as lawful center, but its river courts, debt syndicates, and crown-appointed envoys all rewrite law in real time depending on who controls grain and ferries.",
      places: ["Dewt Crown", "Sunwell Court", "Meridian Locks", "Crown Ferry Chain", "Old Revenue Hall"],
      fractures: ["Crown magistrates vs charter cities", "Debt houses vs peasant leagues", "Canal armies vs provincial militias"]
    },
    lynridge: {
      chronicle: "Lynridge is a forest mandate of wardens and shrine-keepers where treaties are carved into living trunks and enforcement depends on who can read the oldest bark-law.",
      places: ["Lynridge", "Canopy Tribunal", "Green Mile Posts", "Ashbark Cloister", "River Lantern Groves"],
      fractures: ["Shrine law vs crown statute", "Ranger companies vs logging concessions", "Ancestral pacts vs expansion settlers"]
    },
    wrathwatch: {
      chronicle: "Wraithwatch thrives on fear administration: cliff citadels, oathbound inquisitors, and monster-tax economies keep order by proving every threat is real and profitable.",
      places: ["Wraithwatch", "Cliff Inquest Hall", "Storm Gallows", "Greyfeather Rampart", "Solemn Watchline"],
      fractures: ["Inquisitors vs provincial nobility", "Threat-tithe brokers vs frontier farmers", "State terror doctrine vs civilian amnesty blocs"]
    },
    vosshollow: {
      chronicle: "Voss Hollow is marsh sovereignty in practice: ferry princes, eel-market assemblies, and hidden saint cults govern by route access rather than by maps drawn in capitals.",
      places: ["Voss Hollow", "Fenmarket Steps", "Deep Reed Crossings", "Blackwater Chapels", "Saltbone Ferries"],
      fractures: ["Ferry guilds vs military bridge works", "Marsh saints vs state clergy", "Smuggler compacts vs tax marshals"]
    },
    bazaarun: {
      chronicle: "Baazarun is the hinge of Cyphyyr trade: serpent courts, forge emissaries, and desert convoy confederations bargain in public while conducting succession wars in private.",
      places: ["Baazarun", "Serpent King's Arcade", "Forge Exchange", "Sunken Gate Bazaar", "Saffron Caravan Ring"],
      fractures: ["Celevari throne agents vs merchant princes", "Dwemer factors vs local artificers", "Caravan unions vs palace tariffs"]
    },
    krovan: {
      chronicle: "Krovan Vale is lush but militarized, where rain-fed estates finance expedition armies and every harvest season doubles as recruitment for foreign campaigns.",
      places: ["Krovan Vale", "Monsoon Citadel", "Vale Muster Fields", "Copper Rain Docks", "Torchvine Estates"],
      fractures: ["Estate militias vs crown legions", "Water-right councils vs export barons", "Local pacifists vs expansion generals"]
    },
    thousandpeaks: {
      chronicle: "Thousand Peaks is vertical politics: monastery fortresses, mine republics, and avalanche roads force alliance cycles where betrayal is often just delayed logistics.",
      places: ["Thousand Peaks", "Cloud Tribunal", "High Spur Bastions", "Echo Mines", "Pass of Broken Bells"],
      fractures: ["Peak monasteries vs mine syndicates", "Pass toll lords vs free climber clans", "Highland isolationists vs lowland treaty bloc"]
    },
    cityofbliss: {
      chronicle: "City of Bliss is equal parts paradise myth and intelligence capital: art courts, vice wards, and diplomacy theaters conceal one of the most efficient espionage networks in Theos.",
      places: ["City of Bliss", "Veil Promenade", "Joyous Court", "Pearl Knife Quarter", "South Lantern Docks"],
      fractures: ["Pleasure houses vs moral reform councils", "Diplomatic theater guilds vs spy ministries", "Outer port workers vs inner ring aristocrats"]
    }
  };

  var THEOS_CONTINENTS = [
    {
      id: "mythriel",
      name: "Mythriel",
      subtitle: "Broken west of empires",
      provinces: ["dyn", "rosegrove", "raenor", "sunsgrave"]
    },
    {
      id: "ioniir",
      name: "Ioniir",
      subtitle: "Shards and drowned towers",
      provinces: ["freyreign", "lordteak", "watchcairn"]
    },
    {
      id: "nominion",
      name: "Nominion",
      subtitle: "Crownlands under strain",
      provinces: ["dewt", "lynridge", "wrathwatch", "vosshollow"]
    },
    {
      id: "cyphyyr",
      name: "Cyphyyr",
      subtitle: "Storm choked southlands",
      provinces: ["bazaarun", "krovan", "thousandpeaks", "cityofbliss"]
    }
  ];

  var THEOS_GUIDE_ENTRIES = [
    {
      title: "Atlas Loop",
      summary: "Hover nodes to identify provinces. Click a node to open its region card. Enter only when your party is ready for that threat tier."
    },
    {
      title: "Raid Endgame Routing",
      summary: "Use the region card to check routes and travel rules before committing. Rail travel requires neighboring links, and cross-continent runs use Last Sea."
    },
    {
      title: "Roll Primer",
      summary: "Scene rolls represent pressure. Threat, fracture lines, and dominant factions telegraph what checks and consequences are likely in that region."
    },
    {
      title: "Scene Intent",
      summary: "Each province highlights what to do there: power struggles, quest hooks, and dungeon themes. Use this to frame objectives before entering."
    }
  ];

  // x/y are % of atlas image (width/height). Calibrated to city-text anchors on the
  // "Known Realms of Theos" cartography image (Fida Wildheart, c.2578 P.A.).
  var THEOS_PROVINCES = [
    { id: "dyn",          name: "Dyn's Well",        continent: "mythriel",  x: 16.0, y: 18.5, threat: 2, climateBand: "cold"      },
    { id: "rosegrove",    name: "Rosegrove Reach",   continent: "mythriel",  x:  8.0, y: 47.0, threat: 3, climateBand: "temperate" },
    { id: "raenor",       name: "Raenor March",      continent: "mythriel",  x: 31.5, y: 70.0, threat: 4, climateBand: "highland"  },
    { id: "sunsgrave",    name: "Sunsgrave Expanse",  continent: "mythriel",  x:  9.0, y: 79.5, threat: 5, climateBand: "arid"      },
    { id: "freyreign",    name: "Freyreign",          continent: "ioniir",    x: 43.5, y: 22.0, threat: 3, climateBand: "coastal"   },
    { id: "lordteak",     name: "Kord's Teak",        continent: "ioniir",    x: 60.0, y: 13.5, threat: 4, climateBand: "temperate" },
    { id: "watchcairn",   name: "Watchcairn",         continent: "ioniir",    x: 46.0, y: 33.5, threat: 5, climateBand: "storm"     },
    { id: "dewt",         name: "Dewt Crown",         continent: "nominion",  x: 68.0, y: 42.5, threat: 3, climateBand: "temperate" },
    { id: "lynridge",     name: "Lynridge",            continent: "nominion",  x: 71.5, y: 55.0, threat: 4, climateBand: "forest"    },
    { id: "wrathwatch",   name: "Wraithwatch",         continent: "nominion",  x: 80.0, y: 20.5, threat: 5, climateBand: "storm", specialMapLink: "worldthatwas" },
    { id: "vosshollow",   name: "Voss Hollow",         continent: "nominion",  x: 83.0, y: 44.5, threat: 6, climateBand: "marsh"     },
    { id: "bazaarun",     name: "Baazarun",            continent: "cyphyyr",   x: 56.0, y: 74.0, threat: 4, climateBand: "coastal"   },
    { id: "krovan",       name: "Krovan Vale",         continent: "cyphyyr",   x: 76.0, y: 73.5, threat: 5, climateBand: "tropical"  },
    { id: "thousandpeaks",name: "Thousand Peaks",      continent: "cyphyyr",   x: 77.0, y: 85.5, threat: 6, climateBand: "highland"  },
    { id: "cityofbliss",  name: "City of Bliss",       continent: "cyphyyr",   x: 91.0, y: 88.5, threat: 7, climateBand: "coastal"   }
  ];

  // Micro offsets keep dense clusters readable while preserving map fidelity.
  // Values are expressed in atlas percentage points and intentionally small.
  var THEOS_NODE_MICRO_OFFSETS = {
    dewt: { x: -0.4, y: 0.25 },
    lynridge: { x: 0.2, y: 0.45 },
    vosshollow: { x: 0.48, y: -0.12 },
    wrathwatch: { x: 0.3, y: -0.28 },
    krovan: { x: -0.24, y: -0.2 },
    thousandpeaks: { x: 0.34, y: 0.24 },
    cityofbliss: { x: 0.22, y: 0.1 },
    rosegrove: { x: -0.14, y: -0.18 },
    sunsgrave: { x: 0.22, y: 0.2 }
  };

  var LAND_CONNECTIONS = [
    ["dyn", "rosegrove"], ["rosegrove", "raenor"], ["raenor", "sunsgrave"],
    ["dyn", "freyreign"], ["freyreign", "lordteak"], ["lordteak", "watchcairn"],
    ["watchcairn", "dewt"], ["dewt", "lynridge"], ["dewt", "wrathwatch"], ["wrathwatch", "vosshollow"],
    ["raenor", "bazaarun"], ["bazaarun", "krovan"], ["krovan", "thousandpeaks"], ["thousandpeaks", "cityofbliss"]
  ];

  var SEA_ROUTES = [
    ["rosegrove", "dewt"],
    ["sunsgrave", "bazaarun"],
    ["watchcairn", "krovan"],
    ["vosshollow", "cityofbliss"]
  ];

  var ANCIENT_GATEWAYS = [
    ["dyn", "wrathwatch"],
    ["lordteak", "thousandpeaks"],
    ["sunsgrave", "cityofbliss"]
  ];

  var START_UNLOCKED = ["rosegrove"];

  var LAYERS = {
    terrain: ["broken highlands", "obsidian marsh", "tidal steppe", "cedar lowlands", "ash dunes", "storm cliffs", "glass forest", "salt canyons"],
    climate: ["monsoon front", "iron winter", "amber dry season", "fog-choked spring", "acidic rain cycle", "clear continental flow"],
    architecture: ["cyclopean basalt keeps", "hanging rope-boroughs", "sunken observatories", "bone-white citadels", "wind carved monasteries"],
    religions: ["Cult of the Last Meridian", "Glass Pilgrimage", "Ash Witnesses", "Order of Returning Tides", "Concord of Hollow Saints"],
    factions: ["MeridianSynod", "IronChoir", "TideCartel", "AshConclave", "GlassCourt", "ThornCompact"],
    enemies: ["brine revenants", "railbound raiders", "mirror hounds", "hollowed crusaders", "storm larvae", "clockwork heretics"],
    dungeons: ["pre-fall relay vaults", "sunken temple arteries", "broken imperial rail hubs", "living basalt tombs", "storm anchor ruins"],
    resources: ["void amber", "cathedral iron", "black salt", "starflower resin", "hullwood", "echo glass"],
    cityStyles: ["canal market republic", "fortified guild city", "pilgrim necropolis", "railhead city-state", "hanging cliff borough"],
    music: ["solemn choral drums", "broken-lute laments", "low bronze horns", "glass chime dirges", "stormframe percussion"],
    weather: ["ember rain", "ash fog", "salt storms", "violet lightning", "dead calm haze"],
    scars: ["abandoned titan road", "plague trenchfields", "ghost signal corridor", "collapsed skybridge network", "burned pilgrimage route", "flooded siegeworks"],
    myths: ["the crown that ate a dynasty", "the sea that remembers names", "saints chained beneath railstone", "the city that blinks once per century"],
    tensions: ["trade monopoly collapse", "succession crisis", "pilgrimage schism", "privateer embargo", "mercenary mutiny", "resource famine"],
    settlements: ["major city", "fortress town", "river market", "pilgrim village", "frontier port", "ridge mine commune"],
    districtTraits: ["oracle quarter", "blacksmith ward", "salt bazaar", "cathedral ring", "dock labyrinth", "clocktower precinct"],
    dungeonBosses: ["the drowned adjudicator", "obsidian saint", "iron marrow giant", "mirror archivist", "bone chorister"],
    questHooks: ["escort a relic caravan", "settle a blood debt", "hunt a mythic beast", "broker a faction ceasefire", "recover a pre-fall charter", "break an embargo siege"],
    encounterTags: ["religious schism patrol", "rail ambush", "ruin scavengers", "stormfront beast pack", "tax militia checkpoint", "smuggler convoy"]
  };

  var THEOS_TO_FACTION_KEY = {
    MeridianSynod: "religious",
    IronChoir: "military",
    TideCartel: "underworld",
    AshConclave: "rebels",
    GlassCourt: "corporations",
    ThornCompact: "political"
  };

  var THEOS_MISSION_VERB_BY_TENSION = {
    "trade monopoly collapse": ["Escort", "Supply", "Smuggle", "Secure"],
    "succession crisis": ["Negotiate", "Broker", "Arbitrate", "Protect"],
    "pilgrimage schism": ["Investigate", "Mediate", "Guard", "Recover"],
    "privateer embargo": ["Intercept", "Escort", "Sabotage", "Rescue"],
    "mercenary mutiny": ["Suppress", "Track", "Infiltrate", "Stabilize"],
    "resource famine": ["Deliver", "Rebuild", "Protect", "Retrieve"]
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function hashString(text) {
    var h = 2166136261;
    var i;
    for (i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h >>> 0);
  }

  function seededPick(pool, token, count) {
    var values = [];
    var used = {};
    var i = 0;
    var limit = Math.max(1, Math.min(Number(count) || 1, pool.length));
    while (values.length < limit && i < pool.length * 3) {
      var idx = hashString(token + ":" + i) % pool.length;
      var item = pool[idx];
      if (!used[item]) {
        values.push(item);
        used[item] = true;
      }
      i += 1;
    }
    return values;
  }

  function pickOne(pool, token) {
    return seededPick(pool, token, 1)[0];
  }

  function provinceById(id) {
    return THEOS_PROVINCES.find(function (p) { return p.id === id; }) || null;
  }

  function getNodeOffsetScale(st) {
    var zoom = Number(st && st.zoom || 1);
    if (!Number.isFinite(zoom) || zoom <= 1) return 1;
    // Keep baseline fidelity at 100% zoom, then increase separation gently.
    return Math.min(1.5, 1 + ((zoom - 1) * 0.6));
  }

  function getProvinceVisualPoint(province, st) {
    if (!province) return { x: 0, y: 0 };
    var baseX = Number(province.x || 0);
    var baseY = Number(province.y || 0);
    var tweak = THEOS_NODE_MICRO_OFFSETS[String(province.id || "")] || { x: 0, y: 0 };
    var scale = getNodeOffsetScale(st);
    var x = Math.max(0, Math.min(100, baseX + (Number(tweak.x || 0) * scale)));
    var y = Math.max(0, Math.min(100, baseY + (Number(tweak.y || 0) * scale)));
    return { x: x, y: y };
  }

  function ensureState() {
    if (typeof window.S === "undefined" || !window.S) {
      window.S = {};
    }
    if (!window.S.theos || typeof window.S.theos !== "object") {
      window.S.theos = {};
    }
    var st = window.S.theos;

    if (!st.seed) st.seed = "THEOS-" + String(Date.now());
    if (!st.unlocked) st.unlocked = {};
    if (!st.discovered) st.discovered = {};
    if (!st.dnaByProvince) st.dnaByProvince = {};
    if (!st.codex) st.codex = { entries: {}, timeline: [], bestiary: {}, factions: {} };
    if (!st.contentByProvince) st.contentByProvince = {};
    if (!st.provinceSnapshots) st.provinceSnapshots = {};
    if (!Array.isArray(st.historyLog)) st.historyLog = [];
    if (typeof st.zoom !== "number") st.zoom = 1;
    if (typeof st.politicalTick !== "number") st.politicalTick = 0;
    if (!st.activeProvinceId) st.activeProvinceId = null;
    if (!st.selectedProvinceId) st.selectedProvinceId = null;
    if (!st.hoverProvinceId) st.hoverProvinceId = null;
    if (typeof st.trainOwned !== "boolean") st.trainOwned = false;
    if (typeof st.pendingSeaDestinationId !== "string") st.pendingSeaDestinationId = "";
    if (typeof st.pendingSeaOriginId !== "string") st.pendingSeaOriginId = "";
    if (typeof st.pendingSeaDestinationHexKey !== "string") st.pendingSeaDestinationHexKey = "";
    if (!st.seaVoyageState || typeof st.seaVoyageState !== "object") {
      st.seaVoyageState = { ticks: 0, prompted: false, startedAt: 0 };
    }

    START_UNLOCKED.forEach(function (id) {
      st.unlocked[id] = true;
    });

    if (!st._theosStartInitialized) {
      // New runs start in Rosegrove as the canonical opening province.
      if (!st.activeProvinceId && !Object.keys(st.discovered).length) {
        st.activeProvinceId = "rosegrove";
        st.selectedProvinceId = "rosegrove";
        st.unlocked.rosegrove = true;
        st.discovered.rosegrove = true;
      }
      st._theosStartInitialized = true;
    }

    return st;
  }

  function areLandConnected(fromId, toId) {
    return LAND_CONNECTIONS.some(function (edge) {
      return (edge[0] === fromId && edge[1] === toId) || (edge[1] === fromId && edge[0] === toId);
    });
  }

  function selectDirectionalEntryHex(targetProvinceId, fromProvinceId) {
    if (!Array.isArray(window.mapData) || !window.mapData.length || typeof window.setProvinceSelectedKey !== "function") return false;
    var target = provinceById(targetProvinceId);
    var from = provinceById(fromProvinceId);
    if (!target || !from) return false;

    var minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
    window.mapData.forEach(function (hex) {
      if (!hex) return;
      minCol = Math.min(minCol, Number(hex.col || 0));
      maxCol = Math.max(maxCol, Number(hex.col || 0));
      minRow = Math.min(minRow, Number(hex.row || 0));
      maxRow = Math.max(maxRow, Number(hex.row || 0));
    });
    if (!Number.isFinite(minCol) || !Number.isFinite(maxCol) || !Number.isFinite(minRow) || !Number.isFinite(maxRow)) return false;

    var width = Math.max(1, maxCol - minCol + 1);
    var height = Math.max(1, maxRow - minRow + 1);
    var bandX = Math.max(1, Math.floor(width * 0.25));
    var bandY = Math.max(1, Math.floor(height * 0.25));
    var dx = Number(target.x || 0) - Number(from.x || 0);
    var dy = Number(target.y || 0) - Number(from.y || 0);
    var horizontal = Math.abs(dx) >= Math.abs(dy);

    var edgeCells = window.mapData.filter(function (hex) {
      if (!hex) return false;
      if (horizontal) {
        if (dx >= 0) return Number(hex.col) <= minCol + bandX;
        return Number(hex.col) >= maxCol - bandX;
      }
      if (dy >= 0) return Number(hex.row) <= minRow + bandY;
      return Number(hex.row) >= maxRow - bandY;
    });

    var preferredTypes = ["trade", "holding", "dwelling", "wilderness", "seat"];
    var candidates = [];
    preferredTypes.forEach(function (kind) {
      edgeCells.forEach(function (hex) {
        if (hex && String(hex.type || "") === kind) candidates.push(hex);
      });
    });
    if (!candidates.length) candidates = edgeCells.length ? edgeCells.slice() : window.mapData.slice();
    if (!candidates.length) return false;

    var idx = hashString(String(targetProvinceId || "") + "|" + String(fromProvinceId || "") + "|entry") % candidates.length;
    var pick = candidates[idx];
    return !!window.setProvinceSelectedKey(String(pick.col) + "," + String(pick.row));
  }

  function suggestSeaHexForProvince(provinceId) {
    var province = provinceById(provinceId);
    if (!province || !window.S || !window.S.lastSea || !Array.isArray(window.S.lastSea.map) || !window.S.lastSea.map.length) return null;
    var seaMap = window.S.lastSea.map.filter(function (hex) { return !!hex; });
    if (!seaMap.length) return null;
    var maxCol = seaMap.reduce(function (acc, hex) { return Math.max(acc, Number(hex.col || 0)); }, 0);
    var maxRow = seaMap.reduce(function (acc, hex) { return Math.max(acc, Number(hex.row || 0)); }, 0);
    var targetCol = Math.max(0, Math.min(maxCol, Math.round((Number(province.x || 0) / 100) * maxCol)));
    var targetRow = Math.max(0, Math.min(maxRow, Math.round((Number(province.y || 0) / 100) * maxRow)));
    var candidates = seaMap.filter(function (hex) {
      return String(hex.type || "") === "sea" || String(hex.type || "") === "island";
    });
    if (!candidates.length) candidates = seaMap;
    var best = null;
    var bestScore = Number.POSITIVE_INFINITY;
    candidates.forEach(function (hex) {
      var dx = Number(hex.col || 0) - targetCol;
      var dy = Number(hex.row || 0) - targetRow;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var coastalBias = String(hex.type || "") === "island" ? 0.25 : 0;
      var score = dist + coastalBias;
      if (score < bestScore) {
        bestScore = score;
        best = hex;
      }
    });
    return best;
  }

  function openSeaVoyagePrompt(targetProvinceId) {
    var st = ensureState();
    var targetProvince = provinceById(targetProvinceId);
    if (!targetProvince) return;

    if (typeof window.generateLastSea === "function" && (!window.S || !window.S.lastSea || !Array.isArray(window.S.lastSea.map) || !window.S.lastSea.map.length)) {
      try { window.generateLastSea(); } catch (_genErr) { console.error(_genErr); }
    }

    var suggested = suggestSeaHexForProvince(targetProvinceId);
    st.seaVoyageState = st.seaVoyageState || { ticks: 0, prompted: false, startedAt: 0 };
    st.seaVoyageState.ticks = 0;
    st.seaVoyageState.prompted = false;
    st.seaVoyageState.startedAt = Date.now();
    if (suggested) {
      st.pendingSeaDestinationHexKey = String(suggested.key || "");
      if (typeof window.focusLastSeaHexByKey === "function") {
        try { window.focusLastSeaHexByKey(st.pendingSeaDestinationHexKey); } catch (_focusErr) { console.error(_focusErr); }
      }
    } else {
      st.pendingSeaDestinationHexKey = "";
    }

    if (typeof window.openModal !== "function") {
      notify("Set course through Last Sea toward " + targetProvince.name + (suggested ? (" (suggested hex " + suggested.key + ").") : "."), "info");
      return;
    }

    var suggestedText = suggested
      ? ("Suggested destination hex: <strong>" + esc(String(suggested.key || "")) + "</strong> (" + (Number(suggested.col || 0) + 1) + "," + (Number(suggested.row || 0) + 1) + ").")
      : "No suggested sea hex yet. Chart the Last Sea and select a route hex.";

    var html = ''
      + '<div style="font-size:.84rem;color:var(--text2);line-height:1.58;">'
      + 'Cross-continent travel to <strong>' + esc(targetProvince.name) + '</strong> requires a Last Sea voyage.'
      + '<div style="margin-top:.45rem;color:var(--muted2);">' + suggestedText + '</div>'
      + '<div style="margin-top:.55rem;display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">'
      + (suggested
          ? '<button class="btn btn-sm btn-teal" onclick="if(window.theosSetSeaCourseToPending)window.theosSetSeaCourseToPending();if(typeof closeModal===\'function\')closeModal();">Set Course</button>'
          : '')
      + '<button class="btn btn-sm" onclick="if(typeof closeModal===\'function\')closeModal();">Close</button>'
      + '</div>'
      + '</div>';
    window.openModal("Sea Voyage Required", html);
  }

  function setSeaCourseToPending() {
    var st = ensureState();
    var targetHexKey = String(st.pendingSeaDestinationHexKey || "");
    var targetProvince = provinceById(st.pendingSeaDestinationId);
    var targetName = targetProvince ? targetProvince.name : "target province";
    if (!targetHexKey) {
      notify("No pending sea destination to set course for.", "warn");
      return false;
    }
    if (typeof window.focusLastSeaHexByKey === "function" && window.focusLastSeaHexByKey(targetHexKey)) {
      st.seaVoyageState = st.seaVoyageState || { ticks: 0, prompted: false, startedAt: 0 };
      st.seaVoyageState.ticks = 0;
      st.seaVoyageState.prompted = false;
      st.seaVoyageState.startedAt = Date.now();
      notify("Course set to sea hex " + targetHexKey + ". Reach landfall, then continue to " + targetName + ".", "good");
      return true;
    }
    notify("Could not set course on Last Sea map yet. Chart the sea first.", "warn");
    return false;
  }

  function beginSeaVoyage(targetProvinceId) {
    var st = ensureState();
    var targetProvince = provinceById(targetProvinceId);
    if (!targetProvince) return false;
    st.pendingSeaDestinationId = String(targetProvince.id || "");
    st.pendingSeaOriginId = String(st.activeProvinceId || "");
    switchToTab("lastsea");
    openSeaVoyagePrompt(targetProvince.id);
    notify("Set sail through the Last Sea toward " + targetProvince.name + ".", "info");
    return true;
  }

  function openSeaArrivalPrompt(targetProvince) {
    if (!targetProvince || typeof window.openModal !== "function") return false;
    var html = ''
      + '<div style="font-size:.84rem;color:var(--text2);line-height:1.58;">'
      + 'Your voyage lanes now align with <strong>' + esc(targetProvince.name) + '</strong>. Enter this region now, or keep sailing.'
      + '<div style="margin-top:.55rem;display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">'
      + '<button class="btn btn-sm" onclick="if(typeof closeModal===\'function\')closeModal();">Keep Sailing</button>'
      + '<button class="btn btn-sm btn-primary" onclick="if(typeof closeModal===\'function\')closeModal();if(window.theosEnterProvince)window.theosEnterProvince(\'' + esc(targetProvince.id) + '\');">Enter Region</button>'
      + '</div>'
      + '</div>';
    window.openModal('Landfall Opportunity', html);
    return true;
  }

  function maybePromptSeaArrival(currentHexKey) {
    var st = ensureState();
    if (!st.pendingSeaDestinationId) return false;
    var targetProvince = provinceById(st.pendingSeaDestinationId);
    if (!targetProvince) return false;
    st.seaVoyageState = st.seaVoyageState || { ticks: 0, prompted: false, startedAt: 0 };
    if (st.seaVoyageState.prompted) return false;

    var targetHexKey = String(st.pendingSeaDestinationHexKey || "");
    var clickedHexKey = String(currentHexKey || "");
    var reachedTargetHex = !!targetHexKey && !!clickedHexKey && targetHexKey === clickedHexKey;
    var waitedLongEnough = Number(st.seaVoyageState.ticks || 0) >= 3;
    if (!reachedTargetHex && !waitedLongEnough) return false;

    st.seaVoyageState.prompted = true;
    return openSeaArrivalPrompt(targetProvince);
  }

  function handleLastSeaTravelProgress(payload) {
    var st = ensureState();
    if (!st.pendingSeaDestinationId) return false;
    st.seaVoyageState = st.seaVoyageState || { ticks: 0, prompted: false, startedAt: 0 };
    st.seaVoyageState.ticks = Math.max(0, Number(st.seaVoyageState.ticks || 0) + 1);
    var key = payload && payload.key ? String(payload.key) : "";
    return maybePromptSeaArrival(key);
  }

  function getAtlasImageUrl() {
    if (typeof window.THEOS_ATLAS_IMAGE === "string" && window.THEOS_ATLAS_IMAGE.trim()) {
      return window.THEOS_ATLAS_IMAGE.trim();
    }
    return DEFAULT_ATLAS_IMAGE;
  }

  function getProvinceLore(provinceId) {
    var lore = PROVINCE_LORE[provinceId];
    if (lore) return lore;
    return {
      chronicle: "Regional annals are fragmentary: dynastic pacts, failed reforms, and opportunistic alliances keep this province unstable and politically rich.",
      places: ["Old roadwatch", "Harbor quarter", "Pilgrim track", "Frontier keep"],
      fractures: ["Noble blocs vs civic councils", "Merchant compacts vs militia contracts", "Temple authority vs provincial bureaucracy"]
    };
  }

  function getNeighbors(provinceId) {
    var out = [];
    LAND_CONNECTIONS.forEach(function (edge) {
      if (edge[0] === provinceId) out.push(edge[1]);
      if (edge[1] === provinceId) out.push(edge[0]);
    });
    return out;
  }

  function isUnlockable(provinceId, st) {
    if (st.unlocked[provinceId]) return false;
    var neighbors = getNeighbors(provinceId);
    return neighbors.some(function (id) { return !!st.discovered[id]; });
  }

  function buildRegionalDNA(provinceId) {
    var st = ensureState();
    if (st.dnaByProvince[provinceId]) return st.dnaByProvince[provinceId];

    var province = provinceById(provinceId);
    if (!province) return null;

    var climateBandProfiles = {
      cold: {
        climate: ["iron winter", "polar squall belt", "frost inversion cycle"],
        weather: ["whiteout blizzard", "ice-fog front", "knife-wind corridor"],
        terrain: ["frozen escarpments", "glacial trenchlands", "snowbound ridges"],
        resources: ["cathedral ice", "frost-silver veins", "winter resin"],
        scars: ["collapsed iceway causeways", "frozen siege graves", "avalanche-buried watchroads"]
      },
      highland: {
        climate: ["thin-air highland fronts", "wind-shear plateau cycle", "cold upland dry season"],
        weather: ["mountain crosswinds", "ridge snowburst", "needle rain squalls"],
        terrain: ["jagged highlands", "windplateaus", "cliff stair valleys"],
        resources: ["ridge iron", "echo quartz", "goatfire coal"],
        scars: ["broken pass roads", "collapsed ropeways", "ruined summit bastions"]
      },
      arid: {
        climate: ["amber dry season", "dust-front inversion", "saltwind cycle"],
        weather: ["sandburst gusts", "heat mirage calms", "ash-dry squalls"],
        terrain: ["ash dunes", "salt flats", "sun-split badlands"],
        resources: ["black salt", "sunstone shale", "dune amber"],
        scars: ["buried caravan roads", "evaporated canal beds", "burned oasis walls"]
      },
      coastal: {
        climate: ["tidal fog season", "coastal storm cycle", "brine-heavy monsoon front"],
        weather: ["salt storms", "cross-tide squalls", "reef lightning"],
        terrain: ["storm coast", "tide marsh", "broken sea bluffs"],
        resources: ["hullwood", "reef pearl slag", "brine amber"],
        scars: ["flooded siegeworks", "drowned quay wards", "wreck-strewn breakwaters"]
      },
      storm: {
        climate: ["permanent storm shelf", "violet lightning season", "pressure-front churn"],
        weather: ["violet lightning", "thunder gales", "hard hail fronts"],
        terrain: ["tempest cliffs", "lightning fen", "storm-cut ravines"],
        resources: ["stormglass", "charged copper", "thunder salt"],
        scars: ["shattered beacon lines", "collapsed signal towers", "charred ridge roads"]
      },
      forest: {
        climate: ["deep-canopy humidity", "moss rain season", "cool shade fronts"],
        weather: ["green mist showers", "canopy thunder", "quiet cold rain"],
        terrain: ["ancient canopy", "cedar depths", "rootbound valleys"],
        resources: ["starflower resin", "black bark oil", "living hardwood"],
        scars: ["burned pilgrimage route", "blight-cut clearings", "hollowed watch groves"]
      },
      marsh: {
        climate: ["bog-haze cycle", "marsh dew inversion", "flood pulse season"],
        weather: ["stagnant rain sheets", "reed fog", "marsh squalls"],
        terrain: ["blackwater marsh", "reed mire", "silt sink plains"],
        resources: ["bog iron", "eelglass", "fen bloom salts"],
        scars: ["sunken causeways", "collapsed ferry posts", "plague trenchfields"]
      },
      tropical: {
        climate: ["monsoon front", "steam-heavy wet season", "cyclone shoulder season"],
        weather: ["warm wall rain", "monsoon thunder", "reef heat squalls"],
        terrain: ["monsoon wilds", "sun-jungle", "rain-cut river shelves"],
        resources: ["spice resin", "bright cane fiber", "stormfruit oils"],
        scars: ["flood-torn terrace roads", "swallowed temple routes", "storm-broken rail bridges"]
      },
      temperate: {
        climate: ["clear continental flow", "fog-choked spring", "soft rain cycle"],
        weather: ["dead calm haze", "cold drizzle", "silver cloudbreak"],
        terrain: ["cedar lowlands", "river steppe", "green ridge plains"],
        resources: ["cathedral iron", "grain amber", "riverglass"],
        scars: ["abandoned titan road", "ghost signal corridor", "collapsed skybridge network"]
      }
    };
    var band = String(province.climateBand || "temperate");
    var bandProfile = climateBandProfiles[band] || climateBandProfiles.temperate;

    var token = st.seed + ":" + provinceId;
    var factions = seededPick(LAYERS.factions, token + ":factions", 3);
    var dna = {
      provinceId: provinceId,
      terrain: pickOne(bandProfile.terrain, token + ":terrain") || pickOne(LAYERS.terrain, token + ":terrain"),
      climate: pickOne(bandProfile.climate, token + ":climate") || pickOne(LAYERS.climate, token + ":climate"),
      architecture: pickOne(LAYERS.architecture, token + ":architecture"),
      religions: seededPick(LAYERS.religions, token + ":religions", 2),
      factions: factions,
      enemyTypes: seededPick(LAYERS.enemies, token + ":enemies", 3),
      dungeonThemes: seededPick(LAYERS.dungeons, token + ":dungeons", 2),
      resources: seededPick((bandProfile.resources || []).concat(LAYERS.resources), token + ":resources", 3),
      cityStyles: seededPick(LAYERS.cityStyles, token + ":cities", 2),
      musicMood: pickOne(LAYERS.music, token + ":music"),
      weather: pickOne((bandProfile.weather || []).concat(LAYERS.weather), token + ":weather"),
      scars: seededPick((bandProfile.scars || []).concat(LAYERS.scars), token + ":scars", 3),
      myths: seededPick(LAYERS.myths, token + ":myths", 2),
      tensions: seededPick(LAYERS.tensions, token + ":tensions", 2),
      namingConvention: pickOne([
        "hard consonants with apostrophes",
        "two-part names ending in -or/-eth",
        "hushed vowel chains",
        "title-first dynastic names",
        "port register numeric surnames"
      ], token + ":names"),
      historicalSummary: "A " + pickOne(["fractured frontier", "post-imperial province", "pilgrimage corridor", "siege-scarred coast"], token + ":historyA")
        + " shaped by " + pickOne(["failed dynasties", "religious civil wars", "mercantile coups", "catastrophic storms"], token + ":historyB")
        + " and now contested by rival powers."
    };

    st.dnaByProvince[provinceId] = dna;
    return dna;
  }

  function buildProvinceContentTables(provinceId) {
    var st = ensureState();
    if (st.contentByProvince[provinceId]) return st.contentByProvince[provinceId];
    var dna = buildRegionalDNA(provinceId);
    var province = provinceById(provinceId);
    if (!dna || !province) return null;

    var token = st.seed + ":tables:" + provinceId;
    var settlements = seededPick(LAYERS.settlements, token + ":settlements", 5).map(function (kind, idx) {
      return {
        id: provinceId + "-settlement-" + (idx + 1),
        kind: kind,
        districtTrait: pickOne(LAYERS.districtTraits, token + ":district:" + idx),
        economyRole: pickOne(["trade hub", "resource extraction", "religious taxation", "mercenary logistics", "artisan guild"], token + ":eco:" + idx)
      };
    });

    var dungeons = dna.dungeonThemes.map(function (theme, idx) {
      return {
        id: provinceId + "-dungeon-" + (idx + 1),
        theme: theme,
        boss: pickOne(LAYERS.dungeonBosses, token + ":boss:" + idx),
        threatDie: [8, 10, 12, 20][Math.min(3, Math.max(0, province.threat - 2 + idx))]
      };
    });

    var quests = seededPick(LAYERS.questHooks, token + ":quests", 6).map(function (hook, idx) {
      var tension = dna.tensions[idx % dna.tensions.length] || pickOne(LAYERS.tensions, token + ":qtension:" + idx);
      return {
        id: provinceId + "-quest-" + (idx + 1),
        hook: hook,
        tension: tension,
        enemyTag: pickOne(LAYERS.encounterTags, token + ":enemy:" + idx),
        rewardFocus: pickOne(["credits", "renown", "faction influence", "rare loot", "lore codex"], token + ":reward:" + idx)
      };
    });

    var table = {
      settlements: settlements,
      dungeons: dungeons,
      quests: quests,
      bestiary: dna.enemyTypes.slice(),
      travelHazards: [dna.weather].concat(dna.scars.slice(0, 2)),
      tradeRoutes: dna.resources.map(function (resource, idx) {
        return {
          good: resource,
          route: "Route " + (idx + 1) + ": " + resource + " caravans guarded by " + (dna.factions[idx % dna.factions.length] || "local houses")
        };
      })
    };

    st.contentByProvince[provinceId] = table;
    return table;
  }

  function getTheosMissionBias() {
    var st = ensureState();
    if (!st.activeProvinceId) {
      return {
        focusRegion: "",
        difficultyShift: 0,
        rewardBonus: 0,
        preferredVerbs: [],
        factionConflictOverride: null
      };
    }
    var dna = buildRegionalDNA(st.activeProvinceId);
    var province = provinceById(st.activeProvinceId);
    var primaryTension = dna && dna.tensions && dna.tensions.length ? dna.tensions[0] : "";
    var preferredVerbs = THEOS_MISSION_VERB_BY_TENSION[primaryTension] || ["Investigate", "Escort", "Recover", "Stabilize"];
    var primaryFaction = dna && dna.factions && dna.factions.length ? dna.factions[0] : "MeridianSynod";
    var gainKey = THEOS_TO_FACTION_KEY[primaryFaction] || "political";
    var loseKey = gainKey === "underworld" ? "military" : "underworld";
    return {
      focusRegion: "province",
      difficultyShift: province && province.threat >= 6 ? 1 : 0,
      rewardBonus: province ? Math.max(0, Number(province.threat || 0) * 15) : 0,
      preferredVerbs: preferredVerbs.slice(),
      factionConflictOverride: {
        gain: gainKey,
        lose: loseKey,
        gainName: primaryFaction,
        loseName: loseKey === "underworld" ? "The Underworld" : "Military Orders"
      }
    };
  }

  function getTheosFactionFlavor() {
    var st = ensureState();
    if (!st.activeProvinceId) return null;
    var dna = buildRegionalDNA(st.activeProvinceId);
    var tables = buildProvinceContentTables(st.activeProvinceId);
    return {
      provinceId: st.activeProvinceId,
      tension: dna && dna.tensions ? dna.tensions[0] : "",
      scar: dna && dna.scars ? dna.scars[0] : "",
      settlementTrait: tables && tables.settlements && tables.settlements[0] ? tables.settlements[0].districtTrait : "",
      dungeonTheme: dna && dna.dungeonThemes ? dna.dungeonThemes[0] : ""
    };
  }

  function getTheosStorylineModifier() {
    var st = ensureState();
    if (!st.activeProvinceId) return { dreadShift: 0, rollBonus: 0, tone: "neutral" };
    var province = provinceById(st.activeProvinceId);
    var dna = buildRegionalDNA(st.activeProvinceId);
    var threat = province ? Number(province.threat || 0) : 0;
    return {
      dreadShift: threat >= 6 ? 2 : threat >= 4 ? 1 : 0,
      rollBonus: threat >= 6 ? 1 : 0,
      tone: dna && dna.tensions && dna.tensions.length ? dna.tensions[0] : "regional pressure"
    };
  }

  function getProvincePower(provinceId) {
    var st = ensureState();
    var dna = buildRegionalDNA(provinceId);
    if (!dna || !dna.factions || !dna.factions.length) return "MeridianSynod";
    var idx = (hashString(st.seed + provinceId + ":power") + st.politicalTick) % dna.factions.length;
    return dna.factions[idx];
  }

  function recordCodexEntry(kind, id, payload) {
    var st = ensureState();
    var key = kind + ":" + id;
    if (!st.codex.entries[key]) {
      st.codex.entries[key] = {
        kind: kind,
        id: id,
        discoveredAt: Date.now(),
        payload: payload || {}
      };
      st.historyLog.unshift("Discovered " + kind + ": " + id);
      if (st.historyLog.length > 20) st.historyLog = st.historyLog.slice(0, 20);
      st.codex.timeline.unshift({
        when: Date.now(),
        text: "Catalogued " + id + " in Theos codex"
      });
      if (st.codex.timeline.length > 60) st.codex.timeline = st.codex.timeline.slice(0, 60);
    }
  }

  function markDiscovered(provinceId) {
    var st = ensureState();
    st.discovered[provinceId] = true;
    var p = provinceById(provinceId);
    if (!p) return;
    var dna = buildRegionalDNA(provinceId);
    recordCodexEntry("region", p.name, {
      continent: p.continent,
      threat: p.threat,
      dna: dna
    });
    if (dna && Array.isArray(dna.factions)) {
      dna.factions.forEach(function (faction) {
        if (!st.codex.factions[faction]) st.codex.factions[faction] = 0;
        st.codex.factions[faction] += 1;
      });
    }
  }

  function saveProvinceSnapshot() {
    var st = ensureState();
    if (!st.activeProvinceId) return;
    if (!Array.isArray(window.mapData) || !window.mapData.length) return;

    var key = "";
    if (typeof window.getProvinceSelectedKey === "function") {
      try {
        key = String(window.getProvinceSelectedKey() || "");
      } catch (_err) {
        key = "";
      }
    }

    st.provinceSnapshots[st.activeProvinceId] = {
      mapData: JSON.parse(JSON.stringify(window.mapData)),
      selectedKey: key
    };
  }

  function restoreProvinceSnapshot(provinceId) {
    var st = ensureState();
    var snap = st.provinceSnapshots[provinceId];
    if (!snap || !Array.isArray(snap.mapData) || !snap.mapData.length) return false;
    try {
      window.mapData = JSON.parse(JSON.stringify(snap.mapData));
      if (typeof window.setProvinceSelectedKey === "function" && snap.selectedKey) {
        window.setProvinceSelectedKey(String(snap.selectedKey));
      }
      if (typeof window.renderHexMap === "function") {
        window.renderHexMap();
      }
      return true;
    } catch (_err) {
      return false;
    }
  }

  function drawRoutes(st) {
    function drawLine(edge, className) {
      var a = provinceById(edge[0]);
      var b = provinceById(edge[1]);
      if (!a || !b) return "";
      var pa = getProvinceVisualPoint(a, st);
      var pb = getProvinceVisualPoint(b, st);
      var aKnown = !!(st.unlocked[a.id] || st.discovered[a.id]);
      var bKnown = !!(st.unlocked[b.id] || st.discovered[b.id]);
      var alpha = (aKnown && bKnown) ? 0.9 : 0.35;
      return '<line class="' + className + '" x1="' + pa.x + '%" y1="' + pa.y + '%" x2="' + pb.x + '%" y2="' + pb.y + '%" style="opacity:' + alpha + ';" />';
    }

    var html = "";
    LAND_CONNECTIONS.forEach(function (edge) { html += drawLine(edge, "theos-route-land"); });
    SEA_ROUTES.forEach(function (edge) { html += drawLine(edge, "theos-route-sea"); });
    ANCIENT_GATEWAYS.forEach(function (edge) { html += drawLine(edge, "theos-route-gate"); });
    return html;
  }

  function drawBorders(st) {
    var html = "";
    THEOS_PROVINCES.forEach(function (province) {
      var power = getProvincePower(province.id);
      var color = FACTION_COLORS[power] || "#bda57a";
      var point = getProvinceVisualPoint(province, st);
      html += '<circle class="theos-border-ring" cx="' + point.x + '%" cy="' + point.y + '%" r="2.5%" style="stroke:' + color + ';" />';
    });
    return html;
  }

  function drawNodes(st) {
    var html = "";
    THEOS_PROVINCES.forEach(function (province) {
      var point = getProvinceVisualPoint(province, st);
      var isUnlocked = !!st.unlocked[province.id];
      var isKnown = !!st.discovered[province.id];
      var unlockable = isUnlockable(province.id, st);
      var cls = "theos-node";
      if (isKnown) cls += " discovered";
      if (isUnlocked) cls += " unlocked";
      if (unlockable) cls += " unlockable";
      if (!isUnlocked && !isKnown) cls += " fogged";
      if ((st.selectedProvinceId || st.activeProvinceId) === province.id) cls += " active";
      if (st.hoverProvinceId === province.id) cls += " hovered";

      html += ''
        + '<g class="' + cls + '" data-province="' + esc(province.id) + '" tabindex="0" role="button" aria-label="' + esc(province.name) + '">'
        + '<title>' + esc(province.name) + '</title>'
        + '<circle class="theos-node-backdrop" cx="' + point.x + '%" cy="' + point.y + '%" r="2.55%" />'
        + '<circle class="theos-node-core" cx="' + point.x + '%" cy="' + point.y + '%" r="1.35%" />'
        + '<circle class="theos-node-aura" cx="' + point.x + '%" cy="' + point.y + '%" r="2.65%" />'
        + '</g>';
    });
    return html;
  }

  function summarizeProvince(provinceId) {
    var province = provinceById(provinceId);
    if (!province) return null;
    var st = ensureState();
    var dna = buildRegionalDNA(provinceId);
    var power = getProvincePower(provinceId);
    return {
      province: province,
      dna: dna,
      power: power,
      known: !!st.discovered[provinceId],
      unlocked: !!st.unlocked[provinceId]
    };
  }

  function buildProvinceDetailHtml(summary) {
    if (!summary) {
      return '<div class="theos-empty">Hover a province node to read its archive entry.</div>';
    }

    var p = summary.province;
    var d = summary.dna;
    var lore = getProvinceLore(p.id);
    var tables = buildProvinceContentTables(p.id) || { settlements: [], dungeons: [], quests: [] };
    var powerColor = FACTION_COLORS[summary.power] || "#bda57a";
    var stTrain = ensureState();
    var activeProvince = provinceById(stTrain.activeProvinceId);
    var sameProvince = !!(activeProvince && activeProvince.id === p.id);
    var crossContinent = !!(activeProvince && activeProvince.continent !== p.continent);
    var canRailHop = !!(activeProvince && !sameProvince && !crossContinent && areLandConnected(activeProvince.id, p.id));
    var credits = Math.max(0, Number(window.S && window.S.credits || 0));
    var isFreeEntryProvince = p.id === "rosegrove";
    var canBuyTrain = !stTrain.trainOwned && credits >= TRAIN_COST;
    var trainLabel = isFreeEntryProvince
      ? (stTrain.trainOwned ? "Train Ready (Rosegrove still free)" : "Rosegrove has free local access")
      : (stTrain.trainOwned ? "Train Ready" : ("Train Required (" + TRAIN_COST + " \u20B5)"));
    var routeHint = sameProvince
      ? 'Current province.'
      : (crossContinent
        ? 'Cross-continent travel requires Last Sea routing.'
        : (canRailHop ? 'Connected by rail corridor.' : 'Train movement follows neighboring land links only.'));

    var isSpecialMapRegion = String(p.specialMapLink || '').toLowerCase() === 'worldthatwas';
    var enterLabel = isSpecialMapRegion ? 'Enter Region (World That Was)' : 'Enter Region';
    var travelAction = '';
    if (!stTrain.trainOwned && !isFreeEntryProvince) {
      travelAction = '<button class="btn btn-sm ' + (canBuyTrain ? 'btn-teal' : '') + '" onclick="window.theosBuyTrain()"' + (canBuyTrain ? '' : ' disabled title="Need more credits"') + '>Purchase Train Ticket (' + TRAIN_COST + ' \u20B5)</button>';
    } else if (sameProvince) {
      travelAction = '<button class="btn btn-sm btn-primary" onclick="window.theosEnterProvince(\'' + esc(p.id) + '\')">' + enterLabel + '</button>';
    } else if (crossContinent) {
      travelAction = '<button class="btn btn-sm" onclick="if(window.theosBeginSeaVoyage)window.theosBeginSeaVoyage(\'' + esc(p.id) + '\');">Sail the Last Sea</button>';
    } else {
      travelAction = '<button class="btn btn-sm btn-primary" ' + (canRailHop ? '' : 'disabled title="Rail only reaches connected neighboring provinces"') + ' onclick="window.theosEnterProvince(\'' + esc(p.id) + '\')">' + enterLabel + '</button>';
    }

    return ''
      + '<div class="theos-region-kicker">' + esc(p.name) + ' \u00b7 Threat ' + esc(p.threat) + '</div>'
      + '<p class="theos-region-copy">' + esc(lore.chronicle) + '</p>'
      + '<div class="theos-chip-row">'
      + '<span class="theos-chip">Terrain: ' + esc(d.terrain) + '</span>'
      + '<span class="theos-chip">Climate: ' + esc(d.climate) + '</span>'
      + '<span class="theos-chip">Architecture: ' + esc(d.architecture) + '</span>'
      + '<span class="theos-chip">Rail Access: ' + esc(trainLabel) + '</span>'
      + '<span class="theos-chip">Route: ' + esc(routeHint) + '</span>'
      + '</div>'
      + '<div class="theos-kv-grid">'
      + '<div><strong>Dominant Power</strong><span style="color:' + esc(powerColor) + ';">' + esc(summary.power) + '</span></div>'
      + '<div><strong>Notable Places</strong><span>' + esc(lore.places.join(', ')) + '</span></div>'
      + '<div><strong>Fracture Lines</strong><span>' + esc(lore.fractures.join('; ')) + '</span></div>'
      + '<div><strong>Religions</strong><span>' + esc(d.religions.join(', ')) + '</span></div>'
      + '<div><strong>Historical Scars</strong><span>' + esc(d.scars.join('; ')) + '</span></div>'
      + '<div><strong>Tensions</strong><span>' + esc(d.tensions.join('; ')) + '</span></div>'
      + '<div><strong>Dungeon Themes</strong><span>' + esc(d.dungeonThemes.join(', ')) + '</span></div>'
      + '<div><strong>Resources</strong><span>' + esc(d.resources.join(', ')) + '</span></div>'
      + '<div><strong>Settlements / Dungeons / Quests</strong><span>' + esc(tables.settlements.length) + ' / ' + esc(tables.dungeons.length) + ' / ' + esc(tables.quests.length) + '</span></div>'
      + '<div><strong>Scene Goal</strong><span>Identify local pressure, pick a quest hook, and enter once your team agrees on objective and risk.</span></div>'
      + '</div>'
      + '<div class="theos-region-actions">'
      + travelAction
      + '<button class="btn btn-sm" onclick="window.theosOpenCodexGuide()">Open System Codex</button>'
      + '</div>';
  }

  function renderProvinceDetail() {
    var st = ensureState();
    var root = byId("theosProvinceDetail");
    if (!root) return;

    var targetId = st.hoverProvinceId || st.selectedProvinceId || st.activeProvinceId;
    var summary = summarizeProvince(targetId);
    if (!summary) {
      root.innerHTML = '<div class="theos-empty">Hover a province node to read its archive entry.</div>';
      return;
    }
    root.innerHTML = buildProvinceDetailHtml(summary);
  }

  function openProvinceCard(provinceId) {
    var st = ensureState();
    var id = String(provinceId || st.selectedProvinceId || st.activeProvinceId || "");
    var summary = summarizeProvince(id);
    if (!summary) return;

    if (typeof window.openModal === "function") {
      window.openModal("Province Archive", '<div class="theos-modal-detail">' + buildProvinceDetailHtml(summary) + '</div>');
      return;
    }

    notify(summary.province.name + ": " + getProvinceLore(summary.province.id).chronicle, "info");
  }

  function openCodexGuide() {
    if (typeof window.showCodexCat === "function") {
      window.showCodexCat('lore');
    }
    if (typeof window.renderCodexTheosLorePage === "function") {
      try { window.renderCodexTheosLorePage(); } catch (_err) {}
    }
    switchToTab('codex');
  }

  function renderCodexPanel() {
    var st = ensureState();
    var root = byId("theosCodexPanel");
    if (!root) return;

    var entryValues = Object.keys(st.codex.entries).map(function (k) { return st.codex.entries[k]; });
    entryValues.sort(function (a, b) { return b.discoveredAt - a.discoveredAt; });

    var timeline = (st.codex.timeline || []).slice(0, 5).map(function (t) {
      var date = new Date(t.when);
      return '<li><span>' + esc(date.toLocaleDateString()) + '</span><span>' + esc(t.text) + '</span></li>';
    }).join("");

    var factions = Object.keys(st.codex.factions || {}).sort(function (a, b) {
      return (st.codex.factions[b] || 0) - (st.codex.factions[a] || 0);
    }).slice(0, 5).map(function (name) {
      return '<li><span>' + esc(name) + '</span><span>' + esc(st.codex.factions[name]) + ' sightings</span></li>';
    }).join("");

    root.innerHTML = ''
      + '<div class="theos-codex-card">'
      + '<div class="theos-codex-title">Discovered Archives</div>'
      + '<div class="theos-codex-count">' + esc(entryValues.length) + ' entries</div>'
      + '<ul>'
      + (entryValues.slice(0, 6).map(function (entry) {
          return '<li><span>' + esc(entry.kind.toUpperCase()) + '</span><span>' + esc(entry.id) + '</span></li>';
        }).join("") || '<li><span>No records yet</span><span>Survey provinces to populate</span></li>')
      + '</ul>'
      + '</div>'
      + '<div class="theos-codex-card">'
      + '<div class="theos-codex-title">Political Record</div>'
      + '<ul>' + (factions || '<li><span>No factions recorded</span><span>Discover regions</span></li>') + '</ul>'
      + '</div>'
      + '<div class="theos-codex-card">'
      + '<div class="theos-codex-title">Recent Timeline</div>'
      + '<ul>' + (timeline || '<li><span>No timeline events</span><span>Enter a province first</span></li>') + '</ul>'
      + '</div>'
      + '<div class="theos-codex-card">'
      + '<div class="theos-codex-title">Player Codex</div>'
      + '<ul>' + THEOS_GUIDE_ENTRIES.map(function (entry) {
          return '<li><span>' + esc(entry.title) + '</span><span>' + esc(entry.summary) + '</span></li>';
        }).join('') + '</ul>'
      + '<div style="margin-top:.42rem;"><button class="btn btn-xs" onclick="window.theosOpenCodexGuide()">Open Full Codex</button></div>'
      + '</div>';
  }

  function setNodeHoverLabel(label, evt) {
    var tip = byId("theosNodeHover");
    if (!tip) return;
    tip.textContent = String(label || "");
    tip.classList.add("show");
    if (evt && Number.isFinite(evt.clientX) && Number.isFinite(evt.clientY)) {
      var tab = byId("tab-theos");
      var rect = tab ? tab.getBoundingClientRect() : null;
      if (rect) {
        tip.style.left = Math.max(8, Math.round(evt.clientX - rect.left + 14)) + "px";
        tip.style.top = Math.max(8, Math.round(evt.clientY - rect.top + 14)) + "px";
      }
    }
  }

  function clearNodeHoverLabel() {
    var tip = byId("theosNodeHover");
    if (!tip) return;
    tip.classList.remove("show");
  }

  function bindNodeEvents() {
    var st = ensureState();
    var nodes = document.querySelectorAll(".theos-node[data-province]");
    nodes.forEach(function (node) {
      var provinceId = String(node.getAttribute("data-province") || "");
      if (!provinceId) return;

      node.addEventListener("mouseenter", function (evt) {
        st.hoverProvinceId = provinceId;
        var province = provinceById(provinceId);
        setNodeHoverLabel(province ? province.name : provinceId, evt);
      });
      node.addEventListener("mousemove", function (evt) {
        var province = provinceById(provinceId);
        setNodeHoverLabel(province ? province.name : provinceId, evt);
      });
      node.addEventListener("mouseleave", function () {
        st.hoverProvinceId = null;
        clearNodeHoverLabel();
      });
      node.addEventListener("click", function () {
        window.theosSelectProvince(provinceId, false);
        if (typeof window.theosOpenProvinceCard === "function") window.theosOpenProvinceCard(provinceId);
      });
      node.addEventListener("keydown", function (evt) {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          window.theosSelectProvince(provinceId, false);
          if (typeof window.theosOpenProvinceCard === "function") window.theosOpenProvinceCard(provinceId);
        }
      });
    });
  }

  function renderAtlas() {
    var st = ensureState();
    var root = byId("tab-theos");
    if (!root) return;

    var atlasImage = getAtlasImageUrl();
    var discoveredCount = Object.keys(st.discovered).length;
    var unlockedCount = Object.keys(st.unlocked).length;
    var zoomPct = Math.round(st.zoom * 100);

    root.innerHTML = ''
      + '<div class="theos-shell">'
      + '  <div class="theos-header">'
      + '    <div>'
      + '      <div class="theos-kicker">Theos Mode</div>'
      + '      <h2 class="theos-title">World Atlas of Nested Campaigns</h2>'
      + '      <p class="theos-sub">Theos -> Province -> Hex -> Site. Every node is a full regional sandbox with persistent lore and historical scars.</p>'
      + '    </div>'
      + '    <div class="theos-header-actions">'
      + '      <button class="btn btn-sm" onclick="window.theosUnlockConnected()">Unlock Frontier</button>'
      + '      <button class="btn btn-sm btn-teal" onclick="window.theosAdvancePolitics()">Advance Politics</button>'
      + '      <button class="btn btn-sm" onclick="window.theosTravelTo(\'lastsea\')">Sail Last Sea</button>'
      + '      <button class="btn btn-sm" onclick="window.theosOpenCodexGuide()">System Codex</button>'
      + '      <button class="btn btn-sm" onclick="window.theosTravelTo(\'galaxy\')">Open Galaxy</button>'
      + '      <button class="btn btn-sm" onclick="window.theosTravelTo(\'worldthatwas\')">World That Was</button>'
      + '    </div>'
      + '  </div>'
      + '  <div class="theos-stats">'
      + '    <div><strong>Discovered</strong><span>' + esc(discoveredCount) + ' / ' + esc(THEOS_PROVINCES.length) + '</span></div>'
      + '    <div><strong>Unlocked</strong><span>' + esc(unlockedCount) + '</span></div>'
      + '    <div><strong>Political Tick</strong><span>' + esc(st.politicalTick) + '</span></div>'
      + '    <div><strong>Train</strong><span>' + (st.trainOwned ? 'Owned' : ('Not Owned (' + TRAIN_COST + ' \u20B5)')) + '</span></div>'
      + '    <div><strong>Zoom</strong><span>' + esc(zoomPct) + '%</span></div>'
      + '  </div>'
      + '  <div class="theos-layout">'
      + '    <section class="theos-atlas-card">'
      + '      <div class="theos-atlas-toolbar">'
      + '        <label for="theosZoom">Atlas Zoom</label>'
      + '        <input id="theosZoom" type="range" min="70" max="175" value="' + esc(zoomPct) + '" oninput="window.theosSetZoom(this.value)">'
      + '      </div>'
      + '      <div class="theos-atlas-viewport">'
      + '        <div id="theosAtlasStage" class="theos-atlas-stage" style="transform:scale(' + esc(st.zoom) + ');">'
      + (atlasImage
        ? '          <img src="' + esc(atlasImage) + '" data-fallback-src="' + esc(FALLBACK_ATLAS_IMAGE) + '" class="theos-atlas-image" alt="Theos world map" onerror="if(this.dataset.fallbackSrc){this.src=this.dataset.fallbackSrc;this.dataset.fallbackSrc=\'\';return;} this.style.display=\'none\'; this.parentElement.classList.add(\'no-image\');">'
        : '          <div class="theos-atlas-fallback">Attach your custom map by setting window.THEOS_ATLAS_IMAGE to a local asset path.</div>')
      + '          <svg class="theos-atlas-svg" viewBox="0 0 100 100" preserveAspectRatio="none">'
      + drawRoutes(st)
      + drawBorders(st)
      + drawNodes(st)
      + '          </svg>'
      + '        </div>'
      + '        <div id="theosNodeHover" class="theos-node-hover" aria-hidden="true"></div>'
      + '      </div>'
      + '    </section>'
      + '  </div>'
      + '  <div id="theosCodexPanel" class="theos-codex-grid"></div>'
      + '</div>';

    bindNodeEvents();
    renderCodexPanel();
  }

  function switchToTab(tabId) {
    if (typeof window.switchTab !== "function") return;
    var btn = byId("tabnav-" + tabId);
    window.switchTab(tabId, btn || null);
  }

  function notify(msg, type) {
    if (typeof window.showNotif === "function") {
      window.showNotif(msg, type || "good");
    }
  }

  function setTheosZoom(raw) {
    var st = ensureState();
    var n = Number(raw);
    if (!Number.isFinite(n)) return;
    st.zoom = Math.max(0.7, Math.min(1.75, n / 100));
    var stage = byId("theosAtlasStage");
    if (stage) stage.style.transform = "scale(" + st.zoom + ")";
    renderAtlas();
  }

  function selectProvince(provinceId, forceDiscover) {
    var st = ensureState();
    if (!provinceById(provinceId)) return;
    // Atlas exploration is free: selecting a node only updates detail focus.
    st.selectedProvinceId = provinceId;
    if (forceDiscover && !st.discovered[provinceId]) markDiscovered(provinceId);

    renderAtlas();
  }

  function applyProvinceTopography(provinceId) {
    var province = provinceById(provinceId);
    if (!province || !Array.isArray(window.mapData) || !window.mapData.length) return;
    var paletteByClimate = {
      cold:      [
        { name: "Winter-Frost Tundra", color: "#9fb5c6" },
        { name: "Snowbound Glacial Uplands", color: "#7f9bad" },
        { name: "Icewind Shelf", color: "#8ba6b8" },
        { name: "Rimebreak Pass", color: "#93afbf" }
      ],
      temperate: [
        { name: "Grove Lowlands", color: "#6f8e53" },
        { name: "Riverfarms", color: "#7ea367" },
        { name: "Oak-Steppe Verge", color: "#6f9362" },
        { name: "Meadowridge", color: "#7a9b68" }
      ],
      highland:  [
        { name: "Jagged Highlands", color: "#8f7c69" },
        { name: "Windplateaus", color: "#9a8f78" },
        { name: "Ridgefall Escarpment", color: "#8a7a6b" },
        { name: "Cloudstep Basin", color: "#988a74" }
      ],
      arid:      [
        { name: "Ash Dunes", color: "#ad8b56" },
        { name: "Salt Flats", color: "#b49a72" },
        { name: "Sun-Scoured Barrens", color: "#b08f5d" },
        { name: "Glass Sand Reach", color: "#be9f6f" }
      ],
      coastal:   [
        { name: "Storm Coast", color: "#4f7f8d" },
        { name: "Tide Marsh", color: "#5f8f95" },
        { name: "Saltcliff Shelf", color: "#5a8793" },
        { name: "Breaker Fen", color: "#678f98" }
      ],
      storm:     [
        { name: "Tempest Cliffs", color: "#5f667a" },
        { name: "Lightning Fen", color: "#646f78" },
        { name: "Thunderstep Ravine", color: "#596276" },
        { name: "Static Moor", color: "#69717c" }
      ],
      forest:    [
        { name: "Ancient Canopy", color: "#4f7b48" },
        { name: "Cedar Depths", color: "#3f6a42" },
        { name: "Rootbound Hollow", color: "#4a7346" },
        { name: "Mossdark Verge", color: "#3f6941" }
      ],
      marsh:     [
        { name: "Blackwater Marsh", color: "#556b5a" },
        { name: "Reed Mire", color: "#647a63" },
        { name: "Fen-Drowned Flats", color: "#5f725f" },
        { name: "Siltwater Bog", color: "#6b7f68" }
      ],
      tropical:  [
        { name: "Monsoon Wilds", color: "#4b865e" },
        { name: "Sun-Jungle", color: "#5f9569" },
        { name: "Rainvine Basin", color: "#4f8a61" },
        { name: "Cyclone Canopy", color: "#5d986d" }
      ]
    };
    var palette = paletteByClimate[String(province.climateBand || "")] || [{ name: province.name + " Wilds", color: "#667b5a" }];
    var directionalPalette = {
      north: [
        { name: "North-Ice Barrens", color: "#a8c0d1" },
        { name: "Frostwind Shelf", color: "#93adbf" },
        { name: "Rimefield", color: "#9db7c7" }
      ],
      south: [
        { name: "South-Burn Dunes", color: "#ba965f" },
        { name: "Suncleft Barrens", color: "#b28956" },
        { name: "Glassheat Flats", color: "#c29f72" }
      ],
      east: [
        { name: "Eastwind Drysteppe", color: "#9d8c67" },
        { name: "Saltwind Reach", color: "#a79473" },
        { name: "Ravine Shelf", color: "#8f7f62" }
      ],
      west: [
        { name: "Westgrove Verge", color: "#68885d" },
        { name: "Mossbank Lowland", color: "#5f7f57" },
        { name: "Rootwater Fold", color: "#5a7750" }
      ]
    };

    var minCol = Infinity;
    var maxCol = -Infinity;
    var minRow = Infinity;
    var maxRow = -Infinity;
    window.mapData.forEach(function (hex) {
      if (!hex) return;
      var col = Number(hex.col || 0);
      var row = Number(hex.row || 0);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    });

    var width = Math.max(1, maxCol - minCol);
    var height = Math.max(1, maxRow - minRow);
    var provinceNorthBias = Number(province.y || 50) <= 35 ? 0.45 : 0;
    var provinceSouthBias = Number(province.y || 50) >= 65 ? 0.45 : 0;
    var provinceEastBias = Number(province.x || 50) >= 65 ? 0.22 : 0;
    var provinceWestBias = Number(province.x || 50) <= 35 ? 0.22 : 0;

    var token = String(province.id || "") + ":topography";
    window.mapData.forEach(function (hex, idx) {
      if (!hex) return;
      var terrain = (hex.terrain && typeof hex.terrain === "object") ? hex.terrain : { name: "Wilderness", color: "#6a7f5e" };
      if (String(hex.type || "") === "wilderness" || String(hex.type || "") === "trade") {
        var normX = (Number(hex.col || 0) - minCol) / width;
        var normY = (Number(hex.row || 0) - minRow) / height;
        var northWeight = (1 - normY) + provinceNorthBias;
        var southWeight = normY + provinceSouthBias;
        var eastWeight = (normX * 0.85) + provinceEastBias;
        var westWeight = ((1 - normX) * 0.85) + provinceWestBias;

        var biomeKey = "north";
        var maxWeight = northWeight;
        if (southWeight > maxWeight) {
          biomeKey = "south";
          maxWeight = southWeight;
        }
        if (eastWeight > maxWeight) {
          biomeKey = "east";
          maxWeight = eastWeight;
        }
        if (westWeight > maxWeight) {
          biomeKey = "west";
          maxWeight = westWeight;
        }

        var climatePick = palette[hashString(token + ":" + idx) % palette.length];
        var dirPool = directionalPalette[biomeKey] || [];
        var dirPick = dirPool.length
          ? dirPool[hashString(token + ":" + biomeKey + ":" + idx) % dirPool.length]
          : climatePick;
        // Keep province climate identity while reinforcing world-position flavor.
        var selectedPick = maxWeight >= 1.05 ? dirPick : climatePick;

        terrain = Object.assign({}, terrain, {
          name: selectedPick.name,
          color: selectedPick.color,
          topographyTag: province.id,
          worldBand: biomeKey
        });
        hex.terrain = terrain;
      }
      if (!hex.data || typeof hex.data !== "object") hex.data = {};
      hex.data.provinceTag = province.id;
      hex.data.provinceTopography = terrain.name;
      if (terrain.worldBand) hex.data.provinceWorldBand = terrain.worldBand;
    });
  }

  function openSpecialProvinceMapIfNeeded(province) {
    if (!province) return false;
    var mapLink = String(province.specialMapLink || "").toLowerCase();
    if (!mapLink) return false;
    if (mapLink === "worldthatwas") {
      if (typeof window.openWorldThatWasFromGalaxy === "function") {
        window.openWorldThatWasFromGalaxy();
        return true;
      }
      if (typeof window.switchTab === "function") {
        var btn = byId("tabnav-worldthatwas");
        window.switchTab("worldthatwas", btn || null);
        return true;
      }
    }
    return false;
  }

  function buildProvinceFlavorPool(provinceId) {
    var lore = getProvinceLore(provinceId);
    var dna = buildRegionalDNA(provinceId) || {};
    var tables = buildProvinceContentTables(provinceId) || { settlements: [], dungeons: [], quests: [] };
    var seeded = [];

    (lore.places || []).forEach(function (item) {
      seeded.push({ kind: 'notable', label: String(item), detail: 'Notable location tied to provincial annals.' });
    });
    (lore.fractures || []).forEach(function (item) {
      seeded.push({ kind: 'fracture', label: 'Fracture Line', detail: String(item) });
    });
    (dna.scars || []).forEach(function (item) {
      seeded.push({ kind: 'scar', label: 'Historical Scar', detail: String(item) });
    });
    (dna.myths || []).forEach(function (item) {
      seeded.push({ kind: 'myth', label: 'Local Myth', detail: String(item) });
    });
    (tables.settlements || []).forEach(function (row) {
      if (!row) return;
      seeded.push({ kind: 'settlement', label: 'Settlement', detail: String(row.kind || 'Settlement') + ' · ' + String(row.districtTrait || 'district') });
    });
    (tables.dungeons || []).forEach(function (row) {
      if (!row) return;
      seeded.push({ kind: 'dungeon', label: 'Dungeon Theme', detail: String(row.theme || 'Ruin') + ' · Boss: ' + String(row.boss || 'Unknown') });
    });
    (tables.quests || []).slice(0, 6).forEach(function (row) {
      if (!row) return;
      seeded.push({ kind: 'quest', label: 'Quest Hook', detail: String(row.hook || 'Regional contract') + ' · ' + String(row.tension || '') });
    });
    if (lore.chronicle) {
      seeded.push({ kind: 'chronicle', label: 'Chronicle', detail: String(lore.chronicle) });
    }
    return seeded;
  }

  function injectProvinceFlavorSites(provinceId) {
    if (!Array.isArray(window.mapData) || !window.mapData.length) return;
    var pool = buildProvinceFlavorPool(provinceId);
    if (!pool.length) return;

    var candidates = window.mapData.filter(function (hex) {
      if (!hex) return false;
      var t = String(hex.type || '');
      return t === 'wilderness' || t === 'trade' || t === 'ruins' || t === 'monument' || t === 'lostcity';
    });
    if (!candidates.length) candidates = window.mapData.slice();
    if (!candidates.length) return;

    var used = {};
    var picks = Math.min(pool.length, Math.max(12, Math.floor(candidates.length * 0.22)));
    for (var i = 0; i < picks; i++) {
      var flavor = pool[i % pool.length];
      var idx = hashString(String(provinceId || '') + '|flavor|' + i) % candidates.length;
      var guard = 0;
      while (used[idx] && guard < candidates.length) {
        idx = (idx + 5) % candidates.length;
        guard += 1;
      }
      if (used[idx]) continue;
      used[idx] = true;
      var hex = candidates[idx];
      if (!hex.data || typeof hex.data !== 'object') hex.data = {};
      hex.data.theosFlavor = {
        kind: String(flavor.kind || 'flavor'),
        label: String(flavor.label || 'Province Flavor'),
        detail: String(flavor.detail || ''),
        provinceId: String(provinceId || '')
      };
      if ((flavor.kind === 'notable' || flavor.kind === 'settlement') && !hex.name) {
        hex.name = String(flavor.detail || flavor.label || 'Notable Site');
      }
    }
  }

  function enterProvince(provinceId) {
    var st = ensureState();
    var targetProvince = provinceById(provinceId);
    if (!targetProvince) return;
    if (!st.trainOwned && targetProvince.id !== "rosegrove") {
      notify("Province travel requires a train. Purchase one for " + TRAIN_COST + " \u20B5 in the Atlas panel.", "warn");
      return;
    }

    var fromId = st.activeProvinceId;
    var fromProvince = provinceById(fromId);
    if (fromProvince && fromProvince.id !== targetProvince.id) {
      if (fromProvince.continent !== targetProvince.continent) {
        st.pendingSeaDestinationId = targetProvince.id;
        st.pendingSeaOriginId = fromProvince.id;
        switchToTab("lastsea");
        openSeaVoyagePrompt(targetProvince.id);
        notify("Cross-continent travel requires the Sea Region map. Sail from Last Sea to reach " + targetProvince.name + ".", "info");
        return;
      }
      if (!areLandConnected(fromProvince.id, targetProvince.id)) {
        notify("Train routes follow direct neighboring province links. Move through connected provinces first.", "warn");
        return;
      }
    }

    saveProvinceSnapshot();

    st.activeProvinceId = targetProvince.id;
    st.selectedProvinceId = targetProvince.id;
    if (String(st.pendingSeaDestinationId || "") === String(targetProvince.id || "")) {
      st.pendingSeaDestinationId = "";
      st.pendingSeaOriginId = "";
      st.pendingSeaDestinationHexKey = "";
      st.seaVoyageState = { ticks: 0, prompted: false, startedAt: 0 };
    }
    window.S.realmEntryMode = 'known_realm';
    st.unlocked[targetProvince.id] = true;
    markDiscovered(targetProvince.id);

    var restored = restoreProvinceSnapshot(targetProvince.id);
    if (!restored && typeof window.generateMap === "function") {
      try {
        window.generateMap();
      } catch (_err) {
        // Keep travel flow alive even if map generation is unavailable.
      }
    }

    applyProvinceTopography(targetProvince.id);
    injectProvinceFlavorSites(targetProvince.id);
    if (typeof window.renderHexMap === "function") {
      try { window.renderHexMap(); } catch (_rhErr) { console.error(_rhErr); }
    }

    if (fromProvince && fromProvince.id !== targetProvince.id) {
      selectDirectionalEntryHex(targetProvince.id, fromProvince.id);
    }

    if (typeof window.setContext === "function") {
      var holdingBtn = document.querySelector('.ctx-btn[data-ctx="holding"]');
      window.setContext("holding", holdingBtn || null);
    }

    if (openSpecialProvinceMapIfNeeded(targetProvince)) {
      notify("Entered " + targetProvince.name + ". This Nominion region links directly to World That Was.", "good");
      return;
    }

    switchToTab("map");
    notify("Entered " + targetProvince.name + ". Train arrival placed you near the connected border corridor.", "good");
  }

  function buyTrain() {
    var st = ensureState();
    if (st.trainOwned) {
      notify("Your rail transport is already secured.", "good");
      return;
    }
    var credits = Math.max(0, Number(window.S && window.S.credits || 0));
    if (credits < TRAIN_COST) {
      notify("Insufficient credits. Need " + TRAIN_COST + " \u20B5 for a train.", "warn");
      return;
    }

    if (typeof window.changeCredits === "function") {
      window.changeCredits(-TRAIN_COST);
    } else {
      window.S.credits = Math.max(0, credits - TRAIN_COST);
      if (typeof window.updateCreditsUI === "function") {
        try { window.updateCreditsUI(); } catch (_creditErr) { console.error(_creditErr); }
      }
    }

    st.trainOwned = true;
    st.unlocked.rosegrove = true;
    renderAtlas();
    notify("Train purchased. Province routes are now traversable by rail.", "good");
  }

  function unlockConnected() {
    var st = ensureState();
    var unlockedOne = false;
    THEOS_PROVINCES.forEach(function (province) {
      if (!st.unlocked[province.id] && isUnlockable(province.id, st)) {
        st.unlocked[province.id] = true;
        unlockedOne = true;
      }
    });
    renderAtlas();
    notify(unlockedOne ? "Frontier routes stabilized. New provinces unlocked." : "No new frontier route available yet.", unlockedOne ? "good" : "warn");
  }

  function advancePolitics() {
    var st = ensureState();
    st.politicalTick += 1;
    recordCodexEntry("event", "Political Shift " + st.politicalTick, {
      tick: st.politicalTick,
      note: "Regional influence maps changed."
    });
    renderAtlas();
    notify("Borders shifted. Faction power map refreshed.", "good");
  }

  function travelTo(tabId) {
    if (String(tabId || '') === 'lastsea') {
      notify('Last Sea routes can lead beyond Mythriel to additional continental fronts and island chains.', 'info');
    }
    switchToTab(tabId);
  }

  function primeStartingProvinceIfNeeded() {
    var st = ensureState();
    if (!st || st.activeProvinceId !== 'rosegrove') return false;
    if (st.provinceSnapshots && st.provinceSnapshots.rosegrove && Array.isArray(st.provinceSnapshots.rosegrove.mapData)) return true;
    if (typeof window.generateMap !== 'function') return false;
    try {
      window.generateMap();
      applyProvinceTopography('rosegrove');
      injectProvinceFlavorSites('rosegrove');
      saveProvinceSnapshot();
      return true;
    } catch (_primeErr) {
      return false;
    }
  }

  function getActiveProvinceDNA() {
    var st = ensureState();
    if (!st.activeProvinceId) return null;
    return buildRegionalDNA(st.activeProvinceId);
  }

  function getActiveProvinceContentTables() {
    var st = ensureState();
    if (!st.activeProvinceId) return null;
    return buildProvinceContentTables(st.activeProvinceId);
  }

  function getActiveProvinceSummary() {
    var st = ensureState();
    var id = st.activeProvinceId;
    if (!id) return null;
    var province = provinceById(id);
    if (!province) return null;
    return {
      id: String(province.id || ''),
      name: String(province.name || ''),
      continent: String(province.continent || ''),
      threat: Number(province.threat || 0),
      climateBand: String(province.climateBand || ''),
      lore: getProvinceLore(id),
      dna: buildRegionalDNA(id)
    };
  }

  function getProvinceSummary(provinceId) {
    return summarizeProvince(provinceId);
  }

  function getProvinceList() {
    return THEOS_PROVINCES.map(function (province) {
      return {
        id: province.id,
        name: province.name,
        continent: province.continent,
        threat: province.threat,
        climateBand: province.climateBand,
        x: province.x,
        y: province.y,
      };
    });
  }

  function getActiveProvinceId() {
    var st = ensureState();
    return String((st && st.activeProvinceId) || "");
  }

  function patchSwitchTab() {
    if (typeof window.switchTab !== "function" || window._theosSwitchPatched) return;
    window._theosSwitchPatched = true;
    var base = window.switchTab;
    window.switchTab = function (tabId, btn) {
      var out = base.apply(this, arguments);
      if (tabId === "theos") {
        renderAtlas();
      }
      return out;
    };
  }

  function bootstrap() {
    ensureState();
    patchSwitchTab();
    primeStartingProvinceIfNeeded();
    if (byId("tab-theos")) {
      renderAtlas();
    }
  }

  window.theosSetZoom = setTheosZoom;
  window.theosSelectProvince = selectProvince;
  window.theosEnterProvince = enterProvince;
  window.theosBuyTrain = buyTrain;
  window.theosUnlockConnected = unlockConnected;
  window.theosAdvancePolitics = advancePolitics;
  window.theosTravelTo = travelTo;
  window.theosBeginSeaVoyage = beginSeaVoyage;
  window.theosSetSeaCourseToPending = setSeaCourseToPending;
  window.theosHandleLastSeaTravelProgress = handleLastSeaTravelProgress;
  window.getActiveTheosProvinceDNA = getActiveProvinceDNA;
  window.getTheosProvinceDNA = buildRegionalDNA;
  window.getTheosProvinceContentTables = buildProvinceContentTables;
  window.getActiveTheosProvinceContentTables = getActiveProvinceContentTables;
  window.getTheosMissionBias = getTheosMissionBias;
  window.getTheosFactionFlavor = getTheosFactionFlavor;
  window.getTheosStorylineModifier = getTheosStorylineModifier;
  window.getActiveTheosProvinceSummary = getActiveProvinceSummary;
  window.getActiveTheosProvinceId = getActiveProvinceId;
  window.getTheosProvinceSummary = getProvinceSummary;
  window.getTheosProvinceList = getProvinceList;
  window.theosPrimeStartingProvince = primeStartingProvinceIfNeeded;
  window.theosOpenProvinceCard = openProvinceCard;
  window.theosOpenCodexGuide = openCodexGuide;

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
