import "./globals.css";
import "@/lib/locales/i18n";

import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAppMount } from "@/lib/hooks/useAppMount";
import { KeyboardLayoutProvider } from "@/lib/hooks/useKeyboardLayout";

function Dynamic({ children }: { children: ReactNode }) {
    const hasMounted = useAppMount();

    if (!hasMounted) {
        return null;
    }

    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>;
}

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <>
            <div
                id="app"
                className="select-none h-full w-full flex flex-col items-center justify-between overflow-hidden"
            >
                <KeyboardLayoutProvider>
                    <Dynamic>{children}</Dynamic>
                </KeyboardLayoutProvider>
            </div>
            <Toaster />
        </>
    );
}
