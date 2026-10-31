import Image from "next/image";

/**
 * لوگوی سایت، از کلید logo_url در site_info.
 * اگر خالی باشد، یک قاب خالی نشان داده می‌شود. وقتی نشانی لوگو در پایگاه داده ثبت شد،
 * همین‌جا نمایش داده می‌شود و کد عوض نمی‌شود.
 * alt خالی است چون نام پزشک درست کنار لوگو نوشته شده.
 */
export function SiteLogo({
  url,
  className = "",
  tone = "light",
}: {
  url: string;
  className?: string;
  /** dark برای زمینهٔ سرمه‌ای */
  tone?: "light" | "dark";
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={88}
        height={88}
        unoptimized
        className={`shrink-0 rounded-xl bg-white object-contain p-1 ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-xl border-2 border-dashed ${
        tone === "dark"
          ? "border-white/25 bg-white/5"
          : "border-(--site-grey) bg-(--site-grey-soft)"
      } ${className}`}
    />
  );
}
