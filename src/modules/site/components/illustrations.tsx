/**
 * تصویرهای خطی ساده برای «یک روز عادی بعد از درمان».
 * برندگاید تصویر کالبدشکافی و عکس آماده را منع کرده؛ این‌ها فقط لحظه‌های روزمره‌اند.
 * خط اصلی رنگ متن (currentColor) را می‌گیرد و نارنجی برای بخش امیدوارکنندهٔ هر تصویر است.
 */
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const accent = { ...line, stroke: "var(--site-orange)" };

function Morning() {
  return (
    <>
      <path d="M18 44a14 14 0 0 1 28 0" {...accent} />
      <path d="M32 17v6M17 25.5l4 4M47 25.5l-4 4M9.5 36h5M49.5 36h5" {...accent} />
      <path d="M7 44h50" {...line} />
      <path d="M15 52h34" {...line} opacity={0.45} />
    </>
  );
}

function Stairs() {
  return (
    <>
      <path d="M6 54h13V43h13V32h13V21h13" {...line} />
      <path d="M11 37 33 15M33 15h-9M33 15v9" {...accent} />
    </>
  );
}

function Night() {
  return (
    <>
      <path d="M39 13a19 19 0 1 0 13 30A15 15 0 0 1 39 13Z" {...line} />
      <path d="M14 16v6M11 19h6M50 9v4M48 11h4M53 26v4M51 28h4" {...accent} />
    </>
  );
}

const ILLUSTRATIONS = { morning: Morning, stairs: Stairs, night: Night };

export function MomentIllustration({
  name,
  className,
}: {
  name: keyof typeof ILLUSTRATIONS;
  className?: string;
}) {
  const Drawing = ILLUSTRATIONS[name];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <Drawing />
    </svg>
  );
}
