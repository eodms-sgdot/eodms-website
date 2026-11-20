import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Collapse, FormControl, IconButton, InputLabel, Link, MenuItem, Select, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import Blind from './Blind';
import AssetDownloadButton, { S3CopyButton } from './AssetDownloadButton';
import { AppContext } from '../AppContext';
import type { STACItem } from '../types';
import { getProcessingAssets, ProcessingService, type JobResult, type ProcessingJob, type ProcessingSubmission, type ProcessDescription, type ProcessSummary } from '../services/ProcessingService';
import { formatStacDateAsLocalInput } from '../utils/DateUtils';
import { isProcessingItem } from '../utils/ProcessingCollection';
import { getAvailableProcessingJobSlots, getProcessingSubmissionCount, MAX_ACTIVE_PROCESSING_JOBS } from '../utils/ProcessingJobCapacity';
import { formatProcessingInputBlocks, getProcessingInputsForCandidate } from '../utils/ProcessingInputs';

interface ProcessingPanelProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: (submission: ProcessingSubmission, job: ProcessingJob | null, processId: string, itemId: string, inputs: Record<string, unknown>, collection: string, orderKey?: string) => void;
  receipt: { submission: ProcessingSubmission; job: ProcessingJob | null; processId: string; itemId: string } | null;
  jobs: ProcessingJob[] | null;
  jobsLoaded: boolean;
  jobsError: string;
  onRefreshJobs: () => Promise<void>;
  onRefreshJob: (jobID: string) => Promise<void>;
  onRetryJob: (jobID: string) => Promise<boolean>;
  retryableJobIDs: Set<string>;
  jobDetailsByID: Record<string, { collection?: string; itemId?: string; orderKey?: string }>;
  onClearHistory: (jobID?: string) => void;
  candidates: STACItem[];
  totalCartCount: number;
  onBatchSubmitted: (itemIDs: string[]) => void;
}

function messageFor(cause: unknown): string {
  if (!axios.isAxiosError(cause)) return cause instanceof Error ? cause.message : String(cause);
  const details = cause.response?.data;
  const body = details && typeof details === 'object' ? details as { message?: string; error?: string; request_id?: string } : null;
  return [cause.response?.status && `HTTP ${cause.response.status}`, body?.message || cause.message,
    body?.error, body?.request_id && `request_id: ${body.request_id}`].filter(Boolean).join(' - ');
}

function formatJobCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatStacDateAsLocalInput(date).slice(0, 16).replace('T', ' ');
}

export default function ProcessingPanel({ open, onClose, onSubmitted, receipt, jobs, jobsLoaded, jobsError, onRefreshJobs, onRefreshJob, onRetryJob, retryableJobIDs, jobDetailsByID, onClearHistory, candidates, totalCartCount, onBatchSubmitted }: ProcessingPanelProps) {
  const { username, getValidAuthToken, t } = useContext(AppContext)!;
  const service = useMemo(() => new ProcessingService(import.meta.env.VITE_PROCESSING_URL || '/processing', getValidAuthToken), [getValidAuthToken]);
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [processorMenuWidth, setProcessorMenuWidth] = useState<number>();
  const processorSelectRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState<ProcessDescription | null>(null);
  const [showInputSchema, setShowInputSchema] = useState(false);
  const [showInputBlocks, setShowInputBlocks] = useState(false);
  const [editedInputs, setEditedInputs] = useState<{ contextKey: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [jobResults, setJobResults] = useState<Record<string, JobResult>>({});
  const [refreshingJobIDs, setRefreshingJobIDs] = useState<Set<string>>(() => new Set());
  const [refreshingAllJobs, setRefreshingAllJobs] = useState(false);
  const [retryingJobID, setRetryingJobID] = useState<string | null>(null);
  const availableJobSlots = jobsLoaded ? getAvailableProcessingJobSlots(jobs, retryingJobID === null ? 0 : 1) : 0;
  const submissionCount = getProcessingSubmissionCount(candidates.length, availableJobSlots);
  const inputCandidates = useMemo(() => candidates.slice(0, submissionCount), [candidates, submissionCount]);
  const inputContextKey = useMemo(() => JSON.stringify([
    selected,
    inputCandidates.map(item => item.id),
    description?.inputs ?? null,
  ]), [selected, inputCandidates, description?.inputs]);
  const defaultInputs = useMemo(
    () => formatProcessingInputBlocks(inputCandidates, description ?? undefined),
    [inputCandidates, description],
  );
  const inputs = editedInputs?.contextKey === inputContextKey ? editedInputs.value : defaultInputs;
  const cartLabel = t('processingCartCount')
    .replace('{eligible}', String(inputCandidates.length))
    .replace('{total}', String(totalCartCount));
  const activeProcessingJobCount = jobs?.filter(job => job.status === 'accepted' || job.status === 'running').length ?? 0;
  const processingJobsMaxedOut = jobsLoaded && activeProcessingJobCount >= MAX_ACTIVE_PROCESSING_JOBS;
  const slotIndicatorColor = !jobsLoaded ? 'text.secondary'
    : processingJobsMaxedOut ? 'error.main' : 'success.main';
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
      } })
      .catch(cause => { if (active) setError(messageFor(cause)); });
    return () => { active = false; };
  }, [open, selected, service, candidates]);

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
    if (!jobsLoaded) { setError(t('processingJobsLoading')); return; }
    if (availableJobSlots === 0 || busy || retryingJobID !== null) { setError(t('processingJobCapacityReached')); return; }
    setRetryingJobID(jobID);
    setError('');
    try {
      if (!await onRetryJob(jobID)) setError(t('processingRetryUnavailable'));
    } catch (cause) { setError(messageFor(cause)); }
    finally { setRetryingJobID(null); }
  };

  const execute = async () => {
    let inputBlocks: Record<string, unknown>[];
    try {
      const parsedBlocks: unknown[] = inputs.split(/^[ \t]*\.\.\.[ \t]*$/m).map(block => JSON.parse(block));
      if (parsedBlocks.length !== inputCandidates.length || parsedBlocks.some(value => value === null || typeof value !== 'object' || Array.isArray(value))) {
        throw new Error('Invalid candidate input blocks');
      }
      inputBlocks = parsedBlocks as Record<string, unknown>[];
    } catch {
      setError(t('processingInvalidInputs'));
      return;
    }
    if (!selected || !description || inputCandidates.length === 0 || candidates.some(item => !isProcessingItem(item)) || retryingJobID !== null) {
      setError(t('processingInvalidInputs'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const results = await Promise.all(inputCandidates.map(async (item, index) => {
        const itemInputs = getProcessingInputsForCandidate(description, item, inputBlocks[index]);
        try {
          return { status: 'submitted' as const, item, itemInputs, response: await service.execute(selected, itemInputs) };
        } catch (cause) {
          return { status: 'failed' as const, item, error: `${item.id}: ${messageFor(cause)}` };
        }
      }));
      const failedItems: string[] = [];
      const submittedItemIDs: string[] = [];
      for (const result of results) {
        if (result.status === 'failed') {
          failedItems.push(result.error);
          continue;
        }
        const { item, itemInputs, response } = result;
        const job = response.result && 'jobID' in response.result ? response.result : null;
        const locationJobId = response.location?.match(/\/jobs\/([^/?#]+)/)?.[1];
        onSubmitted(response, job ?? (locationJobId ? {
          type: 'process', jobID: decodeURIComponent(locationJobId), status: 'accepted', processID: selected,
        } : null), selected, item.id, itemInputs, item.collection,
        item.properties.order_key == null ? undefined : String(item.properties.order_key));
        submittedItemIDs.push(item.id);
      }
      if (failedItems.length) setError(failedItems.join(' | '));
      if (submittedItemIDs.length) onBatchSubmitted(submittedItemIDs);
    }
    finally { setBusy(false); }
  };

  return (
    <Blind open={open} onClose={onClose} align="right" width={580}>
      <Box sx={{ px: 2, pb: 2, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }} data-tour="processing">
        <Typography variant="h6" color="primary">{t('processingTitle')}</Typography>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        {!jobsLoaded && !jobsError && <Alert severity="info">{t('processingJobsLoading')}</Alert>}
        {jobsLoaded && candidates.length > 0 && availableJobSlots === 0 && <Alert severity="info">{t('processingJobCapacityReached')}</Alert>}
        <FormControl ref={processorSelectRef} fullWidth variant="outlined" size="small">
          <InputLabel shrink id="processing-processor-label">{t('processingProcessor')}</InputLabel>
          <Select labelId="processing-processor-label" label={t('processingProcessor')} size="small" displayEmpty value={selected}
            MenuProps={{ slotProps: { paper: { sx: { width: processorMenuWidth, maxWidth: processorMenuWidth } } } }}
            renderValue={value => {
              if (!value) return t('processingProcess');
              const process = processes.find(candidate => candidate.id === value);
              return process?.title || String(value);
            }}
            onOpen={() => {
              const width = processorSelectRef.current?.getBoundingClientRect().width;
              if (width) setProcessorMenuWidth(width);
            }}
            onChange={event => {
              setSelected(event.target.value); setDescription(null); setShowInputSchema(false); setShowInputBlocks(false); setError('');
            }}>
            <MenuItem value="" disabled>{t('processingProcess')}</MenuItem>
            {processes.map(process => <MenuItem key={process.id} value={process.id} sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2">{process.title || process.id}</Typography>
                {process.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                  {process.description}
                </Typography>}
              </Box>
            </MenuItem>)}
          </Select>
        </FormControl>
        {description && <>
          <Link component="button" type="button" variant="body2" sx={{ justifySelf: 'start', textAlign: 'left' }}
            aria-expanded={showInputSchema} aria-controls="processing-description-json"
            onClick={() => setShowInputSchema(open => !open)}>
            {t('processingDescription')}
          </Link>
          <Collapse in={showInputSchema} unmountOnExit>
            <Box id="processing-description-json" sx={{ minWidth: 0, p: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>
                {JSON.stringify(description.inputs, null, 2)}
              </Box>
            </Box>
          </Collapse>
        </>}
        <Box sx={{ px: 1.5, py: 1, bgcolor: theme => alpha(theme.palette.primary.main, 0.08), borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCartIcon fontSize="small" color="primary" />
            <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>{cartLabel}</Typography>
          </Box>
          {candidates.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('processingSelectCandidate')}</Typography>}
        </Box>
        {(candidates.length > 0 || description) && <Alert severity="info">{t('processingLimitedCollections')}</Alert>}
        {inputCandidates.length > 0 && <>
          <Link component="button" type="button" variant="body2" sx={{ justifySelf: 'start', textAlign: 'left' }}
            aria-expanded={showInputBlocks} aria-controls="processing-input-json"
            onClick={() => setShowInputBlocks(open => !open)}>
            {t('processingInput')}
          </Link>
          <Collapse in={showInputBlocks} unmountOnExit>
            <TextField id="processing-input-json" multiline minRows={3} maxRows={10} size="small" fullWidth
              label={t('processingInput')} helperText={t('processingInputHelp')} value={inputs}
              slotProps={{ input: { sx: { fontFamily: '"Cascadia Code", monospace', fontSize: 12 } } }}
              onChange={event => setEditedInputs({ contextKey: inputContextKey, value: event.target.value })} />
          </Collapse>
        </>}
        {description && <>
          <Button variant="contained" color={processingJobsMaxedOut ? 'error' : 'primary'}
            sx={processingJobsMaxedOut ? {
              '&.Mui-disabled': {
                backgroundColor: 'error.light',
                color: 'error.dark',
              },
            } : undefined}
            disabled={busy || retryingJobID !== null || !jobsLoaded || !description || candidates.length === 0 || candidates.some(item => !isProcessingItem(item)) || submissionCount === 0}
            onClick={execute}>
            {processingJobsMaxedOut
              ? t('processingExecuteMaxedOut')
                .replace('{active}', String(activeProcessingJobCount))
                .replace('{max}', String(MAX_ACTIVE_PROCESSING_JOBS))
              : t('processingExecute').replace('{count}', String(submissionCount))}
          </Button>
        </>}
        {busy && <CircularProgress size={20} />}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1">{t('processingJobs')}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: slotIndicatorColor }}>
              <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'currentColor' }} />
              <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
                {t('processingJobSlotCount')
                  .replace('{active}', jobsLoaded ? String(activeProcessingJobCount) : '—')
                  .replace('{max}', String(MAX_ACTIVE_PROCESSING_JOBS))}
              </Typography>
            </Box>
          </Box>
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
            const hasRetryInputs = retryableJobIDs.has(job.jobID);
            const canRetry = hasRetryInputs && jobsLoaded && availableJobSlots > 0 && !busy && retryingJobID === null;
            const retryTooltip = !hasRetryInputs ? 'processingRetryInputsUnavailable'
              : !jobsLoaded ? 'processingJobsLoading'
                : canRetry ? 'retryProcessingJob' : 'processingJobCapacityReached';
            return <TableRow key={job.jobID} hover>
            <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 0, width: '75%' }}>
              <Typography variant="body2">{job.processID || t('processingJobs')}</Typography>
              {itemDetails?.collection && <Typography variant="body2" color="text.secondary">{t('collection')}: {itemDetails.collection}</Typography>}
              {itemDetails?.itemId && <Typography variant="body2" color="text.secondary">{t('itemId')}: {itemDetails.itemId}</Typography>}
              {itemDetails?.orderKey && <Typography variant="body2" color="text.secondary">{t('orderKey')}: {itemDetails.orderKey}</Typography>}
              <Typography variant="caption" color="text.secondary">{job.jobID}</Typography>
              {job.created && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{formatJobCreatedAt(job.created)}</Typography>}
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
                {job.status === 'failed' && <Tooltip title={t(retryTooltip)}>
                  <span><IconButton size="small" color="error" aria-label={`${t(retryTooltip)} - ${job.jobID}`}
                    disabled={!canRetry} onClick={() => void retryJob(job.jobID)}>
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