import React, { useState, useEffect } from "react";
import { Search, UploadCloud, TrendingUp, Coins, Globe, Home, Thermometer, Database, Check, AlertCircle } from "lucide-react";

interface DatasetInfo {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: string;
}

interface DataExplorerProps {
  onDatasetSelected: (datasetId: string, metadata: any, rawData: any) => void;
  token: string | null;
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ onDatasetSelected, token }) => {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [filteredDatasets, setFilteredDatasets] = useState<DatasetInfo[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  
  const categories = ["All", "Financials", "Crypto", "Economics", "Real Estate", "Climate"];

  useEffect(() => {
    fetch("/api/datasets")
      .then((res) => res.json())
      .then((data) => {
        setDatasets(data);
        setFilteredDatasets(data);
      })
      .catch((err) => console.error("Error loading datasets list", err));
  }, []);

  useEffect(() => {
    let result = datasets;
    if (category !== "All") {
      result = result.filter((d) => d.category.toLowerCase() === category.toLowerCase());
    }
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
    }
    setFilteredDatasets(result);
  }, [search, category, datasets]);

  const loadDataset = async (id: string) => {
    try {
      const res = await fetch(`/api/datasets/${id}`);
      if (!res.ok) throw new Error("Failed to load dataset details");
      const data = await res.json();
      onDatasetSelected(id, {
        dataset_id: data.dataset_id,
        title: data.title,
        source: data.source,
        category: data.category,
        columns: data.columns,
        length: data.length
      }, data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers,
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "File processing failed");
      }
      
      setUploadSuccess(`Successfully cleaned and loaded "${file.name}"`);
      // Select the uploaded dataset
      onDatasetSelected(data.dataset_id, {
        dataset_id: data.dataset_id,
        title: data.title,
        source: data.source,
        category: data.category,
        columns: data.columns,
        length: data.length
      }, data.data);
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "trending-up": return <TrendingUp size={18} />;
      case "coins": return <Coins size={18} />;
      case "globe": return <Globe size={18} />;
      case "home": return <Home size={18} />;
      case "thermometer": return <Thermometer size={18} />;
      default: return <Database size={18} />;
    }
  };

  return (
    <div className="animate-slide-up" style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Search and Category filters */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", flex: "1", minWidth: "280px" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: "38px", height: "42px" }}
            placeholder="Search economic indicators, stocks, crypto or housing data..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="btn"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                fontSize: "0.825rem",
                backgroundColor: category === c ? "var(--color-primary)" : "var(--bg-secondary)",
                color: category === c ? "#fff" : "var(--text-secondary)",
                border: category === c ? "none" : "1px solid var(--border-color)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Dataset Catalog */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ fontSize: "1.25rem", color: "var(--text-primary)" }}>Popular Datasets Catalog</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredDatasets.length === 0 ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                No matching datasets found. Use the Search bar to find indicators.
              </div>
            ) : (
              filteredDatasets.map((d) => (
                <div
                  key={d.id}
                  className="glass-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem 1.25rem",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "var(--bg-accent)",
                        color: "var(--color-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      {getCategoryIcon(d.icon)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.title}</span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "10px",
                            backgroundColor: "var(--bg-tertiary)",
                            color: "var(--text-secondary)",
                            fontWeight: 500
                          }}
                        >
                          {d.category}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.15rem", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {d.description}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => loadDataset(d.id)} className="btn btn-secondary" style={{ padding: "0.45rem 1rem", fontSize: "0.825rem", flexShrink: 0 }}>
                    Load Data
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upload Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ fontSize: "1.25rem", color: "var(--text-primary)" }}>Ingest Custom File</h3>
          
          <div
            className="glass-card"
            style={{
              flex: "1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "2px dashed var(--border-color)",
              backgroundColor: "var(--bg-secondary)",
              padding: "2rem 1.5rem",
              textAlign: "center",
              minHeight: "220px",
              cursor: "pointer",
              position: "relative"
            }}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={handleFileUpload}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer"
              }}
              disabled={uploading}
            />
            
            <UploadCloud size={44} style={{ color: "var(--color-primary)", marginBottom: "1rem", opacity: uploading ? 0.4 : 1 }} />
            
            {uploading ? (
              <div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Uploading & Cleaning...</p>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Parsing file types, formatting indexes, interpolating missing cells, and verifying schema alignment.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>Drag & Drop or Click to browse</p>
                <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Supports CSV, Excel (.xlsx), or JSON data tables.
                </p>
              </div>
            )}
          </div>

          {uploadError && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--color-danger)", fontSize: "0.825rem" }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadSuccess && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)", backgroundColor: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)", fontSize: "0.825rem" }}>
              <Check size={16} style={{ flexShrink: 0 }} />
              <span>{uploadSuccess}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
