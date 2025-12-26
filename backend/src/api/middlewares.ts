import {
  defineMiddlewares,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse
} from "@medusajs/framework/http"
import * as fs from "fs"
import * as path from "path"

// Track if we've logged the static directory info
let hasLoggedStaticDir = false

/**
 * Middleware to serve the Nocto admin SPA at /app
 */
function serveNoctoAdmin(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Try multiple possible locations for static files
  // In production, files are copied to .medusa/server/static/app by postBuild.js
  // In development, they're at the project root static/app
  const possiblePaths = [
    path.resolve(process.cwd(), "static/app"),           // Production (from .medusa/server) or Dev
    path.resolve(process.cwd(), "../static/app"),        // Alternative from .medusa/server
    path.resolve(__dirname, "../../static/app"),         // Relative to compiled file in src/api
  ]

  const staticDir = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0]

  // Debug log on first request
  if (!hasLoggedStaticDir) {
    console.log("[Nocto] Static dir search paths:", possiblePaths.map(p => `${p} (${fs.existsSync(p) ? 'EXISTS' : 'missing'})`))
    console.log("[Nocto] Using static dir:", staticDir)
    hasLoggedStaticDir = true
  }

  // Get the requested path after /app
  const requestedPath = req.path.replace(/^\/app\/?/, "") || ""

  // Try to find the file
  let filePath = path.join(staticDir, requestedPath)

  // If it's a directory or doesn't exist, try index.html (SPA routing)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(staticDir, "index.html")
  }

  // If file still doesn't exist, pass to next handler
  if (!fs.existsSync(filePath)) {
    return next()
  }

  // Get file extension and set content type
  const ext = path.extname(filePath).toLowerCase()
  const contentTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
  }

  const contentType = contentTypes[ext] || "application/octet-stream"

  // Read and send the file
  const fileContent = fs.readFileSync(filePath)
  res.setHeader("Content-Type", contentType)

  // Cache static assets (not HTML)
  if (ext !== ".html") {
    res.setHeader("Cache-Control", "public, max-age=31536000")
  }

  return res.send(fileContent)
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/app",
      middlewares: [serveNoctoAdmin],
    },
    {
      matcher: "/app/*",
      middlewares: [serveNoctoAdmin],
    },
  ],
})
