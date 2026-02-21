import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Support both ES module and CommonJS environments
const dirname = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname;

export function serveStatic(app: Express) {
  let distPath = path.resolve(dirname, "public");

  if (!fs.existsSync(distPath)) {
    // Try the root dist/public if running locally from elsewhere
    distPath = path.resolve(process.cwd(), "dist/public");
  }

  if (!fs.existsSync(distPath)) {
    if (process.env.VERCEL) {
      // Vercel Edge Cache serves static files, Serverless Function only handles API.
      return;
    }
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
