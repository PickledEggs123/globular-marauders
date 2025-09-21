FROM node:22-alpine AS builder

WORKDIR /app

COPY . .

ARG _GITHUB_ACCESS_TOKEN

RUN echo "always-auth=true" > ~/.npmrc
RUN echo "//npm.pkg.github.com/:_authToken=${_GITHUB_ACCESS_TOKEN}" >> ~/.npmrc
RUN npm install
RUN npm run build
RUN rm -f ~/.npmrc

FROM node:22-alpine

WORKDIR /app

RUN rm -rf ./*

COPY --from=builder /app/build/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/build/static ./build/static

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]
