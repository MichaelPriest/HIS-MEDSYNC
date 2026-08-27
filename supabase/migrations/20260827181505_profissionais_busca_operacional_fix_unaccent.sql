create or replace function public.buscar_profissionais_operacionais(
  p_empresa uuid,
  p_busca text default null,
  p_limite integer default 30
)
returns table(
  id uuid,
  nome_completo text,
  conselho text,
  numero_conselho text,
  uf_conselho text,
  especialidade text,
  cbo text,
  cpf_mascarado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca,'')), '');
  v_busca_normalizada text;
  v_busca_digitos text;
  v_limite integer := greatest(1, least(coalesce(p_limite,30), 50));
begin
  if (select auth.uid()) is null then
    raise exception 'PROFISSIONAL_AUTENTICACAO_OBRIGATORIA' using errcode='42501';
  end if;
  if not public.tem_empresa(p_empresa) then
    raise exception 'PROFISSIONAL_EMPRESA_SEM_ACESSO' using errcode='42501';
  end if;
  if v_busca is null or length(v_busca) < 2 then
    return;
  end if;

  v_busca_normalizada := extensions.unaccent(lower(v_busca));
  v_busca_digitos := regexp_replace(v_busca, '\D', '', 'g');

  return query
  select
    p.id,
    p.nome_completo,
    p.conselho,
    p.numero_conselho,
    p.uf_conselho,
    p.especialidade,
    p.cbo,
    case
      when length(regexp_replace(coalesce(p.cpf,''), '\D', '', 'g')) = 11
        then '***.***.***-' || right(regexp_replace(p.cpf, '\D', '', 'g'), 2)
      else null
    end as cpf_mascarado
  from public.profissionais p
  where p.empresa_id = p_empresa
    and p.ativo
    and (
      extensions.unaccent(lower(p.nome_completo)) like '%' || v_busca_normalizada || '%'
      or (length(v_busca_digitos) >= 2 and regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') like '%' || v_busca_digitos || '%')
      or extensions.unaccent(lower(coalesce(p.conselho,''))) like '%' || v_busca_normalizada || '%'
      or extensions.unaccent(lower(coalesce(p.numero_conselho,''))) like '%' || v_busca_normalizada || '%'
      or extensions.unaccent(lower(coalesce(p.uf_conselho,''))) like '%' || v_busca_normalizada || '%'
      or extensions.unaccent(lower(coalesce(p.especialidade,''))) like '%' || v_busca_normalizada || '%'
      or extensions.unaccent(lower(coalesce(p.cbo,''))) like '%' || v_busca_normalizada || '%'
      or extensions.unaccent(lower(concat_ws(' ', p.conselho, p.numero_conselho, p.uf_conselho))) like '%' || v_busca_normalizada || '%'
    )
  order by
    case when extensions.unaccent(lower(p.nome_completo)) = v_busca_normalizada then 0 else 1 end,
    p.nome_completo
  limit v_limite;
end;
$$;

revoke all on function public.buscar_profissionais_operacionais(uuid,text,integer) from public, anon;
grant execute on function public.buscar_profissionais_operacionais(uuid,text,integer) to authenticated;
