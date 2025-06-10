import { writable, type Writable } from 'svelte/store'

type EnhancedSubscribe<T> = (Subscriber: (value: T, previous: T | undefined) => void) => () => void

interface Persistable<T> extends Writable<T> {
  subscribe: EnhancedSubscribe<T>
}

export const persistable = <T = any>(key: string, defaults: T): Persistable<T> => {
  let value: T
  let storedValue: string | null = null

  if (typeof window !== 'undefined') {
    storedValue = window.localStorage.getItem(key)
  }

  if (storedValue !== null) {
    try {
      value = JSON.parse(storedValue) as T
    } catch (error) {
      console.error('Error parsing stored value of', storedValue, 'for', key, error)
      value = defaults
    }
  } else {
    value = defaults
  }

  const store = writable(value)

  store.subscribe(v => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(v))
    }
  })

  return {
    ...store,
    subscribe: (Subscriber: (value: T, previous: T | undefined) => void) => {
      let previous: T | undefined
      return store.subscribe((current) => {
        Subscriber(current, previous)
        previous = current
      })
    }
  }
}
