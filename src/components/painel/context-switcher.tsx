"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { selecionarContextoTrabalho } from "@/modules/auth/context-actions";

type Option = { id: string; nome: string };

export function ContextSwitcher({
  profiles,
  units,
  selectedProfileId,
  selectedUnitId,
}: {
  profiles: readonly Option[];
  units: readonly Option[];
  selectedProfileId: string;
  selectedUnitId: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(selectedProfileId || "all");
  const [unit, setUnit] = useState(selectedUnitId || "all");
  const [pending, startTransition] = useTransition();

  const apply = (nextProfile: string, nextUnit: string) => {
    setProfile(nextProfile);
    setUnit(nextUnit);
    startTransition(async () => {
      const result = await selecionarContextoTrabalho(nextProfile, nextUnit);
      if (result.ok) {
        setProfile(result.perfil);
        setUnit(result.unidade);
      }
      router.refresh();
    });
  };

  return (
    <div className="hidden items-center gap-2 lg:flex" aria-label="Contexto de trabalho">
      <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm">
        <ShieldCheck className="size-3.5 shrink-0 text-brand-600" />
        <span className="sr-only">Perfil ativo</span>
        <select
          value={profile}
          disabled={pending}
          onChange={(event) => apply(event.target.value, unit)}
          className="max-w-44 bg-transparent pr-1 text-xs font-bold text-slate-700 outline-none disabled:opacity-60"
          title="Filtrar atalhos pelo perfil"
        >
          <option value="all">Todos os perfis</option>
          {profiles.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>

      <label className="relative flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm">
        <Building2 className="size-3.5 shrink-0 text-brand-600" />
        <span className="sr-only">Unidade ativa</span>
        <select
          value={unit}
          disabled={pending}
          onChange={(event) => apply(profile, event.target.value)}
          className="max-w-44 bg-transparent pr-1 text-xs font-bold text-slate-700 outline-none disabled:opacity-60"
          title="Selecionar unidade de trabalho"
        >
          <option value="all">Todas as unidades</option>
          {units.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
      </label>
    </div>
  );
}
