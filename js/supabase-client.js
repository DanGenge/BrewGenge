/* ============================================================
   SUPABASE CLOUD SYNC LAYER
   ------------------------------------------------------------
   This file is intentionally self-contained and defensive:
   if Supabase is unreachable (offline, misconfigured, or you
   simply haven't signed in), the app falls back to local
   storage only and nothing breaks. Cloud sync is a bonus layer
   on top of the app, never a requirement to use it.
   ============================================================ */

// ---- Fill these in with YOUR project's values ----
// Settings > API (or Settings > Data API) in your Supabase dashboard.
const SUPABASE_URL = "https://goojuftzuiwoptjtlwfx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WdvQhwumdXn5c35OdVZasA_sQWK0dM3";

let supabaseClient = null;
let SUPABASE_READY = false;
let CURRENT_USER = null;
let SYNC_STATUS = "offline"; // "offline" | "syncing" | "synced" | "error"
let syncDebounceTimer = null;

function initSupabase(){
  try{
    if(typeof window.supabase === "undefined"){
      console.warn("Supabase JS library did not load, check your internet connection or the CDN <script> tag in index.html.");
      return;
    }
    if(!SUPABASE_URL || SUPABASE_URL.includes("YOUR-PROJECT")){
      console.warn("Supabase URL not configured yet.");
      return;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    SUPABASE_READY = true;

    supabaseClient.auth.onAuthStateChange((event, session) => {
      CURRENT_USER = session ? session.user : null;
      if(event === "SIGNED_IN"){
        loadStateFromCloud().then(()=>{ renderActiveTab(); if(ACTIVE_TAB==="account") renderActiveTab(); });
      }
      if(event === "SIGNED_OUT"){
        SYNC_STATUS = "offline";
        if(ACTIVE_TAB==="account") renderActiveTab();
      }
    });

    // pick up an existing session on page load (e.g. after a magic link redirect)
    supabaseClient.auth.getSession().then(({data})=>{
      CURRENT_USER = data.session ? data.session.user : null;
      if(CURRENT_USER){
        loadStateFromCloud().then(()=>{ if(ACTIVE_TAB==="account") renderActiveTab(); });
      }
    });
  }catch(e){
    console.error("Supabase init failed", e);
  }
}

async function signInWithEmail(email){
  if(!SUPABASE_READY) return { error: "Supabase is not configured." };
  try{
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    return { error: error ? error.message : null };
  }catch(e){
    return { error: e.message };
  }
}

async function signOutUser(){
  if(!SUPABASE_READY) return;
  await supabaseClient.auth.signOut();
  CURRENT_USER = null;
}

/* ---- Cloud sync: whole-state JSON blob, debounced ---- */
function syncStateToCloud(){
  if(!SUPABASE_READY || !CURRENT_USER) return; // silently no-op if not signed in, local storage still works
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(async ()=>{
    SYNC_STATUS = "syncing";
    if(ACTIVE_TAB==="account") updateSyncBadgeOnly();
    try{
      const { error } = await supabaseClient
        .from("user_app_state")
        .upsert({ user_id: CURRENT_USER.id, state: STATE }, { onConflict: "user_id" });
      SYNC_STATUS = error ? "error" : "synced";
    }catch(e){
      console.error("Cloud sync failed", e);
      SYNC_STATUS = "error";
    }
    if(ACTIVE_TAB==="account") updateSyncBadgeOnly();
  }, 1200); // debounce so rapid edits don't spam the network
}

async function loadStateFromCloud(){
  if(!SUPABASE_READY || !CURRENT_USER) return;
  SYNC_STATUS = "syncing";
  try{
    const { data, error } = await supabaseClient
      .from("user_app_state")
      .select("state")
      .eq("user_id", CURRENT_USER.id)
      .maybeSingle();
    if(error){ SYNC_STATUS = "error"; return; }
    if(data && data.state && Object.keys(data.state).length > 0){
      // merge cloud state over local defaults so nothing required is ever missing
      STATE = deepMerge(defaultState(), data.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    } else {
      // no cloud record yet, push current local state up as the first sync
      await supabaseClient.from("user_app_state").upsert({ user_id: CURRENT_USER.id, state: STATE }, { onConflict:"user_id" });
    }
    SYNC_STATUS = "synced";
  }catch(e){
    console.error("Cloud load failed", e);
    SYNC_STATUS = "error";
  }
}

function updateSyncBadgeOnly(){
  const badge = document.getElementById("syncStatusBadge");
  if(!badge) return;
  const map = {
    offline: ["offline","Not signed in"],
    syncing: ["online","Syncing..."],
    synced: ["online","Synced"],
    error: ["error","Sync error"]
  };
  const [cls, label] = map[SYNC_STATUS] || map.offline;
  badge.className = "sync-badge " + cls;
  badge.textContent = label;
}

/* ---------------- ACCOUNT & SYNC TAB ---------------- */
function renderAccount(container){
  const signedIn = !!CURRENT_USER;
  container.innerHTML = `
    <h2 class="section-title">Account & Sync</h2>
    <div class="panel">
      <p class="desc">Sign in to back up your recipes, prices and brew logs to the cloud (Supabase) and use this calculator across your phone, laptop and shed tablet. If you skip this, everything still works, it just stays local to this browser only.</p>
      <p>Status: <span id="syncStatusBadge" class="sync-badge ${signedIn ? 'online' : 'offline'}">${signedIn ? 'Signed in' : 'Not signed in'}</span></p>
    </div>

    ${!SUPABASE_READY ? `
      <div class="panel">
        <p class="note-red">Supabase isn't configured in this copy of the app yet. Open js/supabase-client.js and check SUPABASE_URL and SUPABASE_ANON_KEY are filled in, and that index.html loads the Supabase JS library.</p>
      </div>
    ` : signedIn ? `
      <div class="panel">
        <p>Signed in as <strong>${CURRENT_USER.email}</strong></p>
        <div class="field-row">
          <button class="btn" id="syncNowBtn">Sync now</button>
          <button class="btn btn-outline" id="signOutBtn">Sign out</button>
        </div>
      </div>
    ` : `
      <div class="panel">
        <p>Enter your email, we'll send you a one-click magic link, no password to remember.</p>
        <div class="field-row">
          <div class="field" style="min-width:280px;">
            <label>Email address</label>
            <input type="email" id="loginEmail" placeholder="you@example.com">
          </div>
        </div>
        <button class="btn" id="sendLinkBtn">Send magic link</button>
        <div id="loginResult" style="margin-top:10px;"></div>
      </div>
    `}

    <div class="panel">
      <h3>How this works</h3>
      <ul>
        <li>Your whole app state, My Recipes, custom prices, water settings, brew logs, fermentation logs, is saved as one document per account.</li>
        <li>It syncs automatically about a second after you make a change, no need to click anything.</li>
        <li>Signing in on a second device pulls your latest saved state down automatically.</li>
        <li>If you're offline or not signed in, everything still saves locally in this browser, it just won't follow you to another device.</li>
      </ul>
    </div>
  `;

  if(!signedIn && SUPABASE_READY){
    container.querySelector("#sendLinkBtn").addEventListener("click", async ()=>{
      const email = container.querySelector("#loginEmail").value.trim();
      const resultEl = container.querySelector("#loginResult");
      if(!email){ resultEl.innerHTML = `<p class="note-red">Enter an email address first.</p>`; return; }
      resultEl.innerHTML = `<p class="note-grey">Sending...</p>`;
      const { error } = await signInWithEmail(email);
      resultEl.innerHTML = error
        ? `<p class="note-red">${error}</p>`
        : `<p style="color:#2e7d32; font-weight:bold;">Check your email for a sign-in link.</p>`;
    });
  }
  if(signedIn){
    container.querySelector("#syncNowBtn").addEventListener("click", ()=>{
      syncStateToCloud();
    });
    container.querySelector("#signOutBtn").addEventListener("click", async ()=>{
      await signOutUser();
      renderActiveTab();
    });
  }
}

// Kick off Supabase once the page loads
document.addEventListener("DOMContentLoaded", initSupabase);
