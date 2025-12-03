import { create } from "zustand"
import { persist, devtools, createJSONStorage } from "zustand/middleware"
import { immer } from "zustand/middleware/immer"
import { useShallow } from "zustand/react/shallow"

// ============================================================================
// Types & Interfaces
// ============================================================================

interface Transcript {
  id: number
  title: string
  duration: number
  audio_url: string
  video_url?: string
  transcript_url: string
  meeting_link?: string
  created_at: string
  ai_overall_score?: number | null
  participants?: any
  score?: number
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

interface TranscriptState {
  // State
  transcripts: Transcript[]
  lastFetched: number | null
  isLoading: boolean
  isSyncing: boolean
  error: string | null
}

interface TranscriptActions {
  // Actions
  setTranscripts: (data: Transcript[]) => void
  addTranscript: (transcript: Transcript) => void
  updateTranscript: (id: number, updates: Partial<Transcript>) => void
  removeTranscript: (id: number) => void
  setLoading: (loading: boolean) => void
  setSyncing: (syncing: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  reset: () => void
}

interface TranscriptSelectors {
  // Selectors
  getTranscriptById: (id: number) => Transcript | undefined
  getTranscriptsByDateRange: (from: Date, to: Date) => Transcript[]
  getAverageScore: () => number | null
  getTotalDuration: () => number
  getRecentTranscripts: (limit?: number) => Transcript[]
  searchTranscripts: (query: string) => Transcript[]
}

export type TranscriptStore = TranscriptState & TranscriptActions & TranscriptSelectors

// ============================================================================
// Initial State
// ============================================================================

const initialState: TranscriptState = {
  transcripts: [],
  lastFetched: null,
  isLoading: false,
  isSyncing: false,
  error: null,
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useTranscriptStore = create<TranscriptStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        ...initialState,

        // ====================================================================
        // Actions
        // ====================================================================

        setTranscripts: (data: Transcript[]) => {
          set((state) => {
            state.transcripts = data
            state.lastFetched = Date.now()
            state.error = null
          }, false, "setTranscripts")
        },

        addTranscript: (transcript: Transcript) => {
          set((state) => {
            const exists = state.transcripts.some((t) => t.id === transcript.id)
            if (!exists) {
              state.transcripts.unshift(transcript)
            }
          }, false, "addTranscript")
        },

        updateTranscript: (id: number, updates: Partial<Transcript>) => {
          set((state) => {
            const index = state.transcripts.findIndex((t) => t.id === id)
            if (index !== -1) {
              state.transcripts[index] = {
                ...state.transcripts[index],
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            }
          }, false, "updateTranscript")
        },

        removeTranscript: (id: number) => {
          set((state) => {
            state.transcripts = state.transcripts.filter((t) => t.id !== id)
          }, false, "removeTranscript")
        },

        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading
          }, false, "setLoading")
        },

        setSyncing: (syncing: boolean) => {
          set((state) => {
            state.isSyncing = syncing
          }, false, "setSyncing")
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error
          }, false, "setError")
        },

        clearError: () => {
          set((state) => {
            state.error = null
          }, false, "clearError")
        },

        reset: () => {
          set(initialState, false, "reset")
        },

        // ====================================================================
        // Selectors
        // ====================================================================

        getTranscriptById: (id: number) => {
          return get().transcripts.find((t) => t.id === id)
        },

        getTranscriptsByDateRange: (from: Date, to: Date) => {
          return get().transcripts.filter((transcript) => {
            if (!transcript.createdAt) return false
            const createdAt = new Date(transcript.createdAt)
            return createdAt >= from && createdAt <= to
          })
        },

        getAverageScore: () => {
          const { transcripts } = get()
          const transcriptsWithScores = transcripts.filter(
            (t) => typeof t.score === "number"
          )

          if (transcriptsWithScores.length === 0) return null

          const total = transcriptsWithScores.reduce(
            (sum, t) => sum + (t.score || 0),
            0
          )
          return total / transcriptsWithScores.length
        },

        getTotalDuration: () => {
          return get().transcripts.reduce((sum, t) => sum + (t.duration || 0), 0)
        },

        getRecentTranscripts: (limit: number = 10) => {
          const { transcripts } = get()
          return [...transcripts]
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return dateB - dateA
            })
            .slice(0, limit)
        },

        searchTranscripts: (query: string) => {
          if (!query.trim()) return get().transcripts

          const lowerQuery = query.toLowerCase()
          return get().transcripts.filter((transcript) => {
            return (
              transcript.title?.toLowerCase().includes(lowerQuery) ||
              transcript.id?.toString().includes(query)
            )
          })
        },
      })),
      {
        name: "transcript-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          transcripts: state.transcripts,
          lastFetched: state.lastFetched,
        }),
        version: 1,
        migrate: (persistedState: any, version: number) => {
          if (version === 0) {
            // Migration from version 0 to 1
            return {
              ...persistedState,
              lastFetched: null,
            }
          }
          return persistedState as TranscriptStore
        },
      }
    ),
    {
      name: "TranscriptStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
)

// ============================================================================
// Selective Subscriptions (Performance Optimization)
// Using useShallow to prevent infinite loops when returning objects
// ============================================================================

// Subscribe only to transcripts array
export const useTranscripts = () =>
  useTranscriptStore((state) => state.transcripts)

// Subscribe only to loading states
export const useTranscriptLoading = () =>
  useTranscriptStore(
    useShallow((state) => ({
      isLoading: state.isLoading,
      isSyncing: state.isSyncing,
    }))
  )

// Subscribe only to error state
export const useTranscriptError = () =>
  useTranscriptStore((state) => state.error)

// Subscribe only to sync metadata
export const useTranscriptMeta = () =>
  useTranscriptStore(
    useShallow((state) => ({
      lastFetched: state.lastFetched,
      count: state.transcripts.length,
    }))
  )

// Subscribe only to actions (stable references, no shallow needed)
export const useTranscriptActions = () =>
  useTranscriptStore(
    useShallow((state) => ({
      setTranscripts: state.setTranscripts,
      addTranscript: state.addTranscript,
      updateTranscript: state.updateTranscript,
      removeTranscript: state.removeTranscript,
      setLoading: state.setLoading,
      setSyncing: state.setSyncing,
      setError: state.setError,
      clearError: state.clearError,
      reset: state.reset,
    }))
  )

// Subscribe only to selectors
export const useTranscriptSelectors = () =>
  useTranscriptStore(
    useShallow((state) => ({
      getTranscriptById: state.getTranscriptById,
      getTranscriptsByDateRange: state.getTranscriptsByDateRange,
      getAverageScore: state.getAverageScore,
      getTotalDuration: state.getTotalDuration,
      getRecentTranscripts: state.getRecentTranscripts,
      searchTranscripts: state.searchTranscripts,
    }))
  )

// ============================================================================
// Utility Hooks
// ============================================================================

// Hook to get a single transcript by ID (memoized)
export const useTranscript = (id: number) =>
  useTranscriptStore((state) =>
    state.transcripts.find((t) => t.id === id)
  )

// Hook to check if data is stale and needs refresh
export const useIsDataStale = (maxAgeMs: number = 5 * 60 * 1000) =>
  useTranscriptStore((state) => {
    if (!state.lastFetched) return true
    return Date.now() - state.lastFetched > maxAgeMs
  })

// ============================================================================
// Export Types
// ============================================================================

export type { Transcript, TranscriptState, TranscriptActions, TranscriptSelectors }
