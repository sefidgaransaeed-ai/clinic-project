"use client";

import { useRef, useState, useTransition } from "react";
import { ask } from "./actions";

/**
 * ویجت شناور «سؤال دارید؟» (کار p1-15، گام‌های ۲ و ۳).
 *
 * ⚠️ این کامپوننت در ماژول chatbot است، نه در پوشهٔ سایت — طبق راهنما، قرار دادنش در
 * چیدمان سایت کار خانم هستی (صاحب `src/modules/site`) است. او فقط یک خط
 * `<ChatWidget phone={...} />` در چیدمان اضافه می‌کند.
 *
 * گفت‌وگو: حباب پرسش کاربر و پاسخ در تاریخچه می‌مانند، همان پرسش آخر به‌عنوان زمینهٔ
 * سؤال کوتاه بعدی («ساعتش چنده؟») به سرور می‌رود. متن پاسخ‌ها از پایگاه داده می‌آید
 * و در سرور با دادهٔ زندهٔ مطب پر می‌شود (مهاجرت ۲۱)؛ این‌جا هیچ متنی تولید نمی‌شود
 * (بند ۹ CLAUDE.md).
 *
 * هیچ حالت خطا به کاربر کد یا متن انگلیسی نشان نمی‌دهد؛ همیشه راه تماس هست.
 */

type Answer = Awaited<ReturnType<typeof ask>>;

const WARNING = "این دستیار فقط به پرسش‌های عمومی پاسخ می‌دهد و توصیهٔ پزشکی نمی‌دهد.";
const NOT_FOUND = "پاسخ این پرسش را در پاسخ‌های تأییدشدهٔ مطب پیدا نکردم.";
const MEDICAL = "این پرسش درمانی است و من نمی‌توانم پاسخی بدهم؛ لطفاً با مطب تماس بگیرید.";
const GREETING = "سلام، خوش آمدید 🌸 پرسشتان را بنویسید؛ دربارهٔ ساعت کاری، آدرس، تعرفه، نوبت و خدمات مطب راهنمایی می‌کنم.";

const QUICK_QUESTIONS = ["ساعت کاری مطب", "آدرس مطب", "گرفتن نوبت", "هزینه ویزیت"];

type Turn = { question: string; answer: Answer };

export function ChatWidget({ phone, clinicName }: { phone?: string; clinicName?: string }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;

  function scrollToEnd() {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  function handleAskText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    // زمینه: آخرین پرسشی که پاسخ گرفته (نه پرسش بی‌پاسخ)، تا «ساعتش چنده؟» به همان موضوع بچسبد.
    const previous = turns.at(-1)?.question;
    setError(null);
    setPendingQuestion(trimmed);
    setQuestion("");
    scrollToEnd();
    startTransition(async () => {
      const answer = await ask(trimmed, previous);
      setTurns((current) => [...current, { question: trimmed, answer }]);
      if (!answer.ok) setError(answer.message);
      setPendingQuestion(null);
      scrollToEnd();
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    handleAskText(question);
  }

  function quickAsk(text: string) {
    handleAskText(text);
  }

  function reset() {
    setQuestion("");
    setTurns([]);
    setPendingQuestion(null);
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
          className="flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-2xl border border-[#e2d6c4] bg-white shadow-2xl"
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

          <div ref={listRef} aria-live="polite" className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto p-3">
            {turns.length === 0 && !pendingQuestion && (
              <div className="space-y-2">
                <p className="text-xs leading-6 text-[#2b2b2e]">{GREETING}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => quickAsk(q)}
                      className="rounded-full border border-[#e2d6c4] bg-[#f9f9fb] px-2.5 py-1 text-[11px] font-medium text-[#262261] transition hover:border-[#404099] hover:bg-[#edeef7]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, index) => (
              <div key={`${turn.question}-${index}`} className="space-y-2">
                <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#262261] px-3 py-2 text-xs leading-6 text-white">
                  {turn.question}
                </p>
                <AnswerBubble answer={turn.answer} telHref={telHref} />
              </div>
            ))}

            {pendingQuestion && (
              <div className="space-y-2">
                <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#262261] px-3 py-2 text-xs leading-6 text-white">
                  {pendingQuestion}
                </p>
                <p className="w-fit rounded-2xl rounded-bl-sm bg-[#f4f4f5] px-3 py-2 text-xs text-[#5f6062]">
                  در حال بررسی…
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-[#e6e7e8] p-3">
            {error && (
              <p role="alert" className="rounded-lg bg-[#fdecea] p-2.5 text-xs text-[#b42318]">
                {error}
              </p>
            )}

            <form onSubmit={submit} className="space-y-2">
              <label htmlFor="chat-question" className="block text-xs font-bold text-[#5f6062]">
                پرسشتان را بنویسید
              </label>
              <textarea
                id="chat-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleAskText(question);
                  }
                }}
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded-lg border border-[#e2d6c4] p-2.5 text-sm text-[#2b2b2e] outline-none focus:border-[#404099]"
                placeholder="مثلاً: ساعت کاری مطب چه زمانی است؟"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending || !question.trim()}
                  className="flex-1 rounded-lg bg-[#f8941d] px-4 py-2 text-sm font-bold text-[#262261] transition hover:brightness-95 disabled:opacity-50"
                >
                  {pending ? "در حال بررسی…" : "بپرسید"}
                </button>
                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg border border-[#e2d6c4] px-3 py-2 text-xs text-[#5f6062] transition hover:border-[#404099]"
                  >
                    گفتگوی تازه
                  </button>
                )}
              </div>
            </form>

            <p className="text-[11px] leading-5 text-[#5f6062]">{WARNING}</p>
          </div>
        </section>
      )}
    </div>
  );
}

/** یک پاسخ: پاسخ‌های تأییدشده با لینک، هشدار درمانی، خوش‌آمد یا «پیدا نشد». */
function AnswerBubble({ answer, telHref }: { answer: Answer; telHref?: string }) {
  if (!answer.ok) {
    return (
      <p role="alert" className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-[#fdecea] px-3 py-2 text-xs leading-6 text-[#b42318]">
        {answer.message}
      </p>
    );
  }

  if (answer.answer.kind === "greeting") {
    return (
      <p className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-[#f0f4ff] px-3 py-2 text-xs leading-6 text-[#2b2b2e]">
        {GREETING}
      </p>
    );
  }

  if (answer.answer.kind === "medical") {
    return (
      <div className="w-fit max-w-[92%] space-y-1.5 rounded-2xl rounded-bl-sm bg-[#fdecea] px-3 py-2 text-xs leading-6 text-[#b42318]">
        <p>{MEDICAL}</p>
        {telHref && (
          <a href={telHref} className="block font-bold text-[#262261] underline">
            تماس با مطب
          </a>
        )}
      </div>
    );
  }

  if (answer.answer.kind === "none") {
    return (
      <div className="w-fit max-w-[92%] space-y-1.5 rounded-2xl rounded-bl-sm bg-[#fdf0dc] px-3 py-2 text-xs leading-6 text-[#2b2b2e]">
        <p>{NOT_FOUND} پرسشتان ثبت شد تا مطب ببیند.</p>
        {telHref && (
          <a href={telHref} className="block font-bold text-[#262261] underline">
            تماس با مطب
          </a>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {answer.answer.matches.map(({ item }, index) => (
        <li
          key={`${item.question}-${index}`}
          className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm bg-[#f4f4f5] px-3 py-2"
        >
          <p className="text-xs font-bold text-[#262261]">{item.question}</p>
          <p className="mt-1 whitespace-pre-line text-xs leading-6 text-[#2b2b2e]">{item.answer}</p>
          {item.linkHref && item.linkLabel ? (
            <a
              href={item.linkHref}
              className="mt-1.5 inline-block text-xs font-bold text-[#262261] underline underline-offset-2"
            >
              {item.linkLabel} ←
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
