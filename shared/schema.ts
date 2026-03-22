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
  role: text("role").notNull(), // 'admin' | 'professor' | 'aluno' | 'financeiro' | 'rh' | 'encarregado'
  escola: text("escola").notNull().default(''),
  ativo: boolean("ativo").notNull().default(true),
  alunoId: varchar("alunoId"), // only for role='encarregado'
  criadoEm: timestamp("criadoEm", { withTimezone: true }).notNull().defaultNow(),
});

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
    .notNull()
    .references(() => turmas.id),

  nomeEncarregado: text("nomeEncarregado").notNull(),
  telefoneEncarregado: text("telefoneEncarregado").notNull(),
  emailEncarregado: text("emailEncarregado"),
  ativo: boolean("ativo").notNull().default(true),
  bloqueado: boolean("bloqueado").notNull().default(false),
  foto: text("foto"),

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

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
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
    .notNull()
    .references(() => professores.id),

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

  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
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
