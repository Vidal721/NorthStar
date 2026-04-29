#!/bin/bash
echo "Starting all Pi servers..."
ssh pihole@192.168.40.71 "sudo python3 ~/Scouting-App/Server/bt_server.py &"
sleep 1
ssh pihole@192.168.40.71 "node ~/Scouting-App/Server/Server.js &"
echo "Done! Dashboard at http://192.168.40.71:3000"
