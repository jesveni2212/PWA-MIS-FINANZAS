type MoneyValueProps = {
  amount: number;
  currency: string;
  hidden?: boolean;
  className?: string;
};

export function MoneyValue({ amount, currency, hidden = false, className }: MoneyValueProps) {
  if (hidden) {
    return <span aria-label="Saldo oculto" className={className}>••••••</span>;
  }

  const fractionDigits = currency === "PYG" ? 0 : 2;
  const formattedAmount = new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

  return <span className={className}>{formattedAmount}</span>;
}
