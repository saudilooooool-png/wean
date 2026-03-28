"""
نموذج تصنيف الأوامر العربية — يعمل محلياً بدون أي API خارجي
يستخدم sentence-transformers + cosine similarity
"""

from __future__ import annotations

import logging
from typing import NamedTuple

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

log = logging.getLogger(__name__)

# ─── عتبة الثقة الدنيا ───────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.42


class IntentResult(NamedTuple):
    place_type: str | None   # e.g. "restaurant"
    confidence: float         # 0.0 → 1.0
    place_name_ar: str        # e.g. "مطعم"


# ─── أمثلة تدريبية لكل فئة ────────────────────────────────────────────────────
# كلما زادت الأمثلة زاد الدقة — النموذج يحسب متوسط التشابه الدلالي
INTENT_EXAMPLES: dict[str, list[str]] = {

    "restaurant": [
        # كلمات مباشرة
        "مطعم", "مطاعم", "أكل", "اكل", "طعام", "وجبة",
        # جمل طبيعية
        "ابغى اكل", "ابي اطلب اكل", "وين اكل", "محتاج مطعم",
        "انا جوعان وين أروح", "دور لي مطعم قريب",
        # وجبات
        "غداء", "عشاء", "فطور", "مطبخ",
        # أصناف طعام (تدل على مطعم)
        "بيتزا", "برجر", "شاورما", "سوشي", "مندي", "كبسة",
        "مشاوي", "مأكولات بحرية", "سمك", "دجاج",
        # صفة للمطعم
        "مطعم فاخر", "مطعم شعبي", "مطعم عائلي",
    ],

    "cafe": [
        "كافيه", "كافيهات", "كافية", "قهوة", "مقهى", "مقاهي", "كوفي",
        "ابغى قهوة", "اريد قهوة", "وين اشرب قهوة",
        "كابتشينو", "لاتيه", "اسبريسو", "مكياتو", "قهوة عربية", "تشاي",
        "مكان للجلوس وشرب قهوة", "ابي اجلس في كافيه",
        "ستاربكس", "كوفي شوب", "مقهى هادي",
    ],

    "pharmacy": [
        "صيدلية", "صيدليات", "دواء", "أدوية",
        "ابغى دواء", "محتاج دواء", "وين صيدلية",
        "حبوب", "مسكن", "مسكن ألم", "مضاد حيوي",
        "دواء للزكام", "فيتامينات", "ضغط الدم",
        "دواء للسكر", "ابغى مسكن وجع",
    ],

    "hospital": [
        "مستشفى", "مستشفيات", "طوارئ", "طبيب", "دكتور",
        "عيادة", "ابغى دكتور", "مريض", "وين مستشفى",
        "إسعاف", "علاج", "فحص طبي", "كلينك",
        "محتاج طبيب", "عندي ألم", "تعبت",
    ],

    "supermarket": [
        "سوبرماركت", "بقالة", "دكان", "محل بقالة",
        "تسوق", "تبضع", "اشتري اكل", "وين بقالة",
        "هايبر", "كارفور", "لولو", "بندة", "العثيم",
        "ابغى اشتري", "محتاج أسوق", "تموينات",
    ],

    "mosque": [
        "مسجد", "مساجد", "جامع", "صلاة", "أصلي",
        "وين أصلي", "ابغى أصلي", "قبلة",
        "الصلاة", "صلاة الجمعة", "مكان للصلاة",
    ],

    "gas_station": [
        "بنزين", "محطة بنزين", "وقود", "محطة وقود",
        "سيارتي فاضية", "تعبئة بنزين", "ديزل",
        "وين أعبي بنزين", "محطة", "فاضت السيارة",
        "ابغى أعبي", "خزان فاضي",
    ],

    "atm": [
        "صراف", "صرافة", "صراف آلي", "سحب فلوس",
        "محتاج كاش", "ابغى فلوس", "وين صراف",
        "سحب أموال", "ابغى أسحب", "ATM",
        "ما معي فلوس", "ابغى كاش",
    ],

    "bakery": [
        "مخبز", "بيكري", "خبز", "معجنات",
        "وين مخبز", "ابغى خبز", "حلويات",
        "كيك", "خبازة", "كرواسون",
        "طازج", "خبز طازج",
    ],

    "park": [
        "حديقة", "منتزه", "متنزه", "حديقة عامة",
        "وين حديقة", "نزهة", "العب برا",
        "هواء", "مشي", "رياضة برا",
        "ابغى اتنزه", "مكان مفتوح",
    ],

    "lodging": [
        "فندق", "فنادق", "استراحة", "شقة فندقية",
        "وين أنام", "ابغى فندق", "مكان للنوم",
        "حجز فندق", "هوتيل", "غرفة فندق",
        "محتاج مكان للمبيت", "ليلة",
    ],
}

PLACE_LABEL_AR: dict[str, str] = {
    "restaurant": "مطعم",
    "cafe": "كافيه",
    "pharmacy": "صيدلية",
    "hospital": "مستشفى",
    "supermarket": "سوبرماركت",
    "mosque": "مسجد",
    "gas_station": "محطة بنزين",
    "atm": "صراف آلي",
    "bakery": "مخبز",
    "park": "حديقة",
    "lodging": "فندق",
}


class ArabicIntentClassifier:
    """
    نموذج تصنيف محلي يعمل بدون أي API.

    خوارزمية:
    1. تحويل نص المستخدم إلى vector (embedding) عبر النموذج
    2. حساب cosine similarity مع جميع الأمثلة
    3. أخذ متوسط أعلى 3 نتائج لكل فئة
    4. الفئة الأعلى نقاطاً هي الإجابة (إذا تجاوزت عتبة الثقة)
    """

    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

    def __init__(self) -> None:
        self._model: SentenceTransformer | None = None
        self._all_embeddings: np.ndarray | None = None
        self._all_labels: list[str] = []

    def load(self) -> None:
        """تحميل النموذج وحساب embeddings مسبقاً (يُستدعى مرة واحدة عند الإقلاع)."""
        log.info("intent_model: loading %s ...", self.MODEL_NAME)
        self._model = SentenceTransformer(self.MODEL_NAME)

        texts: list[str] = []
        labels: list[str] = []
        for intent, examples in INTENT_EXAMPLES.items():
            for ex in examples:
                texts.append(ex)
                labels.append(intent)

        log.info("intent_model: encoding %d examples ...", len(texts))
        self._all_embeddings = self._model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False
        )
        self._all_labels = labels
        log.info("intent_model: ready ✓")

    def classify(self, text: str) -> IntentResult:
        """
        تصنيف نص عربي → نوع المكان.
        إرجاع IntentResult(place_type, confidence, place_name_ar)
        """
        if self._model is None or self._all_embeddings is None:
            return IntentResult(None, 0.0, "")

        query_emb = self._model.encode([text], normalize_embeddings=True)
        sims: np.ndarray = cosine_similarity(query_emb, self._all_embeddings)[0]

        # تجميع النتائج لكل فئة
        intent_scores: dict[str, list[float]] = {k: [] for k in INTENT_EXAMPLES}
        for sim, label in zip(sims.tolist(), self._all_labels):
            intent_scores[label].append(sim)

        best_intent: str | None = None
        best_score = 0.0
        for intent, scores in intent_scores.items():
            top3_avg = float(np.mean(sorted(scores, reverse=True)[:3]))
            if top3_avg > best_score:
                best_score = top3_avg
                best_intent = intent

        if best_score < CONFIDENCE_THRESHOLD:
            return IntentResult(None, round(best_score, 3), "")

        label_ar = PLACE_LABEL_AR.get(best_intent or "", best_intent or "")
        return IntentResult(best_intent, round(best_score, 3), label_ar)


# ─── Singleton ────────────────────────────────────────────────────────────────
classifier = ArabicIntentClassifier()
