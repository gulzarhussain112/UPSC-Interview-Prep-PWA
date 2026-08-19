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
