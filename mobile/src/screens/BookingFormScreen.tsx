import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, addHours, setHours, setMinutes } from 'date-fns'
import { nb } from 'date-fns/locale'
import { Resource } from '../types'
import { RootStackParamList } from '../navigation/AppNavigator'
import { useAuth } from '../context/AuthContext'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

type RouteProps = RouteProp<RootStackParamList, 'BookingForm'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function BookingFormScreen() {
  const { user } = useAuth()
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<NavigationProp>()
  const { resourceId, resourcePartId } = route.params

  const [resource, setResource] = useState<Resource | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date())
  const [startTime, setStartTime] = useState(setMinutes(setHours(new Date(), 9), 0))
  const [endTime, setEndTime] = useState(setMinutes(setHours(new Date(), 10), 0))
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  // Picker visibility
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  useEffect(() => {
    fetchResource()
  }, [resourceId])

  async function fetchResource() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/resources/${resourceId}`)
      if (response.ok) {
        const data = await response.json()
        setResource(data)
      }
    } catch (error) {
      console.error('Error fetching resource:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Feil', 'Vennligst fyll inn tittel')
      return
    }

    setIsSubmitting(true)

    try {
      // Combine date with start/end times
      const startDateTime = new Date(date)
      startDateTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0)
      
      const endDateTime = new Date(date)
      endDateTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0)

      const response = await fetch(`${API_BASE_URL}/api/mobile/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          resourceId,
          resourcePartId: resourcePartId || null,
          title: title.trim(),
          description: description.trim() || undefined,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        }),
      })

      if (response.ok) {
        Alert.alert(
          'Suksess',
          resource?.requiresApproval 
            ? 'Bookingen er sendt til godkjenning'
            : 'Bookingen er registrert',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        )
      } else {
        const error = await response.json()
        Alert.alert('Feil', error.error || 'Kunne ikke opprette booking')
      }
    } catch (error) {
      Alert.alert('Feil', 'Noe gikk galt')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedPart = resourcePartId 
    ? resource?.parts.find(p => p.id === resourcePartId)
    : null

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Resource info */}
      <View style={styles.resourceInfo}>
        <Text style={styles.resourceName}>{resource?.name}</Text>
        {selectedPart && (
          <Text style={styles.partName}>{selectedPart.name}</Text>
        )}
      </View>

      {resource?.requiresApproval && (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle" size={20} color="#f59e0b" />
          <Text style={styles.warningText}>
            Denne bookingen krever godkjenning fra administrator
          </Text>
        </View>
      )}

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Tittel *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="F.eks. Fotballtrening"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Beskrivelse</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Valgfri beskrivelse..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Date picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Dato *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#64748b" />
            <Text style={styles.dateButtonText}>
              {format(date, "EEEE d. MMMM yyyy", { locale: nb })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios')
                if (selectedDate) setDate(selectedDate)
              }}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Time pickers */}
        <View style={styles.timeRow}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Fra *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartPicker(true)}
            >
              <Ionicons name="time-outline" size={20} color="#64748b" />
              <Text style={styles.dateButtonText}>
                {format(startTime, "HH:mm")}
              </Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedTime) => {
                  setShowStartPicker(Platform.OS === 'ios')
                  if (selectedTime) {
                    setStartTime(selectedTime)
                    // Auto-adjust end time
                    if (selectedTime >= endTime) {
                      setEndTime(addHours(selectedTime, 1))
                    }
                  }
                }}
                minuteInterval={15}
              />
            )}
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Til *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Ionicons name="time-outline" size={20} color="#64748b" />
              <Text style={styles.dateButtonText}>
                {format(endTime, "HH:mm")}
              </Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedTime) => {
                  setShowEndPicker(Platform.OS === 'ios')
                  if (selectedTime) setEndTime(selectedTime)
                }}
                minuteInterval={15}
              />
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Kontaktinformasjon (valgfritt)</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Navn</Text>
          <TextInput
            style={styles.input}
            value={contactName}
            onChangeText={setContactName}
            placeholder="Kontaktperson"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>E-post</Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="kontakt@eksempel.no"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Telefon</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+47 123 45 678"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
          />
        </View>
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.submitButtonText}>Send booking</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceInfo: {
    backgroundColor: '#1e293b',
    padding: 20,
  },
  resourceName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  partName: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    margin: 20,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1e293b',
    textTransform: 'capitalize',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    marginHorizontal: 20,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
})

