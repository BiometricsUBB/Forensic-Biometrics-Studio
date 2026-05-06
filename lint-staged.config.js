module.exports = {
    "**/*.(ts|tsx|js|jsx)": filenames => [
        `bunx oxlint --fix ${filenames.join(" ")}`,
        `bunx prettier --write ${filenames.join(" ")}`,
    ],

    "**/*.(md|json)": filenames =>
        `bunx prettier --write ${filenames.join(" ")}`,
};
