import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { nb } from 'date-fns/locale'
import { useAuth } from '../../context/AuthContext'
import { Booking } from '../../types'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

export default function AdminDashboardScreen() {
  const { user } = useAuth()
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchPendingBookings = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/bookings?status=pending`, {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setPendingBookings(data)
      }
    } catch (error) {
      console.error('Error fetching pending bookings:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPendingBookings()
  }, [fetchPendingBookings])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPendingBookings()
  }, [fetchPendingBookings])

  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(id)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          action, 
          statusNote: reason 
        }),
      })

      if (response.ok) {
        fetchPendingBookings()
      } else {
        Alert.alert('Feil', 'Kunne ikke utfore handlingen')
      }
    } catch (error) {
      Alert.alert('Feil', 'Noe gikk galt')
    } finally {
      setProcessingId(null)
    }
  }

  const confirmApprove = (id: string) => {
    Alert.alert(
      'Godkjenn booking',
      'Er du sikker pa at du vil godkjenne denne bookingen?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Godkjenn', onPress: () => handleAction(id, 'approve') },
      ]
    )
  }

  const confirmReject = (id: string) => {
    Alert.prompt(
      'Avslag booking',
      'Legg til en valgfri grunn for avslaget:',
      [
        { text: 'Avbryt', style: 'cancel' },
        { 
          text: 'Avslag', 
          style: 'destructive',
          onPress: (reason: string | undefined) => handleAction(id, 'reject', reason) 
        },
      ],
      'plain-text'
    )
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
            <Text style={styles.greeting}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Hei, {user?.name || 'admin'}!</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingBookings.length}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Ionicons name="time" size={24} color="#f59e0b" />
            <Text style={styles.statValue}>{pendingBookings.length}</Text>
            <Text style={styles.statLabel}>Ventende</Text>
          </View>
        </View>

        {/* Pending bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ventende bookinger</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
          ) : pendingBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.emptyText}>Ingen ventende bookinger</Text>
            </View>
          ) : (
            pendingBookings.map(booking => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingTitle}>{booking.title}</Text>
                </View>

                <Text style={styles.bookingResource}>
                  {booking.resource?.name}
                  {booking.resourcePart && ` - ${booking.resourcePart.name}`}
                </Text>

                <View style={styles.bookingDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color="#64748b" />
                    <Text style={styles.detailText}>
                      {booking.user?.name || booking.user?.email}
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#64748b" />
                    <Text style={styles.detailText}>
                      {format(parseISO(booking.startTime), "EEE d. MMM, HH:mm", { locale: nb })}
                      {' - '}
                      {format(parseISO(booking.endTime), "HH:mm")}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => confirmReject(booking.id)}
                    disabled={processingId === booking.id}
                  >
                    {processingId === booking.id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <>
                        <Ionicons name="close" size={18} color="#ef4444" />
                        <Text style={styles.rejectButtonText}>Avslag</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => confirmApprove(booking.id)}
                    disabled={processingId === booking.id}
                  >
                    {processingId === booking.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.approveButtonText}>Godkjenn</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
  },
  badge: {
    backgroundColor: '#f59e0b',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
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
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingHeader: {
    marginBottom: 8,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  bookingResource: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  bookingDetails: {
    gap: 6,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#64748b',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#fef2f2',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
})

