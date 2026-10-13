import axios from 'axios';

export interface ProcessSummary {
  id: string;
  version: string;
  title?: string | null;
  description?: string | null;
  jobControlOptions?: ('sync-execute' | 'async-execute' | 'dismiss')[] | null;
}

export interface ProcessDescription extends ProcessSummary {
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface ProcessingJob {
  type: string;
  jobID: string;
  status: 'accepted' | 'running' | 'successful' | 'failed' | 'dismissed';
  processID?: string | null;
  message?: string | null;
  progress?: number | null;
  created?: string | null;
  updated?: string | null;
}

export interface ProcessingResult {
  job_id: string;
  status: 'indeterminate' | 'successful' | 'failed' | 'dismissed';
  message?: string | null;
  error?: string | null;
  results: { processor: string; status: string; message: string; outputs?: Record<string, unknown> | null }[];
}

export type JobResult = ProcessingJob | ProcessingResult | null;

export function getProcessingAssets(result: JobResult, protocol: 'http' | 's3' = 'http'): { key: string; title: string; href: string }[] {
  if (!result || !('results' in result)) return [];
  const assets = new Map<string, { key: string; title: string; href: string }>();

  const addFile = (href: unknown, title?: unknown) => {
    if (typeof href !== 'string' || assets.has(href)) return;
    if (protocol === 'http' ? !/^https?:\/\//i.test(href) : !/^s3:\/\/[a-z0-9.-]+\/[^"\r\n]+$/i.test(href)) return;
    try {
      const filename = decodeURIComponent(new URL(href).pathname.split('/').pop() || href);
      assets.set(href, { key: href, title: typeof title === 'string' && title ? title : filename, href });
    } catch { return; }
  };

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const entry = value as Record<string, unknown>;
    addFile(entry.href, entry.title);
    if (Array.isArray(entry.files)) {
      entry.files.forEach(file => {
        if (typeof file === 'string') addFile(file);
        else walk(file);
      });
    }
    Object.entries(entry).filter(([key]) => key !== 'files').forEach(([, child]) => walk(child));
  };

  result.results.forEach(item => walk(item.outputs));
  return [...assets.values()];
}

export function getS3RecursiveCommand(uris: string[]): string | null {
  if (!uris.length) return null;
  try {
    const locations = uris.map(uri => new URL(uri));
    const bucket = locations[0].host;
    if (!bucket || locations.some(url => url.protocol !== 's3:' || url.host !== bucket || url.search || url.hash)) return null;
    const directories = locations.map(url => url.pathname.split('/').slice(1, -1));
    const shared: string[] = [];
    for (const segment of directories[0]) {
      if (!segment || !directories.every(directory => directory[shared.length] === segment)) break;
      shared.push(segment);
    }
    if (!shared.length) return null;
    const prefix = `s3://${bucket}/${shared.join('/')}/`;
    return `aws s3 cp ${prefix} . --recursive --no-sign-request`;
  } catch { return null; }
}

export interface ProcessingSubmission {
  status: number;
  result: JobResult;
  location?: string;
}

export class ProcessingService {
  constructor(
    private readonly endpoint: string,
    private readonly getToken: () => Promise<string>,
  ) {}

  private async headers() {
    return { Authorization: `Bearer ${await this.getToken()}`, Accept: 'application/json' };
  }

  async getProcesses(): Promise<ProcessSummary[]> {
    const response = await axios.get<{ processes: ProcessSummary[] }>(`${this.endpoint}/processes`, {
      headers: await this.headers(),
    });
    return response.data.processes;
  }

  async getProcess(processId: string): Promise<ProcessDescription> {
    const response = await axios.get<ProcessDescription>(`${this.endpoint}/processes/${encodeURIComponent(processId)}`, {
      headers: await this.headers(),
    });
    return response.data;
  }

  async execute(processId: string, inputs: Record<string, unknown>): Promise<ProcessingSubmission> {
    const response = await axios.post<JobResult>(
      `${this.endpoint}/processes/${encodeURIComponent(processId)}/execution`,
      { inputs, outputs: { [`${processId}-response`]: { format: { mediaType: 'application/json' } } }, mode: 'async' },
      { headers: { ...await this.headers(), 'Content-Type': 'application/json', Prefer: 'respond-async' } },
    );
    return { status: response.status, result: response.data, location: response.headers.location };
  }

  async getJobs(): Promise<ProcessingJob[]> {
    const response = await axios.get<{ jobs: ProcessingJob[] }>(`${this.endpoint}/jobs`, {
      headers: await this.headers(),
    });
    return response.data.jobs;
  }

  async getJob(jobId: string): Promise<ProcessingJob> {
    const response = await axios.get<ProcessingJob>(`${this.endpoint}/jobs/${encodeURIComponent(jobId)}`, {
      headers: await this.headers(),
    });
    return response.data;
  }

  async getResults(jobId: string): Promise<JobResult> {
    const response = await axios.get<JobResult>(`${this.endpoint}/jobs/${encodeURIComponent(jobId)}/results`, {
      headers: await this.headers(),
    });
    return response.data;
  }
}