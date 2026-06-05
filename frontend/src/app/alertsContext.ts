import { createContext } from "react";

export interface AlertData {
  line: string;
  product: string;
  achieve: number;
  reason:string;
  detectedAt: Date;
}

export interface AlertsContextType {
  alerts: AlertData[];
  setAlerts: (alerts: AlertData[]) => void; // Add this line
  clearAlerts: () => void;
}

// Update the default value to include a no-op function for setAlerts
export const AlertsContext = createContext<AlertsContextType>({
  alerts: [],
  setAlerts: () => {}, 
  clearAlerts: () => {},
});