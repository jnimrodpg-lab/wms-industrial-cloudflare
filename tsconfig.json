import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Building2, Search, Map, Warehouse, Settings, Database, Users, LayoutDashboard, Menu, LogOut, Plus, Save, UploadCloud, Eye } from 'lucide-react';
import './styles.css';

type Role = 'admin' | 'viewer';
type User = { id:string; name:string; email:string; password:string; role:Role };
type Company = { name:string; logo?:string; primaryColor:string; secondaryColor:string; systemName:string };
type Branch = { id:string; name:string; code:string; address:string; active:boolean; sheetUrl?:string; sheetName?:string };
type Mapping = Record<string,string>;
type Product = { id:string; branchId:string; sku:string; barcode:string; name:string; brand:string; category:string; imageUrl:string; stock:string; zone:string; rack:string; level:string; slot:string; location?:string; warehouse:string; price?:string; variant?:string; gender?:string; status?:string; model?:string; thickness?:string; size?:string; color?:string; line?:string; restock?:string; secondaryZone?:string; secondaryRack?:string; secondaryLevel?:string; secondarySlot?:string; searchText:string; raw?:Record<string,string> };
type Zone = { id:string; branchId:string; name:string; x:number; y:number; w:number; h:number; color:string };
type Rack = { id:string; branchId:string; zoneId:string; name:string; type:string; levels:number; columns:number; slots:number; x:number; y:number; w:number; h:number; color:string };
type AppData = { users:User[]; company:Company; branches:Branch[]; mappings:Record<string,Mapping>; zones:Zone[]; racks:Rack[]; lastImport?:Record<string,{count:number; date:string}> };

type ProductStats = { total:number; withoutImage:number; withLocation:number; incompleteLocation:number };

type SearchResult = { items:Product[]; total:number; page:number; pageSize:number };

const LS='wms_visual_v1_config_v2';
const OLD_LS='wms_visual_v1_data';
const SESSION='wms_visual_v1_session';
const DB_NAME='wms_visual_products_db';
const DB_VERSION=2;
const PRODUCT_STORE='products';
const IMPORT_CHUNK_SIZE=1000;
const SEARCH_PAGE_SIZE=60;

const fields = ['name','sku','barcode','brand','category','gender','status','model','thickness','size','color','line','variant','imageUrl','stock','zone','rack','level','slot','location','secondaryZone','secondaryRack','secondaryLevel','secondarySlot','warehouse','price','restock'];
const fieldLabels:Record<string,string>={name:'Nombre',sku:'SKU',barcode:'Código barras',brand:'Marca',category:'Categoría',gender:'Género',status:'Estado',model:'Cod / modelo',thickness:'Grosor',size:'Talla',color:'Color',line:'Línea',variant:'Variante',imageUrl:'Imagen URL',stock:'Stock',zone:'Zona principal',rack:'Estante principal',level:'Nivel principal',slot:'Slot principal',location:'Ubicación',secondaryZone:'Zona secundaria',secondaryRack:'Estante secundario',secondaryLevel:'Nivel secundario',secondarySlot:'Slot secundario',warehouse:'Almacén',price:'Precio lista',restock:'Cant. Restock'};
const POR_DEFECTO_SHEET_ORDER:Record<string,string>={gender:'__idx:0',category:'__idx:1',status:'__idx:2',brand:'__idx:3',model:'__idx:4',thickness:'__idx:5',size:'__idx:6',color:'__idx:7',line:'__idx:8',barcode:'__idx:9',sku:'__idx:10',name:'__idx:11',variant:'__idx:12',zone:'__idx:13',rack:'__idx:14',level:'__idx:15',slot:'__idx:16',location:'__idx:17',secondaryZone:'__idx:18',secondaryRack:'__idx:19',secondaryLevel:'__idx:20',secondarySlot:'__idx:21',warehouse:'__idx:22',price:'__idx:23',stock:'__idx:24',restock:'__idx:24'};
const defaultData:AppData={
 users:[{id:'u_admin',name:'Administrador',email:'admin@empresa.com',password:'admin123',role:'admin'},{id:'u_viewer',name:'Visualizador',email:'visor@empresa.com',password:'visor123',role:'viewer'}],
 company:{name:'Mi Empresa',primaryColor:'#2563eb',secondaryColor:'#0f172a',systemName:'WMS Visual Interno'},branches:[],mappings:{},zones:[],racks:[],lastImport:{}
};
const uid=(p='id')=>`${p}_${Math.random().toString(36).slice(2,10)}`;
const sleep=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const normalizeText=(value:any)=>String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cleanCell=(value:any)=>String(value??'').trim();

function cleanConfig(raw:any):AppData{
 return {
  users:Array.isArray(raw?.users)?raw.users:defaultData.users,
  company:raw?.company||defaultData.company,
  branches:Array.isArray(raw?.branches)?raw.branches:[],
  mappings:raw?.mappings||{},
  zones:Array.isArray(raw?.zones)?raw.zones:[],
  racks:Array.isArray(raw?.racks)?raw.racks:[],
  lastImport:raw?.lastImport||{}
 };
}
function load():AppData{
 try{
  const current=localStorage.getItem(LS);
  if(current) return cleanConfig(JSON.parse(current));
  const old=localStorage.getItem(OLD_LS);
  if(old){
   const migrated=cleanConfig(JSON.parse(old));
   localStorage.setItem(LS,JSON.stringify(migrated));
   return migrated;
  }
  return defaultData;
 }catch{return defaultData}
}
function save(d:AppData){localStorage.setItem(LS,JSON.stringify(cleanConfig(d)))}

function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(PRODUCT_STORE)){
    const store=db.createObjectStore(PRODUCT_STORE,{keyPath:'id'});
    store.createIndex('branchId','branchId',{unique:false});
   }
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
async function countProducts():Promise<ProductStats>{
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(PRODUCT_STORE,'readonly');
  const store=tx.objectStore(PRODUCT_STORE);
  const req=store.openCursor();
  const stats:ProductStats={total:0,withoutImage:0,withLocation:0,incompleteLocation:0};
  req.onsuccess=()=>{
   const cursor=req.result;
   if(cursor){
    const p=cursor.value as Product;
    stats.total++;
    if(!p.imageUrl) stats.withoutImage++;
    if(p.zone&&p.rack) stats.withLocation++;
    if(!p.zone||!p.rack||!p.level||!p.slot) stats.incompleteLocation++;
    cursor.continue();
   }
  };
  tx.oncomplete=()=>{db.close();resolve(stats)};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function clearProductsForBranch(branchId:string){
 const db=await openDb();
 return new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(PRODUCT_STORE,'readwrite');
  const idx=tx.objectStore(PRODUCT_STORE).index('branchId');
  const req=idx.openCursor(IDBKeyRange.only(branchId));
  req.onsuccess=()=>{const cursor=req.result; if(cursor){cursor.delete(); cursor.continue();}};
  tx.oncomplete=()=>{db.close();resolve()};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function putProductsInChunks(products:Product[], onProgress?:(done:number,total:number)=>void){
 const db=await openDb();
 for(let start=0;start<products.length;start+=IMPORT_CHUNK_SIZE){
  const chunk=products.slice(start,start+IMPORT_CHUNK_SIZE);
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(PRODUCT_STORE,'readwrite');
   const store=tx.objectStore(PRODUCT_STORE);
   chunk.forEach(p=>store.put(p));
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
  onProgress?.(Math.min(start+chunk.length,products.length),products.length);
  await sleep();
 }
 db.close();
}
async function searchProducts(query:string,branchId:string,page:number,pageSize=SEARCH_PAGE_SIZE):Promise<SearchResult>{
 const q=normalizeText(query);
 const offset=(page-1)*pageSize;
 const items:Product[]=[];
 let total=0;
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(PRODUCT_STORE,'readonly');
  const store=tx.objectStore(PRODUCT_STORE);
  const source=branchId==='all'?store:store.index('branchId');
  const req=branchId==='all'?source.openCursor():source.openCursor(IDBKeyRange.only(branchId));
  req.onsuccess=()=>{
   const cursor=req.result;
   if(cursor){
    const p=cursor.value as Product;
    const match=!q || p.searchText.includes(q);
    if(match){
     if(total>=offset && items.length<pageSize) items.push(p);
     total++;
    }
    cursor.continue();
   }
  };
  tx.oncomplete=()=>{db.close();resolve({items,total,page,pageSize})};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function getProductById(id:string):Promise<Product|null>{
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(PRODUCT_STORE,'readonly');
  const req=tx.objectStore(PRODUCT_STORE).get(id);
  req.onsuccess=()=>resolve(req.result||null);
  tx.oncomplete=()=>db.close();
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
function csvParse(text:string){
 const rows:string[][]=[]; let row:string[]=[]; let cur=''; let q=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1]; if(c==='"'&&q&&n==='"'){cur+='"';i++} else if(c==='"'){q=!q} else if(c===','&&!q){row.push(cur);cur=''} else if((c==='\n'||c==='\r')&&!q){if(cur||row.length){row.push(cur);rows.push(row);row=[];cur=''} if(c==='\r'&&n==='\n')i++} else cur+=c}
 if(cur||row.length){row.push(cur);rows.push(row)} return rows;
}
function toCsvUrl(url:string,sheetName?:string){
 if(url.includes('gviz/tq')) return url;
 const m=url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); if(!m) return url;
 const base=`https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv`;
 return sheetName?`${base}&sheet=${encodeURIComponent(sheetName)}`:base;
}
async function readCsv(url:string,sheetName?:string){
 const csvUrl=toCsvUrl(url,sheetName);
 const res=await fetch(csvUrl,{cache:'no-store'});
 if(!res.ok) throw new Error(`No se pudo leer el Sheet (${res.status}). Verifica que esté publicado/compartido y que el nombre de hoja sea correcto.`);
 const text=await res.text();
 const rows=csvParse(text);
 if(!rows.length) throw new Error('El Sheet respondió vacío. Revisa la URL o el nombre exacto de la hoja.');
 return rows;
}
function buildSearchText(p:Omit<Product,'searchText'>){return normalizeText([p.name,p.sku,p.barcode,p.brand,p.category,p.gender,p.status,p.model,p.thickness,p.size,p.color,p.line,p.variant,p.zone,p.rack,p.level,p.slot,p.location,p.secondaryZone,p.secondaryRack,p.secondaryLevel,p.secondarySlot,p.warehouse,p.stock,p.price,p.restock,...Object.values(p.raw||{})].join(' '))}
function rawWithIndexedHeaders(headers:string[], row:string[]){
 const raw:Record<string,string>={};
 headers.forEach((h,idx)=>{
  const key=cleanCell(h)||`Columna ${idx+1}`;
  const value=cleanCell(row[idx]);
  raw[`C${idx+1} ${key}`]=value;
  if(raw[key]===undefined) raw[key]=value;
  else raw[`${key} (${idx+1})`]=value;
 });
 return raw;
}
function getMappedValue(row:string[], headers:string[], raw:Record<string,string>, mapping:Mapping, field:string){
 const mapValue=mapping[field] || POR_DEFECTO_SHEET_ORDER[field] || '';
 if(mapValue.startsWith('__idx:')){
  const idx=Number(mapValue.replace('__idx:',''));
  return cleanCell(row[idx]);
 }
 return cleanCell(raw[mapValue]);
}
function headerOptions(headers:string[]){return headers.map((h,idx)=>({label:`${idx+1}. ${cleanCell(h) || 'Sin título'}`,value:`__idx:${idx}`}))}

class ErrorBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean,msg:string}>{
 constructor(props:{children:React.ReactNode}){super(props);this.state={hasError:false,msg:''}}
 static getDerivedStateFromError(error:any){return {hasError:true,msg:error?.message||'Error inesperado'}}
 render(){if(this.state.hasError)return <div className="login"><div className="card login-card"><h2>La app evitó una pantalla blanca</h2><p className="muted">Se detectó un error, pero ya no se ocultará toda la interfaz.</p><p className="notice">{this.state.msg}</p><button className="btn" onClick={()=>location.reload()}>Recargar</button></div></div>; return this.props.children}
}

function App(){
 const [data,setData]=useState<AppData>(load());
 const [user,setUser]=useState<User|null>(()=>{const id=sessionStorage.getItem(SESSION);return load().users.find(u=>u.id===id)||null});
 const update=(fn:(d:AppData)=>AppData)=>setData(prev=>{const next=cleanConfig(fn({...prev,users:[...prev.users],branches:[...prev.branches],zones:[...prev.zones],racks:[...prev.racks],mappings:{...prev.mappings},lastImport:{...prev.lastImport}}));save(next);return next});
 if(!user) return <Login data={data} onLogin={(u)=>{sessionStorage.setItem(SESSION,u.id);setUser(u)}}/>;
 return <Shell data={data} user={user} update={update} logout={()=>{sessionStorage.removeItem(SESSION);setUser(null)}}/>;
}
function Login({data,onLogin}:{data:AppData;onLogin:(u:User)=>void}){const [email,setEmail]=useState('admin@empresa.com'); const [password,setPassword]=useState('admin123'); const [err,setErr]=useState('');
 return <div className="login"><div className="card login-card"><div className="brand" style={{color:'#0f172a'}}><div className="brand-logo">W</div><div><h1>{data.company.systemName}</h1><p>Acceso interno</p></div></div><hr/><div className="notice">Usuario inicial: <b>admin@empresa.com</b> / clave: <b>admin123</b></div><br/><div className="grid"><div className="field"><label>Correo</label><input value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label>Clave</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div>{err&&<p style={{color:'var(--danger)'}}>{err}</p>}<button className="btn" onClick={()=>{const u=data.users.find(x=>x.email===email&&x.password===password); u?onLogin(u):setErr('Credenciales incorrectas')}}>Ingresar</button></div></div></div>
}
function Shell({data,user,update,logout}:{data:AppData;user:User;update:(fn:(d:AppData)=>AppData)=>void;logout:()=>void}){const [tabState,setTabState]=useState(()=>sessionStorage.getItem('wms_visual_active_tab')||'dashboard'); const setTab=(id:string)=>{sessionStorage.setItem('wms_visual_active_tab',id); setTabState(id)}; const tab=tabState; const [open,setOpen]=useState(false); const isAdmin=user.role==='admin'; const menu=[['dashboard','Dashboard',LayoutDashboard],['search','Buscar productos',Search],['branches','Sucursales',Building2],['sheets','Config. Sheets',Database],['plan','Editor de plano',Map],['racks','Editor de estantes',Warehouse],['users','Usuarios',Users],['settings','Ajustes',Settings]] as const;
 return <div className="app"><aside className={`sidebar ${open?'open':''}`}><div className="brand"><div className="brand-logo">W</div><div><h1>{data.company.systemName}</h1><p>{data.company.name}</p></div></div><nav className="nav">{menu.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setOpen(false)}}><Icon size={18}/>{label}</button>)}</nav><div style={{marginTop:'auto'}}><p className="muted" style={{color:'#94a3b8'}}>Sesión: {user.name}<br/>Rol: {user.role}</p><button className="btn secondary" onClick={logout}><LogOut size={16}/> Salir</button></div></aside><main className="main"><header className="topbar"><div className="row"><button className="btn ghost mobile-menu" onClick={()=>setOpen(!open)}><Menu/></button><b>{menu.find(m=>m[0]===tab)?.[1]}</b></div><span className="pill">Modo 10k productos</span></header><section className="content">{tab==='dashboard'&&<Dashboard data={data}/>} {tab==='search'&&<SearchView data={data}/>} {tab==='branches'&&<Branches data={data} update={update} isAdmin={isAdmin}/>} {tab==='sheets'&&<Sheets data={data} update={update} isAdmin={isAdmin}/>} {tab==='plan'&&<Plan data={data} update={update} isAdmin={isAdmin}/>} {tab==='racks'&&<Racks data={data} update={update} isAdmin={isAdmin}/>} {tab==='users'&&<UsersView data={data} update={update} isAdmin={isAdmin}/>} {tab==='settings'&&<SettingsView data={data} update={update} isAdmin={isAdmin}/>}</section></main></div>
}
function Dashboard({data}:{data:AppData}){const [stats,setStats]=useState<ProductStats>({total:0,withoutImage:0,withLocation:0,incompleteLocation:0}); useEffect(()=>{countProducts().then(setStats).catch(()=>{})},[data.lastImport]); return <div className="grid grid-4"><Stat title="Productos" value={stats.total}/><Stat title="Sucursales" value={data.branches.length}/><Stat title="Con ubicación" value={stats.withLocation}/><Stat title="Sin imagen" value={stats.withoutImage}/><div className="card" style={{gridColumn:'1/-1'}}><h2>Versión optimizada para más de 10 mil productos</h2><p className="muted">Los productos ahora se guardan en IndexedDB y no dentro de localStorage. La búsqueda muestra resultados paginados para evitar pantalla blanca.</p></div></div>}
function Stat({title,value}:{title:string;value:number}){return <div className="card"><p className="muted">{title}</p><h2 style={{fontSize:34,margin:0}}>{value.toLocaleString('es-PE')}</h2></div>}
function Branches({data,update,isAdmin}:{data:AppData;update:any;isAdmin:boolean}){const [b,setB]=useState({name:'',code:'',address:''}); return <div className="grid"><div className="card"><h2>Sucursales</h2>{isAdmin&&<div className="grid grid-3"><div className="field"><label>Nombre</label><input value={b.name} onChange={e=>setB({...b,name:e.target.value})}/></div><div className="field"><label>Código</label><input value={b.code} onChange={e=>setB({...b,code:e.target.value})}/></div><div className="field"><label>Dirección</label><input value={b.address} onChange={e=>setB({...b,address:e.target.value})}/></div><button className="btn" onClick={()=>{if(!b.name)return;update((d:AppData)=>({...d,branches:[...d.branches,{id:uid('branch'),...b,active:true}]}));setB({name:'',code:'',address:''})}}><Plus size={16}/> Crear sucursal</button></div>}<Table headers={['Nombre','Código','Dirección','Estado','Acción']} rows={data.branches.map(x=>[x.name,x.code,x.address,x.active?'Activa':'Inactiva',isAdmin?<button className="btn danger" onClick={()=>update((d:AppData)=>({...d,branches:d.branches.filter((z:Branch)=>z.id!==x.id)}))}>Eliminar</button>:'Solo lectura'])}/></div></div>}
function Sheets({data,update,isAdmin}:{data:AppData;update:any;isAdmin:boolean}){const [branchId,setBranchId]=useState(data.branches[0]?.id||''); const branch=data.branches.find(b=>b.id===branchId); const [url,setUrl]=useState(branch?.sheetUrl||''); const [sheet,setSheet]=useState(branch?.sheetName||''); const [headers,setHeaders]=useState<string[]>([]); const [mapping,setMapping]=useState<Mapping>(data.mappings[branchId]||{}); const [msg,setMsg]=useState(''); const [progress,setProgress]=useState(0); const [busy,setBusy]=useState(false);
 function changeBranch(id:string){const b=data.branches.find(x=>x.id===id); setBranchId(id); setUrl(b?.sheetUrl||''); setSheet(b?.sheetName||''); setMapping(data.mappings[id]||{}); setHeaders([]); setProgress(0); setMsg('')}
 async function readHeaders(){setMsg('Leyendo encabezados...'); try{const rows=await readCsv(url,sheet); setHeaders(rows[0]||[]); setMsg(`Listo: ${rows[0]?.length||0} encabezados detectados.`)}catch(e:any){setMsg(e.message)}}
 async function importProducts(){
  if(!branchId)return;
  if(!url.trim()){setMsg('Pega primero la URL del Google Sheet.'); return;}
  setBusy(true); setProgress(0); setMsg('Descargando Sheet completo...');
  let imported=0; let skippedWithoutName=0; let totalRows=0;
  try{
   const rows=await readCsv(url,sheet);
   const head=(rows[0]||[]).map(cleanCell);
   const body=rows.slice(1).filter(r=>r.some(cell=>cleanCell(cell)));
   totalRows=body.length;
   if(!body.length) throw new Error('No se encontraron productos para importar.');
   setHeaders(head);
   setMsg(`Sheet leído: ${totalRows.toLocaleString('es-PE')} filas. Limpiando productos anteriores de esta sucursal...`);
   await clearProductsForBranch(branchId);
   const effectiveMapping={...POR_DEFECTO_SHEET_ORDER,...mapping};
   let buffer:Product[]=[];
   for(let i=0;i<body.length;i++){
    const r=body[i];
    const raw=rawWithIndexedHeaders(head,r);
    const get=(f:string)=>getMappedValue(r,head,raw,effectiveMapping,f);
    const productName=get('name');
    if(!productName){skippedWithoutName++;}
    else{
     const primaryZone=get('zone'), primaryRack=get('rack'), primaryLevel=get('level'), primarySlot=get('slot');
     const secondaryZone=get('secondaryZone'), secondaryRack=get('secondaryRack'), secondaryLevel=get('secondaryLevel'), secondarySlot=get('secondarySlot');
     const safeKey=normalizeText(`${get('sku')||get('barcode')||productName}_${i}`).replace(/[^a-z0-9_-]+/g,'_');
     const base={id:`${branchId}_${safeKey}`,branchId,sku:get('sku'),barcode:get('barcode'),name:productName,brand:get('brand'),category:get('category'),imageUrl:get('imageUrl'),stock:get('stock')||get('restock'),zone:primaryZone||secondaryZone,rack:primaryRack||secondaryRack,level:primaryLevel||secondaryLevel,slot:primarySlot||secondarySlot,location:get('location'),warehouse:get('warehouse'),price:get('price'),variant:get('variant'),gender:get('gender'),status:get('status'),model:get('model'),thickness:get('thickness'),size:get('size'),color:get('color'),line:get('line'),restock:get('restock'),secondaryZone,secondaryRack,secondaryLevel,secondarySlot,raw};
     buffer.push({...base,searchText:buildSearchText(base)});
    }
    if(buffer.length>=IMPORT_CHUNK_SIZE){
     await putProductsInChunks(buffer,(done,total)=>{});
     imported+=buffer.length;
     buffer=[];
     setProgress(Math.round(((i+1)/totalRows)*100));
     setMsg(`Importando... ${imported.toLocaleString('es-PE')} productos guardados de ${totalRows.toLocaleString('es-PE')} filas.`);
     await sleep();
    }
    if(i%500===0){setProgress(Math.round(((i+1)/totalRows)*100)); await sleep();}
   }
   if(buffer.length){
    await putProductsInChunks(buffer);
    imported+=buffer.length;
    buffer=[];
   }
   if(!imported) throw new Error('No se importó ningún producto porque todas las filas estaban sin nombre. Revisa la columna Nombre.');
   setProgress(100);
   update((d:AppData)=>({...d,branches:d.branches.map((b:Branch)=>b.id===branchId?{...b,sheetUrl:url,sheetName:sheet}:b),mappings:{...d.mappings,[branchId]:mapping},lastImport:{...d.lastImport,[branchId]:{count:imported,date:new Date().toISOString()}}}));
   const skippedMsg=skippedWithoutName?` Se omitieron ${skippedWithoutName.toLocaleString('es-PE')} filas sin nombre.`:'';
   setMsg(`Importación completa: ${imported.toLocaleString('es-PE')} productos guardados de ${totalRows.toLocaleString('es-PE')} filas.${skippedMsg}`);
  }catch(e:any){setMsg(e.message||'Error importando productos.');}
  finally{setBusy(false)}
 }

 if(!data.branches.length)return <div className="empty">Primero crea una sucursal.</div>;
 return <div className="grid"><div className="card"><h2>Vinculación Google Sheets</h2><p className="muted">Optimizado para hojas grandes: importa todos los productos por lotes y reconoce tu formato exacto: Genero, Categoria, Estado, marca, cod / modelo, GROSOR, talla, color, Linea, Barras, Sku, Nombre, Variante y doble bloque de ubicación.</p><div className="grid grid-2"><div className="field"><label>Sucursal</label><select value={branchId} onChange={e=>changeBranch(e.target.value)}>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="field"><label>Nombre de hoja</label><input disabled={!isAdmin||busy} value={sheet} onChange={e=>setSheet(e.target.value)} placeholder="Hoja 1"/></div><div className="field" style={{gridColumn:'1/-1'}}><label>URL del Google Sheet</label><input disabled={!isAdmin||busy} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..."/></div></div><br/><div className="row"><button className="btn secondary" disabled={!isAdmin||busy} onClick={readHeaders}><Eye size={16}/> Leer fila 1</button><button className="btn" disabled={!isAdmin||busy} onClick={importProducts}><UploadCloud size={16}/> Importar todos los productos</button></div>{busy&&<div className="progress"><div style={{width:`${progress}%`}}/></div>}{msg&&<p className="notice">{msg}</p>}{data.lastImport?.[branchId]&&<p className="muted">Última importación: {data.lastImport[branchId].count.toLocaleString('es-PE')} productos.</p>}</div>{headers.length>0&&<div className="card"><h2>Mapeo de columnas</h2><div className="grid grid-3">{fields.map(f=><div className="field" key={f}><label>{fieldLabels[f]}</label><select value={mapping[f]||''} onChange={e=>setMapping({...mapping,[f]:e.target.value})}><option value="">No mapear</option>{headerOptions(headers).map(h=><option key={h.value} value={h.value}>{h.label}</option>)}</select></div>)}</div></div>}</div>}
function SearchView({data}:{data:AppData}){const [q,setQ]=useState(''); const [branch,setBranch]=useState('all'); const [page,setPage]=useState(1); const [result,setResult]=useState<SearchResult>({items:[],total:0,page:1,pageSize:SEARCH_PAGE_SIZE}); const [loading,setLoading]=useState(false); const [active,setActive]=useState<Product|null>(null);
 useEffect(()=>{setPage(1)},[q,branch]);
 useEffect(()=>{let alive=true; setLoading(true); const timer=setTimeout(()=>{searchProducts(q,branch,page).then(r=>{if(alive)setResult(r)}).catch(()=>alive&&setResult({items:[],total:0,page,pageSize:SEARCH_PAGE_SIZE})).finally(()=>alive&&setLoading(false))},180); return ()=>{alive=false; clearTimeout(timer)}},[q,branch,page,data.lastImport]);
 const totalPages=Math.max(1,Math.ceil(result.total/result.pageSize));
 return <div className="grid"><div className="card"><h2>Buscar producto</h2><div className="grid grid-3"><div className="field" style={{gridColumn:'span 2'}}><label>Buscar por nombre, SKU, código, zona, estante...</label><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ej: SKU, nombre, zona A, rack 01"/></div><div className="field"><label>Sucursal</label><select value={branch} onChange={e=>setBranch(e.target.value)}><option value="all">Todas</option>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div></div><p className="muted">{loading?'Buscando...':`${result.total.toLocaleString('es-PE')} coincidencias · mostrando ${result.items.length} por página`}</p><div className="row"><button className="btn secondary" disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button><span className="pill">Página {page} de {totalPages}</span><button className="btn secondary" disabled={page>=totalPages||loading} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div></div><div className="grid grid-3">{result.items.map(p=><ProductCard key={p.id} p={p} branch={data.branches.find(b=>b.id===p.branchId)?.name||''} onLocate={()=>setActive(p)}/>)}</div>{!loading&&!result.items.length&&<div className="empty">No hay resultados. Importa productos o cambia la búsqueda.</div>}{active&&<div className="card"><h2>Ubicación resaltada: {active.name}</h2><MiniPlan data={data} product={active}/></div>}</div>}
function ProductCard({p,branch,onLocate}:{p:Product;branch:string;onLocate:()=>void}){return <div className="card product-card"><img loading="lazy" src={p.imageUrl||'https://placehold.co/300x300?text=Sin+imagen'} onError={e=>{(e.currentTarget as HTMLImageElement).src='https://placehold.co/300x300?text=Sin+imagen'}}/><div><h3>{p.name}</h3><p className="muted">SKU: {p.sku||'-'} · Barras: {p.barcode||'-'} · Stock: {p.stock||'-'}</p><p className="muted">{p.brand||'-'} · {p.category||'-'} · {p.color||'-'} · Talla: {p.size||'-'}</p><div className="location-box">{branch}<br/><b>{p.zone||'Sin zona'}</b> · {p.rack||'Sin estante'} · {p.level||'Sin nivel'} · {p.slot||'Sin slot'}<br/>Almacén: {p.warehouse||'-'} · Ubicación: {p.location||'-'}</div><br/><button className="btn secondary" onClick={onLocate}>Ver ubicación</button></div></div>}
function Plan({data,update,isAdmin}:{data:AppData;update:any;isAdmin:boolean}){const [branch,setBranch]=useState(data.branches[0]?.id||''); const [z,setZ]=useState({name:'Zona A',color:'#dbeafe'}); if(!data.branches.length)return <div className="empty">Primero crea una sucursal.</div>; return <div className="grid grid-2"><div className="card"><h2>Editor de plano básico</h2><div className="field"><label>Sucursal</label><select value={branch} onChange={e=>setBranch(e.target.value)}>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><br/>{isAdmin&&<div className="row"><input value={z.name} onChange={e=>setZ({...z,name:e.target.value})}/><input type="color" value={z.color} onChange={e=>setZ({...z,color:e.target.value})}/><button className="btn" onClick={()=>update((d:AppData)=>({...d,zones:[...d.zones,{id:uid('zone'),branchId:branch,name:z.name,x:60+d.zones.length*25,y:70+d.zones.length*20,w:220,h:140,color:z.color}]}))}><Plus size={16}/> Crear zona</button></div>}<p className="muted">V1: zonas movibles visualmente por coordenadas simples. La edición fina se hará en la V2.</p><Table headers={['Zona','Color','Acción']} rows={data.zones.filter(x=>x.branchId===branch).map(x=>[x.name,x.color,isAdmin?<button className="btn danger" onClick={()=>update((d:AppData)=>({...d,zones:d.zones.filter((a:Zone)=>a.id!==x.id)}))}>Eliminar</button>:'Lectura'])}/></div><div className="card"><MiniPlan data={data} branchId={branch}/></div></div>}
function MiniPlan({data,branchId,product}:{data:AppData;branchId?:string;product?:Product}){const bid=branchId||product?.branchId||''; const zones=data.zones.filter(z=>z.branchId===bid); const racks=data.racks.filter(r=>r.branchId===bid); return <div className="canvas-wrap">{zones.map(z=><div key={z.id} className={`zone ${product?.zone&&z.name.toLowerCase()===product.zone.toLowerCase()?'highlight':''}`} style={{left:z.x,top:z.y,width:z.w,height:z.h,background:z.color}}>{z.name}</div>)}{racks.map(r=><div key={r.id} className={`rack ${product?.rack&&r.name.toLowerCase()===product.rack.toLowerCase()?'highlight':''}`} style={{left:r.x,top:r.y,width:r.w,height:r.h,background:r.color}}>{r.name}</div>)}</div>}
function Racks({data,update,isAdmin}:{data:AppData;update:any;isAdmin:boolean}){const [branch,setBranch]=useState(data.branches[0]?.id||''); const [form,setForm]=useState({name:'Rack 01',zoneId:'',levels:4,columns:3,color:'#334155'}); const zones=data.zones.filter(z=>z.branchId===branch); if(!data.branches.length)return <div className="empty">Primero crea una sucursal.</div>; return <div className="grid grid-2"><div className="card"><h2>Crear estante</h2><div className="grid grid-2"><div className="field"><label>Sucursal</label><select value={branch} onChange={e=>setBranch(e.target.value)}>{data.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="field"><label>Zona</label><select value={form.zoneId} onChange={e=>setForm({...form,zoneId:e.target.value})}><option value="">Sin zona</option>{zones.map(z=><option value={z.id} key={z.id}>{z.name}</option>)}</select></div><div className="field"><label>Nombre</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div className="field"><label>Color</label><input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></div><div className="field"><label>Niveles</label><input type="number" value={form.levels} onChange={e=>setForm({...form,levels:+e.target.value})}/></div><div className="field"><label>Columnas</label><input type="number" value={form.columns} onChange={e=>setForm({...form,columns:+e.target.value})}/></div></div><br/><button disabled={!isAdmin} className="btn" onClick={()=>update((d:AppData)=>({...d,racks:[...d.racks,{id:uid('rack'),branchId:branch,zoneId:form.zoneId,name:form.name,type:'simple',levels:form.levels,columns:form.columns,slots:form.levels*form.columns,x:120+d.racks.length*18,y:180+d.racks.length*18,w:120,h:42,color:form.color}]}))}><Save size={16}/> Guardar estante</button></div><div className="card"><h2>Vista previa</h2><RackPreview levels={form.levels} columns={form.columns}/></div><div className="card" style={{gridColumn:'1/-1'}}><Table headers={['Estante','Sucursal','Zona','Niveles','Columnas','Acción']} rows={data.racks.map(r=>[r.name,data.branches.find(b=>b.id===r.branchId)?.name||'',data.zones.find(z=>z.id===r.zoneId)?.name||'-',r.levels,r.columns,isAdmin?<button className="btn danger" onClick={()=>update((d:AppData)=>({...d,racks:d.racks.filter((x:Rack)=>x.id!==r.id)}))}>Eliminar</button>:'Lectura'])}/></div></div>}
function RackPreview({levels,columns}:{levels:number;columns:number}){return <div className="rack-preview">{Array.from({length:levels}).map((_,i)=><div className="rack-level" key={i} style={{gridTemplateColumns:`repeat(${columns},1fr)`}}>{Array.from({length:columns}).map((_,j)=><div className="rack-slot" key={j}>N{levels-i}-S{j+1}</div>)}</div>)}</div>}
function UsersView({data,update,isAdmin}:{data:AppData;update:any;isAdmin:boolean}){const [u,setU]=useState({name:'',email:'',password:'123456',role:'viewer' as Role}); return <div className="card"><h2>Usuarios</h2>{isAdmin&&<div className="grid grid-4"><div className="field"><label>Nombre</label><input value={u.name} onChange={e=>setU({...u,name:e.target.value})}/></div><div className="field"><label>Email</label><input value={u.email} onChange={e=>setU({...u,email:e.target.value})}/></div><div className="field"><label>Clave</label><input value={u.password} onChange={e=>setU({...u,password:e.target.value})}/></div><div className="field"><label>Rol</label><select value={u.role} onChange={e=>setU({...u,role:e.target.value as Role})}><option value="viewer">Visualizador</option><option value="admin">Administrador</option></select></div><button className="btn" onClick={()=>{if(!u.email)return;update((d:AppData)=>({...d,users:[...d.users,{id:uid('user'),...u}]}));setU({name:'',email:'',password:'123456',role:'viewer'})}}>Crear usuario</button></div>}<Table headers={['Nombre','Email','Rol']} rows={data.users.map(u=>[u.name,u.email,u.role])}/></div>}
function SettingsView({data,update,isAdmin}:{data:AppData;update:any;isAdmin:boolean}){const [c,setC]=useState(data.company); return <div className="card"><h2>Configuración de empresa</h2><div className="grid grid-2"><div className="field"><label>Nombre empresa</label><input disabled={!isAdmin} value={c.name} onChange={e=>setC({...c,name:e.target.value})}/></div><div className="field"><label>Nombre sistema</label><input disabled={!isAdmin} value={c.systemName} onChange={e=>setC({...c,systemName:e.target.value})}/></div><div className="field"><label>Color principal</label><input disabled={!isAdmin} type="color" value={c.primaryColor} onChange={e=>setC({...c,primaryColor:e.target.value})}/></div><div className="field"><label>Color secundario</label><input disabled={!isAdmin} type="color" value={c.secondaryColor} onChange={e=>setC({...c,secondaryColor:e.target.value})}/></div></div><br/><button className="btn" disabled={!isAdmin} onClick={()=>update((d:AppData)=>({...d,company:c}))}>Guardar ajustes</button></div>}
function Table({headers,rows}:{headers:string[];rows:any[][]}){return <div style={{overflowX:'auto'}}><table className="table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
