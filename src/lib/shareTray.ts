export type TrayRequest = {
  file: File;
  caption?: string;
};

let current: TrayRequest | null = null;
const listeners = new Set<() => void>();

export function openShareTray(request: TrayRequest) {
  current = request;
  listeners.forEach((listener) => listener());
}

export function closeShareTray() {
  current = null;
  listeners.forEach((listener) => listener());
}

export function subscribeToShareTray(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function currentShareTrayRequest(): TrayRequest | null {
  return current;
}
