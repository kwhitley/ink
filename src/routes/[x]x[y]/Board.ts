import { formatSize } from '$lib/format'
import { chroma } from 'itty-chroma'
import { deflate, inflate } from 'pako'
import { round } from 'supergeneric/round'

export type PaintedAction = {
  type: 'paint'
  data: [number, number, number, number]
}

export class Board {
  private canvas: HTMLCanvasElement | null = null
  private gridCanvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private gridCtx: CanvasRenderingContext2D | null = null
  private colors: Uint8ClampedArray
  private x: number
  private y: number
  private grid: number = 1
  private gridColor: [number, number, number, number] = [128, 128, 128, 0.2]
  private lastPaintedIndex: number = -1

  constructor({ x, y, from }: { x?: number; y?: number; from?: string }) {
    if (from) {
      const decoded = this.decode(from)
      this.x = decoded.x
      this.y = decoded.y
      this.colors = decoded.colors
    } else if (x && y) {
      this.x = x
      this.y = y
      this.colors = new Uint8ClampedArray(x * y * 3)
      this.colors.fill(255) // Initialize with white
    } else {
      throw new Error('Canvas must be initialized with either dimensions or encoded data')
    }
  }

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    if (!this.ctx) throw new Error('Could not get 2d context')
  }

  setGridCanvas(canvas: HTMLCanvasElement) {
    this.gridCanvas = canvas
    this.gridCtx = canvas.getContext('2d')
    if (!this.gridCtx) throw new Error('Could not get 2d context for grid')
  }

  setGrid(grid: number) {
    this.grid = grid
    this.drawGrid()
  }

  setGridColor(color: [number, number, number, number]) {
    this.gridColor = color
    this.drawGrid()
  }

  private drawCell(index: number) {
    if (!this.canvas || !this.ctx) {
      return console.warn('Cannot draw cell: canvas or context not initialized')
    }
    const cellWidth = this.canvas.width / this.x
    const cellHeight = this.canvas.height / this.y
    const cx = index % this.x
    const cy = Math.floor(index / this.x)
    const i = index * 3
    this.ctx.fillStyle = `rgb(${this.colors[i]},${this.colors[i + 1]},${this.colors[i + 2]})`
    this.ctx.fillRect(cx * cellWidth, cy * cellHeight, cellWidth, cellHeight)
  }

  drawGrid() {
    if (!this.gridCanvas || !this.gridCtx) {
      return console.warn('Cannot draw grid: grid canvas or context not initialized')
    }

    const cellWidth = this.gridCanvas.width / this.x
    const cellHeight = this.gridCanvas.height / this.y

    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height)
    this.gridCtx.strokeStyle = `rgba(${this.gridColor.join(',')})`
    this.gridCtx.lineWidth = this.grid

    for (let cx = 0; cx < this.x; cx++) {
      for (let cy = 0; cy < this.y; cy++) {
        this.gridCtx.strokeRect(cx * cellWidth, cy * cellHeight, cellWidth, cellHeight)
      }
    }
  }

  drawAll() {
    if (!this.canvas || !this.ctx) {
      return console.warn('Cannot draw all: canvas or context not initialized')
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    for (let i = 0; i < this.x * this.y; i++) this.drawCell(i)
  }

  resize(width: number, height: number, dpr: number = window.devicePixelRatio || 1) {
    if (!this.canvas || !this.gridCanvas || !this.ctx || !this.gridCtx) {
      return
    }

    const rawCellWidth = width / this.x
    const rawCellHeight = height / this.y
    const fillByWidth = rawCellWidth < rawCellHeight
    const cellSize = Math.floor(fillByWidth ? rawCellWidth : rawCellHeight)
    const displayWidth = cellSize * this.x
    const displayHeight = cellSize * this.y

    this.canvas.style.width = `${displayWidth}px`
    this.canvas.style.height = `${displayHeight}px`
    this.canvas.width = Math.floor(displayWidth * dpr)
    this.canvas.height = Math.floor(displayHeight * dpr)

    this.gridCanvas.style.width = `${displayWidth}px`
    this.gridCanvas.style.height = `${displayHeight}px`
    this.gridCanvas.width = Math.floor(displayWidth * dpr)
    this.gridCanvas.height = Math.floor(displayHeight * dpr)

    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.gridCtx.setTransform(1, 0, 0, 1, 0, 0)

    this.drawAll()
    this.drawGrid()
  }

  paint(index: number, r: number, g: number, b: number, a: number = 1): PaintedAction | void {
    const i = index * 3, c = this.colors
    if (c[i] === r && c[i + 1] === g && c[i + 2] === b) return
    if (this.lastPaintedIndex === index) return
    this.lastPaintedIndex = index

    // Alpha blend: new over old
    c[i] = Math.round(r * a + c[i] * (1 - a))
    c[i + 1] = Math.round(g * a + c[i + 1] * (1 - a))
    c[i + 2] = Math.round(b * a + c[i + 2] * (1 - a))
    this.drawCell(index)
    return { type: 'paint', data: [index, c[i], c[i + 1], c[i + 2]] }
  }

  getColor(index: number) {
    const i = index * 3
    return {
      r: this.colors[i],
      g: this.colors[i + 1],
      b: this.colors[i + 2],
    }
  }

  encode(): string {
    const start = performance.now()
    // Create a buffer to hold dimensions and colors
    const buffer = new Uint8Array(8 + this.colors.length)
    // Store dimensions as 32-bit integers
    new DataView(buffer.buffer).setInt32(0, this.x, true)
    new DataView(buffer.buffer).setInt32(4, this.y, true)
    // Copy colors after dimensions
    buffer.set(this.colors, 8)
    const deflated = deflate(buffer)
    const base64 = btoa(String.fromCharCode(...deflated))

    const end = performance.now()
    chroma.log('💱 encoded board', chroma.grey.italic, `(${formatSize(base64.length)})`, chroma.blue, `${round(end - start, 1)}ms`)
    return base64
  }

  decode(base64: string) {
    const start = performance.now()
    const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const inflated = inflate(bin)
    // Read dimensions from the first 8 bytes
    const x = new DataView(inflated.buffer).getInt32(0, true)
    const y = new DataView(inflated.buffer).getInt32(4, true)
    // Get colors from the remaining bytes
    const colors = new Uint8ClampedArray(inflated.slice(8))
    const end = performance.now()
    chroma.log('💱 decoded board', chroma.grey.italic,`(${formatSize(base64.length)})`, chroma.blue, `${round(end - start, 1)}ms`)
    return { x, y, colors }
  }

  import(base64: string) {
    const decoded = this.decode(base64)
    this.colors = decoded.colors
    this.x = decoded.x
    this.y = decoded.y
    this.drawAll()
    this.drawGrid()
  }

  getIndexFromCoords(px: number, py: number): number {
    if (!this.canvas) return -1
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height

    const localX = px * scaleX
    const localY = py * scaleY

    const cellWidth = this.canvas.width / this.x
    const cellHeight = this.canvas.height / this.y

    const cx = Math.floor(localX / cellWidth)
    const cy = Math.floor(localY / cellHeight)

    if (cx < 0 || cx >= this.x || cy < 0 || cy >= this.y) return -1

    return cy * this.x + cx
  }

  getState(): string {
    return this.encode()
  }

  setState(base64: string) {
    const decoded = this.decode(base64)
    this.colors = decoded.colors
    this.drawAll()
  }
}