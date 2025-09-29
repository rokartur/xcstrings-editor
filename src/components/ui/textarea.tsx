import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import type { ChangeEvent, FormEvent, TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, onInput, style, value, defaultValue, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)

    const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }, [])

    const setNode = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (node) {
          autoResize(node)
        }
      },
      [autoResize],
    )

    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement)

    useLayoutEffect(() => {
      if (innerRef.current) {
        autoResize(innerRef.current)
      }
    }, [autoResize, value, defaultValue])

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLTextAreaElement>) => {
        autoResize(event.currentTarget)
        onChange?.(event)
      },
      [autoResize, onChange],
    )

    const handleInput = useCallback(
      (event: FormEvent<HTMLTextAreaElement>) => {
        autoResize(event.currentTarget)
        onInput?.(event)
      },
      [autoResize, onInput],
    )

    return (
      <textarea
        ref={setNode}
        className={cn(
          'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none overflow-hidden',
          className,
        )}
        style={{ ...style, height: 'auto' }}
        onChange={handleChange}
        onInput={handleInput}
        value={value}
        defaultValue={defaultValue}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'

export { Textarea }
