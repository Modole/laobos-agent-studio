export {};

declare global {
  interface Window {
    piDesktop?: {
      getBridgeUrl(): Promise<string>;
    };
  }
}
