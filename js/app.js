/* ============================================================
   BREWGENGE APP
   Vanilla JS, no build step. Works standalone off GitHub Pages.
   Supabase cloud sync is optional and degrades gracefully.

   AUTH DESIGN NOTE: this app deliberately uses a TYPED 6-DIGIT CODE
   (Supabase email OTP + verifyOtp) instead of a clickable magic link.
   Clickable magic links are frequently "clicked" automatically by
   corporate email security scanners (e.g. Microsoft Defender Safe
   Links / URL detonation) before the real user ever opens the email,
   silently burning the single-use token. A typed code sitting as
   plain text in the email body cannot be consumed this way, which
   makes it far more reliable for work/corporate email domains.
   ============================================================ */

const SB_URL = "https://goojuftzuiwoptjtlwfx.supabase.co";
const SB_KEY = "sb_publishable_WdvQhwumdXn5c35OdVZasA_sQWK0dM3";
const STORE = "brewgenge_state_v1";
const OTP_COOLDOWN_KEY = "brewgenge_otp_last_sent";
const OTP_COOLDOWN_SECONDS = 60;
const STAY_SIGNED_IN_KEY = "brewgenge_stay_signed_in";
const OFFLINE_MODE_KEY = "brewgenge_offline_mode";

let sb = null, USER = null, syncStatus = "local", syncTimer = null;
let AUTH_INIT_ERROR = null;
let LAST_SYNC_MESSAGE = "";
let codeStepEmail = null;
let cooldownTimer = null;

/* ---------- State ---------- */
function defaults(){
  return {
    selectedId: RECIPES[0].id, batchSize: 40, equipmentId: EQUIPMENT_PROFILES[0].id,
    favourites: [], myRecipes: [], myEquipment: [], overrides: {}, hidden: [], pantry: {},
    ratings: {}, brewSessions: {}, sourceWater: Object.assign({}, FLORAVILLE_WATER),
    grainTempC: DEFAULT_GRAIN_TEMP_C, spargeTempC: DEFAULT_SPARGE_TEMP_C, efficiency: 0.75,
    fermLog: [], draftRecipe: null, draftEquipment: null, lastActivityAt: null
  };
}
let STATE = load();
repairWaterlessCustomRecipes(STATE);
function load(){
  try{ const raw = localStorage.getItem(STORE); if(!raw) return defaults(); return merge(defaults(), JSON.parse(raw)); }
  catch(e){ console.warn("load failed", e); return defaults(); }
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
function save(){ STATE.lastActivityAt = new Date().toISOString(); localStorage.setItem(STORE, JSON.stringify(STATE)); cloudPush(); }

function waterMatchesFloraville(w){ if(!w) return false; return WATER_IONS.every(ion => Math.abs((w[ion]||0) - (FLORAVILLE_WATER[ion]||0)) < 0.01); }
function repairWaterlessCustomRecipes(state){
  if(!state || !Array.isArray(state.myRecipes)) return;
  let fixed = 0;
  state.myRecipes.forEach(r=>{ if(waterMatchesFloraville(r.water)){ r.water = defaultWaterForStyle(r.style); fixed++; } });
  if(fixed>0){ localStorage.setItem(STORE, JSON.stringify(state)); console.info("BrewGenge: repaired water target on "+fixed+" recipe(s)."); }
}

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => (s==null?"":String(s)).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => (n==null||isNaN(n)) ? "-" : "$"+Number(n).toFixed(2);
const fmt = (n,d=1) => (n==null||isNaN(n)) ? "-" : Number(n).toFixed(d);
const uid = p => p+"-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const fmtDate = iso => { if(!iso) return "-"; try{ return new Date(iso).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}); }catch{return "-";} };
const fmtDateTime = iso => { if(!iso) return "-"; try{ return new Date(iso).toLocaleString("en-AU",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }catch{return "-";} };

/* ---------- Recipe access ---------- */
function allRecipes(){
  const combined = RECIPES.concat(STATE.myRecipes || []);
  const hidden = STATE.hidden || []; const ov = STATE.overrides || {};
  return combined.filter(r=>!hidden.includes(r.id)).map(r=>{
    const o = ov[r.id]; if(!o) return r;
    return Object.assign({}, r, { name:o.name||r.name, image:o.image!==undefined?o.image:r.image });
  });
}
function isCustom(id){ return (STATE.myRecipes||[]).some(r=>r.id===id); }
function selected(){ return allRecipes().find(r=>r.id===STATE.selectedId) || allRecipes()[0] || RECIPES[0]; }
function recipeThumb(r){ if(r.image) return `<img src="${r.image}" alt="">`; return RECIPE_SVG_ICONS[r.id] || CUSTOM_RECIPE_SVG_ICON; }
function isFav(id){ return (STATE.favourites||[]).includes(id); }
function toggleFav(id){ const i = STATE.favourites.indexOf(id); if(i>=0) STATE.favourites.splice(i,1); else STATE.favourites.push(id); save(); }
function getRating(id){ return (STATE.ratings||{})[id] || 0; }
function setRating(id, n){ if(!STATE.ratings) STATE.ratings = {}; STATE.ratings[id] = (STATE.ratings[id] === n) ? 0 : n; save(); }
function ensureLabel(r){
  let n = (r.name||"").trim(); const copy = n.match(/\s*\(copy\)$/i); if(copy) n = n.slice(0, copy.index).trim();
  if(!/^brewgenge\b/i.test(n)) n = n ? "BrewGenge "+n : "BrewGenge "+(r.style||"Original");
  if(copy) n += " (copy)"; r.name = n; return r;
}
function saveRecipe(r){
  if(!r.id) r.id = uid("brew"); ensureLabel(r);
  if(!r.water || typeof r.water !== "object" || WATER_IONS.some(ion => r.water[ion]==null)) r.water = defaultWaterForStyle(r.style);
  r.updatedAt = new Date().toISOString(); if(!r.createdAt) r.createdAt = r.updatedAt;
  const i = (STATE.myRecipes||[]).findIndex(x=>x.id===r.id);
  if(i>=0) STATE.myRecipes[i] = r; else STATE.myRecipes.push(r);
  save(); return r.id;
}
function deleteRecipe(id){
  if(isCustom(id)){ STATE.myRecipes = STATE.myRecipes.filter(r=>r.id!==id); } else { if(!STATE.hidden.includes(id)) STATE.hidden.push(id); }
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
function togglePantry(recipeId, name, on){ STATE.pantry[recipeId] = STATE.pantry[recipeId] || {}; STATE.pantry[recipeId][name] = on; save(); }

/* ---------- Brew sessions ---------- */
function getSessions(id){ return (STATE.brewSessions||{})[id] || []; }
function addSession(id, entry){
  if(!STATE.brewSessions) STATE.brewSessions = {}; if(!STATE.brewSessions[id]) STATE.brewSessions[id] = [];
  entry.id = uid("sess"); entry.date = entry.date || new Date().toISOString();
  STATE.brewSessions[id].push(entry); save();
}
function deleteSession(id, sessId){
  if(STATE.brewSessions && STATE.brewSessions[id]){ STATE.brewSessions[id] = STATE.brewSessions[id].filter(s=>s.id!==sessId); save(); }
}

/* ---------- Style guideline lookup + colour estimate ---------- */
function findStyleGuideline(styleName){ const key = (styleName||"").trim().toLowerCase(); return STYLE_GUIDELINES[key] || null; }
function estimateColorEBC(r){
  const total = (r.ferm||[]).reduce((s,f)=>s+f[1],0) || 1;
  let ebc = 0;
  (r.ferm||[]).forEach(f=>{
    const n = f[0].toLowerCase(); let malColor = 6;
    if(/pilsner/.test(n)) malColor = 4; else if(/vienna/.test(n)) malColor = 8; else if(/munich/.test(n)) malColor = 18;
    else if(/melanoidin/.test(n)) malColor = 60; else if(/crystal|caramel/.test(n)) malColor = 140;
    else if(/carafa|roast/.test(n)) malColor = 900; else if(/chocolate/.test(n)) malColor = 900; else if(/carapils|dextrine/.test(n)) malColor = 4;
    ebc += (f[1]/total) * malColor;
  });
  ebc = Math.max(3, ebc * (total/8)); ebc = Math.min(ebc, 900);
  const hexMap = [[6,"#f6e29a"],[10,"#f0cf6a"],[16,"#e6b13e"],[26,"#d68e2e"],[40,"#b8621e"],[70,"#8a3f18"],[130,"#5a2712"],[300,"#301209"],[900,"#0d0605"]];
  let hex = "#5a2712"; for(const [thresh,h] of hexMap){ if(ebc<=thresh){ hex=h; break; } }
  return { ebc, hex };
}

/* ---------- Calculation engine ---------- */
function scaleFactor(r){ return STATE.batchSize / (r.baseBatch || 40); }
function tinseth(t, og){ return 1.65 * Math.pow(0.000125, og-1) * (1-Math.exp(-0.04*t)) / 4.15; }
function calc(r){
  const sf = scaleFactor(r); const eq = currentEquipment();
  const ferm = (r.ferm||[]).map(f=>({ name:f[0], kg:f[1]*sf, price:(f[2]!=null?f[2]:FERMENTABLE_PRICE.default), owned:pantried(r.id,f[0]) }));
  const totalGrain = ferm.reduce((s,f)=>s+f.kg,0);
  const preboil = STATE.batchSize + eq.kettleLoss + eq.boilOff;
  const og = r.og || 1.05;
  const hops = (r.hops||[]).map(h=>{
    const g = h[1]*sf; const aa = h[2]!=null?h[2]:10; const stage = h[3]||"Boil"; const time = h[4]!=null?h[4]:60;
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
  const grainAbsorptionL = totalGrain * GRAIN_ABSORPTION_L_PER_KG;
  const spargeWater = Math.max(0, preboil - strike + grainAbsorptionL);
  const totalWater = strike + spargeWater;
  const salts = computeSaltAdditions(r.water || FLORAVILLE_WATER, STATE.sourceWater, totalWater);
  const mashTemp = r.mashTemp!=null ? r.mashTemp : DEFAULT_MASH_TEMP_C;
  const grainTemp = STATE.grainTempC!=null ? STATE.grainTempC : DEFAULT_GRAIN_TEMP_C;
  const strikeTemp = mashTemp + (0.4 / eq.mashThickness) * (mashTemp - grainTemp);
  const mashVolume = strike + totalGrain * GRAIN_DISPLACEMENT_L_PER_KG;
  const spargeTemp = STATE.spargeTempC!=null ? STATE.spargeTempC : DEFAULT_SPARGE_TEMP_C;
  return { sf, eq, ferm, hops, totalGrain, totalHops, ibu, og, fermCost, hopCost, yeastCost, full, toBuy, saving, preboil, strike,
    grainAbsorptionL, spargeWater, totalWater, salts, mashTemp, grainTemp, strikeTemp, mashVolume, spargeTemp,
    grainOK: totalGrain <= eq.maxGrain, boilOK: preboil <= eq.maxKettle };
}
function computeSaltAdditions(target, source, totalLiquorL){
  const V = totalLiquorL > 0 ? totalLiquorL : 1;
  const deltaSO4 = Math.max(0, (target.SO4||0) - (source.SO4||0));
  const deltaCl = Math.max(0, (target.Cl||0) - (source.Cl||0));
  const deltaMg = Math.max(0, (target.Mg||0) - (source.Mg||0));
  const deltaAlkUp = Math.max(0, (target.Alk||0) - (source.Alk||0));
  const deltaAlkDown = Math.max(0, (source.Alk||0) - (target.Alk||0));
  const gypsum_g = (deltaSO4 * V) / SALT_PPM_PER_GRAM.gypsum.SO4;
  const cacl2_g = (deltaCl * V) / SALT_PPM_PER_GRAM.cacl2.Cl;
  const epsom_g = (deltaMg * V) / SALT_PPM_PER_GRAM.epsom.Mg;
  const bakingsoda_g = (deltaAlkUp * V) / SALT_PPM_PER_GRAM.bakingsoda.Alk;
  const lacticAcid_mL = deltaAlkDown>0 ? (deltaAlkDown * V / 50000 * 90.08/(1.206*0.88)) : 0;
  const resulting = {
    Ca: (source.Ca||0) + gypsum_g*SALT_PPM_PER_GRAM.gypsum.Ca/V + cacl2_g*SALT_PPM_PER_GRAM.cacl2.Ca/V,
    Mg: (source.Mg||0) + epsom_g*SALT_PPM_PER_GRAM.epsom.Mg/V,
    Na: (source.Na||0) + bakingsoda_g*SALT_PPM_PER_GRAM.bakingsoda.Na/V,
    SO4: (source.SO4||0) + gypsum_g*SALT_PPM_PER_GRAM.gypsum.SO4/V + epsom_g*SALT_PPM_PER_GRAM.epsom.SO4/V,
    Cl: (source.Cl||0) + cacl2_g*SALT_PPM_PER_GRAM.cacl2.Cl/V,
    Alk: lacticAcid_mL>0 ? (target.Alk||0) : (source.Alk||0) + bakingsoda_g*SALT_PPM_PER_GRAM.bakingsoda.Alk/V
  };
  return { gypsum_g, cacl2_g, epsom_g, bakingsoda_g, lacticAcid_mL, resulting, totalLiquorL: V };
}

/* ============================================================ TABS ============================================================ */
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
  const groups = []; TABS.forEach(t=>{ if(!groups.includes(t.group)) groups.push(t.group); });
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
  renderGate();
}

/* ---------- Dashboard ---------- */
function dash(){
  const r = selected(); STATE.selectedId = r.id; const c = calc(r);
  $("#app").innerHTML = `
    <div class="card hero">
      <div class="thumb big" style="cursor:pointer;" id="dashThumb">${recipeThumb(r)}</div>
      <div><h2>${esc(r.name)}</h2><div class="muted">${esc(r.style)} · ${esc(r.desc)}</div></div>
      <div class="heroActions"><button class="btn alt" id="openDetail">🔍 Open recipe details</button></div>
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
  $("#openDetail").onclick = ()=> openRecipeModal(r.id);
  $("#dashThumb").onclick = ()=> openRecipeModal(r.id);
  $("#recSel").onchange = e=>{ STATE.selectedId=e.target.value; save(); render(); };
  $("#batch").onchange = e=>{ STATE.batchSize=parseFloat(e.target.value)||40; save(); render(); };
  $("#eqSel").onchange = e=>{ STATE.equipmentId=e.target.value; save(); render(); };
}
function stat(l,v){ return `<div class="stat"><small>${l}</small><b>${v}</b></div>`; }
function recipeOptions(){
  const lib = allRecipes().filter(r=>!isCustom(r.id)); const mine = allRecipes().filter(r=>isCustom(r.id));
  let h = `<optgroup label="Recipe Library">`+lib.map(r=>`<option value="${r.id}" ${r.id===STATE.selectedId?'selected':''}>${esc(r.name)}</option>`).join("")+`</optgroup>`;
  if(mine.length) h += `<optgroup label="My Recipes">`+mine.map(r=>`<option value="${r.id}" ${r.id===STATE.selectedId?'selected':''}>${esc(r.name)}</option>`).join("")+`</optgroup>`;
  return h;
}
function equipOptions(){ return allEquipment().map(e=>`<option value="${e.id}" ${e.id===STATE.equipmentId?'selected':''}>${esc(e.name)}</option>`).join(""); }

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
          <button class="iconbtn" data-view="${r.id}" title="View recipe">🔍</button>
          <button class="iconbtn" data-brew="${r.id}" title="Brew this">🍺</button>
          <button class="iconbtn" data-dupe="${r.id}" title="Duplicate">⧉</button>
          <button class="iconbtn" data-exp="${r.id}" title="Export this recipe">⬇</button>
          <button class="iconbtn danger" data-del="${r.id}" title="${custom?'Delete':'Hide'}">🗑</button>
        </div></td>
      </tr>`).join("") || `<tr><td colspan="10" style="text-align:center;padding:28px;" class="muted">No recipes match.</td></tr>`;
    bind();
  };
  const bind = ()=>{
    document.querySelectorAll("[data-fav]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFav(b.dataset.fav);rows();});
    document.querySelectorAll("[data-sel]").forEach(tr=>tr.onclick=()=>{openRecipeModal(tr.dataset.sel);});
    document.querySelectorAll("[data-view]").forEach(b=>b.onclick=e=>{e.stopPropagation();openRecipeModal(b.dataset.view);});
    document.querySelectorAll("[data-brew]").forEach(b=>b.onclick=e=>{e.stopPropagation();STATE.selectedId=b.dataset.brew;save();PAGE="dashboard";render();});
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
    yeast:"US-05", yeastForm:"Dry", atten:0.78, tempLo:18, tempHi:20, mashTemp:DEFAULT_MASH_TEMP_C, desc:"", custom:true, image:null,
    ferm:[["Pale Ale Malt",8.0,4.85]], hops:[["Cascade",20,7.5,"Boil",60]], water:defaultWaterForStyle("") };
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
      <p class="desc">A static site can't safely call a live AI search API (that needs a server-side key). Instead, ask an AI assistant in chat for a recipe, paste the JSON it gives you here, and it loads straight into Create a Brew. Or use Quick Generate to adapt a style template.</p>
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
  const r = selected(); const c = calc(r); const target = r.water || FLORAVILLE_WATER; const s = c.salts;
  $("#app").innerHTML = `
    <div class="card"><p>Recipe: <span class="calc">${esc(r.name)}</span> Batch: <span class="calc">${fmt(STATE.batchSize,1)} L</span> Equipment: <span class="calc">${esc(c.eq.name)}</span></p></div>
    <h2 class="sec">Mash setup</h2>
    <div class="card">
      <div class="fields">
        <div class="field"><label>Target mash temp (°C)</label><input type="number" step="0.5" id="wMashTemp" value="${fmt(c.mashTemp,1)}"></div>
        <div class="field"><label>Grain temperature (°C)</label><input type="number" step="0.5" id="wGrainTemp" value="${fmt(c.grainTemp,1)}"></div>
        <div class="field"><label>Mash thickness</label><span class="calc">${c.eq.mashThickness} L/kg (${esc(c.eq.name)})</span></div>
      </div>
    </div>
    <div class="card stats">
      ${stat("Strike water temp", fmt(c.strikeTemp,1)+" °C")}${stat("Strike water volume", fmt(c.strike,1)+" L")}
      ${stat("Mash tun volume", fmt(c.mashVolume,1)+" L")}${stat("Total grain", fmt(c.totalGrain,2)+" kg")}${stat("Grain absorption", fmt(c.grainAbsorptionL,1)+" L")}
    </div>
    <h2 class="sec">Sparge setup</h2>
    <div class="card"><div class="fields"><div class="field"><label>Sparge water temp (°C)</label><input type="number" step="0.5" id="wSpargeTemp" value="${fmt(c.spargeTemp,1)}"></div></div></div>
    <div class="card stats">
      ${stat("Sparge water volume", fmt(c.spargeWater,1)+" L")}${stat("Total water needed", fmt(c.totalWater,1)+" L")}${stat("Pre-boil volume", fmt(c.preboil,1)+" L")}
    </div>
    <h2 class="sec">Source water (edit if you have a test result)</h2>
    <div class="card">
      <p class="desc">Figures below default to Hunter Water published values for the Grahamstown / Tomago supply (covers Newcastle including Floraville).</p>
      <div class="fields">${WATER_IONS.map(i=>`<div class="field"><label>${WATER_LABELS[i]} ppm</label><input type="number" step="0.5" data-w="${i}" value="${STATE.sourceWater[i]}"></div>`).join("")}</div>
    </div>
    <h2 class="sec">Style target for ${esc(r.name)}</h2>
    <div class="card"><table><thead><tr><th>Ion</th><th>Source</th><th>Style target</th><th>After suggested salts</th><th>Still off by</th></tr></thead><tbody>
      ${WATER_IONS.map(i=>{
        const src=STATE.sourceWater[i], tgt=target[i], after=s.resulting[i], diff=after-tgt;
        return `<tr><td>${WATER_LABELS[i]}</td><td>${fmt(src,1)}</td><td>${fmt(tgt,1)}</td><td><b>${fmt(after,1)}</b></td><td style="color:${Math.abs(diff)>15?'#b42318':'#19753c'}">${diff>0?'+':''}${fmt(diff,1)}</td></tr>`;
      }).join("")}
    </tbody></table></div>
    <h2 class="sec">Chemical (salt) additions, across ${fmt(c.totalWater,1)} L total liquor</h2>
    <div class="card">
      <table><thead><tr><th>Addition</th><th>Amount</th><th>Why</th></tr></thead><tbody>
        <tr><td>${SALT_PPM_PER_GRAM.gypsum.name}</td><td><b>${fmt(s.gypsum_g,1)} g</b></td><td class="muted">Boosts sulphate for a crisper, drier hop character</td></tr>
        <tr><td>${SALT_PPM_PER_GRAM.cacl2.name}</td><td><b>${fmt(s.cacl2_g,1)} g</b></td><td class="muted">Boosts chloride for a fuller, rounder malt character</td></tr>
        <tr><td>${SALT_PPM_PER_GRAM.epsom.name}</td><td><b>${fmt(s.epsom_g,1)} g</b></td><td class="muted">Tops up magnesium, only added if still short after the above</td></tr>
        <tr><td>${SALT_PPM_PER_GRAM.bakingsoda.name}</td><td><b>${fmt(s.bakingsoda_g,1)} g</b></td><td class="muted">Raises alkalinity, only needed for darker/roastier styles</td></tr>
        <tr><td>88% Lactic acid</td><td><b>${fmt(s.lacticAcid_mL,2)} mL</b></td><td class="muted">${s.lacticAcid_mL>0 ? "Knocks down excess alkalinity" : "Not needed, source alkalinity already at/below target"}</td></tr>
      </tbody></table>
      <div class="note">These recalculate whenever you change recipe, batch size, mash/sparge settings, or the source water figures above. Always measure actual mash pH 10 to 15 minutes after dough-in with a calibrated pH meter (aiming for roughly 5.2 to 5.6) and adjust from there.</div>
    </div>`;
  document.querySelectorAll("[data-w]").forEach(inp=>inp.onchange=()=>{STATE.sourceWater[inp.dataset.w]=+inp.value||0;save();render();});
  $("#wMashTemp").onchange = e=>{ r.mashTemp = parseFloat(e.target.value); if(isNaN(r.mashTemp)) r.mashTemp = DEFAULT_MASH_TEMP_C; if(isCustom(r.id)) save(); render(); };
  $("#wGrainTemp").onchange = e=>{ STATE.grainTempC = parseFloat(e.target.value); if(isNaN(STATE.grainTempC)) STATE.grainTempC = DEFAULT_GRAIN_TEMP_C; save(); render(); };
  $("#wSpargeTemp").onchange = e=>{ STATE.spargeTempC = parseFloat(e.target.value); if(isNaN(STATE.spargeTempC)) STATE.spargeTempC = DEFAULT_SPARGE_TEMP_C; save(); render(); };
}

/* ---------- Brew Day ---------- */
function brewday(){
  const r=selected(), c=calc(r);
  $("#app").innerHTML = `
    <div class="card"><p>Recipe: <span class="calc">${esc(r.name)}</span> Gear: <span class="calc">${esc(c.eq.name)}</span> Batch: <span class="calc">${fmt(STATE.batchSize,1)} L</span></p></div>
    <div class="card stats">
      ${stat("Total grain",fmt(c.totalGrain,2)+" kg")}${stat("Mash tun volume",fmt(c.mashVolume,1)+" L")}${stat("Strike water",fmt(c.strike,1)+" L")}
      ${stat("Sparge water",fmt(c.spargeWater,1)+" L")}${stat("Total water",fmt(c.totalWater,1)+" L")}
    </div>
    <div class="card stats">
      ${stat("Grain fit",c.grainOK?'OK':'Too much')}${stat("Kettle fit",c.boilOK?'OK':'Too much')}
      ${stat("Gypsum",fmt(c.salts.gypsum_g,1)+" g")}${stat("Calcium chloride",fmt(c.salts.cacl2_g,1)+" g")}${stat("Lactic acid",fmt(c.salts.lacticAcid_mL,2)+" mL")}
    </div>
    <div class="card"><p class="muted">Full salt breakdown is on the Water tab, calculated automatically from this recipe's target water profile.</p></div>
    <h2 class="sec">Process checklist</h2>
    <div class="card"><ul class="check">
      ${["Treat all brewing water for chlorine / chloramine","Add calculated salts to the strike and sparge water","Heat strike water and dough in","Mash 60 min at target temperature","Mash out","Sparge to reach pre-boil volume","Boil and follow the Hops schedule","Whirlpool and stand","Chill to pitch temperature","Aerate and pitch yeast, record OG"].map(s=>`<li><label><input type="checkbox"> ${s}</label></li>`).join("")}
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
    <div class="card"><p class="desc">No AU homebrew supplier has a public price API, so this estimates a landed cost (ingredients + delivery). Confirm the actual cart before ordering.</p></div>
    <h2 class="sec">Ranked by landed cost for ${esc(r.name)}</h2>
    <div class="card list"><table><thead><tr><th>#</th><th>Supplier</th><th>Location</th><th>Ingredients</th><th>Delivery</th><th>Landed</th><th>Confirmed</th></tr></thead><tbody>
      ${rows.map((x,i)=>`<tr ${i===0?'style="background:#e9f6ee"':''}><td>${i+1}${i===0?' 🏆':''}</td><td><b>${esc(x.s.name)}</b></td><td class="muted">${esc(x.s.location)}</td><td>${money(x.ing)}</td><td>${x.label}</td><td><b>${money(x.landed)}</b></td><td class="${x.s.confirmed?'badge-y':'badge-n'}">${x.s.confirmed?'Y':'est.'}</td></tr>`).join("")}
    </tbody></table></div>
    <h2 class="sec">Supplier notes</h2>
    <div class="card">${SUPPLIERS.map(s=>`<div style="margin-bottom:12px;border-bottom:1px solid #efeae4;padding-bottom:10px;"><b><a href="${s.url}" target="_blank">${esc(s.name)}</a></b> <span class="muted">${esc(s.location)}</span><p class="muted" style="margin:4px 0;">${esc(s.notes)}</p></div>`).join("")}</div>`;
}

/* ============================================================ Account & Sync — email OTP CODE flow (no clickable link) ============================================================ */
function secondsLeftOnCooldown(){
  const last = parseInt(localStorage.getItem(OTP_COOLDOWN_KEY) || "0", 10);
  const elapsed = (Date.now() - last) / 1000;
  return Math.max(0, Math.ceil(OTP_COOLDOWN_SECONDS - elapsed));
}
function account(){
  const ready = !!sb; const cooldown = secondsLeftOnCooldown(); const stay = localStorage.getItem(STAY_SIGNED_IN_KEY) !== "0";
  $("#app").innerHTML = `
    <div class="card"><h3>Account & Sync</h3>
      <p class="desc">Sign in with your email to back up recipes, gear, pantry, ratings and images to the cloud and use BrewGenge across devices. Give a mate a copy of the site and everyone stays completely separate. Skip this entirely and everything still works, saved in this browser only.</p>
      <p>Status: <span id="syncStatusBadge" class="${USER?'badge-ok':''}">${USER?'Signed in as '+esc(USER.email):'Not signed in'}</span></p>
    </div>
    ${AUTH_INIT_ERROR ? `<div class="card"><p class="warn"><b>Supabase didn't load:</b> ${esc(AUTH_INIT_ERROR)}</p><p class="muted">This usually means the Supabase project is paused (free-tier projects auto-pause after a week of inactivity), an ad-blocker/firewall blocked the request, or you're offline.</p></div>` : ""}
    ${!ready ? "" :
      USER ? `<div class="card"><div class="toolbar"><button class="btn" id="syncNow">Sync now</button><button class="btn alt" id="out">Sign out</button></div><p id="syncMsg" class="muted" style="margin-top:10px;">${esc(LAST_SYNC_MESSAGE||"")}</p></div>`
      : buildAuthFormHTML(stay, cooldown, "acct")}
    <div class="card"><h3>Why a 6-digit code instead of a clickable link?</h3>
      <p class="desc">Corporate email systems (Microsoft Defender Safe Links and similar) automatically "visit" every link in an incoming email to scan it for malware, before you ever click it. Since sign-in links are single-use, that automatic scan silently burns the link, so by the time you click it yourself, it's already dead, with no visible error, just bounced back to the login screen. A scanner can visit a link, but it can't "use up" a plain number sitting in an email body.</p>
    </div>
    <div class="card"><h3>Sharing recipes with mates</h3>
      <p class="desc">Use <b>Export Recipe Pack</b> in the Recipe Library. Works with or without signing in, no account needed at all.</p>
    </div>`;
  if(USER){
    $("#syncNow").onclick=async()=>{ $("#syncNow").disabled=true; await safeSyncNow(); render(); };
    $("#out").onclick=async()=>{ if(sb) await sb.auth.signOut(); USER=null; syncStatus="local"; render(); };
  } else if(ready){
    wireAuthForm("acct");
  }
}
function buildAuthFormHTML(stay, cooldown, prefix){
  const showingCodeStep = !!codeStepEmail;
  return `<div class="card">
    ${!showingCodeStep ? `
      <div class="field" style="max-width:320px;"><label>Email</label><input id="${prefix}Email" type="email" placeholder="you@example.com" autocomplete="email"></div><br>
      <label class="toggle" style="margin-bottom:10px; display:flex; align-items:center; gap:8px;"><input type="checkbox" id="${prefix}Stay" ${stay?"checked":""}> Stay signed in on this device</label>
      <button class="btn" id="${prefix}Send" ${cooldown>0?'disabled':''}>${cooldown>0 ? 'Wait '+cooldown+'s to resend' : 'Send sign-in code'}</button>
      <div id="${prefix}Msg" style="margin-top:10px;"></div>
    ` : `
      <p class="desc">We've emailed a 6-digit code to <b>${esc(codeStepEmail)}</b>. Enter it below, no need to click anything in the email.</p>
      <div class="field" style="max-width:180px;"><label>6-digit code</label><input id="${prefix}Code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="123456" autocomplete="one-time-code"></div><br>
      <button class="btn" id="${prefix}Verify">Verify & sign in</button>
      <button class="btn alt" id="${prefix}BackToEmail" style="margin-left:8px;">Use a different email</button>
      <div id="${prefix}Msg" style="margin-top:10px;"></div>
    `}
  </div>`;
}
function wireAuthForm(prefix){
  if(codeStepEmail){
    const codeInput = $("#"+prefix+"Code");
    if(codeInput) codeInput.addEventListener("keydown", e=>{ if(e.key==="Enter") doVerifyCode(prefix); });
    const verifyBtn = $("#"+prefix+"Verify"); if(verifyBtn) verifyBtn.onclick = ()=> doVerifyCode(prefix);
    const backBtn = $("#"+prefix+"BackToEmail"); if(backBtn) backBtn.onclick = ()=>{ codeStepEmail = null; if(prefix==="acct") render(); else renderGate(true); };
  } else {
    const emailInput = $("#"+prefix+"Email");
    if(emailInput) emailInput.addEventListener("keydown", e=>{ if(e.key==="Enter" && !$("#"+prefix+"Send").disabled) doSendCode(prefix); });
    const stayInput = $("#"+prefix+"Stay"); if(stayInput) stayInput.onchange = e=>localStorage.setItem(STAY_SIGNED_IN_KEY, e.target.checked?"1":"0");
    const sendBtn = $("#"+prefix+"Send"); if(sendBtn) sendBtn.onclick = ()=> doSendCode(prefix);
    if(secondsLeftOnCooldown()>0 && sendBtn) startCooldownCountdown(sendBtn);
  }
}
async function doSendCode(prefix){
  const emailEl = $("#"+prefix+"Email"); const msgEl = $("#"+prefix+"Msg");
  const email = (emailEl.value||"").trim();
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msgEl.innerHTML = `<span class="warn">Enter a valid email address.</span>`; return; }
  if(!sb){ msgEl.innerHTML = `<span class="warn">Still connecting to Supabase. If this persists, the project may be paused, check the Supabase dashboard.</span>`; return; }
  const cooldown = secondsLeftOnCooldown();
  if(cooldown>0){ msgEl.innerHTML = `<span class="warn">Wait ${cooldown}s before requesting another code.</span>`; return; }
  msgEl.innerHTML = `<span class="muted">Sending...</span>`;
  const sendBtn = $("#"+prefix+"Send"); if(sendBtn) sendBtn.disabled = true;
  try{
    const { error } = await sb.auth.signInWithOtp({ email });
    if(error){ msgEl.innerHTML = `<span class="warn">${esc(error.message)}</span>`; if(sendBtn) sendBtn.disabled = false; }
    else { localStorage.setItem(OTP_COOLDOWN_KEY, String(Date.now())); codeStepEmail = email; if(prefix==="acct") render(); else renderGate(true); }
  }catch(e){
    msgEl.innerHTML = `<span class="warn">Network error contacting Supabase: ${esc(e.message)}. This usually means the Supabase project is paused or unreachable from this network.</span>`;
    if(sendBtn) sendBtn.disabled = false;
  }
}
async function doVerifyCode(prefix){
  const codeEl = $("#"+prefix+"Code"); const msgEl = $("#"+prefix+"Msg");
  const code = (codeEl.value||"").trim();
  if(!/^\d{4,8}$/.test(code)){ msgEl.innerHTML = `<span class="warn">Enter the code exactly as it appears in the email.</span>`; return; }
  if(!sb){ msgEl.innerHTML = `<span class="warn">Not connected to Supabase yet.</span>`; return; }
  msgEl.innerHTML = `<span class="muted">Checking...</span>`;
  try{
    const { data, error } = await sb.auth.verifyOtp({ email: codeStepEmail, token: code, type: "email" });
    if(error){ msgEl.innerHTML = `<span class="warn">${esc(error.message)}. Codes expire quickly, request a fresh one if needed.</span>`; return; }
    USER = data && data.user ? data.user : (data && data.session ? data.session.user : USER);
    localStorage.removeItem(OFFLINE_MODE_KEY); codeStepEmail = null;
    await cloudPull(); updateSyncBadge(); renderGate(); if(PAGE==="account") render();
  }catch(e){ msgEl.innerHTML = `<span class="warn">Network error verifying code: ${esc(e.message)}.</span>`; }
}
function startCooldownCountdown(btn){
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(()=>{
    const left = secondsLeftOnCooldown();
    if(!btn || !document.body.contains(btn)){ clearInterval(cooldownTimer); return; }
    if(left<=0){ btn.disabled=false; btn.textContent="Send sign-in code"; clearInterval(cooldownTimer); }
    else { btn.disabled=true; btn.textContent = "Wait "+left+"s to resend"; }
  }, 1000);
}

/* ---------- Read Me ---------- */
function readme(){
  $("#app").innerHTML = `
    <div class="card"><h3>How to use BrewGenge</h3><ol>
      <li>Pick a recipe and batch size on the Dashboard, everything scales automatically.</li>
      <li>Choose your gear under Equipment, capacity checks follow it.</li>
      <li>Click 🔍 on any recipe for the full detail popup.</li>
      <li>Tick "Already have?" on Fermentables/Hops to drop pantry items from the Cost.</li>
      <li>Water tab covers mash, sparge and salt additions, all in real litres and grams.</li>
      <li>Sign in once per device (tick "Stay signed in") to safely sync everything, including images, across devices.</li>
    </ol></div>
    <div class="card"><h3>Signing in: a typed code, not a clickable link</h3>
      <p>Enter your email, tick <b>Stay signed in on this device</b>, click <b>Send sign-in code</b>. BrewGenge emails a 6-digit code, type it in and click <b>Verify & sign in</b>. There is nothing to click in the email itself.</p>
      <p>This is deliberate: clickable "magic link" emails are frequently opened automatically by corporate email security scanners (Microsoft Defender Safe Links and similar) before you ever see them, silently burning the single-use link. A typed code can't be consumed that way.</p>
      <p><b>Sync is merge-based, not overwrite-based.</b> When two devices both have recipes, BrewGenge combines them by recipe ID and keeps whichever version was edited most recently.</p>
    </div>
    <div class="card"><h3>Sharing recipe packs</h3>
      <p>Recipe Library → Export Recipe Pack. Uploaded images are embedded as Base64 inside the JSON and import with the recipe.</p>
      <div class="note"><b>No additional SQL is required for recipe packs or for signing in.</b></div>
    </div>
    <div class="card"><h3>Hosting on GitHub Pages</h3><ol>
      <li>Upload <code>index.html</code>, <code>css</code>, <code>js</code>, <code>img</code> and <code>supabase</code> to the repo root.</li>
      <li>Settings → Pages → Deploy from a branch → main → / (root).</li>
      <li>Hard refresh once after deploying if an old cached version shows.</li>
    </ol></div>`;
}

/* ============================================================ Recipe Detail Modal ============================================================ */
function openRecipeModal(id){
  STATE.selectedId = id; save();
  document.querySelectorAll(".recipe-modal-backdrop").forEach(m=>m.remove());
  const backdrop = document.createElement("div"); backdrop.className = "recipe-modal-backdrop"; backdrop.id = "recipeModalBackdrop";
  document.body.appendChild(backdrop);
  refreshRecipeModal(id);
  document.addEventListener("keydown", modalEscHandler);
  backdrop.addEventListener("click", e=>{ if(e.target===backdrop) closeRecipeModal(); });
}
function modalEscHandler(e){ if(e.key==="Escape") closeRecipeModal(); }
function closeRecipeModal(){
  document.removeEventListener("keydown", modalEscHandler);
  const b = document.getElementById("recipeModalBackdrop"); if(b) b.remove();
  if(PAGE==="library" || PAGE==="dashboard") render();
}
function refreshRecipeModal(id){
  const backdrop = document.getElementById("recipeModalBackdrop"); if(!backdrop) return;
  const r = allRecipes().find(x=>x.id===id); if(!r){ closeRecipeModal(); return; }
  const c = calc(r); const custom = isCustom(r.id); const guideline = findStyleGuideline(r.style);
  const color = estimateColorEBC(r); const rating = getRating(r.id); const sessions = getSessions(r.id);
  backdrop.innerHTML = `
    <div class="recipe-modal-box">
      <div class="rm-header">
        <input id="rmNameInput" value="${esc(r.name)}">
        <div class="rm-headicons">
          <button class="iconbtn" id="rmDupBtn" title="Duplicate">⧉</button>
          <button class="iconbtn" id="rmExportBtn" title="Export as JSON">⬇</button>
          <button class="iconbtn" id="rmShareBtn" title="Share">📤</button>
          <button class="iconbtn danger" id="rmDelBtn" title="${custom?'Delete':'Hide'}">🗑</button>
          <button class="iconbtn" id="rmCloseBtn" title="Close">✕</button>
        </div>
      </div>
      <div class="rm-body">
        <div class="rm-top">
          <div class="rm-thumb-wrap" id="rmThumbWrap"><div class="thumb big">${recipeThumb(r)}</div></div>
          <input type="file" id="rmImgFile" accept="image/*" hidden>
          <div class="rm-topinfo">
            <div class="pill">${esc(r.style)||'Uncategorised'}</div>
            <div class="rm-stars">${[1,2,3,4,5].map(n=>`<button data-star="${n}" class="${n<=rating?'on':''}">★</button>`).join("")}</div>
            <p class="desc">${esc(r.desc||"")}</p>
            ${r.capacityWarning ? `<div class="note">${esc(r.capacityWarning)}</div>` : ""}
          </div>
        </div>
        <h2 class="sec">Batch setup</h2>
        <div class="toolbar">
          <div class="field"><label>Batch into fermenter (L)</label><input type="number" step="0.5" id="rmBatch" value="${STATE.batchSize}"></div>
          <div class="field"><label>Equipment</label><select id="rmEq">${equipOptions()}</select></div>
          <div class="field"><label>Scale</label><span class="calc">${fmt(c.sf,2)}x</span></div>
        </div>
        <h2 class="sec">Vitals</h2>
        <div class="stats">
          ${stat("OG", fmt(r.og,3))}${stat("FG", fmt(r.fg,3))}${stat("ABV", fmt(r.abv,1)+"%")}${stat("IBU", fmt(c.ibu,0))}
          ${stat("Colour", `<span class="rm-colorswatch" style="background:${color.hex}"></span>${fmt(color.ebc,0)} EBC`)}
        </div>
        ${guideline ? buildGuidelinePanel(r, guideline) : `<div class="card"><p class="muted">No typical style range on file for "${esc(r.style)}".</p></div>`}
        <h2 class="sec">${esc(c.eq.name)} capacity</h2>
        <div class="card">
          <p>Grain fits mash tun (max ${c.eq.maxGrain} kg)? <span class="${c.grainOK?'badge-ok':'badge-warn'}">${c.grainOK?'OK':'TOO MUCH GRAIN'}</span></p>
          <p>Pre-boil fits kettle (max ${c.eq.maxKettle} L)? <span class="${c.boilOK?'badge-ok':'badge-warn'}">${c.boilOK?'OK':'TOO MUCH LIQUID'}</span></p>
        </div>
        <h2 class="sec">Shopping list</h2>
        <div class="card"><table><thead><tr><th>Already have?</th><th>Ingredient</th><th>Amount</th><th>Cost</th></tr></thead><tbody>
          ${c.ferm.map(f=>`<tr class="rm-shoprow ${f.owned?'owned':''}"><td><input type="checkbox" data-rmown="${esc(f.name)}" ${f.owned?'checked':''}></td><td>${esc(f.name)}</td><td>${fmt(f.kg,2)} kg</td><td>${f.owned?`<span class="strike">${money(f.kg*f.price)}</span>$0.00`:money(f.kg*f.price)}</td></tr>`).join("")}
          ${c.hops.map(h=>`<tr class="rm-shoprow ${h.owned?'owned':''}"><td><input type="checkbox" data-rmown="${esc(h.name)}" ${h.owned?'checked':''}></td><td>${esc(h.name)} <span class="muted">(${h.stage})</span></td><td>${fmt(h.g,1)} g</td><td>${h.owned?`<span class="strike">${money(h.g*h.price)}</span>$0.00`:money(h.g*h.price)}</td></tr>`).join("")}
          <tr><td></td><td>Yeast: ${esc(r.yeast)} (${r.yeastForm})</td><td></td><td>${money(c.yeastCost)}</td></tr>
          <tr class="total"><td></td><td>Total to buy</td><td></td><td>${money(c.toBuy)}</td></tr>
        </tbody></table></div>
        <h2 class="sec">Brew history</h2>
        <div class="card">
          <div class="fields">
            <div class="field"><label>Actual OG</label><input type="number" step="0.001" id="rmSessOG" placeholder="1.052"></div>
            <div class="field"><label>Actual FG</label><input type="number" step="0.001" id="rmSessFG" placeholder="1.011"></div>
            <div class="field"><label>Notes</label><input type="text" id="rmSessNotes" placeholder="Tasting notes..."></div>
          </div>
          <br><button class="btn alt" id="rmAddSess">+ Log this brew</button>
          ${sessions.length ? `<table style="margin-top:14px;"><thead><tr><th>Date</th><th>OG</th><th>FG</th><th>ABV</th><th>Notes</th><th></th></tr></thead><tbody>
            ${sessions.slice().reverse().map(s=>{
              const abv = (s.og && s.fg) ? ((s.og-s.fg)*131.25).toFixed(1)+"%" : "-";
              return `<tr><td class="muted">${fmtDateTime(s.date)}</td><td>${s.og?fmt(s.og,3):'-'}</td><td>${s.fg?fmt(s.fg,3):'-'}</td><td>${abv}</td><td>${esc(s.notes||"")}</td><td><button class="iconbtn danger" data-delsess="${s.id}">🗑</button></td></tr>`;
            }).join("")}
          </tbody></table>` : `<p class="muted" style="margin-top:10px;">No brews logged yet.</p>`}
        </div>
        ${custom ? `<h2 class="sec">Edit ingredients</h2><div class="card"><button class="btn alt" id="rmEditBtn">✎ Open full editor</button></div>` :
          `<h2 class="sec">Want to tweak this one?</h2><div class="card"><p class="desc">Duplicate it first (⧉ above) to get your own editable BrewGenge copy.</p></div>`}
      </div>
      <div class="rm-footer">
        <button class="btn big" id="rmBrewBtn">🍺 Brew This</button>
        <button class="iconbtn" id="rmFavBtn" title="Favourite" style="width:40px;height:40px;font-size:1.1rem;">${isFav(r.id)?'★':'☆'}</button>
        <span class="spacer"></span>
        <button class="btn alt" id="rmCloseBtn2">Close</button>
      </div>
    </div>`;
  $("#rmCloseBtn").onclick = closeRecipeModal; $("#rmCloseBtn2").onclick = closeRecipeModal;
  $("#rmBrewBtn").onclick = ()=>{ STATE.selectedId=r.id; save(); closeRecipeModal(); PAGE="dashboard"; render(); };
  $("#rmFavBtn").onclick = ()=>{ toggleFav(r.id); refreshRecipeModal(r.id); };
  $("#rmNameInput").onchange = e=>{ renameRecipe(r.id, e.target.value); };
  $("#rmThumbWrap").onclick = ()=> $("#rmImgFile").click();
  $("#rmImgFile").onchange = e=> resizeImg(e.target.files[0], url=>{ setImage(r.id, url); refreshRecipeModal(r.id); });
  document.querySelectorAll("[data-star]").forEach(b=>b.onclick=()=>{ setRating(r.id, +b.dataset.star); refreshRecipeModal(r.id); });
  $("#rmBatch").onchange = e=>{ STATE.batchSize = parseFloat(e.target.value)||40; save(); refreshRecipeModal(r.id); };
  $("#rmEq").onchange = e=>{ STATE.equipmentId = e.target.value; save(); refreshRecipeModal(r.id); };
  document.querySelectorAll("[data-rmown]").forEach(cb=>cb.onchange=()=>{ togglePantry(r.id, cb.dataset.rmown, cb.checked); refreshRecipeModal(r.id); });
  $("#rmAddSess").onclick = ()=>{
    const og = parseFloat($("#rmSessOG").value) || null; const fg = parseFloat($("#rmSessFG").value) || null; const notes = $("#rmSessNotes").value.trim();
    addSession(r.id, { og, fg, notes }); refreshRecipeModal(r.id);
  };
  document.querySelectorAll("[data-delsess]").forEach(b=>b.onclick=()=>{ deleteSession(r.id, b.dataset.delsess); refreshRecipeModal(r.id); });
  $("#rmDupBtn").onclick = ()=>{ const c2 = cloneRecipe(r); const newId = saveRecipe(c2); openRecipeModal(newId); };
  $("#rmExportBtn").onclick = ()=> exportSingle(r);
  $("#rmShareBtn").onclick = async ()=>{
    const text = `${r.name}\n${r.style} · ${fmt(r.abv,1)}% ABV · ${fmt(r.ibu,0)} IBU\n${r.desc||""}\n\nMade with BrewGenge.`;
    if(navigator.share){ try{ await navigator.share({ title:r.name, text }); }catch(e){} }
    else if(navigator.clipboard){ await navigator.clipboard.writeText(text); alert("Recipe summary copied to clipboard."); }
    else { alert(text); }
  };
  $("#rmDelBtn").onclick = ()=>{
    const msg = custom ? "Delete this BrewGenge recipe permanently?" : "Hide this library recipe? You can restore it any time.";
    if(confirm(msg)){ deleteRecipe(r.id); closeRecipeModal(); }
  };
  const editBtn = $("#rmEditBtn"); if(editBtn) editBtn.onclick = ()=>{ STATE.draftRecipe = JSON.parse(JSON.stringify(r)); save(); closeRecipeModal(); PAGE="create"; render(); };
}
function buildGuidelinePanel(r, g){
  const rows = [ ["OG", r.og, g.og], ["FG", r.fg, g.fg], ["ABV %", r.abv, g.abv], ["IBU", r.ibu, g.ibu] ];
  return `<h2 class="sec">How this compares to style</h2>
    <div class="card"><table class="gl-table"><thead><tr><th>Metric</th><th>This recipe</th><th>Typical range</th><th>In style?</th></tr></thead><tbody>
      ${rows.map(([label, val, range])=>{
        const inRange = val>=range[0] && val<=range[1];
        return `<tr><td>${label}</td><td>${label==="OG"||label==="FG"?fmt(val,3):fmt(val,1)}</td><td>${label==="OG"||label==="FG"?fmt(range[0],3)+' – '+fmt(range[1],3):fmt(range[0],1)+' – '+fmt(range[1],1)}</td><td class="${inRange?'instyle':'outstyle'}">${inRange?'Yes':'Outside'}</td></tr>`;
      }).join("")}
    </tbody></table></div>`;
}

/* ============================================================ Image resize helper ============================================================ */
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

/* ============================================================ Recipe import normalisation ============================================================ */
function normalizeWaterObject(w){
  if(!w || typeof w !== "object") return null;
  const pick = (...keys) => { for(const k of keys){ if(w[k]!=null && !isNaN(w[k])) return +w[k]; } return null; };
  const out = { Ca: pick("Ca","calcium","Calcium"), Mg: pick("Mg","magnesium","Magnesium"), Na: pick("Na","sodium","Sodium"),
    SO4: pick("SO4","sulfate","sulphate","Sulfate","Sulphate"), Cl: pick("Cl","chloride","Chloride"), Alk: pick("Alk","alkalinity","Alkalinity") };
  const hasAny = Object.values(out).some(v => v!=null);
  if(!hasAny) return null;
  WATER_IONS.forEach(ion => { if(out[ion]==null) out[ion] = FLORAVILLE_WATER[ion]; });
  return out;
}
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
    return { id:null, custom:true, name: raw.name || "Imported Brew", style: raw.style || "", baseBatch: raw.baseBatch || raw.batchSizeL || 40,
      og: raw.og || 1.05, fg: raw.fg || 1.01, abv: raw.abv || 5, ibu: raw.ibu || 30,
      yeast: raw.yeast || "US-05", yeastForm: raw.yeastForm || "Dry", atten: raw.atten || 0.78,
      tempLo: raw.tempLo || 18, tempHi: raw.tempHi || 20, desc: raw.desc || raw.description || "", image: raw.image || null,
      ferm: (hasNativeFerm && raw.ferm.length) ? raw.ferm : [["Pale Ale Malt",8,4.85]],
      hops: (hasNativeHops && raw.hops.length) ? raw.hops : [["Cascade",20,7.5,"Boil",60]],
      water: (raw.water && typeof raw.water==="object") ? Object.assign({}, raw.water) : defaultWaterForStyle(raw.style) };
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
      let stage = "Boil"; if(/whirlpool|flameout|hopstand/.test(useStr)) stage = "Whirlpool"; else if(/dry/.test(useStr)) stage = "Dry Hop";
      const time = stage==="Dry Hop" ? 0 : (h.timeMin!=null ? h.timeMin : (h.time!=null ? h.time : 60));
      return [ h.name || "Hop", g, aa, stage, time ];
    });
    let yeastName = "US-05", yeastForm = "Dry", tempLo = 18, tempHi = 20;
    if(Array.isArray(raw.yeast) && raw.yeast.length){
      yeastName = raw.yeast.map(y=>y.name).filter(Boolean).join(" / ") || yeastName;
      const y0 = raw.yeast[0];
      if(y0){ if(y0.form) yeastForm = /liquid/i.test(y0.form) ? "Liquid" : "Dry"; if(y0.pitchTempC!=null){ tempLo = y0.pitchTempC; tempHi = y0.pitchTempC+2; } }
    } else if(typeof raw.yeast === "string" && raw.yeast.trim()){ yeastName = raw.yeast; }
    if(Array.isArray(raw.fermentationSteps)){
      const primary = raw.fermentationSteps.find(s=>/primary/i.test(s.name||""));
      if(primary && primary.temperatureC!=null){ tempLo = primary.temperatureC; tempHi = primary.temperatureC+2; }
    }
    const og = targets.og!=null?targets.og:(raw.og!=null?raw.og:1.05);
    const fg = targets.fg!=null?targets.fg:(raw.fg!=null?raw.fg:1.01);
    const abv = targets.abvPercent!=null?targets.abvPercent:(targets.abv!=null?targets.abv:(raw.abv!=null?raw.abv:Math.round((og-fg)*131.25*10)/10));
    const ibu = targets.ibu!=null?targets.ibu:(raw.ibu!=null?raw.ibu:30);
    if(ferm.length===0 && hops.length===0) return null;
    return { id:null, custom:true, name: raw.name || "Imported Brew", style: raw.style || "", baseBatch: raw.batchSizeL || raw.baseBatch || 40,
      og, fg, abv, ibu, yeast: yeastName, yeastForm, atten: (og>1 && fg>1 && og>fg) ? Math.round(((og-fg)/(og-1))*1000)/1000 : 0.78, tempLo, tempHi,
      desc: raw.description || raw.desc || (Array.isArray(raw.brewDayNotes)?raw.brewDayNotes.join(" "):"") || "", image: raw.image || null,
      ferm: ferm.length ? ferm : [["Pale Ale Malt",8,4.85]], hops: hops.length ? hops : [["Cascade",20,7.5,"Boil",60]],
      water: normalizeWaterObject(raw.water) || defaultWaterForStyle(raw.style) };
  }
  return null;
}

/* ============================================================ Export / import recipe packs ============================================================ */
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
    <p class="muted">Uploaded images are embedded inside the JSON.</p>
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
    if(!list || !list.length){ alert("Couldn't find any recipes in that file."); e.target.value=""; return; }
    let ok=0, fail=0, anyImage=false;
    list.forEach(raw=>{
      const norm = normalizeRecipe(raw);
      if(!norm){ fail++; return; }
      if(norm.image) anyImage=true;
      saveRecipe(norm); ok++;
    });
    if(ok===0){ alert("None of the recipes in that file could be read."); }
    else{
      let msg = `Imported ${ok} recipe${ok===1?'':'s'}`;
      if(fail>0) msg += `, ${fail} skipped`;
      if(anyImage) msg += ", including embedded images";
      msg += "."; alert(msg); render();
    }
    e.target.value="";
  };
  rd.readAsText(f);
}

/* ============================================================ SAFE MERGE SYNC ============================================================ */
function tsOf(obj){ return Date.parse(obj && (obj.updatedAt||obj.createdAt) || 0) || 0; }
function mergeArrayById(a, b){
  const map = new Map();
  [...(a||[]), ...(b||[])].forEach(item=>{ if(!item || !item.id) return; const existing = map.get(item.id); if(!existing || tsOf(item) >= tsOf(existing)) map.set(item.id, item); });
  return [...map.values()];
}
function mergeSessionsById(a, b){
  const map = new Map();
  [...(a||[]), ...(b||[])].forEach(item=>{ if(item && item.id) map.set(item.id, item); });
  return [...map.values()];
}
function mergeStates(local, cloud){
  if(!cloud) return local; if(!local) return cloud;
  const cloudNewer = (Date.parse(cloud.lastActivityAt||0)||0) >= (Date.parse(local.lastActivityAt||0)||0);
  const scalarSource = cloudNewer ? cloud : local;
  const base = merge(defaults(), cloud);
  base.myRecipes = mergeArrayById(cloud.myRecipes, local.myRecipes);
  base.myEquipment = mergeArrayById(cloud.myEquipment, local.myEquipment);
  base.favourites = [...new Set([...(cloud.favourites||[]), ...(local.favourites||[])])];
  base.hidden = [...new Set([...(cloud.hidden||[]), ...(local.hidden||[])])];
  base.overrides = Object.assign({}, cloud.overrides||{}, local.overrides||{});
  base.ratings = Object.assign({}, cloud.ratings||{}, local.ratings||{});
  const pantryKeys = new Set([...Object.keys(cloud.pantry||{}), ...Object.keys(local.pantry||{})]);
  base.pantry = {}; pantryKeys.forEach(k=>{ base.pantry[k] = Object.assign({}, (cloud.pantry||{})[k]||{}, (local.pantry||{})[k]||{}); });
  const sessKeys = new Set([...Object.keys(cloud.brewSessions||{}), ...Object.keys(local.brewSessions||{})]);
  base.brewSessions = {}; sessKeys.forEach(k=>{ base.brewSessions[k] = mergeSessionsById((cloud.brewSessions||{})[k], (local.brewSessions||{})[k]); });
  ["selectedId","batchSize","equipmentId","sourceWater","grainTempC","spargeTempC","efficiency","fermLog"].forEach(k=>{ if(scalarSource[k] !== undefined) base[k] = scalarSource[k]; });
  base.lastActivityAt = new Date().toISOString();
  return base;
}
async function fetchCloudRow(){
  const { data, error } = await sb.from("user_app_state").select("state").eq("user_id", USER.id).maybeSingle();
  if(error) throw error; return data ? data.state : null;
}
async function writeCloudRow(state){
  const { error } = await sb.from("user_app_state").upsert({ user_id: USER.id, state, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if(error) throw error;
}
async function safeSyncNow(){
  if(!sb || !USER) return;
  syncStatus = "syncing"; updateSyncBadge();
  try{
    const cloud = await fetchCloudRow();
    const localHad = (STATE.myRecipes||[]).length;
    const cloudHad = cloud ? (cloud.myRecipes||[]).length : 0;
    if(!cloud){ await writeCloudRow(STATE); LAST_SYNC_MESSAGE = `${localHad} local recipe(s) uploaded to BrewGenge Cloud.`; }
    else {
      STATE = mergeStates(STATE, cloud);
      repairWaterlessCustomRecipes(STATE);
      localStorage.setItem(STORE, JSON.stringify(STATE));
      await writeCloudRow(STATE);
      const mergedHad = (STATE.myRecipes||[]).length;
      if(localHad===0 && cloudHad>0) LAST_SYNC_MESSAGE = `${cloudHad} recipe(s) restored from BrewGenge Cloud.`;
      else if(localHad>0 && cloudHad===0) LAST_SYNC_MESSAGE = `${localHad} local recipe(s) uploaded to BrewGenge Cloud.`;
      else LAST_SYNC_MESSAGE = `Libraries merged safely, ${mergedHad} BrewGenge recipe(s) available.`;
    }
    syncStatus = "synced";
  }catch(e){ console.warn("safeSyncNow failed", e); syncStatus = "error"; LAST_SYNC_MESSAGE = "Sync failed: " + (e.message||e); }
  updateSyncBadge();
}
function cloudPush(force){
  if(!sb || !USER) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(()=>{ safeSyncNow(); }, force?0:900);
}
async function cloudPull(){ await safeSyncNow(); render(); }
function updateSyncBadge(){
  const el=$("#sync"); if(!el) return;
  const map={ local:["","Local mode"], syncing:["online","Syncing..."], synced:["online","Synced · "+(USER?USER.email:"")], error:["error","Sync error"] };
  const [cls,txt]=USER?(map[syncStatus]||map.synced):map.local;
  el.className=cls; el.textContent=txt;
  const b=$("#syncStatusBadge"); if(b){ b.className=USER?"badge-ok":""; b.textContent=USER?("Signed in as "+USER.email):"Not signed in"; }
}

/* ============================================================ LOGIN GATE ============================================================ */
function shouldShowGate(){ if(USER) return false; if(localStorage.getItem(OFFLINE_MODE_KEY) === "1") return false; return true; }
function renderGate(forceShow){
  if(!forceShow && !shouldShowGate()){ removeGate(); return; }
  if(forceShow && USER){ removeGate(); return; }
  let gate = document.getElementById("bgGate");
  const stay = localStorage.getItem(STAY_SIGNED_IN_KEY) !== "0"; const cooldown = secondsLeftOnCooldown();
  if(!gate){ gate = document.createElement("div"); gate.id = "bgGate"; gate.className = "bg-gate"; document.body.appendChild(gate); }
  gate.innerHTML = `
    <div class="bg-gate-card">
      <div class="bg-gate-logo">${BREWGENGE_LOGO_SVG}</div>
      <h1>BrewGenge</h1>
      <p>Your brewing library, safely synced across every device.</p>
      ${buildAuthFormHTML(stay, cooldown, "gate")}
      ${!codeStepEmail ? `<button class="btn alt" id="bgGateOffline" style="width:100%;margin-top:8px;">Continue offline</button>` : ""}
    </div>`;
  wireAuthForm("gate");
  const offlineBtn = $("#bgGateOffline"); if(offlineBtn) offlineBtn.onclick = ()=>{ localStorage.setItem(OFFLINE_MODE_KEY, "1"); removeGate(); };
}
function removeGate(){ const g = document.getElementById("bgGate"); if(g) g.remove(); }

/* ============================================================ Supabase cloud sync ============================================================ */
function loadSupabaseScript(timeoutMs=6000){
  return new Promise((resolve)=>{
    if(typeof window.supabase !== "undefined"){ resolve(true); return; }
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    let done = false; const finish = (ok)=>{ if(done) return; done=true; resolve(ok); };
    s.onload = ()=> finish(true); s.onerror = ()=> finish(false);
    document.head.appendChild(s);
    setTimeout(()=> finish(typeof window.supabase !== "undefined"), timeoutMs);
  });
}
async function initSupabase(){
  try{
    const loaded = await loadSupabaseScript();
    if(!loaded || typeof window.supabase === "undefined"){ AUTH_INIT_ERROR = "The Supabase library did not load from the CDN (offline, blocked, or timed out)."; updateSyncBadge(); renderGate(); return; }
    if(!SB_URL || SB_URL.includes("YOUR-")){ AUTH_INIT_ERROR = "Supabase URL is not configured."; updateSyncBadge(); renderGate(); return; }
    sb = window.supabase.createClient(SB_URL, SB_KEY);
    const { data, error } = await sb.auth.getSession();
    if(error){ console.warn("getSession error", error); AUTH_INIT_ERROR = error.message; }
    USER = data && data.session ? data.session.user : null;
    if(USER){ localStorage.removeItem(OFFLINE_MODE_KEY); await cloudPull(); }
    renderGate();
    sb.auth.onAuthStateChange(async (event, session)=>{
      USER = session ? session.user : null;
      if(event === "SIGNED_IN"){ localStorage.removeItem(OFFLINE_MODE_KEY); }
      if(USER) await cloudPull();
      updateSyncBadge(); renderGate();
      if(PAGE==="account") render();
    });
  }catch(e){ AUTH_INIT_ERROR = e.message || String(e); console.warn("supabase init failed", e); }
  updateSyncBadge(); renderGate();
}
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState==="hidden" && sb && USER && localStorage.getItem(STAY_SIGNED_IN_KEY)==="0"){ sb.auth.signOut(); }
});

/* ============================================================ Logo / crest loading ============================================================ */
function setupCrest(){
  const el = document.getElementById("crest"); if(!el) return;
  const candidates = ["img/logo.jpeg", "img/logo.jpg", "img/logo.png"]; let i = 0;
  const img = document.createElement("img"); img.alt = "BrewGenge";
  img.style.width = "100%"; img.style.height = "100%"; img.style.borderRadius = "50%"; img.style.objectFit = "cover"; img.style.display = "block";
  img.onerror = function(){ i++; if(i < candidates.length){ img.src = candidates[i]; } else { el.innerHTML = BREWGENGE_LOGO_SVG; } };
  el.innerHTML = ""; el.appendChild(img); img.src = candidates[0];
}

/* ============================================================ Boot ============================================================ */
setupCrest();
$("#menu").onclick = ()=> $("aside").classList.toggle("open");
render();
initSupabase();
