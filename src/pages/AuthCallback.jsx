import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Verifying your email...')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    async function handleCallback() {
      try {
        // Supabase puts the token in the URL hash (#) or query params (?)
        // getSession() picks it up automatically from the URL
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          // Try exchanging the code manually (PKCE flow)
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')

          if (code) {
            const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
            if (exchangeErr) {
              setIsError(true)
              setStatus('Verification failed: ' + exchangeErr.message)
              return
            }
          } else {
            setIsError(true)
            setStatus('Verification failed. The link may have expired.')
            return
          }
        }

        // Check if we have a valid session now
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          setStatus('Email verified! Redirecting...')
          setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
        } else {
          // Token was in the URL hash — Supabase JS handles it automatically on load
          // Wait briefly then check again
          await new Promise(r => setTimeout(r, 1500))
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (retrySession?.user) {
            setStatus('Email verified! Redirecting...')
            setTimeout(() => navigate('/dashboard', { replace: true }), 800)
          } else {
            setStatus('Email verified! Please sign in.')
            setTimeout(() => navigate('/login', { replace: true }), 1500)
          }
        }
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
        background: 'var(--green-900)', border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'var(--gold-400)'}`,
        borderRadius: 16, padding: '32px 40px', textAlign: 'center', maxWidth: 420, width: '100%'
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--gold-400)', marginBottom: 12 }}>
          DPL Fantasy Cricket
        </div>
        {!isError && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--green-700)', borderTopColor: 'var(--gold-400)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          </div>
        )}
        <div style={{ color: isError ? 'var(--red-400)' : 'var(--cream)', fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>
          {status}
        </div>
        {isError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>
              Try registering again or contact the admin.
            </p>
            <a href="/register" style={{
              display: 'block', padding: '10px 20px', background: 'var(--gold-400)',
              color: 'var(--green-950)', borderRadius: 8, fontWeight: 700, textDecoration: 'none'
            }}>
              Back to Register
            </a>
            <a href="/login" style={{
              display: 'block', padding: '10px 20px', border: '1px solid var(--green-600)',
              color: 'var(--cream)', borderRadius: 8, fontWeight: 600, textDecoration: 'none'
            }}>
              Try Sign In
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
