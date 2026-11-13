
/**
 * Field names for session values.
 */
export const fields = {

    language: "language",
    stacEndpoint: "stac-url",
    displayMode: "display-mode",
    baseMap: "basemap",
    
    filters: "filters",
    searchLimit: "searchLimit",
    searchTemporal: "searchTemporal",
    searchStartDate: "searchStartDate",
    searchEndDate: "searchEndDate",
    sortBy: "sortBy",
    locationSearchProvider: "search-provider",

    username: "username",
    token: "auth-token",
    authSource: "auth-token-aaa-source",
    decodedToken: "auth-token-decoded",
    expiry: "auth-token-expiry",
    refreshToken: "refresh-token",
    refreshExpiry: "refresh-token-expiry",
    collectionsCache: "collections-cache",
}

export function recordAuthSource(
    storage: Pick<Storage, 'setItem'>,
    endpointUrl: string,
    proxyUpstream: unknown,
    proxyEnvironment: unknown,
    usesLocalProxy: boolean,
) {
    const url = usesLocalProxy
        ? typeof proxyUpstream === 'string' && proxyUpstream ? proxyUpstream : null
        : endpointUrl;
    const environment = usesLocalProxy && typeof proxyEnvironment === 'string' && proxyEnvironment
        ? proxyEnvironment : null;
    storage.setItem(fields.authSource, JSON.stringify({ url, environment }));
}