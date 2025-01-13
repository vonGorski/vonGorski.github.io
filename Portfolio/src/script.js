const fs = require('fs-extra');
const globby = require('globby');
const postcss = require('postcss');
const postcssScss = require('postcss-scss');

const VARIABLES_FILE = 'src/styles/variables.scss'; // Path to the variables file
const SCSS_FILES_GLOB = 'src/**/*.scss'; // Glob to match all SCSS files
const COLOR_REGEX = /#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)/g;

// Step 1: Load color variables from styles/variables.scss
async function loadColorVariables() {
    if (!fs.existsSync(VARIABLES_FILE)) {
        console.error(`Variables file not found: ${VARIABLES_FILE}`);
        process.exit(1);
    }

    const content = await fs.readFile(VARIABLES_FILE, 'utf-8');
    const variables = {};
    content.split('\n').forEach((line) => {
        const match = line.match(/\$([\w-]+):\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\));/);
        if (match) {
            variables[match[2]] = `$${match[1]}`;
        }
    });

    return variables;
}

// Step 2: Add @use directive if needed
function ensureUseDirective(content) {
    const useDirective = `@use "styles/variables.scss";`;
    if (!content.includes(useDirective)) {
        return `${useDirective}\n${content}`;
    }
    return content;
}

// Step 3: Process a single SCSS file
async function processScssFile(file, colorVariables) {
    let content = await fs.readFile(file, 'utf-8');
    const root = postcss.parse(content, { parser: postcssScss });

    let updated = false;

    root.walkDecls((decl) => {
        const colors = decl.value.match(COLOR_REGEX);
        if (colors) {
            colors.forEach((color) => {
                if (colorVariables[color]) {
                    decl.value = decl.value.replace(color, colorVariables[color]);
                    updated = true;
                }
            });
        }
    });

    if (updated) {
        content = ensureUseDirective(root.toString());
        await fs.writeFile(file, content);
        console.log(`Updated: ${file}`);
    }
}

// Step 4: Process all SCSS files
async function processAllScssFiles() {
    const colorVariables = await loadColorVariables();
    const files = await globby(SCSS_FILES_GLOB);

    if (files.length === 0) {
        console.error('No SCSS files found.');
        return;
    }

    console.log(`Found ${files.length} SCSS files. Processing...`);

    for (const file of files) {
        await processScssFile(file, colorVariables);
    }

    console.log('Done!');
}

// Run the script
processAllScssFiles().catch((error) => {
    console.error('Error:', error);
});