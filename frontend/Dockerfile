FROM nginx:alpine

COPY frontend/ /usr/share/nginx/html/
COPY frontend/docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
