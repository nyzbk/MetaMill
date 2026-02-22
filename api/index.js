let isSetup = false;
let appInstance = null;

export default async function handler(req, res) {
    try {
        if (!isSetup) {
            console.log("[Vercel] Importing dist/index.cjs...");
            const serverModule = await import("../dist/index.cjs");
            appInstance = serverModule.app;
            console.log("[Vercel] Running setup()...");
            await serverModule.setup();
            isSetup = true;
            console.log("[Vercel] Setup complete.");
        }

        console.log(`[Vercel] Routing ${req.method} ${req.url} to Express app`);
        return appInstance(req, res);
    } catch (error) {
        console.error("[Vercel Function Error]:", error);
        if (!res.headersSent) {
            res.status(500).json({
                message: "Initialization Error",
                error: error.message || error.toString(),
                stack: error.stack
            });
        }
    }
}
