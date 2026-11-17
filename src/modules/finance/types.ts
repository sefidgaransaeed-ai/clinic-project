/**
 * شکل داده‌های ماژول مالی، طبق docs/data-model.md بخش ۶.
 * نام ستون‌های پایگاه داده snake_case است و اینجا camelCase؛ تبدیل در data.ts انجام می‌شود.
 */

/** نقش کاربر پنل — همان مقدارهای profiles.role */
export type Role = "doctor" | "secretary";

/** فقط ستون‌هایی از profiles که این ماژول لازم دارد */
export type Profile = {
  userId: string;
  fullName: string;
  role: Role;
};

/** یک ردیف از insurance_types یا payment_methods */
export type Option = {
  id: string;
  name: string;
  isActive: boolean;
};

/** فقط ستون‌هایی از patients که این ماژول لازم دارد */
export type Patient = {
  id: string;
  fullName: string;
  mobile: string | null;
  insuranceTypeId: string | null;
};

/** فقط ستون‌هایی از appointments که فرم پرداخت لازم دارد */
export type Appointment = {
  id: string;
  patientId: string;
  startsAt: string;
  status: "requested" | "confirmed" | "arrived" | "done" | "no_show" | "cancelled";
};

/** یک ردیف از payments. ویرایش و حذف ندارد؛ اصلاح فقط با ردیف معکوس */
export type Payment = {
  id: string;
  patientId: string;
  appointmentId: string | null;
  /** تومان، عدد صحیح؛ ردیف معکوس منفی است */
  amountToman: number;
  paymentMethodId: string;
  /** تصویر لحظهٔ ثبت از بیمهٔ مراجع (تصمیم H-1)، نه ارجاع زنده */
  insuranceTypeId: string | null;
  /** زمان پرداخت، UTC */
  paidAt: string;
  recordedBy: string;
  reversesPaymentId: string | null;
  note: string | null;
  createdAt: string;
};

/** همهٔ داده‌ای که صفحهٔ پرداخت‌ها لازم دارد */
export type FinanceData = {
  profiles: Profile[];
  patients: Patient[];
  appointments: Appointment[];
  paymentMethods: Option[];
  insuranceTypes: Option[];
  payments: Payment[];
};
