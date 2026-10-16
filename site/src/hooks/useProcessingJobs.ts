import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ProcessingService, type ProcessingJob } from '../services/ProcessingService';

const POLL_INTERVAL_MS = 30_000;
const isPending = (job: ProcessingJob) => job.status === 'accepted' || job.status === 'running';
const statusRank = (job: ProcessingJob) => job.status === 'accepted' ? 0 : job.status === 'running' ? 1 : 2;
const jobsKey = (username: string) => `processing_jobs_${username}`;
const hiddenKey = (username: string) => `processing_hidden_${username}`;
const retryKey = (username: string) => `processing_retry_${username}`;
const isProcessingJob = (value: unknown): value is ProcessingJob => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as Partial<ProcessingJob>;
  return typeof job.jobID === 'string'
    && ['accepted', 'running', 'successful', 'failed', 'dismissed'].includes(job.status ?? '');
};
const loadJobs = (username: string): ProcessingJob[] | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(jobsKey(username)) ?? 'null');
    if (!Array.isArray(parsed)) return null;
    const hidden = hiddenJobs(username);
    return parsed.filter(isProcessingJob).filter(job => !hidden.has(job.jobID));
  } catch { return null; }
};
interface ProcessingRetryInput {
  processID: string;
  inputs: Record<string, unknown>;
  collection?: string;
  itemId?: string;
  orderKey?: string;
}
const loadRetryInputs = (username: string): Record<string, ProcessingRetryInput> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(retryKey(username)) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, ProcessingRetryInput] => {
      const value = entry[1];
      return !!value && typeof value === 'object' && !Array.isArray(value)
        && typeof value.processID === 'string' && !!value.inputs && typeof value.inputs === 'object' && !Array.isArray(value.inputs);
    }));
  } catch { return {}; }
};
const hiddenJobs = (username: string): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(hiddenKey(username)) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch { return new Set(); }
};

export function useProcessingJobs(username: string | null, getValidAuthToken: () => Promise<string>) {
  const service = useMemo(() => new ProcessingService(import.meta.env.VITE_PROCESSING_URL || '/processing', getValidAuthToken), [getValidAuthToken]);
  const activeUsername = useRef(username);
  useLayoutEffect(() => { activeUsername.current = username; }, [username]);
  const [state, setState] = useState<{ username: string | null; jobs: ProcessingJob[] | null }>({ username: null, jobs: null });
  const [error, setError] = useState('');
  const jobs = username ? state.username === username ? state.jobs : loadJobs(username) : null;
  const retryInputs = username ? loadRetryInputs(username) : {};

  const refreshJobs = useCallback(async () => {
    if (!username || activeUsername.current !== username) return;
    try {
      const current = await service.getJobs();
      if (activeUsername.current !== username) return;
      setState(previous => {
        if (activeUsername.current !== username) return previous;
        const hidden = hiddenJobs(username);
        const knownJobs = previous.username === username && previous.jobs ? previous.jobs : loadJobs(username) ?? [];
        return {
          username,
          jobs: [
            ...current.filter(job => !hidden.has(job.jobID)).map(job => {
              const known = knownJobs.find(existing => existing.jobID === job.jobID);
              return known && statusRank(known) > statusRank(job) ? known : job;
            }),
            ...knownJobs.filter(job => !hidden.has(job.jobID) && !current.some(listed => listed.jobID === job.jobID)),
          ],
        };
      });
      setError('');
    } catch (cause) {
      if (activeUsername.current === username) setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [username, service]);

  useEffect(() => {
    if (!state.username || !state.jobs) return;
    try { localStorage.setItem(jobsKey(state.username), JSON.stringify(state.jobs)); } catch { /* Keep the in-memory history available. */ }
  }, [state]);

  const refreshJob = useCallback(async (jobID: string) => {
    if (!username || activeUsername.current !== username || !jobID) return;
    try {
      const refreshed = await service.getJob(jobID);
      if (activeUsername.current !== username) return;
      setState(previous => {
        if (previous.username !== username || !previous.jobs) return previous;
        const existing = previous.jobs.find(job => job.jobID === jobID);
        if (!existing) return previous;
        const next = statusRank(existing) > statusRank(refreshed) ? existing : refreshed;
        return {
          username,
          jobs: previous.jobs.map(job => job.jobID === jobID ? next : job),
        };
      });
      setError('');
    } catch (cause) {
      if (activeUsername.current === username) setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [username, service]);

  useEffect(() => {
    if (!username) return;
    const initial = window.setTimeout(() => { void refreshJobs(); }, 0);
    const retry = window.setInterval(() => { void refreshJobs(); }, POLL_INTERVAL_MS);
    return () => { window.clearTimeout(initial); window.clearInterval(retry); };
  }, [username, refreshJobs]);

  const registerJob = useCallback((job: ProcessingJob | null, retryInput?: ProcessingRetryInput) => {
    if (!username || activeUsername.current !== username || !job) return;
    if (retryInput) {
      const updated = { ...loadRetryInputs(username), [job.jobID]: retryInput };
      try { localStorage.setItem(retryKey(username), JSON.stringify(updated)); } catch { /* Keep retry available in memory. */ }
    }
    setState(previous => ({
      username,
      jobs: [job, ...(previous.username === username ? previous.jobs ?? [] : []).filter(existing => existing.jobID !== job.jobID)],
    }));
  }, [username]);

  const retryJob = useCallback(async (jobID: string): Promise<boolean> => {
    if (!username || activeUsername.current !== username) return false;
    const retryInput = loadRetryInputs(username)[jobID];
    if (!retryInput) return false;
    const submission = await service.execute(retryInput.processID, retryInput.inputs);
    if (activeUsername.current !== username) return false;
    const returnedJob = submission.result && 'jobID' in submission.result ? submission.result as ProcessingJob : null;
    const locationJobID = submission.location?.match(/\/jobs\/([^/?#]+)/)?.[1];
    const newJob = returnedJob ?? (locationJobID ? {
      type: 'process',
      jobID: decodeURIComponent(locationJobID),
      status: 'accepted' as const,
      processID: retryInput.processID,
    } : null);
    if (!newJob) return false;
    registerJob(newJob, retryInput);
    return true;
  }, [username, service, registerJob]);

  const clearProcessingHistory = useCallback((jobID?: string) => {
    if (!username || activeUsername.current !== username) return;
    setState(previous => {
      if (previous.username !== username || !previous.jobs) return previous;
      const hidden = hiddenJobs(username);
      const removed = previous.jobs.filter(job => !isPending(job) && (jobID === undefined || job.jobID === jobID));
      removed.forEach(job => hidden.add(job.jobID));
      localStorage.setItem(hiddenKey(username), JSON.stringify([...hidden]));
      const retryInputs = loadRetryInputs(username);
      removed.forEach(job => delete retryInputs[job.jobID]);
      localStorage.setItem(retryKey(username), JSON.stringify(retryInputs));
      return { username, jobs: previous.jobs.filter(job => !hidden.has(job.jobID)) };
    });
  }, [username]);

  useEffect(() => {
    if (!username || !jobs?.some(isPending)) return;
    let active = true;
    let loading = false;
    const poll = async () => {
      if (loading) return;
      loading = true;
      const pending = jobs.filter(isPending);
      const updates = await Promise.all(pending.map(async job => {
        try { return await service.getJob(job.jobID); }
        catch (cause) {
          if (active && activeUsername.current === username) setError(cause instanceof Error ? cause.message : String(cause));
          return null;
        }
      }));
      if (active && activeUsername.current === username) {
        const byId = new Map(updates.filter((job): job is ProcessingJob => job !== null).map(job => [job.jobID, job]));
        if (byId.size) {
          setState(previous => previous.username === username && previous.jobs ? {
            username,
            jobs: previous.jobs.map(job => byId.get(job.jobID) ?? job),
          } : previous);
          if (byId.size === pending.length) setError('');
        }
      }
      loading = false;
    };
    const timer = window.setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [username, jobs, service]);

  return {
    jobs,
    error,
    refreshJobs,
    refreshJob,
    registerJob,
    retryJob,
    retryableJobIDs: new Set(Object.keys(retryInputs)),
    jobDetailsByID: retryInputs,
    clearProcessingHistory,
  };
}