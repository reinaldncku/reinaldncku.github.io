/* ==========================================================================
   ICTDO PORTFOLIO — LIVE DATA LOADER
   ==========================================================================
   Pulls project data from a published Google Sheet on every page load, so
   the site reflects the spreadsheet automatically — no manual rebuild.

   SETUP (one-time):
   1. In Google Sheets: File → Share → Publish to web.
   2. Under "Link", choose the specific sheet/tab (not "Entire Document"),
      and set the format dropdown to "Comma-separated values (.csv)".
   3. Click Publish, copy the URL it gives you.
   4. Paste that URL below as SHEET_CSV_URL.

   COLUMN HEADERS the sheet should use (order doesn't matter, matching is
   case-insensitive — see HEADER_ALIASES below for accepted variants):
     Project / System | Requesting Office | Priority | Status | Developers
     | Start Date | Target Date | Deadline Fixed? | Effort / Size

   If SHEET_CSV_URL is left blank, or the live fetch fails for any reason
   (sheet not published yet, network issue, wrong URL), the site falls
   back to the snapshot below rather than showing a blank page — with a
   small banner explaining what happened.
   ========================================================================== */

const SHEET_CSV_URL = ""; // <-- paste your published CSV URL here

const FALLBACK_PROJECTS = [
  { "project": "eMasinop", "office": "SPMO", "priority": "Low", "status": "Not Started", "developers": "Arnold Celis, Bernard Secreto, James Telosa", "start_date": null, "target_date": "2027-03-31", "deadline_fixed": "No", "effort": "L" },
  { "project": "KEC Conference", "office": "FICS", "priority": "Medium", "status": "Development", "developers": "AJ Alarcon", "start_date": "2026-08-07", "target_date": "2026-09-14", "deadline_fixed": "Yes", "effort": "S" },
  { "project": "ICDE Conference Website", "office": "ICDE Committee", "priority": "Medium", "status": "Completed", "developers": "AJ Alarcon, Zak Pulmano", "start_date": "2026-04-15", "target_date": "Est: November 2027", "deadline_fixed": "Yes", "effort": "S" },
  { "project": "IFSS 2026 Website", "office": "FMDS", "priority": "Medium", "status": "Development", "developers": "AJ Alarcon", "start_date": "2026-06-26", "target_date": "2026-10-05", "deadline_fixed": "Yes", "effort": "S" },
  { "project": "Commencement Exercise Website", "office": "OUR", "priority": "Medium", "status": "Development", "developers": "AJ Alarcon", "start_date": "2026-09-07", "target_date": "2026-10-02", "deadline_fixed": null, "effort": "S" },
  { "project": "OUP Volunteers Portal", "office": "OUP", "priority": "Medium", "status": "Testing", "developers": "Arnold Celis", "start_date": "2026-08-10", "target_date": "2026-09-30", "deadline_fixed": "Yes", "effort": "M" },
  { "project": "SAFE Disaster Monitoring System", "office": "DRRM Committee", "priority": "Low", "status": "Parked", "developers": "Alex Bigal, Zak Pulmano", "start_date": "2026-08-17", "target_date": "2026-09-30", "deadline_fixed": "No", "effort": "M" },
  { "project": "AIMS", "office": "OUR", "priority": "High", "status": "Development", "developers": "Mark Sumaya, Alex Bigal, Bernard Secreto", "start_date": "Recurring", "target_date": "Recurring", "deadline_fixed": "NA", "effort": "XL" },
  { "project": "PIVOT", "office": "UPOU", "priority": "High", "status": "Development", "developers": "Renz Magsino", "start_date": "Recurring", "target_date": "Recurring", "deadline_fixed": "NA", "effort": "XL" },
  { "project": "FAIS", "office": "Accounting Office", "priority": "High", "status": "Development", "developers": "Arnold Celis, James Telosa", "start_date": "2025-11-01", "target_date": "2026-12-31", "deadline_fixed": "Yes", "effort": "XL" },
  { "project": "OAS with AI", "office": "OUR", "priority": "Critical", "status": "Development", "developers": "Bernard Secreto, AJ Alarcon", "start_date": null, "target_date": "2027-01-31", "deadline_fixed": "Yes", "effort": "XL" },
  { "project": "RPC", "office": "OVCAA", "priority": "High", "status": "Development", "developers": "Alex Bigal, Mark Sumaya", "start_date": "2026-09-07", "target_date": "2026-12-31", "deadline_fixed": "Yes", "effort": "M" },
  { "project": "Sustainability Website", "office": "A2C for Sustainability", "priority": "High", "status": "Development", "developers": "Renz Magsino", "start_date": "2026-09-08", "target_date": "2026-10-15", "deadline_fixed": "No", "effort": "S" },
  { "project": "MODeL Reconfiguration", "office": "OUP", "priority": "Medium", "status": "Not Started", "developers": null, "start_date": null, "target_date": "2026-12-15", "deadline_fixed": "Yes", "effort": "S" },
  { "project": "LUCID", "office": "UPOU", "priority": "Medium", "status": "Completed", "developers": "Renz Magsino", "start_date": null, "target_date": null, "deadline_fixed": null, "effort": "M" },
  { "project": "IREC", "office": "OVCAA", "priority": "Medium", "status": "Not Started", "developers": "James Telosa, AJ Alarcon", "start_date": "2026-10-01", "target_date": "2027-02-28", "deadline_fixed": null, "effort": "M" },
  { "project": "PIVOT-AI Prototype", "office": "UPOU", "priority": "High", "status": "Development", "developers": null, "start_date": "2026-09-08", "target_date": "2026-09-30", "deadline_fixed": null, "effort": "M" },
  { "project": "ICDE-Indico", "office": "ICDE Committee", "priority": "High", "status": "Development", "developers": "AJ Alarcon", "start_date": "2026-09-08", "target_date": "2026-09-23", "deadline_fixed": null, "effort": "S" }
];

// Populated synchronously so pages never see `undefined`; replaced by
// loadProjects() once the live fetch (or fallback) resolves.
let PROJECTS = FALLBACK_PROJECTS.slice();

const HEADER_ALIASES = {
  project:        ["project","project / system","project/system","system"],
  office:         ["office","requesting office"],
  priority:       ["priority"],
  status:         ["status"],
  developers:     ["developers","assigned to","staff","team","developer"],
  start_date:     ["start date","start_date"],
  target_date:    ["target date","target_date","deadline"],
  deadline_fixed: ["deadline fixed","deadline fixed?","deadline_fixed"],
  effort:         ["effort","effort / size","effort/size","size"]
};

function isNA(v){
  if(!v) return true;
  return /^n\/?a$/i.test(v.trim());
}

function normalizeDateCell(raw){
  if(!raw) return null;
  const s = raw.trim();
  if(!s || isNA(s)) return null;
  if(/^recurring$/i.test(s)) return "Recurring";
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // Google Sheets often exports MM/DD/YYYY
  if(us){
    const [, m, d, y] = us;
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  return s; // free-text estimate (e.g. "Est: November 2027") — kept as-is
}

/* Minimal CSV parser: handles quoted fields, embedded commas, and
   escaped quotes ("") — needed since developer lists and long project
   names routinely contain commas that Sheets wraps in quotes. */
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i], next = text[i+1];
    if(inQuotes){
      if(c === '"' && next === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field = ""; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ""; }
      else if(c === '\r'){ /* skip, \n handles the line break */ }
      else field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

function matchHeader(h){
  const clean = h.trim().toLowerCase().replace(/\s+/g," ");
  for(const [field, aliases] of Object.entries(HEADER_ALIASES)){
    if(aliases.includes(clean)) return field;
  }
  return null;
}

function rowsToProjects(rows){
  if(!rows.length) return [];
  const header = rows[0].map(matchHeader);
  return rows.slice(1).map(cells => {
    const rec = {};
    header.forEach((field, i) => {
      if(field) rec[field] = (cells[i] !== undefined ? cells[i] : "").trim();
    });
    if(!rec.project) return null;

    rec.office = rec.office || null;
    rec.priority = rec.priority || null;
    rec.status = (!rec.status || isNA(rec.status)) ? "Not Started" : rec.status;
    rec.developers = isNA(rec.developers) ? null : (rec.developers || null);
    rec.start_date = normalizeDateCell(rec.start_date);
    rec.target_date = normalizeDateCell(rec.target_date);
    rec.deadline_fixed = isNA(rec.deadline_fixed) ? null : (rec.deadline_fixed || null);
    rec.effort = rec.effort || null;
    return rec;
  }).filter(Boolean);
}

/* Fetches and parses the live sheet, updating the global PROJECTS array.
   Always resolves (never throws) — on any failure it falls back to the
   last-saved snapshot so the site stays usable. Returns a status object
   the caller can use to show a banner. */
async function loadProjects(){
  if(!SHEET_CSV_URL){
    PROJECTS = FALLBACK_PROJECTS.slice();
    return { ok:false, reason:"not-configured" };
  }
  try{
    const sep = SHEET_CSV_URL.includes("?") ? "&" : "?";
    const res = await fetch(SHEET_CSV_URL + sep + "_=" + Date.now()); // cache-bust
    if(!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const rows = parseCSV(text);
    const parsed = rowsToProjects(rows);
    if(!parsed.length) throw new Error("sheet returned no rows");
    PROJECTS = parsed;
    return { ok:true, count: parsed.length };
  } catch(err){
    console.error("Live sheet fetch failed — using last-saved snapshot:", err);
    PROJECTS = FALLBACK_PROJECTS.slice();
    return { ok:false, reason: err.message || "fetch failed" };
  }
}
