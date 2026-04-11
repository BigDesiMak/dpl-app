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

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    const [{ data: male }, { data: female }] = await Promise.all([
      supabase.from('scoring_settings').select('*').order('category').order('key'),
      supabase.from('scoring_settings_female').select('*').order('category').order('key')
    ])
    setMaleSettings(male || [])
    setFemaleSettings(female || [])
    setLoading(false)
  }

  function setMaleVal(key, value) {
    setChangedMale(c => ({ ...c, [key]: value }))
    setMaleSettings(s => s.map(x => x.key === key ? { ...x, value: parseFloat(value) } : x))
  }

  function setFemaleVal(key, value) {
    setChangedFemale(c => ({ ...c, [key]: value }))
    setFemaleSettings(s => s.map(x => x.key === key ? { ...x, value: parseFloat(value) } : x))
  }

  async function copyMaleToFemale() {
    // Populate changedFemale with all male values
    const newChanged = {}
    maleSettings.forEach(s => {
      newChanged[s.key] = s.value
    })
    setChangedFemale(newChanged)
    setFemaleSettings(prev => prev.map(fs => {
      const ms = maleSettings.find(m => m.key === fs.key)
      return ms ? { ...fs, value: ms.value } : fs
    }))
    toast('Male rules copied to Female — click Save to apply ✓')
  }

  async function saveAll() {
    const maleEntries   = Object.entries(changedMale)
    const femaleEntries = Object.entries(changedFemale)
    const total = maleEntries.length + femaleEntries.length
    if (total === 0) { toast('No changes to save'); return }
    setSaving(true)
    try {
      for (const [key, value] of maleEntries) {
        await supabase.from('scoring_settings')
          .update({ value: parseFloat(value), updated_at: new Date().toISOString() })
          .eq('key', key)
      }
      for (const [key, value] of femaleEntries) {
        await supabase.from('scoring_settings_female')
          .update({ value: parseFloat(value), updated_at: new Date().toISOString() })
          .eq('key', key)
      }
      setChangedMale({}); setChangedFemale({})
      toast.success(`${total} scoring rule(s) updated! ⚙️`)
      loadSettings()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const groups = ['batting', 'bowling', 'fielding', 'multipliers']
  const groupLabels = {
    batting: '🏏 Batting', bowling: '🎯 Bowling', fielding: '🧤 Fielding', multipliers: '👑 Multipliers'
  }
  const formatKey = k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  const totalChanged = Object.keys(changedMale).length + Object.keys(changedFemale).length

  const SettingsGrid = ({ settings, changed, onSet, gender }) => (
    <div>
      {groups.map(cat => {
        const catSettings = settings.filter(s => s.category === cat)
        if (!catSettings.length) return null
        return (
          <div key={cat} className="card mb-3">
            <h3 className="card-title" style={{ marginBottom: 20, color: 'var(--gold-400)' }}>
              {groupLabels[cat]}
              {cat === 'bowling' && gender === 'male' && (
                <span style={{ marginLeft: 12, fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'var(--font-body)', fontWeight: 400 }}>
                  Wicket milestones: 3wkt bonus → 4wkt bonus → 5wkt bonus (cumulative best applies)
                </span>
              )}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {catSettings.map(s => (
                <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--cream-dark)' }}>
                    {formatKey(s.key)}
                  </label>
                  {s.description && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 2 }}>
                      {s.description}
                    </div>
                  )}
                  <input
                    type="number" step="0.5" className="form-input"
                    style={{ borderColor: changed[s.key] !== undefined ? 'var(--gold-400)' : undefined }}
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
            <p className="page-subtitle">Configure fantasy point values separately for Male and Female players</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={saveAll}
            disabled={saving || totalChanged === 0}
          >
            {saving ? 'Saving...' : `💾 Save Changes${totalChanged > 0 ? ` (${totalChanged})` : ''}`}
          </button>
        </div>

        {/* Quick Reference */}
        <div className="card card-gold mb-4" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, color: 'var(--gold-400)', marginBottom: 12 }}>📋 Bowling Milestone Logic</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, fontSize: '0.8rem', color: 'var(--gray-400)' }}>
            <div>
              <strong style={{ color: 'var(--cream)' }}>Wicket Milestones</strong><br />
              3 wickets: +8pts bonus<br />
              <span style={{ color: 'var(--gold-400)' }}>4 wickets: +10pts bonus ✨ NEW</span><br />
              5 wickets: +16pts bonus<br />
              <em style={{ fontSize: '0.7rem' }}>Only the highest milestone applies</em>
            </div>
            <div>
              <strong style={{ color: 'var(--cream)' }}>Economy Rate Tiers</strong><br />
              Below 3.00: +6pts<br />
              3.00–4.49: +4pts | 4.50–5.99: +2pts<br />
              8.00–9.00: -4pts<br />
              <span style={{ color: 'var(--gold-400)' }}>9.01–12.00: -6pts ✨ UPDATED</span><br />
              <span style={{ color: 'var(--red-400)' }}>Above 12.00: -8pts ✨ NEW</span>
            </div>
            <div>
              <strong style={{ color: 'var(--cream)' }}>Female Scoring</strong><br />
              Separate rules per category<br />
              Default: same as Male<br />
              Use "Copy from Male" to sync<br />
              <em style={{ fontSize: '0.7rem' }}>Changes apply independently per gender</em>
            </div>
          </div>
        </div>

        {/* Gender Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--green-700)' }}>
          <button
            className={`tab-btn${activeGender === 'male' ? ' active' : ''}`}
            onClick={() => setActiveGender('male')}
          >
            👨 Male Players
            {Object.keys(changedMale).length > 0 && (
              <span className="badge badge-gold" style={{ marginLeft: 8 }}>{Object.keys(changedMale).length} changes</span>
            )}
          </button>
          <button
            className={`tab-btn${activeGender === 'female' ? ' active' : ''}`}
            onClick={() => setActiveGender('female')}
          >
            👩 Female Players
            {Object.keys(changedFemale).length > 0 && (
              <span className="badge badge-gold" style={{ marginLeft: 8 }}>{Object.keys(changedFemale).length} changes</span>
            )}
          </button>
        </div>

        {/* Male Scoring */}
        {activeGender === 'male' && (
          <SettingsGrid
            settings={maleSettings}
            changed={changedMale}
            onSet={setMaleVal}
            gender="male"
          />
        )}

        {/* Female Scoring */}
        {activeGender === 'female' && (
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 20, padding: '12px 16px',
              background: 'rgba(251,113,133,0.06)', border: '1px solid rgba(251,113,133,0.2)',
              borderRadius: 10
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>
                Female scoring rules are <strong style={{ color: 'var(--cream)' }}>independent</strong> from male rules.
                Customise each category or sync from male defaults.
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyMaleToFemale}>
                ⬇ Copy from Male
              </button>
            </div>
            <SettingsGrid
              settings={femaleSettings}
              changed={changedFemale}
              onSet={setFemaleVal}
              gender="female"
            />
          </div>
        )}

        {/* Bottom Save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-primary btn-lg" onClick={saveAll} disabled={saving || totalChanged === 0}>
            {saving ? 'Saving...' : `💾 Save All Changes${totalChanged > 0 ? ` (${totalChanged} modified)` : ''}`}
          </button>
        </div>
      </div>
    </Layout>
  )
}
