import Link from "next/link";
import { SectionPage } from "@/components/painel/section-page";

export default function NovoPacientePage() {
  return (
    <SectionPage
      eyebrow="Cadastros / Pacientes / Novo"
      title="Novo paciente"
      description="Formulário estrutural do cadastro mestre. A persistência será ativada junto da migration, validações e políticas RLS do marco 2."
    >
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {["Nome completo", "Nome social", "CPF", "CNS", "Data de nascimento", "Sexo", "Telefone", "E-mail", "CEP", "Logradouro", "Número", "Complemento", "Bairro", "Cidade", "UF", "Contato de emergência"].map((label) => (
            <label key={label} className="space-y-2 text-sm font-medium text-slate-700">
              <span>{label}</span>
              <input disabled className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500" placeholder="Disponível após integração do cadastro" />
            </label>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">Campos desabilitados até a camada de domínio e banco serem concluídos.</p>
          <Link href="/pacientes" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Voltar</Link>
        </div>
      </section>
    </SectionPage>
  );
}
