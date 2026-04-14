import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, newPassword } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Reset password to the provided password
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) {
      console.error('Password reset error:', error)
      return res.status(500).json({ error: 'Failed to reset password' })
    }

    return res.status(200).json({ success: true, message: 'Password reset successfully' })
  } catch (error) {
    console.error('Function error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}