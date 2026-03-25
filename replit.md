# SIGA v3 - Sistema Integrado de Gestão Académica

## Recent Changes (Latest Session — Pagamentos Online: Multicaixa Express + Referências Bancárias)
- **app/(main)/portal-encarregado.tsx**: Aba "Financeiro" totalmente remodelada:
  - Secção "Pagar Online" aparece para encarregados com propinas em atraso
  - Por cada mês em atraso: botão "Pagar" abre seletor de método de pagamento
  - **Multicaixa Express**: instruções passo-a-passo (app/USSD *840#), número do beneficiário, valor, descrição a inserir. Cria pagamento `pendente` com `metodoPagamento: 'multicaixa'`
  - **Referência Bancária**: gera RUPE automaticamente (`gerarRUPE`), mostra Entidade, Referência, Valor, Validade (15 dias), IBAN, Banco, Beneficiário. Cria pagamento `pendente` com referência
  - Secção "Em Processamento": mostra meses com pagamentos `pendente` aguardando confirmação da secretaria
  - Secção "Referências Geradas": histórico de RUPEs com estado (Activo/Pago/Expirado)
  - Info de pagamento presencial quando métodos online não estão configurados
  - Histórico de pagamentos melhorado: mostra estado (Pago/Pendente/Cancelado) em cada entrada
- **app/(main)/admin.tsx**: Novo cartão "Pagamentos Online" na secção Configurações:
  - **Multicaixa Express**: campo de número de telemóvel; indicador activo/inactivo
  - **Referência Bancária / RUPE**: campos para Nome do Beneficiário, Número de Entidade, Banco, IBAN/NIB, NIB; indicador activo quando Entidade ou IBAN preenchidos
  - Configuração guarda em `config` via `updateConfig` para os campos existentes: `telefoneMulticaixaExpress`, `nomeBeneficiario`, `numeroEntidade`, `bancoTransferencia`, `iban`, `nib`

## Recent Changes (Previous Session — Pautas e Prazos de Lançamento)
- **app/(main)/secretaria-hub.tsx**: Nova aba "Pautas" com filtros por estado/trimestre/turma, impressão HTML oficial e exportação Excel (XLSX). Apenas pautas fechadas podem ser impressas/exportadas.
- **app/(main)/admin.tsx**: Cartão "Prazos de Lançamento de Notas" na secção Configurações com DatePickerField para T1, T2, T3. Estado activo/expirado visível.

## Recent Changes (Previous — Integração Disciplina-Curso Completa)
- **shared/schema.ts**: Nova tabela `curso_disciplinas` (muitos-para-muitos: curso ↔ disciplina do catálogo). Campos: `cursoId`, `disciplinaId`, `obrigatoria`, `cargaHoraria`, `ordem`. Tabela `turmas` já tinha `cursoId` (presente desde sessão anterior).
- **server/routes.ts**: 3 novas rotas:
  - `GET /api/cursos/:id/disciplinas` — devolve disciplinas ligadas a um curso (com JOIN ao catálogo)
  - `PUT /api/cursos/:id/disciplinas` — repõe lista de disciplinaIds para um curso (substitui tudo)
  - `GET /api/turmas/:id/disciplinas` — devolve disciplinas de uma turma via cursoId. Adicionado `cursoId` ao INSERT e PUT de `/api/turmas`.
- **context/DataContext.tsx**: `cursoId?: string` adicionado à interface `Turma`.
- **app/(main)/turmas.tsx**: `TurmaFormModal` carrega cursos via `/api/cursos` e apresenta picker de curso (II Ciclo — opcional). Ao seleccionar, mostra aviso de que as disciplinas do curso serão usadas.
- **app/(main)/professores.tsx**: O campo de disciplinas passou de texto livre para multi-select do catálogo (`/api/disciplinas`). Carrega ao abrir o modal; professor toca para seleccionar/deseleccionar disciplinas.
- **app/(main)/professor-pauta.tsx**: `disciplinas` passou de `prof?.disciplinas` para `useState` + `useEffect` que faz fetch a `/api/turmas/:id/disciplinas` quando `turmaId` muda. Fallback para as disciplinas do professor se o curso não tiver disciplinas configuradas.
- **app/(main)/notas.tsx**: `disciplinasDisponiveis` passou de `useMemo` com lista hardcoded para `useState` + `useEffect` que faz fetch a `/api/turmas/:id/disciplinas` quando `filterTurma` muda. Fallback progressivo: turma → professor → lista padrão.
- **app/(main)/admin.tsx**: Secção Cursos tem agora botão (ícone livro) em cada card que abre um modal de gestão de disciplinas. Modal mostra catálogo completo com checkboxes; guarda via `PUT /api/cursos/:id/disciplinas`.

## Recent Changes (Previous Session — Área Pedagógica Completa)
- **shared/schema.ts**: 3 novas tabelas:
  - `planificacoes`: Planos de aula por professor, turma, disciplina, trimestre e semana. Campos: tema, objectivos, conteúdos, metodologia, recursos, avaliação, nº aulas, cumprida.
  - `conteudos_programaticos`: Mapa do programa por disciplina, classe e trimestre. Campos: título, descrição, percentagem de cumprimento, cumprido, ordem.
  - `ocorrencias`: Registo de incidentes disciplinares por aluno. Campos: tipo (comportamento/falta_injustificada/violência/fraude/outro), gravidade (leve/moderada/grave), descrição, medida tomada, resolvida.
- **server/routes.ts**: 12 novos endpoints CRUD:
  - `GET/POST/PUT/DELETE /api/planificacoes` (com filtros: turmaId, disciplina, trimestre, anoLetivo, professorId)
  - `GET/POST/PUT/DELETE /api/conteudos-programaticos` (com filtros: disciplina, classe, trimestre, anoLetivo)
  - `GET/POST/PUT/DELETE /api/ocorrencias` (com filtros: alunoId, turmaId, resolvida)
- **app/(main)/pedagogico.tsx** *(new)*: Ecrã completo com 4 tabs:
  - **Planificações**: Planos de aula por trimestre com KPIs (total/cumpridas/por cumprir). Filtros por turma, disciplina e trimestre. Toggle "cumprida". CRUD completo com modal detalhado.
  - **Programa**: Mapa de conteúdos programáticos com barra de progresso global (%). Agrupado por trimestre. Toggle "cumprido" e actualização de %. CRUD completo.
  - **Resultados**: Aprovado (≥10) / Exame (8–9) / Reprovado (<8) calculado automaticamente das notas existentes. Vista geral por turma com taxa de aprovação. Vista detalhada por aluno com média final.
  - **Ocorrências**: Registo disciplinar com filtros por turma, gravidade e estado. KPIs (em aberto/graves/resolvidas). Acção "Resolver". CRUD completo.
- **app/(main)/_layout.tsx**: Registado `pedagogico` como novo Stack.Screen.
- **components/DrawerLeft.tsx**: "Área Pedagógica" adicionada em 3 secções de navegação: Admin/Director (Pedagógico), Professor (Académico), Secretaria (Planeamento).

## Recent Changes (Previous Session — Hub de Recursos Humanos Completo)
- **app/(main)/rh-hub.tsx** *(new)*: Perfil RH completo com 6 tabs integradas:
  - **Painel**: Dashboard com KPIs (profAtivos, sumáriosPendentes, solicitações, provas, pautas, turmas), ranking de professores mais activos por taxa de aceitação de sumários, alerta de solicitações pendentes, estado das pautas, carga horária por professor (via `/api/horarios`).
  - **Professores**: Lista pesquisável e filtrável (todos/activo/inactivo) com avatar, disciplinas, habilitações, turmas atribuídas, métricas de sumários (total/aceites/rejeitados/taxa). Tap → modal de perfil completo com histórico de sumários.
  - **Sumários**: Validação com pesquisa full-text + filtro por estado (pendente/aceite/rejeitado/todos). Modal de revisão com aceite/rejeição e observação RH.
  - **Solicitações**: Gestão de pedidos de reabertura de pautas com resposta e aprovação/rejeição. Integrado com `updatePauta`.
  - **Calendário**: Agendamento de provas/avaliações (tipo, título, disciplina, data, hora, descrição, turmas). Toggle publicado/rascunho. Eliminar prova.
  - **Pautas**: Visão geral de todas as pautas (aberta/fechada/pendente_abertura/rejeitada) com link directo para solicitações pendentes.
- **components/DrawerLeft.tsx**: CTA verde dedicado "Recursos Humanos" no sidebar para admin/director/rh/secretaria. `isRH` expandido para incluir `role === 'rh'`. `RH_SECTIONS` completo para utilizadores com role puro `rh`. Links `rh-controle` actualizados para `rh-hub`.
- **app/(main)/_layout.tsx**: Registado `rh-hub` como novo Stack.Screen.

## Recent Changes (Previous Session — Processo de Admissão Completo)
- **shared/schema.ts**: `registros` extended with: `telefone`, `email`, `endereco`, `bairro`, `numeroBi`, `numeroCedula`, `senhaProvisoria`, `dataProva`, `notaAdmissao`, `resultadoAdmissao`, `matriculaCompleta`, `rupeInscricao`, `rupeMatricula`. Status now includes `'admitido' | 'reprovado_admissao' | 'matriculado'`.
- **server/routes.ts**: New admissions endpoints: `POST /api/login-provisorio`, `GET /api/registros/:id`, `PUT /api/registros/:id/publicar-data-prova`, `PUT /api/registros/:id/lancar-nota`, `POST /api/registros/:id/gerar-rupe`, `POST /api/registros/:id/completar-matricula`. Password: `apelido + reversedBirthYear`.
- **app/registro.tsx**: Rewritten as 3-step form (Dados Pessoais → Contacto & Identificação → Escolaridade). Shows `CredenciaisModal` with email + provisional password after successful submission.
- **app/login-provisorio.tsx** *(new)*: Standalone login for provisional accounts. Stores session in AsyncStorage. Explains the password formula.
- **app/portal-provisorio.tsx** *(new)*: Full provisional student portal with status-driven sections: exam date display, RUPE generation for inscription/enrollment fee, grade display, enrollment completion trigger, final redirect to official login.
- **app/(main)/admissao.tsx** *(new)*: Full admissions management screen for secretaria. Tabs: Pendentes / Aprovados / Resultado / Concluídos. Actions: approve/reject (pendentes), publish exam date + enter grade (aprovados). Detail modal for each registration.
- **app/(main)/secretaria-hub.tsx**: Added "Processo de Admissão" to QUICK_ACTIONS (routes to `/(main)/admissao`).
- **app/login.tsx**: Added "Conta Provisória" button below the registration card, routes to `/login-provisorio`.

## Recent Changes (Previous Session — Gestão de Acessos / Permissões)
- **shared/schema.ts**: Nova tabela `user_permissions` com `userId` (unique), `permissoes` (jsonb) e `atualizado_em`.
- **server/routes.ts**: 4 novas rotas — `GET /api/user-permissions`, `GET /api/user-permissions/:userId`, `PUT /api/user-permissions/:userId` (upsert), `DELETE /api/user-permissions/:userId`.
- **context/PermissoesContext.tsx** *(new)*: Contexto completo de permissões. Exporta `FEATURE_CATEGORIES` (26 funcionalidades em 8 categorias), `ROLE_DEFAULTS` (padrões por cargo), `usePermissoes()` com `hasPermission(key)`, `getUserPermissions(userId, role)`, `saveUserPermissions`, `resetUserPermissions`.
- **app/(main)/gestao-acessos.tsx** *(new)*: Ecrã de gestão de acessos exclusivo para CEO/PCA.
  - Painel esquerdo: lista de todos os utilizadores com pesquisa, badge de cargo, contador de permissões activas.
  - Painel direito: matrix de permissões do utilizador seleccionado com categorias expansíveis, barra de progresso, acções rápidas (Activar Tudo, Desactivar Tudo, Repor Padrão), badge "Fora do cargo" para permissões extra-role.
  - Persistência na BD via API. Efeito imediato no login do utilizador.
- **components/DrawerLeft.tsx**: Todos os `NavItem` têm agora `permKey`. Items filtrados por `hasPermission()` para todos os cargos excepto CEO/PCA. CEO tem acesso a "Gestão de Acessos" no menu Administração.
- **app/(main)/perfil.tsx**: Botão "Gestão de Acessos" visível apenas para CEO/PCA.
- **app/(main)/_layout.tsx**: Registado `gestao-acessos` como novo Stack.Screen.
- **app/_layout.tsx**: `PermissoesProvider` adicionado à árvore de contextos (logo após `AuthProvider`).

## Recent Changes (Previous Session — Bloqueio de Documentos)
- **app/(main)/editor-documentos.tsx**: `Alert` adicionado aos imports React Native. Sistema de bloqueio/desbloqueio com verificação de cargo (`pca`, `ceo`, `admin`, `director`).
- **app/(main)/editor-documentos.tsx** (ListScreen): Tabs de filtro (Todos/Activos/Bloqueados) para gestores; utilizadores comuns só vêem modelos activos.

## Recent Changes (Previous Session — Boletim de Matrícula)
- **app/(main)/boletim-matricula.tsx** *(new)*: Ecrã completo para geração e impressão do Boletim de Matrícula.
  - **Pesquisa de aluno**: campo de busca com dropdown em tempo real (por nome ou nº de matrícula).
  - **QR Code**: gerado com `react-native-qrcode-svg` contendo JSON com matrícula, nome, turma, classe, anoLetivo e escola — substitui o espaço de fotografia do modelo original.
  - **Dados automáticos (variáveis da BD)**: `numeroMatricula`, `nomeCompleto` (nome+apelido), `dataNascimento`, `genero`, `municipio`, `provincia`, `nomeEncarregado`, `telefoneEncarregado`, `turmaNome`, `classe`, `turno`, `nivel`, `anoLetivo`, `nomeEscola` (ConfigContext).
  - **Impressão / PDF**: botão "Imprimir / Exportar PDF" usa `window.open()` + `window.print()` com HTML A4 portrait completo, incluindo: cabeçalho (República de Angola · Ministério da Educação · nome da escola), secção A (dados do aluno), secção B (dados do encarregado), secção C (dados escolares), Declaração sob compromisso de honra, assinaturas do director, chefe de secretaria, aluno e encarregado.
  - **Pré-visualização nativa**: cartão no ecrã que mostra o boletim estruturado com todas as secções.
  - **Tabela de variáveis**: painel visual que lista todos os campos que serão preenchidos automaticamente.
- **app/(main)/_layout.tsx**: Registado `boletim-matricula` como novo Stack.Screen.
- **app/(main)/secretaria-hub.tsx**: Adicionado botão "Boletim de Matrícula" nas Quick Actions (ícone `newspaper`, cor âmbar).
- **app/(main)/alunos.tsx**: Adicionado botão de atalho (ícone `newspaper-outline`) em cada cartão de aluno para aceder ao Boletim de Matrícula.

## Recent Changes (Latest Session — Centro de Supervisão)
- **app/(main)/controlo-supervisao.tsx**: Novo ecrã dedicado de supervisão para CEO/PCA/Administrador/Director:
  - **5 tabs**: Visão Geral, Utilizadores, Secretaria, Académico, Financeiro
  - **Stats cards** com gradientes por módulo: total de utilizadores, alunos, professores, turmas, pagamentos, notas lançadas, matrículas pendentes
  - **Distribuição de utilizadores** por perfil com barra de progresso colorida por role
  - **Atalhos rápidos** para todos os módulos do sistema
  - **Filtro de utilizadores** por perfil (chips horizontais) com avatares e indicadores de estado activo/inactivo
  - **Responsive**: layout adaptado desktop/mobile via `useBreakpoint`
  - **Pull-to-refresh** em todos os dados da API
- **components/DrawerLeft.tsx**: Adicionado bloco visual "Centro de Supervisão" separado do menu principal — aparece como CTA com gradiente e borda dourada entre o separador e as secções de navegação, exclusivo para CEO/PCA/Administrador/Director; removida a secção "Controlo da Secretaria" das secções normais
- **app/(main)/_layout.tsx**: Registado `controlo-supervisao` como novo Stack.Screen

An Academic Management System (SGAA Angola) for educational institutions in Angola. Built as a cross-platform application (Web, Android, iOS) using a TypeScript stack.

## Recent Changes (Latest Session — Mapa de Aproveitamento)
- **app/(main)/editor-documentos.tsx**: Completed and structured the Mapa de Aproveitamento document model:
  - **SEED updated (v2)**: New seed `tpl_seed_mapa_aproveitamento_v2` with clear description of auto-generated variables and structure.
  - **`buildMapaAproveitamentoHtml(trimestre)`**: Fixed official header (República de Angola → Governo da Província → Administração Municipal → Repartição de Educação, Ensino Ciência e Tecnologia e Inovação → Área do Ensino Geral). Title now includes "ESCOLAS PRIVADA" and proper year format (e.g., 2023/24). Configurable `tipoEscola` via config.
  - **Class matching bug fixed**: `turmasForClasse()` now uses regex to correctly match `1ª` without matching `10ª`, `11ª`, `12ª`. Iniciação matched via Unicode normalization.
  - **`handlePrint()`**: Added `mapa_aproveitamento` case — generates A3 landscape HTML and prints directly.
  - **`EmitScreen()`**: Added trimestre selector panel (1º/2º/3º) for mapa type. Right panel shows live summary stats (Matriculados, Avaliados, C/Aproveitamento %, S/Aproveitamento %). `canPrint` now returns `true` for mapa type without requiring turma/aluno selection.
  - **Variables available**: escola, director, provincia, municipio, anoLetivo, all class-level stats (MF/F for matriculados, avaliados, c/aproveitamento, s/aproveitamento, professores), sub-totals by nivel, grand total.

## Recent Changes (Previous Session — Financial Profile)
- **context/FinanceiroContext.tsx**: Fully rewritten with new interfaces: `MultaConfig`, `MensagemFinanceira`, `RUPEGerado`. New functions: `bloquearAluno`/`desbloquearAluno`/`isAlunoBloqueado`, `enviarMensagem`/`getMensagensAluno`/`marcarMensagemLida`, `gerarRUPE`/`getRUPEsAluno`, `getMesesEmAtraso`, `calcularMulta`. Persistent storage keys: `@sgaa_multa_config`, `@sgaa_mensagens_financeiras`, `@sgaa_rupes`, `@sgaa_bloqueados_financeiros`.
- **app/(main)/financeiro.tsx**: Completely rewritten with 6 tabs: Resumo (KPIs, bar chart, recent transactions), Em Atraso (overdue list with message/RUPE/block actions per student), Mensagens (all sent financial messages), Pagamentos (full payment management + confirmation), Rubricas (CRUD with multa config), Por Aluno (detailed student financial profile with history, RUPEs, messages, actions).
- **context/UsersContext.tsx**: Applied `seedUsersV3` call in the `load()` function to ensure the financeiro user (`financeiro@sige.ao` / `Fin@2025`) is seeded.
- **components/DrawerLeft.tsx**: Added `isFinanceiro` role detection and `FINANCEIRO_SECTIONS` navigation. Financeiro user now sees a dedicated sidebar with Gestão Financeira and operational links.
- **app/(main)/portal-estudante.tsx**: Financial tab now shows dynamic data from FinanceiroContext — bloqueio banner if student is blocked, propina overdue warning with multa estimate, financial messages from the financial department (with mark-as-read), RUPE references history. `todasTaxasAluno` filter updated to match "Todos" nivel.

## Recent Changes (Previous Session)
- **portal-estudante.tsx** *(new)*: Complete student portal with 8 tabs — Painel (academic overview + discipline status), Notas (AVAL1-4, PP, PT, MAC, NF per trimester + pauta status), Mensagens (teacher messages, private/class filter, mark-as-read), Materiais (teacher files + lesson summaries), Horário (weekly schedule), Financeiro (propina payment, document payment via RUPE/Multicaixa Express, re-enrollment confirmation, payment history), Histórico (academic history by trimester), Documentos (request declarations, track status). Profile photo upload (web + native compatible).
- **perfil.tsx**: Added "Aceder ao Portal do Estudante" button in the student academic data section; student role now navigates to the dedicated portal. Added `useRouter` import.
- **DrawerLeft.tsx**: Added `ALUNO_SECTIONS` navigation for student role — dedicated sidebar with Meu Portal, Académico (Notas, Horário, Histórico, Calendário), Financeiro sections. Student role is now properly isolated from admin navigation.
- **_layout.tsx**: Registered `portal-estudante` as a new Stack.Screen.
- **horario.tsx**: Professor role now shows only their assigned turmas (read-only). Empty cells are non-interactive for professors. Professor's own class cells are highlighted in gold and show a `+` icon to quick-register a sumário. New sumário registration modal fires directly from the schedule.
- **professor-mensagens.tsx**: `colegasProfessores` now only shows professors who share at least one turma with the logged-in professor. Auto-notification is sent when a turma or private message is dispatched.
- **perfil.tsx**: Added `expo-image-picker` photo upload. Tapping the avatar circle opens the gallery (with permission request). Photo is stored as a URI in the `avatar` field on the `AuthUser`. The avatar overlay shows a camera icon button.
- **professores.tsx**: Role guard added — professors see an "Acesso Restrito" screen instead of the full teacher management panel.
- **rh-controle.tsx**: Exam calendar publish notifications were already correctly implemented (verified).

## Recent Changes (This Session — DB Bootstrap + Font Fix)
- **Database tables created**: `npx drizzle-kit push` applied all 24 tables to the PostgreSQL database. All API routes now return 200 instead of 500.
- **Tables active**: `alunos`, `professores`, `turmas`, `notas`, `presencas`, `eventos`, `horarios`, `utilizadores`, `anos_academicos`, `pautas`, `solicitacoes_abertura`, `mensagens`, `materiais`, `sumarios`, `calendario_provas`, `taxas`, `pagamentos`, `mensagens_financeiras`, `rupes`, `notificacoes`, `registros`, `config_geral`, `users`, `user_permissions`, `salas`.
- **Font timeout**: fontfaceobserver 6000ms timeout error resolved — app now loads correctly with no blocking errors. `_layout.tsx` already bypasses `useFonts` on web; DB errors were causing cascade re-renders that triggered font checks.

## Recent Changes (Previous Session — Full DB Migration)
- **Complete database migration**: All 24 tables now exist in PostgreSQL. Zero application data is stored in AsyncStorage.
- **shared/schema.ts**: Full schema with all 24 tables: `alunos`, `professores`, `turmas`, `notas`, `presencas`, `eventos`, `horarios`, `utilizadores`, `anos_academicos`, `pautas`, `solicitacoes_abertura`, `mensagens`, `materiais`, `sumarios`, `calendario_provas`, `taxas`, `pagamentos`, `mensagens_financeiras`, `rupes`, `notificacoes`, `registros`, `config_geral`, `users`, `user_permissions`, `salas`.
- **server/routes.ts**: Full CRUD API routes for ALL 24 tables. New endpoints: `/api/utilizadores`, `/api/anos-academicos`, `/api/pautas`, `/api/solicitacoes-abertura`, `/api/mensagens`, `/api/materiais`, `/api/sumarios`, `/api/calendario-provas`, `/api/taxas`, `/api/pagamentos`, `/api/mensagens-financeiras`, `/api/rupes`, `/api/notificacoes`, `/api/registros`, `/api/config`.
- **lib/api.ts**: New utility helper for API calls used by all contexts.
- **All contexts migrated to database API**:
  - `AnoAcademicoContext` → `/api/anos-academicos`
  - `NotificacoesContext` → `/api/notificacoes`
  - `RegistroContext` → `/api/registros`
  - `UsersContext` → `/api/utilizadores`
  - `ConfigContext` → `/api/config`
  - `ProfessorContext` → `/api/pautas`, `/api/solicitacoes-abertura`, `/api/mensagens`, `/api/materiais`, `/api/sumarios`, `/api/calendario-provas`
  - `FinanceiroContext` → `/api/taxas`, `/api/pagamentos`, `/api/mensagens-financeiras`, `/api/rupes`, `/api/config` (multaConfig), `/api/alunos` (bloqueado field)

## Architecture

- **Frontend**: React Native with Expo SDK 54, Expo Router (file-based navigation), TanStack Query
- **Backend**: Express.js server on port 5000 (proxies to Expo web dev server on port 8000 in development)
- **Database/ORM**: Drizzle ORM + PostgreSQL (all tables active and persisted)
- **Package Manager**: npm
- **Languages**: TypeScript

## Project Structure

- `app/` - Expo Router file-based navigation
  - `app/(main)/` - Core modules (dashboard, students, teachers, grades, attendance, etc.)
  - `app/(tabs)/` - Legacy tab navigation (redirects to main drawer)
- `server/` - Express.js backend
  - `index.ts` - Server entry point with CORS, proxying, and static serving
  - `routes.ts` - API endpoint definitions
  - `storage.ts` - Data persistence layer
- `components/` - Reusable UI components
- `context/` - Global state (Auth, Data, Academic Year, Notifications)
- `shared/` - Shared TypeScript types and Drizzle ORM schemas
- `assets/` - Images, fonts, icons
- `patches/` - patch-package patches (expo-asset fix)

## Development

### Running the App

The workflow `Start application` runs both servers:
```
npm run web:dev & npm run server:dev
```

- `npm run web:dev` - Expo web server on port 8000 (`CI=1` flag prevents TTY issues)
- `npm run server:dev` - Express server on port 5000, proxies web requests to port 8000

### Key Configuration

- `CI=1` env variable is required for Expo to run non-interactively in background
- Express proxy sets `host: localhost:8000` header to pass Metro's host validation
- `app.config.js` - Expo config, handles Replit dev domain for origin
- `metro.config.js` - Metro bundler config

### Postinstall

Uses `patch-package` to apply the expo-asset patch. The command uses `node node_modules/.bin/patch-package` to avoid PATH issues.

## Production Deployment

Build: `npx expo export -p web` (exports to `dist/`) + `npm run server:build` (bundles server to `server_dist/`)
Run: `node server_dist/index.js` - serves static web build and API

## Key Features

- Biometric authentication (expo-local-authentication)
- Angolan 0-20 academic grading scale (PP, MT, PT scores → MAC average)
- QR code attendance tracking
- Dark-themed UI with Angolan-inspired colors (Navy Blue, Red, Gold)
- Student/teacher management
- Financial reporting
