# Ad Guru

A social media + ads scheduling app built with React, Vite, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

## Features

- **Multi-tenant workspaces** with role-based access
- **Auth**: Email + password (with confirmation) and Google OAuth
- **Planner**: Visual time-grid week view with Google Calendar sync
- **Composers**: Facebook, LinkedIn, and X (Twitter) post composers with scheduling
- **Facebook Ads Manager**: Meta OAuth, onboarding wizard, AI Ad Studio, and Ads Library
- **Scheduler**: Cron-based publishing of scheduled posts

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui components
- Supabase (Auth, Database, Storage, Edge Functions)
- Lovable AI Gateway (Gemini 2.5 Pro for copy, Gemini 2.5 Flash Image for visuals)

## Project Structure

```
postpilot/
├── src/
│   ├── components/       # UI components (shadcn/ui + layout)
│   ├── hooks/            # React hooks (auth, workspaces, planner)
│   ├── lib/              # Utilities and Supabase client
│   ├── pages/            # Route pages
│   ├── types/            # TypeScript types and Database schema
│   ├── App.tsx           # Router setup
│   └── main.tsx          # Entry point
├── supabase/
│   ├── functions/        # Edge functions (OAuth, APIs, AI, scheduler)
│   └── migrations/       # Database schema
└── .env.example          # Environment variables template
```

## Getting Started

1. Copy `.env.example` to `.env` and fill in your Supabase credentials.
2. Run the SQL migration in `supabase/migrations/00000000000000_initial_schema.sql` in your Supabase project.
3. Deploy edge functions from `supabase/functions/`.
4. Install dependencies and run:

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env`. Variables fall into two groups:

**App** — `VITE_SUPABASE_*`, `APP_URL` (needed for every deployment)

**Platform owner** — OAuth app credentials, `INTEGRATION_ENCRYPTION_KEY`, and AI keys (`OPENROUTER_*`, `LOVABLE_*`, `FAL_*`). Subscribers never enter these; they only pick models in Settings after you sync secrets:

```bash
npm run supabase:secrets
```

## License

MIT
