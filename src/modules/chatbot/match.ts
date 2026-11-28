/**
 * تطبیق پرسش کاربر با پرسش‌های پرتکرار (کار p1-15).
 *
 * بدون مدل هوش مصنوعی و بدون هیچ API بیرونی (CLAUDE.md بند ۹). فقط نرمال‌سازی متن
 * فارسی و شمارش هم‌پوشانی واژه‌ها.
 *
 * این فایل عمداً هیچ import ای از Next.js یا Supabase ندارد، تا ماژول notifications
 * (ربات نفر دوم) بتواند مستقیم `matchFaq` را import کند بدون اینکه چرخهٔ وابستگی بسازد.
 */

/** کمترین شکل پرسش برای تطبیق؛ با FaqItem و PublicFaq هر دو می‌خواند */
export type FaqSource = {
  question: string;
  answer: string;
  /** کلیدواژه‌های صریح پزشک؛ ارجحیت دارند بر هم‌پوشانی واژه‌های خودِ متن پرسش */
  keywords?: readonly string[];
};

export type FaqMatch<T extends FaqSource = FaqSource> = {
  item: T;
  score: number;
};

/** حداکثر پاسخ‌هایی که ویجت نشان می‌دهد (راهنمای p1-15، گام ۲) */
export const MAX_MATCHES = 3;

/**
 * آستانهٔ امتیاز برای «پاسخ پیدا شد».
 *
 * هر واژهٔ مشترک ۲ امتیاز و هر کلیدواژهٔ صریح ۳ امتیاز دارد. با آستانهٔ ۳، یک
 * کلیدواژهٔ دقیق کافی است و دو واژهٔ مشترک هم کافی است؛ ولی یک واژهٔ عام تنها
 * («مطب»، «هزینه») پاسخ نمی‌دهد.
 */
export const MIN_SCORE = 3;

/**
 * پاسخ‌هایی که کمتر از این نسبت از امتیاز بهترین پاسخ را دارند نمایش داده نمی‌شوند.
 * با ۰٫۵، هر پاسخ باید دست‌کم نصف بهترین را داشته باشد؛ یک واژهٔ عمومی تنها حذف می‌شود.
 */
const RELATIVE_CUTOFF = 0.5;

/** واژه‌های عمومی که اگر تنها باشند پاسخ نمی‌دهند */
const STOP_WORDS = new Set([
  "و", "با", "به", "از", "در", "که", "را", "این", "آن", "برای", "تا", "هر",
  "یا", "هم", "چه", "چی", "چطور", "چگونه", "آیا", "است", "هست", "بود", "می",
  // جمع و پسوندهایی که نرمال‌سازی به‌صورت واژهٔ جدا می‌شکند («ساعت‌ها» → «ساعت ها»)
  "ها", "های", "هایی",
]);

/**
 * نرمال‌سازی متن فارسی برای مقایسه.
 *
 * ي و ك عربی به فارسی، ارقام عربی و فارسی به لاتین، نیم‌فاصله و انواع فاصله به
 * فاصلهٔ یگانه، حذف علائم و اعراب. چهارده‌نگاری حذف می‌شود تا نمایشگرها و
 * فاصله‌های نامرئی تطبیق را نشکنند.
 */
export function normalizePersian(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[يی]/g, "ی") // ي عربی و ی
    .replace(/[كک]/g, "ک") // ك عربی و ک
    .replace(/[أإآ]/g, "ا") // أ إ آ
    .replace(/[ة]/g, "ه")
    .replace(/[ؤ]/g, "و")
    .replace(/[ـ]/g, "") // کشیده
    .replace(/[ً-ٰٟ]/g, "") // اعراب
    // نیم‌فاصله و اتصال‌دهنده پیش از حذف کاراکترهای نامرئی به فاصله تبدیل می‌شوند؛ وگرنه
    // همان خط بعدی آن‌ها را پاک می‌کرد و «می‌روم» به «میروم» می‌رسید.
    .replace(/[‌‍]/g, " ") // نیم‌فاصله و ZWJ
    .replace(/[​‎‏‪-‮⁦-⁩]/g, "") // فاصلهٔ نامرئی و کنترل جهت
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ارقام عربی
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ارقام فارسی
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // علائم
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** واژه‌های معنادار متن با حذف تک‌حرفی‌ها و واژه‌های عمومی */
export function contentWords(input: string): string[] {
  return normalizePersian(input)
    .split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * پسوندهای رایج جمع و مالکیتی. حذفشان باعث می‌شود «ساعت کاریتون» با «ساعات کاری» بخواند
 * و تطبیق به شکل دقیق واژه وابسته نباشد. حداکثر دو پسوند پشت‌سرهم برداشته می‌شود.
 */
const STEM_SUFFIXES = ["هایی", "های", "تان", "تون", "شون", "مان", "مون", "ها", "ای", "ی"] as const;

/**
 * واژه‌هایی که حذف پسوند جوابشان نمی‌دهد و باید صریح نگاشت شوند.
 * «ساعات» جمعِ «ساعت» است، ولی پسوندی مثل «ات» ندارد که بشود برداشت.
 */
const WORD_ALIASES: Record<string, string> = {
  ساعات: "ساعت",
  ساعتها: "ساعت",
  دقایق: "دقیقه",
  شمارتون: "شماره",
  شمارشون: "شماره",
};

/** ریشهٔ تقریبی واژه برای مقایسه؛ رشتهٔ ورودی باید نرمال‌شده باشد. */
export function stemWord(word: string): string {
  let stem = WORD_ALIASES[word] ?? word;
  for (let pass = 0; pass < 2; pass += 1) {
    const suffix = STEM_SUFFIXES.find((candidate) => stem.length > candidate.length + 2 && stem.endsWith(candidate));
    if (!suffix) break;
    stem = stem.slice(0, -suffix.length);
  }
  return stem;
}

/** واژه‌های معنادار به شکل ریشه، برای مقایسه. */
function stemSet(words: readonly string[]): Set<string> {
  return new Set(words.map(stemWord));
}

/**
 * متن پرسش کاربر «درخواست توصیهٔ پزشکی» است یا نه (راهنمای p1-15، گام ۳).
 *
 * ⚠️ این فهرست عمداً ساده و محافظه‌کارانه است. هدف تشخیص قطعی نیست؛ هدف این است که
 * وقتی کاربر نشانهٔ روشن سؤال درمانی دارد، چت‌بات به‌جای پاسخ عمومی، هشدار و شمارهٔ
 * مطب بدهد. اگر اینجا تشخیص داده نشود، پاسخ عمومی FAQ نمایش داده می‌شود که خودش
 * بند هشدار را همیشه همراه دارد.
 */
const MEDICAL_INTENT = [
  "درد شدید", "درد شدیدی", "خیلی درد", "کدام دارو", "چه دارو", "چه قرص",
  "چه دوزی", "چند بسته", "تشخیص", "تشخیصم", "بیماری من", "درمان من",
  "نسخه", "تجویز", "عمل جراحی کنم", "جراحی کنم", "خونریزی", "بی‌حسی",
  "چی بخورم", "چه بخورم", "بخورم", "دارو", "قرص", "آمپول", "دوز",
  "علائم من", "نشانه", "درمان من", "بیماری من", "آزمایش من", "عکس رادیولوژی",
  "مورمور", "فلج", "سرطان", "ام‌آر‌آی", "MRI", "سی‌تی", "نتیجهٔ آزمایش",
];

export function looksMedical(input: string): boolean {
  const text = normalizePersian(input);
  return MEDICAL_INTENT.some((phrase) => text.includes(normalizePersian(phrase)));
}

/** واژه‌ها و عبارات احوال‌پرسی و تعارف در زبان فارسی */
const GREETING_WORDS = new Set([
  "سلام", "درود", "صبح", "عصر", "شب", "روز", "بخیر", "خسته", "نباشید",
  "نباشی", "قوت", "خداقوت", "احوال", "حال", "شما", "چطوری", "چطورید", "خوبی",
  // «وقت» و «دکتر» عمداً نیستند: «وقت دکتر» درخواست نوبت است، نه سلام. تعارف واقعی
  // (مثل «وقت بخیر») از فهرست عبارت‌ها تشخیص داده می‌شود.
  "خوبید", "عزیز", "منشی", "خانم", "اقا", "آقا", "علیک", "علیکم",
  "یاعلی", "عرض", "ادب", "احترام", "سلامت", "باشید", "روزتون", "شبتون", "وقتتون"
]);

/**
 * واژه‌هایی که نشان می‌دهند متن واقعاً پرسش است، نه فقط تعارف. «دکتر خانم هست؟»
 * با «دکتر» و «خانم» در فهرست تعارف بود و به‌اشتباه احوال‌پرسی حساب می‌شد.
 */
const QUESTION_MARKERS = new Set([
  "آیا", "کجا", "کجاست", "چند", "چقدر", "چنده", "چیه", "کی", "هست", "هستید",
  "دارید", "دارین", "کنید", "کنم", "میشه", "میشود", "میدید", "بگیرم", "میخوام", "می‌خواهم",
]);

const GREETING_PHRASES = [
  "سلام", "درود", "صبح بخیر", "عصر بخیر", "شب بخیر", "روز بخیر", "وقت بخیر",
  "خسته نباشید", "خدا قوت", "احوال شما", "حال شما", "چطوری", "چطورید", "خوبی", "خوبید",
  "سلام علیکم", "روزتون بخیر", "وقتتون بخیر", "یا علی"
];

/**
 * آیا متن کاربر صرفاً یک احوال‌پرسی یا تعارف مودبانه است؟
 * در این حالت به جای خطا یا سکوت، دستیار پاسخ خوش‌آمدگویی و راهنمایی اولیه ارائه می‌دهد.
 */
export function looksGreeting(input: string): boolean {
  const norm = normalizePersian(input);
  if (!norm) return false;

  const words = contentWords(input);
  // پرسش واقعی هرگز احوال‌پرسی نیست: «دکتر خانم هست؟» سؤال است، نه سلام.
  // واژه‌های پرسشی مثل «هست» و «آیا» در فهرست واژه‌های عمومی‌اند و از contentWords
  // می‌افتند، پس این‌جا روی همهٔ واژه‌های نرمال‌شده سنجیده می‌شود.
  if (norm.split(" ").some((word) => QUESTION_MARKERS.has(word))) return false;
  if (words.length === 0) {
    return GREETING_PHRASES.some((phrase) => norm.includes(normalizePersian(phrase)));
  }

  // اگر تمام کلمات جزء کلمات احوال‌پرسی و ادب باشند
  const nonGreeting = words.filter((w) => !GREETING_WORDS.has(w));
  if (nonGreeting.length === 0) return true;

  // اگر پرسش بسیار کوتاه (حداکثر ۳ کلمه) باشد و با سلام یا درود شروع شده و سوال درمانی نباشد
  if (words.length <= 3 && nonGreeting.length <= 1 && !looksMedical(input)) {
    return GREETING_PHRASES.some((phrase) => norm.includes(normalizePersian(phrase)));
  }

  return false;
}

/**
 * تطبیق یک پرسش کاربر با فهرست پرسش‌های پرتکرار.
 *
 * امتیاز هر مورد:
 *   - هر کلیدواژهٔ صریحِ پزشک که در متن کاربر هست: ۳
 *   - هر واژهٔ مشترک با متن خود پرسش (عنوان): ۳
 *   - هر واژهٔ مشترک با متن پاسخ: ۲
 * مواردی با امتیاز کمتر از MIN_SCORE حذف می‌شوند، بر اساس امتیاز نزولی مرتب
 * می‌شوند و حداکثر MAX_MATCHES مورد برمی‌گردد. در تساوی، ترتیب ورودی حفظ می‌شود.
 */
export function matchFaq<T extends FaqSource>(
  question: string,
  faqItems: readonly T[],
  options: { max?: number; minScore?: number } = {},
): FaqMatch<T>[] {
  const max = options.max ?? MAX_MATCHES;
  const minScore = options.minScore ?? MIN_SCORE;

  const normalizedQuestion = normalizePersian(question);
  if (!normalizedQuestion) return [];

  const questionWords = new Set(contentWords(question));
  if (questionWords.size === 0) return [];
  // ریشه‌ها: «ساعت کاریتون» با «ساعات کاری» بخواند (نه تطبیق تحت‌اللفظی).
  const questionStems = stemSet([...questionWords]);

  const scored: { item: T; score: number; order: number }[] = [];

  faqItems.forEach((item, order) => {
    let score = 0;

    for (const keyword of item.keywords ?? []) {
      const parts = contentWords(keyword);
      if (parts.length === 0) continue;
      // کلیدواژهٔ چندواژه‌ای باید کامل در متن باشد؛ تک‌واژه با هم‌پوشانی کافی است
      const hit =
        parts.length > 1
          ? parts.every((part) => questionStems.has(stemWord(part)))
          : questionStems.has(stemWord(parts[0]));
      if (hit) score += 3;
    }

    const questionTextStems = stemSet(contentWords(item.question));
    const answerTextStems = stemSet(contentWords(item.answer));

    let qShared = 0;
    for (const stem of questionStems) {
      if (questionTextStems.has(stem)) qShared += 1;
    }
    score += qShared * 3;

    let aShared = 0;
    for (const stem of questionStems) {
      if (answerTextStems.has(stem) && !questionTextStems.has(stem)) aShared += 1;
    }
    score += aShared * 2;

    if (score >= minScore) scored.push({ item, score, order });
  });

  scored.sort((a, b) => (b.score - a.score) || (a.order - b.order));

  // آستانهٔ نسبی: پاسخ‌هایی که به‌وضوح از بهترین ضعیف‌ترند نمایش داده نمی‌شوند.
  // «ساعت کاری» با ۱۵ امتیاز نباید «گرفتن نوبت» با ۳ امتیاز را هم کنارش نشان دهد؛
  // ولی «لغو نوبت» که دو پاسخ هم‌امتیاز دارد هر دو را نگه می‌دارد.
  const top = scored[0]?.score ?? 0;
  const cutoff = top * RELATIVE_CUTOFF;
  const relevant = scored.filter((entry) => entry.score >= cutoff);

  return relevant.slice(0, max).map(({ item, score }) => ({ item, score }));
}
