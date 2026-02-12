import { cn } from '@/lib/utils'
import { Link, type LinkProps } from '@tanstack/react-router'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

// ============================================================================
// DataList - Table-like list component (Linear-style)
// ============================================================================

function DataList({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='data-list' className={cn('flex flex-1 flex-col', className)} {...props} />
}

// ============================================================================
// DataListHeader - Column headers row
// ============================================================================

function DataListHeader({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='data-list-header'
			className={cn(
				'sticky top-17 z-5 flex items-center gap-0 border-b border-border bg-background/95 px-6 backdrop-blur-sm supports-backdrop-filter:bg-background/60',
				className,
			)}
			{...props}
		/>
	)
}

// ============================================================================
// DataListColumn - Individual column header
// ============================================================================

const dataListColumnVariants = cva('flex h-8 shrink-0 items-center text-xs font-medium text-muted-foreground', {
	variants: {
		size: {
			auto: 'min-w-0 flex-1',
			xs: 'w-16',
			sm: 'w-20',
			md: 'w-28',
			lg: 'w-36',
			xl: 'w-48',
		},
		align: {
			start: 'justify-start',
			center: 'justify-center',
			end: 'justify-end',
		},
	},
	defaultVariants: {
		size: 'auto',
		align: 'start',
	},
})

interface DataListColumnProps extends ComponentProps<'div'>, VariantProps<typeof dataListColumnVariants> {
	sortable?: boolean
	sorted?: 'asc' | 'desc' | false
	onSort?: () => void
}

function DataListColumn({ className, size, align, sortable, sorted, onSort, children, ...props }: DataListColumnProps) {
	if (sortable) {
		return (
			<div
				data-slot='data-list-column'
				data-sortable
				data-sorted={sorted || undefined}
				className={cn(dataListColumnVariants({ size, align, className }))}
				{...props}
			>
				<button
					type='button'
					onClick={onSort}
					className='group/sort -mx-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
				>
					<span className='truncate'>{children}</span>
					{sorted && (
						<svg
							className={cn('size-3 shrink-0 transition-transform', sorted === 'desc' && 'rotate-180')}
							viewBox='0 0 16 16'
							fill='currentColor'
						>
							<path d='M8 4l4 5H4l4-5z' />
						</svg>
					)}
				</button>
			</div>
		)
	}

	return (
		<div data-slot='data-list-column' className={cn(dataListColumnVariants({ size, align, className }))} {...props}>
			<span className='truncate px-1.5'>{children}</span>
		</div>
	)
}

// ============================================================================
// DataListBody - Container for list rows
// ============================================================================

function DataListBody({ className, ...props }: ComponentProps<'div'>) {
	return <div data-slot='data-list-body' className={cn('flex flex-col', className)} {...props} />
}

// ============================================================================
// DataListRow - Individual row (as a link)
// ============================================================================

const dataListRowVariants = cva(
	'group/row flex items-center gap-0 border-b border-transparent px-6 transition-colors outline-none select-none',
	{
		variants: {
			variant: {
				default:
					'hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[selected=true]:bg-accent',
				ghost: 'hover:bg-transparent',
			},
			size: {
				default: 'h-12',
				sm: 'h-10',
				lg: 'h-14',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

interface DataListRowProps extends LinkProps, VariantProps<typeof dataListRowVariants> {
	selected?: boolean
	className?: string
}

function DataListRow({ className, variant, size, selected, ...props }: DataListRowProps) {
	return (
		<Link
			data-slot='data-list-row'
			data-selected={selected}
			className={cn(dataListRowVariants({ variant, size, className }))}
			{...props}
		/>
	)
}

// ============================================================================
// DataListRowStatic - Non-link row variant
// ============================================================================

interface DataListRowStaticProps extends ComponentProps<'div'>, VariantProps<typeof dataListRowVariants> {
	selected?: boolean
}

function DataListRowStatic({ className, variant, size, selected, ...props }: DataListRowStaticProps) {
	return (
		<div
			data-slot='data-list-row'
			data-selected={selected}
			className={cn(dataListRowVariants({ variant, size, className }))}
			{...props}
		/>
	)
}

// ============================================================================
// DataListCell - Individual cell in a row
// ============================================================================

const dataListCellVariants = cva('flex shrink-0 items-center gap-2 text-xs', {
	variants: {
		size: {
			auto: 'min-w-0 flex-1',
			xs: 'w-16',
			sm: 'w-20',
			md: 'w-28',
			lg: 'w-36',
			xl: 'w-48',
		},
		align: {
			start: 'justify-start',
			center: 'justify-center',
			end: 'justify-end',
		},
		variant: {
			default: 'text-foreground',
			muted: 'text-muted-foreground',
			primary: 'font-medium text-foreground',
		},
	},
	defaultVariants: {
		size: 'auto',
		align: 'start',
		variant: 'default',
	},
})

interface DataListCellProps extends ComponentProps<'div'>, VariantProps<typeof dataListCellVariants> {}

function DataListCell({ className, size, align, variant, ...props }: DataListCellProps) {
	return (
		<div
			data-slot='data-list-cell'
			className={cn(dataListCellVariants({ size, align, variant, className }))}
			{...props}
		/>
	)
}

// ============================================================================
// DataListTitle - Primary title cell with optional icon
// ============================================================================

interface DataListTitleProps extends ComponentProps<'div'> {
	icon?: ReactNode
	iconColor?: string
	title: string
	subtitle?: string
}

function DataListTitle({ className, icon, iconColor, title, subtitle, ...props }: DataListTitleProps) {
	return (
		<div data-slot='data-list-title' className={cn('flex min-w-0 flex-1 items-center gap-3', className)} {...props}>
			{icon && (
				<div
					className='flex size-5 shrink-0 items-center justify-center'
					style={iconColor ? { color: iconColor } : undefined}
				>
					{icon}
				</div>
			)}
			<div className='flex min-w-0 flex-col'>
				<span className='truncate text-xs font-medium text-foreground'>{title}</span>
				{subtitle && <span className='truncate text-[0.625rem] text-muted-foreground'>{subtitle}</span>}
			</div>
		</div>
	)
}

// ============================================================================
// DataListStatus - Status indicator with icon and text
// ============================================================================

interface DataListStatusProps extends ComponentProps<'div'> {
	icon?: ReactNode
	iconClassName?: string
}

function DataListStatus({ className, icon, iconClassName, children, ...props }: DataListStatusProps) {
	return (
		<div
			data-slot='data-list-status'
			className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}
			{...props}
		>
			{icon && <span className={cn('size-3.5 shrink-0', iconClassName)}>{icon}</span>}
			{children && <span className='truncate'>{children}</span>}
		</div>
	)
}

// ============================================================================
// DataListActions - Row-level actions (appears on hover)
// ============================================================================

function DataListActions({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='data-list-actions'
			className={cn(
				'flex w-7 shrink-0 items-center justify-end opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100',
				className,
			)}
			{...props}
		/>
	)
}

// ============================================================================
// DataListEmpty - Empty state for the list
// ============================================================================

interface DataListEmptyProps extends ComponentProps<'div'> {
	icon?: ReactNode
	title: string
	description?: string
	action?: ReactNode
}

function DataListEmpty({ className, icon, title, description, action, ...props }: DataListEmptyProps) {
	return (
		<div
			data-slot='data-list-empty'
			className={cn('flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center', className)}
			{...props}
		>
			{icon && (
				<div className='flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground'>{icon}</div>
			)}
			<div className='flex flex-col gap-1'>
				<p className='text-sm font-medium text-foreground'>{title}</p>
				{description && <p className='max-w-sm text-xs text-balance text-muted-foreground'>{description}</p>}
			</div>
			{action}
		</div>
	)
}

export {
	DataList,
	DataListHeader,
	DataListColumn,
	DataListBody,
	DataListRow,
	DataListRowStatic,
	DataListCell,
	DataListTitle,
	DataListStatus,
	DataListActions,
	DataListEmpty,
}
