import type { StaticImageData } from "next/image";

import electrotherapy from "./assets/clinic-electrotherapy.jpg";
import fluoroscopy from "./assets/clinic-fluoroscopy.jpg";
import reception from "./assets/clinic-reception.jpg";
import treatmentRoom from "./assets/clinic-treatment-room.jpg";
import doctorPortrait from "./assets/doctor-portrait.jpg";
import prp from "./assets/injection-prp.jpg";

/**
 * عکس‌های واقعی مطب — مثل لوگو، فایل خود سایت هستند (src/modules/site/assets) و در
 * پایگاه داده ردیف ندارند. دلیلش همان دلیل لوگوست: پنل امکان بارگذاری عکس ندارد و
 * افزودنش خارج از دامنهٔ نسخهٔ فعلی است.
 *
 * رضایت انتشار همهٔ عکس‌ها گرفته شده (مادهٔ ۲۲ برندگاید). اگر روزی عکسی پس گرفته شد،
 * فقط import و ردیفش از همین فایل حذف می‌شود؛ صفحه‌ها بدون آن هم بی‌خطا بالا می‌آیند (W-11).
 *
 * alt فارسی و توصیفی است، ولی نام پزشک در آن نمی‌آید: برندگاید نام را فقط همراه عنوان
 * تخصص و شمارهٔ نظام پزشکی می‌پذیرد (مادهٔ ۲۰) و آن دو در alt جا نمی‌شوند.
 */
export type SitePhoto = {
  src: StaticImageData;
  alt: string;
};

export const sitePhotos = {
  treatmentRoom: {
    src: treatmentRoom,
    alt: "اتاق درمان مطب؛ کنار تخت درمان و دستگاه‌های درمانی",
  },
  doctorPortrait: {
    src: doctorPortrait,
    alt: "پزشک پشت میز معاینه، کنار مدل ستون فقرات",
  },
  reception: {
    src: reception,
    alt: "پذیرش مطب با میز چوبی و مدل ستون فقرات",
  },
  fluoroscopy: {
    src: fluoroscopy,
    alt: "اتاق فلوروسکوپی مطب با دستگاه تصویربرداری و میز معاینه",
  },
  prp: {
    src: prp,
    alt: "لوله‌های آزمایش خون آمادهٔ تزریق پی‌آرپی",
  },
  electrotherapy: {
    src: electrotherapy,
    alt: "درمان با دستگاه تحریک الکتریکی روی پای بیمار",
  },
} satisfies Record<string, SitePhoto>;
