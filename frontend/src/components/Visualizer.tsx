import React, { useState, useEffect } from "react";
import ReactApexChart from "react-apexcharts";
import { Layers, AlertTriangle } from "lucide-react";

interface VisualizerProps {
  datasetMeta: {
    dataset_id: string;
    title: string;
    source: string;
    category: string;
    columns: string[];
  };
  rawData: any[];
  onWidgetPinned?: (widgetConfig: any) => void;
}

export const Visualizer: React.FC<VisualizerProps> = ({ datasetMeta, rawData, onWidgetPinned }) => {
  const [selectedColumn, setSelectedColumn] = useState("");
  const [chartType, setChartType] = useState<"line" | "area" | "bar" | "scatter" | "candlestick" | "correlation" | "box" | "histogram">("line");
  const [showMA, setShowMA] = useState({ ma20: false, ma50: false, ma200: false });
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [themeColor, setThemeColor] = useState("#3b82f6"); // Blue primary default
  
  const colorsList = [
    { name: "Blue Glow", hex: "#3b82f6" },
    { name: "Neon Emerald", hex: "#10b981" },
    { name: "Cyber Purple", hex: "#8b5cf6" },
    { name: "Sunset Orange", hex: "#f59e0b" },
    { name: "Rose Crimson", hex: "#ef4444" }
  ];

  // Auto-select primary column
  useEffect(() => {
    if (datasetMeta.columns.length > 0) {
      // Prefer Close, then Median_Home_Price, then Value, then first column
      const cols = datasetMeta.columns;
      if (cols.includes("Close")) setSelectedColumn("Close");
      else if (cols.includes("Median_Home_Price")) setSelectedColumn("Median_Home_Price");
      else if (cols.includes("Value")) setSelectedColumn("Value");
      else if (cols.includes("California_Average")) setSelectedColumn("California_Average");
      else {
        // Find first float/int column
        const firstNumeric = cols.find(c => c !== "date" && c !== "Date" && c !== "id" && c !== "index");
        setSelectedColumn(firstNumeric || cols[0]);
      }
    }
  }, [datasetMeta]);

  // Adjust chart types based on columns
  useEffect(() => {
    if (datasetMeta.columns.includes("Open") && datasetMeta.columns.includes("Close")) {
      setChartType("candlestick");
    } else {
      setChartType("line");
    }
  }, [datasetMeta]);

  // Fetch statistical analytics and AI insights when column changes
  useEffect(() => {
    if (!selectedColumn || rawData.length === 0) return;

    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const anaRes = await fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: rawData, column: selectedColumn })
        });
        const anaData = await anaRes.json();
        setAnalytics(anaData);

        // Fetch AI Insights based on stats
        const aiRes = await fetch("/api/ai/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meta: datasetMeta, analytics: anaData })
        });
        const aiData = await aiRes.json();
        setAiInsights(aiData);
      } catch (err) {
        console.error("Error loading analytics/AI insights", err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [selectedColumn, rawData, datasetMeta]);

  // Downloads handlers
  const handleExport = async (format: "csv" | "excel" | "google") => {
    if (format === "google") {
      if (rawData.length === 0) return;
      try {
        const headers = Object.keys(rawData[0]);
        const tsvLines = [headers.join("\t")];
        
        rawData.forEach(row => {
          const line = headers.map(h => {
            const val = row[h];
            return val === null || val === undefined ? "" : String(val);
          });
          tsvLines.push(line.join("\t"));
        });
        
        const tsvContent = tsvLines.join("\n");
        
        let copied = false;
        // 1. Try Navigator Clipboard API
        try {
          await navigator.clipboard.writeText(tsvContent);
          copied = true;
        } catch (clipErr) {
          console.warn("Navigator clipboard copy blocked, attempting fallback:", clipErr);
        }
        
        // 2. Try HTML Textarea selection fallback
        if (!copied) {
          const textArea = document.createElement("textarea");
          textArea.value = tsvContent;
          textArea.style.position = "fixed";
          textArea.style.top = "0";
          textArea.style.left = "0";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand("copy");
            copied = true;
          } catch (execErr) {
            console.error("Fallback execCommand copy failed:", execErr);
          }
          document.body.removeChild(textArea);
        }
        
        // Open blank Google Sheets creation page
        window.open("https://docs.google.com/spreadsheets/u/0/create", "_blank");
        
        if (copied) {
          alert("📋 DATA COPIED SUCCESSFULLY!\n\nWe have copied the dataset in spreadsheet-cell format to your clipboard and opened Google Sheets in a new tab.\n\n👉 ACTION REQUIRED:\nSelect cell A1 in the new Google Sheet, and press Ctrl+V (or Cmd+V) on your keyboard to paste the data instantly!");
        } else {
          // 3. Fallback prompt if all clipboard methods fail
          window.prompt(
            "Copying was blocked by your browser. Please copy the highlighted text below manually (Ctrl+C), then paste it (Ctrl+V) into cell A1 in the new Google Sheets tab:",
            tsvContent
          );
        }
        return;
      } catch (err) {
        console.error("Export to Google Sheets failed:", err);
        alert("Failed to export data to Google Sheets.");
        return;
      }
    }

    let url = "";
    let bodyData: any = null;
    
    if (format === "csv") {
      url = "/api/reports/csv";
      bodyData = rawData;
    } else if (format === "excel") {
      url = "/api/reports/excel";
      bodyData = rawData;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      const ext = format === "excel" ? "xlsx" : "csv";
      link.download = `Export_${datasetMeta.dataset_id}_${selectedColumn}.${ext}`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("Failed to export report files.");
    }
  };

  // Build series for ApexCharts
  const getChartData = () => {
    if (rawData.length === 0) return { series: [], options: {} };

    const dates = rawData.map(r => r.date);
    
    if (chartType === "candlestick" && datasetMeta.columns.includes("Open") && datasetMeta.columns.includes("Close")) {
      const candleSeries = [{
        name: "Candlestick",
        data: rawData.map(r => ({
          x: r.date,
          y: [r.Open, r.High, r.Low, r.Close]
        }))
      }];
      
      const options = getBaseOptions(dates);
      return { series: candleSeries, options };
    }
    
    if (chartType === "correlation" && analytics && analytics.correlations) {
      // Build matrix data for heatmap
      const cols = datasetMeta.columns.filter(c => c !== "date");
      const seriesData: any[] = [];
      
      cols.forEach(c1 => {
        const rowData = cols.map(c2 => {
          if (c1 === c2) return { x: c2, y: 1.0 };
          const corr = analytics.correlations.find(
            (cr: any) => (cr.var1 === c1 && cr.var2 === c2) || (cr.var1 === c2 && cr.var2 === c1)
          );
          return { x: c2, y: corr ? corr.value : 0.0 };
        });
        seriesData.push({ name: c1, data: rowData });
      });

      const options = {
        chart: {
          type: "heatmap" as const,
          background: "transparent",
          toolbar: { show: false }
        },
        theme: { mode: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light" },
        dataLabels: { enabled: true, style: { colors: ["#fff"] } },
        colors: [themeColor],
        title: { text: "Pearson Correlation Coefficient Matrix", style: { fontFamily: "var(--font-header)", color: "var(--text-primary)" } }
      };

      return { series: seriesData, options };
    }

    if (chartType === "histogram") {
      const values = rawData.map(r => r[selectedColumn]).filter(v => v !== null);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const bins = 15;
      const step = (max - min) / bins;
      
      const binCounts = new Array(bins).fill(0);
      const binLabels = [];
      
      for (let i = 0; i < bins; i++) {
        const lower = min + i * step;
        const upper = lower + step;
        binLabels.push(`${lower.toFixed(1)}-${upper.toFixed(1)}`);
      }
      
      values.forEach(v => {
        const binIndex = Math.min(Math.floor((v - min) / step), bins - 1);
        binCounts[binIndex]++;
      });

      const series = [{ name: "Frequency Count", data: binCounts }];
      const options = {
        chart: { type: "bar" as const, background: "transparent", toolbar: { show: false } },
        xaxis: { categories: binLabels, labels: { style: { colors: "var(--text-secondary)" } } },
        yaxis: { labels: { style: { colors: "var(--text-secondary)" } } },
        colors: [themeColor],
        plotOptions: { bar: { borderRadius: 4, horizontal: false } }
      };
      
      return { series, options };
    }

    if (chartType === "box") {
      const values = rawData.map(r => r[selectedColumn]).filter(v => v !== null).sort((a,b) => a-b);
      const q1 = values[Math.floor(values.length * 0.25)];
      const median = values[Math.floor(values.length * 0.5)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const min = values[0];
      const max = values[values.length - 1];

      const series = [{
        name: selectedColumn,
        data: [{
          x: selectedColumn,
          y: [min, q1, median, q3, max]
        }]
      }];

      const options = {
        chart: { type: "boxPlot" as const, background: "transparent" },
        colors: [themeColor],
        yaxis: { labels: { style: { colors: "var(--text-secondary)" } } },
        xaxis: { labels: { style: { colors: "var(--text-secondary)" } } }
      };
      
      return { series, options };
    }

    // Default: Line, Area, Bar, Scatter
    const mainSeries = [{
      name: selectedColumn,
      type: chartType,
      data: rawData.map(r => r[selectedColumn])
    }];

    // Adding Moving Averages
    if (showMA.ma20 && rawData.length > 20) {
      const maData = calculateMA(rawData.map(r => r[selectedColumn]), 20);
      mainSeries.push({ name: "20-Day MA", type: "line", data: maData });
    }
    if (showMA.ma50 && rawData.length > 50) {
      const maData = calculateMA(rawData.map(r => r[selectedColumn]), 50);
      mainSeries.push({ name: "50-Day MA", type: "line", data: maData });
    }
    if (showMA.ma200 && rawData.length > 200) {
      const maData = calculateMA(rawData.map(r => r[selectedColumn]), 200);
      mainSeries.push({ name: "200-Day MA", type: "line", data: maData });
    }

    // Add Linear Trend Line
    if (showTrendLine && analytics && analytics.trend) {
      const slope = analytics.trend.slope;
      const startVal = rawData[0][selectedColumn];
      const trendData = rawData.map((_, idx) => startVal + idx * slope);
      mainSeries.push({ name: "Linear Trend Line", type: "line", data: trendData });
    }

    const options = getBaseOptions(dates);
    return { series: mainSeries, options };
  };

  const calculateMA = (data: number[], windowSize: number) => {
    const ma: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < windowSize - 1) {
        ma.push(null);
      } else {
        const sum = data.slice(i - windowSize + 1, i + 1).reduce((acc, val) => acc + val, 0);
        ma.push(parseFloat((sum / windowSize).toFixed(3)));
      }
    }
    return ma;
  };

  const getBaseOptions = (dates: string[]) => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    
    // Add Anomaly Annotations
    const annotations: any = { x: [] };
    if (analytics && analytics.anomalies) {
      analytics.anomalies.forEach((a: any) => {
        annotations.x.push({
          x: a.date,
          borderColor: "#ef4444",
          strokeDashArray: 4,
          label: {
            borderColor: "#ef4444",
            style: { color: "#fff", background: "#ef4444", fontSize: "10px" },
            text: a.type === "spike" ? "⚠️ Anomaly (Spike)" : "⚠️ Anomaly (Drop)"
          }
        });
      });
    }

    return {
      chart: {
        background: "transparent",
        fontFamily: "var(--font-body)",
        toolbar: { show: true, tools: { download: true, selection: true, zoom: true, pan: true, reset: true } },
        animations: { enabled: true, easing: "easeinout" as const, speed: 800 }
      },
      annotations: annotations,
      stroke: { width: chartType === "line" || chartType === "area" ? [3, 2, 2, 2, 2] : [0], curve: "smooth" as const },
      colors: [themeColor, "#a7f3d0", "#8b5cf6", "#ec4899", "#d97706"],
      fill: {
        type: chartType === "area" ? "gradient" : "solid",
        gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 95] }
      },
      grid: { borderColor: "var(--border-color)", strokeDashArray: 3 },
      theme: { mode: isDark ? ("dark" as const) : ("light" as const) },
      xaxis: {
        categories: dates,
        type: "category" as const,
        labels: { show: true, style: { colors: "var(--text-secondary)", fontSize: "11px" }, rotate: -45 },
        axisBorder: { color: "var(--border-color)" },
        axisTicks: { color: "var(--border-color)" }
      },
      yaxis: {
        labels: {
          style: { colors: "var(--text-secondary)", fontSize: "11px" },
          formatter: (value: number) => {
            if (value === null) return "";
            if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
            if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
            if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
            return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
          }
        }
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        x: { show: true },
        y: { formatter: (val: number) => val ? val.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "" }
      }
    };
  };

  const { series, options } = getChartData();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-slide-up">
      {/* Controls Bar */}
      <div className="glass-card" style={{ padding: "1rem", backgroundColor: "var(--bg-secondary)", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        
        {/* Variable Selector */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Analyze Column:</span>
          <select
            className="form-input"
            style={{ width: "180px", height: "36px", padding: "0 0.5rem" }}
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
          >
            {datasetMeta.columns.filter(c => c !== "date" && c !== "Date").map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Chart Type Toggles */}
        <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "var(--bg-tertiary)", padding: "0.25rem", borderRadius: "8px" }}>
          {["line", "area", "bar", "candlestick", "histogram", "box", "correlation"].map((type) => {
            const isCandleMatch = type === "candlestick" && (!datasetMeta.columns.includes("Open") || !datasetMeta.columns.includes("Close"));
            if (isCandleMatch) return null;
            
            return (
              <button
                key={type}
                onClick={() => setChartType(type as any)}
                className="btn"
                style={{
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.75rem",
                  borderRadius: "6px",
                  backgroundColor: chartType === type ? "var(--bg-secondary)" : "transparent",
                  color: chartType === type ? "var(--text-primary)" : "var(--text-secondary)",
                  border: "none",
                  boxShadow: chartType === type ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Theme Color Picker */}
        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
          {colorsList.map((col) => (
            <button
              key={col.hex}
              onClick={() => setThemeColor(col.hex)}
              title={col.name}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                backgroundColor: col.hex,
                border: themeColor === col.hex ? "2px solid var(--text-primary)" : "1px solid transparent",
                cursor: "pointer",
                padding: 0
              }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => handleExport("google")} className="btn btn-primary" style={{ padding: "0.45rem 0.9rem", fontSize: "0.825rem" }}>
            <Layers size={14} /> Google Sheets
          </button>
          <button onClick={() => handleExport("excel")} className="btn btn-secondary" style={{ padding: "0.45rem 0.9rem", fontSize: "0.825rem" }}>
            <Layers size={14} /> Excel
          </button>
          <button onClick={() => handleExport("csv")} className="btn btn-secondary" style={{ padding: "0.45rem 0.9rem", fontSize: "0.825rem" }}>
            CSV
          </button>
          {onWidgetPinned && (
            <button
              onClick={() => onWidgetPinned({
                dataset_id: datasetMeta.dataset_id,
                column: selectedColumn,
                chart_type: chartType,
                title: `${datasetMeta.title} - ${selectedColumn}`
              })}
              className="btn btn-secondary"
              style={{ padding: "0.45rem 0.9rem", fontSize: "0.825rem", borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
            >
              Pin Widget
            </button>
          )}
        </div>

      </div>

      {/* Main Panel */}
      <div className="grid-2" style={{ gridTemplateColumns: "3fr 1fr", gap: "1.5rem" }}>
        
        {/* Visual Chart Card */}
        <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", minHeight: "420px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <h3 style={{ color: "var(--text-primary)", fontSize: "1.2rem" }}>{datasetMeta.title} ({selectedColumn})</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>Time-series visualization with annotations</p>
            </div>
            
            {/* Chart Overlays checkboxes */}
            {chartType !== "correlation" && chartType !== "box" && chartType !== "histogram" && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={showMA.ma20} onChange={(e) => setShowMA({ ...showMA, ma20: e.target.checked })} />
                  20 MA
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={showMA.ma50} onChange={(e) => setShowMA({ ...showMA, ma50: e.target.checked })} />
                  50 MA
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={showMA.ma200} onChange={(e) => setShowMA({ ...showMA, ma200: e.target.checked })} />
                  200 MA
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={showTrendLine} onChange={(e) => setShowTrendLine(e.target.checked)} />
                  Trend Line
                </label>
              </div>
            )}
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            {series.length > 0 ? (
              <ReactApexChart options={options as any} series={series} type={chartType === "correlation" ? "heatmap" : chartType === "box" ? "boxPlot" : "line"} height={360} />
            ) : (
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate( -50%, -50% )", color: "var(--text-muted)" }}>
                Generating visual parameters...
              </div>
            )}
          </div>
        </div>

        {/* Statistical Summary Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          
          {/* Numeric Indicators */}
          <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", padding: "1.25rem" }}>
            <h4 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>Summary Metrics</h4>
            {loadingAnalytics ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", padding: "1rem 0" }}>Recalculating statistics...</div>
            ) : analytics && analytics.statistics ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Latest Reading:</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{analytics.statistics.last_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Average (Mean):</span>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{analytics.statistics.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Volatility (SD):</span>
                  <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{analytics.statistics.std.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {analytics.statistics.cagr !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>CAGR Growth:</span>
                    <span style={{ fontWeight: 600, color: "var(--color-success)" }}>{analytics.statistics.cagr.toFixed(2)}%</span>
                  </div>
                )}
                {analytics.statistics.max_drawdown !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Max Drawdown:</span>
                    <span style={{ fontWeight: 600, color: "var(--color-danger)" }}>{analytics.statistics.max_drawdown.toFixed(2)}%</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Linear Trend:</span>
                  <span style={{ fontWeight: 600, color: analytics.trend.direction === "upward" ? "var(--color-success)" : analytics.trend.direction === "downward" ? "var(--color-danger)" : "var(--text-secondary)" }}>
                    {analytics.trend.direction.toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No analytics compiled yet.</div>
            )}
          </div>

          {/* Anomaly Alerts Box */}
          <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", padding: "1.25rem", flex: 1 }}>
            <h4 style={{ fontSize: "1rem", color: "var(--text-primary)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <AlertTriangle size={16} style={{ color: "var(--color-warning)" }} /> Anomaly Events
            </h4>
            
            <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {analytics && analytics.anomalies && analytics.anomalies.length > 0 ? (
                analytics.anomalies.map((a: any, index: number) => (
                  <div key={index} style={{ padding: "0.45rem", borderLeft: "3px solid var(--color-danger)", backgroundColor: "var(--bg-tertiary)", fontSize: "0.75rem", borderRadius: "0 4px 4px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span style={{ color: "var(--text-primary)" }}>{a.date}</span>
                      <span style={{ color: "var(--color-danger)" }}>{a.type === "spike" ? "Spike" : a.type === "drop" ? "Drop" : "Shift"}</span>
                    </div>
                    <div style={{ color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                      Value {a.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {a.pct_change ? `(${a.pct_change.toFixed(1)}% shift)` : `(Z: ${a.z_score.toFixed(1)})`}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: "var(--text-muted)", fontSize: "0.825rem", padding: "1rem 0", textAlign: "center" }}>
                  No statistical anomalies identified in this series.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* AI Written Narrative Section */}
      {aiInsights && (
        <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", borderLeft: "4px solid var(--color-primary)", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1.25rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              🤖 AI Agent Analytical Narrative
            </h3>
            <p style={{ fontStyle: "italic", fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Heuristics and LLM-synthesized narrative based on statistical anomalies and trends
            </p>
          </div>
          
          <div className="grid-3" style={{ gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>WHAT HAPPENED:</p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{aiInsights.what_happened}</p>
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>WHY IT HAPPENED:</p>
              <p style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{aiInsights.why_it_happened}</p>
            </div>
          </div>
          
          <hr style={{ border: "none", borderTop: "1px solid var(--border-color)" }} />
          
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>KEY INSIGHTS & TAKEAWAYS:</p>
            <ul style={{ paddingLeft: "1.25rem", fontSize: "0.875rem", color: "var(--text-primary)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {aiInsights.key_insights.map((ins: string, idx: number) => (
                <li key={idx}>{ins}</li>
              ))}
            </ul>
          </div>
          
          <hr style={{ border: "none", borderTop: "1px solid var(--border-color)" }} />
          
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>BUSINESS OR ECONOMIC IMPLICATIONS:</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}>{aiInsights.implications}</p>
          </div>
        </div>
      )}
    </div>
  );
};
