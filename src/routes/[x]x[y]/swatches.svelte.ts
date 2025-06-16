type Color = { r: number, g: number, b: number, a: number }

export class Swatches {
  colors: Array<Color> = $state([])
  selectedIndex: number | undefined = $state(1)

  constructor() {
    this.colors = [
      { r: 255, g: 255, b:255, a: 1 },
      { r: 0, g: 0, b: 0, a: 0.4 },
      { r: 0, g: 0, b: 0, a: 0.2 },
      { r: 0, g: 0, b: 0, a: 0.1 },
      { r: 255, g: 0, b: 175, a: 0.4 },
      { r: 255, g: 0, b: 0, a: 0.4 },
      { r: 255, g: 150, b: 0, a: 0.4 },
      { r: 255, g: 200, b: 0, a: 0.4 },
      { r: 100, g: 255, b: 0, a: 0.4 },
      { r: 0, g: 255, b: 255, a: 0.4 },
      { r: 0, g: 120, b: 255, a: 0.4 },
      { r: 40, g: 0, b: 230, a: 0.4 },
    ]
  }

  select(index: number | undefined) {
    this.selectedIndex = index
  }

  remove(index: number) {
    this.colors.splice(index, 1)
    this.select(undefined)
  }
}

export const swatches = new Swatches()