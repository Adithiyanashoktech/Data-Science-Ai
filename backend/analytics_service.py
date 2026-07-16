import pandas as pd
import numpy as np
from scipy import stats
from statsmodels.tsa.seasonal import seasonal_decompose
from typing import Dict, List, Any, Tuple

class AnalyticsService:
    @staticmethod
    def analyze_dataset(df_json: List[Dict[str, Any]], primary_col: str) -> Dict[str, Any]:
        """Run statistical analysis on a dataset (represented as JSON record list)."""
        df = pd.DataFrame(df_json)
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)
        
        # Select numeric columns
        numeric_df = df.select_dtypes(include=[np.number])
        if primary_col not in numeric_df.columns:
            if len(numeric_df.columns) > 0:
                primary_col = numeric_df.columns[0]
            else:
                return {"error": "No numeric columns available for analysis."}
                
        series = numeric_df[primary_col]
        
        # 1. Summary Statistics
        stats_summary = {
            "mean": float(series.mean()),
            "median": float(series.median()),
            "std": float(series.std()) if not pd.isna(series.std()) else 0.0,
            "min": float(series.min()),
            "max": float(series.max()),
            "last_value": float(series.iloc[-1]),
            "count": len(series)
        }
        
        # Calculate financial metrics if stock-like
        if "close" in primary_col.lower() or primary_col in ["Median_Home_Price", "Value"]:
            start_val = series.iloc[0]
            end_val = series.iloc[-1]
            if start_val > 0 and len(series) > 1:
                # Approximate annual CAGR
                years = (series.index[-1] - series.index[0]).days / 365.25
                if years > 0:
                    stats_summary["cagr"] = float((end_val / start_val) ** (1 / years) - 1) * 100
                stats_summary["total_return"] = float((end_val - start_val) / start_val) * 100
                
            # Drawdown
            roll_max = series.cummax()
            drawdowns = (series - roll_max) / roll_max * 100
            stats_summary["max_drawdown"] = float(drawdowns.min())
            
        # 2. Trend Detection
        # Regress against index
        x = np.arange(len(series))
        y = series.values
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
        
        trend_direction = "flat"
        if p_value < 0.05: # Statistically significant
            if slope > 0:
                trend_direction = "upward"
            elif slope < 0:
                trend_direction = "downward"
                
        trend_summary = {
            "slope": float(slope),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "direction": trend_direction,
            "description": f"The dataset exhibits a significant {trend_direction} trend." if trend_direction != "flat" else "The dataset trend is stable or lacks a linear direction."
        }
        
        # 3. Anomaly and Outlier Detection
        # Use rolling Z-score to capture local anomalies
        window = min(len(series), 30)
        rolling_mean = series.rolling(window=window, min_periods=1).mean()
        rolling_std = series.rolling(window=window, min_periods=1).std().fillna(series.std() / 2).fillna(1.0)
        z_scores = (series - rolling_mean) / rolling_std
        
        anomalies_indices = np.where(np.abs(z_scores) > 2.5)[0]
        anomalies = []
        for idx in anomalies_indices:
            anomalies.append({
                "date": series.index[idx].strftime("%Y-%m-%d"),
                "value": float(series.iloc[idx]),
                "z_score": float(z_scores.iloc[idx]),
                "type": "spike" if z_scores.iloc[idx] > 0 else "drop"
            })
            
        # Add sudden percentage changes (sharp spikes)
        pct_change = series.pct_change() * 100
        std_pct = pct_change.std()
        mean_pct = pct_change.mean()
        sharp_changes = np.where(np.abs(pct_change - mean_pct) > 3.0 * std_pct)[0]
        for idx in sharp_changes:
            if idx == 0:
                continue
            date_str = series.index[idx].strftime("%Y-%m-%d")
            # If not already marked as anomaly, add it
            if not any(a["date"] == date_str for a in anomalies):
                anomalies.append({
                    "date": date_str,
                    "value": float(series.iloc[idx]),
                    "pct_change": float(pct_change.iloc[idx]),
                    "type": "sudden_shift"
                })
                
        # Sort anomalies by date
        anomalies.sort(key=lambda x: x["date"])
        
        # 4. Correlation Matrix
        corr_matrix = numeric_df.corr().replace({np.nan: None}).to_dict()
        correlations = []
        cols = list(numeric_df.columns)
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                c_val = numeric_df[cols[i]].corr(numeric_df[cols[j]])
                if not pd.isna(c_val):
                    correlations.append({
                        "var1": cols[i],
                        "var2": cols[j],
                        "value": float(c_val),
                        "strength": "strong" if abs(c_val) > 0.7 else "moderate" if abs(c_val) > 0.4 else "weak"
                    })
        correlations.sort(key=lambda x: abs(x["value"]), reverse=True)
        
        # 5. Seasonality Decomposition
        # Find frequency and appropriate period
        # If daily, period=7 or 30. If monthly, period=12.
        period = 12 # Default monthly
        
        # Detect delta between indices to guess frequency
        if len(series) > 10:
            diffs = pd.Series(series.index).diff().dropna()
            mean_days = diffs.mean().days
            if mean_days <= 3:
                period = 7 # Weekly seasonality for daily
            elif mean_days <= 10:
                period = 4 # Weekly
            elif mean_days <= 32:
                period = 12 # Yearly seasonality for monthly
            elif mean_days <= 95:
                period = 4 # Quarterly
            else:
                period = 1 # No seasonality detectable easily
        
        decomposition = {}
        if period > 1 and len(series) > 2 * period:
            try:
                # Do additive decomposition
                decomp = seasonal_decompose(series, model='additive', period=period, extrapolate_trend='freq')
                
                # Check for nan values and fill them
                trend_list = decomp.trend.bfill().ffill().tolist()
                seasonal_list = decomp.seasonal.fillna(0.0).tolist()
                resid_list = decomp.resid.fillna(0.0).tolist()
                
                decomposition = {
                    "has_seasonality": True,
                    "period": period,
                    "trend": [float(v) for v in trend_list],
                    "seasonal": [float(v) for v in seasonal_list],
                    "residual": [float(v) for v in resid_list],
                    "seasonal_strength": float(1 - decomp.resid.var() / decomp.seasonal.var()) if decomp.seasonal.var() > 1e-8 else 0.0
                }
            except Exception as e:
                print(f"Seasonality decomposition failed: {e}. Falling back.")
                decomposition = {"has_seasonality": False, "reason": str(e)}
        else:
            # Fallback
            rolling = series.rolling(window=max(2, len(series)//10), center=True, min_periods=1).mean()
            residuals = series - rolling
            decomposition = {
                "has_seasonality": False,
                "trend": [float(v) for v in rolling.fillna(series.mean()).tolist()],
                "seasonal": [0.0] * len(series),
                "residual": [float(v) for v in residuals.tolist()],
                "seasonal_strength": 0.0
            }
            
        return {
            "column": primary_col,
            "statistics": stats_summary,
            "trend": trend_summary,
            "anomalies": anomalies[:20], # Limit to top 20 anomalies
            "correlations": correlations[:10], # Top 10 correlations
            "decomposition": {
                "has_seasonality": decomposition.get("has_seasonality", False),
                "trend": decomposition.get("trend", []),
                "seasonal": decomposition.get("seasonal", []),
                "residual": decomposition.get("residual", []),
                "strength": decomposition.get("seasonal_strength", 0.0)
            }
        }
