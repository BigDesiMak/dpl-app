import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'

export default function AdminScoring() {
  const [maleSettings, setMaleSettings]     = useState([])
  const [femaleSettings, setFemaleSettings] = useState([])
  const [changedMale, setChangedMale]       = useState({})
  const [changedFemale, setChangedFemale]   = useState({})
  const [saving, setSaving]                 = useState(false)
  const [loading, setLoading]               = useState(true)
  const [activeGender, setActiveGender]     = useState('male')
  // CHANGE 4: global scoring lock
  const [scoringLocked, setScoringLocked]   = useState(false)
  const [lockSaving, setLockSaving]         = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const [{ data: male }, { data: female }] = await Promise.all([
      supabase.from('scoring_settings').select('*').order('category').order('key'),
      supabase.from('scoring_settings_female').select('*').order('category').order('key')
    ])
    setMaleSettings(male || [])
    setFemaleSettings(female || [])
    // Scoring is locked if ANY row has is_locked = true
    setScoringLocked(male?.some(s => s.is_locked) || false)
    setLoading(false)
  }

  // CHANGE 4: toggle lock/unlock for all scoring rules
  async function toggleScoringLock() {
    setLockSaving(true)
    const newVal = !scoringLocked
    try {
      await Promise.all([
        supabase.from('scoring_settings').update({ is_locked: newVal }).neq('id', 0),
        supabase.from('scoring_settings_female').update({ is_locked: newVal }).neq('id', 0)
      ])
      setScoringLocked(newVal)
      setChangedMale({}); setChangedFemale({})
      toast.success(newVal ? '🔒 Scoring rules locked — no edits possible' : '🔓 Scoring rules unlocked')
    } catch (err) {
      toast.error('Lock toggle failed: ' + err.message)
    } finally { setLockSaving(false) }
  }

  function setMaleVal(key, value) {
    if (scoringLocked) { toast.error('🔒 Scoring is locked — unlock first to edit'); return }
    setChangedMale(c => ({ ...c, [key]: value }))
    setMaleSettings(s => s.map(x => x.key === key ? { ...x, value: parseFloat(value) } : x))
  }

  function setFemaleVal(key, value) {
    if (scoringLocked) { toast.error('🔒 Scoring is locked — unlock first to edit'); return }
    setChangedFemale(c => ({ ...c, [key]: value }))
    setFemaleSettings(s => s.map(x => x.key === key ? { ...x, value: parseFloat(value) } : x))
  }

  async function copyMaleToFemale() {
    if (scoringLocked) { toast.error('🔒 Scoring is locked'); return }
    const newChanged = {}
    maleSettings.forEach(s => { newChanged[s.key] = s.value })
    setChangedFemale(newChanged)
    setFemaleSettings(prev => prev.map(fs => {
      const ms = maleSettings.find(m => m.key === fs.key)
      return ms ? { ...fs, value: ms.value } : fs
    }))
    toast('Male rules copied to Female — click Save to apply ✓')
  }

  async function saveAll() {
    if (scoringLocked) { toast.error('🔒 Scoring is locked — unlock first'); return }
    const maleEntries   = Object.entries(changedMale)
    const femaleEntries = Object.entries(changedFemale)
    const total = maleEntries.length + femaleEntries.length
    if (total === 0) { toast('No changes to save'); return }
    setSaving(true)
    try {
      for (const [key, value] of maleEntries) {
        await supabase.from('scoring_settings').update({ value: parseFloat(value), updated_at: new Date().toISOString() }).eq('key', key)
      }
      for (const [key, value] of femaleEntries) {
        await supabase.from('scoring_settings_female').update({ value: parseFloat(value), updated_at: new Date().toISOString() }).eq('key', key)
      }
      setChangedMale({}); setChangedFemale({})
      toast.success(`${total} scoring rule(s) updated! ⚙️`)
      loadSettings()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally { setSaving(false) }
  }

  const groups = ['batting', 'bowling', 'fielding', 'general', 'multipliers']
  const groupLabels = {
    batting: '🏏 Batting', bowling: '🎯 Bowling', fielding: '🧤 Fielding',
    general: '⭐ General (Playing Bonus / MOTM)', multipliers: '👑 Multipliers'
  }
  const formatKey = k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  const totalChanged = Object.keys(changedMale).length + Object.keys(changedFemale).length

  const SettingsGrid = ({ settings, changed, onSet }) => (
    <div>
      {groups.map(cat => {
        const catSettings = settings.filter(s => s.category === cat)
        if (!catSettings.length) return null
        return (
          <div key={cat} className="card mb-3">
            <h3 className="card-title" style={{ marginBottom: 20, color: 'var(--gold-400)' }}>
              {groupLabels[cat]}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {catSettings.map(s => (
                <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cream-dark)' }}>
                    {formatKey(s.key)}
                  </label>
                  {s.description && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 2 }}>{s.description}</div>
                  )}
                  <input type="number" step="0.5" className="form-input"
                    disabled={scoringLocked}
                    style={{
                      borderColor: changed[s.key] !== undefined ? 'var(--gold-400)' : undefined,
                      opacity: scoringLocked ? 0.5 : 1,
                      cursor: scoringLocked ? 'not-allowed' : undefined
                    }}
                    value={s.value}
                    onChange={e => onSet(s.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (loading) return <Layout><div className="loading-center"><div className="loading-spinner" /></div></Layout>

  return (
    <Layout>
      <div className="page-content">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Scoring Rules ⚙️</h1>
            <p className="page-subtitle">Configure fantasy point values for Male and Female players</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* CHANGE 4: Lock/Unlock button */}
            <button
              className={`btn btn-lg ${scoringLocked ? 'btn-secondary' : 'btn-danger'}`}
              onClick={toggleScoringLock}
              disabled={lockSaving}
              title={scoringLocked ? 'Unlock scoring rules to allow edits' : 'Lock scoring rules to prevent accidental changes'}
            >
              {lockSaving ? '...' : scoringLocked ? '🔓 Unlock Scoring' : '🔒 Lock Scoring'}
            </button>
            <button className="btn btn-primary" onClick={saveAll}
              disabled={saving || totalChanged === 0 || scoringLocked}>
              {saving ? 'Saving...' : `💾 Save${totalChanged > 0 ? ` (${totalChanged})` : ''}`}
            </button>
          </div>
        </div>

        {/* CHANGE 4: Lock status banner */}
        {scoringLocked ? (
          <div style={{
            padding: '12px 18px', marginBottom: 20, borderRadius: 10, fontSize: '0.875rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--red-400)', display: 'flex', gap: 10, alignItems: 'center'
          }}>
            🔒 <strong>Scoring rules are locked.</strong> All fields are read-only. Click "🔓 Unlock Scoring" to make changes.
          </div>
        ) : (
          <div style={{
            padding: '10px 16px', marginBottom: 16, borderRadius: 8, fontSize: '0.82rem',
            background: 'rgba(34,135,92,0.06)', border: '1px solid rgba(34,135,92,0.2)', color: 'var(--gray-400)'
          }}>
            🔓 Scoring rules are unlocked and editable. Lock them after finalising to prevent accidental changes.
          </div>
        )}

        {/* Quick Reference */}
        <div className="card card-gold mb-4" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold-400)', marginBottom: 12 }}>📋 Bowling Milestones & Economy Tiers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: '0.8rem', color: 'var(--gray-400)' }}>
            <div>
              <strong style={{ color: 'var(--cream)' }}>Wicket Milestones</strong><br />
              3 wickets: +8pts | 4 wickets: +10pts<br />5 wickets: +16pts<br />
              <em style={{ fontSize: '0.7rem' }}>Highest applies only</em>
            </div>
            <div>
              <strong style={{ color: 'var(--cream)' }}>Economy Rate</strong><br />
              Below 3: +6 | 3–4.49: +4 | 4.5–5.99: +2<br />
              6.00–9.00: -4 | 9.01–12: -6 | 12+: -8
            </div>
            <div>
              <strong style={{ color: 'var(--cream)' }}>General</strong><br />
              Playing Bonus: +4 (opt-in per match)<br />
              Man of the Match: +10
            </div>
          </div>
        </div>

        {/* Gender Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--green-700)' }}>
          <button className={`tab-btn${activeGender === 'male' ? ' active' : ''}`} onClick={() => setActiveGender('male')}>
            👨 Male Players
            {Object.keys(changedMale).length > 0 && <span className="badge badge-gold" style={{ marginLeft: 8 }}>{Object.keys(changedMale).length}</span>}
          </button>
          <button className={`tab-btn${activeGender === 'female' ? ' active' : ''}`} onClick={() => setActiveGender('female')}>
            👩 Female Players
            {Object.keys(changedFemale).length > 0 && <span className="badge badge-gold" style={{ marginLeft: 8 }}>{Object.keys(changedFemale).length}</span>}
          </button>
        </div>

        {activeGender === 'male' && (
          <SettingsGrid settings={maleSettings} changed={changedMale} onSet={setMaleVal} />
        )}

        {activeGender === 'female' && (
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20, padding: '12px 16px',
              background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)', borderRadius: 10
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>
                Female scoring rules are <strong style={{ color: 'var(--cream)' }}>independent</strong> from male rules.
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyMaleToFemale} disabled={scoringLocked}>
                ⬇ Copy from Male
              </button>
            </div>
            <SettingsGrid settings={femaleSettings} changed={changedFemale} onSet={setFemaleVal} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
          <button className={`btn btn-lg ${scoringLocked ? 'btn-secondary' : 'btn-danger'}`}
            onClick={toggleScoringLock} disabled={lockSaving}>
            {lockSaving ? '...' : scoringLocked ? '🔓 Unlock Scoring' : '🔒 Lock Scoring'}
          </button>
          <button className="btn btn-primary btn-lg" onClick={saveAll}
            disabled={saving || totalChanged === 0 || scoringLocked}>
            {saving ? 'Saving...' : `💾 Save All${totalChanged > 0 ? ` (${totalChanged})` : ''}`}
          </button>
        </div>
      </div>
    </Layout>
  )
}
