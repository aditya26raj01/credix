# Credix Monorepo

Production-oriented monorepo using Turborepo + pnpm.

## Stack

- Monorepo orchestration: Turborepo
- Package manager: pnpm workspaces
- Mobile app: Expo (TypeScript)
- Backend API: NestJS (TypeScript)

## Workspace Layout

- apps/mobile: Expo app
- apps/backend: NestJS service
- packages/\*: shared packages

## Prerequisites

- Node.js >= 20
- pnpm >= 10

## Getting Started

```bash
pnpm install
```

## Common Commands

```bash
pnpm dev         # Run all dev tasks
pnpm lint        # Run lint tasks
pnpm typecheck   # Run TypeScript checks
pnpm build       # Build all buildable workspaces
pnpm test        # Run tests where configured
```

## CI

GitHub Actions workflow is configured in `.github/workflows/ci.yml` to run install, lint, typecheck, and build on push/PR.
