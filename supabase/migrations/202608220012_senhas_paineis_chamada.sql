begin;

create type public.status_senha as enum ('aguardando','chamada','em_atendimento','finalizada','cancelada');
create type public.prioridade_senha as enum ('normal','preferencial','emergencia');

create table public.setores_chamada (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  codigo text not null,
  nome text not null,
  prefixo text not null check (char_length(prefixo) between 1 and 3),
  permite_totem boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique(unidade_id,codigo),
  unique(unidade_id,prefixo)
);

create table public.senhas_atendimento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas,
  unidade_id uuid not null references public.unidades,
  setor_id uuid not null references public.setores_chamada,
  data_referencia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  sequencial integer not null,
  senha text not null,
  prioridade public.prioridade_senha not null default 'normal',
  status public.status_senha not null default 'aguardando',
  paciente_id uuid references public.pacientes,
  atendimento_id uuid references public.atendimentos,
  emitida_em timestamptz not null default now(),
  primeira_chamada_em timestamptz,
  ultima_chamada_em timestamptz,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  chamado_por uuid references auth.users,
  ponto_atendimento text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users,
  unique(unidade_id,data_referencia,senha),
  unique(atendimento_id)
);
create index senhas_fila_idx on public.senhas_atendimento(unidade_id,setor_id,data_referencia,status,prioridade,sequencial);
create index senhas_chamadas_idx on public.senhas_atendimento(unidade_id,ultima_chamada_em desc) where ultima_chamada_em is not null;

alter table public.atendimentos add column if not exists senha_id uuid references public.senhas_atendimento;
create unique index if not exists atendimentos_senha_unique on public.atendimentos(senha_id) where senha_id is not null;

alter table public.setores_chamada enable row level security;
alter table public.setores_chamada force row level security;
alter table public.senhas_atendimento enable row level security;
alter table public.senhas_atendimento force row level security;

create policy setores_chamada_select_auth on public.setores_chamada for select to authenticated
using (public.tem_unidade(empresa_id,unidade_id));
create policy senhas_select_auth on public.senhas_atendimento for select to authenticated
using (public.tem_unidade(empresa_id,unidade_id) and (public.tem_permissao(empresa_id,unidade_id,'recepcao.visualizar') or public.tem_permissao(empresa_id,unidade_id,'atendimentos.visualizar')));
create policy senhas_update_auth on public.senhas_atendimento for update to authenticated
using (public.tem_unidade(empresa_id,unidade_id) and public.tem_permissao(empresa_id,unidade_id,'recepcao.visualizar'))
with check (public.tem_unidade(empresa_id,unidade_id) and updated_by=auth.uid());

revoke insert,delete,truncate on public.senhas_atendimento from anon,authenticated;
revoke insert,update,delete,truncate on public.setores_chamada from anon,authenticated;

insert into public.permissoes(codigo,descricao) values
('senhas.visualizar','Visualizar filas e senhas'),
('senhas.chamar','Chamar e encaminhar senhas'),
('paineis.visualizar','Visualizar painéis de chamada')
on conflict (codigo) do nothing;

create or replace function public.emitir_senha_totem(p_unidade_id uuid, p_setor_codigo text, p_prioridade public.prioridade_senha default 'normal')
returns table(id uuid, senha text, emitida_em timestamptz, setor_nome text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_setor public.setores_chamada%rowtype;
  v_seq integer;
  v_data date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id uuid;
  v_senha text;
begin
  select * into v_setor from public.setores_chamada
  where unidade_id=p_unidade_id and codigo=p_setor_codigo and ativo and permite_totem
  limit 1;
  if not found then raise exception 'Setor indisponível no totem'; end if;

  perform pg_advisory_xact_lock(hashtext(p_unidade_id::text || v_data::text || v_setor.id::text));
  select coalesce(max(s.sequencial),0)+1 into v_seq from public.senhas_atendimento s
  where s.unidade_id=p_unidade_id and s.setor_id=v_setor.id and s.data_referencia=v_data;
  v_senha := upper(v_setor.prefixo) || lpad(v_seq::text,3,'0');

  insert into public.senhas_atendimento(empresa_id,unidade_id,setor_id,data_referencia,sequencial,senha,prioridade)
  values(v_setor.empresa_id,p_unidade_id,v_setor.id,v_data,v_seq,v_senha,p_prioridade)
  returning senhas_atendimento.id into v_id;
  return query select v_id,v_senha,now(),v_setor.nome;
end;
$$;
grant execute on function public.emitir_senha_totem(uuid,text,public.prioridade_senha) to anon,authenticated;

create or replace function public.listar_painel_chamadas(p_unidade_id uuid)
returns table(senha text,setor_nome text,ponto_atendimento text,ultima_chamada_em timestamptz)
language sql
security definer
set search_path=public
as $$
  select s.senha,sc.nome,s.ponto_atendimento,s.ultima_chamada_em
  from public.senhas_atendimento s join public.setores_chamada sc on sc.id=s.setor_id
  where s.unidade_id=p_unidade_id and s.data_referencia=(now() at time zone 'America/Sao_Paulo')::date
    and s.ultima_chamada_em is not null and s.status in ('chamada','em_atendimento')
  order by s.ultima_chamada_em desc limit 8
$$;
grant execute on function public.listar_painel_chamadas(uuid) to anon,authenticated;

commit;