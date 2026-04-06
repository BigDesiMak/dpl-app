import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', confirm: '', fullName: '', username: '', flatNumber: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signUp } = useAuth()
  const navigate = useNavigate()

  function set(k) { return e => setForm({ ...form, [k]: e.target.value }) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!form.email || !form.password || !form.fullName || !form.username) {
      setError('All fields except flat number are required'); return
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) {
      setError('Username: 3-20 characters, letters/numbers/underscore only'); return
    }

    setLoading(true)

    // Check username uniqueness BEFORE calling signup
    const { data: existing, error: checkErr } = await supabase
      .from('profiles').select('id').eq('username', form.username).maybeSingle()
    if (checkErr && checkErr.code !== 'PGRST116') {
      setError('Could not check username — please try again'); setLoading(false); return
    }
    if (existing) { setError('Username already taken — please choose another'); setLoading(false); return }

    // Sign up — pass ALL fields as metadata so DB trigger can read them
    const { data, error: signUpErr } = await signUp(
      form.email,
      form.password,
      { full_name: form.fullName, username: form.username, flat_number: form.flatNumber }
    )

    if (signUpErr) {
      if (signUpErr.message.includes('already registered')) {
        setError('An account with this email already exists. Try signing in.')
      } else if (signUpErr.message.includes('password')) {
        setError('Password is too weak. Use at least 6 characters.')
      } else {
        setError(signUpErr.message)
      }
      setLoading(false)
      return
    }

    // If email confirmation is DISABLED (good for local testing), user is immediately logged in
    if (data?.user && data?.session) {
      // Ensure profile has all fields (trigger may have run already, just update flat_number)
      await supabase
        .from('profiles')
        .update({ flat_number: form.flatNumber, full_name: form.fullName, username: form.username })
        .eq('id', data.user.id)
      setLoading(false)
      toast.success('Account created! Welcome to DPL 🏏')
      navigate('/dashboard')
      return
    }

    // Email confirmation is ENABLED — redirect to login with instructions
    setLoading(false)
    toast.success('Account created! Check your email to verify, then sign in.')
    navigate('/login')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-text">🏏 DPL</div>
          <div className="auth-logo-sub">Daffodils Premier League Fantasy Cricket</div>
        </div>
        <h2 className="auth-title">Create Account</h2>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red-400)', fontSize: '0.875rem', marginBottom: 16 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="Your full name" value={form.fullName} onChange={set('fullName')} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Username *</label>
              <input className="form-input" placeholder="cricket_fan" value={form.username} onChange={set('username')} />
              <div className="form-hint">3-20 chars, letters/numbers/_</div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Flat / RH No.</label>
              <input className="form-input" placeholder="A2-703" value={form.flatNumber} onChange={set('flatNumber')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="Min 6 chars" value={form.password} onChange={set('password')} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Confirm Password *</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} />
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
