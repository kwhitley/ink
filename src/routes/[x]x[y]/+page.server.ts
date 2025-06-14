import { error } from '@sveltejs/kit'

export function load({ params }) {
  const x = Number(params.x)
  const y = Number(params.y)

  if (isNaN(x) || isNaN(y)) {
    console.log("Invalid coordinates")

    return error(400, "Try something like 20x20.")
  }

  return { x, y }
}