// CJS
const Fastify = require("fastify")
const BetterSyncHandler = require("./sync.js")
const { Quicklook } = require("./tool.js")

const app = Fastify({
  logger: true,
})

app.get("/", async (request, reply) => {
  reply.type("application/json").code(200)
  return { hello: "world" }
})

app.post("/api/v1/sync", async (request, reply) => {
  app.log.info(request.body)
  const items = request.body.items
  const event = request.body.event
  const base_path = request.body.base_path
  if (!items || !event || !base_path) {
    return { code: 500, message: "Missing parameters." }
  }

  const handler = new BetterSyncHandler(event, items, base_path)
  const counts = handler.getCounts()
  app.log.info(counts)

  reply.type("application/json").code(200)
  return { code: 200, message: "Success.", data: counts }
})

app.post("/api/v1/ql", async (request, reply) => {
  app.log.info("[Quicklook]", request.body)
  const items = request.body.items

  try {
    const ql = new Quicklook(items)
    ql.run()
  } catch (err) {
    app.log.error(err)
    return { code: 500, message: err }
  }

  reply.type("application/json").code(200)
  return { code: 200, message: "Quicklook succeed." }
})

app.listen({ port: 12138 }, (err, address) => {
  if (err) throw err
  // Server is now listening on ${address}
})

module.exports = {
  server: app,
}
