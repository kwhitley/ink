<script lang="ts">
  import { CHANNEL_PREFIX } from '$lib/const'
  import { chroma } from 'itty-chroma'
  import { connect, type IttySocket } from 'itty-sockets'
  import { round } from 'supergeneric/round'
  import { onMount } from 'svelte'
  import { Board } from './Board'
  import Canvas from './Canvas.svelte'
  import ColorPicker from './ColorPicker.svelte'
  import PlayerCount from './PlayerCount.svelte'
  import SavedBoards from './SavedBoards.svelte'
  import Swatches from './Swatches.svelte'
  import RangeSlider from 'svelte-range-slider-pips'

  const USER_COLOR = chroma.salmon.bold
  const TIME_COLOR = chroma.blue

  // page properties
  type PageProps = { data: { x: number, y: number } }
  let { data }: PageProps = $props()
  const { x, y } = data

  type RGB = { r: number, g: number, b: number }
  type RGBA = RGB & { a: number }

  // state
  let fetched = $state(false)
  let channel: IttySocket | undefined = $state(undefined)
  let requested: boolean = $state(false)
  let isColorPickerOpen = $state(false)
  let players: number = $state(0)
  let horizontal = $state(false)
  let rgba = $state<RGBA>({ r: 0, g: 0, b: 0, a: 0.4 })
  let alpha = $state(0.4)
  let isOwner = $state(false)
  let spectateMode = $state(false)
  let isSpectating = $derived(spectateMode && !isOwner)

  // create game board
  const board = new Board({ x, y })

  const setSpectateMode = (enabled: boolean) => {
    spectateMode = enabled
    channel?.send({ type: 'spectate', enabled })
  }

  onMount(() => {
    let indexChannel = connect('ink:index')
    let fetchStart: number = performance.now()

    type WelcomeMessage = { type: 'ready-to-send', uid: string }
    type RequestStateMessage = { type: 'request-state', uid: string }
    type StateMessage = { type: 'state', data: string, force?: boolean }
    type PaintMessage = { type: 'paint', data: [number, number, number, number] }
    type SpectateMessage = { type: 'spectate', enabled: boolean }

    channel = connect(`${CHANNEL_PREFIX}/${x}x${y}`, { announce: true })
      .on('message', ({ message }) => console.log)
      .on<PaintMessage>('message', ({ message }) =>
        message.type === 'paint' && board.paint(...message.data, 1)
      )
      .on<SpectateMessage>('message', ({ message }) => {
        if (message.type !== 'spectate') return
        spectateMode = message.enabled
      })
      .on<StateMessage>('message', ({ message, uid }) => {
        if (message.type !== 'state') return
        chroma.log('😘 received state from', USER_COLOR, uid)
        if (fetched && !message.force) return
        const start = performance.now()
        board.import(message.data)
        const end = performance.now()
        !fetched && chroma.log('✅ complete board retrieval @', TIME_COLOR, `${round(end - fetchStart, 1)}ms`)
        fetched = true
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
        players = users
        if (users === 1) {
          isOwner = true
        }
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
      .on('leave', ({ users }) => {
        players = users
        if (users === 1) {
          isOwner = true
        }
      })
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
      indexChannel?.send([`${x}x${y}`, players])
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
  <title>ink : {x}x{y} ({players} players)</title>
  <meta name="description" content="An ink board for {x}x{y} cells." />
</svelte:head>

<!-- MARKUP -->
<div class="grid" class:horizontal>
  {#if isSpectating}
    <div class="spectate">
      <p>The board owner has disabled multiplayer.</p>
      <p>Please enjoy the show!</p>
    </div>
  {:else}
    <div class="controls" >
      {#if isOwner}
        <!-- <button onclick={() => setSpectateMode(!spectateMode)}>
          {`Others Can Paint? ${spectateMode ? 'NO' : 'YES'}`}
        </button> -->
        Allow Others to Paint?
        <input
          type="checkbox"
          class="toggle"
          checked={!spectateMode}
          on:change={() => setSpectateMode(!spectateMode)}
          />
      {/if}
      <ColorPicker bind:rgb={rgba} bind:isOpen={isColorPickerOpen} />
      <Swatches
        bind:rgba={rgba}
        alpha={alpha}
        />
      <RangeSlider
        min={0}
        max={1}
        float
        pips
        pipstep={5}
        formatter={(value) => ([0, 0.4, 1].includes(value)) ? (value * 100) + '%' : ''}
        handleFormatter={v => Math.round(v * 100) + '% opacity'}
        all="label"
        step={0.02}
        bind:value={alpha}
        on:change={() => {
          if (alpha !== rgba.a) {
            rgba = { ...rgba, a: alpha }
          }
        }}
        --
        />
      <SavedBoards
        x={x}
        y={y}
        board={board}
        players={players}
        isOwner={isOwner}
        spectateMode={spectateMode}
        onLoad={(encoded) => {
          if (players > 1) channel?.send({ type: 'state', force: true, data: encoded })
        }}
        />

      <PlayerCount players={players} />
    </div>
  {/if}

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
<style lang="scss">
  .grid {
    height: 100vh;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .spectate {
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 1.3rem;
    font-weight: 200;
    letter-spacing: 0.05em;
    color: #f0c;
    color: #aaa;
    padding: 2rem 3rem;
    line-height: 1;

    & p {
      margin: 0 0 1rem 0;
    }
  }

  .controls {
    display: flex;
    flex-flow: row wrap;
    justify-content: center;
    row-gap: 0.5rem;
    column-gap: 1rem;
    align-items: center;
    /* justify-content: stretch; */
    /* align-items: flex-end; */
    padding: 1rem;
    flex: 0.2;

    :global(.rangeSlider) {
      margin-bottom: 1rem;
    }
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
      max-height: 100%;
      min-width: 13rem;
      gap: 1rem;

      :global(.rangeSlider) {
        margin-bottom: 1.5rem;
      }
    }
  }
</style>
