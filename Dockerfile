# Node.js 18 Debian Slim 이미지 사용 (Alpine 대신 Debian 사용으로 better-sqlite3 호환성 문제 해결)
FROM node:18-slim AS base

# 의존성 설치를 위한 단계
FROM base AS deps
# better-sqlite3 컴파일을 위한 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package.json package-lock.json* ./
RUN npm ci

# 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시 필요한 디렉토리 생성
RUN mkdir -p /app/data /app/uploads

# Next.js 빌드
RUN npm run build

# 프로덕션 이미지 (런타임에는 SQLite만 필요)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# SQLite 런타임 라이브러리와 헬스체크용 wget 설치
RUN apt-get update && apt-get install -y \
    sqlite3 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 시스템 사용자 생성
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# 필요한 파일들 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 데이터 디렉토리 생성
RUN mkdir -p /app/data /app/uploads
RUN chown -R nextjs:nodejs /app/data /app/uploads

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"] 