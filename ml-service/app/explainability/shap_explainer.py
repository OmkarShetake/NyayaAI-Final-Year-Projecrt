"""
SHAP-based explanations ("Model feature contribution").

For each prediction we compute SHAP values with TreeExplainer and report, per
raw feature, the contribution toward HIGH risk relative to LOW risk
(shap[HIGH] - shap[LOW], in the model's margin space). One-hot encoded columns
are aggregated back to their original feature.

These values describe how the MODEL used each input. They do not establish
causation in the real world.
"""
from __future__ import annotations

import logging

import numpy as np
import shap

# XGBoost 3.x compatibility patch for SHAP 0.44-0.49:
# In multi-class models, XGBoost serializes base_score as a string vector (e.g. "[-0.14,-0.08,0.22]"),
# which causes shap.TreeExplainer's internal loader to raise ValueError: could not convert string to float.
try:
    import shap.explainers._tree as _st
    _orig_decode = _st.decode_ubjson_buffer

    def _safe_decode(fd):
        obj = _orig_decode(fd)
        try:
            lmp = obj.get("learner", {}).get("learner_model_param", {})
            if "base_score" in lmp and isinstance(lmp["base_score"], str) and lmp["base_score"].startswith("["):
                val = lmp["base_score"].strip("[]").split(",")[0]
                lmp["base_score"] = val
        except Exception:
            pass
        return obj

    _st.decode_ubjson_buffer = _safe_decode
except Exception:
    pass

from app.config import settings
from app.preprocessing.preprocess import ALL_FEATURES, FEATURE_LABELS

logger = logging.getLogger(__name__)


class ShapExplainer:
    def __init__(self):
        self._explainer = None
        self._model_id = None

    def _get(self, model):
        if self._explainer is None or self._model_id != id(model):
            self._explainer = shap.TreeExplainer(model)
            self._model_id = id(model)
        return self._explainer

    @staticmethod
    def _raw_name(encoded: str) -> str:
        name = encoded.split("__", 1)[-1]
        for f in sorted(ALL_FEATURES, key=len, reverse=True):
            if name == f or name.startswith(f + "_"):
                return f
        return name

    def explain(self, model, X, feature_names: list[str], classes: list[str], predicted: str,
                input_features: dict, top_k: int | None = None) -> dict:
        top_k = top_k or settings.TOP_K_FEATURES
        explainer = self._get(model)
        values = explainer.shap_values(X)
        # Normalise to shape (n_classes, n_features) for the first row.
        if isinstance(values, list):
            per_class = np.array([v[0] for v in values])
        else:
            arr = np.asarray(values)
            per_class = arr[0].T if arr.ndim == 3 else arr[0][None, :]

        idx = {c: i for i, c in enumerate(classes)}
        if per_class.shape[0] >= 3 and "HIGH" in idx and "LOW" in idx:
            risk_vec = per_class[idx["HIGH"]] - per_class[idx["LOW"]]
        else:
            risk_vec = per_class[0]
        pred_vec = per_class[idx.get(predicted, 0)]

        agg_risk: dict[str, float] = {}
        agg_pred: dict[str, float] = {}
        for j, enc in enumerate(feature_names):
            raw = self._raw_name(enc)
            agg_risk[raw] = agg_risk.get(raw, 0.0) + float(risk_vec[j])
            agg_pred[raw] = agg_pred.get(raw, 0.0) + float(pred_vec[j])

        contributions = []
        for f, impact in agg_risk.items():
            contributions.append({
                "feature": f,
                "label": FEATURE_LABELS.get(f, f),
                "value": input_features.get(f),
                "impact": round(impact, 4),
                "predictedClassImpact": round(agg_pred.get(f, 0.0), 4),
                "direction": "increases_risk" if impact > 0 else "decreases_risk",
            })
        contributions.sort(key=lambda c: abs(c["impact"]), reverse=True)
        top = contributions[:top_k]
        return {
            "method": "SHAP TreeExplainer",
            "label": "Model feature contribution",
            "basis": "Contribution toward HIGH vs LOW risk (model margin space)",
            "features": top,
            "summary": self._summarise(predicted, top),
            "disclaimer": "Feature contributions describe the model's behaviour, not real-world causation.",
        }

    @staticmethod
    def _describe(c: dict) -> str:
        v = c["value"]
        label = c["label"]
        if isinstance(v, (int, float)) and v is not None:
            if c["feature"] == "adjournmentRatio":
                vs = f"{v:.0%}"
            elif c["feature"] == "hearingsPerYear":
                vs = f"{v:.1f}/year"
            elif c["feature"] in ("caseAgeDays", "daysSinceLastHearing", "daysToNextHearing"):
                vs = f"{int(v)} days"
            else:
                vs = f"{v:g}"
            return f"{label} ({vs})"
        if v is None:
            return f"{label} (not available)"
        return f"{label}: {v}"

    def _summarise(self, predicted: str, top: list[dict]) -> list[str]:
        lines = []
        for c in top[:6]:
            sign = "+" if c["direction"] == "increases_risk" else "-"
            verb = "pushed the model toward higher risk" if sign == "+" else "pushed the model toward lower risk"
            lines.append(f"{sign} {self._describe(c)} {verb}")
        return lines


shap_explainer = ShapExplainer()
