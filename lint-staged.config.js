module.exports = {
    // This will lint and format TypeScript and                                             //JavaScript files
    "**/*.(ts|tsx|js|jsx)": filenames => [
        `bunx eslint --fix ${filenames.join(" ")}`,
        `bunx prettier --write ${filenames.join(" ")}`,
    ],

    // this will Format MarkDown and JSON
    "**/*.(md|json)": filenames =>
        `bunx prettier --write ${filenames.join(" ")}`,
};
