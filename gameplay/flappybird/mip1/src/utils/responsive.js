import { WIDTH, HEIGHT } from '../constants.js'

export function viewport() {
  return {
    width: Math.max(1, Math.round(window.visualViewport?.width || window.innerWidth)),
    height: Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight)),
  }
}

export function layout(width, height) {
  const scale = Math.min(width / WIDTH, height / HEIGHT)
  const offX = (width - WIDTH * scale) / 2
  const offY = (height - HEIGHT * scale) / 2
  return { sx: x => offX + x * scale, sy: y => offY + y * scale, sd: size => size * scale }
}

export function place(element, coords, x, y, width, height) {
  element.style.left = `${coords.sx(x)}px`
  element.style.top = `${coords.sy(y)}px`
  element.style.width = `${coords.sd(width)}px`
  if (height !== undefined) element.style.height = `${coords.sd(height)}px`
}
