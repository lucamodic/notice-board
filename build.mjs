import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("./dist/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("./public/", import.meta.url), output, { recursive: true });

for (const file of ["index.html", "mission-board.js", "styles.css"]) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(file, output));
}

console.log("Sitio estático generado en dist/");
