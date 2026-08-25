create or replace function public.finalizar_prescricao_dia(p_atendimento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog','extensions'
as $$
declare
  v_at record;
  v_prof uuid;
  v_p record;
  v_ex record;
  v_mat record;
  v_count_med int := 0;
  v_count_dieta int := 0;
  v_count_cuidado int := 0;
  v_count_ex int := 0;
  v_count_proc int := 0;
  v_count_mat int := 0;
begin
  select a.id,a.empresa_id,a.unidade_id,a.paciente_id into v_at
  from public.atendimentos a
  where a.id=p_atendimento_id and a.status in ('aberto','em_espera','em_atendimento');
  if not found then raise exception 'PRESCRICAO_DIA_ATENDIMENTO_INVALIDO'; end if;
  if not public.tem_permissao(v_at.empresa_id,v_at.unidade_id,'prescricao.assinar') then raise exception 'PRESCRICAO_DIA_SEM_PERMISSAO' using errcode='42501'; end if;
  v_prof:=public.profissional_logado(v_at.empresa_id);
  if v_prof is null then raise exception 'PRESCRICAO_DIA_USUARIO_SEM_PROFISSIONAL'; end if;

  for v_p in select p.id,p.tipo from public.prescricoes p
    where p.atendimento_id=p_atendimento_id and p.empresa_id=v_at.empresa_id and p.unidade_id=v_at.unidade_id
      and p.profissional_id=v_prof and p.created_by=auth.uid() and p.status='rascunho' and p.assinado_em is null
    order by p.created_at
  loop
    perform public.assinar_prescricao(v_p.id);
    if v_p.tipo='medicamento' then
      begin perform public.gerar_aprazamentos_prescricao(v_p.id,2); exception when others then null; end;
      v_count_med:=v_count_med+1;
    elsif v_p.tipo='dieta' then
      v_count_dieta:=v_count_dieta+1;
    elsif v_p.tipo='cuidado' then
      v_count_cuidado:=v_count_cuidado+1;
    end if;
  end loop;

  for v_ex in update public.solicitacoes_exames set status='solicitado',updated_at=now(),updated_by=auth.uid()
    where atendimento_id=p_atendimento_id and empresa_id=v_at.empresa_id and unidade_id=v_at.unidade_id
      and profissional_id=v_prof and created_by=auth.uid() and status='rascunho'
    returning id,modalidade,exame
  loop
    insert into public.filas_setoriais(empresa_id,unidade_id,atendimento_id,paciente_id,setor_codigo,origem,motivo,prioridade,profissional_origem_id,created_by,updated_by)
    select v_at.empresa_id,v_at.unidade_id,p_atendimento_id,v_at.paciente_id,
      case when v_ex.modalidade='laboratorio' then 'laboratorio' else 'imagem' end,
      'solicitacao_exame',v_ex.exame,'normal',v_prof,auth.uid(),auth.uid()
    where not exists(select 1 from public.filas_setoriais f where f.atendimento_id=p_atendimento_id and f.origem='solicitacao_exame'
      and f.setor_codigo=case when v_ex.modalidade='laboratorio' then 'laboratorio' else 'imagem' end and f.status in ('aguardando','chamado','em_atendimento'));
    v_count_ex:=v_count_ex+1;
  end loop;

  update public.procedimentos_assistenciais set status='programado',updated_at=now(),updated_by=auth.uid()
  where atendimento_id=p_atendimento_id and empresa_id=v_at.empresa_id and unidade_id=v_at.unidade_id
    and profissional_id=v_prof and created_by=auth.uid() and status='rascunho';
  get diagnostics v_count_proc=row_count;

  for v_mat in update public.solicitacoes_materiais_assistenciais set status='solicitado',updated_at=now(),updated_by=auth.uid()
    where atendimento_id=p_atendimento_id and empresa_id=v_at.empresa_id and unidade_id=v_at.unidade_id
      and profissional_id=v_prof and created_by=auth.uid() and status='rascunho'
    returning id,descricao,quantidade,unidade_medida
  loop
    insert into public.filas_setoriais(empresa_id,unidade_id,atendimento_id,paciente_id,setor_codigo,origem,motivo,prioridade,profissional_origem_id,created_by,updated_by)
    select v_at.empresa_id,v_at.unidade_id,p_atendimento_id,v_at.paciente_id,'almoxarifado','solicitacao_material',
      concat('Separar ',v_mat.quantidade,' ',coalesce(v_mat.unidade_medida,'un'),' · ',v_mat.descricao),'normal',v_prof,auth.uid(),auth.uid()
    where not exists(select 1 from public.filas_setoriais f where f.atendimento_id=p_atendimento_id and f.origem='solicitacao_material'
      and f.setor_codigo='almoxarifado' and f.status in ('aguardando','chamado','em_atendimento'));
    v_count_mat:=v_count_mat+1;
  end loop;

  return jsonb_build_object('medicamentos',v_count_med,'dietas',v_count_dieta,'cuidados',v_count_cuidado,'exames',v_count_ex,'procedimentos',v_count_proc,'materiais',v_count_mat);
end;
$$;

grant execute on function public.finalizar_prescricao_dia(uuid) to authenticated;
