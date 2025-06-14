<script lang="ts">
  import { persistable } from '$lib/persistable'
  import { chroma } from 'itty-chroma'
  import { connect, type IttySocket } from 'itty-sockets'
  import { round } from 'supergeneric/round'
  import { onMount } from 'svelte'
  import { Board } from './Board'
  import Canvas from './Canvas.svelte'
  import ColorPicker from './ColorPicker.svelte'

  const errorMessage = chroma.log.red.bold
  const userColor = chroma.salmon.bold
  const timeColor = chroma.blue

  export let data
  const { x, y } = data
  const board = new Board({ x, y })
  let fetched = false
  let channel: IttySocket | undefined = undefined
  let requested: boolean = false
  let rgba = persistable('ink:rgba', { r: 0, g: 0, b: 0, a: 1 })
  let isColorPickerOpen = false
  let channelUsers: number = 0
  let horizontal = false

  $: {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.board = board
    }
  }

  onMount(() => {
    let indexChannel = connect('ink:index')
    let fetchStart: number = performance.now()

    type WelcomeMessage = { type: 'ready-to-send', uid: string }
    type RequestStateMessage = { type: 'request-state', uid: string }
    type StateMessage = { type: 'state', data: string }
    type PaintMessage = { type: 'paint', data: [number, number, number, number] }

    channel = connect(`art-tag:${x}x${y}`, { announce: true })
      .on('message', ({ message }) => console.log)
      .on<PaintMessage>('message', ({ message }) =>
        message.type === 'paint' && board.paint(...message.data, 1)
      )
      .on<StateMessage>('message', ({ message, uid }) => {
        if (message.type !== 'state') return
        chroma.log('😘 received state from', userColor, uid)
        if (!fetched) {
          const start = performance.now()
          board.import(message.data)
          fetched = true
          const end = performance.now()
          chroma.log('✅ complete board retrieval @', timeColor, `${round(end - fetchStart, 1)}ms`)
        }
      })
      .on<RequestStateMessage>('message', ({ message, uid }) => {
        if (message.type !== 'request-state') return
        chroma.log('🙏 user', userColor, uid, chroma.clear, 'requested state, sending...')
        channel?.send({ type: 'state', data: board.encode() }, uid)
      })
      .on<WelcomeMessage>('message', ({ message, uid }) => {
        if (message.type !== 'ready-to-send') return
        chroma.log('🫡', userColor, uid, chroma.clear,'is ready to send')
        if (requested) return
        requested = true // prevent duplicate requests
        // fetchStart = performance.now() // track entire round trip for state retrieval
        chroma.log('🙏 requesting state from', userColor, uid)
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
          chroma.log('😈 no other users, we control this board.')
          fetched = true
        }
      })
      .on('leave', ({ users }) => channelUsers = users)
      .on('close', () => {
        console.log('channel closed')
      })
      .on('open', () => {
        chroma.log('channel opened @', timeColor, `${round(performance.now() - fetchStart, 1)}ms`)
      })
      .on('error', (error) => {
        errorMessage('channel error', error)
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

<div class="grid" class:horizontal>
  <div class="color-picker">
    <ColorPicker bind:rgb={$rgba} bind:isOpen={isColorPickerOpen} />
  </div>
  <div class="canvas-wrapper">
    <Canvas
      board={board}
      isColorPickerOpen={isColorPickerOpen}
      rgba={$rgba}
      onPaint={(painted) => painted && channel?.send(painted)}
    />
  </div>
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
