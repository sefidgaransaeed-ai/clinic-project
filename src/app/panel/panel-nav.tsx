"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { PanelRoute } from "@/lib/panel-routes";

/**
 * منوی پنل، در دو شکل:
 *
 *   `MobileNav`  — دکمهٔ «منو» در سرصفحه و فهرستی که زیرش باز می‌شود
 *   `DesktopNav` — فهرست همیشه‌باز در ستون کناری
 *
 * عمداً دو کامپوننت جدا، نه یکی که دو بار رندر شود: رندر دوباره یعنی دو
 * عنصر با یک `id`، که هم HTML را نامعتبر می‌کند و هم `aria-controls` را
 * بی‌معنا.
 *
 * هیچ‌کدام تصمیم دسترسی نمی‌گیرند — فهرست از سرور می‌آید و از قبل بر
 * اساس نقش فیلتر شده است.
 */

function NavList({
  items,
  onNavigate,
}: {
  items: readonly PanelRoute[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-black/10 font-medium dark:bg-white/15"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileNav({ items }: { items: readonly PanelRoute[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="panel-nav-mobile"
        className="rounded-lg border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
      >
        {open ? "بستن منو" : "منو"}
      </button>

      {open ? (
        <nav
          id="panel-nav-mobile"
          aria-label="منوی پنل"
          className="absolute inset-x-0 z-10 mt-3 border-y border-black/10 bg-background px-6 py-3 dark:border-white/15"
        >
          <NavList items={items} onNavigate={() => setOpen(false)} />
        </nav>
      ) : null}
    </div>
  );
}

export function DesktopNav({ items }: { items: readonly PanelRoute[] }) {
  return (
    <nav id="panel-nav" aria-label="منوی پنل" className="hidden md:block">
      <NavList items={items} />
    </nav>
  );
}
