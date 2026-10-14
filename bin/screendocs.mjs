#!/usr/bin/env node
import { run } from "../src/cli.mjs";

run(process.argv.slice(2)).catch((err) => {
  console.error(`\nscreendocs: ${err.message}`);
  if (process.env.SCREENDOCS_DEBUG) console.error(err);
  process.exit(1);
});
