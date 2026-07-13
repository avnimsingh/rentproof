import { db } from "./firebase-config.js";
import { requireAuth, wireLogout, toast, stampHTML, escapeHTML, compressImage } from "./utils.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const user = await requireAuth();
wireLogout();

const profileSnap = await getDoc(doc(db, "users", user.uid));
document.getElementById("userName").textContent = profileSnap.exists() ? (profileSnap.data().name || user.email) : user.email;

const form = document.getElementById("ticketForm");
const photoInput = document.getElementById("photo");
const preview = document.getElementById("preview");
const saveBtn = document.getElementById("saveBtn");
let pendingPhoto = null;

photoInput.addEventListener("change", async () => {
  if (!photoInput.files[0]) { preview.style.display = "none"; return; }
  pendingPhoto = await compressImage(photoInput.files[0]);
  preview.innerHTML = `<div class="photo-tile" style="max-width:220px;"><img src="${pendingPhoto}" alt=""></div>`;
  preview.style.display = "block";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";
  try {
    await addDoc(collection(db, "maintenance"), {
      uid: user.uid,
      title: document.getElementById("title").value.trim(),
      description: document.getElementById("description").value.trim(),
      priority: document.getElementById("priority").value,
      status: "open",
      photo: pendingPhoto,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    toast("Request logged and timestamped.");
    form.reset();
    pendingPhoto = null;
    preview.style.display = "none";
    loadTickets();
  } catch (err) {
    toast("Couldn't save that request — try again.", true);
    console.error(err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Log request";
  }
});

async function loadTickets() {
  const list = document.getElementById("ticketList");
  list.innerHTML = `<p class="text-muted">Loading…</p>`;
  const q = query(collection(db, "maintenance"), where("uid", "==", user.uid));
  const snap = await getDocs(q);
  let tickets = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.createdAt);
  tickets.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  if (tickets.length === 0) {
    list.innerHTML = `
      <div class="card empty-state">
        ${stampHTML(new Date(), "No requests yet")}
        <h3 style="color:var(--ink-text);">Nothing logged</h3>
        <p>Log a repair request above the moment something needs fixing.</p>
      </div>`;
    return;
  }

  list.innerHTML = tickets.map(t => `
    <div class="card mt-1" data-id="${t.id}">
      <div class="flex-between">
        <div class="flex-gap">
          <span class="pill pill-${t.status === 'open' ? 'open' : t.status === 'in-progress' ? 'progress' : 'resolved'}">${t.status.replace('-', ' ')}</span>
          <h4 class="mt-0">${escapeHTML(t.title)}</h4>
        </div>
        ${stampHTML(t.createdAt.toDate(), "REPORTED")}
      </div>
      <p class="text-small text-muted">Priority: ${t.priority}</p>
      <p>${escapeHTML(t.description)}</p>
      ${t.photo ? `<div class="photo-tile" style="max-width:220px;"><img src="${t.photo}" alt=""></div>` : ""}
      <div class="flex-gap mt-1">
        <label class="text-small mb-0" style="margin:0;">Status:</label>
        <select class="status-select" style="width:auto;margin:0;padding:6px 10px;">
          <option value="open" ${t.status === "open" ? "selected" : ""}>Open</option>
          <option value="in-progress" ${t.status === "in-progress" ? "selected" : ""}>In progress</option>
          <option value="resolved" ${t.status === "resolved" ? "selected" : ""}>Resolved</option>
        </select>
        <button class="btn btn-danger btn-sm delete-btn">Delete</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".status-select").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      const card = e.target.closest("[data-id]");
      await updateDoc(doc(db, "maintenance", card.dataset.id), {
        status: e.target.value,
        updatedAt: serverTimestamp()
      });
      toast("Status updated.");
      loadTickets();
    });
  });

  list.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const card = e.target.closest("[data-id]");
      if (!confirm("Delete this maintenance request? This can't be undone.")) return;
      await deleteDoc(doc(db, "maintenance", card.dataset.id));
      toast("Request deleted.");
      loadTickets();
    });
  });
}

loadTickets();
