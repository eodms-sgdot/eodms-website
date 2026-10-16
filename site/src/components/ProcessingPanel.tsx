import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Collapse, IconButton, Link, MenuItem, Select, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import Blind from './Blind';
import AssetDownloadButton, { S3CopyButton } from './AssetDownloadButton';
import { AppContext } from '../AppContext';
import type { STACItem } from '../types';
import { getProcessingAssets, ProcessingService, type JobResult, type ProcessingJob, type ProcessingSubmission, type ProcessDescription, type ProcessSummary } from '../services/ProcessingService';

interface ProcessingPanelProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: (submission: ProcessingSubmission, job: ProcessingJob | null, processId: string, itemId: string, inputs: Record<string, unknown>, collection: string, orderKey?: string) => void;
  receipt: { submission: ProcessingSubmission; job: ProcessingJob | null; processId: string; itemId: string } | null;
  jobs: ProcessingJob[] | null;
  jobsError: string;
  onRefreshJobs: () => Promise<void>;
  onRefreshJob: (jobID: string) => Promise<void>;
  onRetryJob: (jobID: string) => Promise<boolean>;
  retryableJobIDs: Set<string>;
  jobDetailsByID: Record<string, { collection?: string; itemId?: string; orderKey?: string }>;
  onClearHistory: (jobID?: string) => void;
  candidate: STACItem | null;
  candidates: STACItem[];
  onSelectCandidate: (id: string) => void;
}

function seedMetadata(candidate: STACItem): Record<string, unknown> {
  const metadata = candidate.properties;
  return Object.fromEntries(Object.entries({
    uuid: typeof metadata.segment_id === 'string' ? metadata.segment_id : candidate.id,
    start_time: metadata.start_datetime ?? metadata.datetime,
    end_time: metadata.end_datetime ?? metadata.datetime,
  }).filter(([, value]) => value != null));
}

function seedInputs(description: ProcessDescription, candidate: STACItem): Record<string, unknown> {
  const definitions = description.inputs;
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) return seedMetadata(candidate);
  const metadata = candidate.properties;
  const seeds: Record<string, unknown> = { ...seedMetadata(candidate), stop_time: metadata.end_datetime ?? metadata.datetime };
  return Object.fromEntries(Object.entries(definitions).flatMap(([name, definition]) => {
    if (seeds[name] != null) return [[name, seeds[name]]];
    if (definition && typeof definition === 'object' && 'default' in definition) return [[name, definition.default]];
    return [];
  }));
}

function messageFor(cause: unknown): string {
  if (!axios.isAxiosError(cause)) return cause instanceof Error ? cause.message : String(cause);
  const details = cause.response?.data;
  const body = details && typeof details === 'object' ? details as { message?: string; error?: string; request_id?: string } : null;
  return [cause.response?.status && `HTTP ${cause.response.status}`, body?.message || cause.message,
    body?.error, body?.request_id && `request_id: ${body.request_id}`].filter(Boolean).join(' - ');
}

export default function ProcessingPanel({ open, onClose, onSubmitted, receipt, jobs, jobsError, onRefreshJobs, onRefreshJob, onRetryJob, retryableJobIDs, jobDetailsByID, onClearHistory, candidate, candidates, onSelectCandidate }: ProcessingPanelProps) {
  const { username, language, getValidAuthToken, t } = useContext(AppContext)!;
  const service = useMemo(() => new ProcessingService(import.meta.env.VITE_PROCESSING_URL || '/processing', getValidAuthToken), [getValidAuthToken]);
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [description, setDescription] = useState<ProcessDescription | null>(null);
  const [showInputSchema, setShowInputSchema] = useState(false);
  const [inputs, setInputs] = useState(() => candidate?.collection === 'Radarsat-1-FRED'
    ? JSON.stringify(seedMetadata(candidate), null, 2) : '{}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [jobResults, setJobResults] = useState<Record<string, JobResult>>({});
  const [refreshingJobIDs, setRefreshingJobIDs] = useState<Set<string>>(() => new Set());
  const [refreshingAllJobs, setRefreshingAllJobs] = useState(false);
  const [retryingJobID, setRetryingJobID] = useState<string | null>(null);
  const loadingResults = useRef(new Set<string>());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const visibleJobs = jobs?.slice().sort((first, second) => {
    const createdAt = (job: ProcessingJob) => {
      if (receipt?.job?.jobID === job.jobID && !job.created) return Infinity;
      const timestamp = Date.parse(job.created ?? '');
      return Number.isNaN(timestamp) ? -Infinity : timestamp;
    };
    return createdAt(second) - createdAt(first);
  }) ?? null;

  useEffect(() => {
    if (!open || !username) return;
    let active = true;
    service.getProcesses()
      .then(available => {
        if (active) { setProcesses(available); setError(''); }
      })
      .catch(cause => { if (active) setError(messageFor(cause)); });
    return () => { active = false; };
  }, [open, username, service]);

  useEffect(() => {
    if (!open || !selected) return;
    let active = true;
    service.getProcess(selected)
      .then(details => { if (active) {
        setDescription(details);
        setInputs(candidate?.collection === 'Radarsat-1-FRED' ? JSON.stringify(seedInputs(details, candidate), null, 2) : '{}');
        setError('');
      } })
      .catch(cause => { if (active) setError(messageFor(cause)); });
    return () => { active = false; };
  }, [open, selected, service, candidate]);

  useEffect(() => {
    if (!open || !jobs) return;
    jobs.filter(job => job.status === 'successful' && jobResults[job.jobID] === undefined && !loadingResults.current.has(job.jobID))
      .forEach(job => {
        loadingResults.current.add(job.jobID);
        service.getResults(job.jobID)
          .then(results => setJobResults(current => ({ ...current, [job.jobID]: results })))
          .catch(cause => setError(messageFor(cause)))
          .finally(() => { loadingResults.current.delete(job.jobID); });
      });
  }, [open, jobs, jobResults, service]);

  const inspectJob = async (job: ProcessingJob) => {
    if (expandedJob === job.jobID) { setExpandedJob(null); return; }
    setExpandedJob(job.jobID);
    if (job.status !== 'successful' && job.status !== 'failed' && job.status !== 'dismissed') return;
    try {
      const results = await service.getResults(job.jobID);
      setJobResults(current => ({ ...current, [job.jobID]: results }));
    } catch (cause) { setError(messageFor(cause)); }
  };

  const refreshJob = async (jobID: string) => {
    setRefreshingJobIDs(previous => new Set(previous).add(jobID));
    try { await onRefreshJob(jobID); }
    finally {
      setRefreshingJobIDs(previous => {
        const updated = new Set(previous);
        updated.delete(jobID);
        return updated;
      });
    }
  };

  const refreshAllJobs = async () => {
    setRefreshingAllJobs(true);
    try {
      await onRefreshJobs();
      const activeJobIDs = visibleJobs?.filter(job => job.status === 'accepted' || job.status === 'running')
        .map(job => job.jobID) ?? [];
      for (const jobID of activeJobIDs) await refreshJob(jobID);
    } finally { setRefreshingAllJobs(false); }
  };

  const retryJob = async (jobID: string) => {
    setRetryingJobID(jobID);
    setError('');
    try {
      if (!await onRetryJob(jobID)) setError(t('processingRetryUnavailable'));
    } catch (cause) { setError(messageFor(cause)); }
    finally { setRetryingJobID(null); }
  };

  const execute = async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(inputs); } catch { setError(t('processingInvalidInputs')); return; }
    if (!selected || !description || !candidate || candidate.collection !== 'Radarsat-1-FRED' || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError(t('processingInvalidInputs'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await service.execute(selected, parsed as Record<string, unknown>);
      const job = response.result && 'jobID' in response.result ? response.result : null;
      const locationJobId = response.location?.match(/\/jobs\/([^/?#]+)/)?.[1];
      onSubmitted(response, job ?? (locationJobId ? {
        type: 'process', jobID: decodeURIComponent(locationJobId), status: 'accepted', processID: selected,
      } : null), selected, candidate.id, parsed as Record<string, unknown>, candidate.collection,
      candidate.properties.order_key == null ? undefined : String(candidate.properties.order_key));
    } catch (cause) { setError(messageFor(cause)); }
    finally { setBusy(false); }
  };

  return (
    <Blind open={open} onClose={onClose} align="right" width={580}>
      <Box sx={{ px: 2, pb: 2, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
        <Typography variant="h6" color="primary">{t('processingTitle')}</Typography>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        <Typography variant="subtitle1">{t('processingSubmission')}</Typography>
        <Box sx={{ px: 1.5, py: 1, bgcolor: theme => alpha(theme.palette.primary.main, 0.08), borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCartIcon fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{t('cart')} ({candidates.length})</Typography>
          </Box>
          {candidates.length > 1 && <Select size="small" fullWidth value={candidate?.id ?? ''} onChange={event => onSelectCandidate(event.target.value)} inputProps={{ 'aria-label': t('processingCandidate') }} sx={{ mt: 1 }}>
            {candidates.map(item => <MenuItem key={item.id} value={item.id}>{item.collection} - {item.id}</MenuItem>)}
          </Select>}
          {candidate ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{candidate.collection} - {candidate.id}</Typography>
            : <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('processingSelectCandidate')}</Typography>}
        </Box>
        <Select size="small" displayEmpty value={selected} onChange={event => {
          setSelected(event.target.value); setDescription(null); setShowInputSchema(false);
        }} inputProps={{ 'aria-label': t('processingProcess') }}>
          <MenuItem value="" disabled>{t('processingProcess')}</MenuItem>
          {processes.map(process => <MenuItem key={process.id} value={process.id}>{process.title || process.id}</MenuItem>)}
        </Select>
        {description?.description && <Typography variant="body2">{description.description}</Typography>}
        {(candidate || description) && <>
          <Alert severity="info">{t('processingLimitedCollections')}</Alert>
          <Typography variant="subtitle2">{t('processingInputs')}</Typography>
          {description && <Box sx={{ minWidth: 0, bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', px: 1 }}>
              <Typography variant="caption" component="code" noWrap sx={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                {JSON.stringify(description.inputs)}
              </Typography>
              <Tooltip title={showInputSchema ? t('hideDetails') : t('showDetails')}>
                <IconButton size="small" sx={{ flexShrink: 0 }} aria-label={`${t('processingInputs')} - ${showInputSchema ? t('hideDetails') : t('showDetails')}`}
                  aria-expanded={showInputSchema} onClick={() => setShowInputSchema(open => !open)}>
                  <ExpandMoreIcon fontSize="small" sx={{ transform: showInputSchema ? 'rotate(180deg)' : 'none' }} />
                </IconButton>
              </Tooltip>
            </Box>
            <Collapse in={showInputSchema} unmountOnExit>
              <Box component="pre" sx={{ m: 0, p: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
                {JSON.stringify(description.inputs, null, 2)}
              </Box>
            </Collapse>
          </Box>}
          <TextField multiline minRows={3} maxRows={10} size="small" label={t('processingInputs')} value={inputs}
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
            onChange={event => setInputs(event.target.value)} />
          <Button variant="contained" disabled={busy || !description || candidate?.collection !== 'Radarsat-1-FRED'} onClick={execute}>{t('processingExecute')}</Button>
        </>}
        {busy && <CircularProgress size={20} />}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">{t('processingJobs')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={t('clearCompletedHistory')}>
              <span><IconButton size="small" aria-label={t('clearCompletedHistory')}
                disabled={!jobs?.some(job => job.status !== 'accepted' && job.status !== 'running')}
                color={jobs?.some(job => job.status !== 'accepted' && job.status !== 'running') ? 'error' : 'default'}
                onClick={() => onClearHistory()}><DeleteSweepIcon fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title={t('processingRefresh')}>
              <IconButton size="small" aria-label={t('processingRefresh')} disabled={refreshingAllJobs || refreshingJobIDs.size > 0}
                onClick={() => void refreshAllJobs()}>
                {refreshingAllJobs ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {jobsError && <Alert severity="error">{jobsError}</Alert>}
        {visibleJobs === null && !jobsError && <CircularProgress size={20} />}
        {visibleJobs?.length === 0 && <Typography variant="body2" color="text.secondary">{t('processingNoJobs')}</Typography>}
        {visibleJobs && visibleJobs.length > 0 && <Table size="small"><TableBody>
          {visibleJobs.map(job => {
            const httpAssets = getProcessingAssets(jobResults[job.jobID]);
            const s3Assets = getProcessingAssets(jobResults[job.jobID], 's3');
            const itemDetails = jobDetailsByID[job.jobID];
            const canRetry = retryableJobIDs.has(job.jobID);
            return <TableRow key={job.jobID} hover>
            <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 0, width: '75%' }}>
              <Typography variant="body2">{job.processID || t('processingJobs')}</Typography>
              {itemDetails?.collection && <Typography variant="body2" color="text.secondary">{t('collection')}: {itemDetails.collection}</Typography>}
              {itemDetails?.itemId && <Typography variant="body2" color="text.secondary">{t('itemId')}: {itemDetails.itemId}</Typography>}
              {itemDetails?.orderKey && <Typography variant="body2" color="text.secondary">{t('orderKey')}: {itemDetails.orderKey}</Typography>}
              <Typography variant="caption" color="text.secondary">{job.jobID}</Typography>
              {job.created && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{new Date(job.created).toLocaleString(language)}</Typography>}
              <Link component="button" variant="caption" aria-expanded={expandedJob === job.jobID} onClick={() => void inspectJob(job)}>
                {expandedJob === job.jobID ? t('hideDetails') : t('showDetails')}
              </Link>
              <Collapse in={expandedJob === job.jobID} unmountOnExit>
                {job.message && <Typography variant="body2">{job.message}</Typography>}
                {(job.status === 'accepted' || job.status === 'running') && <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
                  {JSON.stringify(job, null, 2)}
                </Box>}
                {jobResults[job.jobID] !== undefined && <Box component="pre" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {JSON.stringify(jobResults[job.jobID], null, 2)}
                </Box>}
                {receipt?.job?.jobID === job.jobID && <Box sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                  <Typography variant="caption" sx={{ display: 'block' }}>{t('processingSubmitted')} (HTTP {receipt.submission.status})</Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>{t('processingProcess')}: {receipt.processId}</Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>{t('itemId')}: {receipt.itemId}</Typography>
                  {receipt.submission.location && <Typography variant="caption" sx={{ display: 'block' }}>Location: {receipt.submission.location}</Typography>}
                  {receipt.submission.result !== null && <>
                    <Link component="button" variant="caption" onClick={() => setShowResponse(value => !value)}>
                      {showResponse ? t('hideDetails') : t('processingResponse')}
                    </Link>
                    {showResponse && <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
                      {JSON.stringify(receipt.submission.result, null, 2)}
                    </Box>}
                  </>}
                </Box>}
              </Collapse>
            </TableCell>
            <TableCell align="right">
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {job.status === 'successful' && s3Assets.length > 0 ? <S3CopyButton assets={s3Assets} /> :
                  <Tooltip title={job.status === 'failed' ? job.message || t('errorUnknownProcessingFailure') : ''}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', px: 1, py: 0.5, borderRadius: '4px', whiteSpace: 'nowrap',
                      bgcolor: job.status === 'successful' ? '#e8f5e9' : job.status === 'failed' ? '#ffebee' : job.status === 'running' ? '#fff3e0' : theme => theme.palette.mode === 'dark' ? theme.palette.action.selected : '#f5f5f5',
                      color: job.status === 'successful' ? 'success.main' : job.status === 'failed' ? 'error.main' : job.status === 'running' ? 'warning.main' : 'text.primary',
                    }}>
                      {t(({ accepted: 'processingAccepted', running: 'processingRunning', successful: 'processingSuccessful', failed: 'processingFailed', dismissed: 'processingDismissed' } as const)[job.status])}
                      {job.progress != null && job.status === 'running' ? ` (${job.progress}%)` : ''}
                    </Typography>
                  </Tooltip>}
                {(job.status === 'accepted' || job.status === 'running') && <Tooltip title={t('processingRefresh')}>
                  <span><IconButton size="small" aria-label={t('processingRefresh')} disabled={refreshingAllJobs || refreshingJobIDs.has(job.jobID)}
                    onClick={() => void refreshJob(job.jobID)}>
                    {refreshingJobIDs.has(job.jobID) ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
                  </IconButton></span>
                </Tooltip>}
                {job.status === 'failed' && <Tooltip title={t(canRetry ? 'retryProcessingJob' : 'processingRetryInputsUnavailable')}>
                  <span><IconButton size="small" color="error" aria-label={`${t(canRetry ? 'retryProcessingJob' : 'processingRetryInputsUnavailable')} - ${job.jobID}`}
                    disabled={!canRetry || retryingJobID === job.jobID} onClick={() => void retryJob(job.jobID)}>
                    {retryingJobID === job.jobID ? <CircularProgress size={20} /> : <ReplayIcon fontSize="small" />}
                  </IconButton></span>
                </Tooltip>}
                {job.status === 'successful' && httpAssets.length > 0 && <AssetDownloadButton assets={httpAssets} compact />}
                {job.status !== 'accepted' && job.status !== 'running' && <Tooltip title={t('removeFromHistory')}>
                  <IconButton size="small" color="error" aria-label={`${t('removeFromHistory')} - ${job.jobID}`}
                    onClick={() => onClearHistory(job.jobID)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>}
              </Box>
            </TableCell>
          </TableRow>;
          })}
        </TableBody></Table>}
      </Box>
    </Blind>
  );
}