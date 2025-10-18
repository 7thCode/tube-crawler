import { exec } from 'child_process'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { databaseService } from './database.service.js'

class DownloadService {
  private downloadsPath: string
  private activeDownloads: Map<string, any> = new Map()

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

  async downloadVideo(videoId: string, url: string, onProgress?: (progress: number) => void) {
    // Check if already downloading
    if (this.activeDownloads.has(videoId)) {
      throw new Error('Video is already being downloaded')
    }

    // Update status to downloading
    databaseService.updateDownloadStatus(videoId, 'downloading', 0)

    const outputPath = path.join(this.downloadsPath, `${videoId}.mp4`)
    const outputTemplate = path.join(this.downloadsPath, `${videoId}.%(ext)s`)

    return new Promise<{ filePath: string; fileSize: number }>((resolve, reject) => {
      // Download best quality video with audio
      const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" --no-warnings --newline "${url}"`

      console.log('Starting download:', videoId)

      const process = exec(command)
      this.activeDownloads.set(videoId, process)

      let lastProgress = 0

      process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()

        // Parse progress from yt-dlp output
        // Format: [download]  12.3% of 45.67MiB at 1.23MiB/s ETA 00:12
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/)
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1])
          if (progress !== lastProgress) {
            lastProgress = progress
            databaseService.updateDownloadStatus(videoId, 'downloading', Math.floor(progress))
            if (onProgress) {
              onProgress(Math.floor(progress))
            }
          }
        }
      })

      process.stderr?.on('data', (data: Buffer) => {
        console.error('Download error output:', data.toString())
      })

      process.on('exit', (code) => {
        this.activeDownloads.delete(videoId)

        if (code === 0) {
          // Get file info
          try {
            const stats = fs.statSync(outputPath)
            const fileSize = stats.size

            // Update database with completed download
            databaseService.updateDownloadComplete(videoId, outputPath, fileSize)

            console.log('Download completed:', videoId)
            resolve({ filePath: outputPath, fileSize })
          } catch (error) {
            console.error('Error getting file stats:', error)
            databaseService.updateDownloadStatus(videoId, 'failed', 0)
            reject(new Error('Failed to get downloaded file info'))
          }
        } else {
          console.error('Download failed with code:', code)
          databaseService.updateDownloadStatus(videoId, 'failed', 0)
          reject(new Error(`Download failed with exit code: ${code}`))
        }
      })

      process.on('error', (error) => {
        this.activeDownloads.delete(videoId)
        console.error('Download process error:', error)
        databaseService.updateDownloadStatus(videoId, 'failed', 0)
        reject(error)
      })
    })
  }

  cancelDownload(videoId: string) {
    const process = this.activeDownloads.get(videoId)
    if (process) {
      process.kill()
      this.activeDownloads.delete(videoId)
      databaseService.updateDownloadStatus(videoId, 'pending', 0)
      console.log('Download cancelled:', videoId)
      return true
    }
    return false
  }

  getDownloadsPath() {
    return this.downloadsPath
  }
}

export const downloadService = new DownloadService()
