// ===========================================================
// TENANT TRAIL — Firebase configuration
//
// 1. Go to https://console.firebase.google.com and create a free project.
// 2. In your project, go to Project settings > General > Your apps,
//    click the </> (web) icon, and register an app.
// 3. Firebase will show you a config object — copy the values into
//    the object below.
// 4. In the Firebase console, enable:
//      - Authentication > Sign-in method > Email/Password
//      - Firestore Database (start in production mode)
//      - Storage
// 5. See README.md in this folder for the exact security rules to paste
//    into Firestore and Storage so only each tenant can see their own data.
// ===========================================================

const firebaseConfig = {
  apiKey: "AIzaSyCii2mvDjKL-6-WxEeita0GOnu8AJGJlqQ",
  authDomain: "rentproof-836dd.firebaseapp.com",
  projectId: "rentproof-836dd",
  storageBucket: "rentproof-836dd.firebasestorage.app",
  messagingSenderId: "463458130524",
  appId: "1:463458130524:web:7098dba74341b61a176499"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
