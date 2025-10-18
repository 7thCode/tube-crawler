<script lang="ts">
  export let onAdd: (url: string) => void
  export let disabled = false

  let url = ''

  function handleSubmit() {
    if (!url.trim()) return

    onAdd(url.trim())
    url = '' // Clear input after adding
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit()
    }
  }

  $: isValidUrl = url.trim().includes('youtube.com') || url.trim().includes('youtu.be')
</script>

<div class="mb-8 p-5 bg-dark-100 rounded-lg">
  <label for="url-input" class="block mb-2.5 text-lg text-primary">📎 Add YouTube URL:</label>
  <div class="flex gap-2.5">
    <input
      id="url-input"
      type="text"
      placeholder="https://www.youtube.com/watch?v=..."
      bind:value={url}
      on:keydown={handleKeyDown}
      disabled={disabled}
      class="flex-1 px-4 py-3 bg-dark-200 border-2 border-gray-700 rounded-md text-white text-base transition-colors duration-200 focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
    />
    <button
      on:click={handleSubmit}
      disabled={disabled || !isValidUrl}
      class="px-6 py-3 border-0 rounded-md text-base font-semibold cursor-pointer transition-all duration-200 min-w-[100px]"
      class:bg-gray-700={!isValidUrl || disabled}
      class:text-gray-500={!isValidUrl || disabled}
      class:bg-primary={isValidUrl && !disabled}
      class:text-white={isValidUrl && !disabled}
      class:hover:bg-secondary={isValidUrl && !disabled}
      class:hover:-translate-y-0.5={isValidUrl && !disabled}
      class:opacity-50={disabled}
      class:cursor-not-allowed={disabled}
    >
      Add
    </button>
  </div>
</div>
