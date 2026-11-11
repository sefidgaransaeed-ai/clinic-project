import { formatAmount } from "../money";

/**
 * مبلغ با واژهٔ «تومان». عدد جدا و چپ‌به‌راست نگه داشته می‌شود تا علامت منفی
 * در متن راست‌چین جابه‌جا نشود: «−۵۰۰٬۰۰۰ تومان».
 */
export function Toman({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <bdi dir="ltr">{formatAmount(amount)}</bdi> تومان
    </span>
  );
}
