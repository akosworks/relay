"use client";

import Link from "next/link";
import { motion, useSpring, useTransform } from "motion/react";
import { useRef } from "react";
import { SPRING } from "@/lib/motion";
import { useFinePointer } from "@/lib/useFinePointer";

type Props = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "solid" | "outline";
  className?: string;
};

/**
 * The button leans toward the cursor before it is reached, and the label lags
 * behind the shell by a fraction. That offset is what gives it depth.
 */
export function Button({
  children,
  href,
  onClick,
  variant = "outline",
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();

  const x = useSpring(0, SPRING.magnet);
  const y = useSpring(0, SPRING.magnet);
  const labelX = useTransform(x, (v) => v * 0.32);
  const labelY = useTransform(y, (v) => v * 0.32);

  const handleMove = (e: React.PointerEvent) => {
    if (!fine || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(Math.max(-14, Math.min(14, dx * 0.3)));
    y.set(Math.max(-10, Math.min(10, dy * 0.45)));
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const base =
    "relative inline-flex items-center justify-center rounded-full px-8 h-[54px] text-[15px] tracking-[-0.01em] font-medium select-none transition-colors duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]";

  const skin =
    variant === "solid"
      ? "bg-ink text-paper hover:bg-blue"
      : "text-ink border border-rule hover:border-ink";

  const inner = (
    <motion.span style={fine ? { x: labelX, y: labelY } : undefined} className="block">
      {children}
    </motion.span>
  );

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={fine ? { x, y } : undefined}
      className="inline-flex p-2.5 -m-2.5"
    >
      {href ? (
        <Link href={href} className={`${base} ${skin} ${className}`} onClick={reset}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={`${base} ${skin} ${className}`}
        >
          {inner}
        </button>
      )}
    </motion.div>
  );
}

/**
 * Quiet inline link. The rule under it grows from the left on hover and
 * retracts to the right on the way out, so entering and leaving are not
 * mirror images of each other.
 */
export function TextLink({
  children,
  href,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <span className="relative z-10">{children}</span>
      <span className="pointer-events-none absolute bottom-0 left-0 h-px w-full overflow-hidden">
        <span className="block h-px w-full origin-right scale-x-0 bg-current transition-transform duration-[550ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:origin-left group-hover:scale-x-100" />
      </span>
    </>
  );

  const cls = `group relative inline-block pb-1 text-[15px] tracking-[-0.01em] transition-colors duration-500 hover:text-blue ${className}`;

  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
