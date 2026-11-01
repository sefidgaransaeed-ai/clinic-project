import { toPersianDigits } from "../format";

/**
 * عنوان هر فصل صفحهٔ اول: «فصل ۲ · تشخیص» با یک مهرهٔ نارنجی، تیتر درشت و توضیح.
 * tone="dark" برای زمینهٔ سرمه‌ای است.
 */
export function ChapterHeading({
  number,
  name,
  title,
  description,
  id,
  tone = "light",
  className = "",
}: {
  number: number;
  name: string;
  title: string;
  description?: string;
  id?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={`max-w-2xl ${className}`}>
      <p
        className={`flex items-center gap-2 text-sm font-bold ${
          dark ? "text-white/80" : "text-(--site-blue)"
        }`}
      >
        <span aria-hidden="true" className="h-2.5 w-6 rounded-sm bg-(--site-orange)" />
        فصل {toPersianDigits(String(number))} · {name}
      </p>
      <h2
        id={id}
        className={`mt-3 text-3xl leading-tight font-black text-balance md:text-5xl md:leading-[1.2] ${
          dark ? "text-white" : "text-(--site-navy)"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-4 text-lg ${dark ? "text-white/80" : "text-(--site-muted)"}`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
