import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format, parseISO, isAfter } from 'date-fns'
import { nb } from 'date-fns/locale'
import { useAuth } from '../context/AuthContext'
import { Booking } from '../types'
import { RootStackParamList } from '../navigation/AppNavigator'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function HomeScreen() {
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBookings = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/bookings?userId=${user.id}`, {
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (response.ok) {
        const data = await response.json()
        // Filter upcoming bookings
        const now = new Date()
        const upcoming = data
          .filter((b: Booking) => 
            isAfter(parseISO(b.startTime), now) && 
            (b.status === 'approved' || b.status === 'pending')
          )
          .slice(0, 5) // Show max 5
        setUpcomingBookings(upcoming)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      fetchBookings()
    }
  }, [fetchBookings, user?.id])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchBookings()
  }, [fetchBookings])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e'
      case 'pending': return '#f59e0b'
      case 'rejected': return '#ef4444'
      case 'cancelled': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Godkjent'
      case 'pending': return 'Venter'
      case 'rejected': return 'Avslått'
      case 'cancelled': return 'Kansellert'
      default: return status
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hei, {user?.name || 'bruker'}!</Text>
            <Text style={styles.subtitle}>
              {format(new Date(), "EEEE d. MMMM", { locale: nb })}
            </Text>
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#2563eb' }]}
            onPress={() => navigation.navigate('Main', { screen: 'Facilities' } as any)}
          >
            <Ionicons name="add-circle" size={32} color="#fff" />
            <Text style={styles.actionText}>Ny booking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#7c3aed' }]}
            onPress={() => navigation.navigate('Main', { screen: 'Calendar' } as any)}
          >
            <Ionicons name="calendar" size={32} color="#fff" />
            <Text style={styles.actionText}>Kalender</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kommende bookinger</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Main', { screen: 'Bookings' } as any)}
            >
              <Text style={styles.seeAllText}>Se alle</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
          ) : upcomingBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyText}>Ingen kommende bookinger</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('Main', { screen: 'Facilities' } as any)}
              >
                <Text style={styles.emptyButtonText}>Book nå</Text>
              </TouchableOpacity>
            </View>
          ) : (
            upcomingBookings.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={styles.bookingCard}
                onPress={() => navigation.navigate('Main', { screen: 'Bookings' } as any)}
              >
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingTitle}>{booking.title}</Text>
                  <Text style={styles.bookingResource}>
                    {booking.resource?.name}
                    {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                  </Text>
                  <Text style={styles.bookingTime}>
                    {format(parseISO(booking.startTime), "EEE d. MMM, HH:mm", { locale: nb })}
                    {' - '}
                    {format(parseISO(booking.endTime), "HH:mm")}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                    {getStatusText(booking.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#1e293b',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textTransform: 'capitalize',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  seeAllText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  loader: {
    marginVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  bookingResource: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  bookingTime: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

