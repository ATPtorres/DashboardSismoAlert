FROM php:8.4.14-apache-bookworm@sha256:96dc6d7f2977db27e9da1de7f060d16a8c3f662bf34dd00089702d332a4d3ed1
RUN docker-php-ext-install -j2 pdo_mysql && a2enmod ssl headers rewrite && a2dissite 000-default
COPY deploy/apache.conf /etc/apache2/sites-enabled/sismoalert.conf
COPY backend /app/backend
COPY web /app/web
