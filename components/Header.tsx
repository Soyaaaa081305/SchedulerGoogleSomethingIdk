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
          : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Header({ user, connected }: { user: UserInfo; connected: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="h-1 bg-[#c8102e]" aria-hidden="true" />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mcl-logo-112.png"
            alt="Mapúa Malayan Colleges Laguna"
            className="h-9 w-9 rounded-lg border border-zinc-200 bg-white object-contain"
          />
          <div>
            <h1 className="text-base font-black leading-tight text-zinc-900">
              Scheduler
            </h1>
            <p className="text-[11px] leading-tight text-zinc-500">
              Mapúa Malayan Colleges Laguna
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink href="/" label="Schedule" />
          <NavLink href="/settings" label="Settings" />
        </nav>

        <div className="flex items-center gap-2">
          {connected ? (
            <span className="hidden rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 sm:inline">
              Calendar on
            </span>
          ) : (
            <span className="hidden rounded-full bg-[#fdeeef] px-3 py-1 text-xs font-medium text-[#c8102e] sm:inline">
              Calendar off
            </span>
          )}

          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Profile"}
              className="h-8 w-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c8102e] text-sm font-semibold text-white">
              {(user.name ?? "U").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hidden max-w-[140px] truncate text-sm text-zinc-700 md:block">
            {user.name ?? user.email}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}