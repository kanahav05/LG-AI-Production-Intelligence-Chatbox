// api.ts
// All communication between the React frontend and FastAPI backend.
// Attaches JWT token to every request.
// Redirects to sign in page on 401 (token expired).

const BASE_URL = "http://localhost:8000";

import { AUTH_TOKEN_KEY } from "./auth";
import { reportClientError } from "./errorLogger";

// Auth headers 
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 401 interceptor
// If any request returns 401 (token expired or invalid),
// clear session and redirect to sign in page automatically.
// Guard: only redirect if we're NOT already on the sign-in page
// to prevent the infinite reload loop (fetch→401→redirect→fetch…).
function handle401(res: Response): Response {
  if (res.status === 401) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("lg-user");
    // Only redirect if not already on the sign-in page
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }
  return res;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers as Record<string, string> ?? {}),
      },
    });
    if (!res.ok && res.status >= 500) {
      await reportClientError(
        "ERR_001",
        `HTTP ${res.status} from ${url}`,
        {
          page: window.location.pathname,
          responseCode: String(res.status),
        }
      );
    }
    return handle401(res);
  } catch (error) {
    const code = navigator.onLine === false ? "INFO_001" : "ERR_001";
    await reportClientError(code, error instanceof Error ? error.message : "Network request failed", {
      page: window.location.pathname,
      responseCode: "NETWORK_ERROR",
    });
    throw error;
  }
}

// Types 
export interface LineRow {
  date:            string;
  time:            string;
  product:         string;
  product_name:    string;
  line:            string;
  plan:            number;
  target:          number;
  result:          number;
  achieve:         number;
  below_threshold: boolean;
  phase:           string;
}

export interface LiveSnapshot {
  date:               string;
  time:               string;
  production_active:  boolean;
  rows:               LineRow[];
  summary: {
    date:    string;
    time:    string;
    plan:    number;
    target:  number;
    result:  number;
    achieve: number;
  };
  alerts: {
    line:    string;
    product: string;
    achieve: number;
  }[];
}

export interface Prediction {
  line:              string;
  product:           string;
  product_name:      string;
  plan:              number;
  current_result:    number;
  projected_result:  number;
  will_meet_plan:    boolean;
  achieve_pct:       number;
  confidence:        number;
  units_needed:      number;
  minutes_remaining: number;
  below_threshold:   boolean;
  phase:             string;
}

export interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  response:  string;
  rows_used: number;
  is_live:   boolean;
  intent:    string;
}

export interface TroubleshootMatchManual {
  id:              number;
  problem:         string;
  manual_solution: string;
  category:        string;
}

export interface TroubleshootMatchHistory {
  id:           number;
  problem:      string;
  action_taken: string;
  outcome:      string;
  date:         string;
}

export interface TroubleshootResponse {
  response:        string;
  manual_matches:  TroubleshootMatchManual[];
  history_matches: TroubleshootMatchHistory[];
  synthesized:     boolean;
}

// Live snapshot 
export async function fetchLive(): Promise<LiveSnapshot> {
  const res = await authFetch(`${BASE_URL}/api/live`);
  if (!res.ok) throw new Error("Failed to fetch live data");
  return res.json();
}

// Historical: by date and line 
export async function fetchHistoryLine(
  date: string,
  line: string
): Promise<{ records: LineRow[] }> {
  const res = await authFetch(
    `${BASE_URL}/api/history/line?date=${date}&line=${line}`
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// Historical: by date and product 
export async function fetchHistoryProduct(
  date:    string,
  product: string
): Promise<{ records: LineRow[] }> {
  const res = await authFetch(
    `${BASE_URL}/api/history/product?date=${date}&product=${product}`
  );
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

// Day summary 
export async function fetchDaySummary(date: string) {
  const res = await authFetch(`${BASE_URL}/api/summary/${date}`);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

// Predict all lines 
export async function fetchPredictions(): Promise<{
  predictions: Prediction[];
  summary: {
    total_lines:     number;
    on_track:        number;
    at_risk:         number;
    below_threshold: number;
  };
}> {
  const res = await authFetch(`${BASE_URL}/api/predict/all`);
  if (!res.ok) throw new Error("Failed to fetch predictions");
  return res.json();
}

// Predict single line 
export async function fetchPrediction(line: string): Promise<Prediction> {
  const res = await authFetch(`${BASE_URL}/api/predict/${line}`);
  if (!res.ok) throw new Error("Failed to fetch prediction");
  return res.json();
}

// Chat 
export async function sendChatQuery(
  query:   string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const res = await authFetch(`${BASE_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query, history }),
  });
  if (res.status === 429) {
    await reportClientError("WARN_004", "Rate limit exceeded on /api/chat", {
      query,
      responseCode: "429",
    });
    throw new Error("Rate limit exceeded. Please wait a moment before sending another query.");
  }
  if (!res.ok) throw new Error("Failed to send chat query");
  return res.json();
}

// Troubleshoot
export async function sendTroubleshootQuery(
  problem: string
): Promise<TroubleshootResponse> {
  const res = await authFetch(`${BASE_URL}/api/troubleshoot`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ problem }),
  });
  if (res.status === 429) {
    await reportClientError("WARN_004", "Rate limit exceeded on /api/troubleshoot", {
      query: problem,
      responseCode: "429",
    });
    throw new Error("Rate limit exceeded. Please wait before submitting another diagnostic.");
  }
  if (!res.ok) throw new Error("Failed to send troubleshoot query");
  return res.json();
}

// WebSocket live stream 
// Passes JWT as query param since WebSocket headers aren't
// supported in browsers.
export function connectLiveStream({
  onSnapshot,
  onAlert,
}: {
  onSnapshot:  (data: LiveSnapshot) => void;
  onAlert?:    (alerts: LiveSnapshot["alerts"]) => void;
}): () => void {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const url   = `ws://localhost:8000/ws/live${token ? `?token=${token}` : ""}`;
  const ws    = new WebSocket(url);

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

  ws.onclose = (event) => {
    console.log("WebSocket disconnected", event.code);
    if (event.code !== 1000) {
      reportClientError("ERR_005", `WebSocket closed unexpectedly with code ${event.code}`, {
        page: window.location.pathname,
      });
    }
    // Code 1008 = policy violation = JWT rejected
    if (event.code === 1008) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem("lg-user");
      window.location.href = "/";
    }
  };

  return () => ws.close();
}