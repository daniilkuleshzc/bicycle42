// What scripts/build.mjs puts into page-preload.ts: the built overlay (overlay.js) and its
// lookup (overlay-lookup.js), each as the body of a function.
declare module "b42:page-overlay" {
  /** Runs overlay.js here, in the preload's world. */
  export function overlay(): void
  /** overlay-lookup.js, for contextBridge.executeInMainWorld: it closes over nothing. */
  export function lookup(): void
}

/** What the overlay puts on its world's window (overlay/src/mount.js). */
interface Window {
  __b42?: { receive(msg: string): void; busy(): boolean }
}
