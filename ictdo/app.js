/* ==========================================================================
   ICTDO PORTFOLIO — SHARED UTILITIES
   Depends on PROJECTS from data.js being loaded first.
   ========================================================================== */

const STAGE_ORDER = ["Not Started", "Development", "Testing", "Completed", "Parked"];
const STAGE_SHORT = { "Not Started":"NOT STARTED", "Development":"DEVELOPMENT", "Testing":"TESTING", "Completed":"COMPLETED", "Parked":"PARKED" };
// The four real sequential stages, used only for the per-row progress rail.
// Parked is excluded here (and handled separately) since it isn't "further
// along" than Completed — it's a pause, not a position in the pipeline.
const PROGRESS_STAGES = ["Not Started", "Development", "Testing", "Completed"];
const PRIORITY_ORDER = ["Critical","High","Medium","Low"];
const EFFORT_ORDER = ["S","M","L","XL"];
const EFFORT_WEIGHT = { "S":1, "M":2, "L":3, "XL":5 };
const EFFORT_LABEL = { "S":"Small", "M":"Medium", "L":"Large", "XL":"X-Large" };

const STATUS_COLOR = {
  "Not Started": "var(--idle)",
  "Development": "var(--accent-dim)",
  "Testing": "var(--warn)",
  "Completed": "var(--ok)",
  "Parked": "var(--parked)"
};

const PRIORITY_CLASS = { Critical:"critical", High:"high", Medium:"medium", Low:"low" };

function stageIndex(status){
  const i = PROGRESS_STAGES.indexOf(status);
  return i === -1 ? 0 : i;
}

function isISODate(d){
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function fmtDate(d){
  if(!d) return "—";
  if(d === "Recurring") return "Recurring";
  if(!isISODate(d)) return d; // free-text estimate (e.g. "Est: November 2027") — show as-is
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { year:"numeric", month:"short", day:"2-digit" });
}

function daysUntil(d){
  if(!isISODate(d)) return null; // no precise date to compute against
  const today = new Date(TODAY + "T00:00:00");
  const dt = new Date(d + "T00:00:00");
  return Math.round((dt - today) / 86400000);
}

const TODAY = "2026-08-20";

function people(project){
  if(!project.developers) return [];
  return project.developers.split(",").map(s => s.trim()).filter(Boolean);
}

function buildManpower(list){
  list = list || PROJECTS;
  const map = {};
  list.forEach(p => {
    people(p).forEach(name => {
      if(!map[name]) map[name] = [];
      map[name].push(p);
    });
  });
  return map;
}

/* Not Started and Completed projects carry no weight in capacity load —
   the work hasn't begun yet, or it's already finished, so neither should
   count as current pressure on a person's plate. */
function isUnweightedStatus(status){
  return status === "Not Started" || status === "Completed" || status === "Parked";
}

function projectWeight(p){
  return isUnweightedStatus(p.status) ? 0 : (EFFORT_WEIGHT[p.effort] || 1);
}

function weightedLoad(projects){
  return projects.reduce((sum,p) => sum + projectWeight(p), 0);
}

function loadTier(weight){
  if(weight >= 11) return { label:"Overloaded", cls:"danger" };
  if(weight >= 7) return { label:"At Capacity", cls:"warn" };
  return { label:"Available", cls:"ok" };
}

/* ---------- Portfolio health / RAG scoring ---------- */
/* Transparent point model — every point traces to a labeled factor,
   shown alongside the rating rather than hidden inside a black-box score. */

function computeHealth(p){
  if(p.status === "Completed"){
    return { score:0, rag:"green", factors:[{ label:"Complete", pts:0 }] };
  }

  const factors = [];
  const staffed = !!p.developers;
  if(!staffed) factors.push({ label:"No developer assigned", pts:3 });

  if(p.priority === "Critical") factors.push({ label:"Critical priority", pts:2 });
  else if(p.priority === "High") factors.push({ label:"High priority", pts:1 });

  const earlyStage = (p.status === "Not Started");
  if(earlyStage && (p.priority === "Critical" || p.priority === "High")){
    factors.push({ label:"Early stage for its priority", pts:1 });
  }

  if(p.deadline_fixed === "Yes"){
    if(!p.target_date){
      factors.push({ label:"Fixed deadline, no date on file", pts:1 });
    } else if(!isISODate(p.target_date)){
      factors.push({ label:`Fixed deadline, date on file isn't a specific day (${p.target_date})`, pts:1 });
    } else {
      const d = daysUntil(p.target_date);
      if(d !== null && d < 0) factors.push({ label:"Past target date", pts:3 });
      else if(d !== null && d <= 30) factors.push({ label:"Fixed deadline within 30 days", pts:2 });
      else if(d !== null && d <= 60) factors.push({ label:"Fixed deadline within 60 days", pts:1 });
    }
  }

  const score = factors.reduce((s,f) => s + f.pts, 0);
  const rag = score >= 5 ? "red" : score >= 2 ? "amber" : "green";
  return { score, rag, factors };
}

const RAG_COLOR = { red:"var(--danger)", amber:"var(--warn)", green:"var(--ok)" };
const RAG_LABEL = { red:"At Risk", amber:"Needs Attention", green:"On Track" };

/* ---------- Global filter bar ---------- */
/* Filter state lives in the URL query string, so it survives tab
   navigation (the switchboard re-appends it to every link) and is
   shareable/bookmarkable. Every page reads it via filteredProjects()
   and renders from that instead of the raw PROJECTS array. */

function getFilterState(){
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    office: params.get("office") || "",
    priority: params.get("priority") || "",
    status: params.get("status") || "",
    person: params.get("person") || ""
  };
}

function filterQueryString(state){
  const params = new URLSearchParams();
  if(state.q) params.set("q", state.q);
  if(state.office) params.set("office", state.office);
  if(state.priority) params.set("priority", state.priority);
  if(state.status) params.set("status", state.status);
  if(state.person) params.set("person", state.person);
  const s = params.toString();
  return s ? "?" + s : "";
}

function filteredProjects(){
  const f = getFilterState();
  return PROJECTS.filter(p => {
    if(f.office && p.office !== f.office) return false;
    if(f.priority && p.priority !== f.priority) return false;
    if(f.status && p.status !== f.status) return false;
    if(f.person){
      const names = p.developers ? p.developers.split(",").map(s=>s.trim()) : [];
      if(!names.includes(f.person)) return false;
    }
    if(f.q){
      const hay = (p.project + " " + (p.office||"") + " " + (p.developers||"")).toLowerCase();
      if(!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

function renderFilterBar(){
  const el = document.getElementById("filterBar");
  if(!el) return;
  const f = getFilterState();
  const offices = [...new Set(PROJECTS.map(p=>p.office))].sort();
  const people = Object.keys(buildManpower()).sort();
  const esc = s => String(s).replace(/"/g,"&quot;");

  el.innerHTML = `
    <input type="text" id="fbSearch" class="fb-input" placeholder="Search projects…" value="${esc(f.q)}">
    <select id="fbOffice" class="fb-select">
      <option value="">All Offices</option>
      ${offices.map(o=>`<option value="${esc(o)}" ${f.office===o?'selected':''}>${o}</option>`).join("")}
    </select>
    <select id="fbPriority" class="fb-select">
      <option value="">All Priorities</option>
      ${PRIORITY_ORDER.map(o=>`<option value="${o}" ${f.priority===o?'selected':''}>${o}</option>`).join("")}
    </select>
    <select id="fbStatus" class="fb-select">
      <option value="">All Stages</option>
      ${STAGE_ORDER.map(o=>`<option value="${o}" ${f.status===o?'selected':''}>${o}</option>`).join("")}
    </select>
    <select id="fbPerson" class="fb-select">
      <option value="">All People</option>
      ${people.map(o=>`<option value="${esc(o)}" ${f.person===o?'selected':''}>${o}</option>`).join("")}
    </select>
    <span id="filterCount" class="fb-count"></span>
    <a href="${window.location.pathname}" class="fb-clear" id="fbClear">Clear filters</a>
  `;

  function apply(){
    const state = {
      q: document.getElementById("fbSearch").value.trim(),
      office: document.getElementById("fbOffice").value,
      priority: document.getElementById("fbPriority").value,
      status: document.getElementById("fbStatus").value,
      person: document.getElementById("fbPerson").value
    };
    window.location.href = window.location.pathname + filterQueryString(state);
  }

  ["fbOffice","fbPriority","fbStatus","fbPerson"].forEach(id => {
    document.getElementById(id).addEventListener("change", apply);
  });
  const search = document.getElementById("fbSearch");
  search.addEventListener("keydown", e => { if(e.key === "Enter") apply(); });
  search.addEventListener("blur", apply);

  const anyActive = f.q || f.office || f.priority || f.status || f.person;
  document.getElementById("fbClear").style.display = anyActive ? "inline-flex" : "none";
}

function updateFilterCount(shown, total){
  const el = document.getElementById("filterCount");
  if(!el) return;
  el.textContent = shown === total ? `${total} projects` : `Showing ${shown} of ${total} projects`;
}

/* ---------- Chrome: topband, pulse strip, switchboard, clock ---------- */

const NAV_ITEMS = [
  { href:"index.html",            code:"HOME",                     label:"Executive Dashboard" },
  { href:"roadmap.html",          code:"GANTT CHART",              label:"Roadmap / Gantt" },
  { href:"manpower.html",         code:"MANPOWER",                 label:"Manpower Matrix" },
  { href:"capacity.html",         code:"CAPACITY",                 label:"Capacity / Overload" },
  { href:"priority-effort.html",  code:"PRIORITY-EFFORT MATRIX",   label:"Priority vs Effort" },
  { href:"health.html",           code:"HEALTH",                   label:"Portfolio Health / RAG" }
];

function renderSwitchboard(activeHref){
  const el = document.getElementById("switchboard");
  if(!el) return;
  const qs = window.location.search;
  el.innerHTML = NAV_ITEMS.map(item => `
    <a class="switch ${item.href===activeHref ? 'active':''}" href="${item.href}${qs}" title="${item.label}">
      <span class="dot"></span>${item.code}
    </a>
  `).join("");
}

function renderPulse(){
  const rail = document.getElementById("pulseRail");
  const legend = document.getElementById("pulseLegend");
  if(!rail) return;
  const counts = {};
  STAGE_ORDER.forEach(s => counts[s] = 0);
  PROJECTS.forEach(p => { counts[p.status] = (counts[p.status]||0) + 1; });
  const total = PROJECTS.length;
  rail.innerHTML = STAGE_ORDER.map(s => {
    const w = (counts[s]/total*100).toFixed(2);
    if(w == 0) return "";
    return `<span class="pulse-seg" style="width:${w}%;background:${STATUS_COLOR[s]}" title="${s}: ${counts[s]}"></span>`;
  }).join("");
  if(legend){
    legend.innerHTML = STAGE_ORDER.map(s => `
      <span><i style="background:${STATUS_COLOR[s]}"></i>${STAGE_SHORT[s]} · ${counts[s]}</span>
    `).join("");
  }
}

function stageRailHTML(status){
  if(status === "Parked"){
    return `<span class="stagerail" title="Parked — on hold">` +
      PROGRESS_STAGES.map(() => `<i class="parked"></i>`).join("") +
      `</span>`;
  }
  const idx = stageIndex(status);
  return `<span class="stagerail">` + PROGRESS_STAGES.map((s,i) => {
    if(i < idx) return `<i class="lit"></i>`;
    if(i === idx) return `<i class="current"></i>`;
    return `<i></i>`;
  }).join("") + `</span>`;
}

function priorityBadgeHTML(priority){
  const cls = PRIORITY_CLASS[priority] || "low";
  return `<span class="badge badge-${cls}">${priority}</span>`;
}

/* ---------- Bootstrap: load live data, then render chrome + page ---------- */
/* Every page calls bootstrap(renderPage) instead of running its render
   logic immediately, since PROJECTS now comes from an async fetch rather
   than being available the instant data.js loads. */

function renderLoadBanner(status){
  const el = document.getElementById("loadBanner");
  if(!el) return;
  // "not-configured" (SHEET_CSV_URL left blank) is expected while the
  // live sheet hasn't been set up yet — stay quiet rather than nag on
  // every page load. Real fetch failures (bad URL, network issue, sheet
  // not published) still surface a banner since those need attention.
  if(status.ok || status.reason === "not-configured"){
    el.innerHTML = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.innerHTML = `<div class="load-banner-inner">Couldn't reach the live sheet (${status.reason}) — showing the last saved snapshot instead.</div>`;
}

async function bootstrap(renderPageFn){
  const status = await loadProjects();

  renderSwitchboard(document.body.getAttribute("data-page"));
  renderPulse();
  renderFilterBar();
  renderLoadBanner(status);

  renderPageFn();
}
