-- پاسخ صریح پرسش پارکینگ — ۶ آذر ۱۴۰۵
--
-- چرا: «پارکینگ» در مهاجرت ۱۹ کلیدواژهٔ پرسش «آدرس مطب» شد و پرسش «پارکینگ داره؟»
-- پاسخ نشانی می‌گرفت، نه پاسخ خودِ پرسش. اطلاعات پارکینگ در دادهٔ مطب نیست؛ پس پاسخ
-- تأییدشده صادقانه به تماس ارجاع می‌دهد و هیچ ادعایی دربارهٔ وجود پارکینگ نمی‌کند.
--
-- همان متن در supabase/seed.sql هم هست.

update public.faq_items
set keywords = array(select k from unnest(keywords) as k where k <> 'پارکینگ')
where question = 'آدرس مطب کجاست؟';

insert into public.faq_items (question, answer, keywords, sort_order)
select 'پارکینگ دارید؟',
       'اطلاعات پارکینگ در سایت ثبت نشده است؛ برای راهنمایی دربارهٔ پارکینگ نزدیک مطب با شمارهٔ {{phone}} تماس بگیرید.',
       array['پارکینگ', 'پارک', 'ماشین', 'خودرو', 'محوطه'],
       12
where not exists (select 1 from public.faq_items where question = 'پارکینگ دارید؟');
