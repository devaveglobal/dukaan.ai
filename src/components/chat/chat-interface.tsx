"use client";

import { useEffect, useRef, useState } from "react";
import { processChatMessage, loadConversation } from "@/actions/chat";
import { detectItemFromImage } from "@/lib/ai-extractor";
import { ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Loader2, Bot, User, CheckCircle2, Clock, AlertCircle, Mic, MicOff, ImagePlus, X } from "lucide-react";
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
  const [listening, setListening] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [detectedItem, setDetectedItem] = useState<string | null>(null);
  const [detectingImage, setDetectingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversation(userId).then((msgs) => {
      if (msgs.length > 0) setMessages(msgs);
    });
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice not supported in this browser"); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.lang = "en-US";
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => setInput((prev) => prev + e.results[0][0].transcript);
    rec.onerror = () => { toast.error("Voice recognition error"); setListening(false); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setDetectingImage(true);
      try {
        const name = await detectItemFromImage(base64);
        if (name) {
          setDetectedItem(name);
          setInput(`I sold ${name}`);
          toast.success(`Detected: ${name}`);
        } else {
          toast.error("Could not identify item from image");
        }
      } catch {
        toast.error("Image detection failed");
      } finally {
        setDetectingImage(false);
        // reset file input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setDetectedItem(null);
  };

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
        imageItemName: detectedItem,
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLastAction(response.action_taken ?? null);
      clearImage();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
    <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-[calc(100vh-8rem)] max-w-2xl mx-auto">
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
              Tell me what you sold, use voice 🎤, or upload a barcode/product image 📷<br />
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

      {/* Image preview strip */}
      {imagePreview && (
        <div className="flex items-center gap-2 py-2 px-1 border-t">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="uploaded" className="h-12 w-12 object-cover rounded-lg border" />
            <button onClick={clearImage} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
          {detectingImage
            ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Detecting item...</span>
            : detectedItem && <span className="text-xs text-primary font-medium">Detected: {detectedItem}</span>
          }
        </div>
      )}

      {/* Input */}
      <div className="pt-3 border-t">
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex flex-col gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Sold 3 Pepsi for 150..."
              rows={2}
              className="resize-none w-full py-2.5"
              disabled={loading}
            />
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                onClick={toggleVoice}
                disabled={loading}
                size="sm"
                variant={listening ? "destructive" : "outline"}
                className="h-8 gap-1.5 px-3"
                title={listening ? "Stop recording" : "Voice input"}
              >
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span className="text-xs">{listening ? "Stop" : "Voice"}</span>
              </Button>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || detectingImage}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 px-3"
                title="Upload product image"
              >
                {detectingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                <span className="text-xs">Image</span>
              </Button>
              <p className="text-xs text-muted-foreground ml-auto hidden sm:block">Enter to send · Shift+Enter new line</p>
            </div>
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-[5.5rem] w-11 shrink-0 rounded-xl"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}
