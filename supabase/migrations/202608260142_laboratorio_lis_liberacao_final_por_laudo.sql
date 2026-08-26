create or replace function public.liberar_resultado_laboratorio(p_resultado_id uuid)
returns text
language plpgsql
security definer
set search_path='public','pg_catalog','extensions'
as $$
declare
  v_r public.laboratorio_resultados%rowtype;
  v_prof uuid;
  v_hash text;
  v_versao integer;
begin
  select * into v_r from public.laboratorio_resultados where id=p_resultado_id for update;
  if not found then raise exception 'LAB_RESULTADO_NAO_LOCALIZADO'; end if;
  if not public.tem_permissao(v_r.empresa_id,v_r.unidade_id,'laboratorio.liberar') then
    raise exception 'LAB_SEM_PERMISSAO' using errcode='42501';
  end if;
  if v_r.liberado then return v_r.assinatura_hash; end if;

  v_prof:=public.profissional_logado(v_r.empresa_id);
  if v_prof is null then raise exception 'LAB_USUARIO_SEM_PROFISSIONAL'; end if;

  select coalesce(max(versao),0)+1 into v_versao
  from public.laboratorio_resultados_historico
  where resultado_id=v_r.id;

  v_hash:=encode(
    extensions.digest(
      convert_to(concat_ws('|',v_r.id,v_r.analito,v_r.resultado,v_r.valor_numerico,v_r.unidade_medida,v_r.referencia_texto,now()::text),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.laboratorio_resultados_historico(
    empresa_id,unidade_id,resultado_id,atendimento_id,versao,conteudo,motivo,criado_por
  ) values (
    v_r.empresa_id,v_r.unidade_id,v_r.id,v_r.atendimento_id,v_versao,to_jsonb(v_r),'validacao_tecnica',auth.uid()
  );

  update public.laboratorio_resultados set
    liberado=true,
    liberado_em=now(),
    liberado_por=v_prof,
    assinatura_hash=v_hash,
    updated_at=now(),
    updated_by=auth.uid()
  where id=v_r.id;

  update public.solicitacoes_exames set
    status=case when status='liberado' then 'processamento' else status end,
    resultado_em=null,
    updated_at=now(),
    updated_by=auth.uid()
  where id=v_r.solicitacao_id
    and not exists (
      select 1
      from public.laboratorio_laudos l
      where l.solicitacao_id=v_r.solicitacao_id
        and l.status='liberado'
    );

  return v_hash;
end$$;

revoke execute on function public.liberar_resultado_laboratorio(uuid) from public, anon;
grant execute on function public.liberar_resultado_laboratorio(uuid) to authenticated;
