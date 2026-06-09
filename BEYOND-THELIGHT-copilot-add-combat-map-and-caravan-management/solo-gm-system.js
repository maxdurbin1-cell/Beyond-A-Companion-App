// solo-gm-system.js
(function () {
  var GENRE_ARCS = [
    {
      id: 'cosmic-noir-cooking-show',
      title: 'Cosmic Noir Cooking Show',
      beats: [
        'A trench-coat squid host says your alibi tastes under-seasoned.',
        'The judges are three ghosts and a tax auditor from tomorrow.',
        'A tiny dragon insists your recipe is evidence in a cold case.'
      ],
      choices: [
        { id: 'plate', label: 'Plate your alibi with dramatic garnish', stat: 'lead', risky: false },
        { id: 'interrogate', label: 'Interrogate the dragon sous-chef', stat: 'mind', risky: true },
        { id: 'flambe', label: 'Flambe the evidence cart', stat: 'control', risky: true }
      ]
    },
    {
      id: 'mecha-romcom-heist',
      title: 'Mecha Rom-Com Heist',
      beats: [
        'Your ex arrives piloting a tiny mech shaped like a wedding cake.',
        'The vault asks for emotional honesty before it opens.',
        'A brass quartet follows your crew and keeps playing romantic battle music.'
      ],
      choices: [
        { id: 'charm', label: 'Flirt at tactical velocity', stat: 'spirit', risky: false },
        { id: 'breach', label: 'Breach the vault with improvised poetry', stat: 'valor', risky: true },
        { id: 'duel', label: 'Challenge the wedding-cake mech', stat: 'strike', risky: true }
      ]
    },
    {
      id: 'haunted-workplace-sitcom',
      title: 'Haunted Workplace Sitcom',
      beats: [
        'A spectral manager schedules your crisis between coffee break and apocalypse.',
        'Every stapler in the office is mildly cursed and very judgmental.',
        'Someone keeps saying \"synergy\" and each time a chandelier screams.'
      ],
      choices: [
        { id: 'memo', label: 'Write a memo that banishes at least one ghost', stat: 'mind', risky: false },
        { id: 'hr', label: 'File an HR complaint against the chandelier', stat: 'lead', risky: true },
        { id: 'wrestle', label: 'Wrestle the cursed copier', stat: 'body', risky: true }
      ]
    }
  ];

  var OBJECTIVE_POOL = [
    {
      id: 'select-wilderness',
      title: 'Vow: Scout the untamed frontier before the trail goes cold',
      hint: 'Travel into the Province wilderness and read the land for signs, omens, or pursuit.',
      tab: 'map'
    },
    {
      id: 'trade-encounter',
      title: 'Debt: Settle a road-debt on the trade route before interest turns violent',
      hint: 'Work the Province trade lanes and face the next encounter tied to what you owe.',
      tab: 'map'
    },
    {
      id: 'open-combat-tab',
      title: 'Deadline: Ready yourself for the next clash before the enemy strikes first',
      hint: 'Review the combat state, plan your order, and prepare for violence before it finds you.',
      tab: 'combat'
    },
    {
      id: 'open-library-hex',
      title: 'Mystery: Reach the Infinite Library and pull one answer from the stacks',
      hint: 'Find the Library in the Province and enter it to chase the lead haunting your current arc.',
      tab: 'map'
    },
    {
      id: 'visit-faction-tab',
      title: 'Leverage: Court a faction and learn which alliance could save or ruin you',
      hint: 'Step into faction politics and pull one usable rumor, threat, or promise from the power web.',
      tab: 'factions'
    },
    {
      id: 'visit-galaxy-tab',
      title: 'Destination: Fix your course by finding the next star that can change your fate',
      hint: 'Open the Galaxy, identify your next horizon, and decide where the road pulls you next.',
      tab: 'galaxy'
    }
  ];

  var SOLO_ORACLE_YES_NO = [
    { roll: 1, result: 'No, and...', detail: 'The answer is no, and the situation worsens immediately.' },
    { roll: 2, result: 'No', detail: 'The answer is no.' },
    { roll: 3, result: 'No, but...', detail: 'The answer is no, but a sliver of leverage remains.' },
    { roll: 4, result: 'Yes, but...', detail: 'The answer is yes, but the price becomes visible.' },
    { roll: 5, result: 'Yes', detail: 'The answer is yes.' },
    { roll: 6, result: 'Yes, and...', detail: 'The answer is yes, and momentum swings in your favor.' }
  ];

  var SOLO_ORACLE_TWISTS = [
    'An ally arrives with divided loyalties.',
    'The threat moves sooner than expected.',
    'The cost doubles, but so does the reward.',
    'A witness saw more than they admitted.',
    'The route is real, but watched.',
    'What looked like a trap is actually a plea for help.'
  ];

  var SOLO_ORACLE_PRESSURE = [
    'Advance the local danger clock. Someone hostile acts next.',
    'Your deadline shortens. Resolve this before the next travel beat.',
    'Supplies thin out. Treat the next risk as hungrier and meaner.',
    'The world notices you. Add heat to your next social or travel scene.',
    'A rival closes distance. Expect confrontation soon.',
    'The pressure eases for a moment. You have one clean opening.'
  ];

  var SOLO_ORACLE_CONSEQUENCES = [
    'Take 1 Stress or accept a visible setback in the fiction.',
    'Lose time, credits, or position before the next scene begins.',
    'Someone remembers what you did. Mark a relationship as strained.',
    'You gain what you wanted, but a different route closes behind you.',
    'A faction, rival, or witness gains leverage over you.',
    'You escape the worst of it, but the world changes somewhere else.'
  ];

  var SOLO_ORACLE_PROMPT_VERBS = ['Protect', 'Reveal', 'Endure', 'Track', 'Broker', 'Escape'];
  var SOLO_ORACLE_PROMPT_SUBJECTS = ['a vow', 'a debt', 'a witness', 'a route', 'a relic', 'a rival'];

  function rollDie(max) {
    if (typeof roll === 'function') return roll(max);
    return 1 + Math.floor(Math.random() * max);
  }

  function statDie(stat) {
    if (typeof getEffectiveDie === 'function') return Math.max(4, Number(getEffectiveDie(stat) || 4));
    if (typeof getStat === 'function') return Math.max(4, Number(getStat(stat) || 4));
    return 6;
  }

  function pick(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)] || arr[0];
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isTabActive(tabId) {
    var el = document.getElementById('tab-' + String(tabId || ''));
    return !!(el && el.classList && el.classList.contains('active'));
  }

  function ensureSoloGMState() {
    if (typeof S === 'undefined' || !S) return null;
    if (!S.soloGM || typeof S.soloGM !== 'object') {
      S.soloGM = {
        active: false,
        arcId: GENRE_ARCS[0].id,
        beatIndex: 0,
        interactions: 0,
        sinceRoll: 0,
        weirdness: 1,
        rumor: 0,
        heat: 0,
        currentObjectiveId: '',
        objectiveCompleted: false,
        lastLine: '',
        lastResolution: '',
        oracle: {
          lastQuestion: '',
          lastKind: '',
          lastResult: null,
          history: []
        },
        tabVisits: {},
        websiteCounters: {
          tradeRolls: 0,
          libraryDelves: 0,
          taskGenerations: 0
        }
      };
    }
    var st = S.soloGM;
    if (!st.oracle || typeof st.oracle !== 'object') {
      st.oracle = { lastQuestion: '', lastKind: '', lastResult: null, history: [] };
    }
    if (!Array.isArray(st.oracle.history)) st.oracle.history = [];
    if (!st.tabVisits || typeof st.tabVisits !== 'object') st.tabVisits = {};
    if (!st.websiteCounters || typeof st.websiteCounters !== 'object') {
      st.websiteCounters = { tradeRolls: 0, libraryDelves: 0, taskGenerations: 0 };
    }
    if (typeof st.websiteCounters.tradeRolls !== 'number') st.websiteCounters.tradeRolls = 0;
    if (typeof st.websiteCounters.libraryDelves !== 'number') st.websiteCounters.libraryDelves = 0;
    if (typeof st.websiteCounters.taskGenerations !== 'number') st.websiteCounters.taskGenerations = 0;
    if (!st.currentObjectiveId) {
      var obj = pick(OBJECTIVE_POOL);
      st.currentObjectiveId = obj ? obj.id : '';
      st.objectiveCompleted = false;
    }
    return st;
  }

  function getArcById(id) {
    var key = String(id || '');
    for (var i = 0; i < GENRE_ARCS.length; i++) {
      if (String(GENRE_ARCS[i].id) === key) return GENRE_ARCS[i];
    }
    return GENRE_ARCS[0];
  }

  function getObjectiveById(id) {
    var key = String(id || '');
    for (var i = 0; i < OBJECTIVE_POOL.length; i++) {
      if (String(OBJECTIVE_POOL[i].id) === key) return OBJECTIVE_POOL[i];
    }
    return OBJECTIVE_POOL[0];
  }

  function selectProvinceHexByType(hexType) {
    if (!Array.isArray(window.mapData) || !window.mapData.length) return false;
    var target = window.mapData.find(function (h) {
      return h && String(h.type || '').toLowerCase() === String(hexType || '').toLowerCase();
    });
    if (!target) return false;
    if (typeof window.setProvinceSelectedKey === 'function') {
      return !!window.setProvinceSelectedKey(target.col + ',' + target.row);
    }
    window.selectedHex = target;
    if (typeof window.renderHexMap === 'function') window.renderHexMap();
    if (typeof window.renderHexInfo === 'function') window.renderHexInfo(target);
    return true;
  }

  function objectiveDone(st, objectiveId) {
    var oid = String(objectiveId || '');
    if (oid === 'select-wilderness') {
      return !!(window.selectedHex && String(window.selectedHex.type || '').toLowerCase() === 'wilderness');
    }
    if (oid === 'trade-encounter') {
      return Number(st.websiteCounters.tradeRolls || 0) >= 1;
    }
    if (oid === 'open-combat-tab') {
      return !!(st.tabVisits.combat || isTabActive('combat'));
    }
    if (oid === 'open-library-hex') {
      return Number(st.websiteCounters.libraryDelves || 0) >= 1;
    }
    if (oid === 'visit-faction-tab') {
      return !!(st.tabVisits.factions || st.tabVisits.faction || isTabActive('factions'));
    }
    if (oid === 'visit-galaxy-tab') {
      return !!(st.tabVisits.galaxy || isTabActive('galaxy'));
    }
    return false;
  }

  function rotateObjective(st) {
    var available = OBJECTIVE_POOL.filter(function (o) {
      return String(o.id) !== String(st.currentObjectiveId || '');
    });
    var next = pick(available.length ? available : OBJECTIVE_POOL);
    st.currentObjectiveId = next ? next.id : '';
    st.objectiveCompleted = false;
  }

  function rotateArc(st) {
    var options = GENRE_ARCS.filter(function (arc) {
      return String(arc.id) !== String(st.arcId || '');
    });
    var next = pick(options.length ? options : GENRE_ARCS);
    st.arcId = next ? next.id : GENRE_ARCS[0].id;
    st.beatIndex = 0;
  }

  function buildSoloOraclePrompt(question) {
    var verbRoll = rollDie(6);
    var subjectRoll = rollDie(6);
    var verb = SOLO_ORACLE_PROMPT_VERBS[Math.max(0, verbRoll - 1)] || SOLO_ORACLE_PROMPT_VERBS[0];
    var subject = SOLO_ORACLE_PROMPT_SUBJECTS[Math.max(0, subjectRoll - 1)] || SOLO_ORACLE_PROMPT_SUBJECTS[0];
    return {
      label: 'Prompt',
      roll: 'd6=' + verbRoll + ', d6=' + subjectRoll,
      result: verb + ' ' + subject,
      detail: question ? ('Interpret it against: ' + question) : 'Interpret it against your current scene or goal.',
      accent: 'var(--gold2)'
    };
  }

  function buildSoloOracleYesNo(question) {
    var rollVal = rollDie(6);
    var entry = SOLO_ORACLE_YES_NO[Math.max(0, rollVal - 1)] || SOLO_ORACLE_YES_NO[0];
    return {
      label: 'Yes / No',
      roll: 'd6=' + rollVal,
      result: entry.result,
      detail: (question ? ('Question: ' + question + '. ') : '') + entry.detail,
      accent: rollVal >= 4 ? 'var(--green2)' : rollVal === 3 ? 'var(--gold2)' : 'var(--red2)'
    };
  }

  function buildSoloOracleTwist(question) {
    var rollVal = rollDie(6);
    var twist = SOLO_ORACLE_TWISTS[Math.max(0, rollVal - 1)] || SOLO_ORACLE_TWISTS[0];
    return {
      label: 'Twist',
      roll: 'd6=' + rollVal,
      result: twist,
      detail: question ? ('Apply this twist to: ' + question) : 'Apply this twist to the current lead, room, or relationship.',
      accent: 'var(--teal)'
    };
  }

  function buildSoloOraclePressure(question) {
    var rollVal = rollDie(6);
    var pressure = SOLO_ORACLE_PRESSURE[Math.max(0, rollVal - 1)] || SOLO_ORACLE_PRESSURE[0];
    return {
      label: 'Pressure',
      roll: 'd6=' + rollVal,
      result: pressure,
      detail: question ? ('Pressure focus: ' + question) : 'Let this tell you what escalates next.',
      accent: 'var(--red2)'
    };
  }

  function buildSoloOracleConsequence(question) {
    var rollVal = rollDie(6);
    var consequence = SOLO_ORACLE_CONSEQUENCES[Math.max(0, rollVal - 1)] || SOLO_ORACLE_CONSEQUENCES[0];
    return {
      label: 'Consequence',
      roll: 'd6=' + rollVal,
      result: consequence,
      detail: question ? ('Apply this after asking: ' + question) : 'Use this as the fallout for a miss, cost, or ugly success.',
      accent: 'var(--purple, #8060c0)'
    };
  }

  function buildSoloOracleResult(kind, question) {
    var key = String(kind || '').toLowerCase();
    if (key === 'yesno') return buildSoloOracleYesNo(question);
    if (key === 'twist') return buildSoloOracleTwist(question);
    if (key === 'prompt') return buildSoloOraclePrompt(question);
    if (key === 'pressure') return buildSoloOraclePressure(question);
    return buildSoloOracleConsequence(question);
  }

  function renderSoloOraclePanel() {
    var st = ensureSoloGMState();
    if (!st || typeof openModal !== 'function') return false;
    var oracle = st.oracle || {};
    var last = oracle.lastResult || null;
    var history = Array.isArray(oracle.history) ? oracle.history : [];
    var resultHtml = last
      ? '<div style="border:1px solid var(--border2);padding:.5rem .58rem;background:rgba(255,255,255,.03);margin-bottom:.4rem;">'
        + '<div style="display:flex;justify-content:space-between;gap:.35rem;align-items:flex-start;">'
        + '<strong style="color:' + escapeHtml(last.accent || 'var(--gold2)') + ';">' + escapeHtml(last.label || 'Oracle') + '</strong>'
        + '<span style="font-size:.7rem;color:var(--muted2);">' + escapeHtml(last.roll || '') + '</span>'
        + '</div>'
        + '<div style="font-size:.88rem;color:var(--text);margin:.15rem 0;">' + escapeHtml(last.result || '') + '</div>'
        + '<div style="font-size:.76rem;color:var(--text2);line-height:1.55;">' + escapeHtml(last.detail || '') + '</div>'
        + '</div>'
      : '<div style="font-size:.78rem;color:var(--muted2);margin-bottom:.4rem;">Ask a question, then draw a yes/no, twist, prompt, pressure, or consequence result.</div>';
    var historyHtml = history.length
      ? '<div style="margin-top:.32rem;border-top:1px solid var(--border2);padding-top:.32rem;">'
        + '<div style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:.18rem;">Recent Oracle Pulls</div>'
        + history.slice(0, 6).map(function (entry) {
          return '<div style="font-size:.74rem;color:var(--text2);margin-top:.14rem;line-height:1.5;">'
            + '<strong style="color:var(--gold2);">' + escapeHtml(entry.label || 'Oracle') + ':</strong> '
            + escapeHtml(entry.result || '')
            + (entry.question ? (' <span style="color:var(--muted2);">[' + escapeHtml(entry.question) + ']</span>') : '')
            + '</div>';
        }).join('')
        + '</div>'
      : '';
    var html = '<div style="font-size:.82rem;color:var(--text2);line-height:1.6;">'
      + '<div style="margin-bottom:.28rem;">Use this oracle as your default solo procedure: ask a question, reveal pressure, then take the consequence seriously.</div>'
      + '<div style="margin-bottom:.34rem;"><input id="soloOracleQuestion" class="input" value="' + escapeHtml(oracle.lastQuestion || '') + '" placeholder="Question, scene focus, or current lead..." style="width:100%;" /></div>'
      + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;margin-bottom:.34rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="soloGMRunOracle(\'yesno\')">Yes / No</button>'
      + '<button class="btn btn-xs" onclick="soloGMRunOracle(\'twist\')">Twist</button>'
      + '<button class="btn btn-xs btn-primary" onclick="soloGMRunOracle(\'prompt\')">Prompt</button>'
      + '<button class="btn btn-xs" onclick="soloGMRunOracle(\'pressure\')">Pressure</button>'
      + '<button class="btn btn-xs btn-red" onclick="soloGMRunOracle(\'consequence\')">Consequence</button>'
      + '</div>'
      + resultHtml
      + historyHtml
      + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;margin-top:.35rem;">'
      + '<button class="btn btn-xs" onclick="soloGMClearOracle()">Clear Oracle</button>'
      + (window.goBackModal ? '<button class="btn btn-xs btn-primary" onclick="goBackModal()">Back</button>' : '')
      + '</div>'
      + '</div>';
    openModal('Solo Oracle', html);
    return true;
  }

  function soloGMRunOracle(kind) {
    var st = ensureSoloGMState();
    if (!st) return false;
    var input = document.getElementById('soloOracleQuestion');
    var question = input && typeof input.value === 'string' ? input.value.trim() : String((st.oracle && st.oracle.lastQuestion) || '');
    var result = buildSoloOracleResult(kind, question);
    st.oracle.lastQuestion = question;
    st.oracle.lastKind = String(kind || '');
    st.oracle.lastResult = result;
    st.oracle.history = [{
      label: result.label,
      result: result.result,
      question: question,
      at: Date.now()
    }].concat(Array.isArray(st.oracle.history) ? st.oracle.history : []).slice(0, 8);
    return renderSoloOraclePanel();
  }

  function soloGMClearOracle() {
    var st = ensureSoloGMState();
    if (!st) return false;
    st.oracle.lastQuestion = '';
    st.oracle.lastKind = '';
    st.oracle.lastResult = null;
    st.oracle.history = [];
    return renderSoloOraclePanel();
  }

  function applyFailureConsequence(statKey) {
    if (typeof S === 'undefined' || !S) return;
    var prevHealth = Number(S.health || 0);
    var prevMental = Number(S.mentalStress || 0);
    if (String(statKey || '') === 'mind' || String(statKey || '') === 'spirit') {
      S.mentalStress = Math.max(0, Number(S.mentalStress || 0) + 2);
    } else {
      S.health = Math.max(0, Number(S.health || 0) - 1);
    }
    if (typeof addTMWOnFail === 'function') {
      addTMWOnFail('solo-gm-failure', {
        onConvert: function () {
          S.health = Math.max(0, prevHealth);
          S.mentalStress = Math.max(0, prevMental);
          if (typeof updateHealthUI === 'function') updateHealthUI();
          if (typeof updateAllStatDisplays === 'function') updateAllStatDisplays();
          if (typeof updateStressUI === 'function') updateStressUI();
          var st = ensureSoloGMState();
          if (st) {
            st.lastResolution = 'Teamwork converted the failed check into a success. Failure penalties removed.';
            openSoloGMConsole();
          }
          return true;
        }
      });
    }
  }

  function updateTabVisitCounters(st) {
    if (!st || !st.tabVisits) return;
    ['map', 'combat', 'galaxy', 'factions', 'storyline', 'missions'].forEach(function (tab) {
      if (isTabActive(tab)) st.tabVisits[tab] = true;
    });
  }

  function maybeRewardObjective(st) {
    if (!st.objectiveCompleted) return;
    S.credits = Math.max(0, Number(S.credits || 0) + 25 + (st.weirdness * 5));
    if (typeof updateCreditsUI === 'function') updateCreditsUI();
    if (typeof changeCounter === 'function') {
      try { changeCounter('renown', 1); } catch (_err) {}
    } else {
      S.renown = Math.max(0, Number(S.renown || 0) + 1);
      if (typeof updateRenown === 'function') updateRenown();
    }
    st.lastResolution = 'Objective complete. You gain credits and renown, and the timeline gets weirder.';
    rotateObjective(st);
    if (st.interactions > 0 && st.interactions % 4 === 0) rotateArc(st);
  }

  function openSoloGMConsole() {
    var st = ensureSoloGMState();
    if (!st || typeof openModal !== 'function') return false;
    st.active = true;
    updateTabVisitCounters(st);

    var arc = getArcById(st.arcId);
    var beat = arc.beats[Math.max(0, Math.min(arc.beats.length - 1, Number(st.beatIndex || 0)))] || arc.beats[0];
    var objective = getObjectiveById(st.currentObjectiveId);
    st.objectiveCompleted = objectiveDone(st, objective.id);

    var choiceHtml = arc.choices.map(function (c) {
      return '<button class="btn btn-sm ' + (c.risky ? 'btn-warn' : 'btn-primary') + '" onclick="soloGMChoose(\'' + c.id + '\')">' + c.label + '</button>';
    }).join('');

    var objectiveStatus = st.objectiveCompleted
      ? '<span style="color:var(--green2);">Complete</span>'
      : '<span style="color:var(--gold2);">In Progress</span>';

    var html = '<div style="font-size:.82rem;color:var(--text2);line-height:1.58;">'
      + '<div style="font-size:.9rem;color:var(--gold2);margin-bottom:.12rem;"><strong>Solo-GM: Weird Mode · ' + arc.title + '</strong></div>'
      + '<div style="margin-bottom:.14rem;">' + beat + '</div>'
      + '<div style="font-size:.69rem;color:var(--muted2);margin-bottom:.14rem;">Loop: Narrate -> Choose -> Roll every 2-3 beats -> Resolve -> Solo goal -> World update</div>'
      + '<div style="padding:.32rem .42rem;border:1px solid var(--border2);background:rgba(255,255,255,.03);margin-bottom:.12rem;">'
      + '<div style="font-size:.72rem;color:var(--teal);"><strong>Current Solo Goal:</strong> ' + objective.title + ' (' + objectiveStatus + ')</div>'
      + '<div style="font-size:.69rem;color:var(--muted2);margin-top:.08rem;">' + objective.hint + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;margin-bottom:.14rem;">'
      + '<button class="btn btn-xs btn-teal" onclick="soloGMNudgeObjective()">Point Me There</button>'
      + '<button class="btn btn-xs" onclick="soloGMCheckObjective()">Check Objective</button>'
      + '<button class="btn btn-xs btn-primary" onclick="openSoloOraclePanel()">Open Oracle</button>'
      + '</div>'
      + '<div style="margin-bottom:.14rem;display:flex;gap:.24rem;flex-wrap:wrap;">' + choiceHtml + '</div>'
      + '<div style="margin-bottom:.12rem;">'
      + '<input id="soloGMInput" class="input" placeholder="Say your ridiculous in-character line..." style="width:100%;" />'
      + '</div>'
      + '<div style="display:flex;gap:.24rem;flex-wrap:wrap;">'
      + '<button class="btn btn-sm" onclick="soloGMSpeak()">Speak</button>'
      + '<button class="btn btn-sm btn-primary" onclick="soloGMAdvanceArc()">Advance Arc</button>'
      + '</div>'
      + (st.lastResolution ? '<div style="margin-top:.14rem;font-size:.68rem;color:var(--teal);">Last: ' + st.lastResolution + '</div>' : '')
      + '<div style="margin-top:.08rem;font-size:.66rem;color:var(--muted2);">Weirdness: ' + Number(st.weirdness || 0) + ' · Heat: ' + Number(st.heat || 0) + ' · Rumor: ' + Number(st.rumor || 0) + '</div>'
      + '</div>';

    openModal('Solo-GM Console', html);
    return true;
  }

  function chooseById(arc, id) {
    var opts = arc && arc.choices ? arc.choices : [];
    for (var i = 0; i < opts.length; i++) {
      if (String(opts[i].id) === String(id)) return opts[i];
    }
    return opts[0] || null;
  }

  function soloGMChoose(choiceId) {
    var st = ensureSoloGMState();
    if (!st) return false;

    var arc = getArcById(st.arcId);
    var choice = chooseById(arc, choiceId);
    if (!choice) return false;

    var risky = !!choice.risky;
    if (!risky && st.sinceRoll >= 2) risky = true;

    var success = true;
    var detail = 'Narrative beat advanced.';
    if (risky) {
      var aDie = statDie(choice.stat || 'valor');
      var dd = 6 + Math.min(8, Math.floor(Number(st.weirdness || 1) / 2));
      var a = rollDie(aDie);
      var d = rollDie(dd);
      success = a >= d;
      detail = String(choice.stat || 'valor').toUpperCase() + ' d' + aDie + '=' + a + ' vs DD' + dd + '=' + d;
      st.sinceRoll = 0;
      if (!success) applyFailureConsequence(choice.stat);
    } else {
      st.sinceRoll += 1;
    }

    st.interactions += 1;
    st.beatIndex = (Number(st.beatIndex || 0) + 1) % arc.beats.length;

    if (success) {
      st.rumor = Math.max(0, Number(st.rumor || 0) + 1);
      st.weirdness = Math.max(1, Number(st.weirdness || 1) + 1);
      st.lastResolution = 'Success: ' + detail;
    } else {
      st.heat = Math.max(0, Number(st.heat || 0) + 1);
      st.lastResolution = 'Failure: ' + detail + '. Consequence applied.';
    }

    if (st.interactions > 0 && st.interactions % 5 === 0) {
      st.lastResolution += ' Scene tone mutates into a new genre arc.';
      rotateArc(st);
    }

    return openSoloGMConsole();
  }

  function soloGMSpeak() {
    var st = ensureSoloGMState();
    if (!st) return false;
    var input = document.getElementById('soloGMInput');
    var line = input && typeof input.value === 'string' ? input.value.trim() : '';
    if (!line) {
      st.lastResolution = 'No line delivered. The audience boos politely.';
      return openSoloGMConsole();
    }
    st.lastLine = line;
    st.rumor = Math.max(0, Number(st.rumor || 0) + 1);
    st.lastResolution = 'You declare: "' + line + '". The world immediately makes this everyone\'s problem.';
    return openSoloGMConsole();
  }

  function soloGMAdvanceArc() {
    var st = ensureSoloGMState();
    if (!st) return false;
    rotateArc(st);
    st.lastResolution = 'Arc advanced. Genre collision now at unsafe levels.';
    return openSoloGMConsole();
  }

  function soloGMCheckObjective() {
    var st = ensureSoloGMState();
    if (!st) return false;
    updateTabVisitCounters(st);
    st.objectiveCompleted = objectiveDone(st, st.currentObjectiveId);
    if (st.objectiveCompleted) {
      maybeRewardObjective(st);
    } else {
      st.lastResolution = 'Objective still in progress. Keep using the site as your play table.';
    }
    return openSoloGMConsole();
  }

  function soloGMNudgeObjective() {
    var st = ensureSoloGMState();
    if (!st) return false;
    var objective = getObjectiveById(st.currentObjectiveId);
    var oid = String(objective.id || '');

    if (oid === 'select-wilderness') {
      if (typeof switchTab === 'function') switchTab('map', null);
      if (!selectProvinceHexByType('wilderness')) {
        if (typeof window.generateMap === 'function') window.generateMap();
        selectProvinceHexByType('wilderness');
      }
      st.lastResolution = 'Province route highlighted. Select and explore a wilderness hex.';
      return openSoloGMConsole();
    }
    if (oid === 'trade-encounter') {
      if (typeof switchTab === 'function') switchTab('map', null);
      if (!selectProvinceHexByType('trade')) {
        if (typeof window.generateMap === 'function') window.generateMap();
        selectProvinceHexByType('trade');
      }
      st.lastResolution = 'Trade route selected. Roll one Trade Encounter from this hex.';
      return openSoloGMConsole();
    }
    if (oid === 'open-combat-tab') {
      if (typeof switchTab === 'function') switchTab('combat', null);
      st.lastResolution = 'Combat tab opened. Menacing posture registered.';
      return openSoloGMConsole();
    }
    if (oid === 'open-library-hex') {
      if (typeof switchTab === 'function') switchTab('map', null);
      if (!selectProvinceHexByType('library')) {
        if (typeof window.generateMap === 'function') window.generateMap();
        selectProvinceHexByType('library');
      }
      st.lastResolution = 'Infinite Library hex selected. Join area to delve the stacks.';
      return openSoloGMConsole();
    }
    if (oid === 'visit-faction-tab') {
      if (typeof switchTab === 'function') switchTab('factions', null);
      st.lastResolution = 'Faction tab opened. Political nonsense acquired.';
      return openSoloGMConsole();
    }
    if (oid === 'visit-galaxy-tab') {
      if (typeof switchTab === 'function') switchTab('galaxy', null);
      st.lastResolution = 'Galaxy tab opened. Stars observed. Existential dread nominal.';
      return openSoloGMConsole();
    }

    st.lastResolution = 'Objective nudge unavailable. Proceed by instinct and chaos.';
    return openSoloGMConsole();
  }

  function patchSoloGMHooks() {
    if (typeof window === 'undefined' || window._soloGMHooksPatched) return;
    window._soloGMHooksPatched = true;

    if (typeof window.switchTab === 'function') {
      var baseSwitchTab = window.switchTab;
      window.switchTab = function () {
        var out = baseSwitchTab.apply(this, arguments);
        var st = ensureSoloGMState();
        if (st && st.tabVisits) {
          var tab = String(arguments[0] || '').toLowerCase();
          if (tab) st.tabVisits[tab] = true;
        }
        return out;
      };
    }

    if (typeof window.rollTradeRouteEncounter === 'function') {
      var baseTradeRoll = window.rollTradeRouteEncounter;
      window.rollTradeRouteEncounter = function () {
        var st = ensureSoloGMState();
        if (st && st.websiteCounters) st.websiteCounters.tradeRolls = Number(st.websiteCounters.tradeRolls || 0) + 1;
        return baseTradeRoll.apply(this, arguments);
      };
    }

    if (typeof window.openInfiniteLibrary === 'function') {
      var baseOpenLibrary = window.openInfiniteLibrary;
      window.openInfiniteLibrary = function () {
        var st = ensureSoloGMState();
        if (st && st.websiteCounters) st.websiteCounters.libraryDelves = Number(st.websiteCounters.libraryDelves || 0) + 1;
        return baseOpenLibrary.apply(this, arguments);
      };
    }

    if (typeof window.generateTask === 'function') {
      var baseGenerateTask = window.generateTask;
      window.generateTask = function () {
        var st = ensureSoloGMState();
        if (st && st.websiteCounters) st.websiteCounters.taskGenerations = Number(st.websiteCounters.taskGenerations || 0) + 1;
        return baseGenerateTask.apply(this, arguments);
      };
    }

    if (typeof window.generateTaskForHex === 'function') {
      var baseGenerateTaskForHex = window.generateTaskForHex;
      window.generateTaskForHex = function () {
        var st = ensureSoloGMState();
        if (st && st.websiteCounters) st.websiteCounters.taskGenerations = Number(st.websiteCounters.taskGenerations || 0) + 1;
        return baseGenerateTaskForHex.apply(this, arguments);
      };
    }
  }

  window.openSoloGMConsole = openSoloGMConsole;
  window.openSoloOraclePanel = renderSoloOraclePanel;
  window.soloGMRunOracle = soloGMRunOracle;
  window.soloGMClearOracle = soloGMClearOracle;
  window.soloGMChoose = soloGMChoose;
  window.soloGMSpeak = soloGMSpeak;
  window.soloGMAdvanceArc = soloGMAdvanceArc;
  window.soloGMAdvanceScene = soloGMAdvanceArc;
  window.soloGMCheckObjective = soloGMCheckObjective;
  window.soloGMNudgeObjective = soloGMNudgeObjective;

  patchSoloGMHooks();
})();
