<script lang="ts">
  import type { VideoMetadata } from '../../types'
  import { onMount } from 'svelte'
  import VideoPlayer from './VideoPlayer.svelte'

  export let video: VideoMetadata
  export let onDelete: (videoId: string) => void
  export let downloadedFilePath: string | undefined = undefined

  let downloading = false
  let downloadProgress = 0
  let showPlayer = false
  let videoFilePath = ''

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function handleDownload() {
    if (downloading) return

    downloading = true
    downloadProgress = 0

    try {
      const result = await window.api.video.download(video.id, video.url)
      if (result.success) {
        alert(`Download completed: ${video.title}`)
        downloadProgress = 100
        // Update downloaded file path
        if (result.filePath) {
          downloadedFilePath = result.filePath
        }
      } else {
        alert(`Download failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Download error:', error)
      alert(`Download failed: ${error}`)
    } finally {
      downloading = false
    }
  }

  async function handlePlay() {
    if (!downloadedFilePath) {
      alert('Video not downloaded yet')
      return
    }

    // Convert file path to file:// URL
    videoFilePath = `file://${downloadedFilePath}`
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
    <h3 class="m-0 mb-2 text-base font-medium text-white overflow-hidden overflow-ellipsis whitespace-nowrap">{video.title}</h3>
    <p class="m-0 text-sm text-gray-500">
      {video.channel} • {formatDuration(video.duration)}
    </p>
  </div>

  <div class="flex gap-2 flex-shrink-0">
    {#if downloadedFilePath}
      <button
        on:click={handlePlay}
        title="Play video"
        class="px-4 py-2 border-0 rounded bg-primary text-white text-sm cursor-pointer transition-all duration-200 hover:bg-secondary hover:-translate-y-0.5"
      >
        ▶️ Play
      </button>
    {:else}
      <button
        on:click={handleDownload}
        disabled={downloading}
        title={downloading ? `Downloading... ${downloadProgress}%` : 'Download video'}
        class="px-4 py-2 border-0 rounded text-white text-sm cursor-pointer transition-all duration-200"
        class:bg-primary={!downloading}
        class:hover:bg-secondary={!downloading}
        class:hover:-translate-y-0.5={!downloading}
        class:bg-gray-600={downloading}
        class:opacity-70={downloading}
        class:cursor-not-allowed={downloading}
      >
        {#if downloading}
          ⏳ {downloadProgress}%
        {:else}
          ⬇️ Download
        {/if}
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

