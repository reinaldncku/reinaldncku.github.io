/* ==========================================================================
   ICTDO PORTFOLIO — SHARED UTILITIES
   Depends on PROJECTS from data.js being loaded first.
   ========================================================================== */

const STAGE_ORDER = ["Not Started", "Requirements", "Development", "Testing", "Completed"];
const STAGE_SHORT = { "Not Started":"NOT STARTED", "Requirements":"REQUIREMENTS", "Development":"DEVELOPMENT", "Testing":"TESTING", "Completed":"COMPLETED" };
const PRIORITY_ORDER = ["Critical","High","Medium","Low"];
const EFFORT_ORDER = ["S","M","L","XL"];
const EFFORT_WEIGHT = { "S":1, "M":2, "L":3, "XL":5 };
const EFFORT_LABEL = { "S":"Small", "M":"Medium", "L":"Large", "XL":"X-Large" };

const STATUS_COLOR = {
  "Not Started": "var(--idle)",
  "Requirements": "#8B94A1",
  "Development": "var(--accent)",
  "Testing": "var(--warn)",
  "Completed": "var(--ok)"
};

const PRIORITY_CLASS = { Critical:"critical", High:"high", Medium:"medium", Low:"low" };

function stageIndex(status){
  const i = STAGE_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
}

function fmtDate(d){
  if(!d) return "—";
  if(d === "Recurring") return "Recurring";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { year:"numeric", month:"short", day:"2-digit" });
}

function daysUntil(d){
  if(!d || d === "Recurring") return null;
  const today = new Date(TODAY + "T00:00:00");
  const dt = new Date(d + "T00:00:00");
  return Math.round((dt - today) / 86400000);
}

const TODAY = "2026-08-20";

function people(project){
  if(!project.developers) return [];
  return project.developers.split(",").map(s => s.trim()).filter(Boolean);
}

function buildManpower(){
  const map = {};
  PROJECTS.forEach(p => {
    people(p).forEach(name => {
      if(!map[name]) map[name] = [];
      map[name].push(p);
    });
  });
  return map;
}

function weightedLoad(projects){
  return projects.reduce((sum,p) => sum + (EFFORT_WEIGHT[p.effort] || 1), 0);
}

function loadTier(weight){
  if(weight >= 7) return { label:"Overloaded", cls:"danger" };
  if(weight >= 4) return { label:"At Capacity", cls:"warn" };
  return { label:"Available", cls:"ok" };
}

/* ---------- Chrome: topband, pulse strip, switchboard, clock ---------- */

const NAV_ITEMS = [
  { href:"index.html",            code:"DASH",     label:"Executive Dashboard" },
  { href:"roadmap.html",          code:"ROADMAP",  label:"Roadmap / Gantt" },
  { href:"manpower.html",         code:"CREW",     label:"Manpower Matrix" },
  { href:"capacity.html",         code:"LOAD",     label:"Capacity / Overload" },
  { href:"priority-effort.html",  code:"MATRIX",   label:"Priority vs Effort" }
];

function renderSwitchboard(activeHref){
  const el = document.getElementById("switchboard");
  if(!el) return;
  el.innerHTML = NAV_ITEMS.map(item => `
    <a class="switch ${item.href===activeHref ? 'active':''}" href="${item.href}" title="${item.label}">
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

function renderClock(){
  const el = document.getElementById("clock");
  if(!el) return;
  const d = new Date(TODAY + "T00:00:00");
  const dateStr = d.toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  el.innerHTML = `<span class="big">${dateStr}</span>SNAPSHOT · AS-OF DATE`;
}

function stageRailHTML(status){
  const idx = stageIndex(status);
  return `<span class="stagerail">` + STAGE_ORDER.map((s,i) => {
    if(i < idx) return `<i class="lit"></i>`;
    if(i === idx) return `<i class="current"></i>`;
    return `<i></i>`;
  }).join("") + `</span>`;
}

function priorityBadgeHTML(priority){
  const cls = PRIORITY_CLASS[priority] || "low";
  return `<span class="badge badge-${cls}">${priority}</span>`;
}

document.addEventListener("DOMContentLoaded", () => {
  renderSwitchboard(document.body.getAttribute("data-page"));
  renderPulse();
  renderClock();
});
