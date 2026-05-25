// All communication between the frontend and FastAPI backend.

const BASE_URL = "http://localhost:8000";

// Live snapshot (one-time fetch)
export async function fetchLive() {
  const res = await fetch(`${BASE_URL}/api/live`);
  return res.json();
}

// Historical: by date and line 
export async function fetchHistoryLine(date, line) {
  const res = await fetch(
    `${BASE_URL}/api/history/line?date=${date}&line=${line}`
  );
  return res.json();
}

// Historical: by date and product 
export async function fetchHistoryProduct(date, product) {
  const res = await fetch(
    `${BASE_URL}/api/history/product?date=${date}&product=${product}`
  );
  return res.json();
}

// Historical: by date and shift phase
export async function fetchHistoryPhase(date, phase) {
  const res = await fetch(
    `${BASE_URL}/api/history/phase?date=${date}&phase=${encodeURIComponent(phase)}`
  );
  return res.json();
}

// Historical: closest snapshot to a time
export async function fetchClosestSnapshot(date, line, time) {
  const res = await fetch(
    `${BASE_URL}/api/history/closest?date=${date}&line=${line}&time=${time}`
  );
  return res.json();
}

// Day summary 
export async function fetchDaySummary(date) {
  const res = await fetch(`${BASE_URL}/api/summary/${date}`);
  return res.json();
}

// RAG retrieval (used internally by chat) 
export async function fetchRagContext(params = {}) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  ).toString();
  const res = await fetch(`${BASE_URL}/api/rag/retrieve?${query}`);
  return res.json();
}

// Chat
export async function sendChatQuery(query, history = []) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query, history })
  });
  return res.json();
}

// ML prediction for a line 
export async function fetchPrediction(line) {
  const res = await fetch(`${BASE_URL}/api/predict/${line}`);
  return res.json();
}

// WebSocket live stream──
// Connects to /ws/live and calls onSnapshot every second.
// Returns a stop() function to disconnect cleanly.
//

export function connectLiveStream({ onSnapshot, onAlert } = {}) {
  const ws = new WebSocket(`ws://localhost:8000/ws/live`);

  ws.onopen = () => {
    console.log("WebSocket connected to live stream.");
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (typeof onSnapshot === "function") {
      onSnapshot(data);
    }

    if (typeof onAlert === "function" && data.alerts?.length > 0) {
      onAlert(data.alerts);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected.");
  };

  // Returns stop function for cleanup
  return function stop() {
    ws.close();
  };
}