# Eidi Logger

Modern glassmorphic eidi logging web app.

## Stack
- Frontend: HTML/CSS/JS
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL + Auth)
- Charts: Chart.js
- AI comments: OpenAI (optional)

## Setup

1. Clone repository
2. Install backend dependencies:

```bash
cd d:\MyProjects\EidiLogger
npm install
```

3. Copy environment config:

```bash
copy .env.example .env
```

4. Set variables in `.env`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY` (service_role key)
  - `OPENAI_API_KEY` (optional) 

5. Create Supabase schema:

```sql
create table if not exists eidis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('received','sent')),
  amount numeric not null,
  sender_name text,
  notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

create index on eidis (user_id);
```

6. (Optional) Supabase policy:

```sql
create policy "Users can manage own eidis"
  on eidis
  for all
  using (auth.uid() = user_id);
```

7. Add client keys to frontend files:
  - `public/login.html`
  - `public/dashboard.html`

8. Run backend

```bash
npm run dev
```

9. Serve frontend e.g. with `live-server` or built-in VSCode server.

## Usage
- Login with email enters Supabase magic link.
- Dashboard logs entries & shows charts.
- AI comments from OpenAI powered endpoint.

> Note: this is a logging app (not a payment gateway).
