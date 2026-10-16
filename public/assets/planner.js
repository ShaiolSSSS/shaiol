import {STATUSES,STREAMS,PRIORITIES,todayInShanghai,dayNumber,dateFromDay,shortDate,safeLink,summary,validateTask,filterTasks,timeline,demoProject,taskBlockers,isOverdue} from "./planner-model.js";
const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
const escape=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const base=document.body.dataset.base,today=todayInShanghai();
const state={demo:false,client:null,user:null,projects:[],project:null,members:[],tasks:[],view:"gantt",filters:{query:"",phase:"",person:"",status:"",archived:false},zoom:"week",load:0,busy:false,creating:false,editing:null};
let toastTimer,pollTimer,authUser="",configReady=false;
const person=id=>state.members.find(m=>m.user_id===id)?.display_name || "未分配";
const own=()=>state.demo || state.members.some(m=>m.user_id===state.user?.id && m.role==="owner");
const option=(value,label,selected="")=>`<option value="${escape(value)}"${value===selected?" selected":""}>${escape(label)}</option>`;
const statusTag=task=>`<span class="status-tag status-${escape(task.status)}">${escape(STATUSES[task.status] || task.status)}</span>`;
function toast(message){$("#toast").textContent=message;$("#toast").hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").hidden=true,4500);}
function friendly(error){const message=error?.message || String(error);if(message.includes("CONFLICT"))return "其他成员已经更新了这条记录。本次输入仍保留，请关闭详情、刷新并重新编辑，避免覆盖他人的修改。";if(/[\u4e00-\u9fff]/.test(message))return message;if(/invalid login|invalid credentials/i.test(message))return "邮箱或密码不正确，或账号尚未激活。";if(/fetch|network|failed to load/i.test(message))return "网络连接失败，请稍后重试。本次输入尚未保存。";if(/permission|42501/i.test(message))return "你的账号没有此项目的操作权限，请联系项目负责人。";if(/rate limit|too many/i.test(message))return "请求过于频繁，请稍等片刻再试。";return "操作未完成，请检查连接和项目配置后重试。";}
const check=result=>{if(result.error)throw result.error;return result.data;};
const single=data=>Array.isArray(data)?data[0]:data;
function showWorkspace(){ $("#login-screen").hidden=true;$("#workspace").hidden=false;$("#demo-banner").hidden=!state.demo;$("#change-password").hidden=state.demo;$("#create-project").hidden=state.demo;window.scrollTo({top:0,behavior:"instant"}); }
function clearDialogs(){state.editing=null;$$('dialog[open]').forEach(d=>d.close());$("#task-form").reset();$("#member-form").reset();$("#settings-form").reset();for(const key of ["phase","assignee_id","dependencies"])$("#task-form").elements[key].replaceChildren();$("#member-list").replaceChildren();$("#task-updated").textContent="";}
function clearPrivateState(){state.load++;state.projects=[];state.project=null;state.members=[];state.tasks=[];clearDialogs();$("#view-container").replaceChildren();render();}
function showLogin(){clearInterval(pollTimer);clearPrivateState();$("#workspace").hidden=true;$("#login-screen").hidden=false;$("#login-form").reset();$("#password-form").reset();$("#login-error").textContent="";}
function render(){
  const project=state.project,active=state.tasks.filter(t=>!t.archived),stats=summary(state.tasks,today);
  $("#project-name").textContent=project?.name || "项目工作台";$("#project-crumb").textContent=project?.name || "未选择";
  $("#project-caption").textContent=state.demo?"一份可编辑的虚构示例，用来体验项目管理流程。":project?"任务与排期仅对本项目成员开放。":"创建项目，或联系负责人加入现有项目。";
  $("#project-select").innerHTML=state.projects.map(p=>option(p.id,p.name,project?.id)).join("") || option("","还没有项目");
  $("#project-select").disabled=state.demo || !state.projects.length;
  $("#no-project").hidden=Boolean(project);$("#new-task").disabled=!project;$("#export-data").disabled=!project;
  $("#project-settings").hidden=!own() || !project;$("#manage-members").hidden=!project;
  const me=state.members.find(m=>m.user_id===state.user?.id),name=state.demo?"演示访客":me?.display_name || state.user?.email?.split("@")[0] || "项目成员";
  $("#user-name").textContent=name;$("#user-avatar").textContent=name.slice(0,1).toUpperCase();$("#user-role").textContent=state.demo?"仅示例数据":own()?"项目负责人":"项目成员";
  $("#total-progress").innerHTML=`${stats.progress}<small>%</small>`;$("#total-progress-bar").style.width=`${stats.progress}%`;
  $("#done-count").innerHTML=`${stats.done} <small>/ ${stats.total}</small>`;
  const attention=new Set(active.filter(t=>isOverdue(t,today)||t.status!=="done"&&(t.status==="blocked"||taskBlockers(t,active).length)).map(t=>t.id));
  $("#attention-count").textContent=attention.size;$("#attention-count").closest("article").classList.toggle("attention",attention.size>0);
  $("#attention-detail").textContent=`${stats.overdue} 项逾期 · ${stats.blocked} 项受阻 / 等待前置`;
  const next=stats.milestones.filter(t=>t.status!=="done").sort((a,b)=>(a.ends || "9999").localeCompare(b.ends || "9999"))[0];
  $("#next-milestone").textContent=next?.name || "尚未设置";$("#milestone-date").textContent=next?`${next.ends || "未排期"} · ${STATUSES[next.status]}`:"让关键交付成为清晰的节点";
  $("#phase-progress").innerHTML=(project?.phases || []).map((phase,index)=>{const s=summary(active.filter(t=>t.phase===phase),today);return `<div class="phase-item"><span title="${escape(phase)}">${String(index+1).padStart(2,"0")} ${escape(phase)}</span><div class="progress-track"><i style="width:${s.progress}%"></i></div><b>${s.progress}%</b></div>`;}).join("");
  $("#filter-phase").innerHTML=option("","全部阶段",state.filters.phase)+(project?.phases || []).map(p=>option(p,p,state.filters.phase)).join("");
  $("#filter-person").innerHTML=option("","全部成员",state.filters.person)+option("unassigned","未分配",state.filters.person)+state.members.map(m=>option(m.user_id,m.display_name,state.filters.person)).join("");
  $("#filter-status").innerHTML=option("","全部状态",state.filters.status)+Object.entries(STATUSES).map(([v,l])=>option(v,l,state.filters.status)).join("");
  $("#clear-filters").hidden=!Object.entries(state.filters).some(([k,v])=>k!=="archived"&&v);
  renderView();
}
function taskSubtitle(task){const blocked=taskBlockers(task,state.tasks);return `${task.kind==="milestone"?"◇ 里程碑 · ":""}${task.workstream || "其他"} · ${person(task.assignee_id)}${blocked.length&&task.status!=="done"?` · 等待 ${blocked.length} 项前置`:""}`;}
function renderView(){
  const visible=filterTasks(state.tasks,state.filters),phaseIndex=new Map((state.project?.phases || []).map((p,i)=>[p,i]));
  visible.sort((a,b)=>(phaseIndex.get(a.phase)??99)-(phaseIndex.get(b.phase)??99)||(a.starts || "9999").localeCompare(b.starts || "9999")||a.name.localeCompare(b.name,"zh-CN"));
  $("#view-title").textContent={gantt:"项目甘特图",table:"项目任务表",board:"任务流程看板"}[state.view];$("#task-count").textContent=`${visible.length} 项${state.filters.archived?"归档":""}`;
  $$("[data-view]").forEach(b=>{b.classList.toggle("selected",b.dataset.view===state.view);b.setAttribute("aria-current",b.dataset.view===state.view?"true":"false");});
  $("#timeline-zoom").hidden=state.view!=="gantt";$("#go-today").hidden=state.view!=="gantt";
  $("#view-note").textContent={gantt:"点击任务编辑详情 · 连线表示前置关系 · ◇ 为里程碑",table:"执行进度独立于验收状态 · 日期可暂不填写",board:"选择卡片下方状态更新流程 · 点击任务名查看详情"}[state.view];
  if(!visible.length){$("#view-container").innerHTML=`<div class="empty-state"><b>${state.project?"这里还没有任务":"等待加入项目"}</b><p>${state.tasks.length?"当前筛选下没有匹配任务，试试调整筛选。":state.project?"从一个明确的交付开始，安排阶段、负责人和排期。":"登录并加入项目后，任务会出现在这里。"}</p>${state.project&&!state.filters.archived?'<button class="button secondary" data-action="new">＋ 新建任务</button>':""}</div>`;return;}
  const scroll=$("#view-container"),left=scroll.scrollLeft,top=scroll.scrollTop;
  scroll.innerHTML=state.view==="table"?renderTable(visible):state.view==="board"?renderBoard(visible):renderGantt(visible);
  scroll.scrollLeft=left;scroll.scrollTop=top;
}
function renderTable(tasks){return `<table class="task-table"><thead><tr><th>任务 / 交付</th><th>阶段</th><th>负责人</th><th>状态</th><th>执行进度</th><th>计划日期</th><th>工作量</th></tr></thead><tbody>${tasks.map(t=>`<tr><td><button class="task-name" data-task="${escape(t.id)}">${t.kind==="milestone"?"◇ ":""}${escape(t.name)}</button><div class="task-sub">${escape(t.workstream)}${taskBlockers(t,state.tasks).length?" · 等待前置":""}${t.priority==="high"?" · 高优先级":""}</div></td><td>${escape(t.phase)}</td><td>${escape(person(t.assignee_id))}</td><td>${statusTag(t)}</td><td><div class="mini-progress"><div class="progress-track"><i style="width:${Number(t.progress)}%"></i></div>${Number(t.progress)}%</div></td><td class="${isOverdue(t,today)?"due-warning":""}">${t.starts?`${shortDate(t.starts)} — ${shortDate(t.ends)}`:"未排期"}</td><td>${t.kind==="milestone"?"—":Number(t.effort)}</td></tr>`).join("")}</tbody></table>`;}
function renderBoard(tasks){return `<div class="board">${Object.entries(STATUSES).map(([status,label])=>{const group=tasks.filter(t=>t.status===status);return `<section class="board-column"><h3>${label}<span>${group.length}</span></h3>${group.map(t=>`<article class="board-card"><small><span>${escape(t.phase)}</span><span>${t.kind==="milestone"?"◇":escape(PRIORITIES[t.priority])}</span></small><button class="task-name" data-task="${escape(t.id)}">${escape(t.name)}</button><div class="progress-track"><i style="width:${Number(t.progress)}%"></i></div><div class="board-meta"><span>${escape(person(t.assignee_id))}</span><span class="${isOverdue(t,today)?"due-warning":""}">${shortDate(t.ends)}</span></div><select class="board-status-select" data-status-task="${escape(t.id)}" aria-label="${escape(t.name)}的状态"${t.archived?" disabled":""}>${Object.entries(STATUSES).map(([v,l])=>option(v,l,t.status)).join("")}</select></article>`).join("")||'<p class="board-empty">暂无任务</p>'}</section>`;}).join("")}</div>`;}
function renderGantt(tasks){
  const range=timeline(tasks,today),step=Math.max(1,Math.ceil(range.days/370)),dayWidth=Math.min({day:40,week:26,month:13}[state.zoom],24000/range.days),width=dayWidth*range.days;
  state.chart={...range,dayWidth};
  const todayX=(dayNumber(today)-range.start+.5)*dayWidth,todayLine=todayX>=0&&todayX<=width?`<i class="today-line" style="left:${todayX}px"></i>`:"";
  let months="",days="",previousMonth="";
  for(let index=0;index<range.days;index+=step){const date=dateFromDay(range.start+index),month=date.slice(0,7),weekend=[0,6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());if(month!==previousMonth){months+=`<span style="left:${index*dayWidth}px">${month.replace("-"," / ")}</span>`;previousMonth=month;}days+=`<span class="${weekend?"weekend ":""}${date===today?"today":""}" style="width:${Math.min(step,range.days-index)*dayWidth}px">${step>1?shortDate(date):date.slice(8)}</span>`;}
  const row=t=>{const start=(dayNumber(t.starts)-range.start)*dayWidth,duration=(dayNumber(t.ends)-dayNumber(t.starts)+1)*dayWidth,dependency=taskBlockers(t,state.tasks);return `<div class="gantt-row"><div class="gantt-label"><div class="task-title-group"><button class="task-name" data-task="${escape(t.id)}" title="${escape(t.name)}">${t.kind==="milestone"?"◇ ":""}${escape(t.name)}</button><div class="task-sub">${escape(taskSubtitle(t))}</div></div><small class="${isOverdue(t,today)?"due-warning":""}">${Number(t.progress)}%</small></div><div class="gantt-track">${todayLine}${!t.starts?`<button class="gantt-unscheduled" data-task="${escape(t.id)}">＋ 安排日期</button>`:t.kind==="milestone"?`<button class="gantt-milestone status-${escape(t.status)}" data-task="${escape(t.id)}" style="left:${start+dayWidth/2-8}px" aria-label="里程碑：${escape(t.name)}，${escape(t.ends)}"></button>`:`<button class="gantt-bar status-${escape(t.status)}" data-task="${escape(t.id)}" style="left:${start}px;width:${Math.max(10,duration-3)}px;--progress:${Number(t.progress)}%" title="${escape(t.name)} · ${escape(t.starts)} — ${escape(t.ends)} · ${Number(t.progress)}%${dependency.length?" · 等待前置":""}"><span>${escape(person(t.assignee_id))} · ${Number(t.progress)}%</span></button>`}</div></div>`;};
  const positions=new Map(tasks.map((t,i)=>[t.id,{task:t,y:i*55+27}]));let paths="";
  for(const target of tasks){if(!target.starts)continue;for(const id of target.dependencies || []){const from=positions.get(id),to=positions.get(target.id);if(!from?.task.ends)continue;const x1=(dayNumber(from.task.ends)-range.start+1)*dayWidth,x2=(dayNumber(target.starts)-range.start)*dayWidth;paths+=`<path d="M ${x1} ${from.y} C ${x1+12} ${from.y}, ${x2-12} ${to.y}, ${x2} ${to.y}" marker-end="url(#dependency-arrow)"/>`;}}
  return `<div class="gantt" style="--days:${range.days};--rows:${tasks.length};--day:${dayWidth}px"><div class="gantt-row gantt-header"><div class="gantt-label"><span>任务 / 负责人</span><span>进度</span></div><div class="gantt-track"><div class="gantt-months">${months}</div><div class="gantt-days">${days}</div></div></div>${tasks.map(row).join("")}<svg class="gantt-dependencies" aria-hidden="true"><defs><marker id="dependency-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 6 3 L 0 6" style="fill:#a5b7a0;stroke:none"/></marker></defs>${paths}</svg></div>`;
}
async function loadProjects(preferred=state.project?.id){
  const request=++state.load;$("#sync-status").textContent="同步中…";
  try{
    const projects=check(await state.client.from("planner_projects").select("*").order("created_at"));if(request!==state.load)return;
    const project=projects.find(p=>p.id===preferred)||projects[0]||null;
    if(!project){clearPrivateState();$("#sync-status").textContent="已同步";return;}
    const [memberResult,taskResult]=await Promise.all([state.client.from("planner_members").select("*").eq("project_id",project.id).order("display_name"),readAllTasks(project.id)]);
    const members=check(memberResult),tasks=taskResult;if(request!==state.load)return;
    if(state.project?.id!==project.id)clearDialogs();state.projects=projects;state.project=project;state.members=members;state.tasks=tasks;render();
    $("#sync-status").textContent=`已同步 ${new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date())}`;
  }catch(error){if(request!==state.load)return;$("#sync-status").textContent="同步失败，请重试";throw error;}
}
async function readAllTasks(projectId){const all=[];for(let start=0;start<10000;start+=1000){const data=check(await state.client.from("planner_tasks").select("*").eq("project_id",projectId).order("id").range(start,start+999));all.push(...data);if(data.length<1000)return all;}throw new Error("项目任务数量超过当前工作台支持范围，请先归档整理或联系维护者。");}
async function saveTask(task,expected){
  const error=validateTask(task,state.tasks,state.project.phases,state.members);if(error)throw new Error(error);
  if(state.demo){const current=state.tasks.find(t=>t.id===task.id);if(current&&current.version!==expected)throw new Error("CONFLICT");const saved={...task,version:(current?.version || 0)+1,updated_at:new Date().toISOString(),updated_by:"demo-design"};state.tasks=current?state.tasks.map(t=>t.id===task.id?saved:t):[...state.tasks,saved];render();return;}
  check(await state.client.rpc("planner_save_task",{p_project_id:state.project.id,p_task:task,p_expected_version:expected}));
  try{await loadProjects();}catch{toast("任务已保存，列表刷新暂未成功，请点击刷新。");}
}
function openTask(id){
  if(!state.project)return;const existing=id?state.tasks.find(t=>t.id===id):null;
  const task=existing || {id:crypto.randomUUID(),name:"",phase:state.project.phases[0],assignee_id:null,workstream:"策划",priority:"normal",status:"todo",progress:0,starts:null,ends:null,effort:1,kind:"task",dependencies:[],notes:"",link:"",archived:false,version:0};
  state.editing={...task,dependencies:[...task.dependencies]};const form=$("#task-form");form.reset();
  form.elements.phase.innerHTML=state.project.phases.map(p=>option(p,p,task.phase)).join("");
  form.elements.assignee_id.innerHTML=option("","未分配",task.assignee_id || "")+state.members.map(m=>option(m.user_id,m.display_name,task.assignee_id)).join("");
  form.elements.workstream.innerHTML=STREAMS.map(p=>option(p,p,task.workstream)).join("");
  form.elements.priority.innerHTML=Object.entries(PRIORITIES).map(([v,l])=>option(v,l,task.priority)).join("");
  form.elements.status.innerHTML=Object.entries(STATUSES).map(([v,l])=>option(v,l,task.status)).join("");
  form.elements.dependencies.innerHTML=state.tasks.filter(t=>t.id!==task.id&&!t.archived).map(t=>`<option value="${escape(t.id)}"${task.dependencies.includes(t.id)?" selected":""}>${escape(t.name)}</option>`).join("");
  for(const key of ["name","progress","starts","ends","effort","kind","notes","link"])form.elements[key].value=task[key]??"";
  $("#task-dialog-title").textContent=existing?"任务详情":"新建任务";$("#task-id-label").textContent=existing?task.archived?"ARCHIVED TASK":"TASK DETAIL":"NEW TASK";
  $("#task-error").textContent="";$("#archive-task").hidden=!existing;$("#archive-task").textContent=task.archived?"恢复任务":"归档任务";
  $("#task-updated").textContent=task.updated_at?`最近更新：${person(task.updated_by)} · ${new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",dateStyle:"short",timeStyle:"short"}).format(new Date(task.updated_at))} · 版本 ${task.version}`:"保存后会出现在所有工作视图中。";
  $("#task-dialog").showModal();
}
function taskFromForm(){const form=$("#task-form"),task={...state.editing};for(const key of ["name","phase","assignee_id","workstream","priority","status","starts","ends","kind","notes","link"])task[key]=form.elements[key].value.trim();task.assignee_id ||=null;task.starts ||=null;task.ends ||=null;task.progress=Number(form.elements.progress.value);task.effort=Number(form.elements.effort.value);task.dependencies=[...form.elements.dependencies.selectedOptions].map(o=>o.value);if(task.status==="done")task.progress=100;if(task.status==="todo")task.progress=0;return task;}
async function submitTask(task){if(state.busy)return;state.busy=true;$("#save-task").disabled=true;$("#archive-task").disabled=true;$("#task-error").textContent="";try{await saveTask(task,state.editing.version);$("#task-dialog").close();toast(state.demo?"示例已更新，仅保留到本次预览结束。":"任务已保存到团队空间。");}catch(error){$("#task-error").textContent=friendly(error);}finally{state.busy=false;$("#save-task").disabled=false;$("#archive-task").disabled=false;}}
$("#task-form").addEventListener("submit",event=>{event.preventDefault();submitTask(taskFromForm());});
$("#archive-task").addEventListener("click",()=>submitTask({...state.editing,archived:!state.editing.archived}));
$("#task-form").elements.status.addEventListener("change",event=>{if(event.target.value==="done")$("#task-form").elements.progress.value=100;else if(event.target.value==="todo")$("#task-form").elements.progress.value=0;});
$("#task-form").elements.progress.addEventListener("input",event=>{const status=$("#task-form").elements.status,value=Number(event.target.value);if(value>0&&status.value==="todo"||value<100&&status.value==="done")status.value="doing";});
$("#task-form").elements.kind.addEventListener("change",event=>{if(event.target.value==="milestone"&&$("#task-form").elements.starts.value)$("#task-form").elements.ends.value=$("#task-form").elements.starts.value;});
$("#task-form").elements.starts.addEventListener("change",event=>{if($("#task-form").elements.kind.value==="milestone")$("#task-form").elements.ends.value=event.target.value;});
$$('[data-close]').forEach(button=>button.addEventListener("click",()=>button.closest("dialog").close()));
$("#new-task").addEventListener("click",()=>openTask());
$("#view-container").addEventListener("click",event=>{const target=event.target.closest("[data-task]");if(target)openTask(target.dataset.task);if(event.target.closest('[data-action="new"]'))openTask();});
$("#view-container").addEventListener("change",async event=>{const id=event.target.dataset.statusTask;if(!id)return;const task=state.tasks.find(t=>t.id===id);if(!task)return;const status=event.target.value;event.target.disabled=true;try{await saveTask({...task,status,progress:status==="done"?100:status==="todo"?0:task.progress},task.version);toast(state.demo?"示例状态已更新。":"流程状态已同步。");}catch(error){toast(friendly(error));renderView();}});
$$('[data-view]').forEach(button=>button.addEventListener("click",()=>{state.view=button.dataset.view;$("#view-container").scrollLeft=0;renderView();}));
$("#search-tasks").addEventListener("input",event=>{state.filters.query=event.target.value;renderView();$("#clear-filters").hidden=!Object.entries(state.filters).some(([k,v])=>k!=="archived"&&v);});
for(const [id,key] of [["phase","phase"],["person","person"],["status","status"]])$("#filter-"+id).addEventListener("change",event=>{state.filters[key]=event.target.value;render();});
$("#show-archived").addEventListener("change",event=>{state.filters.archived=event.target.checked;renderView();});
$("#clear-filters").addEventListener("click",()=>{Object.assign(state.filters,{query:"",phase:"",person:"",status:""});$("#search-tasks").value="";render();});
$("#timeline-zoom").addEventListener("change",event=>{state.zoom=event.target.value;renderView();});
$("#go-today").addEventListener("click",()=>{const c=state.chart;if(!c)return;const index=dayNumber(today)-c.start;if(index<0||index>c.days){toast("今天不在当前任务排期范围内。");return;}$("#view-container").scrollTo({left:Math.max(0,index*c.dayWidth-$("#view-container").clientWidth/2+290),behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"});});
$("#refresh-project").addEventListener("click",async()=>{if(state.demo){toast("示例为本次预览数据；登录后可同步团队项目。");return;}try{await loadProjects();toast("项目已刷新。");}catch(error){toast(friendly(error));}});
$("#project-select").addEventListener("change",async event=>{state.filters={query:"",phase:"",person:"",status:"",archived:false};$("#search-tasks").value="";$("#show-archived").checked=false;try{await loadProjects(event.target.value);}catch(error){toast(friendly(error));}});
$("#export-data").addEventListener("click",()=>{if(!state.project)return;const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),project:state.project,members:state.members,tasks:state.tasks},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`project-${state.project.id}-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("已导出；真实项目文件请仅在团队内保存。");});
function openSettings(create=false){if(!create&&!own())return;state.creating=create;state.settingsVersion=state.project?.version;$("#settings-title").textContent=create?"创建项目":"项目与阶段";$("#settings-form").elements.name.value=create?"":state.project.name;$("#settings-form").elements.phases.value=(create?["方案设计","内容制作","联调验收"]:state.project.phases).join("\n");$("#settings-error").textContent="";$("#settings-dialog").showModal();}
$("#project-settings").addEventListener("click",()=>openSettings(false));$("#create-project").addEventListener("click",()=>openSettings(true));
$("#settings-form").addEventListener("submit",async event=>{event.preventDefault();const form=event.target,name=form.elements.name.value.trim(),phases=form.elements.phases.value.split("\n").map(s=>s.trim()).filter(Boolean);if(!name||name.length>80||!phases.length||phases.length>20||phases.some(p=>p.length>40)||new Set(phases).size!==phases.length){$("#settings-error").textContent="请填写项目名称和 1—20 个不重复的阶段，每个阶段最多 40 字。";return;}if(!state.creating&&state.tasks.some(t=>!t.archived&&!phases.includes(t.phase))){$("#settings-error").textContent="要移除的阶段中仍有任务，请先调整任务阶段。";return;}const button=form.querySelector('[type="submit"]');button.disabled=true;try{if(state.demo){state.project={...state.project,name,phases,version:state.project.version+1};state.projects=[state.project];render();}else{const data=check(await state.client.rpc(state.creating?"planner_create_project":"planner_update_project",state.creating?{p_name:name,p_phases:phases,p_display_name:state.user.email.split("@")[0].slice(0,40)}:{p_id:state.project.id,p_name:name,p_phases:phases,p_expected_version:state.settingsVersion}));await loadProjects(single(data).id);}$("#settings-dialog").close();toast(state.demo?"示例项目已更新。":"项目已保存。");}catch(error){$("#settings-error").textContent=friendly(error);}finally{button.disabled=false;}});
function showMembers(){ $("#member-list").innerHTML=state.members.map(m=>`<div class="member-row"><span>${escape(m.display_name)}</span><small>${m.role==="owner"?"项目负责人":"成员 · 可更新任务"}</small>${own()&&!state.demo&&m.role!=="owner"?`<button class="text-button" data-remove-member="${escape(m.user_id)}">移出项目</button>`:""}</div>`).join("");$("#member-form").hidden=!own()||state.demo;$("#member-error").textContent="";$("#member-form").reset();$("#members-dialog").showModal();}
$("#manage-members").addEventListener("click",showMembers);
$("#member-list").addEventListener("click",async event=>{const button=event.target.closest("[data-remove-member]");if(!button)return;button.disabled=true;try{check(await state.client.rpc("planner_remove_member",{p_project_id:state.project.id,p_user_id:button.dataset.removeMember}));await loadProjects();$("#members-dialog").close();showMembers();toast("成员已移出项目，其原有任务改为未分配。需要时可重新加入。");}catch(error){toast(friendly(error));button.disabled=false;}});
$("#member-form").addEventListener("submit",async event=>{event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]');button.disabled=true;try{check(await state.client.rpc("planner_add_member",{p_project_id:state.project.id,p_email:form.elements.email.value.trim(),p_display_name:form.elements.display_name.value.trim()}));await loadProjects();$("#members-dialog").close();showMembers();toast("成员已加入项目。");}catch(error){$("#member-error").textContent=friendly(error);}finally{button.disabled=false;}});
function openPassword(){ $("#password-form").reset();$("#password-error").textContent="";if(!$("#password-dialog").open)$("#password-dialog").showModal();}
$("#change-password").addEventListener("click",openPassword);
$("#password-form").addEventListener("submit",async event=>{event.preventDefault();const form=event.target,password=form.elements.password.value;if(password!==form.elements.confirm.value){$("#password-error").textContent="两次密码不一致。";return;}const button=form.querySelector('[type="submit"]');button.disabled=true;try{check(await state.client.auth.updateUser({password}));$("#password-dialog").close();form.reset();toast("密码已更新。");}catch(error){$("#password-error").textContent=friendly(error);}finally{button.disabled=false;}});
$("#enter-demo").addEventListener("click",()=>{clearInterval(pollTimer);authUser="";const demo=demoProject(today);state.demo=true;state.project=demo.project;state.projects=[demo.project];state.tasks=demo.tasks;state.members=demo.members;state.user=null;state.filters={query:"",phase:"",person:"",status:"",archived:false};$("#search-tasks").value="";$("#show-archived").checked=false;state.view="gantt";showWorkspace();render();$("#sync-status").textContent="仅本次预览";});
async function exitSpace(){if(state.demo){state.demo=false;showLogin();if(state.client){const {data}=await state.client.auth.getSession();if(data.session)await applySession(data.session);}return;}try{check(await state.client.auth.signOut());authUser="";state.user=null;showLogin();}catch(error){toast(friendly(error));}}
$("#exit-demo").addEventListener("click",exitSpace);$("#sign-out").addEventListener("click",exitSpace);
$("#login-form").addEventListener("submit",async event=>{event.preventDefault();if(!configReady)return;const form=event.target;$("#sign-in").disabled=true;$("#login-error").textContent="";try{const {session}=check(await state.client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value}));form.elements.password.value="";await applySession(session);}catch(error){$("#login-error").textContent=friendly(error);}finally{$("#sign-in").disabled=false;}});
$("#reset-password").addEventListener("click",async()=>{const email=$("#login-form").elements.email;if(!email.reportValidity())return;$("#reset-password").disabled=true;try{check(await state.client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+location.pathname}));toast("若该邮箱有可用账号，重设密码邮件会发送到邮箱。");}catch(error){$("#login-error").textContent=friendly(error);}finally{$("#reset-password").disabled=false;}});
async function applySession(session,event){if(state.demo)return;if(!session){if(authUser){authUser="";state.user=null;showLogin();}return;}if(authUser===session.user.id){if(event==="PASSWORD_RECOVERY")openPassword();return;}authUser=session.user.id;state.user=session.user;showWorkspace();try{await loadProjects();}catch(error){toast(friendly(error));}clearInterval(pollTimer);pollTimer=setInterval(()=>{if(!document.hidden&&!state.busy&&!state.demo)loadProjects().catch(()=>{});},20000);if(event==="PASSWORD_RECOVERY")openPassword();}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.user&&!state.demo)loadProjects().catch(()=>{});});
async function boot(){
  try{
    const response=await fetch(base+"assets/planner-config.json",{cache:"no-store"});if(!response.ok)throw new Error("config");const config=await response.json();
    if(!config.supabaseUrl || !config.publishableKey){$("#connection-note").textContent="团队空间尚未连接。可以先预览示例，接入成员登录后再开始真实项目。";return;}
    const url=new URL(config.supabaseUrl);if(url.protocol!=="https:"||!url.hostname.endsWith(".supabase.co"))throw new Error("项目地址配置无效，请使用 Supabase 项目提供的 HTTPS 地址。");
    if(config.publishableKey.startsWith("sb_secret_"))throw new Error("此处不能使用服务端密钥，请改为公开的 publishable key。");
    if(!config.publishableKey.startsWith("sb_publishable_")&&config.publishableKey.split(".").length!==3)throw new Error("请使用 Supabase 提供的 publishable 或 anon 客户端密钥。");
    if(config.publishableKey.split(".").length===3){let payload;try{payload=JSON.parse(atob(config.publishableKey.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));}catch{throw new Error("公开客户端密钥格式无效。");}if(payload.role!=="anon")throw new Error("此处只允许 anon 或 publishable key，不能使用服务端密钥。");}
    await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=base+"assets/vendor/supabase-2.118.0.js";script.onload=resolve;script.onerror=reject;document.head.append(script);});
    state.client=window.supabase.createClient(url.origin,config.publishableKey,{auth:{storageKey:"shaiol-workspace-auth",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});configReady=true;$("#sign-in").disabled=false;$("#reset-password").disabled=false;$("#connection-note").textContent="使用项目负责人为你开通的账号登录。登录后只能看到你已加入的项目。";
    state.client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>applySession(session,event).catch(error=>toast(friendly(error))),0);});
    const {session}=check(await state.client.auth.getSession());await applySession(session);
  }catch(error){$("#connection-note").textContent="团队空间暂时未连接，示例预览仍可使用。";$("#login-error").textContent=friendly(error);}
}
boot();
