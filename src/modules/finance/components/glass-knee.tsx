import { useId, type ReactNode } from "react";

// شکل‌ها به واحد viewBox ۳۰۰ در ۴۴۰؛ نمای روبه‌روی مفصل زانو، ساده و بی‌جزئیات
const FEMUR =
  "M118 0 C 118 80, 113 150, 102 198 C 93 228, 80 248, 83 270 C 87 293, 119 301, 139 291 C 146 287, 154 287, 161 291 C 181 301, 213 293, 217 270 C 220 248, 207 228, 198 198 C 187 150, 182 80, 182 0 Z";
const TIBIA =
  "M84 318 C 82 305, 100 299, 120 303 C 136 306, 164 306, 180 303 C 200 299, 218 305, 216 318 C 214 341, 197 352, 185 371 C 177 391, 175 414, 175 440 L 125 440 C 125 414, 123 391, 115 371 C 103 352, 86 341, 84 318 Z";
const FIBULA =
  "M207 346 C 216 346, 222 353, 220 364 C 217 384, 215 410, 215 440 L 202 440 C 202 410, 200 384, 197 364 C 195 353, 199 346, 207 346 Z";
const PATELLA =
  "M150 205 C 172 205, 184 224, 182 248 C 180 272, 166 286, 150 286 C 134 286, 120 272, 118 248 C 116 224, 128 205, 150 205 Z";
const LIGAMENT_INNER = "M78 246 C 70 280, 72 322, 90 356 L 104 350 C 90 320, 88 282, 94 250 Z";
const LIGAMENT_OUTER = "M222 246 C 230 278, 228 318, 214 348 L 202 344 C 214 316, 214 280, 206 250 Z";
const TENDON = "M134 276 C 136 304, 138 330, 140 356 L 160 356 C 162 330, 164 304, 166 276 Z";
const MENISCI =
  "M88 300 C 110 292, 132 296, 142 300 C 132 304, 110 306, 88 300 Z M212 300 C 190 292, 168 296, 158 300 C 168 304, 190 306, 212 300 Z";

type Ids = { body: string; bright: string; orb: string; b4: string; b8: string; soft: string; glow: string };

/** یک شکل شیشه‌ای: سایهٔ نرم، بدنهٔ نیمه‌شفاف، نور لبهٔ بالا، عمق لبهٔ پایین و خط دور سفید */
function Glass({
  d,
  ids,
  clipId,
  fill,
  inner,
  shadow = true,
}: {
  d: string;
  ids: Ids;
  clipId: string;
  fill: string;
  inner?: ReactNode;
  shadow?: boolean;
}) {
  return (
    <>
      {shadow && (
        <path d={d} fill="#262261" opacity={0.14} filter={`url(#${ids.soft})`} transform="translate(10 16)" />
      )}
      <clipPath id={clipId}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={fill} />
      <g clipPath={`url(#${clipId})`}>
        <path
          d={d}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.95}
          strokeWidth={12}
          filter={`url(#${ids.b4})`}
          transform="translate(-5 -5)"
        />
        <path
          d={d}
          fill="none"
          stroke="#262261"
          strokeOpacity={0.5}
          strokeWidth={18}
          filter={`url(#${ids.b8})`}
          transform="translate(8 10)"
        />
        {inner}
      </g>
      <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1.4} />
    </>
  );
}

const fineLines = { fill: "none", stroke: "#ffffff", strokeOpacity: 0.38, strokeWidth: 1.3 };

/**
 * زانوی شیشه‌ای کنار رقم بزرگ گزارش. مفصل زانو پرکارترین جای تزریق در این مطب است.
 * نور نارنجی میان دو استخوان با درآمد بازه پررنگ‌تر می‌شود (glow از صفر تا یک).
 * فقط تزئین است و برای صفحه‌خوان پنهان؛ رقم‌ها کنارش نوشته شده‌اند.
 * تصویر داخل پنل است و منتشر نمی‌شود (مادهٔ ۲۲ برای سایت عمومی است).
 */
export function GlassKnee({ glow, className }: { glow: number; className?: string }) {
  // شناسه‌های تعریف‌ها باید در صفحه یکتا باشند؛ نویسه‌های useId در نشانی url() دردسر می‌سازند
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids: Ids = {
    body: `${base}body`,
    bright: `${base}bright`,
    orb: `${base}orb`,
    b4: `${base}b4`,
    b8: `${base}b8`,
    soft: `${base}soft`,
    glow: `${base}glow`,
  };
  const k = Math.min(1, Math.max(0.25, glow));

  return (
    <svg viewBox="0 0 300 440" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={ids.body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f7ff" stopOpacity={0.96} />
          <stop offset="0.35" stopColor="#bfc2f4" stopOpacity={0.72} />
          <stop offset="0.72" stopColor="#5b5fc0" stopOpacity={0.78} />
          <stop offset="1" stopColor="#262261" stopOpacity={0.94} />
        </linearGradient>
        <linearGradient id={ids.bright} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.98} />
          <stop offset="0.5" stopColor="#d4d6fa" stopOpacity={0.8} />
          <stop offset="1" stopColor="#404099" stopOpacity={0.9} />
        </linearGradient>
        <radialGradient id={ids.orb}>
          <stop offset="0" stopColor="#fff4e3" />
          <stop offset="0.45" stopColor="#ffb24f" />
          <stop offset="1" stopColor="#f8941d" />
        </radialGradient>
        <filter id={ids.b4} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={ids.b8} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={ids.soft} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={ids.glow} x="-100%" y="-300%" width="300%" height="700%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <path d={LIGAMENT_INNER} fill="#cfd2fb" fillOpacity={0.45} stroke="#ffffff" strokeOpacity={0.7} />
      <path d={LIGAMENT_OUTER} fill="#cfd2fb" fillOpacity={0.45} stroke="#ffffff" strokeOpacity={0.7} />
      <Glass d={FIBULA} ids={ids} clipId={`${base}c1`} fill={`url(#${ids.body})`} />
      <Glass
        d={TIBIA}
        ids={ids}
        clipId={`${base}c2`}
        fill={`url(#${ids.body})`}
        inner={
          <path
            d="M106 330 C 128 342, 172 342, 194 330 M116 352 C 138 346, 162 346, 184 352 M130 372 C 142 366, 158 366, 170 372"
            {...fineLines}
          />
        }
      />
      <Glass
        d={FEMUR}
        ids={ids}
        clipId={`${base}c3`}
        fill={`url(#${ids.body})`}
        inner={
          <path
            d="M96 236 C 116 252, 128 270, 138 287 M204 236 C 184 252, 172 270, 162 287 M108 212 C 130 224, 170 224, 192 212 M100 260 C 120 262, 132 274, 140 290"
            {...fineLines}
          />
        }
      />

      {/* فضای مفصل: نور نارنجی */}
      <ellipse cx={150} cy={297} rx={72} ry={14} fill="#f8941d" opacity={0.75 * k} filter={`url(#${ids.glow})`} />
      <ellipse cx={150} cy={297} rx={62} ry={6} fill={`url(#${ids.orb})`} opacity={0.5 + 0.45 * k} />
      <ellipse cx={150} cy={297} rx={43} ry={2} fill="#fff6e8" />
      <path d={MENISCI} fill="#fde5c8" fillOpacity={0.85} stroke="#ffffff" strokeOpacity={0.9} />

      <path d={TENDON} fill="#ffffff" fillOpacity={0.28} stroke="#ffffff" strokeOpacity={0.75} />
      <Glass
        d={PATELLA}
        ids={ids}
        clipId={`${base}c4`}
        fill={`url(#${ids.bright})`}
        inner={<ellipse cx={140} cy={228} rx={16} ry={10} fill="#ffffff" opacity={0.7} filter={`url(#${ids.b4})`} />}
      />
    </svg>
  );
}
