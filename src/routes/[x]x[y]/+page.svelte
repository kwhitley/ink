<script lang="ts">
  import { persistable } from '$lib/persistable';
  import { chroma } from 'itty-chroma';
  import { connect, type IttySocket } from 'itty-sockets';
  import { onMount } from 'svelte';
  import { Board } from './Board';
  import ColorPicker from './ColorPicker.svelte';

  const errorMessage = chroma.log.red.bold
  const userColor = chroma.salmon.bold

  const formatSize = (size: number) => {
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`
    return `${(size / 1024 / 1024 / 1024).toFixed(1)}GB`
  }

  export let data
  let { x, y } = data
  let paintColor: [number, number, number, number] = [0, 0, 0, 1]
  let canvas: HTMLCanvasElement
  let gridCanvas: HTMLCanvasElement
  let fetched = false
  let channel: IttySocket | undefined = undefined
  let requested: boolean = false
  let rgba = persistable('ink:rgba', { r: 0, g: 0, b: 0, a: 1 })
  let isColorPickerOpen = false
  let channelUsers: number = 0
  $: ratio = x / y
  let horizontal = false

  $: board = new Board({ x, y })
  $: {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.board = board
    }
  }

  const handleMouseMove = (e: MouseEvent & TouchEvent) => {
    if (isColorPickerOpen || e.buttons !== 1) return
    const rect = canvas.getBoundingClientRect()
    const px = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
    const py = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top
    const index = board.getIndexFromCoords(px, py)

    if (index === -1) return
    const painted = board.paint(index, $rgba.r, $rgba.g, $rgba.b, $rgba.a)
    if (painted) channel?.send(painted)
  }

  const setPaintColor = (r: number, g: number, b: number, a: number = 1) => {
    paintColor = [r, g, b, a]
  }

  $: {
    if ($rgba) {
      setPaintColor($rgba.r, $rgba.g, $rgba.b, $rgba.a)
    }
  }

  const handleResize = () => {
    board.resize(window.innerWidth, window.innerHeight)
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(canvas.parentElement!)
    let indexChannel = connect('ink:index')

    board.setCanvas(canvas)
    board.setGridCanvas(gridCanvas)

    let fetchStart: number = 0

    channel = connect(`art-tag:${x}x${y}`, { announce: true })
      .on('message', ({ message }) => console.log)
      .on<{ type: 'paint', data: [number, number, number, number] }>('message', ({ message }) =>
        message.type === 'paint' && board.paint(...message.data, 1)
      )
      .on<{ type: 'state', data: string }>('message', ({ message, uid }) => {
        if (message.type !== 'state') return
        chroma.log('😘 received state from', userColor, uid)
        if (!fetched) {
          const start = performance.now()
          board.import(message.data)
          fetched = true
          const end = performance.now()
          chroma.log('✅ complete board retrieval', chroma.blue, `${Math.round((end - fetchStart) * 1000) / 1000}ms`)
        }
      })
      .on<{ type: 'request-state' }>('message', ({ message, uid }) => {
        if (message.type !== 'request-state') return
        console.log('user', uid, 'requested state, sending...')
        channel?.send({ type: 'state', data: board.encode() }, uid)
      })
      .on<{ type: 'ready-to-send' }>('message', ({ message, uid }) => {
        if (message.type !== 'ready-to-send') return
        chroma.log('🫡', userColor, uid, chroma.clear,'is ready to send')
        if (requested)  return
        chroma.log('🙏 requesting state from', userColor, uid)
        requested = true
        fetchStart = performance.now()
        channel?.send({ type: 'request-state' }, uid)
      })
      .on('join', ({ uid, users }) => {
        channelUsers = users
        if (users > 1) {
          if (fetched) {
            chroma.log('👋 welcoming new user', userColor, uid)
            channel?.send({ type: 'ready-to-send' }, uid)
          }
        } else {
          console.log('😈 no other users, we control this board.')
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
  on:resize={handleResize}
  on:mousemove={handleMouseMove}
  on:mousedown={handleMouseMove}
  />

<div class="grid" class:horizontal>
  <div class="extra" />
  <div class="color-picker">
    <ColorPicker bind:rgb={$rgba} bind:isOpen={isColorPickerOpen} />
  </div>
  <div class="canvas-wrapper">
    <canvas
      bind:this={canvas}
      on:mousemove={handleMouseMove}
      on:touchstart|preventDefault={handleMouseMove}
      on:touchmove|preventDefault={handleMouseMove}
    ></canvas>
    <canvas
      bind:this={gridCanvas}
      class="grid-layer"
    ></canvas>
  </div>
  <div class="extra" />
</div>
<div class="users" class:plural={channelUsers > 1}>
  {channelUsers}
</div>


<style>
  .grid {
    height: 100vh;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
  }

  .color-picker {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    padding: 1rem;
    flex: 0.2;
  }

  .canvas-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: auto;
    align-items: center;
    position: relative;
    flex: 5;
  }

  .canvas-wrapper canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    object-fit: contain;
  }

  .canvas-wrapper .grid-layer {
    pointer-events: none;
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
      justify-content: flex-start;
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
    border: 1px solid rgba(0, 0, 0, 0.15);
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
