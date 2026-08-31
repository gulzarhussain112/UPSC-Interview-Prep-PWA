const fs = require('fs');
const vm = require('vm');
const admin = require('firebase-admin');

/*
===========================================================
TEMPORARY TEST SWITCH
===========================================================

Set this to TRUE only when you want to test notifications.

TRUE  = send a test notification immediately to every
        enabled user having an FCM token.

FALSE = use the normal study timetable scheduler.
*/
const TEST_NOTIFICATION = false;


admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();


/* =========================================================
   LOAD SCHEDULE
   ========================================================= */

const data = fs.readFileSync('../data.js', 'utf8');

const ctx = {};

vm.createContext(ctx);

vm.runInContext(
  data + '\nthis.SCHEDULE = SCHEDULE;',
  ctx
);

const SCHEDULE = ctx.SCHEDULE;


/* =========================================================
   STUDY SLOTS
   ========================================================= */

const SLOTS = [
  {
    slot: 0,
    start: 1080,
    end: 1170
  },
  {
    slot: 1,
    start: 1185,
    end: 1275
  },
  {
    slot: 2,
    start: 1320,
    end: 1380
  }
];


/* =========================================================
   TIMEZONE
   ========================================================= */

function localNow(timeZone) {

  const parts =
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());


  const get = n =>
    parts.find(x => x.type === n)?.value;


  return {

    date:
      `${get('year')}-${get('month')}-${get('day')}`,

    minutes:
      Number(get('hour')) * 60 +
      Number(get('minute'))

  };

}


/* =========================================================
   FIND NEXT TRACK TOPIC
   ========================================================= */

function trackEntry(statusMap, slot) {

  for (const d of Object.keys(SCHEDULE).sort()) {

    const e =
      (SCHEDULE[d] || [])[slot];


    if (
      e &&
      statusMap[`${e[1]}||${e[2]}`] !== 'done'
    ) {

      return e;

    }

  }

  return null;

}


/* =========================================================
   SESSION ID
   ========================================================= */

function sessionId(date, slot) {

  return `${date}__slot${slot}`;

}


/* =========================================================
   NORMAL MESSAGE
   ========================================================= */

function messageFor(stage, subject, topic) {

  if (stage === 0) {

    return {

      title: '🔔 UPSC STUDY TIME',

      body:
        `${subject} — ${topic}\n` +
        `Your study session has started. ` +
        `Open the app and start now.`

    };

  }


  if (stage === 30) {

    return {

      title: '⚠️ 30 MINUTES GONE',

      body:
        `${subject} — ${topic}\n` +
        `You still haven't started. ` +
        `Don't waste another study opportunity.`

    };

  }


  if (stage === 60) {

    return {

      title: '⚠️ STRICT STUDY REMINDER',

      body:
        `${subject} — ${topic}\n` +
        `One hour is gone. ` +
        `The interview will not wait for you. ` +
        `Open the app now.`

    };

  }


  return {

    title: '🚨 STUDY SESSION MISSED',

    body:
      `${subject} — ${topic}\n` +
      `Your scheduled study time is over. ` +
      `Open the app and record what happened.`

  };

}


/* =========================================================
   TEMPORARY TEST NOTIFICATION
   ========================================================= */

async function sendTestNotification(userDoc) {

  const u = userDoc.data();


  /*
  Ignore devices that have no usable registration token.
  */

  if (
    !u.enabled ||
    !u.fcmToken
  ) {

    console.log(
      'Skipping user without active token:',
      userDoc.id
    );

    return;

  }


  const message = {

    token: u.fcmToken,

    data: {

      title: '🔔 UPSC TEST NOTIFICATION',

      body:
        'FCM is working correctly. ' +
        'Your UPSC study reminders are connected.',

      sessionId:
        `TEST-${Date.now()}`,

      url:
        './index.html',

      event:
        'test',

      stage:
        'test'

    }

  };


  try {

    const response =
      await messaging.send(message);


    console.log(
      '✅ TEST NOTIFICATION SENT',
      'User:',
      userDoc.id,
      'FCM response:',
      response
    );

  }
  catch (err) {

    console.error(
      '❌ TEST FCM ERROR',
      'User:',
      userDoc.id,
      err.code || err.message
    );


    /*
    Automatically disable stale/invalid tokens.
    */

    if (
      [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token'
      ].includes(err.code)
    ) {

      console.log(
        '🧹 Removing stale notification device:',
        userDoc.id
      );


      await userDoc.ref.set({

        enabled: false,

        fcmToken: admin.firestore.FieldValue.delete(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()

      }, {
        merge: true
      });

    }

  }

}


/* =========================================================
   NORMAL SCHEDULER
   ========================================================= */

async function sendForUser(userDoc) {

  const u = userDoc.data();


  if (
    !u.enabled ||
    !u.fcmToken ||
    !u.timezone
  ) {

    return;

  }


  const now =
    localNow(u.timezone);


  const day =
    SCHEDULE[now.date];


  if (!day) {

    return;

  }


  for (const slotInfo of SLOTS) {

    const e =
      trackEntry(
        u.status || {},
        slotInfo.slot
      );


    if (!e) {

      continue;

    }


    const id =
      sessionId(
        now.date,
        slotInfo.slot
      );


    const ref =
      userDoc.ref
        .collection('sessions')
        .doc(id);


    const snap =
      await ref.get();


    const session =
      snap.exists
        ? snap.data()
        : {};


    /*
    Opening the PWA during the session marks it
    acknowledged and stops further reminders.
    */

    if (session.acknowledged) {

      continue;

    }


    const elapsed =
      now.minutes -
      slotInfo.start;


    let stage = null;


    if (
      elapsed >= 0 &&
      elapsed <
        slotInfo.end -
        slotInfo.start
    ) {

      if (elapsed < 30) {

        stage = 0;

      }
      else if (elapsed < 60) {

        stage = 30;

      }
      else {

        stage = 60;

      }

    }
    else if (
      elapsed >=
      slotInfo.end -
      slotInfo.start
    ) {

      stage = 90;

    }


    if (stage === null) {

      continue;

    }


    /*
    Do not send the same reminder stage twice.
    */

    if (
      session.lastReminderStage === stage
    ) {

      continue;

    }


    const msg =
      messageFor(
        stage,
        e[1],
        e[2]
      );


    try {

      await messaging.send({

        token: u.fcmToken,

        data: {

          title: msg.title,

          body: msg.body,

          sessionId: id,

          date: now.date,

          slot:
            String(slotInfo.slot),

          url:
            './index.html',

          event:
            stage === 90
              ? 'session_end'
              : 'reminder',

          stage:
            String(stage)

        }

      });


      await ref.set({

        date:
          now.date,

        slot:
          slotInfo.slot,

        start:
          slotInfo.start,

        end:
          slotInfo.end,

        subject:
          e[1],

        topic:
          e[2],

        lastReminderStage:
          stage,

        lastReminderAt:
          admin.firestore.FieldValue
            .serverTimestamp()

      }, {
        merge: true
      });


      console.log(
        '✅ Sent',
        msg.title,
        'to',
        userDoc.id,
        id
      );

    }
    catch (err) {

      console.error(
        '❌ FCM error for',
        userDoc.id,
        err.code || err.message
      );


      /*
      Automatically clean stale tokens.
      */

      if (
        [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token'
        ].includes(err.code)
      ) {

        console.log(
          '🧹 Disabling stale device:',
          userDoc.id
        );


        await userDoc.ref.set({

          enabled: false,

          fcmToken:
            admin.firestore.FieldValue.delete(),

          updatedAt:
            admin.firestore.FieldValue
              .serverTimestamp()

        }, {
          merge: true
        });

      }

    }

  }

}


/* =========================================================
   MAIN
   ========================================================= */

(async () => {

  const users =
    await db
      .collection('users')
      .get();


  console.log(
    `Found ${users.size} user/device records`
  );


  /*
  =========================================================
  TEST MODE
  =========================================================
  */

  if (TEST_NOTIFICATION) {

    console.log(
      '🧪 TEST MODE ENABLED'
    );

    console.log(
      'Sending test notification to enabled devices...'
    );


    for (const doc of users.docs) {

      await sendTestNotification(doc);

    }


    console.log(
      '🧪 TEST MODE FINISHED'
    );


    return;

  }


  /*
  =========================================================
  NORMAL MODE
  =========================================================
  */

  console.log(
    `Checking users at ${new Date().toISOString()}`
  );


  for (const doc of users.docs) {

    await sendForUser(doc);

  }


  console.log(
    '✅ Normal scheduler finished'
  );

})();
