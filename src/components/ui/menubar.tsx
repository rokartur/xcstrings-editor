import { CheckIcon } from '@/components/icons'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { Menubar as MenubarPrimitive } from '@base-ui/react/menubar'
import type { ComponentProps } from 'react'

function Menubar({ className, ...props }: MenubarPrimitive.Props) {
	return (
		<MenubarPrimitive
			data-slot='menubar'
			className={cn('flex h-9 items-center rounded-md border bg-background p-1', className)}
			{...props}
		/>
	)
}

function MenubarMenu({ ...props }: ComponentProps<typeof DropdownMenu>) {
	return <DropdownMenu data-slot='menubar-menu' {...props} />
}

function MenubarGroup({ ...props }: ComponentProps<typeof DropdownMenuGroup>) {
	return <DropdownMenuGroup data-slot='menubar-group' {...props} />
}

function MenubarPortal({ ...props }: ComponentProps<typeof DropdownMenuPortal>) {
	return <DropdownMenuPortal data-slot='menubar-portal' {...props} />
}

function MenubarTrigger({ className, ...props }: ComponentProps<typeof DropdownMenuTrigger>) {
	return (
		<DropdownMenuTrigger
			data-slot='menubar-trigger'
			className={cn(
				'flex items-center rounded-[calc(var(--radius-sm)-2px)] px-2 py-[calc(--spacing(0.875))] text-xs/relaxed font-medium outline-hidden select-none hover:bg-muted aria-expanded:bg-muted',
				className,
			)}
			{...props}
		/>
	)
}

function MenubarContent({
	className,
	align = 'start',
	alignOffset = -4,
	sideOffset = 8,
	...props
}: ComponentProps<typeof DropdownMenuContent>) {
	return (
		<DropdownMenuContent
			data-slot='menubar-content'
			align={align}
			alignOffset={alignOffset}
			sideOffset={sideOffset}
			className={cn(
				'dark min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className,
			)}
			{...props}
		/>
	)
}

function MenubarItem({ className, inset, variant = 'default', ...props }: ComponentProps<typeof DropdownMenuItem>) {
	return (
		<DropdownMenuItem
			data-slot='menubar-item'
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"group/menubar-item min-h-7 gap-2 rounded-md px-2 py-1 text-xs/relaxed focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='size-'])]:size-3.5 data-[variant=destructive]:*:[svg]:!text-destructive",
				className,
			)}
			{...props}
		/>
	)
}

function MenubarCheckboxItem({ className, children, checked, ...props }: MenuPrimitive.CheckboxItem.Props) {
	return (
		<MenuPrimitive.CheckboxItem
			data-slot='menubar-checkbox-item'
			className={cn(
				'relative flex min-h-7 cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
				className,
			)}
			checked={checked}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
				<MenuPrimitive.CheckboxItemIndicator>
					<CheckIcon className='size-4' />
				</MenuPrimitive.CheckboxItemIndicator>
			</span>
			{children}
		</MenuPrimitive.CheckboxItem>
	)
}

function MenubarRadioGroup({ ...props }: ComponentProps<typeof DropdownMenuRadioGroup>) {
	return <DropdownMenuRadioGroup data-slot='menubar-radio-group' {...props} />
}

function MenubarRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
	return (
		<MenuPrimitive.RadioItem
			data-slot='menubar-radio-item'
			className={cn(
				"relative flex min-h-7 cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
				<MenuPrimitive.RadioItemIndicator>
					<CheckIcon className='size-4' />
				</MenuPrimitive.RadioItemIndicator>
			</span>
			{children}
		</MenuPrimitive.RadioItem>
	)
}

function MenubarLabel({ className, inset, ...props }: ComponentProps<typeof DropdownMenuLabel>) {
	return (
		<DropdownMenuLabel
			data-slot='menubar-label'
			data-inset={inset}
			className={cn('px-2 py-1.5 text-xs text-muted-foreground data-[inset]:pl-8', className)}
			{...props}
		/>
	)
}

function MenubarSeparator({ className, ...props }: ComponentProps<typeof DropdownMenuSeparator>) {
	return (
		<DropdownMenuSeparator
			data-slot='menubar-separator'
			className={cn('-mx-1 my-1 h-px bg-border/50', className)}
			{...props}
		/>
	)
}

function MenubarShortcut({ className, ...props }: ComponentProps<typeof DropdownMenuShortcut>) {
	return (
		<DropdownMenuShortcut
			data-slot='menubar-shortcut'
			className={cn(
				'ml-auto text-[0.625rem] tracking-widest text-muted-foreground group-focus/menubar-item:text-accent-foreground',
				className,
			)}
			{...props}
		/>
	)
}

function MenubarSub({ ...props }: ComponentProps<typeof DropdownMenuSub>) {
	return <DropdownMenuSub data-slot='menubar-sub' {...props} />
}

function MenubarSubTrigger({
	className,
	inset,
	...props
}: ComponentProps<typeof DropdownMenuSubTrigger> & {
	inset?: boolean
}) {
	return (
		<DropdownMenuSubTrigger
			data-slot='menubar-sub-trigger'
			data-inset={inset}
			className={cn(
				"min-h-7 gap-2 rounded-md px-2 py-1 text-xs focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-3.5",
				className,
			)}
			{...props}
		/>
	)
}

function MenubarSubContent({ className, ...props }: ComponentProps<typeof DropdownMenuSubContent>) {
	return (
		<DropdownMenuSubContent
			data-slot='menubar-sub-content'
			className={cn(
				'min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
				className,
			)}
			{...props}
		/>
	)
}

export {
	Menubar,
	MenubarPortal,
	MenubarMenu,
	MenubarTrigger,
	MenubarContent,
	MenubarGroup,
	MenubarSeparator,
	MenubarLabel,
	MenubarItem,
	MenubarShortcut,
	MenubarCheckboxItem,
	MenubarRadioGroup,
	MenubarRadioItem,
	MenubarSub,
	MenubarSubTrigger,
	MenubarSubContent,
}
