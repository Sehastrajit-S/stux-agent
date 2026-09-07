import fs from "fs";
import path from "path";

const OUTPUT_PATH =
  process.env.OUTPUT_JSON_PATH ||
  path.join(process.cwd(), "..", "output", "tasks_and_courses.json");

export default function handler(req, res) {
  let records = [];
  let generatedAt = null;
  let error = null;

  try {
    const stat = fs.statSync(OUTPUT_PATH);
    const raw = fs.readFileSync(OUTPUT_PATH, "utf-8");
    records = JSON.parse(raw);
    generatedAt = stat.mtime.toISOString();
  } catch (err) {
    error =
      err.code === "ENOENT"
        ? "not_found"
        : `read_error: ${err.message}`;
  }

  res.status(200).json({ records, generatedAt, error, path: OUTPUT_PATH });
}
