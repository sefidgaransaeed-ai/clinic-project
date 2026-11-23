"use client";

import { useState, useTransition } from "react";
import { ask } from "./actions";

/**
 * ویجت شناور «سؤال دارید؟» (کار p1-15، گام‌های ۲ و ۳).
 *
 * ⚠️ این کامپوننت در ماژول chatbot است، نه در پوشهٔ سایت — طبق راهنما، قرار دادنش در
 * چیدمان سایت کار خانم هستی (صاحب `src/modules/site`) است. او فقط یک خط
 * `<ChatWidget phone={...} />` در چیدمان اضافه می‌کند.
 *
 * حالت‌ها: بسته ← باز و خالی ← در حال جست‌وجو ← پاسخ‌ها / «پیدا نشد» / «سؤال درمانی».
 * هیچ حالت خطا به کاربر کد یا متن انگلیسی نشان نمی‌دهد؛ همیشه راه تماس هست.
 */

type Answer = Awaited<ReturnType<typeof ask>>;

const WARNING = "این دستیار فقط به پرسش‌های عمومی پاسخ می‌دهد و توصیهٔ پزشکی نمی‌دهد.";
const NOT_FOUND = "پاسخی پیدا نشد؛ لطفاً با مطب تماس بگیرید.";
const MEDICAL = "این پرسش درمانی است و من نمی‌توانم پاسخی بدهم؛ لطفاً با مطب تماس بگیرید.";

export function ChatWidget({ phone, clinicName }: { phone?: string; clinicName?: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const answer = await ask(question);
      setResult(answer);
      if (!answer.ok) setError(answer.message);
    });
  }

  function reset() {
    setQuestion("");
    setResult(null);
    setError(null);
  }

  return (
    <div dir="rtl" className="fixed bottom-5 right-5 z-50 text-right">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[#262261] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#404099] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f8941d]"
          aria-label="سؤال دارید؟ باز کردن دستیار پرسش‌ها"
        >
          سؤال دارید؟
        </button>
      )}

      {open && (
        <section
          aria-label="دستیار پرسش‌های پرتکرار"
          className="w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[#e2d6c4] bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 bg-[#262261] px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-bold">دستیار پرسش‌ها</h2>
              {clinicName && <p className="mt-0.5 text-[11px] opacity-80">{clinicName}</p>}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-lg leading-none transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="بستن دستیار"
            >
              ×
            </button>
          </header>

          <div className="space-y-3 p-4">
            <form onSubmit={submit} className="space-y-2">
              <label htmlFor="chat-question" className="block text-xs font-bold text-[#5f6062]">
                پرسشتان را بنویسید
              </label>
              <textarea
                id="chat-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                maxLength={300}
                className="w-full resize-none rounded-lg border border-[#e2d6c4] p-2.5 text-sm text-[#2b2b2e] outline-none focus:border-[#404099]"
                placeholder="مثلاً: ساعت کاری مطب چه زمانی است؟"
              />
              <button
                type="submit"
                disabled={pending || !question.trim()}
                className="w-full rounded-lg bg-[#f8941d] px-4 py-2 text-sm font-bold text-[#262261] transition hover:brightness-95 disabled:opacity-50"
              >
                {pending ? "در حال جست‌وجو…" : "بپرسید"}
              </button>
            </form>

            {error && (
              <p role="alert" className="rounded-lg bg-[#fdecea] p-2.5 text-xs text-[#b42318]">
                {error}
              </p>
            )}

            {result?.ok && result.answer.kind === "answers" && (
              <ul className="space-y-2.5">
                {result.answer.matches.map(({ item }) => (
                  <li key={item.question} className="rounded-lg border border-[#e6e7e8] bg-[#f4f4f5] p-2.5">
                    <p className="text-xs font-bold text-[#262261]">{item.question}</p>
                    <p className="mt-1 text-xs leading-6 text-[#2b2b2e]">{item.answer}</p>
                  </li>
                ))}
              </ul>
            )}

            {result?.ok && result.answer.kind === "none" && (
              <div className="space-y-2 rounded-lg bg-[#fdf0dc] p-2.5">
                <p className="text-xs leading-6 text-[#2b2b2e]">{NOT_FOUND}</p>
                <a href={telHref} className="block text-xs font-bold text-[#262261] underline">
                  تماس با مطب
                </a>
              </div>
            )}

            {result?.ok && result.answer.kind === "medical" && (
              <div className="space-y-2 rounded-lg bg-[#fdecea] p-2.5">
                <p className="text-xs leading-6 text-[#b42318]">{MEDICAL}</p>
                <a href={telHref} className="block text-xs font-bold text-[#262261] underline">
                  تماس با مطب
                </a>
              </div>
            )}

            {result && (
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-lg border border-[#e2d6c4] px-3 py-1.5 text-xs text-[#5f6062] transition hover:border-[#404099]"
              >
                پرسش تازه
              </button>
            )}

            <p className="border-t border-[#e6e7e8] pt-2.5 text-[11px] leading-5 text-[#5f6062]">
              {WARNING}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
