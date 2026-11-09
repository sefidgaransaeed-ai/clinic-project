import type { AppRole } from '@/lib/panel-routes';

/**
 * نوع‌های مشترک ماژول کاربران.
 *
 * چرا جدا از `data.ts`: آن فایل `import 'server-only'` دارد، پس کامپوننت
 * سمت مرورگر نمی‌تواند حتی **نوع** را از آن بیاورد. این فایل هیچ وابستگی
 * سروری ندارد و هر دو طرف می‌توانند بخوانندش.
 */
export type PanelAccount = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};
