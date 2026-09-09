function normalizeInteger(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "") || "0";
}

function normalizeCanonicalValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const sign = trimmed.startsWith("-") ? "-" : "";
  const unsigned = trimmed.replace(/^[+-]/, "");
  const separatorIndex = unsigned.indexOf(".");
  const integerPart = separatorIndex === -1 ? unsigned : unsigned.slice(0, separatorIndex);
  const fractionPart = separatorIndex === -1 ? undefined : unsigned.slice(separatorIndex + 1);
  const integer = normalizeInteger(integerPart);

  return fractionPart === undefined
    ? `${sign}${integer}`
    : `${sign}${integer}.${fractionPart.replace(/\D/g, "")}`;
}

/** Converts the localized text entered by a user to a decimal string. */
export function parseMoneyInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const sign = trimmed.startsWith("-") ? "-" : "";
  const body = trimmed.replace(/^[+-]/, "").replace(/[^\d.,]/g, "");
  if (!body || !/\d/.test(body)) return "";

  if (body.includes(",")) {
    const separatorIndex = body.lastIndexOf(",");
    const integer = normalizeInteger(body.slice(0, separatorIndex));
    const fraction = body.slice(separatorIndex + 1).replace(/\D/g, "");
    return `${sign}${integer}.${fraction}`;
  }

  const dotParts = body.split(".");
  if (dotParts.length === 1) return `${sign}${normalizeInteger(dotParts[0])}`;

  // Keep compatibility with the old number input for unambiguous values such
  // as 50.25, while treating 500.000 as a thousands-grouped integer.
  if (dotParts.length === 2 && dotParts[1].length !== 3) {
    return `${sign}${normalizeInteger(dotParts[0])}.${dotParts[1].replace(/\D/g, "")}`;
  }

  return `${sign}${normalizeInteger(dotParts.join(""))}`;
}

/** Formats a canonical decimal string using the es-PY convention. */
export function formatMoneyInput(value: string): string {
  const normalized = normalizeCanonicalValue(value);
  if (!normalized) return "";

  const sign = normalized.startsWith("-") ? "-" : "";
  const unsigned = normalized.replace(/^-/, "");
  const separatorIndex = unsigned.indexOf(".");
  const integerPart = separatorIndex === -1 ? unsigned : unsigned.slice(0, separatorIndex);
  const fractionPart = separatorIndex === -1 ? undefined : unsigned.slice(separatorIndex + 1);
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return fractionPart === undefined
    ? `${sign}${groupedInteger}`
    : `${sign}${groupedInteger},${fractionPart}`;
}
