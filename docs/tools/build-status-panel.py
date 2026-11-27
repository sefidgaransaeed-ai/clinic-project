# -*- coding: utf-8 -*-
"""پنل وضعیت پروژه را از docs/clinic-execution-guide.html می‌سازد.

اجرا: python docs/tools/build-status-panel.py
خروجی: Clinic-Status-Panel.html در ریشهٔ پروژه

وضعیت هر کار در دیکشنری STATUS است. «تمام» یعنی PR ادغام شده یا کد روی main
هست؛ «نیمه‌کاره» یعنی کد نوشته شده ولی تأیید، اتصال یا آزمون کم است.
"""
import io
import json
import os
import re
import html
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GUIDE = os.path.join(ROOT, "docs", "clinic-execution-guide.html")
OUT = os.path.join(ROOT, "Clinic-Status-Panel.html")

STATUS = {
    'p1-01': ('done', ''),
    'p1-02': ('done', ''),
    'p1-03': ('done', ''),
    'p1-04': ('done', ''),
    'p1-05': ('done', ''),
    'p1-06': ('done', ''),
    'p1-07': ('done', 'PR #3'),
    'p1-08': ('done', 'PR #27'),
    'p1-09': ('done', 'PR #29'),
    'p1-10': ('done', 'PR #30'),
    'p1-11': ('done', 'PR #35'),
    'p1-12': ('done', 'PR #49'),
    'p1-14': ('done', 'ادامه دارد'),
    'p1-15': ('done', 'PR #67 ادغام شد'),
    'p1-16': ('done', 'PR #73 ادغام شد'),
    'p1-17': ('done', 'PR #72 ادغام شد'),
    'p1-18': ('done', 'شواهد استقرار و سناریوی یکپارچه‌سازی تکمیل شد'),
    'p1-19': ('done', 'سناریوی ارائه ۱۰ دقیقه‌ای و README تکمیل شد'),
    'p1-20': ('done', 'تگ v1.0 روی همین کامیت منتشر شد'),

    'p2-01': ('done', ''),
    'p2-02': ('done', ''),
    'p2-03': ('done', ''),
    'p2-04': ('done', 'PR #37'),
    'p2-05': ('done', 'PR #45'),
    'p2-06': ('done', 'PR #51'),
    'p2-07': ('done', 'PR #50'),
    'p2-08': ('done', 'PR #82 ادغام شد'),
    'p2-09': ('done', 'PR #78 ادغام شد'),
    'p2-10': ('done', 'PR #90 ادغام شد — ۳ پاس روی پایگاه واقعی'),
    'p2-11': ('done', 'PR #37'),
    'p2-12': ('done', 'PR #43'),
    'p2-13': ('done', 'PR #43'),
    'p2-14': ('opt', 'اختیاری'),
    'p2-15': ('todo', 'بعد از p2-08 تا p2-10'),

    'p3-01': ('done', ''),
    'p3-02': ('done', ''),
    'p3-03': ('done', ''),
    'p3-04': ('done', 'PR #54'),
    'p3-05': ('done', 'PR #56'),
    'p3-06': ('done', 'PR #61'),
    'p3-07': ('done', 'PR #55'),
    'p3-08': ('done', '۱۹ آزمون روی دیتابیس واقعی'),
    'p3-09': ('done', 'PR #60'),
    'p3-10': ('done', 'PR #68'),
    'p3-11': ('todo', 'بعد از p3-13'),
    'p3-12': ('done', 'PR #34، #58'),
    'p3-13': ('done', 'PR #58'),
}

OWNER = {'1': 'سعید سفیدگران', '2': 'مریم اسماعیلی', '3': 'هستی'}
OWNER_SUB = {
    '1': 'نفر اول — زیرساخت، پنل، چت‌بات',
    '2': 'نفر دوم — نوبت‌ها، مراجعان، ربات',
    '3': 'نفر سوم — سایت، مالی، بازخورد',
}
LABEL = {'done': 'تمام', 'part': 'نیمه‌کاره', 'todo': 'شروع‌نشده', 'opt': 'اختیاری'}

FA_DIGITS = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


def fa(n):
    return str(n).translate(FA_DIGITS)


def load_tasks():
    src = io.open(GUIDE, encoding='utf-8').read()
    tasks = []
    for m in re.finditer(
        r'<article class="task( done)?" id="(p\d-\d\d)"[^>]*>(.*?)</article>', src, re.S
    ):
        body = m.group(3)
        title = re.search(r'<h4>(.*?)</h4>', body, re.S)
        tasks.append({
            'id': m.group(2),
            'title': re.sub(r'\s+', ' ', title.group(1)).strip() if title else '',
        })
    tasks.sort(key=lambda t: (t['id'][1], t['id'][3:]))
    return tasks


def counts(tasks, pfx):
    c = {'done': 0, 'part': 0, 'todo': 0, 'opt': 0}
    for t in tasks:
        if t['id'][1] == pfx:
            c[STATUS[t['id']][0]] += 1
    return c


def render_cards(tasks):
    out = []
    for p in '123':
        c = counts(tasks, p)
        n = sum(c.values())
        items = ''.join(
            '<li><b>%s</b> %s</li>' % (t['id'], html.escape(t['title']))
            for t in tasks
            if t['id'][1] == p and STATUS[t['id']][0] in ('part', 'todo')
        ) or '<li class="none">چیزی باز نمانده</li>'
        out.append(
            '<article class="owner">\n'
            '  <header><div><h3>%s</h3><p>%s</p></div>'
            '<div class="owner-count">%s<small>باز</small></div></header>\n'
            '  <div class="bar" role="img" aria-label="%s کار از %s کامل">\n'
            '    <span style="width:%.1f%%;background:var(--green)"></span>'
            '<span style="width:%.1f%%;background:var(--orange)"></span>'
            '<span style="width:%.1f%%;background:var(--line-strong)"></span>\n'
            '  </div>\n'
            '  <ul>%s</ul>\n'
            '</article>'
            % (OWNER[p], OWNER_SUB[p], fa(c['part'] + c['todo']),
               fa(c['done']), fa(n),
               100.0 * c['done'] / n, 100.0 * c['part'] / n, 100.0 * c['todo'] / n,
               items)
        )
    return '\n'.join(out)


def render_rows(tasks):
    out = []
    for t in tasks:
        st, note = STATUS[t['id']]
        p = t['id'][1]
        out.append(
            '<tr data-p="%s"><td class="id">%s</td><td class="ttl">%s</td>'
            '<td class="own">%s</td><td><span class="chip %s">%s</span></td>'
            '<td class="note">%s</td></tr>'
            % (p, t['id'], html.escape(t['title']), html.escape(OWNER[p].split()[0]),
               st, LABEL[st], html.escape(note))
        )
    return '\n'.join(out)


TEMPLATE = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>وضعیت پروژه هوشمندسازی مطب</title>
<style>
:root{
  --navy:#262261; --indigo:#404099; --orange:#f8941d; --cream:#fffaf3;
  --peach:#fde5c8; --line:#e9e3d8; --line-strong:#cfc8ba;
  --ink:#2b2b2e; --muted:#5f6062; --green:#2f7d5d; --red:#b3261e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--ink);
  font-family:"Vazirmatn","IRANSans","Segoe UI",Tahoma,sans-serif;line-height:1.85;font-size:15px}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px 64px}
.masthead{background:var(--navy);color:#fff;padding:36px 0 28px;margin-bottom:28px}
.masthead .wrap{padding-bottom:0}
.masthead h1{margin:0 0 6px;font-size:26px;font-weight:800}
.masthead p{margin:0;color:#cfcdf0;font-size:14px}
.masthead code{background:rgba(255,255,255,.15);padding:1px 6px;border-radius:5px}
.masthead .meta{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}
.masthead .meta span{background:rgba(255,255,255,.12);border-radius:999px;padding:5px 14px;font-size:13px}
h2{font-size:19px;margin:36px 0 14px;padding-right:12px;border-right:4px solid var(--orange)}
.progress{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px 24px}
.progress .nums{display:flex;gap:26px;flex-wrap:wrap;margin-bottom:14px}
.progress .nums div{font-size:13px;color:var(--muted)}
.progress .nums b{display:block;font-size:26px;color:var(--ink);font-weight:800;line-height:1.3}
.progress .bar{height:14px;border-radius:999px;overflow:hidden;display:flex;background:var(--line)}
.progress .bar span{display:block;height:100%}
.legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:12px;font-size:12.5px;color:var(--muted)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-left:6px}
.blockers{display:grid;gap:12px}
.blocker{background:#fff;border:1px solid var(--line);border-right:4px solid var(--red);border-radius:12px;padding:14px 18px}
.blocker b{display:block;margin-bottom:3px}
.blocker p{margin:0;color:var(--muted);font-size:13.5px}
.blocker code{background:#f4f4f5;padding:1px 5px;border-radius:4px;direction:ltr;display:inline-block}
.owners{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.owner{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px}
.owner header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.owner h3{margin:0;font-size:16px}
.owner header p{margin:2px 0 0;font-size:12.5px;color:var(--muted)}
.owner-count{font-size:26px;font-weight:800;color:var(--orange);line-height:1}
.owner-count small{display:block;font-size:11px;font-weight:400;color:var(--muted)}
.owner .bar{height:9px;border-radius:999px;overflow:hidden;display:flex;background:var(--line);margin:16px 0}
.owner .bar span{display:block;height:100%}
.owner ul{margin:0;padding:0 18px 0 0;font-size:13.5px}
.owner li{margin-bottom:6px;color:var(--muted)}
.owner li b{color:var(--ink);font-family:monospace;direction:ltr;display:inline-block}
.owner li.none{list-style:none;color:var(--green)}
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:14px}
table{width:100%;min-width:620px;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:13.5px}
th,td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--peach);font-weight:700;font-size:13px}
tr:last-child td{border-bottom:0}
td.id{font-family:monospace;direction:ltr;text-align:left;color:var(--indigo);font-weight:700;white-space:nowrap}
td.note{color:var(--muted);font-size:12.5px}
td.own{white-space:nowrap}
.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;white-space:nowrap}
.chip.done{background:#e3f2ea;color:var(--green)}
.chip.part{background:#fdeee0;color:#a85b0c}
.chip.todo{background:#f0efec;color:var(--muted)}
.chip.opt{background:#eaeaf6;color:var(--indigo)}
@media (max-width:520px){
  .wrap{padding:0 14px 48px}
  .masthead h1{font-size:21px}
  .masthead{padding:26px 0 22px}
  .blocker{padding:12px 14px}
  .owner{padding:16px}
  .progress{padding:18px 16px}
  .progress .nums{gap:18px}
}
.foot{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
.foot code{background:#f4f4f5;padding:1px 5px;border-radius:4px}
</style>
</head>
<body>
<div class="masthead"><div class="wrap">
  <h1>وضعیت پروژه — هوشمندسازی مطب</h1>
  <p>گزارش کوتاه برای تیم. هر کار بر پایهٔ شواهد مخزن (PR ادغام‌شده یا کد روی <code>main</code>) علامت خورده.</p>
  <div class="meta"><span>{{TODAY}}</span><span>آخرین کامیت main: {{LAST_COMMIT}}</span><span>{{N}} کار</span><span>کارهای نفر اول تکمیل شد</span></div>
</div></div>

<div class="wrap">

<h2>جمع‌بندی</h2>
<div class="progress">
  <div class="nums">
    <div><b>{{DONE}}</b>تمام</div>
    <div><b>{{PART}}</b>نیمه‌کاره</div>
    <div><b>{{TODO}}</b>شروع‌نشده</div>
    <div><b>{{OPT}}</b>اختیاری</div>
  </div>
  <div class="bar" role="img" aria-label="{{DONE}} کار از {{N}} تمام">
    <span style="width:{{PCT_DONE}}%;background:var(--green)"></span>
    <span style="width:{{PCT_PART}}%;background:var(--orange)"></span>
    <span style="width:{{PCT_REST}}%;background:var(--line-strong)"></span>
  </div>
  <div class="legend">
    <span><i style="background:var(--green)"></i>تمام</span>
    <span><i style="background:var(--orange)"></i>نیمه‌کاره</span>
    <span><i style="background:var(--line-strong)"></i>شروع‌نشده</span>
  </div>
</div>

<h2>وضعیت امروز — آخرین اقدامات باقی‌مانده</h2>
<div class="blockers">
  <div class="blocker" style="border-right-color:var(--green)"><b>آزمون هم‌زمانی نوبت ادغام شد (p2-10)</b>
    <p>PR #90 با آزمون واقعی روی پایگاه داده اجرا و ادغام شد: ۳ پاس و ۱ skip (هیچ تعطیلی فعالی در پایگاه نیست و آزمون عمداً تعطیلی نمی‌سازد).</p></div>
  <div class="blocker" style="border-right-color:var(--green)"><b>عکس‌های واقعی مطب روی سایت آمدند</b>
    <p>PR #92 ادغام شد: پرترهٔ پزشک، پذیرش، اتاق درمان و سه عکس درمانی در صفحهٔ اول، درباره، خدمات و تماس. اجازهٔ انتشار از پزشک گرفته شده و مراجع واقعی در عکس‌ها نیست.</p></div>
  <div class="blocker" style="border-right-color:var(--green)"><b>چت‌بات حالا پاسخ درست می‌دهد</b>
    <p>PR #93: شمارهٔ تلفن غلط در پاسخ «تماس» اصلاح شد؛ کلیدواژه‌های FAQ از دیتابیس به چت‌بات رسید و سؤال‌های رایج (ساعت کاری، آدرس، تعرفه، مترو) پاسخ می‌گیرند؛ هشدار درمانی گسترده شد. با دادهٔ واقعی و روی سایت زنده آزموده شد.</p></div>
  <div class="blocker"><b>ربات تلگرام — کد و زیرساخت آماده، فقط توکن لازم است</b>
    <p>ربات پیش‌تر به هیچ پیامی پاسخ نمی‌داد. حالا به موتور پاسخ چت‌بات وصل است و وب‌هوک امن (۴۰۱ برای رمز نادرست، ۲۰۰ با رمز درست) روی سایت زنده آزموده شد. <code>TELEGRAM_BOT_TOKEN</code> در هیچ‌جا نیست و فقط از BotFather گرفته می‌شود؛ پس از گذاشتنش در <code>.env.local</code> و ورسل، دستور <code>node scripts/set-telegram-webhook.mjs --base https://clinic-project-psi.vercel.app</code> وب‌هوک را ثبت می‌کند.</p></div>
</div>

<h2>هر نفر چه چیزی باز دارد</h2>
<div class="owners">
{{CARDS}}
</div>

<h2>همهٔ کارها</h2>
<div class="tablewrap">
<table>
<thead><tr><th>کار</th><th>عنوان</th><th>صاحب</th><th>وضعیت</th><th>توضیح</th></tr></thead>
<tbody>
{{ROWS}}
</tbody>
</table>
</div>

<div class="foot">
  <p><b>مبنای وضعیت:</b> «تمام» یعنی PR ادغام شده یا کد روی <code>main</code> هست. «نیمه‌کاره» یعنی کد نوشته شده ولی تأیید، اتصال یا آزمون کم است. اگر جایی با واقعیت نمی‌خواند، صاحب همان کار بگوید تا اصلاح شود.</p>
  <p>ساخته‌شده از <code>docs/clinic-execution-guide.html</code> — ۴۷ کار.</p>
</div>
</div>
</body>
</html>
"""


def main():
    tasks = load_tasks()
    missing = [t['id'] for t in tasks if t['id'] not in STATUS]
    extra = [k for k in STATUS if k not in {t['id'] for t in tasks}]
    assert not missing, 'بدون وضعیت: %s' % missing
    assert not extra, 'شناسهٔ ناشناخته در STATUS: %s' % extra

    n = len(tasks)
    total = {'done': 0, 'part': 0, 'todo': 0, 'opt': 0}
    for p in '123':
        for k, v in counts(tasks, p).items():
            total[k] += v
    assert sum(total.values()) == n

    page = TEMPLATE
    try:
        last_commit = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True
        ).strip()
    except Exception:
        last_commit = '—'
    for token, value in [
        ('{{TODAY}}', '۶ آذر ۱۴۰۵'),
        ('{{LAST_COMMIT}}', last_commit),
        ('{{N}}', fa(n)),
        ('{{DONE}}', fa(total['done'])),
        ('{{PART}}', fa(total['part'])),
        ('{{TODO}}', fa(total['todo'])),
        ('{{OPT}}', fa(total['opt'])),
        ('{{PCT_DONE}}', '%.1f' % (100.0 * total['done'] / n)),
        ('{{PCT_PART}}', '%.1f' % (100.0 * total['part'] / n)),
        ('{{PCT_REST}}', '%.1f' % (100.0 * (total['todo'] + total['opt']) / n)),
        ('{{CARDS}}', render_cards(tasks)),
        ('{{ROWS}}', render_rows(tasks)),
    ]:
        page = page.replace(token, value)
    io.open(OUT, 'w', encoding='utf-8', newline='').write(page)
    print('done=%d part=%d todo=%d opt=%d total=%d'
          % (total['done'], total['part'], total['todo'], total['opt'], n))


if __name__ == '__main__':
    main()
