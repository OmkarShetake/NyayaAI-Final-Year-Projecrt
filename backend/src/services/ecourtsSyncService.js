/**
 * eCourts / NJDG Sync Service
 * ----------------------------
 * Fetches real case data from the Indian eCourts API and upserts it into MongoDB.
 *
 * HOW TO ENABLE:
 *   1. Register at https://services.ecourts.gov.in/ecourtindia_v6/?p=faq/technical
 *   2. Get your API key and paste it as ECOURTS_API_KEY in your .env
 *   3. Set ECOURTS_COURT_COMPLEX_CODES to the court complex codes you want to sync
 *      (find codes in the eCourts portal under "Court Complex List")
 *   4. Set ECOURTS_SYNC_ENABLED=true in your .env
 *
 * USAGE:
 *   - Manual one-off sync:   node backend/src/scripts/syncEcourts.js
 *   - From code:             require('./ecourtsSyncService').syncAll()
 */

const axios = require('axios');
const Case = require('../models/Case');
const logger = require('../config/logger');

// ─── Config read from env ────────────────────────────────────────────────────
const ENABLED = process.env.ECOURTS_SYNC_ENABLED === 'true';
const API_KEY = process.env.ECOURTS_API_KEY || '';
const BASE_URL = process.env.ECOURTS_API_BASE_URL || 'https://services.ecourts.gov.in/ecourtindia_v6/api';
const PAGE_SIZE = Number(process.env.ECOURTS_SYNC_PAGE_SIZE) || 50;
// Comma-separated court complex codes e.g. "HKA01,MH001"
const COURT_CODES = (process.env.ECOURTS_COURT_COMPLEX_CODES || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

// ─── HTTP client ─────────────────────────────────────────────────────────────
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    // eCourts uses an Authorization header — adjust if their docs say otherwise
    Authorization: `Bearer ${API_KEY}`,
  },
});

// ─── Field mapping ───────────────────────────────────────────────────────────
/**
 * Maps a raw eCourts API case object to your Case model shape.
 * Adjust field names here to match whatever the actual eCourts response returns.
 * The field names below are based on the documented eCourts v6 response structure.
 */
function mapToCase(raw) {
  // eCourts returns dates as "DD-MM-YYYY" strings — convert to JS Date
  const parseDate = (str) => {
    if (!str) return undefined;
    const [d, m, y] = str.split('-');
    if (!d || !m || !y) return undefined;
    return new Date(`${y}-${m}-${d}`);
  };

  // Map eCourts court type strings to your enum values
  const courtMap = {
    'District Court': 'District Court',
    'Sessions Court': 'Sessions Court',
    'High Court': 'High Court',
    'Family Court': 'Family Court',
    'Consumer Forum': 'Consumer Forum',
    'Magistrate Court': 'Magistrate Court',
  };

  // Map eCourts case type to your enum
  const caseTypeMap = {
    'Civil': 'Civil',
    'Criminal': 'Criminal',
    'Family': 'Family',
    'Property': 'Property',
    'Commercial': 'Commercial',
    'Consumer': 'Consumer',
    'Labour': 'Labour',
    'Cheque Bounce': 'Cheque Bounce',
    'CS': 'Civil',
    'CRL': 'Criminal',
    'FA': 'Family',
    'CC': 'Consumer',
  };

  // Map eCourts stage to your enum
  const stageMap = {
    'Filing': 'Filing',
    'Admission': 'Admission',
    'Notice': 'Notice Issued',
    'Pleadings': 'Pleadings',
    'Evidence': 'Evidence',
    'Arguments': 'Arguments',
    'Judgment': 'Judgment Reserved',
    'Judgment Reserved': 'Judgment Reserved',
  };

  const court = courtMap[raw.court_name] || 'District Court';
  const caseType = caseTypeMap[raw.case_type] || caseTypeMap[raw.case_category] || 'Civil';
  const rawStage = raw.stage_of_case || raw.case_stage || '';
  const currentStage = Object.entries(stageMap).find(([k]) => rawStage.toLowerCase().includes(k.toLowerCase()))?.[1] || 'Pleadings';

  return {
    caseNumber: raw.cno || raw.case_no || raw.cnr_number,
    title: raw.case_title || `${raw.petitioner_name || 'Unknown'} vs ${raw.respondent_name || 'Unknown'}`,
    court,
    state: raw.state_name || raw.state || 'Unknown',
    district: raw.dist_name || raw.district || '',
    caseType,
    filingDate: parseDate(raw.date_of_filing || raw.filing_date),
    currentStage,
    status: raw.case_status === 'D' || raw.case_status === 'Disposed' ? 'Disposed' : 'Pending',
    priority: 'Normal',
    petitioner: raw.petitioner_name || raw.petitioner || 'Unknown',
    respondent: raw.respondent_name || raw.respondent || 'Unknown',
    judge: raw.judge_name || raw.coram || '',
    numberOfHearings: Number(raw.total_hearings || raw.no_of_hearings || 0),
    numberOfAdjournments: Number(raw.no_of_adjournments || raw.adjournments || 0),
    lastHearingDate: parseDate(raw.last_hearing_date || raw.last_date),
    nextHearingDate: parseDate(raw.next_hearing_date || raw.next_date),
    legalSections: (raw.acts || raw.sections || '').split(',').map((s) => s.trim()).filter(Boolean),
    description: raw.case_details || raw.subject || '',
    isSample: false, // real data, not synthetic
  };
}

// ─── Core sync logic ─────────────────────────────────────────────────────────

/**
 * Fetches one page of pending cases for a given court complex code.
 * Adjust the endpoint path and params to match the actual eCourts API docs.
 */
async function fetchPage(courtCode, pageNo) {
  const { data } = await client.get('/pending_cases', {
    params: {
      court_code: courtCode,
      page_no: pageNo,
      page_size: PAGE_SIZE,
    },
  });
  // eCourts typically wraps results — adjust based on actual response shape
  return data?.cases || data?.result || data?.data || [];
}

/**
 * Syncs all cases for a single court complex code.
 * Returns { inserted, updated, skipped, errors }.
 */
async function syncCourt(courtCode) {
  logger.info(`[eCourts] Starting sync for court: ${courtCode}`);
  let pageNo = 1;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  let hasMore = true;

  while (hasMore) {
    let rows;
    try {
      rows = await fetchPage(courtCode, pageNo);
    } catch (err) {
      logger.error(`[eCourts] Failed to fetch page ${pageNo} for ${courtCode}: ${err.message}`);
      break;
    }

    if (!rows || rows.length === 0) {
      hasMore = false;
      break;
    }

    for (const raw of rows) {
      try {
        const mapped = mapToCase(raw);
        if (!mapped.caseNumber || !mapped.filingDate) {
          totalErrors += 1;
          continue; // skip incomplete records
        }

        const existing = await Case.findOne({ caseNumber: mapped.caseNumber });
        if (existing) {
          // Update only mutable fields — don't overwrite predictions or risk data
          await Case.updateOne({ caseNumber: mapped.caseNumber }, {
            $set: {
              currentStage: mapped.currentStage,
              status: mapped.status,
              numberOfHearings: mapped.numberOfHearings,
              numberOfAdjournments: mapped.numberOfAdjournments,
              lastHearingDate: mapped.lastHearingDate,
              nextHearingDate: mapped.nextHearingDate,
              judge: mapped.judge,
            },
          });
          totalUpdated += 1;
        } else {
          await Case.create(mapped);
          totalInserted += 1;
        }
      } catch (err) {
        logger.warn(`[eCourts] Skipped one record: ${err.message}`);
        totalErrors += 1;
      }
    }

    logger.info(`[eCourts] ${courtCode} page ${pageNo}: +${totalInserted} inserted, ~${totalUpdated} updated so far`);

    // Stop if the page returned fewer rows than PAGE_SIZE (last page)
    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      pageNo += 1;
    }
  }

  logger.info(`[eCourts] Done syncing ${courtCode}: inserted=${totalInserted}, updated=${totalUpdated}, errors=${totalErrors}`);
  return { courtCode, inserted: totalInserted, updated: totalUpdated, errors: totalErrors };
}

/**
 * Runs a full sync for all configured court complex codes.
 * Call this from the sync script or schedule it as a cron job.
 */
async function syncAll() {
  if (!ENABLED) {
    logger.warn('[eCourts] Sync is disabled. Set ECOURTS_SYNC_ENABLED=true and add your ECOURTS_API_KEY in .env');
    return { enabled: false };
  }
  if (!API_KEY) {
    logger.error('[eCourts] ECOURTS_API_KEY is not set. Sync aborted.');
    return { enabled: true, error: 'Missing API key' };
  }
  if (COURT_CODES.length === 0) {
    logger.error('[eCourts] ECOURTS_COURT_COMPLEX_CODES is empty. Add at least one court code in .env');
    return { enabled: true, error: 'No court codes configured' };
  }

  logger.info(`[eCourts] Starting full sync for courts: ${COURT_CODES.join(', ')}`);
  const results = [];
  for (const code of COURT_CODES) {
    const result = await syncCourt(code);
    results.push(result);
  }
  return { enabled: true, results };
}

module.exports = { syncAll, syncCourt, mapToCase, ENABLED };
