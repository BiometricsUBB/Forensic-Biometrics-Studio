// `any` is unavoidable here: variadic tuple/generic inference requires it.
/* oxlint-disable typescript/no-explicit-any */
type Last<T extends readonly any[]> = T extends readonly [...infer _, infer L]
    ? L
    : never;

export function computeCombined<
    const T extends readonly ((...args: any[]) => any)[],
>(fns: T): ReturnType<Last<T>> {
    let args: any[] | undefined = [];

    for (const func of fns) {
        if (args === undefined) {
            // @ts-expect-error it's fine
            return undefined;
        }

        if (Object.prototype.toString.call(args) !== "[object Array]") {
            args = [args];
        }

        args = func(...args);
    }

    return args as ReturnType<Last<T>>;
}
