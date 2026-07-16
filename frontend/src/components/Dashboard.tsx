import React, { useState, useEffect } from "react";
import ReactApexChart from "react-apexcharts";
import { ArrowLeftRight, Trash2, ArrowUp, ArrowDown, Save, BarChart } from "lucide-react";

interface PinnedWidget {
  id: string;
  dataset_id: string;
  column: string;
  chart_type: string;
  title: string;
}

interface DashboardProps {
  token: string | null;
  onSelectDataset: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ token, onSelectDataset }) => {
  const [widgets, setWidgets] = useState<PinnedWidget[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [datasetA, setDatasetA] = useState("TSLA");
  const [datasetB, setDatasetB] = useState("NVDA");
  const [dataA, setDataA] = useState<any[]>([]);
  const [dataB, setDataB] = useState<any[]>([]);
  const [colA, setColA] = useState("Close");
  const [colB, setColB] = useState("Close");
  const [catalog, setCatalog] = useState<any[]>([]);
  const [dashboardTitle, setDashboardTitle] = useState("My Analytics Board");
  const [savedDashboards, setSavedDashboards] = useState<any[]>([]);

  // HTML5 Drag and Drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Load catalog
  useEffect(() => {
    fetch("/api/datasets")
      .then(res => res.json())
      .then(data => setCatalog(data))
      .catch(err => console.error(err));
  }, []);

  // Load saved dashboards
  const loadDashboardsList = () => {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    fetch("/api/dashboards", { headers })
      .then(res => res.json())
      .then(data => setSavedDashboards(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    loadDashboardsList();
    // Load local storage widgets
    const local = localStorage.getItem("pinned_widgets");
    if (local) {
      setWidgets(JSON.parse(local));
    } else {
      // Default initial widgets for a good first impression
      const defaults: PinnedWidget[] = [
        { id: "w1", dataset_id: "TSLA", column: "Close", chart_type: "line", title: "Tesla Stock Price" },
        { id: "w2", dataset_id: "US_GDP", column: "Value", chart_type: "bar", title: "US Economic GDP" },
        { id: "w3", dataset_id: "FREMONT_HOUSING", column: "Median_Home_Price", chart_type: "area", title: "Fremont Home Prices" }
      ];
      setWidgets(defaults);
      localStorage.setItem("pinned_widgets", JSON.stringify(defaults));
    }
  }, [token]);

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    
    // Rearrange widgets
    const list = [...widgets];
    const dragIdx = list.findIndex(w => w.id === draggedId);
    const hoverIdx = list.findIndex(w => w.id === targetId);
    
    if (dragIdx !== -1 && hoverIdx !== -1) {
      const temp = list[dragIdx];
      list.splice(dragIdx, 1);
      list.splice(hoverIdx, 0, temp);
      setWidgets(list);
      localStorage.setItem("pinned_widgets", JSON.stringify(list));
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const moveWidget = (index: number, direction: "left" | "right") => {
    const nextIndex = direction === "left" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= widgets.length) return;
    
    const list = [...widgets];
    const temp = list[index];
    list[index] = list[nextIndex];
    list[nextIndex] = temp;
    
    setWidgets(list);
    localStorage.setItem("pinned_widgets", JSON.stringify(list));
  };

  const removeWidget = (id: string) => {
    const list = widgets.filter(w => w.id !== id);
    setWidgets(list);
    localStorage.setItem("pinned_widgets", JSON.stringify(list));
  };

  const saveDashboardToDB = async () => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: dashboardTitle,
          layout: widgets.map((w, idx) => ({ id: w.id, position: idx })),
          widgets: widgets,
          is_public: true
        })
      });
      
      if (!res.ok) throw new Error("Save failed");
      alert("Dashboard configuration successfully synced to SQLite!");
      loadDashboardsList();
    } catch (err) {
      console.error(err);
      alert("Failed to save dashboard. Make sure you are logged in.");
    }
  };

  const loadSavedDashboard = (dash: any) => {
    setWidgets(dash.widgets);
    setDashboardTitle(dash.title);
    localStorage.setItem("pinned_widgets", JSON.stringify(dash.widgets));
  };

  // Compare mode loading
  useEffect(() => {
    if (!compareMode) return;
    
    // Fetch Dataset A
    fetch(`/api/datasets/${datasetA}`)
      .then(res => res.json())
      .then(data => {
        setDataA(data.data);
        // Set default col
        if (!data.columns.includes(colA)) {
          setColA(data.columns[0] === "date" ? data.columns[1] : data.columns[0]);
        }
      });
      
    // Fetch Dataset B
    fetch(`/api/datasets/${datasetB}`)
      .then(res => res.json())
      .then(data => {
        setDataB(data.data);
        if (!data.columns.includes(colB)) {
          setColB(data.columns[0] === "date" ? data.columns[1] : data.columns[0]);
        }
      });
  }, [compareMode, datasetA, datasetB]);

  const renderWidgetChart = (w: PinnedWidget) => {
    const [chartData, setChartData] = useState<any[]>([]);
    
    useEffect(() => {
      fetch(`/api/datasets/${w.dataset_id}`)
        .then(res => res.json())
        .then(data => {
          setChartData(data.data.slice(-60)); // Render last 60 points for mini widgets
        })
        .catch(err => console.error(err));
    }, [w]);

    if (chartData.length === 0) {
      return <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading mini-chart...</div>;
    }

    const dates = chartData.map(c => c.date);
    const values = chartData.map(c => c[w.column]);

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    const options = {
      chart: { type: w.chart_type as any, sparkline: { enabled: true }, animations: { enabled: false } },
      stroke: { curve: "smooth" as const, width: 2 },
      colors: [w.dataset_id.includes("TSLA") ? "#8b5cf6" : w.dataset_id.includes("GDP") ? "#10b981" : "#3b82f6"],
      tooltip: { theme: isDark ? ("dark" as const) : ("light" as const), x: { show: true }, y: { formatter: (v: number) => v.toLocaleString() } },
      xaxis: { categories: dates }
    };

    return <ReactApexChart options={options} series={[{ name: w.column, data: values }]} type={w.chart_type === "area" ? "area" : "line"} height={140} />;
  };

  const getCompareChartData = () => {
    if (dataA.length === 0 || dataB.length === 0) return { series: [], options: {} };
    
    // Find intersection dates
    const datesA = dataA.map(d => d.date);
    const datesB = dataB.map(d => d.date);
    const commonDates = datesA.filter(d => datesB.includes(d)).sort();
    
    // Extract values
    const valsA = commonDates.map(date => dataA.find(d => d.date === date)[colA]);
    const valsB = commonDates.map(date => dataB.find(d => d.date === date)[colB]);
    
    // Normalization (relative to first common point, so they align on single scale)
    const normA = valsA.map(v => (v / (valsA[0] || 1)) * 100);
    const normB = valsB.map(v => (v / (valsB[0] || 1)) * 100);

    const series = [
      { name: `${datasetA} - ${colA} (Normalized %)`, data: normA },
      { name: `${datasetB} - ${colB} (Normalized %)`, data: normB }
    ];

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    const options = {
      chart: { background: "transparent", toolbar: { show: true } },
      stroke: { curve: "smooth" as const, width: 2.5 },
      colors: ["#3b82f6", "#10b981"],
      theme: { mode: isDark ? ("dark" as const) : ("light" as const) },
      grid: { borderColor: "var(--border-color)", strokeDashArray: 3 },
      xaxis: { categories: commonDates, labels: { style: { colors: "var(--text-secondary)" } } },
      yaxis: { labels: { style: { colors: "var(--text-secondary)" } } }
    };

    return { series, options };
  };

  const { series: compSeries, options: compOptions } = getCompareChartData();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-slide-up">
      {/* Top controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.8rem", color: "var(--text-primary)" }}>Interactive Custom Dashboards</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Arrange pinned metrics and compare global indices</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setCompareMode(!compareMode)}
            className="btn btn-secondary"
            style={{
              borderColor: compareMode ? "var(--color-primary)" : "var(--border-color)",
              color: compareMode ? "var(--color-primary)" : "var(--text-primary)"
            }}
          >
            <ArrowLeftRight size={16} /> {compareMode ? "Show Grid Layout" : "Switch to Compare Mode"}
          </button>
        </div>
      </div>

      {compareMode ? (
        /* ================= COMPARE MODE PANEL ================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {/* Pick dataset A */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: "200px" }}>
              <label className="form-label">First Dataset (A)</label>
              <select className="form-input" value={datasetA} onChange={(e) => setDatasetA(e.target.value)}>
                {catalog.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            
            {/* Pick dataset B */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: "200px" }}>
              <label className="form-label">Second Dataset (B)</label>
              <select className="form-input" value={datasetB} onChange={(e) => setDatasetB(e.target.value)}>
                {catalog.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ gridTemplateColumns: "3fr 1fr", gap: "1.5rem" }}>
            {/* Comparison graph */}
            <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", minHeight: "400px" }}>
              <h3 style={{ fontSize: "1.15rem", color: "var(--text-primary)", marginBottom: "1rem" }}>
                Overlaid Index Comparison (Normalized to Baseline = 100%)
              </h3>
              {compSeries.length > 0 ? (
                <ReactApexChart options={compOptions} series={compSeries} type="line" height={340} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: "var(--text-muted)" }}>
                  Connecting datasets indicators...
                </div>
              )}
            </div>

            {/* Comparison details */}
            <div className="glass-card" style={{ backgroundColor: "var(--bg-secondary)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h4 style={{ fontSize: "1rem", color: "var(--text-primary)" }}>Statistical Correlation</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Overlapping values are normalized using base index pricing to reflect relative performance ratios directly on one axis.
              </p>
              <hr style={{ border: "none", borderTop: "1px solid var(--border-color)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>COMPARED TICKERS:</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{datasetA} vs {datasetB}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= GRID LAYOUT WIDGETS ================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Dashboard Management Header */}
          <div className="glass-card" style={{ padding: "1rem", backgroundColor: "var(--bg-secondary)", display: "flex", gap: "1rem", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)" }}>Dashboard Title:</span>
              <input
                type="text"
                className="form-input"
                style={{ width: "220px", height: "34px" }}
                value={dashboardTitle}
                onChange={(e) => setDashboardTitle(e.target.value)}
              />
              <button onClick={saveDashboardToDB} className="btn btn-primary" style={{ padding: "0.35rem 0.85rem", height: "34px", fontSize: "0.8rem" }}>
                <Save size={14} /> Save Board
              </button>
            </div>
            
            {/* List of saved boards */}
            {savedDashboards.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Load Dashboard:</span>
                <select
                  className="form-input"
                  style={{ width: "180px", height: "34px", padding: "0 0.5rem", fontSize: "0.8rem" }}
                  onChange={(e) => {
                    const db = savedDashboards.find(s => s.id === e.target.value);
                    if (db) loadSavedDashboard(db);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Saved Board --</option>
                  {savedDashboards.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Widgets Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
            {widgets.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: "1/-1", textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)", backgroundColor: "var(--bg-secondary)" }}>
                <BarChart size={40} style={{ color: "var(--color-primary)", marginBottom: "1rem" }} />
                <h4>No widgets pinned to your dashboard yet!</h4>
                <p style={{ fontSize: "0.825rem", marginTop: "0.25rem" }}>
                  Explore datasets in the "Datasets" catalog, select a column and chart type under the "Visualizer", and click "Pin Widget" to add them here.
                </p>
              </div>
            ) : (
              widgets.map((w, index) => (
                <div
                  key={w.id}
                  className="glass-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, w.id)}
                  onDragOver={(e) => handleDragOver(e, w.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    cursor: "grab",
                    border: draggedId === w.id ? "2px dashed var(--color-primary)" : "1px solid var(--border-color)",
                    opacity: draggedId === w.id ? 0.4 : 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    position: "relative"
                  }}
                >
                  {/* Widget Controls Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4
                        onClick={() => onSelectDataset(w.dataset_id)}
                        style={{ fontSize: "0.95rem", color: "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}
                        title="Click to explore dataset"
                      >
                        {w.title}
                      </h4>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{w.column} | {w.chart_type}</span>
                    </div>

                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button
                        onClick={() => moveWidget(index, "left")}
                        disabled={index === 0}
                        style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        title="Move Left/Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => moveWidget(index, "right")}
                        disabled={index === widgets.length - 1}
                        style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}
                        title="Move Right/Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={() => removeWidget(w.id)}
                        style={{ border: "none", background: "none", color: "var(--color-danger)", cursor: "pointer" }}
                        title="Remove Widget"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Widget Miniature Chart */}
                  <div style={{ flex: 1 }}>
                    {renderWidgetChart(w)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
