import sys
import os

# Adjust path to import backend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.data_service import DataService
from backend.analytics_service import AnalyticsService
from backend.forecast_service import ForecastService
from backend.ai_service import AIService
from backend.report_service import ReportService

async def test_pipeline():
    print("-----------------------------------------")
    print("Data Science AI Agent Verification Pipeline")
    print("-----------------------------------------")
    
    data_svc = DataService()
    
    print("[1/5] Ingesting Fremont Housing trends dataset...")
    housing_data = await data_svc.get_dataset("FREMONT_HOUSING")
    print(f"      Loaded successfully. Title: '{housing_data['title']}'. Rows: {housing_data['length']}.")
    assert housing_data['length'] > 0, "Failed: Housing dataset empty!"
    
    print("[2/5] Running statistical analytics on Fremont Median Home Price...")
    analytics = AnalyticsService.analyze_dataset(housing_data['data'], "Median_Home_Price")
    print(f"      Mean price: ${analytics['statistics']['mean']:,.2f}")
    print(f"      Trend slope: {analytics['trend']['slope']:.4f} (Direction: {analytics['trend']['direction']})")
    print(f"      Outliers detected: {len(analytics['anomalies'])} points.")
    assert 'statistics' in analytics, "Failed: Analytics statistics not calculated!"
    
    print("[3/5] Testing ARIMA forecast (30 days ahead)...")
    arima_fc = ForecastService.forecast(housing_data['data'], "Median_Home_Price", "arima", 30)
    print(f"      Model backtest MAPE: {arima_fc['backtest_metrics']['mape']:.2f}%")
    print(f"      Model confidence: {arima_fc['model_confidence']:.2f}%")
    print(f"      Forecast points: {len(arima_fc['forecast_data'])} rows.")
    assert len(arima_fc['forecast_data']) == 30, "Failed: ARIMA forecast size incorrect!"
    
    print("[4/5] Testing Custom Prophet-like Multi-Seasonal model...")
    prophet_fc = ForecastService.forecast(housing_data['data'], "Median_Home_Price", "prophet", 45)
    print(f"      Model backtest R²: {prophet_fc['backtest_metrics']['r_squared']:.4f}")
    print(f"      Model confidence: {prophet_fc['model_confidence']:.2f}%")
    print(f"      Forecast points: {len(prophet_fc['forecast_data'])} rows.")
    assert len(prophet_fc['forecast_data']) == 45, "Failed: Prophet-like forecast size incorrect!"
    
    print("[5/5] Testing ReportLab PDF Generation Service...")
    ai_svc = AIService()
    insights = await ai_svc.generate_dataset_insights(housing_data, analytics)
    pdf_bytes = ReportService.generate_pdf_report(housing_data, analytics, insights)
    print(f"      PDF Report generated successfully. Size: {len(pdf_bytes):,} bytes.")
    assert len(pdf_bytes) > 1000, "Failed: Generated PDF size is too small!"
    
    print("\n[SUCCESS] Verification Successful: All forecasting models and analytical pipelines are operational.")
    print("-----------------------------------------")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_pipeline())
