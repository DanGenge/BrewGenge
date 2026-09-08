/* ============================================================
   BREWGENGE APP
   Vanilla JS, no build step. Works standalone off GitHub Pages.
   Supabase cloud sync is optional and degrades gracefully.
   ============================================================ */

const SB_URL = "https://goojuftzuiwoptjtlwfx.supabase.co";
const SB_KEY = "sb_publishable_WdvQhwumdXn5c35OdVZasA_sQWK0dM3";
const STORE = "brewgenge_state_v1";

let sb = null, USER = null, syncStatus = "local", syncTimer = null;

/* ---------- State ---------- */
function defaults(){
  return {
    selectedId: RECIPES[0].id,
    batchSize: 40,
    equipmentId: EQUIPMENT_PROFILES[0].id,
    favourites: [],
    myRecipes: [],
    myEquipment: [],
    overrides: {},
    hidden: [],
    pantry: {},
    sourceWater: Object.assign({}, FLORAVILLE_WATER),
    efficiency: 0.75,
    fermLog: [],
    draftRecipe: null,
    draftEquipment: null
  };
}
let STATE = load();
function load(){
  try{
    const raw = localStorage.getItem(STORE);
    if(!raw) return defaults();
    return merge(defaults(), JSON.parse(raw));
  }catch(e){ console.warn("load failed", e); return defaults(); }
}
function merge(base, over){
  if(Array.isArray(base)) return over !== undefined ? over : base;
  if(base && typeof base === "object"){
    if(!over || typeof over !== "object" || Array.isArray(over)) return over !== undefined ? over : base;
    const out = {};
    for(const k of new Set([...Object.keys(base), ...Object.keys(over)])) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over !== undefined ? over : base;
}
function save(){ localStorage.setItem(STORE, JSON.stringify(STATE)); cloudPush(); }

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => (s==null?"":String(s)).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => (n==null||isNaN(n)) ? "-" : "$"+Number(n).toFixed(2);
const fmt = (n,d=1) => (n==null||isNaN(n)) ? "-" : Number(n).toFixed(d);
const uid = p => p+"-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const fmtDate = iso => { if(!iso) return "-"; try{ return new Date(iso).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}); }catch{return "-";} };

/* ---------- Recipe access ---------- */
function allRecipes(){
  const combined = RECIPES.concat(STATE.myRecipes || []);
  const hidden = STATE.hidden || [];
  const ov = STATE.overrides || {};
  return combined.filter(r=>!hidden.includes(r.id)).map(r=>{
    const o = ov[r.id];
    if(!o) return r;
    return Object.assign({}, r, { name:o.name||r.name, image:o.image!==undefined?o.image:r.image });
  });
}
function isCustom(id){ return (STATE.myRecipes||[]).some(r=>r.id===id); }
function selected(){ return allRecipes().find(r=>r.id===STATE.selectedId) || allRecipes()[0] || RECIPES[0]; }
function recipeThumb(r){
  if(r.image) return `<img src="${r.image}" alt="">`;
  return RECIPE_SVG_ICONS[r.id] || CUSTOM_RECIPE_SVG_ICON;
}
function isFav(id){ return (STATE.favourites||[]).includes(id); }
function toggleFav(id){
  const i = STATE.favourites.indexOf(id);
  if(i>=0) STATE.favourites.splice(i,1); else STATE.favourites.push(id);
  save();
}
function ensureLabel(r){
  let n = (r.name||"").trim();
  const copy = n.match(/\s*\(copy\)$/i);
  if(copy) n = n.slice(0, copy.index).trim();
  if(!/^brewgenge\b/i.test(n)) n = n ? "BrewGenge "+n : "BrewGenge "+(r.style||"Original");
  if(copy) n += " (copy)";
  r.name = n; return r;
}
function saveRecipe(r){
  if(!r.id) r.id = uid("brew");
  ensureLabel(r);
  r.updatedAt = new Date().toISOString();
  if(!r.createdAt) r.createdAt = r.updatedAt;
  const i = (STATE.myRecipes||[]).findIndex(x=>x.id===r.id);
  if(i>=0) STATE.myRecipes[i] = r; else STATE.myRecipes.push(r);
  save(); return r.id;
}
function deleteRecipe(id){
  if(isCustom(id)){ STATE.myRecipes = STATE.myRecipes.filter(r=>r.id!==id); }
  else { if(!STATE.hidden.includes(id)) STATE.hidden.push(id); }
  if(STATE.selectedId===id){ const rem = allRecipes(); STATE.selectedId = rem.length?rem[0].id:RECIPES[0].id; }
  save();
}
function restoreHidden(){ STATE.hidden = []; save(); }
function cloneRecipe(r){ const c = JSON.parse(JSON.stringify(r)); c.id = null; c.custom = true; c.name = r.name+" (copy)"; return c; }
function renameRecipe(id, name){
  name = (name||"").trim(); if(!name) return;
  if(isCustom(id)){ const r = STATE.myRecipes.find(x=>x.id===id); if(r){ r.name=name; r.updatedAt=new Date().toISOString(); } }
  else { STATE.overrides[id] = STATE.overrides[id]||{}; STATE.overrides[id].name = name; }
  save();
}
function setImage(id, url){
  if(isCustom(id)){ const r = STATE.myRecipes.find(x=>x.id===id); if(r){ r.image=url; r.updatedAt=new Date().toISOString(); } }
  else { STATE.overrides[id] = STATE.overrides[id]||{}; STATE.overrides[id].image = url; }
  save();
}
function clearImage(id){
  if(isCustom(id)){ const r = STATE.myRecipes.find(x=>x.id===id); if(r) r.image=null; }
  else { if(STATE.overrides[id]) STATE.overrides[id].image = null; }
  save();
}

/* ---------- Equipment ---------- */
function allEquipment(){ return EQUIPMENT_PROFILES.concat(STATE.myEquipment||[]); }
function currentEquipment(){ return allEquipment().find(e=>e.id===STATE.equipmentId) || EQUIPMENT_PROFILES[0]; }
function isCustomEq(id){ return (STATE.myEquipment||[]).some(e=>e.id===id); }
function saveEquipment(e){
  if(!e.id) e.id = uid("gear");
  const i = (STATE.myEquipment||[]).findIndex(x=>x.id===e.id);
  if(i>=0) STATE.myEquipment[i]=e; else STATE.myEquipment.push(e);
  save(); return e.id;
}
function deleteEquipment(id){
  STATE.myEquipment = (STATE.myEquipment||[]).filter(e=>e.id!==id);
  if(STATE.equipmentId===id) STATE.equipmentId = EQUIPMENT_PROFILES[0].id;
  save();
}

/* ---------- Pantry ---------- */
function pantried(recipeId, name){ return !!(STATE.pantry[recipeId] && STATE.pantry[recipeId][name]); }
function togglePantry(recipeId, name, on){
  STATE.pantry[recipeId] = STATE.pantry[recipeId] || {};
  STATE.pantry[recipeId][name] = on; save();
}

/* ---------- Calculation engine ---------- */
function scaleFactor(r){ return STATE.batchSize / (r.baseBatch || 40); }
function tinseth(t, og){ return 1.65 * Math.pow(0.000125, og-1) * (1-Math.exp(-0.04*t)) / 4.15; }
function calc(r){
  const sf = scaleFactor(r);
  const eq = currentEquipment();
  const ferm = (r.ferm||[]).map(f=>({ name:f[0], kg:f[1]*sf, price:(f[2]!=null?f[2]:FERMENTABLE_PRICE.default), owned:pantried(r.id,f[0]) }));
  const totalGrain = ferm.reduce((s,f)=>s+f.kg,0);
  const preboil = STATE.batchSize + eq.kettleLoss + eq.boilOff;
  const og = r.og || 1.05;
  const hops = (r.hops||[]).map(h=>{
    const g = h[1]*sf;
    const aa = h[2]!=null?h[2]:10;
    const stage = h[3]||"Boil";
    const time = h[4]!=null?h[4]:60;
    const util = stage==="Boil"?1 : stage==="Whirlpool"?0.35 : 0;
    const ibu = stage==="Dry Hop" ? 0 : (g*(aa/100)*1000*tinseth(time,og)*util)/preboil;
    return { name:h[0], g, aa, stage, time, ibu, owned:pantried(r.id,h[0]), price:HOP_PRICE.default };
  });
  const totalHops = hops.reduce((s,h)=>s+h.g,0);
  const ibu = hops.reduce((s,h)=>s+h.ibu,0);
  const fermCostFull = ferm.reduce((s,f)=>s+f.kg*f.price,0);
  const hopCostFull = hops.reduce((s,h)=>s+h.g*h.price,0);
  const fermCost = ferm.reduce((s,f)=>s+(f.owned?0:f.kg*f.price),0);
  const hopCost = hops.reduce((s,h)=>s+(h.owned?0:h.g*h.price),0);
  const yeastCost = r.yeastForm==="Liquid" ? 17 : 6.5;
  const full = fermCostFull + hopCostFull + yeastCost;
  const toBuy = fermCost + hopCost + yeastCost;
  const saving = full - toBuy;
  const strike = totalGrain * eq.mashThickness;
  return { sf, eq, ferm, hops, totalGrain, totalHops, ibu, og, fermCost, hopCost, yeastCost, full, toBuy, saving, preboil, strike,
    grainOK: totalGrain <= eq.maxGrain, boilOK: preboil <= eq.maxKettle };
}

/* ============================================================
   TABS
   ============================================================ */
const TABS = [
  { id:"dashboard", label:"Dashboard", icon:"⌂", group:"BREW" },
  { id:"library", label:"Recipe Library", icon:"★", group:"BREW" },
  { id:"equipment", label:"Equipment", icon:"⚙", group:"BREW" },
  { id:"create", label:"Create a Brew", icon:"✚", group:"BREW" },
  { id:"findbrew", label:"Find a Brew", icon:"🔎", group:"BREW" },
  { id:"fermentables", label:"Fermentables", icon:"🌾", group:"CALCULATE" },
  { id:"hops", label:"Hops", icon:"🌿", group:"CALCULATE" },
  { id:"water", label:"Water", icon:"💧", group:"CALCULATE" },
  { id:"brewday", label:"Brew Day", icon:"🔥", group:"CALCULATE" },
  { id:"fermentation", label:"Fermentation", icon:"🧪", group:"CALCULATE" },
  { id:"cost", label:"Cost", icon:"＄", group:"SHOP" },
  { id:"finding", label:"Find Ingredients", icon:"🛒", group:"SHOP" },
  { id:"supplier", label:"Find a Supplier", icon:"🚚", group:"SHOP" },
  { id:"account", label:"Account & Sync", icon:"☁", group:"SETTINGS" },
  { id:"readme", label:"Read Me", icon:"📖", group:"SETTINGS" }
];
let PAGE = "dashboard";

function buildNav(){
  const groups = [];
  TABS.forEach(t=>{ if(!groups.includes(t.group)) groups.push(t.group); });
  $("#nav").innerHTML = groups.map(g=>`<div class="group">${g}</div>`+
    TABS.filter(t=>t.group===g).map(t=>`<button data-p="${t.id}" class="${t.id===PAGE?'on':''}"><span class="nic">${t.icon}</span>${t.label}</button>`).join("")
  ).join("");
  document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{ PAGE=b.dataset.p; $("aside").classList.remove("open"); render(); });
}
function render(){
  buildNav();
  const tab = TABS.find(t=>t.id===PAGE);
  $("#title").textContent = tab.label;
  ({dashboard:dash,library:library,equipment:equipment,create:create,findbrew:findbrew,
    fermentables:fermentables,hops:hopsTab,water:water,brewday:brewday,fermentation:fermentation,
    cost:cost,finding:finding,supplier:supplier,account:account,readme:readme}[PAGE])();
  updateSyncBadge();
}

/* ---------- Dashboard ---------- */
function dash(){
  const r = selected(); STATE.selectedId = r.id;
  const c = calc(r);
  $("#app").innerHTML = `
    <div class="card hero">
      <div class="thumb big">${recipeThumb(r)}</div>
      <div><h2>${esc(r.name)}</h2><div class="muted">${esc(r.style)} · ${esc(r.desc)}</div></div>
      <div class="heroActions"><button class="btn alt" id="editBrew">🖼 Edit name / image</button></div>
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Recipe</label><select id="recSel">${recipeOptions()}</select></div>
        <div class="field"><label>Batch into fermenter (L)</label><input type="number" step="0.5" id="batch" value="${STATE.batchSize}"></div>
        <div class="field"><label>Equipment</label><select id="eqSel">${equipOptions()}</select></div>
        <div class="field"><label>Scale</label><span class="calc">${fmt(c.sf,2)}x</span></div>
      </div>
    </div>
    <div class="card stats">
      ${stat("Est. OG", fmt(r.og,3))}${stat("Est. FG", fmt(r.fg,3))}${stat("ABV", fmt(r.abv,1)+"%")}
      ${stat("IBU", fmt(c.ibu,0))}${stat("Total grain", fmt(c.totalGrain,2)+" kg")}
    </div>
    <div class="card stats">
      ${stat("Ingredient cost", money(c.full))}${stat("To buy (after pantry)", money(c.toBuy))}
      ${stat("Pantry saving", money(c.saving))}${stat("Total hops", fmt(c.totalHops,0)+" g")}
      ${stat("Cost / litre", money(c.toBuy/STATE.batchSize))}
    </div>
    <h2 class="sec">${esc(c.eq.name)} capacity check</h2>
    <div class="card">
      <p>Grain fits mash tun (max ${c.eq.maxGrain} kg)? <span class="${c.grainOK?'badge-ok':'badge-warn'}">${c.grainOK?'OK':'TOO MUCH GRAIN'}</span></p>
      <p>Pre-boil fits kettle (max ${c.eq.maxKettle} L)? <span class="${c.boilOK?'badge-ok':'badge-warn'}">${c.boilOK?'OK':'TOO MUCH LIQUID'}</span></p>
    </div>`;
  $("#editBrew").onclick = ()=> editModal(r);
  $("#recSel").onchange = e=>{ STATE.selectedId=e.target.value; save(); render(); };
  $("#batch").onchange = e=>{ STATE.batchSize=parseFloat(e.target.value)||40; save(); render(); };
  $("#eqSel").onchange = e=>{ STATE.equipmentId=e.target.value; save(); render(); };
}
function stat(l,v){ return `<div class="stat"><small>${l}</small><b>${v}</b></div>`; }
function recipeOptions(){
  const lib = allRecipes().filter(r=>!isCustom(r.id));
  const mine = allRecipes().filter(r=>isCustom(r.id));
  let h = `<optgroup label="Recipe Library">`+lib.map(r=>`<option value="${r.id}" ${r.id===STATE.selectedId?'selected':''}>${esc(r.name)}</option>`).join("")+`</optgroup>`;
  if(mine.length) h += `<optgroup label="My Recipes">`+mine.map(r=>`<option value="${r.id}" ${r.id===STATE.selectedId?'selected':''}>${esc(r.name)}</option>`).join("")+`</optgroup>`;
  return h;
}
function equipOptions(){
  return allEquipment().map(e=>`<option value="${e.id}" ${e.id===STATE.equipmentId?'selected':''}>${esc(e.name)}</option>`).join("");
}

/* ---------- Recipe Library ---------- */
function library(){
  let favFirst = true, styleF = "all", srcF = "all";
  $("#app").innerHTML = `
    <div class="card">
      <div class="toolbar" style="margin-bottom:12px;">
        <input type="search" id="q" placeholder="Search by name, style or hop...">
        <select id="styleF"><option value="all">All styles</option>${[...new Set(allRecipes().map(r=>r.style))].sort().map(s=>`<option>${esc(s)}</option>`).join("")}</select>
        <select id="srcF"><option value="all">All sources</option><option value="lib">Library</option><option value="mine">My Recipes</option></select>
        <label class="toggle"><input type="checkbox" id="ff" checked> Favourites first</label>
      </div>
      <div class="toolbar" style="justify-content:space-between;">
        <span class="muted" id="count"></span>
        <div class="toolbar">
          <button class="btn" id="new">+ New Brew</button>
          <button class="btn alt" id="pack">📦 Export Recipe Pack</button>
          <button class="btn alt" id="imp">Import JSON</button>
          <input type="file" id="file" accept=".json" hidden>
        </div>
      </div>
      <div id="hiddenBar" class="muted" style="margin-top:8px;"></div>
    </div>
    <div class="card lib-wrap">
      <table class="lib-table"><thead><tr><th class="col-star"></th><th class="col-thumb"></th><th>Recipe</th><th>Style</th><th>ABV</th><th>IBU</th><th>Batch</th><th>Source</th><th>Updated</th><th class="col-actions">Actions</th></tr></thead><tbody id="rows"></tbody></table>
    </div>`;
  const rows = ()=>{
    const q = ($("#q").value||"").toLowerCase();
    let list = allRecipes().map(r=>({r, custom:isCustom(r.id)}));
    if(styleF!=="all") list = list.filter(x=>x.r.style===styleF);
    if(srcF==="lib") list = list.filter(x=>!x.custom);
    if(srcF==="mine") list = list.filter(x=>x.custom);
    if(q) list = list.filter(x=>(x.r.name+" "+x.r.style+" "+(x.r.hops||[]).map(h=>h[0]).join(" ")).toLowerCase().includes(q));
    if(favFirst) list.sort((a,b)=>(isFav(b.r.id)?1:0)-(isFav(a.r.id)?1:0));
    $("#count").textContent = `${list.length} recipe${list.length===1?'':'s'}`;
    $("#rows").innerHTML = list.map(({r,custom})=>`
      <tr class="row-lib ${r.id===STATE.selectedId?'sel':''}" data-sel="${r.id}">
        <td class="col-star"><button class="star ${isFav(r.id)?'on':''}" data-fav="${r.id}">${isFav(r.id)?'★':'☆'}</button></td>
        <td class="col-thumb"><div class="thumb">${recipeThumb(r)}</div></td>
        <td><div class="name">${esc(r.name)}</div><div class="sub">${esc((r.desc||"").split(".")[0])}</div></td>
        <td><span class="pill">${esc(r.style)||'-'}</span></td>
        <td>${fmt(r.abv,1)}%</td><td>${fmt(r.ibu,0)}</td><td>${fmt(r.baseBatch,0)} L</td>
        <td class="muted">${custom?'BrewGenge':'Library'}</td>
        <td class="muted">${custom?fmtDate(r.updatedAt):'-'}</td>
        <td class="col-actions"><div class="actions">
          <button class="iconbtn" data-brew="${r.id}" title="Brew this">🍺</button>
          <button class="iconbtn" data-edit="${r.id}" title="Rename / image">🖼</button>
          <button class="iconbtn" data-dupe="${r.id}" title="Duplicate">⧉</button>
          <button class="iconbtn" data-exp="${r.id}" title="Export this recipe">⬇</button>
          <button class="iconbtn danger" data-del="${r.id}" title="${custom?'Delete':'Hide'}">🗑</button>
        </div></td>
      </tr>`).join("") || `<tr><td colspan="10" style="text-align:center;padding:28px;" class="muted">No recipes match.</td></tr>`;
    bind();
  };
  const bind = ()=>{
    document.querySelectorAll("[data-fav]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFav(b.dataset.fav);rows();});
    document.querySelectorAll("[data-sel]").forEach(tr=>tr.onclick=()=>{STATE.selectedId=tr.dataset.sel;save();rows();});
    document.querySelectorAll("[data-brew]").forEach(b=>b.onclick=e=>{e.stopPropagation();STATE.selectedId=b.dataset.brew;save();PAGE="dashboard";render();});
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=e=>{e.stopPropagation();editModal(allRecipes().find(r=>r.id===b.dataset.edit),rows);});
    document.querySelectorAll("[data-dupe]").forEach(b=>b.onclick=e=>{e.stopPropagation();const c=cloneRecipe(allRecipes().find(r=>r.id===b.dataset.dupe));STATE.selectedId=saveRecipe(c);rows();});
    document.querySelectorAll("[data-exp]").forEach(b=>b.onclick=e=>{e.stopPropagation();exportSingle(allRecipes().find(r=>r.id===b.dataset.exp));});
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.del;const cu=isCustom(id);
      if(confirm(cu?"Delete this BrewGenge recipe permanently?":"Hide this library recipe from your list? You can restore it any time.")){deleteRecipe(id);rows();hiddenBar();}});
  };
  const hiddenBar = ()=>{
    const n=(STATE.hidden||[]).length;
    $("#hiddenBar").innerHTML = n?`${n} library recipe${n===1?'':'s'} hidden. <a href="#" id="restore">Restore all</a>`:"";
    if($("#restore")) $("#restore").onclick=e=>{e.preventDefault();restoreHidden();rows();hiddenBar();};
  };
  rows(); hiddenBar();
  $("#q").oninput=rows;
  $("#styleF").onchange=e=>{styleF=e.target.value;rows();};
  $("#srcF").onchange=e=>{srcF=e.target.value;rows();};
  $("#ff").onchange=e=>{favFirst=e.target.checked;rows();};
  $("#new").onclick=()=>{STATE.draftRecipe=blankRecipe();save();PAGE="create";render();};
  $("#pack").onclick=packModal;
  $("#imp").onclick=()=>$("#file").click();
  $("#file").onchange=importJSON;
}

/* ---------- Equipment ---------- */
function equipment(){
  $("#app").innerHTML = `<div class="card"><div class="toolbar" style="justify-content:space-between;"><h3 style="margin:0;">Equipment Profiles</h3><button class="btn" id="add">+ Add my gear</button></div></div><div id="gear"></div>`;
  const draw = ()=>{
    $("#gear").innerHTML = allEquipment().map(e=>{
      const cu = isCustomEq(e.id);
      return `<div class="card">
        <div class="toolbar" style="justify-content:space-between;align-items:center;">
          <div><b style="font:700 16px Georgia,serif;">${esc(e.name)}</b> <span class="muted"> ${esc(e.type||"")}</span> ${cu?'<span class="badge-ok">My gear</span>':''}</div>
          <div class="toolbar">
            <button class="btn ${e.id===STATE.equipmentId?'':'alt'}" data-use="${e.id}">${e.id===STATE.equipmentId?'Selected':'Use this gear'}</button>
            ${cu?`<button class="btn alt" data-edit="${e.id}">Edit</button><button class="btn danger" data-del="${e.id}">Delete</button>`:''}
          </div>
        </div>
        <div class="stats" style="margin-top:10px;">
          ${stat("Max grain", e.maxGrain+" kg")}${stat("Max kettle", e.maxKettle+" L")}${stat("Boil-off", e.boilOff+" L/hr")}${stat("Kettle loss", e.kettleLoss+" L")}${stat("Mash thick", e.mashThickness+" L/kg")}
        </div>
        <p class="muted" style="margin-top:8px;">${esc(e.notes||"")}</p>
      </div>`;
    }).join("");
    document.querySelectorAll("[data-use]").forEach(b=>b.onclick=()=>{STATE.equipmentId=b.dataset.use;save();draw();});
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>gearForm(allEquipment().find(e=>e.id===b.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{if(confirm("Delete this equipment profile?")){deleteEquipment(b.dataset.del);draw();}});
  };
  const gearForm = (e)=>{
    const d = e || { name:"", type:"", maxGrain:10, maxKettle:40, boilOff:4, kettleLoss:3, mashThickness:2.9, notes:"" };
    const m = document.createElement("div"); m.className="modal";
    m.innerHTML = `<div class="modalbox"><h3>${e?'Edit gear':'Add my gear'}</h3>
      <div class="fields">
        <div class="field"><label>Name</label><input id="gn" value="${esc(d.name)}"></div>
        <div class="field"><label>Type</label><input id="gt" value="${esc(d.type)}"></div>
        <div class="field"><label>Max grain kg</label><input id="gg" type="number" value="${d.maxGrain}"></div>
        <div class="field"><label>Max kettle L</label><input id="gk" type="number" value="${d.maxKettle}"></div>
        <div class="field"><label>Boil-off L/hr</label><input id="gb" type="number" step="0.5" value="${d.boilOff}"></div>
        <div class="field"><label>Kettle loss L</label><input id="gl" type="number" step="0.5" value="${d.kettleLoss}"></div>
        <div class="field"><label>Mash thick L/kg</label><input id="gm" type="number" step="0.1" value="${d.mashThickness}"></div>
      </div><br>
      <div class="field"><label>Notes</label><input id="go" value="${esc(d.notes)}"></div><br>
      <div class="toolbar" style="justify-content:flex-end;"><button class="btn alt" id="cancel">Cancel</button><button class="btn" id="ok">Save gear</button></div></div>`;
    document.body.append(m);
    m.querySelector("#cancel").onclick=()=>m.remove();
    m.querySelector("#ok").onclick=()=>{
      const g = Object.assign({}, d, {
        name:m.querySelector("#gn").value.trim(), type:m.querySelector("#gt").value.trim(),
        maxGrain:+m.querySelector("#gg").value, maxKettle:+m.querySelector("#gk").value,
        boilOff:+m.querySelector("#gb").value, kettleLoss:+m.querySelector("#gl").value,
        mashThickness:+m.querySelector("#gm").value, notes:m.querySelector("#go").value
      });
      if(!g.name){ alert("Name your gear first."); return; }
      STATE.equipmentId = saveEquipment(g); m.remove(); draw();
    };
    m.onclick=ev=>{ if(ev.target===m) m.remove(); };
  };
  $("#add").onclick=()=>gearForm(null);
  draw();
}

/* ---------- Create a Brew ---------- */
function blankRecipe(){
  return { id:null, name:"", style:"", baseBatch:STATE.batchSize||40, og:1.050, fg:1.010, abv:5.0, ibu:30,
    yeast:"US-05", yeastForm:"Dry", atten:0.78, tempLo:18, tempHi:20, desc:"", custom:true, image:null,
    ferm:[["Pale Ale Malt",8.0,4.85]], hops:[["Cascade",20,7.5,"Boil",60]], water:Object.assign({},FLORAVILLE_WATER) };
}
function create(){
  if(!STATE.draftRecipe) STATE.draftRecipe = blankRecipe();
  const d = STATE.draftRecipe;
  $("#app").innerHTML = `
    <div class="card">
      <h3>Create a BrewGenge Original</h3>
      <p class="desc">Fill in your grain and hops at the base batch size, the app scales from there. It saves to My Recipes and auto-labels as BrewGenge.</p>
      <div class="fields">
        <div class="field"><label>Name</label><input id="dn" value="${esc(d.name)}" placeholder="Newy Lager"></div>
        <div class="field"><label>Style</label><input id="ds" value="${esc(d.style)}" placeholder="Australian Lager"></div>
        <div class="field"><label>Base batch L</label><input id="db" type="number" value="${d.baseBatch}"></div>
        <div class="field"><label>OG</label><input id="dog" type="number" step="0.001" value="${d.og}"></div>
        <div class="field"><label>FG</label><input id="dfg" type="number" step="0.001" value="${d.fg}"></div>
        <div class="field"><label>ABV %</label><input id="dabv" type="number" step="0.1" value="${d.abv}"></div>
        <div class="field"><label>IBU</label><input id="dibu" type="number" value="${d.ibu}"></div>
        <div class="field"><label>Yeast</label><input id="dy" value="${esc(d.yeast)}"></div>
        <div class="field"><label>Yeast form</label><select id="dyf"><option ${d.yeastForm==="Dry"?"selected":""}>Dry</option><option ${d.yeastForm==="Liquid"?"selected":""}>Liquid</option></select></div>
      </div>
      <br><div class="field"><label>Description</label><input id="dd" value="${esc(d.desc)}"></div>
      <br><div class="toolbar"><div class="preview" style="width:80px;height:80px;margin:0;">${recipeThumb(d)}</div>
        <button class="btn alt" id="up">Upload image</button><input type="file" id="imf" accept="image/*" hidden>
        ${d.image?'<button class="btn danger" id="rm">Remove image</button>':''}</div>
    </div>
    <h2 class="sec">Fermentables (base batch)</h2>
    <div class="card"><table id="ft"><thead><tr><th>Ingredient</th><th>kg</th><th>$/kg</th><th></th></tr></thead><tbody>
      ${d.ferm.map((f,i)=>`<tr><td><input data-f="${i}" data-c="0" value="${esc(f[0])}"></td><td><input data-f="${i}" data-c="1" type="number" step="0.05" value="${f[1]}" style="width:80px"></td><td><input data-f="${i}" data-c="2" type="number" step="0.05" value="${f[2]}" style="width:80px"></td><td><button class="iconbtn danger" data-fd="${i}">🗑</button></td></tr>`).join("")}
    </tbody></table><br><button class="btn alt" id="af">+ Add fermentable</button></div>
    <h2 class="sec">Hops (base batch)</h2>
    <div class="card"><table id="ht"><thead><tr><th>Hop</th><th>g</th><th>AA%</th><th>Stage</th><th>Min</th><th></th></tr></thead><tbody>
      ${d.hops.map((h,i)=>`<tr>
        <td><input data-h="${i}" data-c="0" value="${esc(h[0])}"></td>
        <td><input data-h="${i}" data-c="1" type="number" value="${h[1]}" style="width:70px"></td>
        <td><input data-h="${i}" data-c="2" type="number" step="0.1" value="${h[2]}" style="width:70px"></td>
        <td><select data-h="${i}" data-c="3"><option ${h[3]==="Boil"?"selected":""}>Boil</option><option ${h[3]==="Whirlpool"?"selected":""}>Whirlpool</option><option ${h[3]==="Dry Hop"?"selected":""}>Dry Hop</option></select></td>
        <td><input data-h="${i}" data-c="4" type="number" value="${h[4]}" style="width:60px"></td>
        <td><button class="iconbtn danger" data-hd="${i}">🗑</button></td></tr>`).join("")}
    </tbody></table><br><button class="btn alt" id="ah">+ Add hop</button></div>
    <div class="card"><button class="btn" id="saveR">Save to My Recipes</button> <button class="btn alt" id="clearR">Clear form</button></div>`;
  const sync = ()=>{ d.name=$("#dn").value; d.style=$("#ds").value; d.baseBatch=+$("#db").value||40; d.og=+$("#dog").value; d.fg=+$("#dfg").value; d.abv=+$("#dabv").value; d.ibu=+$("#dibu").value; d.yeast=$("#dy").value; d.yeastForm=$("#dyf").value; d.desc=$("#dd").value; save(); };
  ["dn","ds","db","dog","dfg","dabv","dibu","dy","dyf","dd"].forEach(id=>$("#"+id).onchange=()=>{sync();});
  document.querySelectorAll("[data-f]").forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.f,c=+inp.dataset.c;d.ferm[i][c]=c===0?inp.value:(+inp.value||0);save();render();});
  document.querySelectorAll("[data-h]").forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.h,c=+inp.dataset.c;d.hops[i][c]=(c===0||c===3)?inp.value:(+inp.value||0);save();render();});
  document.querySelectorAll("[data-fd]").forEach(b=>b.onclick=()=>{d.ferm.splice(+b.dataset.fd,1);save();render();});
  document.querySelectorAll("[data-hd]").forEach(b=>b.onclick=()=>{d.hops.splice(+b.dataset.hd,1);save();render();});
  $("#af").onclick=()=>{sync();d.ferm.push(["New malt",1.0,4.85]);save();render();};
  $("#ah").onclick=()=>{sync();d.hops.push(["New hop",20,10,"Boil",60]);save();render();};
  $("#up").onclick=()=>$("#imf").click();
  $("#imf").onchange=e=>resizeImg(e.target.files[0],url=>{d.image=url;save();render();});
  if($("#rm")) $("#rm").onclick=()=>{d.image=null;save();render();};
  $("#saveR").onclick=()=>{sync();if(!d.name.trim()){alert("Name your brew first.");return;}STATE.selectedId=saveRecipe(JSON.parse(JSON.stringify(d)));STATE.batchSize=d.baseBatch;STATE.draftRecipe=null;save();PAGE="dashboard";render();};
  $("#clearR").onclick=()=>{if(confirm("Clear this draft?")){STATE.draftRecipe=blankRecipe();save();render();}};
}

/* ---------- Find a Brew ---------- */
function findbrew(){
  $("#app").innerHTML = `
    <div class="card"><h3>Find a Brew</h3>
      <p class="desc">A static site can't safely call a live AI search API (that needs a server-side key). Instead, ask an AI assistant in chat for a recipe, paste the JSON it gives you here, and it loads straight into Create a Brew. Or use Quick Generate to adapt a style template. Both the simple BrewGenge format and most "verbose" recipe JSON shapes (fermentables/hops as objects with names like amountKg, amountG, alphaAcidPercent) are understood automatically.</p>
    </div>
    <h2 class="sec">Paste a recipe</h2>
    <div class="card">
      <textarea id="paste" style="width:100%;height:170px;font-family:monospace;" placeholder='Paste a recipe JSON here'></textarea>
      <br><br><button class="btn" id="parse">Parse and load into Create a Brew</button>
      <div id="pres" style="margin-top:10px;"></div>
    </div>
    <h2 class="sec">Quick generate by style</h2>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Style template</label><select id="gStyle">${RECIPES.map(r=>`<option value="${r.id}">${esc(r.style)}</option>`).join("")}</select></div>
        <div class="field"><label>Target ABV %</label><input id="gAbv" type="number" step="0.1" value="5.5"></div>
        <div class="field"><label>Batch L</label><input id="gBatch" type="number" value="${STATE.batchSize}"></div>
      </div>
      <br><button class="btn" id="gen">Generate and load</button>
    </div>`;
  $("#parse").onclick=()=>{
    const t=$("#paste").value.trim(); if(!t){$("#pres").innerHTML=`<span class="warn">Paste something first.</span>`;return;}
    let o; try{ o=JSON.parse(t); }catch(err){ $("#pres").innerHTML=`<span class="warn">That's not valid JSON: ${esc(err.message)}</span>`; return; }
    const list = extractRecipeList(o);
    if(!list || !list.length){ $("#pres").innerHTML=`<span class="warn">Could not find a recipe in that file, check the format.</span>`; return; }
    const d = normalizeRecipe(list[0]);
    if(!d){ $("#pres").innerHTML=`<span class="warn">That recipe doesn't have fermentables or hops I can read, check the format.</span>`; return; }
    STATE.draftRecipe=d; save();
    $("#pres").innerHTML=`<span class="ok">Parsed "${esc(d.name)}", OG ${fmt(d.og,3)}, ${d.ferm.length} fermentable(s), ${d.hops.length} hop(s). Opening Create a Brew...</span>`;
    setTimeout(()=>{ PAGE="create"; render(); }, 500);
  };
  $("#gen").onclick=()=>{
    const t=RECIPES.find(r=>r.id===$("#gStyle").value), tgt=+$("#gAbv").value||5.5, k=tgt/t.abv;
    const d=JSON.parse(JSON.stringify(t)); d.id=null; d.custom=true; d.name="BrewGenge "+t.style; d.baseBatch=+$("#gBatch").value||40;
    d.ferm=d.ferm.map(f=>[f[0],Math.round(f[1]*k*100)/100,f[2]]); d.abv=Math.round(tgt*10)/10;
    d.desc="Generated from the "+t.name+" template at "+tgt+"% ABV.";
    STATE.draftRecipe=d; save(); PAGE="create"; render();
  };
}

/* ---------- Fermentables / Hops ---------- */
function fermentables(){
  const r=selected(), c=calc(r);
  $("#app").innerHTML = `
    <div class="card"><p>Recipe: <span class="calc">${esc(r.name)}</span> Batch: <span class="calc">${fmt(STATE.batchSize,1)} L</span> Scale: <span class="calc">${fmt(c.sf,2)}x</span></p></div>
    <h2 class="sec">Grain bill</h2>
    <div class="card"><table><thead><tr><th>Already have?</th><th>Ingredient</th><th>Base kg</th><th>Scaled kg</th><th>$/kg</th></tr></thead><tbody>
      ${c.ferm.map((f,i)=>`<tr class="${f.owned?'owned':''}"><td><input type="checkbox" data-own="${esc(f.name)}" ${f.owned?'checked':''}></td><td>${esc(f.name)}</td><td>${fmt(r.ferm[i][1],2)}</td><td>${fmt(f.kg,2)}</td><td>${money(f.price)}</td></tr>`).join("")}
      <tr class="total"><td></td><td>Total</td><td></td><td>${fmt(c.totalGrain,2)}</td><td></td></tr>
    </tbody></table><p class="muted" style="margin-top:8px;">Tick anything already in your pantry, it's excluded from the Cost tab but still counts for gravity.</p></div>`;
  bindOwn(r);
}
function hopsTab(){
  const r=selected(), c=calc(r);
  $("#app").innerHTML = `
    <div class="card"><p class="desc">Tinseth bitterness estimate. Whirlpool assumed ~80&deg;C, 20 min.</p></div>
    <h2 class="sec">Hop schedule</h2>
    <div class="card"><table><thead><tr><th>Already have?</th><th>Hop</th><th>Scaled g</th><th>AA%</th><th>Stage</th><th>Min</th><th>IBU</th></tr></thead><tbody>
      ${c.hops.map(h=>`<tr class="${h.owned?'owned':''}"><td><input type="checkbox" data-own="${esc(h.name)}" ${h.owned?'checked':''}></td><td>${esc(h.name)}</td><td>${fmt(h.g,1)}</td><td>${fmt(h.aa,1)}</td><td>${h.stage}</td><td>${h.stage==="Dry Hop"?"-":h.time}</td><td>${fmt(h.ibu,1)}</td></tr>`).join("")}
      <tr class="total"><td></td><td>Total</td><td>${fmt(c.totalHops,1)}</td><td></td><td></td><td></td><td>${fmt(c.ibu,1)}</td></tr>
    </tbody></table></div>
    <div class="card stats">${stat("Total IBU",fmt(c.ibu,1))}${stat("Target IBU",fmt(r.ibu,0))}${stat("Total hops",fmt(c.totalHops,0)+" g")}</div>`;
  bindOwn(r);
}
function bindOwn(r){ document.querySelectorAll("[data-own]").forEach(c=>c.onchange=()=>{togglePantry(r.id,c.dataset.own,c.checked);render();}); }

/* ---------- Water ---------- */
function water(){
  $("#app").innerHTML = `
    <div class="card"><h3>Floraville Water and Salt Guide</h3>
      <p class="desc">Source figures use Hunter Water published values for the Grahamstown / Tomago supply (covers Newcastle including Floraville). Edit if you have a test result.</p>
      <div class="fields">${WATER_IONS.map(i=>`<div class="field"><label>${WATER_LABELS[i]} ppm</label><input type="number" step="0.5" data-w="${i}" value="${STATE.sourceWater[i]}"></div>`).join("")}</div>
    </div>
    <h2 class="sec">Style target for ${esc(selected().name)}</h2>
    <div class="card"><table><thead><tr><th>Ion</th><th>Source</th><th>Style target</th><th>Difference</th></tr></thead><tbody>
      ${WATER_IONS.map(i=>{const t=(selected().water||FLORAVILLE_WATER)[i],s=STATE.sourceWater[i],d=t-s;return `<tr><td>${WATER_LABELS[i]}</td><td>${fmt(s,1)}</td><td>${fmt(t,1)}</td><td style="color:${Math.abs(d)>40?'#b42318':'#19753c'}">${d>0?'+':''}${fmt(d,1)}</td></tr>`;}).join("")}
    </tbody></table><p class="note">Always measure mash pH 10 to 15 min after dough-in and adjust with salts or acid from there. Treat all water for chlorine/chloramine with Campden.</p></div>`;
  document.querySelectorAll("[data-w]").forEach(inp=>inp.onchange=()=>{STATE.sourceWater[inp.dataset.w]=+inp.value||0;save();render();});
}

/* ---------- Brew Day ---------- */
function brewday(){
  const r=selected(), c=calc(r);
  $("#app").innerHTML = `
    <div class="card"><p>Recipe: <span class="calc">${esc(r.name)}</span> Gear: <span class="calc">${esc(c.eq.name)}</span> Batch: <span class="calc">${fmt(STATE.batchSize,1)} L</span></p></div>
    <div class="card stats">
      ${stat("Total grain",fmt(c.totalGrain,2)+" kg")}${stat("Strike water",fmt(c.strike,1)+" L")}${stat("Pre-boil",fmt(c.preboil,1)+" L")}
      ${stat("Grain fit",c.grainOK?'OK':'Too much')}${stat("Kettle fit",c.boilOK?'OK':'Too much')}
    </div>
    <h2 class="sec">Process checklist</h2>
    <div class="card"><ul class="check">
      ${["Treat all brewing water for chlorine / chloramine","Heat strike water and dough in","Mash 60 min at target temperature","Mash out","Sparge to pre-boil volume","Boil and follow the Hops schedule","Whirlpool and stand","Chill to pitch temperature","Aerate and pitch yeast, record OG"].map(s=>`<li><label><input type="checkbox"> ${s}</label></li>`).join("")}
    </ul></div>`;
}

/* ---------- Fermentation ---------- */
function fermentation(){
  const r=selected();
  const dry = calc(r).hops.filter(h=>h.stage==="Dry Hop");
  $("#app").innerHTML = `
    <div class="card"><h3>Yeast and schedule</h3><table>
      ${row("Yeast",esc(r.yeast))}${row("Form",r.yeastForm)}${row("Attenuation",Math.round((r.atten||0.78)*100)+"%")}${row("Pitch temp",(r.tempLo||18)+"°C")}${row("Upper temp",(r.tempHi||20)+"°C")}${row("Expected FG",fmt(r.fg,3))}
    </table></div>
    ${dry.length?`<h2 class="sec">Dry hop plan</h2><div class="card"><table><thead><tr><th>Hop</th><th>Scaled g</th></tr></thead><tbody>${dry.map(h=>`<tr><td>${esc(h.name)}</td><td>${fmt(h.g,1)}</td></tr>`).join("")}</tbody></table></div>`:""}
    <h2 class="sec">Fermentation log</h2>
    <div class="card"><button class="btn" id="addLog">+ Add reading</button>
      <table><thead><tr><th>Day</th><th>Date</th><th>Gravity</th><th>Temp °C</th><th>Notes</th></tr></thead><tbody>
      ${(STATE.fermLog||[]).map((e,i)=>`<tr>
        <td>${e.day}</td>
        <td><input data-l="${i}" data-k="date" value="${esc(e.date)}" style="width:120px"></td>
        <td><input data-l="${i}" data-k="gravity" value="${esc(e.gravity)}" style="width:80px"></td>
        <td><input data-l="${i}" data-k="temp" value="${esc(e.temp)}" style="width:70px"></td>
        <td><input data-l="${i}" data-k="note" value="${esc(e.note)}" style="width:100%"></td></tr>`).join("")}
      </tbody></table></div>`;
  $("#addLog").onclick=()=>{STATE.fermLog.push({day:STATE.fermLog.length,date:new Date().toISOString().slice(0,10),gravity:"",temp:"",note:""});save();render();};
  document.querySelectorAll("[data-l]").forEach(inp=>inp.onchange=()=>{STATE.fermLog[+inp.dataset.l][inp.dataset.k]=inp.value;save();});
}
function row(k,v){ return `<tr><td class="muted">${k}</td><td>${v}</td></tr>`; }

/* ---------- Cost ---------- */
function cost(){
  const r=selected(), c=calc(r);
  $("#app").innerHTML = `
    <div class="card"><p class="desc">Prices are a Brewman-based baseline (AUD). Tick "Already have?" on the Fermentables/Hops tabs to drop items from this total.</p></div>
    <h2 class="sec">Fermentables</h2>
    <div class="card"><table><thead><tr><th>Ingredient</th><th>Scaled kg</th><th>$/kg</th><th>Line cost</th></tr></thead><tbody>
      ${c.ferm.map(f=>`<tr class="${f.owned?'owned':''}"><td>${esc(f.name)} ${f.owned?'<span class="badge-ok">In pantry</span>':''}</td><td>${fmt(f.kg,2)}</td><td>${money(f.price)}</td><td>${f.owned?`<span class="strike">${money(f.kg*f.price)}</span>$0.00`:money(f.kg*f.price)}</td></tr>`).join("")}
      <tr class="total"><td colspan="3">Fermentable subtotal</td><td>${money(c.fermCost)}</td></tr>
    </tbody></table></div>
    <h2 class="sec">Hops</h2>
    <div class="card"><table><thead><tr><th>Hop</th><th>Scaled g</th><th>$/g</th><th>Line cost</th></tr></thead><tbody>
      ${c.hops.map(h=>`<tr class="${h.owned?'owned':''}"><td>${esc(h.name)} ${h.owned?'<span class="badge-ok">In pantry</span>':''}</td><td>${fmt(h.g,1)}</td><td>$${h.price.toFixed(3)}</td><td>${h.owned?`<span class="strike">${money(h.g*h.price)}</span>$0.00`:money(h.g*h.price)}</td></tr>`).join("")}
      <tr class="total"><td colspan="3">Hop subtotal</td><td>${money(c.hopCost)}</td></tr>
    </tbody></table></div>
    ${c.saving>0?`<div class="card ok">You're saving ${money(c.saving)} on this batch using pantry ingredients.</div>`:""}
    <h2 class="sec">Totals</h2>
    <div class="card stats">
      ${stat("Yeast",money(c.yeastCost))}${stat("Total to buy",money(c.toBuy))}${stat("Cost / litre",money(c.toBuy/STATE.batchSize))}
      ${stat("Per 375ml",money(c.toBuy/STATE.batchSize*0.375))}${stat("Per 19L keg",money(c.toBuy/STATE.batchSize*19))}
    </div>`;
}

/* ---------- Find Ingredients ---------- */
function finding(){
  const r=selected(), c=calc(r);
  $("#app").innerHTML = `
    <div class="card"><h3>Ingredients for ${esc(r.name)}</h3><p class="desc">A static snapshot, not a live feed. Confirm current prices at the supplier before ordering.</p>
    <table><thead><tr><th>Ingredient</th><th>Type</th><th>Amount</th><th>Indicative unit price</th></tr></thead><tbody>
      ${c.ferm.map(f=>`<tr><td>${esc(f.name)}</td><td>Fermentable</td><td>${fmt(f.kg,2)} kg</td><td>${money(f.price)}/kg</td></tr>`).join("")}
      ${c.hops.map(h=>`<tr><td>${esc(h.name)}</td><td>Hop</td><td>${fmt(h.g,1)} g</td><td>$${h.price.toFixed(3)}/g</td></tr>`).join("")}
    </tbody></table></div>`;
}

/* ---------- Find a Supplier ---------- */
function supplier(){
  const r=selected(), c=calc(r);
  const rows = SUPPLIERS.map(s=>{
    const ing = c.toBuy * s.factor;
    let del=0, label="";
    if(s.deliveryType==="flat"){ del=s.deliveryCost; label=`Flat $${s.deliveryCost}`; }
    else { del = ing>=s.freeOver?0:s.deliveryCost; label = ing>=s.freeOver?`Free (over $${s.freeOver})`:`$${s.deliveryCost} (free over $${s.freeOver})`; }
    return { s, ing, del, label, landed:ing+del };
  }).sort((a,b)=>a.landed-b.landed);
  $("#app").innerHTML = `
    <div class="card"><p class="desc">No AU homebrew supplier has a public price API, so this estimates a landed cost (ingredients + delivery) using researched delivery terms and a per-supplier price factor. Confirm the actual cart before ordering.</p></div>
    <h2 class="sec">Ranked by landed cost for ${esc(r.name)}</h2>
    <div class="card list"><table><thead><tr><th>#</th><th>Supplier</th><th>Location</th><th>Ingredients</th><th>Delivery</th><th>Landed</th><th>Confirmed</th></tr></thead><tbody>
      ${rows.map((x,i)=>`<tr ${i===0?'style="background:#e9f6ee"':''}><td>${i+1}${i===0?' 🏆':''}</td><td><b>${esc(x.s.name)}</b></td><td class="muted">${esc(x.s.location)}</td><td>${money(x.ing)}</td><td>${x.label}</td><td><b>${money(x.landed)}</b></td><td class="${x.s.confirmed?'badge-y':'badge-n'}">${x.s.confirmed?'Y':'est.'}</td></tr>`).join("")}
    </tbody></table></div>
    <h2 class="sec">Supplier notes</h2>
    <div class="card">${SUPPLIERS.map(s=>`<div style="margin-bottom:12px;border-bottom:1px solid #efeae4;padding-bottom:10px;"><b><a href="${s.url}" target="_blank">${esc(s.name)}</a></b> <span class="muted">${esc(s.location)}</span><p class="muted" style="margin:4px 0;">${esc(s.notes)}</p></div>`).join("")}</div>`;
}

/* ---------- Account & Sync ---------- */
function account(){
  const ready = !!sb;
  $("#app").innerHTML = `
    <div class="card"><h3>Account & Sync</h3>
      <p class="desc">Sign in with your email to back up recipes, gear, pantry and images to the cloud and use BrewGenge across devices. Give a mate a copy and everyone stays separate, each account has its own private data. Skip it and everything still works, saved in this browser.</p>
      <p>Status: <span id="syncStatusBadge" class="${USER?'badge-ok':''}">${USER?'Signed in as '+esc(USER.email):'Not signed in'}</span></p>
    </div>
    ${!ready?`<div class="card"><p class="warn">Supabase library not loaded (offline, or the CDN is blocked). Local mode still works fully.</p></div>`:
      USER?`<div class="card"><div class="toolbar"><button class="btn" id="syncNow">Sync now</button><button class="btn alt" id="out">Sign out</button></div></div>`:
      `<div class="card"><div class="field" style="max-width:320px;"><label>Email</label><input id="email" type="email" placeholder="you@example.com"></div><br><button class="btn" id="signin">Send magic link</button><div id="msg" style="margin-top:10px;"></div></div>`}
    <div class="card"><h3>Sharing recipes with mates</h3>
      <p class="desc">Use <b>Export Recipe Pack</b> in the Recipe Library to export all recipes, favourites, or your BrewGenge originals as one JSON file. Uploaded images are embedded and travel with the recipe. Your mate imports it and it lands in their My Recipes.</p>
    </div>`;
  if(USER){
    $("#syncNow").onclick=()=>cloudPush(true);
    $("#out").onclick=async()=>{ await sb.auth.signOut(); USER=null; syncStatus="local"; render(); };
  } else if(ready){
    $("#signin").onclick=async()=>{
      const email=$("#email").value.trim(); if(!email){$("#msg").innerHTML=`<span class="warn">Enter an email.</span>`;return;}
      $("#msg").innerHTML=`<span class="muted">Sending...</span>`;
      const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo:location.href } });
      $("#msg").innerHTML = error?`<span class="warn">${esc(error.message)}</span>`:`<span class="ok">Check your email for the sign-in link.</span>`;
    };
  }
}

/* ---------- Read Me ---------- */
function readme(){
  $("#app").innerHTML = `
    <div class="card"><h3>How to use BrewGenge</h3><ol>
      <li>Pick a recipe and batch size on the Dashboard, everything scales automatically.</li>
      <li>Choose your gear under Equipment, capacity checks follow it.</li>
      <li>Tick "Already have?" on Fermentables/Hops to drop pantry items from the Cost.</li>
      <li>Brew Day and Fermentation are your live log.</li>
      <li>Rename, delete or add a photo to any brew with the 🖼 and 🗑 icons.</li>
    </ol></div>
    <div class="card"><h3>Sharing recipe packs</h3>
      <p>Recipe Library → Export Recipe Pack. Choose all recipes, favourites, or BrewGenge originals. Uploaded images are embedded as Base64 inside the JSON and import with the recipe. Single recipes can be exported with the ⬇ icon on each row.</p>
      <p>Importing understands both BrewGenge's own format AND common "verbose" recipe JSON (fermentables/hops as named objects, e.g. from an AI chat search). If a file genuinely doesn't contain readable ingredients, you'll get a clear error instead of a blank recipe.</p>
      <div class="note"><b>No additional SQL is required for recipe packs.</b> They work entirely in the browser. A future BrewGenge Community feature (sharing between accounts) would need a new Supabase migration.</div>
    </div>
    <div class="card"><h3>Custom logo and recipe photos</h3>
      <p>The BrewGenge crest and every recipe icon are built-in vector art, so nothing is ever a broken image. To use your own logo: add a file to <code>img/logo.jpeg</code> (or <code>.jpg</code> / <code>.png</code>) in your repo, lowercase filename exactly. GitHub Pages is case-sensitive, so <code>Logo.JPEG</code> will NOT match <code>logo.jpeg</code>.</p>
    </div>
    <div class="card"><h3>Hosting on GitHub Pages</h3><ol>
      <li>Upload <code>index.html</code>, <code>css</code>, <code>js</code>, <code>img</code> and <code>supabase</code> to the repo root.</li>
      <li>Settings → Pages → Deploy from a branch → main → / (root).</li>
      <li>Hard refresh once after deploying if an old cached version shows.</li>
    </ol></div>`;
}

/* ============================================================
   Edit modal (rename + image)
   ============================================================ */
function editModal(r, after){
  const m = document.createElement("div"); m.className="modal";
  m.innerHTML = `<div class="modalbox"><h3>Edit Brew</h3>
    <div class="preview">${recipeThumb(r)}</div>
    <div class="field"><label>Brew name</label><input id="en" value="${esc(r.name)}"></div><br>
    <div class="toolbar"><button class="btn alt" id="up">Upload image</button><input type="file" id="imf" accept="image/*" hidden>${r.image?'<button class="btn danger" id="rm">Remove image</button>':''}</div>
    <p class="muted">Images are resized and stored with your brew (and cloud, if signed in).</p>
    <div class="toolbar" style="justify-content:flex-end;"><button class="btn alt" id="cancel">Cancel</button><button class="btn" id="ok">Save changes</button></div></div>`;
  document.body.append(m);
  let pending=undefined, removeFlag=false;
  m.querySelector("#up").onclick=()=>m.querySelector("#imf").click();
  m.querySelector("#imf").onchange=e=>resizeImg(e.target.files[0],url=>{pending=url;removeFlag=false;m.querySelector(".preview").innerHTML=`<img src="${url}">`;});
  if(m.querySelector("#rm")) m.querySelector("#rm").onclick=()=>{removeFlag=true;pending=undefined;m.querySelector(".preview").innerHTML=RECIPE_SVG_ICONS[r.id]||CUSTOM_RECIPE_SVG_ICON;};
  m.querySelector("#cancel").onclick=()=>m.remove();
  m.querySelector("#ok").onclick=()=>{
    const nn=m.querySelector("#en").value.trim();
    if(nn && nn!==r.name) renameRecipe(r.id,nn);
    if(pending!==undefined) setImage(r.id,pending);
    else if(removeFlag) clearImage(r.id);
    m.remove(); after?after():render();
  };
  m.onclick=e=>{ if(e.target===m) m.remove(); };
}
function resizeImg(file, cb){
  if(!file) return;
  const rd=new FileReader();
  rd.onload=()=>{ const im=new Image(); im.onload=()=>{
    let m=500,w=im.width,h=im.height;
    if(w>h&&w>m){h*=m/w;w=m;} else if(h>m){w*=m/h;h=m;}
    const cv=document.createElement("canvas"); cv.width=w; cv.height=h;
    cv.getContext("2d").drawImage(im,0,0,w,h);
    cb(cv.toDataURL("image/jpeg",0.84));
  }; im.src=rd.result; };
  rd.readAsDataURL(file);
}

/* ============================================================
   Recipe import normalisation
   ============================================================ */
function extractRecipeList(o){
  if(Array.isArray(o)) return o;
  if(o && Array.isArray(o.recipes)) return o.recipes;
  if(o && o.recipe && typeof o.recipe === "object") return [o.recipe];
  if(o && typeof o === "object" && (o.ferm || o.fermentables)) return [o];
  return null;
}
function normalizeRecipe(raw){
  if(!raw || typeof raw !== "object") return null;

  const hasNativeFerm = Array.isArray(raw.ferm) && raw.ferm.length && Array.isArray(raw.ferm[0]);
  const hasNativeHops = Array.isArray(raw.hops) && raw.hops.length && Array.isArray(raw.hops[0]);
  if(hasNativeFerm || hasNativeHops){
    return {
      id:null, custom:true,
      name: raw.name || "Imported Brew",
      style: raw.style || "",
      baseBatch: raw.baseBatch || raw.batchSizeL || 40,
      og: raw.og || 1.05, fg: raw.fg || 1.01, abv: raw.abv || 5, ibu: raw.ibu || 30,
      yeast: raw.yeast || "US-05", yeastForm: raw.yeastForm || "Dry", atten: raw.atten || 0.78,
      tempLo: raw.tempLo || 18, tempHi: raw.tempHi || 20,
      desc: raw.desc || raw.description || "",
      image: raw.image || null,
      ferm: (hasNativeFerm && raw.ferm.length) ? raw.ferm : [["Pale Ale Malt",8,4.85]],
      hops: (hasNativeHops && raw.hops.length) ? raw.hops : [["Cascade",20,7.5,"Boil",60]],
      water: Object.assign({}, FLORAVILLE_WATER)
    };
  }

  const fermSrc = Array.isArray(raw.fermentables) ? raw.fermentables : null;
  const hopSrcObjects = Array.isArray(raw.hops) && raw.hops.length && typeof raw.hops[0] === "object" && !Array.isArray(raw.hops[0]) ? raw.hops : null;
  if(fermSrc || hopSrcObjects){
    const targets = raw.targets || {};
    const ferm = (fermSrc||[]).map(f=>{
      let kg = f.amountKg!=null ? f.amountKg : (f.amountG!=null ? f.amountG/1000 : (f.amount!=null?f.amount:1));
      return [ f.name || "Fermentable", kg, FERMENTABLE_PRICE.default ];
    });
    const hops = (hopSrcObjects||[]).map(h=>{
      const g = h.amountG!=null ? h.amountG : (h.amountKg!=null ? h.amountKg*1000 : (h.amount!=null?h.amount:20));
      const aa = h.alphaAcidPercent!=null ? h.alphaAcidPercent : (h.aa!=null ? h.aa : 10);
      const useStr = (h.use||h.stage||"boil").toString().toLowerCase();
      let stage = "Boil";
      if(/whirlpool|flameout|hopstand/.test(useStr)) stage = "Whirlpool";
      else if(/dry/.test(useStr)) stage = "Dry Hop";
      const time = stage==="Dry Hop" ? 0 : (h.timeMin!=null ? h.timeMin : (h.time!=null ? h.time : 60));
      return [ h.name || "Hop", g, aa, stage, time ];
    });
    let yeastName = "US-05", yeastForm = "Dry", tempLo = 18, tempHi = 20;
    if(Array.isArray(raw.yeast) && raw.yeast.length){
      yeastName = raw.yeast.map(y=>y.name).filter(Boolean).join(" / ") || yeastName;
      const y0 = raw.yeast[0];
      if(y0){
        if(y0.form) yeastForm = /liquid/i.test(y0.form) ? "Liquid" : "Dry";
        if(y0.pitchTempC!=null){ tempLo = y0.pitchTempC; tempHi = y0.pitchTempC+2; }
      }
    } else if(typeof raw.yeast === "string" && raw.yeast.trim()){ yeastName = raw.yeast; }
    if(Array.isArray(raw.fermentationSteps)){
      const primary = raw.fermentationSteps.find(s=>/primary/i.test(s.name||""));
      if(primary && primary.temperatureC!=null){ tempLo = primary.temperatureC; tempHi = primary.temperatureC+2; }
    }
    const og = targets.og!=null?targets.og:(raw.og!=null?raw.og:1.05);
    const fg = targets.fg!=null?targets.fg:(raw.fg!=null?raw.fg:1.01);
    const abv = targets.abvPercent!=null?targets.abvPercent:(targets.abv!=null?targets.abv:(raw.abv!=null?raw.abv:Math.round((og-fg)*131.25*10)/10));
    const ibu = targets.ibu!=null?targets.ibu:(raw.ibu!=null?raw.ibu:30);
    const atten = (og>1 && fg>1 && og>fg) ? Math.round(((og-fg)/(og-1))*1000)/1000 : 0.78;
    if(ferm.length===0 && hops.length===0) return null;
    return {
      id:null, custom:true,
      name: raw.name || "Imported Brew",
      style: raw.style || "",
      baseBatch: raw.batchSizeL || raw.baseBatch || 40,
      og, fg, abv, ibu,
      yeast: yeastName, yeastForm, atten, tempLo, tempHi,
      desc: raw.description || raw.desc || (Array.isArray(raw.brewDayNotes)?raw.brewDayNotes.join(" "):"") || "",
      image: raw.image || null,
      ferm: ferm.length ? ferm : [["Pale Ale Malt",8,4.85]],
      hops: hops.length ? hops : [["Cascade",20,7.5,"Boil",60]],
      water: Object.assign({}, FLORAVILLE_WATER)
    };
  }

  return null;
}

/* ============================================================
   Export / import recipe packs
   ============================================================ */
function downloadJSON(obj, name){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}));
  a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),600);
}
function exportSingle(r){
  downloadJSON({ format:"brewgenge-recipe", version:1, exportedAt:new Date().toISOString(), includesEmbeddedImages:!!r.image, recipe:r },
    (r.name||"recipe").replace(/[^a-z0-9]+/gi,"_")+".json");
}
function packModal(){
  const m=document.createElement("div"); m.className="modal";
  m.innerHTML=`<div class="modalbox"><h3>Export Recipe Pack</h3>
    <p class="muted">Uploaded images are embedded inside the JSON, so artwork and photos travel with the pack.</p>
    <div class="packgrid">
      <label class="choice"><input type="radio" name="sc" value="all" checked><b>All recipes</b>Everything in your library</label>
      <label class="choice"><input type="radio" name="sc" value="fav"><b>Favourites</b>Only starred recipes</label>
      <label class="choice"><input type="radio" name="sc" value="mine"><b>My BrewGenge brews</b>Only your originals</label>
    </div>
    <div class="field"><label>Pack name</label><input id="pn" value="BrewGenge Recipe Pack"></div><br>
    <div class="toolbar" style="justify-content:flex-end;"><button class="btn alt" id="cancel">Cancel</button><button class="btn" id="go">Export Pack</button></div></div>`;
  document.body.append(m);
  m.querySelector("#cancel").onclick=()=>m.remove();
  m.querySelector("#go").onclick=()=>{
    const sc=m.querySelector("input[name=sc]:checked").value;
    let list=allRecipes();
    if(sc==="fav") list=list.filter(r=>isFav(r.id));
    if(sc==="mine") list=list.filter(r=>isCustom(r.id));
    downloadJSON({ format:"brewgenge-recipe-pack", version:1, name:m.querySelector("#pn").value||"BrewGenge Recipe Pack",
      exportedAt:new Date().toISOString(), includesEmbeddedImages:true, count:list.length, recipes:list },
      (m.querySelector("#pn").value||"BrewGenge_Pack").replace(/[^a-z0-9]+/gi,"_")+".json");
    m.remove();
  };
  m.onclick=e=>{ if(e.target===m) m.remove(); };
}
function importJSON(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    let o;
    try{ o=JSON.parse(rd.result); }
    catch(err){ alert("That file isn't valid JSON ("+err.message+")."); e.target.value=""; return; }
    const list = extractRecipeList(o);
    if(!list || !list.length){ alert("Couldn't find any recipes in that file. Expected a BrewGenge pack, a single BrewGenge recipe, or a recipe with fermentables/hops."); e.target.value=""; return; }
    let ok=0, fail=0, anyImage=false;
    list.forEach(raw=>{
      const norm = normalizeRecipe(raw);
      if(!norm){ fail++; return; }
      if(norm.image) anyImage=true;
      saveRecipe(norm);
      ok++;
    });
    if(ok===0){ alert("None of the recipes in that file could be read, no fermentables or hops were found in a recognised format."); }
    else{
      let msg = `Imported ${ok} recipe${ok===1?'':'s'}`;
      if(fail>0) msg += `, ${fail} skipped (unrecognised format)`;
      if(anyImage) msg += ", including embedded images";
      msg += ".";
      alert(msg);
      render();
    }
    e.target.value="";
  };
  rd.readAsText(f);
}

/* ============================================================
   Supabase cloud sync (optional, graceful)
   ============================================================ */
async function initSupabase(){
  try{
    if(typeof window.supabase === "undefined" || SB_URL.includes("YOUR-")) { updateSyncBadge(); return; }
    sb = window.supabase.createClient(SB_URL, SB_KEY);
    const { data } = await sb.auth.getSession();
    USER = data.session ? data.session.user : null;
    if(USER) await cloudPull();
    sb.auth.onAuthStateChange(async (_e, session)=>{
      USER = session ? session.user : null;
      if(USER) await cloudPull();
      updateSyncBadge();
      if(PAGE==="account") render();
    });
  }catch(e){ console.warn("supabase init failed", e); }
  updateSyncBadge();
}
function cloudPush(force){
  if(!sb || !USER) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async ()=>{
    syncStatus="syncing"; updateSyncBadge();
    try{ await sb.from("user_app_state").upsert({ user_id:USER.id, state:STATE }, { onConflict:"user_id" }); syncStatus="synced"; }
    catch(e){ console.warn(e); syncStatus="error"; }
    updateSyncBadge();
  }, force?0:1000);
}
async function cloudPull(){
  if(!sb || !USER) return;
  try{
    const { data, error } = await sb.from("user_app_state").select("state").eq("user_id",USER.id).maybeSingle();
    if(error){ syncStatus="error"; return; }
    if(data && data.state && Object.keys(data.state).length){
      STATE = merge(defaults(), data.state);
      localStorage.setItem(STORE, JSON.stringify(STATE));
    } else {
      await sb.from("user_app_state").upsert({ user_id:USER.id, state:STATE }, { onConflict:"user_id" });
    }
    syncStatus="synced";
    render();
  }catch(e){ console.warn(e); syncStatus="error"; }
}
function updateSyncBadge(){
  const el=$("#sync"); if(!el) return;
  const map={ local:["","Local mode"], syncing:["online","Syncing..."], synced:["online","Synced · "+(USER?USER.email:"")], error:["","Sync error"] };
  const [cls,txt]=USER?(map[syncStatus]||map.synced):map.local;
  el.className=cls; el.textContent=txt;
  const b=$("#syncStatusBadge"); if(b){ b.className=USER?"badge-ok":""; b.textContent=USER?("Signed in as "+USER.email):"Not signed in"; }
}

/* ============================================================
   Logo / crest loading (tries jpeg -> jpg -> png -> drawn SVG fallback)
   ============================================================ */
function setupCrest(){
  const el = document.getElementById("crest");
  if(!el) return;
  const candidates = ["img/logo.jpeg", "img/logo.jpg", "img/logo.png"];
  let i = 0;
  const img = document.createElement("img");
  img.alt = "BrewGenge";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.borderRadius = "50%";
  img.style.objectFit = "cover";
  img.style.display = "block";
  img.onerror = function(){
    i++;
    if(i < candidates.length){ img.src = candidates[i]; }
    else { el.innerHTML = BREWGENGE_LOGO_SVG; }
  };
  el.innerHTML = "";
  el.appendChild(img);
  img.src = candidates[0];
}

/* ============================================================
   Boot
   ============================================================ */
setupCrest();
$("#menu").onclick = ()=> $("aside").classList.toggle("open");
render();
initSupabase();
