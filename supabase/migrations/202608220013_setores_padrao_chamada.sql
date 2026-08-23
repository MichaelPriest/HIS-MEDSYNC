begin;

insert into public.setores_chamada(empresa_id,unidade_id,codigo,nome,prefixo,permite_totem,ordem)
select u.empresa_id,u.id,v.codigo,v.nome,v.prefixo,v.permite_totem,v.ordem
from public.unidades u
cross join (values
  ('recepcao','Recepção','R',true,10),
  ('triagem','Triagem','T',false,20),
  ('consultorio','Consultório','C',false,30),
  ('laboratorio','Laboratório','L',false,40),
  ('imagem','Diagnóstico por Imagem','I',false,50),
  ('farmacia','Farmácia','F',false,60)
) as v(codigo,nome,prefixo,permite_totem,ordem)
on conflict (unidade_id,codigo) do nothing;

create or replace function public.criar_setores_padrao_unidade()
returns trigger language plpgsql set search_path=public as $$
begin
  insert into public.setores_chamada(empresa_id,unidade_id,codigo,nome,prefixo,permite_totem,ordem) values
    (new.empresa_id,new.id,'recepcao','Recepção','R',true,10),
    (new.empresa_id,new.id,'triagem','Triagem','T',false,20),
    (new.empresa_id,new.id,'consultorio','Consultório','C',false,30),
    (new.empresa_id,new.id,'laboratorio','Laboratório','L',false,40),
    (new.empresa_id,new.id,'imagem','Diagnóstico por Imagem','I',false,50),
    (new.empresa_id,new.id,'farmacia','Farmácia','F',false,60)
  on conflict (unidade_id,codigo) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_unidades_setores_chamada on public.unidades;
create trigger trg_unidades_setores_chamada after insert on public.unidades for each row execute function public.criar_setores_padrao_unidade();

commit;