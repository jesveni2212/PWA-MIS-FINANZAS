"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FormStatus = "idle" | "submitting" | "success" | "error";

type CreateGroupFormProps = {
  onCreated?: () => void | Promise<void>;
};

export function CreateGroupForm({ onCreated }: CreateGroupFormProps) {
  const [groupName, setGroupName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = groupName.trim();

    if (!normalizedName) {
      setStatus("error");
      setMessage("Ingresá un nombre para el grupo.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    const { data, error } = await createClient().rpc("create_shared_group", { group_name: normalizedName });

    if (error || !data) {
      setStatus("error");
      setMessage("No pudimos crear el grupo. Volvé a iniciar sesión e intentá de nuevo.");
      return;
    }

    setGroupName("");
    setStatus("success");
    setMessage(`Grupo creado: ${data.name}.`);
    await onCreated?.();
  }

  return (
    <form className="grid max-w-lg gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="group-name">
        Nombre del grupo
        <input className="rounded-xl border border-border bg-background px-4 py-3" id="group-name" name="groupName" onChange={(event) => setGroupName(event.target.value)} placeholder="Ej.: Hogar" required value={groupName} />
      </label>
      {message ? <p aria-live="polite" className={status === "success" ? "text-brand" : "text-red-700"}>{message}</p> : null}
      <button className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={status === "submitting"} type="submit">
        {status === "submitting" ? "Creando…" : "Crear grupo"}
      </button>
    </form>
  );
}
