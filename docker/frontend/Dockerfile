FROM nginx:1.27-alpine

# Eliminar configuracion por defecto de Nginx
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copiar archivos estaticos del frontend
COPY public/ /usr/share/nginx/html/

# Copiar configuracion optimizada con proxy inverso
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
