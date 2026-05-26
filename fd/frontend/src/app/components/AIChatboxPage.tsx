import { useState } from "react";
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
} from "lucide-react";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  showDetails?: boolean;
  isProcessing?: boolean;
}

interface ChatHistory {
  id: string;
  title: string;
  timestamp: Date;
  active?: boolean;
}

const mockChatHistory: ChatHistory[] = [
  { id: "1", title: "Line 4 Performance Analysis", timestamp: new Date(Date.now() - 3600000) },
  { id: "2", title: "REF Product Trends", timestamp: new Date(Date.now() - 7200000) },
  { id: "3", title: "Shift Comparison Report", timestamp: new Date(Date.now() - 86400000) },
];

export function AIChatboxPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content:
        "Hello! I'm your AI Production Assistant. I can help you analyze production data, predict performance, and provide insights. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const processingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: "ai",
      content: "Processing your query...",
      timestamp: new Date(),
      isProcessing: true,
    };

    setMessages((prev) => [...prev, processingMessage]);

    setTimeout(() => {
      setMessages((prev) => {
        const filtered = prev.filter(msg => !msg.isProcessing);

        const isLineQuery = inputText.toLowerCase().includes("line");
        const isPrediction = inputText.toLowerCase().includes("predict") || inputText.toLowerCase().includes("forecast");

        const aiResponse: Message = {
          id: (Date.now() + 2).toString(),
          type: "ai",
          content: isLineQuery
            ? `**Analysis Complete**\n\nLine 4 production performance:\n\n**Current Status:** The line is performing at 76% achievement, which is 18% below the target threshold of 80%. \n\n**Historical Comparison:** Compared to the last 7 days, this represents a -12% deviation from the average performance of 88%.\n\n**Prediction:** Based on current trends, the line will achieve approximately 78% by end of shift without intervention.\n\n**Recommendation:** Immediate intervention recommended. Analysis suggests equipment delay on station 3 as the primary cause.`
            : isPrediction
            ? `**Predictive Analysis**\n\n**Prediction for Next Shift:**\n- Expected achievement: 87-92% (confidence: 85%)\n- Estimated output: 8,850 units\n- Risk factors: Maintenance scheduled on Line 2\n\n**Context:** Analysis based on 156 historical records matching current production parameters.\n\n**Assessment:** Based on historical patterns and current trends, production targets are achievable with normal operations.`
            : `**Analysis Complete**\n\nI've analyzed your question using live production data and historical records from the last 30 days.\n\nThe analysis shows positive trends with a 2.3% increase compared to yesterday's performance. Would you like detailed insights on specific lines or products?`,
          timestamp: new Date(),
        };

        return [...filtered, aiResponse];
      });
    }, 2500);

    setInputText("");
  };

  const toggleDetails = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, showDetails: !msg.showDetails } : msg
      )
    );
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        type: "ai",
        content:
          "New chat started. How can I help you with production intelligence today?",
        timestamp: new Date(),
      },
    ]);
    setActiveChatId(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header title="AI Chatbox" />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 bg-card border-r border-border flex flex-col">
          <div className="p-4 space-y-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:bg-accent flex items-center justify-center gap-2"
              style={{
                borderColor: "var(--lg-orange)",
                color: "var(--lg-orange)"
              }}
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
              style={{
                borderColor: "var(--lg-blue)",
                color: "var(--lg-blue)"
              }}
            >
              <LayoutDashboard className="w-5 h-5" />
              Live Dashboard
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">
              Chat History
            </h3>
            <div className="space-y-2">
              {mockChatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    activeChatId === chat.id
                      ? "bg-accent border border-primary"
                      : "hover:bg-accent border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: "var(--lg-orange)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {chat.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {chat.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
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
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--lg-orange)" }} />
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Processing your query...</div>
                        <div className="text-xs text-muted-foreground">
                          Analyzing production data and generating insights
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm leading-relaxed whitespace-pre-line">{message.content}</div>

                      {message.showDetails && message.type === "ai" && (
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                          <div className="text-xs text-muted-foreground">
                            <div className="font-medium mb-2">Additional Details:</div>
                            <div>• Data analyzed from real-time and historical records</div>
                            <div>• Confidence level: High (85%+)</div>
                            <div>• Recommendation based on pattern analysis</div>
                            <div>• Updated continuously with live production data</div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        {message.type === "ai" && !message.isProcessing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleDetails(message.id)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              {message.showDetails ? "Hide" : "Details"}
                            </button>
                            <button className="px-3 py-1 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors flex items-center gap-1">
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
          </div>

          <div className="p-6 border-t border-border bg-card">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-3">
                <button className="p-3 rounded-xl hover:bg-accent transition-colors border border-border">
                  <Paperclip className="w-5 h-5 text-muted-foreground" />
                </button>

                <div className="flex-1 bg-input-background rounded-xl border border-border focus-within:border-primary transition-colors">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask about production data, trends, predictions..."
                    className="w-full px-4 py-3 bg-transparent resize-none outline-none"
                    rows={3}
                  />
                </div>

                <button className="p-3 rounded-xl hover:bg-accent transition-colors border border-border">
                  <Mic className="w-5 h-5 text-muted-foreground" />
                </button>

                <button
                  onClick={handleSendMessage}
                  className="p-3 rounded-xl text-white transition-all hover:opacity-90 shadow-lg"
                  style={{ background: "var(--gradient-warm)" }}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
