#!/bin/bash

# Run app.js on 4 parallel threads using GNU Parallel
# --ungroup (-u) shows output in real-time as it happens (unordered)
seq 4 | parallel -j 4 --ungroup node app.js
