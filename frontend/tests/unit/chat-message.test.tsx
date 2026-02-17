import { render, screen } from "@testing-library/react";

import ChatMessage, { type ChatMessageData } from "~/components/rag/ChatMessage";

describe("ChatMessage", () => {
  const baseMessage: ChatMessageData = {
    id: "m1",
    role: "assistant",
    content: "Réponse test",
    timestamp: new Date("2026-02-12T12:00:00Z"),
  };

  it("affiche le badge de mode partial", () => {
    render(
      <ChatMessage
        message={{
          ...baseMessage,
          responseMode: "partial",
        }}
      />,
    );

    expect(screen.getByText("Réponse partielle")).toBeTruthy();
  });

  it("affiche les questions de clarification", () => {
    render(
      <ChatMessage
        message={{
          ...baseMessage,
          needsClarification: true,
          clarifyQuestions: ["Question 1 ?", "Question 2 ?"],
        }}
      />,
    );

    expect(screen.getByText("Précision nécessaire")).toBeTruthy();
    expect(screen.getByText("1. Question 1 ?")).toBeTruthy();
    expect(screen.getByText("2. Question 2 ?")).toBeTruthy();
  });

  it("affiche le bloc citations techniques", () => {
    render(
      <ChatMessage
        message={{
          ...baseMessage,
          sourcesCitation: "## Sources\n1. ece-r90.md#p12-13",
        }}
      />,
    );

    expect(screen.getByText("Citations techniques")).toBeTruthy();
    expect(screen.getByText(/ece-r90\.md#p12-13/)).toBeTruthy();
  });
});
