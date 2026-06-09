(function () {
  function isGMMode() {
    try {
      return !!(window.settingsSystem && typeof window.settingsSystem.isGMMode === 'function' && window.settingsSystem.isGMMode());
    } catch (_err) {
      return false;
    }
  }

  function randomOf(list) {
    if (!Array.isArray(list) || !list.length) return '';
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  function weightedChoice(entries) {
    if (!Array.isArray(entries) || !entries.length) return null;
    var total = 0;
    entries.forEach(function (e) { total += Number(e.weight || 0); });
    if (total <= 0) return entries[0] || null;
    var roll = Math.random() * total;
    var sum = 0;
    for (var i = 0; i < entries.length; i += 1) {
      sum += Number(entries[i].weight || 0);
      if (roll <= sum) return entries[i];
    }
    return entries[entries.length - 1] || null;
  }

  function uid(prefix) {
    return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e5).toString(36);
  }

  function tryReadGlobal(name) {
    try {
      return Function('return (typeof ' + String(name) + ' !== "undefined") ? ' + String(name) + ' : undefined;')();
    } catch (_err) {
      return undefined;
    }
  }

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensureState() {
    if (typeof window.S === 'undefined' || !window.S) window.S = {};
    var base = window.S.gmWorldbuilder || {};
    window.S.gmWorldbuilder = {
      genre: String(base.genre || 'Dark Fantasy'),
      storyPrompt: String(base.storyPrompt || ''),
      monsterBlock: String(base.monsterBlock || ''),
      levels: Array.isArray(base.levels) ? base.levels : [],
      locations: Array.isArray(base.locations) ? base.locations : [],
      portals: Array.isArray(base.portals) ? base.portals : [],
      characters: Array.isArray(base.characters) ? base.characters : [],
      things: Array.isArray(base.things) ? base.things : [],
      stickyNotes: Array.isArray(base.stickyNotes) ? base.stickyNotes : [],
      checklists: Array.isArray(base.checklists) ? base.checklists : [],
      connections: Array.isArray(base.connections) ? base.connections : [],
      graphDraftFrom: String(base.graphDraftFrom || ''),
      graphDraftEdge: String(base.graphDraftEdge || ''),
      contextMenu: (base.contextMenu && typeof base.contextMenu === 'object') ? base.contextMenu : null,
      nameStyle: String(base.nameStyle || 'weighted')
    };

    window.S.gmWorldbuilder.characters.forEach(function (c) {
      c.locationId = String(c.locationId || '');
      c.type = String(c.type || 'NPC');
    });
    window.S.gmWorldbuilder.locations.forEach(function (l, idx) {
      l.levelId = String(l.levelId || '');
      l.order = Number(l.order || idx + 1);
    });
    window.S.gmWorldbuilder.portals.forEach(function (p) {
      p.direction = (String(p.direction || 'oneway') === 'twoway') ? 'twoway' : 'oneway';
    });
    window.S.gmWorldbuilder.things.forEach(function (t) {
      t.locationId = String(t.locationId || '');
      t.ownerCharacterId = String(t.ownerCharacterId || '');
      t.owner = String(t.owner || '');
    });
    return window.S.gmWorldbuilder;
  }

  var NAME_PACKS = {
    Spanish: {
      given: ['Iria', 'Mateo', 'Lucia', 'Tomas', 'Rocio', 'Sergio', 'Adela', 'Gael', 'Ines', 'Pablo', 'Lola', 'Javier', 'Nuria', 'Alvaro', 'Marta', 'Hector', 'Leire', 'Xavier'],
      family: ['Valdes', 'Ortega', 'Mendoza', 'Cortez', 'Navarro', 'Santos', 'Rivas', 'Delmar', 'Solano', 'Lorca', 'Quintero', 'Beltran'],
      styles: [{ key: 'weighted', weight: 60 }, { key: 'formal', weight: 22 }, { key: 'clan', weight: 18 }]
    },
    Inuit: {
      given: ['Aputi', 'Nuka', 'Siku', 'Panik', 'Nanuq', 'Qannik', 'Ivalu', 'Tulimaq', 'Kallik', 'Anik', 'Pitsi', 'Sanna', 'Taqi', 'Miki', 'Uyarak'],
      family: ['Kalluk', 'Nutarak', 'Sinaaq', 'Pipaluk', 'Tariuq', 'Iksu', 'Aqiaruq', 'Navik'],
      styles: [{ key: 'weighted', weight: 54 }, { key: 'single', weight: 30 }, { key: 'formal', weight: 16 }]
    },
    Persian: {
      given: ['Arash', 'Darya', 'Mehrdad', 'Soraya', 'Rostam', 'Parisa', 'Kian', 'Laleh', 'Shirin', 'Farid', 'Nima', 'Roya', 'Arman', 'Kamran', 'Azar'],
      family: ['Darvishi', 'Vaziri', 'Farzan', 'Nabavi', 'Kashani', 'Aminpour', 'Mehrabi', 'Rostami', 'Dastan'],
      styles: [{ key: 'weighted', weight: 55 }, { key: 'formal', weight: 30 }, { key: 'poetic', weight: 15 }]
    },
    Egyptian: {
      given: ['Amunet', 'Seti', 'Neferu', 'Khepri', 'Iset', 'Djoser', 'Merit', 'Bastet', 'Ramsen', 'Tahira', 'Ankhu', 'Sahra', 'Menet'],
      family: ['Of Karnak', 'Of The Nile Gate', 'Of Sun Court', 'Ibn Set', 'Of Red Dunes', 'Of The Fifth Obelisk'],
      styles: [{ key: 'weighted', weight: 45 }, { key: 'formal', weight: 35 }, { key: 'honorific', weight: 20 }]
    },
    Navajo: {
      given: ['Ashkii', 'Yazhi', 'Atsa', 'Tadita', 'Hastiin', 'Nizhoni', 'Kai', 'Atsaidi', 'Nataani', 'Tliish', 'Shiye', 'Yiska'],
      family: ['Begay', 'Nez', 'Bitsui', 'Tsosie', 'Manygoats', 'Chee', 'Begaye', 'Benally'],
      styles: [{ key: 'weighted', weight: 58 }, { key: 'single', weight: 20 }, { key: 'formal', weight: 22 }]
    },
    Japanese: {
      given: ['Akira', 'Ren', 'Yui', 'Kaede', 'Sora', 'Haru', 'Mio', 'Takumi', 'Aoi', 'Kaito', 'Rin', 'Nagi', 'Yuna', 'Daichi', 'Hina', 'Jun'],
      family: ['Sato', 'Kobayashi', 'Tanaka', 'Kuroda', 'Ishikawa', 'Shimada', 'Asakura', 'Nakamori', 'Fujita'],
      styles: [{ key: 'weighted', weight: 62 }, { key: 'formal', weight: 28 }, { key: 'single', weight: 10 }]
    },
    Celtic: {
      given: ['Eira', 'Bran', 'Maeve', 'Cian', 'Nessa', 'Ronan', 'Orla', 'Taran', 'Aisling', 'Finnan', 'Keira', 'Brennan', 'Iona'],
      family: ['MacRath', 'O Doran', 'O Cael', 'Briarwyn', 'Keenreach', 'Mournvale', 'Carrig'],
      styles: [{ key: 'weighted', weight: 52 }, { key: 'clan', weight: 33 }, { key: 'single', weight: 15 }]
    },
    Slavic: {
      given: ['Mira', 'Viktor', 'Anya', 'Boris', 'Ilya', 'Nadia', 'Sasha', 'Yelena', 'Dmitri', 'Vera', 'Lev', 'Irina', 'Maksim'],
      family: ['Volkov', 'Morozov', 'Petrenko', 'Sidorov', 'Kravets', 'Dragunov', 'Belik', 'Novik'],
      styles: [{ key: 'weighted', weight: 62 }, { key: 'formal', weight: 28 }, { key: 'single', weight: 10 }]
    },
    Norse: {
      given: ['Astrid', 'Leif', 'Freya', 'Ivar', 'Sigrid', 'Bjorn', 'Runa', 'Eirik', 'Alva', 'Kjell', 'Solveig', 'Sten', 'Yrsa'],
      family: ['Skallson', 'Stormhand', 'Ravenmark', 'Northvein', 'Ulfar', 'Iceward'],
      styles: [{ key: 'weighted', weight: 46 }, { key: 'clan', weight: 34 }, { key: 'single', weight: 20 }]
    },
    Yoruba: {
      given: ['Ade', 'Kemi', 'Tunde', 'Sade', 'Bola', 'Ayo', 'Femi', 'Nia', 'Temi', 'Bisi', 'Tayo', 'Yemi'],
      family: ['Adebayo', 'Ogunleye', 'Balogun', 'Akinola', 'Adeyemi', 'Oladele'],
      styles: [{ key: 'weighted', weight: 58 }, { key: 'formal', weight: 30 }, { key: 'single', weight: 12 }]
    },
    Arabic: {
      given: ['Samir', 'Layla', 'Rashid', 'Noura', 'Karim', 'Amal', 'Zayd', 'Hana', 'Farah', 'Yasin', 'Salma', 'Idris'],
      family: ['Al Rafi', 'Ibn Wadi', 'Al Nasri', 'Darim', 'Ibn Najm', 'Al Qamar'],
      styles: [{ key: 'weighted', weight: 55 }, { key: 'formal', weight: 35 }, { key: 'single', weight: 10 }]
    },
    Turkish: {
      given: ['Deniz', 'Eren', 'Aylin', 'Baran', 'Selin', 'Kaan', 'Merve', 'Emir', 'Leyla', 'Orhan', 'Ipek', 'Can'],
      family: ['Yilmaz', 'Aydin', 'Demir', 'Kaya', 'Kurt', 'Sahin', 'Aslan'],
      styles: [{ key: 'weighted', weight: 60 }, { key: 'formal', weight: 30 }, { key: 'single', weight: 10 }]
    },
    Hindi: {
      given: ['Asha', 'Rohan', 'Mira', 'Kiran', 'Anil', 'Ishani', 'Dev', 'Leela', 'Arjun', 'Nisha', 'Vikram', 'Priya'],
      family: ['Patel', 'Sharma', 'Rao', 'Singh', 'Verma', 'Kapoor', 'Das'],
      styles: [{ key: 'weighted', weight: 61 }, { key: 'formal', weight: 29 }, { key: 'single', weight: 10 }]
    },
    Bengali: {
      given: ['Ila', 'Anik', 'Ritu', 'Suman', 'Mita', 'Rafi', 'Nabin', 'Tuli', 'Arka', 'Joya', 'Rana', 'Bani'],
      family: ['Sen', 'Basu', 'Datta', 'Roy', 'Bose', 'Sarkar', 'Chowdhury'],
      styles: [{ key: 'weighted', weight: 60 }, { key: 'formal', weight: 27 }, { key: 'single', weight: 13 }]
    },
    Chinese: {
      given: ['Liang', 'Mei', 'Jin', 'Yue', 'Qiao', 'Wei', 'Xin', 'Lan', 'Bo', 'Hua', 'Feng', 'Rui'],
      family: ['Li', 'Wang', 'Zhao', 'Chen', 'Xu', 'Zhou', 'Lin', 'Guo'],
      styles: [{ key: 'weighted', weight: 57 }, { key: 'formal', weight: 33 }, { key: 'single', weight: 10 }]
    },
    Korean: {
      given: ['Min', 'Seo', 'Jin', 'Hana', 'Joon', 'Sora', 'Yuna', 'Taek', 'Nari', 'Hyun', 'Dae', 'Ara'],
      family: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Han'],
      styles: [{ key: 'weighted', weight: 58 }, { key: 'formal', weight: 34 }, { key: 'single', weight: 8 }]
    },
    Thai: {
      given: ['Anong', 'Kiet', 'Mali', 'Niran', 'Pim', 'Suda', 'Chai', 'Kanya', 'Som', 'Rin'],
      family: ['Suwan', 'Kraisri', 'Boonmee', 'Rattan', 'Jintana', 'Sombat'],
      styles: [{ key: 'weighted', weight: 60 }, { key: 'formal', weight: 25 }, { key: 'single', weight: 15 }]
    },
    Vietnamese: {
      given: ['Minh', 'Lan', 'Bao', 'Thao', 'Quang', 'Linh', 'Huy', 'Mai', 'Trung', 'Vy'],
      family: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dang'],
      styles: [{ key: 'weighted', weight: 64 }, { key: 'formal', weight: 28 }, { key: 'single', weight: 8 }]
    },
    Swahili: {
      given: ['Amani', 'Jabari', 'Zuri', 'Kato', 'Nia', 'Baraka', 'Imani', 'Rafiki', 'Kesi', 'Tamu'],
      family: ['Mwinyi', 'Juma', 'Kassim', 'Bakari', 'Mosi', 'Tumaini'],
      styles: [{ key: 'weighted', weight: 56 }, { key: 'formal', weight: 24 }, { key: 'single', weight: 20 }]
    },
    Ethiopian: {
      given: ['Dawit', 'Lulit', 'Bekele', 'Selam', 'Tigist', 'Yonatan', 'Meklit', 'Abel', 'Meron'],
      family: ['Tesfaye', 'Bekele', 'Hailu', 'Kebede', 'Alemu', 'Abate'],
      styles: [{ key: 'weighted', weight: 60 }, { key: 'formal', weight: 30 }, { key: 'single', weight: 10 }]
    },
    Hausa: {
      given: ['Aminu', 'Zainab', 'Ibrahim', 'Hadiza', 'Sani', 'Maryam', 'Bello', 'Aisha', 'Musa', 'Rabi'],
      family: ['Lawal', 'Sule', 'Garba', 'Usman', 'Bala', 'Adamu'],
      styles: [{ key: 'weighted', weight: 59 }, { key: 'formal', weight: 31 }, { key: 'single', weight: 10 }]
    },
    Greek: {
      given: ['Nikos', 'Eleni', 'Dorian', 'Thalia', 'Iris', 'Petros', 'Lyra', 'Alexis', 'Daphne', 'Kostas'],
      family: ['Papadopoulos', 'Karalis', 'Theon', 'Nikolaou', 'Vassos', 'Ariston'],
      styles: [{ key: 'weighted', weight: 54 }, { key: 'formal', weight: 29 }, { key: 'single', weight: 17 }]
    },
    Roman: {
      given: ['Cassia', 'Lucan', 'Tiber', 'Marcellus', 'Livia', 'Aurelia', 'Silvan', 'Flavia', 'Cato'],
      family: ['Valerius', 'Severus', 'Octavian', 'Drusus', 'Varro', 'Corvinus'],
      styles: [{ key: 'weighted', weight: 47 }, { key: 'formal', weight: 35 }, { key: 'honorific', weight: 18 }]
    },
    Gaelic: {
      given: ['Sorcha', 'Aedan', 'Niamh', 'Conall', 'Brigid', 'Eoin', 'Fiora', 'Padraig', 'Ruairi'],
      family: ['MacAuley', 'O Suilleabhain', 'MacRae', 'O Briain', 'MacDara', 'O Faolain'],
      styles: [{ key: 'weighted', weight: 53 }, { key: 'clan', weight: 34 }, { key: 'single', weight: 13 }]
    },
    Basque: {
      given: ['Ane', 'Iker', 'Leire', 'Unai', 'Naroa', 'Aitor', 'June', 'Xabi', 'Mikel'],
      family: ['Etxeberria', 'Arrieta', 'Aizpuru', 'Mendieta', 'Ibarra', 'Goiko'],
      styles: [{ key: 'weighted', weight: 63 }, { key: 'formal', weight: 27 }, { key: 'single', weight: 10 }]
    },
    Polynesian: {
      given: ['Moana', 'Koa', 'Lani', 'Nalu', 'Ikaika', 'Aroha', 'Noa', 'Keoni', 'Hoku'],
      family: ['Of Tides', 'Ahi', 'Kai', 'Moeru', 'Taniko', 'Wai'],
      styles: [{ key: 'weighted', weight: 50 }, { key: 'single', weight: 30 }, { key: 'formal', weight: 20 }]
    },
    Indigenous_American: {
      given: ['Takoda', 'Aiyana', 'Kiona', 'Mika', 'Elsu', 'Nodin', 'Wapi', 'Nokosi', 'Tala'],
      family: ['Gray River', 'Red Cedar', 'Stone Elk', 'Winter Hawk', 'Tall Reed', 'Iron Creek'],
      styles: [{ key: 'weighted', weight: 56 }, { key: 'single', weight: 28 }, { key: 'formal', weight: 16 }]
    },
    Armenian: {
      given: ['Aram', 'Mariam', 'Levon', 'Ani', 'Suren', 'Nare', 'Tigran', 'Lilit', 'Vardan'],
      family: ['Petrosyan', 'Sarkisian', 'Harutyun', 'Mkrtchyan', 'Davtyan', 'Grigoryan'],
      styles: [{ key: 'weighted', weight: 62 }, { key: 'formal', weight: 30 }, { key: 'single', weight: 8 }]
    },
    Georgian: {
      given: ['Nika', 'Tamar', 'Giorgi', 'Mariam', 'Dato', 'Luka', 'Sopo', 'Irakli', 'Ana'],
      family: ['Beridze', 'Kapanadze', 'Mchedlidze', 'Dvali', 'Gelashvili', 'Tsiklauri'],
      styles: [{ key: 'weighted', weight: 61 }, { key: 'formal', weight: 29 }, { key: 'single', weight: 10 }]
    }
  };

  var GENRES = ['Dark Fantasy', 'Sword And Sorcery', 'Post-Apocalyptic', 'Cosmic Horror', 'Dieselpunk', 'Folkloric Mystery', 'Mythic Sci-Fi', 'Nautical Ruinpunk'];

  function storyPromptForGenre(genre) {
    var byGenre = {
      'Dark Fantasy': [
        'A covenant city survives by sacrificing one memory from each traveler at its gates.',
        'A sainted relic starts speaking in a rival voice and names one PC as its next vessel.'
      ],
      'Sword And Sorcery': [
        'A warlord offers peace if the party steals a map from a cathedral vault.',
        'A sand-market auction sells a storm bound in iron bells.'
      ],
      'Post-Apocalyptic': [
        'A cracked reactor keeps a settlement warm, but each cycle mutates one district.',
        'A convoy vanished on a safe route and left only polished footprints.'
      ],
      'Cosmic Horror': [
        'A moonless tide exposes stairs descending into a singing void.',
        'Astronomers map a star that moves only when no one watches it.'
      ]
    };
    var fallback = [
      'A patron asks the party to broker peace between two places connected by a forbidden portal.',
      'A missing NPC returns with accurate memories of a timeline that never happened.'
    ];
    return randomOf(byGenre[String(genre || '')] || fallback);
  }

  function buildMonsterBlock(genre) {
    var codexByRegion = null;
    if (typeof window.getCodexBestiaryByRegion === 'function') {
      try { codexByRegion = window.getCodexBestiaryByRegion(); } catch (_err) {}
    }
    if (!codexByRegion || typeof codexByRegion !== 'object') {
      var fn = tryReadGlobal('getCodexBestiaryByRegion');
      if (typeof fn === 'function') {
        try { codexByRegion = fn(); } catch (_err2) {}
      }
    }

    var allEntries = [];
    if (codexByRegion && typeof codexByRegion === 'object') {
      Object.keys(codexByRegion).forEach(function (region) {
        var list = codexByRegion[region];
        if (!Array.isArray(list)) return;
        list.forEach(function (entry) {
          if (!entry || typeof entry !== 'object') return;
          allEntries.push(Object.assign({ _region: String(region) }, entry));
        });
      });
    }

    var named = tryReadGlobal('NAMED_ENEMY_BESTIARY');
    if (named && typeof named === 'object') {
      Object.keys(named).forEach(function (region) {
        var list = named[region];
        if (!Array.isArray(list)) return;
        list.forEach(function (entry) {
          if (!entry || typeof entry !== 'object') return;
          allEntries.push(Object.assign({ _region: String(region) }, entry));
        });
      });
    }

    var profile = allEntries.length ? randomOf(allEntries) : null;
    var region = String((profile && profile._region) || 'unknown');
    var name = String((profile && profile.name) || ('Generated ' + genre + ' threat'));
    var desc = String((profile && profile.desc) || 'No codex flavor available.');

    var dd = 6;
    var deriveFn = (typeof window.getBestiaryDerivedStats === 'function')
      ? window.getBestiaryDerivedStats
      : tryReadGlobal('getBestiaryDerivedStats');
    if (typeof deriveFn === 'function' && profile) {
      try {
        var derived = deriveFn(profile);
        dd = Math.max(4, Math.min(12, Number((derived && derived.dread) || dd)));
      } catch (_err3) {}
    } else if (profile) {
      var hp = Number(profile.hp || profile.health || 0);
      var fromEntry = Number(profile.dread || profile.dd || 0);
      dd = fromEntry > 0 ? fromEntry : Math.ceil(Math.max(4, hp) / 2);
      dd = Math.max(4, Math.min(12, dd));
    }

    var stress = dd * 2;
    var deathNumber = dd;

    var allSkills = [];
    allEntries.forEach(function (entry) {
      if (!entry) return;
      var generatedNames = (typeof window.getBestiaryEntrySkillNames === 'function')
        ? window.getBestiaryEntrySkillNames(entry)
        : [];
      if (Array.isArray(generatedNames) && generatedNames.length) {
        generatedNames.forEach(function (name) {
          var txt = String(name || '').trim();
          if (txt) allSkills.push(txt);
        });
        return;
      }
      if (!Array.isArray(entry.skills)) return;
      entry.skills.forEach(function (skill) {
        if (!skill) return;
        if (typeof skill === 'string') {
          allSkills.push(skill.trim());
          return;
        }
        var skillName = String(skill.name || '').trim();
        var skillDesc = String(skill.desc || skill.onFail || '').trim();
        if (!skillName && !skillDesc) return;
        allSkills.push(skillName ? (skillName + ': ' + skillDesc) : skillDesc);
      });
    });
    allSkills = Array.from(new Set(allSkills.filter(Boolean)));

    var skillA = allSkills.length ? randomOf(allSkills) : 'Codex skill unavailable.';
    var skillBPool = allSkills.filter(function (s) { return s !== skillA; });
    var skillB = skillBPool.length ? randomOf(skillBPool) : skillA;

    return 'Genre: ' + genre + ' | Region: ' + region + '\n'
      + 'Monster: ' + name + '\n'
      + desc + '\n'
      + 'Force 12 | Cunning 5 | Resolve 10 | Defend 12\n'
      + 'DD' + dd + ' | ' + stress + ' Stress | ' + deathNumber + ' Death Number\n'
      + 'Rule: A single hit reaching Death Number (' + deathNumber + ') kills immediately; otherwise deal total Stress (' + stress + ') to kill.\n'
      + 'Skills: ' + skillA + ' / ' + skillB;
  }

  function getMerchantItems() {
    var out = [];
    try {
      var data = window.SHOP_DATA || tryReadGlobal('SHOP_DATA') || null;
      if (!data || typeof data !== 'object') return out;
      Object.keys(data).forEach(function (k) {
        var arr = data[k];
        if (!Array.isArray(arr)) return;
        arr.forEach(function (it) {
          if (!it || !it.name) return;
          out.push({
            name: String(it.name),
            category: String(k),
            desc: String(it.desc || ''),
            cost: Number(it.cost || 0)
          });
        });

        var customGetter = (typeof window.getCustomCodexShopItems === 'function')
          ? window.getCustomCodexShopItems
          : tryReadGlobal('getCustomCodexShopItems');
        if (typeof customGetter === 'function') {
          var customItems = customGetter(k);
          if (Array.isArray(customItems)) {
            customItems.forEach(function (it) {
              if (!it || !it.name) return;
              out.push({
                name: String(it.name),
                category: String(k),
                desc: String(it.desc || ''),
                cost: Number(it.cost || 0)
              });
            });
          }
        }
      });
    } catch (_err) {}
    var seen = {};
    return out.filter(function (entry) {
      var key = (String(entry.category) + '::' + String(entry.name)).toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function openImagePicker(cb) {
    var picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.onchange = function () {
      var file = picker.files && picker.files[0] ? picker.files[0] : null;
      if (!file) return;
      var r = new FileReader();
      r.onload = function () { cb(String(r.result || '')); };
      r.readAsDataURL(file);
    };
    picker.click();
  }

  function getLocationById(id) {
    var st = ensureState();
    return st.locations.find(function (l) { return l.id === id; }) || null;
  }

  function getCharacterById(id) {
    var st = ensureState();
    return st.characters.find(function (c) { return c.id === id; }) || null;
  }

  function getThingById(id) {
    var st = ensureState();
    return st.things.find(function (t) { return t.id === id; }) || null;
  }

  function getPortalById(id) {
    var st = ensureState();
    return st.portals.find(function (p) { return p.id === id; }) || null;
  }

  function getConnectionById(id) {
    var st = ensureState();
    return st.connections.find(function (c) { return c.id === id; }) || null;
  }

  function closeContextMenu() {
    var st = ensureState();
    if (!st.contextMenu) return;
    st.contextMenu = null;
    render();
  }

  function openContextMenu(event, targetType, targetId) {
    if (!event) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    var st = ensureState();
    st.contextMenu = {
      type: String(targetType || ''),
      id: String(targetId || ''),
      x: Number(event.clientX || 0),
      y: Number(event.clientY || 0)
    };
    render();
  }

  function contextRenameTarget() {
    var st = ensureState();
    var menu = st.contextMenu || {};
    if (!menu.type || !menu.id) return;
    if (menu.type === 'node') {
      if (menu.id.indexOf('loc_') === 0) {
        var loc = getLocationById(menu.id.replace(/^loc_/, ''));
        if (!loc) return;
        var nextLoc = prompt('Rename location:', loc.name || '');
        if (!nextLoc) return;
        loc.name = String(nextLoc).trim() || loc.name;
      } else if (menu.id.indexOf('char_') === 0) {
        var chr = getCharacterById(menu.id.replace(/^char_/, ''));
        if (!chr) return;
        var nextChr = prompt('Rename character:', chr.name || '');
        if (!nextChr) return;
        chr.name = String(nextChr).trim() || chr.name;
      } else if (menu.id.indexOf('thing_') === 0) {
        var thing = getThingById(menu.id.replace(/^thing_/, ''));
        if (!thing) return;
        var nextThing = prompt('Rename item/thing:', thing.name || '');
        if (!nextThing) return;
        thing.name = String(nextThing).trim() || thing.name;
      }
      st.contextMenu = null;
      render();
      return;
    }
    if (menu.type === 'edge') {
      st.graphDraftEdge = menu.id;
      st.contextMenu = null;
      render();
    }
  }

  function contextDeleteTarget() {
    var st = ensureState();
    var menu = st.contextMenu || {};
    if (!menu.type || !menu.id) return;
    if (menu.type === 'edge') {
      st.graphDraftEdge = menu.id;
      st.contextMenu = null;
      deleteSelectedEdge();
      return;
    }
    if (menu.type !== 'node') return;

    if (menu.id.indexOf('loc_') === 0) {
      var lid = menu.id.replace(/^loc_/, '');
      st.locations = st.locations.filter(function (l) { return l.id !== lid; });
      st.portals = st.portals.filter(function (p) { return p.from !== lid && p.to !== lid; });
      st.characters.forEach(function (c) { if (c.locationId === lid) c.locationId = ''; });
      st.things.forEach(function (t) { if (t.locationId === lid) t.locationId = ''; });
    } else if (menu.id.indexOf('char_') === 0) {
      var cid = menu.id.replace(/^char_/, '');
      var cRef = getCharacterById(cid);
      st.characters = st.characters.filter(function (c) { return c.id !== cid; });
      st.things.forEach(function (t) {
        if (t.ownerCharacterId === cid) {
          t.ownerCharacterId = '';
          t.owner = '';
        }
      });
      if (cRef) {
        st.connections = st.connections.filter(function (c) {
          return String(c.a || '').toLowerCase() !== String(cRef.name || '').toLowerCase()
            && String(c.b || '').toLowerCase() !== String(cRef.name || '').toLowerCase();
        });
      }
    } else if (menu.id.indexOf('thing_') === 0) {
      var tid = menu.id.replace(/^thing_/, '');
      var tRef = getThingById(tid);
      st.things = st.things.filter(function (t) { return t.id !== tid; });
      if (tRef) {
        st.connections = st.connections.filter(function (c) {
          return String(c.a || '').toLowerCase() !== String(tRef.name || '').toLowerCase()
            && String(c.b || '').toLowerCase() !== String(tRef.name || '').toLowerCase();
        });
      }
    }
    st.contextMenu = null;
    st.graphDraftFrom = '';
    st.graphDraftEdge = '';
    render();
  }

  function nodeLabel(node, st) {
    if (!node) return '?';
    if (node.kind === 'location') {
      var loc = st.locations.find(function (x) { return x.id === node.refId; });
      return loc ? loc.name : '?';
    }
    if (node.kind === 'character') {
      var c = st.characters.find(function (x) { return x.id === node.refId; });
      return c ? c.name : '?';
    }
    var t = st.things.find(function (x) { return x.id === node.refId; });
    return t ? t.name : '?';
  }

  function buildGraphData(st) {
    var nodes = [];
    st.locations.forEach(function (loc) {
      nodes.push({ id: 'loc_' + loc.id, kind: 'location', refId: loc.id });
    });
    st.characters.forEach(function (c) {
      nodes.push({ id: 'char_' + c.id, kind: 'character', refId: c.id });
    });
    st.things.forEach(function (t) {
      nodes.push({ id: 'thing_' + t.id, kind: 'thing', refId: t.id });
    });

    var edges = [];
    st.connections.forEach(function (c) {
      var aid = findNodeIdByName(nodes, st, c.a);
      var bid = findNodeIdByName(nodes, st, c.b);
      if (!aid || !bid) return;
      edges.push({ id: 'rel_' + c.id, sourceId: c.id, from: aid, to: bid, label: String(c.label || 'related'), type: 'relation', directional: true });
    });
    st.portals.forEach(function (p) {
      var direction = String(p.direction || 'oneway');
      if (direction === 'twoway') {
        edges.push({ id: 'portal_' + p.id, sourceId: p.id, from: 'loc_' + p.from, to: 'loc_' + p.to, label: String(p.label || 'Portal'), type: 'portal', directional: false });
      } else {
        edges.push({ id: 'portal_' + p.id, sourceId: p.id, from: 'loc_' + p.from, to: 'loc_' + p.to, label: String(p.label || 'Portal'), type: 'portal', directional: true });
      }
    });

    return { nodes: nodes, edges: edges };
  }

  function findNodeIdByName(nodes, st, name) {
    var needle = String(name || '').toLowerCase();
    for (var i = 0; i < nodes.length; i += 1) {
      if (String(nodeLabel(nodes[i], st)).toLowerCase() === needle) return nodes[i].id;
    }
    return '';
  }

  function renderGraphSvg(st) {
    var graph = buildGraphData(st);
    var nodes = graph.nodes;
    if (!nodes.length) {
      return '<div class="gmwb-muted">Graph appears after adding locations, characters, or things.</div>';
    }
    var width = 640;
    var height = 360;
    var cx = width / 2;
    var cy = height / 2;
    var radius = Math.max(90, Math.min(width, height) / 2 - 60);
    var pos = {};
    nodes.forEach(function (n, i) {
      var a = ((Math.PI * 2) / nodes.length) * i - Math.PI / 2;
      pos[n.id] = { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
    });

    var pairCounter = {};
    graph.edges.forEach(function (e) {
      var key = [e.from, e.to].sort().join('|');
      pairCounter[key] = (pairCounter[key] || 0) + 1;
    });
    var pairSeen = {};

    var edgeHtml = graph.edges.map(function (e) {
      var a = pos[e.from];
      var b = pos[e.to];
      if (!a || !b) return '';
      var color = e.type === 'portal' ? 'var(--gold2)' : 'var(--teal2)';
      var selected = st.graphDraftEdge === e.id;
      var marker = e.directional ? 'url(#gmwbArrowHead)' : 'none';
      var key = [e.from, e.to].sort().join('|');
      var count = pairCounter[key] || 1;
      var seen = pairSeen[key] || 0;
      pairSeen[key] = seen + 1;
      var signedIndex = seen - (count - 1) / 2;

      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / dist;
      var ny = dx / dist;
      var curve = signedIndex * 18;
      var cx1 = (a.x + b.x) / 2 + nx * curve;
      var cy1 = (a.y + b.y) / 2 + ny * curve;
      var pathD = 'M ' + a.x + ' ' + a.y + ' Q ' + cx1 + ' ' + cy1 + ' ' + b.x + ' ' + b.y;
      var tx = 0.25 * a.x + 0.5 * cx1 + 0.25 * b.x;
      var ty = 0.25 * a.y + 0.5 * cy1 + 0.25 * b.y;

      return '<g class="gmwb-edge-hit" onclick="gmWorldbuilderGraphEdgeClick(\'' + e.id + '\')" oncontextmenu="gmWorldbuilderOpenContextMenu(event,\'edge\',\'' + e.id + '\')">'
        + '<path d="' + pathD + '" stroke="' + color + '" stroke-width="' + (selected ? 4 : 2) + '" marker-end="' + marker + '" opacity="0.88" fill="none" />'
        + '<text x="' + tx + '" y="' + (ty - 4) + '" fill="' + color + '" font-size="10" text-anchor="middle">' + escapeHtml(e.label) + '</text>'
        + '</g>';
    }).join('');

    var nodeHtml = nodes.map(function (n) {
      var p = pos[n.id];
      var label = nodeLabel(n, st);
      var fill = n.kind === 'location' ? '#1c5c77' : (n.kind === 'character' ? '#5d4b88' : '#7a5e2d');
      var selected = st.graphDraftFrom === n.id;
      return '<g class="gmwb-graph-node" onclick="gmWorldbuilderGraphClick(\'' + n.id + '\')" oncontextmenu="gmWorldbuilderOpenContextMenu(event,\'node\',\'' + n.id + '\')">'
        + '<circle cx="' + p.x + '" cy="' + p.y + '" r="20" fill="' + fill + '" stroke="' + (selected ? 'var(--gold3)' : 'var(--border2)') + '" stroke-width="' + (selected ? '3' : '1.5') + '" />'
        + '<text x="' + p.x + '" y="' + (p.y + 33) + '" fill="var(--text2)" font-size="11" text-anchor="middle">' + escapeHtml(label.slice(0, 18)) + '</text>'
        + '</g>';
    }).join('');

    return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="gmwb-graph-svg">'
      + '<defs><marker id="gmwbArrowHead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="var(--gold2)"></polygon></marker></defs>'
      + edgeHtml + nodeHtml + '</svg>';
  }

  function renderEdgeInspector(st) {
    var edgeId = String(st.graphDraftEdge || '');
    if (!edgeId) return '<div class="gmwb-muted">Click an edge in the graph to edit or delete it.</div>';
    if (edgeId.indexOf('portal_') === 0) {
      var p = getPortalById(edgeId.replace(/^portal_/, ''));
      if (!p) return '<div class="gmwb-muted">Selected portal no longer exists.</div>';
      var from = getLocationById(p.from);
      var to = getLocationById(p.to);
      return '<div class="gmwb-edge-editor">'
        + '<div class="gmwb-muted"><strong>Portal:</strong> ' + escapeHtml((from && from.name) || '?') + ' -> ' + escapeHtml((to && to.name) || '?') + '</div>'
        + '<div class="gmwb-row"><input id="gmwbEdgeLabel" class="gmwb-input" value="' + escapeHtml(p.label || 'Portal') + '">'
        + '<select id="gmwbEdgeDirection" class="gmwb-select"><option value="oneway" ' + (p.direction === 'oneway' ? 'selected' : '') + '>One Way</option><option value="twoway" ' + (p.direction === 'twoway' ? 'selected' : '') + '>Two Way</option></select></div>'
        + '<div class="gmwb-row"><button class="btn btn-xs" onclick="gmWorldbuilderApplyEdgeEdit()">Apply</button><button class="btn btn-xs btn-red" onclick="gmWorldbuilderDeleteSelectedEdge()">Delete</button></div>'
        + '</div>';
    }
    var c = getConnectionById(edgeId.replace(/^rel_/, ''));
    if (!c) return '<div class="gmwb-muted">Selected connection no longer exists.</div>';
    return '<div class="gmwb-edge-editor">'
      + '<div class="gmwb-muted"><strong>Relationship:</strong> ' + escapeHtml(c.a) + ' -> ' + escapeHtml(c.b) + '</div>'
      + '<div class="gmwb-row"><input id="gmwbEdgeLabel" class="gmwb-input" value="' + escapeHtml(c.label || 'related') + '"></div>'
      + '<div class="gmwb-row"><button class="btn btn-xs" onclick="gmWorldbuilderApplyEdgeEdit()">Apply</button><button class="btn btn-xs btn-red" onclick="gmWorldbuilderDeleteSelectedEdge()">Delete</button></div>'
      + '</div>';
  }

  function renderContextMenu(st) {
    var menu = st.contextMenu;
    if (!menu || !menu.type || !menu.id) return '';
    var left = Math.max(10, Number(menu.x || 0) - 4);
    var top = Math.max(10, Number(menu.y || 0) - 4);
    var typeLabel = menu.type === 'edge' ? 'Edge Actions' : 'Node Actions';
    var btns = '';
    if (menu.type === 'edge') {
      btns += '<button class="btn btn-xs" onclick="gmWorldbuilderContextRenameTarget()">Edit Edge</button>';
      btns += '<button class="btn btn-xs btn-red" onclick="gmWorldbuilderContextDeleteTarget()">Delete Edge</button>';
    } else {
      btns += '<button class="btn btn-xs" onclick="gmWorldbuilderContextRenameTarget()">Rename Node</button>';
      btns += '<button class="btn btn-xs btn-red" onclick="gmWorldbuilderContextDeleteTarget()">Delete Node</button>';
    }
    return '<div class="gmwb-context-backdrop" onclick="gmWorldbuilderCloseContextMenu()"></div>'
      + '<div class="gmwb-context-menu" style="left:' + left + 'px;top:' + top + 'px;">'
      + '<div class="gmwb-context-title">' + escapeHtml(typeLabel) + '</div>'
      + '<div class="gmwb-row">' + btns + '<button class="btn btn-xs" onclick="gmWorldbuilderCloseContextMenu()">Close</button></div>'
      + '</div>';
  }

  function buildDropChip(kind, id, text) {
    var payload = kind + ':' + id;
    return '<div class="gmwb-drag-chip" draggable="true" ondragstart="gmWorldbuilderDragStart(event,\'' + payload + '\')">'
      + escapeHtml(text)
      + '</div>';
  }

  function renderLocationCard(st, loc) {
    var chars = st.characters.filter(function (c) { return c.locationId === loc.id; });
    var things = st.things.filter(function (t) { return t.locationId === loc.id; });
    var charChips = chars.length
      ? chars.map(function (c) {
        var held = st.things.filter(function (t) { return t.ownerCharacterId === c.id; });
        var heldHtml = held.length ? '<div class="gmwb-holder-drop-list">' + held.map(function (t) {
          return buildDropChip('thing', t.id, 'Item: ' + t.name);
        }).join('') + '</div>' : '';
        return '<div class="gmwb-holder-drop" ondragover="gmWorldbuilderAllowDrop(event)" ondrop="gmWorldbuilderDropOnCharacter(event,\'' + c.id + '\')">'
          + buildDropChip('char', c.id, c.name + ' [' + c.type + ']')
          + '<div class="gmwb-muted">Drop item here to assign.</div>'
          + heldHtml
          + '</div>';
      }).join('')
      : '<div class="gmwb-muted">No characters in this location.</div>';
    var thingChips = things.length
      ? things.map(function (t) { return buildDropChip('thing', t.id, 'Item: ' + t.name); }).join('')
      : '<div class="gmwb-muted">No loose items here.</div>';

    return '<div class="gmwb-loc-drop gmwb-loc" style="border-left-color:' + escapeHtml(loc.bg || 'var(--teal)') + '" '
      + 'draggable="true" ondragstart="gmWorldbuilderLocationReorderDragStart(event,\'' + loc.id + '\')" '
      + 'ondragenter="gmWorldbuilderLocationReorderDragEnter(event,\'' + loc.id + '\')" '
      + 'ondragover="gmWorldbuilderAllowDrop(event)" ondrop="gmWorldbuilderDropOnLocation(event,\'' + loc.id + '\')">'
      + '<div class="gmwb-entity-name"><span class="gmwb-order-handle">::</span> ' + escapeHtml(loc.name) + '</div>'
      + '<div class="gmwb-muted">' + escapeHtml(loc.desc || 'No description') + '</div>'
      + '<div class="gmwb-drop-zone-label">Characters</div>' + charChips
      + '<div class="gmwb-drop-zone-label">Loose Items</div><div class="gmwb-drag-list">' + thingChips + '</div>'
      + '</div>';
  }

  function renderLevelDropLane(levelId) {
    return '<div class="gmwb-level-drop-lane" ondragover="gmWorldbuilderAllowDrop(event)" ondrop="gmWorldbuilderLocationReorderDropOnLevel(event,\'' + levelId + '\')">Drop Location Here</div>';
  }

  function render() {
    var root = document.getElementById('tab-gmworldbuilder');
    if (!root) return;
    var st = ensureState();

    var levelsHtml = st.levels.map(function (lvl) {
      var locs = st.locations.filter(function (l) { return l.levelId === lvl.id; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
      var locHtml = locs.map(function (loc) { return renderLocationCard(st, loc); }).join('');
      return '<div class="gmwb-level" style="background:' + escapeHtml(lvl.bg || 'rgba(255,255,255,.02)') + ';">'
        + '<div class="gmwb-level-head"><strong>' + escapeHtml(lvl.name) + '</strong>'
        + '<button class="btn btn-xs" onclick="gmWorldbuilderAddLocation(\'' + lvl.id + '\')">+ Location</button></div>'
        + renderLevelDropLane(lvl.id)
        + (locHtml || '<div class="gmwb-muted">No locations yet.</div>')
        + renderLevelDropLane(lvl.id)
        + '</div>';
    }).join('');

    var unassignedChars = st.characters.filter(function (c) { return !c.locationId; });
    var unassignedThings = st.things.filter(function (t) { return !t.locationId && !t.ownerCharacterId; });
    var charsPoolHtml = unassignedChars.length
      ? unassignedChars.map(function (c) { return buildDropChip('char', c.id, c.name + ' [' + c.type + ']'); }).join('')
      : '<div class="gmwb-muted">No unassigned characters.</div>';
    var thingsPoolHtml = unassignedThings.length
      ? unassignedThings.map(function (t) { return buildDropChip('thing', t.id, 'Item: ' + t.name); }).join('')
      : '<div class="gmwb-muted">No unassigned items.</div>';

    var checklistHtml = st.checklists.map(function (c) {
      return '<label class="gmwb-check ' + (c.done ? 'done' : '') + '"><input type="checkbox" ' + (c.done ? 'checked' : '') + ' onchange="gmWorldbuilderToggleChecklist(\'' + c.id + '\')">' + escapeHtml(c.text) + '</label>';
    }).join('');

    var stickyHtml = st.stickyNotes.map(function (n) {
      return '<div class="gmwb-sticky" style="background:' + escapeHtml(n.color || '#f8e36a') + ';color:#1f1f1f;">'
        + '<div style="font-weight:700;font-size:.76rem;">Sticky</div>'
        + '<div style="font-size:.78rem;line-height:1.4;">' + escapeHtml(n.text) + '</div>'
        + (n.image ? '<img src="' + n.image + '" alt="Sticky image">' : '')
        + '</div>';
    }).join('');

    var portalsHtml = st.portals.map(function (p) {
      var from = getLocationById(p.from);
      var to = getLocationById(p.to);
      var marker = p.direction === 'twoway' ? '<->' : '->';
      return '<div class="gmwb-muted">' + escapeHtml((from && from.name) || '?') + ' ' + marker + ' ' + escapeHtml((to && to.name) || '?') + ' (' + escapeHtml(p.label || 'Portal') + ')</div>';
    }).join('');

    var connHtml = st.connections.map(function (c) {
      return '<div class="gmwb-muted">' + escapeHtml(c.a) + ' -> ' + escapeHtml(c.b) + ' : ' + escapeHtml(c.label || 'related') + '</div>';
    }).join('');

    var graphSelectionHint = st.graphDraftFrom
      ? ('Selected node: ' + nodeLabel((buildGraphData(st).nodes.find(function (n) { return n.id === st.graphDraftFrom; }) || null), st) + '. Click a second node to create a ' + (String((document.getElementById('gmwbGraphMode') && document.getElementById('gmwbGraphMode').value) || 'relation')) + ' link.')
      : 'Click one node, then another to create a link.';

    root.innerHTML = ''
      + '<div class="card" style="margin-bottom:.6rem;">'
      + '<div class="section-title">GM Worldbuilder Forge</div>'
      + '<div class="gmwb-muted">Drag and drop characters/items between locations, click nodes to create portals/relations, and generate weighted culture names.</div>'
      + '</div>'
      + '<div class="gmwb-root">'
      + '<section class="gmwb-card">'
      + '<div class="gmwb-title">Prompt Engine</div>'
      + '<div class="form-row"><label class="sub-label">Genre</label><select id="gmwbGenre" class="gmwb-select">'
      + GENRES.map(function (g) { return '<option ' + (st.genre === g ? 'selected' : '') + '>' + g + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="gmwb-row"><button class="btn btn-sm btn-teal" onclick="gmWorldbuilderGenerateStory()">Generate Story Prompt</button>'
      + '<button class="btn btn-sm" onclick="gmWorldbuilderGenerateMonster()">Generate Monster Block</button></div>'
      + '<div class="gmwb-list">'
      + '<div class="gmwb-entity"><div class="gmwb-entity-name">Story Prompt</div><div class="gmwb-muted">' + escapeHtml(st.storyPrompt || 'No prompt yet.') + '</div></div>'
      + '<div class="gmwb-entity"><div class="gmwb-entity-name">Monster + Skills</div><div class="gmwb-muted" style="white-space:pre-wrap;">' + escapeHtml(st.monsterBlock || 'No monster yet.') + '</div></div>'
      + '</div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Merchant Pull</div>'
      + '<div class="gmwb-row"><button class="btn btn-sm" onclick="gmWorldbuilderPullMerchantItem()">Random Merchant Item</button></div>'
      + '<div id="gmwbMerchantPull" class="gmwb-muted" style="margin-top:.3rem;">Use this to inject items from Merchant stock into your prep.</div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Task Checklist</div>'
      + '<div class="gmwb-row"><input id="gmwbTaskText" class="gmwb-input" placeholder="Add prep task..."><button class="btn btn-xs" onclick="gmWorldbuilderAddChecklist()">Add</button></div>'
      + '<div class="gmwb-list">' + (checklistHtml || '<div class="gmwb-muted">No tasks.</div>') + '</div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Unassigned Pools (Drop Targets)</div>'
      + '<div class="gmwb-drop-pool" ondragover="gmWorldbuilderAllowDrop(event)" ondrop="gmWorldbuilderDropOnUnassigned(event)"><div class="gmwb-drop-zone-label">Characters</div><div class="gmwb-drag-list">' + charsPoolHtml + '</div></div>'
      + '<div class="gmwb-drop-pool" ondragover="gmWorldbuilderAllowDrop(event)" ondrop="gmWorldbuilderDropOnUnassigned(event)"><div class="gmwb-drop-zone-label">Items</div><div class="gmwb-drag-list">' + thingsPoolHtml + '</div></div>'
      + '</section>'

      + '<section class="gmwb-card">'
      + '<div class="gmwb-title">Levels, Locations, Drag-And-Drop</div>'
      + '<div class="gmwb-row"><input id="gmwbLevelName" class="gmwb-input" placeholder="Level name (e.g. Surface)"><input id="gmwbLevelBg" class="gmwb-input" placeholder="Background color/gradient (CSS)"><button class="btn btn-xs" onclick="gmWorldbuilderAddLevel()">Add Level</button></div>'
      + '<div class="gmwb-list">' + (levelsHtml || '<div class="gmwb-muted">No levels yet.</div>') + '</div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Portal Links</div>'
      + '<div class="gmwb-row"><button class="btn btn-xs" onclick="gmWorldbuilderAddPortal()">Create Portal</button><select id="gmwbPortalDirection" class="gmwb-select"><option value="oneway">One Way</option><option value="twoway">Two Way</option></select></div>'
      + '<div class="gmwb-list">' + (portalsHtml || '<div class="gmwb-muted">No portals yet.</div>') + '</div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Connections</div>'
      + '<div class="gmwb-row"><input id="gmwbConnA" class="gmwb-input" placeholder="From (name)"><input id="gmwbConnB" class="gmwb-input" placeholder="To (name)"><input id="gmwbConnLabel" class="gmwb-input" placeholder="Relation"><button class="btn btn-xs" onclick="gmWorldbuilderAddConnection()">Link</button></div>'
      + '<div class="gmwb-connections">' + (connHtml || '<div class="gmwb-muted">No connections yet.</div>') + '</div>'
      + '</section>'

      + '<section class="gmwb-card">'
      + '<div class="gmwb-title">Characters, Names, Graph Canvas</div>'
      + '<div class="gmwb-row"><input id="gmwbCharName" class="gmwb-input" placeholder="Character name">'
      + '<select id="gmwbCharType" class="gmwb-select"><option value="NPC">NPC</option><option value="PC">PC</option></select>'
      + '<button class="btn btn-xs btn-teal" onclick="gmWorldbuilderAddCharacter()">Add</button></div>'
      + '<div class="gmwb-row" style="margin-top:.22rem;"><select id="gmwbNameCulture" class="gmwb-select">'
      + Object.keys(NAME_PACKS).map(function (k) { return '<option>' + escapeHtml(k) + '</option>'; }).join('')
      + '</select>'
      + '<select id="gmwbNameStyle" class="gmwb-select"><option value="weighted">Weighted</option><option value="formal">Formal</option><option value="single">Single</option><option value="clan">Clan</option><option value="honorific">Honorific</option><option value="poetic">Poetic</option></select>'
      + '<button class="btn btn-xs" onclick="gmWorldbuilderGenerateName()">Generate Name</button></div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Things And Assignment</div>'
      + '<div class="gmwb-row"><button class="btn btn-xs" onclick="gmWorldbuilderAddThing()">Add Thing</button><button class="btn btn-xs" onclick="gmWorldbuilderTransferThing()">Transfer Thing</button></div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Sticky Notes + Images</div>'
      + '<div class="gmwb-row"><input id="gmwbStickyText" class="gmwb-input" placeholder="Sticky note text"><input id="gmwbStickyColor" class="gmwb-input" placeholder="#f8e36a"><button class="btn btn-xs" onclick="gmWorldbuilderAddSticky()">Add Sticky</button><button class="btn btn-xs" onclick="gmWorldbuilderAddStickyWithImage()">Add Sticky + Image</button></div>'
      + '<div class="gmwb-sticky-grid" style="margin-top:.35rem;">' + (stickyHtml || '<div class="gmwb-muted">No sticky notes yet.</div>') + '</div>'
      + '<div class="gmwb-title" style="margin-top:.6rem;">Node Graph (Click To Connect)</div>'
      + '<div class="gmwb-row"><select id="gmwbGraphMode" class="gmwb-select"><option value="relation">Relationship Link</option><option value="portal">Portal Link</option></select>'
      + '<button class="btn btn-xs" onclick="gmWorldbuilderGraphClearSelection()">Clear Selection</button></div>'
      + '<div class="gmwb-muted" id="gmwbGraphHint">' + escapeHtml(graphSelectionHint) + '</div>'
      + '<div class="gmwb-muted">Relationship mode writes to Connections. Portal mode writes to Portal Links and requires two Location nodes.</div>'
      + '<div class="gmwb-graph-wrap">' + renderGraphSvg(st) + '</div>'
      + '<div class="gmwb-graph-legend">'
      + '<div class="gmwb-legend-title">Graph Legend</div>'
      + '<div class="gmwb-legend-row">'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-dot gmwb-legend-loc"></span> Location Node</span>'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-dot gmwb-legend-char"></span> Character Node</span>'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-dot gmwb-legend-thing"></span> Item/Thing Node</span>'
      + '</div>'
      + '<div class="gmwb-legend-row">'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-line gmwb-legend-rel"></span> Relationship Edge</span>'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-line gmwb-legend-portal"></span> Portal Edge</span>'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-arrow">-></span> One-way</span>'
      + '<span class="gmwb-legend-chip"><span class="gmwb-legend-arrow"><-></span> Two-way</span>'
      + '</div>'
      + '</div>'
      + '<div class="gmwb-title" style="margin-top:.55rem;">Selected Edge</div>'
      + renderEdgeInspector(st)
      + '<div class="gmwb-row" style="margin-top:.55rem;"><button class="btn btn-sm" onclick="if(typeof saveCharacter===\'function\'){saveCharacter();}">Save Campaign Data</button></div>'
      + '</section>'
      + '</div>';

    root.innerHTML += renderContextMenu(st);

    var genreSel = document.getElementById('gmwbGenre');
    if (genreSel) {
      genreSel.onchange = function () {
        ensureState().genre = String(this.value || 'Dark Fantasy');
      };
    }
  }

  function addLevel() {
    var st = ensureState();
    var nameEl = document.getElementById('gmwbLevelName');
    var bgEl = document.getElementById('gmwbLevelBg');
    var name = String((nameEl && nameEl.value) || '').trim() || ('Level ' + (st.levels.length + 1));
    var bg = String((bgEl && bgEl.value) || '').trim() || 'rgba(33,40,66,.35)';
    st.levels.push({ id: uid('lvl'), name: name, bg: bg });
    if (nameEl) nameEl.value = '';
    render();
  }

  function addLocation(levelId) {
    var st = ensureState();
    var name = prompt('Location name?');
    if (!name) return;
    var desc = prompt('Description?', 'Add hazards, hooks, and atmosphere.') || '';
    st.locations.push({ id: uid('loc'), name: String(name), desc: String(desc), levelId: String(levelId || ''), bg: '#2ec4b6' });
    render();
  }

  function addPortal() {
    var st = ensureState();
    if (st.locations.length < 2) {
      if (typeof showNotif === 'function') showNotif('Need at least two locations to make a portal.', 'warn');
      return;
    }
    var from = prompt('Portal FROM location name?');
    var to = prompt('Portal TO location name?');
    if (!from || !to) return;
    var a = st.locations.find(function (l) { return l.name.toLowerCase() === String(from).toLowerCase(); });
    var b = st.locations.find(function (l) { return l.name.toLowerCase() === String(to).toLowerCase(); });
    if (!a || !b) {
      if (typeof showNotif === 'function') showNotif('Location not found. Use exact names.', 'warn');
      return;
    }
    var label = prompt('Portal label?', 'Transit Gate') || 'Portal';
    var dirEl = document.getElementById('gmwbPortalDirection');
    var direction = String((dirEl && dirEl.value) || 'oneway');
    st.portals.push({ id: uid('prt'), from: a.id, to: b.id, label: String(label), direction: direction === 'twoway' ? 'twoway' : 'oneway' });
    render();
  }

  function addCharacter() {
    var st = ensureState();
    var nm = document.getElementById('gmwbCharName');
    var ty = document.getElementById('gmwbCharType');
    var name = String((nm && nm.value) || '').trim();
    if (!name) return;
    st.characters.push({
      id: uid('ch'),
      type: String((ty && ty.value) || 'NPC'),
      name: name,
      desc: 'Describe personality, motive, and pressure points.',
      locationId: '',
      stats: {
        force: 4 + Math.ceil(Math.random() * 6),
        cunning: 4 + Math.ceil(Math.random() * 6),
        resolve: 4 + Math.ceil(Math.random() * 6),
        defend: 4 + Math.ceil(Math.random() * 6)
      },
      checklist: []
    });
    if (nm) nm.value = '';
    render();
  }

  function moveCharacter(charId) {
    var st = ensureState();
    var c = st.characters.find(function (x) { return x.id === charId; });
    if (!c) return;
    if (!st.locations.length) {
      if (typeof showNotif === 'function') showNotif('No locations yet.', 'warn');
      return;
    }
    var targetName = prompt('Move to location (name):', '');
    if (!targetName) return;
    var loc = st.locations.find(function (l) { return l.name.toLowerCase() === String(targetName).toLowerCase(); });
    if (!loc) {
      if (typeof showNotif === 'function') showNotif('Location not found.', 'warn');
      return;
    }
    c.locationId = loc.id;
    render();
  }

  function composeNameFromPack(pack, selectedStyle) {
    var style = selectedStyle === 'weighted'
      ? ((weightedChoice(pack.styles || [{ key: 'weighted', weight: 1 }]) || {}).key || 'weighted')
      : selectedStyle;
    var given = randomOf(pack.given || []);
    var family = randomOf(pack.family || []);
    if (!given) return '';
    if (style === 'single') return given;
    if (style === 'clan') return given + ' of Clan ' + family;
    if (style === 'honorific') return 'High ' + given + ' ' + family;
    if (style === 'poetic') return given + ' of the ' + randomOf(['Quiet Moon', 'Broken Tide', 'Last Ember', 'Hollow Bell']);
    return family ? (given + ' ' + family) : given;
  }

  function generateName() {
    var cultureEl = document.getElementById('gmwbNameCulture');
    var styleEl = document.getElementById('gmwbNameStyle');
    var culture = String((cultureEl && cultureEl.value) || 'Spanish');
    var selectedStyle = String((styleEl && styleEl.value) || 'weighted');
    var pack = NAME_PACKS[culture] || NAME_PACKS.Spanish;
    var next = composeNameFromPack(pack, selectedStyle);
    var target = document.getElementById('gmwbCharName');
    if (target) target.value = next;
  }

  function addThing() {
    var st = ensureState();
    var name = prompt('Thing / Relic / Item name?');
    if (!name) return;
    st.things.push({
      id: uid('thing'),
      name: String(name),
      owner: '',
      ownerCharacterId: '',
      locationId: '',
      desc: 'Add details and mechanics.'
    });
    render();
  }

  function transferThing() {
    var st = ensureState();
    if (!st.things.length) {
      if (typeof showNotif === 'function') showNotif('No things to transfer.', 'warn');
      return;
    }
    var name = prompt('Thing name to transfer?');
    if (!name) return;
    var thing = st.things.find(function (t) { return t.name.toLowerCase() === String(name).toLowerCase(); });
    if (!thing) return;
    var owner = prompt('New owner (character or location name):', thing.owner || '');
    if (owner === null) return;
    thing.owner = String(owner || '');
    var chr = st.characters.find(function (c) { return c.name.toLowerCase() === thing.owner.toLowerCase(); });
    var loc = st.locations.find(function (l) { return l.name.toLowerCase() === thing.owner.toLowerCase(); });
    thing.ownerCharacterId = chr ? chr.id : '';
    thing.locationId = loc ? loc.id : '';
    render();
  }

  function addSticky(withImage) {
    var st = ensureState();
    var txt = document.getElementById('gmwbStickyText');
    var col = document.getElementById('gmwbStickyColor');
    var noteText = String((txt && txt.value) || '').trim() || 'Untitled note';
    var color = String((col && col.value) || '').trim() || '#f8e36a';
    if (withImage) {
      openImagePicker(function (data) {
        st.stickyNotes.push({ id: uid('sticky'), text: noteText, color: color, image: data });
        if (txt) txt.value = '';
        render();
      });
      return;
    }
    st.stickyNotes.push({ id: uid('sticky'), text: noteText, color: color, image: '' });
    if (txt) txt.value = '';
    render();
  }

  function addChecklist() {
    var st = ensureState();
    var el = document.getElementById('gmwbTaskText');
    var text = String((el && el.value) || '').trim();
    if (!text) return;
    st.checklists.push({ id: uid('task'), text: text, done: false });
    if (el) el.value = '';
    render();
  }

  function toggleChecklist(id) {
    var st = ensureState();
    var t = st.checklists.find(function (x) { return x.id === id; });
    if (!t) return;
    t.done = !t.done;
    render();
  }

  function addConnection() {
    var st = ensureState();
    var a = document.getElementById('gmwbConnA');
    var b = document.getElementById('gmwbConnB');
    var l = document.getElementById('gmwbConnLabel');
    var av = String((a && a.value) || '').trim();
    var bv = String((b && b.value) || '').trim();
    var lv = String((l && l.value) || '').trim() || 'related';
    if (!av || !bv) return;
    st.connections.push({ id: uid('lnk'), a: av, b: bv, label: lv });
    if (a) a.value = '';
    if (b) b.value = '';
    if (l) l.value = '';
    render();
  }

  function generateStory() {
    var st = ensureState();
    var genreSel = document.getElementById('gmwbGenre');
    st.genre = String((genreSel && genreSel.value) || st.genre || 'Dark Fantasy');
    st.storyPrompt = storyPromptForGenre(st.genre);
    render();
  }

  function generateMonster() {
    var st = ensureState();
    var genreSel = document.getElementById('gmwbGenre');
    st.genre = String((genreSel && genreSel.value) || st.genre || 'Dark Fantasy');
    st.monsterBlock = buildMonsterBlock(st.genre);
    render();
  }

  function pullMerchantItem() {
    var items = getMerchantItems();
    if (!items.length) {
      if (typeof showNotif === 'function') showNotif('Merchant catalog unavailable.', 'warn');
      return;
    }
    var pick = randomOf(items);
    var el = document.getElementById('gmwbMerchantPull');
    if (el) {
      el.innerHTML = '<strong>' + escapeHtml(pick.name) + '</strong> [' + escapeHtml(pick.category) + '] - '
        + escapeHtml(pick.desc || 'No description') + ' (Cost: ' + Number(pick.cost || 0) + 'c)';
    }
  }

  function dragStart(event, payload) {
    if (!event || !event.dataTransfer) return;
    event.dataTransfer.setData('text/plain', String(payload || ''));
    event.dataTransfer.effectAllowed = 'move';
  }

  function allowDrop(event) {
    if (!event) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function applyDropPayload(payload, opts) {
    var st = ensureState();
    var p = String(payload || '');
    var parts = p.split(':');
    if (parts.length < 2) return false;
    var kind = parts[0];
    var id = parts.slice(1).join(':');
    var locationId = String((opts && opts.locationId) || '');
    var characterId = String((opts && opts.characterId) || '');
    var unassigned = !!(opts && opts.unassigned);
    if (kind === 'char') {
      var c = getCharacterById(id);
      if (!c) return false;
      if (unassigned) c.locationId = '';
      else c.locationId = locationId;
      return true;
    }
    if (kind === 'thing') {
      var t = getThingById(id);
      if (!t) return false;
      if (characterId) {
        t.ownerCharacterId = characterId;
        t.locationId = '';
        var chr = getCharacterById(characterId);
        t.owner = chr ? chr.name : '';
      } else if (unassigned) {
        t.ownerCharacterId = '';
        t.locationId = '';
        t.owner = '';
      } else if (locationId) {
        t.ownerCharacterId = '';
        t.locationId = locationId;
        var loc = getLocationById(locationId);
        t.owner = loc ? loc.name : '';
      }
      return true;
    }
    return false;
  }

  function dropOnLocation(event, locationId) {
    if (!event || !event.dataTransfer) return;
    event.preventDefault();
    var payload = event.dataTransfer.getData('text/plain');
    if (applyDropPayload(payload, { locationId: locationId })) render();
  }

  function dropOnCharacter(event, characterId) {
    if (!event || !event.dataTransfer) return;
    event.preventDefault();
    var payload = event.dataTransfer.getData('text/plain');
    if (applyDropPayload(payload, { characterId: characterId })) render();
  }

  function dropOnUnassigned(event) {
    if (!event || !event.dataTransfer) return;
    event.preventDefault();
    var payload = event.dataTransfer.getData('text/plain');
    if (applyDropPayload(payload, { unassigned: true })) render();
  }

  function graphClick(nodeId) {
    var st = ensureState();
    var node = String(nodeId || '');
    if (!node) return;
    if (!st.graphDraftFrom) {
      st.graphDraftFrom = node;
      render();
      return;
    }
    if (st.graphDraftFrom === node) {
      st.graphDraftFrom = '';
      render();
      return;
    }

    var first = st.graphDraftFrom;
    st.graphDraftFrom = '';
    var modeEl = document.getElementById('gmwbGraphMode');
    var mode = String((modeEl && modeEl.value) || 'relation');

    if (mode === 'portal') {
      if (first.indexOf('loc_') !== 0 || node.indexOf('loc_') !== 0) {
        if (typeof showNotif === 'function') showNotif('Portal links require two location nodes.', 'warn');
        render();
        return;
      }
      var from = first.replace(/^loc_/, '');
      var to = node.replace(/^loc_/, '');
      var dirEl = document.getElementById('gmwbPortalDirection');
      var direction = String((dirEl && dirEl.value) || 'oneway');
      st.portals.push({ id: uid('prt'), from: from, to: to, label: 'Graph Portal', direction: direction === 'twoway' ? 'twoway' : 'oneway' });
      if (typeof showNotif === 'function') showNotif('Portal link created in GM Forge graph.', 'good');
      render();
      return;
    }

    var g = buildGraphData(st);
    var a = g.nodes.find(function (n) { return n.id === first; });
    var b = g.nodes.find(function (n) { return n.id === node; });
    if (!a || !b) {
      render();
      return;
    }
    var label = prompt('Relationship label?', 'related') || 'related';
    st.connections.push({
      id: uid('lnk'),
      a: nodeLabel(a, st),
      b: nodeLabel(b, st),
      label: String(label)
    });
    if (typeof showNotif === 'function') showNotif('Relationship link created in GM Forge graph.', 'good');
    render();
  }

  function graphClearSelection() {
    var st = ensureState();
    st.graphDraftFrom = '';
    st.graphDraftEdge = '';
    render();
  }

  function graphEdgeClick(edgeId) {
    var st = ensureState();
    st.graphDraftEdge = String(edgeId || '');
    st.graphDraftFrom = '';
    render();
  }

  function applyEdgeEdit() {
    var st = ensureState();
    var edgeId = String(st.graphDraftEdge || '');
    if (!edgeId) return;
    var labelEl = document.getElementById('gmwbEdgeLabel');
    var nextLabel = String((labelEl && labelEl.value) || '').trim();
    if (!nextLabel) return;
    if (edgeId.indexOf('portal_') === 0) {
      var p = getPortalById(edgeId.replace(/^portal_/, ''));
      if (!p) return;
      p.label = nextLabel;
      var dirEl = document.getElementById('gmwbEdgeDirection');
      if (dirEl) p.direction = String(dirEl.value || 'oneway') === 'twoway' ? 'twoway' : 'oneway';
    } else {
      var c = getConnectionById(edgeId.replace(/^rel_/, ''));
      if (!c) return;
      c.label = nextLabel;
    }
    render();
  }

  function deleteSelectedEdge() {
    var st = ensureState();
    var edgeId = String(st.graphDraftEdge || '');
    if (!edgeId) return;
    if (edgeId.indexOf('portal_') === 0) {
      var pid = edgeId.replace(/^portal_/, '');
      st.portals = st.portals.filter(function (p) { return p.id !== pid; });
    } else {
      var cid = edgeId.replace(/^rel_/, '');
      st.connections = st.connections.filter(function (c) { return c.id !== cid; });
    }
    st.graphDraftEdge = '';
    render();
  }

  function locationReorderDragStart(event, locId) {
    if (!event || !event.dataTransfer) return;
    event.dataTransfer.setData('text/x-gmwb-location-order', String(locId || ''));
    event.dataTransfer.effectAllowed = 'move';
  }

  function locationReorderDragEnter(event, targetLocId) {
    if (!event || !event.dataTransfer) return;
    var srcId = String(event.dataTransfer.getData('text/x-gmwb-location-order') || '');
    if (!srcId || srcId === String(targetLocId || '')) return;
    var st = ensureState();
    var src = st.locations.find(function (l) { return l.id === srcId; });
    var dst = st.locations.find(function (l) { return l.id === String(targetLocId || ''); });
    if (!src || !dst) return;

    var srcLevelList = st.locations.filter(function (l) { return l.levelId === src.levelId; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    srcLevelList = srcLevelList.filter(function (l) { return l.id !== src.id; });
    srcLevelList.forEach(function (l, i) { l.order = i + 1; });

    var targetLevel = dst.levelId;
    src.levelId = targetLevel;
    var list = st.locations.filter(function (l) { return l.levelId === targetLevel; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    var fromIdx = list.findIndex(function (l) { return l.id === src.id; });
    var toIdx = list.findIndex(function (l) { return l.id === dst.id; });
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx !== toIdx) {
      var moved = list.splice(fromIdx, 1)[0];
      list.splice(toIdx, 0, moved);
    }
    list.forEach(function (l, i) { l.order = i + 1; });
    render();
  }

  function locationReorderDropOnLevel(event, levelId) {
    if (!event || !event.dataTransfer) return;
    event.preventDefault();
    var srcId = String(event.dataTransfer.getData('text/x-gmwb-location-order') || '');
    if (!srcId) return;
    var st = ensureState();
    var src = st.locations.find(function (l) { return l.id === srcId; });
    if (!src) return;

    var oldList = st.locations.filter(function (l) { return l.levelId === src.levelId; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    oldList = oldList.filter(function (l) { return l.id !== src.id; });
    oldList.forEach(function (l, i) { l.order = i + 1; });

    src.levelId = String(levelId || src.levelId);
    var newList = st.locations.filter(function (l) { return l.levelId === src.levelId && l.id !== src.id; }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    newList.push(src);
    newList.forEach(function (l, i) { l.order = i + 1; });
    render();
  }

  function mount() {
    ensureState();
    render();
    updateVisibility();
  }

  function updateVisibility() {
    var btn = document.getElementById('tabnav-gmworldbuilder');
    var panel = document.getElementById('tab-gmworldbuilder');
    var gm = isGMMode();
    if (btn) btn.style.display = gm ? '' : 'none';
    if (panel && !gm && panel.classList.contains('active') && typeof window.switchTab === 'function') {
      var fallback = document.getElementById('tabnav-character') || document.querySelector("#mainNav .tab-btn[onclick*=\"switchTab('character'\"]");
      window.switchTab('character', fallback || null);
    }
  }

  window.gmWorldbuilderMount = mount;
  window.updateGmWorldbuilderVisibility = updateVisibility;
  window.gmWorldbuilderGenerateStory = generateStory;
  window.gmWorldbuilderGenerateMonster = generateMonster;
  window.gmWorldbuilderAddLevel = addLevel;
  window.gmWorldbuilderAddLocation = addLocation;
  window.gmWorldbuilderAddPortal = addPortal;
  window.gmWorldbuilderAddCharacter = addCharacter;
  window.gmWorldbuilderMoveCharacter = moveCharacter;
  window.gmWorldbuilderGenerateName = generateName;
  window.gmWorldbuilderAddThing = addThing;
  window.gmWorldbuilderTransferThing = transferThing;
  window.gmWorldbuilderAddSticky = function () { addSticky(false); };
  window.gmWorldbuilderAddStickyWithImage = function () { addSticky(true); };
  window.gmWorldbuilderAddChecklist = addChecklist;
  window.gmWorldbuilderToggleChecklist = toggleChecklist;
  window.gmWorldbuilderAddConnection = addConnection;
  window.gmWorldbuilderPullMerchantItem = pullMerchantItem;
  window.gmWorldbuilderAllowDrop = allowDrop;
  window.gmWorldbuilderDragStart = dragStart;
  window.gmWorldbuilderDropOnLocation = dropOnLocation;
  window.gmWorldbuilderDropOnCharacter = dropOnCharacter;
  window.gmWorldbuilderDropOnUnassigned = dropOnUnassigned;
  window.gmWorldbuilderGraphClick = graphClick;
  window.gmWorldbuilderGraphClearSelection = graphClearSelection;
  window.gmWorldbuilderGraphEdgeClick = graphEdgeClick;
  window.gmWorldbuilderApplyEdgeEdit = applyEdgeEdit;
  window.gmWorldbuilderDeleteSelectedEdge = deleteSelectedEdge;
  window.gmWorldbuilderLocationReorderDragStart = locationReorderDragStart;
  window.gmWorldbuilderLocationReorderDragEnter = locationReorderDragEnter;
  window.gmWorldbuilderLocationReorderDropOnLevel = locationReorderDropOnLevel;
  window.gmWorldbuilderOpenContextMenu = openContextMenu;
  window.gmWorldbuilderCloseContextMenu = closeContextMenu;
  window.gmWorldbuilderContextRenameTarget = contextRenameTarget;
  window.gmWorldbuilderContextDeleteTarget = contextDeleteTarget;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
