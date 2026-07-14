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

  function rivalEsc(text){
    return String(text||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function getCampaignStateSnapshot(){
    if(typeof window==='undefined'||!window.campaignSystem||typeof window.campaignSystem.getState!=='function')return {};
    return window.campaignSystem.getState()||{};
  }

  function isConnectedCampaignGm(){
    var snap=getCampaignStateSnapshot();
    return !!(snap&&snap.connected&&snap.code&&snap.role==='gm');
  }

  function isConnectedCampaignPlayer(){
    var snap=getCampaignStateSnapshot();
    return !!(snap&&snap.connected&&snap.code&&snap.role==='player');
  }

  function getCampaignSceneTargets(){
    if(typeof window==='undefined'||!window.campaignSystem||typeof window.campaignSystem.getRollPromptTargets!=='function')return [];
    return window.campaignSystem.getRollPromptTargets()||[];
  }

  function buildCampaignSceneTargetOptionsHtml(selectedValue,opts){
    var cfg=opts&&typeof opts==='object'?opts:{};
    var includeActing=cfg.includeActing===true;
    var includeParty=cfg.includeParty!==false;
    var targets=getCampaignSceneTargets();
    var selected=String(selectedValue||'').trim();
    var body=[];
    if(includeActing)body.push('<option value="acting"'+(selected==='acting'?' selected':'')+'>Acting Character</option>');
    if(includeParty)body.push('<option value="party"'+(selected==='party'?' selected':'')+'>Entire Party</option>');
    targets.forEach(function(row){
      var token=String(row&&row.token||'').trim();
      if(!token)return;
      body.push('<option value="'+rivalEsc(token)+'"'+(token===selected?' selected':'')+'>'+rivalEsc(String(row&&row.name||'Wayfarer'))+'</option>');
    });
    return body.join('');
  }

  function resolveCampaignSceneOutcomeTarget(applyTargetValue,rollTargetValue){
    var applyValue=String(applyTargetValue||'acting').trim();
    if(applyValue==='acting'){
      var rollValue=String(rollTargetValue||'party').trim();
      return rollValue||'party';
    }
    return applyValue||'party';
  }

  function getCampaignSceneTargetLabel(targetValue){
    var value=String(targetValue||'').trim();
    if(!value||value==='party')return 'Entire Party';
    var targets=getCampaignSceneTargets();
    for(var i=0;i<targets.length;i++){
      var row=targets[i]||{};
      if(String(row.token||'').trim()!==value)continue;
      return String(row.name||'Wayfarer');
    }
    return 'Wayfarer';
  }

  function buildCampaignSceneStatOptionsHtml(selectedStat){
    var selected=String(selectedStat||'valor').trim().toLowerCase()||'valor';
    var stats=['body','mind','spirit','lead','control','defend','strike','shoot','valor'];
    return stats.map(function(stat){
      return '<option value="'+rivalEsc(stat)+'"'+(stat===selected?' selected':'')+'>'+rivalEsc(stat.toUpperCase())+'</option>';
    }).join('');
  }

  function openCampaignSceneCheckPrompt(spec){
    if(!isConnectedCampaignGm()||typeof openModal!=='function'||typeof window==='undefined'||!window.campaignSystem)return false;
    var cfg=spec&&typeof spec==='object'?spec:{};
    var targets=getCampaignSceneTargets();
    var defaultRollTarget=String(cfg.defaultRollTarget||'party').trim()||'party';
    var defaultOutcomeTarget=String(cfg.defaultOutcomeTarget||'acting').trim()||'acting';
    var defaultStat=String(cfg.stat||'valor').toLowerCase();
    window._pendingCampaignSceneCheck={
      title:String(cfg.title||'GM Scene Check'),
      label:String(cfg.label||'Scene Check'),
      context:String(cfg.context||cfg.label||'Scene Check'),
      type:String(cfg.type||'scene-check'),
      stat:defaultStat,
      dread:Math.max(4,Number(cfg.dread||6)),
      stake:String(cfg.stake||'GM decides who rolls and who takes the result.'),
      failurePenaltyType:String(cfg.failurePenaltyType||'mentalStress'),
      failurePenaltyScale:'margin',
      failTmw:Math.max(0,parseInt(cfg.failTmw,10)||0),
      payload:cfg.payload&&typeof cfg.payload==='object'?cfg.payload:{}
    };
    var html=''
      + '<div style="font-size:.82rem;color:var(--text2);line-height:1.6;">'
      + '<div style="font-family:\'Cinzel\',serif;font-size:.84rem;color:var(--gold2);">'+rivalEsc(String(cfg.context||cfg.label||'Scene Check'))+'</div>'
      + '<div style="margin-top:.18rem;"><strong>'+rivalEsc(defaultStat.toUpperCase())+'</strong> suggested vs <strong style="color:var(--red2);">Dread d'+Math.max(4,Number(cfg.dread||6))+'</strong></div>'
      + '<div style="font-size:.72rem;color:var(--muted2);margin-top:.16rem;">Choose who rolls, where the outcome lands, and how the table wants to resolve it.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.32rem;margin-top:.4rem;">'
      + '<label style="font-size:.68rem;color:var(--muted2);">Who Rolls?'
      + '<select id="campaignSceneRollTarget" style="width:100%;margin-top:.1rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.28rem .34rem;font-size:.78rem;">'
      + buildCampaignSceneTargetOptionsHtml(defaultRollTarget,{includeParty:true})
      + '</select></label>'
      + '<label style="font-size:.68rem;color:var(--muted2);">Requested Roll'
      + '<select id="campaignSceneStat" style="width:100%;margin-top:.1rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.28rem .34rem;font-size:.78rem;">'
      + buildCampaignSceneStatOptionsHtml(defaultStat)
      + '</select></label>'
      + '<label style="font-size:.68rem;color:var(--muted2);">Apply Outcome To'
      + '<select id="campaignSceneOutcomeTarget" style="width:100%;margin-top:.1rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.28rem .34rem;font-size:.78rem;">'
      + buildCampaignSceneTargetOptionsHtml(defaultOutcomeTarget,{includeActing:true,includeParty:true})
      + '</select></label>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1.1fr 92px;gap:.32rem;margin-top:.32rem;">'
      + '<label style="font-size:.68rem;color:var(--muted2);">Failure Consequence'
      + '<select id="campaignScenePenaltyType" style="width:100%;margin-top:.1rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.28rem .34rem;font-size:.78rem;">'
      + '<option value="mentalStress"'+(String(cfg.failurePenaltyType||'mentalStress').toLowerCase()==='mentalstress'?' selected':'')+'>Mental Stress</option>'
      + '<option value="health"'+(String(cfg.failurePenaltyType||'').toLowerCase()==='health'?' selected':'')+'>Damage</option>'
      + '<option value="radiation"'+(String(cfg.failurePenaltyType||'').toLowerCase()==='radiation'?' selected':'')+'>Radiation</option>'
      + '</select></label>'
      + '<label style="font-size:.68rem;color:var(--muted2);">Fail TMW'
      + '<input id="campaignSceneFailTmw" type="number" min="0" max="20" value="'+Math.max(0,parseInt(cfg.failTmw,10)||0)+'" style="width:100%;margin-top:.1rem;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.28rem .34rem;font-size:.78rem;"></label>'
      + '</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-top:.2rem;">Success always grants <strong style="color:var(--green2);">+1 Successful Roll</strong>. Failure always applies the failed margin as the chosen consequence.</div>'
      + '<div style="font-size:.68rem;color:var(--muted2);margin-top:.24rem;">'+rivalEsc(cfg.stake)+'</div>'
      + '<div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end;margin-top:.46rem;">'
      + '<button class="btn btn-sm" onclick="if(typeof closeModal===\'function\')closeModal();">Cancel</button>'
      + '<button class="btn btn-sm btn-teal" onclick="submitCampaignSceneCheckAction(\'prompt\')">Ask Player To Roll</button>'
      + '<button class="btn btn-sm" onclick="submitCampaignSceneCheckAction(\'manual\')">Record Physical Totals</button>'
      + '<button class="btn btn-sm btn-primary" onclick="submitCampaignSceneCheckAction(\'success\')">Resolve Success</button>'
      + '<button class="btn btn-sm btn-red" onclick="submitCampaignSceneCheckAction(\'failure\')">Resolve Failure</button>'
      + '</div>'
      + '</div>';
    openModal(String(cfg.title||'GM Scene Check'),html);
    return true;
  }

  async function submitCampaignSceneCheckAction(mode){
    var cfg=window._pendingCampaignSceneCheck||null;
    if(!cfg||!window.campaignSystem||typeof window.campaignSystem.startGmPendingCheck!=='function')return false;
    var rollTargetEl=document.getElementById('campaignSceneRollTarget');
    var statEl=document.getElementById('campaignSceneStat');
    var outcomeTargetEl=document.getElementById('campaignSceneOutcomeTarget');
    var penaltyTypeEl=document.getElementById('campaignScenePenaltyType');
    var failTmwEl=document.getElementById('campaignSceneFailTmw');
    var rollTargetValue=String((rollTargetEl&&rollTargetEl.value)||'party').trim()||'party';
    var requestedStat=String((statEl&&statEl.value)||cfg.stat||'valor').trim().toLowerCase()||'valor';
    var outcomeTargetValue=String((outcomeTargetEl&&outcomeTargetEl.value)||'acting').trim()||'acting';
    var resolvedOutcomeTarget=resolveCampaignSceneOutcomeTarget(outcomeTargetValue,rollTargetValue);
    var failurePenaltyType=String((penaltyTypeEl&&penaltyTypeEl.value)||cfg.failurePenaltyType||'none');
    var failurePenaltyScale='margin';
    var failTmw=Math.max(0,parseInt((failTmwEl&&failTmwEl.value)||cfg.failTmw,10)||0);
    var rollScope=rollTargetValue==='party'?'party':'individual';
    var outcomeScope=resolvedOutcomeTarget==='party'?'party':'individual';
    if(mode==='manual'&&rollScope==='party'){
      if(typeof showNotif==='function')showNotif('Manual totals need one acting character. Use Ask Player To Roll for an all-party check.','warn');
      return false;
    }
    var rollLabel=getCampaignSceneTargetLabel(rollTargetValue);
    var pendingLabel=(rollScope==='party'?'Entire Party':rollLabel)+' · '+String(cfg.label||cfg.context||'Scene Check');
    var pendingSpec={
      type:String(cfg.type||'scene-check'),
      scope:rollScope,
      label:pendingLabel,
      stat:requestedStat,
      statOptions:[requestedStat],
      dread:Math.max(4,Number(cfg.dread||6)),
      context:String(cfg.context||pendingLabel),
      stake:String(cfg.stake||'Scene check'),
      participants:rollScope==='individual'?[{token:rollTargetValue,name:rollLabel}]:[],
      payload:Object.assign({},cfg.payload||{},{
        defaultOutcomeTarget:resolvedOutcomeTarget,
        rollTarget:rollTargetValue,
        rollScope:rollScope,
        failurePenaltyType:failurePenaltyType,
        failurePenaltyScale:failurePenaltyScale,
        failTmw:failTmw,
        autoResolveOnSubmit:rollScope==='individual'
      })
    };
    var pendingCheck=window.campaignSystem.startGmPendingCheck(pendingSpec);
    if(!pendingCheck||!pendingCheck.ok||!pendingCheck.id){
      if(typeof showNotif==='function')showNotif((pendingCheck&&pendingCheck.error)||'Could not open the scene check.','warn');
      return false;
    }
    var checkId=String(pendingCheck.id||'');
    if(mode==='prompt'){
      var promptResult=await window.campaignSystem.requestRollPrompt(
        pendingLabel,
        requestedStat,
        Math.max(4,Number(cfg.dread||6)),
        rollScope==='individual'?rollTargetValue:'',
        {
          pendingCheckId: checkId,
          autoResolveOnSubmit: rollScope==='individual',
          defaultOutcomeTarget: resolvedOutcomeTarget,
          failurePenaltyType: failurePenaltyType,
          failTmw: failTmw
        }
      );
      if(!promptResult||!promptResult.ok){
        if(typeof showNotif==='function')showNotif((promptResult&&promptResult.error)||'Could not prompt the table.','warn');
        return false;
      }
      if(typeof closeModal==='function')closeModal();
      window._pendingCampaignSceneCheck=null;
      if(typeof window.campaignSystem.sendChatMessage==='function'){
        window.campaignSystem.sendChatMessage({
          message:'🎲 '+(rollScope==='party'?'Entire Party':rollLabel)+' rolls '+requestedStat.toUpperCase()+' vs d'+Math.max(4,Number(cfg.dread||6))+(cfg.context?(' · '+String(cfg.context)):''),
          targetToken:rollScope==='individual'?rollTargetValue:''
        });
      }
      if(typeof renderQP==='function')renderQP('campaign');
      if(typeof showNotif==='function')showNotif(rollScope==='party'?'Table check opened. Resolve after submissions come in.':'Player prompt sent. It will resolve automatically after their submission.', 'good');
      return true;
    }

    if(typeof closeModal==='function')closeModal();
    window._pendingCampaignSceneCheck=null;

    if(mode==='manual'){
      if(typeof window.openProvinceManualCheckPrompt!=='function'){
        if(typeof showNotif==='function')showNotif('Manual roll prompt is unavailable.','warn');
        return false;
      }
      var actionDie=(typeof window.campaignSystem.getCampaignCharacterDie==='function')
        ? window.campaignSystem.getCampaignCharacterDie(rollTargetValue,requestedStat,4)
        : 4;
      window.openProvinceManualCheckPrompt({
        title:String(cfg.title||'Campaign Check'),
        context:pendingLabel,
        statKey:requestedStat,
        statLabel:requestedStat.toUpperCase(),
        actionDie:actionDie,
        dreadDie:Math.max(4,Number(cfg.dread||6)),
        onResolve:function(outcome){
          window.campaignSystem.resolveSceneCheckOutcome({
            checkId:checkId,
            success:!!(outcome&&outcome.success),
            actionTotal:Number(outcome&&outcome.actionTotal||0),
            dreadTotal:Number(outcome&&outcome.dreadTotal||0),
            manual:true,
            resolvedVia:'gm-manual-scene-check',
            scope:outcomeScope,
            targetValue:resolvedOutcomeTarget,
            failurePenaltyType:failurePenaltyType,
            failurePenaltyScale:failurePenaltyScale,
            failTmw:failTmw
          }).then(function(resolved){
            if(!resolved||!resolved.ok){
              if(typeof showNotif==='function')showNotif((resolved&&resolved.error)||'Could not resolve the shared check.','warn');
              return;
            }
            if(typeof renderQP==='function')renderQP('campaign');
            if(typeof showNotif==='function')showNotif('Shared check resolved: '+(outcome&&outcome.success?'success':'failure')+'.', outcome&&outcome.success?'good':'warn');
          });
        }
      });
      return true;
    }

    var success=String(mode||'').toLowerCase()==='success';
    var resolved=await window.campaignSystem.resolveSceneCheckOutcome({
      checkId:checkId,
      success:success,
      actionTotal:success?Math.max(4,Number(cfg.dread||6)):0,
      dreadTotal:Math.max(4,Number(cfg.dread||6)),
      manual:false,
      resolvedVia:'gm-scene-buttons',
      scope:outcomeScope,
      targetValue:resolvedOutcomeTarget,
      failurePenaltyType:failurePenaltyType,
      failurePenaltyScale:failurePenaltyScale,
      failTmw:failTmw
    });
    if(!resolved||!resolved.ok){
      if(typeof showNotif==='function')showNotif((resolved&&resolved.error)||'Could not resolve the shared check.','warn');
      return false;
    }
    if(typeof renderQP==='function')renderQP('campaign');
    if(typeof showNotif==='function')showNotif('Shared check resolved: '+(success?'success':'failure')+'.', success?'good':'warn');
    return true;
  }

  function openRivalSceneCheck(action,stat,intent,mapKey,key){
    var r=ensureRivalState();
    if(!r||!r.alive)return false;
    var dread=snapRivalDreadDie(r.dread + Math.max(0,Math.floor((r.threatTier-1)/2)));
    return openCampaignSceneCheckPrompt({
      title:'Rival Scene Check',
      label:'Rival '+String(action||'interaction'),
      context:'Rival '+String(action||'interaction')+' ('+String(stat||'lead').toUpperCase()+')',
      type:'rival-outcome',
      stat:String(stat||'lead'),
      dread:dread,
      failurePenaltyType:'mentalStress',
      failTmw:1,
      stake:'The GM assigns who acts, who receives the outcome, and whether the table rolls or resolves immediately.',
      payload:{
        sceneType:'rival-interaction',
        action:String(action||'interaction'),
        intent:String(intent||'positive'),
        mapKey:String(mapKey||'province'),
        key:String(key||'')
      }
    });
  }

  function handleRivalInteractionChoice(action,stat,intent,mapKey,key){
    var nextAction=String(action||'interaction');
    var nextStat=String(stat||'lead');
    var nextIntent=String(intent||'positive');
    var nextMapKey=String(mapKey||'province');
    var nextKey=String(key||'');
    if(isConnectedCampaignGm()){
      return openRivalSceneCheck(nextAction,nextStat,nextIntent,nextMapKey,nextKey);
    }
    if(isConnectedCampaignPlayer()){
      if(window.campaignSystem&&typeof window.campaignSystem.sendChatMessage==='function'){
        try{
          window.campaignSystem.sendChatMessage({
            message:'🗣️ Rival intent: '+nextAction+' with '+nextStat.toUpperCase()+' at '+(nextKey||nextMapKey)+'. GM can assign the roll when ready.'
          });
        }catch(_err){}
      }
      if(typeof showNotif==='function'){
        showNotif('Tell the GM your approach. They can now assign the roll and outcome from their screen.','info');
      }
      if(typeof closeModal==='function')closeModal();
      return true;
    }
    resolveRivalInteraction(nextAction,nextStat,nextIntent,nextMapKey,nextKey);
    return true;
  }

  function applyRivalInteractionOutcome(action,stat,intent,mapKey,key,rollOut,options){
    var r=ensureRivalState();
    if(!r||!r.alive)return false;
    var result=rollOut&&typeof rollOut==='object'?rollOut:{success:false,actorTotal:0,dreadTotal:0,die:4,dreadDie:8,manual:false,pushLuck:false};
    var meta=options&&typeof options==='object'?options:{};
    var success=!!result.success;
    var label=String(action||'interaction');
    var failBy=Math.max(1,Number(meta.failedBy||0)||Math.max(1,Number(result.dreadTotal||0)-Number(result.actorTotal||0)));
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
    r.lastOutcome=(success?'Success':'Failure')+' - '+label+(result.manual?' (manual)':'');
    addRivalHistory('['+String(mapKey||'province')+'] '+label+': '+(success?'success':'failure')+' ('+String(stat)+')'+(result.manual?(result.pushLuck?' [manual push-luck]':' [manual]'):'')+'.');
    syncRivalStatus();
    renderRivalCombatStatus();
    syncCampaignRivalState('rival-interaction');
    if(!success&&!meta.effectsHandledByCampaign&&typeof addTMWOnFail==='function'){
      addTMWOnFail('rival-interaction-failure',{
        failedBy:failBy,
        actionDie:Math.max(4,Number(result&&result.die||4)),
        dreadDie:Math.max(4,Number(result&&result.dreadDie||8)),
        actionLabel:String(stat||'lead').toUpperCase()+' Die'
      });
    }
    if(typeof showNotif==='function'){
      showNotif('Rival '+label+': '+(success?'success':'failure')+(result.manual?' (manual)':'')+'. '+drift,success?'good':'warn');
    }
    if(typeof renderQP==='function')renderQP('combat');
    return true;
  }

  function handleRivalCampaignSceneCheckResolved(evt){
    var check=evt&&evt.check&&typeof evt.check==='object'?evt.check:null;
    if(!check||String(check.type||'')!=='rival-outcome')return;
    var payload=check.payload&&typeof check.payload==='object'?check.payload:{};
    if(payload.sceneType&&String(payload.sceneType)!=='rival-interaction')return;
    var outcome=evt&&evt.outcome&&typeof evt.outcome==='object'?evt.outcome:{};
    var stat=String(check.stat||payload.stat||'lead');
    var rollTarget=String(payload.rollTarget||'').trim();
    var actorDie=(rollTarget&&rollTarget!=='party'&&window.campaignSystem&&typeof window.campaignSystem.getCampaignCharacterDie==='function')
      ? window.campaignSystem.getCampaignCharacterDie(rollTarget,stat,4)
      : 4;
    applyRivalInteractionOutcome(
      String(payload.action||'interaction'),
      stat,
      String(payload.intent||'positive'),
      String(payload.mapKey||'province'),
      String(payload.key||''),
      {
        actorTotal:Number(outcome.actionTotal||0),
        dreadTotal:Number(outcome.dreadTotal||check.dread||0),
        success:!!outcome.success,
        die:Math.max(4,Number(actorDie||4)),
        dreadDie:Math.max(4,Number(check.dread||payload.dread||8)),
        manual:!!(outcome.manual||String(outcome.resolvedVia||'').indexOf('manual')>=0),
        pushLuck:false
      },
      {
        failedBy:Number(outcome.failedBy||0),
        effectsHandledByCampaign:true
      }
    );
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
    var playerCampaign=isConnectedCampaignPlayer();
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
      + (playerCampaign
        ? '<div style="margin-top:.28rem;font-size:.72rem;color:var(--muted2);">Choose the approach you want, then the GM can assign the roll and consequences from their screen.</div>'
        : '<div style="margin-top:.28rem;font-size:.72rem;color:var(--muted2);">Pick the approach that fits the scene. In campaign mode the GM can decide who rolls and who receives the outcome.</div>')
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.28rem;margin-top:.4rem;">'
      + '<button class="btn btn-sm btn-teal" onclick="handleRivalInteractionChoice(\'parley\',\'lead\',\'positive\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Parley (Lead)</button>'
      + '<button class="btn btn-sm btn-primary" onclick="handleRivalInteractionChoice(\'empathize\',\'spirit\',\'positive\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Empathize (Spirit)</button>'
      + '<button class="btn btn-sm btn-warn" onclick="handleRivalInteractionChoice(\'intimidate\',\'control\',\'negative\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Intimidate (Control)</button>'
      + '<button class="btn btn-sm" onclick="handleRivalInteractionChoice(\'undermine\',\'mind\',\'negative\',\''+String(mapKey||'province')+'\',\''+String((ctx&&ctx.key)||'')+'\')">Undermine (Mind)</button>'
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
    if(typeof closeModal==='function')closeModal();
    applyRivalInteractionOutcome(action,stat,intent,mapKey,key,rollOut,{failedBy:failBy});
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

  function installRivalCampaignSceneCheckHook(){
    if(typeof window==='undefined'||window._rivalCampaignSceneCheckHookInstalled)return;
    var previousHook=typeof window.handleCampaignSceneCheckResolved==='function'
      ? window.handleCampaignSceneCheckResolved
      : null;
    window.handleCampaignSceneCheckResolved=function(evt){
      if(typeof previousHook==='function'){
        try{ previousHook(evt); }catch(_err){}
      }
      handleRivalCampaignSceneCheckResolved(evt);
    };
    window._rivalCampaignSceneCheckHookInstalled=true;
  }

  window.ensureRivalState=ensureRivalState;
  window.handleRivalInteractionChoice=handleRivalInteractionChoice;
  window.openCampaignSceneCheckPrompt=openCampaignSceneCheckPrompt;
  window.submitCampaignSceneCheckAction=submitCampaignSceneCheckAction;
  window.openRivalSceneCheck=openRivalSceneCheck;
  window.rollRivalEncounterForMap=rollRivalEncounterForMap;
  window.resolveRivalInteraction=resolveRivalInteraction;
  window.resolveRivalManualDecision=resolveRivalManualDecision;
  window.startRivalCombat=startRivalCombat;
  window.finalizeRivalCombat=finalizeRivalCombat;
  window.renderRivalCombatStatus=renderRivalCombatStatus;
  installRivalCampaignSceneCheckHook();
  patchRivalEndCombatHook();
})();
