<script lang="ts">
  import { swatches } from './swatches.svelte.ts'

  type Color = { r: number, g: number, b: number, a: number }

  let { rgba = $bindable() } = $props()

  const handleSelect = (index: number) => {
    swatches.select(index)
    rgba = swatches.colors[index]
  }

  const isSameColor = (color1: Color, color2: Color) => {
    return color1.r === color2.r && color1.g === color2.g && color1.b === color2.b && color1.a === color2.a
  }
</script>

<!-- MARKUP -->
<div class="swatches">
  {#each swatches.colors as color, index}
    <button
      class="swatch"
      class:selected={swatches.selectedIndex === index && isSameColor(rgba, color)}
      style="--color: rgba({color.r}, {color.g}, {color.b}, {color.a})"
      onclick={() => handleSelect(index)}
      aria-label="Select color"
      >
    </button>
  {/each}
</div>

<!-- STYLES -->
<style lang="scss">
  .swatches {
    display: flex;
    flex-flow: row wrap;
    gap: 0.4rem;
    --swatch-size: 1.8rem;
  }

  .swatch {
    height: var(--swatch-size);
    width: var(--swatch-size);
    border: 1px solid #000;
    border-radius: 0.25rem;
    transition: transform 0.15s ease-in-out;
    position: relative;
    cursor: pointer;
    background: transparent;
    overflow: hidden;



    &:before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--alpha-grid-bg);
    }

    &:after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--color);
    }

    &:not(.selected) {
      transform: scale(0.9);
    }

    &:hover {
      transform: scale(1.1);
    }

    &.selected {
      // outline: 1px solid #000;
      transform: scale(1.2);
    }


    &:active {
      transform: scale(0.9);
      transition: transform 0.05s ease-out;
    }
  }
</style>