import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { ComponentProps } from 'react'

const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea(
	{ className, ...props },
	ref,
) {
	return (
		<textarea
			ref={ref}
			data-slot='textarea'
			className={cn(
				// Keep Textarea compact by default. (Autosizing, if desired, should be handled by the caller.)
				'box-border min-h-5.5 w-full resize-none rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm leading-snug transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs md:leading-snug dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
				className,
			)}
			{...props}
		/>
	)
})

export { Textarea }
