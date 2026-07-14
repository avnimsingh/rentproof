import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, toast, stampHTML, escapeHTML, compressImage } from "./utils.js";
import {
  collection, addDoc, deleteDoc, doc, getDoc, query, where, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireAuth();
wireLogout();

const profileSnap = await getDoc(doc(db, "users", user.uid));
document.getElementById("userName").textContent = profileSnap.exists() ? (profileSnap.data().name || user.email) : user.email;

// Standard rooms + what to actually check in each — this is the "guided" part
const DEFAULT_CHECKLISTS = {
  "Kitchen": ["Countertops and backsplash", "Inside cabinets and drawers", "Every stove burner and the oven", "Fridge interior, shelves, and door seals", "Under the sink for leaks or water damage", "Floor condition, especially near the sink and stove"],
  "Bathroom": ["Toilet base for leaks or looseness", "Tub/shower caulking and grout for mold", "Sink, faucet, and drain", "Mirror, cabinet, and any chips", "Exhaust fan works", "Floor and baseboards near the tub"],
  "Bedroom": ["Walls for holes, marks, or old patches", "Closet interior and shelving", "Windows open, close, and lock properly", "Flooring or carpet condition, including corners", "Light fixtures, switches, and outlets"],
  "Living Room": ["Walls and baseboards", "Flooring condition throughout", "Windows, blinds, or curtains", "Light fixtures, switches, and outlets", "Any built-ins, shelving, or fireplace"],
  "Entryway": ["Front door, frame, and locks", "Peephole or security features", "Flooring right inside the door", "Light fixture"],
  "Laundry / Utility": ["Washer/dryer condition, if provided", "Area around the water heater", "Visible pipes for leaks or corrosion"]
};

let customChecklists = JSON.parse(localStorage.getItem("rp_custom_rooms") || "{}");
let activeType = "move-in";
let entries = [];
let currentRoom = null;
let pendingImages = [];

const typeSelect = document.getElementById("walkthroughType");
const roomGrid = document.getElementById("roomGrid");
const modal = document.getElementById("entryModal");
const modalRoomTitle = document.getElementById("modalRoomTitle");
const checklistHints = document.getElementById("checklistHints");
const entryForm = document.getElementById("entryForm");
const photosInput = document.getElementById("photos");
const previewGrid = document.getElementById("previewGrid");
const saveBtn = document.getElementById("saveBtn");

typeSelect.addEventListener("change", () => {
  activeType = typeSelect.value;
  renderRoomGrid();
});

document.getElementById("addRoomBtn").addEventListener("click", () => {
  const input = document.getElementById("customRoomName");
  const name = input.value.trim();
  if (!name) return;
  customChecklists[name] = [];
  localStorage.setItem("rp_custom_rooms", JSON.stringify(customChecklists));
  input.value = "";
  renderRoomGrid();
});

document.getElementById("closeModalBtn").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

function allRooms() {
  return { ...DEFAULT_CHECKLISTS, ...customChecklists };
}

function roomEntry(roomName) {
  return entries.find(e => e.room === roomName && e.walkthroughType === activeType);
}

function renderRoomGrid() {
  const rooms = allRooms();
  const names = Object.keys(rooms);
  const done = names.filter(n => roomEntry(n)).length;

  document.getElementById("progressLabel").textContent = `${done} of ${names.length} rooms documented`;
  document.getElementById("progressBar").style.width = names.length ? `${(done / names.length) * 100}%` : "0%";

  roomGrid.innerHTML = names.map(name => {
    const existing = roomEntry(name);
    return `
      <div class="card-dark room-card" data-room="${escapeHTML(name)}" style="cursor:pointer;border-color:${existing ? 'var(--teal)' : 'var(--border-light)'};">
        <div class="flex-between">
          <h4 style="margin:0;">${escapeHTML(name)}</h4>
          ${existing ? '<span class="pill pill-resolved">Documented</span>' : '<span class="pill pill-open">Not started</span>'}
        </div>
        <p class="text-small text-muted mt-1" style="margin-bottom:0;">${rooms[name].length ? rooms[name].length + " things to check" : "Custom room"}</p>
      </div>
    `;
  }).join("");

  roomGrid.querySelectorAll(".room-card").forEach(card => {
    card.addEventListener("click", () => openModal(card.dataset.room));
  });
}

function openModal(roomName) {
  currentRoom = roomName;
  pendingImages = [];
  previewGrid.innerHTML = "";
  previewGrid.style.display = "none";
  entryForm.reset();

  modalRoomTitle.textContent = `${roomName} — ${activeType === "move-in" ? "Move-in" : "Move-out"}`;
  const hints = allRooms()[roomName] || [];
  const existing = roomEntry(roomName);

  checklistHints.innerHTML = hints.length
    ? `<div class="eyebrow" style="color:var(--tangerine-dim);margin-bottom:8px;">Worth checking</div><ul style="margin:0;padding-left:18px;">${hints.map(h => `<li class="text-small">${escapeHTML(h)}</li>`).join("")}</ul>`
    : `<p class="text-small text-muted" style="margin:0;">No preset checklist for this room — just note anything worth documenting.</p>`;

  if (existing) {
    document.getElementById("notes").value = existing.notes || "";
  }

  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
  currentRoom = null;
}

photosInput.addEventListener("change", async () => {
  pendingImages = [];
  previewGrid.innerHTML = "";
  const files = Array.from(photosInput.files).slice(0, 6);
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

entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    await addDoc(collection(db, "inspections"), {
      uid: user.uid,
      walkthroughType: activeType,
      room: currentRoom,
      notes: document.getElementById("notes").value.trim(),
      photos: pendingImages,
      createdAt: serverTimestamp()
    });
    toast(`${currentRoom} saved and timestamped.`);
    closeModal();
    await loadEntries();
  } catch (err) {
    toast("Couldn't save that entry — try again.", true);
    console.error(err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save room entry";
  }
});

async function loadEntries() {
  const q = query(collection(db, "inspections"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.createdAt);
  entries.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  renderRoomGrid();
  renderEntryList();
}

function renderEntryList() {
  const list = document.getElementById("entryList");
  if (entries.length === 0) {
    list.innerHTML = `
      <div class="card empty-state">
        ${stampHTML(new Date(), "No entries yet")}
        <h3 style="color:var(--ink-text);">Start with the rooms above</h3>
        <p>Click a room card to begin documenting it.</p>
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
      await loadEntries();
    });
  });
}

renderRoomGrid();
loadEntries();
