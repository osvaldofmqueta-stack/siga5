import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
// App data (Supabase)
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
  ativo: boolean("ativo").notNull().default(true),
  foto: text("foto"),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

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

  // Escala 0-20 (PP, MT, PT + MAC)
  aval1: integer("aval1").notNull().default(0),
  aval2: integer("aval2").notNull().default(0),
  aval3: integer("aval3").notNull().default(0),
  aval4: integer("aval4").notNull().default(0),
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

  // Opcional (checkbox/lançamentos)
  lancamentos: jsonb("lancamentos"),
});

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

export const eventos = pgTable("eventos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  data: text("data").notNull(),
  hora: text("hora").notNull(),
  tipo: text("tipo").notNull(), // "Académico" | "Exame" | ...
  local: text("local").notNull(),
  turmasIds: jsonb("turmasIds").notNull(),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});

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

  diaSemana: integer("diaSemana").notNull(), // 1=Seg ... 5=Sex
  periodo: integer("periodo").notNull(),     // 1..6
  horaInicio: text("horaInicio").notNull(),
  horaFim: text("horaFim").notNull(),
  sala: text("sala").notNull().default(''),
  anoAcademico: text("anoAcademico").notNull(),

  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
});
