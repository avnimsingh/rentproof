import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, toast, stampHTML, escapeHTML, compressImage } from "./utils.js";
import {
  collection, addDoc, deleteDoc, doc, getDoc, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireAuth();
wireLogout();

const profileSnap = await getDoc(doc(db, "users", user.uid));
document.getElementById("userName").textContent = profileSnap.exists() ? (profileSnap.data().name || user.email) : user.email;

const form = document.getElementById("docForm");
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");
const saveBtn = document.getElementById("saveBtn");
let pendingFile = null;
let activeFilter = "all";
let cachedDocs = [];

fileInput.addEventListener("change", async () => {
  if (!fileInput.files[0]) { preview.style.display = "none"; return; }
  pendingFile = await compressImage(fileInput.files[0]);
  preview.innerHTML = `<div class="photo-tile" style="max-width:220px;"><img src="${pendingFile}" alt=""></div>`;
  preview.style.display = "block";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    await addDoc(collection(db, "documents"), {
      uid: user.uid,
      category: document.getElementById("category").value,
      title: document.getElementById("title").value.trim(),
      notes: document.getElementById("notes").value.trim(),
      file: pendingFile,
      createdAt: serverTimestamp()
    });
    toast("Document filed.");
    form.reset();
    pendingFile = null;
    preview.style.display = "none";
    loadDocs();
  } catch (err) {
    toast("Couldn't save that document — try again.", true);
    console.error(err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save document";
  }
});

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.cat;
    render();
  });
});

async function loadDocs() {
  const q = query(collection(db, "documents"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  cachedDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.createdAt);
  cachedDocs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  render();
}

const categoryLabels = { lease: "Lease", receipt: "Receipt", communication: "Communication", other: "Other" };

function render() {
  const list = document.getElementById("docList");
  const items = activeFilter === "all" ? cachedDocs : cachedDocs.filter(d => d.category === activeFilter);

  if (items.length === 0) {
    list.innerHTML = `
      <div class="card empty-state">
        ${stampHTML(new Date(), "No documents filed")}
        <h3 style="color:var(--ink-text);">Nothing here yet</h3>
        <p>Save your lease, a receipt, or a screenshot of a message above.</p>
      </div>`;
    return;
  }

  list.innerHTML = `<div class="grid grid-2">` + items.map(d => `
    <div class="card" data-id="${d.id}">
      <div class="flex-between">
        <span class="pill pill-progress">${categoryLabels[d.category] || "Other"}</span>
        ${stampHTML(d.createdAt.toDate(), "FILED", "teal")}
      </div>
      <h4 style="margin-top:10px;">${escapeHTML(d.title)}</h4>
      ${d.notes ? `<p class="text-small text-muted">${escapeHTML(d.notes)}</p>` : ""}
      ${d.file ? `<div class="photo-tile"><img src="${d.file}" alt=""></div>` : ""}
      <button class="btn btn-danger btn-sm mt-1 delete-btn">Delete</button>
    </div>
  `).join("") + `</div>`;

  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest("[data-id]");
      if (!confirm("Delete this document? This can't be undone.")) return;
      await deleteDoc(doc(db, "documents", card.dataset.id));
      toast("Document deleted.");
      loadDocs();
    });
  });
}

loadDocs();
