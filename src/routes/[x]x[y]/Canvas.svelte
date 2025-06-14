<script lang="ts">
  import { onMount } from 'svelte'
  import { type Board } from './Board'
  import { createEventDispatcher } from 'svelte'
  import type { PaintedAction } from './Board'

  let {
    board,
    isColorPickerOpen,
    rgba,
    onPaint,
  }: {
    board: Board,
    isColorPickerOpen: boolean
    rgba: { r: number, g: number, b: number, a: number },
    onPaint?: (painted: PaintedAction) => void
  } = $props()

  let canvas: HTMLCanvasElement
  let gridCanvas: HTMLCanvasElement

  const handleResize = () => {
    board.resize(window.innerWidth, window.innerHeight)
  }

  const handleMouseMove = (e: MouseEvent & TouchEvent) => {
    if (isColorPickerOpen || e.buttons !== 1) return
    const rect = canvas.getBoundingClientRect()
    const px = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
    const py = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top
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

<section>
<canvas
  class="canvas"
  bind:this={canvas}
  on:resize={handleResize}
  on:mousemove={handleMouseMove}
  on:mousedown={handleMouseMove}
  on:touchstart|preventDefault={handleMouseMove}
  on:touchmove|preventDefault={handleMouseMove}
  >
</canvas>
<canvas class="grid-layer" bind:this={gridCanvas}></canvas>
</section>

  <!-- <canvas
      bind:this={canvas}
      on:resize={handleResize}
      on:mousemove={handleMouseMove}
      on:mousedown={handleMouseMove}
      on:touchstart|preventDefault={handleMouseMove}
      on:touchmove|preventDefault={handleMouseMove}
    ></canvas> -->

<style>
  section {
    position: relative;
  }

  canvas {
    width: 100%;
    height: 100%;
    /* background-color: #000;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1; */
  }

  .grid-layer {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
</style>