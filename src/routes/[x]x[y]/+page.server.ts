import { error } from '@sveltejs/kit'

export function load({ params }) {
  let x = Number(params.x)
  let y = Number(params.y)

  if (isNaN(x) || isNaN(y)) {
    console.log("Invalid coordinates")

    return error(400, "Try something like 20x20.")
  }

  return { x, y }
}