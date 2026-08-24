"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui";

export default function ConnectBanner({
  connected,
  needsReconnect,
}: {
  connected: boolean;
  needsReconnect: boolean;
}) {
  if (connected) return null;
  return (
    <div className="border-b border-[#f3c8cf] bg-[#fdeeef]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-[#8a0a1e]">
          {needsReconnect
            ? "Your Google sign-in is missing the calendar permission. Reconnect to let classes sync."
            : "Connect Google Calendar to automatically add your classes as weekly recurring events."}
        </p>
        <Button onClick={() => signIn("google", { callbackUrl: window.location.pathname })} className="px-4 font-semibold">
          {needsReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </Button>
      </div>
    </div>
  );
}