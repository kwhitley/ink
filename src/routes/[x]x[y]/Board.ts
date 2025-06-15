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
  private x: number = 0
  private y: number = 0
  private gridWidth: number = 1
  private gridOpacity: number = 0.8
  private gridColor: [number, number, number] = [128, 128, 128]
  private lastPaintedIndex: number = -1

  constructor({ x, y, from }: { x?: number; y?: number; from?: string }) {
    const decoded = from ? this.decode(from) : undefined
    const useX = decoded?.x ?? x
    const useY = decoded?.y ?? y
    if (!useX || !useY) {
      throw new Error('Canvas must be initialized with either dimensions or encoded data')
    }

    this.colors = decoded?.colors ?? new Uint8ClampedArray(useX * useY * 3).fill(255)
    this.setDimensions(useX, useY)
  }

  setDimensions(x: number, y: number) {
    this.x = x
    this.y = y
    this.gridOpacity = 5000 / (x * y)
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
    this.gridCtx.strokeStyle = `rgba(${this.gridColor.join(',')},${this.gridOpacity})`
    this.gridCtx.lineWidth = this.gridWidth

    // Draw vertical lines
    for (let i = 0; i <= this.x; i++) {
      const x = i * cellWidth
      this.gridCtx.beginPath()
      this.gridCtx.moveTo(x, 0)
      this.gridCtx.lineTo(x, this.gridCanvas.height)
      this.gridCtx.stroke()
    }

    // Draw horizontal lines
    for (let i = 0; i <= this.y; i++) {
      const y = i * cellHeight
      this.gridCtx.beginPath()
      this.gridCtx.moveTo(0, y)
      this.gridCtx.lineTo(this.gridCanvas.width, y)
      this.gridCtx.stroke()
    }

    this.gridCanvas.style.border = `1px solid rgba(0,0,0,${this.gridOpacity})`
    const height = this.canvas?.height ?? 1
    const width = this.canvas?.width ?? 1
    const opacity = Math.max(0.15, (height * width) / 500000)
    this.gridCanvas.style.opacity = `${opacity}`
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

    // Calculate the scale factor to fill the container while maintaining aspect ratio
    const containerRatio = width / height
    const boardRatio = this.x / this.y
    const scale = containerRatio > boardRatio ? height / this.y : width / this.x

    // Calculate the display dimensions
    const displayWidth = Math.floor(this.x * scale)
    const displayHeight = Math.floor(this.y * scale)

    // Set the display size (CSS pixels)
    this.canvas.style.width = `${displayWidth}px`
    this.canvas.style.height = `${displayHeight}px`
    this.gridCanvas.style.width = `${displayWidth}px`
    this.gridCanvas.style.height = `${displayHeight}px`

    // Set the canvas resolution (physical pixels)
    this.canvas.width = Math.floor(displayWidth * dpr)
    this.canvas.height = Math.floor(displayHeight * dpr)
    this.gridCanvas.width = Math.floor(displayWidth * dpr)
    this.gridCanvas.height = Math.floor(displayHeight * dpr)

    // Scale the context to match the device pixel ratio
    // this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // this.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

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