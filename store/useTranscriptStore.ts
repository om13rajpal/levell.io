import { create } from "zustand"

interface Transcript {
  id: number
  title: string
  duration: number
  participants?: any
  [key: string]: any
}

interface TranscriptStore {
  transcripts: Transcript[]
  setTranscripts: (data: Transcript[]) => void
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  transcripts: [],
  setTranscripts: (data) => set({ transcripts: data }),
}))