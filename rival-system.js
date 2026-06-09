(function(){
  function clamp(num,min,max){
    return Math.max(min,Math.min(max,num));
  }

  function snapRivalDreadDie(v){
    var chain=[4,6,8,10,12,20];
    var n=Math.max(4,Number(v)||4);
    var best=chain[0];
    for(var i=0;i<chain.length;i++){
      if(chain[i]<=n)best=chain[i];
      else break;
    }
    return best;
  }

  function shiftRivalDread(dread,steps){
    var chain=[4,6,8,10,12,20];
    var base=snapRivalDreadDie(dread);
    var idx=chain.indexOf(base);
    if(idx<0)idx=2;
    var next=clamp(idx+Number(steps||0),0,chain.length-1);
    return chain[next];
  }

  function startCampaignGmCheckRecord(spec) {
    if (window.campaignSystem && typeof window.campaignSystem.startGmPendingCheck === 'function') {
      return window.campaignSystem.startGmPendingCheck(spec || {});
    }
    return { ok: true, id: '' };
  }

  function resolveCampaignGmCheckRecord(checkId, outcome) {
    if (!checkId) return false;
    if (window.campaignSystem && typeof window.campaignSystem.resolveGmPendingCheck === 'function') {
      return window.campaignSystem.resolveGmPendingCheck(String(checkId), outcome || {});
    }
    return false;
  }

  function syncCampaignRivalState(reason){
    if(typeof window==='undefined'||!window.campaignSystem||typeof window.campaignSystem.getState!=='function'||typeof window.campaignSystem.syncSharedPatch!=='function')return;
    var snap=window.campaignSystem.getState()||{};
    if(!snap.code||snap.role!=='gm')return;
    var r=ensureRivalState();
    if(!r)return;
    try{
      var out=window.campaignSystem.syncSharedPatch({rival:JSON.parse(JSON.stringify(r))},reason||'rival-state');
      if(out&&typeof out.catch==='function')out.catch(function(){});
    }catch(_err){}
  }

  function ensureRivalState(){
    if(typeof S==='undefined'||!S||typeof S!=='object')return null;
    if((!S.rival||typeof S.rival!=='object')&&typeof window!=='undefined'&&window.campaignSystem&&typeof window.campaignSystem.getState==='function'&&typeof window.campaignSystem.getSharedState==='function'){
      var snap=window.campaignSystem.getState()||{};
      var shared=window.campaignSystem.getSharedState()||{};
      if(snap.code&&shared&&shared.rival&&typeof shared.rival==='object'){
        try{ S.rival=JSON.parse(JSON.stringify(shared.rival)); }catch(_err){ S.rival=shared.rival; }
      }
    }
    if(!S.rival||typeof S.rival!=='object'){
      var baseName='The Rival';
      if(S.backstory&&typeof S.backstory.rival==='string'&&S.backstory.rival.trim())baseName=S.backstory.rival.trim();
      S.rival={
        name:baseName,
        title:'Shadow Counterpart',
        dread:8,
        rapport:0,
        threatTier:1,
        alive:true,
        faction:'none',
        status:'rising',
        encounters:0,
        combatWins:0,
        combatLosses:0,
        defeatCount:0,
        lastOutcome:'',
        lastMap:'',
        history:[],
        lastGateToken:'',
        pendingEncounter:null,
        activeCombat:null
      };
    }
    var r=S.rival;
    if(typeof r.name!=='string'||!r.name.trim())r.name='The Rival';
    if(typeof r.title!=='string')r.title='Shadow Counterpart';
    if(typeof r.dread!=='number')r.dread=8;
    if(typeof r.rapport!=='number')r.rapport=0;
    if(typeof r.threatTier!=='number')r.threatTier=1;
    if(typeof r.alive!=='boolean')r.alive=true;
    if(typeof r.faction!=='string')r.faction='none';
    if(typeof r.status!=='string')r.status='rising';
    if(typeof r.encounters!=='number')r.encounters=0;
    if(typeof r.combatWins!=='number')r.combatWins=0;
    if(typeof r.combatLosses!=='number')r.combatLosses=0;
    if(typeof r.defeatCount!=='number')r.defeatCount=0;
    if(typeof r.lastOutcome!=='string')r.lastOutcome='';
    if(typeof r.lastMap!=='string')r.lastMap='';
    if(!Array.isArray(r.history))r.history=[];
    if(typeof r.lastGateToken!=='string')r.lastGateToken='';
    if(!r.pendingEncounter||typeof r.pendingEncounter!=='object')r.pendingEncounter=null;
    if(!r.activeCombat||typeof r.activeCombat!=='object')r.activeCombat=null;
    r.dread=snapRivalDreadDie(r.dread||8);
    r.rapport=clamp(Math.round(r.rapport||0),-8,8);
    r.threatTier=clamp(Math.round(r.threatTier||1),1,10);
    return r;
  }

  function isCombatSceneActive(){
    if(typeof S==='undefined'||!S||!S.combat)return false;
    if(S.combat.active)return true;
    return !!(Array.isArray(S.enemies)&&S.enemies.length);
  }

  function getPhaseGateToken(){
    try{
      if(typeof getCurrentTravelPhaseToken==='function')return String(getCurrentTravelPhaseToken());
      if(typeof getGameDatePhaseText==='function')return String(getGameDatePhaseText());
    }catch(_err){}
    var d=new Date();
    return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours()].join('|');
  }

  function rivalRoll(n,meta){
    if(typeof roll==='function')return roll(n,meta||null);
    return Math.floor(Math.random()*n)+1;
  }

  function rivalActionRoll(stat,dreadDie){
    var die=4;
    if(typeof getEffectiveDie==='function')die=getEffectiveDie(stat||'lead')||4;
    else if(S&&S.stats&&typeof S.stats[stat]==='number')die=S.stats[stat];
    var actorMeta={type:'action',major:true,label:'Rival '+String(stat||'lead').toUpperCase()};
    var dreadMeta={type:'dread',major:true,label:'Rival Dread'};
    var actor=(typeof explodingRoll==='function')?explodingRoll(die,actorMeta):{total:rivalRoll(die,actorMeta)};
    var dread=(typeof explodingRoll==='function')?explodingRoll(dreadDie||8,dreadMeta):{total:rivalRoll(dreadDie||8,dreadMeta)};
    return {
      actorTotal:Number(actor&&actor.total||0),
      dreadTotal:Number(dread&&dread.total||0),
      success:Number(actor&&actor.total||0)>=Number(dread&&dread.total||0),
      die:die,
      dreadDie:dreadDie||8
    };
  }

  function isRivalManualRollMode(){
    if(typeof window==='undefined'||!window.settingsSystem||typeof window.settingsSystem.isManualRollMode!=='function')return false;
    return !!window.settingsSystem.isManualRollMode();
  }

  function buildRivalManualModifierSummary(stat){
    if(typeof window!=='undefined'&&typeof window.buildManualRollModifierLines==='function'){
      var lines=window.buildManualRollModifierLines(stat,(typeof getEffectiveDie==='function')?getEffectiveDie(stat||'lead'):6,{extraLines:['Enter final totals after applying all listed modifiers.']})||[];
      if(!lines.length)return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;">No active modifiers detected.</div>';
      return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;line-height:1.5;">'
        + lines.map(function(p){return '<div>• '+p+'</div>';}).join('')
        + '</div>';
    }
    var key=String(stat||'lead').toLowerCase();
    var parts=[];
    if(typeof collectInventoryBonusesForStat==='function'){
      var inv=collectInventoryBonusesForStat(key)||{advDice:[],flat:0,addValor:0};
      if(Array.isArray(inv.advDice)&&inv.advDice.length)parts.push('Advantage dice: '+inv.advDice.map(function(d){return 'd'+Number(d);}).join(', '));
      if(Number(inv.flat||0)!==0)parts.push('Flat modifier: '+(Number(inv.flat)>0?'+':'')+Number(inv.flat));
      if(Number(inv.addValor||0)>0)parts.push('Bonus Valor Die: +'+Number(inv.addValor));
    }
    if(S&&S.conditions&&typeof S.conditions==='object'){
      var active=Object.keys(S.conditions).filter(function(c){return !!S.conditions[c];});
      if(active.length)parts.push('Conditions: '+active.map(function(c){return c.charAt(0).toUpperCase()+c.slice(1);}).join(', '));
    }
    if(!parts.length)return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;">No active modifiers detected.</div>';
    return '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;line-height:1.5;">'
      + parts.map(function(p){return '<div>• '+p+'</div>';}).join('')
      + '</div>';
  }

  function openRivalManualDecision(action,stat,intent,mapKey,key,dreadDie){
    if(typeof openModal!=='function')return false;
    var die=(typeof getEffectiveDie==='function')?getEffectiveDie(stat||'lead'):((S&&S.stats&&S.stats[stat])||4);
    var dread=Number(dreadDie||8);
    var tmw=Math.max(0,Number((S&&S.tmw)||0));
    var pushDread=shiftRivalDread(dread,1);
    var pendingCheck=startCampaignGmCheckRecord({
      type:'rival-outcome',
      scope:String(mapKey||'province'),
      label:'Rival '+String(action||'interaction'),
      stat:String(stat||'lead'),
      dread:dread,
      context:'Rival '+String(action||'interaction')+' ('+String(stat||'lead')+')',
      payload:{intent:String(intent||'positive'),mapKey:String(mapKey||'province'),key:String(key||'')}
    });
    if(pendingCheck&&pendingCheck.blocked)return false;
    window._pendingRivalManualDecision={
      action:String(action||'interaction'),
      stat:String(stat||'lead'),
      intent:String(intent||'positive'),
      mapKey:String(mapKey||'province'),
      key:String(key||''),
      dread:dread,
      die:Number(die||4),
      pendingCheckId:pendingCheck&&pendingCheck.id?String(pendingCheck.id):''
    };
    var html=''
      + '<div style="font-size:.82rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.86rem;color:var(--gold2);">Manual Rival Action</div>'
      + '<div style="margin-top:.2rem;"><strong>'+String(stat||'lead').toUpperCase()+' d'+String(die||4)+'</strong> vs <strong style="color:var(--red2);">Dread d'+String(dread)+'</strong></div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-top:.12rem;">Roll manually, then choose the outcome.</div>'
      + buildRivalManualModifierSummary(stat)
      + '<div style="margin-top:.35rem;padding:.28rem .35rem;border:1px solid rgba(232,192,80,.35);background:rgba(232,192,80,.08);">'
      + '<div style="font-size:.74rem;color:var(--gold2);"><strong>Teamwork:</strong> '+String(tmw)+' TMW</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-top:.08rem;">Push Luck costs 2 TMW and raises Dread to d'+String(pushDread)+'.</div>'
      + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem;">'
      + '<button class="btn btn-sm" onclick="if(typeof closeModal===\'function\')closeModal();">Cancel</button>'
      + '<button class="btn btn-sm btn-primary" onclick="resolveRivalManualDecision(true,false)">Success</button>'
      + '<button class="btn btn-sm btn-red" onclick="resolveRivalManualDecision(false,false)">Failure</button>'
      + '<button class="btn btn-sm btn-teal" '+(tmw>=2?'':'disabled')+' onclick="resolveRivalManualDecision(true,true)">Push Luck + Success</button>'
      + '<button class="btn btn-sm btn-warn" '+(tmw>=2?'':'disabled')+' onclick="resolveRivalManualDecision(false,true)">Push Luck + Failure</button>'
      + '</div>'
      + '</div>';
    openModal('Rival Manual Roll',html);
    return true;
  }

  function resolveRivalManualDecision(success,pushLuck){
    var pending=window._pendingRivalManualDecision||null;
    if(!pending)return;
    var wantsPush=!!pushLuck;
    var usedPush=false;
    var finalDread=Number(pending.dread||8);
    if(wantsPush){
      var tmw=Math.max(0,Number((S&&S.tmw)||0));
      if(tmw<2){
        if(typeof showNotif==='function')showNotif('Need 2 Teamwork to Push Luck.', 'warn');
        return;
      }
      if(typeof changeCounter==='function')changeCounter('tmw',-2);
      else S.tmw=Math.max(0,tmw-2);
      usedPush=true;
      finalDread=shiftRivalDread(finalDread,1);
    }
    window._pendingRivalManualDecision=null;
    if(typeof closeModal==='function')closeModal();
    resolveRivalInteraction(
      pending.action,
      pending.stat,
      pending.intent,
      pending.mapKey,
      pending.key,
      {
        success:!!success,
        manual:true,
        pushLuck:usedPush,
        actionDie:Number(pending.die||4),
        dreadDie:Number(finalDread||pending.dread||8),
        pendingCheckId:String(pending.pendingCheckId||'')
      }
    );
  }

  function addRivalHistory(text){
    var r=ensureRivalState();
    if(!r)return;
    r.history.push({at:Date.now(),text:String(text||'')});
    if(r.history.length>24)r.history=r.history.slice(r.history.length-24);
  }

  function triggerRivalAllySupport(mapKey,ctx){
    var r=ensureRivalState();
    if(!r||!r.alive||r.rapport<5)return false;
    if(rivalRoll(100)>35)return false;
    var teamworkGranted=2;
    var pathGranted=1;
    try{ if(typeof changeCounter==='function') changeCounter('tmw',teamworkGranted); }catch(_err){}
    try{ if(typeof changeCounter==='function') changeCounter('pathTokens',pathGranted); }catch(_err){}
    try{ if(typeof changeMentalStress==='function') changeMentalStress(-1); }catch(_err){}
    r.lastMap=String(mapKey||'');
    r.lastOutcome='Ally Support';
    addRivalHistory('['+String(mapKey||'province')+'] ally support triggered near '+String((ctx&&ctx.key)||'unknown')+'.');
    syncCampaignRivalState('rival-ally-support');
    if(typeof showNotif==='function'){
      showNotif(String(r.name)+' intervenes as an ally: +'+teamworkGranted+' Teamwork, +'+pathGranted+' Path Token, and steadied nerves.', 'good');
    }
    return true;
  }

  function ensureRivalPresenceMarker(isFriendly){
    if(typeof getBackstoryMarkerBucket!=='function')return;
    if(typeof mapData==='undefined'||!Array.isArray(mapData)||!mapData.length)return;
    var bucket=getBackstoryMarkerBucket('province',true);
    if(!bucket||typeof bucket!=='object')return;
    var marker=bucket.rival;
    if(!marker||!marker.key){
      var pool=mapData.filter(function(h){
        return h&&typeof h.col==='number'&&typeof h.row==='number'
          && (h.type==='wilderness'||h.type==='holding'||h.type==='dwelling'||h.type==='trade');
      });
      if(!pool.length)pool=mapData.slice();
      var picked=pool[Math.floor(Math.random()*pool.length)];
      if(!picked)return;
      marker={ key:String(picked.col)+','+String(picked.row) };
      bucket.rival=marker;
    }
    marker.icon=isFriendly?'🤝':'✶';
    marker.label=isFriendly?'Allied Rival Contact':'Rival Trail';
    marker.detail=isFriendly
      ?'Your rival turned ally is still active in the field. Meet here for support and hard choices.'
      :'A moving rival trail with signs of pressure and confrontation.';
  }

  function syncRivalStatus(){
    var r=ensureRivalState();
    if(!r)return;
    if(!r.alive){
      r.status='fallen';
      r.faction='none';
      return;
    }
    if(r.rapport>=5){
      r.status='heroic ally';
      r.faction='heroes';
    }else if(r.rapport>=2){
      r.status='uneasy ally';
      if(r.faction==='criminal' || r.faction==='warlord')r.faction='none';
    }else if(r.rapport<=-5){
      r.status='nemesis';
      if(r.threatTier>=6&&r.faction==='none')r.faction=rivalRoll(2)===1?'criminal':'warlord';
    }else if(r.rapport<=-2){
      r.status='hostile';
      if(r.threatTier>=4&&r.faction==='none'&&rivalRoll(100)<=40)r.faction='criminal';
    }else{
      r.status='rising';
    }
    ensureRivalPresenceMarker(r.rapport>=2);
  }

  function ensureRivalStatusHost(){
    var enemyList=document.getElementById('enemyList');
    if(!enemyList||!enemyList.parentElement)return null;
    var id='rivalCombatStatus';
    var node=document.getElementById(id);
    if(!node){
      node=document.createElement('div');
      node.id=id;
      node.style.marginTop='.35rem';
      node.style.padding='.35rem .45rem';
      node.style.border='1px solid rgba(224,80,80,.35)';
      node.style.background='rgba(224,80,80,.06)';
      node.style.fontSize='.75rem';
      node.style.color='var(--text2)';
      enemyList.parentElement.appendChild(node);
    }
    return node;
  }

  function renderRivalCombatStatus(){
    var r=ensureRivalState();
    if(!r)return;
    var host=ensureRivalStatusHost();
    if(!host)return;
    host.innerHTML='<strong style="color:var(--red2);">Rival:</strong> '
      + String(r.name)
      + ' | Dread d' + String(r.dread)
      + ' | Rapport ' + String(r.rapport)
      + ' | Threat ' + String(r.threatTier)
      + ' | Defeats ' + String(r.defeatCount) + '/3'
      + (r.lastOutcome ? ('<br><span style="color:var(--muted2);">Last Outcome: ' + String(r.lastOutcome) + '</span>') : '');
  }

  function openRivalEncounter(mapKey,ctx){
    var r=ensureRivalState();
    if(!r||!r.alive)return;
    var where=(ctx&&ctx.label)?String(ctx.label):'this zone';
    var mapLabel=String(mapKey||'province').toUpperCase();
    var baseDd=snapRivalDreadDie(r.dread + Math.max(0,Math.floor((r.threatTier-1)/2)));
    var indicator=r.rapport>=2?'Positive Path':(r.rapport<=-2?'Negative Path':'Uncertain Path');
    var dialogue = r.rapport>=3
      ? '"We keep crossing paths for a reason. Help me end this cleanly."'
      : (r.rapport<=-3
        ? '"You made me into this. Now witness what follows."'
        : '"Another crossing. Choose your side this time."');
    var html=''
      + '<div style="font-size:.82rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.9rem;color:var(--gold2);">Rival Encounter — '+mapLabel+'</div>'
      + '<div style="margin-top:.2rem;">'+String(r.name)+' appears in <strong>'+where+'</strong>.</div>'
      + '<div style="margin-top:.25rem;color:var(--muted2);">'+dialogue+'</div>'
      + '<div style="margin-top:.3rem;border:1px solid rgba(201,162,39,.35);background:rgba(201,162,39,.08);padding:.28rem .35rem;">'
      + '<strong>Interaction Indicator:</strong> '+indicator
      + ' | Rival Dread d'+String(baseDd)
      + ' | Threat Tier '+String(r.threatTier)
      + ' | Defeated '+String(r.defeatCount)+'/3'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.28rem;margin-top:.4rem;">'
      + '<button class="btn btn-sm btn-teal" onclick="resolveRivalInteraction(\'parley\',\'lead\',\'positive\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Parley (Lead)</button>'
      + '<button class="btn btn-sm btn-primary" onclick="resolveRivalInteraction(\'empathize\',\'spirit\',\'positive\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Empathize (Spirit)</button>'
      + '<button class="btn btn-sm btn-warn" onclick="resolveRivalInteraction(\'intimidate\',\'control\',\'negative\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Intimidate (Control)</button>'
      + '<button class="btn btn-sm" onclick="resolveRivalInteraction(\'undermine\',\'mind\',\'negative\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Undermine (Mind)</button>'
      + '</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem;">'
      + '<button class="btn btn-sm btn-red" onclick="startRivalCombat(\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">⚔ Enter Combat</button>'
      + '<button class="btn btn-sm" onclick="if(typeof closeModal===\'function\')closeModal();">Leave</button>'
      + '</div>'
      + '</div>';
    if(typeof openModal==='function')openModal('Rival Encounter',html);
    else if(typeof alert==='function')alert('Rival encountered in '+where+'.');
  }

  function resolveRivalInteraction(action,stat,intent,mapKey,key,manualOutcome){
    var r=ensureRivalState();
    if(!r||!r.alive)return;
    var dread=snapRivalDreadDie(r.dread + Math.max(0,Math.floor((r.threatTier-1)/2)));
    if(isRivalManualRollMode()&&(!manualOutcome||typeof manualOutcome.success!=='boolean')){
      openRivalManualDecision(action,stat,intent,mapKey,key,dread);
      return;
    }
    var pendingCheckId=manualOutcome&&manualOutcome.pendingCheckId?String(manualOutcome.pendingCheckId):'';
    if(!pendingCheckId){
      var pendingCheck=startCampaignGmCheckRecord({
        type:'rival-outcome',
        scope:String(mapKey||'province'),
        label:'Rival '+String(action||'interaction'),
        stat:String(stat||'lead'),
        dread:dread,
        context:'Rival '+String(action||'interaction')+' ('+String(stat||'lead')+')',
        payload:{intent:String(intent||'positive'),mapKey:String(mapKey||'province'),key:String(key||'')}
      });
      if(pendingCheck&&pendingCheck.blocked)return;
      pendingCheckId=pendingCheck&&pendingCheck.id?String(pendingCheck.id):'';
    }
    var rollOut=(manualOutcome&&typeof manualOutcome.success==='boolean')
      ? {
          actorTotal:0,
          dreadTotal:0,
          success:!!manualOutcome.success,
          die:Number((manualOutcome&&manualOutcome.actionDie)||((typeof getEffectiveDie==='function')?getEffectiveDie(stat||'lead'):4)||4),
          dreadDie:Number((manualOutcome&&manualOutcome.dreadDie)||dread||8),
          manual:true,
          pushLuck:!!(manualOutcome&&manualOutcome.pushLuck)
        }
      : rivalActionRoll(stat,dread);
    var success=!!rollOut.success;
    var label=String(action||'interaction');
    var failBy=Math.max(1,Number(rollOut&&rollOut.dreadTotal||0)-Number(rollOut&&rollOut.actorTotal||0));
    if(rollOut&&rollOut.manual)failBy=1;
    resolveCampaignGmCheckRecord(pendingCheckId,{
      success:success,
      stat:String(stat||'lead'),
      actionTotal:Number(rollOut&&rollOut.actorTotal||0),
      dreadTotal:Number(rollOut&&rollOut.dreadTotal||0),
      margin:success?Math.max(0,Number(rollOut&&rollOut.actorTotal||0)-Number(rollOut&&rollOut.dreadTotal||0)):failBy,
      failedBy:success?0:failBy,
      manual:!!(rollOut&&rollOut.manual),
      action:String(action||'interaction'),
      intent:String(intent||'')
    });
    var drift='';
    if(String(intent)==='positive'){
      if(success){
        r.rapport=clamp(r.rapport+1,-8,8);
        r.dread=shiftRivalDread(r.dread,-1);
        r.threatTier=clamp(r.threatTier-1,1,10);
        drift='Trust improved; rival pressure eased.';
      }else{
        r.rapport=clamp(r.rapport-1,-8,8);
        r.dread=shiftRivalDread(r.dread,1);
        r.threatTier=clamp(r.threatTier+1,1,10);
        drift='Attempt backfired; they grew sharper.';
      }
    }else{
      if(success){
        r.rapport=clamp(r.rapport-1,-8,8);
        r.dread=shiftRivalDread(r.dread,1);
        r.threatTier=clamp(r.threatTier+1,1,10);
        drift='You gain ground, but the rivalry escalates.';
      }else{
        r.rapport=clamp(r.rapport-2,-8,8);
        r.dread=shiftRivalDread(r.dread,2);
        r.threatTier=clamp(r.threatTier+2,1,10);
        drift='They exploit your opening and become more dangerous.';
      }
    }
    r.encounters=(r.encounters||0)+1;
    r.lastMap=String(mapKey||'');
    r.lastOutcome=(success?'Success':'Failure')+' - '+label+(rollOut.manual?' (manual)':'');
    addRivalHistory('['+String(mapKey||'province')+'] '+label+': '+(success?'success':'failure')+' ('+String(stat)+')'+(rollOut.manual?(rollOut.pushLuck?' [manual push-luck]':' [manual]'):'')+'.');
    syncRivalStatus();
    renderRivalCombatStatus();
    syncCampaignRivalState('rival-interaction');
    if(typeof closeModal==='function')closeModal();
    if(!success&&typeof addTMWOnFail==='function'){
      addTMWOnFail('rival-interaction-failure',{
        failedBy:failBy,
        actionDie:Math.max(4,Number(rollOut&&rollOut.die||4)),
        dreadDie:Math.max(4,Number(rollOut&&rollOut.dreadDie||dread||8)),
        actionLabel:String(stat||'lead').toUpperCase()+' Die'
      });
    }
    if(typeof showNotif==='function'){
      showNotif('Rival '+label+': '+(success?'success':'failure')+(rollOut.manual?' (manual)':'')+'. '+drift,success?'good':'warn');
    }
    if(typeof renderQP==='function')renderQP('combat');
  }

  function startRivalCombat(mapKey,key){
    var r=ensureRivalState();
    if(!r||!r.alive)return;
    var dd=snapRivalDreadDie(r.dread + Math.max(0,Math.floor(r.threatTier/2)));
    if(!S.combat||typeof S.combat!=='object')S.combat={enemyDread:8,spacing:'Engaged',actionsLeft:3,round:0,active:false,armyA:{stress:0,dread:0},armyB:{stress:0,dread:0}};
    S.combat.enemyDread=dd;
    if(Array.isArray(S.enemies)){
      S.enemies=S.enemies.filter(function(e){
        return !(e&&typeof e.name==='string'&&e.name.indexOf(String(r.name))===0);
      });
    }else{
      S.enemies=[];
    }
    if(typeof addEnemy==='function')addEnemy(r.name,dd);
    r.activeCombat={
      mapKey:String(mapKey||'province'),
      key:String(key||''),
      startedAt:Date.now(),
      dread:dd
    };
    r.lastMap=String(mapKey||'');
    r.lastOutcome='Combat Engaged';
    addRivalHistory('['+String(mapKey||'province')+'] combat engaged at '+String(key||'unknown'));
    renderRivalCombatStatus();
    syncCampaignRivalState('rival-combat-start');
    if(typeof updateCombatUI==='function')updateCombatUI();
    if(typeof renderEnemies==='function')renderEnemies();
    if(typeof renderQP==='function')renderQP('combat');
    if(typeof openQuickPanelTab==='function')openQuickPanelTab('combat');
    if(typeof switchTab==='function')switchTab('combat',null);
    if(typeof showNotif==='function')showNotif('Rival combat started. Resolve the scene, then record outcome after combat ends.', 'warn');
  }

  function openRivalCombatResolutionPrompt(){
    var r=ensureRivalState();
    if(!r||!r.activeCombat||typeof openModal!=='function')return false;
    var html=''
      + '<div style="font-size:.82rem;color:var(--text2);line-height:1.6;">'
      + '<div><strong>'+String(r.name)+'</strong> combat resolved.</div>'
      + '<div style="margin-top:.2rem;">Record the outcome from the scene that just ended.</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.45rem;">'
      + '<button class="btn btn-sm btn-primary" onclick="finalizeRivalCombat(true)">Record Combat Success</button>'
      + '<button class="btn btn-sm btn-red" onclick="finalizeRivalCombat(false)">Record Combat Failure</button>'
      + '</div>'
      + '</div>';
    openModal('Rival Combat Result',html);
    return true;
  }

  function finalizeRivalCombat(success){
    var r=ensureRivalState();
    if(!r)return;
    if(success){
      r.defeatCount=(r.defeatCount||0)+1;
      r.combatWins=(r.combatWins||0)+1;
      r.rapport=clamp(r.rapport-1,-8,8);
      if(r.defeatCount>=3){
        r.alive=false;
        r.lastOutcome='Combat Success - Rival Defeated Permanently';
        addRivalHistory('Final defeat delivered. Rival fell after three combats.');
        if(typeof showNotif==='function')showNotif('Final defeat: your rival has fallen after the third combat.', 'good');
      }else{
        r.dread=shiftRivalDread(r.dread,1);
        r.threatTier=clamp(r.threatTier+1,1,10);
        r.lastOutcome='Combat Success - Rival Escaped';
        addRivalHistory('Combat won. Rival escaped and hardened. Defeats: '+String(r.defeatCount)+'/3');
        if(typeof showNotif==='function')showNotif('Combat success. Rival escaped ('+String(r.defeatCount)+'/3 defeats).', 'good');
      }
    }else{
      r.combatLosses=(r.combatLosses||0)+1;
      r.dread=shiftRivalDread(r.dread,1);
      r.threatTier=clamp(r.threatTier+2,1,10);
      r.rapport=clamp(r.rapport-1,-8,8);
      r.lastOutcome='Combat Failure';
      if(r.threatTier>=6&&r.faction==='none')r.faction=rivalRoll(2)===1?'criminal':'warlord';
      addRivalHistory('Combat lost. Rival influence expanded.');
      if(typeof showNotif==='function')showNotif('Combat failed. Rival danger increased.', 'warn');
    }
    syncRivalStatus();
    renderRivalCombatStatus();
    r.activeCombat=null;
    syncCampaignRivalState('rival-combat-finalize');
    if(typeof closeModal==='function')closeModal();
    if(typeof renderQP==='function')renderQP('combat');
  }

  function rollRivalEncounterForMap(mapKey,ctx){
    var r=ensureRivalState();
    if(!r||!r.alive)return false;
    var where=ctx&&ctx.key?String(ctx.key):'unknown';
    var gate=String(mapKey||'province')+'|'+where+'|'+getPhaseGateToken();
    if(r.lastGateToken===gate)return false;
    if(isCombatSceneActive()){
      r.pendingEncounter={
        gate:gate,
        mapKey:String(mapKey||'province'),
        ctx:ctx||{}
      };
      return false;
    }
    r.lastGateToken=gate;
    if(triggerRivalAllySupport(mapKey,ctx))return true;
    if(r.threatTier>=7&&r.rapport<=-3){
      if(typeof showNotif==='function')showNotif('Rival threat spike: hostile ambush triggered.', 'warn');
      startRivalCombat(String(mapKey||'province'), String((ctx&&ctx.key)||''));
      return true;
    }
    if(rivalRoll(100)>20)return false;
    if(typeof ensureBackstoryScopeMarkers==='function'){
      try{
        ensureBackstoryScopeMarkers(String(mapKey||'province'),[{key:String(where),type:String((ctx&&ctx.terrain)||''),label:String((ctx&&ctx.label)||'')}],{});
      }catch(_err){}
    }
    openRivalEncounter(String(mapKey||'province'),ctx||{});
    return true;
  }

  function patchRivalEndCombatHook(){
    if(typeof window==='undefined'||window._rivalEndCombatPatched)return;
    if(typeof window.endCombat!=='function'){
      setTimeout(patchRivalEndCombatHook, 250);
      return;
    }
    window._rivalEndCombatPatched=true;
    var baseEndCombat=window.endCombat;
    window.endCombat=function(){
      var out=baseEndCombat.apply(this,arguments);
      var r=ensureRivalState();
      if(r&&r.activeCombat){
        setTimeout(function(){
          if(!isCombatSceneActive()) openRivalCombatResolutionPrompt();
        },30);
      } else if(r&&r.pendingEncounter){
        var pending=r.pendingEncounter;
        r.pendingEncounter=null;
        r.lastGateToken=String(pending.gate||'');
        setTimeout(function(){
          if(!isCombatSceneActive()) openRivalEncounter(String(pending.mapKey||'province'),pending.ctx||{});
        },40);
      }
      return out;
    };
  }

  window.ensureRivalState=ensureRivalState;
  window.rollRivalEncounterForMap=rollRivalEncounterForMap;
  window.resolveRivalInteraction=resolveRivalInteraction;
  window.resolveRivalManualDecision=resolveRivalManualDecision;
  window.startRivalCombat=startRivalCombat;
  window.finalizeRivalCombat=finalizeRivalCombat;
  window.renderRivalCombatStatus=renderRivalCombatStatus;
  patchRivalEndCombatHook();
})();
