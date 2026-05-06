import { IS_MACOS } from "@/lib/utils/platform";

export function MacOSTitleBarSpacer() {
    if (!IS_MACOS) return null;
    return <div className="w-[80px] shrink-0" aria-hidden="true" />;
}
