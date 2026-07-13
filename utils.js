// ===========================================================
// TENANT TRAIL — shared utilities
// ===========================================================

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Redirect to login if not signed in. Call at the top of every protected page.
// Returns a promise that resolves with the signed-in user.
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "login.html";
      } else {
        resolve(user);
      }
    });
  });
}

export function wireLogout(selector = "#logoutBtn") {
  const btn = document.querySelector(selector);
  if (btn) {
    btn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "login.html";
    });
  }
}

export function toast(message, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3200);
}

export function formatStamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return { datePart, timePart };
}

export function stampHTML(date, label = "DOCUMENTED", variant = "") {
  const { datePart, timePart } = formatStamp(date);
  return `
    <div class="stamp ${variant}">
      <span class="stamp-main">${label}</span>
      <span class="stamp-sub">${datePart} · ${timePart}</span>
    </div>
  `;
}

export function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Reads a File object and returns a compressed base64 data URL (JPEG),
// keeping images reasonably sized before upload to Storage.
export function compressImage(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height *= maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width *= maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}
