-- SIGA v3 — Seed de utilizadores
-- Execute com: npm run db:seed:utilizadores

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS utilizadores (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  senha text NOT NULL,
  role text NOT NULL,
  escola text,
  ativo boolean NOT NULL DEFAULT true,
  "alunoId" varchar,
  "criadoEm" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO utilizadores (id, nome, email, senha, role, escola, ativo, "criadoEm")
VALUES
  ('5f50cc2d-84be-4202-8167-2cc7b8862eda', 'Administrador do Sistema', 'admin@sige.ao',      'Admin@2025',    'admin',       'Escola SIGA', true, '2026-03-27 04:11:45.668+00'),
  ('03005167-7173-49fd-b587-1947ace982bd', 'CEO Escolar',             'ceo@sige.ao',         'Ceo@2025',      'ceo',         '',            true, '2026-03-27 04:18:07.763+00'),
  ('3e8fafbe-66b8-4f2a-8d7a-0572698b9fea', 'Director Académico',      'director@sige.ao',    'Director@2025', 'director',    'Escola SIGA', true, '2026-03-27 04:11:45.668+00'),
  ('329d8b64-dbb9-4309-88a4-b72fbe72efea', 'Encarregado de Educação', 'encarregado@sige.ao', 'Enc@2025',      'encarregado', 'Escola SIGA', true, '2026-03-27 04:11:45.668+00'),
  ('a65cf916-e5c1-452f-86c5-22c9744a042c', 'PCA Escolar',             'pca@sige.ao',         'PCA@2025',      'pca',         'Escola SIGA', true, '2026-03-27 04:11:45.668+00'),
  ('285cafb9-076a-47af-ae22-ef47b65c5268', 'Professor Exemplo',       'professor@sige.ao',   'Prof@2025',     'professor',   'Escola SIGA', true, '2026-03-27 04:11:45.668+00')
ON CONFLICT (id) DO NOTHING;
