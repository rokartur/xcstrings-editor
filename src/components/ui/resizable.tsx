import { cn } from '@/lib/utils'
import * as ResizablePrimitive from 'react-resizable-panels'

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Group>) {
	return (
		<ResizablePrimitive.Group
			data-slot='resizable-panel-group'
			className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
			{...props}
		/>
	)
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
	return <ResizablePrimitive.Panel data-slot='resizable-panel' {...props} />
}

function ResizableHandle({
	withHandle,
	className,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
	withHandle?: boolean
}) {
	return (
		<ResizablePrimitive.Separator
			data-slot='resizable-handle'
			className={cn(
				"relative flex shrink-0 items-center justify-center bg-border/80 transition-colors after:absolute after:-inset-1 after:content-[''] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden hover:bg-border",
				className,
			)}
			{...props}
		>
			{withHandle && (
				<div className='z-10 h-6 w-1 shrink-0 rounded-full bg-muted-foreground/70 ring-1 ring-background/80' />
			)}
		</ResizablePrimitive.Separator>
	)
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
