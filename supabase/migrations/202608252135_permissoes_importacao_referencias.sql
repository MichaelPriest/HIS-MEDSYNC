insert into public.permissoes(codigo,descricao) values
('referencias.visualizar','Visualizar tabelas de referência e equivalências'),
('referencias.importar','Importar tabelas de referência XML'),
('referencias.configurar','Configurar tabelas comerciais por convênio')
on conflict(codigo) do update set descricao=excluded.descricao,ativo=true;

create or replace function public.importar_referencia_lote(p_empresa uuid,p_unidade uuid,p_target text,p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
declare n integer:=0;
begin
  if not public.tem_permissao(p_empresa,p_unidade,'referencias.importar') then raise exception 'Sem permissão para importar tabelas de referência'; end if;
  if jsonb_typeof(p_payload) <> 'array' then raise exception 'Payload inválido'; end if;
  if jsonb_array_length(p_payload) > 1000 then raise exception 'Máximo de 1000 registros por lote'; end if;
  if p_target='glosas' then
    insert into public.referencia_glosas(codigo,motivo,fonte,ativo,metadados)
    select codigo,motivo,coalesce(fonte,'importacao_xml'),coalesce(ativo,true),coalesce(metadados,'{}'::jsonb)
    from jsonb_to_recordset(p_payload) as x(codigo text,motivo text,fonte text,ativo boolean,metadados jsonb)
    where nullif(trim(codigo),'') is not null and nullif(trim(motivo),'') is not null
    on conflict(codigo) do update set motivo=excluded.motivo,fonte=excluded.fonte,ativo=excluded.ativo,metadados=excluded.metadados,updated_at=now();
    get diagnostics n=row_count;
  elsif p_target='equivalencias' then
    insert into public.referencia_equivalencias(sistema_origem,codigo_origem,descricao_origem,sistema_destino,codigo_destino,descricao_destino,fonte,status,observacao)
    select sistema_origem,codigo_origem,descricao_origem,sistema_destino,codigo_destino,descricao_destino,fonte,coalesce(status,'ativa'),observacao
    from jsonb_to_recordset(p_payload) as x(sistema_origem text,codigo_origem text,descricao_origem text,sistema_destino text,codigo_destino text,descricao_destino text,fonte text,status text,observacao text)
    where nullif(trim(codigo_origem),'') is not null and nullif(trim(codigo_destino),'') is not null
    on conflict(sistema_origem,codigo_origem,sistema_destino,codigo_destino,fonte) do update set descricao_origem=excluded.descricao_origem,descricao_destino=excluded.descricao_destino,status=excluded.status,observacao=excluded.observacao,updated_at=now();
    get diagnostics n=row_count;
  else raise exception 'Destino de importação inválido'; end if;
  return n;
end $$;
revoke all on function public.importar_referencia_lote(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.importar_referencia_lote(uuid,uuid,text,jsonb) to authenticated;
