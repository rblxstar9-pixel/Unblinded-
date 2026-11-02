-- UNBLINDED community + social foundation
-- Safe additive migration: does not drop or replace existing tables.
create extension if not exists pgcrypto;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_created_idx on public.social_posts(created_at desc);
create index if not exists social_posts_author_idx on public.social_posts(author_id,created_at desc);

create table if not exists public.social_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like','love','support','insightful')),
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);
create index if not exists social_reactions_post_idx on public.social_post_reactions(post_id);

create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists social_comments_post_idx on public.social_post_comments(post_id,created_at);

create table if not exists public.community_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  slug text not null unique,
  description text not null default '' check (char_length(description) <= 240),
  visibility text not null default 'public' check (visibility in ('public','private')),
  created_at timestamptz not null default now()
);
create index if not exists community_spaces_created_idx on public.community_spaces(created_at desc);

create table if not exists public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.community_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','moderator','member')),
  joined_at timestamptz not null default now(),
  unique(community_id,user_id)
);
create index if not exists community_members_user_idx on public.community_members(user_id);
create index if not exists community_members_space_idx on public.community_members(community_id);

alter table public.social_posts enable row level security;
alter table public.social_post_reactions enable row level security;
alter table public.social_post_comments enable row level security;
alter table public.community_spaces enable row level security;
alter table public.community_members enable row level security;

drop policy if exists "Public posts are readable" on public.social_posts;
create policy "Public posts are readable" on public.social_posts for select to authenticated using (visibility='public' or author_id=auth.uid());
drop policy if exists "Members create own posts" on public.social_posts;
create policy "Members create own posts" on public.social_posts for insert to authenticated with check (author_id=auth.uid());
drop policy if exists "Authors update own posts" on public.social_posts;
create policy "Authors update own posts" on public.social_posts for update to authenticated using (author_id=auth.uid()) with check (author_id=auth.uid());
drop policy if exists "Authors delete own posts" on public.social_posts;
create policy "Authors delete own posts" on public.social_posts for delete to authenticated using (author_id=auth.uid());

drop policy if exists "Reactions readable" on public.social_post_reactions;
create policy "Reactions readable" on public.social_post_reactions for select to authenticated using (true);
drop policy if exists "Users manage own reactions" on public.social_post_reactions;
create policy "Users manage own reactions" on public.social_post_reactions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "Comments readable" on public.social_post_comments;
create policy "Comments readable" on public.social_post_comments for select to authenticated using (true);
drop policy if exists "Users create own comments" on public.social_post_comments;
create policy "Users create own comments" on public.social_post_comments for insert to authenticated with check (author_id=auth.uid());
drop policy if exists "Authors delete own comments" on public.social_post_comments;
create policy "Authors delete own comments" on public.social_post_comments for delete to authenticated using (author_id=auth.uid());

drop policy if exists "Public communities readable" on public.community_spaces;
create policy "Public communities readable" on public.community_spaces for select to authenticated using (visibility='public' or owner_id=auth.uid());
drop policy if exists "Users create communities" on public.community_spaces;
create policy "Users create communities" on public.community_spaces for insert to authenticated with check (owner_id=auth.uid());
drop policy if exists "Owners update communities" on public.community_spaces;
create policy "Owners update communities" on public.community_spaces for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "Owners delete communities" on public.community_spaces;
create policy "Owners delete communities" on public.community_spaces for delete to authenticated using (owner_id=auth.uid());

drop policy if exists "Memberships visible to signed in users" on public.community_members;
create policy "Memberships visible to signed in users" on public.community_members for select to authenticated using (true);
drop policy if exists "Users join as members" on public.community_members;
create policy "Users join as members" on public.community_members for insert to authenticated with check (user_id=auth.uid() and role in ('owner','member'));
drop policy if exists "Users update own memberships" on public.community_members;
create policy "Users update own memberships" on public.community_members for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and role='member');
drop policy if exists "Users leave own memberships" on public.community_members;
create policy "Users leave own memberships" on public.community_members for delete to authenticated using (user_id=auth.uid());

grant select,insert,update,delete on public.social_posts to authenticated;
grant select,insert,delete on public.social_post_reactions to authenticated;
grant select,insert,delete on public.social_post_comments to authenticated;
grant select,insert,update,delete on public.community_spaces to authenticated;
grant select,insert,update,delete on public.community_members to authenticated;
