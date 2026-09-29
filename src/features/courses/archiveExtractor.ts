import JSZip from "jszip";

export interface ProcessedKbFile {
  file: File;
  relativePath: string;
  title: string;
}

export interface ExtractionResult {
  files: ProcessedKbFile[];
  skippedCount: number;
  unsupportedTypes: string[];
}

export const SUPPORTED_KB_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "txt",
  "md",
  "markdown",
  "csv",
]);

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
};

/** Get lowercase file extension without dot. */
export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/** Check if the file extension is supported by Knowledge Base. */
export function isSupportedKbExtension(filename: string): boolean {
  return SUPPORTED_KB_EXTENSIONS.has(getFileExtension(filename));
}

/** Check if a file is a zip archive. */
export function isZipArchive(file: File | { name: string; type?: string }): boolean {
  const ext = getFileExtension(file.name);
  if (ext === "zip") return true;
  if ("type" in file && file.type) {
    return (
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      file.type === "multipart/x-zip"
    );
  }
  return false;
}

/** Check if path is hidden, OS metadata, or system junk. */
export function isIgnoredPath(fullPath: string): boolean {
  const normalized = fullPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  // Skip macOS metadata folders or root zip junk
  if (segments.some((seg) => seg === "__MACOSX")) return true;

  const filename = segments[segments.length - 1] || "";
  // Hidden files (e.g. .DS_Store, .git, ._file.pdf, .env)
  if (filename.startsWith(".")) return true;
  // Windows desktop/thumbnail caches
  if (filename.toLowerCase() === "thumbs.db" || filename.toLowerCase() === "desktop.ini") {
    return true;
  }

  // Any parent directory starting with a dot
  if (segments.slice(0, -1).some((dir) => dir.startsWith("."))) {
    return true;
  }

  return false;
}

function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

/**
 * Extracts and unpacks a .zip archive into an array of ProcessedKbFile objects.
 */
export async function extractZipArchive(zipFile: File): Promise<ExtractionResult> {
  const zip = await JSZip.loadAsync(zipFile);
  const files: ProcessedKbFile[] = [];
  let skippedCount = 0;
  const unsupportedTypesSet = new Set<string>();

  const entries: JSZip.JSZipObject[] = [];
  zip.forEach((_, entry) => {
    entries.push(entry);
  });

  for (const entry of entries) {
    if (entry.dir) continue;
    if (isIgnoredPath(entry.name)) {
      skippedCount++;
      continue;
    }

    const ext = getFileExtension(entry.name);
    if (!isSupportedKbExtension(entry.name)) {
      skippedCount++;
      if (ext) unsupportedTypesSet.add(`.${ext}`);
      continue;
    }

    const blob = await entry.async("blob");
    const filename = entry.name.split("/").pop() || entry.name;
    const file = new File([blob], filename, {
      type: getMimeType(entry.name),
      lastModified: entry.date ? entry.date.getTime() : Date.now(),
    });

    files.push({
      file,
      relativePath: entry.name,
      title: entry.name,
    });
  }

  return {
    files,
    skippedCount,
    unsupportedTypes: Array.from(unsupportedTypesSet),
  };
}

/**
 * Reads all entries in a FileSystemDirectoryReader (looping until exhausted).
 */
async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch || batch.length === 0) break;
    entries.push(...batch);
  }
  return entries;
}

/**
 * Recursively traverses a FileSystemEntry (file or directory).
 */
async function traverseFileSystemEntry(
  entry: FileSystemEntry,
  pathPrefix: string,
  out: {
    files: ProcessedKbFile[];
    skippedCount: number;
    unsupportedTypesSet: Set<string>;
  },
): Promise<void> {
  const currentPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;

  if (isIgnoredPath(currentPath)) {
    out.skippedCount++;
    return;
  }

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });

    if (isZipArchive(file)) {
      try {
        const zipResult = await extractZipArchive(file);
        for (const zf of zipResult.files) {
          const combinedPath = pathPrefix ? `${pathPrefix}/${zf.relativePath}` : zf.relativePath;
          out.files.push({
            file: zf.file,
            relativePath: combinedPath,
            title: combinedPath,
          });
        }
        out.skippedCount += zipResult.skippedCount;
        zipResult.unsupportedTypes.forEach((t) => out.unsupportedTypesSet.add(t));
      } catch (err) {
        console.error("Failed to unpack zip entry inside directory", file.name, err);
        out.skippedCount++;
      }
      return;
    }

    const ext = getFileExtension(file.name);
    if (!isSupportedKbExtension(file.name)) {
      out.skippedCount++;
      if (ext) out.unsupportedTypesSet.add(`.${ext}`);
      return;
    }

    out.files.push({
      file,
      relativePath: currentPath,
      title: currentPath,
    });
    return;
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const children = await readAllDirectoryEntries(reader);
    for (const child of children) {
      await traverseFileSystemEntry(child, currentPath, out);
    }
  }
}

/**
 * Processes items from a DragEvent's dataTransfer.
 * Accurately extracts directories and ZIP archives.
 */
export async function processDataTransfer(
  dataTransfer: DataTransfer,
): Promise<ExtractionResult> {
  const out = {
    files: [] as ProcessedKbFile[],
    skippedCount: 0,
    unsupportedTypesSet: new Set<string>(),
  };

  const items = Array.from(dataTransfer.items || []);
  const entries: FileSystemEntry[] = [];

  for (const item of items) {
    if (typeof item.webkitGetAsEntry === "function") {
      const entry = item.webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseFileSystemEntry(entry, "", out);
    }
  } else {
    // Fallback if webkitGetAsEntry is unavailable
    const files = Array.from(dataTransfer.files || []);
    return processFileList(files);
  }

  return {
    files: out.files,
    skippedCount: out.skippedCount,
    unsupportedTypes: Array.from(out.unsupportedTypesSet),
  };
}

/**
 * Processes a FileList (e.g. from standard file input or webkitdirectory folder input).
 * If any file is a .zip archive, extracts its contents.
 */
export async function processFileList(
  fileList: FileList | File[],
): Promise<ExtractionResult> {
  const list = Array.from(fileList);
  const files: ProcessedKbFile[] = [];
  let skippedCount = 0;
  const unsupportedTypesSet = new Set<string>();

  for (const file of list) {
    const relativePath = file.webkitRelativePath || file.name;
    if (isIgnoredPath(relativePath)) {
      skippedCount++;
      continue;
    }

    if (isZipArchive(file)) {
      try {
        const zipResult = await extractZipArchive(file);
        files.push(...zipResult.files);
        skippedCount += zipResult.skippedCount;
        zipResult.unsupportedTypes.forEach((t) => unsupportedTypesSet.add(t));
      } catch (err) {
        console.error("Failed to unpack zip file", file.name, err);
        skippedCount++;
      }
      continue;
    }

    const ext = getFileExtension(file.name);
    if (!isSupportedKbExtension(file.name)) {
      skippedCount++;
      if (ext) unsupportedTypesSet.add(`.${ext}`);
      continue;
    }

    files.push({
      file,
      relativePath,
      title: relativePath !== file.name ? relativePath : file.name,
    });
  }

  return {
    files,
    skippedCount,
    unsupportedTypes: Array.from(unsupportedTypesSet),
  };
}
