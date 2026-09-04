"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { path?: string | null; label: string; fallback?: string };
export function ProfileAvatar({ path, label, fallback = "MF" }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!path) return;
    void createClient().storage.from("avatars").createSignedUrl(path, 3600).then(({ data }) => { if (active) setUrl(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [path]);
  return url ? <div aria-label={label} className="size-10 rounded-full bg-cover bg-center" role="img" style={{ backgroundImage: `url(${url})` }} /> : <div aria-label={label} className="grid size-10 place-items-center rounded-full bg-brand text-xs font-bold text-brand-foreground" role="img">{fallback.slice(0, 2).toUpperCase()}</div>;
}
