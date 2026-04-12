import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AuthCallback() {
  const navigate  = useNavigate()
  const [status, setStatus]   = useState('Verifying your email...')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      try {
        // ── Strategy 1: PKCE code flow (Vercel / production)
        // Supabase v2 sends ?code=xxx in the URL for email confirmation
        const params = new URLSearchParams(window.location.search)
        const code   = params.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setIsError(true)
            setStatus('Verification failed: ' + error.message)
            return
          }
          // Session is now set — navigate to dashboard
          setStatus('✅ Email verified! Taking you to your dashboard...')
          setTimeout(() => navigate('/dashboard', { replace: true }), 1000)
          return
        }

        // ── Strategy 2: Implicit / hash token flow (older Supabase configs)
        // Supabase sometimes puts access_token in the URL hash: #access_token=xxx
        const hash        = window.location.hash
        const hashParams  = new URLSearchParams(hash.replace('#', ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })
          if (error) {
            setIsError(true)
            setStatus('Verification failed: ' + error.message)
            return
          }
          setStatus('✅ Email verified! Taking you to your dashboard...')
          setTimeout(() => navigate('/dashboard', { replace: true }), 1000)
          return
        }

        // ── Strategy 3: Session may already exist (page refreshed)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setStatus('✅ Already verified! Taking you to your dashboard...')
          setTimeout(() => navigate('/dashboard', { replace: true }), 800)
          return
        }

        // ── Nothing worked — show friendly error
        setIsError(true)
        setStatus(
          'The verification link has expired or already been used. ' +
          'Please try signing in, or register again.'
        )
      } catch (err) {
        setIsError(true)
        setStatus('Something went wrong: ' + err.message)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, var(--green-800) 0%, var(--green-950) 70%)',
      flexDirection: 'column', gap: 24, padding: 20
    }}>
      <div style={{ fontSize: '3rem' }}>{isError ? '❌' : '🏏'}</div>

      <div style={{
        background: 'var(--green-900)',
        border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(212,175,55,0.5)'}`,
        borderRadius: 16, padding: '32px 40px',
        textAlign: 'center', maxWidth: 440, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--gold-400)', marginBottom: 16 }}>
          DPL Fantasy Cricket
        </div>

        {!isError && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '3px solid var(--green-700)',
              borderTopColor: 'var(--gold-400)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px'
            }} />
          </div>
        )}

        <div style={{
          color: isError ? 'var(--red-400)' : 'var(--cream)',
          fontSize: '1rem', fontWeight: 600, lineHeight: 1.5
        }}>
          {status}
        </div>

        {isError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            <a href="/login" style={{
              display: 'block', padding: '11px 20px',
              background: 'var(--gold-400)', color: 'var(--green-950)',
              borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem'
            }}>
              → Try Signing In
            </a>
            <a href="/register" style={{
              display: 'block', padding: '11px 20px',
              border: '1px solid var(--green-600)', color: 'var(--cream)',
              borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem'
            }}>
              Register New Account
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
