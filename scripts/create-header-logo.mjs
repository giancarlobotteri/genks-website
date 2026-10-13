import { writeFile } from "node:fs/promises";
import { genksLetters } from "../src/data/genks-lettering.ts";
const paths = genksLetters.map(letter => `<path d="${letter.path}"/>`).join("");
await writeFile(new URL("../public/brand/genks-header.svg", import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 1098 538"><g fill="#dceaff" fill-rule="evenodd">${paths}</g></svg>`);
