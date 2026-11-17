import type { ReportLine } from "../data";
import { toPersianDigits } from "../dates";
import { card } from "./styles";
import { Toman } from "./toman";

// رنگ هر ردیف به ترتیب سهم، همه از برندگاید؛ نوشتهٔ روی نارنجی و هلویی سرمه‌ای است
const SHARE_COLORS = [
  { fill: "bg-(--fin-orange)", text: "text-(--fin-navy)" },
  { fill: "bg-(--fin-navy)", text: "text-white" },
  { fill: "bg-(--fin-blue)", text: "text-white" },
  { fill: "bg-(--fin-peach) shadow-[inset_0_0_0_1px_rgb(38_34_97/0.15)]", text: "text-(--fin-navy)" },
  { fill: "bg-(--fin-muted)", text: "text-white" },
];

const colorOf = (index: number) => SHARE_COLORS[Math.min(index, SHARE_COLORS.length - 1)];

// درصد فقط روی تکه‌ای نوشته می‌شود که جا داشته باشد
const LABEL_MIN_SHARE = 0.12;

/**
 * جمع به تفکیک یک چیز (روش پرداخت یا نوع بیمه).
 * بالای جدول یک نوار تکه‌تکه، مثل نوار امضایی برند: هر تکه سهم یک ردیف از درآمد است.
 * درصد هر ردیف کنار نامش هم نوشته شده تا معنا فقط با رنگ و طول گفته نشود.
 */
export function ReportBreakdown({
  title,
  lines,
  nameOf,
}: {
  title: string;
  lines: ReportLine[];
  nameOf: (id: string | null) => string;
}) {
  // سهم از جمع ردیف‌های مثبت، تا برگشت پول درصدها را بیش از صد نکند
  const positive = lines.reduce((sum, line) => sum + Math.max(0, line.totalToman), 0);
  const shareOf = (line: ReportLine) =>
    positive > 0 ? Math.max(0, line.totalToman) / positive : 0;
  const percent = (share: number) => `${toPersianDigits(String(Math.round(share * 100)))}٪`;

  return (
    <section className={card}>
      <h2 className="text-lg font-black text-(--fin-navy)">{title}</h2>

      {positive > 0 && (
        <div aria-hidden="true" className="mt-4 flex h-8 gap-[3px]">
          {lines.map((line, index) => {
            const share = shareOf(line);
            if (share === 0) return null;
            const color = colorOf(index);
            return (
              <span
                key={line.id ?? "none"}
                className={`flex min-w-1 items-center justify-center rounded-[2px] text-xs font-bold ${color.fill} ${color.text}`}
                style={{ flexGrow: share, flexBasis: 0 }}
              >
                {share >= LABEL_MIN_SHARE ? percent(share) : ""}
              </span>
            );
          })}
        </div>
      )}

      <table className="mt-3 w-full text-sm">
        <thead className="text-(--fin-muted)">
          <tr>
            <th scope="col" className="pb-2 text-start font-normal">
              نام
            </th>
            <th scope="col" className="pb-2 text-center font-normal">
              تعداد
            </th>
            <th scope="col" className="pb-2 text-end font-normal">
              جمع خالص
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id ?? "none"} className="border-t border-(--fin-grey)">
              <th scope="row" className="py-3 pe-3 text-start font-bold text-(--fin-navy)">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 rounded-[2px] ${colorOf(index).fill}`}
                  />
                  {nameOf(line.id)}
                  <span className="ms-auto text-xs font-normal text-(--fin-muted)">
                    {percent(shareOf(line))}
                  </span>
                </span>
              </th>
              <td className="py-3 text-center text-(--fin-muted)">
                {toPersianDigits(String(line.count))}
              </td>
              <td className="py-3 text-end">
                <Toman
                  amount={line.totalToman}
                  className={`font-bold ${line.totalToman < 0 ? "text-(--fin-red)" : "text-(--fin-ink)"}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
