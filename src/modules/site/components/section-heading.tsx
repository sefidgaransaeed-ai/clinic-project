/** عنوان هر بخش: برچسب کوچک آبی، تیتر سرمه‌ای و یک خط کوتاه نارنجی بالای آن */
export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  id?: string;
}) {
  return (
    <div className="max-w-2xl">
      <span aria-hidden="true" className="mb-4 block h-1 w-10 rounded-full bg-(--site-orange)" />
      {eyebrow && (
        <p className="mb-1 text-sm font-medium text-(--site-blue)">{eyebrow}</p>
      )}
      <h2 id={id} className="text-2xl font-bold text-(--site-navy) md:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base text-(--site-muted) md:text-lg">{description}</p>
      )}
    </div>
  );
}
