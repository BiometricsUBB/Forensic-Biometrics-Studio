import { HTMLAttributes } from "react";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableRow,
} from "@/components/ui/table";
import { useCanvasContext } from "@/components/pixi/canvas/hooks/useCanvasContext";
import { cn } from "@/lib/utils/shadcn";
import { useGlobalViewport } from "@/components/pixi/viewport/hooks/useGlobalViewport";
import { useGlobalApp } from "@/components/pixi/app/hooks/useGlobalApp";
import { DisplayObjectEvents } from "pixi.js";
import { Viewport } from "pixi-viewport";

export type TableKeys = {
    keys: string[];
    values: string[];
}[];

export type EventName = Exclude<keyof DisplayObjectEvents, symbol>;

function getNestedValue(obj: unknown, keys: string[]): string | number {
    const value = keys.reduce(
        // @ts-expect-error keys are always strings
        (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
        obj
    ) as string | number;

    if (typeof value === "number") {
        if (Math.abs(value) >= 100) return +value.toFixed(1);
        if (Math.abs(value) >= 10) return +value.toFixed(2);
        return +value.toFixed(3);
    }

    return value;
}

function getPrimitiveValues(obj: unknown | undefined): string[] {
    if (!obj) return [];
    return Object.keys(obj).filter(e =>
        ["string", "number", "boolean"].includes(
            typeof (obj as Record<string, unknown>)[e]
        )
    );
}

const getTableValues = (
    obj: unknown | undefined,
    permanentKeys?: string[]
): string[] => {
    return [...new Set([...(permanentKeys ?? []), ...getPrimitiveValues(obj)])];
};

export const DebugInfoTables = (
    obj: unknown,
    tableKeys: TableKeys,
    name: string,
    className: string
) =>
    tableKeys.map(({ keys, values }) => (
        <Table
            key={`${name}${keys.length === 0 ? "" : "."}${keys.join(".")}`}
            className="caption-top grow overflow-hidden w-fit"
            divClassName="w-fit"
        >
            <TableCaption className={cn("text-md font-bold", className)}>
                <div className="[&>div]:leading-none">
                    <div>{name}</div>
                    {keys.map((key, i) => (
                        <div key={key + i}>.{key}</div>
                    ))}
                </div>
            </TableCaption>
            <TableBody className="[&>tr>td]:text-xs [&>tr>td]:leading-none [&>tr]:border-none">
                {values.length === 0 ? (
                    <TableRow className="flex gap-1">
                        <TableCell className="grow font-semibold text-right p-0">
                            {keys[keys.length - 1]}
                        </TableCell>
                        <TableCell className="grow p-0">
                            {JSON.stringify(getNestedValue(obj, keys))}
                        </TableCell>
                    </TableRow>
                ) : (
                    values.map(value => (
                        <TableRow key={value} className="flex gap-1">
                            <TableCell className=" grow font-semibold text-right p-0">
                                {value}
                            </TableCell>
                            <TableCell className="grow p-0">
                                {JSON.stringify(
                                    getNestedValue(obj, [...keys, value])
                                )}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    ));

export function viewportListenersTable(
    viewport: Viewport,
    eventListeners: EventName[],
    className: string
) {
    return (
        <Table
            className="caption-top grow overflow-hidden w-fit"
            divClassName="w-fit"
        >
            <TableCaption className={cn("text-md font-bold", className)}>
                <div className="[&>div]:leading-none">
                    <div>viewport</div>
                    <div>.listenerCount</div>
                </div>
            </TableCaption>
            <TableBody className="[&>tr>td]:text-xs [&>tr>td]:leading-none [&>tr]:border-none">
                {eventListeners.map(event => {
                    const count = viewport.listenerCount(event);
                    if (count === 0) return null;
                    return (
                        <TableRow key={`${event}`} className="flex gap-1">
                            <TableCell className=" grow font-semibold text-right p-0">
                                {event}
                            </TableCell>

                            <TableCell className="grow p-0">{count}</TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

export type DebugInfoProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;
export function DebugInfo({ ...props }: DebugInfoProps) {
    const { id } = useCanvasContext();
    const app = useGlobalApp(id, { autoUpdate: true, throttledUpdate: true });
    const viewport = useGlobalViewport(id);

    const OOB = viewport?.OOB();

    const appKeys: TableKeys = [
        {
            keys: ["screen"],
            values: getTableValues(app?.screen, [
                "left",
                "right",
                "top",
                "bottom",
            ]),
        },
        {
            keys: ["stage"],
            values: getTableValues(app?.stage),
        },
        {
            keys: ["stage", "_bounds"],
            values: getTableValues(app?.stage._bounds),
        },
        {
            keys: ["renderer", "options"],
            values: getTableValues(app?.renderer.options),
        },
        {
            keys: ["ticker"],
            values: getTableValues(app?.ticker, ["FPS"]),
        },
    ];

    const viewportKeys: TableKeys = [
        {
            keys: [],
            values: getTableValues(viewport, [
                "x",
                "y",
                "width",
                "height",
                "screenWidth",
                "screenHeight",
                "worldWidth",
                "worldHeight",
                "worldScreenWidth",
                "worldScreenHeight",
                "screenWorldWidth",
                "screenWorldHeight",
                "screenWidthInWorldPixels",
                "screenHeightInWorldPixels",
                "left",
                "right",
                "top",
                "bottom",
                "scaled",
            ]),
        },
        {
            keys: ["corner"],
            values: getTableValues(viewport?.corner),
        },
        {
            keys: ["center"],
            values: getTableValues(viewport?.center),
        },
        {
            keys: ["position"],
            values: getTableValues(viewport?.position, ["x", "y"]),
        },
        {
            keys: ["_bounds"],
            values: getTableValues(viewport?._bounds),
        },
    ];

    const OOBKeys: TableKeys = [
        {
            keys: [],
            values: getTableValues(OOB),
        },
        {
            keys: ["cornerPoint"],
            values: getTableValues(OOB?.cornerPoint),
        },
    ];

    // lista eventów, które nasłuchuje viewport
    const viewportListeners: EventName[] = [
        // from DisplayObjectEvents type
        "added",
        "removed",
        "destroyed",
        "childAdded",
        "childRemoved",

        // from https://davidfig.github.io/pixi-viewport/jsdoc/
        "bounce-x-end",
        "bounce-x-start",
        "bounce-y-end",
        "bounce-y-start",
        "clicked",
        "drag-end",
        "drag-start",
        "frame-end",
        "mouse-edge-end",
        "mouse-edge-start",
        "moved",
        "moved-end",
        "pinch-end",
        "pinch-start",
        "snap-end",
        "snap-start",
        "snap-zoom-end",
        "snap-zoom-start",
        "wheel",
        "wheel-scroll",
        "zoomed",
        "zoomed-end",

        // custom events
        "opposite-moved",

        // the rest of the events
        "globalmousemove",
        "globalpointermove",
        "globaltouchmove",

        "mousedown",
        "mousedowncapture",
        "mouseup",
        "mouseupcapture",
        "mouseleave",
        "mouseleavecapture",
        "mousemove",
        "mousemovecapture",
        "mouseenter",
        "mouseentercapture",
        "mouseout",
        "mouseoutcapture",
        "mouseover",
        "mouseovercapture",
        "mouseupoutside",
        "mouseupoutsidecapture",

        "click",
        "clickcapture",
        "rightclick",
        "rightclickcapture",
        "rightdown",
        "rightdowncapture",
        "rightup",
        "rightupcapture",
        "rightupoutside",
        "rightupoutsidecapture",

        "plugin-remove",
        "pointercancel",
        "pointercancelcapture",
        "pointerdown",
        "pointerdowncapture",
        "pointerup",
        "pointerupcapture",
        "pointerupoutside",
        "pointerupoutsidecapture",
        "pointerout",
        "pointeroutcapture",
        "pointermove",
        "pointermovecapture",
        "pointerenter",
        "pointerentercapture",
        "pointerleave",
        "pointerleavecapture",
        "pointerover",
        "pointerovercapture",
        "pointertap",
        "pointertapcapture",

        "tap",
        "tapcapture",
        "touchcancel",
        "touchcancelcapture",
        "touchend",
        "touchendcapture",
        "touchendoutside",
        "touchendoutsidecapture",
        "touchmove",
        "touchmovecapture",
        "touchstart",
        "touchstartcapture",

        "wheel-start",
        "wheelcapture",
    ];

    return (
        <div className="w-full h-fit overflow-auto">
            <div
                className="w-full h-full flex flex-wrap justify-start items-start gap-1 px-2"
                {...props}
            >
                {app && DebugInfoTables(app, appKeys, "app", "text-red-400")}
                {OOB &&
                    DebugInfoTables(
                        OOB,
                        OOBKeys,
                        "viewport.OOB()",
                        "text-emerald-400"
                    )}
                {viewport &&
                    DebugInfoTables(
                        viewport,
                        viewportKeys,
                        "viewport",
                        "text-sky-400"
                    )}
                {viewport &&
                    viewportListenersTable(
                        viewport,
                        viewportListeners,
                        "text-amber-400"
                    )}
            </div>
        </div>
    );
}
