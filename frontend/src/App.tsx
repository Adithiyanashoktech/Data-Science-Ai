import { useState, useEffect } from "react";
import { Database, LineChart, BrainCircuit, LayoutGrid, Sun, Moon, LogIn, LogOut, Sparkles, User } from "lucide-react";
import { DataExplorer } from "./components/DataExplorer";
import { Visualizer } from "./components/Visualizer";
import { Forecaster } from "./components/Forecaster";
import { Dashboard } from "./components/Dashboard";
import { ChatAssistant } from "./components/ChatAssistant";
import { AuthModal } from "./components/AuthModal";

export default function App() {
  const [activeTab, setActiveTab] = useState<"explorer" | "visualizer" | "forecaster" | "dashboard">("explorer");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [authOpen, setAuthOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  
  // Active dataset state
  const [datasetMeta, setDatasetMeta] = useState<any>(null);
  const [rawData, setRawData] = useState<any[]>([]);

  // Sync token from localStorage
  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("username");
    if (t && u) {
      setToken(t);
      setUsername(u);
    }
    
    // Set default HTML theme attribute
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  // Set default initial dataset
  useEffect(() => {
    const fetchDefault = async () => {
      try {
        const res = await fetch("/api/datasets/TSLA");
        if (!res.ok) throw new Error("Failed default load");
        const data = await res.json();
        setDatasetMeta({
          dataset_id: data.dataset_id,
          title: data.title,
          source: data.source,
          category: data.category,
          columns: data.columns,
          length: data.length
        });
        setRawData(data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDefault();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const handleLoginSuccess = (newToken: string, newUsername: string) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUsername(null);
    alert("Logged out successfully.");
  };

  const handleDatasetSelected = (_id: string, metadata: any, data: any[]) => {
    setDatasetMeta(metadata);
    setRawData(data);
    // Auto-navigate to visualizer to display graphs
    setActiveTab("visualizer");
  };

  const loadDatasetById = async (id: string) => {
    try {
      const res = await fetch(`/api/datasets/${id}`);
      if (!res.ok) throw new Error("Load failed");
      const data = await res.json();
      setDatasetMeta({
        dataset_id: data.dataset_id,
        title: data.title,
        source: data.source,
        category: data.category,
        columns: data.columns,
        length: data.length
      });
      setRawData(data.data);
      setActiveTab("visualizer");
    } catch (err) {
      console.error(err);
    }
  };

  const handlePinWidget = (widgetConfig: any) => {
    const local = localStorage.getItem("pinned_widgets");
    const widgets = local ? JSON.parse(local) : [];
    
    // Add unique widget id
    const newWidget = {
      id: `w_${Date.now()}`,
      dataset_id: widgetConfig.dataset_id,
      column: widgetConfig.column,
      chart_type: widgetConfig.chart_type,
      title: widgetConfig.title
    };
    
    widgets.push(newWidget);
    localStorage.setItem("pinned_widgets", JSON.stringify(widgets));
    alert(`Pinned "${widgetConfig.title}" to your dashboard!`);
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        {/* Brand Header */}
        <div style={{ padding: "1.75rem 1.5rem", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "var(--color-primary)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", color: "#fff" }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>Data Ai</h1>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>Data Science AI Agent</span>
          </div>
        </div>

        {/* User profile section */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-accent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {token ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <User size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
              <span style={{ fontSize: "0.85rem", fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                {username}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Guest Workspace</span>
          )}
          
          {token ? (
            <button onClick={handleLogout} className="btn" style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--color-danger)", background: "transparent" }}>
              <LogOut size={14} /> Log Out
            </button>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="btn btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem", display: "flex", gap: "0.35rem" }}>
              <LogIn size={14} /> Log In
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
          <button
            onClick={() => setActiveTab("explorer")}
            className="btn"
            style={{
              justifyContent: "flex-start",
              backgroundColor: activeTab === "explorer" ? "var(--bg-accent)" : "transparent",
              color: activeTab === "explorer" ? "var(--color-primary)" : "var(--text-secondary)",
              border: "none",
              padding: "0.75rem 1rem",
              borderRadius: "8px"
            }}
          >
            <Database size={18} /> Datasets Catalog
          </button>
          
          <button
            onClick={() => setActiveTab("visualizer")}
            className="btn"
            style={{
              justifyContent: "flex-start",
              backgroundColor: activeTab === "visualizer" ? "var(--bg-accent)" : "transparent",
              color: activeTab === "visualizer" ? "var(--color-primary)" : "var(--text-secondary)",
              border: "none",
              padding: "0.75rem 1rem",
              borderRadius: "8px"
            }}
          >
            <LineChart size={18} /> Data Visualizer
          </button>

          <button
            onClick={() => setActiveTab("forecaster")}
            className="btn"
            style={{
              justifyContent: "flex-start",
              backgroundColor: activeTab === "forecaster" ? "var(--bg-accent)" : "transparent",
              color: activeTab === "forecaster" ? "var(--color-primary)" : "var(--text-secondary)",
              border: "none",
              padding: "0.75rem 1rem",
              borderRadius: "8px"
            }}
          >
            <BrainCircuit size={18} /> ML Forecasting
          </button>

          <button
            onClick={() => setActiveTab("dashboard")}
            className="btn"
            style={{
              justifyContent: "flex-start",
              backgroundColor: activeTab === "dashboard" ? "var(--bg-accent)" : "transparent",
              color: activeTab === "dashboard" ? "var(--color-primary)" : "var(--text-secondary)",
              border: "none",
              padding: "0.75rem 1rem",
              borderRadius: "8px"
            }}
          >
            <LayoutGrid size={18} /> Saved Dashboards
          </button>
        </nav>

        {/* Footer controls (Theme Switcher) */}
        <div style={{ padding: "1.5rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Theme Mode</span>
          <button onClick={toggleTheme} className="btn-icon" style={{ cursor: "pointer" }}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        <div style={{ display: "flex", gap: "2rem", width: "100%", flex: 1, minHeight: 0 }}>
          
          {/* Active Work Tab Content */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: "0.5rem" }}>
            {activeTab === "explorer" && (
              <DataExplorer onDatasetSelected={handleDatasetSelected} token={token} />
            )}
            
            {activeTab === "visualizer" && datasetMeta && (
              <Visualizer datasetMeta={datasetMeta} rawData={rawData} onWidgetPinned={handlePinWidget} />
            )}

            {activeTab === "forecaster" && datasetMeta && (
              <Forecaster datasetMeta={datasetMeta} rawData={rawData} />
            )}

            {activeTab === "dashboard" && (
              <Dashboard token={token} onSelectDataset={loadDatasetById} />
            )}
          </div>

          {/* Collateral Chat Assistant Sidebar */}
          {datasetMeta && activeTab !== "dashboard" && (
            <div style={{ width: "320px", flexShrink: 0, height: "calc(100vh - 60px)", position: "sticky", top: "0" }}>
              <ChatAssistant datasetMeta={datasetMeta} rawData={rawData} />
            </div>
          )}

        </div>
      </main>

      {/* Login & Register Modal Dialog */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
