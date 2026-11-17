import type { ReactNode } from "react";

/**
 * کارت کاغذی کرم‌رنگ با نوار کناری، و مهر گرد تاریخ؛ ظاهر مشترک صفحهٔ نظرسنجی مراجع و
 * صفحهٔ لینک‌ها در پنل («کارت پس از ویزیت»).
 */
export function PaperCard({
  tone = "orange",
  className = "",
  children,
}: {
  tone?: "orange" | "green";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-[1.25rem] bg-[#fffaf3] shadow-[0_1px_0_#eadfce,0_24px_36px_-28px_rgba(38,34,97,0.6)] ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-4 right-0 w-1.25 rounded-s-sm ${
          tone === "green" ? "bg-[#1f7a4d]" : "bg-(--site-orange)"
        }`}
      />
      {children}
    </div>
  );
}

/** مهر گرد؛ سه سطر کوتاه، سطر میانی درشت. فقط برای چشم است و متنش جای دیگری هم نوشته شده */
export function Stamp({
  top,
  middle,
  bottom,
  tone = "navy",
  size = "lg",
  className = "",
}: {
  top: string;
  middle: string;
  bottom: string;
  tone?: "navy" | "green";
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full border-current bg-[#fffaf3]/85 text-center leading-tight font-black outline-dashed outline-current ${
        size === "lg"
          ? "size-23 border-[2.5px] text-[0.7rem] outline-[1.5px] -outline-offset-9"
          : "size-18.5 border-2 text-[0.625rem] outline-[1.5px] -outline-offset-7"
      } ${tone === "green" ? "rotate-8 text-[#1f7a4d]" : "-rotate-10 text-(--site-navy)"} ${className}`}
    >
      <span>
        {top}
        <b className={`block ${size === "lg" ? "text-base" : "text-[0.95rem]"}`}>{middle}</b>
        {bottom}
      </span>
    </span>
  );
}
