interface EndpointMap {
  eodmsDomain: string;
  productionDomain: string;
}

export function isStagingEndpoint(
  stacEndpoint: string,
  isDevelopment: boolean,
  endpointMap: EndpointMap,
): boolean {
  const directStacEndpoint = /^https?:\/\//i.test(stacEndpoint);
  const activeStacOrigin = directStacEndpoint
    ? new URL(stacEndpoint).origin
    : isDevelopment ? endpointMap.eodmsDomain : window.location.origin;
  const productionHostname = new URL(endpointMap.productionDomain).hostname.toLowerCase().replace(/^www\./, "");
  const activeStacHostname = new URL(activeStacOrigin, window.location.origin).hostname.toLowerCase().replace(/^www\./, "");

  return activeStacHostname !== productionHostname;
}