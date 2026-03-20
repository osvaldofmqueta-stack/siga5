# SIGA v3 - Sistema Integrado de Gestão Académica

An Academic Management System (SGAA Angola) for educational institutions in Angola. Built as a cross-platform application (Web, Android, iOS) using a TypeScript stack.

## Recent Changes (Session)
- **portal-estudante.tsx** *(new)*: Complete student portal with 8 tabs — Painel (academic overview + discipline status), Notas (AVAL1-4, PP, PT, MAC, NF per trimester + pauta status), Mensagens (teacher messages, private/class filter, mark-as-read), Materiais (teacher files + lesson summaries), Horário (weekly schedule), Financeiro (propina payment, document payment via RUPE/Multicaixa Express, re-enrollment confirmation, payment history), Histórico (academic history by trimester), Documentos (request declarations, track status). Profile photo upload (web + native compatible).
- **perfil.tsx**: Added "Aceder ao Portal do Estudante" button in the student academic data section; student role now navigates to the dedicated portal. Added `useRouter` import.
- **DrawerLeft.tsx**: Added `ALUNO_SECTIONS` navigation for student role — dedicated sidebar with Meu Portal, Académico (Notas, Horário, Histórico, Calendário), Financeiro sections. Student role is now properly isolated from admin navigation.
- **_layout.tsx**: Registered `portal-estudante` as a new Stack.Screen.
- **horario.tsx**: Professor role now shows only their assigned turmas (read-only). Empty cells are non-interactive for professors. Professor's own class cells are highlighted in gold and show a `+` icon to quick-register a sumário. New sumário registration modal fires directly from the schedule.
- **professor-mensagens.tsx**: `colegasProfessores` now only shows professors who share at least one turma with the logged-in professor. Auto-notification is sent when a turma or private message is dispatched.
- **perfil.tsx**: Added `expo-image-picker` photo upload. Tapping the avatar circle opens the gallery (with permission request). Photo is stored as a URI in the `avatar` field on the `AuthUser`. The avatar overlay shows a camera icon button.
- **professores.tsx**: Role guard added — professors see an "Acesso Restrito" screen instead of the full teacher management panel.
- **rh-controle.tsx**: Exam calendar publish notifications were already correctly implemented (verified).

## Architecture

- **Frontend**: React Native with Expo SDK 54, Expo Router (file-based navigation), TanStack Query
- **Backend**: Express.js server on port 5000 (proxies to Expo web dev server on port 8000 in development)
- **Database/ORM**: Drizzle ORM configured (currently using in-memory storage via MemStorage)
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
