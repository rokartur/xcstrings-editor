import { cn } from '@/lib/utils'
import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { useMemo } from 'react'

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	ref,
	...props
}: Omit<SliderPrimitive.Root.Props, 'defaultValue' | 'value'> & {
	defaultValue?: number | readonly number[]
	value?: number | readonly number[]
}) {
	const _values = useMemo(
		() => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
		[value, defaultValue, min, max],
	)

	return (
		<SliderPrimitive.Root
			className='data-horizontal:w-full data-vertical:h-full'
			data-slot='slider'
			{...(defaultValue !== undefined && { defaultValue })}
			{...(value !== undefined && { value })}
			min={min}
			max={max}
			thumbAlignment='edge'
			{...(ref != null && { ref })}
			{...props}
		>
			<SliderPrimitive.Control
				className={cn(
					'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
					className,
				)}
			>
				<SliderPrimitive.Track
					data-slot='slider-track'
					className='relative overflow-hidden rounded-md bg-muted select-none data-horizontal:h-3 data-horizontal:w-full data-vertical:h-full data-vertical:w-3'
				>
					<SliderPrimitive.Indicator
						data-slot='slider-range'
						className='bg-primary select-none data-horizontal:h-full data-vertical:w-full'
					/>
				</SliderPrimitive.Track>
				{Array.from({ length: _values.length }, (_, index) => (
					<SliderPrimitive.Thumb
						data-slot='slider-thumb'
						key={index}
						className='block size-4 shrink-0 rounded-md border border-primary bg-white shadow-sm ring-ring/30 transition-colors select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50'
					/>
				))}
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	)
}

export { Slider }
