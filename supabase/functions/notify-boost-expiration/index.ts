import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BoostNotification {
  id: string
  object_id: string
  user_id: string
  day: number
  sent_at: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar boosts que expiram em 3 dias
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
    threeDaysFromNow.setHours(0, 0, 0, 0)

    const threeDaysFromNowEnd = new Date(threeDaysFromNow)
    threeDaysFromNowEnd.setHours(23, 59, 59, 999)

    const { data: boosts, error: boostsError } = await supabase
      .from('boosts')
      .select('id, object_id, user_id, expires_at, type')
      .eq('status', 'active')
      .gte('expires_at', threeDaysFromNow.toISOString())
      .lt('expires_at', threeDaysFromNowEnd.toISOString())

    if (boostsError) {
      throw boostsError
    }

    console.log(`Found ${boosts?.length || 0} boosts expiring in 3 days`)

    // Para cada boost, verificar se já foi notificado
    const notifications = []
    for (const boost of boosts || []) {
      // Verificar se já existe notificação para este boost (dia 3)
      const { data: existingNotif } = await supabase
        .from('boost_notifications')
        .select('id')
        .eq('object_id', boost.object_id)
        .eq('user_id', boost.user_id)
        .eq('day', 3)
        .single()

      if (!existingNotif) {
        // Criar notificação
        const { data: notif, error: notifError } = await supabase
          .from('boost_notifications')
          .insert({
            object_id: boost.object_id,
            user_id: boost.user_id,
            day: 3,
            sent_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (notifError) {
          console.error(`Error creating notification for boost ${boost.id}:`, notifError)
        } else {
          notifications.push(notif)
        }
      }
    }

    // Buscar boosts que expiram em 1 dia
    const oneDayFromNow = new Date()
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1)
    oneDayFromNow.setHours(0, 0, 0, 0)

    const oneDayFromNowEnd = new Date(oneDayFromNow)
    oneDayFromNowEnd.setHours(23, 59, 59, 999)

    const { data: boostsExpiring1Day, error: boostsError1Day } = await supabase
      .from('boosts')
      .select('id, object_id, user_id, expires_at, type')
      .eq('status', 'active')
      .gte('expires_at', oneDayFromNow.toISOString())
      .lt('expires_at', oneDayFromNowEnd.toISOString())

    if (boostsError1Day) {
      throw boostsError1Day
    }

    console.log(`Found ${boostsExpiring1Day?.length || 0} boosts expiring in 1 day`)

    // Para cada boost que expira em 1 dia, verificar se já foi notificado
    for (const boost of boostsExpiring1Day || []) {
      const { data: existingNotif } = await supabase
        .from('boost_notifications')
        .select('id')
        .eq('object_id', boost.object_id)
        .eq('user_id', boost.user_id)
        .eq('day', 1)
        .single()

      if (!existingNotif) {
        const { data: notif, error: notifError } = await supabase
          .from('boost_notifications')
          .insert({
            object_id: boost.object_id,
            user_id: boost.user_id,
            day: 1,
            sent_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (notifError) {
          console.error(`Error creating notification for boost ${boost.id}:`, notifError)
        } else {
          notifications.push(notif)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationsCreated: notifications.length,
        message: `Created ${notifications.length} boost expiration notifications`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in notify-boost-expiration:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
