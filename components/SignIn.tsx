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

  const requestGuestAccess = () => {
    const email = guestEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email — e.g. name@mcl.edu.ph — so your invite can be sent.");
      return;
    }
    setError(null);

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
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-center shadow-sm">
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
            <h1 className="mt-4 text-2xl font-black text-zinc-900">Scheduler</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Mapúa Malayan Colleges Laguna
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              Upload your class schedule, let AI read it, and sync it into
              Google Calendar. Never miss a class again.
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
            <p className="mt-4 text-xs leading-relaxed text-zinc-400">
              This also connects your Google Calendar so classes sync
              automatically. Use this if you already have an account.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {sent ? (
            <div className="text-center">
              <span className="text-3xl">📬</span>
              <h2 className="mt-2 text-lg font-black text-zinc-900">
                Request sent!
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Your email app opened with a ready-to-send request from{" "}
                <span className="font-semibold text-zinc-900">{sent.email}</span>.
                Hit send, and you&apos;ll be invited shortly. Once approved,
                sign in with Google above.
              </p>
              <p className="mt-3 text-xs text-zinc-400">
                Didn&apos;t open your mail app? Write to {SUPPORT_EMAIL} — a
                request from your school email works best.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-bold text-zinc-900">New here?</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                No account yet? Send an access request with your school email.
                Your mail app will open with a pre-filled message — just press
                send.
              </p>
              <label className="mt-3 block text-xs font-semibold text-zinc-600">
                Your email
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={guestEmail}
                onChange={(e) => {
                  setGuestEmail(e.target.value);
                  setError(null);
                }}
                placeholder="name@mcl.edu.ph"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-300 focus:border-[#c8102e] focus:outline-none"
              />
              {error && (
                <p className="mt-2 text-sm text-[#c8102e]">{error}</p>
              )}
              <button
                type="button"
                onClick={requestGuestAccess}
                className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:border-[#c8102e] hover:text-[#c8102e]"
              >
                Request access as guest
              </button>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                Guests are manually approved to keep data safe — it&apos;s a
                student-made app, no spam.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}