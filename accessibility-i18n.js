(function () {
  var STORAGE_KEY = 'beyond-light-language';
  var CACHE_KEY = 'beyond-light-language-cache-v1';
  var FALLBACK_LANGUAGE = 'en';
  var AUTO_TRANSLATE_SOURCE = 'en';
  var AUTO_TRANSLATE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
  var AUTO_TRANSLATE_ATTRS = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt'];
  var NON_TRANSLATABLE_TAGS = {
    SCRIPT: true,
    STYLE: true,
    NOSCRIPT: true,
    CODE: true,
    PRE: true,
    TEXTAREA: true
  };
  var translationCache = {};
  var originalTextByNode = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var originalAttrsByNode = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var translationObserver = null;
  var translationTimer = null;
  var suppressObserver = false;
  var translatePassCounter = 0;
  var pendingLanguageStatusNotice = false;
  var latestTranslationStatus = 'idle';
  var lastStatusNoticeAt = 0;
  var lastStatusNoticeKey = '';
  var dictionaries = {
    en: {
      'common.on': 'On',
      'common.off': 'Off',
      'settings.accessibility.title': 'Accessibility',
      'settings.accessibility.language.label': 'Language',
      'settings.accessibility.language.helper': 'Choose a language for accessibility labels and guidance.',
      'settings.accessibility.language.aria': 'Accessibility language',
      'settings.accessibility.palette.label': 'Color Blind Friendly Palette',
      'settings.accessibility.palette.help': 'Uses higher-contrast, color-blind-safe accents.',
      'settings.accessibility.palette.preview': 'Preview 10s',
      'settings.accessibility.monochrome.label': 'All-Color Difficulty Mode',
      'settings.accessibility.monochrome.help': 'Forces a strict black-and-white palette with shape/text cues (no color reliance).',
      'settings.accessibility.phoneLayout.label': 'Phone Layout',
      'settings.accessibility.phoneLayout.help': 'Reflows navigation, settings, and campaign tools into a tighter single-column phone layout.',
      'settings.accessibility.textSize.label': 'Text Size',
      'settings.accessibility.textSize.help': 'Scales all text across the app.',
      'settings.accessibility.textSize.small': 'Small',
      'settings.accessibility.textSize.medium': 'Medium',
      'settings.accessibility.textSize.large': 'Large',
      'settings.accessibility.preview.enabled': 'Color-blind mode is enabled and saved.',
      'settings.accessibility.preview.active': 'Preview active ({seconds}s remaining).',
      'settings.accessibility.preview.ready': 'Preview applies temporarily for 10 seconds.',
      'settings.accessibility.preview.running': 'Previewing...',
      'settings.accessibility.notif.previewAlreadyEnabled': 'Color-blind mode is already enabled.'
    },
    es: {
      'common.on': 'Activado',
      'common.off': 'Desactivado',
      'settings.accessibility.title': 'Accesibilidad',
      'settings.accessibility.language.label': 'Idioma',
      'settings.accessibility.language.helper': 'Elige un idioma para etiquetas y guias de accesibilidad.',
      'settings.accessibility.language.aria': 'Idioma de accesibilidad',
      'settings.accessibility.palette.label': 'Paleta amigable para daltonismo',
      'settings.accessibility.palette.help': 'Usa acentos de mayor contraste compatibles con daltonismo.',
      'settings.accessibility.palette.preview': 'Vista previa 10 s',
      'settings.accessibility.monochrome.label': 'Modo de dificultad sin color',
      'settings.accessibility.monochrome.help': 'Fuerza una paleta estricta en blanco y negro con pistas de forma/texto (sin depender del color).',
      'settings.accessibility.phoneLayout.label': 'Diseno para telefono',
      'settings.accessibility.phoneLayout.help': 'Reorganiza navegacion, ajustes y herramientas de campana en una columna para telefono.',
      'settings.accessibility.textSize.label': 'Tamano de texto',
      'settings.accessibility.textSize.help': 'Escala todo el texto en la aplicacion.',
      'settings.accessibility.textSize.small': 'Pequeno',
      'settings.accessibility.textSize.medium': 'Mediano',
      'settings.accessibility.textSize.large': 'Grande',
      'settings.accessibility.preview.enabled': 'El modo para daltonismo esta activado y guardado.',
      'settings.accessibility.preview.active': 'Vista previa activa ({seconds}s restantes).',
      'settings.accessibility.preview.ready': 'La vista previa se aplica temporalmente por 10 segundos.',
      'settings.accessibility.preview.running': 'Mostrando vista previa...',
      'settings.accessibility.notif.previewAlreadyEnabled': 'El modo para daltonismo ya esta activado.'
    },
    pt: {
      'common.on': 'Ligado',
      'common.off': 'Desligado',
      'settings.accessibility.title': 'Acessibilidade',
      'settings.accessibility.language.label': 'Idioma',
      'settings.accessibility.language.helper': 'Escolha um idioma para rotulos e orientacoes de acessibilidade.',
      'settings.accessibility.language.aria': 'Idioma de acessibilidade',
      'settings.accessibility.palette.label': 'Paleta amigavel para daltonismo',
      'settings.accessibility.palette.help': 'Usa acentos de alto contraste seguros para daltonismo.',
      'settings.accessibility.palette.preview': 'Previa 10 s',
      'settings.accessibility.monochrome.label': 'Modo de dificuldade sem cor',
      'settings.accessibility.monochrome.help': 'Forca uma paleta estrita em preto e branco com pistas de forma/texto (sem depender de cor).',
      'settings.accessibility.phoneLayout.label': 'Layout para celular',
      'settings.accessibility.phoneLayout.help': 'Reorganiza navegacao, configuracoes e ferramentas de campanha em uma coluna mais compacta.',
      'settings.accessibility.textSize.label': 'Tamanho do texto',
      'settings.accessibility.textSize.help': 'Escala todo o texto no app.',
      'settings.accessibility.textSize.small': 'Pequeno',
      'settings.accessibility.textSize.medium': 'Medio',
      'settings.accessibility.textSize.large': 'Grande',
      'settings.accessibility.preview.enabled': 'O modo para daltonismo esta ativado e salvo.',
      'settings.accessibility.preview.active': 'Previa ativa ({seconds}s restantes).',
      'settings.accessibility.preview.ready': 'A previa e aplicada temporariamente por 10 segundos.',
      'settings.accessibility.preview.running': 'Mostrando previa...',
      'settings.accessibility.notif.previewAlreadyEnabled': 'O modo para daltonismo ja esta ativado.'
    }
  };

  var currentLanguage = FALLBACK_LANGUAGE;

  function loadTranslationCache() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (parsed && typeof parsed === 'object') {
        translationCache = parsed;
      }
    } catch (_err) {
      translationCache = {};
    }
  }

  function persistTranslationCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(translationCache));
    } catch (_err) {}
  }

  function normalizeLanguage(value) {
    var base = String(value || '').trim().toLowerCase();
    if (!base) return FALLBACK_LANGUAGE;
    var shortCode = base.split('-')[0];
    if (Object.prototype.hasOwnProperty.call(dictionaries, shortCode)) return shortCode;
    return FALLBACK_LANGUAGE;
  }

  function applyDocumentLanguage(lang) {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
    }
  }

  function getStoredLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(STORAGE_KEY) || '');
    } catch (_err) {
      return FALLBACK_LANGUAGE;
    }
  }

  function getBrowserLanguage() {
    if (typeof navigator === 'undefined') return FALLBACK_LANGUAGE;
    return normalizeLanguage(navigator.language || navigator.userLanguage || '');
  }

  function interpolate(template, params) {
    var values = params && typeof params === 'object' ? params : {};
    return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, function (_full, key) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) return '';
      return String(values[key]);
    });
  }

  function t(key, fallback, params) {
    var langDict = dictionaries[currentLanguage] || {};
    var fallbackDict = dictionaries[FALLBACK_LANGUAGE] || {};
    var value = Object.prototype.hasOwnProperty.call(langDict, key) ? langDict[key] : undefined;
    if (typeof value === 'undefined') value = fallbackDict[key];
    if (typeof value === 'undefined') value = typeof fallback === 'string' ? fallback : key;
    return interpolate(value, params);
  }

  function setLanguage(lang, options) {
    var opts = options || {};
    var normalized = normalizeLanguage(lang);
    currentLanguage = normalized;
    applyDocumentLanguage(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (_err) {}
    if (!opts.silent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('beyond:accessibility-language-changed', {
        detail: { language: normalized }
      }));
    }
    if (!opts.skipTranslate) {
      pendingLanguageStatusNotice = normalized !== FALLBACK_LANGUAGE;
      schedulePageTranslation();
    }
    return normalized;
  }

  function getSupportedLanguages() {
    return [
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Espanol' },
      { code: 'pt', label: 'Portugues' }
    ];
  }

  function getElementTag(node) {
    if (!node || node.nodeType !== 1) return '';
    return String(node.tagName || '').toUpperCase();
  }

  function canTranslateNode(node) {
    if (!node) return false;
    if (node.nodeType === 3) {
      var parent = node.parentElement;
      if (!parent) return false;
      if (parent.closest && parent.closest('[data-no-auto-translate="true"]')) return false;
      var tag = getElementTag(parent);
      if (NON_TRANSLATABLE_TAGS[tag]) return false;
      if (parent.isContentEditable) return false;
      return true;
    }
    if (node.nodeType === 1) {
      if (node.closest && node.closest('[data-no-auto-translate="true"]')) return false;
      var elTag = getElementTag(node);
      if (NON_TRANSLATABLE_TAGS[elTag]) return false;
      if (node.isContentEditable) return false;
      return true;
    }
    return false;
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function hasWords(value) {
    var text = normalizeWhitespace(value);
    if (!text || text.length < 2) return false;
    return /[A-Za-z]{2,}/.test(text);
  }

  function preserveTextPadding(original, translated) {
    var source = String(original || '');
    var left = source.match(/^\s*/);
    var right = source.match(/\s*$/);
    return (left ? left[0] : '') + String(translated || '') + (right ? right[0] : '');
  }

  function getCacheBucket(lang) {
    var key = normalizeLanguage(lang);
    if (!translationCache[key] || typeof translationCache[key] !== 'object') {
      translationCache[key] = {};
    }
    return translationCache[key];
  }

  function getCachedTranslation(lang, sourceText) {
    var bucket = getCacheBucket(lang);
    var source = normalizeWhitespace(sourceText);
    return Object.prototype.hasOwnProperty.call(bucket, source) ? bucket[source] : '';
  }

  function setCachedTranslation(lang, sourceText, translatedText) {
    var source = normalizeWhitespace(sourceText);
    var translated = normalizeWhitespace(translatedText);
    if (!source || !translated) return;
    var bucket = getCacheBucket(lang);
    bucket[source] = translated;
  }

  function fetchAutoTranslation(text, targetLanguage) {
    var query = new URLSearchParams({
      client: 'gtx',
      sl: AUTO_TRANSLATE_SOURCE,
      tl: targetLanguage,
      dt: 't',
      q: text
    });
    var url = AUTO_TRANSLATE_ENDPOINT + '?' + query.toString();
    return fetch(url)
      .then(function (res) {
        if (!res || !res.ok) throw new Error('Translation request failed');
        return res.json();
      })
      .then(function (payload) {
        if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
          return { text: text, usedFallback: true };
        }
        var pieces = payload[0].map(function (part) {
          return Array.isArray(part) ? String(part[0] || '') : '';
        }).join('');
        var translated = pieces || text;
        return { text: translated, usedFallback: translated === text };
      })
      .catch(function () {
        return { text: text, usedFallback: true };
      });
  }

  function translateMissingTextBatch(missingItems, targetLanguage) {
    if (!Array.isArray(missingItems) || !missingItems.length) {
      return Promise.resolve({ pairs: {}, fallbackCount: 0, total: 0 });
    }
    var pairs = {};
    var fallbackCount = 0;
    var queue = missingItems.slice();
    var concurrency = 4;
    var workers = [];
    function worker() {
      if (!queue.length) return Promise.resolve();
      var item = queue.shift();
      return fetchAutoTranslation(item, targetLanguage)
        .then(function (result) {
          var translated = result && typeof result.text === 'string' ? result.text : item;
          pairs[item] = translated;
          if (result && result.usedFallback) fallbackCount += 1;
        })
        .then(worker);
    }
    for (var i = 0; i < concurrency; i += 1) workers.push(worker());
    return Promise.all(workers).then(function () {
      return {
        pairs: pairs,
        fallbackCount: fallbackCount,
        total: missingItems.length
      };
    });
  }

  function emitTranslationStatus(status) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('beyond:translation-status', {
      detail: {
        status: status,
        language: currentLanguage,
        fallbackLanguage: FALLBACK_LANGUAGE
      }
    }));

    var noticeKey = status + ':' + currentLanguage;
    var now = Date.now();
    var shouldNotify = noticeKey !== lastStatusNoticeKey || (now - lastStatusNoticeAt) > 8000;
    if (!shouldNotify || typeof window.showNotif !== 'function') return;

    if (status === 'success') {
      window.showNotif('Language updated. Live translation is online.', 'info');
    } else if (status === 'cached') {
      window.showNotif('Language updated using cached translations.', 'info');
    } else if (status === 'fallback') {
      window.showNotif('Language updated, but live translation is partially unavailable. Some text may remain in English.', 'warn');
    }

    lastStatusNoticeKey = noticeKey;
    lastStatusNoticeAt = now;
  }

  function collectTranslatableUnits(root) {
    var scope = root && root.nodeType === 1 ? root : (document && document.body ? document.body : null);
    var textUnits = [];
    var attrUnits = [];
    if (!scope) return { textUnits: textUnits, attrUnits: attrUnits };

    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var textNode;
    while ((textNode = walker.nextNode())) {
      if (!canTranslateNode(textNode)) continue;
      var originalText = originalTextByNode && originalTextByNode.has(textNode)
        ? originalTextByNode.get(textNode)
        : textNode.nodeValue;
      if (originalTextByNode && !originalTextByNode.has(textNode)) {
        originalTextByNode.set(textNode, originalText);
      }
      if (currentLanguage === FALLBACK_LANGUAGE) {
        if (textNode.nodeValue !== originalText) textNode.nodeValue = originalText;
        continue;
      }
      if (!hasWords(originalText)) continue;
      textUnits.push({ node: textNode, source: originalText });
    }

    var allElements = scope.querySelectorAll ? scope.querySelectorAll('*') : [];
    Array.prototype.forEach.call(allElements, function (el) {
      if (!canTranslateNode(el)) return;
      var attrOriginals = originalAttrsByNode && originalAttrsByNode.has(el)
        ? originalAttrsByNode.get(el)
        : {};
      var touched = false;
      AUTO_TRANSLATE_ATTRS.forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        var currentVal = String(el.getAttribute(attr) || '');
        if (!currentVal) return;
        if (!Object.prototype.hasOwnProperty.call(attrOriginals, attr)) {
          attrOriginals[attr] = currentVal;
          touched = true;
        }
        var sourceAttr = attrOriginals[attr];
        if (currentLanguage === FALLBACK_LANGUAGE) {
          if (currentVal !== sourceAttr) el.setAttribute(attr, sourceAttr);
          return;
        }
        if (!hasWords(sourceAttr)) return;
        attrUnits.push({ element: el, attr: attr, source: sourceAttr });
      });
      if (touched && originalAttrsByNode) originalAttrsByNode.set(el, attrOriginals);
    });

    return { textUnits: textUnits, attrUnits: attrUnits };
  }

  function applyTranslatedUnits(unitsMap, textUnits, attrUnits) {
    suppressObserver = true;
    try {
      textUnits.forEach(function (unit) {
        var sourceKey = normalizeWhitespace(unit.source);
        var translated = Object.prototype.hasOwnProperty.call(unitsMap, sourceKey) ? unitsMap[sourceKey] : '';
        if (!translated) return;
        unit.node.nodeValue = preserveTextPadding(unit.source, translated);
      });
      attrUnits.forEach(function (unit) {
        var sourceKey = normalizeWhitespace(unit.source);
        var translated = Object.prototype.hasOwnProperty.call(unitsMap, sourceKey) ? unitsMap[sourceKey] : '';
        if (!translated) return;
        unit.element.setAttribute(unit.attr, translated);
      });
    } finally {
      suppressObserver = false;
    }
  }

  function ensureTranslationObserver() {
    if (translationObserver || typeof MutationObserver === 'undefined' || !document || !document.body) return;
    translationObserver = new MutationObserver(function () {
      if (suppressObserver || currentLanguage === FALLBACK_LANGUAGE) return;
      schedulePageTranslation();
    });
    translationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: AUTO_TRANSLATE_ATTRS
    });
  }

  function translatePage(root) {
    if (typeof document === 'undefined' || !document.body) return Promise.resolve();
    ensureTranslationObserver();
    translatePassCounter += 1;
    var targetLanguage = currentLanguage;
    var units = collectTranslatableUnits(root || document.body);
    var textUnits = units.textUnits;
    var attrUnits = units.attrUnits;
    if (targetLanguage === FALLBACK_LANGUAGE) return Promise.resolve();

    var sourceSet = {};
    textUnits.forEach(function (item) {
      sourceSet[normalizeWhitespace(item.source)] = true;
    });
    attrUnits.forEach(function (item) {
      sourceSet[normalizeWhitespace(item.source)] = true;
    });

    var sourceTexts = Object.keys(sourceSet).filter(Boolean);
    if (!sourceTexts.length) return Promise.resolve();

    var unitsMap = {};
    var missing = [];
    sourceTexts.forEach(function (source) {
      var cached = getCachedTranslation(targetLanguage, source);
      if (cached) {
        unitsMap[source] = cached;
      } else {
        missing.push(source);
      }
    });

    if (!missing.length) {
      latestTranslationStatus = 'cached';
      applyTranslatedUnits(unitsMap, textUnits, attrUnits);
      return Promise.resolve();
    }

    return translateMissingTextBatch(missing, targetLanguage).then(function (batchResult) {
      var fetched = batchResult && batchResult.pairs ? batchResult.pairs : {};
      var fallbackCount = batchResult && typeof batchResult.fallbackCount === 'number'
        ? batchResult.fallbackCount
        : 0;
      Object.keys(fetched).forEach(function (source) {
        var translated = fetched[source];
        if (!translated || translated === source) return;
        setCachedTranslation(targetLanguage, source, translated);
        unitsMap[source] = translated;
      });
      latestTranslationStatus = fallbackCount > 0 ? 'fallback' : 'success';
      persistTranslationCache();
      if (targetLanguage !== currentLanguage) return;
      applyTranslatedUnits(unitsMap, textUnits, attrUnits);
    });
  }

  function collectPriorityRoots() {
    var roots = [];
    function addRoot(node) {
      if (!node || node.nodeType !== 1) return;
      if (roots.indexOf(node) !== -1) return;
      roots.push(node);
    }

    if (typeof document === 'undefined') return roots;
    addRoot(document.querySelector('header'));
    addRoot(document.getElementById('mainNav'));
    addRoot(document.querySelector('.global-quick-access'));
    addRoot(document.getElementById('quickPanel'));
    addRoot(document.getElementById('campaignDock'));
    addRoot(document.getElementById('vttCampaignStoryPanel'));
    addRoot(document.querySelector('.tab-panel.active'));
    addRoot(document.querySelector('#settingsPanel .settings-popup'));

    var openModal = document.querySelector('#rollModal.open #modalContent');
    if (openModal) addRoot(openModal);

    if (!roots.length && document.body) addRoot(document.body);
    return roots;
  }

  function schedulePageTranslation(root) {
    if (typeof window === 'undefined') return;
    if (translationTimer) {
      clearTimeout(translationTimer);
      translationTimer = null;
    }
    translationTimer = setTimeout(function () {
      translationTimer = null;
      var explicitRoot = root && root.nodeType === 1 ? root : null;
      if (explicitRoot) {
        translatePage(explicitRoot).then(function () {
          if (pendingLanguageStatusNotice) {
            emitTranslationStatus(latestTranslationStatus);
            pendingLanguageStatusNotice = false;
          }
        });
        return;
      }

      var roots = collectPriorityRoots();
      var chain = Promise.resolve();
      roots.forEach(function (priorityRoot) {
        chain = chain.then(function () {
          return translatePage(priorityRoot);
        });
      });
      chain.then(function () {
        if (pendingLanguageStatusNotice) {
          emitTranslationStatus(latestTranslationStatus);
          pendingLanguageStatusNotice = false;
        }
      });
    }, 120);
  }

  function init() {
    loadTranslationCache();
    var stored = getStoredLanguage();
    if (stored && stored !== FALLBACK_LANGUAGE) {
      setLanguage(stored, { silent: true });
    } else {
      setLanguage(getBrowserLanguage(), { silent: true });
    }
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', schedulePageTranslation);
      } else {
        schedulePageTranslation();
      }
      window.addEventListener('load', schedulePageTranslation);
    }
  }

  init();

  window.accessibilityI18n = {
    t: t,
    setLanguage: setLanguage,
    getLanguage: function () { return currentLanguage; },
    getSupportedLanguages: getSupportedLanguages,
    translatePage: function (root) { return translatePage(root); },
    schedulePageTranslation: schedulePageTranslation,
    hasLanguage: function (lang) {
      var code = normalizeLanguage(lang);
      return Object.prototype.hasOwnProperty.call(dictionaries, code);
    }
  };
})();
