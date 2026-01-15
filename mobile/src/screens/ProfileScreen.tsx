import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'

export default function ProfileScreen() {
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = () => {
    Alert.alert(
      'Logg ut',
      'Er du sikker pa at du vil logge ut?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Logg ut',
          style: 'destructive',
          onPress: logout,
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#fff" />
          </View>
          <Text style={styles.name}>{user?.name || 'Bruker'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.adminText}>Administrator</Text>
            </View>
          )}
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontoinformasjon</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="mail-outline" size={20} color="#2563eb" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>E-post</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>

            {user?.phone && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="call-outline" size={20} color="#2563eb" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefon</Text>
                  <Text style={styles.infoValue}>{user.phone}</Text>
                </View>
              </View>
            )}

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="business-outline" size={20} color="#2563eb" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Organisasjon</Text>
                <Text style={styles.infoValue}>
                  {user?.organization?.name || 'Ikke tilknyttet'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Settings section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Innstillinger</Text>

          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingsRow}>
              <View style={styles.settingsIcon}>
                <Ionicons name="notifications-outline" size={20} color="#64748b" />
              </View>
              <Text style={styles.settingsText}>Varsler</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsRow}>
              <View style={styles.settingsIcon}>
                <Ionicons name="language-outline" size={20} color="#64748b" />
              </View>
              <Text style={styles.settingsText}>Sprak</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsRow}>
              <View style={styles.settingsIcon}>
                <Ionicons name="help-circle-outline" size={20} color="#64748b" />
              </View>
              <Text style={styles.settingsText}>Hjelp</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingsRow}>
              <View style={styles.settingsIcon}>
                <Ionicons name="document-text-outline" size={20} color="#64748b" />
              </View>
              <Text style={styles.settingsText}>Personvernpolicy</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logg ut</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Sportflow Booking v1.0.8</Text>
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
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#1e293b',
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#94a3b8',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  adminText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsText: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginVertical: 24,
  },
})

