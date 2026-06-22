import html2canvas from "html2canvas";
import { getCurrentUser } from "./auth";

const BASE_URL = "http://localhost:8000";

async function captureScreenshot(): Promise<string | null> {
  try {
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 1,
    });
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    return null;
  }
}

export async function reportClientError(
  errorCode: string,
  message: string,
  extra: {
    page?: string;
    query?: string;
    responseCode?: string;
  } = {}
): Promise<void> {
  try {
    const user = getCurrentUser();
    const screenshot = await captureScreenshot();
    
    const payload = {
      error_code: errorCode,
      message: message,
      user_id: user?.id ?? null,
      user_name: user?.name ?? null,
      user_role: user?.role ?? null,
      page: extra.page ?? window.location.pathname,
      query: extra.query ?? null,
      response_code: extra.responseCode ?? null,
      screenshot: screenshot,
    };

    await fetch(`${BASE_URL}/api/errors/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Ignore reporting failures to prevent infinite recursion
    console.error("Error reporting failed:", error);
  }
}

export async function checkAndReportInvalidLine(
  text: string,
  pagePath: string = "/chatbox"
): Promise<void> {
  const KNOWN_LINES = new Set([
    "R1", "R2", "PCB01", "PCB03", "W1", "W2", "PCB04", "CM1", "CM2", "A1", "A4", "PCB02", "WP1"
  ]);
  const matches = text.match(/\b([a-zA-Z]+\d+)\b/g);
  if (matches) {
    for (const m of matches) {
      const uppercased = m.toUpperCase();
      if (/^(R|PCB|W|CM|A|WP)\d+$/i.test(uppercased)) {
        if (!KNOWN_LINES.has(uppercased)) {
          await reportClientError("WARN_001", `Invalid line code entered: ${m}`, {
            query: text,
            page: pagePath,
          });
        }
      }
    }
  }
}
