/**
 * آیکون خطی هر روش پرداخت، به شیوهٔ تصویرهای سایت: خط اصلی رنگ متن و نارنجی برای یک بخش.
 * آیکون از روی نام روش انتخاب می‌شود؛ روشی که شناخته نشد کیف پول می‌گیرد.
 */
const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const accent = { ...line, stroke: "var(--fin-orange)" };

function CardReader() {
  return (
    <>
      <rect x="12" y="5" width="24" height="38" rx="4" {...line} />
      <rect x="17" y="10" width="14" height="9" rx="1.5" {...accent} />
      <path d="M18 26h.5M24 26h.5M30 26h.5M18 32h.5M24 32h.5M30 32h.5M18 38h12" {...line} strokeWidth={3} />
    </>
  );
}

function CardToCard() {
  return (
    <>
      <rect x="4" y="8" width="25" height="17" rx="3" {...line} />
      <path d="M4 14h25" {...line} />
      <rect x="19" y="23" width="25" height="17" rx="3" {...accent} />
      <path d="M19 29h25" {...accent} />
      <path d="M8 31v3a3 3 0 0 0 3 3h4M13 34l3 3-3 3" {...line} />
    </>
  );
}

function Cash() {
  return (
    <>
      <rect x="4" y="12" width="40" height="24" rx="3" {...line} />
      <circle cx="24" cy="24" r="5.5" {...accent} />
      <path d="M10 18h.5M37.5 30h.5" {...line} strokeWidth={3} />
    </>
  );
}

function Cheque() {
  return (
    <>
      <rect x="4" y="11" width="40" height="26" rx="3" {...line} />
      <path d="M10 19h16M10 25h10" {...line} />
      <path d="M26 31c2-4 4-4 5 0s3 4 5 0" {...accent} />
    </>
  );
}

function Wallet() {
  return (
    <>
      <path d="M9 13h27a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4h22" {...line} />
      <path d="M40 22h-8a4 4 0 0 0 0 8h8" {...accent} />
    </>
  );
}

function drawingFor(name: string) {
  if (name.includes("کارت‌خوان") || name.includes("کارتخوان") || name.includes("پوز")) return <CardReader />;
  if (name.includes("کارت")) return <CardToCard />;
  if (name.includes("نقد")) return <Cash />;
  if (name.includes("چک")) return <Cheque />;
  return <Wallet />;
}

export function MethodIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      {drawingFor(name)}
    </svg>
  );
}
