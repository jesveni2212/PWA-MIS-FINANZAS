"use client";

import { useEffect, useRef, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from "react";
import { formatMoneyInput, parseMoneyInput } from "@/lib/finance/money";

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onBlur"> & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
};

type CaretSnapshot = {
  integerDigits: number;
  fractionDigits: number;
  hasDecimal: boolean;
};

function getCaretSnapshot(value: string, position: number): CaretSnapshot {
  const canonicalPrefix = parseMoneyInput(value.slice(0, position));
  const unsigned = canonicalPrefix.replace(/^-/, "");
  const separatorIndex = unsigned.indexOf(".");

  if (separatorIndex === -1) {
    return { integerDigits: unsigned.replace(/\D/g, "").length, fractionDigits: 0, hasDecimal: false };
  }

  return {
    integerDigits: unsigned.slice(0, separatorIndex).replace(/\D/g, "").length,
    fractionDigits: unsigned.slice(separatorIndex + 1).replace(/\D/g, "").length,
    hasDecimal: true,
  };
}

function restoreCaretPosition(value: string, snapshot: CaretSnapshot): number {
  if (snapshot.hasDecimal) {
    const separatorIndex = value.indexOf(",");
    if (separatorIndex !== -1) return separatorIndex + 1 + snapshot.fractionDigits;
  }

  const targetDigits = snapshot.integerDigits;
  let seenDigits = 0;
  for (let index = value.startsWith("-") ? 1 : 0; index < value.length; index += 1) {
    if (!/\d/.test(value[index])) continue;
    seenDigits += 1;
    if (seenDigits === targetDigits) return index + 1;
  }

  return value.length;
}

export function MoneyInput({ value, onChange, onBlur, inputMode, ...props }: MoneyInputProps) {
  const displayValue = formatMoneyInput(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<CaretSnapshot | null>(null);

  useEffect(() => {
    const snapshot = pendingCaret.current;
    const input = inputRef.current;
    if (!snapshot || !input || document.activeElement !== input) return;

    const position = restoreCaretPosition(displayValue, snapshot);
    input.setSelectionRange(position, position);
    pendingCaret.current = null;
  }, [displayValue]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const rawValue = event.target.value;
    const caretPosition = event.target.selectionStart ?? rawValue.length;
    pendingCaret.current = getCaretSnapshot(rawValue, caretPosition);
    const canonicalValue = parseMoneyInput(rawValue);
    onChange(canonicalValue);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const canonicalValue = parseMoneyInput(event.currentTarget.value);
    if (canonicalValue !== value) onChange(canonicalValue);
    onBlur?.(event);
  }

  return (
    <input
      {...props}
      ref={inputRef}
      inputMode={inputMode ?? "decimal"}
      onBlur={handleBlur}
      onChange={handleChange}
      type="text"
      value={displayValue}
    />
  );
}
