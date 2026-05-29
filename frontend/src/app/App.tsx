import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { SignInPage } from "./components/SignInPage";
import { MainDashboard } from "./components/MainDashboard";
import { AIChatboxPage } from "./components/AIChatboxPage";
import { LiveDashboardPage } from "./components/LiveDashboardPage";
import { AnomalyAlert, useAnomalyDetection } from "./components/AnomalyAlert";
import { ProtectedRoute } from "./components/ProtectedRoute";

function AppContent() {
  const { alerts, clearAlerts } = useAnomalyDetection();

  return (
    <>
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
    </>
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