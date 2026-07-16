import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, BrainCircuit } from "lucide-react";

interface Message {
  sender: "user" | "agent";
  text: string;
}

interface ChatAssistantProps {
  datasetMeta: any;
  rawData: any[];
  activeColumn?: string;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ datasetMeta, rawData, activeColumn }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize chat with greeting when dataset changes
  useEffect(() => {
    if (datasetMeta) {
      setMessages([
        {
          sender: "agent",
          text: `Hello! I am your Data Science AI Agent. I have loaded and analyzed the dataset **"${datasetMeta.title}"** (Source: ${datasetMeta.source}). You can ask me questions about its trends, anomalies, or request a forecast!`
        }
      ]);
    } else {
      setMessages([
        {
          sender: "agent",
          text: "Hello! I am your Data Science AI Agent. Select or upload a dataset to begin our analysis."
        }
      ]);
    }
  }, [datasetMeta]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || !datasetMeta) return;

    // Append user message
    const newMsg: Message = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      // 1. Gather current statistical analytics to send as context
      const col = activeColumn || datasetMeta.columns[0];
      const anaRes = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: rawData, column: col })
      });
      const analytics = await anaRes.json();

      // 2. Call chat assistant endpoint
      const chatRes = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: textToSend,
          meta: datasetMeta,
          analytics: analytics
        })
      });

      if (!chatRes.ok) throw new Error("Chat assistant error");
      const chatData = await chatRes.json();

      // Append agent message
      setMessages((prev) => [...prev, { sender: "agent", text: chatData.answer }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: "Sorry, I encountered an error while communicating with the AI service. Please make sure the backend is active."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend(input);
    }
  };

  const shortcuts = [
    { label: "Explain this graph", query: "Explain the trends and metrics shown in this graph." },
    { label: "Why did it change?", query: "Why did values change? What are the underlying economic/business causes?" },
    { label: "Forecast future values", query: "Can you forecast the future values for this dataset?" },
    { label: "Any anomaly spikes?", query: "Highlight the key anomaly timestamps and explain what they represent." }
  ];

  return (
    <div
      className="glass-card animate-slide-in-right"
      style={{
        backgroundColor: "var(--bg-secondary)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "1.25rem",
        maxHeight: "calc(100vh - 120px)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-color)", marginBottom: "0.75rem" }}>
        <Sparkles size={18} style={{ color: "var(--color-primary)" }} />
        <div>
          <h4 style={{ fontSize: "1rem", color: "var(--text-primary)" }}>AI Agent Assistant</h4>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Context-aware chat analyzer</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          paddingRight: "0.25rem",
          marginBottom: "1rem"
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%"
            }}
          >
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: m.sender === "user" ? "12px 12px 0 12px" : "12px 12px 12px 0",
                backgroundColor: m.sender === "user" ? "var(--color-primary)" : "var(--bg-tertiary)",
                color: m.sender === "user" ? "#ffffff" : "var(--text-primary)",
                fontSize: "0.85rem",
                wordBreak: "break-word"
              }}
            >
              {/* Parse basic markdown bullet points in agent responses */}
              {m.sender === "agent" ? (
                <div style={{ whiteSpace: "pre-line" }}>
                  {m.text}
                </div>
              ) : (
                m.text
              )}
            </div>
            <span
              style={{
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                marginTop: "0.2rem",
                padding: "0 0.25rem"
              }}
            >
              {m.sender === "user" ? "You" : "AI Agent"}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", maxWidth: "85%" }}>
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "12px 12px 12px 0",
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              <BrainCircuit size={14} className="animate-pulse" style={{ color: "var(--color-primary)" }} />
              <span>Analyzing datasets...</span>
            </div>
          </div>
        )}
      </div>

      {/* Shortcut Buttons */}
      {datasetMeta && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)" }}>ASK AGENT:</span>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {shortcuts.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.query)}
                className="btn btn-secondary"
                style={{
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.725rem",
                  borderRadius: "12px",
                  borderColor: "var(--border-color)",
                  whiteSpace: "nowrap"
                }}
                disabled={loading}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ position: "relative", display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          className="form-input"
          style={{ paddingRight: "40px", height: "40px" }}
          placeholder={datasetMeta ? "Ask a question about this data..." : "Select a dataset to begin..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={!datasetMeta || loading}
        />
        <button
          onClick={() => handleSend(input)}
          className="btn btn-primary"
          style={{
            position: "absolute",
            right: "4px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "32px",
            height: "32px",
            padding: 0,
            borderRadius: "6px"
          }}
          disabled={!datasetMeta || !input.trim() || loading}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
