(function () {
  function escHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashString(value) {
    var text = String(value || '');
    var out = 0;
    for (var i = 0; i < text.length; i++) out = ((out << 5) - out) + text.charCodeAt(i);
    return Math.abs(out || 1);
  }

  function resolveAccent(seed) {
    var hues = ['#e8c050', '#46c4b6', '#ff8450', '#9ad7ff', '#c39cff', '#7fd07f'];
    return hues[hashString(seed) % hues.length];
  }

  function frameSvg(inner, opts) {
    var size = Math.max(18, Number(opts && opts.size || 44));
    var accent = String(opts && opts.accent || '#e8c050');
    var bg = String(opts && opts.bg || 'rgba(11,16,22,.92)');
    var glow = String(opts && opts.glow || accent);
    var title = escHtml(opts && opts.title || '');
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:14px;border:1px solid ' + accent + ';background:' + bg + ';box-shadow:0 0 0 1px rgba(255,255,255,.05) inset, 0 0 16px rgba(0,0,0,.18), 0 0 20px ' + glow + '22;overflow:hidden;">'
      + '<svg viewBox="0 0 64 64" width="' + Math.round(size - 8) + '" height="' + Math.round(size - 8) + '" aria-hidden="true" focusable="false">'
      + (title ? '<title>' + title + '</title>' : '')
      + inner
      + '</svg></span>';
  }

  function iconMedal(opts) {
    var accent = String(opts && opts.accent || '#e8c050');
    return frameSvg(
      '<path d="M20 8h10l4 14H26z" fill="#5bc4b6"/><path d="M34 8h10l-6 14H30z" fill="#ff8450"/>'
      + '<circle cx="32" cy="34" r="16" fill="' + accent + '"/><circle cx="32" cy="34" r="10" fill="#161d27"/>'
      + '<path d="M32 24l3.2 6.8 7.5 1-5.5 5.1 1.4 7.4L32 40.6l-6.6 3.7 1.4-7.4-5.5-5.1 7.5-1z" fill="#f8f4df"/>',
      opts
    );
  }

  function iconChest(opts) {
    var accent = String(opts && opts.accent || '#c98d44');
    return frameSvg(
      '<rect x="12" y="24" width="40" height="24" rx="5" fill="#4a2d17" stroke="' + accent + '" stroke-width="2"/>'
      + '<path d="M12 28c8-8 32-8 40 0v-7c0-4-3-7-7-7H19c-4 0-7 3-7 7z" fill="' + accent + '" opacity=".88"/>'
      + '<rect x="29" y="22" width="6" height="26" rx="2" fill="#f4d889"/>'
      + '<rect x="26" y="30" width="12" height="8" rx="3" fill="#20160e" stroke="#f4d889" stroke-width="1.4"/>',
      opts
    );
  }

  function iconMonster(region, opts) {
    var palette = {
      province: '#ff8450',
      sea: '#46c4b6',
      wtw: '#c39cff',
      planet: '#7fd07f',
      galaxy: '#9ad7ff'
    };
    var accent = palette[String(region || 'province')] || '#e8c050';
    var glyphs = {
      province: '<path d="M15 44l9-22 8 9 8-17 9 30H39l-7-7-6 7z" fill="' + accent + '"/><circle cx="25" cy="28" r="2" fill="#10151c"/><circle cx="39" cy="24" r="2" fill="#10151c"/>',
      sea: '<path d="M13 40c8-18 30-22 38-8-4 0-8 3-10 8 3 0 6 3 7 8-8-4-14-4-19 0 0-6-4-8-16-8z" fill="' + accent + '"/><circle cx="41" cy="27" r="2" fill="#0f1720"/>',
      wtw: '<circle cx="32" cy="28" r="13" fill="' + accent + '" opacity=".95"/><path d="M22 46c4-6 16-6 20 0" stroke="' + accent + '" stroke-width="6" stroke-linecap="round" fill="none"/><circle cx="27" cy="28" r="2.4" fill="#111822"/><circle cx="37" cy="28" r="2.4" fill="#111822"/>',
      planet: '<path d="M20 42c0-10 5-20 12-20s12 10 12 20" fill="none" stroke="' + accent + '" stroke-width="6" stroke-linecap="round"/><path d="M16 27l10-9M48 27l-10-9M22 45l-6 7M42 45l6 7" stroke="' + accent + '" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="25" r="3" fill="#10151c"/>',
      galaxy: '<path d="M11 37c8-12 15-17 21-17s13 5 21 17l-10 4-11-8-11 8z" fill="' + accent + '"/><path d="M26 38h12l4 9H22z" fill="#f4f8ff" opacity=".88"/>'
    };
    var next = Object.assign({}, opts || {}, { accent: accent, title: String(opts && opts.title || (String(region || 'monster') + ' creature')) });
    return frameSvg(glyphs[String(region || 'province')] || glyphs.province, next);
  }

  function iconWayfarer(seed, opts) {
    var accent = String(opts && opts.accent || resolveAccent(seed || 'wayfarer'));
    return frameSvg(
      '<circle cx="32" cy="21" r="9" fill="' + accent + '" opacity=".95"/>'
      + '<path d="M18 49c2-10 7-17 14-17s12 7 14 17" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linecap="round"/>'
      + '<path d="M22 19l8-9 12 0 4 6" fill="none" stroke="#0f1620" stroke-width="3" stroke-linecap="round" opacity=".35"/>',
      Object.assign({}, opts || {}, { accent: accent })
    );
  }

  function iconTrophy(opts) {
    var accent = String(opts && opts.accent || '#e8c050');
    return frameSvg(
      '<path d="M22 14h20v9c0 7-4 14-10 16-6-2-10-9-10-16z" fill="' + accent + '"/>'
      + '<path d="M22 17h-6c0 8 4 12 10 12M42 17h6c0 8-4 12-10 12" fill="none" stroke="' + accent + '" stroke-width="4" stroke-linecap="round"/>'
      + '<rect x="28" y="39" width="8" height="7" rx="2" fill="#f6f0d5"/><rect x="22" y="46" width="20" height="6" rx="3" fill="#755127"/>',
      opts
    );
  }

  function iconVehicle(kind, opts) {
    var accents = { caravan: '#c98d44', starship: '#9ad7ff', naval: '#46c4b6' };
    var accent = accents[String(kind || 'caravan')] || '#e8c050';
    var glyphs = {
      caravan: '<path d="M12 38h34l6 7H12z" fill="' + accent + '"/><path d="M18 23h19l5 15H13z" fill="#6b4220" stroke="' + accent + '" stroke-width="2"/><circle cx="21" cy="49" r="5" fill="#1a2029" stroke="' + accent + '" stroke-width="2"/><circle cx="42" cy="49" r="5" fill="#1a2029" stroke="' + accent + '" stroke-width="2"/>',
      starship: '<path d="M32 9l10 17h10l-11 8 3 16-12-8-12 8 3-16-11-8h10z" fill="' + accent + '"/>',
      naval: '<path d="M10 41h44l-9 10H19z" fill="' + accent + '"/><path d="M30 15h4l8 18H22z" fill="#f4f8ff" opacity=".9"/><path d="M32 15v26" stroke="#24313f" stroke-width="3"/><path d="M18 47c4 4 8 4 12 0 4 4 8 4 12 0 4 4 8 4 12 0" fill="none" stroke="#7ec6d9" stroke-width="3" stroke-linecap="round"/>'
    };
    return frameSvg(glyphs[String(kind || 'caravan')] || glyphs.caravan, Object.assign({}, opts || {}, { accent: accent }));
  }

  function weaponKindFromName(name) {
    var n = String(name || '').toLowerCase();
    if (!n) return 'blade';
    if (/(hammer|maul|mace|club)/.test(n)) return 'hammer';
    if (/(spear|halberd|pike|lance|staff|scythe)/.test(n)) return 'polearm';
    if (/(bow|crossbow|sling)/.test(n)) return 'bow';
    if (/(pistol|rifle|musket|blunderbuss|carbine|gun)/.test(n)) return 'firearm';
    if (/(wand|stave|rod|focus)/.test(n)) return 'arcane';
    return 'blade';
  }

  function looksLikeWeapon(name) {
    var n = String(name || '').toLowerCase();
    if (!n) return false;
    return /(sword|axe|mace|hammer|maul|club|rapier|dagger|spear|halberd|pike|lance|staff|scythe|bow|crossbow|sling|pistol|rifle|musket|blunderbuss|carbine|gun|whip|katana|gladius|sabre|blade|weapon)/.test(n)
      || /\bstrike\b|\bshoot\b/.test(n);
  }

  function iconWeapon(name, opts) {
    var kind = weaponKindFromName(name);
    var accent = String(opts && opts.accent || resolveAccent(String(name || kind)));
    var glyphs = {
      blade: '<path d="M18 46l8-8 4 4-8 8h-4z" fill="#f0f4ff"/><path d="M30 40L48 18l-2-2-22 18z" fill="' + accent + '"/><path d="M45 15l4 4-3 3-4-4z" fill="#f6e3a2"/>',
      hammer: '<rect x="34" y="14" width="16" height="10" rx="2" fill="' + accent + '"/><rect x="40" y="24" width="4" height="26" rx="2" fill="#d8dee7"/><rect x="30" y="16" width="6" height="6" rx="1" fill="#93a1b5"/>',
      polearm: '<rect x="31" y="10" width="3" height="42" rx="1.5" fill="#d8dee7"/><path d="M33 10l9 9-9 5-9-5z" fill="' + accent + '"/>',
      bow: '<path d="M19 16c12 7 12 25 0 32" fill="none" stroke="' + accent + '" stroke-width="4" stroke-linecap="round"/><path d="M19 16v32" stroke="#d8dee7" stroke-width="2"/><path d="M19 32h22" stroke="#d8dee7" stroke-width="2"/><path d="M38 29l10 3-10 3z" fill="#f3f6fd"/>',
      firearm: '<rect x="14" y="26" width="28" height="8" rx="2" fill="' + accent + '"/><rect x="38" y="28" width="12" height="4" rx="1" fill="#d8dee7"/><path d="M22 34h8l3 8h-9z" fill="#8896ab"/>',
      arcane: '<path d="M31 10h2v34h-2z" fill="#d8dee7"/><circle cx="32" cy="18" r="8" fill="' + accent + '" opacity=".9"/><circle cx="32" cy="18" r="3" fill="#f9f4df"/><path d="M24 42h16l-3 10H27z" fill="#6f7f95"/>'
    };
    return frameSvg(glyphs[kind] || glyphs.blade, Object.assign({}, opts || {}, { accent: accent, title: String(opts && opts.title || name || 'Weapon') }));
  }

  function getWeaponIconLabelHtml(name, opts) {
    var label = String(name || 'Weapon');
    var includeWhenUnknown = !!(opts && opts.includeWhenUnknown);
    if (!includeWhenUnknown && !looksLikeWeapon(label)) return escHtml(label);
    return '<span style="display:inline-flex;align-items:center;gap:.34rem;">'
      + iconWeapon(label, { size: opts && opts.size || 20, title: label, accent: opts && opts.accent })
      + '<span>' + escHtml(label) + '</span></span>';
  }

  function buildPerchanceCharacterPrompt(state) {
    var safe = state || {};
    var traitPairs = [
      ['physique', 'Physique'],
      ['skin', 'Skin'],
      ['hair', 'Hair'],
      ['face', 'Face'],
      ['clothing', 'Clothing'],
      ['virtue', 'Virtue'],
      ['vice', 'Vice'],
      ['reputation', 'Reputation'],
      ['misfortune', 'Misfortune']
    ];
    var picked = [];
    for (var i = 0; i < traitPairs.length; i++) {
      var key = traitPairs[i][0];
      var label = traitPairs[i][1];
      var value = safe[key];
      if (!value && safe.traits && typeof safe.traits === 'object') value = safe.traits[key];
      if (value) picked.push(label + ': ' + String(value));
    }
    var fallback = [];
    if (safe.career) fallback.push('Career: ' + String(safe.career));
    if (safe.background) fallback.push('Background: ' + String(safe.background));
    if (safe.omen) fallback.push('Omen: ' + String(safe.omen));
    var tags = picked.length ? picked : fallback;
    var intro = 'fantasy character portrait, painterly, dramatic lighting';
    return intro + (tags.length ? (', ' + tags.join(', ')) : '');
  }

  function getPerchanceCharacterGeneratorUrl(state) {
    var prompt = buildPerchanceCharacterPrompt(state);
    return 'https://perchance.org/ai-character-generator?prompt=' + encodeURIComponent(prompt);
  }

  function getTraitsFromTraitsCard() {
    if (typeof document === 'undefined') return {};
    var container = document.getElementById('traitsDisplay');
    if (!container) return {};
    var rows = container.querySelectorAll('.stat-row');
    if (!rows || !rows.length) return {};

    var keyByLabel = {
      physique: 'physique',
      skin: 'skin',
      hair: 'hair',
      face: 'face',
      clothing: 'clothing',
      virtue: 'virtue',
      vice: 'vice',
      reputation: 'reputation',
      misfortune: 'misfortune'
    };
    var traits = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || !row.children || row.children.length < 2) continue;
      var labelText = String((row.children[0] && row.children[0].textContent) || '').toLowerCase().trim();
      var valueText = String((row.children[1] && row.children[1].textContent) || '').trim();
      var key = keyByLabel[labelText];
      if (key && valueText && valueText !== '-') {
        traits[key] = valueText;
      }
    }
    return traits;
  }

  function collectCurrentWayfarerTraits() {
    var stateTraits = (window.S && window.S.traits && typeof window.S.traits === 'object') ? window.S.traits : {};
    var cardTraits = getTraitsFromTraitsCard();
    var mergedTraits = Object.assign({}, stateTraits, cardTraits);
    return Object.assign({}, mergedTraits, {
      traits: mergedTraits,
      name: window.S && window.S.name,
      career: window.S && window.S.career,
      background: window.S && window.S.background,
      omen: window.S && window.S.omen
    });
  }

  function openWayfarerPortraitPreview(imageUrl, label, sourceLabel) {
    if (typeof document === 'undefined') return false;
    var modal = document.getElementById('rollModal');
    var titleEl = document.getElementById('modalTitle');
    var contentEl = document.getElementById('modalContent');
    var title = label || 'Portrait Preview';
    var body = ''
      + '<div style="display:grid;gap:.65rem;">'
      + '<div style="font-size:.75rem;color:var(--muted2);">' + escHtml(sourceLabel || 'Custom portrait') + '</div>'
      + '<div style="border:1px solid var(--border2);border-radius:12px;overflow:hidden;background:var(--surface);max-width:100%;">'
      + '<img src="' + escHtml(imageUrl || '') + '" alt="Portrait preview" style="display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;"/>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">'
      + '<button class="btn btn-sm btn-primary" onclick="window.SharedIconSystem.clearWayfarerPortraitImage();closeModal();">Clear Portrait</button>'
      + '<button class="btn btn-sm" onclick="closeModal();">Close</button>'
      + '</div>'
      + '</div>';

    if ((!modal || !titleEl || !contentEl) && typeof window.openModal === 'function') {
      window.openModal(title, body);
      return true;
    }
    if (!modal || !titleEl || !contentEl) return false;

    titleEl.textContent = title;
    contentEl.innerHTML = body;
    modal.style.display = 'flex';
    return true;
  }

  function rerenderWayfarerPortrait() {
    return false;
  }

  function setWayfarerPortraitImage(imageUrl, sourceLabel) {
    if (typeof window === 'undefined') return false;
    var next = String(imageUrl || '').trim();
    if (!next) return false;
    if (!window.S || typeof window.S !== 'object') window.S = {};
    window.S.portraitImage = next;
    window.S.portraitSource = String(sourceLabel || 'Custom portrait');
    rerenderWayfarerPortrait();
    if (typeof window.showNotif === 'function') {
      window.showNotif('Portrait image updated', 'good');
    }
    return true;
  }

  function downscaleImageDataUrl(dataUrl, done) {
    if (typeof done !== 'function') return;
    var src = String(dataUrl || '');
    if (!src) {
      done('');
      return;
    }
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      done(src);
      return;
    }
    var img = new Image();
    img.onload = function () {
      try {
        var maxEdge = 1024;
        var w = Number(img.naturalWidth || img.width || 0);
        var h = Number(img.naturalHeight || img.height || 0);
        if (!w || !h) {
          done(src);
          return;
        }
        var scale = Math.min(1, maxEdge / Math.max(w, h));
        var outW = Math.max(1, Math.round(w * scale));
        var outH = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          done(src);
          return;
        }
        ctx.drawImage(img, 0, 0, outW, outH);
        var out = canvas.toDataURL('image/jpeg', 0.82);
        if (!out || out.length > src.length) {
          done(src);
          return;
        }
        done(out);
      } catch (_err) {
        done(src);
      }
    };
    img.onerror = function () { done(src); };
    img.src = src;
  }

  function clearWayfarerPortraitImage() {
    if (typeof window === 'undefined' || !window.S || typeof window.S !== 'object') return false;
    delete window.S.portraitImage;
    delete window.S.portraitSource;
    rerenderWayfarerPortrait();
    if (typeof window.showNotif === 'function') {
      window.showNotif('Portrait cleared', 'good');
    }
    return true;
  }

  function promptWayfarerPortraitImageUrl() {
    if (typeof window === 'undefined') return false;
    var current = window.S && window.S.portraitImage ? String(window.S.portraitImage) : '';
    var entered = window.prompt('Paste an image URL or data URL for the portrait slot:', current);
    if (!entered) return false;
    return setWayfarerPortraitImage(entered, 'Image URL');
  }

  function pickWayfarerPortraitImage() {
    if (typeof document === 'undefined') return false;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var raw = String(reader.result || '');
        downscaleImageDataUrl(raw, function (finalData) {
          setWayfarerPortraitImage(String(finalData || raw), 'Uploaded image');
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
    return true;
  }

  function launchAiCharacterGenerator(targetId, state) {
    var perchanceUrl = getPerchanceCharacterGeneratorUrl(state || collectCurrentWayfarerTraits());
    if (typeof window !== 'undefined' && window.open) {
      window.open(perchanceUrl, '_blank', 'noopener,noreferrer');
      return true;
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = perchanceUrl;
      return true;
    }
    return false;
  }

  function getChestAccent(tier) {
    return {
      bronze: '#c98d44',
      silver: '#c5ccd6',
      gold: '#e8c050',
      platinum: '#8ce4f4'
    }[String(tier || 'bronze')] || '#c98d44';
  }

  function getRaidChestLabelHtml(tier, label, opts) {
    var accent = getChestAccent(tier);
    var text = escHtml(label || 'Chest');
    return '<span style="display:inline-flex;align-items:center;gap:.35rem;">'
      + iconChest(Object.assign({}, opts || {}, { size: opts && opts.size || 22, accent: accent, title: text }))
      + '<span>' + text + '</span></span>';
  }

  function getRaidMedalStripHtml(count, opts) {
    var label = escHtml(opts && opts.label || 'Raid Medals');
    var total = Math.max(0, Number(count || 0));
    return '<span style="display:inline-flex;align-items:center;gap:.38rem;">'
      + iconMedal({ size: opts && opts.size || 20, accent: opts && opts.accent || '#e8c050', title: label })
      + '<span style="color:var(--gold2);">' + label + ': ' + total + '</span></span>';
  }

  function getTrophyEntryHtml(name, opts) {
    var trophyName = String(name || 'Unknown Trophy');
    return '<div style="display:flex;align-items:center;gap:.42rem;padding:.08rem 0;border-bottom:1px solid rgba(255,255,255,.06);">'
      + iconTrophy({ size: opts && opts.size || 22, accent: resolveAccent(trophyName), title: trophyName })
      + '<span>' + escHtml(trophyName) + '</span></div>';
  }

  function getBestiaryEntryIconHtml(region, entry, opts) {
    var title = entry && entry.name ? entry.name : 'Bestiary Entry';
    return iconMonster(region, Object.assign({}, opts || {}, { title: title }));
  }

  function getWayfarerPortraitHtml(state, opts) {
    var safeState = state || {};
    var name = safeState.name || 'Unnamed Wayfarer';
    var career = safeState.career || 'Wanderer';
    var background = safeState.background || 'Unwritten origin';
    var omen = safeState.omen || 'No omen chosen';
    var portraitImage = safeState.portraitImage || '';
    var portraitSource = safeState.portraitSource || 'Custom portrait';
    var perchanceUrl = getPerchanceCharacterGeneratorUrl(safeState);
    var accent = resolveAccent([name, career, background, omen].join('|'));
    var compact = !!(opts && opts.compact);
    var portraitSize = Math.max(72, Number(opts && opts.size || 84));
    var portrait = portraitImage
      ? '<button type="button" class="btn btn-xs" onclick="window.SharedIconSystem.openWayfarerPortraitPreview(' + JSON.stringify(String(portraitImage)) + ',' + JSON.stringify(String(name)) + ',' + JSON.stringify(String(portraitSource)) + ');" style="padding:0;border:none;background:transparent;line-height:0;cursor:pointer;">'
        + '<img src="' + escHtml(portraitImage) + '" alt="' + escHtml(name) + ' portrait" style="width:' + portraitSize + 'px;height:' + portraitSize + 'px;object-fit:cover;border-radius:14px;border:1px solid ' + accent + ';box-shadow:0 8px 18px rgba(0,0,0,.22);display:block;"/>'
        + '</button>'
      : iconWayfarer([name, career].join('|'), { size: portraitSize, accent: accent, title: name });
    if (compact) {
      return '<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:.5rem;align-items:center;padding:.48rem .54rem;border:1px solid ' + accent + '55;background:linear-gradient(155deg, ' + accent + '14, rgba(9,13,18,.9));">'
        + '<div style="flex:0 0 auto;">' + portrait + '</div>'
        + '<div style="min-width:0;">'
          + '<div style="font-size:.78rem;color:var(--text2);font-family:Cinzel,serif;line-height:1.2;">' + escHtml(name) + '</div>'
          + '<div style="font-size:.68rem;color:' + accent + ';text-transform:uppercase;letter-spacing:.1em;">' + escHtml(career) + '</div>'
          + '<div style="font-size:.64rem;color:var(--muted2);line-height:1.35;margin-top:.1rem;">' + escHtml(background) + '</div>'
        + '</div>'
      + '</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:.5rem;padding:.58rem .62rem;border:1px solid ' + accent + '55;background:linear-gradient(155deg, ' + accent + '16, rgba(9,13,18,.92));">'
      + '<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:.65rem;align-items:start;">'
      + '<div style="flex:0 0 auto;">' + portrait + '</div>'
      + '<div style="min-width:0;display:flex;flex-direction:column;gap:.12rem;">'
      + '<div style="font-size:.8rem;color:var(--text2);font-family:Cinzel,serif;line-height:1.2;">' + escHtml(name) + '</div>'
      + '<div style="font-size:.7rem;color:' + accent + ';text-transform:uppercase;letter-spacing:.1em;">' + escHtml(career) + '</div>'
      + '<div style="font-size:.66rem;color:var(--muted2);line-height:1.45;">' + escHtml(background) + '</div>'
      + '<div style="display:flex;gap:.2rem;flex-wrap:wrap;align-items:center;margin-top:.08rem;">'
      + '<span style="font-size:.58rem;padding:.08rem .22rem;border:1px solid ' + accent + '44;color:' + accent + ';text-transform:uppercase;letter-spacing:.08em;">Omen</span>'
      + '<span style="font-size:.6rem;color:var(--muted2);">' + escHtml(omen) + '</span>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;padding-top:.35rem;border-top:1px solid ' + accent + '22;">'
      + '<a class="btn btn-xs btn-primary" href="' + perchanceUrl + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:.25rem;text-decoration:none;">📖 Open Perchance</a>'
      + '<button class="btn btn-xs" onclick="window.SharedIconSystem.promptWayfarerPortraitImageUrl();" style="display:inline-flex;align-items:center;gap:.25rem;text-decoration:none;">🔗 Image URL</button>'
      + '<button class="btn btn-xs" onclick="window.SharedIconSystem.pickWayfarerPortraitImage();" style="display:inline-flex;align-items:center;gap:.25rem;text-decoration:none;">📁 Upload Image</button>'
      + (portraitImage ? '<button class="btn btn-xs btn-red" onclick="window.SharedIconSystem.clearWayfarerPortraitImage();" style="display:inline-flex;align-items:center;gap:.25rem;text-decoration:none;">✕ Clear Image</button>' : '')
      + '</div>'
      + (portraitImage ? '<div style="font-size:.62rem;color:var(--muted);">Click the portrait to open a larger preview. Source: ' + escHtml(portraitSource) + '</div>' : '<div style="font-size:.62rem;color:var(--muted);">Open Perchance, then paste or upload the resulting image into this slot.</div>')
      + '</div>';
  }

  function renderWayfarerSheetPanel(targetId, state) {
    if (typeof document === 'undefined') return false;
    var el = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
    if (!el) return false;
    el.innerHTML = '';
    el.style.display = 'none';
    return false;
  }

  window.SharedIconSystem = {
    iconMedal: iconMedal,
    iconChest: iconChest,
    iconMonster: iconMonster,
    iconWayfarer: iconWayfarer,
    iconTrophy: iconTrophy,
    iconVehicle: iconVehicle,
    iconWeapon: iconWeapon,
    looksLikeWeapon: looksLikeWeapon,
    getWeaponIconLabelHtml: getWeaponIconLabelHtml,
    getRaidChestLabelHtml: getRaidChestLabelHtml,
    getRaidMedalStripHtml: getRaidMedalStripHtml,
    getTrophyEntryHtml: getTrophyEntryHtml,
    getBestiaryEntryIconHtml: getBestiaryEntryIconHtml,
    getPerchanceCharacterGeneratorUrl: getPerchanceCharacterGeneratorUrl,
    launchAiCharacterGenerator: launchAiCharacterGenerator,
    openWayfarerPortraitPreview: openWayfarerPortraitPreview,
    setWayfarerPortraitImage: setWayfarerPortraitImage,
    clearWayfarerPortraitImage: clearWayfarerPortraitImage,
    promptWayfarerPortraitImageUrl: promptWayfarerPortraitImageUrl,
    pickWayfarerPortraitImage: pickWayfarerPortraitImage,
    getWayfarerPortraitHtml: getWayfarerPortraitHtml,
    renderWayfarerSheetPanel: renderWayfarerSheetPanel,
    resolveAccent: resolveAccent
  };
})();
