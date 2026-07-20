import { parentPort } from "worker_threads";
import editorjsHTML from "editorjs-html";

const parser = editorjsHTML();

parentPort?.on("message", (data) => {
  try {
    const html = parser.parse(data);

    parentPort?.postMessage({
      success: true,
      html,
    });
  } catch (error) {
    parentPort?.postMessage({
      success: false,
      error: (error as Error).message,
    });
  }
});