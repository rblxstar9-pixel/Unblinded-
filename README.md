# Unblinded — Bangla religion & philosophy community

A full-stack React + Supabase community application prepared for deployment on a free-tier hosting/database setup. It is **not live until you connect your own Supabase project and deploy it**.

## Features in this build
- Email/password registration and login (Supabase Auth)
- Public member profiles and avatar uploads
- Article submission queue (`pending`) and moderator approval/rejection
- Public article library with Bangla full-text search
- Comments on published articles
- Shared realtime chat via Supabase Realtime
- Report submission for articles/comments; moderation role and admin queue
- Row Level Security (RLS) on database tables and avatar storage

## 1. Create the database
1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run all of `supabase/schema.sql`.
4. In **Project Settings → API**, copy Project URL and anon/publishable key.
5. In Supabase **Authentication → URL Configuration**, add your future Vercel deployment URL to Site URL and Redirect URLs.

## 2. Configure locally for testing
```bash
npm install
cp .env.example .env
```
Fill `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
```
Then:
```bash
npm run dev
```

## 3. Make your first moderator
Register an account through the app. In Supabase SQL Editor, run:
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```
Keep the admin role restricted to trusted people. Do not expose a service-role key in the browser.

## 4. Deploy publicly for free
1. Push this folder to a private or public GitHub repository.
2. Sign in to Vercel and import the repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project environment variables.
5. Deploy. Add the Vercel URL to Supabase Auth redirect URLs.
6. Your site will be available at a public `*.vercel.app` address; no paid custom domain is required.

## Important production notes
- The SQL enables RLS, but this is a starter implementation. Have a developer/security reviewer audit policies before inviting a large public audience.
- The current UI supports article/comment reporting and moderator approval. Report review workflow, user bans, rate limiting, spam detection, email verification and chat moderation UI should be expanded before a public launch.
- Replies are supported by the database `comments.parent_id`; the starter UI currently displays comments as a flat list. Add nested reply controls before launch if threaded replies are essential.
- Bangla search uses PostgreSQL `simple` tokenization. For better Bangla stemming/relevance, consider a dedicated search service or custom normalization.
- Configure SMTP/email delivery, backups, abuse monitoring, privacy policy, community guidelines and contact details before launch.
- Never put Supabase service-role keys in frontend environment variables. Only the anon/publishable key belongs in the browser.
