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

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chrome for Testing that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable

WORKDIR /app

COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install
COPY . .

CMD ["pnpm", "start"]