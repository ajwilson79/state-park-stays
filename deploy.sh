#!/bin/bash
set -e
IMAGE="awilson79/state-park-stays:latest"
docker build -t $IMAGE .
docker push $IMAGE
echo "Pushed $IMAGE — trigger Force Update in Unraid to deploy"
