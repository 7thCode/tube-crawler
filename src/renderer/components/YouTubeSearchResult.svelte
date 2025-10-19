<script lang="ts">
  import type { YouTubeSearchResult } from '../../types'

  export let result: YouTubeSearchResult
  export let onAdd: (url: string) => void

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function handleAdd() {
    onAdd(result.url)
  }
</script>

<div class="flex items-center gap-4 p-3 bg-dark-100 rounded-lg transition-colors duration-200 hover:bg-dark-200/50">
  <div class="flex-shrink-0 w-40 h-24 rounded overflow-hidden bg-gray-700">
    {#if result.thumbnail}
      <img src={result.thumbnail} alt={result.title} class="w-full h-full object-cover" />
    {:else}
      <div class="w-full h-full flex items-center justify-center text-3xl">📹</div>
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    <h3 class="m-0 mb-1 text-base font-medium text-white overflow-hidden overflow-ellipsis whitespace-nowrap">{result.title}</h3>
    <p class="m-0 mb-1 text-sm text-gray-500">
      {result.channel} • {formatDuration(result.duration)}
    </p>
    {#if result.viewCount || result.publishedDate}
      <p class="m-0 text-xs text-gray-600">
        {#if result.viewCount}{result.viewCount}{/if}
        {#if result.viewCount && result.publishedDate} • {/if}
        {#if result.publishedDate}{result.publishedDate}{/if}
      </p>
    {/if}
  </div>

  <div class="flex gap-2 flex-shrink-0">
    <button
      on:click={handleAdd}
      class="px-4 py-2 bg-primary text-white border-0 rounded text-sm cursor-pointer transition-all duration-200 hover:bg-secondary hover:-translate-y-0.5"
      title="Add to library"
    >
      + Add to Library
    </button>
  </div>
</div>
