"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { navLinks } from "../copy";

/**
 * پیوندهای منوی سرصفحه؛ صفحهٔ فعلی با یک مهرهٔ نارنجی زیرش مشخص می‌شود.
 *
 * نشانی صفحه داخل Suspense خوانده می‌شود. صفحه‌ای که نشانی‌اش هنگام ساخت معلوم نیست (مثل
 * /nazar/[token]) بدون آن نمی‌تواند پیش‌ساخته شود؛ آنجا منو اول بی‌مهره می‌آید و بعد کامل می‌شود.
 * در صفحه‌های دیگر نشانی هنگام ساخت معلوم است و فرقی نمی‌کند.
 */
export function NavLinks() {
  return (
    <Suspense fallback={<LinkList pathname={null} />}>
      <ActiveNavLinks />
    </Suspense>
  );
}

function ActiveNavLinks() {
  return <LinkList pathname={usePathname()} />;
}

function LinkList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex items-center gap-1">
      {navLinks.map((link) => {
        const active = pathname !== null && (pathname === link.href || pathname.startsWith(`${link.href}/`));
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`relative block rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-white lg:px-4 ${
                active ? "font-bold text-white" : "font-medium text-white/75 hover:text-white"
              }`}
            >
              {link.label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-1/3 bottom-0 h-1 rounded-sm bg-(--site-orange) transition-opacity duration-200 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
