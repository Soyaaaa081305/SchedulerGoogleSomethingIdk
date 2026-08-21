"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f6f7] px-4">
      <div className="modal-pop w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl shadow-zinc-900/5">
        <div className="h-1.5 bg-gradient-to-r from-[#c8102e] via-[#a50d26] to-[#8a0a1e] -mx-8 -mt-8 rounded-t-3xl" aria-hidden="true" />
        <div className="mx-auto mb-4 mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-black text-zinc-900">
          {error === "Configuration"
            ? "Sign-in is temporarily unavailable"
            : "Sign-in failed"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {error === "Configuration"
            ? "The auth service is starting up. This usually fixes itself on refresh — try again in a moment."
            : "Google sign-in hit an error. This can happen when the connection is stale or permissions are missing."}
        </p>
        {error && (
          <p className="mt-2 font-mono text-xs text-zinc-400">Error: {error}</p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/"
            className="inline-block rounded-xl bg-[#c8102e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#a50d26] hover:shadow-md"
          >
            Back to Scheduler
          </Link>
          <p className="text-xs leading-relaxed text-zinc-400">
            If this keeps happening, sign out and sign back in with Google, or
            reconnect your calendar in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
