import { ArrowLeftIcon, ArrowRightIcon, MoreHorizontalIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

function Pagination({ className, ...props }: ComponentProps<'nav'>) {
	return (
		<nav
			role='navigation'
			aria-label='pagination'
			data-slot='pagination'
			className={cn('mx-auto flex w-full justify-center', className)}
			{...props}
		/>
	)
}

function PaginationContent({ className, ...props }: ComponentProps<'ul'>) {
	return <ul data-slot='pagination-content' className={cn('flex items-center gap-0.5', className)} {...props} />
}

function PaginationItem({ ...props }: ComponentProps<'li'>) {
	return <li data-slot='pagination-item' {...props} />
}

type PaginationLinkProps = {
	isActive?: boolean
} & Pick<ComponentProps<typeof Button>, 'size'> &
	ComponentProps<'a'>

function PaginationLink({ className, isActive, size = 'icon', ...props }: PaginationLinkProps) {
	return (
		<Button
			variant={isActive ? 'outline' : 'ghost'}
			size={size}
			className={cn(className)}
			nativeButton={false}
			render={
				// oxlint-disable-next-line jsx-a11y/anchor-has-content
				<a aria-current={isActive ? 'page' : undefined} data-slot='pagination-link' data-active={isActive} {...props} />
			}
		/>
	)
}

function PaginationPrevious({ className, ...props }: ComponentProps<typeof PaginationLink>) {
	return (
		<PaginationLink aria-label='Go to previous page' size='default' className={cn('pl-2!', className)} {...props}>
			<ArrowLeftIcon className='size-3.5' data-icon='inline-start' />
			<span className='hidden sm:block'>Previous</span>
		</PaginationLink>
	)
}

function PaginationNext({ className, ...props }: ComponentProps<typeof PaginationLink>) {
	return (
		<PaginationLink aria-label='Go to next page' size='default' className={cn('pr-2!', className)} {...props}>
			<span className='hidden sm:block'>Next</span>
			<ArrowRightIcon className='size-3.5' data-icon='inline-end' />
		</PaginationLink>
	)
}

function PaginationEllipsis({ className, ...props }: ComponentProps<'span'>) {
	return (
		<span
			aria-hidden
			data-slot='pagination-ellipsis'
			className={cn("flex size-7 items-center justify-center [&_svg:not([class*='size-'])]:size-3.5", className)}
			{...props}
		>
			<MoreHorizontalIcon className='size-3.5' />
			<span className='sr-only'>More pages</span>
		</span>
	)
}

export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
}
