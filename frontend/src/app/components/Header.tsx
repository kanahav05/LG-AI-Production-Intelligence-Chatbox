import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, User, LogOut, LayoutDashboard, MessageSquare, Activity } from 'lucide-react'

interface Alert {
  line: string
  product: string
  achieve: number
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

export function Header({ alerts = [] }: HeaderProps) {
  const [time, setTime]       = useState(new Date())
  const [showUser, setShowUser] = useState(false)
  const [showBell, setShowBell] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])


  const user = JSON.parse(localStorage.getItem('lg-user') || '{"name":"User"}')

  function handleSignOut() {
    localStorage.removeItem('lg-auth')
    localStorage.removeItem('lg-user')
    navigate('/')
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

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">

        {/* Left — Logo + Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                 style={{ background: 'var(--lg-red)' }}>
              LG
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

          {/* Nav links */}
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


          {/* Bell */}
          <div className="relative">
            <button
              onClick={() => { setShowBell(!showBell); setShowUser(false) }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>

            {showBell && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Alerts {alerts.length > 0 && `(${alerts.length})`}
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <p className="text-sm text-gray-400 px-4 py-3">No active alerts</p>
                  ) : alerts.map((a, i) => (
                    <div key={i} className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
                      <p className="text-sm font-medium text-red-600">
                        Line {a.line} — Below Threshold
                      </p>
                      <p className="text-xs text-gray-400">
                        {a.product} · Achieve: {a.achieve.toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User */}
          <div className="relative">
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
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.id}</p>
                </div>
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
    </header>
  )
}