override the current gps_data.py in your D-APRS folder with this one

I M P O R T A N T :
-------------------
 - check if the path to the gps_data_user_loc.txt file is coherent line 164 of gps_data.py
 - adjust it to your configuration

                dash_entries = ast.literal_eval(os.popen('cat /tmp/gps_data_user_loc.txt').read())

M O D I F I C A T I O N S  M A D E  :
-------------------------------------
"icon_table" and "icon_icon" have been added to all the calls to "dashboard_loc_write"

from:
  dashboard_loc_write(call, lat, lon, time, comment)
to:
  dashboard_loc_write(call, lat, lon, time, comment, icon_table, icon_icon)

and the function writes those two parameters to the "gps_data_user_loc.txt" file

from:

def dashboard_loc_write(call, lat, lon, time, comment):
    dash_entries = ast.literal_eval(os.popen('cat /tmp/gps_data_user_loc.txt').read())

    dash_entries.insert(0, {'call': call, 'lat': lat, 'lon': lon, 'time':time, 'comment':comment})

to:

def dashboard_loc_write(call, lat, lon, time, comment, icon_table, icon_icon):
    dash_entries = ast.literal_eval(os.popen('cat /tmp/gps_data_user_loc.txt').read())

    dash_entries.insert(0, {'call': call, 'lat': lat, 'lon': lon, 'time':time, 'comment':comment, 'icon_table': icon_table, 'icon_icon': icon_icon})
