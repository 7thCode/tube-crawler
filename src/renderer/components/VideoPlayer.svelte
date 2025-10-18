<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import Plyr from 'plyr'
  import 'plyr/dist/plyr.css'

  export let videoPath: string
  export let title: string
  export let onClose: () => void

  let videoElement: HTMLVideoElement
  let player: Plyr | null = null

  onMount(() => {
    if (videoElement) {
      player = new Plyr(videoElement, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'fullscreen'
        ],
        settings: ['quality', 'speed'],
        keyboard: { focused: true, global: true }
      })

      // Handle escape key to close player
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyPress)

      return () => {
        window.removeEventListener('keydown', handleKeyPress)
      }
    }
  })

  onDestroy(() => {
    if (player) {
      player.destroy()
    }
  })
</script>

<div class="fixed inset-0 bg-black/95 flex items-center justify-center z-[1000] p-5" on:click={onClose}>
  <div class="w-full max-w-5xl bg-dark-300 rounded-xl overflow-hidden shadow-2xl" on:click|stopPropagation>
    <div class="flex justify-between items-center px-5 py-4 bg-dark-100 border-b border-gray-700">
      <h2 class="m-0 text-xl font-medium text-white overflow-hidden overflow-ellipsis whitespace-nowrap flex-1 pr-5">{title}</h2>
      <button on:click={onClose} class="bg-transparent border-0 text-gray-500 text-2xl cursor-pointer px-3 py-1 rounded transition-all duration-200 leading-none hover:bg-gray-700 hover:text-white">✕</button>
    </div>

    <div class="relative pt-[56.25%] bg-black">
      <video
        bind:this={videoElement}
        controls
        playsinline
        class="absolute top-0 left-0 w-full h-full"
      >
        <source src={videoPath} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
</div>

<style>
  /* Plyr custom styling */
  :global(.plyr) {
    --plyr-color-main: #1db954;
  }

  :global(.plyr--video) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>
