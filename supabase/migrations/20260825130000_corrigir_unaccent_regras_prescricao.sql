-- Corrige falha ao salvar prescrições causada pelo uso de unaccent fora do search_path.
-- Mantém a função de segurança clínica determinística e compatível com o schema extensions do Supabase.

create extension if not exists unaccent with schema extensions;

create or replace function public.validar_regras_seguranca_prescricao()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_item record;
  v_regra record;
  v_administracoes integer;
  v_principio text;
  v_descricao text;
begin
  if new.tipo <> 'medicamento' or new.item_assistencial_id is null then
    return new;
  end if;

  select ia.principio_ativo, ia.descricao, ia.apresentacao
    into v_item
  from public.itens_assistenciais ia
  where ia.id = new.item_assistencial_id
    and ia.empresa_id = new.empresa_id
    and ia.ativo = true;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'REGRA_PRESCRICAO: medicamento não encontrado ou inativo no catálogo assistencial.';
  end if;

  v_principio := lower(extensions.unaccent(coalesce(v_item.principio_ativo, v_item.descricao, '')));
  v_descricao := lower(extensions.unaccent(coalesce(v_item.descricao, '')));
  v_administracoes := public.prescricao_administracoes_planejadas(new.frequencia, new.horarios);

  for v_regra in
    select r.*
    from public.prescricao_regras_seguranca r
    where r.ativo = true
      and (r.empresa_id is null or r.empresa_id = new.empresa_id)
      and (r.vigencia_inicio is null or r.vigencia_inicio <= current_date)
      and (r.vigencia_fim is null or r.vigencia_fim >= current_date)
      and (
        v_principio like '%' || lower(extensions.unaccent(r.principio_ativo_match)) || '%'
        or v_descricao like '%' || lower(extensions.unaccent(r.principio_ativo_match)) || '%'
      )
      and (
        r.apresentacao_match is null
        or lower(extensions.unaccent(coalesce(v_item.apresentacao, ''))) like '%' || lower(extensions.unaccent(r.apresentacao_match)) || '%'
      )
      and (
        r.via_match is null
        or lower(extensions.unaccent(coalesce(new.via, ''))) like '%' || lower(extensions.unaccent(r.via_match)) || '%'
      )
    order by case when r.empresa_id is not null then 0 else 1 end, r.created_at desc
  loop
    if v_regra.max_administracoes_24h is not null
       and v_administracoes > v_regra.max_administracoes_24h
       and v_regra.severidade = 'bloqueante' then
      raise exception using
        errcode = 'P0001',
        message = 'REGRA_PRESCRICAO: ' || v_regra.mensagem,
        detail = coalesce(v_regra.fonte_referencia, v_regra.fonte_tipo),
        hint = coalesce(v_regra.fonte_url, 'Revise a regra clínica cadastrada.');
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.validar_regras_seguranca_prescricao() from public, anon, authenticated;
