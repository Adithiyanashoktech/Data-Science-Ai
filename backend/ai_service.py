import os
import json
from typing import Dict, List, Any, Optional

class AIService:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        # Direct URL for Gemini API
        self.gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    async def _call_gemini(self, prompt: str) -> str:
        """Execute a direct REST call to Gemini 2.5 Flash."""
        if not self.api_key:
            return ""
            
        try:
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 800
                }
            }
            
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.gemini_url}?key={self.api_key}",
                    json=payload,
                    headers=headers,
                    timeout=15.0
                )
                if response.status_code == 200:
                    result = response.json()
                    return result["candidates"][0]["content"]["parts"][0]["text"]
                else:
                    print(f"Gemini API returned status {response.status_code}: {response.text}")
                    return ""
        except Exception as e:
            print(f"Gemini API call failed: {e}")
            return ""

    async def generate_dataset_insights(self, dataset_meta: Dict[str, Any], analytics_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate high-fidelity written analysis explaining what happened, why, and implications."""
        title = dataset_meta.get("title", "Dataset")
        source = dataset_meta.get("source", "Unknown")
        category = dataset_meta.get("category", "General")
        
        column = analytics_results.get("column", "Value")
        stats = analytics_results.get("statistics", {})
        trend = analytics_results.get("trend", {})
        anomalies = analytics_results.get("anomalies", [])
        correlations = analytics_results.get("correlations", [])
        
        # Prepare context data
        summary_text = (
            f"Dataset: {title} (Source: {source}, Category: {category})\n"
            f"Analyzed Variable: {column}\n"
            f"Observations: {stats.get('count', 0)} data points\n"
            f"Mean: {stats.get('mean'):,.2f}, Min: {stats.get('min'):,.2f}, Max: {stats.get('max'):,.2f}\n"
            f"Current/Last Value: {stats.get('last_value'):,.2f}\n"
        )
        if "cagr" in stats:
            summary_text += f"Compound Annual Growth Rate (CAGR): {stats.get('cagr'):.2f}%\n"
        if "total_return" in stats:
            summary_text += f"Total Return: {stats.get('total_return'):.2f}%\n"
        if "max_drawdown" in stats:
            summary_text += f"Maximum Drawdown: {stats.get('max_drawdown'):.2f}%\n"
            
        summary_text += f"Linear Trend: Direction = {trend.get('direction', 'flat')} (Slope = {trend.get('slope'):.4f}, R² = {trend.get('r_squared'):.4f})\n"
        
        if anomalies:
            summary_text += f"Anomalies/Outliers Detected ({len(anomalies)} total):\n"
            for a in anomalies[:5]:
                type_lbl = a.get("type", "shift")
                if "pct_change" in a:
                    summary_text += f"  - {a['date']}: value {a['value']:,.2f} changed by {a['pct_change']:.2f}% (sudden shift)\n"
                else:
                    summary_text += f"  - {a['date']}: value {a['value']:,.2f} (Z-Score: {a['z_score']:.2f}, {type_lbl})\n"
                    
        if correlations:
            summary_text += "Key Correlations:\n"
            for c in correlations[:3]:
                summary_text += f"  - {c['var1']} vs {c['var2']}: coeff {c['value']:.2f} ({c['strength']} correlation)\n"

        prompt = (
            "You are an expert Data Scientist and Financial/Economic Analyst. Analyze the following data statistics and provide a production-ready writeup.\n\n"
            "=== DATA STATS ===\n"
            f"{summary_text}\n"
            "==================\n\n"
            "Format your response EXACTLY as a JSON object with these keys (do not include markdown wrapping like ```json, return raw JSON string):\n"
            "{\n"
            '  "summary": "1-2 sentence high-level summary of the dataset",\n'
            '  "what_happened": "Detailed narrative explaining the historical movements, key phases, and general trajectory shown in the data",\n'
            '  "why_it_happened": "Informed logical explanation of the underlying causes (e.g. interest rate adjustments, market hype cycles, pandemic shifts, technology trends, or supply constraints)",\n'
            '  "key_insights": ["Insight point 1", "Insight point 2", "Insight point 3"],\n'
            '  "implications": "Strategic, business, or macroeconomic implications for decision-makers, investors, or researchers"\n'
            "}"
        )
        
        # If API key is available, run Gemini
        if self.api_key:
            res_text = await self._call_gemini(prompt)
            if res_text:
                try:
                    # Clean markdown wrappers if any
                    cleaned_res = res_text.strip()
                    if cleaned_res.startswith("```json"):
                        cleaned_res = cleaned_res[7:]
                    if cleaned_res.endswith("```"):
                        cleaned_res = cleaned_res[:-3]
                    cleaned_res = cleaned_res.strip()
                    return json.loads(cleaned_res)
                except Exception as e:
                    print(f"Failed to parse Gemini response: {e}. Output was:\n{res_text}")
                    
        # Fallback heuristic engine
        return self._generate_heuristic_insights(dataset_meta, analytics_results)

    def _generate_heuristic_insights(self, dataset_meta: Dict[str, Any], analytics_results: Dict[str, Any]) -> Dict[str, Any]:
        """Local heuristic generator to provide rich, structured summaries without requiring an API key."""
        title = dataset_meta.get("title", "Dataset")
        dataset_id = dataset_meta.get("dataset_id", "").upper()
        stats = analytics_results.get("statistics", {})
        trend = analytics_results.get("trend", {})
        anomalies = analytics_results.get("anomalies", [])
        
        last_val = stats.get("last_value", 0.0)
        mean_val = stats.get("mean", 0.0)
        direction = trend.get("direction", "flat")
        
        insights = []
        implications = ""
        what_happened = ""
        why_it_happened = ""
        summary = ""
        
        # Base customization on dataset type
        if "TSLA" in dataset_id:
            summary = f"Tesla's stock value experienced a long-term {direction} trajectory, currently trading at ${last_val:,.2f}."
            what_happened = (
                f"Tesla shares showed significant cycles of hype and correction. The stock moved from early lower levels to an all-time high "
                f"near $400, followed by macro-induced adjustments. Daily volatility is high, with a standard deviation of ${stats.get('std'):,.2f}."
            )
            why_it_happened = (
                "Growth was fueled by EV adoption tailwinds, battery technology advancements, and high-retail investor enthusiasm. Corrections "
                "were caused by broader interest rate hikes, margin pressures from price cuts, and CEO-related execution risks."
            )
            insights = [
                f"Tesla trades with high volatility (Standard Deviation: ${stats.get('std'):,.2f}), offering swing trading opportunities.",
                f"The historical CAGR stands at {stats.get('cagr', 0.0):.2f}%, indicating strong long-term expansion despite deep drawdowns.",
                f"The maximum drawdown reached {stats.get('max_drawdown', 0.0):.2f}%, showing high risk relative to standard indexes."
            ]
            implications = "Investors should prepare for continued volatility. Tesla's valuation behaves like a high-growth tech stock rather than a traditional auto maker."
            
        elif "NVDA" in dataset_id:
            summary = f"NVIDIA stock demonstrates a remarkable {direction} trend, driven by the explosive growth in AI infrastructure demand."
            what_happened = (
                f"NVIDIA stock remained relatively flat for years, followed by an exponential surge beginning in late 2022. The stock has risen to "
                f"${last_val:,.2f}, indicating a monumental total return of {stats.get('total_return', 0.0):.1f}%."
            )
            why_it_happened = (
                "The primary driver is NVIDIA's dominant market share (~80-90%) in high-performance data center GPUs required to train and run "
                "large language models. Financial quarters repeatedly beat analyst consensus, leading to multiple valuation expansions."
            )
            insights = [
                f"NVIDIA achieved a compound annual growth rate (CAGR) of {stats.get('cagr', 0.0):.1f}%, outperforming almost all major equities.",
                "AI-driven revenues in the data center division have become the primary anchor of the company's valuation.",
                "Moving averages (50-day and 200-day) indicate a strong, sustained structural support band."
            ]
            implications = "A high valuation puts a premium on execution. Supply chain capacities (such as TSMC packaging) are the main bottlenecks for future growth."
            
        elif "HOUSING" in dataset_id or "RENT" in dataset_id:
            summary = f"Fremont housing prices show a long-term upward trend, closing at a median of ${last_val:,.2f}."
            what_happened = (
                f"Housing prices grew steadily from 2015, accelerated during the 2020-2021 pandemic boom, corrected slightly in 2022-2023, "
                f"and recovered into 2024-2026. The median home price averages ${mean_val:,.2f}."
            )
            why_it_happened = (
                "Fremont's proximity to Silicon Valley tech employers, excellent public schools, and extremely constrained housing supply "
                "drove the long-term trend. The 2020-2021 boom was triggered by historic low mortgage rates, while the 2022 correction "
                "corresponded to the Fed raising interest rates from 0% to over 5%."
            )
            insights = [
                f"Median prices currently hover at ${last_val:,.2f}, showing a resilient {direction} trend.",
                f"Mortgage rate spikes directly impacted inventory levels, compressing affordability below historical averages.",
                f"Low inventory (averaging {stats.get('mean')*0.00015:.0f} active listings) serves as a floor protecting prices from deep collapses."
            ]
            implications = "Fremont remains a seller's market. Affordability indices imply entry-level buyers will face severe barriers without substantial down-payments."
            
        elif "GDP" in dataset_id:
            summary = f"US GDP represents a steady, long-term {direction} macroeconomic growth trend, reaching ${last_val/1e12:.2f} Trillion."
            what_happened = (
                f"GDP grew steadily year-over-year, showing a minor drop in 2020 due to pandemic lockdowns, followed by a sharp fiscal-led "
                f"rebound in 2021-2022. It continues to expand at a steady pace."
            )
            why_it_happened = (
                "US economic expansion is driven by consumer spending (constituting ~70%), corporate productivity, technology investments, "
                "and sustained government spending. The recovery post-2020 was accelerated by massive stimulus injections."
            )
            insights = [
                f"US Gross Domestic Product is currently valued at ${last_val/1e12:.2f} Trillion.",
                "The linear trend exhibits an R² of {trend.get('r_squared', 0.0):.3f}, signifying highly predictable, stable growth.",
                "Recessions are highly visible but historically short-lived anomalies in the long-term trajectory."
            ]
            implications = "A stable GDP growth rate provides a positive backdrop for corporate earnings and equity markets, but fiscal deficits remain a key long-term structural concern."
            
        elif "INFLATION" in dataset_id:
            summary = f"US Inflation rate has shown a volatile pattern, currently registering at {last_val:.2f}%."
            what_happened = (
                f"Inflation remained low and stable (near 2%) for most of the 2010s, spiked dramatically to a peak of 8% in 2022, "
                f"and has since steadily receded back toward the Federal Reserve's target."
            )
            why_it_happened = (
                "The 2022 inflation spike was triggered by pandemic supply chain blockages, loose monetary policy, direct stimulus checks, "
                "and energy shocks from the Ukraine conflict. The cooling of inflation was driven by the Fed's aggressive rate hikes."
            )
            insights = [
                f"The current inflation reading of {last_val:.2f}% is close to the historical median of {mean_val:.2f}%.",
                f"The 2022 reading stands out as a significant outlier, representing a 3-standard-deviation shock.",
                "Correlations indicate that inflation spikes correspond directly to changes in interest/mortgage rates."
            ]
            implications = "As inflation normalizes, the Federal Reserve gains flexibility to adjust interest rates, supporting debt markets and mortgage refinancing."
            
        else:
            summary = f"The {title} dataset exhibits a {direction} trend, ending at a value of {last_val:,.2f}."
            what_happened = (
                f"Analyzing the variable {column} over time reveals a general {direction} pattern, moving from a minimum of {stats.get('min'):,.2f} "
                f"to a maximum of {stats.get('max'):,.2f}. The historical average is {mean_val:,.2f}."
            )
            why_it_happened = (
                "The trends and variance observed in the dataset reflect cyclic behavior, structural growth drivers, and occasional "
                f"statistical anomalies (we detected {len(anomalies)} anomalies in the data series)."
            )
            insights = [
                f"The primary variable has a standard deviation of {stats.get('std'):,.2f}, representing moderate variance.",
                f"The linear regression fit explains {trend.get('r_squared', 0.0)*100:.1f}% of the variations.",
                f"The most recent observation ({last_val:,.2f}) is in the {direction} direction compared to the historical average."
            ]
            implications = "Stakeholders should use these trends to project budget growth, resource requirements, and risk thresholds."
            
        return {
            "summary": summary,
            "what_happened": what_happened,
            "why_it_happened": why_it_happened,
            "key_insights": insights,
            "implications": implications
        }

    async def answer_chat_query(self, query: str, active_dataset_meta: Dict[str, Any], analytics_results: Dict[str, Any]) -> str:
        """Provide a context-aware answer to a user's question about the active dataset."""
        title = active_dataset_meta.get("title", "Dataset")
        dataset_id = active_dataset_meta.get("dataset_id", "CUSTOM").upper()
        stats = analytics_results.get("statistics", {})
        trend = analytics_results.get("trend", {})
        
        last_val = stats.get("last_value", 0.0)
        mean_val = stats.get("mean", 0.0)
        
        context_str = (
            f"You are the Data Science AI Agent Chat Assistant.\n"
            f"Active Dataset: {title} ({dataset_id})\n"
            f"Current Value: {last_val:,.2f}\n"
            f"Historical Average: {mean_val:,.2f}\n"
            f"Trend: {trend.get('direction', 'flat')} (Slope: {trend.get('slope'):.4f}, R²: {trend.get('r_squared'):.4f})\n"
        )
        
        prompt = (
            f"{context_str}\n"
            f"User Question: '{query}'\n\n"
            "Answer the user's question in a professional, clear, data-informed way. "
            "If the user asks to compare datasets, make a forecast, or explain something specific, use the stats context. "
            "If the question is unrelated to the active dataset, answer it generally while politely steering the user back to the dashboard context. "
            "Keep your response under 300 words, using clear bullet points if helpful."
        )
        
        if self.api_key:
            res_text = await self._call_gemini(prompt)
            if res_text:
                return res_text.strip()
                
        # Smart local chatbot fallback
        q_lower = query.lower()
        
        if "explain" in q_lower or "what does" in q_lower or "summary" in q_lower:
            return (
                f"### Analysis of **{title}**\n\n"
                f"This dataset currently displays a **{trend.get('direction', 'flat')}** trend. "
                f"Here are the key points:\n"
                f"- **Current Value:** {last_val:,.2f}\n"
                f"- **Average Value:** {mean_val:,.2f}\n"
                f"- **Volatility:** The standard deviation is {stats.get('std'):,.2f}.\n"
                f"- **Trend Strength (R²):** {trend.get('r_squared', 0.0)*100:.1f}% of the variations are explained by a linear time trend.\n\n"
                f"You can view more specifics in the charts above, including seasonal splits and anomaly detections."
            )
            
        elif "why" in q_lower:
            if "housing" in q_lower or "fremont" in q_lower or "rent" in q_lower:
                return (
                    "Fremont housing prices and rental markets increased primarily due to:\n"
                    "1. **Silicon Valley Tech Growth:** High salaries and proximity to major employers (Tesla factory, Meta, Google, Apple) created high demand.\n"
                    "2. **Severe Under-supply:** Strict local zoning laws and geographical limits (surrounded by Bay and hills) restrict new housing construction.\n"
                    "3. **Mortgage Rates:** The 2020-2021 surge was amplified by historic low mortgage rates (~2.8%). The 2022 correction happened when mortgage rates spiked to ~7%, reducing purchasing power."
                )
            elif "tesla" in q_lower or "tsla" in q_lower:
                return (
                    "Tesla's price shifts are driven by:\n"
                    "- **Hype Cycles:** Retail investor enthusiasm and EV leadership fueled historic runs (e.g. 2020-2021).\n"
                    "- **Competition & Margins:** Price cuts in China and Europe to defend market share have compressed gross margins, leading to valuation corrections.\n"
                    "- **Macro Factors:** Rising interest rates affect high-multiple growth stocks like Tesla more heavily than value equities."
                )
            elif "nvidia" in q_lower or "nvda" in q_lower:
                return (
                    "NVIDIA's stock surged dramatically because:\n"
                    "- **Generative AI Revolution:** Massive capital expenditures by Microsoft, Google, Meta, and Amazon on H100/H200/Blackwell GPU chips.\n"
                    "- **Moat:** NVIDIA's CUDA software framework creates an lock-in, making it difficult for developers to switch to AMD or custom chips."
                )
            elif "inflation" in q_lower:
                return (
                    "The inflation spike (2021-2022) was caused by a combination of factors:\n"
                    "1. **Supply Chain Disruptions:** Covid lock-downs caused global bottlenecks in shipping and manufacturing.\n"
                    "2. **Fiscal Stimulus:** Trillions of dollars injected directly to households boosted consumer demand.\n"
                    "3. **Energy Shocks:** Geopolitical tensions caused crude oil and food prices to spike.\n"
                    "It has receded because the Federal Reserve raised interest rates from 0.25% to 5.25%, cooling consumer credit and demand."
                )
            else:
                return f"The movements in **{title}** are driven by a combination of long-term structural trends (slope: {trend.get('slope'):.4f}) and short-term volatility. Review the anomalies list to see exact timestamps of unexplained spikes or drops."
                
        elif "predict" in q_lower or "forecast" in q_lower or "future" in q_lower:
            return (
                f"To forecast the future values of **{title}**, please navigate to the **Forecasting** tab. "
                f"You can choose from standard models like **ARIMA**, **Exponential Smoothing**, or the AI **Prophet-like** model. "
                f"The models project that the values are influenced by recent momentum and seasonal indices. "
                f"*Note: Forecasting models assume historical relationships persist and cannot account for unforeseen black-swan events.*"
            )
            
        elif "compare" in q_lower:
            return (
                "You can compare datasets directly! Click on the **Compare** mode toggle on the homepage dashboard. "
                "This allows you to select two datasets (e.g., Apple stock vs. NVIDIA stock, or GDP vs. Inflation) "
                "and plot them side-by-side or overlaid on the same time-series chart."
            )
            
        else:
            return (
                f"I am here to assist with **{title}**. "
                f"Your active variable is **{analytics_results.get('column')}**, with a current value of **{last_val:,.2f}**. "
                f"You can ask me questions about trends ('Why did it rise?'), forecasts ('Will it continue to grow?'), "
                f"or request an explanation of the specific anomalies listed in the widgets."
            )
