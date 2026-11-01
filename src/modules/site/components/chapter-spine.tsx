"use client";

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";

type Chapter = { id: string; label: string };

// کجی هر مهره پیش از رسیدن به فصلش: [جابه‌جایی افقی به پیکسل، چرخش به درجه]
const MISALIGNMENT = [
  [7, -13],
  [-9, 11],
  [6, -8],
  [-10, 15],
  [8, -11],
  [-6, 9],
  [9, -14],
];

/**
 * ستون مهره‌ها: نشانگر فصل‌های صفحه، ایستاده کنار صفحه.
 * فصل‌هایی که هنوز نرسیده‌اید کج‌اند و خاکستری؛ با پایین رفتن، یکی‌یکی صاف و نارنجی می‌شوند —
 * همان کاری که درمان می‌کند. اگر کاربر حرکت را خاموش کرده باشد، ستون از اول صاف است.
 * هر مهره پیوندی به فصل خودش است.
 *
 * فقط در صفحه‌های پهن؛ در صفحه‌های کوچک‌تر ردیف مهره‌های سرصفحه پیشرفت را نشان می‌دهد.
 */
export function ChapterSpine({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.45;
      let current = 0;
      chapters.forEach((chapter, index) => {
        const section = document.getElementById(chapter.id);
        if (section && section.getBoundingClientRect().top <= line) current = index;
      });
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;
      setActive(atBottom ? chapters.length - 1 : current);
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
  }, [chapters]);

  const goTo = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav
      aria-label="فصل‌های صفحه"
      className="fixed start-5 top-1/2 z-30 hidden -translate-y-1/2 min-[1300px]:block"
    >
      <span
        aria-hidden="true"
        className="absolute start-[17px] top-2 bottom-2 w-0.5 rounded-full bg-(--site-navy)/15"
      />
      <ol className="relative flex flex-col gap-3">
        {chapters.map((chapter, index) => {
          const aligned = index <= active;
          const [shift, tilt] = MISALIGNMENT[index % MISALIGNMENT.length];
          return (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                onClick={(event) => goTo(event, chapter.id)}
                aria-current={index === active ? "step" : undefined}
                className="group flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--site-blue)"
                style={{ "--shift": `${shift}px`, "--tilt": `${tilt}deg` } as CSSProperties}
              >
                <span
                  className={`block h-5 w-9 rounded-md border transition-[transform,background-color,border-color] duration-500 ease-out ${
                    aligned
                      ? "border-(--site-navy)/20 bg-(--site-orange)"
                      : "border-(--site-navy)/15 bg-(--site-grey) motion-safe:[transform:translateX(var(--shift))_rotate(var(--tilt))]"
                  } ${index === active ? "ring-2 ring-(--site-navy) ring-offset-2" : ""}`}
                />
                <span
                  className={`rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-(--site-navy) shadow-sm transition-opacity duration-300 ${
                    index === active
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                >
                  {chapter.label}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
