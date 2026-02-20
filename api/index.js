import { app, setup } from "../server/index";

export default async function handler(req, res) {
    await setup();
    return app(req, res);
}
