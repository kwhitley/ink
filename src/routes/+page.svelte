<script lang="ts">
  import { onMount } from 'svelte'
  import { connect, type IttySocket } from 'itty-sockets'

  let activeChannels: Record<string, [number, number]> = {}

  const STALE_TIME = 1000

  $: topChannels = Object
                    .entries(activeChannels)
                    .sort((a, b) => b[1][0] - a[1][0])
                    .slice(0, 10)


  onMount(() => {
    let channel = connect('ink:index')
      .on<[string, number]>('message', ({ message }) => {
        const [channelName, count] = message
        activeChannels[channelName] = [count, Date.now()]
        activeChannels = { ...activeChannels }
      })

    let cleanup = setInterval(() => {
      let dirty = false
      for (const [channelName, [count, timestamp]] of Object.entries(activeChannels)) {
        if (Date.now() - timestamp > STALE_TIME) {
          delete activeChannels[channelName]
          dirty = true
        }
      }
      if (dirty) {
        activeChannels = { ...activeChannels }
      }
    }, 1000)

    return () => {
      channel.close()
      clearInterval(cleanup)
    }
  })
</script>

<main>
  <h1>
    There
    <span class="number" class:plural={Object.keys(activeChannels).length > 1}>{Object.keys(activeChannels).length}</span> active 🎨 channel
  </h1>
  <div class="channels">
    {#each topChannels as [channelName, [count]]}
      <div class="channel">
        <a href={`/${channelName}`}>{channelName.split('x').join(' x ')}</a>
        &ndash;&nbsp;<span>{count} players</span>
      </div>
    {/each}
  </div>
</main>

<style lang="scss">
  .channels {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  main {
    max-width: 1000px;
    box-shadow: 0 0 100px 0 rgba(0, 0, 0, 0.1);
    height: 100vh;
    margin: 0 auto;
    padding: 3rem;
  }

  .number {
    color: var(--accent-color);
    font-size: 2.2rem;

    &::before {
      content: ' is';
      color: #111;
      margin-right: 0.5rem;
    }

    &.plural {
      &::before {
        content: ' are';
      }
    }
  }

  .channels {
    font-size: 1.2rem;
  }

  h1 {
    font-weight: 200;
    margin-top: 0;

    &:has(.plural) {
      &::after {
        content: 's';
      }
    }
  }
</style>