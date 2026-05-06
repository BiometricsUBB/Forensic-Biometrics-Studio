import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/shadcn";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {}

const inputVariants = cva(
    "box-border flex h-9 w-full border border-transparent bg-transparent px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "box-border hover:rounded-md hover:border hover:border-input hover:shadow-xs",
                outline: "rounded-md border border-input shadow-xs",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

const Input = React.forwardRef<
    HTMLInputElement,
    InputProps & VariantProps<typeof inputVariants>
>(({ className, variant, type, ...props }, ref) => {
    return (
        <input
            type={type}
            ref={ref}
            className={cn(inputVariants({ variant, className }))}
            {...props}
        />
    );
});
Input.displayName = "Input";

export { Input };
