import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const BASE_URL = process.env.SMOKE_URL || 'http://127.0.0.1:3000';
const START_TIMEOUT_MS = 20000;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return; } catch {}
    await wait(250);
  }
  throw new Error('server not ready');
}

let server, browser;
(async () => {
  server = spawn('node', ['server.js'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '3000' } });
  server.stdout.on('data', b => process.stdout.write(`[server] ${String(b)}`));
  server.stderr.on('data', b => process.stderr.write(`[server:err] ${String(b)}`));
  try {
    await waitForServer(BASE_URL, START_TIMEOUT_MS);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.generateStarSystemMap === 'function', null, { timeout: 30000 });
    const result = await page.evaluate(() => {
      if (!window.Settings) window.Settings = {};
      window.Settings.manualRollMode = true;
      if (window.introSystem?.skipIntro) window.introSystem.skipIntro();
      if (window.closeModal) window.closeModal();
      window.generateStarSystemMap('cluster');
      const hexes = (window.S && window.S.starSystem && Array.isArray(window.S.starSystem.hexes)) ? window.S.starSystem.hexes : [];
      const first = hexes.find(h => h && Number(h.id) > 0) || hexes[0];
      if (!first) throw new Error('no galaxy hex available after generation');
      if (typeof window.selectStarHex === 'function') window.selectStarHex(first.id);
      else if (typeof window.setCurrentStarHexById === 'function') window.setCurrentStarHexById(first.id);
      else window.S.starSystem.currentHexId = first.id;

      window.runSystemAnalysisCheck();
      const pendingAnalyze = window._pendingGlobalManualActionCheck || null;
      const analyzeContext = pendingAnalyze ? String(pendingAnalyze.context || '') : '';
      if (window.closeModal) window.closeModal();
      window._pendingGlobalManualActionCheck = null;

      window.performGalaxyObservation('north');
      const pendingObserve = window._pendingGlobalManualActionCheck || null;
      const observeContext = pendingObserve ? String(pendingObserve.context || '') : '';

      return {
        analyzePending: !!pendingAnalyze,
        analyzeContext,
        analyzeStat: pendingAnalyze ? String(pendingAnalyze.statLabel || '') : '',
        analyzeDread: pendingAnalyze ? Number(pendingAnalyze.dreadDie || 0) : 0,
        observePending: !!pendingObserve,
        observeContext,
        observeStat: pendingObserve ? String(pendingObserve.statLabel || '') : '',
        observeDread: pendingObserve ? Number(pendingObserve.dreadDie || 0) : 0
      };
    });

    if (!result.analyzePending) throw new Error('Analyze did not open manual prompt');
    if (!/Lead vs DD8/i.test(result.analyzeContext)) throw new Error(`Analyze context mismatch: ${result.analyzeContext}`);
    if (result.analyzeStat !== 'Lead' || result.analyzeDread !== 8) throw new Error(`Analyze stat/dread mismatch: ${JSON.stringify(result)}`);
    if (!result.observePending) throw new Error('Observe did not open manual prompt');
    if (!/Observe Adjacent/i.test(result.observeContext)) throw new Error(`Observe context mismatch: ${result.observeContext}`);
    if (result.observeStat !== 'Mind' || result.observeDread !== 6) throw new Error(`Observe stat/dread mismatch: ${JSON.stringify(result)}`);
    console.log('[smoke] galaxy-manual-prompts passed:', JSON.stringify(result));
    await page.close();
  } catch (err) {
    console.error('[smoke] galaxy-manual-prompts failed:', err?.stack || String(err));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill('SIGTERM');
  }
})();
