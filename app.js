let sb=null, user=null, subjects=[], selected=null, authMode="login";
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)};
function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function isoDate(d){return d?new Date(d+"T00:00:00").toLocaleDateString("pt-BR"): "Sem data"}

async function boot(){
  if(window.SUPABASE_URL?.startsWith("http") && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes("COLE_AQUI")){
    sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
    const {data}=await sb.auth.getSession(); if(data.session) await enter(data.session.user);
    sb.auth.onAuthStateChange(async(_,session)=>{if(session) await enter(session.user); else logoutUI()});
  }else{
    $("#authMsg").textContent="Configure config.js com a URL e a anon key do Supabase para ativar a nuvem.";
  }
}
async function enter(u){user=u;$("#authScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#userEmail").textContent=u.email;await loadSubjects();renderDashboard()}
function logoutUI(){$("#app").classList.add("hidden");$("#authScreen").classList.remove("hidden");user=null}
async function auth(e){
 e.preventDefault(); if(!sb){$("#authMsg").textContent="Configure o Supabase em config.js primeiro.";return}
 const email=$("#email").value,password=$("#password").value; let r;
 if(authMode==="login") r=await sb.auth.signInWithPassword({email,password});
 else r=await sb.auth.signUp({email,password});
 if(r.error) $("#authMsg").textContent=r.error.message; else {$("#authMsg").textContent=authMode==="signup"?"Conta criada. Verifique seu e-mail se a confirmação estiver ativada.":"";if(r.data.session) await enter(r.data.session.user)}
}
async function loadSubjects(){
 const {data,error}=await sb.from("subjects").select("*").order("created_at"); if(error)return toast(error.message);subjects=data||[];renderSubjectNav();renderSubjectCards()
}
function renderSubjectNav(){$("#subjectNav").innerHTML=subjects.map(s=>`<button class="subject-nav-item ${selected?.id===s.id?"active":""}" data-subject="${s.id}">▸ ${esc(s.name)}</button>`).join("")}
async function selectSubject(id){
 selected=subjects.find(s=>s.id===id); if(!selected)return; $("#dashboard").classList.add("hidden");$("#allNotesView").classList.add("hidden");$("#allTasksView").classList.add("hidden");$("#subjectView").classList.remove("hidden");$("#subjectTitle").textContent=selected.name;$("#breadcrumb").textContent=selected.name;renderSubjectNav();await loadSubjectData()
}
async function loadSubjectData(){
 const [{data:note},{data:tasks},{data:links},{data:files}]=await Promise.all([
  sb.from("notes").select("*").eq("subject_id",selected.id).maybeSingle(),
  sb.from("tasks").select("*").eq("subject_id",selected.id).order("due_date"),
  sb.from("links").select("*").eq("subject_id",selected.id).order("created_at",{ascending:false}),
  sb.from("files").select("id,name,mime_type,created_at").eq("subject_id",selected.id).order("created_at",{ascending:false})
 ]);
 $("#notes").value=note?.content||"";$("#tasks").innerHTML=(tasks||[]).map(taskHTML).join("")||empty("Nenhuma prova ou tarefa.");$("#links").innerHTML=(links||[]).map(linkHTML).join("")||empty("Nenhum link adicionado.");$("#files").innerHTML=(files||[]).map(fileHTML).join("")||empty("Nenhum arquivo enviado.")
}
const empty=x=>`<div class="muted" style="padding:18px 0">${x}</div>`;
const taskHTML=t=>`<div class="task"><button class="check ${t.completed?"done":""}" data-task="${t.id}" title="Concluir">${t.completed?"✓":""}</button><div class="task-info"><b>${esc(t.title)}</b><small>${isoDate(t.due_date)}</small></div><button class="task-delete" data-delete-task="${t.id}">×</button></div>`;
const linkHTML=l=>`<div class="link-item"><div class="item-main"><b>${esc(l.title)}</b><small><a class="item-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url)}</a></small></div><button class="task-delete" data-delete-link="${l.id}">×</button></div>`;
const fileHTML=f=>`<div class="file-item"><div class="item-main"><b>${esc(f.name)}</b><small>${esc(f.mime_type||"arquivo")}</small></div><button class="task-delete" data-delete-file="${f.id}">×</button></div>`;
function renderSubjectCards(){$("#subjectCards").innerHTML=subjects.map(s=>`<div class="subject-card" data-subject="${s.id}"><b>${esc(s.name)}</b><small>Organizar materiais →</small></div>`).join("")||empty("Crie sua primeira matéria.")}
async function renderDashboard(){
 $("#subjectView").classList.add("hidden");$("#allNotesView").classList.add("hidden");$("#allTasksView").classList.add("hidden");$("#dashboard").classList.remove("hidden");$("#breadcrumb").textContent="Visão geral";renderSubjectCards();
 if(!sb)return;
 const [{count:tc},{count:done},{data:tasks}]=await Promise.all([
  sb.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",user.id),
  sb.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("completed",true),
  sb.from("tasks").select("*").eq("user_id",user.id).eq("completed",false).order("due_date").limit(6)
 ]);
 $("#stats").innerHTML=[["📚",subjects.length,"Matérias"],["✓",tc||0,"Provas / tarefas"],["✓",done||0,"Concluídas"],["☁","∞","Sincronização"]].map(x=>`<div class="stat"><span>${x[0]}</span><div class="number">${x[1]}</div><small>${x[2]}</small></div>`).join("");
 $("#upcoming").innerHTML=(tasks||[]).map(t=>taskHTML(t)).join("")||empty("Tudo em dia.");
}
function modal(title,body){$("#modalBody").innerHTML=`<h2>${title}</h2>${body}`;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
async function addSubject(){
 modal("Nova matéria",`<label>Nome<input id="mName" placeholder="Ex.: Matemática"></label><button class="primary" id="mSave">Criar matéria</button>`);
 $("#mSave").onclick=async()=>{const name=$("#mName").value.trim();if(!name)return;if(!sb)return;const r=await sb.from("subjects").insert({user_id:user.id,name}).select().single();if(r.error)return toast(r.error.message);subjects.push(r.data);closeModal();renderSubjectNav();renderSubjectCards();toast("Matéria criada ✓")}
}
async function addTask(){
 if(!selected)return;
 modal("Nova prova / tarefa",`<label>Título<input id="mTitle" placeholder="Ex.: Prova P2 — Matemática"></label><label>Data<input id="mDate" type="date"></label><button class="primary" id="mSave">Adicionar</button>`);
 $("#mSave").onclick=async()=>{const title=$("#mTitle").value.trim();if(!title)return;const r=await sb.from("tasks").insert({user_id:user.id,subject_id:selected.id,title,due_date:$("#mDate").value||null});if(r.error)return toast(r.error.message);closeModal();await loadSubjectData();toast("Tarefa adicionada ✓")}
}
async function addLink(){
 modal("Adicionar link",`<label>Título<input id="mTitle" placeholder="Ex.: Aula sobre integrais"></label><label>URL<input id="mUrl" type="url" placeholder="https://..."></label><button class="primary" id="mSave">Salvar link</button>`);
 $("#mSave").onclick=async()=>{const title=$("#mTitle").value.trim(),url=$("#mUrl").value.trim();if(!title||!url)return;const r=await sb.from("links").insert({user_id:user.id,subject_id:selected.id,title,url});if(r.error)return toast(r.error.message);closeModal();await loadSubjectData();toast("Link salvo ✓")}
}
async function saveNote(){
 const content=$("#notes").value;const {data:old}=await sb.from("notes").select("id").eq("subject_id",selected.id).maybeSingle();let r;
 if(old)r=await sb.from("notes").update({content,updated_at:new Date().toISOString()}).eq("id",old.id);
 else r=await sb.from("notes").insert({user_id:user.id,subject_id:selected.id,content});
 if(r.error)toast(r.error.message);else toast("Anotação sincronizada ✓")
}
async function uploadFile(e){
 const file=e.target.files[0];if(!file||!selected)return;toast("Lendo arquivo...");
 const reader=new FileReader();reader.onload=async()=>{const r=await sb.from("files").insert({user_id:user.id,subject_id:selected.id,name:file.name,mime_type:file.type,data_base64:reader.result});if(r.error)toast(r.error.message);else{await loadSubjectData();toast("Arquivo salvo ✓")}};reader.readAsDataURL(file);e.target.value=""
}
async function deleteSubject(){if(!selected||!confirm(`Excluir "${selected.name}" e todo o conteúdo dela?`))return;const r=await sb.from("subjects").delete().eq("id",selected.id);if(r.error)return toast(r.error.message);selected=null;await loadSubjects();renderDashboard();toast("Matéria excluída")}
async function toggleTask(id){const {data}=await sb.from("tasks").select("completed").eq("id",id).single();await sb.from("tasks").update({completed:!data.completed}).eq("id",id);if(selected)await loadSubjectData();renderDashboard()}
async function allNotes(){const {data}=await sb.from("notes").select("*,subjects(name)").eq("user_id",user.id).order("updated_at",{ascending:false});$("#dashboard,#subjectView,#allTasksView").forEach(x=>x.classList.add("hidden"));$("#allNotesView").classList.remove("hidden");$("#breadcrumb").textContent="Todas as anotações";$("#allNotes").innerHTML=(data||[]).map(n=>`<div class="note-card"><h3>${esc(n.subjects?.name||"Matéria")}</h3><p>${esc(n.content||"Sem conteúdo")}</p></div>`).join("")||empty("Nenhuma anotação ainda.")}
async function allTasks(){const {data}=await sb.from("tasks").select("*,subjects(name)").eq("user_id",user.id).order("due_date");$("#dashboard,#subjectView,#allNotesView").forEach(x=>x.classList.add("hidden"));$("#allTasksView").classList.remove("hidden");$("#breadcrumb").textContent="Provas e tarefas";$("#allTasks").innerHTML=(data||[]).map(t=>`<div class="panel" style="margin-bottom:9px">${taskHTML(t)}<small style="color:var(--muted)">${esc(t.subjects?.name||"")}</small></div>`).join("")||empty("Nenhuma tarefa.")}
document.addEventListener("click",async e=>{
 const s=e.target.closest("[data-subject]");if(s){selectSubject(s.dataset.subject);return}
 const t=e.target.closest("[data-task]");if(t){toggleTask(t.dataset.task);return}
 const dt=e.target.closest("[data-delete-task]");if(dt){await sb.from("tasks").delete().eq("id",dt.dataset.deleteTask);if(selected)loadSubjectData();renderDashboard();return}
 const dl=e.target.closest("[data-delete-link]");if(dl){await sb.from("links").delete().eq("id",dl.dataset.deleteLink);loadSubjectData();return}
 const df=e.target.closest("[data-delete-file]");if(df){await sb.from("files").delete().eq("id",df.dataset.deleteFile);loadSubjectData();return}
});
$("#authForm").onsubmit=auth;
$$(".auth-tab").forEach(b=>b.onclick=()=>{authMode=b.dataset.auth;$$(".auth-tab").forEach(x=>x.classList.toggle("active",x===b));$("#authSubmit").textContent=authMode==="login"?"Entrar":"Criar conta"});
$("#newSubjectBtn").onclick=$("#addSubject2").onclick=addSubject;
$("#quickNoteBtn").onclick=async()=>{if(subjects[0]){await selectSubject(subjects[0].id);setTimeout(()=>$("#notes").focus(),100)}else addSubject()};
$("#newTaskBtn").onclick=$("#newTaskBtn2").onclick=addTask;$("#newLinkBtn").onclick=addLink;$("#saveNoteBtn").onclick=saveNote;$("#deleteSubjectBtn").onclick=deleteSubject;$("#fileInput").onchange=uploadFile;
$("#allNotesBtn").onclick=allNotes;$("#allTasksBtn").onclick=allTasks;
$("#mobileBtn").onclick=()=>$(".sidebar").classList.toggle("open");
$("#closeModal").onclick=closeModal;$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
$("#logoutBtn").onclick=async()=>{if(sb)await sb.auth.signOut();logoutUI()};
$("#themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.studyTheme=document.body.classList.contains("light")?"light":"dark"};if(localStorage.studyTheme==="light")document.body.classList.add("light");
boot();
