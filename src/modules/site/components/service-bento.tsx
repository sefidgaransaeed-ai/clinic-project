import Link from "next/link";
import { serviceGroups } from "../copy";
import { toPersianDigits } from "../format";
import { HeroBackdrop } from "./hero-backdrop";
import { ArrowIcon, CheckIcon } from "./icons";

type ServiceGroup = (typeof serviceGroups)[number];

/**
 * سه گروه خدمت در چیدمان نامتقارن. گروه اول — تزریق‌ها، که پزشک در پرسش ۲۳ اولویتشان داده —
 * کارت بزرگ سرمه‌ای می‌گیرد؛ دو گروه دیگر کنارش روی هم می‌نشینند.
 */
export function ServiceBento() {
  const [featured, ...others] = serviceGroups;
  return (
    <ol className="mt-12 grid gap-5 lg:grid-cols-5 lg:grid-rows-2">
      <FeaturedCard group={featured} number={1} />
      {others.map((group, index) => (
        <CompactCard key={group.id} group={group} number={index + 2} />
      ))}
    </ol>
  );
}

function NumberBadge({ number, inverted = false }: { number: number; inverted?: boolean }) {
  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${
        inverted ? "bg-(--site-orange) text-(--site-navy)" : "bg-(--site-navy) text-(--site-orange)"
      }`}
    >
      <span className="sr-only">گروه </span>
      {toPersianDigits(String(number))}
    </span>
  );
}

function FeaturedCard({ group, number }: { group: ServiceGroup; number: number }) {
  return (
    <li className="relative isolate flex flex-col overflow-hidden rounded-[2rem] bg-(--site-navy) p-7 text-white lg:col-span-3 lg:row-span-2 lg:p-10">
      <HeroBackdrop spine={false} />
      <NumberBadge number={number} inverted />
      <h3 className="mt-6 text-3xl leading-tight font-black md:text-4xl">{group.title}</h3>
      <p className="mt-5 w-fit rounded-2xl rounded-ss-sm bg-(--site-peach) px-4 py-2.5 font-bold text-(--site-navy)">
        «{group.patientSays}»
      </p>
      <p className="mt-5 text-lg text-white/80">{group.solves}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {group.services.map((service) => (
          <li key={service} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-(--site-orange)">
              <CheckIcon className="size-4" />
            </span>
            {service}
          </li>
        ))}
      </ul>
      <Link
        href={`/services#${group.id}`}
        className="mt-auto inline-flex items-center gap-2 pt-8 font-bold text-(--site-orange) hover:underline"
      >
        بیشتر بخوانید
        <ArrowIcon className="size-5" />
      </Link>
    </li>
  );
}

function CompactCard({ group, number }: { group: ServiceGroup; number: number }) {
  return (
    <li className="flex flex-col rounded-[2rem] border border-(--site-grey) bg-white p-6 transition hover:-translate-y-1 hover:border-(--site-orange) lg:col-span-2 lg:p-7">
      <div className="flex items-center gap-3">
        <NumberBadge number={number} />
        <h3 className="text-xl font-black text-(--site-navy)">{group.title}</h3>
      </div>
      <p className="mt-4 w-fit rounded-2xl rounded-ss-sm bg-(--site-peach) px-3 py-2 text-sm font-bold text-(--site-navy)">
        «{group.patientSays}»
      </p>
      <p className="mt-3 text-(--site-muted)">{group.solves}</p>
      <Link
        href={`/services#${group.id}`}
        className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-bold text-(--site-blue) hover:underline"
      >
        بیشتر بخوانید
        <ArrowIcon className="size-4" />
      </Link>
    </li>
  );
}
