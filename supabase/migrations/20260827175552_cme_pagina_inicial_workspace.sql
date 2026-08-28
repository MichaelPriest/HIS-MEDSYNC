update public.perfis
set pagina_inicial = '/assistencial/centro-cirurgico/cme',
    updated_at = now()
where setor_chave = 'cme'
  and ativo is true
  and pagina_inicial is distinct from '/assistencial/centro-cirurgico/cme';
