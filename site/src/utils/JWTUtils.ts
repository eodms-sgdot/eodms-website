/**
 * JWT token decoding utilities.
 * Note: Only performs client-side decoding for display purposes.
 * Does NOT verify signature - authorization validation is server-side.
 */

export interface DecodedToken {
  sub?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  groups?: string[];
  roles?: string[];
  [key: string]: unknown;
}

/**
 * Decodes a JWT token's payload (Base64URL decoding).
 * Does NOT verify the signature - for informational display only.
 * @param token The JWT token string
 * @returns Decoded payload object, or null if invalid
 */
export const decodeJWTPayload = (token: string): DecodedToken | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Invalid JWT format: expected 3 parts separated by dots');
      return null;
    }

    // Decode Base64URL
    const payload = parts[1];
    // Add padding if needed
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    // Replace URL-safe characters
    const decoded = atob(padded);
    return JSON.parse(decoded) as DecodedToken;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

/**
 * Extracts group memberships from a JWT token.
 * Checks common claim names: 'groups', 'group', 'roles'
 * @param token The JWT token string
 * @returns Array of group names, empty array if none found
 */
export const getGroupsFromToken = (token: string): string[] => {
  const payload = decodeJWTPayload(token);
  if (!payload) return [];

  // Try common group claim names
  if (Array.isArray(payload.groups)) return payload.groups as string[];
  if (typeof payload.group === 'string') return [payload.group];
  if (Array.isArray(payload.roles)) return payload.roles as string[];

  return [];
};

/**
 * Gets token expiration time
 * @param token The JWT token string
 * @returns Date of expiration, or null if not found/invalid
 */
export const getTokenExpiry = (token: string): Date | null => {
  const payload = decodeJWTPayload(token);
  if (!payload?.exp) return null;

  // JWT uses seconds since epoch
  return new Date(payload.exp * 1000);
};

/**
 * Checks if token is expired
 * @param token The JWT token string
 * @param bufferSeconds Grace period in seconds (default 60)
 * @returns True if token is expired or will expire within buffer
 */
export const isTokenExpired = (token: string, bufferSeconds = 60): boolean => {
  const expiry = getTokenExpiry(token);
  if (!expiry) return false;

  const now = new Date();
  const bufferMs = bufferSeconds * 1000;
  return expiry.getTime() - now.getTime() < bufferMs;
};
