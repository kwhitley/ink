<script lang="ts">
  import { chroma } from 'itty-chroma'
  import { connect, type IttySocket } from 'itty-sockets'
  import { round } from 'supergeneric/round'
  import { onMount } from 'svelte'
  import { Board } from './Board'
  import Canvas from './Canvas.svelte'
  import ColorPicker from './ColorPicker.svelte'
  import PlayerCount from './PlayerCount.svelte'
  import Swatches from './Swatches.svelte'

  const USER_COLOR = chroma.salmon.bold
  const TIME_COLOR = chroma.blue

  // page properties
  type PageProps = { data: { x: number, y: number } }
  let { data }: PageProps = $props()
  const { x, y } = data

  // state
  let fetched = $state(false)
  let channel: IttySocket | undefined = $state(undefined)
  let requested: boolean = $state(false)
  let rgba = $state({ r: 0, g: 0, b: 0, a: 0.4 })
  let isColorPickerOpen = $state(false)
  let channelUsers: number = $state(0)
  let horizontal = $state(false)

  // create game board
  const board = new Board({ x, y })

  onMount(() => {
    let indexChannel = connect('ink:index')
    let fetchStart: number = performance.now()
    window.board = board

    type WelcomeMessage = { type: 'ready-to-send', uid: string }
    type RequestStateMessage = { type: 'request-state', uid: string }
    type StateMessage = { type: 'state', data: string }
    type PaintMessage = { type: 'paint', data: [number, number, number, number] }

    channel = connect(`https://itty.af/ink/${x}x${y}`, { announce: true })
      .on('message', ({ message }) => console.log)
      .on<PaintMessage>('message', ({ message }) =>
        message.type === 'paint' && board.paint(...message.data, 1)
      )
      .on<StateMessage>('message', ({ message, uid }) => {
        if (message.type !== 'state') return
        chroma.log('😘 received state from', USER_COLOR, uid)
        if (!fetched) {
          const start = performance.now()
          board.import(message.data)
          fetched = true
          const end = performance.now()
          chroma.log('✅ complete board retrieval @', TIME_COLOR, `${round(end - fetchStart, 1)}ms`)
        }
      })
      .on<RequestStateMessage>('message', ({ message, uid }) => {
        if (message.type !== 'request-state') return
        chroma.log('🙏 user', USER_COLOR, uid, chroma.clear, 'requested state, sending...')
        channel?.send({ type: 'state', data: board.encode() }, uid)
      })
      .on<WelcomeMessage>('message', ({ message, uid }) => {
        if (message.type !== 'ready-to-send') return
        chroma.log('🫡', USER_COLOR, uid, chroma.clear,'is ready to send')
        if (requested) return
        requested = true // prevent duplicate requests
        // fetchStart = performance.now() // track entire round trip for state retrieval
        chroma.log('🙏 requesting state from', USER_COLOR, uid)
        channel?.send({ type: 'request-state' }, uid)
      })
      .on('join', ({ uid, users }) => {
        channelUsers = users
        if (users > 1) {
          if (fetched) {
            chroma.log('👋 welcoming new user', USER_COLOR, uid)
            channel?.send({ type: 'ready-to-send' }, uid)
          }
        } else {
          chroma.log('😈 no other users, we control this board.')
          fetched = true
        }
      })
      .on('leave', ({ users }) => channelUsers = users)
      .on('close', () => {
        console.log('channel closed')
      })
      .on('open', () => {
        chroma.log('channel opened @', TIME_COLOR, `${round(performance.now() - fetchStart, 1)}ms`)
      })
      .on('error', (error) => {
        chroma.log.red.bold('channel error:', error)
      })

    let heartbeat = setInterval(() => {
      indexChannel?.send([`${x}x${y}`, channelUsers])
    }, 2000)

    return () => {
      channel?.close()
      indexChannel.close()
      clearInterval(heartbeat)
    }
  })
</script>

<!-- HEAD -->
<svelte:head>
  <title>ink : {x}x{y} ({channelUsers} players)</title>
  <meta name="description" content="An ink board for {x}x{y} cells." />
</svelte:head>

<!-- MARKUP -->
<div class="grid" class:horizontal>
  <div class="controls">
    <ColorPicker bind:rgb={rgba} bind:isOpen={isColorPickerOpen} />
    <Swatches bind:rgba={rgba} />
    <PlayerCount players={channelUsers} />
  </div>
  <div class="canvas-wrapper">
    <Canvas
      board={board}
      isColorPickerOpen={isColorPickerOpen}
      rgba={rgba}
      onPaint={(painted) => painted && channel?.send(painted)}
    />
  </div>
</div>

<!-- STYLES -->
<style>
  .grid {
    height: 100vh;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .controls {
    display: flex;
    flex-flow: row nowrap;
    gap: 1rem;
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

  @media (min-aspect-ratio: 1.05/1) {
    .grid {
      flex-direction: row-reverse;
      gap: 0;
    }

    .controls {
      margin-right: auto;
      white-space: auto;
      flex-flow: column;
      align-self: flex-start;
      justify-content: flex-start;
      flex: 0 0 7rem;
      white-space: nowrap;
    }
  }
</style>
