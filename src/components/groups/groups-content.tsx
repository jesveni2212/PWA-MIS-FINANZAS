"use client";

import { useCallback, useEffect, useState } from "react";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { createClient } from "@/lib/supabase/client";

type SharedGroup = {
  id: string;
  name: string;
  created_at: string;
};

export function GroupsContent() {
  const [groups, setGroups] = useState<SharedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(false);

    const { data, error: queryError } = await createClient()
      .from("financial_spaces")
      .select("id,name,created_at")
      .eq("kind", "shared")
      .order("created_at", { ascending: false });

    if (queryError) {
      setGroups([]);
      setError(true);
    } else {
      setGroups((data ?? []) as SharedGroup[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadGroups(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadGroups]);

  return (
    <div className="grid gap-10">
      <CreateGroupForm onCreated={loadGroups} />
      <section aria-labelledby="shared-groups-heading" className="grid gap-4">
        <h2 className="text-2xl font-bold" id="shared-groups-heading">Grupos compartidos</h2>
        {loading ? <p aria-live="polite">Cargando grupos compartidos…</p> : null}
        {!loading && error ? (
          <div className="grid justify-items-start gap-3" role="status">
            <p>No pudimos cargar tus grupos. Volvé a intentar.</p>
            <button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void loadGroups()} type="button">
              Reintentar
            </button>
          </div>
        ) : null}
        {!loading && !error && groups.length === 0 ? <p aria-live="polite">Todavía no tenés grupos compartidos.</p> : null}
        {!loading && !error && groups.length > 0 ? (
          <ul aria-label="Lista de grupos compartidos" className="grid gap-3">
            {groups.map((group) => <li className="rounded-2xl border border-border bg-panel p-4" key={group.id}><div className="flex items-center justify-between gap-3"><span className="font-semibold">{group.name}</span><span className="rounded-full border border-signal/40 px-2 py-1 text-xs text-signal">Compartido</span></div><p className="mt-2 text-sm text-muted">Grupo compartido · creado {new Date(group.created_at).toLocaleDateString("es-PY")}</p></li>)}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
