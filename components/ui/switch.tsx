import { cn } from '~/lib/utils';
import * as SwitchPrimitives from '@rn-primitives/switch';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'flex h-[31px] w-[51px] shrink-0 flex-row items-center rounded-full border border-transparent',
        props.checked ? 'bg-primary' : 'bg-input',
        props.disabled && 'opacity-50',
        className
      )}
      {...props}>
      <SwitchPrimitives.Thumb
        className={cn(
          'size-[27px] rounded-full bg-foreground',
          props.checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
