"use client";

import { SquareIcon, TimerIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { stopTimer } from "@/app/(app)/tickets/time-actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action-toast";
import { formatElapsed } from "@/lib/time";

type Props = { ticketId: string; code: string; title: string; startedAt: string };

/** Cronómetro activo, visible en todas las pantallas (sidebar y header móvil). */
export function TimerChip({ ticketId, code, title, startedAt }: Props) {
  const { pending, run } = useAction();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1.5 text-sm">
      <TimerIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <Link href={`/tickets/${ticketId}`} className="min-w-0 flex-1 truncate hover:underline" title={title}>
        <span className="font-mono text-xs">{code}</span> {title}
      </Link>
      {/* El tiempo depende del reloj del cliente: puede diferir del HTML del servidor. */}
      <span className="font-medium tabular-nums" suppressHydrationWarning>
        {formatElapsed(now - new Date(startedAt).getTime())}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Detener cronómetro de ${code}`}
        disabled={pending}
        onClick={() => run(() => stopTimer())}
      >
        <SquareIcon />
      </Button>
    </div>
  );
}
