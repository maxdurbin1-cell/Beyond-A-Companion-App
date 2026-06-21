/* ============================================================
   audio-manager.js — Audio System for BEYOND: The Light
   Manages background music, sound effects, and notifications
   ============================================================ */

(function () {
  function normalizeScenarioKey(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // ── AUDIO MANAGER STATE ──────────────────────────────────────────────────────
  const AudioManager = {
    // Master state
    enabled: true,
    musicConsent: false,
    masterVolume: 0.7,
    currentMusic: null,
    currentMusicId: "",
    currentMusicBaseId: "",
    currentMusicPool: [],
    currentMusicRotationTimer: null,
    currentScenario: "",
    campaignSoundtrackOverride: null,
    currentAmbiences: [],
    musicVolume: 0.5,
    sfxVolume: 0.6,
    ambienceVolume: 0.45,
    currentTab: 'character',
    lastMusicSwitchAt: 0,
    musicSwitchCooldownMs: 900,
    sfxCooldownMs: 70,
    sfxRecentPlayedAt: {},
    assetPack: {
      enabled: true,
      manifestUrl: '/assets/audio/cc0-pack.json',
      status: 'idle',
      loadedCount: 0,
      loadedIds: []
    },

    // Audio cache
    audioContext: null,
    audioCache: {},
    musicPlayers: {},
    musicProfiles: {},
    musicVariantGroups: {},
    musicTrackMeta: {},
    musicSuiteStyles: {},
    scenarioSubstyleRules: [],
    tabAlbumStyles: {},
    ambienceProfiles: {},
    scenarioProfiles: {},
    recentMusicIds: [],
    initialized: false,

    emitNowPlayingChanged() {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      window.dispatchEvent(new CustomEvent('beyond:now-playing-changed', {
        detail: {
          id: String(this.currentMusicId || ''),
          baseId: String(this.currentMusicBaseId || ''),
          label: this.getNowPlayingLabel(),
          attribution: this.getNowPlayingAttribution()
        }
      }));
    },

    formatMusicLabel(musicId) {
      var raw = String(musicId || '').trim();
      if (!raw) return 'No track active';
      var meta = this.musicTrackMeta && this.musicTrackMeta[raw] ? this.musicTrackMeta[raw] : null;
      if (meta && meta.title) {
        var suite = meta.suiteLabel ? String(meta.suiteLabel) + ' · ' : '';
        return suite + String(meta.title);
      }
      return raw
        .replace(/^music[-_]?/i, '')
        .replace(/-v(\d+)$/i, ' · Variant $1')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, function (chr) { return chr.toUpperCase(); });
    },

    getNowPlayingLabel() {
      if (!this.musicConsent) return 'Music disabled';
      if (!this.currentMusicId) return 'No track active';
      return this.formatMusicLabel(this.currentMusicId);
    },

    getNowPlayingAttribution() {
      var id = String(this.currentMusicId || '').trim();
      if (!id) return '';
      var meta = this.musicTrackMeta && this.musicTrackMeta[id] ? this.musicTrackMeta[id] : null;
      if (!meta) return '';
      var bits = [];
      if (meta.source) bits.push('Source: ' + String(meta.source));
      if (meta.artist) bits.push('Artist: ' + String(meta.artist));
      if (meta.license) bits.push('License: ' + String(meta.license));
      if (meta.licenseUrl) bits.push(String(meta.licenseUrl));
      return bits.join(' | ');
    },

    formatSuiteLabel(suiteId) {
      var suite = String(suiteId || '').trim();
      if (!suite) return 'Playlist';
      var pool = this.getMusicVariantPool(suite);
      for (var i = 0; i < pool.length; i++) {
        var meta = this.musicTrackMeta && this.musicTrackMeta[pool[i]] ? this.musicTrackMeta[pool[i]] : null;
        if (meta && meta.suiteLabel) return String(meta.suiteLabel);
      }
      return suite
        .replace(/^music[-_]?suite[-_]?/i, '')
        .replace(/^music[-_]?/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, function (chr) { return chr.toUpperCase(); });
    },

    formatAmbienceLabel(ambienceId) {
      var raw = String(ambienceId || '').trim();
      if (!raw) return 'No ambience';
      return raw
        .replace(/^amb[-_]?/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, function (chr) { return chr.toUpperCase(); });
    },

    normalizeCampaignSoundtrack(config) {
      var raw = config && typeof config === 'object' ? config : {};
      var suiteId = String(raw.suiteId || raw.musicId || '').trim();
      var styleName = String(raw.styleName || raw.style || '').trim();
      var mood = String(raw.mood || raw.sceneMood || 'custom').trim() || 'custom';
      var rawAmbiences = Array.isArray(raw.ambienceIds)
        ? raw.ambienceIds.slice()
        : (raw.ambienceId ? [raw.ambienceId] : []);
      var seen = Object.create(null);
      var ambienceIds = rawAmbiences.map(function (entry) {
        return String(entry || '').trim();
      }).filter(function (entry) {
        if (!entry || seen[entry]) return false;
        seen[entry] = true;
        return !!entry;
      }).filter((entry) => {
        return !!(this.ambienceProfiles && this.ambienceProfiles[entry]);
      });
      var enabled = !!raw.enabled && !!suiteId;
      return {
        enabled: enabled,
        mood: mood,
        suiteId: enabled ? suiteId : '',
        styleName: enabled ? styleName : '',
        ambienceIds: enabled ? ambienceIds : []
      };
    },

    hasCampaignSoundtrackOverride() {
      var config = this.campaignSoundtrackOverride;
      return !!(config && config.enabled && config.suiteId);
    },

    getCampaignSoundtrackCatalog() {
      if (!Object.keys(this.musicSuiteStyles || {}).length || !Object.keys(this.ambienceProfiles || {}).length) {
        this.ensureInitialized();
      }
      var suiteIds = Object.keys(this.musicSuiteStyles || {});
      var suites = suiteIds.map((suiteId) => {
        var styleMap = this.musicSuiteStyles && this.musicSuiteStyles[suiteId] ? this.musicSuiteStyles[suiteId] : {};
        return {
          id: suiteId,
          label: this.formatSuiteLabel(suiteId),
          styles: Object.keys(styleMap).map(function (styleName) {
            return { id: styleName, label: String(styleName || '') };
          })
        };
      }).sort(function (a, b) {
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
      var ambiences = Object.keys(this.ambienceProfiles || {}).map((ambienceId) => {
        return {
          id: ambienceId,
          label: this.formatAmbienceLabel(ambienceId)
        };
      }).sort(function (a, b) {
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
      return { suites: suites, ambiences: ambiences };
    },

    applyCampaignSoundtrack(config, options = {}) {
      this.ensureInitialized();
      var previous = this.normalizeCampaignSoundtrack(this.campaignSoundtrackOverride);
      var next = this.normalizeCampaignSoundtrack(config);
      if (!next.enabled) return this.clearCampaignSoundtrack(options);
      this.campaignSoundtrackOverride = next;
      if (!this.enabled || !this.musicConsent) return next;
      var variantPool = this.resolveSuiteStylePool(next.suiteId, next.styleName);
      var previousHash = JSON.stringify(previous);
      var nextHash = JSON.stringify(next);
      var currentPoolHash = JSON.stringify(Array.isArray(this.currentMusicPool) ? this.currentMusicPool : []);
      var desiredPoolHash = JSON.stringify(variantPool);
      var forceVariant = options.forceVariantChange === true
        || previousHash !== nextHash
        || (String(this.currentMusicBaseId || '') === String(next.suiteId || '') && currentPoolHash !== desiredPoolHash);
      this.stopAmbience(options.fadeOut !== false);
      next.ambienceIds.forEach((ambienceId) => {
        if (this.ambienceProfiles[ambienceId]) this.playAmbience(ambienceId, 1, true);
      });
      this.playMusic(next.suiteId, options.fadeIn !== false, {
        allowCampaignOverride: true,
        forceVariantChange: forceVariant,
        variantPool: variantPool
      });
      return next;
    },

    clearCampaignSoundtrack(options = {}) {
      this.campaignSoundtrackOverride = null;
      if (!this.enabled || !this.musicConsent) return null;
      if (this.currentScenario) {
        this.playScenarioAudio(this.currentScenario, {
          fadeIn: options.fadeIn !== false,
          fadeOut: options.fadeOut !== false,
          allowCampaignOverride: true
        });
      } else {
        this.switchTabMusic(this.currentTab || 'character', {
          allowCampaignOverride: true
        });
      }
      return null;
    },

    getAssetPackAttributionEntries() {
      var ids = Array.isArray(this.assetPack && this.assetPack.loadedIds) ? this.assetPack.loadedIds.slice() : [];
      var seen = Object.create(null);
      var out = [];
      for (var i = 0; i < ids.length; i++) {
        var id = String(ids[i] || '').trim();
        if (!id || seen[id]) continue;
        seen[id] = true;
        var meta = this.musicTrackMeta && this.musicTrackMeta[id] ? this.musicTrackMeta[id] : {};
        out.push({
          id: id,
          title: String(meta.title || this.formatMusicLabel(id) || id),
          suiteLabel: String(meta.suiteLabel || '').trim(),
          style: String(meta.style || '').trim(),
          source: String(meta.source || '').trim(),
          artist: String(meta.artist || '').trim(),
          license: String(meta.license || '').trim(),
          licenseUrl: String(meta.licenseUrl || '').trim(),
          sourceUrl: String(meta.sourceUrl || '').trim(),
          src: String(meta.src || '').trim()
        });
      }
      out.sort(function (a, b) {
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
      return out;
    },

    emitAssetPackChanged() {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      window.dispatchEvent(new CustomEvent('beyond:audio-asset-pack-changed', {
        detail: {
          status: String(this.assetPack && this.assetPack.status || 'idle'),
          manifestUrl: String(this.assetPack && this.assetPack.manifestUrl || ''),
          loadedCount: Number(this.assetPack && this.assetPack.loadedCount || 0)
        }
      }));
    },

    // Initialize Web Audio API
    init() {
      if (this.initialized) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        
        // Resume audio context on user interaction (required by some browsers)
        const resumeAudio = () => {
          if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
              console.log('🔊 Audio context resumed');
            }).catch((err) => {
              console.warn('🔊 Failed to resume audio context:', err);
            });
          }
        };
        
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('keydown', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true });
        document.addEventListener('visibilitychange', () => {
          if (!this.musicConsent || !this.enabled) return;
          if (document.hidden) {
            this.stopAmbience(true);
          } else {
            if (this.hasCampaignSoundtrackOverride()) {
              this.applyCampaignSoundtrack(this.campaignSoundtrackOverride, {
                fadeIn: true,
                fadeOut: false
              });
            } else if (this.currentScenario) {
              this.playScenarioAudio(this.currentScenario, { fadeIn: true, fadeOut: false });
            } else {
              this.switchTabMusic(this.currentTab || 'character');
            }
          }
        });
        
        this.createSoundLibrary();
        this.initialized = true;
        if (this.musicConsent) this.loadOptionalAssetPack();
        console.log('🔊 Audio Manager initialized');
        console.log('🔊 Audio Context State:', this.audioContext.state);
      } catch (e) {
        console.warn('⚠️ Web Audio API not available:', e);
        this.enabled = false;
      }
    },

    ensureInitialized() {
      if (this.initialized || !this.enabled) return;
      this.init();
    },

    sampleWave(type, phase) {
      const p = phase % (Math.PI * 2);
      if (type === 'square') return Math.sign(Math.sin(p));
      if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(p));
      if (type === 'saw') {
        const unit = p / (Math.PI * 2);
        return 2 * (unit - Math.floor(unit + 0.5));
      }
      return Math.sin(p);
    },

    getBuffer(id) {
      if (this.audioCache[id]) return this.audioCache[id];
      if (this.musicProfiles[id]) {
        this.audioCache[id] = this.generateProceduralMusic(this.musicProfiles[id]);
        return this.audioCache[id];
      }
      if (this.ambienceProfiles[id]) {
        this.audioCache[id] = this.generateAmbienceBuffer(this.ambienceProfiles[id]);
        return this.audioCache[id];
      }
      return null;
    },

    rememberRecentMusic(id) {
      const next = String(id || '').trim();
      if (!next) return;
      this.recentMusicIds = [next].concat((this.recentMusicIds || []).filter(function (entry) {
        return String(entry || '') !== next;
      })).slice(0, 6);
    },

    clearMusicRotationTimer() {
      if (this.currentMusicRotationTimer) {
        clearTimeout(this.currentMusicRotationTimer);
        this.currentMusicRotationTimer = null;
      }
    },

    getMusicVariantPool(musicId) {
      const baseId = String(musicId || '').trim();
      const group = this.musicVariantGroups[baseId];
      if (Array.isArray(group) && group.length) return group.slice();
      return baseId ? [baseId] : [];
    },

    pickMusicVariant(musicId, excludeId, preferredPool) {
      const pool = (Array.isArray(preferredPool) && preferredPool.length ? preferredPool.slice() : this.getMusicVariantPool(musicId)).filter(Boolean);
      if (!pool.length) return { baseId: String(musicId || ''), chosenId: String(musicId || ''), pool: [] };
      const recent = Array.isArray(this.recentMusicIds) ? this.recentMusicIds.slice(0, 3) : [];
      let candidates = pool.filter((id) => id !== excludeId && recent.indexOf(id) === -1);
      if (!candidates.length) candidates = pool.filter((id) => id !== excludeId);
      if (!candidates.length) candidates = pool.slice();
      const chosenId = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
      return { baseId: String(musicId || ''), chosenId, pool };
    },

    scheduleMusicRotation(baseId, chosenId, bufferDuration) {
      this.clearMusicRotationTimer();
      const pool = Array.isArray(this.currentMusicPool) && this.currentMusicPool.length
        ? this.currentMusicPool.slice()
        : this.getMusicVariantPool(baseId);
      if (!baseId || pool.length < 2 || !this.musicConsent || !this.enabled) return;
      const seconds = Math.max(20, Math.round(Number(bufferDuration || 18) + 1));
      const self = this;
      this.currentMusicRotationTimer = setTimeout(function () {
        if (!self.musicConsent || !self.enabled) return;
        if (String(self.currentMusicBaseId || '') !== String(baseId || '')) return;
        self.playMusic(baseId, true, {
          allowCampaignOverride: true,
          forceVariantChange: true,
          excludeId: chosenId,
          preserveScenario: true,
          variantPool: pool.slice()
        });
      }, seconds * 1000);
    },

    registerMusicVariants(baseId, variantProfiles) {
      const group = [baseId];
      const entries = Array.isArray(variantProfiles) ? variantProfiles : [];
      entries.forEach((profile, index) => {
        const variantId = String(baseId || '') + '-v' + String(index + 1);
        this.musicProfiles[variantId] = Object.assign({}, this.musicProfiles[baseId] || {}, profile || {});
        group.push(variantId);
      });
      this.musicVariantGroups[baseId] = group;
    },

    async decodeAudioArrayBuffer(arrayBuffer) {
      if (!this.audioContext || !arrayBuffer) return null;
      try {
        return await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (_err) {
        return null;
      }
    },

    async fetchAudioBuffer(url) {
      if (!url || !this.audioContext) return null;
      const res = await fetch(String(url), { cache: 'force-cache' });
      if (!res.ok) throw new Error('Audio fetch failed: ' + String(url));
      const ab = await res.arrayBuffer();
      const decoded = await this.decodeAudioArrayBuffer(ab);
      if (!decoded) throw new Error('Audio decode failed: ' + String(url));
      return decoded;
    },

    getConfiguredAssetPackUrl() {
      var fromGlobal = '';
      if (typeof window !== 'undefined' && window.AUDIO_ASSET_PACK_URL) {
        fromGlobal = String(window.AUDIO_ASSET_PACK_URL || '').trim();
      }
      var fromStorage = '';
      try {
        fromStorage = String(localStorage.getItem('beyond-light-audio-asset-pack-url') || '').trim();
      } catch (_err) {}
      return fromStorage || fromGlobal || this.assetPack.manifestUrl;
    },

    isAssetPackEnabled() {
      if (!this.assetPack || this.assetPack.enabled === false) return false;
      try {
        var flag = localStorage.getItem('beyond-light-audio-asset-pack-enabled');
        if (flag === '0' || flag === 'false') return false;
      } catch (_err) {}
      return true;
    },

    async loadAssetPack(manifestUrl) {
      if (!this.audioContext) return { ok: false, error: 'Audio context unavailable.' };
      var url = String(manifestUrl || '').trim();
      if (!url) return { ok: false, error: 'Missing manifest URL.' };
      this.assetPack.status = 'loading';
      this.assetPack.loadedCount = 0;
      this.assetPack.loadedIds = [];
      try {
        var res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Manifest fetch failed (' + String(res.status) + ')');
        var manifest = await res.json();
        var entries = Array.isArray(manifest && manifest.entries) ? manifest.entries : [];
        var decodedBySrc = Object.create(null);
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i] || {};
          var id = String(entry.id || '').trim();
          var src = String(entry.src || '').trim();
          if (!id || !src) continue;
          try {
            var buffer = decodedBySrc[src] || null;
            if (!buffer) {
              buffer = await this.fetchAudioBuffer(src);
              if (buffer) decodedBySrc[src] = buffer;
            }
            if (!buffer) continue;
            this.audioCache[id] = buffer;
            this.assetPack.loadedIds.push(id);
            if (entry && typeof entry === 'object') {
              var existingMeta = this.musicTrackMeta && this.musicTrackMeta[id] ? this.musicTrackMeta[id] : {};
              this.musicTrackMeta[id] = Object.assign({}, existingMeta, {
                title: String(entry.title || existingMeta.title || '').trim() || existingMeta.title,
                style: String(entry.style || existingMeta.style || '').trim() || existingMeta.style,
                suiteLabel: String(entry.suiteLabel || existingMeta.suiteLabel || '').trim() || existingMeta.suiteLabel,
                source: String(entry.source || existingMeta.source || '').trim() || existingMeta.source,
                artist: String(entry.artist || existingMeta.artist || '').trim() || existingMeta.artist,
                license: String(entry.license || existingMeta.license || '').trim() || existingMeta.license,
                licenseUrl: String(entry.licenseUrl || existingMeta.licenseUrl || '').trim() || existingMeta.licenseUrl,
                sourceUrl: String(entry.sourceUrl || existingMeta.sourceUrl || '').trim() || existingMeta.sourceUrl,
                src: src
              });
            }
          } catch (_entryErr) {
            // Keep procedural fallback for missing/blocked assets.
          }
        }
        this.assetPack.status = 'ready';
        this.assetPack.loadedCount = this.assetPack.loadedIds.length;
        this.assetPack.manifestUrl = url;
        if (this.assetPack.loadedCount > 0) {
          console.log('🔊 Loaded optional asset pack tracks:', this.assetPack.loadedCount);
        } else {
          console.log('🔊 Asset pack manifest loaded with 0 decoded tracks; using procedural fallback.');
        }
        this.emitAssetPackChanged();
        return { ok: true, loaded: this.assetPack.loadedCount, manifestUrl: url };
      } catch (err) {
        this.assetPack.status = 'error';
        this.emitAssetPackChanged();
        return { ok: false, error: String(err && err.message ? err.message : err) };
      }
    },

    loadOptionalAssetPack() {
      if (!this.musicConsent) {
        this.assetPack.status = 'idle';
        this.emitAssetPackChanged();
        return;
      }
      if (!this.isAssetPackEnabled()) {
        this.assetPack.status = 'disabled';
        this.emitAssetPackChanged();
        return;
      }
      var url = this.getConfiguredAssetPackUrl();
      if (!url) {
        this.assetPack.status = 'idle';
        this.emitAssetPackChanged();
        return;
      }
      var self = this;
      setTimeout(function () {
        self.loadAssetPack(url).then(function (out) {
          if (!out || !out.ok) {
            console.log('🔊 Optional asset pack unavailable; procedural audio active.');
          }
        }).catch(function () {
          console.log('🔊 Optional asset pack failed; procedural audio active.');
        });
      }, 20);
    },

    setAssetPackEnabled(enabled) {
      this.assetPack.enabled = !!enabled;
      try {
        localStorage.setItem('beyond-light-audio-asset-pack-enabled', this.assetPack.enabled ? '1' : '0');
      } catch (_err) {}
      if (this.assetPack.enabled) this.loadOptionalAssetPack();
    },

    setAssetPackManifestUrl(url) {
      var next = String(url || '').trim();
      if (!next) return;
      this.assetPack.manifestUrl = next;
      try {
        localStorage.setItem('beyond-light-audio-asset-pack-url', next);
      } catch (_err) {}
      this.loadOptionalAssetPack();
    },

    stopAmbience(fadeOut = true) {
      if (!Array.isArray(this.currentAmbiences) || !this.currentAmbiences.length) return;
      const players = this.currentAmbiences.slice();
      this.currentAmbiences = [];
      players.forEach((entry) => {
        if (!entry || !entry.source || !entry.gainNode) return;
        if (fadeOut && this.audioContext) {
          const t0 = this.audioContext.currentTime;
          entry.gainNode.gain.cancelScheduledValues(t0);
          entry.gainNode.gain.setValueAtTime(entry.gainNode.gain.value, t0);
          entry.gainNode.gain.linearRampToValueAtTime(0, t0 + 1.2);
          setTimeout(() => {
            try { entry.source.stop(); } catch (_err) {}
          }, 1250);
        } else {
          try { entry.source.stop(); } catch (_err) {}
        }
      });
    },

    playAmbience(ambienceId, volume = 1, fadeIn = true) {
      this.ensureInitialized();
      if (!this.enabled || !this.audioContext || !this.musicConsent) return;
      const buffer = this.getBuffer(ambienceId);
      if (!buffer) return;
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      const target = Math.max(0, Math.min(1, this.masterVolume * this.ambienceVolume * volume));
      gainNode.gain.value = fadeIn ? 0 : target;
      source.start(0);
      if (fadeIn) {
        const t0 = this.audioContext.currentTime;
        gainNode.gain.linearRampToValueAtTime(target, t0 + 2.2);
      }
      this.currentAmbiences.push({ id: ambienceId, source, gainNode });
    },

    // ── CORE PLAYBACK FUNCTIONS ──────────────────────────────────────────────
    /**
     * Play a sound effect with volume control
     * @param {string} soundId - ID of the sound to play
     * @param {number} volume - Volume multiplier (0-1)
     */
    playSFX(soundId, volume = 1) {
      this.ensureInitialized();
      if (!this.enabled || !this.audioContext) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const sid = String(soundId || '');
      if (!sid) return;
      const now = Date.now();
      const prev = Number(this.sfxRecentPlayedAt[sid] || 0);
      if (prev > 0 && (now - prev) < Math.max(20, Number(this.sfxCooldownMs || 70))) return;
      this.sfxRecentPlayedAt[sid] = now;
      if (Object.keys(this.sfxRecentPlayedAt).length > 80) {
        var cutoff = now - 2500;
        var nextMap = {};
        Object.keys(this.sfxRecentPlayedAt).forEach((key) => {
          if (Number(this.sfxRecentPlayedAt[key] || 0) >= cutoff) nextMap[key] = this.sfxRecentPlayedAt[key];
        });
        this.sfxRecentPlayedAt = nextMap;
      }

      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          this.playSFX(soundId, volume);
        }).catch((err) => {
          console.warn('🔊 Unable to resume audio for SFX:', err);
        });
        return;
      }
      
      const finalVolume = this.masterVolume * this.sfxVolume * volume;
      
      try {
        const audioData = this.audioCache[soundId];
        if (!audioData) {
          console.warn(`🔊 Sound not found: ${soundId}`);
          return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = audioData;
        gainNode.gain.value = finalVolume;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
      } catch (e) {
        console.warn(`🔊 Error playing sound ${soundId}:`, e);
      }
    },

    /**
     * Play background music for a page (loops)
     * @param {string} musicId - ID of the music to play
     */
    playMusic(musicId, fadeIn = true, options = {}) {
      this.ensureInitialized();
      if (!this.enabled || !this.audioContext) {
        console.warn('🔊 Audio system disabled or no audio context');
        return;
      }

      if (!this.musicConsent) {
        return;
      }

      const baseId = String(musicId || '').trim();
      if (!baseId) return;
      if (this.hasCampaignSoundtrackOverride() && options.allowCampaignOverride !== true) {
        return;
      }
      const now = Date.now();
      if (!options.forceVariantChange && this.lastMusicSwitchAt > 0
        && (now - this.lastMusicSwitchAt) < Math.max(200, Number(this.musicSwitchCooldownMs || 900))) {
        return;
      }
      this.lastMusicSwitchAt = now;
      if (this.currentMusic && !options.forceVariantChange && String(this.currentMusicBaseId || '') === baseId) {
        return;
      }

      // Resume audio context if needed (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('🔊 Audio context resumed by playMusic');
          this.playMusic(musicId, fadeIn, options);
        }).catch((err) => {
          console.warn('🔊 Unable to resume audio for music:', err);
        });
        return;
      }

      // Stop current music
      if (this.currentMusic) {
        this.stopMusic(false);
      }

      try {
        const selection = this.pickMusicVariant(baseId, options.excludeId, options.variantPool);
        const chosenId = selection.chosenId;
        const musicData = this.getBuffer(chosenId);
        if (!musicData) {
          console.warn(`🔊 Music not found: ${chosenId}`);
          return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.loop = false;
        source.buffer = musicData;
        gainNode.gain.value = fadeIn ? 0 : this.masterVolume * this.musicVolume;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        var self = this;
        source.onended = function () {
          if (!self.currentMusic || self.currentMusic.source !== source) return;
          if (!self.musicConsent || !self.enabled) {
            self.currentMusic = null;
            self.currentMusicId = '';
            self.currentMusicBaseId = '';
            self.currentMusicPool = [];
            self.emitNowPlayingChanged();
            return;
          }
          self.currentMusic = null;
          self.playMusic(baseId, true, {
            allowCampaignOverride: true,
            forceVariantChange: true,
            excludeId: chosenId,
            preserveScenario: true,
            variantPool: Array.isArray(self.currentMusicPool) ? self.currentMusicPool.slice() : undefined
          });
        };
        source.start(0);

        this.currentMusic = { source, gainNode };
        this.currentMusicId = chosenId;
        this.currentMusicBaseId = baseId;
        this.currentMusicPool = selection.pool.slice();
        this.rememberRecentMusic(chosenId);
        this.emitNowPlayingChanged();
        console.log(`🔊 Now playing: ${chosenId} (base ${baseId}) (Context state: ${this.audioContext.state})`);

        // Fade in if requested
        if (fadeIn) {
          const startTime = this.audioContext.currentTime;
          const duration = 2; // 2 seconds fade
          for (let i = 0; i <= 10; i++) {
            gainNode.gain.setValueAtTime(
              (i / 10) * this.masterVolume * this.musicVolume,
              startTime + (i / 10) * duration
            );
          }
        }
        this.scheduleMusicRotation(baseId, chosenId, musicData.duration);
      } catch (e) {
        console.warn(`🔊 Error playing music ${baseId}:`, e);
      }
    },

    /**
     * Stop current background music
     */
    stopMusic(fadeOut = true) {
      if (!this.currentMusic) return;
      this.clearMusicRotationTimer();

      if (fadeOut) {
        const startTime = this.audioContext.currentTime;
        const duration = 1; // 1 second fade
        for (let i = 0; i <= 10; i++) {
          this.currentMusic.gainNode.gain.setValueAtTime(
            (1 - i / 10) * this.masterVolume * this.musicVolume,
            startTime + (i / 10) * duration
          );
        }
        setTimeout(() => {
          try {
            if (this.currentMusic) {
              this.currentMusic.source.stop();
              this.currentMusic = null;
              this.currentMusicId = '';
              this.currentMusicBaseId = '';
              this.currentMusicPool = [];
              this.emitNowPlayingChanged();
            }
          } catch (e) {
            console.warn('🔊 Error stopping music:', e);
          }
        }, duration * 1000);
      } else {
        try {
          this.currentMusic.source.stop();
          this.currentMusic = null;
          this.currentMusicId = '';
          this.currentMusicBaseId = '';
          this.currentMusicPool = [];
          this.emitNowPlayingChanged();
        } catch (e) {
          console.warn('🔊 Error stopping music:', e);
        }
      }
    },

    // ── AUDIO GENERATION HELPERS ─────────────────────────────────────────────
    /**
     * Generate a simple sine wave tone
     * @param {number} frequency - Frequency in Hz
     * @param {number} duration - Duration in seconds
     * @param {number} attackTime - Attack time in seconds
     * @param {number} decayTime - Decay time in seconds
     */
    generateTone(frequency, duration, attackTime = 0.01, decayTime = 0.1) {
      const sampleRate = this.audioContext.sampleRate;
      const buffer = this.audioContext.createBuffer(
        1,
        duration * sampleRate,
        sampleRate
      );
      const data = buffer.getChannelData(0);

      // Generate sine wave with envelope
      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const phase = (2 * Math.PI * frequency * t) % (2 * Math.PI);
        
        // Simple ADSR envelope
        let envelope = 1;
        if (t < attackTime) {
          envelope = t / attackTime;
        } else if (t < attackTime + decayTime) {
          envelope = 1 - ((t - attackTime) / decayTime) * 0.3;
        } else if (t > duration - decayTime) {
          envelope = (duration - t) / decayTime;
        }

        data[i] = Math.sin(phase) * envelope * 0.3; // Reduce volume
      }

      return buffer;
    },

    /**
     * Generate a noise burst (white noise)
     * @param {number} duration - Duration in seconds
     */
    generateNoise(duration) {
      const sampleRate = this.audioContext.sampleRate;
      const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < buffer.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }

      return buffer;
    },

    generateProceduralMusic(profile) {
      const cfg = Object.assign({
        duration: 56,
        root: 146.83,
        bpm: 72,
        mode: 'minor',
        energy: 0.45,
        shimmer: 0.35,
        drift: 0.0015,
        bassMix: 0.28,
        pulseMix: 0.25,
        padMix: 0.37,
        leadMix: 0.18,
        noiseMix: 0.05,
        waveformBass: 'triangle',
        waveformPad: 'sine',
        waveformLead: 'triangle',
        progression: [0, 3, 5, 4],
        melodyPattern: [0, 2, 4, 2, 5, 4, 2, 0],
        pulsePattern: [1, 0.45, 0.75, 0.4, 1, 0.45, 0.8, 0.45],
        sectionBeats: 12,
        swing: 0
      }, profile || {});
      const sampleRate = this.audioContext.sampleRate;
      const total = Math.floor(cfg.duration * sampleRate);
      const buffer = this.audioContext.createBuffer(2, total, sampleRate);
      const modeIntervals = cfg.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11, 12] : [0, 2, 3, 5, 7, 8, 10, 12];
      const beatDur = 60 / Math.max(40, Number(cfg.bpm || 72));
      const sectionBeats = Math.max(4, Number(cfg.sectionBeats || 12));
      const progression = Array.isArray(cfg.progression) && cfg.progression.length ? cfg.progression : [0, 3, 5, 4];
      const melodyPattern = Array.isArray(cfg.melodyPattern) && cfg.melodyPattern.length ? cfg.melodyPattern : [0, 2, 4, 2, 5, 4, 2, 0];
      const pulsePattern = Array.isArray(cfg.pulsePattern) && cfg.pulsePattern.length ? cfg.pulsePattern : [1, 0.45, 0.75, 0.4, 1, 0.45, 0.8, 0.45];
      const scaleFreq = (step) => cfg.root * Math.pow(2, modeIntervals[(step % modeIntervals.length + modeIntervals.length) % modeIntervals.length] / 12);
      const chL = buffer.getChannelData(0);
      const chR = buffer.getChannelData(1);
      let n1 = 0;
      let n2 = 0;

      for (let i = 0; i < total; i++) {
        const t = i / sampleRate;
        const section = Math.floor((t / beatDur) / sectionBeats) % progression.length;
        const chordRoot = progression[section];
        const freqRoot = scaleFreq(chordRoot);
        const freqThird = scaleFreq(chordRoot + 2);
        const freqFifth = scaleFreq(chordRoot + 4);
        const bassFreq = freqRoot / 2;
        const leadStep = Math.floor(t / (beatDur / 2)) % melodyPattern.length;
        const swingOffset = (leadStep % 2 === 1) ? (beatDur * 0.5 * Math.max(0, Math.min(0.35, Number(cfg.swing || 0)))) : 0;
        const leadFreq = scaleFreq(chordRoot + melodyPattern[leadStep]);
        const beatPos = (t / beatDur) % 1;
        const pulseIdx = Math.floor((t / (beatDur / 2))) % pulsePattern.length;
        const pulseGate = (beatPos < 0.22 ? 0.95 : 0.35) * Math.max(0.15, Math.min(1.1, Number(pulsePattern[pulseIdx] || 0.5)));
        const padDrift = 1 + Math.sin(2 * Math.PI * cfg.drift * i) * 0.012;
        const shimmerLfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.11 * t);

        const pad = (
          this.sampleWave(cfg.waveformPad, 2 * Math.PI * freqRoot * padDrift * t)
          + this.sampleWave(cfg.waveformPad, 2 * Math.PI * freqThird * padDrift * t)
          + this.sampleWave(cfg.waveformPad, 2 * Math.PI * freqFifth * padDrift * t)
        ) / 3;
        const bass = this.sampleWave(cfg.waveformBass, 2 * Math.PI * bassFreq * t) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.03 * t));
        const pulse = this.sampleWave('saw', 2 * Math.PI * (freqRoot * 2) * t) * pulseGate;
        const lead = this.sampleWave(cfg.waveformLead, 2 * Math.PI * leadFreq * (t + swingOffset)) * (0.4 + 0.6 * shimmerLfo);

        // Simple pink-ish noise source for texture.
        const white = (Math.random() * 2 - 1);
        n1 = 0.985 * n1 + 0.015 * white;
        n2 = 0.94 * n2 + 0.06 * white;
        const noise = (n1 + n2) * 0.5;

        let sample = 0;
        sample += pad * cfg.padMix;
        sample += bass * cfg.bassMix;
        sample += pulse * cfg.pulseMix * cfg.energy;
        sample += lead * cfg.leadMix * cfg.shimmer;
        sample += noise * cfg.noiseMix;

        const env = Math.min(1, t / 2.4) * Math.min(1, (cfg.duration - t) / 2.8);
        sample *= env * 0.65;
        const pan = Math.sin(2 * Math.PI * 0.04 * t) * 0.25;
        chL[i] = Math.max(-1, Math.min(1, sample * (1 - pan)));
        chR[i] = Math.max(-1, Math.min(1, sample * (1 + pan)));
      }

      return buffer;
    },

    generateAmbienceBuffer(profile) {
      const cfg = Object.assign({
        duration: 20,
        noiseColor: 'brown',
        lowCut: 0.985,
        highCut: 0.92,
        motionHz: 0.12,
        pulseHz: 0,
        crackle: 0,
        rumble: 0,
        hiss: 0.2,
        toneHz: 0,
        toneMix: 0
      }, profile || {});

      const sampleRate = this.audioContext.sampleRate;
      const total = Math.floor(cfg.duration * sampleRate);
      const buffer = this.audioContext.createBuffer(2, total, sampleRate);
      const l = buffer.getChannelData(0);
      const r = buffer.getChannelData(1);
      let lowL = 0;
      let lowR = 0;
      let highL = 0;
      let highR = 0;

      for (let i = 0; i < total; i++) {
        const t = i / sampleRate;
        const whiteL = Math.random() * 2 - 1;
        const whiteR = Math.random() * 2 - 1;
        lowL = cfg.lowCut * lowL + (1 - cfg.lowCut) * whiteL;
        lowR = cfg.lowCut * lowR + (1 - cfg.lowCut) * whiteR;
        highL = cfg.highCut * (highL + whiteL - lowL);
        highR = cfg.highCut * (highR + whiteR - lowR);
        const baseL = (cfg.noiseColor === 'brown' ? lowL : highL);
        const baseR = (cfg.noiseColor === 'brown' ? lowR : highR);
        const motion = 0.55 + 0.45 * Math.sin(2 * Math.PI * cfg.motionHz * t);
        const pulse = cfg.pulseHz > 0 ? (0.5 + 0.5 * Math.sin(2 * Math.PI * cfg.pulseHz * t)) : 1;
        const crack = Math.random() < (cfg.crackle / sampleRate) ? (Math.random() * 2 - 1) * 0.9 : 0;
        const rumble = cfg.rumble > 0 ? Math.sin(2 * Math.PI * cfg.rumble * t) * 0.35 : 0;
        const tone = cfg.toneHz > 0 ? Math.sin(2 * Math.PI * cfg.toneHz * t) * cfg.toneMix : 0;
        const hiss = (Math.random() * 2 - 1) * cfg.hiss * 0.25;
        const vL = (baseL * motion * pulse * 0.6) + crack + rumble + tone + hiss;
        const vR = (baseR * motion * pulse * 0.6) + crack + rumble + tone + hiss;
        l[i] = Math.max(-1, Math.min(1, vL * 0.5));
        r[i] = Math.max(-1, Math.min(1, vR * 0.5));
      }
      return buffer;
    },

    // ── SOUND LIBRARY CREATION ───────────────────────────────────────────────
    createSoundLibrary() {
      if (!this.audioContext) return;

      this.musicProfiles = {
        'music-character': { root: 110, bpm: 62, mode: 'minor', energy: 0.3, shimmer: 0.35 },
        'music-map': { root: 146.83, bpm: 68, mode: 'minor', energy: 0.34, shimmer: 0.5 },
        'music-combat': { root: 196, bpm: 116, mode: 'minor', energy: 0.95, shimmer: 0.22, pulseMix: 0.4, bassMix: 0.35 },
        'music-caravan': { root: 164.81, bpm: 78, mode: 'major', energy: 0.5, shimmer: 0.4 },
        'music-missions': { root: 130.81, bpm: 92, mode: 'minor', energy: 0.62, shimmer: 0.3 },

        'music-town': { root: 196, bpm: 82, mode: 'major', energy: 0.5, shimmer: 0.36 },
        'music-city': { root: 220, bpm: 94, mode: 'major', energy: 0.62, shimmer: 0.32 },
        'music-village': { root: 174.61, bpm: 74, mode: 'major', energy: 0.45, shimmer: 0.33 },
        'music-tavern': { root: 164.81, bpm: 102, mode: 'major', energy: 0.68, shimmer: 0.25 },
        'music-dark-streets': { root: 155.56, bpm: 86, mode: 'minor', energy: 0.56, shimmer: 0.2 },
        'music-wilderness': { root: 146.83, bpm: 72, mode: 'minor', energy: 0.48, shimmer: 0.44 },
        'music-dungeon': { root: 98, bpm: 70, mode: 'minor', energy: 0.58, shimmer: 0.15 },
        'music-sacred': { root: 130.81, bpm: 58, mode: 'minor', energy: 0.35, shimmer: 0.62 },
        'music-space': { root: 123.47, bpm: 64, mode: 'minor', energy: 0.42, shimmer: 0.78, noiseMix: 0.12 },
        'music-star-birth': { root: 246.94, bpm: 50, mode: 'major', energy: 0.4, shimmer: 0.95, noiseMix: 0.15 },
        'music-starship': { root: 174.61, bpm: 88, mode: 'minor', energy: 0.7, shimmer: 0.48 },
        'music-command': { root: 207.65, bpm: 96, mode: 'minor', energy: 0.72, shimmer: 0.3 },
        'music-derelict': { root: 92.5, bpm: 54, mode: 'minor', energy: 0.38, shimmer: 0.24, noiseMix: 0.2 },
        'music-sea': { root: 155.56, bpm: 66, mode: 'major', energy: 0.44, shimmer: 0.55 },
        'music-storm-sea': { root: 130.81, bpm: 112, mode: 'minor', energy: 0.92, shimmer: 0.2, noiseMix: 0.16 },
        'music-desert': { root: 138.59, bpm: 76, mode: 'minor', energy: 0.5, shimmer: 0.34 },
        'music-bazaar': { root: 233.08, bpm: 108, mode: 'major', energy: 0.72, shimmer: 0.31 },
        'music-ice': { root: 116.54, bpm: 70, mode: 'minor', energy: 0.46, shimmer: 0.68 },
        'music-industrial': { root: 82.41, bpm: 100, mode: 'minor', energy: 0.8, shimmer: 0.14, pulseMix: 0.45 },
        'music-ritual': { root: 103.83, bpm: 60, mode: 'minor', energy: 0.48, shimmer: 0.58 },
        'music-relic': { root: 185, bpm: 72, mode: 'major', energy: 0.4, shimmer: 0.72 }
      };

      this.registerMusicVariants('music-character', [
        { root: 98, bpm: 58, shimmer: 0.44, waveformPad: 'triangle' },
        { root: 123.47, bpm: 66, energy: 0.36, leadMix: 0.24 }
      ]);
      this.registerMusicVariants('music-map', [
        { root: 164.81, bpm: 72, shimmer: 0.62, waveformLead: 'sine' },
        { root: 138.59, bpm: 64, energy: 0.28, noiseMix: 0.08 }
      ]);
      this.registerMusicVariants('music-combat', [
        { root: 220, bpm: 124, energy: 1, pulseMix: 0.46 },
        { root: 174.61, bpm: 110, bassMix: 0.4, waveformLead: 'saw' }
      ]);
      this.registerMusicVariants('music-caravan', [
        { root: 174.61, bpm: 84, mode: 'major', shimmer: 0.48 },
        { root: 146.83, bpm: 76, energy: 0.42, waveformPad: 'triangle' }
      ]);
      this.registerMusicVariants('music-missions', [
        { root: 138.59, bpm: 98, energy: 0.72 },
        { root: 123.47, bpm: 86, shimmer: 0.24, bassMix: 0.34 }
      ]);
      this.registerMusicVariants('music-town', [
        { root: 207.65, bpm: 88, mode: 'major', shimmer: 0.4 },
        { root: 174.61, bpm: 78, energy: 0.44, waveformLead: 'sine' },
        { root: 196, bpm: 74, mode: 'major', shimmer: 0.5, leadMix: 0.22 }
      ]);
      this.registerMusicVariants('music-city', [
        { root: 246.94, bpm: 100, shimmer: 0.38 },
        { root: 196, bpm: 90, energy: 0.58, bassMix: 0.3 }
      ]);
      this.registerMusicVariants('music-village', [
        { root: 155.56, bpm: 70, mode: 'major', shimmer: 0.42 },
        { root: 185, bpm: 76, energy: 0.4, waveformPad: 'triangle' },
        { root: 164.81, bpm: 68, mode: 'major', shimmer: 0.5, leadMix: 0.2 }
      ]);
      this.registerMusicVariants('music-tavern', [
        { root: 174.61, bpm: 110, mode: 'major', pulseMix: 0.34 },
        { root: 146.83, bpm: 96, shimmer: 0.2, bassMix: 0.34 }
      ]);
      this.registerMusicVariants('music-dark-streets', [
        { root: 138.59, bpm: 82, shimmer: 0.16, noiseMix: 0.08 },
        { root: 164.81, bpm: 90, energy: 0.62, waveformLead: 'saw' }
      ]);
      this.registerMusicVariants('music-wilderness', [
        { root: 155.56, bpm: 74, shimmer: 0.52 },
        { root: 130.81, bpm: 68, energy: 0.42, waveformPad: 'triangle' },
        { root: 146.83, bpm: 64, mode: 'minor', shimmer: 0.58, leadMix: 0.18 }
      ]);
      this.registerMusicVariants('music-dungeon', [
        { root: 92.5, bpm: 62, shimmer: 0.12, noiseMix: 0.1 },
        { root: 110, bpm: 76, energy: 0.64, bassMix: 0.38 },
        { root: 98, bpm: 66, energy: 0.52, noiseMix: 0.18, pulseMix: 0.26 }
      ]);
      this.registerMusicVariants('music-sacred', [
        { root: 146.83, bpm: 54, shimmer: 0.8, leadMix: 0.22 },
        { root: 116.54, bpm: 62, mode: 'major', shimmer: 0.72 },
        { root: 138.59, bpm: 52, mode: 'major', shimmer: 0.88, waveformLead: 'sine' }
      ]);
      this.registerMusicVariants('music-space', [
        { root: 92.5, bpm: 58, shimmer: 0.92, noiseMix: 0.18 },
        { root: 138.59, bpm: 70, energy: 0.5, waveformPad: 'triangle' }
      ]);
      this.registerMusicVariants('music-star-birth', [
        { root: 261.63, bpm: 56, shimmer: 1, noiseMix: 0.22 },
        { root: 220, bpm: 48, mode: 'major', leadMix: 0.28 }
      ]);
      this.registerMusicVariants('music-starship', [
        { root: 185, bpm: 92, energy: 0.74, pulseMix: 0.32 },
        { root: 155.56, bpm: 84, shimmer: 0.56, waveformLead: 'saw' }
      ]);
      this.registerMusicVariants('music-command', [
        { root: 233.08, bpm: 100, energy: 0.76 },
        { root: 185, bpm: 90, shimmer: 0.22, bassMix: 0.36 }
      ]);
      this.registerMusicVariants('music-derelict', [
        { root: 82.41, bpm: 50, noiseMix: 0.24, shimmer: 0.16 },
        { root: 98, bpm: 60, energy: 0.44, waveformPad: 'triangle' }
      ]);
      this.registerMusicVariants('music-sea', [
        { root: 174.61, bpm: 70, shimmer: 0.66 },
        { root: 146.83, bpm: 62, energy: 0.38, waveformLead: 'sine' },
        { root: 164.81, bpm: 60, mode: 'major', shimmer: 0.72, leadMix: 0.2 }
      ]);
      this.registerMusicVariants('music-storm-sea', [
        { root: 116.54, bpm: 118, energy: 0.98, noiseMix: 0.2 },
        { root: 138.59, bpm: 104, bassMix: 0.42, pulseMix: 0.44 }
      ]);
      this.registerMusicVariants('music-desert', [
        { root: 146.83, bpm: 82, shimmer: 0.28 },
        { root: 123.47, bpm: 74, energy: 0.46, waveformPad: 'triangle' }
      ]);
      this.registerMusicVariants('music-bazaar', [
        { root: 261.63, bpm: 112, energy: 0.76 },
        { root: 207.65, bpm: 104, shimmer: 0.36, pulseMix: 0.36 }
      ]);
      this.registerMusicVariants('music-ice', [
        { root: 123.47, bpm: 74, shimmer: 0.82, leadMix: 0.22 },
        { root: 103.83, bpm: 66, energy: 0.4, noiseMix: 0.1 }
      ]);
      this.registerMusicVariants('music-industrial', [
        { root: 87.31, bpm: 108, pulseMix: 0.5, bassMix: 0.4 },
        { root: 73.42, bpm: 96, shimmer: 0.1, waveformLead: 'square' }
      ]);
      this.registerMusicVariants('music-ritual', [
        { root: 92.5, bpm: 56, shimmer: 0.7, noiseMix: 0.08 },
        { root: 116.54, bpm: 64, energy: 0.54, leadMix: 0.24 }
      ]);
      this.registerMusicVariants('music-relic', [
        { root: 196, bpm: 78, mode: 'major', shimmer: 0.84 },
        { root: 164.81, bpm: 68, energy: 0.34, waveformLead: 'sine' }
      ]);

      // Build larger, style-diverse suites (10 tracks each) for major tabs/contexts.
      var stylePresets = [
        { mode: 'major', bpmShift: -10, energyMul: 0.78, shimmerMul: 1.2, waveformLead: 'sine', waveformPad: 'triangle', waveformBass: 'triangle', progression: [0, 4, 5, 3], melodyPattern: [0, 2, 4, 7, 5, 4, 2, 0], pulsePattern: [1, 0.4, 0.72, 0.34, 1, 0.48, 0.8, 0.4], sectionBeats: 10, swing: 0.05, duration: 58 },
        { mode: 'minor', bpmShift: -4, energyMul: 0.92, shimmerMul: 1.05, waveformLead: 'triangle', waveformPad: 'sine', waveformBass: 'triangle', progression: [0, 3, 6, 4], melodyPattern: [0, 2, 3, 5, 7, 5, 3, 2], pulsePattern: [1, 0.5, 0.76, 0.44, 1, 0.5, 0.76, 0.4], sectionBeats: 12, swing: 0.02, duration: 62 },
        { mode: 'major', bpmShift: 6, energyMul: 1.08, shimmerMul: 0.88, waveformLead: 'saw', waveformPad: 'triangle', waveformBass: 'square', progression: [0, 5, 3, 4], melodyPattern: [0, 4, 7, 9, 7, 5, 4, 2], pulsePattern: [1, 0.62, 0.88, 0.56, 1, 0.64, 0.9, 0.6], sectionBeats: 8, swing: 0.08, duration: 52 },
        { mode: 'minor', bpmShift: 12, energyMul: 1.18, shimmerMul: 0.72, waveformLead: 'square', waveformPad: 'saw', waveformBass: 'triangle', progression: [0, 2, 5, 1], melodyPattern: [0, 2, 5, 7, 8, 7, 5, 2], pulsePattern: [1, 0.75, 0.95, 0.68, 1, 0.78, 0.94, 0.7], sectionBeats: 8, swing: 0.14, duration: 48 },
        { mode: 'minor', bpmShift: -14, energyMul: 0.68, shimmerMul: 1.35, waveformLead: 'sine', waveformPad: 'sine', waveformBass: 'triangle', progression: [0, 3, 4, 6], melodyPattern: [0, 1, 3, 5, 6, 5, 3, 1], pulsePattern: [0.82, 0.28, 0.62, 0.22, 0.84, 0.3, 0.64, 0.24], sectionBeats: 14, swing: 0.01, duration: 70 },
        { mode: 'major', bpmShift: 0, energyMul: 0.96, shimmerMul: 1.12, waveformLead: 'triangle', waveformPad: 'triangle', waveformBass: 'saw', progression: [0, 5, 4, 3], melodyPattern: [0, 2, 4, 5, 7, 5, 4, 2], pulsePattern: [1, 0.56, 0.86, 0.52, 1, 0.56, 0.86, 0.52], sectionBeats: 12, swing: 0.07, duration: 60 },
        { mode: 'minor', bpmShift: 8, energyMul: 1.15, shimmerMul: 0.9, waveformLead: 'saw', waveformPad: 'square', waveformBass: 'square', progression: [0, 1, 5, 4], melodyPattern: [0, 3, 5, 8, 7, 5, 3, 2], pulsePattern: [1, 0.7, 0.92, 0.66, 1, 0.7, 0.92, 0.66], sectionBeats: 10, swing: 0.16, duration: 50 },
        { mode: 'major', bpmShift: -6, energyMul: 0.86, shimmerMul: 1.3, waveformLead: 'sine', waveformPad: 'saw', waveformBass: 'triangle', progression: [0, 4, 2, 5], melodyPattern: [0, 4, 5, 7, 9, 7, 5, 4], pulsePattern: [0.95, 0.4, 0.72, 0.34, 0.95, 0.42, 0.74, 0.36], sectionBeats: 11, swing: 0.04, duration: 64 },
        { mode: 'minor', bpmShift: 3, energyMul: 1.02, shimmerMul: 0.98, waveformLead: 'triangle', waveformPad: 'square', waveformBass: 'triangle', progression: [0, 6, 3, 4], melodyPattern: [0, 2, 3, 6, 7, 6, 3, 2], pulsePattern: [1, 0.52, 0.8, 0.5, 1, 0.52, 0.8, 0.5], sectionBeats: 9, swing: 0.1, duration: 54 },
        { mode: 'major', bpmShift: 14, energyMul: 1.22, shimmerMul: 0.82, waveformLead: 'square', waveformPad: 'sine', waveformBass: 'saw', progression: [0, 5, 1, 4], melodyPattern: [0, 2, 4, 7, 11, 7, 4, 2], pulsePattern: [1, 0.82, 1, 0.76, 1, 0.84, 1, 0.76], sectionBeats: 8, swing: 0.18, duration: 46 }
      ];

      var transposeSteps = [0, 2, -2, 5, -5, 7, -7, 3, -3, 9];
      function rotatePattern(arr, shift) {
        var list = Array.isArray(arr) ? arr.slice() : [];
        if (!list.length) return list;
        var n = ((shift % list.length) + list.length) % list.length;
        return list.slice(n).concat(list.slice(0, n));
      }
      var makeSuiteTrackProfile = function (seedProfile, suiteBias, idx) {
        var style = stylePresets[idx % stylePresets.length] || stylePresets[0];
        var transpose = transposeSteps[idx % transposeSteps.length] + Number(suiteBias || 0);
        var rootScale = Math.pow(2, transpose / 12);
        var base = Object.assign({}, seedProfile || {});
        var mode = style.mode || base.mode || 'minor';
        var bpm = Math.max(44, Math.min(168, Math.round(Number(base.bpm || 72) + Number(style.bpmShift || 0) + ((idx % 3) - 1) * 2)));
        var energy = Math.max(0.2, Math.min(1.4, Number(base.energy || 0.45) * Number(style.energyMul || 1)));
        var shimmer = Math.max(0.1, Math.min(1.6, Number(base.shimmer || 0.35) * Number(style.shimmerMul || 1)));
        return Object.assign({}, base, {
          root: Math.max(60, Math.min(520, Number(base.root || 146.83) * rootScale)),
          mode: mode,
          bpm: bpm,
          energy: energy,
          shimmer: shimmer,
          waveformLead: style.waveformLead || base.waveformLead || 'triangle',
          waveformPad: style.waveformPad || base.waveformPad || 'sine',
          waveformBass: style.waveformBass || base.waveformBass || 'triangle',
          progression: rotatePattern(style.progression || [0, 3, 5, 4], idx % 4),
          melodyPattern: rotatePattern(style.melodyPattern || [0, 2, 4, 2, 5, 4, 2, 0], idx % 8),
          pulsePattern: rotatePattern(style.pulsePattern || [1, 0.45, 0.75, 0.4, 1, 0.45, 0.8, 0.45], idx % 8),
          sectionBeats: Math.max(8, Number(style.sectionBeats || 12) + ((idx % 2) ? 1 : 0)),
          swing: Math.max(0, Math.min(0.24, Number(style.swing || 0))),
          duration: Math.max(44, Number(style.duration || 56))
        });
      };

      this.musicTrackMeta = {};
      this.musicSuiteStyles = {};

      var suiteDefinitions = [
        { baseId: 'music-suite-character', seed: 'music-character', bias: 0, suiteLabel: 'Character Suite', styles: ['Campfire Chronicle', 'Quiet Resolve', 'Dreaming Relic', 'Heroic Thread', 'Velvet Memory'] },
        { baseId: 'music-suite-map', seed: 'music-map', bias: -2, suiteLabel: 'Map Suite', styles: ['Road Atlas', 'Frontier Cartography', 'Fog Of Routes', 'Landmark Echo', 'Surveyor Dawn'] },
        { baseId: 'music-suite-combat', seed: 'music-combat', bias: 3, suiteLabel: 'Combat Suite', styles: ['Iron Clash', 'Bloodclock March', 'Breakline Surge', 'Ashen Counter', 'No Mercy Cadence'] },
        { baseId: 'music-suite-caravan', seed: 'music-caravan', bias: 1, suiteLabel: 'Caravan Suite', styles: ['Folk Caravan', 'Dustroad Waltz', 'Wheelfire Ballad', 'Camp Lantern Reel', 'Nomad Overture'] },
        { baseId: 'music-suite-holding', seed: 'music-caravan', bias: -1, suiteLabel: 'Holding Suite', styles: ['Council Hall', 'Hearth Ledger', 'Banner Court', 'Foundry Noon', 'Steward Dawn'] },
        { baseId: 'music-suite-missions', seed: 'music-missions', bias: 2, suiteLabel: 'Missions Suite', styles: ['Contract Pulse', 'Silent Objective', 'Pressure Window', 'Final Brief', 'After Action'] },
        { baseId: 'music-suite-jobs', seed: 'music-missions', bias: 4, suiteLabel: 'Jobs Suite', styles: ['Clockwork Errand', 'Street Contract', 'Late Shift Steel', 'Deadline Alley', 'Cargo Neon'] },
        { baseId: 'music-suite-province', seed: 'music-wilderness', bias: -3, suiteLabel: 'Province Suite', styles: ['Province Marches', 'Thornwood Patrol', 'Stonepath Ballad', 'Harvest Horizon', 'Old Road Anthem'] },
        { baseId: 'music-suite-merchant', seed: 'music-bazaar', bias: 5, suiteLabel: 'Merchant Suite', styles: ['Court Merchant', 'Silk Ledger', 'Market Intrigue', 'Coinhouse Parade', 'Broker Twilight'] },
        { baseId: 'music-suite-sea', seed: 'music-sea', bias: -4, suiteLabel: 'Sea Suite', styles: ['Abyssal Sea', 'Saltwake Hymn', 'Harbor Moon', 'Stormglass Voyage', 'Keelfire Drift'] },
        { baseId: 'music-suite-space', seed: 'music-space', bias: 6, suiteLabel: 'Space Suite', styles: ['Orbital Noir', 'Voidline Pulse', 'Docking Shadow', 'Starlane Velvet', 'Signal Dust'] },
        { baseId: 'music-suite-planet', seed: 'music-starship', bias: 2, suiteLabel: 'Planet Suite', styles: ['Planetfall Frontier', 'Red Horizon Relay', 'Crater Wind', 'Survey Moonlight', 'Dust Orbit'] }
      ];
      suiteDefinitions.forEach((entry, suiteIndex) => {
        var seedProfile = this.musicProfiles[entry.seed] || this.musicProfiles['music-character'];
        this.musicProfiles[entry.baseId] = makeSuiteTrackProfile(seedProfile, Number(entry.bias || 0), suiteIndex);
        var suiteVariants = [];
        for (var si = 1; si < 10; si++) {
          suiteVariants.push(makeSuiteTrackProfile(seedProfile, Number(entry.bias || 0), suiteIndex + si * 2));
        }
        this.registerMusicVariants(entry.baseId, suiteVariants);

        var ids = this.getMusicVariantPool(entry.baseId);
        var styleMap = {};
        var styleCounter = {};
        ids.forEach((trackId, ti) => {
          var styleName = entry.styles[Math.floor(ti / 2) % entry.styles.length] || entry.styles[0] || 'Suite Core';
          styleMap[styleName] = styleMap[styleName] || [];
          styleMap[styleName].push(trackId);
          styleCounter[styleName] = (styleCounter[styleName] || 0) + 1;
          this.musicTrackMeta[trackId] = {
            suite: entry.baseId,
            suiteLabel: entry.suiteLabel,
            style: styleName,
            title: styleName + ' · Cue ' + styleCounter[styleName]
          };
        });
        this.musicSuiteStyles[entry.baseId] = styleMap;
      });

      this.tabAlbumStyles = {
        character: 'Campfire Chronicle',
        map: 'Province Marches',
        combat: 'Iron Clash',
        caravan: 'Folk Caravan',
        holding: 'Council Hall',
        missions: 'Contract Pulse',
        jobs: 'Clockwork Errand'
      };

      this.scenarioSubstyleRules = [
        { keywords: ['merchant', 'market', 'bazaar', 'trade', 'vendor'], suite: 'music-suite-merchant', style: 'Court Merchant' },
        { keywords: ['court', 'noble', 'palace', 'council'], suite: 'music-suite-merchant', style: 'Silk Ledger' },
        { keywords: ['caravan', 'wagon', 'road'], suite: 'music-suite-caravan', style: 'Folk Caravan' },
        { keywords: ['province', 'plains', 'forest', 'mountain', 'wilds'], suite: 'music-suite-province', style: 'Province Marches' },
        { keywords: ['harbor', 'port', 'dock'], suite: 'music-suite-sea', style: 'Harbor Moon' },
        { keywords: ['sea', 'ocean', 'island', 'reef', 'sail'], suite: 'music-suite-sea', style: 'Abyssal Sea' },
        { keywords: ['storm', 'maelstrom', 'tempest'], suite: 'music-suite-sea', style: 'Stormglass Voyage' },
        { keywords: ['space', 'void', 'station', 'orbit'], suite: 'music-suite-space', style: 'Orbital Noir' },
        { keywords: ['starship', 'command', 'bridge', 'hub'], suite: 'music-suite-space', style: 'Docking Shadow' },
        { keywords: ['planet', 'surface', 'biome', 'frontier', 'unknown world'], suite: 'music-suite-planet', style: 'Planetfall Frontier' },
        { keywords: ['combat', 'battle', 'enemy', 'lair'], suite: 'music-suite-combat', style: 'Iron Clash' }
      ];

      this.ambienceProfiles = {
        'amb-wind': { noiseColor: 'brown', lowCut: 0.992, motionHz: 0.08, hiss: 0.2 },
        'amb-rain': { noiseColor: 'white', highCut: 0.86, motionHz: 0.3, crackle: 140, hiss: 0.5 },
        'amb-thunder': { noiseColor: 'brown', lowCut: 0.994, motionHz: 0.05, rumble: 28, crackle: 28, hiss: 0.1 },
        'amb-river': { noiseColor: 'white', highCut: 0.9, motionHz: 0.18, hiss: 0.35 },
        'amb-waterfall': { noiseColor: 'white', highCut: 0.82, motionHz: 0.22, hiss: 0.58 },
        'amb-waves': { noiseColor: 'brown', lowCut: 0.989, motionHz: 0.11, pulseHz: 0.33, hiss: 0.34 },
        'amb-campfire': { noiseColor: 'white', highCut: 0.88, crackle: 210, hiss: 0.2, toneHz: 190, toneMix: 0.05 },
        'amb-icecracking': { noiseColor: 'brown', lowCut: 0.993, crackle: 75, rumble: 22, hiss: 0.12 },
        'amb-seagulls': { noiseColor: 'white', highCut: 0.9, motionHz: 0.24, toneHz: 880, toneMix: 0.04, hiss: 0.25 },
        'amb-crows': { noiseColor: 'white', highCut: 0.9, motionHz: 0.18, toneHz: 520, toneMix: 0.04, hiss: 0.22 },
        'amb-fire': { noiseColor: 'white', highCut: 0.86, crackle: 180, hiss: 0.3 },
        'amb-whispers': { noiseColor: 'brown', lowCut: 0.99, motionHz: 0.09, toneHz: 240, toneMix: 0.06, hiss: 0.16 },
        'amb-radio': { noiseColor: 'white', highCut: 0.91, crackle: 250, toneHz: 1200, toneMix: 0.03, hiss: 0.45 },
        'amb-crowd': { noiseColor: 'brown', lowCut: 0.988, motionHz: 0.26, toneHz: 320, toneMix: 0.05, hiss: 0.22 },
        'amb-fistfight': { noiseColor: 'white', highCut: 0.84, crackle: 160, rumble: 36, hiss: 0.28 },
        'amb-weapon-fighting': { noiseColor: 'white', highCut: 0.82, crackle: 200, toneHz: 760, toneMix: 0.04, hiss: 0.3 },
        'amb-ship-rumble': { noiseColor: 'brown', lowCut: 0.995, rumble: 31, motionHz: 0.07, hiss: 0.08 },
        'amb-rowboat': { noiseColor: 'brown', lowCut: 0.989, pulseHz: 0.62, motionHz: 0.16, hiss: 0.16 },
        'amb-train': { noiseColor: 'brown', lowCut: 0.992, pulseHz: 2.4, rumble: 42, hiss: 0.18 }
      };

      this.scenarioProfiles = {
        'town': { music: 'music-town', ambiences: ['amb-crowd', 'amb-wind'] },
        'city': { music: 'music-city', ambiences: ['amb-crowd', 'amb-radio'] },
        'village': { music: 'music-village', ambiences: ['amb-crowd', 'amb-campfire'] },
        'tavern': { music: 'music-tavern', ambiences: ['amb-crowd', 'amb-fire'] },
        'dark streets': { music: 'music-dark-streets', ambiences: ['amb-whispers', 'amb-rain'] },
        'springvale': { music: 'music-village', ambiences: ['amb-river', 'amb-crowd'] },
        'mountains': { music: 'music-wilderness', ambiences: ['amb-wind'] },
        'plains': { music: 'music-wilderness', ambiences: ['amb-wind'] },
        'forest': { music: 'music-wilderness', ambiences: ['amb-wind', 'amb-river'] },
        'cave': { music: 'music-dungeon', ambiences: ['amb-river', 'amb-whispers'] },
        'ancient grove': { music: 'music-sacred', ambiences: ['amb-wind', 'amb-river'] },
        'swamp': { music: 'music-dungeon', ambiences: ['amb-river', 'amb-whispers'] },
        'graveyard': { music: 'music-ritual', ambiences: ['amb-wind', 'amb-crows'] },
        'dungeon entrance': { music: 'music-dungeon', ambiences: ['amb-whispers'] },
        'dungeon corridors': { music: 'music-dungeon', ambiences: ['amb-whispers', 'amb-fire'] },
        'dungeon lair': { music: 'music-combat', ambiences: ['amb-fire', 'amb-weapon-fighting'] },
        'dwarves kingdom': { music: 'music-city', ambiences: ['amb-fire', 'amb-crowd'] },
        'deep space': { music: 'music-space', ambiences: ['amb-radio'] },
        'birth of a star': { music: 'music-star-birth', ambiences: ['amb-radio', 'amb-fire'] },
        'starship': { music: 'music-starship', ambiences: ['amb-ship-rumble', 'amb-radio'] },
        'command center': { music: 'music-command', ambiences: ['amb-radio'] },
        'space hub': { music: 'music-command', ambiences: ['amb-crowd', 'amb-radio'] },
        'metropolis': { music: 'music-city', ambiences: ['amb-crowd', 'amb-radio'] },
        'undercity': { music: 'music-industrial', ambiences: ['amb-whispers', 'amb-train'] },
        'mission briefing': { music: 'music-command', ambiences: ['amb-radio'] },
        'enemy base': { music: 'music-combat', ambiences: ['amb-radio', 'amb-weapon-fighting'] },
        'derelict station': { music: 'music-derelict', ambiences: ['amb-radio', 'amb-whispers'] },
        'unknown world': { music: 'music-space', ambiences: ['amb-wind', 'amb-whispers'] },
        'artifact': { music: 'music-relic', ambiences: ['amb-whispers'] },
        'setting sail': { music: 'music-sea', ambiences: ['amb-waves', 'amb-ship-rumble'] },
        'maelstrom': { music: 'music-storm-sea', ambiences: ['amb-waves', 'amb-thunder', 'amb-rain'] },
        'shipwreck cove': { music: 'music-sea', ambiences: ['amb-waves', 'amb-seagulls'] },
        'beach': { music: 'music-sea', ambiences: ['amb-waves', 'amb-seagulls'] },
        'island paths': { music: 'music-sea', ambiences: ['amb-wind', 'amb-seagulls'] },
        'merchant': { music: 'music-bazaar', ambiences: ['amb-crowd'] },
        'wilds': { music: 'music-wilderness', ambiences: ['amb-wind'] },
        'cursed lands': { music: 'music-ritual', ambiences: ['amb-whispers', 'amb-crows'] },
        'ritual': { music: 'music-ritual', ambiences: ['amb-whispers', 'amb-fire'] },
        'tainted chapel': { music: 'music-ritual', ambiences: ['amb-whispers', 'amb-crows'] },
        'the tower': { music: 'music-sacred', ambiences: ['amb-wind', 'amb-whispers'] },
        'haunted library': { music: 'music-ritual', ambiences: ['amb-whispers', 'amb-radio'] },
        'desert': { music: 'music-desert', ambiences: ['amb-wind'] },
        'sandstorm': { music: 'music-desert', ambiences: ['amb-wind', 'amb-thunder'] },
        'bazaar': { music: 'music-bazaar', ambiences: ['amb-crowd'] },
        'oasis': { music: 'music-desert', ambiences: ['amb-river', 'amb-wind'] },
        'palace': { music: 'music-sacred', ambiences: ['amb-crowd'] },
        'buried tomb': { music: 'music-dungeon', ambiences: ['amb-whispers', 'amb-fire'] },
        'relic': { music: 'music-relic', ambiences: ['amb-whispers'] },
        'mirage': { music: 'music-desert', ambiences: ['amb-wind', 'amb-whispers'] },
        'gutter': { music: 'music-dark-streets', ambiences: ['amb-rain', 'amb-whispers'] },
        'factory': { music: 'music-industrial', ambiences: ['amb-train', 'amb-radio'] },
        'body shop': { music: 'music-industrial', ambiences: ['amb-radio', 'amb-fire'] },
        'tundra': { music: 'music-ice', ambiences: ['amb-wind', 'amb-icecracking'] },
        'frozen harbor': { music: 'music-ice', ambiences: ['amb-waves', 'amb-icecracking'] },
        'blizzard': { music: 'music-ice', ambiences: ['amb-wind', 'amb-thunder', 'amb-icecracking'] },
        'glacier': { music: 'music-ice', ambiences: ['amb-icecracking', 'amb-wind'] },
        'ice creamave': { music: 'music-ice', ambiences: ['amb-icecracking', 'amb-whispers'] },
        'ice crevasse': { music: 'music-ice', ambiences: ['amb-icecracking', 'amb-whispers'] },
        'ancestral rite': { music: 'music-ritual', ambiences: ['amb-fire', 'amb-whispers'] }
      };

      var scenarioSuiteOverrides = {
        'mountains': 'music-suite-province',
        'plains': 'music-suite-province',
        'forest': 'music-suite-province',
        'wilds': 'music-suite-province',
        'merchant': 'music-suite-merchant',
        'bazaar': 'music-suite-merchant',
        'setting sail': 'music-suite-sea',
        'maelstrom': 'music-suite-sea',
        'shipwreck cove': 'music-suite-sea',
        'beach': 'music-suite-sea',
        'island paths': 'music-suite-sea',
        'deep space': 'music-suite-space',
        'starship': 'music-suite-space',
        'space hub': 'music-suite-space',
        'command center': 'music-suite-space',
        'unknown world': 'music-suite-planet',
        'enemy base': 'music-suite-combat',
        'dungeon lair': 'music-suite-combat'
      };
      Object.keys(scenarioSuiteOverrides).forEach((key) => {
        if (this.scenarioProfiles[key]) this.scenarioProfiles[key].music = scenarioSuiteOverrides[key];
      });

      // MUSIC TRACKS
      this.audioCache['music-character'] = this.generateProceduralMusic(this.musicProfiles['music-character']);
      this.audioCache['music-map'] = this.generateProceduralMusic(this.musicProfiles['music-map']);
      this.audioCache['music-combat'] = this.generateProceduralMusic(this.musicProfiles['music-combat']);
      this.audioCache['music-caravan'] = this.generateProceduralMusic(this.musicProfiles['music-caravan']);
      this.audioCache['music-missions'] = this.generateProceduralMusic(this.musicProfiles['music-missions']);

      // SOUND EFFECTS
      // Combat engagement
      this.audioCache['sfx-combat-start'] = this.generateTone(220, 0.1, 0.01, 0.05);
      
      // Combat hit (sword)
      this.audioCache['sfx-combat-hit'] = this.generateNoise(0.05);
      
      // Combat miss/blocked
      this.audioCache['sfx-combat-block'] = this.generateTone(440, 0.08, 0.01, 0.05);
      
      // Enemy defeated
      this.audioCache['sfx-enemy-defeat'] = this.generateTone(329.63, 0.2, 0.01, 0.15);
      
      // Damage taken (warning)
      this.audioCache['sfx-damage-taken'] = this.generateTone(146.83, 0.15, 0.01, 0.1);
      
      // Stress increased
      this.audioCache['sfx-stress-up'] = this.generateTone(197, 0.12, 0.01, 0.08);
      
      // Success/positive outcome
      this.audioCache['sfx-success'] = this.generateTone(349.23, 0.2, 0.05, 0.1);
      
      // Failure/negative outcome
      this.audioCache['sfx-failure'] = this.generateTone(164.81, 0.2, 0.05, 0.1);
      
      // Mission accepted
      this.audioCache['sfx-mission-accept'] = this.generateTone(261.63, 0.15, 0.05, 0.08);
      
      // Mission complete
      this.audioCache['sfx-mission-complete'] = this.generateTone(523.25, 0.3, 0.1, 0.2);
      
      // Item obtained/loot
      this.audioCache['sfx-loot'] = this.generateTone(392, 0.1, 0.02, 0.06);
      
      // Condition applied
      this.audioCache['sfx-condition'] = this.generateTone(277.18, 0.1, 0.02, 0.06);
      
      // Trauma taken
      this.audioCache['sfx-trauma'] = this.generateTone(110, 0.2, 0.01, 0.15);
      
      // TMW gained
      this.audioCache['sfx-tmw-gain'] = this.generateTone(392, 0.15, 0.05, 0.08);
      
      // UI click
      this.audioCache['sfx-ui-click'] = this.generateTone(800, 0.05, 0.01, 0.02);
      
      // Chase/pursuit
      this.audioCache['sfx-chase-alert'] = this.generateTone(440, 0.1, 0.01, 0.06);
      
      // Caravan damage
      this.audioCache['sfx-caravan-damage'] = this.generateNoise(0.08);
    },

    resolveScenarioProfile(name) {
      const key = normalizeScenarioKey(name);
      if (this.scenarioProfiles[key]) return this.scenarioProfiles[key];
      if (key.includes('space') || key.includes('starship') || key.includes('station')) return this.scenarioProfiles['deep space'];
      if (key.includes('sea') || key.includes('harbor') || key.includes('sail') || key.includes('island')) return this.scenarioProfiles['setting sail'];
      if (key.includes('desert') || key.includes('oasis') || key.includes('bazaar') || key.includes('sand')) return this.scenarioProfiles['desert'];
      if (key.includes('dungeon') || key.includes('tomb') || key.includes('lair') || key.includes('undercity')) return this.scenarioProfiles['dungeon corridors'];
      if (key.includes('ritual') || key.includes('chapel') || key.includes('tower') || key.includes('haunted')) return this.scenarioProfiles['ritual'];
      if (key.includes('combat') || key.includes('enemy')) return { music: 'music-suite-combat', ambiences: ['amb-weapon-fighting'] };
      if (key.includes('city') || key.includes('metropolis') || key.includes('town') || key.includes('village')) return this.scenarioProfiles['city'];
      return this.scenarioProfiles['wilds'];
    },

    resolveSuiteStylePool(suiteId, styleName) {
      const suite = String(suiteId || '').trim();
      if (!suite) return [];
      const styleMap = this.musicSuiteStyles && this.musicSuiteStyles[suite] ? this.musicSuiteStyles[suite] : null;
      if (!styleMap) return this.getMusicVariantPool(suite);
      const style = String(styleName || '').trim();
      if (style && Array.isArray(styleMap[style]) && styleMap[style].length) return styleMap[style].slice();
      const firstKey = Object.keys(styleMap)[0];
      return firstKey && Array.isArray(styleMap[firstKey]) ? styleMap[firstKey].slice() : this.getMusicVariantPool(suite);
    },

    resolveScenarioMusicSelection(profileMusic, scenarioName) {
      const key = normalizeScenarioKey(scenarioName || '');
      var suite = String(profileMusic || '').trim();
      var style = '';
      const rules = Array.isArray(this.scenarioSubstyleRules) ? this.scenarioSubstyleRules : [];
      for (var i = 0; i < rules.length; i++) {
        const rule = rules[i] || {};
        const words = Array.isArray(rule.keywords) ? rule.keywords : [];
        const matched = words.some(function (word) {
          const needle = String(word || '').trim();
          return needle && key.indexOf(needle) >= 0;
        });
        if (!matched) continue;
        if (rule.suite) suite = String(rule.suite);
        if (rule.style) style = String(rule.style);
        break;
      }
      if (!suite) return { musicId: '', variantPool: [] };
      return {
        musicId: suite,
        variantPool: this.resolveSuiteStylePool(suite, style)
      };
    },

    playScenarioAudio(name, options = {}) {
      this.ensureInitialized();
      this.currentScenario = String(name || '');
      if (!this.enabled || !this.musicConsent) return;
      if (this.hasCampaignSoundtrackOverride() && options.allowCampaignOverride !== true) return;
      const profile = this.resolveScenarioProfile(name);
      if (!profile) return;
      if (profile.music) {
        const selection = this.resolveScenarioMusicSelection(profile.music, name);
        this.playMusic(selection.musicId || profile.music, options.fadeIn !== false, { variantPool: selection.variantPool });
      }
      this.stopAmbience(options.fadeOut !== false);
      const ambienceIds = Array.isArray(options.ambiences) && options.ambiences.length
        ? options.ambiences
        : (Array.isArray(profile.ambiences) ? profile.ambiences : []);
      ambienceIds.forEach((id) => {
        if (this.ambienceProfiles[id]) this.playAmbience(id, 1, true);
      });
    },

    setScenarioContext(name, options) {
      this.playScenarioAudio(name, options || {});
    },

    // ── TAB-SPECIFIC MUSIC ───────────────────────────────────────────────────
    switchTabMusic(tabId, options = {}) {
      this.currentTab = tabId;

      if (!this.musicConsent) {
        return;
      }
      if (this.hasCampaignSoundtrackOverride() && options.allowCampaignOverride !== true) {
        return;
      }
      
      const musicMap = {
        'character': 'music-suite-character',
        'map': 'music-suite-map',
        'combat': 'music-suite-combat',
        'caravan': 'music-suite-caravan',
        'holding': 'music-suite-holding',
        'missions': 'music-suite-missions',
        'jobs': 'music-suite-jobs',
      };

      const musicId = musicMap[tabId] || 'music-suite-character';
      const styleName = this.tabAlbumStyles && this.tabAlbumStyles[tabId] ? this.tabAlbumStyles[tabId] : '';
      const variantPool = this.resolveSuiteStylePool(musicId, styleName);
      this.playMusic(musicId, true, { variantPool: variantPool });

      // Keep ambiences in sync with major tabs when explicit scenario context is not set.
      if (!this.currentScenario) {
        if (tabId === 'combat') {
          this.stopAmbience(false);
          this.playAmbience('amb-weapon-fighting', 0.9, true);
        } else if (tabId === 'map') {
          this.stopAmbience(false);
          this.playAmbience('amb-wind', 0.85, true);
        } else {
          this.stopAmbience(true);
        }
      }
    },

    // ── VOLUME CONTROLS ─────────────────────────────────────────────────────
    setMasterVolume(value) {
      this.masterVolume = Math.max(0, Math.min(1, value));
      if (this.currentMusic) {
        this.currentMusic.gainNode.gain.value = this.masterVolume * this.musicVolume;
      }
    },

    setMusicVolume(value) {
      this.musicVolume = Math.max(0, Math.min(1, value));
      if (this.currentMusic) {
        this.currentMusic.gainNode.gain.value = this.masterVolume * this.musicVolume;
      }
    },

    setSFXVolume(value) {
      this.sfxVolume = Math.max(0, Math.min(1, value));
    },

    setAmbienceVolume(value) {
      this.ambienceVolume = Math.max(0, Math.min(1, value));
      if (Array.isArray(this.currentAmbiences)) {
        this.currentAmbiences.forEach((entry) => {
          if (!entry || !entry.gainNode) return;
          entry.gainNode.gain.value = this.masterVolume * this.ambienceVolume;
        });
      }
    },

    toggleAudio(enabled) {
      this.enabled = enabled;
      if (!enabled) {
        this.stopMusic(false);
        this.stopAmbience(false);
      }
    },

    setMusicConsent(enabled) {
      const next = !!enabled;
      if (this.musicConsent === next) return;
      this.musicConsent = next;
      if (!this.musicConsent) {
        this.stopMusic(false);
        this.stopAmbience(false);
        return;
      }
      this.ensureInitialized();
      this.loadOptionalAssetPack();
      if (this.hasCampaignSoundtrackOverride()) {
        this.applyCampaignSoundtrack(this.campaignSoundtrackOverride, {
          fadeIn: true,
          forceVariantChange: true
        });
        return;
      }
      this.switchTabMusic(this.currentTab || 'character');
    },

    // ── EVENT SHORTCUTS ─────────────────────────────────────────────────────
    // Combat
    combatStarted() { this.playSFX('sfx-combat-start', 0.7); },
    combatEnded() { this.playSFX('sfx-success', 0.8); },
    combatHit(isPlayer = true) { this.playSFX('sfx-combat-hit', isPlayer ? 0.6 : 0.5); },
    combatMiss() { this.playSFX('sfx-combat-block', 0.5); },
    enemyDefeated() { this.playSFX('sfx-enemy-defeat', 0.9); },
    damageTaken(severity = 1) { this.playSFX('sfx-damage-taken', severity); },
    stressIncreased() { this.playSFX('sfx-stress-up', 0.6); },

    // Outcomes
    actionSuccess() { this.playSFX('sfx-success', 0.7); },
    actionFailed() { this.playSFX('sfx-failure', 0.7); },
    
    // Missions & Progress
    missionAccepted() { this.playSFX('sfx-mission-accept', 0.7); },
    missionComplete() { this.playSFX('sfx-mission-complete', 0.9); },
    lootObtained() { this.playSFX('sfx-loot', 0.7); },

    // Character Status
    conditionApplied() { this.playSFX('sfx-condition', 0.6); },
    traumaReceived() { this.playSFX('sfx-trauma', 0.8); },
    tmwGained() { this.playSFX('sfx-tmw-gain', 0.7); },

    // UI & Caravan
    uiClick() { this.playSFX('sfx-ui-click', 0.3); },
    chaseAlert() { this.playSFX('sfx-chase-alert', 0.8); },
    caravanDamaged() { this.playSFX('sfx-caravan-damage', 0.7); },

    // Scenario/Location conveniences
    playLocationAudio(name, options) { this.playScenarioAudio(name, options || {}); },
    setAmbienceByName(name) {
      if (this.hasCampaignSoundtrackOverride()) return;
      const key = normalizeScenarioKey(name);
      const ambienceId = {
        'wind': 'amb-wind',
        'rain': 'amb-rain',
        'thunder': 'amb-thunder',
        'river': 'amb-river',
        'waterall': 'amb-waterfall',
        'waterfall': 'amb-waterfall',
        'waves': 'amb-waves',
        'campfire': 'amb-campfire',
        'icecracking': 'amb-icecracking',
        'seagulls': 'amb-seagulls',
        'crows': 'amb-crows',
        'fire': 'amb-fire',
        'whispers': 'amb-whispers',
        'radio': 'amb-radio',
        'a crowd': 'amb-crowd',
        'crowd': 'amb-crowd',
        'fistfight': 'amb-fistfight',
        'weapon fighting': 'amb-weapon-fighting',
        'ship rumble': 'amb-ship-rumble',
        'rowboat': 'amb-rowboat',
        'train': 'amb-train'
      }[key];
      if (!ambienceId) return;
      this.stopAmbience(true);
      this.playAmbience(ambienceId, 1, true);
    }
  };

  // Keep startup lightweight; initialize lazily on first audio use/consent.
  console.log('🔊 Audio system available. Background music is off until enabled in Settings.');

  // Expose globally
  window.AudioManager = AudioManager;
})();
