# سامانه هوشمندسازی مطب

سامانه‌ای برای **امور اجرایی و مالی** یک مطب طب فیزیکی و توان‌بخشی: نوبت‌دهی، مراجعان، ثبت پرداخت و گزارش مالی، سایت عمومی و پرسش‌های پرتکرار، ربات یادآوری، و نظرسنجی پس از نوبت.

> ⚠️ این یک **پروژه آموزشی** است. همه داده‌های آن **ساختگی** است و هیچ اطلاعات واقعی مراجعان در آن نگهداری نمی‌شود. پرونده پزشکی و اطلاعات بالینی خارج از محدوده این نسخه است.

## نسخهٔ آنلاین (دموی زنده)

سامانه بر روی بستر Vercel و متصل به Supabase عملیاتی و مستقر شده است:
- 🌐 **نشانی سایت زنده:** [https://clinic-project-psi.vercel.app](https://clinic-project-psi.vercel.app)
- 📊 **داشبورد وضعیت پروژه:** [Clinic-Status-Panel.html](Clinic-Status-Panel.html) (۳۹ کار از ۴۷ کار تمام‌شده — ۸۳٪ پیشرفت)
- 🎬 **سناریوی ارائه ۱۰ دقیقه‌ای:** [`docs/demo-presentation-script.md`](docs/demo-presentation-script.md)

### حساب‌های آزمایشی پنل مدیریت (/panel)

| نقش | نام کاربری | دسترسی‌ها |
|---|---|---|
| **پزشک** | `doctor@clinic.local` | دسترسی کامل به گزارش مالی، داشبورد بازخورد، تنظیمات ساعات کاری، و مدیریت کاربران |
| **منشی** | `secretary@clinic.local` | مدیریت نوبت‌های روز، پذیرش بیمار، ثبت پرداخت، و صدور لینک نظرسنجی |

## فناوری‌ها

Next.js ۱۶ (Turbopack + App Router) · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL + RLS + Auth) · Vitest · Vercel · npm

## اجرای محلی

پیش‌نیاز: Node.js نسخه LTS، Git و GitHub CLI.

```powershell
gh repo clone sefidgaransaeed-ai/clinic-project
cd clinic-project
npm install
npm run dev
```

سپس در مرورگر نشانی `http://localhost:3000` را باز کنید.

### متغیرهای محیطی

فایل `.env.example` را کپی کنید و نامش را `.env.local` بگذارید، سپس مقادیر را از مدیر پروژه دریافت نمایید:

```powershell
copy .env.example .env.local
```

> `.env.local` در `.gitignore` مسدود شده و هرگز وارد مخزن نمی‌شود.

## دستورهای پروژه

| دستور | کار |
|---|---|
| `npm run dev` | اجرای سرور محلی روی پورت ۳۰۰۰ |
| `npm test` | اجرای تمامی ۵۴۶ آزمون خودکار با Vitest (واحد، یکپارچگی و RLS) |
| `npm run build` | ساخت نسخه نهایی بهینه‌سازی‌شده برای Vercel |
| `npm run lint` | ارزیابی سبک کد با ESLint |

## ساختار پروژه

```
src/app/        مسیرها و صفحه‌ها
src/modules/    ماژول‌ها — هر کدام یک صاحب دارد
src/lib/        کد مشترک (نفر اول)
supabase/       تغییرات ساختار پایگاه داده (نفر اول)
tests/          آزمون‌های خودکار
docs/           مستندات، طرح پروژه و راهنمای اجرایی
```

## مستندات

| فایل | محتوا |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | قواعد کار با Claude Code در این مخزن — **اول این را بخوانید** |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | چرخه شاخه و Pull Request، و ۹ قاعده تقسیم کار |
| [`docs/project-scope.md`](docs/project-scope.md) | محدوده نسخه فعلی: چه چیزی هست و چه چیزی نیست |
| [`docs/architecture.md`](docs/architecture.md) | نمای کلی معماری |
| [`docs/clinic-execution-guide.html`](docs/clinic-execution-guide.html) | راهنمای اجرایی روزبه‌روز هر عضو — دانلود کنید و در مرورگر باز کنید |
| [`docs/team-onboarding.md`](docs/team-onboarding.md) | پیام شروع برای اعضای تازه |
| [`docs/demo-presentation-script.md`](docs/demo-presentation-script.md) | سناریوی ارائه ۱۰ دقیقه‌ای و گردش کار دمو |
| [`docs/production-readiness.md`](docs/production-readiness.md) | چک‌لیست آمادگی استقرار و گزارش شواهد فنی |
| [`Clinic-Status-Panel.html`](Clinic-Status-Panel.html) | داشبورد وضعیت و درصد پیشرفت ۴۷ کار پروژه |
| [`docs/decisions/`](docs/decisions/) | تصمیم‌های مهم فنی و چرایی آن‌ها |

## تیم

| نفر | نقش | حوزه |
|---|---|---|
| سعید سفیدگران | نفر اول | هماهنگی، بخش مشترک، پایگاه داده، ورود و نقش‌ها، مدیریت کاربران، چت‌بات |
| خانم مریم | نفر دوم | نوبت‌ها، مراجعان، تنظیمات نوبت‌دهی، ربات یادآوری |
| خانم هستی | نفر سوم | سایت عمومی، امور مالی، بازخورد |
