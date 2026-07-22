import path from "path";

export function extractFolderName(filePath: string | undefined) {
  // Use path.dirname to get the directory path
  if(!filePath) return "";
  const segments = filePath.split(path.sep).filter(Boolean); // removes empty strings
  const result = `${segments.slice(0, 2).join('/')}`;
  return result;
}
