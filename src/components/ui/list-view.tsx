import { cn } from '@/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

// ============================================================================
// ListView - Main container for list views (Linear-style)
// ============================================================================

interface ListViewProps extends ComponentProps<'main'> {
	children: ReactNode
}

function ListView({ className, children, ...props }: ListViewProps) {
	return (
		<main data-slot='list-view' className={cn('flex min-h-dvh flex-1 flex-col', className)} {...props}>
			<div className='flex flex-1 flex-col'>{children}</div>
		</main>
	)
}

// ============================================================================
// ListViewHeader - Header section with title, count, and actions
// ============================================================================

interface ListViewHeaderProps extends ComponentProps<'header'> {
	children: ReactNode
}

function ListViewHeader({ className, children, ...props }: ListViewHeaderProps) {
	return (
		<header
			data-slot='list-view-header'
			className={cn('sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-background px-6 py-4', className)}
			{...props}
		>
			{children}
		</header>
	)
}

// ============================================================================
// ListViewTitle - Title row with name, count badge and actions
// ============================================================================

interface ListViewTitleProps extends ComponentProps<'div'> {
	title: string
	count?: number
	children?: ReactNode
}

function ListViewTitle({ className, title, count, children, ...props }: ListViewTitleProps) {
	return (
		<div data-slot='list-view-title' className={cn('flex items-center justify-between', className)} {...props}>
			<div className='flex items-center gap-2'>
				<h1 className='text-base font-semibold text-balance text-foreground'>{title}</h1>
				{count !== undefined && (
					<span
						data-slot='count-badge'
						className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[0.625rem] font-medium text-muted-foreground tabular-nums'
					>
						{count}
					</span>
				)}
				{children}
			</div>
		</div>
	)
}

// ============================================================================
// ListViewActions - Container for action buttons in header
// ============================================================================

function ListViewActions({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='list-view-actions' className={cn('flex items-center gap-1', className)} {...props} />
}

// ============================================================================
// ListViewToolbar - Secondary row with filters and display options
// ============================================================================

function ListViewToolbar({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='list-view-toolbar'
			className={cn('flex items-center justify-between gap-2', className)}
			{...props}
		/>
	)
}

function ListViewToolbarGroup({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='list-view-toolbar-group' className={cn('flex items-center gap-1', className)} {...props} />
}

// ============================================================================
// ListViewContent - Main content area
// ============================================================================

function ListViewContent({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='list-view-content' className={cn('flex flex-1 flex-col', className)} {...props} />
}

export {
	ListView,
	ListViewHeader,
	ListViewTitle,
	ListViewActions,
	ListViewToolbar,
	ListViewToolbarGroup,
	ListViewContent,
}
