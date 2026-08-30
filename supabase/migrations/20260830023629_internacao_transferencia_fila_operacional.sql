-- Fila enriquecida para NIR/origem-destino sem abrir RLS do prontuário da outra unidade.
create or replace function public.listar_transferencias_interunidades_operacionais(p_unidade_id uuid)
returns table(
  id uuid,
  internacao_origem_id uuid,
  atendimento_origem_id uuid,
  unidade_origem_id uuid,
  unidade_origem_nome text,
  unidade_destino_id uuid,
  unidade_destino_nome text,
  leito_origem_id uuid,
  leito_origem_codigo text,
  leito_destino_id uuid,
  atendimento_destino_id uuid,
  internacao_destino_id uuid,
  status text,
  prioridade text,
  motivo text,
  resumo_clinico text,
  condicoes_transporte text,
  observacoes text,
  solicitada_em timestamptz,
  decidida_em timestamptz,
  concluida_em timestamptz,
  motivo_recusa text,
  motivo_cancelamento text,
  paciente_id uuid,
  paciente_nome text,
  paciente_cpf text,
  paciente_cns text,
  acomodacao text,
  isolamento boolean
)
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_empresa_id uuid;
begin
  if auth.uid() is null then
    raise exception 'TRANSFERENCIA_USUARIO_NAO_AUTENTICADO' using errcode='42501';
  end if;

  select u.empresa_id into v_empresa_id
    from public.unidades u
   where u.id=p_unidade_id and u.ativo=true;
  if v_empresa_id is null or not public.tem_unidade(v_empresa_id,p_unidade_id) then
    raise exception 'TRANSFERENCIA_UNIDADE_FORA_ESCOPO' using errcode='42501';
  end if;
  if not (public.tem_permissao(v_empresa_id,p_unidade_id,'internacao.visualizar')
          or public.tem_permissao(v_empresa_id,p_unidade_id,'internacao.movimentar')
          or public.tem_permissao(v_empresa_id,p_unidade_id,'internacao.gerenciar')) then
    raise exception 'TRANSFERENCIA_SEM_PERMISSAO_VISUALIZAR' using errcode='42501';
  end if;

  return query
  select t.id,t.internacao_origem_id,t.atendimento_origem_id,
         t.unidade_origem_id,uo.nome,t.unidade_destino_id,ud.nome,
         t.leito_origem_id,lo.codigo,t.leito_destino_id,t.atendimento_destino_id,t.internacao_destino_id,
         t.status,t.prioridade,t.motivo,t.resumo_clinico,t.condicoes_transporte,t.observacoes,
         t.solicitada_em,t.decidida_em,t.concluida_em,t.motivo_recusa,t.motivo_cancelamento,
         a.paciente_id,a.paciente_nome,a.paciente_cpf,a.paciente_cns,i.acomodacao,coalesce(i.isolamento,false)
    from public.internacao_transferencias_interunidades t
    join public.atendimentos a on a.id=t.atendimento_origem_id
    join public.internacoes i on i.id=t.internacao_origem_id
    join public.unidades uo on uo.id=t.unidade_origem_id
    join public.unidades ud on ud.id=t.unidade_destino_id
    left join public.leitos lo on lo.id=t.leito_origem_id
   where t.empresa_id=v_empresa_id
     and (t.unidade_origem_id=p_unidade_id or t.unidade_destino_id=p_unidade_id)
   order by case t.status when 'solicitada' then 0 else 1 end,
            case t.prioridade when 'emergencia' then 0 when 'urgente' then 1 when 'alta' then 2 else 3 end,
            t.solicitada_em desc;
end;
$$;

revoke all on function public.listar_transferencias_interunidades_operacionais(uuid) from public,anon,authenticated;
grant execute on function public.listar_transferencias_interunidades_operacionais(uuid) to authenticated;
