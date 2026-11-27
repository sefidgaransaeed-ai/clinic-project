import { beforeEach, describe, expect, it, vi } from "vitest";

// ماژول چت‌بات و لایهٔ داده هر دو با شبکه و `server-only` کار می‌کنند؛ این‌جا جعل می‌شوند.
const mocks = vi.hoisted(() => ({
  answerQuestion: vi.fn(),
  findMobileMatch: vi.fn(),
  saveBotLink: vi.fn(),
}));

vi.mock("@/modules/chatbot/data", () => ({ answerQuestion: mocks.answerQuestion }));
vi.mock("./data", () => ({
  findMobileMatch: mocks.findMobileMatch,
  saveBotLink: mocks.saveBotLink,
}));

import { handleUpdate } from "./bot-handler";
import type { BotUpdate } from "./types";

function textUpdate(text: string, chatType = "private"): BotUpdate {
  return {
    update_id: 1,
    message: { message_id: 1, from: { id: 42 }, chat: { id: 42, type: chatType }, text },
  };
}

describe("handleUpdate — پاسخ پرسش‌های پرتکرار", () => {
  beforeEach(() => {
    mocks.answerQuestion.mockReset();
    mocks.findMobileMatch.mockReset();
    mocks.saveBotLink.mockReset();
  });

  it("پاسخ FAQ را با متن پرسش و پاسخ می‌فرستد", async () => {
    mocks.answerQuestion.mockResolvedValue({
      kind: "answers",
      matches: [
        { item: { question: "ساعات کاری؟", answer: "شنبه ۱۴ تا ۱۸." }, score: 6 },
        { item: { question: "آدرس؟", answer: "مرزداران." }, score: 3 },
      ],
    });

    const [message] = await handleUpdate(textUpdate("ساعت کاری"), "telegram");

    expect(mocks.answerQuestion).toHaveBeenCalledWith("ساعت کاری", "telegram");
    expect(message.text).toContain("ساعات کاری؟");
    expect(message.text).toContain("شنبه ۱۴ تا ۱۸.");
    expect(message.text).toContain("آدرس؟");
  });

  it("بیش از دو پاسخ نمی‌فرستد", async () => {
    mocks.answerQuestion.mockResolvedValue({
      kind: "answers",
      matches: [
        { item: { question: "یک؟", answer: "الف." }, score: 9 },
        { item: { question: "دو؟", answer: "ب." }, score: 6 },
        { item: { question: "سه؟", answer: "ج." }, score: 3 },
      ],
    });

    const [message] = await handleUpdate(textUpdate("نوبت"), "telegram");

    expect(message.text).not.toContain("سه؟");
  });

  it("پرسش درمانی را به هشدار پزشکی می‌برد", async () => {
    mocks.answerQuestion.mockResolvedValue({ kind: "medical" });

    const [message] = await handleUpdate(textUpdate("چی بخورم؟"), "telegram");

    expect(message.text).toContain("توصیهٔ پزشکی نمی‌دهد");
  });

  it("احوال‌پرسی را با خوش‌آمد و راهنمایی پاسخ می‌دهد", async () => {
    mocks.answerQuestion.mockResolvedValue({ kind: "greeting" });

    const [message] = await handleUpdate(textUpdate("سلام"), "telegram");

    expect(message.text).toContain("پرسشتان را همین‌جا بنویسید");
  });

  it("پرسش بی‌پاسخ را با پیام تماس پاسخ می‌دهد", async () => {
    mocks.answerQuestion.mockResolvedValue({ kind: "none" });

    const [message] = await handleUpdate(textUpdate("پارکینگ دارید؟"), "telegram");

    expect(message.text).toContain("پاسخ این پرسش را در پرسش‌های پرتکرار پیدا نکردم");
  });

  it("خطای پردازش، پیام امن برمی‌گرداند نه خطای خام", async () => {
    mocks.answerQuestion.mockRejectedValue(new Error("boom"));

    const [message] = await handleUpdate(textUpdate("سلام"), "telegram");

    expect(message.text).toContain("الان نتوانستم پرسشتان را بررسی کنم");
  });

  it("/start متن خوش‌آمد و دکمهٔ شماره می‌دهد", async () => {
    const [message] = await handleUpdate(textUpdate("/start"), "telegram");

    expect(message.text).toContain("به ربات مطب خوش آمدید");
    expect(message.replyMarkup).toMatchObject({ resize_keyboard: true });
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
  });

  it("پیام گروه پاسخ نمی‌گیرد", async () => {
    expect(await handleUpdate(textUpdate("سلام", "group"), "telegram")).toEqual([]);
    expect(mocks.answerQuestion).not.toHaveBeenCalled();
  });
});
