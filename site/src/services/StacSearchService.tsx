import axios from "axios";
import type { STACItem } from "../types";

export interface StacSearchParams {
  bbox: [number, number, number, number];
  collections: string[];
  limit: number;
  datetime?: string;
  filter?: string;
  sortby?: string;
}

export interface StacSearchResult {
  items: STACItem[];
  nextUrl: string | null;
  currentPage: number;
  totalDiscoveredPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  numberMatched: number | null;
}

/**
 *
 */
export class StacSearchService {
  private stacEndpoint: string;
  private urlHistory: string[] = [];
  private currentPage: number = 0;
  private nextUrl: string | null = null;
  private numberMatched: number | null = null;
  private supportsSorting: boolean = false;
  private supportsSearch: boolean = false;
  private _sortingSupportPromise: Promise<void>;
  private _searchSupportPromise: Promise<void>;

  constructor(stacEndpoint: string, onSortingSupportResolved?: (supports: boolean) => void, 
      onSearchSupportResolved?: (supports: boolean) => void) {

    this.stacEndpoint = stacEndpoint;
    this._sortingSupportPromise = this.checkSortingSupport(onSortingSupportResolved);
    this._searchSupportPromise = this.checkSearchSupport(onSearchSupportResolved);
  }

  /**
   * Checks to see if the STAC endpoint supports sorting.
   * 
   * @param onResult 
   */
  private async checkSortingSupport(onResult?: (supports: boolean) => void): Promise<void> {
    try {
      const response = await axios.get<{ conformsTo: string[] }>(this.stacEndpoint, {withCredentials: true });
      this.supportsSorting = response.data.conformsTo?.some(c =>
        c.toLowerCase().includes('sort')
      ) ?? false;
    } catch {
      this.supportsSorting = false;
    }
    
    onResult?.(this.supportsSorting);
  }

  /**
   * Checks to see if the STAC endpoint supports a /search endpoint.
   * 
   * @param onResult 
   */
  private async checkSearchSupport(onResult?: (supports: boolean) => void): Promise<void> {
    try {
      const response = await axios.get<{ conformsTo: string[] }>(this.stacEndpoint, {withCredentials: true });
      this.supportsSearch = response.data.conformsTo?.some(c =>
        c.toLowerCase().includes('item-search')
      ) ?? false;
    } catch {
      this.supportsSearch = false;
    }
    
    onResult?.(this.supportsSearch);
  }

  /**
   * Builds the initial search URL from the given parameters.
   */
  private buildSearchUrl(params: StacSearchParams): string {
    const queryParams = new URLSearchParams();
    queryParams.append("collections", params.collections.join(","));
    queryParams.append("bbox", params.bbox.join(","));
    queryParams.append("limit", params.limit.toString());

    if (params.datetime) {
      queryParams.append("datetime", params.datetime);
    }

    if (params.filter && params.collections.length === 1) {
      queryParams.append("filter-lang", "cql2-text");
      queryParams.append("filter", params.filter);
    }

    if (params.sortby && this.supportsSorting) {
      queryParams.append("sortby", params.sortby);
    }

    return `${this.stacEndpoint}/search?${queryParams.toString()}`;
  }

  /**
   * Builds the initial items URL from the given parameters.
   */
  private buildItemsUrl(params: StacSearchParams): string {
    const queryParams = new URLSearchParams();
    queryParams.append("bbox", params.bbox.join(","));
    queryParams.append("limit", params.limit.toString());

    if (params.datetime) {
      queryParams.append("datetime", params.datetime);
    }

    if (params.filter && params.collections.length === 1) {
      queryParams.append("filter-lang", "cql2-text");
      queryParams.append("filter", params.filter);
    }

    if (params.sortby && this.supportsSorting) {
      queryParams.append("sortby", params.sortby);
    }

    return `${this.stacEndpoint}/collections/${params.collections[0]}/items?${queryParams.toString()}`;
  }

  /**
   * Executes a GET request against the given URL and returns the result.
   */
  private async fetch(
    url: string,
    headers: Record<string, string>,
  ): Promise<StacSearchResult> {

    headers["Accept"] = "application/geo+json";

    const response = await axios.get<{
      features: STACItem[];
      links: { rel: string; href: string }[];
      numberMatched: number | null;
    }>(url, { headers, withCredentials: true});

    this.nextUrl =
      response.data.links?.find((l) => l.rel === "next")?.href ?? null;

    return {
      items: response.data.features,
      nextUrl: this.nextUrl,
      currentPage: this.currentPage,
      totalDiscoveredPages: this.urlHistory.length,
      hasNext: !!this.nextUrl,
      hasPrevious: this.currentPage > 1,
      numberMatched: response.data.numberMatched ?? null
    };
  }

  /**
   * Starts a new search, resetting all paging state.
   */
  async search(
    params: StacSearchParams,
    headers: Record<string, string>,
  ): Promise<StacSearchResult> {
    await this._sortingSupportPromise;
    await this._searchSupportPromise;
    const initialUrl = this.supportsSearch ? this.buildSearchUrl(params) : this.buildItemsUrl(params);
    this.urlHistory = [initialUrl];
    this.currentPage = 1;
    this.nextUrl = null;

    const response = await this.fetch(initialUrl, headers);
    this.numberMatched = response.numberMatched;

    return response;
  }

  /**
   * Fetches the next page of results.
   */
  async nextPage(headers: Record<string, string>): Promise<StacSearchResult> {
    if (!this.nextUrl) {
      throw new Error("No next page available");
    }

    this.currentPage += 1;

    if (this.urlHistory.length < this.currentPage) {
      this.urlHistory.push(this.nextUrl);
    }

    return this.fetch(this.nextUrl, headers);
  }

  /**
   * Fetches the previous page of results.
   */
  async previousPage(
    headers: Record<string, string>,
  ): Promise<StacSearchResult> {
    if (this.currentPage <= 1) {
      throw new Error("No previous page available");
    }

    this.currentPage -= 1;

    return this.fetch(this.urlHistory[this.currentPage - 1], headers);
  }

  /**
   * Navigates to a specific previously visited page.
   */
  async goToPage(
    page: number,
    headers: Record<string, string>,
  ): Promise<StacSearchResult> {
    if (page < 1 || page > this.urlHistory.length) {
      throw new Error(`Page ${page} is not available`);
    }

    this.currentPage = page;

    return this.fetch(this.urlHistory[page - 1], headers);
  }

  /**
   * Updates the STAC endpoint, resetting all state.
   */
  setEndpoint(stacEndpoint: string, onSortingSupportResolved?: (supports: boolean) => void): void {
    this.stacEndpoint = stacEndpoint;
    this.urlHistory = [];
    this.currentPage = 0;
    this.nextUrl = null;
    this.supportsSorting = false;
    this._sortingSupportPromise = this.checkSortingSupport(onSortingSupportResolved);
    this._searchSupportPromise = this.checkSearchSupport(onSortingSupportResolved);
  }

  /**
   * Re-initializes the current service information.
   */
  reset(): void {
    this.urlHistory = [];
    this.currentPage = 0;
    this.nextUrl = null;
    this.numberMatched = null;
  }

  /**
   * Returns the number of items matched in the initial query. 
   * @returns the number of items matched in the initial query. 
   */
  getNumberMatched(): number | null {
    return this.numberMatched;
}
}
