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
  Wrench,
  HelpCircle,
  BookOpen,
  History,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  Sparkles,
  Zap
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { 
  sendChatQuery, 
  sendTroubleshootQuery, 
  TroubleshootMatchManual, 
  TroubleshootMatchHistory 
} from "../../api";
import { reportClientError, checkAndReportInvalidLine } from "../../errorLogger";

// Types 
interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  isProcessing?: boolean;
  isDetailed?: boolean;  // true = Detail button hidden
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  history: { role: "user" | "assistant"; content: string }[];
}

interface DiagnosticReport {
  id: string;
  problem: string;
  response: string;
  manualMatches: TroubleshootMatchManual[];
  historyMatches: TroubleshootMatchHistory[];
  timestamp: Date;
  synthesized: boolean;
}

// Quick prompt suggestions for empty chat state
const CHAT_SUGGESTIONS = [
  { label: "Factory Status", prompt: "What is the current status of all production lines?" },
  { label: "Today's Summary", prompt: "Give me a factory summary for today" },
  { label: "WMC Performance", prompt: "What is the current achieve % for WMC lines?" },
  { label: "Line Predictions", prompt: "Which lines will miss today's plan?" },
  { label: "Alert Check", prompt: "Which lines are below threshold right now?" },
  { label: "Yesterday Recap", prompt: "What was the production result yesterday?" },
];

// Welcome message 
const makeWelcome = (): Message => ({
  id: "welcome-" + Date.now(),
  type: "ai",
  content:
    "Hello! I am your **LG AI Production Assistant**. I can help you analyse " +
    "live and historical production data, predict line performance, and surface " +
    "anomaly alerts.\n\nAsk me anything - you can type, use voice, or upload a CSV file.",
  timestamp: new Date(),
  isDetailed: true, // no Detail button on welcome
});

export function AIChatboxPage() {
  const navigate = useNavigate();

  // Navigation / Mode tabs state
  const [activeTab, setActiveTab] = useState<"chat" | "troubleshoot">("chat");
  const [showHelp, setShowHelp] = useState(false);

  // Chat state 
  const [messages, setMessages] = useState<Message[]>([makeWelcome()]);
  const [inputText, setInputText]   = useState("");
  const [isLoading, setIsLoading]   = useState(false);

  // Troubleshooting State
  const [troubleshootInput, setTroubleshootInput] = useState("");
  const [diagnosticReports, setDiagnosticReports] = useState<DiagnosticReport[]>([]);
  const [expandedReportIds, setExpandedReportIds] = useState<Record<string, boolean>>({});
  const [openHelpSections, setOpenHelpSections] = useState<Record<number, boolean>>({ 0: true });

  // Conversation history sent to /api/chat for multi-turn support
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  // Session sidebar
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('lg-chat-sessions')
      if (!saved) return []
      const parsed = JSON.parse(saved)
      return parsed.map((s: ChatSession) => ({
        ...s,
        timestamp: new Date(s.timestamp),
        messages:  s.messages.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      }))
    } catch {
      return []
    }
  })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Voice input
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // File upload 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, diagnosticReports]);

  // Send message 
  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isLoading) return;
    setInputText("");

    // Validate line codes
    await checkAndReportInvalidLine(text, "/chatbox");

    const userMsg: Message = {
      id:        Date.now().toString(),
      type:      "user",
      content:   text,
      timestamp: new Date(),
      isDetailed: true, // no Detail button on user messages
    };

    const processingId = (Date.now() + 1).toString();
    const processingMsg: Message = {
      id:          processingId,
      type:        "ai",
      content:     "Processing your query...",
      timestamp:   new Date(),
      isProcessing: true,
      isDetailed:  true,
    };

    setMessages(prev => [...prev, userMsg, processingMsg]);
    setIsLoading(true);

    try {
      const result = await sendChatQuery(text, conversationHistory);

      const updatedHistory = [
        ...conversationHistory,
        { role: "user"      as const, content: text },
        { role: "assistant" as const, content: result.response },
      ];
      setConversationHistory(updatedHistory);

      const aiMsg: Message = {
        id:        (Date.now() + 2).toString(),
        type:      "ai",
        content:   result.response,
        timestamp: new Date(),
        isDetailed: false, // Detail button shown
      };

      setMessages(prev => [...prev.filter(m => m.id !== processingId), aiMsg]);

      // Save first exchange as a new session
      setSessions(prev => {
        let updated: ChatSession[]
        if (!activeSessionId) {
          // First message — create new session
          const newSession: ChatSession = {
            id:        Date.now().toString(),
            title:     text.length > 42 ? text.slice(0, 42) + "..." : text,
            timestamp: new Date(),
            messages:  [...messages, userMsg, aiMsg],
            history:   updatedHistory,
          }
          setActiveSessionId(newSession.id)
          updated = [newSession, ...prev]
        } else {
          // Subsequent messages — update existing session
          updated = prev.map(s =>
            s.id === activeSessionId
            ? {
              ...s,
              messages: [...messages, userMsg, aiMsg],
              history:  updatedHistory,
            }
            : s
          )
        }
        localStorage.setItem('lg-chat-sessions', JSON.stringify(updated))
        return updated
      });
    } catch (err) {
      reportClientError("ERR_001", err instanceof Error ? err.message : "Chat query request failed", {
        query: text,
      });
      setMessages(prev => [
        ...prev.filter(m => m.id !== processingId),
        {
          id:        (Date.now() + 2).toString(),
          type:      "ai",
          content:   "Could not reach the backend. Please make sure the " +
                     "FastAPI server is running on port 8000.",
          timestamp: new Date(),
          isDetailed: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Detail
  const handleDetailToggle = async (message: Message) => {
    if (isLoading) return;

    setIsLoading(true);

    // Hide Detail button on original message immediately
    setMessages(prev =>
      prev.map(m => m.id === message.id ? { ...m, isDetailed: true } : m)
    );

    const lastUserMessage = conversationHistory
      .filter(m => m.role === "user")
      .slice(-1)[0]?.content ?? "";
    const detailQuery = lastUserMessage
      ? `Give me a detailed breakdown for: ${lastUserMessage}`
      : "detail";

    try {
      const result = await sendChatQuery(detailQuery, conversationHistory);

      setConversationHistory(prev => [
        ...prev,
        { role: "user"      as const, content: detailQuery },
        { role: "assistant" as const, content: result.response },
      ]);

      setMessages(prev => [
        ...prev,
        {
          id:        (Date.now() + 2).toString(),
          type:      "ai" as const,
          content:   result.response,
          timestamp: new Date(),
          isDetailed: true, // no Detail button on detailed response
        },
      ]);
    } catch (err) {
      reportClientError("ERR_001", err instanceof Error ? err.message : "Detail request failed", {
        query: detailQuery,
      });
      // Restore Detail button if call failed
      setMessages(prev =>
        prev.map(m => m.id === message.id ? { ...m, isDetailed: false } : m)
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Download response
  const handleDownload = (content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `LG_Response_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDiagnostic = (report: DiagnosticReport) => {
    const lines = [
      `============================================================`,
      `LG ELECTRONICS — EQUIPMENT DIAGNOSTIC REPORT`,
      `============================================================`,
      `Date/Time : ${report.timestamp.toLocaleString()}`,
      `Report ID : DIAG-${report.id}`,
      `Reported Problem:`,
      `  "${report.problem}"`,
      ``,
      `DIAGNOSTIC SYNTHESIS (GEMINI AI):`,
      `------------------------------------------------------------`,
      report.response,
      ``,
      `OFFICIAL LG MANUAL SOLUTIONS:`,
      `------------------------------------------------------------`,
      report.manualMatches.length === 0
        ? "No direct matches found in official LG manual."
        : report.manualMatches.map((m, idx) => 
            `[${idx + 1}] Category: ${m.category}\n` +
            `    Problem: ${m.problem}\n` +
            `    Solution: ${m.manual_solution}\n`
          ).join("\n"),
      ``,
      `HISTORICAL RESOLUTION RECORDS:`,
      `------------------------------------------------------------`,
      report.historyMatches.length === 0
        ? "No matching historical resolution logs found."
        : report.historyMatches.map((h, idx) => 
            `[${idx + 1}] Problem: ${h.problem}\n` +
            `    Action Taken: ${h.action_taken}\n` +
            `    Outcome: ${h.outcome}\n` +
            `    Date: ${h.date}\n`
          ).join("\n"),
      `============================================================`,
      `Generated by LG AI Production Intelligence Chatbox`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `LG_DiagnosticReport_${report.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendTroubleshoot = async (overrideText?: string) => {
    const problemText = (overrideText ?? troubleshootInput).trim();
    if (!problemText || isLoading) return;
    setTroubleshootInput("");

    // Validate line codes
    await checkAndReportInvalidLine(problemText, "/chatbox");

    setIsLoading(true);
    
    // Add temporary loading report
    const tempReportId = Date.now().toString();
    const newReport: DiagnosticReport = {
      id: tempReportId,
      problem: problemText,
      response: "Running diagnostics against LG manuals and past logs...",
      manualMatches: [],
      historyMatches: [],
      timestamp: new Date(),
      synthesized: false
    };
    
    setDiagnosticReports(prev => [...prev, newReport]);

    try {
      const result = await sendTroubleshootQuery(problemText);
      setDiagnosticReports(prev =>
        prev.map(r =>
          r.id === tempReportId
            ? {
                ...r,
                response: result.response,
                manualMatches: result.manual_matches,
                historyMatches: result.history_matches,
                synthesized: result.synthesized
              }
            : r
        )
      );
      // Auto expand matches for this new report
      setExpandedReportIds(prev => ({ ...prev, [tempReportId]: true }));
    } catch (err) {
      reportClientError("ERR_001", err instanceof Error ? err.message : "Troubleshoot query request failed", {
        query: problemText,
      });
      setDiagnosticReports(prev =>
        prev.map(r =>
          r.id === tempReportId
            ? {
                ...r,
                response: "Failed to connect to the troubleshooting database. Make sure the FastAPI backend is running.",
              }
            : r
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // New chat
  const handleNewChat = () => {
    setMessages([makeWelcome()])
    setConversationHistory([])
    setActiveSessionId(null)
  }

  const handleClearHistory = () => {
    setSessions([])
    setActiveSessionId(null)
    setMessages([makeWelcome()])
    setConversationHistory([])
    localStorage.removeItem('lg-chat-sessions')
  }

  // Delete individual session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      localStorage.setItem('lg-chat-sessions', JSON.stringify(updated));
      return updated;
    });
    if (activeSessionId === sessionId) {
      handleNewChat();
    }
  }

  // Load session 
  const handleLoadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setConversationHistory(session.history);
    setActiveSessionId(session.id);
  };

  // Voice input
  const handleVoiceToggle = () => {
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      reportClientError(
        "INFO_004",
        "Voice input requested but SpeechRecognition is unavailable in this browser.",
        { page: "/chatbox" }
      );
      alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: any = new SR();

    recognition.lang           = "en-IN";
    recognition.continuous     = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (activeTab === "chat") {
        setInputText(transcript);
      } else {
        setTroubleshootInput(transcript);
      }
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

    // INFO_003 — only .csv and .json are supported for sandbox analysis
    const isValidFormat = /\.(csv|json)$/i.test(file.name);
    if (!isValidFormat) {
      reportClientError(
        "INFO_003",
        `Unsupported file format uploaded: "${file.name}"`,
        { page: "/chatbox" }
      );
      alert("Please upload a .csv or .json file.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const preview = content.slice(0, 300);
      if (activeTab === "chat") {
        setInputText(
          `I have uploaded a file: ${file.name}\n\nPreview:\n${preview}\n\nPlease analyse this production data.`
        );
      } else {
        setTroubleshootInput(
          `I have uploaded a file: ${file.name}\n\nPreview:\n${preview}\n\nPlease troubleshoot this issue.`
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Group sessions by date for sidebar
  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const groups: Record<string, ChatSession[]> = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    sessions.forEach(s => {
      const d = new Date(s.timestamp);
      let label: string;
      if (d.toDateString() === today.toDateString()) label = 'Today';
      else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      else label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(s);
    });
    return groups;
  };
  const sessionGroups = groupSessionsByDate(sessions);

  // Render 
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />

      <div
        className="flex-1 flex overflow-hidden relative min-h-0"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* Sidebar */}
        <div className="w-72 flex flex-col flex-shrink-0 sticky top-0 h-full overflow-hidden sidebar">
          <div className="p-4 space-y-3">
            {/* Back to dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="btn-secondary w-full py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
              style={{ color: "var(--lg-red)", borderColor: "var(--border)" }}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>

            {/* New chat */}
            <button
              onClick={handleNewChat}
              className="btn-primary w-full py-3 rounded-2xl text-white font-semibold transition-all flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Plus className="w-5 h-5" />
              New Chat
            </button>

            {/* Live dashboard */}
            <button
              onClick={() => navigate("/live-dashboard")}
              className="btn-secondary w-full py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
              style={{ color: "var(--lg-red)", borderColor: "var(--border)" }}
            >
              <LayoutDashboard className="w-5 h-5" />
              Live Dashboard
            </button>

            {/* Help & Keywords Drawer Trigger */}
            <button
              onClick={() => setShowHelp(prev => !prev)}
              className="btn-secondary w-full py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2"
              style={{ color: "var(--lg-red)", borderColor: "var(--border)" }}
            >
              <HelpCircle className="w-5 h-5" />
              Help & Keywords
            </button>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto p-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Chat History
              </h3>
              {sessions.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors font-medium"
                >
                  Clear All
                </button>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className="text-center mt-8 space-y-3">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                              style={{ background: "var(--lg-red-soft)" }}>
                              <History className="w-6 h-6" style={{ color: "var(--lg-red)" }} />
                            </div>
                <p className="text-xs text-muted-foreground">
                  Your chat sessions will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(sessionGroups).map(([dateLabel, groupSessions]) => (
                  <div key={dateLabel}>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                      {dateLabel}
                    </div>
                    <div className="space-y-1.5">
                      {groupSessions.map(session => (
                        <div
                          key={session.id}
                          className={`group relative w-full text-left p-3 rounded-2xl transition-all cursor-pointer ${
                            activeSessionId === session.id && activeTab === "chat"
                              ? "border shadow-sm"
                              : "hover:bg-accent border border-transparent"
                          }`}
                          style={activeSessionId === session.id && activeTab === "chat" ? { 
                            background: "var(--lg-red-soft)", 
                            borderColor: "var(--lg-red-hover)" 
                          } : {}}
                          onClick={() => {
                            setActiveTab("chat");
                            handleLoadSession(session);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <MessageSquare
                              className="w-4 h-4 mt-0.5 flex-shrink-0"
                              style={{ color: "var(--lg-red)" }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground truncate pr-6">
                                {session.title}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {session.timestamp.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            className="absolute top-2.5 right-2.5 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            style={{ background: "transparent" }}
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-error-red" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Workspace Area (Chat / Troubleshoot) */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Top Tabs Segmented Control */}
          <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex gap-2">
              <button
                onClick={() => { setActiveTab("chat"); setShowHelp(false); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "chat"
                    ? "shadow-sm border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={activeTab === "chat" ? { color: "var(--lg-red)", background: "var(--lg-red-soft)", borderColor: "var(--border)" } : {}}
              >
                <MessageSquare className="w-4 h-4" />
                AI Q&A Assistant
              </button>
              <button
                onClick={() => { setActiveTab("troubleshoot"); setShowHelp(false); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === "troubleshoot"
                    ? "shadow-sm border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={activeTab === "troubleshoot" ? { color: "var(--lg-red)", background: "var(--lg-red-soft)", borderColor: "var(--border)" } : {}}
              >
                <Wrench className="w-4 h-4" />
                Equipment Diagnostics
              </button>
            </div>
          </div>

          {/* Conditional Body Content */}
          <div className="flex-1 overflow-y-auto p-6 workspace">
            
            {activeTab === "chat" ? (
              // standard Chat Screen
              <div className="space-y-6 max-w-4xl mx-auto">
                {/* Quick Prompt Suggestions — shown when only welcome message exists */}
                {messages.length === 1 && messages[0].id.startsWith('welcome') && (
                  <div className="animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4" style={{ color: 'var(--lg-red)' }} />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Prompts</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {CHAT_SUGGESTIONS.map(s => (
                        <button
                          key={s.label}
                          onClick={() => handleSendMessage(s.prompt)}
                          className="text-left p-3 rounded-2xl border transition-all group card-premium"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3.5 h-3.5 transition-opacity opacity-60 group-hover:opacity-100" style={{ color: 'var(--lg-red)' }} />
                            <span className="text-xs font-bold text-foreground">{s.label}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{s.prompt}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message, msgIdx) => (
                  <div
                    key={message.id}
                    className={`flex animate-fadeInUp ${
                      message.type === "user" ? "justify-end" : "justify-start"
                    }`}
                    style={{ animationDelay: `${Math.min(msgIdx * 0.05, 0.3)}s` }}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl p-4 ${
                        message.type === "user"
                          ? "text-white chat-user"
                          : "chat-ai"
                      }`}
                    >
                      {/* Processing indicator */}
                      {message.isProcessing ? (
                        <div className="flex items-center gap-4 py-1">
                          <div className="flex items-center gap-1 px-1">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-sm font-medium text-foreground">
                              Analysing production data...
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Querying database & generating AI response
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Message content with markdown */}
                          <div
                            className={`text-sm leading-relaxed prose prose-sm max-w-none ${
                              message.type === "user"
                                ? "prose-invert"
                                : "dark:prose-invert"
                            }`}
                          >
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>

                          {/* Timestamp + action buttons */}
                          <div className="flex items-center justify-between mt-3 gap-8">
                            <div
                              className={`text-xs ${
                                message.type === "user"
                                  ? "text-white/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>

                            {/* Buttons only on AI messages */}
                            {message.type === "ai" && (
                              <div className="flex gap-2">
                                {/* Detail button — hidden once clicked */}
                                {!message.isDetailed && (
                                  <button
                                    onClick={() => handleDetailToggle(message)}
                                    disabled={isLoading}
                                    className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 disabled:opacity-50 btn-secondary"
                                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                                  >
                                    <Eye className="w-3 h-3" />
                                    Detail
                                  </button>
                                )}

                                {/* Download always shown */}
                                <button
                                  onClick={() => handleDownload(message.content)}
                                  className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 disabled:opacity-50 btn-secondary"
                                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
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
                <div ref={messagesEndRef} className="h-4" />
              </div>
            ) : (
              // Troubleshooting Diagnostics Screen
              <div className="space-y-6 max-w-4xl mx-auto">
                {diagnosticReports.length === 0 ? (
                  // empty Diagnostics State
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto space-y-6">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center" 
                      style={{ background: "var(--lg-red-soft)", boxShadow: "var(--shadow-md)" }}>
                      <Wrench className="w-10 h-10" style={{ color: "var(--lg-red)" }} />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">Equipment Diagnostics</h2>
                      <p className="text-sm text-muted-foreground">
                        Describe machinery issues, sensor faults, or line errors. Our diagnostic engine 
                        queries the official LG Maintenance Manual and historical resolution logs to synthesize 
                        a step-by-step resolution guide.
                      </p>
                    </div>
                    
                    <div className="w-full space-y-3 pt-4">
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Common Factory Floor Faults
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {TROUBLESHOOT_SUGGESTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => handleSendTroubleshoot(s)}
                            className="px-3.5 py-2 text-xs font-semibold rounded-xl transition-all card-premium text-left"
                            style={{ borderColor: "var(--border)" }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Diagnostics Reports List
                  diagnosticReports.map(report => (
                    <div key={report.id} className="rounded-2xl p-6 space-y-4 card-premium">
                      {/* Question Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" 
                          style={{ background: "var(--lg-red-soft)", color: "var(--lg-red)" }}>
                          <Info className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground font-semibold">Reported Issue</div>
                          <div className="text-sm font-medium text-foreground mt-0.5">"{report.problem}"</div>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {report.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      
                      <hr style={{ borderColor: "var(--border)" }} />
                      
                      {/* Synthesis Response */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                          {report.response.startsWith("Running") ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--lg-red)" }} />
                          ) : (
                            <Wrench className="w-3.5 h-3.5" style={{ color: "var(--lg-red)" }} />
                          )}
                          <span>AI Diagnostic Guidance</span>
                        </div>
                        <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{report.response}</ReactMarkdown>
                        </div>
                      </div>

                      {/* Reference Database Matches */}
                      {report.synthesized && (
                        <>
                          <hr style={{ borderColor: "var(--border)" }} />
                          <div className="space-y-3">
                            <button
                              onClick={() => setExpandedReportIds(prev => ({ ...prev, [report.id]: !prev[report.id] }))}
                              className="flex items-center justify-between w-full text-xs font-bold text-muted-foreground uppercase hover:text-foreground transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Database Reference Material ({report.manualMatches.length + report.historyMatches.length} sources)</span>
                              </div>
                              {expandedReportIds[report.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {expandedReportIds[report.id] && (
                              <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                                {/* Manual matches */}
                                {report.manualMatches.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--lg-red)" }}>
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--lg-red)" }} />
                                      Official LG Manual Guides
                                    </div>
                                    <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                                      {report.manualMatches.map(m => (
                                        <div key={m.id} className="p-3 rounded-xl border transition-all"
                                          style={{ background: "var(--lg-red-soft)", borderColor: "var(--border)" }}>
                                          <div className="font-semibold text-foreground mb-1">
                                            Category: {m.category} | {m.problem}
                                          </div>
                                          <div className="text-muted-foreground text-xs">{m.manual_solution}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* History matches */}
                                {report.historyMatches.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--success-green)" }}>
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--success-green)" }} />
                                      Historical Resolution Logs
                                    </div>
                                    <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                                      {report.historyMatches.map(h => (
                                        <div key={h.id} className="p-3 rounded-xl border transition-all"
                                          style={{ background: "rgba(13, 159, 110, 0.05)", borderColor: "var(--border)" }}>
                                          <div className="font-semibold text-foreground mb-1 text-xs">{h.problem}</div>
                                          <div className="text-muted-foreground mb-1 text-xs"><span className="font-semibold text-foreground">Action:</span> {h.action_taken}</div>
                                          <div className="text-muted-foreground text-xs"><span className="font-semibold text-foreground">Outcome:</span> {h.outcome} <span className="opacity-70">({h.date})</span></div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Actions */}
                      {!report.response.startsWith("Running") && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
                          <button
                            onClick={() => handleDownloadDiagnostic(report)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 btn-secondary"
                            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export Diagnostic Report
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Dynamic Input Bar (Common for both tabs) */}
          <div className="p-6 border-t border-border bg-card flex-shrink-0" style={{ boxShadow: "var(--shadow-inner)", background: "var(--card-secondary)" }}>
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
                  className="p-3 rounded-xl transition-colors border"
                  style={{ borderColor: "var(--border)", background: "transparent" }}
                  title="Upload CSV or JSON file"
                >
                  <Paperclip className="w-5 h-5 text-muted-foreground" />
                </button>

                {/* Text area */}
                <div className="flex-1 rounded-xl border focus-within:border-[var(--lg-red)] transition-colors" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                  <textarea
                    value={activeTab === "chat" ? inputText : troubleshootInput}
                    onChange={e => activeTab === "chat" ? setInputText(e.target.value) : setTroubleshootInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (activeTab === "chat") {
                          handleSendMessage();
                        } else {
                          handleSendTroubleshoot();
                        }
                      }
                    }}
                    placeholder={
                      activeTab === "chat" 
                        ? "Ask about production data, shifts, predictions, alerts..." 
                        : "Describe the equipment error or machinery fault to diagnose..."
                    }
                    className="w-full px-4 py-3 bg-transparent resize-none outline-none text-sm"
                    style={{ color: "var(--foreground)" }}
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                {/* Voice Input */}
                <button
                  onClick={handleVoiceToggle}
                  className={`p-3 rounded-xl transition-colors border ${
                    isListening
                      ? "animate-pulse animate-duration-1000"
                      : ""
                  }`}
                  style={{
                    borderColor: isListening ? "var(--lg-red)" : "var(--border)",
                    background: isListening ? "var(--lg-red-soft)" : "transparent"
                  }}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening
                    ? <MicOff className="w-5 h-5" style={{ color: "var(--lg-red)" }} />
                    : <Mic className="w-5 h-5 text-muted-foreground" />
                  }
                </button>

                {/* Send */}
                <button
                  onClick={() => activeTab === "chat" ? handleSendMessage() : handleSendTroubleshoot()}
                  disabled={isLoading || (activeTab === "chat" ? !inputText.trim() : !troubleshootInput.trim())}
                  className="p-3 rounded-xl text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {isLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Send className="w-5 h-5" />
                  }
                </button>
              </div>

              {isListening && (
                <div className="mt-2 text-center text-xs animate-pulse font-medium"
                    style={{ color: "var(--lg-red)" }} >
                  Listening... speak your query
                </div>
              )}

              <div className="mt-2 text-center text-xs text-muted-foreground">
                Press Enter to send · Shift+Enter for new line · Supports voice and file upload
              </div>
            </div>
          </div>
        </div>

        {/* Slide-out Help & Keywords drawer */}
        {showHelp && (
          <div className="w-96 bg-card border-l border-border flex flex-col flex-shrink-0 animate-in slide-in-from-right duration-200 z-10" style={{ boxShadow: "var(--shadow-lg)" }}>
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0"
              style={{ background: "var(--lg-red-soft)" }}>
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" style={{ color: "var(--lg-red)" }} />
                <h3 className="font-bold text-foreground text-sm" style={{ color: "var(--lg-red)" }}>Help & Keywords Guide</h3>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 rounded-lg transition-colors"
                style={{ background: "transparent" }}
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Accordion List Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "var(--card-secondary)" }}>
              {HELP_SECTIONS.map((section, idx) => {
                const isOpen = openHelpSections[idx] || false;
                return (
                  <div key={idx} className="border rounded-xl bg-card overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}>
                    <button
                      onClick={() => setOpenHelpSections(prev => ({ ...prev, [idx]: !isOpen }))}
                      className="w-full px-4 py-3 flex items-center justify-between text-left font-semibold text-sm transition-all text-foreground"
                      style={{ background: "transparent" }}
                    >
                      <span>{section.title}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-1 duration-150" style={{ background: "var(--card-secondary)" }}>
                        {section.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Suggestions for Troubleshooting Diagnostic Tab
const TROUBLESHOOT_SUGGESTIONS = [
  "Line R1 conveyor motor overheating",
  "PCB01 soldering nozzle clogged",
  "W1 drum balance test high failure rate",
  "WP1 filter capping torque out of range",
  "CM1 helium leak detector false alarm"
];

// Content sections for sliding Help drawer accordions
const HELP_SECTIONS = [
  {
    title: "1. How to Ask Queries",
    content: (
      <div className="space-y-4 text-xs">
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>LIVE / CURRENT QUERIES</h4>
          <p className="text-muted-foreground mb-1.5">Use keywords like `current`, `right now`, `latest`, `live` for real-time statistics:</p>
          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
            <li>"What is the current status of WMC?"</li>
            <li>"What is CM1's result right now?"</li>
            <li>"What is the live achieve % for REF lines?"</li>
          </ul>
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>HISTORICAL QUERIES</h4>
          <p className="text-muted-foreground mb-1.5">Query past days and shifts (weekends excluded):</p>
          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
            <li><strong>Relative:</strong> "What was WMC doing yesterday?"</li>
            <li><strong>Specific Date:</strong> "What was the result of CM1 on 19th May 2026?"</li>
            <li><strong>Date + Time:</strong> "What was CM1's result on 20th May 2026 at 4pm?"</li>
            <li><strong>Shift-based:</strong> "What was REF doing in the early morning shift yesterday?"</li>
          </ul>
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>PREDICTIVE QUERIES</h4>
          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
            <li>"Will WMC meet today's plan?"</li>
            <li>"Is CM1 on track for the evening shift?"</li>
            <li>"What is R1's projected end-of-day result?"</li>
          </ul>
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>ALERT & SUMMARY QUERIES</h4>
          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
            <li>"Which lines are below threshold right now?"</li>
            <li>"Give me a factory summary for today"</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    title: "2. Abbreviations & Line Codes",
    content: (
      <div className="space-y-3 text-xs text-muted-foreground">
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>PRODUCTS</h4>
          <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
            <div>REF : Refrigerator</div>
            <div>WMC : Washing Machine</div>
            <div>COMP: Compressor</div>
            <div>RAC : Residential AC</div>
            <div>A08 : Water Purifier</div>
          </div>
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>PRODUCTION LINES</h4>
          <ul className="space-y-0.5 font-mono text-[10px] list-disc pl-4">
            <li>REF lines : R1, R2, PCB01, PCB03</li>
            <li>WMC lines : W1, W2, PCB04</li>
            <li>COMP lines: CM1, CM2</li>
            <li>RAC lines : A1, A4, PCB02</li>
            <li>A08 lines : WP1</li>
          </ul>
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <h4 className="font-bold mb-1" style={{ color: "var(--lg-red)" }}>DATABASE TERMS</h4>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Plan:</strong> Daily EOD target units</li>
            <li><strong>Target:</strong> Expected units at current time</li>
            <li><strong>Result:</strong> Actual units produced so far</li>
            <li><strong>Achieve %:</strong> Result / Target × 100</li>
            <li><strong>Threshold:</strong> 80% (underperforming if below)</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    title: "3. Production Shifts",
    content: (
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>Snapshots are captured at the end of each shift phase:</p>
        <div className="space-y-1.5 font-mono text-[10px]">
          <div className="flex justify-between border-b pb-0.5" style={{ borderColor: "var(--border)" }}>
            <span>Phase 1: Early Morning</span>
            <span>9:00 AM – 10:30 AM</span>
          </div>
          <div className="flex justify-between border-b pb-0.5" style={{ borderColor: "var(--border)" }}>
            <span>Phase 2: Peak Day</span>
            <span>10:30 AM – 1:30 PM</span>
          </div>
          <div className="flex justify-between border-b pb-0.5" style={{ borderColor: "var(--border)", color: "var(--error-red)" }}>
            <span>[Downtime Break]</span>
            <span>1:30 PM – 2:00 PM</span>
          </div>
          <div className="flex justify-between border-b pb-0.5" style={{ borderColor: "var(--border)" }}>
            <span>Phase 3: Afternoon</span>
            <span>2:00 PM – 4:00 PM</span>
          </div>
          <div className="flex justify-between pb-0.5">
            <span>Phase 4: Evening</span>
            <span>4:00 PM – 6:00 PM</span>
          </div>
        </div>
        <div className="p-2 rounded text-[10px] italic border-l-2 mt-2 text-muted-foreground"
          style={{ background: "var(--lg-red-soft)", borderColor: "var(--lg-red)" }}>
          Note: Queries between snapshots return the closest available snapshot data.
        </div>
      </div>
    )
  },
  {
    title: "4. Query Keywords Reference",
    content: (
      <div className="space-y-2.5 text-xs text-muted-foreground font-mono text-[10px]">
        <div>
          <span className="font-bold block" style={{ color: "var(--lg-red)" }}>TIME:</span>
          right now, current, currently, now, latest, live, today, yesterday, day before yesterday, this shift
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <span className="font-bold block" style={{ color: "var(--lg-red)" }}>SHIFTS:</span>
          early morning shift, peak day shift, afternoon shift, evening shift, downtime
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <span className="font-bold block" style={{ color: "var(--lg-red)" }}>INTENTS:</span>
          result, target, plan, achieve, predict, on track, forecast, alert, summary, total
        </div>
        <hr style={{ borderColor: "var(--border)" }} />
        <div>
          <span className="font-bold block" style={{ color: "var(--lg-red)" }}>DETAIL:</span>
          Click "Detail" button or type `detail` to get a full line-by-line breakdown.
        </div>
      </div>
    )
  },
  {
    title: "5. Tips for Best Results",
    content: (
      <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground">
        <li>✓ Use exact line codes (CM1, W1, PCB04) or product codes (WMC, REF, COMP).</li>
        <li>✓ Specify date formats clearly: "19th May 2026" or "2026-05-19".</li>
        <li>✓ Weekends have no production data. Only query working days (Mon-Fri).</li>
        <li>✓ For shift-specific data, use exact shift names like "peak day shift" rather than just "afternoon".</li>
        <li>✓ Use voice input for hands-free floor monitoring.</li>
        <li>✓ Upload your own CSV/JSON files for sandboxed visual analysis.</li>
      </ul>
    )
  }
];