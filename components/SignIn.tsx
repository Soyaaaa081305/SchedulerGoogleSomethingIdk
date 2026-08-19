"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "you@example.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deviceInfo(): string {
  const ua = navigator.userAgent;
  const isPhone = /iPhone|Android/i.test(ua);
  return `${isPhone ? "Mobile" : "Desktop"} · ${navigator.platform || "unknown platform"} · ${navigator.language ?? "en"}`;
}

export default function SignIn() {
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string } | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const requestGuestAccess = async () => {
    const email = guestEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email — e.g. name@mcl.edu.ph.");
      return;
    }
    setError(null);
    setRequesting(true);

    const subject = encodeURIComponent(`Scheduler access request — ${email}`);
    const body = encodeURIComponent(
      [
        "Hi! I'd like access to the Scheduler app (Mapúa MCL schedule sync).",
        "",
        `My email: ${email}`,
        "",
        "Please add me as a registered user.",
        "",
        `Device: ${deviceInfo()}`,
        `Requested: ${new Date().toLocaleString()}`,
      ].join("\n")
    );

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    window.location.href = mailto;

    try {
      localStorage.setItem("scheduler-guest-request", email);
    } catch {
      // private mode — ignore
    }
    setSent({ email });
    setRequesting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f7] px-4 py-8">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="h-1.5 bg-[#c8102e]" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mcl-logo-112.png"
                alt="Mapúa Malayan Colleges Laguna"
                className="h-9 w-9 object-contain"
              />
            </span>
            <div>
              <h1 className="text-lg font-black leading-tight text-zinc-900">
                Scheduler
              </h1>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Mapúa MCL
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Upload your class schedule, let AI read it, and sync it to Google
            Calendar. Never miss a class again.
          </p>

<button
              type="button"
              onClick={() => {
                setSigningIn(true);
                signIn("google", { callbackUrl: "/" });
              }}
              disabled={signingIn}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#c8102e] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#a50d26] disabled:opacity-50"
            >
              {signingIn ? (
                "Redirecting…"
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.667 0-4.773 3.773-8.666 8.6-8.666 2.64 0 4.52 1.013 5.907 2.36l2.28-2.28C18.24 1.007 15.6 0 12.48 0 5.533 0 .16 5.36.16 12c0 6.64 5.373 12 12.32 12 5.747 0 10.12-3.987 10.12-9.667 0-.747-.093-1.427-.213-1.853H12.48z"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium text-zinc-400">or</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          {sent ? (
            <div className="text-center">
              <span className="text-3xl">📬</span>
              <h2 className="mt-2 text-base font-black text-zinc-900">
                Request sent!
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                Your mail app opened with a ready request from{" "}
                <span className="font-semibold text-zinc-900">{sent.email}</span>.
                Press send, then sign in with Google once you&apos;re approved.
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Mail app didn&apos;t open? Write to {SUPPORT_EMAIL} from your
                school email.
              </p>
            </div>
          ) : (
            <>
              <label htmlFor="guest-email" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Your email
              </label>
              <input
                id="guest-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(e) => {
                  setGuestEmail(e.target.value);
                  setError(null);
                }}
                placeholder="name@mcl.edu.ph"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-[#c8102e] focus:outline-none"
              />
              {error && (
                <p className="mt-1.5 text-xs text-[#c8102e]">{error}</p>
              )}
              <button
                type="button"
                onClick={() => void requestGuestAccess()}
                disabled={requesting}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-[#c8102e] hover:text-[#c8102e] disabled:opacity-50"
              >
                {requesting ? "Opening mail…" : "Request access as guest"}
              </button>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                Your mail app opens with a pre-filled request to{" "}
                {SUPPORT_EMAIL}. Guests are manually approved.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}