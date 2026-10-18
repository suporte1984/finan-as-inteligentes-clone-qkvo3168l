import { useEffect, useState } from 'react'

export function useCountUp(value: number, duration = 600) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const startAt = performance.now()
    const from = display
    const distance = value - from
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + distance * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // Animar somente quando o valor-alvo mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return display
}
