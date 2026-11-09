import { useEffect, useState } from 'react';
import { decodeJWTPayload, getGroupsFromToken, type DecodedToken } from '../utils/JWTUtils';

export interface TokenInfo {
  groups: string[];
  claims: DecodedToken | null;
}

/**
 * Hook to decode and monitor JWT token.
 * Automatically updates when authToken changes.
 */
export const useTokenDecoding = (authToken: string | null): TokenInfo => {
  const [groups, setGroups] = useState<string[]>([]);
  const [claims, setClaims] = useState<DecodedToken | null>(null);

  useEffect(() => {
    if (!authToken) {
      setGroups([]);
      setClaims(null);
      return;
    }

    try {
      const payload = decodeJWTPayload(authToken);
      setClaims(payload);
      setGroups(getGroupsFromToken(authToken));
    } catch (error) {
      console.error('Failed to decode token:', error);
      setGroups([]);
      setClaims(null);
    }
  }, [authToken]);

  return { groups, claims };
};
