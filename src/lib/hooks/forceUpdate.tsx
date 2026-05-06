import { useReducer } from "react";

export const useUpdater = () => {
    const [, updater] = useReducer(x => x ^ 1, 0);
    return updater;
};
