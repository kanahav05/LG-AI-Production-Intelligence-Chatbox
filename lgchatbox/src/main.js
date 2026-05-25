import { fetchLive } from './api.js';
fetchLive().then(data => {
  console.log("Backend connected.");
  console.log("Lines:", data.rows.length);
  console.log("Summary:", data.summary);
  console.log("Alerts:", data.alerts);
}).catch(err => {
  console.error("Backend not reachable. Is FastAPI running on port 8000?", err);
});