export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#c8102e]" />
        <p className="text-sm font-medium text-zinc-400">Loading your schedule…</p>
      </div>
    </div>
  );
}
