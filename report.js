import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, escapeHTML } from "./utils.js";
import {
  collection, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireAuth();
wireLogout();

const profileSnap = await getDoc(doc(db, "users", user.uid));
const profile = profileSnap.exists() ? profileSnap.data() : {};
document.getElementById("userName").textContent = profile.name || user.email;

document.getElementById("printBtn").addEventListener("click", () => window.print());

async function fetchAll(colName) {
  const q = query(collection(db, colName), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.createdAt);
}

const [inspections, maintenance, documents] = await Promise.all([
  fetchAll("inspections"),
  fetchAll("maintenance"),
  fetchAll("documents")
]);

inspections.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
maintenance.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
documents.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

const now = new Date();
const container = document.getElementById("reportContent");

container.innerHTML = `
  <div class="report-header">
    <div>
      <div class="eyebrow" style="color:var(--tangerine-dim);">RentProof — Evidence Report</div>
      <h2 style="margin-top:6px;">${escapeHTML(profile.name || "Tenant record")}</h2>
      ${profile.propertyAddress ? `<div class="text-muted text-small">${escapeHTML(profile.propertyAddress)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div class="text-small text-muted">Generated</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${now.toLocaleDateString()} · ${now.toLocaleTimeString()}</div>
    </div>
  </div>

  <div class="grid grid-3" style="margin-bottom:10px;">
    <div><strong>${inspections.length}</strong><div class="text-small text-muted">Inspection entries</div></div>
    <div><strong>${maintenance.length}</strong><div class="text-small text-muted">Maintenance requests</div></div>
    <div><strong>${documents.length}</strong><div class="text-small text-muted">Documents</div></div>
  </div>

  <div class="report-section-title">Inspection walkthroughs</div>
  ${inspections.length === 0 ? emptyLine("No inspection entries logged.") : inspections.map(i => `
    <div class="report-entry">
      <div class="flex-between">
        <strong>${escapeHTML(i.room)} — ${i.walkthroughType === "move-in" ? "Move-in" : "Move-out"}</strong>
        <span class="text-small text-muted">${i.createdAt.toDate().toLocaleString()}</span>
      </div>
      <p class="text-small">${escapeHTML(i.notes)}</p>
      ${i.photos && i.photos.length ? `<div class="report-photos">${i.photos.map(p => `<img src="${p}">`).join("")}</div>` : ""}
    </div>
  `).join("")}

  <div class="report-section-title">Maintenance requests</div>
  ${maintenance.length === 0 ? emptyLine("No maintenance requests logged.") : maintenance.map(m => `
    <div class="report-entry">
      <div class="flex-between">
        <strong>${escapeHTML(m.title)}</strong>
        <span class="text-small text-muted">Reported ${m.createdAt.toDate().toLocaleString()}</span>
      </div>
      <p class="text-small text-muted">Priority: ${m.priority} · Status: ${m.status}</p>
      <p class="text-small">${escapeHTML(m.description)}</p>
      ${m.photo ? `<div class="report-photos"><img src="${m.photo}"></div>` : ""}
    </div>
  `).join("")}

  <div class="report-section-title">Documents on file</div>
  ${documents.length === 0 ? emptyLine("No documents filed.") : documents.map(d => `
    <div class="report-entry">
      <div class="flex-between">
        <strong>${escapeHTML(d.title)}</strong>
        <span class="text-small text-muted">Filed ${d.createdAt.toDate().toLocaleString()}</span>
      </div>
      <p class="text-small text-muted">Category: ${d.category}</p>
      ${d.notes ? `<p class="text-small">${escapeHTML(d.notes)}</p>` : ""}
      ${d.file ? `<div class="report-photos"><img src="${d.file}"></div>` : ""}
    </div>
  `).join("")}

  <div class="divider-light"></div>
  <p class="text-small text-muted">This report was generated automatically from timestamped entries logged in RentProof. Each entry's timestamp reflects the date and time it was originally saved.</p>
`;

function emptyLine(text) {
  return `<p class="text-small text-muted">${text}</p>`;
}
