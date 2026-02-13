FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy static files to nginx html directory
COPY . /usr/share/nginx/html

# Create nginx configuration to serve as SPA with correct MIME types
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Manifest must be served with correct MIME type for PWA install
    location = /manifest.json {
        types { application/manifest+json json; }
        default_type application/manifest+json;
        add_header Cache-Control "no-cache";
    }

    # Service worker must not be cached aggressively
    location = /sw.js {
        add_header Cache-Control "no-cache";
        types { application/javascript js; }
    }

    # Static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|json)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
