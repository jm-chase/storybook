// Account seam (B-8). The app is local-first (D-001): there is ONE implicit
// user, "local", and no login. Everything that will become per-account when we
// host — project storage, generation budgets, orders — resolves its user
// through here, so wiring a real provider (Clerk / Auth.js, James's pick) is
// a change to THIS module plus threading `userRoot(await getCurrentUserId())`
// through the API routes, not a storage rework.
//
// Storage layout is already tenant-shaped: projects/<userId>/<projectId>/.

export const LOCAL_USER_ID = "local";

/**
 * Synchronous local identity — used by the store's default root. Hosted
 * builds must NOT use this; they resolve the request's user via
 * getCurrentUserId() and pass an explicit root instead.
 */
export function getLocalUserId(): string {
  return LOCAL_USER_ID;
}

/**
 * The provider swap point. Today: the local user. With a provider: read the
 * request session (e.g. Clerk's auth()) and return its user id — throwing (or
 * redirecting) when unauthenticated.
 */
export async function getCurrentUserId(): Promise<string> {
  return LOCAL_USER_ID;
}
