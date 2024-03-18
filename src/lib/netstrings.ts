/*
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 *
 *  Copyright(c) 2023-24 F4JDN - Jean-Michel Cohen
 *  
*/
import fs from 'fs'
import { logger } from "../monitor.js"
import * as config from '../config.js'

export class NetStringReceiver {
  private receiveBox = null
  private box: Buffer = Buffer.alloc(0)
  private _unprocessed = Buffer.alloc(0)
  private totalLength: number = 0
  private offset: number = 0

  constructor(receiveBoxCallback: any) {
    this.receiveBox = receiveBoxCallback || function(box: Buffer) { logger.info(box.toString()) }
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
      if (this.receiveBox === null)
        return

      this._unprocessed = Buffer.concat([this._unprocessed, data]);

      while(this._unprocessed.length) {
        if (this.offset == 0) {
          const colonIndex = this._unprocessed.indexOf(":")
          if (colonIndex == -1)
            break

          this.totalLength = parseInt(this._unprocessed.subarray(0, colonIndex).toString())
          this.offset = colonIndex + 1
        }
        
        // if we need more data skip until next packet
        if (this._unprocessed.length < this.totalLength)
          break

        // we are done, get the box
        this.box = this._unprocessed.subarray(this.offset, this.totalLength+this.offset)
        // adjust buffer for next round
        this._unprocessed = Buffer.from(this._unprocessed.subarray(this.totalLength+this.offset+1))
        // reset local pointer
        this.offset = 0

        this.receiveBox(this.box)
        // reset box
        this.box = Buffer.alloc(0)
      }
    }catch(e) {
      this.reSync()
      logger.info('NetString out of sync. Please relaunch the monitor')

      if (config.__loginfo__) {
        fs.writeFileSync(`${config.__log_path__}$/NETSTRING${Date.now()}.txt`, data.toString('utf-8'), { encoding: 'utf8' })
      }
    }
  }
}
