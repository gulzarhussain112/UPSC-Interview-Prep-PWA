const STORE='upscPrepV3';let state=load(),selected=null;function load(){try{return Object.assign({status:{},notes:{},answers:{}},JSON.parse(localStorage.getItem(STORE)||'{}'))}catch{return {status:{},notes:{},answers:{}}}}function save(){localStorage.setItem(STORE,JSON.stringify(state));renderAll()}function key(s,t){return s+'||'+t}function status(k){return state.status[k]||'not'}function statusText(s){return ({done:'Completed',revision:'Needs revision',partial:'Partial',not:'Not started'})[s]||'Not started'}function today(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`}function mins(){const n=new Date();return n.getHours()*60+n.getMinutes()+n.getSeconds()/60}function fmtDate(d){return new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'})}function entries(){return TOPICS.map(x=>({subject:x[0],topic:x[1],search:x[2]}))}function pct(a){return a.length?Math.round(a.filter(x=>status(key(x.subject,x.topic))==='done').length/a.length*100):0}
function period(){const d=SCHEDULE[today()]||SCHEDULE['2026-08-19'],m=mins();const p=[{kind:'study',label:'STUDY NOW',start:1080,end:1170,e:d[0]},{kind:'break',label:'SHORT BREAK',start:1170,end:1185},{kind:'study',label:'STUDY NOW',start:1185,end:1275,e:d[1]},{kind:'revision',label:'QUICK REVISION',start:1275,end:1290},{kind:'dinner',label:'DINNER',start:1290,end:1320},{kind:'study',label:'STUDY NOW',start:1320,end:1380,e:d[2]},{kind:'recall',label:'RECALL TIME',start:1380,end:1410}];return p.find(x=>m>=x.start&&m<x.end)||null}function nextStudy(){const d=SCHEDULE[today()]||SCHEDULE['2026-08-19'],m=mins(),a=[1080,1185,1320],i=a.findIndex(x=>x>m);return i<0?null:{start:a[i],e:d[i]}}
function select(e){if(!e)return;selected={time:e.time,subject:e.subject,topic:e.topic,search:e.search};renderDetail()}function selectScheduled(e){selected={time:e[0],subject:e[1],topic:e[2],search:e[3]};renderDetail()}

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
 const now=new Date(),m=mins(),d=today(),day=SCHEDULE[d];
 const starts=[1080,1185,1320];
 if(day){for(let i=0;i<starts.length;i++)if(starts[i]>m&&day[i])return {date:d,start:starts[i],e:day[i],tomorrow:false};}
 const tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
 const td=`${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;
 if(SCHEDULE[td]&&SCHEDULE[td][0])return {date:td,start:1080,e:SCHEDULE[td][0],tomorrow:true};
 return null;
}
function renderLive(){
 const d=today(),day=SCHEDULE[d]||SCHEDULE['2026-08-19'],p=period(),m=mins(),e=p&&p.e;
 document.getElementById('dateLabel').textContent=SCHEDULE[d]?fmtDate(d):'Plan preview • 19 Aug 2026';
 let title,meta,stateLabel,remain=0;
 if(e){
  stateLabel='STUDY NOW'; title=e[1];
  meta=`${e[2]} • ${e[0]} • Hard stop at ${e[0].split('–')[1]}`;
  selectScheduled(e); remain=p.end-m;
 }else if(p){
  stateLabel=p.label;
  title=p.kind==='dinner'?'Dinner Break':p.kind==='recall'?"Recall Today's Topics":'Short Break';
  meta=p.kind==='recall'?"Close YouTube and explain today's topics aloud without notes.":"Reset before the next study period.";
  remain=p.end-m;
 }else{
  const n=nextStudyInfo(); stateLabel='OUTSIDE STUDY SCHEDULE';
  if(n&&n.e){
   title='No scheduled study right now';
   meta=`Next: ${n.e[1]} — ${n.e[2]} • starts ${n.e[0].split('–')[0]}${n.tomorrow?' tomorrow':''}`;
   remain=n.tomorrow ? (1440-m+n.start) : (n.start-m);
  }else{
   title='No study session scheduled'; meta='Check the Schedule tab for the current preparation plan.'; remain=0;
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
 renderTodayRows(day);
}
function renderTodayRows(day){let h=document.getElementById('todayRows'),done=0;h.innerHTML='';day.forEach(e=>{let s=status(key(e[1],e[2]));if(s==='done')done++;let r=document.createElement('div');r.className='row';r.innerHTML=`<div class="time">${e[0]}</div><div><b>${e[1]}</b><div class="muted">${e[2]}</div></div><span class="status ${s}">${statusText(s)}</span>`;r.onclick=()=>selectScheduled(e);h.appendChild(r)});document.getElementById('todayProgress').textContent=`${done}/${day.length} complete`}
function renderDetail(){
 if(!selected){document.getElementById('detailTitle').textContent='Select a topic';document.getElementById('detailSubject').textContent='';document.getElementById('detailContent').innerHTML='';return}
 const pts=topicKeyPointsHTML(selected.subject,selected.topic);
 document.getElementById('detailTitle').textContent=selected.topic;
 document.getElementById('detailSubject').textContent=selected.subject;
 document.getElementById('detailContent').innerHTML=`<div class="detailBlock"><div class="blockTitle">WHAT TO STUDY / CAPTURE</div><ul class="keypoints">${pts}</ul></div><div class="detailBlock"><div class="blockTitle">YOUTUBE SEARCH</div><div class="row"><div class="time">SEARCH</div><div>${selected.search}</div><button class="btn" id="copySearch">Copy</button></div></div><div class="detailBlock captureRule"><b>By the end of this session:</b> explain the topic in your own words, give one practical example, and handle basic panel follow-ups without looking at notes.</div>`;
 document.getElementById('copySearch').onclick=()=>navigator.clipboard?.writeText(selected.search);
 document.getElementById('notes').value=state.notes[key(selected.subject,selected.topic)]||'';
}
function renderSchedule(){let h=document.getElementById('masterSchedule');h.innerHTML='';Object.keys(SCHEDULE).sort().forEach(d=>{let g=document.createElement('div');g.className='group';g.innerHTML=`<h4>${fmtDate(d)}</h4>`;SCHEDULE[d].forEach(e=>{let r=document.createElement('div');r.className='row';r.innerHTML=`<div class="time">${e[0]}</div><div><b>${e[1]}</b><div>${e[2]}</div></div><span class="status ${status(key(e[1],e[2]))}">${statusText(status(key(e[1],e[2])))}</span>`;r.onclick=()=>{selectScheduled(e);show('today')};g.appendChild(r)});h.appendChild(g)})}
function renderSyllabus(){let q=document.getElementById('search').value.toLowerCase(),h=document.getElementById('syllabusList');h.innerHTML='';let groups={};entries().filter(x=>(x.subject+' '+x.topic).toLowerCase().includes(q)).forEach(x=>(groups[x.subject]??=[]).push(x));Object.entries(groups).forEach(([sub,a])=>{let g=document.createElement('div');g.className='group';g.innerHTML=`<h4>${sub} • ${pct(a)}%</h4>`;a.forEach(x=>{let l=document.createElement('label');l.className='check';l.innerHTML=`<input type="checkbox" ${status(key(x.subject,x.topic))==='done'?'checked':''}><span><b>${x.topic}</b><br><small>${x.search}</small></span>`;l.querySelector('input').onchange=ev=>{state.status[key(x.subject,x.topic)]=ev.target.checked?'done':'not';save()};g.appendChild(l)});h.appendChild(g)})}
function renderProgress(){let h=document.getElementById('progressList');h.innerHTML='';let groups={};entries().forEach(x=>(groups[x.subject]??=[]).push(x));Object.entries(groups).forEach(([sub,a])=>{let p=pct(a),d=document.createElement('div');d.className='subject';d.innerHTML=`<div class="subjectTop"><b>${sub}</b><b>${p}%</b></div><div class="mini"><i style="width:${p}%"></i></div>`;h.appendChild(d)});let p=pct(entries());document.getElementById('overallPct').textContent=p+'%';document.getElementById('overallBar').style.width=p+'%'}
function renderQuestions(){let h=document.getElementById('questions');h.innerHTML='';document.getElementById('qCount').textContent=QUESTIONS.length+' questions';QUESTIONS.forEach((q,i)=>{let d=document.createElement('details');d.className='question';d.innerHTML=`<summary>${q}</summary><textarea placeholder="Your answer / corrections…">${state.answers[i]||''}</textarea>`;d.querySelector('textarea').onchange=e=>{state.answers[i]=e.target.value;localStorage.setItem(STORE,JSON.stringify(state))};h.appendChild(d)})}
function renderAll(){renderLive();renderDetail();renderSchedule();renderSyllabus();renderProgress();renderQuestions()}
function show(id){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelector(`nav button[data-view="${id}"]`).classList.add('active');scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.view));document.getElementById('search').oninput=renderSyllabus;document.getElementById('complete').onclick=()=>{if(!selected)return;state.status[key(selected.subject,selected.topic)]='done';save();const day=SCHEDULE[today()]||[];const n=day.find(e=>status(key(e[1],e[2]))!=='done');if(n)selectScheduled(n)};document.getElementById('revision').onclick=()=>{if(selected){state.status[key(selected.subject,selected.topic)]='revision';save()}};document.getElementById('partial').onclick=()=>{if(selected){state.status[key(selected.subject,selected.topic)]='partial';save()}};document.getElementById('saveNotes').onclick=()=>{if(selected){state.notes[key(selected.subject,selected.topic)]=document.getElementById('notes').value;save()}};document.getElementById('reset').onclick=()=>{if(confirm('Reset all progress, notes and interview answers?')){state={status:{},notes:{},answers:{}};save()}};
let deferred=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;document.getElementById('installBtn').classList.remove('hidden')});document.getElementById('installBtn').onclick=()=>deferred?.prompt();if(location.protocol==='file:'){
 const b=document.getElementById('installBtn');
 if(b){b.classList.remove('hidden');b.textContent='Run as PWA';b.onclick=()=>alert('PWA installation is unavailable from a file:// URL. Open this app through GitHub Pages (HTTPS) or localhost to install it.');}
}else if('serviceWorker' in navigator){
 navigator.serviceWorker.register('service-worker.js').catch(console.error);
}
window.addEventListener('appinstalled',()=>{const b=document.getElementById('installBtn');if(b)b.classList.add('hidden');});
renderAll();setInterval(renderLive,1000);
