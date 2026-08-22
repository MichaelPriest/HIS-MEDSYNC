"use client";

import { LoaderCircle, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { MaskedInput } from "@/components/forms/masked-input";

type Item = { id: number };
type PhoneType = "celular" | "residencial" | "comercial";
type AddressType = "residencial" | "comercial" | "outro";

function SectionTitle({ icon: Icon, title, required }: { icon: typeof Mail; title: string; required?: boolean }) {
  return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-4" /></span><div><h3 className="font-semibold text-slate-900">{title}{required ? " *" : ""}</h3><p className="text-xs text-slate-500">Você pode adicionar mais de um registro.</p></div></div>;
}

function AddressBlock({ item, index, total, defaultAddressType, onRemove }: { item: Item; index: number; total: number; defaultAddressType: AddressType; onRemove: () => void }) {
  const [address, setAddress] = useState({ endereco: "", bairro: "", cidade: "", estado: "" });
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState("");

  async function lookupCep(value: string) {
    const cep = value.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLoadingCep(true); setCepError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error();
      const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) throw new Error();
      setAddress({ endereco: data.logradouro ?? "", bairro: data.bairro ?? "", cidade: data.localidade ?? "", estado: data.uf ?? "" });
    } catch {
      setCepError("CEP não localizado. Preencha o endereço manualmente.");
    } finally { setLoadingCep(false); }
  }

  return <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Endereço {index + 1}</span><button type="button" disabled={total === 1} onClick={onRemove} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="size-4" /></button></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>CEP</span><div className="relative"><MaskedInput mask="cep" name={`enderecos[${item.id}].cep`} className="field pr-10" onBlur={(e) => lookupCep(e.currentTarget.value)} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{loadingCep ? <LoaderCircle className="size-4 animate-spin" /> : null}</span></div>{cepError ? <span className="block text-xs font-normal text-amber-600">{cepError}</span> : <span className="block text-xs font-normal text-slate-400">Busca automática pelo ViaCEP.</span>}</label>
      <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2"><span>Endereço *</span><input name={`enderecos[${item.id}].endereco`} required={index === 0} className="field" value={address.endereco} onChange={(e) => setAddress((v) => ({ ...v, endereco: e.target.value }))} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Número *</span><input name={`enderecos[${item.id}].numero`} required={index === 0} className="field" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Complemento</span><input name={`enderecos[${item.id}].complemento`} className="field" /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Bairro *</span><input name={`enderecos[${item.id}].bairro`} required={index === 0} className="field" value={address.bairro} onChange={(e) => setAddress((v) => ({ ...v, bairro: e.target.value }))} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Cidade *</span><input name={`enderecos[${item.id}].cidade`} required={index === 0} className="field" value={address.cidade} onChange={(e) => setAddress((v) => ({ ...v, cidade: e.target.value }))} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Estado *</span><input name={`enderecos[${item.id}].estado`} required={index === 0} maxLength={2} className="field uppercase" value={address.estado} onChange={(e) => setAddress((v) => ({ ...v, estado: e.target.value.toUpperCase() }))} /></label>
      <label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo</span><select name={`enderecos[${item.id}].tipo`} defaultValue={defaultAddressType} className="field"><option value="residencial">Residencial</option><option value="comercial">Comercial</option><option value="outro">Outro</option></select></label>
    </div>
  </div>;
}

export function ContactSections({ defaultAddressType = "residencial", defaultPhoneType = "celular" }: { defaultAddressType?: AddressType; defaultPhoneType?: PhoneType }) {
  const [emails, setEmails] = useState<Item[]>([{ id: 0 }]);
  const [phones, setPhones] = useState<Item[]>([{ id: 0 }]);
  const [addresses, setAddresses] = useState<Item[]>([{ id: 0 }]);
  const [nextId, setNextId] = useState(1);
  function add(setter: Dispatch<SetStateAction<Item[]>>) { const id = nextId; setNextId((v) => v + 1); setter((items) => [...items, { id }]); }
  function remove(setter: Dispatch<SetStateAction<Item[]>>, id: number) { setter((items) => items.length > 1 ? items.filter((item) => item.id !== id) : items); }

  return <div className="space-y-8">
    <section className="space-y-4 border-t border-slate-100 pt-6"><SectionTitle icon={Mail} title="Emails" required /><div className="space-y-3">{emails.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Email *</span><input type="email" name={`emails[${item.id}].email`} required={index === 0} className="field" placeholder="nome@dominio.com" /></label><button type="button" disabled={emails.length === 1} onClick={() => remove(setEmails, item.id)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="size-4" /> Remover</button></div></div>)}</div><button type="button" onClick={() => add(setEmails)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Plus className="size-4" /> Adicionar Email</button></section>
    <section className="space-y-4 border-t border-slate-100 pt-6"><SectionTitle icon={Phone} title="Telefones" required /><div className="space-y-3">{phones.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><div className="grid gap-3 md:grid-cols-[1fr_13rem_auto_auto] md:items-end"><label className="space-y-2 text-sm font-medium text-slate-700"><span>Telefone *</span><MaskedInput mask="telefone" name={`telefones[${item.id}].telefone`} required={index === 0} className="field" placeholder="(00) 00000-0000" /></label><label className="space-y-2 text-sm font-medium text-slate-700"><span>Tipo</span><select name={`telefones[${item.id}].tipo`} defaultValue={defaultPhoneType} className="field"><option value="celular">Celular</option><option value="residencial">Residencial</option><option value="comercial">Comercial</option></select></label><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><input type="checkbox" name={`telefones[${item.id}].whatsapp`} value="1" className="size-4 accent-brand-700" /> WhatsApp</label><button type="button" disabled={phones.length === 1} onClick={() => remove(setPhones, item.id)} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="size-4" /></button></div></div>)}</div><button type="button" onClick={() => add(setPhones)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Plus className="size-4" /> Adicionar Telefone</button></section>
    <section className="space-y-4 border-t border-slate-100 pt-6"><SectionTitle icon={MapPin} title="Endereços" required /><div className="space-y-4">{addresses.map((item, index) => <AddressBlock key={item.id} item={item} index={index} total={addresses.length} defaultAddressType={defaultAddressType} onRemove={() => remove(setAddresses, item.id)} />)}</div><button type="button" onClick={() => add(setAddresses)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Plus className="size-4" /> Adicionar Endereço</button></section>
  </div>;
}
