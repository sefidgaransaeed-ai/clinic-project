import { treatmentSteps } from "../copy";
import { toPersianDigits } from "../format";
import { PathCurve, pathMarkers } from "./brand-shapes";

/**
 * چهار قدم درمان، مثل چهار مهره روی منحنی امضای برند.
 * در کامپیوتر افقی و رو به بالا؛ در موبایل عمودی.
 */
export function TreatmentPath() {
  const markers = pathMarkers(treatmentSteps.length);

  return (
    <>
      <div className="mt-12 hidden md:block">
        <div aria-hidden="true" className="relative aspect-[1200/160]">
          <PathCurve className="absolute inset-0 size-full" />
          {markers.map((marker, index) => (
            <span
              key={index}
              style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
              className="absolute flex h-14 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-(--site-orange) text-2xl font-black text-(--site-navy) ring-8 ring-white"
            >
              {toPersianDigits(String(index + 1))}
            </span>
          ))}
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-6 text-center">
          {treatmentSteps.map((step) => (
            <li key={step.title}>
              <h3 className="text-lg font-bold text-(--site-navy)">{step.title}</h3>
              <p className="mt-2 text-(--site-muted)">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <ol className="mt-10 flex flex-col gap-8 md:hidden">
        {treatmentSteps.map((step, index) => (
          <li key={step.title} className="relative flex gap-4">
            {index < treatmentSteps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute start-[27px] top-14 -bottom-6 w-0.5 rounded-full bg-(--site-grey)"
              />
            )}
            <span
              aria-hidden="true"
              className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-(--site-orange) text-xl font-black text-(--site-navy)"
            >
              {toPersianDigits(String(index + 1))}
            </span>
            <div className="pt-1">
              <h3 className="text-lg font-bold text-(--site-navy)">{step.title}</h3>
              <p className="mt-1 text-(--site-muted)">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
