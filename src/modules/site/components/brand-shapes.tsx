/**
 * شکل‌های امضایی برند: موج سرمه‌ای با ردیف مهره‌های نارنجی.
 * از روی توضیح برندگاید از نو و با ریاضی کشیده شده‌اند (برش از فایل برندگاید نیستند)،
 * تا بدون فایل تصویر و در هر عرضی تیز بمانند.
 * ⚠️ «نوار امضایی» در برندگاید هنوز «پیشنهاد — نیازمند تأیید» است.
 */

type Point = { x: number; y: number };
type Vertebra = Point & { width: number; height: number; angle: number };

const round = (n: number) => Math.round(n * 10) / 10;

function sample(curve: (t: number) => Point, steps: number): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => curve(i / steps));
}

function linesThrough(points: Point[]): string {
  return points.map((p) => `L${round(p.x)},${round(p.y)}`).join(" ");
}

/**
 * مهره‌ها را کنار یک منحنی می‌چیند. اندازه‌شان از وسط منحنی به دو سر کم می‌شود.
 * offset فاصله از منحنی است؛ across یعنی مهره عمود بر منحنی بایستد (مثل ستون فقرات).
 */
function vertebraeAlong(
  curve: (t: number) => Point,
  options: {
    count: number;
    from: number;
    to: number;
    width: number;
    height: number;
    minScale: number;
    offset?: (scale: number) => number;
    across?: boolean;
  },
): Vertebra[] {
  const { count, from, to, width, height, minScale, offset, across } = options;
  return Array.from({ length: count }, (_, i) => {
    const t = from + ((to - from) * i) / (count - 1);
    const point = curve(t);
    const before = curve(t - 0.001);
    const after = curve(t + 0.001);
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy);
    const scale = minScale + (1 - minScale) * Math.sin(Math.PI * t);
    const distance = offset ? offset(scale) : 0;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + (across ? 90 : 0);
    return {
      // بردار عمود بر منحنی: برای منحنی افقی رو به پایین است
      x: round(point.x - (dy / length) * distance),
      y: round(point.y + (dx / length) * distance),
      width: round(width * scale),
      height: round(height * scale),
      angle: round(angle),
    };
  });
}

function VertebraShapes({
  items,
  fill = "var(--site-orange)",
  opacity,
  radius = 2,
}: {
  items: Vertebra[];
  fill?: string;
  opacity?: number;
  radius?: number;
}) {
  return (
    <g fill={fill} opacity={opacity}>
      {items.map((v, i) => (
        <rect
          key={i}
          x={round(v.x - v.width / 2)}
          y={round(v.y - v.height / 2)}
          width={v.width}
          height={v.height}
          rx={radius}
          transform={`rotate(${v.angle} ${v.x} ${v.y})`}
        />
      ))}
    </g>
  );
}

/* ───────────── لبهٔ موجی بخش‌های سرمه‌ای ───────────── */

// بوم پهن است تا در صفحه‌های عریض هم دو سر موج صاف ادامه پیدا کند (preserveAspectRatio=slice)
const EDGE = { width: 4000, height: 120, wave: 1200, base: 44, amp: 40 };

function edgeCurve(t: number): Point {
  return {
    x: (EDGE.width - EDGE.wave) / 2 + t * EDGE.wave,
    // ضرب در sin(πt) باعث می‌شود موج در دو سر، نرم به خط صاف برسد
    y: EDGE.base - EDGE.amp * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t),
  };
}

const EDGE_FILL = `M0,0 H${EDGE.width} V${EDGE.base} ${linesThrough(
  sample(edgeCurve, 120).reverse(),
)} H0 Z`;

const EDGE_VERTEBRAE = vertebraeAlong(edgeCurve, {
  count: 30,
  from: 0.05,
  to: 0.95,
  width: 22,
  height: 13,
  minScale: 0.3,
  offset: (scale) => 11 + 7 * scale,
});

/**
 * لبهٔ پایین (یا بالای) یک بخش سرمه‌ای: موج امضایی برند با مهره‌های نارنجی.
 * position="bottom" زیر بخش می‌نشیند؛ "top" بالای بخش (مثل پایین صفحه).
 */
export function WaveEdge({
  position,
  className,
}: {
  position: "top" | "bottom";
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${EDGE.width} ${EDGE.height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g
        transform={
          position === "top" ? `matrix(1 0 0 -1 0 ${EDGE.height})` : undefined
        }
      >
        <path d={EDGE_FILL} fill="var(--site-navy)" />
        <VertebraShapes items={EDGE_VERTEBRAE} />
      </g>
    </svg>
  );
}

/* ───────────── زمینهٔ بخش‌های سرمه‌ای: موج‌ها و ستون ───────────── */

// چند خط نازک موجی، هم‌شکل موج امضایی برند؛ یکی نارنجی
const WAVE_LINES = [
  { offset: -70, color: "rgba(255,255,255,0.06)", width: 1.5 },
  { offset: -35, color: "var(--site-orange)", width: 2, opacity: 0.45 },
  { offset: 0, color: "rgba(255,255,255,0.07)", width: 1.5 },
  { offset: 35, color: "rgba(255,255,255,0.05)", width: 1.5 },
  { offset: 70, color: "rgba(255,255,255,0.04)", width: 1.5 },
];

export function SignatureWaves({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {WAVE_LINES.map((line) => (
        <path
          key={line.offset}
          d={`M-40 ${190 + line.offset} C 240 ${60 + line.offset}, 460 ${300 + line.offset}, 720 ${160 + line.offset} S 1080 ${20 + line.offset}, 1240 ${120 + line.offset}`}
          fill="none"
          stroke={line.color}
          strokeWidth={line.width}
          strokeOpacity={line.opacity}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

const SPINE = { width: 260, height: 560 };

function spineCurve(t: number): Point {
  return {
    x: 150 + 40 * Math.sin(2 * Math.PI * (t * 1.1 - 0.15)),
    y: 16 + t * (SPINE.height - 32),
  };
}

const SPINE_VERTEBRAE = vertebraeAlong(spineCurve, {
  count: 13,
  from: 0.04,
  to: 0.96,
  width: 70,
  height: 22,
  minScale: 0.6,
  across: true,
});

// هلال آبی کنار مهره‌ها — همان منحنی سرمه‌ای نوار امضایی، این بار ایستاده
const SPINE_CRESCENT = (() => {
  const inner = sample((t) => {
    const p = spineCurve(t);
    return { x: p.x - 62, y: p.y };
  }, 80);
  const outer = sample((t) => {
    const p = spineCurve(t);
    return { x: p.x - 62 - 14 * Math.sin(Math.PI * t), y: p.y };
  }, 80).reverse();
  return `M${round(inner[0].x)},${round(inner[0].y)} ${linesThrough(inner)} ${linesThrough(outer)} Z`;
})();

/** یک ستون مهرهٔ بزرگ و کم‌رنگ، تزئین کنار بخش‌های سرمه‌ای */
export function SpineOrnament({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SPINE.width} ${SPINE.height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={SPINE_CRESCENT} fill="var(--site-blue)" opacity={0.9} />
      <VertebraShapes items={SPINE_VERTEBRAE} opacity={0.55} radius={7} />
    </svg>
  );
}

/* ───────────── منحنی مسیر درمان ───────────── */

export const PATH_CANVAS = { width: 1200, height: 160 };

// از راست (قدم اول، پایین) به چپ (قدم آخر، بالا) بالا می‌رود — مثل بالا رفتن از پله
function pathCurve(t: number): Point {
  return {
    x: t * PATH_CANVAS.width,
    y: 40 + 80 * t - 22 * Math.sin(2 * Math.PI * t),
  };
}

/** جای هر قدم روی منحنی، به درصد از چپ و بالا. قدم اول سمت راست است. */
export function pathMarkers(count: number): { left: number; top: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const t = 1 - (i + 0.5) / count;
    const point = pathCurve(t);
    return {
      left: round((point.x / PATH_CANVAS.width) * 100),
      top: round((point.y / PATH_CANVAS.height) * 100),
    };
  });
}

const PATH_CRESCENT = (() => {
  const top = sample((t) => {
    const p = pathCurve(t);
    return { x: p.x, y: p.y - 9 * Math.sin(Math.PI * t) };
  }, 100);
  const bottom = sample(pathCurve, 100).reverse();
  return `M${round(top[0].x)},${round(top[0].y)} ${linesThrough(top)} ${linesThrough(bottom)} Z`;
})();

const PATH_VERTEBRAE = vertebraeAlong(pathCurve, {
  count: 44,
  from: 0.02,
  to: 0.98,
  width: 15,
  height: 8,
  minScale: 0.45,
  offset: (scale) => 9 + 4 * scale,
});

export function PathCurve({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${PATH_CANVAS.width} ${PATH_CANVAS.height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATH_CRESCENT} fill="var(--site-navy)" />
      <VertebraShapes items={PATH_VERTEBRAE} opacity={0.55} />
    </svg>
  );
}

/* ───────────── خط زیر یک کلمه از تیتر ───────────── */

export function Underline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 14"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 10 C 25 3, 60 2, 97 7"
        fill="none"
        stroke="var(--site-orange)"
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
