# GitHub Push Scheduler

V13 uses GitHub Actions as the scheduled backend. The website still uses Firebase FCM + Firestore.

The workflow runs every 5 minutes and can also be started manually.

Required GitHub repository secret:
`FIREBASE_SERVICE_ACCOUNT`

The secret value is the full Firebase service-account JSON. Do not commit it to the repository and do not put it in the PWA.

The scheduler reads the same timetable from `data.js`, uses each user's stored timezone/status, and sends at most one reminder per stage (start, +30, +60, session end). Opening the PWA acknowledges the current session in Firestore, stopping further reminders for that session.
