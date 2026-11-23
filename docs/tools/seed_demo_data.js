// docs/tools/seed_demo_data.js
// غنی‌سازی داده‌های نمایشی برای ارائه فردا (نوبت‌های امروز و فردا، پرداخت‌ها و نظرسنجی‌ها)

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("Starting demo seed data enrichment...");

  // ۱. دریافت اطلاعات کلینیک‌ها و بیماران
  const { data: clinics } = await supabase.from('clinics').select('id, name');
  const marzdaran = clinics.find(c => c.name.includes('مرزداران'))?.id || clinics[0].id;
  const zafar = clinics.find(c => c.name.includes('ظفر'))?.id || clinics[1].id;

  const { data: patients } = await supabase.from('patients').select('id, full_name, mobile, national_id, insurance_type_id');
  if (!patients || patients.length === 0) {
    console.error("No patients found in DB!");
    return;
  }

  const { data: profiles } = await supabase.from('profiles').select('user_id, role');
  const doctor = profiles.find(p => p.role === 'doctor') || profiles[0];
  const secretary = profiles.find(p => p.role === 'secretary') || profiles[0];

  const { data: paymentMethods } = await supabase.from('payment_methods').select('id, name');
  const posMethod = paymentMethods.find(m => m.name.includes('کارت‌خوان'))?.id || paymentMethods[0].id;
  const c2cMethod = paymentMethods.find(m => m.name.includes('کارت‌به‌کارت'))?.id || paymentMethods[1].id;

  // ۲. ایجاد نوبت‌های امروز (دوشنبه ۲۳ نوامبر ۲۰۲۶)
  // ساعت‌ها به وقت تهران (UTC+3:30): 15:30 تهران = 12:00 UTC
  const todayTimes = [
    { hour: 15, min: 30, status: 'done', patientIdx: 0 },
    { hour: 16, min: 0, status: 'done', patientIdx: 1 },
    { hour: 16, min: 30, status: 'arrived', patientIdx: 2 },
    { hour: 17, min: 0, status: 'confirmed', patientIdx: 3 },
    { hour: 17, min: 30, status: 'confirmed', patientIdx: 4 },
  ];

  console.log("Checking and inserting appointments for today (2026-11-23)...");
  const insertedTodayAppts = [];

  for (const item of todayTimes) {
    const p = patients[item.patientIdx % patients.length];
    // تهران: ساعت item.hour - 3 و دقیقه item.min - 30 در UTC
    const dateStr = `2026-11-23T${String(item.hour).padStart(2, '0')}:${String(item.min).padStart(2, '0')}:00+03:30`;
    const startsAt = new Date(dateStr).toISOString();
    const endsAt = new Date(new Date(dateStr).getTime() + 15 * 60 * 1000).toISOString();

    // بررسی وجود قبلی
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('starts_at', startsAt)
      .eq('clinic_id', marzdaran);

    if (!existing || existing.length === 0) {
      const { data: inserted, error } = await supabase.from('appointments').insert({
        clinic_id: marzdaran,
        patient_id: p.id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: item.status,
        source: 'panel',
        requester_name: p.full_name,
        requester_mobile: p.mobile || '09120000001',
        requester_national_id: p.national_id,
        requested_for_self: true,
      }).select().single();

      if (error) {
        console.warn(`Could not insert appointment for ${dateStr}:`, error.message);
      } else {
        console.log(`Inserted appointment for today: ${p.full_name} at ${item.hour}:${item.min} (${item.status})`);
        insertedTodayAppts.push(inserted);
      }
    }
  }

  // ۳. ایجاد نوبت‌های فردا (سه‌شنبه ۲۴ نوامبر ۲۰۲۶ - روز کاری رسمی مطب مرزداران)
  console.log("Checking and inserting appointments for tomorrow (2026-11-24)...");
  const tomorrowTimes = [
    { hour: 15, min: 30, status: 'confirmed', patientIdx: 5 },
    { hour: 16, min: 0, status: 'confirmed', patientIdx: 6 },
    { hour: 16, min: 30, status: 'confirmed', patientIdx: 7 },
    { hour: 17, min: 0, status: 'confirmed', patientIdx: 8 },
  ];

  for (const item of tomorrowTimes) {
    const p = patients[item.patientIdx % patients.length];
    const dateStr = `2026-11-24T${String(item.hour).padStart(2, '0')}:${String(item.min).padStart(2, '0')}:00+03:30`;
    const startsAt = new Date(dateStr).toISOString();
    const endsAt = new Date(new Date(dateStr).getTime() + 15 * 60 * 1000).toISOString();

    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('starts_at', startsAt)
      .eq('clinic_id', marzdaran);

    if (!existing || existing.length === 0) {
      const { error } = await supabase.from('appointments').insert({
        clinic_id: marzdaran,
        patient_id: p.id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: item.status,
        source: 'panel',
        requester_name: p.full_name,
        requester_mobile: p.mobile || '09120000006',
        requester_national_id: p.national_id,
        requested_for_self: true,
      });

      if (error) {
        console.warn(`Could not insert tomorrow appointment:`, error.message);
      } else {
        console.log(`Inserted tomorrow appointment: ${p.full_name} at ${item.hour}:${item.min}`);
      }
    }
  }

  // ۴. درخواست‌های جدید از سایت (برای تب «درخواست‌های نوبت»)
  console.log("Ensuring pending site requests exist...");
  const pendingRequests = [
    { name: "سارا حسینی", mobile: "09120000088", nid: "1000000088", dayOffset: 3, hour: 16, min: 0, clinic: marzdaran },
    { name: "داود محمدی", mobile: "09120000089", nid: "1000000089", dayOffset: 4, hour: 15, min: 0, clinic: zafar }
  ];

  for (const req of pendingRequests) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + req.dayOffset);
    const dateKey = targetDate.toISOString().slice(0, 10);
    const dateStr = `${dateKey}T${String(req.hour).padStart(2, '0')}:${String(req.min).padStart(2, '0')}:00+03:30`;
    const startsAt = new Date(dateStr).toISOString();
    const endsAt = new Date(new Date(dateStr).getTime() + 15 * 60 * 1000).toISOString();

    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('requester_national_id', req.nid)
      .eq('status', 'requested');

    if (!existing || existing.length === 0) {
      const { error } = await supabase.from('appointments').insert({
        clinic_id: req.clinic,
        requester_name: req.name,
        requester_mobile: req.mobile,
        requester_national_id: req.nid,
        requested_for_self: true,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'requested',
        source: 'site'
      });
      if (error) console.warn("Could not insert request:", error.message);
      else console.log(`Inserted pending site request for: ${req.name}`);
    }
  }

  // ۵. ثبت پرداخت برای نوبت‌های انجام‌شدهٔ امروز
  console.log("Checking payments for done appointments...");
  const { data: doneAppts } = await supabase
    .from('appointments')
    .select('id, patient_id, starts_at')
    .eq('status', 'done')
    .limit(10);

  if (doneAppts && doneAppts.length > 0) {
    for (let i = 0; i < doneAppts.length; i++) {
      const appt = doneAppts[i];
      const { data: existingPay } = await supabase
        .from('payments')
        .select('id')
        .eq('appointment_id', appt.id);

      if (!existingPay || existingPay.length === 0) {
        const amount = [3500000, 4500000, 5000000, 6000000][i % 4];
        const method = i % 2 === 0 ? posMethod : c2cMethod;
        const p = patients.find(pt => pt.id === appt.patient_id);

        const { error } = await supabase.from('payments').insert({
          appointment_id: appt.id,
          patient_id: appt.patient_id,
          amount_toman: amount,
          payment_method_id: method,
          insurance_type_id: p?.insurance_type_id || null,
          paid_at: appt.starts_at,
          recorded_by: secretary.user_id,
          note: 'پرداخت ویزیت تخصصی و توان‌بخشی — دمو'
        });

        if (error) console.warn(`Could not insert payment:`, error.message);
        else console.log(`Inserted payment of ${amount} Toman for appt ${appt.id.slice(0, 8)}`);
      }
    }
  }

  // ۶. ایجاد نظرسنجی‌های رضایت‌مندی مراجعان
  console.log("Checking surveys for done appointments...");
  const comments = [
    "تشخیص خانم دکتر فوق‌العاده بود. دردهای دیسک گردنم بعد از سال‌ها تسکین پیدا کرد.",
    "محیط بسیار آرام، تمیز و با برخورد محترمانه کادر مطب.",
    "نوار عصب و عضله با دقت و بدون معطلی انجام شد. متشکرم.",
    "تزریق مفصل زانو عالی بود و احساس بهبودی زیادی دارم.",
    "وقت‌شناسی مطب و پاسخگویی منظم منشی بسیار عالی بود.",
    "رویکرد غیرجراحی و تمرین‌های اصلاحی که دادند واقعاً مؤثر بود.",
    "بهترین متخصص طب فیزیکی که تا حالا مراجعه کردم.",
    "خیلی راضی بودم، ان‌شاءالله دوره درمانم رو کامل پیش ایشون انجام میدم."
  ];

  const { data: allDoneAppts } = await supabase
    .from('appointments')
    .select('id, starts_at')
    .eq('status', 'done');

  if (allDoneAppts && allDoneAppts.length > 0) {
    for (let i = 0; i < allDoneAppts.length; i++) {
      const appt = allDoneAppts[i];
      const { data: existingSurvey } = await supabase
        .from('surveys')
        .select('id')
        .eq('appointment_id', appt.id);

      if (!existingSurvey || existingSurvey.length === 0) {
        const score = i % 6 === 0 ? 4 : 5; // بیشتر امتیاز ۵ و چند تا ۴
        const comment = comments[i % comments.length];
        const token = crypto.randomBytes(16).toString('hex');
        const submittedAt = new Date(new Date(appt.starts_at).getTime() + 2 * 3600 * 1000).toISOString();

        const { error } = await supabase.from('surveys').insert({
          appointment_id: appt.id,
          token: token,
          score: score,
          comment: comment,
          created_at: appt.starts_at,
          submitted_at: submittedAt
        });

        if (error) console.warn("Could not insert survey:", error.message);
        else console.log(`Inserted survey (score ${score}) for appt ${appt.id.slice(0, 8)}`);
      }
    }
  }

  console.log("Demo seed enrichment completed successfully!");
}

main().catch(err => {
  console.error("Error in demo seed enrichment:", err);
  process.exit(1);
});
