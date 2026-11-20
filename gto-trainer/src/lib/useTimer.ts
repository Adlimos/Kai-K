import { useCallback, useEffect, useRef } from "react"

/** Milliseconds since the current question appeared, minus the deal animation. */
export function useAnswerClock(questionId: string) {
  const start = useRef(performance.now())
  useEffect(() => {
    start.current = performance.now()
  }, [questionId])
  return useCallback(() => Math.max(0, performance.now() - start.current - 500), [])
}
