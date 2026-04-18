# Credix Monorepo

Production-grade monorepo with Turborepo + pnpm, containing:

- `apps/mobile` (Expo, TypeScript)
- `apps/backend` (NestJS, TypeScript)

## Tech Baseline

- Monorepo: Turborepo
- Package manager: pnpm workspaces
- Type safety: strict TypeScript
- Code quality: ESLint + Prettier
- Git quality gates: Husky + lint-staged
- Commit conventions: commitlint (Conventional Commits)
- CI: GitHub Actions (install -> lint -> build -> test)

## Repository Structure

```text
.
|- apps/
|  |- backend/        # NestJS API
|  |- mobile/         # Expo app
|- packages/          # Shared workspace packages
|- .github/workflows/ # CI workflows
|- .env.example       # Environment template
|- tsconfig.base.json # Shared TypeScript baseline
|- turbo.json         # Task graph for monorepo
```

## Prerequisites

- Node.js `>=20`
- pnpm `>=10`

## Quick Start (Under 10 Minutes)

1. Install dependencies:

```bash
pnpm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Run the monorepo in development mode:

```bash
pnpm dev
```

## Standard Developer Commands

```bash
pnpm dev           # Run all workspace dev tasks
pnpm build         # Build all buildable workspaces
pnpm lint          # Run lint across workspaces
pnpm test          # Run tests across workspaces
pnpm format        # Format repository with Prettier
pnpm format:check  # Validate formatting without changing files
pnpm typecheck     # Run TypeScript checks
```

## Environment Variables

Defined in `.env.example`:

- `NODE_ENV`: Runtime mode for backend (for example, `development`, `production`)
- `PORT`: Backend API port
- `EXPO_PUBLIC_API_URL`: Public API base URL used by Expo app

## Code Quality Rules

- TypeScript strictness is required (`strict: true`)
- Linting is enforced via ESLint scripts per workspace
- Formatting is enforced via Prettier
- Pre-commit hook runs `lint-staged`
- Commit message hook validates Conventional Commits

## CI

Workflow: `.github/workflows/ci.yml`

PR/push validation pipeline:

1. install
2. lint
3. build
4. test

## Containerization

The backend is containerized with a production-ready multi-stage Docker build.

### Build Backend Image

```bash
docker build -f apps/backend/Dockerfile -t credix-backend:local .
```

### Run Backend Container

```bash
docker run --env-file .env -p 3000:3000 credix-backend:local
```

### Run with Docker Compose

```bash
docker compose up --build
```

### Stop Compose Stack

```bash
docker compose down
```
