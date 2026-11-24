// Removes show-through (text from the back of thin pages) and pencil marks before OCR.
// Printed ink is 2-3x darker than the surrounding paper, show-through only 10-20% darker:
// the ratio to the *local* paper tone separates them, whatever the lighting. Tuned on real
// Captures (spike samples); deterministic, never touches the text itself.

const BLOCK = 32 // paper tone sampled per 32 px block...
const SPAN = 1 // ...then max over the 3x3 neighborhood (~96 px): wider than any glyph
const LO = 0.35 // ratio to paper below which a pixel is solid ink
const HI = 0.75 // ratio above which it becomes white: show-through, pencil, paper
const OFF_PAGE = 0.6 // regions far darker than the page paper (desk, hand) are blanked

export function cleanForOcr(img: ImageData): ImageData {
  const { width: w, height: h, data } = img
  const gray = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (77 * data[p] + 150 * data[p + 1] + 29 * data[p + 2]) >> 8
  }

  const bw = Math.ceil(w / BLOCK)
  const bh = Math.ceil(h / BLOCK)
  const blockMax = new Uint8Array(bw * bh)
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let m = 0
      for (let y = by * BLOCK; y < Math.min(h, (by + 1) * BLOCK); y += 4) {
        for (let x = bx * BLOCK; x < Math.min(w, (bx + 1) * BLOCK); x += 4) {
          const v = gray[y * w + x]
          if (v > m) m = v
        }
      }
      blockMax[by * bw + bx] = m
    }
  }

  const paper = new Uint8Array(bw * bh)
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let m = 0
      for (let yy = Math.max(0, by - SPAN); yy <= Math.min(bh - 1, by + SPAN); yy++) {
        for (let xx = Math.max(0, bx - SPAN); xx <= Math.min(bw - 1, bx + SPAN); xx++) {
          const v = blockMax[yy * bw + xx]
          if (v > m) m = v
        }
      }
      paper[by * bw + bx] = m
    }
  }
  const pageTone = [...paper].sort((a, b) => a - b)[Math.floor(0.9 * (paper.length - 1))]

  const out = new ImageData(w, h)
  const o = out.data
  for (let y = 0; y < h; y++) {
    const rowBlock = Math.floor(y / BLOCK) * bw
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const bg = paper[rowBlock + Math.floor(x / BLOCK)]
      let v = 255
      if (bg >= OFF_PAGE * pageTone) {
        const r = gray[i] / bg
        v = r <= LO ? 0 : r >= HI ? 255 : Math.round(((r - LO) / (HI - LO)) * 255)
      }
      const p = i * 4
      o[p] = o[p + 1] = o[p + 2] = v
      o[p + 3] = 255
    }
  }
  return out
}
