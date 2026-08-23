-- Study Order — banco Supabase
-- Execute no SQL Editor do seu projeto.

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  content text default '',
  updated_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  url text not null,
  created_at timestamptz default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  mime_type text,
  data_base64 text,
  created_at timestamptz default now()
);

alter table public.subjects enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.links enable row level security;
alter table public.files enable row level security;

create policy "subjects own" on public.subjects for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "notes own" on public.notes for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "tasks own" on public.tasks for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "links own" on public.links for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "files own" on public.files for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Opcional: confirmação de e-mail pode ser desativada no painel Authentication
-- enquanto estiver testando o projeto.
