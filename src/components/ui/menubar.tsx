import * as MenubarPrimitive from "@radix-ui/react-menubar";
import React from "react";
import { cn } from "@/lib/utils/shadcn";
import { Check, ChevronRight } from "lucide-react";
import { ICON } from "@/lib/utils/const";

const Menubar = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
    <MenubarPrimitive.Root
        ref={ref}
        className={cn("text-foreground px-2 py-1.5", className)}
        {...props}
    />
));

const MenubarMenu: typeof MenubarPrimitive.Menu = MenubarPrimitive.Menu;
const MenubarPortal: typeof MenubarPrimitive.Portal = MenubarPrimitive.Portal;

const MenubarContent = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>
>(({ className, ...props }, ref) => (
    <MenubarPrimitive.Content
        ref={ref}
        className={cn(
            "rounded-lg border border-border/50 bg-popover/95 backdrop-blur-md",
            "p-1.5 text-popover-foreground shadow-lg shadow-black/10",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
        )}
        {...props}
    />
));

const MenubarTrigger = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>((props, ref) => (
    <MenubarPrimitive.Trigger
        ref={ref}
        className={cn(
            "px-3 py-1.5 rounded-md transition-colors duration-150",
            "hover:bg-accent/80 hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "data-[state=open]:bg-accent/80"
        )}
        {...props}
    />
));

const MenubarLabel = MenubarPrimitive.Label;

const MenubarItem = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item>
>(({ className, ...props }, ref) => (
    <MenubarPrimitive.Item ref={ref} className={cn("", className)} {...props} />
));

const MenubarGroup = MenubarPrimitive.Group;

const MenubarItemIndicator = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.ItemIndicator>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.ItemIndicator>
>(({ ...props }, ref) => (
    <MenubarPrimitive.ItemIndicator ref={ref} {...props}>
        <Check size={ICON.SIZE / 2} strokeWidth={ICON.STROKE_WIDTH} />
    </MenubarPrimitive.ItemIndicator>
));

const MenubarCheckboxItem = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
    <MenubarPrimitive.CheckboxItem
        ref={ref}
        className={cn(
            "flex space-x-2 items-center justify-between",
            "px-2.5 py-2 rounded-md select-none cursor-pointer",
            "transition-colors duration-150",
            "hover:bg-accent/90 hover:text-accent-foreground",
            "focus:outline-none focus:bg-accent/90",
            className
        )}
        {...props}
    >
        <span>{children}</span>
        <MenubarItemIndicator>
            <Check size={ICON.SIZE} strokeWidth={ICON.STROKE_WIDTH} />
        </MenubarItemIndicator>
    </MenubarPrimitive.CheckboxItem>
));

const MenubarRadioGroup = MenubarPrimitive.RadioGroup;
const MenubarRadioItem = MenubarPrimitive.RadioItem;
const MenubarSub = MenubarPrimitive.Sub;

const MenubarSubTrigger = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
    <MenubarPrimitive.SubTrigger
        ref={ref}
        className={cn(
            "flex space-x-5 items-center justify-between select-none",
            "px-2.5 py-2 rounded-md transition-colors duration-150",
            "hover:bg-accent/90 hover:text-accent-foreground",
            "focus:outline-none focus:bg-accent/90",
            className
        )}
        {...props}
    >
        <span>{children}</span>
        <ChevronRight size={ICON.SIZE / 2} strokeWidth={ICON.STROKE_WIDTH} />
    </MenubarPrimitive.SubTrigger>
));

const MenubarSubContent = React.forwardRef<
    React.ElementRef<typeof MenubarPrimitive.SubContent>,
    React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
    <MenubarPrimitive.SubContent
        ref={ref}
        className={cn(
            "rounded-lg border border-border/50 bg-popover/95 backdrop-blur-md",
            "p-1.5 text-popover-foreground shadow-lg shadow-black/10",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
        )}
        {...props}
    />
));

const MenubarSeparator = MenubarPrimitive.Separator;
const MenubarArrow = MenubarPrimitive.Arrow;

export {
    Menubar,
    MenubarMenu,
    MenubarPortal,
    MenubarContent,
    MenubarTrigger,
    MenubarLabel,
    MenubarItem,
    MenubarGroup,
    MenubarCheckboxItem,
    MenubarItemIndicator,
    MenubarRadioGroup,
    MenubarRadioItem,
    MenubarSub,
    MenubarSubTrigger,
    MenubarSubContent,
    MenubarSeparator,
    MenubarArrow,
};
