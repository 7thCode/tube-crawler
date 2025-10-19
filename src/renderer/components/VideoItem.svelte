<script lang="ts">
  import type { VideoMetadata } from '../../types'
  import { onMount, createEventDispatcher } from 'svelte'
  import VideoPlayer from './VideoPlayer.svelte'

  export let video: VideoMetadata
  export let onDelete: (videoId: string) => void
  export let downloadedFilePath: string | undefined = undefined

  const dispatch = createEventDispatcher()

  let downloading = false
  let downloadProgress = video.downloadProgress || 0
  let showPlayer = false
  let videoFilePath = ''

  // Sync with video prop
  $: downloadStatus = video.downloadStatus || 'pending'
  $: if (video.downloadProgress !== undefined) {
    downloadProgress = video.downloadProgress
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatFileSize(bytes: number | undefined): string {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  async function handleDownload() {
    if (downloading) return

    downloading = true
    downloadProgress = 0

    try {
      const result = await window.api.video.download(video.id, video.url)
      if (result.success) {
        dispatch('toast', { message: `Download completed: ${video.title}`, type: 'success' })
        downloadProgress = 100
        // Update downloaded file path
        if (result.filePath) {
          downloadedFilePath = result.filePath
        }
      } else {
        dispatch('toast', { message: `Download failed: ${result.error}`, type: 'error' })
      }
    } catch (error) {
      console.error('Download error:', error)
      dispatch('toast', { message: `Download failed: ${error}`, type: 'error' })
    } finally {
      downloading = false
    }
  }

  async function handlePlay() {
    const filePath = video.filePath || downloadedFilePath
    if (!filePath) {
      dispatch('toast', { message: 'Video not downloaded yet', type: 'warning' })
      return
    }

    // Convert file path to file:// URL
    videoFilePath = `file://${filePath}`
    showPlayer = true
  }

  function handleClosePlayer() {
    showPlayer = false
    videoFilePath = ''
  }

  function handleDelete() {
    if (confirm(`Delete "${video.title}"?`)) {
      onDelete(video.id)
    }
  }

  onMount(() => {
    // Listen for download progress updates
    window.api.video.onDownloadProgress((data) => {
      if (data.videoId === video.id) {
        downloadProgress = data.progress
      }
    })
  })
</script>

<div class="relative flex items-center gap-4 p-3 bg-dark-100 rounded-lg transition-colors duration-200 hover:bg-dark-200/50">
  <div class="flex-shrink-0 w-32 h-18 rounded overflow-hidden bg-gray-700">
    {#if video.thumbnail}
      <img src={video.thumbnail} alt={video.title} class="w-full h-full object-cover" />
    {:else}
      <div class="w-full h-full flex items-center justify-center text-3xl">📹</div>
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2 mb-2">
      <h3 class="m-0 text-base font-medium text-white overflow-hidden overflow-ellipsis whitespace-nowrap flex-1">{video.title}</h3>
      {#if downloadStatus === 'pending'}
        <span class="px-2 py-1 text-xs rounded bg-blue-600/30 text-blue-400 border border-blue-500/50 flex-shrink-0">🔵 Pending</span>
      {:else if downloadStatus === 'downloading'}
        <span class="px-2 py-1 text-xs rounded bg-yellow-600/30 text-yellow-400 border border-yellow-500/50 flex-shrink-0">🟡 {downloadProgress}%</span>
      {:else if downloadStatus === 'completed'}
        <span class="px-2 py-1 text-xs rounded bg-green-600/30 text-green-400 border border-green-500/50 flex-shrink-0">🟢 {formatFileSize(video.fileSize)}</span>
      {:else if downloadStatus === 'failed'}
        <span class="px-2 py-1 text-xs rounded bg-red-600/30 text-red-400 border border-red-500/50 flex-shrink-0">🔴 Failed</span>
      {/if}
    </div>
    <p class="m-0 text-sm text-gray-500">
      {video.channel} • {formatDuration(video.duration)}
    </p>
  </div>

  <div class="flex gap-2 flex-shrink-0">
    {#if downloadStatus === 'completed' && (video.filePath || downloadedFilePath)}
      <button
        on:click={handlePlay}
        title="Play video"
        class="px-4 py-2 border-0 rounded bg-primary text-white text-sm cursor-pointer transition-all duration-200 hover:bg-secondary hover:-translate-y-0.5"
      >
        ▶️ Play
      </button>
    {:else if downloadStatus === 'failed'}
      <button
        on:click={handleDownload}
        title="Retry download"
        class="px-4 py-2 border-0 rounded bg-orange-600 text-white text-sm cursor-pointer transition-all duration-200 hover:bg-orange-500 hover:-translate-y-0.5"
      >
        🔄 Retry
      </button>
    {:else if downloadStatus === 'downloading'}
      <button
        disabled
        title="Downloading... {downloadProgress}%"
        class="px-4 py-2 border-0 rounded bg-gray-600 text-white text-sm opacity-70 cursor-not-allowed"
      >
        ⏳ {downloadProgress}%
      </button>
    {:else}
      <button
        on:click={handleDownload}
        title="Download video"
        class="px-4 py-2 border-0 rounded bg-primary text-white text-sm cursor-pointer transition-all duration-200 hover:bg-secondary hover:-translate-y-0.5"
      >
        ⬇️ Download
      </button>
    {/if}
    <button
      on:click={handleDelete}
      class="px-3 py-2 bg-red-600 text-white border-0 rounded text-sm cursor-pointer transition-all duration-200 hover:bg-red-500 hover:-translate-y-0.5"
    >
      🗑️
    </button>
  </div>

  {#if downloading}
    <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700 rounded-b-lg overflow-hidden">
      <div class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-out" style="width: {downloadProgress}%"></div>
    </div>
  {/if}
</div>

{#if showPlayer && videoFilePath}
  <VideoPlayer
    videoPath={videoFilePath}
    title={video.title}
    onClose={handleClosePlayer}
  />
{/if}

