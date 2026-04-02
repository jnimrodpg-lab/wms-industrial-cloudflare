
(() => {
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
  const appRoot = $('#appRoot');
  const toggleSidebar = $('#toggleSidebar');
  const menuItems = $$('.menu-item');
  const searchInput = $('#searchInput');
  const btnSearch = $('#btnSearch');
  const btnScanCode = $('#btnScanCode');
  const scannerModal = $('#scannerModal');
  const btnCloseScanner = $('#btnCloseScanner');
  const btnStopScanner = $('#btnStopScanner');
  const scannerHint = $('#scannerHint');
  const productList = $('#productList');
  const countProducts = $('#countProducts');
  const searchBranchHost = $('#searchBranchHost');
  const productSummary = $('#productSummary');
  const activeProductName = $('#activeProductName');
  const activeProductSku = $('#activeProductSku');
  const activeProductMeta = $('#activeProductMeta');
  const activeLocation = $('#activeLocation');
  const activeStoreLocation = $('#activeStoreLocation');
  const activeProductImageWrap = $('#activeProductImageWrap');
  const activeProductImage = $('#activeProductImage');
  const activeSizeStrip = $('#activeSizeStrip');
  const activeColorStrip = $('#activeColorStrip');
  let activeImageCycleTimer = null;
  let activeImageCycleUrls = [];
  const sheetStatusChip = $('#sheetStatusChip');
  const contentTitle = $('#contentTitle');
  const contentSubtitle = $('#contentSubtitle');
  const contentTags = $('#contentTags');
  const contentWrap = $('#contentWrap');
  const contentPanel = $('.content-panel');
  const detailPanel = $('.detail-panel');
  const contentStatus = $('#contentStatus');
  const contentFootRight = $('#contentFootRight');
  const detailTitle = $('#detailTitle');
  const detailSubtitle = $('#detailSubtitle');
  const detailWrap = $('#detailWrap');
  const detailStatus = $('#detailStatus');
  const detailChip = $('#detailChip');

  const appState = {
    screen: 'admin',
    products: [],
    filtered: [],
    selectedProduct: null,
    selectedRack: '',
    selectedZoneId: 'Z1',
    selectedVertex: { zoneId:'', idx:-1 },
    selectedEdge: { zoneId:'', a:-1, b:-1 },
    selectedRackLayoutId: '',
    selectedRackLayoutIds: [],
    highlightedRackIds: [],
    primaryHighlightedRackId: '',
    selectedModelId: 'std_4',
    sheetConfig: { url:'', sheetName:'Productos', lastMode:'demo' },
    layout: {
      zones: [],
      racks: []
    },
    branchLayouts: loadBranchLayouts(),
    activeLayoutBranchIndex: 0,
    editor: {
      mode: 'select',
      dragging: null,
      offset: {x:0,y:0},
      viewBox: { x:0, y:0, w:900, h:620 },
      sectionVisible: true,
      sectionCuts: {
        x: { pos:.5, dir:1 },
        y: { pos:.5, dir:1 }
      },
      view: 'ortho',
      zonesLocked: false,
      showDims: true,
      stackMenu: { open:false, rackId:'', x:0, y:0 },
      inspectorStackOpen: false,
      dragSelect: { active:false, additive:false, start:null, end:null },
      viewBoxCustomized: false
    },
    models: [
      { id:'std_4', name:'Rack estándar 4 niveles', levels:4, slots:2, width:120, depth:40, height:240, clearance:0, style:'metallic' },
      { id:'wide_5', name:'Rack ancho 5 niveles', levels:5, slots:2, width:172, depth:90, height:270, clearance:0, style:'wide' },
      { id:'compact_3', name:'Rack compacto 3 niveles', levels:3, slots:2, width:132, depth:76, height:200, clearance:0, style:'melamine' }
    ],
    admin: loadAdminState(),
    ui: { sheetExpanded:false, productGroupMode:true, rackLibraryOpenIds:['std_4'] },
    sheetWizard: { step: 1, url:'', selectedSheet:'', availableSheets:[], headers:[], mapping:{ sku:'', nombre:'', variante:'', barras:'', ubicacion:'', almacen:'' }, imported:false, loading:false, error:'' }
  };

  const storedRackModels = loadRackModels();
  if (storedRackModels) appState.models = storedRackModels;

  let html5QrScanner = null;
  let scannerRunning = false;

  const DEFAULT_ZONE_COLOR = '#ffd84d';
  const DEFAULT_ZONE_SIZE = { w:580, h:420 };

  function loadRackModels(){
    try{
      const raw = localStorage.getItem('wms_rack_models_v3');
      if(!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr : null;
    }catch{ return null; }
  }
  function saveRackModels(){
    try{ localStorage.setItem('wms_rack_models_v3', JSON.stringify(appState.models || [])); }catch{}
  }

  function makeDemoProducts(total = 8000){
    const bases = [
      ['Widget','Rojo'],['Gadget','Mediano'],['Componente','Azul'],['Producto','XL'],['Sensor','Negro'],['Caja técnica','Gris']
    ];
    const racks = buildDefaultLayoutForBranch(0).racks.map(r => r.id);
    const out = [];
    for(let i=1;i<=total;i++){
      const [n,v] = bases[i % bases.length];
      const rack = racks[i % racks.length];
      const lvl = (i % 4) + 1;
      const slot = (i % 2) + 1;
      const storageRack = racks[(i+3) % racks.length].startsWith('ALM') ? racks[(i+3)%racks.length] : 'ALM-E1';
      out.push({
        sku: 'SKU' + String(i).padStart(5,'0'),
        nombre: n + ' ' + ((i%12)+1),
        variante: v,
        ubicacion: `${rack}-N${lvl}-S${slot}`,
        almacen: `${storageRack}-N${((i+1)%4)+1}-S${((i+1)%2)+1}`,
        rack,
        rackStore: storageRack,
        zona: rack.split('-')[0],
        nivel: lvl,
        slot
      });
    }
    return out;
  }

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function debounce(fn, ms=120){ let t; return (...args) => { clearTimeout(t); t=setTimeout(() => fn(...args), ms); }; }
  function toIso(x,y,z=0){ const a = Math.PI/6; return { x:(x-y)*Math.cos(a), y:(x+y)*Math.sin(a)-z }; }
  function svgEl(tag, attrs={}){ const el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v)); return el; }
  function face(points, attrs={}){ const d = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y} Z`; return svgEl('path', { d, ...attrs }); }
  function centroid(pts){ const s=pts.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0}); return { x:s.x/pts.length, y:s.y/pts.length }; }
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
  function parseSheetUrl(url){
    const t = String(url||'').trim();
    const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if(m) return m[1];
    if(/^[a-zA-Z0-9-_]{20,}$/.test(t)) return t;
    return '';
  }

  function normalizeLocationCode(txt){
    let raw = String(txt || '').trim().toUpperCase();
    if (!raw) return '';
    raw = raw.replace(/\s+/g, '-').replace(/--+/g, '-');
    raw = raw.replace(/([A-Z0-9]+)\s*(E\d+)/g, '$1-$2');
    raw = raw.replace(/(E\d+)\s*(N\d+)/g, '$1-$2');
    raw = raw.replace(/(N\d+)\s*([SP]\d+)/g, '$1-$2');
    raw = raw.replace(/[^A-Z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
    raw = raw.replace(/^ALM\d+(?=-E\d+$)/i, 'ALM');
    return raw;
  }
  function parseLocationCode(txt, fallbackRack='Z1-E1'){
    const raw = normalizeLocationCode(txt);
    const fallbackNorm = normalizeLocationCode(fallbackRack || 'Z1-E1') || 'Z1-E1';
    const fallbackZoneToken = (fallbackNorm.split('-')[0] || 'Z1').toUpperCase();
    const rawZoneToken = ((raw.match(/^([A-Z0-9]+)(?=-E\d+)/i) || [,''])[1] || fallbackZoneToken || 'Z1').toUpperCase();
    let zoneId = rawZoneToken;
    let zoneIndex = 0;
    if(/^ALM(?:ACEN)?$/i.test(rawZoneToken)){
      zoneId = 'ALM';
    } else {
      const zm = rawZoneToken.match(/^Z(\d+)$/i);
      if(zm){
        zoneIndex = Math.max(1, parseInt(zm[1], 10) || 1);
        zoneId = `Z${zoneIndex}`;
      } else {
        const fb = fallbackZoneToken.match(/^Z(\d+)$/i);
        if(/^ALM(?:ACEN)?$/i.test(fallbackZoneToken)){
          zoneId = 'ALM';
        } else if(fb){
          zoneIndex = Math.max(1, parseInt(fb[1], 10) || 1);
          zoneId = `Z${zoneIndex}`;
        } else {
          zoneId = 'Z1';
          zoneIndex = 1;
        }
      }
    }
    const est = Math.max(1, parseInt((raw.match(/-E(\d+)/i)||[])[1] || (fallbackNorm.match(/-E(\d+)/i)||[])[1] || '1', 10) || 1);
    const nivel = Math.max(1, parseInt((raw.match(/-N(\d+)/i)||[])[1] || '1', 10) || 1);
    const slot = Math.max(1, parseInt((raw.match(/-(?:S|P)(\d+)/i)||[])[1] || '1', 10) || 1);
    return { raw, zoneId, zoneIndex, rackId:`${zoneId}-E${est}`, level:nivel, slot, est, isStorage: zoneId === 'ALM' };
  }
  function zoneBoundsOf(zone){
    const pts = Array.isArray(zone?.pts) ? zone.pts : [];
    const xs = pts.map(p=>Number(p.x)||0), ys = pts.map(p=>Number(p.y)||0);
    return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
  }
  function isRectZone(zone){
    if(!zone || !Array.isArray(zone.pts) || zone.pts.length !== 4) return false;
    const b = zoneBoundsOf(zone);
    const expected = new Set([
      `${b.minX}|${b.minY}`,
      `${b.maxX}|${b.minY}`,
      `${b.maxX}|${b.maxY}`,
      `${b.minX}|${b.maxY}`
    ]);
    return zone.pts.every(pt => expected.has(`${Number(pt.x)||0}|${Number(pt.y)||0}`));
  }
  function setRectZoneBounds(zone, bounds){
    zone.pts = [
      { x:bounds.minX, y:bounds.minY },
      { x:bounds.maxX, y:bounds.minY },
      { x:bounds.maxX, y:bounds.maxY },
      { x:bounds.minX, y:bounds.maxY }
    ];
  }
  function guessAutoRackWidth(slots, baseWidth=150, baseSlots=2){
    const s = Math.max(1, Number(slots)||1);
    const bs = Math.max(1, Number(baseSlots)||2);
    if(s <= bs) return Math.max(baseWidth, 120);
    return Math.round(baseWidth + (s - bs) * Math.max(42, Math.round(baseWidth / (bs + 1))));
  }
  function ensureAutoRackModel(levels, slots, preferredModelId='std_4'){
    const pref = rackModel(preferredModelId) || rackModel('std_4') || appState.models[0] || { id:'std_4', name:'Rack', levels:4, slots:2, width:120, depth:40, height:240, clearance:0, style:'metallic' };
    const lv = Math.max(1, parseInt(levels || pref.levels || 4, 10) || 4);
    const sl = Math.max(1, parseInt(slots || pref.slots || 2, 10) || 2);
    const style = pref.style || 'standard';
    const id = `auto_${style}_${lv}n_${sl}s`;
    let model = appState.models.find(m => m.id === id);
    if(!model){
      model = {
        id,
        name:`Auto ${lv} niveles / ${sl} slots`,
        levels: lv,
        slots: sl,
        width: guessAutoRackWidth(sl, Number(pref.width)||120, Number(pref.slots)||2),
        depth: Math.max(40, Number(pref.depth)||40),
        height: Math.max(140, Number(pref.height)||240, 80 + lv * 40),
        clearance: Math.max(0, Number(pref.clearance)||0),
        style,
        beam: Math.max(4, Number(pref.beam)||6)
      };
      appState.models.push(model);
      saveRackModels();
    } else {
      model.levels = Math.max(model.levels||0, lv);
      model.slots = Math.max(model.slots||0, sl);
      model.width = Math.max(Number(model.width)||0, guessAutoRackWidth(sl, Number(pref.width)||150, Number(pref.slots)||2));
      model.height = Math.max(Number(model.height)||0, Math.max(140, Number(pref.height)||240, 80 + lv * 40));
    }
    return model.id;
  }
  function createAutoZone(zoneId, branchIndex=0){
    const layout = appState.layout || { zones:[] };
    const zones = Array.isArray(layout.zones) ? layout.zones : [];
    const gap = 120;
    const cols = 3;
    const existing = zones.length;
    const col = existing % cols;
    const row = Math.floor(existing / cols);
    const baseX = 80;
    const baseY = 80;
    const startX = baseX + col * (DEFAULT_ZONE_SIZE.w + gap);
    const startY = baseY + row * (DEFAULT_ZONE_SIZE.h + gap);
    const zoneName = String(zoneId).toUpperCase() === 'ALM' ? 'Almacén' : `Zona ${String(zoneId).toUpperCase().replace(/^Z/, '')}`;
    return makeRectZone(zoneId, zoneName, getBranchColor(branchIndex), startX, startY, DEFAULT_ZONE_SIZE.w, DEFAULT_ZONE_SIZE.h);
  }
  function ensureRackFitsZoneRect(zone, rack, margin=28){
    if(!isRectZone(zone) || !rack) return;
    const b = zoneBoundsOf(zone);
    let minX = b.minX, minY = b.minY, maxX = b.maxX, maxY = b.maxY;
    if(rack.x < minX + margin) minX = rack.x - margin;
    if(rack.y < minY + margin) minY = rack.y - margin;
    if(rack.x + rack.w > maxX - margin) maxX = rack.x + rack.w + margin;
    if(rack.y + rack.h > maxY - margin) maxY = rack.y + rack.h + margin;
    setRectZoneBounds(zone, { minX, minY, maxX, maxY });
  }
  function placeRackInZone(layout, zone, rack){
    const margin = 28, gap = 18;
    const b = zoneBoundsOf(zone);
    const sameZone = (layout.racks || []).filter(r => r.zoneId === zone.id && r.id !== rack.id).sort((a,b)=>(a.y-b.y)||(a.x-b.x));
    let x = b.minX + margin;
    let y = b.minY + margin;
    if(sameZone.length){
      const last = sameZone[sameZone.length - 1];
      x = last.x + last.w + gap;
      y = last.y;
      if(x + rack.w > b.maxX - margin){
        x = b.minX + margin;
        y = Math.max(...sameZone.map(r => r.y + r.h), b.minY + margin) + gap;
      }
    }
    rack.x = x;
    rack.y = y;
    ensureRackFitsZoneRect(zone, rack, margin);
  }
  function syncBranchLayoutWithProducts(branchIndex, products=[]){
    ensureBranchLayouts();
    const idx = Number.isFinite(Number(branchIndex)) ? Number(branchIndex) : getActiveLayoutBranchIndex();
    const layout = clone(appState.branchLayouts[idx] || buildDefaultLayoutForBranch(idx));
    if(!Array.isArray(layout.zones)) layout.zones = [];
    if(!Array.isArray(layout.racks)) layout.racks = [];
    if(!layout.meta || typeof layout.meta !== 'object') layout.meta = { createdAt: Date.now(), scaleCmPerUnit: 1 };

    const legacyStorageZones = new Set(['ALM1','ALMACEN','ALMACÉN']);
    (layout.zones || []).forEach(z => {
      const zid = String(z?.id || '').toUpperCase();
      if(legacyStorageZones.has(zid) || /^ALM\d+$/.test(zid)){
        z.id = 'ALM';
        z.name = 'Almacén';
      }
    });
    (layout.racks || []).forEach(r => {
      const zid = String(r?.zoneId || '').toUpperCase();
      if(legacyStorageZones.has(zid) || /^ALM\d+$/.test(zid)){
        r.zoneId = 'ALM';
        r.id = String(r.id || '').replace(/^ALM\d+/i, 'ALM');
      }
    });

    const zoneReqs = new Map();
    let maxZoneIndex = 0;
    let hasALM = false;
    const touchZoneReq = zoneId => {
      if(!zoneReqs.has(zoneId)) zoneReqs.set(zoneId, { zoneId, maxRack:0, maxLevel:0, maxSlot:0, hits:0 });
      return zoneReqs.get(zoneId);
    };
    const pushReq = (loc, fallbackRack) => {
      const parsed = parseLocationCode(loc, fallbackRack);
      if(!parsed.zoneId) return;
      if(parsed.zoneId === 'ALM') hasALM = true;
      else if(/^Z\d+$/i.test(parsed.zoneId)) maxZoneIndex = Math.max(maxZoneIndex, parsed.zoneIndex || 0);
      const req = touchZoneReq(parsed.zoneId);
      req.maxRack = Math.max(req.maxRack, parsed.est || 1);
      req.maxLevel = Math.max(req.maxLevel, parsed.level || 1);
      req.maxSlot = Math.max(req.maxSlot, parsed.slot || 1);
      req.hits += 1;
    };
    (products || []).forEach(p => {
      if(p?.ubicacion) pushReq(p.ubicacion, p.rack || 'Z1-E1');
      if(p?.almacen) pushReq(p.almacen, p.rackStore || 'ALM-E1');
    });

    const desiredZoneIds = [];
    for(let i=1;i<=Math.max(0, maxZoneIndex);i++) desiredZoneIds.push(`Z${i}`);
    if(hasALM || zoneReqs.has('ALM')) desiredZoneIds.push('ALM');
    const desiredZoneSet = new Set(desiredZoneIds);

    layout.zones = layout.zones.filter(z => {
      const zid = String(z?.id || '').toUpperCase();
      if(/^Z\d+$/.test(zid) || zid === 'ALM') return desiredZoneSet.has(zid);
      return true;
    });
    layout.racks = layout.racks.filter(r => {
      const zid = String(r?.zoneId || '').toUpperCase();
      if(/^Z\d+$/.test(zid) || zid === 'ALM') return desiredZoneSet.has(zid);
      return true;
    });

    desiredZoneIds.forEach(zoneId => {
      if(!layout.zones.some(z => z.id === zoneId)) layout.zones.push(createAutoZone(zoneId, idx));
    });

    desiredZoneIds.forEach(zoneId => {
      const req = zoneReqs.get(zoneId) || { maxRack:0, maxLevel:0, maxSlot:0 };
      const zone = layout.zones.find(z => z.id === zoneId) || createAutoZone(zoneId, idx);
      if(!layout.zones.some(z => z.id === zoneId)) layout.zones.push(zone);
      const maxRack = Math.max(0, req.maxRack || 0);
      const maxLevel = Math.max(1, req.maxLevel || 1);
      const maxSlot = Math.max(1, req.maxSlot || 1);

      if(maxRack > 0){
        const zoneRacks = layout.racks.filter(r => r.zoneId === zoneId);
        zoneRacks.forEach(r => {
          const m = String(r.id || '').match(/-E(\d+)$/i);
          const num = Math.max(1, parseInt(m?.[1] || '1', 10) || 1);
          if(num > maxRack) r.__drop = true;
        });
        layout.racks = layout.racks.filter(r => !r.__drop);
        const autoModelId = ensureAutoRackModel(maxLevel, maxSlot, zoneRacks[0]?.modelId || 'std_4');
        for(let e=1; e<=maxRack; e++){
          const rackId = `${zoneId}-E${e}`;
          let rack = layout.racks.find(r => r.id === rackId);
          if(!rack){
            rack = { id:rackId, zoneId, x:0, y:0, w:120, h:40, rot:0, modelId:autoModelId, front:'auto', baseHeight:0, rackHeight:240 };
            layout.racks.push(rack);
          }
          rack.zoneId = zoneId;
          rack.modelId = autoModelId;
          rack.rackHeight = Math.max(120, Number(rackModel(autoModelId)?.height || rack.rackHeight || 240));
          syncRackFootprint(rack, rack.x > 0 || rack.y > 0);
          if(!(Number.isFinite(rack.x) && Number.isFinite(rack.y)) || (rack.x === 0 && rack.y === 0)) placeRackInZone(layout, zone, rack);
          ensureRackFitsZoneRect(zone, rack);
        }
      }
    });

    layout.zones.sort((a,b) => {
      const aa = String(a?.id || '').toUpperCase(), bb = String(b?.id || '').toUpperCase();
      if(aa === 'ALM' && bb !== 'ALM') return 1;
      if(bb === 'ALM' && aa !== 'ALM') return -1;
      const na = parseInt((aa.match(/^Z(\d+)$/)||[])[1] || '9999', 10);
      const nb = parseInt((bb.match(/^Z(\d+)$/)||[])[1] || '9999', 10);
      return na - nb;
    });
    layout.zones.forEach(z => ensureZoneSectionCuts(z));
    appState.branchLayouts[idx] = layout;
    if(getActiveLayoutBranchIndex() === idx || appState.activeBranchIndex === idx){
      appState.layout = clone(layout);
      ensureLayoutMeta();
      ensureRackProps();
      appState.selectedZoneId = appState.selectedZoneId && appState.layout.zones.some(z => z.id === appState.selectedZoneId) ? appState.selectedZoneId : (appState.layout.zones[0]?.id || '');
      appState.selectedRackLayoutId = appState.selectedRackLayoutId && appState.layout.racks.some(r => r.id === appState.selectedRackLayoutId) ? appState.selectedRackLayoutId : (appState.layout.racks[0]?.id || '');
    }
    saveBranchLayouts();
  }
  function pointInPoly(point, vs){
    let inside = false;
    for (let i=0,j=vs.length-1;i<vs.length;j=i++){
      const xi=vs[i].x, yi=vs[i].y, xj=vs[j].x, yj=vs[j].y;
      const intersect = ((yi>point.y)!==(yj>point.y)) && (point.x < (xj-xi)*(point.y-yi)/(yj-yi+0.00001)+xi);
      if(intersect) inside = !inside;
    }
    return inside;
  }
  function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx + dy*dy; }
  function projectPointToSegment(p,a,b){
    const vx=b.x-a.x, vy=b.y-a.y, wx=p.x-a.x, wy=p.y-a.y;
    const vv = vx*vx + vy*vy || 1;
    let t = (wx*vx + wy*vy)/vv; t=Math.max(0,Math.min(1,t));
    return { x:a.x+t*vx, y:a.y+t*vy, t };
  }

  function getScaleCmPerUnit(){
    const v = Number(appState.layout?.meta?.scaleCmPerUnit);
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  function ensureLayoutMeta(){
    if(!appState.layout.meta || typeof appState.layout.meta !== 'object') appState.layout.meta = {};
    if(!Number.isFinite(Number(appState.layout.meta.scaleCmPerUnit)) || Number(appState.layout.meta.scaleCmPerUnit) <= 0) appState.layout.meta.scaleCmPerUnit = 1;
    return appState.layout.meta;
  }
  function unitsToCm(units){ return Number(units || 0) * getScaleCmPerUnit(); }
  function formatDistanceCm(units){
    const cm = unitsToCm(units);
    if(cm >= 100) return `${(cm/100).toFixed(2).replace(/\.00$/,'')} m`;
    return `${Math.round(cm)} cm`;
  }
  function formatDistanceShort(units){ return `${Math.round(unitsToCm(units))} cm`; }
  function polygonArea(pts){ let sum = 0; for(let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1)%pts.length]; sum += a.x*b.y - b.x*a.y; } return sum/2; }
  function polygonCentroid(pts){ const area = polygonArea(pts) || 1; let cx = 0, cy = 0; for(let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1)%pts.length]; const f = a.x*b.y - b.x*a.y; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f; } return { x: cx / (6*area), y: cy / (6*area) }; }
  function pointNearPolygonEdge(point, pts, tolerance = 8){ for(let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1)%pts.length]; const proj = projectPointToSegment(point, a, b); if(Math.sqrt(dist2(point, proj)) <= tolerance) return true; } return false; }
  function rackCorners(rack){
    if(!rack) return [];
    const fp = getRackFootprint(rack.modelId, rack.rot || 0);
    const bw = fp.baseW || rack.w || 0;
    const bh = fp.baseH || rack.h || 0;
    const ang = normalizeAngle(rack.rot || 0) * Math.PI / 180;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const cx = rack.x + (rack.w || fp.w || bw) / 2;
    const cy = rack.y + (rack.h || fp.h || bh) / 2;
    const pts = [
      { x:-bw/2, y:-bh/2 },
      { x:bw/2, y:-bh/2 },
      { x:bw/2, y:bh/2 },
      { x:-bw/2, y:bh/2 }
    ];
    return pts.map(pt => ({
      x: cx + pt.x * cos - pt.y * sin,
      y: cy + pt.x * sin + pt.y * cos
    }));
  }
  function rackFullyInsideZone(rack, zone){ return !!(rack && zone) && rackCorners(rack).every(pt => pointInPoly(pt, zone.pts) || pointNearPolygonEdge(pt, zone.pts, 1)); }
  function collectSnapPoints(exceptZoneId = ''){ const out = []; (appState.layout?.zones || []).forEach(zone => zone.pts.forEach((pt, idx) => { if(zone.id !== exceptZoneId) out.push({ x:pt.x, y:pt.y, zoneId:zone.id, idx }); })); return out; }
  function snapPointAdvanced(point, { zoneId = '', keepAxis = null, origin = null } = {}){ let x = snapGrid(point.x), y = snapGrid(point.y); const threshold = 14; if(keepAxis === 'x' && origin) y = origin.y; if(keepAxis === 'y' && origin) x = origin.x; collectSnapPoints(zoneId).forEach(pt => { if(Math.abs(pt.x - x) <= threshold) x = pt.x; if(Math.abs(pt.y - y) <= threshold) y = pt.y; }); return { x, y }; }
  function getRackOccupancy(rackId){ let total = 0; for(const p of (appState.products || [])){ if(p.rack === rackId || p.rackStore === rackId) total++; } return total; }

  function seedState(){
    ensureBranchLayouts();
    loadLayoutForBranch(getActiveLayoutBranchIndex());
    appState.products = makeDemoProducts();
    appState.filtered = appState.products.slice(0, 400);
    appState.selectedProduct = appState.products[0];
    appState.selectedRack = appState.products[0].rack;
    appState.selectedRackLayoutId = appState.products[0].rack;
  }

  function setScreen(screen){
    appState.screen = screen;
    menuItems.forEach(i => i.classList.toggle('active', i.dataset.screen === screen));
    const showSearch = ['sheet','viewer'].includes(screen);
    const isSheetLayout = screen === 'sheet';
    appRoot.classList.toggle('sheet-swap-layout', isSheetLayout);
    appRoot.classList.toggle('sheet-expanded', isSheetLayout && !!appState.ui.sheetExpanded);
    if(showSearch){
      document.querySelector('.search-panel').style.display='';
      const isViewer = screen === 'viewer';
      detailPanel.style.display = (isSheetLayout || isViewer) ? 'none' : '';
      contentPanel.classList.remove('full-span');
      appRoot.classList.toggle('viewer-layout', isViewer);
      appRoot.style.gridTemplateColumns = '';
      if(isViewer && detailPanel) detailPanel.style.display = 'none';
    }else{
      appRoot.classList.remove('sheet-swap-layout');
      appRoot.classList.remove('sheet-expanded');
      appRoot.classList.remove('viewer-layout');
      document.querySelector('.search-panel').style.display='none';
      const isRackModels = screen === 'racks';
      const isLayoutScreen = screen === 'layout';
      detailPanel.style.display = isRackModels ? 'none' : '';
      contentPanel.classList.toggle('full-span', isRackModels);
      appRoot.style.gridTemplateColumns = isRackModels
        ? (appRoot.classList.contains('sidebar-collapsed') ? 'var(--sidebar-w-collapsed) 1fr' : 'var(--sidebar-w) 1fr')
        : (isLayoutScreen
            ? (appRoot.classList.contains('sidebar-collapsed') ? 'var(--sidebar-w-collapsed) minmax(0,1fr) 280px' : 'var(--sidebar-w) minmax(0,1fr) 280px')
            : (appRoot.classList.contains('sidebar-collapsed') ? 'var(--sidebar-w-collapsed) minmax(0,1.34fr) minmax(280px,.92fr)' : 'var(--sidebar-w) minmax(0,1.34fr) minmax(280px,.92fr)'));
    }
    contentWrap.innerHTML = '';
    detailWrap.innerHTML = '';
    renderViewerBranchHost(-1);
    contentStatus.textContent = 'Cargando vista…';
    detailStatus.textContent = '—';
    detailChip.textContent = '—';
    try{
      if(screen === 'admin') renderAdminScreen();
      else if(screen === 'sheet') (typeof renderSheetScreen==='function'?renderSheetScreen():renderMapView());
      else if(screen === 'layout') renderLayoutEditor();
      else if(screen === 'racks') renderRackModels();
      else if(screen === 'dashboard') renderDashboard();
      else renderMapView();
    }catch(err){
      console.error('Error al cambiar de pantalla:', err);
      contentTitle.textContent = 'Error de navegación';
      contentSubtitle.textContent = 'No se pudo abrir la vista solicitada.';
      contentWrap.innerHTML = `<div class="empty"><b>No se pudo abrir la pantalla.</b><div class="muted tiny" style="margin-top:8px">${escapeHtml(err.message || 'Error desconocido')}</div></div>`;
      detailTitle.textContent = 'Detalle';
      detailSubtitle.textContent = 'Sin información';
      detailWrap.innerHTML = '';
      contentStatus.textContent = 'Error al abrir la vista';
    }
  }

  function setTags(tags=[]){
    contentTags.innerHTML = tags.map(t => {
      const item = typeof t === 'string' ? { label:t, active:true } : (t || {});
      const label = escapeHtml(String(item.label || ''));
      const cls = item.active === false ? 'tag inactive' : 'tag active';
      return `<span class="${cls}">${label}</span>`;
    }).join('');
  }

  function getProductSizeValue(product){
    if(!product) return '';
    const raw = String(product.talla || '').trim();
    if(raw) return raw.toUpperCase();
    const variant = String(product.variante || '').trim();
    if(!variant) return '';
    const match = variant.match(/(?:^|\b)(?:talla\s*)?(XXXL|XXL|XXS|XS|XL|L|M|S|3XL|2XL|4XL|5XL|U|UNICA|ÚNICA)(?:\b|$)/i);
    return match ? match[1].toUpperCase().replace('ÚNICA','UNICA') : '';
  }

  function getProductColorValue(product){
    if(!product) return '';
    const raw = String(product.color || '').trim();
    if(raw) return raw;
    const variant = String(product.variante || '').trim();
    if(!variant) return '';
    let cleaned = variant
      .replace(/(?:^|\b)talla\b/ig, ' ')
      .replace(/(?:^|\b)(XXXL|XXL|XXS|XS|XL|L|M|S|3XL|2XL|4XL|5XL|U|UNICA|ÚNICA)(?:\b|$)/ig, ' ')
      .replace(/[\-_/,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  function normalizeVariantValue(value){
    return norm(String(value || '').trim());
  }

  function getVariantToneKey(value){
    const key = normalizeVariantValue(value);
    if(!key) return 'tone-1';
    let hash = 0;
    for(let i = 0; i < key.length; i++){
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash % 6) + 1;
    return `tone-${idx}`;
  }
  function getProductSearchText(product){
    if(!product) return '';
    return norm([
      product.marca,
      product.codigo,
      product.cod,
      product.modelo,
      product.nombre,
      getProductSizeValue(product),
      getProductColorValue(product),
      product.variante,
      product.sku,
      product.barras,
      product.ubicacion,
      product.almacen,
      product.rack,
      product.rackStore
    ].filter(Boolean).join(' '));
  }


  function buildVariantGroups(product){
    if(!product) return { sizes: [], colors: [] };
    const siblings = appState.products.filter(p => norm(p.nombre) === norm(product.nombre));
    const pool = siblings.length ? siblings : [product];
    const activeSizeKey = normalizeVariantValue(getProductSizeValue(product));
    const activeColorKey = normalizeVariantValue(getProductColorValue(product));
    const sizeSeen = new Set();
    const colorSeen = new Set();
    const sizes = [];
    const colors = [];
    const sizeOrder = ['XXS','XS','S','M','L','XL','XXL','XXXL','2XL','3XL','4XL','5XL','U','UNICA'];
    const sizeRank = v => { const i = sizeOrder.indexOf(String(v||'').toUpperCase()); return i >= 0 ? i : 999; };
    const availableByActiveColor = activeColorKey ? new Set(pool.filter(p => normalizeVariantValue(getProductColorValue(p)) === activeColorKey).map(p => normalizeVariantValue(getProductSizeValue(p))).filter(Boolean)) : new Set();
    const availableByActiveSize = activeSizeKey ? new Set(pool.filter(p => normalizeVariantValue(getProductSizeValue(p)) === activeSizeKey).map(p => normalizeVariantValue(getProductColorValue(p))).filter(Boolean)) : new Set();
    pool.forEach(p => {
      const size = getProductSizeValue(p);
      const color = getProductColorValue(p);
      if(size){
        const key = normalizeVariantValue(size);
        if(!sizeSeen.has(key)){
          sizeSeen.add(key);
          sizes.push({ label:size, product:p, active:key === activeSizeKey, available: !activeColorKey || availableByActiveColor.has(key) });
        }
      }
      if(color){
        const key = normalizeVariantValue(color);
        if(!colorSeen.has(key)){
          colorSeen.add(key);
          colors.push({ label:color, product:p, active:key === activeColorKey, available: !activeSizeKey || availableByActiveSize.has(key) });
        }
      }
    });
    sizes.sort((a,b) => sizeRank(a.label) - sizeRank(b.label) || String(a.label).localeCompare(String(b.label)));
    colors.sort((a,b) => String(a.label).localeCompare(String(b.label)));
    return { sizes, colors };
  }

  function getColorChipStyle(label){
    const colorName = norm(label || '');
    const presets = [
      { keys:['blanco','white'], bg:'#f5f5f2', fg:'#545b56', border:'#d7ddd9' },
      { keys:['negro','black'], bg:'#2e3331', fg:'#f5fffb', border:'#4f5854' },
      { keys:['gris','gray','grey'], bg:'#dce2df', fg:'#51605a', border:'#c2cbc6' },
      { keys:['rojo','red'], bg:'#f6c6c6', fg:'#8a2f2f', border:'#e5aaaa' },
      { keys:['vino','burgundy','guinda'], bg:'#dcc3d0', fg:'#6a314f', border:'#caa8b9' },
      { keys:['rosa','pink'], bg:'#f3d5de', fg:'#8a4560', border:'#e5bfd0' },
      { keys:['azul','blue','uva'], bg:'#cfe1f7', fg:'#315a88', border:'#bad2ef' },
      { keys:['celeste','sky'], bg:'#d8eef8', fg:'#3d6780', border:'#c6e4f0' },
      { keys:['verde','green'], bg:'#d8f0df', fg:'#35694a', border:'#c2e3ce' },
      { keys:['amarillo','yellow','coral'], bg:'#f6e6b3', fg:'#8b6a12', border:'#ebd788' },
      { keys:['lila','morado','violeta','purple','azalea'], bg:'#e6daf8', fg:'#6b4f99', border:'#d4c2f1' },
      { keys:['beige','nude','natural'], bg:'#eadfcf', fg:'#7a6751', border:'#deceb7' },
    ];
    const hit = presets.find(p => p.keys.some(k => colorName.includes(k)));
    const chosen = hit || { bg:'rgba(255,255,255,.08)', fg:'var(--text)', border:'rgba(255,255,255,.12)' };
    return `background:${chosen.bg};color:${chosen.fg};border-color:${chosen.border}`;
  }

  function renderVariantStrip(target, items, emptyLabel, clickFactory, type='default'){
    if(!target) return;
    target.innerHTML = '';
    if(!items.length){
      const empty = document.createElement('span');
      empty.className = 'muted tiny';
      empty.textContent = emptyLabel;
      target.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `variant-chip ${type === 'color' ? 'variant-color' : getVariantToneKey(item.label)}${item.active ? ' active' : ''}${item.available === false ? ' muted' : ''}`;
      btn.textContent = item.label;
      btn.title = item.label;
      if(type === 'color') btn.style.cssText = getColorChipStyle(item.label);
      btn.addEventListener('click', () => clickFactory(item));
      target.appendChild(btn);
    });
  }

  function getProductImageUrls(product){
    if(!product) return [];
    const raw = [product.imagen, product.image, product.imagen2, product.image2, product.foto2, product.img2].filter(Boolean).map(v => String(v).trim());
    const split = [];
    raw.forEach(value => {
      if(/[|\n,;]/.test(value)) split.push(...value.split(/[|\n,;]+/));
      else split.push(value);
    });
    const out = [];
    const seen = new Set();
    split.map(v => String(v || '').trim()).filter(Boolean).forEach(url => { if(!seen.has(url)){ seen.add(url); out.push(url); } });
    return out;
  }

  function stopActiveProductImageCycle(){
    if(activeImageCycleTimer){ clearInterval(activeImageCycleTimer); activeImageCycleTimer = null; }
    activeImageCycleUrls = [];
  }

  function startActiveProductImageCycle(urls){
    stopActiveProductImageCycle();
    activeImageCycleUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if(!activeProductImageWrap || !activeProductImage) return;
    if(!activeImageCycleUrls.length){
      activeProductImage.removeAttribute('src');
      activeProductImage.style.display = 'none';
      activeProductImageWrap.classList.add('empty');
      return;
    }
    let index = 0;
    const apply = () => {
      const nextUrl = activeImageCycleUrls[index % activeImageCycleUrls.length];
      activeProductImage.src = nextUrl;
      activeProductImage.style.display = 'block';
      activeProductImageWrap.classList.remove('empty');
      index += 1;
    };
    apply();
    if(activeImageCycleUrls.length > 1) activeImageCycleTimer = setInterval(apply, 1800);
  }

  function renderActiveVariantStrip(product){
    const groups = buildVariantGroups(product);
    renderVariantStrip(activeSizeStrip, groups.sizes, 'Sin tallas relacionadas', (item) => {
      const currentColor = getProductColorValue(product);
      const siblings = appState.products.filter(p => norm(p.nombre) === norm(product?.nombre));
      const exact = siblings.find(p => normalizeVariantValue(getProductSizeValue(p)) === normalizeVariantValue(item.label) && normalizeVariantValue(getProductColorValue(p)) === normalizeVariantValue(currentColor));
      selectProduct(exact || item.product);
    }, 'size');
    renderVariantStrip(activeColorStrip, groups.colors, 'Sin colores relacionados', (item) => {
      const currentSize = getProductSizeValue(product);
      const siblings = appState.products.filter(p => norm(p.nombre) === norm(product?.nombre));
      const exact = siblings.find(p => normalizeVariantValue(getProductColorValue(p)) === normalizeVariantValue(item.label) && normalizeVariantValue(getProductSizeValue(p)) === normalizeVariantValue(currentSize));
      selectProduct(exact || item.product);
    }, 'color');
  }

  function updateActiveProductCard(p){
    if(!activeProductName) return;
    const hasProduct = !!p;
    activeProductName.textContent = hasProduct ? (p.nombre || 'Sin nombre') : '—';
    if(activeProductSku) activeProductSku.textContent = hasProduct ? `SKU ${p.sku || '—'}` : 'SKU —';
    const sizeText = hasProduct ? getProductSizeValue(p) : '';
    const colorText = hasProduct ? getProductColorValue(p) : '';
    activeProductMeta.textContent = hasProduct ? `Variante activa: talla ${sizeText || '—'}${colorText ? ` • color ${colorText}` : ''}` : 'Selecciona un producto para enfocarlo rápido.';
    activeLocation.textContent = hasProduct ? (p.ubicacion || '—') : '—';
    if(activeStoreLocation) activeStoreLocation.textContent = hasProduct ? (p.almacen || '—') : '—';
    if(activeProductImageWrap && activeProductImage){
      startActiveProductImageCycle(getProductImageUrls(p));
    }
    renderActiveVariantStrip(p);
  }

  function applyProductSelectionEffects(product){
    if(!product) return;
  }

  function renderProducts(list){
    const frag = document.createDocumentFragment();
    const maxRows = appState.ui.productGroupMode ? 220 : 450;
    const items = [];
    if(appState.ui.productGroupMode){
      const groups = new Map();
      list.forEach(p => {
        const key = norm(p.nombre || '') || '__sin_nombre__';
        if(!groups.has(key)) groups.set(key, { nombre:p.nombre || 'Sin nombre', items:[], sample:p });
        groups.get(key).items.push(p);
      });
      Array.from(groups.values())
        .sort((a,b) => b.items.length - a.items.length || String(a.nombre).localeCompare(String(b.nombre)))
        .slice(0, maxRows)
        .forEach(g => items.push({ type:'group', data:g }));
    } else {
      list.slice(0, maxRows).forEach(p => items.push({ type:'product', data:p }));
    }
    productList.innerHTML = '';
    items.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'product-row' + ((entry.type==='product' && (appState.selectedProduct?.sku === entry.data.sku) && (appState.selectedProduct?.variante === entry.data.variante)) ? ' active' : '');
      if(entry.type === 'group'){
        const g = entry.data;
        const first = g.items[0];
        const variantes = Array.from(new Set(g.items.map(p => (p.variante || '').trim()).filter(Boolean)));
        const ubicaciones = Array.from(new Set(g.items.map(p => (p.ubicacion || '').trim()).filter(Boolean)));
        row.innerHTML = `
          <div><b>${escapeHtml(first.sku || '—')}</b></div>
          <div>${escapeHtml(g.nombre)}</div>
          <div><span class="variant-chip muted" style="padding:6px 10px;border-radius:10px;min-width:auto;cursor:default">${variantes.length} variante${variantes.length === 1 ? '' : 's'} • ${ubicaciones.length} ubicaci${ubicaciones.length === 1 ? 'ón' : 'ones'}</span></div>
          <div><span class="loc-pill">${escapeHtml(first.ubicacion || '—')}</span></div>
          <div>${escapeHtml(first.almacen || '—')}</div>`;
        row.title = 'Familia agrupada por nombre de producto';
        row.addEventListener('click', () => selectProduct(first));
      } else {
        const p = entry.data;
        row.innerHTML = `
          <div><b>${p.sku}</b></div>
          <div>${p.nombre}</div>
          <div><span class="variant-chip muted ${getVariantToneKey(p.variante)}" style="padding:6px 10px;border-radius:10px;min-width:auto;cursor:default">${escapeHtml(p.variante || '—')}</span></div>
          <div><span class="loc-pill">${p.ubicacion}</span></div>
          <div>${p.almacen}</div>`;
        row.addEventListener('click', () => selectProduct(p));
      }
      frag.appendChild(row);
    });
    productList.appendChild(frag);
    countProducts.textContent = appState.products.length.toLocaleString('es-PE');
    const shown = items.length;
    const modeLabel = appState.ui.productGroupMode ? 'familias' : 'resultados';
    productSummary.textContent = `Mostrando ${shown.toLocaleString('es-PE')} ${modeLabel} de ${list.length.toLocaleString('es-PE')} registros` + (appState.ui.productGroupMode ? ' • agrupado por producto / nombre' : (list.length > maxRows ? ' • usa el buscador para acotar' : ''));
  }

  function filterProducts(){
    const rawQ = String(searchInput.value || '');
    const q = norm(rawQ);
    if(!q){
      appState.filtered = appState.products;
      clearSearchHighlights();
      updateActiveProductCard(appState.selectedProduct || null);
      renderProducts(appState.filtered);
      if(appState.screen === 'dashboard') renderDashboard();
      else if(['products','viewer'].includes(appState.screen)) renderMapView();
      else if(appState.screen === 'layout'){ renderLayoutEditor(); renderLayoutInspector(); }
      return;
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const compactQuery = q.replace(/\s+/g, ' ').trim();
    const scored = appState.products.map(p => {
      const haystack = getProductSearchText(p);
      const nameOnly = norm(p.nombre || '');
      const familyText = norm([p.marca, p.codigo, p.cod, p.modelo, p.nombre].filter(Boolean).join(' '));
      const nameVariant = norm(`${p.nombre || ''} ${p.variante || ''}`);
      const exactSku = norm(p.sku || '');
      const exactRack = norm(p.rack || '');
      const exactRackStore = norm(p.rackStore || '');
      const exactUbic = norm(p.ubicacion || '');
      const exactAlm = norm(p.almacen || '');
      const sizeValue = norm(getProductSizeValue(p));
      const colorValue = norm(getProductColorValue(p));
      const phraseInFamily = familyText.includes(compactQuery);
      const phraseInNameVariant = nameVariant.includes(compactQuery);
      const phraseInFull = haystack.includes(compactQuery);
      const allTokensPresent = tokens.length ? tokens.every(t => haystack.includes(t)) : false;
      let score = 0;
      if (exactSku === q) score += 220;
      if (nameVariant === q) score += 165;
      if (familyText === q || nameOnly === q) score += 150;
      if (phraseInFamily) score += 130;
      if (phraseInNameVariant) score += 115;
      if (phraseInFull) score += 84;
      if (exactRack === q || exactRackStore === q) score += 90;
      if (exactUbic === q || exactAlm === q) score += 85;
      if (sizeValue === q || colorValue === q || norm(p.variante || '') === q) score += 70;
      if (allTokensPresent) score += 90 + tokens.length * 10;
      let matchedTokens = 0;
      let familyTokenMatches = 0;
      tokens.forEach(t => {
        if(!t) return;
        if (haystack.includes(t)) { score += 10; matchedTokens += 1; }
        if (familyText.includes(t)) { score += 22; familyTokenMatches += 1; }
        if (exactSku.includes(t)) score += 24;
        if (nameOnly.includes(t)) score += 18;
        if (sizeValue === t || colorValue === t) score += 18;
        else if (sizeValue.includes(t) || colorValue.includes(t)) score += 10;
      });
      if(tokens.length && matchedTokens === tokens.length) score += 26;
      const strongPhrase = phraseInFamily || phraseInNameVariant || phraseInFull || exactSku === q;
      const enoughFamilyCoverage = !tokens.length ? true : (tokens.length === 1 ? familyTokenMatches >= 1 || strongPhrase : familyTokenMatches === tokens.length || (tokens.length >= 3 && familyTokenMatches >= tokens.length - 1));
      const enoughGeneralCoverage = !tokens.length ? true : (tokens.length === 1 ? matchedTokens >= 1 || strongPhrase : matchedTokens === tokens.length || strongPhrase);
      const passes = (strongPhrase && matchedTokens >= Math.max(1, Math.min(tokens.length, 2))) || (enoughFamilyCoverage && enoughGeneralCoverage);
      return { p, score, matchedTokens, familyTokenMatches, passes };
    }).filter(x => x.passes && x.score >= (tokens.length >= 3 ? 60 : tokens.length === 2 ? 38 : 18))
      .sort((a,b) => b.score - a.score || b.familyTokenMatches - a.familyTokenMatches || String(a.p.nombre||'').localeCompare(String(b.p.nombre||'')) || String(a.p.variante||'').localeCompare(String(b.p.variante||'')));
    appState.filtered = scored.map(x => x.p);
    const primary = appState.filtered[0] || null;
    if(primary){
      appState.selectedProduct = primary;
      appState.selectedRack = primary.rack || primary.rackStore || appState.selectedRack;
      appState.selectedRackLayoutId = primary.rack || primary.rackStore || appState.selectedRackLayoutId;
    }
    const rackIds = [];
    appState.filtered.slice(0, 250).forEach(p => { if(p.rack) rackIds.push(p.rack); if(p.rackStore) rackIds.push(p.rackStore); });
    setSearchHighlightedRacks(rackIds, primary?.rack || primary?.rackStore || '');
    if(primary){
      updateActiveProductCard(primary);
      applyProductSelectionEffects(primary);
    } else {
      updateActiveProductCard(null);
      clearSearchHighlights();
    }
    renderProducts(appState.filtered);
    if(appState.screen === 'dashboard') renderDashboard();
    else if(['products','viewer'].includes(appState.screen)) renderMapView();
    else if(appState.screen === 'layout'){ renderLayoutEditor(); renderLayoutInspector(); }
  }

  function selectProduct(p){
    appState.selectedProduct = p;
    appState.selectedRack = p.rack;
    appState.selectedRackLayoutId = p.rack;
    updateActiveProductCard(p);
    if(appState.screen === 'dashboard'){
      appState.selectedRackLayoutId = p.rack || p.rackStore || '';
      renderDashboard();
    } else if(['products','reports','viewer'].includes(appState.screen)){
      renderMapView();
      renderRackDetail(p.rack, p);
    } else if (appState.screen === 'layout') {
      renderLayoutEditor();
      renderLayoutInspector();
    } else if (appState.screen === 'racks') {
      renderRackModels();
      renderRackModelPreview();
    }
    renderProducts(appState.filtered);
  }

  function findRackById(id){ return appState.layout.racks.find(r => r.id === id); }
  function findZoneById(id){ return appState.layout.zones.find(z => z.id === id); }
  function rackModel(id){ return appState.models.find(m => m.id === id) || appState.models[0]; }
  function getSelectedRackIds(){
    const ids = Array.isArray(appState.selectedRackLayoutIds) ? appState.selectedRackLayoutIds.filter(Boolean) : [];
    if(appState.selectedRackLayoutId && !ids.includes(appState.selectedRackLayoutId)) ids.unshift(appState.selectedRackLayoutId);
    return Array.from(new Set(ids));
  }
  function setSelectedRackIds(ids){
    const clean = Array.from(new Set((ids||[]).filter(Boolean)));
    appState.selectedRackLayoutIds = clean;
    appState.selectedRackLayoutId = clean[0] || '';
    if(appState.selectedRackLayoutId){
      const rack = findRackById(appState.selectedRackLayoutId);
      if(rack) appState.selectedZoneId = rack.zoneId;
    }
  }
  function isRackSelected(id){ return getSelectedRackIds().includes(id); }
  function toggleRackSelection(id){
    const ids = getSelectedRackIds();
    const idx = ids.indexOf(id);
    if(idx >= 0) ids.splice(idx,1); else ids.push(id);
    setSelectedRackIds(ids);
  }
  function clearRackSelection(){ setSelectedRackIds([]); }
  function setSearchHighlightedRacks(ids, primary=''){
    const clean = Array.from(new Set((ids||[]).filter(Boolean)));
    appState.highlightedRackIds = clean;
    appState.primaryHighlightedRackId = primary && clean.includes(primary) ? primary : (clean[0] || '');
  }
  function isRackSearchHit(id){ return (appState.highlightedRackIds || []).includes(id); }
  function clearSearchHighlights(){ setSearchHighlightedRacks([], ''); }
  function getDragSelectionBox(){
    const ds = appState.editor?.dragSelect;
    if(!ds?.start || !ds?.end) return null;
    const x = Math.min(ds.start.x, ds.end.x), y = Math.min(ds.start.y, ds.end.y);
    return { x, y, w:Math.abs(ds.end.x - ds.start.x), h:Math.abs(ds.end.y - ds.start.y) };
  }
  function rackIntersectsBox(rack, box){
    return !!box && rack.x < box.x + box.w && rack.x + rack.w > box.x && rack.y < box.y + box.h && rack.y + rack.h > box.y;
  }
  function startDragSelection(startPoint, additive=false){
    appState.editor.dragSelect = { active:true, additive:!!additive, start:{x:startPoint.x,y:startPoint.y}, end:{x:startPoint.x,y:startPoint.y} };
    if(!additive) clearRackSelection();
  }
  function updateDragSelection(point){
    const ds = appState.editor?.dragSelect;
    if(!ds?.active) return;
    ds.end = { x:point.x, y:point.y };
  }
  function commitDragSelection(){
    const ds = appState.editor?.dragSelect;
    if(!ds?.active) return false;
    const box = getDragSelectionBox();
    if(box && box.w >= 6 && box.h >= 6){
      const ids = ds.additive ? getSelectedRackIds() : [];
      (appState.layout.racks || []).forEach(r => { if(rackIntersectsBox(r, box)) ids.push(r.id); });
      setSelectedRackIds(ids);
      appState.editor.dragSelect = { active:false, additive:false, start:null, end:null };
      return true;
    }
    appState.editor.dragSelect = { active:false, additive:false, start:null, end:null };
    return false;
  }
  function applyModelToSelectedRacks(){
    const ids = getSelectedRackIds();
    const model = rackModel(appState.selectedModelId);
    if(!model || !ids.length) return;
    ids.forEach(id => {
      const rack = findRackById(id);
      if(!rack) return;
      const prev = clone(rack);
      const center = { x: rack.x + rack.w/2, y: rack.y + rack.h/2 };
      const fp = getRackFootprint(model.id, rack.rot || 0);
      rack.modelId = model.id;
      rack.w = fp.w; rack.h = fp.h;
      rack.rackHeight = Number(model.height || rack.rackHeight || 238);
      rack.x = snapGrid(center.x - rack.w/2);
      rack.y = snapGrid(center.y - rack.h/2);
      const zone = findZoneById(rack.zoneId) || nearestZoneForPoint(center);
      if(zone){
        keepRackSnapped(rack, zone);
        if(!rackFullyInsideZone(rack, zone)){
          rack.x = prev.x; rack.y = prev.y; rack.w = prev.w; rack.h = prev.h; rack.modelId = prev.modelId; rack.rackHeight = prev.rackHeight;
        }
      }
    });
    normalizeZoneAndRackIds();
    persistActiveLayout();
    renderLayoutEditor();
  }
  function nextRackId(zoneId){
    const vals = appState.layout.racks.filter(r => r.zoneId === zoneId).map(r => parseInt((r.id.match(/-E(\d+)/)||[])[1] || '0', 10));
    return `${zoneId}-E${(Math.max(0,...vals)+1)}`;
  }
  function nextZoneId(){
    const nums = appState.layout.zones
      .map(z => { const m = String(z.id || '').match(/^Z(\d+)$/i); return m ? parseInt(m[1], 10) : 0; })
      .filter(Boolean);
    const next = Math.max(2, ...nums) + 1;
    return 'Z' + next;
  }

  function normalizeZoneCode(code){
    return String(code || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
  }
  function renameZoneId(oldId, nextId){
    const current = normalizeZoneCode(oldId);
    const target = normalizeZoneCode(nextId);
    if(!current || !target || current === target) return current || target;
    if(appState.layout.zones.some(z => z.id === target && z.id !== current)){
      alert('La nomenclatura de zona ya existe.');
      return current;
    }
    const zone = findZoneById(current);
    if(!zone) return current;
    zone.id = target;
    appState.layout.racks.filter(r => r.zoneId === current).forEach(r => {
      r.zoneId = target;
      const suffix = (String(r.id).match(/-E\d+$/i) || ['-E1'])[0];
      r.id = `${target}${suffix}`;
    });
    if(appState.selectedZoneId === current) appState.selectedZoneId = target;
    if(appState.selectedEdge.zoneId === current) appState.selectedEdge.zoneId = target;
    if(appState.selectedVertex.zoneId === current) appState.selectedVertex.zoneId = target;
    if(appState.editor.dragging?.zoneId === current) appState.editor.dragging.zoneId = target;
    if(appState.selectedRackLayoutId){
      const found = appState.layout.racks.find(r => r.id === appState.selectedRackLayoutId);
      if(!found){
        const zoneRack = appState.layout.racks.find(r => r.zoneId === target);
        appState.selectedRackLayoutId = zoneRack?.id || '';
      }
    }
    return target;
  }

  const GRID_SIZE = 20;
  function snapGrid(n){ return Math.round(n / GRID_SIZE) * GRID_SIZE; }
  function normalizeAngle(a){ return (((Number(a) || 0) % 360) + 360) % 360; }
  function getRackBaseSize(modelId){
    const m = rackModel(modelId);
    const scale = 1;
    return {
      w: Math.max(44, Math.round((m.width || 150) * scale)),
      h: Math.max(24, Math.round((m.depth || 82) * scale))
    };
  }
  function getRackFootprint(modelId, rot = 0){
    const base = getRackBaseSize(modelId);
    const rad = normalizeAngle(rot) * Math.PI / 180;
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    const w = Math.max(40, Math.round(base.w * c + base.h * s));
    const h = Math.max(40, Math.round(base.w * s + base.h * c));
    return { w, h, baseW: base.w, baseH: base.h };
  }

  function rackStackKey(r){
    return [String(r.zoneId||''), Math.round(Number(r.x||0)), Math.round(Number(r.y||0))].join('|');
  }
  function getRackStackMembers(rack){
    if(!rack) return [];
    const key = rackStackKey(rack);
    return (appState.layout.racks || []).filter(r => rackStackKey(r) === key);
  }
  function getRackStackCount(rack){
    return getRackStackMembers(rack).length;
  }
  function rackStackSummary(rack){
    const members = getRackStackMembers(rack);
    return {
      members,
      count: members.length,
      isStacked: members.length > 1,
      key: members.length ? rackStackKey(members[0]) : ''
    };
  }
  function openStackMenuForRack(rackId, evt){
    const rack = findRackById(rackId);
    if(!rack) return;
    const summary = rackStackSummary(rack);
    if(summary.count <= 1){
      appState.editor.stackMenu = { open:false, rackId:'', x:0, y:0 };
      return;
    }
    let x = 28, y = 74;
    const svg = document.getElementById('layoutSvg');
    if(svg){
      const svgRect = svg.getBoundingClientRect();
      if(evt && Number.isFinite(evt.clientX) && Number.isFinite(evt.clientY)){
        x = evt.clientX - svgRect.left + 12;
        y = evt.clientY - svgRect.top + 12;
      } else {
        x = 28; y = 74;
      }
    }
    appState.editor.stackMenu = { open:true, rackId, x, y };
  }
  function closeStackMenu(){
    appState.editor.stackMenu = { open:false, rackId:'', x:0, y:0 };
  }
  function getFrontLine(baseW, baseH){
    const pad = 8;
    // El frente siempre es el lado más largo del rack.
    // Si el ancho base es mayor o igual al fondo, el frente es el borde superior.
    // Si el fondo es mayor, el frente es el borde derecho.
    if(baseW >= baseH){
      return { x1: -baseW/2 + 12, y1: -baseH/2 + pad, x2: baseW/2 - 12, y2: -baseH/2 + pad, ax: 0, ay: -baseH/2 - 10, dir:'up' };
    }
    return { x1: baseW/2 - pad, y1: -baseH/2 + 12, x2: baseW/2 - pad, y2: baseH/2 - 12, ax: baseW/2 + 10, ay: 0, dir:'right' };
  }
  function frontArrowPath(x, y, dir){
    if(dir === 'right') return `M ${x-9} ${y-6} L ${x-9} ${y+6} L ${x+4} ${y} Z`;
    if(dir === 'down') return `M ${x-6} ${y-9} L ${x+6} ${y-9} L ${x} ${y+4} Z`;
    if(dir === 'left') return `M ${x+9} ${y-6} L ${x+9} ${y+6} L ${x-4} ${y} Z`;
    return `M ${x-6} ${y+9} L ${x+6} ${y+9} L ${x} ${y-4} Z`;
  }
  function syncRackFootprint(rack, preserveCenter = true){
    if(!rack) return;
    const oldW = rack.w || 48, oldH = rack.h || 90;
    const cx = rack.x + oldW / 2, cy = rack.y + oldH / 2;
    const fp = getRackFootprint(rack.modelId, rack.rot || 0);
    rack.w = fp.w; rack.h = fp.h;
    if(preserveCenter){
      rack.x = cx - rack.w / 2;
      rack.y = cy - rack.h / 2;
    }
  }
  function applyRackRotation(rack, nextAngle, { preserveCenter = true, snap = true } = {}){
    if(!rack) return;
    const cx = rack.x + (rack.w || 0) / 2;
    const cy = rack.y + (rack.h || 0) / 2;
    rack.rot = normalizeAngle(nextAngle);
    syncRackFootprint(rack, false);
    if(preserveCenter){
      rack.x = cx - rack.w / 2;
      rack.y = cy - rack.h / 2;
    }
    const host = findZoneById(rack.zoneId) || nearestZoneForPoint({ x:cx, y:cy });
    if(host){
      keepRackSnapped(rack, host);
      rack.zoneId = host.id;
    }
  }
  function ensureRackProps(){
    appState.layout.racks.forEach(r => {
      r.rot = normalizeAngle(r.rot || 0);
      const model = rackModel(r.modelId);
      const defaultHeight = Math.max(120, Number(model?.height || 240) || 240);
      const legacyStack = Math.max(0, parseInt(r.stackLevel || 0, 10) || 0);
      if(!Number.isFinite(Number(r.baseHeight))) r.baseHeight = legacyStack * defaultHeight;
      if(!Number.isFinite(Number(r.rackHeight)) || Number(r.rackHeight) <= 0) r.rackHeight = defaultHeight;
      r.rackHeight = Math.max(60, Number(r.rackHeight) || defaultHeight);
      if(!Number.isFinite(Number(r.stackLevel))) r.stackLevel = legacyStack;
      syncRackStackMetrics(r, false);
      syncRackFootprint(r, false);
    });
  }

  async function loadSheetFromConfig(){
    const url = appState.sheetConfig.url;
    const sheetName = appState.sheetConfig.sheetName || 'Productos';
    const id = parseSheetUrl(url);
    if(!id){ alert('URL o ID de Google Sheet inválido.'); return; }
    sheetStatusChip.textContent = 'Cargando sheet...';
    contentStatus.textContent = 'Intentando leer Google Sheet...';
    try {
      const endpoint = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheetName)}`;
      const text = await fetch(endpoint).then(r => r.text());
      const json = JSON.parse(text.substring(47).slice(0, -2));
      const rows = json.table.rows || [];
      const rowValues = rows.map(r => (r.c || []).map(c => String(c?.v ?? '').trim()));

      const normalizeHeaderKey = (v) => {
        const s = norm(String(v || ''));
        const compact = s.replace(/\s+/g, '');
        const map = {
          'sku':'sku',
          'nombre':'nombre',
          'variante':'variante',
          'barras':'barras',
          'barra':'barras',
          'ubicacion':'ubicacion',
          'ubiccaion':'ubicacion',
          'ubicaion':'ubicacion',
          'ubiccacion':'ubicacion',
          'almacen':'almacen',
          'alamacen':'almacen',
          'alamacenf':'almacen',
          'alamacenfinal':'almacen',
          'alamacen2':'almacen',
          'alamacen1':'almacen',
          'alamacenprincipal':'almacen',
          'alamacenrespaldo':'almacen',
          'alamacenreserva':'almacen',
          'alamacenstock':'almacen',
          'alamacenubicacion':'almacen',
          'alamacenubi':'almacen',
          'alamacenn':'almacen',
          'alamacenx':'almacen',
          'alamacenw':'almacen',
          'alamacenv':'almacen',
          'alamacenq':'almacen',
          'alamacenr':'almacen',
          'alamacenm':'almacen',
          'alamaacen':'almacen',
          'alamacn':'almacen',
          'alamac':'almacen',
          'alam':'almacen',
          'alamacen ':'almacen',
          'alamacen_':'almacen',
          'almacen':'almacen',
          'almacenubicado':'almacen',
          'zona':'zona',
          'estante':'estante',
          'nivel':'nivel',
          'slot':'slot'
        };
        return map[compact] || compact;
      };

      const expected = ['sku','nombre','variante','barras','ubicacion','almacen','zona','estante','nivel','slot'];
      const scoreHeaderRow = (vals, rowIndex) => {
        const keys = vals.map(normalizeHeaderKey).filter(Boolean);
        const set = new Set(keys);
        let score = 0;
        expected.forEach(k => { if (set.has(k)) score += 3; });
        if (set.has('sku')) score += 5;
        if (set.has('nombre')) score += 5;
        if (set.has('variante')) score += 4;
        if (set.has('barras')) score += 4;
        if (set.has('ubicacion')) score += 8; // priorizar columna fusionada
        if (set.has('almacen')) score += 8;   // priorizar columna fusionada
        if (rowIndex === 1 && score > 0) score += 6; // preferir fila 2 si coincide
        return score;
      };

      let headerRowIndex = 0;
      let bestScore = -1;
      for (let i = 0; i < Math.min(12, rowValues.length); i++){
        const score = scoreHeaderRow(rowValues[i], i);
        if (score > bestScore){
          bestScore = score;
          headerRowIndex = i;
        }
      }

      const headerVals = rowValues[headerRowIndex] || [];
      const headers = headerVals.map((raw, idx) => ({ raw, key: normalizeHeaderKey(raw), idx }));
      const duplicates = (name) => headers.filter(h => h.key === name).map(h => h.idx);
      const firstOf = (...names) => {
        for (const n of names){
          const key = normalizeHeaderKey(n);
          const hit = headers.find(h => h.key === key);
          if (hit) return hit.idx;
        }
        return -1;
      };
      const val = (vals, i) => String(vals?.[i] ?? '').trim();

      // Fallback fijo por columnas: J barras, K sku, L nombre, M variante, R ubicacion, W almacen
      // N/O/P/Q = zona/estante/nivel/slot principal
      // S/T/U/V = zona/estante/nivel/slot almacén
      const fallback = {
        barras: 9,
        sku: 10,
        nombre: 11,
        variante: 12,
        zona1: 13,
        estante1: 14,
        nivel1: 15,
        slot1: 16,
        ubicacion: 17,
        zona2: 18,
        estante2: 19,
        nivel2: 20,
        slot2: 21,
        almacen: 22
      };

      const iSKU = firstOf('sku') >= 0 ? firstOf('sku') : fallback.sku;
      const iNombre = firstOf('nombre') >= 0 ? firstOf('nombre') : fallback.nombre;
      const iVar = firstOf('variante') >= 0 ? firstOf('variante') : fallback.variante;
      const iBarras = firstOf('barras','barra') >= 0 ? firstOf('barras','barra') : fallback.barras;
      const iImagen = firstOf('imagen','image','foto','img');
      const iTalla = firstOf('talla','size');
      const iColor = firstOf('color','colour');
      const iUb = firstOf('ubicacion','ubiccaion','ubicaion','ubiccacion') >= 0 ? firstOf('ubicacion','ubiccaion','ubicaion','ubiccacion') : fallback.ubicacion;
      const iAlm = firstOf('almacen','alamacen','almacen','alamaacen','alamacn','alamac') >= 0 ? firstOf('almacen','alamacen','almacen','alamaacen','alamacn','alamac') : fallback.almacen;

      const zonas = duplicates('zona');
      const estantes = duplicates('estante');
      const niveles = duplicates('nivel');
      const slots = duplicates('slot');
      const mainZona = zonas[0] ?? fallback.zona1, storeZona = zonas[1] ?? fallback.zona2;
      const mainEst = estantes[0] ?? fallback.estante1, storeEst = estantes[1] ?? fallback.estante2;
      const mainNiv = niveles[0] ?? fallback.nivel1, storeNiv = niveles[1] ?? fallback.nivel2;
      const mainSlot = slots[0] ?? fallback.slot1, storeSlot = slots[1] ?? fallback.slot2;

      const buildLocation = (z,e,n,s) => {
        const zzRaw = String(z || '').trim().toUpperCase();
        const zz = /^ALM(?:ACEN)?$/.test(zzRaw) ? 'ALM' : zzRaw;
        const ee = String(e || '').trim().toUpperCase();
        const nn = String(n || '').trim().toUpperCase();
        const ss = String(s || '').trim().toUpperCase();
        const parts = [zz, ee, nn, ss].filter(Boolean);
        if (!parts.length) return '';
        return parts.join('-');
      };

      const normalizeLocationString = normalizeLocationCode;

      const parseLoc = (txt, fallbackRack='Z1-E1') => {
        const parsed = parseLocationCode(txt, fallbackRack);
        return { raw: parsed.raw, rack: parsed.rackId, zona: parsed.zoneId, nivel: parsed.level, slot: parsed.slot };
      };

      const dataRows = rowValues.slice(headerRowIndex + 1);
      const parsed = dataRows.map((vals, dataIndex) => {
        const sku = val(vals, iSKU);
        const nombre = val(vals, iNombre);
        const variante = val(vals, iVar);
        const barras = val(vals, iBarras);
        const imagen = val(vals, iImagen);
        const talla = val(vals, iTalla);
        const color = val(vals, iColor);

        // Prioridad total a columnas fusionadas Ubiccaion y Alamacen
        let ubicacion = normalizeLocationString(val(vals, iUb));
        let almacen = normalizeLocationString(val(vals, iAlm));

        if (!ubicacion){
          ubicacion = buildLocation(val(vals, mainZona), val(vals, mainEst), val(vals, mainNiv), val(vals, mainSlot));
        }
        if (!almacen){
          almacen = buildLocation(val(vals, storeZona), val(vals, storeEst), val(vals, storeNiv), val(vals, storeSlot));
        }

        const main = parseLoc(ubicacion, 'Z1-E1');
        const store = parseLoc(almacen, 'ALM-E1');

        return {
          sku,
          barras,
          nombre,
          variante,
          imagen,
          imagen2,
          talla,
          color,
          ubicacion: main.raw || ubicacion,
          almacen: store.raw || almacen,
          rack: main.rack,
          rackStore: store.rack,
          zona: main.zona,
          zonaStore: store.zona,
          nivel: main.nivel,
          slot: main.slot,
          nivelStore: store.nivel,
          slotStore: store.slot,
          _rowIndex: headerRowIndex + 1 + dataIndex
        };
      }).filter(x => x.sku || x.nombre || x.barras);

      if(parsed.length){
        appState.products = parsed;
        appState.filtered = parsed;
        appState.sheetConfig.lastMode = 'google';
        syncBranchLayoutWithProducts(getActiveLayoutBranchIndex(), parsed);
        sheetStatusChip.textContent = `${parsed.length.toLocaleString('es-PE')} filas`;
        contentStatus.textContent = `Sheet vinculado. Encabezados detectados en fila ${headerRowIndex + 1}. Columnas: SKU ${iSKU+1}, Nombre ${iNombre+1}, Variante ${iVar+1}, Ubicación ${iUb+1}, Almacén ${iAlm+1}. Layout sincronizado por niveles/slots.`;
        selectProduct(parsed[0]);
        renderProducts(parsed);
        renderCurrentScreen();
      } else {
        throw new Error('No se encontraron filas útiles.');
      }
    } catch (err) {
      console.error(err);
      sheetStatusChip.textContent = 'Error de lectura';
      contentStatus.textContent = 'No se pudo leer la hoja. Verifica permisos, URL, fila de encabezados y nombre de hoja.';
      alert('No se pudo leer el Google Sheet. Verifica que esté compartido y que el nombre de hoja sea correcto.');
    }
  }




  function loadBranchLayouts(){
    try{
      const raw = localStorage.getItem('wms_branch_layouts_v2');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch{ return {}; }
  }
  function saveBranchLayouts(){
    try{ localStorage.setItem('wms_branch_layouts_v2', JSON.stringify(appState.branchLayouts||{})); }catch{}
  }
  function getBranchColor(index){
    return (appState.admin?.branches?.[index]?.color) || DEFAULT_ZONE_COLOR;
  }
  function makeRectZone(id,name,color,x,y,w,h){
    const safeName = name || (String(id).toUpperCase() === 'ALM' ? 'Almacén' : `Zona ${id}`);
    return { id, name:safeName, color: color || DEFAULT_ZONE_COLOR, pts:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}], sectionCuts:{ x:{pos:.5,dir:1,depth:100}, y:{pos:.5,dir:1,depth:100} } };
  }
  function buildDefaultLayoutForBranch(branchIndex){
    const branch = (appState.admin?.branches||[])[branchIndex] || {};
    const zoneId = 'Z1';
    const zoneName = branch.name ? `Zona ${zoneId}` : `Zona ${zoneId}`;
    const zx = 90, zy = 80, zw = DEFAULT_ZONE_SIZE.w, zh = DEFAULT_ZONE_SIZE.h;
    const zone = makeRectZone(zoneId, zoneName, getBranchColor(branchIndex), zx, zy, zw, zh);
    const gap = 0, rackW = 84, rackH = 46;
    const startX = zx + 40;
    const y = zy + 26;
    const racks = Array.from({length:4}, (_,i)=>({
      id:`${zoneId}-E${i+1}`,
      zoneId,
      x:startX + i*(rackW+gap),
      y,
      w:rackW,
      h:rackH,
      rot:0,
      modelId:i===2?'wide_5':'std_4',
      front:'auto',
      baseHeight:0,
      rackHeight:rackModel(i===2?'wide_5':'std_4').height || 240
    }));
    racks.forEach(r=>syncRackFootprint(r,false));
    return { zones:[zone], racks, meta:{ createdAt: Date.now(), scaleCmPerUnit: 1 } };
  }
  function ensureBranchLayouts(){
    const branches = appState.admin?.branches || [];
    if(!appState.branchLayouts || typeof appState.branchLayouts !== 'object') appState.branchLayouts = {};
    branches.forEach((_,i)=>{
      if(!appState.branchLayouts[i] || !Array.isArray(appState.branchLayouts[i].zones) || !Array.isArray(appState.branchLayouts[i].racks)){
        appState.branchLayouts[i] = buildDefaultLayoutForBranch(i);
      }
    });
    Object.keys(appState.branchLayouts).forEach(k=>{ if(Number(k) >= branches.length) delete appState.branchLayouts[k]; });
    normalizeLayoutSectionState();
    saveBranchLayouts();
  }
  function getActiveLayoutBranchIndex(){
    return Number.isFinite(appState.activeLayoutBranchIndex) ? appState.activeLayoutBranchIndex : (Number.isFinite(appState.activeBranchIndex) ? appState.activeBranchIndex : 0);
  }
  function ensureZoneSectionCuts(zone){
    if(!zone) return { x:{pos:.5,dir:1,range:1}, y:{pos:.5,dir:1,range:1} };
    if(!zone.sectionCuts || typeof zone.sectionCuts !== 'object') zone.sectionCuts = {};
    if(!zone.sectionCuts.x) zone.sectionCuts.x = { pos:.5, dir:1, depth:100 };
    if(!zone.sectionCuts.y) zone.sectionCuts.y = { pos:.5, dir:1, depth:100 };
    zone.sectionCuts.x.pos = Math.max(.06, Math.min(.94, Number(zone.sectionCuts.x.pos) || .5));
    zone.sectionCuts.y.pos = Math.max(.06, Math.min(.94, Number(zone.sectionCuts.y.pos) || .5));
    zone.sectionCuts.x.dir = zone.sectionCuts.x.dir === -1 ? -1 : 1;
    zone.sectionCuts.y.dir = zone.sectionCuts.y.dir === -1 ? -1 : 1;
    const bounds = zoneBounds(zone);
    const maxDepthX = Math.max(1, bounds.maxX - bounds.minX);
    const maxDepthY = Math.max(1, bounds.maxY - bounds.minY);
    const oldRangeX = Number(zone.sectionCuts.x.range);
    const oldRangeY = Number(zone.sectionCuts.y.range);
    const baseDepthX = Number(zone.sectionCuts.x.depth);
    const baseDepthY = Number(zone.sectionCuts.y.depth);
    zone.sectionCuts.x.depth = Math.max(Math.min(100, maxDepthX), Math.min(maxDepthX, Number.isFinite(baseDepthX) ? (baseDepthX <= 10 ? 100 : baseDepthX) : (Number.isFinite(oldRangeX) ? maxDepthX * oldRangeX : 100)));
    zone.sectionCuts.y.depth = Math.max(Math.min(100, maxDepthY), Math.min(maxDepthY, Number.isFinite(baseDepthY) ? (baseDepthY <= 10 ? 100 : baseDepthY) : (Number.isFinite(oldRangeY) ? maxDepthY * oldRangeY : 100)));
    delete zone.sectionCuts.x.range;
    delete zone.sectionCuts.y.range;
    return zone.sectionCuts;
  }
  function normalizeLayoutSectionState(){
    (appState.layout?.zones || []).forEach(zone => ensureZoneSectionCuts(zone));
  }
  function persistActiveLayout(){
    const idx = getActiveLayoutBranchIndex();
    if(!appState.branchLayouts) appState.branchLayouts = {};
    normalizeLayoutSectionState();
    ensureLayoutMeta();
    appState.branchLayouts[idx] = clone(appState.layout);
    saveBranchLayouts();
  }
  function loadLayoutForBranch(branchIndex){
    ensureBranchLayouts();
    const source = appState.branchLayouts[branchIndex] || buildDefaultLayoutForBranch(branchIndex);
    appState.layout = clone(source);
    ensureLayoutMeta();
    appState.activeLayoutBranchIndex = branchIndex;
    appState.selectedZoneId = appState.layout.zones[0]?.id || '';
    appState.selectedRackLayoutId = appState.layout.racks[0]?.id || '';
    appState.selectedVertex = { zoneId:'', idx:-1 };
    appState.selectedEdge = { zoneId:'', a:-1, b:-1 };
    appState.editor.dragging = null;
    appState.editor.mode = 'select';
    ensureRackProps();
  }
  function setLayoutBranch(branchIndex){
    persistActiveLayout();
    loadLayoutForBranch(branchIndex);
  }
  function zoneBounds(zone){
    const xs = zone.pts.map(p=>p.x), ys = zone.pts.map(p=>p.y);
    return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
  }
  function nearestZoneForPoint(point){
    const zones = appState.layout.zones || [];
    let best = null, bestDist = Infinity;
    zones.forEach(z=>{
      const c = centroid(z.pts); const d = dist2(point,c); if(d<bestDist){ best=z; bestDist=d; }
    });
    return best;
  }
  function keepRackInsideZone(rack, zone){
    const fp = getRackFootprint(rack.modelId, rack.rot || 0);
    const b = zoneBounds(zone);
    const margin = 0;
    const effW = Math.max(0, Number(rack.w || fp.w || fp.baseW || 0));
    const effH = Math.max(0, Number(rack.h || fp.h || fp.baseH || 0));
    const minX = b.minX + margin, maxX = b.maxX - effW - margin;
    const minY = b.minY + margin, maxY = b.maxY - effH - margin;
    rack.x = Math.max(minX, Math.min(maxX, rack.x));
    rack.y = Math.max(minY, Math.min(maxY, rack.y));
    if(rackFullyInsideZone(rack, zone)) return;
    const original = { x:rack.x, y:rack.y };
    for(let step=0; step<=48; step+=4){
      const candidates = [
        { x:original.x-step, y:original.y }, { x:original.x+step, y:original.y },
        { x:original.x, y:original.y-step }, { x:original.x, y:original.y+step },
        { x:original.x-step, y:original.y-step }, { x:original.x+step, y:original.y+step }
      ];
      const found = candidates.find(pos => { rack.x = pos.x; rack.y = pos.y; return rackFullyInsideZone(rack, zone); });
      if(found) return;
    }
    rack.x = original.x; rack.y = original.y;
  }
  function snapRackToZoneEdges(rack, zone, threshold = 28){
    if(!rack || !zone) return;
    const bounds = zoneBounds(zone);
    const edges = [];
    for(let i=0;i<zone.pts.length;i++){
      const a = zone.pts[i], b = zone.pts[(i+1)%zone.pts.length];
      if(Math.abs(a.x - b.x) <= 0.001) edges.push({type:'v', value:a.x, min:Math.min(a.y,b.y), max:Math.max(a.y,b.y)});
      else if(Math.abs(a.y - b.y) <= 0.001) edges.push({type:'h', value:a.y, min:Math.min(a.x,b.x), max:Math.max(a.x,b.x)});
    }
    let bestX = null, bestDX = Infinity;
    let bestY = null, bestDY = Infinity;
    const rackMidY = rack.y + rack.h/2;
    const rackMidX = rack.x + rack.w/2;
    edges.forEach(edge => {
      if(edge.type === 'v' && rackMidY >= edge.min-8 && rackMidY <= edge.max+8){
        const leftTarget = edge.value;
        const rightTarget = edge.value - rack.w;
        const dLeft = Math.abs(rack.x - leftTarget);
        const dRight = Math.abs(rack.x - rightTarget);
        if(dLeft < bestDX && dLeft <= threshold){ bestDX = dLeft; bestX = leftTarget; }
        if(dRight < bestDX && dRight <= threshold){ bestDX = dRight; bestX = rightTarget; }
      }
      if(edge.type === 'h' && rackMidX >= edge.min-8 && rackMidX <= edge.max+8){
        const topTarget = edge.value;
        const bottomTarget = edge.value - rack.h;
        const dTop = Math.abs(rack.y - topTarget);
        const dBottom = Math.abs(rack.y - bottomTarget);
        if(dTop < bestDY && dTop <= threshold){ bestDY = dTop; bestY = topTarget; }
        if(dBottom < bestDY && dBottom <= threshold){ bestDY = dBottom; bestY = bottomTarget; }
      }
    });
    if(bestX === null){
      const boundLeft = Math.abs(rack.x - bounds.minX);
      const boundRight = Math.abs(rack.x - (bounds.maxX - rack.w));
      if(boundLeft <= threshold || boundRight <= threshold) bestX = boundLeft <= boundRight ? bounds.minX : (bounds.maxX - rack.w);
    }
    if(bestY === null){
      const boundTop = Math.abs(rack.y - bounds.minY);
      const boundBottom = Math.abs(rack.y - (bounds.maxY - rack.h));
      if(boundTop <= threshold || boundBottom <= threshold) bestY = boundTop <= boundBottom ? bounds.minY : (bounds.maxY - rack.h);
    }
    if(bestX !== null) rack.x = bestX;
    if(bestY !== null) rack.y = bestY;
    rack.x = Math.max(bounds.minX, Math.min(bounds.maxX - rack.w, rack.x));
    rack.y = Math.max(bounds.minY, Math.min(bounds.maxY - rack.h, rack.y));
  }
  function rangesOverlap(a1, a2, b1, b2, tolerance = 4){
    return Math.min(a2, b2) >= Math.max(a1, b1) - tolerance;
  }
  function rackBox(rack){
    return { left:rack.x, right:rack.x + rack.w, top:rack.y, bottom:rack.y + rack.h, width:rack.w, height:rack.h };
  }
  function getRackLevelValue(rack){
    if(!rack) return 0;
    if(Number.isFinite(Number(rack.stackLevel))) return Math.max(0, Math.round(Number(rack.stackLevel) || 0));
    const rackHeight = Math.max(60, Number(rack.rackHeight || rackModel(rack.modelId).height || 240) || 240);
    const base = Math.max(0, Number(rack.baseHeight || 0) || 0);
    return Math.max(0, Math.round(base / rackHeight));
  }
  function syncRackStackMetrics(rack, preserveBaseHeight=false){
    if(!rack) return;
    const rackHeight = Math.max(60, Number(rack.rackHeight || rackModel(rack.modelId).height || 240) || 240);
    const level = Math.max(0, Math.round(Number(rack.stackLevel || 0) || 0));
    rack.stackLevel = level;
    if(!preserveBaseHeight || !Number.isFinite(Number(rack.baseHeight))) rack.baseHeight = level * rackHeight;
    rack.baseHeight = Math.max(0, Number(rack.baseHeight || 0) || 0);
  }
  function getRackVerticalBase(rack){
    if(!rack) return 0;
    const rackHeight = Math.max(60, Number(rack.rackHeight || rackModel(rack.modelId).height || 240) || 240);
    const level = getRackLevelValue(rack);
    return Math.max(Math.round(Number(rack.baseHeight || 0) || 0), level * rackHeight);
  }
  function rectsOverlap(a, b, tolerance = 0.001){
    return a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
  }
  function resolveRackOverlap(rack, zone){
    if(!rack || !zone) return;
    const neighbors = (appState.layout.racks || []).filter(r => r !== rack && r.zoneId === zone.id && getRackLevelValue(r) === getRackLevelValue(rack));
    let moved = false;
    neighbors.forEach(other => {
      const a = rackBox(rack), b = rackBox(other);
      if(!rectsOverlap(a, b)) return;
      const pushLeft = Math.abs(a.right - b.left);
      const pushRight = Math.abs(b.right - a.left);
      const pushUp = Math.abs(a.bottom - b.top);
      const pushDown = Math.abs(b.bottom - a.top);
      const candidates = [
        { axis:'x', value: other.x - rack.w, d: pushLeft },
        { axis:'x', value: other.x + other.w, d: pushRight },
        { axis:'y', value: other.y - rack.h, d: pushUp },
        { axis:'y', value: other.y + other.h, d: pushDown },
      ].sort((m,n)=>m.d-n.d);
      const pick = candidates[0];
      if(!pick) return;
      if(pick.axis === 'x') rack.x = pick.value;
      else rack.y = pick.value;
      moved = true;
    });
    return moved;
  }
  function snapRackToNeighbors(rack, zone, threshold = 18){
    if(!rack || !zone) return;
    const neighbors = (appState.layout.racks || []).filter(r => r !== rack && r.zoneId === zone.id && getRackLevelValue(r) === getRackLevelValue(rack));
    let bestX = null, bestDX = Infinity;
    let bestY = null, bestDY = Infinity;
    const a = rackBox(rack);
    neighbors.forEach(other => {
      const b = rackBox(other);
      if(rangesOverlap(a.top, a.bottom, b.top, b.bottom, 0.001)){
        const targetRight = b.right;
        const targetLeft = b.left - a.width;
        const dAttachLeft = Math.abs(a.left - targetRight);
        const dAttachRight = Math.abs(a.left - targetLeft);
        if(dAttachLeft < bestDX && dAttachLeft <= threshold){ bestDX = dAttachLeft; bestX = targetRight; }
        if(dAttachRight < bestDX && dAttachRight <= threshold){ bestDX = dAttachRight; bestX = targetLeft; }
      }
      if(rangesOverlap(a.left, a.right, b.left, b.right, 0.001)){
        const targetBottom = b.bottom;
        const targetTop = b.top - a.height;
        const dAttachTop = Math.abs(a.top - targetBottom);
        const dAttachBottom = Math.abs(a.top - targetTop);
        if(dAttachTop < bestDY && dAttachTop <= threshold){ bestDY = dAttachTop; bestY = targetBottom; }
        if(dAttachBottom < bestDY && dAttachBottom <= threshold){ bestDY = dAttachBottom; bestY = targetTop; }
      }
    });
    if(bestX !== null) rack.x = bestX;
    if(bestY !== null) rack.y = bestY;
  }
  function keepRackSnapped(rack, zone){
    if(!rack || !zone) return;
    snapRackToZoneEdges(rack, zone);
    snapRackToNeighbors(rack, zone);
    resolveRackOverlap(rack, zone);
    keepRackInsideZone(rack, zone);
    snapRackToZoneEdges(rack, zone, 4);
    snapRackToNeighbors(rack, zone, 4);
  }
  function renameRackByZone(rack, zoneId, seq){
    rack.zoneId = zoneId;
    rack.id = `${zoneId}-E${seq}`;
  }
  function assignRackToZone(rack, zoneId){
    if(!rack || !zoneId) return;
    if(rack.zoneId === zoneId && String(rack.id||'').startsWith(`${zoneId}-E`)) return;
    rack.zoneId = zoneId;
    rack.id = nextRackId(zoneId);
  }
  function normalizeZoneAndRackIds(){
    const zones = appState.layout.zones || [];
    zones.forEach((z, zi)=>{
      if(!/^Z\d+$/i.test(String(z.id||''))) z.id = `Z${zi+1}`;
      if(!z.name) z.name = `Zona ${z.id}`;
    });
    (appState.layout.racks||[]).forEach(r=>{
      if(!r) return;
      const fallbackW = Math.max(0, Number(r.w || 0));
      const fallbackH = Math.max(0, Number(r.h || 0));
      const anchorX = Number(r.x || 0);
      const anchorY = Number(r.y || 0);
      syncRackStackMetrics(r, false);
      syncRackFootprint(r, false);
      if(!Number.isFinite(Number(r.x))) r.x = anchorX;
      if(!Number.isFinite(Number(r.y))) r.y = anchorY;
      const probe = { x: anchorX + Math.max(r.w || 0, fallbackW) / 2, y: anchorY + Math.max(r.h || 0, fallbackH) / 2 };
      const host = findZoneById(r.zoneId) || zones.find(z => pointInPoly(probe, z.pts));
      if(host){
        if(r.zoneId !== host.id) assignRackToZone(r, host.id);
        keepRackSnapped(r, host);
      }
    });
  }
  function renameZoneId(current, requested){
    const zone = findZoneById(current); if(!zone) return current;
    let target = String(requested||'').trim().toUpperCase().replace(/\s+/g,'');
    if(!target) target = current;
    if(!/^Z\d+$/.test(target)){
      const num = parseInt((target.match(/(\d+)/)||[])[1] || '0',10);
      target = `Z${num || (appState.layout.zones.indexOf(zone)+1)}`;
    }
    if(target !== current && appState.layout.zones.some(z=>z.id===target)) return current;
    zone.id = target;
    zone.name = zone.name || `Zona ${target}`;
    normalizeZoneAndRackIds();
    persistActiveLayout();
    return zone.id;
  }

  function zoneRackSequence(zoneId){
    return (appState.layout.racks||[]).filter(r => r.zoneId === zoneId).sort((a,b)=> (a.x-b.x) || (a.y-b.y) || String(a.id).localeCompare(String(b.id)));
  }
  function duplicateSelectedRack(){
    const rack = findRackById(appState.selectedRackLayoutId); if(!rack) return;
    const zone = findZoneById(rack.zoneId); if(!zone) return;
    const copy = clone(rack);
    copy.id = nextRackId(zone.id);
    copy.x = snapGrid(rack.x + rack.w + 12);
    copy.y = snapGrid(rack.y);
    keepRackSnapped(copy, zone);
    appState.layout.racks.push(copy);
    appState.selectedRackLayoutId = copy.id;
    persistActiveLayout();
    renderLayoutEditor();
  }
  function duplicateSelectedZone(){
    const zone = findZoneById(appState.selectedZoneId); if(!zone) return;
    const sourceRacks = (appState.layout.racks||[]).filter(r => r.zoneId === zone.id).sort((a,b)=> (a.x-b.x) || (a.y-b.y));
    const cloneZone = clone(zone);
    const newId = nextZoneId();
    cloneZone.id = newId;
    cloneZone.name = `${zone.name || ('Zona '+zone.id)} copia`;
    cloneZone.pts = cloneZone.pts.map(pt => ({ x:snapGrid(pt.x + 60), y:snapGrid(pt.y + 40) }));
    ensureZoneSectionCuts(cloneZone);
    appState.layout.zones.push(cloneZone);
    sourceRacks.forEach((rack, idx) => {
      const copy = clone(rack);
      copy.zoneId = newId;
      copy.id = `${newId}-E${idx+1}`;
      copy.x = snapGrid(rack.x + 60);
      copy.y = snapGrid(rack.y + 40);
      keepRackSnapped(copy, cloneZone);
      appState.layout.racks.push(copy);
    });
    appState.selectedZoneId = newId;
    appState.selectedRackLayoutId = appState.layout.racks.find(r => r.zoneId === newId)?.id || '';
    persistActiveLayout();
    renderLayoutEditor();
  }
  function drawArrowHead(layer, x, y, angle, color){
    const size = 6;
    const a1 = angle + Math.PI * 0.8;
    const a2 = angle - Math.PI * 0.8;
    layer.appendChild(svgEl('line',{x1:x,y1:y,x2:x + Math.cos(a1)*size,y2:y + Math.sin(a1)*size,stroke:color,'stroke-width':'1.2'}));
    layer.appendChild(svgEl('line',{x1:x,y1:y,x2:x + Math.cos(a2)*size,y2:y + Math.sin(a2)*size,stroke:color,'stroke-width':'1.2'}));
  }
  function drawRackMeasureLine(layer, x1,y1,x2,y2,label,color='#8fb7df', offset=0, formatter=formatDistanceCm, opts={}){
    const dx = x2-x1, dy = y2-y1;
    const len = Math.hypot(dx,dy) || 1;
    const settings = Object.assign({ showTextBox:false, textGap:10, dashed:true, normalOverride:null }, opts || {});
    let nx = -dy/len, ny = dx/len;
    if(settings.normalOverride && Number.isFinite(settings.normalOverride.x) && Number.isFinite(settings.normalOverride.y)){
      const nLen = Math.hypot(settings.normalOverride.x, settings.normalOverride.y) || 1;
      nx = settings.normalOverride.x / nLen;
      ny = settings.normalOverride.y / nLen;
    }
    const ax1 = x1 + nx*offset, ay1 = y1 + ny*offset;
    const ax2 = x2 + nx*offset, ay2 = y2 + ny*offset;
    layer.appendChild(svgEl('line',{
      x1:ax1,y1:ay1,x2:ax2,y2:ay2,stroke:color,'stroke-width':'1.4',
      ...(settings.dashed ? {'stroke-dasharray':'5 4'} : {}),opacity:'.98'
    }));
    layer.appendChild(svgEl('line',{x1:x1,y1:y1,x2:ax1,y2:ay1,stroke:color,'stroke-width':'1.1',opacity:'.78'}));
    layer.appendChild(svgEl('line',{x1:x2,y1:y2,x2:ax2,y2:ay2,stroke:color,'stroke-width':'1.1',opacity:'.78'}));
    const ang = Math.atan2(ay2-ay1, ax2-ax1);
    drawArrowHead(layer, ax1, ay1, ang, color);
    drawArrowHead(layer, ax2, ay2, ang + Math.PI, color);
    const tx = (ax1+ax2)/2 + nx*settings.textGap;
    const ty = (ay1+ay2)/2 + ny*settings.textGap;
    const textValue = typeof formatter === 'function' ? formatter(label) : String(Math.round(label));
    const text = svgEl('text',{x:tx,y:ty+1,class:'ortho-dim-text','text-anchor':'middle'});
    text.textContent = textValue;
    const angDeg = ang*180/Math.PI + (Math.abs(ang) > Math.PI/2 ? 180 : 0);
    text.setAttribute('transform',`rotate(${angDeg} ${tx} ${ty+1})`);
    if(settings.showTextBox){
      const bgW = Math.max(56, Math.min(120, textValue.length * 7.2 + 18));
      const bg = svgEl('rect',{x:tx-bgW/2,y:ty-12,width:bgW,height:18,rx:'6',fill:'rgba(8,18,30,.92)',stroke:color,'stroke-width':'1'});
      bg.setAttribute('transform',`rotate(${angDeg} ${tx} ${ty+1})`);
      layer.appendChild(bg);
    }
    layer.appendChild(text);
  }
  function drawZoneEdgeDimensions(layer, zone){
    if(!layer || !zone || !appState.editor.showDims) return;
    const ctr = polygonCentroid(zone.pts);
    zone.pts.forEach((a, i) => {
      const b = zone.pts[(i+1)%zone.pts.length];
      const dx = b.x-a.x, dy = b.y-a.y;
      const len = Math.hypot(dx,dy) || 1;
      let nx = -dy/len, ny = dx/len;
      const mid = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
      const testA = { x:mid.x + nx*18, y:mid.y + ny*18 };
      const testB = { x:mid.x - nx*18, y:mid.y - ny*18 };
      const distA = Math.hypot(testA.x - ctr.x, testA.y - ctr.y);
      const distB = Math.hypot(testB.x - ctr.x, testB.y - ctr.y);
      const insideA = pointInPoly(testA, zone.pts);
      const insideB = pointInPoly(testB, zone.pts);
      if((insideA && !insideB) || (distA < distB)) { nx *= -1; ny *= -1; }
      const offsetMag = 28 + ((i % 2) * 14);
      const outsideProbe = { x:mid.x + nx*offsetMag, y:mid.y + ny*offsetMag };
      if(pointInPoly(outsideProbe, zone.pts)) { nx *= -1; ny *= -1; }
      drawRackMeasureLine(layer, a.x, a.y, b.x, b.y, len, '#f6d365', offsetMag, formatDistanceCm, {
        showTextBox:false,
        textGap:12,
        dashed:true,
        normalOverride:{ x:nx, y:ny }
      });
    });
  }
  function drawSelectedRackMeasurements(layer, rack, zone){
    if(!layer || !rack || !zone || !appState.editor.showDims) return;
    const cx = rack.x + rack.w/2;
    const cy = rack.y + rack.h/2;
    const geomW = Math.max(8, rack.w || 0);
    const geomH = Math.max(8, rack.h || 0);
    const angle = normalizeAngle(rack.rot || 0) * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const labels = [
      { text:`${Math.round(geomW)} cm`, lx:0, ly:-(geomH / 2) - 10 },
      { text:`${Math.round(geomH)} cm`, lx:(geomW / 2) + 12, ly:0 }
    ];
    labels.forEach(item => {
      const tx = cx + (item.lx * cos - item.ly * sin);
      const ty = cy + (item.lx * sin + item.ly * cos);
      const text = svgEl('text',{
        x:tx,
        y:ty,
        class:'ortho-dim-text',
        'text-anchor':'middle',
        'dominant-baseline':'middle',
        transform:`rotate(${-normalizeAngle(rack.rot || 0)} ${tx} ${ty})`
      });
      text.textContent = item.text;
      layer.appendChild(text);
    });
  }
  function drawSelectedZoneMeasurements(layer, zone){
    if(!layer || !zone) return;
    drawZoneEdgeDimensions(layer, zone);
  }

  function loadAdminState(){
    try{ const raw = localStorage.getItem('wms_admin_cfg_v2'); if(raw) return JSON.parse(raw); }catch{}
    return { company:'WMS Industrial', logo:'', branches:[{name:'Sucursal principal', type:'tienda', color:'#f5a623', warehouses:['Almacén principal'], sheetUrl:'', sheetName:'Productos', sheetConnected:false, lastSheetCount:0}], activeBranch:0 };
  }
  function saveAdminState(){ localStorage.setItem('wms_admin_cfg_v2', JSON.stringify(appState.admin)); ensureBranchLayouts(); saveBranchLayouts(); applyBrand(); }
  function applyBrand(){
    const brandTitle = document.querySelector('.brand-text b'); if(brandTitle) brandTitle.textContent = appState.admin.company || 'WMS Industrial';
    const brandSub = document.querySelector('.brand-text div'); if(brandSub) brandSub.textContent = 'WAREHOUSE';
    const box = document.querySelector('.brand-box');
    if(box){ box.innerHTML = appState.admin.logo ? `<img src="${appState.admin.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : 'W'; }
  }
  function renderAdminScreen(){
    const cfg = appState.admin; if(cfg.activeBranch >= cfg.branches.length) cfg.activeBranch = 0;
    const summaryBranches = cfg.branches.length, summaryWarehouses = cfg.branches.reduce((a,b)=>a+(b.warehouses?.length||0),0);
    contentTitle.textContent = 'Configuración de Empresa'; contentSubtitle.textContent = 'Administrador'; setTags([]);
    detailTitle.textContent='Resumen'; detailSubtitle.textContent='Configuración general';
    detailWrap.innerHTML = `<div class="kv"><div class="kv-row"><b>Sucursales</b><span>${summaryBranches}</span></div><div class="kv-row"><b>Total almacenes</b><span>${summaryWarehouses}</span></div></div>`;
    detailStatus.textContent='Empresa'; detailChip.textContent='config';
    contentWrap.innerHTML = `
      <div class="form-wrap admin-company-screen">
        <style>
          .admin-company-screen{display:flex;flex-direction:column;height:100%;min-height:0}.company-head{display:grid;gap:18px;padding:10px 4px 16px}.company-logo-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border-radius:14px;background:linear-gradient(135deg,#408A71,#285A48);border:1px solid rgba(176,228,204,.20);color:#fff;font-weight:700;cursor:pointer;width:max-content}.branches-panel{display:flex;flex-direction:column;min-height:0;flex:1;border:1px solid rgba(64,138,113,.22);background:var(--panel-3);border-radius:18px;overflow:hidden}.branches-toolbar{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(64,138,113,.18);background:linear-gradient(180deg, rgba(64,138,113,.10), rgba(64,138,113,.04))}.branches-scroll{overflow:auto;max-height:430px;padding:14px;display:flex;flex-direction:column;gap:12px}.branch-card{border:1px solid rgba(64,138,113,.22);background:var(--panel-2);border-radius:16px;padding:12px}.branch-card.collapsed .branch-body{display:none}.branch-head{display:grid;grid-template-columns:24px 1fr 120px 44px 44px 44px;gap:10px;align-items:center}.branch-head input,.branch-body input,.branch-body select{background:var(--panel);border:1px solid rgba(64,138,113,.22);color:var(--text);border-radius:12px;padding:10px 12px;width:100%}.branch-body{margin-top:12px;padding-top:12px;border-top:1px solid rgba(64,138,113,.15);display:grid;gap:10px}.ware-row{display:grid;grid-template-columns:1fr 36px;gap:8px;align-items:center}.tiny-btn{height:36px;border:none;border-radius:12px;background:#285A48;color:#fff;cursor:pointer;font-weight:800}.tiny-btn.danger{background:#7d4747;color:#ffe5e5}.save-stick{position:sticky;bottom:0;padding:14px 0 6px;background:linear-gradient(180deg, rgba(255,255,255,0), rgba(53,60,59,.08) 24%, rgba(53,60,59,.18))}
        
  .sheet-branch-list{display:grid;gap:14px;height:100%;align-content:start;}
  .sheet-branch-card{background:linear-gradient(180deg,#1f3a32,#183129);border:1px solid #3f6d60;border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.18);}
  .sheet-branch-head{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;background:rgba(255,255,255,.02);}
  .sheet-branch-head:hover{background:rgba(255,255,255,.04);}
  .sheet-branch-dot{width:14px;height:14px;border-radius:999px;flex:0 0 14px;border:2px solid rgba(255,255,255,.28);}
  .sheet-branch-meta{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;}
  .status-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid #33506f;background:#10263c;color:#cfe0f3;}
  .status-badge.ok{background:rgba(17,194,141,.14);border-color:rgba(17,194,141,.38);color:#9ff0d3;}
  .status-badge.warn{background:rgba(245,166,35,.14);border-color:rgba(245,166,35,.35);color:#ffdca2;}
  .sheet-branch-body{padding:0 16px 16px;display:none;border-top:1px solid rgba(255,255,255,.06);}
  .sheet-branch-card.open .sheet-branch-body{display:block;}
  .sheet-branch-grid{display:grid;grid-template-columns:1fr 240px;gap:14px;margin-top:14px;}
  .sheet-branch-grid .grid{margin-bottom:0;}
  .sheet-mini-preview{margin-top:14px;border:1px dashed #33506f;border-radius:14px;padding:12px;background:#0f1d30;}
  .sheet-preview-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}
  .sheet-preview-chip{padding:6px 10px;border-radius:999px;background:#173250;border:1px solid #355072;color:#d7e4ef;font-size:12px;}
  .sheet-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}
  @media (max-width: 980px){ .sheet-branch-grid{grid-template-columns:1fr;} }


  .model-inline-grid-2,.model-inline-grid-4{ display:grid; gap:10px; }
  .model-inline-grid-2{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .model-inline-grid-4{ grid-template-columns:repeat(4,minmax(0,1fr)); }
  .library-inline-actions-box{ display:flex; align-items:flex-end; }
  .library-inline-actions-box .mini-btn{ width:100%; }
  .library-levels-panel{ display:none; margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,.08); }
  .library-levels-panel.open{ display:block; }
  .embedded-level-list{ display:grid; gap:8px; }
  .level-row.compact{ grid-template-columns:90px minmax(220px,.9fr) minmax(120px,.45fr); }
  .rack-library-editor-block{ min-height:0; }
  @media (max-width: 1200px){ .model-inline-grid-4{ grid-template-columns:repeat(2,minmax(0,1fr)); } }


  .dashboard-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px;align-content:start;}
  .dashboard-card{background:linear-gradient(180deg,#243836,#1c2f2d);border:1px solid #3f6d60;border-radius:18px;padding:16px;box-shadow:0 10px 24px rgba(0,0,0,.18);min-height:0;}
  .dashboard-card h4{margin:0 0 6px;font-size:15px;color:#eef5ff;}
  .dashboard-card .tiny{display:block;}
  .kpi-card{grid-column:span 3;display:grid;gap:10px;}
  .kpi-card b{font-size:30px;line-height:1;color:#fff;}
  .kpi-foot{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#a9bfd6;font-size:12px;}
  .kpi-trend{padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.08);font-weight:700;font-size:11px;}
  .kpi-trend.up{color:#9ff0d3;background:rgba(17,194,141,.14);border-color:rgba(17,194,141,.38);}
  .kpi-trend.warn{color:#ffdca2;background:rgba(245,166,35,.14);border-color:rgba(245,166,35,.35);}
  .kpi-trend.down{color:#ffb3b3;background:rgba(227,94,94,.14);border-color:rgba(227,94,94,.35);}
  .dashboard-card.wide{grid-column:span 6;}
  .dashboard-card.full{grid-column:1/-1;}
  .dashboard-card.tall{min-height:320px;}
  .dash-zone-grid,.dash-top-list,.dash-alert-list{display:grid;gap:10px;}
  .dash-zone-card,.dash-top-item{width:100%;text-align:left;background:#1d342f;border:1px solid #3f6d60;border-radius:14px;padding:12px;color:#eef8f4;cursor:pointer;transition:.18s ease;}
  .dash-zone-card:hover,.dash-top-item:hover{transform:translateY(-1px);border-color:#5ea28a;background:#13293f;}
  .dash-zone-card.active,.dash-top-item.active{border-color:#B0E4CC;box-shadow:0 0 0 1px rgba(107,181,255,.28) inset;background:#23453d;}
  .dash-progress-head,.dash-top-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;}
  .dash-mini-kv,.dash-top-meta{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:8px;font-size:12px;color:#b8d5cb;}
  .dash-bar{height:10px;border-radius:999px;background:#253332;border:1px solid rgba(255,255,255,.06);overflow:hidden;}
  .dash-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#58d68d,#B0E4CC);}
  .dash-bar.warn span{background:linear-gradient(90deg,#f5b041,#f39c12);}
  .dash-bar.down span{background:linear-gradient(90deg,#ec7063,#cb4335);}
  .dash-detail-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;align-items:stretch;}
  .dash-svg-wrap{background:#253332;border:1px solid #3f6d60;border-radius:16px;padding:10px;min-height:340px;display:flex;align-items:center;justify-content:center;}
  .dash-svg-wrap svg{width:100%;height:100%;min-height:300px;display:block;}
  .dash-alert-item{padding:12px;border-radius:14px;border:1px solid #3f6d60;background:#1d342f;display:grid;gap:6px;}
  .dash-alert-item.good{border-color:rgba(17,194,141,.38);background:rgba(17,194,141,.10);}
  .dash-alert-item.warn{border-color:rgba(245,166,35,.35);background:rgba(245,166,35,.10);}
  .dash-alert-item.down{border-color:rgba(227,94,94,.35);background:rgba(227,94,94,.10);}
  @media (max-width:1200px){.kpi-card,.dashboard-card.wide{grid-column:span 6;}.dash-detail-grid{grid-template-columns:1fr;}}
  @media (max-width:860px){.dashboard-grid{grid-template-columns:1fr;}.kpi-card,.dashboard-card.wide,.dashboard-card.full{grid-column:1/-1;}}




          .company-logo-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 16px;border-radius:14px;background:linear-gradient(135deg,#408A71,#285A48);border:1px solid rgba(176,228,204,.20);color:#fff;font-weight:700;cursor:pointer;width:max-content}
          .branches-panel{display:flex;flex-direction:column;min-height:0;flex:1;border:1px solid rgba(64,138,113,.22);background:var(--panel-3);border-radius:18px;overflow:hidden}
          .branches-toolbar{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(64,138,113,.18);background:linear-gradient(180deg, rgba(64,138,113,.10), rgba(64,138,113,.04))}
          .branches-scroll{overflow:auto;max-height:430px;padding:14px;display:flex;flex-direction:column;gap:12px}
          .branch-card{border:1px solid rgba(64,138,113,.22);background:var(--panel-2);border-radius:16px;padding:12px}
          .branch-card.collapsed .branch-body{display:none}
          .branch-head{display:grid;grid-template-columns:24px 1fr 120px 44px 44px 44px;gap:10px;align-items:center}
          .branch-head input,.branch-body input,.branch-body select{background:var(--panel);border:1px solid rgba(64,138,113,.22);color:var(--text);border-radius:12px;padding:10px 12px;width:100%}
          .branch-body{margin-top:12px;padding-top:12px;border-top:1px solid rgba(64,138,113,.15);display:grid;gap:10px}
          .ware-row{display:grid;grid-template-columns:1fr 36px;gap:8px;align-items:center}
          .tiny-btn{height:36px;border:none;border-radius:12px;background:#285A48;color:#fff;cursor:pointer;font-weight:800}
          .tiny-btn.danger{background:#7d4747;color:#ffe5e5}
          .save-stick{position:sticky;bottom:0;padding:14px 0 6px;background:linear-gradient(180deg, rgba(255,255,255,0), rgba(53,60,59,.08) 24%, rgba(53,60,59,.18))}
          body.theme-light .company-logo-btn{background:linear-gradient(135deg,#408A71,#285A48)}
          body.theme-light .branches-panel{background:#edf7f2;border-color:rgba(64,138,113,.18)}
          body.theme-light .branch-card{background:#e8f5ef;border-color:rgba(64,138,113,.18)}
          body.theme-light .branch-head input,body.theme-light .branch-body input,body.theme-light .branch-body select{background:#ffffff;border-color:rgba(64,138,113,.18)}
          body.theme-light .save-stick{background:linear-gradient(180deg, rgba(255,255,255,0), rgba(237,247,242,.9) 24%, rgba(237,247,242,1))}
        </style>
        <div class="company-head">
          <div class="grid"><label>Nombre de la Empresa</label><input id="companyNameInput" value="${escapeHtml(cfg.company)}"></div>
          <div class="grid"><label>Logo</label><div><input type="file" id="companyLogoInput" accept="image/*" style="display:none"><button class="company-logo-btn" id="companyLogoBtn">⤴ Subir logo</button></div></div>
        </div>
        <div class="branches-panel"><div class="branches-toolbar"><div><b>Sucursales</b></div><button class="btn secondary" id="addBranchBtn">＋ Sucursal</button></div><div class="branches-scroll" id="branchesScroll">${cfg.branches.map((b,i)=>renderBranchCard(b,i)).join('')}</div></div>
        <div class="save-stick"><button class="btn primary" id="saveCompanyBtn">Guardar Configuración</button></div>
      </div>`;
    bindAdminScreenEvents();
  }
  function renderBranchCard(branch,index){ return `<div class="branch-card${index!==appState.admin.activeBranch?' collapsed':''}" data-branch-card="${index}"><div class="branch-head"><button class="tiny-btn" data-action="toggle-branch" data-index="${index}">${index===appState.admin.activeBranch?'−':'+'}</button><input data-field="branch-name" data-index="${index}" value="${escapeHtml(branch.name)}"><input type="color" data-field="branch-color" data-index="${index}" value="${escapeHtml(branch.color||'#f5a623')}" title="Color identificador" class="company-color-circle"><button class="tiny-btn" data-action="move-up" data-index="${index}">↑</button><button class="tiny-btn" data-action="move-down" data-index="${index}">↓</button><button class="tiny-btn danger" data-action="delete-branch" data-index="${index}">🗑</button></div><div class="branch-body"><div><label class="tiny muted">Tipo</label><select data-field="branch-type" data-index="${index}"><option value="tienda" ${branch.type==='tienda'?'selected':''}>Tienda</option><option value="almacen" ${branch.type==='almacen'?'selected':''}>Almacén</option><option value="showroom" ${branch.type==='showroom'?'selected':''}>Showroom</option></select></div><div class="grid"><label class="tiny muted">Almacenes</label><div style="display:grid;gap:8px">${(branch.warehouses||[]).map((w,wi)=>`<div class="ware-row"><input data-field="warehouse-name" data-bindex="${index}" data-windex="${wi}" value="${escapeHtml(w)}"><button class="tiny-btn danger" data-action="delete-warehouse" data-bindex="${index}" data-windex="${wi}">🗑</button></div>`).join('')}</div></div><button class="tiny-btn" data-action="add-warehouse" data-index="${index}">＋ Almacén</button></div></div>`; }
  function bindAdminScreenEvents(){
    $('#companyNameInput').addEventListener('input', e=>appState.admin.company=e.target.value); $('#companyLogoBtn').onclick=()=>$('#companyLogoInput').click();
    $('#companyLogoInput').addEventListener('change', e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ appState.admin.logo=r.result; saveAdminState(); renderAdminScreen(); }; r.readAsDataURL(f); });
    $('#addBranchBtn').onclick=()=>{ const n='Sucursal '+(appState.admin.branches.length+1); appState.admin.branches.push({name:n,type:'tienda',color:'#f5a623',warehouses:['Almacén principal'], sheetUrl:'', sheetName:'Productos', sheetConnected:false, lastSheetCount:0}); appState.admin.activeBranch=appState.admin.branches.length-1; renderAdminScreen(); };
    $('#saveCompanyBtn').onclick=()=>{ const names=appState.admin.branches.map(b=>norm(b.name)); if(new Set(names).size!==names.length) return alert('Hay sucursales con nombres repetidos.'); for(const b of appState.admin.branches){ const ws=(b.warehouses||[]).map(x=>norm(x)); if(new Set(ws).size!==ws.length) return alert(`Hay almacenes repetidos en ${b.name}.`); } saveAdminState(); alert('Configuración guardada.'); renderAdminScreen(); };
    contentWrap.querySelectorAll('[data-field="branch-name"]').forEach(el=>el.oninput=e=>appState.admin.branches[+e.target.dataset.index].name=e.target.value);
    contentWrap.querySelectorAll('[data-field="branch-type"]').forEach(el=>el.onchange=e=>appState.admin.branches[+e.target.dataset.index].type=e.target.value);
    contentWrap.querySelectorAll('[data-field="branch-color"]').forEach(el=>el.oninput=e=>{ appState.admin.branches[+e.target.dataset.index].color=e.target.value; });
    contentWrap.querySelectorAll('[data-field="warehouse-name"]').forEach(el=>el.oninput=e=>appState.admin.branches[+e.target.dataset.bindex].warehouses[+e.target.dataset.windex]=e.target.value);
    contentWrap.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=e=>{ const a=e.currentTarget.dataset.action, i=+e.currentTarget.dataset.index, bi=+e.currentTarget.dataset.bindex, wi=+e.currentTarget.dataset.windex; if(a==='toggle-branch'){ appState.admin.activeBranch=i; renderAdminScreen(); } if(a==='move-up'&&i>0){ const arr=appState.admin.branches; [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; appState.admin.activeBranch=i-1; renderAdminScreen(); } if(a==='move-down'&&i<appState.admin.branches.length-1){ const arr=appState.admin.branches; [arr[i+1],arr[i]]=[arr[i],arr[i+1]]; appState.admin.activeBranch=i+1; renderAdminScreen(); } if(a==='delete-branch'){ if(!confirm('¿Eliminar sucursal?')) return; if(appState.admin.branches.length===1) return alert('Debe quedar al menos una sucursal.'); appState.admin.branches.splice(i,1); appState.admin.activeBranch=Math.max(0,Math.min(appState.admin.activeBranch, appState.admin.branches.length-1)); renderAdminScreen(); } if(a==='add-warehouse'){ appState.admin.branches[i].warehouses.push('Nuevo almacén'); renderAdminScreen(); } if(a==='delete-warehouse'){ if(!confirm('¿Eliminar almacén?')) return; appState.admin.branches[bi].warehouses.splice(wi,1); if(!appState.admin.branches[bi].warehouses.length) appState.admin.branches[bi].warehouses=['Almacén principal']; renderAdminScreen(); } } );
    applyBrand();
  }
  async function httpJson(url, opts={}){ const res=await fetch(url, opts); const txt=await res.text(); let data={}; try{data=txt?JSON.parse(txt):{}}catch{data={raw:txt}} if(!res.ok) throw new Error(data.error||txt||'Error'); return data; }
  function getBranchStorageKey(branchIndex){
    const branch = (appState.admin?.branches || [])[branchIndex] || {};
    const branchName = norm(branch.name || `branch_${branchIndex}`).replace(/[^a-z0-9]+/g,'_');
    const sheetUrl = parseSheetId(branch.sheetUrl || '');
    const sheetName = norm(branch.sheetName || 'productos').replace(/[^a-z0-9]+/g,'_');
    return `wms_products_branch_v2_${branchName}__${sheetUrl || 'sinurl'}__${sheetName || 'sinhoja'}`;
  }
  function saveProductsLocal(branchIndex){
    try{
      const payload = JSON.stringify((appState.products || []).slice(0,12000));
      const key = (Number.isFinite(branchIndex) && branchIndex >= 0) ? getBranchStorageKey(branchIndex) : 'wms_products_v2';
      localStorage.setItem(key, payload);
      if(Number.isFinite(branchIndex) && branchIndex >= 0){
        localStorage.setItem(`wms_products_branch_${branchIndex}`, payload);
      }
      localStorage.setItem('wms_products_v2', payload);
    }catch{}
  }
  function loadProductsLocal(){ try{ const raw=localStorage.getItem('wms_products_v2'); if(raw){ const arr=JSON.parse(raw); if(Array.isArray(arr)&&arr.length){ appState.products=arr; appState.filtered=arr; } } }catch{} }
  function applyBranchProducts(arr, branchIndex){
    if(!Array.isArray(arr) || !arr.length) return false;
    appState.products = arr;
    appState.filtered = arr;
    appState.activeBranchIndex = branchIndex;
    renderProducts(appState.filtered);
    if(arr[0]) selectProduct(arr[0]);
    countProducts.textContent = arr.length.toLocaleString('es-PE');
    return true;
  }
  function loadBranchProducts(branchIndex){
    try{
      const modernKey = getBranchStorageKey(branchIndex);
      const rawModern = localStorage.getItem(modernKey);
      if(rawModern){
        const arr = JSON.parse(rawModern);
        if(applyBranchProducts(arr, branchIndex)) return true;
      }
      const rawLegacy = localStorage.getItem(`wms_products_branch_${branchIndex}`);
      if(rawLegacy){
        const arr = JSON.parse(rawLegacy);
        if(applyBranchProducts(arr, branchIndex)){
          try{ localStorage.setItem(modernKey, rawLegacy); }catch{}
          return true;
        }
      }
    }catch{}
    return false;
  }
  async function activateBranchSelection(branchIndex){
    ensureBranchSheetFields();
    appState.activeBranchIndex = branchIndex;
    const branch = (appState.admin?.branches || [])[branchIndex];
    if(!branch) return false;
    if(loadBranchProducts(branchIndex)) return true;
    if(Array.isArray(branch.sheetPreviewProducts) && branch.sheetPreviewProducts.length){
      applyBranchProducts(branch.sheetPreviewProducts, branchIndex);
      return true;
    }
    const hasLink = String(branch.sheetUrl||'').trim() && String(branch.sheetName||'').trim();
    if(hasLink){
      try{ await importBranchSheet(branchIndex); return true; }catch{}
    }
    appState.products = [];
    appState.filtered = [];
    renderProducts([]);
    countProducts.textContent = '0';
    return false;
  }
  function resetSheetPanelList(){ productList.innerHTML = '<div class="empty" style="padding:18px">Aún no hay productos importados en este asistente.</div>'; productSummary.textContent = 'Importa productos en el paso 3 para verlos aquí.'; countProducts.textContent='0'; }
  function clearCurrentProductsForSheetLink(branchIndex){
    appState.products = [];
    appState.filtered = [];
    appState.selectedProduct = null;
    appState.selectedRack = '';
    appState.selectedRackLayoutId = '';
    try{
      if(Number.isFinite(branchIndex) && branchIndex >= 0){
        const branch = (appState.admin?.branches || [])[branchIndex];
        if(branch){
          branch.sheetPreviewProducts = [];
          branch.lastSheetCount = 0;
        }
        const modernKey = getBranchStorageKey(branchIndex);
        localStorage.removeItem(modernKey);
        localStorage.removeItem(`wms_products_branch_${branchIndex}`);
      }
      localStorage.removeItem('wms_products_v2');
    }catch{}
    renderProducts([]);
    resetSheetPanelList();
  }
  function detectHeaderMap(headers){ const normed=headers.map(h=>({raw:h,key:norm(h).replace(/\s+/g,'')})); const pick=(...names)=>{ for(const n of names){ const hit=normed.find(h=>h.key.includes(n)); if(hit) return hit.raw; } return ''; }; return { sku:pick('sku','codigo'), nombre:pick('nombre','name','producto'), variante:pick('variante','variant'), talla:pick('talla','size'), color:pick('color','colour'), barras:pick('barras','barcode','barra'), ubicacion:pick('ubicacion','ubiccaion','location'), almacen:pick('almacen','warehouse','alamacen') }; }


  function defaultSheetMapRows(){
    return [
      { id: uid('map'), field:'sku', label:'SKU', header:'' },
      { id: uid('map'), field:'nombre', label:'Nombre', header:'' },
      { id: uid('map'), field:'variante', label:'Variante', header:'' },
      { id: uid('map'), field:'talla', label:'Talla', header:'' },
      { id: uid('map'), field:'color', label:'Color', header:'' },
      { id: uid('map'), field:'ubicacion', label:'Ubicación', header:'' },
    ];
  }
  function uid(prefix='id'){ return `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`; }

  function setUnifiedMapLayout(){}
  function focusBoundsForProduct(){ return null; }
  function getActiveSheetBranch(){
    ensureBranchSheetFields();
    const branches = appState.admin.branches || [];
    // Prioridad: sucursal actualmente abierta en el acordeón
    if(Number.isFinite(appState.activeBranchIndex) && branches[appState.activeBranchIndex]) {
      return branches[appState.activeBranchIndex];
    }
    return branches.find(b => b.sheetConnected) || branches[0] || null;
  }
  function getActiveBranchIndex(){
    const branches = appState.admin.branches || [];
    if(Number.isFinite(appState.activeBranchIndex) && branches[appState.activeBranchIndex]) return appState.activeBranchIndex;
    const idx = branches.findIndex(b => b.sheetConnected);
    return idx >= 0 ? idx : 0;
  }
  function getActiveSheetBranchIndex(){
    return getActiveBranchIndex();
  }
  function renderViewerBranchHost(activeBranchIndex){
    if(!searchBranchHost) return;
    const branches = appState.admin?.branches || [];
    if(appState.screen !== 'viewer' || !branches.length){
      searchBranchHost.classList.remove('active');
      searchBranchHost.innerHTML = '';
      return;
    }
    const options = branches.map((branch, index) => `<option value="${index}" ${index===activeBranchIndex?'selected':''}>${escapeHtml(branch.name || `Sucursal ${index+1}`)}</option>`).join('');
    searchBranchHost.classList.add('active');
    searchBranchHost.innerHTML = `
      <div class="search-branch-card">
        <div class="branch-copy">
          <b>Sucursal en visualización</b>
          <div class="muted tiny">Selecciona la sede que quieres ver en el plano general y en los racks.</div>
        </div>
        <select id="viewerBranchSelectTop">${options}</select>
      </div>`;
    const topSelect = document.getElementById('viewerBranchSelectTop');
    if(topSelect) topSelect.onchange = (e) => switchViewerBranch(e.target.value);
  }
  function getBranchPreviewProducts(branch){
    return Array.isArray(branch?.sheetPreviewProducts) ? branch.sheetPreviewProducts : [];
  }

  function renderSheetDetailPreview(){
    const branchIdx = getActiveBranchIndex();
    const branch = (appState.admin.branches||[])[branchIdx];
    const products = getBranchPreviewProducts(branch).slice(0, 20);
    const rowsHtml = products.length ? products.map(p => `<tr><td>${escapeHtml(p.sku||'')}</td><td>${escapeHtml(p.nombre||'')}</td><td>${escapeHtml(p.variante||'')}</td><td>${escapeHtml(p.ubicacion||'')}</td></tr>`).join('') : `<tr><td colspan="4" class="muted" style="padding:18px">Aún no hay productos importados en esta sucursal.</td></tr>`;
    detailTitle.textContent='Vista previa de productos';
    detailSubtitle.textContent=`Sucursal activa: ${branch?.name||'—'}`;
    detailWrap.innerHTML = `<div class="card" style="height:100%;display:flex;flex-direction:column"><div class="card-body" style="display:flex;flex-direction:column;gap:12px;height:100%"><div class="kv"><div class="kv-row"><div class="tiny muted">Sucursal</div><div>${escapeHtml(branch?.name||'—')}</div></div><div class="kv-row"><div class="tiny muted">Productos cargados</div><div>${appState.products.length.toLocaleString('es-PE')}</div></div><div class="kv-row"><div class="tiny muted">Total detectados</div><div>${Number(branch?.lastSheetCount||0).toLocaleString('es-PE')}</div></div></div><div class="tiny muted">Vista previa (${products.length} filas)</div><div style="overflow:auto;flex:1;border:1px solid rgba(255,255,255,.08);border-radius:12px"><table class="table"><thead><tr><th>SKU</th><th>Nombre</th><th>Variante</th><th>Ubicación</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></div></div>`;
    detailStatus.textContent='Sheet';
    detailChip.textContent=`${products.length} filas`;
  }

  function ensureBranchSheetFields(){
    appState.admin.branches = (appState.admin.branches||[]).map(b => ({
      ...b,
      sheetUrl: b.sheetUrl || '',
      sheetName: b.sheetName || 'Productos',
      sheetConnected: !!b.sheetConnected,
      lastSheetCount: Number(b.lastSheetCount || 0),
      sheetHeaders: Array.isArray(b.sheetHeaders) ? b.sheetHeaders : [],
      sheetStatusText: b.sheetStatusText || '',
      sheetHeaderIndex: Number.isFinite(Number(b.sheetHeaderIndex)) ? Number(b.sheetHeaderIndex) : 0,
      sheetPreviewProducts: Array.isArray(b.sheetPreviewProducts) ? b.sheetPreviewProducts : [],
      sheetMapRows: Array.isArray(b.sheetMapRows) && b.sheetMapRows.length ? b.sheetMapRows : defaultSheetMapRows(),
    }));
  }

  function getSheetBranchOpenMap(){
    if(!appState.sheetBranchOpen || typeof appState.sheetBranchOpen !== 'object') appState.sheetBranchOpen = {0:true};
    return appState.sheetBranchOpen;
  }

  async function readBranchHeaders(index){
    ensureBranchSheetFields();
    const branch = appState.admin.branches[index];
    if(!branch) return;
    const url = String(branch.sheetUrl||'').trim();
    const sheetName = String(branch.sheetName||'').trim();
    if(!url || !sheetName) throw new Error('Completa la URL/ID del Sheet y el nombre de la hoja.');
    const data = await httpJson(`/api/sheets/rows?url=${encodeURIComponent(url)}&sheet=${encodeURIComponent(sheetName)}&headerOnly=1`);
    branch.sheetHeaders = Array.isArray(data.headers) ? data.headers.filter(Boolean) : [];
    branch.sheetHeaderIndex = Number(data.headerIndex || 0);
    branch.sheetConnected = branch.sheetHeaders.length > 0;
    branch.sheetStatusText = branch.sheetConnected ? `Encabezados leídos: ${branch.sheetHeaders.length} • fila ${branch.sheetHeaderIndex + 1}` : 'Sin encabezados';
    const prefer = {
      sku:['sku','cod modelo','codigo','código'], nombre:['nombre','name','producto','descripcion'], variante:['variante','variant'], talla:['talla','size'], color:['color','colour'], ubicacion:['ubicacion','ubicación','location','ubicacion final'],
      barras:['barras','barcode','barra'], almacen:['almacen','almacén','warehouse'], zona:['zona'], estante:['estante','rack'], nivel:['nivel'], slot:['slot','posicion','posición']
    };
    (branch.sheetMapRows||[]).forEach(r=>{
      if(r.header) return;
      const hit = (branch.sheetHeaders||[]).find(h => (prefer[r.field]||[]).some(k => norm(h).includes(norm(k))));
      if(hit) r.header = hit;
    });
    saveAdminState();
  }

  async function saveBranchSheetLink(index){
    ensureBranchSheetFields();
    const branch = appState.admin.branches[index];
    if(!branch) return;
    branch.sheetUrl = String(branch.sheetUrl||'').trim();
    branch.sheetName = String(branch.sheetName||'').trim();
    clearCurrentProductsForSheetLink(index);
    branch.sheetStatusText = 'Leyendo fila 1...';
    appState.sheetConfig.lastMode = 'google';
    saveAdminState();
    renderSheetScreen();
    try{
      await readBranchHeaders(index);
      renderSheetScreen();
    }catch(err){
      branch.sheetConnected = false;
      branch.sheetStatusText = err.message || 'No se pudieron leer encabezados';
      saveAdminState();
      renderSheetScreen();
      alert(branch.sheetStatusText);
    }
  }

  function addSheetMapRow(index){
    const branch = appState.admin.branches[index]; if(!branch) return;
    branch.sheetMapRows.push({ id: uid('map'), field:'personalizado', label:'Encabezado', header:'' });
    saveAdminState(); renderSheetScreen();
  }
  function deleteSheetMapRow(index,rowId){
    const branch = appState.admin.branches[index]; if(!branch) return;
    branch.sheetMapRows = (branch.sheetMapRows||[]).filter(r=>r.id!==rowId);
    if(!branch.sheetMapRows.length) branch.sheetMapRows = defaultSheetMapRows();
    saveAdminState(); renderSheetScreen();
  }
  function moveSheetMapRow(index,rowId,dir){
    const branch = appState.admin.branches[index]; if(!branch) return;
    const rows = branch.sheetMapRows||[];
    const idx = rows.findIndex(r=>r.id===rowId); if(idx<0) return;
    const ni = idx + dir; if(ni<0 || ni>=rows.length) return;
    const tmp = rows[idx]; rows[idx]=rows[ni]; rows[ni]=tmp;
    saveAdminState(); renderSheetScreen();
  }
  function saveBranchSheetMapping(index){
    ensureBranchSheetFields();
    const branch = appState.admin.branches[index]; if(!branch) return;
    const root = contentWrap.querySelector(`[data-sheet-branch="${index}"]`);
    if(!root) return;
    (branch.sheetMapRows||[]).forEach(row=>{
      const sel = root.querySelector(`[data-map-header="${row.id}"]`);
      const fld = root.querySelector(`[data-map-field="${row.id}"]`);
      const lbl = root.querySelector(`[data-map-label="${row.id}"]`);
      if(fld) row.field = fld.value;
      if(lbl) row.label = lbl.value;
      if(sel) row.header = sel.value;
    });
    branch.sheetStatusText = 'Mapeo guardado';
    saveAdminState();
    renderSheetScreen();
  }

  function buildImportedLocation(rec){
    const u = String(rec.ubicacion||'').trim();
    if(u) return u;
    const z = String(rec.zona||'').trim();
    const e = String(rec.estante||'').trim();
    const n = String(rec.nivel||'').trim();
    const s = String(rec.slot||'').trim();
    return [z,e?`E${String(e).replace(/^E/i,'')}`:'',n?`N${String(n).replace(/^N/i,'')}`:'',s?`S${String(s).replace(/^S/i,'')}`:''].filter(Boolean).join('-');
  }
  function buildImportedStorageLocation(rec){
    const u = String(rec.almacen||'').trim();
    if(u) return u;
    const z = String(rec.zona2 || rec.zona_store || rec.zonaalmacen || '').trim();
    const e = String(rec.estante2 || rec.estante_store || rec.rackalmacen || '').trim();
    const n = String(rec.nivel2 || rec.nivel_store || '').trim();
    const s = String(rec.slot2 || rec.slot_store || '').trim();
    return [z,e?`E${String(e).replace(/^E/i,'')}`:'',n?`N${String(n).replace(/^N/i,'')}`:'',s?`S${String(s).replace(/^S/i,'')}`:''].filter(Boolean).join('-');
  }

  async function importBranchSheet(index){
    ensureBranchSheetFields();
    const branch = appState.admin.branches[index]; if(!branch) return;
    const url = String(branch.sheetUrl||'').trim(); const sheetName = String(branch.sheetName||'').trim();
    if(!url || !sheetName) return alert('Completa la URL/ID del Sheet y el nombre de la hoja.');
    if(!branch.sheetHeaders || !branch.sheetHeaders.length) {
      branch.sheetStatusText = 'Leyendo fila 1...'; saveAdminState(); renderSheetScreen();
      try { await readBranchHeaders(index); } catch(err){ alert(err.message||'No se pudieron leer encabezados'); return; }
    }
    saveBranchSheetMapping(index);
    clearCurrentProductsForSheetLink(index);
    branch.sheetStatusText = 'Importando productos...'; saveAdminState(); renderSheetScreen();
    try{
      const data = await httpJson(`/api/sheets/rows?url=${encodeURIComponent(url)}&sheet=${encodeURIComponent(sheetName)}&limit=12000`);
      const headers = Array.isArray(data.headers)?data.headers:[];
      const rows = Array.isArray(data.rows)?data.rows:[];
      const headerIndex = Number(data.headerIndex || branch.sheetHeaderIndex || 0);
      const totalRows = Number(data.totalRows || rows.length || 0);
      const normalizedLookup = {};
      headers.forEach((h,i)=>{ normalizedLookup[norm(h)] = i; });
      const idxByHeader = Object.fromEntries(headers.map((h,i)=>[h,i]));
      const aliasByField = {
        sku:['sku','codigo','código','cod modelo','cod / modelo','modelo'],
        nombre:['nombre','producto','descripcion','descripción','name'],
        variante:['variante','variant','linea'],
        talla:['talla','size'],
        color:['color','colour'],
        imagen:['imagen','image','foto','fotografia','fotografía','img','image url','url imagen','url de imagen','link imagen','enlace imagen'],
        imagen2:['imagen 2','imagen2','image 2','image2','foto 2','foto2','img 2','img2','url imagen 2','image url 2','link imagen 2','enlace imagen 2'],
        imagen2:['imagen 2','imagen2','image 2','image2','foto 2','foto2','img 2','img2','url imagen 2','image url 2','link imagen 2','enlace imagen 2'],
        barras:['barras','barra','barcode','codigo de barras'],
        almacen:['almacen','almacén','warehouse','ubicacion almacen','ubicación almacén','ubicacion almacén','location almacen'],
        zona:['zona'],
        estante:['estante','rack'],
        nivel:['nivel'],
        slot:['slot','posicion','posición'],
        zona2:['zona 2','zona2','zona (2)','zona almacen','zona almacén','almacen zona','almacén zona'],
        estante2:['estante 2','estante2','estante (2)','rack 2','rack2','rack almacen','rack almacén','estante almacen','estante almacén'],
        nivel2:['nivel 2','nivel2','nivel (2)','nivel almacen','nivel almacén'],
        slot2:['slot 2','slot2','slot (2)','posicion 2','posición 2','slot almacen','slot almacén','posicion almacen','posición almacén'],
        ubicacion:['ubicacion','ubicación','ubicacion final','location']
      };
      const getVal = (row, header)=> header && Object.prototype.hasOwnProperty.call(idxByHeader, header) ? String(row[idxByHeader[header]]||'').trim() : '';
      const getAliasVal = (row, field) => {
        const aliases = aliasByField[field] || [];
        for (const alias of aliases){
          const idx = normalizedLookup[norm(alias)];
          if(Number.isInteger(idx)){
            const value = String(row[idx] || '').trim();
            if(value) return value;
          }
        }
        return '';
      };
      const list = rows.map((row,ri)=>{
        const rec = {};
        (branch.sheetMapRows||[]).forEach(m=>{ if(m.header && m.field) rec[m.field]=getVal(row,m.header); });
        ['sku','nombre','variante','talla','color','imagen','imagen2','barras','almacen','zona','estante','nivel','slot','zona2','estante2','nivel2','slot2','ubicacion'].forEach(field=>{
          if(!String(rec[field]||'').trim()) rec[field] = getAliasVal(row, field);
        });
        const ubicacion = normalizeLocationCode(buildImportedLocation(rec));
        const almacenRaw = normalizeLocationCode(buildImportedStorageLocation(rec));
        const mainParsed = parseLocationCode(ubicacion || buildImportedLocation(rec), 'Z1-E1');
        const storeParsed = parseLocationCode(almacenRaw || '', 'ALM-E1');
        const sku = String(rec.sku || '').trim();
        const nombre = String(rec.nombre || '').trim();
        const variante = String(rec.variante || '').trim();
        const barras = String(rec.barras || '').trim();
        const imagen = String(rec.imagen || '').trim();
        const talla = String(rec.talla || '').trim();
        const color = String(rec.color || '').trim();
        const imagen2 = String(rec.imagen2 || '').trim();
        const almacen = storeParsed.raw || almacenRaw || '';
        return {
          sku,
          nombre,
          variante,
          barras,
          imagen,
          imagen2,
          talla,
          color,
          ubicacion: mainParsed.raw || ubicacion,
          almacen,
          zona: mainParsed.zoneId,
          rack: mainParsed.rackId,
          nivel: mainParsed.level,
          slot: mainParsed.slot,
          zonaStore: storeParsed.zoneId,
          rackStore: storeParsed.rackId,
          nivelStore: storeParsed.level,
          slotStore: storeParsed.slot,
          _rowIndex:ri + headerIndex + 2
        };
      }).filter(p=>p.sku || p.nombre || p.barras || p.ubicacion || p.almacen);

      appState.products = list;
      appState.filtered = list;
      syncBranchLayoutWithProducts(index, list);
      appState.activeBranchIndex = index;
      branch.sheetPreviewProducts = list.slice(0, 20);
      if(list[0]) selectProduct(list[0]); else appState.selectedProduct = null;
      renderProducts(appState.filtered);
      saveProductsLocal(index);
      branch.lastSheetCount = totalRows || list.length;
      branch.sheetConnected = true;
      branch.sheetStatusText = `Importados: ${list.length.toLocaleString('es-PE')} • detectados ${branch.lastSheetCount.toLocaleString('es-PE')}`;
      saveAdminState();
      renderSheetScreen();
    }catch(err){
      branch.sheetStatusText = err.message || 'Error al importar'; saveAdminState(); renderSheetScreen(); alert(branch.sheetStatusText);
    }
  }

  function toggleSheetExpanded(){
    appState.ui.sheetExpanded = !appState.ui.sheetExpanded;
    appRoot.classList.toggle('sheet-expanded', !!appState.ui.sheetExpanded);
    if(appState.screen === 'sheet') renderSheetScreen();
  }

  function renderSheetScreen(){
    ensureBranchSheetFields();
    const openMap = getSheetBranchOpenMap();
    contentTitle.textContent='Vincular Google Sheet';
    contentSubtitle.textContent='Guarda la URL del Sheet, la hoja y elige qué columnas quieres usar por sucursal';
    setTags([]);
    contentTags.insertAdjacentHTML('beforeend', `<button type="button" class="btn primary" id="btnSheetSaveCurrent">Guardar cambios</button>`);
    renderSheetDetailPreview();

    contentWrap.innerHTML = `<div class="form-wrap" style="height:100%;display:flex;flex-direction:column"><div class="branches-panel" style="min-height:0;flex:1;border-radius:22px;background:linear-gradient(180deg,rgba(9,22,40,.78),rgba(6,16,30,.9));box-shadow:0 20px 46px rgba(0,0,0,.24)"><div class="branches-toolbar"><div><b style="font-size:18px;letter-spacing:.2px">Vinculación por sucursal</b><div class="tiny muted" style="margin-top:6px;max-width:860px;line-height:1.45">1) Guarda sucursal + hoja 2) Se listan los encabezados de la fila 1 3) Elige qué columnas usar y en qué orden verlas</div></div></div><div class="branches-scroll" style="max-height:none;flex:1;padding:18px" id="sheetBranchesList">${appState.admin.branches.map((b,i)=>{
      const isOpen = !!openMap[i];
      const statusClass = b.sheetConnected ? 'ok' : (b.sheetUrl || b.sheetName ? 'warn' : '');
      const statusText = b.sheetStatusText || (b.sheetConnected ? `Vinculado • ${Number(b.lastSheetCount||0).toLocaleString('es-PE')} filas` : 'Sin vincular');
      const headerOptions = ['<option value="">(Sin seleccionar)</option>'].concat((b.sheetHeaders||[]).map(h=>`<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`)).join('');
      const rowsHtml = (b.sheetMapRows||[]).map((row,idx)=>`<div class="sheet-map-row" style="display:grid;grid-template-columns:140px 1fr 34px 34px 34px;gap:8px;align-items:center;margin-top:10px"><select data-map-field="${row.id}"><option value="sku" ${row.field==='sku'?'selected':''}>SKU</option><option value="nombre" ${row.field==='nombre'?'selected':''}>Nombre</option><option value="variante" ${row.field==='variante'?'selected':''}>Variante</option><option value="talla" ${row.field==='talla'?'selected':''}>Talla</option><option value="color" ${row.field==='color'?'selected':''}>Color</option><option value="ubicacion" ${row.field==='ubicacion'?'selected':''}>Ubicación</option><option value="barras" ${row.field==='barras'?'selected':''}>Código de barras</option><option value="almacen" ${row.field==='almacen'?'selected':''}>Almacén</option><option value="zona" ${row.field==='zona'?'selected':''}>Zona</option><option value="estante" ${row.field==='estante'?'selected':''}>Estante</option><option value="nivel" ${row.field==='nivel'?'selected':''}>Nivel</option><option value="slot" ${row.field==='slot'?'selected':''}>Slot</option><option value="personalizado" ${row.field==='personalizado'?'selected':''}>Personalizado</option></select><select data-map-header="${row.id}">${headerOptions.replace(`value="${escapeHtml(row.header||'')}"`,`value="${escapeHtml(row.header||'')}" selected`)}</select><button class="tiny-btn" data-map-up="${i}:${row.id}">↑</button><button class="tiny-btn" data-map-down="${i}:${row.id}">↓</button><button class="tiny-btn" data-map-del="${i}:${row.id}">✕</button></div>`).join('');
      return `<div class="sheet-branch-card ${isOpen?'open':''}" data-sheet-branch="${i}"><div class="sheet-branch-head" data-sheet-toggle="${i}"><span class="sheet-branch-dot" style="background:${escapeHtml(b.color||'#f5a623')}"></span><div><div style="font-weight:800">${escapeHtml(b.name||('Sucursal '+(i+1)))}</div><div class="tiny muted">${escapeHtml((b.type||'tienda').toUpperCase())}</div></div><div class="sheet-branch-meta"><span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span><button class="tiny-btn" type="button">${isOpen?'−':'+'}</button></div></div><div class="sheet-branch-body"><div class="sheet-branch-grid"><div class="grid"><label>URL / ID del Sheet</label><input data-sheet-url="${i}" placeholder="https://docs.google.com/spreadsheets/d/..." value="${escapeHtml(b.sheetUrl||'')}"></div><div class="grid"><label>Nombre de la hoja</label><input data-sheet-name="${i}" placeholder="Ej: Productos" value="${escapeHtml(b.sheetName||'Productos')}"></div></div><div class="sheet-actions"><button class="btn primary" data-sheet-save="${i}">Guardar vinculación y leer fila 1</button><button class="btn secondary" data-sheet-import="${i}">Importar productos</button></div><div class="sheet-mini-preview"><div class="tiny muted">Paso 2 • Encabezados disponibles en la fila 1</div><div class="sheet-preview-row">${(b.sheetHeaders||[]).length ? b.sheetHeaders.map(h=>`<span class="sheet-preview-chip">${escapeHtml(h)}</span>`).join('') : '<span class="tiny muted">Aún no se leyeron encabezados.</span>'}</div><div style="margin-top:16px"><div class="sheet-actions" style="justify-content:flex-start"><button class="btn secondary" data-sheet-add-header="${i}">+ Encabezado</button><span class="tiny muted">Paso 3 • Elige qué columnas usar y en qué orden verlas</span></div>${rowsHtml}<div class="sheet-actions"><button class="btn secondary" data-sheet-map-save="${i}">Guardar columnas visibles</button></div></div></div></div></div>`;
    }).join('')}</div></div></div>`;

    contentWrap.querySelectorAll('[data-sheet-toggle]').forEach(el=>el.onclick=async (e)=>{ const i=+e.currentTarget.dataset.sheetToggle; const wasOpen=!!openMap[i]; Object.keys(openMap).forEach(k=>{openMap[k]=false;}); openMap[i]=!wasOpen; if(openMap[i]){ await activateBranchSelection(i); } renderSheetScreen(); });
    contentWrap.querySelectorAll('[data-sheet-url]').forEach(el=>el.oninput=(e)=>{ appState.admin.branches[+e.target.dataset.sheetUrl].sheetUrl=e.target.value; });
    contentWrap.querySelectorAll('[data-sheet-name]').forEach(el=>el.oninput=(e)=>{ appState.admin.branches[+e.target.dataset.sheetName].sheetName=e.target.value; });
    contentWrap.querySelectorAll('[data-sheet-save]').forEach(el=>el.onclick=(e)=>saveBranchSheetLink(+e.currentTarget.dataset.sheetSave));
    contentWrap.querySelectorAll('[data-sheet-import]').forEach(el=>el.onclick=(e)=>importBranchSheet(+e.currentTarget.dataset.sheetImport));
    contentWrap.querySelectorAll('[data-sheet-map-save]').forEach(el=>el.onclick=(e)=>saveBranchSheetMapping(+e.currentTarget.dataset.sheetMapSave));
    contentWrap.querySelectorAll('[data-sheet-add-header]').forEach(el=>el.onclick=(e)=>addSheetMapRow(+e.currentTarget.dataset.sheetAddHeader));
    contentWrap.querySelectorAll('[data-map-del]').forEach(el=>el.onclick=(e)=>{ const [i,id] = e.currentTarget.dataset.mapDel.split(':'); deleteSheetMapRow(+i,id); });
    contentWrap.querySelectorAll('[data-map-up]').forEach(el=>el.onclick=(e)=>{ const [i,id] = e.currentTarget.dataset.mapUp.split(':'); moveSheetMapRow(+i,id,-1); });
    contentWrap.querySelectorAll('[data-map-down]').forEach(el=>el.onclick=(e)=>{ const [i,id] = e.currentTarget.dataset.mapDown.split(':'); moveSheetMapRow(+i,id,1); });
    const btnSheetExpand = document.getElementById('btnSheetExpand');
    if(btnSheetExpand) btnSheetExpand.onclick = toggleSheetExpanded;
  }


  function buildDashboardData(){
    const products = Array.isArray(appState.filtered) && appState.filtered.length ? appState.filtered : (appState.products || []);
    const racks = appState.layout?.racks || [];
    const zones = appState.layout?.zones || [];
    const byRack = new Map();
    products.forEach(p => {
      const rid = p?.rack || p?.rackStore || '';
      if(!rid) return;
      byRack.set(rid, (byRack.get(rid) || 0) + 1);
    });
    const rackStats = racks.map(r => {
      const model = rackModel(r.modelId) || {};
      const capacity = getRackCapacity(model);
      const occupied = byRack.get(r.id) || 0;
      return {
        id: r.id,
        zoneId: r.zoneId || '—',
        model: model.name || r.modelId || '—',
        capacity,
        occupied,
        free: Math.max(0, capacity - occupied),
        occupancy: Math.min(100, capacity ? (occupied / capacity) * 100 : 0)
      };
    }).sort((a,b) => b.occupancy - a.occupancy || b.occupied - a.occupied || String(a.id).localeCompare(String(b.id)));
    const zoneStats = zones.map(z => {
      const zr = rackStats.filter(r => r.zoneId === z.id);
      const slots = zr.reduce((s,r) => s + r.capacity, 0);
      const occupied = zr.reduce((s,r) => s + r.occupied, 0);
      return {
        id: z.id,
        name: z.name || z.id,
        racks: zr.length,
        slots,
        occupied,
        free: Math.max(0, slots - occupied),
        occupancy: slots ? (occupied / slots) * 100 : 0
      };
    }).sort((a,b) => b.occupancy - a.occupancy || String(a.id).localeCompare(String(b.id)));
    const totalSlots = rackStats.reduce((s,r) => s + r.capacity, 0);
    const occupiedSlots = rackStats.reduce((s,r) => s + r.occupied, 0);
    const freeSlots = Math.max(0, totalSlots - occupiedSlots);
    const skuCount = new Set(products.map(p => (p.sku || '').trim()).filter(Boolean)).size;
    const noRack = products.filter(p => !(p?.rack || p?.rackStore)).length;
    const racksNoLoad = rackStats.filter(r => r.occupied === 0).length;
    const topZone = zoneStats[0] || null;
    const fullestRack = rackStats[0] || null;
    return {
      products,
      racks,
      zones,
      skuCount,
      totalProducts: products.length,
      totalRacks: racks.length,
      totalZones: zones.length,
      totalSlots,
      occupiedSlots,
      freeSlots,
      occPct: totalSlots ? (occupiedSlots / totalSlots) * 100 : 0,
      noRack,
      racksNoLoad,
      topZone,
      fullestRack,
      zoneStats,
      rackStats
    };
  }

  function dashboardBarClass(value){
    if(value >= 85) return 'down';
    if(value >= 65) return 'warn';
    return 'good';
  }

  function renderDashboard(){
    setUnifiedMapLayout(false);
    const data = buildDashboardData();
    const selectedRackId = appState.selectedRackLayoutId || appState.selectedRack || data.rackStats[0]?.id || appState.layout?.racks?.[0]?.id || '';
    const selectedRack = findRackById(selectedRackId) || appState.layout?.racks?.[0] || null;
    const selectedZone = findZoneById(appState.selectedZoneId) || (selectedRack ? findZoneById(selectedRack.zoneId) : null) || appState.layout?.zones?.[0] || null;
    if(selectedRack && !appState.selectedRackLayoutId) appState.selectedRackLayoutId = selectedRack.id;
    if(selectedZone && !appState.selectedZoneId) appState.selectedZoneId = selectedZone.id;

    contentTitle.textContent = 'Dashboard WMS';
    contentSubtitle.textContent = 'Resumen operativo del almacén con ocupación, alertas y foco rápido.';
    setTags(['KPI', 'ocupación', 'alertas', 'racks', 'zonas']);

    const kpis = [
      { label:'Productos analizados', value:data.totalProducts.toLocaleString('es-PE'), foot:`${data.skuCount.toLocaleString('es-PE')} SKU únicos`, trend:'up', trendText:'Inventario' },
      { label:'Capacidad total', value:data.totalSlots.toLocaleString('es-PE'), foot:`${data.freeSlots.toLocaleString('es-PE')} slots libres`, trend:data.freeSlots ? 'up' : 'down', trendText:data.freeSlots ? 'Disponible' : 'Lleno' },
      { label:'Ocupación general', value:`${Math.round(data.occPct)}%`, foot:`${data.occupiedSlots.toLocaleString('es-PE')} ocupados`, trend:dashboardBarClass(data.occPct), trendText:data.occPct >= 85 ? 'Crítico' : data.occPct >= 65 ? 'Atención' : 'Saludable' },
      { label:'Calidad de datos', value:`${data.noRack}`, foot:'productos sin rack', trend:data.noRack ? 'warn' : 'up', trendText:data.noRack ? 'Revisar' : 'OK' }
    ];

    const alerts = [];
    if(data.noRack) alerts.push({ cls:'warn', title:'Productos sin ubicación', text:`Hay ${data.noRack} productos sin rack asignado.` });
    if(data.fullestRack && data.fullestRack.occupancy >= 90) alerts.push({ cls:'down', title:'Rack casi saturado', text:`${data.fullestRack.id} está al ${Math.round(data.fullestRack.occupancy)}% de ocupación.` });
    if(data.racksNoLoad) alerts.push({ cls:'good', title:'Racks disponibles', text:`${data.racksNoLoad} racks no tienen carga y pueden recibir productos.` });
    if(!alerts.length) alerts.push({ cls:'good', title:'Sin alertas críticas', text:'La estructura actual no muestra bloqueos evidentes.' });

    contentWrap.innerHTML = `
      <div class="dashboard-grid">
        ${kpis.map(k => `<div class="dashboard-card kpi-card"><span class="tiny muted">${k.label}</span><b>${k.value}</b><div class="kpi-foot"><span>${k.foot}</span><span class="kpi-trend ${k.trend}">${k.trendText}</span></div></div>`).join('')}
        <div class="dashboard-card wide tall">
          <h4>Ocupación por zona</h4>
          <span class="tiny muted">Haz clic para enfocar una zona.</span>
          <div class="dash-zone-grid" style="margin-top:12px;">
            ${data.zoneStats.map(zone => `<button class="dash-zone-card ${selectedZone?.id===zone.id?'active':''}" data-dash-zone="${zone.id}" type="button"><div class="dash-progress-head"><b>${escapeHtml(zone.id)}</b><span>${Math.round(zone.occupancy)}%</span></div><div class="dash-bar ${dashboardBarClass(zone.occupancy)}"><span style="width:${Math.max(4, Math.min(100, zone.occupancy))}%"></span></div><div class="dash-mini-kv"><span>${zone.racks} racks</span><span>${zone.occupied}/${zone.slots} slots</span></div></button>`).join('') || `<div class="empty">No hay zonas cargadas.</div>`}
          </div>
        </div>
        <div class="dashboard-card wide tall">
          <h4>Racks con mayor ocupación</h4>
          <span class="tiny muted">Selecciona uno para verlo en detalle.</span>
          <div class="dash-top-list" style="margin-top:12px;">
            ${data.rackStats.slice(0,8).map(rack => `<button class="dash-top-item ${selectedRackId===rack.id?'active':''}" type="button" data-dash-rack="${rack.id}"><div class="dash-top-head"><b>${escapeHtml(rack.id)}</b><span>${Math.round(rack.occupancy)}%</span></div><div class="dash-bar ${dashboardBarClass(rack.occupancy)}"><span style="width:${Math.max(4, Math.min(100, rack.occupancy))}%"></span></div><div class="dash-top-meta"><span>${escapeHtml(rack.zoneId)} · ${escapeHtml(rack.model)}</span><span>${rack.occupied}/${rack.capacity}</span></div></button>`).join('') || `<div class="empty">No hay racks cargados.</div>`}
          </div>
        </div>
        <div class="dashboard-card wide">
          <h4>Alertas operativas</h4>
          <div class="dash-alert-list" style="margin-top:12px;">
            ${alerts.map(a => `<div class="dash-alert-item ${a.cls}"><b>${a.title}</b><span class="tiny muted">${a.text}</span></div>`).join('')}
          </div>
        </div>
        <div class="dashboard-card wide">
          <h4>Resumen rápido</h4>
          <div class="dash-alert-list" style="margin-top:12px;">
            <div class="dash-alert-item good"><b>Zonas activas</b><span class="tiny muted">${data.totalZones} zonas y ${data.totalRacks} racks modelados.</span></div>
            <div class="dash-alert-item ${dashboardBarClass(data.occPct)}"><b>Ocupación total</b><span class="tiny muted">${data.occupiedSlots} ocupados de ${data.totalSlots} slots.</span></div>
            <div class="dash-alert-item ${data.topZone ? dashboardBarClass(data.topZone.occupancy) : 'good'}"><b>Zona más exigida</b><span class="tiny muted">${data.topZone ? `${escapeHtml(data.topZone.id)} al ${Math.round(data.topZone.occupancy)}%` : 'Sin datos'}</span></div>
            <div class="dash-alert-item ${data.noRack ? 'warn' : 'good'}"><b>Integridad</b><span class="tiny muted">${data.noRack ? `${data.noRack} productos requieren ubicación.` : 'Todos los productos visibles tienen rack.'}</span></div>
          </div>
        </div>
      </div>`;

    detailTitle.textContent = selectedRack ? `Rack ${selectedRack.id}` : 'Detalle de rack';
    detailSubtitle.textContent = selectedRack ? `Zona ${selectedRack.zoneId || '—'} • Vista rápida del rack seleccionado` : 'Selecciona una zona o rack desde el dashboard.';
    detailWrap.innerHTML = `
      <div class="dash-detail-grid">
        <div class="dash-svg-wrap"><svg id="dashboardRackSvg" viewBox="-230 -310 470 520"></svg></div>
        <div class="dash-alert-list">
          <div class="dash-alert-item ${selectedRack ? dashboardBarClass((data.rackStats.find(r=>r.id===selectedRack.id)?.occupancy)||0) : 'good'}"><b>Rack activo</b><span class="tiny muted">${selectedRack ? `${escapeHtml(selectedRack.id)} • ${escapeHtml(selectedRack.zoneId || '—')}` : 'No hay rack seleccionado.'}</span></div>
          <div class="dash-alert-item good"><b>Modelo</b><span class="tiny muted">${selectedRack ? escapeHtml((rackModel(selectedRack.modelId)||{}).name || selectedRack.modelId || '—') : '—'}</span></div>
          <div class="dash-alert-item good"><b>Capacidad</b><span class="tiny muted">${selectedRack ? (()=>{ const s = data.rackStats.find(r=>r.id===selectedRack.id); return s ? `${s.capacity} slots • ${s.occupied} ocupados` : '—'; })() : '—'}</span></div>
          <div class="dash-alert-item ${selectedZone ? dashboardBarClass((data.zoneStats.find(z=>z.id===selectedZone.id)?.occupancy)||0) : 'good'}"><b>Zona enfocada</b><span class="tiny muted">${selectedZone ? `${escapeHtml(selectedZone.id)} • ${(data.zoneStats.find(z=>z.id===selectedZone.id)?.racks)||0} racks` : '—'}</span></div>
        </div>
      </div>`;

    const dashSvg = document.getElementById('dashboardRackSvg');
    if(dashSvg && selectedRack){
      const stat = data.rackStats.find(r => r.id === selectedRack.id);
      const level = stat?.occupied ? 1 : 0;
      renderRackDetail(selectedRack.id, { nivel: level, slot: stat?.occupied ? 1 : 0, label:'Rack activo', fullLabel:selectedRack.id }, dashSvg, rackModel(selectedRack.modelId), selectedRack);
    }

    contentStatus.textContent = `Dashboard listo • ${data.totalProducts.toLocaleString('es-PE')} productos analizados`;
    contentFootRight.textContent = selectedZone ? `${selectedZone.id} • ${Math.round((data.zoneStats.find(z=>z.id===selectedZone.id)?.occupancy)||0)}% ocupación` : '—';
    detailStatus.textContent = selectedRack ? `${selectedRack.id} • ${(data.rackStats.find(r=>r.id===selectedRack.id)?.occupied)||0} ocupados` : 'Sin rack seleccionado';
    detailChip.textContent = selectedRack ? `${(data.rackStats.find(r=>r.id===selectedRack.id)?.capacity)||0} slots` : '—';

    contentWrap.querySelectorAll('[data-dash-zone]').forEach(btn => btn.addEventListener('click', () => {
      appState.selectedZoneId = btn.dataset.dashZone;
      const firstRack = appState.layout.racks.find(r => r.zoneId === appState.selectedZoneId);
      if(firstRack) appState.selectedRackLayoutId = firstRack.id;
      renderDashboard();
    }));
    contentWrap.querySelectorAll('[data-dash-rack]').forEach(btn => btn.addEventListener('click', () => {
      const rackId = btn.dataset.dashRack;
      appState.selectedRackLayoutId = rackId;
      const rack = findRackById(rackId);
      if(rack?.zoneId) appState.selectedZoneId = rack.zoneId;
      renderDashboard();
    }));
  }

  function renderMapView(){
    const prod = appState.selectedProduct;
    setUnifiedMapLayout(true);
    contentTitle.textContent = 'Plano general 3D isométrico';
    contentSubtitle.textContent = 'Sección unificada: arriba plano general; abajo racks de ubicación y almacén.';
    setTags(['isométrico', 'pan + zoom', 'resaltado', 'racks realistas']);

    const primaryRackId = prod?.rack || appState.selectedRack || appState.layout.racks[0]?.id || '';
    const storeRackId = prod?.rackStore || primaryRackId;
    const primaryLoc = prod?.ubicacion || primaryRackId || '—';
    const storeLoc = prod?.almacen || storeRackId || '—';

    const branches = appState.admin?.branches || [];
    const activeBranchIndex = getActiveSheetBranchIndex();
    const activeBranch = branches[activeBranchIndex] || null;
    renderViewerBranchHost(activeBranchIndex);

    contentWrap.innerHTML = `
      <div class="map-unified" style="grid-template-columns:minmax(0,1fr) clamp(320px,28vw,420px);grid-template-rows:minmax(0,1fr);gap:8px;">
        <div class="dual-rack-card" style="min-height:0;display:grid;grid-template-rows:auto 1fr;">
          <div class="dual-rack-head">
            <div>
              <b>Plano general 3D isométrico</b>
              <div class="muted tiny">Mapa navegable con foco en el producto activo.</div>
              <span class="loc-full">Sucursal: ${escapeHtml(activeBranch?.name || '—')} • Ubicación: ${primaryLoc} • Almacén: ${storeLoc}</span>
            </div>
            <span class="chip">${prod?.zona || '—'} / ${prod?.zonaStore || '—'}</span>
          </div>
          <div class="detail-stage"><svg id="isoMap" viewBox="-560 -160 1220 820"></svg></div>
        </div>
        <div class="map-bottom-split" style="grid-template-columns:1fr;grid-template-rows:1fr 1fr;height:100%;min-height:0;width:100%;gap:8px;">
          <div class="dual-rack-card">
            <div class="dual-rack-head">
              <div>
                <b>Rack de ubicación</b>
                <div class="muted tiny">Ubicación principal del producto</div>
                <span class="loc-full" id="rackPrimaryLoc">—</span>
              </div>
              <span class="chip" id="rackPrimaryChip">—</span>
            </div>
            <div class="detail-stage dual-rack-svg"><svg id="rackViewPrimary" viewBox="-113 -180 235 260"></svg></div>
          </div>
          <div class="dual-rack-card">
            <div class="dual-rack-head">
              <div>
                <b>Rack de almacén</b>
                <div class="muted tiny">Ubicación de respaldo / almacén</div>
                <span class="loc-full" id="rackStoreLoc">—</span>
              </div>
              <span class="chip" id="rackStoreChip">—</span>
            </div>
            <div class="detail-stage dual-rack-svg"><svg id="rackViewStore" viewBox="-113 -180 235 260"></svg></div>
          </div>
        </div>
      </div>`;
    detailWrap.innerHTML = '';
    detailTitle.textContent = '';
    detailSubtitle.textContent = '';
    detailStatus.textContent = prod ? `${primaryRackId} / ${storeRackId}` : '—';
    detailChip.textContent = prod ? `U: N${prod.nivel||0} S${prod.slot||0} • A: N${prod.nivelStore||0} S${prod.slotStore||0}` : '—';
    const svg = $('#isoMap');
    const rackSvgPrimary = $('#rackViewPrimary');
    const rackSvgStore = $('#rackViewStore');
    const defs = svgEl('defs');
    const glow = svgEl('filter',{id:'mapGlow',x:'-40%',y:'-40%',width:'180%',height:'180%'});
    glow.appendChild(svgEl('feDropShadow',{dx:'0',dy:'0',stdDeviation:'10','flood-color':'#50e37b','flood-opacity':'.55'}));
    defs.appendChild(glow); svg.appendChild(defs);
    const root = svgEl('g',{id:'mapRoot',transform:'translate(20 170) scale(1)'}); svg.appendChild(root);

    const floor = face([toIso(0,0,0),toIso(780,0,0),toIso(780,620,0),toIso(0,620,0)],{fill:'rgba(255,255,255,.025)',stroke:'rgba(255,255,255,.08)','stroke-width':'2'});
    root.appendChild(floor);

    appState.layout.zones.forEach(z => {
      const pts = z.pts.map(p => toIso(p.x, p.y, 0));
      const isMainZone = prod?.zona === z.id;
      const isStoreZone = prod?.zonaStore === z.id;
      const isSearchZone = (prod?.zona || prod?.zonaStore) === z.id;
      const cls = 'zone-floor' + (isMainZone ? ' active' : '') + (isStoreZone ? ' storage' : '') + (isSearchZone ? ' search-focus' : '');
      const path = svgEl('path',{d:`M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y} L ${pts[3].x} ${pts[3].y} Z`,class:cls});
      root.appendChild(path);
      const c = centroid(z.pts); const ci = toIso(c.x,c.y,0);
      const label = svgEl('text',{x:ci.x,y:ci.y,class:'zone-label','text-anchor':'middle'}); label.textContent = z.id; root.appendChild(label);
      if(z.name && z.name.toUpperCase() !== z.id.toUpperCase()){
        const sub = svgEl('text',{x:ci.x,y:ci.y + 22,class:'ortho-label','text-anchor':'middle'}); sub.textContent = z.name; root.appendChild(sub);
      }
    });

    const racks = appState.layout.racks.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    racks.forEach(r => root.appendChild(buildIsoRack(r, prod)));
    enablePanZoom(svg, root, focusBoundsForProduct(prod));

    renderRackDetail(primaryRackId, { nivel: prod?.nivel || 0, slot: prod?.slot || 0, label: 'Ubicación', fullLabel: primaryLoc }, rackSvgPrimary);
    renderRackDetail(storeRackId, { nivel: prod?.nivelStore || 0, slot: prod?.slotStore || 0, label: 'Almacén', fullLabel: storeLoc }, rackSvgStore);
    if($('#rackPrimaryChip')) $('#rackPrimaryChip').textContent = primaryRackId || '—';
    if($('#rackStoreChip')) $('#rackStoreChip').textContent = storeRackId || '—';
    if($('#rackPrimaryLoc')) $('#rackPrimaryLoc').textContent = primaryLoc;
    if($('#rackStoreLoc')) $('#rackStoreLoc').textContent = storeLoc;
    contentStatus.textContent = prod ? `Producto activo: ${prod.sku} • ${prod.rack}` : 'Sin producto activo';
    contentFootRight.textContent = prod ? `${primaryLoc} • ALM: ${storeLoc}` : '—';
  }

  function buildBlinkMarker(x, y, color = '#ffd84d', store = false){
    const g = svgEl('g',{class:'marker-blink' + (store ? ' store' : ''), transform:`translate(${x} ${y})`});
    const stem = svgEl('line',{x1:'0',y1:'-18',x2:'0',y2:'-2',stroke:color,'stroke-width':'2.6','stroke-linecap':'round',opacity:'.92'});
    const circle = svgEl('circle',{cx:'0',cy:'-22',r:'5.5',fill:'none',stroke:color,'stroke-width':'2',opacity:'.8'});
    const arrow = svgEl('path',{class:'arrow-core',d:'M 0 0 L -8 -14 L -2 -14 L -2 -30 L 2 -30 L 2 -14 L 8 -14 Z',fill:color,stroke:'rgba(255,255,255,.45)','stroke-width':'0.8'});
    g.appendChild(circle);
    g.appendChild(stem);
    g.appendChild(arrow);
    return g;
  }

  function buildIsoRack(r, prod){
    const model = rackModel(r.modelId) || {};
    const g = svgEl('g',{class:'rack-iso','data-rack':r.id});
    const fp = getRackFootprint(r.modelId, r.rot || 0);
    const W = Math.max(24, Number(fp?.w || r.w || model.width || 120) || 120);
    const D = Math.max(18, Number(fp?.h || r.h || model.depth || 40) || 40);
    const H = Math.max(80, Number(r.rackHeight || model.height || 240) || 240);
    const main = prod?.rack === r.id;
    const store = prod?.rackStore === r.id;
    const selected = (appState.selectedRack || prod?.rack) === r.id;
    const levelHighlight = main ? Number(prod?.nivel || 0) : (store ? Number(prod?.nivelStore || 0) : 0);
    const searchHit = isRackSearchHit(r.id);
    const searchPrimary = appState.primaryHighlightedRackId === r.id;
    if(main) g.classList.add('active');
    if(store) g.classList.add('storage');
    if(selected) g.classList.add('selected');
    if(searchHit) g.classList.add('search-hit');
    if(searchPrimary) g.classList.add('selected');
    if(prod && !main && !store && !searchHit) g.classList.add('dim');

    const levels = Math.max(3, Number(model.levels || 4) || 4);
    const spacing = Math.max(24, (H - 18) / levels);
    const post = (x,y) => { const a=toIso(x,y,0), b=toIso(x,y,H); return svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'post'}); };
    [post(r.x,r.y),post(r.x+W,r.y),post(r.x,r.y+D),post(r.x+W,r.y+D)].forEach(el=>g.appendChild(el));
    for(let i=0;i<levels;i++){
      const z = i*spacing + 12;
      const deckClass = 'deck' + (levelHighlight === (i+1) ? ' level-active' : '');
      const deckFrontClass = 'deck-front' + (levelHighlight === (i+1) ? ' level-active' : '');
      const deckSideClass = 'deck-side' + (levelHighlight === (i+1) ? ' level-active' : '');
      g.appendChild(face([toIso(r.x,r.y,z),toIso(r.x+W,r.y,z),toIso(r.x+W,r.y+D,z),toIso(r.x,r.y+D,z)],{class:deckClass}));
      g.appendChild(face([toIso(r.x,r.y+D,z),toIso(r.x+W,r.y+D,z),toIso(r.x+W,r.y+D,z-3),toIso(r.x,r.y+D,z-3)],{class:deckFrontClass}));
      g.appendChild(face([toIso(r.x+W,r.y,z),toIso(r.x+W,r.y+D,z),toIso(r.x+W,r.y+D,z-3),toIso(r.x+W,r.y,z-3)],{class:deckSideClass}));
      if(i < levels-1){
        const bx = r.x + Math.max(4, W * 0.05);
        const bw = Math.max(18, W * 0.38);
        const by = r.y + Math.max(4, D * 0.18);
        const boxDepth = Math.max(16, D * 0.7);
        const boxTop = z + Math.max(16, spacing * 0.35);
        const boxBottom = z + 2;
        g.appendChild(face([toIso(bx,by,boxTop),toIso(bx+bw,by,boxTop),toIso(bx+bw,by+boxDepth,boxTop),toIso(bx,by+boxDepth,boxTop)],{class:'box-top'}));
        g.appendChild(face([toIso(bx,by+boxDepth,boxTop),toIso(bx+bw,by+boxDepth,boxTop),toIso(bx+bw,by+boxDepth,boxBottom),toIso(bx,by+boxDepth,boxBottom)],{class:'box-front'}));
        g.appendChild(face([toIso(bx+bw,by,boxTop),toIso(bx+bw,by+boxDepth,boxTop),toIso(bx+bw,by+boxDepth,boxBottom),toIso(bx+bw,by,boxBottom)],{class:'box-side'}));
      }
    }
    const lp = toIso(r.x + W/2, r.y + D/2, H + 18);
    const label = svgEl('text',{x:lp.x,y:lp.y,class:'rack-title','text-anchor':'middle'}); label.textContent = r.id; g.appendChild(label);
    if(main || store){
      const mk = toIso(r.x + W/2, r.y + D/2, H + 72);
      g.appendChild(buildBlinkMarker(mk.x, mk.y, main ? '#ffd84d' : '#72f29d', store && !main));
    }
    g.addEventListener('click', e => { e.stopPropagation(); appState.selectedRack = r.id; appState.selectedRackLayoutId = r.id; renderMapView(); });
    return g;
  }

  function renderRackDetail(rackId, prod = null, targetSvg = null, forcedModel = null, forcedRack = null){
    const rack = forcedRack || findRackById(rackId) || appState.layout.racks[0];
    const model = forcedModel || (rack ? rackModel(rack.modelId) : rackModel(appState.selectedModelId));
    const holder = targetSvg || $('#rackView');
    if(!holder) return;
    holder.innerHTML = '';
    holder.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const defs = svgEl('defs');
    const filter = svgEl('filter',{id:'slotGlow',x:'-60%',y:'-60%',width:'220%',height:'220%'});
    filter.appendChild(svgEl('feDropShadow',{dx:'0',dy:'0',stdDeviation:'10','flood-color':'#72ff3b','flood-opacity':'.8'}));
    defs.appendChild(filter); holder.appendChild(defs);

    const clearance = Math.max(0, model.clearance || 0);
    const levelSlots = buildLevelSlots(model);
    const levelHeights = buildLevelHeights(model);
    const styleKind = normalizeRackStyle(model.style);
    const rackDims = { x:-68, y:-22, w:model.width || 120, d:model.depth || 40, h:model.height || 240, levels:model.levels || 4, slots:Math.max(1, Math.min(12, Number(model.slots || model.capacity || 2) || 2)), clearance };
    const root = svgEl('g',{transform:`translate(0 118)`}); holder.appendChild(root);
    const floorY = clearance;
    root.appendChild(face([toIso(rackDims.x-28,rackDims.y-20,floorY),toIso(rackDims.x+rackDims.w+28,rackDims.y-20,floorY),toIso(rackDims.x+rackDims.w+28,rackDims.y+rackDims.d+20,floorY),toIso(rackDims.x-28,rackDims.y+rackDims.d+20,floorY)],{fill:'rgba(255,255,255,.04)',stroke:'rgba(146,170,198,.22)','stroke-width':'1.2'}));
    const thickness = 3;
    const line = (a,b, opacity='1')=>svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#355a83','stroke-width':'4','stroke-linecap':'round','stroke-opacity':opacity});
    const selectedLevel = Number(prod?.nivel || 0);
    const selectedSlot = Number(prod?.slot || 0);
    const totalLevelHeight = Math.max(1, levelHeights.reduce((sum, v) => sum + Math.max(10, Number(v) || 10), 0));
    const usableHeight = Math.max(40, rackDims.h - 24);
    const levelScale = usableHeight / totalLevelHeight;
    const levelTopInset = 12;
    const levelZs = [];
    const levelClearHeights = [];
    let zCursor = floorY + levelTopInset;
    for(let i=0;i<rackDims.levels;i++){
      levelZs.push(zCursor);
      const clearH = Math.max(16, (Math.max(10, Number(levelHeights[i] || 10)) * levelScale) - thickness - 2);
      levelClearHeights.push(clearH);
      zCursor += Math.max(10, Number(levelHeights[i] || 10)) * levelScale;
    }
    const shellT = styleKind === 'melamine' ? 2 : 0;
    const melInnerX0 = rackDims.x + shellT;
    const melInnerX1 = rackDims.x + rackDims.w - shellT;
    const melInnerY0 = rackDims.y;
    const melInnerY1 = rackDims.y + rackDims.d;
    const melInnerW = Math.max(20, melInnerX1 - melInnerX0);
    const melInnerD = Math.max(20, melInnerY1 - melInnerY0);

    let drawMelamineRightShell = null;
    let drawMelamineTopShell = null;
    if(styleKind === 'metallic'){
      [
        line(toIso(rackDims.x+rackDims.w,rackDims.y,floorY),toIso(rackDims.x+rackDims.w,rackDims.y,rackDims.h+floorY),'0.98'),
        line(toIso(rackDims.x,rackDims.y,floorY),toIso(rackDims.x,rackDims.y,rackDims.h+floorY),'0.98')
      ].forEach(el=>root.appendChild(el));
    } else {
      const shellFill = '#edf2f8';
      const shellFillDark = '#dbe4ef';
      const shellStroke = '#a8b8ca';
      const appendMelamineRightShell = () => {
        // front strip first, then outer right face so the panel reads with actual 2 cm thickness
        root.appendChild(face([
          toIso(rackDims.x + rackDims.w - shellT, rackDims.y + rackDims.d, floorY),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w - shellT, rackDims.y + rackDims.d, floorY + rackDims.h)
        ],{fill:'#d8e2ec',stroke:'#9fb1c6','stroke-width':'0.95'}));
        root.appendChild(face([
          toIso(rackDims.x+rackDims.w, rackDims.y, floorY),
          toIso(rackDims.x+rackDims.w, rackDims.y + rackDims.d, floorY),
          toIso(rackDims.x+rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x+rackDims.w, rackDims.y, floorY + rackDims.h)
        ],{fill:shellFillDark,stroke:'#94a8be','stroke-width':'1.1'}));
      };
      const appendMelamineTopShell = () => {
        root.appendChild(face([
          toIso(rackDims.x, rackDims.y, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x, rackDims.y + rackDims.d, floorY + rackDims.h)
        ],{fill:'#f3f6fb',stroke:'#afbfce','stroke-width':'1'}));
        root.appendChild(face([
          toIso(rackDims.x, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h - shellT),
          toIso(rackDims.x, rackDims.y + rackDims.d, floorY + rackDims.h - shellT)
        ],{fill:'#cfd9e6'}));
        root.appendChild(face([
          toIso(rackDims.x + rackDims.w, rackDims.y, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h - shellT),
          toIso(rackDims.x + rackDims.w, rackDims.y, floorY + rackDims.h - shellT)
        ],{fill:'#d6e0ea'}));
      };
      // left wall stays behind the contents
      root.appendChild(face([
        toIso(rackDims.x, rackDims.y, floorY),
        toIso(rackDims.x, rackDims.y + rackDims.d, floorY),
        toIso(rackDims.x, rackDims.y + rackDims.d, floorY + rackDims.h),
        toIso(rackDims.x, rackDims.y, floorY + rackDims.h)
      ],{fill:shellFill,stroke:shellStroke,'stroke-width':'1.1'}));
      // visible front strip so the left side panel has real thickness
      root.appendChild(face([
        toIso(rackDims.x, rackDims.y + rackDims.d, floorY),
        toIso(rackDims.x + shellT, rackDims.y + rackDims.d, floorY),
        toIso(rackDims.x + shellT, rackDims.y + rackDims.d, floorY + rackDims.h),
        toIso(rackDims.x, rackDims.y + rackDims.d, floorY + rackDims.h)
      ],{fill:'#d8e2ec',stroke:'#a8b8ca','stroke-width':'0.9'}));
      // optional back panel to close the cubicles visually
      root.appendChild(face([
        toIso(rackDims.x, rackDims.y, floorY),
        toIso(rackDims.x + rackDims.w, rackDims.y, floorY),
        toIso(rackDims.x + rackDims.w, rackDims.y, floorY + rackDims.h),
        toIso(rackDims.x, rackDims.y, floorY + rackDims.h)
      ],{fill:'rgba(237,242,248,.72)',stroke:'rgba(168,184,202,.55)','stroke-width':'1'}));
      // en melamina la base visible del mueble es el Nivel 1; evitamos una segunda bandeja extra en el piso
      root.appendChild(face([
        toIso(rackDims.x, rackDims.y + rackDims.d, floorY),
        toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY),
        toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY - shellT),
        toIso(rackDims.x, rackDims.y + rackDims.d, floorY - shellT)
      ],{fill:'#cad5e2'}));
      drawMelamineRightShell = appendMelamineRightShell;
      drawMelamineTopShell = appendMelamineTopShell;
    }

    for(let i=0;i<rackDims.levels;i++){
      const level = i+1, z = levelZs[i];
      const levelClass = selectedLevel === level;
      root.appendChild(face([toIso(styleKind === 'melamine' ? melInnerX0 : rackDims.x, styleKind === 'melamine' ? melInnerY0 : rackDims.y, z),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY0 : rackDims.y, z),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z),toIso(styleKind === 'melamine' ? melInnerX0 : rackDims.x, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z)],{fill:levelClass?'#ffe27f':'#e5edf7',stroke:levelClass?'#ffca2f':'#6c88a8','stroke-width':levelClass?'1.8':'1',filter:levelClass?'url(#slotGlow)':''}));
      root.appendChild(face([toIso(styleKind === 'melamine' ? melInnerX0 : rackDims.x, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z-thickness),toIso(styleKind === 'melamine' ? melInnerX0 : rackDims.x, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z-thickness)],{fill:levelClass?'#f4c73f':'#a8bdd2'}));
      root.appendChild(face([toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY0 : rackDims.y, z),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY1 : rackDims.y+rackDims.d, z-thickness),toIso(styleKind === 'melamine' ? melInnerX1 : rackDims.x+rackDims.w, styleKind === 'melamine' ? melInnerY0 : rackDims.y, z-thickness)],{fill:levelClass?'#e6b021':'#c1cedc'}));
      const slotCount = Math.max(1, levelSlots[i] || rackDims.slots || 1);
      const sideInset = styleKind === 'melamine' ? 0 : 6;
      const slotDepthInset = styleKind === 'melamine' ? 0 : 8;
      const shelfX0 = styleKind === 'melamine' ? melInnerX0 : rackDims.x;
      const shelfX1 = styleKind === 'melamine' ? melInnerX1 : (rackDims.x + rackDims.w);
      const shelfY0 = styleKind === 'melamine' ? melInnerY0 : rackDims.y;
      const shelfY1 = styleKind === 'melamine' ? melInnerY1 : (rackDims.y + rackDims.d);
      const usableSlotWidth = Math.max(16, (shelfX1 - shelfX0) - sideInset * 2);
      const slotSpan = usableSlotWidth / slotCount;
      const dividerW = styleKind === 'melamine' ? shellT : Math.max(3, Math.min(6, rackDims.w * 0.024));
      const dividerY0 = styleKind === 'melamine' ? rackDims.y : (shelfY0 + slotDepthInset);
      const dividerY1 = styleKind === 'melamine' ? (rackDims.y + rackDims.d) : (shelfY1 - slotDepthInset);
      const dividerTopZ = (i < levelZs.length - 1)
        ? Math.max(z + thickness + 12, levelZs[i + 1] - thickness)
        : Math.max(z + thickness + 18, floorY + rackDims.h - shellT);
      const dividerH = Math.max(18, dividerTopZ - (z + thickness));

      const drawMelamineDivider = (centerX) => {
        const dx0 = centerX - dividerW / 2;
        const dx1 = centerX + dividerW / 2;
        root.appendChild(face([
          toIso(dx0, dividerY0, z + thickness),
          toIso(dx1, dividerY0, z + thickness),
          toIso(dx1, dividerY1, z + thickness),
          toIso(dx0, dividerY1, z + thickness)
        ],{fill:'#eef3f8',stroke:'#afbfce','stroke-width':'0.9'}));
        root.appendChild(face([
          toIso(dx0, dividerY1, z + thickness),
          toIso(dx1, dividerY1, z + thickness),
          toIso(dx1, dividerY1, dividerTopZ),
          toIso(dx0, dividerY1, dividerTopZ)
        ],{fill:'#cfdae6',stroke:'#aebecd','stroke-width':'0.8'}));
        root.appendChild(face([
          toIso(dx1, dividerY0, z + thickness),
          toIso(dx1, dividerY1, z + thickness),
          toIso(dx1, dividerY1, dividerTopZ),
          toIso(dx1, dividerY0, dividerTopZ)
        ],{fill:'#dce5ef',stroke:'#b7c5d3','stroke-width':'0.8'}));
        root.appendChild(face([
          toIso(dx0, dividerY0, z + thickness),
          toIso(dx0, dividerY1, z + thickness),
          toIso(dx0, dividerY1, dividerTopZ),
          toIso(dx0, dividerY0, dividerTopZ)
        ],{fill:'#d4dee9',stroke:'#aebecd','stroke-width':'0.8'}));
      };

      const slotGeometries = [];
      for(let s=1;s<=slotCount;s++){
        const slotStart = shelfX0 + sideInset + (s-1) * slotSpan;
        const slotInnerPad = styleKind === 'melamine' ? 2 : 2;
        const x0 = slotStart + slotInnerPad;
        const sw = Math.max(10, slotSpan - slotInnerPad * 2 - (styleKind === 'melamine' ? dividerW * 0.25 : 0));
        const slotClass = (selectedLevel === level && selectedSlot === s);
        slotGeometries.push({ s, slotClass, x0, sw });
      }

      const drawStorageBox = ({slotClass, bx, bw, by, boxDepth, boxBottomZ, boxTopZ, dividerTopZ}) => {
        const boxHeight = Math.max(20, Math.min((dividerTopZ - boxBottomZ) - 4, (dividerTopZ - boxBottomZ) * 0.72));
        const effectiveTopZ = boxBottomZ + boxHeight;
        const lidRise = Math.max(3, Math.min(7, boxHeight * 0.12));
        const lidTopZ = Math.min(dividerTopZ - 2, effectiveTopZ + lidRise);
        const lidOverhang = Math.max(1.6, Math.min(3.6, bw * 0.045));
        const lidFront = Math.max(shelfY0 + 1, by - 1.3);
        const lidBack = Math.min(shelfY1 - 1, by + boxDepth + 1.3);
        const tapeX0 = bx + bw * 0.42;
        const tapeX1 = tapeX0 + Math.max(4, bw * 0.09);
        const labelW = Math.max(10, bw * 0.26);
        const labelH = Math.max(6, boxHeight * 0.15);
        const labelX = bx + bw * 0.2;
        const labelY = by + boxDepth - 0.6;
        const labelTopZ = boxBottomZ + boxHeight * 0.38;
        const handleW = Math.max(7, bw * 0.18);
        const handleH = Math.max(2.4, boxHeight * 0.075);
        const handleX = bx + bw * 0.42;
        const handleTopZ = effectiveTopZ - boxHeight * 0.16;
        const handleY = by + 0.2;
        const colors = slotClass ? {top:'#8cff4b', front:'#69e230', right:'#5dd228', lid:'#b0ff79', lidFront:'#8de75d', lidRight:'#7ad848', tape:'#78cc45'}
                                 : {top:'#ebbb7a', front:'#d8a260', right:'#c98e4d', lid:'#f2c98f', lidFront:'#dfb273', lidRight:'#cf9853', tape:'#b67a3d'};

        root.appendChild(face([
          toIso(bx, by, effectiveTopZ),
          toIso(bx+bw, by, effectiveTopZ),
          toIso(bx+bw, by+boxDepth, effectiveTopZ),
          toIso(bx, by+boxDepth, effectiveTopZ)
        ],{fill:colors.top,stroke:slotClass?'#53d61d':'#9b6829','stroke-width':'1.1',filter:slotClass?'url(#slotGlow)':''}));
        root.appendChild(face([
          toIso(bx, by+boxDepth, effectiveTopZ),
          toIso(bx+bw, by+boxDepth, effectiveTopZ),
          toIso(bx+bw, by+boxDepth, boxBottomZ),
          toIso(bx, by+boxDepth, boxBottomZ)
        ],{fill:colors.front,stroke:'rgba(128,83,25,.55)','stroke-width':'0.8'}));
        root.appendChild(face([
          toIso(bx+bw, by, effectiveTopZ),
          toIso(bx+bw, by+boxDepth, effectiveTopZ),
          toIso(bx+bw, by+boxDepth, boxBottomZ),
          toIso(bx+bw, by, boxBottomZ)
        ],{fill:colors.right,stroke:'rgba(116,75,22,.45)','stroke-width':'0.8'}));

        root.appendChild(face([
          toIso(bx-lidOverhang, lidFront, lidTopZ),
          toIso(bx+bw+lidOverhang, lidFront, lidTopZ),
          toIso(bx+bw+lidOverhang, lidBack, lidTopZ),
          toIso(bx-lidOverhang, lidBack, lidTopZ)
        ],{fill:colors.lid,stroke:'rgba(176,116,49,.65)','stroke-width':'0.9'}));
        root.appendChild(face([
          toIso(bx-lidOverhang, lidBack, lidTopZ),
          toIso(bx+bw+lidOverhang, lidBack, lidTopZ),
          toIso(bx+bw+lidOverhang, lidBack, effectiveTopZ),
          toIso(bx-lidOverhang, lidBack, effectiveTopZ)
        ],{fill:colors.lidFront}));
        root.appendChild(face([
          toIso(bx+bw+lidOverhang, lidFront, lidTopZ),
          toIso(bx+bw+lidOverhang, lidBack, lidTopZ),
          toIso(bx+bw+lidOverhang, lidBack, effectiveTopZ),
          toIso(bx+bw+lidOverhang, lidFront, effectiveTopZ)
        ],{fill:colors.lidRight}));

        root.appendChild(face([
          toIso(tapeX0, lidFront + 0.5, lidTopZ + 0.03),
          toIso(tapeX1, lidFront + 0.5, lidTopZ + 0.03),
          toIso(tapeX1, lidBack - 0.5, lidTopZ + 0.03),
          toIso(tapeX0, lidBack - 0.5, lidTopZ + 0.03)
        ],{fill:colors.tape,stroke:'none'}));

        root.appendChild(face([
          toIso(labelX, labelY, labelTopZ),
          toIso(labelX + labelW, labelY, labelTopZ),
          toIso(labelX + labelW, labelY, labelTopZ - labelH),
          toIso(labelX, labelY, labelTopZ - labelH)
        ],{fill:'rgba(255,248,234,.96)',stroke:'rgba(214,194,162,.65)','stroke-width':'0.45'}));

        root.appendChild(face([
          toIso(handleX, handleY, handleTopZ),
          toIso(handleX + handleW, handleY, handleTopZ),
          toIso(handleX + handleW, handleY, handleTopZ - handleH),
          toIso(handleX, handleY, handleTopZ - handleH)
        ],{fill:'rgba(84,52,24,.92)',stroke:'rgba(60,36,12,.4)','stroke-width':'0.35'}));
      };

      const drawSlotBox = ({ s, slotClass, x0, sw }) => {
        root.appendChild(face([
          toIso(x0, shelfY0 + 8, z + 1),
          toIso(x0+sw, shelfY0 + 8, z + 1),
          toIso(x0+sw, shelfY1 - 8, z + 1),
          toIso(x0, shelfY1 - 8, z + 1)
        ],{fill:slotClass?'rgba(255,216,77,.86)':'transparent',stroke:slotClass?'#ffc400':'rgba(201,216,237,.18)','stroke-width':slotClass?'1.5':'1',filter:slotClass?'url(#slotGlow)':''}));
        if(slotClass){ const mk = toIso(x0 + sw/2, shelfY0 + (shelfY1-shelfY0)/2, z + Math.min(88, dividerH * 0.7)); root.appendChild(buildBlinkMarker(mk.x, mk.y, '#ffd84d', false)); }
        if(styleKind === 'melamine'){
          const boxDepth = Math.max(18, (shelfY1 - shelfY0) - 2.2);
          const boxInsetX = Math.max(2.2, Math.min(4.5, sw * 0.05));
          const bx = x0 + boxInsetX;
          const bw = Math.max(14, sw - boxInsetX * 2);
          const by = shelfY0 + 0.8;
          const boxBottomZ = z + thickness + 2;
          drawStorageBox({ slotClass, bx, bw, by, boxDepth, boxBottomZ, boxTopZ: dividerTopZ - 6, dividerTopZ });
        } else {
          const boxDepth = Math.max(18, (shelfY1 - shelfY0) - 10);
          const bx = x0 + 2, bw = Math.max(8, sw - 4);
          const by = shelfY0 + 5;
          const boxBottomZ = z + 4;
          drawStorageBox({ slotClass, bx, bw, by, boxDepth, boxBottomZ, boxTopZ: dividerTopZ - 8, dividerTopZ });
        }
      };

      if(styleKind === 'melamine'){
        slotGeometries.forEach((geom, idx) => {
          drawSlotBox(geom);
          if(idx < slotCount - 1){
            const centerX = shelfX0 + sideInset + slotSpan * (idx + 1);
            drawMelamineDivider(centerX);
          }
        });
      } else {
        slotGeometries.forEach(drawSlotBox);
      }
      const refSpacing = i < levelClearHeights.length ? levelClearHeights[i] : (usableHeight / Math.max(1, rackDims.levels));
      const lt = toIso(rackDims.x + rackDims.w + 18, rackDims.y + rackDims.d * 0.72, z + Math.max(12, refSpacing * 0.42));
      const txt = svgEl('text',{x:lt.x,y:lt.y,fill:levelClass?'#ffd84d':'#cbdcf4','font-size':levelClass?'13':'12','font-weight':'900','text-anchor':'start'}); txt.textContent = 'N' + level; root.appendChild(txt);
    }

    if(styleKind === 'metallic'){
      [
        line(toIso(rackDims.x,rackDims.y+rackDims.d,floorY),toIso(rackDims.x,rackDims.y+rackDims.d,rackDims.h+floorY)),
        line(toIso(rackDims.x+rackDims.w,rackDims.y+rackDims.d,floorY),toIso(rackDims.x+rackDims.w,rackDims.y+rackDims.d,rackDims.h+floorY))
      ].forEach(el=>root.appendChild(el));
    } else {
      if(drawMelamineRightShell) drawMelamineRightShell();
      if(drawMelamineTopShell) drawMelamineTopShell();
    }
    const title = svgEl('text',{x:toIso(rackDims.x+rackDims.w/2,rackDims.y+rackDims.d/2,rackDims.h+24).x,y:toIso(rackDims.x+rackDims.w/2,rackDims.y+rackDims.d/2,rackDims.h+24).y,fill:'#eaf3ff','font-size':'14','font-weight':'900','text-anchor':'middle'});
    title.textContent = rackId || model.name; root.appendChild(title);
    const floorLabelPos = toIso(rackDims.x + rackDims.w/2, rackDims.y + rackDims.d + 28, floorY);
    const floorLabel = svgEl('text',{x:floorLabelPos.x,y:floorLabelPos.y,fill:'#8fa8c7','font-size':'11','font-weight':'700','text-anchor':'middle'});
    floorLabel.textContent = `Piso ${clearance}cm`; root.appendChild(floorLabel);
    try {
      const bb = root.getBBox();
      const pad = 72;
      let vx = Math.floor(bb.x - pad);
      let vy = Math.floor(bb.y - pad);
      let vw = Math.ceil(bb.width + pad * 2);
      let vh = Math.ceil(bb.height + pad * 2);
      if(holder && (holder.id === 'rackViewPrimary' || holder.id === 'rackViewStore')){
        const holderW = Math.max(1, holder.clientWidth || Number(holder.getAttribute('width')) || 320);
        const holderH = Math.max(1, holder.clientHeight || Number(holder.getAttribute('height')) || 320);
        const aspect = holderW / holderH;
        const occupy = 0.85;
        const rackPts = [
          toIso(rackDims.x, rackDims.y, floorY - shellT),
          toIso(rackDims.x + rackDims.w, rackDims.y, floorY - shellT),
          toIso(rackDims.x, rackDims.y + rackDims.d, floorY - shellT),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY - shellT),
          toIso(rackDims.x, rackDims.y, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y, floorY + rackDims.h),
          toIso(rackDims.x, rackDims.y + rackDims.d, floorY + rackDims.h),
          toIso(rackDims.x + rackDims.w, rackDims.y + rackDims.d, floorY + rackDims.h)
        ];
        const xs = rackPts.map(p => p.x);
        const ys = rackPts.map(p => p.y);
        const rackBox = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
          height: Math.max(1, Math.max(...ys) - Math.min(...ys))
        };
        const boxCx = rackBox.x + rackBox.width / 2;
        const boxCy = rackBox.y + rackBox.height / 2;
        let fitW = rackBox.width / occupy;
        let fitH = rackBox.height / occupy;
        const rackAspect = fitW / Math.max(1, fitH);
        if(rackAspect > aspect){
          fitH = fitW / aspect;
        } else {
          fitW = fitH * aspect;
        }
        vw = Math.max(80, fitW);
        vh = Math.max(100, fitH);
        vx = boxCx - (vw / 2);
        vy = boxCy - (vh / 2);
      }
      holder.setAttribute('viewBox', `${Math.floor(vx)} ${Math.floor(vy)} ${Math.ceil(vw)} ${Math.ceil(vh)}`);
    } catch(err) {}
    detailStatus.textContent = prod ? `${rackId} • N${prod.nivel} • S${prod.slot}` : (rackId || model.name);
    detailChip.textContent = `${model.levels} niveles`;
  }

  function enablePanZoom(svg, target, focusBounds = null){
    let scale = 1, tx = 20, ty = 170, dragging = false, sx = 0, sy = 0;
    const apply = () => target.setAttribute('transform', `translate(${tx} ${ty}) scale(${scale})`);

    if(focusBounds){
      const vw = 1220, vh = 820;
      const bw = Math.max(120, focusBounds.maxX - focusBounds.minX);
      const bh = Math.max(120, focusBounds.maxY - focusBounds.minY);
      const pad = 120;
      scale = Math.max(.72, Math.min(1.55, Math.min((vw - pad) / bw, (vh - pad) / bh)));
      const cx = (focusBounds.minX + focusBounds.maxX) / 2;
      const cy = (focusBounds.minY + focusBounds.maxY) / 2;
      tx = (vw / 2) - (cx * scale);
      ty = (vh / 2) - (cy * scale);
    }

    apply();
    svg.onwheel = e => { e.preventDefault(); scale = Math.max(.65, Math.min(2.3, scale + (e.deltaY > 0 ? -0.08 : 0.08))); apply(); };
    svg.onpointerdown = e => { if(e.target.closest('.rack-iso')) return; dragging = true; sx = e.clientX - tx; sy = e.clientY - ty; svg.setPointerCapture(e.pointerId); };
    svg.onpointermove = e => { if(!dragging) return; tx = e.clientX - sx; ty = e.clientY - sy; apply(); };
    svg.onpointerup = () => dragging = false; svg.onpointercancel = () => dragging = false;
  }

  function renderLayoutEditor(){
    contentTitle.textContent = 'Edición de Layout';
    appState.editor.view = 'ortho';
    const isIsoView = false;
    const selectedRack = findRackById(appState.selectedRackLayoutId);
    const selectedRackModel = selectedRack ? rackModel(selectedRack.modelId) : null;
    const selectedRackFootprint = selectedRack ? getRackFootprint(selectedRack.modelId, selectedRack.rot || 0) : null;
    contentSubtitle.textContent = 'Vista ortogonal editable: zonas, vértices y racks.';
    detailTitle.textContent = 'Inspector de layout';
    detailSubtitle.textContent = 'Propiedades de zona, rack y acciones rápidas.';
    setTags([
      { label:'ortogonal', active:true },
      { label:'mover zonas', active: appState.editor.mode === 'navigate' },
      { label:'agregar vértices', active: appState.editor.mode === 'zone' || (appState.selectedEdge?.a ?? -1) >= 0 },
      { label:'mover aristas', active: (appState.selectedEdge?.a ?? -1) >= 0 },
      { label:'snap a grid', active:true },
      { label:'cotas', active: !!appState.editor.showDims }
    ]);

    contentWrap.innerHTML = `
      <div class="stage" style="position:relative;height:100%">
        <div class="layout-shell">
          <aside class="layout-inner-sidebar">
            <div class="layout-tool-top">
              <select id="layoutBranchSelect" class="seg-btn" style="width:100%;padding-right:28px">${(appState.admin.branches||[]).map((b,i)=>`<option value="${i}" ${i===getActiveLayoutBranchIndex()?'selected':''}>${escapeHtml(b.name||('Sucursal '+(i+1)))}</option>`).join('')}</select>
            </div>
            <div class="layout-tool-list">
              <div class="layout-tool-group">
                <div class="layout-tool-group-title">Edición</div>
                <div class="layout-inline-2">
                  <button class="seg-btn ${appState.editor.mode==='select'?'active':''}" data-emode="select">Seleccionar</button>
                  <button class="seg-btn ${appState.editor.mode==='navigate'?'active':''}" id="btnToggleNav">Navegar</button>
                </div>
                <button class="seg-btn ${appState.editor.showDims ? 'active' : ''}" id="btnToggleDims">Cotas</button>
                <div class="layout-inline-2">
                  <button class="seg-btn ${appState.editor.mode==='zone'?'active':''}" id="btnZonePlus">Zonas +</button>
                  <button class="seg-btn" id="btnZoneMinus">Zonas −</button>
                </div>
                <div class="layout-inline-2">
                  <button class="seg-btn" id="btnVertexPlus">Vértice +</button>
                  <button class="seg-btn" id="btnVertexMinus">Vértice −</button>
                </div>
                <div class="layout-inline-2">
                  <button class="seg-btn ${appState.editor.mode==='rack'?'active':''}" data-emode="rack">Agregar rack</button>
                  <button class="seg-btn" id="btnRotateRack">Rotar 90°</button>
                </div>
                <button class="seg-btn" id="btnDuplicateZone">Duplicar zona</button>
                <button class="seg-btn" id="btnDuplicateRack">Duplicar rack</button>
                <button class="seg-btn" id="btnApplyModelSelection">Aplicar modelo</button>
                <button class="seg-btn" id="btnDeleteSelected">Eliminar selección</button>
                <button class="seg-btn ${appState.editor.zonesLocked ? 'active' : ''}" id="btnLockZones">${appState.editor.zonesLocked ? 'Zonas bloqueadas' : 'Bloquear zonas'}</button>
                <button class="seg-btn ${appState.editor.sectionVisible ? 'active' : ''}" id="btnToggleSection">Sección ${appState.editor.sectionVisible ? 'ON' : 'OFF'}</button>
              </div>
              <div class="layout-tool-group layout-rack-sidebar-group" style="margin-top:2px">
                <div class="layout-tool-group-title">Rack seleccionado</div>
                ${!selectedRack ? `
                  <div class="tiny muted" style="padding:6px 4px 2px">Selecciona un rack para editar su modelo, altura y rotación desde aquí.</div>
                ` : `
                  <label class="tiny muted">Modelo de rack</label>
                  <select id="sideRackModel" class="seg-btn" style="width:100%;padding-right:28px">${appState.models.map(m => `<option value="${m.id}" ${m.id===selectedRack.modelId?'selected':''}>${m.name}</option>`).join('')}</select>
                  <div class="layout-inline-2">
                    <div>
                      <label class="tiny muted">Rotación</label>
                      <input id="sideRackRot" type="number" step="1" value="${Math.round(Number(selectedRack.rot || 0))}">
                    </div>
                    <div>
                      <label class="tiny muted">Altura base</label>
                      <input id="sideRackBaseH" type="number" min="0" step="10" value="${Math.round(Number(selectedRack.baseHeight || 0))}">
                    </div>
                  </div>
                  <div class="layout-inline-2">
                    <div>
                      <label class="tiny muted">Altura rack</label>
                      <input id="sideRackHeight" type="number" min="60" step="10" value="${Math.round(Number(selectedRack.rackHeight || selectedRackModel?.height || 238))}">
                    </div>
                    <div>
                      <label class="tiny muted">Nivel apilado</label>
                      <input id="sideRackStackLevel" type="number" min="0" step="1" value="${getRackLevelValue(selectedRack)}">
                    </div>
                  </div>
                  <div class="layout-inline-2">
                    <div class="kv-row" style="padding:10px 12px"><b>Vista sección</b><span>${appState.editor.sectionVisible ? 'Activa' : 'Oculta'}</span></div>
                    <div class="kv-row" style="padding:10px 12px"><b>Cota superior</b><span>${formatDistanceCm((getRackVerticalBase(selectedRack) + Number(selectedRack.rackHeight || selectedRackModel?.height || 238)))}</span></div>
                  </div>
                  <button class="seg-btn" id="btnRackAddAbove">Rack encima</button>
                  <div class="layout-inline-3" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                    <div class="kv-row" style="padding:10px 12px"><b>Ancho</b><span>${formatDistanceShort(selectedRackFootprint?.baseW || 0)}</span></div>
                    <div class="kv-row" style="padding:10px 12px"><b>Fondo</b><span>${formatDistanceShort(selectedRackFootprint?.baseH || 0)}</span></div>
                    <div class="kv-row" style="padding:10px 12px"><b>Zona</b><span>${escapeHtml(selectedRack.zoneId)}</span></div>
                  </div>
                  <label class="tiny muted">Ángulos rápidos</label>
                  <div class="tag-row"><button class="seg-btn quick-angle" data-angle="0">0°</button><button class="seg-btn quick-angle" data-angle="90">90°</button><button class="seg-btn quick-angle" data-angle="180">180°</button><button class="seg-btn quick-angle" data-angle="270">270°</button></div>
                  <div class="kv-row" style="padding:10px 12px"><b>Seleccionados</b><span>${getSelectedRackIds().length || 0}</span></div>
                  <div class="kv-row" style="padding:10px 12px"><b>Referencia visual</b><span>Línea naranja = frente del rack</span></div>
                `}
              </div>
              <div class="layout-tool-group" style="margin-top:2px">
                <div class="layout-tool-group-title">Zoom</div>
                <div class="layout-inline-3">
                  <button class="seg-btn" id="btnZoomOut">−</button>
                  <div class="zoom-chip" id="zoomLabel">100%</div>
                  <button class="seg-btn" id="btnZoomIn">+</button>
                </div>
                <button class="seg-btn" id="btnZoomFit">Ajustar</button>
              </div>
            </div>
          </aside>
          <div class="layout-main-stage ${appState.editor.sectionVisible ? 'with-section' : ''}">
            <div class="layout-canvas-wrap">
              <div class="layout-canvas-card detail-stage"><svg id="layoutSvg"></svg></div>
              <div id="layoutStackMenu" class="layout-stack-overlay"></div>
            </div>
            <div id="layoutSectionWrap"></div>
          </div>
        </div>
      </div>`;
    detailWrap.innerHTML = `<div class="stage" style="padding:14px;overflow:auto"><div id="layoutInspector"></div></div>`;

    const svg = $('#layoutSvg');
    const currentBox = appState.editor.viewBox || { x:0, y:0, w:900, h:620 };
    if(!appState.editor.viewBoxCustomized || (currentBox.x===0 && currentBox.y===0 && currentBox.w===900 && currentBox.h===620)) fitLayoutViewBox();
    renderLayoutSvg(svg);
    renderLayoutSection();
    renderLayoutInspector();
    renderLayoutStackMenu();
    bindLayoutToolbar();
    const zl = $('#zoomLabel'); if(zl){ const vb = appState.editor.viewBox || {w:900}; zl.textContent = `${Math.round((900 / vb.w) * 100)}%`; }
  }

  function renderLayoutStackMenu(){
    const mount = document.getElementById('layoutStackMenu');
    if(!mount) return;
    const state = appState.editor.stackMenu || { open:false };
    const rack = findRackById(state.rackId);
    const summary = rack ? rackStackSummary(rack) : { count:0, members:[] };
    if(!state.open || !rack || summary.count <= 1){
      mount.innerHTML = '';
      return;
    }
    const rows = summary.members.map(member => {
      const active = member.id === appState.selectedRackLayoutId;
      const model = rackModel(member.modelId);
      const topCm = Number(member.baseHeight||0) + Number(member.rackHeight || model.height || 238);
      return `<button type="button" class="stack-row ${active?'active':''}" data-stack-rack="${member.id}" style="width:100%;text-align:left;border:1px solid rgba(255,255,255,.08);background:${active?'rgba(86,210,255,.15)':'rgba(255,255,255,.03)'};color:#e8f1fb;border-radius:12px;padding:10px 12px;cursor:pointer;display:grid;gap:4px"><b>${escapeHtml(member.id)}</b><span class="tiny muted">${escapeHtml(model.name)} · ${model.levels||4} niveles · ${formatDistanceCm(topCm)}</span></button>`;
    }).join('');
    mount.innerHTML = `<div style="position:absolute;left:${Math.max(12,state.x)}px;top:${Math.max(58,state.y)}px;z-index:8;min-width:260px;max-width:320px;background:rgba(7,17,29,.98);border:1px solid rgba(255,255,255,.10);box-shadow:0 18px 40px rgba(0,0,0,.38);border-radius:16px;padding:12px;display:grid;gap:10px"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-weight:800">Superposición de racks</div><div class="tiny muted">${summary.count} racks en la misma huella</div></div><button type="button" id="stackMenuCloseBtn" class="seg-btn" style="padding:8px 10px">Cerrar</button></div><div style="display:grid;gap:8px">${rows}</div></div>`;
    const closeBtn = document.getElementById('stackMenuCloseBtn');
    if(closeBtn) closeBtn.onclick = () => { closeStackMenu(); renderLayoutStackMenu(); };
    mount.querySelectorAll('[data-stack-rack]').forEach(btn => btn.onclick = () => {
      const rackId = btn.getAttribute('data-stack-rack');
      const target = findRackById(rackId);
      if(!target) return;
      appState.selectedRackLayoutId = target.id;
      appState.selectedZoneId = target.zoneId;
      renderLayoutEditor();
    });
  }



  function findZoneBadgePlacement(zone, badgeW, badgeH){
    const zb = zoneBoundsOf(zone);
    const racks = (appState.layout.racks||[]).filter(r => r.zoneId === zone.id);
    const candidates = [
      {x:zb.minX+12,y:zb.minY+12},
      {x:zb.maxX-badgeW-12,y:zb.minY+12},
      {x:zb.minX+12,y:zb.maxY-badgeH-12},
      {x:zb.maxX-badgeW-12,y:zb.maxY-badgeH-12}
    ];
    const overlap=(c)=>racks.some(r=>{
      const fp=getRackFootprint(r.modelId, r.rot||0); const w=fp.w||r.w||40, h=fp.h||r.h||28;
      const cx=(r.x||0)+w/2, cy=(r.y||0)+h/2; const rx=cx-w/2-10, ry=cy-h/2-10, rw=w+20, rh=h+20;
      return !(c.x+badgeW < rx || c.x > rx+rw || c.y+badgeH < ry || c.y > ry+rh);
    });
    return candidates.find(c=>!overlap(c)) || candidates[0];
  }


  function getLayoutContentBounds(){
    const zones = appState.layout?.zones || [];
    const racks = appState.layout?.racks || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    zones.forEach(zone => {
      const zb = zoneBounds(zone);
      minX = Math.min(minX, zb.minX);
      minY = Math.min(minY, zb.minY);
      maxX = Math.max(maxX, zb.maxX);
      maxY = Math.max(maxY, zb.maxY);
    });
    racks.forEach(r => {
      const x = Number(r.x || 0), y = Number(r.y || 0);
      const w = Math.max(1, Number(r.w || 0)), h = Math.max(1, Number(r.h || 0));
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
    if(!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return { x:0, y:0, w:900, h:620 };
    return { x:minX, y:minY, w:Math.max(240, maxX - minX), h:Math.max(180, maxY - minY) };
  }

  function fitLayoutViewBox(){
    const bounds = getLayoutContentBounds();
    const svg = document.getElementById('layoutSvg');
    const width = Math.max(1, svg?.clientWidth || 0);
    const height = Math.max(1, svg?.clientHeight || 0);
    const viewportRatio = width && height ? width / height : 1.65;
    const padX = 48;
    const padY = 44;
    let box = {
      x: bounds.x - padX,
      y: bounds.y - padY,
      w: bounds.w + padX * 2,
      h: bounds.h + padY * 2
    };
    const targetRatio = viewportRatio > 0 ? viewportRatio : (box.w / box.h);
    const currentRatio = box.w / box.h;
    if(currentRatio < targetRatio){
      const targetW = box.h * targetRatio;
      box.x -= (targetW - box.w) / 2;
      box.w = targetW;
    } else if(currentRatio > targetRatio){
      const targetH = box.w / targetRatio;
      box.y -= (targetH - box.h) / 2;
      box.h = targetH;
    }
    appState.editor.viewBox = box;
    appState.editor.viewBoxCustomized = false;
    return box;
  }

  function getLayoutRenderViewBox(svg, vb){
    const width = Math.max(1, svg?.clientWidth || 0);
    const height = Math.max(1, svg?.clientHeight || 0);
    if(!width || !height) return vb;
    const viewportRatio = width / height;
    const viewRatio = vb.w / vb.h;
    if(Math.abs(viewportRatio - viewRatio) < 0.01) return vb;
    if(viewportRatio > viewRatio){
      const targetW = vb.h * viewportRatio;
      return { x: vb.x - (targetW - vb.w) / 2, y: vb.y, w: targetW, h: vb.h };
    }
    const targetH = vb.w / viewportRatio;
    return { x: vb.x, y: vb.y - (targetH - vb.h) / 2, w: vb.w, h: targetH };
  }

  function renderLayoutSvg(svg){
    svg = svg || document.getElementById('layoutSvg') || document.getElementById('layout-svg');
    if(!svg) return;
    appState.editor.view = 'ortho';
    svg.innerHTML = '';
    const vb = appState.editor.viewBox || { x:0, y:0, w:900, h:620 };
    const renderVb = getLayoutRenderViewBox(svg, vb);
    svg.setAttribute('viewBox', `${renderVb.x} ${renderVb.y} ${renderVb.w} ${renderVb.h}`);
    const panSurface = svgEl('rect',{x:vb.x-1400,y:vb.y-1400,width:vb.w+2800,height:vb.h+2800,fill:'transparent',class:'layout-pan-surface',style:'cursor:grab'});
    svg.appendChild(panSurface);
    panSurface.addEventListener('pointerdown', evt => {
      const shouldPan = appState.editor.mode === 'navigate' || evt.shiftKey || evt.button === 1;
      if(!shouldPan) return;
      evt.preventDefault();
      evt.stopPropagation();
      appState.editor.dragging = { type:'pan-layout', startClient:{ x:evt.clientX, y:evt.clientY }, originalViewBox: clone(appState.editor.viewBox || { x:0, y:0, w:900, h:620 }) };
      appState.editor.viewBoxCustomized = true;
      svg.setPointerCapture?.(evt.pointerId);
    });
    const grid = svgEl('g',{class:'ortho-grid'});
    for(let x=-800;x<=1700;x+=40) grid.appendChild(svgEl('line',{x1:x,y1:-800,x2:x,y2:1600}));
    for(let y=-800;y<=1600;y+=40) grid.appendChild(svgEl('line',{x1:-800,y1:y,x2:1700,y2:y}));
    svg.appendChild(grid);

    const edgeLayer = svgEl('g');
    const zoneLayer = svgEl('g');
    const guideLayer = svgEl('g');
    const rackLayer = svgEl('g');
    const measureLayer = svgEl('g');
    const vertexLayer = svgEl('g');
    svg.append(edgeLayer, zoneLayer, rackLayer, guideLayer, measureLayer, vertexLayer);


    const flipSectionDirection = (axis) => {
      const cut = getSectionCut(axis);
      cut.dir = cut.dir === -1 ? 1 : -1;
      renderLayoutEditor();
    };

    const drawSectionGuide = (zone, axis) => {
      const zb = zoneBounds(zone);
      const isY = axis === 'y';
      const color = isY ? '#ff5b5b' : '#58c5ff';
      const cut = clampSectionCut(zone, axis);
      const linePos = getSectionLinePosition(zone, axis);
      const extend = 38;
      const x1 = isY ? zb.minX - extend : linePos;
      const y1 = isY ? linePos : zb.minY - extend;
      const x2 = isY ? zb.maxX + extend : linePos;
      const y2 = isY ? linePos : zb.maxY + extend;
      const guide = svgEl('line',{ x1,y1,x2,y2, stroke:color, 'stroke-width':'2.5', 'stroke-dasharray':'10 8', opacity:'.98', style:isY ? 'cursor:ns-resize' : 'cursor:ew-resize' });
      guide.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'line'));
      guideLayer.appendChild(guide);
      const rangeLimit = getSectionRangeLimit(zone, axis);
      if(isY){
        const bandY1 = Math.min(linePos, rangeLimit), bandY2 = Math.max(linePos, rangeLimit);
        guideLayer.appendChild(svgEl('rect',{x:zb.minX,y:bandY1,width:Math.max(1,zb.maxX-zb.minX),height:Math.max(1,bandY2-bandY1),class:'section-range-fill'}));
        const rangeLine = svgEl('line',{x1:zb.minX-8,y1:rangeLimit,x2:zb.maxX+8,y2:rangeLimit,stroke:color,'stroke-width':'2.5','stroke-dasharray':'10 8',opacity:'.98',style:'cursor:ns-resize'});
        rangeLine.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rangeLine);
        const rHandleL = svgEl('circle',{cx:zb.minX-8, cy:rangeLimit, r:'6', class:'section-range-handle', fill:color, stroke:color});
        rHandleL.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rHandleL);
        const rHandleR = svgEl('circle',{cx:zb.maxX+8, cy:rangeLimit, r:'6', class:'section-range-handle', fill:color, stroke:color});
        rHandleR.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rHandleR);
        const rHandle = svgEl('circle',{cx:(zb.minX+zb.maxX)/2, cy:rangeLimit, r:'7', class:'section-range-handle', fill:color, stroke:color});
        rHandle.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rHandle);
        const rLabel = svgEl('text',{x:zb.maxX+18,y:rangeLimit-6,class:'section-range-label',fill:color}); rLabel.textContent='Límite Y'; guideLayer.appendChild(rLabel);
      } else {
        const bandX1 = Math.min(linePos, rangeLimit), bandX2 = Math.max(linePos, rangeLimit);
        guideLayer.appendChild(svgEl('rect',{x:bandX1,y:zb.minY,width:Math.max(1,bandX2-bandX1),height:Math.max(1,zb.maxY-zb.minY),class:'section-range-fill'}));
        const rangeLine = svgEl('line',{x1:rangeLimit,y1:zb.minY-8,x2:rangeLimit,y2:zb.maxY+8,stroke:color,'stroke-width':'2.5','stroke-dasharray':'10 8',opacity:'.98',style:'cursor:ew-resize'});
        rangeLine.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rangeLine);
        const rHandleT = svgEl('circle',{cx:rangeLimit, cy:zb.minY-8, r:'6', class:'section-range-handle', fill:color, stroke:color});
        rHandleT.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rHandleT);
        const rHandleB = svgEl('circle',{cx:rangeLimit, cy:zb.maxY+8, r:'6', class:'section-range-handle', fill:color, stroke:color});
        rHandleB.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rHandleB);
        const rHandle = svgEl('circle',{cx:rangeLimit, cy:(zb.minY+zb.maxY)/2, r:'7', class:'section-range-handle', fill:color, stroke:color});
        rHandle.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'range'));
        guideLayer.appendChild(rHandle);
        const rLabel = svgEl('text',{x:rangeLimit+10,y:zb.minY-14,class:'section-range-label',fill:color}); rLabel.textContent='Límite X'; guideLayer.appendChild(rLabel);
      }
      const label = svgEl('text',{ x:isY ? (zb.minX + zb.maxX)/2 : linePos + 18, y:isY ? linePos - 10 : (zb.minY + zb.maxY)/2, fill:color, 'font-size':'11', 'font-weight':'800', 'text-anchor':'middle', style:'paint-order:stroke;stroke:#05101c;stroke-width:4px;stroke-linejoin:round;pointer-events:none;' });
      label.textContent = isY ? 'Línea de corte Y' : 'Línea de corte X';
      guideLayer.appendChild(label);
      const dir = cut.dir === -1 ? -1 : 1;
      const mkArrow = (pts) => {
        const path = svgEl('path',{ d:`M ${pts.map(pt => `${pt[0]} ${pt[1]}`).join(' L ')} Z`, fill:color, stroke:'rgba(255,255,255,.18)', 'stroke-width':'1', 'stroke-linejoin':'round', opacity:'.98', style:'cursor:pointer' });
        path.addEventListener('pointerdown', (evt) => startSectionGuideDrag(evt, axis, 'arrow'));
        return path;
      };
      if(isY){
        const leftX = x1, rightX = x2, ay = linePos;
        const targetDown = rangeLimit > linePos;
        const leftArrow = targetDown
          ? [[leftX, ay+14],[leftX-10, ay-6],[leftX+10, ay-6]]
          : [[leftX, ay-14],[leftX-10, ay+6],[leftX+10, ay+6]];
        const rightArrow = targetDown
          ? [[rightX, ay+14],[rightX-10, ay-6],[rightX+10, ay-6]]
          : [[rightX, ay-14],[rightX-10, ay+6],[rightX+10, ay+6]];
        guideLayer.appendChild(mkArrow(leftArrow));
        guideLayer.appendChild(mkArrow(rightArrow));
      } else {
        const ax = linePos, topY = y1, botY = y2;
        const topArrow = dir === 1
          ? [[ax+14, topY],[ax-6, topY-10],[ax-6, topY+10]]
          : [[ax-14, topY],[ax+6, topY-10],[ax+6, topY+10]];
        const botArrow = dir === 1
          ? [[ax+14, botY],[ax-6, botY-10],[ax-6, botY+10]]
          : [[ax-14, botY],[ax+6, botY-10],[ax+6, botY+10]];
        guideLayer.appendChild(mkArrow(topArrow));
        guideLayer.appendChild(mkArrow(botArrow));
      }
      const handle = svgEl('circle',{ cx:isY ? (zb.minX+zb.maxX)/2 : linePos, cy:isY ? linePos : (zb.minY+zb.maxY)/2, r:'7', fill:color, stroke:'#05101c', 'stroke-width':'2', style:isY ? 'cursor:ns-resize' : 'cursor:ew-resize' });
      handle.addEventListener('pointerdown', evt => startSectionGuideDrag(evt, axis, 'handle'));
      guideLayer.appendChild(handle);
    };

    appState.layout.zones.forEach(zone => {
      const d = zone.pts.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
      const path = svgEl('path',{d,class:'ortho-zone' + (appState.selectedZoneId===zone.id ? ' selected' : ''),fill:hexToRgba(zone.color, appState.selectedZoneId===zone.id ? .18 : .10),stroke:hexToRgba(zone.color, .92),'stroke-width':'2','data-zone-id':zone.id});
      path.addEventListener('pointerdown', e => {
        try{ e.currentTarget?.setPointerCapture?.(e.pointerId); }catch(_){}
        startZoneDrag(e, zone.id);
      }); if(appState.editor.zonesLocked) path.style.cursor='default';
      zoneLayer.appendChild(path);
      const c = centroid(zone.pts);
      const zb = zoneBoundsOf(zone);
      const zoneTitle = String(zone.name || zone.id || '').trim() || String(zone.id || '');
      const zoneSub = String(zone.id || '').trim().toUpperCase();
      const padX = 12, padY = 10;
      const badgeW = Math.min(Math.max(88, zoneTitle.length * 8.2 + 24), Math.max(96, zb.maxX - zb.minX - 24));
      const hasSub = zoneSub && zoneSub !== zoneTitle.toUpperCase();
      const badgeH = hasSub ? 42 : 28;
      const badgePos = findZoneBadgePlacement(zone, badgeW, badgeH);
      const badgeX = badgePos.x;
      const badgeY = badgePos.y;
      const badge = svgEl('g',{transform:`translate(${badgeX} ${badgeY})`,style:'pointer-events:none'});
      badge.appendChild(svgEl('rect',{x:0,y:0,width:badgeW,height:badgeH,rx:'10',fill:'rgba(5,16,28,.86)',stroke:hexToRgba(zone.color || '#B0E4CC', .95),'stroke-width':'1.4'}));
      const badgeText = svgEl('text',{x:padX,y:hasSub ? 16 : 18,class:'zone-badge-text','text-anchor':'start'});
      badgeText.textContent = zoneTitle;
      badge.appendChild(badgeText);
      if(hasSub){
        const badgeSub = svgEl('text',{x:padX,y:31,class:'zone-badge-sub','text-anchor':'start'});
        badgeSub.textContent = zoneSub;
        badge.appendChild(badgeSub);
      }
      zoneLayer.appendChild(badge);
      if(appState.selectedZoneId===zone.id){
        const centerLabel = svgEl('text',{x:c.x,y:c.y,class:'ortho-label','text-anchor':'middle',style:'opacity:.28;pointer-events:none'});
        centerLabel.textContent = zoneSub || zoneTitle;
        zoneLayer.appendChild(centerLabel);
      }
      if(appState.editor.showDims) drawZoneEdgeDimensions(edgeLayer, zone);

      if(appState.selectedZoneId===zone.id){
        if(appState.editor.sectionVisible){
          drawSectionGuide(zone, 'x');
          drawSectionGuide(zone, 'y');
        }
        zone.pts.forEach((p, idx) => {
          const v = svgEl('circle',{cx:p.x,cy:p.y,r:'6',class:'vertex' + ((appState.selectedVertex.zoneId===zone.id && appState.selectedVertex.idx===idx) ? ' selected' : '')});
          v.addEventListener('pointerdown', e => startVertexDrag(e, zone.id, idx)); if(appState.editor.zonesLocked) v.style.pointerEvents='none';
          vertexLayer.appendChild(v);
        });
        zone.pts.forEach((p, idx) => {
          const q = zone.pts[(idx+1)%zone.pts.length];
          const hit = svgEl('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,class:'edge-hit'});
          hit.addEventListener('pointerdown', e => startEdgeDrag(e, zone.id, idx, (idx+1)%zone.pts.length)); if(appState.editor.zonesLocked) hit.style.pointerEvents='none';
          edgeLayer.appendChild(hit);

          const mx = (p.x + q.x)/2, my = (p.y + q.y)/2;
          const len = Math.hypot(q.x-p.x, q.y-p.y);
          const nx = (q.y-p.y) / (len || 1);
          const ny = -(q.x-p.x) / (len || 1);
          const ox = nx * 16, oy = ny * 16;
          const activeEdge = (appState.selectedEdge.zoneId===zone.id && appState.selectedEdge.a===idx);
          edgeLayer.appendChild(svgEl('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,class: activeEdge ? 'edge-guide' : 'edge-hit',opacity: activeEdge ? '1' : '.001'}));
          const handle = svgEl('rect',{x:mx-6,y:my-6,width:12,height:12,rx:3,class:'edge-handle' + (activeEdge ? ' active' : ''),transform:`rotate(45 ${mx} ${my})`});
          handle.addEventListener('pointerdown', e => startEdgeDrag(e, zone.id, idx, (idx+1)%zone.pts.length)); if(appState.editor.zonesLocked) handle.style.pointerEvents='none';
          edgeLayer.appendChild(handle);
        });
        if(appState.selectedEdge.zoneId===zone.id && appState.selectedEdge.a>=0){
          const a = zone.pts[appState.selectedEdge.a], b = zone.pts[appState.selectedEdge.b];
          edgeLayer.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'edge-guide'}));
        }
      }
    });

    appState.layout.racks.forEach(r => {
      r.rot = normalizeAngle(r.rot || 0);
      r.front = r.front || 'top';
      const fp = getRackFootprint(r.modelId, r.rot || 0);
      const baseW = fp.baseW, baseH = fp.baseH;
      const bboxW = fp.w || r.w || baseW, bboxH = fp.h || r.h || baseH;
      const cx = r.x + bboxW/2, cy = r.y + bboxH/2;
      const g = svgEl('g',{
        class:'layout-rack-wrap',
        transform:`translate(${cx} ${cy}) rotate(${r.rot || 0})`,
        'data-rack-id':r.id
      });
      const hit = svgEl('rect',{
        x:-(bboxW/2)-14,y:-(bboxH/2)-14,width:bboxW+28,height:bboxH+28,rx:'14',
        class:'ortho-rack-hit',style:'cursor:move'
      });
      const geomW = Math.max(8, baseW);
      const geomH = Math.max(8, baseH);
      const strokeInset = 2;
      const bodyInset = strokeInset;
      const visualW = Math.max(4, geomW - bodyInset * 2);
      const visualH = Math.max(4, geomH - bodyInset * 2);
      const cornerRadius = Math.min(5, Math.max(2, Math.min(visualW, visualH) / 12));
      if(appState.selectedRackLayoutId===r.id) g.classList.add('selected');
      if(isRackSelected(r.id)) g.classList.add('multi-selected');
      if(isRackSearchHit(r.id)) g.classList.add('search-hit');
      if(appState.primaryHighlightedRackId===r.id) g.classList.add('search-primary');
      g.classList.add('ortho-rack-group');
      const body = svgEl('rect',{
        x:-(visualW/2),y:-(visualH/2),width:visualW,height:visualH,rx:String(cornerRadius),
        class:'ortho-rack-body'
      });
      const outlineInset = strokeInset;
      const outlineW = Math.max(4, geomW - outlineInset * 2);
      const outlineH = Math.max(4, geomH - outlineInset * 2);
      const outlineRadius = Math.min(4, Math.max(2, Math.min(outlineW, outlineH) / 12));
      const outline = svgEl('rect',{
        x:-(outlineW/2),y:-(outlineH/2),width:outlineW,height:outlineH,rx:String(outlineRadius),
        class:'ortho-rack-outline'
      });
      const fl = getFrontLine(visualW, visualH);
      const frontLine = svgEl('line',{x1:fl.x1,y1:fl.y1,x2:fl.x2,y2:fl.y2,class:'rack-front-line'});
      const frontArrow = svgEl('path',{d:frontArrowPath(fl.ax, fl.ay, fl.dir), class:'rack-front-arrow'});
      const t = svgEl('text',{
        x:0,y:4,class:'ortho-label','text-anchor':'middle','dominant-baseline':'middle',
        style:'pointer-events:none', transform:`rotate(${-normalizeAngle(r.rot||0)})`
      });
      t.textContent = r.id;
      const baseHVal = Math.round(Number(r.baseHeight || 0));
      if(baseHVal > 0){
        const badge = svgEl('g',{transform:`translate(${visualW/2 - 10} ${-visualH/2 + 10})`,style:'pointer-events:none'});
        badge.appendChild(svgEl('rect',{x:-20,y:-12,width:40,height:18,rx:'9',fill:'rgba(8,18,30,.95)',stroke:'#56d2ff','stroke-width':'1'}));
        const bt = svgEl('text',{x:0,y:1,class:'ortho-dim-text','text-anchor':'middle',style:'font-size:10px'});
        bt.textContent = `+${baseHVal}`;
        badge.appendChild(bt);
        g.appendChild(badge);
      }
      const stackInfo = rackStackSummary(r);
      if(stackInfo.count > 1){
        const stackBadge = svgEl('g',{transform:`translate(${visualW/2 - 14} ${visualH/2 - 14})`,style:'cursor:pointer'});
        stackBadge.appendChild(svgEl('rect',{x:-18,y:-11,width:36,height:20,rx:'10',fill:'rgba(5,15,24,.96)',stroke:'#ffd84d','stroke-width':'1.2'}));
        const st = svgEl('text',{x:0,y:2,class:'ortho-dim-text','text-anchor':'middle',style:'font-size:11px;fill:#ffd84d;font-weight:900'});
        st.textContent = `×${stackInfo.count}`;
        stackBadge.appendChild(st);
        stackBadge.addEventListener('click', evt => { evt.stopPropagation(); appState.selectedRackLayoutId = r.id; appState.selectedZoneId = r.zoneId; openStackMenuForRack(r.id, evt); renderLayoutEditor(); });
        g.appendChild(stackBadge);
      }
      g.append(hit, body, outline, frontLine, frontArrow, t);
      g.addEventListener('pointerdown', e => startRackDrag(e, r.id));
      g.addEventListener('dblclick', e => { e.stopPropagation(); openStackMenuForRack(r.id, e); renderLayoutStackMenu(); renderLayoutInspector(); });
      rackLayer.appendChild(g);
    });


    const dsBox = getDragSelectionBox();
    if(dsBox && appState.editor?.dragSelect?.active){
      overlayLayer.appendChild(svgEl('rect',{x:dsBox.x,y:dsBox.y,width:dsBox.w,height:dsBox.h,class:'drag-select-box'}));
    }
    const selectedRack = findRackById(appState.selectedRackLayoutId);
    const selectedZone = selectedRack ? (findZoneById(selectedRack.zoneId) || findZoneById(appState.selectedZoneId)) : findZoneById(appState.selectedZoneId);
    if(selectedZone){
      drawSelectedZoneMeasurements(measureLayer, selectedZone);
    }
    if(selectedRack && selectedZone){
      drawSelectedRackMeasurements(measureLayer, selectedRack, selectedZone);
    }

    svg.addEventListener('pointerdown', handleLayoutCanvasDown);
    svg.addEventListener('pointermove', handleLayoutMove);
    svg.addEventListener('pointerup', stopEditorDrag);
    svg.addEventListener('pointerleave', stopEditorDrag);
  }


  function getSectionCut(axis, zone){
    const targetZone = zone || findZoneById(appState.selectedZoneId) || appState.layout.zones[0];
    const cuts = ensureZoneSectionCuts(targetZone);
    return cuts[axis] || cuts.x;
  }
  function clampSectionCut(zone, axis){
    const cut = getSectionCut(axis, zone);
    cut.pos = Math.max(.06, Math.min(.94, Number(cut.pos) || .5));
    cut.dir = cut.dir === -1 ? -1 : 1;
    return cut;
  }
  function getSectionLinePosition(zone, axis){
    const zb = zoneBounds(zone);
    const cut = clampSectionCut(zone, axis);
    return axis === 'x'
      ? zb.minX + (zb.maxX - zb.minX) * cut.pos
      : zb.minY + (zb.maxY - zb.minY) * cut.pos;
  }
  function updateSectionCutFromPoint(zone, axis, point){
    const zb = zoneBounds(zone);
    const span = axis === 'x' ? Math.max(1, zb.maxX - zb.minX) : Math.max(1, zb.maxY - zb.minY);
    const raw = axis === 'x' ? (point.x - zb.minX) / span : (point.y - zb.minY) / span;
    const cut = getSectionCut(axis, zone);
    cut.pos = Math.max(.06, Math.min(.94, raw));
  }
  function updateSectionRangeFromPoint(zone, axis, point){
    const zb = zoneBounds(zone);
    const cut = clampSectionCut(zone, axis);
    const line = getSectionLinePosition(zone, axis);
    const minEdge = axis === 'x' ? zb.minX : zb.minY;
    const maxEdge = axis === 'x' ? zb.maxX : zb.maxY;
    const target = axis === 'x' ? point.x : point.y;
    const maxDist = cut.dir === 1 ? (maxEdge - line) : (line - minEdge);
    if(maxDist <= 1){ cut.depth = maxDist; return; }
    let dist = cut.dir === 1 ? (target - line) : (line - target);
    dist = Math.max(100, Math.min(maxDist, dist));
    cut.depth = dist;
  }
  function getSectionRangeLimit(zone, axis){
    const zb = zoneBounds(zone);
    const cut = clampSectionCut(zone, axis);
    const line = getSectionLinePosition(zone, axis);
    const maxDist = cut.dir === 1
      ? ((axis === 'x' ? zb.maxX : zb.maxY) - line)
      : (line - (axis === 'x' ? zb.minX : zb.minY));
    const depth = Math.max(Math.min(100, maxDist), Math.min(maxDist, Number(cut.depth) || 100));
    return line + (cut.dir * depth);
  }
  function sectionVisibleRacks(zone, racks, axis){
    if(!zone) return [];
    const line = getSectionLinePosition(zone, axis);
    const limit = getSectionRangeLimit(zone, axis);
    const minV = Math.min(line, limit) - 0.25;
    const maxV = Math.max(line, limit) + 0.25;
    return (racks||[]).filter(r => {
      const start = axis === 'x' ? Number(r.x || 0) : Number(r.y || 0);
      const size = axis === 'x' ? Number(r.w || 0) : Number(r.h || 0);
      const end = start + size;
      return end >= minV && start <= maxV;
    });
  }


  function renderSectionAxisSvg(svg, zone, racks, axis){
    if(!svg) return;
    const mountWidth = Math.max(320, Math.floor((svg.parentElement?.clientWidth || 520) - 4));
    const width = mountWidth, height = 260, groundY = 220;
    const padX = 24;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.appendChild(svgEl('rect',{x:0,y:0,width,height,rx:18,fill:'rgba(6,16,28,.98)'}));
    svg.appendChild(svgEl('line',{x1:padX,y1:groundY,x2:width-padX,y2:groundY,class:'section-ground'}));
    if(!zone || !racks.length){
      const txt = svgEl('text',{x:width/2,y:height/2,class:'section-text','text-anchor':'middle'});
      txt.textContent = 'Selecciona una zona con racks para ver la sección.';
      svg.appendChild(txt);
      return;
    }
    const zb = zoneBounds(zone);
    const visible = sectionVisibleRacks(zone, racks, axis);
    const displayAxisKey = axis === 'x' ? 'y' : 'x';
    const displaySizeKey = axis === 'x' ? 'h' : 'w';
    const displayMin = axis === 'x' ? zb.minY : zb.minX;
    const displayMax = axis === 'x' ? zb.maxY : zb.minX + Math.max(1, zb.maxX-zb.minX);
    const displaySpan = Math.max(1, displayMax - displayMin);
    const innerWidth = Math.max(120, width - padX * 2);
    if(!visible.length){
      const txt = svgEl('text',{x:width/2,y:height/2,class:'section-text','text-anchor':'middle'});
      txt.textContent = 'No hay racks visibles desde esta línea de sección.';
      svg.appendChild(txt);
      return;
    }
    const maxTop = Math.max(...visible.map(r => (Number(r.baseHeight||0) + Number(r.rackHeight || rackModel(r.modelId).height || 238))), 240);
    const usableHeight = 160;
    const rackHeightScale = usableHeight / maxTop;
    const ordered = visible.slice().sort((a,b)=> ((a[displayAxisKey] || 0) - (b[displayAxisKey] || 0)) || ((a.baseHeight||0)-(b.baseHeight||0)) || (a.id > b.id ? 1 : -1));
    const sectionItems = ordered.map(r => {
      const model = rackModel(r.modelId);
      const pos = Number(r[displayAxisKey] || 0);
      const size = Math.max(8, Number(r[displaySizeKey] || 44));
      const rw = Math.max(18, Math.round((size / displaySpan) * innerWidth));
      const rackHeight = Math.max(60, Number(r.rackHeight || model.height || 238));
      const baseHeight = Math.max(0, Number(r.baseHeight || 0));
      const rh = Math.max(48, Math.round(rackHeight * rackHeightScale));
      const relStart = (pos - displayMin) / displaySpan;
      const rx = Math.round(padX + relStart * innerWidth);
      return { r, model, rw, rh, baseHeight, rackHeight, rx };
    });

    sectionItems.forEach(it => {
      const { r, model, rw, rh, baseHeight, rackHeight } = it;
      let rx = it.rx;
      rx = Math.max(padX, Math.min(width - padX - rw, rx));
      const ry = groundY - Math.round((baseHeight + rackHeight) * rackHeightScale);
      const sectionInset = 1;
      const rect = svgEl('rect',{x:rx+sectionInset,y:ry+sectionInset,width:Math.max(8,rw-sectionInset*2),height:Math.max(8,rh-sectionInset*2),rx:16,class:'section-rack' + (appState.selectedRackLayoutId===r.id ? ' selected' : '')});
      rect.setAttribute('filter','drop-shadow(0 10px 18px rgba(0,0,0,.25))');
      rect.addEventListener('pointerdown', evt => { evt.stopPropagation(); appState.selectedRackLayoutId = r.id; appState.selectedZoneId = r.zoneId; renderLayoutEditor(); });
      svg.appendChild(rect);
      const orangeInset = 14;
      const frontY = ry + 16;
      svg.appendChild(svgEl('line',{x1:rx+orangeInset,y1:frontY,x2:rx+rw-orangeInset,y2:frontY,stroke:'#ff9848','stroke-width':'4.5','stroke-linecap':'round'}));
      svg.appendChild(svgEl('path',{d:`M ${rx+rw/2} ${ry-6} l 10 0 l -5 -12 z`, fill:'#ff9848', opacity:'0.95'}));
      const levels = Math.max(2, parseInt(model.levels || 4, 10));
      for(let i=1;i<levels;i++){
        const ly = ry + (rh/levels) * i;
        svg.appendChild(svgEl('line',{x1:rx+8,y1:ly,x2:rx+rw-8,y2:ly,class:'section-deck'}));
      }
      const label = svgEl('text',{x:rx+rw/2,y:ry+rh/2+6,class:'section-text','text-anchor':'middle'});
      label.textContent = r.id;
      svg.appendChild(label);
      const baseText = svgEl('text',{x:rx+rw/2,y:ry+rh+16,class:'section-text','text-anchor':'middle',style:'font-size:11px;fill:#9db8d4'});
      baseText.textContent = `Base ${formatDistanceShort(baseHeight)}`;
      svg.appendChild(baseText);
    });
  }

  function renderLayoutSection(){
    const mount = $('#layoutSectionWrap');
    if(!mount) return;
    if(!appState.editor.sectionVisible){ mount.innerHTML = ''; mount.style.display='none'; return; }
    mount.style.display='block';
    const zone = findZoneById(appState.selectedZoneId) || appState.layout.zones[0];
    const racks = zone ? (appState.layout.racks||[]).filter(r => r.zoneId === zone.id) : [];
    mount.innerHTML = `
      <div class="layout-section-wrap layout-section-panel">
        <div class="layout-section-head">
          <div>
            <div class="layout-section-title">Vistas de sección</div>
            <div class="layout-section-sub">Lectura vertical tipo arquitectura en ambos ejes para revisar apilado y distribución de racks. Muestran solo lo que queda dentro del área delimitada por las 2 líneas de corte.</div>
          </div>
          <div class="section-stack-chip">${zone ? zone.id : 'Sin zona'} • ${racks.length} racks</div>
        </div>
        <div class="layout-section-body layout-section-grid">
          <div class="layout-section-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div class="layout-section-sub">Sección eje X</div>
              <button class="seg-btn" id="btnFlipSectionX">Invertir dirección</button>
            </div>
            <svg id="layoutSectionSvg"></svg>
          </div>
          <div class="layout-section-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div class="layout-section-sub">Sección eje Y</div>
              <button class="seg-btn" id="btnFlipSectionY">Invertir dirección</button>
            </div>
            <svg id="layoutSectionSvgY"></svg>
          </div>
        </div>
      </div>`;
    renderSectionAxisSvg($('#layoutSectionSvg'), zone, racks, 'x');
    renderSectionAxisSvg($('#layoutSectionSvgY'), zone, racks, 'y');
    $('#btnFlipSectionX').onclick = () => { const cut = getSectionCut('x', zone); cut.dir *= -1; persistActiveLayout(); renderLayoutEditor(); };
    $('#btnFlipSectionY').onclick = () => { const cut = getSectionCut('y', zone); cut.dir *= -1; persistActiveLayout(); renderLayoutEditor(); };
  }

  function hexToRgba(hex, a){ const h = hex.replace('#',''); const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16); return `rgba(${r},${g},${b},${a})`; }
  function svgPoint(evt, svg){ const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function zoomLayout(factor, center){
    const vb = appState.editor.viewBox || { x:0, y:0, w:900, h:620 };
    const cx = center ? center.x : vb.x + vb.w/2;
    const cy = center ? center.y : vb.y + vb.h/2;
    const nw = Math.max(220, Math.min(2400, vb.w * factor));
    const nh = Math.max(160, Math.min(1800, vb.h * factor));
    appState.editor.viewBox = {
      x: cx - ((cx - vb.x) / vb.w) * nw,
      y: cy - ((cy - vb.y) / vb.h) * nh,
      w: nw,
      h: nh
    };
    appState.editor.viewBoxCustomized = true;
    renderLayoutEditor();
  }

  function bindLayoutToolbar(){
    if($('#btnToggleDims')) $('#btnToggleDims').onclick = () => { appState.editor.showDims = !appState.editor.showDims; renderLayoutEditor(); };
    if($('#btnToggleNav')) $('#btnToggleNav').onclick = () => { appState.editor.mode = appState.editor.mode === 'navigate' ? 'select' : 'navigate'; renderLayoutEditor(); };
    $$('.seg-btn[data-emode]').forEach(btn => btn.onclick = () => { appState.editor.mode = btn.dataset.emode; renderLayoutEditor(); });
    if($('#layoutBranchSelect')) $('#layoutBranchSelect').onchange = e => { setLayoutBranch(+e.target.value || 0); renderLayoutEditor(); };
    if($('#btnZonePlus')) $('#btnZonePlus').onclick = () => { appState.editor.mode = 'zone'; renderLayoutEditor(); };
    if($('#btnZoneMinus')) $('#btnZoneMinus').onclick = () => {
      if(appState.selectedZoneId && (appState.layout?.zones||[]).length > 1){
        appState.layout.zones = appState.layout.zones.filter(z => z.id !== appState.selectedZoneId);
        appState.layout.racks = (appState.layout.racks||[]).filter(r => r.zoneId !== appState.selectedZoneId);
        appState.selectedZoneId = appState.layout.zones[0]?.id || '';
        appState.selectedVertex = { zoneId:'', idx:-1 };
        appState.selectedEdge = { zoneId:'', a:-1, b:-1 };
        normalizeZoneAndRackIds();
        persistActiveLayout();
      }
      renderLayoutEditor();
    };
    if($('#btnVertexPlus')) $('#btnVertexPlus').onclick = () => insertVertexOnSelectedEdge();
    if($('#btnVertexMinus')) $('#btnVertexMinus').onclick = () => removeSelectedVertex();
    $('#btnRotateRack').onclick = () => {
      const rack = findRackById(appState.selectedRackLayoutId); if(!rack) return;
      const next = Math.round((normalizeAngle(rack.rot || 0) + 90) / 90) * 90;
      applyRackRotation(rack, next, { preserveCenter:true, snap:true }); normalizeZoneAndRackIds(); persistActiveLayout(); renderLayoutEditor();
    };
    if($('#btnDuplicateRack')) $('#btnDuplicateRack').onclick = () => duplicateSelectedRack();
    if($('#btnApplyModelSelection')) $('#btnApplyModelSelection').onclick = () => applyModelToSelectedRacks();
    if($('#btnDuplicateZone')) $('#btnDuplicateZone').onclick = () => duplicateSelectedZone();
    $('#btnToggleSection').onclick = () => { appState.editor.sectionVisible = !appState.editor.sectionVisible; renderLayoutEditor(); };
    if($('#btnLockZones')) $('#btnLockZones').onclick = () => { appState.editor.zonesLocked = !appState.editor.zonesLocked; renderLayoutEditor(); };
    $('#btnDeleteSelected').onclick = () => {
      const selectedIds = getSelectedRackIds();
      const rid = appState.selectedRackLayoutId; const zid = appState.selectedZoneId;
      if(selectedIds.length){
        appState.layout.racks = appState.layout.racks.filter(r => !selectedIds.includes(r.id));
        clearRackSelection();
      }
      else if(rid){ appState.layout.racks = appState.layout.racks.filter(r => r.id !== rid); clearRackSelection(); }
      else if(zid && appState.layout.zones.length > 1){ appState.layout.zones = appState.layout.zones.filter(z => z.id !== zid); appState.layout.racks = appState.layout.racks.filter(r => r.zoneId !== zid); appState.selectedZoneId = appState.layout.zones[0]?.id || ''; normalizeZoneAndRackIds(); }
      persistActiveLayout(); renderLayoutEditor();
    };
    $('#btnZoomIn').onclick = () => zoomLayout(0.86);
    $('#btnZoomOut').onclick = () => zoomLayout(1.16);
    $('#btnZoomFit').onclick = () => { fitLayoutViewBox(); renderLayoutEditor(); };
    window.requestAnimationFrame(() => {
      const stageSvg = document.getElementById('layoutSvg');
      if(!stageSvg) return;
      if(!appState.editor.viewBoxCustomized) fitLayoutViewBox();
      renderLayoutSvg(stageSvg);
      renderLayoutSection();
    });
    const svg = $('#layoutSvg');
    svg.onwheel = e => { e.preventDefault(); zoomLayout(e.deltaY > 0 ? 1.12 : 0.88, svgPoint(e, svg)); };
  }


  function renderLayoutIsoSvg(svg){
    svg.innerHTML = '';
    const iso = (x,y,z=0) => ({ x:(x-y)*0.72, y:(x+y)*0.36 - z });
    const zones = appState.layout.zones || [];
    const racks = appState.layout.racks || [];
    const pts=[];
    zones.forEach(z=> (z.pts||[]).forEach(p=>{ const q=iso(p.x,p.y,0); pts.push(q); }));
    racks.forEach(r=>{
      const heightCm = Math.max(60, Number(r.rackHeight || getModelById(r.modelId)?.height || 240) || 240);
      const z0 = Math.max(0, Math.round(getRackVerticalBase(r) * 0.28));
      const h = Math.max(48, Math.round(heightCm * 0.28));
      [[r.x,r.y,z0],[r.x+r.w,r.y,z0],[r.x+r.w,r.y+r.h,z0],[r.x,r.y+r.h,z0],[r.x,r.y,z0+h],[r.x+r.w,r.y,z0+h],[r.x+r.w,r.y+r.h,z0+h],[r.x,r.y+r.h,z0+h]].forEach(([x,y,z])=>pts.push(iso(x,y,z)));
    });
    if(!pts.length){ svg.setAttribute('viewBox','-400 -260 800 520'); return; }
    let minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x)), minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
    const pad=80;
    svg.setAttribute('viewBox', `${minX-pad} ${minY-pad} ${Math.max(600,maxX-minX+pad*2)} ${Math.max(420,maxY-minY+pad*2)}`);
    const grid = svgEl('g',{opacity:'.22'});
    for(let i=-1200;i<=1200;i+=80){
      const a=iso(i,-1200,0), b=iso(i,1200,0); grid.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'rgba(86,124,170,.28)','stroke-width':'1'}));
      const c=iso(-1200,i,0), d=iso(1200,i,0); grid.appendChild(svgEl('line',{x1:c.x,y1:c.y,x2:d.x,y2:d.y,stroke:'rgba(86,124,170,.28)','stroke-width':'1'}));
    }
    svg.appendChild(grid);
    const zoneLayer=svgEl('g'), rackLayer=svgEl('g'), textLayer=svgEl('g');
    svg.append(zoneLayer,rackLayer,textLayer);
    zones.forEach(zone=>{
      const base=(zone.pts||[]).map(p=>iso(p.x,p.y,0));
      zoneLayer.appendChild(svgEl('path',{d:base.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')+' Z', fill:hexToRgba(zone.color||'#ffd84d', .10), stroke:hexToRgba(zone.color||'#ffd84d', .88), 'stroke-width':'2'}));
      const c=centroid(zone.pts||[]); const ci=iso(c.x,c.y,0);
      const t=svgEl('text',{x:ci.x,y:ci.y,class:'ortho-label','text-anchor':'middle'}); t.textContent=zone.id; textLayer.appendChild(t);
    });
    racks.slice().sort((a,b)=> getRackVerticalBase(a)-getRackVerticalBase(b)).forEach(r=>{
      const heightCm = Math.max(60, Number(r.rackHeight || getModelById(r.modelId)?.height || 240) || 240);
      const z0 = Math.max(0, Math.round(getRackVerticalBase(r) * 0.28));
      const h = Math.max(48, Math.round(heightCm * 0.28));
      const p0=iso(r.x,r.y,z0), p1=iso(r.x+r.w,r.y,z0), p2=iso(r.x+r.w,r.y+r.h,z0), p3=iso(r.x,r.y+r.h,z0);
      const t0=iso(r.x,r.y,z0+h), t1=iso(r.x+r.w,r.y,z0+h), t2=iso(r.x+r.w,r.y+r.h,z0+h), t3=iso(r.x,r.y+r.h,z0+h);
      const cls = appState.selectedRackLayoutId===r.id ? ' selected' : '';
      rackLayer.appendChild(svgEl('path',{d:`M ${p3.x} ${p3.y} L ${p2.x} ${p2.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Z`, class:'rack-iso'+cls, fill:'rgba(55,87,120,.55)', stroke:'#9db8d4','stroke-width':'2'}));
      rackLayer.appendChild(svgEl('path',{d:`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${t2.x} ${t2.y} L ${t1.x} ${t1.y} Z`, class:'rack-iso'+cls, fill:'rgba(40,64,96,.65)', stroke:'#88acd1','stroke-width':'2'}));
      rackLayer.appendChild(svgEl('path',{d:`M ${t0.x} ${t0.y} L ${t1.x} ${t1.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Z`, class:'rack-iso'+cls, fill:'rgba(255,255,255,.08)', stroke:'#c7d8ea','stroke-width':'2'}));
      if(z0 > 0){
        const colA = iso(r.x, r.y+r.h, 0), colB = iso(r.x, r.y+r.h, z0);
        const colC = iso(r.x+r.w, r.y+r.h, 0), colD = iso(r.x+r.w, r.y+r.h, z0);
        rackLayer.appendChild(svgEl('line',{x1:colA.x,y1:colA.y,x2:colB.x,y2:colB.y,stroke:'rgba(255,216,77,.55)','stroke-width':'2','stroke-dasharray':'6 6'}));
        rackLayer.appendChild(svgEl('line',{x1:colC.x,y1:colC.y,x2:colD.x,y2:colD.y,stroke:'rgba(255,216,77,.55)','stroke-width':'2','stroke-dasharray':'6 6'}));
      }
      const center=iso(r.x+r.w/2,r.y+r.h/2,z0+h+10); const tx=svgEl('text',{x:center.x,y:center.y,class:'ortho-label','text-anchor':'middle'}); tx.textContent=`${r.id} · N${getRackLevelValue(r)}`; textLayer.appendChild(tx);
    });
  }

  function startLayoutPan(e){
    const svg = $('#layoutSvg');
    const vb = clone(appState.editor.viewBox || { x:0, y:0, w:900, h:620 });
    appState.editor.dragging = { type:'pan-layout', startClient:{ x:e.clientX, y:e.clientY }, originalViewBox:vb };
    if(svg) svg.style.cursor = 'grabbing';
  }

  function handleLayoutCanvasDown(e){
    const svg = e.currentTarget; const raw = svgPoint(e, svg); const p = { x:snapGrid(raw.x), y:snapGrid(raw.y) };
    const target = e.target;
    const isPanSurface = target === svg || (target && target.classList && target.classList.contains('layout-pan-surface'));
    if(appState.editor.dragging?.type === 'pan-layout') return;
    if(isPanSurface && (appState.editor.mode === 'navigate' || e.shiftKey || e.button === 1)){
      startLayoutPan(e);
      return;
    }
    if(appState.editor.mode === 'select' && isPanSurface){
      closeStackMenu();
      renderLayoutInspector();
      renderLayoutSection();
      return;
    }
    if(appState.editor.mode === 'zone'){
      const id = nextZoneId();
      appState.layout.zones.push({ id, name:'Zona ' + id, color:getBranchColor(getActiveLayoutBranchIndex()), pts:[{x:p.x-60,y:p.y-40},{x:p.x+60,y:p.y-40},{x:p.x+60,y:p.y+40},{x:p.x-60,y:p.y+40}] });
      normalizeZoneAndRackIds(); persistActiveLayout();
      appState.selectedZoneId = id; appState.editor.mode = 'select'; renderLayoutEditor(); return;
    }
    if(appState.editor.mode === 'rack'){
      const zone = appState.layout.zones.find(z => pointInPoly(p, z.pts)) || findZoneById(appState.selectedZoneId) || appState.layout.zones[0];
      const id = nextRackId(zone.id);
      const fp = getRackFootprint(appState.selectedModelId, 0);
      const rackObj = { id, zoneId:zone.id, x:snapGrid(p.x-fp.w/2), y:snapGrid(p.y-fp.h/2), w:fp.w, h:fp.h, rot:0, modelId:appState.selectedModelId, front:'auto', baseHeight:0, rackHeight:(rackModel(appState.selectedModelId)?.height || 240) };
      keepRackSnapped(rackObj, zone); appState.layout.racks.push(rackObj); persistActiveLayout();
      appState.selectedRackLayoutId = rackObj.id; appState.editor.mode = 'select'; renderLayoutEditor(); return;
    }
    pickNearestEdge(p);
    renderLayoutInspector();
  }

  function pickNearestEdge(p){
    const zone = findZoneById(appState.selectedZoneId); if(!zone) return;
    let best = { d: Infinity, a:-1, b:-1 };
    for(let i=0;i<zone.pts.length;i++){
      const a = zone.pts[i], b = zone.pts[(i+1)%zone.pts.length];
      const pr = projectPointToSegment(p, a, b); const d = dist2(p, pr);
      if(d < best.d){ best = { d, a:i, b:(i+1)%zone.pts.length }; }
    }
    if(best.d < 180) appState.selectedEdge = { zoneId:zone.id, a:best.a, b:best.b };
    else appState.selectedEdge = { zoneId:'', a:-1, b:-1 };
  }

  function insertVertexOnSelectedEdge(){
    const sel = appState.selectedEdge; const zone = findZoneById(sel.zoneId); if(!zone || sel.a<0) return;
    const a = zone.pts[sel.a], b = zone.pts[sel.b];
    zone.pts.splice(sel.b, 0, { x:(a.x+b.x)/2, y:(a.y+b.y)/2 });
    appState.selectedVertex = { zoneId:zone.id, idx:sel.b };
    persistActiveLayout(); renderLayoutEditor();
  }

  function removeSelectedVertex(){
    const sel = appState.selectedVertex || { zoneId:'', idx:-1 };
    const zone = findZoneById(sel.zoneId);
    if(!zone || sel.idx < 0 || !Array.isArray(zone.pts) || zone.pts.length <= 3) return;
    zone.pts.splice(sel.idx, 1);
    appState.selectedVertex = { zoneId:'', idx:-1 };
    appState.selectedEdge = { zoneId:'', a:-1, b:-1 };
    persistActiveLayout();
    renderLayoutEditor();
  }


  function dragZoneFromState(d){
    if(!d) return null;
    if(Number.isInteger(d.zoneIndex) && appState.layout?.zones?.[d.zoneIndex]) return appState.layout.zones[d.zoneIndex];
    return findZoneById(d.zoneId);
  }

  function startZoneDrag(e, zoneId){
    if(appState.editor.mode !== 'select' || appState.editor.zonesLocked) return;
    e.stopPropagation();
    const svg = $('#layoutSvg'); const p = svgPoint(e, svg);
    appState.selectedZoneId = zoneId; appState.selectedRackLayoutId = '';
    closeStackMenu();
    const zone = findZoneById(zoneId);
    if(!zone) return;
    const zoneIndex = (appState.layout?.zones || []).findIndex(z => z === zone);
    appState.editor.dragging = { type:'zone', zoneId, zoneIndex, start:p, original: clone(zone.pts), racks: clone(appState.layout.racks.filter(r => r.zoneId === zoneId)) };
    renderLayoutInspector(); renderLayoutEditor();
  }
  function startVertexDrag(e, zoneId, idx){
    if(appState.editor.mode !== 'select' || appState.editor.zonesLocked) return;
    e.stopPropagation();
    const svg = $('#layoutSvg'); const p = svgPoint(e, svg);
    const zone = findZoneById(zoneId);
    if(!zone) return;
    const zoneIndex = (appState.layout?.zones || []).findIndex(z => z === zone);
    appState.selectedZoneId = zoneId; appState.selectedVertex = { zoneId, idx }; appState.selectedRackLayoutId = '';
    closeStackMenu();
    appState.editor.dragging = { type:'vertex', zoneId, zoneIndex, idx, start:p, original: clone(zone.pts[idx]) };
    renderLayoutInspector(); renderLayoutEditor();
  }
  function startEdgeDrag(e, zoneId, a, b){
    if(appState.editor.mode !== 'select' || appState.editor.zonesLocked) return;
    e.stopPropagation();
    const svg = $('#layoutSvg'); const p = svgPoint(e, svg);
    const zone = findZoneById(zoneId);
    if(!zone) return;
    const zoneIndex = (appState.layout?.zones || []).findIndex(z => z === zone);
    appState.selectedZoneId = zoneId;
    appState.selectedEdge = { zoneId, a, b };
    appState.selectedRackLayoutId = '';
    closeStackMenu();
    appState.editor.dragging = { type:'edge', zoneId, zoneIndex, a, b, start:p, originalA: clone(zone.pts[a]), originalB: clone(zone.pts[b]) };
    renderLayoutInspector(); renderLayoutEditor();
  }
  function startSectionGuideDrag(e, axis, source='line'){
    if(!appState.editor.sectionVisible) return;
    e.stopPropagation();
    const zone = findZoneById(appState.selectedZoneId) || appState.layout.zones[0];
    if(!zone) return;
    const svg = $('#layoutSvg'); const p = svgPoint(e, svg);
    appState.editor.dragging = { type:'section-guide', axis, zoneId:zone.id, start:p, moved:false, source };
  }

  function startRackDrag(e, rackId){
    if(appState.editor.mode !== 'select') return;
    e.stopPropagation();
    const rack = findRackById(rackId);
    if(!rack) return;
    closeStackMenu();
    if(e.shiftKey){
      toggleRackSelection(rackId);
      appState.selectedZoneId = rack.zoneId;
      renderLayoutInspector(); renderLayoutEditor();
      return;
    }
    setSelectedRackIds([rackId]);
    const svg = $('#layoutSvg'); const p = svgPoint(e, svg);
    const cx = rack.x + rack.w/2, cy = rack.y + rack.h/2;
    appState.selectedZoneId = rack.zoneId;
    appState.editor.dragging = { type:'rack', rackId, start:p, original: { x:rack.x, y:rack.y, cx, cy, zoneId:rack.zoneId } };
    renderLayoutInspector(); renderLayoutEditor();
  }

  function handleLayoutMove(e){
    const svg = $('#layoutSvg'); const p = svgPoint(e, svg);
    const d = appState.editor.dragging;
    if(!d && !appState.editor?.dragSelect?.active) return;
    if(d && d.type === 'pan-layout'){
      const rect = svg.getBoundingClientRect();
      const vb = d.originalViewBox || appState.editor.viewBox || { x:0, y:0, w:900, h:620 };
      const scaleX = vb.w / Math.max(1, rect.width);
      const scaleY = vb.h / Math.max(1, rect.height);
      const dxClient = e.clientX - d.startClient.x;
      const dyClient = e.clientY - d.startClient.y;
      appState.editor.viewBox = {
        x: vb.x - dxClient * scaleX,
        y: vb.y - dyClient * scaleY,
        w: vb.w,
        h: vb.h
      };
      renderLayoutSvg(svg); renderLayoutSection();
      return;
    }
    if(appState.editor?.dragSelect?.active){
      updateDragSelection(p);
      renderLayoutSvg(svg); renderLayoutSection(); renderLayoutInspector();
      return;
    }
    const dx = snapGrid(p.x - d.start.x), dy = snapGrid(p.y - d.start.y);
    if(d.type === 'zone'){
      const zone = dragZoneFromState(d);
      if(!zone) return;
      zone.pts = d.original.map(pt => ({ x: snapGrid(pt.x + dx), y: snapGrid(pt.y + dy) }));
      const racks = appState.layout.racks.filter(r => r.zoneId === zone.id);
      racks.forEach((r, i) => {
        const base = d.racks[i] || { x:r.x, y:r.y };
        r.x = snapGrid(base.x + dx);
        r.y = snapGrid(base.y + dy);
      });
      renderLayoutSvg(svg); renderLayoutSection(); renderLayoutInspector();
    } else if(d.type === 'vertex'){
      const zone = dragZoneFromState(d);
      if(!zone) return;
      const lockAxis = e.shiftKey ? (Math.abs(p.x - d.start.x) >= Math.abs(p.y - d.start.y) ? 'x' : 'y') : null;
      const snapped = snapPointAdvanced(p, { zoneId:d.zoneId, keepAxis:lockAxis, origin:d.original });
      zone.pts[d.idx] = { x:snapped.x, y:snapped.y }; pickNearestEdge(snapped); renderLayoutSvg(svg); renderLayoutSection(); renderLayoutInspector();
    } else if(d.type === 'edge'){
      const zone = dragZoneFromState(d);
      if(!zone) return;
      const a0 = d.originalA, b0 = d.originalB;
      const horizontal = Math.abs(a0.y - b0.y) <= Math.abs(a0.x - b0.x);
      if(horizontal){
        const ny = snapGrid(a0.y + dy);
        zone.pts[d.a].y = ny; zone.pts[d.b].y = ny;
      } else {
        const nx = snapGrid(a0.x + dx);
        zone.pts[d.a].x = nx; zone.pts[d.b].x = nx;
      }
      appState.selectedEdge = { zoneId:d.zoneId, a:d.a, b:d.b };
      renderLayoutSvg(svg); renderLayoutSection(); renderLayoutInspector();
    } else if(d.type === 'section-guide'){
      const zone = findZoneById(d.zoneId) || appState.layout.zones[0];
      if(zone){
        if(d.source === 'range') updateSectionRangeFromPoint(zone, d.axis, p);
        else updateSectionCutFromPoint(zone, d.axis, p);
        d.moved = true;
        renderLayoutSvg(svg); renderLayoutSection(); renderLayoutInspector();
      }
    } else if(d.type === 'rack'){
      const rack = findRackById(d.rackId);
      const rawDX = p.x - d.start.x;
      const rawDY = p.y - d.start.y;
      const ncx = d.original.cx + rawDX;
      const ncy = d.original.cy + rawDY;
      rack.x = ncx - rack.w/2;
      rack.y = ncy - rack.h/2;
      const center = { x:ncx, y:ncy };
      const currentZone = findZoneById((d.original && d.original.zoneId) || rack.zoneId);
      const targetZone = (appState.layout.zones||[]).find(z => pointInPoly(center, z.pts) && rackCorners(rack).every(pt => pointInPoly(pt, z.pts) || pointNearPolygonEdge(pt, z.pts, 1)));
      const host = targetZone || currentZone || nearestZoneForPoint(center);
      if(host){ keepRackSnapped(rack, host); rack.zoneId = host.id; }
      if(host && !rackFullyInsideZone(rack, host) && d.original){ rack.x = d.original.x; rack.y = d.original.y; rack.zoneId = d.original.zoneId; }
      renderLayoutSvg(svg); renderLayoutSection(); renderLayoutInspector();
    }
  }
  function stopEditorDrag(){
    if(appState.editor?.dragSelect?.active){
      commitDragSelection();
      persistActiveLayout();
      if(appState.screen==='layout') renderLayoutEditor();
      return;
    }
    const d = appState.editor.dragging;
    const svg = $('#layoutSvg');
    if(svg) svg.style.cursor = '';
    if(d && d.type==='section-guide'){
      const zone = findZoneById(d.zoneId) || appState.layout.zones[0];
      if(zone && d.source === 'arrow' && !d.moved){
        const cut = getSectionCut(d.axis, zone);
        cut.dir *= -1;
      }
    }
    if(d && d.type==='rack'){
      const rack = findRackById(d.rackId);
      if(rack){
        const center = { x:rack.x + rack.w/2, y:rack.y + rack.h/2 };
        const originalZone = findZoneById((d.original && d.original.zoneId) || rack.zoneId) || findZoneById(rack.zoneId);
        const targetZone = (appState.layout.zones||[]).find(z=>pointInPoly(center, z.pts));
        const host = targetZone || originalZone || nearestZoneForPoint(center) || findZoneById(rack.zoneId);
        if(host){
          const previousZoneId = (d.original && d.original.zoneId) || rack.zoneId;
          if(targetZone && previousZoneId !== host.id) assignRackToZone(rack, host.id);
          else rack.zoneId = host.id;
          keepRackSnapped(rack, host);
          if(!rackFullyInsideZone(rack, host) && d.original){ rack.x = d.original.x; rack.y = d.original.y; rack.zoneId = previousZoneId; }
        }
      }
      normalizeZoneAndRackIds();
    }
    if(d && d.type==='zone'){ normalizeZoneAndRackIds(); }
    appState.editor.dragging = null;
    persistActiveLayout();
    if(appState.screen==='layout') renderLayoutEditor();
  }

  function renderLayoutInspector(){
    const mount = $('#layoutInspector'); if(!mount) return;
    const zone = findZoneById(appState.selectedZoneId);
    const rack = findRackById(appState.selectedRackLayoutId);
    const infoOpen = appState.editor?.inspectorInfoOpen !== false;
    const zoneOpen = !!appState.editor?.inspectorZoneOpen;
    const rackOpen = !!appState.editor?.inspectorRackOpen;
    const stackOpen = !!appState.editor?.inspectorStackOpen;
    const sectionOpen = !!appState.editor?.inspectorSectionOpen;
    const stack = rack ? rackStackSummary(rack) : { count:0, isStacked:false, members:[] };
    mount.innerHTML = `
      <details class="inspector-section" id="inspectorInfoSection" ${infoOpen ? 'open' : ''}>
        <summary class="inspector-summary">Información</summary>
        <div class="inspector-body">
          <div class="kv">
            <div class="kv-row"><b>Zona seleccionada</b><span>${zone ? zone.id : '—'}</span></div>
            <div class="kv-row"><b>Rack seleccionado</b><span>${rack ? rack.id : '—'}</span></div>
            <div class="kv-row"><b>Racks en selección</b><span>${getSelectedRackIds().length || 0}</span></div>
            <div class="kv-row"><b>Racks encontrados</b><span>${(appState.highlightedRackIds||[]).length || 0}</span></div>
            <div class="kv-row"><b>Modo</b><span>${appState.editor.mode}</span></div>
            <div class="kv-row"><b>Sucursal</b><span>${escapeHtml((appState.admin.branches||[])[getActiveLayoutBranchIndex()]?.name || '—')}</span></div>
            <div class="kv-row"><b>Snap grid</b><span>40 u</span></div>
            <div class="kv-row"><b>Escala</b><span>1 u = ${getScaleCmPerUnit()} cm</span></div>
            <div class="kv-row"><b>Vista</b><span>${appState.editor.view}</span></div>
            <div class="kv-row"><b>Zonas</b><span>${appState.editor.zonesLocked ? 'Bloqueadas' : 'Editables'}</span></div>
          </div>
        </div>
      </details>
      <div style="height:12px"></div>
      <details class="inspector-section" id="inspectorZoneSection" ${zoneOpen ? 'open' : ''}>
        <summary class="inspector-summary">Propiedades de zona</summary>
        <div class="inspector-body">
          ${!zone ? `<div class="empty" style="padding:14px 8px"><b>Sin zona seleccionada</b><div class="muted tiny" style="margin-top:8px">Selecciona una zona para abrir sus propiedades de edición.</div></div>` : `
          <div class="grid">
            <label class="tiny muted">Nombre visible de la zona</label>
            <input id="insZoneName" value="${zone.name}">
            <label class="tiny muted">Nomenclatura / código de zona</label>
            <input id="insZoneCode" value="${zone.id}" placeholder="Ej: Z1, Z2, ALM, A" />
            <div class="two">
              <div><label class="tiny muted">Color</label><input id="insZoneColor" type="color" value="${zone.color}" style="height:44px;padding:6px"></div>
              <div><label class="tiny muted">Vértices</label><div class="chip">${zone.pts.length}</div></div>
            </div>
            <div class="three"><div><label class="tiny muted">Ancho</label><input value="${formatDistanceShort(zoneBounds(zone).maxX-zoneBounds(zone).minX)}" disabled></div><div><label class="tiny muted">Alto</label><input value="${formatDistanceShort(zoneBounds(zone).maxY-zoneBounds(zone).minY)}" disabled></div><div><label class="tiny muted">Racks</label><input value="${appState.layout.racks.filter(r=>r.zoneId===zone.id).length}" disabled></div></div>
            <div><label class="tiny muted">Escala cm/u</label><input id="insScaleCm" type="number" min="0.1" step="0.1" value="${getScaleCmPerUnit()}"></div>
          </div>`}
        </div>
      </details>
      <div style="height:12px"></div>
      <details class="inspector-section" id="inspectorRackSection" ${rackOpen ? 'open' : ''}>
        <summary class="inspector-summary">Propiedades de rack</summary>
        <div class="inspector-body">
          <div class="empty" style="padding:14px 8px"><b>Propiedades movidas al panel lateral</b><div class="muted tiny" style="margin-top:8px">Modelo, rotación, alturas y ángulos rápidos ahora se editan desde el sidebar de Edición de Layout.</div></div>
        </div>
      </details>
      <div style="height:12px"></div>
      <div style="height:12px"></div>
      <details class="inspector-section" id="inspectorStackSection" ${stackOpen ? 'open' : ''}>
        <summary class="inspector-summary">Superposición / pila</summary>
        <div class="inspector-body">
          ${!rack ? `<div class="empty" style="padding:14px 8px"><b>Sin rack seleccionado</b><div class="muted tiny" style="margin-top:8px">Selecciona un rack para revisar si comparte huella con otros racks.</div></div>` : `
          <div class="grid">
            <div class="kv-row"><b>Estado</b><span>${stack.isStacked ? 'Apilado' : 'Individual'}</span></div>
            <div class="kv-row"><b>Cantidad en pila</b><span>${stack.count}</span></div>
            <div class="kv-row"><b>Rack activo</b><span>${escapeHtml(rack.id)}</span></div>
            <div class="kv-row"><b>Huella compartida</b><span>${escapeHtml(rack.zoneId)} · (${Math.round(rack.x)}, ${Math.round(rack.y)})</span></div><div class="kv-row"><b>Nivel activo</b><span>N${getRackLevelValue(rack)}</span></div>
            ${stack.isStacked ? `<div style="display:grid;gap:8px">${stack.members.map(member => `<button type="button" class="seg-btn stack-ins-btn ${member.id===rack.id?'active':''}" data-stack-ins-rack="${member.id}" style="text-align:left;padding:10px 12px">${escapeHtml(member.id)} · ${escapeHtml(rackModel(member.modelId).name)}</button>`).join('')}</div>` : `<div class="tiny muted">Este rack no comparte su base con otros racks.</div>`}
            <div class="two">
              <button class="seg-btn" id="insOpenStackMenu" ${stack.isStacked ? '' : 'disabled'}>Ver selector flotante</button>
              <button class="seg-btn" id="insCloseStackMenu">Ocultar selector</button>
            </div>
          </div>`}
        </div>
      </details>
      <div style="height:12px"></div>
      <details class="inspector-section" id="inspectorSectionSection" ${sectionOpen ? 'open' : ''}>
        <summary class="inspector-summary">Propiedades de sección</summary>
        <div class="inspector-body">
          <div class="grid">
            <div class="two">
              <div><label class="tiny muted">Corte X</label><div class="chip">${getSectionCut('x').dir===1 ? 'hacia derecha' : 'hacia izquierda'}</div></div>
              <div><label class="tiny muted">Corte Y</label><div class="chip">${getSectionCut('y').dir===1 ? 'hacia abajo' : 'hacia arriba'}</div></div>
            </div>
            <div class="two">
              <div><label class="tiny muted">Rango X (u)</label><input id="insSectionRangeX" type="number" min="10" max="2000" step="1" value="${Math.round((getSectionCut('x').depth || 100))}"></div>
              <div><label class="tiny muted">Rango Y (u)</label><input id="insSectionRangeY" type="number" min="10" max="2000" step="1" value="${Math.round((getSectionCut('y').depth || 100))}"></div>
            </div>
            <div class="kv-row"><b>Comportamiento</b><span>Solo se abre manualmente desde el icono de desplegar</span></div>
          </div>
        </div>
      </details>`;

    const infoSection = $('#inspectorInfoSection');
    const zoneSection = $('#inspectorZoneSection');
    const rackSection = $('#inspectorRackSection');
    const stackSection = $('#inspectorStackSection');
    const sectionSection = $('#inspectorSectionSection');
    if(infoSection) infoSection.addEventListener('toggle', () => { appState.editor.inspectorInfoOpen = infoSection.open; });
    if(zoneSection) zoneSection.addEventListener('toggle', () => { appState.editor.inspectorZoneOpen = zoneSection.open; });
    if(rackSection) rackSection.addEventListener('toggle', () => { appState.editor.inspectorRackOpen = rackSection.open; });
    if(stackSection) stackSection.addEventListener('toggle', () => { appState.editor.inspectorStackOpen = stackSection.open; });
    if(sectionSection) sectionSection.addEventListener('toggle', () => { appState.editor.inspectorSectionOpen = sectionSection.open; });

    if($('#insZoneName')) {
      $('#insZoneName').oninput = e => { zone.name = e.target.value; };
      $('#insZoneName').onchange = () => { persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#insZoneCode')) {
      const commitZoneCode = (value) => {
        const previous = zone.id;
        const updated = renameZoneId(previous, value);
        const el = $('#insZoneCode');
        if(el) el.value = updated;
        renderLayoutEditor();
      };
      $('#insZoneCode').onchange = e => commitZoneCode(e.target.value);
      $('#insZoneCode').onblur = e => commitZoneCode(e.target.value);
    }
    if($('#insZoneColor')) $('#insZoneColor').oninput = e => { zone.color = e.target.value; persistActiveLayout(); renderLayoutEditor(); };
    if($('#insScaleCm')) $('#insScaleCm').onchange = e => { ensureLayoutMeta(); appState.layout.meta.scaleCmPerUnit = Math.max(0.1, Number(e.target.value || 1) || 1); persistActiveLayout(); renderLayoutEditor(); };
    if($('#insRackModel')) $('#insRackModel').onchange = e => { const oldDefault = rackModel(rack.modelId).height || 238; const prevHeight = Number(rack.rackHeight || oldDefault); rack.modelId = e.target.value; const newDefault = rackModel(rack.modelId).height || 238; if(!Number.isFinite(prevHeight) || Math.abs(prevHeight - oldDefault) < 1) rack.rackHeight = newDefault; syncRackFootprint(rack, true); const host=findZoneById(rack.zoneId); if(host){ keepRackSnapped(rack, host); } persistActiveLayout(); renderLayoutEditor(); };
    if($('#sideRackModel')) $('#sideRackModel').onchange = e => { if(!rack) return; const oldDefault = rackModel(rack.modelId).height || 238; const prevHeight = Number(rack.rackHeight || oldDefault); rack.modelId = e.target.value; const newDefault = rackModel(rack.modelId).height || 238; if(!Number.isFinite(prevHeight) || Math.abs(prevHeight - oldDefault) < 1) rack.rackHeight = newDefault; syncRackFootprint(rack, true); const host=findZoneById(rack.zoneId); if(host){ keepRackSnapped(rack, host); } persistActiveLayout(); renderLayoutEditor(); };
    if($('#insRackX')) {
      $('#insRackX').oninput = e => { rack.x = Number(e.target.value || 0) || 0; };
      $('#insRackX').onchange = e => { rack.x = Number(e.target.value || 0) || 0; const host=findZoneById(rack.zoneId); if(host){ keepRackSnapped(rack, host); } persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#insRackY')) {
      $('#insRackY').oninput = e => { rack.y = Number(e.target.value || 0) || 0; };
      $('#insRackY').onchange = e => { rack.y = Number(e.target.value || 0) || 0; const host=findZoneById(rack.zoneId); if(host){ keepRackSnapped(rack, host); } persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#insRackRot')) {
      const applyRotation = (value) => {
        rack.rot = normalizeAngle(Number(value || 0) || 0);
        syncRackFootprint(rack, true);
        const host = findZoneById(rack.zoneId);
        if(host) keepRackSnapped(rack, host);
        persistActiveLayout();
        renderLayoutEditor();
      };
      $('#insRackRot').oninput = e => { rack.rot = Number(e.target.value || 0) || 0; };
      $('#insRackRot').onchange = e => applyRotation(e.target.value);
      $('#insRackRot').onblur = e => applyRotation(e.target.value);
    }
    if($('#sideRackRot')) {
      const applySideRotation = (value) => {
        if(!rack) return;
        rack.rot = normalizeAngle(Number(value || 0) || 0);
        syncRackFootprint(rack, true);
        const host = findZoneById(rack.zoneId);
        if(host) keepRackSnapped(rack, host);
        persistActiveLayout();
        renderLayoutEditor();
      };
      $('#sideRackRot').oninput = e => { if(!rack) return; rack.rot = Number(e.target.value || 0) || 0; };
      $('#sideRackRot').onchange = e => applySideRotation(e.target.value);
      $('#sideRackRot').onblur = e => applySideRotation(e.target.value);
    }
    if($('#insRackBaseH')) {
      $('#insRackBaseH').oninput = e => { rack.baseHeight = Math.max(0, Number(e.target.value || 0) || 0); };
      $('#insRackBaseH').onchange = e => { rack.baseHeight = Math.max(0, Number(e.target.value || 0) || 0); persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#sideRackBaseH')) {
      $('#sideRackBaseH').oninput = e => { if(!rack) return; rack.baseHeight = Math.max(0, Number(e.target.value || 0) || 0); };
      $('#sideRackBaseH').onchange = e => { if(!rack) return; rack.baseHeight = Math.max(0, Number(e.target.value || 0) || 0); persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#insRackHeight')) {
      $('#insRackHeight').oninput = e => { rack.rackHeight = Math.max(60, Number(e.target.value || 0) || 60); };
      $('#insRackHeight').onchange = e => { rack.rackHeight = Math.max(60, Number(e.target.value || 0) || 60); persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#sideRackHeight')) {
      $('#sideRackHeight').oninput = e => { if(!rack) return; rack.rackHeight = Math.max(60, Number(e.target.value || 0) || 60); syncRackStackMetrics(rack, false); };
      $('#sideRackHeight').onchange = e => { if(!rack) return; rack.rackHeight = Math.max(60, Number(e.target.value || 0) || 60); syncRackStackMetrics(rack, false); persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#sideRackStackLevel')) {
      $('#sideRackStackLevel').oninput = e => { if(!rack) return; rack.stackLevel = Math.max(0, parseInt(e.target.value || 0, 10) || 0); syncRackStackMetrics(rack, false); };
      $('#sideRackStackLevel').onchange = e => { if(!rack) return; rack.stackLevel = Math.max(0, parseInt(e.target.value || 0, 10) || 0); syncRackStackMetrics(rack, false); persistActiveLayout(); renderLayoutEditor(); };
    }
    if($('#btnRackAddAbove')) $('#btnRackAddAbove').onclick = () => {
      if(!rack) return;
      const zone = findZoneById(rack.zoneId);
      if(!zone) return;
      const cloneRack = JSON.parse(JSON.stringify(rack));
      cloneRack.id = nextRackId(rack.zoneId);
      cloneRack.stackLevel = getRackLevelValue(rack) + 1;
      syncRackStackMetrics(cloneRack, false);
      cloneRack.baseHeight = getRackVerticalBase(rack) + Math.max(60, Number(rack.rackHeight || rackModel(rack.modelId).height || 240) || 240);
      cloneRack.x = rack.x;
      cloneRack.y = rack.y;
      appState.layout.racks.push(cloneRack);
      appState.selectedRackLayoutId = cloneRack.id;
      persistActiveLayout();
      renderLayoutEditor();
    };
    if($('#insSectionRangeX')) $('#insSectionRangeX').onchange = e => { setSectionCutDepth('x', Math.max(10, Number(e.target.value||10)||10)); persistActiveLayout(); renderLayoutEditor(); };
    if($('#insSectionRangeY')) $('#insSectionRangeY').onchange = e => { setSectionCutDepth('y', Math.max(10, Number(e.target.value||10)||10)); persistActiveLayout(); renderLayoutEditor(); };
    $$('.quick-angle').forEach(btn => btn.onclick = () => { if(!rack) return; rack.rot = normalizeAngle(Number(btn.dataset.angle||0)||0); syncRackFootprint(rack, true); const host=findZoneById(rack.zoneId); if(host){ keepRackSnapped(rack, host); } persistActiveLayout(); renderLayoutEditor(); });
    if($('#insDupRack')) $('#insDupRack').onclick = () => { if(!rack) return; duplicateRackLayout(rack.id); };
    if($('#insDupZone')) $('#insDupZone').onclick = () => { if(zone) duplicateZone(zone.id); else if(rack) duplicateZone(rack.zoneId); };
    document.querySelectorAll('[data-stack-ins-rack]').forEach(btn => btn.onclick = () => {
      const target = findRackById(btn.getAttribute('data-stack-ins-rack'));
      if(!target) return;
      appState.selectedRackLayoutId = target.id;
      appState.selectedZoneId = target.zoneId;
      renderLayoutEditor();
    });
    if($('#insOpenStackMenu')) $('#insOpenStackMenu').onclick = () => { if(!rack) return; openStackMenuForRack(rack.id); renderLayoutStackMenu(); };
    if($('#insCloseStackMenu')) $('#insCloseStackMenu').onclick = () => { closeStackMenu(); renderLayoutStackMenu(); };
  }

  function resetRackPreviewCamera(){
    if(!appState.ui) appState.ui = {};
    appState.ui.rackPreviewCamera = null;
  }


  function rerenderRackEditorPreservingState(options = {}){
    const main = document.querySelector('.rack-models-main');
    const list = document.getElementById('modelsList');
    const mainScroll = main ? main.scrollTop : 0;
    const listScroll = list ? list.scrollTop : 0;

    renderModelsList();
    renderRackModelPreview();
    if(window.contentFootRight) contentFootRight.textContent = `${appState.models.length} modelos`;

    requestAnimationFrame(() => {
      const nextMain = document.querySelector('.rack-models-main');
      const nextList = document.getElementById('modelsList');
      if(nextMain){
        const maxMainScroll = Math.max(0, nextMain.scrollHeight - nextMain.clientHeight);
        nextMain.scrollTop = Math.min(Math.max(0, mainScroll), maxMainScroll);
      }
      if(nextList){
        const maxListScroll = Math.max(0, nextList.scrollHeight - nextList.clientHeight);
        nextList.scrollTop = Math.min(Math.max(0, listScroll), maxListScroll);
      }
    });
  }

  async function switchViewerBranch(branchIndex){
    const index = Number(branchIndex);
    if(!Number.isFinite(index)) return;
    await activateBranchSelection(index);
    loadLayoutForBranch(index);
    if(Array.isArray(appState.filtered) && appState.filtered.length){
      const preferred = appState.selectedProduct && appState.filtered.find(p => p.sku === appState.selectedProduct.sku && p.ubicacion === appState.selectedProduct.ubicacion);
      appState.selectedProduct = preferred || appState.filtered[0];
      appState.selectedRack = appState.selectedProduct?.rack || appState.selectedProduct?.rackStore || ''; 
      appState.selectedRackLayoutId = appState.selectedRack;
    } else {
      appState.selectedProduct = null;
      appState.selectedRack = appState.layout?.racks?.[0]?.id || ''; 
      appState.selectedRackLayoutId = appState.selectedRack;
    }
    renderProducts(appState.filtered || []);
    renderMapView();
  }

  function renderRackModels(){
    appState.screen = 'racks';
    contentTitle.textContent = 'Edición de Rack';
    contentSubtitle.textContent = 'Diseña modelos reutilizables de rack, sus niveles y su preview técnico.';
    detailTitle.textContent = 'Preview del modelo';
    detailSubtitle.textContent = 'Arrastra para mover y usa la rueda para acercar o alejar.';
    setTags(['modelos', 'niveles', 'preview', 'biblioteca']);

    if (!Array.isArray(appState.models) || !appState.models.length){
      appState.models = [
        { id:'std_4', name:'Rack estándar 4 niveles', levels:4, width:120, depth:40, height:240, clearance:0, style:'metallic', slots:2, beam:2 },
        { id:'wide_5', name:'Rack ancho 5 niveles', levels:5, width:172, depth:90, height:270, clearance:0, style:'wide', slots:2, beam:2 },
        { id:'compact_3', name:'Rack compacto 3 niveles', levels:3, width:132, depth:76, height:200, clearance:0, style:'melamine', slots:2, beam:2 }
      ];
      saveRackModels();
    }
    if (!Array.isArray(appState.ui.rackLibraryOpenIds)) appState.ui.rackLibraryOpenIds = [];
    if (!Array.isArray(appState.ui.rackLibraryLevelsOpenIds)) appState.ui.rackLibraryLevelsOpenIds = [];
    if (!appState.selectedModelId || !appState.models.some(m => m.id === appState.selectedModelId)){
      appState.selectedModelId = appState.models[0].id;
    }
    
    const active = rackModel(appState.selectedModelId) || appState.models[0];

    contentWrap.innerHTML = `
      <div class="rack-models-page">
        <div class="rack-models-main">
          <section class="rack-block">
            <div class="rack-block-head">
              <div>
                <h3>Acciones del modelo</h3>
                <div class="rack-block-sub">Selecciona un modelo desde la biblioteca y edítalo directamente ahí. Los cambios afectan el preview en tiempo real.</div>
              </div>
              <div class="tag-row">
                <span class="tag">Modelo activo</span>
                <span class="tag">${escapeHtml(active?.name || '')}</span>
              </div>
            </div>
            <div class="model-actions">
              <button class="btn" id="btnSaveModel">Guardar modelo</button>
              <button class="btn alt" id="btnNewModel">Nuevo modelo</button>
              <button class="btn alt" id="btnDuplicateModel">Duplicar modelo</button>
              <button class="btn alt" id="btnDeleteModel">Eliminar modelo</button>
            </div>
          </section>

          <section class="rack-block rack-library-editor-block">
            <div class="rack-block-head">
              <div>
                <h3>Biblioteca de modelos</h3>
                <div class="rack-block-sub">Cada modelo tiene su propio editor y su editor de niveles dentro del acordeón.</div>
              </div>
              <div class="tag-row">
                <span class="tag">${appState.models.length} modelos</span>
                <span class="tag">Editor integrado</span>
              </div>
            </div>
            <div id="modelsList" class="model-library library-list model-library-scroll library-master"></div>
          </section>
        </div>

        <aside class="rack-models-side">
          <section class="rack-block preview-box-3d">
            <div class="rack-block-head">
              <div>
                <h3>Preview del modelo</h3>
                <div class="rack-block-sub">Vista grande y centrada para revisar la estructura del modelo activo.</div>
              </div>
            </div>
            <div class="detail-stage is-navigable" id="rackPreviewStage"><svg id="rackModelSvg" viewBox="0 0 520 480"></svg></div>
          </section>
        </aside>
      </div>`;

    detailWrap.innerHTML = '';
    const saveBtn = $('#btnSaveModel');
    if (saveBtn) saveBtn.onclick = saveRackModel;
    if ($('#btnNewModel')) $('#btnNewModel').onclick = createNewRackModelDraft;
    if ($('#btnDuplicateModel')) $('#btnDuplicateModel').onclick = () => duplicateRackModel(appState.selectedModelId);
    if ($('#btnDeleteModel')) $('#btnDeleteModel').onclick = () => deleteRackModel(appState.selectedModelId);

    renderModelsList();
    renderRackModelPreview();
    contentStatus.textContent = 'Modo activo: EDICIÓN DE RACK • biblioteca editable, niveles integrados y preview técnico.';
    contentFootRight.textContent = `${appState.models.length} modelos`;
  }

  function renderModelsList(){
    const mount = $('#modelsList');
    if (!mount) return;
    if (!Array.isArray(appState.models)) appState.models = [];
    if (!Array.isArray(appState.ui.rackLibraryOpenIds)) appState.ui.rackLibraryOpenIds = [];
    if (!Array.isArray(appState.ui.rackLibraryLevelsOpenIds)) appState.ui.rackLibraryLevelsOpenIds = [];
    mount.className = 'model-library library-list model-library-scroll';
    const orderedModels = [...appState.models];
    mount.innerHTML = orderedModels.map(m => {
      const open = appState.ui.rackLibraryOpenIds.includes(m.id);
      const levelsOpen = appState.ui.rackLibraryLevelsOpenIds.includes(m.id);
      const levelHeights = buildLevelHeights(m);
      return `
      <div class="library-item ${m.id===appState.selectedModelId?'active':''} ${open?'open':''}" data-mid="${m.id}">
        <div class="library-item-head" data-library-toggle="${m.id}">
          <div class="library-item-left">
            <div class="library-item-title">${escapeHtml(m.name)}</div>
            <div class="library-item-sub">${rackStyleSub(m.style)}</div>
          </div>
          <div class="library-inline-meta">
            <span class="library-inline-pill">${m.levels} niveles</span>
            <span class="library-inline-pill">${m.width}×${m.depth}×${m.height} cm</span>
          </div>
          <span class="tag">${rackStyleLabel(m.style)}</span>
          <button class="library-toggle" type="button" data-library-toggle-btn="${m.id}" aria-label="${open?'Minimizar modelo':'Desplegar modelo'}">${open?'−':'+'}</button>
        </div>
        ${open ? `
        <div class="library-item-body">
          <div class="model-inline-grid-2">
            <div>
              <label class="field-label">Nombre del modelo</label>
              <input data-model-input="name" data-mid="${m.id}" value="${escapeHtml(m.name)}" />
            </div>
            <div>
              <label class="field-label">Tipo</label>
              <select data-model-input="style" data-mid="${m.id}">
                <option value="metallic" ${normalizeRackStyle(m.style)==='metallic'?'selected':''}>Metálico</option>
                <option value="melamine" ${normalizeRackStyle(m.style)==='melamine'?'selected':''}>Melamina</option>
              </select>
            </div>
          </div>
          <div class="model-inline-grid-4">
            <div><label class="field-label">Niveles</label><input type="number" min="2" max="12" step="1" data-model-input="levels" data-mid="${m.id}" value="${m.levels}" /></div>
            <div><label class="field-label">Largo (cm)</label><input type="number" min="30" step="1" data-model-input="width" data-mid="${m.id}" value="${m.width}" /></div>
            <div><label class="field-label">Ancho (cm)</label><input type="number" min="20" step="1" data-model-input="depth" data-mid="${m.id}" value="${m.depth}" /></div>
            <div><label class="field-label">Alto (cm)</label><input type="number" min="60" step="1" data-model-input="height" data-mid="${m.id}" value="${m.height}" /></div>
          </div>
          <div class="model-inline-grid-4">
            <div><label class="field-label">Altura desde el piso (cm)</label><input type="number" min="0" max="120" step="1" data-model-input="clearance" data-mid="${m.id}" value="${m.clearance || 0}" /></div>
            <div><label class="field-label">Slots por nivel</label><input type="number" min="1" max="12" step="1" data-model-input="slots" data-mid="${m.id}" value="${m.slots || m.capacity || 2}" /></div>
            <div></div>
            <div class="library-inline-actions-box"><button class="mini-btn" data-level-toggle="${m.id}">${levelsOpen?'Ocultar niveles':'Editar niveles'}</button></div>
          </div>
          ${levelsOpen ? `
          <div class="library-levels-panel open" data-level-panel="${m.id}">
            <div class="level-editor-tools inline-level-tools">
              <span class="tag">${levelHeights.length} niveles</span>
              <button class="mini-btn" data-model-auto-levels="${m.id}">Auto distribuir</button>
            </div>
            <div class="level-editor-list embedded-level-list">
              ${levelHeights.map((value, idx) => `
                <div class="level-row compact">
                  <strong>Nivel ${idx + 1}</strong>
                  <input type="number" min="10" step="1" value="${value}" data-level-height-model="${m.id}" data-level-height-index="${idx}" />
                  <div class="level-slot-inline">
                    <label>Slots</label>
                    <input type="number" min="1" max="12" step="1" value="${buildLevelSlots(m)[idx] || Math.max(1, Number(m.slots||2)||2)}" data-level-slot-model="${m.id}" data-level-slot-index="${idx}" />
                  </div>
                </div>`).join('')}
            </div>
          </div>` : ''}
          <div class="model-card-actions">
            <button class="mini-btn" data-model-action="duplicate" data-mid="${m.id}">Duplicar</button>
            <button class="mini-btn" data-model-action="delete" data-mid="${m.id}">Eliminar</button>
            <button class="mini-btn" data-model-action="use" data-mid="${m.id}">Activar</button>
          </div>
        </div>` : ''}
      </div>`;
    }).join('');

    $$('[data-library-toggle]').forEach(head => head.onclick = (e) => {
      if(e.target.closest('[data-library-toggle-btn]')) return;
      const id = head.getAttribute('data-library-toggle');
      const changed = appState.selectedModelId !== id;
      appState.selectedModelId = id;
      if(changed) resetRackPreviewCamera();
      appState.ui.rackLibraryOpenIds = [id];
      rerenderRackEditorPreservingState({ focusId:id });
    });

    $$('[data-library-toggle-btn]').forEach(btn => {
      const toggleModelCard = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-library-toggle-btn');
        const openIds = Array.isArray(appState.ui.rackLibraryOpenIds) ? [...appState.ui.rackLibraryOpenIds] : [];
        const isOpen = openIds.includes(id);
        appState.ui.rackLibraryOpenIds = isOpen ? openIds.filter(x => x !== id) : [id];
        if(isOpen){
          appState.ui.rackLibraryLevelsOpenIds = appState.ui.rackLibraryLevelsOpenIds.filter(x => x !== id);
        }
        if(!isOpen && appState.selectedModelId !== id){
          appState.selectedModelId = id;
          resetRackPreviewCamera();
        }
        rerenderRackEditorPreservingState({ focusId:id });
      };
      btn.onclick = toggleModelCard;
      btn.onpointerdown = (e) => { e.stopPropagation(); };
    });

    $$('[data-model-input]').forEach(el => {
      const handler = () => updateRackModelField(el.getAttribute('data-mid'), el.getAttribute('data-model-input'), el.value);
      el.oninput = handler;
      if(el.tagName === 'SELECT') el.onchange = handler;
    });

    $$('[data-level-toggle]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const id = btn.getAttribute('data-level-toggle');
      const open = appState.ui.rackLibraryLevelsOpenIds.includes(id);
      const changed = appState.selectedModelId !== id;
      appState.selectedModelId = id;
      if(changed) resetRackPreviewCamera();
      appState.ui.rackLibraryLevelsOpenIds = open ? appState.ui.rackLibraryLevelsOpenIds.filter(x => x!==id) : [...appState.ui.rackLibraryLevelsOpenIds.filter(x => x!==id), id];
      rerenderRackEditorPreservingState({ focusId:id });
    });

    $$('[data-level-height-model]').forEach(inp => inp.oninput = () => {
      const id = inp.getAttribute('data-level-height-model');
      const idx = Number(inp.getAttribute('data-level-height-index') || 0);
      const model = rackModel(id);
      if(!model) return;
      const heights = buildLevelHeights(model);
      heights[idx] = Math.max(10, Number(inp.value || 10) || 10);
      model.levelHeights = heights;
      appState.selectedModelId = id;
      renderRackModelPreview();
    });
    $$('[data-level-slot-model]').forEach(inp => {
      const applyValue = (nextValue) => {
        const id = inp.getAttribute('data-level-slot-model');
        const idx = Number(inp.getAttribute('data-level-slot-index') || 0);
        const model = rackModel(id);
        if(!model) return;
        const slots = buildLevelSlots(model);
        const current = Number(nextValue ?? inp.value);
        slots[idx] = Math.max(1, Math.min(12, current || 1));
        model.levelSlots = slots;
        model.slots = Math.max(...slots);
        appState.selectedModelId = id;
        rerenderRackEditorPreservingState({ focusId:id });
      };
      inp.oninput = () => applyValue();
      inp.onchange = () => applyValue();
    });

    $$('[data-level-slot-step]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-level-slot-model');
      const idx = Number(btn.getAttribute('data-level-slot-index') || 0);
      const step = Number(btn.getAttribute('data-level-slot-step') || 0) || 0;
      const model = rackModel(id);
      if(!model) return;
      const slots = buildLevelSlots(model);
      slots[idx] = Math.max(1, Math.min(12, (Number(slots[idx] || model.slots || 2) || 2) + step));
      model.levelSlots = slots;
      model.slots = Math.max(...slots);
      appState.selectedModelId = id;
      rerenderRackEditorPreservingState({ focusId:id });
    });

    $$('[data-model-auto-levels]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      autoDistributeLevels(btn.getAttribute('data-model-auto-levels'));
    });

    $$('[data-model-action]').forEach(btn => btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-mid');
      const action = btn.getAttribute('data-model-action');
      if(action === 'duplicate') duplicateRackModel(id);
      else if(action === 'delete') deleteRackModel(id);
      else if(action === 'use'){ const changed = appState.selectedModelId !== id; appState.selectedModelId = id; if(changed) resetRackPreviewCamera(); rerenderRackEditorPreservingState({ focusId:id }); }
    });
  }

  function buildLevelHeights(model){
    const count = Math.max(2, Math.min(12, Number(model?.levels || 4) || 4));
    const stored = Array.isArray(model?.levelHeights) ? model.levelHeights.map(v => Math.max(10, Number(v)||10)) : [];
    if (stored.length === count) return stored;
    const usable = Math.max(20, (Number(model?.height || 238) || 238) - (Number(model?.clearance || 0) || 0));
    const each = Math.max(10, Math.round((usable / count) * 10) / 10);
    return Array.from({length: count}, () => each);
  }
  function buildLevelSlots(model){
    const count = Math.max(2, Math.min(12, Number(model?.levels || 4) || 4));
    const fallback = Math.max(1, Math.min(12, Number(model?.slots || model?.capacity || 2) || 2));
    const stored = Array.isArray(model?.levelSlots) ? model.levelSlots.map(v => Math.max(1, Math.min(12, Number(v)||fallback))) : [];
    if (stored.length === count) return stored;
    return Array.from({length: count}, (_, idx) => stored[idx] || fallback);
  }
  function getRackCapacity(model){
    const levelSlots = buildLevelSlots(model || {});
    return Math.max(1, levelSlots.reduce((sum, v) => sum + Math.max(1, Number(v)||0), 0));
  }

  function normalizeRackStyle(style){
    const raw = String(style || '').toLowerCase();
    if(raw === 'melamine' || raw === 'melamina' || raw === 'compact') return 'melamine';
    return 'metallic';
  }
  function rackStyleLabel(style){
    return normalizeRackStyle(style) === 'melamine' ? 'Melamina' : 'Metálico';
  }
  function rackStyleSub(style){
    return normalizeRackStyle(style) === 'melamine' ? 'Rack melamina' : 'Rack metálico';
  }

  
  function syncLevelEditorCount(modelId){
    const model = rackModel(modelId || appState.selectedModelId);
    if(!model) return;
    const count = Math.max(2, Math.min(12, Number(model.levels || 4) || 4));
    const current = buildLevelHeights(model);
    if(current.length !== count){
      const next = Array.from({length: count}, (_, idx) => current[idx] || current[current.length - 1] || 60);
      model.levelHeights = next;
    }
    const currentSlots = buildLevelSlots(model);
    if(currentSlots.length !== count){
      const nextSlots = Array.from({length: count}, (_, idx) => currentSlots[idx] || currentSlots[currentSlots.length - 1] || Math.max(1, Number(model.slots||2)||2));
      model.levelSlots = nextSlots;
    }
  }

  function renderLevelEditor(){ return; }

  
  function createNewRackModelDraft(){
    const base = {
      id: 'm_' + Math.random().toString(16).slice(2,8),
      name: 'Nuevo modelo',
      levels: 4,
      width: 150,
      depth: 82,
      height: 240,
      clearance: 0,
      slots: 2,
      beam: 2,
      style: 'metallic',
      levelHeights: [60,60,60,58],
      levelSlots: [2,2,2,2]
    };
    appState.models.push(base);
    appState.selectedModelId = base.id;
    resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = [base.id];
    appState.ui.rackLibraryLevelsOpenIds = [];
    saveRackModels();
    renderRackModels();
  }

  
  function duplicateRackModel(id){
    const model = rackModel(id);
    if(!model) return;
    const copy = {
      ...clone(model),
      id: 'm_' + Math.random().toString(16).slice(2,8),
      name: `${model.name} copia`
    };
    appState.models.unshift(copy);
    appState.selectedModelId = copy.id;
    resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = [copy.id];
    saveRackModels();
    renderRackModels();
  }

  
  function deleteRackModel(id){
    if(!id || !Array.isArray(appState.models) || appState.models.length <= 1) return;
    appState.models = appState.models.filter(m => m.id !== id);
    if(!appState.models.some(m => m.id === appState.selectedModelId)) appState.selectedModelId = appState.models[0]?.id || '';
    resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = appState.selectedModelId ? [appState.selectedModelId] : [];
    appState.ui.rackLibraryLevelsOpenIds = appState.ui.rackLibraryLevelsOpenIds.filter(mid => mid !== id);
    saveRackModels();
    renderRackModels();
  }

  
  function useRackModel(id){
    const changed = appState.selectedModelId !== id;
    appState.selectedModelId = id;
    if(changed) resetRackPreviewCamera();
    appState.ui.rackLibraryOpenIds = [id];
    renderRackModels();
  }

  
  function autoDistributeLevels(modelId){
    const targetId = modelId || appState.selectedModelId;
    const draft = rackModel(targetId);
    if(!draft) return;
    const count = Math.max(2, Number(draft.levels||4)||4);
    const usable = Math.max(20, draft.height - draft.clearance);
    const each = Math.max(10, Math.round((usable / count) * 10) / 10);
    draft.levelHeights = Array.from({length: count}, () => each);
    draft.levelSlots = Array.from({length: count}, () => Math.max(1, Math.min(12, Number(draft.slots || 2) || 2)));
    appState.selectedModelId = targetId;
    renderRackModels();
  }

  
  function rackModelDraft(){
    const active = rackModel(appState.selectedModelId) || appState.models?.[0] || {
      id:'std_4', name:'Rack estándar 4 niveles', levels:4, width:120, depth:40, height:240, clearance:0, style:'metallic', slots:2, beam:2, levelSlots:[2,2,2,2]
    };
    return clone(active);
  }

  
  function saveRackModel(){
    saveRackModels();
    renderRackModels();
  }


  function updateRackModelField(id, field, rawValue){
    const model = rackModel(id);
    if(!model) return;
    appState.selectedModelId = id;
    if(field === 'name') model.name = String(rawValue || '').trimStart() || 'Sin nombre';
    else if(field === 'style') model.style = normalizeRackStyle(rawValue || model.style || 'metallic');
    else if(field === 'levels'){
      model.levels = Math.max(2, Math.min(12, Number(rawValue || 4) || 4));
      syncLevelEditorCount(id);
    } else if(field === 'width') model.width = Math.max(30, Number(rawValue || model.width || 150) || 150);
    else if(field === 'depth') model.depth = Math.max(20, Number(rawValue || model.depth || 82) || 82);
    else if(field === 'height') model.height = Math.max(60, Number(rawValue || model.height || 240) || 240);
    else if(field === 'clearance') model.clearance = Math.max(0, Math.min(120, Number(rawValue || model.clearance || 0) || 0));
    else if(field === 'slots'){
      model.slots = Math.max(1, Math.min(12, Number(rawValue || model.slots || 2) || 2));
      model.levelSlots = Array.from({length: Math.max(2, Math.min(12, Number(model.levels || 4) || 4))}, () => model.slots);
    }
    else if(field === 'beam') model.beam = Math.max(2, Math.min(20, Number(rawValue || model.beam || 6) || 6));
    if(field === 'height' || field === 'clearance' || field === 'levels') syncLevelEditorCount(id);
    renderRackModelPreview();
  }

  
  function buildRackModelSummary(model){ return ''; }

  function renderRackModelPreview(){
    const svg = $('#rackModelSvg'); 
    if(!svg) return;
    svg.innerHTML = '';

    const rid = appState.selectedRackLayoutId || appState.selectedProduct?.rack;
    const rack = rid ? findRackById(rid) : (appState.layout?.racks?.[0] || null);
    const activeModelId = appState.selectedModelId || rack?.modelId;
    const hasDraft = false;
    const previewModel = hasDraft ? rackModelDraft() : (rackModel(activeModelId) || appState.models?.[0]);
    const previewRack = rack ? { ...rack, modelId: previewModel?.id || rack.modelId } : { id: previewModel?.name || 'modelo', modelId: previewModel?.id || activeModelId };

    renderRackDetail(rid || previewModel?.name || 'modelo', appState.selectedProduct && rid === appState.selectedProduct.rack ? appState.selectedProduct : null, svg, previewModel, previewRack);
    detailStatus.textContent = rack ? `${rack.id} • ${previewModel?.name || ''}` : (previewModel?.name || '');
    detailChip.textContent = `${previewModel?.levels || 0} niveles • Piso ${previewModel?.clearance || 0}cm`;
    enableRackPreviewNavigation(svg, previewModel?.id || activeModelId);
  }

  function getRackPreviewModelTweak(modelId){
    const model = rackModel(modelId) || appState.models?.find(m => m?.id === modelId) || null;
    if(!model) return null;
    const name = String(model.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if(name.includes('bajo escalera reflejado')) return { dy: 200 };
    if(name.includes('bajo escalera')) return { dy: 200, zoom: 0.765 };
    return null;
  }

  function getCenteredPreviewView(svg, vb, modelId = null){
    const aspect = Math.max(0.3, (svg.clientWidth || 780) / Math.max(1, (svg.clientHeight || 640)));
    const cx = vb.x + vb.width / 2;
    const cy = vb.y + vb.height / 2;
    let w = vb.width;
    let h = vb.height;
    const currentAspect = vb.width / Math.max(1, vb.height);
    if(currentAspect > aspect){
      h = w / aspect;
    } else {
      w = h * aspect;
    }
    // Nuevo encuadre inicial: un poco más de aire y sesgo hacia arriba para que el rack no quede tan bajo.
    w *= 1.20;
    h *= 1.20;
    const tweak = getRackPreviewModelTweak(modelId);
    const extraDy = tweak?.dy || 0;
    const zoom = tweak?.zoom || 1;
    if(zoom !== 1){
      w *= zoom;
      h *= zoom;
    }
    return { x: cx - w / 2, y: cy - h / 2 - (h * 0.07) + extraDy, w, h };
  }

  function enableRackPreviewNavigation(svg, modelId){
    if(!svg) return;
    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
    if(!vb || !vb.width || !vb.height) return;
    if(!appState.ui) appState.ui = {};
    const saved = appState.ui.rackPreviewCamera;
    const initialView = getCenteredPreviewView(svg, { x: vb.x, y: vb.y, width: vb.width, height: vb.height }, modelId);
    let view = (saved && saved.modelId === modelId && saved.view) ? { ...saved.view } : { ...initialView };
    let dragging = false;
    let start = null;
    const apply = () => { svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); appState.ui.rackPreviewCamera = { modelId, view: { ...view } }; };
    apply();
    svg.onwheel = (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
      const py = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;
      const mx = view.x + view.w * px;
      const my = view.y + view.h * py;
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      const nw = Math.max(120, Math.min(1600, view.w * factor));
      const nh = Math.max(140, Math.min(1800, view.h * factor));
      view.x = mx - nw * px;
      view.y = my - nh * py;
      view.w = nw;
      view.h = nh;
      apply();
    };
    svg.onpointerdown = (e) => {
      dragging = true;
      start = { x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y, w: view.w, h: view.h };
      const stage = document.getElementById('rackPreviewStage');
      if(stage) stage.classList.add('dragging');
      svg.setPointerCapture?.(e.pointerId);
    };
    svg.onpointermove = (e) => {
      if(!dragging || !start) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - start.x) / Math.max(1, rect.width)) * start.w;
      const dy = ((e.clientY - start.y) / Math.max(1, rect.height)) * start.h;
      view.x = start.viewX - dx;
      view.y = start.viewY - dy;
      apply();
    };
    svg.onpointerup = () => { dragging = false; start = null; const stage = document.getElementById('rackPreviewStage'); if(stage) stage.classList.remove('dragging'); };
    svg.onpointercancel = svg.onpointerup;
  }

  function renderReports(){
    renderMapView();
    contentTitle.textContent = 'Reportes';
    contentSubtitle.textContent = 'Resumen visual rápido del inventario y ubicación.';
    setTags(['resumen', 'zonas', 'racks', 'inventario']);
    contentStatus.textContent = 'Vista rápida de reportes.';
  }

  async function stopScanner(){
    try{
      if (html5QrScanner && scannerRunning) await html5QrScanner.stop();
    } catch (e) { console.warn(e); }
    scannerRunning = false;
    if (html5QrScanner){
      try { await html5QrScanner.clear(); } catch(e){}
      html5QrScanner = null;
    }
    scannerModal.classList.remove('show');
  }

  async function openScanner(mode='qr'){
    scannerHint.textContent = mode === 'bar' ? 'Apunta al código de barras con buena luz y distancia.' : 'Apunta al QR o código de barras.';
    scannerModal.classList.add('show');
    if (!window.Html5Qrcode) {
      alert('No se pudo cargar la librería del escáner. Revisa tu conexión.');
      return;
    }
    if (html5QrScanner){ await stopScanner(); scannerModal.classList.add('show'); }
    html5QrScanner = new Html5Qrcode('scannerReader');
    const formats = mode === 'bar'
      ? [ Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E, Html5QrcodeSupportedFormats.ITF ]
      : [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E ];
    try{
      const cameras = await Html5Qrcode.getCameras();
      const cameraId = (cameras.find(c => /back|rear|trasera/i.test(c.label || '')) || cameras[0] || {}).id;
      if (!cameraId) throw new Error('No se detectó cámara.');
      await html5QrScanner.start(
        cameraId,
        { fps: 12, qrbox: { width: 260, height: 180 }, formatsToSupport: formats, aspectRatio: 1.777 },
        (decodedText) => {
          searchInput.value = decodedText;
          filterProducts();
          const exact = appState.products.find(p => [p.sku,p.barras,p.rack,p.ubicacion].some(v => String(v||'').toLowerCase() === String(decodedText).toLowerCase()));
          if (exact) selectProduct(exact);
          stopScanner();
        },
        () => {}
      );
      scannerRunning = true;
    } catch(err){
      console.error(err);
      alert('No se pudo iniciar el escáner. Asegúrate de estar en localhost o https y de dar permiso a la cámara.');
      stopScanner();
    }
  }

  function renderCurrentScreen(){
    if(appState.screen === 'admin') return renderAdminScreen();
    if(appState.screen === 'viewer') return renderMapView();
    if(appState.screen === 'dashboard' || appState.screen === 'products') { appState.screen = 'viewer'; setActiveMenu('viewer'); return renderMapView(); }
    setUnifiedMapLayout(false);
    if(appState.screen === 'sheet') (typeof renderSheetScreen==='function'?renderSheetScreen():renderMapView());
    else if(appState.screen === 'layout') renderLayoutEditor();
    else if(appState.screen === 'racks') renderRackModels();
  }

  function applyUiTheme(theme){
    const next = theme === 'light' ? 'light' : 'dark';
    document.body.classList.toggle('theme-light', next === 'light');
    document.body.classList.toggle('theme-dark', next === 'dark');
    try{ localStorage.setItem('wms_ui_theme', next); }catch{}
    const toggleThemeCheckbox = document.getElementById('toggleThemeCheckbox');
    if(toggleThemeCheckbox) toggleThemeCheckbox.checked = next === 'light';
  }

  function loadUiTheme(){
    let theme = 'dark';
    try{ theme = localStorage.getItem('wms_ui_theme') || 'dark'; }catch{}
    applyUiTheme(theme);
  }

  const toggleThemeCheckbox = document.getElementById('toggleThemeCheckbox');
  if(toggleThemeCheckbox) toggleThemeCheckbox.addEventListener('change', (e) => {
    applyUiTheme(e.target.checked ? 'light' : 'dark');
  });

  toggleSidebar.addEventListener('click', () => {
    appRoot.classList.toggle('sidebar-collapsed');
    toggleSidebar.textContent = appRoot.classList.contains('sidebar-collapsed') ? '❯' : '❮';
    if(appState && appState.screen) setScreen(appState.screen);
  });
  menuItems.forEach(item => { item.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setScreen(item.dataset.screen); return false; }; });
  btnSearch.addEventListener('click', filterProducts);
  searchInput.addEventListener('input', debounce(filterProducts, 120));
  if($('#toggleGroupProducts')) { $('#toggleGroupProducts').classList.toggle('active', appState.ui.productGroupMode); $('#toggleGroupProducts').textContent = appState.ui.productGroupMode ? 'Ver individual' : 'Agrupar familias'; $('#toggleGroupProducts').onclick = () => { appState.ui.productGroupMode = !appState.ui.productGroupMode; $('#toggleGroupProducts').classList.toggle('active', appState.ui.productGroupMode); $('#toggleGroupProducts').textContent = appState.ui.productGroupMode ? 'Ver individual' : 'Agrupar familias'; renderProducts(appState.filtered && appState.filtered.length ? appState.filtered : appState.products); }; }
  if(btnScanCode) btnScanCode.addEventListener('click', () => openScanner('qr'));
  btnCloseScanner.addEventListener('click', stopScanner);
  btnStopScanner.addEventListener('click', stopScanner);
  scannerModal.addEventListener('click', (e) => { if (e.target === scannerModal) stopScanner(); });

  loadUiTheme();
  seedState();
  loadProductsLocal();
  renderProducts(appState.filtered);
  if(appState.products[0]) selectProduct(appState.products[0]);
  applyBrand();
  setScreen('admin');

})();
