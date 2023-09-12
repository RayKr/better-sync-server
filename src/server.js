// // ESM
// import Fastify from "fastify";
// import shell from "shelljs";
// import path from "path";

// CJS
const Fastify = require("fastify")
const shell = require("shelljs")
// fix: Unable to find a path to node binary
// https://github.com/shelljs/shelljs/issues/704
shell.config.execPath = shell.which("node").toString()
const path = require("path")

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

app.listen({ port: 12138 }, (err, address) => {
  if (err) throw err
  // Server is now listening on ${address}
})

class BetterSyncHandler {
  constructor(event, items, base_path) {
    this.event = event
    this.items = items
    this.base_path = base_path

    this.counts = {
      forward: 0,
      inverse: 0,
      skipped: 0,
      removed: 0,
      error: 0,
    }

    this.hook()
  }

  hook() {
    if (this.event === "modify") {
      this._rmAllSameFiles()
    }
    this.items.forEach((item) => {
      item.base_path = this.base_path
      item.linked_dir = path.join(this.base_path, item.linked_dir)
      item.linked_file = path.join(
        item.linked_dir,
        path.basename(item.stored_file)
      )

      switch (this.event) {
        case "modify": // modify linked to stored
          // 在base_path下查找所有samefile
          this.modifySync(item)
          break
        case "trash": // move to trash
        case "delete": // delete permanently
          this.deleteSync(item.linked_file)
          break
        case "add": // add stored to linked
          this.forwardSync(item)
          break
        case "auto":
          this.autoSync(item)
          break
        default:
          return { code: 500, message: "Not support event." }
      }
    })
  }

  forwardSync(item) {
    if (shell.test("-e", item.stored_file)) {
      // create linked_dir if not exists
      if (!shell.test("-e", item.linked_dir)) {
        shell.mkdir("-p", item.linked_dir)
      }

      shell.ln("-f", item.stored_file, item.linked_file)
      this.counts["forward"] += 1
    } else {
      this.counts["error"] += 1
    }
  }

  inverseSync(item) {
    if (shell.test("-e", item.linked_file)) {
      shell.ln("-f", item.linked_file, item.stored_file)
      this.counts["inverse"] += 1
    } else {
      this.counts["error"] += 1
    }
  }

  modifySync(item) {
    // All samefiles have been cleared before, here you only need to rebuild the link.
    this.forwardSync(item)
  }

  deleteSync(file) {
    // del target file directly
    shell.rm("-f", file)
    this.counts["removed"] += 1
    // After deleting the file, if the folder is empty, delete the folders layer by layer.
    let dir = path.dirname(file)
    while (dir !== this.base_path) {
      if (shell.ls(dir).length !== 0) {
        break
      }
      shell.rm("-rf", dir)
      dir = path.dirname(dir)
    }
  }

  autoSync(item) {
    if (shell.test("-e", item.stored_file)) {
      // create linked_dir if not exists
      if (!shell.test("-e", item.linked_dir)) {
        shell.mkdir("-p", item.linked_dir)
      }

      // check existence of same inode files in linked_dir
      this._rmDuplicatedFiles(item)

      // check existence of the linked_file
      if (!shell.test("-e", item.linked_file)) {
        this.forwardSync(item)
      } else {
        // linked_file exists but not same inode, inverseSync
        if (!_getSameInodeFiles(item.linked_dir, item.stored_file).length) {
          // TODO 此处逻辑不够严谨，文件存在但不同inode，会被hack，最好还是要检查一下pdf的metadata是否相同
          // TODO 如果pdf metadata相同，直接可以inverseSync，如果不同，需要先删除linked_file，再forwardSync
          this.inverseSync(item)
        } else {
          // same filename, same inode, skip
          this.counts["skipped"] += 1
        }
      }
    } else {
      this.counts["error"] += 1
    }
  }

  _rmAllSameFiles() {
    this.items.forEach((item) => {
      const samefiles = _getSameInodeFiles(this.base_path, item.stored_file)
      samefiles.forEach((file) => {
        // delete different filename files
        if (file !== item.stored_file) {
          this.deleteSync(file)
        }
      })
    })
  }

  _rmDuplicatedFiles(item) {
    const same_inode_files = _getSameInodeFiles(
      item.linked_dir,
      item.stored_file
    )
    same_inode_files.forEach((file) => {
      // delete different filename files
      if (file !== item.linked_file) {
        this.deleteSync(file)
      }
    })
  }

  getCounts() {
    return this.counts
  }
}

function _getSameInodeFiles(dir, file) {
  shell.exec(`find "${dir}" -samefile "${file}"`)
  const files = shell
    .exec(`find "${dir}" -samefile "${file}"`)
    .stdout.split("\n")
  files.pop()
  return files
}

module.exports = {
  server: app,
}
