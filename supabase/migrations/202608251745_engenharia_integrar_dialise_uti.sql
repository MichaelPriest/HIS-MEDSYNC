alter table if exists public.dialise_maquinas add column if not exists engenharia_equipamento_id uuid references public.engenharia_equipamentos(id);
alter table if exists public.ventilacao_mecanica add column if not exists engenharia_equipamento_id uuid references public.engenharia_equipamentos(id);

drop trigger if exists trg_ventilacao_equipamento_operacional on public.ventilacao_mecanica;
create trigger trg_ventilacao_equipamento_operacional before insert or update of engenharia_equipamento_id on public.ventilacao_mecanica for each row execute function public.validar_equipamento_operacional_trigger();

create or replace function public.validar_dialise_maquina_operacional_trigger()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_status text; v_eng uuid;
begin
  if new.maquina_id is null then return new; end if;
  select engenharia_equipamento_id into v_eng from public.dialise_maquinas where id=new.maquina_id and empresa_id=new.empresa_id and unidade_id=new.unidade_id and ativo;
  if v_eng is null then return new; end if;
  select status into v_status from public.engenharia_equipamentos where id=v_eng;
  if v_status not in ('operacional','reserva') then raise exception 'Máquina de diálise indisponível: status %',v_status; end if;
  return new;
end $$;

drop trigger if exists trg_dialise_sessao_maquina_operacional on public.dialise_sessoes;
create trigger trg_dialise_sessao_maquina_operacional before insert or update of maquina_id on public.dialise_sessoes for each row execute function public.validar_dialise_maquina_operacional_trigger();