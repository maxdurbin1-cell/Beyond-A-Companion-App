// solo-reference.js — player-facing quick reference (lighter than GM dashboard)
(function () {
  var _open = false;

  var SECTIONS = [
    {
      title: 'Core Rolls',
      body: '<ul><li>Most checks are your Stat die vs Dread die.</li><li>Beat or tie Dread to succeed.</li><li>Exploding dice: max roll can add another roll.</li></ul>'
    },
    {
      title: 'Travel Summary',
      body: '<ul><li>Province rough weather often calls for Lead vs DD8.</li><li>Sea rough weather/perils usually test Control or Lead.</li><li>On failed traversal checks, expect stress, delays, or forced encounters.</li></ul>'
    },
    {
      title: 'Combat Snapshot',
      body: '<ul><li>Strike/Shoot rolls challenge enemy Defend.</li><li>Damage usually follows the roll difference.</li><li>Conditions and stress can shift die effectiveness.</li></ul>'
    },
    {
      title: 'Mission Loop',
      body: '<ul><li>Gather information for bonuses.</li><li>Explore site rooms (hazards, puzzles, loot).</li><li>Finish with confrontation vs scene Dread.</li></ul>'
    },
    {
      title: 'Solar Cycle (100-Day Solo Mode)',
      body: '<ul><li>Start from Storyline: choose Relic, Herald, or Loop arc.</li><li>Every day advances collapse pressure and shifts reality tiers.</li><li>Day thresholds at 25/50/75/90 trigger omen warnings.</li><li>At Day 100, a forced finale begins.</li><li>Time Fracture is limited; rewinds are scarce and carry persistent scars.</li></ul>'
    },
    {
      title: 'Solo Guidance Flow',
      body: '<ul><li>Start with Character, then route to Province, Missions, and Storyline.</li><li>Use Jobs when you need credits between major arcs.</li><li>Use the Guide button on Character tab whenever you want a quick reset.</li></ul>'
    },
    {
      title: 'Save/Load Safety',
      body: '<ul><li>Save before risky scene choices or boss rooms.</li><li>Export after major milestones to keep an external backup file.</li><li>Run Save Health checks periodically; backup is used automatically if primary save is invalid.</li><li>Use Recovery Center to promote backup or restore your latest checkpoint.</li></ul>'
    },
    {
      title: 'Quick Tips',
      body: '<ul><li>Use Quick Access to revisit recently used tabs fast.</li><li>Use Storyline for major branching outcomes.</li><li>Check Factions/Endings when narrative choices escalate.</li></ul>'
    }
  ];

  function render() {
    var root = document.getElementById('soloReference');
    if (!root) return;

    if (!_open) {
      root.classList.remove('open');
      root.innerHTML = '';
      return;
    }

    var sections = '';
    for (var i = 0; i < SECTIONS.length; i += 1) {
      sections += '<details class="solo-ref-section" ' + (i === 0 ? 'open' : '') + '>'
        + '<summary>' + SECTIONS[i].title + '</summary>'
        + '<div class="solo-ref-content">' + SECTIONS[i].body + '</div>'
        + '</details>';
    }

    root.classList.add('open');
    root.innerHTML = ''
      + '<div class="solo-ref-backdrop" onclick="window.soloReference.close()"></div>'
      + '<div class="solo-ref-panel">'
      + '  <div class="solo-ref-header">'
      + '    <span class="solo-ref-title">🧭 Solo Reference</span>'
      + '    <button class="solo-ref-close" onclick="window.soloReference.close()">✕</button>'
      + '  </div>'
      + '  <div class="solo-ref-body">' + sections + '</div>'
      + '  <div class="solo-ref-foot">Fast-reference only. GM-only controls stay in the GM Dashboard.</div>'
      + '</div>';
  }

  function open() {
    _open = true;
    render();
  }

  function close() {
    _open = false;
    render();
  }

  function toggle() {
    _open ? close() : open();
  }

  function init() {
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.soloReference = {
    open: open,
    close: close,
    toggle: toggle
  };
})();
