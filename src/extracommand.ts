export const CMD_REBOOT:number          = 800		// REBOOT	
export const CMD_SHUTDOWN:number       	= 801   // SHUTDOWN
export const CMD_RESTART_MONITOR:number	= 802   // RESTART HBJSON
export const CMD_RESTART_HBNET:number	  = 803   // RESTART HBNET	

export class Extra {
  rts_update(destination: number): void {
    switch(destination) {
      case CMD_REBOOT: 
        // os.system('reboot')
        break

      case CMD_SHUTDOWN:
        // os.system('shutdown')
        break

      case CMD_RESTART_MONITOR:
        // os.system('sudo systemctl restart hbjson.service')
        break

      case CMD_RESTART_HBNET:
        // os.system('sudo systemctl restart hbnet.service')
        break
    }
  }
}
