import { createContext } from "react";

export interface AlertData {
  line: string;
  product: string;
  achieve: number;
  reason?: string;
  type?: string;
  detectedAt?: Date;
}

export interface AlertsContextType {
  alerts: AlertData[];
  clearAlerts: () => void;
}

export const AlertsContext = createContext<AlertsContextType>({
  alerts: [],
  clearAlerts: () => {},
});
