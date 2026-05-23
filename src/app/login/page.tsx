import { LoginForm } from "@/components/auth/LoginForm";
import { APP_NAME } from "@/lib/constants";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next ?? "/onboarding";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <section className="mb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">{APP_NAME}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Sign in to continue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your email and password to sign in or create your account, then continue to your role dashboard.
        </p>
      </section>
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
