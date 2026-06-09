// shared-puzzles.js
(function () {
  function safeRoll(max) {
    if (typeof roll === "function") return roll(max);
    return Math.floor(Math.random() * max) + 1;
  }

  function safePick(list, fallback) {
    if (!Array.isArray(list) || !list.length) return fallback;
    if (typeof pick === "function") return pick(list);
    return list[Math.floor(Math.random() * list.length)];
  }

  function _pipeOpposite(dir) {
    if (dir === 'left') return 'right';
    if (dir === 'right') return 'left';
    if (dir === 'up') return 'down';
    return 'up';
  }

  function _pipeNeighborIndex(idx, dir, size) {
    var boardSize = Math.max(3, Number(size || 3));
    var row = Math.floor(idx / boardSize);
    var col = idx % boardSize;
    if (dir === 'left') col -= 1;
    else if (dir === 'right') col += 1;
    else if (dir === 'up') row -= 1;
    else if (dir === 'down') row += 1;
    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return -1;
    return row * boardSize + col;
  }

  function ensurePuzzleState() {
    if (typeof S === "undefined") return null;
    S.sharedPuzzles = S.sharedPuzzles || {
      solved: 0,
      failed: 0,
      bySource: {},
      active: null
    };
    return S.sharedPuzzles;
  }

  const CHESS_PRESETS = [
    { board: 5, piece: 'rook', rook: { r: 2, c: 2 }, pawns: [{ r: 2, c: 0 }, { r: 0, c: 0 }, { r: 0, c: 4 }, { r: 4, c: 4 }], captured: [] },
    { board: 5, piece: 'bishop', rook: { r: 2, c: 2 }, pawns: [{ r: 0, c: 0 }, { r: 4, c: 0 }, { r: 4, c: 4 }, { r: 0, c: 4 }], captured: [] },
    { board: 5, piece: 'knight', rook: { r: 2, c: 2 }, pawns: [{ r: 0, c: 1 }, { r: 1, c: 3 }, { r: 3, c: 4 }, { r: 4, c: 2 }], captured: [] },
    { board: 5, piece: 'rook', rook: { r: 1, c: 1 }, pawns: [{ r: 1, c: 4 }, { r: 3, c: 4 }, { r: 3, c: 0 }, { r: 0, c: 0 }], captured: [] }
  ];

  const PUZZLES = {
    province: [
      { title: "Road Cipher", prompt: "Decode and enter: BRIDGE -> ? (Hint: reverse it)", answer: "egdirb" },
      { title: "Caravan Knot", prompt: "How many corners does a hex have?", answer: "6" },
      { title: "Maze Step Count", mode: "maze", prompt: "Guide the runner from S to E. Walls block movement.", answer: "R-R-D-D-R", mazeLayout: ["S..#", "##.#", "...#", "##.E"] },
      { title: "Jigsaw Relay", prompt: "Jigsaw order puzzle: Arrange tiles in correct sentence order: [KEY] [THE] [TURN] [NOW]. Enter full sentence.", answer: "turn the key now" },
      { title: "Word Search Marker", prompt: "Word Search: Find the hidden word in row 'B R I D G E'. Enter the found word.", answer: "bridge" },
      { title: "Word Scramble", prompt: "Unscramble: GNAIATVE", answer: "navigate" },
      { title: "Rook Relay I", mode: "chess_puzzle", prompt: "Capture every marked piece using legal rook moves.", chessState: CHESS_PRESETS[0] },
      { title: "Mini Sudoku", mode: "sudoku", prompt: "Fill the 4x4 grid so each row, column, and 2x2 box contains 1-4.", sudokuPuzzle: [["1", "", "3", "4"], ["3", "4", "1", "2"], ["2", "1", "4", "3"], ["4", "3", "2", "1"]], sudokuSolution: [["1", "2", "3", "4"], ["3", "4", "1", "2"], ["2", "1", "4", "3"], ["4", "3", "2", "1"]] },
      { title: "Magic Square", prompt: "3x3 Magic Square sum is 15. Grid: 8 1 6 / 3 5 7 / 4 _ 2. Missing value?", answer: "9" }
    ],
    sea: [
      { title: "Tide Sequence", prompt: "Enter the next term: 2, 4, 8, 16, ?", answer: "32" },
      { title: "Chart Mark", prompt: "Type the nautical shorthand for North-East.", answer: "ne" },
      { title: "Sea Cryptogram", prompt: "Cryptogram (Caesar +1): TFB -> ?", answer: "sea" },
      { title: "Harbor Bishop Lock", mode: "chess_puzzle", prompt: "Bishop lockboard: capture all sentries using legal bishop diagonals.", chessState: CHESS_PRESETS[1] },
      { title: "Word Search Buoy", prompt: "Word Search row: A N C H O R. Enter the hidden word.", answer: "anchor" }
    ],
    galaxy: [
      { title: "Signal Relay", prompt: "Type the binary value of decimal 5.", answer: "101" },
      { title: "Star Vector", prompt: "How many primary axes does a hex grid use?", answer: "3" },
      { title: "Crossword Clue", prompt: "Crossword clue 1 Across (4): \"Star path\" = ?", answer: "lane" },
      { title: "Word Scramble", prompt: "Unscramble: RTOIB", answer: "orbit" }
    ],
    planet: [
      { title: "Surface Lock", prompt: "Enter: BIO + ME = ?", answer: "biome" },
      { title: "Drill Code", prompt: "Solve: 9 + 7", answer: "16" },
      { title: "Mini Maze Route", mode: "maze", prompt: "Trace the rover's path through the cracked surface tunnels.", answer: "R-R-D-D-L-D", mazeLayout: ["S...", "###.", "..#.", "E..."] },
      { title: "Colony Knight Protocol", mode: "chess_puzzle", prompt: "Use knight jumps to capture every marked sentry.", chessState: CHESS_PRESETS[2] },
      { title: "Magic Square Delta", prompt: "Magic square line total is 15. Row: 2 7 _. Missing number?", answer: "6" }
    ],
    wtw: [
      { title: "District Relay", prompt: "Unscramble: RAILSTOANIT", answer: "railstation" },
      { title: "Control Pulse", prompt: "Solve: 12 - 5", answer: "7" },
      { title: "Tribunal Rook Trial", mode: "chess_puzzle", prompt: "Capture all witness-pawns in legal rook lines.", chessState: CHESS_PRESETS[3] },
      { title: "District Crossword", prompt: "Crossword clue 3 Down (5): \"Urban train stop\" = ?", answer: "depot" },
      { title: "Cryptogram Grid", prompt: "Cryptogram (+1 shift): [XPSME]. Decode.", answer: "world" }
    ],
    task: [
      { title: "Field Brief", prompt: "Type the stat used most for exploration checks in this game section.", answer: "valor" },
      { title: "Route Marker", prompt: "How many directions are shown in the 8-way observation controls?", answer: "8" },
      { title: "Jigsaw Brief", prompt: "Arrange phrase parts: [ROUTE] [THE] [HOLD] [LINE]. Enter full phrase.", answer: "hold the route line" }
    ],
    event: [
      { title: "Event Seal", prompt: "Type YES to stabilize the event flow.", answer: "yes" },
      { title: "Risk Matrix", prompt: "What die size is used for Dread checks in many quick tasks here?", answer: "6" },
      { title: "Word Search Event", prompt: "Word Search row: H A Z A R D. Enter the hidden word.", answer: "hazard" },
      { title: "Word Scramble", prompt: "Unscramble: VETNE", answer: "event" }
    ],
    holding: [
      { title: "Council Ledger", prompt: "Type the role that handles diplomacy in your council.", answer: "diplomat" },
      { title: "Home Registry", prompt: "Type HOME in uppercase.", answer: "HOME" },
      { title: "Mini Sudoku", mode: "sudoku", prompt: "Restore the council ledger grid so each row, column, and 2x2 box contains 1-4.", sudokuPuzzle: [["1", "2", "3", ""], ["3", "4", "", "2"], ["2", "", "4", "3"], ["", "3", "2", "1"]], sudokuSolution: [["1", "2", "3", "4"], ["3", "4", "1", "2"], ["2", "1", "4", "3"], ["4", "3", "2", "1"]] },
      { title: "Magic Square", prompt: "3x3 Magic Square row: 4 9 _. Target row sum 15. Missing number?", answer: "2" }
    ]
  };

  function normalizeAnswer(v) {
    return String(v || "").trim().toLowerCase();
  }

  function applyPuzzleReward(source, reward) {
    if (typeof S === "undefined") return;
    const credits = Number((reward && reward.credits) || 0);
    const renown = Number((reward && reward.renown) || 0);
    const item = reward && reward.item ? String(reward.item) : "";

    if (credits) {
      S.credits = Math.max(0, Number(S.credits || 0) + credits);
      if (typeof updateCreditsUI === "function") updateCreditsUI();
    }
    if (renown) {
      if (typeof changeCounter === "function") changeCounter("renown", renown);
      else S.renown = Math.max(0, Number(S.renown || 0) + renown);
    }
    if (item && typeof addToBackpack === "function") {
      try { addToBackpack(item); } catch (err) { console.error(err); }
    }

    if (typeof showNotif === "function") {
      const bits = [];
      if (credits) bits.push("+" + credits + " Credits");
      if (renown) bits.push("+" + renown + " Renown");
      if (item) bits.push("Loot: " + item);
      showNotif("Puzzle reward (" + source + "): " + bits.join(" · "), "good");
    }
  }

  function resolveCallback(cb) {
    if (!cb) return null;
    if (typeof cb === "function") return cb;
    if (typeof cb === "string" && typeof window[cb] === "function") return window[cb];
    return null;
  }

  function finishSharedPuzzle(success) {
    const st = ensurePuzzleState();
    if (!st || !st.active) return;
    const active = st.active;

    st.bySource[active.source] = st.bySource[active.source] || { solved: 0, failed: 0 };

    if (success) {
      st.solved += 1;
      st.bySource[active.source].solved += 1;
      applyPuzzleReward(active.source, active.reward);
      const okFn = resolveCallback(active.onSuccess);
      if (okFn) {
        try { okFn(); } catch (err) { console.error(err); }
      }
    } else {
      st.failed += 1;
      st.bySource[active.source].failed += 1;
      if (typeof addTMWOnFail === "function") addTMWOnFail();
      if (typeof showNotif === "function") showNotif("Puzzle failed (" + active.source + ").", "warn");
      const failFn = resolveCallback(active.onFail);
      if (failFn) {
        try { failFn(); } catch (err) { console.error(err); }
      }
    }

    st.active = null;
  }


  // ─── Custom inline puzzle modes ──────────────────────────────────────────
  var _cp = null;

  function buildPipeFlowState() {
    var size = 4;
    var templates = [
      [
        { type: 'source', rotation: 0, locked: true },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'tee', rotation: 1, locked: false },
        { type: 'elbow', rotation: 2, locked: false },
        { type: 'elbow', rotation: 0, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'straight', rotation: 1, locked: false },
        { type: 'tee', rotation: 0, locked: false },
        { type: 'straight', rotation: 1, locked: false },
        { type: 'elbow', rotation: 1, locked: false },
        { type: 'cross', rotation: 0, locked: false },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'elbow', rotation: 3, locked: false },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'sink', rotation: 0, locked: true }
      ],
      [
        { type: 'source', rotation: 0, locked: true },
        { type: 'elbow', rotation: 2, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'block', rotation: 0, locked: true },
        { type: 'tee', rotation: 1, locked: false },
        { type: 'elbow', rotation: 3, locked: false },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'straight', rotation: 1, locked: false },
        { type: 'elbow', rotation: 0, locked: false },
        { type: 'tee', rotation: 1, locked: false },
        { type: 'elbow', rotation: 2, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'block', rotation: 0, locked: true },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'sink', rotation: 0, locked: true }
      ],
      [
        { type: 'source', rotation: 0, locked: true },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'elbow', rotation: 2, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'elbow', rotation: 1, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'straight', rotation: 1, locked: false },
        { type: 'tee', rotation: 0, locked: false },
        { type: 'elbow', rotation: 1, locked: false },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'elbow', rotation: 3, locked: false },
        { type: 'tee', rotation: 1, locked: false },
        { type: 'block', rotation: 0, locked: true },
        { type: 'straight', rotation: 0, locked: false },
        { type: 'sink', rotation: 0, locked: true }
      ]
    ];
    var order = [];
    for (var oi = 0; oi < templates.length; oi++) order.push(oi);
    for (var s = order.length - 1; s > 0; s--) {
      var j = Math.floor(Math.random() * (s + 1));
      var tmp = order[s];
      order[s] = order[j];
      order[j] = tmp;
    }

    var solvedTiles = null;
    for (var k = 0; k < order.length; k++) {
      var attemptBase = templates[order[k]].map(function (tile) {
        return { type: tile.type, rotation: Number(tile.rotation || 0), locked: !!tile.locked };
      });
      solvedTiles = _pipeFlowFindSolvedTemplate(attemptBase, size);
      if (solvedTiles) break;
    }
    if (!solvedTiles) {
      solvedTiles = templates[0].map(function (tile) {
        return { type: tile.type, rotation: Number(tile.rotation || 0), locked: !!tile.locked };
      });
    }

    var shuffled = solvedTiles.map(function (tile) {
      var next = { type: tile.type, rotation: Number(tile.rotation || 0), locked: !!tile.locked };
      if (!next.locked) {
        var opts = _pipeFlowRotationOptions(next);
        if (opts.length > 1) {
          var pick = opts[Math.floor(Math.random() * opts.length)];
          var guard = 0;
          while (pick === next.rotation && guard < 8) {
            pick = opts[Math.floor(Math.random() * opts.length)];
            guard += 1;
          }
          next.rotation = pick;
        }
      }
      return next;
    });

    // Avoid serving an already-solved board unless every unlocked tile is effectively fixed.
    if (_pipeFlowSolved(shuffled)) {
      for (var ti = 0; ti < shuffled.length; ti++) {
        var t = shuffled[ti];
        if (t.locked) continue;
        var opts2 = _pipeFlowRotationOptions(t);
        if (opts2.length > 1) {
          for (var oi2 = 0; oi2 < opts2.length; oi2++) {
            if (opts2[oi2] !== t.rotation) {
              t.rotation = opts2[oi2];
              break;
            }
          }
          if (!_pipeFlowSolved(shuffled)) break;
        }
      }
    }

    return { tiles: shuffled, size: size };
  }

  function _pipeFlowRotationOptions(tile) {
    var type = String(tile && tile.type || '').toLowerCase();
    if (type === 'source' || type === 'sink' || type === 'block' || type === 'cross') {
      return [Number(tile && tile.rotation || 0) % 4];
    }
    if (type === 'straight') return [0, 1];
    return [0, 1, 2, 3];
  }

  function _pipeFlowFindSolvedTemplate(baseTiles, size) {
    if (!Array.isArray(baseTiles) || !baseTiles.length) return null;
    var work = baseTiles.map(function (tile) {
      return { type: tile.type, rotation: Number(tile.rotation || 0), locked: !!tile.locked };
    });

    var variable = [];
    for (var i = 0; i < work.length; i++) {
      var opts = _pipeFlowRotationOptions(work[i]);
      if (work[i].locked || opts.length <= 1) continue;
      variable.push(i);
    }

    var nodes = 0;
    var maxNodes = 220000;

    function dfs(pos) {
      nodes += 1;
      if (nodes > maxNodes) return false;
      if (pos >= variable.length) {
        return _pipeFlowSolved(work);
      }
      var idx = variable[pos];
      var opts = _pipeFlowRotationOptions(work[idx]);
      for (var oi = 0; oi < opts.length; oi++) {
        work[idx].rotation = opts[oi];
        if (dfs(pos + 1)) return true;
      }
      return false;
    }

    if (!dfs(0)) return null;
    return work;
  }

  function _cpTileExits(tile) {
    var r = (tile.rotation || 0) % 4;
    if (tile.type === 'source') return ['right'];
    if (tile.type === 'sink')   return ['left'];
    if (tile.type === 'straight') return r % 2 === 0 ? ['left', 'right'] : ['up', 'down'];
    if (tile.type === 'elbow') {
      if (r === 0) return ['up', 'right'];
      if (r === 1) return ['right', 'down'];
      if (r === 2) return ['down', 'left'];
      return ['left', 'up'];
    }
    if (tile.type === 'tee') {
      if (r === 0) return ['up', 'left', 'right'];
      if (r === 1) return ['up', 'right', 'down'];
      if (r === 2) return ['right', 'down', 'left'];
      return ['up', 'down', 'left'];
    }
    if (tile.type === 'cross') return ['up', 'right', 'down', 'left'];
    return [];
  }

  function _pipeFlowSolved(tiles) {
    if (!Array.isArray(tiles) || !tiles.length) return false;
    var size = Math.max(3, Math.round(Math.sqrt(tiles.length)));
    if (tiles.length !== size * size) return false;
    var sinkIndex = (size * size) - 1;
    var queue = [0];
    var seen = { 0: true };
    while (queue.length) {
      var idx = Number(queue.shift());
      if (idx === sinkIndex) return true;
      var exits = _cpTileExits(tiles[idx]);
      for (var i = 0; i < exits.length; i++) {
        var dir = exits[i];
        var ni = _pipeNeighborIndex(idx, dir, size);
        if (ni < 0) continue;
        var nTile = tiles[ni] || {};
        if (nTile.type === 'block') continue;
        var needBack = _pipeOpposite(dir);
        var nExits = _cpTileExits(nTile);
        if (nExits.indexOf(needBack) < 0) continue;
        if (!seen[ni]) {
          seen[ni] = true;
          queue.push(ni);
        }
      }
    }
    return false;
  }

  function _renderPipeFlow(state, title, prompt) {
    var size = Math.max(3, Number((state && state.size) || (Math.round(Math.sqrt((state && state.tiles && state.tiles.length) || 9)) || 3)));
    var glyph = function(tile) {
      var r = (tile.rotation || 0) % 4;
      if (tile.type === 'source') return '\u25b6';
      if (tile.type === 'sink')   return '\u25c0';
      if (tile.type === 'straight') return r % 2 === 0 ? '\u2550' : '\u2551';
      if (tile.type === 'elbow') return ['\u255a', '\u2554', '\u2557', '\u255d'][r];
      if (tile.type === 'tee') return ['\u2569', '\u2560', '\u2566', '\u2563'][r];
      if (tile.type === 'cross') return '\u256c';
      return '\u00b7';
    };
    var solved = _pipeFlowSolved(state.tiles);
    return '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.16rem;"><strong>' + title + '</strong></div>'
      + '<div style="font-size:.65rem;color:var(--muted2);margin-bottom:.16rem;">' + prompt + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(' + size + ',68px);gap:.12rem;justify-content:center;margin-bottom:.18rem;">'
      + state.tiles.map(function(tile, idx) {
          var bg = tile.type === 'source' ? 'rgba(40,180,220,.22)' : tile.type === 'sink' ? 'rgba(255,190,70,.22)' : tile.locked ? 'rgba(20,20,30,.5)' : 'rgba(50,60,90,.5)';
          return '<button class="btn btn-xs" style="height:68px;font-size:1.7rem;line-height:1;background:' + bg + ';border-color:rgba(255,255,255,.18);"'
            + (tile.locked ? ' disabled' : ' onclick="window._cpAction(\'pipe_rotate\',' + idx + ')"')
            + '>' + glyph(tile) + '</button>';
        }).join('')
      + '</div>'
      + (solved ? '<div style="color:var(--teal);text-align:center;font-size:.75rem;margin-bottom:.1rem;">\u2713 Pipe flow connected!</div>' : '')
      + '<div style="display:flex;gap:.28rem;justify-content:flex-end;margin-top:.1rem;">'
      + '<button class="btn btn-sm" onclick="window._cpAction(\'give_up\')">Give Up</button>'
      + '<button class="btn btn-sm btn-primary"' + (solved ? '' : ' disabled') + ' onclick="window._cpAction(\'submit\')">Submit</button>'
      + '</div>';
  }

  function _isChessStateSolvable(state) {
    function keyFor(rook, captured) {
      return String(rook.r) + ':' + String(rook.c) + '|' + captured.slice().sort(function (a, b) { return a - b; }).join(',');
    }
    function dfs(rook, captured, memo) {
      if (captured.length >= state.pawns.length) return true;
      var key = keyFor(rook, captured);
      if (memo[key]) return false;
      memo[key] = true;
      for (var i = 0; i < state.pawns.length; i++) {
        if (captured.indexOf(i) >= 0) continue;
        var testState = { board: state.board, piece: state.piece || 'rook', rook: rook, pawns: state.pawns, captured: captured };
        if (_pieceCanCapture(testState, state.pawns[i])) {
          var nextCaptured = captured.slice();
          nextCaptured.push(i);
          if (dfs({ r: state.pawns[i].r, c: state.pawns[i].c }, nextCaptured, memo)) return true;
        }
      }
      return false;
    }
    return dfs({ r: state.rook.r, c: state.rook.c }, [], {});
  }

  function _buildRandomChessState(preferredPiece) {
    var size = 5;
    var rook = { r: Math.floor(Math.random() * size), c: Math.floor(Math.random() * size) };
    var pawns = [];
    var used = {};
    used[rook.r + ':' + rook.c] = true;
    while (pawns.length < 4) {
      var pr = Math.floor(Math.random() * size);
      var pc = Math.floor(Math.random() * size);
      var id = pr + ':' + pc;
      if (used[id]) continue;
      used[id] = true;
      pawns.push({ r: pr, c: pc });
    }
    var pieceOptions = ['rook', 'bishop', 'knight'];
    var forced = String(preferredPiece || '').toLowerCase();
    var piece = pieceOptions.indexOf(forced) >= 0
      ? forced
      : pieceOptions[Math.floor(Math.random() * pieceOptions.length)];
    return { board: size, piece: piece, rook: rook, pawns: pawns, captured: [], seed: Date.now() + '-' + Math.floor(Math.random() * 100000) };
  }

  function _initChess(preferredPiece) {
    var tries = 0;
    var state = _buildRandomChessState(preferredPiece);
    while (tries < 30 && !_isChessStateSolvable(state)) {
      state = _buildRandomChessState(preferredPiece);
      tries += 1;
    }
    if (!_isChessStateSolvable(state)) {
      state = _buildRandomChessState();
      tries = 0;
      while (tries < 30 && !_isChessStateSolvable(state)) {
        state = _buildRandomChessState();
        tries += 1;
      }
    }
    return state;
  }

  function _nextChessPieceForSession(st) {
    var cycle = ['rook', 'bishop', 'knight'];
    var last = st && st.lastChessPiece ? String(st.lastChessPiece).toLowerCase() : '';
    var idx = cycle.indexOf(last);
    var next = cycle[(idx + 1 + cycle.length) % cycle.length];
    if (st) st.lastChessPiece = next;
    return next;
  }

  function _pieceCanCapture(state, pawn) {
    var piece = String((state && state.piece) || 'rook').toLowerCase();
    if (piece === 'knight') {
      var drK = Math.abs(Number(state.rook.r || 0) - Number(pawn.r || 0));
      var dcK = Math.abs(Number(state.rook.c || 0) - Number(pawn.c || 0));
      return (drK === 2 && dcK === 1) || (drK === 1 && dcK === 2);
    }
    if (piece === 'bishop') {
      var drB = Number(pawn.r || 0) - Number(state.rook.r || 0);
      var dcB = Number(pawn.c || 0) - Number(state.rook.c || 0);
      if (Math.abs(drB) !== Math.abs(dcB)) return false;
      var stepR = drB > 0 ? 1 : -1;
      var stepC = dcB > 0 ? 1 : -1;
      var remainingDiag = state.pawns.filter(function(p, i) { return state.captured.indexOf(i) < 0; });
      var rr = Number(state.rook.r || 0) + stepR;
      var cc = Number(state.rook.c || 0) + stepC;
      while (rr !== Number(pawn.r || 0) && cc !== Number(pawn.c || 0)) {
        if (remainingDiag.some(function(p) { return p !== pawn && Number(p.r) === rr && Number(p.c) === cc; })) return false;
        rr += stepR;
        cc += stepC;
      }
      return true;
    }
    var rook = state.rook;
    if (rook.r !== pawn.r && rook.c !== pawn.c) return false;
    var remaining = state.pawns.filter(function(p, i) { return state.captured.indexOf(i) < 0; });
    if (rook.r === pawn.r) {
      var minC = Math.min(rook.c, pawn.c), maxC = Math.max(rook.c, pawn.c);
      return !remaining.some(function(p) { return p !== pawn && p.r === rook.r && p.c > minC && p.c < maxC; });
    }
    var minR = Math.min(rook.r, pawn.r), maxR = Math.max(rook.r, pawn.r);
    return !remaining.some(function(p) { return p !== pawn && p.c === rook.c && p.r > minR && p.r < maxR; });
  }

  function _renderChess(state, title, prompt) {
    var N = state.board;
    var piece = String(state.piece || 'rook').toLowerCase();
    var pieceGlyph = piece === 'bishop' ? '\u265d' : (piece === 'knight' ? '\u265e' : '\u265c');
    var pieceName = piece === 'bishop' ? 'Bishop' : (piece === 'knight' ? 'Knight' : 'Rook');
    var remaining = state.pawns.filter(function(_, i) { return state.captured.indexOf(i) < 0; });
    var solved = remaining.length === 0;
    var rows = '';
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var isRook = state.rook.r === r && state.rook.c === c;
        var pawnIdx = -1;
        state.pawns.forEach(function(p, i) { if (p.r === r && p.c === c && state.captured.indexOf(i) < 0) pawnIdx = i; });
        var bg = (r + c) % 2 === 0 ? 'rgba(80,80,90,.6)' : 'rgba(40,40,50,.6)';
        var content = isRook ? pieceGlyph : (pawnIdx >= 0 ? '\u265f' : '');
        var canCapture = pawnIdx >= 0 && _pieceCanCapture(state, state.pawns[pawnIdx]);
        var style = 'width:52px;height:52px;font-size:1.4rem;line-height:1;background:' + bg + ';border:1px solid rgba(255,255,255,.1);color:'
          + (isRook ? 'var(--teal)' : canCapture ? 'var(--gold2)' : 'var(--text2)') + ';';
        rows += '<button style="' + style + '"'
          + (canCapture ? ' onclick="window._cpAction(\'chess_capture\',' + pawnIdx + ')"' : ' disabled')
          + '>' + content + '</button>';
      }
    }
    return '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.16rem;"><strong>' + title + '</strong></div>'
      + '<div style="font-size:.65rem;color:var(--muted2);margin-bottom:.12rem;">' + prompt + '</div>'
      + '<div style="font-size:.64rem;color:var(--teal);margin-bottom:.1rem;">' + pieceGlyph + ' ' + pieceName + ' (teal) \u265f Pawn (gold = capturable). Click gold pawns to capture with legal ' + pieceName.toLowerCase() + ' moves.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(' + N + ',52px);gap:2px;justify-content:center;margin-bottom:.16rem;">' + rows + '</div>'
      + (solved ? '<div style="color:var(--teal);text-align:center;font-size:.75rem;margin-bottom:.1rem;">\u2713 All pawns captured!</div>' : '<div style="font-size:.63rem;color:var(--muted2);text-align:center;margin-bottom:.1rem;">' + remaining.length + ' pawn(s) remaining</div>')
      + '<div style="display:flex;gap:.28rem;justify-content:flex-end;margin-top:.1rem;">'
      + '<button class="btn btn-sm" onclick="window._cpAction(\'give_up\')">Give Up</button>'
      + '<button class="btn btn-sm btn-primary"' + (solved ? '' : ' disabled') + ' onclick="window._cpAction(\'submit\')">Submit</button>'
      + '</div>';
  }

  function _initSliding() {
    return { tiles: [1, 2, 3, 4, 0, 6, 7, 5, 8], size: 3 };
  }

  function _slidingSolved(tiles) {
    var goal = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    return tiles.every(function(v, i) { return v === goal[i]; });
  }

  function _renderSliding(state, title, prompt) {
    var N = state.size;
    var blankIdx = state.tiles.indexOf(0);
    var solved = _slidingSolved(state.tiles);
    var grid = state.tiles.map(function(v, idx) {
      var isBlank = v === 0;
      var blankR = Math.floor(blankIdx / N), blankC = blankIdx % N;
      var r = Math.floor(idx / N), c = idx % N;
      var adjacent = Math.abs(r - blankR) + Math.abs(c - blankC) === 1;
      var bg = isBlank ? 'rgba(0,0,0,.1)' : 'rgba(60,80,120,.5)';
      return '<button class="btn btn-xs" style="width:58px;height:58px;font-size:1.1rem;background:' + bg + ';border-color:rgba(255,255,255,.2);"'
        + (isBlank ? ' disabled' : (!adjacent ? ' disabled' : ' onclick="window._cpAction(\'slide\',' + idx + ')"'))
        + '>' + (isBlank ? '' : v) + '</button>';
    }).join('');
    return '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.16rem;"><strong>' + title + '</strong></div>'
      + '<div style="font-size:.65rem;color:var(--muted2);margin-bottom:.12rem;">' + prompt + '</div>'
      + '<div style="font-size:.64rem;color:var(--teal);margin-bottom:.1rem;">Click tiles adjacent to the blank to slide them. Goal: 1\u20138, blank at bottom-right.</div>'
      + '<div style="display:grid;grid-template-columns:repeat(' + N + ',58px);gap:4px;justify-content:center;margin-bottom:.16rem;">' + grid + '</div>'
      + (solved ? '<div style="color:var(--teal);text-align:center;font-size:.75rem;margin-bottom:.1rem;">\u2713 Puzzle solved!</div>' : '')
      + '<div style="display:flex;gap:.28rem;justify-content:flex-end;margin-top:.1rem;">'
      + '<button class="btn btn-sm" onclick="window._cpAction(\'give_up\')">Give Up</button>'
      + '<button class="btn btn-sm btn-primary"' + (solved ? '' : ' disabled') + ' onclick="window._cpAction(\'submit\')">Submit</button>'
      + '</div>';
  }

  function _initMathGrid() {
    return {
      equations: [
        { a: 9, op: '+', b: '?', result: 12, answer: 3 },
        { a: '?', op: '+', b: 4, result: 11, answer: 7 },
        { a: 15, op: '-', b: '?', result: 8, answer: 7 }
      ],
      inputs: ['', '', '']
    };
  }

  function _mathGridSolved(state) {
    return state.equations.every(function(eq, i) {
      return parseInt(state.inputs[i], 10) === eq.answer;
    });
  }

  function _renderMathGrid(state, title, prompt) {
    var solved = _mathGridSolved(state);
    var rows = state.equations.map(function(eq, i) {
      var inputHtml = '<input id="mathIn' + i + '" class="input" type="number" value="' + (state.inputs[i] || '') + '" oninput="window._cpAction(\'math_input\',' + i + ',this.value)" style="width:44px;height:28px;text-align:center;display:inline-block;padding:.08rem .1rem;font-size:.84rem;" />';
      var lhs = eq.a === '?' ? inputHtml : String(eq.a);
      var rhs = eq.b === '?' ? inputHtml : String(eq.b);
      var correct = parseInt(state.inputs[i], 10) === eq.answer;
      return '<div style="display:flex;align-items:center;gap:.45rem;font-size:.9rem;color:var(--text2);padding:.22rem .3rem;border:1px solid ' + (correct ? 'rgba(46,196,182,.5)' : 'rgba(255,255,255,.1)') + ';background:rgba(255,255,255,.03);margin-bottom:.1rem;">'
        + lhs + ' <span style="color:var(--gold2);">' + String(eq.op) + '</span> ' + rhs + ' <span style="color:var(--muted2);"> = </span> <strong>' + String(eq.result) + '</strong>'
        + (correct ? ' <span style="color:var(--teal);font-size:.7rem;">\u2713</span>' : '')
        + '</div>';
    }).join('');
    return '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.16rem;"><strong>' + title + '</strong></div>'
      + '<div style="font-size:.65rem;color:var(--muted2);margin-bottom:.12rem;">' + prompt + '</div>'
      + '<div style="font-size:.64rem;color:var(--teal);margin-bottom:.1rem;">Fill each missing number (?) so the equation is correct.</div>'
      + '<div style="max-width:280px;margin:0 auto .18rem;">' + rows + '</div>'
      + (solved ? '<div style="color:var(--teal);text-align:center;font-size:.75rem;margin-bottom:.1rem;">\u2713 All equations solved!</div>' : '')
      + '<div style="display:flex;gap:.28rem;justify-content:flex-end;margin-top:.1rem;">'
      + '<button class="btn btn-sm" onclick="window._cpAction(\'give_up\')">Give Up</button>'
      + '<button class="btn btn-sm btn-primary"' + (solved ? '' : ' disabled') + ' onclick="window._cpAction(\'submit\')">Submit</button>'
      + '</div>';
  }

  function _initRotatingImage() {
    return {
      segments: [
        { label: 'NW Shard', rot: 1 },
        { label: 'NE Shard', rot: 2 },
        { label: 'SW Shard', rot: 3 },
        { label: 'SE Shard', rot: 1 }
      ]
    };
  }

  function _rotatingImageSolved(state) {
    return state.segments.every(function(s) { return s.rot === 0; });
  }

  function _renderRotatingImage(state, title, prompt) {
    var solved = _rotatingImageSolved(state);
    var rotLabels = ['\u2191 Upright', '\u2192 90\u00b0 CW', '\u2193 180\u00b0', '\u2190 270\u00b0 CW'];
    var icons = ['\u25e4', '\u25e5', '\u25e3', '\u25e2'];
    var segGrid = state.segments.map(function(seg, i) {
      var correct = seg.rot === 0;
      var display = icons[(i + seg.rot) % 4];
      return '<div style="border:1px solid ' + (correct ? 'rgba(46,196,182,.5)' : 'rgba(255,255,255,.14)') + ';padding:.3rem;background:rgba(255,255,255,.04);text-align:center;">'
        + '<div style="font-size:2.2rem;color:var(--text2);margin-bottom:.1rem;">' + display + '</div>'
        + '<div style="font-size:.6rem;color:var(--muted2);margin-bottom:.12rem;">' + seg.label + '<br>' + rotLabels[seg.rot] + '</div>'
        + '<button class="btn btn-xs' + (correct ? '' : ' btn-primary') + '" onclick="window._cpAction(\'rotate_seg\',' + i + ')">' + (correct ? '\u2713 Aligned' : 'Rotate \u21bb') + '</button>'
        + '</div>';
    }).join('');
    return '<div style="font-size:.72rem;color:var(--gold2);margin-bottom:.16rem;"><strong>' + title + '</strong></div>'
      + '<div style="font-size:.65rem;color:var(--muted2);margin-bottom:.12rem;">' + prompt + '</div>'
      + '<div style="font-size:.64rem;color:var(--teal);margin-bottom:.1rem;">Rotate each shard so all four show \u2191 Upright.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.2rem;max-width:300px;margin:0 auto .2rem;">' + segGrid + '</div>'
      + (solved ? '<div style="color:var(--teal);text-align:center;font-size:.75rem;margin-bottom:.1rem;">\u2713 Image restored!</div>' : '')
      + '<div style="display:flex;gap:.28rem;justify-content:flex-end;margin-top:.1rem;">'
      + '<button class="btn btn-sm" onclick="window._cpAction(\'give_up\')">Give Up</button>'
      + '<button class="btn btn-sm btn-primary"' + (solved ? '' : ' disabled') + ' onclick="window._cpAction(\'submit\')">Submit</button>'
      + '</div>';
  }

  var WORDLE_ARCANE_POOLS = {
    common: [
      { w: 'glyph', cat: 'Magic Term', hint: 'A carved rune-sign used in spells.' },
      { w: 'mages', cat: 'Class', hint: 'Arcane scholars who shape raw magic.' },
      { w: 'rogue', cat: 'Class', hint: 'A stealth specialist who thrives in shadows.' },
      { w: 'elder', cat: 'Fantasy Noun', hint: 'Ancient one, keeper of old memory.' },
      { w: 'druid', cat: 'Class', hint: 'Warden of roots, beasts, and seasons.' },
      { w: 'runes', cat: 'Magic Term', hint: 'Symbols etched to bind power.' },
      { w: 'crown', cat: 'Artifact', hint: 'A sovereign relic worn by rulers.' },
      { w: 'tower', cat: 'Location', hint: 'A high lonely bastion of study.' },
      { w: 'fiend', cat: 'Monster', hint: 'A malicious creature of infernal planes.' },
      { w: 'quest', cat: 'Dungeon Term', hint: 'A sworn journey toward danger and reward.' },
      { w: 'relic', cat: 'Artifact', hint: 'An old sacred object of power.' },
      { w: 'crypt', cat: 'Location', hint: 'A sealed chamber beneath old stone.' },
      { w: 'altar', cat: 'Dungeon Term', hint: 'A ritual focus where vows are made.' },
      { w: 'spell', cat: 'Magic Term', hint: 'A spoken formula that shapes power.' },
      { w: 'cloak', cat: 'Artifact', hint: 'A garment favored by travelers and assassins.' }
    ],
    medium: [
      { w: 'wight', cat: 'Monster', hint: 'An undead spirit that lingers with malice.' },
      { w: 'shade', cat: 'Monster', hint: 'A dim spirit that haunts old halls.' },
      { w: 'cairn', cat: 'Location', hint: 'A stone marker over forgotten dead.' },
      { w: 'sigil', cat: 'Magic Term', hint: 'A focused symbol used for binding.' },
      { w: 'spire', cat: 'Location', hint: 'Needle-like tower piercing the sky.' },
      { w: 'vault', cat: 'Dungeon Term', hint: 'A fortified chamber guarding treasure.' },
      { w: 'wards', cat: 'Magic Term', hint: 'Protective barriers woven from spellcraft.' },
      { w: 'golem', cat: 'Monster', hint: 'An animated construct of stone or clay.' },
      { w: 'faery', cat: 'Monster', hint: 'A capricious being of the old courts.' }
    ],
    rare: [
      { w: 'wyrms', cat: 'Monster', hint: 'Ancient serpents of sky and flame.' },
      { w: 'phial', cat: 'Artifact', hint: 'A small vessel for rare elixirs.' },
      { w: 'djinn', cat: 'Monster', hint: 'A bound spirit of wind and wish.' },
      { w: 'nymph', cat: 'Monster', hint: 'A fey being tied to place and season.' },
      { w: 'ghoul', cat: 'Monster', hint: 'A grave-feeding horror from moonless crypts.' }
    ]
  };

  function _pickWordleArcaneEntry() {
    var rollPct = safeRoll(100);
    var tier = rollPct <= 55 ? 'common' : (rollPct <= 85 ? 'medium' : 'rare');
    var pool = WORDLE_ARCANE_POOLS[tier] || WORDLE_ARCANE_POOLS.common;
    var chosen = safePick(pool, pool[0]) || pool[0];
    return {
      word: String(chosen.w || 'glyph').toLowerCase(),
      category: String(chosen.cat || 'Fantasy Noun'),
      loreHint: String(chosen.hint || 'The codex whispers this name in old ink.'),
      tier: tier
    };
  }

  function _wordleRankColor(existing, next) {
    var order = { '': 0, absent: 1, present: 2, correct: 3 };
    return order[String(next || '')] >= order[String(existing || '')] ? next : existing;
  }

  function _scoreWordleGuess(guess, answer) {
    var g = String(guess || '').toLowerCase();
    var a = String(answer || '').toLowerCase();
    var len = Math.max(0, Math.min(g.length, a.length));
    var out = [];
    var counts = {};
    var i;
    for (i = 0; i < len; i++) out.push('absent');

    // Build counts from answer letters that are not already exact matches.
    for (i = 0; i < len; i++) {
      if (g.charAt(i) !== a.charAt(i)) {
        var answerChar = a.charAt(i);
        counts[answerChar] = Number(counts[answerChar] || 0) + 1;
      }
    }

    // Pass 1: mark exact-position letters.
    for (i = 0; i < len; i++) {
      if (g.charAt(i) === a.charAt(i)) out[i] = 'correct';
    }

    // Pass 2: mark misplaced letters using remaining unmatched counts.
    for (i = 0; i < len; i++) {
      if (out[i] === 'correct') continue;
      var guessChar = g.charAt(i);
      if (Number(counts[guessChar] || 0) > 0) {
        out[i] = 'present';
        counts[guessChar] = Number(counts[guessChar] || 0) - 1;
      } else {
        out[i] = 'absent';
      }
    }
    return out;
  }

  function _initWordleArcane() {
    var pick = _pickWordleArcaneEntry();
    var all = [];
    ['common', 'medium', 'rare'].forEach(function (tier) {
      var arr = WORDLE_ARCANE_POOLS[tier] || [];
      arr.forEach(function (entry) {
        var w = String(entry && entry.w || '').toLowerCase();
        if (w && w.length === 5) all.push(w);
      });
    });
    var extraAllowed = ['spell', 'wraith', 'faery', 'demon', 'blade', 'torch', 'stave', 'potion', 'coven', 'golem', 'fable', 'chant'];
    extraAllowed.forEach(function (w) { if (all.indexOf(w) < 0) all.push(w); });
    return {
      answer: pick.word,
      category: pick.category,
      loreHint: pick.loreHint,
      tier: pick.tier,
      attempts: [],
      current: '',
      maxAttempts: 6,
      wordLength: 5,
      keyboard: {},
      allowedWords: all,
      animating: false,
      status: 'playing',
      revealHintAt: 4,
      timeoutIds: []
    };
  }

  function _wordleGetHintHtml(state) {
    var attemptCount = Array.isArray(state.attempts) ? state.attempts.length : 0;
    var revealFirst = attemptCount >= Number(state.revealHintAt || 4) && state.status === 'playing';
    return '<div style="border:1px solid rgba(212,175,110,.32);background:rgba(29,24,18,.72);padding:.22rem .28rem;margin-bottom:.14rem;">'
      + '<div style="font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#d7b475;">Codex Hint</div>'
      + '<div style="font-size:.66rem;color:var(--text2);line-height:1.45;">'
      + '<strong>Category:</strong> ' + String(state.category || 'Fantasy Noun') + '<br>'
      + '<strong>Lore:</strong> ' + String(state.loreHint || 'A dust-keeper mutters this in candlelight.')
      + (revealFirst ? ('<br><strong>Keeper\'s Nudge:</strong> First letter is <span style="color:#e9c97f;">' + String(state.answer || '').charAt(0).toUpperCase() + '</span>.') : '')
      + '</div>'
      + '</div>';
  }

  function _renderWordleArcane(state, title, prompt) {
    var rows = [];
    var maxRows = Math.max(6, Number(state.maxAttempts || 6));
    for (var r = 0; r < maxRows; r++) {
      var row = state.attempts[r] || null;
      var rowLetters = [];
      var rowGuess = row ? String(row.guess || '') : (r === state.attempts.length ? String(state.current || '') : '');
      for (var c = 0; c < Number(state.wordLength || 5); c++) {
        var ch = rowGuess.charAt(c) || '';
        var status = '';
        var revealed = true;
        if (row && Array.isArray(row.result) && c < row.result.length) {
          status = String(row.result[c] || '');
          if (Array.isArray(row.revealed)) revealed = !!row.revealed[c];
        }
        var tileClass = 'arc-wordle-tile';
        if (row && revealed) tileClass += ' ' + status;
        else if (ch) tileClass += ' filled';
        var delayStyle = row ? ('animation-delay:' + (c * 90) + 'ms;') : '';
        rowLetters.push('<div class="' + tileClass + '" style="' + delayStyle + '">' + (ch ? ch.toUpperCase() : '&nbsp;') + '</div>');
      }
      rows.push('<div class="arc-wordle-row">' + rowLetters.join('') + '</div>');
    }

    var kRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    var keyboard = kRows.map(function (line) {
      return '<div class="arc-wordle-keyrow">' + line.split('').map(function (k) {
        var st = String(state.keyboard && state.keyboard[k] || '');
        return '<button class="btn btn-xs arc-wordle-key ' + st + '" onclick="window._cpAction(\'wordle_key\',\'' + k + '\')">' + k.toUpperCase() + '</button>';
      }).join('') + '</div>';
    }).join('');

    var canSubmit = state.status === 'playing' && !state.animating && String(state.current || '').length === Number(state.wordLength || 5);
    var statusLine = state.status === 'win'
      ? '<div class="arc-wordle-status win">Runeboard solved. The codex yields.</div>'
      : (state.status === 'lose'
        ? '<div class="arc-wordle-status lose">The archive seals. Word was <strong>' + String(state.answer || '').toUpperCase() + '</strong>.</div>'
        : '<div class="arc-wordle-status">Attempts: ' + Number(state.attempts.length || 0) + '/' + Number(state.maxAttempts || 6) + '</div>');

    return '<style>'
      + '.arc-wordle-shell{background:linear-gradient(165deg, rgba(20,16,12,.94), rgba(11,11,14,.96));border:1px solid rgba(215,180,117,.28);padding:.34rem .38rem;box-shadow:0 0 0 1px rgba(102,74,28,.2) inset;}'
      + '.arc-wordle-title{font-size:.78rem;color:#e6c98a;letter-spacing:.04em;margin-bottom:.1rem;}'
      + '.arc-wordle-sub{font-size:.64rem;color:var(--muted2);margin-bottom:.16rem;line-height:1.5;}'
      + '.arc-wordle-board{display:grid;gap:.12rem;justify-content:center;margin:.12rem 0 .16rem;}'
      + '.arc-wordle-row{display:grid;grid-template-columns:repeat(5,44px);gap:.12rem;justify-content:center;}'
      + '.arc-wordle-tile{height:44px;border:1px solid rgba(199,171,117,.35);background:rgba(26,23,20,.9);display:flex;align-items:center;justify-content:center;font-size:1.02rem;color:#f6eed8;font-weight:700;text-transform:uppercase;}'
      + '.arc-wordle-tile.filled{border-color:rgba(215,180,117,.65);}'
      + '.arc-wordle-tile.correct{background:#2e7448;border-color:#3fa765;animation:arcTileFlip .24s ease both;}'
      + '.arc-wordle-tile.present{background:#9b7a2e;border-color:#c49b3f;animation:arcTileFlip .24s ease both;}'
      + '.arc-wordle-tile.absent{background:#47484f;border-color:#666874;animation:arcTileFlip .24s ease both;}'
      + '.arc-wordle-keyrow{display:flex;gap:.1rem;justify-content:center;margin-bottom:.1rem;}'
      + '.arc-wordle-key{min-width:28px;padding:.22rem .2rem;font-size:.62rem;background:rgba(34,33,36,.9);border-color:rgba(255,255,255,.18);}'
      + '.arc-wordle-key.correct{background:#2e7448;border-color:#3fa765;color:#f7fff9;}'
      + '.arc-wordle-key.present{background:#9b7a2e;border-color:#c49b3f;color:#fff8e8;}'
      + '.arc-wordle-key.absent{background:#4b4d57;border-color:#707482;color:#d8dbe5;}'
      + '.arc-wordle-status{font-size:.64rem;color:var(--muted2);text-align:center;margin:.12rem 0 .08rem;}'
      + '.arc-wordle-status.win{color:var(--teal);font-weight:600;}'
      + '.arc-wordle-status.lose{color:#f2a78a;font-weight:600;}'
      + '.arc-wordle-flourish{height:4px;border:1px solid rgba(215,180,117,.35);background:linear-gradient(90deg, rgba(32,22,8,.2), rgba(225,188,112,.92), rgba(32,22,8,.2));opacity:.86;margin:.12rem 0;animation:arcFlourish .55s ease both;}'
      + '@keyframes arcTileFlip{0%{transform:rotateX(90deg);opacity:.2;}100%{transform:rotateX(0deg);opacity:1;}}'
      + '@keyframes arcFlourish{0%{transform:scaleX(.45);opacity:.2;}100%{transform:scaleX(1);opacity:.95;}}'
      + '</style>'
      + '<div class="arc-wordle-shell">'
      + '<div class="arc-wordle-title"><strong>' + String(title || 'Arcane Lexicon') + '</strong></div>'
      + '<div class="arc-wordle-sub">' + String(prompt || 'Decode the five-letter runeword hidden in the codex.') + '</div>'
      + _wordleGetHintHtml(state)
      + '<div class="arc-wordle-board">' + rows.join('') + '</div>'
      + statusLine
      + (state.status === 'win' ? '<div class="arc-wordle-flourish"></div>' : '')
      + keyboard
      + '<div style="display:flex;gap:.2rem;justify-content:center;flex-wrap:wrap;margin-top:.12rem;">'
      + '<button class="btn btn-xs" ' + (state.status === 'playing' && !state.animating ? '' : 'disabled') + ' onclick="window._cpAction(\'wordle_backspace\')">⌫</button>'
      + '<button class="btn btn-xs btn-primary" ' + (canSubmit ? '' : 'disabled') + ' onclick="window._cpAction(\'wordle_submit_guess\')">Enter</button>'
      + '<button class="btn btn-xs" onclick="window._cpAction(\'give_up\')">Give Up</button>'
      + '<button class="btn btn-xs btn-primary" ' + (state.status === 'win' || state.status === 'lose' ? '' : 'disabled') + ' onclick="window._cpAction(\'submit\')">Finish</button>'
      + '</div>'
      + '</div>';
  }

  function _wordleClearTimers(state) {
    if (!state || !Array.isArray(state.timeoutIds)) return;
    while (state.timeoutIds.length) {
      var tid = state.timeoutIds.pop();
      try { clearTimeout(tid); } catch (_err) { console.error(_err); }
    }
  }

  function _wordleBindKeys(enable) {
    if (typeof window === 'undefined') return;
    if (!window.__arcWordleKeyHandler) {
      window.__arcWordleKeyHandler = function (evt) {
        if (!_cp || _cp.mode !== 'wordle_arcane' || !_cp.state) return;
        var key = String(evt && evt.key || '').toLowerCase();
        if (!key) return;
        if (key === 'enter') {
          evt.preventDefault();
          window._cpAction('wordle_submit_guess');
          return;
        }
        if (key === 'backspace') {
          evt.preventDefault();
          window._cpAction('wordle_backspace');
          return;
        }
        if (/^[a-z]$/.test(key)) {
          evt.preventDefault();
          window._cpAction('wordle_key', key);
        }
      };
    }
    if (enable) {
      if (!window.__arcWordleKeyBound) {
        window.addEventListener('keydown', window.__arcWordleKeyHandler);
        window.__arcWordleKeyBound = true;
      }
    } else if (window.__arcWordleKeyBound) {
      window.removeEventListener('keydown', window.__arcWordleKeyHandler);
      window.__arcWordleKeyBound = false;
    }
  }

  function _renderCustomPuzzle() {
    if (!_cp) return;
    var s = _cp.state;
    var t = _cp.title || 'Puzzle';
    var p = _cp.prompt || 'Solve the puzzle.';
    var html = '';
    if (_cp.mode === 'pipe_flow')        html = _renderPipeFlow(s, t, p);
    else if (_cp.mode === 'chess_puzzle')  html = _renderChess(s, t, p);
    else if (_cp.mode === 'sliding_tile')  html = _renderSliding(s, t, p);
    else if (_cp.mode === 'math_grid')     html = _renderMathGrid(s, t, p);
    else if (_cp.mode === 'rotating_image') html = _renderRotatingImage(s, t, p);
    else if (_cp.mode === 'wordle_arcane') html = _renderWordleArcane(s, t, p);
    _wordleBindKeys(_cp.mode === 'wordle_arcane');
    if (typeof openModal === 'function') openModal(t, html);
  }

  window._cpAction = function(action, arg1, arg2) {
    if (!_cp) return;
    var s = _cp.state;
    if (action === 'give_up') {
      if (_cp && _cp.mode === 'wordle_arcane' && _cp.state) _wordleClearTimers(_cp.state);
      _wordleBindKeys(false);
      _cp = null;
      if (typeof closeModal === 'function') closeModal();
      finishSharedPuzzle(false);
      return;
    }
    if (action === 'submit') {
      if (_cp && _cp.mode === 'wordle_arcane' && _cp.state) _wordleClearTimers(_cp.state);
      _wordleBindKeys(false);
      _cp = null;
      if (typeof closeModal === 'function') closeModal();
      finishSharedPuzzle(true);
      return;
    }
    if (action === 'pipe_rotate') {
      var idx = Number(arg1);
      if (s.tiles[idx] && !s.tiles[idx].locked) s.tiles[idx].rotation = ((s.tiles[idx].rotation || 0) + 1) % 4;
      _renderCustomPuzzle(); return;
    }
    if (action === 'chess_capture') {
      var pIdx = Number(arg1);
      var pawn = s.pawns[pIdx];
      if (_pieceCanCapture(s, pawn)) {
        s.captured.push(pIdx);
        s.rook = { r: pawn.r, c: pawn.c };
      }
      _renderCustomPuzzle(); return;
    }
    if (action === 'slide') {
      var tIdx = Number(arg1);
      var blankIdx = s.tiles.indexOf(0);
      var N = s.size;
      var tr2 = Math.floor(tIdx / N), tc2 = tIdx % N;
      var br2 = Math.floor(blankIdx / N), bc2 = blankIdx % N;
      if (Math.abs(tr2 - br2) + Math.abs(tc2 - bc2) === 1) {
        var tmp = s.tiles[tIdx]; s.tiles[tIdx] = 0; s.tiles[blankIdx] = tmp;
      }
      _renderCustomPuzzle(); return;
    }
    if (action === 'math_input') {
      s.inputs[Number(arg1)] = String(arg2 || '');
      _renderCustomPuzzle(); return;
    }
    if (action === 'rotate_seg') {
      s.segments[Number(arg1)].rot = (s.segments[Number(arg1)].rot + 1) % 4;
      _renderCustomPuzzle(); return;
    }
    if (action === 'wordle_key') {
      if (s.status !== 'playing' || s.animating) return;
      var key = String(arg1 || '').toLowerCase();
      if (!/^[a-z]$/.test(key)) return;
      if (String(s.current || '').length >= Number(s.wordLength || 5)) return;
      s.current = String(s.current || '') + key;
      _renderCustomPuzzle(); return;
    }
    if (action === 'wordle_backspace') {
      if (s.status !== 'playing' || s.animating) return;
      var cur = String(s.current || '');
      s.current = cur.length ? cur.slice(0, -1) : '';
      _renderCustomPuzzle(); return;
    }
    if (action === 'wordle_submit_guess') {
      if (s.status !== 'playing' || s.animating) return;
      var guess = String(s.current || '').toLowerCase();
      if (guess.length !== Number(s.wordLength || 5)) {
        if (typeof showNotif === 'function') showNotif('Enter a full 5-letter runeword.', 'warn');
        return;
      }
      if (Array.isArray(s.allowedWords) && s.allowedWords.indexOf(guess) < 0) {
        if (typeof showNotif === 'function') showNotif('That word is not in the codex lexicon.', 'warn');
        return;
      }
      var result = _scoreWordleGuess(guess, s.answer);
      var row = { guess: guess, result: result, revealed: [false, false, false, false, false] };
      s.attempts.push(row);
      s.current = '';
      s.animating = true;
      _wordleClearTimers(s);
      for (var i = 0; i < result.length; i++) {
        (function (idx) {
          var tid = setTimeout(function () {
            row.revealed[idx] = true;
            var letter = guess.charAt(idx);
            s.keyboard[letter] = _wordleRankColor(s.keyboard[letter], result[idx]);
            _renderCustomPuzzle();
          }, idx * 120);
          s.timeoutIds.push(tid);
        })(i);
      }
      var doneId = setTimeout(function () {
        s.animating = false;
        if (guess === s.answer) {
          s.status = 'win';
          if (typeof showNotif === 'function') showNotif('Arcane word solved.', 'good');
        } else if (s.attempts.length >= Number(s.maxAttempts || 6)) {
          s.status = 'lose';
          if (typeof showNotif === 'function') showNotif('The codex seals shut. Word was ' + String(s.answer || '').toUpperCase() + '.', 'warn');
        }
        _renderCustomPuzzle();
      }, (result.length * 120) + 40);
      s.timeoutIds.push(doneId);
      _renderCustomPuzzle();
      return;
    }
  };

  var CUSTOM_PUZZLE_MODES = ['pipe_flow', 'chess_puzzle', 'sliding_tile', 'math_grid', 'rotating_image', 'wordle_arcane'];

  function openSharedPuzzleChallenge(config) {
    const st = ensurePuzzleState();
    if (!st) return false;

    const source = String((config && config.source) || "event").toLowerCase();
    const pool = PUZZLES[source] || PUZZLES.event;
    var chosen = Object.assign({}, safePick(pool, pool[0]));
    if (pool.length > 1 && st.lastPuzzleTitle && String(chosen.title || '') === String(st.lastPuzzleTitle || '')) {
      var filtered = pool.filter(function (p) { return String(p && p.title || '') !== String(st.lastPuzzleTitle || ''); });
      if (filtered.length) chosen = Object.assign({}, safePick(filtered, filtered[0]));
    }
    if (config && config.mode) chosen.mode = String(config.mode);
    if (config && Array.isArray(config.gridTemplate)) chosen.gridTemplate = config.gridTemplate.slice();
    if (config && Array.isArray(config.clues)) chosen.clues = config.clues.slice();
    if (config && Array.isArray(config.sudokuPuzzle)) chosen.sudokuPuzzle = config.sudokuPuzzle;
    if (config && Array.isArray(config.sudokuSolution)) chosen.sudokuSolution = config.sudokuSolution;
    if (config && Array.isArray(config.mazeLayout)) chosen.mazeLayout = config.mazeLayout;
    if (config && config.chessState && typeof config.chessState === 'object') chosen.chessState = config.chessState;
    const title = (config && config.title) || chosen.title || "Shared Puzzle";
    const prompt = (config && config.prompt) || chosen.prompt || "Solve the prompt.";
    const answer = normalizeAnswer((config && config.answer) || chosen.answer || "");
    const reward = Object.assign({ credits: 30, renown: 0, item: "Puzzle Token" }, (config && config.reward) || {});

    st.active = {
      source: source,
      answer: answer,
      reward: reward,
      onSuccess: config ? config.onSuccess : null,
      onFail: config ? config.onFail : null,
      mode: chosen.mode || ''
    };
    st.lastPuzzleTitle = String(title || 'Shared Puzzle');

    if (chosen.mode && CUSTOM_PUZZLE_MODES.indexOf(chosen.mode) >= 0) {
      var chessPreferred = null;
      var presetChess = null;
      if (chosen.mode === 'chess_puzzle') {
        chessPreferred = _nextChessPieceForSession(st);
        if (chosen.chessState && typeof chosen.chessState === 'object') {
          presetChess = JSON.parse(JSON.stringify(chosen.chessState));
          if (!_isChessStateSolvable(presetChess)) {
            presetChess = null;
          }
        }
      }
      _cp = {
        mode: chosen.mode,
        title: title,
        prompt: prompt,
        state: chosen.mode === 'pipe_flow' ? buildPipeFlowState()
          : chosen.mode === 'chess_puzzle'
            ? (presetChess || _initChess(chessPreferred))
          : chosen.mode === 'sliding_tile' ? _initSliding()
          : chosen.mode === 'math_grid' ? _initMathGrid()
          : chosen.mode === 'wordle_arcane' ? _initWordleArcane()
          : _initRotatingImage()
      };
      _renderCustomPuzzle();
      return true;
    }

    if (chosen.mode && typeof window.openStandaloneStoryPuzzle === "function") {
      window.openStandaloneStoryPuzzle({
        mode: chosen.mode,
        title: title,
        prompt: prompt,
        answer: answer,
        clues: chosen.clues,
        gridTemplate: chosen.gridTemplate,
        mazeLayout: chosen.mazeLayout,
        sudokuPuzzle: chosen.sudokuPuzzle,
        sudokuSolution: chosen.sudokuSolution,
        thresholdLabel: 'Shared Puzzle',
        successThreshold: 0.7,
        partialThreshold: 0.45,
        onResolve: function (result) {
          finishSharedPuzzle(result === 'success' || result === 'partial');
        }
      });
      return true;
    }

    const html = ""
      + "<div style='font-size:.84rem;color:var(--text2);line-height:1.6;margin-bottom:.4rem;'>"
      + "<strong style='color:var(--gold2);'>" + title + "</strong><br>"
      + prompt
      + "</div>"
      + "<input id='sharedPuzzleInput' class='input' placeholder='Enter answer' style='width:100%;margin-bottom:.45rem;'/>"
      + "<div style='display:flex;gap:.35rem;justify-content:flex-end;'>"
      + "<button class='btn btn-sm' onclick='resolveSharedPuzzle(false)'>Skip</button>"
      + "<button class='btn btn-sm btn-primary' onclick='resolveSharedPuzzle(true)'>Submit</button>"
      + "</div>";

    if (typeof openModal === "function") openModal("Shared Puzzle", html);
    return true;
  }

  function resolveSharedPuzzle(submit) {
    const st = ensurePuzzleState();
    if (!st || !st.active) return;
    const active = st.active;

    let success = false;
    if (submit) {
      const el = document.getElementById("sharedPuzzleInput");
      const typed = normalizeAnswer(el && typeof el.value === "string" ? el.value : "");
      success = typed === active.answer;
    }

    if (typeof closeModal === "function") closeModal();
    finishSharedPuzzle(success);
  }

  function maybeSpawnSharedPuzzle(source, chance, reward) {
    if (safeRoll(100) > Math.max(1, Math.min(100, Number(chance || 35)))) return false;
    return openSharedPuzzleChallenge({ source: source, reward: reward || {} });
  }

  function patchFunction(name, wrapper) {
    const fn = window[name];
    if (typeof fn !== "function") return;
    if (window["__sharedPuzzlePatched_" + name]) return;
    window["__sharedPuzzlePatched_" + name] = true;
    window[name] = function () {
      const args = Array.prototype.slice.call(arguments);
      const out = fn.apply(this, args);
      try { wrapper(args, out); } catch (err) { console.error(err); }
      return out;
    };
  }

  function patchAll() {
    patchFunction("completeEventChallenge", function () {
      maybeSpawnSharedPuzzle("province", 40, { credits: 35, renown: 1, item: "Province Puzzle Cache" });
    });
    patchFunction("resolveEventAction", function () {
      maybeSpawnSharedPuzzle("event", 30, { credits: 25, item: "Event Cipher" });
    });
    patchFunction("resolveEventLeadAction", function () {
      maybeSpawnSharedPuzzle("event", 30, { credits: 25, item: "Lead Brief" });
    });
    patchFunction("completeSeaTask", function () {
      maybeSpawnSharedPuzzle("sea", 45, { credits: 45, renown: 1, item: "Sea Relic Shard" });
    });
    patchFunction("resolveGalaxyTaskOutcome", function (args) {
      if (args[1] === true) maybeSpawnSharedPuzzle("galaxy", 45, { credits: 50, renown: 1, item: "Star Cipher" });
    });
    patchFunction("resolvePlanetTask", function (args) {
      if (args[1] === true) maybeSpawnSharedPuzzle("planet", 45, { credits: 45, renown: 1, item: "Planet Cache" });
    });
    patchFunction("resolveZoneEvent", function () {
      maybeSpawnSharedPuzzle("wtw", 35, { credits: 40, renown: 1, item: "District Puzzle Key" });
    });
    patchFunction("resolveDistrictEncounter", function () {
      maybeSpawnSharedPuzzle("wtw", 30, { credits: 30, item: "Encounter Fragment" });
    });
    patchFunction("completeHoldingTask", function () {
      maybeSpawnSharedPuzzle("task", 35, { credits: 40, renown: 1, item: "Task Cipher" });
    });
    patchFunction("completeTaskAtHex", function () {
      maybeSpawnSharedPuzzle("task", 35, { credits: 30, renown: 1, item: "Province Task Seal" });
    });
    patchFunction("completeRoyalTask", function () {
      maybeSpawnSharedPuzzle("task", 40, { credits: 35, renown: 1, item: "Royal Writ" });
    });
    patchFunction("onHoldingCouncilTaskResolved", function (args) {
      if (args[1] === true) maybeSpawnSharedPuzzle("holding", 45, { credits: 50, renown: 1, item: "Council Charter" });
    });
  }

  window.openSharedPuzzleChallenge = openSharedPuzzleChallenge;
  window.resolveSharedPuzzle = resolveSharedPuzzle;
  window.maybeSpawnSharedPuzzle = maybeSpawnSharedPuzzle;

  patchAll();
})();
