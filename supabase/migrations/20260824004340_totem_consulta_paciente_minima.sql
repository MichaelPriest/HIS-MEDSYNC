create or replace function public.consultar_paciente_totem(
  p_unidade_id uuid,
  p_cpf text
)
returns table(
  localizado boolean,
  nome_exibicao text,
  cpf_final text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_empresa_id uuid;
  v_cpf text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
  v_nome text;
begin
  if length(v_cpf) <> 11 then
    raise exception using errcode='P0001', message='TOTEM_CPF_INVALIDO';
  end if;

  select u.empresa_id into v_empresa_id
  from public.unidades u
  where u.id = p_unidade_id and u.ativo
  limit 1;

  if v_empresa_id is null then
    raise exception using errcode='P0001', message='TOTEM_UNIDADE_INDISPONIVEL';
  end if;

  select coalesce(nullif(trim(p.nome_social),''), p.nome_completo)
    into v_nome
  from public.pacientes p
  where p.empresa_id = v_empresa_id
    and p.cpf = v_cpf
    and p.ativo
  limit 1;

  if v_nome is null then
    return query select false, null::text, right(v_cpf,2);
    return;
  end if;

  return query
  select true,
         case
           when position(' ' in trim(v_nome)) = 0 then upper(trim(v_nome))
           else upper(split_part(trim(v_nome),' ',1) || ' ' || left(reverse(split_part(reverse(trim(v_nome)),' ',1)),1) || '.')
         end,
         right(v_cpf,2);
end;
$$;

revoke all on function public.consultar_paciente_totem(uuid,text) from public;
grant execute on function public.consultar_paciente_totem(uuid,text) to anon, authenticated;
comment on function public.consultar_paciente_totem(uuid,text) is
'Consulta publica minima para Totem: valida CPF exato dentro da unidade e devolve apenas nome abreviado e dois ultimos digitos do CPF.';
notify pgrst, 'reload schema';
