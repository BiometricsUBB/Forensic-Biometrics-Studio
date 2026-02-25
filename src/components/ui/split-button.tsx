import * as React from "react";
import { cn } from "@/lib/utils/shadcn";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { ICON } from "@/lib/utils/const";

export interface SplitButtonAction {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}

export interface SplitButtonProps {
    mainAction: SplitButtonAction;
    dropdownActions: SplitButtonAction[];
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    disabled?: boolean;
}

export function SplitButton({
    mainAction,
    dropdownActions,
    variant = "outline",
    size = "default",
    className,
    disabled = false,
}: SplitButtonProps) {
    const buttonBaseClasses = cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50"
    );

    const variantClasses = {
        default:
            "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        outline:
            "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
    };

    const sizeClasses = {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-8 w-8",
    };

    return (
        <div className={cn("inline-flex rounded-md", className)}>
            <button
                type="button"
                onClick={mainAction.onClick}
                disabled={disabled || mainAction.disabled}
                title={mainAction.label}
                className={cn(
                    buttonBaseClasses,
                    // eslint-disable-next-line security/detect-object-injection
                    variantClasses[variant],
                    // eslint-disable-next-line security/detect-object-injection
                    sizeClasses[size],
                    "rounded-r-none border-r-0"
                )}
            >
                {mainAction.icon}
                {size !== "icon" && (
                    <span className="hidden sm:inline">{mainAction.label}</span>
                )}
            </button>

            <DropdownMenu>
                <DropdownMenuTrigger
                    type="button"
                    disabled={disabled || !dropdownActions.length}
                    className={cn(
                        buttonBaseClasses,
                        // eslint-disable-next-line security/detect-object-injection
                        variantClasses[variant],
                        "h-8 px-1.5 rounded-l-none border-l border-input"
                    )}
                >
                    <ChevronDown size={14} strokeWidth={ICON.STROKE_WIDTH} />
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                        {/* eslint-disable-next-line security/detect-object-injection */}
                        {dropdownActions.map(action => (
                            <DropdownMenuItem
                                key={action.label}
                                onClick={action.onClick}
                                disabled={action.disabled}
                                className="gap-2"
                            >
                                {action.icon}
                                <span>{action.label}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenu>
        </div>
    );
}
