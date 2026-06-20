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

import { exec } from "child_process"

export const CMD_REBOOT: number = 800 // REBOOT
export const CMD_SHUTDOWN: number = 801 // SHUTDOWN
export const CMD_RESTART_MONITOR: number = 802 // RESTART HBJSON
export const CMD_RESTART_HBNET: number = 803 // RESTART HBNET

/**
 * adapt commands to your needs
 */
export class Extra {
  rts_update(destination: number): void {
    switch (destination) {
      case CMD_REBOOT:
        exec("sudo /sbin/shutdown -r now", function (msg) {
          console.log(msg)
        })
        break

      case CMD_SHUTDOWN:
        exec("shutdown")
        break

      case CMD_RESTART_MONITOR:
        exec("sudo systemctl restart ndmonitor.service")
        break

      case CMD_RESTART_HBNET:
        exec("sudo systemctl restart hbnet.service")
        break
    }
  }
}
