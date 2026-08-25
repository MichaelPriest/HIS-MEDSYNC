create or replace function public.nome_painel_chamada(p_nome text)
returns text
language sql
immutable
as $$
  select nullif(upper(trim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'))),'');
$$;

comment on function public.nome_painel_chamada(text) is
'Normaliza o nome completo do paciente para exibicao e chamada nos paineis assistenciais.';

notify pgrst, 'reload schema';
