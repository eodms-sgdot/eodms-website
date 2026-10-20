export type NaplFlightLineIndexMap = "PDF" | "Paper";

export interface NaplMediaTypeOptions {
  file_formats: string[];
  image_resolutions: number[];
}

export interface NaplOrderOptions {
  media_types: string[];
  file_formats: string[];
  image_resolutions: number[];
  flight_line_index_maps: NaplFlightLineIndexMap[];
  media_type_options: Record<string, NaplMediaTypeOptions>;
}

export interface NaplOrderSelection {
  media_type: string;
  file_format?: string;
  image_resolution?: number;
  flight_line_index_map?: NaplFlightLineIndexMap;
}

export interface NaplOrderItem {
  unique_identifier: string;
  quantity: number;
  options: NaplOrderSelection;
}

export interface NaplOrderResponse {
  order_id?: string;
  order_number?: number;
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
    cache: "no-store",
  });
  const options = await readResponse(response);
  const result: NaplOrderOptions = {
    media_types: Array.isArray(options.media_types) ? options.media_types.map(String) : [],
    file_formats: Array.isArray(options.file_formats) ? options.file_formats.map(String) : [],
    image_resolutions: Array.isArray(options.image_resolutions)
      ? options.image_resolutions.map(Number).filter(Number.isFinite)
      : [],
    flight_line_index_maps: Array.isArray(options.flight_line_index_maps)
      ? options.flight_line_index_maps.map(String).filter((value): value is NaplFlightLineIndexMap => value === "PDF" || value === "Paper")
      : [],
    media_type_options: {},
  };
  if (!result.media_types.length || !result.file_formats.length || !result.image_resolutions.length) {
    throw new Error("NAPL order service returned no selectable order options. Check that the staging service is available.");
  }
  for (const mediaType of result.media_types) {
    if (options.media_type_options === undefined) {
      result.media_type_options[mediaType] = {
        file_formats: result.file_formats, image_resolutions: result.image_resolutions,
      };
      continue;
    }
    const rule = options.media_type_options && typeof options.media_type_options === "object"
      ? (options.media_type_options as Record<string, unknown>)[mediaType] : undefined;
    const fields = rule && typeof rule === "object" ? rule as Record<string, unknown> : {};
    if (!Array.isArray(fields.file_formats) || !Array.isArray(fields.image_resolutions)) {
      throw new Error("NAPL order service returned invalid media-specific options.");
    }
    result.media_type_options[mediaType] = {
      file_formats: fields.file_formats.map(String),
      image_resolutions: fields.image_resolutions.map(Number).filter(Number.isFinite),
    };
  }
  return result;
}

export function normalizeNaplSelection(selection: NaplOrderSelection, available: NaplOrderOptions): NaplOrderSelection {
  const legacyPrint = available.media_types.includes("PaperPrint")
    && (selection.media_type === "ContactPrint" || selection.media_type === "Enlargement");
  const mediaType = legacyPrint ? "PaperPrint" : selection.media_type;
  const format = legacyPrint ? selection.media_type : selection.file_format;
  const rule = available.media_type_options[mediaType];
  const result: NaplOrderSelection = { media_type: mediaType };
  if (rule?.file_formats.length) {
    result.file_format = rule.file_formats.find(value => value === format) ?? rule.file_formats[0];
  }
  if (rule?.image_resolutions.length) {
    result.image_resolution = rule.image_resolutions.find(value => value === selection.image_resolution) ?? rule.image_resolutions[0];
  }
  if (selection.flight_line_index_map !== undefined) {
    result.flight_line_index_map = selection.flight_line_index_map;
  }
  return result;
}

export async function submitNaplOrder(
  items: NaplOrderItem[],
  accessToken: string,
): Promise<NaplOrderResponse> {
  if (items.length === 0 || items.length > 100) {
    throw new Error("A NAPL order must contain between 1 and 100 item lines.");
  }
  if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647)) {
    throw new Error("Each NAPL item quantity must be a positive integer no greater than 2147483647.");
  }
  if (items.some(item => item.options.flight_line_index_map !== undefined
    && item.options.flight_line_index_map !== "PDF" && item.options.flight_line_index_map !== "Paper")) {
    throw new Error("Each flight-line index map must be PDF or Paper when requested.");
  }

  const response = await fetch(`${API_ROOT}/orders`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ items }),
  });

  return await readResponse(response) as NaplOrderResponse;
}