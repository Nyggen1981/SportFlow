import * as SecureStore from 'expo-secure-store'
import { ApiError, Booking, BookingFormData, Resource, User } from '../types'

// Base URL for the API - change this to your production URL
// Using production URL for testing (change back for local development)
const API_BASE_URL = 'https://arena-booking.vercel.app'

class ApiClient {
  private token: string | null = null

  async init() {
    this.token = await SecureStore.getItemAsync('auth_token')
  }

  async setToken(token: string) {
    this.token = token
    await SecureStore.setItemAsync('auth_token', token)
  }

  async clearToken() {
    this.token = null
    await SecureStore.deleteItemAsync('auth_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Network error',
      }))
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<{ user: User }> {
    // Using NextAuth credentials provider
    const response = await fetch(`${API_BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    
    if (!response.ok) {
      throw new Error('Ugyldig e-post eller passord')
    }

    return response.json()
  }

  async getSession(): Promise<{ user: User } | null> {
    try {
      return await this.request<{ user: User }>('/api/auth/session')
    } catch {
      return null
    }
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/signout', { method: 'POST' })
    await this.clearToken()
  }

  // Resources endpoints
  async getResources(): Promise<Resource[]> {
    return this.request<Resource[]>('/api/resources')
  }

  async getResource(id: string): Promise<Resource> {
    return this.request<Resource>(`/api/resources/${id}`)
  }

  // Bookings endpoints
  async getMyBookings(): Promise<Booking[]> {
    return this.request<Booking[]>('/api/bookings')
  }

  async createBooking(data: BookingFormData): Promise<{ bookings: Booking[]; count: number }> {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        startTime: data.startTime.toISOString(),
        endTime: data.endTime.toISOString(),
        recurringEndDate: data.recurringEndDate?.toISOString(),
      }),
    })
  }

  async cancelBooking(id: string, reason?: string): Promise<void> {
    await this.request(`/api/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  // Admin endpoints
  async getPendingBookings(): Promise<Booking[]> {
    return this.request<Booking[]>('/api/admin/bookings?status=pending')
  }

  async getAllBookings(): Promise<Booking[]> {
    return this.request<Booking[]>('/api/admin/bookings')
  }

  async getPendingCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/api/admin/bookings/pending-count')
  }

  async approveBooking(id: string, applyToAll?: boolean): Promise<void> {
    await this.request(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve', applyToAll }),
    })
  }

  async rejectBooking(id: string, reason?: string, applyToAll?: boolean): Promise<void> {
    await this.request(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject', statusNote: reason, applyToAll }),
    })
  }

  // Calendar/Timeline
  async getCalendarBookings(startDate: string, endDate: string): Promise<Booking[]> {
    return this.request<Booking[]>(`/api/calendar?start=${startDate}&end=${endDate}`)
  }

  async getTimelineData(date: string): Promise<{ bookings: Booking[]; resources: Resource[] }> {
    return this.request(`/api/timeline?date=${date}`)
  }
}

export const api = new ApiClient()

