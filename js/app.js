/* ============================================================
   ULTIMATE BREW CALCULATOR - APP LOGIC
   Vanilla JS, no build step, works straight off GitHub Pages.
   ============================================================ */

const STORAGE_KEY = "brewcalc_state_v1";

function defaultState(){
  const salts = {};
  Object.keys(SALT_DEFAULT_GRAMS).forEach(k => salts[k] = SALT_DEFAULT_GRAMS[k]);
  const source = Object.assign({}, SOURCE_WATER_DEFAULTS);
  return {
    recipeId: RECIPES[0].id,
    batchSize: RECIPES[0].baseBatch,
    myRecipes: [],
    draftRecipe: null,
    efficiency: 0.75,
    boilMin: 60,
    boilOff: 4,
    kettleLoss: 3,
    grainAbsorption: 0.8,
    mashThickness: 2.9,
    whirlpoolUtil: 0.35,
    sourceWater: source,
    saltGrams: salts,
    measuredMashPH: 5.3,
    targetMashPH: 5.3,
    brewLog: { mashPHActual:"", preboilVolActual:"", preboilGravActual:"", postboilVolActual:"", ogActual:"", fermVolActual:"" },
    brewDay: { strikeTemp:68, mashRest:64, mashStep:72, mashOut:76 },
    fermentation: { coldCrash:2, carbTarget:2.4, log:[
      {day:0,date:"",gravity:"",temp:"",note:""},
      {day:1,date:"",gravity:"",temp:"",note:""},
      {day:2,date:"",gravity:"",temp:"",note:""},
      {day:3,date:"",gravity:"",temp:"",note:""},
      {day:4,date:"",gravity:"",temp:"",note:""},
      {day:5,date:"",gravity:"",temp:"",note:""},
      {day:6,date:"",gravity:"",temp:"",note:""},
      {day:7,date:"",gravity:"",temp:"",note:""},
      {day:9,date:"",gravity:"",temp:"",note:""},
      {day:11,date:"",gravity:"",temp:"",note:""},
      {day:14,date:"",gravity:"",temp:"",note:""}
    ]},
    prices: {
      ferm: Object.fromEntries(Object.entries(FERMENTABLE_PRICES).map(([k,v])=>[k,v[0]])),
      hop: Object.fromEntries(Object.entries(HOP_PRICES).map(([k,v])=>[k,v[0]])),
      yeastDry: YEAST_PRICES.Dry[0],
      yeastLiquid: YEAST_PRICES.Liquid[0],
      dme: DME_PRICE_PER_KG[0],
      salt: Object.fromEntries(Object.entries(SALT_PRICES).map(([k,v])=>[k,v[0]]))
    }
  };
}

let STATE = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const def = defaultState();
    return deepMerge(def, parsed);
  }catch(e){
    console.warn("Could not load saved state, using defaults.", e);
    return defaultState();
  }
}
function deepMerge(base, override){
  if(Array.isArray(base)) return override !== undefined ? override : base;
  if(typeof base === "object" && base !== null){
    const out = {};
    for(const k of Object.keys(base)){
      out[k] = deepMerge(base[k], override ? override[k] : undefined);
    }
    return out;
  }
  return override !== undefined ? override : base;
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  if(typeof syncStateToCloud === "function") syncStateToCloud();
}
function resetState(){
  if(confirm("Reset everything to default recipe, prices and process settings? Your brew logs and custom prices will be lost.")){
    STATE = defaultState();
    saveState();
    renderAll();
  }
}

function getAllRecipes(){
  return RECIPES.concat(STATE.myRecipes || []);
}
function getRecipe(){
  return getAllRecipes().find(r => r.id === STATE.recipeId) || RECIPES[0];
}
function isCustomRecipe(id){
  return (STATE.myRecipes||[]).some(r=>r.id===id);
}
function uid(prefix){
  return prefix + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function saveRecipeToLibrary(rec){
  if(!rec.id) rec.id = uid("custom");
  const idx = (STATE.myRecipes||[]).findIndex(r=>r.id===rec.id);
  if(idx>=0) STATE.myRecipes[idx] = rec;
  else STATE.myRecipes.push(rec);
  saveState();
  return rec.id;
}
function deleteRecipeFromLibrary(id){
  STATE.myRecipes = (STATE.myRecipes||[]).filter(r=>r.id!==id);
  if(STATE.recipeId === id) STATE.recipeId = RECIPES[0].id;
  saveState();
}
function cloneRecipe(rec){
  const copy = JSON.parse(JSON.stringify(rec));
  copy.id = uid("custom");
  copy.name = rec.name + " (copy)";
  return copy;
}
function blankRecipe(){
  return {
    id: null, name: "", style: "", baseBatch: STATE.batchSize || 40,
    og: 1.050, fg: 1.010, abv: 5.0, ibu: 30,
    yeast: "US-05", yeastForm: "Dry", atten: 0.78, tempLo: 18, tempHi: 20,
    desc: "",
    ferm: [["Pale Ale Malt", 8.0, 300, "Base malt"]],
    hops: [["Cascade", 20, 7.5, "Boil", 60, ""]],
    water: Object.assign({}, SOURCE_WATER_DEFAULTS)
  };
}

/* ---------------- Formatting helpers ---------------- */
function fmt(n, d=1){ if(n===null||n===undefined||isNaN(n)) return "-"; return Number(n).toFixed(d); }
function money(n){ if(n===null||n===undefined||isNaN(n)) return "-"; return "$" + Number(n).toFixed(2); }

/* ---------------- Calculation engine ---------------- */

function calcFermentables(){
  const rec = getRecipe();
  const scale = STATE.batchSize / rec.baseBatch;
  const rows = rec.ferm.map(f => {
    const [name, baseKg, extract, notes] = f;
    const scaledKg = baseKg * scale;
    const gravityContribution = scaledKg * extract * STATE.efficiency / STATE.batchSize;
    return { name, baseKg, scaledKg, extract, notes, gravityContribution };
  });
  const totalGrain = rows.reduce((s,r)=>s+r.scaledKg,0);
  const gravitySum = rows.reduce((s,r)=>s+r.gravityContribution,0);
  const og = 1 + gravitySum/1000;
  const fg = 1 + (og-1)*(1-rec.atten);
  const abv = (og-fg)*131.25;
  const strikeWater = totalGrain * STATE.mashThickness;
  const grainAbsorptionL = totalGrain * STATE.grainAbsorption;
  const preboil = STATE.batchSize + STATE.kettleLoss + (STATE.boilOff * STATE.boilMin/60);
  const spargeWater = Math.max(0, preboil - strikeWater + grainAbsorptionL);
  const totalLiquor = strikeWater + spargeWater;
  return { rec, scale, rows, totalGrain, gravitySum, og, fg, abv, strikeWater, grainAbsorptionL, preboil, spargeWater, totalLiquor };
}

function tinsethUtil(timeMin, og){
  return 1.65 * Math.pow(0.000125, og-1) * (1-Math.exp(-0.04*timeMin)) / 4.15;
}

function calcHops(fermResult){
  const rec = fermResult.rec;
  const scale = fermResult.scale;
  const boilVolume = fermResult.preboil;
  const rows = rec.hops.map(h => {
    const [name, baseG, aa, stage, time, dryDay] = h;
    const scaledG = baseG * scale;
    let utilFactor = 0;
    if(stage === "Boil") utilFactor = 1;
    else if(stage === "Whirlpool") utilFactor = STATE.whirlpoolUtil;
    let ibu = 0;
    if(stage !== "Dry Hop"){
      ibu = (scaledG * (aa/100) * 1000 * tinsethUtil(time, fermResult.og) * utilFactor) / boilVolume;
    }
    return { name, baseG, scaledG, aa, stage, time, dryDay, utilFactor, ibu };
  });
  const totalHops = rows.reduce((s,r)=>s+r.scaledG,0);
  const hotSideTotal = rows.filter(r=>r.stage!=="Dry Hop").reduce((s,r)=>s+r.scaledG,0);
  const dryHopTotal = rows.filter(r=>r.stage==="Dry Hop").reduce((s,r)=>s+r.scaledG,0);
  const totalIBU = rows.reduce((s,r)=>s+r.ibu,0);
  const ibuGuRatio = totalIBU / ((fermResult.og-1)*1000);
  return { rows, totalHops, hotSideTotal, dryHopTotal, totalIBU, ibuGuRatio, boilVolume };
}

function calcWater(fermResult){
  const rec = fermResult.rec;
  const totalLiquor = fermResult.totalLiquor || 1;
  const ionsAfter = {};
  const ionsTarget = rec.water;
  WATER_IONS.forEach(ion => {
    let ppmAdded = 0;
    Object.entries(STATE.saltGrams).forEach(([saltName, grams]) => {
      const contrib = SALT_PPM_PER_GRAM[saltName] ? SALT_PPM_PER_GRAM[saltName][ion] : undefined;
      if(contrib) ppmAdded += grams * contrib / totalLiquor;
    });
    ionsAfter[ion] = STATE.sourceWater[ion] + ppmAdded;
  });
  const alkAfterForAcid = ionsAfter["Alkalinity"];
  const lacticAcidML = Math.max(0, (alkAfterForAcid - 10) * totalLiquor/50000 * 90.08/(1.206*0.88));
  return { ionsAfter, ionsTarget, totalLiquor, lacticAcidML };
}

function yeastPacksNeeded(rec, fermResult){
  if(rec.yeastForm === "Dry"){
    const perPack = fermResult.og > 1.055 ? 15 : 20;
    return Math.ceil(STATE.batchSize / perPack);
  } else {
    return (fermResult.og > 1.07 || STATE.batchSize > 45) ? 2 : 1;
  }
}

function calcCost(fermResult, hopResult, waterResult){
  const rec = fermResult.rec;
  const fermLines = fermResult.rows.map(r => {
    const price = STATE.prices.ferm[r.name];
    const cost = (price!==undefined) ? price * r.scaledKg : null;
    return { name:r.name, amount:r.scaledKg, unit:"kg", price, cost };
  });
  const fermSubtotal = fermLines.reduce((s,l)=>s+(l.cost||0),0);

  const hopLines = hopResult.rows.map(r => {
    const price = STATE.prices.hop[r.name];
    const cost = (price!==undefined) ? price * r.scaledG : null;
    return { name:r.name, amount:r.scaledG, unit:"g", price, cost };
  });
  const hopSubtotal = hopLines.reduce((s,l)=>s+(l.cost||0),0);

  const packs = yeastPacksNeeded(rec, fermResult);
  const yeastUnitPrice = rec.yeastForm === "Dry" ? STATE.prices.yeastDry : STATE.prices.yeastLiquid;
  const yeastCost = packs * yeastUnitPrice;
  const starterDmeCost = rec.yeastForm === "Liquid" ? 0.3 * STATE.prices.dme : 0;
  const yeastSubtotal = yeastCost + starterDmeCost;

  const saltLines = Object.entries(STATE.saltGrams).map(([name, grams]) => {
    const price = STATE.prices.salt[name];
    const cost = grams * price;
    return { name, amount:grams, unit:"g", price, cost };
  });
  const lacticCost = waterResult.lacticAcidML * STATE.prices.salt["Lactic Acid 88%"];
  const campdenCount = Math.ceil(STATE.batchSize/20);
  const campdenCost = campdenCount * STATE.prices.salt["Campden Tablets"];
  const saltSubtotal = saltLines.reduce((s,l)=>s+l.cost,0) + lacticCost + campdenCost;

  const grandTotal = fermSubtotal + hopSubtotal + yeastSubtotal + saltSubtotal;
  const perLitre = grandTotal / STATE.batchSize;

  return {
    fermLines, fermSubtotal, hopLines, hopSubtotal,
    packs, yeastUnitPrice, yeastCost, starterDmeCost, yeastSubtotal,
    saltLines, lacticCost, campdenCount, campdenCost, saltSubtotal,
    grandTotal, perLitre
  };
}

function computeAll(){
  const ferm = calcFermentables();
  const hops = calcHops(ferm);
  const water = calcWater(ferm);
  const cost = calcCost(ferm, hops, water);
  return { ferm, hops, water, cost };
}

/* ---------------- Generic state binding helpers ---------------- */
function getPath(obj, path){
  return path.split(".").reduce((o,k)=> (o===undefined||o===null)?undefined:o[k], obj);
}
function setPath(obj, path, value){
  const keys = path.split(".");
  let cur = obj;
  for(let i=0;i<keys.length-1;i++){
    cur = cur[keys[i]];
  }
  cur[keys[keys.length-1]] = value;
}
function bindInputs(container){
  container.querySelectorAll("[data-path]").forEach(el => {
    el.addEventListener("change", e => {
      const path = el.getAttribute("data-path");
      let val = el.value;
      if(el.type === "number") val = val === "" ? "" : parseFloat(val);
      if(el.getAttribute("data-percent") === "1" && val !== "") val = val/100;
      setPath(STATE, path, val);
      saveState();
      renderActiveTab();
    });
  });
}
function pctInputValue(v){ return (v*100); }

/* ---------------- Tabs ---------------- */
const TABS = [
  {id:"dashboard", label:"Dashboard", render: renderDashboard},
  {id:"library", label:"Recipe Library", render: renderLibrary},
  {id:"create", label:"Create a Brew", render: renderCreateBrew},
  {id:"findbrew", label:"Find a Brew", render: renderFindBrew},
  {id:"fermentables", label:"Fermentables", render: renderFermentables},
  {id:"hops", label:"Hops", render: renderHops},
  {id:"water", label:"Water", render: renderWater},
  {id:"brewday", label:"Brew Day", render: renderBrewDay},
  {id:"fermentation", label:"Fermentation", render: renderFermentation},
  {id:"cost", label:"Cost", render: renderCost},
  {id:"find", label:"Find Ingredients", render: renderFindIngredients},
  {id:"findsupplier", label:"Find a Supplier", render: renderFindSupplier},
  {id:"account", label:"Account & Sync", render: renderAccount},
  {id:"readme", label:"Read Me", render: renderReadMe}
];
let ACTIVE_TAB = "dashboard";

function buildNav(){
  const nav = document.getElementById("tabNav");
  nav.innerHTML = TABS.map(t => `<button data-tab="${t.id}" class="${t.id===ACTIVE_TAB?'active':''}">${t.label}</button>`).join("");
  nav.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      ACTIVE_TAB = btn.getAttribute("data-tab");
      buildNav();
      renderActiveTab();
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });
}
function renderActiveTab(){
  const tab = TABS.find(t=>t.id===ACTIVE_TAB);
  const main = document.getElementById("mainContent");
  main.innerHTML = `<section class="view active"></section>`;
  const section = main.querySelector("section");
  tab.render(section);
  bindInputs(section);
}
function renderAll(){ buildNav(); renderActiveTab(); }

/* ---------------- DASHBOARD ---------------- */
function renderDashboard(container){
  const rec = getRecipe();
  const data = computeAll();
  const grainOK = data.ferm.totalGrain <= 13;
  const boilOK = data.ferm.preboil <= 47;
  container.innerHTML = `
    <h2 class="section-title">Choose your brew</h2>
    <div class="panel">
      <div class="field-row">
        <div class="field">
          <label>Recipe</label>
          <select id="recipeSelect">
            <optgroup label="Recipe Library">
            ${RECIPES.map(r=>`<option value="${r.id}" ${r.id===STATE.recipeId?'selected':''}>${r.name}</option>`).join("")}
            </optgroup>
            ${(STATE.myRecipes||[]).length ? `<optgroup label="My Recipes">${STATE.myRecipes.map(r=>`<option value="${r.id}" ${r.id===STATE.recipeId?'selected':''}>${r.name}</option>`).join("")}</optgroup>` : ""}
          </select>
        </div>
        <div class="field">
          <label>Target batch into fermenter (L)</label>
          <input type="number" step="0.5" data-path="batchSize" value="${STATE.batchSize}">
        </div>
        <div class="field">
          <label>Style</label>
          <span class="calc-value">${rec.style}</span>
        </div>
        <div class="field">
          <label>Base recipe batch (L)</label>
          <span class="calc-value">${fmt(rec.baseBatch,1)}</span>
        </div>
        <div class="field">
          <label>Scale factor</label>
          <span class="calc-value">${fmt(STATE.batchSize/rec.baseBatch,2)}x</span>
        </div>
      </div>
      <p class="desc">${rec.desc}</p>
    </div>

    <h2 class="section-title">Live recipe summary</h2>
    <div class="panel">
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Estimated OG</div><div class="value">${fmt(data.ferm.og,3)}</div></div>
        <div class="summary-card"><div class="label">Estimated FG</div><div class="value">${fmt(data.ferm.fg,3)}</div></div>
        <div class="summary-card"><div class="label">Estimated ABV</div><div class="value">${fmt(data.ferm.abv,1)}%</div></div>
        <div class="summary-card"><div class="label">Estimated IBU</div><div class="value">${fmt(data.hops.totalIBU,0)}</div></div>
        <div class="summary-card"><div class="label">Total grain</div><div class="value">${fmt(data.ferm.totalGrain,2)} kg</div></div>
        <div class="summary-card"><div class="label">Total liquor needed</div><div class="value">${fmt(data.ferm.totalLiquor,1)} L</div></div>
        <div class="summary-card"><div class="label">Total hops</div><div class="value">${fmt(data.hops.totalHops,0)} g</div></div>
        <div class="summary-card"><div class="label">Ingredient cost</div><div class="value">${money(data.cost.grandTotal)}</div></div>
        <div class="summary-card"><div class="label">Cost per litre</div><div class="value">${money(data.cost.perLitre)}</div></div>
      </div>
    </div>

    <h2 class="section-title">Guten 50L capacity check</h2>
    <div class="panel">
      <p>Grain fits mash tun (max ~13kg)? <span class="${grainOK?'badge-ok':'badge-warn'}">${grainOK?'OK':'TOO MUCH GRAIN'}</span></p>
      <p>Pre-boil volume fits 50L kettle (max ~47L)? <span class="${boilOK?'badge-ok':'badge-warn'}">${boilOK?'OK':'TOO MUCH LIQUID'}</span></p>
    </div>

    <h2 class="section-title">Quick start</h2>
    <div class="panel">
      <ol>
        <li>Pick a recipe and set your batch size above.</li>
        <li>Fermentables and Hops scale every ingredient automatically.</li>
        <li>Water balances Floraville tap water for the selected style.</li>
        <li>Brew Day and Fermentation are your live brew log for the Guten 50L.</li>
        <li>Cost totals ingredient cost from Brewman pricing, tweak any price any time.</li>
        <li>Find Ingredients compares prices for items Brewman does not stock.</li>
        <li>Sign in on Account & Sync to back everything up to the cloud.</li>
      </ol>
      <button class="btn btn-outline" id="resetBtn">Reset to defaults</button>
    </div>
  `;
  container.querySelector("#recipeSelect").addEventListener("change", e=>{
    STATE.recipeId = e.target.value;
    saveState();
    renderActiveTab();
  });
  container.querySelector("#resetBtn").addEventListener("click", resetState);
}

/* ---------------- RECIPE LIBRARY ---------------- */
function renderLibrary(container){
  container.innerHTML = `
    <h2 class="section-title">Recipe Library</h2>
    <div class="panel">
      <div class="field-row" style="justify-content:space-between; align-items:flex-end;">
        <div class="field" style="min-width:280px;">
          <label>Search by name, style or hop</label>
          <input type="text" id="librarySearch" placeholder="e.g. hazy, IPA, Mosaic...">
        </div>
        <div class="field-row" style="gap:8px;">
          <button class="btn" id="goCreateBtn">+ Create a Brew</button>
          <button class="btn btn-outline" id="exportAllBtn">Export my recipes</button>
          <button class="btn btn-outline" id="importAllBtn">Import recipes</button>
          <input type="file" id="importAllFile" accept=".json" style="display:none">
        </div>
      </div>
      <div id="libraryCards"></div>
    </div>
    <div class="note">Want a recipe that isn't here yet? Use <strong>Find a Brew</strong> to search or generate one, or <strong>Create a Brew</strong> to build it from scratch.</div>
  `;
  const cardsEl = container.querySelector("#libraryCards");
  function renderCards(filter){
    const f = (filter||"").toLowerCase();
    const all = getAllRecipes().map(r=>({rec:r, custom:isCustomRecipe(r.id)}));
    const matches = all.filter(({rec:r})=>{
      if(!f) return true;
      const hopNames = r.hops.map(h=>h[0].toLowerCase()).join(" ");
      return r.name.toLowerCase().includes(f) || r.style.toLowerCase().includes(f) || hopNames.includes(f);
    });
    cardsEl.innerHTML = matches.map(({rec:r, custom})=>`
      <div class="panel" style="margin-bottom:12px;">
        <div class="field-row" style="justify-content:space-between; align-items:center;">
          <div>
            <strong style="font-size:1.05rem; color:var(--navy);">${r.name}</strong>
            <span class="note-grey"> &mdash; ${r.style}</span>
            ${custom?'<span class="badge-ok" style="margin-left:8px;">My recipe</span>':''}
          </div>
          <div class="field-row" style="gap:6px;">
            <button class="btn" data-select="${r.id}">${r.id===STATE.recipeId? 'Currently selected':'Brew this one'}</button>
            <button class="btn btn-outline" data-duplicate="${r.id}">Duplicate</button>
            ${custom?`<button class="btn btn-outline" data-edit="${r.id}">Edit</button><button class="btn btn-outline" data-delete="${r.id}" style="color:#b00020; border-color:#b00020;">Delete</button>`:''}
          </div>
        </div>
        <p class="desc">${r.desc}</p>
        <div class="summary-grid">
          <div class="summary-card"><div class="label">Base batch</div><div class="value">${r.baseBatch} L</div></div>
          <div class="summary-card"><div class="label">OG / FG</div><div class="value">${r.og} / ${r.fg}</div></div>
          <div class="summary-card"><div class="label">ABV</div><div class="value">${r.abv}%</div></div>
          <div class="summary-card"><div class="label">IBU</div><div class="value">${r.ibu}</div></div>
          <div class="summary-card"><div class="label">Yeast</div><div class="value" style="font-size:1rem;">${r.yeast}</div></div>
        </div>
        <p class="note-grey" style="margin-top:8px;">Hops: ${[...new Set(r.hops.map(h=>h[0]))].join(", ")}</p>
      </div>
    `).join("") || `<p class="note-grey">No recipes match that search.</p>`;
    cardsEl.querySelectorAll("[data-select]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        STATE.recipeId = btn.getAttribute("data-select");
        saveState();
        renderCards(container.querySelector("#librarySearch").value);
      });
    });
    cardsEl.querySelectorAll("[data-duplicate]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const src = getAllRecipes().find(r=>r.id===btn.getAttribute("data-duplicate"));
        const copy = cloneRecipe(src);
        saveRecipeToLibrary(copy);
        STATE.recipeId = copy.id;
        saveState();
        renderCards(container.querySelector("#librarySearch").value);
      });
    });
    cardsEl.querySelectorAll("[data-edit]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        STATE.draftRecipe = JSON.parse(JSON.stringify(getAllRecipes().find(r=>r.id===btn.getAttribute("data-edit"))));
        saveState();
        ACTIVE_TAB = "create"; buildNav(); renderActiveTab();
      });
    });
    cardsEl.querySelectorAll("[data-delete]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if(confirm("Delete this recipe permanently from My Recipes?")){
          deleteRecipeFromLibrary(btn.getAttribute("data-delete"));
          renderCards(container.querySelector("#librarySearch").value);
        }
      });
    });
  }
  renderCards("");
  container.querySelector("#librarySearch").addEventListener("input", e=>renderCards(e.target.value));
  container.querySelector("#goCreateBtn").addEventListener("click", ()=>{
    STATE.draftRecipe = blankRecipe();
    saveState();
    ACTIVE_TAB = "create"; buildNav(); renderActiveTab();
  });
  container.querySelector("#exportAllBtn").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(STATE.myRecipes||[], null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-brew-recipes-backup.json";
    a.click();
  });
  const fileInput = container.querySelector("#importAllFile");
  container.querySelector("#importAllBtn").addEventListener("click", ()=>fileInput.click());
  fileInput.addEventListener("change", ()=>{
    const file = fileInput.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const imported = JSON.parse(reader.result);
        const list = Array.isArray(imported) ? imported : [imported];
        list.forEach(r=>{ r.id = uid("custom"); saveRecipeToLibrary(r); });
        alert(`Imported ${list.length} recipe(s) into My Recipes.`);
        renderCards(container.querySelector("#librarySearch").value);
      }catch(e){ alert("Could not read that file, make sure it's a recipe JSON exported from this app."); }
    };
    reader.readAsText(file);
  });
}

/* ---------------- FERMENTABLES ---------------- */
function renderFermentables(container){
  const data = calcFermentables();
  container.innerHTML = `
    <h2 class="section-title">Fermentables Calculator</h2>
    <div class="panel">
      <p>Recipe: <span class="calc-value">${data.rec.name}</span> &nbsp; Batch size: <span class="calc-value">${fmt(STATE.batchSize,1)} L</span> &nbsp; Scale factor: <span class="calc-value">${fmt(data.scale,2)}x</span></p>
    </div>

    <h2 class="section-title">Process assumptions</h2>
    <div class="panel">
      <div class="field-row">
        <div class="field"><label>Brewhouse efficiency (%)</label><input type="number" step="1" data-path="efficiency" data-percent="1" value="${fmt(pctInputValue(STATE.efficiency),0)}"></div>
        <div class="field"><label>Boil length (min)</label><input type="number" step="5" data-path="boilMin" value="${STATE.boilMin}"></div>
        <div class="field"><label>Boil-off rate (L/hr)</label><input type="number" step="0.5" data-path="boilOff" value="${STATE.boilOff}"></div>
        <div class="field"><label>Kettle and trub loss (L)</label><input type="number" step="0.5" data-path="kettleLoss" value="${STATE.kettleLoss}"></div>
        <div class="field"><label>Grain absorption (L/kg)</label><input type="number" step="0.05" data-path="grainAbsorption" value="${STATE.grainAbsorption}"></div>
        <div class="field"><label>Mash thickness (L/kg)</label><input type="number" step="0.1" data-path="mashThickness" value="${STATE.mashThickness}"></div>
      </div>
    </div>

    <h2 class="section-title">Grain bill (scaled to your batch size)</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Ingredient</th><th>Base (kg) @ recipe batch</th><th>Scaled (kg)</th><th>Extract potential</th><th>Notes</th><th>Gravity contribution</th></tr></thead>
        <tbody>
          ${data.rows.map(r=>`<tr><td>${r.name}</td><td>${fmt(r.baseKg,2)}</td><td>${fmt(r.scaledKg,2)}</td><td>${r.extract}</td><td class="note-grey">${r.notes}</td><td>${fmt(r.gravityContribution,1)}</td></tr>`).join("")}
          <tr class="total-row"><td>Total</td><td></td><td>${fmt(data.totalGrain,2)}</td><td></td><td></td><td>${fmt(data.gravitySum,1)}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Calculated targets</h2>
    <div class="panel">
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Estimated OG</div><div class="value">${fmt(data.og,3)}</div></div>
        <div class="summary-card"><div class="label">Target OG</div><div class="value">${fmt(data.rec.og,3)}</div></div>
        <div class="summary-card"><div class="label">Yeast attenuation</div><div class="value">${fmt(data.rec.atten*100,0)}%</div></div>
        <div class="summary-card"><div class="label">Estimated FG</div><div class="value">${fmt(data.fg,3)}</div></div>
        <div class="summary-card"><div class="label">Target FG</div><div class="value">${fmt(data.rec.fg,3)}</div></div>
        <div class="summary-card"><div class="label">Estimated ABV</div><div class="value">${fmt(data.abv,1)}%</div></div>
        <div class="summary-card"><div class="label">Target ABV</div><div class="value">${fmt(data.rec.abv,1)}%</div></div>
        <div class="summary-card"><div class="label">Total grain</div><div class="value">${fmt(data.totalGrain,2)} kg</div></div>
        <div class="summary-card"><div class="label">Strike water</div><div class="value">${fmt(data.strikeWater,1)} L</div></div>
        <div class="summary-card"><div class="label">Grain absorption</div><div class="value">${fmt(data.grainAbsorptionL,1)} L</div></div>
        <div class="summary-card"><div class="label">Pre-boil volume</div><div class="value">${fmt(data.preboil,1)} L</div></div>
        <div class="summary-card"><div class="label">Sparge water</div><div class="value">${fmt(data.spargeWater,1)} L</div></div>
        <div class="summary-card"><div class="label">Total liquor required</div><div class="value">${fmt(data.totalLiquor,1)} L</div></div>
      </div>
    </div>
  `;
}

/* ---------------- HOPS ---------------- */
function renderHops(container){
  const ferm = calcFermentables();
  const data = calcHops(ferm);
  container.innerHTML = `
    <h2 class="section-title">Hop Calculator</h2>
    <div class="panel">
      <p class="desc">Tinseth bittering estimate. Whirlpool utilisation is deliberately editable, your system geometry and stand time change real-world extraction.</p>
      <div class="field-row">
        <div class="field"><label>Recipe</label><span class="calc-value">${ferm.rec.name}</span></div>
        <div class="field"><label>Boil volume (from Fermentables)</label><span class="calc-value">${fmt(data.boilVolume,1)} L</span></div>
        <div class="field"><label>OG for Tinseth (from Fermentables)</label><span class="calc-value">${fmt(ferm.og,3)}</span></div>
        <div class="field"><label>Whirlpool utilisation factor</label><input type="number" step="0.05" data-path="whirlpoolUtil" value="${STATE.whirlpoolUtil}"></div>
      </div>
      <p class="note-grey">Whirlpool assumed at approx 80&deg;C for 20 min. Lower the factor if you whirlpool cooler or for a shorter time.</p>
    </div>

    <h2 class="section-title">Hop additions (scaled to your batch size)</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Ingredient</th><th>Base (g)</th><th>Scaled (g)</th><th>Alpha %</th><th>Stage</th><th>Time (min)</th><th>Dry hop day</th><th>Utilisation</th><th>IBU</th></tr></thead>
        <tbody>
          ${data.rows.map(r=>`<tr>
            <td>${r.name}</td><td>${fmt(r.baseG,1)}</td><td>${fmt(r.scaledG,1)}</td><td>${fmt(r.aa,1)}</td>
            <td>${r.stage}</td><td>${r.stage==="Dry Hop"?"-":r.time}</td><td>${r.dryDay||"-"}</td>
            <td>${fmt(r.utilFactor,2)}</td><td>${fmt(r.ibu,1)}</td>
          </tr>`).join("")}
          <tr class="total-row"><td>Total</td><td></td><td>${fmt(data.totalHops,1)}</td><td></td><td></td><td></td><td></td><td></td><td>${fmt(data.totalIBU,1)}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Bitterness summary</h2>
    <div class="panel">
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Hot side hops</div><div class="value">${fmt(data.hotSideTotal,0)} g</div></div>
        <div class="summary-card"><div class="label">Dry hop total</div><div class="value">${fmt(data.dryHopTotal,0)} g</div></div>
        <div class="summary-card"><div class="label">Total IBU</div><div class="value">${fmt(data.totalIBU,1)}</div></div>
        <div class="summary-card"><div class="label">Target IBU</div><div class="value">${ferm.rec.ibu}</div></div>
        <div class="summary-card"><div class="label">IBU / GU ratio</div><div class="value">${fmt(data.ibuGuRatio,2)}</div></div>
      </div>
    </div>
  `;
}

/* ---------------- WATER ---------------- */
function renderWater(container){
  const ferm = calcFermentables();
  const water = calcWater(ferm);
  container.innerHTML = `
    <h2 class="section-title">Floraville Water and Salt Calculator</h2>
    <div class="panel">
      <p class="desc">Starting profile uses Hunter Water published median figures for the Grahamstown / Tomago Sandbeds supply (covers Newcastle including Floraville). Update the blue cells if you have a current test result.</p>
      <div class="field-row">
        <div class="field"><label>Strike water (L)</label><span class="calc-value">${fmt(ferm.strikeWater,1)}</span></div>
        <div class="field"><label>Sparge water (L)</label><span class="calc-value">${fmt(ferm.spargeWater,1)}</span></div>
        <div class="field"><label>Total liquor (L)</label><span class="calc-value">${fmt(ferm.totalLiquor,1)}</span></div>
      </div>
    </div>

    <h2 class="section-title">Source water and target (mg/L, ppm)</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Ion</th><th>Source water</th><th>Target (this recipe)</th><th>After salt additions</th><th>Difference to target</th><th>Comment</th></tr></thead>
        <tbody>
          ${WATER_IONS.map(ion=>{
            const after = water.ionsAfter[ion];
            const target = water.ionsTarget[ion];
            const diff = after - target;
            return `<tr>
              <td>${ion}</td>
              <td><input type="number" step="0.5" style="width:80px" data-path="sourceWater.${ion}" value="${STATE.sourceWater[ion]}"></td>
              <td>${fmt(target,1)}</td>
              <td>${fmt(after,1)}</td>
              <td style="color:${Math.abs(diff)>20?'#b00020':'#2e7d32'}">${diff>0?'+':''}${fmt(diff,1)}</td>
              <td class="note-grey">${WATER_COMMENTS[ion]}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Salt additions (across total liquor) - re-enter these whenever you change recipe or batch size</h2>
    <div class="panel">
      <div class="note-red">Salt grams below are manual inputs, they do not auto-scale when you switch recipe or batch size. Use the Difference column above as your guide and edit grams to suit.</div>
      <table style="margin-top:10px;">
        <thead><tr><th>Addition</th><th>Amount (g)</th><th>Ca</th><th>Mg</th><th>Na</th><th>SO4</th><th>Cl</th></tr></thead>
        <tbody>
          ${Object.keys(SALT_DEFAULT_GRAMS).map(salt=>{
            const grams = STATE.saltGrams[salt];
            const ppm = SALT_PPM_PER_GRAM[salt];
            const cols = ["Calcium","Magnesium","Sodium","Sulphate","Chloride"].map(ion=>{
              const c = ppm[ion] ? (grams*ppm[ion]/water.totalLiquor) : 0;
              return `<td>${fmt(c,1)}</td>`;
            }).join("");
            return `<tr><td>${salt}</td><td><input type="number" step="1" style="width:70px" data-path="saltGrams.${salt}" value="${grams}"></td>${cols}</tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Mash pH and acid additions</h2>
    <div class="panel">
      <div class="field-row">
        <div class="field"><label>Measured mash pH</label><input type="number" step="0.01" data-path="measuredMashPH" value="${STATE.measuredMashPH}"></div>
        <div class="field"><label>Target mash pH</label><input type="number" step="0.01" data-path="targetMashPH" value="${STATE.targetMashPH}"></div>
        <div class="field"><label>88% Lactic acid, indicative (mL)</label><span class="calc-value">${fmt(water.lacticAcidML,2)}</span></div>
      </div>
      <p class="note-grey">This is a starting estimate only. Always measure mash pH 10 to 15 minutes after dough-in with a calibrated pH meter and adjust from there. Treat all brewing water for chlorine/chloramine with Campden before use.</p>
    </div>
  `;
}

/* ---------------- BREW DAY ---------------- */
function renderBrewDay(container){
  const ferm = calcFermentables();
  const grainOK = ferm.totalGrain <= 13;
  const boilOK = ferm.preboil <= 47;
  const bd = STATE.brewDay;
  const bl = STATE.brewLog;
  container.innerHTML = `
    <h2 class="section-title">Guten 50L Brew Day</h2>
    <div class="panel">
      <p>Recipe: <span class="calc-value">${ferm.rec.name}</span> &nbsp; Batch size: <span class="calc-value">${fmt(STATE.batchSize,1)} L</span></p>
    </div>

    <h2 class="section-title">Brew day targets</h2>
    <div class="panel">
      <table>
        <tbody>
          <tr><td>Total grain</td><td>${fmt(ferm.totalGrain,2)} kg</td><td class="note-grey">Confirm it fits comfortably in the Guten mash basket</td></tr>
          <tr><td>Strike water</td><td>${fmt(ferm.strikeWater,1)} L</td><td class="note-grey">Heat before dough-in, account for grain absorbing heat</td></tr>
          <tr><td>Strike temperature</td><td><input type="number" data-path="brewDay.strikeTemp" value="${bd.strikeTemp}" style="width:70px">&deg;C</td><td class="note-grey">Adjust for grain temperature on the day</td></tr>
          <tr><td>Mash rest</td><td><input type="number" data-path="brewDay.mashRest" value="${bd.mashRest}" style="width:70px">&deg;C</td><td class="note-grey">Typical 60 minute rest</td></tr>
          <tr><td>Mash step</td><td><input type="number" data-path="brewDay.mashStep" value="${bd.mashStep}" style="width:70px">&deg;C</td><td class="note-grey">Typical 10 minute rest, skip if single infusion</td></tr>
          <tr><td>Mash out</td><td><input type="number" data-path="brewDay.mashOut" value="${bd.mashOut}" style="width:70px">&deg;C</td><td class="note-grey">10 minutes, helps lauter and locks in fermentability</td></tr>
          <tr><td>Sparge water</td><td>${fmt(ferm.spargeWater,1)} L</td><td class="note-grey">Stop collecting if runnings turn harsh or thin</td></tr>
          <tr><td>Pre-boil volume</td><td>${fmt(ferm.preboil,1)} L</td><td class="note-grey">Measure actual and compare</td></tr>
          <tr><td>Boil length</td><td>${STATE.boilMin} min</td><td></td></tr>
          <tr><td>Post-boil volume</td><td>${fmt(STATE.batchSize+STATE.kettleLoss,1)} L</td><td class="note-grey">Before kettle and trub loss</td></tr>
          <tr><td>Fermenter target</td><td>${fmt(STATE.batchSize,1)} L</td><td></td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Guten 50L capacity check</h2>
    <div class="panel">
      <p>Grain fits mash tun (max ~13 kg)? <span class="${grainOK?'badge-ok':'badge-warn'}">${grainOK?'OK':'TOO MUCH - reduce batch size'}</span></p>
      <p>Pre-boil volume fits 50L kettle (max ~47 L)? <span class="${boilOK?'badge-ok':'badge-warn'}">${boilOK?'OK':'TOO MUCH - reduce batch size'}</span></p>
    </div>

    <h2 class="section-title">Brew log</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Checkpoint</th><th>Target</th><th>Actual</th><th>Variance</th></tr></thead>
        <tbody>
          <tr><td>Mash pH</td><td>${fmt(STATE.targetMashPH,2)}</td><td><input type="number" step="0.01" style="width:80px" data-path="brewLog.mashPHActual" value="${bl.mashPHActual}"></td><td>${bl.mashPHActual!==""?fmt(bl.mashPHActual-STATE.targetMashPH,2):""}</td></tr>
          <tr><td>Pre-boil volume (L)</td><td>${fmt(ferm.preboil,1)}</td><td><input type="number" step="0.1" style="width:80px" data-path="brewLog.preboilVolActual" value="${bl.preboilVolActual}"></td><td>${bl.preboilVolActual!==""?fmt(bl.preboilVolActual-ferm.preboil,1):""}</td></tr>
          <tr><td>Pre-boil gravity</td><td>1.045</td><td><input type="number" step="0.001" style="width:80px" data-path="brewLog.preboilGravActual" value="${bl.preboilGravActual}"></td><td></td></tr>
          <tr><td>Post-boil volume (L)</td><td>${fmt(STATE.batchSize+STATE.kettleLoss,1)}</td><td><input type="number" step="0.1" style="width:80px" data-path="brewLog.postboilVolActual" value="${bl.postboilVolActual}"></td><td>${bl.postboilVolActual!==""?fmt(bl.postboilVolActual-(STATE.batchSize+STATE.kettleLoss),1):""}</td></tr>
          <tr><td>Original gravity</td><td>${fmt(ferm.og,3)}</td><td><input type="number" step="0.001" style="width:80px" data-path="brewLog.ogActual" value="${bl.ogActual}"></td><td>${bl.ogActual!==""?fmt(bl.ogActual-ferm.og,3):""}</td></tr>
          <tr><td>Fermenter volume (L)</td><td>${fmt(STATE.batchSize,1)}</td><td><input type="number" step="0.1" style="width:80px" data-path="brewLog.fermVolActual" value="${bl.fermVolActual}"></td><td>${bl.fermVolActual!==""?fmt(bl.fermVolActual-STATE.batchSize,1):""}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Process checklist</h2>
    <div class="panel">
      <ul class="checklist">
        ${["Treat all brewing water for chlorine / chloramine (Campden)",
           "Mill grain, confirm Guten recirculation is flowing freely",
           "Dough in and mash at the rest temperature above",
           "Step up to the mash step temperature if used",
           "Mash out",
           "Sparge gently to the pre-boil volume",
           "Boil and follow the Hops tab additions in order",
           "Whirlpool, then stand before chilling",
           "Chill to pitch temperature and aerate / oxygenate",
           "Pitch yeast, record actual OG and volume above"].map(s=>`<li><label><input type="checkbox">${s}</label></li>`).join("")}
      </ul>
    </div>
  `;
}

/* ---------------- FERMENTATION ---------------- */
function renderFermentation(container){
  const ferm = calcFermentables();
  const hops = calcHops(ferm);
  const f = STATE.fermentation;
  const dryHopRows = hops.rows.filter(r=>r.stage==="Dry Hop");
  container.innerHTML = `
    <h2 class="section-title">Fermentation and Packaging</h2>
    <div class="panel">
      <p>Recipe: <span class="calc-value">${ferm.rec.name}</span></p>
    </div>

    <h2 class="section-title">Yeast and schedule</h2>
    <div class="panel">
      <table>
        <tbody>
          <tr><td>Yeast</td><td>${ferm.rec.yeast}</td></tr>
          <tr><td>Form</td><td>${ferm.rec.yeastForm}</td></tr>
          <tr><td>Expected attenuation</td><td>${fmt(ferm.rec.atten*100,0)}%</td></tr>
          <tr><td>Pitch / primary temperature</td><td>${ferm.rec.tempLo}&deg;C</td></tr>
          <tr><td>Upper fermentation temperature</td><td>${ferm.rec.tempHi}&deg;C</td></tr>
          <tr><td>Expected final gravity</td><td>${fmt(ferm.fg,3)}</td></tr>
          <tr><td>Cold crash temperature</td><td><input type="number" data-path="fermentation.coldCrash" value="${f.coldCrash}" style="width:70px">&deg;C</td></tr>
          <tr><td>Carbonation target</td><td><input type="number" step="0.1" data-path="fermentation.carbTarget" value="${f.carbTarget}" style="width:70px"> volumes CO2</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Dry hop plan (pulled automatically from Hops)</h2>
    <div class="panel">
      ${dryHopRows.length ? `<table>
        <thead><tr><th>Day / timing</th><th>Ingredient</th><th>Scaled amount (g)</th></tr></thead>
        <tbody>${dryHopRows.map(r=>`<tr><td>${r.dryDay}</td><td>${r.name}</td><td>${fmt(r.scaledG,1)}</td></tr>`).join("")}</tbody>
      </table>` : `<p class="note-grey">This recipe has no dry hop additions.</p>`}
    </div>

    <h2 class="section-title">Fermentation log</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Day</th><th>Date</th><th>Gravity</th><th>Temp (C)</th><th>Action / observation</th></tr></thead>
        <tbody>
          ${f.log.map((entry,i)=>`<tr>
            <td>${entry.day}</td>
            <td><input type="text" style="width:110px" data-path="fermentation.log.${i}.date" value="${entry.date}"></td>
            <td><input type="number" step="0.001" style="width:80px" data-path="fermentation.log.${i}.gravity" value="${entry.gravity}"></td>
            <td><input type="number" step="0.5" style="width:70px" data-path="fermentation.log.${i}.temp" value="${entry.temp}"></td>
            <td><input type="text" style="width:100%" data-path="fermentation.log.${i}.note" value="${entry.note}"></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------------- COST ---------------- */
function renderCost(container){
  const ferm = calcFermentables();
  const hops = calcHops(ferm);
  const water = calcWater(ferm);
  const cost = calcCost(ferm, hops, water);
  const rec = ferm.rec;

  container.innerHTML = `
    <h2 class="section-title">Cost Calculator | Brewman Pricing</h2>
    <div class="panel">
      <p class="desc">Ingredient prices sourced from brewman.com.au where confirmed (<span class="badge-y">Y</span> = verified 8 Sep 2026). <span class="badge-n">N</span> flags are estimates, check the Find Ingredients tab or brewman.com.au before ordering.</p>
      <p>Recipe: <span class="calc-value">${rec.name}</span> &nbsp; Batch size: <span class="calc-value">${fmt(STATE.batchSize,1)} L</span></p>
    </div>

    <h2 class="section-title">This recipe: fermentable cost</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Ingredient</th><th>Scaled amount (kg)</th><th>Price / kg</th><th>Confirmed</th><th>Line cost</th></tr></thead>
        <tbody>
          ${cost.fermLines.map(l=>{
            const meta = FERMENTABLE_PRICES[l.name] || [null,"N",""];
            return `<tr>
              <td>${l.name}</td><td>${fmt(l.amount,2)}</td>
              <td><input type="number" step="0.05" style="width:80px" data-path="prices.ferm.${l.name}" value="${STATE.prices.ferm[l.name]}"></td>
              <td class="${meta[1]==='Y'?'badge-y':'badge-n'}">${meta[1]}</td>
              <td>${money(l.cost)}</td>
            </tr>`;
          }).join("")}
          <tr class="total-row"><td colspan="4">Fermentable subtotal</td><td>${money(cost.fermSubtotal)}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">This recipe: hop and spice cost</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Ingredient</th><th>Scaled amount (g)</th><th>Price / g</th><th>Confirmed</th><th>Line cost</th></tr></thead>
        <tbody>
          ${cost.hopLines.map(l=>{
            const meta = HOP_PRICES[l.name] || [null,"N",""];
            return `<tr>
              <td>${l.name}</td><td>${fmt(l.amount,1)}</td>
              <td><input type="number" step="0.005" style="width:80px" data-path="prices.hop.${l.name}" value="${STATE.prices.hop[l.name]}"></td>
              <td class="${meta[1]==='Y'?'badge-y':'badge-n'}">${meta[1]}</td>
              <td>${money(l.cost)}</td>
            </tr>`;
          }).join("")}
          <tr class="total-row"><td colspan="4">Hop subtotal</td><td>${money(cost.hopSubtotal)}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">This recipe: yeast cost</h2>
    <div class="panel">
      <table>
        <tbody>
          <tr><td>Yeast form</td><td>${rec.yeastForm}</td></tr>
          <tr><td>Packs needed</td><td>${cost.packs}</td></tr>
          <tr><td>Price per pack</td><td><input type="number" step="0.5" style="width:80px" data-path="prices.${rec.yeastForm==='Dry'?'yeastDry':'yeastLiquid'}" value="${rec.yeastForm==='Dry'?STATE.prices.yeastDry:STATE.prices.yeastLiquid}"></td></tr>
          <tr><td>Starter DME (0.3kg, liquid yeast only)</td><td>${money(cost.starterDmeCost)}</td></tr>
          <tr class="total-row"><td>Yeast subtotal</td><td>${money(cost.yeastSubtotal)}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">This recipe: water salts and treatment cost</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Item</th><th>Amount</th><th>Price</th><th>Line cost</th></tr></thead>
        <tbody>
          ${cost.saltLines.map(l=>`<tr>
            <td>${l.name}</td><td>${fmt(l.amount,1)} g</td>
            <td><input type="number" step="0.001" style="width:80px" data-path="prices.salt.${l.name}" value="${STATE.prices.salt[l.name]}"></td>
            <td>${money(l.cost)}</td>
          </tr>`).join("")}
          <tr><td>Lactic acid 88%</td><td>${fmt(water.lacticAcidML,1)} mL</td><td><input type="number" step="0.001" style="width:80px" data-path="prices.salt.Lactic Acid 88%" value="${STATE.prices.salt["Lactic Acid 88%"]}"></td><td>${money(cost.lacticCost)}</td></tr>
          <tr><td>Campden tablets (1 per ~20L)</td><td>${cost.campdenCount} each</td><td><input type="number" step="0.01" style="width:80px" data-path="prices.salt.Campden Tablets" value="${STATE.prices.salt["Campden Tablets"]}"></td><td>${money(cost.campdenCost)}</td></tr>
          <tr class="total-row"><td colspan="3">Water treatment subtotal</td><td>${money(cost.saltSubtotal)}</td></tr>
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Total cost summary</h2>
    <div class="panel">
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Total ingredient cost</div><div class="value">${money(cost.grandTotal)}</div></div>
        <div class="summary-card"><div class="label">Cost per litre</div><div class="value">${money(cost.perLitre)}</div></div>
        <div class="summary-card"><div class="label">Cost per 375mL stubby</div><div class="value">${money(cost.perLitre*0.375)}</div></div>
        <div class="summary-card"><div class="label">Cost per 700mL bottle</div><div class="value">${money(cost.perLitre*0.7)}</div></div>
        <div class="summary-card"><div class="label">Cost per 19L keg</div><div class="value">${money(cost.perLitre*19)}</div></div>
      </div>
      <p class="note-grey" style="margin-top:12px;">Delivery and milling: Brewman offers grain milling and delivery, current rates were not confirmed for this build. Check the cart at brewman.com.au before checkout, or ask in-store at Brandy Hill. Noble Barons in Newcastle is a closer pickup option with local delivery from about $10.</p>
    </div>
  `;
}

/* ---------------- FIND INGREDIENTS ---------------- */
function renderFindIngredients(container){
  container.innerHTML = `
    <h2 class="section-title">Find Ingredients | Price Comparison</h2>
    <div class="panel">
      <p class="desc">This is a manually researched snapshot (8 Sep 2026), a static webpage can't auto-refresh live prices. Use it to compare Brewman against other suppliers before you order, and as the reference point for updating the Cost tab.</p>
    </div>

    <h2 class="section-title">Hops: Brewman vs KegLand</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Hop</th><th>Brewman ($/g)</th><th>KegLand 25g ($/g)</th><th>KegLand 500g ($/g)</th><th>Cheapest</th></tr></thead>
        <tbody>
          ${HOP_COMPARISON.map(([name,bp,k25,k500])=>{
            const options = [["Brewman",bp]];
            if(k25) options.push(["KegLand 25g",k25]);
            if(k500) options.push(["KegLand 500g",k500]);
            const cheapest = options.reduce((a,b)=>b[1]<a[1]?b:a);
            return `<tr>
              <td>${name}</td><td>${money(bp)}</td>
              <td>${k25?money(k25):'n/a'}</td><td>${k500?money(k500):'n/a'}</td>
              <td><strong>${cheapest[0]} (${money(cheapest[1])}/g)</strong></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="note-grey" style="margin-top:10px;">For a typical 250 to 500g hop order, KegLand bulk (500g) packs usually beat Brewman on price per gram, but Brewman is local to the Hunter for pickup and stocks everything in one place. Weigh up delivery cost and convenience as well as unit price.</p>
    </div>

    <h2 class="section-title">Yeast: Brewman vs KegLand</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Yeast</th><th>Brewman</th><th>KegLand</th><th>Cheapest</th></tr></thead>
        <tbody>
          ${YEAST_COMPARISON.map(([name,bp,kp])=>`<tr><td>${name}</td><td>${money(bp)}</td><td>${money(kp)}</td><td><strong>${kp<bp?'KegLand':'Brewman'}</strong></td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Specialty items not confirmed at Brewman or KegLand</h2>
    <div class="panel">
      ${SPECIALTY_ITEMS.map(([item,used,where,note])=>`
        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #eee;">
          <strong style="color:var(--navy);">${item}</strong> <span class="note-grey">(${used})</span>
          <p style="margin:4px 0;">Check: ${where}</p>
          <p class="note-grey">${note}</p>
        </div>`).join("")}
    </div>

    <h2 class="section-title">Keeping this page current</h2>
    <div class="panel">
      <ul>
        <li>This is a static site, it cannot connect to the internet or refresh prices by itself.</li>
        <li>To update a price: search the ingredient on the supplier website, then edit the value directly in <code>js/data.js</code>, or just type the new number into the Cost tab (it will remember it in your browser, and sync to the cloud if you're signed in).</li>
        <li>Brewman: <a href="https://brewman.com.au" target="_blank">brewman.com.au</a> &nbsp;|&nbsp; KegLand: <a href="https://kegland.com.au" target="_blank">kegland.com.au</a> &nbsp;|&nbsp; Grain &amp; Grape: <a href="https://graingrape.com.au" target="_blank">graingrape.com.au</a> &nbsp;|&nbsp; Craftbrewer: <a href="https://craftbrewer.com.au" target="_blank">craftbrewer.com.au</a> &nbsp;|&nbsp; Noble Barons (Newcastle pickup): <a href="https://noblebarons.com.au" target="_blank">noblebarons.com.au</a></li>
      </ul>
    </div>
  `;
}

/* ---------------- CREATE A BREW ---------------- */
function draftCalc(draft){
  const eff = 0.75;
  const rows = draft.ferm.map(f=>{
    const [name, kg, extract] = f;
    return { name, kg, extract, gravity: (kg||0)*(extract||0)*eff/(draft.baseBatch||1) };
  });
  const gravitySum = rows.reduce((s,r)=>s+r.gravity,0);
  const og = 1 + gravitySum/1000;
  const atten = draft.atten || 0.78;
  const fg = 1 + (og-1)*(1-atten);
  const abv = (og-fg)*131.25;
  const boilVol = (draft.baseBatch||40) + 3 + 4;
  const totalGrain = rows.reduce((s,r)=>s+(r.kg||0),0);
  let ibu = 0;
  draft.hops.forEach(h=>{
    const [name, g, aa, stage, time] = h;
    if(stage==="Dry Hop") return;
    const util = stage==="Whirlpool" ? 0.35 : 1;
    ibu += ((g||0)*((aa||0)/100)*1000*tinsethUtil(time||0, og)*util)/boilVol;
  });
  return { og, fg, abv, ibu, totalGrain };
}

function renderCreateBrew(container){
  if(!STATE.draftRecipe) STATE.draftRecipe = blankRecipe();
  const d = STATE.draftRecipe;
  const preview = draftCalc(d);
  const isEditingExisting = !!d.id;

  container.innerHTML = `
    <h2 class="section-title">Create a Brew</h2>
    <div class="panel">
      <p class="desc">Build a recipe from scratch. Everything scales automatically once it's saved, just like the built-in library. Fill in fermentables and hops at your <strong>base batch size</strong>, the app handles scaling from there.</p>
      <div class="field-row">
        <div class="field" style="min-width:260px;"><label>Recipe name</label><input type="text" id="d_name" value="${d.name||''}" placeholder="e.g. Dan's Backyard Pale Ale"></div>
        <div class="field"><label>Style</label><input type="text" id="d_style" value="${d.style||''}" placeholder="e.g. American Pale Ale"></div>
        <div class="field"><label>Base batch size (L)</label><input type="number" step="0.5" id="d_baseBatch" value="${d.baseBatch}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Yeast</label><input type="text" id="d_yeast" value="${d.yeast||''}"></div>
        <div class="field"><label>Yeast form</label>
          <select id="d_yeastForm"><option value="Dry" ${d.yeastForm==='Dry'?'selected':''}>Dry</option><option value="Liquid" ${d.yeastForm==='Liquid'?'selected':''}>Liquid</option></select>
        </div>
        <div class="field"><label>Attenuation (%)</label><input type="number" step="1" id="d_atten" value="${Math.round((d.atten||0.78)*100)}"></div>
        <div class="field"><label>Ferment temp low (C)</label><input type="number" id="d_tempLo" value="${d.tempLo}"></div>
        <div class="field"><label>Ferment temp high (C)</label><input type="number" id="d_tempHi" value="${d.tempHi}"></div>
      </div>
      <div class="field-row">
        <div class="field" style="flex:1; min-width:400px;"><label>Description</label><input type="text" id="d_desc" value="${d.desc||''}" style="width:100%;" placeholder="Tasting notes, inspiration, whatever you like"></div>
      </div>
    </div>

    <h2 class="section-title">Fermentables (at base batch size)</h2>
    <div class="panel">
      <table id="fermTable">
        <thead><tr><th>Ingredient</th><th>kg</th><th>Extract potential</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          ${d.ferm.map((f,i)=>`<tr>
            <td><input type="text" data-frow="${i}" data-fcol="0" value="${f[0]}" style="width:100%;"></td>
            <td><input type="number" step="0.05" data-frow="${i}" data-fcol="1" value="${f[1]}" style="width:80px;"></td>
            <td><input type="number" step="5" data-frow="${i}" data-fcol="2" value="${f[2]}" style="width:80px;"></td>
            <td><input type="text" data-frow="${i}" data-fcol="3" value="${f[3]||''}" style="width:100%;"></td>
            <td><button class="btn btn-outline" data-fdel="${i}">Remove</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
      <button class="btn btn-outline" id="fAddRow" style="margin-top:8px;">+ Add fermentable</button>
    </div>

    <h2 class="section-title">Hops (at base batch size)</h2>
    <div class="panel">
      <table id="hopTable">
        <thead><tr><th>Ingredient</th><th>g</th><th>Alpha %</th><th>Stage</th><th>Time (min)</th><th>Dry hop day</th><th></th></tr></thead>
        <tbody>
          ${d.hops.map((h,i)=>`<tr>
            <td><input type="text" data-hrow="${i}" data-hcol="0" value="${h[0]}" style="width:100%;"></td>
            <td><input type="number" step="1" data-hrow="${i}" data-hcol="1" value="${h[1]}" style="width:70px;"></td>
            <td><input type="number" step="0.1" data-hrow="${i}" data-hcol="2" value="${h[2]}" style="width:70px;"></td>
            <td><select data-hrow="${i}" data-hcol="3">
                <option value="Boil" ${h[3]==='Boil'?'selected':''}>Boil</option>
                <option value="Whirlpool" ${h[3]==='Whirlpool'?'selected':''}>Whirlpool</option>
                <option value="Dry Hop" ${h[3]==='Dry Hop'?'selected':''}>Dry Hop</option>
              </select></td>
            <td><input type="number" step="1" data-hrow="${i}" data-hcol="4" value="${h[4]||0}" style="width:70px;"></td>
            <td><input type="text" data-hrow="${i}" data-hcol="5" value="${h[5]||''}" style="width:80px;" placeholder="e.g. Day 4"></td>
            <td><button class="btn btn-outline" data-hdel="${i}">Remove</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
      <button class="btn btn-outline" id="hAddRow" style="margin-top:8px;">+ Add hop</button>
    </div>

    <h2 class="section-title">Water targets (ppm)</h2>
    <div class="panel">
      <div class="field-row">
        ${WATER_IONS.map(ion=>`<div class="field"><label>${ion}</label><input type="number" step="1" id="d_water_${ion}" value="${d.water[ion]}"></div>`).join("")}
      </div>
    </div>

    <h2 class="section-title">Live preview</h2>
    <div class="panel">
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Estimated OG</div><div class="value">${fmt(preview.og,3)}</div></div>
        <div class="summary-card"><div class="label">Estimated FG</div><div class="value">${fmt(preview.fg,3)}</div></div>
        <div class="summary-card"><div class="label">Estimated ABV</div><div class="value">${fmt(preview.abv,1)}%</div></div>
        <div class="summary-card"><div class="label">Estimated IBU</div><div class="value">${fmt(preview.ibu,0)}</div></div>
        <div class="summary-card"><div class="label">Total grain</div><div class="value">${fmt(preview.totalGrain,2)} kg</div></div>
      </div>
      <p class="note-grey">IBU preview assumes a typical boil volume for this batch size, the real figure is recalculated precisely on the Hops tab once saved.</p>
    </div>

    <div class="panel">
      <button class="btn" id="saveRecipeBtn">${isEditingExisting?'Save changes':'Save to My Recipes'}</button>
      <button class="btn btn-outline" id="exportRecipeBtn">Export as JSON</button>
      <button class="btn btn-outline" id="clearRecipeBtn">Clear form</button>
      <span class="note-grey" style="margin-left:10px;">Changes here are kept as a draft automatically, even if you switch tabs, until you save or clear.</span>
    </div>
  `;

  function syncDraftFromForm(){
    d.name = container.querySelector("#d_name").value;
    d.style = container.querySelector("#d_style").value;
    d.baseBatch = parseFloat(container.querySelector("#d_baseBatch").value)||40;
    d.yeast = container.querySelector("#d_yeast").value;
    d.yeastForm = container.querySelector("#d_yeastForm").value;
    d.atten = (parseFloat(container.querySelector("#d_atten").value)||78)/100;
    d.tempLo = parseFloat(container.querySelector("#d_tempLo").value)||18;
    d.tempHi = parseFloat(container.querySelector("#d_tempHi").value)||20;
    d.desc = container.querySelector("#d_desc").value;
    WATER_IONS.forEach(ion=>{ d.water[ion] = parseFloat(container.querySelector(`#d_water_${ion}`).value)||0; });
  }
  function bindTableCell(sel, arr, rowAttr, colAttr, isNumberCols){
    container.querySelectorAll(sel).forEach(inp=>{
      inp.addEventListener("change", ()=>{
        const row = parseInt(inp.getAttribute(rowAttr));
        const col = parseInt(inp.getAttribute(colAttr));
        let val = inp.value;
        if(isNumberCols.includes(col)) val = parseFloat(val)||0;
        arr[row][col] = val;
        saveState();
        renderActiveTab();
      });
    });
  }
  container.querySelectorAll("#d_name,#d_style,#d_baseBatch,#d_yeast,#d_yeastForm,#d_atten,#d_tempLo,#d_tempHi,#d_desc")
    .forEach(el=>el.addEventListener("change", ()=>{ syncDraftFromForm(); saveState(); renderActiveTab(); }));
  WATER_IONS.forEach(ion=>{
    container.querySelector(`#d_water_${ion}`).addEventListener("change", ()=>{ syncDraftFromForm(); saveState(); });
  });
  bindTableCell("[data-frow]", d.ferm, "data-frow", "data-fcol", [1,2]);
  bindTableCell("[data-hrow]", d.hops, "data-hrow", "data-hcol", [1,2,4]);

  container.querySelectorAll("[data-fdel]").forEach(btn=>btn.addEventListener("click", ()=>{
    d.ferm.splice(parseInt(btn.getAttribute("data-fdel")),1); saveState(); renderActiveTab();
  }));
  container.querySelectorAll("[data-hdel]").forEach(btn=>btn.addEventListener("click", ()=>{
    d.hops.splice(parseInt(btn.getAttribute("data-hdel")),1); saveState(); renderActiveTab();
  }));
  container.querySelector("#fAddRow").addEventListener("click", ()=>{
    syncDraftFromForm(); d.ferm.push(["New fermentable", 1.0, 300, ""]); saveState(); renderActiveTab();
  });
  container.querySelector("#hAddRow").addEventListener("click", ()=>{
    syncDraftFromForm(); d.hops.push(["New hop", 20, 10, "Boil", 60, ""]); saveState(); renderActiveTab();
  });
  container.querySelector("#saveRecipeBtn").addEventListener("click", ()=>{
    syncDraftFromForm();
    if(!d.name.trim()){ alert("Give your recipe a name before saving."); return; }
    const p = draftCalc(d);
    d.og = Math.round(p.og*1000)/1000; d.fg = Math.round(p.fg*1000)/1000;
    d.abv = Math.round(p.abv*10)/10; d.ibu = Math.round(p.ibu);
    const savedId = saveRecipeToLibrary(JSON.parse(JSON.stringify(d)));
    STATE.recipeId = savedId;
    STATE.batchSize = d.baseBatch;
    STATE.draftRecipe = null;
    saveState();
    ACTIVE_TAB = "dashboard"; buildNav(); renderActiveTab();
  });
  container.querySelector("#exportRecipeBtn").addEventListener("click", ()=>{
    syncDraftFromForm();
    const p = draftCalc(d);
    const exportObj = Object.assign({}, d, {og:p.og, fg:p.fg, abv:Math.round(p.abv*10)/10, ibu:Math.round(p.ibu)});
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (d.name || "recipe").replace(/[^a-z0-9]+/gi,"_") + ".json";
    a.click();
  });
  container.querySelector("#clearRecipeBtn").addEventListener("click", ()=>{
    if(confirm("Clear this draft? Unsaved changes will be lost.")){
      STATE.draftRecipe = blankRecipe();
      saveState();
      renderActiveTab();
    }
  });
}

/* ---------------- FIND A BREW ---------------- */
function tryParseRecipeJSON(text){
  try{
    const obj = JSON.parse(text);
    if(obj && obj.ferm && obj.hops) return obj;
  }catch(e){}
  return null;
}
function parseRecipeFreeform(text){
  const draft = blankRecipe();
  draft.ferm = []; draft.hops = [];
  const lines = text.split(/\n/);
  const firstLine = lines.find(l=>l.trim().length>0);
  if(firstLine) draft.name = firstLine.trim().slice(0,80);

  const styleMatch = text.match(/style\s*[:\-]\s*([^\n]+)/i);
  if(styleMatch) draft.style = styleMatch[1].trim();
  const ogMatch = text.match(/OG\s*[:\-]?\s*(1\.\d{2,3})/i);
  if(ogMatch) draft.og = parseFloat(ogMatch[1]);
  const fgMatch = text.match(/FG\s*[:\-]?\s*(1\.\d{2,3})/i);
  if(fgMatch) draft.fg = parseFloat(fgMatch[1]);
  const abvMatch = text.match(/ABV\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%/i);
  if(abvMatch) draft.abv = parseFloat(abvMatch[1]);
  const ibuMatch = text.match(/IBU\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  if(ibuMatch) draft.ibu = parseFloat(ibuMatch[1]);
  const yeastMatch = text.match(/yeast\s*[:\-]\s*([^\n,]+)/i);
  if(yeastMatch) draft.yeast = yeastMatch[1].trim();
  const batchMatch = text.match(/batch\s*(?:size)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*L/i);
  if(batchMatch) draft.baseBatch = parseFloat(batchMatch[1]);

  lines.forEach(line=>{
    const grainMatch = line.match(/(\d+(?:\.\d+)?)\s*kg\s+(?:of\s+)?([A-Za-z][A-Za-z0-9 '\-\/\.]+)/i);
    if(grainMatch){
      draft.ferm.push([grainMatch[2].trim(), parseFloat(grainMatch[1]), 300, ""]);
      return;
    }
    const hopMatch = line.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?\s+([A-Za-z][A-Za-z0-9 '\-]+?)(?:[\s,(]+(\d+(?:\.\d+)?)\s*%)?(?:.*?(\d+)\s*min)?/i);
    if(hopMatch && /hop|cascade|simcoe|citra|mosaic|galaxy|saaz|goldings|fuggles|centennial|chinook|magnum|nelson|vic secret|ella|nectaron|amarillo|columbus|willamette|motueka|riwaka/i.test(line)){
      const name = hopMatch[2].trim();
      const aa = hopMatch[3] ? parseFloat(hopMatch[3]) : 12;
      const time = hopMatch[4] ? parseFloat(hopMatch[4]) : 60;
      let stage = "Boil";
      if(/dry\s*hop/i.test(line)) stage = "Dry Hop";
      else if(/whirlpool|flameout|hopstand/i.test(line)) stage = "Whirlpool";
      const dryDay = (line.match(/day\s*(\d+)/i)||[])[0] || "";
      draft.hops.push([name, parseFloat(hopMatch[1]), aa, stage, stage==="Dry Hop"?0:time, dryDay]);
    }
  });
  if(draft.ferm.length===0) draft.ferm = blankRecipe().ferm;
  if(draft.hops.length===0) draft.hops = blankRecipe().hops;
  return draft;
}

function renderFindBrew(container){
  container.innerHTML = `
    <h2 class="section-title">Find a Brew</h2>
    <div class="panel">
      <p class="desc">This is a static webpage, it can't run a live AI web search or call an external API by itself, that would need a server and an exposed API key, which isn't safe to ship in a public repo. Here's what actually works well instead:</p>
      <ol>
        <li><strong>Ask an AI assistant (like Copilot) in chat</strong>: "find me a recipe for [beer name / brewery / style]". Ask it to reply using the JSON recipe format below.</li>
        <li><strong>Paste the result below</strong> and click Parse, it will load straight into Create a Brew for you to review, tweak and save.</li>
        <li>Or skip the search entirely and use <strong>Quick Generate</strong> below to build a starting point from one of our existing style templates.</li>
      </ol>
    </div>

    <h2 class="section-title">Paste a recipe or search result</h2>
    <div class="panel">
      <textarea id="pasteBox" rows="10" style="width:100%; font-family:monospace; font-size:0.85rem; padding:8px;" placeholder="Paste a JSON recipe block, or just paste freeform notes like:&#10;Name: Example Brewery Pale Ale&#10;Style: American Pale Ale&#10;OG: 1.052  FG: 1.010  ABV: 5.4%  IBU: 32&#10;Yeast: US-05&#10;8.5kg Pale Ale Malt&#10;0.4kg Crystal 60&#10;20g Cascade 60 min boil&#10;30g Citra whirlpool&#10;40g Citra dry hop day 4"></textarea>
      <div class="field-row" style="margin-top:10px;">
        <button class="btn" id="parseBtn">Parse and load into Create a Brew</button>
        <button class="btn btn-outline" id="showSchemaBtn">Show JSON format</button>
      </div>
      <div id="schemaBox" style="display:none; margin-top:12px;">
        <p class="note-grey">Ask your AI assistant to reply in this exact format for a clean, reliable import:</p>
        <pre style="background:#f7f7f7; padding:12px; border-radius:6px; font-size:0.78rem; overflow-x:auto;">{
  "name": "Example Brewery Pale Ale Clone",
  "style": "American Pale Ale",
  "baseBatch": 40,
  "og": 1.052, "fg": 1.010, "abv": 5.4, "ibu": 32,
  "yeast": "US-05", "yeastForm": "Dry", "atten": 0.80,
  "tempLo": 18, "tempHi": 20,
  "desc": "Short tasting-note style description.",
  "ferm": [["Pale Ale Malt", 8.5, 300, "Base malt"], ["Crystal 60", 0.4, 270, "Caramel"]],
  "hops": [["Cascade", 20, 7.5, "Boil", 60, ""], ["Citra", 30, 12, "Whirlpool", 20, ""], ["Citra", 40, 12, "Dry Hop", 0, "Day 4"]],
  "water": {"Calcium":90,"Magnesium":10,"Sodium":15,"Sulphate":150,"Chloride":60,"Alkalinity":35}
}</pre>
      </div>
      <div id="parseResult" style="margin-top:10px;"></div>
    </div>

    <h2 class="section-title">Quick generate by style</h2>
    <div class="panel">
      <p class="desc">Builds a starting recipe by adapting the closest matching template from the Recipe Library to your target strength. Review every field before you brew, this is a starting point, not a finished recipe.</p>
      <div class="field-row">
        <div class="field">
          <label>Style</label>
          <select id="genStyle">${RECIPES.map(r=>`<option value="${r.id}">${r.style}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Target ABV (%)</label><input type="number" step="0.1" id="genABV" value="5.5"></div>
        <div class="field"><label>Batch size (L)</label><input type="number" step="0.5" id="genBatch" value="${STATE.batchSize}"></div>
      </div>
      <button class="btn" id="genBtn">Generate and load into Create a Brew</button>
    </div>
  `;

  container.querySelector("#showSchemaBtn").addEventListener("click", ()=>{
    const box = container.querySelector("#schemaBox");
    box.style.display = box.style.display==="none" ? "block" : "none";
  });

  container.querySelector("#parseBtn").addEventListener("click", ()=>{
    const text = container.querySelector("#pasteBox").value.trim();
    const resultEl = container.querySelector("#parseResult");
    if(!text){ resultEl.innerHTML = `<p class="note-red">Paste something first.</p>`; return; }
    let draft = tryParseRecipeJSON(text);
    let method = "structured JSON";
    if(!draft){ draft = parseRecipeFreeform(text); method = "best-effort text parsing"; }
    draft.id = null;
    if(!draft.baseBatch) draft.baseBatch = STATE.batchSize;
    if(!draft.water) draft.water = Object.assign({}, SOURCE_WATER_DEFAULTS);
    if(!draft.atten) draft.atten = 0.78;
    if(!draft.yeastForm) draft.yeastForm = "Dry";
    if(!draft.tempLo) draft.tempLo = 18;
    if(!draft.tempHi) draft.tempHi = 20;
    STATE.draftRecipe = draft;
    saveState();
    resultEl.innerHTML = `<p style="color:#2e7d32; font-weight:bold;">Parsed using ${method}. Loaded ${draft.ferm.length} fermentable(s) and ${draft.hops.length} hop addition(s). Opening Create a Brew for review...</p>`;
    setTimeout(()=>{ ACTIVE_TAB="create"; buildNav(); renderActiveTab(); }, 600);
  });

  container.querySelector("#genBtn").addEventListener("click", ()=>{
    const templateId = container.querySelector("#genStyle").value;
    const targetABV = parseFloat(container.querySelector("#genABV").value)||5.5;
    const targetBatch = parseFloat(container.querySelector("#genBatch").value)||40;
    const template = RECIPES.find(r=>r.id===templateId);
    const abvScale = targetABV / template.abv;
    const draft = JSON.parse(JSON.stringify(template));
    draft.id = null;
    draft.name = `My ${template.style} (generated)`;
    draft.baseBatch = targetBatch;
    draft.ferm = draft.ferm.map(f=>[f[0], Math.round(f[1]*abvScale*100)/100, f[2], f[3]]);
    draft.og = Math.round((1+(template.og-1)*abvScale)*1000)/1000;
    draft.fg = Math.round((1+(draft.og-1)*(1-draft.atten))*1000)/1000;
    draft.abv = Math.round((draft.og-draft.fg)*131.25*10)/10;
    draft.desc = `Generated from the ${template.name} template, scaled to a target ABV of ${targetABV}%. ${template.desc}`;
    STATE.draftRecipe = draft;
    saveState();
    ACTIVE_TAB = "create"; buildNav(); renderActiveTab();
  });
}

/* ---------------- FIND A SUPPLIER ---------------- */
function renderFindSupplier(container){
  const ferm = calcFermentables();
  const hops = calcHops(ferm);
  const water = calcWater(ferm);

  function landedCostFor(supplier){
    const fermCost = ferm.rows.reduce((s,r)=>{
      const base = STATE.prices.ferm[r.name]; if(base===undefined) return s;
      return s + base*supplier.priceFactor.ferm*r.scaledKg;
    },0);
    const hopCost = hops.rows.reduce((s,r)=>{
      const base = STATE.prices.hop[r.name]; if(base===undefined) return s;
      return s + base*supplier.priceFactor.hop*r.scaledG;
    },0);
    const packs = yeastPacksNeeded(ferm.rec, ferm);
    const yeastBase = ferm.rec.yeastForm==="Dry" ? STATE.prices.yeastDry : STATE.prices.yeastLiquid;
    const yeastCost = packs*yeastBase*supplier.priceFactor.yeast;
    let saltCost = 0;
    Object.entries(STATE.saltGrams).forEach(([name,grams])=>{ saltCost += grams*STATE.prices.salt[name]*supplier.priceFactor.salt; });
    const ingredientTotal = fermCost + hopCost + yeastCost + saltCost;
    let delivery = 0; let deliveryLabel = "";
    if(supplier.delivery.type==="flat"){ delivery = supplier.delivery.cost; deliveryLabel = `Flat $${supplier.delivery.cost}`; }
    else if(supplier.delivery.type==="flat_free_over"){
      delivery = ingredientTotal >= supplier.delivery.freeOver ? 0 : supplier.delivery.cost;
      deliveryLabel = ingredientTotal >= supplier.delivery.freeOver ? `Free (order over $${supplier.delivery.freeOver})` : `$${supplier.delivery.cost} (free over $${supplier.delivery.freeOver})`;
    } else if(supplier.delivery.type==="local_flat_free_over"){
      delivery = ingredientTotal >= supplier.delivery.freeOver ? 0 : supplier.delivery.cost;
      deliveryLabel = ingredientTotal >= supplier.delivery.freeOver ? `Free local delivery (order over $${supplier.delivery.freeOver}, if your postcode is eligible)` : `From $${supplier.delivery.cost} local delivery (free over $${supplier.delivery.freeOver})`;
    }
    return { ingredientTotal, delivery, deliveryLabel, landed: ingredientTotal+delivery };
  }

  const results = SUPPLIERS.map(s=>({ supplier:s, cost: landedCostFor(s) })).sort((a,b)=>a.cost.landed-b.cost.landed);

  container.innerHTML = `
    <h2 class="section-title">Find a Supplier</h2>
    <div class="panel">
      <p class="desc">There's no public pricing API for any Australian homebrew supplier, and their storefronts block cross-origin requests, so this can't be a live price feed. Instead, this estimates a <strong>landed cost</strong> (ingredients + delivery) for your current recipe and batch size across the major suppliers, using Brewman's confirmed prices as a baseline and a researched price factor per supplier. Always confirm the actual cart total before ordering.</p>
      <p>Recipe: <span class="calc-value">${ferm.rec.name}</span> &nbsp; Batch size: <span class="calc-value">${fmt(STATE.batchSize,1)} L</span></p>
    </div>

    <h2 class="section-title">Ranked by estimated landed cost</h2>
    <div class="panel">
      <table>
        <thead><tr><th>Rank</th><th>Supplier</th><th>Location</th><th>Est. ingredients</th><th>Delivery</th><th>Est. landed total</th><th>Confirmed</th></tr></thead>
        <tbody>
          ${results.map((r,i)=>`<tr ${i===0?'style="background:#E2F0D9;"':''}>
            <td>${i+1}${i===0?' \u{1F3C6}':''}</td>
            <td><strong>${r.supplier.name}</strong></td>
            <td class="note-grey">${r.supplier.location}</td>
            <td>${money(r.cost.ingredientTotal)}</td>
            <td>${r.cost.deliveryLabel}</td>
            <td><strong>${money(r.cost.landed)}</strong></td>
            <td class="${r.supplier.confirmed==='Y'?'badge-y':'badge-n'}">${r.supplier.confirmed}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <h2 class="section-title">Supplier notes</h2>
    <div class="panel">
      ${SUPPLIERS.map(s=>`
        <div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #eee;">
          <strong style="color:var(--navy);"><a href="${s.url}" target="_blank">${s.name}</a></strong>
          <span class="note-grey"> &mdash; ${s.location}</span>
          <p style="margin:4px 0;">${s.note}</p>
          <p class="note-grey">${s.delivery.notes}</p>
        </div>`).join("")}
    </div>

    <div class="note">Richmond Vale is in the Hunter region, Noble Barons in Newcastle is worth a phone call even when it's not the cheapest on paper, same-day pickup and no delivery wait can be worth more than a few dollars saved. Ring ahead for grain bills, they need 24 hours notice to mill and package.</div>
  `;
}

/* ---------------- READ ME ---------------- */
function renderReadMe(container){
  container.innerHTML = `
    <h2 class="section-title">Read Me</h2>
    <div class="panel">
      <h3>How to use this calculator</h3>
      <ol>
        <li>Go to Dashboard, pick a recipe and set your target batch size in litres.</li>
        <li>Fermentables, Hops and Water all read that choice and scale every ingredient automatically.</li>
        <li>Tweak efficiency, boil-off, utilisation or water salts if your system runs differently to the defaults.</li>
        <li>Brew Day and Fermentation are your live log, use them on a phone or tablet in the shed.</li>
        <li>Cost totals ingredient spend from the Brewman-based price database, edit any price any time.</li>
        <li>Find Ingredients flags the few items Brewman does not stock, and compares Brewman against KegLand for everything else.</li>
        <li>Sign in on Account & Sync to back everything up to the cloud and use it on more than one device.</li>
      </ol>
    </div>

    <div class="panel">
      <h3>How to add a new recipe</h3>
      <ol>
        <li>Use <strong>Create a Brew</strong> for a guided form, or edit <code>js/data.js</code> directly if you're comfortable with code.</li>
        <li>Save it, it appears in the Dashboard dropdown and Recipe Library immediately.</li>
      </ol>
    </div>

    <div class="panel">
      <h3>Hosting this on GitHub Pages</h3>
      <ol>
        <li>Create a new GitHub repository, e.g. <code>brew-calculator</code>.</li>
        <li>Upload <code>index.html</code>, the <code>css</code> folder and the <code>js</code> folder to the repository root.</li>
        <li>In the repository, go to Settings &gt; Pages.</li>
        <li>Under "Build and deployment", set Source to "Deploy from a branch", pick your main branch and the <code>/ (root)</code> folder, then Save.</li>
        <li>GitHub will give you a URL like <code>https://yourusername.github.io/brew-calculator/</code> within a minute or two.</li>
      </ol>
    </div>

    <div class="panel">
      <h3>Limitations, please read</h3>
      <ul>
        <li>This is mostly a static site. Find a Brew and Find a Supplier are estimates and manual-parse tools, not live API integrations, for the reasons explained on those tabs.</li>
        <li>All recipes other than the HenHouse Incredible IPA clone are original style formulations, not exact commercial clones.</li>
        <li>Ingredient prices were researched against brewman.com.au and kegland.com.au on 8 Sep 2026. Prices, availability and specials change, always check the current cart total before ordering.</li>
        <li>The Floraville water profile uses Hunter Water's published typical values. Always measure mash pH directly rather than relying on the estimate alone.</li>
        <li>If you're not signed in on Account & Sync, your data is saved only in this browser's local storage. Clearing your browser data will reset it.</li>
      </ul>
    </div>
  `;
}

/* ---------------- INIT ---------------- */
renderAll();
