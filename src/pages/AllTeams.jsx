import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function AllTeams() {
  const { user }  = useAuth()
  const [phases, setPhases]           = useState([])
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [currentPhase, setCurrentPhase] = useState(null)
  const [teams, setTeams]             = useState([])
  const [selected, setSelected]       = useState(null)   // expanded team
  const [teamPlayers, setTeamPlayers] = useState([])
  const [teamPoints, setTeamPoints]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')

  useEffect(() => { loadPhases() }, [])
  useEffect(() => { if (selectedPhase) {
    const phase = phases.find(p => p.id === selectedPhase)
    setCurrentPhase(phase)
    loadTeams(selectedPhase)
  } }, [selectedPhase, phases])

  async function loadPhases() {
    const { data } = await supabase.from('phases').select('*').order('phase_number')
    setPhases(data || [])
    const active = data?.find(p => p.is_active) || data?.[0]
    if (active) {
      setSelectedPhase(active.id)
      setCurrentPhase(active)
    } else {
      setLoading(false)
    }
  }

  async function loadTeams(phaseId) {
    setLoading(true)
    const { data } = await supabase.from('fantasy_teams')
      .select('*, user:user_id(username, full_name, flat_number), captain:captain_id(name), vc:vice_captain_id(name)')
      .eq('phase_id', phaseId)
      .order('total_points', { ascending: false })
    setTeams(data || [])
    setLoading(false)
  }

  async function openTeam(team) {
    setSelected(team)
    const [{ data: players }, { data: pts }] = await Promise.all([
      supabase.from('fantasy_team_players')
        .select('*, player:player_id(name, gender, skill, auction_price, dpl_team:dpl_team_id(name))')
        .eq('fantasy_team_id', team.id),
      supabase.from('fantasy_match_points')
        .select('*, match:match_id(match_number, match_date, team1:team1_id(name), team2:team2_id(name))')
        .eq('fantasy_team_id', team.id)
        .order('created_at', { ascending: false })
    ])
    setTeamPlayers(players || [])
    setTeamPoints(pts || [])
  }

  const filtered = teams.filter(t => {
    if (!search) return true
    const name = (t.user?.full_name || t.user?.username || '').toLowerCase()
    const tname = (t.team_name || '').toLowerCase()
    const flat  = (t.user?.flat_number || '').toLowerCase()
    return name.includes(search.toLowerCase()) || tname.includes(search.toLowerCase()) || flat.includes(search.toLowerCase())
  })

  const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">All Teams 🛡️</h1>
          <p className="page-subtitle">See every player's fantasy team for any phase</p>
        </div>

        {/* Phase tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {phases.map(p => (
            <button key={p.id}
              className={`btn ${selectedPhase === p.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSelectedPhase(p.id); setSelected(null) }}>
              {p.name}{p.is_active ? ' 🔴' : ''}{p.is_locked ? ' 🔒' : ''}
            </button>
          ))}
        </div>

        {/* Phase locked status */}
        {!loading && currentPhase && !currentPhase.is_locked && (
          <div style={{
            padding: '14px 18px', marginBottom: 20, borderRadius: 10, fontSize: '0.9rem',
            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)',
            color: 'var(--blue-400)', fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center'
          }}>
            🔓 <span>Teams are only visible after the phase is locked by the admin.</span>
          </div>
        )}

        {/* Search */}
        <div className="filter-bar">
          <input className="form-input search-input" placeholder="Search by name, team name or flat..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ fontSize:'0.82rem', color:'var(--gray-400)', alignSelf:'center' }}>
            {filtered.length} team{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="loading-center" style={{ minHeight:200 }}><div className="loading-spinner"/></div>
        ) : !currentPhase?.is_locked ? (
          <div className="empty-state"><div className="empty-state-icon">🔒</div><div className="empty-state-title">Phase Not Locked</div><div className="empty-state-desc">Teams will be visible once the admin locks this phase</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">🛡️</div><div className="empty-state-title">No teams registered for this phase</div></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map((team, idx) => {
              const isMe   = team.user_id === user?.id
              const rank   = teams.findIndex(t => t.id === team.id) + 1
              const isOpen = selected?.id === team.id

              return (
                <div key={team.id} style={{
                  background: isMe ? 'rgba(212,175,55,0.05)' : 'var(--green-900)',
                  border: `1px solid ${isMe ? 'var(--gold-400)' : isOpen ? 'var(--green-500)' : 'var(--green-700)'}`,
                  borderRadius:12, overflow:'hidden', transition:'border-color 0.15s'
                }}>
                  {/* Collapsed row */}
                  <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', cursor:'pointer' }}
                    onClick={() => isOpen ? setSelected(null) : openTeam(team)}>

                    {/* Rank */}
                    <div style={{
                      fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:900, width:36, textAlign:'center',
                      color: rank===1?'#FFD700': rank===2?'#C0C0C0': rank===3?'#CD7F32':'var(--gray-400)'
                    }}>{medal(rank)}</div>

                    {/* Info */}
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:'0.95rem', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        {team.team_name || 'Unnamed Team'}
                        {isMe && <span className="badge badge-gold">You</span>}
                      </div>
                      <div style={{ fontSize:'0.78rem', color:'var(--gray-400)', marginTop:2 }}>
                        {team.user?.full_name || team.user?.username}
                        {team.user?.flat_number && ` · ${team.user.flat_number}`}
                        <span style={{ marginLeft:10, color:'var(--gold-300)' }}>C: 👑 {team.captain?.name || '—'}</span>
                        <span style={{ marginLeft:8, color:'var(--green-300)' }}>VC: ⭐ {team.vc?.name || '—'}</span>
                      </div>
                    </div>

                    {/* Points */}
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', fontWeight:700, color:'var(--gold-400)' }}>
                        {Math.round(team.total_points)}
                      </div>
                      <div style={{ fontSize:'0.68rem', color:'var(--gray-400)' }}>pts</div>
                    </div>

                    <span style={{ color:'var(--gray-400)', fontSize:'0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded team detail */}
                  {isOpen && (
                    <div style={{ borderTop:'1px solid var(--green-700)', padding:'16px 18px', background:'rgba(0,0,0,0.1)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                        {/* Players */}
                        <div>
                          <div style={{ fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--gray-400)', marginBottom:8, fontWeight:600 }}>
                            Squad ({teamPlayers.length} players)
                          </div>
                          {teamPlayers.length === 0 ? (
                            <div style={{ color:'var(--gray-400)', fontSize:'0.82rem' }}>Loading...</div>
                          ) : teamPlayers.map(fp => {
                            const isCap = team.captain_id === fp.player_id
                            const isVC  = team.vice_captain_id === fp.player_id
                            return (
                              <div key={fp.id} style={{
                                display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                                marginBottom:4, background:'var(--green-800)', borderRadius:6, fontSize:'0.82rem'
                              }}>
                                <span className={`player-gender-badge ${fp.player?.gender==='Male'?'gender-m':'gender-f'}`} style={{ fontSize:'0.6rem' }}>
                                  {fp.player?.gender?.[0]}
                                </span>
                                <span style={{ flex:1, fontWeight: isCap||isVC ? 600 : 400 }}>{fp.player?.name}</span>
                                {isCap && <span style={{ fontSize:'0.65rem', background:'var(--gold-400)', color:'var(--green-950)', padding:'1px 5px', borderRadius:3, fontWeight:700 }}>C</span>}
                                {isVC && !isCap && <span style={{ fontSize:'0.65rem', background:'var(--green-500)', color:'white', padding:'1px 5px', borderRadius:3, fontWeight:700 }}>VC</span>}
                                <span style={{ fontSize:'0.65rem', color:'var(--gray-400)' }}>{fp.player?.dpl_team?.name}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Match points */}
                        <div>
                          <div style={{ fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--gray-400)', marginBottom:8, fontWeight:600 }}>
                            Points per Match
                          </div>
                          {teamPoints.length === 0 ? (
                            <div style={{ color:'var(--gray-400)', fontSize:'0.82rem' }}>No matches played yet</div>
                          ) : teamPoints.map(p => (
                            <div key={p.id} style={{
                              display:'flex', justifyContent:'space-between', alignItems:'center',
                              padding:'6px 8px', marginBottom:4, background:'var(--green-800)', borderRadius:6, fontSize:'0.82rem'
                            }}>
                              <span style={{ color:'var(--gray-400)' }}>
                                M{p.match?.match_number}: {p.match?.team1?.name} vs {p.match?.team2?.name}
                              </span>
                              <span style={{ fontWeight:700, color:'var(--gold-400)' }}>+{Math.round(p.total_points)}</span>
                            </div>
                          ))}
                          {teamPoints.length > 0 && (
                            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 8px 2px', fontSize:'0.85rem', fontWeight:700, borderTop:'1px solid var(--green-700)', marginTop:4 }}>
                              <span>Total</span>
                              <span style={{ color:'var(--gold-400)' }}>{Math.round(team.total_points)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ fontSize:'0.75rem', color:'var(--gray-400)' }}>
                        Budget: ₹{(team.spent_budget||0).toLocaleString()} / ₹{(team.total_budget||10000).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
