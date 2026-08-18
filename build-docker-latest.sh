#!/bin/sh
source ./.env

GIT_TAG_VERSION=$(git describe --tags --abbrev=0)
IMAGE_VERSION=${GIT_TAG_VERSION:-latest}
DOCKER_IMAGE="${DOCKER_REGISTRY_USERNAME}/${DOCKER_IMAGE_NAME}:${IMAGE_VERSION}"
DOCKER_IMAGE_LATEST="${DOCKER_REGISTRY_USERNAME}/${DOCKER_IMAGE_NAME}:latest"

echo "IMAGE_VERSION: $IMAGE_VERSION"
echo "DOCKER_IMAGE_LATEST: $DOCKER_IMAGE_LATEST"
echo "Building Docker Image: $DOCKER_IMAGE and $DOCKER_IMAGE_LATEST"

docker build --rm -f ./Dockerfile \
    -t $DOCKER_IMAGE \
    -t $DOCKER_IMAGE_LATEST \
    --build-arg v=$IMAGE_VERSION \
    --platform linux/amd64 \
    .

echo "$DOCKER_REGISTRY_TOKEN" | docker login -u $DOCKER_REGISTRY_USERNAME --password-stdin

docker push $DOCKER_IMAGE
docker push $DOCKER_IMAGE_LATEST

docker rmi $DOCKER_IMAGE
docker rmi $DOCKER_IMAGE_LATEST