import { WaveEdge } from "./brand-shapes";
import { HeroBackdrop } from "./hero-backdrop";

/** بالای صفحه‌های داخلی: زمینهٔ سرمه‌ای با نور و موج و ستون مهره‌ها، و لبهٔ موجی؛ مثل صفحهٔ اول */
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-(--site-navy) text-white">
        <HeroBackdrop spineClassName="-top-[20%] left-[5%] h-[150%]" />
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-6 md:pt-16 md:pb-8">
          <p className="mb-2 text-sm font-medium text-(--site-orange)">{eyebrow}</p>
          <h1 className="text-3xl font-black text-balance md:text-5xl md:leading-tight">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{description}</p>
        </div>
      </section>
      <WaveEdge position="bottom" className="-mt-px block h-12 w-full md:h-20" />
    </>
  );
}
