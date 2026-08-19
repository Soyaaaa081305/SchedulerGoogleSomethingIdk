"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "you@example.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deviceInfo(): string {
  const ua = navigator.userAgent;
  const isPhone = /iPhone|Android/i.test(ua);
  return `${isPhone ? "Mobile" : "Desktop"} - ${navigator.platform || "unknown platform"} - ${navigator.language ?? "en"}`;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" strokeWidth={3} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
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
      setError("Enter a valid email - e.g. name@mcl.edu.ph.");
      return;
    }
    setError(null);
    setRequesting(true);

    const subject = encodeURIComponent(`Scheduler access request - ${email}`);
    const body = encodeURIComponent(
      [
        "Hi! I'd like access to the Scheduler app (Mapua MCL schedule sync).",
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
      // private mode - ignore
    }
    setSent({ email });
    setRequesting(false);
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#f6f6f7] px-4 py-8"
      style={{
        background:
          "radial-gradient(1000px 500px at 50% -10%, rgba(200,16,46,0.07), transparent 60%), #f6f6f7",
      }}
    >
      <div className="modal-pop w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-900/5">
        <div className="h-1.5 bg-gradient-to-r from-[#c8102e] via-[#a50d26] to-[#8a0a1e]" aria-hidden="true" />
        <div className="p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
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

          <h2 className="mt-5 text-xl font-bold text-zinc-900">
            Your classes, synced.
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            Upload your class schedule, let AI read it, and sync it to Google
            Calendar with a nightly reminder.
          </p>

          <button
            type="button"
            onClick={() => {
              setSigningIn(true);
              signIn("google", { callbackUrl: "/" });
            }}
            disabled={signingIn}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#c8102e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#a50d26] hover:shadow-md active:scale-[0.99] disabled:opacity-60"
          >
            {signingIn ? (
              <span className="flex items-center gap-2.5">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Redirecting to Google...
              </span>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium text-zinc-400">
              Not a Google user yet?
            </span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          {sent ? (
            <div className="fade-in rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                <CheckIcon />
              </span>
              <h3 className="mt-3 text-base font-bold text-zinc-900">
                Request ready
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                Your mail app opened with a pre-filled request. Press send, and
                sign in with Google once you&apos;re approved.
              </p>
            </div>
          ) : (
            <>
              <label
                htmlFor="guest-email"
                className="text-xs font-semibold uppercase tracking-wide text-zinc-400"
              >
                School email
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
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-300 transition-colors focus:border-[#c8102e] focus:outline-none"
              />
              {error && (
                <p className="mt-1.5 text-xs text-[#c8102e]">{error}</p>
              )}
              <button
                type="button"
                onClick={() => void requestGuestAccess()}
                disabled={requesting}
                className="mt-2.5 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-all hover:border-[#c8102e] hover:bg-[#fdeeef] hover:text-[#c8102e] active:scale-[0.99] disabled:opacity-50"
              >
                {requesting ? "Opening mail..." : "Request access as guest"}
              </button>
              <p className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                Requests are manually reviewed. You&apos;ll be able to sign in
                once approved.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}