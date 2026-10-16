-- Shaiol Workspace: initial schema. Run once in a dedicated Supabase project.
-- No member emails, project records or credentials are included here.
begin;
create table if not exists public.planner_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  phases text[] not null check (cardinality(phases) between 1 and 20),
  version integer not null default 1,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.planner_members (
  project_id uuid not null references public.planner_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  role text not null default 'member' check (role in ('owner','member')),
  primary key (project_id,user_id)
);
create table if not exists public.planner_tasks (
  id uuid primary key,
  project_id uuid not null references public.planner_projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  phase text not null,
  assignee_id uuid,
  workstream text not null default '其他' check (length(workstream) <= 40),
  priority text not null default 'normal' check (priority in ('high','normal','low')),
  status text not null default 'todo' check (status in ('todo','doing','review','done','blocked')),
  progress integer not null default 0 check (progress between 0 and 100),
  starts date,
  ends date,
  effort numeric not null default 1 check (effort > 0 and effort <= 1000),
  kind text not null default 'task' check (kind in ('task','milestone')),
  dependencies uuid[] not null default '{}',
  notes text not null default '' check (length(notes) <= 10000),
  link text not null default '' check (length(link) <= 2000 and (link = '' or link ~ '^https?://')),
  archived boolean not null default false,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  foreign key (project_id,assignee_id) references public.planner_members(project_id,user_id),
  check ((starts is null and ends is null) or (starts is not null and ends is not null and starts <= ends)),
  check (kind <> 'milestone' or starts is not distinct from ends),
  check (status <> 'done' or progress = 100),
  check (status <> 'todo' or progress = 0),
  check (cardinality(dependencies) <= 100)
);
create index if not exists planner_tasks_project on public.planner_tasks(project_id);
create index if not exists planner_members_user on public.planner_members(user_id);

alter table public.planner_projects enable row level security;
alter table public.planner_members enable row level security;
alter table public.planner_tasks enable row level security;

create or replace function public.planner_is_member(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.planner_members where project_id = p_project_id and user_id = auth.uid());
$$;
create or replace function public.planner_is_owner(p_project_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.planner_members where project_id = p_project_id and user_id = auth.uid() and role = 'owner');
$$;
drop policy if exists planner_projects_read on public.planner_projects;
create policy planner_projects_read on public.planner_projects for select to authenticated using (public.planner_is_member(id));
drop policy if exists planner_members_read on public.planner_members;
create policy planner_members_read on public.planner_members for select to authenticated using (public.planner_is_member(project_id));
drop policy if exists planner_tasks_read on public.planner_tasks;
create policy planner_tasks_read on public.planner_tasks for select to authenticated using (public.planner_is_member(project_id));

-- Writes only pass through the bounded RPCs below; table access cannot bypass
-- membership, conflict detection, dependency checks or server timestamps.
revoke all on public.planner_projects, public.planner_members, public.planner_tasks from anon, authenticated;
grant select on public.planner_projects, public.planner_members, public.planner_tasks to authenticated;

create or replace function public.planner_create_project(p_name text, p_phases text[], p_display_name text default '项目负责人')
returns public.planner_projects language plpgsql security definer set search_path = '' as $$
declare v_project public.planner_projects;
begin
  if auth.uid() is null then raise exception '请先登录。' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_phases) phase where length(btrim(phase)) not between 1 and 40)
     or cardinality(p_phases) <> (select count(distinct phase) from unnest(p_phases) phase)
  then raise exception '阶段名称无效或重复。'; end if;
  insert into public.planner_projects(name,phases,created_by) values (btrim(p_name),p_phases,auth.uid()) returning * into v_project;
  insert into public.planner_members(project_id,user_id,display_name,role) values (v_project.id,auth.uid(),btrim(p_display_name),'owner');
  return v_project;
end; $$;

create or replace function public.planner_update_project(p_id uuid, p_name text, p_phases text[], p_expected_version integer)
returns public.planner_projects language plpgsql security definer set search_path = '' as $$
declare v_project public.planner_projects;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  if not public.planner_is_owner(p_id) then raise exception '只有项目负责人可以修改阶段。' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_phases) phase where length(btrim(phase)) not between 1 and 40)
     or cardinality(p_phases) <> (select count(distinct phase) from unnest(p_phases) phase)
  then raise exception '阶段名称无效或重复。'; end if;
  if exists (select 1 from public.planner_tasks where project_id=p_id and not archived and not (phase = any(p_phases)))
  then raise exception '要移除的阶段中仍有任务，请先调整任务阶段。'; end if;
  update public.planner_projects set name=btrim(p_name),phases=p_phases,version=version+1 where id=p_id and version=p_expected_version returning * into v_project;
  if not found then raise exception 'CONFLICT: 项目已被更新，请刷新后重试。'; end if;
  return v_project;
end; $$;

create or replace function public.planner_add_member(p_project_id uuid,p_email text,p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
  if not public.planner_is_owner(p_project_id) then raise exception '只有项目负责人可以加入成员。' using errcode = '42501'; end if;
  select id into v_user from auth.users where lower(email)=lower(btrim(p_email));
  if not found then raise exception '请先在账号后台创建此成员账号，再加入项目。'; end if;
  insert into public.planner_members(project_id,user_id,display_name,role) values (p_project_id,v_user,btrim(p_display_name),'member')
    on conflict (project_id,user_id) do update set display_name=excluded.display_name;
end; $$;

create or replace function public.planner_save_task(p_project_id uuid,p_task jsonb,p_expected_version integer)
returns public.planner_tasks language plpgsql security definer set search_path = '' as $$
declare v_task public.planner_tasks; v_existing public.planner_tasks; v_result public.planner_tasks; v_phases text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
  if not public.planner_is_member(p_project_id) then raise exception '你没有此项目的编辑权限。' using errcode = '42501'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'CONFLICT: 缺少有效的任务版本，请刷新后重试。'; end if;
  select * into v_task from jsonb_populate_record(null::public.planner_tasks,p_task);
  v_task.project_id:=p_project_id;
  v_task.name:=btrim(v_task.name);
  v_task.dependencies:=coalesce(v_task.dependencies,'{}');
  select phases into v_phases from public.planner_projects where id=p_project_id;
  if not (v_task.phase = any(v_phases)) then raise exception '请选择项目内的阶段。'; end if;
  if v_task.id = any(v_task.dependencies) then raise exception '任务不能依赖自己。'; end if;
  if cardinality(v_task.dependencies) <> (select count(distinct dep) from unnest(v_task.dependencies) dep)
    then raise exception '前置任务不能重复。'; end if;
  if exists (select 1 from unnest(v_task.dependencies) dep where not exists (
    select 1 from public.planner_tasks t where t.id=dep and t.project_id=p_project_id and not t.archived))
    then raise exception '前置任务不存在、已归档或属于其他项目。'; end if;
  if exists (
    with recursive reachable(id) as (
      select unnest(v_task.dependencies)
      union
      select unnest(t.dependencies) from public.planner_tasks t join reachable r on r.id=t.id where t.project_id=p_project_id
    ) select 1 from reachable where id=v_task.id
  ) then raise exception '前置关系不能形成循环。'; end if;
  if v_task.archived and exists (select 1 from public.planner_tasks where project_id=p_project_id and not archived and id<>v_task.id and v_task.id=any(dependencies))
    then raise exception '其他任务仍依赖此任务，请先调整前置关系，再归档。'; end if;
  select * into v_existing from public.planner_tasks where id=v_task.id;
  if found then
    if v_existing.project_id<>p_project_id or v_existing.version<>p_expected_version then raise exception 'CONFLICT: 任务已被其他成员更新，请关闭详情并刷新后重试。'; end if;
    update public.planner_tasks set name=v_task.name,phase=v_task.phase,assignee_id=v_task.assignee_id,
      workstream=v_task.workstream,priority=v_task.priority,status=v_task.status,progress=v_task.progress,
      starts=v_task.starts,ends=v_task.ends,effort=v_task.effort,kind=v_task.kind,dependencies=v_task.dependencies,
      notes=v_task.notes,link=v_task.link,archived=v_task.archived,version=version+1,updated_at=now(),updated_by=auth.uid()
      where id=v_task.id returning * into v_result;
  else
    if p_expected_version<>0 then raise exception 'CONFLICT: 任务不存在，请刷新后重试。'; end if;
    insert into public.planner_tasks(id,project_id,name,phase,assignee_id,workstream,priority,status,progress,starts,ends,effort,kind,dependencies,notes,link,archived,updated_by)
      values(v_task.id,p_project_id,v_task.name,v_task.phase,v_task.assignee_id,v_task.workstream,v_task.priority,v_task.status,v_task.progress,v_task.starts,v_task.ends,v_task.effort,v_task.kind,v_task.dependencies,v_task.notes,v_task.link,v_task.archived,auth.uid()) returning * into v_result;
  end if;
  return v_result;
end; $$;

create or replace function public.planner_remove_member(p_project_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
  if not public.planner_is_owner(p_project_id) then raise exception '只有项目负责人可以移出成员。' using errcode = '42501'; end if;
  if exists(select 1 from public.planner_members where project_id=p_project_id and user_id=p_user_id and role='owner')
    then raise exception '不能移出项目负责人。'; end if;
  update public.planner_tasks set assignee_id=null,version=version+1,updated_at=now(),updated_by=auth.uid()
    where project_id=p_project_id and assignee_id=p_user_id;
  delete from public.planner_members where project_id=p_project_id and user_id=p_user_id;
end; $$;

revoke all on function public.planner_is_member(uuid),public.planner_is_owner(uuid),public.planner_create_project(text,text[],text),public.planner_update_project(uuid,text,text[],integer),public.planner_add_member(uuid,text,text),public.planner_save_task(uuid,jsonb,integer),public.planner_remove_member(uuid,uuid) from public,anon;
grant execute on function public.planner_is_member(uuid),public.planner_is_owner(uuid),public.planner_create_project(text,text[],text),public.planner_update_project(uuid,text,text[],integer),public.planner_add_member(uuid,text,text),public.planner_save_task(uuid,jsonb,integer),public.planner_remove_member(uuid,uuid) to authenticated;
commit;
