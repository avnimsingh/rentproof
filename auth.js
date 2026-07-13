import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { toast } from "./utils.js";

// If already signed in, skip straight to dashboard
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "index.html";
});

const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const form = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const submitBtn = document.getElementById("submitBtn");
const propertyField = document.getElementById("propertyField");

let mode = "login";

function setMode(next) {
  mode = next;
  tabLogin.classList.toggle("active", mode === "login");
  tabSignup.classList.toggle("active", mode === "signup");
  nameField.style.display = mode === "signup" ? "block" : "none";
  propertyField.style.display = mode === "signup" ? "block" : "none";
  submitBtn.textContent = mode === "signup" ? "Create account" : "Log in";
}

tabLogin.addEventListener("click", () => setMode("login"));
tabSignup.addEventListener("click", () => setMode("signup"));
setMode("login");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  submitBtn.disabled = true;
  submitBtn.textContent = "Please wait…";

  try {
    if (mode === "signup") {
      const name = document.getElementById("name").value.trim();
      const property = document.getElementById("property").value.trim();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        propertyAddress: property,
        createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    window.location.href = "index.html";
  } catch (err) {
    toast(friendlyError(err.code), true);
    submitBtn.disabled = false;
    setMode(mode);
  }
});

function friendlyError(code) {
  switch (code) {
    case "auth/email-already-in-use": return "That email already has an account — try logging in instead.";
    case "auth/invalid-email": return "That email address doesn't look right.";
    case "auth/weak-password": return "Use at least 6 characters for your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Email or password didn't match.";
    case "auth/user-not-found": return "No account found with that email.";
    default: return "Something went wrong. Try again.";
  }
}
