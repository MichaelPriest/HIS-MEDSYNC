-- Garante a continuidade Totem -> senha -> atendimento -> prontuario.
-- Se a senha ja estiver identificada, o atendimento nao pode ser aberto para outro paciente.

create or replace function public.validar_paciente_identificado_da_senha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paciente_senha uuid;
begin
  if new.senha_id is null then
    return new;
  end if;

  select s.paciente_id
  into v_paciente_senha
  from public.senhas_atendimento s
  where s.id = new.senha_id;

  if v_paciente_senha is not null and v_paciente_senha <> new.paciente_id then
    raise exception 'ADMISSAO_PACIENTE_DIVERGENTE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validar_paciente_identificado_da_senha() from public;
revoke all on function public.validar_paciente_identificado_da_senha() from anon;
revoke all on function public.validar_paciente_identificado_da_senha() from authenticated;

drop trigger if exists trg_atendimentos_preservar_paciente_senha on public.atendimentos;
create trigger trg_atendimentos_preservar_paciente_senha
before insert or update of senha_id, paciente_id on public.atendimentos
for each row
execute function public.validar_paciente_identificado_da_senha();

comment on function public.validar_paciente_identificado_da_senha() is
  'Impede que uma senha identificada no Totem seja vinculada a atendimento de outro paciente.';
