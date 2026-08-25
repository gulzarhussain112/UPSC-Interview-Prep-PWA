# Firebase push notifications

1. Create/choose a Firebase project.
2. Enable **Authentication → Anonymous**.
3. Enable **Cloud Firestore**.
4. Enable **Cloud Messaging**.
5. Create a Web App in Firebase Project Settings.
6. Put the Web App config and Web Push VAPID key into the root `firebase-config.js`.
7. Copy the same web config (without the VAPID key) into `firebase-messaging-sw.js`.
8. Install Firebase CLI, log in, select the project, and deploy `firebase/functions`.
9. Open the GitHub Pages PWA and choose **Enable Study Notifications**.

The scheduled Cloud Function checks every 5 minutes and sends reminders at session start, +30 min and +60 min when the app has not acknowledged the session. Opening the PWA acknowledges the current session and stops its reminder cycle.

The function uses each user's saved IANA timezone, so it follows the device timezone rather than assuming UTC.
