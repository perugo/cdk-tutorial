FROM public.ecr.aws/docker/library/node:22-alpine

WORKDIR /app

# 依存関係のインストール
# package.json と package-lock.jsonのキャッシュされる
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# アプリのソース
COPY server.js ./

# 非rootユーザーで実行（セキュリティ）
USER node

EXPOSE 3000

CMD ["node", "server.js"]
