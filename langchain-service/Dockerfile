FROM python:3.11-slim

# System dependencies لـ Playwright + Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget ca-certificates \
    fonts-liberation fonts-noto-color-emoji \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 \
    libxrandr2 libasound2 libpango-1.0-0 libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# تثبيت Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# تثبيت Chromium
RUN playwright install chromium

# تحميل نموذج الذكاء مسبقاً داخل الصورة (لتجنب التحميل عند كل تشغيل)
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2'); \
print('Model downloaded ✓')"

COPY . .

RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
