# ScriptGrade — Agent Guidelines

## Project

ScriptGrade is an AI-powered NLP automated grading and diagnostic platform built
as a TanStack Start (React 19) SSR application. See `docs/` for the system
architecture README and the frontend PRD.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint
- `npm run format` — format with Prettier

## Architecture

- File-based routing lives in `src/routes/`; the root document and head
  metadata are defined in `src/routes/__root.tsx`.
- The SSR entry wrapper is `src/server.ts` (wired via the `tanstackStart`
  plugin in `vite.config.ts`).
- Shared UI primitives live in `src/components/ui/` (shadcn-style, Radix-based).
- App logic, API client, types, and demo data live in `src/lib/`.
- Client state uses Zustand stores in `src/stores/`.
- The `@/*` path alias maps to `./src/*`.

## Conventions

- TypeScript strict mode is enabled; keep it that way.
- Follow the existing Prettier/ESLint configuration before committing.
- Keep the branch in a working state — builds and lint should pass at all times.
