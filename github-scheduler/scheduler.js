const fs = require('fs');
const vm = require('vm');
const admin = require('firebase-admin');

/*
===========================================================
TEST SWITCH
===========================================================

true  = send immediate test notification
false = normal timetable scheduler
*/
const TEST_NOTIFICATION = false;


admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();


/* =========================================================
   LOAD DATA.JS
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
   DAILY STUDY SLOTS
   ========================================================= */

const SLOTS = [
  {
    slot: 0,
    start: 1080, // 6:00 PM
    end: 1170   // 7:30 PM
  },
  {
    slot: 1,
    start: 1185, // 7:45 PM
    end: 1275   // 9:15 PM
  },
  {
    slot: 2,
    start: 1320, // 10:00 PM
    end: 1380   // 11:00 PM
  }
];


/* =========================================================
   LOCAL DATE / TIME FOR USER
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


  const get = type =>
    parts.find(x => x.type === type)?.value;


  return {

    date:
      `${get('year')}-${get('month')}-${get('day')}`,

    minutes:
      Number(get('hour')) * 60 +
      Number(get('minute'))

  };

}


/* =========================================================
   SESSION ID
   ========================================================= */

function sessionId(date, slot) {

  return `${date}__slot${slot}`;

}


/* =========================================================
   NORMAL REMINDER MESSAGES
   ========================================================= */

function messageFor(stage, subject, topic) {

  /* -------------------------------------------------------
     15 MINUTES BEFORE
     ------------------------------------------------------- */

  if (stage === -15) {

    return {

      title: '🔔 STUDY SESSION IN 15 MINUTES',

      body:
        `${subject} — ${topic}\n` +
        `Get ready. Your study session starts in 15 minutes.`

    };

  }


  /* -------------------------------------------------------
     SESSION START
     ------------------------------------------------------- */

  if (stage === 0) {

    return {

      title: '🔔 UPSC STUDY TIME',

      body:
        `${subject} — ${topic}\n` +
        `Your study session has started. ` +
        `Open the app and start now.`

    };

  }


  /* -------------------------------------------------------
     30 MINUTES
     ------------------------------------------------------- */

  if (stage === 30) {

    return {

      title: '⚠️ 30 MINUTES GONE',

      body:
        `${subject} — ${topic}\n` +
        `You still haven't started. ` +
        `Don't waste another study opportunity.`

    };

  }


  /* -------------------------------------------------------
     60 MINUTES
     ------------------------------------------------------- */

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


  /* -------------------------------------------------------
     SESSION END
     ------------------------------------------------------- */

  return {

    title: '🚨 STUDY SESSION MISSED',

    body:
      `${subject} — ${topic}\n` +
      `Your scheduled study time is over. ` +
      `Open the app and record what happened.`

  };

}


/* =========================================================
   SEND TEST NOTIFICATION
   ========================================================= */

async function sendTestNotification(userDoc) {

  const u = userDoc.data();


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


  try {

    const response =
      await messaging.send({

        token: u.fcmToken,

        data: {

          title:
            '🔔 UPSC TEST NOTIFICATION',

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

      });


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


    await handleTokenError(
      userDoc,
      err
    );

  }

}


/* =========================================================
   HANDLE INVALID FCM TOKEN
   ========================================================= */

async function handleTokenError(userDoc, err) {

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

      enabled:
        false,

      fcmToken:
        admin.firestore.FieldValue.delete(),

      updatedAt:
        admin.firestore.FieldValue.serverTimestamp()

    }, {
      merge: true
    });

  }

}


/* =========================================================
   SEND NORMAL REMINDER
   ========================================================= */

async function sendReminder(
  userDoc,
  sessionRef,
  sessionIdValue,
  date,
  slotInfo,
  entry,
  stage
) {

  const subject =
    entry[1];

  const topic =
    entry[2];


  const msg =
    messageFor(
      stage,
      subject,
      topic
    );


  try {

    await messaging.send({

      token:
        userDoc.data().fcmToken,

      data: {

        title:
          msg.title,

        body:
          msg.body,

        sessionId:
          sessionIdValue,

        date:
          date,

        slot:
          String(slotInfo.slot),

        url:
          './index.html',

        event:
          stage === 90
            ? 'session_end'
            : stage === -15
              ? 'prepare'
              : 'reminder',

        stage:
          String(stage)

      }

    });


    /*
    Store the exact reminder stage.

    -15 = preparation
     0  = session start
    30  = 30-minute reminder
    60  = 60-minute reminder
    90  = session finished
    */

    await sessionRef.set({

      date:
        date,

      slot:
        slotInfo.slot,

      start:
        slotInfo.start,

      end:
        slotInfo.end,

      subject:
        subject,

      topic:
        topic,

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
      sessionIdValue
    );

  }
  catch (err) {

    console.error(
      '❌ FCM error for',
      userDoc.id,
      err.code || err.message
    );


    await handleTokenError(
      userDoc,
      err
    );

  }

}


/* =========================================================
   NORMAL USER SCHEDULER
   ========================================================= */

async function sendForUser(userDoc) {

  const u =
    userDoc.data();


  /*
  ---------------------------------------------------------
  User must have an enabled FCM registration.
  ---------------------------------------------------------
  */

  if (
    !u.enabled ||
    !u.fcmToken ||
    !u.timezone
  ) {

    return;

  }


  const now =
    localNow(
      u.timezone
    );


  console.log(
    `User ${userDoc.id}: ${now.date} ${now.minutes} minutes`
  );


  /*
  ---------------------------------------------------------
  IMPORTANT:
  Use ONLY today's schedule.
  ---------------------------------------------------------
  */

  const todaySchedule =
    SCHEDULE[now.date];


  if (!todaySchedule) {

    console.log(
      'No schedule for',
      now.date,
      'for user',
      userDoc.id
    );

    return;

  }


  /*
  ---------------------------------------------------------
  Check all three slots.
  ---------------------------------------------------------
  */

  for (const slotInfo of SLOTS) {

    /*
    Today's exact scheduled entry for this slot.
    */

    const entry =
      todaySchedule[slotInfo.slot];


    if (!entry) {

      continue;

    }


    const subject =
      entry[1];

    const topic =
      entry[2];


    /*
    -------------------------------------------------------
    Check whether THIS TODAY'S topic is already completed.
    -------------------------------------------------------
    */

    const statusKey =
      `${subject}||${topic}`;


    const status =
      (u.status || {})[statusKey];


    if (status === 'done') {

      console.log(
        'Skipping completed topic:',
        subject,
        topic
      );

      continue;

    }


    /*
    -------------------------------------------------------
    Session Firestore document.
    -------------------------------------------------------
    */

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
    -------------------------------------------------------
    If user has already opened/acknowledged the session,
    no more notifications are necessary.
    -------------------------------------------------------
    */

    if (session.acknowledged) {

      continue;

    }


    /*
    -------------------------------------------------------
    Calculate time relative to session start.
    -------------------------------------------------------
    */

    const elapsed =
      now.minutes -
      slotInfo.start;


    let stage =
      null;


    /*
    -------------------------------------------------------
    15-MINUTE PREPARATION WINDOW

    Example:
    6:00 PM start

    5:45 PM → -15
    5:50 PM → -10
    5:55 PM → -5

    Because GitHub runs every 5 minutes, the first run
    at/after 5:45 will send the preparation notification.
    -------------------------------------------------------
    */

    if (
      elapsed >= -15 &&
      elapsed < 0
    ) {

      stage =
        -15;

    }


    /*
    -------------------------------------------------------
    SESSION START → 30 MINUTES
    -------------------------------------------------------
    */

    else if (
      elapsed >= 0 &&
      elapsed < 30
    ) {

      stage =
        0;

    }


    /*
    -------------------------------------------------------
    30 → 60 MINUTES
    -------------------------------------------------------
    */

    else if (
      elapsed >= 30 &&
      elapsed < 60
    ) {

      stage =
        30;

    }


    /*
    -------------------------------------------------------
    60 MINUTES → SESSION END
    -------------------------------------------------------
    */

    else if (
      elapsed >= 60 &&
      elapsed <
        slotInfo.end -
        slotInfo.start
    ) {

      stage =
        60;

    }


    /*
    -------------------------------------------------------
    SESSION FINISHED
    -------------------------------------------------------
    */

    else if (
      elapsed >=
        slotInfo.end -
        slotInfo.start
    ) {

      stage =
        90;

    }


    /*
    Nothing to send right now.
    */

    if (stage === null) {

      continue;

    }


    /*
    -------------------------------------------------------
    PREVENT DUPLICATES
    -------------------------------------------------------

    Since GitHub runs every 5 minutes, the same stage can
    be detected multiple times.

    Firestore remembers the last stage we sent.
    -------------------------------------------------------
    */

    if (
      session.lastReminderStage === stage
    ) {

      continue;

    }


    /*
    -------------------------------------------------------
    SEND
    -------------------------------------------------------
    */

    await sendReminder(

      userDoc,

      ref,

      id,

      now.date,

      slotInfo,

      entry,

      stage

    );

  }

}


/* =========================================================
   MAIN
   ========================================================= */

(async () => {

  try {

    const users =
      await db
        .collection('users')
        .get();


    console.log(
      `Found ${users.size} user/device records`
    );


    /* =====================================================
       TEST MODE
       ===================================================== */

    if (TEST_NOTIFICATION) {

      console.log(
        '🧪 TEST MODE ENABLED'
      );


      for (const doc of users.docs) {

        await sendTestNotification(doc);

      }


      console.log(
        '🧪 TEST MODE FINISHED'
      );


      return;

    }


    /* =====================================================
       NORMAL MODE
       ===================================================== */

    console.log(
      `Checking users at ${new Date().toISOString()}`
    );


    for (const doc of users.docs) {

      await sendForUser(doc);

    }


    console.log(
      '✅ Normal scheduler finished'
    );

  }
  catch (err) {

    console.error(
      '❌ Scheduler failed:',
      err
    );

    process.exitCode = 1;

  }

})();
