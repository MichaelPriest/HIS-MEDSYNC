create table if not exists public.monitorizacao_alertas_clinicos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  unidade_id uuid not null,
  atendimento_id uuid not null references public.atendimentos(id) on delete cascade,
  paciente_id uuid references public.pacientes(id) on delete cascade,
  leitura_id uuid not null references public.monitorizacao_equipamento_dados(id) on delete cascade,
  equipamento_id uuid not null references public.engenharia_equipamentos(id),
  parametro text not null,
  valor numeric,
  unidade_medida text,
  severidade text not null check (severidade in ('atencao','critico')),
  mensagem text not null,
  status text not null default 'aberto' check (status in ('aberto','reconhecido','encerrado')),
  reconhecido_em timestamptz,
  reconhecido_por uuid,
  created_at timestamptz not null default now(),
  unique(leitura_id,parametro)
);
create index if not exists idx_monitorizacao_alertas_fila on public.monitorizacao_alertas_clinicos(empresa_id,unidade_id,status,severidade,created_at desc);
alter table public.monitorizacao_alertas_clinicos enable row level security;
create policy monitorizacao_alertas_select on public.monitorizacao_alertas_clinicos for select to authenticated using (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
create policy monitorizacao_alertas_update on public.monitorizacao_alertas_clinicos for update to authenticated using (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id)) with check (public.tem_empresa(empresa_id) and public.tem_unidade(empresa_id,unidade_id));
revoke delete,truncate on public.monitorizacao_alertas_clinicos from anon,authenticated;

create or replace function public.processar_telemetria_clinica()
returns trigger language plpgsql security definer set search_path=public as $$
declare p text; v numeric; sev text; msg text; un text;
begin
  if new.atendimento_id is null then return new; end if;
  foreach p in array array['frequencia_cardiaca','frequencia_respiratoria','saturacao_o2','temperatura_c','pressao_sistolica','pressao_diastolica'] loop
    begin v := nullif(new.dados->>p,'')::numeric; exception when others then v := null; end;
    if v is null then continue; end if;
    sev:=null; msg:=null;
    if p='saturacao_o2' then un:='%'; if v<90 then sev:='critico'; elsif v<94 then sev:='atencao'; end if;
    elsif p='frequencia_cardiaca' then un:='bpm'; if v<40 or v>140 then sev:='critico'; elsif v<50 or v>120 then sev:='atencao'; end if;
    elsif p='frequencia_respiratoria' then un:='irpm'; if v<8 or v>35 then sev:='critico'; elsif v<10 or v>30 then sev:='atencao'; end if;
    elsif p='temperatura_c' then un:='°C'; if v<35 or v>=40 then sev:='critico'; elsif v<36 or v>=38.5 then sev:='atencao'; end if;
    elsif p='pressao_sistolica' then un:='mmHg'; if v<80 or v>200 then sev:='critico'; elsif v<90 or v>180 then sev:='atencao'; end if;
    elsif p='pressao_diastolica' then un:='mmHg'; if v<40 or v>130 then sev:='critico'; elsif v<50 or v>120 then sev:='atencao'; end if; end if;
    if sev is not null then
      msg:=replace(initcap(replace(p,'_',' ')),'O2','O₂')||' fora do limite configurado: '||v||' '||un;
      insert into public.monitorizacao_alertas_clinicos(empresa_id,unidade_id,atendimento_id,paciente_id,leitura_id,equipamento_id,parametro,valor,unidade_medida,severidade,mensagem)
      values(new.empresa_id,new.unidade_id,new.atendimento_id,new.paciente_id,new.id,new.equipamento_id,p,v,un,sev,msg) on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists trg_processar_telemetria_clinica on public.monitorizacao_equipamento_dados;
create trigger trg_processar_telemetria_clinica after insert on public.monitorizacao_equipamento_dados for each row execute function public.processar_telemetria_clinica();
comment on table public.monitorizacao_alertas_clinicos is 'Alertas assistenciais derivados de telemetria de equipamentos. Limiares são apoio operacional e não substituem avaliação clínica.';