-- Run AFTER the migration, in Supabase SQL Editor.
select table_name from information_schema.tables
where table_schema='public' and table_name in
('users','subjects','topics','reference_notes','attempts','evaluations')
order by table_name;

select table_name,column_name,data_type,column_default
from information_schema.columns
where table_schema='public' and table_name in
('users','subjects','topics','reference_notes','attempts','evaluations')
  and column_name in ('id','created_at','updated_at')
order by table_name,column_name;

select conrelid::regclass::text as table_name, conname,
       pg_get_constraintdef(oid) as constraint_definition
from pg_constraint where connamespace='public'::regnamespace
  and conrelid in ('public.users'::regclass,'public.subjects'::regclass,'public.topics'::regclass,
                  'public.reference_notes'::regclass,'public.attempts'::regclass,'public.evaluations'::regclass)
order by table_name,conname;

select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in
('users','subjects','topics','reference_notes','attempts','evaluations')
order by tablename,indexname;

-- WARNING: Query timing in SQL Editor as a privileged role is not equivalent to
-- a real authenticated student's RLS query. Use real staging accounts for that test.
