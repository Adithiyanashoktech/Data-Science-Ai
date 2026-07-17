import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Predefined high-fidelity mock data generators for real estate/local datasets
# to avoid dependency on brittle external local sources and guarantee offline functionality.

def generate_fremont_housing_data() -> pd.DataFrame:
    """Generate high-fidelity historical housing data for Fremont, CA (2015-2026)"""
    start_date = datetime(2015, 1, 1)
    dates = pd.date_range(start=start_date, end=datetime(2026, 6, 1), freq='ME')
    n = len(dates)
    
    # Base trend: upward with a dip in 2020 (Covid start) and a correction in late 2022 (interest rates)
    base_price = 750000
    trend = np.linspace(0, 650000, n)
    
    # Seasonality: peaks in spring/summer, troughs in winter
    seasonality = 45000 * np.sin(2 * np.pi * dates.month / 12)
    
    # Shock factors
    shocks = np.zeros(n)
    for i, date in enumerate(dates):
        if date >= datetime(2020, 3, 1) and date <= datetime(2020, 8, 1):
            shocks[i] = -30000 # Early covid dip
        elif date >= datetime(2020, 9, 1) and date <= datetime(2022, 5, 1):
            shocks[i] = 120000 # Pandemic homebuying boom
        elif date >= datetime(2022, 6, 1) and date <= datetime(2023, 12, 1):
            shocks[i] = -90000 # Tech layoffs & interest rate hikes
        elif date >= datetime(2024, 1, 1):
            shocks[i] = 50000 # Recovery
            
    noise = np.random.normal(0, 12000, n)
    median_prices = base_price + trend + seasonality + shocks + noise
    
    # Other metrics correlated with price
    avg_sale_prices = median_prices * 1.05 + np.random.normal(0, 5000, n)
    median_rent = 2200 + (trend * 0.002) + 200 * np.sin(2 * np.pi * dates.month / 12) + np.random.normal(0, 50, n)
    price_per_sqft = (median_prices / 1600) + np.random.normal(0, 5, n)
    
    # Supply and demand metrics
    inventory = 300 - 150 * (median_prices / 1400000) + 80 * np.cos(2 * np.pi * dates.month / 12) + np.random.normal(0, 15, n)
    inventory = np.clip(inventory, 25, 450)
    
    homes_sold = 120 + 40 * np.sin(2 * np.pi * dates.month / 12) - (inventory * 0.1) + np.random.normal(0, 10, n)
    homes_sold = np.clip(homes_sold, 10, 200)
    
    days_on_market = 45 - 25 * (median_prices / 1400000) - 10 * np.sin(2 * np.pi * dates.month / 12) + np.random.normal(0, 4, n)
    days_on_market = np.clip(days_on_market, 7, 90)
    
    new_listings = homes_sold * 1.1 + np.random.normal(0, 8, n)
    
    # Mortgage rates (simulated historical 30-year fixed)
    mortgage_rates = []
    for date in dates:
        if date < datetime(2020, 3, 1):
            rate = 3.8 + np.random.normal(0, 0.1)
        elif date < datetime(2022, 3, 1):
            rate = 2.9 + np.random.normal(0, 0.1)
        elif date < datetime(2023, 11, 1):
            rate = 6.8 + np.random.normal(0, 0.2)
        else:
            rate = 6.2 + np.random.normal(0, 0.15)
        mortgage_rates.append(rate)
        
    df = pd.DataFrame({
        "Date": dates,
        "Median_Home_Price": median_prices,
        "Average_Sale_Price": avg_sale_prices,
        "Median_Rent": median_rent,
        "Price_Per_SqFt": price_per_sqft,
        "Housing_Inventory": inventory,
        "Homes_Sold_Per_Month": homes_sold,
        "Days_on_Market": days_on_market,
        "New_Listings": new_listings,
        "Mortgage_Rate": mortgage_rates
    })
    
    # Calculate Affordability Index (100 is baseline, higher is more affordable)
    median_income = 142000 + (trend * 0.05) # Fremont median income growth
    monthly_income = median_income / 12
    # Standard mortgage payment formula
    r = (df["Mortgage_Rate"] / 100) / 12
    payment = df["Median_Home_Price"] * 0.8 * (r * (1 + r)**360) / (((1 + r)**360) - 1)
    df["Housing_Affordability_Index"] = (monthly_income * 0.25 / payment) * 100
    
    df.set_index("Date", inplace=True)
    return df

def generate_california_rental_data() -> pd.DataFrame:
    """Generate high-fidelity California rental prices data (2018-2026)"""
    dates = pd.date_range(start="2018-01-01", end="2026-06-01", freq="ME")
    n = len(dates)
    trend = np.linspace(0, 800, n)
    seasonality = 100 * np.sin(2 * np.pi * dates.month / 12)
    noise = np.random.normal(0, 20, n)
    
    # Locations
    sf_rent = 3100 + trend * 0.6 + seasonality * 1.2 - 250 * (dates >= "2020-03-01") + noise
    la_rent = 2200 + trend * 0.9 + seasonality + noise * 0.8
    sd_rent = 2000 + trend * 1.2 + seasonality * 0.9 + noise * 0.9
    sj_rent = 2800 + trend * 0.7 + seasonality * 1.1 - 150 * (dates >= "2020-03-01") + noise * 1.1
    state_avg = (sf_rent + la_rent + sd_rent + sj_rent) / 4
    
    df = pd.DataFrame({
        "Date": dates,
        "San_Francisco": sf_rent,
        "Los_Angeles": la_rent,
        "San_Diego": sd_rent,
        "San_Jose": sj_rent,
        "California_Average": state_avg
    })
    df.set_index("Date", inplace=True)
    return df

def generate_global_temp_data() -> pd.DataFrame:
    """Generate historical global temperature anomalies (1880-2026)"""
    dates = pd.date_range(start="1880-01-01", end="2026-06-01", freq="YE")
    n = len(dates)
    
    # Quadratic acceleration of warming starting from 1970
    anomaly = []
    for i, yr in enumerate(dates.year):
        if yr < 1940:
            val = -0.2 + np.random.normal(0, 0.08)
        elif yr < 1980:
            val = 0.0 + np.random.normal(0, 0.08)
        else:
            diff = yr - 1980
            val = 0.2 + 0.02 * diff + 0.0001 * (diff ** 2) + np.random.normal(0, 0.09)
        anomaly.append(val)
        
    df = pd.DataFrame({
        "Date": dates,
        "Temperature_Anomaly": anomaly,
        "5_Year_Moving_Average": pd.Series(anomaly).rolling(window=5, min_periods=1).mean().tolist(),
        "10_Year_Moving_Average": pd.Series(anomaly).rolling(window=10, min_periods=1).mean().tolist()
    })
    df.set_index("Date", inplace=True)
    return df

class DataService:
    def __init__(self):
        # Local cache directory
        self.cache_dir = "./data_cache"
        os.makedirs(self.cache_dir, exist_ok=True)
        
    def _get_cache_path(self, key: str) -> str:
        return os.path.join(self.cache_dir, f"{key}.csv")
        
    def _is_cache_valid(self, path: str, max_age_hours: int = 12) -> bool:
        if not os.path.exists(path):
            return False
        mtime = os.path.getmtime(path)
        age = datetime.now() - datetime.fromtimestamp(mtime)
        return age < timedelta(hours=max_age_hours)

    async def fetch_stock_data(self, ticker: str, period: str = "5y") -> pd.DataFrame:
        """Fetch stock market data using Yahoo Finance with caching."""
        cache_key = f"stock_{ticker}_{period}"
        cache_path = self._get_cache_path(cache_key)
        
        if self._is_cache_valid(cache_path):
            cached_df = pd.read_csv(cache_path)
            idx_col = "Date" if "Date" in cached_df.columns else "date" if "date" in cached_df.columns else cached_df.columns[0]
            cached_df.set_index(idx_col, inplace=True)
            cached_df.index = pd.to_datetime(cached_df.index, utc=True).tz_convert(None)
            return cached_df
            
        try:
            import yfinance as yf
            stock = yf.Ticker(ticker)
            df = stock.history(period=period)
            if df.empty:
                raise ValueError(f"No stock data found for ticker {ticker}")
                
            # Clean and add technical indicators
            df = df.reset_index()
            # Ensure index has Date name
            if "Date" not in df.columns and "index" in df.columns:
                df.rename(columns={"index": "Date"}, inplace=True)
            
            # Simple calculations
            df["Close_50_MA"] = df["Close"].rolling(window=50, min_periods=1).mean()
            df["Close_200_MA"] = df["Close"].rolling(window=200, min_periods=1).mean()
            df["Daily_Return"] = df["Close"].pct_change() * 100
            
            # RSI Indicator (14 day)
            delta = df["Close"].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14, min_periods=1).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14, min_periods=1).mean()
            rs = gain / (loss + 1e-10)
            df["RSI"] = 100 - (100 / (1 + rs))
            
            # MACD
            exp1 = df["Close"].ewm(span=12, adjust=False).mean()
            exp2 = df["Close"].ewm(span=26, adjust=False).mean()
            df["MACD"] = exp1 - exp2
            df["MACD_Signal"] = df["MACD"].ewm(span=9, adjust=False).mean()
            df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]
            
            # Bollinger Bands
            r_mean = df["Close"].rolling(window=20, min_periods=1).mean()
            r_std = df["Close"].rolling(window=20, min_periods=1).std()
            df["BB_Middle"] = r_mean
            df["BB_Upper"] = r_mean + (r_std * 2)
            df["BB_Lower"] = r_mean - (r_std * 2)
            
            # Cache the result
            df.to_csv(cache_path, index=False)
            df.set_index("Date", inplace=True)
            return df
        except Exception as e:
            # Fallback to dummy data if offline/failed
            print(f"Error fetching stock {ticker}: {e}. Generating high-fidelity mock stock.")
            return self._generate_mock_stock(ticker, period)

    def _generate_mock_stock(self, ticker: str, period: str) -> pd.DataFrame:
        periods_map = {"1y": 252, "2y": 504, "5y": 1260, "max": 2000}
        n = periods_map.get(period, 1260)
        dates = pd.date_range(end=datetime.now(), periods=n, freq="B")
        
        base_prices = {"TSLA": 200, "AAPL": 150, "NVDA": 80, "SPY": 400}
        bp = base_prices.get(ticker.upper(), 100)
        
        # Simulated Geometric Brownian Motion + shocks
        returns = np.random.normal(0.0005, 0.02, n)
        if ticker.upper() == "NVDA":
            returns += 0.002 # High growth
        elif ticker.upper() == "TSLA":
            returns += 0.0008
            returns[n//2:n//2+100] -= 0.015 # Volatility dip
            
        prices = bp * np.exp(np.cumsum(returns))
        volumes = np.random.normal(50000000, 15000000, n)
        volumes = np.clip(volumes, 10000000, 200000000)
        
        df = pd.DataFrame({
            "Date": dates,
            "Open": prices * (1 - 0.005 * np.random.rand(n)),
            "High": prices * (1 + 0.01 * np.random.rand(n)),
            "Low": prices * (1 - 0.01 * np.random.rand(n)),
            "Close": prices,
            "Volume": volumes
        })
        
        df["Close_50_MA"] = df["Close"].rolling(window=50, min_periods=1).mean()
        df["Close_200_MA"] = df["Close"].rolling(window=200, min_periods=1).mean()
        df["Daily_Return"] = df["Close"].pct_change() * 100
        df["RSI"] = 50 + 20 * np.sin(np.linspace(0, 10 * np.pi, n)) + np.random.normal(0, 5, n)
        df["RSI"] = np.clip(df["RSI"], 10, 90)
        
        df["MACD"] = np.sin(np.linspace(0, 20 * np.pi, n)) * 2
        df["MACD_Signal"] = df["MACD"].rolling(window=9, min_periods=1).mean()
        df["MACD_Hist"] = df["MACD"] - df["MACD_Signal"]
        
        r_mean = df["Close"].rolling(window=20, min_periods=1).mean()
        r_std = df["Close"].rolling(window=20, min_periods=1).std().fillna(5)
        df["BB_Middle"] = r_mean
        df["BB_Upper"] = r_mean + (r_std * 2)
        df["BB_Lower"] = r_mean - (r_std * 2)
        
        df.set_index("Date", inplace=True)
        return df

    async def fetch_worldbank_data(self, indicator: str, country: str = "US") -> pd.DataFrame:
        """Fetch macroeconomic indicators from the World Bank API."""
        cache_key = f"wb_{country}_{indicator}"
        cache_path = self._get_cache_path(cache_key)
        
        if self._is_cache_valid(cache_path, max_age_hours=72): # Economic data changes slowly
            return pd.read_csv(cache_path, index_col=0, parse_dates=True)
            
        url = f"http://api.worldbank.org/v2/country/{country}/indicator/{indicator}?format=json&per_page=100"
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0, follow_redirects=True)
                if response.status_code != 200:
                    raise Exception(f"World Bank API error: {response.status_code}")
                
                data = response.json()
                if len(data) < 2 or not data[1]:
                    raise Exception("Invalid response structure from World Bank")
                
                records = data[1]
                rows = []
                for rec in records:
                    val = rec["value"]
                    date_str = rec["date"]
                    if val is not None and date_str:
                        # World bank yields annual strings, e.g. "2020"
                        dt = datetime(int(date_str), 12, 31)
                        rows.append({"Date": dt, "Value": float(val)})
                        
                df = pd.DataFrame(rows)
                df.sort_values("Date", inplace=True)
                df.to_csv(cache_path, index=False)
                df.set_index("Date", inplace=True)
                return df
        except Exception as e:
            print(f"Error fetching World Bank indicator {indicator}: {e}. Generating mock.")
            # Fallback values for common indicators
            return self._generate_mock_macro(indicator)

    def _generate_mock_macro(self, indicator: str) -> pd.DataFrame:
        dates = pd.date_range(start="1980-12-31", end="2025-12-31", freq="YE")
        n = len(dates)
        
        # Set values based on indicator
        if "NY.GDP.MKTP.CD" in indicator: # Nominal GDP
            # Grow from 3 trillion to 27 trillion
            values = 3.0e12 * np.exp(np.linspace(0, 2.2, n)) + np.random.normal(0, 1.0e11, n)
        elif "FP.CPI.TOTL.ZG" in indicator: # Inflation
            # Fluctuate between 1.5% and 13% (1980s inflation)
            values = 3.0 + 5.0 * np.exp(-np.linspace(0, 4, n)) + np.random.normal(2.0, 1.0, n)
            # Add recent inflation shock (2021-2023)
            values[-5:] = [1.2, 4.7, 8.0, 4.1, 3.1]
        elif "SL.UEM.TOTL.ZS" in indicator: # Unemployment
            values = 6.0 + 2.0 * np.sin(np.linspace(0, 4 * np.pi, n)) + np.random.normal(0, 0.8, n)
            # Make sure no negative values
            values = np.clip(values, 3.0, 11.0)
            values[-6:] = [3.9, 8.1, 5.3, 3.6, 3.8, 4.0] # Covid spike and recovery
        else:
            values = 100.0 + np.linspace(0, 50, n) + np.random.normal(0, 5, n)
            
        df = pd.DataFrame({"Date": dates, "Value": values})
        df.set_index("Date", inplace=True)
        return df

    def clean_uploaded_data(self, file_content: bytes, filename: str) -> pd.DataFrame:
        """Parse and clean an uploaded CSV/Excel/JSON file."""
        ext = os.path.splitext(filename)[1].lower()
        
        if ext == '.csv':
            from io import BytesIO
            df = pd.read_csv(BytesIO(file_content))
        elif ext in ['.xls', '.xlsx']:
            from io import BytesIO
            df = pd.read_excel(BytesIO(file_content))
        elif ext == '.json':
            from io import BytesIO
            df = pd.read_json(BytesIO(file_content))
        else:
            raise ValueError("Unsupported file format. Please upload CSV, Excel, or JSON.")
            
        # AUTOMATED CLEANING ROUTINE
        # 1. Standardize columns (strip spaces, replace characters)
        df.columns = [str(c).strip().replace(" ", "_").replace("(", "").replace(")", "") for c in df.columns]
        
        # 2. Try to identify Date/Timestamp columns
        date_col = None
        for col in df.columns:
            col_lower = col.lower()
            if "date" in col_lower or "time" in col_lower or "timestamp" in col_lower:
                try:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                    if df[col].notna().sum() > len(df) * 0.5: # At least 50% parsed successfully
                        date_col = col
                        break
                except:
                    pass
                    
        # If no Date column found, check first column for dates
        if not date_col and len(df) > 0:
            try:
                first_col = df.columns[0]
                converted = pd.to_datetime(df[first_col], errors='coerce')
                if converted.notna().sum() > len(df) * 0.6:
                    df[first_col] = converted
                    date_col = first_col
            except:
                pass
                
        # 3. Clean numeric columns (coerce to float/int, remove commas, etc.)
        for col in df.columns:
            if col == date_col:
                continue
            # If string type, try cleaning currency symbols, commas, and parsing
            if df[col].dtype == object:
                try:
                    # Strip spaces, commas, dollar signs, percent signs
                    cleaned = df[col].astype(str).str.replace(r'[$,%]', '', regex=True).str.strip()
                    numeric_conv = pd.to_numeric(cleaned, errors='coerce')
                    if numeric_conv.notna().sum() > len(df) * 0.7:
                        df[col] = numeric_conv
                except:
                    pass

        # 4. Handle NaNs
        # Fill numeric NaNs with interpolation or forward/backward fill
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        df[numeric_cols] = df[numeric_cols].interpolate(method='linear', limit_direction='both')
        # If any NaNs remain, fill with 0
        df[numeric_cols] = df[numeric_cols].fillna(0)
        
        # Categorical columns: fill NaNs with "Unknown"
        cat_cols = df.select_dtypes(exclude=[np.number, 'datetime64[ns]']).columns
        df[cat_cols] = df[cat_cols].fillna("Unknown")
        
        # 5. Set Date index if found
        if date_col:
            df.sort_values(date_col, inplace=True)
            df = df.dropna(subset=[date_col])
            df.set_index(date_col, inplace=True)
            # Remove duplicate indices
            df = df[~df.index.duplicated(keep='first')]
        else:
            # Create a mock daily date index if none exists
            df.index = pd.date_range(start="2020-01-01", periods=len(df), freq="D")
            df.index.name = "Date"
            
        return df

    async def get_dataset(self, dataset_id: str, period: str = "5y") -> Dict[str, Any]:
        """Fetch a dataset from our catalog and return a clean payload."""
        dataset_id = dataset_id.upper()
        
        if dataset_id in ["BTC-USD", "ETH-USD"] or dataset_id.endswith("-USD"):
            df = await self.fetch_stock_data(dataset_id, period)
            title = f"{dataset_id.split('-')[0]} Cryptocurrency"
            source = "Yahoo Finance"
            category = "Crypto"
        elif len(dataset_id.split('_')) == 2 and dataset_id.split('_')[1] in ["GDP", "INFLATION", "UNEMPLOYMENT"]:
            parts = dataset_id.split('_')
            country_code = parts[0].lower()
            indicator_type = parts[1]
            
            indicator_map = {
                "GDP": "NY.GDP.MKTP.CD",
                "INFLATION": "FP.CPI.TOTL.ZG",
                "UNEMPLOYMENT": "SL.UEM.TOTL.ZS"
            }
            indicator = indicator_map[indicator_type]
            
            df = await self.fetch_worldbank_data(indicator, country_code)
            
            country_names = {
                "in": "India", "cn": "China", "gb": "United Kingdom", "jp": "Japan", 
                "de": "Germany", "fr": "France", "ca": "Canada", "au": "Australia", 
                "br": "Brazil", "za": "South Africa", "ru": "Russia", "us": "United States",
                "eu": "Euro Area", "wld": "World"
            }
            country_display = country_names.get(country_code, country_code.upper())
            
            title_map = {
                "GDP": f"{country_display} Gross Domestic Product GDP",
                "INFLATION": f"{country_display} Inflation Rate Annual %",
                "UNEMPLOYMENT": f"{country_display} Unemployment Rate"
            }
            title = title_map[indicator_type]
            source = "World Bank"
            category = "Economics"
        elif dataset_id in ["TSLA", "AAPL", "NVDA", "SPY"] or "." in dataset_id or dataset_id.startswith("^") or len(dataset_id) <= 6:
            df = await self.fetch_stock_data(dataset_id, period)
            if dataset_id.endswith(".NS"):
                title = f"{dataset_id.replace('.NS', '')} (NSE India) Stock"
            elif dataset_id.endswith(".BO"):
                title = f"{dataset_id.replace('.BO', '')} (BSE India) Stock"
            elif dataset_id.startswith("^"):
                title = f"{dataset_id.replace('^', '')} Market Index"
            else:
                title = f"{dataset_id} Stock Market Data"
            source = "Yahoo Finance"
            category = "Financials"
        elif dataset_id == "FREMONT_HOUSING":
            df = generate_fremont_housing_data()
            title = "Fremont Housing Market Trends"
            source = "Local Real Estate Index"
            category = "Real Estate"
        elif dataset_id == "CALIFORNIA_RENT":
            df = generate_california_rental_data()
            title = "California Rental Prices Index"
            source = "State Housing Database"
            category = "Real Estate"
        elif dataset_id == "GLOBAL_TEMP":
            df = generate_global_temp_data()
            title = "Global Land-Ocean Temperature Anomalies"
            source = "NASA / NOAA"
            category = "Climate"
        else:
            # Look for cached uploaded files
            upload_path = os.path.join(self.cache_dir, f"upload_{dataset_id}.csv")
            if os.path.exists(upload_path):
                df = pd.read_csv(upload_path, index_col=0, parse_dates=True)
                title = f"Uploaded Dataset: {dataset_id}"
                source = "User Upload"
                category = "Custom"
            else:
                raise ValueError(f"Dataset {dataset_id} not found")
                
        # Format the data for JSON serialization (timestamp strings)
        records = []
        for index, row in df.iterrows():
            rec = {"date": index.strftime("%Y-%m-%d") if hasattr(index, "strftime") else str(index)}
            for col in df.columns:
                val = row[col]
                # Convert np.nan/inf to None for JSON compliance
                if pd.isna(val) or np.isinf(val):
                    rec[col] = None
                else:
                    rec[col] = float(val) if isinstance(val, (np.floating, float)) else int(val) if isinstance(val, (np.integer, int)) else val
            records.append(rec)
            
        columns = list(df.columns)
        
        return {
            "dataset_id": dataset_id,
            "title": title,
            "source": source,
            "category": category,
            "columns": columns,
            "data": records,
            "length": len(df)
        }

    async def worldbank_data_indicator(self, indicator: str) -> pd.DataFrame:
        """Helper to get indicators."""
        return await self.fetch_worldbank_data(indicator, "US")
