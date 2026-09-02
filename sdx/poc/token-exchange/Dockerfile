FROM quay.io/keycloak/keycloak:26.7

ENV KC_DB=dev-file
ENV KC_HEALTH_ENABLED=true
ENV KC_HTTP_ENABLED=true
ENV KC_HOSTNAME_STRICT=false

EXPOSE 8080

ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev"]
