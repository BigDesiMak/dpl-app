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

  function set(k) { return e => setForm({...form, [k]: e.target.value}) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password || !form.fullName || !form.username) { setError('All fields except flat number are required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) { setError('Username: 3-20 chars, letters/numbers/underscore only'); return }

    // Check username uniqueness
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', form.username).maybeSingle()
    if (existing) { setError('Username already taken'); return }

    setLoading(true)
    const { data, error: err } = await signUp(form.email, form.password, { full_name: form.fullName, username: form.username })
    if (err) { setError(err.message); setLoading(false); return }

    // Update profile with extra fields
    if (data?.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, username: form.username, full_name: form.fullName, flat_number: form.flatNumber })
    }
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
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--red-400)', fontSize: '0.875rem', marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" placeholder="Your full name" value={form.fullName} onChange={set('fullName')} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Username *</label>
              <input className="form-input" placeholder="cricket_fan" value={form.username} onChange={set('username')} />
            </div>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Flat / RH No.</label>
              <input className="form-input" placeholder="A2-703" value={form.flatNumber} onChange={set('flatNumber')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-row">
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="Min 6 chars" value={form.password} onChange={set('password')} />
            </div>
            <div className="form-group" style={{margin:0}}>
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
