# RentProof

A documentation and evidence-tracking tool for renters — log move-in/move-out inspections with timestamped photos, track maintenance requests, file away lease documents and receipts, and generate a compiled evidence report.

## What's inside

```
rentproof/
├── index.html          Dashboard
├── login.html           Sign up / log in
├── inspection.html       Move-in/move-out walkthroughs
├── maintenance.html      Repair request tracker
├── documents.html        Lease, receipts, communications
├── report.html           Compiled, downloadable evidence report
├── css/style.css         All styling
└── js/
    ├── firebase-config.js   ← you edit this
    ├── utils.js
    ├── auth.js
    ├── dashboard.js
    ├── inspection.js
    ├── maintenance.js
    ├── documents.js
    └── report.js
```

## Why Firebase, and a note on photo storage

This app uses **Firebase** (Google's free backend platform) for two things:
- **Authentication** — so your data is private to your account
- **Firestore** — a real database, so your entries persist across devices and don't disappear if you clear your browser

Normally an app like this would also use **Firebase Storage** for photos. As of February 2026, Google now requires a linked credit card (the "Blaze" plan) to use Storage at all, even if you never go over the free quota. To keep this fully free with zero billing setup, photos are compressed in the browser and stored directly inside Firestore documents instead. This comfortably handles normal use (a handful of photos per inspection entry) and keeps everything on Firebase's no-cost "Spark" plan. If you ever want the more "textbook" architecture, Storage is a clean swap-in later — ask me and I'll wire it up.

## Setup (about 10 minutes)

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
2. Name it whatever you like (e.g. "rentproof"). You can skip Google Analytics.

### 2. Register a web app
1. In your new project, click the **</>** (web) icon on the project overview page.
2. Give it a nickname and click **Register app**.
3. Firebase shows you a `firebaseConfig` object — copy it.
4. Open `js/firebase-config.js` in this project and paste your values in, replacing the placeholders.

### 3. Turn on Authentication
1. In the left sidebar, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.

### 4. Turn on Firestore
1. Go to **Build → Firestore Database → Create database**.
2. Choose **Start in production mode** and pick a location close to you (e.g. `us-central`).
3. Once created, go to the **Rules** tab and replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /inspections/{entryId} {
      allow read, update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }

    match /maintenance/{entryId} {
      allow read, update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }

    match /documents/{entryId} {
      allow read, update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }
  }
}
```

4. Click **Publish**. This is what keeps everyone's data private to their own account — without it, anyone could read anyone else's data.

### 5. Test it locally (optional)
Because this uses ES modules, opening `index.html` directly (`file://`) won't work in most browsers. Run a quick local server from inside the folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/login.html`.

### 6. Deploy to GitHub Pages
Same process as your other projects:
1. Push this folder to a GitHub repo.
2. Go to **Settings → Pages** in the repo.
3. Set the source to your main branch, root folder.
4. Your site will be live at `https://yourusername.github.io/repo-name/login.html`.

## Free tier limits (Spark plan)
For reference, the free tier includes 50,000 monthly active users for Auth, and roughly 1 GiB of Firestore storage with 50,000 reads and 20,000 writes per day. For a personal project like this, you won't come close to any of those limits.

## Ideas if you want to extend it later
- Export a room's photos as a single PDF instead of the whole report
- Add a "share read-only link" so a landlord or new roommate can view a report without logging in
- Add reminders for recurring things like renter's insurance renewal
- Swap in Firebase Storage once you're comfortable linking a (still-free-tier) billing account
