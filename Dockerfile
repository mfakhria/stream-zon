FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server ./server
COPY lib ./lib
COPY tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["npx", "tsx", "server/index.ts"]
