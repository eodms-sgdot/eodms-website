export interface NaplOrderOptions {
  media_types: string[];
  file_formats: string[];
  image_resolutions: number[];
}

export interface NaplOrderSelection {
  media_type: string;
  file_format: string;
  image_resolution: number;
}

export interface NaplOrderResponse {
  order_id?: string;
  status?: string;
  [key: string]: unknown;
}

const API_ROOT = "/napl/v1";

const readResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const responseText = await response.text();
  let payload: unknown = {};
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error(response.ok
        ? "NAPL order service returned a non-JSON response. Check the staging proxy configuration."
        : `NAPL order service returned HTTP ${response.status}.`);
    }
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("NAPL order service returned an unexpected response.");
  }
  const data = payload as Record<string, unknown>;
  if (!response.ok) {
    const invalidItems = Array.isArray(data.invalid_items)
      ? ` ${data.invalid_items.join(", ")}`
      : "";
    throw new Error(String(data.message || data.error || data.detail || `NAPL order service returned HTTP ${response.status}.${invalidItems}`));
  }
  return data;
};

export async function getNaplOrderOptions(): Promise<NaplOrderOptions> {
  const response = await fetch(`${API_ROOT}/order-options`, {
    headers: { Accept: "application/json" },
  });
  const options = await readResponse(response);
  const result = {
    media_types: Array.isArray(options.media_types) ? options.media_types.map(String) : [],
    file_formats: Array.isArray(options.file_formats) ? options.file_formats.map(String) : [],
    image_resolutions: Array.isArray(options.image_resolutions)
      ? options.image_resolutions.map(Number).filter(Number.isFinite)
      : [],
  };
  if (!result.media_types.length || !result.file_formats.length || !result.image_resolutions.length) {
    throw new Error("NAPL order service returned no selectable order options. Check that the staging service is available.");
  }
  return result;
}

export async function submitNaplOrder(
  itemIds: string[],
  options: NaplOrderSelection,
  accessToken: string,
): Promise<NaplOrderResponse> {
  if (itemIds.length === 0 || itemIds.length > 100) {
    throw new Error("A NAPL order must contain between 1 and 100 images.");
  }

  const response = await fetch(`${API_ROOT}/orders`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      items: itemIds.map(unique_identifier => ({
        unique_identifier,
        options: {
          media_type: options.media_type,
          file_format: options.file_format,
          image_resolution: options.image_resolution,
        },
      })),
    }),
  });

  return await readResponse(response) as NaplOrderResponse;
}