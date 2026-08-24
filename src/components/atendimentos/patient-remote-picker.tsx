"use client";

import { Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdmissionPatient = {
  id: string;
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  cns: string | null;
  data_nascimento: string;
  nacionalidade: string | null;
  estado_civil: string | null;
  sexo: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  ra: string;
  numero_registro: number;
};

type SearchResult = Pick<AdmissionPatient, "id" | "nome_completo" | "cpf" | "ra" | "numero_registro">;

const PATIENT_SELECT = "id,nome_completo,cpf,rg,cns,data_nascimento,nacionalidade,estado_civil,sexo,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,ra,numero_registro";

export function PatientRemotePicker({
  empresaId,
  value,
  onChange,
  locked = false,
}: {
  empresaId: string;
  value: AdmissionPatient | null;
  onChange: (patient: AdmissionPatient | null) => void;
  locked?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value || locked) return;
    const term = query.trim();
    if (term.length < 2) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const { data, error: searchError } = await supabase.rpc("buscar_pacientes_admissao", {
        p_empresa: empresaId,
        p_busca: term,
        p_limite: 30,
      });

      if (!active) return;
      setLoading(false);
      if (searchError) {
        setResults([]);
        setError("Não foi possível pesquisar pacientes agora.");
        return;
      }
      setResults((Array.isArray(data) ? data : []) as SearchResult[]);
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [empresaId, locked, query, supabase, value]);

  async function selectPatient(id: string) {
    if (locked) return;
    setLoading(true);
    setError(null);
    const { data, error: patientError } = await supabase
      .from("pacientes")
      .select(PATIENT_SELECT)
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();

    setLoading(false);
    if (patientError || !data) {
      setError("O cadastro selecionado não pôde ser carregado.");
      return;
    }

    onChange(data as AdmissionPatient);
    setQuery("");
    setResults([]);
  }

  if (value) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm"><UserRound className="size-4" /></span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{locked ? "Paciente identificado no Totem" : "Paciente selecionado"}</p>
              <strong className="mt-1 block truncate text-sm text-slate-900">{value.nome_completo}</strong>
              <p className="mt-1 text-xs text-slate-600">{value.ra} · Registro #{value.numero_registro}{value.cpf ? ` · CPF ${value.cpf}` : ""}</p>
              {locked ? <p className="mt-1 text-xs font-medium text-emerald-700">Vínculo protegido para manter a continuidade da senha com o prontuário correto.</p> : null}
            </div>
          </div>
          {!locked ? <button type="button" onClick={() => onChange(null)} className="btn-secondary h-9 text-xs"><X className="size-3.5" /> Trocar paciente</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="space-y-2 text-sm font-medium text-slate-700">
        <span>Localizar paciente *</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              if (next.trim().length < 2) setResults([]);
            }}
            placeholder="Digite nome, CPF, RA ou número de registro"
            className="ui-input pl-9"
            autoComplete="off"
          />
        </div>
      </label>

      <p className="mt-1.5 text-xs text-slate-400">A pesquisa começa com 2 caracteres e retorna no máximo 30 resultados.</p>
      {loading ? <p className="mt-2 text-xs font-medium text-brand-600">Pesquisando…</p> : null}
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}

      {query.trim().length >= 2 && !loading ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{results.length} resultado(s)</div>
          {results.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onClick={() => void selectPatient(patient.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><UserRound className="size-4" /></span>
              <span className="min-w-0">
                <strong className="block truncate text-sm text-slate-800">{patient.nome_completo}</strong>
                <span className="block text-xs text-slate-500">{patient.ra} · Registro #{patient.numero_registro}{patient.cpf ? ` · CPF ${patient.cpf}` : ""}</span>
              </span>
            </button>
          ))}
          {!results.length ? <p className="px-3 py-5 text-center text-sm text-slate-500">Nenhum paciente encontrado.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
