-- Livro de Produção: consumo acumulado de pacote e autorização por evento/guia.

create table if not exists public.atendimento_pacote_consumos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  pacote_vinculo_id uuid not null references public.atendimento_pacotes_contratados(id) on delete cascade,
  pacote_item_id uuid not null references public.contrato_pacote_itens(id),
  producao_evento_id uuid not null references public.producao_assistencial_eventos(id) on delete cascade,
  tabela text null,
  codigo text not null,
  quantidade_evento numeric(14,4) not null check (quantidade_evento>0),
  quantidade_absorvida numeric(14,4) not null default 0 check (quantidade_absorvida>=0),
  quantidade_excedente numeric(14,4) not null default 0 check (quantidade_excedente>=0),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint atendimento_pacote_consumos_evento_uq unique (producao_evento_id,pacote_vinculo_id,pacote_item_id),
  constraint atendimento_pacote_consumos_soma_check check (abs((quantidade_absorvida+quantidade_excedente)-quantidade_evento)<0.0001)
);
create index if not exists idx_atendimento_pacote_consumos_atendimento
  on public.atendimento_pacote_consumos(atendimento_id,producao_evento_id);
create index if not exists idx_atendimento_pacote_consumos_vinculo
  on public.atendimento_pacote_consumos(pacote_vinculo_id,pacote_item_id,created_at);
alter table public.atendimento_pacote_consumos enable row level security;
drop policy if exists atendimento_pacote_consumos_select_escopo on public.atendimento_pacote_consumos;
create policy atendimento_pacote_consumos_select_escopo on public.atendimento_pacote_consumos
for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));

create table if not exists public.producao_autorizacao_consumos (
  id uuid primary key default extensions.gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  unidade_id uuid not null references public.unidades(id),
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  producao_evento_id uuid not null references public.producao_assistencial_eventos(id) on delete cascade,
  central_guia_id uuid not null references public.central_guias(id) on delete cascade,
  tabela text null,
  codigo text not null,
  quantidade_evento numeric(14,4) not null check (quantidade_evento>0),
  quantidade_alocada numeric(14,4) not null check (quantidade_alocada>0),
  created_at timestamptz not null default now(),
  created_by uuid null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint producao_autorizacao_consumos_evento_guia_uq unique (producao_evento_id,central_guia_id)
);
create index if not exists idx_producao_autorizacao_consumos_atendimento
  on public.producao_autorizacao_consumos(atendimento_id,producao_evento_id);
create index if not exists idx_producao_autorizacao_consumos_guia
  on public.producao_autorizacao_consumos(central_guia_id,created_at);
alter table public.producao_autorizacao_consumos enable row level security;
drop policy if exists producao_autorizacao_consumos_select_escopo on public.producao_autorizacao_consumos;
create policy producao_autorizacao_consumos_select_escopo on public.producao_autorizacao_consumos
for select to authenticated using (public.tem_unidade(empresa_id,unidade_id));

-- Somente leitura direta é permitida por RLS; escrita é derivada pelas funções internas SECURITY DEFINER.
revoke insert,update,delete on public.atendimento_pacote_consumos from anon,authenticated;
revoke insert,update,delete on public.producao_autorizacao_consumos from anon,authenticated;
grant select on public.atendimento_pacote_consumos to authenticated;
grant select on public.producao_autorizacao_consumos to authenticated;

-- O Livro usa origens próprias para itens derivados e excedentes.
alter table public.conta_faturamento_itens drop constraint if exists conta_faturamento_itens_origem_tipo_check;
alter table public.conta_faturamento_itens add constraint conta_faturamento_itens_origem_tipo_check
check (origem_tipo in (
  'procedimento','medicamento','material','opme','gas_medicinal','pacote','taxa','diaria','honorario',
  'laboratorio','imagem','exame','outro','producao','producao_excedente'
));

create or replace function public.resolver_evento_producao_contratual_internal(p_evento_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_e public.producao_assistencial_eventos%rowtype;
  v_at public.atendimentos%rowtype;
  v_contrato public.credenciamento_contratos%rowtype;
  v_map public.contrato_producao_mapeamentos%rowtype;
  v_item public.itens_assistenciais%rowtype;
  v_codigo text;
  v_tabela text;
  v_origem text := 'pendente';
  v_pacote_id uuid;
  v_pacote_vinculo_id uuid;
  v_pacote_item_id uuid;
  v_pacote_codigo text;
  v_pacote_nome text;
  v_pacote_valor numeric;
  v_quantidade_inclusa numeric;
  v_cobranca_excedente boolean;
  v_exige_autorizacao boolean := false;
  v_data date;
begin
  select * into v_e from public.producao_assistencial_eventos where id=p_evento_id;
  if not found then raise exception 'PRODUCAO_EVENTO_NAO_LOCALIZADO'; end if;
  select * into v_at from public.atendimentos where id=v_e.atendimento_id;
  v_data := (v_e.ocorrido_em at time zone 'America/Sao_Paulo')::date;

  if v_at.convenio_id is not null then
    select * into v_contrato
      from public.credenciamento_contratos c
     where c.empresa_id=v_e.empresa_id and c.convenio_id=v_at.convenio_id
       and (c.unidade_id is null or c.unidade_id=v_e.unidade_id) and c.status='ativo'
       and (c.data_inicio is null or c.data_inicio<=v_data) and (c.data_fim is null or c.data_fim>=v_data)
     order by case when c.unidade_id=v_e.unidade_id then 0 else 1 end,
              c.data_inicio desc nulls last,c.created_at desc,c.id
     limit 1;
  end if;

  if v_e.item_assistencial_id is not null then
    select * into v_item from public.itens_assistenciais
     where id=v_e.item_assistencial_id and empresa_id=v_e.empresa_id and ativo;
  end if;

  if v_contrato.id is not null then
    select * into v_map from public.contrato_producao_mapeamentos m
     where m.contrato_id=v_contrato.id and m.empresa_id=v_e.empresa_id
       and (m.unidade_id is null or m.unidade_id=v_e.unidade_id) and m.ativo and m.tipo_evento=v_e.tipo_evento
       and (m.acomodacao is null or lower(m.acomodacao)=lower(coalesce(v_e.metadados->>'acomodacao','')))
       and (m.setor is null or lower(m.setor)=lower(coalesce(v_e.setor,v_e.metadados->>'setor','')))
       and (m.vigencia_inicio is null or m.vigencia_inicio<=v_data) and (m.vigencia_fim is null or m.vigencia_fim>=v_data)
     order by case when m.acomodacao is not null then 0 else 1 end,
              case when m.setor is not null then 0 else 1 end,
              m.prioridade,m.vigencia_inicio desc nulls last,m.created_at desc,m.id
     limit 1;
  end if;

  v_exige_autorizacao := case
    when v_map.id is not null and v_map.exige_autorizacao is not null then v_map.exige_autorizacao
    when v_e.tipo_evento='sessao_tea_aba' and v_at.convenio_id is not null then true
    else false
  end;

  if v_map.id is not null then
    v_codigo:=v_map.codigo; v_tabela:=v_map.codigo_tabela; v_origem:='contrato';
    if v_map.item_assistencial_id is not null then
      select * into v_item from public.itens_assistenciais where id=v_map.item_assistencial_id and empresa_id=v_e.empresa_id and ativo;
    end if;
  elsif v_item.id is not null then
    v_codigo:=case when v_item.tabela_tiss_codigo in ('00','98') then v_item.codigo_tabela_propria else v_item.codigo_tuss end;
    v_tabela:=v_item.tabela_tiss_codigo; v_origem:='catalogo';
  elsif v_e.codigo_tuss_fallback is not null then
    v_codigo:=v_e.codigo_tuss_fallback; v_tabela:='22'; v_origem:='fallback';
  end if;

  if v_contrato.id is not null and v_codigo is not null then
    select ap.id,p.id,pi.id,p.codigo,p.nome,p.valor,pi.quantidade_inclusa,pi.cobranca_excedente
      into v_pacote_vinculo_id,v_pacote_id,v_pacote_item_id,v_pacote_codigo,v_pacote_nome,v_pacote_valor,v_quantidade_inclusa,v_cobranca_excedente
      from public.atendimento_pacotes_contratados ap
      join public.contrato_pacotes p on p.id=ap.pacote_id and p.contrato_id=ap.contrato_id
      join public.contrato_pacote_itens pi on pi.pacote_id=p.id and pi.codigo=v_codigo
     where ap.atendimento_id=v_e.atendimento_id and ap.empresa_id=v_e.empresa_id and ap.unidade_id=v_e.unidade_id
       and ap.contrato_id=v_contrato.id and ap.status='ativo' and p.ativo
       and (p.vigencia_inicio is null or p.vigencia_inicio<=v_data) and (p.vigencia_fim is null or p.vigencia_fim>=v_data)
       and (pi.tabela is null or pi.tabela=v_tabela)
     order by ap.aplicado_em,p.codigo,p.id,pi.id
     limit 1;
  end if;

  if v_pacote_id is not null then
    return jsonb_build_object(
      'status','pacote','contrato_id',v_contrato.id,'pacote_vinculo_id',v_pacote_vinculo_id,
      'pacote_id',v_pacote_id,'pacote_item_id',v_pacote_item_id,'pacote_codigo',v_pacote_codigo,
      'pacote_nome',v_pacote_nome,'pacote_valor',v_pacote_valor,'quantidade_inclusa',v_quantidade_inclusa,
      'cobranca_excedente',coalesce(v_cobranca_excedente,false),'codigo_evento',v_codigo,
      'tabela_evento',v_tabela,'item_assistencial_id',v_item.id,'origem_codigo',v_origem,
      'mapeamento_id',v_map.id,'exige_autorizacao',v_exige_autorizacao
    );
  end if;

  if v_codigo is null then
    return jsonb_build_object(
      'status','pendente_codigo','contrato_id',v_contrato.id,'origem_codigo','pendente',
      'exige_autorizacao',v_exige_autorizacao,
      'motivo',case when v_e.tipo_evento in ('diaria','taxa') then 'codigo_deve_ser_configurado_no_contrato' else 'codigo_nao_resolvido' end
    );
  end if;

  return jsonb_build_object(
    'status','individual','contrato_id',v_contrato.id,'codigo_evento',v_codigo,
    'tabela_evento',coalesce(v_tabela,'22'),'item_assistencial_id',v_item.id,
    'origem_codigo',v_origem,'mapeamento_id',v_map.id,'exige_autorizacao',v_exige_autorizacao
  );
end $$;
revoke execute on function public.resolver_evento_producao_contratual_internal(uuid) from public,anon,authenticated;

create or replace function public.consolidar_producao_conta_internal(p_atendimento_id uuid,p_conta_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,pg_catalog,extensions
as $$
declare
  v_conta public.contas_faturamento%rowtype;
  v_at public.atendimentos%rowtype;
  r record; g record; v_res jsonb; v_status text; v_codigo text; v_tabela text; v_item_id uuid;
  v_pacote_id uuid; v_pacote_vinculo_id uuid; v_pacote_item_id uuid; v_pacote_codigo text; v_pacote_valor numeric;
  v_qtd_inclusa numeric; v_qtd_usada numeric; v_qtd_absorvida numeric; v_excedente numeric; v_cobranca_excedente boolean;
  v_exige_autorizacao boolean; v_auth_restante numeric; v_auth_alocada numeric; v_auth_limite numeric; v_auth_usada numeric;
  v_auth_disponivel numeric; v_auth_parcial numeric; v_auth_status text; v_auth_primeira_guia uuid; v_auth_guias integer;
  v_auth_json jsonb; v_evento_cobravel boolean;
  v_inserted integer:=0; v_pendentes integer:=0; v_pacotes integer:=0; v_auth_pendentes integer:=0;
begin
  select * into v_conta from public.contas_faturamento where id=p_conta_id and atendimento_id=p_atendimento_id;
  if not found then raise exception 'PRODUCAO_CONTA_INVALIDA'; end if;
  select * into v_at from public.atendimentos where id=p_atendimento_id;
  if v_conta.status in ('pronta','faturada','cancelada') then
    return jsonb_build_object('preservada',true,'status',v_conta.status,'itens',0);
  end if;

  delete from public.producao_autorizacao_consumos where atendimento_id=p_atendimento_id;
  delete from public.atendimento_pacote_consumos where atendimento_id=p_atendimento_id;
  delete from public.conta_faturamento_itens
   where conta_id=p_conta_id
     and (origem_tipo in ('producao','producao_excedente')
       or (origem_tipo='pacote' and memoria_calculo->>'origem'='livro_producao'));
  update public.producao_assistencial_eventos set autorizacao_id=null,updated_at=now()
   where atendimento_id=p_atendimento_id;

  for r in select * from public.producao_assistencial_eventos e
    where e.atendimento_id=p_atendimento_id and e.empresa_id=v_conta.empresa_id and e.unidade_id=v_conta.unidade_id
      and e.status not in ('cancelado','estornado') order by e.ocorrido_em,e.created_at,e.id
  loop
    v_res:=public.resolver_evento_producao_contratual_internal(r.id);
    v_status:=v_res->>'status'; v_codigo:=v_res->>'codigo_evento'; v_tabela:=v_res->>'tabela_evento';
    v_item_id:=nullif(v_res->>'item_assistencial_id','')::uuid;
    v_pacote_id:=nullif(v_res->>'pacote_id','')::uuid;
    v_pacote_vinculo_id:=nullif(v_res->>'pacote_vinculo_id','')::uuid;
    v_pacote_item_id:=nullif(v_res->>'pacote_item_id','')::uuid;
    v_pacote_codigo:=v_res->>'pacote_codigo';
    v_pacote_valor:=coalesce((v_res->>'pacote_valor')::numeric,0);
    v_qtd_inclusa:=nullif(v_res->>'quantidade_inclusa','')::numeric;
    v_cobranca_excedente:=coalesce((v_res->>'cobranca_excedente')::boolean,false);
    v_exige_autorizacao:=coalesce((v_res->>'exige_autorizacao')::boolean,false);

    v_auth_alocada:=0; v_auth_restante:=r.quantidade; v_auth_primeira_guia:=null; v_auth_guias:=0;
    if v_exige_autorizacao and v_codigo is not null then
      for g in select cg.* from public.central_guias cg
        where cg.empresa_id=r.empresa_id and cg.unidade_id=r.unidade_id and cg.status='autorizada'
          and cg.convenio_id=v_at.convenio_id
          and (cg.atendimento_id=p_atendimento_id or (cg.atendimento_id is null and cg.paciente_id=v_at.paciente_id))
          and cg.codigo_procedimento in (v_codigo,coalesce(v_pacote_codigo,v_codigo))
          and (cg.validade_senha is null or cg.validade_senha >= (r.ocorrido_em at time zone 'America/Sao_Paulo')::date)
        order by case when cg.atendimento_id=p_atendimento_id then 0 else 1 end,
                 case when cg.codigo_procedimento=v_codigo then 0 else 1 end,
                 cg.validade_senha nulls last,cg.data_solicitacao,cg.created_at,cg.id
      loop
        v_auth_guias:=v_auth_guias+1;
        v_auth_limite:=greatest(coalesce(g.quantidade_autorizada,g.quantidade_solicitada,0),0);
        select coalesce(sum(c.quantidade_alocada),0) into v_auth_usada from public.producao_autorizacao_consumos c where c.central_guia_id=g.id;
        v_auth_disponivel:=greatest(v_auth_limite-v_auth_usada,0);
        v_auth_parcial:=least(v_auth_restante,v_auth_disponivel);
        if v_auth_parcial>0 then
          insert into public.producao_autorizacao_consumos(
            empresa_id,unidade_id,atendimento_id,producao_evento_id,central_guia_id,tabela,codigo,
            quantidade_evento,quantidade_alocada,created_by,updated_by
          ) values (
            r.empresa_id,r.unidade_id,r.atendimento_id,r.id,g.id,v_tabela,v_codigo,r.quantidade,v_auth_parcial,auth.uid(),auth.uid()
          );
          v_auth_primeira_guia:=coalesce(v_auth_primeira_guia,g.id);
          v_auth_alocada:=v_auth_alocada+v_auth_parcial;
          v_auth_restante:=greatest(v_auth_restante-v_auth_parcial,0);
          exit when v_auth_restante<=0.0001;
        end if;
      end loop;
      v_auth_status:=case when v_auth_restante<=0.0001 then 'autorizada' when v_auth_guias=0 then 'ausente' else 'insuficiente' end;
      if v_auth_status<>'autorizada' then v_auth_pendentes:=v_auth_pendentes+1; end if;
    elsif v_exige_autorizacao then
      v_auth_status:='codigo_pendente'; v_auth_pendentes:=v_auth_pendentes+1;
    else
      v_auth_status:='nao_exigida'; v_auth_alocada:=r.quantidade;
    end if;

    update public.producao_assistencial_eventos
       set autorizacao_id=v_auth_primeira_guia,updated_at=now(),updated_by=auth.uid(),
           metadados=metadados||jsonb_build_object('autorizacao_status',v_auth_status,'autorizacao_exigida',v_exige_autorizacao,'quantidade_autorizacao_alocada',v_auth_alocada)
     where id=r.id;

    v_auth_json:=jsonb_build_object('exigida',v_exige_autorizacao,'status',v_auth_status,'quantidade_evento',r.quantidade,'quantidade_alocada',v_auth_alocada,'guia_id',v_auth_primeira_guia);
    v_evento_cobravel:=r.cobravel and (not v_exige_autorizacao or v_auth_status='autorizada');

    if v_status='pacote' then
      select coalesce(sum(c.quantidade_absorvida),0) into v_qtd_usada
        from public.atendimento_pacote_consumos c
       where c.pacote_vinculo_id=v_pacote_vinculo_id and c.pacote_item_id=v_pacote_item_id;
      if v_qtd_inclusa is null then v_qtd_absorvida:=r.quantidade;
      else v_qtd_absorvida:=least(r.quantidade,greatest(v_qtd_inclusa-v_qtd_usada,0)); end if;
      v_excedente:=greatest(r.quantidade-v_qtd_absorvida,0);

      insert into public.atendimento_pacote_consumos(
        empresa_id,unidade_id,atendimento_id,pacote_vinculo_id,pacote_item_id,producao_evento_id,tabela,codigo,
        quantidade_evento,quantidade_absorvida,quantidade_excedente,created_by,updated_by
      ) values (
        r.empresa_id,r.unidade_id,r.atendimento_id,v_pacote_vinculo_id,v_pacote_item_id,r.id,v_tabela,v_codigo,
        r.quantidade,v_qtd_absorvida,v_excedente,auth.uid(),auth.uid()
      );

      insert into public.conta_faturamento_itens(
        conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,
        valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,
        familia_tuss,pacote_id,memoria_calculo
      ) values (
        p_conta_id,'pacote',v_pacote_vinculo_id,null,r.ocorrido_em,'98',v_pacote_codigo,coalesce(v_res->>'pacote_nome','Pacote contratual'),1,
        v_pacote_valor,v_pacote_valor,null,r.setor,true,'Pacote explicitamente aplicado ao atendimento; prioridade sobre itens individuais.',
        null,'pacote',null,v_pacote_id,jsonb_build_object('origem','livro_producao','pacote_vinculo_id',v_pacote_vinculo_id)
      ) on conflict (conta_id,origem_tipo,origem_id) do update set
        valor_unitario=excluded.valor_unitario,valor_total=excluded.valor_total,pacote_id=excluded.pacote_id,memoria_calculo=excluded.memoria_calculo;

      if v_exige_autorizacao and v_auth_status<>'autorizada' then
        update public.conta_faturamento_itens set cobravel=false,observacao='Pacote bloqueado: há produção com autorização ausente ou insuficiente.'
         where conta_id=p_conta_id and origem_tipo='pacote' and origem_id=v_pacote_vinculo_id;
      end if;

      if v_qtd_absorvida>0 then
        insert into public.conta_faturamento_itens(
          conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,
          valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,
          familia_tuss,pacote_id,memoria_calculo
        ) values (
          p_conta_id,'producao',r.id,r.id,r.ocorrido_em,v_tabela,v_codigo,
          coalesce((select descricao from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),replace(r.tipo_evento,'_',' ')),
          v_qtd_absorvida,0,0,r.profissional_id,r.setor,false,
          case when v_exige_autorizacao and v_auth_status<>'autorizada' then 'Produção no pacote, porém com autorização ausente/insuficiente.' else 'Produção absorvida pelo pacote contratual.' end,
          coalesce(v_item_id,r.item_assistencial_id),'procedimento',
          (select familia_tuss from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),v_pacote_id,
          jsonb_build_object('origem','livro_producao','resolucao',v_res,'autorizacao',v_auth_json,'quantidade_total',r.quantidade,'quantidade_absorvida',v_qtd_absorvida,'quantidade_excedente',v_excedente)
        );
      end if;

      if v_excedente>0 then
        insert into public.conta_faturamento_itens(
          conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,
          valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,
          familia_tuss,pacote_id,memoria_calculo
        ) values (
          p_conta_id,'producao_excedente',r.id,r.id,r.ocorrido_em,v_tabela,v_codigo,
          coalesce((select descricao from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),replace(r.tipo_evento,'_',' ')),
          v_excedente,0,0,r.profissional_id,r.setor,(v_cobranca_excedente and v_evento_cobravel),
          case when not v_cobranca_excedente then 'Excedente ao pacote não cobravel pelo contrato.'
               when v_exige_autorizacao and v_auth_status<>'autorizada' then 'Excedente bloqueado por autorização ausente/insuficiente.'
               else 'Quantidade excedente ao pacote; precificar pelo contrato.' end,
          coalesce(v_item_id,r.item_assistencial_id),'procedimento',
          (select familia_tuss from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),v_pacote_id,
          jsonb_build_object('origem','livro_producao','resolucao',v_res,'autorizacao',v_auth_json,'quantidade_excedente',v_excedente)
        );
      end if;
      v_pacotes:=v_pacotes+1;
    else
      insert into public.conta_faturamento_itens(
        conta_id,origem_tipo,origem_id,producao_evento_id,data_execucao,tabela,codigo,descricao,quantidade,
        valor_unitario,valor_total,profissional_id,setor,cobravel,observacao,item_assistencial_id,categoria_item,familia_tuss,memoria_calculo
      ) values (
        p_conta_id,'producao',r.id,r.id,r.ocorrido_em,v_tabela,v_codigo,
        coalesce((select descricao from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),replace(r.tipo_evento,'_',' ')),
        r.quantidade,0,0,r.profissional_id,r.setor,(v_evento_cobravel and v_status='individual'),
        case when v_status='pendente_codigo' then 'Pendente: código deve ser resolvido/configurado no contrato antes da cobrança.'
             when v_exige_autorizacao and v_auth_status='ausente' then 'Bloqueado: nenhuma guia autorizada válida cobre esta produção.'
             when v_exige_autorizacao and v_auth_status='insuficiente' then format('Bloqueado: autorização insuficiente (%s de %s unidade(s) cobertas).',v_auth_alocada,r.quantidade)
             when v_exige_autorizacao and v_auth_status='codigo_pendente' then 'Bloqueado: autorização não pode ser conciliada enquanto o código contratual estiver pendente.'
             else 'Gerado automaticamente pelo Livro de Produção Assistencial.' end,
        coalesce(v_item_id,r.item_assistencial_id),
        case when r.tipo_evento='diaria' then 'diaria' when r.tipo_evento='taxa' then 'taxa'
             when r.tipo_evento='medicamento' then 'medicamento' when r.tipo_evento='material' then 'material'
             when r.tipo_evento='opme' then 'opme' when r.tipo_evento='gas_medicinal' then 'gas_medicinal' else 'procedimento' end,
        (select familia_tuss from public.itens_assistenciais where id=coalesce(v_item_id,r.item_assistencial_id)),
        jsonb_build_object('origem','livro_producao','resolucao',v_res,'autorizacao',v_auth_json)
      );
      if v_status='pendente_codigo' then v_pendentes:=v_pendentes+1; end if;
    end if;

    update public.producao_assistencial_eventos
       set status='consolidado',consolidado_em=coalesce(consolidado_em,now()),updated_at=now(),updated_by=auth.uid()
     where id=r.id;
    v_inserted:=v_inserted+1;
  end loop;

  return jsonb_build_object('eventos_processados',v_inserted,'pendentes_codigo',v_pendentes,'eventos_em_pacote',v_pacotes,'autorizacoes_pendentes',v_auth_pendentes);
end $$;
revoke execute on function public.consolidar_producao_conta_internal(uuid,uuid) from public,anon,authenticated;
