"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

type ScrollRevealTextProps = {
  children: ReactNode;
  /** Element used to render the text. Defaults to <span>. */
  as?: ElementType;
  /** Extra classes (typography, color, alignment…). */
  className?: string;
  /**
   * Progress (0..1) into this element's on-screen life at which the text
   * is fully revealed. 0.5 = fully solid when the element is halfway
   * through the viewport. Defaults to 0.6.
   */
  completeAt?: number;
};

export function ScrollRevealText({
  children,
  as: Tag = "span",
  className = "",
  completeAt = 0.6,
}: ScrollRevealTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced) {
      el.style.setProperty("--reveal", "100%");
      return;
    }

    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // 0 when the element top hits the bottom of the viewport,
      // 1 when the element bottom leaves the top of the viewport.
      const span = rect.height + vh;
      const scrolled = vh - rect.top;
      const raw = Math.min(1, Math.max(0, scrolled / span));

      const scaled = Math.min(1, raw / Math.max(completeAt, 0.01));
      el.style.setProperty("--reveal", `${(scaled * 100).toFixed(2)}%`);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [completeAt]);

  return (
    <Tag ref={ref} className={`scroll-reveal-text ${className}`}>
      {children}
    </Tag>
  );
}