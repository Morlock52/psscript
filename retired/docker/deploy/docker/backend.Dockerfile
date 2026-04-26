FROM node:20-alpine AS build

WORKDIR /workspace

COPY src/backend/package*.json ./src/backend/
WORKDIR /workspace/src/backend
RUN npm install

COPY src/backend ./
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /workspace/src/backend/package*.json ./
COPY --from=build /workspace/src/backend/node_modules ./node_modules
COPY --from=build /workspace/src/backend/dist ./dist
COPY --from=build /workspace/src/backend/src ./src/backend/src
COPY docs/exports /docs/exports

EXPOSE 4000

CMD ["node", "dist/index.js"]
