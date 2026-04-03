import { Printer, CheckCircle, X } from "lucide-react";

const ESCOLA = "QUETA, School";
const MORADA = "Rua da Educação, N.º 10, Luanda";
const TELEFONE = "+244 923 000 000";
const EMAIL = "geral@queta.ao";
const NIF = "5000123456";

const PAGAMENTO = {
  recibo: "REC-A3F9B2C1",
  rubrica: "Propina — Mês de Março",
  valor: "35.000,00 Kz",
  data: "28 de Março de 2026",
  metodo: "RUPE / Referência Bancária",
  referencia: "REF-2026-0328-00451",
  comprovativo: "TRF-BFA-20260328-88821",
  anoLetivo: "2025/2026",
};

const ALUNO = {
  nome: "Manuel António Ferreira da Costa",
  matricula: "MAT-2025-0042",
  turma: "7ª A — 7ª Classe",
  anoLetivo: "2025/2026",
};

const DATA_EMISSAO = "3 de Abril de 2026";

export function Comprovativo() {
  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl overflow-hidden shadow-xl">

        {/* ── Cabeçalho ── */}
        <div className="bg-gradient-to-r from-[#0D1B3E] to-[#1a3060] px-9 py-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-white/15 flex items-center justify-center text-white text-3xl font-bold shrink-0">
            Q
          </div>
          <div>
            <p className="text-white text-xl font-bold leading-tight">{ESCOLA}</p>
            <p className="text-white/60 text-xs mt-1">
              {MORADA} · {TELEFONE} · NIF: {NIF}
            </p>
          </div>
        </div>

        {/* ── Barra dourada ── */}
        <div className="bg-[#C9A84C] px-9 py-3 flex items-center justify-between">
          <span className="text-white font-bold tracking-widest text-sm uppercase">
            Comprovativo de Pagamento
          </span>
          <span className="text-white/80 text-xs font-semibold">{PAGAMENTO.recibo}</span>
        </div>

        <div className="px-9 py-8 space-y-7">

          {/* ── Dados do estudante ── */}
          <section>
            <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">
              Dados do Estudante
            </p>
            <div className="space-y-2">
              <Row label="Nome Completo" value={ALUNO.nome} />
              <Row label="N.º Matrícula" value={ALUNO.matricula} />
              <Row label="Turma / Classe" value={ALUNO.turma} />
              <Row label="Ano Lectivo" value={ALUNO.anoLetivo} />
            </div>
          </section>

          {/* ── Detalhes do pagamento ── */}
          <section>
            <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">
              Detalhes do Pagamento
            </p>
            <div className="space-y-2">
              <Row label="Rubrica" value={PAGAMENTO.rubrica} />
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-400 min-w-[140px]">Valor Pago</span>
                <span className="text-2xl font-bold text-[#C9A84C]">{PAGAMENTO.valor}</span>
              </div>
              <Row label="Data de Pagamento" value={PAGAMENTO.data} />
              <Row label="Método" value={PAGAMENTO.metodo} />
              <Row label="Referência" value={PAGAMENTO.referencia} />
              <Row label="Comprovativo" value={PAGAMENTO.comprovativo} />
            </div>
          </section>

          {/* ── Divisória ── */}
          <div className="border-t border-dashed border-gray-200" />

          {/* ── Estado ── */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Estado</span>
            <span className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide uppercase">
              <CheckCircle className="w-3.5 h-3.5" />
              Quitado
            </span>
          </div>

          {/* ── Nota de autenticidade ── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-blue-600">
              Documento emitido electronicamente em {DATA_EMISSAO} · {ESCOLA}
            </p>
          </div>
        </div>

        {/* ── Rodapé ── */}
        <div className="bg-gray-50 border-t border-gray-100 px-9 py-5 text-center text-xs text-gray-400 leading-relaxed">
          <p>
            <span className="font-semibold text-gray-500">Email:</span> {EMAIL} &nbsp;·&nbsp;
            <span className="font-semibold text-gray-500">Tel:</span> {TELEFONE}
          </p>
          <p className="mt-1">
            Este documento serve como comprovativo oficial de pagamento emitido por {ESCOLA}.
          </p>
        </div>

        {/* ── Acções (ocultas na impressão) ── */}
        <div className="px-9 pb-8 pt-5 flex justify-center gap-3 print:hidden">
          <button
            className="inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8943e] text-white font-semibold text-sm rounded-lg px-6 py-3 transition-colors"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
          <button
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-sm rounded-lg px-5 py-3 transition-colors"
            onClick={() => window.close()}
          >
            <X className="w-4 h-4" />
            Fechar
          </button>
        </div>

      </div>

      <p className="text-center text-gray-400 text-xs mt-6">
        Para editar este template, modifica o ficheiro{" "}
        <code className="font-mono bg-gray-100 px-1 rounded">
          artifacts/mockup-sandbox/src/components/mockups/comprovativo/Comprovativo.tsx
        </code>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-xs text-gray-400 min-w-[140px]">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right">{value}</span>
    </div>
  );
}
