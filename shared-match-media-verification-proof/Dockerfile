FROM node:22.17.0-bookworm-slim@sha256:b04ce4ae4e95b522112c2e5c52f781471a5cbc3b594527bcddedee9bc48c03a0

WORKDIR /app
COPY container/core.mjs container/server.mjs ./

USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
