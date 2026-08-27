alter table public.perfis
  add column if not exists setor_chave text,
  add column if not exists nivel_acesso text not null default 'operacional',
  add column if not exists pagina_inicial text,
  add column if not exists ordem_navegacao integer not null default 100;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'perfis_nivel_acesso_check'
  ) then
    alter table public.perfis
      add constraint perfis_nivel_acesso_check
      check (nivel_acesso in ('operacional','supervisao','gestao','administrador'));
  end if;
end $$;

update public.perfis
set setor_chave = case nome
    when 'Administrador' then 'administracao'
    when 'Auditoria' then 'auditoria'
    when 'Compras e Estoque' then 'suprimentos'
    when 'Enfermagem' then 'enfermagem'
    when 'Faturamento' then 'faturamento'
    when 'Financeiro' then 'financeiro'
    when 'Medico' then 'medico'
    when 'Recepcao' then 'recepcao'
    when 'Farmacia' then 'farmacia'
    when 'Laboratorio' then 'laboratorio'
    when 'Diagnostico por Imagem' then 'imagem'
    when 'Centro Cirurgico' then 'centro_cirurgico'
    when 'CME' then 'cme'
    when 'Nutricao' then 'nutricao'
    when 'CCIH' then 'ccih'
    when 'Anatomia Patologica' then 'anatomia_patologica'
    when 'Hemodialise' then 'dialise'
    when 'Hemoterapia' then 'hemoterapia'
    when 'Hemodinamica' then 'hemodinamica'
    when 'Endoscopia' then 'endoscopia'
    when 'Oncologia' then 'oncologia'
    when 'Radioterapia' then 'radioterapia'
    when 'Transplantes' then 'transplantes'
    when 'Cuidados Paliativos' then 'paliativos'
    when 'Home Care' then 'homecare'
    when 'Equipe Multiprofissional' then 'multiprofissional'
    when 'Fisioterapia' then 'multiprofissional'
    when 'Comercial e Credenciamento' then 'comercial'
    when 'Engenharia Clínica' then 'engenharia_clinica'
    when 'Recursos Humanos' then 'rh'
    when 'Segurança / Portaria' then 'seguranca'
    when 'TI' then 'ti'
    else coalesce(setor_chave, 'geral')
  end,
  nivel_acesso = case nome
    when 'Administrador' then 'administrador'
    when 'Auditoria' then 'gestao'
    when 'Compras e Estoque' then 'gestao'
    when 'Faturamento' then 'gestao'
    when 'Financeiro' then 'gestao'
    when 'Comercial e Credenciamento' then 'gestao'
    when 'Recursos Humanos' then 'gestao'
    when 'TI' then 'gestao'
    when 'Engenharia Clínica' then 'gestao'
    when 'Segurança / Portaria' then 'supervisao'
    else 'operacional'
  end,
  pagina_inicial = case nome
    when 'Administrador' then '/painel'
    when 'Auditoria' then '/auditoria'
    when 'Compras e Estoque' then '/compras'
    when 'Enfermagem' then '/setores/enfermagem'
    when 'Faturamento' then '/faturamento'
    when 'Financeiro' then '/financeiro'
    when 'Medico' then '/fila-medica'
    when 'Recepcao' then '/senhas'
    when 'Farmacia' then '/setores/farmacia'
    when 'Laboratorio' then '/setores/laboratorio'
    when 'Diagnostico por Imagem' then '/setores/imagem'
    when 'Centro Cirurgico' then '/assistencial/centro-cirurgico'
    when 'CME' then '/assistencial/centro-cirurgico'
    when 'Nutricao' then '/assistencial/nutricao'
    when 'CCIH' then '/assistencial/ccih'
    when 'Anatomia Patologica' then '/assistencial/anatomia-patologica'
    when 'Hemodialise' then '/assistencial/dialise'
    when 'Hemoterapia' then '/assistencial/hemoterapia'
    when 'Hemodinamica' then '/assistencial/hemodinamica'
    when 'Endoscopia' then '/assistencial/endoscopia'
    when 'Oncologia' then '/assistencial/oncologia'
    when 'Radioterapia' then '/assistencial/radioterapia'
    when 'Transplantes' then '/assistencial/transplantes'
    when 'Cuidados Paliativos' then '/assistencial/paliativos'
    when 'Home Care' then '/assistencial/home-care'
    when 'Equipe Multiprofissional' then '/assistencial/multiprofissional'
    when 'Fisioterapia' then '/assistencial/multiprofissional'
    when 'Comercial e Credenciamento' then '/comercial'
    when 'Engenharia Clínica' then '/engenharia-clinica'
    when 'Recursos Humanos' then '/rh'
    when 'Segurança / Portaria' then '/seguranca'
    when 'TI' then '/ti'
    else coalesce(pagina_inicial, '/painel')
  end,
  ordem_navegacao = case nome
    when 'Administrador' then 1
    when 'Recepcao' then 10
    when 'Medico' then 20
    when 'Enfermagem' then 30
    when 'Farmacia' then 40
    when 'Laboratorio' then 50
    when 'Diagnostico por Imagem' then 60
    when 'Faturamento' then 70
    when 'Financeiro' then 80
    else coalesce(ordem_navegacao,100)
  end;

create index if not exists perfis_setor_nivel_idx
  on public.perfis (empresa_id, setor_chave, nivel_acesso, ativo)
  where ativo = true;
