import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types";

function linksForRole(profile: Profile) {
  if (profile.role === "owner") {
    return [
      { href: "/owner", label: "Owner" },
      { href: "/admin", label: "Admin View" },
      { href: "/history", label: "History" },
    ];
  }

  if (profile.role === "admin" && profile.admin_status === "approved") {
    return [
      { href: "/admin", label: "Admin" },
      { href: "/history", label: "History" },
    ];
  }

  if (profile.role === "driver") {
    return [{ href: "/driver", label: "Driver" }];
  }

  return [{ href: "/rider", label: "Rider" }];
}

export function AppHeader({
  profile,
  title,
  subtitle,
}: {
  profile: Profile;
  title: string;
  subtitle?: string;
}) {
  const links = linksForRole(profile);

  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">{APP_NAME}</p>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
