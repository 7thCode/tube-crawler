<script lang="ts">
  import { onMount } from 'svelte'
  import type { VideoMetadata } from '../types'
  import VideoList from './components/VideoList.svelte'
  import AddVideoInput from './components/AddVideoInput.svelte'
  import './app.css'

  let videos: VideoMetadata[] = []
  let loading = false
  let error = ''
  let ytdlpInstalled = false

  onMount(async () => {
    // Check if yt-dlp is installed
    const result = await window.api.system.checkYtDlp()
    ytdlpInstalled = result.installed || false

    if (!ytdlpInstalled) {
      error = result.error || 'yt-dlp not found'
      return
    }

    // Load existing videos
    await loadVideos()
  })

  async function loadVideos() {
    loading = true
    const result = await window.api.video.getAll()
    loading = false

    if (result.success && result.videos) {
      videos = result.videos
    } else {
      error = result.error || 'Failed to load videos'
    }
  }

  async function handleAddVideo(url: string) {
    loading = true
    error = ''

    const result = await window.api.video.add(url)
    loading = false

    if (result.success && result.video) {
      videos = [...videos, result.video]
    } else {
      error = result.error || 'Failed to add video'
    }
  }

  async function handleDeleteVideo(videoId: string) {
    const result = await window.api.video.delete(videoId)

    if (result.success) {
      videos = videos.filter(v => v.id !== videoId)
    } else {
      error = result.error || 'Failed to delete video'
    }
  }
</script>

<main class="min-h-screen p-5">
  <header class="text-center mb-10 pb-5 border-b border-gray-700">
    <h1 class="text-5xl m-0 text-primary">🎬 Tube Crawler</h1>
    <p class="mt-2.5 mb-0 text-gray-500 text-sm">Prototype v0.1</p>
  </header>

  {#if !ytdlpInstalled}
    <div class="bg-red-600 text-white p-5 rounded-lg text-center max-w-xl mx-auto mt-10">
      <p class="my-2.5">⚠️ {error}</p>
      <p class="text-sm opacity-90 my-2.5">Install yt-dlp: <code class="bg-black/30 px-2 py-1 rounded font-mono">brew install yt-dlp</code></p>
    </div>
  {:else}
    <div class="max-w-4xl mx-auto">
      <AddVideoInput onAdd={handleAddVideo} disabled={loading} />

      {#if error}
        <div class="bg-red-600 text-white p-4 rounded-lg my-5">
          <p class="m-0">❌ {error}</p>
        </div>
      {/if}

      {#if loading}
        <div class="text-center p-5 text-gray-500">
          <p>⏳ Loading...</p>
        </div>
      {/if}

      <VideoList {videos} onDelete={handleDeleteVideo} />
    </div>
  {/if}
</main>

