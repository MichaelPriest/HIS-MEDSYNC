-- Indicador TISS "Atendimento a RN".
-- O indicador pertence ao episódio/guia, não ao cadastro mestre do paciente.

alter table public.atendimentos
  add column if not exists atendimento_rn boolean not null default false;

comment on column public.atendimentos.atendimento_rn is
  'Indicador do episódio para atendimento ao recém-nato usando contrato/carteirinha do responsável. No TISS deve ser serializado como S/N conforme a guia aplicável.';

alter table public.tiss_guias
  add column if not exists atendimento_rn boolean not null default false;

comment on column public.tiss_guias.atendimento_rn is
  'Snapshot do indicador Atendimento a RN da guia TISS. Serializar como S quando true e N quando false.';

update public.tiss_guias g
set atendimento_rn = a.atendimento_rn
from public.atendimentos a
where g.atendimento_id = a.id
  and g.atendimento_rn is distinct from a.atendimento_rn;

notify pgrst, 'reload schema';
