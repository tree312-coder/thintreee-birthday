FROM node:22.16.0-bookworm-slim
WORKDIR /app
# The compiled client.js is checked in; the backend uses Node's native type stripping.
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production DB_PATH=/app/data/thintree.sqlite
EXPOSE 3000
CMD ["npm","start"]
