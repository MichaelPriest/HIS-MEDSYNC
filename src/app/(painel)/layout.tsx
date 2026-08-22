import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/modules/auth/actions";
import { brand } from "@/config/brand";
export default async function PanelLayout({ children }: { children: React.ReactNode }) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); return <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]"><aside className="bg-brand-950 p-5 text-white"><Link href="/painel" className="text-xl font-semibold">{brand.shortName}</Link><nav aria-label="Principal" className="mt-8"><Link className="block rounded bg-white/10 px-3 py-2" href="/painel">Visão geral</Link></nav></aside><div><header className="flex min-h-16 items-center justify-between border-b bg-white px-6"><span className="text-sm text-slate-600">Unidade definida pelo vínculo ativo</span><form action={logout}><button className="rounded border px-3 py-2 text-sm">Sair</button></form></header><main className="p-6">{children}</main></div></div>; }
