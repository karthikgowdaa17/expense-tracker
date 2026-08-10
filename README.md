# Expense Tracker

A modern, full‑stack personal finance dashboard built with **Next.js 16**, **React 19**, **Tailwind CSS**, and **Supabase**. Track income, expenses, budgets, and recurring transactions with interactive charts and a clean, responsive UI.

---

## Live Demo

🔗 **[https://expense-tracker-one-nu-55.vercel.app](https://expense-tracker-one-nu-55.vercel.app)**

---

## Features

| Area | What works today |
|------|------------------|
| **Authentication** | Email/password sign‑up & sign‑in via Supabase Auth (protected routes, session persistence). |
| **Dashboard** | Monthly overview, net‑worth cards, recent transactions, category breakdown charts. |
| **Expense & Income Tracking** | Add, edit, delete transactions; choose category, account, payment method, notes. |
| **Transactions** | Paginated, filterable list with search, date range, type, category, account. |
| **Categories** | Default + custom categories (icon + colour), CRUD via modal dialogs. |
| **Budgets** | Per‑category monthly budgets with progress bars and over‑budget alerts. |
| **Recurring Transactions** | Define frequency (daily…yearly), start/end dates; UI for managing recurring transactions. |
| **Analytics / Charts** | Recharts‑powered line & bar charts for income vs expense, savings rate, category trends. |
| **Profile / Settings** | Editable profile (name, avatar URL), theme (light/dark/system), currency, financial‑year start month. |
| **Currency & Financial‑Year** | Multi‑currency support (INR, USD, EUR, GBP) and configurable fiscal year start. |
| **Data Persistence** | All data stored in Supabase (PostgreSQL) with Row‑Level Security. |


---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Styling** | Tailwind CSS 4, Radix UI primitives, `clsx` / `tailwind-merge` |
| **State & Forms** | React Hook Form + Zod, Zustand (global UI state) |
| **Charts** | Recharts |
| **Auth & DB** | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| **Date handling** | date‑fns |
| **Icons** | Lucide React |
| **Notifications** | Sonner (toast) |
| **Type safety** | TypeScript 5, ESLint 9 (Next.js config) |
| **Build / Deploy** | Vercel (auto‑deploy from GitHub) |

---

## Project Structure

```
src/
├─ app/                     # Next.js App Router pages & layouts
│  ├─ (dashboard)/          # Protected dashboard routes
│  │  ├─ dashboard/         # Main overview
│  │  ├─ transactions/      # Transaction list & detail
│  │  ├─ categories/        # Category management
│  │  ├─ budgets/           # Budget UI
│  │  ├─ recurring/         # Recurring transactions
│  │  ├─ analytics/         # Charts & insights
│  │  ├─ settings/          # Profile, preferences, data tools
│  │  └─ layout.tsx         # Sidebar + header wrapper
│  ├─ auth/                 # Login / signup / callback
│  └─ layout.tsx            # Root layout, ProvidersWrapper
├─ components/
│  ├─ ui/                   # Radix‑based reusable UI primitives
│  ├─ dashboard/            # Dashboard‑specific widgets
│  ├─ layout/               # Header, Sidebar, DashboardLayout
│  └─ providers-wrapper.tsx # ThemeProvider, SupabaseProvider, Toaster
├─ lib/
│  ├─ supabase/             # Client & server Supabase helpers
│  └─ calculation-engine.ts # Aggregations, metrics, chart data prep
├─ utils/
│  ├─ currency.ts           # Formatting, conversion helpers
│  └─ date.ts               # Fiscal‑year, range utilities
└─ types/
   └─ index.ts              # Shared TypeScript interfaces
supabase/
└─ schema.sql               # Full DB schema (tables, RLS, triggers)
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 20
- A Supabase project (free tier works)

### Installation
```bash
# 1. Clone the repo
git clone https://github.com/FINISHER360/expense-tracker.git
cd expense-tracker

# 2. Install dependencies
npm install   # or pnpm install / yarn install

# 3. Create environment file
touch .env.local
# Edit .env.local with your Supabase credentials (see below)
```

### Environment Variables
Create a `.env.local` file (never commit it) with the following keys:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Security note:** `.env.local` is git‑ignored. Do **not** expose real keys in the repository or CI logs.

### Run the development server
```bash
npm run dev
```
Open http://localhost:3000 – you’ll land on the login page; create an account to explore the dashboard.

### Production build
```bash
npm run build
npm start
```

---

## Deployment

The project is deployed on **Vercel** and linked to the GitHub repository.  
Every push to `main` triggers a new preview/production deployment automatically.

*Required Vercel env vars*: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (add them in the Vercel dashboard → Settings → Environment Variables).

---

## Future Improvements

- **Avatar upload** – integrate Supabase Storage for profile pictures.  
- **Multi‑account transfers** – UI + backend for moving money between accounts.  
- **Advanced budgeting** – roll‑over, envelope budgeting, alerts via email/push.  
- **PDF/CSV export** – richer reporting for accountants.  
- **Mobile‑first PWA** – offline support, installable web app.  
- **Automated recurring generation** – Supabase pg_cron or Edge Function.  
- **Unit & integration tests** – Vitest + React Testing Library + Playwright.  
- **Dark‑mode persistence** – already via `next-themes`, but add system‑sync toggle.  

---

## Author

**Karthik Gowda**  
🔗 [GitHub](https://github.com/karthikgowda) · [LinkedIn](https://linkedin.com/in/karthikgowda)

---

*Built with ❤️ using Next.js, Supabase, and Tailwind CSS.*