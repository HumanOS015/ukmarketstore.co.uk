import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, ArrowLeft, Send, Shield } from "lucide-react";
import { toast } from "sonner";

export default function SellerMessages() {
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get("conversation");
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || conversations[0] || null,
    [conversations, selectedId]
  );

  const load = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const rows = await base44.entities.SellerConversation.filter(
        { $or: [{ buyer_email: me.email }, { seller_email: me.email }] },
        "-last_message_at",
        100
      );
      setConversations(rows || []);
    } catch (err) {
      console.error("Failed to load messages", err);
      toast.error("Couldn't load your messages.");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      const rows = await base44.entities.SellerMessage.filter(
        { conversation_id: conversationId },
        "created_date",
        200
      );
      setMessages(rows || []);
      const c = conversations.find((x) => x.id === conversationId);
      if (c && user?.email) {
        await base44.entities.SellerConversation.update(c.id, {
          ...(c.buyer_email === user.email ? { unread_for_buyer: false } : {}),
          ...(c.seller_email === user.email ? { unread_for_seller: false } : {})
        });
        setConversations((prev) => prev.map((x) => x.id === c.id ? {
          ...x,
          ...(c.buyer_email === user.email ? { unread_for_buyer: false } : {}),
          ...(c.seller_email === user.email ? { unread_for_seller: false } : {})
        } : x));
      }
    } catch (err) {
      console.error("Failed to load conversation", err);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (selected?.id) loadMessages(selected.id);
  }, [selected?.id]);

  const send = async () => {
    const body = text.trim();
    if (!body || !selected || sending) return;
    setSending(true);
    try {
      await base44.functions.invoke("send-seller-message", {
        conversationId: selected.id,
        body
      });
      setText("");
      await Promise.all([load(), loadMessages(selected.id)]);
    } catch (err) {
      console.error("Failed to send message", err);
      toast.error(err?.response?.data?.error || "Couldn't send the message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:pl-20 py-5 pb-28">
      <div className="flex items-center gap-3 mb-5">
        <MessageCircle className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-xs text-muted-foreground">Message buyers and sellers securely through UKMarketStore.</p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1">Open a product and choose “Message seller” to start a conversation.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[520px]">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {conversations.map((c) => {
              const other = c.buyer_email === user?.email ? "Seller" : "Buyer";
              const unread = c.buyer_email === user?.email ? c.unread_for_buyer : c.unread_for_seller;
              return (
                <Link
                  key={c.id}
                  to={"/messages?conversation=" + c.id}
                  className={"block p-3 border-b border-border hover:bg-muted/50 " + (selected?.id === c.id ? "bg-muted/60" : "")}
                >
                  <div className="flex gap-3">
                    {c.product_image ? <img src={c.product_image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.product_title}</p>
                      <p className="text-xs text-muted-foreground">{other}</p>
                      {c.last_message && <p className="text-xs text-muted-foreground truncate mt-1">{c.last_message}</p>}
                    </div>
                    {unread && <span className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />}
                  </div>
                </Link>
              );
            })}
          </div>

          {selected ? (
            <div className="rounded-2xl border border-border bg-card flex flex-col min-h-[520px]">
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Link to="/messages" className="md:hidden"><ArrowLeft className="w-4 h-4" /></Link>
                {selected.product_image ? <img src={selected.product_image} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-muted" />}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{selected.product_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.buyer_email === user?.email ? "Seller" : "Buyer"}
                  </p>
                </div>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div>
                      <Shield className="w-8 h-8 mx-auto text-primary/50 mb-2" />
                      <p className="text-sm font-medium">Start the conversation</p>
                      <p className="text-xs text-muted-foreground mt-1">Keep payment and personal contact details off the chat.</p>
                    </div>
                  </div>
                ) : messages.map((m) => (
                  <div key={m.id} className={"flex " + (m.sender_email === user?.email ? "justify-end" : "justify-start")}>
                    <div className={"max-w-[80%] rounded-2xl px-3 py-2 text-sm " + (m.sender_email === user?.email ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-border">
                <div className="flex gap-2">
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Write a message…"
                    maxLength={2000}
                    className="min-h-[44px] max-h-32 rounded-xl resize-none"
                  />
                  <Button onClick={send} disabled={!text.trim() || sending} className="h-11 w-11 rounded-xl px-0 shrink-0">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Never share passwords or sensitive payment details.</p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
