-- ============================================================
-- STUDY ORDER — SCHEMA DO BANCO (REFERÊNCIA PARA O REPOSITÓRIO)
-- Este arquivo documenta o banco. A execução acontece no SQL Editor do Supabase.
-- ATENÇÃO: este script APAGA todas as policies antigas das tabelas
-- abaixo e recria só as seguras. Faça backup se tiver dados críticos.
-- ============================================================

-- ------------------------------------------------------------
-- 1) TABELAS
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'user',
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.subject_contents (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null default 'link',
  url text,
  content text,
  created_at timestamptz default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text default '',
  media_url text,
  media_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (follower_id <> following_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text,
  content text,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Se já existir um group_members antigo ligado a outra tabela (ex.: study_groups),
-- ele é recriado apontando para public.groups. Se já estiver certo, nada é apagado.
do $$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.group_members'::regclass
      and c.contype = 'f'
      and c.confrelid <> 'public.groups'::regclass
      and c.conkey = array[(select a.attnum from pg_attribute a
                            where a.attrelid = c.conrelid and a.attname = 'group_id')]
  ) then
    drop table public.group_members cascade;
  end if;
exception when undefined_table then null;
end $$;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text default '',
  media_url text,
  media_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.global_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  type text not null default 'info',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Ajustes para bancos que já existiam com o schema antigo
alter table public.subjects add column if not exists notes text default '';
alter table public.tasks add column if not exists completed boolean default false;
alter table public.tasks alter column subject_id drop not null;       -- tarefas globais usam subject_id = null
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists is_pro boolean not null default false;
alter table public.posts add column if not exists media_type text;
alter table public.group_messages add column if not exists media_url text;
alter table public.group_messages add column if not exists media_type text;

-- Índices e unicidade
create unique index if not exists followers_unique on public.followers (follower_id, following_id);
create unique index if not exists contact_pair_unique on public.contact_requests
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id));
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists post_comments_post_idx on public.post_comments (post_id);
create index if not exists dm_pair_idx on public.direct_messages (sender_id, receiver_id, created_at);
create index if not exists group_messages_idx on public.group_messages (group_id, created_at);
create index if not exists tasks_user_idx on public.tasks (user_id, due_date);

-- Perfis para usuários antigos que ainda não tenham linha em profiles
insert into public.profiles (id, username)
select u.id,
       left(lower(regexp_replace(split_part(u.email,'@',1), '[^a-zA-Z0-9._]', '', 'g')), 24)
         || substr(replace(u.id::text,'-',''), 1, 4)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ------------------------------------------------------------
-- 2) FUNÇÕES AUXILIARES (security definer evita recursão de RLS)
-- ------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.are_contacts(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contact_requests
    where status = 'accepted'
      and ((sender_id = a and receiver_id = b) or (sender_id = b and receiver_id = a))
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.are_contacts(uuid, uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.are_contacts(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 3) TRIGGERS
-- ------------------------------------------------------------
-- 3.1 Cria o perfil automaticamente no cadastro (funciona mesmo com confirmação de e-mail)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; final text;
begin
  base := lower(regexp_replace(
            coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
            '[^a-zA-Z0-9._]', '', 'g'));
  if length(base) < 3 then
    base := 'user' || substr(replace(new.id::text,'-',''), 1, 6);
  end if;
  base := left(base, 30);
  final := base;
  while exists (select 1 from public.profiles where username = final) loop
    final := left(base, 25) || floor(random() * 9999)::int;
  end loop;
  insert into public.profiles (id, username) values (new.id, final) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3.2 Ninguém (exceto admin) altera o próprio cargo ou plano PRO
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.is_pro is distinct from old.is_pro then
      raise exception 'Sem permissão para alterar cargo ou plano.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- 3.3 Convites: remetente e destinatário nunca mudam depois de criados
create or replace function public.lock_contact_ids() returns trigger
language plpgsql as $$
begin
  if new.sender_id <> old.sender_id or new.receiver_id <> old.receiver_id then
    raise exception 'Não é permitido alterar as partes do convite.';
  end if;
  return new;
end $$;

drop trigger if exists lock_contact_ids on public.contact_requests;
create trigger lock_contact_ids before update on public.contact_requests
  for each row execute function public.lock_contact_ids();

-- 3.4 Quem cria o grupo entra automaticamente como membro
create or replace function public.add_group_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.user_id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists add_group_creator on public.groups;
create trigger add_group_creator after insert on public.groups
  for each row execute function public.add_group_creator();

-- Mantém no grupo quem já criou ou já escreveu nele (dados antigos)
insert into public.group_members (group_id, user_id)
  select id, user_id from public.groups on conflict do nothing;
insert into public.group_members (group_id, user_id)
  select distinct group_id, user_id from public.group_messages on conflict do nothing;

-- ------------------------------------------------------------
-- 4) RLS: ativa e remove TODAS as policies antigas
-- ------------------------------------------------------------
do $$
declare t text; p record;
begin
  foreach t in array array[
    'profiles','subjects','tasks','subject_contents','posts','post_comments','followers',
    'notifications','contact_requests','direct_messages','groups','group_members',
    'group_messages','global_announcements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5) POLICIES
-- ------------------------------------------------------------
-- profiles (não há INSERT: o perfil é criado pelo trigger)
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- dados pessoais do estudante
create policy subjects_own on public.subjects for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy tasks_own on public.tasks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (subject_id is null or exists (
    select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid())));

create policy contents_own on public.subject_contents for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.subjects s where s.id = subject_id and s.user_id = auth.uid()));

-- feed
create policy posts_select on public.posts for select to authenticated using (true);
create policy posts_insert on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy posts_update on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy comments_select on public.post_comments for select to authenticated using (true);
create policy comments_insert on public.post_comments for insert to authenticated with check (user_id = auth.uid());
create policy comments_delete on public.post_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- seguidores e notificações
create policy followers_select on public.followers for select to authenticated using (true);
create policy followers_insert on public.followers for insert to authenticated with check (follower_id = auth.uid());
create policy followers_delete on public.followers for delete to authenticated using (follower_id = auth.uid());

create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_insert on public.notifications for insert to authenticated with check (actor_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- convites de contacto (opt-in): só o destinatário aceita/recusa
create policy req_select on public.contact_requests for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy req_insert on public.contact_requests for insert to authenticated
  with check (sender_id = auth.uid() and receiver_id <> auth.uid() and status = 'pending');
create policy req_update on public.contact_requests for update to authenticated
  using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
create policy req_delete on public.contact_requests for delete to authenticated
  using ((sender_id = auth.uid() or receiver_id = auth.uid()) and status in ('pending','rejected'));

-- mensagens privadas: só entre contactos aceitos
create policy dm_select on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.are_contacts(sender_id, receiver_id));

-- grupos: lista pública, conversa só para membros
create policy groups_select on public.groups for select to authenticated using (true);
create policy groups_insert on public.groups for insert to authenticated with check (user_id = auth.uid());
create policy groups_update on public.groups for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy groups_delete on public.groups for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy gm_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));
create policy gm_insert on public.group_members for insert to authenticated with check (user_id = auth.uid());
create policy gm_delete on public.group_members for delete to authenticated using (user_id = auth.uid());

create policy gmsg_select on public.group_messages for select to authenticated
  using (public.is_group_member(group_id));
create policy gmsg_insert on public.group_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_group_member(group_id));
create policy gmsg_delete on public.group_messages for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- banners globais: todos leem, só admin escreve
create policy ann_select on public.global_announcements for select to authenticated using (true);
create policy ann_insert on public.global_announcements for insert to authenticated with check (public.is_admin());
create policy ann_update on public.global_announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ann_delete on public.global_announcements for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- 6) REALTIME
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'posts','tasks','subject_contents','group_messages','direct_messages',
    'contact_requests','notifications','global_announcements'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

alter table public.tasks replica identity full;
alter table public.subject_contents replica identity full;
alter table public.contact_requests replica identity full;

-- ------------------------------------------------------------
-- 7) STORAGE (bucket "imagens")
-- Cada usuário só envia/apaga dentro da própria pasta: <user_id>/...
-- Limite de 20 MB e tipos de ficheiro permitidos.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 20971520, array[
  'image/jpeg','image/png','image/gif','image/webp','image/avif',
  'video/mp4','video/webm','application/pdf','text/plain','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists so_upload_own on storage.objects;
drop policy if exists so_delete_own on storage.objects;

create policy so_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy so_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);

-- Confira em Storage > Policies se sobrou alguma policy antiga permissiva no bucket "imagens".

-- Para definir um administrador, rode manualmente no SQL Editor do Supabase:
--   update public.profiles set role = 'admin' where username = '<usuario>';
