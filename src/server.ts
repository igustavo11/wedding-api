import fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";

function buildServer() {
    const app = fastify({ logger: false });
    app.register(cors, {
        origin: true,
    });
    app.get("/health", async (request, reply) => {
        return reply.status(200).send({message: "server running"})
    });
    return app;
}

async function startServer(){
    const app = buildServer();
    try {
        await app.listen({
            port: env.PORT,
            host: '0.0.0.0'
        });
        console.log(`Server listening on port ${env.PORT}`);
    } catch(error){
        app.log.error(error);
        process.exit(1);
    }
}
startServer();