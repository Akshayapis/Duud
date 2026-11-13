// Regenerate kaggle/worker/worker.ipynb from worker.py.
// Cell 0: markdown. Cell 1: UAPP_JOB_PAYLOAD placeholder (server replaces it).
// Cell 2: full worker source + main(). Never reorder these cells.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = fs.readFileSync(path.join(root, "kaggle/worker/worker.py"), "utf8");
const notebook = {
  cells: [
    {
      cell_type: "markdown",
      metadata: {},
      source: "# U APP — Android Build Worker\n\nPrivate build notebook. The server injects the job payload into the `UAPP_JOB_PAYLOAD` cell before pushing.\n",
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: "# UAPP_JOB_PAYLOAD\nJOB = None\n",
    },
    {
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: worker + "\n",
    },
  ],
  metadata: {
    kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
    language_info: { name: "python", version: "3.11" },
  },
  nbformat: 4,
  nbformat_minor: 5,
};
fs.writeFileSync(path.join(root, "kaggle/worker/worker.ipynb"), JSON.stringify(notebook, null, 1) + "\n");
console.log("worker.ipynb regenerated from worker.py");
