import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'

export default function AdminTeams() {
  const [phases, setPhases] = useState([])
  const [selectedPhase, setSelectedPhase] = useState(null)
  const [teams, setTeams] = useState([])
  const [selected, setSelected] = useState(null)
  const [teamPlayers, setTeamPlayers] = useState([])
  const [teamPoints, setTeamPoints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPhases() }, [])
  useEffect(() => { if (selectedPhase) loadTeams(selectedPhase) }, [selectedPhase])

  async function loadPhases() {
    const { data } = await supabase.from('phases').select('*').order('phase_number')
    setPhases(data || [])
    const active = data?.find(p => p.is_active) || data?.[0]
    if (active) setSelectedPhase(active.id)
    else setLoading(false)
  }

  async function loadTeams(phaseId) {
    setLoading(true)
    const { data } = await supabase.from('fantasy_teams')
      .select('*, user:user_id(username, full_name, flat_number), captain:captain_id(name), vc:vice_captain_id(name)')
      .eq('phase_id', phaseId).order('total_points', { ascending: false })
    setTeams(data || [])
    setLoading(false)
  }

  async function openTeam(team) {
    setSelected(team)
    const { data: players } = await supabase.from('fantasy_team_players')
      .select('*, player:player_id(name, gender, skill, auction_price, dpl_team:dpl_team_id(name))')
      .eq('fantasy_team_id', team.id)
    setTeamPlayers(players || [])

    const { data: pts } = await supabase.from('fantasy_match_points')
      .select('*, match:match_id(match_number, match_date, team1:team1_id(name), team2:team2_id(name))')
      .eq('fantasy_team_id', team.id).order('created_at', { ascending: false })
    setTeamPoints(pts || [])
  }

  const playing = teamPlayers.filter(p => p.is_playing)
  const subs = teamPlayers.filter(p => !p.is_playing)

  return (
    <Layout>
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Fantasy Teams 🛡️</h1>
          <p className="page-subtitle">View all user teams per phase</p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {phases.map(p => (
            <button key={p.id} className={`btn ${selectedPhase === p.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedPhase(p.id)}>{p.name}{p.is_active ? ' 🔴' : ''}</button>
          ))}
        </div>

        {loading ? <div className="loading-center" style={{minHeight:200}}><div className="loading-spinner"/></div> : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Rank</th><th>Team Name</th><th>Owner</th><th>Flat</th><th>Captain</th><th>VC</th><th>Budget Used</th><th>Points</th><th></th></tr></thead>
              <tbody>
                {teams.map((t, idx) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: idx<3?'var(--gold-400)':undefined }}>#{idx+1}</td>
                    <td style={{ fontWeight: 600 }}>{t.team_name || 'Unnamed'}</td>
                    <td className="td-muted">{t.user?.full_name || t.user?.username}</td>
                    <td className="td-muted">{t.user?.flat_number || '—'}</td>
                    <td style={{ color: 'var(--gold-400)' }}>👑 {t.captain?.name || '—'}</td>
                    <td style={{ color: 'var(--green-300)' }}>⭐ {t.vc?.name || '—'}</td>
                    <td className="td-muted">₹{(t.spent_budget||0).toLocaleString()} / ₹{(t.total_budget||10000).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: 'var(--gold-400)', fontSize: '1.1rem' }}>{Math.round(t.total_points)}</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => openTeam(t)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {teams.length === 0 && <div className="empty-state" style={{ padding: 40 }}><div className="empty-state-icon">🛡️</div><div className="empty-state-title">No teams registered for this phase</div></div>}
          </div>
        )}

        {/* Team Detail Modal */}
        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="modal-header">
                <div>
                  <div className="modal-title">{selected.team_name || 'Unnamed Team'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                    {selected.user?.full_name || selected.user?.username} · {selected.user?.flat_number}
                  </div>
                </div>
                <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--gold-400)', fontFamily: 'var(--font-display)' }}>{Math.round(selected.total_points)}</div><div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Total Points</div></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>👑 Captain: <strong style={{ color: 'var(--gold-400)' }}>{selected.captain?.name || '—'}</strong></div>
                  <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>⭐ Vice-Captain: <strong style={{ color: 'var(--green-300)' }}>{selected.vc?.name || '—'}</strong></div>
                  <div style={{ fontSize: '0.8rem' }}>Budget: ₹{(selected.spent_budget||0).toLocaleString()} / ₹{(selected.total_budget||10000).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem', color: 'var(--green-300)' }}>▶ PLAYING ({playing.length})</div>
              {playing.map(fp => (
                <div key={fp.id} style={{ display: 'flex', gap: 12, padding: '8px 10px', marginBottom: 4, background: 'var(--green-800)', borderRadius: 8, fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{fp.player?.name}
                    {selected.captain_id === fp.player_id && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: 'var(--gold-400)', color: 'var(--green-950)', padding: '1px 5px', borderRadius: 4 }}>C</span>}
                    {selected.vice_captain_id === fp.player_id && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: 'var(--green-500)', color: 'white', padding: '1px 5px', borderRadius: 4 }}>VC</span>}
                  </span>
                  <span style={{ color: 'var(--gray-400)' }}>{fp.player?.skill}</span>
                  <span className={`player-gender-badge ${fp.player?.gender==='Male'?'gender-m':'gender-f'}`}>{fp.player?.gender?.[0]}</span>
                  <span style={{ color: 'var(--gold-400)' }}>₹{fp.player?.auction_price?.toLocaleString()}</span>
                </div>
              ))}

              <div style={{ fontWeight: 600, margin: '12px 0 8px', fontSize: '0.85rem', color: 'var(--gray-400)' }}>🔄 SUBS ({subs.length})</div>
              {subs.map(fp => (
                <div key={fp.id} style={{ display: 'flex', gap: 12, padding: '8px 10px', marginBottom: 4, background: 'var(--green-900)', borderRadius: 8, fontSize: '0.85rem', opacity: 0.7 }}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{fp.player?.name}</span>
                  <span style={{ color: 'var(--gray-400)' }}>{fp.player?.skill}</span>
                  <span className={`player-gender-badge ${fp.player?.gender==='Male'?'gender-m':'gender-f'}`}>{fp.player?.gender?.[0]}</span>
                </div>
              ))}

              {teamPoints.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, margin: '16px 0 8px', fontSize: '0.85rem' }}>📊 Points History</div>
                  {teamPoints.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '0.8rem', borderBottom: '1px solid var(--green-800)' }}>
                      <span>M{p.match?.match_number}: {p.match?.team1?.name} vs {p.match?.team2?.name}</span>
                      <span style={{ color: 'var(--gold-400)', fontWeight: 700 }}>+{Math.round(p.total_points)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
