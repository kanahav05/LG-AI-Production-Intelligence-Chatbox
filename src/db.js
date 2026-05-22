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
export function getCurrentTimeStr() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');  // zero-pad hours
  const mm = String(now.getMinutes()).padStart(2, '0'); // zero-pad minutes
  const ss = String(now.getSeconds()).padStart(2, '0'); // zero-pad seconds
  return `${hh}:${mm}:${ss}`;
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

  // Target increments per phase 
  const t1Inc = 0.20 * plan;
  const t2Inc = 0.40 * plan;
  const t3Inc = 0.25 * plan;
  const t4Inc = 0.15 * plan;

  // Result increments per phase  (target × achievement factor)
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
    const frac = (mins - p1Start) / (p1End - p1Start);
    target = frac * t1Inc;
    result = frac * r1Inc;
  } else if (mins <= p2End) {
    const frac = (mins - p1End) / (p2End - p1End);
    target = t1Inc + frac * t2Inc;
    result = r1Inc + frac * r2Inc;
  } else if (mins <= dtEnd) {
    // Downtime — values frozen at end of Phase 2
    target = t1Inc + t2Inc;
    result = r1Inc + r2Inc;
  } else if (mins <= p3End) {
    const frac = (mins - dtEnd) / (p3End - dtEnd);
    target = t1Inc + t2Inc + frac * t3Inc;
    result = r1Inc + r2Inc + frac * r3Inc;
  } else if (mins <= p4End) {
    const frac = (mins - p3End) / (p4End - p3End);
    target = t1Inc + t2Inc + t3Inc + frac * t4Inc;
    result = r1Inc + r2Inc + r3Inc + frac * r4Inc;
  } else {
    target = plan;
    result = r1Inc + r2Inc + r3Inc + r4Inc;
  }

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
  const mins     = timeStrToMinutes(timeStr);
  const dayStart = 9  * 60;
  const dayEnd   = 18 * 60; 

  // Active production minutes elapsed (excluding downtime 13:30-14:00)
  const downtimeStart = 13.5 * 60;
  const downtimeEnd   = 14   * 60;
  const downtimeDur   = downtimeEnd - downtimeStart; // 30 min

  let elapsed = Math.max(0, mins - dayStart);
  if (mins > downtimeEnd)   elapsed -= downtimeDur;
  else if (mins > downtimeStart) elapsed -= (mins - downtimeStart);

  const totalActive    = (dayEnd - dayStart) - downtimeDur; // 510 min
  let   remaining      = Math.max(0, totalActive - elapsed);

  const ratePerMinute  = elapsed > 0 ? result / elapsed : 0;
  const projectedResult = Math.round(result + ratePerMinute * remaining);
  const willMeetPlan   = projectedResult >= plan;
  const completionPct  = totalActive > 0 ? (elapsed / totalActive) * 100 : 0;
  const minutesRemaining = remaining;
  const unitsRemaining   = Math.max(0, plan - result);

  return {
    plan,
    result,
    projectedResult,
    willMeetPlan,
    completionPct: Math.round(completionPct * 10) / 10,
    ratePerMinute:  Math.round(ratePerMinute * 100) / 100,
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
      const prediction = getPrediction(line, dateStr, timeStr);
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

// Real-time update engine /

/**
 * Starts a 1-second interval that:
 *   1. Checks if current time is within 09:00–18:00
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