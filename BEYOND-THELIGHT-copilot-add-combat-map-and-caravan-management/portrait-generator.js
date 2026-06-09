/**
 * Integrated AI Portrait Generation System
 * Generates character portraits directly from traits and displays in Identity Card
 * Supports: Replicate, Stability AI, OpenAI Images, Hugging Face
 */

(function() {
  // Configuration - user should set their API key
  const CONFIG = {
    provider: 'replicate', // 'replicate' | 'stability' | 'openai' | 'huggingface'
    apiKey: localStorage.getItem('portraitGeneratorApiKey') || '',
    cachePortraits: true,
    maxRetries: 2,
    timeout: 60000
  };

  // Portrait cache (key: traitHash, value: dataURL)
  const portraitCache = new Map();

  function escSvgText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escJsString(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/</g, '\\x3c');
  }

  function hueFromString(value) {
    let hash = 0;
    const input = String(value || '');
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  }

  function buildLocalTraitPortraitDataUrl(state) {
    const safe = state || {};
    const traits = (safe.traits && typeof safe.traits === 'object') ? safe.traits : safe;
    const seed = [
      traits.physique || '',
      traits.skin || '',
      traits.hair || '',
      traits.face || '',
      traits.clothing || '',
      traits.virtue || '',
      traits.vice || '',
      traits.reputation || '',
      traits.misfortune || ''
    ].join('|');
    const h1 = hueFromString(seed);
    const h2 = (h1 + 38) % 360;
    const h3 = (h1 + 210) % 360;

    const initials = [traits.virtue, traits.vice]
      .filter(Boolean)
      .map((v) => String(v).trim().charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || 'AI';

    const svg = ''
      + '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
      + '<defs>'
      + '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0%" stop-color="hsl(' + h1 + ',54%,28%)"/>'
      + '<stop offset="100%" stop-color="hsl(' + h2 + ',62%,16%)"/>'
      + '</linearGradient>'
      + '</defs>'
      + '<rect width="512" height="512" fill="url(#bg)"/>'
      + '<circle cx="256" cy="194" r="120" fill="hsl(' + h3 + ',34%,78%)" opacity="0.95"/>'
      + '<path d="M112 470c18-118 96-176 144-176s126 58 144 176" fill="hsl(' + h2 + ',40%,30%)"/>'
      + '<circle cx="208" cy="188" r="13" fill="#121620"/>'
      + '<circle cx="304" cy="188" r="13" fill="#121620"/>'
      + '<path d="M210 252c28 24 64 24 92 0" fill="none" stroke="#141a24" stroke-width="9" stroke-linecap="round"/>'
      + '<text x="256" y="472" text-anchor="middle" font-family="Cinzel,serif" font-size="56" fill="rgba(255,255,255,.9)">' + escSvgText(initials) + '</text>'
      + '</svg>';

    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function openPortraitPreview(imageUrl, label, sourceLabel) {
    if (typeof document === 'undefined') return false;
    var modal = document.getElementById('rollModal');
    var titleEl = document.getElementById('modalTitle');
    var contentEl = document.getElementById('modalContent');
    var title = label || 'Portrait Preview';
    var body = ''
      + '<div style="display:grid;gap:.65rem;">'
      + '<div style="font-size:.75rem;color:var(--muted2);">' + escSvgText(sourceLabel || 'Portrait preview') + '</div>'
      + '<div style="border:1px solid var(--border2);border-radius:12px;overflow:hidden;background:var(--surface);max-width:100%;">'
      + '<img src="' + imageUrl + '" alt="Portrait preview" style="display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;"/>'
      + '</div>'
      + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;">'
      + '<button class="btn btn-sm btn-primary" onclick="window.PortraitGenerator.downloadPortrait(' + JSON.stringify(String(imageUrl || '')) + ',' + JSON.stringify(String(label || 'portrait')) + ');">Download</button>'
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

  /**
   * Extract character traits and build AI prompt
   */
  function buildPortraitPrompt(state) {
    const safe = state || {};
    const traitPairs = [
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

    const traits = [];
    for (let i = 0; i < traitPairs.length; i++) {
      const key = traitPairs[i][0];
      const label = traitPairs[i][1];
      let value = safe[key];
      if (!value && safe.traits && typeof safe.traits === 'object') {
        value = safe.traits[key];
      }
      if (value) traits.push(label + ': ' + String(value));
    }

    // Build final prompt with style guide
    const stylePrefix = 'dark fantasy character portrait, painterly RPG style, centered head-and-shoulders, neutral background, atmospheric lighting';
    return stylePrefix + (traits.length ? ', ' + traits.join(', ') : '');
  }

  /**
   * Generate unique hash from state for caching
   */
  function hashTraits(state) {
    const traitString = [
      (state && state.physique) || '',
      (state && state.skin) || '',
      (state && state.hair) || '',
      (state && state.face) || '',
      (state && state.clothing) || '',
      (state && state.virtue) || '',
      (state && state.vice) || '',
      (state && state.reputation) || '',
      (state && state.misfortune) || ''
    ].join('|');
    
    let hash = 0;
    for (let i = 0; i < traitString.length; i++) {
      const chr = traitString.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate portrait using Replicate API
   */
  async function generateViaReplicate(prompt, apiKey) {
    const model = 'stability-ai/stable-diffusion-3-medium';
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Token ' + apiKey
      },
      body: JSON.stringify({
        version: '5f61ba55f70e559ce20b1ec09d6c69ff475271787f00eab182e108b312b39f19',
        input: {
          prompt: prompt,
          num_outputs: 1,
          height: 512,
          width: 512,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      })
    });

    if (!response.ok) throw new Error('Replicate API error: ' + response.statusText);
    
    const data = await response.json();
    if (!data.output || !data.output.length) throw new Error('No image generated');
    
    return data.output[0];
  }

  /**
   * Generate portrait using Stability AI API
   */
  async function generateViaStabilityAI(prompt, apiKey) {
    const response = await
 fetch('https://api.stability.ai/v1/generation/stable-diffusion-v3-medium/text-to-image', {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        steps: 30,
        height: 512,
        width: 512,
        guidance_scale: 7.5
      })
    });

    if (!response.ok) throw new Error('Stability AI error: ' + response.statusText);
    
    const data = await response.json();
    if (!data.artifacts || !data.artifacts.length) throw new Error('No image generated');
    
    return 'data:image/png;base64,' + data.artifacts[0].base64;
  }

  /**
   * Generate portrait using OpenAI Images API
   */
  async function generateViaOpenAI(prompt, apiKey) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        n: 1,
        size: '512x512',
        model: 'dall-e-3',
        quality: 'standard'
      })
    });

    if (!response.ok) throw new Error('OpenAI API error: ' + response.statusText);
    
    const data = await response.json();
    if (!data.data || !data.data.length) throw new Error('No image generated');
    
    return data.data[0].url;
  }

  /**
   * Generate portrait using Hugging Face Inference API
   */
  async function generateViaHuggingFace(prompt, apiKey) {
    const model = 'stabilityai/stable-diffusion-2-1';
    const response = await fetch('https://api-inference.huggingface.co/models/' + model, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) throw new Error('Hugging Face API error: ' + response.statusText);
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Main portrait generation function
   */
  async function generatePortrait(state, options) {
    options = options || {};
    const apiKey = options.apiKey || CONFIG.apiKey;
    const provider = options.provider || CONFIG.provider;

    const traitHash = hashTraits(state);
    if (CONFIG.cachePortraits && portraitCache.has(traitHash)) {
      return portraitCache.get(traitHash);
    }

    if (!apiKey) {
      const localPortrait = buildLocalTraitPortraitDataUrl(state);
      if (CONFIG.cachePortraits) {
        portraitCache.set(traitHash, localPortrait);
      }
      return localPortrait;
    }

    const prompt = buildPortraitPrompt(state);
    let imageUrl = null;
    let lastError = null;

    for (let retry = 0; retry < CONFIG.maxRetries; retry++) {
      try {
        if (provider === 'replicate') {
          imageUrl = await generateViaReplicate(prompt, apiKey);
        } else if (provider === 'stability') {
          imageUrl = await generateViaStabilityAI(prompt, apiKey);
        } else if (provider === 'openai') {
          imageUrl = await generateViaOpenAI(prompt, apiKey);
        } else if (provider === 'huggingface') {
          imageUrl = await generateViaHuggingFace(prompt, apiKey);
        } else {
          throw new Error('Unknown provider: ' + provider);
        }

        if (imageUrl) break;
      } catch (err) {
        lastError = err;
        if (retry < CONFIG.maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!imageUrl) {
      throw lastError || new Error('Failed to generate portrait');
    }

    if (CONFIG.cachePortraits) {
      portraitCache.set(traitHash, imageUrl);
    }

    return imageUrl;
  }

  /**
   * Update Identity Card portrait with generated image
   */
  async function renderGeneratedPortrait(elementId, state) {
    const el = document.getElementById(elementId);
    if (!el) return false;

    // Add loading state
    const originalContent = el.innerHTML;
    el.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted2);">⟳ Generating portrait...</div>';
      try {
        const imageUrl = await generatePortrait(state);
        const sourceLabel = CONFIG.apiKey ? 'AI portrait from character traits' : 'Trait portrait (local fallback, no API key)';
        const previewTitle = (state && state.name) || 'Portrait Preview';

        el.innerHTML = ''
        + '<div style="display:grid;grid-template-columns:88px 1fr;gap:.55rem;align-items:start;">'
        + '<button type="button" class="btn btn-xs" onclick="window.PortraitGenerator.openPortraitPreview(' + JSON.stringify(String(imageUrl || '')) + ',' + JSON.stringify(String(previewTitle)) + ',' + JSON.stringify(String(sourceLabel)) + ');" style="padding:0;border:none;background:transparent;line-height:0;cursor:pointer;">'
        + '<img src="' + imageUrl + '" alt="Generated Portrait" style="width:88px;height:88px;object-fit:cover;display:block;border:1px solid var(--border2);border-radius:12px;box-shadow:0 8px 18px rgba(0,0,0,.22);"/>'
        + '</button>'
        + '<div style="min-width:0;">'
        + '<div style="font-size:.72rem;color:var(--muted2);margin-bottom:.25rem;">' + sourceLabel + '</div>'
        + '<div style="font-size:.72rem;color:var(--muted2);line-height:1.45;margin-bottom:.35rem;">Click the portrait to open a larger preview.</div>'
        + '<div style="display:flex;gap:.25rem;flex-wrap:wrap;">'
        + '<button class="btn btn-xs" onclick="window.PortraitGenerator.clearCache();document.getElementById(' + JSON.stringify(String(elementId)) + ').innerHTML=' + JSON.stringify(originalContent) + ';">Regenerate</button>'
        + '<button class="btn btn-xs btn-primary" onclick="window.PortraitGenerator.openPortraitPreview(' + JSON.stringify(String(imageUrl || '')) + ',' + JSON.stringify(String(previewTitle)) + ',' + JSON.stringify(String(sourceLabel)) + ');">View Larger</button>'
        + '<button class="btn btn-xs btn-primary" onclick="window.PortraitGenerator.downloadPortrait(' + JSON.stringify(String(imageUrl || '')) + ',' + JSON.stringify(String((state && state.name) || 'portrait')) + ');">Download</button>'
        + '</div>'
        + '</div>'
        + '</div>';

      return true;
    } catch (err) {
      console.error('Portrait generation failed:', err);
      el.innerHTML = originalContent + '<div style="margin-top:.3rem;padding:.3rem;background:rgba(200,80,80,.1);border:1px solid rgba(200,80,80,.3);border-radius:4px;font-size:.72rem;color:var(--red2);">Generation failed: ' + err.message + '</div>';
      return false;
    }
  }

  /**
   * Download portrait as PNG
   */
  function downloadPortrait(imageUrl, characterName) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = (characterName || 'portrait') + '_portrait.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Clear portrait cache
   */
  function clearCache() {
    portraitCache.clear();
  }

  /**
   * Configure portrait generator
   */
  function setConfig(options) {
    Object.assign(CONFIG, options);
    if (options.apiKey) {
      localStorage.setItem('portraitGeneratorApiKey', options.apiKey);
    }
  }

  // Export public API
  window.PortraitGenerator = {
    generatePortrait: generatePortrait,
    renderGeneratedPortrait: renderGeneratedPortrait,
    buildPortraitPrompt: buildPortraitPrompt,
    openPortraitPreview: openPortraitPreview,
    setConfig: setConfig,
    clearCache: clearCache,
    downloadPortrait: downloadPortrait,
    CONFIG: CONFIG
  };
})();
