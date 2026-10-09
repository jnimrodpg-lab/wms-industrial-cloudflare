/* WMS V160 — Ambiente virtual de ubicaciones. Se integra con layout.racks y branchLayouts. */
  const VSPACE_TYPES = Object.freeze({
    rack:       {name:'Rack industrial', icon:'▤', width:120,depth:55,height:230,levels:4,slots:2,color:0x6793af},
    mostrador:  {name:'Mostrador',icon:'▰',width:160,depth:65,height:105,levels:2,slots:2,color:0xb6a186},
    vitrina:    {name:'Vitrina',icon:'▥',width:125,depth:48,height:205,levels:4,slots:2,color:0x7ca7af},
    contenedor: {name:'Contenedor',icon:'▣',width:115,depth:80,height:110,levels:2,slots:2,color:0x4c91b4},
    caja:       {name:'Caja / gaveta',icon:'□',width:60,depth:45,height:55,levels:1,slots:1,color:0xbd9564}
  });
  let vspaceActive = null;
  const vspaceEsc = value => escapeHtml(String(value ?? ''));
  const vspaceClamp = (v,min,max) => Math.min(max,Math.max(min,v));
  const vspaceFloat = (v,fallback) => v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
  function vspaceSpec(rack){
    const kind = VSPACE_TYPES[rack?.virtualType] ? rack.virtualType : 'rack';
    const preset = VSPACE_TYPES[kind];
    const model = (appState.models||[]).find(m => m.id === rack?.modelId) || {};
    const physical = rack?.virtual || {};
    const scale = Math.max(.01,getScaleCmPerUnit());
    return {
      kind, title:String(rack?.virtualName || rack?.id || preset.name),
      width:vspaceClamp(vspaceFloat(physical.width, rack?.virtualType ? preset.width : vspaceFloat(model.width,rack?.w*scale||120)),30,1000),
      depth:vspaceClamp(vspaceFloat(physical.depth, rack?.virtualType ? preset.depth : vspaceFloat(model.depth,rack?.h*scale||50)),20,700),
      height:vspaceClamp(vspaceFloat(physical.height,vspaceFloat(rack?.rackHeight, vspaceFloat(model.height,preset.height))),30,600),
      levels:vspaceClamp(Math.round(vspaceFloat(physical.levels,vspaceFloat(model.levels,preset.levels))),1,12),
      slots:vspaceClamp(Math.round(vspaceFloat(physical.slots,vspaceFloat(model.slots,preset.slots))),1,12)
    };
  }
  function vspaceIsEditable(){ return String(appState.auth?.role||'') === 'admin' && !!appState.auth?.loggedIn; }
  function vspaceProductsForSlot(rack,level,slot){
    const overrides = Array.isArray(rack.virtualPlacements) ? rack.virtualPlacements : [];
    const manual = overrides.filter(p=> Number(p.level) === level && Number(p.slot) === slot);
    if(manual.length) return manual.map(p=>({ ...p,manual:true }));
    return (appState.products||[]).filter(p=>{
      const sameRack = String(p.rack||'').toUpperCase()===String(rack.id||'').toUpperCase();
      const sameStore = String(p.rackStore||'').toUpperCase()===String(rack.id||'').toUpperCase();
      return (sameRack && Number(String(p.nivel||'').replace(/[^0-9]/g,''))===level && Number(String(p.slot||'').replace(/[^0-9]/g,''))===slot) || (sameStore && Number(String(p.nivelStore||'').replace(/[^0-9]/g,''))===level && Number(String(p.slotStore||'').replace(/[^0-9]/g,''))===slot);
    }).slice(0,20).map(p=>({ sku:p.sku,name:p.nombre,quantity:1,manual:false }));
  }
  function vspaceAllAssignments(){
    const rows=[];
    (appState.layout?.racks||[]).forEach(r=>{
      const sp=vspaceSpec(r);
      for(let l=1;l<=sp.levels;l++) for(let s=1;s<=sp.slots;s++){
        vspaceProductsForSlot(r,l,s).forEach(p=>rows.push({...p,rackId:r.id,level:l,slot:s,code:`${r.id}-N${l}-S${s}`}));
      }
    });
    return rows;
  }
  function vspacePointInZone(p,zone){
    const pts=zone?.pts||[]; if(pts.length<3)return false;
    let inside=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      if(((pts[i].y>p.y)!==(pts[j].y>p.y))&&(p.x<(pts[j].x-pts[i].x)*(p.y-pts[i].y)/(pts[j].y-pts[i].y)+pts[i].x))inside=!inside;
    }
    return inside;
  }
  function vspaceCorners(r){
    const hw=(Number(r.w)||60)/2,hd=(Number(r.h)||45)/2;
    const cx=Number(r.x)+hw,cy=Number(r.y)+hd;
    return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([dx,dy])=>({x:cx+dx,y:cy+dy}));
  }
  function vspaceBounds(r){
    const ps=vspaceCorners(r);
    return {left:Math.min(...ps.map(p=>p.x)),right:Math.max(...ps.map(p=>p.x)),top:Math.min(...ps.map(p=>p.y)),bottom:Math.max(...ps.map(p=>p.y))};
  }
  function vspaceFits(candidate,ignoreId=''){
    const zone=(appState.layout?.zones||[]).find(z=>z.id===candidate.zoneId);
    if(!zone || !vspaceCorners(candidate).every(p=>vspacePointInZone(p,zone)))return {ok:false,msg:'El mueble sale de la zona. Cambia su posición o dimensiones.'};
    const b=vspaceBounds(candidate);
    const collision=(appState.layout.racks||[]).find(r=>{
      if(r.id===ignoreId || r.zoneId!==candidate.zoneId)return false;
      if(Math.abs(Number(r.baseHeight||0)-Number(candidate.baseHeight||0))>5) return false;
      const q=vspaceBounds(r);
      return b.left<q.right-2 && b.right>q.left+2 && b.top<q.bottom-2 && b.bottom>q.top+2;
    });
    return collision?{ok:false,msg:`Colisión detectada con ${collision.virtualName||collision.id}.`}:{ok:true,msg:''};
  }
  function vspaceFindPosition(template){
    const zones=appState.layout.zones||[];
    for(const zone of zones){
      const ps=zone.pts||[]; if(!ps.length)continue;
      const minX=Math.min(...ps.map(p=>p.x)),maxX=Math.max(...ps.map(p=>p.x));
      const minY=Math.min(...ps.map(p=>p.y)),maxY=Math.max(...ps.map(p=>p.y));
      for(let y=minY+14;y<maxY-template.h-7;y+=16){
        for(let x=minX+14;x<maxX-template.w-7;x+=16){
          const r={...template,x,y,zoneId:zone.id};
          if(vspaceFits(r).ok)return r;
        }
      }
    }
    return null;
  }
  function vspaceToast(msg,isError=false){
    const el=document.getElementById('vspaceNotice');
    if(el){el.textContent=String(msg);el.classList.toggle('error',isError);}
    if(isError && typeof showToast==='function')showToast(msg,'error',2700);
  }
  function vspaceCommit(label='ambiente virtual'){
    persistActiveLayout();
    if(vspaceActive){vspaceActive.modified=true;vspaceActive.render(true);}
    vspaceToast(`Cambios locales guardados · ${label}. Usa «Guardar en nube» para sincronizarlos.`);
  }
  function vspaceCreate(kind){
    if(!vspaceIsEditable()) return vspaceToast('Se requiere permiso de administrador para editar.',true);
    const p=VSPACE_TYPES[kind];if(!p)return;
    const modelId=`v160_${kind}_${Date.now().toString(36)}`;
    const model={id:modelId,name:p.name,levels:p.levels,slots:p.slots,width:p.width,depth:p.depth,height:p.height,style:kind};
    // Los modelos se agregan a la biblioteca ya utilizada por el plano 2D y el visor anterior.
    appState.models.push(model);
    const scale=getScaleCmPerUnit();
    const rack={id:`M-${kind.toUpperCase().slice(0,3)}-${Date.now().toString(36).toUpperCase()}`,
      zoneId:appState.layout.zones?.[0]?.id||'Z1',x:0,y:0,
      w:p.width/scale,h:p.depth/scale,rot:0,modelId,baseHeight:0,rackHeight:p.height,
      virtualType:kind,virtualName:`${p.name} ${(appState.layout.racks||[]).filter(r=>r.virtualType===kind).length+1}`,
      virtual:{width:p.width,depth:p.depth,height:p.height,levels:p.levels,slots:p.slots},virtualPlacements:[]};
    const available=vspaceFindPosition(rack);
    if(!available){appState.models=appState.models.filter(m=>m.id!==modelId);return vspaceToast('No hay espacio libre suficiente. Amplía la zona en Plano / Estructura.',true);}
    Object.assign(rack,available);
    appState.layout.racks.push(rack);
    vspaceActive.selectedId=rack.id;vspaceActive.selectedLevel=1;vspaceActive.selectedSlot=1;
    vspaceCommit(rack.virtualName);
    vspaceActive?.refreshInspector();
  }
  function vspaceUpdateRack(rack,patch){
    if(!rack || !vspaceIsEditable())return;
    const cloneRack={...rack,virtual:{...rack.virtual}};
    if(patch.name!==undefined)cloneRack.virtualName=String(patch.name).trim().slice(0,80)||rack.id;
    if(patch.x!==undefined)cloneRack.x=vspaceFloat(patch.x,rack.x);
    if(patch.y!==undefined)cloneRack.y=vspaceFloat(patch.y,rack.y);
    if(patch.rot!==undefined)cloneRack.rot=((Math.round(vspaceFloat(patch.rot,0)/90)*90)%360+360)%360;
    for(const key of ['width','depth','height','levels','slots'])if(patch[key]!==undefined){
      const limits=key==='levels'||key==='slots'?[1,12]:key==='height'?[30,600]:[20,1000];
      cloneRack.virtual[key]=vspaceClamp(key==='levels'||key==='slots'?Math.round(vspaceFloat(patch[key],rack.virtual?.[key]||1)):vspaceFloat(patch[key],rack.virtual?.[key]||100),...limits);
    }
    const spec=vspaceSpec(cloneRack), scale=getScaleCmPerUnit();
    const width=spec.width/scale, depth=spec.depth/scale;
    const rotated=cloneRack.rot%180!==0;
    const nextW=rotated?depth:width,nextH=rotated?width:depth;
    // Mantener centro durante redimensionamiento y giro.
    if(patch.width!==undefined||patch.depth!==undefined||patch.rot!==undefined){
      if(patch.x===undefined)cloneRack.x=Number(rack.x)+(Number(rack.w)-nextW)/2;
      if(patch.y===undefined)cloneRack.y=Number(rack.y)+(Number(rack.h)-nextH)/2;
      cloneRack.w=nextW;cloneRack.h=nextH;
    }
    cloneRack.rackHeight=spec.height;
    const fitting=vspaceFits(cloneRack,rack.id);
    if(!fitting.ok){vspaceToast(fitting.msg,true);vspaceActive?.refreshInspector();return;}
    Object.assign(rack,cloneRack);
    // Actualizar modelo compartido sin cambiar la identidad del rack.
    const model=appState.models.find(m=>m.id===rack.modelId);
    if(model && rack.virtualType)Object.assign(model,{name:rack.virtualName,width:spec.width,depth:spec.depth,height:spec.height,levels:spec.levels,slots:spec.slots});
    rack.virtualPlacements=(rack.virtualPlacements||[]).filter(p=>p.level<=spec.levels&&p.slot<=spec.slots);
    vspaceActive.selectedLevel=vspaceClamp(vspaceActive.selectedLevel,1,spec.levels);
    vspaceActive.selectedSlot=vspaceClamp(vspaceActive.selectedSlot,1,spec.slots);
    vspaceCommit('propiedades');vspaceActive?.refreshInspector();
  }
  function vspaceAssign(rack,level,slot,sku,qty=1){
    if(!rack||!vspaceIsEditable())return;
    const spec=vspaceSpec(rack);level=Math.round(Number(level));slot=Math.round(Number(slot));
    if(!(level>=1&&level<=spec.levels&&slot>=1&&slot<=spec.slots))return vspaceToast('Nivel o posición fuera del mueble.',true);
    sku=String(sku||'').trim().slice(0,120);
    const products=appState.products||[];
    const product=products.find(p=>String(p.sku||'').toLowerCase()===sku.toLowerCase()||String(p.barras||'')===sku);
    rack.virtualPlacements=(rack.virtualPlacements||[]).filter(p=>!(Number(p.level)===level&&Number(p.slot)===slot));
    if(sku)rack.virtualPlacements.push({level,slot,sku,name:String(product?.nombre||''),quantity:vspaceClamp(Math.round(Number(qty)||1),1,100000)});
    vspaceCommit(sku?`SKU ${sku} en N${level} / P${slot}`:'asignación eliminada');vspaceActive?.refreshInspector();
  }
  function renderVirtualSpace(){
    if(vspaceActive?.destroy) vspaceActive.destroy();
    ensureAppRuntimeState();
    contentTitle.textContent='Ambiente virtual 3D';
    contentSubtitle.textContent='Recorre tu local y asigna productos en el mueble, nivel y compartimento exactos.';
    setTags([{label:'Diseño 3D',active:true},{label:'Ubicaciones por nivel',active:true}]);
    const canEdit=vspaceIsEditable();
    const typelist=Object.entries(VSPACE_TYPES).map(([id,p])=>`<button type="button" class="vspace-catalog-btn" data-vspace-add="${id}" ${canEdit?'':'disabled'}><b>${p.icon}</b><span>${vspaceEsc(p.name)}</span><small>${p.levels} niveles</small></button>`).join('');
    contentWrap.innerHTML=`<div class="vspace-root" id="vspaceRoot">
      <div class="vspace-toolbar"><strong>Ambiente virtual</strong><span class="vspace-chip" id="vspaceBranch">Sucursal activa</span><span class="vspace-chip" id="vspaceStats">—</span>
      <div class="vspace-toolbar-right"><button data-vspace-cam="iso">Isométrica</button><button data-vspace-cam="top">Planta</button><button data-vspace-cam="front">Frontal</button><button data-vspace-action="toggle-wall">Muros</button><button data-vspace-action="move" ${canEdit?'':'disabled'}>Mover: OFF</button><button data-vspace-action="save" class="vspace-save" ${canEdit?'':'disabled'}>Guardar en nube</button></div></div>
      <div class="vspace-main"><aside class="vspace-left"><div class="vspace-sidebar-section"><h4>Biblioteca de muebles</h4><p>Selecciona para agregar al ambiente.</p><div class="vspace-catalog">${typelist}</div></div>
      <div class="vspace-sidebar-section"><h4>Buscar producto / SKU</h4><div class="vspace-search"><input id="vspaceFindSku" placeholder="SKU, nombre o barras…" autocomplete="off"><button data-vspace-action="find">⌕</button></div><div class="vspace-hits" id="vspaceHits"></div></div>
      <div class="vspace-sidebar-section"><h4>Muebles ubicados</h4><div id="vspaceObjects" class="vspace-object-list"></div></div></aside>
      <section class="vspace-stage"><canvas id="vspaceCanvas" aria-label="Visualizador tridimensional interactivo del almacén"></canvas>
      <div class="vspace-floating"><span>Arrastrar: orbitar</span><span>Rueda: zoom</span><span>Derecho: desplazar</span><span>Modo mover: arrastrar mueble</span></div>
      <div class="vspace-compass">3D</div><div class="vspace-loading" id="vspaceLoading">Preparando el espacio tridimensional…</div></section>
      <aside class="vspace-inspector"><h4>Inspector de ubicaciones</h4><div id="vspaceInspector" class="vspace-inspector-body">Selecciona un mueble para editar y ver sus niveles.</div></aside></div>
      <div class="vspace-bottom"><span id="vspaceNotice" aria-live="polite">Los cambios se guardan localmente; «Guardar en nube» sincroniza la sucursal.</span><span>WMS Industrial · Espacio Virtual V160</span></div>
    </div>`;
    contentStatus.textContent='Ambiente listo para editar';
    const root=document.getElementById('vspaceRoot'),canvas=root.querySelector('#vspaceCanvas');
    const state={root,canvas,selectedId:appState.selectedRackLayoutId||'',selectedLevel:1,selectedSlot:1,modified:false,wallVisible:true,move:false,mode:'iso',destroyed:false,objects:new Map()};
    vspaceActive=state;
    const getRack=()=>appState.layout.racks?.find(r=>r.id===state.selectedId)||null;
    const canWrite=()=>vspaceIsEditable();
    const zoneBounds=[];(appState.layout.zones||[]).forEach(z=>(z.pts||[]).forEach(p=>zoneBounds.push(p)));
    if(!zoneBounds.length)(appState.layout.racks||[]).forEach(r=>zoneBounds.push({x:r.x,y:r.y},{x:r.x+r.w,y:r.y+r.h}));
    const mx=zoneBounds.length?(Math.min(...zoneBounds.map(p=>Number(p.x)))+Math.max(...zoneBounds.map(p=>Number(p.x))))/2:200;
    const my=zoneBounds.length?(Math.min(...zoneBounds.map(p=>Number(p.y)))+Math.max(...zoneBounds.map(p=>Number(p.y))))/2:180;
    const coord=p=>({x:(p.x-mx)*getScaleCmPerUnit()/100,z:(p.y-my)*getScaleCmPerUnit()/100});
    const invCoord=p=>({x:p.x*100/getScaleCmPerUnit()+mx,y:p.z*100/getScaleCmPerUnit()+my});
    const formatPosition=r=>`${Math.round(Number(r.x))}, ${Math.round(Number(r.y))}`;
    const lock=canWrite()?'':'disabled';
    const branch=(appState.admin?.branches||[])[getActiveLayoutBranchIndex()];
    root.querySelector('#vspaceBranch').textContent=branch?.name||`Sucursal ${getActiveLayoutBranchIndex()+1}`;
    state.refreshObjects=()=>{
      root.querySelector('#vspaceObjects').innerHTML=(appState.layout.racks||[]).map(r=>{
        const sp=vspaceSpec(r),active=r.id===state.selectedId;
        return `<button type="button" class="vspace-object ${active?'active':''}" data-vspace-select="${vspaceEsc(r.id)}"><b>${vspaceEsc(sp.title)}</b><small>${vspaceEsc(r.id)} · ${sp.levels} niveles</small></button>`;
      }).join('')||'<p class="vspace-muted">No hay muebles. Añade uno desde la biblioteca.</p>';
      const assigned=vspaceAllAssignments();
      root.querySelector('#vspaceStats').textContent=`${(appState.layout.racks||[]).length} muebles · ${assigned.length} ubicaciones`;
    };
    state.refreshInspector=()=>{
      const rack=getRack(),host=root.querySelector('#vspaceInspector');
      state.refreshObjects();
      if(!rack){host.innerHTML='<div class="vspace-empty">Selecciona un mueble en 3D o desde la lista de la izquierda.</div>';return;}
      const sp=vspaceSpec(rack);state.selectedLevel=vspaceClamp(state.selectedLevel,1,sp.levels);state.selectedSlot=vspaceClamp(state.selectedSlot,1,sp.slots);
      const assignments=vspaceProductsForSlot(rack,state.selectedLevel,state.selectedSlot);
      const assigned=assignments[0]||null;
      const levels=Array.from({length:sp.levels},(_,i)=>`<button class="${i+1===state.selectedLevel?'active':''}" data-vspace-level="${i+1}">N${i+1}</button>`).join('');
      const slots=Array.from({length:sp.slots},(_,i)=>`<button class="${i+1===state.selectedSlot?'active':''}" data-vspace-slot="${i+1}">P${i+1}</button>`).join('');
      host.innerHTML=`<div class="vspace-inspector-id"><b>${vspaceEsc(sp.title)}</b><small>${vspaceEsc(rack.id)} · ${vspaceEsc(VSPACE_TYPES[sp.kind].name)}</small></div>
        <label class="vspace-field">Nombre<input id="vsName" value="${vspaceEsc(sp.title)}" ${lock}></label>
        <div class="vspace-grid-2"><label class="vspace-field">Ancho (cm)<input id="vsWidth" type="number" min="30" max="1000" value="${sp.width}" ${lock}></label><label class="vspace-field">Fondo (cm)<input id="vsDepth" type="number" min="20" max="700" value="${sp.depth}" ${lock}></label></div>
        <div class="vspace-grid-2"><label class="vspace-field">Alto (cm)<input id="vsHeight" type="number" min="30" max="600" value="${sp.height}" ${lock}></label><label class="vspace-field">Giro (°)<select id="vsRotation" ${lock}>${[0,90,180,270].map(d=>`<option value="${d}" ${Number(rack.rot||0)===d?'selected':''}>${d}°</option>`).join('')}</select></label></div>
        <div class="vspace-grid-2"><label class="vspace-field">Niveles<input id="vsLevels" type="number" min="1" max="12" value="${sp.levels}" ${lock}></label><label class="vspace-field">Posiciones / nivel<input id="vsSlots" type="number" min="1" max="12" value="${sp.slots}" ${lock}></label></div>
        <div class="vspace-grid-2"><label class="vspace-field">X plano<input id="vsX" type="number" value="${Math.round(rack.x)}" ${lock}></label><label class="vspace-field">Y plano<input id="vsY" type="number" value="${Math.round(rack.y)}" ${lock}></label></div>
        <button class="vspace-primary" id="vsUpdate" ${lock}>Aplicar medidas y posición</button><div class="vspace-divider"></div>
        <h4>Asignación por nivel</h4><small class="vspace-muted">Nivel: de abajo hacia arriba · P: de izquierda a derecha</small>
        <div class="vspace-numbers">${levels}</div><div class="vspace-numbers vspace-slots">${slots}</div>
        <div class="vspace-loc-code">${vspaceEsc(rack.id)}-N${state.selectedLevel}-S${state.selectedSlot}</div>
        <label class="vspace-field">SKU / código de barras<input id="vsSku" value="${vspaceEsc(assigned?.sku||'')}" list="vsProductHints" placeholder="Escribe el SKU" ${lock}></label>
        <datalist id="vsProductHints">${(appState.products||[]).slice(0,450).map(p=>`<option value="${vspaceEsc(p.sku||'')}">${vspaceEsc(p.nombre||'')}</option>`).join('')}</datalist>
        <label class="vspace-field">Cantidad de unidades<input id="vsQty" type="number" min="1" max="100000" value="${Number(assigned?.quantity)||1}" ${lock}></label>
        ${assigned?.name?`<div class="vspace-assignment-name">${vspaceEsc(assigned.name)}</div>`:''}
        ${assignments.length>1?`<div class="vspace-muted">${assignments.length} productos importados en esta posición. La asignación manual sustituye la lista mostrada aquí.</div>`:''}
        <div class="vspace-grid-2"><button class="vspace-primary" id="vsAssign" ${lock}>Asignar SKU</button><button id="vsRemoveAssignment" ${lock}>Vaciar posición</button></div>
        <div class="vspace-divider"></div><div class="vspace-grid-2"><button id="vsDuplicate" ${lock}>Duplicar mueble</button><button id="vsDelete" class="vspace-danger" ${lock}>Eliminar mueble</button></div>`;
      host.querySelectorAll('[data-vspace-level]').forEach(b=>b.onclick=()=>{state.selectedLevel=Number(b.dataset.vspaceLevel);state.refreshInspector();state.render(false);});
      host.querySelectorAll('[data-vspace-slot]').forEach(b=>b.onclick=()=>{state.selectedSlot=Number(b.dataset.vspaceSlot);state.refreshInspector();state.render(false);});
      host.querySelector('#vsUpdate')?.addEventListener('click',()=>{
        vspaceUpdateRack(rack,{name:host.querySelector('#vsName').value,width:host.querySelector('#vsWidth').value,depth:host.querySelector('#vsDepth').value,
          height:host.querySelector('#vsHeight').value,levels:host.querySelector('#vsLevels').value,slots:host.querySelector('#vsSlots').value,
          rot:host.querySelector('#vsRotation').value,x:host.querySelector('#vsX').value,y:host.querySelector('#vsY').value});
      });
      host.querySelector('#vsAssign')?.addEventListener('click',()=>vspaceAssign(rack,state.selectedLevel,state.selectedSlot,host.querySelector('#vsSku').value,host.querySelector('#vsQty').value));
      host.querySelector('#vsRemoveAssignment')?.addEventListener('click',()=>vspaceAssign(rack,state.selectedLevel,state.selectedSlot,''));
      host.querySelector('#vsDelete')?.addEventListener('click',()=>{
        if(!confirm(`¿Eliminar ${sp.title} y sus asignaciones?`))return;
        appState.layout.racks=appState.layout.racks.filter(r=>r.id!==rack.id);
        state.selectedId=appState.layout.racks[0]?.id||'';
        vspaceCommit('mueble eliminado');state.refreshInspector();
      });
      host.querySelector('#vsDuplicate')?.addEventListener('click',()=>{
        const cloneRack=JSON.parse(JSON.stringify(rack));cloneRack.id=`${rack.id}-C${Date.now().toString(36).slice(-4).toUpperCase()}`;
        cloneRack.virtualName=`${sp.title} (copia)`;cloneRack.x+=20;cloneRack.y+=20;
        const found=vspaceFindPosition(cloneRack);if(!found)return vspaceToast('No queda espacio disponible para duplicar.',true);
        Object.assign(cloneRack,found);
        const sourceModel=appState.models.find(m=>m.id===rack.modelId);
        if(sourceModel){cloneRack.modelId=`${rack.modelId}_c${Date.now().toString(36)}`;appState.models.push({...sourceModel,id:cloneRack.modelId,name:cloneRack.virtualName});}
        appState.layout.racks.push(cloneRack);state.selectedId=cloneRack.id;
        vspaceCommit('mueble duplicado');state.refreshInspector();
      });
    };
    state.select=(id,level=null,slot=null)=>{
      state.selectedId=id;appState.selectedRackLayoutId=id;appState.selectedRack=id;
      if(level!=null)state.selectedLevel=Number(level)||1;
      if(slot!=null)state.selectedSlot=Number(slot)||1;
      state.refreshInspector();state.render(false);
    };
    root.querySelectorAll('[data-vspace-add]').forEach(b=>b.onclick=()=>vspaceCreate(b.dataset.vspaceAdd));
    root.querySelector('#vspaceObjects').addEventListener('click',e=>{
      const b=e.target.closest('[data-vspace-select]');if(b)state.select(b.dataset.vspaceSelect);
    });
    const findSku=async()=>{
      const q=String(root.querySelector('#vspaceFindSku').value||'').trim().toLowerCase();
      const hits=root.querySelector('#vspaceHits');
      if(!q){hits.innerHTML='';return;}
      let assignments=vspaceAllAssignments().filter(p=>[p.sku,p.name,p.code].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,50);
      if(!assignments.length){
        const lookup=(appState.products||[]).filter(p=>[p.sku,p.nombre,p.barras].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,15);
        assignments=lookup.map(p=>({sku:p.sku,name:p.nombre,rackId:p.rack,level:Number(p.nivel)||1,slot:Number(p.slot)||1,code:p.ubicacion}));
      }
      // Búsqueda remota para la sucursal actual si la paginación sólo cargó una fracción del catálogo.
      if(!assignments.length && appState.auth?.loggedIn){
        const branchId=Number((appState.admin?.branches||[])[getActiveLayoutBranchIndex()]?.id||0);
        if(branchId){
          try{
            const response=await httpJson(`/api/branches/${branchId}/products?q=${encodeURIComponent(q)}&limit=25`);
            const found=response?.products||response?.items||response?.rows||[];
            assignments=found.map(p=>({sku:p.sku,name:p.nombre||p.name,rackId:p.rack||p.rack_id,level:Number(p.nivel||p.level)||1,slot:Number(p.slot)||1,code:p.ubicacion||p.location}));
          }catch(_err){}
        }
      }
      hits.innerHTML=assignments.length?assignments.map(p=>`<button data-vspace-found="${vspaceEsc(p.rackId||'')}" data-vspace-found-level="${Number(p.level)||1}" data-vspace-found-slot="${Number(p.slot)||1}"><b>${vspaceEsc(p.sku||'')}</b><small>${vspaceEsc(p.code||`${p.rackId||'—'} N${p.level||1}/P${p.slot||1}`)}</small></button>`).join(''):'<small class="vspace-muted">No se encontró ubicación. Revisa el SKU o asígnalo a un mueble.</small>';
    };
    root.querySelector('#vspaceFindSku').addEventListener('input',debounce(findSku,380));
    root.querySelector('[data-vspace-action="find"]').onclick=findSku;
    root.querySelector('#vspaceHits').addEventListener('click',e=>{
      const b=e.target.closest('[data-vspace-found]');if(!b)return;
      if((appState.layout.racks||[]).some(r=>r.id===b.dataset.vspaceFound)){
        state.select(b.dataset.vspaceFound,Number(b.dataset.vspaceFoundLevel),Number(b.dataset.vspaceFoundSlot));
        state.focusSelected();vspaceToast(`Ubicación encontrada: ${b.dataset.vspaceFound} · N${b.dataset.vspaceFoundLevel} / P${b.dataset.vspaceFoundSlot}`);
      }else vspaceToast('El producto tiene una ubicación, pero ese mueble aún no existe en el plano.',true);
    });
    root.querySelectorAll('[data-vspace-cam]').forEach(b=>b.onclick=()=>state.setCamera(b.dataset.vspaceCam));
    root.querySelector('[data-vspace-action="move"]').onclick=e=>{
      state.move=!state.move;e.currentTarget.textContent=`Mover: ${state.move?'ON':'OFF'}`;e.currentTarget.classList.toggle('active',state.move);
      vspaceToast(state.move?'Arrastra un mueble sobre el suelo. Se impedirán las colisiones.':'Modo órbita activado.');
    };
    root.querySelector('[data-vspace-action="toggle-wall"]').onclick=e=>{
      state.wallVisible=!state.wallVisible;e.currentTarget.classList.toggle('active',state.wallVisible);state.render(true);
    };
    root.querySelector('[data-vspace-action="save"]').onclick=async()=>{
      if(!canWrite())return;
      const btn=root.querySelector('[data-vspace-action="save"]');btn.disabled=true;btn.textContent='Guardando…';
      try{
        persistActiveLayout();
        if(appState.auth?.localMode){vspaceToast('Guardado local. Para sincronizar con Cloudflare inicia sesión en la versión desplegada.');return;}
        const ok=await saveRemoteAppState('ambiente virtual');
        vspaceToast(ok?'Ambiente y asignaciones guardados en Cloudflare D1.':'No se pudo guardar en nube. Los cambios siguen en el navegador.',!ok);
        if(ok)state.modified=false;
      }catch(err){vspaceToast(err.message||'Error guardando',true);}
      finally{btn.disabled=false;btn.textContent='Guardar en nube';}
    };
    state.refreshObjects();state.refreshInspector();
    const destroyBase=()=>{state.destroyed=true;state.resizeObs?.disconnect();if(state.raf)cancelAnimationFrame(state.raf);if(state.renderer&&state.scene)disposeThreeScene(state.scene,state.renderer);state.renderer=null;};
    state.destroy=destroyBase;
    (async()=>{
      try{
        const THREE=await loadThreeRuntime();if(state.destroyed||vspaceActive!==state)return;
        const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0x111d29);
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        const scene=new THREE.Scene();scene.background=new THREE.Color(0x101b29);
        const camera=new THREE.PerspectiveCamera(44,1,.05,250);
        scene.add(new THREE.HemisphereLight(0xd4e8ff,0x536071,2.1));
        const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(-5,12,7);scene.add(sun);
        const world=new THREE.Group();scene.add(world);state.scene=scene;state.renderer=renderer;state.camera=camera;state.THREE=THREE;state.world=world;
        const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
        const orbit={theta:.68,phi:.92,radius:12,target:new THREE.Vector3(0,.75,0)};
        const updateCam=()=>{
          orbit.phi=vspaceClamp(orbit.phi,.15,1.53);orbit.radius=vspaceClamp(orbit.radius,1.5,80);
          const sin=Math.sin(orbit.phi);camera.position.set(orbit.target.x+Math.sin(orbit.theta)*sin*orbit.radius,orbit.target.y+Math.cos(orbit.phi)*orbit.radius,orbit.target.z+Math.cos(orbit.theta)*sin*orbit.radius);
          camera.lookAt(orbit.target);
        };
        const applyPointer=e=>{const r=canvas.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(mouse,camera);};
        const meshMat=(color,extra={})=>new THREE.MeshStandardMaterial({color,metalness:.14,roughness:.6,...extra});
        const shared={metal:meshMat(0x677f94,{metalness:.67,roughness:.32}),dark:meshMat(0x334b60,{metalness:.65}),wood:meshMat(0xc7a97e),glass:meshMat(0x97d9e2,{transparent:true,opacity:.22,depthWrite:false,metalness:.08,roughness:.12}),box:meshMat(0xbba079),accent:meshMat(0x23dcb1,{emissive:0x086b59,emissiveIntensity:.48}),product:meshMat(0xf8c65d),productFocus:meshMat(0x4de4d0,{emissive:0x218a79,emissiveIntensity:.48})};
        const addBlock=(group,x,y,z,w,h,d,mat,level=0,slot=0)=>{
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.015,w),Math.max(.015,h),Math.max(.015,d)),mat);
          mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=true;
          const data=group.userData;mesh.userData={furnitureId:data.furnitureId,level,slot};group.add(mesh);return mesh;
        };
        const labelSprite=(text,width=1.1)=>{
          const c=document.createElement('canvas');c.width=512;c.height=120;
          const ctx=c.getContext('2d');ctx.clearRect(0,0,512,120);ctx.fillStyle='rgba(15,30,45,.88)';ctx.fillRect(5,4,502,112);
          ctx.fillStyle='#ebfaff';ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.fillText(String(text).slice(0,25),256,76,470);
          const tex=new THREE.CanvasTexture(c);const material=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
          const sprite=new THREE.Sprite(material);sprite.scale.set(width,width*.25,1);return sprite;
        };
        const clearWorld=()=>{
          world.children.forEach(obj=>{obj.traverse(node=>{
            if(node.geometry)node.geometry.dispose();
            const materials=Array.isArray(node.material)?node.material:[node.material];
            materials.forEach(m=>{if(m?.isSpriteMaterial){m.map?.dispose();m.dispose();}else if(m&&!Object.values(shared).includes(m))m.dispose();});
          });});world.clear();state.objects.clear();
        };
        const addFurniture=r=>{
          const spec=vspaceSpec(r),x=spec.width/100,d=spec.depth/100,h=spec.height/100;
          const group=new THREE.Group();group.userData={furnitureId:r.id};
          const c=coord({x:Number(r.x)+(Number(r.w)||0)/2,y:Number(r.y)+(Number(r.h)||0)/2});
          group.position.set(c.x,Number(r.baseHeight||0)/100,c.z);
          group.rotation.y=-(Number(r.rot||0)*Math.PI/180);
          const p=VSPACE_TYPES[spec.kind];const painted=meshMat(p.color,{metalness:spec.kind==='rack'?.45:.1});
          const t=spec.kind, selected=r.id===state.selectedId, metal=selected?shared.accent:shared.metal;
          const frame=.035, shelf=.037;
          if(t==='rack'||t==='vitrina'||t==='mostrador'){
            const levels=t==='mostrador'?Math.max(1,spec.levels):spec.levels;
            for(const xx of [-x/2+frame/2,x/2-frame/2])for(const zz of [-d/2+frame/2,d/2-frame/2]){
              addBlock(group,xx,h/2,zz,frame,h,frame,t==='mostrador'?shared.wood:metal);
            }
            for(let l=1;l<=levels;l++){
              const sy=.035+(h-.065)*l/levels;
              addBlock(group,0,sy,0,x-.015,shelf,d-.015,t==='mostrador'?shared.wood:shared.metal,l,0);
              if(t==='rack'||t==='vitrina')for(let s=1;s<spec.slots;s++){
                const xx=-x/2+x*s/spec.slots;
                addBlock(group,xx,sy-(h/levels)/2,0,.012,Math.max(.02,h/levels-shelf),d*.87,shared.dark,l,s);
              }
              for(let s=1;s<=spec.slots;s++){
                const row=vspaceProductsForSlot(r,l,s);
                if(row.length){
                  const xx=-x/2+x*(s-.5)/spec.slots;
                  const bh=Math.min(.17,(h/levels)*.5);
                  const focus=selected&&state.selectedLevel===l&&state.selectedSlot===s;
                  addBlock(group,xx,sy+bh/2+.03,0,Math.min(.24,x/spec.slots*.63),bh,Math.min(.25,d*.54),focus?shared.productFocus:shared.product,l,s);
                }
              }
            }
            if(t==='vitrina'){
              addBlock(group,-x/2+frame/2,h/2,0,frame,h,d,shared.dark);
              addBlock(group,x/2-frame/2,h/2,0,frame,h,d,shared.dark);
              addBlock(group,0,h/2,d/2-.015,x-.07,h-.1,.025,shared.glass);
              addBlock(group,0,h/2,-d/2+.015,x-.07,h-.1,.025,shared.glass);
            }
            if(t==='mostrador'){
              addBlock(group,0,h/2,-d/2+.018,x-.04,h-.05,.035,painted);
              addBlock(group,0,h+.012,0,x+.08,.042,d+.10,shared.wood);
            }
          }else if(t==='contenedor'){
            addBlock(group,0,.055,0,x,.11,d,shared.dark);
            for(const side of [-1,1]){
              addBlock(group,side*(x-.04)/2,h/2,0,.05,h,d,painted);
              addBlock(group,0,h/2,side*(d-.04)/2,x,h,.05,painted);
            }
            for(let l=1;l<=spec.levels;l++){
              const sy=l*h/spec.levels;
              addBlock(group,0,sy,0,x-.09,.03,d-.09,shared.metal,l,0);
              for(let s=1;s<=spec.slots;s++){
                if(vspaceProductsForSlot(r,l,s).length){
                  const xx=-x/2+x*(s-.5)/spec.slots;
                  addBlock(group,xx,sy-.045,0,Math.min(.22,x/spec.slots*.55),.07,d*.43,selected&&state.selectedLevel===l&&state.selectedSlot===s?shared.productFocus:shared.product,l,s);
                }
              }
            }
          }else{
            addBlock(group,0,h/2,0,x,h,d,painted,1,1);
            for(let side of [-1,1])addBlock(group,0,h*.82,side*d*.46,x*.8,.025,.025,shared.dark,1,1);
            if(vspaceProductsForSlot(r,1,1).length){
              addBlock(group,0,h+.008,0,x*.32,.018,d*.32,selected?shared.productFocus:shared.product,1,1);
            }
          }
          const sprite=labelSprite(spec.title,Math.min(2.2,Math.max(.8,x*1.05)));sprite.position.set(0,h+.24,0);group.add(sprite);
          const ringMat=meshMat(selected?0x36eac1:0x5686a3,{transparent:true,opacity:selected?.55:.13});
          addBlock(group,0,.015,0,x+.13,.022,d+.13,ringMat);
          world.add(group);state.objects.set(r.id,group);
        };
        const rebuild=()=>{
          clearWorld();
          const zones=appState.layout.zones||[];
          for(const zone of zones){
            const pts=zone.pts||[];if(pts.length<3)continue;
            const shape=new THREE.Shape();
            pts.forEach((pt,i)=>{const p=coord(pt);if(i===0)shape.moveTo(p.x,-p.z);else shape.lineTo(p.x,-p.z);});shape.closePath();
            const plane=new THREE.Mesh(new THREE.ShapeGeometry(shape),meshMat(zone.color||0x31475b,{side:THREE.DoubleSide,roughness:.9,metalness:0}));
            plane.rotation.x=-Math.PI/2;plane.position.y=-.018;world.add(plane);
            if(state.wallVisible)for(let i=0;i<pts.length;i++){
              const a=coord(pts[i]),b=coord(pts[(i+1)%pts.length]);const dx=b.x-a.x,dz=b.z-a.z;
              const len=Math.hypot(dx,dz);if(len<.04)continue;
              const wall=new THREE.Mesh(new THREE.BoxGeometry(len,2.75,.07),meshMat(0x9eb0bd,{transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));
              wall.position.set((a.x+b.x)/2,1.375,(a.z+b.z)/2);wall.rotation.y=-Math.atan2(dz,dx);world.add(wall);
              const edge=new THREE.Mesh(new THREE.BoxGeometry(len,.032,.06),meshMat(0x8cb6c4));
              edge.position.set(wall.position.x,.025,wall.position.z);edge.rotation.y=wall.rotation.y;world.add(edge);
            }
          }
          const boundsW=(zoneBounds.length?Math.max(...zoneBounds.map(p=>p.x))-Math.min(...zoneBounds.map(p=>p.x)):700)*getScaleCmPerUnit()/100;
          const boundsH=(zoneBounds.length?Math.max(...zoneBounds.map(p=>p.y))-Math.min(...zoneBounds.map(p=>p.y)):600)*getScaleCmPerUnit()/100;
          const grid=new THREE.GridHelper(Math.max(12,Math.ceil(Math.max(boundsW,boundsH)+3)),Math.max(12,Math.ceil(Math.max(boundsW,boundsH)+3)*2),0x47687c,0x294053);
          grid.position.y=-.027;world.add(grid);
          (appState.layout.racks||[]).forEach(addFurniture);
          if(state.wallVisible && (appState.layout.zones||[]).length===0){vspaceToast('Dibuja primero el perímetro desde Plano / Estructura.');}
          state.requestRender();
        };
        state.requestRender=()=>{
          if(state.destroyed||state.raf)return;
          state.raf=requestAnimationFrame(()=>{state.raf=0;if(state.destroyed)return;updateCam();renderer.render(scene,camera);});
        };
        state.render=(rebuildWorld=false)=>{if(rebuildWorld)rebuild();else{rebuild();}};
        state.setCamera=mode=>{
          const points=zoneBounds.length?zoneBounds:[{x:mx-300,y:my-200},{x:mx+300,y:my+200}];
          const width=(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*getScaleCmPerUnit()/100;
          const depth=(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))*getScaleCmPerUnit()/100;
          orbit.radius=vspaceClamp(Math.max(width,depth)*1.7+3,4,65);
          orbit.theta=mode==='front'?0:mode==='top'?.0001:.72;
          orbit.phi=mode==='top'?.04:mode==='front'?1.27:.86;
          orbit.target.set(0,.8,0);state.mode=mode;state.requestRender();
        };
        state.focusSelected=()=>{
          const r=getRack();if(!r)return;
          const c=coord({x:Number(r.x)+Number(r.w)/2,y:Number(r.y)+Number(r.h)/2});
          orbit.target.set(c.x,vspaceSpec(r).height/200,c.z);
          orbit.radius=vspaceClamp(vspaceSpec(r).width/70+3,3,12);orbit.phi=.94;state.requestRender();
        };
        const intersectFurniture=e=>{
          applyPointer(e);
          const intersections=raycaster.intersectObjects([...state.objects.values()],true);
          for(const hit of intersections){
            let obj=hit.object;
            while(obj && !obj.userData?.furnitureId) obj=obj.parent;
            if(obj?.userData?.furnitureId) return {rackId:obj.userData.furnitureId,level:hit.object.userData?.level||0,slot:hit.object.userData?.slot||0};
          }
          return null;
        };
        const groundPoint=e=>{
          applyPointer(e);const target=new THREE.Vector3();return raycaster.ray.intersectPlane(ground,target)?invCoord(target):null;
        };
        let gesture=null;
        canvas.addEventListener('contextmenu',e=>e.preventDefault());
        canvas.addEventListener('pointerdown',e=>{
          if(e.button!==0&&e.button!==2)return;
          const hit=intersectFurniture(e),point=state.move&&canWrite()?groundPoint(e):null;
          if(hit){state.select(hit.rackId,hit.level||state.selectedLevel,hit.slot||state.selectedSlot);}
          const rack=hit && appState.layout.racks.find(r=>r.id===hit.rackId);
          gesture={x:e.clientX,y:e.clientY,button:e.button,mode:(e.button===0&&state.move&&canWrite()&&rack)?'move':e.button===2?'pan':'orbit',rackId:rack?.id||'',
            initialX:Number(rack?.x||0),initialY:Number(rack?.y||0),groundStart:point,moved:false};
          try{canvas.setPointerCapture(e.pointerId);}catch(_){}
        });
        canvas.addEventListener('pointermove',e=>{
          if(!gesture)return;
          const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
          if(Math.abs(dx)+Math.abs(dy)>.3)gesture.moved=true;
          if(gesture.mode==='orbit'){
            orbit.theta-=dx*.008;orbit.phi=vspaceClamp(orbit.phi-dy*.006,.12,1.54);
          }else if(gesture.mode==='pan'){
            const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
            const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
            const sensitivity=orbit.radius*.0018;orbit.target.addScaledVector(right,dx*sensitivity).addScaledVector(forward,dy*sensitivity);
          }else if(gesture.mode==='move'){
            const rack=appState.layout.racks.find(r=>r.id===gesture.rackId),current=groundPoint(e);
            if(rack&&current&&gesture.groundStart){
              const candidate={...rack,x:Math.round(gesture.initialX+current.x-gesture.groundStart.x),y:Math.round(gesture.initialY+current.y-gesture.groundStart.y)};
              if(vspaceFits(candidate,rack.id).ok){rack.x=candidate.x;rack.y=candidate.y;const group=state.objects.get(rack.id);if(group){const cp=coord({x:rack.x+rack.w/2,y:rack.y+rack.h/2});group.position.x=cp.x;group.position.z=cp.z;}}
            }
          }
          gesture.x=e.clientX;gesture.y=e.clientY;state.requestRender();
        });
        canvas.addEventListener('pointerup',()=>{
          if(gesture?.mode==='move'&&gesture.moved){vspaceCommit('mueble desplazado');state.refreshInspector();}
          gesture=null;
        });
        canvas.addEventListener('pointercancel',()=>{gesture=null;});
        canvas.addEventListener('wheel',e=>{e.preventDefault();orbit.radius*=e.deltaY>0?1.1:.9;state.requestRender();},{passive:false});
        const resize=()=>{
          if(state.destroyed)return;const bounds=canvas.getBoundingClientRect();
          const w=Math.max(160,Math.floor(bounds.width)),h=Math.max(120,Math.floor(bounds.height));
          renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();state.requestRender();
        };
        state.resizeObs=new ResizeObserver(resize);state.resizeObs.observe(canvas);
        rebuild();state.setCamera('iso');
        if(state.selectedId && (appState.layout.racks||[]).some(r=>r.id===state.selectedId)) state.focusSelected();
        resize();root.querySelector('#vspaceLoading')?.remove();
        vspaceToast('Modelo virtual sincronizado con el plano. Selecciona un mueble para asignarle productos.');
      }catch(err){console.error('Vista virtual 3D:',err);const el=root.querySelector('#vspaceLoading');if(el)el.textContent=`No se pudo inicializar la vista 3D: ${err.message||err}. Verifica WebGL y la dependencia Three.js.`;}
    })();
  }
