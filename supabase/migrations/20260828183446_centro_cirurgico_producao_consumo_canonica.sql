create or replace function public.registrar_producao_consumos_estoque_cirurgia()
returns trigger
language plpgsql security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  r record;
  v_net numeric;
  v_categoria text;
  v_tipo_evento text;
  v_codigo text;
  v_prof uuid;
begin
  if new.status='concluida' and old.status is distinct from new.status then
    v_prof:=coalesce(new.cirurgiao_id,public.profissional_logado(new.empresa_id));
    for r in
      select
        m.*,
        p.tipo as produto_tipo,
        p.codigo as produto_codigo,
        p.codigo_tuss as produto_codigo_tuss,
        case when i.id is not null then p.item_assistencial_id else null end as item_assistencial_id,
        p.descricao as produto_descricao,
        i.codigo_tuss as item_codigo_tuss,
        i.codigo_tabela_propria,
        i.descricao as item_descricao,
        l.numero_lote,
        l.local_id
      from public.estoque_movimentos m
      join public.estoque_produtos p on p.id=m.produto_id
      left join public.itens_assistenciais i on i.id=p.item_assistencial_id and i.empresa_id=new.empresa_id and i.ativo=true
      left join public.estoque_lotes l on l.id=m.lote_id
      where m.cirurgia_id=new.id
        and m.tipo='consumo_paciente'
        and m.cirurgia_opme_id is null
        and p.tipo in ('material','gas_medicinal')
    loop
      select greatest(r.quantidade-coalesce(sum(d.quantidade),0),0)
      into v_net
      from public.estoque_movimentos d
      where d.movimento_origem_id=r.id and d.tipo='devolucao';

      if coalesce(v_net,0)>0 then
        v_tipo_evento:=case
          when r.produto_tipo='material' then 'material'
          when r.produto_tipo='gas_medicinal' then 'gas_medicinal'
          else 'outro'
        end;
        v_categoria:=case
          when r.produto_tipo='material' then 'materiais'
          when r.produto_tipo='gas_medicinal' then 'gases'
          else 'outros'
        end;
        v_codigo:=coalesce(
          nullif(btrim(r.item_codigo_tuss),''),
          nullif(btrim(r.codigo_tabela_propria),''),
          nullif(btrim(r.produto_codigo_tuss),''),
          nullif(btrim(r.produto_codigo),'')
        );

        perform public.registrar_evento_producao_assistencial_internal(
          new.atendimento_id,
          v_tipo_evento,
          'estoque_movimento_cirurgia',
          r.id,
          coalesce(new.fim_em,r.created_at,now()),
          v_net,
          v_categoria,
          v_prof,
          'centro_cirurgico',
          null,
          r.item_assistencial_id,
          v_codigo,
          true,
          jsonb_build_object(
            'cirurgia_id',new.id,
            'produto_id',r.produto_id,
            'tipo_produto',r.produto_tipo,
            'descricao',coalesce(r.item_descricao,r.produto_descricao),
            'estoque_lote_id',r.lote_id,
            'numero_lote',r.numero_lote,
            'local_origem_id',r.local_origem_id,
            'movimento_id',r.id,
            'quantidade_consumida',r.quantidade,
            'quantidade_liquida',v_net,
            'requisicao_setorial_id',r.requisicao_setorial_id,
            'requisicao_setorial_item_id',r.requisicao_setorial_item_id
          )
        );
      end if;
    end loop;
  end if;
  return new;
end $$;
