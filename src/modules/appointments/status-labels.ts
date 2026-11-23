import type { AppointmentStatus, CancelReason } from "./types";

export const statusLabels: Record<AppointmentStatus, string> = {
  requested: "درخواست جدید",
  confirmed: "تأییدشده",
  arrived: "حاضر شد",
  done: "انجام شد",
  no_show: "غایب",
  cancelled: "لغوشده",
};

/** برچسبِ وضعیت برای نمایش؛ نوبتِ لغوشده‌ای که دلیلش «رد» است «ردشده» دیده می‌شود (تصمیم A-1). */
export function getStatusLabel(status: AppointmentStatus, cancelReason: CancelReason | null): string {
  if (status === "cancelled" && cancelReason === "rejected") {
    return "ردشده";
  }
  return statusLabels[status];
}
