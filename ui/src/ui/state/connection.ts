import { signal, computed } from "@lit-labs/signals";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export const connectionStatus = signal<ConnectionStatus>("disconnected");

export const isConnected = computed(() => connectionStatus.get() === "connected");
export const isReconnecting = computed(() => connectionStatus.get() === "reconnecting");

export function setConnectionStatus(status: ConnectionStatus) {
  connectionStatus.set(status);
}
