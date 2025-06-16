<script lang="ts">
  import { onMount } from 'svelte';
  import type { PaintedAction } from './Board';
  import { type Board } from './Board';

  type Props = {
    board: Board,
    isColorPickerOpen: boolean
    rgba: { r: number, g: number, b: number, a: number },
    onPaint?: (painted: PaintedAction) => void
    loaded?: boolean
    height?: number
    width?: number
  }

  let { board, isColorPickerOpen, rgba, onPaint, loaded, height, width }: Props = $props()
  let isLoaded = $state(loaded ?? false)

  let canvas: HTMLCanvasElement
  let gridCanvas: HTMLCanvasElement

  const handleResize = () => {
    isLoaded = true
    board.resize(width ?? window.innerWidth, height ?? window.innerHeight)
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (isColorPickerOpen || (e as MouseEvent).buttons !== 1 && !(e instanceof TouchEvent)) return
    const rect = canvas.getBoundingClientRect()
    const px = ((e as TouchEvent).touches?.[0]?.clientX ?? (e as MouseEvent).clientX) - rect.left
    const py = ((e as TouchEvent).touches?.[0]?.clientY ?? (e as MouseEvent).clientY) - rect.top
    const index = board.getIndexFromCoords(px, py)

    if (index === -1) return

    const painted = board.paint(index, rgba.r, rgba.g, rgba.b, rgba.a)
    if (painted) onPaint?.(painted)
  }

  onMount(() => {
    board.setCanvas(canvas)
    board.setGridCanvas(gridCanvas)

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(canvas.parentElement!)
  })
</script>

<!-- MARKUP -->
<svelte:window on:resize={handleResize} />

<section>
  <canvas
    class="canvas"
    class:isLoaded
    bind:this={canvas}
    onmousemove={handleMouseMove}
    onmousedown={handleMouseMove}
    ontouchstart={handleMouseMove}
    ontouchmove={handleMouseMove}
    >
  </canvas>
  <canvas
    class="grid-layer"
    class:isLoaded
    bind:this={gridCanvas}>
  </canvas>

  <p class="loading" class:isLoaded>
    loading ink...
  </p>
</section>

<!-- STYLES -->
<style lang="scss">
  section {
    position: relative;
  }

  canvas {
    width: 100%;
    height: 100%;
    opacity: 0;

    &.isLoaded {
      opacity: 1;
    }
  }

  .grid-layer {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  p.loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0.1;
    font-size: 3rem;
    font-weight: 200;
    letter-spacing: -0.04em;
    z-index: 1;
    pointer-events: none;
    transition: opacity 0.3s ease-in-out;

    &.isLoaded {
      opacity: 0;
    }
  }
</style>