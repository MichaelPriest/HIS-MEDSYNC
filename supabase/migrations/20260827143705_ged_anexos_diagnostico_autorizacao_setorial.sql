create or replace function public.validar_ged_associacao_setorial()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.laboratorio_laudo_id is not null
     and (tg_op = 'INSERT' or new.laboratorio_laudo_id is distinct from old.laboratorio_laudo_id) then
    if not (
      public.tem_permissao(new.empresa_id, new.unidade_id, 'ged.administrar')
      or public.tem_permissao(new.empresa_id, new.unidade_id, 'laboratorio.gerenciar')
      or public.tem_permissao(new.empresa_id, new.unidade_id, 'laboratorio.laudar')
      or public.tem_permissao(new.empresa_id, new.unidade_id, 'laboratorio.liberar')
    ) then
      raise exception 'Sem permissão do Laboratório para anexar documento ao laudo';
    end if;
  end if;

  if new.imagem_laudo_id is not null
     and (tg_op = 'INSERT' or new.imagem_laudo_id is distinct from old.imagem_laudo_id) then
    if not (
      public.tem_permissao(new.empresa_id, new.unidade_id, 'ged.administrar')
      or public.tem_permissao(new.empresa_id, new.unidade_id, 'imagem.gerenciar')
      or public.tem_permissao(new.empresa_id, new.unidade_id, 'imagem.laudar')
      or public.tem_permissao(new.empresa_id, new.unidade_id, 'imagem.liberar_laudo')
    ) then
      raise exception 'Sem permissão de Diagnóstico por Imagem para anexar documento ao laudo';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validar_ged_associacao_setorial() from public, anon, authenticated;

drop trigger if exists trg_validar_ged_associacao_setorial on public.ged_documentos;
create trigger trg_validar_ged_associacao_setorial
before insert or update of laboratorio_laudo_id, imagem_laudo_id
on public.ged_documentos
for each row execute function public.validar_ged_associacao_setorial();
