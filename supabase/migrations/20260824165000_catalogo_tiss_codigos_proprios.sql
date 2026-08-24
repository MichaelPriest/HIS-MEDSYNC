-- Códigos próprios usados no intercâmbio TISS.
-- ANS: tabela 00 = tabela própria das operadoras; tabela 98 = pacotes.

alter table public.itens_assistenciais
  add column if not exists codigo_tabela_propria text null;

alter table public.itens_assistenciais
  drop constraint if exists itens_assistenciais_codigo_proprio_tamanho_check;
alter table public.itens_assistenciais
  add constraint itens_assistenciais_codigo_proprio_tamanho_check check (
    codigo_tabela_propria is null or char_length(codigo_tabela_propria) <= 10
  );

-- Pacotes não podem chegar ao faturamento sem o código próprio que acompanha a tabela 98.
alter table public.itens_assistenciais
  drop constraint if exists itens_assistenciais_pacote_codigo_check;
alter table public.itens_assistenciais
  add constraint itens_assistenciais_pacote_codigo_check check (
    categoria <> 'pacote'
    or (tabela_tiss_codigo = '98' and codigo_tabela_propria is not null and char_length(codigo_tabela_propria) between 1 and 10)
  );

create index if not exists idx_itens_assistenciais_codigo_proprio
  on public.itens_assistenciais (empresa_id, codigo_tabela_propria)
  where codigo_tabela_propria is not null;

alter table public.tabelas_comerciais_itens
  add column if not exists codigo_tabela_propria text null;

alter table public.tabelas_comerciais_itens
  drop constraint if exists tabelas_comerciais_itens_codigo_proprio_tamanho_check;
alter table public.tabelas_comerciais_itens
  add constraint tabelas_comerciais_itens_codigo_proprio_tamanho_check check (
    codigo_tabela_propria is null or char_length(codigo_tabela_propria) <= 10
  );

-- Para o estoque legado, aproveita o código interno como sugestão somente quando cabe no limite TISS.
-- Registros que não couberem permanecem pendentes de mapeamento com a operadora e são bloqueados na validação da conta.
update public.itens_assistenciais
set codigo_tabela_propria = codigo_interno
where tabela_tiss_codigo = '00'
  and codigo_tabela_propria is null
  and char_length(codigo_interno) <= 10;
