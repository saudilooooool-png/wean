#!/usr/bin/env bash
# ─── Wean System Diagnostics ──────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
ok()   { echo -e "  ${GREEN}✅${NC} $*"; }
fail() { echo -e "  ${RED}❌${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
info() { echo -e "  ${CYAN}ℹ️ ${NC} $*"; }
hdr()  { echo -e "\n${BOLD}━━━ $* ━━━${NC}"; }

# Load .env if exists
[[ -f ".env" ]] && { set -a; source ".env"; set +a; } || warn ".env not found — using defaults"

EVO_URL="${EVOLUTION_SERVER_URL:-http://localhost:8080}"
EVO_KEY="${EVOLUTION_API_KEY:-evolution_api_key_change_me}"
EVO_INST="${EVOLUTION_INSTANCE_NAME:-wean_bot}"
N8N_URL="${N8N_WEBHOOK_URL:-http://localhost:5678}"
API_URL="http://localhost:8000"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Wean — تشخيص النظام الكامل              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"

# ─── 1. Services ──────────────────────────────────────────────────────────────
hdr "1. حالة الخدمات"
check_port() {
  local name=$1 port=$2
  if curl -sf "http://localhost:${port}" -o /dev/null --max-time 3 2>/dev/null ||
     curl -sf "http://localhost:${port}/health" -o /dev/null --max-time 3 2>/dev/null; then
    ok "${name} يعمل (port ${port})"
    return 0
  else
    fail "${name} لا يستجيب (port ${port})"
    return 1
  fi
}

EVO_OK=false; N8N_OK=false; API_OK=false
check_port "Evolution API" 8080 && EVO_OK=true
check_port "n8n"           5678 && N8N_OK=true
check_port "Langchain API" 8000 && API_OK=true
check_port "Redis"         6379 || true
check_port "Admin Panel"   3000 || true

# ─── 2. Evolution API ──────────────────────────────────────────────────────────
hdr "2. Evolution API — Instance"
if $EVO_OK; then
  INST_STATE=$(curl -sf -H "apikey: ${EVO_KEY}" \
    "${EVO_URL}/instance/connectionState/${EVO_INST}" 2>/dev/null || echo "{}")
  STATE=$(echo "$INST_STATE" | grep -o '"state":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  OWNER=$(echo "$INST_STATE" | grep -o '"owner":"[^"]*"' | cut -d'"' -f4 || echo "")
  
  if [[ "$STATE" == "open" ]]; then
    ok "Instance '${EVO_INST}' متصل بواتساب"
    [[ -n "$OWNER" ]] && info "الرقم المتصل: +${OWNER}"
  else
    fail "Instance '${EVO_INST}' غير متصل — الحالة: ${STATE}"
    warn "اذهب إلى ${EVO_URL}/manager وافحص الـ instance"
  fi

  # Check webhook config on instance
  WH=$(curl -sf -H "apikey: ${EVO_KEY}" \
    "${EVO_URL}/webhook/find/${EVO_INST}" 2>/dev/null || echo "{}")
  WH_URL=$(echo "$WH" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  WH_ENABLED=$(echo "$WH" | grep -o '"enabled":[a-z]*' | head -1 | cut -d':' -f2 || echo "false")
  
  if [[ -n "$WH_URL" && "$WH_ENABLED" == "true" ]]; then
    ok "Webhook مُعيَّن على: ${WH_URL}"
  else
    fail "Webhook غير مُعيَّن على هذا الـ instance!"
    echo ""
    warn "الحل — شغّل هذا الأمر لتعيين Webhook تلقائياً:"
    echo ""
    echo -e "  ${CYAN}curl -X POST '${EVO_URL}/webhook/set/${EVO_INST}' \\"
    echo -e "    -H 'apikey: ${EVO_KEY}' \\"
    echo -e "    -H 'Content-Type: application/json' \\"
    echo -e "    -d '{\"url\":\"http://n8n:5678/webhook/whatsapp\",\"webhook_by_events\":false,\"webhook_base64\":false,\"events\":[\"MESSAGES_UPSERT\"]}'"
    echo -e "${NC}"
  fi
else
  fail "Evolution API لا يعمل — تعذّر الفحص"
fi

# ─── 3. n8n ───────────────────────────────────────────────────────────────────
hdr "3. n8n — Workflow"
if $N8N_OK; then
  ok "n8n يعمل على ${N8N_URL}"
  info "تأكد من:"
  info "  1. استيراد ملف: n8n-workflows/whatsapp-location-search.json"
  info "  2. تفعيل الـ workflow (زر Active في الأعلى)"
  info "  3. Webhook URL يكون: http://n8n:5678/webhook/whatsapp"
  info "     (أو http://localhost:5678/webhook/whatsapp إذا كنت خارج Docker)"
else
  fail "n8n لا يعمل"
  info "شغّله بـ: docker compose up -d n8n"
fi

# ─── 4. Langchain API ─────────────────────────────────────────────────────────
hdr "4. Langchain Service (وين أروح API)"
if $API_OK; then
  HEALTH=$(curl -sf "http://localhost:8000/health" --max-time 5 2>/dev/null || echo "{}")
  REDIS=$(echo "$HEALTH" | grep -o '"redis":[a-z]*' | cut -d':' -f2 || echo "?")
  MODEL=$(echo "$HEALTH" | grep -o '"intent_model":[a-z]*' | cut -d':' -f2 || echo "?")
  ok "API يعمل"
  [[ "$REDIS" == "true" ]] && ok "Redis متصل" || fail "Redis غير متصل"
  [[ "$MODEL" == "true" ]] && ok "نموذج الذكاء محمّل" || warn "نموذج الذكاء لم يُحمَّل بعد (قد يحتاج وقتاً)"
else
  fail "Langchain Service لا يعمل"
  info "شغّله بـ: docker compose up -d langchain-service"
fi

# ─── 5. Quick test ────────────────────────────────────────────────────────────
hdr "5. اختبار سريع للبحث"
if $API_OK; then
  RESULT=$(curl -sf -X POST "http://localhost:8000/search" \
    -H "Content-Type: application/json" \
    -d '{"lat":24.7136,"lng":46.6753,"place_type":"restaurant","radius":2000,"max_results":2}' \
    --max-time 15 2>/dev/null || echo "{}")
  TOTAL=$(echo "$RESULT" | grep -o '"total_found":[0-9]*' | cut -d':' -f2 || echo "0")
  if [[ "$TOTAL" -gt 0 ]]; then
    ok "البحث يعمل — وجد ${TOTAL} مطعم في الرياض"
  else
    warn "البحث أعاد 0 نتائج (قد يكون Overpass API بطيئاً أو محجوباً)"
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
hdr "الخلاصة والخطوات التالية"
echo ""
if $EVO_OK && $N8N_OK && $API_OK; then
  echo -e "  ${GREEN}${BOLD}النظام جاهز! 🎉${NC}"
  echo ""
  info "لاختبار البوت: أرسل رسالة واتساب للرقم المتصل"
  info "لوحة الإدارة: http://localhost:3000"
  info "n8n: http://localhost:5678"
  info "Evolution API: http://localhost:8080/manager"
else
  echo -e "  ${RED}${BOLD}توجد مشاكل تحتاج حل قبل التشغيل${NC}"
  echo ""
  info "لتشغيل كل الخدمات: docker compose up -d"
  info "لعرض السجلات:      docker compose logs -f --tail=50"
fi
echo ""
