<script lang="ts">
  import ColorPicker from 'svelte-awesome-color-picker'
  export let rgb = { r: 0, g: 0, b: 0, a: 1 } as { r: number, g: number, b: number, a: number }
  export let isOpen = false
</script>

<ColorPicker
  bind:rgb
  bind:isOpen
  --slider-width="1rem"
  />

<style lang="scss">
  :global(div.color) {
    border: 1px solid rgba(0, 0, 0, 0.5);
  }
</style>