import { signal } from "@lit-labs/signals";

export const chatMessages = signal<unknown[]>([]);
export const chatStream = signal<string | null>(null);
export const chatSending = signal<boolean>(false);

export function setChatMessages(messages: unknown[]) {
  chatMessages.set(messages);
}

export function pushChatMessage(message: unknown) {
  chatMessages.set([...chatMessages.get(), message]);
}

export function setChatStream(stream: string | null) {
  chatStream.set(stream);
}

export function setChatSending(sending: boolean) {
  chatSending.set(sending);
}
