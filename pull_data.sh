#!/bin/bash
echo "Pulling data from Pi (192.168.40.71)..."
DATE=$(date +%Y%m%d)
scp pihole@192.168.40.71:~/Scouting-App/Server/data/scouting_database.json "$HOME/Downloads/scouting_database_$DATE.json"
echo "Done! Saved to ~/Downloads/scouting_database_$DATE.json"
