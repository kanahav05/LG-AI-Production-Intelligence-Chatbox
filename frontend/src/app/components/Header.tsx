import { useEffect, useState } from "react";
import { Bell, User, Moon, Sun } from "lucide-react";

interface HeaderProps {
  title: string;
  showShift?: boolean;
  currentShift?: string;
}

export function Header({ title, showShift, currentShift }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasNotification, setHasNotification] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--lg-red)" }}
          >
            <span className="text-xl font-bold text-white">LG</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            {showShift && currentShift && (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ background: "var(--gradient-warm)" }}
                >
                  {currentShift}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium text-foreground">
              {formatDate(currentTime)}
            </div>
            <div className="text-lg font-bold text-foreground">
              {formatTime(currentTime)}
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-foreground" />
            ) : (
              <Moon className="w-5 h-5 text-foreground" />
            )}
          </button>

          <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            {hasNotification && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          <button className="p-2 rounded-lg hover:bg-accent transition-colors">
            <User className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}
