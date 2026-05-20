"use client";

import { useEffect, useMemo, useState } from "react";
import type { FlashMessage } from "@/lib/flash";
import { cn } from "@/lib/utils";

const toneClasses: Record<NonNullable<FlashMessage["tone"]>, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  info: "bg-slate-900 text-white",
};

export function FlashToast({ flash }: { flash: FlashMessage | null }) {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const flashKey = flash ? `flash-shown:${flash.id}` : "";

  const alreadyShown = useMemo(() => {
    if (!flash || typeof window === "undefined") {
      return false;
    }
    return sessionStorage.getItem(flashKey) === "1";
  }, [flash, flashKey]);

  useEffect(() => {
    if (!flash || alreadyShown) {
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(flashKey, "1");
    }

    const timer = setTimeout(() => setDismissedId(flash.id), 3200);
    return () => clearTimeout(timer);
  }, [alreadyShown, flash, flashKey]);

  const toneClass = useMemo(() => (flash ? toneClasses[flash.tone] : toneClasses.info), [flash]);

  if (!flash || alreadyShown || dismissedId === flash.id) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-5">
      <div
        className={cn(
          "pointer-events-auto max-w-xl rounded-xl px-4 py-3 text-sm font-semibold shadow-lg",
          toneClass,
        )}
      >
        {flash.text}
      </div>
    </div>
  );
}
