-- UNBLINDED social feed and public profile details.
-- Additive migration: does not alter or delete existing application tables or data.

create table if not exists public.social_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 280),
  location text not null default 'Bangladesh' check (char_length(location) <= 100),
  interests text not null default '' check (char_length(interests) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_post_reactions (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'like' check (reaction = 'like'),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists social_posts_created_at_idx on public.social_posts(created_at desc);
create index if not exists social_post_comments_post_created_idx on public.social_post_comments(post_id, created_at);

alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_reactions enable row level security;
alter table public.social_post_comments enable row level security;

drop policy if exists "Social profiles are public to read" on public.social_profiles;
create policy "Social profiles are public to read" on public.social_profiles for select using (true);
drop policy if exists "Users manage their own social profile" on public.social_profiles;
create policy "Users manage their own social profile" on public.social_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Social posts are public to read" on public.social_posts;
create policy "Social posts are public to read" on public.social_posts for select using (true);
drop policy if exists "Authenticated users create their own posts" on public.social_posts;
create policy "Authenticated users create their own posts" on public.social_posts for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Authors update their own posts" on public.social_posts;
create policy "Authors update their own posts" on public.social_posts for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "Authors delete their own posts" on public.social_posts;
create policy "Authors delete their own posts" on public.social_posts for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "Reactions are public to read" on public.social_post_reactions;
create policy "Reactions are public to read" on public.social_post_reactions for select using (true);
drop policy if exists "Users add their own reactions" on public.social_post_reactions;
create policy "Users add their own reactions" on public.social_post_reactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users remove their own reactions" on public.social_post_reactions;
create policy "Users remove their own reactions" on public.social_post_reactions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Comments are public to read" on public.social_post_comments;
create policy "Comments are public to read" on public.social_post_comments for select using (true);
drop policy if exists "Users add their own comments" on public.social_post_comments;
create policy "Users add their own comments" on public.social_post_comments for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "Authors delete their own comments" on public.social_post_comments;
create policy "Authors delete their own comments" on public.social_post_comments for delete to authenticated using (auth.uid() = author_id);

grant select, insert, update, delete on public.social_profiles to authenticated;
grant select, insert, update, delete on public.social_posts to authenticated;
grant select, insert, delete on public.social_post_reactions to authenticated;
grant select, insert, delete on public.social_post_comments to authenticated;
grant select on public.social_profiles, public.social_posts, public.social_post_reactions, public.social_post_comments to anon;
