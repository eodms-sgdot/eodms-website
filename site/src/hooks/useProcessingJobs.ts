import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProcessingService, type ProcessingJob } from '../services/ProcessingService';

const POLL_INTERVAL_MS = 30_000;
const isPending = (job: ProcessingJob) => job.status === 'accepted' || job.status === 'running';
const statusRank = (job: ProcessingJob) => job.status === 'accepted' ? 0 : job.status === 'running' ? 1 : 2;
const hiddenKey = (username: string) => `processing_hidden_${username}`;
const hiddenJobs = (username: string): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(hiddenKey(username)) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch { return new Set(); }
};

export function useProcessingJobs(username: string | null, getValidAuthToken: () => Promise<string>) {
  const service = useMemo(() => new ProcessingService(import.meta.env.VITE_PROCESSING_URL || '/processing', getValidAuthToken), [getValidAuthToken]);
  const [state, setState] = useState<{ username: string | null; jobs: ProcessingJob[] | null }>({ username: null, jobs: null });
  const [error, setError] = useState('');
  const jobs = username && state.username === username ? state.jobs : null;

  const refreshJobs = useCallback(async () => {
    if (!username) return;
    try {
      const current = await service.getJobs();
      setState(previous => {
        const hidden = hiddenJobs(username);
        return {
          username,
          jobs: [
            ...current.filter(job => !hidden.has(job.jobID)).map(job => {
              const known = previous.username === username && previous.jobs?.find(existing => existing.jobID === job.jobID);
              return known && statusRank(known) > statusRank(job) ? known : job;
            }),
            ...(previous.username === username && previous.jobs
              ? previous.jobs.filter(job => !hidden.has(job.jobID) && !current.some(listed => listed.jobID === job.jobID)) : []),
          ],
        };
      });
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [username, service]);

  const refreshJob = useCallback(async (jobID: string) => {
    if (!username || !jobID) return;
    try {
      const refreshed = await service.getJob(jobID);
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
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [username, service]);

  useEffect(() => {
    if (!username || jobs !== null) return;
    const initial = window.setTimeout(() => { void refreshJobs(); }, 0);
    const retry = window.setInterval(() => { void refreshJobs(); }, POLL_INTERVAL_MS);
    return () => { window.clearTimeout(initial); window.clearInterval(retry); };
  }, [username, jobs, refreshJobs]);

  const registerJob = useCallback((job: ProcessingJob | null) => {
    if (!username || !job) return;
    setState(previous => ({
      username,
      jobs: [job, ...(previous.username === username ? previous.jobs ?? [] : []).filter(existing => existing.jobID !== job.jobID)],
    }));
  }, [username]);

  const clearProcessingHistory = useCallback((jobID?: string) => {
    if (!username) return;
    setState(previous => {
      if (previous.username !== username || !previous.jobs) return previous;
      const hidden = hiddenJobs(username);
      previous.jobs.filter(job => !isPending(job) && (jobID === undefined || job.jobID === jobID))
        .forEach(job => hidden.add(job.jobID));
      localStorage.setItem(hiddenKey(username), JSON.stringify([...hidden]));
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
          if (active) setError(cause instanceof Error ? cause.message : String(cause));
          return null;
        }
      }));
      if (active) {
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

  return { jobs, error, refreshJobs, refreshJob, registerJob, clearProcessingHistory };
}