import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6">
      <section className="overflow-hidden rounded-3xl border border-rose-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-10">
        <p className="mb-3 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
          Sunday Church Transportation
        </p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{APP_NAME}</h1>
        <p className="mt-4 max-w-2xl text-base text-slate-700 sm:text-lg">
          Coordinate student rides from North Campus and South Campus to church. Drivers, riders, admins, and owner
          workflows are secured with Supabase authentication and role-based access.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Sign in
          </Link>
          <span className="text-sm text-slate-600">Email login required to view or edit ride details.</span>
        </div>
      </section>
    </main>
  );
}
