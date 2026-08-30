FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY scripts/astcomp.js ./astcomp.js
RUN bun build --compile astcomp.js --outfile /app/astcomp

FROM alpine:3.20
RUN apk add --no-cache libstdc++ libgcc \
 && adduser -D -u 10001 -h /home/astcomp astcomp \
 && mkdir -p /in \
 && chown astcomp:astcomp /in

COPY --from=build /app/astcomp /usr/local/bin/astcomp

USER astcomp
WORKDIR /in

ENTRYPOINT ["/usr/local/bin/astcomp"]
CMD ["--help"]
