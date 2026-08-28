-- Central transversal de integracao: eventos derivados e pendencias reconciliaveis.
-- As tabelas clinicas permanecem fontes da verdade; esta camada nao cria fatos assistenciais nem faturamento.

insert into public.permissoes (codigo, descricao, ativo)
values
  ('integracao.visualizar', 'Visualizar central de integracao intersetorial', true),
  ('integracao.reconciliar', 'Reconciliar pendencias de integracao intersetorial', true)
on conflict (codigo) do update
set descricao = excluded.descricao, ativo = true, updated_at = now();

insert into public.perfil_permissoes (perfil_id, permissao_id)
select pf.id, pe.id
from public.perfis pf
join public.permissoes pe on pe.codigo in ('integracao.visualizar','integracao.reconciliar')
where pf.ativo
  and pf.nome in ('Administrador','Auditoria','Faturamento','TI')
on conflict do nothing;

create table public.integracao_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid null references public.atendimentos(id),
  paciente_id uuid null references public.pacientes(id),
  tipo_evento text not null,
  origem_tabela text not null,
  origem_id uuid not null,
  correlation_id uuid not null,
  payload_versao smallint not null default 1 check (payload_versao > 0),
  payload jsonb not null default '{}'::jsonb,
  ocorrido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid null,
  constraint integracao_eventos_tipo_check check (tipo_evento = any(array[
    'exame.liberado','imagem.executada','laudo.liberado','cirurgia.iniciada',
    'cirurgia.concluida','opme.utilizada','producao.registrada'
  ]::text[])),
  constraint integracao_eventos_origem_unique unique (empresa_id, origem_tabela, origem_id, tipo_evento, payload_versao)
);

create index integracao_eventos_unidade_ocorrido_idx on public.integracao_eventos(unidade_id, ocorrido_em desc);
create index integracao_eventos_atendimento_idx on public.integracao_eventos(atendimento_id, ocorrido_em desc) where atendimento_id is not null;
create index integracao_eventos_tipo_idx on public.integracao_eventos(tipo_evento, ocorrido_em desc);

create table public.integracao_pendencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid null references public.atendimentos(id),
  paciente_id uuid null references public.pacientes(id),
  regra_chave text not null,
  origem_tabela text not null,
  origem_id uuid not null,
  setor_origem text not null,
  setor_destino text not null,
  severidade text not null default 'media' check (severidade in ('baixa','media','alta','critica')),
  titulo text not null,
  detalhes text null,
  contexto jsonb not null default '{}'::jsonb,
  status text not null default 'aberta' check (status in ('aberta','resolvida')),
  detectada_em timestamptz not null default now(),
  ultima_deteccao_em timestamptz not null default now(),
  resolvida_em timestamptz null,
  resolvida_por uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integracao_pendencias_aberta_unique
  on public.integracao_pendencias(empresa_id, regra_chave, origem_tabela, origem_id)
  where status='aberta';
create index integracao_pendencias_unidade_status_idx on public.integracao_pendencias(unidade_id,status,severidade,detectada_em desc);
create index integracao_pendencias_atendimento_idx on public.integracao_pendencias(atendimento_id,status) where atendimento_id is not null;
create index integracao_pendencias_destino_idx on public.integracao_pendencias(setor_destino,status,detectada_em desc);

alter table public.integracao_eventos enable row level security;
alter table public.integracao_pendencias enable row level security;

create policy integracao_eventos_select on public.integracao_eventos
for select to authenticated
using (
  public.tem_unidade(empresa_id,unidade_id)
  and public.tem_permissao(empresa_id,unidade_id,'integracao.visualizar')
);

create policy integracao_pendencias_select on public.integracao_pendencias
for select to authenticated
using (
  public.tem_unidade(empresa_id,unidade_id)
  and public.tem_permissao(empresa_id,unidade_id,'integracao.visualizar')
);

revoke all on public.integracao_eventos from anon, public;
revoke all on public.integracao_pendencias from anon, public;
grant select on public.integracao_eventos to authenticated;
grant select on public.integracao_pendencias to authenticated;

create or replace function public.registrar_integracao_evento_internal(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_atendimento_id uuid,
  p_paciente_id uuid,
  p_tipo_evento text,
  p_origem_tabela text,
  p_origem_id uuid,
  p_ocorrido_em timestamptz,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_id uuid;
begin
  insert into public.integracao_eventos(
    empresa_id,unidade_id,atendimento_id,paciente_id,tipo_evento,
    origem_tabela,origem_id,correlation_id,payload,ocorrido_em,created_by
  ) values (
    p_empresa_id,p_unidade_id,p_atendimento_id,p_paciente_id,p_tipo_evento,
    p_origem_tabela,p_origem_id,coalesce(p_atendimento_id,p_origem_id),coalesce(p_payload,'{}'::jsonb),coalesce(p_ocorrido_em,now()),auth.uid()
  )
  on conflict (empresa_id,origem_tabela,origem_id,tipo_evento,payload_versao)
  do update set payload = public.integracao_eventos.payload
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.registrar_integracao_evento_internal(uuid,uuid,uuid,uuid,text,text,uuid,timestamptz,jsonb) from public, anon, authenticated;

create or replace function public.integracao_capturar_evento_fonte()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_paciente uuid;
  v_cirurgia public.cirurgias%rowtype;
begin
  if tg_table_name='solicitacoes_exames' then
    if new.status='liberado' and (tg_op='INSERT' or old.status is distinct from new.status) then
      select a.paciente_id into v_paciente from public.atendimentos a where a.id=new.atendimento_id;
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,v_paciente,'exame.liberado','solicitacoes_exames',new.id,coalesce(new.resultado_em,new.updated_at,now()),jsonb_build_object('modalidade',new.modalidade,'exame',new.exame,'codigo_tuss',new.codigo_tuss));
    end if;
  elsif tg_table_name='imagem_execucoes' then
    if new.status='concluido' and (tg_op='INSERT' or old.status is distinct from new.status) then
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,new.paciente_id,'imagem.executada','imagem_execucoes',new.id,coalesce(new.finalizado_em,new.updated_at,now()),jsonb_build_object('solicitacao_id',new.solicitacao_id,'accession_number',new.accession_number,'study_instance_uid',new.study_instance_uid));
    end if;
  elsif tg_table_name='imagem_laudos' then
    if new.status='liberado' and (tg_op='INSERT' or old.status is distinct from new.status) then
      select a.paciente_id into v_paciente from public.atendimentos a where a.id=new.atendimento_id;
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,v_paciente,'laudo.liberado','imagem_laudos',new.id,coalesce(new.liberado_em,new.updated_at,now()),jsonb_build_object('modalidade','imagem','solicitacao_id',new.solicitacao_id,'execucao_id',new.execucao_id,'revisao',new.revisao));
    end if;
  elsif tg_table_name='laboratorio_laudos' then
    if new.status='liberado' and (tg_op='INSERT' or old.status is distinct from new.status) then
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,new.paciente_id,'laudo.liberado','laboratorio_laudos',new.id,coalesce(new.liberado_em,new.updated_at,now()),jsonb_build_object('modalidade','laboratorio','solicitacao_id',new.solicitacao_id,'versao',new.versao));
    end if;
  elsif tg_table_name='cirurgias' then
    if new.status='em_andamento' and (tg_op='INSERT' or old.status is distinct from new.status) then
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,new.paciente_id,'cirurgia.iniciada','cirurgias',new.id,coalesce(new.inicio_em,new.updated_at,now()),jsonb_build_object('procedimento',new.procedimento,'codigo_tuss',new.codigo_tuss,'sala',new.sala));
    elsif new.status='concluida' and (tg_op='INSERT' or old.status is distinct from new.status) then
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,new.paciente_id,'cirurgia.concluida','cirurgias',new.id,coalesce(new.fim_em,new.updated_at,now()),jsonb_build_object('procedimento',new.procedimento,'codigo_tuss',new.codigo_tuss,'sala',new.sala));
    end if;
  elsif tg_table_name='cirurgia_opme' then
    if new.status='utilizado' and (tg_op='INSERT' or old.status is distinct from new.status) then
      select * into v_cirurgia from public.cirurgias where id=new.cirurgia_id;
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,v_cirurgia.paciente_id,'opme.utilizada','cirurgia_opme',new.id,coalesce(new.utilizado_em,new.updated_at,now()),jsonb_build_object('cirurgia_id',new.cirurgia_id,'item',new.item,'codigo',new.codigo,'lote',new.lote,'serie',new.serie,'quantidade',new.quantidade));
    end if;
  elsif tg_table_name='producao_assistencial_eventos' then
    if new.status in ('registrado','consolidado') and (tg_op='INSERT' or old.status is distinct from new.status) then
      perform public.registrar_integracao_evento_internal(new.empresa_id,new.unidade_id,new.atendimento_id,new.paciente_id,'producao.registrada','producao_assistencial_eventos',new.id,coalesce(new.ocorrido_em,new.created_at,now()),jsonb_build_object('tipo_evento',new.tipo_evento,'origem_tipo',new.origem_tipo,'origem_id',new.origem_id,'cobravel',new.cobravel,'status',new.status));
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.integracao_capturar_evento_fonte() from public, anon, authenticated;

drop trigger if exists trg_integracao_solicitacoes_exames on public.solicitacoes_exames;
create trigger trg_integracao_solicitacoes_exames after insert or update of status on public.solicitacoes_exames for each row execute function public.integracao_capturar_evento_fonte();
drop trigger if exists trg_integracao_imagem_execucoes on public.imagem_execucoes;
create trigger trg_integracao_imagem_execucoes after insert or update of status on public.imagem_execucoes for each row execute function public.integracao_capturar_evento_fonte();
drop trigger if exists trg_integracao_imagem_laudos on public.imagem_laudos;
create trigger trg_integracao_imagem_laudos after insert or update of status on public.imagem_laudos for each row execute function public.integracao_capturar_evento_fonte();
drop trigger if exists trg_integracao_laboratorio_laudos on public.laboratorio_laudos;
create trigger trg_integracao_laboratorio_laudos after insert or update of status on public.laboratorio_laudos for each row execute function public.integracao_capturar_evento_fonte();
drop trigger if exists trg_integracao_cirurgias on public.cirurgias;
create trigger trg_integracao_cirurgias after insert or update of status on public.cirurgias for each row execute function public.integracao_capturar_evento_fonte();
drop trigger if exists trg_integracao_cirurgia_opme on public.cirurgia_opme;
create trigger trg_integracao_cirurgia_opme after insert or update of status on public.cirurgia_opme for each row execute function public.integracao_capturar_evento_fonte();
drop trigger if exists trg_integracao_producao on public.producao_assistencial_eventos;
create trigger trg_integracao_producao after insert or update of status on public.producao_assistencial_eventos for each row execute function public.integracao_capturar_evento_fonte();

create or replace function public.reconciliar_pendencias_integracao_internal(
  p_empresa_id uuid,
  p_unidade_id uuid,
  p_atendimento_id uuid default null,
  p_resolvida_por uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  v_abertas integer;
  v_resolvidas integer;
begin
  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select s.empresa_id,s.unidade_id,s.atendimento_id,a.paciente_id,'exame_liberado_sem_producao','solicitacoes_exames',s.id,
         case when s.modalidade='laboratorio' then 'laboratorio' when s.modalidade='imagem' then 'imagem' else 'assistencial' end,
         'faturamento','alta','Exame liberado sem produção assistencial',
         'O exame foi liberado, porém não há evento ativo correspondente no Livro de Produção.',
         jsonb_build_object('modalidade',s.modalidade,'exame',s.exame,'codigo_tuss',s.codigo_tuss)
  from public.solicitacoes_exames s join public.atendimentos a on a.id=s.atendimento_id
  where s.empresa_id=p_empresa_id and s.unidade_id=p_unidade_id and s.status='liberado'
    and (p_atendimento_id is null or s.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.producao_assistencial_eventos p where p.origem_tipo='solicitacao_exame' and p.origem_id=s.id and p.status in ('registrado','consolidado'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select e.empresa_id,e.unidade_id,e.atendimento_id,e.paciente_id,'imagem_concluida_sem_laudo','imagem_execucoes',e.id,'imagem','imagem','alta',
         'Exame de imagem concluído sem laudo liberado','A execução técnica terminou, mas ainda não há laudo liberado para o episódio.',
         jsonb_build_object('solicitacao_id',e.solicitacao_id,'accession_number',e.accession_number,'finalizado_em',e.finalizado_em)
  from public.imagem_execucoes e
  where e.empresa_id=p_empresa_id and e.unidade_id=p_unidade_id and e.status='concluido'
    and (p_atendimento_id is null or e.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.imagem_laudos l where l.execucao_id=e.id and l.status='liberado')
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select c.empresa_id,c.unidade_id,c.atendimento_id,c.paciente_id,'cirurgia_concluida_sem_producao','cirurgias',c.id,'centro_cirurgico','faturamento','critica',
         'Cirurgia concluída sem produção do procedimento','A cirurgia está concluída, mas o procedimento cirúrgico não aparece como evento ativo no Livro de Produção.',
         jsonb_build_object('procedimento',c.procedimento,'codigo_tuss',c.codigo_tuss,'fim_em',c.fim_em)
  from public.cirurgias c
  where c.empresa_id=p_empresa_id and c.unidade_id=p_unidade_id and c.status='concluida'
    and (p_atendimento_id is null or c.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.producao_assistencial_eventos p where p.origem_tipo='cirurgia' and p.origem_id=c.id and p.status in ('registrado','consolidado'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select o.empresa_id,o.unidade_id,o.atendimento_id,c.paciente_id,'opme_utilizada_sem_producao','cirurgia_opme',o.id,'centro_cirurgico','faturamento','critica',
         'OPME utilizada sem produção correspondente','A OPME foi marcada como utilizada em cirurgia concluída, mas não há evento ativo correspondente no Livro de Produção.',
         jsonb_build_object('cirurgia_id',o.cirurgia_id,'item',o.item,'codigo',o.codigo,'lote',o.lote,'serie',o.serie,'quantidade',o.quantidade)
  from public.cirurgia_opme o join public.cirurgias c on c.id=o.cirurgia_id
  where o.empresa_id=p_empresa_id and o.unidade_id=p_unidade_id and o.status='utilizado' and c.status='concluida'
    and (p_atendimento_id is null or o.atendimento_id=p_atendimento_id)
    and not exists(select 1 from public.producao_assistencial_eventos p where p.origem_tipo='cirurgia_opme' and p.origem_id=o.id and p.status in ('registrado','consolidado'))
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select p.empresa_id,p.unidade_id,p.atendimento_id,p.paciente_id,'producao_bloqueada_autorizacao','producao_assistencial_eventos',p.id,coalesce(nullif(p.setor,''),'assistencial'),'faturamento','alta',
         'Produção bloqueada por autorização/código','O fato clínico foi preservado, porém a cobrança está bloqueada por autorização ausente/insuficiente ou código pendente.',
         jsonb_build_object('tipo_evento',p.tipo_evento,'origem_tipo',p.origem_tipo,'autorizacao_status',p.metadados->>'autorizacao_status','codigo_tuss_fallback',p.codigo_tuss_fallback)
  from public.producao_assistencial_eventos p
  where p.empresa_id=p_empresa_id and p.unidade_id=p_unidade_id and p.status in ('registrado','consolidado')
    and (p_atendimento_id is null or p.atendimento_id=p_atendimento_id)
    and coalesce(p.metadados->>'autorizacao_status','') in ('ausente','insuficiente','codigo_pendente')
  on conflict do nothing;

  insert into public.integracao_pendencias(empresa_id,unidade_id,atendimento_id,paciente_id,regra_chave,origem_tabela,origem_id,setor_origem,setor_destino,severidade,titulo,detalhes,contexto)
  select p.empresa_id,p.unidade_id,p.atendimento_id,p.paciente_id,'producao_consolidada_sem_codigo','producao_assistencial_eventos',p.id,coalesce(nullif(p.setor,''),'assistencial'),'comercial','alta',
         'Produção consolidada sem código contratual','Existe item derivado na conta, mas nenhum código de cobrança foi resolvido. Corrija contrato/catálogo, não o prontuário.',
         jsonb_build_object('tipo_evento',p.tipo_evento,'origem_tipo',p.origem_tipo,'categoria',p.categoria_contratual)
  from public.producao_assistencial_eventos p
  where p.empresa_id=p_empresa_id and p.unidade_id=p_unidade_id and p.status='consolidado' and p.cobravel
    and (p_atendimento_id is null or p.atendimento_id=p_atendimento_id)
    and exists(select 1 from public.conta_faturamento_itens i where i.producao_evento_id=p.id)
    and not exists(select 1 from public.conta_faturamento_itens i where i.producao_evento_id=p.id and nullif(btrim(i.codigo),'') is not null)
  on conflict do nothing;

  update public.integracao_pendencias x
  set status='resolvida',resolvida_em=now(),resolvida_por=p_resolvida_por,updated_at=now()
  where x.empresa_id=p_empresa_id and x.unidade_id=p_unidade_id and x.status='aberta'
    and (p_atendimento_id is null or x.atendimento_id=p_atendimento_id)
    and (
      (x.regra_chave='exame_liberado_sem_producao' and not exists(select 1 from public.solicitacoes_exames s where s.id=x.origem_id and s.status='liberado' and not exists(select 1 from public.producao_assistencial_eventos p where p.origem_tipo='solicitacao_exame' and p.origem_id=s.id and p.status in ('registrado','consolidado'))))
      or (x.regra_chave='imagem_concluida_sem_laudo' and not exists(select 1 from public.imagem_execucoes e where e.id=x.origem_id and e.status='concluido' and not exists(select 1 from public.imagem_laudos l where l.execucao_id=e.id and l.status='liberado')))
      or (x.regra_chave='cirurgia_concluida_sem_producao' and not exists(select 1 from public.cirurgias c where c.id=x.origem_id and c.status='concluida' and not exists(select 1 from public.producao_assistencial_eventos p where p.origem_tipo='cirurgia' and p.origem_id=c.id and p.status in ('registrado','consolidado'))))
      or (x.regra_chave='opme_utilizada_sem_producao' and not exists(select 1 from public.cirurgia_opme o join public.cirurgias c on c.id=o.cirurgia_id where o.id=x.origem_id and o.status='utilizado' and c.status='concluida' and not exists(select 1 from public.producao_assistencial_eventos p where p.origem_tipo='cirurgia_opme' and p.origem_id=o.id and p.status in ('registrado','consolidado'))))
      or (x.regra_chave='producao_bloqueada_autorizacao' and not exists(select 1 from public.producao_assistencial_eventos p where p.id=x.origem_id and p.status in ('registrado','consolidado') and coalesce(p.metadados->>'autorizacao_status','') in ('ausente','insuficiente','codigo_pendente')))
      or (x.regra_chave='producao_consolidada_sem_codigo' and not exists(select 1 from public.producao_assistencial_eventos p where p.id=x.origem_id and p.status='consolidado' and p.cobravel and exists(select 1 from public.conta_faturamento_itens i where i.producao_evento_id=p.id) and not exists(select 1 from public.conta_faturamento_itens i where i.producao_evento_id=p.id and nullif(btrim(i.codigo),'') is not null)))
    );
  get diagnostics v_resolvidas = row_count;

  update public.integracao_pendencias set ultima_deteccao_em=now(),updated_at=now()
  where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta'
    and (p_atendimento_id is null or atendimento_id=p_atendimento_id);

  select count(*) into v_abertas from public.integracao_pendencias
  where empresa_id=p_empresa_id and unidade_id=p_unidade_id and status='aberta'
    and (p_atendimento_id is null or atendimento_id=p_atendimento_id);
  return jsonb_build_object('abertas',v_abertas,'resolvidas_nesta_execucao',v_resolvidas);
end;
$function$;
revoke all on function public.reconciliar_pendencias_integracao_internal(uuid,uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public.reconciliar_pendencias_integracao(p_empresa_id uuid,p_unidade_id uuid,p_atendimento_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
begin
  if auth.uid() is null then raise exception 'INTEGRACAO_AUTENTICACAO_OBRIGATORIA' using errcode='42501'; end if;
  if not public.tem_unidade(p_empresa_id,p_unidade_id) then raise exception 'INTEGRACAO_UNIDADE_FORA_ESCOPO' using errcode='42501'; end if;
  if not public.tem_permissao(p_empresa_id,p_unidade_id,'integracao.reconciliar') then raise exception 'INTEGRACAO_SEM_PERMISSAO' using errcode='42501'; end if;
  if p_atendimento_id is not null and not exists(select 1 from public.atendimentos a where a.id=p_atendimento_id and a.empresa_id=p_empresa_id and a.unidade_id=p_unidade_id) then raise exception 'INTEGRACAO_ATENDIMENTO_FORA_ESCOPO' using errcode='42501'; end if;
  return public.reconciliar_pendencias_integracao_internal(p_empresa_id,p_unidade_id,p_atendimento_id,auth.uid());
end;
$function$;
revoke all on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) from public, anon;
grant execute on function public.reconciliar_pendencias_integracao(uuid,uuid,uuid) to authenticated;

insert into public.integracao_eventos(empresa_id,unidade_id,atendimento_id,paciente_id,tipo_evento,origem_tabela,origem_id,correlation_id,payload,ocorrido_em,created_by)
select s.empresa_id,s.unidade_id,s.atendimento_id,a.paciente_id,'exame.liberado','solicitacoes_exames',s.id,s.atendimento_id,jsonb_build_object('modalidade',s.modalidade,'exame',s.exame,'codigo_tuss',s.codigo_tuss),coalesce(s.resultado_em,s.updated_at),s.updated_by
from public.solicitacoes_exames s join public.atendimentos a on a.id=s.atendimento_id where s.status='liberado'
on conflict do nothing;
insert into public.integracao_eventos(empresa_id,unidade_id,atendimento_id,paciente_id,tipo_evento,origem_tabela,origem_id,correlation_id,payload,ocorrido_em,created_by)
select c.empresa_id,c.unidade_id,c.atendimento_id,c.paciente_id,'cirurgia.concluida','cirurgias',c.id,c.atendimento_id,jsonb_build_object('procedimento',c.procedimento,'codigo_tuss',c.codigo_tuss,'sala',c.sala),coalesce(c.fim_em,c.updated_at),c.updated_by
from public.cirurgias c where c.status='concluida'
on conflict do nothing;
insert into public.integracao_eventos(empresa_id,unidade_id,atendimento_id,paciente_id,tipo_evento,origem_tabela,origem_id,correlation_id,payload,ocorrido_em,created_by)
select p.empresa_id,p.unidade_id,p.atendimento_id,p.paciente_id,'producao.registrada','producao_assistencial_eventos',p.id,p.atendimento_id,jsonb_build_object('tipo_evento',p.tipo_evento,'origem_tipo',p.origem_tipo,'origem_id',p.origem_id,'cobravel',p.cobravel,'status',p.status),p.ocorrido_em,p.updated_by
from public.producao_assistencial_eventos p where p.status in ('registrado','consolidado')
on conflict do nothing;

do $block$
declare r record;
begin
  for r in select distinct empresa_id,unidade_id from public.atendimentos loop
    perform public.reconciliar_pendencias_integracao_internal(r.empresa_id,r.unidade_id,null,null);
  end loop;
end;
$block$;
