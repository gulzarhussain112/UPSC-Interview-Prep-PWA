const fs = require('fs');
const vm = require('vm');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const data = fs.readFileSync('../data.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(data + '\nthis.SCHEDULE = SCHEDULE;', ctx);
const SCHEDULE = ctx.SCHEDULE;

const SLOTS = [
  { slot: 0, start: 1080, end: 1170 },
  { slot: 1, start: 1185, end: 1275 },
  { slot: 2, start: 1320, end: 1380 }
];

function localNow(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const get = n => parts.find(x => x.type === n)?.value;

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute'))
  };
}

function trackEntry(statusMap, slot) {
  for (const d of Object.keys(SCHEDULE).sort()) {
    const e = (SCHEDULE[d] || [])[slot];

    if (e && statusMap[`${e[1]}||${e[2]}`] !== 'done') {
      return e;
    }
  }

  return null;
}

function sessionId(date, slot) {
  return `${date}__slot${slot}`;
}

function messageFor(stage, subject, topic) {
  if (stage === 0) {
    return {
      title: '🔔 UPSC STUDY TIME',
      body: `${subject} — ${topic}\nYour study session has started. Open the app and start now.`
    };
  }

  if (stage === 30) {
    return {
      title: '⚠️ 30 MINUTES GONE',
      body: `${subject} — ${topic}\nYou still haven't started. Don't waste another study opportunity.`
    };
  }

  if (stage === 60) {
    return {
      title: '⚠️ STRICT STUDY REMINDER',
      body: `${subject} — ${topic}\nOne hour is gone. The interview will not wait for you. Open the app now.`
    };
  }

  return {
    title: '🚨 STUDY SESSION MISSED',
    body: `${subject} — ${topic}\nYour scheduled study time is over. Open the app and record what happened.`
  };
}

async function sendForUser(userDoc) {
  const u = userDoc.data();

  if (!u.enabled || !u.fcmToken || !u.timezone) {
    return;
  }

  const now = localNow(u.timezone);
  const day = SCHEDULE[now.date];

  if (!day) {
    return;
  }

  for (const slotInfo of SLOTS) {
    const e = trackEntry(u.status || {}, slotInfo.slot);

    if (!e) {
      continue;
    }

    const id = sessionId(now.date, slotInfo.slot);
    const ref = userDoc.ref.collection('sessions').doc(id);
    const snap = await ref.get();
    const session = snap.exists ? snap.data() : {};

    // Opening the PWA during the session marks it acknowledged
    // and stops further reminders.
    if (session.acknowledged) {
      continue;
    }

    const elapsed = now.minutes - slotInfo.start;
    let stage = null;

    if (elapsed >= 0 && elapsed < slotInfo.end - slotInfo.start) {
      if (elapsed < 30) {
        stage = 0;
      } else if (elapsed < 60) {
        stage = 30;
      } else {
        stage = 60;
      }
    } else if (elapsed >= slotInfo.end - slotInfo.start) {
      stage = 90;
    }

    if (stage === null) {
      continue;
    }

    if (session.lastReminderStage === stage) {
      continue;
    }

    const msg = messageFor(stage, e[1], e[2]);

    try {
      await messaging.send({
        token: u.fcmToken,
        data: {
          title: msg.title,
          body: msg.body,
          sessionId: id,
          date: now.date,
          slot: String(slotInfo.slot),
          url: './index.html',
          event: stage === 90 ? 'session_end' : 'reminder',
          stage: String(stage)
        }
      });

      await ref.set({
        date: now.date,
        slot: slotInfo.slot,
        start: slotInfo.start,
        end: slotInfo.end,
        subject: e[1],
        topic: e[2],
        lastReminderStage: stage,
        lastReminderAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(
        'Sent',
        msg.title,
        'to',
        userDoc.id,
        id
      );

    } catch (err) {
      console.error(
        'FCM error for',
        userDoc.id,
        err.code || err.message
      );

      if (
        [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token'
        ].includes(err.code)
      ) {
        await userDoc.ref.set(
          { enabled: false },
          { merge: true }
        );
      }
    }
  }
}

(async () => {
  const users = await db.collection('users').get();

  console.log(
    `Checking ${users.size} users at ${new Date().toISOString()}`
  );

  for (const doc of users.docs) {
    await sendForUser(doc);
  }
})();
