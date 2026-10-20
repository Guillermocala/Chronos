"use client";

import { PlayIcon, SquareIcon } from "lucide-react";

import { startTimer, stopTimer } from "@/app/(app)/tickets/time-actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action-toast";

type Props = {
  ticketId: string;
  code: string;
  /** true si el cronómetro activo es de este ticket. */
  running: boolean;
  size?: "icon-xs" | "sm";
};

export function TimerButton({ ticketId, code, running, size = "icon-xs" }: Props) {
  const { pending, run } = useAction();
  const label = running ? `Detener cronómetro de ${code}` : `Iniciar cronómetro en ${code}`;

  return (
    <Button
      variant={running ? "default" : "ghost"}
      size={size}
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        run(() => (running ? stopTimer() : startTimer(ticketId)));
      }}
    >
      {running ? <SquareIcon /> : <PlayIcon />}
      {size === "sm" && (running ? "Detener" : "Iniciar")}
    </Button>
  );
}
