import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { SignInPage } from "./components/SignInPage";
import { MainDashboard } from "./components/MainDashboard";
import { AIChatboxPage } from "./components/AIChatboxPage";
import { LiveDashboardPage } from "./components/LiveDashboardPage";
import { AnomalyAlert, TestAlertTrigger, useAnomalyDetection } from "./components/AnomalyAlert";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AlertsContext } from "./alertsContext";

function AppContent() {
  // State lives here — useAnomalyDetection owns its own useState now,
  // so setAlerts is always the real setter, never a context no-op.
  const { alerts, setAlerts, clearAlerts } = useAnomalyDetection();

  return (
    // Provide the real setAlerts down to any child that needs it (e.g. Header bell)
    <AlertsContext.Provider value={{ alerts, setAlerts, clearAlerts }}>
      <Routes>
        <Route path="/" element={<SignInPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatbox"
          element={
            <ProtectedRoute>
              <AIChatboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/live-dashboard"
          element={
            <ProtectedRoute>
              <LiveDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {alerts.length > 0 && (
        <AnomalyAlert alerts={alerts} onClose={clearAlerts} />
      )}

      {/* Pass the real setAlerts as a prop — no context read inside TestAlertTrigger */}
      <TestAlertTrigger setAlerts={setAlerts} />

    </AlertsContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="size-full">
        <AppContent />
      </div>
    </BrowserRouter>
  );
}