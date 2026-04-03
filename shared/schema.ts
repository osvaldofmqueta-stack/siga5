import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const provincias = pgTable("provincias", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nome: text("nome").notNull().unique(),
});

export const municipios = pgTable("municipios", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  nome: text("nome").notNull(),
  provinciaId: integer("provinciaId").notNull().references(() => provincias.id),
});

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// -----------------------
// UTILIZADORES DO SISTEMA
// -----------------------
export const utilizadores = pgTable("utilizadores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senha: text("senha").notNull(),
  role: text("role").notNull(), // 'admin' | 'professor' | 'aluno' | 'financeiro' | 'rh' | 'encarregado' | 'director' | 'secretaria' | 'pedagogico' | 'chefe_secretaria' | 'ceo' | 'pca'
  escola: text("escola").notNull().default(''),
  ativo: boolean("ativo").notNull().default(true),
  alunoId: varchar("alunoId"), // only for role='encarregado'
  // Campos de enquadramento organizacional (preenchidos pelo RH)
  departamento: text("departamento"), // DepartamentoKey
  cargo: text("cargo"),               // CargoInfo.id
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// FUNCIONÁRIOS (Registo Central de Pessoal — todos os trabalhadores)
// -----------------------
export const funcionarios = pgTable("funcionarios", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Dados Pessoais
  nome: text("nome").notNull(),
  apelido: text("apelido").notNull(),
  dataNascimento: text("dataNascimento").notNull().default(''),
  genero: text("genero").notNull().default(''), // 'M' | 'F'
  bi: text("bi").notNull().default(''),          // Bilhete de Identidade
  nif: text("nif").notNull().default(''),         // Número de Identificação Fiscal
  telefone: text("telefone").notNull().default(''),
  email: text("email").notNull().default(''),
  foto: text("foto"),
  provincia: text("provincia").notNull().default(''),
  municipio: text("municipio").notNull().default(''),
  morada: text("morada").notNull().default(''),

  // Enquadramento Organizacional (baseado na legislação angolana)
  departamento: text("departamento").notNull(), // DepartamentoKey
  cargo: text("cargo").notNull(),               // CargoInfo.id
  especialidade: text("especialidade").notNull().default(''), // e.g., Matemática, Física, etc.

  // Vínculo Contratual
  tipoContrato: text("tipoContrato").notNull().default('efectivo'), // 'efectivo' | 'contratado' | 'prestacao_servicos' | 'temporario' | 'bolseiro'
  dataContratacao: text("dataContratacao").notNull().default(''),
  dataFimContrato: text("dataFimContrato"),       // null = contrato sem prazo
  habilitacoes: text("habilitacoes").notNull().default(''), // Licenciatura, Mestrado, etc.

  // Dados Salariais
  salarioBase: real("salarioBase").notNull().default(0),
  subsidioAlimentacao: real("subsidioAlimentacao").notNull().default(0),
  subsidioTransporte: real("subsidioTransporte").notNull().default(0),
  subsidioHabitacao: real("subsidioHabitacao").notNull().default(0),
  outrosSubsidios: real("outrosSubsidios").notNull().default(0),
  subsidios: jsonb("subsidios").default(sql`'[]'::jsonb`),

  // Remuneração por Tempos Lectivos (colaboradores / prestação de serviços)
  // Para efectivos: salário base fixo + desconto por tempos não dados
  // Para colaboradores: valorPorTempoLectivo × temposSemanais × 4 semanas = salário mensal
  valorPorTempoLectivo: real("valorPorTempoLectivo").notNull().default(0), // valor unitário por tempo lectivo (Kz)
  temposSemanais: integer("temposSemanais").notNull().default(0),           // tempos lectivos por semana

  // Acesso ao Sistema
  utilizadorId: varchar("utilizadorId"), // link to utilizadores — null if no system access
  professorId: varchar("professorId"),   // link to professores — null if not a teacher

  // Estado
  ativo: boolean("ativo").notNull().default(true),
  observacoes: text("observacoes").notNull().default(''),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFuncionarioSchema = createInsertSchema(funcionarios).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFuncionario = z.infer<typeof insertFuncionarioSchema>;
export type Funcionario = typeof funcionarios.$inferSelect;

// -----------------------
// ANOS ACADÉMICOS
// -----------------------
export const anosAcademicos = pgTable("anos_academicos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ano: text("ano").notNull(),          // '2025/26'
  dataInicio: text("dataInicio").notNull(),
  dataFim: text("dataFim").notNull(),
  ativo: boolean("ativo").notNull().default(false),
  trimestres: jsonb("trimestres").notNull().default(sql`'[]'::jsonb`),
  // Épocas de exame: normal, recurso, especial — cada uma com dataInicio, dataFim e observacoes
  epocasExame: jsonb("epocasExame").default(sql`'{}'::jsonb`),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// ALUNOS
// -----------------------
export const alunos = pgTable("alunos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  numeroMatricula: text("numeroMatricula").notNull(),
  nome: text("nome").notNull(),
  apelido: text("apelido").notNull(),
  dataNascimento: text("dataNascimento").notNull(),
  genero: text("genero").notNull(),
  provincia: text("provincia").notNull(),
  municipio: text("municipio").notNull(),

  turmaId: varchar("turmaId")
    .references(() => turmas.id),

  cursoId: varchar("cursoId").references(() => cursos.id),

  nomeEncarregado: text("nomeEncarregado").notNull(),
  telefoneEncarregado: text("telefoneEncarregado").notNull(),
  emailEncarregado: text("emailEncarregado"),
  ativo: boolean("ativo").notNull().default(true),
  bloqueado: boolean("bloqueado").notNull().default(false),
  permitirAcessoComPendencia: boolean("permitirAcessoComPendencia").notNull().default(false),
  foto: text("foto"),

  falecido: boolean("falecido").notNull().default(false),
  dataFalecimento: text("dataFalecimento"),
  observacoesFalecimento: text("observacoesFalecimento"),
  registadoFalecimentoPor: text("registadoFalecimentoPor"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PROFESSORES
// -----------------------
export const professores = pgTable("professores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  numeroProfessor: text("numeroProfessor").notNull(),
  nome: text("nome").notNull(),
  apelido: text("apelido").notNull(),

  disciplinas: jsonb("disciplinas").notNull(),
  turmasIds: jsonb("turmasIds").notNull(),

  telefone: text("telefone").notNull(),
  email: text("email").notNull().unique(),
  habilitacoes: text("habilitacoes").notNull(),
  ativo: boolean("ativo").notNull().default(true),

  // Organização interna
  seccao: text("seccao").notNull().default(''), // Secção dentro do departamento (ex: Secretaria Pedagógica, Arquivo)

  // Dados Salariais (Payroll)
  cargo: text("cargo").default('Professor'),
  categoria: text("categoria").default(''),
  salarioBase: real("salarioBase").default(0),
  subsidioAlimentacao: real("subsidioAlimentacao").default(0),
  subsidioTransporte: real("subsidioTransporte").default(0),
  subsidioHabitacao: real("subsidioHabitacao").default(0),
  dataContratacao: text("dataContratacao"),
  tipoContrato: text("tipoContrato").default('efectivo'), // 'efectivo' | 'contratado' | 'prestacao_servicos'
  // Remuneração por Tempos Lectivos
  valorPorTempoLectivo: real("valorPorTempoLectivo").default(0), // valor por tempo lectivo (Kz) — para colaboradores
  temposSemanais: integer("temposSemanais").default(0),           // tempos lectivos por semana — para colaboradores

  nivelEnsino: text("nivelEnsino").notNull().default('I Ciclo'), // 'Primário' | 'I Ciclo' | 'II Ciclo'

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// FOLHAS DE SALÁRIOS (Payroll)
// -----------------------
export const folhasSalarios = pgTable("folhas_salarios", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  mes: integer("mes").notNull(),           // 1-12
  ano: integer("ano").notNull(),
  descricao: text("descricao").notNull().default(''),
  status: text("status").notNull().default('rascunho'), // 'rascunho' | 'processada' | 'aprovada' | 'paga'
  totalBruto: real("totalBruto").notNull().default(0),
  totalLiquido: real("totalLiquido").notNull().default(0),
  totalInssEmpregado: real("totalInssEmpregado").notNull().default(0),
  totalInssPatronal: real("totalInssPatronal").notNull().default(0),
  totalIrt: real("totalIrt").notNull().default(0),
  totalSubsidios: real("totalSubsidios").notNull().default(0),
  numFuncionarios: integer("numFuncionarios").notNull().default(0),
  processadaPor: text("processadaPor"),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizadoEm", { withTimezone: true }).notNull().defaultNow(),
});

export const itensFolha = pgTable("itens_folha", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  folhaId: varchar("folhaId").notNull().references(() => folhasSalarios.id, { onDelete: "cascade" }),
  professorId: varchar("professorId").notNull(),
  professorNome: text("professorNome").notNull(),
  cargo: text("cargo").notNull().default('Professor'),
  categoria: text("categoria").notNull().default(''),
  // Vencimentos
  salarioBase: real("salarioBase").notNull().default(0),
  subsidioAlimentacao: real("subsidioAlimentacao").notNull().default(0),
  subsidioTransporte: real("subsidioTransporte").notNull().default(0),
  subsidioHabitacao: real("subsidioHabitacao").notNull().default(0),
  outrosSubsidios: real("outrosSubsidios").notNull().default(0),
  salarioBruto: real("salarioBruto").notNull().default(0),
  // Descontos
  inssEmpregado: real("inssEmpregado").notNull().default(0),   // 3%
  inssPatronal: real("inssPatronal").notNull().default(0),     // 8%
  irt: real("irt").notNull().default(0),                        // IRT Angola
  descontoFaltas: real("descontoFaltas").notNull().default(0), // Desconto por faltas (Kz)
  numFaltasInj: integer("numFaltasInj").notNull().default(0),  // Nº faltas injustificadas
  numMeioDia: integer("numMeioDia").notNull().default(0),      // Nº meios-dias
  outrosDescontos: real("outrosDescontos").notNull().default(0),
  totalDescontos: real("totalDescontos").notNull().default(0),
  // Remuneração extra por tempos lectivos / dias trabalhados (contratados)
  remuneracaoTempos: real("remuneracaoTempos").notNull().default(0), // Total pago por tempos lectivos ou dias
  numTempos: integer("numTempos").notNull().default(0),              // Nº de tempos lectivos / dias
  // Líquido
  salarioLiquido: real("salarioLiquido").notNull().default(0),
  // Meta
  tipoFuncionario: text("tipoFuncionario").notNull().default('professor'), // 'professor' | 'funcionario'
  departamento: text("departamento").notNull().default(''),
  seccao: text("seccao").notNull().default(''),
  observacao: text("observacao"),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// FALTAS DE FUNCIONÁRIOS (controlo de faltas do pessoal)
// -----------------------
export const faltasFuncionarios = pgTable("faltas_funcionarios", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  funcionarioId: varchar("funcionarioId").notNull().references(() => funcionarios.id, { onDelete: "cascade" }),
  data: text("data").notNull(), // 'YYYY-MM-DD'
  tipo: text("tipo").notNull().default('injustificada'), // 'justificada' | 'injustificada' | 'meio_dia'
  motivo: text("motivo").notNull().default(''),
  descontavel: boolean("descontavel").notNull().default(true),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  registadoPor: text("registadoPor").notNull().default(''),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFaltaFuncionarioSchema = createInsertSchema(faltasFuncionarios).omit({ id: true, criadoEm: true });
export type InsertFaltaFuncionario = z.infer<typeof insertFaltaFuncionarioSchema>;
export type FaltaFuncionario = typeof faltasFuncionarios.$inferSelect;

// -----------------------
// TEMPOS LECTIVOS / DIAS TRABALHADOS (pagamento por trabalho efectuado)
// -----------------------
export const temposLectivos = pgTable("tempos_lectivos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  funcionarioId: varchar("funcionarioId").notNull().references(() => funcionarios.id, { onDelete: "cascade" }),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  totalUnidades: integer("totalUnidades").notNull().default(0), // tempos lectivos (prof) ou dias (admin)
  valorUnitario: real("valorUnitario").notNull().default(0),
  totalCalculado: real("totalCalculado").notNull().default(0),
  tipo: text("tipo").notNull().default('professor'), // 'professor' | 'admin'
  departamento: text("departamento").notNull().default(''),
  observacoes: text("observacoes").notNull().default(''),
  aprovado: boolean("aprovado").notNull().default(false),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizadoEm", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTempoLectivoSchema = createInsertSchema(temposLectivos).omit({ id: true, criadoEm: true, atualizadoEm: true });
export type InsertTempoLectivo = z.infer<typeof insertTempoLectivoSchema>;
export type TempoLectivo = typeof temposLectivos.$inferSelect;

// -----------------------
// CONFIGURAÇÃO RH (valores e taxas definidos pelo Recursos Humanos)
// -----------------------
export const configuracaoRH = pgTable("configuracao_rh", {
  id: integer("id").primaryKey().default(sql`1`),
  valorPorFalta: real("valorPorFalta").notNull().default(0),             // desconto por falta injustificada (Kz)
  valorMeioDia: real("valorMeioDia").notNull().default(0),                // desconto por meio-dia
  taxaTempoLectivo: real("taxaTempoLectivo").notNull().default(0),        // valor global por tempo lectivo (prof. contratado — substituído pelo individual)
  taxaAdminPorDia: real("taxaAdminPorDia").notNull().default(0),          // valor por dia trabalhado (pessoal admin)
  descontoPorTempoNaoDado: real("descontoPorTempoNaoDado").notNull().default(0), // desconto por tempo lectivo não dado (prof. efectivo)
  semanasPorMes: integer("semanasPorMes").notNull().default(4),           // semanas por mês para cálculo de colaboradores
  observacoes: text("observacoes").notNull().default(''),
  atualizadoEm: timestamp("atualizadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// SALAS DE AULA
// -----------------------
export const salas = pgTable("salas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nome: text("nome").notNull(),
  bloco: text("bloco").notNull().default(''),
  capacidade: integer("capacidade").notNull().default(30),
  tipo: text("tipo").notNull().default('Sala Normal'), // "Sala Normal" | "Laboratório" | "Sala de Informática" | "Auditório" | "Sala de Reunião"
  ativo: boolean("ativo").notNull().default(true),
});

// -----------------------
// TURMAS
// -----------------------
export const turmas = pgTable("turmas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nome: text("nome").notNull(),
  classe: text("classe").notNull(),
  turno: text("turno").notNull(), // "Manhã" | "Tarde" | "Noite"
  anoLetivo: text("anoLetivo").notNull(),
  nivel: text("nivel").notNull(), // "Primário" | "I Ciclo" | "II Ciclo"

  professorId: varchar("professorId")
    .references(() => professores.id),

  professoresIds: jsonb("professoresIds").notNull().default(sql`'[]'::jsonb`),

  cursoId: varchar("cursoId").references(() => cursos.id),

  sala: text("sala").notNull(),
  capacidade: integer("capacidade").notNull(),
  ativo: boolean("ativo").notNull().default(true),
});

// -----------------------
// NOTAS
// -----------------------
export const notas = pgTable("notas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId")
    .notNull()
    .references(() => alunos.id),

  turmaId: varchar("turmaId")
    .notNull()
    .references(() => turmas.id),

  disciplina: text("disciplina").notNull(),
  trimestre: integer("trimestre").notNull(), // 1 | 2 | 3

  aval1: integer("aval1").notNull().default(0),
  aval2: integer("aval2").notNull().default(0),
  aval3: integer("aval3").notNull().default(0),
  aval4: integer("aval4").notNull().default(0),
  aval5: integer("aval5").notNull().default(0),
  aval6: integer("aval6").notNull().default(0),
  aval7: integer("aval7").notNull().default(0),
  aval8: integer("aval8").notNull().default(0),
  mac1: integer("mac1").notNull().default(0),
  pp1: integer("pp1").notNull().default(0),
  ppt: integer("ppt").notNull().default(0),
  mt1: integer("mt1").notNull().default(0),
  nf: integer("nf").notNull().default(0),
  mac: integer("mac").notNull().default(0),

  anoLetivo: text("anoLetivo").notNull(),
  professorId: varchar("professorId")
    .notNull()
    .references(() => professores.id),

  data: text("data").notNull(),

  lancamentos: jsonb("lancamentos"),
  camposAbertos: jsonb("camposAbertos").default(sql`'[]'::jsonb`),
  pedidosReabertura: jsonb("pedidosReabertura").default(sql`'[]'::jsonb`),
});

// -----------------------
// PRESENÇAS
// -----------------------
export const presencas = pgTable("presencas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId")
    .notNull()
    .references(() => alunos.id),

  turmaId: varchar("turmaId")
    .notNull()
    .references(() => turmas.id),

  disciplina: text("disciplina").notNull(),
  data: text("data").notNull(),
  status: text("status").notNull(), // "P" | "F" | "J"
  observacao: text("observacao"),
});

// -----------------------
// EVENTOS (CALENDÁRIO)
// -----------------------
export const eventos = pgTable("eventos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  data: text("data").notNull(),
  hora: text("hora").notNull(),
  tipo: text("tipo").notNull(),
  local: text("local").notNull(),
  turmasIds: jsonb("turmasIds").notNull(),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// HORÁRIOS
// -----------------------
export const horarios = pgTable("horarios", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  turmaId: varchar("turmaId")
    .notNull()
    .references(() => turmas.id),

  disciplina: text("disciplina").notNull(),
  professorId: varchar("professorId").references(() => professores.id),
  professorNome: text("professorNome").notNull().default('—'),

  diaSemana: integer("diaSemana").notNull(),
  periodo: integer("periodo").notNull(),
  horaInicio: text("horaInicio").notNull(),
  horaFim: text("horaFim").notNull(),
  sala: text("sala").notNull().default(''),
  anoAcademico: text("anoAcademico").notNull(),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PAUTAS
// -----------------------
export const pautas = pgTable("pautas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  disciplina: text("disciplina").notNull(),
  trimestre: integer("trimestre").notNull(),
  professorId: varchar("professorId").notNull().references(() => professores.id),
  status: text("status").notNull().default('aberta'), // 'aberta' | 'fechada' | 'pendente_abertura' | 'rejeitada'
  anoLetivo: text("anoLetivo").notNull(),
  dataFecho: text("dataFecho"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// SOLICITAÇÕES DE ABERTURA DE PAUTA
// -----------------------
export const solicitacoesAbertura = pgTable("solicitacoes_abertura", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  pautaId: varchar("pautaId").notNull().references(() => pautas.id),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  turmaNome: text("turmaNome").notNull(),
  disciplina: text("disciplina").notNull(),
  trimestre: integer("trimestre").notNull(),
  professorId: varchar("professorId").notNull().references(() => professores.id),
  professorNome: text("professorNome").notNull(),
  motivo: text("motivo").notNull(),
  status: text("status").notNull().default('pendente'), // 'pendente' | 'aprovada' | 'rejeitada'
  respondidoEm: text("respondidoEm"),
  observacao: text("observacao"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// MENSAGENS (PROFESSOR / TURMA / ALUNO)
// -----------------------
export const mensagens = pgTable("mensagens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  remetenteId: text("remetenteId").notNull(),
  remetenteNome: text("remetenteNome").notNull(),
  tipo: text("tipo").notNull(), // 'turma' | 'privada'
  turmaId: varchar("turmaId"),
  turmaNome: text("turmaNome"),
  destinatarioId: text("destinatarioId"),
  destinatarioNome: text("destinatarioNome"),
  destinatarioTipo: text("destinatarioTipo"), // 'professor' | 'aluno'
  assunto: text("assunto").notNull(),
  corpo: text("corpo").notNull(),
  lidaPor: jsonb("lidaPor").notNull().default(sql`'[]'::jsonb`),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// MATERIAIS DIDÁCTICOS
// -----------------------
export const materiais = pgTable("materiais", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  professorId: varchar("professorId").notNull().references(() => professores.id),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  turmaNome: text("turmaNome").notNull(),
  disciplina: text("disciplina").notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao").notNull().default(''),
  tipo: text("tipo").notNull(), // 'texto' | 'link' | 'resumo' | 'pdf' | 'docx' | 'ppt'
  conteudo: text("conteudo").notNull(),
  nomeArquivo: text("nomeArquivo"),
  tamanhoArquivo: integer("tamanhoArquivo"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// SUMÁRIOS DE AULAS
// -----------------------
export const sumarios = pgTable("sumarios", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  professorId: varchar("professorId").notNull().references(() => professores.id),
  professorNome: text("professorNome").notNull(),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  turmaNome: text("turmaNome").notNull(),
  disciplina: text("disciplina").notNull(),
  data: text("data").notNull(),
  horaInicio: text("horaInicio").notNull(),
  horaFim: text("horaFim").notNull(),
  numeroAula: integer("numeroAula").notNull(),
  conteudo: text("conteudo").notNull(),
  status: text("status").notNull().default('pendente'), // 'pendente' | 'aceite' | 'rejeitado'
  observacaoRH: text("observacaoRH"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// CALENDÁRIO DE PROVAS
// -----------------------
export const calendarioProvas = pgTable("calendario_provas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  titulo: text("titulo").notNull(),
  descricao: text("descricao").notNull().default(''),
  turmasIds: jsonb("turmasIds").notNull().default(sql`'[]'::jsonb`),
  disciplina: text("disciplina").notNull(),
  data: text("data").notNull(),
  hora: text("hora").notNull(),
  tipo: text("tipo").notNull(), // 'teste' | 'exame' | 'trabalho' | 'prova_oral'
  publicado: boolean("publicado").notNull().default(false),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// TAXAS ESCOLARES
// -----------------------
export const taxas = pgTable("taxas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  tipo: text("tipo").notNull(), // 'propina' | 'matricula' | 'material' | 'exame' | 'multa' | 'outro'
  descricao: text("descricao").notNull(),
  valor: real("valor").notNull(),
  frequencia: text("frequencia").notNull(), // 'mensal' | 'trimestral' | 'anual' | 'unica'
  nivel: text("nivel").notNull(),
  anoAcademico: text("anoAcademico").notNull(),
  ativo: boolean("ativo").notNull().default(true),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PAGAMENTOS
// -----------------------
export const pagamentos = pgTable("pagamentos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id),
  taxaId: varchar("taxaId").notNull().references(() => taxas.id),
  valor: real("valor").notNull(),
  data: text("data").notNull(),
  mes: integer("mes"),
  trimestre: integer("trimestre"),
  ano: text("ano").notNull(),
  status: text("status").notNull().default('pendente'), // 'pago' | 'pendente' | 'cancelado'
  metodoPagamento: text("metodoPagamento").notNull(), // 'dinheiro' | 'transferencia' | 'multicaixa'
  referencia: text("referencia"),
  observacao: text("observacao"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// MENSAGENS FINANCEIRAS
// -----------------------
export const mensagensFinanceiras = pgTable("mensagens_financeiras", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id),
  remetente: text("remetente").notNull(),
  texto: text("texto").notNull(),
  data: text("data").notNull(),
  lida: boolean("lida").notNull().default(false),
  tipo: text("tipo").notNull().default('geral'), // 'aviso' | 'bloqueio' | 'rupe' | 'geral'

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// RUPES
// -----------------------
export const rupes = pgTable("rupes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id),
  taxaId: varchar("taxaId").notNull().references(() => taxas.id),
  valor: real("valor").notNull(),
  referencia: text("referencia").notNull(),
  dataGeracao: text("dataGeracao").notNull(),
  dataValidade: text("dataValidade").notNull(),
  status: text("status").notNull().default('ativo'), // 'ativo' | 'pago' | 'expirado'

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// SALDO DE ALUNOS (Crédito / Saldo em Conta)
// -----------------------
export const saldoAlunos = pgTable("saldo_alunos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  alunoId: varchar("alunoId").notNull().unique().references(() => alunos.id),
  saldo: real("saldo").notNull().default(0),
  dataProximaCobranca: text("dataProximaCobranca"),
  observacoes: text("observacoes"),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// MOVIMENTOS DE SALDO
// -----------------------
export const movimentosSaldo = pgTable("movimentos_saldo", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  alunoId: varchar("alunoId").notNull().references(() => alunos.id),
  tipo: text("tipo").notNull(), // 'credito' | 'debito' | 'transferencia_in' | 'transferencia_out' | 'pagamento_excesso'
  valor: real("valor").notNull(),
  descricao: text("descricao").notNull(),
  pagamentoId: varchar("pagamentoId"),
  criadoPor: text("criadoPor"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PUSH SUBSCRIPTIONS (Web Push / VAPID)
// -----------------------
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  utilizadorId: varchar("utilizadorId").notNull(), // encarregado's user id
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("userAgent"),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// NOTIFICAÇÕES
// -----------------------
export const notificacoes = pgTable("notificacoes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  tipo: text("tipo").notNull().default('info'), // 'info' | 'aviso' | 'urgente' | 'sucesso'
  data: text("data").notNull(),
  lida: boolean("lida").notNull().default(false),
  link: text("link"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// SOLICITAÇÕES DE MATRÍCULA
// -----------------------
export const registros = pgTable("registros", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nomeCompleto: text("nomeCompleto").notNull(),
  dataNascimento: text("dataNascimento").notNull(),
  genero: text("genero").notNull(),
  provincia: text("provincia").notNull(),
  municipio: text("municipio").notNull(),

  // Contacto
  telefone: text("telefone").notNull().default(''),
  email: text("email").notNull().default(''),

  // Localização
  endereco: text("endereco").notNull().default(''),
  bairro: text("bairro").notNull().default(''),

  // Identificação oficial
  numeroBi: text("numeroBi").notNull().default(''),
  numeroCedula: text("numeroCedula").notNull().default(''),

  // Escolaridade
  nivel: text("nivel").notNull(),
  classe: text("classe").notNull(),
  cursoId: varchar("cursoId").references(() => cursos.id),

  // Encarregado
  nomeEncarregado: text("nomeEncarregado").notNull(),
  telefoneEncarregado: text("telefoneEncarregado").notNull(),
  observacoes: text("observacoes").notNull().default(''),

  // Processo de admissão
  // status: 'pendente' | 'aprovado' | 'rejeitado' | 'admitido' | 'reprovado_admissao' | 'matriculado'
  status: text("status").notNull().default('pendente'),
  senhaProvisoria: text("senhaProvisoria"),
  dataProva: text("dataProva"),
  notaAdmissao: real("notaAdmissao"),
  resultadoAdmissao: text("resultadoAdmissao"),
  matriculaCompleta: boolean("matriculaCompleta").notNull().default(false),
  rupeInscricao: text("rupeInscricao"),
  rupeMatricula: text("rupeMatricula"),

  avaliadoEm: text("avaliadoEm"),
  avaliadoPor: text("avaliadoPor"),
  motivoRejeicao: text("motivoRejeicao"),

  // Tipo de inscrição: 'novo' (primeiro ingresso) | 'reconfirmacao' (reprovado do ano anterior)
  tipoInscricao: text("tipoInscricao").notNull().default('novo'),

  // Pagamento da taxa de inscrição confirmado pela área financeira
  pagamentoInscricaoConfirmado: boolean("pagamentoInscricaoConfirmado").notNull().default(false),
  pagamentoInscricaoConfirmadoEm: text("pagamentoInscricaoConfirmadoEm"),
  pagamentoInscricaoConfirmadoPor: text("pagamentoInscricaoConfirmadoPor"),

  // Pagamento da taxa de matrícula confirmado pelo admin
  pagamentoMatriculaConfirmado: boolean("pagamentoMatriculaConfirmado").notNull().default(false),
  pagamentoMatriculaConfirmadoEm: text("pagamentoMatriculaConfirmadoEm"),
  pagamentoMatriculaConfirmadoPor: text("pagamentoMatriculaConfirmadoPor"),

  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PERMISSÕES POR UTILIZADOR
// -----------------------
export const userPermissions = pgTable("user_permissions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  permissoes: jsonb("permissoes").notNull().default(sql`'{}'::jsonb`),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// BIBLIOTECA ESCOLAR
// -----------------------
export const livros = pgTable("livros", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  titulo: text("titulo").notNull(),
  autor: text("autor").notNull(),
  isbn: text("isbn").notNull().default(''),
  categoria: text("categoria").notNull().default('Geral'),
  editora: text("editora").notNull().default(''),
  anoPublicacao: integer("anoPublicacao"),
  quantidadeTotal: integer("quantidadeTotal").notNull().default(1),
  quantidadeDisponivel: integer("quantidadeDisponivel").notNull().default(1),
  localizacao: text("localizacao").notNull().default(''),
  descricao: text("descricao").notNull().default(''),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export const emprestimos = pgTable("emprestimos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  livroId: varchar("livroId").notNull().references(() => livros.id),
  livroTitulo: text("livroTitulo").notNull(),
  alunoId: varchar("alunoId"),
  nomeLeitor: text("nomeLeitor").notNull(),
  tipoLeitor: text("tipoLeitor").notNull().default('aluno'), // 'aluno' | 'professor' | 'externo'
  dataEmprestimo: text("dataEmprestimo").notNull(),
  dataPrevistaDevolucao: text("dataPrevistaDevolucao").notNull(),
  dataDevolucao: text("dataDevolucao"),
  status: text("status").notNull().default('emprestado'), // 'emprestado' | 'devolvido' | 'atrasado'
  observacao: text("observacao"),
  registadoPor: text("registadoPor").notNull().default('Sistema'),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// CURSOS
// -----------------------
export const cursos = pgTable("cursos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nome: text("nome").notNull(),
  codigo: text("codigo").notNull().default(''),
  areaFormacao: text("areaFormacao").notNull(),
  descricao: text("descricao").notNull().default(''),
  ativo: boolean("ativo").notNull().default(true),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// CONFIGURAÇÕES DA ESCOLA
// -----------------------
export const configGeral = pgTable("config_geral", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nomeEscola: text("nomeEscola").notNull().default('Escola Secundária N.º 1 de Luanda'),
  logoUrl: text("logoUrl"),
  pp1Habilitado: boolean("pp1Habilitado").notNull().default(true),
  pptHabilitado: boolean("pptHabilitado").notNull().default(true),
  notaMinimaAprovacao: integer("notaMinimaAprovacao").notNull().default(10),
  maxAlunosTurma: integer("maxAlunosTurma").notNull().default(35),
  numAvaliacoes: integer("numAvaliacoes").notNull().default(4),
  macMin: integer("macMin").notNull().default(1),
  macMax: integer("macMax").notNull().default(5),
  horarioFuncionamento: text("horarioFuncionamento").notNull().default('Seg-Sex: 07:00-19:00 | Sáb: 07:00-13:00'),
  flashScreen: jsonb("flashScreen").notNull().default(sql`'{}'::jsonb`),
  multaConfig: jsonb("multaConfig").notNull().default(sql`'{"percentagem":10,"diasCarencia":5,"ativo":true}'::jsonb`),
  inscricoesAbertas: boolean("inscricoesAbertas").notNull().default(false),
  inscricaoDataInicio: text("inscricaoDataInicio"),
  inscricaoDataFim: text("inscricaoDataFim"),
  propinaHabilitada: boolean("propinaHabilitada").notNull().default(true),

  // Dados bancários para pagamentos
  numeroEntidade: text("numeroEntidade"),
  iban: text("iban"),
  nomeBeneficiario: text("nomeBeneficiario"),
  bancoTransferencia: text("bancoTransferencia"),
  telefoneMulticaixaExpress: text("telefoneMulticaixaExpress"),
  nib: text("nib"),

  // Dados de identificação MED (Ministério da Educação)
  codigoMED: text("codigoMED"),           // Código atribuído pelo MED
  nifEscola: text("nifEscola"),           // Número de Identificação Fiscal
  provinciaEscola: text("provinciaEscola"),
  municipioEscola: text("municipioEscola"),
  tipoEnsino: text("tipoEnsino").default('Secundário'), // Primário | Secundário | Técnico-Profissional
  modalidade: text("modalidade").default('Presencial'),  // Presencial | Semi-presencial | EaD
  directorGeral: text("directorGeral"),
  directorPedagogico: text("directorPedagogico"),
  directorProvincialEducacao: text("directorProvincialEducacao"),

  // Licença do sistema
  licencaAtivacao: text("licencaAtivacao"),   // "YYYY-MM-DD" — data em que o sistema foi ativado pela 1ª vez
  licencaExpiracao: text("licencaExpiracao"), // "YYYY-MM-DD" — data de expiração
  licencaPlano: text("licencaPlano").default('avaliacao'),

  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),

  // Taxas salariais (configuráveis pelo admin)
  inssEmpPerc: real("inssEmpPerc").notNull().default(3),           // % INSS empregado
  inssPatrPerc: real("inssPatrPerc").notNull().default(8),          // % INSS patronal
  irtTabela: jsonb("irtTabela").notNull().default(sql`'[]'::jsonb`), // tabela IRT por escalões

  // Meses do ano académico (ordem de exibição no boletim de propinas e painel financeiro)
  mesesAnoAcademico: jsonb("mesesAnoAcademico").notNull().default(sql`'[9,10,11,12,1,2,3,4,5,6,7]'::jsonb`),

  // Exame Antecipado — permite que alunos com negativa em disciplinas terminais façam exame sem arrastar para o próximo ano
  exameAntecipadoHabilitado: boolean("exameAntecipadoHabilitado").notNull().default(false),

  // Exclusão por duas reprovações na mesma classe (activável/desactivável)
  exclusaoDuasReprovacoes: boolean("exclusaoDuasReprovacoes").notNull().default(false),

  // PAP — Prova de Aptidão Profissional (13ª Classe / Ensino Técnico-Profissional)
  papHabilitado: boolean("papHabilitado").notNull().default(false),
  // Se true, o estágio é tratado como disciplina no plano curricular (aparece na pauta normal)
  estagioComoDisciplina: boolean("estagioComoDisciplina").notNull().default(false),
  // Nomes das disciplinas curriculares que contribuem para a nota PAP (além de estágio e defesa)
  papDisciplinasContribuintes: jsonb("papDisciplinasContribuintes").notNull().default(sql`'[]'::jsonb`),
});

// -----------------------
// LOOKUP ITEMS (listas configuráveis do sistema)
// -----------------------
export const lookupItems = pgTable("lookup_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  categoria: text("categoria").notNull(), // classes | niveis | turnos | tipos_sala | areas_conhecimento | areas_curso | tipos_taxa | metodos_pagamento | disciplinas_fallback
  valor: text("valor").notNull(),         // valor técnico (chave usada no código)
  label: text("label").notNull(),         // label de exibição
  ordem: integer("ordem").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
});

// -----------------------
// PLANIFICAÇÕES DE AULA
// -----------------------
export const planificacoes = pgTable("planificacoes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  professorId: varchar("professorId").notNull().references(() => professores.id),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  disciplina: text("disciplina").notNull(),
  trimestre: integer("trimestre").notNull(), // 1 | 2 | 3
  semana: integer("semana").notNull(),       // semana do trimestre
  anoLetivo: text("anoLetivo").notNull(),

  tema: text("tema").notNull(),
  objectivos: text("objectivos").notNull().default(''),
  conteudos: text("conteudos").notNull().default(''),
  metodologia: text("metodologia").notNull().default(''),
  recursos: text("recursos").notNull().default(''),
  avaliacao: text("avaliacao").notNull().default(''),
  observacoes: text("observacoes").notNull().default(''),
  numAulas: integer("numAulas").notNull().default(1),
  cumprida: boolean("cumprida").notNull().default(false),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// CONTEÚDOS PROGRAMÁTICOS
// -----------------------
export const conteudosProgramaticos = pgTable("conteudos_programaticos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  disciplina: text("disciplina").notNull(),
  classe: text("classe").notNull(),
  trimestre: integer("trimestre").notNull(),
  anoLetivo: text("anoLetivo").notNull(),

  titulo: text("titulo").notNull(),
  descricao: text("descricao").notNull().default(''),
  ordem: integer("ordem").notNull().default(0),
  cumprido: boolean("cumprido").notNull().default(false),
  percentagem: integer("percentagem").notNull().default(0), // 0–100

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// OCORRÊNCIAS DISCIPLINARES
// -----------------------
export const ocorrencias = pgTable("ocorrencias", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  professorId: varchar("professorId").references(() => professores.id),
  registadoPor: text("registadoPor").notNull(),

  tipo: text("tipo").notNull(), // 'comportamento' | 'falta_injustificada' | 'violencia' | 'fraude' | 'outro'
  gravidade: text("gravidade").notNull().default('leve'), // 'leve' | 'moderada' | 'grave'
  descricao: text("descricao").notNull(),
  medidaTomada: text("medidaTomada").notNull().default(''),
  data: text("data").notNull(),
  resolvida: boolean("resolvida").notNull().default(false),
  observacoes: text("observacoes").notNull().default(''),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// DOCUMENTOS EMITIDOS (HISTÓRICO POR ALUNO)
// -----------------------
export const documentosEmitidos = pgTable("documentos_emitidos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("aluno_id"),
  alunoNome: text("aluno_nome").notNull(),
  alunoNum: text("aluno_num").notNull(),
  alunoTurma: text("aluno_turma"),

  tipo: text("tipo").notNull(),
  finalidade: text("finalidade").default(''),
  anoAcademico: text("ano_academico").default(''),

  emitidoPor: text("emitido_por").notNull(),
  emitidoEm: timestamp("emitido_em", { withTimezone: true }).notNull().defaultNow(),

  dadosSnapshot: text("dados_snapshot"),
});

// -----------------------
// MODELOS DE DOCUMENTOS (EDITOR)
// -----------------------
export const docTemplates = pgTable("doc_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),
  conteudo: text("conteudo").notNull(),
  insigniaBase64: text("insignia_base64"),
  marcaAguaBase64: text("marca_agua_base64"),
  classeAlvo: text("classe_alvo"),
  bloqueado: boolean("bloqueado").notNull().default(false),

  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// DISCIPLINAS (catálogo)
// -----------------------
export const disciplinas = pgTable("disciplinas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nome: text("nome").notNull(),
  codigo: text("codigo").notNull().default(''),
  area: text("area").notNull().default(''),
  descricao: text("descricao").notNull().default(''),
  ativo: boolean("ativo").notNull().default(true),

  // Tipo: 'terminal' (termina antes da 12ª) ou 'continuidade' (10ª a 12ª)
  tipo: text("tipo").notNull().default('continuidade'),
  // Classes em que a disciplina é leccionada (valores do lookup 'classes')
  classeInicio: text("classeInicio").notNull().default(''),
  classeFim: text("classeFim").notNull().default(''),

  // Ligação ao curso (opcional — se null é uma disciplina global/partilhada)
  cursoId: varchar("cursoId").references(() => cursos.id),
  // Carga horária semanal e se é obrigatória nesse curso
  cargaHoraria: integer("cargaHoraria").notNull().default(0),
  obrigatoria: boolean("obrigatoria").notNull().default(true),
  ordem: integer("ordem").notNull().default(0),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// CURSO_DISCIPLINAS (ligação muitos-para-muitos: curso ↔ disciplina do catálogo)
// -----------------------
export const cursoDisciplinas = pgTable("curso_disciplinas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  cursoId: varchar("cursoId")
    .notNull()
    .references(() => cursos.id),

  disciplinaId: varchar("disciplinaId")
    .notNull()
    .references(() => disciplinas.id),

  obrigatoria: boolean("obrigatoria").notNull().default(true),
  cargaHoraria: integer("cargaHoraria").notNull().default(0),
  ordem: integer("ordem").notNull().default(0),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// TOKENS DE RESET DE SENHA
// -----------------------
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  usedAt: timestamp("usedAt", { withTimezone: true }),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PLANOS DE AULA
// -----------------------
export const planosAula = pgTable("planos_aula", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  professorId: varchar("professorId").notNull(),
  professorNome: text("professorNome").notNull(),
  turmaId: varchar("turmaId"),
  turmaNome: text("turmaNome").notNull().default(''),
  disciplina: text("disciplina").notNull(),
  unidade: text("unidade").notNull().default(''),
  sumario: text("sumario").notNull().default(''),
  classe: text("classe").notNull().default(''),
  escola: text("escola").notNull().default(''),
  perfilEntrada: text("perfilEntrada").notNull().default(''),
  perfilSaida: text("perfilSaida").notNull().default(''),
  data: text("data").notNull().default(''),
  periodo: text("periodo").notNull().default(''),
  tempo: text("tempo").notNull().default(''),
  duracao: text("duracao").notNull().default(''),
  anoLetivo: text("anoLetivo").notNull().default(''),
  objectivoGeral: text("objectivoGeral").notNull().default(''),
  objectivosEspecificos: text("objectivosEspecificos").notNull().default(''),
  fases: jsonb("fases").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default('rascunho'),
  observacaoDirector: text("observacaoDirector"),
  aprovadoPor: text("aprovadoPor"),
  aprovadoEm: text("aprovadoEm"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// TRANSFERÊNCIAS DE ALUNOS
// -----------------------
export const transferencias = pgTable("transferencias", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  tipo: text("tipo").notNull(), // 'entrada' | 'saida'
  status: text("status").notNull().default("pendente"), // 'pendente' | 'aprovado' | 'concluido' | 'rejeitado'

  nomeAluno: text("nomeAluno").notNull(),
  alunoId: varchar("alunoId"),

  escolaOrigem: text("escolaOrigem"),
  escolaDestino: text("escolaDestino"),
  classeOrigem: text("classeOrigem"),
  classeDestino: text("classeDestino"),
  turmaDestinoId: varchar("turmaDestinoId"),

  motivo: text("motivo"),
  observacoes: text("observacoes"),

  documentosRecebidos: jsonb("documentosRecebidos").default(sql`'[]'::jsonb`),

  dataRequisicao: text("dataRequisicao"),
  dataAprovacao: text("dataAprovacao"),
  dataConclusao: text("dataConclusao"),

  criadoPor: text("criadoPor"),

  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// BOLSAS E DESCONTOS
// -----------------------
export const bolsas = pgTable("bolsas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId")
    .notNull()
    .references(() => alunos.id, { onDelete: "cascade" }),

  tipo: text("tipo").notNull().default("social"),
  // 'social' | 'merito' | 'desportivo' | 'funcionario' | 'parcial' | 'outro'

  percentagem: real("percentagem").notNull().default(100),
  // 0 = sem desconto, 100 = isento total, 50 = 50% de desconto

  descricao: text("descricao").default(""),
  dataInicio: text("dataInicio"),
  dataFim: text("dataFim"), // null = sem prazo definido

  ativo: boolean("ativo").notNull().default(true),
  aprovadoPor: text("aprovadoPor"),
  observacao: text("observacao"),

  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// CHAT INTERNO (Secretaria / Direcção / Professores)
// -----------------------
export const chatMensagens = pgTable("chat_mensagens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  remetenteId:   varchar("remetenteId").notNull(),
  remetenteNome: text("remetenteNome").notNull(),
  remetenteRole: text("remetenteRole").notNull(),

  destinatarioId:   varchar("destinatarioId").notNull(),
  destinatarioNome: text("destinatarioNome").notNull(),
  destinatarioRole: text("destinatarioRole").notNull().default(""),

  corpo: text("corpo").notNull(),
  lida:  boolean("lida").notNull().default(false),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatMensagem = typeof chatMensagens.$inferSelect;

// -----------------------
// AVALIAÇÃO DE PROFESSORES
// -----------------------
export const avaliacoesProfessores = pgTable("avaliacoes_professores", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  professorId: varchar("professorId")
    .notNull()
    .references(() => professores.id, { onDelete: "cascade" }),

  periodoLetivo: text("periodoLetivo").notNull(), // ex: "2025", "2025-1S"
  avaliador: text("avaliador").notNull(),
  avaliadorId: text("avaliadorId"),

  // Critérios pedagógicos (escala 1-5)
  notaPlaneamento:     real("notaPlaneamento").default(0),
  notaPontualidade:    real("notaPontualidade").default(0),
  notaMetodologia:     real("notaMetodologia").default(0),
  notaRelacaoAlunos:   real("notaRelacaoAlunos").default(0),
  notaRelacaoColegas:  real("notaRelacaoColegas").default(0),
  notaResultados:      real("notaResultados").default(0),
  notaDisciplina:      real("notaDisciplina").default(0),
  notaDesenvolvimento: real("notaDesenvolvimento").default(0),

  notaFinal: real("notaFinal").default(0),

  status: text("status").notNull().default("rascunho"),
  // 'rascunho' | 'submetida' | 'aprovada'

  pontosFuertes:  text("pontosFuertes").default(""),
  areasMelhoria:  text("areasMelhoria").default(""),
  recomendacoes:  text("recomendacoes").default(""),

  avaliacaoEm:  timestamp("avaliacaoEm", { withTimezone: true }),
  criadoEm:     timestamp("criadoEm",    { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp("atualizadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// TRABALHOS FINAIS DE CURSO
// -----------------------
export const trabalhosFinals = pgTable("trabalhos_finais", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  titulo: text("titulo").notNull(),
  autor: text("autor").notNull(),
  orientador: text("orientador").notNull(),
  anoConclusao: integer("anoConclusao").notNull(),
  curso: text("curso").notNull(),
  imagemCapa: text("imagemCapa"),
  resumo: text("resumo").default(""),
  visitas: integer("visitas").notNull().default(0),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrabalhoFinalSchema = createInsertSchema(trabalhosFinals).omit({ id: true, criadoEm: true });
export type InsertTrabalhoFinal = z.infer<typeof insertTrabalhoFinalSchema>;
export type TrabalhoFinal = typeof trabalhosFinals.$inferSelect;

// -----------------------
// AUDIT LOG
// -----------------------
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  userId:    varchar("userId").notNull(),
  userEmail: text("userEmail").notNull(),
  userRole:  text("userRole").notNull(),
  userName:  text("userName"),

  acao:      text("acao").notNull(),      // 'criar' | 'atualizar' | 'eliminar' | 'login' | 'login_falhado' | 'aprovar' | 'rejeitar' | 'exportar'
  modulo:    text("modulo").notNull(),    // 'Alunos' | 'Professores' | 'Turmas' | ...
  descricao: text("descricao").notNull(), // Human-readable description

  recursoId: varchar("recursoId"),        // ID of the affected resource
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  dados:     jsonb("dados"),              // sanitised request body / extra context

  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------
// PAP — PROVA DE APTIDÃO PROFISSIONAL (13ª Classe)
// -----------------------
export const papAlunos = pgTable("pap_alunos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id, { onDelete: "cascade" }),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  anoLetivo: text("anoLetivo").notNull(),

  // Nota do Estágio Curricular (atribuída pelo professor orientador)
  notaEstagio: real("notaEstagio"),

  // Nota da Defesa do PAP / Prova Oral
  notaDefesa: real("notaDefesa"),

  // Notas das disciplinas que contribuem para o PAP: [{nome: string, nota: number}]
  notasDisciplinas: jsonb("notasDisciplinas").notNull().default(sql`'[]'::jsonb`),

  // Nota PAP calculada automaticamente: (avg(disciplinas) + notaEstagio + notaDefesa) / 3
  // Esta é a nota que consta no certificado
  notaPAP: real("notaPAP"),

  professorId: varchar("professorId").notNull().references(() => professores.id),
  observacoes: text("observacoes"),

  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  criadoEm:  timestamp("criadoEm",  { withTimezone: true }).notNull().defaultNow(),
});

export const insertPapAlunoSchema = createInsertSchema(papAlunos).omit({ id: true, criadoEm: true, updatedAt: true });
export type InsertPapAluno = z.infer<typeof insertPapAlunoSchema>;
export type PapAluno = typeof papAlunos.$inferSelect;

// -----------------------
// CONFIGURAÇÕES DE FALTA (por turma/disciplina — definido pelo Director de Turma)
// -----------------------
export const configuracoesFalta = pgTable("configuracoes_falta", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  turmaId: varchar("turmaId").notNull().references(() => turmas.id, { onDelete: "cascade" }),
  disciplina: text("disciplina").notNull(), // nome da disciplina ou '*' para todas
  anoLetivo: text("anoLetivo").notNull(),

  // Número máximo de faltas mensais antes de exclusão
  maxFaltasMensais: integer("maxFaltasMensais").notNull().default(3),

  // Activar controlo de faltas para esta turma/disciplina
  ativo: boolean("ativo").notNull().default(true),

  definidoPor: text("definidoPor").notNull().default(''), // nome do director de turma
  definidoPorId: varchar("definidoPorId"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export type ConfiguracaoFalta = typeof configuracoesFalta.$inferSelect;

// -----------------------
// REGISTOS MENSAIS DE FALTAS (controlo mensal por aluno/disciplina)
// -----------------------
export const registosFaltaMensal = pgTable("registos_falta_mensal", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id, { onDelete: "cascade" }),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id, { onDelete: "cascade" }),
  disciplina: text("disciplina").notNull(),
  mes: integer("mes").notNull(),   // 1-12
  ano: integer("ano").notNull(),
  trimestre: integer("trimestre").notNull().default(1), // 1|2|3

  totalFaltas: integer("totalFaltas").notNull().default(0),
  faltasJustificadas: integer("faltasJustificadas").notNull().default(0),
  faltasInjustificadas: integer("faltasInjustificadas").notNull().default(0),

  // 'normal' | 'em_risco' | 'excluido'
  status: text("status").notNull().default('normal'),

  // Registado/revisado pelo director de turma
  observacao: text("observacao").notNull().default(''),
  registadoPor: text("registadoPor").notNull().default(''),
  registadoPorId: varchar("registadoPorId"),

  // Data em que foi registado o levantamento mensal
  dataRegisto: text("dataRegisto").notNull(),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type RegistoFaltaMensal = typeof registosFaltaMensal.$inferSelect;

// -----------------------
// EXCLUSÕES POR FALTA (registo formal de exclusão por disciplina)
// -----------------------
export const exclusoesFalta = pgTable("exclusoes_falta", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id, { onDelete: "cascade" }),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  disciplina: text("disciplina").notNull(),
  anoLetivo: text("anoLetivo").notNull(),
  trimestre: integer("trimestre").notNull(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),

  totalFaltasAcumuladas: integer("totalFaltasAcumuladas").notNull().default(0),
  limiteFaltas: integer("limiteFaltas").notNull().default(3),

  // 'exclusao_disciplina' | 'anulacao_matricula' | 'dupla_reprovacao'
  tipoExclusao: text("tipoExclusao").notNull().default('exclusao_disciplina'),

  motivo: text("motivo").notNull().default(''),
  observacao: text("observacao").notNull().default(''),

  registadoPor: text("registadoPor").notNull(),
  registadoPorId: varchar("registadoPorId"),

  // Status: 'ativo' | 'anulado' (se a exclusão foi revertida por decisão superior)
  status: text("status").notNull().default('ativo'),

  dataExclusao: text("dataExclusao").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type ExclusaoFalta = typeof exclusoesFalta.$inferSelect;

// -----------------------
// SOLICITAÇÕES DE PROVA JUSTIFICADA
// -----------------------
export const solicitacoesProvaJustificada = pgTable("solicitacoes_prova_justificada", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id, { onDelete: "cascade" }),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  disciplina: text("disciplina").notNull(),
  anoLetivo: text("anoLetivo").notNull(),
  trimestre: integer("trimestre").notNull(),

  // Tipo de prova perdida
  tipoProva: text("tipoProva").notNull().default('teste'), // 'teste' | 'exame' | 'mini_teste' | 'trabalho'

  // Data original da prova perdida
  dataProvaOriginal: text("dataProvaOriginal").notNull(),

  // Data proposta para a prova justificada (pode ser definida pela escola)
  dataProvaJustificada: text("dataProvaJustificada"),

  motivo: text("motivo").notNull(),
  documentoJustificacao: text("documentoJustificacao"), // nome/referência do documento

  // 'pendente' | 'aprovada' | 'rejeitada' | 'realizada'
  status: text("status").notNull().default('pendente'),

  resposta: text("resposta").notNull().default(''),
  respondidoPor: text("respondidoPor").notNull().default(''),
  respondidoEm: text("respondidoEm"),

  solicitadoPor: text("solicitadoPor").notNull(), // nome do encarregado/aluno
  solicitadoPorId: varchar("solicitadoPorId"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export type SolicitacaoProvaJustificada = typeof solicitacoesProvaJustificada.$inferSelect;

// -----------------------
// ANULAÇÕES DE MATRÍCULA
// -----------------------
export const anulacoesMatricula = pgTable("anulacoes_matricula", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id),
  alunoNome: text("alunoNome").notNull(),
  turmaId: varchar("turmaId"),
  turmaNome: text("turmaNome").notNull().default(''),
  anoLetivo: text("anoLetivo").notNull(),

  // 'voluntaria' | 'disciplinar' | 'financeira' | 'faltas' | 'dupla_reprovacao' | 'outro'
  motivo: text("motivo").notNull(),
  descricao: text("descricao").notNull().default(''),

  dataAnulacao: text("dataAnulacao").notNull(),

  registadoPor: text("registadoPor").notNull(),
  registadoPorId: varchar("registadoPorId"),

  // Documentos associados ao processo
  documentos: jsonb("documentos").notNull().default(sql`'[]'::jsonb`),

  // Se o aluno pode ser re-admitido
  reAdmissaoPermitida: boolean("reAdmissaoPermitida").notNull().default(false),
  observacoes: text("observacoes").notNull().default(''),

  // Status: 'ativa' | 'revertida'
  status: text("status").notNull().default('ativa'),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type AnulacaoMatricula = typeof anulacoesMatricula.$inferSelect;

// -----------------------
// QUADRO DE HONRA
// -----------------------
export const quadroHonra = pgTable("quadro_honra", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  alunoId: varchar("alunoId").notNull().references(() => alunos.id, { onDelete: "cascade" }),
  alunoNome: text("alunoNome").notNull(),
  turmaId: varchar("turmaId").notNull().references(() => turmas.id),
  turmaNome: text("turmaNome").notNull(),
  anoLetivo: text("anoLetivo").notNull(),
  trimestre: integer("trimestre"), // null = anual

  mediaGeral: real("mediaGeral").notNull().default(0),
  posicaoClasse: integer("posicaoClasse").notNull().default(1),
  posicaoGeral: integer("posicaoGeral"),

  // Melhor da escola no ano académico
  melhorEscola: boolean("melhorEscola").notNull().default(false),

  mencionado: text("mencionado").notNull().default(''), // 'louvor' | 'honra' | 'excelencia'
  publicado: boolean("publicado").notNull().default(false),

  geradoPor: text("geradoPor").notNull().default('Sistema'),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type QuadroHonraEntry = typeof quadroHonra.$inferSelect;

// -----------------------
// PROCESSOS SECRETARIA
// -----------------------
export const processosSecretaria = pgTable("processos_secretaria", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  tipo: text("tipo").notNull(),
  descricao: text("descricao").notNull(),
  solicitante: text("solicitante").notNull(),
  prazo: text("prazo"),
  status: text("status").notNull().default("pendente"),
  prioridade: text("prioridade").notNull().default("media"),

  criadoPor: text("criadoPor").notNull().default("Secretaria"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export type ProcessoSecretaria = typeof processosSecretaria.$inferSelect;
export const insertProcessoSecretariaSchema = createInsertSchema(processosSecretaria);

// -----------------------
// PLANO DE CONTAS (Hierárquico mãe/filho)
// -----------------------
export const planoContas = pgTable("plano_contas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  codigo: text("codigo").notNull(),           // e.g. "1", "1.1", "1.1.1"
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(),               // 'receita' | 'despesa' | 'ativo' | 'passivo'
  parentId: varchar("parentId"),              // null = conta mãe raiz
  descricao: text("descricao").notNull().default(''),
  ativo: boolean("ativo").notNull().default(true),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type PlanoContas = typeof planoContas.$inferSelect;
export const insertPlanoContasSchema = createInsertSchema(planoContas).omit({ id: true, createdAt: true });

// -----------------------
// CONTAS A PAGAR (Despesas da escola)
// -----------------------
export const contasPagar = pgTable("contas_pagar", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  descricao: text("descricao").notNull(),
  fornecedor: text("fornecedor").notNull().default(''),
  valor: real("valor").notNull(),
  dataVencimento: text("dataVencimento").notNull(),
  dataPagamento: text("dataPagamento"),
  status: text("status").notNull().default('pendente'), // 'pendente' | 'pago' | 'cancelado' | 'em_atraso'
  metodoPagamento: text("metodoPagamento"),             // 'dinheiro' | 'transferencia' | 'multicaixa'
  planoContaId: varchar("planoContaId"),                // FK to plano_contas (optional)
  referencia: text("referencia"),
  comprovante: text("comprovante"),
  observacao: text("observacao"),
  registadoPor: text("registadoPor").notNull().default('Sistema'),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export type ContaPagar = typeof contasPagar.$inferSelect;
export const insertContaPagarSchema = createInsertSchema(contasPagar).omit({ id: true, createdAt: true, updatedAt: true });

// -----------------------
// FERIADOS (Calendário Financeiro)
// -----------------------
export const feriados = pgTable("feriados", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  nome: text("nome").notNull(),
  data: text("data").notNull(),               // 'YYYY-MM-DD'
  tipo: text("tipo").notNull().default('nacional'), // 'nacional' | 'municipal' | 'escolar'
  recorrente: boolean("recorrente").notNull().default(true), // repeats every year
  ativo: boolean("ativo").notNull().default(true),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

export type Feriado = typeof feriados.$inferSelect;
export const insertFeriadoSchema = createInsertSchema(feriados).omit({ id: true, createdAt: true });
