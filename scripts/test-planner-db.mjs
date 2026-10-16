// Optional local PostgreSQL/RLS checks. Pass an installed PGlite dist/index.js
// path, or install @electric-sql/pglite in the local test environment.
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {readFile} from "node:fs/promises";
import assert from "node:assert/strict";
const {PGlite}=await import(process.argv[2]?pathToFileURL(resolve(process.argv[2])).href:"@electric-sql/pglite");
const db=new PGlite();
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL("../supabase/schema.sql",import.meta.url),"utf8"));
  const owner="00000000-0000-4000-8000-000000000001",member="00000000-0000-4000-8000-000000000002",outsider="00000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users values($1,'owner@example.test'),($2,'member@example.test'),($3,'outsider@example.test')",[owner,member,outsider]);
  async function asUser(id){await db.exec("reset role;set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
  await asUser(owner);
  const project=(await db.query("select * from public.planner_create_project('Test',array['Design','Build'],'Owner')")).rows[0];
  const second=(await db.query("select * from public.planner_create_project('Private B',array['Design'],'Owner')")).rows[0];
  await db.query("select public.planner_add_member($1,'member@example.test','Member')",[project.id]);
  const task={id:"00000000-0000-4000-8000-000000000010",name:"Task A",phase:"Design",assignee_id:member,workstream:"程序",priority:"normal",status:"doing",progress:30,starts:"2026-10-16",ends:"2026-10-20",effort:3,kind:"task",dependencies:[],notes:"",link:"",archived:false};
  const save=(t,version,projectId=project.id)=>db.query("select * from public.planner_save_task($1,$2::jsonb,$3)",[projectId,JSON.stringify(t),version]);
  await save(task,0);
  const foreign={...task,id:"00000000-0000-4000-8000-000000000012",assignee_id:null,name:"Other project"};
  await save(foreign,0,second.id);
  await asUser(member);
  assert.equal((await db.query("select * from public.planner_projects")).rows.length,1,"Members cannot read other projects");
  assert.equal((await db.query("select * from public.planner_tasks")).rows.length,1);
  await save({...task,progress:40},1);
  await assert.rejects(save({...task,progress:50},1),/CONFLICT/);
  await assert.rejects(save({...task,progress:60},null),/CONFLICT/);
  await assert.rejects(db.query("update public.planner_tasks set progress=99"),/permission denied/);
  await assert.rejects(db.query("select public.planner_add_member($1,'outsider@example.test','Other')",[project.id]),/负责人/);
  await assert.rejects(db.query("select public.planner_update_project($1,'changed',array['Design'],1)",[project.id]),/负责人/);
  await assert.rejects(save({...task,dependencies:[foreign.id]},2),/其他项目/);
  await assert.rejects(save({...task,assignee_id:outsider},2),/foreign key/);
  const taskB={...task,id:"00000000-0000-4000-8000-000000000011",name:"Task B",dependencies:[task.id]};
  await save(taskB,0);
  await assert.rejects(save({...task,dependencies:[taskB.id]},2),/循环/);
  await assert.rejects(save({...task,archived:true},2),/依赖/);
  await asUser(outsider);
  for(const table of ["planner_projects","planner_members","planner_tasks"])assert.equal((await db.query(`select * from public.${table}`)).rows.length,0,`Nonmember cannot read ${table}`);
  await assert.rejects(save({...task,progress:90},2),/权限/);
  await asUser(owner);
  await assert.rejects(db.query("select public.planner_remove_member($1,$2)",[project.id,owner]),/负责人/);
  await db.query("select public.planner_remove_member($1,$2)",[project.id,member]);
  assert.equal((await db.query("select assignee_id from public.planner_tasks where id=$1",[task.id])).rows[0].assignee_id,null);
  await asUser(member);
  assert.equal((await db.query("select * from public.planner_tasks")).rows.length,0,"Revoked membership immediately loses read access");
  await assert.rejects(save({...task,progress:90},3),/权限/);
  await db.exec("reset role;set role anon");
  await assert.rejects(db.query("select * from public.planner_tasks"),/permission denied/);
  await assert.rejects(save(task,0),/permission denied/);
  console.log("Planner database: membership, owner roles, anonymous denial, revocation, cross-project isolation, conflicts and dependency checks passed.");
} finally {await db.close();}
