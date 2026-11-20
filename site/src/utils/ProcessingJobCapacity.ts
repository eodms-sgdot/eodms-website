import type { ProcessingJob } from '../services/ProcessingService';

export const MAX_ACTIVE_PROCESSING_JOBS = 2;

export function getAvailableProcessingJobSlots(jobs: ProcessingJob[] | null, reservedSlots = 0): number {
  if (!jobs) return 0;
  const activeJobs = jobs.filter(job => job.status === 'accepted' || job.status === 'running').length;
  return Math.max(0, MAX_ACTIVE_PROCESSING_JOBS - activeJobs - reservedSlots);
}

export function getProcessingSubmissionCount(candidateCount: number, availableSlots: number): number {
  return Math.max(0, Math.min(candidateCount, availableSlots));
}
