import { Worker } from "worker_threads";
import path from "path";

export function runEditorParser(data: any): Promise<string> {
  return new Promise((resolve, reject) => {

    const isTs = __filename.endsWith(".ts");

    const workerPath = path.resolve(
      __dirname,
      isTs
        ? "../workers/editorParser.worker.ts"
        : "../workers/editorParser.worker.js"
    );

    const worker = new Worker(workerPath, {
      execArgv: isTs ? ["-r", "ts-node/register"] : [],
    });

    worker.postMessage(data);

    worker.on("message", (result) => {
      if (result.success) {
        resolve(result.html);
      } else {
        reject(new Error(result.error));
      }
    });

    worker.on("error", reject);

    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}