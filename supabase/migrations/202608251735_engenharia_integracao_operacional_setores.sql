alter table if exists public.imagem_agendamentos add column if not exists engenharia_equipamento_id uuid references public.engenharia_equipamentos(id);
alter table if exists public.laboratorio_resultados add column if not exists engenharia_equipamento_id uuid references public.engenharia_equipamentos(id);

create or replace function public.validar_equipamento_operacional_trigger()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_status text;
begin
  if new.engenharia_equipamento_id is null then return new; end if;
  select status into v_status from public.engenharia_equipamentos where id=new.engenharia_equipamento_id and empresa_id=new.empresa_id and unidade_id=new.unidade_id;
  if v_status is null then raise exception 'Equipamento não encontrado para a unidade'; end if;
  if v_status not in ('operacional','reserva') then raise exception 'Equipamento indisponível para uso: status %',v_status; end if;
  return new;
end $$;

drop trigger if exists trg_imagem_execucao_equipamento_operacional on public.imagem_execucoes;
create trigger trg_imagem_execucao_equipamento_operacional before insert or update of engenharia_equipamento_id on public.imagem_execucoes for each row execute function public.validar_equipamento_operacional_trigger();

drop trigger if exists trg_laboratorio_resultado_equipamento_operacional on public.laboratorio_resultados;
create trigger trg_laboratorio_resultado_equipamento_operacional before insert or update of engenharia_equipamento_id on public.laboratorio_resultados for each row execute function public.validar_equipamento_operacional_trigger();

create or replace view public.vw_salas_cirurgicas_prontidao as
select s.id sala_id,s.empresa_id,s.unidade_id,s.codigo,s.nome,s.status,
       count(se.id) filter (where se.ativo and se.obrigatorio) as equipamentos_obrigatorios,
       count(se.id) filter (where se.ativo and se.obrigatorio and e.status in ('operacional','reserva')) as equipamentos_obrigatorios_ok,
       count(se.id) filter (where se.ativo and se.obrigatorio and e.status not in ('operacional','reserva')) as equipamentos_obrigatorios_indisponiveis,
       coalesce(bool_and(case when se.ativo and se.obrigatorio then e.status in ('operacional','reserva') else true end),true) as equipamentos_prontos
from public.salas_cirurgicas s
left join public.engenharia_sala_equipamentos se on se.sala_cirurgica_id=s.id and se.ativo
left join public.engenharia_equipamentos e on e.id=se.equipamento_id
group by s.id,s.empresa_id,s.unidade_id,s.codigo,s.nome,s.status;

grant select on public.vw_salas_cirurgicas_prontidao to authenticated;