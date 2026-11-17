"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

/**
 * عددی که وقتی مقدارش عوض می‌شود، از رقم قبلی تا رقم تازه می‌شمارد.
 * بار اول همان رقم نهایی است تا صفحهٔ سرور و مرورگر یکی باشند. برای کسی که حرکت را خاموش
 * کرده، رقم یک‌باره عوض می‌شود.
 */
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  // رقمی که الان روی صفحه است؛ اگر بازه وسط شمارش عوض شود، شمارش تازه از همین‌جا ادامه می‌دهد
  const displayed = useRef(value);

  useEffect(() => {
    const start = displayed.current;
    if (start === value) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : DURATION_MS;
    const began = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (time - began) / duration);
      // تند شروع می‌کند و آرام روی رقم نهایی می‌نشیند
      const eased = 1 - (1 - progress) ** 3;
      displayed.current = Math.round(start + (value - start) * eased);
      setShown(displayed.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return shown;
}
