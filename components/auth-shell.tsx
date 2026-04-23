"use client";

import { FormEvent, useEffect, useState } from "react";
import { HomePage } from "@/components/home-page";
import { bootstrapUserDashboardState, saveUserDashboardState } from "@/lib/cloud-state";
import { clearSession, listenForAuthChanges, loadSession, signIn, signUp, type AuthSession } from "@/lib/backend-auth";
import { type AppState } from "@/lib/medical-data";
import { isSupabaseConfigured } from "@/lib/supabase";

type AuthMode = "signin" | "signup";

export function AuthShell() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [dashboardState, setDashboardState] = useState<AppState | null>(null);
  const [status, setStatus] = useState("Create an account or sign in to open your private dashboard.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsReady(true);
      return;
    }

    let isMounted = true;
    loadSession()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
          setIsReady(true);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setStatus(error instanceof Error ? error.message : "Unable to load the current session.");
          setIsReady(true);
        }
      });

    const unsubscribe = listenForAuthChanges((nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      if (!nextSession) {
        setDashboardState(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;
    setIsLoadingDashboard(true);
    setStatus("Loading your secure cloud records...");

    bootstrapUserDashboardState(session.userId)
      .then((nextState) => {
        if (!cancelled) {
          setDashboardState(nextState);
          setStatus("Cloud workspace ready.");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Unable to load your cloud data.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDashboard(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "");

    if (!email || !password || (mode === "signup" && !fullName.trim())) {
      setStatus("Please complete the required fields before continuing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nextSession = mode === "signup" ? await signUp(fullName, email, password) : await signIn(email, password);

      if (!nextSession) {
        setStatus("Account created. Check your email to confirm the sign-in before opening the dashboard.");
        return;
      }

      setSession(nextSession);
      setStatus(mode === "signup" ? "Account created and signed in." : "Signed in.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await clearSession();
      setSession(null);
      setDashboardState(null);
      setMode("signin");
      setStatus("Signed out.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  async function handlePersistState(nextState: AppState) {
    if (!session) {
      return;
    }

    await saveUserDashboardState(session.userId, nextState);
  }

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="panel rounded-[2rem] px-8 py-10 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate">Loading</p>
          <h1 className="mt-3 text-2xl font-semibold">Preparing your dashboard</h1>
        </div>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="panel w-full max-w-4xl rounded-[2rem] px-8 py-10">
          <div className="inline-flex rounded-full bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            Backend setup required
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">Connect Supabase to turn this into a real patient backend.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate">
            This version now expects real authentication and cloud data storage. Add your Supabase project keys in
            `.env.local`, run the SQL in `supabase/schema.sql`, and then restart the app.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <p className="font-semibold">Step 1</p>
              <p className="mt-2 text-sm leading-6 text-slate">Copy `.env.local.example` to `.env.local` and paste in your Supabase URL and anon key.</p>
            </div>
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <p className="font-semibold">Step 2</p>
              <p className="mt-2 text-sm leading-6 text-slate">Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor to create the secure table and policies.</p>
            </div>
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <p className="font-semibold">Step 3</p>
              <p className="mt-2 text-sm leading-6 text-slate">Restart `npm run dev` and sign up with a real account.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (session && dashboardState) {
    return <HomePage currentUser={session} onSignOut={handleSignOut} initialState={dashboardState} onPersistState={handlePersistState} />;
  }

  if (session && isLoadingDashboard) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="panel rounded-[2rem] px-8 py-10 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate">Syncing cloud data</p>
          <h1 className="mt-3 text-2xl font-semibold">Loading your secure record workspace</h1>
          <p className="mt-3 text-sm leading-6 text-slate">{status}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel rounded-[2rem] px-8 py-10 lg:px-12">
          <div className="inline-flex rounded-full bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
            Private patient workspace
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Sign in to your medical records dashboard.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate">
            This app now uses real Supabase authentication and cloud persistence so each patient can sign in to a
            secure, separate dashboard.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <p className="font-semibold">Protected access</p>
              <p className="mt-2 text-sm leading-6 text-slate">The dashboard only opens after secure sign-in.</p>
            </div>
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <p className="font-semibold">Cloud sync</p>
              <p className="mt-2 text-sm leading-6 text-slate">Your dashboard data is stored in the backend instead of only this browser.</p>
            </div>
            <div className="rounded-[1.5rem] bg-canvas p-4">
              <p className="font-semibold">Secure foundation</p>
              <p className="mt-2 text-sm leading-6 text-slate">This is the first step toward a real patient portal-grade product.</p>
            </div>
          </div>
        </section>

        <section className="panel rounded-[2rem] px-6 py-8 sm:px-8">
          <div className="flex gap-2 rounded-full bg-canvas p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${mode === "signin" ? "bg-white text-ink" : "text-slate"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${mode === "signup" ? "bg-white text-ink" : "text-slate"}`}
            >
              Sign up
            </button>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <input
                name="fullName"
                placeholder="Full name"
                className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
              />
            ) : null}
            <input
              name="email"
              type="email"
              placeholder="Email"
              className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="rounded-[1rem] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSubmitting ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 rounded-[1.25rem] bg-canvas p-4">
            <p className="text-sm leading-7 text-slate">{status}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
