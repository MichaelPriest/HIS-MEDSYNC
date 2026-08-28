export type XmlLayout="amb"|"cbhpm"|"equivalencias"|"glosas"|"desconhecido";
export type CommercialXmlItem={codigo:string;descricao:string;valor_referencia:number;pontos_ch:number|null;quantidade_auxiliares:number|null;porte:string|null;ch_anestesista:number|null;quantidade_filme:number|null;quantidade_uco:number|null;porte_anestesico:string|null;metadata:Record<string,unknown>};
export type EquivalenciaXml={sistema_origem:"AMB";codigo_origem:string;descricao_origem:string|null;sistema_destino:"TUSS";codigo_destino:string;descricao_destino:string|null;fonte:string;status:"ativa"|"revisar";observacao:string|null};
export type GlosaXml={codigo:string;motivo:string;fonte:string;ativo:true;metadados:Record<string,unknown>};

const entities=(v:string)=>v.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const clean=(v:string)=>entities(v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
const tag=(block:string,...names:string[])=>{for(const name of names){const m=block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,"i"));if(m)return clean(m[1]);}return "";};
const n=(v:string)=>{if(!v)return null;const x=Number(v.replace(/\s/g,"").replace(",","."));return Number.isFinite(x)?x:null;};
const blocks=(raw:string,name:string)=>[...raw.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,"gi"))].map(m=>m[1]);

export function detectXmlLayout(raw:string):XmlLayout{
  if(/<glosas[\s>]/i.test(raw)&&/<glosa[\s>]/i.test(raw))return "glosas";
  if(/<(CodigoAMB|codigo_AMB)>/i.test(raw)&&/<(CodigoTUSS|codigo_TUSS)>/i.test(raw))return "equivalencias";
  if(/<procedimento[\s>]/i.test(raw)&&/<porte>/i.test(raw)&&/<custoOperacional>/i.test(raw))return "cbhpm";
  if(/<procedimento[\s>]/i.test(raw)&&/<codigoAMB>/i.test(raw)&&/<quantidadeCH>/i.test(raw))return "amb";
  return "desconhecido";
}

export function parseCommercialXml(raw:string,layout:Extract<XmlLayout,"amb"|"cbhpm">){
  const out:CommercialXmlItem[]=[];let rejeitados=0;
  for(const b of blocks(raw,"procedimento")){
    const codigo=tag(b,"codigoAMB","codigo"),descricao=tag(b,"descricaoAMB","descricao");
    if(!codigo||!descricao){rejeitados++;continue;}
    if(layout==="amb"){
      const ch=n(tag(b,"quantidadeCH"));
      const quantidadeAuxiliares=n(tag(b,"quantidadeAux")),porteCirurgico=tag(b,"porteCirurgico")||null,chAnestesista=n(tag(b,"CHAnestesista")),quantidadeFilme=n(tag(b,"quantidadeFilme"));
      out.push({codigo,descricao,valor_referencia:0,pontos_ch:ch,quantidade_auxiliares:quantidadeAuxiliares,porte:porteCirurgico,ch_anestesista:chAnestesista,quantidade_filme:quantidadeFilme,quantidade_uco:null,porte_anestesico:null,metadata:{quantidade_aux:quantidadeAuxiliares,porte_cirurgico:porteCirurgico,ch_anestesista:chAnestesista,quantidade_filme:quantidadeFilme}});
    }else{
      const valorPorte=n(tag(b,"valorPorte"));
      const quantidadeAuxiliares=n(tag(b,"quantidadeAux")),quantidadeFilme=n(tag(b,"quantidadeFilme"));
      out.push({codigo,descricao,valor_referencia:0,pontos_ch:null,quantidade_auxiliares:quantidadeAuxiliares,porte:tag(b,"porte")||null,ch_anestesista:n(tag(b,"valorPorteAnestesista")),quantidade_filme:quantidadeFilme,quantidade_uco:n(tag(b,"custoOperacional")),porte_anestesico:tag(b,"porteAnestesista")||null,metadata:{fracao_porte:n(tag(b,"fracaoPorte")),valor_porte_origem:valorPorte,quantidade_aux:quantidadeAuxiliares,porte_cirurgico:tag(b,"porteCirurgico")||null,valor_porte_anestesista_origem:n(tag(b,"valorPorteAnestesista")),quantidade_filme:quantidadeFilme}});
    }
  }
  const byCode=new Map<string,CommercialXmlItem>();let consolidados=0;
  for(const item of out){
    const current=byCode.get(item.codigo);
    if(!current){byCode.set(item.codigo,item);continue;}
    consolidados++;
    const alternativas=new Set<string>([...(Array.isArray(current.metadata.descricoes_alternativas)?current.metadata.descricoes_alternativas.map(String):[]),item.descricao]);
    current.metadata={...current.metadata,descricoes_alternativas:[...alternativas]};
  }
  return {itens:[...byCode.values()],rejeitados,consolidados};
}

export function parseEquivalenciasXml(raw:string,fonte:string){
  const out:EquivalenciaXml[]=[];let rejeitados=0;
  for(const b of blocks(raw,"procedimento")){
    const origem=tag(b,"CodigoAMB","codigo_AMB"),destino=tag(b,"CodigoTUSS","codigo_TUSS");
    if(!origem||!destino){rejeitados++;continue;}
    const descricaoOrigem=tag(b,"DescricaoAMB","descricao_AMB")||null,descricaoDestino=tag(b,"DescricaoTUSS","descricao_TUSS")||null;
    out.push({sistema_origem:"AMB",codigo_origem:origem,descricao_origem:descricaoOrigem,sistema_destino:"TUSS",codigo_destino:destino,descricao_destino:descricaoDestino,fonte,status:descricaoOrigem&&descricaoDestino?"ativa":"revisar",observacao:null});
  }
  return {itens:out,rejeitados};
}

export function parseGlosasXml(raw:string,fonte:string){
  const out:GlosaXml[]=[];let rejeitados=0;
  for(const b of blocks(raw,"glosa")){
    const codigo=tag(b,"codigo"),motivo=tag(b,"motivo");
    if(!codigo||!motivo){rejeitados++;continue;}
    out.push({codigo,motivo,fonte,ativo:true,metadados:{}});
  }
  return {itens:out,rejeitados};
}
