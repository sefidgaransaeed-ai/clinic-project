import { connection } from "next/server";

import { PublicBooking } from "./public-booking";
import { fetchPublicInfo } from "./public-booking-data";
import { PUBLIC_BOOKING_MESSAGES as messages } from "./public-booking-messages";

/**
 * بخش خواندنِ داده‌ی صفحهٔ `/nobat`: اطلاعات عمومی را در سرور می‌گیرد و به فرم می‌دهد.
 * با `cacheComponents` باید داخل `<Suspense>` باشد؛ `connection()` هم صراحتاً می‌گوید این بخش هنگام ساخت اجرا نشود،
 * چون روزهای تعطیل و ساعت کاری هر لحظه ممکن است عوض شوند.
 */
export async function PublicBookingLoader() {
  await connection();
  const info = await fetchPublicInfo();

  if (!info) {
    return (
      <p role="alert" className="rounded-3xl bg-white p-5 text-base leading-7 text-slate-800 shadow-sm ring-1 ring-slate-200 sm:p-6">
        {messages.infoFailed}
      </p>
    );
  }

  return <PublicBooking info={info} />;
}
