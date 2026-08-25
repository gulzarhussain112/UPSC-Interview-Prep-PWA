const STORE='upscPrepV3';let state=load(),selected=null;window.upscGetStatusMap=()=>state.status;function load(){try{return Object.assign({status:{},notes:{},answers:{}},JSON.parse(localStorage.getItem(STORE)||'{}'))}catch{return {status:{},notes:{},answers:{}}}}function save(){localStorage.setItem(STORE,JSON.stringify(state));window.upscGetStatusMap=()=>state.status;window.StudyPush?.syncProgress?.(state.status);renderAll()}function key(s,t){return s+'||'+t}function status(k){return state.status[k]||'not'}function statusText(s){return ({done:'Completed',revision:'Needs revision',partial:'Partial',not:'Not started'})[s]||'Not started'}function today(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}function mins(){const n=new Date();return n.getHours()*60+n.getMinutes()+n.getSeconds()/60}function fmtDate(d){return new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'})}function entries(){return TOPICS.map(x=>({subject:x[0],topic:x[1],search:x[2]}))}function pct(a){return a.length?Math.round(a.filter(x=>status(key(x.subject,x.topic))==='done').length/a.length*100):0}
if(!state.notes)state.notes={};if(!state.noteTimes)state.noteTimes={};if(!state.sessionAck)state.sessionAck={};if(!state.sessionLog)state.sessionLog={};
function period(){
 const m=mins();
 const p=[
  {kind:'study',label:'STUDY NOW',start:1080,end:1170,slot:0},
  {kind:'break',label:'SHORT BREAK',start:1170,end:1185},
  {kind:'study',label:'STUDY NOW',start:1185,end:1275,slot:1},
  {kind:'recall',label:'QUICK REVISION',start:1275,end:1290},
  {kind:'dinner',label:'DINNER',start:1290,end:1320},
  {kind:'study',label:'STUDY NOW',start:1320,end:1380,slot:2},
  {kind:'recall',label:'RECALL TIME',start:1380,end:1410}
 ];
 return p.find(x=>m>=x.start&&m<x.end)||null;
}function nextStudy(){const d=SCHEDULE[today()]||SCHEDULE['2026-08-19'],m=mins(),a=[1080,1185,1320],i=a.findIndex(x=>x>m);return i<0?null:{start:a[i],e:d[i]}}
function select(e){if(!e)return;selected={time:e.time,subject:e.subject,topic:e.topic,search:e.search};renderDetail()}
function sortedScheduleDates(){return Object.keys(SCHEDULE).sort();}
function trackEntry(slotIndex){
  const dates=sortedScheduleDates();
  for(const d of dates){
    const e=(SCHEDULE[d]||[])[slotIndex];
    if(e && status(key(e[1],e[2]))!=='done') return e;
  }
  // Everything in this track is complete: show the latest planned entry.
  for(let i=dates.length-1;i>=0;i--){
    const e=(SCHEDULE[dates[i]]||[])[slotIndex];
    if(e)return e;
  }
  return null;
}
function liveEntryForPeriod(p){
  if(!p||p.kind!=='study') return null;
  return trackEntry(p.slot);
}
function selectScheduled(e){selected={time:e[0],subject:e[1],topic:e[2],search:e[3]};renderDetail()}

function topicInfo(subject,topic){
 const exact=KEYPOINTS[key(subject,topic)];
 if(exact)return exact;
 const words=topic.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2);
 let best=null,bestScore=-1;
 Object.keys(KEYPOINTS).forEach(k=>{
  const parts=k.split("||"); if(parts[0]!==subject)return;
  const tw=parts[1].toLowerCase();
  const score=words.reduce((n,w)=>n+(tw.includes(w)?1:0),0);
  if(score>bestScore){bestScore=score;best=KEYPOINTS[k];}
 });
 return best||["Know the definition and purpose.","Understand the main components and terminology.","Learn one practical example.","Know major advantages, limitations and trade-offs.","Prepare likely panel follow-ups.","Be able to explain it aloud without notes."];
}
function topicKeyPointsHTML(subject,topic){return topicInfo(subject,topic).map(x=>`<li>${x}</li>`).join("");}
function nextStudyInfo(){
 const m=mins(), starts=[1080,1185,1320], slots=[0,1,2];
 for(let i=0;i<starts.length;i++){
  if(starts[i]>m){
   const e=trackEntry(slots[i]);
   if(e)return {start:starts[i],e,tomorrow:false};
  }
 }
 const e=trackEntry(0);
 if(e)return {start:1080,e,tomorrow:true};
 return null;
}
function renderLive(){
 const d=today(),p=period(),m=mins(),e=liveEntryForPeriod(p);
 document.getElementById('dateLabel').textContent=SCHEDULE[d]?fmtDate(d):'Interview preparation';
 let title,meta,stateLabel,remain=0;
 if(e){
  stateLabel='STUDY NOW'; title=e[1];
  meta=`${e[2]} • ${e[0]} • Hard stop at ${e[0].split('–')[1]}`;
  selectScheduled(e); remain=p.end-m;
 }else if(p){
  stateLabel=p.label;
  title=p.kind==='dinner'?'Dinner Break':p.kind==='recall'?"Recall Today's Topics":'Short Break';
  meta=p.kind==='recall'?"Close YouTube and explain today's topics aloud without notes.":"Reset before the next session.";
  remain=p.end-m;
 }else{
  const n=nextStudyInfo(); stateLabel='OUTSIDE STUDY SCHEDULE';
  if(n&&n.e){
   title='No scheduled study right now';
   meta=`Next: ${n.e[1]} — ${n.e[2]} • starts ${n.e[0].split('–')[0]}${n.tomorrow?' tomorrow':''}`;
   remain=n.tomorrow?(1440-m+n.start):(n.start-m);
  }else{
   title='All planned topics completed'; meta='Excellent. Use the Interview tab for panel practice.'; remain=0;
  }
 }
 document.getElementById('statePill').textContent=stateLabel;
 document.getElementById('liveTitle').textContent=title;
 document.getElementById('liveMeta').textContent=meta;
 remain=Math.max(0,isFinite(remain)?remain:0);
 const sec=Math.floor(remain*60);
 document.getElementById('countLabel').textContent=e?'TIME LEFT':p?'ENDS IN':'NEXT';
 document.getElementById('countdown').textContent=`${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
 document.getElementById('countSub').textContent=e||p?`${Math.ceil(remain)} min remaining`:`${Math.ceil(remain/60)} min until next study session`;
 const target=document.getElementById('liveTarget');
 if(e){
  target.innerHTML=`<div class="target"><div class="targetTitle"><b>What you must capture from this topic</b><span>${statusText(status(key(e[1],e[2])))}</span></div><ul class="keypoints">${topicKeyPointsHTML(e[1],e[2])}</ul><div class="captureRule"><b>Minimum output:</b> short notes + one example/diagram + 2–3 likely panel follow-ups.</div></div>`;
 }else target.innerHTML='';
 renderTodayRows();
}
function renderTodayRows(){
 const holder=document.getElementById('todayRows'); holder.innerHTML='';
 const entries=[trackEntry(0),trackEntry(1),trackEntry(2)];
 const times=['6:00–7:30 PM','7:45–9:15 PM','10:00–11:00 PM'];
 let done=0;
 entries.forEach((e,i)=>{
  if(!e)return;
  const st=status(key(e[1],e[2])); if(st==='done')done++;
  const r=document.createElement('div'); r.className='row';
  r.innerHTML=`<div class="time">${times[i]}</div><div><b>${e[1]}</b><div>${e[2]}</div></div><span class="status ${st}">${statusText(st)}</span>`;
  r.onclick=()=>{selectScheduled(e)};
  holder.appendChild(r);
 });
 document.getElementById('todayProgress').textContent=`${done}/${entries.filter(Boolean).length} current track topics complete`;
}
function updateActionButtons(){
 const buttons=[
  {id:'complete',status:'done',label:'Mark Complete',current:'✓ Completed — Current'},
  {id:'revision',status:'revision',label:'Needs Revision',current:'✓ Needs Revision — Current'},
  {id:'partial',status:'partial',label:'Partially Studied',current:'✓ Partially Studied — Current'}
 ];
 const current=selected?status(key(selected.subject,selected.topic)):'not';
 buttons.forEach(x=>{
  const b=document.getElementById(x.id); if(!b)return;
  const active=current===x.status;
  b.disabled=active;
  b.classList.toggle('current-status',active);
  b.classList.toggle('status-action',!active);
  b.setAttribute('aria-pressed',active?'true':'false');
  b.title=active?'This is the current status for this topic':'Set topic status to '+x.label;
  b.textContent=active?x.current:x.label;
 });
}
function renderDetail(){
 if(!selected){
  document.getElementById('detailTitle').textContent='Select a topic';
  document.getElementById('detailSubject').textContent='';
  document.getElementById('detailContent').innerHTML='';
  updateActionButtons();
  return;
 }
 const pts=topicKeyPointsHTML(selected.subject,selected.topic);
 document.getElementById('detailTitle').textContent=selected.topic;
 document.getElementById('detailSubject').textContent=selected.subject;
 document.getElementById('detailContent').innerHTML=`<div class="detailBlock"><div class="blockTitle">WHAT TO STUDY / CAPTURE</div><ul class="keypoints">${pts}</ul></div><div class="detailBlock"><div class="blockTitle">YOUTUBE SEARCH</div><div class="row"><div class="time">SEARCH</div><div>${selected.search}</div><button class="btn" id="copySearch">Copy</button></div></div><div class="detailBlock captureRule"><b>By the end of this session:</b> explain the topic in your own words, give one practical example, and handle basic panel follow-ups without looking at notes.</div>`;
 document.getElementById('copySearch').onclick=()=>navigator.clipboard?.writeText(selected.search);
 document.getElementById('notes').value=state.notes[key(selected.subject,selected.topic)]||'';
 updateActionButtons();
}
function renderSchedule(){let h=document.getElementById('masterSchedule');h.innerHTML='';Object.keys(SCHEDULE).sort().forEach(d=>{let g=document.createElement('div');g.className='group';g.innerHTML=`<h4>${fmtDate(d)}</h4>`;SCHEDULE[d].forEach(e=>{let r=document.createElement('div');r.className='row';r.innerHTML=`<div class="time">${e[0]}</div><div><b>${e[1]}</b><div>${e[2]}</div></div><span class="status ${status(key(e[1],e[2]))}">${statusText(status(key(e[1],e[2])))}</span>`;r.onclick=()=>{selectScheduled(e);show('today')};g.appendChild(r)});h.appendChild(g)})}
function renderSyllabus(){let q=document.getElementById('search').value.toLowerCase(),h=document.getElementById('syllabusList');h.innerHTML='';let groups={};entries().filter(x=>(x.subject+' '+x.topic).toLowerCase().includes(q)).forEach(x=>(groups[x.subject]??=[]).push(x));Object.entries(groups).forEach(([sub,a])=>{let g=document.createElement('div');g.className='group';g.innerHTML=`<h4>${sub} • ${pct(a)}%</h4>`;a.forEach(x=>{let l=document.createElement('label');l.className='check';l.innerHTML=`<input type="checkbox" ${status(key(x.subject,x.topic))==='done'?'checked':''}><span><b>${x.topic}</b><br><small>${x.search}</small></span>`;l.querySelector('input').onchange=ev=>{state.status[key(x.subject,x.topic)]=ev.target.checked?'done':'not';save()};g.appendChild(l)});h.appendChild(g)})}
function renderProgress(){let h=document.getElementById('progressList');h.innerHTML='';let groups={};entries().forEach(x=>(groups[x.subject]??=[]).push(x));Object.entries(groups).forEach(([sub,a])=>{let p=pct(a),d=document.createElement('div');d.className='subject';d.innerHTML=`<div class="subjectTop"><b>${sub}</b><b>${p}%</b></div><div class="mini"><i style="width:${p}%"></i></div>`;h.appendChild(d)});let p=pct(entries());document.getElementById('overallPct').textContent=p+'%';document.getElementById('overallBar').style.width=p+'%'}
function renderQuestions(){let h=document.getElementById('questions');h.innerHTML='';document.getElementById('qCount').textContent=QUESTIONS.length+' questions';QUESTIONS.forEach((q,i)=>{let d=document.createElement('details');d.className='question';d.innerHTML=`<summary>${q}</summary><textarea placeholder="Your answer / corrections…">${state.answers[i]||''}</textarea>`;d.querySelector('textarea').onchange=e=>{state.answers[i]=e.target.value;localStorage.setItem(STORE,JSON.stringify(state))};h.appendChild(d)})}

function renderNotes(){
 const holder=document.getElementById('notesList'); if(!holder)return;
 const all=[];
 Object.keys(state.notes||{}).forEach(k=>{
  const text=(state.notes[k]||'').trim(); if(!text)return;
  const parts=k.split('||'); all.push({key:k,subject:parts[0],topic:parts.slice(1).join('||'),text,at:(state.noteTimes||{})[k]||''});
 });
 all.sort((a,b)=>(b.at||'').localeCompare(a.at||''));
 if(!all.length){
  holder.innerHTML=`<div class="emptyNotes"><b>No saved sticky notes yet.</b><div>Open a topic, write your notes and press <b>Save Sticky Note</b>. They will stay attached to that topic on this device.</div></div>`;
  return;
 }
 holder.innerHTML=all.map(n=>`<article class="stickyNote" data-note="${encodeURIComponent(n.key)}"><div class="stickyTop"><div><span class="noteSubject">${n.subject}</span><h4>${n.topic}</h4></div><button class="btn ghost openNote">Open topic</button></div><div class="stickyBody">${escapeHTML(n.text).replace(/\n/g,'<br>')}</div><div class="stickyTime">${n.at?new Date(n.at).toLocaleString():'Saved on this device'}</div></article>`).join('');
 holder.querySelectorAll('.openNote').forEach(btn=>btn.onclick=()=>{
   const k=decodeURIComponent(btn.closest('[data-note]').dataset.note);
   const [s,...tt]=k.split('||'); const t=tt.join('||');
   const e=entries().find(x=>x.subject===s&&x.topic===t);
   if(e){selected=e;renderDetail();show('today');}
 });
}
function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function renderQueue(kind){
 const holder=document.getElementById(kind==='partial'?'partialList':'revisionList');
 const count=document.getElementById(kind==='partial'?'partialCount':'revisionCount');
 if(!holder)return;
 const items=entries().filter(x=>status(key(x.subject,x.topic))===kind);
 count.textContent=items.length+' topic'+(items.length===1?'':'s');
 if(!items.length){holder.innerHTML=`<div class="emptyQueue"><b>${kind==='partial'?'No unfinished topics.':'No topics waiting for revision.'}</b><div>${kind==='partial'?'Great — your main track is clear.':'Revision queue is clear.'}</div></div>`;return;}
 holder.innerHTML=items.map((x,i)=>`<article class="queueItem"><div class="queueMain"><span class="queueNumber">${i+1}</span><div><div class="eyebrow">${x.subject}</div><h4>${x.topic}</h4><p>${kind==='partial'?'Continue learning this topic.':'Refresh this topic and test yourself aloud.'}</p></div></div><button class="btn primary queueOpen" data-k="${encodeURIComponent(key(x.subject,x.topic))}">${kind==='partial'?'Continue':'Revise'}</button></article>`).join('');
 holder.querySelectorAll('.queueOpen').forEach(b=>b.onclick=()=>{const k=decodeURIComponent(b.dataset.k),x=entries().find(v=>key(v.subject,v.topic)===k);if(x){selected=x;show('today');renderDetail();}});
}
function renderPartialQueue(){renderQueue('partial')}
function renderRevisionQueue(){renderQueue('revision')}
function sessionIdFor(date,slot){return `${date}::${slot}`}
function currentSession(){const d=today(),p=period();if(!p||p.kind!=='study')return null;const e=liveEntryForPeriod(p);if(!e)return null;return {id:sessionIdFor(d,p.slot),date:d,slot:p.slot,start:p.start,end:p.end,e}}
function sessionForFinished(){const d=today(),m=mins(),study=[{slot:0,start:1080,end:1170},{slot:1,start:1185,end:1275},{slot:2,start:1320,end:1380}];for(const x of study){if(m>=x.end){const e=trackEntry(x.slot),id=sessionIdFor(d,x.slot);if(e&&!state.sessionLog[id])return {id,date:d,slot:x.slot,start:x.start,end:x.end,e};}}return null}
function markSessionAcknowledged(s){if(!s)return;state.sessionAck[s.id]=new Date().toISOString();localStorage.setItem(STORE,JSON.stringify(state));window.StudyPush?.ackSession?.(s)}
function openSessionModal(s){document.getElementById('sessionModalTopic').textContent=`${s.e[1]} — ${s.e[2]}`;document.getElementById('sessionModalTime').textContent=`Scheduled: ${s.e[0]}`;document.getElementById('sessionNext').textContent='';document.getElementById('sessionModal').classList.remove('hidden');window.__sessionPending=s}
function closeSessionModal(){document.getElementById('sessionModal').classList.add('hidden');window.__sessionPending=null}
function recordSessionResult(result){const s=window.__sessionPending;if(!s)return;const k=key(s.e[1],s.e[2]);state.status[k]=result;state.sessionLog[s.id]={status:result,recordedAt:new Date().toISOString(),subject:s.e[1],topic:s.e[2]};state.sessionAck[s.id]=new Date().toISOString();localStorage.setItem(STORE,JSON.stringify(state));window.StudyPush?.syncProgress?.(state.status);window.StudyPush?.ackSession?.(s);closeSessionModal();renderAll();const next=trackEntry(s.slot);if(next)selectScheduled(next)}
function checkSessionEnd(){const s=sessionForFinished();if(s&&!state.sessionLog[s.id])openSessionModal(s)}
function setupSessionActions(){document.getElementById('sessionDone').onclick=()=>recordSessionResult('done');document.getElementById('sessionPartial').onclick=()=>recordSessionResult('partial');document.getElementById('sessionRevision').onclick=()=>recordSessionResult('revision')}
function renderPushState(){const el=document.getElementById('pushState'),b=document.getElementById('enableNotifications'),h=document.getElementById('pushHelp');if(!el||!b)return;if(!window.StudyPush){el.textContent='Not configured';b.textContent='Set up Firebase';b.disabled=true;h.textContent='Firebase push module is missing.';return}if(!window.StudyPush.isConfigured?.()){el.textContent='Not configured';b.textContent='Set up Firebase';b.disabled=true;h.textContent='Add your Firebase web config and VAPID key to firebase-config.js.';return}const enabled=!!window.StudyPush.isEnabled?.();el.textContent=enabled?'ON':'OFF';b.disabled=enabled;b.textContent=enabled?'Study Notifications Enabled':'Enable Study Notifications';h.textContent=enabled?'30-minute strict reminders are active.':'Allow notifications to receive study reminders even when the PWA is closed.'}
function setupPushButton(){const b=document.getElementById('enableNotifications');if(!b)return;b.onclick=async()=>{b.disabled=true;b.textContent='Enabling…';try{await window.StudyPush.enable();renderPushState();alert('Study notifications are enabled.')}catch(e){b.disabled=false;b.textContent='Enable Study Notifications';alert('Could not enable notifications: '+e.message)}}}
function handleVisibility(){if(!document.hidden){const s=currentSession();if(s)markSessionAcknowledged(s);checkSessionEnd()}}
function renderAll(){renderLive();renderDetail();renderSchedule();renderSyllabus();renderProgress();renderQuestions();renderNotes();renderPartialQueue();renderRevisionQueue();renderPushState()}
function show(id){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelector(`nav button[data-view="${id}"]`).classList.add('active');scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.view));document.getElementById('search').oninput=renderSyllabus;document.getElementById('saveNotes').onclick=()=>{
 if(!selected)return;
 const k=key(selected.subject,selected.topic), text=document.getElementById('notes').value.trim();
 if(!state.notes)state.notes={}; if(!state.noteTimes)state.noteTimes={};
 if(text){state.notes[k]=text;state.noteTimes[k]=new Date().toISOString();}
 else{delete state.notes[k];delete state.noteTimes[k];}
 localStorage.setItem(STORE,JSON.stringify(state)); renderAll();
 const b=document.getElementById('saveNotes'); b.textContent=text?'Saved ✓':'Note cleared'; setTimeout(()=>b.textContent='Save Sticky Note',1800);
};document.getElementById('reset').onclick=()=>{if(confirm('Reset all progress, notes and interview answers?')){state={status:{},notes:{},noteTimes:{},answers:{},sessionAck:{},sessionLog:{}};save()}};
let deferred=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;document.getElementById('installBtn').classList.remove('hidden')});document.getElementById('installBtn').onclick=()=>deferred?.prompt();if(location.protocol==='file:'){const b=document.getElementById('installBtn');if(b){b.classList.remove('hidden');b.textContent='Run as PWA';b.onclick=()=>alert('PWA installation is unavailable from a file:// URL. Open this app through GitHub Pages (HTTPS) or localhost to install it.')}}else if('serviceWorker'in navigator){navigator.serviceWorker.register('service-worker.js').catch(console.error)}window.addEventListener('appinstalled',()=>{const b=document.getElementById('installBtn');if(b)b.classList.add('hidden')});setupSessionActions();setupPushButton();renderAll();handleVisibility();setInterval(()=>{renderLive();checkSessionEnd()},1000);document.addEventListener('visibilitychange',handleVisibility);window.addEventListener('focus',handleVisibility);
