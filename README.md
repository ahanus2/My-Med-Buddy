# Medical Record Insights

An MVP scaffold for a patient-friendly medical record synthesis app. The interface now supports Supabase-backed authentication, secure cloud-synced patient data, OCR-assisted record parsing, generated summaries, and trend charts.

## What is included

- A polished landing/dashboard experience built with Next.js App Router
- Supabase authentication with sign up and sign in
- Secure cloud persistence for patient dashboard data
- Document upload tracking for PDFs and images with OCR fallback
- Portal-link placeholders for future integrations
- CSV lab import with generated summaries and trend visualizations
- Manual lab entry form
- A unified medical timeline built from saved records
- A Supabase schema for row-level access control

## Getting started

1. Install dependencies with `npm install`
2. Copy `.env.local.example` to `.env.local`
3. Add your Supabase project URL, anon key, and `OPENAI_API_KEY` to `.env.local`
4. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor
5. Run the SQL in `supabase/storage.sql` in the Supabase SQL editor
6. Start the dev server with `npm run dev`
7. Open `http://localhost:3000`

## Supabase setup notes

- The app expects email/password auth enabled in Supabase Authentication
- The `patient_dashboards` table stores each signed-in user's full dashboard state as JSON
- Row-level security policies restrict reads and writes to the signed-in user only
- The `medical-record-files` storage bucket keeps uploaded PDFs and images private per signed-in user
- AI summaries run through a server-side OpenAI route and require `OPENAI_API_KEY`
- If you already used an older browser-only version, the first sign-in migrates that local dashboard into the cloud table

## CSV import

Use the sample file at `public/sample-labs.csv` or create your own with:

- Required columns: `date,testName,value,unit,source`
- Optional columns: `low,high`

Example row:

`2026-03-12,TSH,4.9,uIU/mL,North Valley Clinic,0.45,4.5`

## Suggested next steps

- Connect portal aggregators or FHIR-based integrations
- Add AI-backed summarization with human-review safeguards
- Implement audit logging, consent flows, and encrypted storage
- Add server-side validation and deployment hardening for production use
