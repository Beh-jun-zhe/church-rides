import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-8 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Access restricted</h1>
        <p className="mt-3 text-sm text-slate-600">
          This page requires a different role or an approved admin account.
        </p>
        <Link
          href="/onboarding"
          className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Go to onboarding
        </Link>
      </div>
    </main>
  );
}
