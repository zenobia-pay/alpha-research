import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { selectCanonicalDatasets } from './canonical-dataset-catalog.mjs'

const sessionPath = process.env.RESEARCH_SESSION_PATH ?? join(homedir(), '.research', 'session.json')
const promptPath = new URL('../prompts/canonical-dataset-improvement.md', import.meta.url)
const dryRun = process.argv.includes('--dry-run') || process.env.CANONICAL_DATASET_IMPROVEMENT_DRY_RUN === '1'
const maxConcurrentRemoteRuns = Math.max(1, Math.trunc(Number(process.env.CANONICAL_MAX_CONCURRENT_REMOTE_RUNS ?? '2')))

const canonicalDatasets = selectCanonicalDatasets()

const resources = {
  profile: 'standard-analysis',
  backend: 'modal',
  resourceProfile: 'standard-analysis',
  cpu: 8,
  memoryGb: 16,
  workspaceDiskGb: 100,
  storageMode: 'object-store-versioned',
  datasetAccess: 'write-version',
  publishMode: 'versioned',
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readSession() {
  assert(existsSync(sessionPath), `Missing RESEARCH session at ${sessionPath}`)
  const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
  assert(typeof session.origin === 'string' && session.origin.startsWith('http'), 'Invalid RESEARCH session origin.')
  assert(typeof session.accessToken === 'string' && session.accessToken.length > 0, 'Missing RESEARCH access token.')
  return session
}

function renderPrompt(template, dataset) {
  return template
    .replaceAll('{datasetId}', dataset.id)
    .replaceAll('{datasetName}', dataset.name)
    .replaceAll('{fieldBrief}', dataset.fieldBrief)
}

function dashboardRunUrl(origin, runId) {
  const dashboardOrigin = process.env.ALPHA_RESEARCH_DASHBOARD_ORIGIN ?? 'https://dashboard.alpharesearch.nyc'
  const url = new URL(dashboardOrigin)
  url.searchParams.set('view', 'runs')
  url.searchParams.set('runId', runId)
  url.hash = `run-${encodeURIComponent(runId)}`
  return url.toString()
}

async function api(session, path, options = {}) {
  const response = await fetch(`${session.origin}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(`Remote request failed (${response.status}) for ${path}: ${JSON.stringify(body)}`)
    error.status = response.status
    error.body = body
    throw error
  }
  return body
}

const promptTemplate = readFileSync(promptPath, 'utf8')
const results = []

if (dryRun) {
  for (const dataset of canonicalDatasets) {
    const prompt = renderPrompt(promptTemplate, dataset)
    results.push({
      datasetId: dataset.id,
      status: 'dry_run_ready',
      promptLength: prompt.length,
      resources,
      artifacts: [
        'improvement_plan.md',
        'improvement_result.json',
        'candidate_sources.csv',
        'exa_search_log.json',
        'slack_briefing.md',
        'dataset_briefing.md',
        'raw_inventory.jsonl',
        'raw_inventory.csv',
        `docs/public-datasets/briefings/${dataset.id}.md`,
        `docs/public-datasets/${dataset.id}.mdx`,
      ],
    })
  }
  console.log(JSON.stringify({ dryRun, results }, null, 2))
  process.exit()
}

let datasetPayload
let session
try {
  session = readSession()
  datasetPayload = await api(session, '/api/cli/datasets')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  for (const dataset of canonicalDatasets) {
    results.push({
      datasetId: dataset.id,
      status: 'blocked_remote_unreachable',
      origin: session?.origin ?? null,
      error: message,
    })
  }
  console.log(JSON.stringify({ dryRun, results }, null, 2))
  process.exitCode = 1
  process.exit()
}

const liveDatasets = new Map((datasetPayload.datasets ?? []).map((dataset) => [dataset.id, dataset]))
const activeCanonicalRuns = canonicalDatasets.filter((dataset) => {
  const liveDataset = liveDatasets.get(dataset.id)
  return Boolean(liveDataset?.activeRunId)
}).length
const startAllowance = Math.max(0, maxConcurrentRemoteRuns - activeCanonicalRuns)
let startedThisPass = 0

for (const dataset of canonicalDatasets) {
  const liveDataset = liveDatasets.get(dataset.id)
  if (!liveDataset) {
    results.push({ datasetId: dataset.id, status: 'skipped_missing_dataset' })
    continue
  }
  const deploymentReady = liveDataset.deploymentStatus === undefined || liveDataset.deploymentStatus === null || liveDataset.deploymentStatus === 'ready'
  if (liveDataset.status !== 'ready' || !deploymentReady) {
    results.push({
      datasetId: dataset.id,
      status: 'skipped_not_ready',
      datasetStatus: liveDataset.status,
      deploymentStatus: liveDataset.deploymentStatus,
    })
    continue
  }
  if (liveDataset.activeRunId) {
    results.push({ datasetId: dataset.id, status: 'skipped_active_run', activeRunId: liveDataset.activeRunId })
    continue
  }
  if (!dryRun && startedThisPass >= startAllowance) {
    results.push({
      datasetId: dataset.id,
      status: 'skipped_run_cap_reached',
      maxConcurrentRemoteRuns,
      activeCanonicalRuns,
      startedThisPass,
    })
    continue
  }

  const prompt = renderPrompt(promptTemplate, dataset)
  const body = {
    prompt,
    type: 'analysis',
    config: {
      canonicalDatasetImprovement: true,
      jobKind: 'dataset-improvement',
      datasetId: dataset.id,
      datasetName: dataset.name,
      writesDatasetBriefing: true,
      syncsDocsFromBriefing: true,
      resources,
    },
    artifacts: [
      { type: 'file', title: 'Improvement Plan', path: 'improvement_plan.md' },
      { type: 'structured_result', title: 'Improvement Result', path: 'improvement_result.json' },
      { type: 'table', title: 'Candidate Sources', path: 'candidate_sources.csv' },
      { type: 'structured_result', title: 'Exa Search Log', path: 'exa_search_log.json' },
      { type: 'file', title: 'Slack Briefing', path: 'slack_briefing.md' },
      { type: 'file', title: 'Dataset Briefing', path: 'dataset_briefing.md' },
      { type: 'file', title: 'Raw Inventory JSONL', path: 'raw_inventory.jsonl' },
      { type: 'table', title: 'Raw Inventory CSV', path: 'raw_inventory.csv' },
      { type: 'file', title: 'Docs Briefing Mirror', path: `docs/public-datasets/briefings/${dataset.id}.md` },
      { type: 'file', title: 'Docs Dataset Page', path: `docs/public-datasets/${dataset.id}.mdx` },
    ],
  }

  if (dryRun) {
    results.push({ datasetId: dataset.id, status: 'dry_run_ready', promptLength: prompt.length, resources })
    continue
  }

  try {
    const started = await api(session, `/api/cli/datasets/${encodeURIComponent(dataset.id)}/runs`, {
      method: 'POST',
      body,
    })
    const runId = started.run?.id ?? null
    results.push({
      datasetId: dataset.id,
      status: 'started',
      runId,
      dashboardUrl: runId ? dashboardRunUrl(session.origin, runId) : null,
    })
    startedThisPass += 1
  } catch (error) {
    results.push({
      datasetId: dataset.id,
      status: 'failed_to_start',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

const failed = results.filter((result) => result.status === 'failed_to_start')
console.log(JSON.stringify({ dryRun, results }, null, 2))
if (failed.length > 0) {
  process.exitCode = 1
}
