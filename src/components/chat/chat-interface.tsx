"use client";

import { useEffect, useRef, useState } from "react";
import { processChatMessage, loadConversation } from "@/actions/chat";
import { ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Loader2, Bot, User, CheckCircle2, Clock, AlertCircle, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  role: "seller" | "admin";
}

export default function ChatInterface({ userId, role }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice not supported in this browser"); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => setInput((prev) => prev + e.results[0][0].transcript);
    rec.onerror = () => { toast.error("Voice recognition error"); setListening(false); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  // Load today's conversation on mount
  useEffect(() => {
    loadConversation(userId).then((msgs) => {
      if (msgs.length > 0) setMessages(msgs);
    });
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setLastAction(null);

    try {
      const response = await processChatMessage({
        messages,
        userMessage: text,
        role,
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLastAction(response.action_taken ?? null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      // Remove the optimistic user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const actionBadge = () => {
    if (!lastAction || lastAction === "none") return null;
    const map: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      sale_recorded: { label: "Sale Recorded", icon: <CheckCircle2 className="w-3 h-3" />, variant: "default" },
      credit_recorded: { label: "Credit Recorded", icon: <Clock className="w-3 h-3" />, variant: "secondary" },
      incomplete_logged: { label: "Sent for Review", icon: <AlertCircle className="w-3 h-3" />, variant: "outline" },
      query_answered: { label: "Query", icon: <Bot className="w-3 h-3" />, variant: "secondary" },
    };
    const info = map[lastAction];
    if (!info) return null;
    return (
      <Badge variant={info.variant} className="gap-1 text-xs animate-in fade-in">
        {info.icon} {info.label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">AI Sales Assistant</p>
            <p className="text-xs text-muted-foreground">
              {role === "admin" ? "Admin mode — full analytics access" : "Tell me what you sold"}
            </p>
          </div>
        </div>
        {actionBadge()}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium">Start recording sales</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Just tell me what you sold. For example:<br />
              <span className="italic">&quot;Sold 5 Coca Cola for 250&quot;</span><br />
              <span className="italic">&quot;Ahmed ne 2 juice liye udhaar pe&quot;</span>
            </p>
          </div>
        )}
        <div className="space-y-4 px-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {msg.role === "user"
                  ? <User className="w-3.5 h-3.5" />
                  : <Bot className="w-3.5 h-3.5 text-primary" />
                }
              </div>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted rounded-tl-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="pt-4 border-t">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Sold 3 Pepsi for 150..."
            rows={2}
            className="resize-none flex-1"
            disabled={loading}
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              onClick={toggleVoice}
              disabled={loading}
              size="icon"
              variant={listening ? "destructive" : "outline"}
              className="h-[2.1rem] w-10 shrink-0"
              title={listening ? "Stop recording" : "Start voice input"}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-[2.1rem] w-10 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Press Enter to send · Shift+Enter for new line · 🎤 mic for voice</p>
      </div>
    </div>
  );
}
