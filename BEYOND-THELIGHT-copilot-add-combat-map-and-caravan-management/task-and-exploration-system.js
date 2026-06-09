// task-and-exploration-system.js
// Adds task system for Holdings, wilderness exploration, enhanced encounters, and approach dropdowns

function getApproachGroups(){
  return{
    'Combat':{stats:['strike','shoot','defend']},
    'Physical':{stats:['body']},
    'Social':{stats:['spirit','lead']},
    'Mental':{stats:['control','mind']}
  };
}

function buildApproachSelectHTML(selectedStat){
  if(!selectedStat)selectedStat='lead';
  let h='';
  const groups=getApproachGroups();
  Object.entries(groups).forEach(([approach,details])=>{
    h+=`<optgroup label="${approach}">`;
    details.stats.forEach(stat=>{
      const sel=stat===selectedStat?'selected':'';
      h+=`<option value="${stat}" ${sel}>${stat.toUpperCase()}</option>`;
    });
    h+='</optgroup>';
  });
  return h;
}

function promiseWildernessExploration(col,row){
  const hex=mapData.find(h=>h.col===col&&h.row===row);
  if(!hex||hex.type!=='wilderness')return;
  const options=getAvailableObservationDirections(col,row);
  if(!options.length){
    showNotif('No adjacent hexes available to observe from this edge.','warn');
    return;
  }
  let html='<div style="font-size:.82rem;color:var(--text2);margin-bottom:.35rem;">Choose one adjacent direction to observe (Lead vs DD6).</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.3rem;">';
  options.forEach(opt=>{
    html+=`<button class="btn btn-sm btn-gold" onclick="performWildernessObservation(${col},${row},'${opt.key}')">${opt.label}</button>`;
  });
  html+='</div>';
  openModal('Observe Adjacent Hex',html);
}

function performWildernessObservation(col,row,directionKey){
  const leadDie=typeof getEffectiveDie==='function'?getEffectiveDie('lead'):((S&&S.stats&&S.stats.lead)||4);
  const target=getAdjacentHexByDirection(col,row,directionKey);
  
  // Check if manual roll mode is enabled
  if(typeof isManualRollModeEnabled==='function'&&isManualRollModeEnabled()){
    openWildernessObservationRollChoice(col,row,directionKey,target,leadDie);
    return;
  }
  
  // Automatic roll (existing behavior)
  const leadRoll=explodingRoll(leadDie);
  const dreadRoll=explodingRoll(6);
  const success=leadRoll.total>=dreadRoll.total;
  
  let html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.4rem;">'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Lead Die</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--teal);">'+leadRoll.total+'</div></div>'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Dread Die</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--red);">'+dreadRoll.total+'</div></div>'
    +'</div>';
    
  if(success){
    if(typeof window.registerSecretPadClue==='function')window.registerSecretPadClue('province','intel');
    if(typeof addSuccessRoll==='function')addSuccessRoll();
    if(!target){
      html+=`<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">No Adjacent Hex</div>There is no mapped hex in that direction.</div>`;
    }else{
      if(typeof window.revealMapFogHex==='function')window.revealMapFogHex('province',String(target.hex.col)+','+String(target.hex.row));
      // Assign a wonder to the target hex if it doesn't have one yet
      if(target.hex.type==='wilderness'&&!target.hex.data.wonder&&target.hex.terrain&&typeof pick==='function'){
        const terrainData=TERRAIN_DESC[target.hex.terrain.name];
        if(terrainData&&terrainData.wonder&&Array.isArray(terrainData.wonder)){
          if(!target.hex.data)target.hex.data={};
          target.hex.data.wonder=pick(terrainData.wonder);
        }
      }
      html+=`<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Successful Observation (${target.label})</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);">${formatObservedHexSummary(target.hex)}</div></div>`;
    }
  }else{
    if(typeof addTMWOnFail==='function')addTMWOnFail('observation-failure',{
      failedBy:Math.max(1,Number(dreadRoll.total||0)-Number(leadRoll.total||0)),
      actionDie:Math.max(4,Number(leadDie)||4),
      dreadDie:6,
      actionLabel:'Lead Die',
      onConvert:function(){
        if(typeof window.registerSecretPadClue==='function')window.registerSecretPadClue('province','intel');
        if(target&&typeof window.revealMapFogHex==='function')window.revealMapFogHex('province',String(target.hex.col)+','+String(target.hex.row));
        if(target&&target.hex&&target.hex.type==='wilderness'&&!target.hex.data.wonder&&target.hex.terrain&&typeof pick==='function'){
          const terrainData=TERRAIN_DESC[target.hex.terrain.name];
          if(terrainData&&terrainData.wonder&&Array.isArray(terrainData.wonder)){
            if(!target.hex.data)target.hex.data={};
            target.hex.data.wonder=pick(terrainData.wonder);
          }
        }
        if(typeof renderHexMap==='function')renderHexMap();
        appendHexNote(col,row,`[Observation] Teamwork converted ${directionKey||'adjacent'} to success.`);
        if(target&&typeof openModal==='function'){
          setTimeout(function(){
            openModal('Observation — Teamwork Success',`<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Observation converted (${target.label})</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);">${formatObservedHexSummary(target.hex)}</div><div style="font-size:.72rem;color:var(--muted2);margin-top:.3rem;">No Successful Roll gained.</div></div>`);
          },80);
        }
        return !!target;
      }
    });
    html+=`<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">✗ Observation Failed</div>The horizon is obscured. No details visible.</div>`;
  }
  if(typeof renderHexMap==='function')renderHexMap();
  
  openModal('Observation — Adjacent Hexes',html);
  appendHexNote(col,row,`[Observation] Lead vs DD6 (${directionKey||'adjacent'}): ${leadRoll.total} vs ${dreadRoll.total} => ${success?'success':'failure'}`);
}

function openWildernessObservationRollChoice(col,row,directionKey,target,leadDie){
  window.selectedDice={action:leadDie,dread:6};
  const html=''
    +'<div style="font-size:.84rem;color:var(--text2);line-height:1.55;">'
    +'Manual Roll Mode is enabled. For this low-stakes observation, choose how to resolve it.'
    +'<div style="margin-top:.34rem;font-size:.76rem;color:var(--muted2);">'
    +'<strong>Auto Roll:</strong> system rolls Lead vs DD6 now.<br>'
    +'<strong>Manual Roll:</strong> you enter physical dice totals with modifier guidance.'
    +'</div>'
    +'</div>'
    +'<div style="display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;margin-top:.46rem;">'
    +'<button class="btn btn-sm" onclick="closeModal()">Cancel</button>'
    +'<button class="btn btn-sm btn-gold" onclick="resolveWildernessObservationRollChoice('+col+','+row+',\''+String(directionKey||'').replace(/'/g,"\\'")+'\',false)">Auto Roll</button>'
    +'<button class="btn btn-sm btn-primary" onclick="resolveWildernessObservationRollChoice('+col+','+row+',\''+String(directionKey||'').replace(/'/g,"\\'")+'\',true)">Manual Roll</button>'
    +'</div>';
  openModal('Observation — Roll Mode',html);
}

function resolveWildernessObservationRollChoice(col,row,directionKey,useManual){
  closeModal();
  const target=getAdjacentHexByDirection(col,row,directionKey);
  if(useManual){
    performWildernessObservationManualRoll(col,row,directionKey,target);
    return;
  }
  const leadDie=typeof getEffectiveDie==='function'?getEffectiveDie('lead'):((S&&S.stats&&S.stats.lead)||4);
  const leadRoll=explodingRoll(leadDie);
  const dreadRoll=explodingRoll(6);
  const success=leadRoll.total>=dreadRoll.total;
  let html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.4rem;">'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Lead Die</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--teal);">'+leadRoll.total+'</div></div>'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Dread Die</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--red);">'+dreadRoll.total+'</div></div>'
    +'</div>';
  if(success){
    if(typeof window.registerSecretPadClue==='function')window.registerSecretPadClue('province','intel');
    if(typeof addSuccessRoll==='function')addSuccessRoll();
    if(!target){
      html+='<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">No Adjacent Hex</div>There is no mapped hex in that direction.</div>';
    }else{
      if(typeof window.revealMapFogHex==='function')window.revealMapFogHex('province',String(target.hex.col)+','+String(target.hex.row));
      if(target.hex.type==='wilderness'&&!target.hex.data.wonder&&target.hex.terrain&&typeof pick==='function'){
        const terrainData=TERRAIN_DESC[target.hex.terrain.name];
        if(terrainData&&terrainData.wonder&&Array.isArray(terrainData.wonder)){
          if(!target.hex.data)target.hex.data={};
          target.hex.data.wonder=pick(terrainData.wonder);
        }
      }
      html+='<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Successful Observation ('+target.label+')</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);">'+formatObservedHexSummary(target.hex)+'</div></div>';
    }
  }else{
    if(typeof addTMWOnFail==='function')addTMWOnFail();
    html+='<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">✗ Observation Failed</div>The horizon is obscured. No details visible.</div>';
  }
  if(typeof renderHexMap==='function')renderHexMap();
  openModal('Observation — Adjacent Hexes',html);
  appendHexNote(col,row,'[Observation] Lead vs DD6 ('+(directionKey||'adjacent')+'): '+leadRoll.total+' vs '+dreadRoll.total+' => '+(success?'success':'failure')+' [auto]');
}

function getAvailableObservationDirections(col,row){
  const dirs=[
    {key:'north',label:'North',dc:0,dr:-1},
    {key:'northeast',label:'Northeast',dc:1,dr:-1},
    {key:'east',label:'East',dc:1,dr:0},
    {key:'southeast',label:'Southeast',dc:1,dr:1},
    {key:'south',label:'South',dc:0,dr:1},
    {key:'southwest',label:'Southwest',dc:-1,dr:1},
    {key:'west',label:'West',dc:-1,dr:0},
    {key:'northwest',label:'Northwest',dc:-1,dr:-1}
  ];
  return dirs.filter(d=>mapData.some(h=>h.col===col+d.dc&&h.row===row+d.dr));
}

function getAdjacentHexByDirection(col,row,directionKey){
  const dirs=getAvailableObservationDirections(col,row);
  const d=dirs.find(x=>x.key===directionKey);
  if(!d)return null;
  const hex=mapData.find(h=>h.col===col+d.dc&&h.row===row+d.dr);
  if(!hex)return null;
  return {hex:hex,label:d.label};
}

function getAdjacentHexes(col,row){
  const offsets=[
    [-1,-1],[0,-1],[1,-1],
    [-1,0],        [1,0],
    [-1,1], [0,1], [1,1]
  ];
  const out=[];
  offsets.forEach(([dc,dr])=>{
    const h=mapData.find(x=>x.col===col+dc&&x.row===row+dr);
    if(h)out.push(h);
  });
  return out;
}

function performWildernessObservationManualRoll(col,row,directionKey,target){
  const leadDie=window.selectedDice.action||4;
  const dreadDie=window.selectedDice.dread||6;
  const modifierLines=(typeof window!=='undefined'&&typeof window.buildManualRollModifierLines==='function')
    ? (window.buildManualRollModifierLines('lead',leadDie,{extraLines:['Enter final totals after applying all listed modifiers.']})||[])
    : [];
  const modifierHtml=modifierLines.length
    ? '<div style="font-size:.72rem;color:var(--muted2);margin-top:.18rem;line-height:1.5;">'+modifierLines.map(function(p){return '<div>• '+p+'</div>';}).join('')+'</div>'
    : '';
  
  let html='<div style="font-size:.85rem;color:var(--text2);line-height:1.6;">'
    +'<div style="background:rgba(46,196,182,.05);border:1px solid rgba(46,196,182,.25);padding:.35rem .45rem;margin-bottom:.4rem;border-radius:3px;">'
    +'<div style="font-size:.75rem;color:var(--teal);margin-bottom:.1rem;"><strong>Manual Observation</strong></div>'
    +'<div><strong style="color:var(--text2);">Lead d'+leadDie+'</strong> <span style="color:var(--muted2);">vs</span> <strong style="color:var(--red);">Dread d'+dreadDie+'</strong></div>'
    +'</div>'
    +'<div style="background:rgba(232,192,80,.04);border:1px solid rgba(232,192,80,.3);padding:.35rem .45rem;margin-bottom:.4rem;border-radius:3px;">'
    +'<div id="wildernessManualCheckPrompt" style="font-size:.78rem;color:var(--text2);">Roll physically, including any explosions, then enter the final totals after modifiers.</div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.4rem;">'
    +'<div><label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Lead d'+leadDie+'</label><input type="text" inputmode="text" id="wildcardActionValue" placeholder="e.g. 8+7" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.85rem;border-radius:3px;"></div>'
    +'<div><label style="font-size:.7rem;color:var(--muted2);display:block;margin-bottom:.15rem;">Dread d'+dreadDie+'</label><input type="text" inputmode="text" id="wildcardDreadValue" placeholder="e.g. 7+3+1" style="width:100%;background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:.3rem .4rem;font-size:.85rem;border-radius:3px;"></div>'
    +'</div>'
    +modifierHtml
    +'</div>'
    +'<div style="display:flex;gap:.35rem;justify-content:flex-end;flex-wrap:wrap;">'
    +'<button class="btn btn-sm" onclick="closeModal()">Cancel</button>'
    +'<button class="btn btn-sm btn-gold" onclick="finalizeWildernessManualRoll('+col+','+row+',' + "'" + directionKey + "'" + ',null)">✓ Compare Results</button>'
    +'<button class="btn btn-sm btn-primary" onclick="finalizeWildernessManualRoll('+col+','+row+',' + "'" + directionKey + "'" + ',true)">Success</button>'
    +'<button class="btn btn-sm btn-red" onclick="finalizeWildernessManualRoll('+col+','+row+',' + "'" + directionKey + "'" + ',false)">Failure</button>'
    +'</div>';
  
  openModal('Observation — Manual Roll',html);
}

function finalizeWildernessManualRoll(col,row,directionKey,forcedSuccess){
  const actionInput=document.getElementById('wildcardActionValue');
  const dreadInput=document.getElementById('wildcardDreadValue');
  if(!actionInput||!dreadInput){
    if(typeof showNotif==='function')showNotif('Inputs not found','warn');
    return;
  }
  const actionValue=(window.BTLRules&&typeof window.BTLRules.readManualTotal==='function')?window.BTLRules.readManualTotal(actionInput,1):parseInt(actionInput.value,10);
  const dreadValue=(window.BTLRules&&typeof window.BTLRules.readManualTotal==='function')?window.BTLRules.readManualTotal(dreadInput,1):parseInt(dreadInput.value,10);
  if(!Number.isFinite(actionValue)||!Number.isFinite(dreadValue)){
    if(typeof showNotif==='function')showNotif('Invalid dice entry. Enter a total or expression like 8+7.','warn');
    return;
  }
  const leadDie=window.selectedDice.action||4;
  const dreadDie=window.selectedDice.dread||6;
  if(actionValue<1||dreadValue<1){
    if(typeof showNotif==='function')showNotif('Dice values out of range','warn');
    return;
  }

  closeModal();
  
  // Process the result
  const target=getAdjacentHexByDirection(col,row,directionKey);
  const success=(typeof forcedSuccess==='boolean')?!!forcedSuccess:(actionValue>=dreadValue);
  
  let html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.4rem;">'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Lead Die</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--teal);">'+actionValue+'</div></div>'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Dread Die</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--red);">'+dreadValue+'</div></div>'
    +'</div>';
  
  if(success){
    if(typeof window.registerSecretPadClue==='function')window.registerSecretPadClue('province','intel');
    if(typeof awardPathToken==='function')awardPathToken('observation-success');
    else if(typeof addSuccessRoll==='function')addSuccessRoll();
    if(!target){
      html+=`<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">No Adjacent Hex</div>There is no mapped hex in that direction.</div>`;
    }else{
      if(typeof window.revealMapFogHex==='function')window.revealMapFogHex('province',String(target.hex.col)+','+String(target.hex.row));
      // Assign a wonder to the target hex if it doesn't have one yet
      if(target.hex.type==='wilderness'&&!target.hex.data.wonder&&target.hex.terrain&&typeof pick==='function'){
        const terrainData=TERRAIN_DESC[target.hex.terrain.name];
        if(terrainData&&terrainData.wonder&&Array.isArray(terrainData.wonder)){
          if(!target.hex.data)target.hex.data={};
          target.hex.data.wonder=pick(terrainData.wonder);
        }
      }
      html+=`<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Successful Observation (${target.label})</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);">${formatObservedHexSummary(target.hex)}</div></div>`;
    }
  }else{
    if(typeof addTMWOnFail==='function')addTMWOnFail('observation-failure',{
      failedBy:Math.max(1,Number(dreadValue||0)-Number(actionValue||0)),
      actionDie:Math.max(4,Number(leadDie)||4),
      dreadDie:Math.max(4,Number(dreadDie)||6),
      actionLabel:'Lead Die',
      onConvert:function(){
        if(typeof window.registerSecretPadClue==='function')window.registerSecretPadClue('province','intel');
        if(target&&typeof window.revealMapFogHex==='function')window.revealMapFogHex('province',String(target.hex.col)+','+String(target.hex.row));
        if(target&&target.hex&&target.hex.type==='wilderness'&&!target.hex.data.wonder&&target.hex.terrain&&typeof pick==='function'){
          const terrainData=TERRAIN_DESC[target.hex.terrain.name];
          if(terrainData&&terrainData.wonder&&Array.isArray(terrainData.wonder)){
            if(!target.hex.data)target.hex.data={};
            target.hex.data.wonder=pick(terrainData.wonder);
          }
        }
        if(typeof renderHexMap==='function')renderHexMap();
        appendHexNote(col,row,`[Observation] Teamwork converted ${directionKey||'adjacent'} to success.`);
        if(target&&typeof openModal==='function'){
          setTimeout(function(){
            openModal('Observation — Teamwork Success',`<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--green2);font-weight:700;margin-bottom:.25rem;">✓ Observation converted (${target.label})</div><div style="padding:.22rem .42rem;border-left:2px solid rgba(201,162,39,.4);">${formatObservedHexSummary(target.hex)}</div><div style="font-size:.72rem;color:var(--muted2);margin-top:.3rem;">No Successful Roll gained.</div></div>`);
          },80);
        }
        return !!target;
      }
    });
    html+=`<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;"><div style="font-size:.72rem;color:var(--red2);font-weight:700;margin-bottom:.2rem;">✗ Observation Failed</div>The horizon is obscured. No details visible.</div>`;
  }
  if(typeof renderHexMap==='function')renderHexMap();
  
  openModal('Observation — Adjacent Hexes',html);
  appendHexNote(col,row,`[Observation] Lead d${leadDie} vs DD${dreadDie} (${directionKey||'adjacent'}): ${actionValue} vs ${dreadValue} => ${success?'success':'failure'}${typeof forcedSuccess==='boolean'?' [manual override]':''}`);
}

function formatObservedHexSummary(hex){
  if(hex.type==='wilderness'){
    const wonder=(hex.data&&hex.data.wonder)?hex.data.wonder:'';
    const terrain=hex.terrain&&hex.terrain.name?hex.terrain.name:'Unknown';
    return wonder
      ? `<strong>${terrain}</strong><div style="margin-top:.25rem;font-style:italic;color:var(--gold);">${wonder}</div>`
      : `<strong>${terrain}</strong> — no obvious wonder visible.`;
  }

  if(hex.type==='gate'){
    const d=hex.data||{};
    const terrain=hex.terrain&&hex.terrain.name?hex.terrain.name:'Unknown';
    const gateName=hex.name||'Gate';
    const detail=d.fn||d.leads||d.where||'Unknown destination';
    return `<strong>Gate</strong> — ${gateName}: ${detail} into ${terrain} terrain.`;
  }

  if(hex.type==='temple'){
    const d=hex.data||{};
    return `<strong>Temple</strong> — ${hex.name||'Sanctuary'}. ${d.mood||'Ancient'}.`;
  }

  if(hex.type==='holding'||hex.type==='seat'||hex.type==='dwelling'){
    const d=hex.data||{};
    const kind=hex.type.charAt(0).toUpperCase()+hex.type.slice(1);
    const general=(d.style&&d.feature)?`${d.style} ${d.feature}`:(d.news||d.mood?.mood||hex.name||'Settlement activity');
    return `<strong>${kind}</strong> — ${general}.`;
  }

  if(hex.type==='event')return `<strong>Event</strong> — ${hex.name||'Omen Site'}.`;
  if(hex.type==='trade')return '<strong>Trade Route</strong> — caravan traffic and roadside posts.';
  if(hex.type==='ruins'||hex.type==='lostcity'||hex.type==='gate'||hex.type==='barrier'||hex.type==='peril'||hex.type==='monument'){
    const kind=hex.type.charAt(0).toUpperCase()+hex.type.slice(1);
    return `<strong>${kind}</strong> — ${hex.name||'Ancient construction'}.`;
  }

  return '<strong>Unknown</strong> — distant forms on the horizon.';
}

function getHexesInDirection(col,row,direction,range){
  const hexes=[];
  for(let i=1;i<=range;i++){
    let nc=col,nr=row;
    switch(direction){
      case 'north': nr-=i; break;
      case 'south': nr+=i; break;
      case 'east': nc+=i; break;
      case 'west': nc-=i; break;
      case 'northeast': nc+=i; nr-=i; break;
      case 'northwest': nc-=i; nr-=i; break;
      case 'southeast': nc+=i; nr+=i; break;
      case 'southwest': nc-=i; nr+=i; break;
    }
    const h=mapData.find(x=>x.col===nc&&x.row===nr);
    if(h)hexes.push(h);
  }
  return hexes;
}

function haggleMerchantCaravan(col,row){
  const spiritDie=typeof getEffectiveDie==='function'?getEffectiveDie('spirit'):((S&&S.stats&&S.stats.spirit)||4);
  const spiritRoll=explodingRoll(spiritDie);
  const dreadRoll=explodingRoll(8);
  const success=spiritRoll.total>=dreadRoll.total;
  
  let html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.4rem;">'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Your Spirit</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--teal);">'+spiritRoll.total+'</div></div>'
    +'<div style="text-align:center;"><div style="font-family:\'Cinzel\',serif;font-size:.52rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted2);">Merchant Resolve</div>'
    +'<div style="font-family:\'Rajdhani\',sans-serif;font-size:2rem;font-weight:700;color:var(--red);">'+dreadRoll.total+'</div></div>'
    +'</div>';
  
  if(success){
    S.data=S.data||{};
    S.data.haggleDiscount=true;
    html+=`<div style="background:rgba(46,196,182,.06);border:1px solid rgba(46,196,182,.35);padding:.4rem;color:var(--text);"><strong style="color:var(--green2);">✓ Haggle Success</strong> — Items cost 20% less!</div>`;
    showNotif('Haggle success! Merchant gives better prices.','good');
    if(typeof addSuccessRoll==='function')addSuccessRoll();
  }else{
    html+=`<div style="background:rgba(200,50,50,.06);border:1px solid rgba(200,50,50,.35);padding:.4rem;color:var(--text);"><strong style="color:var(--red2);">✗ Haggle Failed</strong> — No discount.</div>`;
    showNotif('Haggle failed. No discount.','warn');
    if(typeof addTMWOnFail==='function')addTMWOnFail();
  }
  
  openModal('Haggle Check (Spirit vs DD8)',html);
}

function generateTaskForHex(col,row){
  const hex=mapData.find(h=>h.col===col&&h.row===row);
  if(!hex)return;
  
  const verbs=['Hunt','Guard','Rescue','Deliver','Investigate','Eliminate','Retrieve','Escort'];
  const targets=['Bandits','Beasts','Refugees','Cargo','Matters','Threats','Artifacts','VIPs'];
  const dirs=['north','northeast','east','southeast','south','southwest','west','northwest'];
  
  const candidates=[];
  dirs.forEach(dir=>{
    const distance=roll(4)+1;
    let destCol=col,destRow=row;
    for(let i=0;i<distance;i++){
      switch(dir){
        case 'north': destRow--; break;
        case 'south': destRow++; break;
        case 'east': destCol++; break;
        case 'west': destCol--; break;
        case 'northeast': destCol++; destRow--; break;
        case 'northwest': destCol--; destRow--; break;
        case 'southeast': destCol++; destRow++; break;
        case 'southwest': destCol--; destRow++; break;
      }
    }
    const destHex=mapData.find(h=>h.col===destCol&&h.row===destRow);
    if(destHex)candidates.push({dir:dir,distance:distance,destCol:destCol,destRow:destRow});
  });
  if(!candidates.length){showNotif('No valid task destination found from this holding.','warn');return;}

  const targetSpec=pick(candidates);
  const verb=pick(verbs);
  const target=pick(targets);
  const distance=targetSpec.distance;
  const dir=targetSpec.dir;
  const destCol=targetSpec.destCol;
  const destRow=targetSpec.destRow;

  let html=`<div style="font-size:.84rem;color:var(--text2);line-height:1.6;"><strong style="color:var(--gold2);">Task Offer</strong><br>${verb} ${target}, ${distance} hex${distance!==1?'es':''} to the ${dir}.<br><br>Destination: Hex [${destCol+1},${destRow+1}]<br><br><strong style="color:var(--gold);">Success = +1 Renown</strong></div>`;
  html+=`<div style="margin-top:.4rem;display:flex;justify-content:flex-end;gap:.3rem;"><button class="btn btn-sm btn-warn" onclick="closeModal();">Decline</button><button class="btn btn-sm btn-success" onclick="acceptGeneratedHoldingTask(${col},${row},'${verb}','${target}',${distance},'${dir}',${destCol},${destRow});">Accept Task</button></div>`;

  openModal('Task Assignment',html);
}

function acceptGeneratedHoldingTask(col,row,verb,target,distance,dir,destCol,destRow){
  const originHex=mapData.find(h=>h.col===col&&h.row===row);
  const destHex=mapData.find(h=>h.col===destCol&&h.row===destRow);
  if(!originHex||!destHex){showNotif('Task destination could not be resolved.','warn');return;}

  originHex.data=originHex.data||{};
  originHex.data.task={col:col,row:row,verb:verb,target:target,distance:distance,direction:dir,completed:false,createdAt:new Date().toISOString()};
  destHex.data=destHex.data||{};
  destHex.data.taskSite={verb:verb,target:target,originCol:col,originRow:row};

  showNotif(`Task accepted: ${verb} ${target} ${distance} hex${distance!==1?'es':''} ${dir}`,'good');
  appendHexNote(col,row,`[Task Accepted] ${verb} ${target} — destination [${destCol+1},${destRow+1}]`);
  closeModal();
  if(typeof renderHexMap==='function')renderHexMap();
}

function completeTaskAtHex(col,row){
  const hex=mapData.find(h=>h.col===col&&h.row===row);
  if(!hex||!hex.data||!hex.data.taskSite)return;

  const task=hex.data.taskSite;
  const originHex=mapData.find(h=>h.col===task.originCol&&h.row===task.originRow);
  const originTask=originHex&&originHex.data?originHex.data.task:null;
  const councilTaskId=task.councilTaskId;

  // Valor Die (V.D.) additive bonus logic.
  const vdDie=(typeof getEffectiveDie==='function')
    ? getEffectiveDie('valor')
    : (((S.stats&&S.stats.valor))||4);
  const v=explodingRoll(vdDie);
  const d=explodingRoll(6);
  const success=v.total>=d.total;

  if(success){
    S.renown=(S.renown||0)+1;
    if(typeof updateRenown==='function')updateRenown();
    if(typeof addSuccessRoll==='function')addSuccessRoll();
    showNotif(`Task Complete: ${task.verb} ${task.target} — +1 Renown!`,'good');
    appendHexNote(col,row,`[Task Complete] ${task.verb} ${task.target}: VD${vdDie} ${v.total} vs DD6 ${d.total} — success, Renown +1`);
    if(originTask){
      originTask.completed=true;
      originTask.status='concluded';
      originTask.result='success';
      originTask.completedAt=new Date().toISOString();
    }
    if(originHex&&originHex.data&&originHex.data.task){
      delete originHex.data.task;
    }
    if(councilTaskId&&typeof onHoldingCouncilTaskResolved==='function')onHoldingCouncilTaskResolved(councilTaskId,true);
    delete hex.data.taskSite;
  }else{
    if(typeof addTMWOnFail==='function')addTMWOnFail();
    showNotif(`Task Failed: ${task.verb} ${task.target} (${v.total} vs ${d.total})`,'warn');
    appendHexNote(col,row,`[Task Failed] ${task.verb} ${task.target}: VD${vdDie} ${v.total} vs DD6 ${d.total}`);
    if(originTask){
      originTask.completed=true;
      originTask.status='concluded';
      originTask.result='failed';
      originTask.completedAt=new Date().toISOString();
    }
    if(originHex&&originHex.data&&originHex.data.task){
      delete originHex.data.task;
    }
    if(councilTaskId&&typeof onHoldingCouncilTaskResolved==='function')onHoldingCouncilTaskResolved(councilTaskId,false);
    delete hex.data.taskSite;
  }

  renderHexMap();
}

function handleRoyalCaravanEncounter(col,row){
  const verbs=['Hunt','Guard','Rescue','Deliver','Investigate','Eliminate','Retrieve','Escort'];
  const targets=['Bandits','Beasts','Refugees','Cargo','Matters','Threats','Artifacts','VIPs'];
  const dirs=['north','northeast','east','southeast','south','southwest','west','northwest'];
  
  const verb=pick(verbs);
  const target=pick(targets);
  const distance=roll(4)+1;
  const dir=pick(dirs);
  
  let html=`<div style="font-size:.84rem;color:var(--text2);line-height:1.6;"><strong style="color:var(--gold2);">Royal Caravan Encounter</strong><br><br>The Royal Caravan demands payment: <strong>50₵</strong> tax to pass safely.<br><br>Or complete a task for them:<br><strong style="color:var(--gold);">${verb} ${target}, ${distance} hex${distance!==1?'es':''} to the ${dir}.</strong><br><br>Task completion: +1 Renown</div>`;
  html+=`<div style="margin-top:.4rem;display:flex;justify-content:flex-end;gap:.3rem;"><button class="btn btn-sm btn-warn" onclick="payRoyalCaravanTax(${col},${row},50);">Pay 50₵ Tax</button><button class="btn btn-sm btn-success" onclick="acceptRoyalCaravanTask(${col},${row},'${verb}','${target}',${distance},'${dir}');">Accept Task</button></div>`;
  
  openModal('Royal Caravan',html);
}

function payRoyalCaravanTax(col,row,amount){
  if(S.credits<amount){showNotif(`Not enough credits (need ${amount}₵)`,'warn');return;}
  S.credits-=amount;
  showNotif(`Paid ${amount}₵ tax to Royal Caravan`,'info');
  if(typeof updateCreditsUI==='function')updateCreditsUI();
  appendHexNote(col,row,`[Royal Caravan] Paid ${amount}₵ tax`);
  closeModal();
}

function acceptRoyalCaravanTask(col,row,verb,target,distance,dir){
  let destCol=col,destRow=row;
  for(let i=0;i<distance;i++){
    switch(dir){
      case 'north': destRow--; break;
      case 'south': destRow++; break;
      case 'east': destCol++; break;
      case 'west': destCol--; break;
      case 'northeast': destCol++; destRow--; break;
      case 'northwest': destCol--; destRow--; break;
      case 'southeast': destCol++; destRow++; break;
      case 'southwest': destCol--; destRow++; break;
    }
  }
  
  const destHex=mapData.find(h=>h.col===destCol&&h.row===destRow);
  if(destHex){
    destHex.data=destHex.data||{};
    destHex.data.royalTask={verb:verb,target:target,originCol:col,originRow:row};
  }
  
  showNotif(`Task Accepted: ${verb} ${target} ${distance} hex${distance!==1?'es':''} ${dir}`,'good');
  appendHexNote(col,row,`[Royal Caravan] Accepted task: ${verb} ${target}`);
  closeModal();
}

function completeRoyalTask(col,row){
  const hex=mapData.find(h=>h.col===col&&h.row===row);
  if(!hex||!hex.data||!hex.data.royalTask)return;

  const task=hex.data.royalTask;

  // Valor Die (V.D.) additive bonus logic.
  const vdDie=(typeof getEffectiveDie==='function')
    ? getEffectiveDie('valor')
    : (((S.stats&&S.stats.valor))||4);
  const v=explodingRoll(vdDie);
  const d=explodingRoll(8);
  const success=v.total>=d.total;

  if(success){
    S.renown=(S.renown||0)+1;
    if(typeof updateRenown==='function')updateRenown();
    if(typeof addSuccessRoll==='function')addSuccessRoll();
    showNotif(`Royal Task Complete: ${task.verb} ${task.target} — +1 Renown!`,'good');
    appendHexNote(col,row,`[Royal Task Complete] ${task.verb} ${task.target}: VD${vdDie} ${v.total} vs DD8 ${d.total} — success, Renown +1`);
    delete hex.data.royalTask;
  }else{
    if(typeof addTMWOnFail==='function')addTMWOnFail();
    showNotif(`Royal Task Failed: ${task.verb} ${task.target} (${v.total} vs ${d.total})`,'warn');
    appendHexNote(col,row,`[Royal Task Failed] ${task.verb} ${task.target}: VD${vdDie} ${v.total} vs DD8 ${d.total}`);
    delete hex.data.royalTask;
  }

  renderHexMap();
}
