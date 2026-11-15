import type { Correction } from "../data";
import { formatJalaliLongDate } from "../dates";
import { card } from "./styles";
import { Toman } from "./toman";

/**
 * «اصلاح‌ها و برگشت پول»: ردیف‌های منفی بازه با دلیلشان، تا پزشک ببیند کجا اشتباه شده و چه کسی
 * اصلاحش کرده. خط قرمز کنار هر کدام، مثل کروشهٔ قرمز دفتر پرداخت‌ها.
 */
export function ReportCorrections({
  corrections,
  patientName,
  methodName,
  recorderName,
}: {
  corrections: Correction[];
  patientName: (patientId: string) => string;
  methodName: (methodId: string) => string;
  recorderName: (userId: string) => string;
}) {
  return (
    <section className={`${card} break-inside-avoid`} aria-labelledby="report-corrections-title">
      <h2 id="report-corrections-title" className="text-lg font-black text-(--fin-navy)">
        اصلاح‌ها و برگشت پول
      </h2>
      {corrections.length === 0 ? (
        <p className="mt-1 text-sm text-(--fin-muted)">در این بازه پرداختی اصلاح نشده.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {corrections.map(({ payment, original }) => (
            <li key={payment.id} className="border-s-2 border-(--fin-red) ps-3 text-sm">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-bold text-(--fin-navy)">{patientName(payment.patientId)}</span>
                <Toman amount={payment.amountToman} className="font-bold text-(--fin-red)" />
              </p>
              <p className="text-xs text-(--fin-muted)">
                {original ? "ثبت معکوس پرداخت" : "برگشت پول"} {formatJalaliLongDate(payment.paidAt)}،{" "}
                {methodName(payment.paymentMethodId)}
              </p>
              {payment.note && <p className="mt-1">«{payment.note}»</p>}
              <p className="mt-0.5 text-xs text-(--fin-muted)">
                ثبت‌کننده: {recorderName(payment.recordedBy)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
