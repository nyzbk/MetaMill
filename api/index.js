import { app, setup } from "../dist/index.cjs";

let isSetup = false;

export default async function handler(req, res) {
    try {
        if (!isSetup) {
            await setup();
            isSetup = true;
        }
        return app(req, res);
    } catch (error) {
        console.error("Vercel Function Error:", error);
        if (!res.headersSent) {
            res.status(500).json({
                message: "Initialization Error",
                error: error.message
            });
        }
    }
}
