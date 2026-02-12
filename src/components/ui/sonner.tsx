import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ theme: themeProp, ...props }: ToasterProps) => {
	const { theme: resolvedTheme = 'system' } = useTheme()
	const effectiveTheme = (themeProp ?? resolvedTheme ?? 'system') as NonNullable<ToasterProps['theme']>

	return (
		<Sonner
			theme={effectiveTheme}
			className='toaster group'
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': 'var(--radius)',
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: 'cn-toast',
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }
