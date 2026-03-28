#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Wean – Full-stack setup script
# Starts all services, waits for them to be healthy, and then runs
# the Appwrite collection setup.
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
#
# Options:
#   --reset   Tear down all containers and volumes before starting fresh
#   --no-aw   Skip the Appwrite collection setup step
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}$*${NC}\n"; }

# ─── Parse flags ──────────────────────────────────────────────────────────────
RESET=false
SKIP_APPWRITE=false

for arg in "$@"; do
  case $arg in
    --reset)   RESET=true ;;
    --no-aw)   SKIP_APPWRITE=true ;;
    --help|-h)
      echo "Usage: $0 [--reset] [--no-aw]"
      echo "  --reset   Destroy all containers and volumes first"
      echo "  --no-aw   Skip Appwrite collection setup"
      exit 0
      ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# ─── Resolve project root ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Wean – WhatsApp Location Search            ║${NC}"
echo -e "${BOLD}║       Full-Stack Setup                           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Pre-flight checks ────────────────────────────────────────────────────────
header "1. Pre-flight checks"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command not found: $1"
    exit 1
  fi
  success "$1 found"
}

check_cmd docker
check_cmd docker-compose || check_cmd "docker compose"
# Prefer 'docker compose' (v2) over standalone docker-compose
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
else
  DC="docker-compose"
fi
success "Docker Compose: ${DC}"

# Check .env exists
if [[ ! -f "${PROJECT_ROOT}/.env" ]]; then
  if [[ -f "${PROJECT_ROOT}/.env.example" ]]; then
    warn ".env not found. Copying .env.example → .env"
    cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
    warn "Please edit .env and fill in your API keys, then re-run this script."
    warn "  ${PROJECT_ROOT}/.env"
    echo ""
    # Don't exit; let the user continue with defaults for local dev
  else
    error ".env file not found and no .env.example to copy from."
    exit 1
  fi
else
  success ".env found"
fi

# Load .env for use in this script
set -a
# shellcheck source=/dev/null
source "${PROJECT_ROOT}/.env"
set +a

# ─── Optional reset ───────────────────────────────────────────────────────────
if [[ "${RESET}" == "true" ]]; then
  header "0. Reset – tearing down existing containers and volumes"
  warn "This will DELETE all data in Docker volumes!"
  read -r -p "Are you sure? [y/N] " confirm
  if [[ "${confirm}" =~ ^[Yy]$ ]]; then
    ${DC} down -v --remove-orphans || true
    success "Containers and volumes removed."
  else
    info "Reset cancelled."
    RESET=false
  fi
fi

# ─── Build LangChain image ────────────────────────────────────────────────────
header "2. Building LangChain service image"
${DC} build langchain-service
success "langchain-service image built."

# ─── Start infrastructure first ───────────────────────────────────────────────
header "3. Starting infrastructure (postgres + redis)"
${DC} up -d postgres redis
info "Waiting for postgres to be healthy…"
_wait_healthy() {
  local service="$1"
  local max_wait="${2:-60}"
  local elapsed=0
  while true; do
    local status
    status=$(${DC} ps --format json "${service}" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health',''))" 2>/dev/null \
      || ${DC} inspect --format '{{.State.Health.Status}}' "wean_${service}" 2>/dev/null \
      || echo "unknown")
    if [[ "${status}" == "healthy" ]]; then
      success "${service} is healthy."
      return 0
    fi
    if [[ ${elapsed} -ge ${max_wait} ]]; then
      error "${service} did not become healthy within ${max_wait}s."
      return 1
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    echo -n "."
  done
}

# Simple poll via docker inspect
wait_for_healthy() {
  local container="$1"
  local max_wait="${2:-90}"
  local elapsed=0
  info "Waiting for container ${container} to be healthy (max ${max_wait}s)…"
  while true; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "missing")
    if [[ "${status}" == "healthy" ]]; then
      success "${container} is healthy."
      return 0
    fi
    if [[ "${status}" == "missing" ]]; then
      warn "${container} not found yet, retrying…"
    fi
    if [[ ${elapsed} -ge ${max_wait} ]]; then
      error "${container} did not become healthy within ${max_wait}s. Current status: ${status}"
      docker logs "${container}" --tail 30 || true
      return 1
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    printf "."
  done
}

echo ""
wait_for_healthy "wean_postgres" 90
wait_for_healthy "wean_redis"    60

# ─── Start all remaining services ─────────────────────────────────────────────
header "4. Starting all services"
${DC} up -d
success "All containers started."

# ─── Wait for key services ─────────────────────────────────────────────────────
header "5. Waiting for services to be ready"

wait_for_healthy "wean_langchain" 120

# Evolution API – poll HTTP
info "Waiting for Evolution API (wean_evolution) to respond…"
EVOLUTION_URL="${EVOLUTION_SERVER_URL:-http://localhost:8080}"
elapsed=0
until curl -sf "${EVOLUTION_URL}/" -o /dev/null 2>/dev/null; do
  if [[ ${elapsed} -ge 120 ]]; then
    warn "Evolution API did not respond within 120s – continuing anyway."
    break
  fi
  sleep 3
  elapsed=$((elapsed + 3))
  printf "."
done
echo ""
success "Evolution API responded."

# n8n – poll HTTP
info "Waiting for n8n (wean_n8n) to respond…"
N8N_URL="http://localhost:5678"
elapsed=0
until curl -sf "${N8N_URL}/healthz" -o /dev/null 2>/dev/null; do
  if [[ ${elapsed} -ge 120 ]]; then
    warn "n8n did not respond within 120s – continuing anyway."
    break
  fi
  sleep 3
  elapsed=$((elapsed + 3))
  printf "."
done
echo ""
success "n8n responded."

# Appwrite – poll HTTP
info "Waiting for Appwrite to respond…"
AW_URL="http://localhost:80/v1/health"
elapsed=0
until curl -sf "${AW_URL}" -o /dev/null 2>/dev/null; do
  if [[ ${elapsed} -ge 180 ]]; then
    warn "Appwrite did not respond within 180s – continuing anyway."
    break
  fi
  sleep 5
  elapsed=$((elapsed + 5))
  printf "."
done
echo ""
success "Appwrite responded."

# ─── Appwrite collection setup ─────────────────────────────────────────────────
if [[ "${SKIP_APPWRITE}" == "false" ]]; then
  header "6. Setting up Appwrite collections"

  if ! command -v node &>/dev/null; then
    warn "Node.js not found. Skipping Appwrite collection setup."
    warn "Run manually:  node appwrite/setup.js"
  else
    # Install node-appwrite if not already present
    if [[ ! -d "${PROJECT_ROOT}/node_modules/node-appwrite" ]]; then
      info "Installing node-appwrite SDK…"
      cd "${PROJECT_ROOT}"
      # Create a minimal package.json if missing
      if [[ ! -f "package.json" ]]; then
        cat > package.json <<'EOF'
{
  "name": "wean-setup",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "node-appwrite": "^12.0.0",
    "dotenv": "^16.0.0"
  }
}
EOF
      fi
      npm install --silent
    fi

    info "Running appwrite/setup.js…"
    node "${PROJECT_ROOT}/appwrite/setup.js" && success "Appwrite collections created." \
      || warn "Appwrite setup returned an error – check output above."
  fi
else
  info "Skipping Appwrite collection setup (--no-aw)."
fi

# ─── Import n8n workflow ───────────────────────────────────────────────────────
header "7. Importing n8n workflow"

N8N_WORKFLOW_FILE="${PROJECT_ROOT}/n8n-workflows/whatsapp-location-search.json"
N8N_AUTH_USER="${N8N_BASIC_AUTH_USER:-admin}"
N8N_AUTH_PASS="${N8N_BASIC_AUTH_PASSWORD:-admin_secret}"
N8N_API="http://localhost:5678/api/v1"

if [[ -f "${N8N_WORKFLOW_FILE}" ]]; then
  HTTP_CODE=$(curl -s -o /tmp/n8n_import_response.json -w "%{http_code}" \
    -X POST "${N8N_API}/workflows" \
    -u "${N8N_AUTH_USER}:${N8N_AUTH_PASS}" \
    -H "Content-Type: application/json" \
    -d @"${N8N_WORKFLOW_FILE}" 2>/dev/null || echo "000")

  if [[ "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "201" ]]; then
    success "n8n workflow imported successfully."
  else
    warn "n8n workflow import returned HTTP ${HTTP_CODE}."
    warn "You can import it manually via the n8n UI:"
    warn "  1. Open http://localhost:5678"
    warn "  2. Go to Workflows → Import from file"
    warn "  3. Select: n8n-workflows/whatsapp-location-search.json"
  fi
else
  warn "Workflow file not found: ${N8N_WORKFLOW_FILE}"
fi

# ─── Create Evolution API WhatsApp instance ────────────────────────────────────
header "8. Creating Evolution API WhatsApp instance"

EVO_INSTANCE="${EVOLUTION_INSTANCE_NAME:-wean_bot}"
EVO_KEY="${EVOLUTION_API_KEY:-evolution_api_key_change_me}"
EVO_URL="${EVOLUTION_SERVER_URL:-http://localhost:8080}"

HTTP_CODE=$(curl -s -o /tmp/evo_instance_response.json -w "%{http_code}" \
  -X POST "${EVO_URL}/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: ${EVO_KEY}" \
  -d "{
    \"instanceName\": \"${EVO_INSTANCE}\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\",
    \"webhook\": \"${N8N_WEBHOOK_URL:-http://n8n:5678}/webhook/whatsapp\",
    \"webhookByEvents\": false,
    \"webhookBase64\": false,
    \"events\": [\"MESSAGES_UPSERT\", \"CONNECTION_UPDATE\"]
  }" 2>/dev/null || echo "000")

if [[ "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "201" ]]; then
  success "Evolution API instance '${EVO_INSTANCE}' created."
  info "Scan the QR code at: ${EVO_URL}/instance/connect/${EVO_INSTANCE}"
  info "Or view at the Evolution Manager UI (if enabled)."
elif [[ "${HTTP_CODE}" == "403" || "${HTTP_CODE}" == "409" ]]; then
  warn "Instance '${EVO_INSTANCE}' may already exist (HTTP ${HTTP_CODE})."
  info "To reconnect: ${EVO_URL}/instance/connect/${EVO_INSTANCE}"
else
  warn "Could not create Evolution instance (HTTP ${HTTP_CODE}). Check logs:"
  warn "  docker logs wean_evolution --tail 30"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
header "Setup Complete!"

echo -e "${GREEN}${BOLD}All services are running.${NC}"
echo ""
echo -e "  ${BOLD}Service URLs:${NC}"
echo -e "  • LangChain API   → http://localhost:8000/docs"
echo -e "  • n8n UI          → http://localhost:5678"
echo -e "  • Evolution API   → http://localhost:8080"
echo -e "  • Appwrite UI     → http://localhost:80/console"
echo ""
echo -e "  ${BOLD}الخطوات التالية:${NC}"
echo -e "  1. اربط رقم واتساب بالمنصة (الأهم):"
echo -e "     ${BOLD}bash scripts/connect-whatsapp.sh${NC}"
echo -e "     سيظهر QR code — امسحه بواتساب من الأجهزة المرتبطة"
echo -e "     بعد المسح سيظهر رقم الواتساب — شاركه مع المستخدمين"
echo ""
echo -e "  2. (اختياري) قاعدة البيانات Appwrite:"
echo -e "     افتح http://localhost/console"
echo -e "     أنشئ مشروعاً بالـ ID: ${APPWRITE_PROJECT_ID:-wean_project}"
echo -e "     حدّث APPWRITE_PROJECT_ID و APPWRITE_API_KEY في .env"
echo -e "     ثم: ${DC} restart langchain-service"
echo ""
echo -e "  3. بعد ربط الرقم — أرسل موقعك على واتساب للبدء!"
echo ""
echo -e "  ${BOLD}أوامر مفيدة:${NC}"
echo -e "  • كل السجلات:          ${DC} logs -f"
echo -e "  • سجلات الذكاء:        ${DC} logs -f langchain-service"
echo -e "  • سجلات n8n:           ${DC} logs -f n8n"
echo -e "  • إيقاف كل شيء:        ${DC} down"
echo -e "  • إعادة تشغيل كاملة:   $0 --reset"
echo ""
