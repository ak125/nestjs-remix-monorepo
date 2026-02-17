import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import ChatWidget from "~/components/rag/ChatWidget";

vi.mock("~/hooks/useVehiclePersistence", () => ({
  useVehicle: () => ({
    vehicle: null,
  }),
}));

vi.mock("~/utils/chat-intent.utils", () => ({
  classifyChatIntent: () => ({
    userIntent: "define",
    intentFamily: "knowledge",
    pageIntent: "definition",
  }),
}));

function createSseBody(events: string[]) {
  const encoder = new TextEncoder();
  const chunks = events.map((event) => encoder.encode(event));
  let index = 0;

  return {
    getReader: () => ({
      read: async () => {
        if (index >= chunks.length) {
          return { done: true, value: undefined };
        }
        const value = chunks[index];
        index += 1;
        return { done: false, value };
      },
    }),
  };
}

describe("ChatWidget SSE metadata", () => {
  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("affiche le mode partial et les questions de clarification depuis metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: createSseBody([
        'event: metadata\ndata: {"sessionId":"s1","responseMode":"partial","needsClarification":true,"clarifyQuestions":["Quelle version exacte ?","Quel vehicule ?"],"sourcesCitation":"## Sources\\n1. ece-r90.md#p12-13"}\n\n',
        'event: chunk\ndata: {"text":"Reponse utile partielle"}\n\n',
        'event: done\ndata: {"confidence":0.62}\n\n',
      ]),
    } as never);

    render(<ChatWidget />);

    fireEvent.click(screen.getByLabelText("Ouvrir le chat"));
    fireEvent.change(screen.getByPlaceholderText("Posez votre question..."), {
      target: { value: "definition ece r90" },
    });
    fireEvent.click(screen.getByLabelText("Envoyer"));

    await waitFor(() => {
      expect(screen.getByText("Réponse partielle")).toBeTruthy();
    });

    expect(screen.getByText("Précision nécessaire")).toBeTruthy();
    expect(screen.getByText("1. Quelle version exacte ?")).toBeTruthy();
    expect(screen.getByText("2. Quel vehicule ?")).toBeTruthy();
    expect(screen.getByText("Citations techniques")).toBeTruthy();
  });
});
