create or replace function public.nome_painel_chamada(p_nome text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(trim(p_nome),'') = '' then null
    when array_length(regexp_split_to_array(trim(p_nome),'\s+'),1) = 1 then upper(trim(p_nome))
    else upper(
      (regexp_split_to_array(trim(p_nome),'\s+'))[1]
      || ' '
      || left((regexp_split_to_array(trim(p_nome),'\s+'))[array_length(regexp_split_to_array(trim(p_nome),'\s+'),1)],1)
      || '.'
    )
  end;
$$;

create or replace function public.listar_painel_chamadas(p_unidade_id uuid)
returns table(
  senha text,
  nome_chamada text,
  identificado boolean,
  setor_nome text,
  ponto_atendimento text,
  ultima_chamada_em timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    s.senha,
    case when s.atendimento_id is not null then public.nome_painel_chamada(p.nome_completo) else null end as nome_chamada,
    s.atendimento_id is not null as identificado,
    sc.nome,
    s.ponto_atendimento,
    s.ultima_chamada_em
  from public.senhas_atendimento s
  join public.setores_chamada sc on sc.id=s.setor_id
  left join public.atendimentos a on a.id=s.atendimento_id
  left join public.pacientes p on p.id=coalesce(s.paciente_id,a.paciente_id)
  where s.unidade_id=p_unidade_id
    and s.data_referencia=(now() at time zone 'America/Sao_Paulo')::date
    and s.ultima_chamada_em is not null
    and s.status in ('chamada','em_atendimento')
  order by s.ultima_chamada_em desc
  limit 8;
$$;

grant execute on function public.nome_painel_chamada(text) to anon,authenticated;
grant execute on function public.listar_painel_chamadas(uuid) to anon,authenticated;
