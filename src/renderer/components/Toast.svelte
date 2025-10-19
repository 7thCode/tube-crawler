<script lang="ts">
  import { onMount } from 'svelte'

  export let message: string
  export let type: 'success' | 'error' | 'warning' = 'success'
  export let duration: number = 3000
  export let onClose: () => void

  let visible = false

  onMount(() => {
    // Trigger animation
    setTimeout(() => {
      visible = true
    }, 10)

    // Auto close
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  })

  function handleClose() {
    visible = false
    setTimeout(() => {
      onClose()
    }, 300) // Wait for animation
  }

  const typeStyles = {
    success: 'bg-green-600 border-green-500',
    error: 'bg-red-600 border-red-500',
    warning: 'bg-yellow-600 border-yellow-500'
  }

  const typeIcons = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }
</script>

<div
  class="max-w-md transition-all duration-300 transform"
  class:translate-x-0={visible}
  class:opacity-100={visible}
  class:translate-x-[120%]={!visible}
  class:opacity-0={!visible}
>
  <div class="flex items-center gap-3 px-5 py-4 rounded-lg shadow-2xl border-l-4 {typeStyles[type]}">
    <span class="text-2xl flex-shrink-0">{typeIcons[type]}</span>
    <p class="m-0 text-white flex-1 text-sm leading-relaxed">{message}</p>
    <button
      on:click={handleClose}
      class="bg-transparent border-0 text-white/70 text-xl cursor-pointer px-2 py-0 rounded transition-colors duration-200 leading-none hover:text-white hover:bg-white/10"
      aria-label="Close"
    >
      ✕
    </button>
  </div>
</div>
