# UPSC Scientific Officer / Programmer Interview Prep PWA

## Evening clock logic
The timetable is interpreted in local device time:
- 6:00–7:30 PM — Period 1
- 7:45–9:15 PM — Period 2
- 9:15–9:30 PM — Quick revision
- 9:30–10:00 PM — Dinner
- 10:00–11:00 PM — Period 3
- 11:00–11:30 PM — Recall

The live dashboard checks the device clock every second and tells you what to study and how much time remains.

## GitHub Pages
Upload the project files to a repository and enable Settings → Pages → Deploy from `main` / root.


## V5
- Every master topic now has a focused 'What to study / capture' checklist.
- The live study card shows those key points for the current topic.
- Opening the app outside study hours now explicitly shows 'Outside study schedule' and the next scheduled session/countdown, including the next day after the final session.


## PWA installation / local testing

A PWA cannot be installed from a `file://` URL because service workers require a secure context.
Use either:
1. GitHub Pages (HTTPS) — recommended for the real deployment; or
2. localhost — for local testing, e.g. `python -m http.server 8080`, then open `http://localhost:8080/`.

The app includes 192x192 and 512x512 PNG icons and a manifest suitable for browser installation.


## V7 PWA manifest audit fixes
- Added manifest `id` matching `/UPSC-Interview-Prep-PWA/`.
- Added square 192px and 512px PNG icons with `any` and `maskable` purposes.
- Added desktop `wide` and mobile screenshots for richer install UI.
- Added `display_override`.
- Added a `web+upscprep` protocol handler.
- Updated the service-worker cache to include all manifest assets.

If GitHub Pages still reports an icon as failed to load, open the exact icon URL directly in the browser. The file must return HTTP 200 and an image content type; after replacing the repository files, wait for GitHub Pages/CDN propagation and refresh the manifest/application tab.


## V8 asset structure
The PWA now follows the same proven structure as the existing Excel Record Viewer:
- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`
- `assets/screenshots/desktop-wide.png`
- `assets/screenshots/mobile.png`

The manifest uses absolute GitHub Pages HTTPS URLs for these assets.


## V9 learning flow + sticky notes
- Syllabus progression is now completion-based within each parallel study track; missed calendar days do not silently skip unfinished lessons.
- The live 6:00/7:45/10:00 sessions select the first unfinished topic in their respective track.
- Added a dedicated **My Sticky Notes** view.
- Notes are stored per subject + topic in localStorage, timestamped, searchable by topic via the Open Topic action, and remain on the device until cleared/reset.


## V10 status-button UX
- The selected topic's current status button is visibly locked/disabled.
- The other two status actions remain available.
- Status buttons have hover, press, saving, and saved visual feedback.
- The behavior is scoped to the currently selected topic only.


## V11 session workflow
- Removed permanent status buttons from the topic detail card.
- At the end of a study session, a modal asks: **Completed / Partially Studied / Needs Revision**.
- The choice is saved to the topic and the modal closes.
- Partial and Revision are separate queues.
- Added Firebase Cloud Messaging scaffolding for reminders when the PWA is closed.
- The push backend is in `firebase/functions`; Firebase web config/VAPID values must be supplied before real push notifications can operate.


### V11.1 correction
Opening a session during its study period stops push reminders but does not mark the session result. At the scheduled end, the app still asks for Completed / Partial / Revision until a result is recorded. The Firebase function also sends a session-missed push at the end when the session remains unacknowledged.


## V12 Firebase push
Firebase push is wired for real FCM notifications. Complete `FIREBASE-SETUP.md`, configure `firebase-config.js` and `firebase-messaging-sw.js`, then deploy the included Cloud Function and Firestore rules.
