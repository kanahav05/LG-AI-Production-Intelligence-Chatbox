import {
  getDatabaseSnapshot,
  getCurrentDateStr,
  getCurrentTimeStr
} from './db.js';

const snap = getDatabaseSnapshot(
  getCurrentDateStr(),
  getCurrentTimeStr()
);

console.log('Lines:', snap.rows.length);
console.log('Summary:', snap.summary);
console.log('Alerts:', snap.alerts);
console.log('R1 Prediction:', snap.predictions['R1']);

console.log('Lines found:', snap.rows.map(r => r.line));