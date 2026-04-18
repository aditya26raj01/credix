FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile --filter backend...
COPY apps/backend ./apps/backend
RUN pnpm --filter backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --prod --frozen-lockfile --filter backend...
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
EXPOSE 3000
CMD ["pnpm", "--filter", "backend", "start:prod"]
