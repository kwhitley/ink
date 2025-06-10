<script lang="ts">
    import { onMount } from 'svelte'

  let {
    x,
    y,
    gridWidth = 1,
    gridColor = [128, 128, 128, 0.3],
    currentColor = [0, 0, 0, 1] as [number, number, number, number],
    splat,
    allowDraw = true,
    onPaint,
  } = $props()

  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let mouseDown = false
  let lastPaintedIndex = -1

  const isDifferent = (i: number, r: number, g: number, b: number, a: number) =>
    splat[i] !== r ||
    splat[i + 1] !== g ||
    splat[i + 2] !== b

  const handleMouseDown = (e: MouseEvent) => {
    mouseDown = true
    handleMouseMove(e)
  }

  const handleMouseUp = () => {
    mouseDown = false
    lastPaintedIndex = -1
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!mouseDown || !allowDraw) return
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const index = getIndexFromCoords(px, py)
    const i = index * 4
    if (index === lastPaintedIndex) return
    if (isDifferent(i, ...currentColor)) {
      lastPaintedIndex = index
    } else {
      return
    }
    if (index !== -1) onPaint(index)
  }


  const drawCell = (index: number) => {
    console.log('drawing cell', { index })
    const cellWidth = canvas.width / x
    const cellHeight = canvas.height / y
    const cx = index % x
    const cy = Math.floor(index / x)
    const i = index * 4
    ctx.fillStyle = `rgb(${splat[i]},${splat[i + 1]},${splat[i + 2]})`
    ctx.fillRect(cx * cellWidth, cy * cellHeight, cellWidth, cellHeight)

    if (gridWidth > 0) {
      ctx.strokeStyle = `rgba(${gridColor.join(',')})`
      ctx.lineWidth = gridWidth
      ctx.strokeRect(cx * cellWidth, cy * cellHeight, cellWidth, cellHeight)
    }
  }

  const drawAll = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < x * y; i++) drawCell(i)
  }

  const getIndexFromCoords = (px: number, py: number) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const localX = px * scaleX
    const localY = py * scaleY

    const cellWidth = canvas.width / x
    const cellHeight = canvas.height / y

    const cx = Math.floor(localX / cellWidth)
    const cy = Math.floor(localY / cellHeight)

    // Out-of-bounds check
    if (cx < 0 || cx >= x || cy < 0 || cy >= y) return -1

    return cy * x + cx
  }

  const resizeCanvas = () => {
    const container = canvas.parentElement
    if (!container) return

    const { width, height } = container.getBoundingClientRect()
    console.log('DPR:', window.devicePixelRatio)
    console.log('Canvas size:', canvas.width, canvas.height)

    const dpr = window.devicePixelRatio || 1

    const rawCellWidth = width / x
    const rawCellHeight = height / y

    const fillByWidth = rawCellWidth < rawCellHeight

    const cellSize = Math.floor(fillByWidth ? rawCellWidth : rawCellHeight)
    const displayWidth = cellSize * x
    const displayHeight = cellSize * y

    // Ensure at least one axis fills the space completely
    canvas.style.width = fillByWidth ? `${width}px` : `${displayWidth}px`
    canvas.style.height = fillByWidth ? `${displayHeight}px` : `${height}px`

    // Scale the actual canvas resolution
    canvas.width = parseFloat(canvas.style.width) * dpr
    canvas.height = parseFloat(canvas.style.height) * dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawAll()
  }

  $effect(() => {
    console.log({ ctx, splat })
    ctx && splat && drawAll()
  })

  onMount(() => {
    ctx = canvas.getContext('2d')!
    console.log({ canvas, ctx })
    const resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvas.parentElement!)
    drawAll()
  })
</script>

<canvas class="canvas" bind:this={canvas} />

<svelte:window
  on:resize={resizeCanvas}
  on:mouseup={handleMouseUp}
  on:mousemove={handleMouseMove}
  on:mousedown={handleMouseDown}
  />

<style>
  canvas {
    width: 100%;
    height: 100%;
  }
</style>