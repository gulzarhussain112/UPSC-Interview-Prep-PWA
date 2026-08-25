# Firebase Push Notifications — Setup

The PWA code is ready, but push notifications cannot be activated until it is connected to your Firebase project.

## 1. Firebase Console

Create/select your Firebase project.

Enable:
- Authentication → Sign-in method → Anonymous
- Firestore Database
- Cloud Messaging

Add a **Web App** under Project settings → Your apps.

Copy its web configuration into `firebase-config.js`.

## 2. Web Push VAPID key

Firebase Console → Project settings → Cloud Messaging → Web configuration → Web Push certificates.

Generate a key pair and put the public key into:

`firebase-config.js` → `vapidKey`

## 3. Messaging service worker

Put the same Firebase Web App values into:

`firebase-messaging-sw.js`

This file must be at the PWA root, next to `index.html`.

## 4. Firestore rules

Deploy the included `firestore.rules`.

The app uses anonymous Firebase Auth, so each browser gets its own Firebase UID. The UID owns its token/settings and session acknowledgement records.

## 5. Deploy the Cloud Function

Install Firebase CLI if needed:

`npm install -g firebase-tools`

Log in:

`firebase login`

From the project root:

`firebase use YOUR_PROJECT_ID`

Then:

`firebase deploy --only firestore:rules,functions`

The scheduled function is:

`studyReminderTick`

It runs every 5 minutes and sends reminders at:
- session start
- +30 minutes
- +60 minutes
- session end

It stops sending for a session after the PWA acknowledges that session.

### Billing note

Scheduled Cloud Functions / Cloud Scheduler may require a Firebase/Google Cloud billing-enabled project (Blaze plan). Check the current Firebase pricing/plan requirements in your console before deployment.

## 6. GitHub Pages

The PWA itself can remain on GitHub Pages.

After deploying:
1. Open the HTTPS GitHub Pages URL.
2. Go to Progress → Study reminders.
3. Click **Enable Study Notifications**.
4. Allow browser notifications.
5. Test while the PWA is closed.

## Security note

Firebase Web App config and the FCM VAPID public key are not admin secrets. Never put a Firebase Admin SDK private key/service-account JSON in the website.


## Current project
The PWA has already been configured for Firebase project `interview-prep-upsc`.
Only the **Web Push VAPID public key** is still required in `firebase-config.js`.


## VAPID
The Web Push VAPID public key has been added to `firebase-config.js` for the registered Firebase project.
