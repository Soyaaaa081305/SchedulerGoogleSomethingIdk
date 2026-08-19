import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl font-black text-red-500">
          404
        </div>
        <h2 className="text-lg font-bold text-zinc-900">Page not found</h2>
        <p className="mt-2 text-sm text-zinc-500">
          This page doesn&apos;t exist. Let&apos;s get you back to your schedule.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-[#c8102e] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#a50d26]"
        >
          Back to Scheduler
        </Link>
      </div>
    </div>
  );
}