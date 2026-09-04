"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/ui/profile-avatar";

export type GroupMember = { id: string; display_name: string; avatar_path: string | null; email_hint: string };

type Props = { selected: GroupMember[]; onChange: (members: GroupMember[]) => void };

export function MemberSearch({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const { data } = await createClient().rpc("search_registered_profiles", { search_text: term });
      if (active) { setResults((data ?? []) as GroupMember[]); setLoading(false); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  function toggle(member: GroupMember) {
    onChange(selected.some((item) => item.id === member.id) ? selected.filter((item) => item.id !== member.id) : [...selected, member]);
  }

  return <fieldset className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
    <legend className="px-1 font-semibold">Integrantes (opcional)</legend>
    <label className="grid gap-2 text-sm font-semibold" htmlFor="member-search">Buscar personas registradas
      <input className="rounded-xl border border-border bg-background px-4 py-3" id="member-search" onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length < 2) setResults([]); }} placeholder="Nombre o correo" value={query} />
    </label>
    <p className="text-xs text-muted">Solo aparecen usuarios autenticados de Mis Finanzas.</p>
    {loading ? <p aria-live="polite" className="text-sm text-muted">Buscando…</p> : null}
    {results.length > 0 ? <ul className="grid gap-2" aria-label="Personas registradas">{results.map((member) => <li key={member.id}><button className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-3 text-left hover:border-signal" onClick={() => toggle(member)} type="button"><span className="flex items-center gap-3"><ProfileAvatar label={`Foto de ${member.display_name}`} path={member.avatar_path} fallback={member.display_name} /><span><strong>{member.display_name}</strong><span className="ml-2 text-xs text-muted">{member.email_hint}</span></span></span><span aria-hidden="true">{selected.some((item) => item.id === member.id) ? "✓" : "+"}</span></button></li>)}</ul> : null}
    {selected.length > 0 ? <div className="flex flex-wrap gap-2" aria-label="Integrantes seleccionados">{selected.map((member) => <button className="rounded-full border border-signal/50 px-3 py-1 text-sm" key={member.id} onClick={() => toggle(member)} type="button">{member.display_name} ×</button>)}</div> : null}
  </fieldset>;
}
