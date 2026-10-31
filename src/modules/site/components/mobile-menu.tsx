"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { navLinks } from "../copy";
import { CloseIcon, MenuIcon } from "./icons";

/** منوی جمع‌شوندهٔ موبایل. در صفحه‌های بزرگ‌تر پنهان است و منوی سرصفحه دیده می‌شود. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "بستن منو" : "باز کردن منو"}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
      >
        {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
      </button>

      {open && (
        <nav
          id={panelId}
          aria-label="منوی اصلی"
          className="absolute inset-x-0 top-full z-10 border-t border-white/10 bg-(--site-navy) px-4 pt-2 pb-4 shadow-[0_16px_30px_-16px_rgba(0,0,0,0.7)]"
        >
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base font-medium text-white transition-colors hover:bg-white/10"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
