<script lang="ts">
  import type { VideoMetadata } from '../../types'
  import VideoItem from './VideoItem.svelte'

  export let videos: VideoMetadata[]
  export let onDelete: (videoId: string) => void
</script>

<div class="mt-5">
  {#if videos.length === 0}
    <div class="text-center py-16 px-5 text-gray-600">
      <p class="text-3xl my-2.5">📹 No videos yet</p>
      <p class="text-sm text-gray-700 my-2.5">Add a YouTube URL to get started</p>
    </div>
  {:else}
    <h2 class="text-primary mb-5 text-2xl">My Videos ({videos.length})</h2>
    <div class="flex flex-col gap-3">
      {#each videos as video (video.id)}
        <VideoItem {video} {onDelete} downloadedFilePath={video.filePath} />
      {/each}
    </div>
  {/if}
</div>
