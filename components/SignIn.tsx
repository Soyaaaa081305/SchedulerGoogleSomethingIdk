"use client";

import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white text-center shadow-sm">
        <div className="h-1.5 bg-[#c8102e]" aria-hidden="true" />
        <div className="p-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mcl-logo-112.png"
              alt="Mapúa Malayan Colleges Laguna"
              className="h-12 w-12 object-contain"
            />
          </span>
          <h1 className="mt-4 text-2xl font-black text-zinc-900">
            Scheduler
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Mapúa Malayan Colleges Laguna
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            Upload your class schedule, let AI read it, and sync it into Google
            Calendar. Never forget a class or due date again.
          </p>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c8102e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#a50d26]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.667 0-4.773 3.773-8.666 8.6-8.666 2.64 0 4.52 1.013 5.907 2.36l2.28-2.28C18.24 1.007 15.6 0 12.48 0 5.533 0 .16 5.36.16 12c0 6.64 5.373 12 12.32 12 5.747 0 10.12-3.987 10.12-9.667 0-.747-.093-1.427-.213-1.853H12.48z"
              />
            </svg>
            Sign in with Google
          </button>
          <p className="mt-4 text-xs text-zinc-400">
            This also connects your Google Calendar so classes sync
            automatically.
          </p>
        </div>
      </div>
    </main>
  );
}