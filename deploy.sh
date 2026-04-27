#!/bin/bash
set -e

IMAGE="omokayj/travelplanner"
VERSION_FILE=".docker-version"

# Read current version or start at 1.0.0
if [ -f "$VERSION_FILE" ]; then
  CURRENT=$(cat "$VERSION_FILE")
else
  CURRENT="1.0.0"
fi

# Parse semver
MAJOR=$(echo "$CURRENT" | cut -d. -f1)
MINOR=$(echo "$CURRENT" | cut -d. -f2)
PATCH=$(echo "$CURRENT" | cut -d. -f3)

# Determine bump type from arg (default: patch)
BUMP="${1:-patch}"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *)
    echo "Usage: $0 [patch|minor|major]"
    echo "  patch  → x.x.X  (default, bug fixes)"
    echo "  minor  → x.X.0  (new features)"
    echo "  major  → X.0.0  (breaking changes)"
    exit 1
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo "🔖  Version: $CURRENT → $NEW_VERSION"
echo "🐳  Image:   $IMAGE:$NEW_VERSION"
echo ""

# Build
echo "🔨  Building..."
docker build -t "$IMAGE:$NEW_VERSION" -t "$IMAGE:latest" .

# Save new version
echo "$NEW_VERSION" > "$VERSION_FILE"

# Push
echo "📤  Pushing $IMAGE:$NEW_VERSION and $IMAGE:latest..."
docker push "$IMAGE:$NEW_VERSION"
docker push "$IMAGE:latest"

echo ""
echo "✅  Done! Published $IMAGE:$NEW_VERSION"
echo ""
echo "To deploy on your server:"
echo "  docker compose pull && docker compose up -d"
