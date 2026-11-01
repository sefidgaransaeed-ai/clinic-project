import { painAreas } from "../copy";

/**
 * «شما چه می‌گویید، و چه خدمتی به آن پاسخ می‌دهد» — به شکل حباب‌های گفت‌وگو.
 * گفت‌وگوی واقعی نیست؛ همان جدول پرسش ۲۲ برندگاید است، با ظاهری آشناتر.
 */
export function PatientExchange({
  surface = "grey",
}: {
  /** روی زمینهٔ خاکستری، کارت سفید باشد و برعکس */
  surface?: "grey" | "white";
}) {
  const background = surface === "white" ? "bg-white" : "bg-(--site-grey-soft)";
  return (
    <div className={`rounded-[2rem] p-4 sm:p-6 ${background}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-(--site-grey) pb-4 text-xs text-(--site-muted)">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-(--site-orange)" />
          شما می‌گویید
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-(--site-navy)" />
          خدمت مرتبط
        </span>
      </div>

      <ul className="flex flex-col gap-4">
        {painAreas.map((row) => (
          <li key={row.id} className="flex flex-col gap-1.5">
            <p className="max-w-[88%] self-start rounded-2xl rounded-ss-sm bg-(--site-peach) px-4 py-2.5 font-medium text-(--site-navy)">
              «{row.says}»
            </p>
            <p className="max-w-[88%] self-end rounded-2xl rounded-se-sm bg-(--site-navy) px-4 py-2.5 text-sm text-white">
              {row.services.join("، ")}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-center text-xs text-(--site-muted)">
        این فهرست فقط راهنماست؛ تشخیص دقیق بعد از معاینه است.
      </p>
    </div>
  );
}
