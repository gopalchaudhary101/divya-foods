FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 8000

# --proxy-headers trusts X-Forwarded-For from Railway's edge so slowapi's
# get_remote_address() (used for all rate limits — login, register, etc.)
# sees each client's real IP instead of Railway's single internal proxy IP.
# Without it every rate limit is effectively shared across ALL users behind
# the proxy — a handful of failed logins from unrelated users could 429
# everyone. forwarded_allow_ips="*" is safe here because Railway's network
# guarantees the app only ever receives traffic through its own edge proxy.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header", "--proxy-headers", "--forwarded-allow-ips=*"]
