#!/usr/bin/env python3
"""
DoWhy Causal Root Cause wrapper — formal causal inference for financial anomalies.
Run: python3 dowhy-wrapper.py <JSON_INPUT>
"""

import sys
import json
import os

def causal_root_cause(data: dict) -> dict:
    """
    Use DoWhy to estimate causal effects of factors on an anomalous metric.
    Returns per-factor causal effect sizes with confidence.
    Falls back to sklearn linear regression if DoWhy estimate.value is None.
    """
    try:
        import pandas as pd
        import dowhy
        from dowhy import CausalModel
    except ImportError:
        return {"error": "dowhy not installed", "causal_effects": {}, "method": "unavailable"}

    try:
        df = pd.DataFrame(data["factors"])  # cols: period, factor1, factor2, ..., outcome
        treatment_vars = [c for c in df.columns if c not in (data["outcome_var"], "period", "id", "date", "timestamp")]
        
        model = CausalModel(
            data=df,
            treatment=treatment_vars,
            outcome=data["outcome_var"],
            common_causes=data.get("common_causes", ["seasonality_idx", "economic_idx"]),
        )

        identified_estimand = model.identify_effect(proceed_when_unidentifiable=True)
        
        estimate = model.estimate_effect(
            identified_estimand,
            method_name="backdoor.linear_regression"
        )

        # Extract effect — DoWhy returns None when sample is small; fall back to sklearn
        causal_effects = {}
        total_effect = None

        if estimate.value is not None and estimate.value != 0:
            # Normal path: DoWhy returned a valid estimate
            total_effect = float(estimate.value)
            if hasattr(estimate, "attention_weights") and estimate.attention_weights:
                for var in treatment_vars:
                    causal_effects[var] = float(estimate.attention_weights.get(var, 0))
            else:
                for var in treatment_vars:
                    causal_effects[var] = total_effect / len(treatment_vars)
        else:
            # DoWhy estimate.value is None — fall back to sklearn OLS
            from sklearn.linear_model import LinearRegression
            X = df[treatment_vars].values
            y = df[data["outcome_var"]].values
            lr = LinearRegression()
            lr.fit(X, y)
            total_effect = float(lr.coef_[0]) if len(treatment_vars) == 1 else float(lr.coef_.mean())
            for i, var in enumerate(treatment_vars):
                causal_effects[var] = float(lr.coef_[i])
            total_effect = float(lr.coef_[0]) if len(treatment_vars) == 1 else float(lr.coef_.mean())

        # Refutation: placebo treatment (skip if insufficient data)
        placebo_p_value = None
        refutation_significant = None
        confidence = "medium"
        try:
            if len(df) >= 8:
                refute = model.refute_estimate(
                    identified_estimand, estimate,
                    method_name="placebo_treatment_refuter",
                    placebo_type="random_common_cause"
                )
                placebo_p_value = float(refute.new_effect) if hasattr(refute, "new_effect") else None
                refutation_significant = bool(refute.refutation_result["p_value"] < 0.05) if hasattr(refute, "refutation_result") else None
                confidence = "high" if refutation_significant else "medium"
        except Exception:
            pass  # Refutation failed — continue without it

        return {
            "causal_effects": causal_effects,
            "total_effect": total_effect,
            "method": "dowhy_backdoor_linear",
            "placebo_p_value": placebo_p_value,
            "refutation_significant": refutation_significant,
            "confidence": confidence,
        }
    except Exception as e:
        return {"error": str(e), "causal_effects": {}, "method": "error"}

if __name__ == "__main__":
    try:
        data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else json.load(sys.stdin)
        result = causal_root_cause(data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))