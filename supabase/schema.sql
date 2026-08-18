-- =============================================================
-- ABBEL 云端数据库底座 v1 —— Schema + RLS（Clerk 作为身份源）
-- 运行位置：Supabase → SQL Editor，整段执行
-- =============================================================

-- 0. 从 Clerk JWT 的 sub 声明解析当前用户 ID（文本，非 UUID）
--    等价于 auth.jwt() ->> 'sub'，但用 current_setting 更贴合官方 Clerk 集成写法
create or replace function public.requesting_user_id()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::text;
$$;

-- =============================================================
-- 1. users：账户与档案（配额仍留 Redis，此处只存 plan）
-- =============================================================
create table public.users (
  id           text primary key,            -- Clerk user ID（user_xxx，非 UUID）
  email        text,
  display_name text,
  plan         text not null default 'free',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================
-- 2. templates：用户记忆槽 / 专属调音模板
-- =============================================================
create table public.templates (
  id          bigint generated always as identity primary key,
  user_id     text not null default public.requesting_user_id() references public.users(id) on delete cascade,
  name        text not null,
  scores      jsonb not null,               -- 10 维调音参数
  created_at  timestamptz not null default now()
);

create index templates_user_created_idx
  on public.templates (user_id, created_at desc);

-- =============================================================
-- 3. generations：历史生成资产
-- =============================================================
create table public.generations (
  id           bigint generated always as identity primary key,
  user_id      text not null default public.requesting_user_id() references public.users(id) on delete cascade,
  input_text   text,
  output_draft text,
  scores       jsonb,                       -- 生成时的 10 维参数快照
  template_id  bigint references public.templates(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index generations_user_created_idx
  on public.generations (user_id, created_at desc);

-- =============================================================
-- 4. 开启 RLS
-- =============================================================
alter table public.users       enable row level security;
alter table public.templates   enable row level security;
alter table public.generations enable row level security;

-- =============================================================
-- 5. 强隔离策略
--    users：只能「读」自己那行，写操作仅 service_role（杜绝自改 plan 提权）
-- =============================================================
create policy "users_select_self" on public.users
  for select to authenticated
  using (id = public.requesting_user_id());

create policy "templates_all_self" on public.templates
  for all to authenticated
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

create policy "generations_all_self" on public.generations
  for all to authenticated
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

-- =============================================================
-- 6. 触发器补行：插入模板/历史前，若 users 无此行则自动补（幂等）
--    security definer 以函数 owner 身份执行，绕过 users 的 RLS
-- =============================================================
create function public.ensure_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.user_id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_templates_ensure_user
  before insert on public.templates
  for each row execute function public.ensure_user();

create trigger trg_generations_ensure_user
  before insert on public.generations
  for each row execute function public.ensure_user();

-- =============================================================
-- 7. 显式授权（Supabase 默认已授权，此处仅作保险，真正闸门是 RLS）
-- =============================================================
grant select on public.users to authenticated;
grant select, insert, update, delete on public.templates to authenticated;
grant select, insert, update, delete on public.generations to authenticated;
grant execute on function public.requesting_user_id() to authenticated, anon;

-- =============================================================
-- 8. 档案同步：前端调用，只允许更新 email/display_name（无法改 plan）
-- =============================================================
create or replace function public.sync_my_profile(p_email text, p_display_name text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.users (id, email, display_name)
  values (public.requesting_user_id(), p_email, p_display_name)
  on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        updated_at = now();
$$;

grant execute on function public.sync_my_profile(text, text) to authenticated;
