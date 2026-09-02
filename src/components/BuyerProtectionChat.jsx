import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { withTimeout } from "@/lib/withTimeout";
import { toast } from "sonner";

export default function BuyerProtectionChat() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    startConversation();
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversationId, (data) => {
      setMessages(data.messages || []);
      setBusy(false);
    });
    return () => unsubscribe();
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    try {
      const conversation = await withTimeout(
        base44.agents.createConversation({
          agent_name: "buyer_protection",
          metadata: { name: "Buyer Protection" },
        }),
        15000,
        "Starting assistant"
      );
      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
    } catch (err) {
      console.error("Failed to start conversation", err);
      toast.error("Couldn't start the assistant. Please try again.");
    } finally {
      setInitializing(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversationId || busy) return;
    setInput("");
    setBusy(true);
    try {
      const conversation = base44.agents.getConversation(conversationId);
      await base44.agents.addMessage(conversation, { role: "user", content: text });
    } catch (err) {
      console.error("Failed to send message", err);
      toast.error("Couldn't send your message. Please try again.");
      setBusy(false);
    }
  };

  const toolCallStatus = (tc) => {
    const s = tc.status;
    if (["failed", "error"].includes(s)) return "failed";
    if (["pending", "running", "in_progress"].includes(s)) return "running";
    return "done";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60">
        <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Buyer Protection Assistant</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Help with a completed order</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {initializing ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={isUser ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}>
                  {m.content && (
                    isUser ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )
                  )}
                  {m.tool_calls?.map((tc, idx) => {
                    const status = toolCallStatus(tc);
                    const label = tc.name === "update_order" ? "Opening dispute" : tc.name === "list_orders" || tc.name === "filter_orders" ? "Checking your orders" : "Working";
                    const running = status === "running";
                    return (
                      <div key={idx} className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {running ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : status === "failed" ? (
                          <span className="text-destructive">⚠</span>
                        ) : (
                          <span className="text-green-600">✓</span>
                        )}
                        <span>{running ? `${label}…` : status === "failed" ? "Action failed" : "Done"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        {busy && !messages.some((m) => m.role === "assistant" && m.content) && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card/60">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe the issue with your order…"
            className="rounded-xl min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button onClick={handleSend} disabled={!input.trim() || busy || initializing} className="rounded-xl h-11 px-3 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}