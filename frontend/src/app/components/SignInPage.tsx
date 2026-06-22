import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../../auth'

export function SignInPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const navigate = useNavigate()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn(employeeId, password)
    if (result.success) {
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.error ?? 'Invalid Employee ID or Password.')
      setLoading(false)
    }
  }

  return (
  <div className=" min-h-screen flex items-center justify-center relative overflow-hidden px-6 "
  style={{ background: "linear-gradient(180deg,#F8F6F2 0%,#F3EFE8 100%)", }}
  >
    {/* Soft ambient */}
    <div className=" absolute top-[-180px] left-[-180px] w-[600px] h-[600px] rounded-full blur-[140px] opacity-30"
    style={{ background: "radial-gradient(circle,#F7D9E5,transparent 70%)", }}
  />
  <div className=" absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20 "
    style={{ background: "radial-gradient(circle,#F0E6DE,transparent 70%)",}}
  />
  <div className="w-full max-w-md animate-fadeInUp">
    {/* Branding */}
    <div className="text-center mb-8">
      <div className=" mx-auto w-[78px] h-[78px] rounded-[22px] flex items-center justify-center shadow-md "
        style={{ background: "var(--gradient-primary)"}}
      >
        <span className="text-white text-2xl font-bold">
          LG
        </span>
      </div>

      <h1 className=" mt-5 text-[34px] font-semibold tracking-tight "
        style={{ color: "var(--foreground)"}}
      >
        Production Intelligence
      </h1>

    </div>

    {/* Login Card */}

    <div className="card-premium p-8">

      <form onSubmit={handleSignIn} className="space-y-5">
        <div>
          <label className=" text-sm font-medium mb-2 block ">
            Employee ID
          </label>

          <input value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)} placeholder="Enter employee ID" required
            className=" w-full px-4 py-3
            "
            />

        </div>

        <div>
          <label className=" text-sm font-medium mb-2
              block
  "
          >
            Password
          </label>

          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}
            placeholder="Enter password" required
            className=" w-full px-4 py-3"
          />

        </div>
        {error && (

          <div className=" rounded-xl px-4 py-3 text-sm "
            style={{ background:"#FFF2F3", color:"#B42318", border:"1px solid #FFD3D6" }}
          >
            {error}
          </div>

        )}

        <button type="submit" disabled={loading}
          className=" btn-primary w-full py-3
          "
        >
          {loading
            ? "Signing In..."
            : "Sign In"}
        </button>

      </form>

      <div
        className=" mt-6
          text-center
          text-sm
        "
        style={{ color: "var(--muted-foreground)" }}
      >
        Forgot password?
        <span className=" ml-2 cursor-pointer font-medium "
          style={{ color: "var(--lg-red)" }}
        >
          Contact IT
        </span>
      </div>

    </div>

    <p className=" mt-8 text-center text-xs
      "
      style={{ color:  "var(--muted-foreground)"}}
    >
      LG Electronics • Life’s Good
    </p>

  </div>

</div>
)
}