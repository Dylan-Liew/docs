FROM node:24-bookworm-slim AS node
FROM brufdev/many-notes:0.18 AS build
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
WORKDIR /var/www/html
RUN rm -rf /var/www/html/resources/js
COPY app app
COPY bootstrap/app.php bootstrap/app.php
COPY config config
COPY routes routes
COPY resources resources
COPY public/assets public/assets
COPY package.json package-lock.json vite.config.js tsconfig.json ./
RUN npm ci && npm run build && npm run typecheck

FROM brufdev/many-notes:0.18
LABEL org.opencontainers.image.source="https://github.com/Dylan-Liew/docs"
RUN rm -rf /var/www/html/app /var/www/html/config /var/www/html/database /var/www/html/routes /var/www/html/public/assets /var/www/html/public/build
COPY --chown=www-data:www-data app /var/www/html/app
COPY --chown=www-data:www-data bootstrap/app.php /var/www/html/bootstrap/app.php
COPY --chown=www-data:www-data config /var/www/html/config
COPY --chown=www-data:www-data database /var/www/html/database
COPY --chown=www-data:www-data routes /var/www/html/routes
COPY --chown=www-data:www-data resources/views /var/www/html/resources/views
COPY --chown=www-data:www-data public/assets /var/www/html/public/assets
COPY --chown=www-data:www-data public/icon.ico public/icon-dark.ico public/icon.png public/icon-dark.png public/touch.png public/icon-light.svg public/icon-dark.svg public/apple-touch-icon-precomposed.png /var/www/html/public/
# Browser discovery and cached pages still use the previous URLs.
COPY --chown=www-data:www-data public/icon.ico /var/www/html/public/favicon.ico
COPY --chown=www-data:www-data public/icon.png /var/www/html/public/favicon.png
COPY --chown=www-data:www-data public/touch.png /var/www/html/public/apple-touch-icon.png
COPY --chown=www-data:www-data public/icon.ico /var/www/html/public/docs.ico
COPY --chown=www-data:www-data public/icon.png /var/www/html/public/docs.png
COPY --chown=www-data:www-data public/touch.png /var/www/html/public/docs-touch.png
COPY --chown=www-data:www-data public/icon-light.svg /var/www/html/public/docs-light.svg
COPY --chown=www-data:www-data public/icon-dark.svg /var/www/html/public/docs-dark.svg
COPY --chown=www-data:www-data public/icon-light.svg /var/www/html/public/assets/icon-light.svg
COPY --chown=www-data:www-data public/icon-dark.svg /var/www/html/public/assets/icon-dark.svg
COPY --from=build --chown=www-data:www-data /var/www/html/public/build /var/www/html/public/build
COPY deploy/docker/performance.conf /etc/nginx/server-opts.d/performance.conf
COPY deploy/docker/s6-overlay/reverb/run /etc/s6-overlay/s6-rc.d/reverb/run
COPY deploy/docker/s6-overlay/typesense/run /etc/s6-overlay/s6-rc.d/typesense/run
USER root
RUN rm -f /etc/entrypoint.d/75-upgrades.sh
USER www-data
RUN php artisan config:clear && php artisan route:clear && php artisan view:clear
