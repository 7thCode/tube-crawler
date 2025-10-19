import { Innertube } from 'youtubei.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import { databaseService } from './database.service.js'
import vm from 'vm'

class DownloadService {
  private downloadsPath: string
  private activeDownloads: Map<string, AbortController> = new Map()
  private youtube: Innertube | null = null

  constructor() {
    // Use app's downloads directory
    const userDataPath = app.getPath('userData')
    this.downloadsPath = path.join(userDataPath, 'downloads')

    // Ensure directory exists
    if (!fs.existsSync(this.downloadsPath)) {
      fs.mkdirSync(this.downloadsPath, { recursive: true })
    }

    console.log('Downloads path:', this.downloadsPath)
  }

  /**
   * Initialize Youtube.js client
   */
  async initialize() {
    if (!this.youtube) {
      this.youtube = await Innertube.create({
        // Provide VM for URL deciphering
        po_token: undefined,
        visitor_data: undefined,
        generate_session_locally: true,
        eval_js: (code: string) => {
          return vm.runInNewContext(code)
        }
      })
      console.log('Youtube.js client initialized with VM evaluator')
    }
  }

  /**
   * Download video using Youtube.js
   */
  async downloadVideo(videoId: string, url: string, onProgress?: (progress: number) => void) {
    // Ensure Youtube.js is initialized
    await this.initialize()
    if (!this.youtube) {
      throw new Error('Youtube.js client not initialized')
    }

    // Check if already downloading
    if (this.activeDownloads.has(videoId)) {
      throw new Error('Video is already being downloaded')
    }

    // Update status to downloading
    databaseService.updateDownloadStatus(videoId, 'downloading', 0)

    const outputPath = path.join(this.downloadsPath, `${videoId}.mp4`)
    const abortController = new AbortController()
    this.activeDownloads.set(videoId, abortController)

    try {
      console.log('Fetching video info:', videoId)

      // Get video info
      const info = await this.youtube.getInfo(videoId)

      // Choose best format (video+audio)
      const format = info.chooseFormat({
        type: 'video+audio',
        quality: 'best'
      })

      if (!format) {
        throw new Error('No suitable video format found')
      }

      const contentLength = typeof format.content_length === 'string'
        ? parseInt(format.content_length)
        : (format.content_length || 0)

      console.log('Starting download:', videoId, 'Size:', contentLength, 'bytes')

      // Download video stream
      const stream = await info.download({
        type: 'video+audio',
        quality: 'best',
        format: 'mp4'
      })

      // Convert Web ReadableStream to Node.js Readable stream
      const reader = stream.getReader()
      const nodeStream = new Readable({
        async read() {
          try {
            const { done, value } = await reader.read()
            if (done) {
              this.push(null)
            } else {
              this.push(Buffer.from(value))
            }
          } catch (error) {
            this.destroy(error as Error)
          }
        }
      })

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath)

      // Track progress
      let downloaded = 0
      let lastProgress = 0

      nodeStream.on('data', (chunk: Buffer) => {
        downloaded += chunk.length

        if (contentLength > 0) {
          const progress = Math.floor((downloaded / contentLength) * 100)
          if (progress !== lastProgress) {
            lastProgress = progress
            databaseService.updateDownloadStatus(videoId, 'downloading', progress)
            if (onProgress) {
              onProgress(progress)
            }
          }
        }
      })

      // Handle abort signal
      abortController.signal.addEventListener('abort', () => {
        nodeStream.destroy(new Error('Download cancelled'))
        writeStream.destroy()
        // Clean up partial file
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath)
        }
      })

      // Pipe stream to file
      return new Promise<{ filePath: string; fileSize: number }>((resolve, reject) => {
        nodeStream.pipe(writeStream)

        writeStream.on('finish', () => {
          this.activeDownloads.delete(videoId)

          try {
            const stats = fs.statSync(outputPath)
            const fileSize = stats.size

            // Update database with completed download
            databaseService.updateDownloadComplete(videoId, outputPath, fileSize)

            console.log('Download completed:', videoId, fileSize, 'bytes')
            resolve({ filePath: outputPath, fileSize })
          } catch (error) {
            console.error('Error getting file stats:', error)
            databaseService.updateDownloadStatus(videoId, 'failed', 0)
            reject(new Error('Failed to get downloaded file info'))
          }
        })

        writeStream.on('error', (error) => {
          this.activeDownloads.delete(videoId)
          console.error('Write stream error:', error)
          databaseService.updateDownloadStatus(videoId, 'failed', 0)
          reject(error)
        })

        nodeStream.on('error', (error) => {
          this.activeDownloads.delete(videoId)
          console.error('Download stream error:', error)
          databaseService.updateDownloadStatus(videoId, 'failed', 0)
          reject(error)
        })
      })
    } catch (error) {
      this.activeDownloads.delete(videoId)
      console.error('Download error:', error)
      databaseService.updateDownloadStatus(videoId, 'failed', 0)
      throw error
    }
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload(videoId: string) {
    const abortController = this.activeDownloads.get(videoId)
    if (abortController) {
      abortController.abort()
      this.activeDownloads.delete(videoId)
      databaseService.updateDownloadStatus(videoId, 'pending', 0)
      console.log('Download cancelled:', videoId)
      return true
    }
    return false
  }

  /**
   * Get downloads directory path
   */
  getDownloadsPath() {
    return this.downloadsPath
  }
}

export const downloadService = new DownloadService()
