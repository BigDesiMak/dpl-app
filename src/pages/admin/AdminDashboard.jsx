import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'

export default function AdminDashboard() {
  const [stats, setStats] = useState({})
  const [recentMatches, setRecentMatches] = useState([])
  const [pendingStats, setPendingStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [
      { count: players }, { count: users }, { count: teams }, { count: matches },
      { data: recent }, { data: pending }
    ] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('fantasy_teams').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*, team1:team1_id(name), team2:team2_id(name), winner:winner_id(name)')
        .order('match_date', { ascending: false }).limit(5),
      supabase.from('matches').select('id, match_number, team1:team1_id(name), team2:team2_id(name)')
        .eq('is_completed', true).eq('stats_entered', false).order('match_number')
    ])
    setStats({ players, users, teams, matches })
    setRecentMatches(recent || [])
    setPendingStats(pending || [])
    setLoading(false)
  }

  const quickLinks = [
    { to: '/admin/matches', icon: '🏏', label: 'Add Match', desc: 'Schedule or record matches' },
    { to: '/admin/players', icon: '👤', label: 'Manage Players', desc: 'Add, edit player roster' },
    { to: '/admin/teams', icon: '🛡️', label: 'View Teams', desc: 'See all user fantasy teams' },
    { to: '/admin/phases', icon: '📅', label: 'Phases', desc: 'Manage league phases' },
    { to: '/admin/scoring', icon: '⚙️', label: 'Scoring Rules', desc: 'Configure point values' },
  ]

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner"/></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Admin Dashboard ⚙️</h1>
          <p className="page-subtitle">Daffodils Premier League — Season 2026</p>
        </div>

        {/* Alert for pending stats */}
        {pendingStats.length > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--yellow-400)', marginBottom: 4 }}>⚠️ {pendingStats.length} match(es) awaiting stats entry</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                {pendingStats.map(m => `Match ${m.match_number}: ${m.team1?.name} vs ${m.team2?.name}`).join(' · ')}
              </div>
            </div>
            <Link to="/admin/matches" className="btn btn-primary btn-sm">Enter Stats →</Link>
          </div>
        )}

        <div className="stat-grid mb-4">
          {[['👤', stats.players, 'Players'], ['🙋', stats.users, 'Users'], ['🛡️', stats.teams, 'Fantasy Teams'], ['🏏', stats.matches, 'Matches']].map(([i, v, l]) => (
            <div key={l} className="stat-card"><div style={{ fontSize: '1.5rem' }}>{i}</div><div className="stat-value">{v ?? 0}</div><div className="stat-label">{l}</div></div>
          ))}
        </div>

        <div className="grid-2">
          {/* Quick Links */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 16 }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quickLinks.map(ql => (
                <Link key={ql.to} to={ql.to} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                  background: 'var(--green-800)', borderRadius: 10, textDecoration: 'none',
                  border: '1px solid var(--green-700)', transition: 'var(--transition)'
                }} onMouseEnter={e => e.currentTarget.style.borderColor='var(--gold-400)'}
                   onMouseLeave={e => e.currentTarget.style.borderColor='var(--green-700)'}>
                  <span style={{ fontSize: '1.4rem' }}>{ql.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--cream)' }}>{ql.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{ql.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Matches */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Matches</h3>
              <Link to="/admin/matches" className="btn btn-ghost btn-sm">All →</Link>
            </div>
            {recentMatches.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}><div className="empty-state-icon">🏟️</div><div className="empty-state-title">No matches yet</div></div>
            ) : recentMatches.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--green-800)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>M{m.match_number}: {m.team1?.name} vs {m.team2?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{m.match_date || 'TBD'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {m.is_completed ? (
                    m.stats_entered
                      ? <span className="badge badge-green">✓ Stats Done</span>
                      : <Link to={`/admin/match-stats/${m.id}`} className="btn btn-primary btn-sm">Enter Stats</Link>
                  ) : <span className="badge badge-gray">Upcoming</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
