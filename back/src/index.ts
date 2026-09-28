import { createServer } from 'http';
import { createApp } from "./app";
import { container } from "./container";
import { env } from "./env";

export const app = createApp(container);
export const server = createServer(app);

server.listen(env.PORT, () => {
    console.log(`[server]: Server is running at ${env.HOST}`);
});
