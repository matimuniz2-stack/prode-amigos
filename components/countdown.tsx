"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  target: string | Date;
  className?: string;
  finishedLabel?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Countdown({ target, className, finishedLabel = "cerrado" }: CountdownProps) {
  const targetMs =
    typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = targetMs - now;
  const isUrgent = remaining > 0 && remaining < 60 * 60 * 1000;
  const isFinished = remaining <= 0;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        isUrgent && "text-amber-600 dark:text-amber-400",
        isFinished && "text-muted-foreground",
        className,
      )}
      suppressHydrationWarning
    >
      {isFinished ? finishedLabel : formatRemaining(remaining)}
    </span>
  );
}
