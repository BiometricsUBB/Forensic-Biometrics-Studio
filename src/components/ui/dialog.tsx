import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from "react";
import { cn } from "@/lib/utils/shadcn";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Trigger
        ref={ref}
        className={cn(
            "flex items-center px-2 hover:bg-accent hover:text-accent-foreground focus:outline-hidden",
            className
        )}
        {...props}
    />
));

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn("fixed inset-0 bg-black bg-opacity-50", className)}
        {...props}
    />
));

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Content
        ref={ref}
        className={cn(
            "select-none overflow-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow-lg fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            className
        )}
        {...props}
    />
));

const DialogTitle = DialogPrimitive.Title;

const DialogDescription = DialogPrimitive.Description;

const DialogClose = DialogPrimitive.Close;

export {
    Dialog,
    DialogTrigger,
    DialogPortal,
    DialogOverlay,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogClose,
};
