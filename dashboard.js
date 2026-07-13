import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, stampHTML, escapeHTML } from "./utils.js";
import {
  collection, query, where, getDocs, doc, getDoc, orderBy, limit
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
