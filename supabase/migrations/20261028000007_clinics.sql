-- ============================================================================
-- دو مطب — تصمیم 0011
--
-- چرا لازم شد: هنگام بازبینی PR #34 معلوم شد پزشک در **دو مطب** کار می‌کند و
-- برنامه‌اش این است:
--
--     شنبه    — مطب ظفر       ۱۴:۰۰ تا ۱۸:۰۰
--     یکشنبه  — مطب مرزداران  ۱۵:۳۰ تا ۱۹:۰۰
--     سه‌شنبه  — مطب مرزداران  ۱۵:۳۰ تا ۱۹:۰۰
--     چهارشنبه — مطب ظفر       ۱۴:۰۰ تا ۱۸:۰۰
--
-- ولی `working_hours` ستون مطب نداشت و `appointments` هم. یعنی مراجعی که
-- برای یکشنبه ساعت ۱۶ نوبت می‌گرفت، **نمی‌فهمید کجا باید برود** — و ربات
-- یادآوری هم ساعت را بدون نشانی می‌فرستاد.
--
-- ---------------------------------------------------------------------------
-- شکل راه‌حل: مطب **انتخاب نمی‌شود، مشتق می‌شود**
--
-- هر روز هفته دقیقاً به یک مطب تعلق دارد، پس نه مراجع و نه منشی چیزی
-- انتخاب نمی‌کنند. سامانه از روی روز می‌فهمد و فقط **نشان می‌دهد**.
--
-- این عمدی است: هر انتخابی که کاربر مجبور به کردنش شود، یک جای تازه برای
-- اشتباه است. تا وقتی برنامه این شکلی است، انتخاب معنا ندارد.
--
-- اگر روزی یک روز هر دو مطب را داشت، آن‌وقت `available_slots` دو دسته
-- برمی‌گرداند و کاربر باید انتخاب کند. ساختار این فایل آن روز را می‌پذیرد
-- بی‌آنکه چیزی بشکند.
-- ---------------------------------------------------------------------------
-- چرا جدول، و نه فقط یک ستون متنی
--
-- گزینهٔ ارزان‌تر یک ستون `clinic_name text` بود. جدول انتخاب شد چون سایت به
-- **نشانی هر مطب** نیاز دارد و `site_info` جای یک نشانی بیشتر ندارد. بدون
-- این جدول، نشانی مطب دوم برای همیشه در `src/modules/site/content.ts`
-- می‌ماند — یعنی دقیقاً همان چیزی که کار p3-13 قرار است تمامش کند.
-- ============================================================================

create table public.clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  address    text not null,
  directions text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.clinics is
  'مطب‌های پزشک. تصمیم 0011 — مطب از روی روز هفته مشتق می‌شود، انتخاب نمی‌شود.';

-- ---------------------------------------------------------------- ساعت کاری
alter table public.working_hours
  add column clinic_id uuid references public.clinics (id);

comment on column public.working_hours.clinic_id is
  'کدام مطب در این روز باز است. از این ستون، مطبِ هر نوبت مشتق می‌شود.';

-- ---------------------------------------------------------------- نوبت‌ها
-- ارجاع، نه کپی — برخلاف H-1 که بیمه را روی خود پرداخت کپی کرد.
--
-- تفاوتشان در این است که بیمه روی **پولی که شمرده شده** اثر می‌گذارد و
-- گزارش ماه بسته‌شده نباید عوض شود. مطب ولی **جایی است که مراجع رفته**؛
-- اگر نامش عوض شود، همان جاست و سابقه باید نام تازه را نشان بدهد.
--
-- و چون حذف برای هیچ نقشی مجاز نیست، ارجاع هیچ‌وقت نمی‌شکند.
alter table public.appointments
  add column clinic_id uuid references public.clinics (id);

create index appointments_clinic_idx on public.appointments (clinic_id);

-- ============================================================ RLS و دسترسی
alter table public.clinics enable row level security;

create policy clinics_staff_read on public.clinics
  for select to authenticated using (public.is_staff());
create policy clinics_doctor_write on public.clinics
  for insert to authenticated with check (public.is_doctor());
create policy clinics_doctor_update on public.clinics
  for update to authenticated using (public.is_doctor()) with check (public.is_doctor());

-- هیچ policy حذف — مثل بقیهٔ جدول‌ها.
-- anon دسترسی مستقیم ندارد؛ نشانی مطب‌ها از `get_public_info` می‌آید.
revoke all on table public.clinics from anon;
