#!/usr/bin/env bash
# يُعيّن Webhook تلقائياً على Evolution API ويربطه بـ n8n
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()   { echo -e "${GREEN}✅${NC} $*"; }
fail() { echo -e "${RED}❌${NC} $*"; exit 1; }
info() { echo -e "${CYAN}ℹ️ ${NC} $*"; }

[[ -f ".env" ]] && { set -a; source ".env"; set +a; }

EVO_URL="${EVOLUTION_SERVER_URL:-http://localhost:8080}"
EVO_KEY="${EVOLUTION_API_KEY:-evolution_api_key_change_me}"
EVO_INST="${EVOLUTION_INSTANCE_NAME:-wean_bot}"
# داخل Docker يكون n8n:5678، خارجه localhost:5678
WEBHOOK_URL="${N8N_WEBHOOK_URL:-http://localhost:5678}/webhook/whatsapp"

# استبدل localhost بـ n8n داخل Docker
DOCKER_WEBHOOK="http://n8n:5678/webhook/whatsapp"

echo ""
echo -e "${BOLD}━━━ إعداد Webhook تلقائياً ━━━${NC}"
echo ""
info "Instance : ${EVO_INST}"
info "Webhook  : ${DOCKER_WEBHOOK}"
echo ""

RESP=$(curl -sf -X POST "${EVO_URL}/webhook/set/${EVO_INST}" \
  -H "apikey: ${EVO_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${DOCKER_WEBHOOK}\",
    \"webhook_by_events\": false,
    \"webhook_base64\": false,
    \"events\": [\"MESSAGES_UPSERT\"]
  }" 2>/dev/null)

if echo "$RESP" | grep -q '"error"'; then
  fail "فشل تعيين Webhook: ${RESP}"
fi

ok "تم تعيين Webhook بنجاح!"
echo ""
info "تحقق الآن: ${EVO_URL}/manager"
info "أرسل رسالة واتساب للرقم المتصل لاختبار البوت"
echo ""
