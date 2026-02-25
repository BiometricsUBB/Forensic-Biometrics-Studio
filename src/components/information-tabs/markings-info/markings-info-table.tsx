/* eslint-disable func-names */
/* eslint-disable security/detect-object-injection */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import {
    ColumnDef,
    Row,
    SortDirection,
    SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import {
    HTMLAttributes,
    forwardRef,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { TableVirtuoso, TableVirtuosoHandle } from "react-virtuoso";
import { cn } from "@/lib/utils/shadcn";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { MarkingsState, MarkingsStore } from "@/lib/stores/Markings";
import { CANVAS_ID } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { CUSTOM_GLOBAL_EVENTS } from "@/lib/utils/const";
import { triggerPostMoveFlash } from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import { sleep } from "@/lib/utils/misc/sleep";
import { EmptyableMarking } from "./markings-info-table-columns";

const TableComponent = forwardRef<
    HTMLTableElement,
    HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
    />
));
TableComponent.displayName = "TableComponent";

const TableHeadComponent = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
>((props, ref) => (
    <thead ref={ref} className="sticky top-0 bg-card !z-20" {...props} />
));
TableHeadComponent.displayName = "TableHeadComponent";

const TableRowComponent = <TData,>(rows: Row<TData>[], canvasId: CANVAS_ID) => {
    return function useTableRow(props: HTMLAttributes<HTMLTableRowElement>) {
        // @ts-expect-error data-index is a valid attribute
        const index = props["data-index"];
        const row = rows[index];
        const ref = useRef(null);

        const runAnimation = useCallback(() => {
            sleep(0).then(() => {
                const element = ref.current;
                if (!element) {
                    return;
                }
                triggerPostMoveFlash(element);
            });
        }, []);

        if (!row) return null;

        const marking = row.original as EmptyableMarking;
        const { selectedMarkingLabel } = MarkingsStore(canvasId).state;
        const cells = row.getVisibleCells();

        const isSelected = selectedMarkingLabel === marking.label;

        if (isSelected) {
            runAnimation();
        }

        return (
            <TableRow
                ref={ref}
                key={row.id}
                className={cn(
                    "last:border-b-0 cursor-pointer transition-colors hover:bg-accent/45",
                    isSelected && "bg-accent/75"
                )}
                data-state={isSelected && "selected"}
                onClickCapture={() => {
                    if (selectedMarkingLabel === marking.label) {
                        MarkingsStore(
                            canvasId
                        ).actions.selectedMarkingLabel.setSelectedMarkingLabel(
                            null
                        );
                        document.dispatchEvent(
                            new Event(CUSTOM_GLOBAL_EVENTS.CLEANUP)
                        );
                    } else {
                        // zaznacz
                        MarkingsStore(
                            canvasId
                        ).actions.selectedMarkingLabel.setSelectedMarkingLabel(
                            marking.label
                        );
                    }
                }}
                {...props}
            >
                {cells.map(cell => (
                    <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={cn(
                            cell.column.id === "actions" &&
                                "sticky left-0 bg-card z-10"
                        )}
                    >
                        {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                        )}
                    </TableCell>
                ))}
            </TableRow>
        );
    };
};

function SortingIndicator({ isSorted }: { isSorted: SortDirection | false }) {
    if (!isSorted) return null;
    return (
        <div className="relative w-0 left-1">
            {
                {
                    asc: "↑",
                    desc: "↓",
                }[isSorted]
            }
        </div>
    );
}

interface MarkingsInfoTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    selectedMarking: MarkingsState["selectedMarkingLabel"];
    data: TData[];
    height: string;
    canvasId: CANVAS_ID;
}

let prevDataLength = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MarkingsInfoTable = function <TData, TValue>({
    columns,
    selectedMarking,
    data,
    height,
    canvasId,
}: MarkingsInfoTableProps<TData, TValue>) {
    const ref = useRef<TableVirtuosoHandle>(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [rowSelection, setRowSelection] = useState({});
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            rowSelection,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
    });

    const { rows } = table.getRowModel();

    useEffect(() => {
        const virtuoso = ref.current;
        if (virtuoso === null) return;

        const getIndex = () => {
            if (selectedMarking === null) {
                if (prevDataLength === data.length) return -1;
                return rows.findIndex(row => row.original === data.at(-1));
            }

            return rows.findIndex(row => row.original === selectedMarking);
        };

        const index = getIndex();
        if (index === -1) return;

        sleep(0).then(() => {
            virtuoso.scrollToIndex({
                index,
                align: "center",
                behavior: "auto",
            });
        });
    }, [selectedMarking, data, rows]);

    useEffect(() => {
        prevDataLength = data.length;
    }, [data.length]);

    return (
        <TableVirtuoso
            ref={ref}
            followOutput
            style={{
                height,
                overflow: "auto",
            }}
            totalCount={rows.length}
            increaseViewportBy={{ top: 0, bottom: 200 }}
            components={{
                Table: TableComponent,
                TableRow: TableRowComponent(rows, canvasId),
                TableHead: TableHeadComponent,
            }}
            fixedHeaderContent={() =>
                table.getHeaderGroups().map(headerGroup => (
                    <TableRow
                        className={cn("bg-card border-b")}
                        key={headerGroup.id}
                    >
                        {headerGroup.headers.map(header => {
                            return (
                                <TableHead
                                    key={header.id}
                                    colSpan={header.colSpan}
                                    style={{ width: header.getSize() }}
                                    className={cn(
                                        "text-center text-card-foreground whitespace-nowrap",
                                        header.id === "actions" &&
                                            "sticky left-0 bg-card z-10"
                                    )}
                                >
                                    {header.isPlaceholder ? null : (
                                        <div
                                            className="flex items-center"
                                            role="button"
                                            tabIndex={0}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={
                                                header.column.getCanSort()
                                                    ? {
                                                          cursor: "pointer",
                                                          userSelect: "none",
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            <SortingIndicator
                                                isSorted={header.column.getIsSorted()}
                                            />
                                        </div>
                                    )}
                                </TableHead>
                            );
                        })}
                    </TableRow>
                ))
            }
        />
    );
};
