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

  /* ── STATE ── */
  var _activeTab = 'reference';
  var _missionDraft = {};
  var _isOpen = false;

  /* ── HELPERS ── */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function isGM() { return !!(window.settingsSystem && window.settingsSystem.isGMMode()); }
  function getS() { return (typeof S !== 'undefined') ? S : null; }

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
  <li><strong>Stats:</strong> Body, Mind, Spirit, Agility, Control, Valor, Defend, Strike, Shoot, Sneak, Lead, Notice. Each is represented by a die (d4→d6→d8→d10→d12→d20). The Valor Die (V.D.) is an additive bonus die, not an advantage mechanic.</li>
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
          <button class="gmd-tab ${_activeTab==='creator'?'active':''}" onclick="window.gmDashboard.tab('creator')">✏️ Mission Creator</button>
        </div>
        <div class="gmd-body" id="gmdBody">
          ${_activeTab === 'reference' ? renderReference() : ''}
          ${_activeTab === 'controls' ? renderControls() : ''}
          ${_activeTab === 'creator' ? renderCreator() : ''}
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
    var title  = _missionDraft.title  || (pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS));
    var diff   = _missionDraft.diff   || 'medium';
    var region = _missionDraft.region || 'province';
    var loc    = _missionDraft.loc    || pick(MISSION_LOCS);
    var fp     = _missionDraft.fp !== undefined ? _missionDraft.fp : 0;
    var fPair  = GUILD_PAIRS[Math.min(fp, GUILD_PAIRS.length - 1)];

    _missionDraft = { title, diff, region, loc, fp };

    var diffHTML = Object.keys(DIFFICULTIES).map(function(k) {
      var d = DIFFICULTIES[k];
      return `<button class="gmd-diff-btn ${diff===k?'active':''}" onclick="window.gmDashboard.setDiff('${k}')">${d.name}<br><small>d${d.dread} / ${d.reward}₵</small></button>`;
    }).join('');

    var regionHTML = ['province','sea','galaxy','wtw'].map(function(r) {
      var labels = { province:'Province', sea:'Sea', galaxy:'Galaxy', wtw:'World That Was' };
      return `<button class="gmd-region-btn ${region===r?'active':''}" onclick="window.gmDashboard.setRegion('${r}')">${labels[r]}</button>`;
    }).join('');

    var fpHTML = GUILD_PAIRS.map(function(p, i) {
      return `<option value="${i}" ${i===fp?'selected':''}>${p.gainName} gain / ${p.loseName} lose</option>`;
    }).join('');

    return `<div class="gmd-creator">

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading">📝 Mission Title</div>
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;">
          <input type="text" id="gmdMissionTitle" class="gmd-input" value="${title}" maxlength="80"
            oninput="window.gmDashboard.setTitle(this.value)">
          <button class="btn btn-xs" onclick="window.gmDashboard.randomTitle()">🎲 Randomize</button>
        </div>
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
        <div class="gmd-ctrl-heading">⚖️ Guild Conflict</div>
        <select id="gmdFactionPair" class="gmd-select" onchange="window.gmDashboard.setFP(this.value)">${fpHTML}</select>
      </div>

      <div class="gmd-ctrl-section">
        <div class="gmd-ctrl-heading gmd-preview-heading">👁️ Preview</div>
        <div class="gmd-preview">
          <div><strong>${escHtml(title)}</strong></div>
          <div style="color:var(--muted2);font-size:.8rem;">${escHtml(loc)} · ${DIFFICULTIES[diff].name} · d${DIFFICULTIES[diff].dread} Dread · ${DIFFICULTIES[diff].reward}₵</div>
          <div style="color:var(--muted2);font-size:.75rem;margin-top:.15rem;">Gain: ${fPair.gainName} · Lose: ${fPair.loseName}</div>
        </div>
      </div>

      <div class="gmd-ctrl-section" style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.2rem;">
        <button class="btn btn-sm btn-teal" onclick="window.gmDashboard.deployToBoard()">📌 Post to Mission Board</button>
        <button class="btn btn-sm" onclick="window.gmDashboard.deployToActive()">▶ Activate Immediately</button>
        <button class="btn btn-xs" style="margin-left:auto;" onclick="window.gmDashboard.randomAll()">🎲 Full Randomize</button>
      </div>

    </div>`;
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

  function setTitle(v) { _missionDraft.title = v; }
  function setLoc(v) { _missionDraft.loc = v; }
  function setDiff(k) { _missionDraft.diff = k; renderDashboard(); }
  function setRegion(r) { _missionDraft.region = r; _missionDraft.loc = _randomLoc(r); renderDashboard(); }
  function setFP(v) { _missionDraft.fp = parseInt(v, 10); }

  function randomTitle() {
    var t = pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS);
    _missionDraft.title = t;
    var inp = document.getElementById('gmdMissionTitle');
    if (inp) inp.value = t;
  }

  function randomLoc() {
    var loc = _randomLoc(_missionDraft.region || 'province');
    _missionDraft.loc = loc;
    var inp = document.getElementById('gmdMissionLoc');
    if (inp) inp.value = loc;
  }

  function _randomLoc(region) {
    if (region === 'sea')     return pick(SEA_LOCS);
    if (region === 'galaxy')  return pick(GALAXY_LOCS);
    if (region === 'wtw')     return pick(WTW_LOCS);
    return pick(MISSION_LOCS);
  }

  function randomAll() {
    _missionDraft.title  = pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS);
    _missionDraft.diff   = pick(Object.keys(DIFFICULTIES));
    _missionDraft.region = pick(['province','province','province','sea','galaxy','wtw']);
    _missionDraft.loc    = _randomLoc(_missionDraft.region);
    _missionDraft.fp     = Math.floor(Math.random() * GUILD_PAIRS.length);
    renderDashboard();
  }

  function _buildJobFromDraft() {
    var inp = document.getElementById('gmdMissionTitle');
    var locInp = document.getElementById('gmdMissionLoc');
    var fpSel = document.getElementById('gmdFactionPair');

    var title  = (inp  ? inp.value.trim()  : null) || _missionDraft.title || (pick(MISSION_VERBS) + ' ' + pick(MISSION_TARGETS));
    var loc    = (locInp ? locInp.value.trim() : null) || _missionDraft.loc || pick(MISSION_LOCS);
    var diff   = _missionDraft.diff || 'medium';
    var region = _missionDraft.region || 'province';
    var fp     = fpSel ? parseInt(fpSel.value, 10) : (_missionDraft.fp || 0);
    var fPair  = GUILD_PAIRS[Math.min(fp, GUILD_PAIRS.length - 1)];
    var d      = DIFFICULTIES[diff] || DIFFICULTIES.medium;

    return {
      id: Date.now(),
      title: title,
      difficulty: diff,
      dread: d.dread,
      location: loc,
      region: region,
      reward: d.reward,
      factionGain: fPair.gain,
      factionLose: fPair.lose,
      factionGainName: fPair.gainName,
      factionLoseName: fPair.loseName
    };
  }

  function deployToBoard() {
    var s = getS();
    if (!s) { if (typeof showNotif === 'function') showNotif('No character loaded.', 'bad'); return; }
    s.availableJobs = s.availableJobs || [];
    var job = _buildJobFromDraft();
    s.availableJobs.push(job);
    if (typeof saveState === 'function') saveState();
    if (typeof renderMissionBoard === 'function') renderMissionBoard();
    if (typeof showNotif === 'function') showNotif('Mission posted to board: ' + job.title, 'good');
    _missionDraft = {};
    switchTab('creator');
  }

  function deployToActive() {
    var s = getS();
    if (!s) { if (typeof showNotif === 'function') showNotif('No character loaded.', 'bad'); return; }
    if (typeof window.missionsSystem !== 'undefined' && typeof window.missionsSystem.acceptJobById === 'function') {
      var job = _buildJobFromDraft();
      s.availableJobs = s.availableJobs || [];
      s.availableJobs.push(job);
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
      if (typeof saveState === 'function') saveState();
      if (typeof renderMissionTracker === 'function') renderMissionTracker();
      if (typeof showNotif === 'function') showNotif('Mission activated: ' + mission.title, 'good');
    }
    _missionDraft = {};
    switchTab('creator');
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
    randomTitle,
    randomLoc,
    randomAll,
    deployToBoard,
    deployToActive
  };

})();
