/**
 * ChatMessage Component
 *
 * Affiche une bulle de message dans le chat RAG
 * - Supporte les messages utilisateur et assistant
 * - Affiche les sources pour les réponses RAG
 */

import { User, Bot, ExternalLink } from "lucide-react";
import { memo } from "react";

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  confidence?: number;
  timestamp: Date;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-gradient-to-r from-orange-500 to-amber-500"
            : "bg-gray-200"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-gray-600" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Sources (assistant only) */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Sources :</p>
            <ul className="space-y-1">
              {message.sources.map((source, index) => (
                <li
                  key={index}
                  className="flex items-center gap-1 text-xs text-gray-600"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{source.replace("knowledge/", "")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confidence indicator (assistant only) */}
        {!isUser && message.confidence !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  message.confidence >= 0.8
                    ? "bg-green-500"
                    : message.confidence >= 0.5
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${message.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {Math.round(message.confidence * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
