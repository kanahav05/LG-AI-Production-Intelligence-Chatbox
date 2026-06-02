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
import ReactMarkdown from "react-markdown";
import { sendChatQuery } from "../../api";

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

// Welcome message 
const makeWelcome = (): Message => ({
  id: "welcome-" + Date.now(),
  type: "ai",
  content:
    "Hello! I am your LG AI Production Assistant. I can help you analyse " +
    "live and historical production data, predict line performance, and surface " +
    "anomaly alerts.\n\nAsk me anything — you can type, use voice, or upload a CSV file.",
  timestamp: new Date(),
  isDetailed: true, // no Detail button on welcome
});

export function AIChatboxPage() {
  const navigate = useNavigate();

  // Chat state 
  const [messages, setMessages] = useState<Message[]>([makeWelcome()]);
  const [inputText, setInputText]   = useState("");
  const [isLoading, setIsLoading]   = useState(false);

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
    // Restore Date objects from JSON strings
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
  }, [messages]);

  // Send message 
  const handleSendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
    if (!text || isLoading) return;
    setInputText("");

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
    } catch {
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

    try {
      const lastUserMessage = conversationHistory
      .filter(m => m.role === "user")
      .slice(-1)[0]?.content ?? "";
      const detailQuery = lastUserMessage
      ? `Give me a detailed breakdown for: ${lastUserMessage}`
      : "detail";
      
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
    } catch {
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

  // Load session 
  const handleLoadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setConversationHistory(session.history);
    setActiveSessionId(session.id);
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
      const preview = content.slice(0, 300);
      setInputText(
        `I have uploaded a file: ${file.name}\n\nPreview:\n${preview}\n\nPlease analyse this production data.`
      );
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Render 
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header/>

      <div
        className="flex-1 flex overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}
      >
        {/* Sidebar */}
        <div className="w-72 bg-card border-r border-border flex flex-col flex-shrink-0 sticky top-0 h-full overflow-hidden">
          <div className="p-4 space-y-3">
            {/* Back to dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all flex items-center justify-center gap-2 hover:opacity-90"
              style={{ borderColor: "#A50034", color: "#A50034" }}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>

            {/* New chat */}
            <button
              onClick={handleNewChat}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: "#A50034" }}
            >
              <Plus className="w-5 h-5" />
              New Chat
            </button>

            {/* Live dashboard */}
            <button
              onClick={() => navigate("/live-dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:bg-accent flex items-center justify-center gap-2"
              style={{ borderColor: "#A50034", color: "#A50034" }}
            >
              <LayoutDashboard className="w-5 h-5" />
              Live Dashboard
            </button>
          </div>

          {/* Chat history */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase">
                Chat History
                </h3>
                {sessions.length > 0 && (
                  <button
                  onClick={handleClearHistory}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
             </div>
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
                        ? "border bg-red-50 dark:bg-red-950"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare
                        className="w-4 h-4 mt-1 flex-shrink-0"
                        style={{ color: "#A50034" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {session.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {session.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
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

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-2xl ${
                    message.type === "user"
                      ? "text-white"
                      : "bg-card border border-border"
                  } rounded-2xl p-4 shadow-md`}
                  style={message.type === "user" ? { background: "#A50034" } : {}}
                >
                  {/* Processing indicator */}
                  {message.isProcessing ? (
                    <div className="flex items-center gap-3">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ background: "#A50034" }}
                      />
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          Processing your query...
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Retrieving production data and generating response
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
                      <div className="flex items-center justify-between mt-3">
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
                                className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 disabled:opacity-50 hover:bg-red-50"
                                style={{ borderColor: "#A50034", color: "#A50034" }}                           
                              >
                                <Eye className="w-3 h-3" />
                                Detail
                              </button>
                            )}

                            {/* Download always shown */}
                            <button
                              onClick={() => handleDownload(message.content)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 disabled:opacity-50 hover:bg-red-50"
                              style={{ borderColor: "#A50034", color: "#A50034" }}
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

          {/* Input bar */}
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
                <div className="flex-1 bg-background rounded-xl border border-border focus-within:border-primary transition-colors">
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

                {/* Voice */}
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
                    : <Mic    className="w-5 h-5 text-muted-foreground" />
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
                    : <Send    className="w-5 h-5" />
                  }
                </button>
              </div>

              {isListening && (
                <div className="mt-2 text-center text-xs animate-pulse font-medium"
                    style={{ color: "#A50034" }} >
                  Listening... speak your query
                </div>
              )}

              <div className="mt-2 text-center text-xs text-muted-foreground">
                Press Enter to send · Shift+Enter for new line · Supports voice and file upload
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}