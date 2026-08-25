-- Mantém Central de Guias, autorização do atendimento e fluxo assistencial sincronizados.
-- Quando uma guia vinculada a atendimento é autorizada após a triagem, o paciente
-- deve seguir automaticamente para a fila médica ambulatorial ou para o PS.

create or replace function public.sincronizar_central_guia_fluxo_assistencial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atendimento public.atendimentos%rowtype;
  v_triagem public.triagens%rowtype;
  v_pronto_socorro boolean := false;
  v_prioridade text := 'normal';
  v_operador uuid;
begin
  if new.atendimento_id is null or new.status <> 'autorizada' then
    return new;
  end if;

  -- Só processa quando a guia acabou de ser autorizada ou quando dados relevantes
  -- de uma autorização já concedida foram alterados.
  if tg_op = 'UPDATE'
     and old.status = 'autorizada'
     and old.numero_guia_operadora is not distinct from new.numero_guia_operadora
     and old.senha is not distinct from new.senha
     and old.validade_senha is not distinct from new.validade_senha then
    return new;
  end if;

  v_operador := coalesce(new.updated_by, new.created_by);

  select * into v_atendimento
    from public.atendimentos
   where id = new.atendimento_id
     and empresa_id = new.empresa_id
     and unidade_id = new.unidade_id;

  if not found then
    return new;
  end if;

  -- Sincroniza a autorização operacional que acompanha o atendimento.
  update public.autorizacoes_atendimento
     set status = 'autorizada',
         numero_guia_operadora = coalesce(new.numero_guia_operadora, numero_guia_operadora),
         senha_autorizacao = coalesce(new.senha, senha_autorizacao),
         validade = coalesce(new.validade_senha, validade),
         updated_by = coalesce(v_operador, updated_by),
         updated_at = now()
   where atendimento_id = new.atendimento_id
     and unidade_id = new.unidade_id;

  -- Antes da conclusão da triagem não há fila médica para criar.
  if v_atendimento.triagem_concluida_em is null
     or nullif(trim(v_atendimento.especialidade_destino), '') is null then
    return new;
  end if;

  select * into v_triagem
    from public.triagens
   where atendimento_id = new.atendimento_id
   limit 1;

  v_pronto_socorro := lower(coalesce(v_triagem.classificacao_risco, '')) in ('vermelho','laranja')
    or lower(coalesce(v_atendimento.tipo_atendimento, '')) like '%pronto%'
    or lower(coalesce(v_atendimento.tipo_atendimento, '')) like '%urg%'
    or lower(coalesce(v_atendimento.tipo_atendimento, '')) like '%emerg%';

  v_prioridade := case lower(coalesce(v_triagem.classificacao_risco, ''))
    when 'vermelho' then 'emergencia'
    when 'laranja' then 'emergencia'
    when 'amarelo' then 'urgente'
    else 'normal'
  end;

  -- Idempotência: não cria uma segunda fila médica para o mesmo episódio.
  if not exists (
    select 1
      from public.encaminhamentos_assistenciais e
     where e.atendimento_id = new.atendimento_id
       and e.origem = 'triagem'
       and e.status in ('aguardando_profissional','chamado','em_atendimento')
  ) then
    insert into public.encaminhamentos_assistenciais (
      empresa_id, unidade_id, atendimento_id, paciente_id,
      origem, tipo_solicitacao, especialidade, status, prioridade, motivo,
      created_by, updated_by, created_at, updated_at
    ) values (
      new.empresa_id, new.unidade_id, new.atendimento_id, v_atendimento.paciente_id,
      'triagem', 'encaminhamento', v_atendimento.especialidade_destino,
      'aguardando_profissional', v_prioridade, v_triagem.queixa_principal,
      v_operador, v_operador, now(), now()
    );
  end if;

  update public.atendimentos
     set setor_atual = case when v_pronto_socorro then 'pronto_socorro' else 'consultorio' end,
         status = 'em_espera',
         ultima_movimentacao_em = now(),
         updated_by = coalesce(v_operador, updated_by),
         updated_at = now()
   where id = new.atendimento_id
     and unidade_id = new.unidade_id;

  if v_pronto_socorro and not exists (
    select 1
      from public.filas_setoriais f
     where f.atendimento_id = new.atendimento_id
       and f.setor_codigo = 'pronto_socorro'
       and f.status in ('aguardando','chamado','em_atendimento')
  ) then
    insert into public.filas_setoriais (
      empresa_id, unidade_id, atendimento_id, paciente_id,
      setor_codigo, origem, motivo, prioridade, status,
      created_by, updated_by, created_at, updated_at
    ) values (
      new.empresa_id, new.unidade_id, new.atendimento_id, v_atendimento.paciente_id,
      'pronto_socorro', 'triagem', v_triagem.queixa_principal,
      v_prioridade, 'aguardando', v_operador, v_operador, now(), now()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sincronizar_central_guia_fluxo_assistencial() from public;

-- O trigger atua tanto em novas guias já autorizadas (integrações) quanto em atualizações manuais.
drop trigger if exists trg_central_guia_fluxo_assistencial on public.central_guias;
create trigger trg_central_guia_fluxo_assistencial
after insert or update of status, numero_guia_operadora, senha, validade_senha
on public.central_guias
for each row
execute function public.sincronizar_central_guia_fluxo_assistencial();

comment on function public.sincronizar_central_guia_fluxo_assistencial() is
'Sincroniza autorização da Central de Guias e encaminha automaticamente o atendimento pós-triagem para fila médica/PS.';
