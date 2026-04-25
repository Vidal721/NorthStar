#!/bin/bash
echo "Starting BT server on Pi..."
ssh pihole@192.168.40.71 "sudo python3 ~/Scouting-App/Server/bt_server.py"
