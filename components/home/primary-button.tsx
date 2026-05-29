import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * CTA amarillo principal con efecto "jugoso" (sombra sólida + press).
 */
export function PrimaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center justify-center gap-2.5 rounded-full bg-gold px-6 py-4 text-lg font-extrabold text-ink",
        "shadow-[0_6px_0_0_#c9a213,0_14px_28px_-10px_rgba(0,0,0,0.6)] ring-1 ring-black/5",
        "transition-all duration-100 hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_0_#c9a213,0_8px_16px_-10px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
