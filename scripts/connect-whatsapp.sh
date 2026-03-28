#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Wean – ربط رقم واتساب بالمنصة
#
# الاستخدام:
#   bash scripts/connect-whatsapp.sh
#
# ما يفعله:
#   1. ينشئ Instance في Evolution API
#   2. يعرض QR code في الطرفية أو رابط للمتصفح
#   3. يستمر في الانتظار حتى تسحب واتساب الرمز
#   4. يطبع رقم الواتساب المتصل
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[✓]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[!]${NC}    $*"; }
error()   { echo -e "${RED}[✗]${NC}    $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}━━━  $*  ━━━${NC}\n"; }

# ─── تحميل الإعدادات ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${PROJECT_ROOT}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  set -a; source "${ENV_FILE}"; set +a
else
  warn ".env not found — using defaults"
fi

EVO_URL="${EVOLUTION_SERVER_URL:-http://localhost:8080}"
EVO_KEY="${EVOLUTION_API_KEY:-evolution_api_key_change_me}"
EVO_INSTANCE="${EVOLUTION_INSTANCE_NAME:-wean_bot}"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       Wean – ربط رقم واتساب بالمنصة            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
info "Evolution API : ${EVO_URL}"
info "Instance name : ${EVO_INSTANCE}"
echo ""

# ─── التأكد من تشغيل Evolution API ──────────────────────────────────────────
header "1. التحقق من Evolution API"
if ! curl -sf "${EVO_URL}/" -o /dev/null 2>/dev/null; then
  error "Evolution API غير متاح على ${EVO_URL}"
  error "شغّل المنصة أولاً:  bash scripts/setup.sh"
  exit 1
fi
success "Evolution API يعمل"

# ─── إنشاء الـ Instance (أو التحقق من وجوده) ─────────────────────────────────
header "2. إنشاء الـ Instance"

HTTP_CODE=$(curl -s -o /tmp/evo_create.json -w "%{http_code}" \
  -X POST "${EVO_URL}/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: ${EVO_KEY}" \
  -d "{
    \"instanceName\": \"${EVO_INSTANCE}\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\",
    \"webhook\": \"${N8N_WEBHOOK_URL:-http://n8n:5678}/webhook/whatsapp\",
    \"webhookByEvents\": false,
    \"events\": [\"MESSAGES_UPSERT\", \"CONNECTION_UPDATE\"]
  }" 2>/dev/null || echo "000")

case "${HTTP_CODE}" in
  200|201) success "Instance '${EVO_INSTANCE}' تم إنشاؤه" ;;
  409)     info    "Instance '${EVO_INSTANCE}' موجود مسبقاً — نكمل" ;;
  403)     error "مفتاح API خاطئ (HTTP 403). تحقق من EVOLUTION_API_KEY في .env"; exit 1 ;;
  *)       warn "HTTP ${HTTP_CODE} — نحاول المتابعة" ;;
esac

# ─── جلب وعرض QR code ────────────────────────────────────────────────────────
header "3. QR Code لربط الواتساب"

_display_qr() {
  local qr_data="$1"

  # خيار 1: qrencode متاح → عرض ASCII في الطرفية
  if command -v qrencode &>/dev/null; then
    echo ""
    echo -e "${BOLD}امسح هذا الرمز بواتساب:${NC}"
    echo "${qr_data}" | qrencode -t UTF8 -m 1
    return 0
  fi

  # خيار 2: Python qrcode
  if command -v python3 &>/dev/null && python3 -c "import qrcode" 2>/dev/null; then
    echo ""
    echo -e "${BOLD}امسح هذا الرمز بواتساب:${NC}"
    python3 -c "
import qrcode, sys
qr = qrcode.QRCode(border=1)
qr.add_data(sys.argv[1])
qr.print_ascii(invert=True)
" "${qr_data}"
    return 0
  fi

  # خيار 3: عرض الرابط فقط
  warn "لا يوجد qrencode أو python-qrcode — افتح الرابط التالي في المتصفح:"
  echo ""
  echo -e "  ${BOLD}${CYAN}${EVO_URL}/instance/qrcode/${EVO_INSTANCE}?image=true${NC}"
  echo ""
}

# انتظار QR code (قد يتأخر بضع ثوانٍ عند الإنشاء الجديد)
QR_DATA=""
for attempt in 1 2 3 4 5; do
  QR_RESPONSE=$(curl -sf \
    "${EVO_URL}/instance/connect/${EVO_INSTANCE}" \
    -H "apikey: ${EVO_KEY}" 2>/dev/null || echo "{}")

  # الـ response يحتوي على code (نص QR) أو base64
  QR_DATA=$(echo "${QR_RESPONSE}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('code') or d.get('qrcode') or d.get('base64') or '')
" 2>/dev/null || echo "")

  if [[ -n "${QR_DATA}" ]]; then
    break
  fi

  info "في انتظار QR... (محاولة ${attempt}/5)"
  sleep 3
done

if [[ -z "${QR_DATA}" ]]; then
  warn "لم يُولَّد QR code تلقائياً."
  warn "افتح هذا الرابط في المتصفح لمسح الرمز:"
  echo -e "  ${BOLD}${CYAN}${EVO_URL}/instance/qrcode/${EVO_INSTANCE}?image=true${NC}"
else
  _display_qr "${QR_DATA}"
fi

# ─── إرشادات المسح ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}كيفية المسح:${NC}"
echo -e "  واتساب ← ⋮ (ثلاث نقاط) ← الأجهزة المرتبطة ← ربط جهاز"
echo -e "  ثم امسح الرمز أعلاه"
echo ""

# ─── انتظار الاتصال ──────────────────────────────────────────────────────────
header "4. انتظار الاتصال..."
info "اضغط Ctrl+C لإلغاء الانتظار"
echo ""

CONNECTED=false
for i in $(seq 1 40); do
  STATE_RESPONSE=$(curl -sf \
    "${EVO_URL}/instance/connectionState/${EVO_INSTANCE}" \
    -H "apikey: ${EVO_KEY}" 2>/dev/null || echo "{}")

  STATE=$(echo "${STATE_RESPONSE}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
inst = d.get('instance', d)
print(inst.get('state') or inst.get('connectionStatus') or 'unknown')
" 2>/dev/null || echo "unknown")

  if [[ "${STATE}" == "open" || "${STATE}" == "connected" ]]; then
    CONNECTED=true
    break
  fi

  printf "  جاري الانتظار [%-40s] %s\r" "$(printf '#%.0s' $(seq 1 $((i % 40))))" "${STATE}"
  sleep 3
done
echo ""

# ─── النتيجة ─────────────────────────────────────────────────────────────────
header "النتيجة"

if [[ "${CONNECTED}" == "true" ]]; then
  # جلب رقم الواتساب المتصل
  INFO_RESPONSE=$(curl -sf \
    "${EVO_URL}/instance/fetchInstances" \
    -H "apikey: ${EVO_KEY}" 2>/dev/null || echo "[]")

  WHATSAPP_NUMBER=$(echo "${INFO_RESPONSE}" | python3 -c "
import sys, json
instances = json.load(sys.stdin)
if not isinstance(instances, list):
    instances = [instances]
for inst in instances:
    name = inst.get('instance', {}).get('instanceName') or inst.get('instanceName', '')
    if '${EVO_INSTANCE}' in name:
        owner = inst.get('instance', {}).get('owner') or inst.get('owner', '')
        print(owner.replace('@s.whatsapp.net', '') if owner else 'غير معروف')
        break
" 2>/dev/null || echo "")

  echo -e "${GREEN}${BOLD}"
  echo -e "  ✅ تم ربط الواتساب بنجاح!"
  echo ""
  if [[ -n "${WHATSAPP_NUMBER}" ]]; then
    echo -e "  📱 رقم الواتساب : +${WHATSAPP_NUMBER}"
    echo ""
    echo -e "  شارك هذا الرقم مع المستخدمين حتى يتواصلوا معك:"
    echo -e "  wa.me/${WHATSAPP_NUMBER}"
  fi
  echo -e "${NC}"
else
  warn "لم يتم الاتصال خلال المهلة المحددة."
  warn "إذا مسحت الرمز، انتظر قليلاً وأعد التحقق:"
  echo ""
  echo -e "  ${CYAN}curl -s ${EVO_URL}/instance/connectionState/${EVO_INSTANCE} -H 'apikey: ${EVO_KEY}'${NC}"
  echo ""
fi

echo -e "${CYAN}رابط الاتصال دائماً:${NC}"
echo -e "  ${EVO_URL}/instance/connect/${EVO_INSTANCE}"
echo ""
