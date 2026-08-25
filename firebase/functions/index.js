const {onSchedule}=require("firebase-functions/v2/scheduler");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");
const {initializeApp}=require("firebase-admin/app");
initializeApp();
const db=getFirestore();

const SESSIONS=[
 {slot:0,start:18*60,end:19*60+30,label:"DBMS"},
 {slot:1,start:19*60+45,end:21*60+15,label:"Computer Networks"},
 {slot:2,start:22*60,end:23*60,label:"Operating Systems"}
];

function localMinutes(date,timeZone){
 const p=new Intl.DateTimeFormat("en-US",{timeZone,hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);
 return Number(p.find(x=>x.type==="hour").value)*60+Number(p.find(x=>x.type==="minute").value);
}
function localDate(date,timeZone){
 const p=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const get=t=>p.find(x=>x.type===t).value;
 return `${get("year")}-${get("month")}-${get("day")}`;
}

/*
 * This function runs every 5 minutes. It sends:
 *  - start reminder at minute 0
 *  - 30-minute reminder if still unacknowledged
 *  - 60-minute reminder if still unacknowledged
 *  - session-end notice
 *
 * The PWA writes users/{uid}/sessions/{date::slot}.acknowledged=true when
 * the user opens the app during that session or records its result.
 */
exports.studyReminderTick=onSchedule("every 5 minutes",async()=>{
 const now=new Date();
 const snap=await db.collection("users").where("enabled","==",true).get();
 const jobs=[];
 for(const doc of snap.docs){
  const u=doc.data(); if(!u.fcmToken||!u.timezone)continue;
  const m=localMinutes(now,u.timezone),d=localDate(now,u.timezone);
  for(const session of SESSIONS){
   const duration=session.end-session.start;
   const inWindow=m>=session.start && m<session.end;
   const atEnd=m>=session.end && m<session.end+5;
   if(!inWindow&&!atEnd)continue;
   const offset=m-session.start;
   let milestone=null;
   if(inWindow && offset<5)milestone=0;
   else if(inWindow && offset>=30 && offset<35)milestone=30;
   else if(inWindow && offset>=60 && offset<65)milestone=60;
   else if(atEnd)milestone=duration;
   if(milestone===null)continue;
   const id=`${d}::${session.slot}`;
   const sref=doc.ref.collection("sessions").doc(id);
   const s=(await sref.get()).data()||{};
   if(s.acknowledged)continue;
   if(s.lastReminderOffset===milestone)continue;
   const isEnd=milestone===duration;
   const bodies={
    0:`Your ${session.label} session has started. Open UPSC Interview Prep and study now.`,
    30:`30 minutes are gone. You still have not started ${session.label}. Do not waste another study opportunity.`,
    60:`One hour is gone. ${session.label} is still waiting. Open the app now — the interview will not wait for you.`,
    [duration]:`Your ${session.label} session has ended. You missed the study window. Open the app and record what happened.`
   };
   jobs.push(getMessaging().send({
    token:u.fcmToken,
    data:{
      title:isEnd?"⚠️ STUDY SESSION MISSED":(milestone===0?"🔔 UPSC STUDY TIME":"⚠️ STRICT STUDY REMINDER"),
      body:bodies[milestone],
      sessionId:id,
      date:d,
      slot:String(session.slot),
      url:"./index.html",
      event:isEnd?"session_end":"reminder"
    }
   }).then(()=>sref.set({lastReminderOffset:milestone,lastReminderAt:FieldValue.serverTimestamp()},{merge:true}))
   .catch(async e=>{
    const code=e.errorInfo?.code||"";
    if(code.includes("registration-token-not-registered"))await doc.ref.set({enabled:false},{merge:true});
   }));
  }
 }
 await Promise.all(jobs);
});
