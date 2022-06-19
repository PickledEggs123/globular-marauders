FROM node:16-alpine as builder

WORKDIR /app

COPY . .

RUN echo "always-auth=true" > ~/.npmrc
RUN echo "//npm.pkg.github.com/:_authToken=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" >> ~/.npmrc
RUN npm install
RUN npm run build
RUN rm -f ~/.npmrc

FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY --from=builder /app/build .
COPY --from=builder /app/react_app_nginx.conf /etc/nginx/conf.d/react_app_nginx.conf
RUN rm -rf /etc/nginx/conf.d/default.conf

ENTRYPOINT ["nginx", "-g", "daemon off;"]