<script lang="ts">
  import { page } from "$app/state"
</script>

<article>
  <h1>{page.status}</h1>
  <h2>{page.error?.message}</h2>
</article>

<style lang="scss">
  article {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 80vh;
  }

  h1 {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 100;
    font-size: 5rem;
    margin: 0;
    text-transform: uppercase;
    opacity: 0.1;
  }

  h2 {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 400;
    font-size: 2rem;
    margin: 0;
  }
</style>