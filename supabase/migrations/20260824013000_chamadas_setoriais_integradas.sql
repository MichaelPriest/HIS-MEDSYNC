-- Integra filas setoriais ao painel de chamadas.
-- Não altera dados clínicos; apenas garante setores operacionais e a leitura pública limitada do painel.

insert into public.setores_chamada (
  empresa_id,
  unidade_id,
  codigo,
  nome,
  prefixo,
  permite_totem,
  ativo,
  ordem
)
select u.empresa_id, u.id, v.codigo, v.nome, v.prefixo, false, true, v.ordem
from public.unidades u
cross join (
  values
    ('enfermagem'::text, 'Enfermagem'::text, 'E'::text, 35),
    ('internacao'::text, 'Internacao'::text, 'N'::text, 70)
) as v(codigo,nome,prefixo,ordem)
where u.ativo = true
on conflict (unidade_id,codigo)
do update set
  nome = excluded.nome,
  ativo = true,
  ordem = excluded.ordem;

create index if not exists idx_filas_setoriais_unidade_setor_status
  on public.filas_setoriais (unidade_id, setor_codigo, status, created_at);

create index if not exists idx_filas_setoriais_chamado_em
  on public.filas_setoriais (unidade_id, chamado_em desc)
  where chamado_em is not null;

drop function if exists public.listar_painel_chamadas(uuid);

create function public.listar_painel_chamadas(p_unidade_id uuid)
returns table(
  senha text,
  nome_chamada text,
  identificado boolean,
  setor_nome text,
  setor_codigo text,
  ponto_atendimento text,
  ultima_chamada_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  with chamadas as (
    select
      s.senha,
      case
        when coalesce(s.paciente_id,a.paciente_id) is not null
          then public.nome_painel_chamada(p.nome_completo)
        else null
      end as nome_chamada,
      coalesce(s.paciente_id,a.paciente_id) is not null as identificado,
      sc.nome as setor_nome,
      sc.codigo as setor_codigo,
      s.ponto_atendimento,
      s.ultima_chamada_em
    from public.senhas_atendimento s
    join public.setores_chamada sc on sc.id = s.setor_id
    left join public.atendimentos a on a.id = s.atendimento_id
    left join public.pacientes p on p.id = coalesce(s.paciente_id,a.paciente_id)
    where s.unidade_id = p_unidade_id
      and s.data_referencia = (now() at time zone 'America/Sao_Paulo')::date
      and s.ultima_chamada_em is not null
      and s.status in ('chamada','em_atendimento')

    union all

    select
      coalesce(sa.senha, 'A' || a.numero_atendimento::text) as senha,
      public.nome_painel_chamada(p.nome_completo) as nome_chamada,
      true as identificado,
      coalesce(sc.nome, initcap(replace(f.setor_codigo,'_',' '))) as setor_nome,
      f.setor_codigo,
      f.ponto_atendimento,
      f.chamado_em as ultima_chamada_em
    from public.filas_setoriais f
    join public.atendimentos a on a.id = f.atendimento_id
    join public.pacientes p on p.id = f.paciente_id
    left join public.setores_chamada sc
      on sc.unidade_id = f.unidade_id
     and sc.codigo = f.setor_codigo
    left join lateral (
      select s2.senha
      from public.senhas_atendimento s2
      where s2.atendimento_id = f.atendimento_id
      order by s2.created_at desc
      limit 1
    ) sa on true
    where f.unidade_id = p_unidade_id
      and f.chamado_em is not null
      and f.status in ('chamado','em_atendimento')
  )
  select
    c.senha,
    c.nome_chamada,
    c.identificado,
    c.setor_nome,
    c.setor_codigo,
    c.ponto_atendimento,
    c.ultima_chamada_em
  from chamadas c
  order by c.ultima_chamada_em desc
  limit 20
$$;

revoke all on function public.listar_painel_chamadas(uuid) from public;
grant execute on function public.listar_painel_chamadas(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
