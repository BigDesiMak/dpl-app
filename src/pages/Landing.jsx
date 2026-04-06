import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div style={{ background: 'linear-gradient(135deg, var(--green-950) 0%, var(--green-900) 50%, #0a1f0d 100%)', minHeight: '100vh' }}>
      <nav className="navbar" style={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="navbar-brand">🏏 DPL <span className="navbar-brand-sub">Fantasy Cricket 2026</span></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" className="btn btn-secondary btn-sm">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Join Now</Link>
        </div>
      </nav>
      <div className="hero">
        <div className="hero-content">
          <div className="hero-badge">🏆 Season 2026 is LIVE</div>
          <h1 className="hero-title">
            Pick Your Squad.<br />
            <em>Win the League.</em>
          </h1>
          <p className="hero-sub">
            Build your dream team from Daffodils Premier League players.
            Score points on every match. Climb the leaderboard. Be the champion.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">🚀 Start Playing Free</Link>
            <Link to="/leaderboard" className="btn btn-secondary btn-lg">📊 View Leaderboard</Link>
          </div>
          <div style={{ display: 'flex', gap: 32, marginTop: 48, flexWrap: 'wrap' }}>
            {[['80+', 'Players'], ['10,000', 'Budget Credits'], ['2×', 'Captain Bonus'], ['4', 'Phases']].map(([v, l]) => (
              <div key={l}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--gold-400)', fontFamily: 'var(--font-display)' }}>{v}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-cricket">🏏</div>
      </div>
      <div className="feature-grid" style={{ paddingBottom: 80 }}>
        {[
          { icon: '🎯', title: 'Smart Team Selection', desc: 'Pick 10 players (8 playing + 2 subs) across Male & Female categories within your 10,000 credit budget.' },
          { icon: '⚡', title: 'Real-time Points', desc: 'Points auto-calculated after admin enters match stats. Watch your rank change with every boundary and wicket.' },
          { icon: '🔄', title: 'Strategic Transfers', desc: 'Get 3 transfers before Phase 2. Swap out injured or underperforming players to stay competitive.' },
          { icon: '👑', title: 'Captain Bonus', desc: "Your Captain earns 2× points, Vice-Captain gets 1.5×. Choose wisely — they can make or break your week." },
        ].map(f => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{f.title}</div>
            <div className="feature-desc">{f.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', padding: '40px 20px', borderTop: '1px solid var(--green-800)', color: 'var(--gray-400)', fontSize: '0.8rem' }}>
        Daffodils Premier League Fantasy Cricket © 2026
      </div>
    </div>
  )
}
