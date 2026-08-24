-- Vincula resultados ao analito técnico e reforça rastreabilidade única por unidade.
alter table public.laboratorio_resultados add column if not exists catalogo_analito_id uuid references public.laboratorio_catalogo_analitos(id) on delete set null;
create unique index if not exists ux_laboratorio_accession on public.laboratorio_amostras(unidade_id,accession_number) where accession_number is not null and btrim(accession_number)<>'';
create unique index if not exists ux_imagem_accession on public.imagem_execucoes(unidade_id,accession_number) where accession_number is not null and btrim(accession_number)<>'';

-- A amostra precisa ser inequívoca dentro da unidade. O bloco é compatível com bases
-- antigas onde a restrição ainda não existia.
do $$
begin
  if not exists(select 1 from pg_constraint where conname='laboratorio_amostras_unidade_id_codigo_amostra_key' and conrelid='public.laboratorio_amostras'::regclass) then
    alter table public.laboratorio_amostras add constraint laboratorio_amostras_unidade_id_codigo_amostra_key unique(unidade_id,codigo_amostra);
  end if;
end $$;
