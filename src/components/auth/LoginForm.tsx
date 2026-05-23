"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath = "/onboarding" }: { nextPath?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handlePasswordSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      const errorMessage =
        signInError.message.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email first, then sign in with your password."
          : signInError.message;
      setError(errorMessage);
      setLoading(false);
      return;
    }

    setAwaitingConfirmation(false);
    router.push(nextPath);
    router.refresh();
  }

  async function handlePasswordSignup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setAwaitingConfirmation(false);
      router.push(nextPath);
      router.refresh();
      return;
    }

    setAwaitingConfirmation(true);
    setMessage("Account created. Check your email to confirm your account before signing in.");
    setLoading(false);
  }

  async function handleResendConfirmation() {
    if (!email) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (resendError) {
      setError(resendError.message);
      setLoading(false);
      return;
    }

    setMessage("Confirmation email resent. Please check inbox and spam.");
    setLoading(false);
  }

  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-rose-500 transition focus:ring"
          placeholder="student@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-rose-500 transition focus:ring"
          placeholder="Enter password"
        />
      </div>

      {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}

      <div className="grid gap-2">
        <button
          type="button"
          disabled={!email || !password || loading}
          onClick={handlePasswordSignIn}
          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign In
        </button>
        <button
          type="button"
          disabled={!email || !password || loading}
          onClick={handlePasswordSignup}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Create Account
        </button>
        {awaitingConfirmation ? (
          <button
            type="button"
            disabled={!email || loading}
            onClick={handleResendConfirmation}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Resend confirmation email
          </button>
        ) : null}
      </div>
    </form>
  );
}
