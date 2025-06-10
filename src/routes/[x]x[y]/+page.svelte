<script lang="ts">
  import { chroma } from 'itty-chroma'
  import { connect, type IttySocket } from 'itty-sockets'
  import { onMount } from 'svelte'
  import ColorPicker from './ColorPicker.svelte'
  import { persistable } from '$lib/persistable'

  const errorMessage = chroma.log.red.bold

  export let data
  let { x, y } = data
  let stretch = true
  let grid = 1
  let gridColor = [128, 128, 128, 0.3]
  let lastWidth = 0
  let lastHeight = 0
  let mouseDown = false
  let paintColor: [number, number, number, number] = [0, 0, 0, 1]
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let colors = new Uint8ClampedArray(x * y * 4)
  let fetched = false
  let channel: IttySocket | undefined = undefined
  let requested: boolean = false
  let rgb = persistable('ink:rgb', { r: 0, g: 0, b: 0, a: 1 })
  let isColorPickerOpen = false
  let lastPaintedIndex = -1
  let channelUsers: number = 0
  $: ratio = x / y
  let horizontal = false

  const isDifferent = (i: number, r: number, g: number, b: number, a: number) =>
    colors[i] !== r ||
    colors[i + 1] !== g ||
    colors[i + 2] !== b

  const handleMouseMove = (e: MouseEvent) => {
    if (!mouseDown || isColorPickerOpen) return
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const index = getIndexFromCoords(px, py)
    if (index !== -1) paint(index)
  }

  const handleMouseDown = (e: MouseEvent) => {
    mouseDown = true
    handleMouseMove(e)
  }

  const handleMouseUp = () => {
    mouseDown = false
    lastPaintedIndex = -1
  }

  const encodeCanvas = () => {
    const rgb = new Uint8Array(x * y * 3)
    for (let i = 0, j = 0; i < colors.length; i += 4) {
      rgb[j++] = colors[i]
      rgb[j++] = colors[i + 1]
      rgb[j++] = colors[i + 2]
    }
    return btoa(String.fromCharCode(...rgb))
  }

  const setPaintColor = (r: number, g: number, b: number, a: number = 1) => {
    paintColor = [r, g, b, a]
  }

  $: {
    if (rgb) {
      setPaintColor(rgb.r, rgb.g, rgb.b, rgb.a)
    }
  }

  const decodeCanvas = (base64: string) => {
    const bin = atob(base64)
    for (let i = 0, j = 0; j < bin.length; i += 4, j += 3) {
      colors[i] = bin.charCodeAt(j)
      colors[i + 1] = bin.charCodeAt(j + 1)
      colors[i + 2] = bin.charCodeAt(j + 2)
      colors[i + 3] = 255
    }
    drawAll()
  }

  $: paint = (index: number, r: number = $rgb.r, g: number = $rgb.g, b: number = $rgb.b, a: number = $rgb.a, skipSend: boolean = false) => {
    const i = index * 4
    if (index === lastPaintedIndex) return
    if (isDifferent(i, r, g, b, a)) {
      lastPaintedIndex = index
    } else {
      return
    }

    if (a < 1) {
      // Alpha blend: new over old
      const oldR = colors[i]
      const oldG = colors[i + 1]
      const oldB = colors[i + 2]

      colors[i]     = Math.round(r * a + oldR * (1 - a))
      colors[i + 1] = Math.round(g * a + oldG * (1 - a))
      colors[i + 2] = Math.round(b * a + oldB * (1 - a))
    } else {
      colors[i]     = r
      colors[i + 1] = g
      colors[i + 2] = b
    }

    colors[i + 3] = 255
    drawCell(index)

    if (!skipSend) {
      channel?.send({ type: 'paint', data: [index, colors[i], colors[i + 1], colors[i + 2]] })
    }
  }

  const drawCell = (index: number) => {
    const cellWidth = canvas.width / x
    const cellHeight = canvas.height / y
    const cx = index % x
    const cy = Math.floor(index / x)
    const i = index * 4
    ctx.fillStyle = `rgb(${colors[i]},${colors[i + 1]},${colors[i + 2]})`
    ctx.fillRect(cx * cellWidth, cy * cellHeight, cellWidth, cellHeight)

    if (grid > 0) {
      ctx.strokeStyle = `rgba(${gridColor.join(',')})`
      ctx.lineWidth = grid
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
    if (!canvas) return
    const container = canvas.parentElement
    horizontal = window.innerWidth / window.innerHeight > ratio
    if (!container) return

    const { width, height } = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    const rawCellWidth = width / x
    const rawCellHeight = height / y

    const fillByWidth = rawCellWidth < rawCellHeight

    const cellSize = Math.floor(fillByWidth ? rawCellWidth : rawCellHeight)
    const displayWidth = cellSize * x
    const displayHeight = cellSize * y

    // Ensure at least one axis fills the space completely
    // canvas.style.width = fillByWidth ? `${width}px` : `${displayWidth}px`
    // canvas.style.height = fillByWidth ? `${displayHeight}px` : `${height}px`

    // // Scale the actual canvas resolution
    // canvas.width = parseFloat(canvas.style.width) * dpr
    // canvas.height = parseFloat(canvas.style.height) * dpr

    // ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
    canvas.width = Math.floor(displayWidth * dpr)
    canvas.height = Math.floor(displayHeight * dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    drawAll()
  }



  onMount(() => {
    ctx = canvas.getContext('2d')!
    colors.fill(255) // all white
    // requestAnimationFrame(() => resizeCanvas())
    const resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvas.parentElement!)
    let indexChannel = connect('ink:index')

    channel = connect(`art-tag:${x}x${y}`, { announce: true })
      .on<{ type: 'paint', data: [number, number, number, number] }>('message', ({ message }) =>
        message.type === 'paint' && paint(...message.data, 1, true)
      )
      .on<{ type: 'state', data: string }>('message', ({ message, uid }) => {
        if (message.type !== 'state') return
        console.log('received state from', uid)
        if (!fetched) {
          console.log('decoding & applying state')
          decodeCanvas(message.data)
          fetched = true
        }
      })
      .on<{ type: 'request-state' }>('message', ({ message, uid }) => {
        if (message.type !== 'request-state') return
        console.log('user', uid, 'requested state, sending...')
        channel?.send({ type: 'state', data: encodeCanvas() }, uid)
      })
      .on<{ type: 'ready-to-send' }>('message', ({ message, uid }) => {
        if (message.type !== 'ready-to-send') return
        console.log('user', uid, 'is ready to send')
        if (requested)  return
        console.log('requesting state from', uid)
        requested = true
        channel?.send({ type: 'request-state' }, uid)
      })
      .on('join', ({ uid, users }) => {
        channelUsers = users
        if (users > 1) {
          if (fetched) {
            console.log('user', uid, 'joined... sending welcome message.')
            channel?.send({ type: 'ready-to-send' }, uid)
          }
        } else {
          console.log('no other users... our state is the source of truth.')
          fetched = true
        }
      })
      .on('leave', ({ users }) => channelUsers = users)
      .on('close', () => {
        console.log('channel closed')
      })
      .on('error', (error) => {
        errorMessage('channel error', error)
      })

    if (typeof window !== 'undefined')
      // @ts-ignore
      window.setColor = setPaintColor

    let heartbeat = setInterval(() => {
      indexChannel?.send([`${x}x${y}`, channelUsers])
    }, 500)

    return () => {
      channel?.close()
      indexChannel.close()
      clearInterval(heartbeat)
    }
  })
</script>

<svelte:window
  on:resize={resizeCanvas}
  on:mouseup={handleMouseUp}
  on:mousemove={handleMouseMove}
  on:mousedown={handleMouseDown}
  />

<div class="grid" class:horizontal>
  <div class="extra" />
  <div class="color-picker">
    <ColorPicker bind:rgb={$rgb} bind:isOpen={isColorPickerOpen} />
  </div>
  <div class="canvas-wrapper">
    <canvas
      bind:this={canvas}
      on:mousemove={handleMouseMove}
      on:touchstart|preventDefault={handleMouseMove}
      on:touchmove|preventDefault={handleMouseMove}
      on:touchend|preventDefault={handleMouseUp}
      />
  </div>
  <div class="extra" />
</div>
<div class="users" class:plural={channelUsers > 1}>
  {channelUsers}
</div>


<style>
  .grid {
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    /* align-items: center; */
    /* justify-content: center; */
    gap: 1rem;
    flex-wrap: wrap;
  }

  .extra {}

  .color-picker {
    display: flex;
    /* height: 7rem; */
    /* flex: 0 7rem; */
    justify-content: center;
    align-items: flex-end;
    padding: 1rem;
    flex: 0.2;
    /* min-height: 7rem; */
  }

  .canvas-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: auto;
    align-items: center;
    flex: 5;
    /* margin: auto 0; */
  }

  .canvas-wrapper canvas {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;

    margin-bottom: auto;
  }

  @media (min-aspect-ratio: 1.05/1) {
    .grid {
      flex-direction: row-reverse;
      gap: 0;
    }

    .color-picker {
      margin-right: auto;
      white-space: auto;
      align-self: flex-start;
      /* align-items: flex-start; */
      justify-content: flex-start;
      /* padding: 1rem; */
      /* padding-right: 9rem; */
      flex: 0 0 7rem;
      white-space: nowrap;
    }

    canvas {
      margin-left: auto;
      margin-right: auto;
      margin-left: auto;
    }
  }

  .grid canvas {
    display: block;
    width: 100%;
    height: 100%;
    border: 1px solid rgba(0, 0, 0, 0.2);
  }

  .users {
    position: absolute;
    right: 0;
    bottom: 0;
    padding: 1rem;
    font-size: 3rem;
    opacity: 0.15;
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
    line-height: 0.8em;
    pointer-events: none;

    &:after {
      content: 'player';
      display: block;
      font-size: 0.3em;
      line-height: 1;
    }

    &.plural:after {
      content: 'players';
    }
  }


</style>
