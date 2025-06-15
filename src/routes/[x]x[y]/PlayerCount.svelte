<script lang="ts">
  type Props = { players: number }

  let { players }: Props = $props()
  let changed = $state(false)
  let lastPlayers = $state(players)
  let direction = $state<'up' | 'down' | null>(null)

  $effect(() => {
    if (players !== lastPlayers) {

      if (lastPlayers !== 0) {
        changed = true
        direction = players > lastPlayers ? 'up' : 'down'
      }
      lastPlayers = players
      setTimeout(() => direction = null, 10)
      setTimeout(() => changed = false, 1000)
    }
  })
</script>

<!-- MARKUP -->
<section class="player-count" class:hidden={players === 0}>
  <div class="count"
    class:pulse={changed}
    class:up={direction === 'up'}
    class:down={direction === 'down'}
    >
    {players}
  </div>
  <div class="label">player{players > 1 ? 's' : ''}</div>
</section>

<!-- STYLES -->
<style lang="scss">
  .player-count {
    position: fixed;
    right: 0;
    bottom: 0;
    padding: 1rem;
    font-size: 3rem;
    display: flex;
    flex-flow: column;
    align-items: center;
    justify-content: center;
    line-height: 0.8em;
    pointer-events: none;
    z-index: 1;
    transition: opacity 0.15s ease-out;

    &.hidden {
      opacity: 0;
    }
  }

  .count {
    --duration: 0.15s;
    color: var(--color, var(--foreground-color));
    transition: color 30s ease-out, opacity calc(2 * var(--duration)) ease-out;
    opacity: 0.15;

    &.pulse {
      animation: pulse-animation var(--duration);
    }

    &.up, &.down {
      transition: none;
      opacity: 1;
    }

    &.up {
      --color: rgb(61, 165, 70);
    }

    &.down {
      --color: rgb(152, 62, 62);
    }
  }

  .label {
    font-size: 0.3em;
    line-height: 1;
    opacity: 0.15;
  }
</style>