### Base
FROM node:22
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV TZ=Asia/Taipei
ENV NOCODB_URL=""
ENV NOCODB_API_KEY=""
ENV NOCODB_BASE_ID=""
ENV EINVOICE_USERNAME=""
ENV EINVOICE_PASSWORD=""
ENV CRON_SCHEDULE="0 3 * * *"

# Install pnpm
RUN corepack enable

WORKDIR /app

COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install
COPY . .

CMD ["pnpm", "start"]