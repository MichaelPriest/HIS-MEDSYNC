"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Item = { id:string; codigo_interno:string; categoria:string; descricao:string; unidade_medida:string|null; apresentacao:string|null; concentracao:string|null; codigo_tuss:string|null };
const categoriaLabel: Record<string,string> = { medicamento:"Medicamento", material:"Material", opme:"OPME", gas_medicinal:"Gás medicinal", procedimento:"Procedimento / exame", outro:"Outro" };

type BuscaProps = { empresaId:string; name:string; label:string; required?:boolean; apenasMedicamentos?:boolean; placeholder?:string };
function BuscaItem({ empresaId,name,label,required=false,apenasMedicamentos=false,placeholder }: BuscaProps) {
  const supabase = useMemo(() => createClient(), []);
  const [termo,setTermo]=useState(""); const [selecionado,setSelecionado]=useState<Item|null>(null); const [resultados,setResultados]=useState<Item[]>([]); const [carregando,setCarregando]=useState(false); const seq=useRef(0);
  useEffect(()=>{ const q=termo.trim(); if(selecionado||q.length<2){setResultados([]);setCarregando(false);return;} const atual=++seq.current; const timer=window.setTimeout(async()=>{ setCarregando(true); const base=()=>{ let query=supabase.from("itens_assistenciais").select("id,codigo_interno,categoria,descricao,unidade_medida,apresentacao,concentracao,codigo_tuss").eq("empresa_id",empresaId).eq("ativo",true); query=apenasMedicamentos?query.eq("categoria","medicamento"):query.in("categoria",["medicamento","material","opme","gas_medicinal","procedimento","outro"]); return query; }; const [a,b,c]=await Promise.all([base().ilike("descricao",`%${q}%`).order("descricao").limit(20),base().ilike("codigo_interno",`%${q}%`).order("descricao").limit(10),base().ilike("codigo_tuss",`%${q}%`).order("descricao").limit(10)]); if(atual!==seq.current)return; const unicos=new Map<string,Item>(); for(const item of [...(a.data??[]),...(b.data??[]),...(c.data??[])] as Item[]) unicos.set(item.id,item); setResultados([...unicos.values()].slice(0,25)); setCarregando(false); },220); return()=>window.clearTimeout(timer); },[apenasMedicamentos,empresaId,selecionado,supabase,termo]);
  return <div className="relative">
    <input type="hidden" name={name} value={selecionado?.id??""}/>
    <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>{label}{required?" *":""}</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={selecionado?[selecionado.descricao,selecionado.concentracao,selecionado.apresentacao].filter(Boolean).join(" · "):termo} onChange={(e)=>{setSelecionado(null);setTermo(e.target.value);}} autoComplete="off" className="ui-input pl-10 pr-10" placeholder={placeholder??"Comece a digitar..."} required={required&&!selecionado}/>{(selecionado||termo)?<button type="button" aria-label="Limpar item" onClick={()=>{setSelecionado(null);setTermo("");setResultados([]);}} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="size-4"/></button>:null}</span></label>
    {!selecionado&&termo.trim().length>=2?<div className="absolute z-40 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{carregando?<p className="px-3 py-3 text-sm text-slate-500">Localizando no catálogo...</p>:null}{!carregando&&resultados.length===0?<p className="px-3 py-3 text-sm text-slate-500">Nenhum item ativo encontrado.</p>:null}{resultados.map(item=><button key={item.id} type="button" onClick={()=>{setSelecionado(item);setTermo("");setResultados([]);}} className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"><span className="block text-sm font-bold text-slate-900">{item.descricao}</span><span className="mt-0.5 block text-xs text-slate-500">{categoriaLabel[item.categoria]??item.categoria}{item.concentracao?` · ${item.concentracao}`:""}{item.apresentacao?` · ${item.apresentacao}`:""}{item.codigo_tuss?` · TUSS ${item.codigo_tuss}`:""}</span></button>)}</div>:null}
  </div>;
}

export function ItemAssistencialAutocomplete({ empresaId }: { empresaId:string }) {
  const [compor,setCompor]=useState(false);
  return <div className="md:col-span-2 xl:col-span-4 space-y-4">
    <BuscaItem empresaId={empresaId} name="item_assistencial_id" label="Medicamento, material, exame ou procedimento" required placeholder="Comece a digitar: soro fisiológico, dipirona, ceftriaxona, hemograma..."/>
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <button type="button" onClick={()=>setCompor(v=>!v)} className="flex items-center gap-2 text-sm font-black text-brand-700"><Plus className="size-4"/>{compor?"Ocultar composição":"Adicionar solução / medicamento à mesma administração"}</button>
      {compor?<div className="mt-4 space-y-4"><p className="text-xs text-slate-600">Use para prescrições compostas, por exemplo: SF 0,9% + dipirona. Cada componente permanece separado para Farmácia, Enfermagem, estoque, regras clínicas e faturamento.</p>
        {[1,2].map((n)=><div key={n} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-4"><div className="md:col-span-4"><BuscaItem empresaId={empresaId} name={`componente_${n}_id`} label={`Componente adicional ${n}`} apenasMedicamentos placeholder="Digite dipirona, ondansetrona, ceftriaxona..."/></div><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Dose</span><input name={`componente_${n}_dose`} className="ui-input" placeholder="Ex.: 1 g"/></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Quantidade</span><input name={`componente_${n}_quantidade`} type="number" step="0.0001" className="ui-input"/></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Unidade</span><input name={`componente_${n}_unidade`} className="ui-input" placeholder="mg, g, mL..."/></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Observação</span><input name={`componente_${n}_observacao`} className="ui-input" placeholder="Diluir, administrar junto..."/></label></div>)}
      </div>:null}
    </div>
    <p className="text-xs text-slate-500">Os itens são localizados diretamente no catálogo institucional. O vínculo com estoque continua interno e não aparece para o médico.</p>
  </div>;
}
