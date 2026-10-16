export const STATUSES = {todo:"待开始",doing:"进行中",review:"待验收",done:"已完成",blocked:"受阻"};
export const STREAMS = ["策划","程序","美术","音频","测试","其他"];
export const PRIORITIES = {high:"高",normal:"普通",low:"低"};
const DAY = 86400000;
export function todayInShanghai(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function dayNumber(date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return NaN;
  const n = Date.parse(`${date}T00:00:00Z`) / DAY;
  return Number.isFinite(n) && new Date(n*DAY).toISOString().slice(0,10) === date ? n : NaN;
}
export const dateFromDay = n=>new Date(n*DAY).toISOString().slice(0,10);
export const addDays = (date,n)=>dateFromDay(dayNumber(date)+n);
export const shortDate = date=>date ? date.slice(5).replace("-","/") : "未排期";
export const safeLink = value=>{try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:"";}catch{return "";}};
export function taskBlockers(task,tasks) {
  const active = new Map(tasks.filter(t=>!t.archived).map(t=>[t.id,t]));
  return (task.dependencies || []).map(id=>active.get(id)).filter(t=>t && t.status!=="done");
}
export const isOverdue = (task,today=todayInShanghai())=>!task.archived && task.status!=="done" && !!task.ends && task.ends<today;
export function summary(tasks,today=todayInShanghai()) {
  const active=tasks.filter(t=>!t.archived),work=active.filter(t=>t.kind!=="milestone");
  const weight=work.reduce((n,t)=>n+Number(t.effort),0);
  return {total:work.length,done:work.filter(t=>t.status==="done").length,progress:weight?Math.round(work.reduce((n,t)=>n+Number(t.effort)*Number(t.progress),0)/weight):0,
    overdue:active.filter(t=>isOverdue(t,today)).length,blocked:active.filter(t=>t.status!=="done" && (t.status==="blocked" || taskBlockers(t,active).length)).length,
    milestones:active.filter(t=>t.kind==="milestone"),weight};
}
export function validateTask(task,tasks,phases,members=[]) {
  if(!task.name?.trim()) return "请填写任务名称。";
  if(task.name.length>160) return "任务名称不能超过 160 字。";
  if(!phases.includes(task.phase)) return "请选择项目内的阶段。";
  if(!Object.hasOwn(STATUSES,task.status) || !Object.hasOwn(PRIORITIES,task.priority)) return "任务状态或优先级无效。";
  if(!["task","milestone"].includes(task.kind)) return "任务类型无效。";
  if(!Number.isFinite(task.effort) || task.effort<=0 || task.effort>1000) return "工作量应大于 0，且不超过 1000。";
  if(!Number.isInteger(task.progress) || task.progress<0 || task.progress>100) return "进度应为 0—100 的整数。";
  if(task.status==="done" && task.progress!==100) return "已完成任务的进度应为 100%。";
  if(task.status==="todo" && task.progress!==0) return "待开始任务的进度应为 0%。";
  if(Boolean(task.starts)!==Boolean(task.ends)) return "开始和结束日期请一起填写，也可以都不填。";
  if(task.starts && (!Number.isFinite(dayNumber(task.starts)) || !Number.isFinite(dayNumber(task.ends)))) return "日期无效。";
  if(task.starts && task.starts>task.ends) return "结束日期不能早于开始日期。";
  if(task.kind==="milestone" && task.starts!==task.ends) return "里程碑的开始和结束日期应为同一天。";
  if(task.assignee_id && !members.some(m=>m.user_id===task.assignee_id)) return "负责人必须是当前项目成员。";
  if(task.link && !safeLink(task.link)) return "成果链接只支持 http 或 https。";
  if((task.notes || "").length>10000 || (task.link || "").length>2000) return "说明或链接过长。";
  const map=new Map(tasks.map(t=>[t.id,t]));map.set(task.id,task);
  if(!Array.isArray(task.dependencies) || new Set(task.dependencies).size!==task.dependencies.length) return "前置任务重复或无效。";
  for(const id of task.dependencies) {
    if(id===task.id) return "任务不能依赖自己。";
    if(!map.has(id) || map.get(id).archived) return "前置任务不存在或已归档。";
    const seen=new Set(),stack=[id];
    while(stack.length) {const current=stack.pop();if(current===task.id)return "这些前置关系会形成循环，请调整。";if(seen.has(current))continue;seen.add(current);stack.push(...(map.get(current)?.dependencies || []));}
  }
  if(task.archived && tasks.some(t=>!t.archived && t.id!==task.id && (t.dependencies || []).includes(task.id))) return "其他任务仍依赖此任务，请先调整它们的前置关系，再归档。";
  return "";
}
export function filterTasks(tasks,filters) {
  return tasks.filter(t=>Boolean(t.archived)===Boolean(filters.archived) && (!filters.phase || t.phase===filters.phase) && (!filters.status || t.status===filters.status)
    && (!filters.person || (filters.person==="unassigned"?!t.assignee_id:t.assignee_id===filters.person))
    && (!filters.query || `${t.name} ${t.notes || ""}`.toLowerCase().includes(filters.query.trim().toLowerCase())));
}
export function timeline(tasks,today=todayInShanghai()) {
  const dates=tasks.flatMap(t=>t.starts&&t.ends?[dayNumber(t.starts),dayNumber(t.ends)]:[]).filter(Number.isFinite);
  const origin=dayNumber(today),start=dates.length?Math.min(...dates)-2:origin-3,end=dates.length?Math.max(...dates)+3:origin+24;
  return {start,end:Math.max(end,start+27),days:Math.max(28,end-start+1)};
}
export function demoProject(today=todayInShanghai()) {
  const members=[{user_id:"demo-design",display_name:"策划示例",role:"owner"},{user_id:"demo-code",display_name:"程序示例",role:"member"},{user_id:"demo-art",display_name:"美术示例",role:"member"}];
  const phases=["方案设计","内容制作","联调验收"];
  const make=(id,name,phase,who,status,progress,start,end,effort,more={})=>({id,name,phase,assignee_id:who,status,progress,starts:addDays(today,start),ends:addDays(today,end),effort,kind:"task",workstream:"策划",priority:"normal",dependencies:[],notes:"这是一条虚构示例任务，仅用于体验工作台。",link:"",archived:false,version:1,...more});
  return {project:{id:"demo",name:"千禧频道 · 演示项目",phases,version:1},members,tasks:[
    make("demo-1","交互方案确认",phases[0],members[0].user_id,"done",100,-7,-4,2),
    make("demo-2","角色立绘草图",phases[1],members[2].user_id,"doing",55,-4,5,5,{workstream:"美术",priority:"high",dependencies:["demo-1"]}),
    make("demo-3","调制界面联调",phases[2],members[1].user_id,"doing",40,-2,4,3,{workstream:"程序",dependencies:["demo-1"]}),
    make("demo-4","交互音效整理",phases[1],null,"todo",0,2,7,2,{workstream:"音频"}),
    make("demo-5","演示版本验收",phases[2],members[0].user_id,"todo",0,9,9,1,{kind:"milestone",dependencies:["demo-2","demo-3","demo-4"]})]};
}
