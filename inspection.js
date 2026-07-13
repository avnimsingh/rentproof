import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, toast, stampHTML, escapeHTML, compressImage } from "./utils.js";
import {
  collection, addDoc, deleteDoc, doc, getDoc, query, where, getDocs,
  serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireAuth();
wireLogout();

const profileSnap = await getDoc(doc(db, "users", user.uid));
document.getElementById("userName").textContent = profileSnap.exists() ? (profileSnap.data().name || user.email) : user.email;

const form = document.getElementById("entryForm");
const photosInput = document.getElementById("photos");
const previewGrid = document.getElementById("previewGrid");
const saveBtn = document.getElementById("saveBtn");
let pendingImages = [];

photosInput.addEventListener("change", async () => {
  pendingImages = [];
  previewGrid.innerHTML = "";
  const files = Array.from(photosInput.files).slice(0, 6); // cap per entry to keep doc size sane
  for (const file of files) {
    const dataUrl = await compressImage(file);
    pendingImages.push(dataUrl);
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.innerHTML = `<img src="${dataUrl}" alt="">`;
    previewGrid.appendChild(tile);
  }
  previewGrid.style.display = pendingImages.length ? "grid" : "none";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    await addDoc(collection(db, "inspections"), {
      uid: user.uid,
      walkthroughType: document.getElementById("walkthroughType").value,
      room: document.getElementById("room").value.trim(),
      notes: document.getElementById("notes").value.trim(),
      photos: pendingImages,
      createdAt: serverTimestamp()
    });
    toast("Entry saved and timestamped.");
    form.reset();
    pendingImages = [];
    previewGrid.innerHTML = "";
    previewGrid.style.display = "none";
    loadEntries();
  } catch (err) {
    toast("Couldn't save that entry — try again.", true);
    console.error(err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save entry";
  }
});

async function loadEntries() {
  const list = document.getElementById("entryList");
  list.innerHTML = `<p class="text-muted">Loading…</p>`;
  const q = query(collection(db, "inspections"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  let entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.createdAt);
  entries.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  if (entries.length === 0) {
    list.innerHTML = `
      <div class="card empty-state">
        ${stampHTML(new Date(), "No entries yet")}
        <h3 style="color:var(--ink-text);">Start your first walkthrough</h3>
        <p>Log a room above to begin building your record.</p>
      </div>`;
    return;
  }

  list.innerHTML = entries.map(e => `
    <div class="card mt-1" data-id="${e.id}">
      <div class="flex-between">
        <div>
          <span class="pill ${e.walkthroughType === "move-in" ? "pill-resolved" : "pill-open"}">${e.walkthroughType}</span>
          <h4 class="mt-0" style="margin-top:8px;">${escapeHTML(e.room)}</h4>
        </div>
        ${stampHTML(e.createdAt.toDate())}
      </div>
      <p>${escapeHTML(e.notes)}</p>
      ${e.photos && e.photos.length ? `
        <div class="grid grid-3">
          ${e.photos.map(p => `
            <div class="photo-tile">
              <img src="${p}" alt="Room photo">
              <div class="tile-stamp">${e.createdAt.toDate().toLocaleString()}</div>
            </div>`).join("")}
        </div>` : ""}
      <button class="btn btn-danger btn-sm mt-1 delete-btn">Delete entry</button>
    </div>
  `).join("");

  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest("[data-id]");
      if (!confirm("Delete this inspection entry? This can't be undone.")) return;
      await deleteDoc(doc(db, "inspections", card.dataset.id));
      toast("Entry deleted.");
      loadEntries();
    });
  });
}

loadEntries();
