export interface VideoMetadata {
  id: string
  url: string
  title: string
  thumbnail: string
  duration: number
  channel: string
  filePath?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Electron API exposed via contextBridge
declare global {
  interface Window {
    api: {
      video: {
        add: (url: string) => Promise<{ success: boolean; video?: VideoMetadata; error?: string }>
        getAll: () => Promise<{ success: boolean; videos?: VideoMetadata[]; error?: string }>
        delete: (videoId: string) => Promise<{ success: boolean; error?: string }>
        download: (videoId: string, url: string) => Promise<{ success: boolean; filePath?: string; fileSize?: number; error?: string }>
        cancelDownload: (videoId: string) => Promise<{ success: boolean; cancelled?: boolean; error?: string }>
        onDownloadProgress: (callback: (data: { videoId: string; progress: number }) => void) => void
      }
      system: {
        checkYtDlp: () => Promise<{ success: boolean; installed?: boolean; error?: string }>
        getDownloadsPath: () => Promise<{ success: boolean; path?: string; error?: string }>
      }
    }
  }
}

export {}
