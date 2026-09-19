"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { VOID_COLOR } from "@/lib/theme";

/**
 * Shared chrome for the participant flow. Terminal-flavored: monospace, square
 * corners, hyphen rules instead of borders. Admin keeps its daisyUI look and
 * doesn't import anything from here.
 */

/**
 * Held on the bare void, with no star and no chrome — every participant page
 * starts here while it works out which planets belong to this device.
 */
export function TermLoading() {
  return (
    <div
      className="font-terminal flex min-h-dvh items-center justify-center text-dim"
      style={{ backgroundColor: VOID_COLOR }}
    >
      loading...
    </div>
  );
}

/** The `-----` rule that separates fields and control rows. */
export function TermRule({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`term-rule text-dim/70 ${className}`} />;
}

/** Filled light button — the forward action (`next`, `save`). */
export function TermButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`bg-paper px-6 py-2 text-void transition-opacity hover:opacity-85 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** `TermButton`'s look on a real link, so navigation still prefetches. */
export function TermLinkButton({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href: ComponentProps<typeof Link>["href"];
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-block bg-paper px-6 py-2 text-void transition-opacity hover:opacity-85 ${className}`}
    >
      {children}
    </Link>
  );
}

/** `TermGhostButton`'s look on a real link, for the secondary way onward. */
export function TermGhostLinkButton({
  children,
  href,
  className = "",
}: {
  children: ReactNode;
  href: ComponentProps<typeof Link>["href"];
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-block border border-paper px-6 py-2 text-paper transition-colors hover:bg-paper/10 ${className}`}
    >
      {children}
    </Link>
  );
}

/** Outlined button — the way back out. */
export function TermGhostButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border border-paper px-6 py-2 text-paper transition-colors hover:bg-paper/10 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** A labelled text field: `name:` in the star's ink, then a hyphen rule. */
export function TermField({
  label,
  value,
  onChange,
  inkColor,
  type = "text",
  autoComplete,
  placeholder,
  autoFocus,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inkColor: string;
  type?: "text" | "email";
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-4 block text-base" style={{ color: inkColor }}>
        {label}
      </span>
      <input
        type={type}
        className="term-input text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
      />
      <TermRule />
    </label>
  );
}
