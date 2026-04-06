import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Leaderboard() {
  const { user } = useAuth()
  const [phases, setPhases] = useState([])
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [rankings, setRankings] = useState([])
  const [matchBreakdown, setMatchBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overall')
  const [myTeamId, setMyTeamId] = useState(null)

  useEffect(() => { loadPhases() }, [])
  useEffect(() => { if (selectedPhase) loadRankings(selectedPhase) }, [selectedPhase])

  async function loadPhases() {
    const { data } = await supabase.from('phases').select('*').order('phase_number')
    setPhases(data || [])
    const active = data?.find(p => p.is_active) || data?.[0]
    if (active) setSelectedPhase(active.id)
    else setLoading(false)
  }

  async function loadRankings(phaseId) {
    setLoading(true)
    const { data: teams } = await supabase.from('fantasy_teams')
      .select('id, team_name, total_points, user_id, profile:user_id(username, full_name, flat_number)')
      .eq('phase_id', phaseId)
      .order('total_points', { ascending: false })

    setRankings(teams || [])
    const mine = teams?.find(t => t.user_id === user?.id)
    setMyTeamId(mine?.id || null)

    // Match breakdown for chart
    const { data: matches } = await supabase.from('matches')
      .select('id, match_number, match_date')
      .eq('phase_id', phaseId).eq('is_completed', true).eq('stats_entered', true)
      .order('match_number')

    if (matches?.length && mine) {
      const { data: pts } = await supabase.from('fantasy_match_points')
        .select('match_id, total_points')
        .eq('fantasy_team_id', mine.id)
      const ptMap = {}
      pts?.forEach(p => { ptMap[p.match_id] = p.total_points })
      setMatchBreakdown(matches.map(m => ({ name: `M${m.match_number}`, points: Math.round(ptMap[m.id] || 0) })))
    }
    setLoading(false)
  }

  const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Leaderboard 🏆</h1>
          <p className="page-subtitle">Fantasy cricket rankings by phase</p>
        </div>

        {/* Phase selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {phases.map(p => (
            <button key={p.id}
              className={`btn ${selectedPhase === p.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedPhase(p.id)}>
              {p.name}{p.is_active ? ' 🔴' : ''}
            </button>
          ))}
        </div>

        <div className="tabs">
          <button className={`tab-btn${activeTab==='overall'?' active':''}`} onClick={()=>setActiveTab('overall')}>📊 Overall Rankings</button>
          <button className={`tab-btn${activeTab==='chart'?' active':''}`} onClick={()=>setActiveTab('chart')}>📈 My Points Chart</button>
        </div>

        {loading ? <div className="loading-center" style={{minHeight:300}}><div className="loading-spinner"/></div> : (
          <>
            {activeTab === 'overall' && (
              <div className="card" style={{ padding: 0 }}>
                {rankings.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-icon">🏆</div><div className="empty-state-title">No teams yet for this phase</div></div>
                ) : rankings.map((team, idx) => {
                  const rank = idx + 1
                  const isMe = team.user_id === user?.id
                  return (
                    <div key={team.id} className="leaderboard-row"
                      style={{ background: isMe ? 'rgba(212,175,55,0.06)' : undefined, borderLeft: isMe ? '3px solid var(--gold-400)' : '3px solid transparent' }}>
                      <div className={`leaderboard-rank rank-${rank}`}>{medal(rank)}</div>
                      <div className="leaderboard-info">
                        <div className="leaderboard-team">
                          {team.team_name || 'Unnamed Team'}
                          {isMe && <span className="badge badge-gold" style={{ marginLeft: 8 }}>You</span>}
                        </div>
                        <div className="leaderboard-user">
                          {team.profile?.full_name || team.profile?.username}
                          {team.profile?.flat_number && ` · ${team.profile.flat_number}`}
                        </div>
                      </div>
                      <div className="leaderboard-points">{Math.round(team.total_points)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {activeTab === 'chart' && (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 20 }}>My Points Per Match</h3>
                {matchBreakdown.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-icon">📈</div><div className="empty-state-title">No match data yet</div></div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={matchBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="var(--gray-400)" tick={{ fill: 'var(--gray-400)', fontSize: 12 }} />
                      <YAxis stroke="var(--gray-400)" tick={{ fill: 'var(--gray-400)', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: 'var(--green-800)', border: '1px solid var(--green-600)', borderRadius: 8, color: 'var(--cream)' }} />
                      <Bar dataKey="points" radius={[4, 4, 0, 0]}>
                        {matchBreakdown.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? 'var(--gold-400)' : 'var(--green-400)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
