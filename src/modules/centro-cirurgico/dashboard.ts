import "server-only";

import { getAssistencialContext } from "@/modules/assistencial/context";

type Rel<T> = T | T[] | null;
type SurgeryRow = {
  id: string;
  procedimento: string;
  codigo_tuss: string | null;
  codigo_contratado: string | null;
  sala: string | null;
  status: string;
  inicio_previsto: string | null;
  inicio_em: string | null;
  cirurgiao_id: string | null;
  anestesista_id: string | null;
  paciente: Rel<{ nome_completo: string | null; nome_social: string | null; ra: string | null }>;
};

export type SurgeryDashboardItem = Omit<SurgeryRow, "paciente"> & {
  paciente_nome: string;
  paciente_ra: string | null;
  cirurgiao_nome: string | null;
  anestesista_nome: string | null;
  procedimentos: { descricao: string; sequencia: number; status: string }[];
};

const one = <T,>(value: Rel<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;

export async function listSurgeryDashboard(statuses: string[]): Promise<SurgeryDashboardItem[]> {
  const { supabase, empresaId, unidadeId } = await getAssistencialContext();
  const { data, error } = await supabase
    .from("cirurgias")
    .select("id,procedimento,codigo_tuss,codigo_contratado,sala,status,inicio_previsto,inicio_em,cirurgiao_id,anestesista_id,paciente:pacientes(nome_completo,nome_social,ra)")
    .eq("empresa_id", empresaId)
    .eq("unidade_id", unidadeId)
    .in("status", statuses)
    .order("inicio_previsto", { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw new Error(`Não foi possível carregar as cirurgias: ${error.message}`);

  const surgeries = (data ?? []) as unknown as SurgeryRow[];
  const professionalIds = [...new Set(surgeries.flatMap((item) => [item.cirurgiao_id, item.anestesista_id]).filter((id): id is string => Boolean(id)))];
  const surgeryIds = surgeries.map((item) => item.id);
  const [professionals, procedures] = await Promise.all([
    professionalIds.length
      ? supabase.from("profissionais").select("id,nome_completo").eq("empresa_id", empresaId).in("id", professionalIds)
      : Promise.resolve({ data: [] as { id: string; nome_completo: string }[], error: null }),
    surgeryIds.length
      ? supabase.from("cirurgia_procedimentos").select("cirurgia_id,descricao,sequencia,status").in("cirurgia_id", surgeryIds).order("sequencia")
      : Promise.resolve({ data: [] as { cirurgia_id: string; descricao: string; sequencia: number; status: string }[], error: null }),
  ]);
  if (professionals.error) throw new Error(`Não foi possível carregar a equipe: ${professionals.error.message}`);
  if (procedures.error) throw new Error(`Não foi possível carregar os procedimentos: ${procedures.error.message}`);
  const names = new Map((professionals.data ?? []).map((item) => [item.id, item.nome_completo]));
  const proceduresBySurgery = new Map<string, { descricao: string; sequencia: number; status: string }[]>();
  for (const procedure of procedures.data ?? []) proceduresBySurgery.set(procedure.cirurgia_id, [...(proceduresBySurgery.get(procedure.cirurgia_id) ?? []), procedure]);

  return surgeries.map((item) => {
    const patient = one(item.paciente);
    return {
      ...item,
      paciente_nome: patient?.nome_social || patient?.nome_completo || "Paciente",
      paciente_ra: patient?.ra ?? null,
      cirurgiao_nome: item.cirurgiao_id ? names.get(item.cirurgiao_id) ?? null : null,
      anestesista_nome: item.anestesista_id ? names.get(item.anestesista_id) ?? null : null,
      procedimentos: proceduresBySurgery.get(item.id) ?? [],
    };
  });
}
