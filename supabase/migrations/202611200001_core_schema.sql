-- ExplainQuest MVP schema. Apply in a new Supabase project using the SQL editor
-- or the Supabase CLI. The auth.users table is supplied by Supabase Auth.
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.users(id, display_name) values(new.id, null)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_explainquest on auth.users;
create trigger on_auth_user_created_explainquest
  after insert on auth.users for each row execute function public.create_user_profile();
-- In case this schema is added to a project with existing Auth users.
insert into public.users(id) select id from auth.users on conflict (id) do nothing;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);
create index if not exists subjects_user_idx on public.subjects(user_id, created_at desc);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id),
  constraint topics_subject_owner_fk foreign key (subject_id,user_id)
     references public.subjects (id,user_id) on delete cascade
);
create index if not exists topics_subject_idx on public.topics(subject_id, created_at desc);
create index if not exists topics_user_idx on public.topics(user_id, created_at desc);

create table if not exists public.reference_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic_id uuid not null unique,
  content text not null default '' check (char_length(content) <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_topic_owner_fk foreign key (topic_id,user_id)
     references public.topics (id,user_id) on delete cascade
);
create index if not exists reference_notes_user_idx on public.reference_notes(user_id);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic_id uuid not null,
  request_key uuid not null,
  request_payload jsonb not null,
  prior_attempt_id uuid,
  explanation_text text not null check (char_length(btrim(explanation_text)) between 1 and 10000),
  difficulty text not null check (difficulty in ('beginner','intermediate')),
  topic_title_snapshot text not null,
  reference_notes_snapshot text not null default '',
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attempts_topic_owner_fk foreign key (topic_id,user_id)
    references public.topics(id,user_id) on delete cascade,
  unique (id,user_id),
  unique (user_id,request_key),
  constraint attempts_prior_owner_fk foreign key (prior_attempt_id,user_id)
    references public.attempts(id,user_id) on delete set null (prior_attempt_id)
);
create index if not exists attempts_recent_idx on public.attempts(user_id,topic_id,created_at desc);
create index if not exists attempts_history_idx on public.attempts(user_id,created_at desc);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  attempt_id uuid not null unique,
  match_score integer not null check (match_score between 0 and 100),
  result jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  constraint evaluations_attempt_owner_fk foreign key (attempt_id,user_id)
    references public.attempts(id,user_id) on delete cascade
);
create index if not exists evaluations_user_idx on public.evaluations(user_id,created_at desc);

-- Per-user access to study data; service role bypasses RLS for atomic RPCs.
alter table public.users enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.reference_notes enable row level security;
alter table public.attempts enable row level security;
alter table public.evaluations enable row level security;

create policy "users select own" on public.users for select to authenticated using (id = (select auth.uid()));
create policy "users update own" on public.users for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "subjects own" on public.subjects for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "topics own" on public.topics for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notes own" on public.reference_notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "attempts own read" on public.attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "evaluations own read" on public.evaluations for select to authenticated using (user_id = (select auth.uid()));

-- Only the backend service role may reserve and finalize an AI attempt.
-- Uniqueness + ON CONFLICT DO NOTHING ensures parallel calls cannot both evaluate.
create or replace function public.reserve_attempt(p_user_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_topic uuid;
  v_request uuid;
  v_prior uuid;
  v_explanation text;
  v_difficulty text;
  v_title text;
  v_notes text;
  v_created_id uuid;
  v_existing public.attempts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  v_topic := (p_payload->>'topicId')::uuid;
  v_request := (p_payload->>'requestKey')::uuid;
  v_prior := nullif(p_payload->>'priorAttemptId','')::uuid;
  v_explanation := btrim(p_payload->>'explanation');
  v_difficulty := p_payload->>'difficulty';
  if v_topic is null or v_request is null or v_explanation is null
     or char_length(v_explanation) not between 1 and 10000
     or v_difficulty not in ('beginner','intermediate') then
    raise exception 'Invalid submission' using errcode='22023';
  end if;
  select t.title, coalesce(n.content,'') into v_title,v_notes
  from public.topics t left join public.reference_notes n on n.topic_id=t.id
  where t.id=v_topic and t.user_id=p_user_id;
  if not found then raise exception 'Topic not found' using errcode='23503'; end if;
  if v_prior is not null and not exists(
    select 1 from public.attempts a
    where a.id=v_prior and a.user_id=p_user_id and a.topic_id=v_topic
  ) then raise exception 'Prior attempt not found' using errcode='23503'; end if;
  insert into public.attempts (
    user_id,topic_id,request_key,request_payload,prior_attempt_id,
    explanation_text,difficulty,topic_title_snapshot,reference_notes_snapshot
  ) values (
    p_user_id,v_topic,v_request,p_payload,v_prior,
    v_explanation,v_difficulty,v_title,v_notes
  ) on conflict (user_id,request_key) do nothing returning id into v_created_id;
  if v_created_id is not null then
    return jsonb_build_object('created',true,'attempt',jsonb_build_object('id',v_created_id,'status','processing'));
  end if;
  select * into v_existing from public.attempts
  where user_id=p_user_id and request_key=v_request;
  if v_existing.id is null then
    raise exception 'Concurrent reservation not yet visible' using errcode='40001';
  end if;
  if v_existing.request_payload <> p_payload then
    raise exception 'Request key used with different input' using errcode='23505';
  end if;
  return jsonb_build_object('created',false,'attempt',jsonb_build_object('id',v_existing.id,'status',v_existing.status));
end;
$$;

create or replace function public.complete_attempt(p_attempt_id uuid,p_result jsonb,p_model text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;v_status text;v_score integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  v_score := (p_result->>'matchScore')::integer;
  if v_score is null or v_score not between 0 and 100 then
    raise exception 'Invalid evaluation score' using errcode='22023';
  end if;
  select user_id,status into v_user,v_status from public.attempts
    where id=p_attempt_id for update;
  if not found then raise exception 'Attempt not found' using errcode='23503'; end if;
  if v_status <> 'processing' then
    raise exception 'Attempt already finalized' using errcode='23505';
  end if;
  insert into public.evaluations(user_id,attempt_id,match_score,result,model)
    values(v_user,p_attempt_id,v_score,p_result,p_model);
  update public.attempts set status='completed',updated_at=now() where id=p_attempt_id;
end;
$$;
revoke all on function public.reserve_attempt(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.complete_attempt(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_attempt(uuid,jsonb) to service_role;
grant execute on function public.complete_attempt(uuid,jsonb,text) to service_role;

-- EXQ-31: latest evaluated score (advisory) OR no attempt in 5+ days.
-- SECURITY INVOKER ensures RLS applies; authenticated caller can only see own topics.
create or replace function public.get_review_queue()
returns table(topic_id uuid,topic_title text,subject_name text,
              last_attempt_at timestamptz,match_score integer,reason text)
language sql stable security invoker set search_path=public,pg_temp as $$
  select t.id, t.title, s.name, recent.created_at, scored.match_score,
    case when scored.match_score < 70 then 'unresolved_gap'
         else 'not_practiced_recently' end
  from public.topics t
  join public.subjects s on s.id=t.subject_id
  left join lateral (
    select a.created_at from public.attempts a
    where a.topic_id=t.id and a.user_id=t.user_id
    order by a.created_at desc limit 1
  ) recent on true
  left join lateral (
    select e.match_score from public.attempts a
    join public.evaluations e on e.attempt_id=a.id
    where a.topic_id=t.id and a.user_id=t.user_id
    order by a.created_at desc limit 1
  ) scored on true
  where t.user_id=(select auth.uid())
    and (scored.match_score < 70
         or coalesce(recent.created_at,t.created_at) <= now()-interval '5 days')
  order by (scored.match_score < 70) desc nulls last,
           coalesce(recent.created_at,t.created_at) asc,t.id;
$$;
revoke all on function public.get_review_queue() from public,anon;
grant execute on function public.get_review_queue() to authenticated;
