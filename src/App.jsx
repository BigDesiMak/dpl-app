import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import AuthCallback from './pages/AuthCallback'
import UserDashboard from './pages/UserDashboard'
import TeamSelection from './pages/TeamSelection'
import Leaderboard from './pages/Leaderboard'
import PlayerStats from './pages/PlayerStats'
import AllTeams    from './pages/AllTeams'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPlayers from './pages/admin/AdminPlayers'
import AdminMatches from './pages/admin/AdminMatches'
import AdminMatchStats from './pages/admin/AdminMatchStats'
import AdminTeams from './pages/admin/AdminTeams'
import AdminScoring from './pages/admin/AdminScoring'
import AdminPhases from './pages/admin/AdminPhases'
import AdminUsers  from './pages/admin/AdminUsers'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()
  if (loading) return (
    <div className="loading-center">
      <div className="loading-spinner" />
      <span style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>Loading DPL...</span>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !profile?.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={!user ? <Landing /> : <Navigate to="/dashboard" replace />} />
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" replace />} />

      {/* Auth callback — MUST be public, handles email verification redirect */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected user routes */}
      <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><TeamSelection /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/players" element={<ProtectedRoute><PlayerStats /></ProtectedRoute>} />
      <Route path="/all-teams" element={<ProtectedRoute><AllTeams /></ProtectedRoute>} />

      {/* Protected admin routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/players" element={<ProtectedRoute adminOnly><AdminPlayers /></ProtectedRoute>} />
      <Route path="/admin/matches" element={<ProtectedRoute adminOnly><AdminMatches /></ProtectedRoute>} />
      <Route path="/admin/match-stats/:matchId" element={<ProtectedRoute adminOnly><AdminMatchStats /></ProtectedRoute>} />
      <Route path="/admin/teams" element={<ProtectedRoute adminOnly><AdminTeams /></ProtectedRoute>} />
      <Route path="/admin/scoring" element={<ProtectedRoute adminOnly><AdminScoring /></ProtectedRoute>} />
      <Route path="/admin/phases" element={<ProtectedRoute adminOnly><AdminPhases /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          style: { background: 'var(--green-800)', color: 'var(--cream)', border: '1px solid var(--green-600)' },
          success: { iconTheme: { primary: 'var(--gold-400)', secondary: 'var(--green-950)' } }
        }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
