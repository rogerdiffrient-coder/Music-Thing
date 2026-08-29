
const STORE_KEY = "musicThing.projects.v1";
const state = { projects: loadProjects(), currentId: null, history: [], future: [], timer: null, step: 0, audio: null };

function loadProjects(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function persist(){ localStorage.setItem(STORE_KEY, JSON.stringify(state.projects)); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(); }
function newProject(name){
  const now = Date.now();
  return {
    id: uid(), name: name || "Untitled Song", bpm: 120, createdAt: now, updatedAt: now,
    piano: {}, drums: { Kick:[], Snare:[], "Closed Hat":[], "Open Hat":[] }
  };
}
function getProject(){ return state.projects.find(p=>p.id===state.currentId); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function saveProject(p){ p.updatedAt = Date.now(); persist(); }
function snapshot(){
  const p=getProject(); if(!p)return;
  state.history.push(clone(p)); if(state.history.length>60) state.history.shift();
  state.future.length=0;
}
function undo(){
  const p=getProject(); if(!p||!state.history.length)return;
  state.future.push(clone(p));
  const old=state.history.pop();
  const i=state.projects.findIndex(x=>x.id===p.id); state.projects[i]=old; persist(); renderEditor();
}
function redo(){
  const p=getProject(); if(!p||!state.future.length)return;
  state.history.push(clone(p));
  const next=state.future.pop();
  const i=state.projects.findIndex(x=>x.id===p.id); state.projects[i]=next; persist(); renderEditor();
}

function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function fmt(ts){ return new Date(ts).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }

function renderHome(){
  stopPlayback();
  state.currentId=null; state.history=[]; state.future=[];
  const cards = state.projects.length ? state.projects
    .slice().sort((a,b)=>b.updatedAt-a.updatedAt)
    .map(p=>`
      <article class="project-card">
        <h3>${esc(p.name)}</h3>
        <div class="project-meta">${p.bpm} BPM · edited ${fmt(p.updatedAt)}</div>
        <div class="project-actions">
          <button class="btn" data-open="${p.id}">Open</button>
          <button class="btn" data-rename="${p.id}">Rename</button>
          <button class="btn danger" data-delete="${p.id}">Delete</button>
        </div>
      </article>`).join("")
    : '<div class="empty">No projects yet. Make some noise.</div>';

  app.innerHTML=`
    <div class="app-shell">
      <header class="topbar"><div class="brand">Music Thing</div><div class="spacer"></div><button id="newBtn" class="btn primary">+ New Project</button></header>
      <main class="home"><h1>Your projects</h1><div class="sub">Everything saves locally in this browser.</div><div class="project-grid">${cards}</div></main>
    </div>`;
  document.querySelector("#newBtn").onclick=()=>nameDialog("New project","Untitled Song", name=>{
    const p=newProject(name); state.projects.push(p); persist(); openProject(p.id);
  });
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openProject(b.dataset.open));
  document.querySelectorAll("[data-rename]").forEach(b=>b.onclick=()=>{
    const p=state.projects.find(x=>x.id===b.dataset.rename);
    nameDialog("Rename project",p.name,name=>{p.name=name||p.name;p.updatedAt=Date.now();persist();renderHome();});
  });
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{
    const p=state.projects.find(x=>x.id===b.dataset.delete);
    confirmDialog("Delete “"+p.name+"”?", "This removes the local project.", ()=>{
      state.projects=state.projects.filter(x=>x.id!==p.id);persist();renderHome();
    });
  });
}

function nameDialog(title,value,onDone){
  const wrap=document.createElement("div"); wrap.className="modal-backdrop";
  wrap.innerHTML=`<div class="modal"><h2>${esc(title)}</h2><input maxlength="60" value="${esc(value)}"><div class="modal-actions"><button class="btn cancel">Cancel</button><button class="btn primary ok">Save</button></div></div>`;
  document.body.append(wrap); const input=wrap.querySelector("input"); input.focus(); input.select();
  const close=()=>wrap.remove(); wrap.querySelector(".cancel").onclick=close;
  const done=()=>{const v=input.value.trim(); if(v){close();onDone(v);}}; wrap.querySelector(".ok").onclick=done; input.onkeydown=e=>{if(e.key==="Enter")done();if(e.key==="Escape")close();};
}
function confirmDialog(title,text,onDone){
  const wrap=document.createElement("div"); wrap.className="modal-backdrop";
  wrap.innerHTML=`<div class="modal"><h2>${esc(title)}</h2><p class="sub">${esc(text)}</p><div class="modal-actions"><button class="btn cancel">Cancel</button><button class="btn danger ok">Delete</button></div></div>`;
  document.body.append(wrap); wrap.querySelector(".cancel").onclick=()=>wrap.remove(); wrap.querySelector(".ok").onclick=()=>{wrap.remove();onDone();};
}

function openProject(id){ state.currentId=id; state.history=[]; state.future=[]; renderEditor(); }

const notes=["C5","B4","A#4","A4","G#4","G4","F#4","F4","E4","D#4","D4","C#4","C4"];
function renderEditor(){
  const p=getProject(); if(!p)return renderHome();
  const pianoRows=notes.map(note=>`<div class="piano-row"><div class="key">${note}</div>${Array.from({length:16},(_,i)=>`<button class="cell ${i%4===0?"beat":""} ${p.piano[note]?.includes(i)?"active":""}" data-note="${note}" data-step="${i}" aria-label="${note} step ${i+1}"></button>`).join("")}</div>`).join("");
  const drumRows=Object.keys(p.drums).map(name=>`<div class="drum-row"><div class="drum-name">${name}</div>${Array.from({length:16},(_,i)=>`<button class="step ${i%4===0?"beat":""} ${p.drums[name].includes(i)?"active":""}" data-drum="${name}" data-step="${i}"></button>`).join("")}</div>`).join("");
  app.innerHTML=`
    <div class="editor">
      <header class="topbar"><button id="homeBtn" class="btn">← Projects</button><div class="project-title">${esc(p.name)}</div><button id="renameBtn" class="btn">Rename</button><div class="spacer"></div><span class="status">Autosaved</span></header>
      <main class="editor-main">
        <section class="transport">
          <button id="playBtn" class="btn primary">▶ Play</button><button id="stopBtn" class="btn">■ Stop</button>
          <label>BPM <input id="bpm" type="number" min="30" max="300" value="${p.bpm}"></label>
          <button id="undoBtn" class="btn">↶ Undo</button><button id="redoBtn" class="btn">↷ Redo</button>
          <div class="spacer"></div><button id="exportBtn" class="btn">Export WAV</button>
        </section>
        <section class="panel"><div class="panel-head"><span>Piano Roll</span><span class="status">16 steps · click notes</span></div><div class="scroll piano-wrap">${pianoRows}</div></section>
        <section class="panel"><div class="panel-head"><span>Drums</span><span class="status">Kick · Snare · Hats</span></div><div class="scroll drum-wrap">${drumRows}</div></section>
      </main>
    </div>`;
  document.querySelector("#homeBtn").onclick=renderHome;
  document.querySelector("#renameBtn").onclick=()=>nameDialog("Rename project",p.name,name=>{snapshot();p.name=name;saveProject(p);renderEditor();});
  document.querySelector("#undoBtn").onclick=undo; document.querySelector("#redoBtn").onclick=redo;
  document.querySelector("#playBtn").onclick=startPlayback; document.querySelector("#stopBtn").onclick=stopPlayback;
  document.querySelector("#bpm").onchange=e=>{snapshot();p.bpm=Math.max(30,Math.min(300,+e.target.value||120));saveProject(p);renderEditor();};
  document.querySelector("#exportBtn").onclick=exportWav;

  document.querySelectorAll("[data-note]").forEach(b=>b.onclick=()=>{
    snapshot(); const a=p.piano[b.dataset.note] ||= []; const s=+b.dataset.step; const i=a.indexOf(s); i>=0?a.splice(i,1):a.push(s); saveProject(p); b.classList.toggle("active");
  });
  document.querySelectorAll("[data-drum]").forEach(b=>b.onclick=()=>{
    snapshot(); const a=p.drums[b.dataset.drum]; const s=+b.dataset.step; const i=a.indexOf(s); i>=0?a.splice(i,1):a.push(s); saveProject(p); b.classList.toggle("active");
  });
}

function ensureAudio(){ if(!state.audio) state.audio=new (window.AudioContext||window.webkitAudioContext)(); if(state.audio.state==="suspended") state.audio.resume(); return state.audio; }
function noteFreq(note){
  const m=note.match(/^([A-G])(#?)(\d)$/); const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11}; const midi=(+m[3]+1)*12+base[m[1]]+(m[2]?1:0); return 440*Math.pow(2,(midi-69)/12);
}
function tone(ctx,freq,when,dur=.12,vol=.12){
  const o=ctx.createOscillator(),g=ctx.createGain(); o.type="triangle";o.frequency.value=freq;g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.0001,when+dur);o.connect(g).connect(ctx.destination);o.start(when);o.stop(when+dur);
}
function noise(ctx,when,dur=.08,vol=.18){
  const len=Math.max(1,Math.floor(ctx.sampleRate*dur)), buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0); for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf;g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.0001,when+dur);s.connect(g).connect(ctx.destination);s.start(when);
}
function drum(ctx,name,when){
  if(name==="Kick"){ const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(130,when);o.frequency.exponentialRampToValueAtTime(45,when+.14);g.gain.setValueAtTime(.5,when);g.gain.exponentialRampToValueAtTime(.0001,when+.16);o.connect(g).connect(ctx.destination);o.start(when);o.stop(when+.17); }
  else noise(ctx,when,name==="Open Hat"?.18:.07,name==="Snare"?.28:.12);
}
function playStep(step){
  const p=getProject(); if(!p)return; const ctx=ensureAudio(),t=ctx.currentTime+.01;
  for(const n of notes) if(p.piano[n]?.includes(step)) tone(ctx,noteFreq(n),t);
  for(const [name,steps] of Object.entries(p.drums)) if(steps.includes(step)) drum(ctx,name,t);
}
function startPlayback(){
  stopPlayback(); ensureAudio(); state.step=0; playStep(0);
  const p=getProject(); state.timer=setInterval(()=>{state.step=(state.step+1)%16;playStep(state.step);},60000/p.bpm/4);
}
function stopPlayback(){ if(state.timer){clearInterval(state.timer);state.timer=null;} }

async function exportWav(){
  const p=getProject(); if(!p)return;
  const secondsPerStep=60/p.bpm/4, duration=secondsPerStep*16+.5, rate=44100;
  const ctx=new OfflineAudioContext(2,Math.ceil(duration*rate),rate);
  function connectTone(freq,when,dur=.18,vol=.13){const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.value=freq;g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.0001,when+dur);o.connect(g).connect(ctx.destination);o.start(when);o.stop(when+dur);}
  function connectNoise(when,dur=.08,vol=.15){const len=Math.floor(rate*dur),buf=ctx.createBuffer(1,len,rate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf;g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(.0001,when+dur);s.connect(g).connect(ctx.destination);s.start(when);}
  for(let step=0;step<16;step++){const when=step*secondsPerStep;for(const n of notes)if(p.piano[n]?.includes(step))connectTone(noteFreq(n),when);for(const [name,steps] of Object.entries(p.drums))if(steps.includes(step)){if(name==="Kick"){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(130,when);o.frequency.exponentialRampToValueAtTime(45,when+.14);g.gain.setValueAtTime(.5,when);g.gain.exponentialRampToValueAtTime(.0001,when+.16);o.connect(g).connect(ctx.destination);o.start(when);o.stop(when+.17);}else connectNoise(when,name==="Open Hat"?.18:.07,name==="Snare"?.25:.12);}}
  const rendered=await ctx.startRendering(),wav=audioBufferToWav(rendered),blob=new Blob([wav],{type:"audio/wav"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(p.name||"music-thing")+".wav";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function audioBufferToWav(buffer){
  const channels=buffer.numberOfChannels, length=buffer.length*channels*2+44, out=new ArrayBuffer(length),v=new DataView(out);let pos=0;
  const str=s=>{for(let i=0;i<s.length;i++)v.setUint8(pos++,s.charCodeAt(i));}; const u16=n=>{v.setUint16(pos,n,true);pos+=2;};const u32=n=>{v.setUint32(pos,n,true);pos+=4;};
  str("RIFF");u32(length-8);str("WAVE");str("fmt ");u32(16);u16(1);u16(channels);u32(buffer.sampleRate);u32(buffer.sampleRate*channels*2);u16(channels*2);u16(16);str("data");u32(length-44);
  for(let i=0;i<buffer.length;i++)for(let c=0;c<channels;c++){let s=Math.max(-1,Math.min(1,buffer.getChannelData(c)[i]));v.setInt16(pos,s<0?s*32768:s*32767,true);pos+=2;}
  return out;
}
renderHome();
