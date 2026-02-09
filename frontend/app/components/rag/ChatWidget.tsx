/**
 * ChatWidget Component
 *
 * Widget de chat flottant pour le RAG AutoMecanik
 * - Bouton flottant en bas à droite
 * - Panel de chat extensible
 * - Gestion de session persistante
 * - Intégration avec l'API RAG
 */

import { MessageCircle, X, Minimize2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback, memo } from "react";

import ChatInput from "./ChatInput";
import ChatMessage, { type ChatMessageData } from "./ChatMessage";

interface ChatWidgetProps {
  streamUrl?: string;
}

const ChatWidget = memo(function ChatWidget({
  streamUrl = "/api/rag/chat/stream",
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Generate session ID on first open
  useEffect(() => {
    if (isOpen && !sessionId) {
      setSessionId(
        `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      );
    }
  }, [isOpen, sessionId]);

  const handleSend = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage: ChatMessageData = {
        id: `msg-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create placeholder assistant message for progressive fill
      const assistantId = `msg-${Date.now() + 1}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      try {
        const response = await fetch(streamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, sessionId }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case "chunk":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + data.text }
                        : m,
                    ),
                  );
                  break;
                case "sources":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, sources: data.sources }
                        : m,
                    ),
                  );
                  break;
                case "metadata":
                  if (data.sessionId) setSessionId(data.sessionId);
                  break;
                case "done":
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, confidence: data.confidence }
                        : m,
                    ),
                  );
                  break;
              }
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "Désolé, je ne suis pas disponible pour le moment. Veuillez réessayer plus tard ou contacter notre support.",
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [streamUrl, sessionId],
  );

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 group"
        aria-label="Ouvrir le chat"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        {/* Notification dot */}
        <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 bg-white rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 ${
        isMinimized
          ? "w-[calc(100vw-2rem)] sm:w-80 h-14"
          : "w-[calc(100vw-2rem)] sm:w-96 h-[32rem]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">
              Assistant AutoMecanik
            </h3>
            <p className="text-white/80 text-xs">
              {isLoading ? "En train de répondre..." : "En ligne"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleMinimize}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label={isMinimized ? "Agrandir" : "Réduire"}
          >
            <Minimize2 className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Chat content (hidden when minimized) */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">Bienvenue !</p>
                <p className="text-xs mt-1">
                  Posez-moi une question sur les livraisons, retours, ou
                  garanties.
                </p>
              </div>
            ) : (
              messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </>
      )}
    </div>
  );
});

export default ChatWidget;
