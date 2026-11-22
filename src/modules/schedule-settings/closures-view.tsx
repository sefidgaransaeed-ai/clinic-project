import { Suspense } from "react";

import { ClosureRow, CreateClosureForm } from "./closures-ui";
import { listClosures } from "./data";

/**
 * نمای تعطیلی‌ها (کامپوننت سروری): عنوان، فرم ثبت و فهرست همهٔ تعطیلی‌ها، فعال و لغوشده.
 * خواندن از کلاینت کاربرِ واردشده است، پس RLS اعمال می‌شود؛ قفل نقش هم در صفحه و در هر action است.
 */

const alertClass = "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300";

async function ClosuresList() {
  const closures = await listClosures();

  if (!closures.ok) {
    return (
      <p role="alert" className={alertClass}>
        {closures.message}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h4 className="text-xs font-bold">ثبت تعطیلی تازه</h4>
        <CreateClosureForm />
      </div>

      {closures.value.length > 0 ? (
        <ul className="space-y-3">
          {closures.value.map((closure) => (
            <ClosureRow key={closure.id} closure={closure} />
          ))}
        </ul>
      ) : (
        <p className="text-xs opacity-60">تعطیلی‌ای ثبت نشده است.</p>
      )}
    </div>
  );
}

export function ClosuresView() {
  return (
    <section aria-labelledby="closures-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="closures-heading" className="text-base font-bold">
          تعطیلی‌ها
        </h2>
        <p className="text-sm opacity-70">
          روزهای تعطیل مطب. تعطیلی حذف نمی‌شود؛ لغو می‌شود و ردیفش می‌ماند و می‌شود دوباره فعالش کرد.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm opacity-70">تعطیلی‌ها در حال بارگذاری است.</p>}>
        <ClosuresList />
      </Suspense>
    </section>
  );
}
