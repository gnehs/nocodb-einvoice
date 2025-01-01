### Base
FROM node:22-slim as base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TZ=Asia/Taipei
RUN corepack enable
WORKDIR /app

FROM base AS prod-deps
COPY package.json .
COPY pnpm-lock.yaml .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base
COPY . .
COPY --from=prod-deps /app/node_modules /app/node_modules

ENV NOCODB_URL=""
ENV NOCODB_API_KEY=""
ENV NOCODB_BASE_ID=""
ENV EINVOICE_USERNAME=""
ENV EINVOICE_PASSWORD=""
ENV CRON_SCHEDULE="0 3 * * *"
ENV REQUEST_DELAY="1000"

CMD ["pnpm", "start"]