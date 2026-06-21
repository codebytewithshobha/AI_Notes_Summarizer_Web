# NoteForge AI

AI-powered study companion that turns your course notes into summaries, key concepts, MCQs, flashcards, and a notes-grounded chatbot.

## Tech Stack

- **Framework:** TanStack Start (React 19 + Vite 7, SSR + typed server functions)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Routing & Data:** TanStack Router, TanStack Query
- **Backend:** Lovable Cloud (Supabase — Postgres, Auth, Storage, RLS)
- **AI:** Lovable AI Gateway (Google Gemini)
- **Deploy target:** Edge runtime (Cloudflare Workers / Vercel)

## Getting Started

### Prerequisites
- Node.js 20+ **or** [Bun](https://bun.sh) 1.1+

### Install & run

```bash
# with bun (recommended)
bun install
bun run dev

# or with npm
npm install
npm run dev
```

App runs at `http://localhost:5173`.

### Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |

## Environment Variables

Create a `.env` file in the project root (or copy `.env.example`):

```bash
cp .env.example .env
```

Fill in the Supabase values from your project, then add **one** AI provider key:

```env
# Required for auth + database
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# Pick ONE of the following AI provider keys
LOVABLE_API_KEY=         # only available when running on Lovable Cloud
OPENAI_API_KEY=          # get at https://platform.openai.com/api-keys
GEMINI_API_KEY=          # get at https://aistudio.google.com/app/apikey
```

> **Why is an AI key required?** This app summarizes notes, creates quizzes/flashcards, and powers a tutor chat. Those features call an AI model. Non-AI pages (sign-in, landing, history) will work without the key, but the summary/chat features will fail until a key is added.
>
> On Lovable's hosted runtime, `LOVABLE_API_KEY` is injected automatically. For local development or self-hosting, use your own `OPENAI_API_KEY` or `GEMINI_API_KEY` — the app now auto-selects the available provider.

## Project Structure

```
src/
├── routes/                 # File-based routing (TanStack Router)
│   ├── __root.tsx          # Root layout
│   ├── index.tsx           # Landing page
│   ├── auth.tsx            # Sign in / sign up
│   └── _authenticated/     # Protected routes (dashboard, notes, history)
├── components/             # UI components (shadcn/ui)
├── lib/                    # Server functions (*.functions.ts) and helpers
├── integrations/supabase/  # Auto-generated Supabase client
└── styles.css              # Tailwind v4 + design tokens
```

## Deployment

The app builds for an edge runtime. Recommended hosts:

- **Cloudflare Pages / Workers** — matches the default runtime
- **Vercel** — zero-config for Vite

Set the same environment variables on the host and deploy with `bun run build`.

## License

MIT
