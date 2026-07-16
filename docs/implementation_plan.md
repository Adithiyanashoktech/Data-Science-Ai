# Implementation Plan - Data Science AI Agent

Create a production-ready **Data Science AI Agent** web application featuring interactive visualizations, machine learning forecasting, automatic graph generation, AI-powered analysis, an interactive customizable dashboard, a chat assistant, and multi-source data ingestion.

---

## Architecture Overview

We will design a decoupled, single-host deployable full-stack application:
- **Backend (Python + FastAPI)**: Built with `fastapi`, `pandas`, `numpy`, `scikit-learn`, `statsmodels`, and `sqlite`. It handles user authentication, data fetching (Yahoo Finance, World Bank, FRED), file uploads (CSV, Excel, JSON), automated data cleaning, statistical analysis (trend, seasonal, anomalies), and machine learning forecasts.
- **Frontend (React + TypeScript + Vite)**: A single-page application built with React, styled with premium Vanilla CSS (combining modern glassmorphism, responsive grid layout, and dark/light modes), and interactive charts rendered via **ApexCharts** (supporting zoom, pan, candlestick, lines, bar charts, heatmaps, and image/data exports).

To make installation and deployment trivial, the React frontend will be built and served as static files directly by FastAPI, resulting in a single-port, zero-config launch on `http://localhost:8000`.

---

## Proposed Changes

### Component 1: Project Setup & Environment
- **[NEW] `requirements.txt`**: Python dependencies including `fastapi`, `uvicorn`, `pandas`, `numpy`, `scikit-learn`, `statsmodels`, `yfinance`, `httpx`, `openpyxl`, `reportlab`, `python-jose`, `passlib`, `python-multipart`.
- **[NEW] `package.json`**: Frontend package configuration including `react`, `react-dom`, `apexcharts`, `react-apexcharts`, `lucide-react`.

### Component 2: Backend (FastAPI Services)
- **[NEW] [main.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/main.py)**: Server entrypoint, handles database initialization, CORS, static file serving, and binds API routers.
- **[NEW] [database.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/database.py)**: SQLAlchemy models for Users, SavedDashboards, and ActivityLogs. Uses SQLite for simple local database setup.
- **[NEW] [auth.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/auth.py)**: JWT-based authentication, user registration, and login.
- **[NEW] [data_service.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/data_service.py)**: Ingests data from finance (Yahoo Finance), economics (FRED, World Bank), and user uploads. Implements automated data cleaning (filling NaNs, parsing dates, typing columns).
- **[NEW] [analytics_service.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/analytics_service.py)**: Detects trend coefficients, statistical anomalies, seasonal decomposition (trend + seasonal + noise), and correlations.
- **[NEW] [forecast_service.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/forecast_service.py)**: Implements forecasting models:
  - **ARIMA** (statsmodels)
  - **Exponential Smoothing** (statsmodels)
  - **Linear Regression** (scikit-learn)
  - **Random Forest Regressor** (scikit-learn)
  - **Prophet-like Additive Model** (custom implementation using scikit-learn LinearRegression + Fourier features for trend and weekly/yearly seasonal components, ensuring lightweight installation).
  - Returns prediction intervals (95% bounds), model confidence (R² / MAPE), and historical back-testing.
- **[NEW] [ai_service.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/ai_service.py)**: Core AI agent logic. Generates context-aware summaries of datasets and maps chat queries to graph data. Integrates with the Gemini API (via standard REST or `google-genai` SDK) if `GEMINI_API_KEY` is provided in `.env`. Fallbacks to a rule-based statistical NLG engine if the key is missing.
- **[NEW] [report_service.py](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/backend/report_service.py)**: Builds AI-style PDF reports using `reportlab`, and exports tables to Excel/CSV.

### Component 3: Frontend (React UI & Visualization)
- **[NEW] [index.html](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/index.html)**: Main HTML structure.
- **[NEW] [index.css](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/index.css)**: Global premium design tokens, dark/light theme variables, animations, scrollbars, and fonts.
- **[NEW] [App.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/App.tsx)**: Root component containing state (active dataset, active dashboard widgets, user auth state).
- **[NEW] [components/Dashboard.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/components/Dashboard.tsx)**: Interactive grid with drag-and-drop capability, widget configuration, and side-by-side comparison mode.
- **[NEW] [components/DataExplorer.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/components/DataExplorer.tsx)**: Catalog browser, search bar, and file uploader (CSV/Excel/JSON).
- **[NEW] [components/Visualizer.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/components/Visualizer.tsx)**: Renders interactive charts (ApexCharts) with type selectors, color theme picker, moving averages toggle, zoom, pan, and exports.
- **[NEW] [components/ChatAssistant.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/components/ChatAssistant.tsx)**: Sidebar AI chatbot. Sends current active graph context to backend for contextual discussions.
- **[NEW] [components/Forecaster.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/components/Forecaster.tsx)**: User interface for running forecasts, selecting models (ARIMA, Prophet-like, Random Forest), adjusting confidence intervals, and showing back-testing metrics.
- **[NEW] [components/AuthModal.tsx](file:///c:/Users/Adithiyan/Downloads/Data%20Science%20Ai%20Agent/frontend/src/components/AuthModal.tsx)**: Register and login modal.

---

## User Review Required

> [!IMPORTANT]
> **API Credentials**: If you have a Gemini API key or FRED API key, you will be able to store them in a local `.env` file in the workspace. However, the system is designed to work fully out of the box with a local rule-based intelligence engine and mock/fallback financial-economic APIs, so no API keys are strictly required to run and test it.
>
> **Lightweight Forecasting**: Because tensorflow (LSTM) and fbprophet (Prophet) can take hours to download/compile on Windows (often failing due to MSVC version mismatch), I will implement:
> - ARIMA and Exponential Smoothing via `statsmodels`
> - A custom Prophet-like model using scikit-learn (`LinearRegression` + Fourier seasonality components)
> - Regression/ensemble forecasting (Random Forest, Linear Regression, MLP)
> This ensures 100% reliable, zero-config local installation on Windows while delivering the exact same forecast capabilities (seasonality, trends, intervals, backtesting).

---

## Open Questions

- Would you like us to use standard SQLite database file `data_agent.db` for storage of user dashboard configurations, or just rely on local storage for simpler local setup? *(We recommend SQLite for persistence and production-readiness).*
- For CSS styling, we will use a custom, ultra-premium dark/light theme design using Vanilla CSS (variables, glassmorphism, responsive grid). Is Vanilla CSS acceptable for your design requirements? *(We recommend it to avoid Tailwind compilation overhead).*

---

## Verification Plan

### Automated Tests
We will add a verification script `verify.py` that:
- Runs test suites on the analytics models.
- Tests data cleaning functions.
- Validates forecast intervals.

### Manual Verification
1. Install Python packages and build frontend:
   - Run backend dependency installation: `pip install -r requirements.txt`
   - Install npm modules: `npm install`
   - Build Vite client: `npm run build`
2. Start the integrated backend server:
   - Launch: `python -m uvicorn backend.main:app --reload`
3. Verify features in the browser:
   - Browse catalog datasets (Tesla, Apple, Fremont Housing, Inflation, GDP).
   - Test CSV uploads and auto-generated plots.
   - Run ARIMA/Prophet forecasts and check charts.
   - Interact with the chat assistant and customize/save widgets.
