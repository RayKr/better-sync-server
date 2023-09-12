class Quicklook {
  constructor(items) {
    this.items = items

    if (!items) {
      throw new Error("Missing parameters.")
    }

    if (items.length < 1) {
      throw new Error("Items is empty.")
    }
  }

  getItems() {
    return this.items
  }

  getQLString() {
    // First add "" to each item and then join
    return this.items
      .map((item) => {
        return `"${item}"`
      })
      .join(" ")
  }

  async run() {
    // Only support macOS for now
    if (process.platform !== "darwin") {
      throw new Error("Not support platform.")
    }

    const { exec } = require("child_process")
    const qlstr = this.getQLString()
    console.log(qlstr)
    const cmd = `qlmanage -p ${qlstr}`
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.log(err)
        return
      }
      console.log(stdout)
    })
  }
}

module.exports = {
  Quicklook,
}
