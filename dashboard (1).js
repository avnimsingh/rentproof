import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, stampHTML, escapeHTML } from "./utils.js";
import {
  collection, query, where, getDocs, doc, getDoc, updateDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireAuth();
wireLogout();

const profileSnap = await getDoc(doc(db, "users", user.uid));
const profile = profileSnap.exists() ? profileSnap.data() : {};
document.getElementById("userName").textContent = profile.name || user.email;
document.getElementById("greeting").textContent = profile.name ? `Welcome back, ${profile.name.split(" ")[0]}` : "Welcome back";

async function fetchAll(colName) {
  const q = query(collection(db, colName), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, col: colName, ...d.data() }));
}

const [inspections, maintenance, documents] = await Promise.all([
  fetchAll("inspections"),
  fetchAll("maintenance"),
  fetchAll("documents")
]);

const tiles = document.querySelectorAll("#statTiles .stat-tile .stat-num");
tiles[0].textContent = inspections.length;
tiles[1].textContent = maintenance.filter(m => m.status !== "resolved").length;
tiles[2].textContent = documents.length;

// Merge and sort recent activity
const all = [
  ...inspections.map(i => ({ ...i, kind: "Inspection", title: `${i.room} — ${i.walkthroughType === "move-in" ? "Move-in" : "Move-out"}` })),
  ...maintenance.map(m => ({ ...m, kind: "Maintenance", title: m.title })),
  ...documents.map(d => ({ ...d, kind: "Document", title: d.title }))
].filter(x => x.createdAt)
 .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
 .slice(0, 8);

const feed = document.getElementById("activityFeed");
if (all.length === 0) {
  feed.innerHTML = `
    <div class="empty-state">
      ${stampHTML(new Date(), "Nothing logged yet")}
      <h3>Your trail starts here</h3>
      <p>Log your first inspection, repair request, or document and it'll show up here.</p>
    </div>`;
} else {
  feed.innerHTML = all.map(item => `
    <div class="flex-between" style="padding:12px 0;border-bottom:1px solid var(--border);">
      <div>
        <span class="eyebrow" style="color:${kindColor(item.kind)}">${item.kind}</span>
        <div style="font-weight:600;">${escapeHTML(item.title)}</div>
      </div>
      <div class="text-small text-muted">${item.createdAt.toDate().toLocaleDateString()}</div>
    </div>
  `).join("");
}

function kindColor(kind) {
  if (kind === "Inspection") return "var(--tangerine)";
  if (kind === "Maintenance") return "#9A7325";
  return "var(--teal-dim)";
}

// ---------- What's next: simple, honest heuristics based on your actual data ----------

const actions = [];

const moveInEntries = inspections.filter(i => i.walkthroughType === "move-in");
const moveOutEntries = inspections.filter(i => i.walkthroughType === "move-out");

if (inspections.length === 0) {
  actions.push({
    tone: "tangerine",
    text: "You haven't logged a move-in walkthrough yet.",
    cta: "Start one", href: "inspection.html"
  });
} else if (moveInEntries.length > 0 && moveInEntries.length < 4) {
  actions.push({
    tone: "tangerine",
    text: `You've documented ${moveInEntries.length} room${moveInEntries.length === 1 ? "" : "s"} so far — most apartments have at least 4-5 worth logging.`,
    cta: "Keep going", href: "inspection.html"
  });
}

const staleTickets = maintenance.filter(m => {
  if (m.status === "resolved") return false;
  const days = (Date.now() - m.createdAt.toMillis()) / 86400000;
  return days >= 3;
});
staleTickets.forEach(t => {
  const days = Math.floor((Date.now() - t.createdAt.toMillis()) / 86400000);
  actions.push({
    tone: "danger",
    text: `"${t.title}" has been open for ${days} days with no resolution. Worth a written follow-up.`,
    cta: "View request", href: "maintenance.html"
  });
});

if (documents.length === 0) {
  actions.push({
    tone: "teal",
    text: "Your lease isn't on file yet. Add it so you're not digging through email later.",
    cta: "Add document", href: "documents.html"
  });
}

if (moveOutEntries.length > 0) {
  const mostRecent = moveOutEntries.reduce((a, b) => a.createdAt.toMillis() > b.createdAt.toMillis() ? a : b);
  const daysSince = Math.floor((Date.now() - mostRecent.createdAt.toMillis()) / 86400000);
  actions.push({
    tone: "teal",
    text: `It's been ${daysSince} day${daysSince === 1 ? "" : "s"} since your move-out walkthrough. Most states expect your deposit back within 14–30 days — check the exact number for your state below.`,
    cta: "See report", href: "report.html"
  });
}

const nextActionsEl = document.getElementById("nextActions");
if (actions.length === 0) {
  nextActionsEl.innerHTML = `<div class="card"><p class="text-muted" style="margin:0;">You're caught up — nothing urgent right now.</p></div>`;
} else {
  nextActionsEl.innerHTML = actions.map(a => `
    <div class="card mt-1" style="border-left:4px solid ${toneColor(a.tone)};">
      <div class="flex-between" style="flex-wrap:wrap;gap:10px;">
        <p style="margin:0;flex:1;min-width:200px;">${escapeHTML(a.text)}</p>
        <a href="${a.href}" class="btn btn-sm ${a.tone === 'danger' ? 'btn-danger' : 'btn-ghost-dark'}">${a.cta} →</a>
      </div>
    </div>
  `).join("");
}

function toneColor(tone) {
  if (tone === "tangerine") return "var(--tangerine)";
  if (tone === "danger") return "var(--danger)";
  return "var(--teal)";
}

// ---------- Know your rights ----------

const rightsPanel = document.getElementById("rightsPanel");
const NOLO_CHART_URL = "https://www.nolo.com/legal-encyclopedia/chart-deadline-returning-security-deposits-29018.html";

if (!profile.state) {
  rightsPanel.innerHTML = `
    <p class="text-muted">Add your state to see rights that actually apply to you.</p>
    <div class="flex-gap">
      <select id="stateInline" style="width:auto;margin:0;flex:1;">
        <option value="">Select your state…</option>
        ${["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"].map(s => `<option>${s}</option>`).join("")}
      </select>
      <button class="btn btn-teal btn-sm" id="saveStateBtn">Save</button>
    </div>
  `;
  document.getElementById("saveStateBtn").addEventListener("click", async () => {
    const val = document.getElementById("stateInline").value;
    if (!val) return;
    await updateDoc(doc(db, "users", user.uid), { state: val });
    profile.state = val;
    renderRights();
  });
} else {
  renderRights();
}

function renderRights() {
  rightsPanel.innerHTML = `
    <p class="text-small text-muted">For <strong>${escapeHTML(profile.state)}</strong> — general guidance, not legal advice. Laws change, so confirm specifics for your situation.</p>
    <ul style="padding-left:18px;margin:12px 0;">
      <li class="text-small">In every state, landlords can't charge you for normal wear and tear — minor scuffs, small nail holes, faded paint.</li>
      <li class="text-small">Give your forwarding address in writing on or before move-out day — in many states, the deposit-return clock doesn't start until they have it.</li>
      <li class="text-small">Take dated photos of every room right before you hand back keys. That's exactly what the Evidence Report is for.</li>
      <li class="text-small">If your landlord misses the deadline, many states make them forfeit the right to deduct anything at all.</li>
    </ul>
    <a href="${NOLO_CHART_URL}" target="_blank" rel="noopener" class="btn btn-ghost-dark btn-sm">Look up ${escapeHTML(profile.state)}'s exact deadline →</a>
  `;
}
