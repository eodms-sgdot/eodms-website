// src/types.ts
export interface STACAsset {
  href: string;
  title?: string;
  description?: string;
  type?: string;
  roles?: string[];
  "auth:refs"?: string[];
}

export interface STACItem {
  id: string;
  type: "Feature";
  collection: string;
  geometry: GeoJSON.Geometry;
  bbox: [number, number, number, number];
  properties: Record<string, string | number | boolean | null>;
  assets: Record<string, STACAsset>;
  links: { rel: string; href: string, type: string }[];
}

export interface STACCollection {
  id: string;
  title?: string;
  description: string;
  links: { rel: string; href: string, type: string }[];
}

export interface STACQueryable {
  type?: null | "string" | "integer" | "number" | "boolean" | "datetime" | "geometry-any";
  title?: string | null;
  format?: string | null,
  contentEncoding?: string | null,
  "x-ogc-role"?: string | null;
  pattern?: string | null;
  minimum?: number | null;
  maximum?: number | null;
  maxLength?: number | null;
  minLength?: number | null;
  enum?: StringOrInt[] | null;
}

export interface STACQueryables {
  type: string,
  title?: string | null;
  $id: string,
  $schema: string,
  properties: Partial<Record<string, STACQueryable>>;
}

export type StringOrInt = string | number;

export interface Duration {
  duration: string;
}

export interface FilterDate {
  date: string;
}

export interface FilterValue {
  id: string;
  fieldKey: string;
  type?: "string" | "number" | "duration" | "date-range"
  operation?: string | undefined;
  value?:
    | string
    | number
    | [number, number]
    | FilterDate
    | [FilterDate, FilterDate]
    | Duration
    | undefined;
}

export interface OpenAPISecurityScheme {
  type: "http" | "apiKey" | "oauth2" | "openIdConnect";
  scheme?: string;
  description?: string;
  bearerFormat?: string;
}

export interface aaaRequest {
  grant_type: string;
  username: string;
  password: string;
  withCredentials: boolean;
}

export interface aaaResponse {
    request_id: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in: number;
    access_token: string
}

export interface StacSearchPayload {
  bbox: [number, number, number, number];
  collections: string[];
  limit: number;
  datetime?: string; // Optional property
}