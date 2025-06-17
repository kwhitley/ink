<script lang="ts">
  import { persistable } from '$lib/persistable'
  import { Board } from './Board'
  import Canvas from './Canvas.svelte'
  import { slide, fly } from 'svelte/transition'

  type Props = {
    x: number
    y: number
    board: Board
    players: number
    isOwner: boolean
    spectateMode: boolean
    onLoad?: (encoded: string) => void
  }

  let { x, y, board, players, onLoad, isOwner, spectateMode }: Props = $props()
  let allowLoad = $derived((isOwner && spectateMode) || players === 1)

  const savedBoards = persistable<string[]>(`ink:saved-boards:${x}x${y}`, [])

  const addBoard = () => {
    const encoded = board.encode()
    $savedBoards = [...$savedBoards, encoded]
  }

  const loadBoard = (encoded: string) => {
    if (!allowLoad) return

    board.import(encoded)
    onLoad?.(encoded)
  }

  const deleteBoard = (index: number) => {
    $savedBoards = $savedBoards.filter((_, i) => i !== index)
  }

  $effect(() => {
    console.log('savedBoards', savedBoards)
  })
</script>

<!-- MARKUP -->
<div class="saved-boards">
  <h2>Saved Boards</h2>

  <section class="canvases">
    {#each $savedBoards as board, index (index + board) }
      <div
        class="canvas-actions"
        in:fly={{ y: 100, duration: 200 }}
        out:slide={{ duration: 100, axis: 'y' }}
        >
        <button
          class="delete"
          onclick={() => deleteBoard(index)}
          aria-label="delete board"
          >
          <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1.4"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-trash"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
        </button>
        <button
          class="canvas-button"
          disabled={!allowLoad}
          onclick={() => loadBoard(board)}
          >
          <div class="lock" class:locked={!allowLoad}>
            cannot load with 2+ players
          </div>
          <Canvas
            board={new Board({ from: board })}
            isColorPickerOpen={false}
            rgba={{ r: 0, g: 0, b: 0, a: 0 }}
            height={100}
            width={100}
            loaded
            />
        </button>

      </div>
    {/each}
    <button
      class="canvas-button save"
      onclick={addBoard}
      >
      Save Current
    </button>
  </section>


</div>

<!-- STYLES -->
<style lang="scss">
  .saved-boards {
    text-align: center;
    flex: 1;
  }

  h2 {
    font-weight: 200;
    text-transform: uppercase;
    font-size: 1rem;
  }

  .canvas-button {
    border-radius: 0.5rem;
    border: 1px solid #333;
    transition: transform 0.1s ease-in-out;
    cursor: pointer;
    position: relative;

    &:disabled {
      cursor: not-allowed;
      border-color: rgba(0, 0, 0, 0.2);
    }

    &:not(:disabled):hover {
      transform: scale(1.1);
    }
  }

  .lock {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: wrap;
    padding: 0 0.5rem;
    border-radius: 0.5rem;
    z-index: 1;
    color: white;

    &:not(.locked) {
      opacity: 0;
    }
  }

  .canvas-actions {
    display: flex;
    flex-flow: row-reverse nowrap;
    align-items: flex-end;
    gap: 0;
    margin-bottom: 1rem;
  }

  .save {
    position: relative;
    background-color: rgba(50, 200, 0, 0.3);
    padding: 0.5rem 0.75rem;
    border-color: rgba(0, 100, 0, 0.4);
    border: none;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    width: 100%;
  }

  .delete {
    border: none;
    background: none;
    cursor: pointer;
    transition: transform 0.1s ease-in-out;
    opacity: 0.2;
    margin-left: -0.2rem;

    &:hover {
      transform: translateY(-2px);
      opacity: 1;

      & + .canvas-button {
        border-color: rgba(200, 50, 0, 1);
        outline: 2px solid rgba(250, 50, 0, 1);
      }
    }
  }

  @media (max-aspect-ratio: 1.05/1) {
    .saved-boards {
      flex: 1 100%;
      width: 100%;
    }

    .canvas-actions {
      display: inline-flex;
      margin-right: 0.5rem;
    }

    .canvas {
      width: 100%;
      height: 100%;
    }

    .save {
      &:hover {
        transform: translateY(-2px);
        opacity: 0.9;
      }
    }
  }

</style>