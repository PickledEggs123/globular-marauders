FROM node:22-alpine as builder

WORKDIR /app

COPY . .

ARG _GITHUB_ACCESS_TOKEN

RUN echo "always-auth=true" > ~/.npmrc
RUN echo "//npm.pkg.github.com/:_authToken=${_GITHUB_ACCESS_TOKEN}" >> ~/.npmrc
RUN npm install --legacy-peer-deps --only=dev --force
RUN npm run build
RUN npm run build-server
RUN rm -f ~/.npmrc

FROM node:22-alpine

WORKDIR /app

RUN rm -rf ./*

COPY --from=builder /app/build ./build
COPY --from=builder /app/server-build ./server-build
COPY --from=builder /app/node_modules ./node_modules

ENTRYPOINT ["node", "./server-build/index.js"]
