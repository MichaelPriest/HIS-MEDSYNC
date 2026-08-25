create or replace function public.prescricao_administracoes_planejadas(p_frequencia text, p_horarios jsonb)
returns integer
language sql
immutable
set search_path to 'public','pg_catalog'
as $$
  select public.prescricao_administracoes_planejadas(
    p_frequencia,
    case
      when jsonb_typeof(coalesce(p_horarios,'[]'::jsonb))='array'
        then array(select jsonb_array_elements_text(coalesce(p_horarios,'[]'::jsonb)))
      else array[]::text[]
    end
  );
$$;

alter table public.dispensacoes_medicamentos
  add column if not exists prescricao_componente_id uuid null references public.prescricao_componentes(id) on delete restrict;

create index if not exists idx_dispensacoes_prescricao_componente
  on public.dispensacoes_medicamentos(prescricao_componente_id)
  where prescricao_componente_id is not null;

alter table public.solicitacoes_exames drop constraint if exists solicitacoes_exames_status_check;
alter table public.solicitacoes_exames add constraint solicitacoes_exames_status_check check (status = any (array['rascunho','solicitado','agendado','coletado','em_execucao','liberado','cancelado']::text[]));

alter table public.solicitacoes_materiais_assistenciais drop constraint if exists solicitacoes_materiais_assistenciais_status_check;
alter table public.solicitacoes_materiais_assistenciais add constraint solicitacoes_materiais_assistenciais_status_check check (status = any (array['rascunho','solicitado','separacao','dispensado','entregue','cancelado']::text[]));

alter table public.procedimentos_assistenciais drop constraint if exists procedimentos_assistenciais_status_check;
alter table public.procedimentos_assistenciais add constraint procedimentos_assistenciais_status_check check (status = any (array['rascunho','programado','em_execucao','realizado','cancelado']::text[]));

create or replace function public.dispensar_componente_prescricao(
  p_prescricao_componente_id uuid,
  p_estoque_lote_id uuid,
  p_quantidade numeric
)
returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  v_c record;
  v_p record;
  v_l record;
  v_prod record;
  v_prof uuid;
  v_id uuid;
  v_val text;
begin
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'FARMACIA_QUANTIDADE_INVALIDA'; end if;
  select c.*, ia.descricao as item_descricao into v_c
  from public.prescricao_componentes c join public.itens_assistenciais ia on ia.id=c.item_assistencial_id
  where c.id=p_prescricao_componente_id;
  if not found then raise exception 'FARMACIA_COMPONENTE_NAO_LOCALIZADO'; end if;
  select p.*,a.paciente_id into v_p
  from public.prescricoes p join public.atendimentos a on a.id=p.atendimento_id
  where p.id=v_c.prescricao_id;
  if not found then raise exception 'FARMACIA_PRESCRICAO_NAO_LOCALIZADA'; end if;
  if v_p.assinado_em is null or v_p.status<>'ativa' then raise exception 'FARMACIA_PRESCRICAO_NAO_ASSINADA_ATIVA'; end if;
  if not public.tem_permissao(v_p.empresa_id,v_p.unidade_id,'farmacia.dispensar') then raise exception 'FARMACIA_SEM_PERMISSAO' using errcode='42501'; end if;
  if v_p.requer_validacao_farmaceutica then
    select status into v_val from public.validacoes_farmaceuticas where prescricao_id=v_p.id;
    if coalesce(v_val,'pendente') not in ('validada','validada_com_ressalva') then raise exception 'FARMACIA_VALIDACAO_FARMACEUTICA_PENDENTE'; end if;
  end if;
  v_prof:=public.profissional_logado(v_p.empresa_id);
  if v_prof is null then raise exception 'FARMACIA_USUARIO_SEM_PROFISSIONAL'; end if;
  select ep.* into v_prod from public.estoque_produtos ep
  where ep.empresa_id=v_p.empresa_id and ep.item_assistencial_id=v_c.item_assistencial_id and ep.ativo=true
  order by ep.updated_at desc limit 1;
  if not found then raise exception 'FARMACIA_COMPONENTE_SEM_PRODUTO_ESTOQUE'; end if;
  select l.*,ep.descricao,ep.unidade_medida into v_l
  from public.estoque_lotes l join public.estoque_produtos ep on ep.id=l.produto_id
  where l.id=p_estoque_lote_id for update of l;
  if not found then raise exception 'FARMACIA_LOTE_NAO_LOCALIZADO'; end if;
  if v_l.empresa_id<>v_p.empresa_id or v_l.unidade_id<>v_p.unidade_id then raise exception 'FARMACIA_LOTE_FORA_ESCOPO'; end if;
  if v_l.produto_id<>v_prod.id then raise exception 'FARMACIA_PRODUTO_DIVERGENTE_DO_COMPONENTE'; end if;
  if v_l.quantidade<p_quantidade then raise exception 'FARMACIA_ESTOQUE_INSUFICIENTE'; end if;
  update public.estoque_lotes set quantidade=quantidade-p_quantidade,updated_at=now() where id=p_estoque_lote_id;
  insert into public.dispensacoes_medicamentos(
    empresa_id,unidade_id,atendimento_id,prescricao_id,prescricao_componente_id,paciente_id,item,lote,validade,
    quantidade,unidade_medida,dispensado_por,dispensado_em,status,produto_id,estoque_lote_id,quantidade_atendida,created_by,updated_by
  ) values(
    v_p.empresa_id,v_p.unidade_id,v_p.atendimento_id,v_p.id,v_c.id,v_p.paciente_id,coalesce(v_c.item_descricao,v_l.descricao),v_l.numero_lote,v_l.validade,
    p_quantidade,v_l.unidade_medida,v_prof,now(),'dispensado',v_l.produto_id,p_estoque_lote_id,p_quantidade,auth.uid(),auth.uid()
  ) returning id into v_id;
  insert into public.prescricao_eventos(empresa_id,unidade_id,prescricao_id,atendimento_id,evento,detalhe,profissional_id,usuario_id)
  values(v_p.empresa_id,v_p.unidade_id,v_p.id,v_p.atendimento_id,'dispensacao_componente',jsonb_build_object('dispensacao_id',v_id,'prescricao_componente_id',v_c.id,'estoque_lote_id',p_estoque_lote_id,'quantidade',p_quantidade),v_prof,auth.uid());
  return v_id;
end;
$$;

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

  for v_p in select p.id from public.prescricoes p
    where p.atendimento_id=p_atendimento_id and p.empresa_id=v_at.empresa_id and p.unidade_id=v_at.unidade_id
      and p.profissional_id=v_prof and p.created_by=auth.uid() and p.status='rascunho' and p.assinado_em is null
    order by p.created_at
  loop
    perform public.assinar_prescricao(v_p.id);
    begin perform public.gerar_aprazamentos_prescricao(v_p.id,2); exception when others then null; end;
    v_count_med:=v_count_med+1;
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

  return jsonb_build_object('medicamentos',v_count_med,'exames',v_count_ex,'procedimentos',v_count_proc,'materiais',v_count_mat);
end;
$$;

grant execute on function public.dispensar_componente_prescricao(uuid,uuid,numeric) to authenticated;
grant execute on function public.finalizar_prescricao_dia(uuid) to authenticated;
grant execute on function public.prescricao_administracoes_planejadas(text,jsonb) to authenticated;
