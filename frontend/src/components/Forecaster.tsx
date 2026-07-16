import React, { useState, useEffect } from "react";
import ReactApexChart from "react-apexcharts";
import { BrainCircuit, Play, Info } from "lucide-react";

interface ForecasterProps {
  datasetMeta: {
    dataset_id: string;
    title: string;
    columns: string[];
  };
  rawData: any[];
}

export const Forecaster: React.FC<ForecasterProps> = ({ datasetMeta, rawData }) => {
  const [selectedColumn, setSelectedColumn] = useState("");
  const [modelType, setModelType] = useState("prophet");
  const [steps, setSteps] = useState(30);
  const [forecastResult, setForecastResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  // Auto-select column
  useEffect(() => {
    if (datasetMeta.columns.length > 0) {
      const cols = datasetMeta.columns;
      if (cols.includes("Close")) setSelectedColumn("Close");
      else if (cols.includes("Median_Home_Price")) setSelectedColumn("Median_Home_Price");
      else if (cols.includes("Value")) setSelectedColumn("Value");
      else {
        const firstNumeric = cols.find(c => c !== "date" && c !== "Date" && c !== "id" && c !== "index");
        setSelectedColumn(firstNumeric || cols[0]);
      }
    }
  }, [datasetMeta]);

  const handleRunForecast = async () => {
    if (!selectedColumn || rawData.length === 0) return;
    setRunning(true);

    try {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: rawData,
          column: selectedColumn,
          model_type: modelType,
          steps: steps
        })
      });
      
      if (!response.ok) throw new Error("Forecast failed");
      const data = await response.json();
      setForecastResult(data);
    } catch (err) {
      console.error(err);
      alert("Failed to compute machine learning forecast.");
    } finally {
      setRunning(false);
    }
  };

  // Run forecast automatically on load or when parameters change
  useEffect(() => {
    if (selectedColumn) {
      handleRunForecast();
    }
  }, [selectedColumn, modelType]);

  const getChartOptionsAndSeries = () => {
    if (!forecastResult) return { series: [], options: {} };

    const hist = forecastResult.historical_data;
    const fore = forecastResult.forecast_data;
    
    // Combine dates
    const allDates = [...hist.map((h: any) => h.date), ...fore.map((f: any) => f.date)];
    
    // Construct series data
    const histPoints = hist.map((h: any) => h.value);
    
    // Pad forecast with nulls for historical length so they overlay correctly
    const forePoints = [...new Array(hist.length).fill(null), ...fore.map((f: any) => f.value)];
    const lowerBounds = [...new Array(hist.length).fill(null), ...fore.map((f: any) => f.lower_bound)];
    const upperBounds = [...new Array(hist.length).fill(null), ...fore.map((f: any) => f.upper_bound)];

    const series = [
      { name: "Historical Actuals", type: "line", data: histPoints },
      { name: "Forecast Projection", type: "line", data: forePoints },
      { name: "Lower Bound (95% CI)", type: "line", data: lowerBounds },
      { name: "Upper Bound (95% CI)", type: "line", data: upperBounds }
    ];

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    const options = {
      chart: {
        background: "transparent",
        fontFamily: "var(--font-body)",
        toolbar: { show: true },
        zoom: { enabled: true }
      },
      // Styling bounds as dashed, forecast as solid, actuals as thick solid
      stroke: {
        width: [3, 3, 1.5, 1.5],
        dashArray: [0, 0, 4, 4]
      },
      colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#ec4899"], // Forecast is Purple, bounds are pink/dashed
      theme: { mode: isDark ? ("dark" as const) : ("light" as const) },
      grid: { borderColor: "var(--border-color)", strokeDashArray: 3 },
      xaxis: {
        categories: allDates,
        type: "category" as const,
        labels: {
          style: { colors: "var(--text-secondary)", fontSize: "10px" },
          rotate: -45,
          trim: true
        },
        tickAmount: Math.min(20, allDates.length)
      },
      yaxis: {
        labels: {
          style: { colors: "var(--text-secondary)", fontSize: "11px" },
          formatter: (value: number) => {
            if (value === null || isNaN(value)) return "";
            return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
          }
        }
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        x: { show: true },
        y: { formatter: (val: number) => val ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "" }
      }
    };

    return { series, options };
  };

  const { series, options } = getChartOptionsAndSeries();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-slide-up">
      
      {/* Parameter Selection Cards */}
      <div className="glass-card" style={{ padding: "1.25rem", backgroundColor: "var(--bg-secondary)", display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Target Variable:</span>
          <select
            className="form-input"
            style={{ width: "160px", height: "36px", padding: "0 0.5rem" }}
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
          >
            {datasetMeta.columns.filter(c => c !== "date" && c !== "Date").map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>ML Model:</span>
          <select
            className="form-input"
            style={{ width: "180px", height: "36px", padding: "0 0.5rem" }}
            value={modelType}
            onChange={(e) => setModelType(e.target.value)}
          >
            <option value="prophet">🔮 Additive Fourier (Prophet-like)</option>
            <option value="arima">📈 Autoregressive (ARIMA)</option>
            <option value="exponential">📉 Exponential Smoothing</option>
            <option value="random_forest">🌲 Ensemble Random Forest</option>
            <option value="linear">📏 Linear Projection</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Steps Ahead:</span>
          <input
            type="number"
            className="form-input"
            style={{ width: "80px", height: "36px", textAlign: "center" }}
            value={steps}
            onChange={(e) => setSteps(Math.max(1, parseInt(e.target.value) || 30))}
          />
        </div>

        <button
          onClick={handleRunForecast}
          className="btn btn-primary"
          style={{ padding: "0.45rem 1.2rem", height: "36px" }}
          disabled={running}
        >
          <Play size={14} /> {running ? "Calculating..." : "Run Forecast"}
        </button>

      </div>

      {/* Main Grid */}
      <div className="grid-2" style={{ gridTemplateColumns: "3fr 1fr", gap: "1.5rem" }}>
        
        {/* Plot Card */}
        <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", minHeight: "420px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: "1.25rem" }}>Predictive Projection Chart</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>Shaded bounds indicate the 95% confidence interval</p>
            </div>
            
            {forecastResult && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.75rem", borderRadius: "15px", backgroundColor: "var(--bg-accent)", border: "1px solid var(--border-color)" }}>
                <BrainCircuit size={14} style={{ color: "var(--color-primary)" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Model Confidence: {forecastResult.model_confidence.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            {forecastResult ? (
              <ReactApexChart options={options as any} series={series} type="line" height={360} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "360px", color: "var(--text-muted)" }}>
                Initializing forecasting tensors...
              </div>
            )}
          </div>
        </div>

        {/* Forecast Metrics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", padding: "1.25rem" }}>
            <h4 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
              Back-Testing Metrics
            </h4>
            
            {forecastResult && forecastResult.backtest_metrics ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>MAPE (Mean Absolute % Error):</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    {forecastResult.backtest_metrics.mape.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>Lower is better. &lt;10% is excellent.</span>
                </div>
                
                <hr style={{ border: "none", borderTop: "1px solid var(--border-color)" }} />
                
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Root Mean Squared Error (RMSE):</span>
                  <span style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {forecastResult.backtest_metrics.rmse.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--border-color)" }} />
                
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>R² Coefficient of Determination:</span>
                  <span style={{ fontSize: "1.2rem", fontWeight: 600, color: forecastResult.backtest_metrics.r_squared > 0.5 ? "var(--color-success)" : "var(--text-secondary)" }}>
                    {forecastResult.backtest_metrics.r_squared.toFixed(3)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>Pending results...</div>
            )}
          </div>

          <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h4 style={{ fontSize: "1.0rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Info size={16} style={{ color: "var(--color-primary)" }} /> Model Insights
            </h4>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              All models undergo automatic backtesting using an 80/20 train/test split. Confidence levels denote how accurately the model captured historical curves.
            </p>
          </div>

        </div>

      </div>

      {/* Explanatory insights cards */}
      {forecastResult && forecastResult.explanation && (
        <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", borderLeft: "4px solid var(--color-secondary)" }}>
          <h3 style={{ fontSize: "1.15rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            🧠 Forecast Rationale & Technical Scope
          </h3>
          
          <div className="grid-2" style={{ gap: "1.5rem" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>PREDICTION METHODOLOGY:</p>
              <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", marginBottom: "0.75rem" }}>{forecastResult.explanation.reasoning}</p>
              
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>INFLUENTIAL PARAMETERS:</p>
              <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                {forecastResult.explanation.variables_influenced.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
            
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>ASSUMPTIONS:</p>
              <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                {forecastResult.explanation.assumptions.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>

              <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>LIMITATIONS:</p>
              <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                {forecastResult.explanation.limitations.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
