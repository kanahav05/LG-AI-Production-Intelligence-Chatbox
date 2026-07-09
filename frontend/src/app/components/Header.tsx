import { useState, useEffect, useContext, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, User, LogOut, LayoutDashboard, MessageSquare, Activity, Menu, X, ChevronRight } from 'lucide-react'
import { signOut } from '../../auth'
import { AlertsContext } from '../alertsContext'
const lgLogo = '/assets/LG_symbol.svg'

interface Alert {
  line: string
  product: string
  achieve: number
  reason?: string
}

interface HeaderProps {
  alerts?: Alert[]
}

const SHIFT_SCHEDULE = [
  { name: 'Early Morning Shift', start: 9 * 60,     end: 10.5 * 60 },
  { name: 'Peak Day Shift',      start: 10.5 * 60,  end: 13.5 * 60 },
  { name: 'Downtime',            start: 13.5 * 60,  end: 14 * 60   },
  { name: 'Afternoon Shift',     start: 14 * 60,    end: 16 * 60   },
  { name: 'Evening Shift',       start: 16 * 60,    end: 18 * 60   },
]

function getCurrentShift(): string {
  const now  = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  const shift = SHIFT_SCHEDULE.find(s => mins >= s.start && mins < s.end)
  return shift ? shift.name : 'Outside Production Hours'
}

/** Severity color for an alert based on achieve % */
function getAlertColor(achieve: number): string {
  if (achieve < 50) return '#DC2626'   // error-red
  if (achieve < 80) return '#D97706'   // warning-yellow
  return '#16A34A'                     // success-green
}

export function Header({ alerts }: HeaderProps) {
  const { alerts: contextAlerts } = useContext(AlertsContext)
  const activeAlerts = alerts && alerts.length > 0 ? alerts : contextAlerts

  const [time, setTime]             = useState(new Date())
  const [showUser, setShowUser]     = useState(false)
  const [showBell, setShowBell]     = useState(false)
  const [showMobile, setShowMobile] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  // Refs for click-outside detection
  const bellRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Click-outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBell(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUser(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const user = JSON.parse(localStorage.getItem('lg-user') || '{"name":"User"}')

  function handleSignOut() {
    signOut()
    navigate('/', { replace: true })
  }

  const navLinks = [
    { label: 'Dashboard',      path: '/dashboard',      icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'AI Chatbox',     path: '/chatbox',        icon: <MessageSquare className="w-4 h-4" /> },
    { label: 'Live Dashboard', path: '/live-dashboard', icon: <Activity className="w-4 h-4" /> },
  ]

  const formattedDate = time.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  })
  const formattedTime = time.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  const alertTimestamp = time.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">

        {/* Left — Logo + Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
                 style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>
              <img src={lgLogo} alt="LG Electronics" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">
                LG Electronics
              </p>
              <p className="text-xs text-gray-400 leading-none">
                Production Intelligence
              </p>
            </div>
          </div>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === link.path
                    ? 'text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={location.pathname === link.path
                  ? { background: 'var(--lg-red)' }
                  : {}
                }
              >
                {link.icon}
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Center — Shift + Date/Time */}
        <div className="hidden lg:flex flex-col items-center">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white mb-0.5"
                style={{ background: "#A50034"  }}>
            {getCurrentShift()}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formattedDate} · {formattedTime}
          </span>
        </div>

        {/* Right — Actions */}
        <div className="flex items-center gap-2">

          {/* Mobile hamburger button */}
          <button
            onClick={() => setShowMobile(!showMobile)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Toggle mobile menu"
          >
            {showMobile ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => { setShowBell(!showBell); setShowUser(false) }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Bell className="w-4 h-4" />
              {activeAlerts.length > 0 && (
                <span
                  className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ${
                    activeAlerts.length > 0 ? 'animate-pulseRing' : ''
                  }`}
                />
              )}
            </button>

            {showBell && (
              <div className="animate-fadeInUp absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Alerts {activeAlerts.length > 0 && `(${activeAlerts.length})`}
                  </p>
                  {activeAlerts.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                          style={{ background: 'var(--lg-red)' }}>
                      Live
                    </span>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {activeAlerts.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-6 text-center">No active alerts</p>
                  ) : activeAlerts.map((a, i) => (
                    <div key={i} className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-start gap-2.5">
                        {/* Colored severity dot */}
                        <span
                          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: getAlertColor(a.achieve) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            Line {a.line} — Anomaly
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {a.reason || `${a.product} · Achieve: ${a.achieve.toFixed(1)}%`}
                          </p>
                          <p className="text-xs text-gray-300 dark:text-gray-500 mt-1">
                            {alertTimestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* View All button */}
                <button
                  onClick={() => { setShowBell(false); navigate('/live-dashboard') }}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{ color: 'var(--lg-red)' }}
                >
                  View All
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* User */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => { setShowUser(!showUser); setShowBell(false) }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                   style={{ background: 'var(--lg-red)' }}>
                {user.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                {user.name}
              </span>
            </button>

            {showUser && (
              <div className="animate-fadeInUp absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{user.id}</p>
                  {/* Role badge */}
                  <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
                        style={{
                          color: 'var(--lg-red)',
                          borderColor: 'var(--lg-red)',
                          background: 'var(--accent)'
                        }}>
                    {user.role || 'Operator'}
                  </span>
                </div>
                {/* Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-600 to-transparent" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition rounded-b-xl"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {showMobile && (
        <div className="animate-fadeInUp md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <nav className="flex flex-col gap-1">
            {navLinks.map(link => (
              <button
                key={link.path}
                onClick={() => { navigate(link.path); setShowMobile(false) }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === link.path
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={location.pathname === link.path
                  ? { background: 'var(--lg-red)' }
                  : {}
                }
              >
                {link.icon}
                {link.label}
              </button>
            ))}
          </nav>
          {/* Shift info for mobile */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ background: '#A50034' }}>
              {getCurrentShift()}
            </span>
            <span className="text-xs text-gray-400">
              {formattedDate} · {formattedTime}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}