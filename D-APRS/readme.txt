override the current gps_data.py in your D-APRS folder with this one

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


