const { createClient } = require('@supabase/supabase-js')

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

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { userId, newPassword } = JSON.parse(event.body)

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'User ID is required' })
      }
    }

    if (!newPassword || newPassword.length < 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 6 characters' })
      }
    }

    // Reset password to the provided password
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    })

    if (error) {
      console.error('Password reset error:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to reset password' })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Password reset successfully' })
    }
  } catch (error) {
    console.error('Function error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}