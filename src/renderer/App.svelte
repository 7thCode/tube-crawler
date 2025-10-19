<script lang="ts">
  import { onMount } from 'svelte'
  import type { VideoMetadata, YouTubeSearchResult } from '../types'
  import VideoList from './components/VideoList.svelte'
  import AddVideoInput from './components/AddVideoInput.svelte'
  import YouTubeSearchResultComponent from './components/YouTubeSearchResult.svelte'
  import VideoPlayer from './components/VideoPlayer.svelte'
  import Toast from './components/Toast.svelte'
  import './app.css'

  interface ToastMessage {
    id: number
    message: string
    type: 'success' | 'error' | 'warning'
  }

  let videos: VideoMetadata[] = []
  let loading = false
  let error = ''
  let searchQuery = ''
  let searchTimeout: number | null = null
  let youtubeResults: YouTubeSearchResult[] = []
  let searchingYouTube = false
  let toasts: ToastMessage[] = []
  let toastIdCounter = 0

  function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const id = toastIdCounter++
    toasts = [...toasts, { id, message, type }]
  }

  function removeToast(id: number) {
    toasts = toasts.filter(t => t.id !== id)
  }

  onMount(async () => {
    // Load existing videos
    await loadVideos()
  })

  async function loadVideos() {
    loading = true
    try {
      const result = await window.api.video.getAll()

      if (result.success && result.videos) {
        videos = result.videos
      } else {
        error = result.error || 'Failed to load videos'
      }
    } catch (err) {
      console.error('Error loading videos:', err)
      error = 'Failed to load videos: ' + (err instanceof Error ? err.message : String(err))
    } finally {
      loading = false
    }
  }

  function handleSearchInput() {
    // Clear previous timeout
    if (searchTimeout !== null) {
      clearTimeout(searchTimeout)
    }

    // Set new timeout for debounced search
    searchTimeout = window.setTimeout(() => {
      handleSearch()
    }, 300)
  }

  async function handleSearch() {
    console.log('Searching for:', searchQuery)

    if (searchQuery.trim() === '') {
      // Empty search, reload all videos and clear YouTube results
      youtubeResults = []
      await loadVideos()
      return
    }

    // Check if it's a YouTube URL
    const isUrl = searchQuery.trim().startsWith('http')

    if (isUrl) {
      // If URL, don't search YouTube
      youtubeResults = []
      return
    }

    // Search YouTube
    await searchYouTube()

    // Also search local videos
    loading = true
    error = ''
    try {
      const result = await window.api.video.search(searchQuery.trim())
      console.log('Local search result:', result)

      if (result.success && result.videos) {
        videos = result.videos
        console.log('Found local videos:', result.videos.length)
      } else {
        error = result.error || 'Failed to search videos'
      }
    } catch (err) {
      console.error('Error searching videos:', err)
      error = 'Failed to search videos: ' + (err instanceof Error ? err.message : String(err))
    } finally {
      loading = false
    }
  }

  async function searchYouTube() {
    searchingYouTube = true
    try {
      const result = await window.api.video.searchYouTube(searchQuery.trim())
      console.log('YouTube search result:', result)

      if (result.success && result.videos) {
        youtubeResults = result.videos
        console.log('Found YouTube videos:', result.videos.length)
      } else {
        console.error('YouTube search failed:', result.error)
        youtubeResults = []
      }
    } catch (err) {
      console.error('Error searching YouTube:', err)
      youtubeResults = []
    } finally {
      searchingYouTube = false
    }
  }

  async function handleClearSearch() {
    searchQuery = ''
    youtubeResults = []
    if (searchTimeout !== null) {
      clearTimeout(searchTimeout)
    }
    await loadVideos()
  }

  async function handleAddFromYouTube(url: string) {
    await handleAddVideo(url)
    // Reload to show the newly added video
    await loadVideos()
  }


  async function handleAddVideo(url: string) {
    loading = true
    error = ''

    try {
      const result = await window.api.video.add(url)

      if (result.success && result.video) {
        videos = [...videos, result.video]
      } else {
        error = result.error || 'Failed to add video'
      }
    } catch (err) {
      console.error('Error adding video:', err)
      error = 'Failed to add video: ' + (err instanceof Error ? err.message : String(err))
    } finally {
      loading = false
    }
  }

  async function handleDeleteVideo(videoId: string) {
    try {
      const result = await window.api.video.delete(videoId)

      if (result.success) {
        videos = videos.filter(v => v.id !== videoId)
        error = '' // Clear any previous errors
      } else {
        error = result.error || 'Failed to delete video'
      }
    } catch (err) {
      console.error('Error deleting video:', err)
      error = 'Failed to delete video: ' + (err instanceof Error ? err.message : String(err))
    }
  }
</script>

<main class="min-h-screen p-5">
  <header class="text-center mb-10 pb-5 border-b border-gray-700">
    <h1 class="text-5xl m-0 text-primary">🎬 Tube Crawler</h1>
    <p class="mt-2.5 mb-0 text-gray-500 text-sm">Prototype v0.1</p>
  </header>

  <div class="max-w-4xl mx-auto">
    <AddVideoInput onAdd={handleAddVideo} disabled={loading} />

    <!-- Search Bar -->
    <div class="my-5 flex gap-2">
      <input
        type="text"
        bind:value={searchQuery}
        on:input={handleSearchInput}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="🔍 Search YouTube or enter URL to add..."
        class="flex-1 p-3 bg-dark-100 text-white border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors"
      />
      {#if searchQuery}
        <button
          on:click={handleClearSearch}
          class="px-4 py-3 bg-gray-700 text-white border-0 rounded-lg text-sm cursor-pointer transition-all duration-200 hover:bg-gray-600"
        >
          ✕ Clear
        </button>
      {/if}
    </div>

    <!-- YouTube Search Results -->
    {#if searchingYouTube}
      <div class="text-center p-5 text-gray-500">
        <p>🔍 Searching YouTube...</p>
      </div>
    {/if}

    {#if youtubeResults.length > 0}
      <div class="mb-5">
        <h2 class="text-primary mb-3 text-xl">YouTube Results ({youtubeResults.length})</h2>
        <div class="flex flex-col gap-3">
          {#each youtubeResults as result (result.id)}
            <YouTubeSearchResultComponent {result} onAdd={handleAddFromYouTube} />
          {/each}
        </div>
      </div>
    {/if}

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

    <VideoList {videos} onDelete={handleDeleteVideo} on:toast={(e) => showToast(e.detail.message, e.detail.type)} />
  </div>
</main>

<!-- Toast Notifications -->
<div class="fixed top-5 right-5 z-[2000] flex flex-col gap-3">
  {#each toasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={() => removeToast(toast.id)}
    />
  {/each}
</div>

