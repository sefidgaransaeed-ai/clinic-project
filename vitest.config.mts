import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * تنظیمات آزمون خودکار پروژه.
 *
 * دو جا آزمون داریم:
 *   src/**  — آزمون واحد کنار خود کد (مثل src/lib/format.test.ts)
 *   tests/** — آزمون‌های الزامی پروژه: tests/access ، tests/appointments ، tests/finance
 */
export default defineConfig({
  test: {
    environment: 'node',
    // آزمون‌های tests/access به کلیدهای .env.local نیاز دارند. vitest خودش
    // فایل .env نمی‌خواند، پس این‌جا صریح بارگذاری می‌شود.
    setupFiles: ['./vitest.setup.mts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // اگر پوشهٔ tests خالی باشد، نبودِ آزمون خطا حساب نشود
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
