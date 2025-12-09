import webpush from 'web-push'
import { prisma } from './prisma'

// Configure web-push with VAPID keys
// Generate keys with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('Push notifications not configured - VAPID keys missing')
    return false
  }

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    })

    if (subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId)
      return false
    }

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }

        try {
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              icon: payload.icon || '/icons/icon-192x192.png',
              badge: payload.badge || '/icons/icon-72x72.png',
              url: payload.url || '/admin/bookings',
              tag: payload.tag || 'booking'
            })
          )
          return true
        } catch (error: any) {
          // Remove invalid subscriptions
          if (error.statusCode === 404 || error.statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { id: sub.id }
            })
            console.log('Removed expired subscription:', sub.endpoint)
          }
          throw error
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    console.log(`Push notifications sent: ${successful}/${subscriptions.length}`)
    return successful > 0
  } catch (error) {
    console.error('Failed to send push notification:', error)
    return false
  }
}

export async function sendPushToAdmins(
  organizationId: string,
  payload: PushPayload
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return
  }

  try {
    const admins = await prisma.user.findMany({
      where: {
        organizationId,
        role: 'admin'
      },
      select: { id: true }
    })

    await Promise.allSettled(
      admins.map(admin => sendPushNotification(admin.id, payload))
    )
  } catch (error) {
    console.error('Failed to send push to admins:', error)
  }
}

