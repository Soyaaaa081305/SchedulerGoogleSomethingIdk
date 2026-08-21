"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export interface UserInfo {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[#fdeeef] text-[#c8102e]"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Header({ user, connected }: { user: UserInfo; connected: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="h-1 bg-gradient-to-r from-[#c8102e] via-[#a50d26] to-[#8a0a1e]" aria-hidden="true" />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mcl-logo-112.png"
            alt=""
            className="h-9 w-9 rounded-lg border border-zinc-200 bg-white object-contain"
          />
          <div>
            <h1 className="text-lg font-black leading-tight text-zinc-900">
              Scheduler
            </h1>
            <p className="text-xs leading-tight text-zinc-500">
              Mapúa Malayan Colleges Laguna
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <NavLink href="/" label="Schedule" />
          <NavLink href="/settings" label="Settings" />
        </nav>

        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Profile"}
              className="h-8 w-8 rounded-full ring-2 ring-zinc-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c8102e] text-sm font-semibold text-white shadow-sm">
              {(user.name ?? "U").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-zinc-700 md:block">
            {user.name ?? user.email}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}