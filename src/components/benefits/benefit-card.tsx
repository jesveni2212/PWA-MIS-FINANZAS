"use client";

import { MoneyValue } from "@/components/ui/money-value";
import type { PersonalBenefit } from "@/lib/benefits/types";

type BenefitCardProps = { benefit: PersonalBenefit; hidden?: boolean; busy?: boolean; onEdit: (benefit: PersonalBenefit) => void; onDuplicate: (benefit: PersonalBenefit) => void; onDisable: (id: string) => void };
const statusLabels = { draft: "Borrador", active: "Activo", expired: "Vencido", disabled: "Desactivado" };
const channelLabels = { all: "Todos los canales", physical: "Presencial", app: "Aplicación", web: "Web" };
const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function ProgressSummary({ label, used, cap, currency, hidden }: { label: string; used: number; cap: number; currency: string; hidden: boolean }) {
  const width = Math.min(used / cap, 1) * 100;
  return <section aria-label={label} className="grid gap-3 rounded-xl border border-border p-4">
    <h4 className="text-sm font-semibold">{label}</h4>
    <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-muted">Usado</span><MoneyValue amount={used} currency={currency} hidden={hidden} /></div>
    <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={hidden ? undefined : width} className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar"><div className="h-full rounded-full bg-signal" style={{ width: `${hidden ? 0 : width}%` }} /></div>
    <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-muted">Disponible</span><MoneyValue amount={Math.max(cap - used, 0)} className="font-semibold text-signal" currency={currency} hidden={hidden} /></div>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>Tope</span><MoneyValue amount={cap} currency={currency} hidden={hidden} /></div>
  </section>;
}

export function BenefitCard({ benefit, hidden = false, busy = false, onEdit, onDuplicate, onDisable }: BenefitCardProps) {
  const monthly = benefit.recurrence === "monthly";
  const sourceUrl = benefit.sourceUrl && /^https?:\/\//i.test(benefit.sourceUrl) ? benefit.sourceUrl : null;
  const dateLabel = (value: string) => new Intl.DateTimeFormat("es-PY", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  return <article aria-label={`${benefit.merchantName} · ${benefit.accountLabel}`} className="grid min-w-0 gap-5 rounded-2xl border border-border bg-panel-raised p-5 shadow-lg shadow-black/10">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-xs text-muted">{benefit.accountLabel}</p><h3 className="mt-2 break-words font-serif text-2xl font-semibold">{benefit.merchantName}</h3><p className="mt-2 text-sm font-semibold text-signal">{benefit.rateBps / 100}% de reintegro · {monthly ? "Mensual" : "Semanal"}</p></div><span className="shrink-0 rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-signal">{statusLabels[benefit.status]}</span></div>
    <div className="grid gap-1 text-sm text-muted"><p><time dateTime={benefit.validFrom}>{dateLabel(benefit.validFrom)}</time> – <time dateTime={benefit.validUntil}>{dateLabel(benefit.validUntil)}</time></p><p>{benefit.weekdays.map((day) => weekdayLabels[day]).join(" · ")} · {channelLabels[benefit.channel]}</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><ProgressSummary cap={benefit.purchaseCap} currency={benefit.currency} hidden={hidden} label="Compras" used={benefit.usedPurchase} /><ProgressSummary cap={benefit.rebateCap} currency={benefit.currency} hidden={hidden} label="Reintegros" used={benefit.usedRebate} /></div>
    {benefit.conditions ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">{benefit.conditions}</p> : null}
    {sourceUrl ? <a className="w-fit break-all text-sm font-semibold text-signal underline" href={sourceUrl} rel="noopener noreferrer" target="_blank">Ver fuente de la promoción</a> : null}
    {!monthly ? <p className="text-sm text-muted">La edición y duplicación de beneficios semanales todavía no están disponibles.</p> : null}
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">{[
      { label: "Editar", disabled: !monthly, action: () => onEdit(benefit) },
      { label: "Duplicar período anterior", disabled: !monthly, action: () => onDuplicate(benefit) },
      { label: "Desactivar", disabled: benefit.status === "disabled", action: () => onDisable(benefit.id) },
    ].map(({ label, disabled, action }) => <button className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-signal disabled:opacity-60" disabled={busy || disabled} key={label} onClick={action} type="button">{label}</button>)}</div>
  </article>;
}
