import os
from io import BytesIO
import uuid
import json
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Backend Modules
from backend.database import init_db, get_db, User, Dashboard, ActivityLog
from backend.auth import hash_password, verify_password, create_access_token, get_current_user
from backend.data_service import DataService
from backend.analytics_service import AnalyticsService
from backend.forecast_service import ForecastService
from backend.ai_service import AIService
from backend.report_service import ReportService

# Initialize app
app = FastAPI(title="Data Science AI Agent API", version="1.0.0")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
data_service = DataService()
ai_service = AIService()

# Database Setup
init_db()

# Pydantic Schemas
class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class DashboardSave(BaseModel):
    title: str
    description: Optional[str] = None
    layout: List[Dict[str, Any]]
    widgets: List[Dict[str, Any]]
    is_public: bool = False

class AnalyzeRequest(BaseModel):
    data: List[Dict[str, Any]]
    column: str

class ForecastRequest(BaseModel):
    data: List[Dict[str, Any]]
    column: str
    model_type: str = "prophet"
    steps: int = 30

class InsightRequest(BaseModel):
    meta: Dict[str, Any]
    analytics: Dict[str, Any]

class ChatRequest(BaseModel):
    query: str
    meta: Dict[str, Any]
    analytics: Dict[str, Any]

# API ROUTERS

# 1. AUTHENTICATION ROUTERS
@app.post("/api/auth/register", response_model=Dict[str, str])
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == user_in.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username is already taken")
        
    pwd_hash = hash_password(user_in.password)
    db_user = User(username=user_in.username, password_hash=pwd_hash)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Log Activity
    log = ActivityLog(user_id=db_user.id, action="REGISTER", details=f"User {db_user.username} registered")
    db.add(log)
    db.commit()
    
    return {"message": "Registration successful"}

@app.post("/api/auth/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if not db_user or not verify_password(db_user.password_hash, user_in.password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    access_token = create_access_token(data={"sub": db_user.username})
    
    # Log Activity
    log = ActivityLog(user_id=db_user.id, action="LOGIN", details=f"User {db_user.username} logged in")
    db.add(log)
    db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": db_user.username
    }

@app.get("/api/auth/me")
def get_me(user: Optional[User] = Depends(get_current_user)):
    if not user:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "username": user.username,
        "id": user.id
    }

# 2. DATASET ROUTERS
@app.get("/api/datasets")
def list_datasets():
    """List available catalog datasets."""
    return [
        {"id": "TSLA", "title": "Tesla Stock Prices", "category": "Financials", "icon": "trending-up", "description": "Daily stock price history, volume, and technical indicators for Tesla Inc."},
        {"id": "AAPL", "title": "Apple Stock Prices", "category": "Financials", "icon": "apple", "description": "Historical daily equity pricing and stock volumes for Apple Inc."},
        {"id": "NVDA", "title": "NVIDIA Stock Prices", "category": "Financials", "icon": "zap", "description": "Stock price acceleration patterns capturing the AI expansion cycles."},
        {"id": "BTC-USD", "title": "Bitcoin / USD", "category": "Crypto", "icon": "coins", "description": "Bitcoin pricing trends and trading volatility metrics."},
        {"id": "ETH-USD", "title": "Ethereum / USD", "category": "Crypto", "icon": "coin", "description": "Ethereum decentralized platform token historical records."},
        {"id": "US_GDP", "title": "United States GDP", "category": "Economics", "icon": "globe", "description": "Macroeconomic annual US Gross Domestic Product from the World Bank."},
        {"id": "US_INFLATION", "title": "United States Inflation Rate", "category": "Economics", "icon": "activity", "description": "Annual consumer price fluctuations measuring purchasing power shifts."},
        {"id": "US_UNEMPLOYMENT", "title": "United States Unemployment", "category": "Economics", "icon": "users", "description": "National unemployment rate percentages mapped over years."},
        {"id": "FREMONT_HOUSING", "title": "Fremont Housing Trends", "category": "Real Estate", "icon": "home", "description": "Home prices, monthly inventories, mortgage rates, and affordability in Fremont, CA."},
        {"id": "CALIFORNIA_RENT", "title": "California Rental Prices", "category": "Real Estate", "icon": "key", "description": "Rental price changes across major metropolitan regions in California."},
        {"id": "GLOBAL_TEMP", "title": "Global Temp Anomalies", "category": "Climate", "icon": "thermometer", "description": "NASA records mapping annual deviations in global surface temperatures."}
    ]

@app.get("/api/datasets/{dataset_id}")
async def get_dataset(dataset_id: str, period: str = "5y"):
    try:
        return await data_service.get_dataset(dataset_id, period)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), user: Optional[User] = Depends(get_current_user)):
    try:
        content = await file.read()
        cleaned_df = data_service.clean_uploaded_data(content, file.filename)
        
        # Generate a unique custom dataset ID
        dataset_id = f"UPLOAD_{uuid.uuid4().hex[:8].upper()}"
        cache_path = os.path.join(data_service.cache_dir, f"upload_{dataset_id}.csv")
        cleaned_df.to_csv(cache_path)
        
        # Prepare response object format
        records = []
        for index, row in cleaned_df.iterrows():
            rec = {"date": index.strftime("%Y-%m-%d") if hasattr(index, "strftime") else str(index)}
            for col in cleaned_df.columns:
                val = row[col]
                rec[col] = float(val) if isinstance(val, (float, int)) else val
            records.append(rec)
            
        return {
            "dataset_id": dataset_id,
            "title": f"Upload: {file.filename}",
            "source": "User Upload",
            "category": "Custom",
            "columns": list(cleaned_df.columns),
            "data": records,
            "length": len(cleaned_df)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")

# 3. STATISTICAL ANALYTICS ROUTER
@app.post("/api/analytics")
def run_analytics(req: AnalyzeRequest):
    try:
        return AnalyticsService.analyze_dataset(req.data, req.column)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. FORECASTING ROUTER
@app.post("/api/forecast")
def run_forecast(req: ForecastRequest):
    try:
        return ForecastService.forecast(req.data, req.column, req.model_type, req.steps)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. AI ENGINE ROUTERS
@app.post("/api/ai/insights")
async def get_ai_insights(req: InsightRequest):
    try:
        return await ai_service.generate_dataset_insights(req.meta, req.analytics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/chat")
async def chat_assistant(req: ChatRequest):
    try:
        answer = await ai_service.answer_chat_query(req.query, req.meta, req.analytics)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. EXPORTS ROUTERS
@app.post("/api/reports/pdf")
async def download_pdf_report(req: Dict[str, Any]):
    try:
        meta = req.get("meta", {})
        analytics = req.get("analytics", {})
        insights = req.get("insights", {})
        
        pdf_bytes = ReportService.generate_pdf_report(meta, analytics, insights)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Analysis_Report_{meta.get('dataset_id', 'custom')}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")

@app.post("/api/reports/excel")
def download_excel(req: List[Dict[str, Any]]):
    try:
        excel_bytes = ReportService.generate_excel(req)
        return StreamingResponse(
            BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Data_Export.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation error: {str(e)}")

@app.post("/api/reports/csv")
def download_csv(req: List[Dict[str, Any]]):
    try:
        csv_bytes = ReportService.generate_csv(req)
        return StreamingResponse(
            BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=Data_Export.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV generation error: {str(e)}")

@app.get("/api/reports/csv")
async def download_csv_get(dataset_id: str, column: Optional[str] = None):
    try:
        ds = await data_service.get_dataset(dataset_id)
        data = ds.get("data", [])
        
        if column and data:
            filtered_data = []
            for row in data:
                filtered_data.append({
                    "date": row.get("date"),
                    column: row.get(column)
                })
            csv_bytes = ReportService.generate_csv(filtered_data)
        else:
            csv_bytes = ReportService.generate_csv(data)
            
        return StreamingResponse(
            BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Data_Export_{dataset_id}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV download error: {str(e)}")

@app.get("/api/public-url")
def get_public_url():
    try:
        # Search the active logs directory for any running tunnel URLs
        tasks_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.system_generated/tasks"))
        if os.path.exists(tasks_dir):
            import re
            for file in os.listdir(tasks_dir):
                if file.startswith("task-") and file.endswith(".log"):
                    path = os.path.join(tasks_dir, file)
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        # Match Pinggy HTTPS URL formats
                        match = re.search(r"https://[a-zA-Z0-9\-]+\.free\.pinggy\.net", content)
                        if match:
                            return {"url": match.group(0)}
                        match = re.search(r"https://[a-zA-Z0-9\-]+\.run\.pinggy\-free\.link", content)
                        if match:
                            return {"url": match.group(0)}
                        # Match Localtunnel HTTPS URL format
                        match = re.search(r"https://[a-zA-Z0-9\-]+\.loca\.lt", content)
                        if match:
                            return {"url": match.group(0)}
                            
        # Fallback to localtunnel password URL
        return {"url": "https://nice-impalas-press.loca.lt"}
    except Exception:
        return {"url": "https://nice-impalas-press.loca.lt"}

# 7. DASHBOARD PERSISTENCE ROUTERS
@app.post("/api/dashboards")
def save_dashboard(dash: DashboardSave, user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    dash_id = str(uuid.uuid4())
    db_dash = Dashboard(
        id=dash_id,
        user_id=user.id if user else None,
        title=dash.title,
        description=dash.description,
        layout=json.dumps(dash.layout),
        widgets=json.dumps(dash.widgets),
        is_public=dash.is_public
    )
    db.add(db_dash)
    db.commit()
    
    return {"message": "Dashboard saved successfully", "id": dash_id}

@app.get("/api/dashboards")
def list_dashboards(user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    # Return user's dashboards and all public dashboards
    query = db.query(Dashboard)
    if user:
        query = query.filter((Dashboard.user_id == user.id) | (Dashboard.is_public == True))
    else:
        query = query.filter(Dashboard.is_public == True)
        
    dashboards = query.all()
    
    return [
        {
            "id": d.id,
            "title": d.title,
            "description": d.description,
            "layout": json.loads(d.layout),
            "widgets": json.loads(d.widgets),
            "is_public": d.is_public,
            "is_owner": user.id == d.user_id if (user and d.user_id) else False,
            "created_at": d.created_at.strftime("%Y-%m-%d")
        }
        for d in dashboards
    ]

@app.get("/api/dashboards/{dashboard_id}")
def get_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    dash = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {
        "id": dash.id,
        "title": dash.title,
        "description": dash.description,
        "layout": json.loads(dash.layout),
        "widgets": json.loads(dash.widgets),
        "is_public": dash.is_public
    }

# 8. STATIC FILES SERVING (React build integration)
# Mount frontend build static files if folder exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "../frontend/dist"))

if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
    
    # Fallback to serve index.html for client side routing
    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        # If the path looks like an API call, return standard JSON 404
        if request.url.path.startswith("/api"):
            return Response(status_code=404, content=json.dumps({"detail": "API endpoint not found"}), media_type="application/json")
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
