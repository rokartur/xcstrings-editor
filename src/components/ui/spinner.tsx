import { LoadingIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
	return (
		<LoadingIcon
			aria-label='Loading'
			className={cn('size-4 animate-spin', className)}
			{...props}
		/>
	)
}

export { Spinner }
