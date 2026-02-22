// eslint-disable-next-line import/no-extraneous-dependencies
import "@testing-library/jest-dom";
import * as nodeCrypto from "node:crypto";

const nodeGlobal = global as typeof global & {
    crypto?: typeof nodeCrypto & { randomUUID?: () => string };
};

if (!nodeGlobal.crypto) {
    // @ts-expect-error Jest/Node may not provide Web Crypto in this environment.
    nodeGlobal.crypto = nodeCrypto;
}

if (!nodeGlobal.crypto.randomUUID) {
    Object.defineProperty(nodeGlobal.crypto, "randomUUID", {
        value: () => nodeCrypto.randomBytes(16).toString("hex"),
        configurable: true,
    });
}
