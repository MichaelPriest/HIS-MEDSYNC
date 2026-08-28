create or replace function public.validar_assinatura_registro_clinico()
returns trigger
language plpgsql
set search_path to 'public','pg_catalog'
as $function$
begin
  if new.bloqueado is true and new.assinado_em is null then
    raise exception 'REGISTRO_CLINICO_BLOQUEADO_SEM_ASSINATURA' using errcode='23514';
  end if;

  if new.assinado_em is not null and new.bloqueado is not true then
    raise exception 'REGISTRO_CLINICO_ASSINADO_DEVE_SER_BLOQUEADO' using errcode='23514';
  end if;

  if new.assinado_em is not null
     and not public.tem_permissao(new.empresa_id,new.unidade_id,'prontuario.assinar') then
    raise exception 'PRONTUARIO_SEM_PERMISSAO_ASSINAR' using errcode='42501';
  end if;
  return new;
end
$function$;

drop trigger if exists trg_validar_assinatura_anamnese on public.prontuario_anamneses;
create trigger trg_validar_assinatura_anamnese
before insert or update of assinado_em,bloqueado on public.prontuario_anamneses
for each row execute function public.validar_assinatura_registro_clinico();

drop trigger if exists trg_validar_assinatura_evolucao on public.prontuario_evolucoes;
create trigger trg_validar_assinatura_evolucao
before insert or update of assinado_em,bloqueado on public.prontuario_evolucoes
for each row execute function public.validar_assinatura_registro_clinico();

create index if not exists idx_prontuario_anamneses_rascunho_profissional
  on public.prontuario_anamneses(atendimento_id, profissional_id, updated_at desc)
  where assinado_em is null and bloqueado is false;

create index if not exists idx_prontuario_evolucoes_rascunho_profissional
  on public.prontuario_evolucoes(atendimento_id, profissional_id, tipo_evolucao, updated_at desc)
  where assinado_em is null and bloqueado is false;
