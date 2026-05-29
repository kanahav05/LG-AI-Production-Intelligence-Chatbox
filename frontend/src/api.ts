// api.ts
// All communication between the React frontend and FastAPI backend..

const BASE_URL = "http://localhost:8000";

// Types

export interface LineRow {
  date: string;
  time: string;
  product: string;
  product_name: string;
  line: string;
  plan: number;
  target: number;
  result: number;
  achieve: number;
  below_threshold: boolean;
  phase: string;
}

export interface LiveSnapshot {
  date: string;
  time: string;
  production_active: boolean;
  rows: LineRow[];
  summary: {
    date: string;
    time: string;
    plan: number;
    target: number;
    result: number;
    achieve: number;
  };
  alerts: {
    line: string;
    product: string;
    achieve: number;
  }[];
}

export interface Prediction {
  line: string;
  product: string;
  product_name: string;
  plan: number;
  current_result: number;
  projected_result: number;
  will_meet_plan: boolean;
  achieve_pct: number;
  confidence: number;
  units_needed: number;
  minutes_remaining: number;
  below_threshold: boolean;
  phase: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response: string;
  rows_used: number;
  is_live: boolean;
  intent: string;
}

// Live snapshot (one-time fetch)
export async function fetchLive(): Promise<LiveSnapshot> {
  const res = await fetch(`${BASE_URL}/api/live`);
  if (!res.ok) throw new Error("Failed to fetch live data");
  return res.json();
}

// Historical
export async function fetchHistoryLine(
  date: string,
  line: string
): Promise<{ records: LineRow[] }> {
  const res = await fetch(
    `${BASE_URL}/api/history/line?date=${date}&line=${line}`
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// Historical: by date and product
export async function fetchHistoryProduct(
  date: string,
  product: string
): Promise<{ records: LineRow[] }> {
  const res = await fetch(
    `${BASE_URL}/api/history/product?date=${date}&product=${product}`
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// Day summary 
export async function fetchDaySummary(date: string) {
  const res = await fetch(`${BASE_URL}/api/summary/${date}`);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

// Predict all lines 
export async function fetchPredictions(): Promise<{
  predictions: Prediction[];
  summary: {
    total_lines: number;
    on_track: number;
    at_risk: number;
    below_threshold: number;
  };
}> {
  const res = await fetch(`${BASE_URL}/api/predict/all`);
  if (!res.ok) throw new Error("Failed to fetch predictions");
  return res.json();
}

// Predict single line
export async function fetchPrediction(line: string): Promise<Prediction> {
  const res = await fetch(`${BASE_URL}/api/predict/${line}`);
  if (!res.ok) throw new Error("Failed to fetch prediction");
  return res.json();
}

// Chat
export async function sendChatQuery(
  query: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history }),
  });
  if (!res.ok) throw new Error("Failed to send chat query");
  return res.json();
}

// WebSocket live stream 
// Connects to /ws/live and calls callbacks every second.
// Returns a stop() function to disconnect cleanly.
//


export function connectLiveStream({
  onSnapshot,
  onAlert,
}: {
  onSnapshot: (data: LiveSnapshot) => void;
  onAlert?: (alerts: LiveSnapshot["alerts"]) => void;
}): () => void {
  const ws = new WebSocket(`ws://localhost:8000/ws/live`);

  ws.onopen = () => {
    console.log("WebSocket connected to live stream");
  };

  ws.onmessage = (event) => {
    const data: LiveSnapshot = JSON.parse(event.data);
    onSnapshot(data);
    if (onAlert && data.alerts?.length > 0) {
      onAlert(data.alerts);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected");
  };

  return () => ws.close();
}