/**
 * Server-only owner identity. Do not import from client bundles.
 * isOwner is returned by auth.me from the server.
 */
export { isOwnerEmail, canonicalOwnerEmail, normalizeEmail } from "./serverSecrets.js";
