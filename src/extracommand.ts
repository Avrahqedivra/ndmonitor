import { exec } from "child_process";

export const CMD_REBOOT:number          = 800		// REBOOT	
export const CMD_SHUTDOWN:number       	= 801   // SHUTDOWN
export const CMD_RESTART_MONITOR:number	= 802   // RESTART HBJSON
export const CMD_RESTART_HBNET:number	  = 803   // RESTART HBNET	

/**
 * adapt commands to your needs
 */
export class Extra {
  rts_update(destination: number): void {
    switch(destination) {
      case CMD_REBOOT: 
        exec('sudo /sbin/shutdown -r now', function (msg) { console.log(msg) });
        break

      case CMD_SHUTDOWN:
        exec('shutdown')
        break

      case CMD_RESTART_MONITOR:
        exec('sudo systemctl restart ndmonitor.service')
        break

      case CMD_RESTART_HBNET:
        exec('sudo systemctl restart hbnet.service')
        break
    }
  }
}
