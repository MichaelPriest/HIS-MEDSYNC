alter table public.contrato_tabelas_comerciais
  drop constraint if exists contrato_tabelas_comerciais_categoria_check;

alter table public.contrato_tabelas_comerciais
  add constraint contrato_tabelas_comerciais_categoria_check
  check (categoria in (
    'geral','procedimentos','cirurgias','sadt','honorarios','anestesia','auxiliares',
    'diarias','taxas','gases','materiais','medicamentos','opme','pacotes','outra'
  ));

create or replace function public.comercial_salvar_vinculo_tabela(
  p_contrato_id uuid,
  p_fonte_id uuid,
  p_categoria text,
  p_modo_edicao text,
  p_edicao_fixa_id uuid,
  p_percentual_ajuste numeric,
  p_valor_ch numeric,
  p_valor_hm numeric,
  p_valor_sadt numeric,
  p_valor_uco numeric,
  p_valor_filme_m2 numeric,
  p_base_preco text,
  p_prioridade integer,
  p_urgencia_percentual numeric,
  p_apartamento_percentual numeric,
  p_horario_especial_percentual numeric,
  p_arredondamento_casas integer,
  p_observacoes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.credenciamento_contratos%rowtype;
  v_f public.tabelas_comerciais_fontes%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'COMERCIAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;

  select * into v_c
    from public.credenciamento_contratos
   where id=p_contrato_id;
  if not found then raise exception 'COMERCIAL_CONTRATO_NAO_LOCALIZADO'; end if;

  select * into v_f
    from public.tabelas_comerciais_fontes
   where id=p_fonte_id and ativo;
  if not found then raise exception 'COMERCIAL_FONTE_NAO_LOCALIZADA'; end if;

  if v_f.empresa_id<>v_c.empresa_id then
    raise exception 'COMERCIAL_FONTE_EMPRESA_INCOMPATIVEL';
  end if;

  if not (
    public.comercial_pode_editar(v_c.empresa_id,v_c.unidade_id)
    or public.tabelas_comerciais_pode_editar(v_c.empresa_id,v_c.unidade_id)
  ) then
    raise exception 'COMERCIAL_SEM_PERMISSAO_EDITAR' using errcode='42501';
  end if;

  if p_categoria not in (
    'geral','procedimentos','cirurgias','sadt','honorarios','anestesia','auxiliares',
    'diarias','taxas','gases','materiais','medicamentos','opme','pacotes','outra'
  ) then
    raise exception 'COMERCIAL_CATEGORIA_INVALIDA';
  end if;

  select id into v_id
    from public.contrato_tabelas_comerciais
   where contrato_id=p_contrato_id
     and fonte_id=p_fonte_id
     and categoria=p_categoria
   for update;

  if v_id is null then
    insert into public.contrato_tabelas_comerciais(
      contrato_id,fonte_id,categoria,modo_edicao,prioridade,ativo
    ) values (
      p_contrato_id,p_fonte_id,p_categoria,coalesce(p_modo_edicao,'vigente_na_data'),
      coalesce(p_prioridade,100),true
    )
    returning id into v_id;
  end if;

  perform public.comercial_salvar_negociacao_tabela_v2(
    v_id,
    coalesce(p_modo_edicao,'vigente_na_data'),
    p_edicao_fixa_id,
    p_percentual_ajuste,
    p_valor_ch,
    p_valor_hm,
    p_valor_sadt,
    p_valor_uco,
    p_valor_filme_m2,
    p_base_preco,
    p_prioridade,
    p_urgencia_percentual,
    p_apartamento_percentual,
    p_horario_especial_percentual,
    p_arredondamento_casas,
    true,
    p_observacoes
  );

  return v_id;
end;
$$;

revoke all on function public.comercial_salvar_vinculo_tabela(
  uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,integer,numeric,numeric,numeric,integer,text
) from public, anon;
grant execute on function public.comercial_salvar_vinculo_tabela(
  uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,integer,numeric,numeric,numeric,integer,text
) to authenticated;

comment on function public.comercial_salvar_vinculo_tabela(
  uuid,uuid,text,text,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,integer,numeric,numeric,numeric,integer,text
) is 'Cria ou atualiza vínculo de tabela comercial com validação contextual e delega a negociação ao RPC v2.';
