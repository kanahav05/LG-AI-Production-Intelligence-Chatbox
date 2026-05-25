// Seed-based deterministic random number generator
function seedRandom(seedString) {
  let h = 1779033703 ^ seedString.length; //XORING with string length to vary initial state
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353); // mixes the character into the hash
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507); // more mixing
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Products and Lines definition
export const PRODUCTS = {
  REF: {
    id: 'REF',
    name: 'Refrigerator',
    lines: ['R1', 'R2', 'PCB01', 'PCB03'],
    basePlans: { R1: 800, R2: 700, PCB01: 1500, PCB03: 1500 }
  },
  WMC: {
    id: 'WMC',
    name: 'Washing Machine',
    lines: ['W1', 'W2', 'PCB04'],
    basePlans: { W1: 500, W2: 450, PCB04: 1200 }
  },
  COMP: {
    id: 'COMP',
    name: 'Compressor',
    lines: ['CM1', 'CM2'],
    basePlans: { CM1: 1000, CM2: 900 }
  },
  RAC: {
    id: 'RAC',
    name: 'Residential Air Conditioner',
    lines: ['A1', 'A4', 'PCB02'],
    basePlans: { A1: 600, A4: 600, PCB02: 1400 }
  },
  A08: {
    id: 'A08',
    name: 'Water Purifier',
    lines: ['WP1'],
    basePlans: { WP1: 400 }
  }
};

// Line mapping helper
export const LINE_TO_PRODUCT = {};
for (const [prodId, prodData] of Object.entries(PRODUCTS)) {
  for (const line of prodData.lines) {
    LINE_TO_PRODUCT[line] = { prodId, name: prodData.name }; // e.g. LINE_TO_PRODUCT['R1'] = { prodId: 'REF', name: 'Refrigerator' }
  }
}

// Phases definition
export const PHASES = [
  { id: 1, name: 'Early Morning Shift', start: '09:00', end: '10:30', targetPct: 0.20, activeHours: 1.5 },
  { id: 2, name: 'Peak Day Shift',      start: '10:30', end: '13:30', targetPct: 0.40, activeHours: 3.0 },
  { id: 0, name: 'Downtime',            start: '13:30', end: '14:00', targetPct: 0.00, activeHours: 0.5, isDowntime: true },
  { id: 3, name: 'Afternoon Shift',     start: '14:00', end: '16:00', targetPct: 0.25, activeHours: 2.0 },
  { id: 4, name: 'Evening Shift',       start: '16:00', end: '18:00', targetPct: 0.15, activeHours: 2.0 }
];

// Performance threshold — lines below this are flagged
export const ACHIEVE_THRESHOLD = 80;

// Helper: HH:MM string -> minutes since midnight . Used for phase boundary checks and per-phase calculations
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// Helper: current time as HH:MM:SS string
export function getCurrentDateStr() {
  const options = { 
    timeZone: 'Asia/Kolkata', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  };
  // 'en-CA' locale produces the YYYY-MM-DD format
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
}

// Helper: current date as YYYY-MM-DD string
export function getCurrentDateStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Helper: minutes since midnight from a full HH:MM:SS string . Allows per-second precision for interpolation in getLineMetricsAt()
function timeStrToMinutes(timeStr) {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
}

// Check which phase is active at a given time string (HH:MM or HH:MM:SS)
export function getPhaseAtTime(timeStr) {
  const mins = timeStrToMinutes(timeStr);
  const startDay = 9 * 60;
  const endDay   = 18 * 60;

  if (mins < startDay) return { id: -1, name: 'Before Shift', isBefore: true };
  if (mins >= endDay)  return { id: -2, name: 'After Shift',  isAfter:  true  };

  for (const phase of PHASES) {
    const sMins = timeToMinutes(phase.start);
    const eMins = timeToMinutes(phase.end);
    if (mins >= sMins && mins < eMins) return phase;
  }
  return null;
}

// Check whether the current time is within the active production window
export function isProductionActive(timeStr) {
  const mins = timeStrToMinutes(timeStr);
  return mins >= 9 * 60 && mins < 18 * 60;
}

// Uploaded dataset override ////

let uploadedDataset = null;

export function setUploadedDataset(data) { uploadedDataset = data; }
export function getUploadedDataset()     { return uploadedDataset; }

// Core metrics calculation //

export function getLineMetricsAt(line, dateStr, timeStr) {
  // Uploaded data takes priority
  if (uploadedDataset) {
    const hhmm = timeStr.slice(0, 5); // normalise HH:MM:SS - HH:MM for lookup since uploaded data is per-minute
    const entry = uploadedDataset.find(
      e => e.line.toUpperCase() === line.toUpperCase() &&
           e.date === dateStr &&
           e.time === hhmm
    );
    if (entry) {
      const plan    = Number(entry.plan);
      const target  = Number(entry.target);
      const result  = Number(entry.result);
      const achieve = target > 0 ? (result / target) * 100 : 0;
      return { plan, target, result, achieve };
    }
  }

  const rand = seedRandom(`${dateStr}-${line}`); // deterministic random seeded by date+line for consistent results across calls

  const prodInfo = LINE_TO_PRODUCT[line];
  if (!prodInfo) return null;
  const basePlan = PRODUCTS[prodInfo.prodId].basePlans[line];

  // Daily plan ±5% variation seeded by date+line
  const plan = Math.round(basePlan * (0.95 + rand() * 0.10)); // e.g. if basePlan is 1000, plan will be between 950 and 1050

  // Per-phase achievement factors seeded deterministically
  const achFactors = {
    1: 0.90 + rand() * 0.12,
    2: 0.92 + rand() * 0.10,
    3: 0.86 + rand() * 0.14,
    4: 0.88 + rand() * 0.12
  };

  // Phase boundary constants (minutes since midnight)
  const p1Start = 9    * 60;
  const p1End   = 10.5 * 60;
  const p2End   = 13.5 * 60;
  const dtEnd   = 14   * 60;
  const p3End   = 16   * 60;
  const p4End   = 18   * 60;

  // Target increments per phase (sum = plan)
  const t1Inc = 0.20 * plan;
  const t2Inc = 0.40 * plan;
  const t3Inc = 0.25 * plan;
  const t4Inc = 0.15 * plan;

  // Result increments per phase (target x achievement factor)
  const r1Inc = t1Inc * achFactors[1];
  const r2Inc = t2Inc * achFactors[2];
  const r3Inc = t3Inc * achFactors[3];
  const r4Inc = t4Inc * achFactors[4];

  // Use fractional minutes so per-second updates interpolate smoothly
  const mins = timeStrToMinutes(timeStr);

  let target = 0;
  let result = 0;

  if (mins <= p1Start) {
    return { plan, target: 0, result: 0, achieve: 0 };
  } else if (mins <= p1End) {
    // In Phase 1 - interpolate between 0 and full Phase 1 increment
    const frac = (mins - p1Start) / (p1End - p1Start);
    target = frac * t1Inc;
    result = frac * r1Inc;
  } else if (mins <= p2End) {
    // In Phase 2 - add Phase 1 totals + interpolated Phase 2
    const frac = (mins - p1End) / (p2End - p1End);
    target = t1Inc + frac * t2Inc;
    result = r1Inc + frac * r2Inc;
  } else if (mins <= dtEnd) {
    // Downtime — values frozen at end of Phase 2, no production
    target = t1Inc + t2Inc;
    result = r1Inc + r2Inc;
  } else if (mins <= p3End) {
    // In Phase 3 - add Phase 1+2 totals + interpolated Phase 3
    const frac = (mins - dtEnd) / (p3End - dtEnd);
    target = t1Inc + t2Inc + frac * t3Inc;
    result = r1Inc + r2Inc + frac * r3Inc;
  } else if (mins <= p4End) {
    // In Phase 4 - add Phase 1+2+3 totals + interpolated Phase 4
    const frac = (mins - p3End) / (p4End - p3End);
    target = t1Inc + t2Inc + t3Inc + frac * t4Inc;
    result = r1Inc + r2Inc + r3Inc + frac * r4Inc;
  } else {
    // After 18:00 - full day values
    target = plan;
    result = r1Inc + r2Inc + r3Inc + r4Inc;
  }

  // Round metrics to clean integer values
  target  = Math.round(target);
  result  = Math.round(result);
  const achieve = target > 0 ? (result / target) * 100 : 0;

  return { plan, target, result, achieve };
}

// Get non-cumulative performance for a single completed phase
export function getLinePhasePerformance(line, dateStr, phaseId) {
  const rand = seedRandom(`${dateStr}-${line}`);

  const prodInfo = LINE_TO_PRODUCT[line];
  if (!prodInfo) return null;
  const basePlan = PRODUCTS[prodInfo.prodId].basePlans[line];
  const plan = Math.round(basePlan * (0.95 + rand() * 0.10));

  const achFactors = {
    1: 0.90 + rand() * 0.12,
    2: 0.92 + rand() * 0.10,
    3: 0.86 + rand() * 0.14,
    4: 0.88 + rand() * 0.12
  };

  if (phaseId === 0 || phaseId === 'downtime') {
    return { name: 'Downtime', plan: 0, target: 0, result: 0, achieve: 0 };
  }

  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase) return null;

  const target  = Math.round(phase.targetPct * plan);
  const result  = Math.round(target * achFactors[phaseId]);
  const achieve = target > 0 ? (result / target) * 100 : 0;

  return { name: phase.name, plan, target, result, achieve };
}

// Predictive analytics //

/**
 * Calculation done are :
 *   - projectedResult   : estimated end-of-day result at current rate
 *   - willMeetPlan      : boolean
 *   - completionPct     : how much of the day's active window has elapsed
 *   - ratePerMinute     : current production rate (units / minute)
 *   - unitsRemaining    : plan - result so far
 *   - minutesRemaining  : active minutes left before 18:00
 */
export function getPrediction(line, dateStr, timeStr) {
  const metrics = getLineMetricsAt(line, dateStr, timeStr);
  if (!metrics) return null;

  const { plan, result } = metrics;
  const mins          = timeStrToMinutes(timeStr);
  const dayStart      = 9  * 60;
  const dayEnd        = 18 * 60;

  // Active production minutes elapsed (excluding downtime 13:30-14:00)
  const downtimeStart = 13.5 * 60;
  const downtimeEnd   = 14   * 60;
  const downtimeDur   = downtimeEnd - downtimeStart; // 30 min

  let elapsed = Math.max(0, mins - dayStart);
  if (mins > downtimeEnd)        elapsed -= downtimeDur;
  else if (mins > downtimeStart) elapsed -= (mins - downtimeStart);

  const totalActive     = (dayEnd - dayStart) - downtimeDur; // 510 active minutes in a full day
  let   remaining       = Math.max(0, totalActive - elapsed);

  const ratePerMinute   = elapsed > 0 ? result / elapsed : 0;
  const projectedResult = Math.round(result + ratePerMinute * remaining);
  const willMeetPlan    = projectedResult >= plan;
  const completionPct   = totalActive > 0 ? (elapsed / totalActive) * 100 : 0;
  const minutesRemaining = remaining;
  const unitsRemaining   = Math.max(0, plan - result);

  return {
    plan,
    result,
    projectedResult,
    willMeetPlan,
    completionPct:    Math.round(completionPct * 10) / 10,
    ratePerMinute:    Math.round(ratePerMinute * 100) / 100,
    unitsRemaining,
    minutesRemaining: Math.round(minutesRemaining)
  };
}

// Full database snapshot (all lines + summary row) //

export function getDatabaseSnapshot(dateStr, timeStr) {
  const rows        = [];
  let totalPlan     = 0;
  let totalTarget   = 0;
  let totalResult   = 0;
  const alerts      = [];   // lines currently below threshold
  const predictions = {};   // line -> prediction object

  for (const [prodId, prodData] of Object.entries(PRODUCTS)) {
    for (const line of prodData.lines) {
      const metrics = getLineMetricsAt(line, dateStr, timeStr);
      if (!metrics) continue;

      const { plan, target, result, achieve } = metrics;

      // Performance threshold alert
      const isBelowThreshold = target > 0 && achieve < ACHIEVE_THRESHOLD;
      if (isBelowThreshold) {
        alerts.push({ line, product: prodId, achieve: Math.round(achieve * 10) / 10 });
      }

      // Predictive analytics
      const prediction  = getPrediction(line, dateStr, timeStr);
      predictions[line] = prediction;

      rows.push({
        date:         dateStr,
        time:         timeStr,
        product:      prodId,
        productName:  prodData.name,
        line,
        plan,
        target,
        result,
        achieve,
        belowThreshold: isBelowThreshold,
        prediction
      });

      totalPlan   += plan;
      totalTarget += target;
      totalResult += result;
    }
  }

  const avgAchieve = totalTarget > 0 ? (totalResult / totalTarget) * 100 : 0;

  // Summary row (last row of dataset)
  const summary = {
    date:    dateStr,
    time:    timeStr,
    product: 'ALL',
    line:    'TOTAL',
    plan:    totalPlan,
    target:  totalTarget,
    result:  totalResult,
    achieve: avgAchieve   // average achieve % across all lines
  };

  return { rows, summary, alerts, predictions };
}

// Real-time update engine //

/**
 * Starts a 1-second interval that:
 *   1. Checks if current time is within 09:00-18:00
 *   2. Builds a full getDatabaseSnapshot for right now
 *   3. Calls onUpdate(snapshot) with the fresh data
 *   4. Calls onAlert(alerts) if any line is below threshold
 *   5. Stops automatically after 18:00
 *
 * Returns a stop() function so the caller can cancel early.
 *
 * Usage:
 *   const stop = startRealtimeEngine({
 *     onUpdate : (snapshot) => { renderDashboard(snapshot) },
 *     onAlert  : (alerts)   => { showAlertOverlay(alerts)  }
 *   });
 */
export function startRealtimeEngine({ onUpdate, onAlert } = {}) {
  let intervalId = null;

  function tick() {
    const dateStr = getCurrentDateStr();
    const timeStr = getCurrentTimeStr();

    if (!isProductionActive(timeStr)) {
      // Outside 09:00-18:00 — stop the engine
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    // Full snapshot: rows + summary + alerts + predictions
    const snapshot = getDatabaseSnapshot(dateStr, timeStr);

    // Fire update callback
    if (typeof onUpdate === 'function') {
      onUpdate(snapshot);
    }

    // Fire alert callback only when there are active threshold breaches
    if (typeof onAlert === 'function' && snapshot.alerts.length > 0) {
      onAlert(snapshot.alerts);
    }
  }

  // Run immediately, then every second
  tick();
  intervalId = setInterval(tick, 1000);

  // Return a stop handle
  return function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

// RAG
// RAG Pipeline split across files:
//   db.js      - Step 1: formatRowAsText     (data formatting)
//              - Step 2: extractQueryParams   (query understanding)
//              - Step 3: retrieveRelevantRows (lightweight retrieval)
//   rag.js     - Step 4: generateEmbeddings  (vector creation) 
//              - Step 5: similaritySearch     (vector search)     
//   chatbox.js - Step 6: API call     (response generation)
// 

/**
 * RAG STEP 1 — DATA FORMATTING
 * Converts a single database row into a readable plain-text chunk.
 * This text is what gets embedded into a vector. 
 * Keeping it human-readable means engine can also read it directly
 * as context without any further transformation.
 */


export function formatRowAsText(row) {
  const performanceGap = row.target - row.result;
  const gapText = performanceGap > 0 
    ? `Behind target by ${performanceGap} units.` 
    : `Exceeding target by ${Math.abs(performanceGap)} units.`;

  return (
    `Line ${row.line} (${row.productName}) | Time: ${row.time}\n` +
    `Status: ${status} | Achievement: ${achieve}% | ${gapText}\n` +
    `Plan: ${row.plan} | Target: ${row.target} | Result: ${row.result}`
  );
}

/**
 * RAG STEP 2 — QUERY PARAMETER EXTRACTION
 * Reads a raw user query string and extracts structured parameters.
 * This tells the retrieval layer exactly what to look for in the database.
 * this output also gets passed to engine so it understands
 * what the user is asking before generating a response.
 *
 * Handles:
 *   - Line codes    : R1, CM1, WP1, PCB01 etc.
 *   - Product codes : REF, WMC, COMP, RAC, A08
 *   - Dates         : today, yesterday, day before yesterday, DD Month YYYY
 *   - Times         : 3:00 pm, 10:30 am, right now, current
 *   - Shifts        : early morning, peak day, afternoon, evening
 *   - Intents       : result, target, plan, achieve, status, prediction, rate
 *
 * Example:
 *   extractQueryParams("What was the result of CM1 yesterday at 3pm?")
 *   - {
 *       lines:        ['CM1'],
 *       products:     ['COMP'],
 *       date:         '2026-05-20',   // resolved from 'yesterday'
 *       time:         '15:00',        // resolved from '3pm'
 *       shift:        null,
 *       intent:       'result',
 *       isCurrentTime: false,
 *       isPredictive:  false,
 *       rawQuery:     "What was the result of CM1 yesterday at 3pm?"
 *     }
 */
export function extractQueryParams(queryStr) {
  const q     = queryStr.toLowerCase();
  const today = new Date();

  // Date resolution 
  let resolvedDate = getCurrentDateStr(); // default: today

  if (q.includes('day before yesterday')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    resolvedDate = d.toISOString().split('T')[0];
  } else if (q.includes('yesterday')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    resolvedDate = d.toISOString().split('T')[0];
  } else {
    // Match "19th May 2026" or "19 May 2026"
    const monthNames = [
      'january','february','march','april','may','june',
      'july','august','september','october','november','december'
    ];
    const explicitMatch = q.match(
      /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/
    ); //capture day, month name, year 
    if (explicitMatch) {
      const day   = explicitMatch[1].padStart(2, '0');
      const month = String(monthNames.indexOf(explicitMatch[2]) + 1).padStart(2, '0');
      const year  = explicitMatch[3];
      resolvedDate = `${year}-${month}-${day}`;
    }
    // Match ISO format "2026-05-19"
    const isoMatch = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoMatch) resolvedDate = isoMatch[1];
  }

  // Time resolution
  let resolvedTime  = null;
  let isCurrentTime = false;

  // Keywords that mean "right now"
  const timeKeywords = ['right now', 'current', 'currently', 'now', 'latest', 'live'];
  if (timeKeywords.some(k => q.includes(k))) {
    resolvedTime  = getCurrentTimeStr().slice(0, 5); // HH:MM
    isCurrentTime = true;
  } else {
    // Match "3:00 pm", "10:30am", "3 pm", "15:00"
    const timeMatch = q.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      let hour   = parseInt(timeMatch[1]);
      const min  = timeMatch[2] ? timeMatch[2] : '00';
      const ampm = timeMatch[3];
      if (ampm === 'pm' && hour < 12) hour += 12; // convert 12-hour to 24-hour
      if (ampm === 'am' && hour === 12) hour = 0;
      // Only accept times within production window 09:00-18:00
      if (hour >= 9 && hour <= 18) {
        resolvedTime = `${String(hour).padStart(2, '0')}:${min}`;
      }
    }
    // If no time found, default to current time
    if (!resolvedTime) {
      resolvedTime  = getCurrentTimeStr().slice(0, 5);
      isCurrentTime = true;
    }
  }

  // Shift resolution
  let resolvedShift = null;

  if      (q.includes('early morning'))                      resolvedShift = PHASES.find(p => p.id === 1);
  else if (q.includes('peak day') || q.includes('peak'))     resolvedShift = PHASES.find(p => p.id === 2);
  else if (q.includes('afternoon'))                          resolvedShift = PHASES.find(p => p.id === 3);
  else if (q.includes('evening'))                            resolvedShift = PHASES.find(p => p.id === 4);
  else if (q.includes('downtime'))                           resolvedShift = PHASES.find(p => p.id === 0);

  // Line extraction 

  const allLines   = Object.keys(LINE_TO_PRODUCT);
  const foundLines = allLines.filter(line =>
    new RegExp(`\\b${line.toLowerCase()}\\b`).test(q)
  );

  // Product extraction
  const productKeywords = {
    REF:  ['ref', 'refrigerator', 'fridge'],
    WMC:  ['wmc', 'washing machine', 'washer'],
    COMP: ['comp', 'compressor'],
    RAC:  ['rac', 'air conditioner', 'ac', 'residential ac'],
    A08:  ['a08', 'water purifier', 'purifier']
  };

  const foundProducts = [];
  for (const [prodId, keywords] of Object.entries(productKeywords)) {
    if (keywords.some(kw => q.includes(kw))) {
      foundProducts.push(prodId);
      // If product mentioned but no specific line, add all lines for that product
      if (foundLines.length === 0) {
        PRODUCTS[prodId].lines.forEach(l => {
          if (!foundLines.includes(l)) foundLines.push(l);
        });
      }
    }
  }

  // Intent extraction 
  // Determines what type of information the user is asking for
  let intent = 'status'; // default intent

  if      (q.includes('predict') || q.includes('will') || q.includes('meet') || q.includes('on track'))
    intent = 'prediction';
  else if (q.includes('achieve') || q.includes('achievement') || q.includes('%'))
    intent = 'achieve';
  else if (q.includes('result') || q.includes('actual') || q.includes('produced'))
    intent = 'result';
  else if (q.includes('target'))
    intent = 'target';
  else if (q.includes('plan'))
    intent = 'plan';
  else if (q.includes('rate') || q.includes('speed') || q.includes('per minute') || q.includes('per hour'))
    intent = 'rate';
  else if (q.includes('alert') || q.includes('below') || q.includes('threshold') || q.includes('underperform'))
    intent = 'alerts';
  else if (q.includes('summary') || q.includes('total') || q.includes('overall'))
    intent = 'summary';

  const isPredictive = intent === 'prediction';

  return {
    lines:        foundLines,
    products:     foundProducts,
    date:         resolvedDate,
    time:         resolvedTime,
    shift:        resolvedShift,
    intent,
    isCurrentTime,
    isPredictive,
    rawQuery:     queryStr
  };
}

/**
 * RAG STEP 3 — LIGHTWEIGHT RETRIEVAL
 * Uses the extracted parameters to filter the database snapshot
 * and return only the rows relevant to the user's query.
 * Returns both the raw row objects AND their formatted text chunks
 * so the API call can use them directly as context.
 *
 * For live queries  - filters the current snapshot in memory (fast, no embedding needed)
 * For past queries  - filters a historical snapshot generated for that date/time
 *
 * Example output:
 * {
 *   rows:       [ ...matched row objects ],
 *   textChunks: [ "Line CM1 (Compressor) | Date: 2026-05-21 ...", ... ],
 *   context:    "single joined string ready for API",
 *   params:     { ...the extractQueryParams output },
 *   summary:    { ...factory totals if intent is 'summary' },
 *   alerts:     [ ...lines currently below threshold ]
 * }
 */
export function retrieveRelevantRows(queryStr) {
  const params = extractQueryParams(queryStr);
  const { lines, date, time, shift, intent } = params;

  // Get the snapshot for the resolved date and time
  const snapshot = getDatabaseSnapshot(date, time);

  let matchedRows = snapshot.rows;

  // Filter by line if specific lines were mentioned in the query
  if (lines.length > 0) {
    matchedRows = matchedRows.filter(row => lines.includes(row.line));
  }

  // Filter by shift if a shift was mentioned
  if (shift) {
    // If the resolved time is outside the shift window, use the shift end time
    const shiftStart   = timeToMinutes(shift.start);
    const shiftEnd     = timeToMinutes(shift.end);
    const rowMins      = timeToMinutes(time.slice(0, 5));
    const effectiveTime = (rowMins >= shiftStart && rowMins <= shiftEnd)
      ? time
      : shift.end;
    matchedRows = getDatabaseSnapshot(date, effectiveTime).rows;
    // Re-apply line filter after shift adjustment
    if (lines.length > 0) {
      matchedRows = matchedRows.filter(row => lines.includes(row.line));
    }
  }

  // If intent is alerts, only return lines currently below threshold
  if (intent === 'alerts') {
    matchedRows = snapshot.rows.filter(row => row.belowThreshold);
  }

  // If intent is summary, return all lines for factory-wide totals
  if (intent === 'summary') {
    matchedRows = snapshot.rows;
  }

  // Convert each matched row to a formatted text chunk for embedding / Claude context
  const textChunks = matchedRows.map(formatRowAsText);

  // Build the summary line to append at the end of the context
  const summaryLine =
    `Factory Total | Date: ${snapshot.summary.date} | Time: ${snapshot.summary.time}\n` +
    `Total Plan: ${snapshot.summary.plan} | ` +
    `Total Target: ${snapshot.summary.target} | ` +
    `Total Result: ${snapshot.summary.result} | ` +
    `Avg Achieve: ${snapshot.summary.achieve.toFixed(1)}%`;

  // Join all chunks into one context string — ready to paste into API call
  const context = [
    '--- RETRIEVED PRODUCTION DATA ---',
    ...textChunks,
    '--- FACTORY SUMMARY ---',
    summaryLine,
    '---------------------------------'
  ].join('\n\n');

  return {
    rows:       matchedRows,
    textChunks,
    context,           // pass this directly as the data context
    params,            // pass this so the engine knows what was asked
    summary:    snapshot.summary,
    alerts:     snapshot.alerts
  };
}