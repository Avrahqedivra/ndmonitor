
** NDMonitor is a NODEJS micro service providing JSON data from FreeDMR or HBLink **
    
    - almost not templated, easily editable
    - map location of transmitting OMs
    - graphic statistics etc...

    Prerequisites:

    - nodejs    (as recent as possible)
    - npm       (as recent as possible)

    must be installed 
    
    cd /opt
    git clone https://github.com/Avrahqedivra/ndmonitor.git
    cd ndmonitor

    to install needed packages : 
    
        npm install
    
    then make a config.ts file
        
        cd src
        cp config_sample.txt config.ts

    edit an adjust the port, ip address to match your server requirements: 

        edit config.ts      (use an UTF-8 capable editor, vscode or notepad++ for exemple)
    
    build the transpiled files with: 
        
        return to the ndmonitor main folder

        npm run build

    after build test with: 
    
        node ./dist/monitor.js
    
    test with your browser on: 
        
        http://monitorip:port


    /**
    * gencode utility (crc16 based)
    */
    if you decide to make your dashbaord private with a password, you'll need to: 

        - set config.__web_auth__ to true
        - set config.__web_secret_key__ to "a new secret key"
        - use gencode to compute a password from your login string

    After the secret key has been set just do:

        node ./dist/gencode.ts mylogin <enter>

    if everyhting is ok, you'll get a string of 4 or 5 digits that will be your password (nothing is stored anywhere)
    

**NDMonitor is based on HBMon V1 a "web dashboard" for HBlink by N0MJS.**
**and a newer version HBMon V2 (2021) by SP2ONG**

https://github.com/sp2ong/HBMonv2



Copyright (C) 2021-2023  Jean-Michel Cohen, F4JDN <f4jdn@outlook.fr>

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program; if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301  USA

---
