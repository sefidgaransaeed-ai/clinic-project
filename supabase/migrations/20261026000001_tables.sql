-- ============================================================================
-- جدول‌های پایه — پیاده‌سازی docs/data-model.md
--
-- قواعد عمومی بخش ۱ سند:
--   زمان: همه‌جا timestamptz و ذخیره به UTC. مرز روزها در گزارش‌ها Asia/Tehran (H-12)
--   مبلغ: bigint به تومان، هرگز اعشار
--   حذف: برای هیچ نقشی مجاز نیست — هیچ policy حذف در 0003 نوشته نمی‌شود
--   RLS: در فایل 0003 روی همهٔ جدول‌ها فعال می‌شود
-- ============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------- نقش‌ها
create table public.profiles (
  user_id              uuid primary key references auth.users (id) on delete restrict,
  full_name            text        not null,
  role                 text        not null check (role in ('doctor', 'secretary')),
  is_active            boolean     not null default true,
  must_change_password boolean     not null default true,
  created_at           timestamptz not null default now()
);

comment on table public.profiles is
  'اطلاعات کاربر پنل. نقش واقعی در app_metadata حساب Supabase است؛ این ستون برای نمایش و گزارش.';

-- ------------------------------------------------- فهرست‌های تنظیماتی
create table public.insurance_types (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null unique,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

create table public.payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null unique,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- مراجعان
create table public.patients (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  -- M-1: یکتا می‌ماند ولی می‌تواند خالی باشد. این «شمارهٔ خودِ مراجع» است،
  -- نه شمارهٔ کسی که نوبت گرفته. سالمند و کودکی که شماره ندارند، خالی می‌مانند.
  mobile            text unique check (mobile ~ '^09\d{9}$'),
  -- هویت مراجع همین است، نه موبایل (Q-9، M-1)
  national_id       text not null unique check (national_id ~ '^\d{10}$'),
  -- M-6: برای زمان‌بندی و اختصاص اتاق، نه برای پرونده. هر دو اختیاری.
  birth_date        date,
  gender            text check (gender in ('female', 'male')),
  insurance_type_id uuid references public.insurance_types (id),
  created_by        uuid references public.profiles (user_id),
  created_at        timestamptz not null default now()
);

comment on column public.patients.mobile is
  'M-1 — شمارهٔ خودِ مراجع. یکتا، و اگر مراجع شماره شخصی ندارد خالی می‌ماند.';
comment on column public.patients.birth_date is
  'M-6 — برای زمان‌بندی و اختصاص اتاق. سن از این محاسبه می‌شود، ذخیره نمی‌شود.';

-- ---------------------------------------------------------------- نوبت‌ها
create table public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid references public.patients (id),
  requester_name        text,
  -- A-4: شمارهٔ تماس این نوبت، برای هر دو source و اجباری.
  -- یکتا نیست — یک خانواده می‌تواند با یک شماره چند نوبت بگیرد.
  requester_mobile      text not null check (requester_mobile ~ '^09\d{9}$'),
  requester_national_id text check (requester_national_id ~ '^\d{10}$'),
  requested_for_self    boolean,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null check (ends_at > starts_at),
  status                text not null default 'requested'
                          check (status in ('requested','confirmed','arrived','done','no_show','cancelled')),
  -- A-1: سه رویداد متفاوت به cancelled می‌رسیدند و پنل نمی‌توانست جداشان کند
  cancel_reason         text check (cancel_reason in ('rejected','cancelled','expired')),
  source                text not null check (source in ('site','panel')),
  created_by            uuid references public.profiles (user_id),
  note                  text,
  created_at            timestamptz not null default now(),

  -- یا مراجع ثبت‌شده دارد، یا سه فیلد هویتی درخواست سایت پر است.
  -- requester_mobile از این شرط بیرون است چون طبق A-4 همیشه پر است.
  constraint appointments_identity_check check (
    patient_id is not null
    or (requester_name        is not null
        and requester_national_id is not null
        and requested_for_self    is not null)
  ),

  -- cancel_reason فقط وقتی معنا دارد که نوبت لغو شده باشد
  constraint appointments_cancel_reason_consistency check (
    (status = 'cancelled') = (cancel_reason is not null)
  ),

  -- ⭐ مهم‌ترین قید پروژه: دو نوبت فعال نمی‌توانند هم‌پوشانی زمانی داشته باشند.
  -- بازه نیم‌باز است، پس نوبت‌های پشت‌سرهم مجازند.
  constraint appointments_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed', 'arrived', 'done'))
);

create index appointments_starts_at_idx on public.appointments (starts_at);
create index appointments_status_idx    on public.appointments (status);
create index appointments_patient_idx   on public.appointments (patient_id);

comment on column public.appointments.requester_mobile is
  'A-4 — شمارهٔ تماس این نوبت. برای هر دو source اجباری. یکتا نیست.';

-- ------------------------------------------------ تنظیمات نوبت‌دهی
create table public.working_hours (
  id         uuid primary key default gen_random_uuid(),
  -- Q-1: شنبه = ۰ تا جمعه = ۶. این با EXTRACT(DOW) پستگرس یکی نیست؛
  -- تبدیلش در توابع فایل 0002 انجام می‌شود.
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time     not null,
  end_time   time     not null check (end_time > start_time),
  is_active  boolean  not null default true,
  created_at timestamptz not null default now()
);

create table public.closures (
  id           uuid primary key default gen_random_uuid(),
  closure_date date not null unique,
  reason       text,
  created_by   uuid references public.profiles (user_id),
  created_at   timestamptz not null default now()
);

create table public.app_settings (
  key        text primary key,
  value      text not null,
  updated_by uuid references public.profiles (user_id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- مالی
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid   not null references public.patients (id),
  appointment_id      uuid   references public.appointments (id),
  amount_toman        bigint not null check (amount_toman <> 0),
  payment_method_id   uuid   not null references public.payment_methods (id),
  -- H-1: تصویر لحظهٔ ثبت، نه ارجاع زندهٔ مراجع. اگر بیمهٔ مراجع عوض شود،
  -- گزارش ماه‌های بسته‌شده نباید تغییر کند.
  insurance_type_id   uuid   references public.insurance_types (id),
  paid_at             timestamptz not null,
  recorded_by         uuid   not null references public.profiles (user_id),
  -- هر پرداخت حداکثر یک‌بار معکوس می‌شود
  reverses_payment_id uuid   unique references public.payments (id),
  note                text,
  created_at          timestamptz not null default now()
);

create index payments_paid_at_idx on public.payments (paid_at);
create index payments_patient_idx on public.payments (patient_id);

comment on column public.payments.insurance_type_id is
  'H-1 — تصویر لحظهٔ ثبت. پس از ثبت تغییر نمی‌کند.';

-- ------------------------------------------- سایت، چت‌بات، بازخورد
create table public.faq_items (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  -- H-5: در فرم تنظیمات p3-13 پر می‌شود
  keywords   text[] not null default '{}',
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.site_info (
  key   text primary key,
  value text not null
);

comment on table public.site_info is
  'H-6 — یازده کلید. «کلید خالی» یعنی ردیفش وجود ندارد، نه رشتهٔ خالی.';

create table public.chatbot_unanswered (
  id         uuid primary key default gen_random_uuid(),
  -- H-8: سقف طول، چون از اینترنت و بدون حساب ثبت می‌شود
  question   text not null check (char_length(question) <= 300),
  channel    text not null check (channel in ('site','telegram','bale')),
  created_at timestamptz not null default now()
);

create table public.surveys (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id),
  token          text not null unique,
  score          smallint check (score between 1 and 5),
  -- H-9: سقف طول، چون از اینترنت و بدون حساب ثبت می‌شود
  comment        text check (char_length(comment) <= 1000),
  created_at     timestamptz not null default now(),
  submitted_at   timestamptz
);

-- ---------------------------------------------------------------- ربات
create table public.bot_links (
  id         uuid primary key default gen_random_uuid(),
  platform   text not null check (platform in ('telegram','bale')),
  chat_id    text not null,
  mobile     text not null check (mobile ~ '^09\d{9}$'),
  patient_id uuid references public.patients (id),
  created_at timestamptz not null default now(),
  unique (platform, chat_id)
);

comment on table public.bot_links is
  'M-5 — تطبیق دو مرحله‌ای: اول patients.mobile، اگر نبود appointments.requester_mobile.';

create table public.reminder_log (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id),
  platform       text not null check (platform in ('telegram','bale')),
  sent_at        timestamptz not null default now(),
  result         text not null check (result in ('sent','failed','no_link'))
);

create index reminder_log_appointment_idx on public.reminder_log (appointment_id);
