import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO, isAfter, isBefore } from 'date-fns'
import { nb } from 'date-fns/locale'
import { Booking } from '../types'
import { useAuth } from '../context/AuthContext'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

type TabType = 'upcoming' | 'history'

export default function BookingsScreen() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchBookings = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mobile/bookings?userId=${user.id}`)
      
      if (response.ok) {
        const data = await response.json()
        setBookings(data)
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

  const now = new Date()
  
  const upcomingBookings = bookings.filter(b => 
    isAfter(parseISO(b.startTime), now) && 
    (b.status === 'approved' || b.status === 'pending')
  )
  
  const historyBookings = bookings.filter(b =>
    isBefore(parseISO(b.startTime), now) ||
    b.status === 'cancelled' ||
    b.status === 'rejected'
  )

  const displayedBookings = activeTab === 'upcoming' ? upcomingBookings : historyBookings

  const handleCancel = async (id: string) => {
    Alert.alert(
      'Kanseller booking',
      'Er du sikker pa at du vil kansellere denne bookingen?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Kanseller',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id)
            try {
              const response = await fetch(`${API_BASE_URL}/api/bookings/${id}/cancel`, {
                method: 'POST',
                credentials: 'include',
              })
              
              if (response.ok) {
                fetchBookings()
              } else {
                Alert.alert('Feil', 'Kunne ikke kansellere bookingen')
              }
            } catch (error) {
              Alert.alert('Feil', 'Noe gikk galt')
            } finally {
              setCancellingId(null)
            }
          },
        },
      ]
    )
  }

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
      case 'rejected': return 'Avslatt'
      case 'cancelled': return 'Kansellert'
      default: return status
    }
  }

  const renderBooking = ({ item }: { item: Booking }) => (
    <View style={[
      styles.bookingCard,
      { borderLeftColor: getStatusColor(item.status) }
    ]}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{item.title}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) + '20' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: getStatusColor(item.status) }
          ]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.bookingResource}>
        {item.resource?.name}
        {item.resourcePart && ` - ${item.resourcePart.name}`}
      </Text>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {format(parseISO(item.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {format(parseISO(item.startTime), "HH:mm")} - {format(parseISO(item.endTime), "HH:mm")}
          </Text>
        </View>
      </View>

      {item.statusNote && (
        <View style={styles.rejectionNote}>
          <Ionicons name="information-circle" size={16} color="#ef4444" />
          <Text style={styles.rejectionText}>{item.statusNote}</Text>
        </View>
      )}

      {activeTab === 'upcoming' && item.status !== 'cancelled' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancel(item.id)}
          disabled={cancellingId === item.id}
        >
          {cancellingId === item.id ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Kanseller</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mine bookinger</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'upcoming' && styles.tabTextActive
          ]}>
            Kommende ({upcomingBookings.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'history' && styles.tabTextActive
          ]}>
            Historikk ({historyBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
      ) : (
        <FlatList
          data={displayedBookings.sort((a, b) => 
            activeTab === 'upcoming'
              ? parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
              : parseISO(b.startTime).getTime() - parseISO(a.startTime).getTime()
          )}
          renderItem={renderBooking}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' 
                  ? 'Ingen kommende bookinger' 
                  : 'Ingen tidligere bookinger'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingResource: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  bookingDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  rejectionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    gap: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
})

