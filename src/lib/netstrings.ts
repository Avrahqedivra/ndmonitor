/*
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the'Software'), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 *  Copyright(c) 2023-26 F4JDN - Jean-Michel Cohen
 *
 */

import fs from "fs"
import { logger } from "../monitor.js"
import * as config from "../config.js"

export class NetStringReceiver {
  private receiveBox: ((box: Buffer) => void) | null = null
  private box: Buffer = Buffer.alloc(0)
  private _unprocessed = Buffer.alloc(0)
  private totalLength: number = 0
  private offset: number = 0

  constructor(receiveBoxCallback: any) {
    this.receiveBox =
      receiveBoxCallback ||
      function (box: Buffer) {
        logger.info(box.toString())
      }
  }

  reSync(): void {
    this.box = Buffer.alloc(0)
    this._unprocessed = Buffer.alloc(0)
    this.totalLength = 0
    this.offset = 0
  }

  kill(): void {
    this.receiveBox = null
  }

  dataReceived(data: any) {
    try {
      // Get callback reference and validate immediately
      const callback = this.receiveBox

      if (callback === null) {
        logger.info("receiveBox is null, ignoring data")
        return
      }

      if (typeof callback !== "function") {
        logger.error(`receiveBox is not a function, it's a ${typeof callback}`)
        return
      }

      this._unprocessed = Buffer.concat([this._unprocessed, data])

      while (this._unprocessed.length) {
        if (this.offset == 0) {
          const colonIndex = this._unprocessed.indexOf(":")
          if (colonIndex == -1) break

          this.totalLength = parseInt(
            this._unprocessed.subarray(0, colonIndex).toString(),
          )
          this.offset = colonIndex + 1
        }

        if (this._unprocessed.length < this.totalLength + this.offset) break

        this.box = this._unprocessed.subarray(
          this.offset,
          this.totalLength + this.offset,
        )
        this._unprocessed = Buffer.from(
          this._unprocessed.subarray(this.totalLength + this.offset + 1),
        )
        this.offset = 0

        // Call with the stored reference
        callback(this.box)
        this.box = Buffer.alloc(0)
      }
    } catch (e) {
      console.error("NetString error:", e)
      this.reSync()
      logger.info("NetString out of sync. Please relaunch the monitor")

      if (config.__loginfo__) {
        fs.writeFileSync(
          `${config.__log_path__}$/NETSTRING${Date.now()}.txt`,
          data.toString("utf-8"),
          { encoding: "utf8" },
        )
      }
    }
  }
}
