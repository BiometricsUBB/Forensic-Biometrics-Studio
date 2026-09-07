import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/shadcn";

type ReportDialogFieldProps = {
    label: string;
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
};

export function ReportDialogField({
    label,
    value,
    onChange,
    readOnly,
}: ReportDialogFieldProps) {
    const id = useId();
    return (
        <div className="flex flex-col justify-end space-y-1.5">
            <label
                htmlFor={id}
                className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
            >
                {label}
            </label>
            <Input
                id={id}
                value={value}
                readOnly={readOnly}
                onChange={e => onChange?.(e.target.value)}
                className={cn(
                    "flex h-10 w-full rounded-md border shadow-sm transition-colors px-2",
                    readOnly
                        ? "border-input/60 bg-muted/40 cursor-not-allowed text-muted-foreground"
                        : "border-input bg-background hover:border-primary/50"
                )}
            />
        </div>
    );
}
