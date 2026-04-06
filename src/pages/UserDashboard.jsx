import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function UserDashboard() {
  const { user, profile } = useAuth()
  const [phase, setPhase] = useState(null)
  const [fantasyTeam, setFantasyTeam] = useState(null)
  const [recentMatches, setRecentMatches] = useState([])
  const [rank, setRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pointBreakdown, setPointBreakdown] = useState([])

  useEffect(() => { if (user) loadDashboard() }, [user])

  async function loadDashboard() {
    setLoading(true)
    // Active phase
    const { data: ph } = await supabase.from('phases').select('*').eq('is_active', true).maybeSingle()
    setPhase(ph)

    if (ph) {
      // Fantasy team for this phase
      const { data: ft } = await supabase.from('fantasy_teams')
        .select('*, captain:captain_id(name), vc:vice_captain_id(name)')
        .eq('user_id', user.id).eq('phase_id', ph.id).maybeSingle()
      setFantasyTeam(ft)

      // Rank
      if (ft) {
        const { data: allTeams } = await supabase.from('fantasy_teams')
          .select('id, total_points').eq('phase_id', ph.id).order('total_points', { ascending: false })
        const myRank = allTeams?.findIndex(t => t.id === ft.id) + 1
        setRank(myRank)

        // Point breakdown by match
        const { data: pts } = await supabase.from('fantasy_match_points')
          .select('*, match:match_id(match_number, match_date, team1:team1_id(name), team2:team2_id(name))')
          .eq('fantasy_team_id', ft.id).order('created_at', { ascending: false }).limit(5)
        setPointBreakdown(pts || [])
      }
    }

    // Recent completed matches
    const { data: matches } = await supabase.from('matches')
      .select('*, team1:team1_id(name, short_name, color), team2:team2_id(name, short_name, color), winner:winner_id(name)')
      .eq('is_completed', true).order('match_date', { ascending: false }).limit(5)
    setRecentMatches(matches || [])

    setLoading(false)
  }

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Welcome, {profile?.full_name?.split(' ')[0] || profile?.username}! 👋</h1>
          <p className="page-subtitle">
            {phase ? <span className="phase-indicator"><span className="phase-dot" />{phase.name} — Active</span> : 'No active phase currently'}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="stat-grid mb-3">
          <div className="stat-card">
            <div className="stat-value">{fantasyTeam ? Math.round(fantasyTeam.total_points) : '—'}</div>
            <div className="stat-label">Total Points</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{rank ? `#${rank}` : '—'}</div>
            <div className="stat-label">Leaderboard Rank</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{fantasyTeam ? (fantasyTeam.total_budget - fantasyTeam.spent_budget).toLocaleString() : '10,000'}</div>
            <div className="stat-label">Budget Remaining</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{pointBreakdown.length > 0 ? Math.round(pointBreakdown[0]?.total_points || 0) : '—'}</div>
            <div className="stat-label">Last Match Points</div>
          </div>
        </div>

        <div className="grid-2">
          {/* My Team Status */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">My Fantasy Team</h3>
              <Link to="/team" className="btn btn-primary btn-sm">
                {fantasyTeam ? 'Edit Team' : 'Build Team'}
              </Link>
            </div>
            {fantasyTeam ? (
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold-400)', marginBottom: 12 }}>
                  {fantasyTeam.team_name || 'My DPL Team'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Captain</span>
                    <span style={{ color: 'var(--gold-400)', fontWeight: 600 }}>👑 {fantasyTeam.captain?.name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Vice Captain</span>
                    <span style={{ color: 'var(--green-300)', fontWeight: 600 }}>⭐ {fantasyTeam.vc?.name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--gray-400)' }}>Budget Spent</span>
                    <span>{fantasyTeam.spent_budget?.toLocaleString()} / {fantasyTeam.total_budget?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">🏏</div>
                <div className="empty-state-title">No team yet!</div>
                <div className="empty-state-desc">Build your fantasy team for {phase?.name || 'the current phase'}</div>
              </div>
            )}
          </div>

          {/* Recent Points */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Match Points</h3>
              <Link to="/leaderboard" className="btn btn-ghost btn-sm">Full Board →</Link>
            </div>
            {pointBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pointBreakdown.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--green-800)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        Match {p.match?.match_number}: {p.match?.team1?.name} vs {p.match?.team2?.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{p.match?.match_date}</div>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold-400)' }}>+{Math.round(p.total_points)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">No match points yet</div>
                <div className="empty-state-desc">Points appear after matches are played and stats are entered</div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Matches */}
        <div className="card mt-3">
          <div className="card-header">
            <h3 className="card-title">Recent Matches</h3>
            <Link to="/players" className="btn btn-ghost btn-sm">Player Stats →</Link>
          </div>
          {recentMatches.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentMatches.map(m => (
                <div key={m.id} className="match-card">
                  <div className="match-teams">
                    <div className="match-team">
                      <div className="match-team-name" style={{ color: m.winner?.name === m.team1?.name ? 'var(--gold-400)' : 'inherit' }}>
                        {m.winner?.name === m.team1?.name ? '🏆 ' : ''}{m.team1?.name}
                      </div>
                      {m.team1_score && <div className="match-score">{m.team1_score}</div>}
                    </div>
                    <div className="match-vs">VS</div>
                    <div className="match-team">
                      <div className="match-team-name" style={{ color: m.winner?.name === m.team2?.name ? 'var(--gold-400)' : 'inherit' }}>
                        {m.winner?.name === m.team2?.name ? '🏆 ' : ''}{m.team2?.name}
                      </div>
                      {m.team2_score && <div className="match-score">{m.team2_score}</div>}
                    </div>
                  </div>
                  <div className="match-info">
                    <span>Match {m.match_number}</span>
                    <span>{m.match_date}</span>
                    {m.venue && <span>{m.venue}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-icon">🏟️</div>
              <div className="empty-state-title">No completed matches yet</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
