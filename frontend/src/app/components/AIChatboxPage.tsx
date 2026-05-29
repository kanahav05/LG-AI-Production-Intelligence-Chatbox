import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import {
  Send,
  Mic,
  Paperclip,
  Plus,
  LayoutDashboard,
  MessageSquare,
  Download,
  Eye,
  Loader2,
  ArrowLeft,
  MicOff,
} from "lucide-react";
import { sendChatQuery } from "../../api";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  showDetails?: boolean;
  isProcessing?: boolean;
  isDetailed?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
}

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  type: "ai",
  content:
    "Hello! I am your LG AI Production Assistant. I can help you analyse live and historical production data, predict line performance, and surface anomaly alerts. Ask me anything — you can type, use voice, or upload a CSV file.",
  timestamp: new Date(),
};

export function AIChatboxPage() {
  const navigate = useNavigate();

  // ── Chat state ─────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText]  = useState("");
  const [isLoading, setIsLoading]  = useState(false);

  // Conversation history sent to /api/chat for multi-turn support
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // ── Chat session history (sidebar) ────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // ── Voice input state ──────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // ── File upload ref ────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll to bottom on new messages ─────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message to backend ───────────────────────────────
  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isLoading) return;
    setInputText("");

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      content: text,
      timestamp: new Date(),
    };

    const processingId = (Date.now() + 1).toString();
    const processingMsg: Message = {
      id: processingId,
      type: "ai",
      content: "Processing your query...",
      timestamp: new Date(),
      isProcessing: true,
    };

    setMessages(prev => [...prev, userMsg, processingMsg]);
    setIsLoading(true);

    try {
      const result = await sendChatQuery(text, conversationHistory);

      // Update multi-turn history
      setConversationHistory(prev => [
        ...prev,
        { role: "user",      content: text },
        { role: "assistant", content: result.response },
      ]);

      const aiMsg: Message = {
        id: (Date.now() + 2).toString(),
        type: "ai",
        content: result.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev.filter(m => m.id !== processingId), aiMsg]);

      // Save first user message as session title
      if (!activeSessionId) {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: text.length > 40 ? text.slice(0, 40) + "..." : text,
          timestamp: new Date(),
          messages: [...messages, userMsg, aiMsg],
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== processingId),
        {
          id: (Date.now() + 2).toString(),
          type: "ai",
          content:
            "Could not reach the backend. Please make sure the FastAPI server is running on port 8000.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Detail toggle — re-sends query with "detail" appended ──
  const handleDetailToggle = async (message: Message) => {
    if (message.isDetailed) {
      // Already detailed — just toggle off visually
      setMessages(prev =>
        prev.map(m => m.id === message.id ? { ...m, isDetailed: false } : m)
      );
      return;
    }
    // Request detailed breakdown
    await handleSendMessage("detail");
    setMessages(prev =>
      prev.map(m => m.id === message.id ? { ...m, isDetailed: true } : m)
    );
  };

  // ── Download response as .txt ──────────────────────────────
  const handleDownload = (content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `LG_Production_Response_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── New chat ───────────────────────────────────────────────
  const handleNewChat = () => {
    setMessages([{
      ...INITIAL_MESSAGE,
      id: Date.now().toString(),
      timestamp: new Date(),
    }]);
    setConversationHistory([]);
    setActiveSessionId(null);
  };

  // ── Load session from sidebar ──────────────────────────────
  const handleLoadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setActiveSessionId(session.id);
    // Rebuild history from session messages
    const hist = session.messages
      .filter(m => !m.isProcessing)
      .map(m => ({ role: m.type === "user" ? "user" as const : "assistant" as const, content: m.content }));
    setConversationHistory(hist);
  };

  // Voice input 
 const handleVoiceToggle = () => {
  if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
    alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
    return;
  }

  if (isListening) {
    recognitionRef.current?.stop();
    setIsListening(false);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition: any = new SR();

  recognition.lang           = "en-IN";
  recognition.continuous     = false;
  recognition.interimResults = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    setInputText(transcript);
    setIsListening(false);
  };

  recognition.onerror = () => setIsListening(false);
  recognition.onend   = () => setIsListening(false);

  recognitionRef.current = recognition;
  recognition.start();
  setIsListening(true);
};

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const preview = content.slice(0, 200);
      setInputText(
        `I have uploaded a file: ${file.name}\n\nFirst 200 characters:\n${preview}\n\nPlease analyse this data.`
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header title="AI Chatbox" />

      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

        {/*Sidebar */}
        <div className="w-72 bg-card border-r border-border flex flex-col flex-shrink-0">
          <div className="p-4 space-y-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:bg-accent flex items-center justify-center gap-2"
              style={{ borderColor: "var(--lg-orange)", color: "var(--lg-orange)" }}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>

            <button
              onClick={handleNewChat}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-warm)" }}
            >
              <Plus className="w-5 h-5" />
              New Chat
            </button>

            <button
              onClick={() => navigate("/live-dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:bg-accent flex items-center justify-center gap-2"
              style={{ borderColor: "var(--lg-blue)", color: "var(--lg-blue)" }}
            >
              <LayoutDashboard className="w-5 h-5" />
              Live Dashboard
            </button>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">
              Chat History
            </h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-8">
                Your chat sessions will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => handleLoadSession(session)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      activeSessionId === session.id
                        ? "bg-accent border border-primary"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare
                        className="w-4 h-4 mt-1 flex-shrink-0"
                        style={{ color: "var(--lg-orange)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {session.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {session.timestamp.toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Main chat area ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-2xl ${
                    message.type === "user"
                      ? "bg-gradient-to-r from-orange-500 to-red-600 text-white"
                      : "bg-card border border-border"
                  } rounded-2xl p-4 shadow-md`}
                >
                  {message.isProcessing ? (
                    <div className="flex items-center gap-3">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ color: "var(--lg-orange)" }}
                      />
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Processing your query...</div>
                        <div className="text-xs text-muted-foreground">
                          Retrieving production data and generating response
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm leading-relaxed whitespace-pre-line">
                        {message.content}
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>

                        {message.type === "ai" && !message.isProcessing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDetailToggle(message)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              {message.isDetailed ? "Brief" : "Detail"}
                            </button>
                            <button
                              onClick={() => handleDownload(message.content)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input bar ──────────────────────────────────────── */}
          <div className="p-6 border-t border-border bg-card">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-3">

                {/* File upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl hover:bg-accent transition-colors border border-border"
                  title="Upload CSV or JSON file"
                >
                  <Paperclip className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Text area */}
                <div className="flex-1 bg-input-background rounded-xl border border-border focus-within:border-primary transition-colors">
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask about production data, shifts, predictions, alerts..."
                    className="w-full px-4 py-3 bg-transparent resize-none outline-none text-sm"
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                {/* Voice input */}
                <button
                  onClick={handleVoiceToggle}
                  className={`p-3 rounded-xl transition-colors border ${
                    isListening
                      ? "border-red-500 bg-red-50 animate-pulse"
                      : "border-border hover:bg-accent"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening
                    ? <MicOff className="w-5 h-5 text-red-500" />
                    : <Mic className="w-5 h-5 text-muted-foreground" />
                  }
                </button>

                {/* Send */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  className="p-3 rounded-xl text-white transition-all hover:opacity-90 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--gradient-warm)" }}
                >
                  {isLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Send className="w-5 h-5" />
                  }
                </button>
              </div>

              {isListening && (
                <div className="mt-2 text-center text-xs text-red-500 animate-pulse">
                  Listening... speak your query
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}