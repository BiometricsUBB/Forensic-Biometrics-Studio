import React from "react";
import ReactDOM from "react-dom/client";
import RootLayout from "@/app/layout";
import { SettingsWindow } from "@/components/settings-window/settings-window";
import { EditWindow } from "@/components/edit-window/edit-window";
import App from "./App";

const urlParams = new URLSearchParams(window.location.search);
const windowType = urlParams.get("window");

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <RootLayout>
            {windowType === "settings" ? (
                <SettingsWindow />
            ) : windowType === "edit" ? (
                <EditWindow />
            ) : (
                <App />
            )}
        </RootLayout>
    </React.StrictMode>
);
