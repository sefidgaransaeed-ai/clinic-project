"use client";

import { useEffect, useState, type ReactNode } from "react";

const VERTEBRAE = 24;

/**
 * قاب سرصفحه: با پایین رفتن صفحه باریک‌تر می‌شود (data-scrolled)،
 * و ردیف مهره‌های لبهٔ پایینش به اندازهٔ پیشرفت در صفحه نارنجی پر می‌شود.
 * محتوای سرصفحه از بیرون (سمت سرور) می‌آید.
 */
export function ScrollHeader({ children }: { children: ReactNode }) {
  const [filled, setFilled] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const progress = room > 0 ? Math.min(window.scrollY / room, 1) : 0;
      setFilled(Math.round(progress * VERTEBRAE));
      setScrolled(window.scrollY > 24);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      className="group/header sticky top-0 z-30 bg-(--site-navy) text-white transition-shadow duration-300 data-scrolled:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)]"
    >
      {children}
      <div aria-hidden="true" className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
        {Array.from({ length: VERTEBRAE }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-sm transition-colors duration-300 ${
              index < filled ? "bg-(--site-orange)" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </header>
  );
}
