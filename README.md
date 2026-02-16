## Date Poll Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Use `.env.example` as the reference and set these in `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended for server-side DB access)

Use the same values locally and on Vercel if you want the same polls visible in both environments.

If `SUPABASE_SERVICE_ROLE_KEY` is not set, the app falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
In that case, DB access depends on your table RLS/policies.

### 3. Run the SQL migration manually in Supabase

Open Supabase SQL Editor and run:
`sql/migrations/001_init_poll_schema.sql`

After running the migration, refresh PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

Set the same environment variables in Vercel Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Then redeploy.
